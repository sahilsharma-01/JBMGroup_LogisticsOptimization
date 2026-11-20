import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// ============================================================================
// REALISTIC INDIAN TRUCK 3D MODEL LOADER & ADAPTER
// ----------------------------------------------------------------------------
// Loads the authentic Indian Heavy Commercial Vehicle model without any
// stretching or distortion (100% UNIFORM scale in X, Y, Z).
//
// Exclusively active for the matching Indian Multi-Axle Rigid Truck:
// 'TATA-ULTRA-24' (Tata Ultra 28ft Container).
// Other vehicles in the fleet (Volvo 40ft Semi-Trailer, Eicher 14ft/19ft, etc.)
// use their respective engineering CAD twins with correct kingpin/axle geometry.
// ============================================================================

export const REALISTIC_TRUCK_VEHICLE_ID = 'TATA-ULTRA-24'

export function isRealisticTruckSupported(vehicleId) {
  return vehicleId === REALISTIC_TRUCK_VEHICLE_ID
}

let cachedGltf = null
let loadPromise = null

/**
 * Loads and caches the GLTF model from /models/indian_truck.glb.
 */
export function loadRealisticTruckModel(onProgress) {
  if (cachedGltf) return Promise.resolve(cachedGltf)
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.load(
      '/models/indian_truck.glb',
      (gltf) => {
        cachedGltf = gltf
        resolve(gltf)
      },
      (xhr) => {
        if (onProgress && xhr.total) {
          onProgress(xhr.loaded / xhr.total)
        }
      },
      (err) => {
        console.error('Failed to load realistic truck model:', err)
        loadPromise = null
        reject(err)
      }
    )
  })

  return loadPromise
}

// Meshes corresponding to the cargo bed side walls, slats, tarpaulin/canopy
const CARGO_BODY_MESH_NAMES = new Set([
  'Object_4',
  'Object_5',
  'Object_6',
  'Object_7',
  'Object_8',
  'Object_12',
  'Object_13',
  'Object_14',
])

// Soft contact shadow texture generated procedurally on a canvas
let cachedShadowTexture = null
function getContactShadowTexture() {
  if (cachedShadowTexture) return cachedShadowTexture
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')

  // Smooth radial gradient from dark center to soft falloff
  const gradient = ctx.createRadialGradient(256, 256, 40, 256, 256, 240)
  gradient.addColorStop(0, 'rgba(12, 18, 28, 0.78)')
  gradient.addColorStop(0.35, 'rgba(15, 23, 35, 0.45)')
  gradient.addColorStop(0.7, 'rgba(20, 28, 42, 0.15)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 512)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  cachedShadowTexture = texture
  return texture
}

/**
 * Builds an aligned instance of the realistic Indian Truck model
 * with 100% UNIFORM PROPORTIONS (no stretching) and hyper-realistic PBR materials.
 *
 * @param {Object} gltf - Loaded GLTF asset
 * @param {Object} vehicle - Vehicle object (Tata Ultra 28ft)
 * @param {Object} opts - Display options: { bodyOpacity = 0.22, showWalls = true }
 * @returns {THREE.Group} Root group positioned in scene coordinates
 */
export function buildRealisticTruckInstance(gltf, vehicle, opts = {}) {
  const { bodyOpacity = 0.22, showWalls = true } = opts

  const L = (vehicle?.deck?.lengthMm || 8500) / 1000

  // Clone scene hierarchy
  const truckScene = gltf.scene.clone(true)

  // Align orientation:
  // Node 0 already rotated raw Z to Y (up). A -90 deg rotation around Y
  // directs the cab toward -X (front) and tailgate toward +X (rear).
  const alignGroup = new THREE.Group()
  alignGroup.rotation.y = -Math.PI / 2
  alignGroup.add(truckScene)

  // STRICT UNIFORM SCALE:
  // Preserve 100% of the authentic manufacturer proportions.
  // Model raw deck surface = 6.38 units above wheels.
  // Real Indian HCV deck height = 1.25m -> uniform scale = 1.25 / 6.38 = ~0.196
  const UNIFORM_SCALE = 0.196
  alignGroup.scale.set(UNIFORM_SCALE, UNIFORM_SCALE, UNIFORM_SCALE)

  // Precise positioning:
  // 1. Bulkhead (front wall of cargo bed) in aligned coords is at Y_raw = -15.8.
  //    Align the front wall of the 3D model cargo bed exactly with -L/2 (bulkhead of load solver).
  const bulkheadOffset = -L / 2 - (-15.8 * UNIFORM_SCALE)

  // 2. Wheel bottom in aligned coords is at Z_raw = 0.72.
  //    Offset by -0.72 * UNIFORM_SCALE so tyres contact the ground at Y = 0.
  const groundOffset = -0.72 * UNIFORM_SCALE

  alignGroup.position.set(bulkheadOffset, groundOffset, 0)

  // PBR Material enhancement for hyper-realism
  truckScene.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true

      if (child.material) {
        // Deep clone material so instances are completely isolated
        child.material = Array.isArray(child.material)
          ? child.material.map(m => m.clone())
          : child.material.clone()

        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach((m) => {
          // Boost environment reflections & surface luminosity
          m.envMapIntensity = 1.45

          // Anisotropic texture filtering for crisp decals and livery at all angles
          ;['map', 'normalMap', 'roughnessMap', 'metalnessMap'].forEach((mapProp) => {
            if (m[mapProp]) {
              m[mapProp].anisotropy = 16
              if (mapProp === 'map') {
                m[mapProp].colorSpace = THREE.SRGBColorSpace
              }
            }
          })

          // Chrome / metallic front trim, grille, mirrors, and steel bumper
          const isChromeOrMetal = (
            m.name.includes('11') ||
            m.name.includes('9') ||
            m.name.includes('17') ||
            m.name.includes('4') ||
            m.name.includes('18')
          )
          if (isChromeOrMetal) {
            m.metalness = Math.max(m.metalness || 0, 0.88)
            m.roughness = Math.min(m.roughness || 1, 0.18)
          }

          // Cab windshield / windows
          if (m.name.includes('8')) {
            m.roughness = 0.08
            m.metalness = 0.25
          }

          // Tyres / heavy tread rubber
          if (m.name.includes('2') || m.name.includes('3')) {
            m.metalness = 0.04
            m.roughness = 0.82
          }
        })

        // Cargo body panels transparency control
        const isBodyMesh = CARGO_BODY_MESH_NAMES.has(child.name)
        if (isBodyMesh) {
          if (!showWalls) {
            child.visible = false
          } else {
            child.visible = true
            mats.forEach((m) => {
              if (bodyOpacity < 0.95) {
                m.transparent = true
                m.opacity = Math.max(0.06, bodyOpacity)
                m.depthWrite = bodyOpacity > 0.65
                m.roughness = 0.5
              } else {
                m.transparent = false
                m.opacity = 1.0
                m.depthWrite = true
              }
            })
          }
        }
      }
    }
  })

  const root = new THREE.Group()
  root.name = 'RealisticIndianTruck'
  root.add(alignGroup)

  // Hyper-real ambient contact shadow underneath the chassis and 10 wheels
  const shadowGeo = new THREE.PlaneGeometry(9.6, 3.2)
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  })
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat)
  shadowMesh.rotation.x = -Math.PI / 2
  // Position shadow under the vehicle body
  shadowMesh.position.set(bulkheadOffset + 2.75 * UNIFORM_SCALE, 0.003, 0)
  root.add(shadowMesh)

  return root
}
