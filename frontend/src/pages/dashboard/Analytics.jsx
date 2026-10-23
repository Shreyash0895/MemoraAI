import StatCard from "../../components/dashboard/StatCard.jsx";
import { BarChart, LineChart } from "../../components/dashboard/Charts.jsx";
import { useData } from "../../context/DataContext.jsx";
import { ALERT_TYPES, WEEK, weekly } from "../../services/dashboardService.js";

const series = (arr) => arr.map((value, i) => ({ label: WEEK[i], value }));
const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

export default function Analytics() {
  const { patient, alerts } = useData();
  const counts = Object.keys(ALERT_TYPES).map((t) => ({ type: t, n: alerts.filter((a) => a.type === t).length }));
  const maxN = Math.max(...counts.map((c) => c.n), 1);

  return (
    <>
      <div className="page-h">
        <h1>Analytics</h1>
        <p>How {patient.name}’s week looked. Weekly figures are sample data; alert counts are live.</p>
      </div>

      <div className="grid-stats">
        <StatCard label="Medicine adherence" value={`${avg(weekly.adherence)}%`} hint="7-day average" tone={avg(weekly.adherence) < 80 ? "warn" : "good"} />
        <StatCard label="Faces recognized" value={avg(weekly.faces)} hint="Average per day" />
        <StatCard label="Time outside safe zone" value={`${weekly.minutesOutside.reduce((a, b) => a + b, 0)} min`} hint="This week" />
        <StatCard label="Alerts raised" value={alerts.length} hint="All time in this session" />
      </div>

      <div className="cols">
        <section className="panel span-6">
          <h2>Medicine adherence</h2>
          <BarChart data={series(weekly.adherence)} max={100} unit="%" label="Medicine adherence by day" />
        </section>
        <section className="panel span-6">
          <h2>Familiar faces recognized</h2>
          <BarChart data={series(weekly.faces)} label="Faces recognized by day" />
        </section>
        <section className="panel span-6">
          <h2>Minutes outside the safe zone</h2>
          <LineChart data={series(weekly.minutesOutside)} unit="" label="Minutes outside the safe zone by day" />
        </section>
        <section className="panel span-6">
          <h2>Alerts by type</h2>
          <ul className="hbars">
            {counts.map((c) => (
              <li key={c.type}>
                <span>{ALERT_TYPES[c.type]}</span>
                <div className="bar"><i style={{ width: `${(c.n / maxN) * 100}%` }} /></div>
                <strong>{c.n}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
