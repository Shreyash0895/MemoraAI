import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { db, publicUser } from "./db.js";

const SECRET = process.env.JWT_SECRET;
const COOKIE = "memora_session";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Used to keep response time similar when the email doesn't exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.COOKIE_SECURE === "true",
  maxAge: WEEK_MS,
  path: "/",
};

const fail = (res, status, code, message) => res.status(status).json({ code, message });
const startSession = (res, user) =>
  res.cookie(COOKIE, jwt.sign({ sub: user.id }, SECRET, { expiresIn: "7d" }), cookieOptions);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => fail(res, 429, "rate-limited", "Too many attempts. Please wait a few minutes and try again."),
});

export function requireAuth(req, res, next) {
  try {
    const { sub } = jwt.verify(req.cookies[COOKIE], SECRET);
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(sub);
    if (!row) throw new Error("no user");
    req.user = publicUser(row);
    next();
  } catch {
    fail(res, 401, "unauthenticated", "Please sign in.");
  }
}

export const authRouter = Router();

authRouter.post("/register", limiter, async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const patient = String(req.body?.patient ?? "").trim();
  const email = String(req.body?.email ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (!name || name.length > 80) return fail(res, 400, "invalid-name", "Enter your full name.");
  if (!patient || patient.length > 80) return fail(res, 400, "invalid-patient", "Enter the patient’s first name.");
  if (!EMAIL_RE.test(email) || email.length > 254) return fail(res, 400, "invalid-email", "Enter a valid email address.");
  if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    return fail(res, 400, "weak-password", "Use at least 8 characters, with letters and numbers.");

  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email))
    return fail(res, 409, "email-in-use", "An account with this email already exists. Try signing in.");

  const hash = await bcrypt.hash(password, 10);
  const info = db
    .prepare("INSERT INTO users (name, email, password_hash, patient_name) VALUES (?, ?, ?, ?)")
    .run(name, email, hash, patient);
  const user = publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid));

  startSession(res, user);
  res.status(201).json({ user });
});

authRouter.post("/login", limiter, async (req, res) => {
  const email = String(req.body?.email ?? "").trim();
  const password = String(req.body?.password ?? "");

  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !ok) return fail(res, 401, "invalid-credentials", "The email or password is incorrect.");

  const user = publicUser(row);
  startSession(res, user);
  res.json({ user });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

// Email delivery isn't set up yet, so this only validates and responds generically.
authRouter.post("/reset-password", limiter, (req, res) => {
  const email = String(req.body?.email ?? "").trim();
  if (!EMAIL_RE.test(email)) return fail(res, 400, "invalid-email", "Enter a valid email address.");
  res.json({ ok: true });
});
