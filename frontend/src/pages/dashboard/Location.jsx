import PatientMap from "../../components/dashboard/PatientMap.jsx";
import Timeline from "../../components/dashboard/Timeline.jsx";
import { useData } from "../../context/DataContext.jsx";
import { distanceFromHome, GEOFENCE_M } from "../../services/dashboardService.js";
import { timeAgo } from "../../utils/format.js";

export default function Location() {
  const { patient, pos, trail, outside, battery, lastUpdate, activity, mode, startWander, returnHome, triggerSOS } = useData();
  const dist = Math.round(distanceFromHome(pos));

  return (
    <>
      <div className="page-h">
        <h1>Location and activity</h1>
        <p>Where {patient.name} is right now, and where they have been today.</p>
      </div>

      <div className="cols">
        <section className="panel span-8">
          <h2>Live map <span className={outside ? "bad" : "good"}>{outside ? "Outside safe zone" : "Inside safe zone"}</span></h2>
          <PatientMap pos={pos} trail={trail} outside={outside} patientName={patient.name} />
          <dl className="facts">
            <div><dt>Distance from home</dt><dd>{dist} m</dd></div>
            <div><dt>Safe zone radius</dt><dd>{GEOFENCE_M} m</dd></div>
            <div><dt>Last update</dt><dd>{timeAgo(lastUpdate)}</dd></div>
            <div><dt>Coordinates</dt><dd>{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</dd></div>
            <div><dt>Badge battery</dt><dd>{battery}%</dd></div>
          </dl>
        </section>

        <div className="span-4 stack">
          <section className="panel">
            <h2>Demo controls</h2>
            <p className="note top0">For presentations. These simulate the badge until the hardware is connected.</p>
            <div className="stack-btns">
              <button className="dbtn" onClick={startWander} disabled={mode === "wander"}>Simulate wandering</button>
              <button className="dbtn" onClick={returnHome} disabled={!outside && mode !== "wander"}>Bring patient home</button>
              <button className="dbtn danger" onClick={triggerSOS}>Simulate SOS press</button>
            </div>
          </section>
          <section className="panel">
            <h2>Today’s activity</h2>
            <Timeline items={activity.slice(0, 8)} />
          </section>
        </div>
      </div>
    </>
  );
}
