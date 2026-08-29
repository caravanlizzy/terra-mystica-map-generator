/*
 * Hex-grid topology: offset rows of pointy-top hexes.
 *
 * Row `y` holds `width - ((y + form) % 2)` hexes, so rows alternate long/short;
 * form 0 starts long, form 1 starts short. Coordinates are zero-based
 * (x, y) = (column, row).
 *
 * No pixel / SVG knowledge lives here – see geometry.js for that.
 */
(function (TM) {
    'use strict';

    // Direction indices 0..5.
    const DIRECTIONS = ['down-right', 'right', 'up-right', 'up-left', 'left', 'down-left'];

    // Hexes in row y.
    function rowWidth(width, y, form) {
        return width - ((y + form) % 2);
    }

    function outOfBounds(x, y, width, height, form) {
        if (y < 0 || y >= height) return true;
        return x < 0 || x >= rowWidth(width, y, form);
    }

    // Neighbor of (x, y) in direction dir.
    function nextHex(x, y, dir, form) {
        const even = ((y + form) % 2) === 0;
        switch (dir) {
            case 0: return even ? [x, y + 1] : [x + 1, y + 1];   // down-right
            case 1: return [x + 1, y];                           // right
            case 2: return even ? [x, y - 1] : [x + 1, y - 1];   // up-right
            case 3: return even ? [x - 1, y - 1] : [x, y - 1];   // up-left
            case 4: return [x - 1, y];                           // left
            case 5: return even ? [x - 1, y + 1] : [x, y + 1];   // down-left
            default: return [x, y];
        }
    }

    // The direction pointing back.
    function oppositeDirection(dir) {
        return (dir + 3) % 6;
    }

    TM.hexGrid = { DIRECTIONS, rowWidth, outOfBounds, nextHex, oppositeDirection };
})(window.TM = window.TM || {});
