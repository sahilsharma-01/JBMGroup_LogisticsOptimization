import { inr } from './format'

// ============================================================================
// EXCEPTIONS & SOLVER
// ============================================================================
export default function DiagnosticsPanel({ plan, ranking, onPickVehicle }) {
  const b = plan.baseline
  const compare = [
    ['Handling units seated', `${plan.kpi.unitsPlaced} / ${plan.kpi.unitsOffered}`, `${b.kpi.unitsPlaced} / ${plan.kpi.unitsOffered}`],
    ['Deck floor used', `${plan.kpi.floorUtilPct.toFixed(1)}%`, `${b.kpi.floorUtilPct.toFixed(1)}%`],
    ['Packing density', `${plan.kpi.packingDensityPct.toFixed(1)}%`, `${b.kpi.packingDensityPct.toFixed(1)}%`],
    ['Loaded envelope', `${plan.kpi.envelopePct.toFixed(1)}%`, `${b.kpi.envelopePct.toFixed(1)}%`],
    ['Max stack height', `${plan.kpi.maxStackHeightMm} mm`, `${b.kpi.maxStackHeightMm} mm`],
    ['Longitudinal CoG', `${plan.distribution.cogFractionPct.toFixed(1)}%`, `${b.distribution.cogFractionPct.toFixed(1)}%`],
    ['Lateral offset', `${plan.distribution.cogLateralMm} mm`, `${b.distribution.cogLateralMm} mm`],
    ['Axle compliance', plan.distribution.axleCompliant ? 'Pass' : 'Fail', b.distribution.axleCompliant ? 'Pass' : 'Fail'],
    ['Re-handles at consignee', plan.kpi.rehandlingEvents, b.kpi.rehandlingEvents],
    ['Overload penalty exposure', inr(plan.economics.penaltyExposureInr), inr(b.penaltyExposureInr)],
  ]

  return (
    <div className="lp-panel">
      {plan.violations.length === 0 ? (
        <div className="lp-alert info"><strong>CLEAN</strong><span>No exceptions raised against this plan.</span></div>
      ) : (
        <div className="lp-violations">
          {plan.violations.map((v, i) => (
            <div key={`${v.code}-${i}`} className={`lp-violation ${v.severity}`}>
              <div className="lp-violation-head">
                <span className="lp-violation-sev">{v.severity}</span>
                <strong>{v.title}</strong>
              </div>
              <p>{v.message}</p>
              <p className="lp-violation-remedy"><span>Remedy</span> {v.remedy}</p>
            </div>
          ))}
        </div>
      )}

      {plan.rejected.length > 0 && (
        <>
          <h4 className="lp-section-title">Not loaded ({plan.rejected.length} units)</h4>
          <div className="compact-table-container">
            <table className="compact-enterprise-table">
              <thead>
                <tr><th>Handling unit</th><th>Part</th><th>Consignee</th><th>Mass</th><th>Volume</th><th>Reason</th></tr>
              </thead>
              <tbody>
                {plan.rejected.map(r => (
                  <tr key={r.huId}>
                    <td className="font-mono">{r.huId}</td>
                    <td>{r.partNo}</td>
                    <td>{r.customerCode}</td>
                    <td>{Math.round(r.grossKg)} kg</td>
                    <td>{r.volumeM3.toFixed(2)} m³</td>
                    <td className="lp-sub">{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h4 className="lp-section-title">Optimised plan vs. manual planning</h4>
      <p className="lp-section-note">
        The baseline is the same consignment packed the way it goes on under time pressure:
        paperwork order, rear doors forward, no pre-built columns, no turning, no airspace
        recovery and no axle check. Both columns are produced by the same solver and the same
        physics, so the comparison is like for like.
      </p>
      <div className="compact-table-container">
        <table className="compact-enterprise-table">
          <thead>
            <tr><th>Measure</th><th>Optimised</th><th>Manual baseline</th></tr>
          </thead>
          <tbody>
            {compare.map(([k, a, c]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="text-bold">{a}</td>
                <td className={String(a) !== String(c) ? 'text-muted' : ''}>{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="lp-section-title">Vehicle right-sizing</h4>
      <p className="lp-section-note">
        Each asset in the fleet re-solved against this consignment. Ranked by cost per cubic metre
        among the vehicles that take the whole load within their axle ratings.
      </p>
      <div className="compact-table-container">
        <table className="compact-enterprise-table">
          <thead>
            <tr>
              <th>Asset</th><th>Takes full load</th><th>Payload</th><th>Floor</th>
              <th>Cube</th><th>Trip cost</th><th>Per m³</th><th>CO₂</th><th></th>
            </tr>
          </thead>
          <tbody>
            {ranking.map(r => (
              <tr key={r.vehicleId} className={r.vehicleId === plan.vehicle.id ? 'row-active' : ''}>
                <td className="text-bold">{r.icon} {r.name}</td>
                <td>
                  {r.feasible
                    ? <span className="badge badge-success">yes</span>
                    : <span className="badge badge-danger">{r.unitsRejected > 0 ? `${r.unitsRejected} left` : 'axle fail'}</span>}
                </td>
                <td>{r.payloadUtilPct.toFixed(0)}%</td>
                <td>{r.floorUtilPct.toFixed(0)}%</td>
                <td>{r.cubeOccupancyPct.toFixed(0)}%</td>
                <td>{inr(r.tripCostInr)}</td>
                <td className="text-bold">{inr(r.costPerM3Inr)}</td>
                <td>{r.co2Kg} kg</td>
                <td>
                  {r.vehicleId !== plan.vehicle.id && (
                    <button className="btn btn-secondary btn-sm" onClick={() => onPickVehicle(r.vehicleId)}>
                      Use
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="lp-section-title">Solver trace</h4>
      <p className="lp-section-note">
        {plan.trials.length} strategy parameterisations were evaluated. Statutory non-compliance and
        geometric faults are hard constraints, so any candidate carrying them scores below every
        clean candidate regardless of how well it packs. Winner:
        {' '}<strong>{plan.strategy.weightBias} / {plan.strategy.sortOrder} / offset {Math.round(plan.strategy.blockOffsetFraction * 100)}%</strong>.
      </p>
      <div className="compact-table-container lp-trace">
        <table className="compact-enterprise-table">
          <thead>
            <tr><th>Strategy</th><th>Score</th><th>Seated</th><th>Left</th><th>CoG</th><th>Axles</th><th>Re-handles</th><th>Compactness</th></tr>
          </thead>
          <tbody>
            {plan.trials.slice(0, 10).map((t, i) => (
              <tr key={t.label} className={i === 0 ? 'row-active' : ''}>
                <td className="font-mono">{t.label}</td>
                <td className="font-mono">{t.score.toFixed(0)}</td>
                <td>{t.placed}</td>
                <td>{t.rejected}</td>
                <td>{t.cogPct.toFixed(1)}%</td>
                <td>{t.axleCompliant ? '✓' : '✗'}</td>
                <td>{t.rehandles}</td>
                <td>{(t.compactness * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
