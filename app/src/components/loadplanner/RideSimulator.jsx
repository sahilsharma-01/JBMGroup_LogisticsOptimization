import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildIndianTruck } from '../three/truckBuilder'
import {
  ROUTE_SCENARIOS, ROAD_FEATURES, SUSPENSION,
  evaluateState, criticalSpeeds, humpResponse, worstCaseSpeedKph,
} from '../../engine/dynamics'
import { GRAVITY } from '../../engine/specs'
import {
  buildRoute, sampleRoute, roadElevation, envelopedElevation,
  createRideState, stepRide, rideInput, precomputeRide,
} from '../../engine/ride'

// ============================================================================
// RIDE SIMULATOR
// ----------------------------------------------------------------------------
// Plays the solved load plan through the accelerations of a real route and
// shows what the load does. Every number on screen comes from
// engine/dynamics.js — the animation is a depiction of the computed state, not
// an effect layered on top of it.
//
//   Body roll     = lateral g × roll gradient (5.5°/g laden)
//   Body pitch    = road grade + braking × pitch gradient
//   Body bounce   = vertical g through the suspension travel
//   Box colour    = that unit's sliding and tipping margin at this instant
//
// The lateral offset applied to a unit that has lost its margin is indicative
// of the direction of travel only. Predicting how far a load actually moves
// needs a contact-dynamics solver, which this is not.
// ============================================================================

const STATUS_COLOUR = {
  ok: 0x2f6fd0,
  marginal: 0xd97706,
  sliding: 0xdc2626,
  tipping: 0x7f1d1d,
}

const LANE_HALF = 3.6   // carriageway half-width, metres
const SHOULDER = 2.4

/**
 * Builds the carriageway as a vertex-coloured ribbon swept along the route
 * centreline. Elevation comes from the same roadElevation() the suspension is
 * integrated against, so what the wheels ride over is what you see.
 */
function buildRoadMesh(route) {
  const group = new THREE.Group()
  const n = route.samples.length
  const pos = []
  const col = []
  const idx = []

  const asphalt = new THREE.Color(0x4b5057)
  const humpPaint = new THREE.Color(0xd9c15a)
  const shoulderCol = new THREE.Color(0x7a6a4e)

  const push = (x, y, z, c) => { pos.push(x, y, z); col.push(c.r, c.g, c.b) }

  for (let i = 0; i < n; i += 1) {
    const p = route.samples[i]
    const nx = -Math.sin(p.heading)
    const ny = Math.cos(p.heading)

    // is this station inside a hump? colour it like painted bitumen
    const onHump = route.features.some(f => Math.abs(p.s - f.s) <= f.lengthM / 2)
    const c = onHump ? humpPaint : asphalt

    const zL = roadElevation(route, p.s, -1)
    const zR = roadElevation(route, p.s, 1)

    // route (x, y, z) -> scene (x, z, y)
    push(p.x + nx * (LANE_HALF + SHOULDER), p.z - 0.06, p.y + ny * (LANE_HALF + SHOULDER), shoulderCol)
    push(p.x + nx * LANE_HALF, zL, p.y + ny * LANE_HALF, c)
    push(p.x - nx * LANE_HALF, zR, p.y - ny * LANE_HALF, c)
    push(p.x - nx * (LANE_HALF + SHOULDER), p.z - 0.06, p.y - ny * (LANE_HALF + SHOULDER), shoulderCol)
  }

  for (let i = 0; i < n - 1; i += 1) {
    const a = i * 4
    const b = (i + 1) * 4
    for (let k = 0; k < 3; k += 1) {
      idx.push(a + k, b + k, a + k + 1)
      idx.push(a + k + 1, b + k, b + k + 1)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.95, metalness: 0.02,
  }))
  mesh.receiveShadow = true
  group.add(mesh)

  // dashed centre line, lifted clear of the surface
  const dashPos = []
  for (let i = 0; i < n - 1; i += 1) {
    if (Math.floor(route.samples[i].s / 3) % 2 !== 0) continue
    const p = route.samples[i]
    const q = route.samples[i + 1]
    const nx = -Math.sin(p.heading)
    const ny = Math.cos(p.heading)
    const mx = -Math.sin(q.heading)
    const my = Math.cos(q.heading)
    const w = 0.09
    const zp = roadElevation(route, p.s, 0) + 0.012
    const zq = roadElevation(route, q.s, 0) + 0.012
    dashPos.push(
      p.x + nx * w, zp, p.y + ny * w, p.x - nx * w, zp, p.y - ny * w, q.x + mx * w, zq, q.y + my * w,
      q.x + mx * w, zq, q.y + my * w, p.x - nx * w, zp, p.y - ny * w, q.x - mx * w, zq, q.y - my * w,
    )
  }
  const dashGeo = new THREE.BufferGeometry()
  dashGeo.setAttribute('position', new THREE.Float32BufferAttribute(dashPos, 3))
  dashGeo.computeVertexNormals()
  group.add(new THREE.Mesh(dashGeo, new THREE.MeshBasicMaterial({ color: 0xe9e4d4 })))

  // hazard chevrons on each hump crown
  route.features.forEach(f => {
    const p = sampleRoute(route, f.s)
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(f.lengthM * 0.9, 0.012, LANE_HALF * 2 * (f.oneSided ? 0.5 : 0.98)),
      new THREE.MeshBasicMaterial({ color: 0xf5f0e0 }),
    )
    marker.position.set(p.x, roadElevation(route, f.s, -1) + 0.012, p.y + (f.oneSided ? -LANE_HALF * 0.5 : 0))
    marker.rotation.y = -p.heading
    group.add(marker)
  })

  return group
}

/** Roadside furniture, so motion is readable against something. */
function buildScenery(route) {
  const group = new THREE.Group()
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: 0.6, metalness: 0.4 })
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x4a7a43, roughness: 0.9 })
  const kerbMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.9 })

  for (let s = 8; s < route.lengthM; s += 16) {
    const p = sampleRoute(route, s)
    const nx = -Math.sin(p.heading)
    const ny = Math.cos(p.heading)
    const side = (Math.floor(s / 16) % 2 === 0) ? 1 : -1
    const off = LANE_HALF + SHOULDER + 1.6

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 7, 8), poleMat)
    pole.position.set(p.x + nx * off * side, p.z + 3.5, p.y + ny * off * side)
    group.add(pole)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.5), poleMat)
    arm.position.set(p.x + nx * (off - 0.7) * side, p.z + 6.9, p.y + ny * (off - 0.7) * side)
    arm.rotation.y = -p.heading
    group.add(arm)

    const tree = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), treeMat)
    tree.position.set(p.x - nx * (off + 2) * side, p.z + 2.6, p.y - ny * (off + 2) * side)
    tree.scale.y = 1.3
    group.add(tree)
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.2, 7),
      new THREE.MeshStandardMaterial({ color: 0x6b4f32, roughness: 1 }))
    trunk.position.set(p.x - nx * (off + 2) * side, p.z + 1.1, p.y - ny * (off + 2) * side)
    group.add(trunk)
  }

  // kerb stones every few metres for a sense of speed
  for (let s = 0; s < route.lengthM; s += 4) {
    const p = sampleRoute(route, s)
    const nx = -Math.sin(p.heading)
    const ny = Math.cos(p.heading)
    ;[-1, 1].forEach(side => {
      const k = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.22), kerbMat)
      k.position.set(
        p.x + nx * (LANE_HALF + SHOULDER) * side, p.z + 0.05, p.y + ny * (LANE_HALF + SHOULDER) * side,
      )
      k.rotation.y = -p.heading
      group.add(k)
    })
  }

  return group
}

const VERDICT_LABEL = {
  safe: 'Stable',
  watch: 'Watch',
  warning: 'Load at risk',
  critical: 'Critical',
}

export default function RideSimulator({ plan }) {
  const mountRef = useRef(null)
  const refs = useRef({})

  const [mode, setMode] = useState('scenario')
  const [scenarioId, setScenarioId] = useState('plantToGate')
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [showTarp, setShowTarp] = useState(false)
  const [camMode, setCamMode] = useState('chase')
  const [hud, setHud] = useState(null)
  const [manual, setManual] = useState({
    speedKph: 30, radiusM: 25, gradePct: 0, brakingG: 0, featureId: 'none',
  })

  const vehicle = plan?.vehicle
  const route = useMemo(() => buildRoute(scenarioId), [scenarioId])

  // The trace and the event list are produced by the same integrator that the
  // live view runs, so the playhead and the drive cannot disagree.
  const telemetry = useMemo(
    () => (vehicle && plan && !plan.empty
      ? precomputeRide(vehicle, plan, scenarioId, evaluateState)
      : null),
    [vehicle, plan, scenarioId],
  )

  // ---- manual rig: a static evaluation, no driving ----------------------
  const manualInput = useMemo(() => {
    const f = manual.featureId !== 'none' ? ROAD_FEATURES[manual.featureId] : null
    let verticalG = 0
    let rollImpulseG = 0
    if (f?.heightMm) {
      const r = humpResponse({ ...f, speedKph: manual.speedKph })
      verticalG = r.peakG
      rollImpulseG = r.rollImpulseG
    }
    return {
      speedKph: Number(manual.speedKph),
      radiusM: Number(manual.radiusM) > 0 ? Number(manual.radiusM) : 0,
      superelevation: f?.superelevation ?? 0,
      gradePct: Number(manual.gradePct),
      brakingG: Number(manual.brakingG),
      verticalG,
      reboundPhase: false,
      rollImpulseG,
      segmentLabel: 'Manual rig',
      featureLabel: f?.label ?? null,
      featureNote: f?.note ?? null,
      kind: 'manual',
      advisoryKph: f?.advisoryKph ?? null,
    }
  }, [manual])

  const manualState = useMemo(
    () => (vehicle && plan && !plan.empty ? evaluateState(vehicle, plan, manualInput) : null),
    [vehicle, plan, manualInput],
  )

  const state = mode === 'manual' ? manualState : (hud?.state ?? null)
  const liveS = mode === 'manual' ? 0 : (hud?.s ?? 0)

  const crit = useMemo(() => {
    const radius = mode === 'manual' ? Number(manual.radiusM) : (state?.input?.radiusM || 0)
    if (!vehicle || !plan || plan.empty || !radius) return null
    return criticalSpeeds(vehicle, plan, {
      radiusM: Math.min(radius, 400),
      superelevation: state?.input?.superelevation || 0,
    })
  }, [vehicle, plan, mode, manual.radiusM, state])

  // ---- keep the render loop's view of React state current ---------------
  useEffect(() => { refs.current.playing = playing }, [playing])
  useEffect(() => { refs.current.rate = rate }, [rate])
  useEffect(() => { refs.current.mode = mode }, [mode])
  useEffect(() => { refs.current.camMode = camMode }, [camMode])

  // ---- scene ------------------------------------------------------------
  useEffect(() => {
    const container = mountRef.current
    if (!container || !vehicle) return undefined

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xd7e6f2)
    scene.fog = new THREE.Fog(0xd7e6f2, 45, 180)

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.maxPolarAngle = Math.PI / 2 - 0.02
    controls.enabled = false // the chase camera drives unless orbit is chosen

    scene.add(new THREE.AmbientLight(0xffffff, 1.15))
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.8)
    sun.position.set(-30, 40, 20)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -30
    sun.shadow.camera.right = 30
    sun.shadow.camera.top = 30
    sun.shadow.camera.bottom = -30
    sun.shadow.camera.far = 140
    scene.add(sun)
    scene.add(new THREE.HemisphereLight(0xbcd8f0, 0x6f6450, 0.6))

    // ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.14
    ground.receiveShadow = true
    scene.add(ground)

    const roadMesh = buildRoadMesh(route)
    scene.add(roadMesh)
    const scenery = buildScenery(route)
    scene.add(scenery)

    const truck = buildIndianTruck(vehicle, {
      showTarp, regNo: 'HR 26 EE 4521', operator: 'JBM LOGISTICS',
    })
    scene.add(truck.root)

    const cargoGroup = new THREE.Group()
    truck.cargoAnchor.add(cargoGroup)

    const sim = createRideState(vehicle, route)

    Object.assign(refs.current, {
      scene, camera, renderer, controls, truck, cargoGroup, roadMesh, scenery,
      sim, route, boxes: new Map(), sun,
      playing: false, rate, mode, camMode,
    })

    const resize = () => {
      const w = container.clientWidth || 800
      const h = container.clientHeight || 420
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // ---- pose the vehicle from the simulated state --------------------
    const tyreR = 0.47
    const applyPose = () => {
      const r = refs.current
      const st = r.sim
      const p = sampleRoute(route, st.s)

      // route (x, y, z) -> scene (x, z, y); the model faces -x locally
      r.truck.root.position.set(p.x, p.z, p.y)
      r.truck.root.rotation.y = Math.PI - p.heading

      // lateral acceleration straight off the geometry, for the body roll
      const v = st.v
      const latG = Math.max(0,
        (v * v * Math.abs(st.curvature ?? 0)) / GRAVITY - (st.superelevation || 0))
      const rollRad = ((latG * SUSPENSION.rollGradientDegPerG) * Math.PI) / 180
      const rollSign = (st.curvature ?? 0) >= 0 ? 1 : -1

      r.truck.sprung.position.y = st.heave
      r.truck.sprung.rotation.x = rollSign * rollRad + (st.roadRollRad || 0)
      r.truck.sprung.rotation.z = st.pitchRad

      // brake lamps follow the driver model's deceleration
      const braking = st.longAccel < -0.25
      r.truck.tailLamps.forEach(m => {
        m.emissiveIntensity = braking ? 1.6 : 0.5
        m.color.setHex(braking ? 0xff3b30 : 0xd42a2a)
      })

      // wheels: follow the surface beneath them, roll, and steer
      r.truck.wheels.forEach(w => {
        const ud = w.userData
        const axle = st.axles.find(a => a.id === ud.axleId)
        const arc = Math.max(0, st.s - (axle?.offsetM ?? 0))
        const zWheel = envelopedElevation(route, arc, ud.side)
        const base = sampleRoute(route, arc).z
        w.position.y = tyreR + (zWheel - base) - st.heave
        if (ud.axleId === 'steer') w.rotation.y = -st.steerRad
        if (ud.spinner) ud.spinner.rotation.z = -st.wheelSpinRad
      })

      // ---- camera ------------------------------------------------------
      const fwd = new THREE.Vector3(Math.cos(p.heading), 0, Math.sin(p.heading))
      const up = new THREE.Vector3(0, 1, 0)
      const left = new THREE.Vector3().crossVectors(up, fwd)
      const origin = new THREE.Vector3(p.x, p.z, p.y)
      const deckY = vehicle.geometry.deckHeightMm / 1000
      const L = vehicle.deck.lengthMm / 1000

      if (r.camMode === 'orbit') {
        r.controls.enabled = true
        r.controls.target.lerp(origin.clone().add(new THREE.Vector3(0, deckY + 1.2, 0)), 0.2)
      } else {
        r.controls.enabled = false
        let want
        let look
        if (r.camMode === 'cab') {
          want = origin.clone()
            .add(fwd.clone().multiplyScalar(-L / 2 - 1.1))
            .add(left.clone().multiplyScalar(0.55))
            .add(up.clone().multiplyScalar(deckY + 1.5))
          look = origin.clone().add(fwd.clone().multiplyScalar(26)).add(up.clone().multiplyScalar(deckY + 0.6))
        } else if (r.camMode === 'side') {
          want = origin.clone()
            .add(left.clone().multiplyScalar(-(L * 0.9)))
            .add(up.clone().multiplyScalar(deckY + 1.8))
          look = origin.clone().add(up.clone().multiplyScalar(deckY + 1.2))
        } else {
          want = origin.clone()
            .add(fwd.clone().multiplyScalar(L * 1.05))
            .add(left.clone().multiplyScalar(-L * 0.42))
            .add(up.clone().multiplyScalar(deckY + L * 0.3))
          look = origin.clone().add(fwd.clone().multiplyScalar(-2)).add(up.clone().multiplyScalar(deckY + 0.9))
        }
        // A little field-of-view stretch with speed gives the sense of pace
        // that a fixed FOV loses entirely. Kept subtle so it does not distort
        // the geometry being judged.
        const targetFov = 48 + Math.min(14, (st.v / 25) * 14)
        r.camera.fov += (targetFov - r.camera.fov) * (r.firstFrame ? 1 : 0.05)
        r.camera.updateProjectionMatrix()

        // easing keeps the camera from snapping over a bump
        r.camera.position.lerp(want, r.firstFrame ? 1 : 0.16)
        r.camLook = r.camLook || look.clone()
        r.camLook.lerp(look, r.firstFrame ? 1 : 0.2)
        r.camera.lookAt(r.camLook)
        r.firstFrame = false
      }
    }

    refs.current.applyPose = applyPose
    refs.current.firstFrame = true

    let raf
    let last = performance.now()
    let lastHud = 0
    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      const r = refs.current
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      if (r.mode === 'scenario') {
        if (r.playing && r.sim && !r.sim.finished) {
          stepRide(r.sim, r.route, vehicle, dt * (r.rate ?? 1))
          if (r.sim.finished) setPlaying(false)
        }
        applyPose()
        if (now - lastHud > 90) {
          lastHud = now
          const input = rideInput(r.sim)
          const st = evaluateState(vehicle, plan, input)
          r.lastEval = st
          paintCargo(st)
          setHud({ state: st, s: r.sim.s, t: r.sim.t, finished: r.sim.finished })
        }
      }

      if (r.controls.enabled) r.controls.update()
      r.renderer.render(r.scene, r.camera)
    }

    const paintCargo = (st) => {
      const r = refs.current
      st.cargo.forEach(c => {
        const b = r.boxes.get(c.huId)
        if (!b) return
        const hex = STATUS_COLOUR[c.status] ?? STATUS_COLOUR.ok
        b.mat.color.setHex(hex)
        const hot = c.status === 'sliding' || c.status === 'tipping'
        b.mat.emissive.setHex(hot ? 0x5c0f0f : 0x000000)
        b.mat.emissiveIntensity = hot ? 0.35 : 0
        const shift = c.status === 'sliding' ? Math.min(0.22, -c.slideMargin * 0.8) : 0
        const tilt = c.status === 'tipping' ? Math.min(0.18, -c.tipMargin * 0.6) : 0
        b.group.position.set(b.base[0], b.base[1], b.base[2] + shift)
        b.group.rotation.x = -tilt
      })
    }
    refs.current.paintCargo = paintCargo

    tick(performance.now())

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose()
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
        mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose() })
      })
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [vehicle?.id, showTarp, route, plan])

  // ---- cargo boxes ------------------------------------------------------
  useEffect(() => {
    const r = refs.current
    if (!r.cargoGroup || !plan || plan.empty) return
    r.cargoGroup.clear()
    r.boxes.clear()

    const L = vehicle.deck.lengthMm / 1000
    const W = vehicle.deck.widthMm / 1000

    plan.placements.forEach(p => {
      const geo = new THREE.BoxGeometry((p.l / 1000) * 0.98, (p.h / 1000) * 0.98, (p.w / 1000) * 0.98)
      const mat = new THREE.MeshStandardMaterial({
        color: STATUS_COLOUR.ok,
        metalness: p.packagingCode?.startsWith('ST') ? 0.5 : 0.15,
        roughness: 0.55,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      mesh.receiveShadow = true
      const g = new THREE.Group()
      g.add(mesh)
      g.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }),
      ))
      const base = [
        (p.x + p.l / 2) / 1000 - L / 2,
        (p.y + p.h / 2) / 1000,
        (p.z + p.w / 2) / 1000 - W / 2,
      ]
      g.position.set(...base)
      r.cargoGroup.add(g)
      r.boxes.set(p.huId, { group: g, mat, base })
    })
  }, [plan, vehicle])

  // ---- controls ---------------------------------------------------------
  const restart = () => {
    const r = refs.current
    if (!r.route || !vehicle) return
    r.sim = createRideState(vehicle, r.route)
    r.firstFrame = true
    r.applyPose && r.applyPose()
    setHud(null)
  }

  const jumpTo = (arcM) => {
    const r = refs.current
    if (!r.route || !vehicle) return
    const sim = createRideState(vehicle, r.route)
    // integrate forward rather than teleport, so the suspension arrives in a
    // settled state instead of with a step input
    let guard = 0
    while (sim.s < arcM && !sim.finished && guard < 20000) {
      stepRide(sim, r.route, vehicle, 1 / 60)
      guard += 1
    }
    r.sim = sim
    r.applyPose && r.applyPose()
    const input = rideInput(sim)
    setHud({ state: evaluateState(vehicle, plan, input), s: sim.s, t: sim.t, finished: sim.finished })
  }

  useEffect(() => { restart() }, [scenarioId])

  if (!plan || plan.empty) {
    return <div className="lp-empty">Solve a load plan to run the ride simulation.</div>
  }

  const activeSeg = route.segments.find(sg => liveS >= sg.s0 && liveS < sg.s1) || route.segments[0]
  const progressPct = (liveS / route.lengthM) * 100

  return (
    <div className="rs">
      {/* ---------------- 3D stage ---------------- */}
      <div className="rs-stage">
        <div ref={mountRef} className="rs-canvas" />

        {/* speedometer */}
        <div className="rs-speedo">
          <strong>{Math.round(state?.input?.speedKph ?? 0)}</strong>
          <span>km/h</span>
          {activeSeg?.advisoryKph != null && (
            <em className={(state?.input?.speedKph ?? 0) > activeSeg.advisoryKph + 1 ? 'over' : 'ok'}>
              advisory {activeSeg.advisoryKph}
            </em>
          )}
          {mode === 'scenario' && (
            <small>target {Math.round(activeSeg?.targetKph ?? 0)} km/h</small>
          )}
        </div>

        {state && (
          <>
            <div className={`rs-hud rs-hud-left ${state.verdict}`}>
              <span className="rs-verdict">{VERDICT_LABEL[state.verdict]}</span>
              <div className="rs-gauges">
                <div className="rs-gauge">
                  <span>Lateral</span>
                  <strong className={state.rolloverUtilPct > 85 ? 'bad' : state.rolloverUtilPct > 60 ? 'warn' : ''}>
                    {state.latG.toFixed(2)}<em>g</em>
                  </strong>
                </div>
                <div className="rs-gauge">
                  <span>Long.</span>
                  <strong>{state.longG.toFixed(2)}<em>g</em></strong>
                </div>
                <div className="rs-gauge">
                  <span>Vertical</span>
                  <strong className={Math.abs(state.verticalG) > 0.5 ? 'warn' : ''}>
                    {(state.input.signedVerticalG ?? state.verticalG) >= 0 ? '+' : '−'}
                    {Math.abs(state.input.signedVerticalG ?? state.verticalG).toFixed(2)}<em>g</em>
                  </strong>
                </div>
                <div className="rs-gauge">
                  <span>Body roll</span>
                  <strong>{state.rollDeg.toFixed(1)}<em>°</em></strong>
                </div>
                <div className="rs-gauge">
                  <span>Grade</span>
                  <strong>{(state.input.gradePct ?? 0).toFixed(1)}<em>%</em></strong>
                </div>
                <div className="rs-gauge">
                  <span>Deck load</span>
                  <strong className={state.vertFactor < 0.7 ? 'warn' : ''}>×{state.vertFactor.toFixed(2)}</strong>
                </div>
              </div>

              <div className="rs-rollover">
                <span>Rollover margin used</span>
                <div className="rs-ro-track">
                  <div
                    className={`rs-ro-fill ${state.rolloverUtilPct > 85 ? 'bad' : state.rolloverUtilPct > 60 ? 'warn' : ''}`}
                    style={{ width: `${Math.min(state.rolloverUtilPct, 100)}%` }}
                  />
                </div>
                <strong>{state.rolloverUtilPct.toFixed(0)}% of {state.srt.toFixed(2)} g</strong>
              </div>

              {state.vertFactor < 0.3 && (
                <div className="rs-note warn">
                  Wheels all but unloaded — ×{state.vertFactor.toFixed(2)} deck load. No braking,
                  no steering, and no friction holding the cargo until it comes back down.
                </div>
              )}
              {state.vertFactor >= 0.3 && state.input.reboundPhase && (
                <div className="rs-note warn">
                  Rebound — normal force down to ×{state.vertFactor.toFixed(2)}, and available
                  friction with it. This is when a load shifts.
                </div>
              )}
            </div>

            <div className="rs-hud rs-hud-right">
              <span className="rs-hud-title">Wheel loads this instant</span>
              {state.axles.map(a => (
                <div className="rs-axle" key={a.id}>
                  <div className="rs-axle-top">
                    <strong>{a.label}</strong>
                    <span className={a.dynamicExceedance ? 'bad' : ''}>
                      {a.totalKg.toLocaleString('en-IN')} kg
                    </span>
                  </div>
                  <div className="rs-wheels">
                    <div className={`rs-wheel ${a.wheelLift ? 'lift' : ''}`}>
                      <span>inner</span>
                      <strong>{a.innerKg.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="rs-wheel-bar">
                      <div
                        className={`rs-wheel-fill ${a.outerUtilPct > 100 ? 'bad' : a.outerUtilPct > 85 ? 'warn' : ''}`}
                        style={{ width: `${Math.min(a.outerUtilPct, 100)}%` }}
                      />
                    </div>
                    <div className="rs-wheel outer">
                      <span>outer</span>
                      <strong>{a.outerKg.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                  {a.wheelLift && <span className="rs-lift">Inner wheels unloaded — rollover onset</span>}
                  {a.airborne && !a.wheelLift && <span className="rs-lift">Axle airborne</span>}
                  {a.dynamicExceedance && !a.wheelLift && !a.airborne && (
                    <span className="rs-dyn">
                      Dynamic peak {a.utilPct.toFixed(0)}% of the static rating — suspension and
                      deck loading, not a weighbridge breach
                    </span>
                  )}
                </div>
              ))}

              <div className="rs-cargo-status">
                <span className={state.tipping.length ? 'bad' : ''}>{state.tipping.length} tipping</span>
                <span className={state.sliding.length ? 'bad' : ''}>{state.sliding.length} sliding</span>
                <span className={state.weightless?.length ? 'warn' : ''}>{state.weightless?.length ?? 0} weightless</span>
                <span className={state.marginal.length ? 'warn' : ''}>{state.marginal.length} marginal</span>
              </div>
            </div>
          </>
        )}

        {/* route caption + mini map */}
        <div className="rs-caption">
          <strong>{state?.input?.segmentLabel ?? activeSeg?.label}</strong>
          {state?.input?.featureLabel && <span>{state.input.featureLabel}</span>}
          {state?.input?.featureNote && <em>{state.input.featureNote}</em>}
          {mode === 'scenario' && (
            <small>
              {liveS.toFixed(0)} m of {route.lengthM.toFixed(0)} m
              {hud?.finished ? ' · arrived' : ''}
            </small>
          )}
        </div>

        {mode === 'scenario' && <MiniMap route={route} s={liveS} />}
      </div>

      {/* ---------------- controls ---------------- */}
      <div className="rs-controls">
        <div className="rs-ctl-row">
          <div className="lv-seg">
            <button className={`lv-btn ${mode === 'scenario' ? 'active' : ''}`} onClick={() => setMode('scenario')}>Drive</button>
            <button className={`lv-btn ${mode === 'manual' ? 'active' : ''}`} onClick={() => { setMode('manual'); setPlaying(false) }}>Manual rig</button>
          </div>

          {mode === 'scenario' ? (
            <>
              <select className="lv-select" value={scenarioId} onChange={e => { setScenarioId(e.target.value); setPlaying(false) }}>
                {Object.values(ROUTE_SCENARIOS).map(sc => <option key={sc.id} value={sc.id}>{sc.label}</option>)}
              </select>
              <button className="lv-btn lv-btn-primary" onClick={() => {
                if (hud?.finished) restart()
                setPlaying(pl => !pl)
              }}>
                {playing ? '❚❚ Pause' : hud?.finished ? '↻ Drive again' : '▶ Drive'}
              </button>
              <button className="lv-btn" onClick={() => { setPlaying(false); restart() }}>Reset</button>
              <div className="rs-progress" title="Distance along the route">
                <div className="rs-progress-fill" style={{ width: `${Math.min(progressPct, 100)}%` }} />
              </div>
              <select className="lv-select" value={rate} onChange={e => setRate(Number(e.target.value))}>
                {[0.25, 0.5, 1, 2].map(x => <option key={x} value={x}>{x}× time</option>)}
              </select>
              <div className="lv-seg">
                {[['chase', 'Chase'], ['cab', 'Cab'], ['side', 'Side'], ['orbit', 'Orbit']].map(([v, l]) => (
                  <button key={v} className={`lv-btn ${camMode === v ? 'active' : ''}`} onClick={() => setCamMode(v)}>{l}</button>
                ))}
              </div>
            </>
          ) : (
            <>
              <label className="rs-slider">
                <span>Speed <strong>{manual.speedKph} km/h</strong></span>
                <input type="range" min={0} max={90} step={1} value={manual.speedKph}
                  onChange={e => setManual(m => ({ ...m, speedKph: Number(e.target.value) }))} />
              </label>
              <label className="rs-slider">
                <span>Corner radius <strong>{manual.radiusM} m</strong></span>
                <input type="range" min={0} max={200} step={1} value={manual.radiusM}
                  onChange={e => setManual(m => ({ ...m, radiusM: Number(e.target.value) }))} />
              </label>
              <label className="rs-slider">
                <span>Grade <strong>{manual.gradePct}%</strong></span>
                <input type="range" min={-12} max={12} step={0.5} value={manual.gradePct}
                  onChange={e => setManual(m => ({ ...m, gradePct: Number(e.target.value) }))} />
              </label>
              <label className="rs-slider">
                <span>Braking <strong>{manual.brakingG} g</strong></span>
                <input type="range" min={0} max={0.7} step={0.05} value={manual.brakingG}
                  onChange={e => setManual(m => ({ ...m, brakingG: Number(e.target.value) }))} />
              </label>
              <select className="lv-select" value={manual.featureId}
                onChange={e => setManual(m => ({ ...m, featureId: e.target.value }))}>
                <option value="none">No road feature</option>
                {Object.values(ROAD_FEATURES).filter(f => f.heightMm).map(f => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </>
          )}

          <div className="lv-seg rs-ctl-right">
            <button className={`lv-btn ${showTarp ? 'active' : ''}`} onClick={() => setShowTarp(t => !t)}>Tarp</button>
          </div>
        </div>

        <div className="rs-lower">
          {mode === 'scenario' && telemetry && (
            <div className="rs-trace">
              <div className="rs-trace-head">
                <strong>Acceleration trace</strong>
                <span>{route.description}</span>
              </div>
              <Trace
                telemetry={telemetry}
                s={liveS}
                lengthM={route.lengthM}
                onSeek={(arc) => { setPlaying(false); jumpTo(arc) }}
              />
              <div className="rs-segs">
                {route.segments.map(sg => (
                  <button
                    key={sg.index}
                    className={`rs-seg ${activeSeg?.index === sg.index ? 'active' : ''}`}
                    style={{ flexGrow: sg.lengthM }}
                    onClick={() => { setPlaying(false); jumpTo(sg.s0 + 0.5) }}
                    title={`${sg.feature?.note || sg.label} · ${sg.lengthM.toFixed(0)} m at ${sg.targetKph} km/h`}
                  >
                    {sg.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rs-analysis">
            {crit && (
              <div className="rs-crit">
                <div className="rs-crit-head">
                  <strong>Safe cornering speed · R = {crit.radiusM.toFixed(0)} m</strong>
                  <span className="rs-advisory">{crit.advisoryKph} km/h</span>
                </div>
                {crit.modes.map(m => (
                  <div className={`rs-crit-row ${m === crit.governing ? 'gov' : ''}`} key={m.mode}>
                    <span>{m.mode}</span>
                    <strong>{m.speedKph.toFixed(0)} km/h</strong>
                    <em>{m.atG.toFixed(2)} g</em>
                  </div>
                ))}
                <span className="rs-crit-note">
                  {crit.governing.mode} governs — {crit.governing.detail}. The advisory carries a
                  20% margin on the governing mode.
                </span>
              </div>
            )}

            {mode === 'manual' && manual.featureId !== 'none' && (
              <HumpReadout feature={ROAD_FEATURES[manual.featureId]} speedKph={manual.speedKph} />
            )}

            {mode === 'scenario' && telemetry && (
              telemetry.events.length > 0 ? (
                <div className="rs-events">
                  <strong>Events on this drive</strong>
                  {telemetry.events.slice(0, 6).map((e, i) => (
                    <button key={i} className={`rs-event ${e.verdict}`} onClick={() => { setPlaying(false); jumpTo(e.s) }}>
                      <span className="rs-event-t">{Math.round(e.speedKph)}<small>kph</small></span>
                      <span className="rs-event-label">{e.featureLabel || e.label}</span>
                      <span className="rs-event-detail">{e.detail}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rs-clear">
                  <strong>No exceptions on this drive</strong>
                  <span>
                    The load holds throughout. Peak lateral {telemetry.peak.latG.toFixed(2)} g,
                    peak vertical {telemetry.peak.vertG.toFixed(2)} g, top speed{' '}
                    {telemetry.peak.speedKph.toFixed(0)} km/h over {route.lengthM.toFixed(0)} m.
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Plan view of the route with the vehicle's position on it. */
function MiniMap({ route, s }) {
  const pts = route.samples.filter((_, i) => i % 4 === 0)
  const xs = pts.map(p => p.x)
  const ys = pts.map(p => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = 8
  const w = 150
  const h = 110
  const span = Math.max(maxX - minX, maxY - minY, 1)
  const sx = (x) => pad + ((x - minX) / span) * (w - pad * 2)
  const sy = (y) => h - pad - ((y - minY) / span) * (h - pad * 2)
  const here = sampleRoute(route, s)

  return (
    <div className="rs-minimap">
      <svg viewBox={`0 0 ${w} ${h}`}>
        <polyline
          points={pts.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ')}
          fill="none" stroke="#94a3b8" strokeWidth={5} strokeLinecap="round"
        />
        <polyline
          points={pts.filter(p => p.s <= s).map(p => `${sx(p.x)},${sy(p.y)}`).join(' ')}
          fill="none" stroke="#1d4ed8" strokeWidth={3} strokeLinecap="round"
        />
        {route.features.map((f, i) => {
          const p = sampleRoute(route, f.s)
          return <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3} fill="#d97706" />
        })}
        <circle cx={sx(here.x)} cy={sy(here.y)} r={4.5} fill="#dc2626" stroke="#fff" strokeWidth={1.5} />
      </svg>
      <span>route plan</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
function Trace({ telemetry, s: liveS, lengthM, onSeek }) {
  const W = 1000
  const H = 120
  const samples = telemetry.samples
  const maxG = Math.max(1, ...samples.map(x => Math.max(x.latG, Math.abs(x.verticalG), Math.abs(x.longG)))) * 1.1
  // plotted against distance, so the trace lines up with the route and the
  // segment buttons regardless of how long the vehicle spent in each
  const sx = (d) => (d / lengthM) * W
  const sy = (g) => H / 2 - (g / maxG) * (H / 2 - 6)

  const line = (key) => samples
    .map(x => `${sx(x.s).toFixed(1)},${sy(x[key]).toFixed(1)}`)
    .join(' ')

  return (
    <div className="ch">
      <svg
        viewBox={`0 0 ${W} ${H + 16}`}
        className="ch-svg rs-trace-svg"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onSeek(((e.clientX - r.left) / r.width) * lengthM)
        }}
      >
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} className="ch-zero" />
        <polyline className="ch-line" stroke="#dc2626" points={line('latG')} />
        <polyline className="ch-line" stroke="#1d4ed8" points={line('verticalG')} />
        <polyline className="ch-line" stroke="#15803d" points={line('longG')} />
        <line x1={sx(liveS)} y1={0} x2={sx(liveS)} y2={H} className="rs-playhead" />
        <text x={4} y={12} className="ch-tick">{maxG.toFixed(1)} g</text>
        <text x={4} y={H - 2} className="ch-tick">−{maxG.toFixed(1)} g</text>
      </svg>
      <div className="ch-legend">
        <span><i style={{ background: '#dc2626' }} />lateral</span>
        <span><i style={{ background: '#1d4ed8' }} />vertical</span>
        <span><i style={{ background: '#15803d' }} />longitudinal</span>
        <span className="lp-sub">plotted against distance · click to seek</span>
      </div>
    </div>
  )
}

function HumpReadout({ feature, speedKph }) {
  const r = humpResponse({ ...feature, speedKph })
  const worst = worstCaseSpeedKph(feature)
  return (
    <div className="rs-crit">
      <div className="rs-crit-head">
        <strong>{feature.label}</strong>
        <span className="rs-advisory">{feature.advisoryKph} km/h advisory</span>
      </div>
      <div className="rs-crit-row"><span>Obstacle</span><strong>{feature.heightMm} × {feature.lengthMm} mm</strong></div>
      <div className="rs-crit-row"><span>Effective chord after tyre envelopment</span><strong>{r.effectiveChordM.toFixed(2)} m</strong></div>
      <div className="rs-crit-row"><span>Pulse duration / suspension period</span><strong>{r.beta.toFixed(2)}</strong></div>
      <div className="rs-crit-row"><span>Shock amplification</span><strong>{r.shockAmplification.toFixed(2)}×</strong></div>
      <div className="rs-crit-row"><span>Wheel-path peak</span><strong>{r.inputPeakG.toFixed(2)} g</strong></div>
      <div className={`rs-crit-row gov`}><span>Deck peak</span><strong>{r.peakG.toFixed(2)} g</strong></div>
      <div className="rs-crit-row">
        <span>Dynamic load factor</span>
        <strong>×{r.dlfCompression.toFixed(2)} then ×{r.dlfRebound.toFixed(2)}</strong>
      </div>
      <span className="rs-crit-note">
        {r.airborne
          ? 'The rebound fully unloads the deck: the cargo goes momentarily weightless and friction drops to zero. Nothing but lashings and blocking holds it.'
          : r.nearWorstCase
            ? `At this speed the pulse lands in the worst part of the shock spectrum. The quietest crossing is near ${Math.round(worst)} km/h or well below it.`
            : 'The pulse is short relative to the suspension period, so little of it reaches the deck.'}
      </span>
    </div>
  )
}
