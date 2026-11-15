// Combat: hitscan shooting, damage, deaths, grenades. Entities are built here so the
// player and the bots share one body layout (torso + head hit meshes, team colours).
// Headshots deal multiplied damage; armour halves damage taken.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { WEAPONS } from './weapons.js';
import { segmentBlocked } from './world.js';

const EYE_HEIGHT = 1.5;
const BODY_HEIGHT = 1.72;

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _to = new THREE.Vector3();
const _hitPoint = new THREE.Vector3();

export function createEntity(scene, opts) {
  const teamColor = opts.team === 'emb' ? PALETTE.ember : PALETTE.teal;
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(teamColor), roughness: 0.65, metalness: 0.05 });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x23262b), roughness: 0.8 });
  const headMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xd8c9a8), roughness: 0.6 });
  const visorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x111318), roughness: 0.3, metalness: 0.5 });

  const group = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.78, 0.3), bodyMat);
  torso.position.y = 1.0;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), headMat);
  head.position.y = 1.55;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.05), visorMat);
  visor.position.set(0, 1.56, 0.14);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.26), darkMat);
  legs.position.y = 0.31;
  const gunMesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.62), darkMat);
  gunMesh.position.set(0.28, 1.15, -0.2);
  group.add(torso, head, visor, legs, gunMesh);
  group.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  group.visible = !opts.isPlayer; // first person: the player never sees their own body
  scene.add(group);

  const entity = {
    id: opts.id,
    name: opts.name,
    team: opts.team,
    isPlayer: !!opts.isPlayer,
    isBot: !!opts.isBot,
    hp: 100,
    alive: true,
    armor: false,
    pos: opts.pos.clone(),
    yaw: opts.yaw || 0,
    group,
    head,
    torso,
    gun: null,
    kills: 0,
    deaths: 0,
    speed: 0,
    grenades: { frag: 0, smoke: 0 },
    hasKit: false,
    carryingCharge: false,
    fall: 0,
    bot: null,
  };
  torso.userData.entity = entity;
  torso.userData.part = 'torso';
  head.userData.entity = entity;
  head.userData.part = 'head';
  group.position.copy(entity.pos);
  return entity;
}

export function createCombat(scene, S, world, fx, audio, weapons) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 100;
  const grenades = [];
  const hitMeshes = [];
  let onDeath = null;

  function registerEntity(entity) {
    hitMeshes.push(entity.torso, entity.head);
  }

  function unregisterAll() {
    hitMeshes.length = 0;
  }

  function aliveOf(team) {
    let n = 0;
    for (const e of S.entities) if (e.team === team && e.alive) n += 1;
    return n;
  }

  // One hitscan shot. origin/dir are world space; spread is added here.
  function shoot(shooter, origin, dir, spread) {
    const gun = shooter.gun;
    if (!gun) return { fired: false };
    if (!weapons.takeRound(shooter)) {
      if (shooter.isPlayer) audio.dryFire();
      return { fired: false };
    }
    weapons.pullTrigger(shooter);
    const def = WEAPONS[gun.id];
    if (shooter.isPlayer) S.stats.shots += 1;
    // Bots hear shots: log position + team for the AI hearing check.
    S.logEvent('shot', { team: shooter.team, x: origin.x, z: origin.z });

    scene.updateMatrixWorld(true);
    let hitEntity = null;
    let hitPart = null;
    let endPoint = null;
    let wallPoint = null;
    for (let pellet = 0; pellet < def.pellets; pellet += 1) {
      _dir.copy(dir);
      if (spread > 0) {
        _dir.x += (S.rng() * 2 - 1) * spread;
        _dir.y += (S.rng() * 2 - 1) * spread;
        _dir.z += (S.rng() * 2 - 1) * spread;
        _dir.normalize();
      }
      raycaster.set(origin, _dir);
      raycaster.far = def.range;
      const hits = raycaster.intersectObjects(world.shootables.concat(hitMeshes), false);
      const hit = hits.length ? hits[0] : null;
      _to.copy(origin).addScaledVector(_dir, hit ? hit.distance : def.range);
      if (pellet === 0) endPoint = _to.clone();
      if (hit) {
        _hitPoint.copy(hit.point);
        if (hit.object.userData.entity && hit.object.userData.entity !== shooter && hit.object.userData.entity.alive) {
          hitEntity = hit.object.userData.entity;
          hitPart = hit.object.userData.part;
          // Damage falls off with range: close fights are lethal, cross-map
          // peeks are not.
          const falloff = hit.distance < 15 ? 1 : hit.distance < 30 ? 0.85 : hit.distance < 45 ? 0.65 : 0.5;
          const dmg = Math.max(1, Math.round(weapons.damageFor(gun.id, hitPart) * falloff));
          damageEntity(hitEntity, dmg, hitPart, shooter);
          fx.impact(_hitPoint, 'flesh');
        } else if (!hit.object.userData.entity) {
          wallPoint = _hitPoint.clone();
          fx.impact(_hitPoint, 'wall');
        }
      }
    }
    if (endPoint) fx.tracer(origin, endPoint, shooter.team === 'emb' ? 0xffb45e : 0x7fe0d0);
    if (shooter.isPlayer) {
      audio.shot(def.sound, 1);
    } else {
      const dist = origin.distanceTo(S.player ? S.player.pos : origin);
      audio.shot('bot', Math.max(0.08, Math.min(1, 14 / Math.max(4, dist))));
    }
    return { fired: true, hit: !!hitEntity, kill: hitEntity ? !hitEntity.alive : false, target: hitEntity, part: hitPart, wallPoint };
  }

  function damageEntity(target, amount, part, shooter) {
    if (!target.alive) return false;
    let dmg = amount;
    if (target.armor) dmg = Math.round(dmg * 0.5);
    target.hp -= dmg;
    if (shooter && shooter.isPlayer) {
      S.stats.hits += 1;
      S.stats.damage += dmg;
      if (part === 'head') S.stats.headshots += 1;
      audio.hit(target.hp <= 0);
    }
    if (target.isPlayer) audio.hurt();
    if (target.hp > 0) return false;
    target.hp = 0;
    target.alive = false;
    target.deaths += 1;
    target.fall = 0.0001;
    if (shooter) shooter.kills += 1;
    if (shooter && shooter.isPlayer) {
      S.stats.kills += 1;
      S.money += 300;
      S.addFeed(`${shooter.name} ▸ ${target.name}${part === 'head' ? ' (headshot)' : ''}`, 'kill');
      S.logEvent('kill', { killer: shooter.id, victim: target.id, part, weapon: shooter.gun ? shooter.gun.id : null });
    } else if (target.isPlayer) {
      S.stats.deaths += 1;
      S.addFeed(`${shooter ? shooter.name : 'World'} ▸ ${target.name}`, 'death');
      S.logEvent('death', { killer: shooter ? shooter.id : null, victim: target.id });
    } else if (shooter) {
      S.addFeed(`${shooter.name} ▸ ${target.name}`, 'kill');
      S.logEvent('kill', { killer: shooter.id, victim: target.id, part });
    }
    if (target.carryingCharge) {
      target.carryingCharge = false;
      S.logEvent('charge_dropped', { at: { x: target.pos.x, z: target.pos.z } });
    }
    if (onDeath) onDeath(target, shooter);
    return true;
  }

  function throwGrenade(entity, type, origin, dir) {
    if (entity.grenades[type] <= 0) return false;
    entity.grenades[type] -= 1;
    grenades.push({
      type,
      owner: entity,
      pos: origin.clone(),
      vel: new THREE.Vector3(dir.x * 13, dir.y * 13 + 4.5, dir.z * 13),
      fuse: type === 'frag' ? 1.6 : 1.1,
      landed: false,
    });
    audio.grenadeThrow();
    S.logEvent('grenade', { owner: entity.id, type });
    return true;
  }

  function explodeGrenade(g) {
    fx.explosionFx(g.pos);
    audio.explosion();
    S.logEvent('explosion', { x: g.pos.x, z: g.pos.z });
    for (const e of S.entities) {
      if (!e.alive || e === g.owner) continue;
      const d = Math.hypot(e.pos.x - g.pos.x, e.pos.z - g.pos.z, (e.pos.y + 1.0) - g.pos.y);
      if (d > 6) continue;
      if (segmentBlocked(world.colliders, g.pos.x, g.pos.y, g.pos.z, e.pos.x, e.pos.y + 1.0, e.pos.z)) continue;
      const dmg = Math.round(95 * (1 - d / 6.5));
      damageEntity(e, Math.max(12, dmg), 'torso', g.owner);
    }
  }

  function step(dt) {
    // Grenade physics: gravity, floor bounce, simple wall stop.
    for (let i = grenades.length - 1; i >= 0; i -= 1) {
      const g = grenades[i];
      g.vel.y -= 14 * dt;
      g.pos.addScaledVector(g.vel, dt);
      if (g.pos.y < 0.12) {
        g.pos.y = 0.12;
        g.vel.y = Math.abs(g.vel.y) * 0.35;
        g.vel.x *= 0.6;
        g.vel.z *= 0.6;
        g.landed = true;
      }
      if (g.pos.x < -21.5 || g.pos.x > 21.5) g.vel.x *= -0.4;
      if (g.pos.z < -16.5 || g.pos.z > 16.5) g.vel.z *= -0.4;
      g.fuse -= dt;
      if (g.fuse <= 0) {
        if (g.type === 'frag') explodeGrenade(g);
        else {
          fx.smokeAt(g.pos);
          audio.smokeHiss();
          S.logEvent('smoke', { x: g.pos.x, z: g.pos.z });
        }
        grenades.splice(i, 1);
      }
    }
    // Fallen bodies tip over, then lie still until the round resets.
    for (const e of S.entities) {
      if (!e.alive && e.fall > 0 && e.fall < 1) {
        e.fall = Math.min(1, e.fall + dt / 0.4);
        e.group.rotation.x = -e.fall * 1.45;
        e.group.position.y = e.pos.y - e.fall * 0.08;
      }
    }
  }

  function losClear(a, b) {
    if (segmentBlocked(world.colliders, a.x, a.y, a.z, b.x, b.y, b.z)) return false;
    if (fx.smokeBlocks(a, b)) return false;
    return true;
  }

  function resetRound() {
    grenades.length = 0;
    for (const e of S.entities) {
      e.hp = 100;
      e.alive = true;
      e.fall = 0;
      e.group.rotation.set(0, e.yaw, 0);
      e.group.position.copy(e.pos);
    }
  }

  return {
    shoot,
    damageEntity,
    throwGrenade,
    step,
    losClear,
    resetRound,
    registerEntity,
    unregisterAll,
    aliveOf,
    grenades,
    set onDeath(fn) { onDeath = fn; },
    eyeHeight: EYE_HEIGHT,
    bodyHeight: BODY_HEIGHT,
  };
}
