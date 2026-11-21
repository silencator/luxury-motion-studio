// Shared, deterministic timeline for the supercar test film.
// Plain ESM JavaScript so it runs both inside the Remotion bundle and in Node
// (scripts/export-motion.mjs → audio synthesis). Units: metres, seconds, radians.

export const FPS = 24;
export const DURATION_S = 13;
export const DURATION_FRAMES = FPS * DURATION_S;

// ---------------------------------------------------------------- car motion
// Speed keyframes [time s, speed m/s]. One controlled acceleration at ~10.2–10.9 s.
const SPEED_KEYS = [
  [0.0, 0],
  [1.0, 0],
  [2.5, 4.5],
  [4.5, 7],
  [7.0, 9],
  [10.2, 9.5],
  [10.9, 21],
  [13.0, 25],
];

const smooth = (t) => t * t * (3 - 2 * t);

export function speedAt(t) {
  if (t <= SPEED_KEYS[0][0]) return SPEED_KEYS[0][1];
  for (let i = 0; i < SPEED_KEYS.length - 1; i++) {
    const [t0, v0] = SPEED_KEYS[i];
    const [t1, v1] = SPEED_KEYS[i + 1];
    if (t <= t1) return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
  }
  return SPEED_KEYS[SPEED_KEYS.length - 1][1];
}

// Distance travelled, integrated at 1 kHz into a lookup table.
const DT = 0.001;
const DIST = (() => {
  const n = Math.ceil((DURATION_S + 1) / DT);
  const out = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) out[i] = out[i - 1] + speedAt((i - 0.5) * DT) * DT;
  return out;
})();

export function distanceAt(t) {
  const f = Math.max(0, t) / DT;
  const i = Math.min(Math.floor(f), DIST.length - 2);
  return DIST[i] + (DIST[i + 1] - DIST[i]) * (f - i);
}

export function accelAt(t) {
  return (speedAt(t + 0.01) - speedAt(t - 0.01)) / 0.02;
}

// ------------------------------------------------------------------ the path
// Car leaves the driveway heading -z, turns right on an arc and drives +x in
// the lane at z = LANE_Z.
export const LANE_Z = 1.9;
export const DRIVE_START_Z = 15;
const R = 5;
const ARC_CZ = LANE_Z + R; // arc centre (R, LANE_Z + R)
const LEN_A = DRIVE_START_Z - ARC_CZ;
const LEN_ARC = (Math.PI / 2) * R;
export const WHEELBASE = 2.45;

/** Position + heading for arc length s. Heading = yaw such that local +x is forward. */
export function pathAt(s) {
  if (s <= LEN_A) {
    return { x: 0, z: DRIVE_START_Z - s, yaw: Math.PI / 2, curvature: 0 };
  }
  if (s <= LEN_A + LEN_ARC) {
    const a = (s - LEN_A) / R; // 0..π/2
    // start at angle π (point (0, ARC_CZ)), sweep toward angle π/2 → point (R, LANE_Z)
    const ang = Math.PI - a;
    const x = R + R * Math.cos(ang);
    const z = ARC_CZ - R * Math.sin(ang);
    return { x, z, yaw: Math.PI / 2 - a, curvature: 1 / R };
  }
  const d = s - LEN_A - LEN_ARC;
  return { x: R + d, z: LANE_Z, yaw: 0, curvature: 0 };
}

/** Full car state at time t (seconds). */
export function carAt(t) {
  const s = distanceAt(t);
  const p = pathAt(s);
  // steering anticipates the curve slightly (look-ahead by half a wheelbase)
  const ahead = pathAt(s + 1.2);
  const steer = Math.atan(WHEELBASE * ahead.curvature);
  const a = accelAt(t);
  return {
    t,
    s,
    x: p.x,
    z: p.z,
    yaw: p.yaw,
    steer,
    speed: speedAt(t),
    accel: a,
    // squat under acceleration (nose up), clamp to a believable couple of degrees
    pitch: Math.max(-0.012, Math.min(0.022, a * 0.0016)),
    // idle shake when stationary
    idle: speedAt(t) < 0.3 ? 1 : 0,
  };
}

// ------------------------------------------------------------------- camera
// Shots, cut on hard cuts like the reference reel.
export const SHOTS = [
  { id: 'gate-wide', start: 0.0, end: 4.5, fov: 34 },
  { id: 'side-track', start: 4.5, end: 6.75, fov: 38 },
  { id: 'rear-chase', start: 6.75, end: 8.5, fov: 30 },
  { id: 'wheel', start: 8.5, end: 9.75, fov: 44 },
  { id: 'pass-by', start: 9.75, end: 13.0, fov: 30 },
];

export function shotAt(t) {
  return SHOTS.find((s) => t >= s.start && t < s.end) ?? SHOTS[SHOTS.length - 1];
}

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function localToWorld(car, lx, ly, lz) {
  const c = Math.cos(car.yaw);
  const s = Math.sin(car.yaw);
  // rotation about y by yaw: x' = x cos + z sin, z' = -x sin + z cos
  return [car.x + lx * c + lz * s, ly, car.z - lx * s + lz * c];
}

// Subtle deterministic "operator" drift so locked shots still breathe.
function drift(t, amp) {
  return [
    amp * (Math.sin(t * 1.3) * 0.6 + Math.sin(t * 2.9 + 1.2) * 0.4),
    amp * 0.6 * (Math.sin(t * 1.7 + 0.4) * 0.7 + Math.sin(t * 3.7) * 0.3),
    amp * (Math.sin(t * 1.1 + 2.0) * 0.5 + Math.sin(t * 2.3 + 0.7) * 0.5),
  ];
}

// Pass-by camera is planted where the car will be mid-acceleration.
const PASS_X = carAt(10.5).x - 2;

/** Camera position, look-at target and vertical FOV for time t. */
export function cameraAt(t) {
  const shot = shotAt(t);
  const car = carAt(t);
  const k = (t - shot.start) / (shot.end - shot.start);
  const d = drift(t, 0.025);
  let pos;
  let look;

  switch (shot.id) {
    case 'gate-wide': {
      // across the street, low, slow lateral dolly; pan from the gate to the car
      pos = [lerp(-5.2, -3.6, smooth(k)), 0.72, -3.0];
      const gate = [0.4, 1.3, 9.0];
      const carP = [car.x, 0.75, car.z];
      const follow = smooth(clamp01((t - 1.6) / 2.2));
      look = [lerp(gate[0], carP[0], follow), lerp(gate[1], carP[1], follow), lerp(gate[2], carP[2], follow)];
      break;
    }
    case 'side-track': {
      pos = localToWorld(car, lerp(0.9, -0.4, k), 0.82, -5.6);
      look = localToWorld(car, 0.15, 0.6, 0);
      break;
    }
    case 'rear-chase': {
      pos = localToWorld(car, lerp(-6.4, -5.2, smooth(k)), 0.62, 1.1);
      look = localToWorld(car, -0.6, 0.72, 0.1);
      break;
    }
    case 'wheel': {
      pos = localToWorld(car, lerp(2.9, 2.4, k), 0.42, -1.75);
      look = localToWorld(car, 1.25, 0.36, -0.82);
      break;
    }
    default: {
      // planted roadside camera; whip-pans with the car as it accelerates past
      pos = [PASS_X, 0.68, -3.4];
      const target = [car.x + 0.4, 0.62, car.z];
      // ease the pan in so the start of the shot frames the approach
      look = target;
      break;
    }
  }

  pos = [pos[0] + d[0], pos[1] + d[1] * 0.5, pos[2] + d[2]];
  return { pos, look, fov: shot.fov, shot: shot.id };
}
