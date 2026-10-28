import { useState } from "react";
import { useData } from "../../context/DataContext.jsx";
import { timeAgo } from "../../utils/format.js";

export default function Settings() {
  const { settings, device, deviceConnected, saveSettings, generateKey } = useData();
  const [f, setF] = useState({ lat: String(settings.homeLat), lng: String(settings.homeLng), radius: String(settings.radiusM) });
  const [err, setErr] = useState({});
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);

  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setMsg(""); };

  function useMyLocation() {
    if (!navigator.geolocation) { setMsg("This browser can’t share its location. Type the coordinates instead."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setF((o) => ({ ...o, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })); setMsg("Location filled in. Press Save to apply it."); },
      () => setMsg("Couldn’t get your location. Allow location access, or type the coordinates."),
    );
  }

  async function submit(e) {
    e.preventDefault();
    const lat = Number(f.lat), lng = Number(f.lng), radius = Number(f.radius);
    const x = {};
    if (f.lat.trim() === "" || !Number.isFinite(lat) || Math.abs(lat) > 90) x.lat = "Enter a latitude between -90 and 90.";
    if (f.lng.trim() === "" || !Number.isFinite(lng) || Math.abs(lng) > 180) x.lng = "Enter a longitude between -180 and 180.";
    if (!Number.isInteger(radius) || radius < 50 || radius > 5000) x.radius = "Enter a whole number from 50 to 5000.";
    setErr(x);
    if (Object.keys(x).length) return;
    setSaving(true);
    try { await saveSettings({ homeLat: lat, homeLng: lng, radiusM: radius }); setMsg("Safe zone saved."); }
    catch { setMsg(""); }
    setSaving(false);
  }

  async function makeKey() {
    if (device.hasKey && !window.confirm("Generate a new key? The badge using the current key will stop working until you update it.")) return;
    setKeyBusy(true);
    try { setKey(await generateKey()); setCopied(false); } catch { /* toast shows the error */ }
    setKeyBusy(false);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(key); setCopied(true); } catch { setCopied(false); }
  }

  const origin = `http://${window.location.hostname}:4000`;
  const field = (id, label, k, hint) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" inputMode="decimal" value={f[k]} onChange={set(k)} aria-invalid={!!err[k]} aria-describedby={err[k] ? `${id}-err` : undefined} />
      {err[k] ? <p className="err" id={`${id}-err`} role="alert">{err[k]}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );

  return (
    <>
      <div className="page-h">
        <h1>Settings</h1>
        <p>Set the safe zone around home, and connect the patient’s badge.</p>
      </div>

      <div className="cols">
        <section className="panel span-6">
          <h2>Safe zone</h2>
          <form onSubmit={submit} noValidate>
            {field("lat", "Home latitude", "lat")}
            {field("lng", "Home longitude", "lng")}
            {field("radius", "Radius (metres)", "radius", "An alert is raised when the patient goes beyond this distance from home.")}
            <div className="btn-row">
              <button type="button" className="dbtn" onClick={useMyLocation}>Use my current location</button>
              <button type="submit" className="dbtn primary" disabled={saving}>{saving ? "Saving…" : "Save safe zone"}</button>
            </div>
            {msg && <p className="note" role="status">{msg}</p>}
          </form>
        </section>

        <section className="panel span-6">
          <h2>Patient badge <span className={deviceConnected ? "good" : "muted"}>{deviceConnected ? "Connected" : device.hasKey ? "Waiting for the badge" : "No key yet"}</span></h2>
          <dl className="facts one">
            <div><dt>Last seen</dt><dd>{device.lastSeen ? timeAgo(device.lastSeen) : "Never"}</dd></div>
            <div><dt>Battery</dt><dd>{device.battery == null ? "—" : `${device.battery}%`}</dd></div>
            <div><dt>Key</dt><dd>{device.hasKey ? `mk_…${device.keyHint}` : "Not generated"}</dd></div>
          </dl>
          <button className="dbtn primary" onClick={makeKey} disabled={keyBusy}>{device.hasKey ? "Generate a new key" : "Generate device key"}</button>

          {key && (
            <div className="keybox" role="status">
              <p className="note top0">Copy this key now. For your security it won’t be shown again.</p>
              <code>{key}</code>
              <button className="dbtn" onClick={copy}>{copied ? "Copied" : "Copy key"}</button>
            </div>
          )}
        </section>

        <section className="panel span-12">
          <h2>How the badge sends data</h2>
          <p className="note top0">Send each request to your computer’s address with the header <code>X-Device-Key: your key</code>. Use your computer’s network IP instead of localhost when calling from the ESP32.</p>
          <table className="api">
            <thead><tr><th>Request</th><th>Body</th><th>What it does</th></tr></thead>
            <tbody>
              <tr><td><code>POST /api/device/telemetry</code></td><td><code>{"{ lat, lng, battery }"}</code></td><td>Saves the position, checks the safe zone, records battery</td></tr>
              <tr><td><code>POST /api/device/sos</code></td><td>none</td><td>Raises a critical SOS alert</td></tr>
              <tr><td><code>POST /api/device/face</code></td><td><code>{"{ recognized, name, relationship }"}</code></td><td>Logs a recognized face, or alerts on an unknown one</td></tr>
              <tr><td><code>GET /api/device/schedule</code></td><td>none</td><td>Returns the medicine schedule for spoken reminders</td></tr>
            </tbody>
          </table>
          <pre className="curl">{`curl -X POST ${origin}/api/device/telemetry \\
  -H "X-Device-Key: YOUR_KEY" -H "Content-Type: application/json" \\
  -d '{"lat": ${settings.homeLat}, "lng": ${settings.homeLng}, "battery": 80}'`}</pre>
        </section>
      </div>
    </>
  );
}
