/*
 * Layout service: preset lookup and random water generator.
 * Preset data lives in presets.js (TM.PRESETS).
 * A layout is { width, height, form, water }, water being [x, y] pairs.
 */
(function (TM) {
    'use strict';

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
            water: preset.water.map(([x, y]) => [x, y])
        };
    }

    // A random layout, grown as short random walks so the water hexes cluster
    // naturally. `ratio` is the share of water hexes.
    function randomizeWater(grid, ratio) {
        const share = typeof ratio === 'number' ? ratio : 0.28;
        const target = Math.round(TM.totalHexes(grid.width, grid.height, grid.form) * share);
        const water = new Set();

        let safety = target * 50 + 1000;
        while (water.size < target && safety-- > 0) {
            // Start a new short cluster somewhere.
            let y = randomInt(0, grid.height - 1);
            let x = randomInt(0, grid.rowWidth(y) - 1);

            const walkLength = randomInt(2, 5);
            for (let step = 0; step < walkLength && water.size < target; step++) {
                if (!grid.outOfBounds(x, y)) water.add(x + ',' + y);
                const [nx, ny] = grid.neighbor(x, y, randomInt(0, 5));
                if (grid.outOfBounds(nx, ny)) break;
                x = nx;
                y = ny;
            }
        }

        grid.water = water;
        grid.reset();
        return grid;
    }

    TM.layout = { presetLabels, getPreset, randomizeWater };
})(window.TM = window.TM || {});


