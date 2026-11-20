export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <span className="logo-jbm">JBM</span>
          </div>
          <div className="sidebar-logo-text">
            <h1>JBM LoadIQ</h1>
            <span className="logo-sub">Auto Components Division</span>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">EXECUTIVE OVERVIEW</div>
        <div
          className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <span className="nav-item-icon">📊</span>
          <span>Plant Control Tower</span>
        </div>

        <div className="nav-section-label">OUTBOUND & JIT LOGISTICS</div>
        <div
          className={`nav-item ${activePage === 'loadPlanner' ? 'active' : ''}`}
          onClick={() => onNavigate('loadPlanner')}
        >
          <span className="nav-item-icon">📦</span>
          <span>Volumetric Load Planner</span>
          <span className="nav-badge-pill">12</span>
        </div>
        <div
          className={`nav-item ${activePage === 'dockScheduler' ? 'active' : ''}`}
          onClick={() => onNavigate('dockScheduler')}
        >
          <span className="nav-item-icon">🏗️</span>
          <span>Dock & Bay Scheduler</span>
          <span className="nav-dot-amber"></span>
        </div>
        <div
          className={`nav-item ${activePage === 'dispatchQueue' ? 'active' : ''}`}
          onClick={() => onNavigate('dispatchQueue')}
        >
          <span className="nav-item-icon">🚀</span>
          <span>Dispatch & Gate Pass</span>
          <span className="nav-badge-pill">3</span>
        </div>
        <div
          className={`nav-item ${activePage === 'compliance' ? 'active' : ''}`}
          onClick={() => onNavigate('compliance')}
        >
          <span className="nav-item-icon">🛡️</span>
          <span>CMVR & E-Way Engine</span>
          <span className="nav-badge-pass">PASS</span>
        </div>

        <div className="nav-section-label">ASSETS & RETURNABLE PACKAGING</div>
        <div
          className={`nav-item ${activePage === 'fleet' ? 'active' : ''}`}
          onClick={() => onNavigate('fleet')}
        >
          <span className="nav-item-icon">🚚</span>
          <span>Fleet & Stillages</span>
        </div>
      </nav>

      {/* Sidebar Footer — Plant Info & SLA Tracker */}
      <div className="sidebar-footer">
        <div className="oem-sla-widget">
          <div className="sla-header">
            <span className="sla-dot-green"></span>
            <strong>MSIL Manesar Line 1/2</strong>
          </div>
          <div className="sla-meter">
            <div className="sla-bar-fill" style={{ width: '96%' }}></div>
          </div>
          <div className="sla-labels">
            <span>On-Time JIT SLA</span>
            <strong>99.4%</strong>
          </div>
        </div>

        <div className="plant-selector">
          <div className="plant-avatar">P2</div>
          <div className="plant-selector-info">
            <strong>Manesar Plant 2 (IMT)</strong>
            <span>Welded Assemblies & BIW</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
