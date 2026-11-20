import { useState, useEffect } from 'react'
import {
  pendingOrders, customers, fleet, dispatchLog, containerInventory, dockSlots,
  getCustomer, getPart, getPriorityColor, getStatusLabel
} from '../data/seedData'

export default function Dashboard({ onNavigate }) {
  const [filterOEM, setFilterOEM] = useState('all')

  const availableVehicles = fleet.filter(v => v.status === 'available').length
  const loadingVehicles = fleet.filter(v => v.status === 'loading').length
  const dispatchedToday = dispatchLog.length
  const criticalOrders = pendingOrders.filter(o => o.priority === 'critical').length
  const totalPendingWeight = pendingOrders.reduce((s, o) => s + o.weight, 0)
  const qaPassed = pendingOrders.filter(o => o.status === 'qa-passed').length
  const inProgressDocks = dockSlots.filter(d => d.status === 'in-progress').length

  const filteredOrders = filterOEM === 'all'
    ? pendingOrders
    : pendingOrders.filter(o => {
        const c = getCustomer(o.customerId)
        return c?.code.includes(filterOEM)
      })

  return (
    <div className="dashboard-container">
      {/* Critical JIT Alert Banner */}
      <div className="alert-banner warning">
        <div className="alert-content">
          <span className="alert-icon">⚠️</span>
          <div>
            <strong>High-Priority JIT Line Feeding:</strong> 4 batches of BIW Front Subframes & Cross-Members scheduled for Maruti Suzuki Manesar Line 1 & Line 2 before 14:00.
            <span className="alert-sla">Line-Stoppage Penalty: ₹25,000 / min.</span>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => onNavigate('loadPlanner')}>
          Launch 3D Load Planner →
        </button>
      </div>

      {/* Enterprise Executive KPI Cards (Compact & Dense) */}
      <div className="kpi-grid">
        <div className="kpi-card" onClick={() => onNavigate('loadPlanner')} style={{ cursor: 'pointer' }}>
          <div className="kpi-top">
            <span className="kpi-title">PENDING OEM ORDERS</span>
            <span className="kpi-badge red">{criticalOrders} CRITICAL</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">{pendingOrders.length}</span>
            <span className="kpi-unit">Orders</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot green"></span>
            <strong>{qaPassed} QA Passed</strong> • {(totalPendingWeight / 1000).toFixed(1)}T Staged
          </div>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('fleet')} style={{ cursor: 'pointer' }}>
          <div className="kpi-top">
            <span className="kpi-title">FLEET READINESS</span>
            <span className="kpi-badge green">AIS-140 GPS</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">{availableVehicles}</span>
            <span className="kpi-unit">/ {fleet.length} Trucks Ready</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot blue"></span>
            <strong>{loadingVehicles} Loading at Bays</strong> • VAHAN Verified
          </div>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('dispatchQueue')} style={{ cursor: 'pointer' }}>
          <div className="kpi-top">
            <span className="kpi-title">TODAY'S DISPATCHES</span>
            <span className="kpi-badge blue">NIC E-WAY LIVE</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">{dispatchedToday}</span>
            <span className="kpi-unit">Convoys (40.1T)</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot green"></span>
            <strong>2 Delivered to MSIL</strong> • 1 En-Route Sanand
          </div>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('dockScheduler')} style={{ cursor: 'pointer' }}>
          <div className="kpi-top">
            <span className="kpi-title">PLANT 2 DOCK BAYS</span>
            <span className="kpi-badge amber">DOCK CONGESTION: LOW</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">{inProgressDocks}</span>
            <span className="kpi-unit">/ 6 Bays Active</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot amber"></span>
            Avg Turnaround: <strong>48 mins / truck</strong>
          </div>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('compliance')} style={{ cursor: 'pointer' }}>
          <div className="kpi-top">
            <span className="kpi-title">CMVR AXLE COMPLIANCE</span>
            <span className="kpi-badge green">100% PASS</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">99.4%</span>
            <span className="kpi-unit">JIT SLA Adherence</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot green"></span>
            Zero Overload • Zero Challan Incident
          </div>
        </div>
      </div>

      {/* Main 2-Panel Control Grid */}
      <div className="dashboard-main-grid">
        {/* Left: Active Outbound Shipments & Staging Queue */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-title-icon">🚚</span>
              <div>
                <h3 className="card-title">Outbound Shipments & JIT Schedule (Plant 2 IMT)</h3>
                <span className="card-subtitle">Direct line-feed to Maruti Suzuki, Tata Motors, M&M, and Honda</span>
              </div>
            </div>

            <div className="filter-pill-row">
              <button
                className={`filter-pill-compact ${filterOEM === 'all' ? 'active' : ''}`}
                onClick={() => setFilterOEM('all')}
              >
                All OEMs
              </button>
              <button
                className={`filter-pill-compact ${filterOEM === 'MSIL' ? 'active' : ''}`}
                onClick={() => setFilterOEM('MSIL')}
              >
                Maruti Suzuki (MSIL)
              </button>
              <button
                className={`filter-pill-compact ${filterOEM === 'TML' ? 'active' : ''}`}
                onClick={() => setFilterOEM('TML')}
              >
                Tata Motors
              </button>
            </div>
          </div>

          <div className="compact-table-container">
            <table className="compact-enterprise-table">
              <thead>
                <tr>
                  <th>ORDER ID</th>
                  <th>OEM DESTINATION</th>
                  <th>AUTO COMPONENT / ASSEMBLY</th>
                  <th>PACKAGING TYPE</th>
                  <th>GROSS WT</th>
                  <th>JIT TARGET</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice(0, 7).map(order => {
                  const cust = getCustomer(order.customerId)
                  const part = getPart(order.partId)
                  return (
                    <tr key={order.id}>
                      <td className="font-mono text-bold">{order.id.split('-').pop()}</td>
                      <td>
                        <span className="oem-chip">{cust?.code}</span>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{cust?.plant}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{part?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{part?.partNo} • {part?.category}</div>
                      </td>
                      <td>
                        <span className="container-type-chip">{order.bins}× {order.containerType}</span>
                      </td>
                      <td className="font-mono">{order.weight.toLocaleString()} kg</td>
                      <td>
                        <span className={`badge badge-${getPriorityColor(order.priority)}`}>
                          ⏱️ {order.dueTime}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${order.status === 'qa-passed' ? 'green' : 'amber'}`}>
                          {getStatusLabel(order.status).label}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-table-action"
                          onClick={() => onNavigate('loadPlanner')}
                          title="Plan in 3D Load Engine"
                        >
                          Plan 3D ↗
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Returnable Packaging Stillages & Bay Heatmap */}
        <div className="dashboard-side-column">
          {/* Returnable Packaging Stillage Inventory */}
          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-title-icon">📦</span>
                <div>
                  <h3 className="card-title">Returnable Packaging Inventory</h3>
                  <span className="card-subtitle">Active stillages, trolleys & bins in circulation</span>
                </div>
              </div>
            </div>

            <div className="stillage-list">
              {Object.entries(containerInventory).map(([type, inv]) => {
                const availPct = Math.round((inv.availableAtPlant / inv.total) * 100)
                return (
                  <div key={type} className="stillage-row">
                    <div className="stillage-info">
                      <div className="stillage-name">{type}</div>
                      <div className="stillage-sub">
                        Turnaround: <strong>{inv.turnaroundDays} days</strong> • Unit Cost: ₹{inv.unitValueInr.toLocaleString()}
                      </div>
                    </div>
                    <div className="stillage-stat">
                      <div className="stillage-counts">
                        <span className="text-bold">{inv.availableAtPlant} ready</span>
                        <span className="text-muted">/ {inv.total} total</span>
                      </div>
                      <div className="progress-bar-micro">
                        <div
                          className={`progress-fill ${availPct < 25 ? 'critical' : availPct < 40 ? 'warn' : 'ok'}`}
                          style={{ width: `${availPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Plant 2 Loading Bay Real-Time Status */}
          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-title-icon">🏗️</span>
                <div>
                  <h3 className="card-title">Loading Docks (Sector 8 IMT)</h3>
                  <span className="card-subtitle">Live dock bay occupancy and turn-around times</span>
                </div>
              </div>
            </div>

            <div className="dock-mini-grid">
              {dockSlots.map(slot => (
                <div key={slot.id} className={`dock-mini-card ${slot.status}`}>
                  <div className="dock-mini-header">
                    <strong>{slot.dock.split('(')[0]}</strong>
                    <span className={`dock-status-pill ${slot.status}`}>
                      {slot.status === 'in-progress' ? 'LOADING' : slot.status === 'completed' ? 'CLEAR' : 'QUEUED'}
                    </span>
                  </div>
                  <div className="dock-vehicle font-mono">
                    {slot.vehicleReg || 'Bay Empty (Staged)'}
                  </div>
                  <div className="dock-customer">
                    {slot.customer}
                  </div>
                  {slot.status === 'in-progress' && (
                    <div className="dock-progress-wrapper">
                      <div className="progress-bar-micro">
                        <div className="progress-fill ok" style={{ width: `${slot.loadingProgress}%` }} />
                      </div>
                      <span className="dock-pct">{slot.loadingProgress}% loaded</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
