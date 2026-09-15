import {
  MOVE_SPEED, GRAVITY, JUMP_SPEED, CANVAS_WIDTH, CANVAS_HEIGHT,
  RIGHT_MARGIN, LEFT_MARGIN_INITIAL, LEFT_MARGIN_LOCKED, VERTICAL_MARGIN,
  MAX_HEALTH, GROUND_LEVEL, DAMAGE_FLASH_TICKS, HITSTUN_MARGIN_TICKS,
  DEATH_ANIM_FRAME_COUNT, DEATH_ANIM_FRAME_TICKS, DEATH_ANIM_TOTAL_TICKS,
  STARTING_LIVES, MAX_LIVES, LEVEL_INTRO_TICKS, LEFT_FACING,
  ATTACK_TOTAL_TICKS, ATTACK_ACTIVE_START, ATTACK_ACTIVE_END,
  VICTORY_TOTAL_TICKS, VICTORY_VARIANT_COUNT, PARALLAX_FACTOR,
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
    this.persistentStats = {
      maxHealth: MAX_HEALTH, attackStrength: 10, gravityScale: 1,
      attackTotalTicks: ATTACK_TOTAL_TICKS, attackActiveStart: ATTACK_ACTIVE_START, attackActiveEnd: ATTACK_ACTIVE_END,
    };
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

    // Set when the player dies: how far into the death animation we are, and
    // what happens once it finishes ('respawn' the current level, or show
    // the 'gameover' screen) - decided up front so the animation itself
    // doesn't need to know about lives.
    this.deathTick = 0;
    this.deathOutcome = null;

    // How far into the post-boss-death victory cutscene we are (see the
    // 'bossdefeated' state and startBossDefeatedSequence()).
    this.bossDefeatedTick = 0;

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
    this.persistentStats = {
      maxHealth: MAX_HEALTH, attackStrength: 10, gravityScale: 1,
      attackTotalTicks: ATTACK_TOTAL_TICKS, attackActiveStart: ATTACK_ACTIVE_START, attackActiveEnd: ATTACK_ACTIVE_END,
    };
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

  // Called once a boss's own death animation finishes: freezes gameplay
  // (Game state 'bossdefeated') and starts the player on one of
  // VICTORY_VARIANT_COUNT randomly-picked victory animations.
  startBossDefeatedSequence() {
    this.state = 'bossdefeated';
    this.bossDefeatedTick = 0;
    this.player.changeX = 0;
    this.player.changeY = 0;
    this.player.startVictory(Math.floor(Math.random() * VICTORY_VARIANT_COUNT));
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
    } else if (item.kind === 'attackSpeed') {
      // Scales the whole swing timeline down together (total length, and the
      // active-hit window within it) so the proportions - and therefore the
      // hitstun-vs-swing-cycle relationship in the attack resolution below -
      // stay the same, just faster.
      player.attackTotalTicks = Math.max(4, Math.round(player.attackTotalTicks * item.amount));
      player.attackActiveStart = Math.max(1, Math.round(player.attackActiveStart * item.amount));
      player.attackActiveEnd = Math.max(player.attackActiveStart + 1, Math.round(player.attackActiveEnd * item.amount));
      this.persistentStats.attackTotalTicks = player.attackTotalTicks;
      this.persistentStats.attackActiveStart = player.attackActiveStart;
      this.persistentStats.attackActiveEnd = player.attackActiveEnd;
    }
    if (item.oneTime) this.purchasedOneTimeItems.add(item.id);
    return { ok: true };
  }

  exitShop() {
    this.activeShopId = null;
    this.state = 'playing';
  }

  // Pausing only makes sense mid-gameplay - not over a cutscene/shop/menu
  // that's already modal. 'paused' isn't handled anywhere in update(), so it
  // freezes for free via the existing `if (this.state !== 'playing') return;`
  // guard at the top - nothing moves, nothing ticks, until resume().
  pause() {
    if (this.state === 'playing') this.state = 'paused';
  }

  resume() {
    if (this.state === 'paused') this.state = 'playing';
  }

  togglePause() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
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
    if (this.state === 'dying') {
      this.deathTick++;
      if (this.deathTick >= DEATH_ANIM_TOTAL_TICKS) {
        if (this.deathOutcome === 'respawn') this.enterLevelIntro(this.levelIndex, { respawn: true });
        else this.state = 'gameover';
      }
      return;
    }
    // Boss's own death animation has already finished (see the boss update
    // branch below) - gameplay is frozen while the player plays its victory
    // animation, then play resumes.
    if (this.state === 'bossdefeated') {
      this.bossDefeatedTick++;
      this.player.updateVictoryAnimation();
      if (this.bossDefeatedTick >= VICTORY_TOTAL_TICKS) {
        this.player.endVictory();
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

    // --- enemies (frozen in place while hit-stunned, see attack resolution below) ---
    level.enemies = level.enemies.filter((e) => e.alive);
    for (const enemy of level.enemies) {
      if (enemy.hitstunTicks > 0) { enemy.hitstunTicks--; continue; }
      enemy.update();
      enemy.updateAnimation();
    }

    // --- boss (patrols/attacks/jumps in front of the exit door) ---
    const boss = level.boss;
    if (boss && boss.alive) {
      if (boss.hitstunTicks > 0) {
        boss.hitstunTicks--;
      } else {
        const bossOnPlatform = isOnPlatforms(boss, level.platforms);
        boss.think(player.centerX);
        boss.updateAnimation(bossOnPlatform);
        resolvePlatformCollisions(boss, level.platforms, GRAVITY);
        boss.enforceBoundary();

        const bossShot = boss.thinkFireball(player.centerX);
        if (bossShot) {
          level.fireballs.push(new Fireball(this.images.fireball, bossShot.centerX, bossShot.centerY, bossShot.direction));
          this.sfx?.attack();
        }
      }
    } else if (boss && boss.dying && !boss.deathFinalized) {
      // Plays out independently of normal gameplay (which keeps running) -
      // only once it finishes do we drop loot, count it as defeated, and
      // freeze everything for the victory cutscene.
      boss.updateDeathAnimation();
      if (boss.isDeathAnimationDone()) {
        boss.deathFinalized = true;
        this.enemiesDefeated++;
        for (let i = 0; i < BOSS_COIN_DROP; i++) {
          const drop = new Coin(this.images);
          drop.centerX = boss.centerX + (Math.random() - 0.5) * boss.w;
          drop.centerY = boss.centerY + (Math.random() - 0.5) * boss.h * 0.6;
          level.coins.push(drop);
        }
        this.startBossDefeatedSequence();
        return; // this tick's camera/scroll below doesn't matter once frozen
      }
    }

    // --- fire turrets: only fire while actually on screen ---
    level.fireEnemies = level.fireEnemies.filter((e) => e.alive);
    for (const fireEnemy of level.fireEnemies) {
      if (fireEnemy.hitstunTicks > 0) { fireEnemy.hitstunTicks--; continue; }
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
      if (swoopEnemy.hitstunTicks > 0) { swoopEnemy.hitstunTicks--; continue; }
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
          if (wasAlive && !enemy.alive && enemy === boss) {
            // Defer the "defeated" payoff (coins, count, the freeze +
            // victory cutscene) until the boss's own death animation
            // finishes - see the boss update branch above.
            boss.startDeath();
          } else if (wasAlive && !enemy.alive) {
            this.enemiesDefeated++;
            const drop = new Coin(this.images);
            drop.centerX = enemy.centerX;
            drop.centerY = enemy.centerY;
            level.coins.push(drop);
          } else if (wasAlive) {
            // Freeze + flash the thing we just hit so the player gets a safe
            // follow-up window instead of trading a hit back immediately -
            // this matters most against the boss, whose reach and aggro
            // range are both bigger than the player's, so without this an
            // unstunned boss can counter-swing before the player's own
            // recovery even ends.
            enemy.hitstunTicks = Math.max(1, player.attackTotalTicks - HITSTUN_MARGIN_TICKS);
            enemy.changeX = 0;
            enemy.changeY = 0;
            if (enemy === boss) boss.attacking = false; // cancel any swing that was winding up
          }
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
    // Hit-stunned enemies can't deal contact damage either - that's the
    // whole point of the freeze giving the player a safe window.
    const touchedEnemy = threats.find((e) => e.alive && e.hitstunTicks <= 0 && checkCollision(player, e));
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

    // --- death: freeze here and play a short fall/fade animation before the
    // continue-or-game-over outcome (decided now) actually takes effect, in
    // the 'dying' branch at the top of this method.
    if (player.health <= 0 || fellOffMap(player)) {
      this.lives--;
      this.deathOutcome = this.lives > 0 ? 'respawn' : 'gameover';
      this.deathTick = 0;
      this.state = 'dying';
      player.changeX = 0;
      player.changeY = 0;
      player.attacking = false;
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
    this.renderParallaxBackground();

    const { level, player, viewX, viewY } = this;
    for (const t of level.passableTiles) t.display(ctx, viewX, viewY);
    for (const s of level.platforms) s.display(ctx, viewX, viewY);
    for (const d of level.doors) d.display(ctx, viewX, viewY);
    for (const c of level.coins) c.display(ctx, viewX, viewY);
    for (const e of level.enemies) if (e.alive) this.drawFlashed(e, e.hitstunTicks > 0);
    for (const e of level.fireEnemies) if (e.alive) this.drawFlashed(e, e.hitstunTicks > 0);
    for (const e of level.swoopEnemies) if (e.alive) this.drawFlashed(e, e.hitstunTicks > 0);
    for (const f of level.fireballs) f.display(ctx, viewX, viewY);
    // Keep rendering through the boss's death animation, and afterward as a
    // fallen corpse (dying stays true forever once it's triggered).
    if (level.boss && (level.boss.alive || level.boss.dying)) {
      this.drawFlashed(level.boss, level.boss.hitstunTicks > 0, 0, this.anchoredCenter(level.boss));
    }
    this.displayPlayer();

    this.renderHud();
  }

  // Distant mountains/forest, drawn between the flat sky color and the
  // level's own tiles: spans the bottom half of the screen and the full
  // width, scrolling horizontally at PARALLAX_FACTOR of the camera's own
  // speed (screen-space only - it doesn't react to vertical camera movement)
  // so it reads as further away than the foreground. The source image is
  // displayed at exactly half the canvas height (whatever its native
  // resolution) and tiled seamlessly to cover the width.
  renderParallaxBackground() {
    const img = this.images.bgParallax;
    if (!img || !img.width || !img.height) return;
    const { ctx } = this;
    const displayHeight = CANVAS_HEIGHT / 2;
    const displayWidth = img.width * (displayHeight / img.height);
    const y = CANVAS_HEIGHT - displayHeight;
    const scrolled = this.viewX * PARALLAX_FACTOR;
    const startX = -(((scrolled % displayWidth) + displayWidth) % displayWidth);
    for (let x = startX; x < CANVAS_WIDTH; x += displayWidth) {
      ctx.drawImage(img, x, y, displayWidth, displayHeight);
    }
  }

  displayPlayer() {
    if (this.state === 'dying') {
      this.displayPlayerDeath();
      return;
    }
    const { player } = this;
    // Airborne swing spins the jump-pose sprite through a full turn over the
    // swing's duration - a "spin slash" that reads as clearly different from
    // the grounded 3-frame chop without needing dedicated art.
    const rotation = (player.attacking && player.attackAirborne)
      ? Math.min(1, player.attackTick / player.attackTotalTicks) * Math.PI * 2 * (player.direction === LEFT_FACING ? -1 : 1)
      : 0;

    const center = rotation ? null : this.anchoredCenter(player);
    this.drawFlashed(player, player.flashTicks > 0, rotation, center);
  }

  // A grounded attack frame (the player's kick, or the boss's swing) may be
  // drawn wider/taller than its owner's normal box - see README.md. Rather
  // than centering that extra size (which would pop the body sideways as
  // frames change), anchor the edge *behind* the facing direction to where
  // the normal box already ends, and let the extra size grow toward the
  // front and upward (the base stays planted) - so the art can extend into
  // the space the invisible attack hitbox already reaches without any code
  // changes. Returns null when the current frame is the sprite's normal size.
  anchoredCenter(sprite) {
    const extraWidth = sprite.image.width - sprite.w;
    const extraHeight = sprite.image.height - sprite.h;
    if (extraWidth === 0 && extraHeight === 0) return null;
    const signX = sprite.direction === LEFT_FACING ? -1 : 1;
    return {
      x: sprite.centerX + signX * extraWidth / 2,
      y: sprite.centerY - extraHeight / 2,
    };
  }

  // Draws `sprite` tinted solid white via a scratch canvas when `flashing` is
  // true - shared by the player's damage flash and any enemy/boss's hitstun
  // flash. 'source-atop' only paints over the sprite's own opaque pixels, so
  // the flash can't bleed onto tiles behind it; the scratch canvas grows to
  // fit whichever sprite is currently flashing (the boss is far bigger than
  // a normal enemy). `rotation` (radians) spins the sprite around its own
  // center - used for the player's airborne attack. `center` (optional
  // {x,y}) overrides where the sprite is drawn, used for the player's
  // grounded attack when its current frame isn't the sprite's normal size
  // (see displayPlayer()); drawing always uses the CURRENT image's actual
  // pixel size, not the sprite's fixed collision box, so a wider attack
  // frame shows at full size instead of being squashed into that box.
  drawFlashed(sprite, flashing, rotation = 0, center = null) {
    const { ctx, viewX, viewY } = this;
    const w = sprite.image.width;
    const h = sprite.image.height;
    const centerX = center ? center.x : sprite.centerX;
    const centerY = center ? center.y : sprite.centerY;
    let img = sprite.image;
    if (flashing) {
      const cw = Math.ceil(w);
      const ch = Math.ceil(h);
      if (this.flashCanvas.width < cw) this.flashCanvas.width = cw;
      if (this.flashCanvas.height < ch) this.flashCanvas.height = ch;
      const fctx = this.flashCtx;
      fctx.clearRect(0, 0, cw, ch);
      fctx.drawImage(sprite.image, 0, 0, cw, ch);
      fctx.globalCompositeOperation = 'source-atop';
      fctx.fillStyle = 'rgba(255,255,255,0.9)';
      fctx.fillRect(0, 0, cw, ch);
      fctx.globalCompositeOperation = 'source-over';
      img = this.flashCanvas;
    }
    if (!rotation) {
      ctx.drawImage(
        img, 0, 0, w, h,
        centerX - w / 2 - viewX, centerY - h / 2 - viewY,
        w, h,
      );
      return;
    }
    ctx.save();
    ctx.translate(centerX - viewX, centerY - viewY);
    ctx.rotate(rotation);
    ctx.drawImage(img, 0, 0, w, h, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // No dedicated death sprite exists yet, so the death animation is done
  // procedurally on the player's last-alive frame: over DEATH_ANIM_FRAME_COUNT
  // steps it topples onto its side and fades out, then the 'dying' branch in
  // update() moves on to the continue/game-over screen.
  displayPlayerDeath() {
    const { ctx, player, viewX, viewY, deathTick } = this;
    const frame = Math.min(DEATH_ANIM_FRAME_COUNT - 1, Math.floor(deathTick / DEATH_ANIM_FRAME_TICKS));
    const t = frame / (DEATH_ANIM_FRAME_COUNT - 1);
    const angle = t * (Math.PI / 2);
    const alpha = 1 - t * 0.8;
    const tiltSign = player.direction === LEFT_FACING ? -1 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(player.centerX - viewX, player.centerY - viewY);
    ctx.rotate(tiltSign * angle);
    ctx.drawImage(player.image, -player.w / 2, -player.h / 2, player.w, player.h);
    ctx.restore();
  }

  renderHud() {
    // HUD layout is in the same 3x scale as everything else (see the note
    // at the top of constants.js) - these were 200/20/20/50/12/etc. at the
    // old 800x600 canvas size.
    const { ctx, player } = this;
    const barWidth = 600;
    const barHeight = 60;
    const barX = CANVAS_WIDTH / 2 - barWidth / 2;
    const barY = 60;

    ctx.fillStyle = 'rgb(100,100,100)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = 'rgb(255,0,0)';
    const healthWidth = Math.max(0, player.health) / player.maxHealth * barWidth;
    ctx.fillRect(barX, barY, healthWidth, barHeight);

    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.font = '60px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(`Gold: ${this.gold}`, 150, 36);
    ctx.fillText('Health', CANVAS_WIDTH / 2 - 90, 36);
    ctx.textAlign = 'right';
    ctx.fillText(`Lives: ${this.lives}`, CANVAS_WIDTH - 150, 36);
    ctx.textAlign = 'left';

    if (this.level.boss && this.level.boss.alive) {
      const boss = this.level.boss;
      const bossBarY = barY + barHeight + 30;
      ctx.fillStyle = 'rgb(100,100,100)';
      ctx.fillRect(barX, bossBarY, barWidth, 36);
      ctx.fillStyle = 'rgb(160,40,200)';
      ctx.fillRect(barX, bossBarY, Math.max(0, boss.health) / boss.maxHealth * barWidth, 36);
      ctx.font = '42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgb(255,255,255)';
      ctx.fillText('BOSS', CANVAS_WIDTH / 2, bossBarY + 42);
      ctx.textAlign = 'left';
    }

    if (this.activeDoor) {
      const label = this.activeDoor.kind === 'shop' ? 'Press ↑ to enter the shop' : 'Press ↑ to enter the door';
      ctx.textAlign = 'center';
      ctx.font = 'bold 66px sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(CANVAS_WIDTH / 2 - 420, CANVAS_HEIGHT - 210, 840, 108);
      ctx.fillStyle = '#ffe89a';
      ctx.fillText(label, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 186);
      ctx.textAlign = 'left';
    }
  }
}
