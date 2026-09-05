/*
 * Application controller: wires the DOM controls to the services and renderer.
 *
 * Two modes: 'edit' draws the water layout (a click toggles land / water) and
 * 'colored' shows terrain colors (click two land hexes to swap them).
 */
(function (TM) {
    'use strict';

    const { WATER } = TM.terrain;
    const { displayColor } = TM.colors;

    const svg = document.getElementById('map');
    const $ = (id) => document.getElementById(id);

    const state = {
        width: 13,
        height: 9,
        form: 0,
        water: new Set(),    // "x,y" of water hexes (edit mode)
        mode: 'edit',        // 'edit' | 'colored'
        grid: null,          // TM.MapGrid instance for a colored view
        selected: [],        // [[x, y], ...] land hexes picked for a swap
        algorithmId: null,   // the terrain algorithm chosen in the header
        waterAlgorithmId: null, // the water algorithm chosen in the map editor
        zoom: 1,             // display scale for the rendered map
        lastSize: null       // intrinsic canvas size from the last render
    };

    const ZOOM_MIN = 0.1;
    const ZOOM_MAX = 4;

    const WHEEL_RADIUS = 35;   // terrain wheel: distance from center, in %

    const key = (x, y) => x + ',' + y;
    /* ---------- rendering ---------- */

    function isSingleWater(x, y) {
        if (state.mode === 'colored' && state.grid) {
            if (!state.grid.isWaterAt(x, y)) return false;
            const neighbors = state.grid.neighbors(x, y);
            return !neighbors.some(([nx, ny]) => state.grid.isWaterAt(nx, ny));
        } else {
            if (!state.water.has(key(x, y))) return false;
            for (let dir = 0; dir < 6; dir++) {
                const [nx, ny] = TM.hexGrid.nextHex(x, y, dir, state.form);
                if (!TM.hexGrid.outOfBounds(nx, ny, state.width, state.height, state.form)) {
                    if (state.water.has(key(nx, ny))) return false;
                }
            }
            return true;
        }
    }

    function editCell(x, y) {
        const isWater = state.water.has(key(x, y));
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
        state.grid = null;
        state.selected = [];
        $('preset').value = '';
        const k = key(x, y);
        if (state.water.has(k)) state.water.delete(k);
        else state.water.add(k);
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
        const colored = state.mode === 'colored' && state.grid;
        state.lastSize = TM.renderer.render(svg, {
            width: state.width,
            height: state.height,
            form: state.form,
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
        const total = TM.totalHexes(state.width, state.height, state.form);
        $('statW').textContent = state.width;
        $('statH').textContent = state.height;
        $('statForm').textContent = state.form;
        $('statTotal').textContent = total;
        $('statLand').textContent = total - state.water.size;
        $('statWater').textContent = state.water.size;
    }

    function updateModeUi() {
        const colored = state.mode === 'colored';
        const hasTerrain = Boolean(state.grid);
        $('editHint').style.display = hasTerrain ? 'none' : 'block';
        $('swapHint').style.display = hasTerrain ? 'block' : 'none';
        // The BGA and snellman formats only exist once colors are generated.
        $('copyBga').disabled = !colored;
        $('copySnellman').disabled = !colored;
        $('exportSnellman').disabled = !colored;
        // Layout editing is only meaningful in edit mode.
        $('randomWater').disabled = colored;
        $('resetWater').disabled = colored;
        $('toggleTerrain').disabled = !state.grid;
        $('toggleTerrain').setAttribute('aria-pressed', String(colored));
        $('toggleTerrain').setAttribute('aria-label', colored ? 'Show river layout' : 'Show terrain colors');
        $('toggleTerrain').title = colored ? 'Show river layout' : 'Show terrain colors';
        $('generateColors').textContent = 'Generate colors';
        $('exportHint').textContent = hasTerrain
            ? 'Terrain colors are available. Switch to terrain view to export the terrain map, BGA or snellman format.'
            : 'Exporting the current layout. Generate colors to also export the terrain map, BGA and snellman formats.';

        if (hasTerrain) {
            $('swapStatus').textContent = colored && state.selected.length === 1
                ? 'One hex selected – click a second land hex to swap.'
                : 'In terrain view, click two land hexes to swap them.';
        } else {
            $('swapStatus').textContent = '';
        }
    }

    /* ---------- reading the controls ---------- */

    function readDimensions() {
        state.width = Math.max(1, Math.min(40, +$('width').value || 13));
        state.height = Math.max(1, Math.min(40, +$('height').value || 9));
        state.form = +$('form').value === 1 ? 1 : 0;
        $('width').value = state.width;
        $('height').value = state.height;
    }

    /* ---------- actions ---------- */

    function enterEditMode(clearPreset, clearColors) {
        state.mode = 'edit';
        state.selected = [];
        if (clearColors) state.grid = null;
        if (clearPreset) {
            $('preset').value = '';
        }
    }

    function newEmptyMap() {
        readDimensions();
        state.water.clear();
        enterEditMode(true, true);
        renderCurrent();
    }

    // Every water hex back to land. Unlike "New empty map" this ignores the
    // width/height inputs, so a size typed but not applied stays unapplied.
    function resetWater() {
        state.water.clear();
        enterEditMode(true, true);
        renderCurrent();
    }

    function applyLayout(layout) {
        const showTerrain = state.mode === 'colored';
        state.width = layout.width;
        state.height = layout.height;
        state.form = layout.form;
        state.water = layout.water instanceof Set
            ? new Set(layout.water)
            : new Set((layout.water || []).map(item => Array.isArray(item) ? key(item[0], item[1]) : String(item)));
        enterEditMode(false, true);
        if (layout.terrain) state.grid = presetColorGrid(layout);
        if (showTerrain && state.grid) state.mode = 'colored';
        $('width').value = state.width;
        $('height').value = state.height;
        $('form').value = state.form;
        renderCurrent();
    }

    function currentLayout() {
        return {
            width: state.width,
            height: state.height,
            form: state.form,
            water: [...state.water].map(k => k.split(',').map(Number))
        };
    }

    function terrainAlgorithms() {
        return TM.algorithms.filter(a => a.target === 'terrain');
    }

    function getSelectedAlgorithm() {
        const terrain = terrainAlgorithms();
        return terrain.find(a => a.id === state.algorithmId) || terrain[0];
    }

    function generateColors() {
        readDimensions();
        const grid = new TM.MapGrid(currentLayout());
        grid.generate(getSelectedAlgorithm());
        state.grid = grid;
        state.selected = [];
        state.mode = 'colored';
        renderCurrent();
    }

    function presetColorGrid(layout) {
        const grid = new TM.MapGrid(layout);
        layout.terrain.forEach((row, y) => {
            for (let x = 0; x < grid.rowWidth(y); x++) {
                grid.set(x, y, row[x]);
            }
        });
        return grid;
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
            width: state.width,
            height: state.height,
            form: state.form,
            water: state.water,
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
        state.algorithmId = algorithms.length ? algorithms[0].id : null;
        select.value = state.algorithmId || '';
        // Nothing to choose with one algorithm, but keep it visible.
        select.disabled = algorithms.length < 2;
        describeSelectedAlgorithm();
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
        state.waterAlgorithmId = algorithms.length ? algorithms[0].id : null;
        select.value = state.waterAlgorithmId || '';
        // Nothing to choose with one algorithm, but keep it visible.
        select.disabled = algorithms.length < 2;
    }

    function selectWaterAlgorithm(id) {
        const found = TM.layout.waterAlgorithms().find(a => a.id === id);
        if (found) state.waterAlgorithmId = id;
        $('waterAlgorithm').value = state.waterAlgorithmId || '';
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
        // Switching on a colored map re-runs it, so the effect is visible at once.
        if (state.mode === 'colored') generateColors();
    }

    function init() {
        fillPresetDropdown();
        fillAlgorithmDropdown();
        fillWaterAlgorithmDropdown();
        renderColorWheel();

        $('newMap').onclick = newEmptyMap;
        $('generateColors').onclick = generateColors;

        $('preset').onchange = (event) => {
            const layout = TM.layout.getPreset(event.target.value);
            if (layout) {
                applyLayout(layout);
            } else {
                enterEditMode(true, true);
                renderCurrent();
            }
        };

        $('toggleTerrain').onclick = () => {
            if (!state.grid) return;
            state.mode = state.mode === 'colored' ? 'edit' : 'colored';
            state.selected = [];
            renderCurrent();
        };

        $('form').onchange = () => {
            readDimensions();
            enterEditMode(true, true);
            renderCurrent();
        };

        // Redraw the map immediately as the size changes, without forcing the
        // input value back mid-typing (so the caret / partial entry is kept).
        const liveResize = () => {
            state.width = Math.max(1, Math.min(40, +$('width').value || 13));
            state.height = Math.max(1, Math.min(40, +$('height').value || 9));
            enterEditMode(true, true);
            renderCurrent();
        };
        $('width').oninput = liveResize;
        $('height').oninput = liveResize;

        $('algorithm').onchange = (event) => selectAlgorithm(event.target.value);

        $('waterAlgorithm').onchange = (event) => selectWaterAlgorithm(event.target.value);

        $('resetWater').onclick = resetWater;

        $('randomWater').onclick = () => {
            readDimensions();
			// niklas attacked his
            // const grid = new TM.MapGrid({ width: state.width, height: state.height, form: state.form });
            const grid = state.grid ? state.grid : new TM.MapGrid({ width: state.width, height: state.height, form: state.form });
            applyLayout(TM.layout.randomizeWater(grid, state.waterAlgorithmId));
        };

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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window.TM = window.TM || {});
