/*
 * Face recognition on the Node side: talks to the Python face service,
 * stores/loads embeddings, decides who a face is, and records the result.
 * Safety first: a wrong name is worse than no name, so matching is strict.
 */
import { db } from "./db.js";
import { HttpError } from "./errors.js";
import { createAlert, logActivity } from "./core.js";

const FACE_URL = process.env.FACE_URL || "http://face:8000";
export const THRESHOLD = Number(process.env.MATCH_THRESHOLD) || 0.45; // cosine similarity needed for a match
export const MARGIN = 0.05;          // best match must beat the runner-up by this much, else "unsure"
export const MIN_ENROLL_FACE = 60;   // px: faces in saved photos must be at least this wide
export const MIN_FRAME_FACE = 40;    // px: faces in camera frames must be at least this wide
const DIMS = 128;
const MATCH_COOLDOWN = 10 * 60 * 1000;   // don't log the same person again within 10 minutes
const UNKNOWN_COOLDOWN = 5 * 60 * 1000;  // don't alert about unknown faces more than every 5 minutes

const unavailable = () => new HttpError(503, "Face recognition isn’t available right now.", "face-service-unavailable");

// ---------- talking to the face service ----------
export async function embedFaces(buf) {
  let res;
  try {
    res = await fetch(`${FACE_URL}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: buf,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw unavailable();
  }
  // The service answered, so it is running: an error here is about this image, not an outage.
  if (res.status === 400) throw new HttpError(400, "That image couldn’t be read.", "bad-image");
  const failed = () => new HttpError(502, "Face recognition failed on that image.", "face-service-error");
  if (!res.ok) throw failed();
  const data = await res.json().catch(() => null);
  if (!data || !Array.isArray(data.faces)) throw failed();
  return data.faces.filter((f) => Array.isArray(f.embedding) && f.embedding.length === DIMS && Array.isArray(f.box));
}

export async function faceServiceStatus() {
  try {
    const res = await fetch(`${FACE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------- embeddings <-> bytes ----------
export const toBlob = (arr) => Buffer.from(new Float32Array(arr).buffer);
export function fromBlob(buf) {
  const copy = new ArrayBuffer(buf.length); // copy so the float view is properly aligned
  new Uint8Array(copy).set(buf);
  return new Float32Array(copy);
}

// ---------- checking photos when they are added ----------
/** Decides what a photo's faces mean for enrolment. */
export function classify(faces) {
  if (faces.length === 0) return { status: "noface", reason: "none" };
  if (faces.length > 1) return { status: "multiface", reason: "many" };
  if (faces[0].box[2] < MIN_ENROLL_FACE) return { status: "noface", reason: "small" };
  return { status: "ok", embedding: toBlob(faces[0].embedding) };
}

const REJECTIONS = {
  none: ["No face found in that photo. Use a clear photo facing the camera.", "no-face"],
  many: ["More than one face found. Use a photo with only this person.", "multi-face"],
  small: ["The face is too small. Use a closer photo.", "face-too-small"],
};

/** Returns { status, embedding } for a good photo, "pending" if the service is down, or throws a 400. */
export async function analyzePhoto(buf) {
  let faces;
  try {
    faces = await embedFaces(buf);
  } catch (e) {
    // Service down or struggling: keep the photo and check it again later
    if (e.code === "face-service-unavailable" || e.code === "face-service-error") return { status: "pending", embedding: null };
    throw e;
  }
  const c = classify(faces);
  if (c.status === "ok") return c;
  throw new HttpError(400, ...REJECTIONS[c.reason]);
}

/** Re-checks photos saved while the face service was down (or before face support existed). */
export async function backfillEmbeddings(limit = 10) {
  const rows = db.prepare("SELECT id, data FROM person_photos WHERE face_status = 'pending' ORDER BY id LIMIT ?").all(limit);
  const set = db.prepare("UPDATE person_photos SET face_status = ?, embedding = ? WHERE id = ?");
  for (const r of rows) {
    let faces;
    try {
      faces = await embedFaces(Buffer.from(r.data));
    } catch (e) {
      if (e.code === "face-service-unavailable") return; // service is down: try again next minute
      set.run("noface", null, r.id);                    // this photo can't be processed: flag it so it never blocks the others
      continue;
    }
    const c = classify(faces);
    set.run(c.status, c.embedding ?? null, r.id);
  }
}

// ---------- matching ----------
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / ((Math.sqrt(na) * Math.sqrt(nb)) || 1);
}

export function loadGallery(userId) {
  const rows = db
    .prepare(`SELECT p.id AS personId, p.name, p.relationship, p.notes, ph.embedding
              FROM person_photos ph JOIN people p ON p.id = ph.person_id
              WHERE p.user_id = ? AND ph.face_status = 'ok' AND ph.embedding IS NOT NULL
              ORDER BY ph.id`)
    .all(userId);
  const byPerson = new Map();
  for (const r of rows) {
    if (!byPerson.has(r.personId)) byPerson.set(r.personId, { personId: r.personId, name: r.name, relationship: r.relationship, notes: r.notes, embeddings: [] });
    byPerson.get(r.personId).embeddings.push(fromBlob(Buffer.from(r.embedding)));
  }
  return [...byPerson.values()];
}

/** Pure decision: who does this embedding belong to? */
export function decide(embedding, gallery) {
  const scored = gallery
    .map((g) => ({ personId: g.personId, name: g.name, relationship: g.relationship, notes: g.notes,
      score: Math.max(...g.embeddings.map((e) => cosine(embedding, e))) }))
    .sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, 3).map(({ personId, name, relationship, score }) => ({ personId, name, relationship, score: round(score) }));
  const best = scored[0];
  if (!best) return { status: "no-people", best: null, candidates };
  const bestOut = { personId: best.personId, name: best.name, relationship: best.relationship, notes: best.notes, score: round(best.score) };
  if (best.score < THRESHOLD) return { status: "unknown", best: bestOut, candidates };
  const second = scored[1];
  if (second && second.score >= THRESHOLD && best.score - second.score < MARGIN) return { status: "unsure", best: bestOut, candidates };
  return { status: "match", best: bestOut, candidates };
}
const round = (n) => Math.round(n * 1000) / 1000;

/** Finds the largest usable face in an image and identifies it. Does not write anything. */
export async function identify(userId, buf, { minFace = MIN_FRAME_FACE } = {}) {
  const faces = await embedFaces(buf);
  const usable = faces.filter((f) => f.box[2] >= minFace);
  if (usable.length === 0) return { status: "no-face", faceCount: faces.length, best: null, candidates: [] };
  const gallery = loadGallery(userId);
  if (gallery.length === 0) return { status: "no-people", faceCount: usable.length, best: null, candidates: [] };
  return { ...decide(Float32Array.from(usable[0].embedding), gallery), faceCount: usable.length };
}

// ---------- what the badge says ----------
const sentence = (t) => (/[.!?]$/.test(t) ? t : `${t}.`);
export function speechFor(result) {
  if (result.status === "match") {
    const { name, relationship, notes } = result.best;
    const base = `This is your ${relationship.toLowerCase()}, ${name}.`;
    return notes ? `${base} ${sentence(notes)}` : base;
  }
  if (result.status === "unknown" || result.status === "unsure") return "I’m not sure who this is.";
  return null; // nobody in view, or no people set up yet
}

// ---------- recording what happened ----------
const lastLogged = new Map();
const due = (key, wait, now) => {
  if (now - (lastLogged.get(key) ?? 0) < wait) return false;
  lastLogged.set(key, now);
  return true;
};
export const _resetCooldowns = () => lastLogged.clear(); // for tests

const insertRecognition = (userId, personId, name, relationship, status, score, at) =>
  db.prepare("INSERT INTO recognitions (user_id, person_id, name, relationship, status, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(userId, personId, name, relationship, status, score, at);

/** Logs a recognition result (with cooldowns so the timeline and alerts don't flood). */
export function recordRecognition(userId, result, now = Date.now()) {
  const out = {
    status: result.status,
    speech: speechFor(result),
    person: result.status === "match" ? { id: result.best.personId, name: result.best.name, relationship: result.best.relationship } : null,
    score: result.best ? result.best.score : null,
    logged: false,
  };

  if (result.status === "match") {
    const { personId, name, relationship, score } = result.best;
    if (due(`m:${userId}:${personId}`, MATCH_COOLDOWN, now)) {
      insertRecognition(userId, personId, name, relationship, "match", score, now);
      logActivity(userId, "face", `Recognized ${name} (${relationship})`);
      out.logged = true;
    }
  } else if (result.status === "unknown" || result.status === "unsure") {
    if (due(`u:${userId}`, UNKNOWN_COOLDOWN, now)) {
      insertRecognition(userId, null, "", "", result.status, result.best ? result.best.score : null, now);
      if (result.status === "unknown") {
        createAlert(userId, { type: "face", severity: "medium", title: "Unknown person detected",
          detail: "The badge camera saw a face that isn’t in the family database." });
        logActivity(userId, "warn", "Unknown person detected");
      } else {
        logActivity(userId, "warn", "Saw a face but wasn’t sure who it was");
      }
      out.logged = true;
    }
  }
  return out;
}
