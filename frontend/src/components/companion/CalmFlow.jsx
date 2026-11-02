import { useEffect, useRef, useState } from "react";
import { api } from "../../services/api.js";
import { canSpeak, speak, stopSpeaking } from "../../utils/speech.js";

/*
 * A gentle, scripted calming exercise for the patient. It is not a chatbot: every word is fixed,
 * reviewed wording. It adapts to how the patient says they feel, and tells the caregiver if they
 * are still worried. It never says "calm down", and nothing here can hurt: stretches are seated
 * and only appear if the caregiver turned them on.
 */
const CYCLES = 5, IN_MS = 4000, OUT_MS = 6000;
const STRETCHES = [
  "Sit back and rest your feet on the floor. Let your hands rest on your knees.",
  "Slowly lift your shoulders up toward your ears. Then let them drop.",
  "Gently turn your head to the right. Then slowly to the left. Go slowly.",
  "Open your hands wide. Then softly close them. Do this three times.",
  "Slowly raise both arms in front of you. Then lower them down.",
  "Take one more slow breath in, and out. Well done.",
];

export default function CalmFlow({ calm, patientName, sessionId, phoneHref, onClose }) {
  const [step, setStep] = useState("intro"); // intro | breathe | checkin | calmer | menu | people | stretch
  const [sound, setSound] = useState(canSpeak);
  const [told, setTold] = useState(null);    // after "still worried": did the caregiver get the message?
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const say = (text) => { if (soundRef.current) speak(text); };
  const sayRef = useRef(say);
  sayRef.current = say;

  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => { if (!sound) stopSpeaking(); }, [sound]);

  async function report(outcome) {
    if (!sessionId) return null;
    try { return await api.post(`/companion/calm/${sessionId}/outcome`, { outcome }); } catch { return null; }
  }

  async function choose(outcome) {
    if (outcome === "calmer") { setStep("calmer"); report("calmer"); return; }
    if (outcome === "worse") { setTold(null); setStep("menu"); const r = await report("worse"); setTold(!!r); return; }
    setStep("menu"); report("same");
  }

  return (
    <div className="cp-calm" role="dialog" aria-modal="true" aria-label="Calming exercise"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="cp-calm-bar">
        {canSpeak ? <button className="cp-mini" onClick={() => setSound(!sound)} aria-pressed={sound}>{sound ? "Sound on" : "Sound off"}</button> : <span />}
        <button className="cp-mini" onClick={onClose}>Close</button>
      </div>

      <div className="cp-calm-body">
        {step === "intro" && <Intro name={patientName} say={say} onStart={() => setStep("breathe")} onClose={onClose} />}
        {step === "breathe" && <Breathing sayRef={sayRef} onDone={() => setStep("checkin")} onStop={() => setStep("checkin")} />}
        {step === "checkin" && (
          <>
            <h2>How do you feel now?</h2>
            {calm.message && <p className="cp-note-card">A message for you: “{calm.message}”</p>}
            <div className="cp-sheet-actions">
              <button className="cp-btn big primary" onClick={() => choose("calmer")}>Calmer</button>
              <button className="cp-btn big" onClick={() => choose("same")}>About the same</button>
              <button className="cp-btn big" onClick={() => choose("worse")}>Still worried</button>
            </div>
          </>
        )}
        {step === "calmer" && (
          <>
            <h2>I’m glad. You did well.</h2>
            {calm.message && <p className="cp-note-card">“{calm.message}”</p>}
            <button className="cp-btn big primary" onClick={onClose}>Done</button>
          </>
        )}
        {step === "menu" && <Menu calm={calm} told={told} phoneHref={phoneHref} setStep={setStep} onClose={onClose} />}
        {step === "people" && <People people={calm.people} say={say} onBack={() => setStep("menu")} />}
        {step === "stretch" && <Stretch say={say} onBack={() => setStep("menu")} />}
      </div>
    </div>
  );
}

function Intro({ name, say, onStart, onClose }) {
  useEffect(() => { say(`${name}, you are safe. Let’s take a slow breath together.`); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <h2>{name}, you are safe.</h2>
      <p>Let’s take a slow breath together.</p>
      <div className="cp-sheet-actions">
        <button className="cp-btn big primary" onClick={onStart}>Start</button>
        <button className="cp-btn big" onClick={onClose}>Not now</button>
      </div>
    </>
  );
}

function Breathing({ sayRef, onDone, onStop }) {
  const [phase, setPhase] = useState("in");
  const [cycle, setCycle] = useState(0);
  const [grow, setGrow] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    sayRef.current(phase === "in" ? "Breathe in slowly." : "Breathe out slowly.");
    const frame = requestAnimationFrame(() => setGrow(phase === "in")); // lets the circle animate from small to large
    const timer = setTimeout(() => {
      if (phase === "in") setPhase("out");
      else if (cycle + 1 >= CYCLES) doneRef.current();
      else { setCycle((c) => c + 1); setPhase("in"); }
    }, phase === "in" ? IN_MS : OUT_MS);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [phase, cycle, sayRef]);

  return (
    <>
      <div className="cp-breath-wrap" aria-hidden="true">
        <div className={`cp-breath ${grow ? "grow" : ""}`} style={{ transitionDuration: `${phase === "in" ? IN_MS : OUT_MS}ms` }} />
      </div>
      <h2 role="status" aria-live="polite">{phase === "in" ? "Breathe in slowly" : "Breathe out slowly"}</h2>
      <div className="cp-dots" aria-hidden="true">
        {Array.from({ length: CYCLES }, (_, i) => <i key={i} className={i < cycle ? "done" : i === cycle ? "now" : ""} />)}
      </div>
      <button className="cp-btn" onClick={onStop}>Stop</button>
    </>
  );
}

function Menu({ calm, told, phoneHref, setStep, onClose }) {
  return (
    <>
      <h2>What would help?</h2>
      {told === true && <p className="cp-note-card">I’ve told your caregiver. You are not alone.</p>}
      {told === false && <p className="cp-note-card">I couldn’t reach your caregiver. You can call them.</p>}
      {calm.message && <p className="cp-note-card">“{calm.message}”</p>}
      <div className="cp-sheet-actions">
        {phoneHref && told !== null && <a className="cp-btn big primary" href={phoneHref}>Call my caregiver</a>}
        <button className="cp-btn big" onClick={() => setStep("breathe")}>Breathe again</button>
        {calm.people.length > 0 && <button className="cp-btn big" onClick={() => setStep("people")}>People who care about you</button>}
        {calm.stretches && <button className="cp-btn big" onClick={() => setStep("stretch")}>Gentle stretches</button>}
        <button className="cp-btn big" onClick={onClose}>I’m okay now</button>
      </div>
    </>
  );
}

function People({ people, say, onBack }) {
  const [i, setI] = useState(0);
  const p = people[i];
  useEffect(() => { say(`${p.name}, your ${p.relationship.toLowerCase()}. ${p.notes || ""}`); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <h2>People who care about you</h2>
      <img className="cp-person-photo" src={`/api/companion/photo/${p.id}`} alt={`Photo of ${p.name}`} />
      <p className="cp-name">{p.name}</p>
      <p className="cp-rel">Your {p.relationship.toLowerCase()}</p>
      {p.notes && <p>{p.notes}</p>}
      <div className="cp-sheet-actions">
        {i + 1 < people.length && <button className="cp-btn big primary" onClick={() => setI(i + 1)}>Next person</button>}
        <button className="cp-btn big" onClick={onBack}>Back</button>
      </div>
    </>
  );
}

function Stretch({ say, onBack }) {
  const [i, setI] = useState(0);
  useEffect(() => { say(STRETCHES[i]); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = i + 1 >= STRETCHES.length;
  return (
    <>
      <h2>Gentle stretches</h2>
      <p className="cp-stretch">{STRETCHES[i]}</p>
      <p className="cp-fine">Stay seated. Only do what feels comfortable. Stop if anything hurts.</p>
      <div className="cp-sheet-actions">
        <button className="cp-btn big primary" onClick={() => (last ? onBack() : setI(i + 1))}>{last ? "Finish" : "Next"}</button>
        <button className="cp-btn big" onClick={onBack}>Stop</button>
      </div>
    </>
  );
}
