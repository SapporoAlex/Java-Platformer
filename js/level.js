import { TILE } from './constants.js';

// ---------------------------------------------------------------------------
// Tile legend for the ASCII maps in levels-data.js.
//
// Terrain (each maps to a tile image 1-10, see README.md):
//   #  ground (1.png)            solid
//   =  sand ground (9.png)       solid
//   :  packed earth/foundation (10.png) solid
//   %  stone block (5.png)       solid
//   -  shrine beam (4.png)       jump-through: land on it from above, jump
//                                up through it from below, Down+Jump drops
//   _  wooden plank (3.png)      jump-through
//   ~  cloud                     jump-through (drawn in code, no tile art)
//   ^  bamboo spikes             hazard: hurts and bounces the player
//
// Things (the cell itself is empty space):
//   P  player start (feet on the bottom of this cell)
//   c  coin                      h  heart (restores health)
//   o  oni (walks, turns at walls and ledges, charges when it sees you)
//   g  ghost (floats, swoops at you)
//   l  haunted lantern (spits fireballs while on screen)
//   E  exit door (bottom of door = bottom of this cell; 2 tiles tall)
//   S  shop door (uses the level's `shops` list, in left-to-right order)
//   B  boss spawn                [  left wall of the boss arena
// ---------------------------------------------------------------------------
export const TERRAIN = {
  '#': { tile: 1, kind: 'solid', style: 'earth' },
  '=': { tile: 9, kind: 'solid', style: 'sand' },
  ':': { tile: 10, kind: 'solid', style: 'earth' },
  '%': { tile: 5, kind: 'solid', style: 'stone' },
  '-': { tile: 4, kind: 'oneway', style: 'beam' },
  _: { tile: 3, kind: 'oneway', style: 'plank' },
  '~': { tile: 0, kind: 'oneway', style: 'cloud' },
  '^': { tile: 0, kind: 'hazard', style: 'spikes' },
};

const ONEWAY_THICKNESS = 40; // only the top sliver of a jump-through tile is drawn
const SPIKE_HEIGHT = 70; // only the bottom part of a spike tile hurts

export class Level {
  constructor(data) {
    this.data = data;
    const rows = data.map.map((r) => r.replace(/\s+$/, ''));
    this.rows = rows.length;
    this.cols = Math.max(...rows.map((r) => r.length));
    this.widthPx = this.cols * TILE;
    this.heightPx = this.rows * TILE;
    this.grid = rows.map((r) => r.padEnd(this.cols, ' ').split(''));
    this.spawns = [];
    this.arenaLeft = null;

    let shopIndex = 0;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const ch = this.grid[row][col];
        if (TERRAIN[ch]) continue;
        if (ch === '[') {
          this.arenaLeft = col * TILE;
        } else if (ch !== ' ' && ch !== '.') {
          const spawn = { type: ch, col, row, x: col * TILE + TILE / 2, feetY: (row + 1) * TILE };
          if (ch === 'S') spawn.shopId = data.shops?.[shopIndex++];
          this.spawns.push(spawn);
        }
        this.grid[row][col] = TERRAIN[ch] ? ch : ' ';
      }
    }
  }

  charAt(col, row) {
    if (row < 0 || row >= this.rows) return ' ';
    if (col < 0 || col >= this.cols) return '%'; // level edges are walls
    return this.grid[row][col];
  }

  terrainAt(col, row) {
    return TERRAIN[this.charAt(col, row)] ?? null;
  }

  isSolid(col, row) {
    return this.terrainAt(col, row)?.kind === 'solid';
  }

  // --- Collision ------------------------------------------------------------
  //
  // Moves `e` by (vx, vy), one axis at a time, against the tile grid. Every
  // tile the moving edge sweeps across is checked, so nothing can tunnel
  // through a tile however fast it's going. Sets e.onGround / e.hitWall /
  // e.hitCeiling. `opts.dropThrough` ignores jump-through tiles this tick.
  moveEntity(e, opts = {}) {
    e.hitWall = 0;
    e.hitCeiling = false;
    const wasOnGround = e.onGround;
    e.onGround = false;

    // Horizontal
    if (e.vx !== 0) {
      const top = Math.floor(e.y / TILE);
      const bottom = Math.floor((e.y + e.h - 0.01) / TILE);
      if (e.vx > 0) {
        const from = Math.floor((e.x + e.w) / TILE);
        const to = Math.floor((e.x + e.w + e.vx - 0.01) / TILE);
        let target = e.x + e.vx;
        for (let col = from; col <= to; col++) {
          if (this.columnBlocked(col, top, bottom)) {
            target = Math.min(target, col * TILE - e.w);
            e.hitWall = 1;
            break;
          }
        }
        e.x = target;
      } else {
        const from = Math.floor((e.x - 0.01) / TILE);
        const to = Math.floor((e.x + e.vx) / TILE);
        let target = e.x + e.vx;
        for (let col = from; col >= to; col--) {
          if (this.columnBlocked(col, top, bottom)) {
            target = Math.max(target, (col + 1) * TILE);
            e.hitWall = -1;
            break;
          }
        }
        e.x = target;
      }
      if (e.hitWall) e.vx = 0;
    }

    // Vertical
    const left = Math.floor(e.x / TILE);
    const right = Math.floor((e.x + e.w - 0.01) / TILE);
    if (e.vy > 0) {
      const prevBottom = e.y + e.h;
      const from = Math.floor(prevBottom / TILE);
      const to = Math.floor((prevBottom + e.vy - 0.01) / TILE);
      let target = e.y + e.vy;
      for (let row = from; row <= to; row++) {
        const rowTop = row * TILE;
        if (this.rowBlocked(row, left, right, prevBottom <= rowTop + 0.01 && !opts.dropThrough)) {
          target = Math.min(target, rowTop - e.h);
          e.onGround = true;
          break;
        }
      }
      e.y = target;
      if (e.onGround) e.vy = 0;
    } else if (e.vy < 0) {
      const from = Math.floor((e.y - 0.01) / TILE);
      const to = Math.floor((e.y + e.vy) / TILE);
      let target = e.y + e.vy;
      for (let row = from; row >= to; row--) {
        if (this.rowBlocked(row, left, right, false)) {
          // Corner correction: clipping a ledge by a few pixels while jumping
          // nudges you around it instead of stopping the jump dead.
          if (opts.cornerCorrect && this.tryCornerNudge(e, row)) break;
          target = Math.max(target, (row + 1) * TILE);
          e.hitCeiling = true;
          break;
        }
      }
      e.y = target;
      if (e.hitCeiling) e.vy = 0;
    } else if (wasOnGround) {
      // Standing still: re-check the floor so walking off a ledge registers.
      e.onGround = this.hasFloor(e, opts.dropThrough);
    }
  }

  columnBlocked(col, rowTop, rowBottom) {
    for (let row = rowTop; row <= rowBottom; row++) {
      if (this.isSolid(col, row)) return true;
    }
    return false;
  }

  rowBlocked(row, colLeft, colRight, allowOneway) {
    for (let col = colLeft; col <= colRight; col++) {
      const t = this.terrainAt(col, row);
      if (!t) continue;
      if (t.kind === 'solid') return true;
      if (t.kind === 'oneway' && allowOneway) return true;
    }
    return false;
  }

  tryCornerNudge(e, row) {
    const maxNudge = 30;
    for (const dir of [-1, 1]) {
      for (let n = 4; n <= maxNudge; n += 4) {
        const left = Math.floor((e.x + dir * n) / TILE);
        const right = Math.floor((e.x + dir * n + e.w - 0.01) / TILE);
        if (!this.rowBlocked(row, left, right, false)
          && !this.columnBlocked(dir < 0 ? left : right, Math.floor(e.y / TILE), Math.floor((e.y + e.h - 0.01) / TILE))) {
          e.x += dir * n;
          return true;
        }
      }
    }
    return false;
  }

  hasFloor(e, dropThrough = false) {
    const row = Math.floor((e.y + e.h + 1) / TILE);
    const onRowTop = Math.abs((e.y + e.h) - row * TILE) < 1;
    if (!onRowTop) return false;
    const left = Math.floor(e.x / TILE);
    const right = Math.floor((e.x + e.w - 0.01) / TILE);
    return this.rowBlocked(row, left, right, !dropThrough);
  }

  // Is there something to stand on `lookahead` px past the entity's leading
  // edge? Walking enemies use this to turn around before a ledge, so they
  // never loiter right at the edge where the player needs to land.
  groundAhead(e, dir, lookahead = 4) {
    const probeX = dir > 0 ? e.x + e.w + lookahead : e.x - lookahead;
    const col = Math.floor(probeX / TILE);
    const row = Math.floor((e.y + e.h + 2) / TILE);
    const t = this.terrainAt(col, row);
    return !!t && t.kind !== 'hazard';
  }

  wallAhead(e, dir) {
    const probeX = dir > 0 ? e.x + e.w + 2 : e.x - 2;
    const col = Math.floor(probeX / TILE);
    return this.columnBlocked(col, Math.floor(e.y / TILE), Math.floor((e.y + e.h - 1) / TILE));
  }

  // True if the entity's box touches the dangerous part of a spike tile.
  touchesHazard(e) {
    const left = Math.floor(e.x / TILE);
    const right = Math.floor((e.x + e.w - 0.01) / TILE);
    const top = Math.floor(e.y / TILE);
    const bottom = Math.floor((e.y + e.h - 0.01) / TILE);
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        if (this.terrainAt(col, row)?.kind !== 'hazard') continue;
        const spikeTop = (row + 1) * TILE - SPIKE_HEIGHT;
        if (e.y + e.h > spikeTop + 10) return true;
      }
    }
    return false;
  }

  // Solid-tile test for projectiles.
  pointSolid(x, y) {
    return this.isSolid(Math.floor(x / TILE), Math.floor(y / TILE));
  }
}

export { ONEWAY_THICKNESS, SPIKE_HEIGHT };
