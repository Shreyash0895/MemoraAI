/*
 * Dashboard data layer (Phase 2, simulated).
 * Everything here is sample data. In Phase 3 replace initialData() with
 * Firestore reads and the live-position simulation in DataContext with
 * Firestore onSnapshot listeners fed by the ESP32 badge.
 */
const MIN = 60000;

// Placeholder home position (Pune). Replace with the patient's real home.
export const HOME = { lat: 18.5204, lng: 73.8567 };
export const GEOFENCE_M = 150;

const M_PER_DEG = 111320;
const cosLat = Math.cos((HOME.lat * Math.PI) / 180);
export const fromMeters = (dx, dy) => ({
  lat: HOME.lat + dy / M_PER_DEG,
  lng: HOME.lng + dx / (M_PER_DEG * cosLat),
});
export const toMeters = (p) => ({
  dx: (p.lng - HOME.lng) * M_PER_DEG * cosLat,
  dy: (p.lat - HOME.lat) * M_PER_DEG,
});
export const distanceFromHome = (p) => {
  const { dx, dy } = toMeters(p);
  return Math.hypot(dx, dy);
};

export const ALERT_TYPES = {
  sos: "SOS pressed",
  geofence: "Left safe zone",
  medicine: "Missed medicine",
  face: "Unknown person",
  battery: "Low battery",
};
export const SEVERITIES = ["critical", "high", "medium", "low"];

export const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const weekly = {
  adherence: [100, 100, 67, 100, 100, 67, 100],
  faces: [6, 9, 7, 11, 8, 5, 10],
  minutesOutside: [0, 0, 18, 0, 6, 32, 0],
};

let n = 100;
export const uid = () => `id${++n}`;

export function initialData(patientName) {
  const now = Date.now();
  const trailMeters = [[-30, -20], [-22, -8], [-10, 4], [4, 14], [18, 22], [30, 14], [34, 0], [24, -14], [10, -24]];
  return {
    patient: { name: patientName || "Patient", device: "MemoraAI badge" },
    position: fromMeters(10, -24),
    trail: trailMeters.map(([x, y]) => fromMeters(x, y)),
    battery: 78,
    alerts: [
      { id: "a1", type: "face", severity: "medium", title: "Unknown person detected", detail: "The badge camera saw a face that isn’t in the family database.", at: now - 40 * MIN, status: "new" },
      { id: "a2", type: "medicine", severity: "medium", title: "Missed medicine", detail: "Vitamin D3 at 8:00 pm was not marked as taken.", at: now - 19 * 60 * MIN, status: "acknowledged" },
      { id: "a3", type: "geofence", severity: "high", title: "Left safe zone", detail: "Patient was 182 m from home for 14 minutes.", at: now - 26 * 60 * MIN, status: "resolved" },
      { id: "a4", type: "battery", severity: "low", title: "Low battery", detail: "Badge battery dropped below 20%.", at: now - 30 * 60 * MIN, status: "resolved" },
    ],
    medicines: [
      { id: "m1", name: "Donepezil", dose: "5 mg", time: "08:00", status: "taken", takenAt: now - 6 * 60 * MIN },
      { id: "m2", name: "Memantine", dose: "10 mg", time: "13:00", status: "pending" },
      { id: "m3", name: "Vitamin D3", dose: "1 tablet", time: "20:00", status: "pending" },
    ],
    activity: [
      { id: "e1", at: now - 50 * MIN, kind: "face", text: "Recognized Arjun (son)" },
      { id: "e2", at: now - 6 * 60 * MIN, kind: "ok", text: "Medicine taken: Donepezil" },
      { id: "e3", at: now - 7 * 60 * MIN, kind: "ok", text: "Returned home from a walk" },
      { id: "e4", at: now - 8 * 60 * MIN, kind: "move", text: "Left home for a walk, inside the safe zone" },
    ],
  };
}
