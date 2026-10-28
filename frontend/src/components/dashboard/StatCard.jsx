export default function StatCard({ label, value, hint, tone = "", icon }) {
  return (
    <div className={`panel stat ${tone}`}>
      <div className="stat-top"><span>{label}</span>{icon}</div>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}
