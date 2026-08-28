/*
 * SVG pixel geometry for pointy-top hexes. Pure rendering math – no grid
 * topology (rows, neighbors, bounds) lives here; see hexGrid.js for that.
 */
(function (TM) {
    'use strict';

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
        center, hexPoints, hexVertices, canvasSize,
        R, HEX_W, HEX_H, ROW_STEP, MARGIN
    };
})(window.TM = window.TM || {});
