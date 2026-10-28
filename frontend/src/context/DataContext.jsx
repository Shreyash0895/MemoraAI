import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { api } from "../services/api.js";
import { distanceFromHome, fromMeters, toMeters } from "../services/dashboardService.js";

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

const POLL_MS = 4000;
const CONNECTED_MS = 2 * 60 * 1000; // badge counts as connected if it reported in the last 2 minutes
const sameDay = (ms) => ms != null && new Date(ms).toDateString() === new Date().toDateString();

/*
 * All data lives in SQLite on the server. The geofence, battery, SOS and
 * missed-medicine rules run there too. This context loads the data, refreshes
 * it every few seconds, and shows a toast when a new alert appears.
 */
export function DataProvider({ children }) {
  const { user, logout } = useAuth();
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  const [snap, setSnap] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState(null);
  const [mode, setMode] = useState("idle"); // demo simulator: idle | wander | return

  const snapRef = useRef(null);
  const seenAlert = useRef(null);
  const tzSynced = useRef(false);
  const simM = useRef({ dx: 0, dy: 0 });

  const fail = useCallback((e) => {
    setToast({ id: `err${Date.now()}`, kind: "error", severity: "low", title: "Couldn’t save that", detail: e?.message || "Check your connection and try again." });
  }, []);

  const apply = useCallback((d) => {
    const maxId = d.alerts.reduce((m, a) => Math.max(m, a.id), 0);
    if (seenAlert.current !== null && maxId > seenAlert.current) {
      const fresh = d.alerts.find((a) => a.id > seenAlert.current && a.status === "new");
      if (fresh) setToast(fresh);
    }
    seenAlert.current = Math.max(seenAlert.current ?? 0, maxId);

    snapRef.current = d;
    setSnap(d);

    // keep the server's time zone in step with the caregiver's browser (used for medicine times)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tzSynced.current && tz && d.settings.timezone !== tz) {
      tzSynced.current = true;
      api.put("/settings/timezone", { timezone: tz }).catch(() => {});
    }
  }, []);

  const refresh = useCallback(() => api.get("/dashboard").then(apply), [apply]);

  const load = useCallback(() => {
    setLoadError("");
    refresh().catch((e) => {
      if (e.status === 401) logoutRef.current();
      else setLoadError(e.message || "Something went wrong.");
    });
  }, [refresh]);
  useEffect(() => { load(); }, [load]);

  const ready = snap !== null;
  useEffect(() => {
    if (!ready) return undefined;
    const t = setInterval(() => {
      refresh().catch((e) => { if (e.status === 401) logoutRef.current(); });
    }, POLL_MS);
    return () => clearInterval(t);
  }, [ready, refresh]);

  // Demo simulator: sends readings through the same server checks as the real badge.
  useEffect(() => {
    if (mode === "idle") return undefined;
    const t = setInterval(async () => {
      const s = snapRef.current;
      if (!s) return;
      const home = { lat: s.settings.homeLat, lng: s.settings.homeLng };
      let { dx, dy } = simM.current;
      const d = Math.hypot(dx, dy) || 1;

      if (mode === "wander") {
        if (d < 500) { dx += (dx / d) * 18 + (Math.random() - 0.5) * 4; dy += (dy / d) * 18 + (Math.random() - 0.5) * 4; }
      } else {
        const step = Math.min(24, d);
        dx -= (dx / d) * step;
        dy -= (dy / d) * step;
      }
      simM.current = { dx, dy };

      try {
        const np = fromMeters(dx, dy, home);
        await api.post("/demo/telemetry", { lat: np.lat, lng: np.lng });
        await refresh();
      } catch (e) { fail(e); setMode("idle"); return; }
      if (mode === "return" && Math.hypot(dx, dy) < 45) setMode("idle");
    }, 3000);
    return () => clearInterval(t);
  }, [mode, refresh, fail]);

  if (loadError) {
    return (
      <div className="boot">
        <div className="panel boot-card" role="alert">
          <h2>Couldn’t load the dashboard</h2>
          <p>{loadError}</p>
          <button className="dbtn primary" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }
  if (!ready) return <div className="boot" role="status" aria-label="Loading"><span className="spin" /></div>;

  // ---- derived values ----
  const home = { lat: snap.settings.homeLat, lng: snap.settings.homeLng };
  const radius = snap.settings.radiusM;
  const last = snap.locations[snap.locations.length - 1];
  const pos = last ? { lat: last.lat, lng: last.lng } : home;
  const trail = snap.locations.map(({ lat, lng }) => ({ lat, lng }));
  // Runs an API call, refreshes the data, and shows a toast on failure.
  // Pass rethrow=true when the caller needs to know it failed (forms).
  const mutate = (fn, rethrow = false) => async (...args) => {
    try { const r = await fn(...args); await refresh(); return r; }
    catch (e) { fail(e); if (rethrow) throw e; return undefined; }
  };
  const startAt = () => {
    simM.current = toMeters(pos, home);
    if (Math.hypot(simM.current.dx, simM.current.dy) < 1) {
      const a = Math.random() * 2 * Math.PI;
      simM.current = { dx: Math.cos(a) * 5, dy: Math.sin(a) * 5 };
    }
  };

  const value = {
    patient: { name: user?.patient || "Patient" },
    home, radius, pos, trail,
    distance: Math.round(distanceFromHome(pos, home)),
    outside: snap.outside,
    lastUpdate: last ? last.at : null,
    battery: snap.device.battery,
    settings: snap.settings,
    device: snap.device,
    deviceConnected: snap.device.lastSeen != null && Date.now() - snap.device.lastSeen < CONNECTED_MS,
    alerts: snap.alerts,
    activity: snap.activity,
    // a medicine counts as taken if it was marked taken today
    medicines: snap.medicines.map((m) => ({ ...m, status: sameDay(m.takenAt) ? "taken" : "pending" })),
    openAlerts: snap.alerts.filter((a) => a.status !== "resolved").length,
    toast, mode,
    dismissToast: () => setToast(null),

    setAlertStatus: mutate((id, status) => api.patch(`/alerts/${id}`, { status })),
    markTaken: mutate((id) => api.post(`/medicines/${id}/taken`)),
    addMedicine: mutate((med) => api.post("/medicines", med), true),
    removeMedicine: mutate((id) => api.delete(`/medicines/${id}`)),
    saveSettings: mutate((values) => api.put("/settings", values), true),
    generateKey: mutate(() => api.post("/device/key").then((r) => r.key), true),

    // Demo controls (simulate a badge while the hardware isn't connected)
    startWander: () => { startAt(); setMode("wander"); },
    returnHome: () => { startAt(); setMode("return"); },
    triggerSOS: mutate(() => api.post("/demo/sos")),
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
