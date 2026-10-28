import express, { Router } from "express";
import { requireAuth } from "./auth.js";
import { HttpError } from "./errors.js";
import { addPhoto, createPerson, deletePerson, deletePhoto, getPhoto, listPeople, updatePerson } from "./peopleStore.js";

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

peopleRouter.post("/people/:id/photos", rawImage, (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0)
    throw new HttpError(415, "Use a JPG, PNG or WebP photo.", "unsupported");
  res.status(201).json(addPhoto(req.user.id, idParam(req), req.body));
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
