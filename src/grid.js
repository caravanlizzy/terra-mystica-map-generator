/*
 * MapGrid - the board every algorithm works on: cell values (see colors.js),
 * shape, neighborhood queries and the export formats.
 */
(function (TM) {
    'use strict';

    const { WATER, UNASSIGNED, isWater, bgaSymbol } = TM.colors;
    const { rowWidth, outOfBounds, nextHex } = TM.geometry;

    class MapGrid {
        // layout: { width, height, form, rivers? }, rivers being [x, y] pairs
        // or "x,y" strings.
        constructor(layout) {
            this.width = layout.width;
            this.height = layout.height;
            this.form = layout.form;
            this.rivers = new Set((layout.rivers || [])
                .map(r => (Array.isArray(r) ? MapGrid.key(r[0], r[1]) : String(r))));
            this.cells = {}; // "x,y" -> cell value
            this.reset();
        }

        static key(x, y) { return x + ',' + y; }
        static parseKey(key) { return key.split(',').map(Number); }

        /* ---------------- shape ---------------- */

        rowWidth(y) { return rowWidth(this.width, y, this.form); }
        outOfBounds(x, y) { return outOfBounds(x, y, this.width, this.height, this.form); }
        neighbor(x, y, dir) { return nextHex(x, y, dir, this.form); }

        // In-bounds neighbors of (x, y), as [x, y] pairs.
        neighbors(x, y) {
            const result = [];
            for (let dir = 0; dir < 6; dir++) {
                const [nx, ny] = this.neighbor(x, y, dir);
                if (!this.outOfBounds(nx, ny)) result.push([nx, ny]);
            }
            return result;
        }

        /* ---------------- cells ---------------- */

        get(x, y) { return this.cells[MapGrid.key(x, y)]; }
        set(x, y, value) { this.cells[MapGrid.key(x, y)] = value; }

        // Value at (x, y), or '' when off the board.
        at(x, y) { return this.outOfBounds(x, y) ? '' : this.get(x, y); }

        // All hexes start UNASSIGNED; water hexes start as WATER directly.
        reset() {
            this.cells = {};
            this.forEachCoordinate((x, y) => {
                this.set(x, y, this.rivers.has(MapGrid.key(x, y)) ? WATER : UNASSIGNED);
            });
        }

        // Every coordinate, row by row.
        forEachCoordinate(visit) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.rowWidth(y); x++) visit(x, y);
            }
        }

        // The non-water hexes, i.e. those that get a terrain color.
        landCoordinates() {
            const result = [];
            this.forEachCoordinate((x, y) => {
                if (!isWater(this.get(x, y))) result.push([x, y]);
            });
            return result;
        }

        // Hexes currently carrying `value`.
        count(value) {
            let total = 0;
            for (const key in this.cells) if (this.cells[key] === value) total++;
            return total;
        }

        isWaterAt(x, y) { return isWater(this.at(x, y)); }

        /* ---------------- copying ---------------- */

        snapshot() { return Object.assign({}, this.cells); }
        restore(snapshot) { this.cells = Object.assign({}, snapshot); }

        /* ---------------- exports ---------------- */

        // 2D array of cell values, row by row (rows vary in length).
        toGrid() {
            const rows = [];
            for (let y = 0; y < this.height; y++) {
                const row = [];
                for (let x = 0; x < this.rowWidth(y); x++) row.push(this.get(x, y));
                rows.push(row);
            }
            return rows;
        }

        // Board Game Arena map-file format.
        bgaFormat() {
            return this.toGrid()
                .map(row => row.map(bgaSymbol).join(','))
                .join('\n');
        }

        // Fill the grid with a terrain algorithm.
        generate(algorithm) {
            this.reset();
            algorithm.fill(this);
            return this;
        }
    }

    // Total hexes on a board of this shape.
    function totalHexes(width, height, form) {
        let total = 0;
        for (let y = 0; y < height; y++) total += rowWidth(width, y, form);
        return total;
    }

    TM.MapGrid = MapGrid;
    TM.totalHexes = totalHexes;
})(window.TM = window.TM || {});
