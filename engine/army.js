// Mustering: what an army costs, building one to a budget, and where it deploys.
import { UNITS, RATIONS, companyCost } from './units.js';
import { W, H, MOVE_COST } from './maps.js';

// army = { companies: [{ type, personality }], days, rations }
export function armyCost(army) {
  const opts = { days: army.days ?? 90, rations: army.rations || 'full' };
  const t = { kit: 0, pay: 0, food: 0, total: 0, men: 0, horses: 0 };
  for (const c of army.companies) {
    const k = companyCost(c.type, opts);
    t.kit += k.kit; t.pay += k.pay; t.food += k.food; t.total += k.total;
    t.men += UNITS[c.type].men;
    if (UNITS[c.type].mounted || UNITS[c.type].rides) t.horses += UNITS[c.type].men;
    if (UNITS[c.type].gun) t.horses += 16;
  }
  return t;
}

// Recipes are ratios. buildArmy keeps adding the company that most lags its share until money runs out.
export const ARMY_PRESETS = {
  swedish:  { name: 'Swedish brigade', blurb: 'Gustavus Adolphus: 2 shot to 1 pike, regimental guns, aggressive horse.', mix: { musketeer: 6, pikeman: 3, harquebusier: 2, artillery: 1 }, pers: { harquebusier: 'hothead' } },
  tercio:   { name: 'Spanish tercio', blurb: 'Deep pike squares sleeved with shot, a little heavy horse. Old, slow, hard.', mix: { pikeman: 5, musketeer: 4, cuirassier: 1 }, pers: { pikeman: 'stalwart' } },
  rupert:   { name: 'Cavalier horse', blurb: 'Rupert\'s Royalists: lots of fine horse who charge first and think later.', mix: { harquebusier: 3, cuirassier: 1, musketeer: 3, pikeman: 1 }, pers: { harquebusier: 'hothead', cuirassier: 'hothead' } },
  newmodel: { name: 'New Model Army', blurb: 'Disciplined horse that rallies after a charge, firelocks to guard the guns.', mix: { musketeer: 4, pikeman: 2, harquebusier: 2, firelock: 1, dragoon: 1, artillery: 1 }, pers: { harquebusier: 'stalwart', dragoon: 'skirmisher' } },
  levy:     { name: 'Peasant host', blurb: 'Clubmen and pressed men with a stiffening of trained bands. Numbers.', mix: { conscript: 8, trainedband: 2 }, pers: {} },
  oldways:  { name: 'The old ways', blurb: 'What if 1595 had gone the other way: longbows, pikes and lancers.', mix: { archer: 5, pikeman: 2, hussar: 2 }, pers: { archer: 'skirmisher', hussar: 'hothead' } },
  polish:   { name: 'Polish–Lithuanian', blurb: 'Winged hussars backed by shot and dragoons. Kircholm, 1605.', mix: { hussar: 2, harquebusier: 1, musketeer: 2, dragoon: 1, conscript: 2 }, pers: { hussar: 'hothead', dragoon: 'skirmisher' } },
  raiders:  { name: 'Dragoon raiders', blurb: 'Fast mounted shot that rides to cover and snipes.', mix: { dragoon: 4, firelock: 3, harquebusier: 1 }, pers: { dragoon: 'skirmisher' } },
  gunline:  { name: 'Gun line', blurb: 'A grand battery behind firelocks and pikes. Come and get it.', mix: { artillery: 3, firelock: 4, pikeman: 3 }, pers: { firelock: 'cautious', pikeman: 'stalwart' } },
};
export const ARMY_PRESET_IDS = Object.keys(ARMY_PRESETS);

export function buildArmy(mix, budget, { days = 90, rations = 'full', personality = 'steady', pers = {}, maxCompanies = 24 } = {}) {
  const types = Object.keys(mix).filter((t) => mix[t] > 0);
  const sum = types.reduce((s, t) => s + mix[t], 0);
  const count = Object.fromEntries(types.map((t) => [t, 0]));
  const cost = Object.fromEntries(types.map((t) => [t, companyCost(t, { days, rations }).total]));
  const companies = []; let spent = 0;
  for (let guard = 0; guard < 400 && companies.length < maxCompanies; guard++) {
    const n = companies.length + 1;
    // the type furthest below its share that we can still afford
    const cand = types.filter((t) => spent + cost[t] <= budget).sort((a, b) => (count[a] - n * mix[a] / sum) - (count[b] - n * mix[b] / sum) || cost[a] - cost[b]);
    if (!cand.length) break;
    const t = cand[0]; count[t]++; spent += cost[t];
    companies.push({ type: t, personality: pers[t] || personality });
  }
  return { companies, days, rations };
}

export const fromPreset = (id, budget, opts = {}) => {
  const P = ARMY_PRESETS[id];
  return { ...buildArmy(P.mix, budget, { ...opts, pers: { ...P.pers, ...(opts.pers || {}) } }), name: P.name };
};
export const monoArmy = (type, budget, opts = {}) => ({ ...buildArmy({ [type]: 1 }, budget, opts), name: UNITS[type].name });

// ---------------------------------------------------------------- deployment
// Classic order of battle: guns in front of the centre, foot in the centre with pikes spread among the shot,
// horse on the wings, dragoons on the far flanks. Side 0 deploys on the left facing right.
const isHorse = (t) => UNITS[t].mounted;
const DEPLOY_DEPTH = 6;

export function deploy(army, side, cells) {
  const idx = army.companies.map((c, i) => i);
  const guns = idx.filter((i) => UNITS[army.companies[i].type].gun);
  const horse = idx.filter((i) => isHorse(army.companies[i].type));
  const drag = idx.filter((i) => army.companies[i].type === 'dragoon');
  const foot = idx.filter((i) => !guns.includes(i) && !horse.includes(i) && !drag.includes(i));
  // spread pikes evenly among the shot so every pike block has musketeers on its shoulders
  const pikes = foot.filter((i) => army.companies[i].type === 'pikeman');
  const shot = foot.filter((i) => army.companies[i].type !== 'pikeman');
  const line = [];
  const nP = pikes.length;
  if (nP === 0) line.push(...shot);
  else {
    const per = shot.length / nP; let s = 0;
    for (let k = 0; k < nP; k++) {
      const take = Math.round(per * (k + 1)) - Math.round(per * k);
      const half = Math.floor(take / 2);
      line.push(...shot.slice(s, s + half), pikes[k], ...shot.slice(s + half, s + take)); s += take;
    }
    line.push(...shot.slice(s));
  }
  const pos = new Array(army.companies.length);
  const taken = new Set();
  const place = (i, x, y) => {
    // nearest free passable cell inside the deployment zone
    let best = null, bd = 1e9;
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < DEPLOY_DEPTH + 1; xx++) {
      if (taken.has(xx + ',' + yy) || MOVE_COST[cells[yy][side ? W - 1 - xx : xx]][0] === Infinity) continue;
      const d = Math.abs(xx - x) * 1.2 + Math.abs(yy - y);
      if (d < bd) { bd = d; best = [xx, yy]; }
    }
    taken.add(best[0] + ',' + best[1]); pos[i] = best;
  };
  // foot: a front line of up to 12, the rest in a second line
  const front = line.slice(0, 12), second = line.slice(12);
  const row0 = (n) => Math.round(H / 2 - n / 2);
  front.forEach((i, k) => place(i, 4, row0(front.length) + k));
  second.forEach((i, k) => place(i, 2, row0(second.length) + k));
  guns.forEach((i, k) => place(i, 5, row0(guns.length * 3) + 1 + k * 3));
  // horse: alternate wings, outwards from the foot
  const fy0 = row0(front.length), fy1 = fy0 + front.length - 1;
  horse.forEach((i, k) => { const top = k % 2 === 0, j = Math.floor(k / 2); place(i, j >= 3 ? 1 : 3, top ? fy0 - 1 - (j % 3) : fy1 + 1 + (j % 3)); });
  drag.forEach((i, k) => place(i, 5, k % 2 === 0 ? 1 + Math.floor(k / 2) : H - 2 - Math.floor(k / 2)));
  return pos.map(([x, y]) => [side ? W - 1 - x : x, y]);
}

// ---------------------------------------------------------------- buying the way the era bought
// Armies were raised by the regiment and the troop, not one company at a time. A 1640s English regiment of foot
// mustered two shot to every pike; a regiment of horse was several troops; guns came as a train.
export const LOTS = {
  footReg:   { name: 'Regiment of foot (4 shot, 2 pike)', items: { musketeer: 4, pikeman: 2 } },
  swedeSq:   { name: 'Swedish squadron (4 shot, 2 pike, a gun)', items: { musketeer: 4, pikeman: 2, artillery: 1 } },
  dutchBde:  { name: 'Dutch brigade (3 pike & shot battalions)', items: { battalion: 3 } },
  terciosBlk:{ name: 'Tercio in squares (2 blocks, 2 shot sleeves)', items: { tercio: 2, musketeer: 2 } },
  swedeWing: { name: 'Swedish wing (2 horse & shot, 1 horse)', items: { horseshot: 2, harquebusier: 1 } },
  tercio:    { name: 'Tercio (3 pike, 3 shot)', items: { pikeman: 3, musketeer: 3 } },
  horseReg:  { name: 'Regiment of horse (3 troops)', items: { harquebusier: 3 } },
  cuirTroop: { name: 'Lifeguard of cuirassiers (2 troops)', items: { cuirassier: 2 } },
  dragReg:   { name: 'Regiment of dragoons (2 companies)', items: { dragoon: 2 } },
  hussarBan: { name: 'Hussar banner (2 troops)', items: { hussar: 2 } },
  train:     { name: 'Train of artillery (2 batteries)', items: { artillery: 2 } },
  county:    { name: 'County trained band (3 companies)', items: { trainedband: 3 } },
  levy:      { name: 'Hundred\'s levy (3 companies)', items: { conscript: 3 } },
  bows:      { name: 'Archers (2 companies)', items: { archer: 2 } },
};
export const LOT_IDS = Object.keys(LOTS);
export const lotCompanies = (id, personality = 'steady') => Object.entries(LOTS[id].items).flatMap(([t, n]) => Array.from({ length: n }, () => ({ type: t, personality })));

// A typical 1640s field army: about two shot to one pike among the foot, a third of the men mounted
// (horse and dragoons), and a modest train of guns.
export const STANDARD_MIX = { musketeer: 6, pikeman: 3, harquebusier: 3, dragoon: 1, artillery: 1 };
export const standardArmy = (budget, opts = {}) => ({ ...buildArmy(STANDARD_MIX, budget, opts), name: 'Standard 1640s army' });

// The same standard army with `share` of its money moved into one company type.
export function marginalArmy(type, budget, { share = 0.25, ...opts } = {}) {
  // buy the extra companies first (at least one), then spend every remaining penny on the standard mix
  let extra = buildArmy({ [type]: 1 }, budget * share, opts);
  if (!extra.companies.length) extra = buildArmy({ [type]: 1 }, budget, { ...opts, maxCompanies: 1 });
  const base = buildArmy(STANDARD_MIX, budget - armyCost(extra).total, opts);
  return { ...base, companies: [...base.companies, ...extra.companies], name: '+ ' + UNITS[type].name, added: extra.companies.length };
}
