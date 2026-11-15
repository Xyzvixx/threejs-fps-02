// The DOM HUD: crosshair, health, ammo, timer, score, money, kill feed, buy menu and
// overlays. It never touches the simulation; main.js pushes numbers in and reads the
// play / buy / restart callbacks out. All updates are diffed so the DOM is only
// written when a value actually changes.
import { BUY_ITEMS, WEAPONS } from './weapons.js';

export function createHud(S, callbacks) {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const overlayTitle = $('overlay-title');
  const overlayCopy = $('overlay-copy');
  const overlayStats = $('overlay-stats');
  const playBtn = $('play');
  const crosshair = $('crosshair');
  const hitmarker = $('hitmarker');
  const healthFill = $('health-fill');
  const healthNum = $('health-num');
  const armorChip = $('armor-chip');
  const ammoMag = $('ammo-mag');
  const ammoReserve = $('ammo-reserve');
  const weaponName = $('weapon-name');
  const grenadeInfo = $('grenade-info');
  const timerEl = $('timer');
  const scoreEl = $('score');
  const roundEl = $('round-label');
  const moneyEl = $('money');
  const aliveEmb = $('alive-emb');
  const aliveAsh = $('alive-ash');
  const feedEl = $('feed');
  const objectiveEl = $('objective');
  const plantWrap = $('plant-wrap');
  const plantLabel = $('plant-label');
  const plantFill = $('plant-fill');
  const buyMenu = $('buy-menu');
  const buyGrid = $('buy-grid');
  const buyMoney = $('buy-money');
  const buyClose = $('buy-close');
  const toastEl = $('toast');
  const vignette = $('damage-vignette');
  const siteA = $('site-a');
  const siteB = $('site-b');

  let last = {};
  let hitTimer = 0;
  let toastTimer = 0;
  let feedRendered = '';

  function setText(el, key, value) {
    if (last[key] === value) return;
    last[key] = value;
    el.textContent = value;
  }

  const COPY = {
    start: {
      title: 'EMBERLINE — Foundry District',
      copy: 'Round-based tactical FPS. Plant the charge at Site A or B, or eliminate the Ash crew. First to 5 rounds takes the match. Click to play.',
      action: 'Click to play',
    },
    paused: {
      title: 'Paused',
      copy: 'Pointer released. Click to resume the round.',
      action: 'Click to resume',
    },
    roundEnd: {
      title: 'Round over',
      copy: '',
      action: 'Next round',
    },
    matchEnd: {
      title: 'Match over',
      copy: '',
      action: 'Play again',
    },
  };

  // Buy menu buttons, built once from BUY_ITEMS (defuse kit is defenders-only).
  const buyButtons = [];
  for (const item of BUY_ITEMS) {
    if (item.id === 'kit') continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'buy-item';
    btn.dataset.item = item.id;
    btn.innerHTML = `<b></b><span class="buy-price"></span><span class="buy-desc"></span>`;
    btn.querySelector('b').textContent = item.name;
    btn.querySelector('.buy-price').textContent = `$${item.price}`;
    btn.querySelector('.buy-desc').textContent = item.desc;
    btn.addEventListener('click', () => callbacks.onBuy(item.id));
    buyGrid.appendChild(btn);
    buyButtons.push({ item, btn });
  }
  buyClose.addEventListener('click', () => callbacks.onBuyClose());

  function refreshBuy() {
    setText(buyMoney, 'buyMoney', `$${S.money}`);
    setText($('buy-round'), 'buyRound', String(S.round));
    for (const { item, btn } of buyButtons) {
      const owned = item.kind === 'weapon' && S.player && S.player.owned && S.player.owned[item.id];
      const maxed = item.kind === 'grenade' && S.player && S.player.grenades[item.id] >= 2;
      const kevlar = item.id === 'kevlar' && S.player && S.player.armor;
      const afford = S.money >= item.price;
      btn.disabled = !afford || !!owned || !!maxed || !!kevlar;
      btn.classList.toggle('owned', !!owned || !!maxed || !!kevlar);
      btn.querySelector('.buy-price').textContent = owned ? 'OWNED' : maxed ? 'MAX' : kevlar ? 'WORN' : `$${item.price}`;
    }
  }

  function showBuy(open) {
    buyMenu.hidden = !open;
    if (open) refreshBuy();
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 1800);
  }

  function hitMarker(kill) {
    hitmarker.classList.add('on');
    hitmarker.classList.toggle('kill', !!kill);
    clearTimeout(hitTimer);
    hitTimer = setTimeout(() => hitmarker.classList.remove('on', 'kill'), 110);
  }

  function damageFlash() {
    vignette.classList.add('on');
    setTimeout(() => vignette.classList.remove('on'), 180);
  }

  function showOverlay(mode, data = {}) {
    const text = COPY[mode];
    overlayTitle.textContent = text.title;
    if (mode === 'roundEnd') {
      overlayCopy.textContent = `${data.winner === 'emb' ? 'EMBER' : 'ASH'} takes round ${S.round} — ${data.reason}. Score ${S.score.emb}–${S.score.ash}.`;
      overlayStats.textContent = '';
      playBtn.textContent = 'Continue';
    } else if (mode === 'matchEnd') {
      const won = S.score.emb > S.score.ash;
      const draw = S.score.emb === S.score.ash;
      overlayCopy.textContent = draw
        ? `A 4–4 draw. Nobody takes the Foundry tonight.`
        : `${won ? 'EMBER wins the match' : 'ASH wins the match'} ${S.score.emb}–${S.score.ash}.`;
      const acc = S.stats.shots ? Math.round((S.stats.hits / S.stats.shots) * 100) : 0;
      overlayStats.textContent = `Kills ${S.stats.kills} · Deaths ${S.stats.deaths} · Accuracy ${acc}% · Damage ${S.stats.damage}`;
      playBtn.textContent = text.action;
    } else {
      overlayCopy.textContent = text.copy;
      overlayStats.textContent = '';
      playBtn.textContent = text.action;
    }
    overlay.hidden = false;
    playBtn.focus();
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function renderFeed() {
    const text = S.feed.map((f) => f.text).join('\n');
    if (text === feedRendered) return;
    feedRendered = text;
    feedEl.textContent = text;
  }

  function bearingArrow(dx, dz, yaw) {
    // Relative bearing of a world offset from the player's facing.
    const worldAngle = Math.atan2(-dx, -dz);
    let rel = worldAngle - yaw;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    if (rel > -0.6 && rel < 0.6) return '▲';
    if (rel >= 0.6 && rel < 1.8) return '▶';
    if (rel <= -0.6 && rel > -1.8) return '◀';
    return '▼';
  }

  function update(player) {
    if (!player) return;
    const gun = player.gun || { mag: 0, reserve: 0, id: 'pistol' };
    const def = WEAPONS[gun.id] || WEAPONS.pistol;
    setText(ammoMag, 'mag', String(gun.mag));
    setText(ammoReserve, 'res', `/ ${gun.reserve}`);
    setText(weaponName, 'wname', def.name);
    setText(grenadeInfo, 'gren', `G: ${player.grenades.frag} frag · ${player.grenades.smoke} smoke`);
    setText(healthNum, 'hp', String(Math.max(0, Math.ceil(player.hp))));
    const hpPct = Math.max(0, Math.min(100, player.hp));
    if (last.hpPct !== hpPct) {
      last.hpPct = hpPct;
      healthFill.style.width = `${hpPct}%`;
      healthFill.classList.toggle('low', hpPct <= 30);
    }
    armorChip.hidden = !player.armor;

    const t = Math.max(0, Math.ceil(S.timer));
    const mm = String(Math.floor(t / 60)).padStart(1, '0');
    const ss = String(t % 60).padStart(2, '0');
    setText(timerEl, 'timer', S.phase === 'buy' ? `BUY ${Math.max(0, Math.ceil(S.buyTimer))}` : `${mm}:${ss}`);
    timerEl.classList.toggle('urgent', S.phase === 'live' && t <= 15);
    setText(scoreEl, 'score', `${S.score.emb} — ${S.score.ash}`);
    setText(roundEl, 'round', `ROUND ${S.round} / 9`);
    setText(moneyEl, 'money', `$${S.money}`);
    const embAlive = S.entities.filter((e) => e.team === 'emb' && e.alive).length;
    const ashAlive = S.entities.filter((e) => e.team === 'ash' && e.alive).length;
    setText(aliveEmb, 'aEmb', `EMBER ${embAlive}`);
    setText(aliveAsh, 'aAsh', `ASH ${ashAlive}`);

    const plant = S.plant;
    if (plant.status === 'planted' || plant.status === 'defusing') {
      plantWrap.hidden = false;
      setText(plantLabel, 'plabel', plant.status === 'defusing' ? `DEFUSING — SITE ${plant.site}` : `CHARGE LIVE — SITE ${plant.site} — ${Math.ceil(plant.fuse)}s`);
      const pct = plant.status === 'defusing' ? plant.progress * 100 : (plant.fuse / 40) * 100;
      if (last.plantPct !== Math.round(pct)) {
        last.plantPct = Math.round(pct);
        plantFill.style.width = `${pct}%`;
      }
    } else if (plant.status === 'planting') {
      plantWrap.hidden = false;
      setText(plantLabel, 'plabel', `PLANTING — SITE ${plant.site}`);
      if (last.plantPct !== Math.round(plant.progress * 100)) {
        last.plantPct = Math.round(plant.progress * 100);
        plantFill.style.width = `${plant.progress * 100}%`;
      }
    } else {
      plantWrap.hidden = true;
    }

    if (S.phase === 'buy') {
      setText(objectiveEl, 'obj', 'BUY PHASE — spend your money, then the round starts');
    } else if (plant.status === 'planted') {
      setText(objectiveEl, 'obj', `Charge planted at Site ${plant.site} — protect it`);
    } else if (plant.status === 'defusing') {
      setText(objectiveEl, 'obj', 'The charge is being defused — stop them');
    } else {
      setText(objectiveEl, 'obj', 'Plant the charge at Site A or B — or eliminate the Ash crew');
    }

    // Site distance + direction chips.
    const sites = [[siteA, 'A', -15, -11], [siteB, 'B', 15, -11]];
    for (const [el, key, x, z] of sites) {
      const dx = x - player.pos.x;
      const dz = z - player.pos.z;
      const d = Math.round(Math.hypot(dx, dz));
      setText(el, `site${key}`, `${bearingArrow(dx, dz, player.yaw)} ${key} ${d}m`);
    }

    renderFeed();
    if (S.buyOpen) refreshBuy();
  }

  function setCrosshairSpread(px) {
    const v = Math.round(px * 10) / 10;
    if (last.spread === v) return;
    last.spread = v;
    crosshair.style.setProperty('--gap', `${v}px`);
  }

  function setScoped(on) {
    crosshair.classList.toggle('scoped', !!on);
  }

  playBtn.addEventListener('click', () => callbacks.onPlay());

  return {
    update,
    showOverlay,
    hideOverlay,
    showBuy,
    refreshBuy,
    toast,
    hitMarker,
    damageFlash,
    setCrosshairSpread,
    setScoped,
    buyItems: buyButtons.map((b) => b.item),
  };
}
