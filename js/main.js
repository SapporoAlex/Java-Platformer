import { loadImages } from './assets.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { Sfx } from './audio.js';
import { MusicPlayer } from './music.js';
import { LEVELS } from './levels-data.js';
import { LEVEL_INTRO_SECONDS } from './constants.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('game-canvas');
const touchControls = document.getElementById('touch-controls');
const pauseButton = document.getElementById('pause-button');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnJump = document.getElementById('btn-jump');
const btnAttack = document.getElementById('btn-attack');
const btnUp = document.getElementById('btn-up');

const screens = {
  start: document.getElementById('start-screen'),
  levelintro: document.getElementById('levelintro-screen'),
  gameover: document.getElementById('gameover-screen'),
  levelcomplete: document.getElementById('levelcomplete-screen'),
  shop: document.getElementById('shop-screen'),
  gamecomplete: document.getElementById('gamecomplete-screen'),
  paused: document.getElementById('paused-screen'),
};

const startButton = document.getElementById('start-button');
const restartGameButton = document.getElementById('restart-game-button');
const gameoverMenuButton = document.getElementById('gameover-menu-button');
const continueButton = document.getElementById('continue-button');
const completeMenuButton = document.getElementById('complete-menu-button');
const gameoverReason = document.getElementById('gameover-reason');
const levelCompleteMessage = document.getElementById('levelcomplete-message');

const introLivesLostEl = document.getElementById('intro-lives-lost');
const introLevelNumberEl = document.getElementById('intro-level-number');
const introLevelNameEl = document.getElementById('intro-level-name');
const introHealthFillEl = document.getElementById('intro-health-fill');
const introLivesCountEl = document.getElementById('intro-lives-count');

const shopPanel = document.getElementById('shop-panel');
const shopTitle = document.getElementById('shop-title');
const shopGoldEl = document.getElementById('shop-gold');
const shopItemsEl = document.getElementById('shop-items');
const shopExitButton = document.getElementById('shop-exit-button');

const gamecompleteMenuButton = document.getElementById('gamecomplete-menu-button');
const finalScoreEl = document.getElementById('final-score');
const finalGoldEl = document.getElementById('final-gold');

const resumeButton = document.getElementById('resume-button');
const pausedMenuButton = document.getElementById('paused-menu-button');

function showScreen(name) {
  for (const key of Object.keys(screens)) {
    screens[key].classList.toggle('hidden', key !== name);
  }
}

function renderShopScreen(game) {
  const shop = game.currentShop();
  if (!shop) return;

  shopPanel.style.setProperty('--shop-from', shop.theme.from);
  shopPanel.style.setProperty('--shop-to', shop.theme.to);
  shopPanel.style.setProperty('--shop-accent', shop.theme.accent);
  shopTitle.textContent = shop.name;
  shopGoldEl.textContent = game.gold;

  shopItemsEl.innerHTML = '';
  for (const item of shop.items) {
    const row = document.createElement('div');
    row.className = 'shop-item';

    const info = document.createElement('div');
    info.className = 'shop-item-info';
    info.innerHTML = `<div class="name">${item.label} - ${item.cost}g</div><div class="desc">${item.description}</div>`;

    const owned = item.oneTime && game.purchasedOneTimeItems.has(item.id);
    const buyButton = document.createElement('button');
    buyButton.className = 'buy-btn';
    buyButton.textContent = owned ? 'Owned' : 'Buy';
    buyButton.disabled = owned || game.gold < item.cost;
    buyButton.addEventListener('click', () => {
      game.buyItem(item.id);
      renderShopScreen(game); // refresh gold + afford-state after purchase
    });

    row.append(info, buyButton);
    shopItemsEl.appendChild(row);
  }
}

// Populates and (re)starts the black level-intro screen: level number/name,
// lives, life-lost message, and a health bar that visually fills from
// wherever it was (introFromHealth/introFromMax) up to full over the same
// duration the game auto-advances after (LEVEL_INTRO_SECONDS).
function renderLevelIntroScreen(game) {
  const levelData = LEVELS[game.levelIndex];
  introLevelNumberEl.textContent = `Level ${game.levelIndex + 1}`;
  introLevelNameEl.textContent = levelData.name;
  introLivesLostEl.classList.toggle('hidden', !game.introRespawn);
  introLivesCountEl.textContent = `Lives: ${game.lives}`;

  const fromPct = Math.max(0, Math.min(100, (game.introFromHealth / game.introFromMax) * 100));
  introHealthFillEl.style.transition = 'none';
  introHealthFillEl.style.width = `${fromPct}%`;
  void introHealthFillEl.offsetWidth; // force reflow so the transition below starts from fromPct, not 100%
  introHealthFillEl.style.transition = `width ${LEVEL_INTRO_SECONDS}s linear`;
  requestAnimationFrame(() => {
    introHealthFillEl.style.width = '100%';
  });
}

// Fills the viewport with the stage (2400x1800 internally, see CANVAS_WIDTH/
// CANVAS_HEIGHT in constants.js - same 4:3 ratio as the original 800x600, just
// a higher internal render resolution) at the largest size that keeps its
// aspect ratio - a plain CSS aspect-ratio box only adapts to whichever
// dimension is unconstrained, but on a short landscape phone screen it's the
// *height* that's tight, so this has to be computed in JS.
function fitStage() {
  const targetRatio = 4 / 3;
  const availW = window.innerWidth;
  const availH = window.innerHeight;
  let w = availW;
  let h = w / targetRatio;
  if (h > availH) {
    h = availH;
    w = h * targetRatio;
  }
  stage.style.width = `${w}px`;
  stage.style.height = `${h}px`;
}

// Touch buttons feed the same Input the keyboard does, via simulateDown/Up,
// so gameplay code never needs to know which input source is active.
function bindHoldButton(el, code, input) {
  const press = (e) => {
    e.preventDefault();
    el.classList.add('pressed');
    input.simulateDown(code);
  };
  const release = (e) => {
    e.preventDefault();
    el.classList.remove('pressed');
    input.simulateUp(code);
  };
  el.addEventListener('touchstart', press, { passive: false });
  el.addEventListener('touchend', release);
  el.addEventListener('touchcancel', release);
  el.addEventListener('mousedown', press);
  el.addEventListener('mouseup', release);
  el.addEventListener('mouseleave', release);
}

async function boot() {
  startButton.disabled = true;
  startButton.textContent = 'Loading...';
  const images = await loadImages();
  startButton.disabled = false;
  startButton.textContent = 'Start Game';

  const sfx = new Sfx();
  const music = new MusicPlayer();
  const game = new Game(canvas, images, sfx, music);
  const input = new Input(window);
  window.game = game; // handy for console debugging
  let lastState = 'start';

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  document.body.classList.toggle('is-touch', isTouchDevice);
  fitStage();
  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', fitStage);

  bindHoldButton(btnLeft, 'ArrowLeft', input);
  bindHoldButton(btnRight, 'ArrowRight', input);
  bindHoldButton(btnJump, 'KeyA', input);
  bindHoldButton(btnAttack, 'Space', input);
  bindHoldButton(btnUp, 'ArrowUp', input);

  // Audio can't play at all until some real user gesture happens - the Start
  // button covers the common case, but this also unlocks (and starts title
  // music) on the very first tap/click/keypress anywhere, in case that
  // happens before Start is pressed.
  const unlockAudio = () => { sfx.unlock(); music.unlock(); };
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
  music.playTitle();

  startButton.addEventListener('click', () => {
    unlockAudio();
    game.startNewGame();
  });
  restartGameButton.addEventListener('click', () => {
    game.startNewGame();
  });
  gameoverMenuButton.addEventListener('click', () => {
    game.state = 'start';
  });
  continueButton.addEventListener('click', () => {
    game.advanceToNextLevel();
  });
  completeMenuButton.addEventListener('click', () => {
    game.state = 'start';
  });
  shopExitButton.addEventListener('click', () => {
    game.exitShop();
  });
  gamecompleteMenuButton.addEventListener('click', () => {
    game.state = 'start';
  });
  pauseButton.addEventListener('click', () => {
    game.pause();
  });
  resumeButton.addEventListener('click', () => {
    game.resume();
  });
  pausedMenuButton.addEventListener('click', () => {
    game.state = 'start';
  });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && !e.repeat) game.togglePause();
  });

  function syncScreenToState() {
    if (game.state === lastState) return;
    lastState = game.state;
    showScreen(game.state === 'playing' ? null : game.state);

    if (game.state === 'start') {
      music.playTitle();
    }
    if (game.state === 'levelintro') {
      renderLevelIntroScreen(game);
    }
    if (game.state === 'gameover') {
      const died = game.player.health <= 0;
      gameoverReason.textContent = died
        ? 'You ran out of health, and used up all your lives.'
        : 'You fell off the level, and used up all your lives.';
    }
    if (game.state === 'levelcomplete') {
      const hasNext = game.hasNextLevel();
      continueButton.classList.toggle('hidden', !hasNext);
      levelCompleteMessage.textContent = hasNext
        ? `${LEVELS[game.levelIndex].name} cleared!`
        : `${LEVELS[game.levelIndex].name} cleared! More levels coming soon.`;
    }
    if (game.state === 'shop') {
      renderShopScreen(game);
    }
    if (game.state === 'gamecomplete') {
      finalScoreEl.textContent = game.finalScore();
      finalGoldEl.textContent = game.totalGoldEarned;
      music.playVictory();
    }
  }

  function tick() {
    game.update(input);
    game.render();
    syncScreenToState();
    pauseButton.classList.toggle('hidden', game.state !== 'playing');
    if (isTouchDevice) {
      touchControls.classList.toggle('hidden', game.state !== 'playing');
      btnUp.classList.toggle('hidden', !game.activeDoor);
    }
    input.endFrame();
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

boot().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#f88;padding:20px;">Failed to load game assets:\n${err.message}</pre>`;
});

// Registering this is what makes the game installable as a PWA (alongside
// manifest.webmanifest) - it also lets the app shell load without a network
// round-trip once it's been opened once.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.error('SW registration failed:', err));
  });
}
