import {
  TILE, CANVAS_WIDTH, CANVAS_HEIGHT, VIEW_SCALE, VIEW_WIDTH, VIEW_HEIGHT, LEFT_FACING,
  MAX_HEALTH, HEART_VALUE, BASE_ATTACK, ATTACK_TOTAL_TICKS, ATTACK_ACTIVE_START, ATTACK_ACTIVE_END,
  STARTING_LIVES, MAX_LIVES, LEVEL_INTRO_TICKS, DEATH_ANIM_TICKS, VICTORY_VARIANT_COUNT,
  HITSTOP_HIT, HITSTOP_KILL, HITSTOP_HURT, HEART_DROP_CHANCE, HEART_PICKUP_HEAL, GHOST_MAX_HOVER,
  BOSS_DAMAGE_MULTIPLIER, NG_PLUS_BLOOD_SCALE,
} from './constants.js';
import {
  Player, Oni, Ghost, Lantern, Boss, Fireball, Pickup, Door, drawHeart,
} from './entities.js';
import { boxesOverlap } from './sprite.js';
import { Level } from './level.js';
import { LEVELS } from './levels-data.js';
import { SHOPS } from './shops-data.js';
import { Effects } from './fx.js';
import { WorldRenderer, THEMES } from './render.js';
import { BloodSpatter } from './blood.js';

const HUD_FONT = '"Yuji Syuku", "Yu Mincho", serif';

// Contact damage uses a slightly shrunken enemy box - brushing the very edge
// of a sprite shouldn't hurt.
function innerBox(e, inset = 0.18) {
  const ix = e.w * inset;
  const iy = e.h * inset * 0.5;
  return { left: e.left + ix, right: e.right - ix, top: e.top + iy, bottom: e.bottom - iy };
}

export class Game {
  constructor(canvas, images, art, sfx, music) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.images = images;
    this.art = art;
    this.sfx = sfx;
    this.music = music;
    this.fx = new Effects();
    this.world = new WorldRenderer(art);
    this.blood = new BloodSpatter();
    this.state = 'start';
    this.time = 0;
    this.levelIndex = 0;
    this.level = null;
    this.player = null;
    this.camX = 0;
    this.camY = 0;
    this.lookAhead = 0;
    this.shake = 0;
    this.hitstop = 0;
    this.showHitboxes = false;
    this.plus = 0; // New Game+ loop (0 = first playthrough)
    this.resetProgress();
  }

  resetProgress() {
    this.gold = 0;
    this.totalGoldEarned = 0;
    this.enemiesDefeated = 0;
    this.lives = STARTING_LIVES;
    this.persistentStats = {
      maxHealth: MAX_HEALTH,
      attackStrength: BASE_ATTACK,
      gravityScale: 1,
      attackTotalTicks: ATTACK_TOTAL_TICKS,
      attackActiveStart: ATTACK_ACTIVE_START,
      attackActiveEnd: ATTACK_ACTIVE_END,
    };
    this.purchasedOneTimeItems = new Set();
  }

  startNewGame(levelIndex = 0) {
    this.resetProgress();
    this.plus = 0;
    this.enterLevelIntro(levelIndex, { respawn: false });
  }

  // New Game+: back to stage 1 with every upgrade carried over (`carry` is
  // a runSnapshot() taken when the game was beaten). `plus` is the loop
  // number - 1 for the first NG+, 2 for the next, and so on. More enemies
  // (see addNewGamePlusEnemies) and 3x blood spatter.
  startNewGamePlus(carry, plus) {
    this.resetProgress();
    this.persistentStats = { ...this.persistentStats, ...(carry?.stats ?? {}) };
    this.purchasedOneTimeItems = new Set(carry?.oneTime ?? []);
    this.plus = Math.max(1, plus);
    this.enterLevelIntro(0, { respawn: false });
  }

  // Everything needed to pick a run back up later (Continue) or carry its
  // upgrades into New Game+.
  runSnapshot() {
    return {
      plus: this.plus,
      stats: { ...this.persistentStats },
      oneTime: [...this.purchasedOneTimeItems],
      gold: this.gold,
      totalGoldEarned: this.totalGoldEarned,
      enemiesDefeated: this.enemiesDefeated,
    };
  }

  // Continue from the title screen: restores a saved run at `levelIndex`.
  restoreRun(snapshot, levelIndex) {
    this.resetProgress();
    this.plus = snapshot.plus ?? 0;
    this.persistentStats = { ...this.persistentStats, ...snapshot.stats };
    this.purchasedOneTimeItems = new Set(snapshot.oneTime ?? []);
    this.gold = snapshot.gold ?? 0;
    this.totalGoldEarned = snapshot.totalGoldEarned ?? 0;
    this.enemiesDefeated = snapshot.enemiesDefeated ?? 0;
    this.enterLevelIntro(levelIndex, { respawn: false });
  }

  // Game over -> keep upgrades, restart the current level with fresh lives.
  continueGame() {
    this.lives = STARTING_LIVES;
    this.gold = Math.floor(this.gold / 2);
    this.enterLevelIntro(this.levelIndex, { respawn: false });
  }

  finalScore() {
    return this.totalGoldEarned * 10 + this.enemiesDefeated * 50;
  }

  hasNextLevel() {
    return this.levelIndex + 1 < LEVELS.length;
  }

  advanceToNextLevel() {
    if (this.hasNextLevel()) this.enterLevelIntro(this.levelIndex + 1, { respawn: false });
  }

  get levelData() {
    return LEVELS[this.levelIndex];
  }

  get theme() {
    return THEMES[this.levelData?.theme] ?? THEMES.day;
  }

  enterLevelIntro(index, { respawn }) {
    this.introFromHealth = this.player ? this.player.health : this.persistentStats.maxHealth;
    this.introFromMax = this.player ? this.player.maxHealth : this.persistentStats.maxHealth;
    this.introRespawn = respawn;
    this.introTicks = 0;
    this.levelIndex = index;
    this.buildLevel();
    this.state = 'levelintro';
    this.music?.playLevel(index + 1, this.boss ? this.boss.assetPrefix : null);
  }

  buildLevel() {
    const data = LEVELS[this.levelIndex];
    const level = new Level(data);
    const { art } = this;
    this.level = level;
    this.player = new Player(art.player, this.persistentStats);
    this.enemies = [];
    this.lanterns = [];
    this.pickups = [];
    this.fireballs = [];
    this.doors = [];
    this.boss = null;
    this.arena = null;
    this.bossIntroTicks = 0;
    this.levelGold = 0;
    this.levelKills = 0;
    this.fx.clear();
    this.blood.clear(); // spatter lasts until the stage ends or a life is lost

    let start = { x: TILE * 1.5, feetY: TILE * 10 };
    for (const s of level.spawns) {
      switch (s.type) {
        case 'P': start = s; break;
        case 'c': this.pickups.push(new Pickup('coin', s.x, s.feetY - TILE / 2)); break;
        case 'h': this.pickups.push(new Pickup('heart', s.x, s.feetY - TILE / 2)); break;
        case 'o': this.enemies.push(new Oni(art.oni, s.x, s.feetY)); break;
        case 'g': this.enemies.push(new Ghost(art.ghost, s.x, this.ghostHoverFeet(level, s), data.ghostRange ?? 3)); break;
        case 'l': this.lanterns.push(new Lantern(art.lantern, s.x, s.feetY)); break;
        case 'E': this.doors.push(new Door('exit', s.x, s.feetY, art.doorExit)); break;
        case 'S': this.doors.push(new Door('shop', s.x, s.feetY, art.doorShop, s.shopId)); break;
        case 'B':
          if (data.boss) {
            this.boss = new Boss(art.boss[data.boss.assetPrefix] ?? art.boss.boss, s.x, s.feetY, data.boss);
          }
          break;
        default: break;
      }
    }
    if (this.boss) for (const d of this.doors) if (d.kind === 'exit') d.locked = true;
    if (this.plus > 0) this.addNewGamePlusEnemies(level, Math.min(2, this.plus));
    this.blood.scale = this.plus > 0 ? NG_PLUS_BLOOD_SCALE : 1;

    this.player.centerX = start.x;
    this.player.bottom = start.feetY;
    this.player.onGround = true;
    this.hudHealth = this.player.health;
    this.bossHudHealth = this.boss ? this.boss.health : 0;
    this.activeDoor = null;
    this.activeShopId = null;
    this.camX = this.clampCamX(this.player.centerX - VIEW_WIDTH * 0.4);
    this.camY = this.clampCamY(this.player.bottom - VIEW_HEIGHT * 0.75);
    this.lookAhead = 0;
    this.shake = 0;
    this.hitstop = 0;
    this.fade = 0;
    this.doorTransition = null;
  }

  // New Game+: every oni, lantern and ghost gets `count` partners. Ground
  // partners follow the same rule as the maps - at least 2 tiles back from
  // any ledge or wall, and not crowding doors, the start or each other.
  addNewGamePlusEnemies(level, count) {
    const { art } = this;
    const data = LEVELS[this.levelIndex];
    const arenaCol = level.arenaLeft == null ? Infinity : level.arenaLeft / TILE;
    const keepClear = level.spawns.filter((s) => 'PESB'.includes(s.type)).map((s) => s.col);
    const taken = level.spawns.filter((s) => 'olg'.includes(s.type)).map((s) => [s.col, s.row]);
    const walkable = (col, row) => level.isSolid(col, row + 1) && !level.isSolid(col, row)
      && !level.terrainAt(col, row);
    const free = (col, row) => !taken.some(([c, r]) => Math.abs(c - col) < 2 && Math.abs(r - row) <= 1)
      && !keepClear.some((c) => Math.abs(c - col) <= 3) && col >= 8 && col < arenaCol - 1;

    for (const s of level.spawns.filter((sp) => 'olg'.includes(sp.type) && sp.col < arenaCol)) {
      for (let k = 0; k < count; k++) {
        let col = null;
        if (s.type === 'g') {
          for (const off of [4, -4, 6, -6, 8, -8]) {
            const c = s.col + off + Math.sign(off) * k * 2;
            if (c >= 8 && c < arenaCol - 1 && free(c, s.row)) { col = c; break; }
          }
          if (col == null) continue;
          const spawn = { ...s, col, x: col * TILE + TILE / 2 };
          this.enemies.push(new Ghost(art.ghost, spawn.x, this.ghostHoverFeet(level, spawn), data.ghostRange ?? 3));
        } else {
          let lo = s.col;
          let hi = s.col;
          while (lo > 0 && walkable(lo - 1, s.row)) lo--;
          while (hi < level.cols - 1 && walkable(hi + 1, s.row)) hi++;
          for (let d = 2; d <= hi - lo; d++) {
            for (const c of [s.col + d, s.col - d]) {
              if (c >= lo + 2 && c <= hi - 2 && free(c, s.row)) { col = c; break; }
            }
            if (col != null) break;
          }
          if (col == null) continue;
          const x = col * TILE + TILE / 2;
          const feetY = (s.row + 1) * TILE;
          if (s.type === 'o') this.enemies.push(new Oni(art.oni, x, feetY));
          else this.lanterns.push(new Lantern(art.lantern, x, feetY));
        }
        taken.push([col, s.row]);
      }
    }
  }

  // Ghosts hover no higher than GHOST_MAX_HOVER above the floor beneath
  // them (whatever the map says), so their swoop always reaches a player
  // walking along the lower ground.
  ghostHoverFeet(level, spawn) {
    let floorRow = level.rows;
    for (let row = spawn.row + 1; row < level.rows; row++) {
      if (level.terrainAt(spawn.col, row)) {
        floorRow = row;
        break;
      }
    }
    return Math.max(spawn.feetY, floorRow * TILE - GHOST_MAX_HOVER);
  }

  // ------------------------------------------------------------------------
  // Shops
  // ------------------------------------------------------------------------
  currentShop() {
    return this.activeShopId ? SHOPS[this.activeShopId] : null;
  }

  buyItem(itemId) {
    const shop = this.currentShop();
    const item = shop?.items.find((i) => i.id === itemId);
    if (!item) return { ok: false, reason: 'unknown-item' };
    if (item.oneTime && this.purchasedOneTimeItems.has(item.id)) return { ok: false, reason: 'already-owned' };
    if (this.gold < item.cost) return { ok: false, reason: 'not-enough-gold' };
    const { player } = this;
    if ((item.kind === 'potion' || item.kind === 'fullheal') && player.health >= player.maxHealth) {
      return { ok: false, reason: 'full-health' };
    }

    this.gold -= item.cost;
    const stats = this.persistentStats;
    switch (item.kind) {
      case 'potion':
        player.health = Math.min(player.maxHealth, player.health + item.amount);
        break;
      case 'fullheal':
        player.health = player.maxHealth;
        break;
      case 'heart':
        player.maxHealth += item.amount;
        player.health = Math.min(player.maxHealth, player.health + item.amount);
        stats.maxHealth = player.maxHealth;
        break;
      case 'maxHealthPercent': {
        const increase = Math.round(player.maxHealth * item.amount);
        player.maxHealth += increase;
        player.health = Math.min(player.maxHealth, player.health + increase);
        stats.maxHealth = player.maxHealth;
        break;
      }
      case 'weapon':
        player.attackStrength += item.amount;
        stats.attackStrength = player.attackStrength;
        break;
      case 'weaponMultiplier':
        player.attackStrength = Math.round(player.attackStrength * item.amount);
        stats.attackStrength = player.attackStrength;
        break;
      case 'oneup':
        this.lives = Math.min(MAX_LIVES, this.lives + 1);
        break;
      case 'floatBoots':
        player.gravityScale *= item.amount;
        stats.gravityScale = player.gravityScale;
        break;
      case 'attackSpeed':
        player.attackTotalTicks = Math.max(8, Math.round(player.attackTotalTicks * item.amount));
        player.attackActiveStart = Math.max(1, Math.round(player.attackActiveStart * item.amount));
        player.attackActiveEnd = Math.max(player.attackActiveStart + 3, Math.round(player.attackActiveEnd * item.amount));
        stats.attackTotalTicks = player.attackTotalTicks;
        stats.attackActiveStart = player.attackActiveStart;
        stats.attackActiveEnd = player.attackActiveEnd;
        break;
      default:
        break;
    }
    if (item.oneTime) this.purchasedOneTimeItems.add(item.id);
    this.hudHealth = Math.min(this.hudHealth, player.health);
    this.sfx?.play('buy');
    return { ok: true };
  }

  exitShop() {
    this.activeShopId = null;
    this.state = 'playing';
    this.fade = 1; // fades back in (see update)
  }

  pause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.sfx?.play('pause');
    }
  }

  resume() {
    if (this.state === 'paused') this.state = 'playing';
  }

  togglePause() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  // ------------------------------------------------------------------------
  // Simulation
  // ------------------------------------------------------------------------
  update(input) {
    this.time++;
    if (input.wasPressed('pause') && (this.state === 'playing' || this.state === 'paused')) {
      this.togglePause();
      return;
    }

    switch (this.state) {
      case 'levelintro':
        this.introTicks++;
        if (this.introTicks > 20 && (input.wasPressed('jump') || input.wasPressed('attack'))) this.introTicks = LEVEL_INTRO_TICKS;
        if (this.introTicks >= LEVEL_INTRO_TICKS) this.state = 'playing';
        return;
      case 'dying':
        this.updateDying();
        return;
      case 'bossdefeated':
        this.player.updateVictory();
        this.fx.update();
        this.updatePickups();
        if (!this.player.inVictory) this.state = 'playing';
        return;
      case 'playing':
        this.updatePlaying(input);
        if (this.fade > 0) this.fade = Math.max(0, this.fade - 0.08);
        return;
      case 'entering': {
        const t = this.doorTransition;
        t.tick++;
        const p = this.player;
        p.centerX += (t.door.centerX - p.centerX) * 0.25;
        p.animTick++;
        this.fade = Math.min(1, t.tick / 18);
        if (t.tick >= 22) {
          if (t.next === 'shop') this.activeShopId = t.door.shopId;
          this.state = t.next;
        }
        return;
      }
      default:
        // Menus/shop: keep ambient effects alive behind the overlay.
        this.fx.update();
    }
  }

  updatePlaying(input) {
    this.blood.update();
    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }
    const { player, level, fx } = this;

    player.update(input, level);
    this.applyArenaWalls(player);
    for (const ev of player.events) {
      if (ev === 'jump') {
        fx.dust(player.centerX, player.bottom, 5, 0.7);
        this.sfx?.play('jump');
      } else if (ev === 'land') {
        fx.dust(player.centerX, player.bottom, 8);
        this.sfx?.play('land');
      } else if (ev === 'attack') {
        fx.slash(player, {
          radius: 150, offsetX: 34, offsetY: player.h * 0.42, life: Math.max(6, player.attackActiveEnd - 1),
        });
        this.sfx?.play('slash');
        this.sfx?.play('attack');
      } else if (ev === 'step' && Math.random() < 0.5) {
        fx.dust(player.centerX - player.facing * 20, player.bottom, 1, 0.4);
      }
    }

    // --- enemies ---
    for (const e of this.enemies) e.update(level, player);
    for (const l of this.lanterns) {
      const spec = l.update(level, player, this.isOnScreen(l));
      if (spec) {
        this.fireballs.push(new Fireball(this.art.fireball, spec));
        this.sfx?.play('fireball');
      }
    }
    this.updateBoss();

    // --- player's sword ---
    if (player.isAttackActive()) this.resolvePlayerAttack();

    // --- fireballs ---
    for (const f of this.fireballs) {
      f.update(level);
      if (this.time % 2 === 0) fx.ember(f.centerX, f.centerY);
      if (f.alive && boxesOverlap(f, innerBox(player, 0.1))) {
        f.alive = false;
        this.hurtPlayer(f.damage, f.centerX - f.vx);
      }
      if (!f.alive) fx.sparks(f.centerX, f.centerY, Math.sign(f.vx) || 1, 6, '#ffb347');
    }
    this.fireballs = this.fireballs.filter((f) => f.alive);

    // --- contact damage ---
    const threats = [...this.enemies, ...this.lanterns];
    if (this.boss?.harmful) threats.push(this.boss);
    for (const e of threats) {
      if (e.harmful && boxesOverlap(innerBox(player, 0.05), innerBox(e))) {
        this.hurtPlayer(e.damage, e.centerX);
        break;
      }
    }
    if (this.boss?.isAttackActive() && boxesOverlap(this.boss.getAttackHitbox(), player)) {
      this.boss.hitThisSwing = true;
      this.hurtPlayer(this.boss.damage, this.boss.centerX);
    }
    if (level.touchesHazard(player) && player.invulnTicks <= 0) {
      this.hurtPlayer(10, player.centerX - player.facing * 10);
      player.vy = -26;
    }

    this.updatePickups();

    // --- doors ---
    this.activeDoor = this.doors.find((d) => boxesOverlap(innerBox(player, 0), d) && player.onGround) ?? null;
    if (this.activeDoor && input.wasPressed('up')) {
      const door = this.activeDoor;
      if (door.locked) {
        this.sfx?.play('locked');
        fx.popup(door.centerX, door.y - 30, 'Sealed!', '#ffb0a0');
      } else {
        // Step into the doorway and fade out before the shop / stage-clear screen.
        this.doorTransition = {
          door,
          tick: 0,
          next: door.kind === 'shop' ? 'shop' : (this.hasNextLevel() ? 'levelcomplete' : 'gamecomplete'),
        };
        this.state = 'entering';
        player.vx = 0;
        player.attacking = false;
        this.sfx?.play('door');
      }
    }

    // --- death ---
    if (player.health <= 0 || player.top > level.heightPx + 40) {
      this.startDying(player.health <= 0 ? 'health' : 'fall');
      return;
    }

    this.updateCamera();
    this.updateAmbient();
    fx.update();
  }

  resolvePlayerAttack() {
    const { player, fx } = this;
    const hitbox = player.getAttackHitbox();
    const targets = [...this.enemies, ...this.lanterns];
    if (this.boss?.alive && this.boss.state !== 'waiting') targets.push(this.boss);
    for (const e of targets) {
      if (!e.alive || player.hitThisSwing.has(e) || !boxesOverlap(hitbox, e)) continue;
      player.hitThisSwing.add(e);
      const killed = e.takeHit(player.attackStrength, player.centerX);
      const hx = player.facing === LEFT_FACING ? Math.max(hitbox.left, e.left) : Math.min(hitbox.right, e.right);
      const hy = Math.max(hitbox.top, Math.min(hitbox.bottom, e.centerY));
      fx.sparks(hx, hy, player.facing, 12);
      this.splatter(hx, hy, 1);
      if (killed) {
        this.hitstop = HITSTOP_KILL;
        this.shake = Math.max(this.shake, 10);
        if (e !== this.boss) this.onEnemyKilled(e);
        else this.sfx?.play('bossDefeat');
      } else {
        this.hitstop = HITSTOP_HIT;
        this.shake = Math.max(this.shake, 5);
        this.sfx?.play('hit');
      }
    }
    // Slashing a fireball snuffs it out.
    for (const f of this.fireballs) {
      if (f.alive && boxesOverlap(hitbox, f)) {
        f.alive = false;
        fx.sparks(f.centerX, f.centerY, player.facing, 10, '#ffd27a');
        this.sfx?.play('hit');
      }
    }
  }

  onEnemyKilled(e) {
    this.enemiesDefeated++;
    this.levelKills++;
    this.fx.inkBurst(e.centerX, e.centerY);
    this.sfx?.play('enemyDie');
    this.dropLoot(e.centerX, e.centerY, e.coinDrop + (Math.random() < 0.35 ? 1 : 0));
    this.enemies = this.enemies.filter((x) => x !== e);
    this.lanterns = this.lanterns.filter((x) => x !== e);
  }

  dropLoot(x, y, coins, heartChance = HEART_DROP_CHANCE) {
    for (let i = 0; i < coins; i++) this.pickups.push(new Pickup('coin', x, y, { dropped: true }));
    if (Math.random() < heartChance) this.pickups.push(new Pickup('heart', x, y, { dropped: true }));
  }

  // Flicks blood onto the screen from a hit at world position (x, y).
  splatter(x, y, strength) {
    this.blood.spray((x - this.camX) * VIEW_SCALE, (y - this.camY) * VIEW_SCALE, strength);
  }

  hurtPlayer(amount, fromX) {
    if (!this.player.hurt(amount, fromX)) return;
    this.splatter(this.player.centerX, this.player.centerY, 1.6);
    this.hitstop = HITSTOP_HURT;
    this.shake = Math.max(this.shake, 14);
    this.sfx?.play('hurt');
    this.fx.sparks(this.player.centerX, this.player.centerY, fromX < this.player.centerX ? 1 : -1, 10, '#ff6b6b');
  }

  updateBoss() {
    const { boss, player, level, fx } = this;
    if (!boss) return;

    // Crossing into the arena seals it behind you and wakes the boss.
    if (!this.arena && boss.state === 'waiting' && level.arenaLeft != null && player.x > level.arenaLeft + TILE) {
      this.arena = { left: level.arenaLeft, right: level.widthPx };
      boss.setState('walk');
      this.bossIntroTicks = 150;
      this.shake = 16;
      this.sfx?.play('bossRoar');
      this.music?.setBossActive(true);
    }
    if (this.bossIntroTicks > 0) this.bossIntroTicks--;

    if (boss.state === 'dying') {
      boss.update(level, player, this.arena);
      if (this.time % 5 === 0) {
        fx.inkBurst(boss.centerX + (Math.random() - 0.5) * boss.w * 1.5, boss.y + Math.random() * boss.h, 0.7);
        this.shake = Math.max(this.shake, 6);
      }
      if (boss.deathDone) {
        fx.inkBurst(boss.centerX, boss.centerY, 2);
        this.dropLoot(boss.centerX, boss.centerY, boss.coinDrop, 1);
        this.enemiesDefeated++;
        this.levelKills++;
        this.boss = null;
        this.arena = null;
        for (const d of this.doors) d.locked = false;
        this.music?.setBossActive(false);
        this.player.startVictory(Math.floor(Math.random() * VICTORY_VARIANT_COUNT));
        this.state = 'bossdefeated';
      }
      return;
    }

    const shot = boss.update(level, player, this.arena);
    if (shot) {
      this.fireballs.push(new Fireball(this.art.fireball, shot, 10 * BOSS_DAMAGE_MULTIPLIER));
      this.sfx?.play('fireball');
    }
    for (const ev of boss.events) {
      if (ev === 'land') {
        fx.dust(boss.centerX, boss.bottom, 14, 2);
        this.shake = Math.max(this.shake, 12);
        this.sfx?.play('land');
      } else if (ev === 'slash') {
        fx.slash(boss, { radius: 260, offsetX: 40, offsetY: boss.h * 0.4, life: 12, color: 'rgba(255,90,60,0)' });
        this.sfx?.play('bossSlash');
      } else if (ev === 'windup') {
        this.sfx?.play('windup');
      }
    }
  }

  applyArenaWalls(e) {
    if (!this.arena) return;
    if (e.x < this.arena.left) { e.x = this.arena.left; e.vx = Math.max(0, e.vx); }
    if (e.right > this.arena.right) { e.x = this.arena.right - e.w; e.vx = Math.min(0, e.vx); }
  }

  updatePickups() {
    const { player, level, fx } = this;
    for (const p of this.pickups) {
      p.update(level);
      if (!p.alive || !p.collectable || !boxesOverlap(p, player)) continue;
      p.alive = false;
      if (p.kind === 'coin') {
        this.gold += p.value;
        this.totalGoldEarned += p.value;
        this.levelGold += p.value;
        fx.sparkle(p.centerX, p.centerY);
        this.sfx?.play('coin');
      } else {
        player.health = Math.min(player.maxHealth, player.health + HEART_PICKUP_HEAL);
        fx.sparkle(p.centerX, p.centerY, '#ff8a8a');
        fx.popup(p.centerX, p.y, '+♥', '#ff9a9a');
        this.sfx?.play('heal');
      }
    }
    this.pickups = this.pickups.filter((p) => p.alive);
  }

  startDying(cause) {
    this.lives--;
    this.deathCause = cause;
    this.deathOutcome = this.lives > 0 ? 'respawn' : 'gameover';
    this.deathTick = 0;
    this.state = 'dying';
    const p = this.player;
    p.attacking = false;
    p.flash = 1;
    p.vx = 0;
    p.vy = cause === 'fall' ? 0 : -24;
    this.shake = 12;
    this.music?.setBossActive(false);
    this.sfx?.play('die');
  }

  updateDying() {
    this.deathTick++;
    this.blood.update();
    const p = this.player;
    // A brief freeze, then the classic hop-and-fall off the screen.
    if (this.deathTick > 24 && this.deathCause !== 'fall') {
      p.vy += 1.4;
      p.y += p.vy;
    }
    p.flash = Math.max(0, p.flash - 0.05);
    this.fade = Math.max(0, (this.deathTick - (DEATH_ANIM_TICKS - 24)) / 24);
    this.fx.update();
    if (this.deathTick >= DEATH_ANIM_TICKS) {
      if (this.deathOutcome === 'respawn') this.enterLevelIntro(this.levelIndex, { respawn: true });
      else this.state = 'gameover';
    }
  }

  // ------------------------------------------------------------------------
  // Camera
  // ------------------------------------------------------------------------
  clampCamX(x) {
    const minX = this.arena ? Math.max(0, Math.min(this.arena.left, this.arena.right - VIEW_WIDTH)) : 0;
    return Math.max(minX, Math.min(this.level.widthPx - VIEW_WIDTH, x));
  }

  clampCamY(y) {
    return Math.max(0, Math.min(this.level.heightPx - VIEW_HEIGHT, y));
  }

  updateCamera() {
    const p = this.player;
    // Look ahead in the direction of travel so you can see what's coming.
    const targetLook = Math.abs(p.vx) > 2 ? p.facing * 260 : this.lookAhead * 0.98;
    this.lookAhead += (targetLook - this.lookAhead) * 0.04;
    const tx = this.clampCamX(p.centerX + this.lookAhead - VIEW_WIDTH / 2);
    this.camX += (tx - this.camX) * 0.14;
    const ty = this.clampCamY(p.bottom - VIEW_HEIGHT * 0.72);
    this.camY += (ty - this.camY) * (p.onGround ? 0.12 : 0.05);
    this.camX = this.clampCamX(this.camX);
    this.shake *= 0.85;
    if (this.shake < 0.3) this.shake = 0;
  }

  isOnScreen(e, margin = 0) {
    return e.right > this.camX - margin && e.left < this.camX + VIEW_WIDTH + margin
      && e.bottom > this.camY - margin && e.top < this.camY + VIEW_HEIGHT + margin;
  }

  updateAmbient() {
    const { theme } = this;
    if (theme.petals && this.time % 9 === 0) {
      this.fx.petal(this.camX + VIEW_WIDTH * (0.3 + Math.random() * 0.9), this.camY - 40, theme.petals);
    }
  }

  // ------------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------------
  render() {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (!this.level || this.state === 'start' || this.state === 'levelintro') {
      this.renderAttract();
      return;
    }

    const theme = this.theme;
    const shakeX = this.shake ? (Math.random() - 0.5) * this.shake * 2 : 0;
    const shakeY = this.shake ? (Math.random() - 0.5) * this.shake * 2 : 0;
    const camX = this.camX + shakeX;
    const camY = this.camY + shakeY;

    this.world.drawSky(ctx, theme, camX, camY, this.time);
    this.world.drawParallax(ctx, theme, camX, camY);

    ctx.setTransform(VIEW_SCALE, 0, 0, VIEW_SCALE, -Math.round(camX * VIEW_SCALE), -Math.round(camY * VIEW_SCALE));
    const view = { left: camX, right: camX + VIEW_WIDTH, top: camY, bottom: camY + VIEW_HEIGHT };

    this.world.drawBuildings(ctx, this.level, view);
    for (const d of this.doors) d.draw(ctx);
    this.drawArenaGate(ctx);
    this.world.drawTiles(ctx, this.level, view, theme);

    for (const p of this.pickups) p.draw(ctx, this.art.coin);
    for (const l of this.lanterns) if (this.isOnScreen(l, 200)) l.draw(ctx);
    for (const e of this.enemies) if (this.isOnScreen(e, 300)) this.drawWithShadow(e);
    if (this.boss) this.drawWithShadow(this.boss);
    if (this.state === 'dying') {
      this.drawDyingPlayer(ctx);
    } else if (this.state === 'entering' || (this.doorTransition && this.fade > 0.5)) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - this.fade * 1.4);
      this.player.draw(ctx);
      ctx.restore();
    } else {
      this.drawWithShadow(this.player);
    }
    for (const f of this.fireballs) f.draw(ctx);
    this.fx.draw(ctx, 'front');
    this.drawDoorPrompt(ctx);
    if (this.showHitboxes) this.drawHitboxes(ctx);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.renderVignette(ctx);
    this.blood.draw(ctx);
    this.renderHud(ctx);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(12,6,4,${this.fade})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }

  // Soft contact shadow under grounded characters.
  drawWithShadow(e) {
    const { ctx } = this;
    if (e.onGround && !(e instanceof Ghost)) {
      ctx.fillStyle = 'rgba(20,12,8,0.28)';
      ctx.beginPath();
      ctx.ellipse(e.centerX, e.bottom - 2, e.w * 0.75, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    e.draw(ctx);
  }

  drawDyingPlayer(ctx) {
    const p = this.player;
    ctx.save();
    if (this.deathTick > 24) {
      ctx.translate(p.centerX, p.centerY);
      ctx.rotate((this.deathTick - 24) * 0.12 * -p.facing);
      ctx.translate(-p.centerX, -p.centerY);
    }
    if (this.deathCause === 'fall') ctx.globalAlpha = Math.max(0, 1 - this.deathTick / 30);
    p.draw(ctx);
    ctx.restore();
  }

  drawArenaGate(ctx) {
    if (!this.arena) return;
    // A wall of hanging paper talismans sealing the arena's left edge.
    const x = this.arena.left;
    const h = this.level.heightPx;
    ctx.fillStyle = 'rgba(120,20,20,0.25)';
    ctx.fillRect(x - 30, 0, 30, h);
    for (let y = 40; y < h; y += 130) {
      const sway = Math.sin(this.time * 0.05 + y) * 6;
      ctx.fillStyle = '#f4ecd0';
      ctx.fillRect(x - 40 + sway, y, 36, 100);
      ctx.strokeStyle = '#1b1210';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 40 + sway, y, 36, 100);
      ctx.fillStyle = '#b3241a';
      ctx.fillRect(x - 32 + sway, y + 20, 20, 60);
    }
  }

  drawDoorPrompt(ctx) {
    const d = this.activeDoor;
    if (!d || this.state !== 'playing') return;
    const bob = Math.sin(this.time * 0.15) * 8;
    const x = d.centerX;
    const y = d.y - 70 + bob;
    ctx.fillStyle = '#fff8e6';
    ctx.strokeStyle = '#1b1210';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = d.locked ? '#b3241a' : '#1b1210';
    ctx.beginPath();
    if (d.locked) {
      ctx.font = `52px ${HUD_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('封', x, y + 2);
    } else {
      ctx.moveTo(x, y - 22);
      ctx.lineTo(x + 22, y + 12);
      ctx.lineTo(x - 22, y + 12);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawHitboxes(ctx) {
    ctx.lineWidth = 3;
    const box = (b, c) => {
      ctx.strokeStyle = c;
      ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    };
    box(this.player, '#0f0');
    if (this.player.isAttackActive()) box(this.player.getAttackHitbox(), '#ff0');
    for (const e of [...this.enemies, ...this.lanterns]) box(e, '#f00');
    if (this.boss) {
      box(this.boss, '#f0f');
      if (this.boss.isAttackActive()) box(this.boss.getAttackHitbox(), '#f80');
    }
    for (const f of this.fireballs) box(f, '#fa0');
    for (const d of this.doors) box(d, '#0ff');
  }

  renderVignette(ctx) {
    const g = ctx.createRadialGradient(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.45, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 1.05,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(30,15,5,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // Low health: a red pulse at the screen edges.
    const p = this.player;
    if (p && p.health > 0 && p.health <= p.maxHealth * 0.25) {
      const a = 0.18 + Math.sin(this.time * 0.12) * 0.1;
      const r = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.5, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 1.1,
      );
      r.addColorStop(0, 'rgba(200,0,0,0)');
      r.addColorStop(1, `rgba(200,0,0,${a})`);
      ctx.fillStyle = r;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }

  // Title / intro backdrop: the first level's scenery slowly panning by.
  renderAttract() {
    const { ctx } = this;
    const theme = THEMES.dawn;
    const camX = this.time * 1.5;
    this.world.drawSky(ctx, theme, camX, 0, this.time);
    this.world.drawParallax(ctx, theme, camX, 0);
    this.drawTitleGhosts(ctx);
    if (this.time % 7 === 0) this.fx.petal(Math.random() * CANVAS_WIDTH * 1.3, -20, theme.petals);
    this.fx.update();
    this.fx.draw(ctx, 'front');
  }

  // Title-screen ambience: now and then a yurei drifts across the backdrop
  // from right to left, blurred (more so the further away it is) so it reads
  // as something glimpsed through the mist rather than a gameplay enemy.
  // Driven by this.time (simulation ticks), so its speed doesn't depend on
  // the display's refresh rate.
  drawTitleGhosts(ctx) {
    const frame = this.art.ghost.fly?.left[0];
    if (!frame) return;
    this.titleGhosts ??= [];
    this.nextTitleGhost ??= this.time + 90;
    if (this.time >= this.nextTitleGhost) {
      const depth = Math.random(); // 0 = far, 1 = near
      this.titleGhosts.push({
        born: this.time,
        depth,
        y: CANVAS_HEIGHT * (0.18 + Math.random() * 0.4),
        height: 150 + depth * 230,
        speed: 2.2 + depth * 3.5 + Math.random(),
        wobble: Math.random() * Math.PI * 2,
      });
      this.nextTitleGhost = this.time + 240 + Math.random() * 420;
    }
    for (const g of this.titleGhosts) {
      const t = this.time - g.born;
      const h = g.height;
      const w = h * (frame.width / frame.height);
      g.x = CANVAS_WIDTH + w - t * g.speed;
      const y = g.y + Math.sin(t * 0.03 + g.wobble) * 30;
      ctx.save();
      ctx.globalAlpha = 0.35 + g.depth * 0.3;
      ctx.translate(g.x, y);
      ctx.rotate(Math.sin(t * 0.02 + g.wobble) * 0.08 - 0.12);
      ctx.drawImage(this.blurredGhost(frame, g.depth < 0.5 ? 2 : 1), -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    this.titleGhosts = this.titleGhosts.filter((g) => g.x > -400);
  }

  // A soft-focus copy of `img`, made by shrinking it and scaling back up
  // (works everywhere, unlike canvas blur filters). `level` 1 = soft, 2 = very soft.
  blurredGhost(img, level) {
    this.blurCache ??= new Map();
    const key = level;
    if (this.blurCache.has(key)) return this.blurCache.get(key);
    const shrink = level === 2 ? 0.05 : 0.09;
    const small = document.createElement('canvas');
    small.width = Math.max(2, Math.round(img.width * shrink));
    small.height = Math.max(2, Math.round(img.height * shrink));
    const sctx = small.getContext('2d');
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(img, 0, 0, small.width, small.height);
    const out = document.createElement('canvas');
    out.width = Math.round(img.width * 0.5);
    out.height = Math.round(img.height * 0.5);
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    // Two offset passes smooth out the blockiness of the upscale.
    octx.globalAlpha = 0.6;
    octx.drawImage(small, 0, 0, out.width, out.height);
    octx.drawImage(small, 3, 2, out.width, out.height);
    this.blurCache.set(key, out);
    return out;
  }

  renderHud(ctx) {
    const p = this.player;
    this.hudHealth += (p.health - this.hudHealth) * 0.15;

    // Hearts
    const hearts = Math.ceil(p.maxHealth / HEART_VALUE);
    const low = p.health <= p.maxHealth * 0.25;
    for (let i = 0; i < hearts; i++) {
      const fill = Math.max(0, Math.min(1, (Math.max(0, p.health) - i * HEART_VALUE) / HEART_VALUE));
      const pulse = low && fill > 0 ? 1 + Math.sin(this.time * 0.25) * 0.08 : 1;
      drawHeart(ctx, 62 + i * 68, 62, 26 * pulse, fill);
    }

    // Gold
    const coin = this.art.coin[0];
    ctx.drawImage(coin, 34, 104, 56, 56);
    this.hudText(ctx, `${this.gold}`, 102, 134, 46, 'left', '#ffe08a');

    // Lives: a little portrait of the heroine
    const portrait = this.art.player.idle.right[0];
    const px = CANVAS_WIDTH - 150;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, 66, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#f4ecd8';
    ctx.fill();
    ctx.clip();
    // Same head crop as the favicon (tools/make_icons.py), relative to the 408px-wide frame.
    const k = portrait.width / 408;
    ctx.drawImage(portrait, 150 * k, 12 * k, 130 * k, 130 * k, px - 42, 24, 84, 84);
    ctx.restore();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1b1210';
    ctx.beginPath();
    ctx.arc(px, 66, 40, 0, Math.PI * 2);
    ctx.stroke();
    this.hudText(ctx, `×${this.lives}`, px + 52, 82, 46, 'left');
    if (this.plus > 0) {
      // New Game+ badge: a little red seal under the lives counter.
      const label = this.plus > 1 ? `NG+${this.plus}` : 'NG+';
      ctx.save();
      ctx.translate(px + 20, 142);
      ctx.rotate(-0.06);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-70, -24, 140, 48);
      ctx.strokeStyle = '#1b1210';
      ctx.lineWidth = 4;
      ctx.strokeRect(-70, -24, 140, 48);
      ctx.restore();
      this.hudText(ctx, label, px + 20, 144, 38, 'center', '#fff8e6');
    }

    // Boss
    if (this.boss && this.arena) this.renderBossBar(ctx);
  }

  renderBossBar(ctx) {
    const boss = this.boss;
    this.bossHudHealth = Math.max(boss.health, this.bossHudHealth - boss.maxHealth * 0.004);
    const w = 900;
    const h = 30;
    const x = (CANVAS_WIDTH - w) / 2;
    const y = CANVAS_HEIGHT - 80;
    const intro = this.bossIntroTicks > 0 ? Math.min(1, (150 - this.bossIntroTicks) / 30) : 1;
    ctx.save();
    ctx.globalAlpha = intro;
    ctx.fillStyle = 'rgba(20,10,8,0.75)';
    ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(x, y, w * (this.bossHudHealth / boss.maxHealth), h);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#e2452f');
    g.addColorStop(1, '#8e1a12');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * (boss.health / boss.maxHealth), h);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#d9b45a';
    ctx.strokeRect(x - 10, y - 10, w + 20, h + 20);
    this.hudText(ctx, boss.name, CANVAS_WIDTH / 2, y - 34, 44, 'center');
    ctx.restore();

    // Big name card when the fight starts
    if (this.bossIntroTicks > 0) {
      const t = this.bossIntroTicks;
      const a = Math.min(1, t / 20, (150 - t) / 15);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(10,5,5,0.55)';
      ctx.fillRect(0, CANVAS_HEIGHT * 0.38, CANVAS_WIDTH, 170);
      this.hudText(ctx, boss.name, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.38 + 90, 96, 'center', '#f4d27a');
      ctx.restore();
    }
  }

  hudText(ctx, text, x, y, size, align = 'left', color = '#fff8e6') {
    ctx.font = `${size}px ${HUD_FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.22;
    ctx.strokeStyle = '#1b1210';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
}
