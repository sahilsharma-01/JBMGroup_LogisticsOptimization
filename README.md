# JBMGroup_LogisticsOptimization

> **JBM LoadIQ**: Enterprise-grade 3D Volumetric Load Optimization, Axle Load Physics, Dynamic Stability, and Outbound Logistics Platform for JBM Group.

---

## 📌 Overview

**JBM Logistics Optimization Platform (LoadIQ)** is an advanced operations engineering platform designed for automotive manufacturing and freight logistics. It automates 3D multi-drop container loading, real-time axle weight distribution compliance, tie-down/securing verification, ride simulation, and dock scheduling.

---

## 🚀 Key Features & Capabilities

### 1. 3D Volumetric Packing Engine (`JBM LoadIQ`)
- **Column Building**: Pre-stacks identical handling units (pallets, steel bins, crates) based on superimposed load ratings and clear internal vehicle height.
- **Guided 2D Placement**: Maximal-Rectangles floor decomposition with multi-drop LIFO (Last-In-First-Out) zone constraints.
- **Center of Gravity Steering**: Actively couples 2D placement to target longitudinal axle weight limits.
- **Handling Constraints**: Respects package tilt limits, stacking factor, and material safety classifications.

### 2. Vehicle Dynamics & Axle Physics Engine
- **Axle Distribution**: Real-time multi-axle weight distribution calculation across steering and drive/trailer axles.
- **Center of Gravity (CG) Analytics**: 3D CG tracking (X: longitudinal, Y: lateral, Z: vertical) relative to truck chassis geometry.
- **Dynamic Stability Analysis**: Roll threshold, pitch angles, and braking deceleration slip/tip safety factor checks.
- **Road Ride Simulation**: Numerical simulation of dynamic road bump response, chassis roll, and transient cargo shifts.

### 3. Cargo Securing & Compliance
- **Tie-Down & Lashing**: Dynamic friction coefficients, tie-down strap tensioning calculations, and lashing point capacity checks.
- **Motor Vehicle Act / Indian CMVR Compliance**: Verification against gross vehicle weight (GVW) limits, legal axle overhangs, and axle load caps.
- **Digital Dock Sheets**: Visual printable packing manifest, fork-truck loading sequences, and driver handover sheets.

### 4. Interactive 3D Digital Twin Viewport
- **Three.js Visualizer**: Real-time interactive 3D rendering with orbit controls, cargo layer peeling, cut-plane views, and realistic truck models (`indian_truck.glb`).
- **Load Pattern Blueprint**: 2D top-down, side-elevation, and rear-elevation cross sections with dimensioning and weight labels.

### 5. Outbound Logistics & Dispatch Suite
- **Operations Dashboard**: Fleet utilization metrics, volume efficiency, average axle balance score, and daily throughput.
- **Dock Scheduler**: Bay allocation, turnaround time forecasting, and crane/forklift scheduling.
- **Dispatch Queue**: Real-time consignment status, manifest generation, and gate clearance checks.
- **Fleet Management**: Asset tracking, vehicle specification profiles, and maintenance health logs.

---

## 🛠️ Architecture & Tech Stack

- **Frontend & UI**: React 19, Vite, Modern CSS (Responsive CSS Grid & Flexbox)
- **3D Graphics & Rendering**: Three.js, WebGL, GLTF/GLB Loader
- **Mathematical / Physics Simulation**: Pure JavaScript deterministic physics and optimization algorithms
- **Linting & Code Quality**: Oxlint

---

## 📁 Repository Structure

```
JBMGroup_LogisticsOptimization/
├── README.md                                          # Project documentation
├── .gitignore                                         # Git ignore configuration
├── JBM Logistics Optimization Platform(BRD)_v1.0.pdf  # Business Requirement Document
├── JBM-Logistics-Optimization-Platform_Summary.pdf    # Executive summary
└── app/
    ├── package.json                                   # Frontend dependencies and scripts
    ├── vite.config.js                                 # Vite bundler configuration
    ├── index.html                                     # Web application entrypoint
    ├── public/                                        # 3D truck models (.glb), SVG icons
    └── src/
        ├── App.jsx                                    # Main application shell & routing
        ├── main.jsx                                   # React DOM root mounting
        ├── index.css                                  # Global design system & theme tokens
        ├── components/
        │   ├── Header.jsx                             # Application top navbar
        │   ├── Sidebar.jsx                            # Navigation sidebar
        │   ├── LoadViewport3D.jsx                     # Three.js 3D truck & cargo renderer
        │   ├── LoadPatternBlueprint.jsx               # Technical 2D blueprint views
        │   ├── loadplanner/                           # Modular planner panels (Inputs, Stability, Securing, etc.)
        │   └── three/                                 # Procedural & realistic truck loaders
        ├── engine/
        │   ├── packer.js                              # JBM LoadIQ 3D bin packing heuristic
        │   ├── physics.js                             # Axle weight & static equilibrium
        │   ├── dynamics.js                            # Lateral roll, pitch & dynamic braking
        │   ├── securing.js                            # Strapping & tie-down calculations
        │   ├── ride.js                                # Road ride & vibration simulation
        │   ├── specs.js                               # Vehicle and standard cargo specifications
        │   ├── loadPlan.js                            # High-level plan orchestrator
        │   └── analytics.js                           # Efficiency & compliance metric calculations
        ├── pages/
        │   ├── Dashboard.jsx                          # Executive KPI overview
        │   ├── LoadPlanner.jsx                        # 3D interactive load planning workspace
        │   ├── DockScheduler.jsx                      # Dock bay allocation & timing
        │   ├── DispatchQueue.jsx                      # Outbound order queue & dispatch status
        │   ├── FleetView.jsx                          # Fleet vehicle profiles & capacity
        │   └── Compliance.jsx                         # CMVR & safety compliance engine
        └── data/
            └── seedData.js                            # Seed cargo, vehicle, and dispatch data
```

---

## ⚡ Quickstart Guide

### Prerequisites
- Node.js (v18.0.0 or higher recommended)
- npm or yarn

### Installation & Run

1. Navigate to the project directory:
   ```bash
   cd /home/ubuntu/JBMGroup_LogisticsOptimization
   ```

2. Install dependencies:
   ```bash
   cd app && npm install && cd ..
   ```

3. Launch development server directly:
   ```bash
   ./start_app.sh
   # or from app directory:
   cd app && npm run dev
   ```

4. Run as background daemon in GNU Screen (production / server):
   ```bash
   screen -dmS logistics_optimization /home/ubuntu/JBMGroup_LogisticsOptimization/start_app.sh
   # Check active screens
   screen -ls
   # Attach to console
   screen -r logistics_optimization
   ```

5. Run test suite:
   ```bash
   npm test
   # or from app directory:
   cd app && npm test
   ```

6. Build for production:
   ```bash
   npm run build
   # or from app directory:
   cd app && npm run build
   ```

7. Run linter:
   ```bash
   npm run lint
   # or from app directory:
   cd app && npm run lint
   ```

---

## 📄 License & Confidentiality

Proprietary and confidential. Developed for **JBM Group**. All rights reserved.
