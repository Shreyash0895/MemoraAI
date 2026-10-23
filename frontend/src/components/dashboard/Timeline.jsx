import { clock } from "../../utils/format.js";

export default function Timeline({ items }) {
  if (!items.length) return <p className="empty">No activity yet today.</p>;
  return (
    <ul className="tl">
      {items.map((e) => (
        <li key={e.id}>
          <span className={`tl-dot k-${e.kind}`} aria-hidden="true" />
          <div><strong>{e.text}</strong><small>{clock(e.at)}</small></div>
        </li>
      ))}
    </ul>
  );
}
