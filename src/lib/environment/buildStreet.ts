import * as THREE from 'three';
import {
  asphaltTexture, glowTexture, hedgeTexture, mulberry32, poolTexture, stoneTexture, windowsTexture,
} from '../textures';

/**
 * Procedural residential street at blue hour: road along +x, lanes z ∈ [-4.2, 4.2],
 * hero property with an open gate at x = 0 on the +z side.
 */

export const SKY = {
  zenith: new THREE.Color('#0a1734'),
  mid: new THREE.Color('#25406f'),
  horizon: new THREE.Color('#7d8fb4'),
  warm: new THREE.Color('#ff9a5c'),
  ground: new THREE.Color('#0b0d12'),
  sunDir: new THREE.Vector3(1, 0.02, -0.35).normalize(),
};

export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: SKY.zenith },
      mid: { value: SKY.mid },
      horizon: { value: SKY.horizon },
      warm: { value: SKY.warm },
      ground: { value: SKY.ground },
      sunDir: { value: SKY.sunDir },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith, mid, horizon, warm, ground, sunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        c = mix(c, zenith, smoothstep(0.15, 0.75, h));
        float sun = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z))), 0.0);
        float band = exp(-max(h, 0.0) * 9.0);
        c += warm * pow(sun, 5.0) * band * 0.85;
        c += warm * 0.12 * band;
        c = mix(c, ground, smoothstep(0.0, -0.06, h));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function std(color: string, roughness = 0.85, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

function repeatTex(t: THREE.Texture, rx: number, ry: number) {
  const c = t.clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  c.needsUpdate = true;
  return c;
}

const X0 = -140;
const X1 = 340;

export function buildStreet() {
  const world = new THREE.Group();
  const rnd = mulberry32(2024);
  const glowTex = glowTexture();
  const poolTex = poolTexture();

  const glow = (color: string, x: number, y: number, z: number, s: number, opacity = 1) => {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    sp.position.set(x, y, z);
    sp.scale.setScalar(s);
    world.add(sp);
    return sp;
  };
  const pool = (color: string, x: number, z: number, sx: number, sz: number, opacity: number, y = 0.02) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(sx, sz),
      new THREE.MeshBasicMaterial({
        map: poolTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    world.add(m);
    return m;
  };

  // ---- sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMaterial());
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  world.add(sky);

  // ---- ground planes
  const L = X1 - X0;
  const cx = (X0 + X1) / 2;
  const asph = asphaltTexture();
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(L, 8.4),
    new THREE.MeshStandardMaterial({ map: repeatTex(asph, L / 7, 8.4 / 7), roughness: 0.82, metalness: 0.0 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(cx, 0, 0);
  road.receiveShadow = true;
  world.add(road);

  // double yellow centre line
  const yellow = std('#b8901f', 0.6, 0, { emissive: '#3a2a05', emissiveIntensity: 0.3 });
  for (const z of [-0.09, 0.09]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.1), yellow);
    line.rotation.x = -Math.PI / 2;
    line.position.set(cx, 0.006, z);
    line.receiveShadow = true;
    world.add(line);
  }

  const lawn = std('#1f2f1a', 0.95);
  const concrete = new THREE.MeshStandardMaterial({ map: stoneTexture(5, '#8d8a84'), roughness: 0.9 });
  for (const side of [-1, 1]) {
    const park = new THREE.Mesh(new THREE.PlaneGeometry(L, 3.4), lawn);
    park.rotation.x = -Math.PI / 2;
    park.position.set(cx, 0.015, side * 6.05);
    park.receiveShadow = true;
    world.add(park);
    // curb, with a gap for the hero driveway
    const segs = side > 0 ? [[X0, -3.2], [3.2, X1]] : [[X0, X1]];
    for (const [a, b] of segs) {
      world.add(box(b - a, 0.13, 0.22, concrete, (a + b) / 2, 0.065, side * 4.3, false));
    }
  }
  const far = new THREE.Mesh(new THREE.PlaneGeometry(L, 400), std('#0f140f', 1));
  far.rotation.x = -Math.PI / 2;
  far.position.set(cx, -0.01, 0);
  far.receiveShadow = true;
  world.add(far);

  // ---- hero driveway, gate and house
  const paver = new THREE.MeshStandardMaterial({ map: repeatTex(stoneTexture(9, '#9c9488'), 3, 10), roughness: 0.8 });
  const drive = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 26), paver);
  drive.rotation.x = -Math.PI / 2;
  drive.position.set(0, 0.018, 4.35 + 13);
  drive.receiveShadow = true;
  world.add(drive);

  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(3, '#cdbfa6'), roughness: 0.75 });
  const lantern = std('#1a1a1a', 0.5, 0.6);
  const lanternGlass = new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb45e', emissiveIntensity: 7 });
  const pillarLights: THREE.PointLight[] = [];
  for (const sx of [-1, 1]) {
    const px = sx * 3.15;
    world.add(box(0.75, 2.8, 0.75, stone, px, 1.4, 8.2));
    world.add(box(0.9, 0.14, 0.9, stone, px, 2.87, 8.2));
    world.add(box(0.32, 0.5, 0.32, lantern, px, 3.2, 8.2));
    world.add(box(0.24, 0.38, 0.24, lanternGlass, px, 3.2, 8.2, false));
    glow('#ffb860', px, 3.2, 8.2, 2.2, 0.9);
    const pl = new THREE.PointLight('#ffb35a', 14, 14, 2);
    pl.position.set(px, 3.0, 7.6);
    world.add(pl);
    pillarLights.push(pl);
    pool('#ffb45e', px, 7.0, 6, 6, 0.35);

    // gate leaf: hinged at the pillar, swung open inward
    const leaf = new THREE.Group();
    const bars = std('#121314', 0.45, 0.8);
    const w = 2.65;
    leaf.add(box(w, 0.08, 0.06, bars, -sx * w / 2, 0.25, 0, false));
    leaf.add(box(w, 0.08, 0.06, bars, -sx * w / 2, 2.1, 0, false));
    for (let i = 0; i <= 14; i++) {
      leaf.add(box(0.035, 1.95, 0.035, bars, -sx * (0.05 + (i / 14) * (w - 0.1)), 1.18, 0, true));
    }
    leaf.position.set(px - sx * 0.4, 0, 8.2);
    leaf.rotation.y = sx * 1.75;
    world.add(leaf);
  }

  // driveway bollard lights + boxwood balls
  const boxwood = new THREE.MeshStandardMaterial({ map: repeatTex(hedgeTexture(21), 1, 1), roughness: 0.95 });
  for (let i = 0; i < 6; i++) {
    const z = 10.5 + i * 2.4;
    for (const sx of [-1, 1]) {
      world.add(box(0.12, 0.5, 0.12, lantern, sx * 2.95, 0.25, z, false));
      glow('#ffc27a', sx * 2.95, 0.5, z, 0.7, 0.8);
      pool('#ffb45e', sx * 2.95, z, 1.8, 1.8, 0.35, 0.025);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), boxwood);
      ball.position.set(sx * 3.8, 0.45, z + 1.1);
      ball.castShadow = true;
      world.add(ball);
    }
  }

  const stucco = new THREE.MeshStandardMaterial({ map: stoneTexture(13, '#d9d3c7'), roughness: 0.9 });
  const darkGlass = std('#0a0c10', 0.15, 0.3);
  const facade = (w: number, h: number, x: number, y: number, z: number, cols: number, rows: number, seed: number, face: 1 | -1, lit = 0.8) => {
    const tex = windowsTexture(seed, cols, rows, lit);
    const mat = new THREE.MeshStandardMaterial({
      color: '#0b0d10', emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 2.2, roughness: 0.12, metalness: 0.3,
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    p.position.set(x, y, z);
    p.rotation.y = face > 0 ? 0 : Math.PI;
    world.add(p);
  };

  // hero house: modern two-volume composition behind the gate
  const hz = 27;
  world.add(box(24, 3.6, 11, stucco, 0, 1.8, hz));
  facade(20, 3.0, 0, 1.65, hz - 5.51, 8, 1, 31, -1, 0.95);
  world.add(box(19, 3.3, 10, stucco, 2.5, 5.25, hz + 0.8));
  facade(15, 2.2, 2.5, 5.2, hz - 4.21, 6, 1, 37, -1, 0.7);
  world.add(box(26, 0.28, 13.5, stucco, 0.5, 3.74, hz - 0.4));
  world.add(box(21, 0.28, 12, stucco, 2.5, 7.04, hz + 0.6));
  // warm uplights washing the facade
  for (let i = -4; i <= 4; i++) {
    glow('#ffbd75', i * 2.6, 0.4, hz - 6.2, 1.6, 0.7);
  }
  pool('#ffb860', 0, hz - 7.5, 26, 6, 0.4, 0.03);
  void darkGlass;

  // ---- hedges with driveway gaps
  const hedgeBase = hedgeTexture(11);
  const hedgeRuns = (side: 1 | -1, gaps: number[]) => {
    const pts = [X0, ...gaps.flatMap((g) => [g - 2.9, g + 2.9]), X1];
    for (let i = 0; i < pts.length; i += 2) {
      let a = pts[i];
      const b = pts[i + 1];
      while (a < b - 0.5) {
        const len = Math.min(b - a, 10 + rnd() * 14);
        const h = 3.2 + rnd() * 1.4;
        const mat = new THREE.MeshStandardMaterial({ map: repeatTex(hedgeBase, len / 2.2, h / 2.2), roughness: 0.95 });
        const m = box(len, h, 1.3, mat, a + len / 2, h / 2, side * 8.2);
        world.add(m);
        a += len;
      }
    }
  };
  hedgeRuns(1, [0, 52, 118, 186, 250]);
  hedgeRuns(-1, [-34, 26, 88, 150, 214, 280]);

  // gap pillars at other driveways
  for (const [gx, side] of [[52, 1], [118, 1], [186, 1], [250, 1], [-34, -1], [26, -1], [88, -1], [150, -1], [214, -1], [280, -1]] as const) {
    for (const sx of [-1, 1]) {
      world.add(box(0.6, 2.4, 0.6, stone, gx + sx * 2.9, 1.2, side * 8.2));
      glow('#ffb860', gx + sx * 2.9, 2.55, side * 8.2, 1.4, 0.75);
    }
    pool('#ffb45e', gx, side * 6.6, 7, 4, 0.22);
  }

  // ---- neighbouring houses peeking over hedges
  const houseXs = [-80, -40, 30, 60, 95, 125, 160, 195, 230, 270, 300];
  for (const [i, hx] of houseXs.entries()) {
    for (const side of [-1, 1] as const) {
      if (side > 0 && Math.abs(hx) < 18) continue;
      const w = 14 + rnd() * 10, h = 5 + rnd() * 3.5, d = 10;
      const z = side * (17 + rnd() * 6);
      world.add(box(w, h, d, stucco, hx + (rnd() - 0.5) * 8, h / 2, z, false));
      facade(w * 0.8, h * 0.5, hx, h * 0.62, z - side * (d / 2 + 0.02), 6, 2, 100 + i * 7 + (side > 0 ? 1 : 0), (-side) as 1 | -1, 0.55);
    }
  }

  // ---- palms
  const trunkMat = std('#3a3129', 0.95);
  const frondMat = new THREE.MeshStandardMaterial({ color: '#1e2c1a', roughness: 0.9, side: THREE.DoubleSide });
  const frondGeo = (() => {
    const s = new THREE.Shape();
    const n = 18;
    s.moveTo(0, 0);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const w = Math.sin(Math.PI * Math.min(1, t * 1.1)) * 0.42 * (i % 2 ? 1 : 0.55);
      s.lineTo(t * 4.2, w);
    }
    for (let i = n; i >= 1; i--) {
      const t = i / n;
      const w = Math.sin(Math.PI * Math.min(1, t * 1.1)) * 0.42 * (i % 2 ? 0.55 : 1);
      s.lineTo(t * 4.2, -w);
    }
    const g = new THREE.ShapeGeometry(s, 1);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setY(i, 0.35 * x - 0.11 * x * x); // arching droop
    }
    g.computeVertexNormals();
    return g;
  })();
  const palm = (x: number, z: number, h: number) => {
    const g = new THREE.Group();
    const lean = (rnd() - 0.5) * 0.06;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.3, h, 10, 6), trunkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    g.add(trunk);
    const crown = new THREE.Group();
    crown.position.y = h;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const f = new THREE.Mesh(frondGeo, frondMat);
      f.rotation.y = (i / n) * Math.PI * 2 + rnd() * 0.3;
      f.rotation.z = (rnd() - 0.4) * 0.5;
      f.scale.setScalar(0.85 + rnd() * 0.35);
      f.castShadow = true;
      crown.add(f);
    }
    g.add(crown);
    g.position.set(x, 0, z);
    g.rotation.z = lean;
    g.rotation.x = lean * 0.5;
    world.add(g);
  };
  for (let x = -120; x < 330; x += 19 + rnd() * 8) {
    for (const side of [-1, 1]) {
      if (side > 0 && Math.abs(x) < 6) continue;
      palm(x + rnd() * 3, side * (6.2 + rnd() * 0.8), 15 + rnd() * 5);
    }
  }

  // ---- street lamps
  const poleMat = std('#1b1c1e', 0.55, 0.7);
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff1d6', emissive: '#ffc77f', emissiveIntensity: 8 });
  for (let x = -110, i = 0; x < 330; x += 27, i++) {
    const side = i % 2 ? 1 : -1;
    const z = side * 5.1;
    world.add(box(0.14, 6.2, 0.14, poleMat, x, 3.1, z));
    world.add(box(0.1, 0.1, 1.3, poleMat, x, 6.15, z - side * 0.6, false));
    world.add(box(0.38, 0.16, 0.5, poleMat, x, 6.06, z - side * 1.25, false));
    world.add(box(0.28, 0.04, 0.38, bulbMat, x, 5.97, z - side * 1.25, false));
    glow('#ffc47a', x, 5.92, z - side * 1.25, 2.8, 0.95);
    pool('#ffbf73', x, z - side * 2.2, 11, 9, 0.42);
  }

  // ---- distant hills silhouette
  const hillMat = new THREE.MeshBasicMaterial({ color: '#141b2c', fog: true });
  for (let i = 0; i < 9; i++) {
    const r = 60 + rnd() * 70;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
    const ang = -0.9 + (i / 8) * 1.8;
    hill.position.set(Math.cos(ang) * 420, -r * 0.55, Math.sin(ang) * 420);
    hill.scale.y = 0.45;
    world.add(hill);
  }

  return { world, pillarLights };
}

/** Pre-filtered environment for reflections: the dusk sky plus warm practical lights. */
export function buildEnvironmentMap(renderer: THREE.WebGLRenderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMaterial()));
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb060').multiplyScalar(6) });
  const cool = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fb6ff').multiplyScalar(1.4) });
  const add = (mat: THREE.Material, w: number, h: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  // street-lamp and window highlights that streak across the clearcoat
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    add(warm, 1.2, 0.5, Math.cos(a) * 30, 12 + (i % 3) * 2, Math.sin(a) * 30);
  }
  add(warm, 26, 2.5, 0, 4, 40);
  add(cool, 60, 10, 0, 40, 0);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: '#08090c' }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1;
  env.add(ground);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  return rt.texture;
}
