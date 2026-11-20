// ============================================================================
// JBM LoadIQ — WEIGHT DISTRIBUTION & STABILITY MODEL
// ----------------------------------------------------------------------------
// Axle reactions are solved from the actual cargo placements by static moment
// balance. Nothing here is interpolated from a nominal "CoG percentage": the
// centre of gravity is an *output* of the load pattern, not an input.
//
// Rigid vehicle (two axle groups, steer + drive):
//     R_drive = Σ mᵢ·xᵢ / wheelbase          (moments about the steer axle)
//     R_steer = Σ mᵢ − R_drive
//
// Articulated vehicle (tractor + semi-trailer):
//     R_bogie   = Σ mᵢ·(xᵢ − x_kingpin) / (x_bogie − x_kingpin)
//     R_kingpin = Σ mᵢ − R_bogie
//     R_steer   = R_kingpin · a / wheelbase_tractor     (a = kingpin lead
//     R_drive   = R_kingpin − R_steer                    ahead of drive axle)
//
// Lateral stability uses the static rollover threshold (SRT), the lateral
// acceleration at which the inside wheels lift:
//     SRT ≈ (track/2 − |Δz_cog|) / h_cog     [g]
// ============================================================================

import { ENGINE_DEFAULTS } from './specs.js';

/**
 * @param {object} vehicle  resolved vehicle (see specs.resolveVehicle)
 * @param {Array}  placements  packer output, mm / kg, deck-local coordinates
 */
export function computeWeightDistribution(vehicle, placements) {
  const g = vehicle.geometry;
  const deck = vehicle.deck;

  let massKg = 0;
  let momentX = 0; // about the deck front face
  let momentZ = 0; // about the deck centreline
  let momentY = 0; // about the deck surface

  placements.forEach(p => {
    const m = p.grossKg;
    massKg += m;
    momentX += m * (p.x + p.l / 2);
    momentZ += m * (p.z + p.w / 2 - deck.widthMm / 2);
    momentY += m * (p.y + p.h / 2);
  });

  const cargoCogXMm = massKg > 0 ? momentX / massKg : 0;
  const cargoCogZMm = massKg > 0 ? momentZ / massKg : 0;
  const cargoCogYMm = massKg > 0 ? momentY / massKg : 0;
  const cargoCogHeightMm = g.deckHeightMm + cargoCogYMm;

  const groups = {};
  let grossVehicleKg;

  if (g.vehicleClass === 'articulated') {
    const kingpinX = g.kingpinXMm;
    const bogieX = vehicle.axleGroups.find(a => a.id === 'trailer').xMm;
    const lever = bogieX - kingpinX;

    // cargo split between kingpin and trailer bogie
    const cargoBogie = massKg > 0 ? (massKg * (cargoCogXMm - kingpinX)) / lever : 0;
    const cargoKingpin = massKg - cargoBogie;

    // trailer tare split
    const trailerTare = g.trailerTareKg;
    const tareKingpin = trailerTare * g.trailerTareKingpinShare;
    const tareBogie = trailerTare - tareKingpin;

    const kingpinTotal = cargoKingpin + tareKingpin;
    const steerFromKingpin = (kingpinTotal * g.kingpinAheadOfDriveMm) / g.tractorWheelbaseMm;
    const driveFromKingpin = kingpinTotal - steerFromKingpin;

    const tractorTareSteer = g.tractorTareKg * g.tractorTareSteerShare;
    const tractorTareDrive = g.tractorTareKg - tractorTareSteer;

    groups.steer = tractorTareSteer + steerFromKingpin;
    groups.drive = tractorTareDrive + driveFromKingpin;
    groups.trailer = tareBogie + cargoBogie;
    grossVehicleKg = g.tractorTareKg + trailerTare + massKg;
  } else {
    const wb = g.wheelbaseMm;
    const offset = g.deckFrontFromSteerMm; // deck front face, measured from steer axle
    const cargoDrive = massKg > 0 ? (massKg * (offset + cargoCogXMm)) / wb : 0;
    const cargoSteer = massKg - cargoDrive;

    const tareSteer = vehicle.tareKg * g.tareSteerShare;
    const tareDrive = vehicle.tareKg - tareSteer;

    groups.steer = tareSteer + cargoSteer;
    groups.drive = tareDrive + cargoDrive;
    grossVehicleKg = vehicle.tareKg + massKg;
  }

  const axles = vehicle.axleGroups.map(a => {
    const loadKg = groups[a.id] ?? 0;
    return {
      id: a.id,
      label: a.label,
      tyres: a.tyres,
      loadKg: Math.round(loadKg),
      limitKg: a.limitKg,
      statutoryKg: a.statutoryKg,
      plateKg: a.plateKg,
      governedBy: a.governedBy,
      utilPct: (loadKg / a.limitKg) * 100,
      overloadKg: Math.round(Math.max(0, loadKg - a.limitKg)),
      compliant: Math.round(loadKg) <= a.limitKg,
    };
  });

  // combined CoG height including the chassis mass
  const combinedCogHeightMm = grossVehicleKg > 0
    ? (massKg * cargoCogHeightMm + vehicle.tareKg * g.chassisCogHeightMm) / grossVehicleKg
    : g.chassisCogHeightMm;

  const halfTrack = g.trackWidthMm / 2;
  const rolloverThresholdG = combinedCogHeightMm > 0
    ? (halfTrack - Math.abs(cargoCogZMm) * (massKg / Math.max(grossVehicleKg, 1))) / combinedCogHeightMm
    : 99;

  const cogFraction = cargoCogXMm / deck.lengthMm;
  const [winLo, winHi] = ENGINE_DEFAULTS.cogWindow;
  const maxLateralMm = halfTrack * ENGINE_DEFAULTS.maxLateralOffsetFraction * 2;

  const totalOverloadKg = axles.reduce((s, a) => s + a.overloadKg, 0);
  const gvwOverloadKg = Math.max(0, grossVehicleKg - vehicle.gvwKg);

  return {
    cargoMassKg: Math.round(massKg),
    grossVehicleKg: Math.round(grossVehicleKg),
    gvwLimitKg: vehicle.gvwKg,
    gvwUtilPct: (grossVehicleKg / vehicle.gvwKg) * 100,
    gvwOverloadKg: Math.round(gvwOverloadKg),
    axles,
    totalOverloadKg: Math.round(totalOverloadKg),
    axleCompliant: totalOverloadKg === 0 && gvwOverloadKg === 0,

    cogXMm: Math.round(cargoCogXMm),
    cogFractionPct: cogFraction * 100,
    cogWindowPct: [winLo * 100, winHi * 100],
    cogInWindow: cogFraction >= winLo && cogFraction <= winHi,

    cogLateralMm: Math.round(cargoCogZMm),
    cogLateralLimitMm: Math.round(maxLateralMm),
    lateralBalanced: Math.abs(cargoCogZMm) <= maxLateralMm,

    cargoCogHeightMm: Math.round(cargoCogHeightMm),
    combinedCogHeightMm: Math.round(combinedCogHeightMm),
    trackWidthMm: g.trackWidthMm,
    rolloverThresholdG: Number(rolloverThresholdG.toFixed(3)),
    rolloverSafe: rolloverThresholdG >= ENGINE_DEFAULTS.minRolloverThresholdG,
    rolloverMinG: ENGINE_DEFAULTS.minRolloverThresholdG,

    // left / right split, the check that catches a load that will pull on camber
    sideSplit: sideLoadSplit(placements, deck.widthMm),
  };
}

function sideLoadSplit(placements, deckWidthMm) {
  const mid = deckWidthMm / 2;
  let left = 0;
  let right = 0;
  placements.forEach(p => {
    // split each unit's mass by how much of its footprint falls either side
    const leftSpan = Math.max(0, Math.min(p.z + p.w, mid) - p.z);
    const leftShare = Math.max(0, Math.min(1, leftSpan / Math.max(p.w, 1)));
    left += p.grossKg * leftShare;
    right += p.grossKg * (1 - leftShare);
  });
  const total = left + right;
  return {
    leftKg: Math.round(left),
    rightKg: Math.round(right),
    leftPct: total ? (left / total) * 100 : 50,
    rightPct: total ? (right / total) * 100 : 50,
    imbalancePct: total ? (Math.abs(left - right) / total) * 100 : 0,
  };
}

/**
 * Longitudinal shift required on a single handling unit to pull an overloaded
 * axle group back inside its limit. Gives the planner an actionable number
 * instead of "rebalance the load".
 */
export function suggestAxleCorrection(vehicle, distribution, placements) {
  const g = vehicle.geometry;
  const offending = distribution.axles.find(a => !a.compliant);
  if (!offending) return null;

  const lever = g.vehicleClass === 'articulated'
    ? vehicle.axleGroups.find(a => a.id === 'trailer').xMm - g.kingpinXMm
    : g.wheelbaseMm;

  // dM = overload * lever  -> required longitudinal moment change
  const requiredMomentKgMm = offending.overloadKg * lever;
  const towardFront = offending.id !== 'steer';

  // find the heaviest unit that can physically move far enough
  const candidates = [...placements]
    .filter(p => p.tier === 1)
    .sort((a, b) => b.grossKg - a.grossKg)
    .slice(0, 6)
    .map(p => ({
      huId: p.huId,
      partNo: p.partNo,
      grossKg: Math.round(p.grossKg),
      currentXMm: Math.round(p.x),
      shiftMm: Math.round(requiredMomentKgMm / Math.max(p.grossKg, 1)) * (towardFront ? -1 : 1),
    }))
    .filter(c => Math.abs(c.shiftMm) < vehicle.deck.lengthMm);

  return {
    axleId: offending.id,
    axleLabel: offending.label,
    overloadKg: offending.overloadKg,
    direction: towardFront ? 'forward (toward the bulkhead)' : 'rearward (toward the doors)',
    requiredMomentKgM: Math.round(requiredMomentKgMm / 1000),
    candidates,
  };
}

// ----------------------------------------------------------------------------
// AXLE INFLUENCE COEFFICIENTS
// ----------------------------------------------------------------------------
/**
 * The influence line of each axle group: how much of one kilogram placed at
 * longitudinal position `xMm` (deck-local) lands on each axle group.
 *
 * Because the reaction is linear in mass, these coefficients are exact — the
 * same numbers that `computeWeightDistribution` produces in aggregate. Two
 * things fall out of them that a planner can act on directly:
 *
 *   • The coefficient tells you the real cost of a bay. On a long rear
 *     overhang the drive coefficient exceeds 1.0, which means mass loaded
 *     behind the bogie *lifts* the steer axle rather than merely loading the
 *     drive. That is the mechanism behind light-steering complaints and it is
 *     visible nowhere in a cube-utilisation number.
 *
 *   • They make uncertainty analysis cheap: perturbing declared masses only
 *     requires a dot product, not a re-solve.
 */
export function axleInfluence(vehicle, xMm) {
  const g = vehicle.geometry;
  if (g.vehicleClass === 'articulated') {
    const kp = g.kingpinXMm;
    const bogieX = vehicle.axleGroups.find(a => a.id === 'trailer').xMm;
    const cTrailer = (xMm - kp) / (bogieX - kp);
    const cKingpin = 1 - cTrailer;
    const cSteer = cKingpin * (g.kingpinAheadOfDriveMm / g.tractorWheelbaseMm);
    return { steer: cSteer, drive: cKingpin - cSteer, trailer: cTrailer };
  }
  const cDrive = (g.deckFrontFromSteerMm + xMm) / g.wheelbaseMm;
  return { steer: 1 - cDrive, drive: cDrive };
}

/** Constant (cargo-independent) axle loads from the chassis tare. */
export function tareAxleLoads(vehicle) {
  const g = vehicle.geometry;
  if (g.vehicleClass === 'articulated') {
    const tareKingpin = g.trailerTareKg * g.trailerTareKingpinShare;
    const steerFromKp = (tareKingpin * g.kingpinAheadOfDriveMm) / g.tractorWheelbaseMm;
    const tractorSteer = g.tractorTareKg * g.tractorTareSteerShare;
    return {
      steer: tractorSteer + steerFromKp,
      drive: (g.tractorTareKg - tractorSteer) + (tareKingpin - steerFromKp),
      trailer: g.trailerTareKg - tareKingpin,
    };
  }
  const tareSteer = vehicle.tareKg * g.tareSteerShare;
  return { steer: tareSteer, drive: vehicle.tareKg - tareSteer };
}

/**
 * Samples each axle influence line across the deck. Feeds the influence-line
 * chart, which is the single most useful diagnostic in load planning: it tells
 * the planner the marginal axle cost of every bay before anything is moved.
 */
export function influenceLines(vehicle, samples = 60) {
  const L = vehicle.deck.lengthMm;
  const ids = vehicle.axleGroups.map(a => a.id);
  const points = [];
  for (let i = 0; i <= samples; i += 1) {
    const x = (L * i) / samples;
    points.push({ xMm: x, ...axleInfluence(vehicle, x) });
  }
  // the x at which the steer coefficient crosses zero: beyond this point,
  // added mass unloads the steer axle
  let steerZeroXMm = null;
  for (let i = 1; i < points.length; i += 1) {
    if (points[i - 1].steer > 0 && points[i].steer <= 0) {
      const t = points[i - 1].steer / (points[i - 1].steer - points[i].steer);
      steerZeroXMm = Math.round(points[i - 1].xMm + t * (points[i].xMm - points[i - 1].xMm));
      break;
    }
  }
  return { ids, points, steerZeroXMm };
}
