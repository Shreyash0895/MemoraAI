/*
 * Calming assistance. Gentle, scripted and caregiver-approved: breathing, looking at loved ones,
 * and (only if the caregiver turns them on) seated stretches. It adapts to how the patient says
 * they feel, and tells the caregiver if they are still worried. It never diagnoses or replaces
 * a person. Nothing here tries to detect emotion automatically.
 */
import { db } from "./db.js";
import { HttpError } from "./errors.js";
import { createAlert, getSettings, logActivity } from "./core.js";

export const OFFER_TTL_MS = 10 * 60 * 1000;          // a remote offer stays visible for 10 minutes
export const REPEAT_WINDOW_MS = 30 * 60 * 1000;      // 3 requests in 30 minutes means they need a person
export const REPEAT_COUNT = 3;
export const REPEAT_ALERT_COOLDOWN_MS = 60 * 60 * 1000;
export const WORSE_ALERT_COOLDOWN_MS = 15 * 60 * 1000;
export const OUTCOMES = ["calmer", "same", "worse"];
export const BREATH_CYCLES = 5;                      // breathe in 4 s, out 6 s, five times

const REPEAT_TITLE = "Asked for comfort several times";
const WORSE_TITLE = "Still worried after calming exercises";

const disabled = () => new HttpError(403, "This isn’t available on this screen.", "disabled");
const alertedSince = (userId, title, since) =>
  !!db.prepare("SELECT 1 FROM alerts WHERE user_id = ? AND type = 'distress' AND title = ? AND created_at >= ?").get(userId, title, since);

/** The patient (or the badge) starts a calming exercise. */
export function startCalm(userId, trigger = "patient", now = Date.now()) {
  if (!getSettings(userId).c_calm) throw disabled();
  db.prepare("UPDATE settings SET calm_offer_until = 0 WHERE user_id = ?").run(userId); // the offer has been taken up
  const info = db.prepare("INSERT INTO calm_sessions (user_id, trigger, started_at) VALUES (?, ?, ?)").run(userId, trigger, now);
  logActivity(userId, "move", trigger === "badge" ? "Asked the badge for comfort" : "Started a calming exercise", now);

  const recent = db.prepare("SELECT COUNT(*) AS c FROM calm_sessions WHERE user_id = ? AND started_at >= ?").get(userId, now - REPEAT_WINDOW_MS).c;
  if (recent >= REPEAT_COUNT && !alertedSince(userId, REPEAT_TITLE, now - REPEAT_ALERT_COOLDOWN_MS)) {
    createAlert(userId, { type: "distress", severity: "medium", title: REPEAT_TITLE,
      detail: `The patient asked for a calming exercise ${recent} times in the last 30 minutes. They may need a person to check in.` }, now);
  }
  return { sessionId: Number(info.lastInsertRowid) };
}

/** How the patient said they felt afterwards. "Worse" tells the caregiver. */
export function finishCalm(userId, sessionId, outcome, now = Date.now()) {
  if (!OUTCOMES.includes(outcome)) throw new HttpError(400, "Invalid outcome.");
  const row = Number.isInteger(sessionId)
    ? db.prepare("SELECT id, outcome FROM calm_sessions WHERE id = ? AND user_id = ?").get(sessionId, userId)
    : null;
  if (!row) throw new HttpError(404, "Not found.", "not-found");
  if (row.outcome) return { ok: true, notified: false, repeat: true }; // already answered: don't log twice

  db.prepare("UPDATE calm_sessions SET outcome = ?, ended_at = ? WHERE id = ?").run(outcome, now, row.id);
  const text = { calmer: "Felt calmer after a calming exercise", same: "Felt about the same after a calming exercise", worse: "Still worried after a calming exercise" }[outcome];
  logActivity(userId, outcome === "worse" ? "warn" : "ok", text, now);

  let notified = false;
  if (outcome === "worse" && !alertedSince(userId, WORSE_TITLE, now - WORSE_ALERT_COOLDOWN_MS)) {
    createAlert(userId, { type: "distress", severity: "high", title: WORSE_TITLE,
      detail: "The patient said they are still worried after a calming exercise. Please check in with them." }, now);
    notified = true;
  }
  return { ok: true, notified, repeat: false };
}

/** Caregiver gently offers an exercise on the patient's screen (they can say no). */
export function offerCalm(userId, now = Date.now()) {
  if (!getSettings(userId).c_calm) throw new HttpError(400, "Turn on “I feel worried” in Settings first.");
  db.prepare("UPDATE settings SET calm_offer_until = ? WHERE user_id = ?").run(now + OFFER_TTL_MS, userId);
  logActivity(userId, "move", "Offered a calming exercise on the patient’s screen", now);
  const screens = db.prepare("SELECT COUNT(*) AS c FROM companion_sessions WHERE user_id = ?").get(userId).c;
  return { ok: true, delivered: screens > 0, expiresAt: now + OFFER_TTL_MS };
}

export function getCalmSummary(userId, now = Date.now()) {
  const s = getSettings(userId);
  return {
    enabled: !!s.c_calm,
    offerActive: s.calm_offer_until > now,
    recent: db
      .prepare("SELECT id, trigger, started_at AS startedAt, outcome FROM calm_sessions WHERE user_id = ? ORDER BY started_at DESC, id DESC LIMIT 5")
      .all(userId),
  };
}

/** What the patient's screen needs for the calming flow. */
export function calmForPatient(userId, now = Date.now()) {
  const s = getSettings(userId);
  if (!s.c_calm) return { enabled: false, stretches: false, message: "", offer: false, people: [] };
  const people = db
    .prepare(`SELECT p.id, p.name, p.relationship, p.notes FROM people p
              WHERE p.user_id = ? AND EXISTS (SELECT 1 FROM person_photos ph WHERE ph.person_id = p.id)
              ORDER BY p.name COLLATE NOCASE LIMIT 8`)
    .all(userId);
  return { enabled: true, stretches: !!s.c_stretch, message: s.calm_message, offer: s.calm_offer_until > now, people };
}

/**
 * A spoken breathing guide for the badge's speaker (and anything else that reads aloud).
 * Each step: say this, then wait pauseMs before the next one.
 */
export function calmScript(userId) {
  const s = getSettings(userId);
  const name = db.prepare("SELECT patient_name FROM users WHERE id = ?").get(userId).patient_name;
  const steps = [
    { say: `${name}, you are safe.`, pauseMs: 2500 },
    { say: "Let’s take a slow breath together.", pauseMs: 2500 },
  ];
  for (let i = 0; i < BREATH_CYCLES; i++) {
    steps.push({ say: "Breathe in slowly.", pauseMs: 4000 });
    steps.push({ say: "Breathe out slowly.", pauseMs: 6000 });
  }
  steps.push({ say: "Well done.", pauseMs: 2000 });
  if (s.calm_message) steps.push({ say: s.calm_message, pauseMs: 0 });
  return steps;
}
