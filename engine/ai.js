// Utility AI for one company's activation: score every (destination × action × target) and take the best.
// Personality traits weight the terms; the arithmetic comes from rules.js so the AI plans with the same numbers
// the dice are rolled around.
import { dist, cheb, expectFire, expectMelee, shockOf, rangeOf, los, isMounted, ROUT_AT, SHAKEN_AT, aspect } from './rules.js';
import { COVER, T } from './maps.js';

const REF_PER_MAN = 600;   // a foot soldier for a month, in pence

// how much a casualty on t is worth, in "foot soldiers"
function worth(t, mode) {
  const r = t.perMan / REF_PER_MAN;
  return Math.pow(r, mode === 'costly' ? 0.75 : 0.3);
}

function targetMult(u, t, d) {
  const p = u.pers;
  let m = 1;
  switch (p.target) {
    case 'nearest': m *= Math.max(0.6, 1.35 - 0.07 * d); break;
    case 'weakest': m *= 1 + 0.8 * (1 - t.men / t.start) + 0.6 * (1 - Math.max(0, t.morale) / 100); break;
    case 'threat':  m *= 1 + Math.min(1, t.s.inflicted / 25); break;
    default: break;
  }
  return m;
}

// value of hurting t by `cas` men and `ml` morale
function hurtValue(u, t, cas, ml) {
  const w = worth(t, u.pers.target);
  let v = cas * w + ml * t.men / 100 * w * 0.35;
  if (t.status === 'ok' && t.morale - ml < ROUT_AT) v += t.men * w * 0.45;    // breaking a company is worth a lot
  return v;
}

function ghost(u, x, y, face) { const g = Object.create(u); g.x = x; g.y = y; g.face = face; return g; }

// expected harm the enemy can do to u if it stands at (x,y) after this activation
function danger(b, u, x, y, foes, pikeCover) {
  let total = 0;
  const g = ghost(u, x, y, faceToward(x, y, foes));
  for (const e of foes) {
    const d = dist(e.x, e.y, x, y);
    const reachFire = e.U.range ? rangeOf(b, e, e.x, e.y) + Math.min(e.U.move, e.U.moveFire) : 0;
    const reachCharge = e.U.move + 1.5;
    if (d > Math.max(reachFire, reachCharge) + 0.5) continue;
    let worst = 0;
    if (e.U.range && d <= reachFire + 0.5) {
      const R = rangeOf(b, e, e.x, e.y);
      let ex = e.x, ey = e.y;
      if (d > R) { const f = (d - R) / d; ex = Math.round(e.x + (x - e.x) * f); ey = Math.round(e.y + (y - e.y) * f); }
      const cas = expectFire(b, e, ex, ey, g, d > R ? 1 : 0);
      worst = cas + (cas / Math.max(1, u.men) * 90 + shockOf(e, u)) * 0.3;
    }
    if (d <= reachCharge && !e.U.gun && e.morale >= SHAKEN_AT) {
      const cx = Math.round(x + (e.x - x) / Math.max(1, d)), cy = Math.round(y + (e.y - y) / Math.max(1, d));
      const E = expectMelee(b, e, cx, cy, g, true, false);
      let threat = E.casD + (E.casD / Math.max(1, u.men) * 110 + E.flankShock) * 0.3 - E.casA * 0.5;
      if (isMounted(e) && pikeCover && u.U.antiCav < 1) threat *= 0.35;   // horse won't come at shot sleeved by pikes
      if (!isMounted(e)) threat *= 0.6;                                    // foot are slow to come on
      worst = Math.max(worst, threat);
    }
    total += worst;
  }
  return total * 0.4;    // not every enemy will pick us
}

function faceToward(x, y, foes) {
  let best = null, bd = 1e9;
  for (const e of foes) { const d = dist(e.x, e.y, x, y); if (d < bd) { bd = d; best = e; } }
  return best ? Math.atan2(best.y - y, best.x - x) : 0;
}

export function decide(b, u) {
  const p = u.pers, rng = b.rng;
  const foesAll = b.enemies(u);
  const foes = foesAll.filter((e) => e.status === 'ok');
  if (!foesAll.length) return { kind: 'hold' };
  const friends = b.friends(u).filter((f) => f.status === 'ok');
  const noise = () => p.randomness * rng.gauss() * 3;
  const wD = 0.15 + p.caution * 0.8;
  const wU = worth(u, 'nearest');
  // the longer the day, the harder the generals push
  const push = Math.min(2, b.turn / 12);
  const pikeAt = (x, y) => friends.some((f) => f.type === 'pikeman' && cheb(f.x, f.y, x, y) <= 1);
  const nearestFoe = (x, y, list = foes.length ? foes : foesAll) => list.reduce((m, e) => Math.min(m, dist(e.x, e.y, x, y)), 99);
  const avgFriendX = friends.length ? friends.reduce((s, f) => s + f.x, 0) / friends.length : u.x;

  const R0 = u.ammo > 0 ? u.U.range : 0;
  const ranged = R0 >= 2;
  const want = u.U.gun ? R0 * 0.75 : ranged ? Math.max(1.5, R0 * (0.35 + 0.55 * p.caution + 0.2 * (1 - p.discipline))) : 0;
  const d0 = nearestFoe(u.x, u.y);

  function position(x, y) {
    const d1 = nearestFoe(x, y);
    let s = 0;
    if (u.U.gun) s -= Math.abs(d1 - want) * 0.2;
    else if (ranged && p.aggression < 0.75) s += (Math.abs(d0 - want) - Math.abs(d1 - want)) * (0.6 + 0.4 * push);
    else s += (d0 - d1) * (0.3 + p.aggression * 0.9 + 0.4 * push);
    let adjF = 0;
    for (const f of friends) if (cheb(f.x, f.y, x, y) <= 1) adjF++;
    s += Math.min(adjF, 3) * 0.3 * p.cohesion;
    if (!u.U.mounted) s -= Math.max(0, Math.abs(x - avgFriendX) - 2) * 0.12 * p.cohesion;
    const t = b.map.cells[y][x];
    if (R0) s += (1 - COVER[t]) * 2 * (0.3 + p.caution) + (t === T.HILL ? 0.5 : 0);
    if (u.U.mounted && (t === T.WOODS || t === T.VILLAGE || t === T.MARSH)) s -= 1.5;
    return s;
  }

  let best = { kind: 'hold', score: -1e9 };
  const consider = (act, score) => { score += noise(); if (score > best.score) { act.score = score; best = act; } };

  const engaged = b.adjEnemies(u);            // formed enemies in contact
  const adjAll = b.adjEnemies(u, u.x, u.y, false);
  const here = danger(b, u, u.x, u.y, foes, pikeAt(u.x, u.y));

  // ---------- in contact: fight, stand, or get out
  if (engaged.length || adjAll.length) {
    consider({ kind: 'hold', why: engaged.length ? 'stands its ground' : '' }, position(u.x, u.y) - wD * here * wU + (u.type === 'pikeman' && engaged.some(isMounted) ? 2 : 0));
    for (const t of adjAll) {
      const E = expectMelee(b, u, u.x, u.y, t, false, false);
      const mlD = E.casD / Math.max(1, t.men) * 110 + E.flankShock;
      const mlA = E.casA / Math.max(1, u.men) * 110;
      let v = hurtValue(u, t, E.casD, mlD) * targetMult(u, t, 1) - (E.casA * wU + (u.morale - mlA < ROUT_AT ? u.men * wU * 0.5 : 0)) * (0.6 + p.caution);
      if (t.status === 'rout') v *= 0.3 + p.pursuit;
      v += p.aggression * 1.5;
      consider({ kind: 'melee', target: t }, v + position(u.x, u.y) - wD * here * wU * 0.5);
    }
    if (!u.U.gun || u.U.move) {
      const R = b.reach(u, b.moveBudget(u), { ignoreZoc: true });
      for (let i = 0; i < R.cost.length; i++) {
        if (R.cost[i] === Infinity) continue;
        const x = i % R.W, y = (i / R.W) | 0;
        if (b.occ[y][x] || b.adjEnemies(u, x, y).length) continue;
        const cost = isMounted(u) ? 1.5 : 4 + u.men * 0.05;
        const s = position(x, y) - wD * danger(b, u, x, y, foes, pikeAt(x, y)) * wU - cost + (here * wU * p.caution * 0.6) - (1 - p.caution) * 3;
        consider({ kind: 'move', path: b.pathTo(R, x, y), rough: !!R.rough[i], breakOff: true, why: 'falls back' }, s);
      }
    }
    return best;
  }

  // ---------- free to manoeuvre
  if (u.morale < Math.min(SHAKEN_AT + 10, u.maxMorale - 12) || u.disordered || (u.U.lance && u.lanceUsed)) {
    const rv = ((u.maxMorale - u.morale) * 0.09 + (u.disordered ? 2.5 : 0) + (u.U.lance && u.lanceUsed ? 3 : 0)) * (0.5 + p.discipline);
    consider({ kind: 'rally' }, rv + position(u.x, u.y) - wD * here * wU);
  }

  const R = b.reach(u);
  const moveFire = u.U.moveFire;
  for (let i = 0; i < R.cost.length; i++) {
    const c = R.cost[i];
    if (c === Infinity) continue;
    const x = i % R.W, y = (i / R.W) | 0;
    const o = b.occ[y][x];
    if (o && o !== u) continue;
    const moved = c;
    const pos = position(x, y);
    const dz = danger(b, u, x, y, foes, pikeAt(x, y)) * wU * wD;
    const base = pos - dz;
    const path = moved ? b.pathTo(R, x, y) : null;
    const rough = !!R.rough[i];
    if (moved) consider({ kind: 'move', path, rough }, base);
    else consider({ kind: 'hold' }, base - 0.2);

    // fire from here
    if (R0 && u.ammo > 0 && moved <= moveFire + 1e-6 && !(u.U.gun && moved)) {
      const Rr = rangeOf(b, u, x, y);
      for (const t of foes) {
        const d = dist(x, y, t.x, t.y);
        if (d > Rr + 0.5 || !los(b, x, y, t.x, t.y)) continue;
        const cas = expectFire(b, u, x, y, t, moved);
        if (cas <= 0.05) continue;
        const ml = cas / Math.max(1, t.men) * 90 + shockOf(u, t) * (b.weather === 'rain' ? 1 - u.U.wet : 1);
        let v = hurtValue(u, t, cas, ml) * targetMult(u, t, d);
        // disciplined shot would rather close and give one good volley than pepper at long range
        if (!u.U.gun && !u.U.mounted) v *= 1 - 0.45 * p.discipline * Math.max(0, d - 1.5) / Math.max(1, Rr - 1);
        // with few charges left, save them for close range
        const ammoLeft = u.ammo / u.U.ammo;
        if (d > Rr * 0.6) v *= 0.4 + 0.6 * Math.sqrt(ammoLeft);
        const focus = (b.focus?.[t.id] || 0);
        v *= 1 + p.focus * 0.35 * Math.min(2, focus);
        consider({ kind: 'fire', path, rough, target: t }, base + v + (moved ? 0 : 0.3));
      }
    }
    // charge from here
    if (moved > 0 && u.morale >= SHAKEN_AT && !u.U.gun) {
      for (const t of b.adjEnemies(u, x, y, false)) {
        const roughEnd = [T.WOODS, T.VILLAGE, T.HEDGE, T.MARSH, T.FORD].includes(b.map.cells[t.y][t.x]) && isMounted(u);
        const g = ghost(u, x, y, Math.atan2(t.y - y, t.x - x));
        const E = expectMelee(b, g, x, y, t, !rough, roughEnd);
        let closing = 0;
        if (t.status === 'ok' && t.U.range && t.ammo > 0 && !t.reloading && aspect(t, x, y) === 0) closing = expectFire(b, t, t.x, t.y, g, 0) * (t.U.gun ? 1 : 0.4);
        const mlD = E.casD / Math.max(1, t.men) * 110 + E.flankShock + (E.casD > E.casA ? 8 : 0);
        const mlA = (E.casA + closing) / Math.max(1, u.men) * 110;
        let v = hurtValue(u, t, E.casD, mlD) * targetMult(u, t, dist(u.x, u.y, t.x, t.y))
          - ((E.casA + closing) * wU + (u.morale - mlA < ROUT_AT ? u.men * wU * 0.5 : 0)) * (0.55 + p.caution * 0.9);
        if (t.status === 'rout') v *= 0.25 + p.pursuit;
        else v += p.aggression * 3 + push;
        if (E.braced) v -= 4 * (1 - p.aggression * 0.5);
        v *= 1 + p.focus * 0.3 * Math.min(2, b.focus?.[t.id] || 0);
        // the charger will stand in contact afterwards; the danger term counts the rest of the enemy
        consider({ kind: 'charge', path, rough, roughEnd, target: t }, pos - dz * 0.6 + v);
      }
    }
  }
  if (best.target) { b.focus = b.focus && b.focusTurn === b.turn ? b.focus : (b.focusTurn = b.turn, {}); b.focus[best.target.id] = (b.focus[best.target.id] || 0) + 1; }
  if (best.kind === 'move' && !best.why) best.why = nearestFoe(best.path.at(-1)[0], best.path.at(-1)[1]) < d0 ? 'advances' : 'shifts position';
  return best;
}
