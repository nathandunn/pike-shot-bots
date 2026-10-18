// Company types. Money is in pence (12d = 1s, 20s = £1 = 240d).
// kit   = one-off cost per man (weapons, armour, horse)
// pay   = wages per man per day
// food  = rations per man per day, including fodder for any horses
// Prices are rounded from English Civil War (1640s) Ordnance Office and army accounts;
// continental prices ran in the same range.
//
// Combat fields:
//   men      company strength
//   move     cells per activation (one cell is ~30 m)
//   range    max fire range in cells (0 = no missile weapon)
//   fire     chance a man's fire disables an enemy at point blank, per activation
//   moveFire max cells a company can move and still fire this activation
//   melee    hand-to-hand power per man in the front
//   charge   multiplier on the activation it charges home
//   armour   0..1, cuts casualties
//   pen      how well its missiles go through armour (arrows 0.1, musket balls 0.6, roundshot 1)
//   antiCav  multiplier on melee against mounted men attacking its front
//   morale   starting morale 0..100
//   frontage men who can fight hand to hand at once
//   wet      chance in rain that the company's fire fails this activation
//   ammo     volleys carried into battle (a bandolier holds 12 charges; a sheaf is 24 arrows, a few minutes' shooting)
export const UNITS = {
  musketeer: {
    name: 'Musketeers', short: 'Musk', glyph: 'musket', men: 60,
    kit: 240, pay: 8, food: 4,
    kitNote: 'Matchlock musket 15s 6d, rest and bandolier 2s, sword 4s',
    ammo: 12, move: 3, range: 4, fire: 0.07, pen: 0.6, moveFire: 1, melee: 0.5, charge: 1.1, armour: 0, antiCav: 0.6, morale: 60, frontage: 30, wet: 0.6,
    note: 'About two thirds of every 1640s foot regiment. Deadly at 100 m, helpless against horse in the open unless pikes stand close.',
  },
  firelock: {
    name: 'Firelocks', short: 'Fire', glyph: 'musket', men: 60,
    kit: 300, pay: 8, food: 4,
    kitNote: 'Snaphance musket ~£1, bandolier 2s, sword 4s',
    ammo: 12, move: 3, range: 4, fire: 0.075, pen: 0.6, moveFire: 1, melee: 0.5, charge: 1.1, armour: 0, antiCav: 0.6, morale: 62, frontage: 30, wet: 0.25,
    note: 'Flintlock (snaphance) men: dearer guns but no glowing match, so far fewer misfires in rain. Guarded the powder train.',
  },
  pikeman: {
    name: 'Pikemen', short: 'Pike', glyph: 'pike', men: 60,
    kit: 360, pay: 8, food: 4,
    kitNote: '16–18 ft pike 4s, corslet with tassets and pot ~£1 2s, sword 4s',
    ammo: 0, move: 2, range: 0, fire: 0, moveFire: 0, melee: 1.3, charge: 1.3, armour: 0.25, antiCav: 3.2, morale: 70, frontage: 30, wet: 0,
    note: 'The hedge of points that keeps the horse off the musketeers. Slow, and a sitting target for shot, but nothing mounted breaks a formed pike block from the front.',
  },
  archer: {
    name: 'Archers', short: 'Bow', glyph: 'bow', men: 60,
    kit: 160, pay: 12, food: 4,
    kitNote: 'Yew bow 6s 8d, two sheaves of arrows 4s, sword 3s. Pay 12d: a trained archer was a scarce, skilled man',
    ammo: 8, move: 3, range: 5, fire: 0.032, pen: 0.05, moveFire: 2, melee: 0.5, charge: 1.1, armour: 0, antiCav: 0.5, morale: 52, frontage: 30, wet: 0.35,
    note: 'Officially replaced by the musket in England in 1595: a musketeer could be trained in weeks, an archer took a lifetime. Faster shooting and longer reach, but arrows bounce off a corslet.',
  },
  trainedband: {
    name: 'Trained bands', short: 'TB', glyph: 'mixed', men: 60,
    kit: 280, pay: 8, food: 4,
    kitNote: 'County store: two muskets to every pike, a few old corslets',
    ammo: 10, move: 3, range: 4, fire: 0.042, pen: 0.6, moveFire: 1, melee: 0.8, charge: 1.1, armour: 0.1, antiCav: 1.6, morale: 48, frontage: 30, wet: 0.6,
    note: 'Part-time county militia, drilled a few days a year. Mixed shot and pike in one company, so it can half look after itself. Famous for going home.',
  },
  battalion: {
    name: 'Pike & shot battalion', short: 'Batt', glyph: 'battalion', men: 60, mix: { musketeer: 40, pikeman: 20 },
    kit: 280, pay: 8, food: 4,
    kitNote: '40 musketeers and 20 pikemen in one body: kit averaged per man',
    ammo: 12, move: 3, range: 4, fire: 0.047, pen: 0.6, moveFire: 1, melee: 0.95, charge: 1.15, armour: 0.08, antiCav: 2.2, morale: 63, frontage: 30, wet: 0.6,
    note: 'The Dutch and Swedish answer: shot and pike drilled as one small body, the pikes in the centre, the musketeers on the sleeves. Fires with two thirds of its men, braces against horse with the rest. Less firepower than pure shot, much harder to ride down.',
  },
  tercio: {
    name: 'Tercio block', short: 'Terc', glyph: 'tercio', men: 100, mix: { pikeman: 50, musketeer: 50 },
    kit: 300, pay: 9, food: 4,
    kitNote: 'Half pike, half shot, veterans on 9d: kit averaged per man',
    ammo: 12, move: 2, range: 4, fire: 0.035, pen: 0.6, moveFire: 1, melee: 1.15, charge: 1.2, armour: 0.13, antiCav: 2.6, morale: 72, frontage: 40, wet: 0.6,
    note: 'Spain\'s deep square: a hundred men, a pike core with shot at the corners. Slow and a fat target for guns, but a hedgehog that horse cannot break and few foot can push.',
  },
  horseshot: {
    name: 'Horse with commanded shot', short: 'H+S', glyph: 'horseshot', men: 50, mix: { harquebusier: 30, musketeer: 20 },
    kit: 2064, pay: 18, food: 8,
    kitNote: '30 troopers and 20 musketeers detached to run with them: kit averaged per man',
    ammo: 10, move: 4, range: 4, fire: 0.03, pen: 0.55, moveFire: 1, melee: 1.1, charge: 1.4, armour: 0.18, antiCav: 1.1, morale: 66, frontage: 30, wet: 0.5,
    mounted: true,
    note: 'Gustavus Adolphus\'s trick at Breitenfeld (1631): small platoons of musketeers posted among the squadrons of horse, firing a volley to break up the enemy\'s charge before the troopers counter-charge. Slowed to the pace of the foot.',
  },
  conscript: {
    name: 'Farmer conscripts', short: 'Levy', glyph: 'levy', men: 100,
    kit: 24, pay: 4, food: 4,
    kitNote: 'Own bills, flails, pitchforks and straightened scythes; a coat if lucky',
    ammo: 4, move: 3, range: 2, fire: 0.008, pen: 0.3, moveFire: 1, melee: 0.6, charge: 1.15, armour: 0, antiCav: 0.5, morale: 32, frontage: 40, wet: 0.7,
    home: true,
    note: 'Pressed men and peasant levies: almost free to arm, but they still eat. Brittle in the open, stubborn on home ground (own half of the field), dreadful against horse.',
  },
  dragoon: {
    name: 'Dragoons', short: 'Drag', glyph: 'dragoon', men: 40,
    kit: 1320, pay: 18, food: 8,
    kitNote: 'Nag £4, musket 16s, saddle 10s, sword 4s',
    ammo: 10, move: 6, range: 4, fire: 0.06, pen: 0.6, moveFire: 3, melee: 0.6, charge: 1.0, armour: 0, antiCav: 0.6, morale: 52, frontage: 30, wet: 0.45,
    rides: true,
    note: 'Mounted infantry: ride to a hedge or village, dismount, shoot. Fight on foot, so pikes treat them as foot and horse ride them down.',
  },
  harquebusier: {
    name: 'Harquebusiers', short: 'Harq', glyph: 'horse', men: 40,
    kit: 3280, pay: 24, food: 10,
    kitNote: 'Horse £6, buff coat £2, back & breast and pot £1 6s, pair of pistols £2, carbine £1, saddle £1, sword 5s',
    ammo: 6, move: 6, range: 2, fire: 0.07, pen: 0.35, moveFire: 6, melee: 1.4, charge: 1.6, armour: 0.3, antiCav: 1, morale: 65, frontage: 30, wet: 0.35,
    mounted: true,
    note: 'The standard horseman of the 1640s: fire a pistol at the gallop, then go in with the sword. A trooper\'s pay and fodder cost three times a foot soldier\'s.',
  },
  cuirassier: {
    name: 'Cuirassiers', short: 'Cuir', glyph: 'cuirassier', men: 30,
    kit: 4800, pay: 30, food: 12,
    kitNote: 'Great horse £12, three-quarter armour £4 10s, pistols £2 5s, saddle £1 5s, sword 6s',
    ammo: 4, move: 5, range: 1, fire: 0.08, pen: 0.4, moveFire: 5, melee: 1.8, charge: 1.8, armour: 0.55, antiCav: 1, morale: 78, frontage: 30, wet: 0.35,
    mounted: true,
    note: 'What became of the knight: the same plate, a pistol instead of a lance. Nearly proof against musket balls, but so dear that few armies kept many.',
  },
  hussar: {
    name: 'Winged hussars', short: 'Huss', glyph: 'hussar', men: 30,
    kit: 6000, pay: 30, food: 12,
    kitNote: 'Bred horse £15, 5 m lances, breastplate and wings £5, sabre, pistols, saddle',
    ammo: 3, move: 6, range: 1, fire: 0.04, pen: 0.35, moveFire: 6, melee: 1.6, charge: 3.0, armour: 0.35, antiCav: 1, morale: 85, frontage: 30, wet: 0.35,
    mounted: true, lance: true,
    note: 'Poland\'s lancers kept the knightly charge alive all century and won with it (Kircholm 1605, Klushino 1610). The lance hits like a cannon on the first contact, then it\'s sabres.',
  },
  artillery: {
    name: 'Artillery (2 sakers)', short: 'Guns', glyph: 'gun', men: 16, guns: 2,
    kit: 4500, pay: 12, food: 9,
    kitNote: 'Two sakers with carriages ~£220, 16 draught horses ~£80, shot and powder; split per gunner',
    ammo: 20, move: 1, range: 14, fire: 0, moveFire: 0, melee: 0.3, charge: 1, armour: 0, antiCav: 0.4, morale: 45, frontage: 16, wet: 0.2,
    gun: true,
    note: 'Roundshot ploughs through ranks out to half a mile; canister at close range. Cannot move and fire in the same activation, and the gunners run if horse get among them.',
  },
};
export const UNIT_IDS = Object.keys(UNITS);

export const RATIONS = {
  half:     { name: 'Half rations', mult: 0.5, morale: -15, note: 'Saves money; troops arrive hungry and sour, horses weak (horse move −1).' },
  full:     { name: 'Full rations', mult: 1, morale: 0, note: '2 lb bread, 1 lb cheese or meat, beer; hay and oats for the horses.' },
  generous: { name: 'Generous',     mult: 1.3, morale: 6, note: 'Meat most days and plenty of beer. Content soldiers stand longer.' },
};

export const d2s = (d) => {
  d = Math.round(d);
  const L = Math.floor(d / 240), s = Math.floor((d % 240) / 12), p = d % 12;
  if (L >= 100) return '£' + L.toLocaleString('en-GB');
  return (L ? '£' + L + ' ' : '') + (s ? s + 's ' : '') + (p || (!L && !s) ? p + 'd' : '').trim();
};
export const pounds = (d) => d / 240;

// cost of one company: kit up front, then pay + food for every day in the field
export function companyCost(type, { days = 90, rations = 'full' } = {}) {
  const U = UNITS[type]; const r = RATIONS[rations] || RATIONS.full;
  const kit = U.kit * U.men, pay = U.pay * U.men * days, food = U.food * r.mult * U.men * days;
  return { kit, pay, food, total: kit + pay + food };
}
