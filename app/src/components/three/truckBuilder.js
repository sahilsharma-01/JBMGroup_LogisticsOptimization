import * as THREE from 'three'

// ============================================================================
// INDIAN HEAVY COMMERCIAL VEHICLE — 3D MODEL BUILDER
// ----------------------------------------------------------------------------
// Built to look like what actually backs onto a JBM dock: a cab-over HCV with a
// locally fabricated steel-and-plank body. The details that make it read as an
// Indian truck rather than a generic box are mostly regulatory or structural:
//
//   • AIS-090 retro-reflective conspicuity tape — red/white on the rear,
//     white along the sides, yellow across the front. Mandatory, and the first
//     thing you notice on a loaded truck at night.
//   • AIS-069 side under-run protection bars and a rear under-run bumper.
//   • Body-builder construction: vertical steel posts with horizontal plank
//     infill and a contrasting lower skirt.
//   • Tarpaulin hoops over the body, chrome grille, sun visor over the
//     windscreen, roof marker lamps, mudflaps, vertical exhaust stack behind
//     the cab, chassis-rail fuel and air tanks, rear ladder, spare wheel
//     carrier slung under the deck.
//   • Dual tyres on the drive bogie, single on the steer axle.
//
// COORDINATE FRAME
// The engine works in deck-local millimetres with x = 0 at the inner face of
// the bulkhead. The scene centres the body on the origin, so every deck-local
// coordinate must be mapped through
//     sceneX = xMm / 1000 - L / 2
// Axle positions come from the chassis geometry in the deck-local frame and
// are frequently negative (the steer axle sits ahead of the bulkhead), so the
// mapping has to be applied consistently or the cab lands inside the body.
//
// STRUCTURE — the split matters for the ride simulation:
//
//   root
//   ├── unsprung   wheels and axle beams: stay with the road surface
//   └── sprung     chassis, body, cab and the cargo anchor: rolls and pitches
//       └── cargoAnchor   origin at the centre of the deck surface, so cargo
//                         placed in deck coordinates rides with the body
// ============================================================================

const MAT = {
  tyre: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.92, metalness: 0.02 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xcfd8e3, roughness: 0.35, metalness: 0.85 }),
  hub: new THREE.MeshStandardMaterial({ color: 0x8a949f, roughness: 0.5, metalness: 0.7 }),
  chassis: new THREE.MeshStandardMaterial({ color: 0x3b3027, roughness: 0.75, metalness: 0.4 }),
  deck: new THREE.MeshStandardMaterial({ color: 0x6b5336, roughness: 0.88, metalness: 0.05 }),
  deckEdge: new THREE.MeshStandardMaterial({ color: 0x2c3440, roughness: 0.6, metalness: 0.55 }),
  post: new THREE.MeshStandardMaterial({ color: 0x1f6feb, roughness: 0.45, metalness: 0.35 }),
  plank: new THREE.MeshStandardMaterial({ color: 0x2f82f2, roughness: 0.55, metalness: 0.2 }),
  skirt: new THREE.MeshStandardMaterial({ color: 0xf0b429, roughness: 0.5, metalness: 0.2 }),
  cab: new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.35, metalness: 0.3 }),
  cabLower: new THREE.MeshStandardMaterial({ color: 0x1f6feb, roughness: 0.4, metalness: 0.3 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.12, metalness: 0.95 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x16222e, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.72,
  }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 0.55, roughness: 0.3 }),
  lampRed: new THREE.MeshStandardMaterial({ color: 0xd42a2a, emissive: 0x8f1111, emissiveIntensity: 0.5, roughness: 0.35 }),
  lampAmber: new THREE.MeshStandardMaterial({ color: 0xffa726, emissive: 0xc97a0a, emissiveIntensity: 0.5, roughness: 0.35 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.95 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa5b1, roughness: 0.45, metalness: 0.8 }),
  tarp: new THREE.MeshStandardMaterial({ color: 0x15467a, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }),
  spring: new THREE.MeshStandardMaterial({ color: 0x4a515a, roughness: 0.6, metalness: 0.7 }),
  drum: new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.85, metalness: 0.5 }),
  diff: new THREE.MeshStandardMaterial({ color: 0x2f353d, roughness: 0.7, metalness: 0.6 }),
  cloth: new THREE.MeshStandardMaterial({ color: 0x1b2a3a, roughness: 0.95 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xb98a63, roughness: 0.85 }),
}

// ---------------------------------------------------------------------------
// Canvas-texture helpers for tape, plates and lettering
// ---------------------------------------------------------------------------
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 4
  return t
}

/** AIS-090 conspicuity tape: alternating blocks, red/white at the rear. */
function tapeTexture(colourA, colourB, blocks = 10) {
  return canvasTexture(512, 64, (ctx, w, h) => {
    const bw = w / blocks
    for (let i = 0; i < blocks; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? colourA : colourB
      ctx.fillRect(i * bw, 0, bw, h)
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, w, h)
  })
}

function plateTexture(regNo) {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f7f7f2'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 8
    ctx.strokeRect(6, 6, w - 12, h - 12)
    ctx.fillStyle = '#111'
    ctx.font = '700 62px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(regNo || 'HR 26 EE 4521', w / 2, h / 2 + 4)
  })
}

/** The rear tailgate panel: operator name, permit text, mudflap chevrons. */
function tailgateTexture(operator) {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1f6feb'
    ctx.fillRect(0, 0, w, h)

    // yellow band
    ctx.fillStyle = '#f0b429'
    ctx.fillRect(0, h * 0.60, w, h * 0.12)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 86px Arial, sans-serif'
    ctx.fillText('HORN OK PLEASE', w / 2, h * 0.22)

    ctx.font = '700 46px Arial, sans-serif'
    ctx.fillText('ALL INDIA PERMIT', w / 2, h * 0.40)

    ctx.fillStyle = '#10243d'
    ctx.font = '700 52px Arial, sans-serif'
    ctx.fillText((operator || 'JBM LOGISTICS').toUpperCase(), w / 2, h * 0.695)

    ctx.fillStyle = '#ffffff'
    ctx.font = '600 34px Arial, sans-serif'
    ctx.fillText('USE DIPPER AT NIGHT', w / 2, h * 0.86)
  })
}

/** Horizontal plank infill with visible seams, for the body sides. */
function plankTexture(base, seam, rows = 7) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = seam
    ctx.lineWidth = 3
    for (let i = 1; i < rows; i += 1) {
      const y = (h / rows) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
  })
}

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)

// ---------------------------------------------------------------------------
// Wheels
// ---------------------------------------------------------------------------
function buildWheel({ radius = 0.47, width = 0.3, dual = false }) {
  const g = new THREE.Group()
  // Steering is applied to the outer group about Y; rolling is applied to this
  // inner group about its own axle axis (Z). Keeping them on separate objects
  // avoids the Euler-order coupling that makes a steered wheel wobble as it
  // spins.
  const spinner = new THREE.Group()
  g.add(spinner)
  g.userData.spinner = spinner
  const make = (zOff) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 28), MAT.tyre)
    t.rotation.x = Math.PI / 2
    t.position.z = zOff
    t.castShadow = true
    spinner.add(t)

    // tread shoulder
    const sh = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.99, width * 0.12, 8, 28), MAT.tyre)
    sh.position.z = zOff + width / 2 - width * 0.1
    spinner.add(sh)

    const r = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width * 1.04, 20), MAT.rim)
    r.rotation.x = Math.PI / 2
    r.position.z = zOff
    spinner.add(r)

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, width * 1.1, 12), MAT.hub)
    hub.rotation.x = Math.PI / 2
    hub.position.z = zOff
    spinner.add(hub)

    // wheel nuts, so rotation is actually visible
    for (let k = 0; k < 8; k += 1) {
      const ang = (k / 8) * Math.PI * 2
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, width * 1.16, 6), MAT.hub)
      nut.rotation.x = Math.PI / 2
      nut.position.set(Math.cos(ang) * radius * 0.36, Math.sin(ang) * radius * 0.36, zOff)
      spinner.add(nut)
    }
  }

  // brake drum sits inboard and does not turn with the rim
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.52, radius * 0.52, width * 0.5, 16),
    MAT.drum,
  )
  drum.rotation.x = Math.PI / 2
  drum.position.z = dual ? -width * 0.75 : -width * 0.4
  g.add(drum)
  if (dual) {
    make(-width * 0.56)
    make(width * 0.56)
  } else {
    make(0)
  }
  return g
}

// ---------------------------------------------------------------------------
// Cab — tall cab-over with chrome grille and sun visor
// ---------------------------------------------------------------------------
function buildCab({ width, deckHeight, regNo }) {
  const g = new THREE.Group()
  const cw = width * 0.97
  const ch = 2.05           // cab height above the chassis rail
  const cl = 2.25           // cab length

  const shell = box(cl, ch, cw, MAT.cab)
  shell.position.set(0, ch / 2, 0)
  shell.castShadow = true
  g.add(shell)

  // roof air deflector, near universal on Indian HCV cabs pulling a high body
  const deflector = box(0.55, 0.34, cw * 0.92, MAT.cabLower)
  deflector.position.set(cl * 0.22, ch + 0.15, 0)
  deflector.rotation.z = -0.22
  g.add(deflector)

  // door line and handle
  ;[-1, 1].forEach(sd => {
    const seam = box(0.012, ch * 0.52, 0.012, MAT.chrome)
    seam.position.set(cl * 0.12, ch * 0.44, (sd * cw) / 2)
    g.add(seam)
    const handle = box(0.05, 0.035, 0.14, MAT.chrome)
    handle.position.set(cl * 0.02, ch * 0.45, (sd * cw) / 2 + 0.02)
    g.add(handle)
    // cab step below the door
    const step = box(0.42, 0.04, 0.3, MAT.steel)
    step.position.set(cl * 0.05, -0.2, (sd * cw) / 2 - 0.1)
    g.add(step)
  })

  // chrome waist strip
  const strip = box(cl * 1.002, 0.035, cw * 1.004, MAT.chrome)
  strip.position.set(0, ch * 0.3, 0)
  g.add(strip)

  // driver, so scale and the cab interior read correctly
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.34, 4, 10), MAT.cloth)
  torso.position.set(-cl * 0.1, ch * 0.56, cw * 0.26)
  g.add(torso)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), MAT.skin)
  head.position.set(-cl * 0.1, ch * 0.78, cw * 0.26)
  g.add(head)

  // lower painted section
  const lower = box(cl * 1.005, ch * 0.3, cw * 1.004, MAT.cabLower)
  lower.position.set(0, ch * 0.15, 0)
  g.add(lower)

  // windscreen, slightly raked
  const ws = box(0.06, ch * 0.42, cw * 0.9, MAT.glass)
  ws.position.set(-cl / 2 + 0.02, ch * 0.66, 0)
  ws.rotation.z = -0.05
  g.add(ws)

  // side windows
  ;[-1, 1].forEach(s => {
    const sw = box(cl * 0.5, ch * 0.3, 0.04, MAT.glass)
    sw.position.set(-cl * 0.08, ch * 0.66, (s * cw) / 2)
    g.add(sw)
  })

  // sun visor over the windscreen
  const visor = box(0.42, 0.07, cw * 0.96, MAT.cabLower)
  visor.position.set(-cl / 2 + 0.16, ch * 0.9, 0)
  visor.rotation.z = 0.12
  g.add(visor)

  // chrome grille with horizontal bars
  const grille = box(0.07, ch * 0.2, cw * 0.62, MAT.chrome)
  grille.position.set(-cl / 2 - 0.02, ch * 0.4, 0)
  g.add(grille)
  for (let i = 0; i < 4; i += 1) {
    const bar = box(0.1, 0.022, cw * 0.6, MAT.chrome)
    bar.position.set(-cl / 2 - 0.04, ch * 0.33 + i * 0.045, 0)
    g.add(bar)
  }

  // headlamps and fog lamps
  ;[-1, 1].forEach(s => {
    const hl = box(0.08, 0.17, cw * 0.17, MAT.lamp)
    hl.position.set(-cl / 2 - 0.03, ch * 0.27, s * cw * 0.33)
    g.add(hl)
    const fog = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.07, 14), MAT.lamp)
    fog.rotation.z = Math.PI / 2
    fog.position.set(-cl / 2 - 0.1, 0.17, s * cw * 0.3)
    g.add(fog)
    // indicator
    const ind = box(0.07, 0.09, cw * 0.1, MAT.lampAmber)
    ind.position.set(-cl / 2 - 0.03, ch * 0.27, s * cw * 0.46)
    g.add(ind)
  })

  // roof marker lamps
  for (let i = -2; i <= 2; i += 1) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), MAT.lampAmber)
    m.position.set(-cl / 2 + 0.3, ch + 0.02, (i * cw) / 5.6)
    g.add(m)
  }

  // front bumper with yellow conspicuity tape
  const bumper = box(0.22, 0.34, cw * 1.02, MAT.steel)
  bumper.position.set(-cl / 2 - 0.14, 0.2, 0)
  g.add(bumper)
  const frontTape = box(0.02, 0.07, cw * 0.98, new THREE.MeshStandardMaterial({
    map: tapeTexture('#f5d020', '#f5f5f0', 12), roughness: 0.3, metalness: 0.1,
  }))
  frontTape.position.set(-cl / 2 - 0.26, 0.2, 0)
  g.add(frontTape)

  // mirrors
  ;[-1, 1].forEach(s => {
    const arm = box(0.04, 0.04, 0.26, MAT.steel)
    arm.position.set(-cl / 2 + 0.1, ch * 0.78, (s * cw) / 2 + 0.13)
    g.add(arm)
    const mirror = box(0.06, 0.26, 0.14, MAT.cabLower)
    mirror.position.set(-cl / 2 + 0.1, ch * 0.72, (s * cw) / 2 + 0.26)
    g.add(mirror)
  })

  // number plate
  const plate = box(0.02, 0.12, 0.5, new THREE.MeshStandardMaterial({
    map: plateTexture(regNo), roughness: 0.5,
  }))
  plate.position.set(-cl / 2 - 0.27, 0.42, 0)
  g.add(plate)

  // exhaust stack behind the cab
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 2.3, 14), MAT.chrome)
  stack.position.set(cl / 2 - 0.1, 1.15, -cw / 2 + 0.14)
  g.add(stack)

  // air horns on the roof
  ;[-1, 1].forEach(s => {
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, 0.42, 12), MAT.chrome)
    horn.rotation.z = Math.PI / 2
    horn.position.set(0.1, ch + 0.08, s * 0.2)
    g.add(horn)
  })

  g.position.y = deckHeight - 0.32
  return g
}

// ---------------------------------------------------------------------------
// Cargo body: steel posts, plank infill, skirt, tape, tarpaulin hoops
// ---------------------------------------------------------------------------
function buildBody({ L, W, H, showTarp, operator, sideOpacity = 1 }) {
  const g = new THREE.Group()
  // The planning view needs to see the pattern, so the body panels can be made
  // translucent without changing any of the geometry.
  const seeThrough = (m) => {
    if (sideOpacity >= 1) return m
    const c = m.clone()
    c.transparent = true
    c.opacity = sideOpacity
    c.depthWrite = false
    return c
  }
  const plankMat = new THREE.MeshStandardMaterial({
    map: plankTexture('#2f82f2', '#1b5fb8'), roughness: 0.55, metalness: 0.2,
  })

  // deck boards
  const deck = box(L, 0.07, W, MAT.deck)
  deck.position.set(0, -0.035, 0)
  deck.receiveShadow = true
  g.add(deck)

  // deck edge rails
  ;[-1, 1].forEach(s => {
    const rail = box(L, 0.1, 0.07, MAT.deckEdge)
    rail.position.set(0, -0.02, (s * W) / 2)
    g.add(rail)
  })

  // headboard
  const head = box(0.1, H, W, seeThrough(plankMat))
  head.position.set(-L / 2 - 0.05, H / 2, 0)
  head.castShadow = sideOpacity >= 1
  g.add(head)
  const headCap = box(0.14, 0.09, W + 0.04, MAT.post)
  headCap.position.set(-L / 2 - 0.05, H, 0)
  g.add(headCap)

  // side walls: posts + plank infill + skirt
  const postCount = Math.max(4, Math.round(L / 1.25))
  ;[-1, 1].forEach(s => {
    const z = (s * W) / 2

    const skirt = box(L, H * 0.3, 0.05, seeThrough(MAT.skirt))
    skirt.position.set(0, H * 0.15, z)
    g.add(skirt)

    const planks = box(L, H * 0.7, 0.045, seeThrough(plankMat))
    planks.position.set(0, H * 0.65, z)
    planks.castShadow = sideOpacity >= 1
    g.add(planks)

    for (let i = 0; i <= postCount; i += 1) {
      const post = box(0.08, H, 0.09, MAT.post)
      post.position.set(-L / 2 + (L * i) / postCount, H / 2, z)
      g.add(post)
    }

    // top rail
    const top = box(L, 0.08, 0.1, MAT.post)
    top.position.set(0, H, z)
    g.add(top)

    // AIS-090 side conspicuity tape, white
    const tape = box(L * 0.97, 0.06, 0.02, new THREE.MeshStandardMaterial({
      map: tapeTexture('#f6f6f1', '#e3e3dc', 16), roughness: 0.3,
    }))
    tape.position.set(0, H * 0.3 + 0.07, z + s * 0.035)
    g.add(tape)
  })

  // rear tailgate with the lettering panel, hinged slightly open
  const tailMat = new THREE.MeshStandardMaterial({
    map: tailgateTexture(operator), roughness: 0.6, metalness: 0.1,
  })
  const tail = box(0.07, H * 0.92, W * 0.98, seeThrough(tailMat))
  tail.position.set(L / 2 + 0.04, (H * 0.92) / 2, 0)
  g.add(tail)

  // rear AIS-090 red/white tape
  const rearTape = box(0.02, 0.09, W * 0.96, new THREE.MeshStandardMaterial({
    map: tapeTexture('#d42a2a', '#f6f6f1', 10), roughness: 0.3,
  }))
  rearTape.position.set(L / 2 + 0.085, 0.16, 0)
  g.add(rearTape)

  // tail lamps — kept on the returned handle so braking can light them
  const tailLamps = []
  ;[-1, 1].forEach(s => {
    const mat = MAT.lampRed.clone()
    const lamp = box(0.055, 0.22, 0.17, mat)
    lamp.position.set(L / 2 + 0.08, 0.42, s * (W / 2 - 0.2))
    g.add(lamp)
    tailLamps.push(mat)
    // reversing lamp below it
    const rev = box(0.05, 0.1, 0.12, MAT.lamp)
    rev.position.set(L / 2 + 0.08, 0.24, s * (W / 2 - 0.2))
    g.add(rev)
  })
  g.userData.tailLamps = tailLamps

  // rear ladder
  const ladderZ = W / 2 - 0.35
  ;[-1, 1].forEach(s => {
    const rail = box(0.04, H * 0.8, 0.04, MAT.steel)
    rail.position.set(L / 2 + 0.12, H * 0.4, (s * 0.14) + ladderZ)
    g.add(rail)
  })
  for (let i = 0; i < 5; i += 1) {
    const rung = box(0.04, 0.03, 0.3, MAT.steel)
    rung.position.set(L / 2 + 0.12, 0.25 + i * (H * 0.75) / 5, ladderZ + 0.14)
    g.add(rung)
  }

  // tarpaulin hoops
  if (showTarp) {
    const hoopCount = Math.max(3, Math.round(L / 2.2))
    for (let i = 0; i <= hoopCount; i += 1) {
      const x = -L / 2 + (L * i) / hoopCount
      const hoop = new THREE.Mesh(
        new THREE.TorusGeometry(W / 2, 0.03, 6, 20, Math.PI),
        MAT.steel,
      )
      hoop.rotation.y = Math.PI / 2
      hoop.position.set(x, H, 0)
      g.add(hoop)
    }
    const ridge = box(L, 0.04, 0.04, MAT.steel)
    ridge.position.set(0, H + W / 2, 0)
    g.add(ridge)
  }

  return g
}

// ---------------------------------------------------------------------------
// Chassis, tanks, under-run protection
// ---------------------------------------------------------------------------
/** All x inputs here are already in the scene frame (see COORDINATE FRAME). */
function buildChassis({ L, W, deckHeight, frontX, rearX, axleScene, articulated, kingpinX }) {
  const g = new THREE.Group()
  const railZ = W * 0.28

  // An articulated outfit is two frames, not one. Drawing a single rail from
  // the cab to the trailer rear is the giveaway that a model is a rigid truck
  // wearing a trailer body, so the tractor frame and the trailer frame are
  // built separately with the fifth wheel between them.
  const frames = articulated
    ? [
      { from: frontX - 1.0, to: (axleScene.find(a => a.id === 'drive')?.x ?? frontX + 3.8) + 1.0, bays: 3 },
      { from: kingpinX - 0.6, to: L / 2 + 0.45, bays: 6 },
    ]
    : [{ from: frontX - 1.1, to: L / 2 + 0.45, bays: 6 }];

  frames.forEach(fr => {
    const len = fr.to - fr.from;
    if (len <= 0) return;
    [-1, 1].forEach(sd => {
      const rail = box(len, 0.22, 0.09, MAT.chassis)
      rail.position.set((fr.from + fr.to) / 2, -0.22, sd * railZ)
      g.add(rail)
    })
    for (let i = 0; i < fr.bays; i += 1) {
      const cross = box(0.1, 0.1, railZ * 2, MAT.chassis)
      cross.position.set(fr.from + (len * (i + 0.5)) / fr.bays, -0.24, 0)
      g.add(cross)
    }
  })

  if (articulated) {
    // fifth wheel coupling plate on the tractor
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.07, 20), MAT.steel)
    plate.position.set(kingpinX, -0.08, 0)
    g.add(plate)
    const jaw = box(0.5, 0.1, 0.18, MAT.steel)
    jaw.position.set(kingpinX - 0.3, -0.08, 0)
    g.add(jaw)

    // trailer landing legs
    ;[-1, 1].forEach(sd => {
      const leg = box(0.1, 0.78, 0.1, MAT.steel)
      leg.position.set(kingpinX + 1.5, -0.62, sd * railZ)
      g.add(leg)
      const foot = box(0.3, 0.06, 0.24, MAT.steel)
      foot.position.set(kingpinX + 1.5, -1.0, sd * railZ)
      g.add(foot)
    })
    const brace = box(0.1, 0.08, railZ * 2, MAT.steel)
    brace.position.set(kingpinX + 1.5, -0.42, 0)
    g.add(brace)
  }

  // fuel tank and air tanks on the left rail
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 1.5, 18), MAT.chrome)
  tank.rotation.x = Math.PI / 2
  tank.rotation.z = Math.PI / 2
  tank.position.set(frontX + 1.5, -0.34, -railZ - 0.26)
  g.add(tank)

  ;[0, 1].forEach(i => {
    const air = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.62, 14), MAT.steel)
    air.rotation.x = Math.PI / 2
    air.rotation.z = Math.PI / 2
    air.position.set(frontX + 3.1 + i * 0.75, -0.34, railZ + 0.24)
    g.add(air)
  })

  // battery / toolbox
  const tool = box(0.7, 0.3, 0.34, MAT.steel)
  tool.position.set(frontX + 2.6, -0.34, -railZ - 0.24)
  g.add(tool)

  // AIS-069 side under-run protection bars
  ;[-1, 1].forEach(s => {
    const barStart = frontX + 0.9
    const barEnd = rearX - 1.1
    if (barEnd <= barStart) return
    const bar = box(barEnd - barStart, 0.1, 0.06, MAT.steel)
    bar.position.set((barStart + barEnd) / 2, -0.62, (s * W) / 2 - 0.06)
    g.add(bar)
    const n = 3
    for (let i = 0; i < n; i += 1) {
      const stay = box(0.05, 0.42, 0.05, MAT.steel)
      stay.position.set(barStart + ((barEnd - barStart) * (i + 0.5)) / n, -0.42, (s * W) / 2 - 0.06)
      g.add(stay)
    }
  })

  // rear under-run protection
  const rupd = box(0.12, 0.14, W * 0.92, MAT.steel)
  rupd.position.set(L / 2 + 0.3, -0.62, 0)
  g.add(rupd)
  ;[-1, 1].forEach(s => {
    const stay = box(0.5, 0.06, 0.08, MAT.steel)
    stay.position.set(L / 2 + 0.1, -0.56, s * W * 0.3)
    g.add(stay)
  })

  // spare wheel slung under the deck
  const spare = buildWheel({ radius: 0.44, width: 0.28 })
  spare.rotation.x = Math.PI / 2
  spare.position.set(0.2, -0.56, 0)
  g.add(spare)

  // leaf spring packs and mudflaps at each axle
  axleScene.forEach(ax => {
    const x = ax.x
    ;[-1, 1].forEach(s => {
      const spring = box(1.15, 0.07, 0.11, MAT.spring)
      spring.position.set(x, -0.4, s * railZ)
      g.add(spring)

      const flap = box(0.03, 0.42, 0.42, MAT.rubber)
      flap.position.set(x + 0.72, -0.62, (s * W) / 2 - 0.16)
      g.add(flap)
    })
  })

  // differential housings and prop shaft on the driven axles
  const driven = axleScene.filter(a => a.id === 'drive')
  driven.forEach(ax => {
    const diff = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), MAT.diff)
    diff.position.set(ax.x, -0.47 + 0.0, 0)
    diff.scale.set(1, 0.85, 0.8)
    g.add(diff)
  })
  if (driven.length) {
    const shaftFrom = frontX + 2.2
    const shaftTo = driven[0].x
    if (shaftTo > shaftFrom) {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, shaftTo - shaftFrom, 10), MAT.diff,
      )
      shaft.rotation.z = Math.PI / 2
      shaft.position.set((shaftFrom + shaftTo) / 2, -0.44, 0)
      g.add(shaft)
    }
    // silencer box on the left rail
    const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.8, 14), MAT.steel)
    muffler.rotation.x = Math.PI / 2
    muffler.rotation.z = Math.PI / 2
    muffler.position.set(frontX + 2.0, -0.5, -railZ - 0.18)
    g.add(muffler)
  }

  // mudguards over the rear bogie
  axleScene.filter(a => a.id !== 'steer').forEach(ax => {
    const x = ax.x
    ;[-1, 1].forEach(s => {
      const guard = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.05, 6, 16, Math.PI * 0.75),
        MAT.skirt,
      )
      guard.rotation.y = Math.PI / 2
      guard.rotation.z = Math.PI * 0.12
      guard.position.set(x, -0.1, (s * W) / 2 - 0.04)
      g.add(guard)
    })
  })

  g.position.y = deckHeight
  return g
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------
/**
 * @param {object} vehicle resolved vehicle (specs.resolveVehicle)
 * @param {object} opts    { showTarp, regNo, operator, sideOpacity }
 * @returns {{ root, sprung, unsprung, cargoAnchor, wheels, deckHeight }}
 */
export function buildIndianTruck(vehicle, opts = {}) {
  const { showTarp = false, regNo, operator, sideOpacity = 1 } = opts
  const L = vehicle.deck.lengthMm / 1000
  const W = vehicle.deck.widthMm / 1000
  const H = vehicle.deck.heightMm / 1000
  const deckHeight = vehicle.geometry.deckHeightMm / 1000

  const root = new THREE.Group()
  const sprung = new THREE.Group()
  const unsprung = new THREE.Group()
  root.add(unsprung)
  root.add(sprung)

  // deck-local millimetres -> scene metres, body centred on the origin
  const toScene = (xMm) => xMm / 1000 - L / 2
  const axleScene = vehicle.axleGroups.map(a => ({
    id: a.id, tyres: a.tyres, x: toScene(a.xMm),
  }))

  const steer = axleScene.find(a => a.id === 'steer')
  const frontX = steer ? steer.x : -L / 2 - 1.2
  const rearMost = Math.max(...axleScene.map(a => a.x))

  // --- sprung mass: chassis, body, cab, cargo ---------------------------
  const articulated = vehicle.geometry.vehicleClass === 'articulated'
  sprung.add(buildChassis({
    L, W, deckHeight, frontX, rearX: rearMost, axleScene, articulated,
    kingpinX: articulated ? toScene(vehicle.geometry.kingpinXMm) : 0,
  }))

  const bodyGroup = buildBody({ L, W, H, showTarp, operator, sideOpacity })
  bodyGroup.position.y = deckHeight
  sprung.add(bodyGroup)

  const cab = buildCab({ width: W, deckHeight, regNo })
  cab.position.x = frontX - 0.15
  sprung.add(cab)

  // cargo rides with the sprung mass; its origin is the deck surface centre
  const cargoAnchor = new THREE.Group()
  cargoAnchor.position.y = deckHeight
  sprung.add(cargoAnchor)

  // --- unsprung mass: wheels and axle beams -----------------------------
  const wheels = []
  axleScene.forEach(ax => {
    const x = ax.x
    const dual = ax.tyres >= 4 && ax.id !== 'steer'
    const sets = ax.tyres >= 12 ? 3 : ax.tyres >= 8 ? 2 : 1

    for (let i = 0; i < sets; i += 1) {
      const dx = x + (i - (sets - 1) / 2) * 1.38
      ;[-1, 1].forEach(side => {
        const w = buildWheel({ radius: 0.47, width: 0.3, dual })
        w.position.set(dx, 0.47, side * (W / 2 - 0.16))
        w.userData = {
          axleId: ax.id, side, baseY: 0.47, spinner: w.userData.spinner, offsetM: ax.x,
        }
        unsprung.add(w)
        wheels.push(w)
      })

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.085, W - 0.3, 12),
        MAT.chassis,
      )
      beam.rotation.x = Math.PI / 2
      beam.position.set(dx, 0.47, 0)
      unsprung.add(beam)
    }
  })

  return {
    root, sprung, unsprung, cargoAnchor, wheels, deckHeight, L, W, H,
    tailLamps: bodyGroup.userData.tailLamps || [],
  }
}

/** Frees every geometry, material and texture the model created. */
export function disposeTruck(group) {
  group.traverse(o => {
    if (o.geometry) o.geometry.dispose()
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
    mats.forEach(m => {
      // the shared MAT palette is reused across builds, so only dispose
      // materials that carry a generated texture
      if (m.map) { m.map.dispose(); m.dispose() }
    })
  })
}
