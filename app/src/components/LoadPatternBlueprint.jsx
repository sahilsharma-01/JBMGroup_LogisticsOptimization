import { useMemo, useState } from 'react'

// ============================================================================
// LOAD PATTERN BLUEPRINT
// ----------------------------------------------------------------------------
// The printable deliverable: a scaled side elevation plus one plan view per
// stack tier, dimensioned in millimetres off the bulkhead and the left wall.
// This is the sheet that goes to the dock, so it carries real coordinates
// rather than an impression of the load.
// ============================================================================

const PAD = 56 // drawing margin in model mm, scaled with the viewBox

function shortId(huId) {
  const [order, unit] = huId.split('/')
  return `${order.split('-').pop()}·${unit}`
}

function Dim({ x1, y1, x2, y2, label, offset = 0, vertical = false }) {
  const tick = 36
  if (vertical) {
    const x = x1 + offset
    return (
      <g className="bp-dim">
        <line x1={x} y1={y1} x2={x} y2={y2} />
        <line x1={x - tick / 2} y1={y1} x2={x + tick / 2} y2={y1} />
        <line x1={x - tick / 2} y1={y2} x2={x + tick / 2} y2={y2} />
        <text x={x - 20} y={(y1 + y2) / 2} transform={`rotate(-90 ${x - 20} ${(y1 + y2) / 2})`}>{label}</text>
      </g>
    )
  }
  const y = y1 + offset
  return (
    <g className="bp-dim">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - tick / 2} x2={x1} y2={y + tick / 2} />
      <line x1={x2} y1={y - tick / 2} x2={x2} y2={y + tick / 2} />
      <text x={(x1 + x2) / 2} y={y - 14}>{label}</text>
    </g>
  )
}

export default function LoadPatternBlueprint({ plan, selectedHuId, onSelectUnit }) {
  const [labelMode, setLabelMode] = useState('unit')

  const tiers = useMemo(() => {
    if (!plan || plan.empty) return []
    const max = Math.max(1, ...plan.placements.map(p => p.tier))
    return Array.from({ length: max }, (_, i) => i + 1)
  }, [plan])

  if (!plan || plan.empty) {
    return <div className="lp-empty">Select consignment lines to produce a load pattern.</div>
  }

  const deck = plan.vehicle.deck
  const L = deck.lengthMm
  const W = deck.widthMm
  const H = deck.heightMm

  const colourOf = (p) => {
    if (plan.validation.issues.some(i => i.huId === p.huId)) return '#fecaca'
    if (p.isReturnAsset) return '#e2e8f0'
    if (p.topLoadCapacityKg === 0) return '#fef3c7'
    return '#dbeafe'
  }
  const strokeOf = (p) => {
    if (plan.validation.issues.some(i => i.huId === p.huId)) return '#dc2626'
    if (p.topLoadCapacityKg === 0) return '#d97706'
    return '#1d4ed8'
  }

  const labelOf = (p) => {
    switch (labelMode) {
      case 'part': return p.partNo.replace(/^JBM-/, '')
      case 'mass': return `${Math.round(p.grossKg)} kg`
      case 'consignee': return p.customerCode
      case 'seq': return `#${plan.loadSequence.find(s => s.huId === p.huId)?.loadSeq ?? ''}`
      default: return shortId(p.huId)
    }
  }

  return (
    <div className="bp-wrap">
      <div className="bp-head">
        <div>
          <h4>Load pattern sheet</h4>
          <p>
            {plan.vehicle.name} · clear internal {L} × {W} × {H} mm · {plan.kpi.unitsPlaced} handling units ·
            {' '}all coordinates in mm from the bulkhead (x) and the left wall (z)
          </p>
        </div>
        <div className="chip-group">
          {[['unit', 'Unit ID'], ['part', 'Part no.'], ['mass', 'Mass'], ['consignee', 'Consignee'], ['seq', 'Load seq']].map(([id, label]) => (
            <button
              key={id}
              className={`filter-chip-compact ${labelMode === id ? 'active' : ''}`}
              onClick={() => setLabelMode(id)}
            >
              {label}
            </button>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {/* ---------- side elevation ---------- */}
      <div className="bp-sheet">
        <div className="bp-sheet-title">
          <strong>Side elevation</strong>
          <span>Looking at the left (driver) side · bulkhead on the left, doors on the right</span>
        </div>
        <svg
          className="bp-svg"
          viewBox={`${-PAD * 2} ${-PAD * 2} ${L + PAD * 4} ${H + PAD * 4.5}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* body envelope */}
          <rect x={0} y={0} width={L} height={H} className="bp-envelope" />
          {/* deck */}
          <line x1={0} y1={H} x2={L} y2={H} className="bp-deck" />

          {/* bay grid */}
          {Array.from({ length: Math.ceil(L / 1200) }, (_, i) => (
            <g key={i}>
              <line x1={(i + 1) * 1200} y1={0} x2={(i + 1) * 1200} y2={H} className="bp-grid" />
              <text x={i * 1200 + 600} y={H + 46} className="bp-bay">B{String(i + 1).padStart(2, '0')}</text>
            </g>
          ))}

          {/* CoG window band */}
          <rect
            x={(plan.distribution.cogWindowPct[0] / 100) * L}
            y={0}
            width={((plan.distribution.cogWindowPct[1] - plan.distribution.cogWindowPct[0]) / 100) * L}
            height={H}
            className="bp-cog-window"
          />

          {/* units, drawn bottom-up so upper tiers read on top */}
          {[...plan.placements].sort((a, b) => a.y - b.y).map(p => (
            <g
              key={p.huId}
              className={`bp-unit ${selectedHuId === p.huId ? 'sel' : ''}`}
              onClick={() => onSelectUnit(p.huId)}
            >
              <rect
                x={p.x}
                y={H - p.y - p.h}
                width={p.l}
                height={p.h}
                fill={colourOf(p)}
                stroke={strokeOf(p)}
              />
              {p.l > 700 && p.h > 280 && (
                <text x={p.x + p.l / 2} y={H - p.y - p.h / 2} className="bp-label">{labelOf(p)}</text>
              )}
            </g>
          ))}

          {/* axle centrelines */}
          {plan.vehicle.axleGroups.map(ax => {
            const axle = plan.distribution.axles.find(a => a.id === ax.id)
            const over = axle && !axle.compliant
            return (
              <g key={ax.id} className={`bp-axle ${over ? 'over' : ''}`}>
                <line x1={ax.xMm} y1={-PAD} x2={ax.xMm} y2={H + 70} />
                <circle cx={ax.xMm} cy={H + 70} r={26} />
                <text x={ax.xMm} y={H + 150}>
                  {ax.id.toUpperCase()} {axle ? `${axle.loadKg.toLocaleString('en-IN')} kg` : ''}
                </text>
                <text x={ax.xMm} y={H + 200} className="bp-axle-sub">
                  {axle ? `${axle.utilPct.toFixed(0)}% of ${axle.limitKg.toLocaleString('en-IN')}` : ''}
                </text>
              </g>
            )
          })}

          {/* CoG */}
          <g className={`bp-cog ${plan.distribution.cogInWindow ? '' : 'bad'}`}>
            <line x1={plan.distribution.cogXMm} y1={0} x2={plan.distribution.cogXMm} y2={H} />
            <circle
              cx={plan.distribution.cogXMm}
              cy={H - (plan.distribution.cargoCogHeightMm - plan.vehicle.geometry.deckHeightMm)}
              r={44}
            />
            <text x={plan.distribution.cogXMm} y={-20}>
              CoG {plan.distribution.cogFractionPct.toFixed(1)}%
            </text>
          </g>

          <Dim x1={0} y1={0} x2={L} y2={0} offset={-62} label={`${L} mm clear length`} />
          <Dim x1={0} y1={0} x2={0} y2={H} offset={-62} vertical label={`${H} mm clear height`} />
          <Dim
            x1={0}
            y1={H - plan.capacity.maxStackHeightMm}
            x2={L}
            y2={H - plan.capacity.maxStackHeightMm}
            offset={0}
            label={`loaded to ${plan.capacity.maxStackHeightMm} mm · ${plan.capacity.heightHeadroomMm} mm headroom`}
          />
        </svg>
      </div>

      {/* ---------- plan view per tier ---------- */}
      {tiers.map(tier => {
        const units = plan.placements.filter(p => p.tier === tier)
        const tierMass = units.reduce((s, p) => s + p.grossKg, 0)
        return (
          <div className="bp-sheet" key={tier}>
            <div className="bp-sheet-title">
              <strong>Plan view — tier {tier}</strong>
              <span>
                {units.length} units · {Math.round(tierMass).toLocaleString('en-IN')} kg ·
                {' '}seated at y = {units.length ? Math.min(...units.map(u => u.y)) : 0}–{units.length ? Math.max(...units.map(u => u.y + u.h)) : 0} mm
              </span>
            </div>
            <svg
              className="bp-svg"
              viewBox={`${-PAD * 2} ${-PAD * 2.5} ${L + PAD * 4} ${W + PAD * 5}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <rect x={0} y={0} width={L} height={W} className="bp-envelope" />

              {Array.from({ length: Math.ceil(L / 1200) }, (_, i) => (
                <g key={i}>
                  <line x1={(i + 1) * 1200} y1={0} x2={(i + 1) * 1200} y2={W} className="bp-grid" />
                  <text x={i * 1200 + 600} y={W + 46} className="bp-bay">B{String(i + 1).padStart(2, '0')}</text>
                </g>
              ))}
              {[1, 2].map(i => (
                <line key={i} x1={0} y1={(W / 3) * i} x2={L} y2={(W / 3) * i} className="bp-grid" />
              ))}
              {['L', 'C', 'R'].map((r, i) => (
                <text key={r} x={-24} y={(W / 3) * (i + 0.5)} className="bp-row">{r}</text>
              ))}

              {/* ghost of the tier below for alignment */}
              {tier > 1 && plan.placements.filter(p => p.tier === tier - 1).map(p => (
                <rect key={`g-${p.huId}`} x={p.x} y={p.z} width={p.l} height={p.w} className="bp-ghost" />
              ))}

              {units.map(p => (
                <g
                  key={p.huId}
                  className={`bp-unit ${selectedHuId === p.huId ? 'sel' : ''}`}
                  onClick={() => onSelectUnit(p.huId)}
                >
                  <rect x={p.x} y={p.z} width={p.l} height={p.w} fill={colourOf(p)} stroke={strokeOf(p)} />
                  <text x={p.x + p.l / 2} y={p.z + p.w / 2 - 30} className="bp-label">{labelOf(p)}</text>
                  <text x={p.x + p.l / 2} y={p.z + p.w / 2 + 60} className="bp-coord">
                    x{p.x} z{p.z}{p.rotated ? ' ↻' : ''}
                  </text>
                </g>
              ))}

              {/* largest remaining free block */}
              {tier === 1 && plan.capacity.largestFreeFloorRect.areaM2 > 0.2 && (
                <g className="bp-free">
                  <rect
                    x={plan.capacity.largestFreeFloorRect.x}
                    y={plan.capacity.largestFreeFloorRect.z}
                    width={plan.capacity.largestFreeFloorRect.l}
                    height={plan.capacity.largestFreeFloorRect.w}
                  />
                  <text
                    x={plan.capacity.largestFreeFloorRect.x + plan.capacity.largestFreeFloorRect.l / 2}
                    y={plan.capacity.largestFreeFloorRect.z + plan.capacity.largestFreeFloorRect.w / 2}
                  >
                    FREE {plan.capacity.largestFreeFloorRect.l}×{plan.capacity.largestFreeFloorRect.w}
                  </text>
                </g>
              )}

              {/* lateral CoG */}
              <g className={`bp-cog ${plan.distribution.lateralBalanced ? '' : 'bad'}`}>
                <line x1={0} y1={W / 2 + plan.distribution.cogLateralMm} x2={L} y2={W / 2 + plan.distribution.cogLateralMm} />
                <circle cx={plan.distribution.cogXMm} cy={W / 2 + plan.distribution.cogLateralMm} r={44} />
              </g>

              <Dim x1={0} y1={0} x2={L} y2={0} offset={-62} label={`${L} mm`} />
              <Dim x1={0} y1={0} x2={0} y2={W} offset={-62} vertical label={`${W} mm clear width`} />
            </svg>
          </div>
        )
      })}

      <div className="bp-key">
        <span><i style={{ background: '#dbeafe', borderColor: '#1d4ed8' }} /> Stackable packaging</span>
        <span><i style={{ background: '#fef3c7', borderColor: '#d97706' }} /> Zero superimposed load — do not stack</span>
        <span><i style={{ background: '#e2e8f0', borderColor: '#64748b' }} /> Collapsed returnable, backhaul</span>
        <span><i style={{ background: '#fecaca', borderColor: '#dc2626' }} /> Validation exception</span>
        <span>↻ loaded turned 90°</span>
      </div>
    </div>
  )
}
