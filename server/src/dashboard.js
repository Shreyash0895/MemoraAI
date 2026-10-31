import { Router } from "express";
import crypto from "node:crypto";
import { db } from "./db.js";
import { requireAuth } from "./auth.js";
import { getSettings, logActivity, processTelemetry, raiseSOS } from "./core.js";
import { distanceMeters } from "./geo.js";
import { hashKey } from "./device.js";

const STATUSES = ["new", "acknowledged", "resolved"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const invalid = (res, message) => res.status(400).json({ code: "invalid", message });
const notFound = (res) => res.status(404).json({ code: "not-found", message: "Not found." });
const text = (v, max) => {
  const s = String(v ?? "").trim();
  return s && s.length <= max ? s : null;
};
const idOf = (req) => {
  const n = Number(req.params.id);
  return Number.isInteger(n) ? n : null;
};
const validZone = (tz) => {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
};

const MED_SQL = `
  SELECT m.id, m.name, m.dose, m.time,
         (SELECT MAX(taken_at) FROM medicine_logs l WHERE l.medicine_id = m.id) AS takenAt
  FROM medicines m WHERE m.user_id = ?`;
const ALERT_SQL = "SELECT id, type, severity, title, detail, status, created_at AS at FROM alerts";

export const dashboardRouter = Router();
dashboardRouter.use(["/dashboard", "/medicines", "/alerts", "/settings", "/demo"], requireAuth);

// Everything the dashboard needs in one call (it polls this every few seconds)
dashboardRouter.get("/dashboard", (req, res) => {
  const uid = req.user.id;
  const s = getSettings(uid);
  const dev = db.prepare("SELECT key_hint, last_seen, battery FROM devices WHERE user_id = ?").get(uid);
  res.json({
    settings: { homeLat: s.home_lat, homeLng: s.home_lng, radiusM: s.radius_m, timezone: s.timezone },
    outside: !!s.outside,
    lastRecognition: db
      .prepare(`SELECT person_id AS personId, name, relationship, created_at AS at, score
                FROM recognitions WHERE user_id = ? AND status = 'match' ORDER BY created_at DESC, id DESC LIMIT 1`)
      .get(uid) ?? null,
    device: dev
      ? { hasKey: true, keyHint: dev.key_hint, lastSeen: dev.last_seen, battery: dev.battery }
      : { hasKey: false, keyHint: null, lastSeen: null, battery: null },
    medicines: db.prepare(`${MED_SQL} ORDER BY m.time, m.id`).all(uid),
    alerts: db.prepare(`${ALERT_SQL} WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`).all(uid),
    activity: db
      .prepare("SELECT id, kind, text, created_at AS at FROM activity WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 40")
      .all(uid),
    locations: db
      .prepare(`SELECT lat, lng, recorded_at AS at FROM
                 (SELECT * FROM locations WHERE user_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 60)
                ORDER BY recorded_at ASC, id ASC`)
      .all(uid),
  });
});

// ---- medicines ----
dashboardRouter.post("/medicines", (req, res) => {
  const uid = req.user.id;
  const name = text(req.body?.name, 80);
  const dose = text(req.body?.dose, 40);
  const time = String(req.body?.time ?? "");
  if (!name) return invalid(res, "Enter the medicine name.");
  if (!dose) return invalid(res, "Enter the dose, like 5 mg.");
  if (!TIME_RE.test(time)) return invalid(res, "Choose a valid time.");
  if (db.prepare("SELECT COUNT(*) AS c FROM medicines WHERE user_id = ?").get(uid).c >= 50)
    return invalid(res, "You can schedule up to 50 medicines.");

  const info = db
    .prepare("INSERT INTO medicines (user_id, name, dose, time, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(uid, name, dose, time, Date.now());
  res.status(201).json({ id: Number(info.lastInsertRowid), name, dose, time, takenAt: null });
});

dashboardRouter.delete("/medicines/:id", (req, res) => {
  const id = idOf(req);
  const info = id == null ? { changes: 0 } : db.prepare("DELETE FROM medicines WHERE id = ? AND user_id = ?").run(id, req.user.id);
  if (!info.changes) return notFound(res);
  res.json({ ok: true });
});

dashboardRouter.post("/medicines/:id/taken", (req, res) => {
  const id = idOf(req);
  const med = id == null ? null : db.prepare("SELECT id, name FROM medicines WHERE id = ? AND user_id = ?").get(id, req.user.id);
  if (!med) return notFound(res);

  const takenAt = Date.now();
  db.prepare("INSERT INTO medicine_logs (medicine_id, taken_at) VALUES (?, ?)").run(med.id, takenAt);
  const activity = logActivity(req.user.id, "ok", `Medicine taken: ${med.name} (marked by caregiver)`);
  res.json({ takenAt, activity });
});

// ---- alerts ----
dashboardRouter.patch("/alerts/:id", (req, res) => {
  const id = idOf(req);
  const status = req.body?.status;
  if (!STATUSES.includes(status)) return invalid(res, "Invalid status.");
  const info = id == null ? { changes: 0 } : db.prepare("UPDATE alerts SET status = ? WHERE id = ? AND user_id = ?").run(status, id, req.user.id);
  if (!info.changes) return notFound(res);
  res.json(db.prepare(`${ALERT_SQL} WHERE id = ?`).get(id));
});

// ---- safe zone settings ----
dashboardRouter.put("/settings", (req, res) => {
  const uid = req.user.id;
  const lat = Number(req.body?.homeLat);
  const lng = Number(req.body?.homeLng);
  const radius = Number(req.body?.radiusM);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) return invalid(res, "Latitude must be between -90 and 90.");
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) return invalid(res, "Longitude must be between -180 and 180.");
  if (!Number.isInteger(radius) || radius < 50 || radius > 5000) return invalid(res, "Radius must be a whole number from 50 to 5000 metres.");

  getSettings(uid);
  db.prepare("UPDATE settings SET home_lat = ?, home_lng = ?, radius_m = ? WHERE user_id = ?").run(lat, lng, radius, uid);

  // Recompute inside/outside for the new zone, without raising an alert
  const last = db.prepare("SELECT lat, lng FROM locations WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(uid);
  const outside = last && distanceMeters(last.lat, last.lng, lat, lng) > radius ? 1 : 0;
  db.prepare("UPDATE settings SET outside = ? WHERE user_id = ?").run(outside, uid);
  res.json({ ok: true });
});

dashboardRouter.put("/settings/timezone", (req, res) => {
  const tz = String(req.body?.timezone ?? "");
  if (!tz || tz.length > 64 || !validZone(tz)) return invalid(res, "Invalid time zone.");
  getSettings(req.user.id);
  db.prepare("UPDATE settings SET timezone = ? WHERE user_id = ?").run(tz, req.user.id);
  res.json({ ok: true });
});

// ---- badge key (shown once; only the hash is stored) ----
dashboardRouter.post("/device/key", requireAuth, (req, res) => {
  const key = `mk_${crypto.randomBytes(24).toString("hex")}`;
  db.prepare(`INSERT INTO devices (user_id, key_hash, key_hint, created_at) VALUES (?, ?, ?, ?)
              ON CONFLICT(user_id) DO UPDATE SET key_hash = excluded.key_hash, key_hint = excluded.key_hint,
                created_at = excluded.created_at, last_seen = NULL, battery = NULL`)
    .run(req.user.id, hashKey(key), key.slice(-4), Date.now());
  res.status(201).json({ key });
});

// ---- demo simulator: same pipeline as the real badge, but signed in as the caregiver ----
dashboardRouter.post("/demo/telemetry", (req, res) => {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return invalid(res, "Invalid coordinates.");
  res.json({ ok: true, ...processTelemetry(req.user.id, lat, lng) });
});

dashboardRouter.post("/demo/sos", (req, res) => {
  res.status(201).json({ ok: true, alertId: raiseSOS(req.user.id).id });
});
