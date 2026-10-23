import { ALERT_TYPES } from "../../services/dashboardService.js";
import { timeAgo } from "../../utils/format.js";
import { useData } from "../../context/DataContext.jsx";

export default function AlertItem({ alert, compact }) {
  const { setAlertStatus } = useData();
  return (
    <li className={`alert-item ${alert.severity} ${alert.status}`}>
      <div className="alert-main">
        <div className="alert-head">
          <span className={`sev ${alert.severity}`}>{alert.severity[0].toUpperCase() + alert.severity.slice(1)}</span>
          <strong>{alert.title}</strong>
        </div>
        <p>{alert.detail}</p>
        <small>{ALERT_TYPES[alert.type]} · {timeAgo(alert.at)}{alert.status === "acknowledged" ? " · Acknowledged" : ""}{alert.status === "resolved" ? " · Resolved" : ""}</small>
      </div>
      {!compact && alert.status !== "resolved" && (
        <div className="alert-actions">
          {alert.status === "new" && <button className="dbtn" onClick={() => setAlertStatus(alert.id, "acknowledged")}>Acknowledge</button>}
          <button className="dbtn primary" onClick={() => setAlertStatus(alert.id, "resolved")}>Mark resolved</button>
        </div>
      )}
    </li>
  );
}
