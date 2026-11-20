import { kg } from './format'

// ============================================================================
// WEIGHT & STABILITY
// ============================================================================
export default function StabilityPanel({ plan }) {
  const d = plan.distribution
  const geom = plan.vehicle.geometry

  return (
    <div className="lp-panel">
      <div className="lp-panel-head">
        <div>
          <h4>Solved axle reactions</h4>
          <p>
            Reactions are obtained by static moment balance over the actual placement geometry.
            Each ceiling is min(CMVR statutory limit, OEM plate rating).
          </p>
        </div>
        <span className={`badge ${d.axleCompliant ? 'badge-success' : 'badge-danger'}`}>
          {d.axleCompliant ? 'Compliant' : 'Non-compliant'}
        </span>
      </div>

      <div className="lp-axle-grid">
        {d.axles.map(a => {
          const over = !a.compliant
          const warn = !over && a.utilPct > 90
          return (
            <div key={a.id} className={`lp-axle ${over ? 'over' : warn ? 'warn' : ''}`}>
              <div className="lp-axle-top">
                <strong>{a.label}</strong>
                <span className="lp-axle-tyres">{a.tyres} tyres</span>
              </div>
              <div className="lp-axle-load">{a.loadKg.toLocaleString('en-IN')}<small>kg</small></div>
              <div className="gauge-track">
                <div
                  className="gauge-fill"
                  style={{
                    width: `${Math.min(a.utilPct, 100)}%`,
                    background: over ? 'var(--danger)' : warn ? 'var(--warning)' : 'var(--success)',
                  }}
                />
              </div>
              <div className="lp-axle-foot">
                <span>{a.utilPct.toFixed(1)}% of {a.limitKg.toLocaleString('en-IN')} kg</span>
                <span className="lp-axle-gov">{a.governedBy}</span>
              </div>
              {over && (
                <div className="lp-axle-over">
                  Over by {a.overloadKg.toLocaleString('en-IN')} kg · statutory limit {a.statutoryKg.toLocaleString('en-IN')} kg,
                  plate rating {a.plateKg.toLocaleString('en-IN')} kg
                </div>
              )}
            </div>
          )
        })}
      </div>

      {plan.axleCorrection && (
        <div className="lp-correction">
          <strong>Corrective move</strong>
          <p>
            {plan.axleCorrection.axleLabel} is {plan.axleCorrection.overloadKg.toLocaleString('en-IN')} kg over.
            Required longitudinal moment change: {plan.axleCorrection.requiredMomentKgM.toLocaleString('en-IN')} kg·m
            {' '}{plan.axleCorrection.direction}.
          </p>
          <table className="compact-enterprise-table">
            <thead>
              <tr><th>Handling unit</th><th>Part</th><th>Mass</th><th>Now at</th><th>Move</th></tr>
            </thead>
            <tbody>
              {plan.axleCorrection.candidates.map(c => (
                <tr key={c.huId}>
                  <td className="font-mono">{c.huId}</td>
                  <td>{c.partNo}</td>
                  <td>{c.grossKg} kg</td>
                  <td>x = {c.currentXMm} mm</td>
                  <td className="text-bold">{c.shiftMm > 0 ? '+' : ''}{c.shiftMm} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="lp-stability-grid">
        <div className="lp-stab-card">
          <span className="lp-stab-label">Longitudinal centre of gravity</span>
          <strong className={d.cogInWindow ? '' : 'text-danger'}>
            {d.cogFractionPct.toFixed(1)}% of deck length
          </strong>
          <div className="lp-cog-meter">
            <div
              className="lp-cog-window"
              style={{
                left: `${d.cogWindowPct[0]}%`,
                width: `${d.cogWindowPct[1] - d.cogWindowPct[0]}%`,
              }}
            />
            <div
              className={`lp-cog-pin ${d.cogInWindow ? '' : 'bad'}`}
              style={{ left: `${Math.max(0, Math.min(100, d.cogFractionPct))}%` }}
            />
          </div>
          <span className="lp-stab-sub">
            {d.cogXMm} mm behind the bulkhead. Working window {d.cogWindowPct[0]}–{d.cogWindowPct[1]}%
            keeps the steer axle loaded without pushing the drive bogie past its rating.
          </span>
        </div>

        <div className="lp-stab-card">
          <span className="lp-stab-label">Lateral balance</span>
          <strong className={d.lateralBalanced ? '' : 'text-danger'}>
            {d.cogLateralMm > 0 ? '+' : ''}{d.cogLateralMm} mm off centreline
          </strong>
          <div className="lp-side-split">
            <div className="lp-side-left" style={{ width: `${d.sideSplit.leftPct}%` }}>
              L {d.sideSplit.leftPct.toFixed(0)}%
            </div>
            <div className="lp-side-right" style={{ width: `${d.sideSplit.rightPct}%` }}>
              R {d.sideSplit.rightPct.toFixed(0)}%
            </div>
          </div>
          <span className="lp-stab-sub">
            {kg(d.sideSplit.leftKg)} left / {kg(d.sideSplit.rightKg)} right. Tolerance ±{d.cogLateralLimitMm} mm —
            an off-centre load overloads one tyre set and bites on road camber.
          </span>
        </div>

        <div className="lp-stab-card">
          <span className="lp-stab-label">Static rollover threshold</span>
          <strong className={d.rolloverSafe ? '' : 'text-danger'}>{d.rolloverThresholdG} g</strong>
          <span className="lp-stab-sub">
            Combined centre of gravity {d.combinedCogHeightMm} mm above ground on a {d.trackWidthMm} mm track.
            Working minimum {d.rolloverMinG} g. Cargo CoG alone sits at {d.cargoCogHeightMm} mm.
          </span>
        </div>

        <div className="lp-stab-card">
          <span className="lp-stab-label">Chassis geometry used</span>
          <span className="lp-stab-sub">
            {geom.vehicleClass === 'articulated' ? (
              <>
                Articulated unit. Kingpin {geom.kingpinXMm} mm behind the trailer deck front,
                trailer bogie centre at {plan.vehicle.axleGroups.find(a => a.id === 'trailer').xMm} mm.
                Tractor wheelbase {geom.tractorWheelbaseMm} mm with the kingpin set
                {' '}{geom.kingpinAheadOfDriveMm} mm ahead of the drive axle.
              </>
            ) : (
              <>
                Rigid chassis. Wheelbase {geom.wheelbaseMm} mm, deck front face {geom.deckFrontFromSteerMm} mm
                behind the steer axle, rear overhang {geom.rearOverhangMm} mm. Tare distribution
                {' '}{Math.round(geom.tareSteerShare * 100)}% steer / {Math.round((1 - geom.tareSteerShare) * 100)}% drive.
              </>
            )}
            {' '}Deck height {geom.deckHeightMm} mm.
          </span>
        </div>
      </div>
    </div>
  )
}
