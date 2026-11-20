// ============================================================================
// JBM LoadIQ — RIDE DYNAMICS
// ----------------------------------------------------------------------------
// A static load plan can satisfy every axle limit at the weighbridge and still
// shed its cargo on the first roundabout. This module evaluates the load plan
// under the accelerations the vehicle actually sees on an Indian route:
// cornering, grade, braking, and the vertical impulse of a speed breaker.
//
// MODEL
// Quasi-static rigid-body load transfer. For a vehicle of gross mass m with
// combined centre of gravity height h, wheelbase WB and track width t:
//
//   LATERAL (cornering)
//     a_y = v²/R                                   lateral acceleration
//     a_y,eff = v²/(R·g) − e                       e = superelevation (bank)
//     ΔN_lat = m · a_y,eff · g · h / t             load moved across the track
//     inner wheel lift when  a_y,eff ≥ t / (2h)    the static rollover threshold
//
//   LONGITUDINAL (grade θ and braking b, both in g)
//     N_total = m·g·cosθ
//     ΔN = m·g·(b·h/WB)  forward on braking
//        = m·g·(sinθ·h/WB)  rearward on a climb
//
//   VERTICAL (speed breaker)
//     Two effects have to be included or the answer comes out several times
//     too large.
//
//     (a) TYRE ENVELOPMENT. A truck tyre of radius Rt does not trace the road
//         profile. It rolls onto the obstacle from a distance, so the wheel
//         centre rises over an effective chord
//           L_eff = L + 2·sqrt(2·Rt·H)
//         For a 100 mm hump on a 600 mm chord under a 470 mm tyre this
//         doubles the chord, which quarters the acceleration. Ignoring
//         envelopment is the single biggest error in naive bump models.
//
//     (b) TRANSIENT, NOT HARMONIC, RESPONSE. A hump is one pulse, not a
//         steady oscillation, so steady-state transmissibility does not
//         apply — it predicts amplification where a short pulse actually
//         produces almost no sprung-mass motion. The correct measure is the
//         shock response spectrum of a half-sine pulse, parameterised by
//           beta = pulse duration / suspension natural period
//         which rises from near zero for a short sharp pulse, peaks around
//         1.25 near beta = 0.8, and tends to 1.0 for a long gentle one.
//
//     Peak wheel-path acceleration is H·(pi·v/L_eff)², and the deck sees that
//     multiplied by the shock amplification, giving a dynamic load factor
//     k = 1 ± a_z/g.
//
// THE REBOUND IS THE DANGEROUS PHASE. On compression the cargo is pressed into
// the deck and friction rises. On the rebound that follows, k < 1, the normal
// force falls, available friction falls with it, and that is when a load
// shifts. Checking only the compression peak — which is what a bare "dynamic
// factor of 1.4" does — misses the failure mode entirely.
//
// LIMITS OF THE MODEL
//   • Roll stiffness distribution between axles is not modelled, so all axles
//     are predicted to lift at the same lateral acceleration. On a real
//     chassis one end lifts first.
//   • Tyre lateral compliance, frame torsion and cargo shift feedback are
//     outside a quasi-static treatment.
//   • Articulated combinations are approximated by treating the steer axle and
//     trailer bogie as the effective wheelbase for longitudinal transfer.
// These are first-order results: right for planning decisions, not a
// substitute for a multibody simulation or a tilt-table test.
// ============================================================================

import { GRAVITY } from './specs.js';
import { SECURING } from './specs.js';

const KPH = 1 / 3.6; // km/h -> m/s

// Laden suspension parameters for an Indian leaf/air-sprung commercial chassis
export const SUSPENSION = {
  naturalHz: 1.8,     // laden body bounce frequency
  dampingRatio: 0.3,  // leaf spring + shock absorber, laden
  rollGradientDegPerG: 5.5, // body roll per g of lateral acceleration
  pitchGradientDegPerG: 1.6,
  tyreRadiusM: 0.47,  // 295/80 R22.5 on an Indian HCV
};

// Maximax shock response spectrum of a half-sine base-acceleration pulse on a
// single-degree-of-freedom system at 30% damping, tabulated against
// beta = pulse duration / natural period. Short sharp pulses barely move the
// sprung mass; the worst case is a pulse lasting about 80% of the suspension
// period.
const SRS_BETA = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0, 1.5, 2.0, 3.0, 5.0];
const SRS_Q = [0.15, 0.29, 0.55, 0.78, 0.95, 1.08, 1.17, 1.22, 1.24, 1.20, 1.08, 1.03, 1.00, 1.00];

/** Linear interpolation into the half-sine shock response spectrum. */
export function shockAmplification(beta) {
  if (beta <= SRS_BETA[0]) return (beta / SRS_BETA[0]) * SRS_Q[0];
  if (beta >= SRS_BETA[SRS_BETA.length - 1]) return 1.0;
  for (let i = 1; i < SRS_BETA.length; i += 1) {
    if (beta <= SRS_BETA[i]) {
      const t = (beta - SRS_BETA[i - 1]) / (SRS_BETA[i] - SRS_BETA[i - 1]);
      return SRS_Q[i - 1] + t * (SRS_Q[i] - SRS_Q[i - 1]);
    }
  }
  return 1.0;
}

// ----------------------------------------------------------------------------
// Road features found on the lanes this fleet actually runs
// ----------------------------------------------------------------------------
export const ROAD_FEATURES = {
  plantGateHump: {
    id: 'plantGateHump',
    label: 'Plant gate speed breaker',
    note: 'Unmarked bitumen hump at the Plant 2 outbound gate. Short chord, so it hits hard.',
    heightMm: 100,
    lengthMm: 600,
    advisoryKph: 10,
  },
  imtRoundTable: {
    id: 'imtRoundTable',
    label: 'IMT Manesar roundabout',
    note: 'Tight service-road roundabout with no superelevation.',
    radiusM: 22,
    superelevation: 0,
    advisoryKph: 20,
  },
  nh48Ramp: {
    id: 'nh48Ramp',
    label: 'NH-48 cloverleaf ramp',
    note: 'Expressway loop ramp, designed superelevation.',
    radiusM: 65,
    superelevation: 0.05,
    advisoryKph: 40,
  },
  rumbleStrip: {
    id: 'rumbleStrip',
    label: 'IRC rumble strip set',
    note: 'Series of low strips before a toll plaza. Low amplitude, high frequency.',
    heightMm: 12,
    lengthMm: 250,
    advisoryKph: 25,
  },
  tableTopHump: {
    id: 'tableTopHump',
    label: 'IRC table-top hump',
    note: 'IRC:99 compliant table top. Long chord, gentler at speed.',
    heightMm: 100,
    lengthMm: 3700,
    advisoryKph: 25,
  },
  flyoverGrade: {
    id: 'flyoverGrade',
    label: 'Flyover climb',
    note: 'Sustained grade onto an urban flyover.',
    gradePct: 6,
    advisoryKph: 30,
  },
  steepDescent: {
    id: 'steepDescent',
    label: 'Ghat descent',
    note: 'Long decline with engine braking and a service brake application.',
    gradePct: -8,
    brakingG: 0.25,
    advisoryKph: 30,
  },
  potholeEdge: {
    id: 'potholeEdge',
    label: 'Monsoon pothole edge',
    note: 'Single-wheel drop. Produces a one-sided impulse and a lateral jolt.',
    heightMm: 80,
    lengthMm: 400,
    oneSided: true,
    advisoryKph: 20,
  },
};

// ----------------------------------------------------------------------------
// Suspension transmissibility and the hump response
// ----------------------------------------------------------------------------
export function humpResponse({ heightMm, lengthMm, speedKph, oneSided = false }) {
  const H = heightMm / 1000;
  const L = Math.max(lengthMm / 1000, 0.05);
  const v = Math.max(speedKph * KPH, 0.01);
  const Rt = SUSPENSION.tyreRadiusM;

  // (a) tyre envelopment: the wheel centre rises over a longer chord than the
  // obstacle itself, because the tyre rolls onto it from a distance
  const leadIn = 2 * Math.sqrt(2 * Rt * Math.min(H, Rt));
  const Leff = L + leadIn;

  // (b) transient response, via the half-sine shock response spectrum
  const pulseSeconds = Leff / v;
  const naturalPeriod = 1 / SUSPENSION.naturalHz;
  const beta = pulseSeconds / naturalPeriod;
  const Q = shockAmplification(beta);

  const inputPeak = H * ((Math.PI * v) / Leff) ** 2; // m/s^2 at the wheel centre
  const deckPeak = inputPeak * Q;                    // m/s^2 at the deck
  const gz = deckPeak / GRAVITY;

  // A one-sided input (one wheel over the obstacle) also rolls the body, which
  // the cargo feels as lateral demand. The coupling factor is an engineering
  // approximation: a proper treatment needs the roll inertia and the roll
  // damping of the chassis, which is beyond a quasi-static model.
  const rollImpulseG = oneSided ? gz * 0.3 : 0;

  return {
    effectiveChordM: Leff,
    envelopmentGainM: leadIn,
    pulseSeconds,
    beta,
    shockAmplification: Q,
    naturalHz: SUSPENSION.naturalHz,
    inputPeakG: inputPeak / GRAVITY,
    peakG: gz,
    dlfCompression: 1 + gz,
    dlfRebound: Math.max(0, 1 - gz),
    airborne: gz >= 1,
    rollImpulseG,
    // the pulse lands in the worst part of the spectrum
    nearWorstCase: beta > 0.55 && beta < 1.2,
  };
}

/** Speed at which a given hump drives the suspension through resonance. */
export function worstCaseSpeedKph({ heightMm, lengthMm }) {
  // beta = 0.8 is the peak of the shock spectrum
  const L = Math.max(lengthMm / 1000, 0.05);
  const Leff = L + 2 * Math.sqrt(2 * SUSPENSION.tyreRadiusM * Math.min(heightMm / 1000, SUSPENSION.tyreRadiusM));
  const pulseSeconds = 0.8 / SUSPENSION.naturalHz;
  return (Leff / pulseSeconds) / KPH;
}

// ----------------------------------------------------------------------------
// Per-unit securing capacity, expressed as the lateral g it can resist
// ----------------------------------------------------------------------------
/**
 * Resistance of one unit, expressed as the acceleration in g it can take
 * before it moves.
 *
 * Two securing modes behave completely differently and must not share a
 * formula:
 *
 *   FRICTION + TOP-OVER LASHING (units sitting on the deck)
 *     A top-over lashing works by pressing the unit down, so what it buys you
 *     is extra friction — its contribution scales with mu. On a low-friction
 *     base it buys almost nothing.
 *
 *   CHOCKS + DIRECT LASHING (wheeled packaging such as panel trolleys)
 *     Friction cannot be claimed at all under EN 12195-1, so mu = 0 and a
 *     top-over lashing contributes nothing. These units are chocked and lashed
 *     directly to deck rings, and a direct lashing takes load in tension
 *     regardless of friction. Multiplying a direct lashing by mu — which is
 *     what a single shared formula does — yields zero capacity and reports a
 *     correctly secured trolley as sliding while the vehicle is standing
 *     still.
 *
 * For the direct-lashing case the webbing is never the governing part: a
 * 2,000 daN strap on a 300 kg trolley is an order of magnitude over-specified.
 * The limit is the deck lashing point, so the capacity is capped at the ring
 * rating rather than the strap rating.
 */
function unitCapacityG(unit, securingItem, verticalFactor) {
  const massKg = unit.grossKg;
  const weightN = Math.max(massKg * GRAVITY, 1);
  const n = securingItem?.lashings ?? 0;
  const wheeled = Boolean(unit.wheeled);
  const mu = wheeled ? 0 : (securingItem?.mu ?? unit.mu ?? 0.3);

  let frictionG = 0;
  let lashG = 0;
  let securingMode;

  if (wheeled) {
    securingMode = 'chock + direct lashing';
    // Chocks block the castors from rolling. Sized correctly they take the
    // full design force, but they only resist rolling, not bodily sliding of
    // the trolley, so they are credited conservatively.
    const chockG = 0.5;
    // Direct lashings in tension, capped at the deck ring rating.
    const perLashingN = Math.min(SECURING.lcDaN, DECK_RING_RATING_DAN) * 10;
    lashG = (n * perLashingN * DIRECT_LASH_EFFICIENCY) / weightN;
    frictionG = chockG;
  } else {
    securingMode = 'friction + top-over lashing';
    frictionG = mu * verticalFactor;
    const sinA = Math.sin((SECURING.lashingAngleDeg * Math.PI) / 180);
    const lashNewtons = n * 2 * SECURING.stfDaN * 10 * sinA;
    lashG = (lashNewtons * mu) / weightN;
  }

  // tipping about the short base edge
  const baseShort = Math.min(unit.l, unit.w) / 1000;
  const height = unit.h / 1000;
  const tipG = height > 0 ? (baseShort / (2 * height)) * verticalFactor : 99;

  return {
    mu,
    lashings: n,
    securingMode,
    // a plan with no securing at all should still read as unsecured, so the
    // cap only applies once something is actually holding the unit
    slideCapacityG: Math.min(frictionG + lashG, 2.5),
    frictionG,
    lashG,
    tipCapacityG: tipG,
    blockedFront: securingItem?.blockedFront ?? false,
    wheeled,
  };
}

// Rated capacity of a deck lashing point on an Indian body-built deck.
const DECK_RING_RATING_DAN = 2000;
// Angle and attachment efficiency of a direct lashing taken in tension.
const DIRECT_LASH_EFFICIENCY = 0.7;

// ----------------------------------------------------------------------------
// Full state evaluation at one instant
// ----------------------------------------------------------------------------
/**
 * @param {object} vehicle  resolved vehicle
 * @param {object} plan     solved load plan
 * @param {object} input    { speedKph, radiusM, superelevation, gradePct,
 *                            brakingG, verticalG, rollImpulseG, reboundPhase }
 */
export function evaluateState(vehicle, plan, input) {
  const {
    speedKph = 0,
    radiusM = 0,
    superelevation = 0,
    gradePct = 0,
    brakingG = 0,
    verticalG = 0,
    rollImpulseG = 0,
    reboundPhase = false,
  } = input;

  const d = plan.distribution;
  const g = vehicle.geometry;
  const massKg = d.grossVehicleKg;
  const h = d.combinedCogHeightMm / 1000;
  const track = g.trackWidthMm / 1000;
  const theta = Math.atan(gradePct / 100);

  // --- accelerations -----------------------------------------------------
  const v = speedKph * KPH;
  const rawLatG = radiusM > 0 ? (v * v) / (radiusM * GRAVITY) : 0;
  const latG = Math.max(0, rawLatG - superelevation) + rollImpulseG;
  const longG = brakingG + Math.sin(theta);
  // Vertical factor: compression adds normal force, rebound removes it.
  // A live simulation supplies a signed acceleration and needs no phase flag;
  // the scripted inputs supply a magnitude plus `reboundPhase`.
  const vertFactor = input.signedVerticalG !== undefined
    ? Math.max(0, 1 + input.signedVerticalG)
    : (reboundPhase
      ? Math.max(0, 1 - Math.abs(verticalG))
      : 1 + Math.abs(verticalG));

  // --- axle loads --------------------------------------------------------
  const effWheelbase = g.vehicleClass === 'articulated'
    ? (vehicle.axleGroups.find(a => a.id === 'trailer').xMm
       - vehicle.axleGroups.find(a => a.id === 'steer').xMm) / 1000
    : g.wheelbaseMm / 1000;

  // longitudinal transfer, positive forward
  const transferKg = massKg * ((brakingG * h) / effWheelbase)
    - massKg * ((Math.sin(theta) * h) / effWheelbase);

  const cosScale = Math.cos(theta);
  const staticTotal = d.axles.reduce((s, a) => s + a.loadKg, 0) || 1;
  const frontStatic = d.axles.find(a => a.id === 'steer')?.loadKg ?? 0;
  const rearStatic = Math.max(staticTotal - frontStatic, 1);

  const axles = d.axles.map(a => {
    const isFront = a.id === 'steer';
    const share = a.loadKg / staticTotal;
    // The steer axle takes the whole longitudinal transfer; the rear groups
    // give it up in proportion to their share of the rear total, so the sum
    // across all groups stays equal to m·g·cosθ.
    const longDelta = isFront ? transferKg : -transferKg * (a.loadKg / rearStatic);
    const base = a.loadKg * cosScale + longDelta;
    const total = Math.max(0, base * vertFactor);

    // lateral transfer across this axle, apportioned by static share
    const latDeltaKg = massKg * latG * (h / track) * share * vertFactor;
    const inner = Math.max(0, total / 2 - latDeltaKg);
    const outer = total / 2 + latDeltaKg;

    return {
      id: a.id,
      label: a.label,
      limitKg: a.limitKg,
      staticKg: a.loadKg,
      totalKg: Math.round(total),
      innerKg: Math.round(inner),
      outerKg: Math.round(outer),
      utilPct: (total / a.limitKg) * 100,
      // The statutory limit is a *static* weighbridge limit. A dynamic peak
      // above it is a suspension, tyre and deck loading concern, not a CMVR
      // breach, and must not be reported as one.
      dynamicExceedance: total > a.limitKg,
      overload: total > a.limitKg,
      // Two different things unload a wheel and they must not share a flag:
      //   airborne   the whole axle is light because the vehicle is unloaded
      //              vertically over a bump. Both wheels go together.
      //   wheelLift  the INNER wheel is unloaded while the outer carries the
      //              axle. That is lateral transfer, and it is rollover onset.
      airborne: total <= a.staticKg * 0.1,
      wheelLift: inner <= 1 && outer > total * 0.4 && latG > 0.05,
      // tyre overload on the outer wheels is the failure that strands a truck
      outerUtilPct: (outer / (a.limitKg / 2)) * 100,
    };
  });

  // --- rollover ----------------------------------------------------------
  const srt = track / (2 * h);
  const srtLocal = srt;
  const rolloverUtilPct = (latG / srt) * 100;

  // --- body attitude for the visualisation -------------------------------
  const rollDeg = latG * SUSPENSION.rollGradientDegPerG;
  const pitchDeg = -(Math.atan(gradePct / 100) * 180) / Math.PI
    - brakingG * SUSPENSION.pitchGradientDegPerG;

  // --- cargo ------------------------------------------------------------
  // A unit can only tip outward if nothing is outboard of it. Where a
  // neighbour or the side wall is in contact, tipping is restrained and the
  // thrust goes into that structure instead — which is exactly what the
  // side-wall rating check in the securing plan accounts for.
  const deckWidth = vehicle.deck.widthMm;
  const restrained = new Map();
  plan.placements.forEach(p => {
    const centre = p.z + p.w / 2;
    const outboardIsRight = centre >= deckWidth / 2;
    const gapToWall = outboardIsRight ? deckWidth - (p.z + p.w) : p.z;
    const hasNeighbour = plan.placements.some(q => {
      if (q === p) return false;
      const sameLevel = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y) > 100;
      const overlapsX = Math.min(p.x + p.l, q.x + q.l) - Math.max(p.x, q.x) > 100;
      if (!sameLevel || !overlapsX) return false;
      return outboardIsRight
        ? q.z >= p.z + p.w - 5 && q.z - (p.z + p.w) < 120
        : q.z + q.w <= p.z + 5 && p.z - (q.z + q.w) < 120;
    });
    restrained.set(p.huId, gapToWall <= 120 || hasNeighbour);
  });

  const cargo = plan.placements.map(p => {
    const sec = plan.securing.items.find(i => i.huId === p.huId);
    const cap = unitCapacityG(p, sec, vertFactor);
    const tipRestrained = restrained.get(p.huId) || false;

    // demand: lateral always acts; longitudinal is taken by blocking when the
    // unit bears against the bulkhead and the force is forward
    const longDemand = cap.blockedFront && longG > 0 ? 0 : Math.abs(longG);
    const slideDemandG = Math.sqrt(latG ** 2 + longDemand ** 2);
    const slideMargin = cap.slideCapacityG - slideDemandG;
    // restrained units cannot rotate outward until the whole block goes
    const effectiveTipCapacityG = tipRestrained ? cap.tipCapacityG + srtLocal : cap.tipCapacityG;
    const tipMargin = effectiveTipCapacityG - latG;

    // Both the overturning moment and the restoring moment scale with the
    // vertical load, so during the airborne phase both go to zero and the
    // margin test becomes indeterminate: 0 >= 0 reads as "tipping" when there
    // is no lateral demand to tip anything. A failure mode needs a demand to
    // drive it, so each test is gated on its own demand being real.
    const DEMAND_EPS = 0.03;
    let status = 'ok';
    if (vertFactor < 0.15) status = 'weightless';
    else if (latG > DEMAND_EPS && tipMargin <= 0) status = 'tipping';
    else if (slideDemandG > DEMAND_EPS && slideMargin <= 0) status = 'sliding';
    else if ((latG > DEMAND_EPS && tipMargin < 0.1)
      || (slideDemandG > DEMAND_EPS && slideMargin < 0.1)) status = 'marginal';

    return {
      huId: p.huId,
      partNo: p.partNo,
      tier: p.tier,
      grossKg: p.grossKg,
      ...cap,
      slideDemandG,
      slideMargin,
      tipMargin,
      tipRestrained,
      effectiveTipCapacityG,
      status,
      instantaneousKg: p.grossKg * vertFactor,
      deckPressureKgM2: (p.grossKg * vertFactor) / ((p.l * p.w) / 1e6),
    };
  });

  const sliding = cargo.filter(c => c.status === 'sliding');
  const tipping = cargo.filter(c => c.status === 'tipping');
  const marginal = cargo.filter(c => c.status === 'marginal');
  const weightless = cargo.filter(c => c.status === 'weightless');

  const anyAxleOverload = axles.some(a => a.overload);
  const anyWheelLift = axles.some(a => a.wheelLift);
  const anyAirborne = axles.some(a => a.airborne);

  let verdict = 'safe';
  if (anyWheelLift || tipping.length) verdict = 'critical';
  else if (anyAirborne || sliding.length || anyAxleOverload || rolloverUtilPct > 85) verdict = 'warning';
  else if (marginal.length || rolloverUtilPct > 65) verdict = 'watch';

  return {
    input,
    latG,
    rawLatG,
    longG,
    verticalG,
    vertFactor,
    rollDeg,
    pitchDeg,
    srt,
    rolloverUtilPct,
    axles,
    cargo,
    sliding,
    tipping,
    marginal,
    weightless,
    anyAxleOverload,
    anyWheelLift,
    anyAirborne,
    verdict,
    massKg,
    cogHeightMm: d.combinedCogHeightMm,
  };
}

// ----------------------------------------------------------------------------
// Critical speeds: the speed at which each failure mode arrives
// ----------------------------------------------------------------------------
export function criticalSpeeds(vehicle, plan, { radiusM, superelevation = 0 }) {
  if (!radiusM || radiusM <= 0) return null;
  const d = plan.distribution;
  const h = d.combinedCogHeightMm / 1000;
  const track = vehicle.geometry.trackWidthMm / 1000;
  const srt = track / (2 * h);

  const toKph = (ayG) => Math.sqrt(Math.max(ayG + superelevation, 0) * GRAVITY * radiusM) / KPH;

  // worst unit for each cargo failure mode at a neutral vertical factor
  let worstSlide = { capG: Infinity, huId: null };
  let worstTip = { capG: Infinity, huId: null };
  plan.placements.forEach(p => {
    const sec = plan.securing.items.find(i => i.huId === p.huId);
    const cap = unitCapacityG(p, sec, 1);
    if (cap.slideCapacityG < worstSlide.capG) worstSlide = { capG: cap.slideCapacityG, huId: p.huId, partNo: p.partNo };
    if (cap.tipCapacityG < worstTip.capG) worstTip = { capG: cap.tipCapacityG, huId: p.huId, partNo: p.partNo };
  });

  const modes = [
    { mode: 'Wheel lift / rollover', speedKph: toKph(srt), atG: srt, detail: `SRT ${srt.toFixed(2)} g at CoG height ${d.combinedCogHeightMm} mm` },
    { mode: 'Cargo slides', speedKph: toKph(worstSlide.capG), atG: worstSlide.capG, detail: `${worstSlide.partNo || '—'} (${worstSlide.huId || '—'})` },
    { mode: 'Cargo tips', speedKph: toKph(worstTip.capG), atG: worstTip.capG, detail: `${worstTip.partNo || '—'} (${worstTip.huId || '—'})` },
  ].sort((a, b) => a.speedKph - b.speedKph);

  return {
    radiusM,
    superelevation,
    srt,
    modes,
    governing: modes[0],
    safeKph: modes[0].speedKph,
    // a working advisory with a margin, rounded down to something a driver can use
    advisoryKph: Math.max(5, Math.floor((modes[0].speedKph * 0.8) / 5) * 5),
  };
}

// ----------------------------------------------------------------------------
// Scenario player
// ----------------------------------------------------------------------------
export const ROUTE_SCENARIOS = {
  plantToGate: {
    id: 'plantToGate',
    label: 'Plant 2 yard to MSIL Gate 4',
    description: 'The real first two kilometres of every milk run: yard exit hump, service-road roundabout, then the gate approach.',
    segments: [
      { t: 0, kind: 'straight', seconds: 2.5, speedKph: 20, label: 'Pulling out of the bay' },
      { t: 0, kind: 'hump', seconds: 1.6, speedKph: 12, feature: 'plantGateHump', label: 'Yard exit speed breaker' },
      { t: 0, kind: 'straight', seconds: 2, speedKph: 35, label: 'Service road' },
      { t: 0, kind: 'corner', seconds: 4, speedKph: 28, feature: 'imtRoundTable', label: 'IMT roundabout' },
      { t: 0, kind: 'straight', seconds: 2, speedKph: 45, label: 'Straight' },
      { t: 0, kind: 'brake', seconds: 2.2, speedKph: 45, brakingG: 0.45, label: 'Hard stop at the gate' },
    ],
  },
  highwayRun: {
    id: 'highwayRun',
    label: 'NH-48 trunk run',
    description: 'Expressway ramp at speed, a flyover climb, and the descent that follows.',
    segments: [
      { t: 0, kind: 'straight', seconds: 2, speedKph: 60, label: 'Mainline' },
      { t: 0, kind: 'corner', seconds: 4.5, speedKph: 50, feature: 'nh48Ramp', label: 'Cloverleaf ramp' },
      { t: 0, kind: 'grade', seconds: 3, speedKph: 35, feature: 'flyoverGrade', label: 'Flyover climb' },
      { t: 0, kind: 'grade', seconds: 3.5, speedKph: 40, feature: 'steepDescent', label: 'Descent with braking' },
      { t: 0, kind: 'hump', seconds: 1.4, speedKph: 30, feature: 'rumbleStrip', label: 'Toll plaza rumble strips' },
    ],
  },
  roughRoad: {
    id: 'roughRoad',
    label: 'Monsoon broken surface',
    description: 'The worst case the fleet sees: a table-top hump at the resonant speed, a one-sided pothole, and a swerve.',
    segments: [
      { t: 0, kind: 'straight', seconds: 1.5, speedKph: 40, label: 'Approach' },
      { t: 0, kind: 'hump', seconds: 2.4, speedKph: 40, feature: 'tableTopHump', label: 'Table-top hump at speed' },
      { t: 0, kind: 'hump', seconds: 1.6, speedKph: 35, feature: 'potholeEdge', label: 'One-sided pothole edge' },
      { t: 0, kind: 'corner', seconds: 2.4, speedKph: 45, feature: 'imtRoundTable', label: 'Evasive swerve' },
      { t: 0, kind: 'straight', seconds: 1.5, speedKph: 30, label: 'Recovery' },
    ],
  },
}

/**
 * Expands a scenario into a timeline with absolute start times and the inputs
 * each segment applies, so the player and the telemetry trace share one source.
 */
export function buildTimeline(scenarioId) {
  const sc = ROUTE_SCENARIOS[scenarioId] || ROUTE_SCENARIOS.plantToGate;
  let t = 0;
  const segments = sc.segments.map((s, i) => {
    const feature = s.feature ? ROAD_FEATURES[s.feature] : null;
    const seg = {
      ...s,
      index: i,
      feature,
      start: t,
      end: t + s.seconds,
    };
    t += s.seconds;
    return seg;
  });
  return { ...sc, segments, duration: t };
}

/**
 * The input vector at time `time` within a timeline. Humps are applied as a
 * compression half-cycle followed by the rebound, because the rebound is where
 * the cargo actually moves.
 */
export function inputAt(timeline, time) {
  const seg = timeline.segments.find(s => time >= s.start && time < s.end)
    || timeline.segments[timeline.segments.length - 1];
  if (!seg) return { speedKph: 0 };

  const local = time - seg.start;
  const frac = Math.min(1, Math.max(0, local / seg.seconds));
  const f = seg.feature || {};

  const base = {
    speedKph: seg.speedKph,
    radiusM: 0,
    superelevation: 0,
    gradePct: 0,
    brakingG: 0,
    verticalG: 0,
    rollImpulseG: 0,
    reboundPhase: false,
    segmentLabel: seg.label,
    featureLabel: f.label || null,
    featureNote: f.note || null,
    kind: seg.kind,
    advisoryKph: f.advisoryKph ?? null,
  };

  if (seg.kind === 'corner') {
    // ease the lateral acceleration in and out like a real steering input
    const shape = Math.sin(Math.PI * frac);
    return {
      ...base,
      radiusM: f.radiusM / Math.max(shape, 0.08),
      superelevation: (f.superelevation || 0) * shape,
    };
  }

  if (seg.kind === 'hump') {
    const resp = humpResponse({
      heightMm: f.heightMm,
      lengthMm: f.lengthMm,
      speedKph: seg.speedKph,
      oneSided: f.oneSided,
    });
    // first 45% of the segment is compression, the next 45% is the rebound
    let verticalG = 0;
    let reboundPhase = false;
    if (frac < 0.45) {
      verticalG = resp.peakG * Math.sin((Math.PI * frac) / 0.45);
    } else if (frac < 0.9) {
      verticalG = resp.peakG * 0.85 * Math.sin((Math.PI * (frac - 0.45)) / 0.45);
      reboundPhase = true;
    }
    return {
      ...base,
      verticalG,
      reboundPhase,
      rollImpulseG: f.oneSided ? resp.rollImpulseG * Math.sin(Math.PI * frac) : 0,
      response: resp,
    };
  }

  if (seg.kind === 'grade') {
    return {
      ...base,
      gradePct: f.gradePct || 0,
      brakingG: (f.brakingG || 0) * Math.sin(Math.PI * frac),
    };
  }

  if (seg.kind === 'brake') {
    return {
      ...base,
      brakingG: (seg.brakingG || 0.4) * Math.min(1, frac * 2.5),
      speedKph: seg.speedKph * (1 - frac * 0.9),
    };
  }

  return base;
}

/** Pre-computes the whole run for the telemetry trace. */
export function runScenario(vehicle, plan, scenarioId, { hz = 20 } = {}) {
  const timeline = buildTimeline(scenarioId);
  const samples = [];
  const step = 1 / hz;
  let worst = null;
  const events = [];

  for (let t = 0; t <= timeline.duration; t += step) {
    const input = inputAt(timeline, t);
    const state = evaluateState(vehicle, plan, input);
    samples.push({
      t,
      latG: state.latG,
      longG: state.longG,
      verticalG: state.verticalG * (input.reboundPhase ? -1 : 1),
      rolloverUtilPct: state.rolloverUtilPct,
      verdict: state.verdict,
      speedKph: input.speedKph,
      maxAxleUtil: Math.max(...state.axles.map(a => a.utilPct)),
      slidingCount: state.sliding.length,
      tippingCount: state.tipping.length,
      segmentLabel: input.segmentLabel,
    });

    const severity = { safe: 0, watch: 1, warning: 2, critical: 3 }[state.verdict];
    if (!worst || severity > worst.severity) {
      worst = { severity, t, state, input };
    }
    if (state.verdict === 'critical' || state.verdict === 'warning') {
      const last = events[events.length - 1];
      if (!last || last.label !== input.segmentLabel || last.verdict !== state.verdict) {
        events.push({
          t,
          label: input.segmentLabel,
          featureLabel: input.featureLabel,
          verdict: state.verdict,
          detail: state.anyWheelLift ? 'Inner wheels unloaded — rollover onset'
            : state.tipping.length ? `${state.tipping.length} unit(s) tipping`
              : state.sliding.length ? `${state.sliding.length} unit(s) sliding`
                : state.anyAxleOverload ? 'Dynamic axle peak above the static rating — suspension and deck loading, not a weighbridge breach'
                  : `Rollover utilisation ${state.rolloverUtilPct.toFixed(0)}%`,
          latG: state.latG,
          verticalG: state.verticalG,
        });
      }
    }
  }

  return { timeline, samples, worst, events };
}
