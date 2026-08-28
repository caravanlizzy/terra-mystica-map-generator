/*
 * Terrain color model. A cell value is a terrain color, WATER, or one of the
 * markers used while building (RIVER / UNASSIGNED).
 */
(function (TM) {
    'use strict';

    // The seven terrain colors, in wheel order.
    const TERRAINS = ['red', 'yel', 'bro', 'bla', 'blu', 'grn', 'gry'];

    const WATER = '~~~';        // finished water hex
    const RIVER = ' ~ ';        // river hex, not finished yet
    const UNASSIGNED = '???';   // land hex without a color yet

    // Fill colors for the renderer and the SVG/PNG exports.
    const DISPLAY_COLORS = {
        red: '#e2373a',
        yel: '#f2e33f',
        bro: '#835C3B',
        bla: '#2b2b2b',
        blu: '#3a6ff2',
        grn: '#4aa03f',
        gry: '#808080',
        [WATER]: '#ffffff'
    };

    // Board Game Arena map-file symbols.
    const BGA_SYMBOLS = {
        red: 'R', yel: 'Y', bro: 'U', bla: 'K',
        blu: 'B', grn: 'G', gry: 'S', [WATER]: 'I'
    };

    function isTerrain(value) {
        return TERRAINS.indexOf(value) !== -1;
    }

    function isWater(value) {
        return value === WATER || value === RIVER;
    }

    function displayColor(value) {
        return DISPLAY_COLORS[value] || '#cccccc';
    }

    function bgaSymbol(value) {
        return BGA_SYMBOLS[value] || '';
    }

    TM.colors = {
        TERRAINS, WATER, RIVER, UNASSIGNED,
        DISPLAY_COLORS, BGA_SYMBOLS,
        isTerrain, isWater, displayColor, bgaSymbol
    };
})(window.TM = window.TM || {});
