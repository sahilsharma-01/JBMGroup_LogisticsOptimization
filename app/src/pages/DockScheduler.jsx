import { useState } from 'react'
import { dockSlots, fleet, getVehicle } from '../data/seedData'

const timeSlots = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']

function getSlotPosition(startTime, endTime) {
  const parseTime = t => {
    const [h, m] = t.split(':').map(Number)
    return h + m / 60
  }
  const start = parseTime(startTime) - 7 // 7:00 is start
  const end = parseTime(endTime) - 7
  const totalHours = 11 // 7AM to 6PM
  return {
    left: `${Math.max((start / totalHours) * 100, 0)}%`,
    width: `${Math.max(((end - start) / totalHours) * 100, 4)}%`,
  }
}

export default function DockScheduler() {
  const [selectedDockFilter, setSelectedDockFilter] = useState('all')

  return (
    <div className="dock-scheduler-container">
      {/* Executive Command Header */}
      <div className="planner-command-bar">
        <div className="command-left">
          <div className="command-title-row">
            <span className="brand-pill">BAY OPERATIONS</span>
            <h2 className="command-title">Plant 2 Loading Dock & Staging Bay Gantt</h2>
            <span className="badge badge-success">6 Bays Operational</span>
          </div>
          <p className="command-subtitle">
            Synchronized dock scheduling preventing OEM line starvation, managing returnable stillages, and eliminating vehicle turnaround bottlenecks.
          </p>
        </div>

        <div className="command-actions">
          <button className="btn btn-secondary btn-sm">
            ⏱️ Dock Analytics
          </button>
          <button className="btn btn-primary btn-sm">
            + Reserve Emergency Bay Slot
          </button>
        </div>
      </div>

      {/* Congestion Alert */}
      <div className="alert-banner warning">
        <div className="alert-content">
          <span className="alert-icon">⚠️</span>
          <div>
            <strong>Predicted Bay Congestion at 11:00 – 12:30:</strong> Docks 2, 3, and 6 simultaneous loading. Overhead crane 2 assigned to MSIL dedicated bay.
            <span className="alert-sla">Recommended turnaround: 45 minutes.</span>
          </div>
        </div>
      </div>

      {/* Dock KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">TOTAL ACTIVE BAYS</span>
            <span className="kpi-badge green">ALL HYDRAULIC</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">6 Bays</span>
            <span className="kpi-unit">Plant 2 IMT</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot green"></span>
            Bay 1 (Dedicated MSIL) • Bay 4 (Empty Stillages)
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">AVERAGE BAY TURNAROUND</span>
            <span className="kpi-badge green">TARGET &lt; 50m</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">44.2</span>
            <span className="kpi-unit">Minutes</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot green"></span>
            Reduced from 78m via 3D Pre-sequencing
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">STAGED STILLAGES READY</span>
            <span className="kpi-badge blue">DOCK APRON</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">64</span>
            <span className="kpi-unit">Stillages</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot blue"></span>
            Forklift Team Alpha Assigned
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-title">OVERHEAD CRANE UTILIZATION</span>
            <span className="kpi-badge amber">CRANE 1 & 2</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-metric">78%</span>
            <span className="kpi-unit">Duty Cycle</span>
          </div>
          <div className="kpi-footer-sub">
            <span className="status-dot amber"></span>
            Handling Heavy BIW Subframe Racks
          </div>
        </div>
      </div>

      {/* Dock Gantt Timeline Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <span className="card-title-icon">📊</span>
            <div>
              <h3 className="card-title">Outbound Bay Gantt Schedule (Shift A & Shift B)</h3>
              <span className="card-subtitle">Red vertical needle marks current plant time (10:30 AM)</span>
            </div>
          </div>
        </div>

        <div className="gantt-wrapper">
          {/* Timeline Header */}
          <div className="gantt-header-row">
            <div className="gantt-label-col">LOADING DOCK</div>
            <div className="gantt-timeline-track">
              {timeSlots.map(t => (
                <div key={t} className="gantt-time-mark font-mono">
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Dock Rows */}
          {dockSlots.map(slot => {
            const pos = getSlotPosition(slot.startTime, slot.endTime)
            return (
              <div key={slot.id} className="gantt-lane-row">
                <div className="gantt-dock-info">
                  <strong>{slot.dock.split('(')[0]}</strong>
                  <span className="gantt-dock-sub">{slot.dock.split('(')[1]?.replace(')', '') || 'General Bay'}</span>
                </div>

                <div className="gantt-lane-track">
                  {/* Current Time Needle at 10:30 AM */}
                  <div
                    className="gantt-now-indicator"
                    style={{ left: `${((10.5 - 7) / 11) * 100}%` }}
                    title="Current Time: 10:30 AM"
                  />

                  {/* Scheduled Slot Bar */}
                  <div
                    className={`gantt-slot-bar ${slot.status}`}
                    style={{ left: pos.left, width: pos.width }}
                  >
                    <div className="slot-bar-title font-mono">
                      {slot.vehicleReg || 'Empty Inward'}
                    </div>
                    <div className="slot-bar-sub">
                      {slot.customer} • {slot.startTime}–{slot.endTime}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
