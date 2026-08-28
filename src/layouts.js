/*
 * Layout service: the well-known river layouts plus a random river generator.
 * A layout is { width, height, form, rivers }, rivers being [x, y] pairs.
 */
(function (TM) {
    'use strict';

    const { rowWidth, outOfBounds, nextHex } = TM.geometry;

    // Simple random helpers used only within this module.
    function randomInt(min, max) {
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    const PRESETS = {
        original: {
            label: 'Original',
            width: 13, height: 9, form: 0,
            rivers: [[1, 1], [2, 1], [5, 1], [6, 1], [9, 1], [10, 1], [0, 2], [1, 2], [3, 2], [5, 2], [7, 2], [9, 2], [11, 2], [12, 2], [3, 3], [4, 3], [7, 3], [9, 3], [8, 4], [9, 4], [2, 5], [3, 5], [6, 5], [7, 5], [8, 5], [0, 6], [1, 6], [2, 6], [4, 6], [6, 6], [8, 6], [3, 7], [4, 7], [5, 7], [8, 7], [9, 8]]
        },
        fi: {
            label: 'Fire & Ice',
            width: 13, height: 9, form: 1,
            rivers: [[1, 0], [5, 0], [2, 1], [6, 1], [7, 1], [8, 1], [2, 2], [3, 2], [4, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [5, 3], [9, 3], [0, 4], [1, 4], [3, 4], [4, 4], [9, 4], [2, 5], [3, 5], [5, 5], [6, 5], [7, 5], [10, 5], [1, 6], [7, 6], [10, 6], [2, 7], [7, 7], [10, 7], [2, 8], [7, 8], [10, 8]]
        },
        fjords: {
            label: 'Fjords',
            width: 13, height: 9, form: 0,
            rivers: [[2, 0], [2, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [3, 2], [4, 2], [6, 2], [11, 2], [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [11, 3], [12, 3], [3, 4], [6, 4], [11, 4], [2, 5], [6, 5], [10, 5], [2, 6], [7, 6], [10, 6], [1, 7], [7, 7], [8, 7], [9, 7], [1, 8], [2, 8], [7, 8]]
        },
        loon: {
            label: 'Loon Lakes',
            width: 13, height: 9, form: 1,
            rivers: [[8, 0], [9, 0], [3, 1], [4, 1], [7, 1], [10, 1], [1, 2], [2, 2], [6, 2], [10, 2], [3, 3], [7, 3], [8, 3], [10, 3], [2, 4], [5, 4], [6, 4], [8, 4], [1, 5], [4, 5], [6, 5], [8, 5], [1, 6], [2, 6], [3, 6], [9, 6], [10, 6], [3, 7], [7, 7], [8, 7], [11, 7], [2, 8], [4, 8], [5, 8], [6, 8]]
        },
        onion: {
            label: 'Onion',
            width: 13, height: 9, form: 0,
            rivers: [[3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [2, 2], [3, 2], [9, 2], [10, 2], [2, 3], [6, 3], [9, 3], [3, 4], [5, 4], [6, 4], [7, 4], [9, 4], [10, 4], [11, 4], [12, 4], [1, 5], [2, 5], [6, 5], [10, 5], [2, 6], [3, 6], [4, 6], [9, 6], [10, 6], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7]]
        },
        archipelago: {
            label: 'Archipelago',
            width: 13, height: 9, form: 0,
            rivers: [[6, 0], [10, 0], [6, 1], [7, 1], [9, 1], [6, 2], [8, 2], [9, 2], [10, 2], [11, 2], [0, 3], [3, 3], [4, 3], [5, 3], [8, 3], [11, 3], [1, 4], [3, 4], [5, 4], [6, 4], [9, 4], [1, 5], [2, 5], [5, 5], [6, 5], [7, 5], [8, 5], [11, 5], [6, 6], [9, 6], [10, 6], [11, 6], [6, 7], [8, 7], [6, 8], [9, 8]]
        }
    };

    // { id: label } for the preset dropdown.
    function presetLabels() {
        const labels = {};
        for (const id in PRESETS) labels[id] = PRESETS[id].label;
        return labels;
    }

    // Deep copy, so callers may mutate it freely.
    function getPreset(id) {
        const preset = PRESETS[id];
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

    TM.layout = { PRESETS, presetLabels, getPreset, randomizeRivers };
})(window.TM = window.TM || {});
