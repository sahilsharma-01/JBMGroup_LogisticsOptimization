// ============================================================================
// JBM LoadIQ — PROVABLE BOUNDS AND OPTIMALITY GAP
// ----------------------------------------------------------------------------
// A utilisation percentage on its own says nothing about whether a load plan is
// any good: 62% cube may be the mathematical maximum for a given order mix, or
// it may be a sloppy pattern wasting a third of the deck. The difference is
// only visible against a bound.
//
// Three relaxations of the container loading problem are computed here. Each
// drops the geometry and keeps one resource, so each is a genuine lower bound
// on the number of vehicles (and on the deck area) that the consignment needs.
// No feasible plan can beat them.
//
//   L1  CUBE        ⌈ Σ vᵢ / V_deck ⌉
//                   Items are treated as pourable. Ignores shape entirely.
//
//   L2  MASS        ⌈ Σ mᵢ / payload ⌉
//
//   L3  FLOOR AREA  The resource that actually binds on stillage freight, which
//                   runs out of floor long before it runs out of cube.
//
//                     A_min = Σ_{floor-only} aᵢ  +  Σ_{stackable} vᵢ / H_deck
//
//                   The second term is the volume bound projected onto the
//                   floor: at any point of the deck a column is at most H tall,
//                   so the goods volume divided by H can never exceed the floor
//                   area consumed. The first term is exact for packaging rated
//                   at zero superimposed load — nothing may go above it, so the
//                   airspace over its footprint is unusable and its full
//                   footprint is consumed.
//
//                   A per-item tier-count bound (aᵢ / tᵢ) is tempting and is
//                   what most tools use, but it is *not* a valid bound: a
//                   single column can carry a mixed-height stack — two 950 mm
//                   stillages plus two 300 mm collapsed stillages in the same
//                   footprint — which beats any per-item tier ceiling. The
//                   volume-over-height form is weaker but sound, and a bound
//                   that can be violated is worse than no bound at all.
//
// The reported optimality gap is measured against L3 expressed as a deck
// length, which is the quantity a planner can see and verify on the sheet.
// ============================================================================

export function tierCeiling(unit, clearHeightMm) {
  if (unit.floorOnly) return 1;
  const byHeight = Math.max(1, Math.floor(clearHeightMm / unit.h));
  const byCrush = unit.topLoadCapacityKg > 0
    ? 1 + Math.floor(unit.topLoadCapacityKg / Math.max(unit.grossKg, 1))
    : 1;
  return Math.max(1, Math.min(unit.maxTiers, byHeight, byCrush));
}

export function computeBounds(vehicle, units, placements = []) {
  const deck = vehicle.deck;
  const deckVolumeM3 = vehicle.deckVolumeM3;
  const deckAreaM2 = vehicle.deckAreaM2;

  const totalVolumeM3 = units.reduce((s, u) => s + u.volumeM3, 0);
  const totalMassKg = units.reduce((s, u) => s + u.grossKg, 0);

  // L3 — floor area: exact footprint for floor-only packaging, volume over
  // clear height for anything that can be built upon.
  let minFloorAreaM2 = 0;
  let floorOnlyAreaM2 = 0;
  let stackableAreaM2 = 0;
  const tierDetail = new Map();
  units.forEach(u => {
    const t = tierCeiling(u, deck.heightMm);
    if (u.floorOnly) {
      floorOnlyAreaM2 += u.footprintM2;
    } else {
      stackableAreaM2 += u.volumeM3 / (deck.heightMm / 1000);
    }
    const key = `${u.packagingCode}@${u.l}x${u.w}x${u.h}`;
    if (!tierDetail.has(key)) {
      tierDetail.set(key, {
        key,
        packagingCode: u.packagingCode,
        footprintM2: u.footprintM2,
        heightMm: u.h,
        tierCeiling: t,
        limitedBy: t === 1 && u.floorOnly ? 'floor-only packaging'
          : t === u.maxTiers ? 'packaging tier rating'
            : t === Math.floor(deck.heightMm / u.h) ? 'clear internal height'
              : 'rated superimposed load',
        units: 0,
      });
    }
    tierDetail.get(key).units += 1;
  });
  minFloorAreaM2 = floorOnlyAreaM2 + stackableAreaM2;

  const L1 = totalVolumeM3 / deckVolumeM3;
  const L2 = totalMassKg / vehicle.payloadKg;
  const L3 = minFloorAreaM2 / deckAreaM2;
  const continuousBound = Math.max(L1, L2, L3);
  const EPS = 1e-6;
  // L3 subsumes L1 by construction, so only call out floor area when the
  // floor-only term is what lifts it above the plain cube bound.
  const bindingResource = Math.abs(continuousBound - L2) < EPS ? 'payload'
    : L3 > L1 + EPS ? 'floor area'
      : 'cube';

  const minVehicles = Math.max(1, Math.ceil(continuousBound - 1e-9));

  // achieved geometry
  const placedFootprintM2 = (() => {
    // area of the floor footprint actually consumed, counting each (x,z)
    // column once no matter how many tiers sit on it
    const seen = new Set();
    let a = 0;
    placements.forEach(p => {
      const key = `${p.x}:${p.z}:${p.l}:${p.w}`;
      if (seen.has(key)) return;
      seen.add(key);
      a += (p.l * p.w) / 1e6;
    });
    return a;
  })();

  const minEnvelopeLengthMm = (minFloorAreaM2 * 1e6) / deck.widthMm;
  const envelopeLengthMm = placements.length
    ? Math.max(...placements.map(p => p.x + p.l)) - Math.min(...placements.map(p => p.x))
    : 0;

  // Gap is only meaningful when the whole consignment was seated; otherwise
  // the bound refers to freight that is not on the vehicle.
  const allSeated = placements.length === units.length;
  const areaGapPct = allSeated && minFloorAreaM2 > 0
    ? ((placedFootprintM2 - minFloorAreaM2) / minFloorAreaM2) * 100
    : null;
  const lengthGapPct = allSeated && minEnvelopeLengthMm > 0
    ? ((envelopeLengthMm - minEnvelopeLengthMm) / minEnvelopeLengthMm) * 100
    : null;

  return {
    totalVolumeM3,
    totalMassKg,
    deckVolumeM3,
    deckAreaM2,

    cubeBound: L1,
    massBound: L2,
    floorAreaBound: L3,
    floorOnlyAreaM2,
    stackableAreaM2,
    continuousBound,
    bindingResource,
    minVehicles,
    secondVehicleProvable: minVehicles > 1,

    minFloorAreaM2,
    placedFootprintM2,
    minEnvelopeLengthMm: Math.round(minEnvelopeLengthMm),
    envelopeLengthMm: Math.round(envelopeLengthMm),

    areaGapPct,
    lengthGapPct,
    // efficiency against the bound, capped at 100% by construction
    areaEfficiencyPct: allSeated && placedFootprintM2 > 0
      ? (minFloorAreaM2 / placedFootprintM2) * 100
      : null,
    allSeated,

    tierDetail: [...tierDetail.values()].sort((a, b) => b.units - a.units),
  };
}

/**
 * Explains, in one sentence, what is actually limiting this consignment.
 * Written to be pasted into a shift handover note.
 */
export function boundsVerdict(bounds, vehicle) {
  if (bounds.secondVehicleProvable) {
    return `${bounds.minVehicles} vehicles are provably required: ${bounds.bindingResource} alone reaches `
      + `${bounds.continuousBound.toFixed(2)} vehicle loads. No packing method can fit this consignment on one ${vehicle.name}.`;
  }
  if (!bounds.allSeated) {
    return `The consignment fits one vehicle in principle (${bounds.bindingResource} bound `
      + `${(bounds.continuousBound * 100).toFixed(0)}% of one load) but the solver could not seat every unit — `
      + `the shortfall is geometric, not a resource limit.`;
  }
  const gap = bounds.areaGapPct ?? 0;
  const quality = gap <= 6 ? 'essentially tight' : gap <= 15 ? 'good' : gap <= 30 ? 'loose' : 'poor';
  return `Everything is loaded on one vehicle. The pattern consumes ${bounds.placedFootprintM2.toFixed(1)} m² of deck `
    + `against a relaxation bound of ${bounds.minFloorAreaM2.toFixed(1)} m² — a ${gap.toFixed(1)}% gap, which is `
    + `${quality}. ${bounds.bindingResource} is the binding resource at ${(bounds.continuousBound * 100).toFixed(0)}% of one load.`;
}
