// EMBERLINE — Foundry District. Boot and the one loop: a fixed 60 Hz simulation
// feeding a render at the display's rate.
// ?shot=start|play|buy|end with &seed=N stages a deterministic frame for a capture,
// renders it twice, then freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createMatch } from './state.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapons, WEAPONS } from './weapons.js';
import { createCombat, createEntity } from './combat.js';
import { createBots } from './bots.js';
import { createRounds } from './rounds.js';
import { createAudio } from './audio.js';
import { createFx } from './fx.js';
import { createHud } from './hud.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '7', 10) || 7;

window.__errors = [];
window.addEventListener('error', (event) => window.__errors.push(String(event.message || event.error)));
const origConsoleError = console.error.bind(console);
console.error = (...args) => {
  window.__errors.push(args.map((a) => String(a)).join(' '));
  origConsoleError(...args);
};

const S = createMatch(seed);
const noGL = document.getElementById('nogl');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const gl = renderer.getContext();
  if (!gl || !(gl instanceof WebGL2RenderingContext)) throw new Error('WebGL2 unavailable');
} catch (err) {
  noGL.hidden = false;
  document.getElementById('overlay').hidden = true;
  window.__errors.push(`WebGL2 init failed: ${err.message}`);
  window.__webglError = String(err.message);
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, shot ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
scene.add(camera);

const world = createWorld(scene);
const fx = createFx(scene);
const audio = createAudio();
const input = createInput(renderer.domElement, onLockChange);
const playerCtl = createPlayer(world.colliders);
const weapons = createWeapons(camera, fx, audio);
const combat = createCombat(scene, S, world, fx, audio, weapons);
const bots = createBots(scene, S, world, combat, weapons);

// The player entity (first-person body is hidden; the entity carries hp/ammo/state).
const playerEnt = createEntity(scene, {
  id: 'you', name: 'You', team: 'emb', isPlayer: true,
  pos: new THREE.Vector3(0, 0, 14), yaw: 0,
});
playerEnt.primary = 'pistol';
playerEnt.owned = { pistol: true };
S.entities.push(playerEnt);
S.player = playerEnt;
combat.registerEntity(playerEnt);
weapons.equip(playerEnt, 'pistol');

const rounds = createRounds(S, { world, combat, bots, weapons, audio, fx, input, player: playerEnt });
combat.onDeath = (target) => rounds.onEntityDeath(target);

const hud = createHud(S, {
  onPlay: () => {
    audio.unlock();
    audio.startAmbient();
    if (shot) return;
    if (S.phase === 'menu' || S.phase === 'matchEnd') {
      rounds.startMatch();
      // Buy phase: no pointer lock yet — the mouse stays free for the buy menu.
    } else if (S.phase === 'paused' || S.phase === 'live' || S.phase === 'buy') {
      input.requestLock();
    } else if (S.phase === 'roundEnd') {
      hud.toast('Next round starts shortly…');
    }
  },
  onBuy: (id) => {
    const res = rounds.buyItem(id);
    if (res.ok) hud.refreshBuy();
    else hud.toast(res.reason || 'Cannot buy that');
  },
  onBuyClose: () => {
    if (S.phase === 'buy') {
      hud.showBuy(false);
      S.buyOpen = false;
      rounds.startRound();
    }
  },
});

const body = playerCtl.state;
const raycasterDir = new THREE.Vector3();
const muzzlePos = new THREE.Vector3();
const tmpVec = new THREE.Vector3();
let lastHp = 100;
let frozen = false;
let started = false;
let prevPhase = 'menu';
let accumulator = 0;
let lastTime = performance.now();
let stepCount = 0;

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

function syncPlayerEntity() {
  playerEnt.pos.copy(body.position);
  playerEnt.yaw = body.yaw;
  playerEnt.speed = playerCtl.groundSpeed();
  playerEnt.group.position.copy(body.position);
  playerEnt.group.rotation.y = body.yaw;
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
    if (S.phase === 'buy') {
      hud.showBuy(true);
      S.buyOpen = true;
    } else {
      hud.showBuy(false);
    }
  } else if (S.phase === 'live') {
    hud.showOverlay('paused');
  } else if (S.phase === 'menu' || S.phase === 'matchEnd') {
    hud.showOverlay(S.phase === 'matchEnd' ? 'matchEnd' : 'start');
  }
}

function handleActionKeys() {
  // Buy menu (buy phase only).
  if (input.consume('KeyB')) {
    if (S.phase === 'buy') {
      const open = document.getElementById('buy-menu').hidden;
      hud.showBuy(open);
      S.buyOpen = open;
      if (open) hud.refreshBuy();
    } else if (S.phase === 'live') {
      hud.toast('Buy phase is over — next round');
    }
  }
  if (S.buyOpen && S.phase === 'buy') {
    for (let i = 0; i < hud.buyItems.length; i += 1) {
      if (input.consume(`Digit${i + 1}`)) {
        const res = rounds.buyItem(hud.buyItems[i].id);
        if (res.ok) hud.refreshBuy();
        else hud.toast(res.reason || 'Cannot buy that');
      }
    }
  } else if (S.phase === 'live') {
    if (input.consume('Digit1') && playerEnt.primary) weapons.equip(playerEnt, playerEnt.primary);
    if (input.consume('Digit2')) weapons.equip(playerEnt, 'pistol');
  }
  if (input.consume('KeyR') && S.phase === 'live') weapons.reload(playerEnt);
  if (input.consume('KeyM')) {
    audio.setMuted(!audio.muted);
    hud.toast(audio.muted ? 'Sound muted' : 'Sound on');
  }
  if (input.consume('KeyG') && S.phase === 'live') {
    camera.getWorldDirection(raycasterDir);
    muzzlePos.copy(camera.position).addScaledVector(raycasterDir, 0.6);
    if (playerEnt.grenades.frag > 0) combat.throwGrenade(playerEnt, 'frag', muzzlePos, raycasterDir);
    else if (playerEnt.grenades.smoke > 0) combat.throwGrenade(playerEnt, 'smoke', muzzlePos, raycasterDir);
    else hud.toast('No grenades — buy some in the buy phase');
  }
}

function tryFire() {
  if (S.phase !== 'live') return;
  if (!input.state.firing) return;
  if (!weapons.ready(playerEnt)) return;
  camera.getWorldDirection(raycasterDir);
  const spread = weapons.spreadFor(playerEnt, playerCtl.groundSpeed(), !body.onGround, body.crouching, body.walking);
  const res = combat.shoot(playerEnt, camera.position, raycasterDir, spread);
  if (res.fired) {
    playerCtl.recoil(WEAPONS[playerEnt.gun.id].kick * 0.9, (S.rng() * 2 - 1) * 0.003);
    if (res.hit) hud.hitMarker(res.kill);
  }
}

function step(dt) {
  S.time += dt;
  stepCount += 1;
  const look = input.takeLook();
  playerCtl.look(look.x, look.y);
  if (S.phase === 'live' || S.phase === 'buy') playerCtl.step(dt, input.state.keys);
  syncPlayerEntity();
  weapons.stepGun(playerEnt, dt);
  weapons.step(dt, playerCtl.groundSpeed());
  handleActionKeys();
  if (!shot) tryFire();
  rounds.update(dt);
  if (S.phase === 'live') bots.step(dt);
  combat.step(dt);
  fx.step(dt);
  world.update(dt, S.time);
  if (playerEnt.hp < lastHp) hud.damageFlash();
  lastHp = playerEnt.hp;
  // Scope (right mouse button) — only the DMR zooms.
  if (input.state.scoped !== undefined) weapons.setScope(input.state.scoped && playerEnt.gun && playerEnt.gun.id === 'dmr');
  input.clearPressed();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (frozen) {
    renderer.render(scene, camera);
    return;
  }
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!document.hidden) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
  }
  // Phase transitions the simulation owns: open the buy menu, and (re)lock the
  // pointer when a round starts (the click that closed the menu counts as the
  // gesture; if the lock is refused the pause overlay offers it again).
  if (S.phase !== prevPhase) {
    if (S.phase === 'buy') {
      hud.showBuy(true);
      S.buyOpen = true;
      hud.refreshBuy();
    } else if (S.phase === 'live' && prevPhase === 'buy') {
      hud.showBuy(false);
      S.buyOpen = false;
      input.requestLock();
    } else if (S.phase === 'roundEnd') {
      hud.showOverlay('roundEnd', { winner: rounds.roundWinner(), reason: rounds.roundReason() });
    } else if (S.phase === 'matchEnd') {
      hud.showOverlay('matchEnd');
    }
    prevPhase = S.phase;
  }
  syncCamera();
  hud.update(playerEnt);
  const spread = playerEnt.gun ? weapons.spreadFor(playerEnt, playerCtl.groundSpeed(), !body.onGround, body.crouching, body.walking) : 0.01;
  hud.setCrosshairSpread(4 + spread * 320);
  hud.setScoped(!!(input.state.scoped && playerEnt.gun && playerEnt.gun.id === 'dmr'));
  renderer.render(scene, camera);
}

// Click the canvas to (re)lock the pointer while a round is live.
document.getElementById('game').addEventListener('click', () => {
  if (!shot && S.phase === 'live' && !input.state.locked) input.requestLock();
});

// Right mouse button = scope.
let scoped = false;
document.addEventListener('mousedown', (event) => {
  if (event.button === 2) {
    scoped = true;
    input.state.scoped = true;
  }
});
document.addEventListener('mouseup', (event) => {
  if (event.button === 2) {
    scoped = false;
    input.state.scoped = false;
  }
});
input.state.scoped = false;

function settle(steps) {
  for (let i = 0; i < steps; i += 1) step(FIXED_STEP);
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    hud.update(playerEnt);
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

function runShot(name) {
  window.__noLock = true;
  hud.hideOverlay();
  audio.unlock();
  rounds.startMatch();
  // Skip the buy phase for captures: straight into the round.
  rounds.startRound();
  S.money = 3250;
  if (name === 'start') {
    body.position.set(0.6, 0, 8.6);
    body.yaw = 0.15;
    body.pitch = 0.02;
    settle(30);
    aimAt(new THREE.Vector3(-8, 1.6, -8));
    hud.showOverlay('start');
  } else if (name === 'play') {
    // Mid-round firefight from the west lane: the mid pillar is out of frame,
    // the A site furnace glows ahead, bots visible down the lane.
    body.position.set(-6, 0, 6);
    body.yaw = 0;
    body.pitch = 0;
    // Staging armour: the bots focus the stationary camera for 1.5 s of sim,
    // which would kill it before the freeze. The capture stages one moment
    // of the firefight; the HUD is restored to 100 HP before the freeze.
    playerEnt.hp = 10000;
    settle(90); // let bots advance into view
    let target = null;
    let bestDist = Infinity;
    for (const e of S.entities) {
      if (!e.isBot || e.team !== 'ash' || !e.alive) continue;
      const d = Math.hypot(e.pos.x - body.position.x, e.pos.z - body.position.z);
      if (d < bestDist) {
        bestDist = d;
        target = e;
      }
    }
    if (target) {
      aimAt(tmpVec.set(target.pos.x, target.pos.y + 1.2, target.pos.z));
      camera.getWorldDirection(raycasterDir);
      combat.shoot(playerEnt, camera.position, raycasterDir, 0);
      settle(2);
      camera.getWorldDirection(raycasterDir);
      combat.shoot(playerEnt, camera.position, raycasterDir, 0.004);
      // No settle after the last shot: the tracer and muzzle flash are still
      // live when the frame freezes, so the capture shows the firefight.
    }
    playerEnt.hp = 100;
    lastHp = 100;
  } else if (name === 'buy') {
    S.phase = 'buy';
    S.buyTimer = 15;
    S.buyOpen = true;
    S.money = 3250;
    body.position.set(2, 0, 10);
    body.yaw = -0.4;
    settle(20);
    hud.showBuy(true);
    hud.refreshBuy();
  } else if (name === 'end') {
    // Round won by elimination: several ash bots down, round-end banner up.
    for (const e of S.entities) {
      if (e.isBot && e.team === 'ash') {
        e.hp = 0;
        e.alive = false;
        e.fall = 1;
        e.group.rotation.x = -1.45;
        e.group.position.y = -0.08;
      }
    }
    S.score.emb = 3;
    S.score.ash = 2;
    S.round = 6;
    body.position.set(-4, 0, 6);
    body.yaw = 0.5;
    settle(10);
    hud.showOverlay('roundEnd', { winner: 'emb', reason: 'elimination' });
  }
  syncCamera();
  syncPlayerEntity();
  hud.update(playerEnt);
  paintTwiceThenReady();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__game = {
  S,
  player: playerEnt,
  bots,
  rounds,
  combat,
  weapons,
  world,
  snapshot() {
    return {
      phase: S.phase,
      round: S.round,
      score: { ...S.score },
      timer: Math.round(S.timer * 10) / 10,
      money: S.money,
      hp: playerEnt.hp,
      ammo: playerEnt.gun ? { mag: playerEnt.gun.mag, reserve: playerEnt.gun.reserve, id: playerEnt.gun.id } : null,
      aliveEmb: S.entities.filter((e) => e.team === 'emb' && e.alive).length,
      aliveAsh: S.entities.filter((e) => e.team === 'ash' && e.alive).length,
      plant: { ...S.plant, planter: S.plant.planter ? S.plant.planter.id : null },
      kills: S.stats.kills,
      deaths: S.stats.deaths,
      errors: window.__errors.slice(),
      steps: stepCount,
    };
  },
  debug: {
    startMatch: () => rounds.startMatch(),
    startRound: () => rounds.startRound(),
    endRound: () => {
      // Force an elimination win for tests: drop every Ash bot.
      for (const e of S.entities) if (e.isBot && e.team === 'ash' && e.alive) combat.damageEntity(e, 1000, 'torso', playerEnt);
    },
    killAllBots: (team) => {
      for (const e of S.entities) if (e.isBot && (!team || e.team === team) && e.alive) combat.damageEntity(e, 1000, 'torso', playerEnt);
    },
    giveMoney: (n) => { S.money += n; },
    teleport: (x, z) => { body.position.set(x, 0, z); },
  },
};

syncCamera();
hud.update(playerEnt);
if (shot) runShot(shot);
else requestAnimationFrame(frame);
