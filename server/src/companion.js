import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "./auth.js";
import { HttpError } from "./errors.js";
import * as C from "./companionStore.js";
import { finishCalm, offerCalm, startCalm } from "./calmStore.js";

const COOKIE = "memora_companion";
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.COOKIE_SECURE === "true",
  maxAge: 365 * 24 * 60 * 60 * 1000,
  path: "/",
};

const idOf = (req, name = "id") => {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n)) throw new HttpError(404, "Not found.", "not-found");
  return n;
};

// Guessing 6-digit codes must be impractical
const pairLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ code: "rate-limited", message: "Too many tries. Please wait a few minutes and try again." }),
});

/** Separate from caregiver sign-in: this cookie only opens the patient screen's small set of routes. */
function requireCompanion(req, res, next) {
  const session = C.sessionFromToken(req.cookies[COOKIE]);
  if (!session) return res.status(401).json({ code: "unpaired", message: "This screen isn’t connected." });
  req.companion = session;
  next();
}

export const companionRouter = Router();

// ---- caregiver side ----
companionRouter.post("/pairing/code", requireAuth, (req, res) => res.status(201).json(C.createPairCode(req.user.id)));
companionRouter.delete("/pairing/screens/:id", requireAuth, (req, res) => {
  C.removeScreen(req.user.id, idOf(req));
  res.json({ ok: true });
});
companionRouter.put("/settings/companion", requireAuth, (req, res) => {
  C.setCompanionSettings(req.user.id, req.body);
  res.json({ ok: true });
});

companionRouter.post("/calm/offer", requireAuth, (req, res) => res.json(offerCalm(req.user.id)));

// ---- patient screen ----
companionRouter.post("/companion/pair", pairLimiter, (req, res) => {
  const { token } = C.redeemCode(req.body?.code, Date.now(), req.get("user-agent") ?? "");
  res.cookie(COOKIE, token, cookieOptions);
  res.json({ ok: true });
});
companionRouter.get("/companion/today", requireCompanion, (req, res) => res.json(C.todayPayload(req.companion.userId)));
companionRouter.post("/companion/help", requireCompanion, (req, res) => res.json(C.requestHelp(req.companion.userId)));
companionRouter.post("/companion/medicines/:id/taken", requireCompanion, (req, res) =>
  res.json(C.confirmMedicine(req.companion.userId, idOf(req))));
companionRouter.get("/companion/photo/:personId", requireCompanion, (req, res) => {
  const photo = C.photoFor(req.companion.userId, idOf(req, "personId"));
  res.set({ "Content-Type": photo.mime, "Cache-Control": "private, max-age=3600" });
  res.send(photo.data);
});

// Calming exercises: start one, then say how they feel afterwards
companionRouter.post("/companion/calm/start", requireCompanion, (req, res) =>
  res.status(201).json(startCalm(req.companion.userId, "patient")));
companionRouter.post("/companion/calm/:id/outcome", requireCompanion, (req, res) =>
  res.json(finishCalm(req.companion.userId, idOf(req), req.body?.outcome)));
