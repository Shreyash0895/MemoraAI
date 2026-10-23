const W = 420, H = 190, P = { l: 34, r: 10, t: 14, b: 28 };

function Axes({ data, max, unit }) {
  const ticks = [0, max / 2, max];
  const y = (v) => P.t + (H - P.t - P.b) * (1 - v / max);
  return ticks.map((t) => (
    <g key={t}>
      <line className="ch-grid" x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} />
      <text className="ch-txt" x={P.l - 6} y={y(t) + 4} textAnchor="end">{Math.round(t)}{unit}</text>
    </g>
  ));
}

export function BarChart({ data, max, unit = "", label }) {
  const top = max || Math.max(...data.map((d) => d.value), 1) * 1.2;
  const bw = (W - P.l - P.r) / data.length;
  const y = (v) => P.t + (H - P.t - P.b) * (1 - v / top);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`${label}: ${data.map((d) => `${d.label} ${d.value}${unit}`).join(", ")}`}>
      <Axes data={data} max={top} unit={unit} />
      {data.map((d, i) => (
        <g key={d.label}>
          <rect className="ch-bar" x={P.l + i * bw + bw * 0.2} width={bw * 0.6} y={y(d.value)}
            height={H - P.b - y(d.value)} rx="4" />
          <text className="ch-txt" x={P.l + i * bw + bw / 2} y={H - 9} textAnchor="middle">{d.label}</text>
        </g>
      ))}
    </svg>
  );
}

export function LineChart({ data, unit = "", label }) {
  const top = Math.max(...data.map((d) => d.value), 10) * 1.25;
  const step = (W - P.l - P.r) / (data.length - 1);
  const pts = data.map((d, i) => [P.l + i * step, P.t + (H - P.t - P.b) * (1 - d.value / top)]);
  const path = pts.map((p) => p.join(",")).join(" ");
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`${label}: ${data.map((d) => `${d.label} ${d.value}${unit}`).join(", ")}`}>
      <Axes data={data} max={top} unit={unit} />
      <polygon className="ch-area" points={`${P.l},${H - P.b} ${path} ${W - P.r},${H - P.b}`} />
      <polyline className="ch-line" points={path} />
      {pts.map((p, i) => (
        <g key={data[i].label}>
          <circle className="ch-dot" cx={p[0]} cy={p[1]} r="4" />
          <text className="ch-txt" x={p[0]} y={H - 9} textAnchor="middle">{data[i].label}</text>
        </g>
      ))}
    </svg>
  );
}
