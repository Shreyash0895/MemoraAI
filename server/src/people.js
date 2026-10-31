import express, { Router } from "express";
import { requireAuth } from "./auth.js";
import { HttpError } from "./errors.js";
import { checkPhotoAllowed, createPerson, deletePerson, deletePhoto, getPhoto, insertPhoto, listPeople, updatePerson } from "./peopleStore.js";
import { MIN_FRAME_FACE, THRESHOLD, analyzePhoto, faceServiceStatus, identify, speechFor } from "./recognition.js";

const idParam = (req, name = "id") => {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n)) throw new HttpError(404, "Not found.", "not-found");
  return n;
};

// Photos arrive as raw image bytes (the browser resizes them first)
const rawImage = express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "3mb" });

export const peopleRouter = Router();
peopleRouter.use("/people", requireAuth);

peopleRouter.get("/people", (req, res) => res.json(listPeople(req.user.id)));
peopleRouter.post("/people", (req, res) => res.status(201).json(createPerson(req.user.id, req.body)));
peopleRouter.put("/people/:id", (req, res) => res.json(updatePerson(req.user.id, idParam(req), req.body)));
peopleRouter.delete("/people/:id", (req, res) => {
  deletePerson(req.user.id, idParam(req));
  res.json({ ok: true });
});

// Is the face service running? (the People page shows a notice if not)
peopleRouter.get("/people/face-status", async (_req, res) => res.json({ available: await faceServiceStatus(), threshold: THRESHOLD }));

// Try the recognizer with any photo. Writes nothing (no alerts, no timeline entries).
peopleRouter.post("/people/recognize-test", rawImage, async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(415, "Use a JPG, PNG or WebP photo.", "unsupported");
    const r = await identify(req.user.id, req.body, { minFace: MIN_FRAME_FACE });
    res.json({ status: r.status, faceCount: r.faceCount, threshold: THRESHOLD, best: r.best, candidates: r.candidates, speech: speechFor(r) });
  } catch (e) { next(e); }
});

// Adding a photo checks it has exactly one clear face (if the face service is down it is saved and checked later)
peopleRouter.post("/people/:id/photos", rawImage, async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0)
      throw new HttpError(415, "Use a JPG, PNG or WebP photo.", "unsupported");
    const personId = idParam(req);
    const mime = checkPhotoAllowed(req.user.id, personId, req.body);
    const analysis = await analyzePhoto(req.body);
    res.status(201).json(insertPhoto(personId, mime, req.body, analysis));
  } catch (e) { next(e); }
});

peopleRouter.get("/people/:id/photos/:photoId", (req, res) => {
  const photo = getPhoto(req.user.id, idParam(req), idParam(req, "photoId"));
  res.set({ "Content-Type": photo.mime, "Cache-Control": "private, max-age=86400" });
  res.send(photo.data);
});

peopleRouter.delete("/people/:id/photos/:photoId", (req, res) => {
  deletePhoto(req.user.id, idParam(req), idParam(req, "photoId"));
  res.json({ ok: true });
});
