// ============================================================================
// JBM LoadIQ — VOLUMETRIC LOADING ENGINE : REFERENCE SPECIFICATIONS
// ----------------------------------------------------------------------------
// All linear dimensions in millimetres (mm), mass in kilograms (kg).
//
// Coordinate datum used throughout the engine (right-handed, deck-local):
//   x : 0 at the inner face of the front bulkhead  -> +x toward the rear doors
//   y : 0 at the load deck surface                 -> +y upward
//   z : 0 at the left (driver) side inner wall     -> +z toward the kerb side
//
// A placement is always stored as its minimum corner (x, y, z) plus the
// as-loaded footprint (l along x, w along z, h along y). This makes collision,
// support and moment maths trivial and auditable.
// ============================================================================

export const GRAVITY = 9.81;

// ----------------------------------------------------------------------------
// STATUTORY AXLE LOAD LIMITS
// Reference: MoRTH notification S.O. 2641(E) dated 16-Jul-2018 amending the
// gross vehicle weight / axle weight schedule under the Motor Vehicles Act.
// Values are the *regulatory ceiling* per axle group. The vehicle's own OEM
// rating is applied as a second, usually lower, cap -- the engine always uses
// min(statutory, OEM plate rating).
// ----------------------------------------------------------------------------
export const STATUTORY_AXLE_LIMITS_KG = {
  SINGLE_2_TYRE: 7500,   // single axle, 2 tyres (typical steer axle)
  SINGLE_4_TYRE: 11500,  // single axle, 4 tyres
  TANDEM_8_TYRE: 19000,  // tandem (bogie) axle group, 8 tyres
  TRIDEM_12_TYRE: 24000, // tridem axle group, 12 tyres
};

// ----------------------------------------------------------------------------
// LOAD SECURING CONSTANTS
// Reference: EN 12195-1:2010 (calculation of securing forces for road transport)
// Acceleration coefficients are the standard road-transport values.
// ----------------------------------------------------------------------------
export const SECURING = {
  cForward: 0.8,       // forward acceleration coefficient (braking)
  cRearward: 0.5,      // rearward
  cLateral: 0.5,       // sideways (cornering)
  cVerticalMin: 0.0,   // not used for road (rail/sea only)
  lashingAngleDeg: 75, // typical top-over lashing angle to the deck
  stfDaN: 500,         // standard tension force of a ratchet lashing (daN)
  lcDaN: 2000,         // lashing capacity of a 50 mm polyester web (daN)
  // Rated strength of body structure as a fraction of payload.
  // Reference: EN 12642 Code L (standard body) vs Code XL (reinforced).
  bodyStrength: {
    L: { frontWall: 0.4, rearWall: 0.25, sideWall: 0.3 },
    XL: { frontWall: 0.5, rearWall: 0.3, sideWall: 0.4 },
  },
};

// Dynamic coefficients of friction, packaging base material against deck.
// Reference: EN 12195-1:2010 Annex B (indicative values, dry & swept surfaces).
export const FRICTION_MU = {
  'steel/plywood': 0.45,
  'steel/steel': 0.25,
  'plastic/plywood': 0.3,
  'plastic/plastic': 0.25,
  'timber/plywood': 0.45,
  'rubber/plywood': 0.55,
  'wheeled': 0.0, // castors -- friction cannot be claimed, must be chocked
};

// ----------------------------------------------------------------------------
// VEHICLE CHASSIS GEOMETRY
// Keyed by the vehicleTypes[].id in seedData. Supplies the chassis geometry the
// axle model needs and which a simple length/width/height spec cannot provide.
//
//   deckFrontFromSteerMm : longitudinal distance from the steer-axle centreline
//                          back to the deck front face (x = 0). Always positive
//                          for a bonneted/cab-over rigid.
//   axleGroups[].xMm     : group centreline position in the deck-local x frame
//                          (negative = ahead of the deck front face).
// ----------------------------------------------------------------------------
export const vehicleGeometry = {
  'EICHER-PRO-2049': {
    vehicleClass: 'rigid',
    bodyCode: 'L',
    deckFrontFromSteerMm: 700,
    wheelbaseMm: 3400,
    axleGroups: [
      { id: 'steer', label: 'Front Steer Axle', xMm: -700, tyres: 2, statutory: 'SINGLE_2_TYRE', plateKg: 2000 },
      { id: 'drive', label: 'Rear Drive Axle', xMm: 2700, tyres: 4, statutory: 'SINGLE_4_TYRE', plateKg: 3600 },
    ],
    tareSteerShare: 0.52,
    deckHeightMm: 1000,
    trackWidthMm: 1620,
    maxLoadHeightMm: 1900,
    chassisCogHeightMm: 700,
    deckMaterial: 'plywood',
    rearOverhangMm: 1560,
    costPerKmInr: 32,
    kmplLaden: 8.2,
  },
  'EICHER-PRO-3019': {
    vehicleClass: 'rigid',
    bodyCode: 'L',
    deckFrontFromSteerMm: 850,
    wheelbaseMm: 4800,
    axleGroups: [
      { id: 'steer', label: 'Front Steer Axle', xMm: -850, tyres: 2, statutory: 'SINGLE_2_TYRE', plateKg: 4200 },
      { id: 'drive', label: 'Rear Drive Axle', xMm: 3950, tyres: 4, statutory: 'SINGLE_4_TYRE', plateKg: 8200 },
    ],
    tareSteerShare: 0.5,
    deckHeightMm: 1150,
    trackWidthMm: 1860,
    maxLoadHeightMm: 2200,
    chassisCogHeightMm: 800,
    deckMaterial: 'plywood',
    rearOverhangMm: 1850,
    costPerKmInr: 44,
    kmplLaden: 5.6,
  },
  'TATA-ULTRA-24': {
    vehicleClass: 'rigid',
    bodyCode: 'L',
    deckFrontFromSteerMm: 1050,
    wheelbaseMm: 6500,
    axleGroups: [
      { id: 'steer', label: 'Front Steer Axle', xMm: -1050, tyres: 2, statutory: 'SINGLE_2_TYRE', plateKg: 6500 },
      { id: 'drive', label: 'Rear Tandem Bogie', xMm: 5450, tyres: 8, statutory: 'TANDEM_8_TYRE', plateKg: 13000 },
    ],
    tareSteerShare: 0.48,
    deckHeightMm: 1250,
    trackWidthMm: 1950,
    maxLoadHeightMm: 2500,
    chassisCogHeightMm: 850,
    deckMaterial: 'plywood',
    rearOverhangMm: 3050,
    costPerKmInr: 58,
    kmplLaden: 4.4,
  },
  'BHARATBENZ-32FT': {
    vehicleClass: 'rigid',
    bodyCode: 'XL',
    deckFrontFromSteerMm: 1350,
    wheelbaseMm: 7400,
    axleGroups: [
      { id: 'steer', label: 'Front Steer Axle', xMm: -1350, tyres: 2, statutory: 'SINGLE_2_TYRE', plateKg: 7500 },
      { id: 'drive', label: 'Rear Tandem Bogie', xMm: 6050, tyres: 8, statutory: 'TANDEM_8_TYRE', plateKg: 19000 },
    ],
    tareSteerShare: 0.44,
    deckHeightMm: 1300,
    trackWidthMm: 2040,
    maxLoadHeightMm: 2750,
    chassisCogHeightMm: 900,
    deckMaterial: 'plywood',
    rearOverhangMm: 3700,
    costPerKmInr: 71,
    kmplLaden: 3.6,
  },
  'VOLVO-40FT-TRAILER': {
    vehicleClass: 'articulated',
    bodyCode: 'XL',
    // Trailer-local geometry (x = 0 at trailer deck front face)
    kingpinXMm: 1700,
    tractorWheelbaseMm: 3800,
    kingpinAheadOfDriveMm: 400,
    axleGroups: [
      { id: 'steer', label: 'Tractor Steer Axle', xMm: null, tyres: 2, statutory: 'SINGLE_2_TYRE', plateKg: 7500 },
      { id: 'drive', label: 'Tractor Drive Tandem', xMm: null, tyres: 8, statutory: 'TANDEM_8_TYRE', plateKg: 19000 },
      { id: 'trailer', label: 'Trailer Tridem Bogie', xMm: 10300, tyres: 12, statutory: 'TRIDEM_12_TYRE', plateKg: 24000 },
    ],
    tractorTareKg: 8200,
    tractorTareSteerShare: 0.62,
    trailerTareKg: 7000,
    trailerTareKingpinShare: 0.35,
    deckHeightMm: 1400,
    trackWidthMm: 2040,
    maxLoadHeightMm: 2800,
    chassisCogHeightMm: 950,
    deckMaterial: 'plywood',
    rearOverhangMm: 1900,
    costPerKmInr: 86,
    kmplLaden: 3.1,
  },
};

// ----------------------------------------------------------------------------
// RETURNABLE PACKAGING / HANDLING-UNIT SPECIFICATIONS
// Keyed by the containerType string used in seedData. These are the properties
// that actually drive a load plan and that a bare L x W x H cannot express.
// ----------------------------------------------------------------------------
export const packagingSpecs = {
  'Steel Stillage (ST-1200)': {
    code: 'ST-1200',
    baseMaterial: 'steel',
    contactPoints: 4,
    contactAreaCm2: 110,   // 4 welded corner feet, ~105 x 105 mm pads
    rotatableYaw: true,          // may be turned 90 degrees on the deck
    topLoadCapacityKg: 1500,     // rated superimposed load on the top frame
    canSupportOtherTypes: true,  // flat welded top frame -- safe stacking base
    wheeled: false,
    clearanceMm: 25,             // working gap required around the unit
    forkAccess: ['long', 'short'],
    handlingSeconds: 85,         // forklift cycle time per unit at the dock
    tippingSafe: true,
    esd: false,
  },
  'Panel Trolley (TR-1800)': {
    code: 'TR-1800',
    baseMaterial: 'wheeled',
    contactPoints: 4,
    contactAreaCm2: 28,    // 4 castors, small contact patch
    rotatableYaw: false,         // must stay inline for roll-on / roll-off
    topLoadCapacityKg: 0,        // Class-A surfaces -- nothing on top, ever
    canSupportOtherTypes: false,
    wheeled: true,               // castors: requires chocking + direct lashing
    clearanceMm: 60,             // Class-A surface protection envelope
    forkAccess: [],              // pushed, not forked
    handlingSeconds: 130,
    tippingSafe: false,
    esd: false,
  },
  'Foldable Plastic FLC (FLC-1140)': {
    code: 'FLC-1140',
    baseMaterial: 'plastic',
    contactPoints: 9,
    contactAreaCm2: 95,    // moulded skid pattern
    rotatableYaw: true,
    topLoadCapacityKg: 800,
    canSupportOtherTypes: true,
    wheeled: false,
    clearanceMm: 25,
    forkAccess: ['long', 'short'],
    handlingSeconds: 70,
    tippingSafe: true,
    esd: false,
    foldedHeightMm: 320,
  },
  'ESD Anti-Static Crate (EV-CRATE)': {
    code: 'EV-CRATE',
    baseMaterial: 'plastic',
    contactPoints: 4,
    contactAreaCm2: 160,   // full-perimeter moulded base rails
    rotatableYaw: false,         // sealed clean-room orientation marked
    topLoadCapacityKg: 0,        // HV battery trays -- no superimposed load
    canSupportOtherTypes: false,
    wheeled: false,
    clearanceMm: 40,
    forkAccess: ['long'],
    handlingSeconds: 150,
    tippingSafe: true,
    esd: true,
  },
  'Euro KLT Stacking Bins (KLT-4314)': {
    code: 'KLT-4314',
    baseMaterial: 'plastic',
    contactPoints: 1,
    contactAreaCm2: 2400,  // full flat base
    rotatableYaw: true,
    topLoadCapacityKg: 60,
    canSupportOtherTypes: false,
    wheeled: false,
    clearanceMm: 10,
    forkAccess: ['long', 'short'],
    handlingSeconds: 25,
    tippingSafe: true,
    esd: false,
  },
  'Folded Steel Stillage': {
    code: 'ST-1200-F',
    baseMaterial: 'steel',
    contactPoints: 4,
    contactAreaCm2: 110,
    rotatableYaw: true,
    topLoadCapacityKg: 900,
    canSupportOtherTypes: true,
    wheeled: false,
    clearanceMm: 20,
    forkAccess: ['long', 'short'],
    handlingSeconds: 45,
    tippingSafe: true,
    esd: false,
    isReturnAsset: true,
  },
};

export const DEFAULT_PACKAGING_SPEC = {
  code: 'GEN',
  baseMaterial: 'steel',
  contactPoints: 4,
  contactAreaCm2: 110,
  rotatableYaw: true,
  topLoadCapacityKg: 500,
  canSupportOtherTypes: true,
  wheeled: false,
  clearanceMm: 25,
  forkAccess: ['long', 'short'],
  handlingSeconds: 90,
  tippingSafe: true,
  esd: false,
};

// ----------------------------------------------------------------------------
// ENGINE DEFAULTS
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// DECK STRUCTURAL RATINGS
// A load can satisfy every axle limit and still punch through the floor. Steel
// stillages bear on four feet, so the pressure at the foot is what matters, not
// the nominal footprint pressure. Ratings below are for a hardwood/ply deck on
// steel cross-members, which is what Indian box bodies use.
// ----------------------------------------------------------------------------
export const DECK_RATINGS = {
  distributedKgPerM2: 1800,   // uniformly distributed load over the deck
  pointLoadKgPerContact: 1400, // single forklift wheel / stillage foot
  forkliftAxleKg: 4600,       // counterbalance truck driving onto the deck
};

// Declared-mass uncertainty by part family, as a coefficient of variation.
// Sources of spread: coil thickness tolerance, weld wire deposition, residual
// pressing oil, and returnable packaging that accumulates dirt and moisture.
export const MASS_VARIANCE_CV = {
  'Class-A Sheet Metal Skin Panel': 0.012,
  'Structural Underbody Stamping': 0.015,
  'Stamped Small Brackets': 0.02,
  'Chassis & Subframe': 0.022,
  'Suspension Welded Assembly': 0.022,
  'Heavy Chassis Tubular Assembly': 0.024,
  'Cockpit Tubular Welded Assembly': 0.02,
  'Exhaust & Emission Systems': 0.028,
  'EV Battery Casings': 0.01,
  'Door BIW Module': 0.018,
  'Reverse Logistics Asset': 0.035, // empty packaging: dirt, water, damage
  default: 0.025,
};

export const ENGINE_DEFAULTS = {
  // A unit placed above deck level must have at least this fraction of its
  // base footprint resting on the top faces below it.
  minSupportRatio: 0.78,
  // Longitudinal CoG target, expressed as a fraction of the deck length from
  // the bulkhead. Slightly forward of mid-deck keeps the steer axle loaded and
  // the drive bogie inside its plate rating on Indian rigid bodies.
  cogTargetFraction: 0.46,
  cogWindow: [0.38, 0.54],
  // Lateral CoG must stay inside this fraction of the half-width.
  maxLateralOffsetFraction: 0.06,
  // Minimum static rollover threshold in g for laden highway running.
  minRolloverThresholdG: 0.35,
  // Grid snap used by the 2D placer (mm). Keeps patterns dock-readable.
  gridMm: 10,
  // Economics
  dieselInrPerLitre: 94.8,
  co2KgPerLitreDiesel: 2.68,
  driverCostPerTripInr: 1150,
  tollInrPerKm: 2.6,
  workingDaysPerYear: 300,
};

export function resolveVehicle(vehicleType) {
  if (!vehicleType) return null;
  const base = vehicleGeometry[vehicleType.id];
  if (!base) return null;

  const o = vehicleType.__overrides || {};
  const num = (v, fallback) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? fallback : Number(v));
  const geometry = {
    ...base,
    wheelbaseMm: num(o.wheelbaseMm, base.wheelbaseMm),
    deckFrontFromSteerMm: num(o.deckFrontFromSteerMm, base.deckFrontFromSteerMm),
    deckHeightMm: num(o.deckHeightMm, base.deckHeightMm),
    trackWidthMm: num(o.trackWidthMm, base.trackWidthMm),
    maxLoadHeightMm: num(o.heightMm, base.maxLoadHeightMm),
    tareSteerShare: num(o.tareSteerShare, base.tareSteerShare),
    axleGroups: base.axleGroups.map(gr => ({
      ...gr,
      plateKg: num(o[`axle_${gr.id}_Kg`], gr.plateKg),
      xMm: gr.id === 'drive' && base.vehicleClass === 'rigid'
        ? num(o.wheelbaseMm, base.wheelbaseMm) - num(o.deckFrontFromSteerMm, base.deckFrontFromSteerMm)
        : gr.id === 'steer' && base.vehicleClass === 'rigid'
          ? -num(o.deckFrontFromSteerMm, base.deckFrontFromSteerMm)
          : gr.xMm,
    })),
  };

  const payloadKg = vehicleType.maxWeight || vehicleType.payloadKg;
  const gvwKg = vehicleType.gvwKg;
  const deck = {
    lengthMm: vehicleType.dimensions.lengthMm,
    widthMm: vehicleType.dimensions.widthMm,
    heightMm: Math.min(vehicleType.dimensions.heightMm, geometry.maxLoadHeightMm),
  };

  // Effective axle ceiling = min(statutory limit, OEM plate rating).
  // Tractor axle positions on an articulated unit are derived from the kingpin
  // so that every group has a concrete deck-local x for the blueprint views.
  const driveX = geometry.vehicleClass === 'articulated'
    ? geometry.kingpinXMm - geometry.kingpinAheadOfDriveMm
    : null;
  const axleGroups = geometry.axleGroups.map(g => {
    let xMm = g.xMm;
    if (xMm === null && geometry.vehicleClass === 'articulated') {
      xMm = g.id === 'drive' ? driveX : driveX - geometry.tractorWheelbaseMm;
    }
    return {
      ...g,
      xMm,
      statutoryKg: STATUTORY_AXLE_LIMITS_KG[g.statutory],
      limitKg: Math.min(STATUTORY_AXLE_LIMITS_KG[g.statutory], g.plateKg),
      governedBy: STATUTORY_AXLE_LIMITS_KG[g.statutory] <= g.plateKg ? 'CMVR statutory' : 'OEM plate rating',
    };
  });

  const tareKg = geometry.vehicleClass === 'articulated'
    ? geometry.tractorTareKg + geometry.trailerTareKg
    : Math.max(gvwKg - payloadKg, 0);

  return {
    id: vehicleType.id,
    name: vehicleType.name,
    category: vehicleType.category,
    icon: vehicleType.icon,
    typicalUsage: vehicleType.typicalUsage,
    axleConfig: vehicleType.axleConfig,
    payloadKg,
    gvwKg,
    tareKg,
    deck,
    deckVolumeM3: (deck.lengthMm * deck.widthMm * deck.heightMm) / 1e9,
    deckAreaM2: (deck.lengthMm * deck.widthMm) / 1e6,
    geometry,
    axleGroups,
    bodyStrength: SECURING.bodyStrength[geometry.bodyCode],
    deckRatings: {
      ...DECK_RATINGS,
      // a reinforced (Code XL) body carries a stronger floor structure
      distributedKgPerM2: Math.round(DECK_RATINGS.distributedKgPerM2 * (geometry.bodyCode === 'XL' ? 1.25 : 1)),
      pointLoadKgPerContact: Math.round(DECK_RATINGS.pointLoadKgPerContact * (geometry.bodyCode === 'XL' ? 1.25 : 1)),
    },
    isCustomised: Boolean(vehicleType.__overrides),
  };
}

/**
 * Applies planner overrides to a catalogue vehicle. Any field the user types in
 * the vehicle panel wins over the catalogue, so a real measured deck or a real
 * weighbridge tare can be used instead of the nominal specification.
 */
export function withVehicleOverrides(vehicleType, overrides = {}) {
  if (!vehicleType) return vehicleType;
  const o = overrides[vehicleType.id];
  if (!o) return vehicleType;
  const num = (v, fallback) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? fallback : Number(v));
  return {
    ...vehicleType,
    maxWeight: num(o.payloadKg, vehicleType.maxWeight),
    payloadKg: num(o.payloadKg, vehicleType.payloadKg),
    gvwKg: num(o.gvwKg, vehicleType.gvwKg),
    dimensions: {
      lengthMm: num(o.lengthMm, vehicleType.dimensions.lengthMm),
      widthMm: num(o.widthMm, vehicleType.dimensions.widthMm),
      heightMm: num(o.heightMm, vehicleType.dimensions.heightMm),
    },
    __overrides: o,
  };
}

export function getPackagingSpec(containerType) {
  return packagingSpecs[containerType] || DEFAULT_PACKAGING_SPEC;
}

export function frictionFor(baseMaterial, deckMaterial = 'plywood') {
  if (baseMaterial === 'wheeled') return FRICTION_MU.wheeled;
  return FRICTION_MU[`${baseMaterial}/${deckMaterial}`] ?? 0.3;
}
