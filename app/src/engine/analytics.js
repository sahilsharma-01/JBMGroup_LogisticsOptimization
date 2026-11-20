// ============================================================================
// JBM LoadIQ — LOAD PLAN ANALYTICS
// ----------------------------------------------------------------------------
// Diagnostics that turn a solved pattern into decisions:
//
//   • DECK STRUCTURAL CHECK   Distributed and point-contact pressure against
//                             the floor rating. A stillage bears on four feet,
//                             so the pressure at the foot is what punches
//                             through a plywood deck — the nominal footprint
//                             pressure is roughly an order of magnitude lower
//                             and will never flag the failure.
//
//   • MASS DISTRIBUTION       Mass per bay, with each bay's axle influence
//                             coefficient alongside it, so the planner can see
//                             which bay is costing which axle.
//
//   • CONSTRAINT TIGHTNESS    Every limit on one normalised scale, so the
//                             binding constraint is obvious and the slack on
//                             the others is quantified.
//
//   • PARETO SET              The solver's candidates plotted as packing
//                             quality against axle margin, showing what was
//                             traded away and what was simply dominated.
// ============================================================================

import { axleInfluence } from './physics.js';
import { describe } from './robustness.js';

const BAY_PITCH_MM = 1200;

// ----------------------------------------------------------------------------
// Deck structural check
// ----------------------------------------------------------------------------
export function deckLoadCheck(vehicle, placements) {
  const ratings = vehicle.deckRatings;
  const issues = [];

  // Group placements into vertical stacks: the bottom unit carries the column.
  const columns = new Map();
  placements.forEach(p => {
    const key = `${p.x}:${p.z}`;
    if (!columns.has(key)) columns.set(key, []);
    columns.get(key).push(p);
  });

  const stacks = [...columns.values()].map(units => {
    const sorted = [...units].sort((a, b) => a.y - b.y);
    const base = sorted[0];
    const stackKg = sorted.reduce((s, u) => s + u.grossKg, 0);
    const footprintM2 = (base.l * base.w) / 1e6;
    const contactM2 = (base.contactPoints * base.contactAreaCm2) / 1e4;
    return {
      key: `${base.x}:${base.z}`,
      baseHuId: base.huId,
      packagingCode: base.packagingCode,
      tiers: sorted.length,
      stackKg,
      distributedKgPerM2: stackKg / footprintM2,
      perContactKg: stackKg / Math.max(base.contactPoints, 1),
      contactPressureKgPerCm2: stackKg / Math.max(base.contactPoints * base.contactAreaCm2, 1),
      contactPoints: base.contactPoints,
      contactAreaCm2: base.contactAreaCm2,
      footprintM2,
      contactM2,
      x: base.x,
      z: base.z,
    };
  });

  stacks.forEach(s => {
    if (s.distributedKgPerM2 > ratings.distributedKgPerM2) {
      issues.push({
        severity: 'warning',
        code: 'DECK_DISTRIBUTED',
        huId: s.baseHuId,
        message: `Stack at x${s.x}/z${s.z} applies ${Math.round(s.distributedKgPerM2)} kg/m² against a ${ratings.distributedKgPerM2} kg/m² deck rating.`,
      });
    }
    if (s.perContactKg > ratings.pointLoadKgPerContact) {
      issues.push({
        severity: 'warning',
        code: 'DECK_POINT_LOAD',
        huId: s.baseHuId,
        message: `${Math.round(s.perContactKg)} kg bears on each of ${s.contactPoints} feet at x${s.x}/z${s.z}, against a ${ratings.pointLoadKgPerContact} kg point rating. Spread the load with a steel plate or drop a tier.`,
      });
    }
  });

  const distributedStats = describe(stacks.map(s => s.distributedKgPerM2));
  const contactStats = describe(stacks.map(s => s.perContactKg));

  return {
    ratings,
    stacks: stacks.sort((a, b) => b.perContactKg - a.perContactKg),
    distributedStats,
    contactStats,
    worstDistributedPct: distributedStats ? (distributedStats.max / ratings.distributedKgPerM2) * 100 : 0,
    worstContactPct: contactStats ? (contactStats.max / ratings.pointLoadKgPerContact) * 100 : 0,
    issues,
    ok: issues.length === 0,
  };
}

// ----------------------------------------------------------------------------
// Mass distribution along the deck, with axle influence per bay
// ----------------------------------------------------------------------------
export function massProfile(vehicle, placements) {
  const L = vehicle.deck.lengthMm;
  const bayCount = Math.ceil(L / BAY_PITCH_MM);
  const bays = Array.from({ length: bayCount }, (_, i) => {
    const x0 = i * BAY_PITCH_MM;
    const x1 = Math.min(L, x0 + BAY_PITCH_MM);
    const centre = (x0 + x1) / 2;
    const infl = axleInfluence(vehicle, centre);
    return { bay: i + 1, x0, x1, centre, massKg: 0, units: 0, infl };
  });

  // mass is apportioned across the bays a unit actually spans
  placements.forEach(p => {
    const span = p.l;
    bays.forEach(b => {
      const overlap = Math.min(p.x + p.l, b.x1) - Math.max(p.x, b.x0);
      if (overlap <= 0) return;
      b.massKg += p.grossKg * (overlap / span);
      b.units += overlap / span;
    });
  });

  const total = bays.reduce((s, b) => s + b.massKg, 0);
  bays.forEach(b => {
    b.sharePct = total > 0 ? (b.massKg / total) * 100 : 0;
    b.units = Math.round(b.units * 10) / 10;
    // what this bay contributes to each axle group
    b.contribution = Object.fromEntries(
      Object.entries(b.infl).map(([id, c]) => [id, c * b.massKg]),
    );
  });

  return {
    bayPitchMm: BAY_PITCH_MM,
    bays,
    totalKg: total,
    peakBay: bays.reduce((m, b) => (b.massKg > (m?.massKg ?? -1) ? b : m), null),
  };
}

// ----------------------------------------------------------------------------
// Constraint tightness — every limit on one normalised scale
// ----------------------------------------------------------------------------
export function constraintTightness(plan) {
  const { vehicle, distribution: d, kpi, capacity, securing } = plan;
  const rows = [];

  rows.push({
    id: 'payload',
    label: 'Payload',
    utilPct: kpi.payloadUtilPct,
    detail: `${Math.round(d.cargoMassKg).toLocaleString('en-IN')} / ${vehicle.payloadKg.toLocaleString('en-IN')} kg`,
    slack: `${Math.round(kpi.payloadHeadroomKg).toLocaleString('en-IN')} kg spare`,
    hard: true,
  });
  rows.push({
    id: 'gvw',
    label: 'Gross vehicle weight',
    utilPct: d.gvwUtilPct,
    detail: `${Math.round(d.grossVehicleKg).toLocaleString('en-IN')} / ${vehicle.gvwKg.toLocaleString('en-IN')} kg`,
    slack: `${Math.round(vehicle.gvwKg - d.grossVehicleKg).toLocaleString('en-IN')} kg spare`,
    hard: true,
  });
  d.axles.forEach(a => rows.push({
    id: `axle-${a.id}`,
    label: a.label,
    utilPct: a.utilPct,
    detail: `${a.loadKg.toLocaleString('en-IN')} / ${a.limitKg.toLocaleString('en-IN')} kg`,
    slack: `${(a.limitKg - a.loadKg).toLocaleString('en-IN')} kg spare`,
    hard: true,
  }));
  rows.push({
    id: 'floor',
    label: 'Deck floor area',
    utilPct: kpi.floorUtilPct,
    detail: `${(vehicle.deckAreaM2 - capacity.floorFreeM2).toFixed(1)} / ${vehicle.deckAreaM2.toFixed(1)} m²`,
    slack: `${capacity.floorFreeM2.toFixed(2)} m² free`,
    hard: true,
  });
  rows.push({
    id: 'height',
    label: 'Clear internal height',
    utilPct: (capacity.maxStackHeightMm / vehicle.deck.heightMm) * 100,
    detail: `${capacity.maxStackHeightMm} / ${vehicle.deck.heightMm} mm`,
    slack: `${capacity.heightHeadroomMm} mm headroom`,
    hard: true,
  });
  rows.push({
    id: 'cube',
    label: 'Cube occupancy',
    utilPct: kpi.cubeOccupancyPct,
    detail: `${capacity.goodsVolumeM3.toFixed(1)} / ${vehicle.deckVolumeM3.toFixed(1)} m³`,
    slack: `${(vehicle.deckVolumeM3 - capacity.goodsVolumeM3).toFixed(1)} m³ of air`,
    hard: false,
  });
  rows.push({
    id: 'lateral',
    label: 'Lateral CoG offset',
    utilPct: (Math.abs(d.cogLateralMm) / Math.max(d.cogLateralLimitMm, 1)) * 100,
    detail: `${d.cogLateralMm} / ±${d.cogLateralLimitMm} mm`,
    slack: `${d.cogLateralLimitMm - Math.abs(d.cogLateralMm)} mm margin`,
    hard: true,
  });
  rows.push({
    id: 'rollover',
    label: 'Rollover threshold',
    utilPct: (d.rolloverMinG / Math.max(d.rolloverThresholdG, 0.01)) * 100,
    detail: `${d.rolloverThresholdG} g vs ${d.rolloverMinG} g minimum`,
    slack: `${(d.rolloverThresholdG - d.rolloverMinG).toFixed(2)} g margin`,
    hard: true,
  });
  rows.push({
    id: 'bulkhead',
    label: 'Bulkhead blocking',
    utilPct: (securing.bulkheadDemandKg / Math.max(securing.frontWallCapacityKg, 1)) * 100,
    detail: `${securing.bulkheadDemandKg.toLocaleString('en-IN')} / ${securing.frontWallCapacityKg.toLocaleString('en-IN')} kgf`,
    slack: `${(securing.frontWallCapacityKg - securing.bulkheadDemandKg).toLocaleString('en-IN')} kgf spare`,
    hard: true,
  });

  const sorted = [...rows].sort((a, b) => b.utilPct - a.utilPct);
  return {
    rows: sorted,
    binding: sorted[0],
    // anything above 90% is effectively binding once uncertainty is allowed for
    nearBinding: sorted.filter(r => r.utilPct >= 90),
  };
}

// ----------------------------------------------------------------------------
// Pareto set over the solver's candidates
// ----------------------------------------------------------------------------
export function paretoSet(trials) {
  const points = trials.map(t => ({
    ...t,
    // objectives: maximise compactness, maximise axle margin
    compactnessPct: (t.compactness || 0) * 100,
    axleMarginPct: 100 - (t.worstAxleUtilPct ?? 100),
  }));

  points.forEach(p => {
    p.dominated = points.some(q =>
      q !== p
      && q.feasible === p.feasible
      && q.compactnessPct >= p.compactnessPct
      && q.axleMarginPct >= p.axleMarginPct
      && (q.compactnessPct > p.compactnessPct || q.axleMarginPct > p.axleMarginPct));
  });

  return points;
}

// ----------------------------------------------------------------------------
// Per-unit deck pressure distribution, for the stats panel
// ----------------------------------------------------------------------------
export function pressureStats(placements) {
  const values = placements.map(p => p.grossKg / ((p.l * p.w) / 1e6));
  return { stats: describe(values), values };
}

/**
 * Marginal economics: what the next cubic metre and the next tonne cost on
 * this trip, and what the step change is if a second vehicle is needed.
 */
export function marginalEconomics(plan) {
  const e = plan.economics;
  const c = plan.capacity;
  const unitsPerM3 = c.goodsVolumeM3 > 0 ? plan.kpi.unitsPlaced / c.goodsVolumeM3 : 0;
  return {
    costPerM3Inr: e.costPerM3Inr,
    costPerTonneInr: e.costPerTonneInr,
    costPerUnitInr: e.costPerUnitInr,
    // marginal cost of loading nothing extra: the fixed cost already sunk
    sunkFixedInr: e.fixedInr + e.tollInr,
    marginalFuelPerTonneKmInr: e.roundTripKm > 0 && plan.distribution.cargoMassKg > 0
      ? (e.fuelInr / ((plan.distribution.cargoMassKg / 1000) * e.roundTripKm))
      : 0,
    // what the residual space is worth if it were filled to the floor bound
    residualValueInr: c.floorFreeM2 > 0 && c.goodsVolumeM3 > 0
      ? Math.round((c.floorFreeM2 / Math.max(plan.vehicle.deckAreaM2 - c.floorFreeM2, 0.01)) * e.tripCostInr)
      : 0,
    unitsPerM3,
    secondVehicleStepInr: e.tripCostInr,
  };
}
