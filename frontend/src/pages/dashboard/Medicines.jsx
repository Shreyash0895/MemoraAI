import { useState } from "react";
import { useData } from "../../context/DataContext.jsx";
import { todayAt } from "../../utils/format.js";

const fmt = (hhmm) => new Date(todayAt(hhmm)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const state = (m) => (m.status === "taken" ? "taken" : Date.now() > todayAt(m.time) + 30 * 60000 ? "overdue" : "upcoming");
const LABEL = { taken: "Taken", overdue: "Overdue", upcoming: "Upcoming" };

export default function Medicines() {
  const { patient, medicines, markTaken, addMedicine, removeMedicine } = useData();
  const [f, setF] = useState({ name: "", dose: "", time: "" });
  const [err, setErr] = useState({});
  const taken = medicines.filter((m) => m.status === "taken").length;
  const pct = medicines.length ? Math.round((taken / medicines.length) * 100) : 0;

  async function submit(e) {
    e.preventDefault();
    const x = {};
    if (!f.name.trim()) x.name = "Enter the medicine name.";
    if (!f.dose.trim()) x.dose = "Enter the dose, like 5 mg.";
    if (!f.time) x.time = "Choose a time.";
    setErr(x);
    if (Object.keys(x).length) return;
    try {
      await addMedicine({ name: f.name.trim(), dose: f.dose.trim(), time: f.time });
      setF({ name: "", dose: "", time: "" });
    } catch { /* the error toast explains what went wrong */ }
  }

  return (
    <>
      <div className="page-h">
        <h1>Medicines</h1>
        <p>{patient.name}’s reminders are spoken by the badge at each scheduled time.</p>
      </div>

      <div className="cols">
        <section className="panel span-8">
          <h2>Today’s schedule <span className="muted">{taken} of {medicines.length} taken</span></h2>
          <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label="Medicines taken today"><i style={{ width: `${pct}%` }} /></div>
          {medicines.length ? (
            <ul className="med-list">
              {medicines.map((m) => (
                <li key={m.id}>
                  <div className="med-time">{fmt(m.time)}</div>
                  <div className="med-main"><strong>{m.name}</strong><small>{m.dose}</small></div>
                  <span className={`pill-status ${state(m)}`}>{LABEL[state(m)]}</span>
                  <div className="med-actions">
                    {m.status !== "taken" && <button className="dbtn primary" onClick={() => markTaken(m.id)}>Mark taken</button>}
                    <button className="dbtn danger" onClick={() => removeMedicine(m.id)} aria-label={`Remove ${m.name}`}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="empty">No medicines scheduled. Add the first one using the form.</p>}
          <p className="note">Sample schedule for the prototype. Always follow the doctor’s prescription.</p>
        </section>

        <section className="panel span-4">
          <h2>Add a medicine</h2>
          <form onSubmit={submit} noValidate>
            <div className="field"><label htmlFor="mname">Medicine name</label>
              <input id="mname" type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-invalid={!!err.name} />
              {err.name && <p className="err" role="alert">{err.name}</p>}</div>
            <div className="field"><label htmlFor="mdose">Dose</label>
              <input id="mdose" type="text" value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} aria-invalid={!!err.dose} />
              {err.dose && <p className="err" role="alert">{err.dose}</p>}</div>
            <div className="field"><label htmlFor="mtime">Time</label>
              <input id="mtime" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} aria-invalid={!!err.time} />
              {err.time && <p className="err" role="alert">{err.time}</p>}</div>
            <button type="submit" className="dbtn primary wide">Add medicine</button>
          </form>
        </section>
      </div>
    </>
  );
}
