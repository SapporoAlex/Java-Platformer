import { loadImages, loadDeferred, buildArt } from './assets.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { Sfx } from './audio.js';
import { MusicPlayer } from './music.js';
import { outlineOf } from './sprite.js';
import { LEVELS } from './levels-data.js';
import { LEVEL_INTRO_SECONDS, TICKS_PER_SECOND } from './constants.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const canvas = $('game-canvas');
const touchControls = $('touch-controls');
const pauseButton = $('pause-button');
const muteButton = $('mute-button');

const screens = {
  start: $('start-screen'),
  levelintro: $('levelintro-screen'),
  gameover: $('gameover-screen'),
  levelcomplete: $('levelcomplete-screen'),
  shop: $('shop-screen'),
  gamecomplete: $('gamecomplete-screen'),
  paused: $('paused-screen'),
};

const SAVE_KEY = 'monsterland.progress';
const MUTE_KEY = 'monsterland.muted';

function readSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...readSave(), ...data }));
  } catch {
    // storage unavailable (private mode etc.) - progress just won't persist
  }
}

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el.classList.toggle('hidden', key !== name);
}

// Focus the first usable button on a screen so keyboard/gamepad players can
// act on it immediately.
function focusFirst(screenEl) {
  const btn = [...screenEl.querySelectorAll('button')].find((b) => !b.disabled && b.offsetParent !== null);
  btn?.focus({ preventScroll: true });
}

function menuButtons(screenEl) {
  return [...screenEl.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null);
}

function moveFocus(screenEl, delta) {
  const list = menuButtons(screenEl);
  if (!list.length) return;
  const i = list.indexOf(document.activeElement);
  const next = i < 0 ? 0 : (i + delta + list.length) % list.length;
  list[next].focus({ preventScroll: true });
}

// The 1920x1080 canvas is scaled to the largest 16:9 box that fits the window.
function fitStage() {
  const pad = document.body.classList.contains('is-touch') ? 0 : 24;
  const availW = window.innerWidth - pad;
  const availH = window.innerHeight - pad;
  let w = availW;
  let h = (w * 9) / 16;
  if (h > availH) {
    h = availH;
    w = (h * 16) / 9;
  }
  stage.style.width = `${Math.floor(w)}px`;
  stage.style.height = `${Math.floor(h)}px`;
  stage.style.setProperty('--stage-h', `${Math.floor(h)}px`);
}

function bindHoldButton(el, action, input) {
  const press = (e) => {
    e.preventDefault();
    el.classList.add('pressed');
    input.simulateDown(action);
  };
  const release = (e) => {
    e.preventDefault();
    el.classList.remove('pressed');
    input.simulateUp(action);
  };
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('pointerleave', release);
}

function renderShopScreen(game, keepFocusId = null) {
  const shop = game.currentShop();
  if (!shop) return;
  const panel = $('shop-panel');
  panel.style.setProperty('--shop-accent', shop.theme.accent);
  $('shop-title').textContent = shop.name;
  $('shop-greeting').textContent = shop.greeting ?? 'Welcome, traveler.';
  $('shop-gold').textContent = game.gold;
  const p = game.player;
  $('shop-stats').textContent = `♥ ${Math.ceil(p.health)}/${p.maxHealth}   ⚔ ${p.attackStrength}`;

  const list = $('shop-items');
  list.innerHTML = '';
  for (const item of shop.items) {
    const owned = item.oneTime && game.purchasedOneTimeItems.has(item.id);
    const row = document.createElement('div');
    row.className = `shop-item${owned ? ' owned' : ''}`;
    const info = document.createElement('div');
    info.className = 'shop-item-info';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = item.label;
    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = item.description + (item.oneTime ? ' (one per journey)' : '');
    info.append(name, desc);

    const price = document.createElement('span');
    price.className = 'price';
    price.innerHTML = '<span class="coin-icon"></span>';
    price.append(String(item.cost));

    const buy = document.createElement('button');
    buy.className = 'btn';
    buy.id = `buy-${item.id}`;
    buy.textContent = owned ? 'Owned' : 'Buy';
    buy.disabled = owned || game.gold < item.cost;
    buy.addEventListener('click', () => {
      const result = game.buyItem(item.id);
      const msg = $('shop-message');
      const reasons = {
        'not-enough-gold': 'Not enough gold.',
        'already-owned': 'You already own that.',
        'full-health': "You're already at full health.",
      };
      msg.textContent = result.ok ? `Bought ${item.label}!` : reasons[result.reason] ?? '…';
      msg.classList.toggle('ok', result.ok);
      renderShopScreen(game, buy.id);
    });
    row.append(info, price, buy);
    list.appendChild(row);
  }

  const keep = keepFocusId && $(keepFocusId);
  if (keep && !keep.disabled) keep.focus({ preventScroll: true });
  else if (keepFocusId) focusFirst(screens.shop);
}

function renderLevelIntroScreen(game) {
  const levelData = LEVELS[game.levelIndex];
  $('intro-level-number').textContent = `STAGE ${game.levelIndex + 1}`;
  $('intro-level-name').textContent = levelData.name;
  $('intro-lives-lost').classList.toggle('hidden', !game.introRespawn);
  $('intro-lives-count').textContent = `× ${game.lives}`;

  const fill = $('intro-health-fill');
  const fromPct = Math.max(0, Math.min(100, (game.introFromHealth / game.introFromMax) * 100));
  fill.style.transition = 'none';
  fill.style.width = `${fromPct}%`;
  void fill.offsetWidth; // restart the transition from fromPct
  fill.style.transition = `width ${LEVEL_INTRO_SECONDS * 0.8}s ease-out`;
  requestAnimationFrame(() => {
    fill.style.width = '100%';
  });
}

async function boot() {
  const pct = $('loading-pct');
  const images = await loadImages((done, total) => {
    pct.textContent = `${Math.round((done / total) * 100)}%`;
  });
  const art = buildArt(images);
  // Build the outlined copies of every character frame up front, so the
  // first time an enemy appears doesn't hitch.
  const characterSets = [
    art.player.idle, art.player.run, art.player.jump, art.player.attack, art.oni.walk, art.ghost.fly,
    ...Object.values(art.boss).flatMap((b) => [b.stand, b.move, b.jump, b.attack, b.death]),
  ];
  for (const set of characterSets) {
    for (const img of [...(set?.right ?? []), ...(set?.left ?? [])]) outlineOf(img);
  }
  // Don't hold the game hostage to a slow font CDN; the canvas falls back to
  // a system serif until it arrives.
  await Promise.race([
    document.fonts?.load('800 40px "Shippori Mincho B1"').catch(() => {}),
    new Promise((r) => { setTimeout(r, 1500); }),
  ]);
  loadDeferred(images, art);
  $('loading-screen').classList.add('hidden');

  const sfx = new Sfx();
  const music = new MusicPlayer();
  const game = new Game(canvas, images, art, sfx, music);
  const input = new Input(window);
  window.game = game; // handy for console debugging
  window.input = input;

  const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  document.body.classList.toggle('is-touch', isTouch);
  fitStage();
  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', fitStage);

  bindHoldButton($('btn-left'), 'left', input);
  bindHoldButton($('btn-right'), 'right', input);
  bindHoldButton($('btn-jump'), 'jump', input);
  bindHoldButton($('btn-attack'), 'attack', input);
  bindHoldButton($('btn-up'), 'up', input);

  // --- sound ---
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* ignore */ }
  const applyMute = () => {
    sfx.setMuted(muted);
    music.setMuted(muted);
    muteButton.classList.toggle('off', muted);
    muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  };
  const toggleMute = () => {
    muted = !muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
    applyMute();
  };
  applyMute();
  muteButton.addEventListener('click', () => { toggleMute(); muteButton.blur(); });

  const unlockAudio = () => { sfx.unlock(); music.unlock(); };
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
  music.playTitle();

  // --- menu buttons ---
  const updateContinueButton = () => {
    const { level = 0 } = readSave();
    const btn = $('continue-from-button');
    btn.classList.toggle('hidden', level <= 0);
    btn.textContent = `Continue — Stage ${level + 1}`;
  };
  updateContinueButton();

  const toTitle = () => { game.state = 'start'; };
  $('start-button').addEventListener('click', () => { unlockAudio(); game.startNewGame(0); });
  $('continue-from-button').addEventListener('click', () => {
    unlockAudio();
    game.startNewGame(Math.min(readSave().level ?? 0, LEVELS.length - 1));
  });
  $('restart-game-button').addEventListener('click', () => game.startNewGame(0));
  $('gameover-continue-button').addEventListener('click', () => game.continueGame());
  $('gameover-menu-button').addEventListener('click', toTitle);
  $('continue-button').addEventListener('click', () => game.advanceToNextLevel());
  $('complete-menu-button').addEventListener('click', toTitle);
  $('shop-exit-button').addEventListener('click', () => game.exitShop());
  $('gamecomplete-menu-button').addEventListener('click', toTitle);
  pauseButton.addEventListener('click', () => { game.pause(); pauseButton.blur(); });
  $('resume-button').addEventListener('click', () => game.resume());
  $('restart-level-button').addEventListener('click', () => game.enterLevelIntro(game.levelIndex, { respawn: false }));
  $('paused-menu-button').addEventListener('click', toTitle);

  // Menu keyboard navigation (arrows move, Enter/Space/Z/X select, Esc backs out of the shop).
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.repeat) toggleMute();
    if (e.code === 'Backquote') game.showHitboxes = !game.showHitboxes;
    const screenEl = screens[game.state];
    if (!screenEl || game.state === 'levelintro') return;
    if (['ArrowDown', 'ArrowRight', 'KeyS', 'KeyD'].includes(e.code)) {
      e.preventDefault();
      moveFocus(screenEl, 1);
      sfx.play('menu');
    } else if (['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA'].includes(e.code)) {
      e.preventDefault();
      moveFocus(screenEl, -1);
      sfx.play('menu');
    } else if (['KeyZ', 'KeyX', 'KeyJ', 'KeyK'].includes(e.code) && !e.repeat) {
      if (document.activeElement?.tagName === 'BUTTON' && screenEl.contains(document.activeElement)) {
        document.activeElement.click();
      } else {
        focusFirst(screenEl);
      }
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (game.state === 'shop') game.exitShop();
      else if (game.state === 'paused') game.resume();
    }
  });

  // Gamepad equivalents of the above, edge-triggered.
  let prevPad = new Set();
  function pollMenuGamepad() {
    const pad = input.padDown;
    const pressed = (a) => pad.has(a) && !prevPad.has(a);
    const screenEl = screens[game.state];
    if (screenEl && game.state !== 'levelintro') {
      if (pressed('down') || pressed('right')) moveFocus(screenEl, 1);
      if (pressed('up') || pressed('left')) moveFocus(screenEl, -1);
      if (pressed('jump')) {
        if (screenEl.contains(document.activeElement)) document.activeElement.click();
        else focusFirst(screenEl);
      }
      if (pressed('attack') && game.state === 'shop') game.exitShop();
    }
    prevPad = new Set(pad);
  }

  let lastState = null;
  function syncScreenToState() {
    if (game.state === lastState) return;
    const prev = lastState;
    lastState = game.state;
    const overlay = screens[game.state] ? game.state : null;
    showScreen(overlay);
    // Let the browser handle keys normally while a menu has focus.
    input.captureKeys = !overlay || game.state === 'levelintro';
    if (overlay && overlay !== 'levelintro') input.reset();
    if (!overlay) document.activeElement?.blur?.();

    switch (game.state) {
      case 'start':
        updateContinueButton();
        if (prev) music.playTitle();
        break;
      case 'levelintro':
        renderLevelIntroScreen(game);
        writeSave({ level: Math.max(readSave().level ?? 0, game.levelIndex) });
        break;
      case 'gameover':
        $('gameover-reason').textContent = game.deathCause === 'fall'
          ? 'You fell into the abyss with no lives left.'
          : 'The yokai overwhelmed you.';
        break;
      case 'levelcomplete':
        $('levelcomplete-message').textContent = `${LEVELS[game.levelIndex].name} is safe again.`;
        $('stage-gold').textContent = game.levelGold;
        $('stage-kills').textContent = game.levelKills;
        writeSave({ level: Math.max(readSave().level ?? 0, game.levelIndex + 1) });
        break;
      case 'shop':
        $('shop-message').innerHTML = '&nbsp;';
        renderShopScreen(game);
        break;
      case 'gamecomplete':
        $('final-score').textContent = game.finalScore();
        $('final-gold').textContent = game.totalGoldEarned;
        music.playVictory();
        break;
      default:
        break;
    }
    if (overlay && overlay !== 'levelintro') focusFirst(screens[overlay]);
  }

  // Fixed-timestep loop: the simulation always runs at 60 ticks/second
  // regardless of the display's refresh rate; rendering happens once per frame.
  const STEP = 1000 / TICKS_PER_SECOND;
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += Math.min(200, now - last);
    last = now;
    while (acc >= STEP) {
      input.update();
      pollMenuGamepad();
      game.update(input);
      syncScreenToState();
      acc -= STEP;
    }
    game.render();
    const playing = game.state === 'playing';
    pauseButton.classList.toggle('hidden', !playing);
    if (isTouch) {
      touchControls.classList.toggle('hidden', !playing);
      $('btn-up').classList.toggle('hidden', !game.activeDoor);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#f88;padding:20px;">Failed to start the game:\n${err.message}</pre>`;
});

if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.error('SW registration failed:', err));
  });
}
