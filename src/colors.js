/*
 * Terrain color model. A cell value is a number:
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

    // Fill colors for the renderer and the SVG/PNG exports.
    const DISPLAY_COLORS = {
        1: '#2b2b2b',   // black
        2: '#3a6ff2',   // blue
        3: '#4aa03f',   // green
        4: '#808080',   // grey
        5: '#e2373a',   // red
        6: '#f2e33f',   // yellow
        7: '#835C3B',   // brown
        0: '#ffffff'    // water
    };

    // Board Game Arena map-file symbols.
    const BGA_SYMBOLS = {
        1: 'K', // black
        2: 'B', // blue
        3: 'G', // green
        4: 'S', // grey
        5: 'R', // red
        6: 'Y', // yellow
        7: 'U', // brown
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
