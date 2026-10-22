import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Field from "../components/Field.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import Button from "../components/Button.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { DEMO } from "../services/authService.js";
import { isValidEmail } from "../utils/validators.js";
import { storage } from "../utils/storage.js";

const MAX_ATTEMPTS = 5;
const LOCK_MS = 30000;

export default function SignIn() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const saved = storage.get("memora.email") || "";

  const [email, setEmail] = useState(saved);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(!!saved);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  const secondsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  useEffect(() => {
    if (!lockedUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  useEffect(() => {
    if (lockedUntil && secondsLeft === 0) { setLockedUntil(0); setFails(0); }
  }, [secondsLeft, lockedUntil]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (secondsLeft || busy) return;

    const next = {};
    if (!email.trim()) next.email = "Enter your email address.";
    else if (!isValidEmail(email)) next.email = "Enter a valid email, like name@example.com.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await login(email.trim(), password);
      storage.set("memora.email", remember ? email.trim() : "");
      navigate("/dashboard");
    } catch {
      const count = fails + 1;
      setFails(count);
      if (count >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCK_MS);
        setNow(Date.now());
      } else {
        const left = MAX_ATTEMPTS - count;
        setFormError(`The email or password is incorrect. ${left} ${left === 1 ? "attempt" : "attempts"} left before sign-in pauses.`);
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2>Welcome back</h2>
      <p className="lede">Sign in to check on your loved one.</p>

      {secondsLeft > 0 && (
        <div className="alert" role="alert">
          Too many incorrect attempts. Try again in {secondsLeft} seconds, or reset your password.
        </div>
      )}
      {formError && !secondsLeft && <div className="alert" role="alert">{formError}</div>}

      <Field id="email" label="Email address" error={errors.email}>
        <input id="email" type="email" value={email} autoComplete="username" inputMode="email"
          onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-err" : undefined} />
      </Field>

      <Field id="password" label="Password" error={errors.password}>
        <PasswordInput id="password" value={password} onChange={setPassword}
          error={errors.password} autoComplete="current-password" />
      </Field>

      <div className="opts">
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember my email
        </label>
        <Link className="link" to="/reset-password">Forgot password?</Link>
      </div>

      <Button type="submit" busy={busy} disabled={secondsLeft > 0}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>

      <div className="demo">
        Prototype demo login<br />
        <code>{DEMO.email}</code><br />
        <code>{DEMO.password}</code><br />
        <button type="button" className="link" onClick={() => {
          setEmail(DEMO.email); setPassword(DEMO.password); setErrors({}); setFormError("");
        }}>Fill demo login</button>
      </div>

      <p className="switch">New caregiver? <Link className="link" to="/register">Create an account</Link></p>
    </form>
  );
}
