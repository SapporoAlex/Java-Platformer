import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';

// Flicked-blood spatter, in the manner of the flicked paint hanga printmakers
// used for snowstorms: every hit (taken or dealt) flicks a spray of bright
// red droplets across the screen. They land on a screen-space layer drawn
// over the playfield and stay there - building up and obscuring the view -
// until the stage ends or a life is lost (Game.buildLevel() clears it).

const REDS = ['#e8101c', '#f01822', '#d90a16', '#ff2a2a', '#e3141a'];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export class BloodSpatter {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.ctx = this.canvas.getContext('2d');
    this.pending = []; // droplets still in flight, landing over a few ticks
    this.scale = 1; // droplet size multiplier (3 in New Game+)
    this.dirty = false;
  }

  clear() {
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.pending.length = 0;
    this.dirty = false;
  }

  // `strength` 1 = a sword hit landing on an enemy, ~1.6 = the player hurt.
  // (x, y) is the hit's position on screen; flicks fan out from near it
  // about half the time, otherwise they land anywhere.
  spray(x, y, strength = 1) {
    const throws = 1 + Math.floor(Math.random() * 2) + (strength > 1.3 ? 1 : 0);
    for (let t = 0; t < throws; t++) {
      const near = Math.random() < 0.5;
      const cx = near ? x + rand(-260, 260) : rand(0, CANVAS_WIDTH);
      const cy = near ? y + rand(-200, 200) : rand(0, CANVAS_HEIGHT);
      this.flick(cx, cy, rand(0, Math.PI * 2), Math.round(rand(26, 40) * strength), t * 3);
    }
    // A fine mist of specks over the whole screen - the "blizzard".
    const mist = Math.round(rand(18, 30) * strength);
    for (let i = 0; i < mist; i++) {
      this.pending.push({
        x: rand(0, CANVAS_WIDTH), y: rand(0, CANVAS_HEIGHT), r: rand(1.2, 3.2) * this.scale, angle: 0, stretch: 1,
        color: pick(REDS), delay: Math.floor(rand(0, 12)),
      });
    }
  }

  // One flick of the brush: droplets strung out along `angle`, biggest near
  // the start, thinning to fine specks along the throw.
  flick(cx, cy, angle, count, delay) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const spread = 1 + (this.scale - 1) * 0.35; // bigger drops fly a bit further
    for (let i = 0; i < count; i++) {
      const along = rand(0, 1) ** 1.4 * rand(260, 620) * spread;
      const across = rand(-1, 1) * (40 + along * 0.25);
      const size = Math.random() ** 3; // mostly small, a few big
      const r = (1.5 + size * 16 * (1 - along / (900 * spread))) * this.scale;
      const x = cx + dx * along - dy * across;
      const y = cy + dy * along + dx * across;
      const drop = {
        x, y, r, angle, stretch: r > 7 * this.scale && Math.random() < 0.6 ? rand(1.3, 1.9) : rand(1, 1.12), color: pick(REDS),
        delay: delay + Math.floor(along / 90),
      };
      this.pending.push(drop);
      // Big drops throw a satellite or two further along the flick.
      if (r > 7 * this.scale) {
        const sats = 1 + Math.floor(Math.random() * 2);
        for (let k = 1; k <= sats; k++) {
          const d = r * (2.5 + k * 2.2);
          this.pending.push({
            x: x + dx * d + rand(-4, 4), y: y + dy * d + rand(-4, 4), r: r * rand(0.18, 0.35), angle, stretch: 1.2,
            color: drop.color, delay: drop.delay + 1,
          });
        }
      }
    }
  }

  // Lands every droplet whose delay has run out. Call once per tick.
  update() {
    if (!this.pending.length) return;
    const { ctx } = this;
    const still = [];
    for (const d of this.pending) {
      if (d.delay-- > 0) {
        still.push(d);
        continue;
      }
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle);
      ctx.fillStyle = d.color;
      ctx.globalAlpha = rand(0.88, 1);
      ctx.beginPath();
      if (d.stretch > 1.25) {
        // A teardrop: round head, tapering tail pointing back along the flick.
        const len = d.r * d.stretch * 1.25;
        ctx.arc(0, 0, d.r, -Math.PI / 2, Math.PI / 2);
        ctx.quadraticCurveTo(-len * 0.45, d.r * 0.3, -len, 0);
        ctx.quadraticCurveTo(-len * 0.45, -d.r * 0.3, 0, -d.r);
      } else {
        ctx.ellipse(0, 0, d.r * d.stretch, d.r, 0, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
    this.pending = still;
    this.dirty = true;
  }

  draw(ctx) {
    if (this.dirty) ctx.drawImage(this.canvas, 0, 0);
  }
}
