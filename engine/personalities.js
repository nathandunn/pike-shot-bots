// Personalities are command styles: a company's captain, not its kit. Any company can wear any of them.
// Traits are 0..1.
export const TRAITS = {
  aggression: 'Closes with the enemy and charges home rather than trading shots.',
  caution:    'Weighs incoming fire and the threat of horse; seeks cover and pike support, falls back when mauled.',
  discipline: 'Holds fire for close range, rallies quickly, keeps its order.',
  cohesion:   'Keeps in line with friends and covers their flanks instead of wandering off.',
  focus:      'Piles onto targets already hurt or engaged, finishes what the army started.',
  pursuit:    'Chases broken enemies. High pursuit cavalry may ride off the field after them (Edgehill, 1642).',
  randomness: 'Noise on every decision. 0 = drill book, 1 = chaos.',
};
export const TARGET_MODES = {
  nearest: 'Whoever is closest',
  weakest: 'Fewest men or lowest morale',
  threat:  'The company doing the most harm',
  costly:  'The most expensive company in reach (horse and guns)',
};

export const PRESETS = {
  steady:    { name: 'Steady',     aggression: .5,  caution: .5,  discipline: .6,  cohesion: .6,  focus: .5,  pursuit: .3,  randomness: .1,  target: 'threat',  blurb: 'Drill-book captain. Holds the line, fires at good range, charges when it pays.' },
  hothead:   { name: 'Hotheaded',  aggression: .95, caution: .1,  discipline: .2,  cohesion: .25, focus: .3,  pursuit: .95, randomness: .15, target: 'nearest', blurb: 'Prince Rupert: charges anything in sight and chases the beaten off the map.' },
  cautious:  { name: 'Cautious',   aggression: .25, caution: .85, discipline: .7,  cohesion: .7,  focus: .5,  pursuit: .1,  randomness: .1,  target: 'nearest', blurb: 'Keeps cover and pike support, waits for the enemy to come on.' },
  skirmisher:{ name: 'Skirmisher', aggression: .35, caution: .7,  discipline: .3,  cohesion: .2,  focus: .6,  pursuit: .2,  randomness: .15, target: 'weakest', blurb: 'Shoots at long range, falls back, never stands to be charged.' },
  stalwart:  { name: 'Stalwart',   aggression: .3,  caution: .4,  discipline: .9,  cohesion: .95, focus: .4,  pursuit: .05, randomness: .05, target: 'threat',  blurb: 'Ironsides: tight order, volleys at point blank, never pursues too far.' },
  butcher:   { name: 'Butcher',    aggression: .8,  caution: .3,  discipline: .4,  cohesion: .3,  focus: .95, pursuit: .7,  randomness: .1,  target: 'weakest', blurb: 'Hunts the shaken and broken and makes sure they never rally.' },
  raider:    { name: 'Raider',     aggression: .7,  caution: .5,  discipline: .4,  cohesion: .1,  focus: .5,  pursuit: .5,  randomness: .15, target: 'costly',  blurb: 'Goes round the flank for the guns and the horse.' },
  coward:    { name: 'Coward',     aggression: .05, caution: .95, discipline: .3,  cohesion: .5,  focus: .3,  pursuit: .1,  randomness: .1,  target: 'nearest', blurb: 'Hangs at the back, fires from far away, falls back from everything.' },
  wildcard:  { name: 'Wildcard',   aggression: .6,  caution: .4,  discipline: .4,  cohesion: .4,  focus: .4,  pursuit: .5,  randomness: .6,  target: 'nearest', blurb: 'Anything could happen.' },
};
export const PRESET_IDS = Object.keys(PRESETS);

export function resolvePersonality(p) {
  if (!p) return { id: 'steady', ...PRESETS.steady };
  if (typeof p === 'string') {
    if (!PRESETS[p]) throw new Error('unknown personality ' + p);
    return { id: p, ...PRESETS[p] };
  }
  return { id: p.id || 'custom', ...PRESETS.steady, ...p };
}
