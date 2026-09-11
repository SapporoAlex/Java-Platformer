import {
  MOVE_SPEED, GRAVITY, JUMP_SPEED, CANVAS_WIDTH, CANVAS_HEIGHT,
  RIGHT_MARGIN, LEFT_MARGIN_INITIAL, LEFT_MARGIN_LOCKED, VERTICAL_MARGIN,
  MAX_HEALTH, GROUND_LEVEL, DAMAGE_FLASH_TICKS,
  STARTING_LIVES, MAX_LIVES, LEVEL_INTRO_TICKS,
} from './constants.js';
import { Player, Coin, Fireball } from './entities.js';
import {
  Level, checkCollision, checkCollisionList, isOnPlatforms, resolvePlatformCollisions, fellOffMap,
  isVisibleInView,
} from './level.js';
import { LEVELS } from './levels-data.js';
import { SHOPS } from './shops-data.js';

const BOUNCE_TICKS = 18; // ~300ms at 60fps, same window the original bounceTime used
const KNOCKBACK_Y = -10;
const KNOCKBACK_X = 5;
const DAMAGE_PER_HIT = 10;
const BOSS_COIN_DROP = 10;

export class Game {
  constructor(canvas, images, sfx, music) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.images = images;
    this.sfx = sfx;
    this.music = music;
    this.state = 'start';
    this.levelIndex = 0;
    this.level = null;
    this.player = null;
    this.viewX = 0;
    this.viewY = 0;
    this.leftMarginLocked = false;

    // Gold, lives and player upgrades persist across levels and retries
    // (they're only reset by starting a brand new game); the Player
    // instance itself is recreated on every level load, so its stats come
    // from persistentStats.
    this.gold = 0;
    this.totalGoldEarned = 0;
    this.enemiesDefeated = 0;
    this.lives = STARTING_LIVES;
    this.persistentStats = { maxHealth: MAX_HEALTH, attackStrength: 10, gravityScale: 1 };
    this.purchasedOneTimeItems = new Set();
    this.activeDoor = null;
    this.activeShopId = null;

    // Set by enterLevelIntro() for the black "Level N - Name" screen: how
    // far along its auto-advance timer it is, whether this is a fresh level
    // or a life-lost respawn of the current one, and the health % the UI
    // should animate up from (the player itself already has full health by
    // the time this screen shows - this is purely a presentational fill).
    this.introTicks = 0;
    this.introRespawn = false;
    this.introFromHealth = 0;
    this.introFromMax = 1;

    // Offscreen scratch canvas used to tint the player sprite white on hit
    // without bleeding onto whatever's drawn behind it.
    this.flashCanvas = document.createElement('canvas');
    this.flashCanvas.width = 128;
    this.flashCanvas.height = 128;
    this.flashCtx = this.flashCanvas.getContext('2d');
  }

  startNewGame() {
    this.gold = 0;
    this.totalGoldEarned = 0;
    this.enemiesDefeated = 0;
    this.lives = STARTING_LIVES;
    this.persistentStats = { maxHealth: MAX_HEALTH, attackStrength: 10, gravityScale: 1 };
    this.purchasedOneTimeItems = new Set();
    this.enterLevelIntro(0, { respawn: false });
  }

  finalScore() {
    return this.totalGoldEarned * 10 + this.enemiesDefeated * 50;
  }

  // Restarts the current level from scratch without touching lives/gold -
  // kept around as a plain utility; the normal death flow goes through
  // enterLevelIntro() directly so it can also decrement a life.
  retryLevel() {
    this.enterLevelIntro(this.levelIndex, { respawn: true });
  }

  // Builds the Level/Player for `index` and shows the black intro screen
  // (level number/name, lives, a health bar that animates up to full) before
  // gameplay actually starts. `respawn: true` means this is a life lost on
  // the current level, not a fresh next level.
  enterLevelIntro(index, { respawn }) {
    this.introFromHealth = this.player ? this.player.health : this.persistentStats.maxHealth;
    this.introFromMax = this.player ? this.player.maxHealth : this.persistentStats.maxHealth;
    this.introRespawn = respawn;
    this.introTicks = 0;

    this.levelIndex = index;
    this.level = new Level(LEVELS[index], this.images);
    this.player = new Player(this.images, this.persistentStats);
    this.player.setBottom(GROUND_LEVEL);
    this.player.centerX = LEVELS[index].playerStart.x;
    this.viewX = 0;
    this.viewY = 0;
    this.leftMarginLocked = false;
    this.activeDoor = null;
    this.activeShopId = null;
    this.state = 'levelintro';

    this.music?.playLevel(index + 1, this.level.boss ? this.level.boss.assetPrefix : null);
  }

  // Back-compat alias - loading a level always goes through the intro screen.
  loadLevel(index) {
    this.enterLevelIntro(index, { respawn: false });
  }

  hasNextLevel() {
    return this.levelIndex + 1 < LEVELS.length;
  }

  advanceToNextLevel() {
    if (this.hasNextLevel()) this.enterLevelIntro(this.levelIndex + 1, { respawn: false });
  }

  currentShop() {
    return this.activeShopId ? SHOPS[this.activeShopId] : null;
  }

  // Returns { ok: true } on a successful purchase, or { ok: false, reason }
  // so the shop UI can explain why (unknown item / not enough gold / already
  // owned for a one-time item like the Runic Spear).
  buyItem(itemId) {
    const shop = this.currentShop();
    const item = shop?.items.find((i) => i.id === itemId);
    if (!item) return { ok: false, reason: 'unknown-item' };
    if (item.oneTime && this.purchasedOneTimeItems.has(item.id)) return { ok: false, reason: 'already-owned' };
    if (this.gold < item.cost) return { ok: false, reason: 'not-enough-gold' };

    this.gold -= item.cost;
    const player = this.player;
    if (item.kind === 'potion') {
      player.health = Math.min(player.maxHealth, player.health + item.amount);
    } else if (item.kind === 'fullheal') {
      player.health = player.maxHealth;
    } else if (item.kind === 'heart') {
      player.maxHealth += item.amount;
      player.health = Math.min(player.maxHealth, player.health + item.amount);
      this.persistentStats.maxHealth = player.maxHealth;
    } else if (item.kind === 'maxHealthPercent') {
      const increase = Math.round(player.maxHealth * item.amount);
      player.maxHealth += increase;
      player.health = Math.min(player.maxHealth, player.health + increase);
      this.persistentStats.maxHealth = player.maxHealth;
    } else if (item.kind === 'weapon') {
      player.attackStrength += item.amount;
      this.persistentStats.attackStrength = player.attackStrength;
    } else if (item.kind === 'weaponMultiplier') {
      player.attackStrength = Math.round(player.attackStrength * item.amount);
      this.persistentStats.attackStrength = player.attackStrength;
    } else if (item.kind === 'oneup') {
      this.lives = Math.min(MAX_LIVES, this.lives + 1);
    } else if (item.kind === 'floatBoots') {
      player.gravityScale *= item.amount;
      this.persistentStats.gravityScale = player.gravityScale;
    }
    if (item.oneTime) this.purchasedOneTimeItems.add(item.id);
    return { ok: true };
  }

  exitShop() {
    this.activeShopId = null;
    this.state = 'playing';
  }

  update(input) {
    if (this.state === 'levelintro') {
      this.introTicks++;
      const skip = input.wasPressed('KeyA') || input.wasPressed('Space') || input.wasPressed('ArrowUp')
        || input.wasPressed('ArrowLeft') || input.wasPressed('ArrowRight');
      if (skip || this.introTicks >= LEVEL_INTRO_TICKS) {
        this.state = 'playing';
      }
      return;
    }
    if (this.state !== 'playing') return;

    const { player, level } = this;

    // --- input -> intent ---
    if (player.invulnerableTicks <= 0 && !player.attacking) {
      if (input.isDown('ArrowRight')) player.changeX = MOVE_SPEED;
      else if (input.isDown('ArrowLeft')) player.changeX = -MOVE_SPEED;
      else player.changeX = 0;
    }
    if (input.wasPressed('KeyA') && isOnPlatforms(player, level.platforms)) {
      player.changeY = -JUMP_SPEED;
      this.sfx?.jump();
    }
    if (input.wasPressed('Space') && !player.attacking) {
      player.startAttack();
      this.sfx?.attack();
    }

    // --- animation (uses this frame's pre-physics position, same order the
    // original draw() used: updateAnimation() before resolvePlatformCollisions) ---
    const onPlatform = isOnPlatforms(player, level.platforms);
    player.updateAnimation(onPlatform);
    player.updateAttackTimer();

    // --- enemies ---
    level.enemies = level.enemies.filter((e) => e.alive);
    for (const enemy of level.enemies) {
      enemy.update();
      enemy.updateAnimation();
    }

    // --- boss (patrols/attacks/jumps in front of the exit door) ---
    const boss = level.boss;
    if (boss && boss.alive) {
      const bossOnPlatform = isOnPlatforms(boss, level.platforms);
      boss.think(player.centerX);
      boss.updateAnimation(bossOnPlatform);
      resolvePlatformCollisions(boss, level.platforms, GRAVITY);
      boss.enforceBoundary();
    }

    // --- fire turrets: only fire while actually on screen ---
    level.fireEnemies = level.fireEnemies.filter((e) => e.alive);
    for (const fireEnemy of level.fireEnemies) {
      const visible = isVisibleInView(fireEnemy, this.viewX, this.viewY);
      const fired = fireEnemy.think(player.centerX, visible);
      fireEnemy.updateAnimation();
      if (fired) {
        const fireball = new Fireball(this.images.fireball, fireEnemy.centerX, fireEnemy.centerY, fireEnemy.direction);
        level.fireballs.push(fireball);
        this.sfx?.attack(); // reuse the swing sfx as a stand-in "launch" sound
      }
    }

    // --- swooping flyers ---
    level.swoopEnemies = level.swoopEnemies.filter((e) => e.alive);
    for (const swoopEnemy of level.swoopEnemies) {
      swoopEnemy.think(player.centerX, player.centerY);
      swoopEnemy.update();
      swoopEnemy.updateAnimation();
    }

    const threats = [
      ...level.enemies,
      ...level.fireEnemies,
      ...level.swoopEnemies,
      ...(boss && boss.alive ? [boss] : []),
    ];

    // --- attack resolution ---
    if (player.isAttackActive()) {
      const hitbox = player.getAttackHitbox();
      for (const enemy of threats) {
        const overlap = !(hitbox.right <= enemy.getLeft() || hitbox.left >= enemy.getRight()
          || hitbox.bottom <= enemy.getTop() || hitbox.top >= enemy.getBottom());
        if (overlap) {
          const wasAlive = enemy.alive;
          enemy.takeDamage(player.attackStrength);
          if (wasAlive && !enemy.alive) {
            this.enemiesDefeated++;
            const dropCount = enemy === boss ? BOSS_COIN_DROP : 1;
            for (let i = 0; i < dropCount; i++) {
              const drop = new Coin(this.images);
              // Scatter a boss's coins around its death spot instead of
              // stacking them on one point, so they read as a loot burst.
              drop.centerX = enemy.centerX + (dropCount > 1 ? (Math.random() - 0.5) * enemy.w : 0);
              drop.centerY = enemy.centerY + (dropCount > 1 ? (Math.random() - 0.5) * enemy.h * 0.6 : 0);
              level.coins.push(drop);
            }
          }
          if (enemy !== boss) enemy.changeX = enemy.centerX < player.centerX ? -3 : 3; // the boss is too heavy to be knocked back
          player.hasHitThisSwing = true;
          break;
        }
      }
    }

    // --- physics ---
    resolvePlatformCollisions(player, level.platforms, GRAVITY * player.gravityScale);
    if (player.getRight() >= 400) this.leftMarginLocked = true;

    // --- coins (the game's spendable gold) ---
    for (const coin of level.coins) coin.updateAnimation();
    const collected = checkCollisionList(player, level.coins);
    if (collected.length > 0) {
      this.gold += collected.length;
      this.totalGoldEarned += collected.length;
      level.coins = level.coins.filter((c) => !collected.includes(c));
    }

    // --- contact damage / knockback ---
    if (player.invulnerableTicks > 0) player.invulnerableTicks--;
    if (player.flashTicks > 0) player.flashTicks--;
    const touchedEnemy = threats.find((e) => e.alive && checkCollision(player, e));
    if (touchedEnemy && player.invulnerableTicks <= 0) {
      player.invulnerableTicks = BOUNCE_TICKS;
      player.changeY = KNOCKBACK_Y;
      player.changeX = touchedEnemy.getLeft() > player.getLeft() ? -KNOCKBACK_X : KNOCKBACK_X;
      player.health -= DAMAGE_PER_HIT;
      player.flashTicks = DAMAGE_FLASH_TICKS;
      this.sfx?.damage();
    }

    // --- boss's own attack swing (bigger hitbox, bigger damage) ---
    if (boss && boss.alive && boss.isAttackActive()) {
      const hitbox = boss.getAttackHitbox();
      const overlap = !(hitbox.right <= player.getLeft() || hitbox.left >= player.getRight()
        || hitbox.bottom <= player.getTop() || hitbox.top >= player.getBottom());
      if (overlap && player.invulnerableTicks <= 0) {
        player.invulnerableTicks = BOUNCE_TICKS;
        player.changeY = KNOCKBACK_Y;
        player.changeX = boss.centerX > player.centerX ? -KNOCKBACK_X * 2 : KNOCKBACK_X * 2;
        player.health -= boss.attackStrength;
        player.flashTicks = DAMAGE_FLASH_TICKS;
        boss.hasHitThisSwing = true;
        this.sfx?.damage();
      }
    }

    // --- fireballs: move, then resolve against the player and solid ground ---
    for (const fireball of level.fireballs) {
      fireball.update();
      if (!fireball.alive) continue;
      if (checkCollisionList(fireball, level.platforms).length > 0) {
        fireball.alive = false;
        continue;
      }
      if (player.invulnerableTicks <= 0 && checkCollision(fireball, player)) {
        fireball.alive = false;
        player.invulnerableTicks = BOUNCE_TICKS;
        player.changeY = KNOCKBACK_Y * 0.5;
        player.changeX = fireball.changeX > 0 ? KNOCKBACK_X : -KNOCKBACK_X;
        player.health -= fireball.damage;
        player.flashTicks = DAMAGE_FLASH_TICKS;
        this.sfx?.damage();
      }
    }
    level.fireballs = level.fireballs.filter((f) => f.alive);

    // --- doors (level exit or shop entrance) ---
    this.activeDoor = level.doors.find((d) => checkCollision(player, d)) ?? null;
    if (this.activeDoor && input.wasPressed('ArrowUp')) {
      if (this.activeDoor.kind === 'shop') {
        this.activeShopId = this.activeDoor.shopId;
        this.state = 'shop';
      } else {
        this.state = this.hasNextLevel() ? 'levelcomplete' : 'gamecomplete';
      }
    }

    // --- death ---
    if (player.health <= 0 || fellOffMap(player)) {
      this.lives--;
      if (this.lives > 0) {
        this.enterLevelIntro(this.levelIndex, { respawn: true });
        return; // this tick's camera/music updates below don't apply to the old level
      }
      this.state = 'gameover';
      return;
    }

    // --- camera ---
    this.scroll();

    // --- boss music: swap in only once the boss is actually on screen ---
    if (boss) {
      const visible = boss.alive && isVisibleInView(boss, this.viewX, this.viewY);
      this.music?.setBossActive(visible);
    }
  }

  scroll() {
    const leftMargin = this.leftMarginLocked ? LEFT_MARGIN_LOCKED : LEFT_MARGIN_INITIAL;
    const rightBoundary = this.viewX + CANVAS_WIDTH - RIGHT_MARGIN;
    if (this.player.getRight() > rightBoundary) {
      this.viewX += this.player.getRight() - rightBoundary;
    }
    const leftBoundary = this.viewX + leftMargin;
    if (this.player.getLeft() < leftBoundary) {
      this.viewX -= leftBoundary - this.player.getLeft();
    }
    const bottomBoundary = this.viewY + CANVAS_HEIGHT - VERTICAL_MARGIN;
    if (this.player.getBottom() > bottomBoundary) {
      this.viewY += this.player.getBottom() - bottomBoundary;
    }
    const topBoundary = this.viewY + VERTICAL_MARGIN;
    if (this.player.getTop() < topBoundary) {
      this.viewY -= topBoundary - this.player.getTop();
    }
    this.viewX = Math.max(0, this.viewX);
  }

  render() {
    const { ctx } = this;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (this.state === 'start' || this.state === 'levelintro' || !this.level) return;

    ctx.fillStyle = 'rgb(0,200,255)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const { level, player, viewX, viewY } = this;
    for (const t of level.passableTiles) t.display(ctx, viewX, viewY);
    for (const s of level.platforms) s.display(ctx, viewX, viewY);
    for (const d of level.doors) d.display(ctx, viewX, viewY);
    for (const c of level.coins) c.display(ctx, viewX, viewY);
    for (const e of level.enemies) if (e.alive) e.display(ctx, viewX, viewY);
    for (const e of level.fireEnemies) if (e.alive) e.display(ctx, viewX, viewY);
    for (const e of level.swoopEnemies) if (e.alive) e.display(ctx, viewX, viewY);
    for (const f of level.fireballs) f.display(ctx, viewX, viewY);
    if (level.boss && level.boss.alive) level.boss.display(ctx, viewX, viewY);
    this.displayPlayer();

    this.renderHud();
  }

  displayPlayer() {
    const { ctx, player, viewX, viewY } = this;
    if (player.flashTicks <= 0) {
      player.display(ctx, viewX, viewY);
      return;
    }
    // Draw the current frame onto a scratch canvas, then tint only its
    // opaque pixels white ('source-atop' only paints over existing alpha),
    // so the flash doesn't bleed onto tiles behind the sprite.
    const fctx = this.flashCtx;
    fctx.clearRect(0, 0, this.flashCanvas.width, this.flashCanvas.height);
    fctx.drawImage(player.image, 0, 0, player.w, player.h);
    fctx.globalCompositeOperation = 'source-atop';
    fctx.fillStyle = 'rgba(255,255,255,0.9)';
    fctx.fillRect(0, 0, player.w, player.h);
    fctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(
      this.flashCanvas, 0, 0, player.w, player.h,
      player.centerX - player.w / 2 - viewX, player.centerY - player.h / 2 - viewY,
      player.w, player.h,
    );
  }

  renderHud() {
    const { ctx, player } = this;
    const barWidth = 200;
    const barHeight = 20;
    const barX = CANVAS_WIDTH / 2 - barWidth / 2;
    const barY = 20;

    ctx.fillStyle = 'rgb(100,100,100)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = 'rgb(255,0,0)';
    const healthWidth = Math.max(0, player.health) / player.maxHealth * barWidth;
    ctx.fillRect(barX, barY, healthWidth, barHeight);

    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.font = '20px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(`Gold: ${this.gold}`, 50, 12);
    ctx.fillText('Health', CANVAS_WIDTH / 2 - 30, 12);
    ctx.textAlign = 'right';
    ctx.fillText(`Lives: ${this.lives}`, CANVAS_WIDTH - 50, 12);
    ctx.textAlign = 'left';

    if (this.level.boss && this.level.boss.alive) {
      const boss = this.level.boss;
      const bossBarY = barY + barHeight + 10;
      ctx.fillStyle = 'rgb(100,100,100)';
      ctx.fillRect(barX, bossBarY, barWidth, 12);
      ctx.fillStyle = 'rgb(160,40,200)';
      ctx.fillRect(barX, bossBarY, Math.max(0, boss.health) / boss.maxHealth * barWidth, 12);
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgb(255,255,255)';
      ctx.fillText('BOSS', CANVAS_WIDTH / 2, bossBarY + 14);
      ctx.textAlign = 'left';
    }

    if (this.activeDoor) {
      const label = this.activeDoor.kind === 'shop' ? 'Press ↑ to enter the shop' : 'Press ↑ to enter the door';
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(CANVAS_WIDTH / 2 - 140, CANVAS_HEIGHT - 70, 280, 36);
      ctx.fillStyle = '#ffe89a';
      ctx.fillText(label, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 62);
      ctx.textAlign = 'left';
    }
  }
}
