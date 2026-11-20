// ============================================================================
// JBM LoadIQ — LOAD SECURING CALCULATION
// ----------------------------------------------------------------------------
// Method: EN 12195-1:2010, the balance-of-forces approach.
//
// For each direction, the load that friction cannot hold must be taken by
// blocking (against the body structure) or by lashing:
//
//   Driving force          F_drive = c · m · g
//   Friction resistance    F_fric  = μ · m · g       (vertical lashings add to
//                                                     the normal force)
//   Shortfall              ΔF      = (c − μ) · m · g
//
//   Top-over lashing, each pair resists   2 · STF · μ · sin α
//   so  n = ΔF / (2 · STF · μ · sin α)
//
// Tipping is checked separately, because a tall narrow unit can tip long
// before it slides:
//   stable against tipping when  c ≤ b / (2 · h)
//
// Wheeled packaging (panel trolleys) cannot claim friction at all: the castors
// must be chocked and the trolley lashed directly to deck rings.
// ============================================================================

import { SECURING, GRAVITY } from './specs.js';

const daN = (newtons) => newtons / 10;
const sinAlpha = Math.sin((SECURING.lashingAngleDeg * Math.PI) / 180);

function lashingsFor(shortfallN, mu) {
  if (shortfallN <= 0) return 0;
  const perLashingDaN = 2 * SECURING.stfDaN * Math.max(mu, 0.05) * sinAlpha;
  return Math.ceil(daN(shortfallN) / perLashingDaN);
}

/**
 * Builds the securing plan for a finished load pattern.
 *
 * Blocking credit is only granted where a unit (or an unbroken row of units in
 * contact) actually bears against the front bulkhead or a side wall, and only
 * up to the rated strength of that structure per EN 12642.
 */
export function buildSecuringPlan(vehicle, placements, { gapToleranceMm = 80 } = {}) {
  const deck = vehicle.deck;
  const payload = vehicle.payloadKg;
  const frontWallCapacityKg = vehicle.bodyStrength.frontWall * payload;
  const sideWallCapacityKg = vehicle.bodyStrength.sideWall * payload;

  // --- which units form an unbroken chain of contact to the bulkhead? -----
  const sorted = [...placements].filter(p => p.tier === 1).sort((a, b) => a.x - b.x);
  const blockedToFront = new Set();
  sorted.forEach(p => {
    if (p.x <= gapToleranceMm) { blockedToFront.add(p.huId); return; }
    const touchesBlocked = sorted.some(q =>
      blockedToFront.has(q.huId)
      && Math.abs(q.x + q.l - p.x) <= gapToleranceMm
      && Math.min(p.z + p.w, q.z + q.w) - Math.max(p.z, q.z) > 150);
    if (touchesBlocked) blockedToFront.add(p.huId);
  });

  const items = placements.map(p => {
    const m = p.grossKg;
    const W = m * GRAVITY;
    const mu = p.wheeled ? 0 : (p.mu ?? 0.3);
    // a unit resting on another unit slides on packaging, not on the deck
    const effectiveMu = p.tier > 1 ? Math.min(mu, 0.25) : mu;

    const fwdShortfallN = Math.max(0, (SECURING.cForward - effectiveMu) * W);
    const latShortfallN = Math.max(0, (SECURING.cLateral - effectiveMu) * W);
    const rwdShortfallN = Math.max(0, (SECURING.cRearward - effectiveMu) * W);

    const isBlockedFront = p.tier === 1 && blockedToFront.has(p.huId);
    const touchesLeftWall = p.z <= gapToleranceMm;
    const touchesRightWall = p.z + p.w >= deck.widthMm - gapToleranceMm;

    // tipping check — short side is the governing base width
    const baseShort = Math.min(p.l, p.w);
    const tipLimit = baseShort / (2 * p.h);
    const tipRiskDirection = tipLimit < SECURING.cLateral
      ? 'lateral'
      : tipLimit < SECURING.cForward ? 'longitudinal' : null;

    const lashForward = isBlockedFront ? 0 : lashingsFor(fwdShortfallN, effectiveMu || 0.2);
    const lashLateral = (touchesLeftWall && touchesRightWall) ? 0 : lashingsFor(latShortfallN, effectiveMu || 0.2);
    const lashRearward = lashingsFor(rwdShortfallN, effectiveMu || 0.2);

    const lashings = Math.max(lashForward, lashLateral, lashRearward, tipRiskDirection ? 2 : 0);

    const measures = [];
    if (p.wheeled) measures.push('Chock all four castors + 2 direct lashings to deck rings (friction may not be claimed)');
    if (isBlockedFront) measures.push('Forward force taken by bulkhead blocking');
    if (!isBlockedFront && p.tier === 1 && p.x > gapToleranceMm) {
      measures.push(`${Math.round(p.x)} mm gap to the unit ahead — insert a blocking bar or dunnage`);
    }
    if (effectiveMu < 0.3 && !p.wheeled) measures.push('Anti-slip mat required (μ below 0.30)');
    if (lashings > 0) measures.push(`${lashings} × top-over lashing @ ${SECURING.lashingAngleDeg}° (STF ${SECURING.stfDaN} daN)`);
    if (tipRiskDirection) measures.push(`Tipping-sensitive (b/2h = ${tipLimit.toFixed(2)}) — brace ${tipRiskDirection}ly`);
    if (p.esd) measures.push('ESD protocol: wrist strap, no metal-on-tray contact, sealed liner intact');
    if (p.topLoadCapacityKg === 0) measures.push('NOTHING TO BE PLACED ON TOP — zero superimposed load rating');

    return {
      huId: p.huId,
      partNo: p.partNo,
      packagingCode: p.packagingCode,
      tier: p.tier,
      grossKg: Math.round(m),
      mu: Number(effectiveMu.toFixed(2)),
      blockedFront: isBlockedFront,
      blockedLaterally: touchesLeftWall || touchesRightWall,
      lashings,
      requiredForceDaN: {
        forward: Math.round(daN(fwdShortfallN)),
        lateral: Math.round(daN(latShortfallN)),
        rearward: Math.round(daN(rwdShortfallN)),
      },
      tipLimit: Number(tipLimit.toFixed(2)),
      tipRiskDirection,
      measures,
    };
  });

  const blockedMassKg = items.filter(i => i.blockedFront)
    .reduce((s, i) => s + i.grossKg, 0);
  const bulkheadDemandKg = blockedMassKg * SECURING.cForward;

  const leftMass = placements.filter(p => p.z <= gapToleranceMm).reduce((s, p) => s + p.grossKg, 0);
  const rightMass = placements.filter(p => p.z + p.w >= deck.widthMm - gapToleranceMm).reduce((s, p) => s + p.grossKg, 0);

  const warnings = [];
  if (bulkheadDemandKg > frontWallCapacityKg) {
    warnings.push({
      severity: 'critical',
      code: 'BULKHEAD_OVERLOAD',
      message: `Blocking demand on the front bulkhead is ${Math.round(bulkheadDemandKg)} kgf against a rated ${Math.round(frontWallCapacityKg)} kgf (EN 12642 Code ${vehicle.geometry.bodyCode}). Add top-over lashings to the forward rows.`,
    });
  }
  const sideDemand = Math.max(leftMass, rightMass) * SECURING.cLateral;
  if (sideDemand > sideWallCapacityKg) {
    warnings.push({
      severity: 'warning',
      code: 'SIDEWALL_OVERLOAD',
      message: `Lateral blocking demand of ${Math.round(sideDemand)} kgf exceeds the ${Math.round(sideWallCapacityKg)} kgf side-wall rating. Lash the outer rows rather than relying on the curtain/side panel.`,
    });
  }
  const wheeledUnsecured = items.filter(i => i.measures.some(m => m.includes('Chock')));
  if (wheeledUnsecured.length) {
    warnings.push({
      severity: 'warning',
      code: 'WHEELED_UNITS',
      message: `${wheeledUnsecured.length} wheeled panel trolleys on board. Friction cannot be claimed under EN 12195-1 — chocks and direct lashings are mandatory.`,
    });
  }

  const totalLashings = items.reduce((s, i) => s + i.lashings, 0);
  const antiSlipMats = items.filter(i => i.measures.some(m => m.startsWith('Anti-slip'))).length;

  return {
    standard: 'EN 12195-1:2010',
    bodyCode: vehicle.geometry.bodyCode,
    coefficients: {
      forward: SECURING.cForward,
      rearward: SECURING.cRearward,
      lateral: SECURING.cLateral,
    },
    frontWallCapacityKg: Math.round(frontWallCapacityKg),
    sideWallCapacityKg: Math.round(sideWallCapacityKg),
    bulkheadDemandKg: Math.round(bulkheadDemandKg),
    totalLashings,
    antiSlipMats,
    chocksRequired: items.filter(i => i.measures.some(m => m.includes('Chock'))).length * 4,
    items,
    warnings,
  };
}
