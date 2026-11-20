import { useState } from 'react'

const complianceRules = [
  { id: 'CMVR_AXLE', name: 'MoRTH CMVR Section 93 Axle Load Limit', description: 'Front steer axle & rear tandem axle loads within CMVR legal rating. Automatic e-challan immunity.', category: 'Statutory' },
  { id: 'EWAY_NIC', name: 'NIC National E-Way Bill 12-Digit Active', description: 'Active validity window, exact HSN code 8708 (auto parts), vehicle registration verified on VAHAN.', category: 'Statutory' },
  { id: 'SAP_S4_GI', name: 'SAP S/4HANA Goods Issue (GI) 1020', description: 'Automated 601 movement type posting matching physical stillage count and Part BOM numbers.', category: 'ERP / SAP' },
  { id: 'OEM_JIT_WINDOW', name: 'Maruti Suzuki / OEM JIT Delivery Window', description: 'Gate entry schedule synchronized with MSIL plant line takt time. Avoids line-stoppage penalty.', category: 'OEM SLA' },
  { id: 'PACK_STILLAGE', name: 'Returnable Stillage & RFID Serialization', description: 'Tare weight calibration, corner locking pins inspected, zero structural deformation.', category: 'Packaging' },
  { id: 'SKIN_PANEL_RUBBER', name: 'Class-A Surface Protection Protocol', description: 'EPDM rubber cushions and foam interleaving verified for stamped skin panels (Roof/Door).', category: 'Quality' },
  { id: 'AIS140_TELEMATICS', name: 'AIS-140 GPS & Emergency Panic Button', description: 'Certified telematics pinging every 10 seconds to state logistics command center.', category: 'Safety' },
  { id: 'FASTAG_ACTIVE', name: 'National Electronic Toll Collection (FASTag)', description: 'Toll tag authenticated with minimum ₹2,000 balance for zero-stop highway corridor.', category: 'Logistics' }
]

const recentVerifications = [
  {
    id: 'AUD-261031-01',
    loadPlanId: 'LP-261031-01',
    vehicle: 'HR-55-DM-1290',
    destination: 'Maruti Suzuki — Manesar Plant 2',
    timestamp: '10:15 AM',
    verifiedBy: 'Suresh Kumar (Chief Inspector)',
    results: { CMVR_AXLE: true, EWAY_NIC: true, SAP_S4_GI: true, OEM_JIT_WINDOW: true, PACK_STILLAGE: true, SKIN_PANEL_RUBBER: true, AIS140_TELEMATICS: true, FASTAG_ACTIVE: true },
    overallStatus: 'pass',
    score: 100,
  },
  {
    id: 'AUD-261031-02',
    loadPlanId: 'LP-261031-02',
    vehicle: 'HR-26-EE-4521',
    destination: 'Maruti Suzuki — Gurgaon Plant',
    timestamp: '10:35 AM',
    verifiedBy: 'Amitav Sharma (Dock Lead)',
    results: { CMVR_AXLE: true, EWAY_NIC: true, SAP_S4_GI: true, OEM_JIT_WINDOW: true, PACK_STILLAGE: true, SKIN_PANEL_RUBBER: true, AIS140_TELEMATICS: true, FASTAG_ACTIVE: true },
    overallStatus: 'pass',
    score: 100,
  },
  {
    id: 'AUD-261031-03',
    loadPlanId: 'LP-261031-03',
    vehicle: 'HR-55-CK-7832',
    destination: 'Tata Motors Electric — Sanand',
    timestamp: '10:48 AM',
    verifiedBy: 'Rajeshwar Yadav (Compliance)',
    results: { CMVR_AXLE: true, EWAY_NIC: false, SAP_S4_GI: true, OEM_JIT_WINDOW: true, PACK_STILLAGE: true, SKIN_PANEL_RUBBER: true, AIS140_TELEMATICS: true, FASTAG_ACTIVE: true },
    overallStatus: 'action-required',
    score: 87.5,
  }
]

export default function Compliance() {
  const [selectedAudit, setSelectedAudit] = useState(recentVerifications[0])

  return (
    <div className="compliance-page-container">
      {/* Executive Command Header */}
      <div className="planner-command-bar">
        <div className="command-left">
          <div className="command-title-row">
            <span className="brand-pill">STATUTORY COMPLIANCE</span>
            <h2 className="command-title">Automotive OEM Pre-Dispatch Compliance Engine</h2>
            <span className="badge badge-success">Audit Pass Rate: 98.8%</span>
          </div>
          <p className="command-subtitle">
            Automated verification of CMVR axle safety limits, NIC national E-Way bills, SAP S/4HANA goods issues, and Class-A packaging standards.
          </p>
        </div>

        <div className="command-actions">
          <button className="btn btn-secondary btn-sm">
            📄 Export Audit Log (PDF)
          </button>
          <button className="btn btn-primary btn-sm">
            ⚡ Run Pre-Dispatch Rule Engine
          </button>
        </div>
      </div>

      {/* Rules KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">RULES MONITORED</span>
            <span className="kpi-badge green">8 ACTIVE</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">100%</span>
            <span className="kpi-unit">Coverage</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot green"></span>
            Statutory, ERP, Safety & Packaging
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">CMVR OVERLOAD RISK</span>
            <span className="kpi-badge green">0.00%</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">0</span>
            <span className="kpi-unit">Violations</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot green"></span>
            Weighbridge Calibrated Daily
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">NIC E-WAY REJECTION</span>
            <span className="kpi-badge green">ZERO REJECTIONS</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">100%</span>
            <span className="kpi-unit">First-Pass Match</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot green"></span>
            HSN 8708 GST Verification
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">MSIL JIT PENALTY EXPOSURE</span>
            <span className="kpi-badge green">ZERO PENALTY</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">₹0</span>
            <span className="kpi-unit">This Month</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot green"></span>
            Line 1 & 2 100% On-Time Delivery
          </div>
        </div>
      </div>

      {/* Main Layout: Rules Grid + Recent Verification Audit Log */}
      <div className="compliance-main-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-title-icon">🛡️</span>
              <div>
                <h3 className="card-title">Automated Compliance Rules Master</h3>
                <span className="card-subtitle">Real-time gatekeeper checks before security seal authorization</span>
              </div>
            </div>
          </div>

          <div className="compact-table-container">
            <table className="compact-enterprise-table">
              <thead>
                <tr>
                  <th>RULE ID</th>
                  <th>STATUTORY / OPERATIONAL CRITERIA</th>
                  <th>CATEGORY</th>
                  <th>ENFORCEMENT</th>
                </tr>
              </thead>
              <tbody>
                {complianceRules.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-bold">{r.id}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {r.description}
                      </div>
                    </td>
                    <td>
                      <span className="rule-cat-chip">{r.category}</span>
                    </td>
                    <td>
                      <span className="status-pill green">MANDATORY GATE BLOCK</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Audit Results */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <span className="card-title-icon">📋</span>
              <div>
                <h3 className="card-title">Recent Pre-Dispatch Audits</h3>
                <span className="card-subtitle">Automated pass/fail breakdown per vehicle</span>
              </div>
            </div>
          </div>

          <div className="audit-items-list">
            {recentVerifications.map(audit => (
              <div
                key={audit.id}
                className={`audit-item-row ${selectedAudit?.id === audit.id ? 'active' : ''}`}
                onClick={() => setSelectedAudit(audit)}
              >
                <div className="audit-row-top">
                  <div>
                    <span className="font-mono text-bold">{audit.id}</span>
                    <span className="font-mono text-accent" style={{ marginLeft: 8 }}>{audit.vehicle}</span>
                  </div>
                  <span className={`status-pill ${audit.overallStatus === 'pass' ? 'green' : 'amber'}`}>
                    {audit.score}% {audit.overallStatus.toUpperCase()}
                  </span>
                </div>
                <div className="audit-dest">{audit.destination}</div>
                <div className="audit-meta">
                  <span>⏱️ {audit.timestamp}</span>
                  <span>👤 {audit.verifiedBy}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
