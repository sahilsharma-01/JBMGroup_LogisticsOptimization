// ============================================================================
// JBM LoadIQ — UNCERTAINTY ANALYSIS
// ----------------------------------------------------------------------------
// A load plan that sits at 99.4% of the drive-axle limit is not compliant in
// any useful sense. Declared masses are estimates, and the weighbridge at the
// gate measures the real thing. This module quantifies the difference.
//
// METHOD
// Monte Carlo over the mass vector, with the axle reaction evaluated exactly
// rather than re-solved. Because a reaction is linear in the masses,
//
//     R_g = T_g + Σᵢ cᵢ,g · mᵢ
//
// where cᵢ,g is the influence coefficient of unit i on axle group g and T_g is
// the chassis tare contribution, a perturbed scenario costs one dot product.
// 20,000 scenarios run in a few milliseconds, so the distribution is resolved
// well into the tail instead of being approximated by a safety factor.
//
// SOURCES OF SPREAD MODELLED
//   1a. Batch bias      a single correlated offset per part number, shared by
//                       every unit of that part. This is the term that matters:
//                       independent per-unit error averages out as 1/sqrt(n),
//                       so on a 40-unit load it is nearly invisible, whereas a
//                       coil lot running at the top of its thickness tolerance
//                       makes every unit heavy at once and moves the axle
//                       reading by a full percent. A model with only
//                       independent noise understates the real risk badly.
//   1b. Part mass       lognormal idiosyncratic error about the batch mean,
//                       CV by part family (weld deposition, residual pressing
//                       oil, trim variation).
//   2. Packaging tare   one-sided positive drift on returnable packaging —
//                       dirt, water and damage only ever add mass.
//   3. Pick error       a small probability of one piece over or short in a
//                       container, which is the dominant error on high-count
//                       KLT lines.
//   4. Weighbridge      the measurement error the vehicle is actually judged
//                       on at the gate, applied on top of the true mass.
//
// The generator is seeded, so the same plan always yields the same figures.
// Analytics that jitter on every render do not get trusted or used.
// ============================================================================

import { MASS_VARIANCE_CV } from './specs.js';
import { axleInfluence, tareAxleLoads } from './physics.js';

/** mulberry32 — small, fast, well-distributed, and reproducible. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller, one normal per call (the spare is cheap enough to discard). */
function normal(rand) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function quantile(sortedArr, q) {
  if (!sortedArr.length) return 0;
  const pos = (sortedArr.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedArr[lo];
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (pos - lo);
}

export function describe(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n > 1 ? n - 1 : 1);
  return {
    n,
    mean,
    sd: Math.sqrt(variance),
    min: sorted[0],
    max: sorted[n - 1],
    p05: quantile(sorted, 0.05),
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
  };
}

export function histogram(values, bins = 22) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = span / bins;
  const counts = new Array(bins).fill(0);
  values.forEach(v => {
    const i = Math.min(bins - 1, Math.floor((v - min) / width));
    counts[i] += 1;
  });
  return counts.map((count, i) => ({
    x0: min + i * width,
    x1: min + (i + 1) * width,
    count,
    density: count / values.length,
  }));
}

export const UNCERTAINTY_DEFAULTS = {
  scenarios: 6000,
  batchBiasCv: 0.015,     // correlated offset per part number (coil lot)
  tareDriftPct: 2.5,       // max positive drift on returnable packaging mass
  pickErrorProb: 0.02,     // per container, chance of one piece over/short
  weighbridgeErrorPct: 1.0, // full-scale accuracy class of the gate weighbridge
  seed: 20261031,
};

/**
 * @param {object} vehicle    resolved vehicle
 * @param {Array}  placements solved placements (position fixes the influence)
 * @param {object} opts       see UNCERTAINTY_DEFAULTS
 */
export function analyseUncertainty(vehicle, placements, opts = {}) {
  const cfg = { ...UNCERTAINTY_DEFAULTS, ...opts };
  if (!placements.length) return null;

  const tare = tareAxleLoads(vehicle);
  const groupIds = vehicle.axleGroups.map(a => a.id);
  const limits = Object.fromEntries(vehicle.axleGroups.map(a => [a.id, a.limitKg]));

  // Precompute the per-unit influence coefficients and spread parameters.
  const model = placements.map(p => {
    const xCentre = p.x + p.l / 2;
    const infl = axleInfluence(vehicle, xCentre);
    const cv = MASS_VARIANCE_CV[p.partCategory] ?? MASS_VARIANCE_CV.default;
    const pieces = Math.max(1, p.pieces || 1);
    const netKg = Math.max(0, p.grossKg - (p.tareKg || 0));
    return {
      infl,
      xCentre,
      partId: p.partId,
      grossKg: p.grossKg,
      tareKg: p.tareKg || 0,
      netKg,
      perPieceKg: netKg / pieces,
      cv,
      isReturnAsset: Boolean(p.isReturnAsset),
    };
  });

  const partIds = [...new Set(placements.map(p => p.partId))];
  const rand = rng(cfg.seed);
  const n = cfg.scenarios;
  const series = Object.fromEntries(groupIds.map(id => [id, new Float64Array(n)]));
  const gross = new Float64Array(n);
  const cogPct = new Float64Array(n);
  const deckL = vehicle.deck.lengthMm;

  let breaches = 0;
  const perGroupBreaches = Object.fromEntries(groupIds.map(id => [id, 0]));

  for (let s = 0; s < n; s += 1) {
    const acc = Object.fromEntries(groupIds.map(id => [id, tare[id] || 0]));
    let cargo = 0;
    let moment = 0;

    // 1a. one correlated batch offset per part number for this scenario
    const batch = {};
    partIds.forEach(id => {
      batch[id] = Math.exp(cfg.batchBiasCv * normal(rand) - (cfg.batchBiasCv ** 2) / 2);
    });

    for (let i = 0; i < model.length; i += 1) {
      const m = model[i];

      // 1b. idiosyncratic error about the batch mean; lognormal keeps the
      //     sample positive and right-skewed, as material variation is
      let mass = m.netKg * batch[m.partId] * Math.exp(m.cv * normal(rand) - (m.cv * m.cv) / 2);

      // 2. returnable packaging only ever gains mass in service
      const drift = m.isReturnAsset || m.tareKg > 0
        ? m.tareKg * (cfg.tareDriftPct / 100) * rand()
        : 0;
      mass += m.tareKg + drift;

      // 3. pick error: one piece over or short
      if (rand() < cfg.pickErrorProb) {
        mass += m.perPieceKg * (rand() < 0.5 ? -1 : 1);
      }

      cargo += mass;
      moment += mass * m.xCentre;
      groupIds.forEach(id => { acc[id] += (m.infl[id] || 0) * mass; });
    }

    // 4. the gate weighbridge reads the true mass with its own error
    const wbError = 1 + (cfg.weighbridgeErrorPct / 100) * normal(rand) * 0.5;

    let anyBreach = false;
    groupIds.forEach(id => {
      const reading = acc[id] * wbError;
      series[id][s] = reading;
      if (reading > limits[id]) { perGroupBreaches[id] += 1; anyBreach = true; }
    });

    gross[s] = (vehicle.tareKg + cargo) * wbError;
    cogPct[s] = cargo > 0 ? ((moment / cargo) / deckL) * 100 : 0;
    if (gross[s] > vehicle.gvwKg) anyBreach = true;
    if (anyBreach) breaches += 1;
  }

  const axles = vehicle.axleGroups.map(a => {
    const arr = Array.from(series[a.id]);
    const st = describe(arr);
    return {
      id: a.id,
      label: a.label,
      limitKg: a.limitKg,
      ...st,
      utilMeanPct: (st.mean / a.limitKg) * 100,
      utilP99Pct: (st.p99 / a.limitKg) * 100,
      breachProb: perGroupBreaches[a.id] / n,
      // the headroom a planner should actually plan to, not the nominal one
      headroomP99Kg: a.limitKg - st.p99,
      histogram: histogram(arr, 24),
    };
  });

  const grossStats = describe(Array.from(gross));
  const cogStats = describe(Array.from(cogPct));

  return {
    scenarios: n,
    config: cfg,
    partIds: partIds.length,
    axles,
    gross: {
      ...grossStats,
      limitKg: vehicle.gvwKg,
      breachProb: Array.from(gross).filter(v => v > vehicle.gvwKg).length / n,
      histogram: histogram(Array.from(gross), 24),
    },
    cogPct: cogStats,
    anyBreachProb: breaches / n,
    // the single number to put in front of a transport manager
    worstAxle: axles.reduce((w, a) => (a.utilP99Pct > (w?.utilP99Pct ?? -1) ? a : w), null),
    verdict: (() => {
      const p = breaches / n;
      if (p === 0) return { level: 'ok', text: 'No statutory breach in any scenario. The plan is robust to declared-mass error.' };
      if (p < 0.01) return { level: 'watch', text: `Breach in ${(p * 100).toFixed(2)}% of scenarios — marginal. Tighten the binding axle before this becomes a routine lane.` };
      if (p < 0.1) return { level: 'warn', text: `Breach in ${(p * 100).toFixed(1)}% of scenarios. Roughly one vehicle in ${Math.round(1 / p)} will weigh in over the limit.` };
      return { level: 'bad', text: `Breach in ${(p * 100).toFixed(0)}% of scenarios. This plan is not compliant in practice regardless of the declared figures.` };
    })(),
  };
}
