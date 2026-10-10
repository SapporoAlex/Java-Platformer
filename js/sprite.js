import { opaqueBounds, silhouette, outlined } from './art.js';
import { RIGHT_FACING } from './constants.js';

// Base for everything that moves and collides. (x, y) is the TOP-LEFT of the
// collision box; art is drawn separately (drawFigure) so a sprite's painted
// size never affects how it collides.
export class Entity {
  constructor(x = 0, y = 0, w = 100, h = 100) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
    this.facing = RIGHT_FACING;
    this.onGround = false;
    this.alive = true;
  }

  get left() { return this.x; }
  get right() { return this.x + this.w; }
  get top() { return this.y; }
  get bottom() { return this.y + this.h; }
  get centerX() { return this.x + this.w / 2; }
  get centerY() { return this.y + this.h / 2; }
  set centerX(v) { this.x = v - this.w / 2; }
  set bottom(v) { this.y = v - this.h; }

  overlaps(o) {
    return this.x < o.right && this.right > o.left && this.y < o.bottom && this.bottom > o.top;
  }
}

export function boxesOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

const flashCache = new WeakMap();
function flashOf(img) {
  let s = flashCache.get(img);
  if (!s) {
    s = silhouette(img);
    flashCache.set(img, s);
  }
  return s;
}

const outlineCache = new WeakMap();
export function outlineOf(img) {
  let o = outlineCache.get(img);
  if (!o) {
    o = outlined(img, Math.max(3, img.height * 0.014));
    outlineCache.set(img, o);
  }
  return o;
}

// Draws `img` so its painted feet stand on the entity's bottom edge, centered
// on the entity horizontally.
//
// `ref` is the character's reference frame (normally its first idle frame):
// its visible height sets the scale, so the standing figure is
// `figureHeight` world units tall and every other pose keeps the same
// proportions. Each frame's own lowest visible pixel is what touches the
// ground. Options add procedural motion on top of static art:
//   sx/sy   squash & stretch around the feet
//   rot     rotation (radians) around the feet
//   ox/oy   offset in world units
//   alpha   opacity
//   flash   0..1 white overlay (hit flash)
//   outline draw an ink outline around the figure (default true)
export function drawFigure(ctx, img, ref, x, feetY, figureHeight, opts = {}) {
  if (!img) return;
  const meta = opaqueBounds(img);
  const s = figureHeight / opaqueBounds(ref ?? img).height;
  const w = img.width * s;
  const h = img.height * s;
  const {
    sx = 1, sy = 1, rot = 0, ox = 0, oy = 0, alpha = 1, flash = 0, outline = true,
  } = opts;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x + ox, feetY + oy);
  if (rot) ctx.rotate(rot);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  const dx = -w / 2;
  const dy = -meta.bottom * s;
  if (outline) {
    const o = outlineOf(img);
    ctx.drawImage(o, dx - o.pad * s, dy - o.pad * s, (o.width / o.k) * s, (o.height / o.k) * s);
  } else {
    ctx.drawImage(img, dx, dy, w, h);
  }
  if (flash > 0) {
    ctx.globalAlpha *= Math.min(1, flash);
    ctx.drawImage(flashOf(img), dx, dy, w, h);
  }
  ctx.restore();
}
