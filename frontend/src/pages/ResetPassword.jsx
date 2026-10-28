import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Field from "../components/Field.jsx";
import Button from "../components/Button.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { isValidEmail } from "../utils/validators.js";

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    if (!isValidEmail(email)) { setError("Enter the email you signed up with."); return; }
    setError("");
    setBusy(true);
    await resetPassword(email.trim());
    setBusy(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div>
        <h2>Check your email</h2>
        <p className="lede">If an account exists for {email.trim()}, a reset link is on its way. It can take a few minutes.</p>
        <Button variant="ghost" onClick={() => navigate("/login")}>Back to sign in</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2>Reset your password</h2>
      <p className="lede">Enter your email and we’ll send you a link to choose a new password.</p>
      <Field id="reset-email" label="Email address" error={error}>
        <input id="reset-email" type="email" value={email} autoComplete="email"
          onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error}
          aria-describedby={error ? "reset-email-err" : undefined} />
      </Field>
      <Button type="submit" busy={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
      <p className="switch"><Link className="link" to="/login">Back to sign in</Link></p>
    </form>
  );
}
