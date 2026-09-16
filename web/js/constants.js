// World scale: everything spatial (tile size, canvas, movement speeds,
// ranges) is 3x its original size, matching the player's new 200x250 art
// (vs. the old 64x64) - see README.md. Tick-COUNTS (durations, cooldowns,
// frame counts) are deliberately NOT scaled here, since they're about time,
// not distance; a jump/attack/patrol still takes the same number of ticks,
// just covers 3x the distance. Balance numbers (health, damage) are also
// unscaled - those aren't physical measurements. The boss's own sprite size
// follows a different rule entirely - see BOSS_MOVE_SPEED below.
export const SPRITE_SIZE = 150;
export const SPRITE_SCALE = 1.0;

export const MOVE_SPEED = 9;
export const GRAVITY = 1.8;
// A single jump clears about 4 tiles (verified by simulating the actual
// collision code against the old scale; scaling speed and gravity by the
// same factor keeps the exact same arc shape - same number of tiles, same
// number of ticks - just 3x bigger).
export const JUMP_SPEED = 48;

// 2400x1800 keeps the same NUMBER of tiles visible on screen (16x12) as
// before at the old 50px/800x600 scale - this is a render-resolution bump,
// not a smaller field of view. main.js's fitStage() scales the canvas
// element to fit the viewport regardless of this internal resolution.
export const CANVAS_WIDTH = 2400;
export const CANVAS_HEIGHT = 1800;

// Parallax background (mountains/forest, see bg_parallax.png in README.md):
// drawn between the flat sky color and the level's own tiles, spanning the
// bottom half of the screen and the full width. It scrolls horizontally at
// this fraction of the camera's own movement - smaller than 1 so it reads as
// further away - and tiles seamlessly, so the source image just needs to
// loop cleanly on its left/right edges at whatever resolution/width it's
// drawn at (see Game#renderParallaxBackground in game.js).
export const PARALLAX_FACTOR = 0.4;

export const RIGHT_MARGIN = 1200;
export const LEFT_MARGIN_INITIAL = 180;
export const LEFT_MARGIN_LOCKED = 900;
export const VERTICAL_MARGIN = 120;

export const GROUND_LEVEL = CANVAS_HEIGHT - SPRITE_SIZE;

export const NEUTRAL_FACING = 0;
export const RIGHT_FACING = 1;
export const LEFT_FACING = 2;

export const MAX_HEALTH = 100;

// Player switches to its "wounded" sprite set once health is at or below this
// fraction of max health - see Player.selectCurrentImages() in entities.js.
export const WOUNDED_HEALTH_RATIO = 0.2;

// Idle animation frame count - a longer breathing/fidget loop instead of a
// single static standing pose. Advances at the same 5-ticks-per-frame cadence
// every other animation uses (AnimatedSprite.updateAnimation()).
export const IDLE_FRAME_COUNT = 10;

// Attack timing: 3 swing frames advanced every 5 ticks, same cadence the
// original AnimatedSprite used for walk cycles.
export const ATTACK_TOTAL_TICKS = 15;
export const ATTACK_ACTIVE_START = 4;
export const ATTACK_ACTIVE_END = 10;
export const ATTACK_RANGE = 102;

// How long the player's sprite flashes white after taking damage, in ticks.
export const DAMAGE_FLASH_TICKS = 8;

// How long any enemy/boss freezes in place and flashes white after being hit:
// the attacking player's own current swing-to-swing cycle (attackTotalTicks,
// which shop upgrades like Swift Strike Training can shorten) minus this
// margin, so a player who immediately swings again always lands that
// follow-up hit right as the stun wears off, instead of trading blows with
// something like the boss whose reach/aggro range are both bigger than the
// player's. See the hitstun assignment in game.js.
export const HITSTUN_MARGIN_TICKS = 3;

// Player death: freezes gameplay and plays a short fall-and-fade animation
// (no dedicated death sprite exists yet, so this is done procedurally on the
// player's last-alive frame) before showing the continue/game-over screen.
// 5 frames at 6 ticks each = 30 ticks (0.5s at 60fps).
export const DEATH_ANIM_FRAME_COUNT = 5;
export const DEATH_ANIM_FRAME_TICKS = 6;
export const DEATH_ANIM_TOTAL_TICKS =
  DEATH_ANIM_FRAME_COUNT * DEATH_ANIM_FRAME_TICKS;

// Boss death: once its health hits 0 the boss plays this many dedicated death
// frames (see the boss_death_* assets) instead of just vanishing - it stays
// on its last frame afterward as a fallen corpse. Gameplay keeps running
// normally while this plays; only once it finishes does the victory cutscene
// (below) freeze everything.
export const BOSS_DEATH_FRAME_COUNT = 6;
export const BOSS_DEATH_FRAME_TICKS = 6;
export const BOSS_DEATH_TOTAL_TICKS =
  BOSS_DEATH_FRAME_COUNT * BOSS_DEATH_FRAME_TICKS;

// Victory cutscene: once the boss's own death animation finishes, gameplay
// freezes (Game state 'bossdefeated') and the player plays one of
// VICTORY_VARIANT_COUNT randomly-chosen 10-frame victory animations before
// play resumes.
export const VICTORY_FRAME_COUNT = 10;
export const VICTORY_VARIANT_COUNT = 3;
export const VICTORY_FRAME_TICKS = 5;
export const VICTORY_TOTAL_TICKS = VICTORY_FRAME_COUNT * VICTORY_FRAME_TICKS;

export const STARTING_LIVES = 3;
export const MAX_LIVES = 9; // just a sanity cap on repeated 1-Up purchases

// The black "Level N - Name" screen shown before a level starts (or after a
// life is lost and the level restarts): how long it's shown before
// auto-continuing, and how long the health bar takes to visually fill back
// up to full - kept in one place so main.js's CSS transition duration and
// game.js's auto-advance timer can't drift apart.
export const LEVEL_INTRO_TICKS = 108; // 1.8s at 60fps
export const LEVEL_INTRO_SECONDS = LEVEL_INTRO_TICKS / 60;

// Boss: sized and paced relative to the PLAYER rather than the 3x world
// scale above - target art is 250x500 (double the player's 250-tall box in
// height, but narrower than square, see README.md), and BOSS_MOVE_SPEED is
// deliberately exactly half of MOVE_SPEED (a slow, looming patrol pace next
// to the player's own speed).
export const BOSS_HEALTH = 200;
export const BOSS_ATTACK_STRENGTH = 15;
export const BOSS_MOVE_SPEED = 4.5; // = MOVE_SPEED / 2
export const BOSS_JUMP_SPEED = 39;
export const BOSS_JUMP_INTERVAL_TICKS = 220; // hops roughly every ~3.7s
// Swing timeline (3 frames, same tick-driven approach as the player's kick -
// see BossEnemy.updateAnimation()): a long, clearly-telegraphed wind-up
// (frame 1, boss holds still) so the player has real time to react and move
// out of the way, a short active window (frame 2 - the only frame the hit
// can land, drawn wider to fill BOSS_ATTACK_RANGE, see game.js) and a
// recoil (frame 3). The boss then stays put for the whole cooldown after -
// see attackCooldownTicks in BossEnemy.think() - instead of immediately
// resuming its patrol, so there's a real punish window to strike back.
export const BOSS_ATTACK_TOTAL_TICKS = 50;
export const BOSS_ATTACK_ACTIVE_START = 20;
export const BOSS_ATTACK_ACTIVE_END = 30;
export const BOSS_ATTACK_RANGE = 210;
export const BOSS_ATTACK_TRIGGER_RANGE = 480; // how close the player must be to provoke a swing
export const BOSS_ATTACK_COOLDOWN_TICKS = 60;

// FireEnemy: a stationary turret that only fires while actually on screen -
// so it can't "surprise" the player with a shot they never had a chance to
// see coming, and the 5s cooldown only counts down while visible.
export const FIRE_ENEMY_HEALTH = 20;
export const FIRE_ENEMY_INTERVAL_TICKS = 300; // 5s at 60fps
export const FIRE_ENEMY_CAST_POSE_TICKS = 15; // how long it shows its "cast" frame after firing
export const FIREBALL_SPEED = 12;
export const FIREBALL_DAMAGE = 5;
export const FIREBALL_LIFE_TICKS = 100; // ~1200px range at FIREBALL_SPEED

// SwoopEnemy: flies a horizontal patrol, then dives at the player when they
// get close, and flies back up to its patrol altitude afterward.
export const SWOOP_ENEMY_HEALTH = 20;
export const SWOOP_PATROL_SPEED = 6;
export const SWOOP_TRIGGER_RANGE_X = 420;
export const SWOOP_TRIGGER_RANGE_Y = 660;
export const SWOOP_DIVE_SPEED = 18;
export const SWOOP_MAX_DIVE = 450; // px below its patrol altitude before it pulls back up
export const SWOOP_RETURN_SPEED = 12;
export const SWOOP_COOLDOWN_TICKS = 120; // ~2s before it can dive again

// Solid (collidable) vs decorative (walk-through) tile codes, matching the
// original createPlatforms(): brick/ground tiles block movement, wall/roof
// facade tiles are just background.
export const SOLID_TILES = new Set([1, 4, 5, 9, 10]);
export const DECORATIVE_TILES = new Set([2, 3, 6, 7, 8]);

export const TILE_IMAGE_KEYS = {
  1: "tile1",
  2: "tile2",
  3: "tile3",
  4: "tile4",
  5: "tile5",
  6: "tile6",
  7: "tile7",
  8: "tile8",
  9: "tile9",
  10: "tile10",
};
