import { createReplay } from './replay.js';
import {
  Battle, UNITS, UNIT_IDS, RATIONS, companyCost, d2s, MAP_IDS, MAP_INFO, PRESETS, PRESET_IDS, TRAITS, TARGET_MODES,
  ARMY_PRESETS, ARMY_PRESET_IDS, armyCost, fromPreset, BREAK_AT,
} from '../engine/index.js';

// ------------------------------------------------------------ tiny DOM helpers
const $ = (s) => document.querySelector(s);
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
const pct = (v) => (v * 100).toFixed(0) + '%';
const L = (d) => '£' + Math.round(d / 240).toLocaleString('en-GB');
const SIDE = ['Blue', 'Red'], SIDE_COL = ['#4d72d6', '#d2493f'];

// ------------------------------------------------------------ worker
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let jobId = 0; const jobs = new Map();
worker.onmessage = (ev) => {
  const j = jobs.get(ev.data.id); if (!j) return;
  if ('progress' in ev.data) return j.onProgress && j.onProgress(ev.data.progress);
  jobs.delete(ev.data.id);
  ev.data.error ? j.reject(new Error(ev.data.error)) : j.resolve(ev.data.result);
};
const runJob = (type, args, onProgress) => new Promise((resolve, reject) => { const id = ++jobId; jobs.set(id, { resolve, reject, onProgress }); worker.postMessage({ id, type, args }); });

// ------------------------------------------------------------ captains (presets + custom, saved in this browser)
const LS = 'pikeshot.captains';
let customs = [];
try { customs = JSON.parse(localStorage.getItem(LS) || '[]'); } catch { customs = []; }
const saveCustoms = () => { try { localStorage.setItem(LS, JSON.stringify(customs)); } catch {} };
const allPers = () => [...PRESET_IDS.map((id) => ({ id, ...PRESETS[id] })), ...customs];
const persById = (id) => allPers().find((p) => p.id === id) || { id: 'steady', ...PRESETS.steady };
const persSpec = (id) => (PRESETS[id] ? id : { ...persById(id) });
function fillPers(sel, value, extra) {
  sel.innerHTML = '';
  if (extra) sel.append(el('option', { value: '' }, extra));
  for (const p of allPers()) sel.append(el('option', { value: p.id }, p.name + (PRESETS[p.id] ? '' : ' ★')));
  sel.value = value ?? (extra ? '' : 'steady');
}
function fillMaps(sel, withAll) {
  sel.innerHTML = '';
  if (withAll) sel.append(el('option', { value: 'all' }, 'All fields'));
  for (const id of MAP_IDS) sel.append(el('option', { value: id }, MAP_INFO[id].name));
}
function fillRations(sel) { sel.innerHTML = ''; for (const [id, r] of Object.entries(RATIONS)) sel.append(el('option', { value: id }, r.name)); sel.value = 'full'; }

// ------------------------------------------------------------ tabs
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('main > section').forEach((s) => (s.hidden = s.id !== b.dataset.tab));
  if (b.dataset.tab === 'prices') renderPrices();
}));

// ------------------------------------------------------------ musters
const state = [newArmy('swedish'), newArmy('rupert')];
function newArmy(preset, budget = 6000, days = 90, rations = 'full') {
  const a = fromPreset(preset, budget * 240, { days, rations });
  return { preset, budget, days, rations, companies: a.companies.map((c) => ({ ...c })) };
}
const engineArmy = (s) => ({ name: s.preset !== 'custom' ? ARMY_PRESETS[s.preset].name : SIDE[state.indexOf(s)] + ' army', days: s.days, rations: s.rations, companies: s.companies.map((c) => ({ type: c.type, personality: persSpec(c.personality) })) });

function renderArmy(side) {
  const s = state[side], box = $(side ? '#armyB' : '#armyA');
  box.innerHTML = '';
  const presetSel = el('select', { onchange: (e) => { const v = e.target.value; if (v !== 'custom') { Object.assign(s, newArmy(v, s.budget, s.days, s.rations)); } else s.preset = 'custom'; renderArmy(side); } },
    ARMY_PRESET_IDS.map((id) => el('option', { value: id }, ARMY_PRESETS[id].name)), el('option', { value: 'custom' }, 'Custom'));
  presetSel.value = s.preset;
  box.append(el('h3', {}, SIDE[side] + ' army', presetSel));
  if (s.preset !== 'custom') box.append(el('div', { class: 'muted' }, ARMY_PRESETS[s.preset].blurb));
  const num = (key, step, min) => el('input', { type: 'number', value: s[key], step, min, onchange: (e) => { s[key] = Math.max(min, +e.target.value || min); if (s.preset !== 'custom' && key === 'budget') Object.assign(s, newArmy(s.preset, s.budget, s.days, s.rations)); renderArmy(side); } });
  const rat = el('select', { onchange: (e) => { s.rations = e.target.value; renderArmy(side); } }); fillRations(rat); rat.value = s.rations;
  box.append(el('div', { class: 'settings' },
    el('label', {}, 'Budget £', num('budget', 500, 100)),
    el('label', {}, 'Days in field', num('days', 10, 1)),
    el('label', {}, 'Rations', rat)));

  // ledger
  const c = armyCost({ companies: s.companies, days: s.days, rations: s.rations });
  const over = c.total > s.budget * 240;
  const tot = Math.max(c.total, s.budget * 240);
  box.append(el('div', { class: 'ledger' },
    el('div', {}, 'Kit', el('b', {}, L(c.kit))),
    el('div', {}, 'Wages', el('b', {}, L(c.pay))),
    el('div', {}, 'Food & fodder', el('b', {}, L(c.food))),
    el('div', { class: over ? 'over' : '' }, over ? 'Over budget!' : 'Left', el('b', {}, over ? '−' + L(c.total - s.budget * 240) : L(s.budget * 240 - c.total)))));
  box.append(el('div', { class: 'budgetbar', title: 'kit / wages / food against the budget' },
    el('i', { class: 'k', style: `width:${c.kit / tot * 100}%` }), el('i', { class: 'p', style: `width:${c.pay / tot * 100}%` }), el('i', { class: 'f', style: `width:${c.food / tot * 100}%` })));
  box.append(el('div', { class: 'keyrow' }, el('span', { style: '--c:#8a8f99' }, 'kit'), el('span', { style: '--c:#c99a3e' }, 'wages'), el('span', { style: '--c:#7fa35a' }, 'food'),
    el('span', { style: '--c:transparent' }, `${c.men.toLocaleString()} men · ${c.horses.toLocaleString()} horses · ${s.companies.length} companies`)));

  // companies
  const list = el('div');
  s.companies.forEach((co, i) => {
    const ts = el('select', { onchange: (e) => { co.type = e.target.value; s.preset = 'custom'; renderArmy(side); } }, UNIT_IDS.map((t) => el('option', { value: t }, UNITS[t].name)));
    ts.value = co.type;
    const ps = el('select', { class: 'persSel', onchange: (e) => { co.personality = e.target.value; } }); fillPers(ps, co.personality);
    const cc = companyCost(co.type, s);
    list.append(el('div', { class: 'co' }, ts, ps, el('span', { class: 'price', title: `kit ${d2s(cc.kit)}, wages ${d2s(cc.pay)}, food ${d2s(cc.food)}` }, `${UNITS[co.type].men} men · ${L(cc.total)}`),
      el('button', { title: 'Disband', onclick: () => { s.companies.splice(i, 1); s.preset = 'custom'; renderArmy(side); } }, '×')));
  });
  box.append(list);
  const addSel = el('select', {}, UNIT_IDS.map((t) => el('option', { value: t }, `${UNITS[t].name} (${L(companyCost(t, s).total)})`)));
  const allSel = el('select', { onchange: (e) => { if (e.target.value) { for (const co of s.companies) co.personality = e.target.value; renderArmy(side); } } }); fillPers(allSel, '', 'All captains…');
  box.append(el('div', { class: 'row' }, el('button', { onclick: () => { s.companies.push({ type: addSel.value, personality: 'steady' }); s.preset = 'custom'; renderArmy(side); } }, '+ Raise'), addSel, allSel));
}

// ------------------------------------------------------------ battle
fillMaps($('#mapSel'));
const blurb = () => ($('#mapBlurb').textContent = MAP_INFO[$('#mapSel').value].blurb);
$('#mapSel').onchange = blurb; blurb();
$('#swapBtn').onclick = () => { state.reverse(); renderArmy(0); renderArmy(1); };

const replay = createReplay({ canvas: $('#board'), play: $('#pPlay'), step: $('#pStep'), scrub: $('#pScrub'), speed: $('#pSpeed'), zoom: $('#pZoom'), onFrame: (i, f) => showLog(i, f), onEnd: () => showFightStats() });
let lastFight = null;

function checkArmies() {
  for (const s of state) if (!s.companies.length) { alert(`${SIDE[state.indexOf(s)]} army has no companies.`); return false; }
  return true;
}
$('#fightBtn').onclick = () => {
  if (!checkArmies()) return;
  const r = new Battle({ armies: state.map(engineArmy), map: $('#mapSel').value, weather: $('#weather').value, seed: +$('#seed').value || 1, record: true }).run();
  lastFight = r;
  $('#replayCard').hidden = false; $('#fightStats').innerHTML = '';
  replay.load(r);
  $('#replayCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#seed').value = (+$('#seed').value || 1) + 1;
};

function showLog(i, f) {
  const R = lastFight; if (!R) return;
  $('#pTurn').textContent = f.turn ? `Turn ${f.turn} of 40` : 'Deployment';
  const box = $('#log'); box.innerHTML = '';
  const from = Math.max(0, i - 14);
  for (let j = from; j <= i; j++) for (const t of R.frames[j].text) box.append(el('div', { class: j === i ? 'cur' : 'old' }, (R.frames[j].turn ? `[${R.frames[j].turn}] ` : '') + t));
  box.scrollTop = box.scrollHeight;
  if (i === R.frames.length - 1) showFightStats();
}

function showFightStats() {
  const R = lastFight; if (!R) return;
  const out = $('#fightStats'); out.innerHTML = '';
  const how = { broke: 'broke the enemy army', mutual: 'was the last to break', nightfall: 'held more of the field at nightfall' }[R.how];
  out.append(el('h3', {}, R.winner < 0 ? 'A drawn day: both armies spent at nightfall.' : `${SIDE[R.winner]} ${how} after ${R.turns} turns.`));
  const t = el('table');
  t.append(el('tr', {}, ['Company', 'Captain', 'Men', 'Lost', 'Inflicted', 'Shots', 'Charges', 'Broke', 'Fate'].map((h, i) => el('th', { class: i > 1 ? 'num' : '' }, h))));
  const fate = { ok: 'held', rout: 'running', fled: 'fled', gone: 'destroyed', absent: 'rode off' };
  for (const u of R.units) t.append(el('tr', {},
    el('td', { class: u.side ? 'r' : 'b' }, u.label), el('td', {}, persById(u.personality).name || u.personality),
    ...[u.start, u.start - u.men, u.inflicted, u.shots, u.charges, u.broke].map((v) => el('td', { class: 'num' }, v)), el('td', {}, fate[u.status])));
  out.append(el('div', { class: 'table-wrap' }, t));
  const sum = (s, f) => R.units.filter((u) => u.side === s).reduce((a, u) => a + f(u), 0);
  out.append(el('p', { class: 'note' }, [0, 1].map((s) => `${SIDE[s]}: lost ${sum(s, (u) => u.start - u.men)} of ${sum(s, (u) => u.start)} men, inflicted ${sum(s, (u) => u.inflicted)} (${L(sum(s, (u) => u.value))} of enemy soldiery).`).join(' ')));
}

$('#simBtn').onclick = async () => {
  if (!checkArmies()) return;
  const card = $('#simCard'); card.hidden = false;
  card.innerHTML = ''; const prog = el('i'); card.append(el('h3', {}, 'Simulating 100 battles…'), el('div', { class: 'progress' }, prog));
  const [a, b] = state.map(engineArmy);
  const r = await runJob('matchup', { a, b, map: $('#mapSel').value, weather: $('#weather').value, n: 100, seed: +$('#seed').value || 1 }, (p) => (prog.style.width = pct(p)));
  renderSim(card, r, a, b);
};

function renderSim(card, r, a, b) {
  card.innerHTML = '';
  card.append(el('h3', {}, `${a.name} vs ${b.name} · ${MAP_INFO[$('#mapSel').value].name}, ${$('#weather').value}`));
  const wa = r.winsA / r.n, wb = r.winsB / r.n, dr = r.draws / r.n;
  card.append(el('div', { class: 'winbar' },
    el('div', { style: `width:${wa * 100}%;background:${SIDE_COL[0]}` }, wa > 0.08 ? 'Blue ' + pct(wa) : ''),
    el('div', { style: `width:${dr * 100}%;background:#6b6455` }, dr > 0.08 ? 'draw ' + pct(dr) : ''),
    el('div', { style: `width:${wb * 100}%;background:${SIDE_COL[1]}` }, wb > 0.08 ? 'Red ' + pct(wb) : '')));
  card.append(el('p', { class: 'note' }, `Average ${r.turns.toFixed(1)} turns; ${pct(r.nightfall / r.n)} went to nightfall. Blue lost ${pct(r.lostA / r.menA)} of its men, Red ${pct(r.lostB / r.menB)}. An army breaks when fewer than ${pct(BREAK_AT)} of its men stand formed.`));
  const t = el('table');
  t.append(el('tr', {}, ['Side', 'Company type', 'Captain', 'Per battle', 'Lost %', 'Inflicted', 'Inflicted per £100', 'Enemy £ killed per £', 'Ran', 'Rode off'].map((h, i) => el('th', { class: i > 2 ? 'num' : '' }, h))));
  const rows = Object.values(r.byUnit).sort((x, y) => (x.side > y.side ? 1 : -1) || y.inflicted - x.inflicted);
  for (const u of rows) {
    const per = u.count / r.n;
    t.append(el('tr', {},
      el('td', { class: u.side === 'A' ? 'b' : 'r' }, u.side === 'A' ? 'Blue' : 'Red'), el('td', {}, UNITS[u.type].name), el('td', {}, persById(u.personality).name || u.personality),
      el('td', { class: 'num' }, per.toFixed(0)), el('td', { class: 'num' }, pct(u.lost / u.start)), el('td', { class: 'num' }, (u.inflicted / r.n).toFixed(1)),
      el('td', { class: 'num' }, (u.inflicted / (u.cost / 240 / 100)).toFixed(2)), el('td', { class: 'num' }, (u.value / u.cost).toFixed(2)),
      el('td', { class: 'num' }, pct(u.routed / u.count)), el('td', { class: 'num' }, pct((u.absent || 0) / u.count))));
  }
  card.append(el('div', { class: 'table-wrap' }, t));
  card.append(el('p', { class: 'muted' }, '"Enemy £ killed per £" is the value of the soldiers a company type disabled (kit, wages and food) divided by what that company type cost. Above 1 means it paid for itself.'));
}

// ------------------------------------------------------------ heat table helper
function heat(names, M, label = 'row vs column') {
  const t = el('table', { class: 'heat' });
  t.append(el('tr', {}, el('th', { class: 'rowh' }, label), names.map((n) => el('th', { title: n }, n.split(' ').map((w) => w[0]).join('').slice(0, 3)))));
  names.forEach((n, i) => t.append(el('tr', {}, el('th', { class: 'rowh' }, n), M[i].map((v, j) => {
    if (i === j || v == null) return el('td', { style: 'background:#2b271e' }, '–');
    const h = v * 120;
    return el('td', { style: `background:hsl(${h},45%,${28 + Math.abs(v - 0.5) * 20}%)` }, Math.round(v * 100));
  }))));
  return el('div', { class: 'table-wrap' }, t);
}
function rankTable(rows, cols) {
  const t = el('table');
  t.append(el('tr', {}, cols.map((c, i) => el('th', { class: i ? 'num' : '' }, c[0]))));
  for (const r of rows) t.append(el('tr', {}, cols.map((c, i) => el('td', { class: i ? 'num' : '' }, c[1](r)))));
  return el('div', { class: 'table-wrap' }, t);
}

// ------------------------------------------------------------ army lab
fillMaps($('#labMap'), true); fillRations($('#labRations'));
$('#labPresets').append(...ARMY_PRESET_IDS.map((id) => el('label', { title: ARMY_PRESETS[id].blurb }, el('input', { type: 'checkbox', value: id, checked: true }), ARMY_PRESETS[id].name)));
$('#labRun').onclick = async () => {
  const ids = [...document.querySelectorAll('#labPresets input:checked')].map((x) => x.value);
  if (ids.length < 2) return alert('Pick at least two armies.');
  const budget = +$('#labBudget').value * 240, opts = { days: +$('#labDays').value, rations: $('#labRations').value };
  const armies = ids.map((id) => fromPreset(id, budget, opts));
  $('#labRun').disabled = true;
  try {
    const r = await runJob('tournament', { armies, maps: $('#labMap').value, n: +$('#labN').value, seed: 11 }, (p) => ($('#labProg').style.width = pct(p)));
    const out = $('#labOut'); out.innerHTML = '';
    out.append(el('div', { class: 'card' }, el('h3', {}, 'Ranking'), rankTable(r.rank, [
      ['Army', (x) => x.name], ['Win rate', (x) => pct(x.winRate)], ['Companies', (x) => x.companies],
      ['Men', (x) => armyCost(armies[x.i]).men.toLocaleString()], ['Horses', (x) => armyCost(armies[x.i]).horses], ['Food share', (x) => pct(armyCost(armies[x.i]).food / armyCost(armies[x.i]).total)],
    ]), el('h3', {}, 'Head to head (row army\'s win %)'), heat(r.names, r.M, 'army')));
  } finally { $('#labRun').disabled = false; }
};

// ------------------------------------------------------------ unit value
fillMaps($('#uvMap'), true); fillRations($('#uvRations'));
$('#uvRun').onclick = async () => {
  $('#uvRun').disabled = true;
  try {
    const args = { types: UNIT_IDS, budget: +$('#uvBudget').value * 240, days: +$('#uvDays').value, rations: $('#uvRations').value, map: $('#uvMap').value, n: +$('#uvN').value, personality: persSpec($('#uvPers').value), seed: 5 };
    const r = await runJob('units', args, (p) => ($('#uvProg').style.width = pct(p)));
    const out = $('#uvOut'); out.innerHTML = '';
    out.append(el('div', { class: 'card' }, el('h3', {}, 'What the money buys'), rankTable(r.rank, [
      ['Company type', (x) => x.name], ['Win rate', (x) => pct(x.winRate)], ['Companies bought', (x) => r.sizes[x.i]],
      ['Men', (x) => (r.sizes[x.i] * UNITS[r.types[x.i]].men).toLocaleString()], ['Cost per company', (x) => L(companyCost(r.types[x.i], args).total)],
    ]), el('h3', {}, 'Head to head (row type\'s win %)'), heat(r.names, r.M, 'type')));
  } finally { $('#uvRun').disabled = false; }
};

// ------------------------------------------------------------ captains
const cdArmy = $('#cdArmy'); cdArmy.append(...ARMY_PRESET_IDS.map((id) => el('option', { value: id }, ARMY_PRESETS[id].name)));
fillMaps($('#cdMap'), true);
$('#cdRun').onclick = async () => {
  const base = fromPreset(cdArmy.value, 6000 * 240);
  const armies = allPers().map((p) => ({ name: p.name, days: base.days, rations: base.rations, companies: base.companies.map((c) => ({ type: c.type, personality: persSpec(p.id) })) }));
  $('#cdRun').disabled = true;
  try {
    const r = await runJob('tournament', { armies, maps: $('#cdMap').value, n: +$('#cdN').value, seed: 21 }, (p) => ($('#cdProg').style.width = pct(p)));
    const out = $('#cdOut'); out.innerHTML = '';
    out.append(rankTable(r.rank, [['Captain', (x) => x.name], ['Win rate', (x) => pct(x.winRate)], ['Style', (x) => persById(allPers()[x.i].id).blurb || '']]), el('h3', {}, 'Head to head'), heat(r.names, r.M, 'captain'));
  } finally { $('#cdRun').disabled = false; }
};

// editor
const edState = { ...PRESETS.steady };
function renderEditor() {
  const box = $('#edSliders'); box.innerHTML = '';
  for (const [k, desc] of Object.entries(TRAITS)) {
    const val = el('span', {}, (+edState[k]).toFixed(2));
    box.append(el('label', { title: desc }, k, el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: edState[k], oninput: (e) => { edState[k] = +e.target.value; val.textContent = edState[k].toFixed(2); } }), val));
    box.append(el('div', { class: 'muted', style: 'margin:-4px 0 6px' }, desc));
  }
  const ts = $('#edTarget'); ts.innerHTML = '';
  for (const [k, d] of Object.entries(TARGET_MODES)) ts.append(el('option', { value: k }, `${k}: ${d}`));
  ts.value = edState.target; ts.onchange = (e) => (edState.target = e.target.value);
}
$('#edBase').onchange = (e) => { const p = persById(e.target.value); Object.assign(edState, p); $('#edName').value = PRESETS[p.id] ? '' : p.name; renderEditor(); };
$('#edSave').onclick = () => {
  const name = $('#edName').value.trim(); if (!name) return alert('Name your captain.');
  const id = 'c_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const p = { id, name, blurb: 'Custom captain.', target: edState.target };
  for (const k of Object.keys(TRAITS)) p[k] = edState[k];
  customs = customs.filter((c) => c.id !== id); customs.push(p); saveCustoms(); refreshPersMenus(id);
};
$('#edDel').onclick = () => { const id = $('#edBase').value; if (PRESETS[id]) return alert('Presets cannot be deleted.'); customs = customs.filter((c) => c.id !== id); saveCustoms(); refreshPersMenus('steady'); };
function refreshPersMenus(sel) {
  fillPers($('#edBase'), sel || 'steady'); fillPers($('#uvPers'), $('#uvPers').value || 'steady');
  renderArmy(0); renderArmy(1);
}

// ------------------------------------------------------------ price list
function renderPrices() {
  const box = $('#pricesOut'); if (box.childElementCount) return;
  const days = 90;
  const t = el('table');
  t.append(el('tr', {}, ['Company', 'Men', 'Kit per man', 'Wages per day', 'Food per day', `Company, ${days} days`, 'Move', 'Range', 'Morale'].map((h, i) => el('th', { class: i ? 'num' : '' }, h))));
  for (const id of UNIT_IDS) {
    const U = UNITS[id], c = companyCost(id, { days });
    t.append(el('tr', {}, el('td', {}, U.name), ...[U.men, d2s(U.kit), d2s(U.pay), d2s(U.food), L(c.total), U.move, U.range || '–', U.morale].map((v) => el('td', { class: 'num' }, v))));
  }
  box.append(el('div', { class: 'card' }, el('h3', {}, 'Companies'), el('div', { class: 'table-wrap' }, t),
    el('p', { class: 'muted' }, 'Food per day includes hay and oats for any horses: a horseman eats 4d, his horse another 6d. Guns need sixteen draught horses for a pair of sakers, counted against the gunners.')));
  box.append(el('div', { class: 'card' }, el('h3', {}, 'What each one is'), el('div', { class: 'grid2' }, UNIT_IDS.map((id) => el('div', { class: 'sheet card' },
    el('h4', {}, UNITS[id].name), el('div', { class: 'muted' }, UNITS[id].kitNote), el('div', { class: 'note' }, UNITS[id].note))))));
  const rt = el('table');
  rt.append(el('tr', {}, el('th', {}, 'Rations'), el('th', { class: 'num' }, 'Food cost'), el('th', { class: 'num' }, 'Morale'), el('th', {}, '')));
  for (const r of Object.values(RATIONS)) rt.append(el('tr', {}, el('td', {}, r.name), el('td', { class: 'num' }, '×' + r.mult), el('td', { class: 'num' }, (r.morale > 0 ? '+' : '') + r.morale), el('td', { style: 'text-align:left;white-space:normal' }, r.note)));
  box.append(el('div', { class: 'card' }, el('h3', {}, 'Rations'), el('div', { class: 'table-wrap' }, rt)));
  box.append(el('div', { class: 'card' }, el('h3', {}, 'Where did the archers and knights go?'), el('div', { class: 'hist', html: `
    <p><b>Bows.</b> England's Privy Council ordered the trained bands to swap bows for muskets in 1595. The longbow shot faster and further, but an archer needed a lifetime of practice and a musketeer a few weeks, and a ball went through a corslet that an arrow glanced off. Here archers outrange musketeers, carry only two sheaves, and pay for their skill in wages.</p>
    <p><b>Knights.</b> The man in plate on a great horse became the <i>cuirassier</i>, armoured to the knee and carrying pistols instead of a lance. He was so dear that by the 1640s most horse were lighter <i>harquebusiers</i> in buff coats. The exception was Poland: its <i>winged hussars</i> charged with five-metre lances all century and broke Swedish and Muscovite armies many times their size.</p>
    <p><b>Pike and shot.</b> Musketeers could not stand against horse in the open, so pikemen stood among them. The pikes kept the horse off, and the shot did the killing. Horse charging a formed pike block from the front stall at the points; from the flank, they ride over it.</p>
    <p><b>Food.</b> Armies moved on their stomachs and on their horses' stomachs. A troop of horse eats two and a half times what the same number of foot eat, every day. Half rations save money but sour the men, and starving horses are slow.</p>` })));
  box.append(el('div', { class: 'card' }, el('h3', {}, 'How a battle runs'), el('div', { class: 'note', html: `
    <p>Each turn every company acts once, the two sides alternating, with companies already in contact going first. A company can move, fire, charge, fight, rally or stand. Shot can fire after moving one cell (archers two, horse any distance), guns not at all, and guns need a turn to reload. Ammunition is limited: twelve volleys for musketeers, eight flights for archers.</p>
    <p>Fire falls off with range and is cut by cover (woods, villages, hedges) and by armour, more so for arrows. Rain makes matchlocks misfire more than half the time; firelocks far less. Shot charged from the front get one closing volley. Melee is fought by the front ranks, with charge, flank (×1.4) and rear (×1.8) bonuses. Formed pikes multiply their strength against horse to their front.</p>
    <p>Casualties and the shock of fire wear morale down. Below 40 a company is <i>shaken</i> and fights at 70%. Below 20 it runs, and panic spreads to its neighbours. Routing companies may rally if no enemy is close. An army whose formed men fall below 30% of its strength has lost; at nightfall (turn 40) the side holding more of its value wins. Levies fight harder on home ground, their own half of the field.</p>` })));
}

// ------------------------------------------------------------ boot
fillPers($('#edBase'), 'steady'); fillPers($('#uvPers'), 'steady'); renderEditor();
renderArmy(0); renderArmy(1);
