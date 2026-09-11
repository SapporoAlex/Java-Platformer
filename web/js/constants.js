export const SPRITE_SIZE = 50;
export const SPRITE_SCALE = 1.0;

export const MOVE_SPEED = 3;
export const GRAVITY = 0.6;
export const JUMP_SPEED = 14;

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

export const RIGHT_MARGIN = 400;
export const LEFT_MARGIN_INITIAL = 60;
export const LEFT_MARGIN_LOCKED = 300;
export const VERTICAL_MARGIN = 40;

export const GROUND_LEVEL = CANVAS_HEIGHT - SPRITE_SIZE;

export const NEUTRAL_FACING = 0;
export const RIGHT_FACING = 1;
export const LEFT_FACING = 2;

export const MAX_HEALTH = 100;

// Attack timing: 3 swing frames advanced every 5 ticks, same cadence the
// original AnimatedSprite used for walk cycles.
export const ATTACK_TOTAL_TICKS = 15;
export const ATTACK_ACTIVE_START = 4;
export const ATTACK_ACTIVE_END = 10;
export const ATTACK_RANGE = 34;

// How long the player's sprite flashes white after taking damage, in ticks.
export const DAMAGE_FLASH_TICKS = 8;

export const STARTING_LIVES = 3;
export const MAX_LIVES = 9; // just a sanity cap on repeated 1-Up purchases

// The black "Level N - Name" screen shown before a level starts (or after a
// life is lost and the level restarts): how long it's shown before
// auto-continuing, and how long the health bar takes to visually fill back
// up to full - kept in one place so main.js's CSS transition duration and
// game.js's auto-advance timer can't drift apart.
export const LEVEL_INTRO_TICKS = 108; // 1.8s at 60fps
export const LEVEL_INTRO_SECONDS = LEVEL_INTRO_TICKS / 60;

// Boss: 4x the size and 10x the HP of a normal enemy. The boss_*.png
// placeholders are already generated at 208px (52px spider * 4), so the boss
// uses scale 1.0 just like Enemy does against its pre-sized images.
export const BOSS_HEALTH = 200;
export const BOSS_ATTACK_STRENGTH = 15;
export const BOSS_MOVE_SPEED = 1.5;
export const BOSS_JUMP_SPEED = 13;
export const BOSS_JUMP_INTERVAL_TICKS = 220; // hops roughly every ~3.7s
export const BOSS_ATTACK_TOTAL_TICKS = 30; // 3 swing frames, held longer than the player's
export const BOSS_ATTACK_ACTIVE_START = 12;
export const BOSS_ATTACK_ACTIVE_END = 22;
export const BOSS_ATTACK_RANGE = 70;
export const BOSS_ATTACK_TRIGGER_RANGE = 160; // how close the player must be to provoke a swing
export const BOSS_ATTACK_COOLDOWN_TICKS = 60;

// FireEnemy: a stationary turret that only fires while actually on screen -
// so it can't "surprise" the player with a shot they never had a chance to
// see coming, and the 5s cooldown only counts down while visible.
export const FIRE_ENEMY_HEALTH = 20;
export const FIRE_ENEMY_INTERVAL_TICKS = 300; // 5s at 60fps
export const FIRE_ENEMY_CAST_POSE_TICKS = 15; // how long it shows its "cast" frame after firing
export const FIREBALL_SPEED = 4;
export const FIREBALL_DAMAGE = 5;
export const FIREBALL_LIFE_TICKS = 100; // ~400px range at FIREBALL_SPEED

// SwoopEnemy: flies a horizontal patrol, then dives at the player when they
// get close, and flies back up to its patrol altitude afterward.
export const SWOOP_ENEMY_HEALTH = 20;
export const SWOOP_PATROL_SPEED = 2;
export const SWOOP_TRIGGER_RANGE_X = 140;
export const SWOOP_TRIGGER_RANGE_Y = 220;
export const SWOOP_DIVE_SPEED = 6;
export const SWOOP_MAX_DIVE = 150; // px below its patrol altitude before it pulls back up
export const SWOOP_RETURN_SPEED = 4;
export const SWOOP_COOLDOWN_TICKS = 120; // ~2s before it can dive again

// Solid (collidable) vs decorative (walk-through) tile codes, matching the
// original createPlatforms(): brick/ground tiles block movement, wall/roof
// facade tiles are just background.
export const SOLID_TILES = new Set([1, 4, 5, 9, 10]);
export const DECORATIVE_TILES = new Set([2, 3, 6, 7, 8]);

export const TILE_IMAGE_KEYS = {
  1: 'tile1',
  2: 'tile2',
  3: 'tile3',
  4: 'tile4',
  5: 'tile5',
  6: 'tile6',
  7: 'tile7',
  8: 'tile8',
  9: 'tile9',
  10: 'tile10',
};
