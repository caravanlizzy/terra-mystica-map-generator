/*
 * Terrain generation algorithms. Each algorithm is a plain object:
 *
 *   { id, label, description, fill(grid) }
 *
 * `fill` receives a reset MapGrid and must assign a terrain color to every
 * land hex before returning. Add new algorithms to the TM.algorithms array
 * at the bottom of this file; they appear automatically in the UI dropdown.
 *
 * ── MapGrid API (what you can call inside fill) ─────────────────────────────
 *
 *   grid.landCoordinates()        → [[x, y], …]   all land (non-water) hexes
 *   grid.neighbors(x, y)          → [[x, y], …]   in-bounds neighbors (up to 6)
 *   grid.get(x, y)                → value          current cell value
 *   grid.set(x, y, value)                          assign a terrain color
 *   grid.isWaterAt(x, y)          → bool           true for water / river hexes
 *   grid.count(value)             → number         how many cells hold value
 *   grid.snapshot() / restore(s)                   save & reload all cells
 *
 * ── Color values ────────────────────────────────────────────────────────────
 *
 *   TM.colors.TERRAINS   [1, 2, 3, 4, 5, 6, 7]  (black, blue, brown, green, grey, red, yellow)
 *   TM.colors.UNASSIGNED -1     land hex not yet assigned
 *   TM.colors.WATER       0     finished water hex (read-only inside fill)
 *
 * ── Utility helpers ─────────────────────────────────────────────────────────
 *
 *   TM.utils.pick(array)          → element   random element
 *   TM.utils.shuffle(array)       → array     new shuffled copy (no mutation)
 */
(function (TM) {
    'use strict';

    const { TERRAINS } = TM.colors;
    const { pick, shuffle } = TM.utils;

    TM.algorithms = [
        {
            id: 'random',
            label: 'Random colors',
            description: 'Every land hex gets a uniformly random terrain color, independent of its neighbors.',
            fill(grid) {
                for (const [x, y] of grid.landCoordinates()) {
                    grid.set(x, y, pick(TERRAINS));
                }
            }
        },
        {
            id: 'balanced',
            label: 'Balanced random',
            description: 'Land hexes are shuffled and split into seven equal-sized bands, one per terrain color. Every color appears roughly the same number of times.',
            fill(grid) {
                const land = shuffle(grid.landCoordinates());
                const total = land.length;
                land.forEach(([x, y], i) => {
                    // Map position i to one of the seven terrain colors.
                    const colorIndex = Math.floor(i * TERRAINS.length / total);
                    grid.set(x, y, TERRAINS[colorIndex]);
                });
            }
        }
    ];
})(window.TM = window.TM || {});
