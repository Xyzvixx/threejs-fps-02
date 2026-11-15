# threejs-fps-02

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/Xyzvixx/threejs-fps-02/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/Xyzvixx/threejs-fps-02/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

**EMBERLINE — Foundry District**: a round-based tactical first-person shooter in the
style Counter-Strike made famous — two teams, short rounds won by eliminating the
other team or by planting/defusing a charge, money between rounds to buy weapons,
and gunfire where accuracy counts more than speed. Single-player against 9 bots,
running entirely offline in a desktop browser on three.js 0.187.0. An original map,
original art, original sounds and original names — nothing copied from any
commercial game.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: `game/` is plain static files (ES modules,
three.js vendored under `game/vendor/three/`). Node 22+ and a desktop browser
with WebGL 2 required.

## How to play

- **Objective:** as the Ember crew, plant the charge at Site A (Furnace Hall) or
  Site B (Crane Yard) — hold **E** inside a site for 3 s — or eliminate the Ash
  crew. First to 5 round wins takes the match (max 9 rounds).
- **Economy:** kills pay $300, round wins $3250, losses $1900 (+$500 per straight
  loss). Press **B** in the buy phase for rifles, SMGs, a shotgun, a DMR, frag and
  smoke grenades, and kevlar.
- **Controls:** WASD move · mouse look · click fire · R reload · G grenade ·
  E plant · B buy · Shift walk (slow, quiet, accurate) · Ctrl/C crouch ·
  Space jump · 1/2 weapon slots · RMB scope (DMR) · M mute.
- **Gunplay:** hitscan with headshot multipliers, recoil and spread that punish
  firing on the move — stopping to aim pays. Bots follow routes, hold angles,
  react to gunfire, plant and defuse.

## Layout

- `game/` — the playable game (index.html + `src/` modules + vendored three.js)
- `game/src/` — one module per job: `main` (loop + captures), `state` (the one
  store), `world` (map + waypoints), `player` (movement), `weapons`, `combat`,
  `bots` (AI), `rounds` (flow + economy + objective), `audio` (WebAudio synth),
  `fx` (pooled effects), `hud`, `input`, `palette`
- `screenshots/` — real renders of the game's own code
- `main.ts` — the make.fun entrypoint: copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json` with `vendor/makefun-threejs.ts`
- `vendor/makefun-threejs.ts` — the kit's dossier library, unchanged

---

<sub>Entered on [make.fun](https://make.fun/?ref=ridho-suryo-nugroho&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
