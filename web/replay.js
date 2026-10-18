// Animated battle replay. Each recorded frame is one company's activation: its moves, volleys, charges and
// melees play out as a short timeline, then the board settles to the frame's snapshot.
import { getMap, T, UNITS } from '../engine/index.js';

const CELL = 28;
const TOP = 24, BOT = 12;
const TEAM = [{ coat: '#3f63c9', hi: '#7f9cf0', flag: '#2e4fb0' }, { coat: '#c23b32', hi: '#f07a6c', flag: '#a42a22' }];

// ---------------------------------------------------------------- terrain (pre-rendered once per map)
const terrainCache = {};
function terrainCanvas(mapId) {
  if (terrainCache[mapId]) return terrainCache[mapId];
  const map = getMap(mapId);
  const WW = map.w * CELL, WH = map.h * CELL;
  const cv = document.createElement('canvas'); cv.width = WW * 2; cv.height = WH * 2;
  const g = cv.getContext('2d'); g.scale(2, 2);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const at = (x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? -1 : map.cells[y][x]);
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const t = map.cells[y][x], px = x * CELL, py = y * CELL;
    const base = { [T.OPEN]: ['#56723f', '#58753f', '#54703d'], [T.HILL]: ['#7b8a4c', '#82904f', '#768547'], [T.WOODS]: ['#3f5a30', '#425e32', '#3b562d'], [T.VILLAGE]: ['#77684a', '#7d6d4e', '#726447'], [T.RIVER]: ['#3c6b8f', '#3f7096', '#396689'], [T.FORD]: ['#5f88a3', '#6590aa', '#5a839e'], [T.MARSH]: ['#4d6345', '#506648', '#4a6042'], [T.HEDGE]: ['#56723f', '#58753f', '#54703d'] }[t];
    g.fillStyle = base[(x * 7 + y * 13) % 3]; g.fillRect(px, py, CELL, CELL);
    if (t === T.OPEN || t === T.HEDGE) for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(30,50,15,${0.15 + rnd() * 0.2})`; g.fillRect(px + rnd() * 26, py + rnd() * 26, 1.5, 2 + rnd() * 3); }
    if (t === T.HILL) {
      // contour lines on the hill's edge
      g.strokeStyle = 'rgba(60,50,20,.35)'; g.lineWidth = 1.2;
      for (const [dx, dy, x0, y0, x1, y1] of [[0, -1, 0, 0, 1, 0], [0, 1, 0, 1, 1, 1], [-1, 0, 0, 0, 0, 1], [1, 0, 1, 0, 1, 1]]) if (at(x + dx, y + dy) !== T.HILL) { g.beginPath(); g.moveTo(px + x0 * CELL, py + y0 * CELL); g.lineTo(px + x1 * CELL, py + y1 * CELL); g.stroke(); }
      g.fillStyle = 'rgba(255,240,180,.06)'; g.fillRect(px, py, CELL, CELL);
    }
    if (t === T.MARSH) for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(80,120,140,.55)'; g.beginPath(); g.ellipse(px + 4 + rnd() * 20, py + 4 + rnd() * 20, 3 + rnd() * 3, 1.5, 0, 0, 7); g.fill(); g.strokeStyle = '#6f8a4a'; g.lineWidth = 1; g.beginPath(); const sx = px + rnd() * 26, sy = py + rnd() * 26; g.moveTo(sx, sy); g.lineTo(sx + 1, sy - 5); g.stroke(); }
    if (t === T.RIVER || t === T.FORD) { g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { const sy = py + 5 + k * 8 + rnd() * 3; g.beginPath(); g.moveTo(px + 3, sy); g.quadraticCurveTo(px + 14, sy - 3, px + 25, sy); g.stroke(); } }
    if (t === T.FORD) { g.fillStyle = 'rgba(200,180,130,.35)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(px + 4 + rnd() * 20, py + 4 + rnd() * 20, 1.5 + rnd() * 1.5, 0, 7); g.fill(); } }
  }
  // hedges: a dark green bushy line around the cell
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.cells[y][x] === T.HEDGE) {
    const px = x * CELL + CELL / 2, py = y * CELL + CELL / 2;
    for (let k = 0; k < 7; k++) { g.fillStyle = ['#2f4a24', '#35522a', '#2a4320'][k % 3]; g.beginPath(); g.arc(px - 11 + k * 3.7 + (rnd() - 0.5) * 2, py + (rnd() - 0.5) * 8, 3.5 + rnd() * 2, 0, 7); g.fill(); }
  }
  // villages: cottages with thatched or tiled roofs
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.cells[y][x] === T.VILLAGE) {
    const px = x * CELL, py = y * CELL;
    for (let k = 0; k < 2; k++) {
      const hx = px + 3 + rnd() * 10, hy = py + 3 + k * 12 + rnd() * 3, w = 11 + rnd() * 4, h = 7;
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(hx + 2, hy + 2, w, h);
      g.fillStyle = '#d8ccb0'; g.fillRect(hx, hy, w, h);
      g.fillStyle = rnd() < 0.5 ? '#a8823f' : '#8f4a32'; g.beginPath(); g.moveTo(hx - 1, hy + h / 2); g.lineTo(hx + w / 2, hy - 2); g.lineTo(hx + w + 1, hy + h / 2); g.lineTo(hx + w / 2, hy + h + 1); g.closePath(); g.fill();
    }
  }
  // woods: canopy blobs
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.cells[y][x] === T.WOODS) {
    const px = x * CELL, py = y * CELL;
    for (let k = 0; k < 4; k++) {
      const cx = px + 5 + rnd() * 18, cy = py + 5 + rnd() * 18, r = 6 + rnd() * 4;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(cx + 2, cy + 3, r, 0, 7); g.fill();
      g.fillStyle = ['#2c4a25', '#33552a', '#2a4422', '#3b6030'][k]; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.fillStyle = 'rgba(140,190,90,.18)'; g.beginPath(); g.arc(cx - 2, cy - 2, r * 0.5, 0, 7); g.fill();
    }
  }
  // deployment zones, faintly
  g.fillStyle = 'rgba(80,110,220,.06)'; g.fillRect(0, 0, 7 * CELL, WH);
  g.fillStyle = 'rgba(220,80,70,.06)'; g.fillRect(WW - 7 * CELL, 0, 7 * CELL, WH);
  terrainCache[mapId] = cv;
  return cv;
}

// ---------------------------------------------------------------- one company, drawn as its formation
function drawCompany(g, u, x, y, face, team, opts) {
  const U = UNITS[u.type];
  const C = TEAM[team];
  const nFig = Math.max(2, Math.round(u.men / (U.mounted ? 5 : U.gun ? 4 : 6)));
  const routing = opts.st === 'rout';
  g.save(); g.translate(x, y);
  // the formation, rotated so +x is the facing
  g.save(); g.rotate(face); g.scale(1.55, 1.55);
  if (opts.shake) g.translate((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5);
  const ranks = U.mounted ? 2 : U.gun ? 1 : u.type === 'pikeman' || u.type === 'conscript' ? 4 : 3;
  const files = Math.ceil(nFig / ranks);
  const fw = Math.min(3.2, 15 / Math.max(1, files)), rd = U.mounted ? 5.5 : 3.2;
  let seed = u.id * 9973 + 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (U.gun) {
    const guns = Math.max(1, Math.ceil(2 * u.men / U.men));
    for (let k = 0; k < guns; k++) {
      const gy = (k - (guns - 1) / 2) * 11;
      g.fillStyle = '#4a3622'; g.fillRect(-6, gy - 2.2, 7, 4.4);                 // trail
      g.fillStyle = '#5b4a35'; g.beginPath(); g.arc(-1, gy - 4, 2.6, 0, 7); g.arc(-1, gy + 4, 2.6, 0, 7); g.fill();   // wheels
      g.fillStyle = '#2b2b2e'; g.fillRect(-2, gy - 1.6, 12, 3.2);                 // barrel
      g.fillStyle = '#c9a24a'; g.fillRect(9, gy - 1.8, 1.6, 3.6);
    }
    const crew = Math.max(1, Math.round(u.men / 3));
    for (let k = 0; k < crew; k++) figure(g, -10 - (k % 2) * 4, ((k >> 1) - (crew / 4)) * 5, C, 'gunner', routing, rnd);
  } else {
    for (let i = 0; i < nFig; i++) {
      const r = i % ranks, f = Math.floor(i / ranks);
      let fx = -r * rd + (ranks - 1) * rd / 2, fy = (f - (files - 1) / 2) * fw;
      if (opts.dis) { fx += (rnd() - 0.5) * 2.5; fy += (rnd() - 0.5) * 2.5; }
      if (routing) { fx += (rnd() - 0.5) * 16 - 4; fy += (rnd() - 0.5) * 16; }
      figure(g, fx, fy, C, glyphOf(u.type, i, f, files), routing, rnd, opts.level);
    }
  }
  g.restore();
  // colours, bars and label stay upright
  if (!routing) {
    g.fillStyle = '#3b2a18'; g.fillRect(-0.6, -20, 1.2, 13);
    g.fillStyle = C.flag; g.beginPath(); g.moveTo(0.6, -20); g.lineTo(9, -18); g.lineTo(0.6, -15); g.closePath(); g.fill();
  }
  const bw = 22;
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(-bw / 2, 13, bw, 4.5);
  g.fillStyle = C.hi; g.fillRect(-bw / 2, 13, bw * u.men / U.men, 2);
  const m = Math.max(0, opts.morale) / 100;
  g.fillStyle = m < 0.2 ? '#e05040' : m < 0.4 ? '#e0a040' : '#9fd27a'; g.fillRect(-bw / 2, 15.5, bw * Math.min(1, m), 2);
  if (opts.label) { g.font = '600 7px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(UNITS[u.type].short, 0, 24); }
  if (opts.active) { g.strokeStyle = 'rgba(255,230,140,.9)'; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, 15, 0, 7); g.stroke(); }
  g.restore();
}
function glyphOf(type, i, f = 0, files = 1) {
  if (type === 'trainedband') return i % 3 === 2 ? 'pike' : 'musket';
  // pikes in the centre files, shot on the sleeves
  if (type === 'battalion') return Math.abs(f - (files - 1) / 2) <= files / 6 ? 'pike' : 'musket';
  if (type === 'tercio') return Math.abs(f - (files - 1) / 2) <= files / 4 ? 'pike' : 'musket';
  if (type === 'horseshot') return f % 5 === 2 ? 'musket' : 'horse';
  if (type === 'conscript') return ['bill', 'fork', 'flail', 'scythe'][i % 4];
  return UNITS[type].glyph;
}
function figure(g, x, y, C, kind, routing, rnd, level) {
  const a = routing ? 0.65 : 1;
  g.globalAlpha = a;
  if (kind === 'horse' || kind === 'cuirassier' || kind === 'hussar') {
    g.fillStyle = kind === 'hussar' ? '#e8dcc6' : ['#5a3a22', '#6b4426', '#3b2a1c'][Math.floor(rnd() * 3)];
    g.beginPath(); g.ellipse(x, y, 3.6, 1.6, 0, 0, 7); g.fill();
    g.fillRect(x + 2.6, y - 0.7, 2.2, 1.4);   // head
    g.fillStyle = kind === 'cuirassier' ? '#b9c2cc' : C.coat; g.beginPath(); g.arc(x - 0.4, y, 1.4, 0, 7); g.fill();
    g.fillStyle = '#e8c49a'; g.beginPath(); g.arc(x - 0.2, y, 0.7, 0, 7); g.fill();
    if (kind === 'hussar') { g.strokeStyle = '#d9d2c0'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x - 1.5, y - 1.8); g.quadraticCurveTo(x - 3, y, x - 1.5, y + 1.8); g.stroke(); g.strokeStyle = '#d9c38a'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x - 1, y + 0.8); g.lineTo(x + 9, y + 0.6); g.stroke(); }
  } else if (kind === 'dragoon') {
    g.fillStyle = '#6b5236'; g.beginPath(); g.ellipse(x, y, 3, 1.3, 0, 0, 7); g.fill();
    g.fillStyle = C.coat; g.beginPath(); g.arc(x - 0.3, y, 1.2, 0, 7); g.fill();
    g.strokeStyle = '#2a2420'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x, y + 0.6); g.lineTo(x + 3.5, y + 0.6); g.stroke();
  } else {
    g.fillStyle = kind === 'levy' || kind === 'bill' || kind === 'fork' || kind === 'flail' || kind === 'scythe' ? ['#8a7a5a', '#6e6248', '#9a8a68'][Math.floor(rnd() * 3)] : C.coat;
    g.beginPath(); g.arc(x, y, 1.35, 0, 7); g.fill();
    g.fillStyle = kind === 'pike' ? '#9aa3ac' : '#e8c49a'; g.beginPath(); g.arc(x + 0.2, y, 0.75, 0, 7); g.fill();
    g.lineWidth = 0.45; g.strokeStyle = '#3a2c1c';
    if (kind === 'pike') { g.strokeStyle = '#7a6040'; g.beginPath(); if (level) { g.moveTo(x - 1, y + 0.4); g.lineTo(x + 11, y + 0.4); } else { g.moveTo(x + 0.4, y); g.lineTo(x + 3.2, y - 0.2); } g.stroke(); }
    else if (kind === 'musket' || kind === 'gunner') { g.beginPath(); g.moveTo(x, y + 0.7); g.lineTo(x + 3, y + 0.7); g.stroke(); }
    else if (kind === 'bow') { g.strokeStyle = '#7a5a2a'; g.beginPath(); g.arc(x + 0.6, y, 1.9, -1.2, 1.2); g.stroke(); }
    else if (kind === 'fork' || kind === 'bill' || kind === 'scythe' || kind === 'flail') { g.strokeStyle = '#6b5232'; g.beginPath(); g.moveTo(x, y + 0.5); g.lineTo(x + 4, y + 0.3); g.stroke(); }
  }
  g.globalAlpha = 1;
}

// ---------------------------------------------------------------- the player
export function createReplay(el) {
  const cv = el.canvas, ctx = cv.getContext('2d');
  let R = null, k = 0, clock = 0, last = 0, playing = false, single = false, raf = 0;
  let sched = [], schedEnd = 0, fx = [];
  let prev = null, cur = null;            // snapshots: before / after this frame
  let cam = { x: 0, y: 0, z: 1 }, follow = false;
  let WW = 1008, WH = 672, VH = WH + TOP + BOT, dpr = 1;
  const speed = () => +el.speed.value || 1;
  const byId = {};

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = WW * dpr; cv.height = VH * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const dur = (e) => {
    switch (e.k) {
      case 'move': return e.push ? 160 : Math.min(900, 110 * (e.path.length - 1) + 60);
      case 'fire': return e.gun ? 650 : 520;
      case 'melee': return 640;
      case 'rout': case 'rally': return 320;
      case 'gone': case 'fled': case 'absent': return 220;
      default: return 0;
    }
  };

  function startFrame(i) {
    k = i;
    prev = R.frames[Math.max(0, i - 1)].snap; cur = R.frames[i].snap;
    const f = R.frames[i];
    sched = []; let c = 0;
    for (const e of f.fx || []) { sched.push({ at: c, e }); c += dur(e); }
    schedEnd = c + (f.fx && f.fx.length ? 260 : 40);
    clock = 0;
    for (const s of sched) s.spawned = false;
    el.onFrame && el.onFrame(i, R.frames[i]);
  }

  function unitState(id) {
    const p = prev[id], c = cur[id];
    let x = p.x, y = p.y, face = p.face, men = p.men, morale = p.morale, st = p.st, dis = p.dis, shake = false, level = false;
    let movedDone = false;
    for (const s of sched) {
      const e = s.e;
      if (clock < s.at) break;
      const t = Math.min(1, (clock - s.at) / Math.max(1, dur(e)));
      if (e.k === 'move' && e.id === id) {
        const n = e.path.length - 1, pos = t * n, a = Math.min(n - 1, Math.floor(pos)), f = pos - a;
        const A = e.path[a], B = e.path[Math.min(n, a + 1)];
        x = A[0] + (B[0] - A[0]) * f; y = A[1] + (B[1] - A[1]) * f;
        if (!e.flee && n > 0 && (B[0] !== A[0] || B[1] !== A[1])) face = Math.atan2(B[1] - A[1], B[0] - A[0]);
        if (e.flee) st = 'rout';
        movedDone = t >= 1;
      }
      if ((e.k === 'fire' || e.k === 'melee') && (e.t === id || e.a === id) && t > 0.55) { men = Math.min(men, c.men); morale = c.morale; }
      if (e.k === 'melee' && (e.a === id || e.t === id) && t < 0.9) { shake = true; level = true; }
      if ((e.k === 'fire' || e.k === 'melee') && e.a === id) face = c.face;
      if ((e.k === 'rout' || e.k === 'rally' || e.k === 'gone' || e.k === 'fled' || e.k === 'absent') && e.id === id && t > 0.2) { st = c.st; morale = c.morale; }
    }
    if (clock >= schedEnd) ({ x, y, face, men, morale, st, dis } = c);
    return { x, y, face, men, morale, st, dis, shake, level };
  }

  const px = (x) => x * CELL + CELL / 2, py = (y) => y * CELL + CELL / 2 + TOP;

  function spawn(s) {
    const e = s.e; s.spawned = true;
    if (e.k === 'fire') {
      const A = unitState(e.a), B = unitState(e.t);
      const ax = px(A.x), ay = py(A.y), bx = px(B.x), by = py(B.y);
      const type = R.units[e.a].type;
      if (e.misfire) { fx.push({ kind: 'text', x: ax, y: ay - 18, text: 'fizzle', col: '#bbb', t0: performance.now(), life: 1100 }); for (let i = 0; i < 3; i++) fx.push(smoke(ax, ay, 0.4)); return; }
      const n = type === 'archer' ? 9 : 0;
      for (let i = 0; i < (e.gun ? 6 : type === 'archer' ? 2 : 6); i++) fx.push(smoke(ax + Math.cos(A.face) * 8, ay + Math.sin(A.face) * 8, e.gun ? 1.6 : 1));
      if (!e.gun && type !== 'archer') fx.push({ kind: 'flash', x: ax + Math.cos(A.face) * 9, y: ay + Math.sin(A.face) * 9, a: A.face, t0: performance.now(), life: 160 });
      for (let i = 0; i < n; i++) fx.push({ kind: 'arrow', x0: ax + (Math.random() - 0.5) * 12, y0: ay + (Math.random() - 0.5) * 12, x1: bx + (Math.random() - 0.5) * 14, y1: by + (Math.random() - 0.5) * 14, t0: performance.now() + i * 25, life: 420 / speed() + 200 });
      if (e.gun && !e.canister) fx.push({ kind: 'ball', x0: ax, y0: ay, x1: bx, y1: by, t0: performance.now(), life: 380 });
      if (e.gun && e.canister) for (let i = 0; i < 10; i++) fx.push({ kind: 'ball', x0: ax, y0: ay, x1: bx + (Math.random() - 0.5) * 22, y1: by + (Math.random() - 0.5) * 22, t0: performance.now(), life: 240, small: true });
      fx.push({ kind: 'text', x: bx, y: by - 16, text: e.cas ? '−' + e.cas : 'miss', col: e.cas ? '#ff8a7a' : '#ccc', t0: performance.now() + 250 / speed(), life: 1200 });
    } else if (e.k === 'melee') {
      const A = unitState(e.a), B = unitState(e.t);
      const mx = (px(A.x) + px(B.x)) / 2, my = (py(A.y) + py(B.y)) / 2;
      for (let i = 0; i < (e.lance ? 14 : 8); i++) fx.push({ kind: 'spark', x: mx, y: my, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, t0: performance.now(), life: 400 });
      fx.push({ kind: 'text', x: px(B.x), y: py(B.y) - 16, text: '−' + e.casT, col: '#ff8a7a', t0: performance.now() + 200, life: 1200 });
      fx.push({ kind: 'text', x: px(A.x), y: py(A.y) - 16, text: '−' + e.casA, col: '#ffc07a', t0: performance.now() + 300, life: 1200 });
      if (e.lance) fx.push({ kind: 'text', x: mx, y: my - 24, text: 'LANCES!', col: '#fff1b8', t0: performance.now(), life: 1000 });
    } else if (e.k === 'rout') {
      const A = unitState(e.id); fx.push({ kind: 'text', x: px(A.x), y: py(A.y) - 22, text: 'breaks!', col: '#ffd27a', t0: performance.now(), life: 1300 });
    } else if (e.k === 'rally') {
      const A = unitState(e.id); fx.push({ kind: 'ring', x: px(A.x), y: py(A.y), t0: performance.now(), life: 600 });
    } else if (e.k === 'absent') {
      const A = unitState(e.id); fx.push({ kind: 'text', x: px(A.x), y: py(A.y) - 22, text: 'tally-ho!', col: '#fff1b8', t0: performance.now(), life: 1300 });
    }
  }
  const smoke = (x, y, s) => ({ kind: 'smoke', x: x + (Math.random() - 0.5) * 10 * s, y: y + (Math.random() - 0.5) * 10 * s, r: (4 + Math.random() * 4) * s, vx: (Math.random() - 0.3) * 6, vy: -3 - Math.random() * 4, t0: performance.now(), life: 2600 + Math.random() * 1200, persist: true });

  function drawFx(now) {
    fx = fx.filter((f) => now - f.t0 < f.life);
    for (const f of fx) {
      const t = (now - f.t0) / f.life;
      if (t < 0) continue;
      if (f.kind === 'smoke') { ctx.fillStyle = `rgba(225,225,215,${0.55 * (1 - t)})`; ctx.beginPath(); ctx.arc(f.x + f.vx * t * 3, f.y + f.vy * t * 3, f.r * (1 + t * 1.6), 0, 7); ctx.fill(); }
      else if (f.kind === 'flash') { ctx.fillStyle = `rgba(255,220,120,${1 - t})`; ctx.beginPath(); ctx.arc(f.x, f.y, 4 * (1 - t) + 1, 0, 7); ctx.fill(); }
      else if (f.kind === 'arrow') { const x = f.x0 + (f.x1 - f.x0) * t, y = f.y0 + (f.y1 - f.y0) * t - Math.sin(t * Math.PI) * 26; const a = Math.atan2(f.y1 - f.y0 - Math.cos(t * Math.PI) * 26 * Math.PI, f.x1 - f.x0); ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * 5, y - Math.sin(a) * 5); ctx.stroke(); }
      else if (f.kind === 'ball') { const x = f.x0 + (f.x1 - f.x0) * t, y = f.y0 + (f.y1 - f.y0) * t; ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(x, y, f.small ? 1 : 2.2, 0, 7); ctx.fill(); if (!f.small) { ctx.strokeStyle = 'rgba(30,30,30,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(x, y); ctx.stroke(); } }
      else if (f.kind === 'spark') { ctx.fillStyle = `rgba(255,240,180,${1 - t})`; ctx.fillRect(f.x + f.vx * t, f.y + f.vy * t, 1.8, 1.8); }
      else if (f.kind === 'ring') { ctx.strokeStyle = `rgba(255,230,140,${1 - t})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 8 + t * 14, 0, 7); ctx.stroke(); }
      else if (f.kind === 'text') { ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(f.text, f.x, f.y - t * 14); ctx.fillStyle = f.col; ctx.globalAlpha = 1 - t * t; ctx.fillText(f.text, f.x, f.y - t * 14); ctx.globalAlpha = 1; }
    }
  }

  function draw(now) {
    const f = R.frames[k];
    const ter = terrainCanvas(R.map);
    // camera
    let tx = WW / 2, ty = VH / 2, tz = 1;
    if (follow && f.id >= 0) { const s = unitState(f.id); tx = px(s.x); ty = py(s.y); tz = 2.2; }
    cam.x += (tx - cam.x) * 0.12; cam.y += (ty - cam.y) * 0.12; cam.z += (tz - cam.z) * 0.12;
    const hw = WW / 2 / cam.z, hh = VH / 2 / cam.z;
    const cx = Math.max(hw, Math.min(WW - hw, cam.x)), cy = Math.max(hh, Math.min(VH - hh, cam.y));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#2e3f24'; ctx.fillRect(0, 0, WW, VH);
    ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (WW / 2 - cx * cam.z), dpr * (VH / 2 - cy * cam.z));
    ctx.drawImage(ter, 0, TOP, WW, WH);
    // the dead and fled leave no marker; draw routing under the formed
    const states = R.units.map((u) => ({ u, s: unitState(u.id) }));
    states.sort((a, b) => (a.s.st === 'rout' ? 0 : 1) - (b.s.st === 'rout' ? 0 : 1) || a.s.y - b.s.y);
    for (const { u, s } of states) {
      if (s.st !== 'ok' && s.st !== 'rout') continue;
      drawCompany(ctx, { ...u, men: s.men }, px(s.x), py(s.y), s.face, u.side, { st: s.st, dis: s.dis, morale: s.morale, shake: s.shake, level: s.level, active: f.id === u.id && clock < schedEnd + 200, label: cam.z > 1.5 || el.labels });
    }
    drawFx(now);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(80, now - (last || now)); last = now;
    if (playing) {
      clock += dt * speed();
      for (const s of sched) if (!s.spawned && clock >= s.at) spawn(s);
      if (clock >= schedEnd) {
        if (single) { playing = false; single = false; setBtn(); }
        else if (k < R.frames.length - 1) startFrame(k + 1);
        else { playing = false; setBtn(); el.onEnd && el.onEnd(); }
      }
    }
    el.scrub.value = k;
    draw(now);
  }
  function setBtn() { el.play.textContent = playing ? '❚❚' : '▶︎'; }

  el.play.onclick = () => {
    if (!R) return;
    if (!playing && k >= R.frames.length - 1 && clock >= schedEnd) startFrame(0);
    playing = !playing; single = false; setBtn();
  };
  el.step.onclick = () => { if (!R) return; if (clock >= schedEnd && k < R.frames.length - 1) startFrame(k + 1); playing = true; single = true; setBtn(); };
  el.scrub.oninput = () => { if (!R) return; playing = false; setBtn(); startFrame(+el.scrub.value); clock = schedEnd; };
  el.zoom.onclick = () => { follow = !follow; el.zoom.textContent = follow ? 'Whole field' : 'Follow'; };
  el.zoom.textContent = 'Follow';

  return {
    load(result) {
      R = result; fx = [];
      const map = getMap(R.map); WW = map.w * CELL; WH = map.h * CELL; VH = WH + TOP + BOT; resize();
      cam = { x: WW / 2, y: VH / 2, z: 1 };
      el.scrub.max = R.frames.length - 1;
      startFrame(0); clock = schedEnd;
      playing = true; setBtn();
      if (!raf) raf = requestAnimationFrame(tick);
    },
    seek(i) { if (!R) return; playing = false; setBtn(); startFrame(i); clock = schedEnd; },
    get frame() { return k; },
  };
}
