/* Background check (every minute): raises one "Missed medicine" alert per dose per day. */
import { db } from "./db.js";
import { createAlert, logActivity } from "./core.js";
import { backfillEmbeddings } from "./recognition.js";
import { localClock } from "./time.js";

const GRACE_MIN = 30; // how long after the scheduled time before a dose counts as missed

const pretty = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

export function runMonitor(nowMs = Date.now()) {
  const rows = db
    .prepare(`SELECT m.id, m.user_id, m.name, m.time, m.created_at, COALESCE(s.timezone, 'UTC') AS tz
              FROM medicines m LEFT JOIN settings s ON s.user_id = m.user_id`)
    .all();

  for (const m of rows) {
    const now = localClock(m.tz, nowMs);
    const [h, min] = m.time.split(":").map(Number);
    const due = h * 60 + min;
    if (now.minutes < due + GRACE_MIN) continue;                    // not overdue yet
    if (m.created_at > now.dayStart + due * 60000) continue;        // added after today's dose time
    if (db.prepare("SELECT 1 FROM medicine_logs WHERE medicine_id = ? AND taken_at >= ?").get(m.id, now.dayStart)) continue;
    if (!db.prepare("INSERT OR IGNORE INTO medicine_alerts (medicine_id, day) VALUES (?, ?)").run(m.id, now.day).changes) continue;

    createAlert(m.user_id, {
      type: "medicine", severity: "medium", title: "Missed medicine",
      detail: `${m.name} at ${pretty(m.time)} was not marked as taken.`,
    });
    logActivity(m.user_id, "warn", `Missed medicine: ${m.name}`);
  }
}

export function startMonitor() {
  const safeRun = () => { try { runMonitor(); } catch (e) { console.error("monitor error", e); } };
  setTimeout(safeRun, 5000);
  setInterval(safeRun, 60 * 1000);

  // Check photos that were saved while the face service was down
  const safeBackfill = () => backfillEmbeddings().catch((e) => console.error("backfill error", e));
  setTimeout(safeBackfill, 10000);
  setInterval(safeBackfill, 60 * 1000);
}
