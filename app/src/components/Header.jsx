import { useState, useEffect } from 'react'
import { plants } from '../data/seedData'

export default function Header({ title, breadcrumb }) {
  const [selectedPlant, setSelectedPlant] = useState('PLANT-MNSR-2')
  const [currentTime, setCurrentTime] = useState('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        })
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="top-header">
      <div className="header-left">
        <div>
          <div className="header-title">{title}</div>
          <div className="header-breadcrumb">
            {breadcrumb.map((item, i) => (
              <span key={i}>
                {i > 0 && <span className="breadcrumb-separator">/</span>}
                <span className={i === breadcrumb.length - 1 ? 'active' : ''}>
                  {item}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="header-right">
        {/* Plant Switcher */}
        <div className="header-plant-box">
          <span className="plant-pin">📍</span>
          <select
            className="header-plant-select"
            value={selectedPlant}
            onChange={e => setSelectedPlant(e.target.value)}
          >
            {plants.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Integration Status Badges */}
        <div className="header-status-strip">
          <div className="system-pill" title="SAP ECC 6.0 / S/4HANA Plant 1020 Live Interface">
            <span className="status-dot green"></span>
            <span>SAP S/4HANA</span>
          </div>
          <div className="system-pill" title="NIC National E-Way Bill API Gateway">
            <span className="status-dot green"></span>
            <span>NIC E-Way Bill</span>
          </div>
          <div className="system-pill shift-pill" title="Current Manufacturing & Dispatch Shift">
            <span className="shift-icon">⏱️</span>
            <span>Shift A (06:00 - 14:00)</span>
            <strong className="time-display">{currentTime}</strong>
          </div>
        </div>

        {/* Search */}
        <div className="header-search">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search orders, trucks, E-Way bills..."
            className="header-search-input"
          />
          <kbd>⌘K</kbd>
        </div>

        {/* Action icons */}
        <button className="header-icon-btn" title="Live OEM Dispatch Notifications">
          🔔
          <span className="notification-dot"></span>
        </button>

        <div className="header-profile" title="Outbound Logistics Superintendent">
          <div className="profile-avatar">JBM</div>
          <div className="profile-details">
            <span className="profile-name">Logistics Control</span>
            <span className="profile-role">Manesar Plant 2</span>
          </div>
        </div>
      </div>
    </header>
  )
}
