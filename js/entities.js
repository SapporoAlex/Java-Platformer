import { Entity, drawFigure } from './sprite.js';
import {
  TILE, RIGHT_FACING, LEFT_FACING,
  PLAYER_W, PLAYER_H, RUN_SPEED, GROUND_ACCEL, GROUND_FRICTION, AIR_ACCEL, AIR_FRICTION,
  ATTACK_GROUND_FRICTION, JUMP_VELOCITY, GRAVITY_RISE, GRAVITY_CUT, GRAVITY_FALL, MAX_FALL_SPEED,
  COYOTE_TICKS, JUMP_BUFFER_TICKS, MAX_HEALTH, BASE_ATTACK, ATTACK_TOTAL_TICKS, ATTACK_ACTIVE_START,
  ATTACK_ACTIVE_END, ATTACK_REACH, HURT_INVULN_TICKS, HURT_STUN_TICKS, HURT_KNOCKBACK_X, HURT_KNOCKBACK_Y,
  ENEMY_HITSTUN_TICKS, ENEMY_KNOCKBACK, VICTORY_TOTAL_TICKS,
  ONI_W, ONI_H, ONI_HEALTH, ONI_SPEED, ONI_CHARGE_SPEED, ONI_DAMAGE,
  GHOST_W, GHOST_H, GHOST_HEALTH, GHOST_SPEED, GHOST_DIVE_SPEED, GHOST_TRIGGER_X, GHOST_COOLDOWN_TICKS, GHOST_DAMAGE,
  LANTERN_W, LANTERN_H, LANTERN_HEALTH, LANTERN_INTERVAL_TICKS, LANTERN_WINDUP_TICKS, LANTERN_DAMAGE,
  FIREBALL_SPEED, FIREBALL_SIZE, FIREBALL_DAMAGE, FIREBALL_LIFE_TICKS,
  BOSS_W, BOSS_H, BOSS_SPEED, BOSS_JUMP_VELOCITY, BOSS_WINDUP_TICKS, BOSS_ACTIVE_TICKS, BOSS_RECOVER_TICKS,
  BOSS_LUNGE_SPEED, BOSS_REACH, BOSS_ATTACK_TRIGGER, BOSS_DEATH_TICKS, BOSS_DAMAGE_MULTIPLIER,
  COIN_SIZE, DROPPED_COIN_LIFE_TICKS,
} from './constants.js';

const sideOf = (facing) => (facing === LEFT_FACING ? 'left' : 'right');
const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
const frameAt = (anim, facing, index) => {
  const frames = anim[sideOf(facing)];
  return frames[((index % frames.length) + frames.length) % frames.length];
};

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
export class Player extends Entity {
  constructor(art, stats = {}) {
    super(0, 0, PLAYER_W, PLAYER_H);
    this.art = art;
    this.maxHealth = stats.maxHealth ?? MAX_HEALTH;
    this.health = this.maxHealth;
    this.attackStrength = stats.attackStrength ?? BASE_ATTACK;
    this.gravityScale = stats.gravityScale ?? 1;
    this.attackTotalTicks = stats.attackTotalTicks ?? ATTACK_TOTAL_TICKS;
    this.attackActiveStart = stats.attackActiveStart ?? ATTACK_ACTIVE_START;
    this.attackActiveEnd = stats.attackActiveEnd ?? ATTACK_ACTIVE_END;

    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumping = false;
    this.dropTicks = 0;
    this.attacking = false;
    this.attackTick = 0;
    this.hitThisSwing = new Set();
    this.invulnTicks = 0;
    this.stunTicks = 0;
    this.flash = 0;
    this.sx = 1;
    this.sy = 1;
    this.animTick = 0;
    this.runPhase = 0;
    this.inVictory = false;
    this.victoryVariant = 0;
    this.victoryTick = 0;
    this.events = []; // 'jump' | 'land' | 'attack' | 'step' - consumed by Game for sfx/fx
  }

  get controllable() {
    return this.stunTicks <= 0 && !this.inVictory;
  }

  update(input, level) {
    this.events.length = 0;
    this.animTick++;
    if (this.invulnTicks > 0) this.invulnTicks--;
    if (this.stunTicks > 0) this.stunTicks--;
    if (this.dropTicks > 0) this.dropTicks--;
    this.flash = Math.max(0, this.flash - 0.12);

    const control = this.controllable;
    const dir = control ? (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0) : 0;

    // --- horizontal: accelerate toward the target speed ---
    if (this.attacking && this.onGround) {
      this.vx = approach(this.vx, 0, ATTACK_GROUND_FRICTION);
    } else if (control) {
      const target = dir * RUN_SPEED;
      const accel = this.onGround
        ? (dir !== 0 ? GROUND_ACCEL * (Math.sign(this.vx) !== dir && this.vx !== 0 ? 2 : 1) : GROUND_FRICTION)
        : (dir !== 0 ? AIR_ACCEL : AIR_FRICTION);
      this.vx = approach(this.vx, target, accel);
    }
    if (dir !== 0 && !this.attacking && control) this.facing = dir > 0 ? RIGHT_FACING : LEFT_FACING;

    // --- jumping: buffered presses + coyote time make it forgiving ---
    if (this.onGround) this.coyote = COYOTE_TICKS;
    else if (this.coyote > 0) this.coyote--;
    if (control && input.wasPressed('jump')) this.jumpBuffer = JUMP_BUFFER_TICKS;
    else if (this.jumpBuffer > 0) this.jumpBuffer--;

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.jumpBuffer = 0;
      this.coyote = 0;
      if (input.isDown('down') && this.onGround && this.standingOnOneway(level)) {
        this.dropTicks = 10;
        this.onGround = false;
        this.vy = 4;
      } else {
        this.vy = -JUMP_VELOCITY;
        this.jumping = true;
        this.onGround = false;
        this.sx = 0.82;
        this.sy = 1.2;
        this.events.push('jump');
      }
    }

    // --- variable-height gravity ---
    let g;
    if (this.vy < 0) g = this.jumping && input.isDown('jump') ? GRAVITY_RISE : GRAVITY_CUT;
    else g = GRAVITY_FALL;
    // Float boots: gentler gravity everywhere, and a slower top falling speed.
    g *= this.vy < 0 ? (1 + this.gravityScale) / 2 : this.gravityScale;
    this.vy = Math.min(this.vy + g, MAX_FALL_SPEED * (this.gravityScale < 1 ? 0.6 : 1));
    if (this.vy >= 0) this.jumping = false;

    // --- attack ---
    if (control && input.wasPressed('attack') && !this.attacking) this.startAttack();
    if (this.attacking) {
      this.attackTick++;
      if (this.attackTick >= this.attackTotalTicks) this.attacking = false;
    }

    // --- move + collide ---
    const wasOnGround = this.onGround;
    const fallSpeed = this.vy;
    level.moveEntity(this, { cornerCorrect: true, dropThrough: this.dropTicks > 0 });
    if (this.onGround && !wasOnGround) {
      const impact = Math.min(1, fallSpeed / MAX_FALL_SPEED);
      this.sx = 1 + 0.25 * impact;
      this.sy = 1 - 0.22 * impact;
      if (fallSpeed > 10) this.events.push('land');
    }

    // Squash & stretch springs back toward 1.
    this.sx += (1 - this.sx) * 0.22;
    this.sy += (1 - this.sy) * 0.22;

    if (this.onGround && Math.abs(this.vx) > 1) {
      const prev = this.runPhase;
      this.runPhase += Math.abs(this.vx) / RUN_SPEED * 0.21;
      if (Math.floor(prev / Math.PI) !== Math.floor(this.runPhase / Math.PI)) this.events.push('step');
    } else {
      this.runPhase = 0;
    }
  }

  standingOnOneway(level) {
    const row = Math.floor((this.bottom + 1) / TILE);
    const left = Math.floor(this.x / TILE);
    const right = Math.floor((this.right - 0.01) / TILE);
    let oneway = false;
    for (let col = left; col <= right; col++) {
      const t = level.terrainAt(col, row);
      if (t?.kind === 'solid') return false;
      if (t?.kind === 'oneway') oneway = true;
    }
    return oneway;
  }

  startAttack() {
    this.attacking = true;
    this.attackTick = 0;
    this.hitThisSwing.clear();
    this.events.push('attack');
  }

  isAttackActive() {
    return this.attacking && this.attackTick >= this.attackActiveStart && this.attackTick <= this.attackActiveEnd;
  }

  getAttackHitbox() {
    const top = this.y + 20;
    const bottom = this.bottom - 30;
    return this.facing === LEFT_FACING
      ? { left: this.centerX - ATTACK_REACH, right: this.centerX, top, bottom }
      : { left: this.centerX, right: this.centerX + ATTACK_REACH, top, bottom };
  }

  hurt(amount, fromX) {
    if (this.invulnTicks > 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.invulnTicks = HURT_INVULN_TICKS;
    this.stunTicks = HURT_STUN_TICKS;
    this.flash = 1;
    const away = this.centerX < fromX ? -1 : 1;
    this.vx = away * HURT_KNOCKBACK_X;
    this.vy = -HURT_KNOCKBACK_Y;
    this.onGround = false;
    this.jumping = false;
    this.attacking = false;
    return true;
  }

  startVictory(variant) {
    this.inVictory = true;
    this.victoryVariant = variant;
    this.victoryTick = 0;
    this.attacking = false;
    this.vx = 0;
  }

  updateVictory() {
    this.victoryTick++;
    if (this.victoryTick >= VICTORY_TOTAL_TICKS) this.inVictory = false;
  }

  draw(ctx) {
    const { art } = this;
    const ref = art.idle[sideOf(this.facing)][0];
    let img;
    const o = { sx: this.sx, sy: this.sy, flash: this.flash };

    if (this.inVictory) {
      const anim = art.victory[this.victoryVariant] ?? art.idle;
      img = frameAt(anim, this.facing, Math.floor(this.victoryTick / 6));
      const t = this.victoryTick / VICTORY_TOTAL_TICKS;
      o.oy = -Math.abs(Math.sin(t * Math.PI * 3)) * 40;
      o.sy *= 1 + Math.sin(t * Math.PI * 6) * 0.03;
    } else if (this.attacking) {
      const t = this.attackTick;
      const idx = t < this.attackActiveStart ? 0 : t <= this.attackActiveEnd ? 1 : 2;
      img = frameAt(art.attack, this.facing, idx);
      // Wind back, then lunge into the cut.
      const k = t < this.attackActiveStart ? -t / this.attackActiveStart : Math.max(0, 1 - (t - this.attackActiveStart) / 10);
      o.ox = this.facing * 16 * k;
      o.rot = this.facing * 0.07 * k;
    } else if (!this.onGround) {
      img = frameAt(art.jump, this.facing, 0);
      o.rot = this.facing * Math.max(-0.12, Math.min(0.12, this.vx * 0.008));
      const stretch = Math.max(-0.08, Math.min(0.1, -this.vy * 0.004));
      o.sy *= 1 + stretch;
      o.sx *= 1 - stretch * 0.6;
    } else if (Math.abs(this.vx) > 1) {
      img = frameAt(art.run, this.facing, Math.floor(this.runPhase / Math.PI));
      const s = Math.sin(this.runPhase);
      o.oy = -Math.abs(s) * 12;
      o.rot = this.facing * (0.06 + s * 0.035);
      o.sy *= 1 + Math.abs(s) * 0.03;
    } else {
      img = frameAt(art.idle, this.facing, Math.floor(this.animTick / 7));
      o.sy *= 1 + Math.sin(this.animTick * 0.07) * 0.012;
    }

    if (this.invulnTicks > 0 && !this.flash && Math.floor(this.invulnTicks / 4) % 2 === 0) o.alpha = 0.35;
    drawFigure(ctx, img, ref, this.centerX, this.bottom, 255, o);
  }
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------
class Enemy extends Entity {
  constructor(w, h, health, damage) {
    super(0, 0, w, h);
    this.health = health;
    this.maxHealth = health;
    this.damage = damage;
    this.hitstun = 0;
    this.flash = 0;
    this.tick = Math.floor(Math.random() * 100);
    this.coinDrop = 1;
  }

  // Returns true if this hit killed it.
  takeHit(amount, fromX) {
    this.health -= amount;
    this.flash = 1;
    this.hitstun = ENEMY_HITSTUN_TICKS;
    this.vx = (this.centerX < fromX ? -1 : 1) * ENEMY_KNOCKBACK;
    if (this.health <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  get harmful() {
    return this.alive && this.hitstun <= 0;
  }

  baseUpdate() {
    this.tick++;
    this.flash = Math.max(0, this.flash - 0.1);
    if (this.hitstun > 0) this.hitstun--;
  }
}

// Oni: walks back and forth, turns at walls and ledges, and charges when it
// spots the player on its level and in front of it.
export class Oni extends Enemy {
  constructor(art, x, feetY) {
    super(ONI_W, ONI_H, ONI_HEALTH, ONI_DAMAGE);
    this.art = art;
    this.centerX = x;
    this.bottom = feetY;
    this.facing = LEFT_FACING;
    this.charging = 0;
  }

  update(level, player) {
    this.baseUpdate();
    if (this.hitstun > 0) {
      this.vx *= 0.82;
    } else {
      const dx = player.centerX - this.centerX;
      const sameFloor = Math.abs(player.bottom - this.bottom) < TILE * 0.8;
      const facingPlayer = Math.sign(dx) === this.facing;
      if (this.charging <= 0 && sameFloor && facingPlayer && Math.abs(dx) < TILE * 4.5) this.charging = 60;
      if (this.charging > 0) this.charging--;
      if (this.onGround && (level.wallAhead(this, this.facing) || !level.groundAhead(this, this.facing))) {
        this.facing = -this.facing;
        this.charging = 0;
      }
      this.vx = this.facing * (this.charging > 0 ? ONI_CHARGE_SPEED : ONI_SPEED);
    }
    this.vy = Math.min(this.vy + GRAVITY_FALL, MAX_FALL_SPEED);
    level.moveEntity(this);
  }

  draw(ctx) {
    const anim = this.art.walk;
    const ref = anim[sideOf(this.facing)][0];
    const img = frameAt(anim, this.facing, Math.floor(this.tick / 9));
    const speed = this.charging > 0 ? 0.32 : 0.18;
    const s = Math.sin(this.tick * speed);
    drawFigure(ctx, img, ref, this.centerX, this.bottom, 250, {
      rot: this.hitstun > 0 ? -this.facing * 0.15 : s * 0.05 + (this.charging > 0 ? this.facing * 0.1 : 0),
      oy: -Math.abs(s) * 8,
      sy: 1 + Math.abs(s) * 0.02,
      flash: this.flash,
    });
  }
}

// Ghost (yurei): drifts back and forth at its spawn height, then lunges at
// the player along a straight line and floats back home. Passes through walls.
export class Ghost extends Enemy {
  constructor(art, x, feetY, range = 3) {
    super(GHOST_W, GHOST_H, GHOST_HEALTH, GHOST_DAMAGE);
    this.art = art;
    this.centerX = x;
    this.bottom = feetY;
    this.homeX = this.x;
    this.homeY = this.y;
    this.range = range * TILE;
    this.mode = 'drift';
    this.modeTick = 0;
    this.cooldown = 60;
    this.facing = LEFT_FACING;
    this.driftDir = -1;
  }

  update(level, player) {
    this.baseUpdate();
    this.modeTick++;
    if (this.hitstun > 0) {
      this.x += this.vx;
      this.vx *= 0.85;
      if (this.mode === 'dive') this.setMode('return');
      return;
    }
    const dx = player.centerX - this.centerX;
    const dy = player.centerY - this.centerY;
    if (this.cooldown > 0) this.cooldown--;

    if (this.mode === 'drift') {
      this.x += this.driftDir * GHOST_SPEED;
      if (this.x < this.homeX - this.range) this.driftDir = 1;
      if (this.x > this.homeX + this.range) this.driftDir = -1;
      this.y = this.homeY + Math.sin(this.tick * 0.05) * 22;
      this.facing = this.driftDir > 0 ? RIGHT_FACING : LEFT_FACING;
      if (this.cooldown <= 0 && Math.abs(dx) < GHOST_TRIGGER_X && dy > -TILE && dy < TILE * 5) {
        this.setMode('windup');
        this.facing = dx > 0 ? RIGHT_FACING : LEFT_FACING;
      }
    } else if (this.mode === 'windup') {
      if (this.modeTick >= 24) {
        const len = Math.hypot(dx, dy) || 1;
        this.dvx = (dx / len) * GHOST_DIVE_SPEED;
        this.dvy = (dy / len) * GHOST_DIVE_SPEED;
        // Fly all the way to where the player was (plus a little overshoot),
        // so a ghost can always reach someone standing on the ground below.
        this.diveTicks = Math.min(90, Math.ceil((len + 120) / GHOST_DIVE_SPEED));
        this.setMode('dive');
      }
    } else if (this.mode === 'dive') {
      this.x += this.dvx;
      this.y += this.dvy;
      if (this.modeTick > this.diveTicks) this.setMode('return');
    } else if (this.mode === 'return') {
      const tx = Math.max(this.homeX - this.range, Math.min(this.homeX + this.range, this.x));
      this.x += (tx - this.x) * 0.04;
      this.y += (this.homeY - this.y) * 0.05;
      if (Math.abs(this.y - this.homeY) < 6) {
        this.setMode('drift');
        this.cooldown = GHOST_COOLDOWN_TICKS;
      }
    }
  }

  setMode(mode) {
    this.mode = mode;
    this.modeTick = 0;
  }

  draw(ctx) {
    const anim = this.art.fly;
    const img = frameAt(anim, this.facing, 0);
    const shiver = this.mode === 'windup' ? Math.sin(this.modeTick * 1.7) * 6 : 0;
    const lean = this.mode === 'dive' ? this.facing * 0.25 : Math.sin(this.tick * 0.04) * 0.06;
    ctx.save();
    ctx.globalAlpha = 0.86 + Math.sin(this.tick * 0.09) * 0.08;
    drawFigure(ctx, img, anim[sideOf(this.facing)][0], this.centerX, this.bottom + 20, 230, {
      rot: lean, ox: shiver, flash: Math.max(this.flash, this.mode === 'windup' ? 0.25 : 0),
    });
    ctx.restore();
  }
}

// Haunted lantern turret: stays put, and while it's on screen it winds up
// (glowing) then spits a fireball aimed at the player.
export class Lantern extends Enemy {
  constructor(art, x, feetY) {
    super(LANTERN_W, LANTERN_H, LANTERN_HEALTH, LANTERN_DAMAGE);
    this.art = art;
    this.centerX = x;
    this.bottom = feetY;
    this.baseY = this.y;
    this.cooldown = 80;
    this.windup = 0;
    this.castTicks = 0;
  }

  // Returns a fireball spec on the tick it fires.
  update(level, player, visible) {
    this.baseUpdate();
    this.y = this.baseY - Math.abs(Math.sin(this.tick * 0.06)) * 18;
    if (this.castTicks > 0) this.castTicks--;
    if (this.hitstun > 0) {
      this.windup = 0;
      return null;
    }
    this.facing = player.centerX > this.centerX ? RIGHT_FACING : LEFT_FACING;
    if (!visible) return null;
    if (this.windup > 0) {
      this.windup--;
      if (this.windup === 0) {
        this.castTicks = 18;
        this.cooldown = LANTERN_INTERVAL_TICKS;
        const sx = this.centerX + this.facing * 40;
        const sy = this.y + this.h * 0.62;
        const dx = player.centerX - sx;
        const dy = player.y + player.h * 0.45 - sy;
        // Aim at the player, but never steeper than ~30 degrees.
        const angle = Math.max(-0.5, Math.min(0.5, Math.atan2(dy, Math.abs(dx))));
        return {
          x: sx, y: sy, vx: this.facing * Math.cos(angle) * FIREBALL_SPEED, vy: Math.sin(angle) * FIREBALL_SPEED,
        };
      }
    } else if (this.cooldown > 0) {
      this.cooldown--;
    } else {
      this.windup = LANTERN_WINDUP_TICKS;
    }
    return null;
  }

  draw(ctx) {
    const pose = this.castTicks > 0 ? 'cast' : this.windup > 0 ? 'windup' : 'idle';
    const anim = this.art[pose];
    const img = frameAt(anim, this.facing, Math.floor(this.tick / 6));
    const ref = this.art.idle[sideOf(this.facing)][0];
    const shake = this.windup > 0 && this.windup < 16 ? Math.sin(this.tick * 2.3) * 4 : 0;
    drawFigure(ctx, img, ref, this.centerX, this.bottom, 175, {
      ox: shake, rot: Math.sin(this.tick * 0.05) * 0.06,
      sy: this.castTicks > 0 ? 1.08 : 1, sx: this.castTicks > 0 ? 0.94 : 1, flash: this.flash, outline: false,
    });
  }
}

// ---------------------------------------------------------------------------
// Boss
// ---------------------------------------------------------------------------
// States: 'waiting' (until the arena locks) -> 'walk' | 'windup' -> 'slash'
// -> 'recover' | 'jump', and 'dying'. Below half health it enters a second
// phase: faster, shorter wind-ups.
export class Boss extends Enemy {
  constructor(art, x, feetY, config) {
    super(BOSS_W, BOSS_H, config.health ?? 200, (config.attackStrength ?? 15) * BOSS_DAMAGE_MULTIPLIER);
    this.art = art;
    this.config = config;
    this.name = config.name ?? 'Boss';
    this.assetPrefix = config.assetPrefix ?? 'boss';
    this.centerX = x;
    this.bottom = feetY;
    this.facing = LEFT_FACING;
    this.state = 'waiting';
    this.stateTick = 0;
    this.cooldown = 60;
    this.jumpTimer = 200;
    this.hitThisSwing = false;
    this.invuln = 0;
    this.dyingTick = 0;
    this.deathDone = false;
    this.coinDrop = 10;
    this.fireMin = config.fireballIntervalMinTicks ?? config.fireballIntervalTicks ?? null;
    this.fireMax = config.fireballIntervalMaxTicks ?? config.fireballIntervalTicks ?? null;
    this.fireOrigins = config.fireballOrigins ?? ['center'];
    this.fireTimer = this.nextFireInterval();
    this.events = [];
  }

  get phase2() {
    return this.health <= this.maxHealth / 2;
  }

  get harmful() {
    return this.alive && this.state !== 'waiting';
  }

  nextFireInterval() {
    if (this.fireMin == null) return Infinity;
    return this.fireMin + Math.round(Math.random() * (this.fireMax - this.fireMin));
  }

  setState(s) {
    this.state = s;
    this.stateTick = 0;
  }

  takeHit(amount, fromX) {
    if (this.invuln > 0 || !this.alive) return false;
    this.health -= amount;
    this.flash = 1;
    this.invuln = 8;
    // Bosses only flinch a little - they don't get stun-locked.
    if (this.state !== 'slash' && this.state !== 'jump') this.vx = (this.centerX < fromX ? -1 : 1) * 4;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.setState('dying');
      this.vx = 0;
      return true;
    }
    return false;
  }

  isAttackActive() {
    return this.state === 'slash' && !this.hitThisSwing;
  }

  getAttackHitbox() {
    const top = this.y + 40;
    const bottom = this.bottom - 10;
    return this.facing === LEFT_FACING
      ? { left: this.centerX - BOSS_REACH, right: this.centerX, top, bottom }
      : { left: this.centerX, right: this.centerX + BOSS_REACH, top, bottom };
  }

  // Returns a fireball spec on ticks it throws one.
  update(level, player, arena) {
    this.events.length = 0;
    this.baseUpdate();
    this.stateTick++;
    if (this.invuln > 0) this.invuln--;
    let shot = null;

    if (this.state === 'dying') {
      this.dyingTick++;
      if (this.dyingTick >= BOSS_DEATH_TICKS) this.deathDone = true;
      this.vy = Math.min(this.vy + GRAVITY_FALL, MAX_FALL_SPEED);
      this.vx *= 0.9;
      level.moveEntity(this);
      return null;
    }
    if (this.state === 'waiting') {
      this.vy = Math.min(this.vy + GRAVITY_FALL, MAX_FALL_SPEED);
      level.moveEntity(this);
      return null;
    }

    const speedMul = this.phase2 ? 1.35 : 1;
    const dx = player.centerX - this.centerX;
    const wasOnGround = this.onGround;

    switch (this.state) {
      case 'walk': {
        this.facing = dx > 0 ? RIGHT_FACING : LEFT_FACING;
        if (this.cooldown > 0) this.cooldown--;
        if (this.jumpTimer > 0) this.jumpTimer--;
        const dist = Math.abs(dx);
        if (this.cooldown <= 0 && dist < BOSS_ATTACK_TRIGGER) {
          this.setState('windup');
          this.vx = 0;
          this.events.push('windup');
        } else if (this.jumpTimer <= 0 && this.onGround) {
          this.setState('jump');
          this.vy = -BOSS_JUMP_VELOCITY;
          this.vx = Math.sign(dx) * Math.min(9, dist / 40);
          this.jumpTimer = (this.phase2 ? 150 : 230) + Math.random() * 80;
        } else {
          const target = dist > 220 ? this.facing * BOSS_SPEED * speedMul : 0;
          this.vx = approach(this.vx, target, 0.4);
        }
        break;
      }
      case 'windup': {
        this.vx = approach(this.vx, 0, 0.6);
        const windup = this.phase2 ? BOSS_WINDUP_TICKS * 0.7 : BOSS_WINDUP_TICKS;
        if (this.stateTick >= windup) {
          this.setState('slash');
          this.hitThisSwing = false;
          this.vx = this.facing * BOSS_LUNGE_SPEED;
          this.events.push('slash');
        }
        break;
      }
      case 'slash':
        this.vx = approach(this.vx, 0, 1.2);
        if (this.stateTick >= BOSS_ACTIVE_TICKS) this.setState('recover');
        break;
      case 'recover':
        this.vx = approach(this.vx, 0, 0.8);
        if (this.stateTick >= (this.phase2 ? BOSS_RECOVER_TICKS * 0.75 : BOSS_RECOVER_TICKS)) {
          this.setState('walk');
          this.cooldown = this.phase2 ? 40 : 70;
        }
        break;
      case 'jump':
        if (this.onGround && this.stateTick > 4) {
          this.setState('recover');
          this.stateTick = Math.floor(BOSS_RECOVER_TICKS * 0.5);
        }
        break;
      default:
        break;
    }

    if (this.fireTimer !== Infinity && this.state !== 'dying') {
      this.fireTimer--;
      if (this.fireTimer <= 0 && (this.state === 'walk' || this.state === 'recover')) {
        this.fireTimer = this.nextFireInterval();
        const origin = this.fireOrigins[Math.floor(Math.random() * this.fireOrigins.length)];
        const dir = dx > 0 ? 1 : -1;
        this.facing = dir;
        shot = {
          x: this.centerX + dir * 60,
          y: origin === 'top' ? this.y + this.h * 0.18 : this.centerY,
          vx: dir * FIREBALL_SPEED * 1.1,
          vy: 0,
        };
      }
    }

    this.vy = Math.min(this.vy + GRAVITY_FALL, MAX_FALL_SPEED);
    level.moveEntity(this);
    if (arena) {
      if (this.x < arena.left) { this.x = arena.left; this.vx = 0; }
      if (this.right > arena.right) { this.x = arena.right - this.w; this.vx = 0; }
    }
    if (this.onGround && !wasOnGround) this.events.push('land');
    return shot;
  }

  draw(ctx) {
    const { art } = this;
    const procedural = art.procedural;
    const ref = art.stand[sideOf(this.facing)][0];
    const t = this.stateTick;
    const o = { flash: this.flash };
    let anim = art.stand;
    let idx = 0;

    if (this.state === 'dying') {
      anim = art.death;
      idx = Math.min(5, Math.floor(this.dyingTick / 8));
      const k = Math.min(1, this.dyingTick / BOSS_DEATH_TICKS);
      if (procedural) {
        o.rot = -this.facing * k * 1.3;
        o.alpha = 1 - k * 0.9;
        o.ox = Math.sin(this.dyingTick * 1.3) * 10 * (1 - k);
      }
      o.flash = this.dyingTick % 10 < 5 ? 0.6 : 0;
    } else if (this.state === 'windup') {
      anim = art.attack;
      idx = 0;
      const windup = this.phase2 ? BOSS_WINDUP_TICKS * 0.7 : BOSS_WINDUP_TICKS;
      const k = Math.min(1, t / windup);
      if (procedural) {
        o.rot = -this.facing * 0.16 * k;
        o.ox = -this.facing * 22 * k + (k > 0.7 ? Math.sin(t * 2.5) * 4 : 0);
        o.sy = 1 + 0.05 * k;
      }
      o.flash = k > 0.75 && t % 6 < 3 ? 0.5 : this.flash;
    } else if (this.state === 'slash') {
      anim = art.attack;
      idx = 1;
      if (procedural) {
        o.rot = this.facing * 0.2;
        o.sx = 1.08;
        o.sy = 0.95;
      }
    } else if (this.state === 'recover') {
      anim = art.attack;
      idx = 2;
      if (procedural) o.rot = this.facing * 0.08 * Math.max(0, 1 - t / 20);
    } else if (!this.onGround) {
      anim = art.jump;
      if (procedural) {
        o.sy = 1 + Math.max(-0.1, Math.min(0.1, -this.vy * 0.004));
        o.rot = this.facing * 0.05;
      }
    } else if (Math.abs(this.vx) > 0.5) {
      anim = art.move;
      idx = Math.floor(this.tick / 10);
      if (procedural) {
        const s = Math.sin(this.tick * 0.16);
        o.oy = -Math.abs(s) * 10;
        o.rot = s * 0.04;
      }
    } else if (procedural) {
      o.sy = 1 + Math.sin(this.tick * 0.06) * 0.015;
    }

    const img = frameAt(anim, this.facing, idx);
    drawFigure(ctx, img, ref, this.centerX, this.bottom, 410, o);
  }
}

// ---------------------------------------------------------------------------
// Projectiles, pickups, doors
// ---------------------------------------------------------------------------
export class Fireball extends Entity {
  constructor(image, spec, damage = FIREBALL_DAMAGE) {
    super(spec.x - FIREBALL_SIZE / 2, spec.y - FIREBALL_SIZE / 2, FIREBALL_SIZE, FIREBALL_SIZE);
    this.image = image;
    this.vx = spec.vx;
    this.vy = spec.vy;
    this.damage = damage;
    this.life = 0;
  }

  update(level) {
    this.x += this.vx;
    this.y += this.vy;
    this.life++;
    if (this.life > FIREBALL_LIFE_TICKS || level.pointSolid(this.centerX, this.centerY)) this.alive = false;
  }

  draw(ctx) {
    const pulse = 1 + Math.sin(this.life * 0.6) * 0.12;
    const size = FIREBALL_SIZE * 1.8 * pulse;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.image, this.centerX - size / 2, this.centerY - size / 2, size, size);
    ctx.restore();
  }
}

export class Pickup extends Entity {
  // kind: 'coin' | 'heart'. Dropped pickups pop out with physics and
  // eventually blink away; placed ones float in place forever.
  constructor(kind, x, y, { dropped = false, value = 1 } = {}) {
    super(x - COIN_SIZE / 2, y - COIN_SIZE / 2, COIN_SIZE, COIN_SIZE);
    this.kind = kind;
    this.value = value;
    this.dropped = dropped;
    this.baseY = this.y;
    this.tick = Math.floor(Math.random() * 60);
    this.life = 0;
    if (dropped) {
      this.vx = (Math.random() - 0.5) * 10;
      this.vy = -14 - Math.random() * 8;
    }
  }

  update(level) {
    this.tick++;
    if (!this.dropped) {
      this.y = this.baseY + Math.sin(this.tick * 0.08) * 8;
      return;
    }
    this.life++;
    if (this.life > DROPPED_COIN_LIFE_TICKS) this.alive = false;
    const fallSpeed = this.vy;
    this.vy = Math.min(this.vy + 1.2, 24);
    level.moveEntity(this);
    if (this.onGround) {
      this.vx *= 0.8;
      if (fallSpeed > 5) {
        this.vy = -fallSpeed * 0.45;
        this.onGround = false;
      }
    }
    if (this.hitWall) this.vx = -this.vx * 0.5;
  }

  // Collected only after a few ticks, so a fresh drop visibly pops out first.
  get collectable() {
    return !this.dropped || this.life > 12;
  }

  draw(ctx, coinFrames) {
    if (this.dropped && this.life > DROPPED_COIN_LIFE_TICKS - 120 && Math.floor(this.life / 4) % 2) return;
    const cx = this.centerX;
    const cy = this.centerY;
    if (this.kind === 'heart') {
      drawHeart(ctx, cx, cy, 34 * (1 + Math.sin(this.tick * 0.15) * 0.08), 1);
      return;
    }
    const img = coinFrames[Math.floor(this.tick / 6) % coinFrames.length];
    const s = COIN_SIZE * 1.15;
    ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s);
  }
}

// Shared heart shape - used for the heart pickup and the HUD health row.
// `fill` 0..1 fills the heart from the left.
export function drawHeart(ctx, cx, cy, r, fill, empty = '#3a1c1c') {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.9);
    ctx.bezierCurveTo(cx - r * 1.4, cy, cx - r * 1.1, cy - r * 1.1, cx, cy - r * 0.45);
    ctx.bezierCurveTo(cx + r * 1.1, cy - r * 1.1, cx + r * 1.4, cy, cx, cy + r * 0.9);
    ctx.closePath();
  };
  ctx.save();
  path();
  ctx.fillStyle = empty;
  ctx.fill();
  if (fill > 0) {
    ctx.save();
    path();
    ctx.clip();
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, '#ff6b6b');
    g.addColorStop(1, '#c0182b');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r * 1.5, cy - r * 1.5, r * 3 * fill, r * 3);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.45, cy - r * 0.35, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  path();
  ctx.lineWidth = Math.max(3, r * 0.16);
  ctx.strokeStyle = '#1b1210';
  ctx.stroke();
  ctx.restore();
}

export class Door extends Entity {
  constructor(kind, x, feetY, image, shopId = null) {
    super(x - TILE / 2, feetY - TILE * 2, TILE, TILE * 2);
    this.kind = kind;
    this.image = image;
    this.shopId = shopId;
    this.locked = false;
  }

  draw(ctx) {
    ctx.drawImage(this.image, this.x, this.y, this.w, this.h);
    if (this.locked) {
      // A paper seal (ofuda) pasted across the door until the boss falls.
      ctx.save();
      ctx.translate(this.centerX, this.y + this.h * 0.55);
      ctx.rotate(-0.08);
      ctx.fillStyle = '#f4ecd0';
      ctx.fillRect(-26, -90, 52, 180);
      ctx.strokeStyle = '#1b1210';
      ctx.lineWidth = 4;
      ctx.strokeRect(-26, -90, 52, 180);
      ctx.fillStyle = '#b3241a';
      ctx.font = 'bold 40px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('封', 0, -40);
      ctx.fillText('印', 0, 20);
      ctx.restore();
    }
  }
}
