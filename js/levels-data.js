// All levels are 12 tile rows tall (12 * SPRITE_SIZE = canvas height), with
// rows 10-11 always the solid walkway + foundation (matching the original
// assets/map.csv). A building's door always sits at row 9 - one tile above
// the walkway, two tiles tall - because Door draws a SPRITE_SIZE x
// SPRITE_SIZE*2 overlay spanning rows 9-10, matching wherever the original
// level's exit building placed it. (All of this is in tile/row/col units, so
// none of it needed to change when SPRITE_SIZE itself was scaled up.)
//
// Tile codes match the original createPlatforms(): 1/4/5/9/10 solid,
// 2/3/6/7/8 decorative (walk-through) background - buildings are backdrops
// with brick platforms floating inside them, exactly like Level 1.
//
// To add a level later: push another entry to LEVELS with its own tiles/
// coins/enemies/doors/playerStart (a door needs kind:'exit' or
// kind:'shop'+shopId, see shops-data.js). The game already picks up
// LEVELS.length to decide whether "Next Level" or "More levels coming soon"
// is shown.

const ROWS = 12;
const GROUND_ROW = 10;
const FOUNDATION_ROW = 11;
const DOOR_ROW = 9;

function emptyGrid(cols) {
  return Array.from({ length: ROWS }, () => Array(cols).fill(0));
}

function fillRect(grid, colStart, colEnd, rowStart, rowEnd, code) {
  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = colStart; c <= colEnd; c++) grid[r][c] = code;
  }
}

// Roof row + wall/door row above the walkway, ground continuing beneath -
// the same three-row shape Level 1 uses for its exit building.
function buildBuilding(grid, colStart, colEnd, { roofTile, wallTile, groundTile }) {
  fillRect(grid, colStart, colEnd, DOOR_ROW - 1, DOOR_ROW - 1, roofTile);
  fillRect(grid, colStart, colEnd, DOOR_ROW, DOOR_ROW, wallTile);
  fillRect(grid, colStart, colEnd, GROUND_ROW, FOUNDATION_ROW, groundTile);
}

// A flat sand plateau whose surface sits at `topRow` instead of the usual
// GROUND_ROW - used to build rolling dune terrain (Level 8) out of nothing
// but sand tiles: no walls/roofs, just the ground itself rising and falling.
// Consecutive plateaus differ by at most 2 rows so every step up is a single
// easy hop (max jump height is about 4 tiles - see JUMP_SPEED in constants.js).
function buildDune(grid, colStart, colEnd, topRow) {
  fillRect(grid, colStart, colEnd, topRow, topRow, 9);
  fillRect(grid, colStart, colEnd, topRow + 1, FOUNDATION_ROW, 10);
}

// A short floating platform with nothing but open sky on every side - used
// for the Level 10 "sky bridges" gauntlet. Solid all three rows so it reads
// as a chunk of floating ground rather than a paper-thin ledge.
function buildFloatingBridge(grid, colStart, colEnd, tile) {
  fillRect(grid, colStart, colEnd, DOOR_ROW, FOUNDATION_ROW, tile);
}

// ---------------------------------------------------------------------------
// Level 1 - the original assets/map.csv layout, extended four columns to the
// right with a small building whose door is the level exit.
// ---------------------------------------------------------------------------
const LEVEL_1_TILES = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0],
  [6,6,6,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0],
  [6,6,6,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0],
  [2,2,2,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0],
  [2,2,4,0,0,0,0,0,0,0,0,0,0,4,4,4,2,2,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0],
  [2,2,2,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0],
  [2,2,2,0,0,0,0,0,0,0,0,0,0,2,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0],
  [4,4,2,0,0,0,8,8,5,8,0,0,0,2,2,4,4,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 0,0,0,0],
  [2,2,2,0,0,0,3,3,5,3,0,0,0,2,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 6,6,6,0],
  [2,2,2,0,0,0,3,3,5,3,0,0,0,2,2,2,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,9,9,9, 2,2,2,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,9,9,9,0,0,0,9,9,9,9,10,10,10, 9,9,9,9],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,10,10,10,9,9,9,10,10,10,10,10,10,10, 10,10,10,10],
];

// ---------------------------------------------------------------------------
// Level 2 - a new layout in the same style: two decorative buildings with
// embedded brick jump-platforms, a general store partway through, and the
// exit building at the far right.
// ---------------------------------------------------------------------------
const LEVEL_2_COLS = 46;
const level2 = emptyGrid(LEVEL_2_COLS);
fillRect(level2, 0, LEVEL_2_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 1); // grass walkway/foundation
fillRect(level2, 39, LEVEL_2_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 9); // sand under the exit building
fillRect(level2, 39, LEVEL_2_COLS - 1, FOUNDATION_ROW, FOUNDATION_ROW, 10);

// Building A: decorative facade with two embedded brick platforms to jump to.
fillRect(level2, 2, 8, 1, 1, 6);
fillRect(level2, 2, 8, 2, 9, 2);
fillRect(level2, 3, 5, 5, 5, 4);
fillRect(level2, 5, 7, 7, 7, 5);

// Shop building (General Store) - door overlaid at col 16, row 9.
buildBuilding(level2, 14, 17, { roofTile: 7, wallTile: 3, groundTile: 1 });

// Building B: taller decorative facade, two more brick platforms.
fillRect(level2, 21, 28, 1, 1, 8);
fillRect(level2, 21, 28, 2, 9, 3);
fillRect(level2, 22, 24, 5, 5, 4);
fillRect(level2, 25, 27, 7, 7, 5);

// Exit building - door overlaid at col 42, row 9.
buildBuilding(level2, 40, 44, { roofTile: 6, wallTile: 2, groundTile: 9 });

// ---------------------------------------------------------------------------
// Level 3 - longer and busier: three enemy patrols and a chain of brick
// platforms, ending at the exit building.
// ---------------------------------------------------------------------------
const LEVEL_3_COLS = 50;
const level3 = emptyGrid(LEVEL_3_COLS);
fillRect(level3, 0, LEVEL_3_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 1);
fillRect(level3, 43, LEVEL_3_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 9);
fillRect(level3, 43, LEVEL_3_COLS - 1, FOUNDATION_ROW, FOUNDATION_ROW, 10);

fillRect(level3, 2, 7, 1, 1, 7);
fillRect(level3, 2, 7, 2, 9, 2);
fillRect(level3, 3, 5, 7, 7, 4);

fillRect(level3, 14, 20, 1, 1, 6);
fillRect(level3, 14, 20, 2, 9, 3);
fillRect(level3, 15, 17, 5, 5, 5);
fillRect(level3, 17, 19, 7, 7, 4);

fillRect(level3, 27, 33, 1, 1, 8);
fillRect(level3, 27, 33, 2, 9, 2);
fillRect(level3, 28, 30, 3, 3, 4);
fillRect(level3, 30, 32, 5, 5, 5);
fillRect(level3, 28, 30, 7, 7, 4);

buildBuilding(level3, 46, 49, { roofTile: 6, wallTile: 2, groundTile: 9 });

// ---------------------------------------------------------------------------
// Level 4 - the first boss: a big Gate Warden patrols the ground right in
// front of the exit building, so reaching the door means getting past it.
// (This used to be laid out as "Level 5" - moved to slot 4 so the three boss
// fights land on 4/7/11 as requested.)
// ---------------------------------------------------------------------------
const LEVEL_4_COLS = 46;
const level4 = emptyGrid(LEVEL_4_COLS);
fillRect(level4, 0, LEVEL_4_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 1);
fillRect(level4, 40, LEVEL_4_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 9);
fillRect(level4, 40, LEVEL_4_COLS - 1, FOUNDATION_ROW, FOUNDATION_ROW, 10);

fillRect(level4, 2, 8, 1, 1, 6);
fillRect(level4, 2, 8, 2, 9, 2);
fillRect(level4, 3, 5, 7, 7, 4);

fillRect(level4, 16, 23, 1, 1, 7);
fillRect(level4, 16, 23, 2, 9, 2);
fillRect(level4, 17, 19, 7, 7, 5);

// Open runway leading up to the boss's territory, then the exit building -
// door overlaid at col 44, row 9. The boss's patrol range (below) spans
// cols 34-44, covering the ground right in front of that door.
buildBuilding(level4, 42, 45, { roofTile: 6, wallTile: 2, groundTile: 9 });

// ---------------------------------------------------------------------------
// Level 5 - three enemy patrols, a Temple of Vigor shop, then the exit.
// ---------------------------------------------------------------------------
const LEVEL_5_COLS = 48;
const level5 = emptyGrid(LEVEL_5_COLS);
fillRect(level5, 0, LEVEL_5_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 1);
fillRect(level5, 41, LEVEL_5_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 9);
fillRect(level5, 41, LEVEL_5_COLS - 1, FOUNDATION_ROW, FOUNDATION_ROW, 10);

fillRect(level5, 2, 8, 1, 1, 6);
fillRect(level5, 2, 8, 2, 9, 2);
fillRect(level5, 3, 5, 5, 5, 4);
fillRect(level5, 5, 7, 7, 7, 5);

// Temple of Vigor shop building - door overlaid at col 17, row 9.
buildBuilding(level5, 15, 18, { roofTile: 8, wallTile: 3, groundTile: 1 });

fillRect(level5, 23, 30, 1, 1, 7);
fillRect(level5, 23, 30, 2, 9, 2);
fillRect(level5, 24, 26, 5, 5, 4);
fillRect(level5, 27, 29, 7, 7, 5);

// Exit building - door overlaid at col 45, row 9.
buildBuilding(level5, 43, 47, { roofTile: 6, wallTile: 2, groundTile: 9 });

// ---------------------------------------------------------------------------
// Level 6 - "Market Row": a dense little town, five buildings back to back
// plus the Blacksmith, with barely a gap between them.
// ---------------------------------------------------------------------------
const LEVEL_6_COLS = 48;
const level6 = emptyGrid(LEVEL_6_COLS);
fillRect(level6, 0, LEVEL_6_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 1);
fillRect(level6, 42, LEVEL_6_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 9);
fillRect(level6, 42, LEVEL_6_COLS - 1, FOUNDATION_ROW, FOUNDATION_ROW, 10);

fillRect(level6, 2, 8, 1, 1, 6);
fillRect(level6, 2, 8, 2, 9, 2);
fillRect(level6, 3, 5, 7, 7, 4);

fillRect(level6, 10, 15, 1, 1, 7);
fillRect(level6, 10, 15, 2, 9, 3);
fillRect(level6, 11, 13, 7, 7, 5);

// Blacksmith shop - door overlaid at col 19, row 9.
buildBuilding(level6, 17, 20, { roofTile: 8, wallTile: 2, groundTile: 1 });

fillRect(level6, 22, 27, 1, 1, 6);
fillRect(level6, 22, 27, 2, 9, 3);
fillRect(level6, 23, 25, 7, 7, 4);

fillRect(level6, 29, 34, 1, 1, 7);
fillRect(level6, 29, 34, 2, 9, 2);
fillRect(level6, 30, 32, 7, 7, 5);

fillRect(level6, 36, 41, 1, 1, 8);
fillRect(level6, 36, 41, 2, 9, 3);
fillRect(level6, 37, 39, 7, 7, 4);

// Exit building - door overlaid at col 45, row 9.
buildBuilding(level6, 43, 47, { roofTile: 6, wallTile: 2, groundTile: 9 });

// ---------------------------------------------------------------------------
// Level 7 - "Fortress Approach": the second boss (violet) guards the exit
// after a bigger, tougher building.
// ---------------------------------------------------------------------------
const LEVEL_7_COLS = 48;
const level7 = emptyGrid(LEVEL_7_COLS);
fillRect(level7, 0, LEVEL_7_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 1);
fillRect(level7, 41, LEVEL_7_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 9);
fillRect(level7, 41, LEVEL_7_COLS - 1, FOUNDATION_ROW, FOUNDATION_ROW, 10);

fillRect(level7, 2, 8, 1, 1, 7);
fillRect(level7, 2, 8, 2, 9, 2);
fillRect(level7, 3, 5, 7, 7, 4);

fillRect(level7, 14, 21, 1, 1, 8);
fillRect(level7, 14, 21, 2, 9, 3);
fillRect(level7, 15, 17, 4, 4, 5);
fillRect(level7, 18, 20, 7, 7, 4);

// Open runway leading to the boss's territory, then the exit building - door
// overlaid at col 44, row 9. The boss's patrol range (below) spans cols
// 34-45, covering the ground right in front of that door.
buildBuilding(level7, 42, 46, { roofTile: 6, wallTile: 2, groundTile: 9 });

// ---------------------------------------------------------------------------
// Level 8 - "Dune Sea": nothing but rolling sand dunes, no buildings at all
// except the exit hut. Every step up is at most 2 rows (a single easy hop).
// ---------------------------------------------------------------------------
const LEVEL_8_COLS = 44;
const level8 = emptyGrid(LEVEL_8_COLS);
buildDune(level8, 0, 9, 10);
buildDune(level8, 10, 15, 9);
buildDune(level8, 16, 19, 8);
buildDune(level8, 20, 25, 10);
buildDune(level8, 26, 31, 9);
buildDune(level8, 32, 37, 7);
buildDune(level8, 38, LEVEL_8_COLS - 1, 10);

// Sand-hut exit building (even the exit blends into the dunes) - door
// overlaid at col 41, row 9.
buildBuilding(level8, 40, 43, { roofTile: 9, wallTile: 9, groundTile: 9 });

// ---------------------------------------------------------------------------
// Level 9 - "Oasis Sanctuary": sand ground throughout, but with real
// buildings again (an oasis town) and the Mystic's Hut.
// ---------------------------------------------------------------------------
const LEVEL_9_COLS = 44;
const level9 = emptyGrid(LEVEL_9_COLS);
fillRect(level9, 0, LEVEL_9_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 9);
fillRect(level9, 0, LEVEL_9_COLS - 1, FOUNDATION_ROW, FOUNDATION_ROW, 10);

fillRect(level9, 3, 9, 1, 1, 6);
fillRect(level9, 3, 9, 2, 9, 2);
fillRect(level9, 4, 6, 7, 7, 4);

// Mystic's Hut - door overlaid at col 16, row 9.
buildBuilding(level9, 14, 17, { roofTile: 8, wallTile: 3, groundTile: 9 });

fillRect(level9, 22, 28, 1, 1, 7);
fillRect(level9, 22, 28, 2, 9, 2);
fillRect(level9, 23, 25, 7, 7, 5);

// Exit building - door overlaid at col 41, row 9.
buildBuilding(level9, 39, LEVEL_9_COLS - 1, { roofTile: 6, wallTile: 2, groundTile: 9 });

// ---------------------------------------------------------------------------
// Level 10 - "Sky Bridges": disconnected floating platforms over open sky.
// Every gap is exactly 2 tiles wide - comfortably inside a running jump's
// range (both scale together with SPRITE_SIZE, see constants.js) - but
// falling anywhere else means falling to the death-plane, so this is the one
// level where that matters.
// ---------------------------------------------------------------------------
const LEVEL_10_COLS = 50;
const level10 = emptyGrid(LEVEL_10_COLS);
fillRect(level10, 0, 6, GROUND_ROW, FOUNDATION_ROW, 1); // safe starting ground
buildFloatingBridge(level10, 9, 13, 4);
buildFloatingBridge(level10, 16, 19, 5);
buildFloatingBridge(level10, 22, 26, 9);
buildFloatingBridge(level10, 29, 33, 10);
buildFloatingBridge(level10, 36, 40, 4);
fillRect(level10, 43, LEVEL_10_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 1); // final landing
fillRect(level10, 46, LEVEL_10_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 9);
fillRect(level10, 46, LEVEL_10_COLS - 1, FOUNDATION_ROW, FOUNDATION_ROW, 10);
// Exit building - door overlaid at col 48, row 9.
buildBuilding(level10, 46, LEVEL_10_COLS - 1, { roofTile: 6, wallTile: 2, groundTile: 9 });

// ---------------------------------------------------------------------------
// Level 11 - "Monster Keep": the finale. Four buildings, four enemy patrols,
// and the final (biggest, strongest) boss guarding the last exit.
// ---------------------------------------------------------------------------
const LEVEL_11_COLS = 52;
const level11 = emptyGrid(LEVEL_11_COLS);
fillRect(level11, 0, LEVEL_11_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 1);
fillRect(level11, 46, LEVEL_11_COLS - 1, GROUND_ROW, FOUNDATION_ROW, 9);
fillRect(level11, 46, LEVEL_11_COLS - 1, FOUNDATION_ROW, FOUNDATION_ROW, 10);

fillRect(level11, 2, 8, 1, 1, 6);
fillRect(level11, 2, 8, 2, 9, 2);
fillRect(level11, 3, 5, 7, 7, 4);

fillRect(level11, 11, 17, 1, 1, 7);
fillRect(level11, 11, 17, 2, 9, 3);
fillRect(level11, 12, 14, 4, 4, 5);
fillRect(level11, 15, 17, 7, 7, 4);

fillRect(level11, 20, 26, 1, 1, 8);
fillRect(level11, 20, 26, 2, 9, 2);
fillRect(level11, 21, 23, 7, 7, 5);

fillRect(level11, 29, 35, 1, 1, 6);
fillRect(level11, 29, 35, 2, 9, 3);
fillRect(level11, 30, 32, 4, 4, 4);
fillRect(level11, 33, 35, 7, 7, 5);

// Grand exit building - door overlaid at col 49, row 9. The final boss's
// patrol range (below) spans cols 40-52, covering the whole approach.
buildBuilding(level11, 47, LEVEL_11_COLS - 1, { roofTile: 7, wallTile: 2, groundTile: 9 });

export const LEVELS = [
  {
    id: 1,
    name: 'Greenfield Outpost',
    tiles: LEVEL_1_TILES,
    coins: [
      { col: 2, row: 0 },
      { col: 8, row: 4 },
      { col: 8, row: 5 },
      { col: 21, row: 2 },
      { col: 22, row: 7 },
      { col: 8, row: 6 },
      { col: 8, row: 7 },
      { col: 25, row: 7 },
      { col: 27, row: 5 },
      { col: 10, row: 9 },
    ],
    enemies: [
      { col: 5, row: 9, rangeTiles: 4 },
      { col: 11, row: 9, rangeTiles: 4 },
      { col: 24, row: 9, rangeTiles: 4 },
    ],
    doors: [
      { col: 35, row: DOOR_ROW, kind: 'exit' },
    ],
    playerStart: { x: 100 },
  },
  {
    id: 2,
    name: "Trader's Crossing",
    tiles: level2,
    coins: [
      { col: 4, row: 0 },
      { col: 6, row: 3 },
      { col: 12, row: 9 },
      { col: 16, row: 6 },
      { col: 23, row: 2 },
      { col: 26, row: 5 },
      { col: 33, row: 7 },
      { col: 38, row: 7 },
      { col: 42, row: 7 },
    ],
    enemies: [
      { col: 10, row: 9, rangeTiles: 4 },
      { col: 31, row: 9, rangeTiles: 4 },
      { col: 35, row: 9, rangeTiles: 4 },
    ],
    swoopEnemies: [
      { col: 30, row: 6, rangeTiles: 6 },
    ],
    doors: [
      { col: 16, row: DOOR_ROW, kind: 'shop', shopId: 'general_store' },
      { col: 42, row: DOOR_ROW, kind: 'exit' },
    ],
    playerStart: { x: 100 },
  },
  {
    id: 3,
    name: 'Brickstone Hollow',
    tiles: level3,
    coins: [
      { col: 4, row: 3 },
      { col: 9, row: 9 },
      { col: 16, row: 2 },
      { col: 18, row: 5 },
      { col: 24, row: 9 },
      { col: 29, row: 1 },
      { col: 31, row: 5 },
      { col: 37, row: 9 },
      { col: 41, row: 7 },
      { col: 47, row: 7 },
    ],
    enemies: [
      { col: 9, row: 9, rangeTiles: 4 },
      { col: 23, row: 9, rangeTiles: 4 },
      { col: 37, row: 9, rangeTiles: 4 },
      { col: 41, row: 9, rangeTiles: 4 },
    ],
    fireEnemies: [
      { col: 16, row: 4 },
    ],
    doors: [
      { col: 48, row: DOOR_ROW, kind: 'exit' },
    ],
    playerStart: { x: 100 },
  },
  {
    id: 4,
    name: "Gatewarden's Hollow",
    tiles: level4,
    coins: [
      { col: 4, row: 2 },
      { col: 10, row: 9 },
      { col: 18, row: 4 },
      { col: 21, row: 7 },
      { col: 28, row: 9 },
      { col: 37, row: 7 },
      { col: 44, row: 7 },
    ],
    enemies: [
      { col: 10, row: 9, rangeTiles: 4 },
      { col: 26, row: 9, rangeTiles: 4 },
      { col: 31, row: 9, rangeTiles: 4 },
    ],
    doors: [
      { col: 44, row: DOOR_ROW, kind: 'exit' },
    ],
    // Fires a fireball from center-height every 10s (600 ticks at 60fps).
    boss: {
      col: 34, rangeTiles: 11, health: 200, attackStrength: 15, assetPrefix: 'boss',
      fireballIntervalTicks: 600,
    },
    playerStart: { x: 100 },
  },
  {
    id: 5,
    name: 'Vigor Sanctum',
    tiles: level5,
    coins: [
      { col: 4, row: 0 },
      { col: 10, row: 9 },
      { col: 12, row: 7 },
      { col: 17, row: 7 },
      { col: 25, row: 2 },
      { col: 28, row: 6 },
      { col: 34, row: 9 },
      { col: 39, row: 7 },
      { col: 45, row: 7 },
    ],
    enemies: [
      { col: 10, row: 9, rangeTiles: 4 },
      { col: 32, row: 9, rangeTiles: 4 },
      { col: 36, row: 9, rangeTiles: 4 },
      { col: 39, row: 9, rangeTiles: 4 },
    ],
    swoopEnemies: [
      { col: 33, row: 6, rangeTiles: 8 },
    ],
    doors: [
      { col: 17, row: DOOR_ROW, kind: 'shop', shopId: 'temple' },
      { col: 45, row: DOOR_ROW, kind: 'exit' },
    ],
    playerStart: { x: 100 },
  },
  {
    id: 6,
    name: 'Market Row',
    tiles: level6,
    coins: [
      { col: 4, row: 2 },
      { col: 9, row: 9 },
      { col: 12, row: 4 },
      { col: 19, row: 7 },
      { col: 24, row: 5 },
      { col: 31, row: 3 },
      { col: 35, row: 9 },
      { col: 38, row: 4 },
      { col: 44, row: 7 },
    ],
    enemies: [
      { col: 9, row: 9, rangeTiles: 3 },
      { col: 21, row: 9, rangeTiles: 3 },
      { col: 28, row: 9, rangeTiles: 3 },
      { col: 35, row: 9, rangeTiles: 3 },
      { col: 42, row: 9, rangeTiles: 3 },
    ],
    fireEnemies: [
      { col: 12, row: 6 },
    ],
    doors: [
      { col: 19, row: DOOR_ROW, kind: 'shop', shopId: 'blacksmith' },
      { col: 45, row: DOOR_ROW, kind: 'exit' },
    ],
    playerStart: { x: 100 },
  },
  {
    id: 7,
    name: 'Fortress Approach',
    tiles: level7,
    coins: [
      { col: 4, row: 2 },
      { col: 9, row: 9 },
      { col: 16, row: 2 },
      { col: 19, row: 5 },
      { col: 25, row: 9 },
      { col: 31, row: 9 },
      { col: 38, row: 7 },
      { col: 44, row: 7 },
    ],
    enemies: [
      { col: 9, row: 9, rangeTiles: 4 },
      { col: 25, row: 9, rangeTiles: 4 },
      { col: 31, row: 9, rangeTiles: 4 },
    ],
    doors: [
      { col: 44, row: DOOR_ROW, kind: 'exit' },
    ],
    // Fires twice as often as the first boss - every 5s (300 ticks).
    boss: {
      col: 34, rangeTiles: 11, health: 320, attackStrength: 20, assetPrefix: 'boss2',
      fireballIntervalTicks: 300,
    },
    playerStart: { x: 100 },
  },
  {
    id: 8,
    name: 'Dune Sea',
    tiles: level8,
    coins: [
      { col: 7, row: 8 },
      { col: 13, row: 6 },
      { col: 18, row: 5 },
      { col: 22, row: 9 },
      { col: 29, row: 6 },
      { col: 35, row: 4 },
      { col: 41, row: 4 },
    ],
    enemies: [
      { col: 12, row: 8, rangeTiles: 3 },
      { col: 28, row: 8, rangeTiles: 3 },
      { col: 34, row: 6, rangeTiles: 3 },
    ],
    swoopEnemies: [
      { col: 20, row: 6, rangeTiles: 7 },
    ],
    doors: [
      { col: 41, row: DOOR_ROW, kind: 'exit' },
    ],
    playerStart: { x: 100 },
  },
  {
    id: 9,
    name: 'Oasis Sanctuary',
    tiles: level9,
    coins: [
      { col: 5, row: 2 },
      { col: 9, row: 9 },
      { col: 16, row: 7 },
      { col: 24, row: 5 },
      { col: 28, row: 9 },
      { col: 33, row: 7 },
      { col: 38, row: 7 },
      { col: 42, row: 7 },
    ],
    enemies: [
      { col: 11, row: 9, rangeTiles: 4 },
      { col: 19, row: 9, rangeTiles: 4 },
      { col: 30, row: 9, rangeTiles: 4 },
      { col: 35, row: 9, rangeTiles: 4 },
    ],
    fireEnemies: [
      { col: 24, row: 6 },
    ],
    doors: [
      { col: 16, row: DOOR_ROW, kind: 'shop', shopId: 'mystic' },
      { col: 41, row: DOOR_ROW, kind: 'exit' },
    ],
    playerStart: { x: 100 },
  },
  {
    id: 10,
    name: 'Sky Bridges',
    tiles: level10,
    coins: [
      { col: 3, row: 9 },
      { col: 11, row: 7 },
      { col: 17, row: 5 },
      { col: 24, row: 7 },
      { col: 31, row: 7 },
      { col: 38, row: 7 },
      { col: 47, row: 7 },
    ],
    enemies: [
      // Kept away from each bridge's landing edges - a knockback that shoves
      // the player back off a floating platform's edge is an instant death,
      // so patrols here stay in a safe buffer zone in the middle.
      { col: 18, row: 8, rangeTiles: 1 },
      { col: 31, row: 8, rangeTiles: 1 },
    ],
    swoopEnemies: [
      { col: 15, row: 6, rangeTiles: 23 },
    ],
    doors: [
      { col: 48, row: DOOR_ROW, kind: 'exit' },
    ],
    playerStart: { x: 100 },
  },
  {
    id: 11,
    name: 'Monster Keep',
    tiles: level11,
    coins: [
      { col: 4, row: 2 },
      { col: 13, row: 2 },
      { col: 16, row: 5 },
      { col: 22, row: 3 },
      { col: 31, row: 2 },
      { col: 34, row: 5 },
      { col: 39, row: 9 },
      { col: 44, row: 7 },
      { col: 50, row: 7 },
    ],
    enemies: [
      { col: 9, row: 9, rangeTiles: 4 },
      { col: 19, row: 9, rangeTiles: 4 },
      { col: 27, row: 9, rangeTiles: 4 },
      { col: 37, row: 9, rangeTiles: 4 },
    ],
    fireEnemies: [
      { col: 13, row: 3 },
    ],
    doors: [
      { col: 49, row: DOOR_ROW, kind: 'exit' },
    ],
    // Fires from a random point on its body (center or top) at a random
    // interval every 5-10s (300-600 ticks), re-rolled after every shot.
    boss: {
      col: 40, rangeTiles: 12, health: 480, attackStrength: 28, assetPrefix: 'boss3',
      fireballIntervalMinTicks: 300, fireballIntervalMaxTicks: 600, fireballOrigins: ['center', 'top'],
    },
    playerStart: { x: 100 },
  },
];
