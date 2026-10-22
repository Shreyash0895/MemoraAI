import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./Icons.jsx";

export default function PasswordInput({ id, value, onChange, error, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
      />
      <button type="button" className="eye" onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
