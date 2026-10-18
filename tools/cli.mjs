// node tools/cli.mjs fight swedish rupert [map] [seed] [budget£]   -> logged battle
// node tools/cli.mjs vs swedish rupert [map] [n] [budget£]          -> win rate
// node tools/cli.mjs presets [map] [n] [budget£]                    -> preset army tournament
// node tools/cli.mjs units [map] [n] [budget£]                      -> single-type army tournament
import { Battle, fromPreset, matchup, tournament, presetArmies, ARMY_PRESET_IDS, unitMatrix, armyCost, d2s } from '../engine/index.js';
const [cmd, ...a] = process.argv.slice(2);
const budget = (i) => 240 * +(a[i] || 6000);
const t0 = Date.now();
if (cmd === 'fight') {
  const A = fromPreset(a[0], budget(4)), B = fromPreset(a[1], budget(4));
  console.log('A', A.name, A.companies.map((c) => c.type).join(','), d2s(armyCost(A).total));
  console.log('B', B.name, B.companies.map((c) => c.type).join(','), d2s(armyCost(B).total));
  const r = new Battle({ armies: [A, B], map: a[2] || 'open', seed: +(a[3] || 1), record: true }).run();
  for (const f of r.frames) for (const t of f.text) console.log(`[${f.turn}] ${t}`);
  console.log('winner', r.winner, r.how, 'turns', r.turns);
} else if (cmd === 'vs') {
  const r = matchup(fromPreset(a[0], budget(4)), fromPreset(a[1], budget(4)), { map: a[2] || 'open', n: +(a[3] || 50) });
  console.log(a[0], 'vs', a[1], (r.winRateA * 100).toFixed(1) + '%', 'turns', r.turns.toFixed(1), 'draws', r.draws, 'nightfall', r.nightfall);
} else if (cmd === 'presets') {
  const r = tournament(presetArmies(ARMY_PRESET_IDS, budget(2)), { maps: [a[0] || 'open'], n: +(a[1] || 6) });
  for (const x of r.rank) console.log(x.name.padEnd(20), (x.winRate * 100).toFixed(0) + '%', x.companies);
} else if (cmd === 'units') {
  const r = unitMatrix(undefined, { map: a[0] || 'open', n: +(a[1] || 6), budget: budget(2) });
  for (const x of r.rank) console.log(x.name.padEnd(22), (x.winRate * 100).toFixed(0) + '%', r.sizes[x.i]);
}
console.log('ms', Date.now() - t0);
