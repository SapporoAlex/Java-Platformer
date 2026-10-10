import {
  isPlaceholder, mirror, tint, fadeTop, seamless, drawCoinFrames, drawFireball, drawDoor, drawLantern,
} from './art.js';
import { IDLE_FRAME_COUNT, VICTORY_FRAME_COUNT, VICTORY_VARIANT_COUNT } from './constants.js';

// Every image file the game can use, keyed by name. Filenames are fixed (see
// README.md): replacing art means overwriting the file at its path. A file
// that is missing, or is still a flat labeled placeholder box, is detected at
// load time and the game falls back to stand-in art instead (see buildArt()).
const A = 'assets/';

export const ASSET_PATHS = {
  bgParallax: `${A}bg_parallax.png`,

  playerJumpLeft: `${A}player_jump_left.png`,
  playerJumpRight: `${A}player_jump_right.png`,

  // Haunted-lantern turret ("fire enemy") and its projectile.
  fireEnemyIdleLeft: `${A}fire_enemy_idle_left.png`,
  fireEnemyIdleRight: `${A}fire_enemy_idle_right.png`,
  fireEnemyCastLeft1: `${A}fire_enemy_cast_left1.png`,
  fireEnemyCastLeft2: `${A}fire_enemy_cast_left2.png`,
  fireEnemyCastRight1: `${A}fire_enemy_cast_right1.png`,
  fireEnemyCastRight2: `${A}fire_enemy_cast_right2.png`,
  fireball: `${A}fireball.png`,

  // Flying enemy: the yurei (ghost) painting. Single image, faces right.
  ghost: `${A}Suushi_Yurei-removebg-preview.png`,
  // Stand-in boss art (used while the boss_* files are placeholders): the
  // armored warrior painting. Single image, faces left.
  samurai: `${A}images__3_-removebg-preview.png`,

  doorExit: `${A}door_exit.png`,
  doorShop: `${A}door_shop.png`,
};

function addNumbered(key, file, count) {
  for (let i = 1; i <= count; i++) ASSET_PATHS[`${key}${i}`] = `${A}${file}${i}.png`;
}

for (let i = 1; i <= 10; i++) ASSET_PATHS[`tile${i}`] = `${A}${i}.png`;
for (const [dir, d] of [['Left', 'left'], ['Right', 'right']]) {
  addNumbered(`playerIdle${dir}`, `player_idle_${d}`, IDLE_FRAME_COUNT);
  addNumbered(`playerMove${dir}`, `player_move_${d}`, 2);
  addNumbered(`playerFight${dir}`, `player_fight_${d}`, 3);
  addNumbered(`spiderWalk${dir}`, `spider_walk_${d}`, 3);
  for (let v = 1; v <= VICTORY_VARIANT_COUNT; v++) {
    addNumbered(`playerVictory${v}${dir}`, `player_victory${v}_${d}`, VICTORY_FRAME_COUNT);
  }
}
for (let i = 1; i <= 4; i++) ASSET_PATHS[`gold${i}`] = `${A}gold${i}.png`;

export const BOSS_PREFIXES = ['boss', 'boss2', 'boss3'];
for (const prefix of BOSS_PREFIXES) {
  for (const [dir, d] of [['Left', 'left'], ['Right', 'right']]) {
    ASSET_PATHS[`${prefix}Stand${dir}`] = `${A}${prefix}_stand_${d}.png`;
    ASSET_PATHS[`${prefix}Jump${dir}`] = `${A}${prefix}_jump_${d}.png`;
    addNumbered(`${prefix}Move${dir}`, `${prefix}_move_${d}`, 2);
    addNumbered(`${prefix}Attack${dir}`, `${prefix}_attack_${d}`, 3);
    addNumbered(`${prefix}Death${dir}`, `${prefix}_death_${d}`, 6);
  }
}

// Big art that isn't needed until later (the post-boss victory animations)
// loads in the background after the game has started - see loadDeferred().
const isDeferred = (key) => key.startsWith('playerVictory');

// Missing files resolve to null instead of failing the whole game.
export function loadImages(onProgress, deferred = false) {
  const keys = Object.keys(ASSET_PATHS).filter((k) => isDeferred(k) === deferred);
  let done = 0;
  const images = {};
  return Promise.all(keys.map((key) => new Promise((resolve) => {
    const img = new Image();
    const finish = (ok) => {
      images[key] = ok ? img : null;
      if (!ok) console.warn(`Missing asset, using stand-in: ${ASSET_PATHS[key]}`);
      done++;
      onProgress?.(done, keys.length);
      resolve();
    };
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = ASSET_PATHS[key];
  }))).then(() => images);
}

// ---------------------------------------------------------------------------
// Animation sets
//
// buildArt() turns the flat image map into { right: [frames], left: [frames] }
// pairs per animation. A missing/placeholder left frame is the mirrored
// right one (and vice versa), so a character only strictly needs one facing.
// ---------------------------------------------------------------------------

const usable = (img) => img && !isPlaceholder(img);

function sameArt(a, b) {
  if (!a || !b) return false;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 16;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(a, 0, 0, 16, 16);
  ctx.drawImage(b, 16, 0, 16, 16);
  const { data } = ctx.getImageData(0, 0, 32, 16);
  let diff = 0;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const i = (y * 32 + x) * 4;
      const j = i + 64;
      diff += Math.abs(data[i] - data[j]) + Math.abs(data[i + 3] - data[j + 3]);
    }
  }
  return diff / 256 < 6;
}

// `nativeFacing` says which way the painting faces when only one side is
// usable, or when the "left" and "right" files are identical copies.
function facingPair(rightFrames, leftFrames, nativeFacing = 'right') {
  const right = rightFrames.filter(usable);
  const left = leftFrames.filter(usable);
  if (right.length && left.length && !sameArt(right[0], left[0])) return { right, left };
  const base = right.length ? right : left;
  if (!base.length) return null;
  const native = base;
  const flipped = base.map(mirror);
  return nativeFacing === 'right'
    ? { right: native, left: flipped }
    : { right: flipped, left: native };
}

function numbered(images, key, count) {
  return Array.from({ length: count }, (_, i) => images[`${key}${i + 1}`]);
}

function single(img, nativeFacing) {
  if (!usable(img)) return null;
  return facingPair([img], [], nativeFacing);
}

function bossSet(images, prefix, index) {
  const set = (name, count) => (count
    ? facingPair(numbered(images, `${prefix}${name}Right`, count), numbered(images, `${prefix}${name}Left`, count))
    : facingPair([images[`${prefix}${name}Right`]], [images[`${prefix}${name}Left`]]));
  const own = {
    stand: set('Stand'),
    move: set('Move', 2),
    jump: set('Jump'),
    attack: set('Attack', 3),
    death: set('Death', 6),
  };
  if (own.stand) {
    for (const k of Object.keys(own)) own[k] ??= own.stand;
    return { ...own, procedural: false };
  }
  // Stand-in: the warrior painting, recolored per fight.
  const palette = ['#c8a070', '#8a5cd6', '#d23a2a'][index] ?? '#c8a070';
  const base = images.samurai ? tint(images.samurai, palette, index === 0 ? 0.15 : 0.45) : null;
  const pose = base ? facingPair([], [base], 'left') : null;
  return {
    stand: pose, move: pose, jump: pose, attack: pose, death: pose, procedural: true,
  };
}

// Loads the deferred images, then fills them into an already-built `art`.
export function loadDeferred(images, art) {
  return loadImages(null, true).then((more) => {
    Object.assign(images, more);
    art.player.victory = buildVictory(images, art.player.idle);
  });
}

function buildVictory(images, fallback) {
  return Array.from({ length: VICTORY_VARIANT_COUNT }, (_, v) => facingPair(
    numbered(images, `playerVictory${v + 1}Right`, VICTORY_FRAME_COUNT),
    numbered(images, `playerVictory${v + 1}Left`, VICTORY_FRAME_COUNT),
  ) ?? fallback);
}

export function buildArt(images) {
  const art = {};

  const idle = facingPair(numbered(images, 'playerIdleRight', IDLE_FRAME_COUNT), numbered(images, 'playerIdleLeft', IDLE_FRAME_COUNT));
  const run = facingPair(numbered(images, 'playerMoveRight', 2), numbered(images, 'playerMoveLeft', 2)) ?? idle;
  art.player = {
    idle,
    run,
    jump: facingPair([images.playerJumpRight], [images.playerJumpLeft]) ?? idle,
    attack: facingPair(numbered(images, 'playerFightRight', 3), numbered(images, 'playerFightLeft', 3)) ?? idle,
    victory: buildVictory(images, idle),
  };

  art.oni = {
    walk: facingPair(numbered(images, 'spiderWalkRight', 3), numbered(images, 'spiderWalkLeft', 3), 'left'),
  };
  art.ghost = { fly: single(images.ghost, 'right') };

  const lanternIdle = facingPair([images.fireEnemyIdleRight], [images.fireEnemyIdleLeft]);
  const lanternCast = facingPair(
    [images.fireEnemyCastRight1, images.fireEnemyCastRight2],
    [images.fireEnemyCastLeft1, images.fireEnemyCastLeft2],
  );
  art.lantern = lanternIdle && lanternCast
    ? { idle: lanternIdle, windup: { right: [lanternCast.right[0]], left: [lanternCast.left[0]] }, cast: lanternCast }
    : {
      idle: single(drawLantern('idle'), 'right'),
      windup: single(drawLantern('windup'), 'right'),
      cast: single(drawLantern('cast'), 'right'),
    };

  art.boss = {};
  BOSS_PREFIXES.forEach((prefix, i) => { art.boss[prefix] = bossSet(images, prefix, i); });

  const goldFrames = numbered(images, 'gold', 4);
  art.coin = goldFrames.every(usable) ? goldFrames : drawCoinFrames();
  art.fireball = usable(images.fireball) ? images.fireball : drawFireball();
  art.doorExit = usable(images.doorExit) ? images.doorExit : drawDoor('exit');
  art.doorShop = usable(images.doorShop) ? images.doorShop : drawDoor('shop');

  art.tiles = {};
  for (let i = 1; i <= 10; i++) art.tiles[i] = images[`tile${i}`];

  art.backdrop = images.bgParallax ? seamless(fadeTop(images.bgParallax, 0.45)) : null;
  return art;
}
