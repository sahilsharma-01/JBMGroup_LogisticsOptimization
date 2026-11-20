import { useState } from 'react'
import './index.css'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import LoadPlanner from './pages/LoadPlanner'
import DockScheduler from './pages/DockScheduler'
import DispatchQueue from './pages/DispatchQueue'
import FleetView from './pages/FleetView'
import Compliance from './pages/Compliance'

const pages = {
  dashboard: { component: Dashboard, title: 'Operations Dashboard', breadcrumb: ['Home', 'Dashboard'] },
  loadPlanner: { component: LoadPlanner, title: 'Volumetric Load Planner', breadcrumb: ['Outbound', 'Load Planner'] },
  dockScheduler: { component: DockScheduler, title: 'Dock Scheduler', breadcrumb: ['Outbound', 'Dock Scheduler'] },
  dispatchQueue: { component: DispatchQueue, title: 'Dispatch Queue', breadcrumb: ['Outbound', 'Dispatch Queue'] },
  fleet: { component: FleetView, title: 'Fleet Management', breadcrumb: ['Assets', 'Fleet'] },
  compliance: { component: Compliance, title: 'Compliance Engine', breadcrumb: ['Outbound', 'Compliance'] },
}

function App() {
  const [activePage, setActivePage] = useState('dashboard')

  const currentPage = pages[activePage]
  const PageComponent = currentPage.component

  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="main-content">
        <Header title={currentPage.title} breadcrumb={currentPage.breadcrumb} />
        <div className="page-content">
          <PageComponent onNavigate={setActivePage} />
        </div>
      </main>
    </div>
  )
}

export default App
