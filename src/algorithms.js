/*
 * Terrain generation algorithms. Each algorithm is a plain object:
 * { id, label, description, fill(grid) }.
 *
 * `fill` receives a reset MapGrid and assigns a terrain color to every land
 * hex. Use Math.random (or import your own RNG) directly as needed.
 * Add new algorithms to the array below.
 */
(function (TM) {
    'use strict';

    const { TERRAINS } = TM.colors;

    // Random element of a non-empty array.
    function pick(items) {
        return items[Math.floor(Math.random() * items.length)];
    }

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
        }
    ];
})(window.TM = window.TM || {});
