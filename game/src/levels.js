// The three glasshouse wings of VERDANT, as tile maps. One tile is 40 px;
// the field is 32 by 18 tiles. Map characters:
//   '#' stone wall — blocks movement and sight
//   '.' mossy floor
//   'C' crate — blocks movement and sight
//   'S' stone statue — blocks movement and sight
//   'B' bush — walkable, hides the player, blocks sight
//   '~' pond water — blocks movement, not sight
//   'P' where Wren starts
//   'E' the garden gate (the exit)
//   '*' a Moonpetal to steal
// Guard patrols are loops of tile centres, in pixels, in patrol order.
import { FIELD } from './config.js';

function tileCentre(col, row) {
  return { x: (col + 0.5) * FIELD.tile, y: (row + 0.5) * FIELD.tile };
}

export const LEVELS = [
  {
    name: 'The Fern Court',
    subtitle: 'Three gardeners patrol the ferns. Steal 3 Moonpetals, then slip out the gate.',
    seed: 11,
    petalsNeeded: 3,
    map: [
      '################################',
      '#P....B........C.......*.......#',
      '#.....B..................B.....#',
      '#..C.......B......C............#',
      '#..........B...........B....C..#',
      '#..B....C.......B..............#',
      '#......B............B....C.....#',
      '#..C.........B.........B.......#',
      '#.....B..........C.........*...#',
      '#...........B..........B.......#',
      '#..B....C........B.......C.....#',
      '#.....B............B...........#',
      '#..C........B.......C....B.....#',
      '#...........B..........B....C..#',
      '#..B.....*.......B.............#',
      '#.....B............B....C......#',
      '#..C........B...........B....E.#',
      '################################',
    ],
    guards: [
      { waypoints: [[8, 2], [17, 2], [17, 5], [10, 5]] },
      { waypoints: [[5, 9], [14, 9], [14, 13], [5, 13]] },
      { waypoints: [[24, 7], [26, 7], [26, 13], [24, 13]] },
    ],
    lanterns: [[4, 4], [20, 3], [13, 12], [27, 13]],
  },
  {
    name: 'The Orchid House',
    subtitle: 'Four gardeners, a still pond, and orchids that glow in the dark. Steal 4 Moonpetals.',
    seed: 47,
    petalsNeeded: 4,
    map: [
      '################################',
      '#P.....B......C.........*......#',
      '#......B................B......#',
      '#..C........B......C..........*#',
      '#..........B...........B.......#',
      '#..B....C........B.............#',
      '#......B.............B....C....#',
      '#..C..........B........B.......#',
      '#.....B.....~~~~~~~~...........#',
      '#...........~~~~~~~~.....B.....#',
      '#..B....C...~~~~~~~~..B........#',
      '#.....B.....~~~~~~~~......C....#',
      '#..C..........B........B.....*.#',
      '#...........B...........B......#',
      '#..B.....*.......C.............#',
      '#.....B............B.....C.....#',
      '#..C........B...........B....E.#',
      '################################',
    ],
    guards: [
      { waypoints: [[8, 2], [16, 2], [16, 4], [8, 4]] },
      { waypoints: [[22, 2], [28, 2], [28, 5], [22, 5]] },
      { waypoints: [[5, 11], [11, 11], [11, 13], [5, 13]] },
      { waypoints: [[22, 12], [28, 14], [28, 16], [22, 16]] },
    ],
    lanterns: [[4, 7], [19, 2], [10, 13], [27, 8], [15, 16]],
  },
  {
    name: 'The Glass Dome',
    subtitle: 'Five gardeners under the great dome. Steal 5 Moonpetals — and never be seen.',
    seed: 83,
    petalsNeeded: 5,
    map: [
      '################################',
      '#P....B......C....*......B.....#',
      '#.....B..........C........B....#',
      '#..C.......B...........C......*#',
      '#..........B....######.........#',
      '#..B....C.......#....#...B.....#',
      '#......B........#.~~.#....C....#',
      '#..C............#.~~.#..B......#',
      '#.....B....C....#....#.........#',
      '#..........B...######....B.....#',
      '#..B....C........B.......C.....#',
      '#.....B............B...........#',
      '#..C........B.......C....B...*.#',
      '#...........B..........B.......#',
      '#..B.....*.......B........C....#',
      '#.....B............B....B......#',
      '#..C........B......*....B....E.#',
      '################################',
    ],
    guards: [
      { waypoints: [[7, 2], [15, 2], [15, 4], [7, 4]] },
      { waypoints: [[22, 2], [28, 2], [28, 5], [22, 5]] },
      { waypoints: [[4, 10], [7, 10], [7, 14], [4, 14]] },
      { waypoints: [[15, 11], [18, 11], [18, 14], [15, 14]] },
      { waypoints: [[24, 9], [28, 9], [28, 11], [24, 11]] },
    ],
    lanterns: [[4, 5], [18, 1], [28, 9], [9, 15], [21, 12], [14, 8]],
  },
];

/** Parse a level definition into tiles, the start, the gate, the petals and the guards. */
export function parseLevel(def) {
  const tiles = [];
  let start = null;
  let exit = null;
  const petals = [];
  for (let row = 0; row < FIELD.rows; row += 1) {
    const line = def.map[row];
    const tilesRow = [];
    for (let col = 0; col < FIELD.cols; col += 1) {
      const ch = line[col];
      tilesRow.push(ch);
      if (ch === 'P') start = tileCentre(col, row);
      else if (ch === 'E') exit = tileCentre(col, row);
      else if (ch === '*') petals.push({ x: (col + 0.5) * FIELD.tile, y: (row + 0.5) * FIELD.tile, taken: false });
    }
    tiles.push(tilesRow);
  }
  const guards = def.guards.map((guard) => ({
    waypoints: guard.waypoints.map(([col, row]) => tileCentre(col, row)),
  }));
  const lanterns = def.lanterns.map(([col, row]) => tileCentre(col, row));
  return { def, tiles, start, exit, petals, guards, lanterns };
}

/** Check every level's map: rows, columns, one start, one gate, the right petals, and patrols on floor. */
export function validateLevels() {
  const problems = [];
  const SOLID = new Set(['#', 'C', 'S', '~']);
  for (let index = 0; index < LEVELS.length; index += 1) {
    const def = LEVELS[index];
    if (def.map.length !== FIELD.rows) problems.push(`level ${index}: ${def.map.length} rows, want ${FIELD.rows}`);
    for (let row = 0; row < def.map.length; row += 1) {
      if (def.map[row].length !== FIELD.cols) problems.push(`level ${index} row ${row}: ${def.map[row].length} chars, want ${FIELD.cols}`);
    }
    const parsed = parseLevel(def);
    if (parsed.start === null) problems.push(`level ${index}: no start`);
    if (parsed.exit === null) problems.push(`level ${index}: no exit`);
    if (parsed.petals.length !== def.petalsNeeded) problems.push(`level ${index}: ${parsed.petals.length} petals, want ${def.petalsNeeded}`);
    const floorAt = (col, row) => {
      if (col < 0 || col >= FIELD.cols || row < 0 || row >= FIELD.rows) return false;
      return def.map[row][col] === '.' || def.map[row][col] === 'P' || def.map[row][col] === 'E' || def.map[row][col] === '*';
    };
    for (let g = 0; g < def.guards.length; g += 1) {
      for (const [col, row] of def.guards[g].waypoints) {
        if (!floorAt(col, row)) problems.push(`level ${index} guard ${g}: waypoint (${col},${row}) is '${def.map[row] ? def.map[row][col] : '?'}', not floor`);
      }
      // Every patrol leg must be walkable by a guard's circle (radius 14): sample
      // the segment and check the tiles the circle overlaps.
      const wps = def.guards[g].waypoints;
      for (let w = 0; w < wps.length; w += 1) {
        const a = tileCentre(wps[w][0], wps[w][1]);
        const b = tileCentre(wps[(w + 1) % wps.length][0], wps[(w + 1) % wps.length][1]);
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.max(1, Math.ceil(dist / 4));
        for (let i = 0; i <= steps; i += 1) {
          const t = i / steps;
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          for (const [cx, cy] of [[x - 14, y - 14], [x + 14, y - 14], [x - 14, y + 14], [x + 14, y + 14], [x, y]]) {
            const col = Math.floor(cx / FIELD.tile);
            const row = Math.floor(cy / FIELD.tile);
            if (col < 0 || col >= FIELD.cols || row < 0 || row >= FIELD.rows || SOLID.has(def.map[row][col])) {
              problems.push(`level ${index} guard ${g}: leg ${w} blocked near (${Math.round(x)},${Math.round(y)}) by '${def.map[row] ? def.map[row][col] : 'edge'}' at (${col},${row})`);
              i = steps + 1;
              break;
            }
          }
        }
      }
    }
    for (const [col, row] of def.lanterns) {
      if (!floorAt(col, row)) problems.push(`level ${index}: lantern (${col},${row}) is not on floor`);
    }
  }
  return problems;
}
