/*
 * Application controller: wires the DOM controls to the services and renderer.
 *
 * A single unified view: the map always shows terrain colors. Clicking a hex
 * toggles it between water and land; colors are only ever changed through the
 * terrain wheel (pick a color, then click hexes to paint them).
 */
(function (TM) {
    'use strict';

    const { WATER, UNASSIGNED } = TM.terrain;
    const { displayColor } = TM.colors;

    const svg = document.getElementById('map');
    const $ = (id) => document.getElementById(id);

    const state = {
        grid: new TM.MapGrid({ width: 13, height: 9, form: 0 }),
        paintValue: null,    // terrain value picked on the wheel to paint hexes with
        showColors: true,    // when off, terrain colors are hidden so only water is shown
        algorithmId: null,   // the terrain algorithm chosen in the header
        waterAlgorithmId: null, // the water algorithm chosen in the map editor
        algorithmInputs: {}, // { algorithmId: { inputKey: value } }
        waterAlgorithmInputs: {}, // { algorithmId: { inputKey: value } }
        zoom: 1,             // display scale for the rendered map
        lastSize: null       // intrinsic canvas size from the last render
    };

    const ZOOM_MIN = 0.1;
    const ZOOM_MAX = 4;

    const WHEEL_RADIUS = 35;   // terrain wheel: distance from center, in %

    // Compact "approximately equals" wave symbol for the wheel center, matching
    // the water icon used before (two short stacked waves close together).
    const WATER_ICON_SVG =
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M 7 10 Q 9.5 7.5 12 10 T 17 10 M 7 14 Q 9.5 11.5 12 14 T 17 14" ' +
        'fill="none" stroke="#888" stroke-width="1.5" stroke-linecap="round"/>' +
        '</svg>';

    // Cube icon for the zoom-window color toggle. When colors are shown the four
    // right-hand faces are colored; when colors are hidden they turn black/white
    // so the icon itself reflects the current state (no background highlight).
    function cubeIconSvg(colored) {
        const blue = colored ? '#3a6ff2' : '#fff';
        const green = colored ? '#4aa03f' : '#000';
        const red = colored ? '#e2373a' : '#fff';
        const yellow = colored ? '#f2e33f' : '#000';
        return '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<polygon points="12,2 12,12 3.3,7" fill="#fff"/>' +
            '<polygon points="3.3,7 12,12 12,22 3.3,17" fill="#2b2b2b"/>' +
            '<polygon points="12,2 20.7,7 12,12" fill="' + blue + '"/>' +
            '<polygon points="20.7,7 20.7,12 12,12" fill="' + green + '"/>' +
            '<polygon points="20.7,12 20.7,17 12,12" fill="' + red + '"/>' +
            '<polygon points="20.7,17 12,22 12,12" fill="' + yellow + '"/>' +
            '<polygon points="12,2 20.7,7 20.7,17 12,22 3.3,17 3.3,7" fill="none" stroke="#333" stroke-width="1.25"/>' +
            '</svg>';
    }

    function restoreUiPreferences() {
        const saved = TM.storage.loadUiPreferences();
        if (!saved) return;

        $('width').value = saved.width !== null ? saved.width : state.grid.width;
        $('height').value = saved.height !== null ? saved.height : state.grid.height;
        $('form').value = saved.form;
        state.grid = new TM.MapGrid(readDimensions());
        state.algorithmId = saved.algorithmId;
        state.waterAlgorithmId = saved.waterAlgorithmId;
        state.algorithmInputs = saved.algorithmInputs;
        state.waterAlgorithmInputs = saved.waterAlgorithmInputs;
        $('continueWater').checked = saved.continueWater;
    }

    function saveUiPreferences() {
        TM.storage.saveUiPreferences({
            width: state.grid.width,
            height: state.grid.height,
            form: state.grid.form,
            algorithmId: state.algorithmId,
            waterAlgorithmId: state.waterAlgorithmId,
            algorithmInputs: state.algorithmInputs,
            waterAlgorithmInputs: state.waterAlgorithmInputs,
            continueWater: $('continueWater').checked
        });
    }

    /* ---------- rendering ---------- */

    function isSingleWater(x, y) {
        if (!state.grid.isWaterAt(x, y)) return false;
        return !state.grid.neighbors(x, y)
            .some(([nx, ny]) => state.grid.isWaterAt(nx, ny));
    }

    // A single cell description for every hex: assigned terrain shows its color,
    // water and not-yet-colored land render as plain white (the water look comes
    // from the renderer omitting grid lines between adjacent water hexes).
    function cellFor(x, y) {
        const value = state.grid.get(x, y);
        const isWater = value === WATER;
        const hasColor = state.showColors && value !== WATER && value !== UNASSIGNED;
        return {
            fill: hasColor ? displayColor(value) : '#ffffff',
            stroke: '#222',
            strokeWidth: 2,
            isWater,
            marker: isSingleWater(x, y) ? 'water' : null
        };
    }

    // Editing requires a selection on the wheel first (a terrain color, or the
    // water icon in the center). Clicking a hex applies the selected value;
    // clicking a hex that already holds it clears the hex back to unassigned.
    function onHexClick(x, y) {
        if (state.paintValue === null) return;
        $('preset').value = '';
        const next = state.grid.get(x, y) === state.paintValue ? UNASSIGNED : state.paintValue;
        state.grid.set(x, y, next);
        renderCurrent();
    }

    function renderCurrent() {
        state.lastSize = TM.renderer.render(svg, {
            width: state.grid.width,
            height: state.grid.height,
            form: state.grid.form,
            cellFor,
            onClick: onHexClick
        });
        applyZoom();
        updateStats();
        updateUi();
    }

    /* ---------- zoom ---------- */

    // Scale only the displayed SVG size; the viewBox stays intact so exports and
    // click coordinates are unaffected.
    function applyZoom() {
        if (!state.lastSize) return;
        svg.style.width = (state.lastSize.width * state.zoom) + 'px';
        svg.style.height = (state.lastSize.height * state.zoom) + 'px';
        $('zoomLevel').textContent = Math.round(state.zoom * 100) + '%';
    }

    function setZoom(z) {
        state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
        applyZoom();
    }

    // Shrink (or grow) the map so the whole thing fits the visible canvas area,
    // accounting for the 24px svg margin on each side.
    function fitZoom() {
        if (!state.lastSize) return;
        const wrap = $('canvasWrap');
        const margin = 48;
        const availW = wrap.clientWidth - margin;
        const availH = wrap.clientHeight - margin;
        const z = Math.min(availW / state.lastSize.width, availH / state.lastSize.height);
        setZoom(z > 0 ? z : 1);
    }

    /* ---------- terrain wheel ---------- */

    // Reference widget: one dot per terrain value 1-7 (which is wheel order),
    // placed clockwise from the top in the color the renderer actually paints.
    // One step around the wheel is one spade.
    function renderColorWheel() {
        const ring = $('colorWheel');
        const step = 360 / TM.terrain.TERRAINS.length;
        ring.textContent = '';
        TM.terrain.TERRAINS.forEach((value, i) => {
            const angle = (i * step - 90) * Math.PI / 180;
            const dot = document.createElement('div');
            dot.className = 'wheel-dot';
            if (value === state.paintValue) dot.classList.add('selected');
            dot.style.background = displayColor(value);
            dot.style.left = (50 + WHEEL_RADIUS * Math.cos(angle)) + '%';
            dot.style.top = (50 + WHEEL_RADIUS * Math.sin(angle)) + '%';
            dot.title = 'Click to select this terrain, then click hexes to apply it. Click a hex again to clear it.';
            dot.onclick = () => selectPaintColor(value);
            ring.appendChild(dot);
        });

        // The water icon sits in the center: selecting it paints water instead.
        const water = document.createElement('div');
        water.className = 'wheel-dot wheel-water';
        if (state.paintValue === WATER) water.classList.add('selected');
        water.style.left = '50%';
        water.style.top = '50%';
        water.title = 'Click to select water, then click hexes to turn them into water. Click a water hex again to clear it.';
        water.innerHTML = WATER_ICON_SVG;
        water.onclick = () => selectPaintColor(WATER);
        ring.appendChild(water);
    }

    // Pick a wheel value to edit with (a terrain color or water); clicking the
    // active one clears the selection.
    function selectPaintColor(value) {
        state.paintValue = state.paintValue === value ? null : value;
        renderColorWheel();
        renderCurrent();
    }

    /* ---------- stats & UI ---------- */

    function updateStats() {
        const total = state.grid.nHexes();
        $('statW').textContent = state.grid.width;
        $('statH').textContent = state.grid.height;
        $('statForm').textContent = state.grid.form;
        $('statTotal').textContent = total;
        $('statLand').textContent = total - state.grid.count(WATER);
        $('statWater').textContent = state.grid.count(WATER);
    }

    function hasTerrain() {
        return state.grid.landCoordinates()
            .some(([x, y]) => state.grid.get(x, y) !== UNASSIGNED);
    }

    function updateUi() {
        const terrainGenerated = hasTerrain();
        // The BGA and snellman formats only exist once colors are set.
        $('copyBga').disabled = !terrainGenerated;
        $('copySnellman').disabled = !terrainGenerated;
        $('exportSnellman').disabled = !terrainGenerated;
        $('exportHint').textContent = terrainGenerated
            ? 'Terrain colors are set. The terrain map, BGA and snellman formats are ready to export.'
            : 'Exporting the current layout. Paint or generate colors to also export the terrain map, BGA and snellman formats.';

        $('toggleColors').innerHTML = cubeIconSvg(state.showColors);

        // Mirror the current wheel selection in the zoom box so the active edit
        // color (or the water icon) is always visible next to the map.
        const selection = $('selectionColor');
        if (state.paintValue === null) {
            selection.innerHTML = '';
            selection.style.background = 'transparent';
            selection.classList.remove('active');
            selection.title = 'No edit color selected \u2013 pick one on the terrain wheel.';
        } else if (state.paintValue === WATER) {
            selection.innerHTML = WATER_ICON_SVG;
            selection.style.background = '#fff';
            selection.classList.add('active');
            selection.title = 'Water is selected for editing.';
        } else {
            selection.innerHTML = '';
            selection.style.background = displayColor(state.paintValue);
            selection.classList.add('active');
            selection.title = 'This terrain color is selected for editing.';
        }

        $('paintStatus').textContent = state.paintValue !== null
            ? (state.paintValue === WATER
                ? 'Water selected \u2013 click hexes to turn them into water. Click a water hex again to clear it.'
                : 'Terrain selected \u2013 click hexes to apply it. Click a matching hex again to clear it.')
            : 'Pick a terrain color or the water icon on the wheel, then click hexes to edit them.';
    }

    /* ---------- reading the controls ---------- */

    function readDimensions() {
        const width = Math.max(1, Math.min(40, +$('width').value || 13));
        const height = Math.max(1, Math.min(40, +$('height').value || 9));
        const form = +$('form').value === 1 ? 1 : 0;
        $('width').value = width;
        $('height').value = height;
        return { width, height, form };
    }

    /* ---------- actions ---------- */

    function clearPreset() {
        $('preset').value = '';
    }

    function newEmptyMap() {
        state.grid = new TM.MapGrid(readDimensions());
        clearPreset();
        renderCurrent();
        saveUiPreferences();
    }

    // Rebuild the grid for new dimensions while preserving what the user has
    // already drawn: cells whose coordinates still exist are carried over (the
    // MapGrid constructor drops out-of-bounds ones and fills new hexes with
    // UNASSIGNED). Unlike "New empty map" this never wipes the current layout.
    function resizeGridPreserving(dimensions) {
        state.grid = new TM.MapGrid({ ...dimensions, cells: state.grid.toGrid() });
        clearPreset();
        renderCurrent();
        saveUiPreferences();
    }

    function restoreDefaults() {
        TM.storage.clearUiPreferences();
        window.location.reload();
    }

    // The single explicit full reset: every cell back to unassigned land.
    // Unlike "New empty map" this ignores the width/height inputs, so a size
    // typed but not applied stays unapplied.
    function resetGrid() {
        state.grid.reset();
        clearPreset();
        renderCurrent();
    }

    function applyLayout(layout) {
        state.grid = new TM.MapGrid(layout);
        $('width').value = state.grid.width;
        $('height').value = state.grid.height;
        $('form').value = state.grid.form;
        renderCurrent();
        saveUiPreferences();
    }

    async function runWaterAlgorithm() {
        const dimensions = readDimensions();
        const continueFromCurrentLayout = $('continueWater').checked;
        // use existing grid on continue, init MapGrid on new generation
        let grid;
        if (continueFromCurrentLayout) {
            grid = state.grid;
        } else {
            grid = new TM.MapGrid(dimensions);
        }
        const algorithm = getSelectedWaterAlgorithm();
        const inputs = inputValues(algorithm, state.waterAlgorithmInputs);
        // Make the working grid current before the algorithm can yield and
        // request a redraw through TM.app.renderCurrent().
        state.grid = grid;
        clearPreset();
        const layout = await TM.layout.randomizeWater(
            grid,
            state.waterAlgorithmId,
            inputs,
            { cont: continueFromCurrentLayout ? 1 : 0 }
        );
        state.grid = layout;
        renderCurrent();
    }

    function terrainAlgorithms() {
        return TM.algorithms.filter(a => a.target === 'terrain');
    }

    function inputDefinitions(algorithm) {
        return algorithm && Array.isArray(algorithm.inputs) ? algorithm.inputs : [];
    }

    function inputValues(algorithm, valuesByAlgorithm) {
        return TM.resolveAlgorithmInputs(algorithm, valuesByAlgorithm[algorithm.id]);
    }

    function formatInputValue(input, value) {
        const decimals = String(input.step || '').split('.')[1];
        return decimals ? value.toFixed(decimals.length) : String(value);
    }

    function renderAlgorithmInputs(containerId, algorithm, valuesByAlgorithm) {
        const container = $(containerId);
        container.textContent = '';
        if (!algorithm) return;

        const values = valuesByAlgorithm[algorithm.id] || (valuesByAlgorithm[algorithm.id] = {});
        inputDefinitions(algorithm).forEach((input, index) => {
            const value = Number.isFinite(values[input.key]) ? values[input.key] : input.value;
            values[input.key] = value;

            const field = document.createElement('label');
            field.className = 'algorithm-input';
            const caption = document.createElement('span');
            caption.textContent = input.label;

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = containerId + '-' + algorithm.id + '-' + index;
            slider.min = input.min;
            slider.max = input.max;
            slider.step = input.step || 1;
            slider.value = value;

            const output = document.createElement('output');
            output.htmlFor = slider.id;
            output.textContent = formatInputValue(input, value);
            slider.oninput = () => {
                const nextValue = Number(slider.value);
                values[input.key] = nextValue;
                output.textContent = formatInputValue(input, nextValue);
                saveUiPreferences();
            };

            field.append(caption, output, slider);
            container.appendChild(field);
        });
    }

    function getSelectedAlgorithm() {
        const terrain = terrainAlgorithms();
        return terrain.find(a => a.id === state.algorithmId) || terrain[0];
    }

    function getSelectedWaterAlgorithm() {
        const water = TM.layout.waterAlgorithms();
        return water.find(a => a.id === state.waterAlgorithmId) || water[0];
    }

    // The zoom-window icon toggles terrain colors on/off (water-only view).
    function toggleColorsFromIcon() {
        state.showColors = !state.showColors;
        renderCurrent();
    }

    function generateColors() {
        readDimensions();
        const grid = state.grid;
        const algorithm = getSelectedAlgorithm();
        grid.generate(algorithm, inputValues(algorithm, state.algorithmInputs));
        renderCurrent();
    }

    /* ---------- export helpers ---------- */

    function download(name, data, type) {
        const blob = new Blob([data], { type });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    function exportedSvg() {
        const clone = svg.cloneNode(true);
        clone.style.width = '';
        clone.style.height = '';
        clone.querySelectorAll('.label').forEach(e => (e.textContent = ''));
        clone.querySelectorAll('.selected-hex').forEach(e => e.remove());
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
    }

    function exportPng() {
        const url = URL.createObjectURL(new Blob([exportedSvg()], { type: 'image/svg+xml' }));
        const img = new Image();
        img.onload = () => {
            const scale = 2;
            const canvas = document.createElement('canvas');
            canvas.width = svg.viewBox.baseVal.width * scale;
            canvas.height = svg.viewBox.baseVal.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob(blob => download('terra-mystica-map.png', blob, 'image/png'));
        };
        img.src = url;
    }

    function mapData() {
        return TM.export.toJson({
            mode: hasTerrain() ? 'colored' : 'edit',
            grid: state.grid,
            algorithmId: state.algorithmId
        });
    }

    function feedback(button, text) {
        const original = button.textContent;
        button.textContent = text;
        setTimeout(() => (button.textContent = original), 900);
    }

    /* ---------- wire up controls ---------- */

    function fillPresetDropdown() {
        const select = $('preset');
        const labels = TM.layout.presetLabels();
        Object.keys(labels).forEach(id => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = labels[id];
            select.appendChild(option);
        });
    }

    function fillAlgorithmDropdown() {
        const select = $('algorithm');
        const algorithms = terrainAlgorithms();
        algorithms.forEach(algorithm => {
            const option = document.createElement('option');
            option.value = algorithm.id;
            option.textContent = algorithm.label;
            option.title = algorithm.description;
            select.appendChild(option);
        });
        if (!algorithms.some(algorithm => algorithm.id === state.algorithmId)) {
            state.algorithmId = algorithms.length ? algorithms[0].id : null;
        }
        select.value = state.algorithmId || '';
        // Nothing to choose with one algorithm, but keep it visible.
        select.disabled = algorithms.length < 2;
        describeSelectedAlgorithm();
        renderAlgorithmInputs('algorithmInputs', getSelectedAlgorithm(), state.algorithmInputs);
    }

    function fillWaterAlgorithmDropdown() {
        const select = $('waterAlgorithm');
        const algorithms = TM.layout.waterAlgorithms();
        algorithms.forEach(algorithm => {
            const option = document.createElement('option');
            option.value = algorithm.id;
            option.textContent = algorithm.label;
            option.title = algorithm.description || '';
            select.appendChild(option);
        });
        if (!algorithms.some(algorithm => algorithm.id === state.waterAlgorithmId)) {
            state.waterAlgorithmId = algorithms.length ? algorithms[0].id : null;
        }
        select.value = state.waterAlgorithmId || '';
        // Nothing to choose with one algorithm, but keep it visible.
        select.disabled = algorithms.length < 2;
        renderAlgorithmInputs('waterAlgorithmInputs', getSelectedWaterAlgorithm(), state.waterAlgorithmInputs);
    }

    function selectWaterAlgorithm(id) {
        const found = TM.layout.waterAlgorithms().find(a => a.id === id);
        if (found) state.waterAlgorithmId = id;
        $('waterAlgorithm').value = state.waterAlgorithmId || '';
        renderAlgorithmInputs('waterAlgorithmInputs', getSelectedWaterAlgorithm(), state.waterAlgorithmInputs);
        saveUiPreferences();
    }

    function describeSelectedAlgorithm() {
        const algorithm = getSelectedAlgorithm();
        $('algorithm').title = algorithm && algorithm.description
            ? algorithm.description
            : 'Which algorithm distributes the terrain colors over the land hexes.';
    }

    function selectAlgorithm(id) {
        const found = TM.algorithms.find(a => a.id === id);
        if (found) state.algorithmId = id;
        $('algorithm').value = state.algorithmId || '';
        describeSelectedAlgorithm();
        renderAlgorithmInputs('algorithmInputs', getSelectedAlgorithm(), state.algorithmInputs);
        // If the map is already colored, re-run so the effect is visible at once.
        if (hasTerrain()) generateColors();
        saveUiPreferences();
    }

    function init() {
        restoreUiPreferences();
        fillPresetDropdown();
        fillAlgorithmDropdown();
        fillWaterAlgorithmDropdown();
        renderColorWheel();

        $('newMap').onclick = newEmptyMap;
        $('restoreDefaults').onclick = restoreDefaults;
        $('generateColors').onclick = generateColors;
        $('toggleColors').onclick = toggleColorsFromIcon;

        $('preset').onchange = (event) => {
            const layout = TM.layout.getPreset(event.target.value);
            if (layout) {
                applyLayout(layout);
            } else {
                renderCurrent();
            }
        };

        $('form').onchange = () => {
            resizeGridPreserving(readDimensions());
        };

        // Redraw the map immediately as the size changes, without forcing the
        // input value back mid-typing (so the caret / partial entry is kept).
        const liveResize = () => {
            const width = Math.max(1, Math.min(40, +$('width').value || 13));
            const height = Math.max(1, Math.min(40, +$('height').value || 9));
            resizeGridPreserving({ width, height, form: state.grid.form });
        };
        $('width').oninput = liveResize;
        $('height').oninput = liveResize;

        $('algorithm').onchange = (event) => selectAlgorithm(event.target.value);

        $('waterAlgorithm').onchange = (event) => selectWaterAlgorithm(event.target.value);

        $('resetWater').onclick = resetGrid;

        $('randomWater').onclick = runWaterAlgorithm;
        $('continueWater').onchange = saveUiPreferences;

        $('zoomIn').onclick = () => setZoom(state.zoom * 1.2);
        $('zoomOut').onclick = () => setZoom(state.zoom / 1.2);
        $('zoomFit').onclick = fitZoom;

        $('exportSvg').onclick = () => download('terra-mystica-map.svg', exportedSvg(), 'image/svg+xml');
        $('exportPng').onclick = exportPng;
        $('exportJson').onclick = () => download('terra-mystica-map.json', JSON.stringify(mapData(), null, 2), 'application/json');
        $('copyJson').onclick = async () => {
            await navigator.clipboard.writeText(JSON.stringify(mapData()));
            feedback($('copyJson'), 'Copied!');
        };
        $('copyBga').onclick = async () => {
            if (!hasTerrain() || !state.grid) return;
            await navigator.clipboard.writeText(TM.export.bgaFormat(state.grid));
            feedback($('copyBga'), 'Copied!');
        };
        $('exportSnellman').onclick = () => {
            if (!hasTerrain() || !state.grid) return;
            download('terra-mystica-map.snellman.txt', TM.export.snellmanFormat(state.grid), 'text/plain');
        };
        $('copySnellman').onclick = async () => {
            if (!hasTerrain() || !state.grid) return;
            await navigator.clipboard.writeText(TM.export.snellmanFormat(state.grid));
            feedback($('copySnellman'), 'Copied!');
        };

        readDimensions();
        renderCurrent();
    }

    TM.app = { renderCurrent };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window.TM = window.TM || {});
