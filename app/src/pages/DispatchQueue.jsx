import { useState } from 'react'
import { pendingOrders, fleet, customers, getCustomer, getPart, getVehicle, getVehicleType } from '../data/seedData'

const dispatchQueueInitial = [
  {
    id: 'LP-261031-01',
    vehicleId: 'VH-003',
    vehicleReg: 'HR-55-DM-1290',
    orderIds: ['ORD-20261031-001', 'ORD-20261031-002'],
    destination: 'Maruti Suzuki — Manesar Plant 2 Gate 4',
    status: 'loading',
    dock: 'Dock 1 (Direct MSIL Bay)',
    plannedDeparture: '11:15',
    eta: '11:55',
    totalWeight: 4659,
    loadProgress: 75,
    ewayBill: '281489028820',
    irnNo: 'e1f2a3b4c5d6...',
    compliance: { invoice: true, ewayBill: true, materialSummary: true, tripDetails: true, axleCheck: true },
  },
  {
    id: 'LP-261031-02',
    vehicleId: 'VH-001',
    vehicleReg: 'HR-26-EE-4521',
    orderIds: ['ORD-20261031-004'],
    destination: 'Maruti Suzuki — Gurgaon Old Delhi Road',
    status: 'ready-to-dispatch',
    dock: 'Dock 2 (Gurgaon Milk Run)',
    plannedDeparture: '11:45',
    eta: '12:40',
    totalWeight: 616,
    loadProgress: 100,
    ewayBill: '281489028821',
    irnNo: 'f2a3b4c5d6e1...',
    compliance: { invoice: true, ewayBill: true, materialSummary: true, tripDetails: true, axleCheck: true },
  },
  {
    id: 'LP-261031-03',
    vehicleId: 'VH-002',
    vehicleReg: 'HR-55-CK-7832',
    orderIds: ['ORD-20261031-005'],
    destination: 'Tata Motors Electric (TPEM) — Sanand GIDC',
    status: 'doc-pending',
    dock: 'Dock 3 (Long-Haul Multi-Axle)',
    plannedDeparture: '13:00',
    eta: 'Tomorrow 06:30',
    totalWeight: 828,
    loadProgress: 30,
    ewayBill: 'Pending NIC Generation',
    irnNo: 'Pending IRN Approval',
    compliance: { invoice: true, ewayBill: false, materialSummary: true, tripDetails: true, axleCheck: true },
  },
  {
    id: 'LP-261031-04',
    vehicleId: 'VH-004',
    vehicleReg: 'HR-26-FN-5567',
    orderIds: ['ORD-20261031-010'],
    destination: 'JBM Faridabad Plant 3 (Internal Sub-Assembly Transfer)',
    status: 'loading',
    dock: 'Dock 6 (Inter-Plant Bay)',
    plannedDeparture: '11:30',
    eta: '12:45',
    totalWeight: 875,
    loadProgress: 40,
    ewayBill: '281489028822',
    irnNo: 'Intra-Company Delivery Challan',
    compliance: { invoice: true, ewayBill: true, materialSummary: true, tripDetails: true, axleCheck: true },
  }
]

export default function DispatchQueue() {
  const [queue, setQueue] = useState(dispatchQueueInitial)
  const [selectedPlan, setSelectedPlan] = useState(dispatchQueueInitial[0])
  const [gatePassSuccess, setGatePassSuccess] = useState(false)

  const handleAuthorizeGatePass = (planId) => {
    setGatePassSuccess(true)
    setTimeout(() => {
      setQueue(prev =>
        prev.map(p =>
          p.id === planId ? { ...p, status: 'dispatched' } : p
        )
      )
      setGatePassSuccess(false)
    }, 1500)
  }

  return (
    <div className="dispatch-queue-container">
      {/* Executive Command Header */}
      <div className="planner-command-bar">
        <div className="command-left">
          <div className="command-title-row">
            <span className="brand-pill">OUTBOUND DISPATCH</span>
            <h2 className="command-title">Outbound Dispatch Queue & Gate Clearance</h2>
            <span className="badge badge-success">Automated RFID Gate Pass</span>
          </div>
          <p className="command-subtitle">
            Pre-departure verification of NIC E-Way bills, SAP delivery challans, tare/gross weighbridge readings, and driver OTP authentication.
          </p>
        </div>

        <div className="command-actions">
          <button className="btn btn-secondary btn-sm">
            🖨️ Batch Manifests
          </button>
          <button className="btn btn-primary btn-sm">
            Gate RFID Scanner Live
          </button>
        </div>
      </div>

      {/* Grid: Queue Table on Left, Live Manifest Clearance Card on Right */}
      <div className="dispatch-main-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-title-icon">🚀</span>
              <div>
                <h3 className="card-title">Live Dispatch Queue ({queue.length} Active Loads)</h3>
                <span className="card-subtitle">Select a load plan to review pre-departure clearance</span>
              </div>
            </div>
          </div>

          <div className="compact-table-container">
            <table className="compact-enterprise-table">
              <thead>
                <tr>
                  <th>PLAN ID</th>
                  <th>CARRIER VEHICLE</th>
                  <th>DESTINATION OEM</th>
                  <th>GROSS WT</th>
                  <th>LOAD STATUS</th>
                  <th>E-WAY BILL</th>
                  <th>GATE PASS</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(item => {
                  const isSelected = selectedPlan?.id === item.id
                  const allCompliant = Object.values(item.compliance).every(Boolean)
                  return (
                    <tr
                      key={item.id}
                      className={isSelected ? 'row-selected' : ''}
                      onClick={() => setSelectedPlan(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="font-mono text-bold">{item.id}</td>
                      <td>
                        <div className="font-mono text-bold">{item.vehicleReg}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.dock}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.destination}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          Departure: {item.plannedDeparture} • ETA: {item.eta}
                        </div>
                      </td>
                      <td className="font-mono">{(item.totalWeight / 1000).toFixed(2)}T</td>
                      <td>
                        <div className="load-status-cell">
                          <span className={`status-pill ${item.status === 'dispatched' ? 'green' : item.status === 'ready-to-dispatch' ? 'green' : 'amber'}`}>
                            {item.status.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>
                            {item.loadProgress}%
                          </span>
                        </div>
                      </td>
                      <td>
                        {item.compliance.ewayBill ? (
                          <span className="badge badge-success font-mono font-xs">
                            ✓ {item.ewayBill.substring(0, 8)}...
                          </span>
                        ) : (
                          <span className="badge badge-danger font-xs">PENDING</span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`btn-table-action ${allCompliant ? 'btn-action-primary' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAuthorizeGatePass(item.id)
                          }}
                          disabled={!allCompliant || item.status === 'dispatched'}
                        >
                          {item.status === 'dispatched' ? 'Cleared ✓' : 'Release ↗'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Load Plan Inspection Panel */}
        {selectedPlan && (
          <div className="card dispatch-detail-card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="card-title-icon">📑</span>
                <div>
                  <h3 className="card-title font-mono">{selectedPlan.id} Clearance Manifest</h3>
                  <span className="card-subtitle">{selectedPlan.destination}</span>
                </div>
              </div>
              <span className={`status-pill ${selectedPlan.status === 'dispatched' ? 'green' : 'amber'}`}>
                {selectedPlan.status.toUpperCase()}
              </span>
            </div>

            <div className="dispatch-detail-body">
              <div className="detail-stat-grid">
                <div className="detail-stat">
                  <span className="stat-label">ASSIGNED VEHICLE</span>
                  <strong className="stat-val font-mono">{selectedPlan.vehicleReg}</strong>
                </div>
                <div className="detail-stat">
                  <span className="stat-label">DOCK BAY</span>
                  <strong className="stat-val">{selectedPlan.dock}</strong>
                </div>
                <div className="detail-stat">
                  <span className="stat-label">TOTAL PAYLOAD</span>
                  <strong className="stat-val font-mono">{selectedPlan.totalWeight.toLocaleString()} kg</strong>
                </div>
                <div className="detail-stat">
                  <span className="stat-label">PLANNED DEPARTURE</span>
                  <strong className="stat-val text-accent">{selectedPlan.plannedDeparture} (ETA: {selectedPlan.eta})</strong>
                </div>
              </div>

              {/* Compliance Checklist */}
              <div className="dispatch-compliance-box">
                <div className="compliance-box-title">Automated Pre-Dispatch Audit Checks</div>
                <div className="compliance-checklist">
                  <div className="check-row">
                    <span>GST Tax Invoice Generated (SAP ECC)</span>
                    <span className="badge badge-success">✓ PASS</span>
                  </div>
                  <div className="check-row">
                    <span>National E-Way Bill (NIC 12-Digit)</span>
                    <span className={`badge ${selectedPlan.compliance.ewayBill ? 'badge-success' : 'badge-danger'}`}>
                      {selectedPlan.compliance.ewayBill ? `✓ ${selectedPlan.ewayBill}` : '✗ PENDING'}
                    </span>
                  </div>
                  <div className="check-row">
                    <span>CMVR MoRTH Axle Weight Compliance</span>
                    <span className="badge badge-success">✓ WITHIN LEGAL GVW</span>
                  </div>
                  <div className="check-row">
                    <span>Returnable Stillages RFID Scanned</span>
                    <span className="badge badge-success">✓ 100% SERIALIZED</span>
                  </div>
                  <div className="check-row">
                    <span>Driver VAHAN License & FASTag Tag</span>
                    <span className="badge badge-success">✓ VALIDATED</span>
                  </div>
                </div>
              </div>

              {/* Gate Pass Action */}
              <div className="dispatch-action-area">
                {gatePassSuccess ? (
                  <div className="dispatch-success-banner">
                    <span>✓ Digital Gate Pass Authorized! Security RFID Barrier Open.</span>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary btn-lg"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => handleAuthorizeGatePass(selectedPlan.id)}
                    disabled={selectedPlan.status === 'dispatched'}
                  >
                    {selectedPlan.status === 'dispatched'
                      ? '✓ Convoy Departed & In-Transit'
                      : 'Authorize Outbound Security Gate Pass'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
