import { Link } from "react-router-dom";
import StatCard from "../../components/dashboard/StatCard.jsx";
import PatientMap from "../../components/dashboard/PatientMap.jsx";
import AlertItem from "../../components/dashboard/AlertItem.jsx";
import Timeline from "../../components/dashboard/Timeline.jsx";
import { useData } from "../../context/DataContext.jsx";
import { timeAgo, todayAt } from "../../utils/format.js";

export default function Overview() {
  const { patient, pos, trail, outside, battery, home, radius, distance, deviceConnected, alerts, openAlerts, medicines, activity, lastRecognition } = useData();
  const taken = medicines.filter((m) => m.status === "taken").length;
  const open = alerts.filter((a) => a.status !== "resolved").slice(0, 3);
  const dist = distance;

  return (
    <>
      <div className="page-h">
        <h1>Good day, here’s how {patient.name} is doing</h1>
        <p>{deviceConnected ? "Live status from the MemoraAI badge." : "No badge connected yet. Add one in Settings, or try the demo controls on the Location page."}</p>
      </div>

      <div className="grid-stats">
        <StatCard label="Safety" value={outside ? "Outside" : "Safe"} tone={outside ? "bad" : "good"} hint={`${dist} m from home`} />
        <StatCard label="Open alerts" value={openAlerts} tone={openAlerts ? "warn" : "good"} hint={openAlerts ? "Need your attention" : "All clear"} />
        <StatCard label="Medicines today" value={`${taken} of ${medicines.length}`} hint="Taken so far" />
        <StatCard label="Last recognized" value={lastRecognition ? lastRecognition.name : "—"} hint={lastRecognition ? `${lastRecognition.relationship} · ${timeAgo(lastRecognition.at)}` : "No one yet"} />
        <StatCard label="Badge battery" value={battery == null ? "—" : `${battery}%`} tone={battery != null && battery < 20 ? "bad" : ""} hint={battery == null ? "No reading yet" : "From the badge"} />
      </div>

      <div className="cols">
        <section className="panel span-7">
          <h2>Live location <Link to="/dashboard/location">Open map</Link></h2>
          <PatientMap pos={pos} trail={trail} outside={outside} patientName={patient.name} home={home} radius={radius} />
        </section>
        <section className="panel span-5">
          <h2>Needs attention <Link to="/dashboard/alerts">All alerts</Link></h2>
          {open.length ? <ul className="alert-list">{open.map((a) => <AlertItem key={a.id} alert={a} compact />)}</ul>
            : <p className="empty">No open alerts. You’ll see SOS presses, safe-zone exits and missed medicines here.</p>}
        </section>
        <section className="panel span-6">
          <h2>Today’s medicines <Link to="/dashboard/medicines">Manage</Link></h2>
          {medicines.length === 0 && <p className="empty">No medicines scheduled yet. Add them on the Medicines page.</p>}
          <ul className="mini-list">
            {medicines.map((m) => (
              <li key={m.id}>
                <div><strong>{m.name}</strong><small>{m.dose}</small></div>
                <span className={`pill-status ${m.status}`}>{m.status === "taken" ? "Taken" : `Due ${new Date(todayAt(m.time)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel span-6">
          <h2>Recent activity</h2>
          <Timeline items={activity.slice(0, 5)} />
        </section>
      </div>
    </>
  );
}
