/*
 * Shared monitoring logic. Used by the badge (device.js), the dashboard's
 * demo simulator (dashboard.js) and the scheduler (monitor.js), so every
 * source goes through the same geofence and alert rules.
 */
import { db } from "./db.js";
import { distanceMeters } from "./geo.js";

export const DEFAULT_HOME = { lat: 18.5204, lng: 73.8567 }; // placeholder (Pune); caregivers set their own
const MAX_LOCATIONS = 2000; // history kept per caregiver
const LOW_BATTERY_ON = 20;
const LOW_BATTERY_OFF = 30;

export function logActivity(userId, kind, message) {
  const at = Date.now();
  const info = db
    .prepare("INSERT INTO activity (user_id, kind, text, created_at) VALUES (?, ?, ?, ?)")
    .run(userId, kind, message, at);
  return { id: Number(info.lastInsertRowid), kind, text: message, at };
}

export function createAlert(userId, { type, severity, title, detail }) {
  const at = Date.now();
  const info = db
    .prepare("INSERT INTO alerts (user_id, type, severity, title, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(userId, type, severity, title, detail, at);
  return { id: Number(info.lastInsertRowid), type, severity, title, detail, status: "new", at };
}

export function getSettings(userId) {
  let s = db.prepare("SELECT * FROM settings WHERE user_id = ?").get(userId);
  if (!s) {
    db.prepare("INSERT OR IGNORE INTO settings (user_id, home_lat, home_lng) VALUES (?, ?, ?)")
      .run(userId, DEFAULT_HOME.lat, DEFAULT_HOME.lng);
    s = db.prepare("SELECT * FROM settings WHERE user_id = ?").get(userId);
  }
  return s;
}

/** Saves a GPS reading and runs the geofence check. Alerts fire once per exit. */
export function processTelemetry(userId, lat, lng) {
  const s = getSettings(userId);
  db.prepare("INSERT INTO locations (user_id, lat, lng, recorded_at) VALUES (?, ?, ?, ?)").run(userId, lat, lng, Date.now());
  db.prepare("DELETE FROM locations WHERE user_id = ? AND id NOT IN (SELECT id FROM locations WHERE user_id = ? ORDER BY id DESC LIMIT ?)")
    .run(userId, userId, MAX_LOCATIONS);

  const dist = distanceMeters(lat, lng, s.home_lat, s.home_lng);
  const comeBackAt = s.radius_m - Math.min(20, s.radius_m * 0.2); // buffer so GPS jitter doesn't flip-flop
  let outside = !!s.outside;

  if (dist > s.radius_m && !outside) {
    outside = true;
    db.prepare("UPDATE settings SET outside = 1 WHERE user_id = ?").run(userId);
    createAlert(userId, { type: "geofence", severity: "high", title: "Left safe zone", detail: `Patient is ${Math.round(dist)} m from home.` });
    logActivity(userId, "warn", "Left the safe zone");
  } else if (dist < comeBackAt && outside) {
    outside = false;
    db.prepare("UPDATE settings SET outside = 0 WHERE user_id = ?").run(userId);
    logActivity(userId, "ok", "Back inside the safe zone");
  }
  return { distance: Math.round(dist), outside };
}

/** Records the badge battery level; one alert per drain, re-armed after recharging. */
export function processBattery(userId, level) {
  db.prepare("UPDATE devices SET battery = ? WHERE user_id = ?").run(level, userId);
  const s = getSettings(userId);
  if (level <= LOW_BATTERY_ON && !s.low_battery) {
    db.prepare("UPDATE settings SET low_battery = 1 WHERE user_id = ?").run(userId);
    createAlert(userId, { type: "battery", severity: "low", title: "Low battery", detail: `Badge battery is at ${level}%.` });
    logActivity(userId, "warn", `Badge battery low (${level}%)`);
  } else if (level >= LOW_BATTERY_OFF && s.low_battery) {
    db.prepare("UPDATE settings SET low_battery = 0 WHERE user_id = ?").run(userId);
  }
}

export function raiseSOS(userId) {
  const alert = createAlert(userId, {
    type: "sos", severity: "critical", title: "SOS button pressed",
    detail: "The patient pressed the emergency button on the badge.",
  });
  logActivity(userId, "warn", "SOS button pressed");
  return alert;
}
