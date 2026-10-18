// The arithmetic of a 17th-century firefight and push of pike. Pure functions of the battle state, shared by the
// resolver (which rolls dice around these means) and the AI (which plans with them).
import { T, COVER, DEF_MELEE } from './maps.js';

export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export const MELEE_K = 0.11;      // casualties per point of melee power
export const ROUT_AT = 20;        // morale below this and the company runs
export const SHAKEN_AT = 40;      // morale below this and it fights at 70%

export const isMounted = (u) => !!u.U.mounted;
export const status = (u) => (u.morale < SHAKEN_AT ? 0.7 : 1) * (u.disordered ? 0.8 : 1);

export function terrainAt(b, x, y) { return b.map.cells[y][x]; }
export const onHill = (b, x, y) => terrainAt(b, x, y) === T.HILL;

// Line of sight: woods and villages block (the end cells themselves don't); a hill crest blocks unless
// one end is up on a hill.
export function los(b, ax, ay, bx, by) {
  const up = onHill(b, ax, ay) || onHill(b, bx, by);
  const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  for (let i = 1; i < n; i++) {
    const x = Math.round(ax + (bx - ax) * i / n), y = Math.round(ay + (by - ay) * i / n);
    const t = b.map.cells[y][x];
    if (t === T.WOODS || t === T.VILLAGE) return false;
    if (t === T.HILL && !up) return false;
    const o = b.occ[y][x];
    if (o && o.status === 'ok' && !o.U.gun && i < n - 1 && n > 2 && !up) return false;   // a formed company in the way screens beyond
  }
  return true;
}

export function rangeOf(b, u, x, y) {
  let r = u.U.range;
  if (!r) return 0;
  if (onHill(b, x, y) && !u.U.gun) r += 1;
  if (b.weather === 'rain' && u.type === 'archer') r -= 1;
  if (b.weather === 'fog') r = Math.min(r, 4);
  return r;
}

// home ground for levies: their own half of the field
export const homeGround = (b, u, x) => !!u.U.home && (u.side === 0 ? x < b.map.w / 2 : x >= b.map.w / 2);

// Expected casualties from u (standing at x,y, having moved `moved` cells) firing at t.
export function expectFire(b, u, x, y, t, moved = 0) {
  const d = dist(x, y, t.x, t.y);
  const R = rangeOf(b, u, x, y);
  if (!R || d > R + 0.5 || u.ammo <= 0) return 0;
  const cover = COVER[terrainAt(b, t.x, t.y)];
  let mean;
  if (u.U.gun) {
    const guns = Math.max(1, Math.ceil(u.U.guns * u.men / u.start));
    if (d <= 3.5) mean = 3.2 * guns;                                              // canister
    else mean = 1.4 * guns * (1 - 0.7 * (d - 3) / (R - 3)) * (isMounted(t) ? 0.7 : 1);                  // roundshot through the ranks
    const deep = t.type === 'pikeman' || t.type === 'conscript' ? 1.4 : 1;    // deep files suffer most
    mean *= deep * Math.sqrt(Math.max(0.2, t.men / 60)) * (cover < 1 ? 0.6 + cover * 0.4 : 1);
  } else {
    const f = 1.6 - 1.1 * (Math.max(1, d) - 1) / Math.max(1, R - 1);
    const shooters = u.men * (isMounted(u) ? 1 : moved > 0 ? 0.85 : 1);
    const armour = 1 - Math.min(0.9, t.U.armour * (1 - (u.U.pen ?? 0.5)) * 1.6);
    mean = shooters * u.U.fire * f * armour * cover * (isMounted(t) ? 1.25 : 1);
  }
  mean *= status(u);
  if (b.weather === 'rain') mean *= 1 - u.U.wet;    // expected value; the resolver rolls the misfire itself
  return Math.min(mean, t.men);
}

// morale damage from casualties (fraction of the company) plus the shock of the weapon
export function shockOf(u, t) {
  if (u.U.gun) return isMounted(t) ? 3 : 4;
  if (u.type === 'archer') return isMounted(t) ? 4 : 1.5;  // arrows panic horses
  return 3;
}
export const moraleFromLoss = (cas, men, k = 100) => (men > 0 ? cas / men * k : 0);

// where the blow lands relative to the defender's facing: 0 front, 1 flank, 2 rear
export function aspect(d, fromX, fromY) {
  const ang = Math.atan2(fromY - d.y, fromX - d.x);
  let diff = Math.abs(ang - d.face) % (2 * Math.PI);
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff > 2.6 ? 2 : diff > 1.25 ? 1 : 0;
}

export const effMen = (u) => Math.min(u.men, u.U.frontage) * (0.4 + 0.6 * Math.max(0, u.morale) / 100);

// Expected outcome of `a` (fighting from ax,ay) attacking `d` hand to hand.
// charge: true when a moved into contact this activation over clean ground.
export function expectMelee(b, a, ax, ay, d, charge = false, roughEnd = false) {
  const asp = aspect(d, ax, ay);
  const flank = asp === 2 ? 1.8 : asp === 1 ? 1.4 : 1;
  const mounted = isMounted(a);
  const braced = mounted && asp === 0 && d.U.antiCav > 1 && !d.disordered && d.morale >= SHAKEN_AT && d.status === 'ok';
  let chargeMult = 1;
  if (charge && !a.disordered && !roughEnd && !braced) {
    chargeMult = a.U.lance ? (a.lanceUsed ? 1.4 : a.U.charge) : a.U.charge;
  }
  const dTerr = terrainAt(b, d.x, d.y);
  const homeA = homeGround(b, a, ax) ? 1.2 : 1, homeD = homeGround(b, d, d.x) ? 1.2 : 1;
  let pa = effMen(a) * a.U.melee * chargeMult * status(a) * flank * homeA;
  let pd;
  if (d.status === 'rout') { pd = 0; pa *= 2; }
  else {
    const anti = mounted && asp === 0 ? (d.disordered ? Math.min(1, d.U.antiCav) : d.U.antiCav) : 1;
    pd = effMen(d) * d.U.melee * DEF_MELEE[dTerr] * status(d) * anti * homeD * (asp ? 0.6 : 1);
    if (mounted && (dTerr === T.WOODS || dTerr === T.VILLAGE || dTerr === T.HEDGE)) pd *= 1.3;   // horse into hedges and houses
  }
  const casD = Math.min(d.men, pa * MELEE_K * (1 - d.U.armour * 0.6));
  const casA = Math.min(a.men, pd * MELEE_K * (1 - a.U.armour * 0.6));
  // the terror of a horse charge on foot standing in the open without pikes
  const horseShock = mounted && chargeMult > 1 && !isMounted(d) && d.status === 'ok' && DEF_MELEE[dTerr] <= 1 ? 12 : 0;
  return { casD, casA, asp, braced, chargeMult, flankShock: (asp === 2 ? 20 : asp === 1 ? 10 : 0) + horseShock };
}
