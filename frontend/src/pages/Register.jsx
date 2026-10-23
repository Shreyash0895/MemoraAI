import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Field from "../components/Field.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import Button from "../components/Button.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { isValidEmail, isStrongPassword, passwordStrength } from "../utils/validators.js";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", patient: "", email: "", password: "", confirm: "", consent: false });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const strength = passwordStrength(form.password);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    const next = {};
    if (!form.name.trim()) next.name = "Enter your full name.";
    if (!form.patient.trim()) next.patient = "Enter the patient’s first name.";
    if (!isValidEmail(form.email)) next.email = "Enter a valid email, like name@example.com.";
    if (!isStrongPassword(form.password)) next.password = "Use at least 8 characters, with letters and numbers.";
    if (form.confirm !== form.password) next.confirm = "The passwords don’t match.";
    if (!form.consent) next.consent = "Confirm this to continue.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    await register({ name: form.name.trim(), email: form.email.trim(), patient: form.patient.trim() });
    navigate("/dashboard");
  }

  const textField = (id, label, key, { type = "text", autoComplete, hint } = {}) => (
    <Field id={id} label={label} error={errors[key]} hint={hint}>
      <input id={id} type={type} value={form[key]} autoComplete={autoComplete}
        onChange={(e) => set(key)(e.target.value)} aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `${id}-err` : undefined} />
    </Field>
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2>Create caregiver account</h2>
      <p className="lede">Set up access to your loved one’s MemoraAI badge.</p>

      {textField("name", "Your full name", "name", { autoComplete: "name" })}
      {textField("patient", "Patient’s first name", "patient", { hint: "You’ll link their badge after signing in." })}
      {textField("email", "Email address", "email", { type: "email", autoComplete: "email" })}

      <Field id="password" label="Password" error={errors.password}>
        <PasswordInput id="password" value={form.password} onChange={set("password")}
          error={errors.password} autoComplete="new-password" />
        <div className="meter" aria-hidden="true">
          {[1, 2, 3].map((n) => <i key={n} className={strength >= n ? `on${strength}` : ""} />)}
        </div>
      </Field>

      <Field id="confirm" label="Confirm password" error={errors.confirm}>
        <PasswordInput id="confirm" value={form.confirm} onChange={set("confirm")}
          error={errors.confirm} autoComplete="new-password" />
      </Field>

      <div className="field">
        <label className="check">
          <input type="checkbox" checked={form.consent} onChange={(e) => set("consent")(e.target.checked)} />
          I’m this patient’s caregiver, or their family has agreed I can see their location and activity.
        </label>
        {errors.consent && <p className="err" role="alert">{errors.consent}</p>}
      </div>

      <Button type="submit" busy={busy}>{busy ? "Creating account…" : "Create account"}</Button>
      <p className="switch">Already have an account? <Link className="link" to="/login">Sign in</Link></p>
    </form>
  );
}
