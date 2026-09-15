# Monster Land

A tiny browser platformer (`web/`). This file documents every image asset the
game loads, so art (including a full reskin) can be dropped in by filename
without touching any code.

## Asset Reference

Every image lives in `/assets/` (repo root, sibling to `/web/`) and is loaded
once at startup by `web/js/assets.js`. Filenames below are fixed — the loader
fails hard if one is missing, so replacing art means **overwriting files at
these exact paths**, not renaming anything in code.

**World scale:** everything below is sized for the current 3x-scaled world
(tile size 150px, canvas 2400×1800 - see `constants.js`) with one deliberate
exception: **the boss is sized relative to the player instead** - 250×500,
double the player's 250-tall box (but narrower than the player is wide,
rather than square) - and moves at exactly half the player's
speed (`BOSS_MOVE_SPEED` = `MOVE_SPEED` / 2).

### Sizing rules (read this before drawing anything)

- Every sprite is drawn at its file's own native pixel size — there's no
  scaling in code, so whatever size you draw is what the player sees.
- **All frames of one animation set must share one box size** — with one
  exception, see below. The engine reads a sprite's width/height once, from
  the very first frame it loads, and reuses that same box for every other
  frame of that character (`Sprite`/`AnimatedSprite` in `web/js/sprite.js`).
  A frame drawn a different size than that will get squashed/stretched into
  the normal box instead of showing at its own size — keep every frame for a
  given character (idle/jump/move) at the same canvas size.
- **Exception: the player's grounded attack frames** (`player_fight_left*.png`
  / `player_fight_right*.png`, normal and wounded) **can be wider or taller
  than the player's normal 200×250 box** — e.g. to draw a kick whose foot
  extends past the body. `game.js`'s `displayPlayer()` detects when an attack
  frame's size differs from the normal box and anchors the edge *behind* the
  facing direction to where the normal box already ends, growing the extra
  size toward the front (and upward, so the feet stay planted) instead of
  squashing it or centering it (which would pop the body sideways as frames
  change). This lines up with where the invisible attack hitbox already
  reaches — `ATTACK_RANGE` in `web/js/constants.js`, currently 102px past the
  normal edge, so a frame 102px wider than normal puts the foot exactly at the
  hitbox's edge. The boss's attack frames get the same treatment relative to
  its own 250×500 box and its own reach, `BOSS_ATTACK_RANGE` (210px).
  **Important:** the left- and right-facing attack frames must be mirror
  layouts, not copies — e.g. for a right kick, draw the body in the left
  portion of the canvas and the foot extending into the right portion; the
  left-facing frame needs the body on the *right* and the foot extending
  *left* (the standard "flip the right frame horizontally" workflow gets this
  right automatically). Get this backwards and the body will appear to jump
  sideways when you attack.
- Tiles must be exactly 150×150 — that's `SPRITE_SIZE`, the grid unit the
  whole level layout is built from.
- Doors are the one exception drawn at a *fixed* size regardless of the file's
  own dimensions — always scaled to 150×300 on screen. Draw at a higher
  native resolution for a sharper look (300×600 is a reasonable target, 2x
  the display size); any resolution works as long as it's roughly a 1:2 ratio.

### Tiles — 10 files, 150×150 each

| Filename | Used for |
|---|---|
| `1.png` | Ground / walkway (solid) |
| `2.png`, `3.png` | Wall facades (decorative, walk-through) |
| `4.png`, `5.png` | Embedded jump platforms (solid) |
| `6.png`, `7.png`, `8.png` | Roof pieces (decorative) |
| `9.png`, `10.png` | Sand / alt-ground + foundation (solid) |

### Parallax background — 1 file, tileable width × 300px tall (recommended)

`bg_parallax.png` — distant mountains/forest, drawn between the flat sky
color and the level's own tiles. It's always displayed at exactly half the
canvas height (900px currently) regardless of the file's native resolution
(draw at a higher resolution for more detail - e.g. native 600px tall scales
down cleanly), and it's tiled horizontally to cover the full width while
scrolling at a fraction of the camera's speed (`PARALLAX_FACTOR` in
`constants.js`) for a sense of depth. **The image must tile seamlessly** -
its left and right edges need to line up when repeated side by side, since
it loops indefinitely across every level's full width. No direction variant
(it doesn't care which way the player faces).

### Player — 124 files, 200×250 each (except the attack frames — see below)

**Idle / jump / move / attack** (64 files) each exist twice: a normal set, and
a parallel **"wounded"** set (same filenames with `_wounded` inserted after
`player`) that automatically replaces it once health drops to half or below
(`WOUNDED_HEALTH_RATIO` in `web/js/constants.js`). e.g. `player_idle_left3.png`
also needs `player_idle_wounded_left3.png`.

| Filename (normal / wounded) | Animation |
|---|---|
| `player_idle_left1.png` … `player_idle_left10.png`, `player_idle_right1.png` … `player_idle_right10.png` / `player_idle_wounded_left1.png` … `player_idle_wounded_right10.png` | Idle — a 10-frame loop, not a single static pose |
| `player_jump_left.png`, `player_jump_right.png` / `player_jump_wounded_left.png`, `player_jump_wounded_right.png` | Airborne — also the base pose the airborne spin-attack rotates |
| `player_move_left1.png`, `player_move_left2.png`, `player_move_right1.png`, `player_move_right2.png` / `player_move_wounded_left1.png` … `player_move_wounded_right2.png` | Walk cycle (2 frames) |
| `player_fight_left1.png`, `player_fight_left2.png`, `player_fight_left3.png`, `player_fight_right1.png`, `player_fight_right2.png`, `player_fight_right3.png` / `player_fight_wounded_left1.png` … `player_fight_wounded_right3.png` | Grounded attack (a kick), 3 frames — see below |

That's 20 idle + 2 jump + 4 move + 6 fight = 32 normal, ×2 for the wounded set
= 64 files.

**The 3 grounded-attack frames are timed to specific game ticks, not evenly
looped** (`Player.updateAnimation()` in `web/js/entities.js`), so each one has
a fixed meaning:

1. **Frame 1** — leg drawing back / preparing the kick (wind-up).
2. **Frame 2** — leg fully extended. This is the only frame shown while the
   hit can actually land (`isAttackActive()`'s active window always lines up
   with this frame, whatever the swing's current speed is - see Swift Strike
   Training in the shop).
3. **Frame 3** — leg retracting back to idle.

**Victory animation** (60 files, no wounded variant): 3 randomly-chosen
10-frame celebrations, played once after a boss's own death animation
finishes (see the Bosses section and "Boss defeat sequence" below).
`player_victory1_left1.png` … `player_victory1_left10.png` /
`_right1.png` … `_right10.png`, then the same 10 frames again for
`player_victory2_*` and `player_victory3_*`. 3 variants × 2 directions × 10
frames = 60 files.

These can be wider/taller than the normal 200×250 box (e.g. frame 2's foot
extending past the body) — see the sizing-rules exception above.

### Ground enemy — 6 files, 200×250 each (same box as the player)

Filenames still say `spider_*` (nothing needs renaming for this to work), but
this enemy is sized to match the player exactly now, not a scaled-up spider -
say the word if you want the asset keys/filenames renamed to match a human
enemy instead. `spider_walk_left1.png`, `spider_walk_left2.png`,
`spider_walk_left3.png`, `spider_walk_right1.png`, `spider_walk_right2.png`,
`spider_walk_right3.png` — ground patrol walk cycle.

### Fire turret enemy — 6 files, 168×168 each

`fire_enemy_idle_left.png`, `fire_enemy_idle_right.png`,
`fire_enemy_cast_left1.png`, `fire_enemy_cast_left2.png`,
`fire_enemy_cast_right1.png`, `fire_enemy_cast_right2.png`
— stationary; idle pose plus a 2-frame "casting" pose shown right before it
fires.

### Fireball projectile — 1 file, 84×84 (recommended)

`fireball.png` — no left/right variant, drawn identically both directions.
Not explicitly part of the "make it bigger" ask, but left small (its old
28×28) it'll look tiny next to the rest of the now-bigger world - scaling it
up 3x like everything else is a reasonable default unless you want it to
stay small on purpose.

### Swoop (flying) enemy — 4 files, 162×162 each

`swoop_move_left1.png`, `swoop_move_left2.png`,
`swoop_move_right1.png`, `swoop_move_right2.png`
— same images used for patrol, dive, and the climb back up; there's no
separate diving pose.

### Coins — 4 files, 156×156 each (recommended)

`gold1.png`, `gold2.png`, `gold3.png`, `gold4.png` — one continuously-looping
spin animation, no direction variants. Same note as the fireball above: not
explicitly requested, but scaled up here for visual consistency with the
rest of the bigger world - keep them at the old 52×52 if you'd rather coins
stay small and easy to miss among bigger sprites.

### Doors — 2 files, native ~300×600 recommended, always drawn at 150×300

`door_exit.png` — level exit. `door_shop.png` — shop entrance.

### Bosses — 20 files × 3 palettes = 60 files, 250×500 each

Three separate boss fights (Levels 4, 7, 11), each its own full art set under
a different filename prefix: `boss_`, `boss2_`, `boss3_`. **Sized relative to
the player rather than the 3x world scale** - twice the player's 250-tall
box in height, but narrower than square (250 wide, not 500) - and it
patrols at exactly half the player's move
speed (a slow, looming pace, `BOSS_MOVE_SPEED` in `constants.js`).

| Suffix | Animation |
|---|---|
| `_stand_left.png`, `_stand_right.png` | Idle |
| `_jump_left.png`, `_jump_right.png` | Airborne (hop) |
| `_move_left1.png`, `_move_left2.png`, `_move_right1.png`, `_move_right2.png` | Patrol walk (2 frames) |
| `_attack_left1.png`, `_attack_left2.png`, `_attack_left3.png`, `_attack_right1.png`, `_attack_right2.png`, `_attack_right3.png` | Melee swing (3 frames) — same tick-driven timing and wider-frame convention as the player's kick, see below |
| `_death_left1.png` … `_death_left6.png`, `_death_right1.png` … `_death_right6.png` | Death (6 frames) — plays once when health hits 0, then holds on frame 6 as a fallen corpse. Gameplay keeps running normally while this plays. |

e.g. `boss2_attack_right2.png` is the 2nd boss's 2nd attack frame,
`boss3_death_left4.png` is the final boss's 4th death frame facing left.

**The boss's 3 swing frames work exactly like the player's kick** (see
`BossEnemy.updateAnimation()` in `web/js/entities.js`):

1. **Frame 1** — wind-up, held for a long, clearly-telegraphed pause
   (`BOSS_ATTACK_ACTIVE_START` ticks) so the player has real time to see it
   coming and move out of range.
2. **Frame 2** — full extension. The only frame the hit can land, and it can
   be drawn wider/taller than the boss's normal 250×500 box (anchored to the
   facing edge, same as the player's kick) to visually fill `BOSS_ATTACK_RANGE`
   (210px past the normal edge).
3. **Frame 3** — recoil. The boss then holds still for its entire attack
   cooldown afterward (doesn't resume patrolling), so there's a real window
   to move in and strike back.

**Boss defeat sequence** (`Game` in `web/js/game.js`): landing the killing hit
starts the boss's 6-frame death animation while gameplay keeps running as
normal. Once that finishes, the boss drops its usual 10-coin burst, gameplay
freezes (`Game` state `'bossdefeated'`), and the player plays one randomly-
picked victory animation (see the Player section) before play resumes.

**Ranged attack** (`BossEnemy.thinkFireball()` in `web/js/entities.js`, see
each boss's `boss` entry in `levels-data.js`): on top of its melee swing,
every boss also lobs the same `fireball.png` projectile fire turrets use, no
extra art needed. The first boss fires one every 10s; the second, every 5s;
the third fires at a random interval between 5-10s (re-rolled after every
shot) from a randomly-picked point on its own body - either its center or
near the top of its head.

### Branding / UI — not gameplay sprites, not part of the world scale-up

- `/Preview.jpg` (repo root, currently 669×599) — full-bleed backdrop on the
  start screen and the game-complete screen.
- `web/icons/` — PWA icon set: `favicon-16.png`, `favicon-32.png`,
  `favicon-48.png`, `favicon.ico`, `apple-touch-icon.png`,
  `icon-any-192.png`, `icon-any-512.png`, `icon-maskable-192.png`,
  `icon-maskable-512.png` (sizes match their filenames; the maskable ones
  need extra padding per PWA convention so a circular crop doesn't clip them).
