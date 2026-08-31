/*
 * Random-walk water algorithm (target: water).
 *
 * A water-target algorithm is a plain object:
 *
 *   { id, name, label, target: 'water', description, run(grid) }
 *
 * `run` receives a MapGrid, assigns grid.water (a Set of "x,y" strings) and
 * returns the grid. It is picked up automatically by the water select in the
 * UI because it registers itself in the shared TM.algorithms registry.
 *
 * This generator was lifted verbatim out of water-layouts.js
 * (formerly randomizeWaterOld): it grows the water as short random walks so the
 * water hexes cluster naturally.
 */
(function (TM) {
    'use strict';

    // Simple random helper used by the generator below.
    function randomInt(min, max) {
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    // A random layout, grown as short random walks so the water hexes cluster
    // naturally.
    function randomWalkWater(grid, ratio) {
        const share = typeof ratio === 'number' ? ratio : 0.28;
        const target = Math.round(TM.totalHexes(grid.width, grid.height, grid.form) * share);
        const water = new Set();

        let safety = target * 50 + 1000;
        while (water.size < target && safety-- > 0) {
            // Start a new short cluster somewhere.
            let y = randomInt(0, grid.height - 1);
            let x = randomInt(0, grid.rowWidth(y) - 1);

            const walkLength = randomInt(2, 5);
            for (let step = 0; step < walkLength && water.size < target; step++) {
                if (!grid.outOfBounds(x, y)) water.add(x + ',' + y);
                const [nx, ny] = grid.neighbor(x, y, randomInt(0, 5));
                if (grid.outOfBounds(nx, ny)) break;
                x = nx;
                y = ny;
            }
        }

        grid.water = water;
        grid.reset();
        return grid;
    }

    TM.algorithms = TM.algorithms || [];
    TM.algorithms.push({
        id: 'water-random-walk',
        name: 'Random walk water',
        label: 'Random walk water',
        target: 'water',
        description: 'Grows water as short random walks starting from scattered seeds, so the water hexes cluster naturally into rivers and lakes.',
        run: randomWalkWater
    });
})(window.TM = window.TM || {});
