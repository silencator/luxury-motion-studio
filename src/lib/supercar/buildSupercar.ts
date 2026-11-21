import * as THREE from 'three';
import { glowTexture, plateTexture, wheelBlurTexture } from '../textures';

/**
 * Procedural rear-engine track-focused supercar (992 GT3 RS-inspired proportions).
 * Local frame: +x forward, +y up, +z = right side. Origin on the ground at mid-wheelbase.
 *
 * The body is a loft: ~240 cross-sections along the car, each a pair of
 * superellipses (upper greenhouse / lower flank) whose size follows design curves.
 * Glass, carbon roof, louvres, intakes and trims are painted with vertex colours.
 */

// ------------------------------------------------------------------ design curves
type Keys = [number, number][];
function curve(keys: Keys) {
  const k = [...keys].sort((a, b) => a[0] - b[0]);
  return (x: number) => {
    if (x <= k[0][0]) return k[0][1];
    for (let i = 0; i < k.length - 1; i++) {
      if (x <= k[i + 1][0]) {
        const t = (x - k[i][0]) / (k[i + 1][0] - k[i][0]);
        const s = t * t * (3 - 2 * t);
        return k[i][1] + (k[i + 1][1] - k[i][1]) * s;
      }
    }
    return k[k.length - 1][1];
  };
}

export const CAR = {
  front: 2.31,
  rear: -2.31,
  frontAxle: 1.28,
  rearAxle: -1.17,
  frontR: 0.34,
  rearR: 0.355,
  frontTrack: 0.8,
  rearTrack: 0.8,
  frontTyreW: 0.27,
  rearTyreW: 0.33,
};

const topC = curve([
  [2.31, 0.42], [2.24, 0.55], [2.1, 0.62], [1.8, 0.67], [1.2, 0.72], [0.75, 0.77], [0.62, 0.8],
  [0.3, 1.0], [0.0, 1.18], [-0.15, 1.25], [-0.45, 1.3], [-0.85, 1.29], [-1.2, 1.2],
  [-1.55, 1.06], [-1.85, 0.98], [-2.1, 0.95], [-2.25, 0.92], [-2.31, 0.82],
]);
const beltC = curve([
  [2.31, 0.34], [2.15, 0.48], [1.8, 0.58], [1.2, 0.64], [0.6, 0.68], [0.0, 0.7],
  [-0.8, 0.76], [-1.3, 0.78], [-2.0, 0.77], [-2.31, 0.7],
]);
const widthC = curve([
  [2.31, 0.56], [2.22, 0.78], [2.0, 0.88], [1.28, 0.935], [0.7, 0.9], [0.0, 0.885],
  [-0.6, 0.93], [-1.17, 0.965], [-1.8, 0.955], [-2.2, 0.9], [-2.31, 0.8],
]);
const upperN = curve([[2.31, 4], [0.9, 4], [0.5, 3], [-1.5, 3], [-1.9, 4], [-2.31, 4]]);
// fender crowns (front wings rise above the bonnet, rear haunches)
const fenderC = curve([
  [2.25, 0.0], [2.0, 0.05], [1.28, 0.07], [0.75, 0.04], [0.5, 0.0],
  [-0.6, 0.0], [-1.0, 0.035], [-1.4, 0.045], [-2.0, 0.03], [-2.3, 0.0],
]);

function arch(x: number, cx: number, r: number, cy: number) {
  const d = x - cx;
  if (Math.abs(d) >= r) return 0;
  return cy + Math.sqrt(r * r - d * d);
}

function bottomAt(x: number) {
  let y = curve([[2.31, 0.24], [2.18, 0.165], [-2.12, 0.165], [-2.31, 0.3]])(x);
  y = Math.max(y, arch(x, CAR.frontAxle, 0.415, CAR.frontR - 0.02));
  y = Math.max(y, arch(x, CAR.rearAxle, 0.43, CAR.rearR - 0.02));
  return y;
}

function section(x: number) {
  const yb = bottomAt(x);
  const ys = Math.max(beltC(x), yb + 0.045);
  const yt = Math.max(topC(x), ys + 0.035);
  return { yb, ys, yt, w: widthC(x), n: upperN(x) };
}

const sgnPow = (v: number, p: number) => Math.sign(v) * Math.pow(Math.abs(v), p);

/** Point on the body surface at station x and section angle phi (0 = right belt, π/2 = top). */
function bodyPoint(x: number, phi: number) {
  const s = section(x);
  const c = Math.cos(phi), sn = Math.sin(phi);
  if (sn >= 0) {
    const zf = sgnPow(c, 2 / s.n);
    const yf = Math.pow(sn, 2 / s.n);
    const bump = fenderC(x) * Math.exp(-(((Math.abs(zf) - 0.74) / 0.17) ** 2));
    return { y: s.ys + (s.yt - s.ys) * yf + bump, z: s.w * zf, sec: s, upper: true };
  }
  const nl = 4.5;
  return {
    y: s.ys - (s.ys - s.yb) * Math.pow(-sn, 2 / nl),
    z: s.w * 0.985 * sgnPow(c, 2 / nl),
    sec: s,
    upper: false,
  };
}

/** Upper surface point at a given fraction of half-width (used to place details). */
export function surfaceAt(x: number, zFrac: number) {
  const s = section(x);
  const cosv = Math.pow(Math.min(0.999, Math.abs(zFrac)), s.n / 2);
  const phi = Math.acos(cosv);
  const p = bodyPoint(x, phi);
  return { y: p.y, z: Math.sign(zFrac) * Math.abs(p.z) };
}

// ------------------------------------------------------------------ colours
const C = {
  paint: new THREE.Color('#0d3b29'),
  glass: new THREE.Color('#030405'),
  carbon: new THREE.Color('#0a0b0c'),
  trim: new THREE.Color('#060606'),
};

function paintFor(x: number, phi: number, zNorm: number): THREE.Color {
  const sn = Math.sin(phi);
  const az = Math.abs(zNorm);
  if (sn >= 0) {
    // greenhouse
    if (x < 0.6 && x > -1.46) {
      const sideGlass =
        sn > 0.2 && sn < 0.62 && x < 0.52 - (sn - 0.2) * 1.3 && x > -1.38 + (sn - 0.2) * 1.1;
      if (sideGlass) return C.glass;
      if (sn > 0.7 && x > -0.1 && x < 0.58 && az < 0.66) return C.glass; // windscreen
      if (sn > 0.7 && x <= -0.1 && x > -1.05 && az < 0.6) return C.carbon; // carbon roof
      if (sn > 0.72 && x <= -1.05 && az < 0.55) return C.glass; // rear window
    }
    // engine-cover louvres
    if (x < -1.5 && x > -2.02 && sn > 0.62 && az < 0.6) {
      return Math.floor((x + 3) / 0.075) % 2 === 0 ? C.trim : C.carbon;
    }
    // bonnet vents (two nostrils either side of the centreline)
    if (x > 1.5 && x < 1.92 && sn > 0.86 && az > 0.08 && az < 0.34) return C.trim;
    // louvres on top of the front wings
    if (x > 0.86 && x < 1.5 && az > 0.58 && az < 0.84 && sn > 0.4) {
      return Math.floor((x + 3) / 0.07) % 2 === 0 ? C.trim : C.paint;
    }
    // front intakes in the nose
    if (x > 2.16 && sn < 0.35 && (az < 0.28 || (az > 0.52 && az < 0.86))) return C.trim;
    return C.paint;
  }
  // lower half
  const y = bodyPoint(x, phi).y;
  if (y < 0.235) return C.trim; // splitter / skirts / diffuser
  if (x < -2.22 && y < 0.62) return C.trim; // rear diffuser face
  if (x > 2.18 && y < 0.36) return C.trim; // front splitter face
  // side intake ahead of the rear wheel
  if (x > -0.95 && x < -0.68 && sn > -0.55 && az > 0.8) return C.trim;
  return C.paint;
}

// ------------------------------------------------------------------ body loft
function buildBody() {
  const N = 240; // stations
  const M = 96; // around
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const x = CAR.front - (i / N) * (CAR.front - CAR.rear);
    for (let j = 0; j < M; j++) {
      const phi = (j / M) * Math.PI * 2;
      const p = bodyPoint(x, phi);
      pos.push(x, p.y, p.z);
      const c = paintFor(x, phi, p.z / p.sec.w);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * M + j;
      const b = i * M + ((j + 1) % M);
      const c = (i + 1) * M + j;
      const d = (i + 1) * M + ((j + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  }
  // end caps (fans to the section centroid)
  for (const [ring, flip] of [[0, true], [N, false]] as const) {
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < M; j++) {
      cx += pos[(ring * M + j) * 3];
      cy += pos[(ring * M + j) * 3 + 1];
      cz += pos[(ring * M + j) * 3 + 2];
    }
    const ci = pos.length / 3;
    pos.push(cx / M, cy / M, cz / M);
    col.push(C.trim.r, C.trim.g, C.trim.b);
    for (let j = 0; j < M; j++) {
      const a = ring * M + j, b = ring * M + ((j + 1) % M);
      if (flip) idx.push(ci, a, b);
      else idx.push(ci, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ materials
export function makeMaterials() {
  return {
    body: new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 0.55,
      roughness: 0.34,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.25,
    }),
    carbon: new THREE.MeshPhysicalMaterial({
      color: '#0b0c0d', metalness: 0.4, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12,
    }),
    satinBlack: new THREE.MeshStandardMaterial({ color: '#0c0c0d', metalness: 0.2, roughness: 0.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#111112', metalness: 0, roughness: 0.92 }),
    rim: new THREE.MeshPhysicalMaterial({
      color: '#18191b', metalness: 0.8, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.2,
    }),
    rimLip: new THREE.MeshStandardMaterial({ color: '#8c8f94', metalness: 1, roughness: 0.25 }),
    disc: new THREE.MeshStandardMaterial({ color: '#5a5c60', metalness: 0.9, roughness: 0.45 }),
    caliper: new THREE.MeshPhysicalMaterial({ color: '#b5141c', metalness: 0.2, roughness: 0.35, clearcoat: 1 }),
    nut: new THREE.MeshStandardMaterial({ color: '#c41a20', metalness: 0.7, roughness: 0.3 }),
    headGlass: new THREE.MeshPhysicalMaterial({
      color: '#0d1013', metalness: 0.1, roughness: 0.05, clearcoat: 1, transmission: 0, envMapIntensity: 1.6,
    }),
    headLamp: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#f4f6ff', emissiveIntensity: 6 }),
    drl: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 9 }),
    tail: new THREE.MeshStandardMaterial({ color: '#3a0000', emissive: '#ff1a10', emissiveIntensity: 5 }),
    tailDim: new THREE.MeshStandardMaterial({ color: '#200000', emissive: '#9a0806', emissiveIntensity: 2 }),
    chassis: new THREE.MeshBasicMaterial({ color: '#020202' }),
  };
}

// ------------------------------------------------------------------ wheels
function buildWheel(m: ReturnType<typeof makeMaterials>, R: number, W: number, outerSign: 1 | -1) {
  const rimR = 0.258;
  const visual = new THREE.Group();

  const tyreProfile = [
    new THREE.Vector2(rimR - 0.005, -W / 2 + 0.01),
    new THREE.Vector2(R - 0.035, -W / 2),
    new THREE.Vector2(R - 0.008, -W / 2 + 0.02),
    new THREE.Vector2(R, -W / 2 + 0.05),
    new THREE.Vector2(R, W / 2 - 0.05),
    new THREE.Vector2(R - 0.008, W / 2 - 0.02),
    new THREE.Vector2(R - 0.035, W / 2),
    new THREE.Vector2(rimR - 0.005, W / 2 - 0.01),
  ];
  const tyre = new THREE.Mesh(new THREE.LatheGeometry(tyreProfile, 64), m.rubber);
  tyre.rotation.x = Math.PI / 2;
  visual.add(tyre);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, W * 0.92, 48, 1, true), m.rim);
  barrel.rotation.x = Math.PI / 2;
  visual.add(barrel);

  const faceZ = W / 2 - 0.035;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.011, 8, 64), m.rimLip);
  lip.position.z = faceZ + 0.01;
  visual.add(lip);

  // ten twin spokes, slightly dished
  const spokeLen = rimR - 0.055;
  const spokeGeo = new THREE.BoxGeometry(spokeLen, 0.026, 0.022);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    for (const off of [-0.07, 0.07]) {
      const sp = new THREE.Mesh(spokeGeo, m.rim);
      const aa = a + off;
      const rMid = 0.05 + spokeLen / 2;
      sp.position.set(Math.cos(aa) * rMid, Math.sin(aa) * rMid, faceZ - 0.01);
      sp.rotation.z = aa;
      sp.rotation.y = -0.12; // dish
      visual.add(sp);
    }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.04, 24), m.rim);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = faceZ;
  visual.add(hub);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.05, 6), m.nut);
  nut.rotation.x = Math.PI / 2;
  nut.position.z = faceZ + 0.02;
  visual.add(nut);
  const nutCap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.052, 16), m.rimLip);
  nutCap.rotation.x = Math.PI / 2;
  nutCap.position.z = faceZ + 0.022;
  visual.add(nutCap);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.034, 48), m.disc);
  disc.rotation.x = Math.PI / 2;
  disc.position.z = faceZ - 0.11;
  visual.add(disc);

  // motion-blur disc, faded in with angular speed
  const blurMat = new THREE.MeshBasicMaterial({
    map: wheelBlurTexture(), transparent: true, opacity: 0, depthWrite: false,
  });
  const blur = new THREE.Mesh(new THREE.CircleGeometry(rimR + 0.004, 48), blurMat);
  blur.position.z = faceZ + 0.048;
  visual.add(blur);

  if (outerSign < 0) visual.rotation.y = Math.PI;
  return { visual, blurMat };
}

// ------------------------------------------------------------------ assemble
export type SupercarRig = ReturnType<typeof buildSupercar>;

export function buildSupercar(plate = 'SILENCATOR') {
  const m = makeMaterials();
  const root = new THREE.Group(); // world placement (yaw)
  const body = new THREE.Group(); // suspension pitch / idle shake
  root.add(body);

  const shell = new THREE.Mesh(buildBody(), m.body);
  shell.castShadow = true;
  shell.receiveShadow = true;
  body.add(shell);

  // chassis tub hides see-through between the wheel tunnels
  const tub = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.51, 1.1), m.chassis);
  tub.position.set(-0.05, 0.425, 0);
  body.add(tub);

  // ---- rear wing (swan-neck)
  const foil = new THREE.Shape();
  foil.moveTo(0.23, 0);
  foil.bezierCurveTo(0.18, 0.045, -0.05, 0.05, -0.23, 0.012);
  foil.lineTo(-0.23, -0.004);
  foil.bezierCurveTo(-0.05, 0.012, 0.15, -0.02, 0.23, 0);
  const foilGeo = new THREE.ExtrudeGeometry(foil, { depth: 1.72, bevelEnabled: false, curveSegments: 16 });
  foilGeo.translate(0, 0, -0.86);
  const wing = new THREE.Mesh(foilGeo, m.carbon);
  wing.position.set(-2.1, 1.43, 0);
  wing.rotation.z = -0.1;
  wing.castShadow = true;
  body.add(wing);
  const flap = new THREE.Mesh(foilGeo, m.carbon);
  flap.scale.set(0.5, 0.9, 1);
  flap.position.set(-2.33, 1.5, 0);
  flap.rotation.z = -0.32;
  body.add(flap);
  for (const z of [-0.87, 0.87]) {
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.012), m.carbon);
    ep.position.set(-2.18, 1.44, z);
    body.add(ep);
  }
  for (const z of [-0.33, 0.33]) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.66, 0.97, z),
      new THREE.Vector3(-1.8, 1.25, z),
      new THREE.Vector3(-1.95, 1.53, z),
      new THREE.Vector3(-2.08, 1.535, z),
      new THREE.Vector3(-2.14, 1.47, z),
    ]);
    const neck = new THREE.Mesh(new THREE.TubeGeometry(path, 32, 0.034, 8), m.carbon);
    neck.scale.z = 1;
    neck.position.z = 0;
    const neckGroup = new THREE.Group();
    neckGroup.add(neck);
    neckGroup.position.z = z;
    neckGroup.scale.z = 0.35;
    neck.position.z = 0;
    neck.geometry.translate(0, 0, -z);
    body.add(neckGroup);
  }

  // ---- lights
  const glowTex = glowTexture();
  const glows: THREE.Sprite[] = [];
  const addGlow = (parent: THREE.Object3D, color: string, x: number, y: number, z: number, s: number, o = 1) => {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: o,
      }),
    );
    sp.position.set(x, y, z);
    sp.scale.set(s, s, s);
    parent.add(sp);
    glows.push(sp);
    return sp;
  };

  for (const side of [-1, 1]) {
    const x = 1.98;
    const p = surfaceAt(x, 0.66 * side);
    const head = new THREE.Group();
    head.position.set(x + 0.04, p.y - 0.035, p.z);
    head.rotation.z = -0.38; // follows the bonnet slope
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), m.headGlass);
    shell.scale.set(0.15, 0.06, 0.105);
    head.add(shell);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), m.headLamp);
    lamp.scale.set(0.1, 0.045, 0.075);
    lamp.position.x = 0.02;
    head.add(lamp);
    // four-point DRL signature
    for (const [dx, dz] of [[0.05, 0.035], [0.05, -0.035], [-0.01, 0.035], [-0.01, -0.035]]) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.012), m.drl);
      d.position.set(dx, 0.045, dz);
      head.add(d);
    }
    body.add(head);
    addGlow(body, '#e9efff', x + 0.16, p.y - 0.02, p.z, 0.55, 0.85);

    // mirrors
    const mp = surfaceAt(0.42, 0.98 * side);
    const mirror = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), m.carbon);
    mirror.scale.set(0.1, 0.055, 0.075);
    mirror.position.set(0.38, mp.y + 0.2, side * 1.0);
    body.add(mirror);
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.14), m.carbon);
    stalk.position.set(0.4, mp.y + 0.17, side * 0.92);
    body.add(stalk);
  }

  // full-width tail-light bar
  const tailY = 0.835;
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.022, 1.62), m.tail);
  tailBar.position.set(CAR.rear - 0.004, tailY, 0);
  body.add(tailBar);
  for (const side of [-1, 1]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.2), m.tail);
    tl.position.set(CAR.rear + 0.02, tailY - 0.02, side * 0.72);
    tl.rotation.y = side * 0.25;
    body.add(tl);
    addGlow(body, '#ff2a14', CAR.rear - 0.06, tailY - 0.02, side * 0.72, 0.42, 0.9);
  }
  addGlow(body, '#ff2a14', CAR.rear - 0.05, tailY, 0, 0.3, 0.55);

  // ---- plates
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture(plate), roughness: 0.35, metalness: 0.1 });
  const plateGeo = new THREE.PlaneGeometry(0.52, 0.11);
  const fp = new THREE.Mesh(plateGeo, plateMat);
  fp.position.set(CAR.front + 0.012, 0.31, 0);
  fp.rotation.y = Math.PI / 2;
  body.add(fp);
  const rp = new THREE.Mesh(plateGeo, plateMat);
  rp.position.set(CAR.rear - 0.012, 0.5, 0);
  rp.rotation.y = -Math.PI / 2;
  body.add(rp);

  // ---- wheels: root → (steer) → spin → visual
  const wheels: { steer: THREE.Group; spin: THREE.Group; blurMat: THREE.MeshBasicMaterial; radius: number; front: boolean }[] = [];
  for (const front of [true, false]) {
    for (const side of [-1, 1] as const) {
      const R = front ? CAR.frontR : CAR.rearR;
      const W = front ? CAR.frontTyreW : CAR.rearTyreW;
      const steer = new THREE.Group();
      steer.position.set(front ? CAR.frontAxle : CAR.rearAxle, R, side * (front ? CAR.frontTrack : CAR.rearTrack));
      const spin = new THREE.Group();
      const { visual, blurMat } = buildWheel(m, R, W, side);
      visual.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
      });
      spin.add(visual);
      steer.add(spin);
      // caliper (does not spin)
      const cal = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 16, 0.9), m.caliper);
      cal.position.z = side * (W / 2 - 0.15);
      cal.rotation.z = front ? 0.35 : 2.0;
      cal.scale.z = 1.4;
      steer.add(cal);
      root.add(steer);
      wheels.push({ steer, spin, blurMat, radius: R, front });
    }
  }

  // ---- headlight beams (real lights for the road) + tail glow on tarmac
  const beams: THREE.SpotLight[] = [];
  for (const side of [-1, 1]) {
    const spot = new THREE.SpotLight('#eaf0ff', 60, 45, 0.42, 0.55, 1.6);
    spot.position.set(2.1, 0.62, side * 0.62);
    spot.target.position.set(12, 0, side * 1.2);
    body.add(spot);
    body.add(spot.target);
    beams.push(spot);
  }
  const tailLight = new THREE.PointLight('#ff2010', 2.2, 5, 2);
  tailLight.position.set(CAR.rear - 0.3, 0.6, 0);
  body.add(tailLight);

  return {
    root,
    body,
    wheels,
    glows,
    materials: m,
    /** Apply car state for this frame. */
    update(state: { x: number; z: number; yaw: number; steer: number; s: number; speed: number; pitch: number; idle: number; t: number }) {
      root.position.set(state.x, 0, state.z);
      root.rotation.y = state.yaw;
      // squat: rotate about the rear axle so the nose lifts under power
      body.rotation.z = state.pitch;
      body.position.y = Math.abs(state.pitch) * 0.6 + state.idle * 0.0012 * Math.sin(state.t * 2 * Math.PI * 14);
      for (const w of wheels) {
        w.spin.rotation.z = -state.s / w.radius;
        w.steer.rotation.y = w.front ? state.steer : 0;
        const revPerSec = state.speed / (2 * Math.PI * w.radius);
        w.blurMat.opacity = Math.min(0.92, Math.max(0, (revPerSec - 1.2) / 2.5));
      }
    },
  };
}
