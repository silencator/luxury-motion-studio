import * as THREE from 'three';

// Deterministic PRNG so every render of a frame is identical.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, opts: { repeat?: [number, number]; srgb?: boolean } = {}) {
  const tex = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  tex.needsUpdate = true;
  return tex;
}

/** Fine-grained asphalt with aggregate speckle, tar seams and subtle wear. */
export function asphaltTexture(seed = 7) {
  const rnd = mulberry32(seed);
  const { c, ctx } = canvas(1024, 1024);
  ctx.fillStyle = '#2b2c2f';
  ctx.fillRect(0, 0, 1024, 1024);
  const img = ctx.getImageData(0, 0, 1024, 1024);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 34 + (rnd() < 0.02 ? 40 : 0);
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n + 2;
  }
  ctx.putImageData(img, 0, 0);
  // low-frequency blotches (patching / wear)
  for (let i = 0; i < 60; i++) {
    const x = rnd() * 1024, y = rnd() * 1024, r = 40 + rnd() * 160;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const v = rnd() < 0.5 ? '0,0,0' : '90,90,95';
    g.addColorStop(0, `rgba(${v},${0.06 + rnd() * 0.06})`);
    g.addColorStop(1, `rgba(${v},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // tar crack seams
  ctx.strokeStyle = 'rgba(10,10,12,0.55)';
  for (let i = 0; i < 14; i++) {
    ctx.lineWidth = 1 + rnd() * 2;
    ctx.beginPath();
    let x = rnd() * 1024, y = rnd() * 1024;
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (rnd() - 0.5) * 90;
      y += (rnd() - 0.3) * 70;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return finish(c, { repeat: [1, 1] });
}

/** Dense clipped hedge foliage. */
export function hedgeTexture(seed = 11) {
  const rnd = mulberry32(seed);
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = '#16301a';
  ctx.fillRect(0, 0, 512, 512);
  const greens = ['#1b3a1e', '#24492a', '#2e5a30', '#355f2f', '#3f6d36', '#1f4123', '#4a7a3c'];
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 2 + rnd() * 6;
    ctx.fillStyle = greens[Math.floor(rnd() * greens.length)];
    ctx.globalAlpha = 0.5 + rnd() * 0.5;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // dark gaps for depth
  ctx.globalAlpha = 1;
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = 'rgba(5,14,7,0.55)';
    ctx.beginPath();
    ctx.arc(rnd() * 512, rnd() * 512, 1 + rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c, { repeat: [1, 1] });
}

/** Warm stone / stucco. */
export function stoneTexture(seed = 3, base = '#cbbfa8') {
  const rnd = mulberry32(seed);
  const { c, ctx } = canvas(256, 256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const img = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 18;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { repeat: [1, 1] });
}

/** Lit-window facade: emissive map with warm interiors, mullions and curtains. */
export function windowsTexture(seed: number, cols: number, rows: number, litRatio = 0.75) {
  const rnd = mulberry32(seed);
  const W = 512, H = 256;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const cw = W / cols, rh = H / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      if (rnd() > litRatio) continue;
      const x = k * cw + cw * 0.06, y = r * rh + rh * 0.08, w = cw * 0.88, h = rh * 0.84;
      const warm = 0.75 + rnd() * 0.25;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, `rgba(255,${Math.floor(170 * warm)},${Math.floor(95 * warm)},1)`);
      g.addColorStop(1, `rgba(255,${Math.floor(205 * warm)},${Math.floor(140 * warm)},1)`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // interior silhouettes (furniture / curtains)
      ctx.fillStyle = 'rgba(40,20,10,0.45)';
      if (rnd() < 0.6) ctx.fillRect(x + w * rnd() * 0.6, y + h * 0.55, w * 0.3, h * 0.45);
      if (rnd() < 0.4) ctx.fillRect(x, y, w * 0.12, h);
    }
  }
  // mullions
  ctx.fillStyle = '#000';
  for (let k = 0; k <= cols; k++) ctx.fillRect(k * cw - 2, 0, 4, H);
  return finish(c);
}

/** License plate: black plate, white characters. */
export function plateTexture(text: string) {
  const { c, ctx } = canvas(1040, 220);
  ctx.fillStyle = '#060606';
  ctx.fillRect(0, 0, 1040, 220);
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 1020, 200);
  ctx.fillStyle = '#f2f2ee';
  ctx.font = '600 142px "Inter Display", "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '6px';
  ctx.fillText(text, 520, 118);
  return finish(c);
}

/** Soft radial glow sprite (white, tinted by material colour). */
export function glowTexture() {
  const { c, ctx } = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return finish(c, { srgb: false });
}

/** Light pool decal for the road (elliptical falloff). */
export function poolTexture() {
  const { c, ctx } = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return finish(c, { srgb: false });
}

/** Motion-blur disc for fast-spinning wheels (radial-symmetric smear). */
export function wheelBlurTexture() {
  const { c, ctx } = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, 'rgba(40,40,42,0.95)');
  g.addColorStop(0.18, 'rgba(25,25,27,0.92)');
  g.addColorStop(0.55, 'rgba(18,18,20,0.88)');
  g.addColorStop(0.8, 'rgba(60,60,64,0.75)');
  g.addColorStop(0.93, 'rgba(30,30,32,0.6)');
  g.addColorStop(1, 'rgba(20,20,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return finish(c);
}
