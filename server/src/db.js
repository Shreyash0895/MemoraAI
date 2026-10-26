import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dir = process.env.DB_DIR || "./data";
fs.mkdirSync(dir, { recursive: true });

export const db = new Database(path.join(dir, "memoraai.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    patient_name  TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Medicine schedule (one row per medicine, time is "HH:MM")
  CREATE TABLE IF NOT EXISTS medicines (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    dose       TEXT NOT NULL,
    time       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  -- One row each time a dose is marked taken (history for analytics)
  CREATE TABLE IF NOT EXISTS medicine_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    taken_at    INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS alerts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    severity   TEXT NOT NULL,
    title      TEXT NOT NULL,
    detail     TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'new',
    created_at INTEGER NOT NULL
  );
  -- GPS history (timestamps are epoch milliseconds)
  CREATE TABLE IF NOT EXISTS locations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lat         REAL NOT NULL,
    lng         REAL NOT NULL,
    recorded_at INTEGER NOT NULL
  );
  -- Activity timeline shown on the dashboard
  CREATE TABLE IF NOT EXISTS activity (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    text       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- Safe zone and monitoring state (one row per caregiver)
  CREATE TABLE IF NOT EXISTS settings (
    user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    home_lat    REAL NOT NULL,
    home_lng    REAL NOT NULL,
    radius_m    INTEGER NOT NULL DEFAULT 150,
    timezone    TEXT NOT NULL DEFAULT 'UTC',
    outside     INTEGER NOT NULL DEFAULT 0,
    low_battery INTEGER NOT NULL DEFAULT 0
  );
  -- The patient's badge: only a hash of its key is stored
  CREATE TABLE IF NOT EXISTS devices (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    key_hash   TEXT NOT NULL UNIQUE,
    key_hint   TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen  INTEGER,
    battery    INTEGER
  );
  -- Makes sure a missed dose raises only one alert per day
  CREATE TABLE IF NOT EXISTS medicine_alerts (
    medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    day         TEXT NOT NULL,
    PRIMARY KEY (medicine_id, day)
  );

  CREATE INDEX IF NOT EXISTS idx_medicines_user ON medicines(user_id);
  CREATE INDEX IF NOT EXISTS idx_alerts_user    ON alerts(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_locations_user ON locations(user_id, recorded_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_user  ON activity(user_id, created_at DESC);
`);

export const publicUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  patient: row.patient_name,
});
