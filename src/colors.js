/*
 * UI color and symbol mapping. Depends on terrain.js for the domain constants.
 *
 * Provides display colors for the SVG renderer, BGA export symbols, and the
 * edit-mode land / river fill colors used by the application controller.
 */
(function (TM) {
    'use strict';

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

    // Edit-mode hex fill colors (used by the app controller).
    const LAND_COLOR  = '#faedbf';
    const RIVER_COLOR = '#4aa9e8';

    function displayColor(value) {
        return DISPLAY_COLORS[value] || '#cccccc';
    }

    function bgaSymbol(value) {
        return BGA_SYMBOLS[value] || '';
    }

    TM.colors = {
        DISPLAY_COLORS, BGA_SYMBOLS,
        LAND_COLOR, RIVER_COLOR,
        displayColor, bgaSymbol
    };
})(window.TM = window.TM || {});
