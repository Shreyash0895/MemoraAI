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

  -- Family and friends the badge should recognize
  CREATE TABLE IF NOT EXISTS people (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    relationship TEXT NOT NULL,
    notes        TEXT NOT NULL DEFAULT '',
    created_at   INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS person_photos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    mime       TEXT NOT NULL,
    data       BLOB NOT NULL,
    face_status TEXT NOT NULL DEFAULT 'pending', -- pending | ok | noface | multiface
    embedding   BLOB,                            -- 128 float32 numbers (512 bytes) when status is ok
    created_at INTEGER NOT NULL
  );
  -- Every face the badge recognized (or failed to), used for the timeline and analytics
  CREATE TABLE IF NOT EXISTS recognitions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    person_id    INTEGER REFERENCES people(id) ON DELETE SET NULL,
    name         TEXT NOT NULL DEFAULT '',
    relationship TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL,                  -- match | unknown | unsure
    score        REAL,
    created_at   INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_people_user ON people(user_id);
  CREATE INDEX IF NOT EXISTS idx_photos_person ON person_photos(person_id);
  CREATE INDEX IF NOT EXISTS idx_recog_user ON recognitions(user_id, created_at DESC);
  -- Patient screens (companion mode) that a caregiver has paired; only a hash of each screen's token is kept
  CREATE TABLE IF NOT EXISTS companion_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    label      TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen  INTEGER
  );
  -- One short-lived pairing code per caregiver (hashed)
  CREATE TABLE IF NOT EXISTS pair_codes (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    code_hash  TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL
  );

  -- Calming exercises the patient (or the badge) started, and how they felt afterwards
  CREATE TABLE IF NOT EXISTS calm_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trigger    TEXT NOT NULL,          -- patient | badge
    started_at INTEGER NOT NULL,
    ended_at   INTEGER,
    outcome    TEXT                    -- calmer | same | worse (null if they just closed it)
  );
  CREATE INDEX IF NOT EXISTS idx_calm_user ON calm_sessions(user_id, started_at DESC);

  CREATE INDEX IF NOT EXISTS idx_companion_user ON companion_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_medicines_user ON medicines(user_id);
  CREATE INDEX IF NOT EXISTS idx_alerts_user    ON alerts(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_locations_user ON locations(user_id, recorded_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_user  ON activity(user_id, created_at DESC);
`);

// Databases created before face recognition need the new photo columns
const photoCols = db.prepare("PRAGMA table_info(person_photos)").all().map((c) => c.name);
if (!photoCols.includes("face_status")) db.exec("ALTER TABLE person_photos ADD COLUMN face_status TEXT NOT NULL DEFAULT 'pending'");
if (!photoCols.includes("embedding")) db.exec("ALTER TABLE person_photos ADD COLUMN embedding BLOB");

// Databases created before companion mode need these columns
function addColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumn("settings", "caregiver_phone", "TEXT NOT NULL DEFAULT ''");
addColumn("settings", "c_meds", "INTEGER NOT NULL DEFAULT 1");
addColumn("settings", "c_person", "INTEGER NOT NULL DEFAULT 1");
addColumn("settings", "c_home", "INTEGER NOT NULL DEFAULT 1");
addColumn("settings", "c_help", "INTEGER NOT NULL DEFAULT 1");
addColumn("settings", "c_calm", "INTEGER NOT NULL DEFAULT 1");          // "I feel worried" calming exercises
addColumn("settings", "c_stretch", "INTEGER NOT NULL DEFAULT 0");       // seated stretches: off until the caregiver agrees
addColumn("settings", "calm_message", "TEXT NOT NULL DEFAULT ''");      // caregiver's own comforting message
addColumn("settings", "calm_offer_until", "INTEGER NOT NULL DEFAULT 0"); // caregiver offered an exercise remotely
addColumn("medicine_logs", "source", "TEXT NOT NULL DEFAULT 'caregiver'"); // caregiver | patient

export const publicUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  patient: row.patient_name,
});
