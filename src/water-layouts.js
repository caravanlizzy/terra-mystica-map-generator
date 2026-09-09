/*
 * Layout service: preset lookup and water-layout dispatch.
 * Preset data lives in layout-presets.js (TM.PRESETS).
 * A layout is { width, height, form, cells }, where cells is an optional
 * row-by-row numeric MapGrid terrain map.
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
            cells: preset.cells ? preset.cells.map(row => row.slice()) : null
        };
    }

    // All registered water-target algorithms, in registration order.
    function waterAlgorithms() {
        return (TM.algorithms || []).filter(a => a.target === 'water');
    }

    // Run the chosen water algorithm (by id); falls back to the first registered
    // one. Returns the grid unchanged if no water algorithm is registered.
    async function randomizeWater(grid, algorithmId, inputs, options = {}) {
        const algorithms = waterAlgorithms();
        const algorithm = algorithms.find(a => a.id === algorithmId) || algorithms[0];
        if (algorithm && typeof algorithm.run === 'function') {
            // Awaiting also supports synchronous algorithms, whose return value
            // is automatically wrapped in a resolved promise.
            return await algorithm.run(
                grid,
                TM.resolveAlgorithmInputs(algorithm, inputs),
                options
            );
        }
        return grid;
    }

    TM.layout = { presetLabels, getPreset, randomizeWater, waterAlgorithms };
})(window.TM = window.TM || {});
