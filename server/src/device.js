/* Endpoints the ESP32 badge calls. Authenticated with the X-Device-Key header. */
import { Router } from "express";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { db } from "./db.js";
import express from "express";
import { createAlert, getSettings, logActivity, processBattery, processTelemetry, raiseSOS } from "./core.js";
import { identify, recordRecognition } from "./recognition.js";
import { sniffImage } from "./peopleStore.js";
import { HttpError } from "./errors.js";

export const hashKey = (key) => crypto.createHash("sha256").update(key).digest("hex");

const bad = (res, message) => res.status(400).json({ code: "invalid", message });
const clean = (v, max) => {
  const s = String(v ?? "").trim();
  return s && s.length <= max ? s : null;
};

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: (req) => req.get("x-device-key") || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ code: "rate-limited", message: "Too many requests." }),
});

function deviceAuth(req, res, next) {
  const key = String(req.get("x-device-key") ?? "");
  const row = key ? db.prepare("SELECT user_id FROM devices WHERE key_hash = ?").get(hashKey(key)) : null;
  if (!row) return res.status(401).json({ code: "invalid-device-key", message: "Unknown device key." });
  db.prepare("UPDATE devices SET last_seen = ? WHERE user_id = ?").run(Date.now(), row.user_id);
  req.deviceUserId = row.user_id;
  next();
}

export const deviceRouter = Router();
deviceRouter.use("/device", limiter, deviceAuth);

// { "lat": 18.52, "lng": 73.85, "battery": 82 }
deviceRouter.post("/device/telemetry", (req, res) => {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return bad(res, "Invalid coordinates.");

  let battery = null;
  if (req.body?.battery !== undefined) {
    battery = Number(req.body.battery);
    if (!Number.isInteger(battery) || battery < 0 || battery > 100) return bad(res, "battery must be a whole number from 0 to 100.");
  }

  const result = processTelemetry(req.deviceUserId, lat, lng);
  if (battery !== null) processBattery(req.deviceUserId, battery);
  res.json({ ok: true, ...result });
});

// SOS button pressed
deviceRouter.post("/device/sos", (req, res) => {
  const alert = raiseSOS(req.deviceUserId);
  res.status(201).json({ ok: true, alertId: alert.id });
});

// { "recognized": true, "name": "Arjun", "relationship": "son" }  or  { "recognized": false }
deviceRouter.post("/device/face", (req, res) => {
  const uid = req.deviceUserId;
  if (req.body?.recognized === true) {
    const name = clean(req.body?.name, 80);
    const relationship = req.body?.relationship ? clean(req.body.relationship, 40) : null;
    if (!name) return bad(res, "name is required when recognized is true.");
    logActivity(uid, "face", `Recognized ${name}${relationship ? ` (${relationship})` : ""}`);
  } else if (req.body?.recognized === false) {
    createAlert(uid, {
      type: "face", severity: "medium", title: "Unknown person detected",
      detail: "The badge camera saw a face that isn’t in the family database.",
    });
    logActivity(uid, "warn", "Unknown person detected");
  } else {
    return bad(res, "recognized must be true or false.");
  }
  res.status(201).json({ ok: true });
});

// The badge downloads the medicine schedule so it can speak reminders
deviceRouter.get("/device/schedule", (req, res) => {
  const uid = req.deviceUserId;
  res.json({
    timezone: getSettings(uid).timezone,
    medicines: db.prepare("SELECT id, name, dose, time FROM medicines WHERE user_id = ? ORDER BY time, id").all(uid),
  });
});

// A camera frame as raw JPEG/PNG bytes. Replies with who it is and what the badge should say.
const frameParser = express.raw({ type: ["image/jpeg", "image/png"], limit: "2mb" });
deviceRouter.post("/device/recognize", frameParser, async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || !sniffImage(req.body))
      throw new HttpError(415, "Send the frame as image/jpeg or image/png.", "unsupported");
    const result = await identify(req.deviceUserId, req.body);
    res.json(recordRecognition(req.deviceUserId, result));
  } catch (e) { next(e); }
});
