/*
 * Random-walk water algorithm (target: water).
 *
 * A water-target algorithm is a plain object:
 *
 *   { id, name, label, target: 'water', description, inputs, run(grid, inputs, options) }
 *
 * `run` receives and updates a MapGrid, then returns it. It is picked up automatically by the water select in the
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
    function randomWalkWater(grid, inputs, options) {
        const shortestWalk = Math.min(inputs.minWalkLength, inputs.maxWalkLength);
        const longestWalk = Math.max(inputs.minWalkLength, inputs.maxWalkLength);
        const target = Math.round(TM.totalHexes(grid.width, grid.height, grid.form) * inputs.waterRatio);
        const water = new Set(grid.waterCoordinates().map(([x, y]) => x + ',' + y));

        let safety = target * 50 + 1000;
        while (water.size < target && safety-- > 0) {
            // Start a new short cluster somewhere.
            let y = randomInt(0, grid.height - 1);
            let x = randomInt(0, grid.rowWidth(y) - 1);

            const walkLength = randomInt(shortestWalk, longestWalk);
            for (let step = 0; step < walkLength && water.size < target; step++) {
                if (!grid.outOfBounds(x, y)) water.add(x + ',' + y);
                const [nx, ny] = grid.neighbor(x, y, randomInt(0, 5));
                if (grid.outOfBounds(nx, ny)) break;
                x = nx;
                y = ny;
            }
        }

        // The app hands us a grid already in the desired starting state (fresh
        // empty when Continue is off, water-only when on), so we never reset it
        // ourselves; we just lay down the water we grew.
        water.forEach(coordinate => {
            const [x, y] = coordinate.split(',').map(Number);
            grid.set(x, y, 0);
        });
        return grid;
    }

    TM.algorithms = TM.algorithms || [];
    TM.algorithms.push({
        id: 'water-random-walk',
        name: 'Random walk',
        label: 'Random walk',
        target: 'water',
        description: 'Builds rivers and lakes from random walks.',
        inputs: [
            { key: 'waterRatio', label: 'Water share', min: 0.05, max: 0.6, step: 0.01, value: 0.28 },
            { key: 'minWalkLength', label: 'Min walk', min: 1, max: 12, step: 1, value: 2 },
            { key: 'maxWalkLength', label: 'Max walk', min: 1, max: 12, step: 1, value: 5 }
        ],
        run: randomWalkWater
    });
})(window.TM = window.TM || {});
