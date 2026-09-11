import { AnimatedSprite, Sprite } from './sprite.js';
import {
  RIGHT_FACING, LEFT_FACING, MAX_HEALTH, SPRITE_SIZE,
  ATTACK_TOTAL_TICKS, ATTACK_ACTIVE_START, ATTACK_ACTIVE_END, ATTACK_RANGE,
  BOSS_HEALTH, BOSS_MOVE_SPEED, BOSS_JUMP_SPEED, BOSS_JUMP_INTERVAL_TICKS,
  BOSS_ATTACK_TOTAL_TICKS, BOSS_ATTACK_ACTIVE_START, BOSS_ATTACK_ACTIVE_END,
  BOSS_ATTACK_RANGE, BOSS_ATTACK_TRIGGER_RANGE, BOSS_ATTACK_COOLDOWN_TICKS,
  BOSS_ATTACK_STRENGTH,
  FIRE_ENEMY_HEALTH, FIRE_ENEMY_INTERVAL_TICKS, FIRE_ENEMY_CAST_POSE_TICKS,
  FIREBALL_SPEED, FIREBALL_DAMAGE, FIREBALL_LIFE_TICKS,
  SWOOP_ENEMY_HEALTH, SWOOP_PATROL_SPEED, SWOOP_TRIGGER_RANGE_X, SWOOP_TRIGGER_RANGE_Y,
  SWOOP_DIVE_SPEED, SWOOP_MAX_DIVE, SWOOP_RETURN_SPEED, SWOOP_COOLDOWN_TICKS,
} from './constants.js';

// Port of Player.pde, extended with a real attack: a swing has a wind-up,
// a short active window where it can land exactly one hit, then recovery.
export class Player extends AnimatedSprite {
  constructor(images, stats = {}) {
    super(images.playerStandRight, 1.0);
    this.maxHealth = stats.maxHealth ?? MAX_HEALTH;
    this.health = this.maxHealth;
    this.attackStrength = stats.attackStrength ?? 10;
    this.gravityScale = stats.gravityScale ?? 1;
    this.direction = RIGHT_FACING;
    this.attacking = false;
    this.attackTick = 0;
    this.hasHitThisSwing = false;
    this.onPlatform = true;
    this.inPlace = true;
    this.invulnerableTicks = 0;
    this.flashTicks = 0;

    this.standLeft = [images.playerStandLeft];
    this.standRight = [images.playerStandRight];
    this.jumpLeft = [images.playerJumpLeft];
    this.jumpRight = [images.playerJumpRight];
    this.moveLeft = [images.playerMoveLeft1, images.playerMoveLeft2];
    this.moveRight = [images.playerMoveRight1, images.playerMoveRight2];
    this.attackLeft = [images.playerFightLeft1, images.playerFightLeft2, images.playerFightLeft3];
    this.attackRight = [images.playerFightRight1, images.playerFightRight2, images.playerFightRight3];

    this.currentImages = this.standRight;
  }

  startAttack() {
    if (this.attacking) return;
    this.attacking = true;
    this.attackTick = 0;
    this.hasHitThisSwing = false;
    this.index = 0;
  }

  updateAttackTimer() {
    if (!this.attacking) return;
    this.attackTick++;
    if (this.attackTick >= ATTACK_TOTAL_TICKS) {
      this.attacking = false;
    }
  }

  isAttackActive() {
    return this.attacking
      && !this.hasHitThisSwing
      && this.attackTick >= ATTACK_ACTIVE_START
      && this.attackTick <= ATTACK_ACTIVE_END;
  }

  // Hit box in front of the player, in the direction they're facing.
  getAttackHitbox() {
    const top = this.getTop();
    const bottom = this.getBottom();
    if (this.direction === LEFT_FACING) {
      return { left: this.getLeft() - ATTACK_RANGE, right: this.getLeft(), top, bottom };
    }
    return { left: this.getRight(), right: this.getRight() + ATTACK_RANGE, top, bottom };
  }

  updateAnimation(onPlatform) {
    this.onPlatform = onPlatform;
    this.inPlace = this.changeX === 0 && this.changeY === 0;
    super.updateAnimation();
  }

  selectDirection() {
    if (this.changeX > 0) this.direction = RIGHT_FACING;
    else if (this.changeX < 0) this.direction = LEFT_FACING;
  }

  selectCurrentImages() {
    if (this.direction === RIGHT_FACING && !this.attacking) {
      if (this.inPlace) this.currentImages = this.standRight;
      else if (!this.onPlatform) this.currentImages = this.jumpRight;
      else this.currentImages = this.moveRight;
    } else if (this.direction === LEFT_FACING && !this.attacking) {
      if (this.inPlace) this.currentImages = this.standLeft;
      else if (!this.onPlatform) this.currentImages = this.jumpLeft;
      else this.currentImages = this.moveLeft;
    } else if (this.direction === RIGHT_FACING && this.attacking) {
      this.currentImages = this.attackRight;
    } else if (this.direction === LEFT_FACING && this.attacking) {
      this.currentImages = this.attackLeft;
    }
  }
}

// Port of Enemy.pde: patrols between two x boundaries, now with health that
// the player's attack can actually deplete.
export class Enemy extends AnimatedSprite {
  constructor(images, boundaryLeft, boundaryRight) {
    super(images.spiderWalkRight1, 1.0);
    this.health = 20;
    this.maxHealth = 20;
    this.alive = true;
    this.moveLeft = [images.spiderWalkLeft1, images.spiderWalkLeft2, images.spiderWalkLeft3];
    this.moveRight = [images.spiderWalkRight1, images.spiderWalkRight2, images.spiderWalkRight3];
    this.currentImages = this.moveRight;
    this.direction = RIGHT_FACING;
    this.boundaryLeft = boundaryLeft;
    this.boundaryRight = boundaryRight;
    this.changeX = 2;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }

  update() {
    super.update();
    if (this.getLeft() <= this.boundaryLeft) {
      this.setLeft(this.boundaryLeft);
      this.changeX *= -1;
    } else if (this.getRight() >= this.boundaryRight) {
      this.setRight(this.boundaryRight);
      this.changeX *= -1;
    }
  }
}

// A thrown fireball: travels in a straight line toward wherever the player
// was when it was fired, disappears if it hits the player, a wall, or its
// own lifespan runs out. No image direction variants needed - it's a small
// glowing ball, drawn the same regardless of which way it's moving.
export class Fireball extends Sprite {
  constructor(image, centerX, centerY, direction, damage = FIREBALL_DAMAGE) {
    super(image, 1.0, centerX, centerY);
    this.changeX = direction === LEFT_FACING ? -FIREBALL_SPEED : FIREBALL_SPEED;
    this.changeY = 0;
    this.damage = damage;
    this.alive = true;
    this.lifeTicks = 0;
  }

  update() {
    super.update();
    this.lifeTicks++;
    if (this.lifeTicks >= FIREBALL_LIFE_TICKS) this.alive = false;
  }
}

// A stationary turret enemy: doesn't move, but every ~5s while it's
// actually on screen (checked in game.js, same idea as the boss-visible
// music cue) it fires a Fireball toward whichever side the player is on.
// The cooldown only counts down while visible, so it can't "snipe" the
// player with a shot fired while off-screen and unseen.
export class FireEnemy extends AnimatedSprite {
  constructor(images) {
    super(images.fireEnemyIdleRight, 1.0);
    this.health = FIRE_ENEMY_HEALTH;
    this.maxHealth = FIRE_ENEMY_HEALTH;
    this.alive = true;
    this.direction = RIGHT_FACING;
    this.cooldownTicks = FIRE_ENEMY_INTERVAL_TICKS;
    this.castTicks = 0;

    this.idleLeft = [images.fireEnemyIdleLeft];
    this.idleRight = [images.fireEnemyIdleRight];
    this.castLeft = [images.fireEnemyCastLeft1, images.fireEnemyCastLeft2];
    this.castRight = [images.fireEnemyCastRight1, images.fireEnemyCastRight2];
    this.currentImages = this.idleRight;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }

  // Returns true the tick it actually fires (game.js spawns the Fireball;
  // this class only decides when and which way, it doesn't know about
  // Level/images for building the projectile itself).
  think(playerCenterX, visible) {
    if (this.castTicks > 0) this.castTicks--;
    if (!visible) return false;
    if (this.cooldownTicks > 0) {
      this.cooldownTicks--;
      return false;
    }
    this.direction = playerCenterX >= this.centerX ? RIGHT_FACING : LEFT_FACING;
    this.cooldownTicks = FIRE_ENEMY_INTERVAL_TICKS;
    this.castTicks = FIRE_ENEMY_CAST_POSE_TICKS;
    return true;
  }

  updateAnimation() {
    this.frame++;
    if (this.frame % 5 === 0) {
      this.selectCurrentImages();
      this.advanceToNextImage();
    }
  }

  selectCurrentImages() {
    if (this.castTicks > 0) {
      this.currentImages = this.direction === LEFT_FACING ? this.castLeft : this.castRight;
    } else {
      this.currentImages = this.direction === LEFT_FACING ? this.idleLeft : this.idleRight;
    }
  }
}

// A flying enemy that patrols left-right at a fixed altitude, then dives at
// the player once they're close both horizontally and vertically, and
// climbs back to its patrol altitude afterward. Contact damage during the
// dive is handled generically in game.js, same as any other enemy touch.
export class SwoopEnemy extends AnimatedSprite {
  constructor(images, boundaryLeft, boundaryRight, homeY) {
    super(images.swoopMoveRight1, 1.0);
    this.health = SWOOP_ENEMY_HEALTH;
    this.maxHealth = SWOOP_ENEMY_HEALTH;
    this.alive = true;
    this.moveLeft = [images.swoopMoveLeft1, images.swoopMoveLeft2];
    this.moveRight = [images.swoopMoveRight1, images.swoopMoveRight2];
    this.currentImages = this.moveRight;
    this.direction = RIGHT_FACING;
    this.boundaryLeft = boundaryLeft;
    this.boundaryRight = boundaryRight;
    this.homeY = homeY;
    this.mode = 'patrol'; // 'patrol' | 'diving' | 'returning'
    this.diveDistance = 0;
    this.cooldownTicks = 0;
    this.changeX = SWOOP_PATROL_SPEED;
    this.changeY = 0;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }

  // Decide this tick's vertical intent; game.js calls update() right after
  // to actually apply changeX/changeY.
  think(playerCenterX, playerCenterY) {
    if (this.mode === 'patrol') {
      if (this.cooldownTicks > 0) this.cooldownTicks--;
      const withinX = Math.abs(playerCenterX - this.centerX) < SWOOP_TRIGGER_RANGE_X;
      const withinY = Math.abs(playerCenterY - this.centerY) < SWOOP_TRIGGER_RANGE_Y;
      if (this.cooldownTicks <= 0 && withinX && withinY) {
        this.mode = 'diving';
        this.diveDistance = 0;
        this.changeY = SWOOP_DIVE_SPEED;
      }
    } else if (this.mode === 'diving') {
      this.diveDistance += this.changeY;
      if (this.diveDistance >= SWOOP_MAX_DIVE) {
        this.mode = 'returning';
        this.changeY = -SWOOP_RETURN_SPEED;
      }
    } else if (this.mode === 'returning') {
      if (this.centerY <= this.homeY) {
        this.centerY = this.homeY;
        this.changeY = 0;
        this.mode = 'patrol';
        this.cooldownTicks = SWOOP_COOLDOWN_TICKS;
      }
    }
  }

  update() {
    super.update();
    if (this.mode === 'patrol') {
      if (this.getLeft() <= this.boundaryLeft) {
        this.setLeft(this.boundaryLeft);
        this.changeX = Math.abs(this.changeX);
      } else if (this.getRight() >= this.boundaryRight) {
        this.setRight(this.boundaryRight);
        this.changeX = -Math.abs(this.changeX);
      }
    }
  }

  selectDirection() {
    if (this.changeX > 0) this.direction = RIGHT_FACING;
    else if (this.changeX < 0) this.direction = LEFT_FACING;
  }

  selectCurrentImages() {
    this.currentImages = this.direction === LEFT_FACING ? this.moveLeft : this.moveRight;
  }
}

// Builds the { standLeft, standRight, moveLeft, ... } sprite-array set for a
// boss from `images`, keyed by an asset prefix ('boss', 'boss2', 'boss3', ...)
// so different bosses can use entirely different placeholder art sets while
// sharing the same BossEnemy behavior.
function bossSpriteSet(images, prefix) {
  const key = (suffix) => images[`${prefix}${suffix}`];
  return {
    standLeft: [key('StandLeft')],
    standRight: [key('StandRight')],
    moveLeft: [key('MoveLeft1'), key('MoveLeft2')],
    moveRight: [key('MoveRight1'), key('MoveRight2')],
    jumpLeft: [key('JumpLeft')],
    jumpRight: [key('JumpRight')],
    attackLeft: [key('AttackLeft1'), key('AttackLeft2'), key('AttackLeft3')],
    attackRight: [key('AttackRight1'), key('AttackRight2'), key('AttackRight3')],
  };
}

// A big (4x normal-enemy size, 10x+ HP) enemy that patrols a range in front
// of a level's exit door: walks back and forth, periodically hops, and
// swings a melee attack whenever the player gets close. Uses the same
// attack-timer shape as Player (wind-up / active window / recovery) so its
// swing can be checked with the same kind of hitbox overlap. `options` lets
// each boss encounter scale its own health/damage and use its own art set
// (see BOSS asset prefixes in assets.js and the `boss` field in levels-data.js).
export class BossEnemy extends AnimatedSprite {
  constructor(images, boundaryLeft, boundaryRight, options = {}) {
    const assetPrefix = options.assetPrefix ?? 'boss';
    const sprites = bossSpriteSet(images, assetPrefix);
    super(sprites.standRight[0], 1.0);
    this.assetPrefix = assetPrefix; // also used to look up this boss's music track
    this.health = options.health ?? BOSS_HEALTH;
    this.maxHealth = this.health;
    this.alive = true;
    this.attackStrength = options.attackStrength ?? BOSS_ATTACK_STRENGTH;
    this.boundaryLeft = boundaryLeft;
    this.boundaryRight = boundaryRight;
    this.direction = RIGHT_FACING;
    this.onPlatform = true;

    this.attacking = false;
    this.attackTick = 0;
    this.hasHitThisSwing = false;
    this.attackCooldownTicks = 0;
    this.jumpTicks = BOSS_JUMP_INTERVAL_TICKS;

    this.standLeft = sprites.standLeft;
    this.standRight = sprites.standRight;
    this.moveLeft = sprites.moveLeft;
    this.moveRight = sprites.moveRight;
    this.jumpLeft = sprites.jumpLeft;
    this.jumpRight = sprites.jumpRight;
    this.attackLeft = sprites.attackLeft;
    this.attackRight = sprites.attackRight;
    this.currentImages = this.standRight;
    this.changeX = BOSS_MOVE_SPEED;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }

  isAttackActive() {
    return this.attacking
      && !this.hasHitThisSwing
      && this.attackTick >= BOSS_ATTACK_ACTIVE_START
      && this.attackTick <= BOSS_ATTACK_ACTIVE_END;
  }

  getAttackHitbox() {
    const top = this.getTop();
    const bottom = this.getBottom();
    if (this.direction === LEFT_FACING) {
      return { left: this.getLeft() - BOSS_ATTACK_RANGE, right: this.getLeft(), top, bottom };
    }
    return { left: this.getRight(), right: this.getRight() + BOSS_ATTACK_RANGE, top, bottom };
  }

  // Decide this tick's intent (attack / jump / patrol) from the player's
  // position. Called before physics; resolvePlatformCollisions() in game.js
  // then actually moves it using whatever changeX/changeY this sets.
  think(playerCenterX) {
    if (this.attacking) {
      this.changeX = 0;
      this.attackTick++;
      if (this.attackTick >= BOSS_ATTACK_TOTAL_TICKS) {
        this.attacking = false;
        this.attackCooldownTicks = BOSS_ATTACK_COOLDOWN_TICKS;
        this.changeX = this.direction === LEFT_FACING ? -BOSS_MOVE_SPEED : BOSS_MOVE_SPEED;
      }
      return;
    }

    if (this.attackCooldownTicks > 0) this.attackCooldownTicks--;
    if (this.jumpTicks > 0) this.jumpTicks--;

    const withinReach = Math.abs(playerCenterX - this.centerX) < BOSS_ATTACK_TRIGGER_RANGE;
    if (this.attackCooldownTicks <= 0 && withinReach && this.onPlatform) {
      this.direction = playerCenterX >= this.centerX ? RIGHT_FACING : LEFT_FACING;
      this.attacking = true;
      this.attackTick = 0;
      this.hasHitThisSwing = false;
      this.index = 0;
      this.changeX = 0;
      return;
    }

    if (this.jumpTicks <= 0 && this.onPlatform) {
      this.changeY = -BOSS_JUMP_SPEED;
      this.jumpTicks = BOSS_JUMP_INTERVAL_TICKS;
    }

    if (this.changeX === 0) this.changeX = this.direction === LEFT_FACING ? -BOSS_MOVE_SPEED : BOSS_MOVE_SPEED;
  }

  // Called after physics resolves this tick's movement: bounce off the
  // patrol boundaries, same shape as Enemy's boundary check.
  enforceBoundary() {
    if (this.attacking) return;
    if (this.getLeft() <= this.boundaryLeft) {
      this.setLeft(this.boundaryLeft);
      this.changeX = Math.abs(this.changeX) || BOSS_MOVE_SPEED;
    } else if (this.getRight() >= this.boundaryRight) {
      this.setRight(this.boundaryRight);
      this.changeX = -(Math.abs(this.changeX) || BOSS_MOVE_SPEED);
    }
  }

  updateAnimation(onPlatform) {
    this.onPlatform = onPlatform;
    this.frame++;
    if (this.frame % 5 === 0) {
      this.selectDirection();
      this.selectCurrentImages();
      this.advanceToNextImage();
    }
  }

  selectDirection() {
    if (this.changeX > 0) this.direction = RIGHT_FACING;
    else if (this.changeX < 0) this.direction = LEFT_FACING;
  }

  selectCurrentImages() {
    if (this.attacking) {
      this.currentImages = this.direction === LEFT_FACING ? this.attackLeft : this.attackRight;
    } else if (!this.onPlatform) {
      this.currentImages = this.direction === LEFT_FACING ? this.jumpLeft : this.jumpRight;
    } else if (this.changeX === 0) {
      this.currentImages = this.direction === LEFT_FACING ? this.standLeft : this.standRight;
    } else {
      this.currentImages = this.direction === LEFT_FACING ? this.moveLeft : this.moveRight;
    }
  }
}

// Port of Coin.pde.
export class Coin extends AnimatedSprite {
  constructor(images) {
    super(images.gold1, 1.0);
    this.standNeutral = [images.gold1, images.gold2, images.gold3, images.gold4];
    this.currentImages = this.standNeutral;
  }
}

// A building's door: either the level exit ("exit") or a shop entrance
// ("shop", carrying a shopId into SHOPS in shops-data.js). Rendered with the
// door_exit.png / door_shop.png placeholders (see assets.js) since no door
// art existed in assets/.
export class Door {
  constructor(col, row, kind, image, shopId = null) {
    this.col = col;
    this.row = row;
    this.kind = kind;
    this.image = image;
    this.shopId = shopId;
    this.w = SPRITE_SIZE;
    this.h = SPRITE_SIZE * 2;
    this.centerX = col * SPRITE_SIZE + SPRITE_SIZE / 2;
    this.centerY = row * SPRITE_SIZE + SPRITE_SIZE;
  }

  getLeft() { return this.centerX - this.w / 2; }
  getRight() { return this.centerX + this.w / 2; }
  getTop() { return this.centerY - this.h / 2; }
  getBottom() { return this.centerY + this.h / 2; }

  display(ctx, viewX, viewY) {
    ctx.drawImage(
      this.image,
      this.centerX - this.w / 2 - viewX,
      this.centerY - this.h / 2 - viewY,
      this.w,
      this.h,
    );
  }
}
