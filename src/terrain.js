/*
 * Terrain domain model. Pure game logic – no colors, no UI concerns.
 *
 * Cell value semantics:
 *   0  = water
 *   1  = black
 *   2  = blue
 *   3  = green
 *   4  = grey
 *   5  = red
 *   6  = yellow
 *   7  = brown
 *  -1  = UNASSIGNED (land hex without a color yet, used while building)
 */
(function (TM) {
    'use strict';

    // The seven terrain values, in numeric order (1–7).
    const TERRAINS = [1, 2, 3, 4, 5, 6, 7];

    const WATER = 0;        // water hex
    const UNASSIGNED = -1;  // land hex without a color yet

    function isTerrain(value) {
        return TERRAINS.indexOf(value) !== -1;
    }

    function isWater(value) {
        return value === WATER;
    }

    TM.terrain = { TERRAINS, WATER, UNASSIGNED, isTerrain, isWater };
})(window.TM = window.TM || {});
