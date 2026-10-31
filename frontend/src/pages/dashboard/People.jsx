import { useCallback, useEffect, useState } from "react";
import { api } from "../../services/api.js";
import { useData } from "../../context/DataContext.jsx";
import PersonAvatar from "../../components/dashboard/PersonAvatar.jsx";
import PersonForm from "../../components/dashboard/PersonForm.jsx";
import RecognitionTest from "../../components/dashboard/RecognitionTest.jsx";

function PhotoSummary({ photos }) {
  const ok = photos.filter((ph) => ph.status === "ok").length;
  const pending = photos.filter((ph) => ph.status === "pending").length;
  const bad = photos.length - ok - pending;
  if (photos.length === 0) return <small className="warn">No photos yet, so this person can’t be recognized.</small>;
  if (ok === 0 && pending > 0) return <small>Checking {pending === 1 ? "the photo" : "the photos"}…</small>;
  if (ok === 0) return <small className="warn">No usable photo. Edit to replace {bad === 1 ? "it" : "them"} with a clear, front-facing photo.</small>;
  return (
    <small>
      {ok} usable {ok === 1 ? "photo" : "photos"}
      {pending > 0 && ` · ${pending} being checked`}
      {bad > 0 && <span className="warn"> · {bad} without a clear face</span>}
      {ok < 3 && <span className="muted"> · 3 or more works best</span>}
    </small>
  );
}

export default function People() {
  const { patient } = useData();
  const [people, setPeople] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | a person
  const [notice, setNotice] = useState("");
  const [face, setFace] = useState({ available: true, threshold: 0.45 });

  const load = useCallback(async () => {
    try { setPeople(await api.get("/people")); setError(""); }
    catch (e) { setError(e.message || "Couldn’t load people."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Photos still being checked: look again shortly so the status updates by itself
  useEffect(() => {
    if (!people || !people.some((p) => p.photos.some((ph) => ph.status === "pending"))) return undefined;
    const t = setTimeout(load, 5000);
    return () => clearTimeout(t);
  }, [people, load]);

  // Is the face service running? Checked on load and every 30 s
  useEffect(() => {
    const check = () => api.get("/people/face-status").then(setFace).catch(() => {});
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, []);

  async function remove(p) {
    if (!window.confirm(`Remove ${p.name}? Their photos will be deleted too.`)) return;
    try {
      await api.delete(`/people/${p.id}`);
      setNotice(`${p.name} was removed.`);
      if (editing && editing !== "new" && editing.id === p.id) setEditing(null);
      load();
    } catch (e) { setNotice(e.message); }
  }

  function saved(failures, name) {
    setEditing(null);
    setNotice(failures.length
      ? `${name} was saved, but ${failures.length === 1 ? "a photo" : `${failures.length} photos`} couldn’t be uploaded: ${failures[0]} Edit ${name} to try again.`
      : `${name} was saved.`);
    load();
  }

  return (
    <>
      <div className="page-h">
        <h1>People</h1>
        <p>Family and friends {patient.name}’s badge should recognize. Photos are used only for recognition.</p>
      </div>

      <div className="toolbar">
        <span className="muted">{people ? `${people.length} ${people.length === 1 ? "person" : "people"}` : ""}</span>
        {!editing && <button className="dbtn primary" onClick={() => { setNotice(""); setEditing("new"); }}>Add a person</button>}
      </div>

      {!face.available && (
        <div className="notice warnbox" role="status">
          <span>The face service isn’t running right now. You can still add people and photos. Photos are checked automatically as soon as it starts.</span>
        </div>
      )}

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button className="dbtn" onClick={() => setNotice("")}>Dismiss</button>
        </div>
      )}

      {editing && (
        <PersonForm
          key={editing === "new" ? "new" : editing.id}
          person={editing === "new" ? null : editing}
          onSaved={saved}
          onCancel={() => setEditing(null)}
          onChanged={load}
        />
      )}

      {error ? (
        <section className="panel" role="alert">
          <p className="empty">{error}</p>
          <button className="dbtn primary" onClick={load}>Try again</button>
        </section>
      ) : people === null ? (
        <p className="empty" role="status">Loading…</p>
      ) : people.length === 0 ? (
        <section className="panel">
          <p className="empty">No one added yet. Add the people {patient.name} sees most, such as family, close friends and carers, so the badge can say who they are.</p>
        </section>
      ) : (
        <ul className="people-grid">
          {people.map((p) => (
            <li key={p.id} className="panel person">
              <PersonAvatar person={p} size="lg" />
              <div className="person-main">
                <strong>{p.name}</strong>
                <span className="rel">{p.relationship}</span>
                {p.notes && <p>{p.notes}</p>}
                <PhotoSummary photos={p.photos} />
              </div>
              <div className="person-actions">
                <button className="dbtn" onClick={() => { setNotice(""); setEditing(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                <button className="dbtn danger" onClick={() => remove(p)} aria-label={`Remove ${p.name}`}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <RecognitionTest available={face.available} hasPeople={!!people && people.some((ph) => ph.photos.some((x) => x.status === "ok"))} />
    </>
  );
}
