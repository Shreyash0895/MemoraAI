import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api.js";
import CalmFlow from "../components/companion/CalmFlow.jsx";

/*
 * The patient's own screen. Designed for people with memory loss:
 * one idea per block, large text, calm wording, no countdowns or timeouts,
 * nothing that can be changed by mistake, and no alerts or warnings.
 */
const POLL_MS = 15000;
const greeting = (d) => { const h = d.getHours(); return h < 5 ? "Hello" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const at12 = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };

export default function Companion() {
  const [phase, setPhase] = useState("loading"); // loading | unpaired | ready
  const [data, setData] = useState(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [sheet, setSheet] = useState(null);      // { type: "help" | "med", med?, step, message? }
  const [calmOpen, setCalmOpen] = useState(null); // null | { sessionId }
  const [offerHidden, setOfferHidden] = useState(false);

  useEffect(() => { document.title = "MemoraAI – My day"; }, []);

  const load = useCallback(async () => {
    try {
      setData(await api.get("/companion/today"));
      setPhase("ready");
      setOffline(false);
    } catch (e) {
      if (e.status === 401) { setPhase("unpaired"); setData(null); } else setOffline(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (phase === "unpaired") return undefined;
    const t = setInterval(load, phase === "loading" ? 5000 : POLL_MS);
    return () => clearInterval(t);
  }, [phase, load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Opens the calming screen at once (comfort should never wait for the network), then tells the server
  async function startCalm() {
    setCalmOpen({ sessionId: null });
    try {
      const r = await api.post("/companion/calm/start");
      setCalmOpen((c) => (c ? { ...c, sessionId: r.sessionId } : c));
    } catch { /* the exercise still works offline */ }
  }
  function closeCalm() { setCalmOpen(null); setOfferHidden(true); load(); }

  if (phase === "loading") {
    return <main className="cp"><p className="cp-note" role="status">{offline ? "I can’t connect right now. I’ll keep trying." : "One moment…"}</p></main>;
  }
  if (phase === "unpaired") return <main className="cp"><PairScreen onPaired={load} /></main>;

  const d = new Date(now);
  const { options: o } = data;
  const due = data.medicines.filter((m) => m.status === "due");
  const later = data.medicines.filter((m) => m.status === "later");
  const taken = data.medicines.filter((m) => m.status === "taken");
  const phoneHref = data.caregiverPhone ? `tel:${data.caregiverPhone.replace(/[^\d+]/g, "")}` : null;
  const mapsHref = data.home ? `https://www.google.com/maps/dir/?api=1&destination=${data.home.lat},${data.home.lng}&travelmode=walking` : null;

  return (
    <main className="cp">
      {offline && <p className="cp-note" role="status">I can’t connect right now. I’ll keep trying.</p>}

      <header className="cp-head">
        <h1>{greeting(d)}, {data.patientName}</h1>
        <p className="cp-date">{d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
        <p className="cp-time" aria-label="The time now">{d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
      </header>

      {data.calm?.enabled && data.calm.offer && !offerHidden && (
        <section className="cp-card cp-offer" aria-label="A gentle offer">
          <h2>Would you like to take a slow breath together?</h2>
          <div className="cp-sheet-actions">
            <button className="cp-btn big primary" onClick={() => { setOfferHidden(true); startCalm(); }}>Yes, let’s breathe</button>
            <button className="cp-btn big" onClick={() => setOfferHidden(true)}>Not now</button>
          </div>
        </section>
      )}

      {o.meds && (
        <section className="cp-card" aria-labelledby="cp-meds">
          <h2 id="cp-meds">My medicines today</h2>
          {data.medicines.length === 0 && <p className="cp-muted">Nothing to take today.</p>}
          {due.map((m) => (
            <div className="cp-med" key={m.id}>
              <div><strong>{m.name}</strong><span>{m.dose} · {at12(m.time)}</span></div>
              <button className="cp-btn primary" onClick={() => setSheet({ type: "med", med: m, step: "ask" })}>I took it</button>
            </div>
          ))}
          {data.medicines.length > 0 && due.length === 0 && later.length === 0 && <p className="cp-good">You’re all set for today.</p>}
          {later.map((m) => <p className="cp-line" key={m.id}>Later: <strong>{m.name}</strong> at {at12(m.time)}</p>)}
          {taken.map((m) => <p className="cp-line cp-done" key={m.id}>✓ <strong>{m.name}</strong> taken</p>)}
        </section>
      )}

      {o.person && (
        <section className="cp-card" aria-labelledby="cp-who">
          <h2 id="cp-who">Who is here?</h2>
          {data.visitor ? (
            <div className="cp-visitor">
              {data.visitor.hasPhoto && <img src={`/api/companion/photo/${data.visitor.id}`} alt={`Photo of ${data.visitor.name}`} />}
              <div>
                <p className="cp-name">{data.visitor.name}</p>
                <p className="cp-rel">Your {data.visitor.relationship.toLowerCase()}</p>
                {data.visitor.notes && <p className="cp-line">{data.visitor.notes}</p>}
              </div>
            </div>
          ) : <p className="cp-muted">When someone comes to see you, you’ll see who they are here.</p>}
        </section>
      )}

      {(mapsHref || phoneHref) && (
        <section className="cp-actions" aria-label="Getting home">
          {mapsHref && <a className="cp-btn big" href={mapsHref} target="_blank" rel="noopener noreferrer">Take me home</a>}
          {phoneHref && <a className="cp-btn big" href={phoneHref}>Call my caregiver</a>}
        </section>
      )}

      {data.calm?.enabled && (
        <section className="cp-actions">
          <button className="cp-btn big calm" onClick={startCalm}>I feel worried</button>
        </section>
      )}

      {o.help && (
        <section className="cp-actions">
          <button className="cp-btn big help" onClick={() => setSheet({ type: "help", step: "ask" })}>I need help</button>
        </section>
      )}

      {calmOpen && (
        <CalmFlow calm={data.calm} patientName={data.patientName} sessionId={calmOpen.sessionId} phoneHref={phoneHref} onClose={closeCalm} />
      )}

      {sheet && <Sheet sheet={sheet} setSheet={setSheet} phoneHref={phoneHref} onChanged={load} />}
    </main>
  );
}

function PairScreen({ onPaired }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) { setErr("Please type the 6 numbers your caregiver gave you."); return; }
    setBusy(true); setErr("");
    try { await api.post("/companion/pair", { code: digits }); await onPaired(); }
    catch (e2) { setErr(e2.message || "Something went wrong. Please try again."); setBusy(false); }
  }

  return (
    <form className="cp-card cp-pair" onSubmit={submit} noValidate>
      <h1>Let’s connect this screen</h1>
      <p>Ask your caregiver for a code. Then type the 6 numbers here.</p>
      <label htmlFor="cp-code">Code</label>
      <input id="cp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code}
        onChange={(e) => setCode(e.target.value)} aria-invalid={!!err} aria-describedby={err ? "cp-code-err" : undefined} autoFocus />
      {err && <p className="cp-err" id="cp-code-err" role="alert">{err}</p>}
      <button className="cp-btn big primary" type="submit" disabled={busy}>{busy ? "Connecting…" : "Connect"}</button>
    </form>
  );
}

/** A full-screen question or message. One clear choice, never a timer. */
function Sheet({ sheet, setSheet, phoneHref, onChanged }) {
  const close = useCallback(() => setSheet(null), [setSheet]);
  const firstBtn = useRef(null);
  useEffect(() => { firstBtn.current?.focus(); }, [sheet.step]);

  async function send() {
    setSheet((s) => ({ ...s, step: "sending" }));
    try {
      if (sheet.type === "help") await api.post("/companion/help");
      else await api.post(`/companion/medicines/${sheet.med.id}/taken`);
      setSheet((s) => ({ ...s, step: "done" }));
      onChanged();
    } catch (e) {
      if (e.code === "already-taken") { setSheet((s) => ({ ...s, step: "already" })); onChanged(); }
      else setSheet((s) => ({ ...s, step: "error" }));
    }
  }

  const isHelp = sheet.type === "help";
  let title, body, buttons;
  if (sheet.step === "ask") {
    title = isHelp ? "Do you need help?" : `Did you take ${sheet.med.name}?`;
    body = isHelp ? "I can send a message to your caregiver." : sheet.med.dose;
    buttons = [
      <button key="y" ref={firstBtn} className={`cp-btn big ${isHelp ? "help" : "primary"}`} onClick={send}>{isHelp ? "Yes, I need help" : "Yes, I took it"}</button>,
      <button key="n" className="cp-btn big" onClick={close}>{isHelp ? "No, I’m okay" : "Not yet"}</button>,
    ];
  } else if (sheet.step === "sending") {
    title = "One moment…"; body = ""; buttons = [];
  } else if (sheet.step === "done") {
    title = isHelp ? "I’ve sent a message to your caregiver." : "Thank you.";
    body = isHelp ? "Please stay where you are if you can." : "I’ve written that down.";
    buttons = [<button key="ok" ref={firstBtn} className="cp-btn big primary" onClick={close}>OK</button>];
  } else if (sheet.step === "already") {
    title = "You’re all set."; body = "You already took this today.";
    buttons = [<button key="ok" ref={firstBtn} className="cp-btn big primary" onClick={close}>OK</button>];
  } else {
    title = isHelp ? "I couldn’t send that message." : "I couldn’t save that.";
    body = isHelp && phoneHref ? "You can call your caregiver instead." : "Please try again.";
    buttons = [
      <button key="r" ref={firstBtn} className="cp-btn big primary" onClick={send}>Try again</button>,
      ...(isHelp && phoneHref ? [<a key="c" className="cp-btn big" href={phoneHref}>Call my caregiver</a>] : []),
      <button key="c2" className="cp-btn big" onClick={close}>Close</button>,
    ];
  }

  return (
    <div className="cp-overlay" onKeyDown={(e) => { if (e.key === "Escape" && sheet.step !== "sending") close(); }}>
      <div className="cp-sheet" role="dialog" aria-modal="true" aria-labelledby="cp-sheet-title" aria-live="polite">
        <h2 id="cp-sheet-title">{title}</h2>
        {body && <p>{body}</p>}
        <div className="cp-sheet-actions">{buttons}</div>
      </div>
    </div>
  );
}
