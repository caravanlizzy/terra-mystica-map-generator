/*
 * MapGenerator - runs a map algorithm over a layout: resets the grid, hands it
 * to the algorithm (see algorithms/registry.js), finishes the water hexes.
 */
(function (TM) {
    'use strict';

    class MapGenerator {
        // options: { algorithm, rng }. `algorithm` is an id or an object
        // implementing the interface; unknown ids fall back to the default.
        // `rng` is an optional () => number in [0, 1) for reproducible runs.
        constructor(grid, options) {
            const settings = options || {};
            this.grid = grid;
            this.algorithm = settings.algorithm && typeof settings.algorithm === 'object'
                ? settings.algorithm
                : TM.algorithms.get(settings.algorithm);
            if (!this.algorithm) throw new Error('No map algorithm registered.');
            this.context = TM.algorithms.createContext(settings.rng);
        }

        // Fill the grid once.
        generate() {
            this.grid.reset();
            this.algorithm.fill(this.grid, this.context);
            this.grid.finishWater();
            return this.grid;
        }
    }

    TM.MapGenerator = MapGenerator;
})(window.TM = window.TM || {});
