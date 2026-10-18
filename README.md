# Pike & Shot Bots

A 1600s battle simulator. You buy companies of musketeers, pikemen, horse, guns, archers and peasant levies on a budget that pays for kit up front, then wages and food for every day in the field. You give each company a captain's personality, and the AI fights it out on a 36×24 field (about a kilometre wide), one company activation at a time.

Live: https://pike-shot-bots.apps.precogsoftwareservices.com

## Tabs
- **Battle**: muster two armies (presets or custom, budget, days in field, rations), pick a field and weather, then watch an animated replay or simulate 100 battles. Stats include casualties per £100 and enemy value killed per £ spent.
- **Army lab**: round robin between historical orders of battle bought to the same budget: Swedish brigade, Spanish tercio, Cavalier horse, New Model Army, Peasant host, The old ways (bows and lances), Polish–Lithuanian, Dragoon raiders, Gun line.
- **Unit value**: armies of a single company type at equal cost, all against all. Answers "is one troop of cuirassiers worth five companies of musketeers?".
- **Captains**: the same army under every personality, plus an editor (saved in the browser).
- **Price list**: kit, wages and food per company, notes on each troop type, rations, and the rules.

## Money
Pence throughout (12d = 1s, 20s = £1). Prices are rounded from 1640s English accounts. For example, a matchlock musket with rest and bandolier came to about 17s 6d, a pike to 4s, a corslet to about £1, and a trooper's horse to £5–10. Food per day includes fodder: a horseman eats 4d and his horse another 6d. Rations can be half (−15 morale, weak horses), full, or generous (+6 morale).

## Engine (`engine/`)
Plain ES modules with no dependencies; the same code runs in Node and in a Web Worker.

| file | role |
|---|---|
| `units.js` | 11 company types: costs, stats, ammunition, notes |
| `maps.js` | six mirrored fields (open, hills, river ford, hedgerows, woods edge, village) and terrain costs/cover |
| `army.js` | army cost, `buildArmy(mix, budget)`, presets, classic deployment (pikes among the shot, horse on the wings) |
| `rules.js` | line of sight, expected fire (range falloff, cover, armour vs penetration, rain) and melee (charge, flank/rear, pikes braced against horse, horse shock) |
| `battle.js` | turn loop, alternating activations, moves with zone of control, volleys, closing volleys, melee, morale, rout and rally, pursuit off the field, victory |
| `ai.js` | utility AI over destination × action × target, weighted by personality |
| `personalities.js` | captains: aggression, caution, discipline, cohesion, focus, pursuit, randomness, target mode |
| `sim.js` | `fight`, `matchup`, `tournament`, `unitMatrix` |

```sh
node tools/cli.mjs fight swedish rupert open 3        # one logged battle
node tools/cli.mjs vs tercio levy hills 50            # win rate
node tools/cli.mjs presets open 8                     # preset tournament
node tools/cli.mjs units open 6 6000                  # single-type tournament at £6000
node --test test/engine.test.mjs
```

## Deploy
This is a plain static site with no `package.json`, on purpose. `deploy.sh pike-shot-bots nathandunn/pike-shot-bots` bind-mounts it into nginx.
