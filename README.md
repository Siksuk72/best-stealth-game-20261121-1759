# VERDANT — Stealth in the Moonlit Glasshouse

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Siksuk72/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Siksuk72/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

A complete, original top-down stealth game that plays offline in a desktop
browser from its own static files. Wren the thief has one night to steal the
Moonpetals back from Master Bramble's moonlit glasshouse — and slip out
unseen.

## Play

Open `game/index.html` in desktop Chrome (or serve the folder with
`node serve.ts` and open http://localhost:8080).

- **WASD / arrows** — move. **Shift** — sneak: slow, quiet, hard to spot.
- **Space or left-click** — toss a pebble: gardeners come to look at where it lands.
- **P / Esc** — pause. **M** — mute. **R** — restart the wing. **H** — help.
- **Enter / click** — start, continue to the next wing, play again.

Stay out of the lantern cones. Bushes hide you (a dashed ring shows when
you are hidden); crates, statues and walls block sight. Running is loud —
gardeners hear it and come to look. The detection meter fills while a
gardener has eyes on you; at full it trips the alarm and every gardener
chases. Steal every Moonpetal to unlock the glowing gate, then reach it.
Three wings: The Fern Court (3 gardeners), The Orchid House (4), The Glass
Dome (5). A wing cleared without ever tripping the alarm pays a ghost bonus.

## Wings

1. **The Fern Court** — 3 gardeners, 3 Moonpetals. Learn the patrols.
2. **The Orchid House** — 4 gardeners, 4 Moonpetals, a still pond to circle.
3. **The Glass Dome** — 5 gardeners, 5 Moonpetals under the great dome.

Best score is kept in the browser. Sounds are synthesized with WebAudio —
no audio files, no network requests.

## Files

- `main.ts` — the make.fun program: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json` with `vendor/makefun-game.ts`.
- `game/index.html` + `game/src/` — the game: `config.js` (tuning),
  `levels.js` (the three wings), `world.js` (rules: vision, noise,
  detection, alarm), `render.js` (canvas drawing, lantern light, HUD),
  `input.js`, `audio.js`, `shots.js` (screenshot scenes), `main.js` (loop).
- `screenshots/` — four real renders of the game's own code, staged by
  `shots.json` (`?shot=title|patrol|alarm|victory`).

## Development

```sh
node serve.ts          # game/ on http://localhost:8080
MAKEFUN_OUTPUT_DIR=out node main.ts   # build /output the way the grader does
```

## Run it

```sh
node serve.ts          # game/ on http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=hz26ha21&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
