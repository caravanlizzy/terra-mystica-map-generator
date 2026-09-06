/*
 * MapGrid - the board every algorithm works on: cell values (see terrain.js),
 * shape, neighborhood queries and the export formats.
 */
(function (TM) {
    'use strict';

    const { UNASSIGNED, isWater } = TM.terrain;
    const { rowWidth, outOfBounds, nextHex } = TM.hexGrid;

    // Supply every declared algorithm input, using its configured default when
    // the caller has not provided a finite numeric value.
    function resolveAlgorithmInputs(algorithm, inputOverrides) {
        const providedInputOverrides = inputOverrides || {};
        return (algorithm.inputs || []).reduce((resolved, input) => {
            resolved[input.key] = Number.isFinite(providedInputOverrides[input.key])
                ? providedInputOverrides[input.key]
                : input.value;
            return resolved;
        }, {});
    }

    class MapGrid {
        // layout: { width, height, form, cells? }, with cells as a row-by-row
        // grid of numeric terrain values.
        constructor(layout) {
            this.width = layout.width;
            this.height = layout.height;
            this.form = layout.form;
            this.cells = [];
            this.reset();
            (layout.cells || []).forEach((row, y) => {
                row.forEach((value, x) => {
                    if (!this.outOfBounds(x, y)) this.set(x, y, value);
                });
            });
        }

        /* ---------------- shape ---------------- */

        rowWidth(y) { return rowWidth(this.width, y, this.form); }
        outOfBounds(x, y) { return outOfBounds(x, y, this.width, this.height, this.form); }
        neighbor(x, y, dir) { return nextHex(x, y, dir, this.form); }
        nHexes() { return totalHexes(this.width, this.height, this.form); }

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

        get(x, y) { return this.cells[y][x]; }
        set(x, y, value) { this.cells[y][x] = value; }

        // Value at (x, y), or '' when off the board.
        at(x, y) { return this.outOfBounds(x, y) ? '' : this.get(x, y); }

        // Clear every cell to unassigned land.
        reset() {
            this.cells = [];
            for (let y = 0; y < this.height; y++) {
                this.cells.push(Array(this.rowWidth(y)).fill(UNASSIGNED));
            }
        }

        // Remove terrain assignments while retaining the current water layout.
        resetLand() {
            this.forEachCoordinate((x, y) => {
                if (!this.isWaterAt(x, y)) this.set(x, y, UNASSIGNED);
            });
        }

        // Every coordinate, row by row.
        forEachCoordinate(visit) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.rowWidth(y); x++) visit(x, y);
            }
        }

       // some algorithms may want to know the center of mass
        centerOfMass() {
			let sx = 0, sy = 0, n = 0;
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.rowWidth(y); x++) {
					sx += x; sy += y; n++;
				}
            }
			return [sx / n, sy / n];
        }

		// number of border hex
        nBorderHexes() {
			let n = 0;
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.rowWidth(y); x++) {
					if (this.neighbors(x,y).length <= 5) n++;
				}
            }
			return n;
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
            this.cells.forEach(row => {
                row.forEach(cell => {
                    if (cell === value) total++;
                });
            });
            return total;
        }

        isWaterAt(x, y) { return isWater(this.at(x, y)); }

        // Water coordinates derived from the canonical cell values.
        waterCoordinates() {
            const coordinates = [];
            this.forEachCoordinate((x, y) => {
                if (this.isWaterAt(x, y)) coordinates.push([x, y]);
            });
            return coordinates;
        }

        /* ---------------- copying ---------------- */

        snapshot() { return this.cells.map(row => row.slice()); }
        restore(snapshot) { this.cells = snapshot.map(row => row.slice()); }

        /* ---------------- exports ---------------- */

        // 2D array of cell values, row by row (rows vary in length).
        toGrid() {
            return this.cells.map(row => row.slice());
        }

        // Fill the grid with a terrain algorithm.
        generate(algorithm, inputs) {
            this.resetLand();
            algorithm.fill(this, resolveAlgorithmInputs(algorithm, inputs));
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
    TM.resolveAlgorithmInputs = resolveAlgorithmInputs;
})(window.TM = window.TM || {});
