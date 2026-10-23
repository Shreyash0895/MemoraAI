import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import {
  GEOFENCE_M, fromMeters, toMeters, initialData, uid,
} from "../services/dashboardService.js";

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const init = useRef(initialData(user?.patient)).current;

  const [alerts, setAlerts] = useState(init.alerts);
  const [medicines, setMedicines] = useState(init.medicines);
  const [activity, setActivity] = useState(init.activity);
  const [pos, setPos] = useState(init.position);
  const [trail, setTrail] = useState(init.trail);
  const [battery] = useState(init.battery);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [outside, setOutside] = useState(false);
  const [mode, setModeState] = useState("idle"); // idle | wander | return
  const [toast, setToast] = useState(null);

  const modeRef = useRef("idle");
  const meters = useRef(toMeters(init.position));
  const outsideRef = useRef(false);

  const setMode = (m) => { modeRef.current = m; setModeState(m); };

  const addActivity = useCallback((text, kind = "move") => {
    setActivity((a) => [{ id: uid(), at: Date.now(), kind, text }, ...a].slice(0, 40));
  }, []);

  const raise = useCallback((type, severity, title, detail) => {
    const alert = { id: uid(), type, severity, title, detail, at: Date.now(), status: "new" };
    setAlerts((l) => [alert, ...l]);
    setToast(alert);
  }, []);

  // Simulated live GPS feed (every 3 s).
  useEffect(() => {
    const timer = setInterval(() => {
      let { dx, dy } = meters.current;
      const d = Math.hypot(dx, dy) || 1;
      const m = modeRef.current;

      if (m === "wander") {
        dx += (dx / d) * 18 + (Math.random() - 0.5) * 4;
        dy += (dy / d) * 18 + (Math.random() - 0.5) * 4;
      } else if (m === "return") {
        const step = Math.min(24, d);
        dx -= (dx / d) * step;
        dy -= (dy / d) * step;
        if (d < 45) { modeRef.current = "idle"; setModeState("idle"); }
      } else {
        dx += (Math.random() - 0.5) * 6;
        dy += (Math.random() - 0.5) * 6;
        const nd = Math.hypot(dx, dy);
        if (nd > 70) { dx *= 70 / nd; dy *= 70 / nd; }
      }

      meters.current = { dx, dy };
      const np = fromMeters(dx, dy);
      setPos(np);
      setTrail((t) => [...t, np].slice(-60));
      setLastUpdate(Date.now());

      const dist = Math.hypot(dx, dy);
      if (dist > GEOFENCE_M && !outsideRef.current) {
        outsideRef.current = true;
        setOutside(true);
        raise("geofence", "high", "Left safe zone", `Patient is ${Math.round(dist)} m from home.`);
        addActivity("Left the safe zone", "warn");
      } else if (dist < GEOFENCE_M - 20 && outsideRef.current) {
        outsideRef.current = false;
        setOutside(false);
        addActivity("Back inside the safe zone", "ok");
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [raise, addActivity]);

  const value = {
    patient: init.patient, pos, trail, battery, lastUpdate, outside, mode,
    alerts, medicines, activity, toast,
    openAlerts: alerts.filter((a) => a.status !== "resolved").length,
    dismissToast: () => setToast(null),

    setAlertStatus: (id, status) =>
      setAlerts((l) => l.map((a) => (a.id === id ? { ...a, status } : a))),

    markTaken(id) {
      const med = medicines.find((m) => m.id === id);
      setMedicines((l) => l.map((m) => (m.id === id ? { ...m, status: "taken", takenAt: Date.now() } : m)));
      if (med) addActivity(`Medicine taken: ${med.name} (marked by caregiver)`, "ok");
    },
    addMedicine(med) {
      setMedicines((l) => [...l, { ...med, id: uid(), status: "pending" }].sort((a, b) => a.time.localeCompare(b.time)));
    },
    removeMedicine: (id) => setMedicines((l) => l.filter((m) => m.id !== id)),

    // Demo controls for presentations
    startWander: () => { addActivity("Patient started moving away from home", "move"); setMode("wander"); },
    returnHome: () => { addActivity("Patient is heading back home", "move"); setMode("return"); },
    triggerSOS: () => {
      raise("sos", "critical", "SOS button pressed", "The patient pressed the emergency button on the badge.");
      addActivity("SOS button pressed", "warn");
    },
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
