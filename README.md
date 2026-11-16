# STEELHAVEN — Tactical FPS (three.js)

An original first-person shooter that runs entirely in the browser, built with
[three.js](https://threejs.org/). Night has fallen on a walled training
compound and five waves of hostiles are inbound. Clear them all.

Entered on [make.fun](https://make.fun/bounty/threejs-fps-02) · “Make the best
three.js tactical FPS” bounty (threejs-fps-02).

## Run it

No build step. Serve the folder with any static file server:

```sh
npm run serve        # python3 -m http.server 8080
# or: npx serve .
```

Then open http://localhost:8080 in a desktop browser with WebGL 2 (Chrome
works well) and click **DEPLOY**. An internet connection is needed once, to
load three.js from the CDN import map in `index.html`.

## How to play

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look (pointer lock) |
| Click / hold LMB | Fire (hitscan rifle, 30-round magazine) |
| R | Reload |
| Shift | Sprint |
| Space | Jump |
| Esc | Pause (releases the pointer) |

- **Rushers** (red) sprint at you and deal melee damage up close.
- **Shooters** (blue) hold a 13–19 m band, strafe, and fire 3-round bursts —
  they only shoot with a clear line of sight, so cover actually matters.
- Headshots deal **2.6×** damage. Damage falls off with distance.
- Downed hostiles have a 25% chance to drop a **medkit** (+30 HP).
- Survive and clear **5 waves** to win. Score comes from kills (100),
  headshot kills (160), wave clears, and a 500-point completion bonus.
- The radar (top right) shows hostiles in red and medkits in green, rotated
  to your facing.

## Features

- Pointer-lock mouse look, acceleration/friction movement, sprint, jump,
  head-bob and a gun view-model with recoil and muzzle flash
- Hitscan shooting with distance falloff, tracers, impact particles and
  hitmarkers (gold for body, red for headshots)
- Two enemy types with distinct AI: melee rushers with a weaving approach,
  and strafing shooters with line-of-sight checks and burst fire
- Five scaling waves with spawn gates, intermissions and a win/lose flow
- Full HUD: health bar, magazine, score, wave, hostiles remaining, timer,
  damage vignette, low-HP pulse and a live tactical radar
- Procedural WebAudio sound effects (gunfire, hits, deaths, pickups, UI) —
  zero audio assets
- Night compound arena: cover crates, lamp posts, moonlight shadows, fog

## Project layout

```
index.html        page, HUD, overlays, import map
src/logic.js      pure balance math (waves, damage, scoring) — no three.js
src/world.js      arena geometry, lights, AABB collision
src/enemies.js    enemy actors + AI (rushers / shooters)
src/player.js     pointer-lock controls, movement, gun view-model
src/audio.js      procedural WebAudio SFX
src/main.js       game state, shooting, waves, HUD, radar, effects
tests/logic.test.mjs   Node unit tests for the balance logic
```

## Tests

```sh
npm test   # node tests/logic.test.mjs — wave rosters, falloff, scoring
```

All tuning numbers live in `src/logic.js` (`CONFIG`, `waveComposition`,
`enemyStats`), so balancing never touches rendering code.

## License

MIT
