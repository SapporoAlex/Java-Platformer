import { TILE, CANVAS_WIDTH, CANVAS_HEIGHT, VIEW_SCALE } from './constants.js';
import { TERRAIN, ONEWAY_THICKNESS, SPIKE_HEIGHT } from './level.js';

// Painterly world rendering: sky, parallax layers, background buildings and
// the tile layer. Colors per level come from its `theme` (levels-data.js).

export const THEMES = {
  dawn: {
    skyTop: '#f3d9b1', skyBottom: '#f6efe0', sun: '#d9452b', mist: '#fff7ea', ridge: '#344a3f', ridgeFar: '#7d948a',
    grass: '#6f9a46', earthTint: 'rgba(120,80,40,0.12)', petals: '#f7b7c8',
  },
  day: {
    skyTop: '#9cc7d8', skyBottom: '#eef1e4', sun: null, mist: '#ffffff', ridge: '#2c4a40', ridgeFar: '#78958f',
    grass: '#6b9b3f', earthTint: 'rgba(0,0,0,0)', petals: null,
  },
  dusk: {
    skyTop: '#3d3456', skyBottom: '#e9906a', sun: '#f2c14e', mist: '#f7c8a2', ridge: '#3a2f45', ridgeFar: '#8a6878',
    grass: '#58764a', earthTint: 'rgba(80,30,60,0.18)', petals: '#f4a3b5',
  },
  night: {
    skyTop: '#0f1630', skyBottom: '#3c4b73', sun: '#f5ecc8', mist: '#6d7aa3', ridge: '#141b30', ridgeFar: '#2e3a5e',
    grass: '#3e5e48', earthTint: 'rgba(10,20,60,0.35)', petals: null, stars: true,
  },
  desert: {
    skyTop: '#e7b46a', skyBottom: '#f7e6c4', sun: '#e2572d', mist: '#fff1d6', ridge: '#b07a45', ridgeFar: '#d8ac78',
    grass: '#a3a043', earthTint: 'rgba(160,100,30,0.12)', petals: null,
  },
};

const INK = '#1e1612';
// The camera height of a typical 12-row level - parallax layers are placed
// for this, and drift slightly as the camera moves up or down from it.
const VIEW_BASE_CAM_Y = 12 * TILE - CANVAS_HEIGHT / VIEW_SCALE;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Deterministic pseudo-random per tile, so decorations don't flicker.
function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export class WorldRenderer {
  constructor(art) {
    this.art = art;
    this.ridgeCache = new Map();
    this.starField = Array.from({ length: 90 }, (_, i) => ({
      x: hash(i, 1) * CANVAS_WIDTH, y: hash(i, 2) * CANVAS_HEIGHT * 0.55, r: 1 + hash(i, 3) * 2.5, p: hash(i, 4) * 6,
    }));
  }

  // A row of pine-covered hills, pre-rendered once per color as a repeating strip.
  ridge(color, seed, height) {
    const key = `${color}|${seed}|${height}`;
    if (this.ridgeCache.has(key)) return this.ridgeCache.get(key);
    const w = 2048;
    const c = makeCanvas(w, height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, height);
    const bumps = 5;
    for (let x = 0; x <= w; x += 8) {
      let y = height * 0.55;
      for (let k = 1; k <= bumps; k++) {
        y += Math.sin((x / w) * Math.PI * 2 * k + seed * k) * height * (0.12 / k);
      }
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, height);
    ctx.closePath();
    ctx.fill();
    // Pines along the crest
    for (let i = 0; i < 70; i++) {
      const x = hash(i, seed) * w;
      let y = height * 0.55;
      for (let k = 1; k <= bumps; k++) y += Math.sin((x / w) * Math.PI * 2 * k + seed * k) * height * (0.12 / k);
      const s = 18 + hash(i, seed + 7) * 34;
      ctx.beginPath();
      for (let tier = 0; tier < 3; tier++) {
        const ty = y - s * 0.7 * tier;
        const tw = s * (1 - tier * 0.25);
        ctx.moveTo(x - tw, ty + 6);
        ctx.lineTo(x, ty - s * 0.9);
        ctx.lineTo(x + tw, ty + 6);
      }
      ctx.fill();
      ctx.fillRect(x - 3, y - 4, 6, 14);
    }
    this.ridgeCache.set(key, c);
    return c;
  }

  drawSky(ctx, theme, camX, camY, time) {
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    g.addColorStop(0, theme.skyTop);
    g.addColorStop(0.75, theme.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (theme.stars) {
      for (const s of this.starField) {
        ctx.globalAlpha = 0.5 + Math.sin(time * 0.03 + s.p) * 0.35;
        ctx.fillStyle = '#fffbe6';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (theme.sun) {
      const sx = CANVAS_WIDTH * 0.72 - camX * VIEW_SCALE * 0.03;
      const sy = CANVAS_HEIGHT * 0.24;
      ctx.fillStyle = theme.sun;
      ctx.beginPath();
      ctx.arc(sx, sy, 92, 0, Math.PI * 2);
      ctx.fill();
    }

    // Kasumi: the long horizontal mist bands of ukiyo-e skies.
    ctx.fillStyle = theme.mist;
    const bands = [
      [0.16, 0.05, 0.55], [0.33, 0.06, 0.4], [0.5, 0.05, 0.35],
    ];
    bands.forEach(([y, h, alpha], i) => {
      const drift = (time * (0.15 + i * 0.08) + camX * VIEW_SCALE * (0.05 + i * 0.03)) % (CANVAS_WIDTH * 1.6);
      ctx.globalAlpha = alpha;
      for (let k = -1; k <= 1; k++) {
        const x = k * CANVAS_WIDTH * 1.6 - drift + i * 300;
        roundedBand(ctx, x, CANVAS_HEIGHT * y, CANVAS_WIDTH * 0.9, CANVAS_HEIGHT * h);
        roundedBand(ctx, x + CANVAS_WIDTH * 0.75, CANVAS_HEIGHT * (y + 0.035), CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * h * 0.7);
      }
    });
    ctx.globalAlpha = 1;
  }

  drawParallax(ctx, theme, camX, camY) {
    const backdrop = this.art.backdrop;
    if (backdrop) {
      const h = CANVAS_HEIGHT * 0.62;
      const w = backdrop.width * (h / backdrop.height);
      const y = CANVAS_HEIGHT - h - 120 + (VIEW_BASE_CAM_Y - camY) * VIEW_SCALE * 0.1;
      const off = -((camX * VIEW_SCALE * 0.18) % w);
      ctx.save();
      if (theme.stars) ctx.filter = 'brightness(0.45) saturate(0.7) hue-rotate(200deg)';
      else if (theme === THEMES.dusk) ctx.filter = 'sepia(0.35) saturate(1.2) brightness(0.85)';
      else if (theme === THEMES.desert) ctx.filter = 'sepia(0.55) saturate(1.1)';
      for (let x = off; x < CANVAS_WIDTH; x += w - 1) ctx.drawImage(backdrop, x, y, w, h);
      ctx.restore();
    }
    const layers = [
      { color: theme.ridgeFar, seed: 3, h: 300, factor: 0.32, y: 0.33, mist: 0.45 },
      { color: theme.ridge, seed: 11, h: 340, factor: 0.5, y: 0.41, mist: 0.2 },
    ];
    for (const L of layers) {
      const strip = this.ridge(L.color, L.seed, L.h);
      const y = CANVAS_HEIGHT * L.y + (VIEW_BASE_CAM_Y - camY) * VIEW_SCALE * L.factor * 0.25;
      const off = -((camX * VIEW_SCALE * L.factor) % strip.width);
      for (let x = off; x < CANVAS_WIDTH; x += strip.width) ctx.drawImage(strip, x, y);
      ctx.fillStyle = L.color;
      ctx.fillRect(0, y + L.h - 1, CANVAS_WIDTH, CANVAS_HEIGHT);
      // Mist settling at the base of each ridge
      const mg = ctx.createLinearGradient(0, y + L.h * 0.45, 0, y + L.h + 80);
      mg.addColorStop(0, 'rgba(255,255,255,0)');
      mg.addColorStop(1, hexAlpha(theme.mist, L.mist));
      ctx.fillStyle = mg;
      ctx.fillRect(0, y + L.h * 0.45, CANVAS_WIDTH, L.h * 0.55 + 80);
    }
  }

  // Background buildings: walls and roofs from tile art, dimmed so the
  // playfield in front reads clearly. Walk-through.
  drawBuildings(ctx, level, view) {
    const { tiles } = this.art;
    for (const b of level.data.buildings ?? []) {
      const x0 = b.col * TILE;
      const x1 = (b.col + b.width) * TILE;
      if (x1 < view.left - TILE || x0 > view.right + TILE) continue;
      const roofY = b.top * TILE;
      const baseY = (b.bottom + 1) * TILE;
      for (let row = b.top + 1; row <= b.bottom; row++) {
        for (let col = b.col; col < b.col + b.width; col++) {
          const img = tiles[(col - b.col) % 3 === 1 ? (b.wall ?? 2) : (b.wall2 ?? b.wall ?? 2)];
          if (img) ctx.drawImage(img, col * TILE, row * TILE, TILE + 1, TILE + 1);
        }
      }
      // Shade toward the bottom - grounds the building.
      const sg = ctx.createLinearGradient(0, roofY, 0, baseY);
      sg.addColorStop(0, 'rgba(20,12,10,0.12)');
      sg.addColorStop(1, 'rgba(20,12,10,0.38)');
      ctx.fillStyle = sg;
      ctx.fillRect(x0, roofY + TILE, x1 - x0, baseY - roofY - TILE);
      // Roof: a band of roof tiles under a sweeping dark eave.
      const roof = tiles[b.roof ?? 6];
      for (let col = b.col; col < b.col + b.width; col++) {
        if (roof) ctx.drawImage(roof, col * TILE, roofY + TILE * 0.35, TILE + 1, TILE * 0.65);
      }
      const over = 50;
      ctx.fillStyle = b.eave ?? '#2f3b3a';
      ctx.beginPath();
      ctx.moveTo(x0 - over, roofY + TILE * 0.42);
      ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.15, roofY + TILE * 0.2, x0 + (x1 - x0) * 0.25, roofY + TILE * 0.05);
      ctx.lineTo(x1 - (x1 - x0) * 0.25, roofY + TILE * 0.05);
      ctx.quadraticCurveTo(x1 - (x1 - x0) * 0.15, roofY + TILE * 0.2, x1 + over, roofY + TILE * 0.42);
      ctx.lineTo(x1 + over - 14, roofY + TILE * 0.5);
      ctx.lineTo(x0 - over + 14, roofY + TILE * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeRect(x0, roofY + TILE * 0.5, x1 - x0, baseY - roofY - TILE * 0.5);
    }
  }

  drawTiles(ctx, level, view, theme) {
    const { tiles } = this.art;
    const c0 = Math.max(0, Math.floor(view.left / TILE));
    const c1 = Math.min(level.cols - 1, Math.floor(view.right / TILE));
    const r0 = Math.max(0, Math.floor(view.top / TILE));
    const r1 = Math.min(level.rows - 1, Math.floor(view.bottom / TILE));
    const solidLike = (col, row) => {
      if (col < 0 || col >= level.cols) return true;
      const t = level.terrainAt(col, row);
      return !!t && t.kind === 'solid';
    };

    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const ch = level.grid[row][col];
        const t = TERRAIN[ch];
        if (!t) continue;
        const x = col * TILE;
        const y = row * TILE;

        if (t.kind === 'solid') {
          const img = tiles[t.tile];
          if (img) ctx.drawImage(img, x, y, TILE + 1, TILE + 1);
          const exposedTop = !solidLike(col, row - 1) && row > 0;
          // Deeper ground gets darker, like a cut-away hillside.
          let depth = 0;
          while (depth < 3 && solidLike(col, row - depth - 1) && row - depth - 1 >= 0) depth++;
          if (depth > 0) {
            ctx.fillStyle = `rgba(25,15,10,${0.12 + depth * 0.1})`;
            ctx.fillRect(x, y, TILE + 1, TILE + 1);
          }
          if (t.style === 'sand') {
            ctx.fillStyle = 'rgba(214,170,98,0.45)';
            ctx.fillRect(x, y, TILE + 1, TILE + 1);
          }
          if (theme.earthTint) {
            ctx.fillStyle = theme.earthTint;
            ctx.fillRect(x, y, TILE + 1, TILE + 1);
          }
          if (!solidLike(col - 1, row)) edgeShade(ctx, x, y, 'left');
          if (!solidLike(col + 1, row)) edgeShade(ctx, x, y, 'right');
          if (row + 1 < level.rows && !solidLike(col, row + 1)) edgeShade(ctx, x, y, 'bottom');
          if (exposedTop) this.drawLip(ctx, t.style, x, y, col, row, theme, !solidLike(col - 1, row - 0), !solidLike(col + 1, row));
        } else if (t.kind === 'oneway') {
          const img = tiles[t.tile];
          // Little brackets under the board read as "you can pass under this".
          ctx.fillStyle = '#3b2416';
          ctx.fillRect(x + 22, y + ONEWAY_THICKNESS - 4, 14, 30);
          ctx.fillRect(x + TILE - 36, y + ONEWAY_THICKNESS - 4, 14, 30);
          if (img) ctx.drawImage(img, 0, 0, img.width, img.height * 0.32, x, y, TILE + 1, ONEWAY_THICKNESS);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(x, y + 1);
          ctx.lineTo(x + TILE, y + 1);
          ctx.moveTo(x, y + ONEWAY_THICKNESS);
          ctx.lineTo(x + TILE, y + ONEWAY_THICKNESS);
          ctx.stroke();
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(x, y + ONEWAY_THICKNESS, TILE, 10);
        } else if (t.kind === 'hazard') {
          drawSpikes(ctx, x, y);
        }
      }
    }
  }

  drawLip(ctx, style, x, y, col, row, theme, openLeft, openRight) {
    if (style === 'stone' || style === 'beam') {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x, y, TILE + 1, 8);
      ctx.fillStyle = INK;
      ctx.fillRect(x, y, TILE + 1, 4);
      return;
    }
    const color = style === 'sand' ? '#e6cf96' : theme.grass;
    const h = style === 'sand' ? 18 : 24;
    ctx.fillStyle = color;
    ctx.fillRect(x - (openLeft ? 6 : 0), y, TILE + 1 + (openLeft ? 6 : 0) + (openRight ? 6 : 0), h);
    // Tufts / ripples hanging over the edge
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const tx = x + (i + 0.5) * (TILE / 6) + (hash(col, row * 7 + i) - 0.5) * 12;
      const th = 8 + hash(col * 3 + i, row) * 16;
      ctx.moveTo(tx - 10, y + h - 1);
      ctx.quadraticCurveTo(tx, y + h + th, tx + 10, y + h - 1);
    }
    ctx.fill();
    // Blades of grass sticking up
    if (style !== 'sand') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        if (hash(col + i * 13, row) < 0.45) continue;
        const bx = x + hash(col, row + i * 5) * TILE;
        ctx.beginPath();
        ctx.moveTo(bx, y + 4);
        ctx.lineTo(bx - 6 + hash(i, col) * 12, y - 10 - hash(col, i) * 14);
        ctx.stroke();
      }
    }
    ctx.fillStyle = INK;
    ctx.fillRect(x, y - 2, TILE + 1, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x, y + h, TILE + 1, 6);
  }
}

function edgeShade(ctx, x, y, side) {
  ctx.fillStyle = INK;
  if (side === 'left') ctx.fillRect(x, y, 5, TILE + 1);
  else if (side === 'right') ctx.fillRect(x + TILE - 5, y, 5, TILE + 1);
  else ctx.fillRect(x, y + TILE - 5, TILE + 1, 5);
  const g = side === 'bottom'
    ? ctx.createLinearGradient(0, y + TILE, 0, y + TILE - 30)
    : ctx.createLinearGradient(side === 'left' ? x : x + TILE, 0, side === 'left' ? x + 30 : x + TILE - 30, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  if (side === 'bottom') ctx.fillRect(x, y + TILE - 30, TILE + 1, 30);
  else ctx.fillRect(side === 'left' ? x : x + TILE - 30, y, 30, TILE + 1);
}

// Sharpened bamboo stakes.
function drawSpikes(ctx, x, y) {
  const base = y + TILE;
  const top = base - SPIKE_HEIGHT;
  for (let i = 0; i < 5; i++) {
    const sx = x + 10 + i * 28;
    const h = SPIKE_HEIGHT - (i % 2) * 14;
    ctx.fillStyle = i % 2 ? '#7a9a3a' : '#93b347';
    ctx.beginPath();
    ctx.moveTo(sx, base);
    ctx.lineTo(sx, base - h + 22);
    ctx.lineTo(sx + 24, base - h);
    ctx.lineTo(sx + 24, base);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx, base - h * 0.45);
    ctx.lineTo(sx + 24, base - h * 0.45);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x, top + SPIKE_HEIGHT - 8, TILE, 8);
}

function roundedBand(ctx, x, y, w, h) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
  ctx.fill();
}

function hexAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
