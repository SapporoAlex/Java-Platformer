import { Sprite } from './sprite.js';
import { Coin, Enemy, Door, BossEnemy, FireEnemy, SwoopEnemy } from './entities.js';
import {
  SPRITE_SIZE, SPRITE_SCALE, SOLID_TILES, DECORATIVE_TILES, TILE_IMAGE_KEYS, GROUND_LEVEL,
  CANVAS_WIDTH, CANVAS_HEIGHT,
} from './constants.js';

// Builds the runtime level (platforms/passableTiles/coins/enemies/doors/boss)
// from a LEVELS[] data entry, mirroring createPlatforms() in wonderBoy.pde.
export class Level {
  constructor(data, images) {
    this.data = data;
    this.images = images;
    this.platforms = [];
    this.passableTiles = [];
    this.coins = [];
    this.enemies = [];
    this.fireEnemies = [];
    this.swoopEnemies = [];
    this.fireballs = [];
    this.doors = [];
    this.boss = null;

    const rows = data.tiles.length;
    const cols = data.tiles[0].length;
    this.widthPx = cols * SPRITE_SIZE;
    this.heightPx = rows * SPRITE_SIZE;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const code = data.tiles[row][col];
        if (code === 0) continue;
        const imageKey = TILE_IMAGE_KEYS[code];
        if (!imageKey) continue;
        const sprite = new Sprite(images[imageKey], SPRITE_SCALE);
        sprite.centerX = SPRITE_SIZE / 2 + col * SPRITE_SIZE;
        sprite.centerY = SPRITE_SIZE / 2 + row * SPRITE_SIZE;
        if (SOLID_TILES.has(code)) this.platforms.push(sprite);
        else if (DECORATIVE_TILES.has(code)) this.passableTiles.push(sprite);
      }
    }

    for (const c of data.coins) {
      const coin = new Coin(images);
      coin.centerX = SPRITE_SIZE / 2 + c.col * SPRITE_SIZE;
      coin.centerY = SPRITE_SIZE / 2 + c.row * SPRITE_SIZE;
      this.coins.push(coin);
    }

    for (const e of data.enemies) {
      const boundaryLeft = e.col * SPRITE_SIZE;
      const boundaryRight = boundaryLeft + e.rangeTiles * SPRITE_SIZE;
      const enemy = new Enemy(images, boundaryLeft, boundaryRight);
      enemy.centerX = SPRITE_SIZE / 2 + e.col * SPRITE_SIZE;
      enemy.centerY = SPRITE_SIZE / 2 + e.row * SPRITE_SIZE;
      this.enemies.push(enemy);
    }

    for (const f of data.fireEnemies ?? []) {
      const fireEnemy = new FireEnemy(images);
      fireEnemy.centerX = SPRITE_SIZE / 2 + f.col * SPRITE_SIZE;
      fireEnemy.centerY = SPRITE_SIZE / 2 + f.row * SPRITE_SIZE;
      this.fireEnemies.push(fireEnemy);
    }

    for (const s of data.swoopEnemies ?? []) {
      const boundaryLeft = s.col * SPRITE_SIZE;
      const boundaryRight = boundaryLeft + s.rangeTiles * SPRITE_SIZE;
      const homeY = SPRITE_SIZE / 2 + s.row * SPRITE_SIZE;
      const swoopEnemy = new SwoopEnemy(images, boundaryLeft, boundaryRight, homeY);
      swoopEnemy.centerX = SPRITE_SIZE / 2 + s.col * SPRITE_SIZE;
      swoopEnemy.centerY = homeY;
      this.swoopEnemies.push(swoopEnemy);
    }

    for (const d of data.doors) {
      const image = d.kind === 'shop' ? images.doorShop : images.doorExit;
      this.doors.push(new Door(d.col, d.row, d.kind, image, d.shopId ?? null));
    }

    if (data.boss) {
      const boundaryLeft = data.boss.col * SPRITE_SIZE;
      const boundaryRight = boundaryLeft + data.boss.rangeTiles * SPRITE_SIZE;
      const boss = new BossEnemy(images, boundaryLeft, boundaryRight, {
        health: data.boss.health,
        attackStrength: data.boss.attackStrength,
        assetPrefix: data.boss.assetPrefix,
      });
      boss.centerX = boundaryLeft + boss.w / 2;
      boss.setBottom(GROUND_LEVEL - SPRITE_SIZE); // stand on the walkway (row 10's top)
      this.boss = boss;
    }
  }

  totalCoins() {
    return this.data.coins.length;
  }
}

export function checkCollision(a, b) {
  const noXOverlap = a.getRight() <= b.getLeft() || a.getLeft() >= b.getRight();
  const noYOverlap = a.getBottom() <= b.getTop() || a.getTop() >= b.getBottom();
  return !(noXOverlap || noYOverlap);
}

export function checkCollisionList(sprite, list) {
  const result = [];
  for (const other of list) {
    if (checkCollision(sprite, other)) result.push(other);
  }
  return result;
}

export function isOnPlatforms(sprite, walls) {
  sprite.centerY += 5;
  const hit = checkCollisionList(sprite, walls).length > 0;
  sprite.centerY -= 5;
  return hit;
}

// Same algorithm as resolvePlatformCollisions() in wonderBoy.pde, minus the
// original's accidental double x-move (it applied change_x, resolved the
// collision, then applied change_x a second time unconditionally).
export function resolvePlatformCollisions(sprite, walls, gravity) {
  sprite.changeY += gravity;

  sprite.centerY += sprite.changeY;
  let collisions = checkCollisionList(sprite, walls);
  if (collisions.length > 0) {
    const hit = collisions[0];
    if (sprite.changeY > 0) sprite.setBottom(hit.getTop());
    else if (sprite.changeY < 0) sprite.setTop(hit.getBottom());
    sprite.changeY = 0;
  }

  sprite.centerX += sprite.changeX;
  collisions = checkCollisionList(sprite, walls);
  if (collisions.length > 0) {
    const hit = collisions[0];
    if (sprite.changeX > 0) sprite.setRight(hit.getLeft());
    else if (sprite.changeX < 0) sprite.setLeft(hit.getRight());
    sprite.changeX = 0;
  }
}

export function fellOffMap(sprite) {
  return sprite.getBottom() > GROUND_LEVEL;
}

// Whether `entity`'s box overlaps the camera's current view rectangle -
// used for the boss music cue and for gating FireEnemy's shots to only when
// it's actually visible.
export function isVisibleInView(entity, viewX, viewY) {
  return !(
    entity.getRight() < viewX || entity.getLeft() > viewX + CANVAS_WIDTH
    || entity.getBottom() < viewY || entity.getTop() > viewY + CANVAS_HEIGHT
  );
}
