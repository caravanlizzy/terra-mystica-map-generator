/*
 * Layout service: preset lookup and water-layout dispatch.
 * Preset data lives in layout-presets.js (TM.PRESETS).
 * A layout is { width, height, form, water, terrain }, water being [x, y]
 * pairs and terrain being an optional numeric MapGrid terrain map.
 *
 * The actual water generators are registered as water-target algorithms in the
 * algorithms folder (see src/algorithms/). randomizeWater() simply runs the one
 * the user picked in the water dropdown.
 */
(function (TM) {
    'use strict';

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
            water: preset.water.map(([x, y]) => [x, y]),
            terrain: preset.terrain ? preset.terrain.map(row => row.slice()) : null
        };
    }

    // All registered water-target algorithms, in registration order.
    function waterAlgorithms() {
        return (TM.algorithms || []).filter(a => a.target === 'water');
    }

    // Run the chosen water algorithm (by id); falls back to the first registered
    // one. Returns the grid unchanged if no water algorithm is registered.
    function randomizeWater(grid, algorithmId) {
        const algorithms = waterAlgorithms();
        const algorithm = algorithms.find(a => a.id === algorithmId) || algorithms[0];
        if (algorithm && typeof algorithm.run === 'function') {
            return algorithm.run(grid);
        }
        return grid;
    }

    TM.layout = { presetLabels, getPreset, randomizeWater, waterAlgorithms };
})(window.TM = window.TM || {});
