// AIR 6770 — procedural 3D model.
//
// The shoe is built on an analytic "last": a surface P(u, φ) where u runs
// heel (0) → toe (1) and φ runs from the top centreline (0) down to the
// bottom edge of the upper (±π/2, + is the lateral side). Each panel of the
// upper is a region of that surface, offset along the normal and given real
// thickness, so overlays sit on top of one another the way leather does.
// The sole unit is built from the footprint outline.
//
// Coordinates: x along the length (toe +x), y up, z across (lateral +z).
// One unit ≈ 10 cm.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TREAD } from './textures.js';

const V3 = THREE.Vector3;
const PI = Math.PI, HALF = Math.PI / 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const cosSpace = (t) => (1 - Math.cos(PI * t)) / 2;

// Monotone cubic interpolation through [x, y] pairs (no overshoot).
function mono(pts) {
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// ——— The last ———
export const X0 = -1.42, X1 = 1.48, LEN = X1 - X0;
const ux = (u) => X0 + u * LEN;
// plan-view half width
const Wc = mono([[0, 0.33], [0.12, 0.36], [0.35, 0.36], [0.5, 0.385], [0.68, 0.45], [0.82, 0.445], [0.93, 0.39], [1, 0.33]]);
// height of the last's top above the footbed
const Tc = mono([[0, 0.96], [0.2, 1.0], [0.4, 0.95], [0.52, 0.84], [0.64, 0.68], [0.76, 0.57], [0.88, 0.49], [1, 0.42]]);
// footbed (top of midsole) and ground (bottom of outsole)
const YB = mono([[0, 0.315], [0.25, 0.3], [0.55, 0.205], [0.75, 0.18], [0.9, 0.21], [1, 0.27]]);
const YG = mono([[0, 0.035], [0.1, 0], [0.7, 0], [0.85, 0.02], [1, 0.1]]);
// collar line (height above footbed) and crimson rand height
const COL = mono([[0, 0.8], [0.07, 0.79], [0.2, 0.63], [0.3, 0.67], [0.36, 0.78], [0.44, 0.92]]);
const HR = mono([[0, 0.115], [0.15, 0.1], [0.6, 0.1], [0.78, 0.13], [0.9, 0.19], [1, 0.215]]);

const E_HEEL = 0.1, E_TOE = 0.17;
function endF(u) {
  if (u < E_HEEL) { const t = 1 - u / E_HEEL; return Math.sqrt(Math.max(0, 1 - t * t)); }
  if (u > 1 - E_TOE) { const t = (u - (1 - E_TOE)) / E_TOE; return Math.sqrt(Math.max(0, 1 - t * t)); }
  return 1;
}
const W = (u) => Wc(u) * endF(u);
const T = (u) => Tc(u) * (u > 1 - E_TOE ? 0.62 + 0.38 * endF(u) : 1);
const EXP = (u) => 2 / (3.0 - 0.8 * u); // boxier at the heel, rounder at the toe

function P(u, phi, out = new V3()) {
  u = clamp(u, 0, 1); phi = clamp(phi, -HALF, HALF);
  const e = EXP(u);
  const s = Math.pow(Math.abs(Math.sin(phi)), e) * Math.sign(phi);
  const c = Math.pow(Math.max(0, Math.cos(phi)), e);
  return out.set(ux(u), YB(u) + T(u) * c, W(u) * s);
}

const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3();
function N(u, phi, out = new V3()) {
  const h = 1e-3;
  P(clamp(u + h, 0, 1), phi, _a); P(clamp(u - h, 0, 1), phi, _b); _a.sub(_b);
  P(u, clamp(phi + h, -HALF, HALF), _c); P(u, clamp(phi - h, -HALF, HALF), _d); _c.sub(_d);
  out.crossVectors(_a, _c);
  if (out.lengthSq() < 1e-16) out.set(0, 1, 0);
  // at the heel and toe tips both halves meet on z = 0, so the normal must lie in that plane
  if (u <= 1e-6 || u >= 1 - 1e-6) out.z = 0;
  out.normalize();
  P(u, phi, _b);
  _d.set(ux(clamp(u, 0.15, 0.85)), YB(u) + T(u) * 0.35, 0);
  if (out.dot(_b.sub(_d)) < 0) out.negate();
  return out;
}

const phiFromHeight = (u, h) => Math.acos(Math.pow(clamp(h / T(u), 0, 1), 1 / EXP(u)));
const phiFromZ = (u, z) => Math.asin(Math.pow(clamp(z / Math.max(W(u), 1e-6), 0, 1), 1 / EXP(u)));

// Opening of the upper: collar around the heel, lacing gap over the instep.
export const U_CF = 0.36, U_TH = 0.62;
const GAP = 0.125;
function gap(u) {
  if (u <= U_CF) return GAP;
  if (u >= U_TH) return 0;
  const t = (u - U_CF) / (U_TH - U_CF);
  return GAP * Math.sqrt(Math.max(0, 1 - Math.pow(t, 6)));
}
function phiTop(u) {
  if (u >= U_TH) return 0;
  const pg = phiFromZ(u, gap(u));
  if (u >= U_CF + 0.04) return pg;
  const pc = phiFromHeight(u, COL(u));
  return lerp(pc, pg, smooth(U_CF - 0.06, U_CF + 0.04, u));
}

function S(u, phi, off) {
  const n = N(u, phi);
  const p = P(u, phi).addScaledVector(n, off);
  return { p, n };
}

// ——— Geometry builders ———

// Explicit tangents: UVs mirror where the lateral and medial halves meet, and the
// screen-space tangents three.js otherwise derives break down along that seam.
function withTangents(g) {
  g.computeTangents();
  const t = g.attributes.tangent.array;
  for (let i = 0; i < t.length; i += 4) {
    if (!Number.isFinite(t[i]) || !Number.isFinite(t[i + 1]) || !Number.isFinite(t[i + 2]) || Math.abs(t[i]) + Math.abs(t[i + 1]) + Math.abs(t[i + 2]) < 1e-6) { t[i] = 1; t[i + 1] = 0; t[i + 2] = 0; t[i + 3] = 1; }
  }
  return g;
}

/**
 * A panel with real thickness. surf(a, b) → { p, n } is the inner face;
 * the outer face is p + n·thick. Groups: 0 outer, 1 inner, 2 edges.
 */
function buildPatch(surf, nu, nv, { thick = 0.006, unitUV = false, uvFn = null, edges = true } = {}) {
  const cols = nu + 1, rows = nv + 1, cnt = cols * rows;
  const P0 = new Array(cnt), NN = new Array(cnt);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const s = surf(i / nu, j / nv);
    P0[j * cols + i] = s.p; NN[j * cols + i] = s.n;
  }
  const U = new Float32Array(cnt), Vv = new Float32Array(cnt);
  if (unitUV) {
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { U[j * cols + i] = i / nu; Vv[j * cols + i] = j / nv; }
  } else if (!uvFn) {
    for (let j = 0; j < rows; j++) { let acc = 0; for (let i = 0; i < cols; i++) { if (i) acc += P0[j * cols + i].distanceTo(P0[j * cols + i - 1]); Vv[j * cols + i] = acc; } }
    for (let i = 0; i < cols; i++) { let acc = 0; for (let j = 0; j < rows; j++) { if (j) acc += P0[j * cols + i].distanceTo(P0[(j - 1) * cols + i]); U[j * cols + i] = acc; } }
  }
  const pos = [], nor = [], uv = [], idx = [];
  const push = (p, n, u, v) => { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(u, v); return pos.length / 3 - 1; };
  const uvOf = (k, p) => (uvFn ? uvFn(p) : [U[k], Vv[k]]);

  // winding: make the outer face point along n
  let flip = false;
  {
    const ic = Math.floor(nu / 2), jc = Math.floor(nv / 2);
    const k = jc * cols + ic;
    const e1 = new V3().subVectors(P0[k + 1], P0[k]), e2 = new V3().subVectors(P0[k + cols], P0[k]);
    flip = new V3().crossVectors(e1, e2).dot(NN[k]) < 0;
  }
  const quad = (a, b, c, d, f) => { if (!f) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); };

  const outerStart = 0;
  for (let k = 0; k < cnt; k++) {
    const p = new V3().copy(P0[k]).addScaledVector(NN[k], thick);
    const [u, v] = uvOf(k, p); push(p, NN[k], u, v);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const k = j * cols + i; quad(k, k + 1, k + cols, k + cols + 1, flip);
  }
  const groups = [[0, idx.length, 0]];
  const innerBase = pos.length / 3;
  const innerIdxStart = idx.length;
  for (let k = 0; k < cnt; k++) {
    const [u, v] = uvOf(k, P0[k]); push(P0[k], NN[k].clone().negate(), u, v);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const k = innerBase + j * cols + i; quad(k, k + 1, k + cols, k + cols + 1, !flip);
  }
  groups.push([innerIdxStart, idx.length - innerIdxStart, 1]);

  if (edges && thick > 0) {
    const edgeStart = idx.length;
    const borders = [
      { line: [...Array(cols).keys()].map((i) => i), inward: cols },
      { line: [...Array(cols).keys()].map((i) => nv * cols + i), inward: -cols },
      { line: [...Array(rows).keys()].map((j) => j * cols), inward: 1 },
      { line: [...Array(rows).keys()].map((j) => j * cols + nu), inward: -1 },
    ];
    const tmp = new V3(), en = new V3(), gn = new V3(), e1 = new V3(), e2 = new V3();
    for (const { line, inward } of borders) {
      // a border that collapses to a vertical line (toe or heel tip) has no visible edge
      let spanXZ = 0;
      for (let q = 1; q < line.length; q++) spanXZ = Math.max(spanXZ, Math.hypot(P0[line[q]].x - P0[line[0]].x, P0[line[q]].z - P0[line[0]].z));
      if (spanXZ < 1e-4) continue;
      const base = pos.length / 3;
      for (const k of line) {
        tmp.subVectors(P0[k + inward], P0[k]);
        en.copy(tmp).addScaledVector(NN[k], -tmp.dot(NN[k])).negate();
        if (en.lengthSq() < 1e-14) en.copy(NN[k]); else en.normalize();
        const po = new V3().copy(P0[k]).addScaledVector(NN[k], thick);
        const [u] = uvOf(k, po);
        push(po, en, u, 0); push(P0[k], en, u, thick);
      }
      for (let q = 0; q < line.length - 1; q++) {
        const o0 = base + q * 2, i0 = o0 + 1, o1 = o0 + 2, i1 = o0 + 3;
        e1.set(pos[o1 * 3] - pos[o0 * 3], pos[o1 * 3 + 1] - pos[o0 * 3 + 1], pos[o1 * 3 + 2] - pos[o0 * 3 + 2]);
        e2.set(pos[i0 * 3] - pos[o0 * 3], pos[i0 * 3 + 1] - pos[o0 * 3 + 1], pos[i0 * 3 + 2] - pos[o0 * 3 + 2]);
        gn.crossVectors(e1, e2);
        if (gn.lengthSq() < 1e-16) continue;
        en.set(nor[o0 * 3], nor[o0 * 3 + 1], nor[o0 * 3 + 2]);
        if (gn.dot(en) > 0) idx.push(o0, o1, i0, o1, i1, i0); else idx.push(o0, i0, o1, o1, i0, i1);
      }
    }
    groups.push([edgeStart, idx.length - edgeStart, 2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  for (const [s, c, m] of groups) g.addGroup(s, c, m);
  return withTangents(g);
}

// A single-sided sheet (decals). UV is the unit square.
function buildSheet(surf, nu, nv) {
  const cols = nu + 1, pos = [], nor = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const s = surf(i / nu, j / nv);
    pos.push(s.p.x, s.p.y, s.p.z); nor.push(s.n.x, s.n.y, s.n.z); uv.push(i / nu, j / nv);
  }
  const k = Math.floor(nv / 2) * cols + Math.floor(nu / 2);
  const p = (q) => new V3(pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]);
  const flip = new V3().crossVectors(p(k + 1).sub(p(k)), p(k + cols).sub(p(k))).dot(new V3(nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2])) < 0;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
    if (!flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Tube with a varying radius along a curve.
function buildTube(points, radius, { radial = 10, seg = null, uvScale = 30 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const segs = seg || Math.max(16, Math.round(curve.getLength() * 140));
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], idx = [];
  const len = curve.getLength();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t);
    const r = typeof radius === 'function' ? radius(t) : radius;
    const Nf = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * PI * 2, cx = -Math.cos(v), cy = Math.sin(v);
      const n = new V3(cx * Nf.x + cy * B.x, cx * Nf.y + cy * B.y, cx * Nf.z + cy * B.z).normalize();
      pos.push(c.x + r * n.x, c.y + r * n.y, c.z + r * n.z); nor.push(n.x, n.y, n.z); uv.push(t * len * uvScale, j / radial);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return withTangents(g);
}

// Stitches: instanced flattened capsules laid along a surface path.
const stitchGeo = (() => { const g = new THREE.CapsuleGeometry(0.0036, 0.013, 2, 6); g.rotateZ(-HALF); return g; })();
function stitchPoints(path, out, { spacing = 0.026, samples = 260, lift = 0.0012 } = {}) {
  const pts = [], nrm = [];
  for (let i = 0; i <= samples; i++) { const s = path(i / samples); pts.push(s.p); nrm.push(s.n); }
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = acc[acc.length - 1];
  let k = 0;
  for (let s = spacing / 2; s < total; s += spacing) {
    while (k < acc.length - 2 && acc[k + 1] < s) k++;
    const f = (s - acc[k]) / Math.max(1e-9, acc[k + 1] - acc[k]);
    const p = new V3().lerpVectors(pts[k], pts[k + 1], f);
    const n = new V3().lerpVectors(nrm[k], nrm[k + 1], f).normalize();
    const t = new V3().subVectors(pts[Math.min(k + 1, pts.length - 1)], pts[Math.max(k - 0, 0)]);
    if (t.lengthSq() < 1e-12) continue;
    t.normalize();
    const y = n.clone().addScaledVector(t, -n.dot(t)).normalize();
    const z = new V3().crossVectors(t, y);
    const m = new THREE.Matrix4().makeBasis(t, y, z);
    m.scale(new V3(1, 0.62, 1));
    m.setPosition(p.addScaledVector(y, lift));
    out.push(m);
  }
}
function stitchMesh(mats, material) {
  const mesh = new THREE.InstancedMesh(stitchGeo, material, mats.length);
  mats.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.stitch = true;
  mesh.castShadow = false;
  return mesh;
}

// ——— Footprint and sole builders ———
const NH = 120;
function footprintLoop() {
  const lat = [];
  for (let i = 0; i <= NH; i++) { const u = cosSpace(i / NH); lat.push({ u, x: ux(u), z: W(u) }); }
  const loop = [...lat, ...lat.slice(1, -1).reverse().map((p) => ({ u: p.u, x: p.x, z: -p.z }))];
  const L = loop.length;
  for (let k = 0; k < L; k++) {
    const a = loop[(k - 1 + L) % L], b = loop[(k + 1) % L];
    const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
    loop[k].nx = -tz / l; loop[k].nz = tx / l;
  }
  return loop;
}

// Closed ring surface: profile is a list of (pt) → { o, y } rows, bottom → top.
function ringSurface(loop, profile, uvK = 4) {
  const L = loop.length, R = profile.length, pos = [], uv = [], idx = [];
  const acc = [0];
  for (let k = 1; k <= L; k++) acc.push(acc[k - 1] + Math.hypot(loop[k % L].x - loop[k - 1].x, loop[k % L].z - loop[k - 1].z));
  for (let r = 0; r < R; r++) for (let k = 0; k <= L; k++) {
    const pt = loop[k % L], { o, y } = profile[r](pt);
    pos.push(pt.x + pt.nx * o, y, pt.z + pt.nz * o); uv.push(acc[k] * uvK, r / (R - 1));
  }
  const cols = L + 1;
  for (let r = 0; r < R - 1; r++) for (let k = 0; k < L; k++) {
    const a = r * cols + k, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // weld the seam normals
  const n = g.attributes.normal;
  for (let r = 0; r < R; r++) {
    const a = r * cols, b = r * cols + L;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
  // make sure faces point outward (lateral mid-point should face +z)
  const k = (Math.floor(L / 4)) + Math.floor(R / 2) * cols;
  if (n.getZ(k) < 0) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.setIndex(idx); g.computeVertexNormals();
  }
  return withTangents(g);
}

// Cap across the footprint: rows from heel tip to toe tip, columns across.
function capSurface(loop, offset, yFn, { rows = NH, cols = 24, down = false, uvFn = null } = {}) {
  const pos = [], uv = [], idx = [];
  const lat = loop.slice(0, NH + 1);
  for (let r = 0; r <= rows; r++) {
    const fi = (r / rows) * NH, i0 = Math.floor(fi), i1 = Math.min(NH, i0 + 1), f = fi - i0;
    const A = lat[i0], B = lat[i1];
    const u = lerp(A.u, B.u, f);
    const o = offset(u);
    const x = lerp(A.x + A.nx * o, B.x + B.nx * o, f);
    const zh = Math.max(0, lerp(A.z + A.nz * o, B.z + B.nz * o, f));
    for (let c = 0; c <= cols; c++) {
      const v = c / cols, z = lerp(-zh, zh, v);
      const edge = r === 0 || r === rows || c === 0 || c === cols;
      const y = yFn(x, z, u, edge);
      pos.push(x, y, z);
      uv.push(...(uvFn ? uvFn(x, z) : [x, z]));
    }
  }
  const cc = cols + 1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * cc + c, b = a + 1, d = a + cc, e = d + 1;
    if (down) idx.push(a, b, d, b, e, d); else idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal, mid = Math.floor(rows / 2) * cc + Math.floor(cols / 2);
  if ((n.getY(mid) < 0) !== down) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.setIndex(idx); g.computeVertexNormals();
  }
  return withTangents(g);
}

// ——— Materials ———
function makeMaterials(tx) {
  const rep = (t, r) => { const c = t.clone(); c.repeat.set(r, r); c.needsUpdate = true; return c; };
  const leatherN = rep(tx.leatherN, 1.3), leatherNfine = rep(tx.leatherN, 2.2), suedeN = rep(tx.suedeN, 3.2);
  const foamN = rep(tx.foamN, 2.2), wovenN = rep(tx.wovenN, 9), laceN = rep(tx.wovenN, 1);
  laceN.repeat.set(1, 1);
  const M = THREE.MeshPhysicalMaterial;
  const m = {
    yellow: new M({ name: 'yellow leather', color: '#efb300', roughness: 0.44, normalMap: leatherN, normalScale: new THREE.Vector2(0.55, 0.55), clearcoat: 0.32, clearcoatRoughness: 0.38 }),
    yellowEdge: new M({ name: 'yellow edge', color: '#c98f00', roughness: 0.5 }),
    suede: new M({ name: 'aubergine suede', color: '#371848', roughness: 0.95, sheen: 0.75, sheenColor: new THREE.Color('#6e4a8a'), sheenRoughness: 0.55, normalMap: suedeN, normalScale: new THREE.Vector2(0.4, 0.4) }),
    suedeBack: new M({ name: 'suede reverse', color: '#1f0e29', roughness: 1 }),
    gold: new M({ name: 'gold leather', color: '#d6b15c', metalness: 1, roughness: 0.3, normalMap: leatherNfine, normalScale: new THREE.Vector2(0.28, 0.28), clearcoat: 0.25, clearcoatRoughness: 0.2 }),
    goldEdge: new M({ name: 'gold edge', color: '#8f6c2a', metalness: 0.6, roughness: 0.45 }),
    patent: new M({ name: 'black patent', color: '#0c0a0a', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, normalMap: leatherN, normalScale: new THREE.Vector2(0.06, 0.06) }),
    red: new M({ name: 'crimson rubber', color: '#ac1329', roughness: 0.4, clearcoat: 0.55, clearcoatRoughness: 0.28, normalMap: leatherNfine, normalScale: new THREE.Vector2(0.2, 0.2) }),
    redEdge: new M({ name: 'crimson edge', color: '#7d0d1d', roughness: 0.5 }),
    foam: new M({ name: 'ivory foam', color: '#eee5d3', roughness: 0.72, normalMap: foamN, normalScale: new THREE.Vector2(0.22, 0.22), sheen: 0.35, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.8 }),
    rubber: new M({ name: 'espresso rubber', color: '#3a2820', roughness: 0.82, normalMap: foamN, normalScale: new THREE.Vector2(0.15, 0.15) }),
    tread: new M({ name: 'tread', color: '#3a2820', roughness: 0.78, normalMap: tx.treadN, normalScale: new THREE.Vector2(1, 1) }),
    lining: new M({ name: 'woven lining', color: '#e9ddc6', roughness: 0.92, normalMap: wovenN, normalScale: new THREE.Vector2(0.5, 0.5), sheen: 0.6, sheenColor: new THREE.Color('#fff6e2'), sheenRoughness: 0.6 }),
    collar: new M({ name: 'ivory nappa', color: '#efe4cf', roughness: 0.5, normalMap: leatherNfine, normalScale: new THREE.Vector2(0.3, 0.3), sheen: 0.25, sheenColor: new THREE.Color('#ffffff') }),
    lace: new M({ name: 'waxed lace', color: '#161312', roughness: 0.55, normalMap: laceN, normalScale: new THREE.Vector2(0.9, 0.9), clearcoat: 0.3, clearcoatRoughness: 0.5 }),
    threadCream: new M({ name: 'ivory thread', color: '#f1e5c9', roughness: 0.7 }),
    threadGold: new M({ name: 'gold thread', color: '#d1aa55', roughness: 0.45, metalness: 0.35 }),
    threadTonal: new M({ name: 'tonal thread', color: '#c99206', roughness: 0.6 }),
    metal: new M({ name: 'gold metal', color: '#dcb866', metalness: 1, roughness: 0.18 }),
    decal: new M({ name: 'gold foil', color: '#e6c574', metalness: 1, roughness: 0.26, alphaTest: 0.45, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    perf: new THREE.MeshStandardMaterial({ name: 'perforation', color: '#160d07', roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    comb: new M({ name: 'cushioning', color: '#d8a446', roughness: 0.35, metalness: 0.15, map: rep(tx.combMap, 4), normalMap: rep(tx.combN, 4), clearcoat: 0.6 }),
    pod: new M({ name: 'cushion chamber', color: '#f6dc98', roughness: 0.05, transparent: true, opacity: 0.42, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, envMapIntensity: 1.6 }),
    podCore: new M({ name: 'chamber core', color: '#a76c1e', roughness: 0.35, emissive: new THREE.Color('#4a2a06'), emissiveIntensity: 1 }),
    insoleTop: new M({ name: 'insole', color: '#ffffff', map: tx.insole, roughness: 0.9, sheen: 0.5, sheenColor: new THREE.Color('#fff4dc') }),
    tabFace: new M({ name: 'pull tab', color: '#ffffff', map: tx.tab, roughness: 0.6 }),
    tabSide: new M({ name: 'pull tab edge', color: '#8f1022', roughness: 0.6 }),
    labelFace: new M({ name: 'woven label', color: '#ffffff', map: tx.tongueLabel, roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  };
  const tabMap = tx.tab; tabMap.wrapS = tabMap.wrapT = THREE.ClampToEdgeWrapping;
  tabMap.repeat.set(1 / 0.11, 1 / 0.17); tabMap.offset.set(0.5, 0.5);
  // The studio environment is bright; dielectrics take less of it so colours stay saturated.
  for (const k in m) if (m[k].metalness < 0.5 && m[k].envMapIntensity !== undefined && k !== 'pod') m[k].envMapIntensity = 0.45;
  m.decalHeel = m.decal.clone(); m.decalHeel.alphaMap = tx.heelDecal; m.decalHeel.bumpMap = tx.heelDecal; m.decalHeel.bumpScale = 1.5;
  m.decalMed = m.decal.clone(); m.decalMed.alphaMap = tx.medallion; m.decalMed.bumpMap = tx.medallion; m.decalMed.bumpScale = 1.5;
  m.decalSide = m.decal.clone(); m.decalSide.alphaMap = tx.sideText;
  return m;
}

// ——— The shoe ———
export function buildShoe(tx) {
  const mat = makeMaterials(tx);
  const shoe = new THREE.Group();
  const parts = {};
  const part = (name) => (parts[name] ||= (() => { const g = new THREE.Group(); g.name = name; shoe.add(g); return g; })());
  const add = (name, geo, material) => { const mesh = new THREE.Mesh(geo, material); mesh.castShadow = true; mesh.receiveShadow = true; part(name).add(mesh); return mesh; };
  const SIDES = [1, -1];
  const stitches = {}; // part → { material, list }
  const stitch = (name, material, path, opts) => {
    const key = name + ':' + material.name;
    (stitches[key] ||= { name, material, list: [] });
    stitchPoints(path, stitches[key].list, opts);
  };

  // Shell — aubergine suede over the whole side.
  const shellSurf = (s) => (a, b) => { const u = cosSpace(b), pt = phiTop(u); return S(u, s * (pt + (HALF - pt) * a), 0); };
  for (const s of SIDES) add('shell', buildPatch(shellSurf(s), 30, 190, { thick: 0.008 }), [mat.suede, mat.lining, mat.suede]);
  // Collar stitch line on the shell, below the padded roll.
  for (const s of SIDES) stitch('shell', mat.threadGold, (t) => { const r = shellSurf(s)(0.075, t * 0.4); r.p.addScaledVector(r.n, 0.008); return r; });

  // Lining — woven textile inside the heel and collar.
  for (const s of SIDES) add('collar', buildPatch((a, b) => { const u = (U_CF + 0.06) * b, pt = phiTop(u); return S(u, s * (pt + 0.01 + (HALF - pt - 0.01) * a), -0.02); }, 20, 60, { thick: 0.006 }), [mat.lining, mat.lining, mat.lining]);

  // Saddle — yellow leather over the instep and eyestays.
  const sadF = mono([[0.3, 0.36], [0.45, 0.5], [0.62, 0.58], [0.8, 0.66]]);
  const uR = (a) => U_CF - 0.04 + 0.1 * a * a, uF = (a) => 0.765 + 0.05 * a * a;
  const saddleSurf = (s, off = 0.008) => (a, b) => {
    const u = lerp(uR(a), uF(a), b), pt = phiTop(u), pl = pt + (HALF - pt) * sadF(u);
    return S(u, s * (pt + (pl - pt) * a), off);
  };
  for (const s of SIDES) {
    add('saddle', buildPatch(saddleSurf(s), 34, 120, { thick: 0.007 }), [mat.yellow, mat.yellowEdge, mat.yellowEdge]);
    const onSaddle = (a, b) => { const r = saddleSurf(s)(a, b); r.p.addScaledVector(r.n, 0.007); return r; };
    stitch('saddle', mat.threadTonal, (t) => onSaddle(0.935, t));
    stitch('saddle', mat.threadTonal, (t) => onSaddle(0.875, t));
    stitch('saddle', mat.threadTonal, (t) => onSaddle(t, 0.035));
    stitch('saddle', mat.threadTonal, (t) => onSaddle(t, 0.965));
    stitch('saddle', mat.threadTonal, (t) => onSaddle(0.06, t * 0.64));
  }

  // Signature stripes — three black patent chevrons across the vamp.
  const PHS = 0.85;
  for (const u0 of [0.655, 0.695, 0.735]) {
    const surf = (a, b) => {
      const phi = (a * 2 - 1) * PHS, taper = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(phi / PHS), 8)));
      const uc = u0 - 0.055 * Math.pow(Math.abs(phi), 1.3);
      return S(uc + (b - 0.5) * 0.017 * Math.max(taper, 0.04), phi, 0.015);
    };
    add('stripes', buildPatch(surf, 70, 6, { thick: 0.0045 }), [mat.patent, mat.patent, mat.patent]);
  }

  // Toe cap — metallic gold, oval rear edge, tucks under the rand.
  const uCap = (s) => 0.8 + 0.075 * Math.pow(Math.abs(s), 2.2);
  const capSurf = (off = 0.008) => (a, b) => {
    const sg = a * 2 - 1, u = uCap(sg) + (1 - uCap(sg)) * Math.sin(b * HALF);
    return S(u, sg * phiFromHeight(u, HR(u) - 0.012), off);
  };
  add('toecap', buildPatch(capSurf(), 64, 64, { thick: 0.008 }), [mat.gold, mat.goldEdge, mat.goldEdge]);
  stitch('toecap', mat.threadCream, (t) => { const r = capSurf()(0.02 + t * 0.96, 0.045); r.p.addScaledVector(r.n, 0.008); return r; });
  { // perforations
    const disc = new THREE.CircleGeometry(0.0075, 12);
    const list = [];
    for (let row = 0; row < 5; row++) {
      const b = 0.2 + row * 0.11, count = 9 - row;
      for (let c = 0; c < count; c++) {
        const a = 0.5 + (c - (count - 1) / 2) * 0.06;
        const r = capSurf(0.0165)(a, b);
        const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), r.n);
        list.push(new THREE.Matrix4().compose(r.p, q, new V3(1, 1, 1)));
      }
    }
    const im = new THREE.InstancedMesh(disc, mat.perf, list.length);
    list.forEach((m4, i) => im.setMatrixAt(i, m4));
    part('toecap').add(im);
  }

  // Heel counter — black patent cup at the rear.
  const UHC = 0.3, hTop = (u) => 0.66 - 0.55 * Math.pow(u / UHC, 1.6);
  const counterSurf = (s, off = 0.008) => (a, b) => {
    const u = UHC * (1 - Math.cos(b * HALF)), h = lerp(hTop(u), HR(u) - 0.02, a);
    return S(u, s * phiFromHeight(u, h), off);
  };
  for (const s of SIDES) {
    add('counter', buildPatch(counterSurf(s), 30, 60, { thick: 0.008 }), [mat.patent, mat.patent, mat.patent]);
    stitch('counter', mat.threadGold, (t) => { const r = counterSurf(s)(0.07, t * 0.93); r.p.addScaledVector(r.n, 0.008); return r; });
  }
  // Heel branding, laid out across the back seam by solving for u at each (z, h).
  const solveU = (z, h) => {
    let lo = 0, hi = 0.3;
    for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (P(m, phiFromHeight(m, h)).z < z) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  add('counter', buildSheet((a, b) => {
    const z = (a * 2 - 1) * 0.14, h = 0.18 + b * 0.38, u = solveU(Math.abs(z), h);
    return S(u, (z < 0 ? -1 : 1) * phiFromHeight(u, h), 0.0175);
  }, 24, 30), mat.decalHeel).castShadow = false;
  // Lateral wordmark on the counter, and the monogram medallion on the quarter.
  add('counter', buildSheet((a, b) => { const u = lerp(0.05, 0.2, a), h = lerp(0.232, 0.3, b); return S(u, phiFromHeight(u, h), 0.0172); }, 40, 6), mat.decalSide).castShadow = false;
  add('shell', buildSheet((a, b) => { const u = lerp(0.2375, 0.2825, a), h = lerp(0.355, 0.485, b); return S(u, phiFromHeight(u, h), 0.0095); }, 12, 12), mat.decalMed).castShadow = false;

  // Rand — crimson band wrapping the base, rising into the toe bumper.
  const randSurf = (s, off = 0.017) => (a, b) => { const u = cosSpace(b); return S(u, s * phiFromHeight(u, HR(u) * (1 - a)), off); };
  for (const s of SIDES) {
    add('rand', buildPatch(randSurf(s), 8, 200, { thick: 0.009 }), [mat.red, mat.redEdge, mat.redEdge]);
    stitch('rand', mat.threadCream, (t) => { const r = randSurf(s)(0.28, 0.01 + t * 0.98); r.p.addScaledVector(r.n, 0.009); return r; }, { spacing: 0.03 });
  }

  // Padded collar roll.
  {
    const pts = [];
    for (let i = 0; i <= 90; i++) {
      const t = i / 90, s = t < 0.5 ? -1 : 1, u = (U_CF + 0.025) * Math.abs(1 - 2 * t);
      const pt = phiTop(u), e = S(u, s * pt, 0.004);
      const up = P(u, s * Math.max(0, pt - 0.02)).sub(P(u, s * pt)).normalize();
      pts.push(e.p.addScaledVector(up, 0.012));
    }
    add('collar', buildTube(pts, (t) => 0.04 * Math.min(1, Math.pow(Math.min(t, 1 - t) / 0.05, 0.5) * 0.7 + 0.3), { radial: 18, uvScale: 1 }), mat.collar);
  }
  // Pull tab.
  {
    const shape = new THREE.Shape();
    const w = 0.055, h = 0.085, r = 0.02;
    shape.moveTo(-w + r, -h); shape.lineTo(w - r, -h); shape.quadraticCurveTo(w, -h, w, -h + r); shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h); shape.lineTo(-w + r, h); shape.quadraticCurveTo(-w, h, -w, h - r); shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 8 });
    g.rotateY(-HALF);
    const top = P(0, phiTop(0));
    g.rotateZ(-0.16);
    g.translate(top.x - 0.034, top.y + 0.0, 0);
    add('collar', g, [mat.tabFace, mat.tabSide]);
  }

  // Tongue — padded, under the eyestays, rising above the collar.
  const TZ = 0.205, TB1 = 0.62, TLEN = 0.34, TRHO = 0.62;
  const pivot = P(U_CF, 0), n0 = N(U_CF, 0), Cc = pivot.clone().addScaledVector(n0, TRHO);
  const back = P(U_CF - 0.01, 0).sub(pivot).normalize();
  const bendSign = (() => { const q = pivot.clone().sub(Cc).applyAxisAngle(new V3(0, 0, 1), 0.01).add(Cc); return q.sub(pivot).dot(back) > 0 ? 1 : -1; })();
  const tongueU = (b) => (b <= TB1 ? lerp(U_TH + 0.04, U_CF, b / TB1) : U_CF);
  const tongueProf = (u, z, b) => {
    const g = gap(u);
    const gapP = g > 1e-3 ? Math.max(0, 1 - (z / g) ** 2) : 0;
    const smoothP = Math.max(0, 1 - (z / TZ) ** 2);
    const k = smooth(TB1 - 0.1, TB1 + 0.04, b);
    return lerp(gapP * Math.min(1, g / GAP), smoothP, k);
  };
  const tongueSurf = (extra = 0, zScale = 1) => (a, b) => {
    const sg = a * 2 - 1;
    const wf = b > 0.86 ? Math.sqrt(Math.max(0, 1 - ((b - 0.86) / 0.14) ** 2)) : 1;
    const z = sg * TZ * wf * zScale, u = tongueU(b);
    const phi = Math.sign(z) * phiFromZ(u, Math.abs(z));
    const r = S(u, phi, -0.032 + 0.03 * tongueProf(u, Math.abs(z), b) + extra);
    if (b > TB1) {
      const ang = bendSign * ((b - TB1) / (1 - TB1)) * TLEN / TRHO, ax = new V3(0, 0, 1);
      r.p.sub(Cc).applyAxisAngle(ax, ang).add(Cc); r.n.applyAxisAngle(ax, ang);
    }
    return r;
  };
  add('tongue', buildPatch(tongueSurf(), 30, 90, { thick: 0.02 }), [mat.yellow, mat.lining, mat.yellowEdge]);
  stitch('tongue', mat.threadTonal, (t) => { const r = tongueSurf(0.02)(0.04, TB1 + t * 0.37); return r; });
  stitch('tongue', mat.threadTonal, (t) => { const r = tongueSurf(0.02)(0.96, TB1 + t * 0.37); return r; });
  // Woven label (reads from the front: texture u runs toward −z).
  add('tongue', buildSheet((a, b) => tongueSurf(0.0215)(1 - lerp(0.32, 0.68, a), lerp(0.66, 0.88, b)), 10, 14), mat.labelFace).castShadow = false;
  const tongueOuter = (u, z) => {
    const b = u <= U_CF ? TB1 : ((U_TH + 0.04 - u) / (U_TH + 0.04 - U_CF)) * TB1;
    return -0.012 + 0.03 * tongueProf(u, Math.abs(z), b);
  };

  // Eyelets and laces.
  const EYE = 6, eyeU = [...Array(EYE).keys()].map((k) => lerp(U_TH - 0.045, U_CF + 0.035, k / (EYE - 1)));
  const eyelet = (k, s) => { const u = eyeU[k], z = gap(u) + 0.038, r = S(u, s * phiFromZ(u, z), 0.015); return { u, z: s * z, ...r }; };
  {
    const ring = new THREE.TorusGeometry(0.02, 0.0065, 10, 26);
    const geos = [];
    for (let k = 0; k < EYE; k++) for (const s of SIDES) {
      const e = eyelet(k, s), g = ring.clone();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), e.n));
      g.translate(e.p.x + e.n.x * 0.001, e.p.y + e.n.y * 0.001, e.p.z + e.n.z * 0.001);
      geos.push(g);
    }
    add('saddle', mergeGeometries(geos), mat.metal);
  }
  const LR = 0.0145;
  const laceAt = (u, z, lift) => {
    const phi = Math.sign(z) * phiFromZ(u, Math.abs(z));
    const base = Math.abs(z) > gap(u) - 0.01 ? Math.max(0.015, tongueOuter(u, z)) : tongueOuter(u, z);
    return S(u, phi, base + LR + lift).p;
  };
  const laceGeos = [];
  const laceSeg = (A, B, extra) => {
    const pts = [S(A.u, Math.sign(A.z) * phiFromZ(A.u, Math.abs(A.z)), 0.0).p];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, u = lerp(A.u, B.u, t), z = lerp(A.z, B.z, t);
      pts.push(laceAt(u, z, 0.002 + (0.01 + extra) * Math.pow(Math.sin(PI * t), 0.6)));
    }
    pts.push(S(B.u, Math.sign(B.z) * phiFromZ(B.u, Math.abs(B.z)), 0.0).p);
    laceGeos.push(buildTube(pts, LR, { radial: 9, uvScale: 1.5 }));
  };
  laceSeg(eyelet(0, 1), eyelet(0, -1), 0);
  for (let k = 0; k < EYE - 1; k++) {
    const over = k % 2 === 0;
    laceSeg(eyelet(k, 1), eyelet(k + 1, -1), over ? 0.016 : 0);
    laceSeg(eyelet(k, -1), eyelet(k + 1, 1), over ? 0 : 0.016);
  }
  // Bow: knot over the top eyelets, two loops, two tails with aglets.
  const knotBase = S(U_CF + 0.01, 0, tongueOuter(U_CF + 0.01, 0) + 0.03);
  const K = knotBase.p, up = knotBase.n.clone(), side = new V3(0, 0, 1), bk = new V3().crossVectors(side, up).normalize();
  const at = (sx, uy, bx) => K.clone().addScaledVector(side, sx).addScaledVector(up, uy).addScaledVector(bk, bx);
  for (const s of SIDES) {
    const e = eyelet(EYE - 1, s);
    laceGeos.push(buildTube([S(e.u, Math.sign(e.z) * phiFromZ(e.u, Math.abs(e.z)), 0).p, laceAt(e.u, e.z * 0.6, 0.012), at(s * 0.03, -0.012, 0.0), K], LR, { radial: 9, uvScale: 1.5 }));
    const big = s > 0 ? 1 : 0.86;
    laceGeos.push(buildTube([K, at(s * 0.06 * big, 0.022, 0.04), at(s * 0.14 * big, 0.0, 0.03), at(s * 0.17 * big, -0.03, -0.01), at(s * 0.11 * big, -0.03, -0.05), at(s * 0.04, -0.008, -0.03), K], LR, { radial: 9, uvScale: 1.5 }));
    const uT = U_CF + 0.05;
    const t1 = S(uT + 0.01, s * phiFromZ(uT + 0.01, 0.28), 0.045).p, t2 = S(uT + 0.03, s * phiFromHeight(uT + 0.03, 0.6), 0.04).p, t3 = S(uT + 0.04, s * phiFromHeight(uT + 0.04, 0.44), 0.03).p;
    laceGeos.push(buildTube([K, at(s * 0.06, 0.012, 0.03), t1, t2, t3], LR, { radial: 9, uvScale: 1.5 }));
    // aglet
    const dir = t3.clone().sub(t2).normalize();
    const ag = new THREE.CylinderGeometry(LR * 1.15, LR * 1.15, 0.05, 12);
    ag.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dir));
    ag.translate(t3.x + dir.x * 0.02, t3.y + dir.y * 0.02, t3.z + dir.z * 0.02);
    add('laces', ag, mat.metal);
  }
  add('laces', mergeGeometries(laceGeos), mat.lace);

  // Insole.
  const slab = (yBot, thick, scale) => (a, b) => {
    const u = lerp(0.012, 0.985, cosSpace(b)), z = (a * 2 - 1) * W(u) * scale, x = ux(u);
    const dy = (YB(clamp(u + 0.002, 0, 1)) - YB(clamp(u - 0.002, 0, 1))) / (0.004 * LEN);
    return { p: new V3(x, YB(u) + yBot, z), n: new V3(-dy, 1, 0).normalize() };
  };
  const solUV = (p) => [(p.x - X0) / LEN, 1 - (p.z + 0.5)];
  add('insole', buildPatch(slab(0.004, 0.03, 0.9), 24, 120, { thick: 0.03, uvFn: solUV }), [mat.insoleTop, mat.foam, mat.foam]);

  // Cushioning layer (inside the midsole) and visible amber chambers at the heel.
  add('cushion', buildPatch(slab(-0.075, 0.035, 0.86), 24, 120, { thick: 0.035, uvFn: (p) => [p.x * 1.2, p.z * 1.2] }), [mat.comb, mat.comb, mat.comb]);
  for (const s of SIDES) {
    const cx = ux(0.17), cy = 0.205, wz = 0.408;
    const glass = new THREE.CapsuleGeometry(0.056, 0.36, 8, 24); glass.rotateZ(HALF); glass.scale(1, 1, 0.55);
    glass.translate(cx, cy, s * wz);
    add('cushion', glass, mat.pod).renderOrder = 2;
    const core = new THREE.CapsuleGeometry(0.044, 0.34, 6, 20); core.rotateZ(HALF); core.scale(1, 1, 0.45);
    core.translate(cx, cy, s * (wz - 0.006));
    add('cushion', core, mat.podCore);
  }

  // Midsole — sculpted ivory cupsole with a lip that hugs the upper.
  const loop = footprintLoop();
  const heel = (u) => smooth(0.3, 0, u);
  const mTop = (u) => 0.048 + 0.02 * heel(u), mBot = (u) => 0.062 + 0.034 * heel(u);
  const yBot = (u) => YG(u) + 0.05, yTop = (u) => YB(u) + 0.045;
  const groove = (u, t) => {
    const tg = 0.46 + 0.1 * Math.sin(u * PI * 2.2 + 0.6);
    return 0.0075 * Math.exp(-(((t - tg) / 0.045) ** 2));
  };
  const ease = (t) => 1 - Math.pow(1 - t, 1.8);
  const mid = [(pt) => ({ o: mBot(pt.u) - 0.006, y: yBot(pt.u) })];
  for (let r = 0; r <= 22; r++) {
    const t = r / 22;
    mid.push((pt) => ({ o: lerp(mBot(pt.u), mTop(pt.u), ease(t)) - groove(pt.u, t), y: lerp(yBot(pt.u), yTop(pt.u), t) }));
  }
  mid.push(
    (pt) => ({ o: mTop(pt.u) - 0.005, y: yTop(pt.u) + 0.004 }),
    (pt) => ({ o: mTop(pt.u) - 0.012, y: yTop(pt.u) + 0.006 }),
    (pt) => ({ o: 0.036, y: yTop(pt.u) + 0.006 }),
    (pt) => ({ o: 0.031, y: yTop(pt.u) + 0.003 }),
    (pt) => ({ o: 0.03, y: yTop(pt.u) - 0.008 }),
    (pt) => ({ o: 0.03, y: YB(pt.u) }),
  );
  add('midsole', ringSurface(loop, mid, 2.4), mat.foam);
  add('midsole', capSurface(loop, () => 0.03, (x, z, u) => YB(u), { cols: 20 }), mat.foam);
  add('midsole', capSurface(loop, (u) => mBot(u) - 0.006, (x, z, u) => yBot(u), { cols: 20, down: true }), mat.foam);

  // Outsole — espresso rubber with a real displaced tread.
  const outRows = [
    (pt) => ({ o: mBot(pt.u) - 0.014, y: YG(pt.u) }),
    (pt) => ({ o: mBot(pt.u) - 0.006, y: YG(pt.u) + 0.005 }),
    (pt) => ({ o: mBot(pt.u) - 0.002, y: YG(pt.u) + 0.016 }),
    (pt) => ({ o: mBot(pt.u), y: YG(pt.u) + 0.032 }),
    (pt) => ({ o: mBot(pt.u) - 0.001, y: YG(pt.u) + 0.05 }),
  ];
  add('outsole', ringSurface(loop, outRows, 4), mat.rubber);
  add('outsole', capSurface(loop, (u) => mBot(u) - 0.001, (x, z, u) => YG(u) + 0.05, { cols: 20 }), mat.rubber);
  const th = tx.treadHeight;
  const treadAt = (x, z) => {
    const fx = ((x - TREAD.X0) / (TREAD.X1 - TREAD.X0)) * (th.w - 1), fz = ((z + TREAD.ZH) / (2 * TREAD.ZH)) * (th.h - 1);
    const x0 = clamp(Math.floor(fx), 0, th.w - 2), z0 = clamp(Math.floor(fz), 0, th.h - 2), ax = fx - x0, az = fz - z0;
    const d = th.data, i = z0 * th.w + x0;
    return lerp(lerp(d[i], d[i + 1], ax), lerp(d[i + th.w], d[i + th.w + 1], ax), az);
  };
  const treadUV = (x, z) => [(x - TREAD.X0) / (TREAD.X1 - TREAD.X0), 1 - (z + TREAD.ZH) / (2 * TREAD.ZH)];
  add('outsole', capSurface(loop, (u) => mBot(u) - 0.014, (x, z, u, edge) => YG(u) + (edge ? 0 : (1 - treadAt(x, z)) * 0.013), { rows: 340, cols: 90, down: true, uvFn: treadUV }), mat.tread);

  // Stitch meshes, one per part and thread colour.
  for (const key in stitches) { const { name, material, list } = stitches[key]; part(name).add(stitchMesh(list, material)); }

  // ——— Centre the shoe and wrap it in a pivot ———
  const box = new THREE.Box3().setFromObject(shoe);
  const center = box.getCenter(new V3());
  const pivotGroup = new THREE.Group();
  shoe.position.sub(center);
  pivotGroup.add(shoe);

  // Give every part its own material instances, so it can be highlighted alone.
  // The highlight is a gold Fresnel rim added in the shader, which keeps each material's own colour.
  const partMats = {};
  const withRim = (m) => {
    const hl = { value: 0 };
    m.userData.hl = hl;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uHl = hl;
      shader.fragmentShader = 'uniform float uHl;\n' + shader.fragmentShader.replace('#include <dithering_fragment>',
        `#include <dithering_fragment>
        float hlRim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
        gl_FragColor.rgb += vec3(1.0, 0.78, 0.36) * uHl * (0.16 + 1.1 * hlRim);`);
    };
    m.customProgramCacheKey = () => 'hz-rim';
    return m;
  };
  for (const name in parts) {
    const cache = new Map();
    partMats[name] = [];
    parts[name].traverse((o) => {
      if (!o.isMesh) return;
      const swap = (m) => {
        if (!cache.has(m)) {
          const c = withRim(m.clone());
          c.userData.stitch = !!o.userData.stitch;
          cache.set(m, c); partMats[name].push(c);
        }
        return cache.get(m);
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
  }

  // Exploded-view offsets and order (outer layers leave first).
  const EXPLODE = {
    laces: [0.15, 2.0, 0], tongue: [0.15, 1.62, 0], collar: [-0.4, 1.28, 0], stripes: [0.05, 1.36, 0],
    saddle: [0, 1.06, 0], toecap: [0.58, 0.88, 0], counter: [-0.6, 0.8, 0], shell: [0, 0.62, 0],
    rand: [0, 0.36, 0], insole: [0, 0.18, 0], cushion: [0, -0.3, 0], midsole: [0, -0.64, 0], outsole: [0, -1.0, 0],
  };
  const order = Object.keys(EXPLODE);
  const partCenters = {};
  for (const name of order) {
    const b = new THREE.Box3().setFromObject(parts[name]);
    partCenters[name] = b.getCenter(new V3()).sub(center); // relative to pivot
    parts[name].userData.explode = new V3(...EXPLODE[name]);
  }
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function setExplode(e) {
    const n = order.length, spread = 0.38;
    order.forEach((name, k) => {
      const d = spread * (k / (n - 1));
      const t = easeIO(clamp((e - d) / (1 - spread), 0, 1));
      parts[name].position.copy(parts[name].userData.explode).multiplyScalar(t);
    });
  }

  function setHighlight(names, k) {
    const set = new Set(names);
    for (const name in partMats) for (const m of partMats[name]) {
      const on = (set.has(name) && !m.userData.stitch) || (set.has('stitches') && m.userData.stitch);
      m.userData.hl.value = on ? k : 0;
    }
  }

  // Anchor points (pivot space) for hotspots and camera targets.
  const A = (r) => ({ p: r.p.clone().sub(center), n: r.n.clone() });
  const atN = (p, n) => ({ p, n: new V3(...n).normalize() });
  const anchors = {
    upper: A(S(0.47, phiFromHeight(0.47, 0.36), 0.01)),
    toebox: A(S(0.975, phiFromHeight(0.975, 0.08) * 0.35, 0.03)),
    stripes: A(S(0.69, 0.25, 0.02)),
    gold: A(S(0.88, 0.25, 0.018)),
    lacing: A({ p: laceAt(eyeU[2], 0, 0.02), n: N(eyeU[2], 0) }),
    collar: A({ p: S(0.012, phiTop(0.012), 0.03).p.add(new V3(0, -0.06, 0)), n: new V3(-1, 0.3, 0) }),
    midsole: A(atN(new V3(ux(0.5), lerp(yBot(0.5), yTop(0.5), 0.5), W(0.5) + 0.05), [0, 0, 1])),
    outsole: A(atN(new V3(ux(0.76), YG(0.76) + 0.02, W(0.76) + 0.055), [0, -0.5, 1])),
    insole: A(atN(new V3(ux(0.13), YB(0.13) + 0.036, 0.0), [0, 1, 0])),
    stitching: A(saddleSurf(1)(0.9, 0.4)),
    // material close-ups
    leather: A(saddleSurf(1)(0.45, 0.35)),
    suede: A(S(0.3, phiFromHeight(0.3, 0.42), 0.01)),
    laces: A({ p: laceAt(eyeU[3], 0, 0.02), n: N(eyeU[3], 0) }),
    rubber: A(atN(new V3(ux(0.17), 0.2, 0.44), [0, 0, 1])),
    emboss: A(atN(new V3(X0 - 0.02, YB(0) + 0.37, 0), [-1, 0, 0])),
    tongue: A(tongueSurf(0.02)(0.5, 0.78)),
    heel: A(atN(new V3(X0, YB(0) + 0.42, 0), [-1, 0, 0])),
  };

  return { root: pivotGroup, shoe, parts, partCenters, anchors, setExplode, setHighlight, center, size: box.getSize(new V3()), materials: mat, groundY: box.min.y - center.y };
}

// Shoebox for the product showcase render.
export function buildShoebox(tx) {
  const g = new THREE.Group();
  const M = THREE.MeshPhysicalMaterial;
  const board = new M({ color: '#2b1d16', roughness: 0.78, sheen: 0.4, sheenColor: new THREE.Color('#6a4a38') });
  const inside = new M({ color: '#c9a24a', roughness: 0.5, metalness: 0.3 });
  const tissue = new M({ color: '#efe6d4', roughness: 0.95, side: THREE.DoubleSide });
  const lidTop = new M({ map: tx.boxLid, roughness: 0.6, metalness: 0.1 });
  const sideMat = new M({ map: tx.boxSide, roughness: 0.75 });
  const L = 3.4, H = 1.2, D = 2.1, t = 0.04;
  // base: four walls and a floor
  const wall = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
  wall(L, t, D, 0, t / 2, 0, board);
  wall(L, H, t, 0, H / 2, D / 2 - t / 2, [board, board, board, board, sideMat, inside]);
  wall(L, H, t, 0, H / 2, -D / 2 + t / 2, [board, board, board, board, inside, board]);
  wall(t, H, D, L / 2 - t / 2, H / 2, 0, board);
  wall(t, H, D, -L / 2 + t / 2, H / 2, 0, board);
  // tissue paper resting inside
  const tg = new THREE.PlaneGeometry(L - 0.1, D - 0.1, 48, 32);
  const pa = tg.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i);
    pa.setZ(i, Math.sin(x * 6.1 + y * 1.7) * 0.035 + Math.sin(y * 8.3 - x * 2.4) * 0.025 + Math.sin(x * 17 + y * 11) * 0.008);
  }
  tg.computeVertexNormals();
  const ts = new THREE.Mesh(tg, tissue); ts.rotation.x = -HALF; ts.position.set(0, H - 0.16, 0); ts.receiveShadow = true; g.add(ts);
  // lid standing behind the base, its foil face turned to the camera
  const lid = new THREE.Group();
  const lt = new THREE.Mesh(new THREE.BoxGeometry(L + 0.06, 0.04, D + 0.06), [board, board, lidTop, board, board, board]);
  lt.castShadow = lt.receiveShadow = true; lid.add(lt);
  const rim = (w, d, x, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), board); b.position.set(x, -0.15, z); b.castShadow = true; lid.add(b); };
  rim(L + 0.06, 0.04, 0, D / 2 + 0.01); rim(L + 0.06, 0.04, 0, -D / 2 - 0.01); rim(0.04, D + 0.06, L / 2 + 0.01, 0); rim(0.04, D + 0.06, -L / 2 - 0.01, 0);
  lid.rotation.x = 1.3; lid.position.set(0, 1.04, -D / 2 - 0.42);
  g.add(lid);
  return g;
}
