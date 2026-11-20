import { useEffect, useMemo, useState } from 'react'
import {
  pendingOrders, customers, fleet, vehicleTypes,
  getCustomer, getPart, getVehicleType, getPriorityColor,
} from '../data/seedData'
import { withVehicleOverrides, resolveVehicle } from '../engine/specs'
import {
  solveLoadPlan, recommendConsolidation, rankVehicles, planFleetSplit, buildRecommendations,
} from '../engine/loadPlan'
import LoadViewport3D from '../components/LoadViewport3D'
import LoadPatternBlueprint from '../components/LoadPatternBlueprint'
import StabilityPanel from '../components/loadplanner/StabilityPanel'
import SecuringPanel from '../components/loadplanner/SecuringPanel'
import DockSheet from '../components/loadplanner/DockSheet'
import DiagnosticsPanel from '../components/loadplanner/DiagnosticsPanel'
import AnalyticsPanel from '../components/loadplanner/AnalyticsPanel'
import RideSimulator from '../components/loadplanner/RideSimulator'
import CargoInputPanel from '../components/loadplanner/CargoInputPanel'
import VehicleInputPanel from '../components/loadplanner/VehicleInputPanel'
import IntelligenceRail from '../components/loadplanner/IntelligenceRail'
import { inr, kg } from '../components/loadplanner/format'

const STAGE_TABS = [
  { id: '3d', label: '3D twin' },
  { id: 'pattern', label: 'Pattern' },
  { id: 'ride', label: 'Ride & stability' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'stability', label: 'Stability' },
  { id: 'securing', label: 'Securing' },
  { id: 'docksheet', label: 'Dock sheet' },
  { id: 'diagnostics', label: 'Exceptions' },
]

const RAIL_TABS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'cargo', label: 'Enter cargo' },
  { id: 'vehicle', label: 'Vehicle' },
]

const STORE_KEY = 'jbm.loadiq.inputs.v1'

function loadStored() {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export default function LoadPlanner({ onNavigate }) {
  const stored = useMemo(loadStored, [])

  const [vehicleId, setVehicleId] = useState(stored?.vehicleId || 'BHARATBENZ-32FT')
  const [selectedOrderIds, setSelectedOrderIds] = useState(stored?.selectedOrderIds || [
    'ORD-20261031-001', 'ORD-20261031-002', 'ORD-20261031-003', 'ORD-20261031-009', 'ORD-20261031-RET',
  ])
  const [customLines, setCustomLines] = useState(stored?.customLines || [])
  const [vehicleOverrides, setVehicleOverrides] = useState(stored?.vehicleOverrides || {})
  const [constraints, setConstraints] = useState(stored?.constraints || {
    enforceLifo: true, allowStacking: true, allowRotation: true, allowVoidRecovery: true,
  })
  const [uncertaintyConfig, setUncertaintyConfig] = useState({})

  const [stageTab, setStageTab] = useState('3d')
  const [railTab, setRailTab] = useState('backlog')
  const [railOpen, setRailOpen] = useState(true)
  const [intelOpen, setIntelOpen] = useState(true)
  const [selectedHuId, setSelectedHuId] = useState(null)
  const [filterPriority, setFilterPriority] = useState('all')
  const [search, setSearch] = useState('')
  const [released, setReleased] = useState(false)

  // persist the planner's own figures — typed dimensions must survive a reload
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        vehicleId, selectedOrderIds, customLines, vehicleOverrides, constraints,
      }))
    } catch { /* storage unavailable — not worth interrupting the planner */ }
  }, [vehicleId, selectedOrderIds, customLines, vehicleOverrides, constraints])

  // ---- resolvers that merge the catalogue with planner-entered data -------
  const customParts = useMemo(() => customLines.map(l => l.part), [customLines])
  const helpers = useMemo(() => ({
    getPart: (id) => customParts.find(p => p.id === id) || getPart(id),
    getCustomer,
  }), [customParts])

  const allOrders = useMemo(
    () => [...pendingOrders, ...customLines.map(l => l.order)],
    [customLines],
  )

  const vehicleType = useMemo(
    () => withVehicleOverrides(getVehicleType(vehicleId), vehicleOverrides),
    [vehicleId, vehicleOverrides],
  )
  const vehicle = useMemo(() => resolveVehicle(vehicleType), [vehicleType])

  const selectedOrders = useMemo(
    () => allOrders.filter(o => selectedOrderIds.includes(o.id)),
    [allOrders, selectedOrderIds],
  )

  const solveOptions = useMemo(
    () => ({ ...constraints, uncertaintyConfig }),
    [constraints, uncertaintyConfig],
  )

  const plan = useMemo(
    () => solveLoadPlan(vehicleType, selectedOrders, helpers, solveOptions),
    [vehicleType, selectedOrders, helpers, solveOptions],
  )

  const consolidation = useMemo(() => {
    if (!plan || plan.empty || plan.kpi.unitsRejected > 0) return []
    const candidates = allOrders.filter(
      o => !selectedOrderIds.includes(o.id) && o.status !== 'qa-pending',
    )
    return recommendConsolidation(vehicleType, selectedOrders, candidates, helpers, constraints)
  }, [plan, vehicleType, selectedOrders, selectedOrderIds, allOrders, helpers, constraints])

  const ranking = useMemo(() => {
    if (!selectedOrders.length) return []
    return rankVehicles(vehicleTypes.map(v => withVehicleOverrides(v, vehicleOverrides)),
      selectedOrders, helpers, { ...constraints, uncertainty: false })
  }, [selectedOrders, helpers, constraints, vehicleOverrides])

  const fleetSplit = useMemo(() => {
    if (!plan || plan.empty) return null
    if (plan.bounds.minVehicles <= 1 && plan.kpi.unitsRejected === 0) return null
    return planFleetSplit(vehicleType, selectedOrders, helpers, constraints)
  }, [plan, vehicleType, selectedOrders, helpers, constraints])

  const recommendations = useMemo(
    () => buildRecommendations(plan, { consolidation, ranking }),
    [plan, consolidation, ranking],
  )

  const filteredOrders = useMemo(() => allOrders.filter(o => {
    if (filterPriority !== 'all' && o.priority !== filterPriority) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const part = helpers.getPart(o.partId)
      const cust = getCustomer(o.customerId)
      if (![o.id, o.poNumber, part?.name, part?.partNo, cust?.code]
        .some(v => v?.toLowerCase().includes(q))) return false
    }
    return true
  }), [allOrders, filterPriority, search, helpers])

  const toggleOrder = (id) => {
    const order = allOrders.find(o => o.id === id)
    if (order?.status === 'qa-pending') return
    setReleased(false)
    setSelectedOrderIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const criticals = plan?.violations?.filter(v => v.severity === 'critical') || []
  const releasable = plan && !plan.empty && criticals.length === 0

  const addAllConsolidation = () => {
    setSelectedOrderIds(prev => [...new Set([...prev, ...consolidation.map(c => c.orderId)])])
    setReleased(false)
  }

  return (
    <div className="lp-shell">
      {/* ============ row 1: command strip ============ */}
      <header className="ls-bar">
        <div className="ls-bar-left">
          <span className="brand-pill">PLANT 2 · MANESAR</span>
          <h2>Volumetric Load Planning</h2>
          <select
            className="ls-vehicle"
            value={vehicleId}
            onChange={e => { setVehicleId(e.target.value); setReleased(false) }}
          >
            {vehicleTypes.map(v => (
              <option key={v.id} value={v.id}>
                {v.icon} {v.name} · {(v.maxWeight / 1000).toFixed(1)} t{v.id === 'TATA-ULTRA-24' ? ' ⭐ [3D Twin]' : ''}
              </option>
            ))}
          </select>
          {vehicle?.isCustomised && <span className="badge badge-warning">custom spec</span>}
        </div>

        <div className="ls-bar-constraints">
          {[
            ['allowStacking', 'Stack'],
            ['allowRotation', 'Turn 90°'],
            ['allowVoidRecovery', 'Airspace'],
            ['enforceLifo', 'Drop order'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`ls-chip ${constraints[key] ? 'on' : ''}`}
              onClick={() => {
                setReleased(false)
                setConstraints(c => ({ ...c, [key]: !c[key] }))
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ls-bar-right">
          {plan && !plan.empty && (
            <span className="ls-cost">
              {inr(plan.economics.tripCostInr)} · {inr(plan.marginal.costPerM3Inr)}/m³
            </span>
          )}
          {released ? (
            <span className="ls-released">✓ Released to dock</span>
          ) : (
            <button
              className={`ls-release ${releasable ? '' : 'blocked'}`}
              disabled={!releasable}
              onClick={() => {
                setReleased(true)
                setTimeout(() => onNavigate && onNavigate('dispatchQueue'), 1600)
              }}
            >
              {releasable ? 'Release to dock' : `${criticals.length} blocker${criticals.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </header>

      {/* ============ row 2: metric strip ============ */}
      {plan && !plan.empty ? (
        <div className="ls-metrics">
          <Metric
            label="Seated"
            value={`${plan.kpi.unitsPlaced}/${plan.kpi.unitsOffered}`}
            sub={plan.kpi.unitsRejected > 0 ? `${plan.kpi.unitsRejected} left behind` : 'all units'}
            tone={plan.kpi.unitsRejected > 0 ? 'bad' : 'ok'}
          />
          <Metric label="Payload" value={`${plan.kpi.payloadUtilPct.toFixed(0)}%`} sub={kg(plan.distribution.cargoMassKg)} bar={plan.kpi.payloadUtilPct} />
          <Metric label="Deck floor" value={`${plan.kpi.floorUtilPct.toFixed(0)}%`} sub={`${plan.capacity.floorFreeM2.toFixed(1)} m² free`} bar={plan.kpi.floorUtilPct} />
          <Metric label="Cube" value={`${plan.kpi.cubeOccupancyPct.toFixed(0)}%`} sub={`${plan.capacity.goodsVolumeM3.toFixed(1)} m³ goods`} bar={plan.kpi.cubeOccupancyPct} />
          <Metric
            label="vs bound"
            value={plan.bounds.areaEfficiencyPct !== null ? `${plan.bounds.areaEfficiencyPct.toFixed(0)}%` : '—'}
            sub={plan.bounds.minVehicles > 1 ? `needs ${plan.bounds.minVehicles} trips` : `${plan.bounds.bindingResource} binds`}
            tone={plan.bounds.minVehicles > 1 ? 'bad' : ''}
          />
          {plan.distribution.axles.map(a => (
            <Metric
              key={a.id}
              label={a.id === 'steer' ? 'Steer axle' : a.id === 'drive' ? 'Drive axle' : 'Trailer axle'}
              value={`${a.utilPct.toFixed(0)}%`}
              sub={`${a.loadKg.toLocaleString('en-IN')} / ${a.limitKg.toLocaleString('en-IN')} kg`}
              bar={a.utilPct}
              tone={!a.compliant ? 'bad' : a.utilPct > 90 ? 'warn' : 'ok'}
            />
          ))}
          <Metric
            label="CoG"
            value={`${plan.distribution.cogFractionPct.toFixed(1)}%`}
            sub={`lat ${plan.distribution.cogLateralMm} mm · SRT ${plan.distribution.rolloverThresholdG} g`}
            tone={plan.distribution.cogInWindow && plan.distribution.lateralBalanced ? 'ok' : 'warn'}
          />
          {plan.uncertainty && (
            <Metric
              label="p99 risk"
              value={plan.uncertainty.anyBreachProb === 0 ? '0%' : `${(plan.uncertainty.anyBreachProb * 100).toFixed(1)}%`}
              sub={`worst ${plan.uncertainty.worstAxle.utilP99Pct.toFixed(0)}% at p99`}
              tone={plan.uncertainty.verdict.level === 'ok' ? 'ok' : plan.uncertainty.verdict.level === 'bad' ? 'bad' : 'warn'}
            />
          )}
        </div>
      ) : (
        <div className="ls-metrics ls-metrics-empty">
          Select or enter consignment lines to solve a load plan.
        </div>
      )}

      {/* ============ row 3: three panes ============ */}
      <div className={`ls-body ${railOpen ? '' : 'rail-closed'} ${intelOpen ? '' : 'intel-closed'}`}>
        {/* ---- left rail ---- */}
        <aside className="ls-rail">
          <div className="ls-rail-tabs">
            {RAIL_TABS.map(t => (
              <button
                key={t.id}
                className={`ls-rail-tab ${railTab === t.id ? 'active' : ''}`}
                onClick={() => setRailTab(t.id)}
              >
                {t.label}
                {t.id === 'cargo' && customLines.length > 0 && (
                  <span className="ls-tab-count">{customLines.length}</span>
                )}
              </button>
            ))}
            <button className="ls-collapse" onClick={() => setRailOpen(false)} title="Collapse">‹</button>
          </div>

          <div className="ls-rail-body">
            {railTab === 'backlog' && (
              <>
                <div className="ls-rail-filters">
                  <input
                    className="search-input-compact"
                    placeholder="Part, PO, consignee…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  <div className="chip-group">
                    {['all', 'critical', 'high', 'internal'].map(p => (
                      <button
                        key={p}
                        className={`filter-chip-compact ${filterPriority === p ? 'active' : ''}`}
                        onClick={() => setFilterPriority(p)}
                      >
                        {p === 'all' ? 'All' : p.slice(0, 4).toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {consolidation.length > 0 && (
                  <button className="ls-suggest" onClick={addAllConsolidation}>
                    <strong>+{consolidation.length} more line{consolidation.length > 1 ? 's' : ''} fit</strong>
                    <span>
                      {consolidation.map(c => c.orderId.split('-').pop()).join(', ')} —
                      {' '}re-solved and still compliant
                    </span>
                  </button>
                )}

                <div className="ls-orders">
                  {filteredOrders.map(order => {
                    const cust = getCustomer(order.customerId)
                    const part = helpers.getPart(order.partId)
                    const chosen = selectedOrderIds.includes(order.id)
                    const blocked = order.status === 'qa-pending'
                    const left = plan?.rejected?.filter(r => r.orderId === order.id).length || 0
                    return (
                      <div
                        key={order.id}
                        className={`ls-order ${chosen ? 'sel' : ''} ${blocked ? 'blocked' : ''}`}
                        onClick={() => toggleOrder(order.id)}
                      >
                        <input type="checkbox" checked={chosen} disabled={blocked} onChange={() => {}} />
                        <div className="ls-order-body">
                          <div className="ls-order-top">
                            <span className="order-id-badge">{order.id.split('-').pop()}</span>
                            <span className="oem-customer-tag">{cust?.code}</span>
                            <span className={`priority-tag ${getPriorityColor(order.priority)}`}>
                              {order.priority.slice(0, 4)}
                            </span>
                            {order.__custom && <span className="status-pill violet">ENTERED</span>}
                            {blocked && <span className="status-pill amber">QA</span>}
                            {chosen && left > 0 && <span className="status-pill red">{left} LEFT</span>}
                          </div>
                          <div className="ls-order-name">{part?.partNo} · {part?.name}</div>
                          <div className="ls-order-meta">
                            <span>{order.bins}×</span>
                            <span>{part?.containerDimensions.lengthMm}×{part?.containerDimensions.widthMm}×{part?.containerDimensions.heightMm}</span>
                            <span>{(order.weight / 1000).toFixed(2)} t</span>
                            <span>{order.volume.toFixed(2)} m³</span>
                            <span>{order.dueTime}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {railTab === 'cargo' && (
              <CargoInputPanel
                customLines={customLines}
                onChange={(lines) => {
                  setCustomLines(lines)
                  // newly added lines are selected straight away
                  setSelectedOrderIds(prev => [
                    ...new Set([...prev, ...lines.map(l => l.id)]),
                  ])
                  setReleased(false)
                }}
                customers={customers}
                vehicle={vehicle}
              />
            )}

            {railTab === 'vehicle' && (
              <VehicleInputPanel
                vehicleType={vehicleType}
                vehicle={vehicle}
                overrides={vehicleOverrides}
                onChange={(o) => { setVehicleOverrides(o); setReleased(false) }}
                onReset={() => {
                  const next = { ...vehicleOverrides }
                  delete next[vehicleId]
                  setVehicleOverrides(next)
                }}
              />
            )}
          </div>

          <div className="ls-rail-foot">
            <span>{fleet.filter(f => f.typeId === vehicleId && f.status === 'available').length} assets ready</span>
            {plan && !plan.empty && (
              <span>{plan.totals.units} units · {(plan.totals.goodsKg / 1000).toFixed(2)} t offered</span>
            )}
          </div>
        </aside>

        {!railOpen && (
          <button className="ls-reopen left" onClick={() => setRailOpen(true)}>›</button>
        )}

        {/* ---- centre stage ---- */}
        <main className="ls-stage">
          <div className="ls-stage-tabs">
            {STAGE_TABS.map(t => {
              const n = t.id === 'diagnostics' ? plan?.violations?.length : null
              return (
                <button
                  key={t.id}
                  className={`ls-stage-tab ${stageTab === t.id ? 'active' : ''}`}
                  onClick={() => setStageTab(t.id)}
                >
                  {t.label}
                  {n > 0 && (
                    <span className={`ls-tab-count ${criticals.length ? 'danger' : 'warn'}`}>{n}</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className={`ls-stage-body ${stageTab === '3d' || stageTab === 'ride' ? 'flush' : ''}`}>
            {stageTab === '3d' && (
              <LoadViewport3D plan={plan} selectedHuId={selectedHuId} onSelectUnit={setSelectedHuId} />
            )}
            {stageTab === 'ride' && (
              <RideSimulator plan={plan} />
            )}
            {stageTab === 'pattern' && (
              <LoadPatternBlueprint plan={plan} selectedHuId={selectedHuId} onSelectUnit={setSelectedHuId} />
            )}
            {plan && !plan.empty && stageTab === 'analytics' && (
              <AnalyticsPanel
                plan={plan}
                onConfigChange={(cfg) => setUncertaintyConfig(c => ({ ...c, ...cfg }))}
              />
            )}
            {plan && !plan.empty && stageTab === 'stability' && <StabilityPanel plan={plan} />}
            {plan && !plan.empty && stageTab === 'securing' && (
              <SecuringPanel plan={plan} selectedHuId={selectedHuId} onSelectUnit={setSelectedHuId} />
            )}
            {plan && !plan.empty && stageTab === 'docksheet' && (
              <DockSheet plan={plan} selectedHuId={selectedHuId} onSelectUnit={setSelectedHuId} />
            )}
            {plan && !plan.empty && stageTab === 'diagnostics' && (
              <DiagnosticsPanel plan={plan} ranking={ranking} onPickVehicle={setVehicleId} />
            )}
            {plan?.empty && stageTab !== '3d' && stageTab !== 'pattern' && (
              <div className="lp-empty">Select or enter consignment lines to solve a load plan.</div>
            )}
          </div>
        </main>

        {/* ---- intelligence rail ---- */}
        {intelOpen ? (
          <aside className="ls-intel">
            <div className="ls-intel-head">
              <span>Analysis</span>
              <button className="ls-collapse" onClick={() => setIntelOpen(false)} title="Collapse">›</button>
            </div>
            <div className="ls-intel-body">
              <IntelligenceRail
                plan={plan}
                recommendations={recommendations}
                fleetSplit={fleetSplit}
                ranking={ranking}
                onAddOrder={addAllConsolidation}
                onOpenTab={setStageTab}
                onPickVehicle={setVehicleId}
              />
            </div>
          </aside>
        ) : (
          <button className="ls-reopen right" onClick={() => setIntelOpen(true)}>‹</button>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, sub, bar, tone = '' }) {
  return (
    <div className={`ls-metric ${tone}`}>
      <span className="ls-metric-label">{label}</span>
      <strong className="ls-metric-value">{value}</strong>
      {bar !== undefined && (
        <div className="ls-metric-track">
          <div className="ls-metric-fill" style={{ width: `${Math.min(bar, 100)}%` }} />
        </div>
      )}
      <span className="ls-metric-sub">{sub}</span>
    </div>
  )
}
