/*
 * Algorithms live in this folder. Each file registers one algorithm object in
 * the shared TM.algorithms array:
 *
 *   { id, name, label, target, description, ... }
 *
 *   id      unique string
 *   name    human readable name (label is kept as an alias for the UI)
 *   target  'terrain'  → colors the land hexes, exposes fill(grid)
 *           'water'    → generates the water layout, exposes run(grid)
 *
 * Terrain algorithms (target: 'terrain') get a reset MapGrid and must assign a
 * terrain color to every land hex before returning. They show up automatically
 * in the terrain "Algorithm" dropdown; water algorithms show up in the water
 * dropdown next to "Random water".
 *
 * ── MapGrid API (what you can call inside fill) ─────────────────────────────
 *
 *   grid.landCoordinates()        → [[x, y], …]   all land (non-water) hexes
 *   grid.neighbors(x, y)          → [[x, y], …]   in-bounds neighbors (up to 6)
 *   grid.get(x, y)                → value          current cell value
 *   grid.set(x, y, value)                          assign a terrain color
 *   grid.isWaterAt(x, y)          → bool           true for water hexes
 *   grid.count(value)             → number         how many cells hold value
 *   grid.snapshot() / restore(s)                   save & reload all cells
 *
 * ── Color values ────────────────────────────────────────────────────────────
 *
 *   TM.terrain.TERRAINS  [1, 2, 3, 4, 5, 6, 7]  (black, blue, green, grey, red, yellow, brown)
 *   TM.terrain.UNASSIGNED -1     land hex not yet assigned
 *   TM.terrain.WATER       0     finished water hex (read-only inside fill)
 *
 * ── Utility helpers ─────────────────────────────────────────────────────────
 *
 *   TM.utils.pick(array)          → element   random element
 *   TM.utils.shuffle(array)       → array     new shuffled copy (no mutation)
 */
(function (TM) {
    'use strict';

    const { TERRAINS } = TM.terrain;
    const { pick } = TM.utils;

    TM.algorithms = TM.algorithms || [];
    TM.algorithms.push({
        id: 'random',
        label: 'Random colors',
        target: 'terrain',
        description: 'Every land hex gets a uniformly random terrain color, independent of its neighbors.',
        fill(grid) {
            for (const [x, y] of grid.landCoordinates()) {
                grid.set(x, y, pick(TERRAINS));
            }
        }
    });
})(window.TM = window.TM || {});
