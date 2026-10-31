import { useEffect, useRef, useState } from "react";
import { api } from "../../services/api.js";
import { prepareImage } from "../../utils/image.js";

const MAX_PHOTOS = 5;
const STATUS_LABEL = { pending: "Checking", noface: "No face", multiface: "Several faces" };
const RELATIONS = ["Son", "Daughter", "Husband", "Wife", "Grandson", "Granddaughter", "Brother", "Sister", "Friend", "Neighbour", "Caregiver", "Doctor"];

/** Add or edit one person. `person` is null when adding. */
export default function PersonForm({ person, onSaved, onCancel, onChanged }) {
  const [name, setName] = useState(person?.name ?? "");
  const [relationship, setRelationship] = useState(person?.relationship ?? "");
  const [notes, setNotes] = useState(person?.notes ?? "");
  const [photos, setPhotos] = useState(person?.photos ?? []); // saved photos: { id, status }
  const [adds, setAdds] = useState([]);                       // new photos: { key, blob, url }
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [photoMsg, setPhotoMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const addsRef = useRef(adds);
  addsRef.current = adds;
  useEffect(() => () => addsRef.current.forEach((a) => URL.revokeObjectURL(a.url)), []);

  async function pick(e) {
    const chosen = [...e.target.files];
    e.target.value = "";
    const room = MAX_PHOTOS - photos.length - adds.length;
    if (!chosen.length) return;
    if (room <= 0) { setPhotoMsg(`You can add up to ${MAX_PHOTOS} photos per person.`); return; }

    setPhotoMsg("Preparing photos…");
    const ready = [];
    const problems = [];
    for (const file of chosen.slice(0, room)) {
      try {
        const blob = await prepareImage(file);
        ready.push({ key: `${file.name}-${file.size}-${Math.random()}`, blob, url: URL.createObjectURL(blob) });
      } catch (err) { problems.push(err.message); }
    }
    setAdds((a) => [...a, ...ready]);
    const extra = chosen.length > room ? `Only ${room} more ${room === 1 ? "photo fits" : "photos fit"}.` : "";
    setPhotoMsg([extra, ...problems].filter(Boolean).join(" "));
  }

  function dropNew(key) {
    setAdds((list) => {
      const gone = list.find((a) => a.key === key);
      if (gone) URL.revokeObjectURL(gone.url);
      return list.filter((a) => a.key !== key);
    });
  }

  async function removeSaved(photoId) {
    try {
      await api.delete(`/people/${person.id}/photos/${photoId}`);
      setPhotos((p) => p.filter((ph) => ph.id !== photoId));
      onChanged();
    } catch (err) { setPhotoMsg(err.message); }
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const x = {};
    if (!name.trim()) x.name = "Enter the person’s name.";
    else if (name.trim().length > 80) x.name = "Keep the name under 80 characters.";
    if (!relationship.trim()) x.relationship = "Enter how they’re related, like son or friend.";
    else if (relationship.trim().length > 40) x.relationship = "Keep this under 40 characters.";
    if (notes.length > 200) x.notes = "Keep the note under 200 characters.";
    setErrors(x);
    setFormError("");
    if (Object.keys(x).length) return;

    setBusy(true);
    try {
      const values = { name: name.trim(), relationship: relationship.trim(), notes: notes.trim() };
      const saved = person ? await api.put(`/people/${person.id}`, values) : await api.post("/people", values);

      const failures = [];
      for (let i = 0; i < adds.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${adds.length}…`);
        try { await api.upload(`/people/${saved.id}/photos`, adds[i].blob); }
        catch (err) { failures.push(`Photo ${i + 1}: ${err.message || "couldn’t be uploaded."}`); }
      }
      onSaved(failures, values.name);
    } catch (err) {
      setFormError(err.message || "Something went wrong. Please try again.");
      setBusy(false);
      setProgress("");
    }
  }

  const total = photos.length + adds.length;
  return (
    <section className="panel person-form" onKeyDown={(e) => { if (e.key === "Escape" && !busy) onCancel(); }}>
      <h2>{person ? `Edit ${person.name}` : "Add a person"}</h2>
      <form onSubmit={submit} noValidate>
        {formError && <div className="alert" role="alert">{formError}</div>}

        <div className="form-grid">
          <div className="field">
            <label htmlFor="p-name">Name</label>
            <input id="p-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
              aria-invalid={!!errors.name} aria-describedby={errors.name ? "p-name-err" : undefined} />
            {errors.name && <p className="err" id="p-name-err" role="alert">{errors.name}</p>}
          </div>
          <div className="field">
            <label htmlFor="p-rel">Relationship to the patient</label>
            <input id="p-rel" type="text" list="relations" value={relationship} onChange={(e) => setRelationship(e.target.value)}
              aria-invalid={!!errors.relationship} aria-describedby="p-rel-hint" />
            <datalist id="relations">{RELATIONS.map((r) => <option key={r} value={r} />)}</datalist>
            {errors.relationship
              ? <p className="err" role="alert">{errors.relationship}</p>
              : <p className="hint" id="p-rel-hint">The badge says “This is your son”, so use words the patient knows.</p>}
          </div>
        </div>

        <div className="field">
          <label htmlFor="p-notes">Note for the patient (optional)</label>
          <input id="p-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} aria-invalid={!!errors.notes} />
          {errors.notes ? <p className="err" role="alert">{errors.notes}</p> : <p className="hint">Something comforting or useful, like “Visits every Sunday”.</p>}
        </div>

        <div className="field">
          <label htmlFor="p-photos">Photos ({total} of {MAX_PHOTOS})</label>
          <p className="hint top0">Add 3 to 5 clear photos of just this person, facing the camera, in good light. Each photo is checked for exactly one clear face.</p>
          {total > 0 && (
            <ul className="thumbs">
              {photos.map((ph) => (
                <li key={ph.id}>
                  <img src={`/api/people/${person.id}/photos/${ph.id}`} alt="Saved photo" />
                  {STATUS_LABEL[ph.status] && <span className={`thumb-tag ${ph.status}`}>{STATUS_LABEL[ph.status]}</span>}
                  <button type="button" className="thumb-x" onClick={() => removeSaved(ph.id)} aria-label="Remove this photo">×</button>
                </li>
              ))}
              {adds.map((a) => (
                <li key={a.key}>
                  <img src={a.url} alt="New photo, not saved yet" />
                  <button type="button" className="thumb-x" onClick={() => dropNew(a.key)} aria-label="Remove this new photo">×</button>
                </li>
              ))}
            </ul>
          )}
          {total < MAX_PHOTOS && (
            <input id="p-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={pick} disabled={busy} />
          )}
          {photoMsg && <p className="hint" role="status">{photoMsg}</p>}
        </div>

        <div className="btn-row">
          <button type="submit" className="dbtn primary" disabled={busy}>
            {busy ? progress || "Saving…" : person ? "Save changes" : "Add person"}
          </button>
          <button type="button" className="dbtn" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </form>
    </section>
  );
}
