import { TightnessBars } from './Charts'
import { inr, kg } from './format'

// ============================================================================
// INTELLIGENCE RAIL
// ----------------------------------------------------------------------------
// Always on screen, never scrolled past. Answers the three questions a planner
// has in front of a load plan: can I send it, what is stopping me, and what
// should I do next. Everything here is synthesised from the engine output —
// the rail holds no logic of its own.
// ============================================================================

const KIND_LABEL = {
  blocker: 'Blocker',
  risk: 'Risk',
  opportunity: 'Opportunity',
  tuning: 'Tuning',
  clear: 'Clear',
}

export default function IntelligenceRail({
  plan, recommendations, fleetSplit, onAddOrder, onOpenTab, onPickVehicle, ranking,
}) {
  if (!plan || plan.empty) {
    return (
      <div className="ir">
        <div className="ir-empty">
          Add consignment lines to see the analysis.
        </div>
      </div>
    )
  }

  const d = plan.distribution
  const u = plan.uncertainty
  const binding = plan.tightness.binding
  const criticals = plan.violations.filter(v => v.severity === 'critical')

  return (
    <div className="ir">
      {/* verdict */}
      <div className={`ir-verdict ${criticals.length === 0 ? 'ok' : 'bad'}`}>
        <span className="ir-verdict-label">
          {criticals.length === 0 ? 'Releasable' : 'Blocked'}
        </span>
        <strong>
          {criticals.length === 0
            ? `${plan.kpi.unitsPlaced} units · all limits met`
            : `${criticals.length} critical exception${criticals.length > 1 ? 's' : ''}`}
        </strong>
        {u && (
          <span className={`ir-risk ${u.verdict.level}`}>
            Mass risk: {u.anyBreachProb === 0 ? 'none' : `${(u.anyBreachProb * 100).toFixed(1)}% of scenarios breach`}
          </span>
        )}
      </div>

      {/* binding constraint */}
      <section className="ir-block">
        <h6>Binding constraint</h6>
        <div className="ir-binding">
          <strong>{binding.label}</strong>
          <span className={`ir-binding-pct ${binding.utilPct > 100 ? 'bad' : binding.utilPct >= 90 ? 'warn' : 'ok'}`}>
            {binding.utilPct.toFixed(0)}%
          </span>
        </div>
        <span className="ir-sub">{binding.detail} — {binding.slack}</span>
        {plan.tightness.nearBinding.length > 1 && (
          <span className="ir-sub">
            Also tight: {plan.tightness.nearBinding.slice(1).map(r => r.label).join(', ')}
          </span>
        )}
        <div className="ir-tight">
          <TightnessBars rows={plan.tightness.rows.slice(0, 5)} />
        </div>
        <button className="ir-link" onClick={() => onOpenTab('analytics')}>
          Full constraint analysis →
        </button>
      </section>

      {/* bound */}
      <section className="ir-block">
        <h6>Against the provable bound</h6>
        <div className="ir-kv">
          <span>Minimum vehicles</span>
          <strong className={plan.bounds.minVehicles > 1 ? 'text-danger' : ''}>
            {plan.bounds.minVehicles}
          </strong>
        </div>
        <div className="ir-kv">
          <span>Area efficiency</span>
          <strong>
            {plan.bounds.areaEfficiencyPct !== null
              ? `${plan.bounds.areaEfficiencyPct.toFixed(0)}%`
              : '—'}
          </strong>
        </div>
        <div className="ir-kv">
          <span>Deck consumed</span>
          <strong>{plan.bounds.placedFootprintM2.toFixed(1)} m²</strong>
        </div>
        <div className="ir-kv">
          <span>Bound</span>
          <strong>{plan.bounds.minFloorAreaM2.toFixed(1)} m²</strong>
        </div>
        <span className="ir-sub">{plan.boundsVerdict}</span>
      </section>

      {/* fleet split when one vehicle provably will not do */}
      {fleetSplit && fleetSplit.tripsRequired > 1 && (
        <section className="ir-block">
          <h6>Fleet split</h6>
          <span className="ir-sub">
            Each trip below is a separately solved, verified load plan.
          </span>
          {fleetSplit.trips.map(t => (
            <div className="ir-trip" key={t.trip}>
              <strong>Trip {t.trip}</strong>
              <span>
                {t.unitsPlaced} units · {(t.massKg / 1000).toFixed(2)} t ·
                {' '}{t.payloadUtilPct.toFixed(0)}% payload · {t.floorUtilPct.toFixed(0)}% floor
              </span>
              <span className={t.axleCompliant ? 'text-success' : 'text-danger'}>
                {t.axleCompliant ? 'axle compliant' : 'axle fail'} · {inr(t.tripCostInr)}
              </span>
            </div>
          ))}
          <div className="ir-kv">
            <span>Total</span>
            <strong>{inr(fleetSplit.totalCostInr)} · {fleetSplit.totalCo2Kg} kg CO₂</strong>
          </div>
          {!fleetSplit.complete && (
            <span className="ir-sub text-danger">
              {fleetSplit.unplaced.length} line(s) still unplaced after {fleetSplit.tripsRequired} trips.
            </span>
          )}
        </section>
      )}

      {/* recommendations */}
      <section className="ir-block">
        <h6>Next actions</h6>
        {recommendations.map((r, i) => (
          <div className={`ir-rec ${r.kind}`} key={i}>
            <div className="ir-rec-top">
              <span className="ir-rec-kind">{KIND_LABEL[r.kind] || r.kind}</span>
              <strong>{r.title}</strong>
            </div>
            <p>{r.why}</p>
            <p className="ir-rec-do">{r.action}</p>
            {r.kind === 'opportunity' && onAddOrder && r.title.includes('backlog') && (
              <button className="ir-link" onClick={onAddOrder}>Add them now →</button>
            )}
            {r.kind === 'opportunity' && onPickVehicle && ranking?.length > 0 && r.title.includes('/m³') && (
              <button
                className="ir-link"
                onClick={() => {
                  const better = ranking.find(x => x.feasible && x.vehicleId !== plan.vehicle.id)
                  if (better) onPickVehicle(better.vehicleId)
                }}
              >
                Switch asset →
              </button>
            )}
          </div>
        ))}
      </section>

      {/* at-a-glance numbers */}
      <section className="ir-block">
        <h6>Stability</h6>
        <div className="ir-kv"><span>Longitudinal CoG</span><strong className={d.cogInWindow ? '' : 'text-danger'}>{d.cogFractionPct.toFixed(1)}%</strong></div>
        <div className="ir-kv"><span>Lateral offset</span><strong className={d.lateralBalanced ? '' : 'text-danger'}>{d.cogLateralMm} mm</strong></div>
        <div className="ir-kv"><span>CoG height</span><strong>{d.combinedCogHeightMm} mm</strong></div>
        <div className="ir-kv"><span>Rollover threshold</span><strong className={d.rolloverSafe ? '' : 'text-danger'}>{d.rolloverThresholdG} g</strong></div>
        <div className="ir-kv"><span>Securing</span><strong>{plan.securing.totalLashings} lashings</strong></div>
        <div className="ir-kv"><span>Dock handling</span><strong>{Math.round(plan.kpi.handlingMinutes)} min</strong></div>
        <div className="ir-kv"><span>Payload spare</span><strong>{kg(plan.kpi.payloadHeadroomKg)}</strong></div>
      </section>
    </div>
  )
}
