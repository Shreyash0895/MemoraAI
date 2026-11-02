/*
 * Companion mode: a simple screen for the patient, paired by the caregiver with a short code.
 * The patient's screen can only read "today" and do three small things: confirm a medicine,
 * ask for help, and look at who is visiting. It never sees alerts, settings or location history.
 */
import crypto from "node:crypto";
import { db } from "./db.js";
import { HttpError } from "./errors.js";
import { getSettings, logActivity, raiseSOS } from "./core.js";
import { localClock } from "./time.js";
import { calmForPatient } from "./calmStore.js";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_SCREENS = 5;
const VISITOR_WINDOW_MS = 2 * 60 * 60 * 1000; // show the last recognized person for 2 hours
const HELP_REPEAT_MS = 60 * 1000;             // repeated presses within a minute don't create more alerts
const DUE_WINDOW_MIN = 60;                    // a dose is "due" from 60 minutes before its time

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

export function labelFromUA(ua = "") {
  const device = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android device"
    : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : /Linux/.test(ua) ? "Linux computer" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox" : "browser";
  return `${device} (${browser})`;
}

// ---------- pairing ----------
export function createPairCode(userId, now = Date.now()) {
  db.prepare("DELETE FROM pair_codes WHERE expires_at < ?").run(now);
  db.prepare("DELETE FROM pair_codes WHERE user_id = ?").run(userId);
  for (let i = 0; i < 10; i++) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const hash = sha(code);
    if (db.prepare("SELECT 1 FROM pair_codes WHERE code_hash = ?").get(hash)) continue; // another caregiver has it right now
    const expiresAt = now + CODE_TTL_MS;
    db.prepare("INSERT INTO pair_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)").run(userId, hash, expiresAt);
    return { code, expiresAt };
  }
  throw new HttpError(500, "Couldn’t create a code. Please try again.", "server-error");
}

export function redeemCode(rawCode, now = Date.now(), userAgent = "") {
  const code = String(rawCode ?? "").replace(/\D/g, "");
  const bad = () => new HttpError(400, "That code isn’t right, or it has expired. Ask your caregiver for a new one.", "bad-code");
  if (code.length !== 6) throw bad();
  const row = db.prepare("SELECT user_id FROM pair_codes WHERE code_hash = ? AND expires_at > ?").get(sha(code), now);
  if (!row) throw bad();
  if (db.prepare("SELECT COUNT(*) AS c FROM companion_sessions WHERE user_id = ?").get(row.user_id).c >= MAX_SCREENS)
    throw new HttpError(400, "Too many screens are connected. Ask your caregiver to remove one.", "too-many-screens");

  const token = crypto.randomBytes(32).toString("hex");
  db.transaction(() => {
    db.prepare("DELETE FROM pair_codes WHERE user_id = ?").run(row.user_id); // a code works once
    db.prepare("INSERT INTO companion_sessions (user_id, token_hash, label, created_at, last_seen) VALUES (?, ?, ?, ?, ?)")
      .run(row.user_id, sha(token), labelFromUA(userAgent), now, now);
  })();
  return { token, userId: row.user_id };
}

export function sessionFromToken(token, now = Date.now()) {
  if (!token || typeof token !== "string") return null;
  const row = db.prepare("SELECT id, user_id, last_seen FROM companion_sessions WHERE token_hash = ?").get(sha(token));
  if (!row) return null;
  if (!row.last_seen || now - row.last_seen > 60_000) db.prepare("UPDATE companion_sessions SET last_seen = ? WHERE id = ?").run(now, row.id);
  return { sessionId: row.id, userId: row.user_id };
}

export function listScreens(userId) {
  return db
    .prepare("SELECT id, label, created_at AS createdAt, last_seen AS lastSeen FROM companion_sessions WHERE user_id = ? ORDER BY id")
    .all(userId);
}

export function removeScreen(userId, id) {
  const info = Number.isInteger(id) ? db.prepare("DELETE FROM companion_sessions WHERE id = ? AND user_id = ?").run(id, userId) : { changes: 0 };
  if (!info.changes) throw new HttpError(404, "Not found.", "not-found");
}

// ---------- caregiver-side settings ----------
export function getCompanionSettings(userId, now = Date.now()) {
  const s = getSettings(userId);
  const pending = db.prepare("SELECT expires_at FROM pair_codes WHERE user_id = ? AND expires_at > ?").get(userId, now);
  return {
    phone: s.caregiver_phone,
    options: { meds: !!s.c_meds, person: !!s.c_person, home: !!s.c_home, help: !!s.c_help, calm: !!s.c_calm, stretch: !!s.c_stretch },
    calmMessage: s.calm_message,
    screens: listScreens(userId),
    codeExpiresAt: pending ? pending.expires_at : null,
  };
}

export function setCompanionSettings(userId, input) {
  const phone = String(input?.phone ?? "").trim();
  if (phone && !/^[0-9+()\-\s]{5,20}$/.test(phone)) throw new HttpError(400, "Enter a phone number using digits, spaces, + or -.");
  const o = input?.options ?? {};
  for (const k of ["meds", "person", "home", "help"]) if (typeof o[k] !== "boolean") throw new HttpError(400, "Invalid options.");
  for (const k of ["calm", "stretch"]) if (o[k] !== undefined && typeof o[k] !== "boolean") throw new HttpError(400, "Invalid options.");
  const cur = getSettings(userId);
  const message = input?.calmMessage === undefined ? cur.calm_message : String(input.calmMessage).trim();
  if (message.length > 200) throw new HttpError(400, "Keep the message under 200 characters.");
  db.prepare(`UPDATE settings SET caregiver_phone = ?, c_meds = ?, c_person = ?, c_home = ?, c_help = ?,
                c_calm = ?, c_stretch = ?, calm_message = ? WHERE user_id = ?`)
    .run(phone, +o.meds, +o.person, +o.home, +o.help,
      o.calm === undefined ? cur.c_calm : +o.calm, o.stretch === undefined ? cur.c_stretch : +o.stretch, message, userId);
}

// ---------- what the patient's screen shows ----------
const MED_SQL = `SELECT m.id, m.name, m.dose, m.time,
  (SELECT MAX(taken_at) FROM medicine_logs l WHERE l.medicine_id = m.id) AS takenAt
  FROM medicines m WHERE m.user_id = ? ORDER BY m.time, m.id`;

export function todayPayload(userId, now = Date.now()) {
  const s = getSettings(userId);
  const clock = localClock(s.timezone, now);
  const patient = db.prepare("SELECT patient_name FROM users WHERE id = ?").get(userId);

  const medicines = s.c_meds
    ? db.prepare(MED_SQL).all(userId).map((m) => {
        const [h, min] = m.time.split(":").map(Number);
        const taken = m.takenAt != null && m.takenAt >= clock.dayStart;
        const status = taken ? "taken" : clock.minutes >= h * 60 + min - DUE_WINDOW_MIN ? "due" : "later";
        return { id: m.id, name: m.name, dose: m.dose, time: m.time, status };
      })
    : [];

  let visitor = null;
  if (s.c_person) {
    const rec = db
      .prepare(`SELECT person_id AS personId, created_at AS at FROM recognitions
                WHERE user_id = ? AND status = 'match' AND person_id IS NOT NULL AND created_at >= ?
                ORDER BY created_at DESC, id DESC LIMIT 1`)
      .get(userId, now - VISITOR_WINDOW_MS);
    const person = rec && db.prepare("SELECT id, name, relationship, notes FROM people WHERE id = ? AND user_id = ?").get(rec.personId, userId);
    if (person) {
      visitor = { ...person, at: rec.at, hasPhoto: !!db.prepare("SELECT 1 FROM person_photos WHERE person_id = ?").get(person.id) };
    }
  }

  return {
    patientName: patient.patient_name,
    now,
    options: { meds: !!s.c_meds, person: !!s.c_person, home: !!s.c_home, help: !!s.c_help },
    calm: calmForPatient(userId, now),
    caregiverPhone: s.caregiver_phone || null,
    home: s.c_home ? { lat: s.home_lat, lng: s.home_lng } : null,
    medicines,
    visitor,
  };
}

/** The patient says they took a dose. Never lets the same dose be recorded twice in a day. */
export function confirmMedicine(userId, medicineId, now = Date.now()) {
  const s = getSettings(userId);
  if (!s.c_meds) throw new HttpError(403, "This isn’t available on this screen.", "disabled");
  const med = Number.isInteger(medicineId) ? db.prepare("SELECT id, name FROM medicines WHERE id = ? AND user_id = ?").get(medicineId, userId) : null;
  if (!med) throw new HttpError(404, "Not found.", "not-found");

  const dayStart = localClock(s.timezone, now).dayStart;
  if (db.prepare("SELECT 1 FROM medicine_logs WHERE medicine_id = ? AND taken_at >= ?").get(med.id, dayStart))
    throw new HttpError(409, "You already took this today. You’re all set.", "already-taken");

  db.prepare("INSERT INTO medicine_logs (medicine_id, taken_at, source) VALUES (?, ?, 'patient')").run(med.id, now);
  logActivity(userId, "ok", `Medicine taken: ${med.name} (confirmed by patient)`);
  return { ok: true, takenAt: now };
}

/** The patient pressed "I need help". Repeated presses within a minute don't flood the caregiver. */
export function requestHelp(userId, now = Date.now()) {
  if (!getSettings(userId).c_help) throw new HttpError(403, "This isn’t available on this screen.", "disabled");
  const recent = db.prepare("SELECT 1 FROM alerts WHERE user_id = ? AND type = 'sos' AND created_at >= ?").get(userId, now - HELP_REPEAT_MS);
  if (recent) return { ok: true, repeat: true };
  raiseSOS(userId, "The patient asked for help on the patient screen.");
  return { ok: true, repeat: false };
}

export function photoFor(userId, personId) {
  const row = Number.isInteger(personId)
    ? db.prepare(`SELECT ph.mime, ph.data FROM person_photos ph JOIN people p ON p.id = ph.person_id
                  WHERE p.id = ? AND p.user_id = ? ORDER BY (ph.face_status = 'ok') DESC, ph.id LIMIT 1`).get(personId, userId)
    : null;
  if (!row) throw new HttpError(404, "Not found.", "not-found");
  return { mime: row.mime, data: Buffer.from(row.data) };
}
