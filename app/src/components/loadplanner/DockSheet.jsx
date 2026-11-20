import { useState } from 'react'

// ============================================================================
// DOCK SHEET
// ============================================================================
export default function DockSheet({ plan, onSelectUnit, selectedHuId }) {
  const [mode, setMode] = useState('load')
  const rows = mode === 'load' ? plan.loadSequence : plan.unloadSequence

  return (
    <div className="lp-panel">
      <div className="lp-panel-head">
        <div>
          <h4>{mode === 'load' ? 'Loading sequence' : 'Unloading sequence'}</h4>
          <p>
            {mode === 'load'
              ? 'Built bulkhead-first, bottom tier before top tier. Hand this to the forklift operator.'
              : 'Reverse of the loading order. Drop 1 comes off first with no re-handling of later consignments.'}
          </p>
        </div>
        <div className="chip-group">
          <button className={`filter-chip-compact ${mode === 'load' ? 'active' : ''}`} onClick={() => setMode('load')}>
            Load order
          </button>
          <button className={`filter-chip-compact ${mode === 'unload' ? 'active' : ''}`} onClick={() => setMode('unload')}>
            Unload order
          </button>
        </div>
      </div>

      <div className="lp-drops">
        {plan.drops.map(d => (
          <div key={d.customerId} className="lp-drop">
            <span className="lp-drop-seq">Drop {d.dropSeq}</span>
            <strong>{d.code}</strong>
            <span>{d.plant}</span>
            <span>{d.units} units · {(d.weightKg / 1000).toFixed(2)} t · {d.distanceKm} km · due {d.earliestDue}</span>
          </div>
        ))}
      </div>

      <div className="compact-table-container">
        <table className="compact-enterprise-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Position</th>
              <th>Handling unit</th>
              <th>Part</th>
              <th>Consignee</th>
              <th>Pcs</th>
              <th>Mass</th>
              <th>Approach</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <tr
                key={p.huId}
                className={selectedHuId === p.huId ? 'row-active' : ''}
                onClick={() => onSelectUnit(p.huId)}
              >
                <td><span className="seq-badge">{mode === 'load' ? p.loadSeq : p.unloadSeq}</span></td>
                <td className="font-mono text-bold">{p.address}</td>
                <td className="font-mono">{p.huId}</td>
                <td>
                  <div className="text-bold">{p.partNo}</div>
                  <div className="lp-sub">{p.partName}</div>
                </td>
                <td><span className="oem-chip">{p.customerCode}</span> <span className="lp-sub">drop {p.dropSeq}</span></td>
                <td>{p.pieces || '—'}</td>
                <td className="font-mono">{Math.round(p.grossKg)} kg</td>
                <td className="lp-sub">{p.forkliftSide}</td>
                <td className="lp-sub">
                  {[
                    p.rotated ? 'turned 90°' : null,
                    p.tight ? 'tight fit — no working gap' : null,
                    p.topLoadCapacityKg === 0 ? 'do not stack' : null,
                    p.esd ? 'ESD protocol' : null,
                    p.isReturnAsset ? 'empty returnable' : null,
                    p.placedBy === 'air-void' ? 'seated in airspace' : null,
                  ].filter(Boolean).join(' · ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
