// Round flow, economy and the plant/defuse objective. The player is always on the
// Ember (attacker) crew; the Ash crew defends. First to 5 round wins takes the match
// (max 9 rounds; 4-4 is a draw). Money: win +$3250, loss +$1900 (+$500 per straight
// loss, capped at $3400); a kill pays +$300 (paid by combat.js).
import * as THREE from 'three';
import { BUY_ITEMS, WEAPONS } from './weapons.js';

const ROUND_TIME = 100;
const BUY_TIME = 15;
const PLANT_TIME = 3;
const DEFUSE_TIME = 5;
const DEFUSE_KIT_TIME = 2.5;
const FUSE_TIME = 40;
const WIN_BONUS = 3250;
const LOSS_BONUS = 1900;
const LOSS_STREAK_BONUS = 500;
const LOSS_BONUS_CAP = 3400;
const WIN_SCORE = 5;
const MAX_ROUNDS = 9;

export function createRounds(S, deps) {
  const { world, combat, bots, weapons, audio, fx } = deps;
  let roundEndTimer = 0;
  let roundWinner = null;
  let roundReason = '';
  let lastBeepSecond = -1;
  const tmp = new THREE.Vector3();

  function playerAlive() {
    return S.player && S.player.alive;
  }

  function inSite(entity, siteKey) {
    const site = world.sites[siteKey];
    tmp.copy(entity.pos);
    tmp.y = 0;
    const dx = tmp.x - site.center.x;
    const dz = tmp.z - site.center.z;
    return dx * dx + dz * dz <= site.radius * site.radius;
  }

  function startMatch() {
    S.resetMatch();
    // resetMatch clears the entity list; the player entity persists across
    // matches, so restore it before anything spawns or registers hit meshes.
    S.player = deps.player;
    S.entities.push(deps.player);
    S.phase = 'buy';
    S.buyTimer = BUY_TIME;
    startBuyPhase();
  }

  function startBuyPhase() {
    // Losing a round costs the player their bought primary; winning keeps it.
    const p = S.player;
    if (p) {
      if (roundWinner && roundWinner !== 'emb') {
        p.primary = 'pistol';
        p.owned = { pistol: true };
        p.grenades = { frag: 0, smoke: 0 };
        p.armor = false;
        p.hasKit = false;
      }
      if (p.primary && p.primary !== 'pistol') weapons.equip(p, p.primary);
      else weapons.equip(p, 'pistol');
    }
    bots.spawnRound();
    combat.resetRound();
    S.resetRound();
    S.phase = 'buy';
    S.buyTimer = BUY_TIME;
    S.buyOpen = true;
    S.logEvent('buy_phase', { round: S.round });
  }

  function startRound() {
    S.phase = 'live';
    S.buyOpen = false;
    S.timer = ROUND_TIME;
    S.logEvent('round_start', { round: S.round });
  }

  function awardMoney(winner) {
    if (winner === 'emb') {
      S.money += WIN_BONUS;
      S.lossStreak = 0;
      S.stats.roundsWon += 1;
    } else {
      const bonus = Math.min(LOSS_BONUS + S.lossStreak * LOSS_STREAK_BONUS, LOSS_BONUS_CAP);
      S.money += bonus;
      S.lossStreak += 1;
    }
  }

  function endRound(winner, reason) {
    if (S.phase !== 'live') return;
    roundWinner = winner;
    roundReason = reason;
    S.score[winner] += 1;
    awardMoney(winner);
    S.phase = 'roundEnd';
    roundEndTimer = 4;
    audio.roundWin(winner === 'emb');
    const names = { elimination: 'Enemy team eliminated', detonation: 'Charge detonated', defused: 'Charge defused', timeout: 'Time expired — site held' };
    S.addFeed(`${winner === 'emb' ? 'EMBER' : 'ASH'} wins the round — ${names[reason] || reason}`, 'round');
    S.logEvent('round_end', { round: S.round, winner, reason, score: { ...S.score } });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function endMatch() {
    S.phase = 'matchEnd';
    S.logEvent('match_end', { score: { ...S.score } });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function checkMatchEnd() {
    if (S.score.emb >= WIN_SCORE || S.score.ash >= WIN_SCORE || S.round >= MAX_ROUNDS) {
      endMatch();
      return true;
    }
    return false;
  }

  function nextRound() {
    S.round += 1;
    if (checkMatchEnd()) return;
    startBuyPhase();
  }

  function aliveCount(team) {
    return combat.aliveOf(team);
  }

  function findPlanter() {
    // Player planting: alive, Ember, inside a site, holding E.
    const p = S.player;
    if (p && p.alive && p.team === 'emb' && deps.input.state.keys.has('KeyE')) {
      if (inSite(p, 'A')) return { entity: p, site: 'A' };
      if (inSite(p, 'B')) return { entity: p, site: 'B' };
    }
    // Bot carrier planting: intent set by bots.js when in site with no visible enemy.
    for (const e of S.entities) {
      if (!e.isBot || !e.alive || e.team !== 'emb' || !e.carryingCharge) continue;
      if (e.bot && e.bot.intent === 'plant') {
        if (inSite(e, 'A')) return { entity: e, site: 'A' };
        if (inSite(e, 'B')) return { entity: e, site: 'B' };
      }
    }
    return null;
  }

  function findDefuser() {
    const p = S.player;
    // The player is an attacker and never defuses; defenders are all bots.
    for (const e of S.entities) {
      if (!e.isBot || !e.alive || e.team !== 'ash') continue;
      if (e.bot && e.bot.intent === 'defuse' && S.plant.site && inSite(e, S.plant.site)) {
        return e;
      }
    }
    return null;
  }

  function updatePlant(dt) {
    const plant = S.plant;
    if (plant.status === 'none' || plant.status === 'planting') {
      const found = findPlanter();
      if (!found) {
        if (plant.status === 'planting') {
          plant.status = 'none';
          plant.site = null;
          plant.progress = 0;
          plant.planter = null;
        }
        return;
      }
      if (plant.status === 'none') {
        plant.status = 'planting';
        plant.site = found.site;
        plant.planter = found.entity;
        plant.progress = 0;
        lastBeepSecond = -1;
      }
      plant.progress += dt / PLANT_TIME;
      const second = Math.floor(plant.progress * PLANT_TIME);
      if (second !== lastBeepSecond) {
        lastBeepSecond = second;
        audio.plantBeep(false);
      }
      if (plant.progress >= 1) {
        plant.status = 'planted';
        plant.fuse = FUSE_TIME;
        plant.progress = 0;
        audio.plantBeep(true);
        S.addFeed(`Charge planted at Site ${plant.site} — 40 s fuse`, 'objective');
        S.logEvent('planted', { site: plant.site, by: plant.planter ? plant.planter.id : null });
      }
      return;
    }
    if (plant.status === 'planted') {
      plant.fuse -= dt;
      // The fuse decides the round: expiry beats a defuse attempt, so check
      // it before looking for a defuser (a camper must not stall the round).
      if (plant.fuse <= 0) {
        plant.status = 'detonated';
        const site = world.sites[plant.site];
        tmp.set(site.center.x, 1, site.center.z);
        fx.explosionFx(tmp);
        audio.explosion();
        endRound('emb', 'detonation');
        return;
      }
      const second = Math.ceil(plant.fuse);
      if (second !== lastBeepSecond) {
        lastBeepSecond = second;
        if (second <= 10) audio.plantBeep(false);
      }
      const defuser = findDefuser();
      if (defuser) {
        plant.status = 'defusing';
        plant.defuser = defuser;
        plant.progress = 0;
      }
      return;
    }
    if (plant.status === 'defusing') {
      // The fuse keeps burning while someone defuses: it is a race.
      plant.fuse -= dt;
      if (plant.fuse <= 0) {
        plant.status = 'detonated';
        const site = world.sites[plant.site];
        tmp.set(site.center.x, 1, site.center.z);
        fx.explosionFx(tmp);
        audio.explosion();
        endRound('emb', 'detonation');
        return;
      }
      const defuser = plant.defuser;
      const stillThere = defuser && defuser.alive && S.plant.site && inSite(defuser, S.plant.site)
        && defuser.bot && defuser.bot.intent === 'defuse';
      if (!stillThere) {
        plant.status = 'planted';
        plant.defuser = null;
        plant.progress = 0;
        return;
      }
      const time = defuser.hasKit ? DEFUSE_KIT_TIME : DEFUSE_TIME;
      plant.progress += dt / time;
      const second = Math.floor(plant.progress * time);
      if (second !== lastBeepSecond) {
        lastBeepSecond = second;
        audio.defuseBeep();
      }
      if (plant.progress >= 1) {
        plant.status = 'defused';
        S.addFeed('Charge defused — site held', 'objective');
        S.logEvent('defused', { by: defuser.id });
        endRound('ash', 'defused');
      }
    }
  }

  function update(dt) {
    if (S.phase === 'buy') {
      S.buyTimer -= dt;
      if (S.buyTimer <= 0) startRound();
      return;
    }
    if (S.phase === 'live') {
      S.timer -= dt;
      updatePlant(dt);
      if (S.phase !== 'live') return; // plant/defuse may have ended the round
      const embAlive = aliveCount('emb');
      const ashAlive = aliveCount('ash');
      if (ashAlive === 0) {
        endRound('emb', 'elimination');
        return;
      }
      if (embAlive === 0) {
        // If the charge is planted the round plays out to the fuse.
        if (S.plant.status === 'planted' || S.plant.status === 'defusing') return;
        endRound('ash', 'elimination');
        return;
      }
      if (S.timer <= 0) {
        if (S.plant.status === 'planted' || S.plant.status === 'defusing') return; // fuse decides
        S.timer = 0;
        endRound('ash', 'timeout');
      }
      return;
    }
    if (S.phase === 'roundEnd') {
      roundEndTimer -= dt;
      if (roundEndTimer <= 0) nextRound();
    }
  }

  function buyItem(id) {
    if (S.phase !== 'buy') return { ok: false, reason: 'Buy phase is over' };
    const item = BUY_ITEMS.find((b) => b.id === id);
    if (!item) return { ok: false, reason: 'Unknown item' };
    if (item.id === 'kit') return { ok: false, reason: 'Defuse kits are for defenders' };
    if (S.money < item.price) return { ok: false, reason: 'Not enough money' };
    const p = S.player;
    if (item.kind === 'weapon') {
      if (p.owned && p.owned[item.id]) return { ok: false, reason: 'Already owned' };
      S.money -= item.price;
      p.owned = p.owned || { pistol: true };
      p.owned[item.id] = true;
      p.primary = item.id;
      weapons.equip(p, item.id);
    } else if (item.kind === 'grenade') {
      if (p.grenades[item.id] >= 2) return { ok: false, reason: 'Carrying the maximum' };
      S.money -= item.price;
      p.grenades[item.id] += 1;
    } else if (item.id === 'kevlar') {
      if (p.armor) return { ok: false, reason: 'Already wearing kevlar' };
      S.money -= item.price;
      p.armor = true;
    }
    audio.buySound();
    S.logEvent('buy', { item: item.id, money: S.money });
    return { ok: true };
  }

  function onEntityDeath(target) {
    // Elimination is checked in update(); this hook exists for future use and tests.
    void target;
  }

  return {
    startMatch,
    startBuyPhase,
    startRound,
    update,
    buyItem,
    onEntityDeath,
    inSite,
    roundWinner: () => roundWinner,
    roundReason: () => roundReason,
    constants: { ROUND_TIME, BUY_TIME, WIN_SCORE, MAX_ROUNDS },
  };
}
