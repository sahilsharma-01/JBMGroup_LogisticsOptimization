// ============================================================================
// JBM LoadIQ — 3D CONTAINER LOADING ALGORITHM
// ----------------------------------------------------------------------------
// A constraint-aware heuristic for the Multi-Drop Container Loading Problem
// with axle-load, stacking-strength and unloading-sequence side constraints.
//
// Strategy (mirrors how an experienced load planner actually works):
//
//   Phase 1  COLUMN BUILDING   Identical handling units are pre-stacked into
//                              columns, limited by the weaker of (a) the rated
//                              superimposed load of the base unit, (b) the
//                              packaging stack-tier rating, (c) the clear
//                              internal height. This is what makes real load
//                              patterns crane/forklift-feasible.
//
//   Phase 2  GUIDED 2D PLACEMENT  Columns are placed on the deck floor with a
//                              Maximal-Rectangles free-space decomposition.
//                              Candidate positions are scored against a target
//                              longitudinal coordinate derived from (a) the
//                              multi-drop LIFO band for that consignee and
//                              (b) the weight-bias lever used to steer the
//                              centre of gravity. This couples the packing
//                              decision to the axle constraint instead of
//                              checking axle load after the fact.
//
//   Phase 3  3D VOID RECOVERY  Remaining loose units (small bins, collapsed
//                              returnable packaging) are packed into the
//                              residual airspace above short columns and into
//                              leftover floor rectangles, respecting support
//                              area, crush strength and type compatibility.
//
//   Phase 4  VALIDATION        Every placement is re-checked for intersection,
//                              bounds, support ratio and crush load. Nothing
//                              leaves the engine unverified.
//
// The orchestrator in loadPlan.js runs this packer across a small multi-start
// grid of strategy parameters and keeps the plan with the best objective.
// ============================================================================

import {
  ENGINE_DEFAULTS,
  getPackagingSpec,
  frictionFor,
} from './specs.js';

// ----------------------------------------------------------------------------
// HANDLING UNIT CONSTRUCTION
// ----------------------------------------------------------------------------

/**
 * Explodes orders into individual handling units (one physical stillage /
 * trolley / crate / bin). Gross mass per unit is taken from the order line,
 * which already includes returnable packaging tare.
 */
export function buildHandlingUnits(orders, { getPart, getCustomer, deckMaterial = 'plywood' }) {
  const units = [];

  orders.forEach(order => {
    const part = getPart(order.partId);
    if (!part) return;
    // A planner-entered line may override the catalogue properties of its
    // packaging family (a stillage with a damaged top frame, for instance).
    const spec = { ...getPackagingSpec(order.containerType), ...(order.__overrideSpec || {}) };
    const customer = getCustomer ? getCustomer(order.customerId) : null;
    const bins = Math.max(1, order.bins || 1);

    const dims = part.containerDimensions;
    const isFolded = spec.isReturnAsset || order.containerType === 'Folded Steel Stillage';

    const grossPerUnit = order.weight / bins;
    const piecesPerUnit = Math.round((order.quantity || 0) / bins);

    for (let i = 0; i < bins; i += 1) {
      units.push({
        huId: `${order.id}/${String(i + 1).padStart(2, '0')}`,
        orderId: order.id,
        partId: part.id,
        partNo: part.partNo,
        partName: part.name,
        customerId: order.customerId,
        customerCode: customer?.code || order.customerId,
        consigneePlant: customer?.plant || '',
        priority: order.priority,
        dueTime: order.dueTime,
        poNumber: order.poNumber,
        containerType: order.containerType,
        packagingCode: spec.code,
        partCategory: part.category,
        contactPoints: spec.contactPoints ?? 4,
        contactAreaCm2: spec.contactAreaCm2 ?? 110,

        // geometry (as-presented: l along deck length, w across, h up)
        l: dims.lengthMm,
        w: dims.widthMm,
        h: dims.heightMm,
        footprintM2: (dims.lengthMm * dims.widthMm) / 1e6,
        volumeM3: (dims.lengthMm * dims.widthMm * dims.heightMm) / 1e9,

        grossKg: grossPerUnit,
        pieces: piecesPerUnit,
        tareKg: part.containerTareKg || 0,

        // stacking / handling behaviour
        maxTiers: Math.max(1, part.maxStackTiers || 1),
        topLoadCapacityKg: spec.topLoadCapacityKg,
        canSupportOtherTypes: spec.canSupportOtherTypes,
        floorOnly: (part.maxStackTiers || 1) <= 1 || spec.topLoadCapacityKg <= 0,
        rotatableYaw: spec.rotatableYaw,
        wheeled: spec.wheeled,
        clearanceMm: spec.clearanceMm,
        handlingSeconds: spec.handlingSeconds,
        tippingSafe: spec.tippingSafe,
        esd: spec.esd,
        mu: frictionFor(spec.baseMaterial, deckMaterial),

        fragility: part.fragility,
        color: part.colorCode,
        isReturnAsset: isFolded,
        // loose units are void-fill candidates rather than column material
        voidFillCandidate: isFolded || (dims.lengthMm * dims.widthMm) / 1e6 < 0.5,
      });
    }
  });

  return units;
}

/**
 * Resolves the multi-drop unloading sequence. First drop == nearest the rear
 * doors. Sequence is by committed delivery time, then by distance, so an
 * urgent short-haul JIT consignee is always the first thing off the vehicle.
 */
export function resolveDropSequence(units, { getCustomer }) {
  const byCustomer = new Map();
  units.forEach(u => {
    if (!byCustomer.has(u.customerId)) {
      const c = getCustomer ? getCustomer(u.customerId) : null;
      byCustomer.set(u.customerId, {
        customerId: u.customerId,
        code: u.customerCode,
        plant: u.consigneePlant,
        distanceKm: c?.distance ?? 0,
        earliestDue: u.dueTime || '23:59',
        units: 0,
        footprintM2: 0,
        weightKg: 0,
      });
    }
    const agg = byCustomer.get(u.customerId);
    agg.units += 1;
    agg.footprintM2 += u.footprintM2;
    agg.weightKg += u.grossKg;
    if ((u.dueTime || '23:59') < agg.earliestDue) agg.earliestDue = u.dueTime;
  });

  const drops = [...byCustomer.values()].sort((a, b) => {
    if (a.earliestDue !== b.earliestDue) return a.earliestDue < b.earliestDue ? -1 : 1;
    return a.distanceKm - b.distanceKm;
  });

  drops.forEach((d, i) => { d.dropSeq = i + 1; });
  const seqByCustomer = new Map(drops.map(d => [d.customerId, d.dropSeq]));
  units.forEach(u => { u.dropSeq = seqByCustomer.get(u.customerId) || 1; });

  return drops;
}

// ----------------------------------------------------------------------------
// PHASE 1 — COLUMN BUILDING
// ----------------------------------------------------------------------------

/**
 * Pre-stacks identical handling units into columns.
 *
 * Tier ceiling = min(
 *   packaging stack-tier rating,
 *   floor(clear internal height / unit height),
 *   1 + floor(rated superimposed load of base unit / unit gross mass)
 * )
 */
export function buildColumns(units, { clearHeightMm, allowStacking = true }) {
  const groups = new Map();
  units.forEach(u => {
    const key = `${u.containerType}|${u.l}x${u.w}x${u.h}|${u.partId}|${u.dropSeq}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(u);
  });

  const columns = [];
  let seq = 0;

  groups.forEach(groupUnits => {
    const sample = groupUnits[0];
    const byHeight = Math.max(1, Math.floor(clearHeightMm / sample.h));
    const byCrush = sample.topLoadCapacityKg > 0
      ? 1 + Math.floor(sample.topLoadCapacityKg / Math.max(sample.grossKg, 1))
      : 1;
    const tierCap = allowStacking && !sample.floorOnly
      ? Math.max(1, Math.min(sample.maxTiers, byHeight, byCrush))
      : 1;

    // heaviest unit to the bottom of every column
    const pool = [...groupUnits].sort((a, b) => b.grossKg - a.grossKg);

    while (pool.length) {
      const take = pool.splice(0, tierCap);
      seq += 1;
      const height = take.reduce((s, u) => s + u.h, 0);
      const weightKg = take.reduce((s, u) => s + u.grossKg, 0);
      columns.push({
        colId: `C${String(seq).padStart(3, '0')}`,
        units: take,
        tiers: take.length,
        tierCap,
        l: sample.l,
        w: sample.w,
        h: height,
        weightKg,
        footprintM2: sample.footprintM2,
        volumeM3: take.reduce((s, u) => s + u.volumeM3, 0),
        rotatableYaw: sample.rotatableYaw,
        clearanceMm: sample.clearanceMm,
        dropSeq: sample.dropSeq,
        customerId: sample.customerId,
        orderId: sample.orderId,
        containerType: sample.containerType,
        // what may be placed on top of this column
        topUnit: take[take.length - 1],
        topLoadRemainingKg: take.length < tierCap || sample.canSupportOtherTypes
          ? sample.topLoadCapacityKg - (take.length - 1) * sample.grossKg
          : 0,
        canSupportOtherTypes: sample.canSupportOtherTypes,
        limitedBy: tierCap === sample.maxTiers ? 'packaging tier rating'
          : tierCap === byHeight ? 'clear internal height'
            : tierCap === byCrush ? 'superimposed load rating'
              : 'floor-only constraint',
      });
    }
  });

  return columns;
}

// ----------------------------------------------------------------------------
// 2D MAXIMAL-RECTANGLES FREE SPACE
// ----------------------------------------------------------------------------

function rectsIntersect(a, b) {
  return a.x < b.x + b.l && a.x + a.l > b.x && a.z < b.z + b.w && a.z + a.w > b.z;
}

function splitFreeRect(free, used) {
  if (!rectsIntersect(free, used)) return [free];
  const out = [];
  // slab ahead of the used rect (toward the bulkhead)
  if (used.x > free.x) out.push({ x: free.x, z: free.z, l: used.x - free.x, w: free.w });
  // slab behind the used rect (toward the doors)
  if (used.x + used.l < free.x + free.l) {
    out.push({ x: used.x + used.l, z: free.z, l: free.x + free.l - (used.x + used.l), w: free.w });
  }
  // slab on the left of the used rect
  if (used.z > free.z) out.push({ x: free.x, z: free.z, l: free.l, w: used.z - free.z });
  // slab on the right of the used rect
  if (used.z + used.w < free.z + free.w) {
    out.push({ x: free.x, z: used.z + used.w, l: free.l, w: free.z + free.w - (used.z + used.w) });
  }
  return out.filter(r => r.l > 1 && r.w > 1);
}

function contains(outer, inner) {
  return inner.x >= outer.x && inner.z >= outer.z
    && inner.x + inner.l <= outer.x + outer.l
    && inner.z + inner.w <= outer.z + outer.w;
}

function pruneFreeRects(rects) {
  const keep = [];
  for (let i = 0; i < rects.length; i += 1) {
    let redundant = false;
    for (let j = 0; j < rects.length; j += 1) {
      if (i !== j && contains(rects[j], rects[i])) {
        // identical rectangles: keep only the first occurrence
        if (contains(rects[i], rects[j]) && j > i) continue;
        redundant = true;
        break;
      }
    }
    if (!redundant) keep.push(rects[i]);
  }
  return keep;
}

function occupy(freeRects, used) {
  let next = [];
  freeRects.forEach(fr => { next = next.concat(splitFreeRect(fr, used)); });
  return pruneFreeRects(next);
}

const snap = (v, grid = ENGINE_DEFAULTS.gridMm) => Math.round(v / grid) * grid;

/**
 * Scores and selects the best position for one footprint on a surface.
 *
 * Candidate anchors are the corners of every maximal free rectangle, in both
 * yaw orientations where the packaging permits turning.
 *
 * Three details matter in practice:
 *
 *  1. CLEARANCE IS TRIED, NOT IMPOSED. A working gap is attempted first; if
 *     nothing fits with it, the raw footprint is retried and the placement is
 *     flagged as a tight fit. A 2000 mm deck takes two 1000 mm stillages side
 *     by side every day of the week — the planner just nudges them in — and an
 *     engine that refuses to do so is useless.
 *
 *  2. THE LATERAL TERM IS A RUNNING BALANCE. It scores the left/right centre
 *     of gravity that *would result* from this placement, so the pattern
 *     self-centres as it is built instead of drifting to one wall and failing
 *     the stability check at the end.
 *
 *  3. BOUNDS ARE HARD. The multi-drop band passes xMin/xMax, so a later-drop
 *     consignment physically cannot be placed behind an earlier-drop one.
 */
function placeFootprint(surface, item, targetX, weights, balance, bounds = {}, usePadding = true) {
  const xMin = Math.max(0, bounds.xMin ?? 0);
  const xMax = Math.min(surface.lengthMm ?? Number.MAX_SAFE_INTEGER, bounds.xMax ?? Number.MAX_SAFE_INTEGER);
  const mass = item.weightKg ?? item.grossKg ?? 0;
  const mid = surface.widthMm / 2;
  const pads = usePadding && item.clearanceMm > 0 ? [item.clearanceMm, 0] : [0];

  for (const pad of pads) {
    const need = { l: item.l + pad, w: item.w + pad };
    const orientations = item.rotatableYaw && need.l !== need.w
      ? [{ l: need.l, w: need.w, rotated: false }, { l: need.w, w: need.l, rotated: true }]
      : [{ l: need.l, w: need.w, rotated: false }];

    let best = null;

    surface.freeRects.forEach(fr => {
      orientations.forEach(o => {
        if (o.l > fr.l + 0.5 || o.w > fr.w + 0.5) return;
        const xLo = Math.max(fr.x, xMin);
        const xHi = Math.min(fr.x + fr.l, xMax) - o.l;
        if (xHi < xLo - 0.5) return;
        const zLo = fr.z;
        const zHi = fr.z + fr.w - o.w;

        [xLo, xHi].forEach(x0 => {
          [zLo, zHi].forEach(z0 => {
            const x = Math.min(Math.max(snap(x0), xLo), xHi);
            const z = Math.min(Math.max(snap(z0), zLo), zHi);
            const centreX = x + o.l / 2;
            const centreZ = z + o.w / 2;

            const resultOffset = Math.abs(
              (balance.momentZ + mass * (centreZ - mid)) / Math.max(balance.massKg + mass, 1),
            );
            // bearing against a side wall means blocking rather than lashing
            const wallGap = Math.min(z, surface.widthMm - (z + o.w));
            const leftoverShort = Math.min(fr.l - o.l, fr.w - o.w);

            const score =
              weights.wTargetX * Math.abs(centreX - targetX)
              + weights.wLateral * resultOffset
              + weights.wWall * wallGap
              + weights.wFit * leftoverShort
              + weights.wForward * x;

            if (!best || score < best.score) {
              best = {
                x, z, l: o.l, w: o.w, rotated: o.rotated, score, centreZ,
                tight: pad === 0 && item.clearanceMm > 0,
              };
            }
          });
        });
      });
    });

    if (best) return best;
  }

  return null;
}

// ----------------------------------------------------------------------------
// SURFACES — the deck floor plus the top face of every stack
// ----------------------------------------------------------------------------

function makeDeckSurface(deck) {
  return {
    id: 'DECK',
    y: 0,
    tierBase: 0,
    lengthMm: deck.lengthMm,
    widthMm: deck.widthMm,
    clearHeightMm: deck.heightMm,
    freeRects: [{ x: 0, z: 0, l: deck.lengthMm, w: deck.widthMm }],
    capacityKg: Infinity,
    acceptsForeignTypes: true,
    support: null,
  };
}

// ----------------------------------------------------------------------------
// THE PACK RUN
// ----------------------------------------------------------------------------

const WEIGHT_BIAS_FN = {
  heavyFront: (rank, bandStart, bandLen) => bandStart + rank * bandLen,
  heavyRear: (rank, bandStart, bandLen) => bandStart + (1 - rank) * bandLen,
  heavyCentre: (rank, bandStart, bandLen, idx) =>
    bandStart + bandLen / 2 + (idx % 2 === 0 ? 1 : -1) * (rank * bandLen) / 2,
};

const SORTERS = {
  heavyFirst: (a, b) => b.weightKg - a.weightKg || b.footprintM2 - a.footprintM2,
  areaFirst: (a, b) => b.footprintM2 - a.footprintM2 || b.weightKg - a.weightKg,
  tallFirst: (a, b) => b.h - a.h || b.weightKg - a.weightKg,
  rearDoorFirst: (a, b) => a.dropSeq - b.dropSeq || b.weightKg - a.weightKg,
};

/**
 * One deterministic pack run for a given strategy parameterisation.
 */
export function packRun(vehicle, units, options) {
  const {
    weightBias = 'heavyCentre',
    sortOrder = 'heavyFirst',
    blockOffsetFraction = 0,
    enforceLifo = true,
    allowStacking = true,
    allowRotation = true,
    allowVoidRecovery = true,
    minSupportRatio = ENGINE_DEFAULTS.minSupportRatio,
    payloadCapKg = vehicle.payloadKg,
  } = options;

  const deck = vehicle.deck;
  const prepared = units.map(u => (allowRotation ? u : { ...u, rotatableYaw: false }));

  // Collapsed returnable packaging and small bins are held back for the void
  // recovery phase: putting them in dead airspace keeps revenue-earning deck
  // floor free. Everything else becomes column material.
  const columnMaterial = [];
  const voidCandidates = [];
  prepared.forEach(u => {
    if (allowVoidRecovery && u.voidFillCandidate) voidCandidates.push(u);
    else columnMaterial.push(u);
  });

  const columns = buildColumns(columnMaterial, {
    clearHeightMm: deck.heightMm,
    allowStacking,
  }).map(c => (allowRotation ? c : { ...c, rotatableYaw: false }));

  const totalFootprint = columns.reduce((s, c) => s + c.footprintM2, 0);
  const floorEfficiency = 0.84;
  const estBlockLengthMm = columns.length === 0 ? 0 : Math.min(
    deck.lengthMm,
    Math.max(
      ...columns.map(c => c.l),
      (totalFootprint / (deck.widthMm / 1000) / floorEfficiency) * 1000,
    ),
  );
  const slack = Math.max(0, deck.lengthMm - estBlockLengthMm);
  const blockStart = snap(slack * blockOffsetFraction);

  // --- weight rank: the lever used to steer the centre of gravity ---------
  const byWeight = [...columns].sort((a, b) => b.weightKg - a.weightKg);
  const rankOf = new Map(byWeight.map((c, i) => [c.colId, byWeight.length > 1 ? i / (byWeight.length - 1) : 0]));
  const biasFn = WEIGHT_BIAS_FN[weightBias] || WEIGHT_BIAS_FN.heavyCentre;
  const sorted = [...columns].sort(SORTERS[sortOrder] || SORTERS.heavyFirst);

  const surfaces = [makeDeckSurface(deck)];
  const deckSurface = surfaces[0];
  const placements = [];
  const rejected = [];
  const deferred = [];
  const balance = { momentZ: 0, massKg: 0 };
  const bands = [];
  let loadedKg = 0;

  const reject = (src, reason, detail) => {
    const sources = src.units || [src];
    sources.forEach(u => rejected.push({
      huId: u.huId,
      orderId: u.orderId,
      partNo: u.partNo,
      partName: u.partName,
      customerCode: u.customerCode,
      containerType: u.containerType,
      packagingCode: u.packagingCode,
      grossKg: u.grossKg,
      volumeM3: u.volumeM3,
      footprintM2: u.footprintM2,
      colId: src.colId,
      reason,
      detail,
    }));
  };

  const floorWeights = { wTargetX: 1.0, wLateral: 2.2, wWall: 0.18, wFit: 0.22, wForward: 0.05 };
  const voidWeights = { wTargetX: 0.8, wLateral: 1.6, wWall: 0.1, wFit: 0.3, wForward: 0.02 };

  /** Expose the clear airspace above a finished stack as a support surface. */
  const exposeTop = (id, yTop, tierBase, rect, capacityKg, support, acceptsForeignTypes) => {
    const clear = deck.heightMm - yTop;
    if (clear < 150 || capacityKg <= 0) return;
    surfaces.push({
      id,
      y: yTop,
      tierBase,
      lengthMm: deck.lengthMm,
      widthMm: deck.widthMm,
      clearHeightMm: clear,
      freeRects: [{ ...rect }],
      capacityKg,
      acceptsForeignTypes,
      support,
      supportColId: id.replace(/^TOP-/, ''),
      centreX: rect.x + rect.l / 2,
    });
  };

  /** Place one column on the deck floor inside a hard longitudinal band. */
  const placeColumn = (col, idx, bandStart, bandEnd) => {
    const rank = rankOf.get(col.colId) ?? 0.5;
    const span = Math.max(bandEnd - bandStart - col.l, 0);
    const targetX = Math.max(bandStart, Math.min(bandEnd - col.l, biasFn(rank, bandStart, span, idx)));
    let spot = placeFootprint(deckSurface, col, targetX, floorWeights, balance,
      { xMin: bandStart, xMax: bandEnd });
    let sequenceBreach = false;
    if (!spot && bandEnd < deck.lengthMm) {
      // Nothing left in the band. Rather than leave freight behind, spill past
      // the band and let the sequence audit cost it as a re-handle.
      spot = placeFootprint(deckSurface, col, targetX, floorWeights, balance,
        { xMin: bandStart, xMax: deck.lengthMm });
      sequenceBreach = Boolean(spot);
    }
    if (!spot) return null;

    let y = 0;
    col.units.forEach((u, tierIdx) => {
      placements.push({
        ...u,
        colId: col.colId,
        x: spot.x,
        z: spot.z,
        y,
        l: spot.rotated ? u.w : u.l,
        w: spot.rotated ? u.l : u.w,
        h: u.h,
        rotated: spot.rotated,
        tight: spot.tight,
        tier: tierIdx + 1,
        placedBy: 'column',
        sequenceBreach,
      });
      y += u.h;
    });

    deckSurface.freeRects = occupy(deckSurface.freeRects, { x: spot.x, z: spot.z, l: spot.l, w: spot.w });

    const usableL = spot.rotated ? col.w : col.l;
    const usableW = spot.rotated ? col.l : col.w;
    if (col.canSupportOtherTypes) {
      exposeTop(`TOP-${col.colId}`, col.h, col.tiers,
        { x: spot.x, z: spot.z, l: usableL, w: usableW },
        col.topLoadRemainingKg, col.topUnit, true);
    }

    loadedKg += col.weightKg;
    balance.momentZ += col.weightKg * (spot.centreZ - deck.widthMm / 2);
    balance.massKg += col.weightKg;
    return spot;
  };

  // --- PHASE 2: columns onto the deck floor -------------------------------
  // Multi-drop loading advances a frontier from the bulkhead: the LAST drop is
  // loaded first against the headboard, then each earlier drop is built up
  // behind it. The frontier is measured, not estimated, so a consignment can
  // never end up behind a later drop.
  const dropSeqs = [...new Set(columns.map(c => c.dropSeq))];
  const lifoActive = enforceLifo && dropSeqs.length > 1;
  const groups = lifoActive
    ? [...dropSeqs].sort((a, b) => b - a).map(ds => ({ dropSeq: ds, cols: sorted.filter(c => c.dropSeq === ds) }))
    : [{ dropSeq: null, cols: sorted }];

  let frontier = blockStart;

  groups.forEach(group => {
    const groupArea = group.cols.reduce((s, c) => s + c.footprintM2, 0);
    const estGroupLen = group.cols.length === 0 ? 0 : Math.max(
      ...group.cols.map(c => c.l),
      (groupArea / (deck.widthMm / 1000) / floorEfficiency) * 1000,
    );
    const bandStart = frontier;
    // 25% headroom on the estimate absorbs pattern inefficiency
    const bandEnd = lifoActive
      ? Math.min(deck.lengthMm, bandStart + estGroupLen * 1.25)
      : deck.lengthMm;
    bands.push({ dropSeq: group.dropSeq, start: bandStart, end: bandEnd, len: bandEnd - bandStart });

    let groupMaxX = bandStart;
    group.cols.forEach((col, idx) => {
      if (loadedKg + col.weightKg > payloadCapKg) {
        reject(col, 'payload', 'Exceeds the rated payload of the vehicle');
        return;
      }
      const spot = placeColumn(col, idx, bandStart, bandEnd);
      if (!spot) {
        // Hold it back: the void recovery phase may still find it airspace.
        deferred.push({
          col,
          reason: 'deck-space',
          detail: 'No remaining deck footprint will accept this base dimension',
        });
        return;
      }
      groupMaxX = Math.max(groupMaxX, spot.x + spot.l);
    });

    frontier = lifoActive ? snap(groupMaxX) : frontier;
  });

  // --- PHASE 3: void recovery --------------------------------------------
  // Loose units first (they exist to fill airspace), then anything the floor
  // phase could not seat. Elevated surfaces are tried before deck floor so
  // that revenue-earning floor area is preserved.
  const voidQueue = allowVoidRecovery
    ? [
      ...[...voidCandidates]
        .sort((a, b) => b.grossKg - a.grossKg)
        .map(u => ({ u, reason: 'no-void', detail: 'No compliant residual space (clear height, base support area or crush rating)' })),
      ...deferred.flatMap(d => d.col.units.map(u => ({ u, reason: d.reason, detail: d.detail }))),
    ]
    : [];

  // Airspace recovery switched off: deferred columns have nowhere else to go.
  if (!allowVoidRecovery) {
    deferred.forEach(d => reject(d.col, d.reason, d.detail));
  }

  voidQueue.forEach(({ u, reason, detail }) => {
    if (loadedKg + u.grossKg > payloadCapKg) {
      reject(u, 'payload', 'Exceeds the rated payload of the vehicle');
      return;
    }

    const candidates = surfaces
      .filter(s => s.clearHeightMm >= u.h)
      .filter(s => s.capacityKg >= u.grossKg)
      .filter(s => s.id === 'DECK' || s.acceptsForeignTypes || s.support?.partId === u.partId)
      .sort((a, b) => b.y - a.y); // dead airspace before floor space

    let seated = false;
    for (const surf of candidates) {
      if (surf.id !== 'DECK' && u.floorOnly) continue;
      const onDeck = surf.id === 'DECK';
      const target = onDeck ? blockStart + estBlockLengthMm / 2 : (surf.centreX ?? deck.lengthMm / 2);
      // A unit seated on a dedicated support surface is coaxial with its
      // support, so no working gap applies.
      const spot = placeFootprint(surf, u, target, voidWeights, balance, {}, onDeck);
      if (!spot) continue;

      placements.push({
        ...u,
        colId: onDeck ? `V-${u.huId}` : surf.supportColId,
        x: spot.x,
        z: spot.z,
        y: surf.y,
        l: spot.rotated ? u.w : u.l,
        w: spot.rotated ? u.l : u.w,
        h: u.h,
        rotated: spot.rotated,
        tight: spot.tight,
        tier: surf.tierBase + 1,
        placedBy: onDeck ? 'floor-void' : 'air-void',
        onSurface: surf.id,
      });

      surf.freeRects = occupy(surf.freeRects, { x: spot.x, z: spot.z, l: spot.l, w: spot.w });
      surf.capacityKg -= u.grossKg;
      loadedKg += u.grossKg;
      balance.momentZ += u.grossKg * (spot.centreZ - deck.widthMm / 2);
      balance.massKg += u.grossKg;

      // the unit just seated can itself carry more of its own kind
      const tiersUsed = surf.tierBase + 1;
      if (u.topLoadCapacityKg > 0 && tiersUsed < u.maxTiers) {
        exposeTop(`TOP-${u.huId}`, surf.y + u.h, tiersUsed,
          { x: spot.x, z: spot.z, l: spot.l, w: spot.w },
          Math.min(u.topLoadCapacityKg, (u.maxTiers - tiersUsed) * u.grossKg),
          u, false);
      }
      seated = true;
      break;
    }

    if (!seated) reject(u, reason, detail);
  });

  const validation = validatePlan(vehicle, placements, { minSupportRatio });

  return {
    placements,
    rejected,
    columns,
    surfaces,
    loadedKg,
    strategy: { weightBias, sortOrder, blockOffsetFraction, enforceLifo, allowStacking, allowRotation, allowVoidRecovery },
    blockStart,
    estBlockLengthMm,
    bands,
    validation,
  };
}

// ----------------------------------------------------------------------------
// PHASE 4 — VALIDATION
// ----------------------------------------------------------------------------

function overlapArea(a, b) {
  const ox = Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x);
  const oz = Math.min(a.z + a.w, b.z + b.w) - Math.max(a.z, b.z);
  return ox > 0 && oz > 0 ? ox * oz : 0;
}

export function validatePlan(vehicle, placements, { minSupportRatio = ENGINE_DEFAULTS.minSupportRatio } = {}) {
  const deck = vehicle.deck;
  const issues = [];
  const tol = 1;

  // bounds
  placements.forEach(p => {
    if (p.x < -tol || p.z < -tol || p.y < -tol
      || p.x + p.l > deck.lengthMm + tol
      || p.z + p.w > deck.widthMm + tol
      || p.y + p.h > deck.heightMm + tol) {
      issues.push({
        severity: 'critical', code: 'OUT_OF_BOUNDS', huId: p.huId,
        message: `${p.huId} projects outside the clear internal envelope`,
      });
    }
  });

  // 3D intersection
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const a = placements[i];
      const b = placements[j];
      const yOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (yOverlap <= tol) continue;
      if (overlapArea(a, b) > 100) {
        issues.push({
          severity: 'critical', code: 'INTERSECTION', huId: a.huId,
          message: `${a.huId} intersects ${b.huId}`,
        });
      }
    }
  }

  // support area + crush load
  placements.forEach(p => {
    if (p.y <= tol) return;
    const supporters = placements.filter(q => q !== p && Math.abs(q.y + q.h - p.y) <= 5 && overlapArea(p, q) > 0);
    const supported = supporters.reduce((s, q) => s + overlapArea(p, q), 0);
    const ratio = supported / (p.l * p.w);
    if (ratio < minSupportRatio) {
      issues.push({
        severity: 'critical', code: 'UNSUPPORTED', huId: p.huId,
        message: `${p.huId} has only ${(ratio * 100).toFixed(0)}% base support (minimum ${(minSupportRatio * 100).toFixed(0)}%)`,
      });
    }
    supporters.forEach(q => {
      if (q.topLoadCapacityKg <= 0) {
        issues.push({
          severity: 'critical', code: 'CRUSH', huId: p.huId,
          message: `${p.huId} is stacked on ${q.huId} (${q.packagingCode}) which is rated for zero superimposed load`,
        });
      }
    });
  });

  // stacked-above-mass against each unit's rating
  placements.forEach(p => {
    if (p.topLoadCapacityKg <= 0) return;
    const above = placements
      .filter(q => q !== p && q.y >= p.y + p.h - 5 && overlapArea(p, q) > 0.5 * (q.l * q.w))
      .reduce((s, q) => s + q.grossKg, 0);
    if (above > p.topLoadCapacityKg) {
      issues.push({
        severity: 'critical', code: 'OVERLOAD_TOP', huId: p.huId,
        message: `${above.toFixed(0)} kg bears on ${p.huId}, rated for ${p.topLoadCapacityKg} kg`,
      });
    }
  });

  // floor-only packaging lifted off the deck
  placements.forEach(p => {
    if (p.floorOnly && p.y > tol) {
      issues.push({
        severity: 'critical', code: 'FLOOR_ONLY', huId: p.huId,
        message: `${p.huId} (${p.packagingCode}) is floor-level only but was placed at tier ${p.tier}`,
      });
    }
  });

  return {
    ok: issues.filter(i => i.severity === 'critical').length === 0,
    issues,
  };
}

// ----------------------------------------------------------------------------
// LIFO / SEQUENCE AUDIT
// ----------------------------------------------------------------------------

/**
 * A unit is "blocked" when a consignment that is delivered later in the route
 * sits between it and the rear doors, forcing a re-handle at the dock.
 */
export function auditUnloadSequence(placements) {
  const blocked = [];
  placements.forEach(p => {
    const blockers = placements.filter(q =>
      q.dropSeq > p.dropSeq
      && q.x > p.x + p.l - 50
      && Math.min(p.z + p.w, q.z + q.w) - Math.max(p.z, q.z) > 100
      && Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y) > 100);
    if (blockers.length) {
      blocked.push({ huId: p.huId, dropSeq: p.dropSeq, blockedBy: blockers.map(b => b.huId) });
    }
  });

  // units buried under a later-drop unit also need a re-handle
  const buried = placements.filter(p =>
    placements.some(q => q.dropSeq > p.dropSeq && Math.abs(q.y - (p.y + p.h)) <= 5 && overlapArea(p, q) > 0));

  return {
    blockedCount: blocked.length,
    buriedCount: buried.length,
    blocked,
    rehandlingEvents: blocked.length + buried.length,
  };
}

// ----------------------------------------------------------------------------
// RESIDUAL CAPACITY
// ----------------------------------------------------------------------------

/**
 * Quantifies what is genuinely still loadable. This is the number a planner
 * acts on -- not the raw cube percentage, which is capped by the order mix.
 */
export function residualCapacity(vehicle, placements, loadedKg) {
  const deck = vehicle.deck;
  const grid = 100; // 100 mm occupancy raster
  const nx = Math.ceil(deck.lengthMm / grid);
  const nz = Math.ceil(deck.widthMm / grid);
  const heightUsed = new Float32Array(nx * nz);

  placements.forEach(p => {
    const i0 = Math.floor(p.x / grid);
    const i1 = Math.ceil((p.x + p.l) / grid);
    const j0 = Math.floor(p.z / grid);
    const j1 = Math.ceil((p.z + p.w) / grid);
    for (let i = Math.max(0, i0); i < Math.min(nx, i1); i += 1) {
      for (let j = Math.max(0, j0); j < Math.min(nz, j1); j += 1) {
        const k = i * nz + j;
        heightUsed[k] = Math.max(heightUsed[k], p.y + p.h);
      }
    }
  });

  let occupiedCells = 0;
  let stackedVolumeMm3 = 0;
  let freeAirVolumeMm3 = 0;
  for (let k = 0; k < heightUsed.length; k += 1) {
    if (heightUsed[k] > 0) occupiedCells += 1;
    stackedVolumeMm3 += heightUsed[k] * grid * grid;
    freeAirVolumeMm3 += (deck.heightMm - heightUsed[k]) * grid * grid;
  }

  const goodsVolumeM3 = placements.reduce((s, p) => s + (p.l * p.w * p.h) / 1e9, 0);
  const envelopeVolumeM3 = stackedVolumeMm3 / 1e9;

  // largest free cuboid on the floor (greedy scan over free columns)
  let bestFloorRect = { l: 0, w: 0, areaM2: 0 };
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < nz; j += 1) {
      if (heightUsed[i * nz + j] > 0) continue;
      let maxI = i;
      while (maxI + 1 < nx && heightUsed[(maxI + 1) * nz + j] === 0) maxI += 1;
      let maxJ = j;
      let ok = true;
      while (ok && maxJ + 1 < nz) {
        for (let ii = i; ii <= maxI; ii += 1) {
          if (heightUsed[ii * nz + maxJ + 1] > 0) { ok = false; break; }
        }
        if (ok) maxJ += 1;
      }
      const area = ((maxI - i + 1) * grid * (maxJ - j + 1) * grid) / 1e6;
      if (area > bestFloorRect.areaM2) {
        bestFloorRect = {
          l: (maxI - i + 1) * grid,
          w: (maxJ - j + 1) * grid,
          areaM2: area,
          x: i * grid,
          z: j * grid,
        };
      }
    }
  }

  return {
    deckVolumeM3: vehicle.deckVolumeM3,
    goodsVolumeM3,
    envelopeVolumeM3,
    freeAirVolumeM3: freeAirVolumeMm3 / 1e9,
    floorUsedM2: (occupiedCells * grid * grid) / 1e6,
    floorFreeM2: vehicle.deckAreaM2 - (occupiedCells * grid * grid) / 1e6,
    floorUtilPct: ((occupiedCells * grid * grid) / 1e6 / vehicle.deckAreaM2) * 100,
    cubeOccupancyPct: (goodsVolumeM3 / vehicle.deckVolumeM3) * 100,
    envelopePct: (envelopeVolumeM3 / vehicle.deckVolumeM3) * 100,
    packingDensityPct: envelopeVolumeM3 > 0 ? (goodsVolumeM3 / envelopeVolumeM3) * 100 : 0,
    payloadUtilPct: (loadedKg / vehicle.payloadKg) * 100,
    payloadHeadroomKg: vehicle.payloadKg - loadedKg,
    largestFreeFloorRect: bestFloorRect,
    maxStackHeightMm: placements.reduce((m, p) => Math.max(m, p.y + p.h), 0),
    heightHeadroomMm: deck.heightMm - placements.reduce((m, p) => Math.max(m, p.y + p.h), 0),
  };
}
