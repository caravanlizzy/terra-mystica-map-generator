/*
 * "Random colors" - the built-in algorithm, and the file to copy for your own.
 * Every land hex gets a uniformly random color, independent of its neighbors;
 * it balances nothing.
 *
 * >> Contract and how to add one: README.md, "The algorithm interface".
 */
(function (TM) {
    'use strict';

    const { TERRAINS } = TM.colors;

    TM.algorithms.register({
        id: 'random',
        label: 'Random colors',
        description: 'Every land hex gets a uniformly random terrain color, independent of its neighbors.',

        // `grid` arrives reset; write land hexes only, the caller finishes
        // the water. Use `context` over Math.random to stay reproducible.
        fill(grid, context) {
            for (const [x, y] of grid.landCoordinates()) {
                grid.set(x, y, context.pick(TERRAINS));
            }
        }
    });
})(window.TM = window.TM || {});
