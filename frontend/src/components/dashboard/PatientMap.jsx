import { GEOFENCE_M, toMeters } from "../../services/dashboardService.js";


const SCALE = 0.8; // px per metre
const toPx = (p) => {
  const { dx, dy } = toMeters(p);
  return {
    x: Math.min(390, Math.max(10, 200 + dx * SCALE)),
    y: Math.min(290, Math.max(10, 150 - dy * SCALE)),
  };
};

export default function PatientMap({ pos, trail, outside, patientName }) {
  const here = toPx(pos);
  const line = trail.map((p) => { const q = toPx(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" ");
  return (
    <svg className="map" viewBox="0 0 400 300" role="img"
      aria-label={`${patientName} is ${outside ? "outside" : "inside"} the ${GEOFENCE_M} metre safe zone around home`}>
      <rect className="map-bg" width="400" height="300" />
      <g className="map-roads">
        <path d="M0 210 C120 200 220 240 400 215" />
        <path d="M90 0 C100 90 70 190 110 300" />
        <path d="M290 0 C280 100 330 170 300 300" />
        <path d="M0 80 L400 105" />
      </g>
      <circle className={`geo ${outside ? "out" : ""}`} cx="200" cy="150" r={GEOFENCE_M * SCALE} />
      <text className="map-txt" x="200" y="26" textAnchor="middle">Safe zone, {GEOFENCE_M} m</text>
      <g className="home" transform="translate(200 150)">
        <circle r="13" />
        <path d="M-6 1 L0 -6 L6 1 M-4 0 V6 H4 V0" />
      </g>
      <polyline className="trail" points={line} />
      <circle className={`me-ring ${outside ? "out" : ""}`} cx={here.x} cy={here.y} r="12" />
      <circle className={`me ${outside ? "out" : ""}`} cx={here.x} cy={here.y} r="7" />
    </svg>
  );
}
