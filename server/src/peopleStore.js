/*
 * Family and friends the badge should recognize: names, relationships and photos.
 * Kept free of Express so the face-recognition service can reuse it later.
 */
import { db } from "./db.js";
import { HttpError } from "./errors.js";

export const LIMITS = { people: 30, photos: 5 };

const required = (v, max) => {
  const s = String(v ?? "").trim();
  return s && s.length <= max ? s : null;
};

/** Identifies the image by its first bytes (we don't trust the Content-Type header). */
export function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString("latin1") === "PNG" && buf[4] === 0x0d && buf[5] === 0x0a) return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

function validate(input) {
  const name = required(input?.name, 80);
  const relationship = required(input?.relationship, 40);
  const notes = String(input?.notes ?? "").trim();
  if (!name) throw new HttpError(400, "Enter the person’s name.");
  if (!relationship) throw new HttpError(400, "Enter how they’re related, like son or friend.");
  if (notes.length > 200) throw new HttpError(400, "Keep the note under 200 characters.");
  return { name, relationship, notes };
}

function ownPerson(userId, id) {
  const row = Number.isInteger(id) ? db.prepare("SELECT id FROM people WHERE id = ? AND user_id = ?").get(id, userId) : null;
  if (!row) throw new HttpError(404, "Not found.", "not-found");
  return row;
}

const photosOf = (personId) =>
  db.prepare("SELECT id, face_status AS status FROM person_photos WHERE person_id = ? ORDER BY id").all(personId);

export function listPeople(userId) {
  const people = db
    .prepare("SELECT id, name, relationship, notes FROM people WHERE user_id = ? ORDER BY name COLLATE NOCASE, id")
    .all(userId);
  const photos = db
    .prepare(`SELECT ph.id, ph.face_status AS status, ph.person_id FROM person_photos ph
              JOIN people p ON p.id = ph.person_id WHERE p.user_id = ? ORDER BY ph.id`)
    .all(userId);
  const byPerson = new Map(people.map((p) => [p.id, []]));
  for (const ph of photos) byPerson.get(ph.person_id)?.push({ id: ph.id, status: ph.status });
  return people.map((p) => ({ ...p, photos: byPerson.get(p.id) }));
}

export function createPerson(userId, input) {
  const v = validate(input);
  if (db.prepare("SELECT COUNT(*) AS c FROM people WHERE user_id = ?").get(userId).c >= LIMITS.people)
    throw new HttpError(400, `You can add up to ${LIMITS.people} people.`);
  const info = db
    .prepare("INSERT INTO people (user_id, name, relationship, notes, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(userId, v.name, v.relationship, v.notes, Date.now());
  return { id: Number(info.lastInsertRowid), ...v, photos: [] };
}

export function updatePerson(userId, id, input) {
  ownPerson(userId, id);
  const v = validate(input);
  db.prepare("UPDATE people SET name = ?, relationship = ?, notes = ? WHERE id = ?").run(v.name, v.relationship, v.notes, id);
  return { id, ...v, photos: photosOf(id) };
}

export function deletePerson(userId, id) {
  ownPerson(userId, id);
  db.prepare("DELETE FROM people WHERE id = ?").run(id); // photos are removed by ON DELETE CASCADE
}

/** Cheap checks before the (slower) face analysis: ownership, image type, photo limit. */
export function checkPhotoAllowed(userId, personId, buf) {
  ownPerson(userId, personId);
  const mime = sniffImage(buf);
  if (!mime) throw new HttpError(415, "Use a JPG, PNG or WebP photo.", "unsupported");
  if (db.prepare("SELECT COUNT(*) AS c FROM person_photos WHERE person_id = ?").get(personId).c >= LIMITS.photos)
    throw new HttpError(400, `You can add up to ${LIMITS.photos} photos per person.`);
  return mime;
}

/** analysis = { status: "ok" | "pending", embedding: Buffer | null } from recognition.analyzePhoto */
export function insertPhoto(personId, mime, buf, analysis) {
  const info = db
    .prepare("INSERT INTO person_photos (person_id, mime, data, face_status, embedding, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(personId, mime, buf, analysis.status, analysis.embedding ?? null, Date.now());
  return { id: Number(info.lastInsertRowid), status: analysis.status };
}

export function addPhoto(userId, personId, buf, analysis = { status: "pending", embedding: null }) {
  return insertPhoto(personId, checkPhotoAllowed(userId, personId, buf), buf, analysis);
}

export function getPhoto(userId, personId, photoId) {
  ownPerson(userId, personId);
  const row = Number.isInteger(photoId)
    ? db.prepare("SELECT mime, data FROM person_photos WHERE id = ? AND person_id = ?").get(photoId, personId)
    : null;
  if (!row) throw new HttpError(404, "Not found.", "not-found");
  return { mime: row.mime, data: Buffer.from(row.data) };
}

export function deletePhoto(userId, personId, photoId) {
  ownPerson(userId, personId);
  const info = Number.isInteger(photoId)
    ? db.prepare("DELETE FROM person_photos WHERE id = ? AND person_id = ?").run(photoId, personId)
    : { changes: 0 };
  if (!info.changes) throw new HttpError(404, "Not found.", "not-found");
}
