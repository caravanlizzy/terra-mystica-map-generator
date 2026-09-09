/*
 * Balanced random terrain algorithm (target: terrain).
 * See terrain-random.js for the full algorithm-object and MapGrid API documentation.
 */
(function (TM) {
    'use strict';

    const { TERRAINS } = TM.terrain;
    const { shuffle } = TM.utils;

    TM.algorithms = TM.algorithms || [];
    TM.algorithms.push({
        id: 'balanced',
        label: 'Balanced random',
        target: 'terrain',
        description: 'Distributes terrain colors as evenly as possible.',
        fill(grid) {
            const land = shuffle(grid.landCoordinates());
            const total = land.length;
            land.forEach(([x, y], i) => {
                // Map position i to one of the seven terrain colors.
                const colorIndex = Math.floor(i * TERRAINS.length / total);
                grid.set(x, y, TERRAINS[colorIndex]);
            });
        }
    });
})(window.TM = window.TM || {});
