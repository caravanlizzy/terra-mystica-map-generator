/*
 * Terrain color model. A cell value is a number:
 *   0  = water
 *   1  = black
 *   2  = blue
 *   3  = brown
 *   4  = green
 *   5  = grey
 *   6  = red
 *   7  = yellow
 *  -1  = UNASSIGNED (land hex without a color yet, used while building)
 */
(function (TM) {
    'use strict';

    // The seven terrain values, in numeric order (1–7).
    const TERRAINS = [1, 2, 3, 4, 5, 6, 7];

    const WATER = 0;        // water hex
    const UNASSIGNED = -1;  // land hex without a color yet

    // Fill colors for the renderer and the SVG/PNG exports.
    const DISPLAY_COLORS = {
        1: '#2b2b2b',   // black
        2: '#3a6ff2',   // blue
        3: '#835C3B',   // brown
        4: '#4aa03f',   // green
        5: '#808080',   // grey
        6: '#e2373a',   // red
        7: '#f2e33f',   // yellow
        0: '#ffffff'    // water
    };

    // Board Game Arena map-file symbols.
    const BGA_SYMBOLS = {
        1: 'K', // black
        2: 'B', // blue
        3: 'U', // brown
        4: 'G', // green
        5: 'S', // grey
        6: 'R', // red
        7: 'Y', // yellow
        0: 'I'  // water
    };

    function isTerrain(value) {
        return TERRAINS.indexOf(value) !== -1;
    }

    function isWater(value) {
        return value === WATER;
    }

    function displayColor(value) {
        return DISPLAY_COLORS[value] || '#cccccc';
    }

    function bgaSymbol(value) {
        return BGA_SYMBOLS[value] || '';
    }

    TM.colors = {
        TERRAINS, WATER, UNASSIGNED,
        DISPLAY_COLORS, BGA_SYMBOLS,
        isTerrain, isWater, displayColor, bgaSymbol
    };
})(window.TM = window.TM || {});
