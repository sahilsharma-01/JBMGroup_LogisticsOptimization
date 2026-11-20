import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildIndianTruck } from './three/truckBuilder'
import { loadRealisticTruckModel, buildRealisticTruckInstance, isRealisticTruckSupported } from './three/realisticTruckLoader'

// ============================================================================
// LOAD VIEWPORT — interactive 3D digital twin of a solved load plan
// ----------------------------------------------------------------------------
// Everything drawn here comes from the engine output. Box positions are the
// solver's verified placements, the centre-of-gravity marker sits at the
// computed CoG, and the axle markers sit at the real chassis geometry. Nothing
// in this view is decorative geometry standing in for a number.
//
// Engine frame (mm, deck-local)  ->  scene frame (m, deck-centred)
//     sceneX = (x + l/2) / 1000 - L/2      bulkhead at -L/2, doors at +L/2
//     sceneY = (y + h/2) / 1000            deck surface at y = 0
//     sceneZ = (z + w/2) / 1000 - W/2      left wall at -W/2
// ============================================================================

const COLOUR_MODES = [
  { id: 'consignee', label: 'Consignee', hint: 'One colour per delivery point' },
  { id: 'packaging', label: 'Packaging', hint: 'Returnable packaging family' },
  { id: 'tier', label: 'Stack tier', hint: 'Height in the stack' },
  { id: 'pressure', label: 'Floor pressure', hint: 'Deck loading in kg/m²' },
  { id: 'sequence', label: 'Drop sequence', hint: 'Unloading order' },
  { id: 'risk', label: 'Exceptions', hint: 'Flagged units only' },
]

const CONSIGNEE_PALETTE = ['#1d4ed8', '#0891b2', '#7c3aed', '#c2410c', '#15803d', '#be123c', '#4338ca', '#a16207']
const TIER_PALETTE = ['#1d4ed8', '#0284c7', '#38bdf8', '#7dd3fc', '#bae6fd']
const SEQ_PALETTE = ['#dc2626', '#ea580c', '#d97706', '#65a30d', '#0891b2']

function heat(t) {
  const stops = [
    [0.0, [16, 185, 129]],
    [0.5, [250, 204, 21]],
    [0.78, [249, 115, 22]],
    [1.0, [220, 38, 38]],
  ]
  const u = Math.max(0, Math.min(1, t))
  for (let i = 1; i < stops.length; i += 1) {
    if (u <= stops[i][0]) {
      const [p0, c0] = stops[i - 1]
      const [p1, c1] = stops[i]
      const k = (u - p0) / (p1 - p0 || 1)
      const rgb = c0.map((c, j) => Math.round(c + (c1[j] - c) * k))
      return `rgb(${rgb.join(',')})`
    }
  }
  return 'rgb(220,38,38)'
}

function makeLabelSprite(text, { color = '#334155', size = 64, bold = true, bg = null } = {}) {
  const pad = 12
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = `${bold ? '700 ' : ''}${size}px Inter, system-ui, sans-serif`
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2
  canvas.width = w
  canvas.height = size + pad * 2
  const c2 = canvas.getContext('2d')
  if (bg) {
    c2.fillStyle = bg
    c2.fillRect(0, 0, canvas.width, canvas.height)
  }
  c2.font = `${bold ? '700 ' : ''}${size}px Inter, system-ui, sans-serif`
  c2.fillStyle = color
  c2.textBaseline = 'middle'
  c2.textAlign = 'center'
  c2.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }))
  sprite.scale.set((canvas.width / canvas.height) * 0.42, 0.42, 1)
  return sprite
}

/** Empties a group and releases its GPU resources. THREE.Group.clear() only
 *  detaches children; geometries, materials and textures must be disposed or
 *  they accumulate on every re-solve. */
function disposeGroup(group) {
  group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose()
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : []
    mats.forEach(m => {
      Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose() })
      m.dispose()
    })
  })
  group.clear()
}

/** Keeps a stable identity around a changing callback. */
function useCallbackRef(fn) {
  const ref = useRef(fn)
  ref.current = fn
  return useRef((...args) => ref.current(...args)).current
}

export default function LoadViewport3D({ plan, selectedHuId, onSelectUnit }) {
  const mountRef = useRef(null)
  const refs = useRef({})

  const [colourMode, setColourMode] = useState('consignee')
  const [cameraPreset, setCameraPreset] = useState('iso')
  const [tierFilter, setTierFilter] = useState(0) // 0 = all tiers
  const [showVoids, setShowVoids] = useState(false)
  const [showAxles, setShowAxles] = useState(true)
  const [showCog, setShowCog] = useState(true)
  const [showBays, setShowBays] = useState(true)
  const [explode, setExplode] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [hovered, setHovered] = useState(null)
  const [truckModelType, setTruckModelType] = useState('realistic') // 'realistic' | 'cad'
  const [truckWallOpacity, setTruckWallOpacity] = useState(0.22)
  const [modelLoading, setModelLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)

  const sequence = plan?.loadSequence || []
  const [step, setStep] = useState(sequence.length)

  useEffect(() => { setStep(sequence.length) }, [sequence.length])

  const deck = plan?.vehicle?.deck
  const L = deck ? deck.lengthMm / 1000 : 9.75
  const W = deck ? deck.widthMm / 1000 : 2.5
  const H = deck ? deck.heightMm / 1000 : 2.75

  const flagged = useMemo(() => {
    const set = new Set()
    plan?.validation?.issues?.forEach(i => i.huId && set.add(i.huId))
    return set
  }, [plan])

  const consigneeColour = useMemo(() => {
    const map = new Map()
    ;(plan?.drops || []).forEach((d, i) => map.set(d.customerId, CONSIGNEE_PALETTE[i % CONSIGNEE_PALETTE.length]))
    return map
  }, [plan])

  const maxPressure = useMemo(() => {
    const vals = (plan?.placements || []).map(p => p.grossKg / ((p.l * p.w) / 1e6))
    return vals.length ? Math.max(...vals) : 1
  }, [plan])

  const colourFor = (p) => {
    switch (colourMode) {
      case 'consignee': return consigneeColour.get(p.customerId) || '#64748b'
      case 'packaging': return p.color || '#2563eb'
      case 'tier': return TIER_PALETTE[Math.min(p.tier - 1, TIER_PALETTE.length - 1)]
      case 'pressure': return heat((p.grossKg / ((p.l * p.w) / 1e6)) / maxPressure)
      case 'sequence': return SEQ_PALETTE[(p.dropSeq - 1) % SEQ_PALETTE.length]
      case 'risk':
        if (flagged.has(p.huId)) return '#dc2626'
        if (p.sequenceBreach) return '#ea580c'
        if (p.tight) return '#d97706'
        if (p.isReturnAsset) return '#64748b'
        return '#cbd5e1'
      default: return '#2563eb'
    }
  }

  // --- scene bootstrap ----------------------------------------------------
  useEffect(() => {
    const container = mountRef.current
    if (!container) return undefined

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf6f8fb)

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200)
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Photorealistic ambient environment probe for metallic & clearcoat reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    pmremGenerator.compileEquirectangularShader()
    const roomEnv = new RoomEnvironment()
    const envTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture
    scene.environment = envTexture
    scene.environmentIntensity = 1.25

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI / 2 + 0.02
    controls.minDistance = 2
    controls.maxDistance = 60

    scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const key = new THREE.DirectionalLight(0xfffdfa, 1.8)
    key.position.set(14, 24, 16)
    key.castShadow = true
    key.shadow.bias = -0.0001
    key.shadow.normalBias = 0.02
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 1
    key.shadow.camera.far = 70
    key.shadow.camera.left = -18
    key.shadow.camera.right = 18
    key.shadow.camera.top = 18
    key.shadow.camera.bottom = -18
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xdbeafe, 0.8)
    fill.position.set(-14, 12, -12)
    scene.add(fill)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ opacity: 0.1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const grid = new THREE.GridHelper(48, 48, 0xd3dce6, 0xe7edf3)
    scene.add(grid)

    const groups = {
      chassis: new THREE.Group(),
      cargo: new THREE.Group(),
      overlay: new THREE.Group(),
      voids: new THREE.Group(),
      bays: new THREE.Group(),
    }
    Object.values(groups).forEach(g => scene.add(g))

    Object.assign(refs.current, { scene, camera, renderer, controls, groups, picks: new Map(), ground, grid })

    const resize = () => {
      const w = container.clientWidth || 800
      const h = container.clientHeight || 520
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      refs.current.refit && refs.current.refit()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    let raf
    const tick = () => {
      raf = requestAnimationFrame(tick)
      controls.update()
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      Object.values(groups).forEach(disposeGroup)
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [])

  // --- chassis & body -----------------------------------------------------
  useEffect(() => {
    const { groups, ground, grid } = refs.current
    if (!groups || !plan?.vehicle) return
    const g = groups.chassis
    disposeGroup(g)

    const geom = plan.vehicle.geometry
    const deckY = geom.deckHeightMm / 1000
    groups.cargo.position.y = deckY
    groups.overlay.position.y = deckY
    groups.voids.position.y = deckY
    groups.bays.position.y = deckY
    if (ground) ground.position.y = 0.002
    if (grid) grid.position.y = 0

    let cancelled = false
    const is3DSupported = isRealisticTruckSupported(plan?.vehicle?.id)

    if (is3DSupported && truckModelType === 'realistic') {
      setModelLoading(true)
      loadRealisticTruckModel((p) => {
        if (!cancelled) setLoadProgress(Math.round(p * 100))
      })
        .then((gltf) => {
          if (cancelled) return
          setModelLoading(false)
          disposeGroup(g)
          const realisticTruck = buildRealisticTruckInstance(gltf, plan.vehicle, {
            bodyOpacity: truckWallOpacity,
            showWalls: true,
          })
          g.add(realisticTruck)
        })
        .catch((err) => {
          console.warn('Falling back to CAD chassis:', err)
          if (cancelled) return
          setModelLoading(false)
          disposeGroup(g)
          const fallback = buildIndianTruck(plan.vehicle, {
            sideOpacity: 0.14,
            showTarp: false,
            regNo: 'HR 26 EE 4521',
            operator: 'JBM LOGISTICS',
          })
          g.add(fallback.root)
        })
    } else {
      setModelLoading(false)
      const truck = buildIndianTruck(plan.vehicle, {
        sideOpacity: 0.14,
        showTarp: false,
        regNo: 'HR 26 EE 4521',
        operator: 'JBM LOGISTICS',
      })
      g.add(truck.root)
    }

    return () => {
      cancelled = true
    }
  }, [plan?.vehicle?.id, L, W, H, truckModelType, truckWallOpacity])

  // --- bay floor markings -------------------------------------------------
  useEffect(() => {
    const { groups } = refs.current
    if (!groups) return
    const g = groups.bays
    disposeGroup(g)
    if (!showBays || !deck) return

    const bayCount = Math.ceil(deck.lengthMm / 1200)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x93a4b8, transparent: true, opacity: 0.6 })
    for (let i = 1; i < bayCount; i += 1) {
      const x = (i * 1.2) - L / 2
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.01, -W / 2),
        new THREE.Vector3(x, 0.01, W / 2),
      ])
      g.add(new THREE.Line(geo, lineMat))
    }
    for (let i = 0; i < bayCount; i += 1) {
      const s = makeLabelSprite(`B${String(i + 1).padStart(2, '0')}`, { color: '#64748b', size: 48 })
      s.position.set(i * 1.2 + 0.6 - L / 2, 0.02, -W / 2 - 0.3)
      s.scale.multiplyScalar(0.42)
      g.add(s)
    }
    // row markers
    ;[['L', -W / 3], ['C', 0], ['R', W / 3]].forEach(([label, z]) => {
      const s = makeLabelSprite(label, { color: '#94a3b8', size: 44 })
      s.position.set(-L / 2 - 0.32, 0.02, z)
      s.scale.multiplyScalar(0.4)
      g.add(s)
    })
  }, [showBays, deck, L, W])

  // --- cargo --------------------------------------------------------------
  useEffect(() => {
    const { groups, picks } = refs.current
    if (!groups) return
    const g = groups.cargo
    disposeGroup(g)
    picks.clear()
    if (!plan || plan.empty) return

    const visible = new Set(sequence.slice(0, step).map(p => p.huId))

    plan.placements.forEach(p => {
      if (!visible.has(p.huId)) return
      if (tierFilter > 0 && p.tier !== tierFilter) return

      const sx = p.l / 1000
      const sy = p.h / 1000
      const sz = p.w / 1000
      const isSelected = selectedHuId === p.huId
      const isFlagged = flagged.has(p.huId)

      const box = new THREE.BoxGeometry(sx * 0.985, sy * 0.985, sz * 0.985)
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colourFor(p)),
        metalness: p.packagingCode?.startsWith('ST') ? 0.55 : 0.15,
        roughness: p.packagingCode?.startsWith('ST') ? 0.45 : 0.65,
        transparent: colourMode === 'risk' && !isFlagged && !p.tight && !p.isReturnAsset,
        opacity: colourMode === 'risk' && !isFlagged && !p.tight && !p.isReturnAsset ? 0.28 : 1,
        emissive: new THREE.Color(isSelected ? 0x1d4ed8 : isFlagged ? 0x7f1d1d : 0x000000),
        emissiveIntensity: isSelected ? 0.45 : isFlagged ? 0.3 : 0,
      })

      const mesh = new THREE.Mesh(box, mat)
      mesh.castShadow = true
      mesh.receiveShadow = true

      const unit = new THREE.Group()
      unit.add(mesh)

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(box),
        new THREE.LineBasicMaterial({
          color: isSelected ? 0x0f172a : 0xffffff,
          transparent: true,
          opacity: isSelected ? 0.95 : 0.5,
        }),
      )
      unit.add(edges)

      // a floor-only / zero-top-load unit gets a visible "do not stack" cap
      if (p.topLoadCapacityKg === 0) {
        const cap = new THREE.Mesh(
          new THREE.PlaneGeometry(sx * 0.9, sz * 0.9),
          new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
        )
        cap.rotation.x = -Math.PI / 2
        cap.position.y = sy / 2 + 0.012
        unit.add(cap)
      }

      const baseX = (p.x + p.l / 2) / 1000 - L / 2
      const baseY = (p.y + p.h / 2) / 1000
      const baseZ = (p.z + p.w / 2) / 1000 - W / 2
      const ex = explode * 0.45
      unit.position.set(
        baseX,
        baseY + (p.tier - 1) * ex * 1.6,
        baseZ + Math.sign(baseZ || 1) * ex,
      )
      unit.userData = { huId: p.huId }
      g.add(unit)
      picks.set(mesh.id, p)
    })
  }, [plan, step, tierFilter, colourMode, selectedHuId, explode, maxPressure, L, W])

  // --- overlays: CoG, axle lines, target window ---------------------------
  useEffect(() => {
    const { groups } = refs.current
    if (!groups || !plan || plan.empty) return
    const g = groups.overlay
    disposeGroup(g)

    const d = plan.distribution

    if (showAxles) {
      plan.vehicle.axleGroups.forEach(ax => {
        const axle = d.axles.find(a => a.id === ax.id)
        const over = axle && !axle.compliant
        const x = ax.xMm / 1000 - L / 2
        const colour = over ? 0xdc2626 : axle && axle.utilPct > 90 ? 0xd97706 : 0x16a34a

        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.02, W + 1.3),
          new THREE.MeshBasicMaterial({ color: colour }),
        )
        bar.position.set(x, -plan.vehicle.geometry.deckHeightMm / 1000 + 0.03, 0)
        g.add(bar)

      })
    }

    if (showCog) {
      // permitted longitudinal CoG window, painted on the deck
      const [lo, hi] = d.cogWindowPct
      const bandStart = (lo / 100) * L - L / 2
      const bandLen = ((hi - lo) / 100) * L
      const band = new THREE.Mesh(
        new THREE.PlaneGeometry(bandLen, W * 0.96),
        new THREE.MeshBasicMaterial({ color: 0x16a34a, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
      )
      band.rotation.x = -Math.PI / 2
      band.position.set(bandStart + bandLen / 2, 0.006, 0)
      g.add(band)

      const cogX = d.cogXMm / 1000 - L / 2
      const cogZ = d.cogLateralMm / 1000
      const cogY = d.cargoCogHeightMm / 1000 - plan.vehicle.geometry.deckHeightMm / 1000
      const bad = !d.cogInWindow || !d.lateralBalanced
      const colour = bad ? 0xdc2626 : 0x059669

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.22, 0.3, 40),
        new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.set(cogX, 0.012, cogZ)
      g.add(ring)

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 20, 16),
        new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.35 }),
      )
      sphere.position.set(cogX, cogY, cogZ)
      g.add(sphere)

      const plumb = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(cogX, 0.012, cogZ),
          new THREE.Vector3(cogX, cogY, cogZ),
        ]),
        new THREE.LineDashedMaterial({ color: colour, dashSize: 0.12, gapSize: 0.08 }),
      )
      plumb.computeLineDistances()
      g.add(plumb)

    }
  }, [plan, showAxles, showCog, L, W])

  // --- residual free space ------------------------------------------------
  useEffect(() => {
    const { groups } = refs.current
    if (!groups) return
    const g = groups.voids
    disposeGroup(g)
    if (!showVoids || !plan || plan.empty) return

    const rect = plan.capacity.largestFreeFloorRect
    if (rect && rect.areaM2 > 0.2) {
      const sx = rect.l / 1000
      const sz = rect.w / 1000
      const sy = H
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(sx, sy, sz),
        new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.13 }),
      )
      box.position.set(rect.x / 1000 + sx / 2 - L / 2, sy / 2, rect.z / 1000 + sz / 2 - W / 2)
      g.add(box)
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(box.geometry),
        new THREE.LineDashedMaterial({ color: 0x0284c7, dashSize: 0.14, gapSize: 0.1 }),
      )
      wire.computeLineDistances()
      wire.position.copy(box.position)
      g.add(wire)

    }

    // headroom slab above the load
    const head = plan.capacity.heightHeadroomMm / 1000
    if (head > 0.15) {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(L * 0.98, head, W * 0.98),
        new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.09 }),
      )
      slab.position.set(0, plan.capacity.maxStackHeightMm / 1000 + head / 2, 0)
      g.add(slab)
    }
  }, [showVoids, plan, L, W, H])

  // --- camera framing -----------------------------------------------------
  // The body is framed by fitting its bounding sphere to the smaller of the
  // vertical and horizontal fields of view, so the load fills the viewport at
  // any pane width instead of being clipped on a wide, short stage.
  const fitCamera = useCallbackRef((preset) => {
    const { camera, controls, renderer } = refs.current
    if (!camera || !controls || !renderer) return
    const deckY = (plan?.vehicle?.geometry?.deckHeightMm || 1300) / 1000
    const target = new THREE.Vector3(0, deckY + H / 2, 0)

    const DIRS = {
      iso: [1, 0.68, 1.2],
      side: [0, 0.1, 1],
      top: [0, 1, 0.0015],
      rear: [1, 0.2, 0.0015],
      front: [-1, 0.2, 0.0015],
    }
    const margin = preset === 'iso' ? 1.3 : 1.12
    const radius = Math.sqrt((L / 2) ** 2 + (H / 2) ** 2 + (W / 2) ** 2)

    const vFov = (camera.fov * Math.PI) / 180
    const aspect = camera.aspect || 1
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    const distance = Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2)) * margin;

    const dir = new THREE.Vector3(...(DIRS[preset] || DIRS.iso)).normalize()
    camera.position.copy(target).addScaledVector(dir, distance)
    camera.near = Math.max(0.05, distance / 500)
    camera.far = distance * 12
    camera.updateProjectionMatrix()
    controls.target.copy(target)
    controls.minDistance = radius * 0.35
    controls.maxDistance = distance * 3.2
    controls.update()
  })

  useEffect(() => {
    refs.current.refit = () => fitCamera(cameraPreset)
    fitCamera(cameraPreset)
  }, [cameraPreset, L, W, H, plan?.vehicle?.id, fitCamera])

  // --- sequence playback --------------------------------------------------
  useEffect(() => {
    if (!playing) return undefined
    if (step >= sequence.length) { setPlaying(false); return undefined }
    const t = setTimeout(() => setStep(s => Math.min(s + 1, sequence.length)), 160)
    return () => clearTimeout(t)
  }, [playing, step, sequence.length])

  // --- picking ------------------------------------------------------------
  const pick = (e, commit) => {
    const { camera, groups, picks } = refs.current
    const container = mountRef.current
    if (!camera || !container || !groups) return
    const rect = container.getBoundingClientRect()
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    ), camera)

    const meshes = []
    groups.cargo.children.forEach(u => u.children.forEach(c => { if (c.isMesh) meshes.push(c) }))
    const hit = ray.intersectObjects(meshes, false)[0]
    const unit = hit ? picks.get(hit.object.id) : null
    setHovered(unit || null)
    container.style.cursor = unit ? 'pointer' : 'default'
    if (commit && onSelectUnit) onSelectUnit(unit ? unit.huId : null)
  }

  const securingFor = (huId) => plan?.securing?.items?.find(i => i.huId === huId)
  const seqFor = (huId) => {
    const l = plan?.loadSequence?.find(i => i.huId === huId)
    const u = plan?.unloadSequence?.find(i => i.huId === huId)
    return { load: l?.loadSeq, unload: u?.unloadSeq, address: l?.address, side: l?.forkliftSide }
  }

  const detail = hovered || plan?.placements?.find(p => p.huId === selectedHuId)
  const detailSecuring = detail ? securingFor(detail.huId) : null
  const detailSeq = detail ? seqFor(detail.huId) : null
  const maxTier = Math.max(1, ...(plan?.placements || []).map(p => p.tier))

  if (!plan || plan.empty) {
    return (
      <div className="viewport-empty">
        <div className="viewport-empty-inner">
          <span className="viewport-empty-icon">📦</span>
          <strong>No load plan yet</strong>
          <p>Select consignment lines and a vehicle to solve a load pattern.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="lv-wrap">
      <div
        ref={mountRef}
        className="lv-canvas"
        onPointerMove={(e) => pick(e, false)}
        onClick={(e) => pick(e, true)}
      />

      {/* ---- toolbar: one dense row, top left ---- */}
      <div className="lv-bar">
        <div className="lv-seg">
          {[['iso', 'Iso'], ['side', 'Side'], ['top', 'Plan'], ['rear', 'Doors'], ['front', 'Head']].map(([v, label]) => (
            <button
              key={v}
              className={`lv-btn ${cameraPreset === v ? 'active' : ''}`}
              onClick={() => setCameraPreset(v)}
            >
              {label}
            </button>
          ))}
        </div>

        <select className="lv-select" value={colourMode} onChange={e => setColourMode(e.target.value)}>
          {COLOUR_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>

        <select className="lv-select" value={tierFilter} onChange={e => setTierFilter(Number(e.target.value))}>
          <option value={0}>All tiers</option>
          {Array.from({ length: maxTier }, (_, i) => (
            <option key={i + 1} value={i + 1}>Tier {i + 1}</option>
          ))}
        </select>

        <div className="lv-seg">
          <button className={`lv-btn ${showAxles ? 'active' : ''}`} onClick={() => setShowAxles(v => !v)} title="Axle centrelines">Axles</button>
          <button className={`lv-btn ${showCog ? 'active' : ''}`} onClick={() => setShowCog(v => !v)} title="Centre of gravity and its working window">CoG</button>
          <button className={`lv-btn ${showVoids ? 'active' : ''}`} onClick={() => setShowVoids(v => !v)} title="Residual free space">Void</button>
          <button className={`lv-btn ${showBays ? 'active' : ''}`} onClick={() => setShowBays(v => !v)} title="Bay and row grid">Grid</button>
        </div>

        {isRealisticTruckSupported(plan?.vehicle?.id) ? (
          <>
            <div className="lv-seg">
              <button
                className={`lv-btn ${truckModelType === 'realistic' ? 'active' : ''}`}
                onClick={() => setTruckModelType('realistic')}
                title="Authentic Indian Truck 3D Model"
              >
                🚛 3D Truck
              </button>
              <button
                className={`lv-btn ${truckModelType === 'cad' ? 'active' : ''}`}
                onClick={() => setTruckModelType('cad')}
                title="Procedural Engineering CAD Chassis"
              >
                📐 CAD
              </button>
            </div>

            {truckModelType === 'realistic' && (
              <label className="lv-slider" title="Truck cargo body transparency">
                <span>Body</span>
                <input
                  type="range" min="0.05" max="1" step="0.05"
                  value={truckWallOpacity}
                  onChange={e => setTruckWallOpacity(Number(e.target.value))}
                />
              </label>
            )}
          </>
        ) : (
          <div className="lv-seg">
            <span
              className="lv-btn active"
              style={{
                cursor: 'default',
                background: 'rgba(241, 245, 249, 0.95)',
                color: '#475569',
                borderColor: '#cbd5e1',
                fontSize: '10px'
              }}
              title={`Procedural CAD chassis matching ${plan?.vehicle?.name || 'selected vehicle'} specs (3D Model active on Tata Ultra 28ft)`}
            >
              📐 CAD Twin
            </span>
          </div>
        )}

        <label className="lv-slider" title="Separate the tiers to inspect the pattern">
          <span>Split</span>
          <input
            type="range" min="0" max="1" step="0.05"
            value={explode}
            onChange={e => setExplode(Number(e.target.value))}
          />
        </label>
      </div>

      {modelLoading && (
        <div style={{
          position: 'absolute',
          top: 56,
          left: 12,
          background: 'rgba(15, 23, 42, 0.88)',
          color: '#f8fafc',
          padding: '6px 14px',
          borderRadius: '999px',
          fontSize: '11px',
          fontWeight: 500,
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 10,
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span style={{
            width: 12,
            height: 12,
            border: '2px solid rgba(255,255,255,0.25)',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'lv-spin 0.8s linear infinite'
          }} />
          <span>Loading 3D Twin... {loadProgress > 0 ? `${loadProgress}%` : ''}</span>
        </div>
      )}

      {/* ---- axle + stability readout: top right, HTML not 3D text ---- */}
      <div className="lv-readout">
        {plan.distribution.axles.map(a => (
          <div className={`lv-ro-row ${a.compliant ? (a.utilPct > 90 ? 'warn' : 'ok') : 'bad'}`} key={a.id}>
            <span className="lv-ro-label">{a.label}</span>
            <div className="lv-ro-track">
              <div className="lv-ro-fill" style={{ width: `${Math.min(a.utilPct, 100)}%` }} />
            </div>
            <span className="lv-ro-val">{a.utilPct.toFixed(0)}%</span>
            <span className="lv-ro-kg">
              {a.loadKg.toLocaleString('en-IN')} / {a.limitKg.toLocaleString('en-IN')} kg
            </span>
          </div>
        ))}
        <div className="lv-ro-foot">
          <span>
            CoG <strong className={plan.distribution.cogInWindow ? '' : 'text-danger'}>
              {plan.distribution.cogFractionPct.toFixed(1)}%
            </strong>
          </span>
          <span>
            lat <strong className={plan.distribution.lateralBalanced ? '' : 'text-danger'}>
              {plan.distribution.cogLateralMm > 0 ? '+' : ''}{plan.distribution.cogLateralMm} mm
            </strong>
          </span>
          <span>
            SRT <strong className={plan.distribution.rolloverSafe ? '' : 'text-danger'}>
              {plan.distribution.rolloverThresholdG} g
            </strong>
          </span>
        </div>
        {showVoids && plan.capacity.largestFreeFloorRect.areaM2 > 0.2 && (
          <div className="lv-ro-void">
            Largest free block {plan.capacity.largestFreeFloorRect.l} × {plan.capacity.largestFreeFloorRect.w} mm
            {' '}× {plan.capacity.heightHeadroomMm} mm headroom
          </div>
        )}
      </div>

      {/* ---- unit inspector ---- */}
      {detail && (
        <div className="lv-inspect">
          <div className="lv-inspect-head">
            <span className="lv-swatch" style={{ background: colourFor(detail) }} />
            <strong>{detail.partNo}</strong>
            <span className="lv-inspect-hu">{detail.huId}</span>
            {flagged.has(detail.huId) && <span className="badge badge-danger">EXCEPTION</span>}
            {detail.tight && <span className="badge badge-warning">TIGHT</span>}
            {detail.isReturnAsset && <span className="badge badge-info">BACKHAUL</span>}
          </div>
          <div className="lv-inspect-name">{detail.partName}</div>
          <div className="lv-inspect-grid">
            <div><span>Position</span><strong>{detailSeq?.address}</strong></div>
            <div><span>Load / unload</span><strong>#{detailSeq?.load} / #{detailSeq?.unload}</strong></div>
            <div><span>Consignee</span><strong>{detail.customerCode} · drop {detail.dropSeq}</strong></div>
            <div><span>Gross</span><strong>{Math.round(detail.grossKg)} kg</strong></div>
            <div><span>Envelope</span><strong>{detail.l}×{detail.w}×{detail.h}{detail.rotated ? ' ↻' : ''}</strong></div>
            <div><span>Deck pressure</span><strong>{Math.round(detail.grossKg / ((detail.l * detail.w) / 1e6))} kg/m²</strong></div>
            <div><span>Top load</span><strong>{detail.topLoadCapacityKg === 0 ? 'none' : `${detail.topLoadCapacityKg} kg`}</strong></div>
            <div><span>Lashings</span><strong>{detailSecuring?.lashings ?? '—'} @ μ {detailSecuring?.mu ?? detail.mu}</strong></div>
          </div>
          {detailSecuring?.measures?.length > 0 && (
            <ul className="lv-inspect-measures">
              {detailSecuring.measures.slice(0, 3).map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* ---- bottom bar: sequence scrubber + legend in one strip ---- */}
      <div className="lv-foot">
        <button
          className="lv-btn lv-btn-primary"
          onClick={() => {
            if (step >= sequence.length) setStep(0)
            setPlaying(p => !p)
          }}
        >
          {playing ? '❚❚' : step >= sequence.length ? '↻ Replay load' : '▶ Play load'}
        </button>
        <input
          type="range"
          min="0"
          max={sequence.length}
          value={step}
          onChange={e => { setPlaying(false); setStep(Number(e.target.value)) }}
          className="lv-range-wide"
        />
        <span className="lv-foot-readout">
          <strong>{step}</strong>/{sequence.length}
          {step > 0 && step <= sequence.length && (
            <em>
              {sequence[step - 1].address} · {sequence[step - 1].partNo} · from {sequence[step - 1].forkliftSide}
            </em>
          )}
        </span>
        <span className="lv-foot-legend">
          {colourMode === 'consignee' && (plan.drops || []).map((dr, i) => (
            <span key={dr.customerId}>
              <i style={{ background: CONSIGNEE_PALETTE[i % CONSIGNEE_PALETTE.length] }} />{dr.code}
            </span>
          ))}
          {colourMode === 'tier' && Array.from({ length: maxTier }, (_, i) => (
            <span key={i}>
              <i style={{ background: TIER_PALETTE[Math.min(i, TIER_PALETTE.length - 1)] }} />T{i + 1}
            </span>
          ))}
          {colourMode === 'pressure' && (
            <span><i className="lv-grad" />0–{Math.round(maxPressure)} kg/m²</span>
          )}
          {colourMode === 'risk' && (
            <>
              <span><i style={{ background: '#dc2626' }} />exception</span>
              <span><i style={{ background: '#d97706' }} />tight fit</span>
              <span><i style={{ background: '#64748b' }} />backhaul</span>
            </>
          )}
          {colourMode === 'sequence' && (plan.drops || []).map(dr => (
            <span key={dr.customerId}>
              <i style={{ background: SEQ_PALETTE[(dr.dropSeq - 1) % SEQ_PALETTE.length] }} />drop {dr.dropSeq}
            </span>
          ))}
          {colourMode === 'packaging' && [...new Set(plan.placements.map(p => p.packagingCode))].map(code => (
            <span key={code}>
              <i style={{ background: plan.placements.find(p => p.packagingCode === code).color }} />{code}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}
