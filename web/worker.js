// Runs batch simulations off the main thread.
import { matchup, mergeMatchups, tournament, unitMatrix, MAP_IDS } from '../engine/index.js';

self.onmessage = (ev) => {
  const { id, type, args } = ev.data;
  const progress = (p) => self.postMessage({ id, progress: p });
  try {
    let result;
    if (type === 'matchup') {
      const { a, b, map, n, seed, weather } = args; const chunk = 10; const parts = [];
      for (let i = 0; i < n; i += chunk) { parts.push(matchup(a, b, { map, weather, n: Math.min(chunk, n - i), seed: seed + i })); progress(Math.min(1, (i + chunk) / n)); }
      result = mergeMatchups(parts);
    } else if (type === 'tournament') {
      const maps = args.maps === 'all' ? MAP_IDS : [args.maps];
      result = tournament(args.armies, { maps, n: args.n, seed: args.seed, weather: args.weather, onProgress: progress });
    } else if (type === 'units') {
      const maps = args.map === 'all' ? MAP_IDS : [args.map];
      const parts = maps.map((map, k) => unitMatrix(args.types, { ...args, map, onProgress: (p) => progress((k + p) / maps.length) }));
      // average the matrices across maps
      const r = parts[0];
      if (parts.length > 1) {
        const k = r.types.length;
        r.M = r.M.map((row, i) => row.map((v, j) => (i === j ? null : parts.reduce((s, p) => s + p.M[i][j], 0) / parts.length)));
        const avg = r.M.map((row) => row.reduce((s, v) => s + (v ?? 0), 0) / (k - 1));
        r.rank = r.names.map((name, i) => ({ name, i, winRate: avg[i] })).sort((a, b) => b.winRate - a.winRate);
        r.maps = maps;
      }
      result = r;
    }
    self.postMessage({ id, result });
  } catch (e) {
    self.postMessage({ id, error: String((e && e.stack) || e) });
  }
};
