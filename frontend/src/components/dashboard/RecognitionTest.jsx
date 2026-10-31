import { useEffect, useRef, useState } from "react";
import { api } from "../../services/api.js";
import { prepareImage } from "../../utils/image.js";

const pct = (n) => n.toFixed(2);

/** Try the recognizer on any photo. Nothing is saved, no alerts are raised. */
export default function RecognitionTest({ available, hasPeople }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const previewRef = useRef("");
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  async function pick(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const blob = await prepareImage(file);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = URL.createObjectURL(blob);
      setPreview(previewRef.current);
      setResult(await api.upload("/people/recognize-test", blob));
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
    setBusy(false);
  }

  const best = result?.best;
  let summary = "";
  if (result) {
    if (result.status === "match") summary = `Recognized as ${best.name} (${best.relationship}).`;
    else if (result.status === "unsure") summary = "Not sure. This face looks similar to more than one person, so the badge won’t name anyone.";
    else if (result.status === "unknown") summary = `No match. The closest person was ${best.name}, but the score is below ${pct(result.threshold)}.`;
    else if (result.status === "no-face") summary = "No clear face found. Try a closer, front-facing photo.";
    else summary = "Add a person with at least one photo first.";
  }

  return (
    <section className="panel recog-test">
      <h2>Test recognition</h2>
      <p className="note top0">
        Choose any photo to see who the badge would think it is. Nothing is saved and no alerts are sent.
        Scores run from 0 to 1, and {result ? pct(result.threshold) : "the match threshold"} or higher counts as a match.
      </p>
      {!available && <div className="alert" role="alert">The face service isn’t running, so testing is unavailable right now.</div>}
      {available && !hasPeople && <p className="hint">Add a person with photos first.</p>}
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} disabled={busy || !available} aria-label="Choose a photo to test" />
      {busy && <p className="hint" role="status">Checking…</p>}
      {error && <div className="alert" role="alert">{error}</div>}

      {result && (
        <div className="recog-result" role="status">
          {preview && <img src={preview} alt="The photo you tested" />}
          <div>
            <p className={`verdict ${result.status}`}>{summary}</p>
            {result.speech && <p className="speech">The badge would say: “{result.speech}”</p>}
            {result.faceCount > 1 && <p className="hint">{result.faceCount} faces were found. The largest one was used.</p>}
            {result.candidates.length > 0 && (
              <ul className="cand">
                {result.candidates.map((c) => (
                  <li key={c.personId}>
                    <span>{c.name}</span>
                    <div className="bar"><i style={{ width: `${Math.max(0, Math.min(1, c.score)) * 100}%` }} /></div>
                    <strong>{pct(c.score)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
