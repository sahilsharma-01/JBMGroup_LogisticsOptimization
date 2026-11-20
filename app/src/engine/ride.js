// ============================================================================
// JBM LoadIQ — ROUTE GEOMETRY AND VEHICLE SIMULATION
// ----------------------------------------------------------------------------
// The scenario player in dynamics.js evaluates scripted acceleration inputs.
// This module replaces the script with an actual drive: a road with geometry,
// a driver who accelerates and brakes against it, and a suspension that
// responds to the surface under each axle.
//
// WHY THIS IS BETTER THAN SCRIPTED INPUTS
// A scripted "vertical g ramps up then down" has to assert when the rebound
// happens. Integrating a quarter-car over the real profile produces the
// compression, the rebound and the decaying oscillation after it as outputs,
// with the right phase and the right duration, from one source. The body
// attitude you see and the axle loads you read then come from the same state
// rather than from two models that happen to agree.
//
// COMPONENTS
//   1. ROUTE GEOMETRY   Segments are integrated into a centreline by stepping
//                       heading by curvature: psi += kappa·ds. Corners use a
//                       sinusoidal curvature ease rather than a step, which is
//                       how a driver actually winds on steering lock.
//
//   2. ROAD PROFILE     Grade integrated along the centreline, plus humps as
//                       raised cosines (zero slope at the edges, which a
//                       half-sine does not give).
//
//   3. TYRE ENVELOPMENT The wheel centre follows the rigid-tyre envelope of
//                       the profile, not the profile itself:
//                         z_env(s) = max over d of [ z(s+d) + R - sqrt(R²-d²) ]
//                       This is what stops a short sharp bump from producing
//                       an impossible acceleration.
//
//   4. DRIVER MODEL     Accelerates toward the segment target at a laden
//                       truck's real capability and brakes at a realistic
//                       deceleration. Gradient resistance is subtracted, so on
//                       a 6% climb the vehicle crawls — which is why the
//                       longitudinal load transfer on a climb is modest while
//                       the transfer under braking is not.
//
//   5. SUSPENSION       One sprung-mass degree of freedom per axle, excited by
//                       the enveloped profile under that axle:
//                         z'' = -w²(z - z_road) - 2*zeta*w*(z' - z_road')
//                       integrated semi-implicitly at a fixed substep so the
//                       result does not depend on the browser frame rate.
//
// Body heave is the load-weighted mean of the axle responses, pitch is their
// difference over the wheelbase, and the deck vertical acceleration handed to
// the load model is the same weighted mean differentiated twice by the
// integrator. Lateral acceleration is v²·kappa straight off the geometry.
// ============================================================================

import { GRAVITY } from './specs.js';
import { ROUTE_SCENARIOS, ROAD_FEATURES, SUSPENSION } from './dynamics.js';

const KPH = 1 / 3.6;
const DS = 0.5; // centreline integration step, metres

// Laden HCV longitudinal capability
export const DRIVER = {
  accelMax: 0.75,      // m/s^2 on the flat, laden
  brakeNormal: 1.6,    // m/s^2 routine deceleration
  brakeHard: 3.2,      // m/s^2 firm stop
  reactionLookaheadM: 28,
};

// ----------------------------------------------------------------------------
// 1 + 2. Route geometry and road profile
// ----------------------------------------------------------------------------
export function buildRoute(scenarioId) {
  const sc = ROUTE_SCENARIOS[scenarioId] || ROUTE_SCENARIOS.plantToGate;

  // segment arc lengths come from the nominal speed and duration
  let s = 0;
  let cornerSign = 1;
  const segments = sc.segments.map((seg, i) => {
    const feature = seg.feature ? ROAD_FEATURES[seg.feature] : null;
    const lengthM = Math.max(6, seg.speedKph * KPH * seg.seconds);
    const out = {
      ...seg,
      index: i,
      feature,
      s0: s,
      s1: s + lengthM,
      lengthM,
      targetKph: seg.kind === 'brake' ? 0 : seg.speedKph,
      entryKph: seg.speedKph,
      radiusM: seg.kind === 'corner' ? feature?.radiusM ?? 40 : 0,
      curvatureSign: seg.kind === 'corner' ? cornerSign : 0,
      gradePct: seg.kind === 'grade' ? (feature?.gradePct ?? 0) : 0,
      superelevation: seg.kind === 'corner' ? (feature?.superelevation ?? 0) : 0,
      advisoryKph: feature?.advisoryKph ?? null,
    };
    if (seg.kind === 'corner') cornerSign *= -1;
    s += lengthM;
    return out;
  });

  const lengthM = s;

  // humps sit in the middle of their segment
  const features = segments
    .filter(seg => seg.feature?.heightMm)
    .map(seg => ({
      s: seg.s0 + seg.lengthM / 2,
      label: seg.feature.label,
      heightM: seg.feature.heightMm / 1000,
      lengthM: seg.feature.lengthMm / 1000,
      oneSided: Boolean(seg.feature.oneSided),
      segmentIndex: seg.index,
    }));

  const segmentAt = (arc) => {
    for (let i = 0; i < segments.length; i += 1) {
      if (arc < segments[i].s1) return segments[i];
    }
    return segments[segments.length - 1];
  };

  // curvature with a sinusoidal ease, so lateral acceleration winds on
  const curvatureAt = (arc) => {
    const seg = segmentAt(arc);
    if (!seg.radiusM) return 0;
    const u = Math.min(1, Math.max(0, (arc - seg.s0) / seg.lengthM));
    return (seg.curvatureSign / seg.radiusM) * Math.sin(Math.PI * u);
  };

  const gradeAt = (arc) => segmentAt(arc).gradePct / 100;

  // integrate the centreline
  const samples = [];
  let x = 0;
  let y = 0;
  let z = 0;
  let heading = 0;
  for (let arc = 0; arc <= lengthM + DS; arc += DS) {
    const k = curvatureAt(arc);
    const grade = gradeAt(arc);
    samples.push({ s: arc, x, y, z, heading, curvature: k, grade });
    heading += k * DS;
    x += Math.cos(heading) * DS;
    y += Math.sin(heading) * DS;
    z += grade * DS;
  }

  const route = {
    id: sc.id,
    label: sc.label,
    description: sc.description,
    segments,
    features,
    samples,
    lengthM,
    segmentAt,
    curvatureAt,
    gradeAt,
  };

  return route;
}

export function sampleRoute(route, arc) {
  const a = Math.max(0, Math.min(arc, route.lengthM));
  const i = Math.min(route.samples.length - 2, Math.floor(a / DS));
  const p0 = route.samples[i];
  const p1 = route.samples[i + 1];
  const t = (a - p0.s) / DS;
  return {
    s: a,
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t,
    z: p0.z + (p1.z - p0.z) * t,
    heading: p0.heading + (p1.heading - p0.heading) * t,
    curvature: p0.curvature + (p1.curvature - p0.curvature) * t,
    grade: p0.grade,
  };
}

/** Bare road surface elevation at arc length `arc` on the given side. */
export function roadElevation(route, arc, side = 0) {
  const base = sampleRoute(route, arc).z;
  let bump = 0;
  for (let i = 0; i < route.features.length; i += 1) {
    const f = route.features[i];
    if (f.oneSided && side > 0) continue; // only the left wheels drop in
    const d = arc - f.s;
    const half = f.lengthM / 2;
    if (Math.abs(d) <= half) {
      // raised cosine: full height at the crown, zero slope at both edges
      bump += f.heightM * 0.5 * (1 + Math.cos((Math.PI * d) / half));
    }
  }
  return base + bump;
}

/**
 * Wheel-centre elevation, i.e. the road profile enveloped by a rigid tyre.
 * Sampling the maximum of the lifted profile is the standard approximation and
 * it is what keeps a 100 mm kerb-edge from reading as a 5 g impact.
 */
export function envelopedElevation(route, arc, side = 0, radius = SUSPENSION.tyreRadiusM) {
  // The wheel centre rests on the highest point the tyre can touch:
  //   Zc = max over d of [ z(s+d) + sqrt(R² - d²) ]
  // and the effective surface under the wheel is Zc - R. On flat ground the
  // maximum is at d = 0 and the result is exactly zero, as it must be.
  const span = Math.min(radius * 0.82, 0.38);
  const steps = 10;
  let bestCentre = -Infinity;
  for (let i = 0; i <= steps; i += 1) {
    const d = -span + (2 * span * i) / steps;
    const zc = roadElevation(route, arc + d, side) + Math.sqrt(Math.max(radius * radius - d * d, 0));
    if (zc > bestCentre) bestCentre = zc;
  }
  return bestCentre - radius;
}

// ----------------------------------------------------------------------------
// 4 + 5. Vehicle state and integrator
// ----------------------------------------------------------------------------
export function createRideState(vehicle, route, { startKph = null } = {}) {
  const axleOffsets = vehicle.axleGroups.map(a => ({
    id: a.id,
    // distance behind the front axle, so the rear axles meet a bump later
    offsetM: (a.xMm - vehicle.axleGroups[0].xMm) / 1000,
  }));

  const first = route.segments[0];
  return {
    s: 0,
    v: (startKph ?? first.entryKph) * KPH,
    t: 0,
    // Start each axle at its static equilibrium on the surface beneath it.
    // Starting at z = 0 regardless of the road would inject a step input at
    // t = 0 and the first half second of every run would be a spring
    // transient rather than the road.
    axles: axleOffsets.map(a => {
      const arc = Math.max(0, -a.offsetM);
      const zRoad = (envelopedElevation(route, arc, -1) + envelopedElevation(route, arc, 1)) / 2;
      const base = sampleRoute(route, arc).z;
      return { ...a, z: zRoad - base, dz: 0, zRoadPrev: zRoad, accel: 0 };
    }),
    heave: 0,
    heaveVel: 0,
    pitchRad: 0,
    rollRad: 0,
    wheelSpinRad: 0,
    steerRad: 0,
    verticalG: 0,
    longAccel: 0,
    stoppedFor: 0,
    finished: false,
  };
}

const SUBSTEP = 0.002; // 2 ms, fixed, so results do not vary with frame rate

/**
 * Advances the ride by `dt` seconds. Returns the state; also fills in the
 * acceleration inputs that the load model consumes.
 */
export function stepRide(state, route, vehicle, dt) {
  const w = 2 * Math.PI * SUSPENSION.naturalHz;
  const zeta = SUSPENSION.dampingRatio;
  const shares = vehicle.axleGroups.map(a => a.limitKg);
  const shareTotal = shares.reduce((x, y) => x + y, 0) || 1;

  let remaining = Math.min(dt, 0.1);
  while (remaining > 0) {
    const h = Math.min(SUBSTEP, remaining);
    remaining -= h;

    // ---- driver model -------------------------------------------------
    const seg = route.segmentAt(state.s);
    const grade = route.gradeAt(state.s);
    const target = seg.targetKph * KPH;

    // Look ahead so the driver slows before the next slower segment. The
    // look-ahead distance scales with speed, as a driver's does, instead of
    // being a fixed distance that makes a slow vehicle brake absurdly early.
    const lookahead = Math.min(DRIVER.reactionLookaheadM, 1.6 * state.v + 6);
    const aheadSeg = route.segmentAt(Math.min(state.s + lookahead, route.lengthM));
    const aheadTarget = aheadSeg.targetKph * KPH;
    const effTarget = Math.min(target, Math.max(aheadTarget, 0));

    let a;
    if (state.v < effTarget - 0.1) {
      // gradient resistance genuinely limits a laden truck on a climb
      a = Math.max(0.02, DRIVER.accelMax - GRAVITY * grade);
    } else if (state.v > effTarget + 0.1) {
      const gap = state.v - effTarget;
      a = -(gap > 4 ? DRIVER.brakeHard : DRIVER.brakeNormal);
    } else {
      a = -GRAVITY * grade * 0.5; // holding speed against the grade
    }

    state.v = Math.max(0, state.v + a * h);
    state.longAccel = a;
    state.s += state.v * h;
    state.t += h;
    if (state.s >= route.lengthM) {
      state.s = route.lengthM;
      state.finished = true;
    }
    // A planned stop ends the run. The driver may come to rest before the
    // final segment is reached — the look-ahead brakes for the stop line, not
    // for the segment boundary — so this cannot be keyed off the segment
    // index, or the vehicle idles at zero speed until the guard trips.
    if (state.v < 0.15) {
      state.stoppedFor += h;
      if (state.stoppedFor > 0.8) {
        state.finished = true;
        state.stopped = true;
      }
    } else {
      state.stoppedFor = 0;
    }

    // ---- suspension, one degree of freedom per axle --------------------
    let heaveNum = 0;
    let accelNum = 0;
    let zFront = 0;
    let zRear = 0;
    let rollFromRoad = 0;

    state.axles.forEach((ax, i) => {
      const arc = Math.max(0, state.s - ax.offsetM);
      const zL = envelopedElevation(route, arc, -1);
      const zR = envelopedElevation(route, arc, 1);
      const zRoad = (zL + zR) / 2;
      const base = sampleRoute(route, arc).z;

      const dzRoad = ax.zRoadPrev === null ? 0 : (zRoad - ax.zRoadPrev) / h;
      ax.zRoadPrev = zRoad;

      // relative to the local road base, so grade is not double counted
      const rel = ax.z - (zRoad - base);
      const accel = -w * w * rel - 2 * zeta * w * (ax.dz - dzRoad);
      ax.dz += accel * h;
      ax.z += ax.dz * h;
      ax.accel = accel;
      ax.roadLeft = zL;
      ax.roadRight = zR;
      ax.roadBase = base;

      const share = shares[i] / shareTotal;
      heaveNum += ax.z * share;
      accelNum += accel * share;
      if (i === 0) zFront = ax.z + (zRoad - base);
      if (i === state.axles.length - 1) zRear = ax.z + (zRoad - base);
      rollFromRoad += ((zR - zL) / vehicle.geometry.trackWidthMm) * 1000 * share;
    });

    state.heave = heaveNum;
    state.verticalG = accelNum / GRAVITY;

    const wheelbaseM = Math.max(
      (vehicle.axleGroups[vehicle.axleGroups.length - 1].xMm - vehicle.axleGroups[0].xMm) / 1000,
      1,
    );
    state.pitchRad = Math.atan2(zFront - zRear, wheelbaseM);
    state.roadRollRad = Math.atan(rollFromRoad);

    // wheel rotation for the visual
    state.wheelSpinRad += (state.v / SUSPENSION.tyreRadiusM) * h;
  }

  // ---- derived inputs for the load model -------------------------------
  const here = sampleRoute(route, state.s);
  const seg = route.segmentAt(state.s);
  const kappa = here.curvature;
  const radiusM = Math.abs(kappa) > 1e-6 ? 1 / Math.abs(kappa) : 0;

  // Ackermann steer angle for the visual
  const wheelbaseM = Math.max(
    (vehicle.axleGroups[vehicle.axleGroups.length - 1].xMm - vehicle.axleGroups[0].xMm) / 1000,
    1,
  );
  state.steerRad = Math.atan(wheelbaseM * kappa);
  state.curvature = kappa;
  state.radiusM = radiusM;
  state.heading = here.heading;
  state.pos = here;
  state.segment = seg;
  state.speedKph = state.v / KPH;
  state.brakingG = Math.max(0, -state.longAccel / GRAVITY);
  state.gradePct = here.grade * 100;
  state.superelevation = seg.superelevation || 0;

  return state;
}

/** The input vector for dynamics.evaluateState, from the simulated state. */
export function rideInput(state) {
  return {
    speedKph: state.speedKph,
    radiusM: state.radiusM,
    superelevation: state.superelevation,
    gradePct: state.gradePct,
    brakingG: state.brakingG,
    // signed, so the load model does not have to be told which phase it is in
    signedVerticalG: state.verticalG,
    verticalG: Math.abs(state.verticalG),
    reboundPhase: state.verticalG < 0,
    rollImpulseG: Math.abs(state.roadRollRad || 0) * 0.6,
    segmentLabel: state.segment?.label,
    featureLabel: state.segment?.feature?.label ?? null,
    featureNote: state.segment?.feature?.note ?? null,
    advisoryKph: state.segment?.advisoryKph ?? null,
    kind: state.segment?.kind,
  };
}

/**
 * Pre-runs the whole drive for the telemetry trace and the event list, using
 * the same integrator the live view uses.
 */
export function precomputeRide(vehicle, plan, scenarioId, evaluateState, { hz = 25 } = {}) {
  const route = buildRoute(scenarioId);
  const state = createRideState(vehicle, route);
  const dt = 1 / hz;
  const samples = [];
  const events = [];
  let worst = null;
  let guard = 0;

  while (!state.finished && guard < hz * 240) {
    guard += 1;
    stepRide(state, route, vehicle, dt);
    const input = rideInput(state);
    const st = evaluateState(vehicle, plan, input);

    samples.push({
      t: state.t,
      s: state.s,
      speedKph: state.speedKph,
      latG: st.latG,
      longG: -state.longAccel / GRAVITY,
      verticalG: state.verticalG,
      rolloverUtilPct: st.rolloverUtilPct,
      maxAxleUtil: Math.max(...st.axles.map(a => a.utilPct)),
      verdict: st.verdict,
      slidingCount: st.sliding.length,
      tippingCount: st.tipping.length,
      segmentLabel: input.segmentLabel,
    });

    const sev = { safe: 0, watch: 1, warning: 2, critical: 3 }[st.verdict];
    if (!worst || sev > worst.severity) worst = { severity: sev, t: state.t, s: state.s, verdict: st.verdict };

    if (st.verdict === 'critical' || st.verdict === 'warning') {
      const last = events[events.length - 1];
      const detail = st.anyWheelLift ? 'Inner wheels unloaded — rollover onset'
        : st.tipping.length ? `${st.tipping.length} unit(s) tipping`
          : st.anyAirborne ? 'Wheels momentarily unloaded over the obstacle — no braking, no steering, no friction on the cargo'
            : st.sliding.length ? `${st.sliding.length} unit(s) sliding`
              : st.anyAxleOverload ? 'Dynamic axle peak above the static rating'
                : `Rollover utilisation ${st.rolloverUtilPct.toFixed(0)}%`;
      if (!last || last.detail !== detail || state.t - last.t > 1.2) {
        events.push({
          t: state.t,
          s: state.s,
          label: input.segmentLabel,
          featureLabel: input.featureLabel,
          verdict: st.verdict,
          detail,
          speedKph: state.speedKph,
          latG: st.latG,
          verticalG: state.verticalG,
        });
      }
    }
  }

  return {
    route,
    samples,
    events,
    worst,
    duration: state.t,
    peak: {
      latG: Math.max(...samples.map(x => x.latG), 0),
      vertG: Math.max(...samples.map(x => Math.abs(x.verticalG)), 0),
      speedKph: Math.max(...samples.map(x => x.speedKph), 0),
      axleUtil: Math.max(...samples.map(x => x.maxAxleUtil), 0),
    },
  };
}
