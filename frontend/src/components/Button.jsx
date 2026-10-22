export default function Button({ busy, variant, children, disabled, ...props }) {
  return (
    <button className={`btn ${variant || ""}`} disabled={busy || disabled} {...props}>
      {busy && <span className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
