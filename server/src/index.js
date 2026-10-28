import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { db } from "./db.js";
import { authRouter } from "./auth.js";
import { dashboardRouter } from "./dashboard.js";
import { deviceRouter } from "./device.js";
import { startMonitor } from "./monitor.js";
import { seedDemoData, seedDemoPeople } from "./seed.js";
import { peopleRouter } from "./people.js";
import { HttpError } from "./errors.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error("JWT_SECRET is missing or too short (use at least 16 characters). Exiting.");
  process.exit(1);
}

// Demo caregiver so the "Fill demo login" button works, with starter data.
if (process.env.SEED_DEMO === "true") {
  const email = "caregiver@memoraai.demo";
  if (!db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
    db.prepare("INSERT INTO users (name, email, password_hash, patient_name) VALUES (?, ?, ?, ?)")
      .run("Demo Caregiver", email, bcrypt.hashSync("Memora@123", 10), "Asha");
    console.log("Seeded demo caregiver:", email);
  }
  const demoId = db.prepare("SELECT id FROM users WHERE email = ?").get(email).id;
  seedDemoData(demoId);
  seedDemoPeople(demoId);
}

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api", dashboardRouter);
app.use("/api", deviceRouter);
app.use("/api", peopleRouter);
app.use("/api", (_req, res) => res.status(404).json({ code: "not-found", message: "Not found." }));

app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ code: err.code, message: err.message });
  if (err.status === 413 || err.type === "entity.too.large")
    return res.status(413).json({ code: "too-large", message: "That file is too large." });
  if (err.status >= 400 && err.status < 500)
    return res.status(err.status).json({ code: "invalid", message: "That request wasn’t valid." });
  console.error(err);
  res.status(500).json({ code: "server-error", message: "Something went wrong on the server." });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`MemoraAI API listening on :${port}`));
startMonitor();
