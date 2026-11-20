// ============================================================================
// Chart primitives — plain SVG, no chart library.
// Everything is drawn in a fixed model viewBox and scaled by CSS, so the charts
// stay sharp, print correctly on the load sheet, and cost nothing to render.
// ============================================================================

const W = 1000; // model width for every chart (uniform scaling keeps text undistorted)

export function Histogram({
  bins, limit = null, nominal = null, p99 = null,
  height = 150, unit = '', colour = '#0284c7',
}) {
  if (!bins?.length) return null;
  const maxCount = Math.max(...bins.map(b => b.count));
  const x0 = bins[0].x0;
  const x1 = bins[bins.length - 1].x1;
  const span = x1 - x0 || 1;
  const sx = (v) => ((v - x0) / span) * W;
  const sy = (c) => height - (c / maxCount) * (height - 18);

  // a limit outside the sampled range still has to be communicated
  const limitInRange = limit !== null && limit >= x0 && limit <= x1;

  return (
    <div className="ch">
      <svg viewBox={`0 0 ${W} ${height + 26}`} className="ch-svg">
        {bins.map((b, i) => (
          <rect
            key={i}
            x={sx(b.x0)}
            y={sy(b.count)}
            width={Math.max(sx(b.x1) - sx(b.x0) - 2, 1)}
            height={height - sy(b.count)}
            fill={colour}
            opacity={0.75}
          />
        ))}
        <line x1={0} y1={height} x2={W} y2={height} className="ch-axis" />
        {nominal !== null && nominal >= x0 && nominal <= x1 && (
          <g className="ch-marker nominal">
            <line x1={sx(nominal)} y1={0} x2={sx(nominal)} y2={height} />
            <text x={sx(nominal)} y={12}>declared</text>
          </g>
        )}
        {p99 !== null && p99 >= x0 && p99 <= x1 && (
          <g className="ch-marker p99">
            <line x1={sx(p99)} y1={0} x2={sx(p99)} y2={height} />
            <text x={sx(p99)} y={12}>p99</text>
          </g>
        )}
        {limitInRange && (
          <g className="ch-marker limit">
            <line x1={sx(limit)} y1={0} x2={sx(limit)} y2={height} />
            <text x={sx(limit)} y={12}>limit</text>
          </g>
        )}
        <text x={2} y={height + 20} className="ch-tick" textAnchor="start">
          {Math.round(x0).toLocaleString('en-IN')}{unit}
        </text>
        <text x={W - 2} y={height + 20} className="ch-tick" textAnchor="end">
          {Math.round(x1).toLocaleString('en-IN')}{unit}
        </text>
      </svg>
      {!limitInRange && limit !== null && (
        <span className="ch-note">
          Limit {Math.round(limit).toLocaleString('en-IN')}{unit} is off-scale — the whole
          distribution sits {limit > x1 ? 'below' : 'above'} it.
        </span>
      )}
    </div>
  );
}

/**
 * Axle influence lines with the actual mass-per-bay profile behind them.
 * Reading: the bars say where the mass is, the lines say what a kilogram in
 * that bay does to each axle. Where a line goes below zero, mass in that bay
 * unloads the steer axle instead of loading the drive.
 */
export function InfluenceChart({ influence, profile, axles, height = 190 }) {
  if (!influence?.points?.length) return null;
  const L = influence.points[influence.points.length - 1].xMm || 1;
  const ids = influence.ids;
  const COLOURS = { steer: '#dc2626', drive: '#1d4ed8', trailer: '#0891b2' };

  const allC = influence.points.flatMap(p => ids.map(id => p[id] ?? 0));
  const cMin = Math.min(0, ...allC);
  const cMax = Math.max(1, ...allC);
  const cSpan = cMax - cMin || 1;

  const sx = (x) => (x / L) * W;
  const sy = (c) => height - ((c - cMin) / cSpan) * (height - 20) - 10;
  const zeroY = sy(0);

  const maxBayMass = Math.max(1, ...(profile?.bays || []).map(b => b.massKg));

  return (
    <div className="ch">
      <svg viewBox={`0 0 ${W} ${height + 28}`} className="ch-svg">
        {/* mass per bay */}
        {(profile?.bays || []).map(b => {
          const bh = (b.massKg / maxBayMass) * (height - 24);
          return (
            <rect
              key={b.bay}
              x={sx(b.x0) + 1}
              y={height - bh}
              width={Math.max(sx(b.x1) - sx(b.x0) - 2, 1)}
              height={bh}
              fill="#cbd5e1"
              opacity={0.85}
            />
          );
        })}

        {/* zero line: the sign change is the whole point */}
        <line x1={0} y1={zeroY} x2={W} y2={zeroY} className="ch-zero" />

        {ids.map(id => (
          <polyline
            key={id}
            className="ch-line"
            stroke={COLOURS[id] || '#64748b'}
            points={influence.points.map(p => `${sx(p.xMm)},${sy(p[id] ?? 0)}`).join(' ')}
          />
        ))}

        {/* where the steer coefficient crosses zero */}
        {influence.steerZeroXMm !== null && (
          <g className="ch-marker limit">
            <line x1={sx(influence.steerZeroXMm)} y1={0} x2={sx(influence.steerZeroXMm)} y2={height} />
            <text x={sx(influence.steerZeroXMm)} y={12}>
              steer unloads beyond {(influence.steerZeroXMm / 1000).toFixed(2)} m
            </text>
          </g>
        )}

        <line x1={0} y1={height} x2={W} y2={height} className="ch-axis" />
        <text x={2} y={height + 22} className="ch-tick" textAnchor="start">bulkhead</text>
        <text x={W / 2} y={height + 22} className="ch-tick" textAnchor="middle">
          {(L / 2000).toFixed(1)} m
        </text>
        <text x={W - 2} y={height + 22} className="ch-tick" textAnchor="end">doors</text>
      </svg>
      <div className="ch-legend">
        {ids.map(id => (
          <span key={id}>
            <i style={{ background: COLOURS[id] || '#64748b' }} />
            {axles?.find(a => a.id === id)?.label || id}
          </span>
        ))}
        <span><i style={{ background: '#cbd5e1' }} />mass per bay</span>
      </div>
    </div>
  );
}

/** Constraint tightness: every limit on one normalised scale. */
export function TightnessBars({ rows, onPick }) {
  return (
    <div className="tb">
      {rows.map(r => {
        const pct = Math.min(r.utilPct, 135);
        const tone = r.utilPct > 100 ? 'bad' : r.utilPct >= 90 ? 'warn' : r.utilPct >= 70 ? 'mid' : 'ok';
        return (
          <div className="tb-row" key={r.id} onClick={() => onPick && onPick(r)}>
            <span className="tb-label">{r.label}</span>
            <div className="tb-track">
              <div className={`tb-fill ${tone}`} style={{ width: `${(pct / 135) * 100}%` }} />
              <div className="tb-limit" style={{ left: `${(100 / 135) * 100}%` }} />
            </div>
            <span className={`tb-pct ${tone}`}>{r.utilPct.toFixed(0)}%</span>
            <span className="tb-slack">{r.slack}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Solver candidates as packing quality against axle margin. */
export function ParetoScatter({ points, chosenLabel, height = 190 }) {
  if (!points?.length) return null;
  const xs = points.map(p => p.compactnessPct);
  const ys = points.map(p => p.axleMarginPct);
  const xMin = Math.min(...xs) - 1;
  const xMax = Math.max(...xs) + 1;
  const yMin = Math.min(...ys) - 2;
  const yMax = Math.max(...ys) + 2;
  const sx = (v) => ((v - xMin) / (xMax - xMin || 1)) * (W - 60) + 40;
  const sy = (v) => height - ((v - yMin) / (yMax - yMin || 1)) * (height - 26) - 14;

  return (
    <div className="ch">
      <svg viewBox={`0 0 ${W} ${height + 30}`} className="ch-svg">
        <line x1={40} y1={height} x2={W} y2={height} className="ch-axis" />
        <line x1={40} y1={0} x2={40} y2={height} className="ch-axis" />
        {points.map((p, i) => {
          const chosen = p.label === chosenLabel;
          return (
            <g key={i}>
              <circle
                cx={sx(p.compactnessPct)}
                cy={sy(p.axleMarginPct)}
                r={chosen ? 13 : p.dominated ? 5 : 8}
                className={`pt ${chosen ? 'chosen' : ''} ${p.feasible ? 'feasible' : 'infeasible'} ${p.dominated ? 'dominated' : 'frontier'}`}
              />
              {chosen && (
                <text x={sx(p.compactnessPct) + 18} y={sy(p.axleMarginPct) + 5} className="ch-tick">
                  selected
                </text>
              )}
            </g>
          );
        })}
        <text x={W - 2} y={height + 24} className="ch-tick" textAnchor="end">packing compactness →</text>
        <text x={6} y={12} className="ch-tick" textAnchor="start">↑ axle margin</text>
      </svg>
      <div className="ch-legend">
        <span><i className="pt-key frontier" />on the frontier</span>
        <span><i className="pt-key dominated" />dominated</span>
        <span><i className="pt-key infeasible" />infeasible</span>
      </div>
    </div>
  );
}

/** A compact labelled statistic with an optional distribution strip. */
export function StatTile({ label, value, unit, sub, tone = '', wide = false }) {
  return (
    <div className={`st ${tone} ${wide ? 'wide' : ''}`}>
      <span className="st-label">{label}</span>
      <strong className="st-value">
        {value}
        {unit && <small>{unit}</small>}
      </strong>
      {sub && <span className="st-sub">{sub}</span>}
    </div>
  );
}

/** Horizontal stacked proportion bar, used for mass by consignee / tier. */
export function ShareBar({ segments, height = 18 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="sb" style={{ height }}>
      {segments.map((s, i) => (
        <div
          key={i}
          className="sb-seg"
          style={{ width: `${(s.value / total) * 100}%`, background: s.colour }}
          title={`${s.label}: ${s.value.toFixed(0)}`}
        >
          {(s.value / total) > 0.1 && <span>{s.label}</span>}
        </div>
      ))}
    </div>
  );
}
