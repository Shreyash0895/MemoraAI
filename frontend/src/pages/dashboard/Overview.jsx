import { Link } from "react-router-dom";
import StatCard from "../../components/dashboard/StatCard.jsx";
import PatientMap from "../../components/dashboard/PatientMap.jsx";
import AlertItem from "../../components/dashboard/AlertItem.jsx";
import Timeline from "../../components/dashboard/Timeline.jsx";
import { useState } from "react";
import { useData } from "../../context/DataContext.jsx";
import { timeAgo, todayAt } from "../../utils/format.js";

const WHO = { patient: "Started by the patient", badge: "Asked the badge" };
const HOW = { calmer: "felt calmer", same: "felt about the same", worse: "still worried", null: "closed without answering" };

function ComfortPanel() {
  const { patient, calm, offerCalm } = useData();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function offer() {
    setBusy(true); setMsg("");
    try {
      const r = await offerCalm();
      setMsg(r.delivered
        ? `A gentle offer is now on ${patient.name}’s screen. They can say no.`
        : "No patient screen is connected yet, so nobody will see it. Connect one in Settings.");
    } catch { /* the error toast explains */ }
    setBusy(false);
  }

  return (
    <section className="panel span-12">
      <h2>Comfort</h2>
      {!calm.enabled ? (
        <p className="empty">Calming exercises are switched off. Turn on “I feel worried” in Settings to use them.</p>
      ) : (
        <div className="cols nested">
          <div className="span-5">
            <p className="note top0">If {patient.name} seems anxious or confused and you can’t be there, offer a calming exercise on their screen. It shows a slow breathing guide, and they can say no.</p>
            <button className="dbtn primary" onClick={offer} disabled={busy || calm.offerActive}>{calm.offerActive ? "Offer sent" : "Offer a calming exercise"}</button>
            {msg && <p className="note" role="status">{msg}</p>}
          </div>
          <div className="span-7">
            {calm.recent.length === 0 ? <p className="empty">No calming exercises yet.</p> : (
              <ul className="mini-list">
                {calm.recent.map((c) => (
                  <li key={c.id}>
                    <div><strong>{WHO[c.trigger] ?? "Calming exercise"}</strong><small>{timeAgo(c.startedAt)}</small></div>
                    <span className={`pill-status ${c.outcome === "worse" ? "overdue" : c.outcome === "calmer" ? "taken" : "pending"}`}>{HOW[c.outcome]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

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
        <ComfortPanel />
      </div>
    </>
  );
}
