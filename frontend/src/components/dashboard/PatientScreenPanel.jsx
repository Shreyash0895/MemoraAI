import { useEffect, useState } from "react";
import { useData } from "../../context/DataContext.jsx";
import { timeAgo } from "../../utils/format.js";

const OPTIONS = [
  ["meds", "Medicines", "Shows what to take today, with an “I took it” button."],
  ["person", "Who is here", "Shows the last person the badge recognized, with their photo."],
  ["home", "Take me home", "A button that opens walking directions to the home address."],
  ["help", "I need help", "A button that sends you an SOS alert."],
  ["calm", "I feel worried", "Gentle breathing, and looking at people who care about them. Tells you if they are still worried afterwards."],
  ["stretch", "Gentle seated stretches", "Slow seated movements inside the calming exercise. Turn on only if they can move safely, and check with their doctor."],
];
const PHONE_RE = /^[0-9+()\-\s]{5,20}$/;
const spaced = (code) => `${code.slice(0, 3)} ${code.slice(3)}`;
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Caregiver controls for the patient's own screen (companion mode). */
export default function PatientScreenPanel() {
  const { patient, companion, createPairCode, removeScreen, saveCompanion } = useData();
  const [issued, setIssued] = useState(null); // { code, expiresAt }
  const [now, setNow] = useState(Date.now());
  const [opts, setOpts] = useState(companion.options);
  const [phone, setPhone] = useState(companion.phone);
  const [phoneErr, setPhoneErr] = useState("");
  const [calmMsg, setCalmMsg] = useState(companion.calmMessage ?? "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!issued) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [issued]);
  const left = issued ? Math.max(0, Math.floor((issued.expiresAt - now) / 1000)) : 0;
  // hide the code once it has expired, or once a screen has used it
  useEffect(() => {
    if (issued && (left === 0 || companion.codeExpiresAt == null)) setIssued(null);
  }, [issued, left, companion.codeExpiresAt]);

  async function makeCode() {
    setBusy(true);
    try { setIssued(await createPairCode()); setNow(Date.now()); } catch { /* the error toast explains */ }
    setBusy(false);
  }

  async function save(e) {
    e.preventDefault();
    if (phone.trim() && !PHONE_RE.test(phone.trim())) { setPhoneErr("Use digits, spaces, + or - (5 to 20 characters)."); return; }
    setPhoneErr("");
    try { await saveCompanion({ phone: phone.trim(), options: opts, calmMessage: calmMsg.trim() }); setMsg("Saved."); } catch { setMsg(""); }
  }

  return (
    <section className="panel span-12">
      <h2>{patient.name}’s screen</h2>
      <p className="note top0">
        A simple screen for {patient.name} on a phone or tablet: the date and time, what to take, who is visiting, and a help button.
        It shows no alerts, settings or location history, and it can’t change anything except confirming a medicine and asking for help.
      </p>

      <div className="cols nested">
        <div className="span-6">
          <h3>Connect a screen</h3>
          <ol className="steps">
            <li>On the patient’s device, open <code>{window.location.origin}/companion</code></li>
            <li>Press “Show a code” here, then type the code on that device.</li>
          </ol>
          <p className="hint">To use a phone on the same Wi-Fi, replace <code>localhost</code> with your computer’s IP address.</p>

          {issued ? (
            <div className="keybox" role="status">
              <code className="paircode">{spaced(issued.code)}</code>
              <p className="note top0">Works once, and expires in {mmss(left)}.</p>
            </div>
          ) : (
            <button className="dbtn primary" onClick={makeCode} disabled={busy}>Show a code</button>
          )}

          <h3 className="sub">Connected screens</h3>
          {companion.screens.length === 0 ? <p className="empty">No screens connected yet.</p> : (
            <ul className="screens">
              {companion.screens.map((sc) => (
                <li key={sc.id}>
                  <div>
                    <strong>{sc.label}</strong>
                    <small>Connected {new Date(sc.createdAt).toLocaleDateString()} · last used {sc.lastSeen ? timeAgo(sc.lastSeen) : "never"}</small>
                  </div>
                  <button className="dbtn danger" onClick={() => { if (window.confirm(`Disconnect ${sc.label}? It will need a new code to connect again.`)) removeScreen(sc.id); }}>Disconnect</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form className="span-6" onSubmit={save} noValidate>
          <h3>What the screen shows</h3>
          <ul className="optlist">
            {OPTIONS.map(([key, label, help]) => (
              <li key={key}>
                <label className="check">
                  <input type="checkbox" checked={opts[key]} onChange={(e) => { setOpts({ ...opts, [key]: e.target.checked }); setMsg(""); }} />
                  <span><strong>{label}</strong><small>{help}</small></span>
                </label>
              </li>
            ))}
          </ul>
          <div className="field">
            <label htmlFor="cmsg">A message for the calming screen (optional)</label>
            <input id="cmsg" type="text" maxLength={200} value={calmMsg} onChange={(e) => { setCalmMsg(e.target.value); setMsg(""); }} />
            <p className="hint">Shown and read aloud at the end, for example “I love you. I’ll be there soon.”</p>
          </div>
          <div className="field">
            <label htmlFor="cphone">Your phone number (optional)</label>
            <input id="cphone" type="text" inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setMsg(""); }} aria-invalid={!!phoneErr} />
            {phoneErr ? <p className="err" role="alert">{phoneErr}</p> : <p className="hint">Adds a “Call my caregiver” button to the patient’s screen.</p>}
          </div>
          <div className="btn-row">
            <button type="submit" className="dbtn primary">Save</button>
          </div>
          {msg && <p className="note" role="status">{msg}</p>}
        </form>
      </div>
    </section>
  );
}
