import { useEffect, useRef, useState } from "react";
import { toMeters } from "../../services/dashboardService.js";
import { AUTH_FAILURE_EVENT, authFailed, loadGoogleMaps } from "../../utils/googleMaps.js";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
// Advanced markers need a map ID. DEMO_MAP_ID is Google's ID for development.
// Later you can create your own in Google Cloud and put it in frontend/.env as VITE_GOOGLE_MAP_ID.
const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || "DEMO_MAP_ID";

const TEAL = "#1B7B8A", RED = "#B3261E", VIOLET = "#6D5BE0";
const AUTH_MSG = "Google Maps rejected the API key. Check that billing is on, the Maps JavaScript API is enabled, and this website address is allowed for the key. Showing the simple map instead.";
const LOAD_MSG = "Google Maps couldn’t be loaded. Check your internet connection. Showing the simple map instead.";

export default function PatientMap(props) {
  const [problem, setProblem] = useState(authFailed() ? AUTH_MSG : "");
  if (!API_KEY) return <Schematic {...props} note="Showing a simple map. Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env to use Google Maps." />;
  if (problem) return <Schematic {...props} note={problem} />;
  return <GoogleMap {...props} onFail={setProblem} />;
}

/* ---------------- Google Maps ---------------- */

const homeEl = () => {
  const d = document.createElement("div");
  d.textContent = "🏠";
  d.style.cssText = "font-size:26px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))";
  return d;
};
const meEl = (color) => {
  const d = document.createElement("div");
  d.style.cssText =
    `width:22px;height:22px;border-radius:50%;background:${color};border:3px solid #fff;` +
    `box-shadow:0 0 0 2px ${color}66,0 2px 6px rgba(0,0,0,.4);transform:translateY(50%)`;
  return d;
};

function GoogleMap({ pos, trail, outside, patientName, home, radius, height = 380, onFail }) {
  const box = useRef(null);
  const g = useRef(null); // the Google objects: map, circle, trail line and the two markers
  const [ready, setReady] = useState(false);

  // 1) Load the API and create the map once
  useEffect(() => {
    let cancelled = false;
    const onAuth = () => onFail(AUTH_MSG);
    window.addEventListener(AUTH_FAILURE_EVENT, onAuth);

    loadGoogleMaps(API_KEY)
      .then(({ maps, AdvancedMarkerElement }) => {
        if (cancelled || !box.current) return;
        const map = new maps.Map(box.current, {
          center: { lat: home.lat, lng: home.lng },
          zoom: 16,
          maxZoom: 19,
          mapId: MAP_ID,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: "cooperative",
        });
        g.current = { maps, AdvancedMarkerElement, map, circle: null, line: null, homeMarker: null, meMarker: null, fittedFor: "", lastOutside: null };
        setReady(true);
      })
      .catch(() => { if (!cancelled) onFail(LOAD_MSG); });

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_FAILURE_EVENT, onAuth);
      const o = g.current;
      if (o) {
        o.circle?.setMap(null);
        o.line?.setMap(null);
        if (o.homeMarker) o.homeMarker.map = null;
        if (o.meMarker) o.meMarker.map = null;
      }
      g.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Draw and update: safe zone circle, trail, home and the patient
  useEffect(() => {
    const o = g.current;
    if (!ready || !o) return;
    const { maps, map } = o;
    const center = { lat: home.lat, lng: home.lng };
    const me = { lat: pos.lat, lng: pos.lng };
    const color = outside ? RED : TEAL;

    if (!o.circle) {
      o.circle = new maps.Circle({ map, center, radius, clickable: false, strokeWeight: 2, strokeOpacity: 0.9, fillOpacity: 0.12 });
      o.line = new maps.Polyline({ map, strokeColor: VIOLET, strokeOpacity: 0.85, strokeWeight: 4, clickable: false });
      o.homeMarker = new o.AdvancedMarkerElement({ map, position: center, title: "Home", content: homeEl() });
      o.meMarker = new o.AdvancedMarkerElement({ map, position: me, title: `${patientName}’s current position`, content: meEl(color) });
      o.lastOutside = outside;
    }

    o.circle.setOptions({ center, radius, strokeColor: color, fillColor: color });
    o.line.setPath(trail.map((p) => ({ lat: p.lat, lng: p.lng })));
    o.homeMarker.position = center;
    o.meMarker.position = me;
    if (o.lastOutside !== outside) { o.meMarker.content = meEl(color); o.lastOutside = outside; }

    // Framing: fit the safe zone when first shown or when it changes. After that, only zoom out if the patient leaves the view.
    const cb = o.circle.getBounds();
    if (!cb) return;
    const bounds = new maps.LatLngBounds(cb.getSouthWest(), cb.getNorthEast());
    bounds.extend(me);
    const key = `${home.lat},${home.lng},${radius}`;
    if (o.fittedFor !== key) {
      map.fitBounds(bounds, 40);
      o.fittedFor = key;
    } else {
      const view = map.getBounds();
      if (view && !view.contains(me)) map.fitBounds(bounds, 40);
    }
  }, [ready, pos.lat, pos.lng, trail, outside, home.lat, home.lng, radius, patientName]);

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <div
        ref={box}
        role="region"
        aria-label={`Map: ${patientName} is ${outside ? "outside" : "inside"} the ${radius} metre safe zone around home`}
        style={{ width: "100%", height: "100%", borderRadius: 12, overflow: "hidden", background: "var(--map-bg)" }}
      />
      {!ready && <p className="hint" style={{ position: "absolute", top: 12, left: 16, margin: 0 }} role="status">Loading map…</p>}
    </div>
  );
}

/* ---------------- Simple map (used when there is no key, or Google can't load) ---------------- */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function Schematic({ pos, trail, outside, patientName, home, radius, note }) {
  const scale = 120 / radius; // the safe zone is always drawn 120 px wide
  const toPx = (p) => {
    const { dx, dy } = toMeters(p, home);
    return { x: clamp(200 + dx * scale, 10, 390), y: clamp(150 - dy * scale, 10, 290) };
  };
  const here = toPx(pos);
  const line = trail.map((p) => { const q = toPx(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" ");

  return (
    <>
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
      {note && <p className="hint" role="status">{note}</p>}
    </>
  );
}