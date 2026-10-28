import PatientMap from "../../components/dashboard/PatientMap.jsx";
import Timeline from "../../components/dashboard/Timeline.jsx";
import { useData } from "../../context/DataContext.jsx";
import { timeAgo } from "../../utils/format.js";

export default function Location() {
  const { patient, pos, trail, outside, battery, home, radius, distance, lastUpdate, deviceConnected,
    activity, mode, startWander, returnHome, triggerSOS } = useData();

  return (
    <>
      <div className="page-h">
        <h1>Location and activity</h1>
        <p>Where {patient.name} is right now, and where they have been today.</p>
      </div>

      <div className="cols">
        <section className="panel span-8">
          <h2>Live map <span className={outside ? "bad" : "good"}>{outside ? "Outside safe zone" : "Inside safe zone"}</span></h2>
          <PatientMap pos={pos} trail={trail} outside={outside} patientName={patient.name} home={home} radius={radius} />
          <dl className="facts">
            <div><dt>Distance from home</dt><dd>{distance} m</dd></div>
            <div><dt>Safe zone radius</dt><dd>{radius} m</dd></div>
            <div><dt>Last reading</dt><dd>{lastUpdate ? timeAgo(lastUpdate) : "No readings yet"}</dd></div>
            <div><dt>Coordinates</dt><dd>{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</dd></div>
            <div><dt>Badge battery</dt><dd>{battery == null ? "—" : `${battery}%`}</dd></div>
            <div><dt>Badge</dt><dd className={deviceConnected ? "good" : "muted"}>{deviceConnected ? "Connected" : "Not connected"}</dd></div>
          </dl>
        </section>

        <div className="span-4 stack">
          <section className="panel">
            <h2>Demo controls {mode !== "idle" && <span className="muted">Simulating</span>}</h2>
            <p className="note top0">Simulates a badge while the hardware isn’t connected. Readings go through the same server checks as the real badge.</p>
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
