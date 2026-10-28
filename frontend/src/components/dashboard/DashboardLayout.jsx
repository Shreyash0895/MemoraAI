import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useData } from "../../context/DataContext.jsx";
import { GridIcon, BellIcon, PillIcon, PinIcon, ChartIcon, LogoutIcon, BatteryIcon, GearIcon, UsersIcon } from "../Icons.jsx";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: <GridIcon />, end: true },
  { to: "/dashboard/alerts", label: "Alerts", icon: <BellIcon />, badge: true },
  { to: "/dashboard/medicines", label: "Medicines", icon: <PillIcon /> },
  { to: "/dashboard/people", label: "People", icon: <UsersIcon /> },
  { to: "/dashboard/location", label: "Location", icon: <PinIcon /> },
  { to: "/dashboard/analytics", label: "Analytics", icon: <ChartIcon /> },
  { to: "/dashboard/settings", label: "Settings", icon: <GearIcon /> },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { patient, outside, battery, openAlerts, toast, dismissToast } = useData();
  const navigate = useNavigate();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 7000);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  return (
    <div className="dash">
      <aside className="side">
        <div className="logo side-logo">
          <span className="mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V6l8 8 8-8v13" /></svg>
          </span>
          <span>Memora<b>AI</b></span>
        </div>
        <nav className="nav" aria-label="Dashboard">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.icon}<span>{n.label}</span>
              {n.badge && openAlerts > 0 && <em className="nav-badge" aria-label={`${openAlerts} open alerts`}>{openAlerts}</em>}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="top">
          <div className="who">
            <span className="avatar" aria-hidden="true">{patient.name[0]}</span>
            <div>
              <strong>{patient.name}</strong>
              <small className={outside ? "bad" : "good"}>{outside ? "Outside safe zone" : "At home, inside safe zone"}</small>
            </div>
          </div>
          <div className="top-right">
            <span className="chip"><BatteryIcon />{battery == null ? "—" : `${battery}%`}</span>
            <span className="chip user">{user.name}</span>
            <button className="dbtn" onClick={async () => { await logout(); navigate("/login"); }}><LogoutIcon />Sign out</button>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>

      {toast && (
        <div className={`toast ${toast.severity}`} role="alert">
          <div><strong>{toast.title}</strong><p>{toast.detail}</p></div>
          <div className="toast-actions">
            {toast.kind !== "error" && <button className="dbtn primary" onClick={() => { dismissToast(); navigate("/dashboard/alerts"); }}>View alert</button>}
            <button className="dbtn" onClick={dismissToast}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}
