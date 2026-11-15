import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createEntity } from './combat.js';
import { findPath, segmentBlocked } from './world.js';
import { WEAPONS } from './weapons.js';

const BOT_NAMES = {
  emb: ['Vex', 'Marlow', 'Kite', 'Sable'],
  ash: ['Rook', 'Bramble', 'Fenn', 'Onyx', 'Wren']
};

const BOT_LEVELS = {
  emb: ['veteran', 'regular', 'regular', 'rookie'],
  ash: ['veteran', 'regular', 'regular', 'rookie', 'regular']
};

const LEVEL_SPEED = { veteran: 4.3, regular: 3.9, rookie: 3.4 };
const LEVEL_ERROR = { veteran: 0.7, regular: 1, rookie: 1.5 };
const LEVEL_REACTION = { veteran: 0.25, regular: 0.4, rookie: 0.6 };

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3();
const EYE = new THREE.Vector3();
const CHEST = new THREE.Vector3();
const DIR = new THREE.Vector3();
const OFFSET = new THREE.Vector3();
const MOVE = new THREE.Vector3();
const PROBE_MIN = new THREE.Vector3();
const PROBE_MAX = new THREE.Vector3();
const PROBE = new THREE.Box3();
const SITE_MID = new THREE.Vector3();
const CARRIER_POS = new THREE.Vector3();
const TMP_POS = new THREE.Vector3();

export function createBots(scene, S, world, combat, weapons) {
  const bots = [];
  const siteNodes = { A: -1, B: -1, mid: -1 };

  function eyePosOf(entity, out) {
    return out.copy(entity.pos).add(UP.clone().set(0, combat.eyeHeight, 0));
  }

  function chestPosOf(entity, out) {
    return out.copy(entity.pos).add(UP.clone().set(0, 1.1, 0));
  }

  function nearestWaypoint(pos) {
    let nearest = -1;
    let nearestDistance = Infinity;
    for (let i = 0; i < world.waypoints.length; i += 1) {
      const distance = pos.distanceToSquared(world.waypoints[i].pos);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = i;
      }
    }
    return nearest;
  }

  function nearestSiteNode(site) {
    return world.sites[site] ? nearestWaypoint(world.sites[site].center) : -1;
  }

  function refreshSiteNodes() {
    siteNodes.A = nearestSiteNode('A');
    siteNodes.B = nearestSiteNode('B');
    if (world.sites.A && world.sites.B) {
      SITE_MID.copy(world.sites.A.center).add(world.sites.B.center).multiplyScalar(0.5);
      siteNodes.mid = nearestWaypoint(SITE_MID);
    }
  }

  function teamColour(team) {
    const value = PALETTE[team];
    if (typeof value === 'string' || typeof value === 'number') return value;
    if (value && typeof value === 'object') {
      if (value.color !== undefined) return value.color;
      if (value.main !== undefined) return value.main;
    }
    return team === 'emb' ? '#ff7a1a' : '#2fb8a6';
  }

  function makeNameSprite(name, team) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = 'bold 34px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 6;
    context.strokeStyle = 'rgba(10, 14, 18, 0.9)';
    context.strokeText(name, 128, 33);
    context.fillStyle = teamColour(team);
    context.fillText(name, 128, 33);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(0, 2.05, 0);
    sprite.scale.set(1.7, 0.42, 1);
    return sprite;
  }

  function removeAll() {
    for (const bot of bots) {
      if (bot.group) scene.remove(bot.group);
      const sprite = bot.bot && bot.bot.nameSprite;
      if (sprite) {
        if (sprite.material.map) sprite.material.map.dispose();
        sprite.material.dispose();
      }
    }
    bots.length = 0;
    S.entities = S.entities.filter((entity) => !entity.isBot);
    combat.unregisterAll();
    for (const entity of S.entities) combat.registerEntity(entity);
  }

  function roleFor(team, index) {
    if (team === 'emb') return index === 2 ? 'mid' : index % 2 === 0 ? 'A' : 'B';
    return index % 2 === 0 ? 'A' : 'B';
  }

  function weaponFor(team, level, name, round) {
    if (round <= 1) return 'pistol';
    if (team === 'ash' && name === 'Rook' && round >= 3) return 'dmr';
    return level === 'rookie' ? 'smg' : 'rifle';
  }

  function spawnRound() {
    removeAll();
    refreshSiteNodes();

    const round = S.round || 1;
    const attackerGrenadeIndices = new Set();
    while (attackerGrenadeIndices.size < 2) {
      attackerGrenadeIndices.add(Math.floor(S.rng() * BOT_NAMES.emb.length));
    }
    const defenderGrenadeIndex = Math.floor(S.rng() * BOT_NAMES.ash.length);

    for (const team of ['emb', 'ash']) {
      const names = BOT_NAMES[team];
      for (let i = 0; i < names.length; i += 1) {
        const name = names[i];
        const level = BOT_LEVELS[team][i];
        const spawn = world.spawns[team][team === 'emb' ? i + 1 : i];
        const entity = createEntity(scene, {
          name,
          team,
          isPlayer: false,
          isBot: true,
          pos: spawn.clone()
        });

        entity.name = name;
        entity.team = team;
        entity.isPlayer = false;
        entity.isBot = true;
        entity.alive = true;
        entity.pos.copy(spawn);
        entity.speed = 0;
        entity.hasKit = team === 'ash' && name === 'Bramble';
        entity.carryingCharge = team === 'emb' && name === 'Vex';
        entity.grenades = team === 'emb'
          ? (attackerGrenadeIndices.has(i) ? { frag: 1, smoke: 0 } : { frag: 0, smoke: 0 })
          : (i === defenderGrenadeIndex ? { frag: 0, smoke: 1 } : { frag: 0, smoke: 0 });

        weapons.equip(entity, weaponFor(team, level, name, round));
        if (entity.group) {
          entity.group.position.copy(entity.pos);
          scene.add(entity.group);
        }

        entity.bot = {
          skill: level === 'veteran' ? 1 : level === 'regular' ? 0.65 : 0.35,
          level,
          state: 'advance',
          path: [],
          pathIdx: 0,
          dest: -1,
          target: null,
          reactAt: 0,
          burstLeft: 0,
          burstTimer: 0,
          aimErr: 0,
          holdUntil: 0,
          strafe: 1,
          strafeTimer: 0,
          heardAt: 0,
          heardPos: new THREE.Vector3(),
          role: roleFor(team, i),
          lastEventIdx: 0,
          nameSprite: null,
          intent: null,
          planting: false,
          yawWander: 0
        };

        if (entity.group) {
          entity.bot.nameSprite = makeNameSprite(name, team);
          entity.group.add(entity.bot.nameSprite);
        }

        bots.push(entity);
        S.entities.push(entity);
        combat.registerEntity(entity);
      }
    }

    const carrier = bots.find((bot) => bot.team === 'emb' && bot.carryingCharge && bot.alive);
    if (!carrier) {
      const firstAttacker = bots.find((bot) => bot.team === 'emb' && bot.alive);
      if (firstAttacker) firstAttacker.carryingCharge = true;
    }
  }

  function hasLineOfSight(a, b) {
    return combat.losClear(a, b);
  }

  function eventPosition(event) {
    if (!event) return null;
    if (event.pos || event.position) return event.pos || event.position;
    if (event.data && (event.data.pos || event.data.position)) return event.data.pos || event.data.position;
    // combat.js logs shots as flat {x, z} — rebuild a temp vector for those.
    if (typeof event.x === 'number' && typeof event.z === 'number') {
      TMP_POS.set(event.x, 0, event.z);
      return TMP_POS;
    }
    return null;
  }

  function hearEvents(bot) {
    const events = S.events || [];
    for (let i = bot.bot.lastEventIdx; i < events.length; i += 1) {
      const event = events[i];
      const eventType = event && (event.type || event.kind);
      const eventTeam = event && (event.team || (event.data && event.data.team));
      const position = eventPosition(event);
      if (
        eventType === 'shot' &&
        eventTeam !== bot.team &&
        position &&
        position.distanceToSquared(bot.pos) <= 625
      ) {
        bot.bot.heardPos.copy(position);
        bot.bot.heardAt = S.time;
      }
    }
    bot.bot.lastEventIdx = events.length;
  }

  function perceive(bot) {
    const memory = bot.bot;
    memory.target = null;
    let nearestDistance = Infinity;

    FORWARD.set(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw));
    eyePosOf(bot, EYE);

    for (const enemy of S.entities) {
      if (!enemy.alive || enemy.team === bot.team) continue;
      const distanceSq = bot.pos.distanceToSquared(enemy.pos);
      if (distanceSq >= 48 * 48) continue;

      chestPosOf(enemy, CHEST);
      DIR.subVectors(CHEST, EYE);
      const distance = Math.sqrt(distanceSq);
      if (distance >= 6) {
        DIR.normalize();
        if (FORWARD.dot(DIR) <= Math.cos(1.9)) continue;
      }
      if (!hasLineOfSight(EYE, CHEST)) continue;
      if (distanceSq < nearestDistance) {
        nearestDistance = distanceSq;
        memory.target = enemy;
      }
    }

    if (memory.target) {
      if (memory.target !== memory.previousTarget) {
        memory.reactAt = S.time + LEVEL_REACTION[memory.level];
        memory.previousTarget = memory.target;
        memory.burstLeft = 0;
        memory.holdUntil = 0;
      }
      memory.state = 'engage';
    } else {
      memory.previousTarget = null;
      hearEvents(bot);
    }
  }

  function setPath(bot, dest) {
    const memory = bot.bot;
    if (dest < 0 || dest >= world.waypoints.length) {
      memory.path.length = 0;
      memory.pathIdx = 0;
      memory.dest = dest;
      return;
    }

    const start = nearestWaypoint(bot.pos);
    memory.path = start >= 0 ? (findPath(world.waypoints, start, dest) || []) : [];
    memory.pathIdx = 0;
    memory.dest = dest;
    if (memory.path.length && memory.path[0] === start) memory.pathIdx = 1;
  }

  function destinationFor(bot) {
    const memory = bot.bot;
    if (bot.team === 'emb') {
      if (memory.role === 'A') return siteNodes.A;
      if (memory.role === 'B') return siteNodes.B;
      return siteNodes.mid;
    }
    if (S.plant && S.plant.status === 'planted') {
      return siteNodes[S.plant.site] ?? siteNodes.A;
    }
    if (memory.heardAt > 0 && S.time - memory.heardAt < 8) {
      return nearestWaypoint(memory.heardPos);
    }
    return siteNodes[memory.role] ?? siteNodes.A;
  }

  function currentSite(bot) {
    if (bot.team === 'ash' && S.plant && S.plant.status === 'planted') {
      return S.plant.site === 'B' ? 'B' : 'A';
    }
    if (bot.bot.role === 'B') return 'B';
    if (bot.bot.role === 'A') return 'A';
    if (!world.sites.A || !world.sites.B) return 'A';
    return bot.pos.distanceToSquared(world.sites.A.center) <= bot.pos.distanceToSquared(world.sites.B.center) ? 'A' : 'B';
  }

  function insideSite(bot, siteKey) {
    const site = world.sites[siteKey];
    if (!site) return false;
    const radius = site.radius || 0;
    return bot.pos.distanceToSquared(site.center) <= radius * radius;
  }

  function updateIntent(bot) {
    const memory = bot.bot;
    memory.intent = null;
    memory.planting = false;
    if (memory.target) return;

    if (bot.team === 'emb' && bot.carryingCharge) {
      const siteKey = currentSite(bot);
      if (insideSite(bot, siteKey)) {
        memory.intent = 'plant';
        memory.planting = true;
        memory.state = 'hold';
      }
    } else if (
      bot.team === 'ash' &&
      S.plant &&
      S.plant.status === 'planted' &&
      insideSite(bot, S.plant.site === 'B' ? 'B' : 'A')
    ) {
      memory.intent = 'defuse';
      memory.state = 'hold';
    }
  }

  function tryMove(bot, dx, dz) {
    if (dx === 0 && dz === 0) return false;
    const x = bot.pos.x;
    const z = bot.pos.z;
    const y = bot.pos.y;
    const radius = 0.34;
    const height = 1.72;

    function blockedAt(px, pz) {
      PROBE_MIN.set(px - radius, y, pz - radius);
      PROBE_MAX.set(px + radius, y + height, pz + radius);
      PROBE.set(PROBE_MIN, PROBE_MAX);
      for (const collider of world.colliders) {
        if (collider.intersectsBox(PROBE)) return true;
      }
      return false;
    }

    if (!blockedAt(x + dx, z + dz)) {
      bot.pos.x = x + dx;
      bot.pos.z = z + dz;
      return true;
    }
    if (!blockedAt(x + dx, z)) {
      bot.pos.x = x + dx;
      return true;
    }
    if (!blockedAt(x, z + dz)) {
      bot.pos.z = z + dz;
      return true;
    }
    return false;
  }

  function moveToward(bot, target, speed, dt) {
    DIR.set(target.x - bot.pos.x, 0, target.z - bot.pos.z);
    const distance = DIR.length();
    if (distance < 0.001) return 0;
    DIR.multiplyScalar(1 / distance);
    const amount = Math.min(distance, speed * dt);
    MOVE.set(DIR.x * amount, 0, DIR.z * amount);
    tryMove(bot, MOVE.x, MOVE.z);
    return amount / Math.max(dt, 0.0001);
  }

  function moveAlongPath(bot, dt, speed) {
    const memory = bot.bot;
    const destination = destinationFor(bot);
    if (destination !== memory.dest) setPath(bot, destination);

    while (memory.pathIdx < memory.path.length) {
      const waypointIndex = memory.path[memory.pathIdx];
      const waypoint = typeof waypointIndex === 'number'
        ? world.waypoints[waypointIndex]
        : waypointIndex;
      if (!waypoint || !waypoint.pos) {
        memory.pathIdx += 1;
        continue;
      }
      if (bot.pos.distanceToSquared(waypoint.pos) <= 0.81) {
        memory.pathIdx += 1;
        continue;
      }
      return moveToward(bot, waypoint.pos, speed, dt);
    }

    if (destination >= 0 && world.waypoints[destination]) {
      const target = world.waypoints[destination].pos;
      if (bot.pos.distanceToSquared(target) > 0.81) return moveToward(bot, target, speed, dt);
    }
    return 0;
  }

  function strafe(bot, dt) {
    const memory = bot.bot;
    memory.strafeTimer -= dt;
    if (memory.strafeTimer <= 0) {
      memory.strafe *= -1;
      memory.strafeTimer = 0.7 + S.rng() * 0.7;
    }
    FORWARD.set(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw));
    const dx = FORWARD.z * memory.strafe * 1.6 * dt;
    const dz = -FORWARD.x * memory.strafe * 1.6 * dt;
    tryMove(bot, dx, dz);
    return 1.6;
  }

  function fireAt(bot, target, dt) {
    const memory = bot.bot;
    memory.burstTimer -= dt;
    if (!memory.burstLeft && S.time >= memory.holdUntil && S.time >= memory.reactAt) {
      memory.burstLeft = 3 + Math.floor(S.rng() * 3);
      memory.burstTimer = 0;
    }
    if (!memory.burstLeft || memory.burstTimer > 0 || !weapons.ready(bot)) return;

    eyePosOf(bot, EYE);
    chestPosOf(target, CHEST);
    DIR.subVectors(CHEST, EYE).normalize();

    const targetSpeed = target.speed || 0;
    const distance = EYE.distanceTo(CHEST);
    const errMag = (0.012 + distance * 0.0009 + targetSpeed * 0.004) * LEVEL_ERROR[memory.level];
    OFFSET.set(
      (S.rng() * 2 - 1) * errMag,
      (S.rng() * 2 - 1) * errMag,
      (S.rng() * 2 - 1) * errMag
    );
    DIR.add(OFFSET).normalize();

    const airborne = bot.fall > 0;
    const spread = weapons.spreadFor(bot, bot.speed, airborne, false, bot.speed > 0.1);
    combat.shoot(bot, EYE, DIR, spread);

    memory.burstLeft -= 1;
    memory.burstTimer = 0.11;
    if (memory.burstLeft <= 0) memory.holdUntil = S.time + 0.5 + S.rng() * 0.4;
  }

  function faceDirection(bot, dx, dz) {
    if (dx * dx + dz * dz < 0.0001) return;
    bot.yaw = Math.atan2(-dx, -dz);
    if (bot.group) bot.group.rotation.y = bot.yaw;
  }

  function step(dt) {
    if (S.phase !== 'live') return;

    for (const bot of bots) {
      if (!bot.alive) continue;
      weapons.stepGun(bot, dt);
      perceive(bot);

      const memory = bot.bot;
      updateIntent(bot);

      let horizontalSpeed = 0;
      if (memory.target) {
        chestPosOf(memory.target, CHEST);
        DIR.set(CHEST.x - bot.pos.x, 0, CHEST.z - bot.pos.z);
        const targetDist = DIR.length();
        const targetYaw = Math.atan2(-DIR.x, -DIR.z);
        faceDirection(bot, DIR.x, DIR.z);
        fireAt(bot, memory.target, dt);
        if (bot.team === 'emb' && targetDist > 20 && !memory.intent) {
          // Attackers keep pushing toward the site while trading fire instead
          // of duelling across the whole map from spawn; moving hurts accuracy.
          const speed = LEVEL_SPEED[memory.level];
          horizontalSpeed = moveAlongPath(bot, dt, speed);
          bot.yaw = targetYaw;
          if (bot.group) bot.group.rotation.y = bot.yaw;
        } else {
          horizontalSpeed = strafe(bot, dt);
        }
      } else if (memory.intent) {
        memory.state = 'hold';
        if (memory.planting) {
          const site = world.sites[currentSite(bot)];
          if (site) {
            DIR.set(site.center.x - bot.pos.x, 0, site.center.z - bot.pos.z);
            faceDirection(bot, DIR.x, DIR.z);
          }
        }
        memory.yawWander += dt;
        if (memory.yawWander > 1.4) {
          memory.yawWander = 0;
          bot.yaw += (S.rng() - 0.5) * 0.7;
        }
      } else if (bot.team === 'ash' && !(memory.heardAt > 0 && S.time - memory.heardAt < 8)) {
        memory.state = 'hold';
        const site = world.sites[memory.role === 'B' ? 'B' : 'A'];
        if (site) {
          DIR.set(site.center.x - bot.pos.x, 0, site.center.z - bot.pos.z);
          faceDirection(bot, DIR.x, DIR.z);
        }
        memory.yawWander += dt;
        if (memory.yawWander > 1.4) {
          memory.yawWander = 0;
          bot.yaw += (S.rng() - 0.5) * 0.7;
        }
      } else {
        memory.state = 'advance';
        const speed = LEVEL_SPEED[memory.level];
        const oldX = bot.pos.x;
        const oldZ = bot.pos.z;
        horizontalSpeed = moveAlongPath(bot, dt, speed);
        faceDirection(bot, bot.pos.x - oldX, bot.pos.z - oldZ);
      }

      if (bot.gun.mag === 0 || (bot.gun.mag < 30 && !memory.target)) {
        weapons.reload(bot);
      }

      bot.speed = horizontalSpeed;
      if (bot.group) {
        bot.group.position.copy(bot.pos);
        bot.group.rotation.y = bot.yaw;
      }
    }

    recoverCarrier();
  }

  function recoverCarrier() {
    let hasLivingCarrier = false;
    let deadCarrier = null;
    for (const bot of bots) {
      if (bot.team !== 'emb' || !bot.carryingCharge) continue;
      if (bot.alive) hasLivingCarrier = true;
      else deadCarrier = bot;
    }
    if (hasLivingCarrier || !deadCarrier) return;

    CARRIER_POS.copy(deadCarrier.pos);
    let nearest = null;
    let nearestDistance = Infinity;
    for (const bot of bots) {
      if (bot.team !== 'emb' || !bot.alive) continue;
      const distance = bot.pos.distanceToSquared(CARRIER_POS);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = bot;
      }
    }
    if (!nearest) return;
    deadCarrier.carryingCharge = false;
    nearest.carryingCharge = true;
    S.logEvent('charge_carrier', { id: nearest.id });
  }

  function carrier() {
    for (const bot of bots) {
      if (bot.team === 'emb' && bot.alive && bot.carryingCharge) return bot;
    }
    return null;
  }

  return { spawnRound, step, removeAll, carrier };
}