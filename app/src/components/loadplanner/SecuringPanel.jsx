import { useState } from 'react'

// ============================================================================
// LOAD SECURING
// ============================================================================
export default function SecuringPanel({ plan, onSelectUnit, selectedHuId }) {
  const s = plan.securing
  const [onlyAction, setOnlyAction] = useState(false)
  const rows = onlyAction ? s.items.filter(i => i.lashings > 0 || i.tipRiskDirection) : s.items

  return (
    <div className="lp-panel">
      <div className="lp-panel-head">
        <div>
          <h4>Securing schedule — {s.standard}</h4>
          <p>
            Balance of forces per unit: friction is credited only where it can be claimed, blocking
            only where a unit actually bears against rated structure, and lashings make up the
            remainder. Acceleration coefficients {s.coefficients.forward} g forward,
            {' '}{s.coefficients.lateral} g lateral, {s.coefficients.rearward} g rearward.
          </p>
        </div>
        <label className="lp-toggle on">
          <input type="checkbox" checked={onlyAction} onChange={e => setOnlyAction(e.target.checked)} />
          <span>Action required only</span>
        </label>
      </div>

      <div className="lp-secure-summary">
        <div><span>Top-over lashings</span><strong>{s.totalLashings}</strong></div>
        <div><span>Anti-slip mats</span><strong>{s.antiSlipMats}</strong></div>
        <div><span>Wheel chocks</span><strong>{s.chocksRequired}</strong></div>
        <div>
          <span>Bulkhead blocking demand</span>
          <strong className={s.bulkheadDemandKg > s.frontWallCapacityKg ? 'text-danger' : ''}>
            {s.bulkheadDemandKg.toLocaleString('en-IN')} / {s.frontWallCapacityKg.toLocaleString('en-IN')} kgf
          </strong>
        </div>
        <div><span>Body rating</span><strong>EN 12642 Code {s.bodyCode}</strong></div>
      </div>

      {s.warnings.map(w => (
        <div key={w.code} className={`lp-alert ${w.severity}`}>
          <strong>{w.code.replace(/_/g, ' ')}</strong>
          <span>{w.message}</span>
        </div>
      ))}

      <div className="compact-table-container">
        <table className="compact-enterprise-table">
          <thead>
            <tr>
              <th>Handling unit</th>
              <th>Pkg</th>
              <th>Tier</th>
              <th>Mass</th>
              <th>μ</th>
              <th>Forward shortfall</th>
              <th>Lateral shortfall</th>
              <th>b/2h</th>
              <th>Lashings</th>
              <th>Measures</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(i => (
              <tr
                key={i.huId}
                className={selectedHuId === i.huId ? 'row-active' : ''}
                onClick={() => onSelectUnit(i.huId)}
              >
                <td className="font-mono">{i.huId}</td>
                <td>{i.packagingCode}</td>
                <td>{i.tier}</td>
                <td>{i.grossKg} kg</td>
                <td>{i.mu.toFixed(2)}</td>
                <td>{i.blockedFront ? <span className="text-success">blocked</span> : `${i.requiredForceDaN.forward} daN`}</td>
                <td>{i.requiredForceDaN.lateral} daN</td>
                <td className={i.tipRiskDirection ? 'text-danger' : ''}>{i.tipLimit.toFixed(2)}</td>
                <td className="text-bold">{i.lashings || '—'}</td>
                <td className="lp-measures">{i.measures.join(' · ') || 'Friction and blocking sufficient'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
