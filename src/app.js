/*
 * Application controller: wires the DOM controls to the services and renderer.
 *
 * Two modes: 'edit' draws the water layout (a click toggles land / water) and
 * 'colored' shows terrain colors (click two land hexes to swap them).
 */
(function (TM) {
    'use strict';

    const { WATER, UNASSIGNED } = TM.terrain;
    const { displayColor } = TM.colors;

    const svg = document.getElementById('map');
    const $ = (id) => document.getElementById(id);

    const state = {
        mode: 'edit',        // 'edit' | 'colored'
        grid: new TM.MapGrid({ width: 13, height: 9, form: 0 }),
        selected: [],        // [[x, y], ...] land hexes picked for a swap
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

    function editCell(x, y) {
        const isWater = state.grid.isWaterAt(x, y);
        return {
            fill: '#ffffff',
            stroke: '#222',
            strokeWidth: 2,
            isWater,
            marker: isSingleWater(x, y) ? 'water' : null
        };
    }

    function coloredCell(x, y) {
        const value = state.grid.get(x, y);
        const isWater = value === WATER;
        return {
            fill: displayColor(value),
            stroke: '#333',
            strokeWidth: 2,
            isWater,
            selected: state.selected.some(([sx, sy]) => sx === x && sy === y),
            marker: isSingleWater(x, y) ? 'water' : null
        };
    }

    function onEditClick(x, y) {
        state.selected = [];
        $('preset').value = '';
        if (hasTerrain()) state.grid.resetLand();
        state.grid.set(x, y, state.grid.isWaterAt(x, y) ? UNASSIGNED : WATER);
        renderCurrent();
    }

    function onColoredClick(x, y) {
        if (state.grid.get(x, y) === WATER) return; // water cannot be swapped

        const index = state.selected.findIndex(([sx, sy]) => sx === x && sy === y);
        if (index >= 0) {
            state.selected.splice(index, 1); // click again to deselect
            renderCurrent();
            return;
        }

        state.selected.push([x, y]);
        if (state.selected.length === 2) {
            swapSelected();
        }
        renderCurrent();
    }

    function swapSelected() {
        const [[ax, ay], [bx, by]] = state.selected;
        const a = state.grid.get(ax, ay);
        state.grid.set(ax, ay, state.grid.get(bx, by));
        state.grid.set(bx, by, a);
        state.selected = [];
    }

    function renderCurrent() {
        const colored = state.mode === 'colored';
        state.lastSize = TM.renderer.render(svg, {
            width: state.grid.width,
            height: state.grid.height,
            form: state.grid.form,
            cellFor: colored ? coloredCell : editCell,
            onClick: colored ? onColoredClick : onEditClick
        });
        applyZoom();
        updateStats();
        updateModeUi();
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
            dot.style.background = displayColor(value);
            dot.style.left = (50 + WHEEL_RADIUS * Math.cos(angle)) + '%';
            dot.style.top = (50 + WHEEL_RADIUS * Math.sin(angle)) + '%';
            ring.appendChild(dot);
        });
    }

    /* ---------- stats & mode UI ---------- */

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

    function updateModeUi() {
        const colored = state.mode === 'colored';
        const terrainGenerated = hasTerrain();
        $('editHint').style.display = terrainGenerated ? 'none' : 'block';
        $('swapHint').style.display = terrainGenerated ? 'block' : 'none';
        // The BGA and snellman formats only exist once colors are generated.
        $('copyBga').disabled = !colored;
        $('copySnellman').disabled = !colored;
        $('exportSnellman').disabled = !colored;
        // Layout editing is only meaningful in edit mode.
        $('randomWater').disabled = colored;
        $('continueWater').disabled = colored;
        $('resetWater').disabled = colored;
        $('toggleTerrain').disabled = !terrainGenerated;
        $('toggleTerrain').setAttribute('aria-pressed', String(colored));
        $('toggleTerrain').setAttribute('aria-label', colored ? 'Show river layout' : 'Show terrain colors');
        $('toggleTerrain').title = colored ? 'Show river layout' : 'Show terrain colors';
        $('generateColors').textContent = 'Generate colors';
        $('exportHint').textContent = terrainGenerated
            ? 'Terrain colors are available. Switch to terrain view to export the terrain map, BGA or snellman format.'
            : 'Exporting the current layout. Generate colors to also export the terrain map, BGA and snellman formats.';

        if (terrainGenerated) {
            $('swapStatus').textContent = colored && state.selected.length === 1
                ? 'One hex selected – click a second land hex to swap.'
                : 'In terrain view, click two land hexes to swap them.';
        } else {
            $('swapStatus').textContent = '';
        }
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

    function enterEditMode(clearPreset) {
        state.mode = 'edit';
        state.selected = [];
        if (clearPreset) {
            $('preset').value = '';
        }
    }

    function newEmptyMap() {
        state.grid = new TM.MapGrid(readDimensions());
        enterEditMode(true);
        renderCurrent();
        saveUiPreferences();
    }

    function restoreDefaults() {
        TM.storage.clearUiPreferences();
        window.location.reload();
    }

    // Every water hex back to land. Unlike "New empty map" this ignores the
    // width/height inputs, so a size typed but not applied stays unapplied.
    function resetWater() {
        state.grid.reset();
        enterEditMode(true);
        renderCurrent();
    }

    function applyLayout(layout) {
        state.grid = new TM.MapGrid(layout);
        state.mode = hasTerrain() ? 'colored' : 'edit';
        state.selected = [];
        $('width').value = state.grid.width;
        $('height').value = state.grid.height;
        $('form').value = state.grid.form;
        renderCurrent();
        saveUiPreferences();
    }

    async function runWaterAlgorithm() {
        const dimensions = readDimensions();
        const continueFromCurrentLayout = $('continueWater').checked;
        const grid = continueFromCurrentLayout
            ? state.grid
            : new TM.MapGrid(dimensions);
        const algorithm = getSelectedWaterAlgorithm();
        const inputs = inputValues(algorithm, state.waterAlgorithmInputs);
        // Make the working grid current before the algorithm can yield and
        // request a redraw through TM.app.renderCurrent().
        state.grid = grid;
        enterEditMode(true);
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

    function generateColors() {
        readDimensions();
        const grid = state.grid;
        const algorithm = getSelectedAlgorithm();
        grid.generate(algorithm, inputValues(algorithm, state.algorithmInputs));
        state.selected = [];
        state.mode = 'colored';
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
            mode: state.mode,
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
        // Switching on a colored map re-runs it, so the effect is visible at once.
        if (state.mode === 'colored') generateColors();
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

        $('preset').onchange = (event) => {
            const layout = TM.layout.getPreset(event.target.value);
            if (layout) {
                applyLayout(layout);
            } else {
                enterEditMode(true);
                renderCurrent();
            }
        };

        $('toggleTerrain').onclick = () => {
            if (!hasTerrain()) return;
            state.mode = state.mode === 'colored' ? 'edit' : 'colored';
            state.selected = [];
            renderCurrent();
        };

        $('form').onchange = () => {
            state.grid = new TM.MapGrid(readDimensions());
            enterEditMode(true);
            renderCurrent();
            saveUiPreferences();
        };

        // Redraw the map immediately as the size changes, without forcing the
        // input value back mid-typing (so the caret / partial entry is kept).
        const liveResize = () => {
            const width = Math.max(1, Math.min(40, +$('width').value || 13));
            const height = Math.max(1, Math.min(40, +$('height').value || 9));
            state.grid = new TM.MapGrid({ width, height, form: state.grid.form });
            enterEditMode(true);
            renderCurrent();
            saveUiPreferences();
        };
        $('width').oninput = liveResize;
        $('height').oninput = liveResize;

        $('algorithm').onchange = (event) => selectAlgorithm(event.target.value);

        $('waterAlgorithm').onchange = (event) => selectWaterAlgorithm(event.target.value);

        $('resetWater').onclick = resetWater;

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
            if (state.mode !== 'colored' || !state.grid) return;
            await navigator.clipboard.writeText(TM.export.bgaFormat(state.grid));
            feedback($('copyBga'), 'Copied!');
        };
        $('exportSnellman').onclick = () => {
            if (state.mode !== 'colored' || !state.grid) return;
            download('terra-mystica-map.snellman.txt', TM.export.snellmanFormat(state.grid), 'text/plain');
        };
        $('copySnellman').onclick = async () => {
            if (state.mode !== 'colored' || !state.grid) return;
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
