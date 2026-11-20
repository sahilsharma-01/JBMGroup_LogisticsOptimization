import { useState } from 'react'
import { fleet, vehicleTypes, getVehicleType } from '../data/seedData'

export default function FleetView() {
  const [filterType, setFilterType] = useState('all')

  const statusConfig = {
    available: { badge: 'success', label: 'Ready at Yard', dot: 'green' },
    loading: { badge: 'warning', label: 'At Dock Bay', dot: 'amber' },
    dispatched: { badge: 'info', label: 'En-Route (GPS)', dot: 'blue' },
    maintenance: { badge: 'danger', label: 'In Workshop', dot: 'red' },
  }

  const filteredFleet = filterType === 'all'
    ? fleet
    : fleet.filter(v => v.typeId === filterType)

  return (
    <div className="fleet-view-container">
      {/* Executive Command Header */}
      <div className="planner-command-bar">
        <div className="command-left">
          <div className="command-title-row">
            <span className="brand-pill">FLEET & ASSETS</span>
            <h2 className="command-title">Dedicated Automotive Carrier Fleet & Telematics</h2>
            <span className="badge badge-success">AIS-140 GPS Online</span>
          </div>
          <p className="command-subtitle">
            CMVR statutory compliance, FASTag automated tolling, VAHAN fitness registry, and returnable stillage asset tracking.
          </p>
        </div>

        <div className="command-actions">
          <button className="btn btn-secondary btn-sm">
            📡 Sync VAHAN Portal
          </button>
          <button className="btn btn-primary btn-sm">
            + Indent Dedicated Carrier
          </button>
        </div>
      </div>

      {/* Fleet Status Summary Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">TOTAL CARRIER FLEET</span>
            <span className="kpi-badge green">ALL VERIFIED</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">{fleet.length}</span>
            <span className="kpi-unit">Dedicated Trucks</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot green"></span>
            <strong>{fleet.filter(v => v.status === 'available').length} Available</strong> at Plant 2 Hub
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">IN-TRANSIT CONVOYS</span>
            <span className="kpi-badge blue">LIVE TRACKING</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">{fleet.filter(v => v.status === 'dispatched').length}</span>
            <span className="kpi-unit">Trucks En-Route</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot blue"></span>
            NH-48 Expressway & Western Corridor
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">FASTAG WALLET BALANCE</span>
            <span className="kpi-badge green">AUTO-RECHARGE</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">₹38,200</span>
            <span className="kpi-unit">Fleet Pool</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot green"></span>
            Zero Toll Gate Delays
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">RETURNABLE PACKAGING VALUE</span>
            <span className="kpi-badge amber">CIRCULATION</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">₹1.84 Cr</span>
            <span className="kpi-unit">Stillages & Bins</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot amber"></span>
            Turnaround Cycle: <strong>2.1 Days</strong>
          </div>
        </div>
      </div>

      {/* Fleet Table Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <span className="card-title-icon">🚚</span>
            <div>
              <h3 className="card-title">Commercial Vehicle Telematics & Compliance Roster</h3>
              <span className="card-subtitle">Real-time status, driver credentials, and CMVR payload certifications</span>
            </div>
          </div>

          <div className="filter-pill-row">
            <button
              className={`filter-pill-compact ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              All Types ({fleet.length})
            </button>
            {vehicleTypes.map(vt => (
              <button
                key={vt.id}
                className={`filter-pill-compact ${filterType === vt.id ? 'active' : ''}`}
                onClick={() => setFilterType(vt.id)}
              >
                {vt.name.split('(')[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="compact-table-container">
          <table className="compact-enterprise-table">
            <thead>
              <tr>
                <th>REGISTRATION NO</th>
                <th>VEHICLE SPECIFICATION</th>
                <th>PAYLOAD & VOLUME</th>
                <th>DRIVER & TRANSPORTER</th>
                <th>TELEMATICS LOCATION</th>
                <th>FASTAG & FITNESS</th>
                <th>STATUS</th>
                <th>TELEMATICS</th>
              </tr>
            </thead>
            <tbody>
              {filteredFleet.map(vehicle => {
                const vt = getVehicleType(vehicle.typeId)
                const config = statusConfig[vehicle.status]
                return (
                  <tr key={vehicle.id}>
                    <td>
                      <div className="font-mono text-bold font-lg">{vehicle.regNo}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{vehicle.id}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{vt?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {vt?.axleConfig} • GVW: {((vt?.gvwKg || 12000) / 1000).toFixed(1)}T
                      </div>
                    </td>
                    <td>
                      <span className="text-bold">{((vt?.maxWeight || 10000) / 1000).toFixed(1)}T</span> / {vt?.maxVolume} m³
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{vehicle.driver}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{vehicle.driverPhone} • {vehicle.transporter}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{vehicle.currentLocation}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        📡 {vehicle.gpsSignal}
                      </div>
                    </td>
                    <td>
                      <div>FASTag: <strong>₹{vehicle.fastagBalance.toLocaleString()}</strong></div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Fitness: {vehicle.fitnessExpiry}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${config.dot}`}>
                        {config.label}
                      </span>
                    </td>
                    <td>
                      <button className="btn-table-action">
                        Live GPS ↗
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
