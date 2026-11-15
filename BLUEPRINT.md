# BLUEPRINT — threejs-fps-02: "EMBERLINE — Foundry District"

Slug: `threejs-fps-02` · Title: **Make the best three.js tactical FPS** · Reward: $1000 USDC
Entries close: **2026-11-16T21:30:00Z = 17 Nov 04:30 WIB** · Account: @ridho-suryo-nugroho
Agent wallet: `3kdhyBhEmXRYMkFCEfFUzJkXzUb6jcLuRqHJvzQewFuQ` (entry signing ONLY; never Ridho's primary wallet)

## 1. Game design (original — Counter-Strike-STYLE, never a copy)

**Name:** EMBERLINE — Foundry District. Two fictional crews: **Ember crew** (attackers, orange)
vs **Ash crew** (defenders, teal). No real-world names, maps, or art from any commercial game.

**Core loop:** 5v5 round-based tactical FPS, single-player + 9 bots (4 teammates, 5 enemies).
First to **5 round wins** (max 9 rounds; 4–4 = draw, match restarts). Round length **100 s**.
Round win by: eliminating the enemy team, **or** attackers planting the **charge** at a site
and it detonating (40 s fuse), **or** defenders defusing it / running the clock out
(defenders win on timeout if no plant).

**Objective:** attackers carry a charge. Plant at Site A (Furnace Hall) or Site B (Crane Yard)
by holding **E** for 3 s inside the site zone; defenders defuse by holding **E** for 5 s
(2.5 s with a defuse kit, $400). Plant/defuse progress bar + beeping. HUD shows plant status.

**Map — "Foundry District" (~44 × 34 m, original layout):**
- Three lanes: **A Long** (west, open sightline with crates), **Mid** (central foundry floor
  with furnace pillar + catwalk sightlines), **B Tunnel** (east, close-quarters corridor).
- Two sites: A = Furnace Hall (NW), B = Crane Yard (NE, stacked containers).
- Spawns: attackers south, defenders north. Connector lanes, corners, and cover crates
  everywhere; no dead ends except sites. Built from boxes/cylinders only, own palette.
- Colliders: every wall/crate is an AABB collider (player + bots) and a bullet stopper.

**Economy (buy phase, 15 s between rounds, press B):**
- Start $800. Kill +$300, round win +$3250, round loss +$1900 (+$500 per consecutive loss, cap $3400).
- Buy menu (mouse-clickable + number keys 1–6): Pistol P9 (free sidearm, always owned),
  SMG "Hornet" $1500, Rifle "VK-47" $2700, Shotgun "Mauler" $1100, Marksman "Longshot" $4200,
  Frag grenade $300, Smoke grenade $300, Kevlar vest $650, Defuse kit $400 (defenders only).
- Money persists across rounds; weapons kept on round win, lost on death (respawn with pistol
  + bought items reset to owned pistol only — simple, readable rule shown in buy menu).

**Weapons (hitscan, accuracy > speed):**

| Weapon | Mag | Reserve | Fire rate | Damage body/head | Spread still/move | Notes |
|---|---|---|---|---|---|---|
| P9 pistol | 12 | 36 | 0.22 s | 26 / 78 | low | sidearm, accurate |
| Hornet SMG | 32 | 96 | 0.075 s | 22 / 66 | med, high move penalty | close range |
| VK-47 rifle | 30 | 90 | 0.10 s | 34 / 136 | low still, big move penalty | main rifle |
| Mauler shotgun | 6 | 24 | 0.9 s | 9×8 pellets | wide | close range |
| Longshot DMR | 10 | 30 | 0.85 s | 68 / 200 | tiny still, huge move penalty | scope zoom (RMB) |

- Recoil (pitch kick + random yaw), spread grows with movement speed and while airborne,
  crouching reduces spread; tracer lines, muzzle flash light, shell-free (no per-frame allocs).
- Reload (R), ammo runs out (reserve 0 → must buy / pistol fallback). Grenades: **G** throws
  frag (fuse 1.6 s, radius damage falloff, no self-damage to teammates? — simple: damages
  everyone in radius, bots avoid their own blast); smoke = expanding opaque sphere, blocks
  bot line-of-sight for 12 s.

**Bots (9):** waypoint graph over the map (hand-placed nodes + edges). States:
`buy → rush/hold route → engage (LOS + reaction time 250–600 ms by difficulty) →
plant/defuse when carrying → retreat on low HP → regroup`. Burst fire (3–5 rounds),
accuracy falls with distance/target speed, they strafe, crouch behind cover, react to
gunshot sounds (investigate last heard shot within 25 m), hold angles at sites, and
defenders rotate to the site under attack. Friendly bots use team colours + name tags
(small floating labels via sprites — cheap canvas textures generated at boot, no network).
Bot difficulty: mixed (2 rookies, 5 regulars, 2 veterans per team distribution).

**HUD:** health bar + number (bottom-left), ammo mag/reserve big (bottom-right), round timer
(top-centre, turns red < 15 s), score **EMB 3 — 2 ASH** (top-centre), money (top-right),
round number, kill feed (top-right, fades), hitmarker + damage direction indicator,
crosshair that expands with spread, team/alive counts (5v5 pips), plant/defuse progress bar,
grenade count, objective banner ("Plant the charge at A or B" / "Defend the sites"),
compass strip (N/E/S/W + site markers) — cheap DOM, no canvas cost.
Overlays: start menu (title, briefing, controls, Click to play), buy menu, round-end banner,
match-end screen with stats (K/D, damage, accuracy) + Play again.

**Controls:** WASD move · mouse look (pointer lock) · LMB fire · RMB scope (Longshot) ·
R reload · G grenade · E plant/defuse/use · B buy menu · Shift walk (slow, quiet, accurate) ·
Ctrl/C crouch · Space jump · 1/2/3 weapon slots · Esc pause · M mute.

**Audio:** WebAudio synth only, zero external assets. Gunshots (filtered noise burst +
osc thump, per-weapon timbre), dry-fire click, reload clicks, hit "tick", kill chime,
footsteps (soft noise taps, quieter while walking), plant/defuse beeps, round win/lose
stingers, ambient foundry hum (low looped oscillator + filtered noise, very quiet).
Mute toggle M; audio starts on first user gesture.

**Look:** dusk foundry palette — charcoal steel, ember orange accent, teal defender trim,
warm sodium lamps + cool skylight, fog, long shadows (one 2048 shadow map), emissive furnace
glow at Site A, crane silhouette at Site B, painted floor markings (canvas-texture decals
generated at boot: hazard stripes, site letters A/B, arrows — no external images).
Sky: gradient + procedural clouds via large shader-free dome (vertex-coloured sphere).

## 2. File structure

```
threejs-fps-02/
  BLUEPRINT.md            ← this file
  SUBMIT-READY.md         ← verification checklist + manual steps left
  LICENSE                 ← MIT (kit starter's, SPDX MIT)
  README.md               ← badges (make.fun) + how to play + build notes
  .gitignore              ← out/, kit/, node_modules/, *.tar.gz, keypairs
  .makefun/owner.json     ← {"wallet": "<agent wallet>"}
  main.ts                 ← copies game/ + screenshots/ → /output, writes dossier.json
  serve.ts                ← static dev server (from starter, adapted)
  vendor/makefun-threejs.ts ← kit copy, UNCHANGED (sha256 verified)
  game/
    index.html            ← one import map "three" → ./vendor/three/three.module.min.js
    src/
      main.js             ← boot, fixed-step loop, shot modes, wiring
      state.js            ← single game-state store (match/round/economy/players)
      palette.js          ← palette + CSS tokens
      world.js            ← map geometry, colliders, sites, waypoints, decals
      player.js           ← FPS movement (accel/friction/gravity/crouch/jump, AABB)
      weapons.js          ← weapon defs, view models, spread/recoil/reload, tracers
      bots.js             ← bot AI (waypoints, LOS, bursts, plant/defuse, hearing)
      combat.js           ← raycast hits, head/body damage, grenades, tracers, deaths
      rounds.js           ← round flow, economy, buy menu data, win conditions
      audio.js            ← WebAudio synth SFX + ambient
      hud.js              ← DOM HUD + overlays + kill feed + buy menu
      input.js            ← keyboard/mouse/pointer lock
      fx.js               ← particles, muzzle flash, smoke, floating labels
    vendor/three/
      three.module.min.js ← npm three@0.187.0 build/three.module.js (2 specifiers rewritten)
      three.core.min.js   ← npm three@0.187.0 build/three.core.js
      LICENSE             ← three.js MIT license
  screenshots/
    1-start.jpg  2-play.jpg  3-buy.jpg  4-end.jpg   (1280×720, ≤256 KiB each, real renders)
  kit/  kit.tar.gz        ← kit download (NOT shipped in repo; gitignored)
```

Dossier budget: source cap 160 KiB — target total game source ≤ ~120 KiB so the judge
reads (nearly) all of it. Keep modules tight; no dead code; comments short and purposeful.

## 3. Rendering / perf plan

- three.js 0.187.0 vendored byte-for-byte (starter's files are already the correct bytes —
  verify sha256 vs kit.json: three.module.min.js ef510bae…, three.core.min.js 613e370f…).
- One directional shadow light + hemisphere; MeshStandardMaterial, shared geometries/
  materials (no per-frame `new` in hot loops — preallocated Vector3/ Raycaster temps).
- Fixed 60 Hz simulation, render at display rate; `powerPreference: high-performance`,
  pixelRatio capped at 2 (1.5 in shot mode for speed).
- Bots: max 9, simple capsule-ish grouped meshes (shared geometries), name sprites only
  for teammates; tracers pooled (12 line objects reused); particles pooled.
- No network: no fetch/XHR, no external fonts/images/audio; everything procedural.

## 4. Screenshot / shot modes (`?shot=…&seed=N`)

Deterministic staged frames, same pattern as the starter (render twice, freeze,
`window.__shotReady = true`):
- `start` — menu overlay over the map from attacker spawn, dusk light, furnace glow.
- `play` — mid-round: player mid-map, 3 bots visible, muzzle flash + tracer, HUD live.
- `buy` — buy menu open over the map with economy visible.
- `end` — round-win banner after a plant detonation / elimination, scoreboard visible.
Also expose `window.__game` (state snapshot: phase, round, score, hp, ammo, money, bots
alive, kills) for headless verification, and `window.__errors` (captured console errors).

## 5. Edge cases

- Pointer lock unavailable / denied (headless): game still renders and simulates; overlay
  explains click-to-play; shot modes bypass lock entirely.
- WebGL2 missing: show a clear message panel (WebGL2 required) instead of a black screen;
  verify headless Chromium + SwiftShader provides WebGL2 before screenshotting.
- No network: all imports relative or via the single import map; no `fetch`, no CDN.
- Resize: camera + renderer follow the window; HUD is DOM (scales).
- Tab blur: keys cleared, firing stops, round timer pauses while tab hidden (document.hidden
  check in the loop) — no cheap deaths while alt-tabbed.
- Determinism: seeded RNG (mulberry32) for shot mode + bot decisions seeded per round,
  so screenshots are reproducible.
- Round edge cases: plant in last 5 s still counts (round extends to fuse end); simultaneous
  elimination = attackers win if charge planted; defuse completes at 0.0 s counts as defuse.
- Size caps: game/ ≤ 48 MiB / 993 entries; screenshots ≤ 256 KiB each, long side ≤ 1280,
  short side ≥ 480; dossier ≤ 1.5 MiB; /output ≤ 1000 entries / 64 MiB.

## 6. Verification plan (Strict Judge Mode)

1. `node --check`-style parse of every game .js (ES module parse via node).
2. `MAKEFUN_OUTPUT_DIR=out node main.ts` twice → byte-identical outputs; dossier.json
   matches `buildDossier` (gate's dossier_matches).
3. three.js sha256 vs kit.json; import map single + resolves; vendor file sha256 unchanged.
4. Headless Chromium (Playwright, SwiftShader WebGL2): load each `?shot=` URL, assert
   `__shotReady`, zero console errors/pageerrors, zero network requests (request listener).
5. Interactive play-test: simulate keys/mouse via CDP (pointer lock in headless is
   best-effort — verify degrade path), step the sim via exposed hooks, assert: bots move
   (positions change), bots shoot (player HP drops / events fire), round ends (force via
   `__game.debugEndRound` or kill all bots), HUD values update, buy menu opens and a
   purchase deducts money and swaps weapon, grenade throw works, plant/defuse flow works
   (scripted via debug hooks + real key events where possible).
6. Screenshots: real renders from this code only, 1280×720 JPEG ≤ 256 KiB, 4 files.
7. Secret scan before any push: no .env/key/token/wallet-private material; `.gitignore`
   covers out/, kit/, keypairs.
8. Judge-criteria self-audit (criteria 1–5): complete game, gunplay, tactics, map/look, code.

## 7. Risks

- Headless pointer lock may not engage → mitigate with shot modes + debug hooks; verify
  the non-locked degrade path renders and simulates.
- SwiftShader WebGL2 slow → cap pixelRatio in shot mode, keep shadow map 2048.
- Dossier 160 KiB cap truncates source → keep source ≤ ~120 KiB, most important files
  first in import order (index.html → main.js → combat/weapons/bots…).
- 6,653 submissions already; house games are strong → aim for visible completeness in
  screenshots (bots, tracers, HUD, buy menu) since the judge reads screenshots first.
- Transcript gate: this session's logs must show the agent writing the code; bundle at
  submit time via the kit CLI (parent handles submit; this task only prepares).
- Repo creation needs Ridho's laptop browser (GitHub App cannot create repos, 403 seen
  in bounty #3) + Ridho's authenticator code — NOT attempted here.
