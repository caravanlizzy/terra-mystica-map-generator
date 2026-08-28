/*
 * Layout service: preset lookup and random river generator.
 * Preset data lives in presets.js (TM.PRESETS).
 * A layout is { width, height, form, rivers }, rivers being [x, y] pairs.
 */
(function (TM) {
    'use strict';

    const { rowWidth, outOfBounds, nextHex } = TM.hexGrid;

    // Simple random helpers used only within this module.
    function randomInt(min, max) {
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    // { id: label } for the preset dropdown.
    function presetLabels() {
        const labels = {};
        for (const id in TM.PRESETS) labels[id] = TM.PRESETS[id].label;
        return labels;
    }

    // Deep copy, so callers may mutate it freely.
    function getPreset(id) {
        const preset = TM.PRESETS[id];
        if (!preset) return null;
        return {
            width: preset.width,
            height: preset.height,
            form: preset.form,
            rivers: preset.rivers.map(([x, y]) => [x, y])
        };
    }

    // A random layout, grown as short random walks so the rivers look
    // river-like instead of like noise. `ratio` is the share of river hexes.
    function randomizeRivers(width, height, form, ratio) {
        const share = typeof ratio === 'number' ? ratio : 0.28;
        const target = Math.round(TM.totalHexes(width, height, form) * share);
        const rivers = new Set();
        const inBounds = (x, y) => !outOfBounds(x, y, width, height, form);

        let safety = target * 50 + 1000;
        while (rivers.size < target && safety-- > 0) {
            // Start a new short river somewhere.
            let y = randomInt(0, height - 1);
            let x = randomInt(0, rowWidth(width, y, form) - 1);

            const walkLength = randomInt(2, 5);
            for (let step = 0; step < walkLength && rivers.size < target; step++) {
                if (inBounds(x, y)) rivers.add(x + ',' + y);
                const [nx, ny] = nextHex(x, y, randomInt(0, 5), form);
                if (!inBounds(nx, ny)) break;
                x = nx;
                y = ny;
            }
        }

        return {
            width, height, form,
            rivers: [...rivers].map(key => key.split(',').map(Number))
        };
    }

    TM.layout = { presetLabels, getPreset, randomizeRivers };
})(window.TM = window.TM || {});

