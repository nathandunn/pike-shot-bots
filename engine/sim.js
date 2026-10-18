// Batch simulation: matchups, army tournaments, unit-value matrices. Pure functions: Node or a Web Worker.
import { Battle } from './battle.js';
import { UNIT_IDS } from './units.js';
import { fromPreset, monoArmy } from './army.js';

export function fight({ a, b, map, seed, weather = 'fair', record = false, swap = false, maxTurns = 40 }) {
  const r = new Battle({ armies: swap ? [b, a] : [a, b], map, seed, weather, record, maxTurns }).run();
  const winner = r.winner === -1 ? -1 : swap ? 1 - r.winner : r.winner;
  return { ...r, winner, swapped: swap };
}

const blankUnitStat = (side, type, personality) => ({ side, type, personality, count: 0, start: 0, lost: 0, inflicted: 0, value: 0, cost: 0, routed: 0, fled: 0, gone: 0, absent: 0, survived: 0, shots: 0, charges: 0, broke: 0, misfires: 0 });

export function matchup(a, b, { map = 'open', n = 100, seed = 1, weather = 'fair' } = {}) {
  const agg = { n, winsA: 0, winsB: 0, draws: 0, turns: 0, lostA: 0, lostB: 0, menA: 0, menB: 0, nightfall: 0, byUnit: {} };
  for (let i = 0; i < n; i++) {
    const r = fight({ a, b, map, weather, seed: seed * 7919 + i * 104729 + 1, swap: i % 2 === 1 });
    if (r.winner === 0) agg.winsA++; else if (r.winner === 1) agg.winsB++; else agg.draws++;
    if (r.how === 'nightfall') agg.nightfall++;
    agg.turns += r.turns;
    for (const u of r.units) {
      const side = (u.side === 0) !== r.swapped ? 'A' : 'B';
      agg['lost' + side] += u.start - u.men; agg['men' + side] += u.start;
      const k = side + ':' + u.type + ':' + u.personality;
      const s = agg.byUnit[k] || (agg.byUnit[k] = blankUnitStat(side, u.type, u.personality));
      s.count++; s.start += u.start; s.lost += u.start - u.men; s.inflicted += u.inflicted; s.value += u.value; s.cost += u.perMan * u.start;
      s.routed += u.routed ? 1 : 0; s[u.status === 'ok' ? 'survived' : u.status] = (s[u.status === 'ok' ? 'survived' : u.status] || 0) + 1;
      s.shots += u.shots; s.charges += u.charges; s.broke += u.broke; s.misfires += u.misfires;
    }
  }
  agg.turns /= n;
  agg.winRateA = (agg.winsA + agg.draws / 2) / n;
  return agg;
}

export function mergeMatchups(parts) {
  const out = { n: 0, winsA: 0, winsB: 0, draws: 0, turns: 0, lostA: 0, lostB: 0, menA: 0, menB: 0, nightfall: 0, byUnit: {} };
  for (const p of parts) {
    for (const k of ['winsA', 'winsB', 'draws', 'lostA', 'lostB', 'menA', 'menB', 'nightfall']) out[k] += p[k];
    out.turns += p.turns * p.n; out.n += p.n;
    for (const [k, u] of Object.entries(p.byUnit)) {
      const o = out.byUnit[k] || (out.byUnit[k] = blankUnitStat(u.side, u.type, u.personality));
      for (const f of Object.keys(o)) if (typeof o[f] === 'number') o[f] += u[f] || 0;
    }
  }
  out.turns /= out.n || 1; out.winRateA = (out.winsA + out.draws / 2) / (out.n || 1);
  return out;
}

// round robin between whole armies (each already built to budget)
export function tournament(armies, { maps = ['open'], n = 10, seed = 1, weather = 'fair', onProgress } = {}) {
  const k = armies.length;
  const wins = Array(k).fill(0), games = Array(k).fill(0);
  const M = Array.from({ length: k }, () => Array(k).fill(null));
  const total = (k * (k - 1) / 2) * maps.length; let done = 0;
  for (const map of maps) for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
    const r = matchup(armies[i], armies[j], { map, n, weather, seed: seed + i * 131 + j * 7 + map.length });
    const wa = r.winsA + r.draws / 2, wb = r.winsB + r.draws / 2;
    wins[i] += wa; wins[j] += wb; games[i] += n; games[j] += n;
    M[i][j] = (M[i][j] || 0) + wa / n / maps.length; M[j][i] = (M[j][i] || 0) + wb / n / maps.length;
    done++; onProgress && onProgress(done / total);
  }
  const rank = armies.map((a, i) => ({ name: a.name, i, winRate: wins[i] / games[i], companies: a.companies.length })).sort((p, q) => q.winRate - p.winRate);
  return { rank, M, names: armies.map((a) => a.name), maps, n };
}

export const presetArmies = (ids, budget, opts) => ids.map((id) => fromPreset(id, budget, opts));

// "what is a pound best spent on": armies of a single company type, same budget, all against all
export function unitMatrix(types = UNIT_IDS, { budget = 240 * 6000, map = 'open', n = 10, seed = 1, weather = 'fair', days = 90, rations = 'full', personality = 'steady', onProgress } = {}) {
  const armies = types.map((t) => monoArmy(t, budget, { days, rations, personality }));
  const r = tournament(armies, { maps: [map], n, seed, weather, onProgress });
  return { ...r, types, sizes: armies.map((a) => a.companies.length) };
}
