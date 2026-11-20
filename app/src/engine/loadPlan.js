// ============================================================================
// JBM LoadIQ — LOAD PLAN ORCHESTRATOR
// ----------------------------------------------------------------------------
// Runs the packing algorithm across a multi-start grid of strategy parameters,
// evaluates each candidate against a weighted objective (fit, axle compliance,
// centre-of-gravity window, unloading sequence, packing density) and returns
// the winning plan enriched with everything a dock supervisor and a compliance
// officer actually need:
//
//   • verified 3D placements with bay / row / tier addressing
//   • solved axle reactions and stability margins
//   • EN 12195-1 securing schedule
//   • residual capacity and a "what else fits" recommendation
//   • trip economics, emissions, and statutory penalty exposure
//   • a like-for-like manual-planning baseline computed with the same physics
// ============================================================================

import { resolveVehicle, ENGINE_DEFAULTS } from './specs.js';
import {
  buildHandlingUnits,
  resolveDropSequence,
  packRun,
  auditUnloadSequence,
  residualCapacity,
} from './packer.js';
import { computeWeightDistribution, suggestAxleCorrection, influenceLines } from './physics.js';
import { buildSecuringPlan } from './securing.js';
import { computeBounds, boundsVerdict } from './bounds.js';
import { analyseUncertainty } from './robustness.js';
import {
  deckLoadCheck, massProfile, constraintTightness, marginalEconomics, pressureStats,
} from './analytics.js';

const BAY_PITCH_MM = 1200;

// ----------------------------------------------------------------------------
// Statutory penalty exposure
// Reference: Motor Vehicles (Amendment) Act 2019, Section 194(1) — overloading
// of goods vehicles: ₹20,000 plus ₹2,000 for every additional tonne.
// ----------------------------------------------------------------------------
export function overloadPenaltyInr(overloadKg) {
  if (overloadKg <= 0) return 0;
  return 20000 + 2000 * Math.ceil(overloadKg / 1000);
}

// ----------------------------------------------------------------------------
// Candidate scoring (cheap proxies only — the winner gets the full analysis)
// ----------------------------------------------------------------------------
function scoreCandidate(vehicle, run, dist, lifo, totalGoodsVolumeM3) {
  const placed = run.placements;
  if (!placed.length) return { score: Number.POSITIVE_INFINITY };

  const placedVolumeM3 = placed.reduce((s, p) => s + (p.l * p.w * p.h) / 1e9, 0);
  const leftoverShare = 1 - placedVolumeM3 / Math.max(totalGoodsVolumeM3, 1e-6);

  const minX = Math.min(...placed.map(p => p.x));
  const maxX = Math.max(...placed.map(p => p.x + p.l));
  const maxH = Math.max(...placed.map(p => p.y + p.h));
  const envelopeM3 = ((maxX - minX) * vehicle.deck.widthMm * maxH) / 1e9;
  const compactness = envelopeM3 > 0 ? placedVolumeM3 / envelopeM3 : 0;

  const overloadPct = dist.axles.reduce((s, a) => s + Math.max(0, a.utilPct - 100), 0);
  const anyOverload = dist.axles.some(a => !a.compliant) || dist.gvwOverloadKg > 0;
  const cogMiss = Math.abs(dist.cogFractionPct - ENGINE_DEFAULTS.cogTargetFraction * 100);
  const lateralMiss = Math.max(0, Math.abs(dist.cogLateralMm) - dist.cogLateralLimitMm) / 10;
  const criticals = run.validation.issues.filter(i => i.severity === 'critical').length;

  // Statutory limits are treated as hard constraints: any non-compliant
  // candidate is pushed below every compliant one regardless of how well it
  // packs. A load plan that cannot legally leave the gate has no utilisation.
  const score =
    1200 * leftoverShare
    + (anyOverload ? 5000 : 0)
    + 40 * overloadPct
    + (criticals > 0 ? 5000 : 0)
    + (dist.rolloverSafe ? 0 : 400)
    + (dist.lateralBalanced ? 0 : 250)
    + (dist.cogInWindow ? 0 : 350)
    + 6 * cogMiss
    + 6 * lateralMiss
    + 12 * lifo.rehandlingEvents
    + 0.0015 * minX
    - 110 * compactness;

  return { score, compactness, leftoverShare, placedVolumeM3 };
}

// ----------------------------------------------------------------------------
// Multi-start search
// ----------------------------------------------------------------------------
const SEARCH_GRID = {
  weightBias: ['heavyCentre', 'heavyFront', 'heavyRear'],
  sortOrder: ['heavyFirst', 'areaFirst', 'tallFirst'],
  blockOffsetFraction: [0, 0.06, 0.16],
};

export function solveLoadPlan(vehicleType, orders, helpers, userOptions = {}) {
  const vehicle = resolveVehicle(vehicleType);
  if (!vehicle) return null;
  if (!orders.length) return emptyPlan(vehicle);

  const options = {
    enforceLifo: true,
    allowStacking: true,
    allowRotation: true,
    allowVoidRecovery: true,
    minSupportRatio: ENGINE_DEFAULTS.minSupportRatio,
    ...userOptions,
  };

  const units = buildHandlingUnits(orders, {
    ...helpers,
    deckMaterial: vehicle.geometry.deckMaterial,
  });
  const drops = resolveDropSequence(units, helpers);
  const totalGoodsVolumeM3 = units.reduce((s, u) => s + u.volumeM3, 0);
  const totalGoodsKg = units.reduce((s, u) => s + u.grossKg, 0);

  let best = null;
  const trials = [];

  SEARCH_GRID.weightBias.forEach(weightBias => {
    SEARCH_GRID.sortOrder.forEach(sortOrder => {
      SEARCH_GRID.blockOffsetFraction.forEach(blockOffsetFraction => {
        const run = packRun(vehicle, units, {
          ...options, weightBias, sortOrder, blockOffsetFraction,
        });
        const dist = computeWeightDistribution(vehicle, run.placements);
        const lifo = auditUnloadSequence(run.placements);
        const scored = scoreCandidate(vehicle, run, dist, lifo, totalGoodsVolumeM3);
        const worstAxleUtilPct = Math.max(...dist.axles.map(a => a.utilPct));
        const trial = {
          label: `${weightBias}/${sortOrder}/+${Math.round(blockOffsetFraction * 100)}%`,
          worstAxleUtilPct,
          feasible: run.rejected.length === 0 && dist.axleCompliant && run.validation.ok,
          weightBias,
          sortOrder,
          blockOffsetFraction,
          score: scored.score,
          placed: run.placements.length,
          rejected: run.rejected.length,
          cogPct: dist.cogFractionPct,
          axleCompliant: dist.axleCompliant,
          rehandles: lifo.rehandlingEvents,
          compactness: scored.compactness,
          valid: run.validation.ok,
        };
        trials.push(trial);
        if (!best || scored.score < best.scored.score) {
          best = { run, dist, lifo, scored, trial };
        }
      });
    });
  });

  return enrich(vehicle, best, {
    units, drops, orders, helpers, options, totalGoodsVolumeM3, totalGoodsKg, trials,
  });
}

function emptyPlan(vehicle) {
  return {
    vehicle,
    empty: true,
    placements: [],
    rejected: [],
    kpi: null,
  };
}

// ----------------------------------------------------------------------------
// Full analysis of the winning candidate
// ----------------------------------------------------------------------------
function enrich(vehicle, best, ctx) {
  const { run, dist, lifo } = best;
  const { units, drops, orders, options, totalGoodsVolumeM3, totalGoodsKg, trials } = ctx;

  const capacity = residualCapacity(vehicle, run.placements, run.loadedKg);
  const securing = buildSecuringPlan(vehicle, run.placements);
  const correction = dist.axleCompliant ? null : suggestAxleCorrection(vehicle, dist, run.placements);

  // --- analytics ---------------------------------------------------------
  const bounds = computeBounds(vehicle, units, run.placements);
  const deckCheck = deckLoadCheck(vehicle, run.placements);
  const profile = massProfile(vehicle, run.placements);
  const influence = influenceLines(vehicle);
  const pressure = pressureStats(run.placements);
  const uncertainty = options.uncertainty === false
    ? null
    : analyseUncertainty(vehicle, run.placements, options.uncertaintyConfig || {});

  // --- dock loading sequence --------------------------------------------
  // Loading is the reverse of unloading: everything that comes off last goes
  // on first, bottom tier before top tier.
  const loadSequence = [...run.placements]
    .sort((a, b) => a.x - b.x || a.tier - b.tier || a.z - b.z)
    .map((p, i) => ({
      ...p,
      loadSeq: i + 1,
      address: addressOf(p, vehicle.deck),
      forkliftSide: p.z + p.w / 2 < vehicle.deck.widthMm / 2 ? 'LEFT (driver side)' : 'RIGHT (kerb side)',
    }));
  const unloadSequence = [...loadSequence].reverse().map((p, i) => ({ ...p, unloadSeq: i + 1 }));

  const handlingMinutes = run.placements.reduce((s, p) => s + (p.handlingSeconds || 90), 0) / 60;

  // --- economics ---------------------------------------------------------
  const economics = computeEconomics(vehicle, {
    drops,
    placements: run.placements,
    rejected: run.rejected,
    goodsVolumeM3: capacity.goodsVolumeM3,
    loadedKg: run.loadedKg,
    overloadKg: dist.totalOverloadKg + dist.gvwOverloadKg,
    rehandlingEvents: lifo.rehandlingEvents,
  });

  // --- manual baseline, same physics, no optimisation --------------------
  const baseline = computeBaseline(vehicle, units, options);

  // --- violations roll-up ------------------------------------------------
  const violations = collectViolations({
    run, dist, lifo, securing, correction, capacity, deckCheck, uncertainty, bounds,
  });

  const kpi = {
    // honest cube accounting
    cubeOccupancyPct: capacity.cubeOccupancyPct,
    envelopePct: capacity.envelopePct,
    packingDensityPct: capacity.packingDensityPct,
    floorUtilPct: capacity.floorUtilPct,
    payloadUtilPct: capacity.payloadUtilPct,
    gvwUtilPct: dist.gvwUtilPct,
    // what is left
    floorFreeM2: capacity.floorFreeM2,
    freeAirVolumeM3: capacity.freeAirVolumeM3,
    payloadHeadroomKg: capacity.payloadHeadroomKg,
    heightHeadroomMm: capacity.heightHeadroomMm,
    largestFreeFloorRect: capacity.largestFreeFloorRect,
    // quality
    unitsPlaced: run.placements.length,
    unitsOffered: units.length,
    unitsRejected: run.rejected.length,
    rehandlingEvents: lifo.rehandlingEvents,
    criticalIssues: run.validation.issues.filter(i => i.severity === 'critical').length,
    handlingMinutes,
    maxStackHeightMm: capacity.maxStackHeightMm,
  };

  const plan = {
    vehicle,
    empty: false,
    options,
    strategy: run.strategy,
    trials: trials.sort((a, b) => a.score - b.score),
    placements: run.placements,
    columns: run.columns,
    rejected: run.rejected,
    validation: run.validation,
    drops,
    bands: run.bands,
    loadSequence,
    unloadSequence,
    distribution: dist,
    axleCorrection: correction,
    securing,
    capacity,
    lifo,
    kpi,
    economics,
    baseline,
    violations,
    totals: {
      goodsVolumeM3: totalGoodsVolumeM3,
      goodsKg: totalGoodsKg,
      orders: orders.length,
      units: units.length,
    },

    // analytics
    bounds,
    boundsVerdict: boundsVerdict(bounds, vehicle),
    deckCheck,
    massProfile: profile,
    influence,
    pressure,
    uncertainty,
  };

  // these need the assembled plan
  plan.tightness = constraintTightness(plan);
  plan.marginal = marginalEconomics(plan);
  return plan;
}

function addressOf(p, deck) {
  const bay = Math.floor((p.x + p.l / 2) / BAY_PITCH_MM) + 1;
  const centreZ = p.z + p.w / 2;
  const third = deck.widthMm / 3;
  const row = centreZ < third ? 'L' : centreZ < 2 * third ? 'C' : 'R';
  return `BAY ${String(bay).padStart(2, '0')} · ROW ${row} · TIER ${p.tier}`;
}

// ----------------------------------------------------------------------------
// Trip economics
// ----------------------------------------------------------------------------
function computeEconomics(vehicle, { drops, placements, rejected, goodsVolumeM3, loadedKg, overloadKg, rehandlingEvents }) {
  const g = vehicle.geometry;
  const D = ENGINE_DEFAULTS;
  // Route estimate: the furthest consignee sets the leg, each additional drop
  // adds a 15% detour allowance. Replace with the routing API distance matrix
  // when it is wired in.
  const furthestKm = drops.reduce((m, d) => Math.max(m, d.distanceKm), 0);
  const routeKm = Math.round(furthestKm * (1 + 0.15 * Math.max(0, drops.length - 1)));
  const roundTripKm = routeKm * 2;

  const litres = roundTripKm / g.kmplLaden;
  const fuelInr = litres * D.dieselInrPerLitre;
  const tollInr = roundTripKm * D.tollInrPerKm;
  const fixedInr = D.driverCostPerTripInr;
  const tripCostInr = Math.round(fuelInr + tollInr + fixedInr);

  const deliveredTonnes = loadedKg / 1000;
  const penaltyInr = overloadPenaltyInr(overloadKg);
  const rehandleCostInr = rehandlingEvents * 450; // forklift + labour per re-handle

  return {
    routeKm,
    roundTripKm,
    litres: Number(litres.toFixed(1)),
    fuelInr: Math.round(fuelInr),
    tollInr: Math.round(tollInr),
    fixedInr,
    tripCostInr,
    co2Kg: Math.round(litres * D.co2KgPerLitreDiesel),
    costPerM3Inr: goodsVolumeM3 > 0 ? Math.round(tripCostInr / goodsVolumeM3) : 0,
    costPerTonneInr: deliveredTonnes > 0 ? Math.round(tripCostInr / deliveredTonnes) : 0,
    costPerUnitInr: placements.length ? Math.round(tripCostInr / placements.length) : 0,
    penaltyExposureInr: penaltyInr,
    rehandleCostInr,
    unitsLeftBehind: rejected.length,
    // a second vehicle is required only if something genuinely did not fit
    extraTripsRequired: rejected.length > 0 ? 1 : 0,
  };
}

// ----------------------------------------------------------------------------
// Manual-planning baseline
// Loaded the way a dispatcher does it under time pressure: in the order the
// paperwork came in, from the rear doors forward, no column pre-build beyond
// what is obvious, no rotation, no void recovery, no axle check.
// ----------------------------------------------------------------------------
function computeBaseline(vehicle, units, options) {
  const run = packRun(vehicle, units, {
    ...options,
    weightBias: 'heavyRear',
    sortOrder: 'rearDoorFirst',
    blockOffsetFraction: 0.42,
    enforceLifo: false,
    allowRotation: false,
    allowVoidRecovery: false,
  });
  const dist = computeWeightDistribution(vehicle, run.placements);
  const lifo = auditUnloadSequence(run.placements);
  const capacity = residualCapacity(vehicle, run.placements, run.loadedKg);

  return {
    placements: run.placements,
    rejected: run.rejected,
    distribution: dist,
    lifo,
    capacity,
    penaltyExposureInr: overloadPenaltyInr(dist.totalOverloadKg + dist.gvwOverloadKg),
    validation: run.validation,
    kpi: {
      cubeOccupancyPct: capacity.cubeOccupancyPct,
      envelopePct: capacity.envelopePct,
      packingDensityPct: capacity.packingDensityPct,
      floorUtilPct: capacity.floorUtilPct,
      payloadUtilPct: capacity.payloadUtilPct,
      unitsPlaced: run.placements.length,
      unitsRejected: run.rejected.length,
      rehandlingEvents: lifo.rehandlingEvents,
      maxStackHeightMm: capacity.maxStackHeightMm,
    },
  };
}

// ----------------------------------------------------------------------------
// Violation roll-up with a remedy against each finding
// ----------------------------------------------------------------------------
function collectViolations({ run, dist, lifo, securing, correction, capacity, deckCheck, uncertainty, bounds }) {
  const out = [];

  if (bounds?.secondVehicleProvable) {
    out.push({
      severity: 'critical',
      code: 'CAPACITY_BOUND',
      title: 'Consignment cannot fit one vehicle',
      message: `The ${bounds.bindingResource} relaxation bound is ${bounds.continuousBound.toFixed(2)} vehicle loads, so at least ${bounds.minVehicles} vehicles are required. This is provable, not a solver limitation.`,
      remedy: 'Split the consignment across trips, or move to a higher-rated asset.',
    });
  }

  (deckCheck?.issues || []).forEach(i => out.push({
    severity: i.severity,
    code: i.code,
    title: i.code === 'DECK_POINT_LOAD' ? 'Deck point load exceeded' : 'Deck distributed load exceeded',
    message: i.message,
    remedy: i.code === 'DECK_POINT_LOAD'
      ? 'Spread the foot load with a bearing plate or reduce the stack by one tier.'
      : 'Redistribute the stack over a larger footprint.',
  }));

  if (uncertainty && uncertainty.verdict.level !== 'ok') {
    out.push({
      severity: uncertainty.verdict.level === 'bad' ? 'critical' : 'warning',
      code: 'UNCERTAINTY',
      title: 'Declared mass uncertainty puts the plan at risk',
      message: `${uncertainty.verdict.text} Worst group: ${uncertainty.worstAxle.label} at p99 ${Math.round(uncertainty.worstAxle.p99).toLocaleString('en-IN')} kg against a ${uncertainty.worstAxle.limitKg.toLocaleString('en-IN')} kg limit.`,
      remedy: `Plan to the p99 figure, not the declared one: leave at least ${Math.max(0, Math.round(uncertainty.worstAxle.p99 - uncertainty.worstAxle.mean)).toLocaleString('en-IN')} kg of headroom on ${uncertainty.worstAxle.label}.`,
    });
  }

  run.validation.issues.forEach(i => out.push({
    severity: i.severity,
    code: i.code,
    title: i.code.replace(/_/g, ' '),
    message: i.message,
    remedy: REMEDIES[i.code] || 'Review the placement manually before release.',
  }));

  dist.axles.forEach(a => {
    if (a.compliant) return;
    out.push({
      severity: 'critical',
      code: 'AXLE_OVERLOAD',
      title: `${a.label} overloaded`,
      message: `${a.loadKg.toLocaleString('en-IN')} kg against a ${a.limitKg.toLocaleString('en-IN')} kg ceiling (${a.governedBy}) — ${a.overloadKg.toLocaleString('en-IN')} kg over.`,
      remedy: correction
        ? `Move ${correction.candidates[0]?.huId || 'the heaviest base unit'} ${Math.abs(correction.candidates[0]?.shiftMm || 0)} mm ${correction.direction}. Statutory exposure ₹${overloadPenaltyInr(a.overloadKg).toLocaleString('en-IN')} under MV Act s.194.`
        : 'Reduce the consignment or redistribute mass toward the opposite axle group.',
    });
  });

  if (dist.gvwOverloadKg > 0) {
    out.push({
      severity: 'critical',
      code: 'GVW_OVERLOAD',
      title: 'Gross vehicle weight exceeded',
      message: `${dist.grossVehicleKg.toLocaleString('en-IN')} kg against a ${dist.gvwLimitKg.toLocaleString('en-IN')} kg GVW rating.`,
      remedy: 'Remove consignment lines until gross weight is inside the registration certificate rating.',
    });
  }

  if (!dist.cogInWindow) {
    out.push({
      severity: 'warning',
      code: 'COG_WINDOW',
      title: 'Centre of gravity outside the working window',
      message: `Longitudinal CoG at ${dist.cogFractionPct.toFixed(1)}% of deck length; working window is ${dist.cogWindowPct[0]}–${dist.cogWindowPct[1]}%.`,
      remedy: dist.cogFractionPct > dist.cogWindowPct[1]
        ? 'Rear-biased. Bring heavy base columns forward toward the bulkhead.'
        : 'Front-biased. Steer axle will run heavy and the drive axle will lose traction — shift mass rearward.',
    });
  }

  if (!dist.lateralBalanced) {
    out.push({
      severity: 'warning',
      code: 'LATERAL_IMBALANCE',
      title: 'Load is off the centreline',
      message: `Lateral CoG offset ${dist.cogLateralMm} mm (limit ±${dist.cogLateralLimitMm} mm). Left/right split ${dist.sideSplit.leftPct.toFixed(0)} / ${dist.sideSplit.rightPct.toFixed(0)}.`,
      remedy: 'Swap an outer column across the centreline. Off-centre loads overload one tyre set and bite on road camber.',
    });
  }

  if (!dist.rolloverSafe) {
    out.push({
      severity: 'warning',
      code: 'ROLLOVER_MARGIN',
      title: 'Static rollover threshold is low',
      message: `SRT ${dist.rolloverThresholdG} g against a ${dist.rolloverMinG} g working minimum (combined CoG height ${dist.combinedCogHeightMm} mm).`,
      remedy: 'Bring the heaviest units down to tier 1 and cap stack height. Advise the driver of a reduced cornering speed.',
    });
  }

  if (lifo.rehandlingEvents > 0) {
    out.push({
      severity: 'warning',
      code: 'SEQUENCE_BLOCKED',
      title: 'Unloading sequence requires re-handling',
      message: `${lifo.blockedCount} units are blocked by a later drop and ${lifo.buriedCount} are buried under one. Each re-handle costs dock time at the consignee.`,
      remedy: 'Enable sequence enforcement, or split the consignment across two vehicles by consignee.',
    });
  }

  run.rejected.forEach(r => out.push({
    severity: 'warning',
    code: `LEFT_BEHIND_${r.reason.toUpperCase()}`,
    title: `Not loaded: ${r.huId || r.colId}`,
    message: `${r.detail}.`,
    remedy: r.reason === 'payload'
      ? 'Payload exhausted — move this line to the next trip or a higher-rated vehicle.'
      : 'Deck space exhausted — the residual void cannot accept this footprint.',
  }));

  securing.warnings.forEach(w => out.push({
    severity: w.severity,
    code: w.code,
    title: w.code.replace(/_/g, ' '),
    message: w.message,
    remedy: 'Apply the securing schedule on the Load Securing tab before the vehicle leaves the bay.',
  }));

  if (capacity.payloadUtilPct < 75 && capacity.floorFreeM2 > 1.5) {
    out.push({
      severity: 'info',
      code: 'UNDERUTILISED',
      title: 'Vehicle is leaving under-filled',
      message: `${capacity.floorFreeM2.toFixed(1)} m² of deck floor and ${Math.round(capacity.payloadHeadroomKg).toLocaleString('en-IN')} kg of payload remain unused.`,
      remedy: 'Check the consolidation panel for backlog lines that fit the residual envelope.',
    });
  }

  const rank = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

const REMEDIES = {
  OUT_OF_BOUNDS: 'Reduce the stack tier or rotate the unit — it fouls the body envelope.',
  INTERSECTION: 'Geometric clash. Re-run the solver; do not load from this pattern.',
  UNSUPPORTED: 'Insufficient base support. Add a load-bearing platform or drop the unit to deck level.',
  CRUSH: 'The unit underneath is rated for zero superimposed load. Move the upper unit to the deck.',
  OVERLOAD_TOP: 'Reduce the stack to fewer tiers or re-stack with the heavier unit at the bottom.',
  FLOOR_ONLY: 'Class-A / HV packaging must stay at deck level. Re-plan with stacking disabled for this line.',
};

// ----------------------------------------------------------------------------
// CONSOLIDATION ADVISOR
// Which additional backlog lines genuinely fit the residual envelope?
// Tested by actually re-solving with the candidate added — no estimation.
// ----------------------------------------------------------------------------
export function recommendConsolidation(vehicleType, selectedOrders, candidateOrders, helpers, options = {}) {
  const vehicle = resolveVehicle(vehicleType);
  if (!vehicle) return [];

  const priorityRank = { critical: 0, high: 1, medium: 2, internal: 3 };
  const queue = [...candidateOrders].sort((a, b) =>
    (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9)
    || (a.dueTime || '').localeCompare(b.dueTime || ''));

  const accepted = [];
  let working = [...selectedOrders];

  // A reduced strategy set keeps the advisor interactive. A candidate is only
  // offered if it packs completely AND stays statutorily compliant.
  const probes = [
    { weightBias: 'heavyCentre', sortOrder: 'heavyFirst', blockOffsetFraction: 0 },
    { weightBias: 'heavyCentre', sortOrder: 'areaFirst', blockOffsetFraction: 0 },
    { weightBias: 'heavyFront', sortOrder: 'heavyFirst', blockOffsetFraction: 0 },
  ];

  queue.forEach(cand => {
    const trial = [...working, cand];
    const units = buildHandlingUnits(trial, { ...helpers, deckMaterial: vehicle.geometry.deckMaterial });
    resolveDropSequence(units, helpers);

    let fit = null;
    for (const probe of probes) {
      const run = packRun(vehicle, units, {
        enforceLifo: true,
        allowStacking: true,
        allowRotation: true,
        allowVoidRecovery: true,
        ...probe,
        ...options,
      });
      if (run.rejected.length > 0 || !run.validation.ok) continue;
      const dist = computeWeightDistribution(vehicle, run.placements);
      if (!dist.axleCompliant) continue;
      fit = { run, dist };
      break;
    }
    if (!fit) return;

    accepted.push({
      orderId: cand.id,
      priority: cand.priority,
      dueTime: cand.dueTime,
      customerId: cand.customerId,
      bins: cand.bins,
      weightKg: cand.weight,
      volumeM3: cand.volume,
      resultingPayloadPct: (fit.run.loadedKg / vehicle.payloadKg) * 100,
      resultingCogPct: fit.dist.cogFractionPct,
    });
    working = trial;
  });

  return accepted;
}

// ----------------------------------------------------------------------------
// Vehicle right-sizing: which asset in the fleet carries this consignment with
// the lowest cost per cubic metre while staying statutorily compliant?
// ----------------------------------------------------------------------------
export function rankVehicles(vehicleTypes, orders, helpers, options = {}) {
  return vehicleTypes
    .map(vt => {
      const plan = solveLoadPlan(vt, orders, helpers, options);
      if (!plan || plan.empty) return null;
      return {
        vehicleId: vt.id,
        name: vt.name,
        icon: vt.icon,
        payloadUtilPct: plan.kpi.payloadUtilPct,
        cubeOccupancyPct: plan.kpi.cubeOccupancyPct,
        floorUtilPct: plan.kpi.floorUtilPct,
        unitsRejected: plan.kpi.unitsRejected,
        axleCompliant: plan.distribution.axleCompliant,
        valid: plan.validation.ok,
        tripCostInr: plan.economics.tripCostInr,
        costPerM3Inr: plan.economics.costPerM3Inr,
        co2Kg: plan.economics.co2Kg,
        feasible: plan.kpi.unitsRejected === 0 && plan.distribution.axleCompliant && plan.validation.ok,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
      return a.costPerM3Inr - b.costPerM3Inr;
    });
}

// ----------------------------------------------------------------------------
// FLEET SPLIT
// When the bound proves one vehicle cannot take the consignment, the useful
// answer is not "it does not fit" but "here is the trip split". Each trip is a
// full solve, so every trip in the result is a verified, compliant load plan.
// ----------------------------------------------------------------------------
export function planFleetSplit(vehicleType, orders, helpers, options = {}, maxTrips = 5) {
  const trips = [];
  let remainingOrders = orders.map(o => ({ ...o }));

  for (let t = 0; t < maxTrips && remainingOrders.length; t += 1) {
    const plan = solveLoadPlan(vehicleType, remainingOrders, helpers,
      { ...options, uncertainty: false });
    if (!plan || plan.empty) break;

    const seatedByOrder = new Map();
    plan.placements.forEach(p => {
      seatedByOrder.set(p.orderId, (seatedByOrder.get(p.orderId) || 0) + 1);
    });

    if (seatedByOrder.size === 0) break;

    trips.push({
      trip: t + 1,
      orderLines: [...seatedByOrder.entries()].map(([orderId, bins]) => ({ orderId, bins })),
      unitsPlaced: plan.kpi.unitsPlaced,
      massKg: plan.distribution.cargoMassKg,
      payloadUtilPct: plan.kpi.payloadUtilPct,
      floorUtilPct: plan.kpi.floorUtilPct,
      axleCompliant: plan.distribution.axleCompliant,
      tripCostInr: plan.economics.tripCostInr,
      co2Kg: plan.economics.co2Kg,
    });

    // carry forward only what did not get seated, as reduced order lines
    const next = [];
    remainingOrders.forEach(o => {
      const seated = seatedByOrder.get(o.id) || 0;
      const left = (o.bins || 1) - seated;
      if (left <= 0) return;
      const ratio = left / (o.bins || 1);
      next.push({
        ...o,
        bins: left,
        weight: o.weight * ratio,
        volume: o.volume * ratio,
        quantity: Math.round((o.quantity || 0) * ratio),
      });
    });
    if (next.length === remainingOrders.length
      && next.every((o, i) => o.bins === remainingOrders[i].bins)) break; // no progress
    remainingOrders = next;
  }

  const totalCost = trips.reduce((s, t) => s + t.tripCostInr, 0);
  return {
    trips,
    tripsRequired: trips.length,
    unplaced: remainingOrders,
    totalCostInr: totalCost,
    totalCo2Kg: trips.reduce((s, t) => s + t.co2Kg, 0),
    complete: remainingOrders.length === 0,
  };
}

// ----------------------------------------------------------------------------
// RECOMMENDATION SYNTHESIS
// Every analytic in this engine produces numbers; this turns them into a short
// ranked list of things to actually do, with the expected effect stated. It is
// deliberately conservative: it only proposes an action when the supporting
// figure justifies it.
// ----------------------------------------------------------------------------
export function buildRecommendations(plan, context = {}) {
  if (!plan || plan.empty) return [];
  const recs = [];
  const { tightness, bounds, uncertainty, distribution: d, kpi, capacity, deckCheck, lifo } = plan;
  const { consolidation = [], ranking = [] } = context;

  // 1. Hard blockers first
  if (bounds.secondVehicleProvable) {
    recs.push({
      rank: 1,
      kind: 'blocker',
      title: `Split across ${bounds.minVehicles} trips`,
      why: `${bounds.bindingResource} alone reaches ${bounds.continuousBound.toFixed(2)} vehicle loads. No packing method fits this on one ${plan.vehicle.name}.`,
      action: 'Open the fleet split to see the verified per-trip plans.',
    });
  }

  d.axles.filter(a => !a.compliant).forEach(a => {
    const corr = plan.axleCorrection?.candidates?.[0];
    recs.push({
      rank: 1,
      kind: 'blocker',
      title: `${a.label} is ${a.overloadKg.toLocaleString('en-IN')} kg over`,
      why: `Reading ${a.loadKg.toLocaleString('en-IN')} kg against a ${a.limitKg.toLocaleString('en-IN')} kg ceiling (${a.governedBy}). Exposure ${inrFmt(overloadPenaltyInr(a.overloadKg))} under MV Act s.194.`,
      action: corr
        ? `Move ${corr.huId} (${corr.grossKg} kg) ${Math.abs(corr.shiftMm)} mm ${plan.axleCorrection.direction}.`
        : 'Redistribute mass toward the opposite axle group.',
    });
  });

  // 2. Risk that the declared figures hide
  if (uncertainty && uncertainty.verdict.level !== 'ok') {
    const w = uncertainty.worstAxle;
    recs.push({
      rank: 2,
      kind: 'risk',
      title: `Plan to ${Math.round(w.p99).toLocaleString('en-IN')} kg on ${w.label}, not ${Math.round(w.mean).toLocaleString('en-IN')} kg`,
      why: `Across ${uncertainty.scenarios.toLocaleString('en-IN')} mass scenarios the gate weighbridge breaches a limit in ${(uncertainty.anyBreachProb * 100).toFixed(1)}% of cases.`,
      action: `Leave ${Math.max(0, Math.round(w.p99 - w.mean)).toLocaleString('en-IN')} kg of planned headroom on ${w.label}.`,
    });
  }

  // 3. Capacity left on the table
  if (consolidation.length > 0) {
    const addMass = consolidation.reduce((s, c) => s + c.weightKg, 0);
    recs.push({
      rank: 3,
      kind: 'opportunity',
      title: `${consolidation.length} more backlog line${consolidation.length > 1 ? 's' : ''} fit`,
      why: `${capacity.floorFreeM2.toFixed(1)} m² of floor and ${Math.round(kpi.payloadHeadroomKg).toLocaleString('en-IN')} kg of payload are unused. Re-solved with the candidates added, the plan stays compliant.`,
      action: `Add ${consolidation.map(c => c.orderId.split('-').pop()).join(', ')} — ${(addMass / 1000).toFixed(2)} t more on the same trip.`,
    });
  }

  // 4. Packing quality against the bound
  if (bounds.allSeated && bounds.areaGapPct !== null && bounds.areaGapPct > 20 && capacity.floorFreeM2 > 1) {
    const binding = tightness.binding;
    recs.push({
      rank: 4,
      kind: 'tuning',
      title: `Pattern is ${bounds.areaGapPct.toFixed(0)}% above the area bound`,
      why: `${bounds.placedFootprintM2.toFixed(1)} m² consumed against a provable ${bounds.minFloorAreaM2.toFixed(1)} m². The tightest resource is ${binding.label.toLowerCase()} at ${binding.utilPct.toFixed(0)}%.`,
      action: capacity.heightHeadroomMm > 300
        ? `There is ${capacity.heightHeadroomMm} mm of headroom left — raising the stack tier rating on the governing packaging would recover floor area.`
        : 'Clear height is used up; the remaining gap is packaging geometry, not solver choice.',
    });
  }

  // 5. Right-sizing
  const better = ranking.find(r => r.feasible && r.vehicleId !== plan.vehicle.id
    && r.costPerM3Inr < plan.economics.costPerM3Inr * 0.9);
  if (better) {
    recs.push({
      rank: 5,
      kind: 'opportunity',
      title: `${better.name} carries this at ${inrFmt(better.costPerM3Inr)}/m³`,
      why: `Current asset costs ${inrFmt(plan.economics.costPerM3Inr)}/m³ at ${kpi.payloadUtilPct.toFixed(0)}% payload. The alternative takes the full load within its axle ratings.`,
      action: `Switch to ${better.name} and save ${inrFmt(plan.economics.tripCostInr - better.tripCostInr)} on this trip.`,
    });
  }

  // 6. Structural
  if (deckCheck && !deckCheck.ok) {
    recs.push({
      rank: 2,
      kind: 'risk',
      title: 'Deck structural rating exceeded',
      why: deckCheck.issues[0].message,
      action: 'Fit a bearing plate under the governing stack or drop it by one tier.',
    });
  }

  // 7. Sequence
  if (lifo.rehandlingEvents > 0) {
    recs.push({
      rank: 4,
      kind: 'tuning',
      title: `${lifo.rehandlingEvents} re-handles at the consignee`,
      why: 'Units of an earlier drop are blocked or buried by a later drop, so freight must come off and go back on.',
      action: 'Enable drop-sequence enforcement, or split the consignment by consignee.',
    });
  }

  // 8. Stability margin
  if (!d.rolloverSafe || !d.lateralBalanced) {
    recs.push({
      rank: 2,
      kind: 'risk',
      title: !d.rolloverSafe ? `Rollover threshold is ${d.rolloverThresholdG} g` : `Load sits ${d.cogLateralMm} mm off the centreline`,
      why: !d.rolloverSafe
        ? `Combined centre of gravity ${d.combinedCogHeightMm} mm high on a ${d.trackWidthMm} mm track, against a ${d.rolloverMinG} g working minimum.`
        : `Left/right split ${d.sideSplit.leftPct.toFixed(0)}/${d.sideSplit.rightPct.toFixed(0)} against a ±${d.cogLateralLimitMm} mm tolerance.`,
      action: !d.rolloverSafe
        ? 'Bring the heaviest units down to tier 1 and advise a reduced cornering speed.'
        : 'Swap an outer column across the centreline.',
    });
  }

  if (recs.length === 0) {
    recs.push({
      rank: 9,
      kind: 'clear',
      title: 'Nothing to improve on this plan',
      why: `All ${kpi.unitsPlaced} units seated, every statutory limit satisfied, ${bounds.areaGapPct !== null ? `${bounds.areaGapPct.toFixed(0)}% from the area bound` : 'bound satisfied'}, and robust to declared-mass error.`,
      action: 'Release to the dock.',
    });
  }

  return recs.sort((a, b) => a.rank - b.rank);
}

function inrFmt(n) {
  return `\u20b9${Math.round(n || 0).toLocaleString('en-IN')}`;
}
