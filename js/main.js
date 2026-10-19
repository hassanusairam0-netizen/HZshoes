// HASSAN ZHANG — AIR 6770
// One fixed WebGL stage sits behind the page. Every section declares a camera
// "station"; scrolling blends between stations, and the pinned construction
// section scrubs the exploded view. Interactive sections (360° viewer,
// anatomy, materials) feed their own camera into their station.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildTextures } from './textures.js';
import { buildShoe, buildShoebox } from './shoe.js';
import { logoSVG, logoDataURL, MONOGRAM_PATHS } from './logo.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const TEST = window.__HZ_TEST || {}; // automated checks: settle the camera instantly

// ——— Content ———
const HOTSPOTS = [
  { id: 'upper', title: 'Upper', parts: ['shell', 'saddle'], view: { az: 8, el: 12, dist: 3.9 },
    text: 'The upper is built in layers, not cut from one piece. An aubergine suede shell forms the base. A yellow leather saddle is stitched over the instep, and the heel counter, toe cap and stripes sit on top as separate overlays, so every edge can be finished cleanly.' },
  { id: 'toebox', title: 'Toe box', parts: ['rand', 'toecap'], view: { az: 74, el: 12, dist: 2.7 },
    text: 'The toe is rounded and lifts slightly at the tip, which gives the toes room without looking bulky. A crimson rubber bumper wraps the leading edge, the part of a shoe that takes the most scuffs, and rises higher at the front than along the sides.' },
  { id: 'stripes', title: 'Signature stripes', parts: ['stripes'], view: { az: 38, el: 46, dist: 2.4 },
    text: 'The black brushstrokes across the original become three patent-leather stripes. Each one sweeps back as it runs down the sides, following the curve of the vamp. They are the clearest link to the handmade first version.' },
  { id: 'gold', title: 'Gold accent', parts: ['toecap'], view: { az: 66, el: 30, dist: 2.4 },
    text: 'The painted gold toe of the original becomes a cap of metallic-gold leather with an oval rear edge, as in the first shoe. A field of small perforations breaks up the reflection and lets air in at the front of the foot.' },
  { id: 'lacing', title: 'Lacing system', parts: ['laces', 'tongue'], view: { az: 26, el: 50, dist: 2.5 },
    text: 'Six pairs of reinforced metal eyelets carry round waxed laces. The padded yellow tongue runs under the eyestays, so the laces press on padding rather than on the foot. Lacing tighter or looser adjusts the fit across the instep.' },
  { id: 'collar', title: 'Collar & heel', parts: ['collar', 'counter'], view: { az: -122, el: 22, dist: 3.0 },
    text: 'A rolled ivory collar is padded around the ankle opening. Behind it, a black patent heel counter cups the heel and holds it upright. The HZ monogram and the model name are set in gold at the back, under a crimson pull tab.' },
  { id: 'midsole', title: 'Midsole', parts: ['midsole', 'cushion'], view: { az: 14, el: 3, dist: 3.0 },
    text: 'The ivory cupsole has sculpted walls rather than flat sides, a wider flare at the heel for a stable stance, and a groove that follows the line of the foot. Amber cushioning chambers show through the walls at the heel.' },
  { id: 'outsole', title: 'Outsole', parts: ['outsole'], view: { az: 18, el: -38, dist: 3.8 },
    text: 'The rubber outsole has three tread zones: a pivot circle under the ball of the foot, diamond lugs through the midfoot and chevrons at the heel. Two flex grooves let the toe bend. The HZ monogram is moulded into the heel.' },
  { id: 'insole', title: 'Insole', parts: ['insole'], view: { az: -96, el: 56, dist: 2.7 },
    text: 'The cushioned insole lifts out, so it can be aired or replaced. Its top is a soft textile printed with the HZ monogram at the heel and the house line at the forefoot.' },
  { id: 'stitching', title: 'Stitching & panel construction', parts: ['stitches'], view: { az: 16, el: 20, dist: 2.0 },
    text: 'Every overlay is stitched, not only glued. Double rows run along the saddle, single rows trace the toe cap, heel counter and collar, and a cupsole stitch runs around the crimson rand. Thread is matched to each panel: tonal on yellow, gold on black and aubergine, ivory on gold and crimson.' },
];

const MATERIALS = [
  { id: 'leather', title: 'Yellow leather', where: 'Saddle · tongue', swatch: 'leather', view: { az: 14, el: 28, dist: 1.25 },
    text: 'Pebbled full-grain leather in the signature electric yellow. The grain is pressed in, then a light clear finish gives the colour depth.' },
  { id: 'suede', title: 'Aubergine suede', where: 'Shell · quarters', swatch: 'suede', view: { az: -4, el: 8, dist: 1.15 },
    text: 'Soft suede on the sides and heel. Its nap catches light at an angle, so the colour moves from deep plum to violet as the shoe turns.' },
  { id: 'gold', title: 'Metallic gold', where: 'Toe cap · eyelets · branding', swatch: 'gold', view: { az: 62, el: 30, dist: 1.1 },
    text: 'Leather with a gold metallic finish, perforated on the toe to soften the shine. The eyelets and aglets are polished metal in the same tone.' },
  { id: 'stitching', title: 'Fine stitching', where: 'Every panel edge', swatch: 'leather', view: { az: 10, el: 18, dist: 0.85 },
    text: 'Thread laid at an even pitch along every overlay. Double rows on the saddle, single rows elsewhere, each in a colour chosen for its panel.' },
  { id: 'laces', title: 'Laces & woven textiles', where: 'Laces · lining', swatch: 'woven', view: { az: 30, el: 54, dist: 1.05 },
    text: 'Round waxed laces in black, finished with gold aglets. Inside, a woven ivory lining and a padded nappa collar.' },
  { id: 'rubber', title: 'Sculpted rubber', where: 'Rand · cupsole · outsole', swatch: 'foam', view: { az: 22, el: 5, dist: 1.3 },
    text: 'An ivory cupsole with sculpted walls and a stitched crimson rand, set on an espresso rubber outsole. Amber chambers show through at the heel.' },
  { id: 'emboss', title: 'Embossed HZ', where: 'Heel · quarter · tongue', swatch: 'gold', view: { az: -90, el: 8, dist: 1.15 },
    text: 'The monogram in raised gold foil at the heel, above the model name, and as a small medallion on the lateral side.' },
];
const MATERIAL_ANCHOR = { leather: 'leather', suede: 'suede', gold: 'gold', stitching: 'stitching', laces: 'laces', rubber: 'rubber', emboss: 'emboss' };

const COMPARE = [
  { id: 'colour', label: 'Colour blocking', orig: 'A yellow top, purple sides, a gold toe and a red base, all painted by hand.', ref: 'The same five colours in the same places, now as leather, suede, metallic leather and rubber.' },
  { id: 'silhouette', label: 'Silhouette', orig: 'Long and low, with tall flat panels standing up at the heel.', ref: 'The same long, low line, with a shaped heel, a lower collar at the ankle and a lifted toe.' },
  { id: 'panels', label: 'Panel geometry', orig: 'Flat sheets of cardboard bent into shape.', ref: 'Curved panels that overlap one another and follow the shape of the foot.' },
  { id: 'materials', label: 'Materials', orig: 'Cardboard, paint and glue.', ref: 'Pebbled yellow leather, aubergine suede, metallic-gold leather, black patent leather and rubber.' },
  { id: 'stitching', label: 'Stitching', orig: 'Pieces held together with glue.', ref: 'Stitched seams along every overlay, in thread matched to each panel.' },
  { id: 'sole', label: 'Sole', orig: 'A painted cardboard base.', ref: 'A sculpted ivory cupsole with amber cushioning chambers, a stitched crimson rand and a treaded rubber outsole.' },
  { id: 'emblem', label: 'HZ emblem', orig: 'No branding.', ref: 'The HZ monogram on the heel, tongue, lateral side, insole and outsole.' },
];

const EXPLODE_LABELS = [
  ['laces', 'Laces & aglets', 'R'], ['tongue', 'Padded tongue', 'R'], ['collar', 'Collar & lining', 'L'],
  ['stripes', 'Signature stripes', 'R'], ['saddle', 'Saddle & eyelets', 'R'], ['toecap', 'Gold toe cap', 'R'],
  ['counter', 'Heel counter', 'L'], ['shell', 'Suede shell', 'L'], ['rand', 'Crimson rand', 'R'],
  ['insole', 'Removable insole', 'L'], ['cushion', 'Cushioning layer', 'R'], ['midsole', 'Sculpted midsole', 'L'], ['outsole', 'Rubber outsole', 'R'],
];

// ——— Camera stations, one per section ———
// az/el in degrees around the target; dist at a 16:10 reference aspect;
// fx/fy shift the image as a fraction of the viewport (to leave room for copy).
// m = overrides for phone-shaped viewports (dk multiplies the distance).
const BASE = { az: 30, el: 10, dist: 5.6, tx: 0, ty: 0, tz: 0, fx: 0, fy: 0, yaw: 0, spin: 0, float: 0, explode: 0, opacity: 1, warm: 0, bgx: 0.62 };
const STATIONS = {
  hero:       { az: 38, el: 9, dist: 5.5, fx: 0.19, fy: -0.02, spin: 1, float: 1, bg: ['#f7f1e7', '#dfd1ba'], m: { dk: 2.3, fx: 0, fy: 0.2, bgx: 0.5 } },
  idea:       { az: 0, el: 3, dist: 6.7, fx: -0.2, bg: ['#f2eadc', '#d9c9ae'], bgx: 0.35, m: { dk: 2.25, fx: 0, fy: 0.22 } },
  silhouette: { az: 64, el: 14, dist: 4.9, tx: 0.42, ty: -0.08, fx: 0.2, bg: ['#efe2cc', '#d2bd9b'], m: { dk: 2.1, fx: 0, fy: 0.2 } },
  signature:  { az: 14, el: 58, dist: 6.4, tx: 0.1, ty: 0.05, fx: -0.17, bg: ['#f5efe4', '#ddd0bb'], bgx: 0.38, m: { dist: 4.9, dk: 2.3, fx: 0, fy: 0.22 } },
  foundation: { az: -48, el: 5, dist: 5.0, tx: -0.3, ty: -0.12, fx: 0.2, bg: ['#432236', '#140a10'], m: { dk: 2.4, tx: -0.1, fx: 0, fy: 0.2 } },
  viewer:     { az: 0, el: 10, dist: 5.3, fx: 0, fy: 0.0, bg: ['#3d2c22', '#100a08'], bgx: 0.5, m: { dk: 2.25, fy: 0.06 } },
  anatomy:    { az: 25, el: 16, dist: 7.2, fx: 0.05, fy: 0.08, bg: ['#f6f0e6', '#ddd0ba'], bgx: 0.5, m: { dist: 5.6, dk: 2.2, fy: 0.05 } },
  construction: { az: 25, el: 12, dist: 5.8, fx: 0.12, bg: ['#2d1f18', '#0d0806'], m: { dk: 2.0, fx: 0, fy: 0.0 } },
  heritage:   { az: 40, el: 10, dist: 6, opacity: 0, bg: ['#f2eadc', '#ddd0bb'] },
  materials:  { az: 14, el: 28, dist: 1.25, fx: 0.08, bg: ['#2d1e17', '#0b0705'], m: { dk: 2.0, fx: 0, fy: 0.06 } },
  designers:  { az: 40, el: 10, dist: 6, opacity: 0, bg: ['#eadfcc', '#d4c2a5'] },
  collection: { az: 40, el: 10, dist: 6, opacity: 0, bg: ['#f5efe4', '#e0d4bf'] },
  finale:     { az: 40, el: 8, dist: 5.6, fx: 0, fy: -0.1, warm: 1, float: 0.6, spin: 0.6, bg: ['#4a3022', '#0b0705'], bgx: 0.5, m: { dk: 2.45, fy: -0.04 } },
};

// ——— Shared UI state ———
const ui = {
  mobile: false, aspect: 1.6,
  viewer: { yaw: -38 * DEG, tYaw: -38 * DEG, el: 10, tEl: 10, zoom: 1, tZoom: 1, vel: 0, drag: null },
  anatomy: null, material: 0, explodeP: 0,
};

let renderer, scene, camera, shoe, key, rim, fill, under, floor, blob;
let stations = [];
const state = {};

// ——— Brand marks ———
function placeLogos() {
  $$('[data-logo]').forEach((el, i) => { el.innerHTML = logoSVG({ fill: el.dataset.logo || 'gold', id: 'L' + i }); });
  $('#favicon').href = logoDataURL({ fill: '#1b120e', bg: '#e6c574', id: 'fav', weight: 4 });
  // Loader: the monogram draws itself, then fills.
  $('#loader-mark').innerHTML = `<svg viewBox="0 0 120 120"><circle class="ring" cx="60" cy="60" r="56.5" stroke-width="1.4"/><circle class="ring" cx="60" cy="60" r="52" stroke-width=".5" style="animation-delay:.3s"/>${MONOGRAM_PATHS.map((d, i) => `<path class="draw" d="${d}" style="animation-delay:${i * 0.05}s, ${1.3 + i * 0.03}s"/>`).join('')}</svg>`;
}
function setProgress(p) {
  $('#loader-bar').style.transform = `scaleX(${p})`;
  $('#loader-pct').textContent = Math.round(p * 100);
}

// ——— Renderer & scene ———
function initGL() {
  const canvas = $('#gl');
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return false; }
  if (!renderer.getContext()) return false;
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
  key = new THREE.DirectionalLight('#fff1dc', 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -3.2, near: 0.5, far: 24 });
  key.shadow.normalBias = 0.02; key.shadow.bias = -0.0004; key.shadow.radius = 4;
  scene.add(key, key.target);
  rim = new THREE.DirectionalLight('#ffe2c0', 1.2); rim.position.set(-4, 3, -3); scene.add(rim);
  fill = new THREE.HemisphereLight('#fff6ea', '#3a2a20', 0.4); scene.add(fill);
  under = new THREE.DirectionalLight('#fff3e2', 0); under.position.set(0.5, -6, 1.5); scene.add(under);
  return true;
}

function initShoe(tx) {
  shoe = buildShoe(tx);
  scene.add(shoe.root);
  floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.22, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = shoe.groundY - 0.002; floor.receiveShadow = true;
  scene.add(floor);
  // soft contact shadow under the sole
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(20,12,8,0.55)'); grd.addColorStop(0.5, 'rgba(20,12,8,0.22)'); grd.addColorStop(1, 'rgba(20,12,8,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = shoe.groundY; blob.scale.set(3.6, 1.25, 1); blob.renderOrder = 1;
  scene.add(blob);
}

// ——— Camera ———
function resolve(name, t) {
  const def = STATIONS[name];
  let s = { ...BASE, ...def };
  if (typeof DYNAMIC[name] === 'function') s = { ...s, ...DYNAMIC[name](s, t) };
  if (ui.mobile && def.m) s = { ...s, ...def.m, ...(DYNAMIC[name] ? DYNAMIC[name](s, t, true) : {}) };
  if (ui.mobile) s.dist = s.dist * (s.dk || 2.2) * Math.max(0.62, 0.46 / ui.aspect);
  else s.dist = s.dist * Math.max(1, 1.6 / ui.aspect);
  return s;
}

const DYNAMIC = {
  viewer: () => ({ yaw: ui.viewer.yaw, el: ui.viewer.el, dist: 5.3 * ui.viewer.zoom }),
  anatomy: (s, t, mobile) => {
    if (ui.anatomy == null) return mobile ? {} : {};
    const h = HOTSPOTS[ui.anatomy], a = shoe.anchors[h.id].p;
    return { ...h.view, dist: h.view.dist * 1.3, tx: a.x * 0.6, ty: a.y * 0.6, tz: a.z * 0.5, fx: mobile ? 0 : -0.01, fy: mobile ? 0.04 : 0.06 };
  },
  materials: () => {
    const m = MATERIALS[ui.material], a = shoe.anchors[MATERIAL_ANCHOR[m.id]].p;
    return { ...m.view, tx: a.x, ty: a.y, tz: a.z };
  },
  construction: (s, t, mobile) => {
    const p = ui.explodeP;
    const e = p < 0.5 ? smooth(0.06, 0.42, p) : 1 - smooth(0.58, 0.94, p);
    return { explode: e, az: 22 + 26 * p, el: 12 + 6 * e, dist: lerp(6.2, mobile ? 11.4 : 11.2, e), ty: lerp(0, mobile ? 0.75 : 1.0, e), tx: lerp(0, 0.05, e) };
  },
};

function computeStations() {
  const vh = innerHeight;
  stations = $$('[data-scene]').map((el) => {
    const host = el.parentElement && el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
    const r = host.getBoundingClientRect(), top = r.top + scrollY, h = r.height;
    let s, e;
    if (el.dataset.pin && host !== el) { s = top; e = top + h - vh; }
    else if (h >= vh) { s = top - 0.08 * vh; e = top + h - vh + 0.08 * vh; }
    else { const c = top + h / 2 - vh / 2; s = c - 0.06 * vh; e = c + 0.06 * vh; }
    return { el, name: el.dataset.scene, s, e, top, h };
  });
  for (let i = 1; i < stations.length; i++) {
    if (stations[i].s < stations[i - 1].e) { const m = (stations[i].s + stations[i - 1].e) / 2; stations[i].s = stations[i - 1].e = m; }
  }
}

const NUM_KEYS = ['az', 'el', 'dist', 'tx', 'ty', 'tz', 'fx', 'fy', 'yaw', 'spin', 'float', 'explode', 'opacity', 'warm', 'bgx'];
const colA = new THREE.Color(), colB = new THREE.Color(), tmpC = new THREE.Color();
function blendAt(y, t) {
  let i = 0;
  while (i < stations.length - 1 && y > stations[i].e && y >= stations[i + 1].s) i++;
  const A = stations[i];
  let B = A, k = 0;
  if (y > A.e && i < stations.length - 1) { B = stations[i + 1]; k = smooth(0, 1, (y - A.e) / Math.max(1, B.s - A.e)); }
  const sa = resolve(A.name, t), sb = B === A ? sa : resolve(B.name, t);
  const out = {};
  for (const key of NUM_KEYS) out[key] = lerp(sa[key], sb[key], k);
  // the shoe leaves early and arrives late, so it never sits behind copy-only sections
  if (sb.opacity === 0 && sa.opacity > 0) out.opacity = sa.opacity * (1 - smooth(0, 0.4, k));
  if (sa.opacity === 0 && sb.opacity > 0) out.opacity = sb.opacity * smooth(0.6, 1, k);
  // keep the camera still while the shoe is hidden: park on the visible neighbour
  if (sa.opacity === 0 && sb.opacity > 0) for (const key of ['az', 'el', 'dist', 'tx', 'ty', 'tz', 'fx', 'fy', 'yaw']) out[key] = sb[key];
  if (sb.opacity === 0 && sa.opacity > 0) for (const key of ['az', 'el', 'dist', 'tx', 'ty', 'tz', 'fx', 'fy', 'yaw']) out[key] = sa[key];
  colA.set(STATIONS[A.name].bg[0]).lerp(tmpC.set(STATIONS[B.name].bg[0]), k);
  colB.set(STATIONS[A.name].bg[1]).lerp(tmpC.set(STATIONS[B.name].bg[1]), k);
  out.bgA = '#' + colA.getHexString(); out.bgB = '#' + colB.getHexString();
  out.active = k < 0.5 ? A.name : B.name;
  out.weights = { [A.name]: 1 - k, [B.name]: (B === A ? 1 : k) };
  return out;
}

function placeCamera(cam, s, aspect) {
  const az = s.az * DEG, el = clamp(s.el, -84, 84) * DEG;
  cam.position.set(s.tx + Math.sin(az) * Math.cos(el) * s.dist, s.ty + Math.sin(el) * s.dist, s.tz + Math.cos(az) * Math.cos(el) * s.dist);
  cam.lookAt(s.tx, s.ty, s.tz);
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
  cam.projectionMatrix.elements[8] = -2 * (s.fx || 0);
  cam.projectionMatrix.elements[9] = -2 * (s.fy || 0);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
}

// ——— Size ———
let dpr = Math.min(devicePixelRatio || 1, 1.75);
let stageBg;
function resize() {
  const c = renderer.domElement, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
  ui.aspect = w / h; ui.w = w; ui.h = h;
  ui.mobile = innerWidth < 900 || ui.aspect < 0.85;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
}

// ——— Render loop ———
const cur = {};
let lastT = performance.now(), frameAvg = 16, frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const t = now / 1000;
  stepViewer(dt);
  const target = blendAt(scrollY, t);
  // critically damped follow; reduced motion snaps
  const k = reduceMotion || TEST.snap ? 1 : 1 - Math.exp(-dt * 6.5);
  // the viewer smooths its own input, so follow it directly once it owns the stage
  const direct = target.active === 'viewer' && (target.weights.viewer || 0) > 0.98;
  for (const key of NUM_KEYS) {
    const kk = (direct && (key === 'yaw' || key === 'el' || key === 'dist')) || key === 'opacity' ? 1 : key === 'explode' ? Math.min(1, k * 1.6) : k;
    cur[key] = cur[key] === undefined ? target[key] : lerp(cur[key], target[key], kk);
  }
  Object.assign(state, cur, { active: target.active, weights: target.weights });
  const bg = stageBg.style;
  bg.setProperty('--bgA', target.bgA); bg.setProperty('--bgB', target.bgB); bg.setProperty('--bgx', (cur.bgx * 100).toFixed(1) + '%');

  // model
  const motion = reduceMotion ? 0 : 1;
  shoe.root.rotation.y = cur.yaw + cur.spin * motion * Math.sin(t * 0.21) * 0.2;
  shoe.root.position.y = cur.float * (0.16 + motion * 0.035 * Math.sin(t * 0.9));
  shoe.setExplode(cur.explode);
  const anatW = target.weights.anatomy || 0;
  if (ui.anatomy != null && anatW > 0.01) shoe.setHighlight(HOTSPOTS[ui.anatomy].parts, anatW * (0.5 + 0.2 * Math.sin(t * 3.2) * motion));
  else shoe.setHighlight([], 0);

  // lights: a slow sweep across the materials; warmer for the finale
  const la = 0.8 + motion * 0.22 * Math.sin(t * 0.13);
  key.position.set(Math.cos(la) * 5.5, 7, Math.sin(la) * 5.5);
  key.color.set('#fff1dc').lerp(tmpC.set('#ffc98a'), cur.warm);
  key.intensity = 2.6 + cur.warm * 0.6;
  rim.intensity = 1.2 + cur.warm * 1.4;
  rim.color.set('#ffe2c0').lerp(tmpC.set('#ff9d55'), cur.warm);

  // ground; an under-light comes up when the camera looks at the sole
  const camEl = cur.el;
  under.intensity = 2.2 * smooth(-4, -40, camEl);
  const fk = smooth(-2, 8, camEl) * (1 - smooth(0.05, 0.3, cur.explode));
  floor.material.opacity = 0.22 * fk;
  blob.material.opacity = fk * (1 - 0.55 * smooth(0, 1, cur.float));
  blob.scale.set(3.6 * (1 + cur.float * 0.08), 1.25 * (1 + cur.float * 0.1), 1);

  placeCamera(camera, cur, ui.aspect);
  renderer.domElement.style.opacity = cur.opacity.toFixed(3);
  if (cur.opacity > 0.004) renderer.render(scene, camera);

  updateHotspots();
  updateExplodeUI();
  updateDial();

  // adapt resolution if frames are slow
  frameAvg = lerp(frameAvg, dt * 1000, 0.05);
  if (++frames % 90 === 0 && frameAvg > 30 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); resize(); }
}

// ——— 360° viewer ———
const VIEWS = { lateral: [0, 6], toe: [90, 8], medial: [180, 6], heel: [270, 9], top: [15, 80], sole: [0, -80], hero: [38, 10] };
function goView(name) {
  const [ang, el] = VIEWS[name], v = ui.viewer;
  const target = -ang * DEG;
  let d = (target - v.tYaw) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
  v.tYaw += d; v.tEl = el; v.vel = 0;
  $$('.viewer__views button').forEach((b) => b.classList.toggle('is-on', b.dataset.view === name));
}
function stepViewer(dt) {
  const v = ui.viewer;
  if (!v.drag && Math.abs(v.vel) > 1e-5) { v.tYaw += v.vel; v.vel *= Math.pow(0.9, dt * 60); }
  const k = reduceMotion || TEST.snap ? 1 : 1 - Math.exp(-dt * 10);
  v.yaw = lerp(v.yaw, v.tYaw, k); v.el = lerp(v.el, v.tEl, k); v.zoom = lerp(v.zoom, v.tZoom, k);
}
function initViewer() {
  const stage = $('#viewer-stage'), v = ui.viewer, pts = new Map();
  let pinch = 0;
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) v.drag = { x: e.clientX, y: e.clientY, type: e.pointerType };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    v.vel = 0;
    $$('.viewer__views button').forEach((b) => b.classList.remove('is-on'));
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) v.tZoom = clamp(v.tZoom * (pinch / d), 0.42, 1.3);
      pinch = d; return;
    }
    if (!v.drag) return;
    const dx = e.clientX - v.drag.x, dy = e.clientY - v.drag.y;
    v.drag.x = e.clientX; v.drag.y = e.clientY;
    const step = dx * 0.0085;
    v.tYaw += step; v.vel = step;
    if (v.drag.type === 'mouse') v.tEl = clamp(v.tEl + dy * 0.35, -82, 82);
  });
  const end = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (pts.size === 0) v.drag = null; };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); v.tZoom = clamp(v.tZoom * Math.exp(clamp(e.deltaY, -60, 60) * 0.004), 0.42, 1.3); }, { passive: false });
  stage.addEventListener('dblclick', () => { v.tZoom = v.tZoom > 0.75 ? 0.55 : 1; });
  stage.addEventListener('keydown', (e) => {
    const map = { ArrowLeft: () => (v.tYaw -= 15 * DEG), ArrowRight: () => (v.tYaw += 15 * DEG), ArrowUp: () => (v.tEl = clamp(v.tEl + 10, -82, 82)), ArrowDown: () => (v.tEl = clamp(v.tEl - 10, -82, 82)),
      '+': () => (v.tZoom = clamp(v.tZoom * 0.85, 0.42, 1.3)), '=': () => (v.tZoom = clamp(v.tZoom * 0.85, 0.42, 1.3)), '-': () => (v.tZoom = clamp(v.tZoom / 0.85, 0.42, 1.3)), r: () => reset(), 0: () => reset() };
    if (map[e.key]) { e.preventDefault(); map[e.key](); }
  });
  const reset = () => { goView('hero'); v.tZoom = 1; $$('.viewer__views button').forEach((b) => b.classList.remove('is-on')); };
  $$('.viewer__views button').forEach((b) => b.addEventListener('click', () => goView(b.dataset.view)));
  $('#zoom-in').addEventListener('click', () => (v.tZoom = clamp(v.tZoom * 0.8, 0.42, 1.3)));
  $('#zoom-out').addEventListener('click', () => (v.tZoom = clamp(v.tZoom / 0.8, 0.42, 1.3)));
  $('#view-reset').addEventListener('click', reset);
}
const DIAL_NAMES = ['Lateral', 'Lateral · toe', 'Toe', 'Medial · toe', 'Medial', 'Medial · heel', 'Heel', 'Lateral · heel'];
let lastDial = '';
function updateDial() {
  const v = ui.viewer;
  const ang = ((-v.yaw / DEG) % 360 + 360) % 360;
  const name = v.el > 55 ? 'Top' : v.el < -45 ? 'Sole' : DIAL_NAMES[Math.round(ang / 45) % 8];
  const key = Math.round(ang) + name;
  if (key === lastDial) return;
  lastDial = key;
  $('#dial-deg').textContent = String(Math.round(ang) % 360).padStart(3, '0') + '°';
  $('#dial-name').textContent = name;
  $('#dial-arc').style.strokeDashoffset = (276.5 * (1 - ang / 360)).toFixed(1);
  $('#dial-dot').style.transform = `rotate(${ang}deg)`;
}

// ——— Anatomy ———
const hsEls = [];
function initAnatomy() {
  const list = $('#anatomy-list'), layer = $('#hotspots');
  HOTSPOTS.forEach((h, i) => {
    const n = String(i + 1).padStart(2, '0');
    const li = document.createElement('li');
    li.innerHTML = `<button aria-pressed="false" data-i="${i}"><span>${n}</span>${h.title}</button>`;
    list.appendChild(li);
    const b = document.createElement('button');
    b.className = 'hotspot'; b.textContent = n; b.setAttribute('aria-label', `${n} ${h.title}`); b.dataset.i = i;
    layer.appendChild(b); hsEls.push(b);
  });
  const pick = (i) => {
    ui.anatomy = i;
    $$('#anatomy-list button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
    hsEls.forEach((b) => b.classList.toggle('is-on', +b.dataset.i === i));
    if (i == null) { $('#ac-num').textContent = '—'; $('#ac-title').textContent = 'Select a component'; $('#ac-text').textContent = 'Choose a number on the shoe or in the list to see how that part is made.'; return; }
    const h = HOTSPOTS[i];
    $('#ac-num').textContent = String(i + 1).padStart(2, '0');
    $('#ac-title').textContent = h.title; $('#ac-text').textContent = h.text;
    const btn = $(`#anatomy-list button[data-i="${i}"]`);
    if (ui.mobile && btn) btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  $$('#anatomy-list button, .hotspot').forEach((b) => b.addEventListener('click', () => pick(+b.dataset.i)));
  $('#ac-next').addEventListener('click', () => pick(ui.anatomy == null ? 0 : (ui.anatomy + 1) % HOTSPOTS.length));
  $('#ac-prev').addEventListener('click', () => pick(ui.anatomy == null ? HOTSPOTS.length - 1 : (ui.anatomy - 1 + HOTSPOTS.length) % HOTSPOTS.length));
  $('#ac-clear').addEventListener('click', () => pick(null));
}
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Vector3();
function toScreen(local, out) {
  _v.copy(local).applyMatrix4(shoe.root.matrixWorld);
  out.world = _v.clone();
  _v.project(camera);
  out.x = (_v.x * 0.5 + 0.5) * ui.w; out.y = (-_v.y * 0.5 + 0.5) * ui.h; out.z = _v.z;
  return out;
}
function updateHotspots() {
  const sec = $('#anatomy'), r = sec.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  shoe.root.updateMatrixWorld();
  const w = state.weights.anatomy || 0;
  const camPos = camera.position;
  // markers never sit under the list or the info card
  const panels = $$('#anatomy-card, #anatomy-list').map((e) => e.getBoundingClientRect());
  const nrm = new THREE.Matrix3().getNormalMatrix(shoe.root.matrixWorld);
  HOTSPOTS.forEach((h, i) => {
    const a = shoe.anchors[h.id], s = toScreen(a.p, {});
    const n = _w.copy(a.n).applyMatrix3(nrm).normalize(), view = camPos.clone().sub(s.world).normalize();
    const facing = n.dot(view);
    const covered = panels.some((q) => s.x > q.left - 16 && s.x < q.right + 16 && s.y > q.top - 16 && s.y < q.bottom + 16);
    const offscreen = s.x < 12 || s.x > ui.w - 12 || s.y < 70 || s.y > ui.h - 12;
    const hide = w < 0.6 || facing < (h.id === 'insole' ? 0.55 : 0.05) || s.z > 1 || covered || offscreen;
    const el = hsEls[i];
    el.classList.toggle('is-hidden', hide);
    el.style.transform = `translate(${s.x.toFixed(1)}px, ${(s.y - r.top).toFixed(1)}px)`;
  });
}

// ——— Exploded view ———
const xl = [];
function initExplode() {
  const box = $('#explode-labels'), svg = $('#explode-lines'), legend = $('#explode-legend');
  EXPLODE_LABELS.forEach(([part, label, side], i) => {
    const d = document.createElement('div');
    d.className = 'xlabel ' + (side === 'R' ? 'is-right' : 'is-left');
    d.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b><span>${label}</span>`;
    box.appendChild(d);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', '2.5');
    svg.append(line, dot);
    legend.insertAdjacentHTML('beforeend', `<li>${label}</li>`);
    xl.push({ part, side, el: d, line, dot, w: 0 });
  });
  // Measure each part assembled and unrotated; points are kept in the part's own frame.
  shoe.root.rotation.set(0, 0, 0); shoe.root.position.set(0, 0, 0); shoe.setExplode(0);
  shoe.root.updateMatrixWorld(true);
  const b = new THREE.Box3();
  for (const L of xl) {
    b.setFromObject(shoe.parts[L.part]);
    const c = b.getCenter(new THREE.Vector3());
    L.local = new THREE.Vector3(L.side === 'R' ? b.max.x : b.min.x, c.y, c.z).sub(shoe.shoe.position);
  }
}
function updateExplodeUI() {
  const sec = $('#construction'), r = sec.getBoundingClientRect();
  $('#explode-rail').style.transform = `scaleX(${ui.explodeP.toFixed(3)})`;
  // the title changes when reassembly begins
  $('#ex-a').classList.toggle('is-on', ui.explodeP < 0.6);
  $('#ex-b').classList.toggle('is-on', ui.explodeP >= 0.6);
  if (r.bottom < 0 || r.top > innerHeight) return;
  const show = (state.weights.construction || 0) > 0.8 ? smooth(0.72, 0.95, state.explode) : 0;
  $('#explode-legend').style.setProperty('--lg', show.toFixed(2));
  shoe.root.updateMatrixWorld();
  const sides = { L: [], R: [] };
  for (const L of xl) {
    const p = L.local.clone().add(shoe.parts[L.part].position).add(shoe.shoe.position);
    const s = toScreen(p, {});
    L.ax = s.x; L.ay = s.y - r.top; L.ty = L.ay;
    sides[L.side].push(L);
  }
  const gap = ui.mobile ? 17 : 22;
  for (const k of ['L', 'R']) {
    const arr = sides[k].sort((a, b) => a.ay - b.ay);
    for (let i = 1; i < arr.length; i++) if (arr[i].ty < arr[i - 1].ty + gap) arr[i].ty = arr[i - 1].ty + gap;
  }
  const off = ui.mobile ? 18 : 34;
  for (const L of xl) {
    if (!L.w || L.wm !== ui.mobile) { L.w = L.el.offsetWidth; L.wm = ui.mobile; }
    let lx = L.side === 'R' ? L.ax + off : L.ax - off - L.w;
    lx = clamp(lx, 8, innerWidth - 8 - L.w);
    L.el.style.transform = `translate(${lx.toFixed(1)}px, ${L.ty.toFixed(1)}px) translateY(-50%)`;
    L.el.style.opacity = show.toFixed(3);
    const ex = L.side === 'R' ? lx - 6 : lx + L.w + 6;
    L.line.setAttribute('x1', L.ax.toFixed(1)); L.line.setAttribute('y1', L.ay.toFixed(1));
    L.line.setAttribute('x2', ex.toFixed(1)); L.line.setAttribute('y2', L.ty.toFixed(1));
    L.line.style.opacity = show.toFixed(3);
    L.dot.setAttribute('cx', L.ax.toFixed(1)); L.dot.setAttribute('cy', L.ay.toFixed(1)); L.dot.style.opacity = show.toFixed(3);
  }
}

// ——— Heritage comparison ———
function initCompare() {
  const fig = $('#compare'), range = $('#compare-range');
  const set = (v) => fig.style.setProperty('--pos', v + '%');
  range.addEventListener('input', () => set(range.value));
  set(range.value);
  const chips = $('#compare-chips');
  COMPARE.forEach((c, i) => chips.insertAdjacentHTML('beforeend', `<button aria-pressed="${i === 0}" data-i="${i}">${c.label}</button>`));
  const pick = (i) => {
    $$('#compare-chips button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
    $('#cn-orig').textContent = COMPARE[i].orig; $('#cn-ref').textContent = COMPARE[i].ref;
  };
  chips.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) pick(+b.dataset.i); });
  pick(0);
}

// ——— Materials lab ———
function initMaterials(tx) {
  const list = $('#materials-list');
  MATERIALS.forEach((m, i) => list.insertAdjacentHTML('beforeend', `<button aria-pressed="${i === 0}" data-i="${i}"><i style="background-image:url(${tx.swatches[m.swatch]})"></i>${m.title}</button>`));
  const pick = (i) => {
    ui.material = i;
    const m = MATERIALS[i];
    $$('#materials-list button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
    $('#mat-swatch').style.backgroundImage = `url(${tx.swatches[m.swatch]})`;
    $('#mat-where').textContent = m.where; $('#mat-title').textContent = m.title; $('#mat-text').textContent = m.text;
  };
  list.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) pick(+b.dataset.i); });
  pick(0);
}

// ——— Product renders made from the live model ———
function snapshot({ w, h, view, bg, setup, teardown }) {
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  shoe.setExplode(0); shoe.setHighlight([], 0);
  shoe.root.rotation.set(0, view.yaw || 0, view.roll || 0);
  shoe.root.position.set(view.px || 0, view.lift || 0, view.pz || 0);
  setup && setup();
  const s = { ...BASE, ...view };
  key.position.set(Math.cos(0.8) * 5.5, 7, Math.sin(0.8) * 5.5);
  key.color.set('#fff1dc'); key.intensity = 2.6; rim.intensity = 1.2; rim.color.set('#ffe2c0');
  const fk = smooth(-2, 8, s.el);
  floor.material.opacity = 0.24 * fk; blob.material.opacity = fk * (view.px ? 0 : 1);
  placeCamera(camera, s, w / h);
  renderer.render(scene, camera);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  grd.addColorStop(0, bg[0]); grd.addColorStop(1, bg[1]);
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.drawImage(renderer.domElement, 0, 0, w, h);
  teardown && teardown();
  shoe.root.position.set(0, 0, 0); shoe.root.rotation.set(0, 0, 0);
  return new Promise((res) => c.toBlob((b) => res(URL.createObjectURL(b)), 'image/jpeg', 0.9));
}

async function makeRenders(tx, progress) {
  const A = Object.fromEntries(Object.entries(shoe.anchors).map(([k, v]) => [k, v.p]));
  const ivory = ['#f7f1e7', '#dccdb4'], dark = ['#3d2a20', '#0e0907'];
  const jobs = [];
  // Heritage comparison: framed like the original photograph (toe-on, slightly above).
  jobs.push(['compare', { w: 760, h: 891, view: { az: 82, el: 22, dist: 5.7, tx: 0.1, ty: -0.12, fy: 0.0 }, bg: ['#f2ebdf', '#d8cab2'] }]);
  // Shoebox scene.
  const box = buildShoebox(tx);
  box.position.set(-0.75, shoe.groundY, -1.5); box.rotation.y = 0.16;
  jobs.push(['box', { w: 1280, h: 720, bg: dark, view: { az: 24, el: 15, dist: 8.1, tx: -0.1, ty: 0.6, tz: -0.4, yaw: 0.62, px: 1.05, pz: 0.95 },
    setup: () => { scene.add(box); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); key.shadow.camera.updateProjectionMatrix(); },
    teardown: () => { scene.remove(box); Object.assign(key.shadow.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -3.2 }); key.shadow.camera.updateProjectionMatrix(); } }]);
  jobs.push(['tongue', { w: 900, h: 700, bg: ivory, view: { az: 68, el: 26, dist: 1.55, tx: A.tongue.x, ty: A.tongue.y - 0.02, tz: A.tongue.z } }]);
  // outsole: the shoe turned over and lit from above, as it would be photographed
  jobs.push(['outsole', { w: 900, h: 700, bg: ivory, view: { az: 0, el: 82, dist: 5.1, yaw: Math.PI, roll: Math.PI, lift: 0.06 } }]);
  jobs.push(['heel', { w: 900, h: 700, bg: ivory, view: { az: -62, el: 12, dist: 2.1, tx: A.heel.x + 0.15, ty: A.heel.y - 0.12, tz: A.heel.z } }]);
  jobs.push(['top', { w: 900, h: 700, bg: dark, view: { az: 0, el: 80, dist: 4.6, yaw: -0.5 } }]);
  const out = {};
  for (let i = 0; i < jobs.length; i++) {
    out[jobs[i][0]] = await snapshot(jobs[i][1]);
    progress(i / jobs.length);
    await wait();
  }
  return out;
}

function fillGallery(r) {
  const items = [
    ['box', 'The HZ shoebox, espresso board with gold foil'],
    ['tongue', 'Tongue · woven HZ label'],
    ['outsole', 'Outsole · pivot circle, diamond lugs, HZ heel'],
    ['heel', 'Heel · gold monogram and stitching'],
    ['top', 'Top view · stripes and lacing'],
  ];
  $('#gallery').innerHTML = items.map(([k, cap]) => `<figure data-reveal><img src="${r[k]}" alt="${cap}" width="900" height="700" loading="lazy"><figcaption>${cap}</figcaption></figure>`).join('');
  $('#compare-ref').src = r.compare;
}

// ——— Navigation ———
function initNav() {
  const nav = $('#nav'), toggle = $('#nav-toggle');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open)); nav.classList.toggle('is-open', open);
  });
  $$('#nav-links a').forEach((a) => a.addEventListener('click', () => { toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); }));
  const sections = $$('main > section, main > div > section, .footer');
  const links = $$('#nav-links a');
  const onScroll = () => {
    nav.classList.toggle('is-scrolled', scrollY > 40);
    const probe = 34;
    const s = sections.find((el) => { const r = el.getBoundingClientRect(); return r.top <= probe && r.bottom > probe; });
    nav.classList.toggle('on-dark', !!s && s.classList.contains('is-dark'));
    const id = s ? (s.closest('#design') ? 'design' : s.id) : '';
    links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ——— Scroll choreography ———
function initScroll() {
  const gsap = window.gsap, ST = window.ScrollTrigger;
  const section = $('#construction');
  if (gsap && ST) {
    gsap.registerPlugin(ST);
    if (TEST.snap) gsap.ticker.lagSmoothing(0);
    ST.create({ trigger: section, pin: true, start: 'top top', end: () => '+=' + Math.round(innerHeight * 2.4), scrub: true, onUpdate: (self) => (ui.explodeP = self.progress) });
    if (!reduceMotion) {
      $$('[data-reveal]').forEach((el) => {
        gsap.from(el, { y: 34, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' } });
      });
    }
    ST.addEventListener('refresh', computeStations);
    ST.refresh();
  } else {
    // Without GSAP the section scrolls normally; progress follows its position.
    addEventListener('scroll', () => {
      const r = section.getBoundingClientRect();
      ui.explodeP = clamp(-r.top / Math.max(1, r.height - innerHeight * 0.2), 0, 1);
    }, { passive: true });
  }
  computeStations();
}

// ——— Boot ———
async function boot() {
  document.body.classList.add('is-loading');
  stageBg = $('#stage-bg');
  placeLogos();
  initNav();
  initCompare();
  setProgress(0.03);
  if (!initGL()) {
    document.body.classList.add('no-webgl');
    $('.nogl-note').hidden = false;
    $$('.viewer__bar, .viewer__dial').forEach((e) => (e.hidden = true));
    $('#viewer .viewer__hint').textContent = 'The 360° viewer needs WebGL, which this browser could not start.';
    finishLoading();
    return;
  }
  const T0 = performance.now();
  const tx = await buildTextures((p) => setProgress(0.05 + p * 0.6));
  const T1 = performance.now();
  await wait();
  initShoe(tx);
  const T2 = performance.now();
  setProgress(0.72);
  await wait();
  const renders = await makeRenders(tx, (p) => setProgress(0.72 + p * 0.24));
  fillGallery(renders);
  if (TEST.snap) window.__timing = { textures: Math.round(T1 - T0), model: Math.round(T2 - T1), renders: Math.round(performance.now() - T2) };
  if (TEST.snap) { window.__renders = renders; window.__hz = { ui, state, shoe, renderer, scene }; }
  resize();
  initViewer(); initAnatomy(); initExplode(); initMaterials(tx);
  initScroll();
  addEventListener('resize', () => { resize(); computeStations(); });
  // first frame before the loader lifts
  requestAnimationFrame(frame);
  setProgress(1);
  finishLoading();
}
function finishLoading() {
  setTimeout(() => {
    $('#loader').classList.add('is-done');
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    window.ScrollTrigger && window.ScrollTrigger.refresh();
    window.__ready = true;
  }, reduceMotion ? 50 : 700);
}
boot().catch((e) => { console.error(e); finishLoading(); });
