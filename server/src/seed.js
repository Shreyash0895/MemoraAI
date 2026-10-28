import { db } from "./db.js";

const MIN = 60000;

/** Gives the demo caregiver some starting data (only if their account is empty). */
export function seedDemoData(userId) {
  const { n } = db
    .prepare("SELECT (SELECT COUNT(*) FROM medicines WHERE user_id = ?) + (SELECT COUNT(*) FROM alerts WHERE user_id = ?) AS n")
    .get(userId, userId);
  if (n > 0) return;

  const now = Date.now();
  const med = db.prepare("INSERT INTO medicines (user_id, name, dose, time, created_at) VALUES (?, ?, ?, ?, ?)");
  const alert = db.prepare("INSERT INTO alerts (user_id, type, severity, title, detail, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const act = db.prepare("INSERT INTO activity (user_id, kind, text, created_at) VALUES (?, ?, ?, ?)");

  db.transaction(() => {
    med.run(userId, "Donepezil", "5 mg", "08:00", now);
    med.run(userId, "Memantine", "10 mg", "13:00", now);
    med.run(userId, "Vitamin D3", "1 tablet", "20:00", now);

    alert.run(userId, "face", "medium", "Unknown person detected", "The badge camera saw a face that isn’t in the family database.", "new", now - 40 * MIN);
    alert.run(userId, "medicine", "medium", "Missed medicine", "Vitamin D3 at 8:00 pm was not marked as taken.", "acknowledged", now - 19 * 60 * MIN);
    alert.run(userId, "geofence", "high", "Left safe zone", "Patient was 182 m from home for 14 minutes.", "resolved", now - 26 * 60 * MIN);
    alert.run(userId, "battery", "low", "Low battery", "Badge battery dropped below 20%.", "resolved", now - 30 * 60 * MIN);

    act.run(userId, "face", "Recognized Arjun (son)", now - 50 * MIN);
    act.run(userId, "ok", "Medicine taken: Donepezil", now - 6 * 60 * MIN);
    act.run(userId, "ok", "Returned home from a walk", now - 7 * 60 * MIN);
    act.run(userId, "move", "Left home for a walk, inside the safe zone", now - 8 * 60 * MIN);
  })();
  console.log("Seeded demo medicines, alerts and activity.");
}

/** Two sample family members (no photos) so the People page isn't empty for the demo account. */
export function seedDemoPeople(userId) {
  if (db.prepare("SELECT COUNT(*) AS c FROM people WHERE user_id = ?").get(userId).c > 0) return;
  const add = db.prepare("INSERT INTO people (user_id, name, relationship, notes, created_at) VALUES (?, ?, ?, ?, ?)");
  const now = Date.now();
  add.run(userId, "Arjun", "son", "Visits every Sunday.", now);
  add.run(userId, "Meera", "daughter", "Calls in the evening.", now);
}
