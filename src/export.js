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
            data.algorithm = state.algorithmId;
        }
        return data;
    }

    TM.export = { bgaFormat, toJson };
})(window.TM = window.TM || {});

