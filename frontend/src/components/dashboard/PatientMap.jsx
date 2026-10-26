import { toMeters } from "../../services/dashboardService.js";

/*
 * Schematic live map. The safe-zone circle is always drawn 120 px in radius,
 * so the scale adapts to the radius the caregiver chose (px per metre = 120 / radius).
 * Phase option: swap for Google Maps or Leaflet using the same props.
 */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function PatientMap({ pos, trail, outside, patientName, home, radius }) {
  const scale = 120 / radius;
  const toPx = (p) => {
    const { dx, dy } = toMeters(p, home);
    return { x: clamp(200 + dx * scale, 10, 390), y: clamp(150 - dy * scale, 10, 290) };
  };
  const here = toPx(pos);
  const line = trail.map((p) => { const q = toPx(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" ");

  return (
    <svg className="map" viewBox="0 0 400 300" role="img"
      aria-label={`${patientName} is ${outside ? "outside" : "inside"} the ${radius} metre safe zone around home`}>
      <rect className="map-bg" width="400" height="300" />
      <g className="map-roads">
        <path d="M0 210 C120 200 220 240 400 215" />
        <path d="M90 0 C100 90 70 190 110 300" />
        <path d="M290 0 C280 100 330 170 300 300" />
        <path d="M0 80 L400 105" />
      </g>
      <circle className={`geo ${outside ? "out" : ""}`} cx="200" cy="150" r="120" />
      <text className="map-txt" x="200" y="26" textAnchor="middle">Safe zone, {radius} m</text>
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
