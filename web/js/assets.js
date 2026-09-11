// Maps every image the game needs to its file in ../assets (nothing new added,
// same PNGs the Processing sketch used) plus the repo's own Preview.jpg for the
// start screen backdrop.
export const ASSET_PATHS = {
  tile1: '../assets/1.png',
  tile2: '../assets/2.png',
  tile3: '../assets/3.png',
  tile4: '../assets/4.png',
  tile5: '../assets/5.png',
  tile6: '../assets/6.png',
  tile7: '../assets/7.png',
  tile8: '../assets/8.png',
  tile9: '../assets/9.png',
  tile10: '../assets/10.png',

  playerStandLeft: '../assets/player_stand_left.png',
  playerStandRight: '../assets/player_stand_right.png',
  playerJumpLeft: '../assets/player_jump_left.png',
  playerJumpRight: '../assets/player_jump_right.png',
  playerMoveLeft1: '../assets/player_move_left1.png',
  playerMoveLeft2: '../assets/player_move_left2.png',
  playerMoveRight1: '../assets/player_move_right1.png',
  playerMoveRight2: '../assets/player_move_right2.png',
  playerFightLeft1: '../assets/player_fight_left1.png',
  playerFightLeft2: '../assets/player_fight_left2.png',
  playerFightLeft3: '../assets/player_fight_left3.png',
  playerFightRight1: '../assets/player_fight_right1.png',
  playerFightRight2: '../assets/player_fight_right2.png',
  playerFightRight3: '../assets/player_fight_right3.png',

  spiderWalkLeft1: '../assets/spider_walk_left1.png',
  spiderWalkLeft2: '../assets/spider_walk_left2.png',
  spiderWalkLeft3: '../assets/spider_walk_left3.png',
  spiderWalkRight1: '../assets/spider_walk_right1.png',
  spiderWalkRight2: '../assets/spider_walk_right2.png',
  spiderWalkRight3: '../assets/spider_walk_right3.png',

  gold1: '../assets/gold1.png',
  gold2: '../assets/gold2.png',
  gold3: '../assets/gold3.png',
  gold4: '../assets/gold4.png',

  // Placeholders: a stationary turret that lobs fireballs, and its projectile.
  fireEnemyIdleLeft: '../assets/fire_enemy_idle_left.png',
  fireEnemyIdleRight: '../assets/fire_enemy_idle_right.png',
  fireEnemyCastLeft1: '../assets/fire_enemy_cast_left1.png',
  fireEnemyCastLeft2: '../assets/fire_enemy_cast_left2.png',
  fireEnemyCastRight1: '../assets/fire_enemy_cast_right1.png',
  fireEnemyCastRight2: '../assets/fire_enemy_cast_right2.png',
  fireball: '../assets/fireball.png',

  // Placeholders: a flying enemy that patrols then dives at the player.
  swoopMoveLeft1: '../assets/swoop_move_left1.png',
  swoopMoveLeft2: '../assets/swoop_move_left2.png',
  swoopMoveRight1: '../assets/swoop_move_right1.png',
  swoopMoveRight2: '../assets/swoop_move_right2.png',

  // Placeholders: no door art existed in assets/, so these are generated
  // (see the door labels) rather than hand-drawn.
  doorExit: '../assets/door_exit.png',
  doorShop: '../assets/door_shop.png',

  // Boss placeholders: no boss art exists yet either, so each frame is
  // labeled with its own filename until real art replaces them. Three
  // separate art sets (boss/boss2/boss3, one per boss fight - see the `boss`
  // field on levels 4/7/11 in levels-data.js) are built below instead of
  // hand-listed, since they all share the same 14-frame shape.
};

for (const prefix of ['boss', 'boss2', 'boss3']) {
  const camel = (suffix) => prefix + suffix;
  const file = (suffix) => `../assets/${prefix}_${suffix}.png`;
  Object.assign(ASSET_PATHS, {
    [camel('StandLeft')]: file('stand_left'),
    [camel('StandRight')]: file('stand_right'),
    [camel('MoveLeft1')]: file('move_left1'),
    [camel('MoveLeft2')]: file('move_left2'),
    [camel('MoveRight1')]: file('move_right1'),
    [camel('MoveRight2')]: file('move_right2'),
    [camel('JumpLeft')]: file('jump_left'),
    [camel('JumpRight')]: file('jump_right'),
    [camel('AttackLeft1')]: file('attack_left1'),
    [camel('AttackLeft2')]: file('attack_left2'),
    [camel('AttackLeft3')]: file('attack_left3'),
    [camel('AttackRight1')]: file('attack_right1'),
    [camel('AttackRight2')]: file('attack_right2'),
    [camel('AttackRight3')]: file('attack_right3'),
  });
}

export function loadImages(onProgress) {
  const keys = Object.keys(ASSET_PATHS);
  let loaded = 0;
  const images = {};
  const promises = keys.map((key) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      loaded++;
      if (onProgress) onProgress(loaded, keys.length);
      resolve();
    };
    img.onerror = () => reject(new Error(`Failed to load asset: ${ASSET_PATHS[key]}`));
    img.src = ASSET_PATHS[key];
    images[key] = img;
  }));
  return Promise.all(promises).then(() => images);
}
