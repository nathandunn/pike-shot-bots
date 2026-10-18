import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle, UNITS, UNIT_IDS, companyCost, armyCost, buildArmy, fromPreset, ARMY_PRESET_IDS, matchup, MAP_IDS, getMap, d2s, deploy } from '../engine/index.js';
import { expectMelee, expectFire } from '../engine/rules.js';

test('prices: kit up front, pay and food per day, rations scale food only', () => {
  const m = companyCost('musketeer', { days: 30 });
  assert.equal(m.kit, 240 * 60);
  assert.equal(m.pay, 8 * 60 * 30);
  assert.equal(m.food, 4 * 60 * 30);
  const half = companyCost('musketeer', { days: 30, rations: 'half' });
  assert.equal(half.food, m.food / 2);
  assert.equal(half.pay, m.pay);
  assert.equal(d2s(240 + 12 * 3 + 4), '£1 3s 4d');
});

test('buildArmy stays within budget and follows the mix', () => {
  for (const id of ARMY_PRESET_IDS) {
    const a = fromPreset(id, 240 * 6000);
    assert.ok(armyCost(a).total <= 240 * 6000, id);
    assert.ok(a.companies.length >= 5, id + ' too small');
  }
  const a = buildArmy({ musketeer: 2, pikeman: 1 }, 240 * 3000);
  const n = (t) => a.companies.filter((c) => c.type === t).length;
  assert.ok(Math.abs(n('musketeer') - 2 * n('pikeman')) <= 2);
});

test('maps are mirrored and deployment lands on passable, distinct cells', () => {
  for (const id of MAP_IDS) {
    const m = getMap(id);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) assert.equal(m.cells[y][x], m.cells[y][m.w - 1 - x]);
    const a = fromPreset('swedish', 240 * 9000);
    for (const side of [0, 1]) {
      const pos = deploy(a, side, m.cells);
      assert.equal(new Set(pos.map((p) => p.join())).size, pos.length, id);
    }
  }
});

test('pikes stop horse from the front but not from the flank', () => {
  const b = new Battle({ armies: [{ companies: [{ type: 'cuirassier' }] }, { companies: [{ type: 'pikeman' }, { type: 'musketeer' }] }] });
  const [c, p, m] = b.units;
  p.x = 20; p.y = 10; p.face = Math.PI; m.x = 20; m.y = 14; m.face = Math.PI;
  const front = expectMelee(b, c, 19, 10, p, true);
  assert.ok(front.braced && front.casA > front.casD, 'horse should lose to braced pikes');
  const flank = expectMelee(b, c, 20, 9, p, true);
  assert.ok(!flank.braced && flank.casD > front.casD);
  const shot = expectMelee(b, c, 19, 14, m, true);
  assert.ok(shot.casD > shot.casA * 3, 'horse should ride down unsupported shot');
});

test('fire falls off with range, armour stops arrows more than balls', () => {
  const b = new Battle({ armies: [{ companies: [{ type: 'musketeer' }, { type: 'archer' }] }, { companies: [{ type: 'cuirassier' }, { type: 'musketeer' }] }] });
  const [m, a, cu, mt] = b.units;
  cu.x = 20; cu.y = 10; mt.x = 20; mt.y = 12;
  assert.ok(expectFire(b, m, 19, 12, mt) > expectFire(b, m, 17, 12, mt));
  assert.equal(expectFire(b, m, 10, 12, mt), 0);
  const arrowRatio = expectFire(b, a, 18, 10, cu) / expectFire(b, a, 18, 12, mt);
  const ballRatio = expectFire(b, m, 18, 10, cu) / expectFire(b, m, 18, 12, mt);
  assert.ok(arrowRatio < ballRatio);
});

test('battles are deterministic per seed and always end', () => {
  const A = fromPreset('swedish', 240 * 6000), B = fromPreset('rupert', 240 * 6000);
  for (const map of MAP_IDS) {
    const r1 = new Battle({ armies: [A, B], map, seed: 3 }).run();
    const r2 = new Battle({ armies: [A, B], map, seed: 3 }).run();
    assert.equal(r1.winner, r2.winner); assert.equal(r1.turns, r2.turns);
    assert.ok(r1.turns <= 40);
    for (const u of r1.units) assert.ok(u.men >= 0 && u.men <= u.start);
  }
});

test('nobody shares a cell; recorded frames carry snapshots', () => {
  const r = new Battle({ armies: [fromPreset('polish', 240 * 6000), fromPreset('levy', 240 * 6000)], map: 'village', seed: 9, record: true }).run();
  assert.ok(r.frames.length > 10);
  for (const f of r.frames) {
    const live = f.snap.filter((s) => s.st === 'ok' || s.st === 'rout');
    assert.equal(new Set(live.map((s) => s.x + ',' + s.y)).size, live.length, 'turn ' + f.turn);
  }
});

test('matchup aggregates and swaps sides', () => {
  const r = matchup(fromPreset('tercio', 240 * 4000), fromPreset('levy', 240 * 4000), { n: 6 });
  assert.equal(r.winsA + r.winsB + r.draws, 6);
  assert.ok(r.winRateA >= 0 && r.winRateA <= 1);
});

test('every unit type can be fielded and fights', () => {
  for (const t of UNIT_IDS) {
    const r = new Battle({ armies: [{ companies: [{ type: t }, { type: t }] }, { companies: [{ type: 'musketeer' }, { type: 'pikeman' }] }], seed: 2 }).run();
    assert.ok(r.turns > 0, t);
  }
});
