// Procedural material maps for the AIR 6770.
// Everything is generated at load time from seeded noise, so the model
// needs no downloaded texture files. Height fields are turned into
// tangent-space normal maps (OpenGL convention, +Y up).
import * as THREE from 'three';
import { logoImage } from './logo.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable value noise, sampled on a period-p lattice.
function valueNoise(size, period, seed) {
  const r = rng(seed);
  const g = new Float32Array(period * period).map(() => r());
  const out = new Float32Array(size * size);
  const s = period / size;
  for (let y = 0; y < size; y++) {
    const fy = y * s, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
    const r0 = (y0 % period) * period, r1 = ((y0 + 1) % period) * period;
    for (let x = 0; x < size; x++) {
      const fx = x * s, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
      const c0 = x0 % period, c1 = (x0 + 1) % period;
      const a = g[r0 + c0] + (g[r0 + c1] - g[r0 + c0]) * sx;
      const b = g[r1 + c0] + (g[r1 + c1] - g[r1 + c0]) * sx;
      out[y * size + x] = a + (b - a) * sy;
    }
  }
  return out;
}

function fbm(size, basePeriod, octaves, seed, gain = 0.5) {
  const out = new Float32Array(size * size);
  let amp = 1, period = basePeriod, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(size, period, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp; amp *= gain; period *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// Tileable Worley (cellular) noise: returns F1 and F2 distances in cell units.
function worley(size, cells, seed) {
  const r = rng(seed);
  const pts = new Float32Array(cells * cells * 2);
  for (let i = 0; i < cells * cells; i++) { pts[i * 2] = r(); pts[i * 2 + 1] = r(); }
  const f1 = new Float32Array(size * size), f2 = new Float32Array(size * size);
  const cs = size / cells;
  for (let y = 0; y < size; y++) {
    const cy = Math.floor(y / cs), py = y / cs;
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cs), px = x / cs;
      let d1 = 9, d2 = 9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const gx = cx + i, gy = cy + j;
        const wx = ((gx % cells) + cells) % cells, wy = ((gy % cells) + cells) % cells;
        const k = (wy * cells + wx) * 2;
        const dx = gx + pts[k] - px, dy = gy + pts[k + 1] - py;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      f1[y * size + x] = d1; f2[y * size + x] = d2;
    }
  }
  return { f1, f2 };
}

function normalCanvas(h, size, strength, wrap = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const at = (x, y) => {
    if (wrap) { x = (x + size) % size; y = (y + size) % size; }
    else { x = Math.min(size - 1, Math.max(0, x)); y = Math.min(size - 1, Math.max(0, y)); }
    return h[y * size + x];
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * size + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
    img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function greyCanvas(h, size, lo = 0, hi = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < h.length; i++) {
    const v = Math.max(0, Math.min(255, (lo + (hi - lo) * h[i]) * 255));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// A lit preview of a height field, used for the material swatches (drawn at display size).
function shadedSwatch(h, size, color, strength = 3, out = 192) {
  const c = document.createElement('canvas');
  c.width = c.height = out;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(out, out);
  const col = new THREE.Color(color);
  const lx = -0.5, ly = 0.6, lz = 0.62, ll = Math.hypot(lx, ly, lz);
  const step = size / out;
  for (let y = 0; y < out; y++) for (let x = 0; x < out; x++) {
    const sx = Math.floor(x * step), sy = Math.floor(y * step);
    const xm = (sx - 1 + size) % size, xp = (sx + 1) % size, ym = (sy - 1 + size) % size, yp = (sy + 1) % size;
    const dx = (h[sy * size + xp] - h[sy * size + xm]) * strength, dy = (h[yp * size + sx] - h[ym * size + sx]) * strength;
    const nl = Math.hypot(dx, dy, 1);
    const d = Math.max(0, (-dx * lx + dy * ly + lz) / (nl * ll)) * 0.85 + 0.3;
    const i = (y * out + x) * 4;
    img.data[i] = Math.min(255, col.r * d * 255); img.data[i + 1] = Math.min(255, col.g * d * 255);
    img.data[i + 2] = Math.min(255, col.b * d * 255); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(canvas, { repeat = 1, srgb = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

// ——— Individual maps ———

function leather(size) {
  // Pebbled full-grain: domed cells with fine creases between them.
  const { f1, f2 } = worley(size, 34, 7);
  const n = fbm(size, 16, 3, 11);
  const h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) {
    const ridge = Math.min(1, (f2[i] - f1[i]) * 2.4);
    h[i] = Math.sqrt(ridge) * 0.85 + n[i] * 0.25;
  }
  return h;
}

function suede(size) {
  const r = rng(23);
  const fine = new Float32Array(size * size).map(() => r());
  const soft = fbm(size, 8, 4, 29);
  const h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) h[i] = fine[i] * 0.35 + soft[i] * 0.65;
  return h;
}

function foam(size) {
  const { f1 } = worley(size, 60, 41);
  const n = fbm(size, 32, 3, 43);
  const h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) h[i] = Math.min(1, f1[i]) * 0.4 + n[i] * 0.6;
  return h;
}

function woven(size, threads = 32) {
  // Plain weave: alternating over/under threads.
  const h = new Float32Array(size * size);
  const n = fbm(size, 64, 2, 53);
  const p = size / threads;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cx = Math.floor(x / p), cy = Math.floor(y / p);
    const fx = (x % p) / p, fy = (y % p) / p;
    const over = (cx + cy) % 2 === 0;
    const a = Math.sin(fx * Math.PI), b = Math.sin(fy * Math.PI);
    h[y * size + x] = (over ? 0.55 + 0.45 * b * Math.sin(fx * Math.PI * 0.999) : 0.55 * a * 0.8) * 0.85 + n[y * size + x] * 0.15;
  }
  return h;
}

function honeycomb(size, cells = 12) {
  const h = new Float32Array(size * size);
  const s = size / cells;
  const hx = s, hy = s * Math.sqrt(3) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let best = 9;
    const row = Math.round(y / hy);
    for (let rr = row - 1; rr <= row + 1; rr++) {
      const off = (rr % 2) * hx / 2;
      const col = Math.round((x - off) / hx);
      for (let cc = col - 1; cc <= col + 1; cc++) {
        const d = Math.hypot(x - (cc * hx + off), y - rr * hy) / s;
        if (d < best) best = d;
      }
    }
    h[y * size + x] = best < 0.42 ? 1 : Math.max(0, 1 - (best - 0.42) * 12);
  }
  return h;
}

// ——— Outsole tread ———
// Drawn in sole space: x ∈ [X0, X1] maps to canvas width, z ∈ [-ZH, ZH] to height.
// White is a raised lug, black is a groove.
export const TREAD = { X0: -1.56, X1: 1.58, ZH: 0.62, W: 1024, H: 400 };

function drawTread(logo) {
  const { X0, X1, ZH, W, H } = TREAD;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const px = (x) => ((x - X0) / (X1 - X0)) * W;
  const pz = (z) => ((z + ZH) / (2 * ZH)) * H;
  const k = W / (X1 - X0); // pixels per unit
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#000'; g.lineCap = 'round';

  // Forefoot pivot: concentric rings and radial grooves.
  const fx = px(0.86), fz = pz(0);
  g.lineWidth = 0.022 * k;
  for (const rad of [0.07, 0.15, 0.24, 0.33]) { g.beginPath(); g.arc(fx, fz, rad * k, 0, Math.PI * 2); g.stroke(); }
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    g.beginPath(); g.moveTo(fx + Math.cos(t) * 0.33 * k, fz + Math.sin(t) * 0.33 * k);
    g.lineTo(fx + Math.cos(t) * 0.62 * k, fz + Math.sin(t) * 0.62 * k); g.stroke();
  }
  // Toe flex grooves.
  g.lineWidth = 0.026 * k;
  for (const x of [1.24, 1.36]) { g.beginPath(); g.moveTo(px(x), 0); g.quadraticCurveTo(px(x + 0.06), H / 2, px(x), H); g.stroke(); }
  // Midfoot: offset diamond lugs, rotated 45°.
  g.lineWidth = 0.02 * k;
  g.save(); g.beginPath(); g.rect(px(-0.55), 0, px(0.45) - px(-0.55), H); g.clip();
  for (let i = -30; i < 30; i++) {
    const o = i * 0.11 * k;
    g.beginPath(); g.moveTo(px(-0.55) + o, 0); g.lineTo(px(-0.55) + o + H, H); g.stroke();
    g.beginPath(); g.moveTo(px(-0.55) + o, H); g.lineTo(px(-0.55) + o + H, 0); g.stroke();
  }
  g.restore();
  // Separation between forefoot and midfoot.
  g.lineWidth = 0.03 * k;
  for (const x of [-0.55, 0.45]) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), H); g.stroke(); }
  // Heel: chevrons pointing to the toe, with the monogram embossed in a plate.
  g.lineWidth = 0.024 * k;
  for (let i = 0; i < 6; i++) {
    const x = -1.42 + i * 0.13;
    if (x > -0.62) break;
    g.beginPath(); g.moveTo(px(x), pz(-0.6)); g.lineTo(px(x + 0.09), pz(-0.2)); g.stroke();
    g.beginPath(); g.moveTo(px(x), pz(0.6)); g.lineTo(px(x + 0.09), pz(0.2)); g.stroke();
  }
  // Heel monogram plate.
  g.fillStyle = '#000';
  const lx = px(-1.0), lz = pz(0), ls = 0.36 * k;
  g.beginPath(); g.arc(lx, lz, ls * 0.56, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(lx, lz, ls * 0.5, 0, Math.PI * 2); g.fill();
  if (logo) {
    g.save(); g.translate(lx, lz); g.rotate(Math.PI / 2); // reads upright when the shoe is turned over
    g.drawImage(logo, -ls * 0.42, -ls * 0.42, ls * 0.84, ls * 0.84);
    g.restore();
  }
  // Blur slightly so lugs have rounded shoulders.
  const b = document.createElement('canvas');
  b.width = W; b.height = H;
  const bg = b.getContext('2d');
  bg.filter = 'blur(1.4px)';
  bg.drawImage(c, 0, 0);
  return b;
}

function canvasToHeight(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const h = new Float32Array(c.width * c.height);
  for (let i = 0; i < h.length; i++) h[i] = d[i * 4] / 255;
  return h;
}

function rectNormal(h, w, hh, strength) {
  // Non-square normal map (no wrap) for the tread.
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, hh);
  const at = (x, y) => h[Math.min(hh - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const dx = at(x + 1, y) - at(x - 1, y), dy = at(x, y + 1) - at(x, y - 1);
    let nx = -dx * strength, ny = dy * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    const i = (y * w + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ——— Branding canvases ———

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('500 64px "Bodoni Moda"'),
      document.fonts.load('500 40px "Jost"'),
    ]);
  } catch (e) { /* fall back to system faces */ }
}

function brandCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const spaced = (g, text, x, y, spacing) => {
  // Canvas letterSpacing is not universal yet; lay letters out manually.
  const widths = [...text].map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let cx = x - total / 2;
  [...text].forEach((ch, i) => { g.fillText(ch, cx + widths[i] / 2, y); cx += widths[i] + spacing; });
};

export async function buildTextures(progress = () => {}) {
  await fontsReady();
  const [logoGold, logoBlack, logoCream, logoWhite] = await Promise.all([
    logoImage({ id: 't1', weight: 2.4 }),
    logoImage({ fill: '#000', ring: false, id: 't2', weight: 3 }),
    logoImage({ fill: '#efe3c8', id: 't3', weight: 2.4 }),
    logoImage({ fill: '#fff', id: 't4', weight: 2.6 }),
  ]);
  const S = 512;
  const out = {};

  const hLeather = leather(S); progress(0.12);
  out.leatherN = tex(normalCanvas(hLeather, S, 2.2));
  out.leatherR = tex(greyCanvas(hLeather, S, 0.75, 0.45));
  const hSuede = suede(S); progress(0.2);
  out.suedeN = tex(normalCanvas(hSuede, S, 1.6));
  const hFoam = foam(S); progress(0.28);
  out.foamN = tex(normalCanvas(hFoam, S, 1.2));
  const hWoven = woven(S); progress(0.34);
  out.wovenN = tex(normalCanvas(hWoven, S, 2.4));
  const hComb = honeycomb(S); progress(0.4);
  out.combN = tex(normalCanvas(hComb, S, 3));
  out.combMap = tex(greyCanvas(hComb, S, 0.55, 1), { srgb: true });

  const treadC = drawTread(logoBlack);
  out.treadHeight = { data: canvasToHeight(treadC), w: TREAD.W, h: TREAD.H };
  const treadN = new THREE.CanvasTexture(rectNormal(out.treadHeight.data, TREAD.W, TREAD.H, 5));
  treadN.colorSpace = THREE.NoColorSpace; treadN.anisotropy = 8;
  out.treadN = treadN;
  progress(0.5);

  // Swatches for the materials lab (data URLs of lit height fields).
  const sw = (h, col, s) => shadedSwatch(h, S, col, s).toDataURL('image/jpeg', 0.86);
  out.swatches = {
    leather: sw(hLeather, '#f2c40f', 2.2),
    suede: sw(hSuede, '#4a2a5c', 2),
    gold: sw(hLeather, '#d8b25a', 1.4),
    woven: sw(hWoven, '#2a2522', 2.6),
    foam: sw(hFoam, '#ece3d1', 1.6),
    comb: sw(hComb, '#d3a447', 2),
  };

  // Heel decal: monogram above "AIR 6770". Alpha mask; colour comes from the material.
  out.heelDecal = brandCanvas(512, 700, (g, w, h) => {
    g.drawImage(logoWhite, 86, 40, 340, 340);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 92px "Bodoni Moda", "Didot", Georgia, serif';
    spaced(g, 'AIR 6770', w / 2, 500, 10);
    g.font = '500 36px "Jost", "Futura", sans-serif';
    spaced(g, 'HASSAN ZHANG', w / 2, 610, 14);
  });

  // Lateral medallion.
  out.medallion = brandCanvas(256, 256, (g) => { g.drawImage(logoWhite, 8, 8, 240, 240); });

  // Lateral quarter wordmark.
  out.sideText = brandCanvas(1024, 160, (g, w, h) => {
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 104px "Bodoni Moda", "Didot", Georgia, serif';
    spaced(g, 'AIR 6770', w / 2, h / 2 + 4, 26);
  });

  // Woven tongue label: black ground, gold monogram and lettering, stitched border.
  out.tongueLabel = brandCanvas(512, 640, (g, w, h) => {
    g.fillStyle = '#121010'; g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#f0d98f'); grd.addColorStop(0.5, '#c79f45'); grd.addColorStop(1, '#e8cc7c');
    g.strokeStyle = grd; g.lineWidth = 5; g.setLineDash([16, 10]);
    g.strokeRect(22, 22, w - 44, h - 44); g.setLineDash([]);
    g.drawImage(logoGold, 106, 70, 300, 300);
    g.fillStyle = grd; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 70px "Bodoni Moda", "Didot", Georgia, serif';
    spaced(g, 'AIR 6770', w / 2, 448, 8);
    g.font = '500 30px "Jost", "Futura", sans-serif';
    spaced(g, 'HASSAN ZHANG', w / 2, 528, 12);
  });

  // Heel pull-tab face.
  out.tab = brandCanvas(256, 400, (g, w, h) => {
    g.fillStyle = '#9e1426'; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.18;
    for (let y = 0; y < h; y += 6) { g.fillStyle = y % 12 ? '#000' : '#fff'; g.fillRect(0, y, w, 2); }
    g.globalAlpha = 1;
    g.drawImage(logoCream, 48, 110, 160, 160);
  });

  // Insole print: sole space x ∈ [-1.42, 1.48], z ∈ [-0.5, 0.5].
  out.insole = brandCanvas(1024, 360, (g, w, h) => {
    g.fillStyle = '#e9dcc3'; g.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(90,60,30,${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 2); }
    const hx = ((-0.98 + 1.42) / 2.9) * w;
    g.save(); g.translate(hx, h / 2); g.rotate(Math.PI / 2);
    g.drawImage(logoGold, -95, -95, 190, 190);
    g.fillStyle = '#8c6d2c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '500 26px "Jost", "Futura", sans-serif';
    spaced(g, 'HASSAN ZHANG', 0, 128, 10);
    g.restore();
    const fx = ((0.55 + 1.42) / 2.9) * w;
    g.save(); g.translate(fx, h / 2); g.rotate(Math.PI / 2);
    g.fillStyle = 'rgba(140,109,44,.55)';
    g.font = 'italic 500 30px "Bodoni Moda", Georgia, serif';
    spaced(g, 'Crafted for the uncommon.', 0, 0, 2);
    g.restore();
  });

  // Shoebox lid.
  out.boxLid = brandCanvas(1024, 640, (g, w, h) => {
    g.fillStyle = '#2b1d16'; g.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 20000; i++) { g.fillStyle = `rgba(255,230,200,${r() * 0.025})`; g.fillRect(r() * w, r() * h, 2, 1); }
    g.drawImage(logoGold, w / 2 - 150, 120, 300, 300);
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, '#e9cf83'); grd.addColorStop(0.5, '#c9a24a'); grd.addColorStop(1, '#e9cf83');
    g.fillStyle = grd; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '500 54px "Bodoni Moda", "Didot", Georgia, serif';
    spaced(g, 'HASSAN ZHANG', w / 2, 480, 18);
    g.font = '500 22px "Jost", "Futura", sans-serif';
    spaced(g, 'CRAFTED FOR THE UNCOMMON.', w / 2, 540, 9);
  });
  out.boxSide = brandCanvas(1024, 256, (g, w, h) => {
    g.fillStyle = '#2b1d16'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9a24a'; g.fillRect(0, h - 26, w, 6);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.font = '600 64px "Bodoni Moda", "Didot", Georgia, serif';
    g.fillText('AIR 6770', 60, h / 2 - 10);
    g.font = '500 24px "Jost", "Futura", sans-serif';
    g.fillStyle = '#e8dcc4';
    g.fillText('HERITAGE REFINED  ·  DESIGNED BY JACOB & USAIRAM', 400, h / 2 - 8);
  });
  progress(0.6);
  return out;
}
