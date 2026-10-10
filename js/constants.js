// All gameplay runs on a fixed 60 ticks/second simulation (see main.js), so
// every speed below is "pixels per tick" and every duration is "ticks" -
// independent of the monitor's refresh rate.
export const TICKS_PER_SECOND = 60;

// World units: one tile is TILE pixels square. Level data (levels-data.js)
// is laid out on this grid.
export const TILE = 150;

// The canvas is a 16:9 render target; the world is drawn scaled by
// VIEW_SCALE so about 9.6 tile rows (and ~17 columns) are visible - close
// enough that the characters read clearly, with the camera following
// vertically through 12-row levels. The HUD is drawn unscaled on top.
export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;
export const VIEW_SCALE = CANVAS_HEIGHT / (9.6 * TILE);
export const VIEW_WIDTH = CANVAS_WIDTH / VIEW_SCALE; // in world units
export const VIEW_HEIGHT = CANVAS_HEIGHT / VIEW_SCALE;

export const RIGHT_FACING = 1;
export const LEFT_FACING = -1;

// --- Player movement --------------------------------------------------------
// Snappy-but-weighty, in the spirit of Wonder Boy in Monster Land: a short
// ramp up to full speed, quick stop, real air control, and a jump whose
// height depends on how long the button is held.
export const PLAYER_W = 84;
export const PLAYER_H = 216;
export const RUN_SPEED = 10.5;
export const GROUND_ACCEL = 1.5;
export const GROUND_FRICTION = 1.9;
export const AIR_ACCEL = 0.95;
export const AIR_FRICTION = 0.35;
export const ATTACK_GROUND_FRICTION = 1.2; // sliding to a stop while slashing

export const JUMP_VELOCITY = 39; // ~3.4 tiles at full hold
export const GRAVITY_RISE = 1.5; // while holding jump and moving up
export const GRAVITY_CUT = 3.4; // released jump early -> short hop
export const GRAVITY_FALL = 2.0;
export const MAX_FALL_SPEED = 30;
export const COYOTE_TICKS = 6; // can still jump this long after walking off a ledge
export const JUMP_BUFFER_TICKS = 8; // a jump pressed just before landing still counts

// --- Player combat ----------------------------------------------------------
export const MAX_HEALTH = 100;
export const HEART_VALUE = 20; // HUD shows health as hearts of this many HP
export const BASE_ATTACK = 10;
export const ATTACK_TOTAL_TICKS = 18;
export const ATTACK_ACTIVE_START = 3;
export const ATTACK_ACTIVE_END = 10;
export const ATTACK_REACH = 150; // from the player's center, toward facing
export const HURT_INVULN_TICKS = 70;
export const HURT_STUN_TICKS = 14; // controls locked while knocked back
export const HURT_KNOCKBACK_X = 9;
export const HURT_KNOCKBACK_Y = 17;

// Hit-stop: the whole game freezes for a few ticks on impact - the single
// biggest contributor to attacks feeling like they connect.
export const HITSTOP_HIT = 4;
export const HITSTOP_KILL = 7;
export const HITSTOP_HURT = 6;
export const ENEMY_HITSTUN_TICKS = 16;
export const ENEMY_KNOCKBACK = 9;

export const STARTING_LIVES = 3;
export const MAX_LIVES = 9;

// --- Presentation timing ----------------------------------------------------
export const LEVEL_INTRO_TICKS = 120;
export const LEVEL_INTRO_SECONDS = LEVEL_INTRO_TICKS / TICKS_PER_SECOND;
export const DEATH_ANIM_TICKS = 70;
export const VICTORY_FRAME_COUNT = 10;
export const VICTORY_VARIANT_COUNT = 3;
export const VICTORY_TOTAL_TICKS = 110;
export const IDLE_FRAME_COUNT = 10;

// --- Enemies ----------------------------------------------------------------
export const ONI_W = 100;
export const ONI_H = 220;
export const ONI_HEALTH = 20;
export const ONI_SPEED = 2.4;
export const ONI_CHARGE_SPEED = 5.2;
export const ONI_DAMAGE = 10;
// Oni turn around when the ground ends this far ahead of them, so they stay
// back from ledges instead of patrolling right up to the edge.
export const ONI_EDGE_MARGIN = TILE * 1.1;

export const GHOST_W = 110;
export const GHOST_H = 170;
export const GHOST_HEALTH = 20;
export const GHOST_SPEED = 3.5;
export const GHOST_DIVE_SPEED = 13;
export const GHOST_TRIGGER_X = 520;
export const GHOST_COOLDOWN_TICKS = 110;
export const GHOST_DAMAGE = 10;
// Highest a ghost may hover above the floor below it (feet to floor). Keeps
// every ghost low enough to dive onto a player on the ground.
export const GHOST_MAX_HOVER = 2.6 * TILE;

export const LANTERN_W = 110;
export const LANTERN_H = 150;
export const LANTERN_HEALTH = 20;
export const LANTERN_INTERVAL_TICKS = 170;
export const LANTERN_WINDUP_TICKS = 40;
export const LANTERN_DAMAGE = 10;

export const FIREBALL_SPEED = 11;
export const FIREBALL_SIZE = 64;
export const FIREBALL_DAMAGE = 8;
export const FIREBALL_LIFE_TICKS = 160;

// --- Boss -------------------------------------------------------------------
export const BOSS_W = 170;
export const BOSS_H = 380;
export const BOSS_SPEED = 3.6;
export const BOSS_JUMP_VELOCITY = 34;
export const BOSS_WINDUP_TICKS = 34;
export const BOSS_ACTIVE_TICKS = 10;
export const BOSS_RECOVER_TICKS = 44;
export const BOSS_LUNGE_SPEED = 15;
export const BOSS_REACH = 260;
export const BOSS_ATTACK_TRIGGER = 420;
export const BOSS_DEATH_TICKS = 90;
// Scales every boss's damage (slash, contact and fireballs) on top of the
// per-boss attackStrength in levels-data.js.
export const BOSS_DAMAGE_MULTIPLIER = 2;

// New Game+: blood spatter droplets are this many times bigger.
export const NG_PLUS_BLOOD_SCALE = 3;

// --- Pickups ----------------------------------------------------------------
export const COIN_SIZE = 70;
export const DROPPED_COIN_LIFE_TICKS = 540;
export const HEART_DROP_CHANCE = 0.14;
export const HEART_PICKUP_HEAL = 20;
