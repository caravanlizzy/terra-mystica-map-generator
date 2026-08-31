/*
 * Export helpers. Serialises MapGrid and app state to the supported output
 * formats. Depends on colors.js (bgaSymbol) but not on any UI/DOM code.
 */
(function (TM) {
    'use strict';

    const { bgaSymbol } = TM.colors;

    // Board Game Arena map-file format from a MapGrid instance.
    function bgaFormat(grid) {
        return grid.toGrid()
            .map(row => row.map(bgaSymbol).join(','))
            .join('\n');
    }

    // Juho Snellman's Terra Mystica engine map format (the `size:` + `landscape:`
    // sections of a saved game at terra.snellman.net), so the generated map can
    // replace the map in a save fed to the AI. The board is kept rectangular:
    // short rows are padded with `N` and indented with a leading space, and every
    // row ends with a trailing comma, matching the engine's own output.
    function snellmanFormat(grid) {
        const lines = [
            'size:',
            grid.width + ',' + grid.height + ',' + (grid.form === 1 ? 'true' : 'false'),
            '',
            'landscape:'
        ];
        grid.toGrid().forEach(cells => {
            const row = cells.map(bgaSymbol);
            const isShort = row.length < grid.width;
            while (row.length < grid.width) row.push('N');
            lines.push((isShort ? ' ' : '') + row.join(',') + ',');
        });
        return lines.join('\n');
    }

    // Plain-object representation of the current app state, suitable for JSON
    // serialisation. `state` must expose { width, height, form, water,
    // mode, grid, algorithmId }.
    function toJson(state) {
        const data = {
            width: state.width,
            height: state.height,
            form: state.form,
            waterCoordinates: [...state.water].map(k => k.split(',').map(Number))
        };
        if (state.mode === 'colored' && state.grid) {
            data.colors = state.grid.toGrid();
            data.bga = bgaFormat(state.grid);
            data.snellman = snellmanFormat(state.grid);
            data.algorithm = state.algorithmId;
        }
        return data;
    }

    TM.export = { bgaFormat, snellmanFormat, toJson };
})(window.TM = window.TM || {});

