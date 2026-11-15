// Weapon definitions, view models, spread/recoil/reload. This module owns the numbers;
// combat.js owns the ray and the damage. Spread punishes moving, jumping and spraying:
// standing still and crouching is the accurate way to shoot.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'P9 Sidearm', price: 0, slot: 2, mag: 12, reserve: 36,
    gap: 0.22, reload: 1.3, damage: 26, headMult: 3.0, pellets: 1,
    spreadStill: 0.0035, spreadMove: 0.02, spreadAir: 0.03, kick: 0.011, auto: false,
    zoom: 1, sound: 'pistol', range: 60,
  },
  smg: {
    id: 'smg', name: 'Hornet SMG', price: 1500, slot: 1, mag: 32, reserve: 96,
    gap: 0.075, reload: 1.8, damage: 22, headMult: 3.0, pellets: 1,
    spreadStill: 0.006, spreadMove: 0.026, spreadAir: 0.038, kick: 0.007, auto: true,
    zoom: 1, sound: 'smg', range: 55,
  },
  rifle: {
    id: 'rifle', name: 'VK-47 Rifle', price: 2700, slot: 1, mag: 30, reserve: 90,
    gap: 0.1, reload: 1.9, damage: 34, headMult: 4.0, pellets: 1,
    spreadStill: 0.0022, spreadMove: 0.028, spreadAir: 0.04, kick: 0.013, auto: true,
    zoom: 1, sound: 'rifle', range: 80,
  },
  shotgun: {
    id: 'shotgun', name: 'Mauler-12', price: 1100, slot: 1, mag: 6, reserve: 24,
    gap: 0.9, reload: 2.6, damage: 11, headMult: 2.0, pellets: 8,
    spreadStill: 0.03, spreadMove: 0.045, spreadAir: 0.055, kick: 0.03, auto: false,
    zoom: 1, sound: 'shotgun', range: 28,
  },
  dmr: {
    id: 'dmr', name: 'Longshot DMR', price: 4200, slot: 1, mag: 10, reserve: 30,
    gap: 0.85, reload: 2.4, damage: 68, headMult: 3.0, pellets: 1,
    spreadStill: 0.0012, spreadMove: 0.05, spreadAir: 0.07, kick: 0.028, auto: false,
    zoom: 2.2, sound: 'dmr', range: 90,
  },
};

export const BUY_ITEMS = [
  { id: 'smg', kind: 'weapon', name: 'Hornet SMG', price: 1500, desc: 'Fast close-range spray. 32 rounds.' },
  { id: 'shotgun', kind: 'weapon', name: 'Mauler-12', price: 1100, desc: '8-pellet burst. Devastating up close.' },
  { id: 'rifle', kind: 'weapon', name: 'VK-47 Rifle', price: 2700, desc: 'The all-rounder. Accurate when still.' },
  { id: 'dmr', kind: 'weapon', name: 'Longshot DMR', price: 4200, desc: 'One-shot headshot threat. Right-click to scope.' },
  { id: 'frag', kind: 'grenade', name: 'Frag Grenade', price: 300, desc: 'Blast damage in a 6 m radius. Key G.' },
  { id: 'smoke', kind: 'grenade', name: 'Smoke Grenade', price: 300, desc: 'Blocks sight for 12 s. Key G cycles type.' },
  { id: 'kevlar', kind: 'gear', name: 'Kevlar Vest', price: 650, desc: 'Halves damage taken this round.' },
  { id: 'kit', kind: 'gear', name: 'Defuse Kit', price: 400, desc: 'Defenders only: defuse in 2.5 s instead of 5 s.' },
];

export function createWeapons(camera, fx, audio) {
  const gripMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x111318), roughness: 0.6, metalness: 0.4 });
  const accentMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.45, metalness: 0.2 });

  // One view model per weapon, built once and swapped on equip.
  const models = {};
  function buildModel(id) {
    const g = new THREE.Group();
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    if (id === 'pistol') {
      add(new THREE.BoxGeometry(0.06, 0.09, 0.3), bodyMat, 0, 0, -0.1);
      add(new THREE.BoxGeometry(0.05, 0.12, 0.09), gripMat, 0, -0.09, 0.05);
      add(new THREE.BoxGeometry(0.02, 0.02, 0.06), accentMat, 0, 0.055, -0.2);
    } else if (id === 'smg') {
      add(new THREE.BoxGeometry(0.08, 0.09, 0.4), bodyMat, 0, 0, -0.1);
      add(new THREE.BoxGeometry(0.04, 0.04, 0.3), darkMat, 0, 0.02, -0.38);
      add(new THREE.BoxGeometry(0.06, 0.14, 0.08), gripMat, 0, -0.1, 0.04);
      add(new THREE.BoxGeometry(0.05, 0.1, 0.06), gripMat, 0, -0.06, -0.22);
    } else if (id === 'shotgun') {
      add(new THREE.BoxGeometry(0.09, 0.1, 0.42), darkMat, 0, 0, -0.08);
      add(new THREE.BoxGeometry(0.055, 0.055, 0.42), bodyMat, 0, 0.045, -0.3);
      add(new THREE.BoxGeometry(0.07, 0.09, 0.2), gripMat, 0, -0.02, 0.26);
      add(new THREE.BoxGeometry(0.06, 0.02, 0.3), accentMat, 0, 0.06, -0.2);
    } else if (id === 'dmr') {
      add(new THREE.BoxGeometry(0.08, 0.1, 0.5), bodyMat, 0, 0, -0.12);
      add(new THREE.BoxGeometry(0.05, 0.05, 0.5), darkMat, 0, 0.03, -0.45);
      add(new THREE.BoxGeometry(0.06, 0.06, 0.16), darkMat, 0, 0.08, -0.1);
      add(new THREE.BoxGeometry(0.07, 0.09, 0.22), gripMat, 0, -0.02, 0.28);
    } else { // rifle
      add(new THREE.BoxGeometry(0.09, 0.1, 0.44), bodyMat, 0, 0, -0.1);
      add(new THREE.BoxGeometry(0.045, 0.045, 0.4), gripMat, 0, 0.025, -0.38);
      add(new THREE.BoxGeometry(0.075, 0.08, 0.22), gripMat, 0, -0.02, 0.3);
      add(new THREE.BoxGeometry(0.05, 0.05, 0.12), darkMat, 0, 0.07, -0.12);
      add(new THREE.BoxGeometry(0.03, 0.02, 0.2), accentMat, 0, 0.055, -0.28);
    }
    g.position.set(0.24, -0.2, -0.42);
    g.visible = false;
    camera.add(g);
    return g;
  }
  for (const id of Object.keys(WEAPONS)) models[id] = buildModel(id);

  // Muzzle glow: a soft radial blob, not a card. A plain plane reads as a
  // floating rectangle whenever the frame freezes with the flash still up.
  const flashCanvas = document.createElement('canvas');
  flashCanvas.width = 64;
  flashCanvas.height = 64;
  const flashCtx = flashCanvas.getContext('2d');
  const flashGrad = flashCtx.createRadialGradient(32, 32, 1, 32, 32, 30);
  flashGrad.addColorStop(0, 'rgba(255,255,255,1)');
  flashGrad.addColorStop(0.35, 'rgba(255,220,150,0.85)');
  flashGrad.addColorStop(1, 'rgba(255,180,80,0)');
  flashCtx.fillStyle = flashGrad;
  flashCtx.fillRect(0, 0, 64, 64);
  const flashTexture = new THREE.CanvasTexture(flashCanvas);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshBasicMaterial({ map: flashTexture, color: new THREE.Color(PALETTE.lamp), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  );
  flash.position.set(0.24, -0.17, -0.72);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.lamp), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const state = { current: null, kick: 0, flash: 0, bobPhase: 0, scoped: false };
  const baseFov = camera.fov;

  function equip(entity, id) {
    const def = WEAPONS[id] || WEAPONS.pistol;
    entity.gun = { id: def.id, mag: def.mag, reserve: def.reserve, cooldown: 0, reloadLeft: 0, bloom: 0 };
    if (entity.isPlayer) {
      if (state.current) models[state.current].visible = false;
      state.current = def.id;
      models[def.id].visible = true;
      state.kick = 0;
      state.flash = 0;
    }
    return def;
  }

  function step(dt, speed) {
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    if (state.current) {
      const model = models[state.current];
      state.bobPhase += dt * (2 + speed * 1.6);
      const bob = Math.min(1, speed / 5.2) * 0.012;
      model.position.z = -0.42 + state.kick;
      model.position.y = -0.2 + Math.sin(state.bobPhase * 2) * bob;
      model.position.x = 0.24 + Math.cos(state.bobPhase) * bob * 0.6;
      model.rotation.x = state.kick * 2.2;
      const gun = model.userData.gun;
      if (gun && gun.reloadLeft > 0) {
        const def = WEAPONS[gun.id];
        model.rotation.x = -0.55 * Math.min(1, ((def.reload - gun.reloadLeft) / def.reload) * 2);
      }
    }
    flash.visible = state.flash > 0;
    if (state.flash > 0) flash.rotation.z = state.flash * 2;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
  }

  // Per-entity gun timers (bots and player share these; view-model anim is player's).
  function stepGun(entity, dt) {
    const gun = entity.gun;
    if (!gun) return;
    gun.cooldown = Math.max(0, gun.cooldown - dt);
    gun.bloom = Math.max(0, gun.bloom - dt * 0.09);
    if (gun.reloadLeft > 0) {
      gun.reloadLeft = Math.max(0, gun.reloadLeft - dt);
      if (gun.reloadLeft === 0) {
        const def = WEAPONS[gun.id];
        const need = def.mag - gun.mag;
        const take = Math.min(need, gun.reserve);
        gun.mag += take;
        gun.reserve -= take;
        if (entity.isPlayer) audio.reloadEnd();
      }
    }
    if (entity.isPlayer) models[gun.id].userData.gun = gun;
  }

  function ready(entity) {
    const gun = entity.gun;
    return !!gun && gun.mag > 0 && gun.cooldown === 0 && gun.reloadLeft === 0;
  }

  function takeRound(entity) {
    const gun = entity.gun;
    if (!gun || gun.mag <= 0) return false;
    gun.mag -= 1;
    return true;
  }

  function pullTrigger(entity) {
    const gun = entity.gun;
    const def = WEAPONS[gun.id];
    gun.cooldown = def.gap;
    gun.bloom = Math.min(0.05, gun.bloom + (def.id === 'rifle' ? 0.006 : def.id === 'smg' ? 0.004 : 0.002));
    if (entity.isPlayer) {
      state.flash = 0.06;
      state.kick = def.kick * 4;
    }
  }

  function reload(entity) {
    const gun = entity.gun;
    if (!gun) return;
    const def = WEAPONS[gun.id];
    if (gun.reloadLeft > 0 || gun.mag === def.mag || gun.reserve === 0) return;
    gun.reloadLeft = def.reload;
    if (entity.isPlayer) audio.reloadStart();
  }

  function spreadFor(entity, speed, airborne, crouching, walking) {
    const gun = entity.gun;
    const def = WEAPONS[gun.id];
    let spread = def.spreadStill;
    spread += Math.min(1, speed / 5.2) * def.spreadMove;
    if (airborne) spread += def.spreadAir;
    if (crouching) spread *= 0.7;
    if (walking) spread *= 0.8;
    if (state.scoped && entity.isPlayer) spread *= 0.45;
    return spread + gun.bloom;
  }

  function setScope(on) {
    if (state.scoped === on) return;
    state.scoped = on;
    const def = state.current ? WEAPONS[state.current] : null;
    const target = on && def && def.zoom > 1 ? baseFov / def.zoom : baseFov;
    camera.fov = target;
    camera.updateProjectionMatrix();
    if (state.current) models[state.current].visible = !on;
  }

  function damageFor(id, part) {
    const def = WEAPONS[id];
    return part === 'head' ? Math.round(def.damage * def.headMult) : def.damage;
  }

  return {
    state,
    models,
    equip,
    step,
    stepGun,
    ready,
    takeRound,
    pullTrigger,
    reload,
    spreadFor,
    setScope,
    damageFor,
    def(id) { return WEAPONS[id]; },
  };
}
