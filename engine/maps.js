// Battlefields. 36×24 cells, one cell ≈ 30 m, so the field is about a kilometre wide.
// Every map is mirrored left-right so neither side gets the better ground.
export const W = 36, H = 24;
export const T = { OPEN: 0, HILL: 1, WOODS: 2, VILLAGE: 3, RIVER: 4, FORD: 5, MARSH: 6, HEDGE: 7 };
export const T_NAME = ['open', 'hill', 'woods', 'village', 'river', 'ford', 'marsh', 'hedge'];

// movement cost [foot, mounted], disorder on entry [foot, mounted]
export const MOVE_COST = { 0: [1, 1], 1: [1.5, 1.5], 2: [2, 3], 3: [2, 3], 4: [Infinity, Infinity], 5: [3, 3], 6: [3, 4], 7: [2, 3] };
export const DISORDERS = { 0: [0, 0], 1: [0, 0], 2: [0, 1], 3: [0, 1], 4: [0, 0], 5: [1, 1], 6: [1, 1], 7: [0, 1] };
// fraction of missile casualties that still land on a company standing in this cell
export const COVER = { 0: 1, 1: 1, 2: 0.5, 3: 0.45, 4: 1, 5: 1.1, 6: 1, 7: 0.6 };
// defender's melee multiplier for standing in this cell
export const DEF_MELEE = { 0: 1, 1: 1.15, 2: 1.3, 3: 1.4, 4: 1, 5: 0.8, 6: 0.85, 7: 1.25 };

function blank() { return Array.from({ length: H }, () => new Array(W).fill(T.OPEN)); }
function mirror(g) { for (let y = 0; y < H; y++) for (let x = 0; x < W / 2; x++) g[y][W - 1 - x] = g[y][x]; return g; }
function blob(g, cx, cy, rx, ry, t) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W / 2; x++) {
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (d <= 1) g[y][x] = t;
  }
}
function rect(g, x0, y0, x1, y1, t) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x < W / 2) g[y][x] = t; }

const BUILD = {
  open() { const g = blank(); blob(g, 9, 3, 2, 1.3, T.WOODS); return mirror(g); },
  hills() {
    const g = blank();
    blob(g, 7, 12, 3.5, 4.5, T.HILL);
    blob(g, 14, 4, 3, 2.2, T.HILL);
    blob(g, 13, 20, 2.5, 2, T.WOODS);
    return mirror(g);
  },
  river() {
    const g = blank();
    for (let y = 0; y < H; y++) { g[y][17] = T.RIVER; }
    for (const y of [4, 11, 12, 19]) g[y][17] = T.FORD;
    blob(g, 14, 2, 2.5, 1.5, T.MARSH); blob(g, 14, 21, 2.5, 1.5, T.MARSH);
    blob(g, 8, 12, 2.5, 3, T.HILL);
    return mirror(g);
  },
  hedges() {
    const g = blank();
    for (const [x, y0, y1] of [[9, 2, 8], [9, 15, 21], [14, 6, 11], [14, 13, 18]]) for (let y = y0; y <= y1; y++) g[y][x] = T.HEDGE;
    for (const [y, x0, x1] of [[2, 4, 9], [21, 4, 9], [11, 10, 14], [12, 10, 14]]) for (let x = x0; x <= x1; x++) g[y][x] = T.HEDGE;
    rect(g, 3, 11, 4, 12, T.VILLAGE);
    return mirror(g);
  },
  woods() {
    const g = blank();
    blob(g, 10, 2, 5, 3.5, T.WOODS); blob(g, 10, 21, 5, 3.5, T.WOODS);
    blob(g, 16, 12, 1.6, 1.6, T.WOODS);
    blob(g, 5, 12, 2, 2.5, T.HILL);
    return mirror(g);
  },
  village() {
    const g = blank();
    rect(g, 15, 9, 17, 14, T.VILLAGE);
    for (let x = 12; x <= 17; x++) { g[8][x] = T.HEDGE; g[15][x] = T.HEDGE; }
    g[8][14] = T.OPEN; g[15][14] = T.OPEN;
    blob(g, 6, 5, 3, 2.5, T.HILL); blob(g, 6, 18, 3, 2.5, T.HILL);
    blob(g, 12, 22, 3, 1.5, T.MARSH);
    return mirror(g);
  },
};

export const MAP_INFO = {
  open:    { name: 'Open Field', blurb: 'Rolling grass with two copses on the flanks. Cavalry country.' },
  hills:   { name: 'Rolling Hills', blurb: 'A long ridge on each side and two forward knolls. Shot on high ground sees further.' },
  river:   { name: 'River Ford', blurb: 'A river down the middle crossed at four fords. Crossing disorders everyone.' },
  hedges:  { name: 'Hedgerows', blurb: 'Enclosed fields. Hedges give the shot cover and break up a cavalry charge.' },
  woods:   { name: 'Woods Edge', blurb: 'Great woods on both flanks squeeze the battle into a central gap.' },
  village: { name: 'Village', blurb: 'A hedged village sits astride the middle. Whoever holds it is hard to shift.' },
};
export const MAP_IDS = Object.keys(MAP_INFO);

const cache = {};
export function getMap(id) {
  if (!BUILD[id]) throw new Error('unknown map ' + id);
  return cache[id] || (cache[id] = { id, w: W, h: H, cells: BUILD[id](), ...MAP_INFO[id] });
}
