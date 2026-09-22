// Maps every image the game needs to its file in ../assets - mostly the same
// PNGs the Processing sketch used, plus the repo's own Preview.jpg for the
// start screen backdrop, the player's idle animation, and its "wounded" set.
const PLAYER_IDLE_ASSET = "../assets/player_idle_left1.png";
const PLAYER_FIGHT_ASSET = "../assets/player_fight_right1.png";

export const ASSET_PATHS = {
  // Parallax background (mountains/forest) - see PARALLAX_FACTOR in
  // constants.js and Game#renderParallaxBackground in game.js.
  bgParallax: "../assets/bg_parallax.png",

  tile1: "../assets/1.png",
  tile2: "../assets/2.png",
  tile3: "../assets/3.png",
  tile4: "../assets/4.png",
  tile5: "../assets/5.png",
  tile6: "../assets/6.png",
  tile7: "../assets/7.png",
  tile8: "../assets/8.png",
  tile9: "../assets/9.png",
  tile10: "../assets/10.png",

  playerJumpLeft: "../assets/player_jump_left.png",
  playerJumpRight: "../assets/player_jump_right.png",
  playerMoveLeft1: PLAYER_IDLE_ASSET,
  playerMoveLeft2: PLAYER_IDLE_ASSET,
  playerMoveRight1: PLAYER_IDLE_ASSET,
  playerMoveRight2: PLAYER_IDLE_ASSET,
  playerFightLeft1: PLAYER_FIGHT_ASSET,
  playerFightLeft2: PLAYER_FIGHT_ASSET,
  playerFightLeft3: PLAYER_FIGHT_ASSET,
  playerFightRight1: PLAYER_FIGHT_ASSET,
  playerFightRight2: PLAYER_FIGHT_ASSET,
  playerFightRight3: PLAYER_FIGHT_ASSET,

  // "Wounded" look for every player animation, swapped in once health drops
  // to half or below - see WOUNDED_HEALTH_RATIO in constants.js.
  playerJumpWoundedLeft: "../assets/player_jump_wounded_left.png",
  playerJumpWoundedRight: "../assets/player_jump_wounded_right.png",
  playerMoveWoundedLeft1: "../assets/player_move_wounded_left1.png",
  playerMoveWoundedLeft2: "../assets/player_move_wounded_left2.png",
  playerMoveWoundedRight1: "../assets/player_move_wounded_right1.png",
  playerMoveWoundedRight2: "../assets/player_move_wounded_right2.png",
  playerFightWoundedLeft1: "../assets/player_fight_wounded_left1.png",
  playerFightWoundedLeft2: "../assets/player_fight_wounded_left2.png",
  playerFightWoundedLeft3: "../assets/player_fight_wounded_left3.png",
  playerFightWoundedRight1: "../assets/player_fight_wounded_right1.png",
  playerFightWoundedRight2: "../assets/player_fight_wounded_right2.png",
  playerFightWoundedRight3: "../assets/player_fight_wounded_right3.png",

  spiderWalkLeft1: "../assets/spider_walk_left1.png",
  spiderWalkLeft2: "../assets/spider_walk_left2.png",
  spiderWalkLeft3: "../assets/spider_walk_left3.png",
  spiderWalkRight1: "../assets/spider_walk_right1.png",
  spiderWalkRight2: "../assets/spider_walk_right2.png",
  spiderWalkRight3: "../assets/spider_walk_right3.png",

  gold1: "../assets/gold1.png",
  gold2: "../assets/gold2.png",
  gold3: "../assets/gold3.png",
  gold4: "../assets/gold4.png",

  // Placeholders: a stationary turret that lobs fireballs, and its projectile.
  fireEnemyIdleLeft: "../assets/fire_enemy_idle_left.png",
  fireEnemyIdleRight: "../assets/fire_enemy_idle_right.png",
  fireEnemyCastLeft1: "../assets/fire_enemy_cast_left1.png",
  fireEnemyCastLeft2: "../assets/fire_enemy_cast_left2.png",
  fireEnemyCastRight1: "../assets/fire_enemy_cast_right1.png",
  fireEnemyCastRight2: "../assets/fire_enemy_cast_right2.png",
  fireball: "../assets/fireball.png",

  // Placeholders: a flying enemy that patrols then dives at the player.
  swoopMoveLeft1: "../assets/swoop_move_left1.png",
  swoopMoveLeft2: "../assets/swoop_move_left2.png",
  swoopMoveRight1: "../assets/swoop_move_right1.png",
  swoopMoveRight2: "../assets/swoop_move_right2.png",

  // Placeholders: no door art existed in assets/, so these are generated
  // (see the door labels) rather than hand-drawn.
  doorExit: "../assets/door_exit.png",
  doorShop: "../assets/door_shop.png",

  // Boss placeholders: no boss art exists yet either, so each frame is
  // labeled with its own filename until real art replaces them. Three
  // separate art sets (boss/boss2/boss3, one per boss fight - see the `boss`
  // field on levels 4/7/11 in levels-data.js) are built below instead of
  // hand-listed, since they all share the same 14-frame shape.
};

// Player idle animation (10 frames, see IDLE_FRAME_COUNT in constants.js) -
// built the same way as the boss frames below since it's another long, evenly
// numbered run - plus its "wounded" counterpart, swapped in at half health.
for (const dir of ["Left", "Right"]) {
  for (let i = 1; i <= 10; i++) {
    ASSET_PATHS[`playerIdle${dir}${i}`] = PLAYER_IDLE_ASSET;
    ASSET_PATHS[`playerIdleWounded${dir}${i}`] =
      `../assets/player_idle_wounded_${dir.toLowerCase()}${i}.png`;
  }
}

for (const prefix of ["boss", "boss2", "boss3"]) {
  const camel = (suffix) => prefix + suffix;
  const file = (suffix) => `../assets/${prefix}_${suffix}.png`;
  Object.assign(ASSET_PATHS, {
    [camel("StandLeft")]: file("stand_left"),
    [camel("StandRight")]: file("stand_right"),
    [camel("MoveLeft1")]: file("move_left1"),
    [camel("MoveLeft2")]: file("move_left2"),
    [camel("MoveRight1")]: file("move_right1"),
    [camel("MoveRight2")]: file("move_right2"),
    [camel("JumpLeft")]: file("jump_left"),
    [camel("JumpRight")]: file("jump_right"),
    [camel("AttackLeft1")]: file("attack_left1"),
    [camel("AttackLeft2")]: file("attack_left2"),
    [camel("AttackLeft3")]: file("attack_left3"),
    [camel("AttackRight1")]: file("attack_right1"),
    [camel("AttackRight2")]: file("attack_right2"),
    [camel("AttackRight3")]: file("attack_right3"),
  });
  // Death animation (6 frames, see BOSS_DEATH_FRAME_COUNT in constants.js) -
  // plays once when the boss's health hits 0, then holds on the last frame.
  for (let i = 1; i <= 6; i++) {
    ASSET_PATHS[camel(`DeathLeft${i}`)] = file(`death_left${i}`);
    ASSET_PATHS[camel(`DeathRight${i}`)] = file(`death_right${i}`);
  }
}

// Player victory animation: 3 randomly-chosen variants (VICTORY_VARIANT_COUNT
// in constants.js), 10 frames each (VICTORY_FRAME_COUNT), played once the
// boss's own death animation finishes - see Player.startVictory() and the
// 'bossdefeated' game state in game.js.
for (let variant = 1; variant <= 3; variant++) {
  for (const dir of ["Left", "Right"]) {
    for (let i = 1; i <= 10; i++) {
      ASSET_PATHS[`playerVictory${variant}${dir}${i}`] =
        `../assets/player_victory${variant}_${dir.toLowerCase()}${i}.png`;
    }
  }
}

export function loadImages(onProgress) {
  const keys = Object.keys(ASSET_PATHS);
  let loaded = 0;
  const images = {};
  const promises = keys.map(
    (key) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          loaded++;
          if (onProgress) onProgress(loaded, keys.length);
          resolve();
        };
        img.onerror = () =>
          reject(new Error(`Failed to load asset: ${ASSET_PATHS[key]}`));
        img.src = ASSET_PATHS[key];
        images[key] = img;
      }),
  );
  return Promise.all(promises).then(() => images);
}
