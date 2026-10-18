// One battle: two armies of companies, alternating activations, until one army breaks or time runs out.
import { makeRng } from './rng.js';
import { UNITS, RATIONS, companyCost } from './units.js';
import { getMap, MOVE_COST, DISORDERS, T } from './maps.js';
import { deploy, armyCost } from './army.js';
import { resolvePersonality } from './personalities.js';
import { dist, cheb, isMounted, expectFire, expectMelee, shockOf, moraleFromLoss, ROUT_AT, SHAKEN_AT, homeGround, los, rangeOf } from './rules.js';
import { decide } from './ai.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const BREAK_AT = 0.3;   // an army whose formed men fall below 30% of its strength has lost

export class Battle {
  constructor({ armies, map = 'open', seed = 1, weather = 'fair', record = false, maxTurns = 40 }) {
    this.map = getMap(map); this.weather = weather; this.rng = makeRng(seed * 2654435761 + 7);
    this.record = record; this.maxTurns = maxTurns; this.turn = 0;
    this.occ = Array.from({ length: this.map.h }, () => new Array(this.map.w).fill(null));
    this.units = []; this.frames = []; this.log = [];
    this.armies = armies.map((a) => ({ days: 90, rations: 'full', ...a }));
    this.armies.forEach((army, side) => {
      const pos = deploy(army, side, this.map.cells);
      const r = RATIONS[army.rations] || RATIONS.full;
      army.companies.forEach((c, i) => {
        const U = UNITS[c.type];
        const cost = companyCost(c.type, army);
        const u = {
          id: this.units.length, side, type: c.type, U, pers: resolvePersonality(c.personality),
          men: U.men, start: U.men, morale: Math.max(10, U.morale + r.morale), maxMorale: Math.min(100, U.morale + r.morale + 10),
          status: 'ok', disordered: false, x: pos[i][0], y: pos[i][1], face: side ? Math.PI : 0,
          hungry: army.rations === 'half', lanceUsed: false, ammo: U.ammo, hit: false, perMan: cost.total / U.men,
          s: { inflicted: 0, lost: 0, shots: 0, charges: 0, broke: 0, misfires: 0, routed: 0, value: 0 },
        };
        u.label = (side ? 'Red' : 'Blue') + ' ' + U.short + ' ' + (this.units.filter((v) => v.side === side && v.type === c.type).length + 1);
        this.units.push(u); this.occ[u.y][u.x] = u;
      });
      army.cost = armyCost(army);
    });
    this.startMen = [0, 1].map((s) => this.units.filter((u) => u.side === s).reduce((t, u) => t + u.men, 0));
    if (record) this.frames.push({ turn: 0, id: -1, text: ['The armies deploy.'], fx: [], snap: this.snap() });
  }

  // ------------------------------------------------------------ queries
  active(u) { return u.status === 'ok' || u.status === 'rout'; }
  enemies(u) { return this.units.filter((v) => v.side !== u.side && this.active(v)); }
  friends(u) { return this.units.filter((v) => v.side === u.side && v !== u && this.active(v)); }
  adjEnemies(u, x = u.x, y = u.y, formedOnly = true) {
    const out = [];
    for (const [dx, dy] of DIRS) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= this.map.w || yy >= this.map.h) continue;
      const o = this.occ[yy][xx];
      if (o && o.side !== u.side && (o.status === 'ok' || (!formedOnly && o.status === 'rout'))) out.push(o);
    }
    return out;
  }
  moveBudget(u) { return u.U.move - (u.hungry && (u.U.mounted || u.U.rides) ? 1 : 0); }
  terrainCost(u, t) { return MOVE_COST[t][u.U.mounted || u.U.rides ? 1 : 0]; }

  // Dijkstra over the grid. Friends can be passed through (Swedish-style interpenetration) but not stood on.
  // Entering a cell next to a formed enemy ends the move (zone of control) unless ignoreZoc.
  reach(u, budget = this.moveBudget(u), { ignoreZoc = false, from = [u.x, u.y] } = {}) {
    const W = this.map.w, H = this.map.h;
    const cost = new Float32Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1), rough = new Uint8Array(W * H);
    const s0 = from[1] * W + from[0]; cost[s0] = 0;
    const heap = [[0, s0]];
    const push = (c, i) => { heap.push([c, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const mount = u.U.mounted || u.U.rides ? 1 : 0;
    while (heap.length) {
      const [c, i] = pop();
      if (c > cost[i]) continue;
      const x = i % W, y = (i / W) | 0;
      if (i !== s0 && !ignoreZoc && this.adjEnemies(u, x, y).length) continue;   // stopped by contact
      for (const [dx, dy] of DIRS) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const o = this.occ[yy][xx];
        if (o && o !== u && (o.side !== u.side || o.status !== 'ok' && o.status !== 'rout')) continue;
        const t = this.map.cells[yy][xx];
        let step = MOVE_COST[t][mount] * (dx && dy ? 1.41 : 1) + (o && o !== u ? 0.5 : 0);
        // no cutting diagonally between two blocked cells
        if (dx && dy && (MOVE_COST[this.map.cells[y][xx]][mount] === Infinity || MOVE_COST[this.map.cells[yy][x]][mount] === Infinity)) continue;
        const nc = c + step, j = yy * W + xx;
        if (nc <= budget + 1e-6 && nc < cost[j]) { cost[j] = nc; prev[j] = i; rough[j] = rough[i] | DISORDERS[t][mount]; push(nc, j); }
      }
    }
    return { cost, prev, rough, W };
  }
  pathTo(R, x, y) {
    const W = R.W; let i = y * W + x; const p = [];
    while (i >= 0) { p.push([i % W, (i / W) | 0]); i = R.prev[i]; }
    return p.reverse();
  }

  snap() { return this.units.map((u) => ({ id: u.id, x: u.x, y: u.y, men: u.men, morale: Math.round(u.morale), st: u.status, dis: u.disordered, face: +u.face.toFixed(2), ammo: u.ammo })); }

  // ------------------------------------------------------------ the loop
  run() {
    while (!this.result && this.turn < this.maxTurns) this.playTurn();
    if (!this.result) this.result = this.judge(true);
    return this.summary();
  }

  playTurn() {
    this.turn++;
    const rng = this.rng;
    const sides = [0, 1].map((s) => this.units.filter((u) => u.side === s && this.active(u)));
    for (const list of sides) for (let i = list.length - 1; i > 0; i--) { const j = rng.int(i + 1); [list[i], list[j]] = [list[j], list[i]]; }
    // engaged companies act first within their side so fights resolve before fresh troops wander in
    for (const list of sides) list.sort((a, b) => (this.adjEnemies(b).length ? 1 : 0) - (this.adjEnemies(a).length ? 1 : 0));
    const order = []; let first = this.turn % 2;
    const n = Math.max(sides[0].length, sides[1].length);
    for (let i = 0; i < n; i++) for (const s of [first, 1 - first]) if (sides[s][i]) order.push(sides[s][i]);
    for (const u of order) {
      if (this.result) break;
      if (!this.active(u)) continue;
      this.activate(u);
      this.result = this.judge(false);
    }
  }

  frameStart(u) { this.cur = { turn: this.turn, id: u.id, text: [], fx: [] }; }
  say(t) { if (this.cur) this.cur.text.push(t); }
  fx(e) { if (this.cur) this.cur.fx.push(e); }
  frameEnd() { if (this.record && this.cur && (this.cur.fx.length || this.cur.text.length)) { this.cur.snap = this.snap(); this.frames.push(this.cur); } this.cur = null; }

  activate(u) {
    if (this.record) this.frameStart(u);
    // quiet companies steady themselves a little
    if (u.status === 'ok' && !u.hit && !this.adjEnemies(u).length) u.morale = Math.min(u.maxMorale, u.morale + 2);
    u.hit = false;
    if (u.status === 'rout') this.routStep(u);
    else if (u.U.gun && u.reloading) { u.reloading = false; this.say(`${u.label} sponges out and reloads.`); }
    else this.doAction(u, decide(this, u));
    this.frameEnd();
  }

  doAction(u, act) {
    const rng = this.rng;
    switch (act.kind) {
      case 'hold': if (act.why) this.say(`${u.label} ${act.why}.`); break;
      case 'rally': {
        const gain = 8 + 12 * u.pers.discipline;
        u.morale = Math.min(u.maxMorale, u.morale + gain); u.disordered = false;
        if (u.U.lance && u.lanceUsed) { u.lanceUsed = false; this.say(`${u.label} takes up fresh lances.`); }
        this.say(`${u.label} dresses its ranks (morale ${Math.round(u.morale)}).`); this.fx({ k: 'rally', id: u.id });
        break;
      }
      case 'move': case 'fire': case 'charge': {
        let moved = 0;
        if (act.path && act.path.length > 1) {
          if (act.breakOff) this.breakOff(u);
          moved = this.moveAlong(u, act.path, act.rough);
          if (u.status !== 'ok') break;
        }
        if (act.kind === 'fire' && act.target) this.fire(u, act.target, moved);
        else if (act.kind === 'charge' && act.target && this.active(act.target)) this.melee(u, act.target, moved > 0 && !act.rough, act.roughEnd);
        else if (act.kind === 'move' && moved) this.say(`${u.label} ${act.why || 'advances'}.`);
        break;
      }
      case 'melee': this.melee(u, act.target, false, false); break;
      default: break;
    }
  }

  moveAlong(u, path, rough) {
    const [x0, y0] = path[0], [x1, y1] = path[path.length - 1];
    this.occ[u.y][u.x] = null; u.x = x1; u.y = y1; this.occ[y1][x1] = u;
    if (x1 !== x0 || y1 !== y0) u.face = Math.atan2(y1 - path[path.length - 2][1], x1 - path[path.length - 2][0]);
    if (rough) { if (!u.disordered) this.say(`${u.label} loses its order crossing rough ground.`); u.disordered = true; }
    this.fx({ k: 'move', id: u.id, path });
    let m = 0; for (let i = 1; i < path.length; i++) m += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    return m;
  }

  breakOff(u) {
    const foes = this.adjEnemies(u);
    if (isMounted(u)) { u.morale -= 4; this.say(`${u.label} wheels away from the melee.`); return; }
    let cas = 0;
    for (const e of foes) cas += this.rng.casualties(e.U.melee * Math.min(e.men, e.U.frontage) * 0.03, u.men);
    this.applyLoss(u, cas, null);
    u.morale -= 8; u.disordered = true;
    this.say(`${u.label} falls back from the fight, losing ${cas}.`);
  }

  face(u, t) { u.face = Math.atan2(t.y - u.y, t.x - u.x); }

  fire(u, t, moved) {
    const rng = this.rng;
    this.face(u, t); u.s.shots++; u.ammo--;
    if (u.ammo === 0) this.say(`${u.label} has fired its last ${u.type === 'archer' ? 'arrows' : 'charges'}.`);
    const raw = expectFire(this, u, u.x, u.y, t, moved);
    let mean = raw;
    if (this.weather === 'rain') {
      mean = raw / (1 - u.U.wet || 1);
      if (rng() < u.U.wet) {
        u.s.misfires++;
        this.say(`${u.label}'s ${u.type === 'archer' ? 'bowstrings are sodden' : 'powder is damp'}: the volley fizzles.`);
        this.fx({ k: 'fire', a: u.id, t: t.id, cas: 0, misfire: true });
        return;
      }
    }
    const cas = rng.casualties(mean, t.men);
    const menBefore = t.men;
    this.applyLoss(t, cas, u);
    const shock = moraleFromLoss(cas, menBefore, 90) + shockOf(u, t);
    t.morale -= shock; t.hit = true;
    this.fx({ k: 'fire', a: u.id, t: t.id, cas, gun: !!u.U.gun, canister: u.U.gun && dist(u.x, u.y, t.x, t.y) <= 3.5 });
    if (u.U.gun) u.reloading = true;
    const what = u.U.gun ? (dist(u.x, u.y, t.x, t.y) <= 3.5 ? 'canister' : 'roundshot') : u.type === 'archer' ? 'a flight of arrows' : u.U.mounted ? 'pistols' : 'a volley';
    this.say(`${u.label} fires ${what} into ${t.label}: ${cas} down.`);
    this.checkMorale(t, u);
  }

  applyLoss(t, cas, by) {
    cas = Math.min(cas, t.men);
    t.men -= cas; t.s.lost += cas;
    if (by) { by.s.inflicted += cas; by.s.value += cas * t.perMan; }
    if (t.men <= Math.max(4, t.start * 0.15) && this.active(t)) this.remove(t, 'gone', `${t.label} is shot to pieces and scatters.`);
  }

  remove(u, st, text) {
    u.status = st; this.occ[u.y][u.x] = null;
    if (text) this.say(text);
    this.fx({ k: st, id: u.id });
  }

  checkMorale(t, by) {
    if (t.status !== 'ok') return;
    if (t.morale < ROUT_AT) {
      t.status = 'rout'; t.disordered = true; t.s.routed++;
      if (by) by.s.broke++;
      this.say(`${t.label} breaks and runs!`); this.fx({ k: 'rout', id: t.id });
      // panic is catching
      for (const f of this.friends(t)) if (f.status === 'ok' && cheb(f.x, f.y, t.x, t.y) <= 2) { f.morale -= f.U.mounted ? 4 : 7; f.hit = true; this.checkMorale(f, null); }
    }
  }

  melee(a, d, charge, roughEnd) {
    const rng = this.rng;
    if (!this.active(d) || cheb(a.x, a.y, d.x, d.y) > 1) return;
    this.face(a, d);
    const verb = charge ? (a.U.mounted ? 'charges' : 'charges home on') : 'fights';
    // shot get one closing volley at a charge to their front, guns fire canister
    if (charge && d.status === 'ok' && d.U.range && d.ammo > 0 && !d.reloading && aspectFront(d, a)) {
      d.ammo--;
      const cv = expectFire(this, d, d.x, d.y, a, 0) * (d.U.gun ? 1 : 0.4);
      if (cv > 0 && !(this.weather === 'rain' && rng() < d.U.wet)) {
        const c = rng.casualties(cv, a.men), mb = a.men;
        this.applyLoss(a, c, d); a.morale -= moraleFromLoss(c, mb, 90) + 2;
        this.fx({ k: 'fire', a: d.id, t: a.id, cas: c, gun: !!d.U.gun, canister: !!d.U.gun, closing: true });
        this.say(`${d.label} gives ${a.label} a closing ${d.U.gun ? 'blast of canister' : 'volley'}: ${c} down.`);
        if (!this.active(a)) return;
        if (a.morale < ROUT_AT) { this.checkMorale(a, d); return; }
      }
    }
    if (charge) a.s.charges++;
    const E = expectMelee(this, a, a.x, a.y, d, charge, roughEnd);
    if (charge && a.U.lance && !a.lanceUsed && E.chargeMult > 1) a.lanceUsed = true;
    const casD = rng.casualties(E.casD * rng.range(0.8, 1.2), d.men);
    const casA = rng.casualties(E.casA * rng.range(0.8, 1.2), a.men);
    const mA = a.men, mD = d.men;
    this.applyLoss(d, casD, a); this.applyLoss(a, casA, d);
    const rA = casA / Math.max(1, mA), rD = casD / Math.max(1, mD);
    const aWins = rD > rA * 1.1, dWins = rA > rD * 1.1;
    d.morale -= moraleFromLoss(casD, mD, 110) + E.flankShock + (aWins ? 8 : 0) - (dWins ? 3 : 0);
    a.morale -= moraleFromLoss(casA, mA, 110) + (dWins ? 8 : 0) - (aWins ? 3 : 0);
    d.hit = a.hit = true;
    if (charge && a.U.mounted && (d.U.antiCav <= 1 || E.asp)) a.disordered = a.disordered || rng() < 0.3;
    if (roughEnd && a.U.mounted) a.disordered = true;
    const where = E.asp === 2 ? ' in the rear' : E.asp === 1 ? ' in the flank' : '';
    const brace = E.braced ? ' The pikes stand; the horses will not face the points.' : '';
    this.say(`${a.label} ${verb} ${d.label}${where}: ${casD} of theirs, ${casA} of ours.${brace}`);
    this.fx({ k: 'melee', a: a.id, t: d.id, casA, casT: casD, charge, win: aWins ? 1 : dWins ? -1 : 0, lance: charge && a.U.lance && E.chargeMult > 2 });
    const dWasRouting = d.status === 'rout';
    this.checkMorale(d, a); this.checkMorale(a, d);
    // the beaten side gives ground
    if (this.active(d) && d.status === 'ok' && aWins) this.giveGround(d, a);
    if (this.active(a) && a.status === 'ok' && dWins && a.U.mounted) this.giveGround(a, d);
    if (dWasRouting && this.active(d)) this.routStep(d, true);
  }

  giveGround(u, from) {
    const dx = Math.sign(u.x - from.x), dy = Math.sign(u.y - from.y);
    for (const [ox, oy] of [[dx, dy], [dx, 0], [0, dy], [dx, -dy], [-dy || dx, dx || dy]]) {
      const x = u.x + ox, y = u.y + oy;
      if ((!ox && !oy) || x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) continue;
      if (this.occ[y][x] || MOVE_COST[this.map.cells[y][x]][0] === Infinity) continue;
      this.occ[u.y][u.x] = null; const p = [[u.x, u.y], [x, y]]; u.x = x; u.y = y; this.occ[y][x] = u;
      u.disordered = true; this.fx({ k: 'move', id: u.id, path: p, push: true });
      return;
    }
    u.morale -= 6; this.checkMorale(u, from);   // nowhere to go
  }

  // A routing company tries to rally if nobody is close, otherwise runs for its own edge.
  routStep(u, chased = false) {
    const rng = this.rng; const foes = this.enemies(u).filter((e) => e.status === 'ok');
    const near = foes.reduce((m, e) => Math.min(m, dist(e.x, e.y, u.x, u.y)), 99);
    if (!chased && near > 5 && rng() < 0.3 + 0.35 * u.pers.discipline) {
      u.morale += 14;
      if (u.morale >= 30) { u.status = 'ok'; u.disordered = true; u.morale = Math.min(u.morale, 35); this.say(`${u.label} rallies to its colours.`); this.fx({ k: 'rally', id: u.id }); return; }
    }
    const R = this.reach(u, this.moveBudget(u) + 1, { ignoreZoc: true });
    const home = u.side === 0 ? 0 : this.map.w - 1;
    let best = null, bs = -1e9;
    for (let i = 0; i < R.cost.length; i++) {
      if (R.cost[i] === Infinity) continue;
      const x = i % R.W, y = (i / R.W) | 0;
      if (this.occ[y][x] && this.occ[y][x] !== u) continue;
      const dn = foes.reduce((m, e) => Math.min(m, dist(e.x, e.y, x, y)), 99);
      const s = Math.min(dn, 8) * 1.0 - Math.abs(x - home) * 0.8 + rng() * 0.3;
      if (s > bs) { bs = s; best = [x, y]; }
    }
    if (best) {
      const path = this.pathTo(R, best[0], best[1]);
      this.occ[u.y][u.x] = null; u.x = best[0]; u.y = best[1]; this.occ[u.y][u.x] = u;
      this.fx({ k: 'move', id: u.id, path, flee: true });
    }
    if (u.x === home) {
      this.remove(u, 'fled', `${u.label} flees the field.`);
      // hotheaded horse may follow them right off the map
      for (const e of foes) {
        if (!e.U.mounted || e.status !== 'ok' || cheb(e.x, e.y, u.x, u.y) > 3) continue;
        if (rng() < (e.pers.pursuit - 0.5) * 1.2) this.remove(e, 'absent', `${e.label} gallops off after them and is lost to the battle.`);
      }
    } else if (chased) this.say(`${u.label} is cut down as it runs.`);
  }

  // ------------------------------------------------------------ victory
  standing(side) { return this.units.filter((u) => u.side === side && u.status === 'ok').reduce((t, u) => t + u.men, 0); }
  strength(side) { return this.startMen[side] - this.units.filter((u) => u.side === side && u.status === 'absent').reduce((t, u) => t + u.start, 0); }
  judge(timeUp) {
    const frac = [0, 1].map((s) => this.standing(s) / Math.max(1, this.strength(s)));
    const broken = frac.map((f) => f < BREAK_AT);
    if (broken[0] && broken[1]) return { winner: frac[0] === frac[1] ? -1 : frac[0] > frac[1] ? 0 : 1, how: 'mutual' };
    if (broken[0]) return { winner: 1, how: 'broke' };
    if (broken[1]) return { winner: 0, how: 'broke' };
    if (timeUp) {
      // nightfall: whoever has more of their army still in good order
      const val = [0, 1].map((s) => this.units.filter((u) => u.side === s && u.status === 'ok').reduce((t, u) => t + u.men * u.perMan * (0.5 + u.morale / 200), 0) / Math.max(1, this.armies[s].cost.total));
      if (Math.abs(val[0] - val[1]) < 0.05) return { winner: -1, how: 'nightfall' };
      return { winner: val[0] > val[1] ? 0 : 1, how: 'nightfall' };
    }
    return null;
  }

  summary() {
    return {
      winner: this.result.winner, how: this.result.how, turns: this.turn,
      cost: this.armies.map((a) => a.cost),
      units: this.units.map((u) => ({ id: u.id, side: u.side, type: u.type, personality: u.pers.id, label: u.label, start: u.start, men: u.men, status: u.status, ...u.s, perMan: u.perMan })),
      frames: this.record ? this.frames : undefined,
      map: this.map.id, weather: this.weather,
    };
  }
}

function aspectFront(d, a) {
  const ang = Math.atan2(a.y - d.y, a.x - d.x);
  let diff = Math.abs(ang - d.face) % (2 * Math.PI); if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff <= 1.25;
}
