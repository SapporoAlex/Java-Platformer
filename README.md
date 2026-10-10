# Geisha in Kaibutsuland

An ukiyo-e action platformer in the spirit of *Wonder Boy in Monster Land*:
a wandering swordswoman fights through 11 stages of yokai, spends the gold
they drop in shops, and takes on three bosses. It runs in the browser
and installs as a PWA.

The game lives at the repo root (`index.html`, `js/`, `assets/`), so GitHub
Pages can serve it directly: in the repo's **Settings → Pages**, choose
**Deploy from a branch**, branch `main`, folder `/ (root)`. Every path is
relative, so it works at `https://<user>.github.io/<repo>/` or on a custom
domain. `.nojekyll` tells Pages to serve the files as-is.

## Running it

ES modules need a web server (opening `index.html` from disk won't work):

```bash
python tools/serve.py
```

Then open <http://localhost:8000/>. This server turns caching off, so
every edit shows up on a normal reload. It also listens on IPv6, which matters
on Windows: there, an IPv4-only server makes every `localhost` request stall
for a second, so the game took 10+ seconds to load.

Debug helpers: press <kbd>`</kbd> in game to show hitboxes; `window.game` is
exposed in the console.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | ← → (or A / D) | D-pad / left stick |
| Jump (hold for higher) | Z, Space, K | A / B |
| Slash | X, J | X / Y |
| Enter door / shop | ↑ (or W) | D-pad up |
| Drop through a wooden beam | ↓ + Jump | down + A |
| Pause | Esc, P | Start |
| Mute | M | |

Menus work with the arrow keys plus Enter / Z / X, or with a gamepad. On
touch devices, on-screen buttons appear.

## How it plays

- **Movement:** short acceleration, quick stops, and air control. Jump height
  depends on how long you hold the button. Coyote time and jump buffering make
  ledge jumps forgiving, and bumping a ceiling corner nudges you around it.
- **Combat:** a quick sword slash that works on the ground and in the air.
  It can hit several enemies at once and cuts fireballs out of the air.
  Hits freeze the action for a few frames (hit-stop), shake the screen, flash
  the enemy and knock it back.
- **Blood spatter:** every hit, whether you land it or take it, flicks bright
  red droplets across the screen, like the flicked-paint snowstorms in hanga
  prints. They stay put, building up and obscuring the view, until the stage
  ends or you lose a life (`js/blood.js`).
- **Clouds** are platforms you can stand on and jump up through. They form
  routes into the sky, usually with coins along them.
- **Ghosts** always hover low enough to swoop down on you at ground level,
  and their dive flies all the way to where you were standing.
- **Enemies drop gold** (and sometimes a heart) that pops out and bounces.
  Dropped gold blinks away after ~9 seconds.
- **Health is shown as hearts** (20 HP each). Shop upgrades add heart
  containers.
- **Bosses:** walking into a boss arena seals it behind you. The boss
  telegraphs its slash (lean back, flash), lunges, then recovers, which is
  your window to strike. Below half health it speeds up. The exit door stays
  sealed until the boss falls. Boss damage is doubled across the board by
  `BOSS_DAMAGE_MULTIPLIER` in `constants.js`.
- **Progress** (the furthest stage reached) is saved in the browser, and the
  title screen offers "Continue". Game Over offers a continue that keeps your
  upgrades but halves your gold.

## Project layout

```
index.html, style.css, sw.js, manifest.webmanifest, icons/   the page shell + PWA files
assets/   all image art
sfx/, music/   audio (add these folders when you have files)
js/
  main.js         boot, fixed 60 Hz game loop, menus/shop UI, touch + menu navigation
  game.js         game state machine, combat, camera, HUD
  entities.js     Player, Oni, Ghost, Lantern, Boss, Fireball, Pickup, Door
  level.js        ASCII map parsing + tile collision (the tile legend lives here)
  levels-data.js  the 11 stage layouts
  shops-data.js   shops and their items
  render.js       sky, parallax, buildings, tiles; per-stage color themes
  fx.js           particles, sword trails, pop-up text
  art.js          image analysis + procedurally drawn stand-in art
  assets.js       which files load, and how they become animation sets
  sprite.js       Entity base class + drawFigure() (art is drawn separately from hitboxes)
  input.js        keyboard / gamepad / touch -> actions
  audio.js        sound effects (files with synth fallbacks)
  music.js        background music
  constants.js    every tuning number: speeds, jump, damage, timings
tools/
  serve.py           no-cache dev server
  check-levels.mjs   proves every stage can be finished (see below)
  clean_sprites.py   strips baked-in "transparency" checkerboards from frames
  make_icons.py      builds the favicon / app icons from the heroine's face
```

## Editing levels

Each stage in `js/levels-data.js` is a plain ASCII map, one string per
tile row. Twelve rows fill one screen; maps can be as wide as you like. The
full legend is at the top of `js/level.js`:

```
#  ground          =  sand          :  packed earth     %  stone block
-  shrine beam (jump-through)       _  wooden plank (jump-through)
~  cloud (jump-through)
^  bamboo spikes (hurt + bounce)
P  player start    c  coin          h  heart
o  oni             g  ghost         l  haunted lantern
E  exit door       S  shop door     B  boss    [  boss-arena left wall
```

Background buildings, the color theme (`dawn`, `day`, `dusk`, `night`,
`desert`), shops and boss settings are fields next to each map; see the
comment at the top of `levels-data.js`.

Useful limits: the heroine jumps about 3 tiles high and clears a 3-tile gap
at a run. After changing a map, check it's still beatable:

```bash
node tools/check-levels.mjs
```

The checker runs the game's real physics and tries every run, walk-off and
jump from every reachable spot. It reports any stage whose exit or shop
doors can't be reached, plus any coins that are out of reach.

## Art

The favicon and app icons (`icons/`) are her face, cropped from
`assets/player_idle_right1.png`. If you change her art, rebuild them with
`python tools/make_icons.py`.

Every image lives in `/assets/` and is loaded by `js/assets.js`.
Filenames are fixed: to replace art, overwrite the file at the same path.

**You no longer need exact pixel sizes.** The game measures each image's
visible (non-transparent) area and scales characters to a fixed on-screen
height, with the feet on the ground. Collision boxes are defined in code and
don't depend on image size. The rules that remain:

- Use real transparency (PNG alpha). `python tools/clean_sprites.py`
  converts frames that were exported with a gray checkerboard baked in. It
  has already been run on the walk and victory frames.
- Keep every frame of one character on the same canvas size and framing. The
  first idle frame sets the character's scale, and each frame's lowest
  visible pixel touches the ground.
- Left/right pairs: if a left frame is missing, or is an identical copy of
  the right one, the game mirrors the right frame for you.

**Placeholders are detected automatically.** A file that's still a flat
labeled box (one color covering most of the image) is ignored and a stand-in
is used instead. As soon as you drop in real art, it's used with no code
changes. Current stand-ins:

| Files | Stand-in until real art exists |
|---|---|
| `boss_*`, `boss2_*`, `boss3_*` | the armored warrior painting (`images__3_-removebg-preview.png`), recolored per boss and animated in code (lean, lunge, hop, death fall) |
| `fire_enemy_*` | a procedurally drawn haunted paper lantern (chochin-obake) |
| `gold1-4.png` | a drawn Edo-style mon coin |
| `fireball.png` | a drawn glowing flame |
| `door_exit.png`, `door_shop.png` | a drawn shrine gate / a shop doorway with a noren curtain |
| `player_*_wounded_*` | not used: low health is shown with pulsing hearts and a red screen edge instead |

The flying ghost uses `Suushi_Yurei-removebg-preview.png`. The ground oni
uses the `spider_walk_*` files.

**Tiles** (`1.png`–`10.png`) are stretched to the 150-unit grid, so any
square size works. The game adds the grass lip, ink edges and depth shading.
`1` ground, `9`/`10` sand and packed earth (tinted warm), `5` stone block,
`4`/`3` jump-through beam/plank (only the top strip is shown), `2`/`3`
building walls, `6`/`7`/`8` roofs.

**Backdrop:** `bg_parallax.png` is the distant painting. Its top is faded
into the sky, and it's mirrored every other repeat so it doesn't need to tile
seamlessly. Pine ridges, mist bands and the sun or moon are drawn in code
and colored by each stage's theme.

**Performance note:** the player frames are about 300 KB each (≈30 MB in
total). The 60 victory frames load in the background after the game starts,
but shrinking the player PNGs (e.g. with pngquant) would speed up the first
load a lot, especially on phones.

## Audio

**Music** lives in `music/`. Which files play is set by `TRACKS` at the top
of `js/music.js`:

| Track list | Files | Plays |
|---|---|---|
| `title` | `menu.mp3` | title screen |
| `level` | `level music 1.mp3`, `level music 2.mp3` | each stage picks one at random (kept if you retry the stage) |
| `boss` | `boss 1.mp3`, `boss 2.mp3` | each boss fight picks one at random when the arena seals |
| `victory` | `win.mp3` | ending screen, played once |

To add more tracks, drop the files in `music/` and add their names to the
matching list. Tracks loop (except the win track) and crossfade into each
other.

**Sound effects** live in `sfx/` as `<name>.wav` (`.mp3` and `.ogg` also
work). Numbered variants such as `attack2.wav` and `attack3.wav` are picked
at random. A name with no file plays a synthesized blip.

`jump`, `land`, `slash` (sword swish), `attack` (her shout), `hit`,
`enemyDie`, `hurt`, `die`, `coin`, `heal`, `buy`, `door`, `locked`,
`fireball`, `windup` (boss telegraph), `bossSlash`, `bossRoar` (arena
sealed), `bossDefeat`, `pause`, `menu`

The current set is generated by `python tools/make_sfx.py` (Windows, needs
numpy and scipy):

- **Her voice:** Japanese kiai shouts when attacking (ヤッ / ハッ / エイッ /
  ヤァッ), cries when hit (キャッ / アッ / イタッ) and a scream on death. These
  start from Windows' built-in Japanese text-to-speech voice (Microsoft
  Haruka), then get pitch-raised, tightened, saturated and given a little
  room reverb.
- **Boss roar:** the same voice pitched far down, distorted and layered with
  a taiko hit.
- **Everything else** is synthesized: sword swishes, impact thuds, a coin
  clink, koto-style plucks for healing and buying, wood blocks for menus, a
  sliding door, taiko and gong for a boss defeat.

Her shouts share one voice channel (a new line cuts off the last one), and
the attack shout has a short cooldown so fast slashing doesn't stutter.
Open <http://localhost:8000/tools/sfx-preview.html> to audition every file.
For a more polished result, swap in real voice recordings under the same
names.
