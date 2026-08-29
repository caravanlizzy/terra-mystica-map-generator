/*
 * Hex-grid geometry: offset rows of pointy-top hexes.
 *
 * Row `y` holds `width - ((y + form) % 2)` hexes, so rows alternate long/short;
 * form 0 starts long, form 1 starts short. Coordinates are zero-based
 * (x, y) = (column, row).
 */
(function (TM) {
    'use strict';

    // Directions are indices 0..5.
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

    /* ---------------- pixel geometry (pointy-top hexes) ---------------- */

    const R = 34;                    // circumradius of a hex
    const HEX_W = Math.sqrt(3) * R;  // width (flat to flat)
    const HEX_H = 2 * R;             // height (point to point)
    const ROW_STEP = 1.5 * R;        // vertical distance between rows
    const MARGIN = 24;

    // Pixel center of hex (x, y).
    function center(x, y, form) {
        const shift = ((y + form) % 2) === 1 ? HEX_W / 2 : 0; // shorter rows are shifted right
        return {
            cx: MARGIN + HEX_W / 2 + shift + x * HEX_W,
            cy: MARGIN + R + y * ROW_STEP
        };
    }

    // The six vertices as [x, y] pairs: vertex i at angle (60*i - 90) degrees,
    // edge i joining vertex i and i+1.
    function hexVertices(cx, cy) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 180 * (60 * i - 90);
            points.push([cx + R * Math.cos(angle), cy + R * Math.sin(angle)]);
        }
        return points;
    }

    // SVG `points` attribute for one hex.
    function hexPoints(cx, cy) {
        return hexVertices(cx, cy)
            .map(([px, py]) => px.toFixed(2) + ',' + py.toFixed(2))
            .join(' ');
    }

    function canvasSize(width, height, form) {
        return {
            width: Math.ceil(MARGIN * 2 + width * HEX_W),
            height: Math.ceil(MARGIN * 2 + HEX_H + (height - 1) * ROW_STEP)
        };
    }

    TM.geometry = {
        DIRECTIONS, rowWidth, outOfBounds, nextHex, oppositeDirection,
        center, hexPoints, hexVertices, canvasSize,
        R, HEX_W, HEX_H, ROW_STEP, MARGIN
    };
})(window.TM = window.TM || {});
