/*
 * Application controller: wires the DOM controls to the services and renderer.
 *
 * Two modes: 'edit' draws the river layout (a click toggles land / river),
 * 'colored' shows the generated terrains (click two land hexes to swap them).
 */
(function (TM) {
    'use strict';

    const { WATER, displayColor } = TM.colors;

    const svg = document.getElementById('map');
    const $ = (id) => document.getElementById(id);

    const LAND_COLOR = '#faedbf';   // land, in edit mode
    const RIVER_COLOR = '#4aa9e8';  // river, in edit mode

    const state = {
        width: 13,
        height: 9,
        form: 0,
        rivers: new Set(),   // "x,y" of river hexes (edit mode)
        mode: 'edit',        // 'edit' | 'colored'
        grid: null,          // TM.MapGrid instance (colored mode)
        selected: [],        // [[x, y], ...] land hexes picked for a swap
        algorithmId: null    // the algorithm chosen in the header
    };

    const key = (x, y) => x + ',' + y;

    /* ---------- rendering ---------- */

    function editCell(x, y) {
        const river = state.rivers.has(key(x, y));
        return {
            fill: river ? RIVER_COLOR : LAND_COLOR,
            stroke: river ? '#0b3c5d' : '#222',
            strokeWidth: 1,
            label: x + ',' + y,
            labelColor: river ? '#fff' : '#222'
        };
    }

    function coloredCell(x, y) {
        return {
            fill: displayColor(state.grid.get(x, y)),
            selected: state.selected.some(([sx, sy]) => sx === x && sy === y)
        };
    }

    function onEditClick(x, y) {
        const k = key(x, y);
        if (state.rivers.has(k)) state.rivers.delete(k);
        else state.rivers.add(k);
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
        TM.renderer.render(svg, {
            width: state.width,
            height: state.height,
            form: state.form,
            cellFor: colored ? coloredCell : editCell,
            onClick: colored ? onColoredClick : onEditClick
        });
        updateStats();
        updateModeUi();
    }

    /* ---------- stats & mode UI ---------- */

    function updateStats() {
        const total = TM.totalHexes(state.width, state.height, state.form);
        $('statW').textContent = state.width;
        $('statH').textContent = state.height;
        $('statForm').textContent = state.form;
        $('statTotal').textContent = total;
        $('statLand').textContent = total - state.rivers.size;
        $('statRiver').textContent = state.rivers.size;
        $('landSwatch').style.background = LAND_COLOR;
    }

    function updateModeUi() {
        const colored = state.mode === 'colored';
        $('editHint').style.display = colored ? 'none' : 'block';
        $('swapHint').style.display = colored ? 'block' : 'none';
        $('backToLayout').style.display = colored ? 'inline-block' : 'none';
        // The BGA format only exists once colors are generated.
        $('copyBga').disabled = !colored;
        // Layout editing is only meaningful in edit mode.
        $('randomRivers').disabled = colored;
        $('resetRivers').disabled = colored;
        // Keep the primary action self-describing.
        $('generateColors').textContent = colored ? 'Regenerate colors' : 'Generate colors';
        $('exportHint').textContent = colored
            ? 'Exporting the generated terrain map. SVG/PNG capture the current view; JSON and BGA include the colors.'
            : 'Exporting the current layout. Generate colors to also export the terrain map and BGA format.';

        if (colored) {
            $('swapStatus').textContent = state.selected.length === 0
                ? 'Click two land hexes to swap them.'
                : 'One hex selected – click a second land hex to swap.';
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

    function enterEditMode() {
        state.mode = 'edit';
        state.grid = null;
        state.selected = [];
    }

    function newEmptyMap() {
        readDimensions();
        state.rivers.clear();
        enterEditMode();
        renderCurrent();
    }

    // Every river hex back to land. Unlike "New empty map" this ignores the
    // width/height inputs, so a size typed but not applied stays unapplied.
    function resetRivers() {
        state.rivers.clear();
        enterEditMode();
        renderCurrent();
    }

    function applyLayout(layout) {
        state.width = layout.width;
        state.height = layout.height;
        state.form = layout.form;
        state.rivers = new Set(layout.rivers.map(([x, y]) => key(x, y)));
        enterEditMode();
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
            rivers: [...state.rivers].map(k => k.split(',').map(Number))
        };
    }

    function getSelectedAlgorithm() {
        return TM.algorithms.find(a => a.id === state.algorithmId) || TM.algorithms[0];
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

    function backToLayout() {
        enterEditMode();
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
        clone.querySelectorAll('.label').forEach(e => (e.textContent = ''));
        clone.querySelectorAll('.hex').forEach(e => {
            e.setAttribute('stroke', '#333');
            e.setAttribute('stroke-width', '1');
        });
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
        const layout = currentLayout();
        const data = {
            width: layout.width,
            height: layout.height,
            form: layout.form,
            riverCoordinates: layout.rivers
        };
        if (state.mode === 'colored' && state.grid) {
            data.colors = state.grid.toGrid();
            data.bga = state.grid.bgaFormat();
            data.algorithm = state.algorithmId;
        }
        return data;
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
        TM.algorithms.forEach(algorithm => {
            const option = document.createElement('option');
            option.value = algorithm.id;
            option.textContent = algorithm.label;
            option.title = algorithm.description;
            select.appendChild(option);
        });
        state.algorithmId = TM.algorithms.length ? TM.algorithms[0].id : null;
        select.value = state.algorithmId || '';
        // Nothing to choose with one algorithm, but keep it visible.
        select.disabled = TM.algorithms.length < 2;
        describeSelectedAlgorithm();
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

        $('newMap').onclick = newEmptyMap;
        $('generateColors').onclick = generateColors;
        $('backToLayout').onclick = backToLayout;

        $('preset').onchange = (event) => {
            const layout = TM.layout.getPreset(event.target.value);
            if (layout) applyLayout(layout);
            event.target.value = '';
        };

        $('form').onchange = () => { readDimensions(); renderCurrent(); };

        $('algorithm').onchange = (event) => selectAlgorithm(event.target.value);

        $('resetRivers').onclick = resetRivers;

        $('randomRivers').onclick = () => {
            readDimensions();
            applyLayout(TM.layout.randomizeRivers(state.width, state.height, state.form));
        };

        $('exportSvg').onclick = () => download('terra-mystica-map.svg', exportedSvg(), 'image/svg+xml');
        $('exportPng').onclick = exportPng;
        $('exportJson').onclick = () => download('terra-mystica-map.json', JSON.stringify(mapData(), null, 2), 'application/json');
        $('copyJson').onclick = async () => {
            await navigator.clipboard.writeText(JSON.stringify(mapData()));
            feedback($('copyJson'), 'Copied!');
        };
        $('copyBga').onclick = async () => {
            if (state.mode !== 'colored' || !state.grid) return;
            await navigator.clipboard.writeText(state.grid.bgaFormat());
            feedback($('copyBga'), 'Copied!');
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
