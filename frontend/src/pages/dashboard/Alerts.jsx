import { useState } from "react";
import AlertItem from "../../components/dashboard/AlertItem.jsx";
import { useData } from "../../context/DataContext.jsx";
import { SEVERITIES } from "../../services/dashboardService.js";

export default function Alerts() {
  const { alerts, openAlerts } = useData();
  const [status, setStatus] = useState("open");
  const [severity, setSeverity] = useState("all");

  const shown = alerts.filter((a) =>
    (status === "all" || (status === "open" ? a.status !== "resolved" : a.status === "resolved")) &&
    (severity === "all" || a.severity === severity));

  return (
    <>
      <div className="page-h">
        <h1>Alerts</h1>
        <p>{openAlerts ? `${openAlerts} open ${openAlerts === 1 ? "alert needs" : "alerts need"} your attention.` : "Nothing needs your attention right now."}</p>
      </div>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Filter by status">
          {["open", "resolved", "all"].map((s) => (
            <button key={s} className={status === s ? "on" : ""} aria-pressed={status === s} onClick={() => setStatus(s)}>
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <label className="sel">Severity
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="all">All</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </label>
      </div>

      <section className="panel">
        {shown.length
          ? <ul className="alert-list">{shown.map((a) => <AlertItem key={a.id} alert={a} />)}</ul>
          : <p className="empty">No alerts match these filters. Try “All” to see every alert.</p>}
      </section>
    </>
  );
}
