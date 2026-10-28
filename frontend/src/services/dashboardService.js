/*
 * Shared constants and geofence maths for the dashboard.
 * The geofence check itself runs on the server (server/src/core.js); this
 * file only converts coordinates so the map can draw them.
 */

// Home position and radius come from the caregiver's settings (stored in SQLite).
const M_PER_DEG = 111320;
const cosLat = (home) => Math.cos((home.lat * Math.PI) / 180);

/** Metres east (dx) and north (dy) of home. */
export const toMeters = (p, home) => ({
  dx: (p.lng - home.lng) * M_PER_DEG * cosLat(home),
  dy: (p.lat - home.lat) * M_PER_DEG,
});
export const fromMeters = (dx, dy, home) => ({
  lat: home.lat + dy / M_PER_DEG,
  lng: home.lng + dx / (M_PER_DEG * cosLat(home)),
});
export const distanceFromHome = (p, home) => {
  const { dx, dy } = toMeters(p, home);
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
