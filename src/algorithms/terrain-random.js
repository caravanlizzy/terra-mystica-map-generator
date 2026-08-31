/*
 * Algorithms live in this folder. Each file registers one algorithm object in
 * the shared TM.algorithms array:
 *
 *   { id, name, label, target, description, ... }
 *
 *   id      unique string
 *   name    human readable name (label is kept as an alias for the UI)
 *   target  'terrain'  → colors the land hexes, exposes fill(grid)
 *           'water'    → generates the water layout, exposes run(grid)
 *
 * Terrain algorithms (target: 'terrain') get a reset MapGrid and must assign a
 * terrain color to every land hex before returning. They show up automatically
 * in the terrain "Algorithm" dropdown; water algorithms show up in the water
 * dropdown next to "Random water".
 *
 * ── MapGrid API (what you can call inside fill) ─────────────────────────────
 *
 *   grid.landCoordinates()        → [[x, y], …]   all land (non-water) hexes
 *   grid.neighbors(x, y)          → [[x, y], …]   in-bounds neighbors (up to 6)
 *   grid.get(x, y)                → value          current cell value
 *   grid.set(x, y, value)                          assign a terrain color
 *   grid.isWaterAt(x, y)          → bool           true for water hexes
 *   grid.count(value)             → number         how many cells hold value
 *   grid.snapshot() / restore(s)                   save & reload all cells
 *
 * ── Color values ────────────────────────────────────────────────────────────
 *
 *   TM.terrain.TERRAINS  [1, 2, 3, 4, 5, 6, 7]  (black, blue, green, grey, red, yellow, brown)
 *   TM.terrain.UNASSIGNED -1     land hex not yet assigned
 *   TM.terrain.WATER       0     finished water hex (read-only inside fill)
 *
 * ── Utility helpers ─────────────────────────────────────────────────────────
 *
 *   TM.utils.pick(array)          → element   random element
 *   TM.utils.shuffle(array)       → array     new shuffled copy (no mutation)
 */
(function (TM) {
    'use strict';

    const { TERRAINS } = TM.terrain;
    const { pick } = TM.utils;

	function rndint(max) {
		return Math.floor(Math.random() * max);
	}

    TM.algorithms = TM.algorithms || [];
    TM.algorithms.push({
        id: 'random',
        label: 'Random colors',
        target: 'terrain',
        description: 'Every land hex gets a uniformly random terrain color, independent of its neighbors.',
        fill(grid) {
			// ######################### variables we need while running the algorithm and dont want to pass around the whole time
			let g = grid; 	// the grid from the UI that we currently need to calculate grid.rowWidth()
			let sizefactor = g.nHexes() / 113.;;

			let cells = [];		// terrain information as 2d array		
			let adjsx = []; // list of adjacent cells for each cell (that is excluding the border)
			let adjsy = [];
			let adjcols = []; // list per cell of number of each adjacent color
			let landcellsx = [];
			let landcellsy = [];

			let adjship1x = []; // for any given cell a list of all the other cells that are within ship1 reach
			let adjship1y = [];
			let shipscan = [];	// used to store progress in ship1 search

			let centersx = [0,0,0,0,0,0,0,0]; // stores the center of mass of every color
			let centersy = [0,0,0,0,0,0,0,0];
			let optcenter = g.centerOfMass(); // [x,y] array storing optimal center of mass
			let centersfail = 0;

			let ncolorborder = [0,0,0,0,0,0,0,0]; // how many of that color are at the border
			let totalborder = g.nBorderHexes(); // need to know
			let colorborderfail = 0;

			let countfails = 0; // total number of each color deviations
			let adjfails = 0; // no two colors adjacent
			let neighfails = 0; // there should not be one color triply incident to the same hex. with > 4 neighb. there should be 4 diff colors, with >
			let ship1fails = 0; 

			let clusterscan = []; // temp state for color+next2colors cluster recognition
			let opclusters = [0,0,0,0,0,0,0,0];
			let goodclusters = [0,0,0,0,0,0,0,0];
			let decentclusters = [0,0,0,0,0,0,0,0];
			let clusteropfail = 0;
			let clustergoodfail = 0;
			let clusterdecentfail = 0;

			let extclusters = [];		// similar to colorclusters but including ship1
			let extclusterfail = 0;
			
			let colcounts = [];		// counts the total number of hexes of each color
			let curenergy = 0; // stores current energy
			

			let optavg = (g.nHexes() - g.count(0)) / 7.;
			
			let optcounts = [g.count(0),optavg,optavg,optavg,optavg,optavg,optavg,optavg];  // optimal envisioned number of terrains
			
			cells = []; adjsx = []; adjsy = []; adjcols = [];
			// generate the field
			for (let j = 0; j < grid.height; j++) {
				cells.push([]);
				clusterscan.push([]);
				for (let i = 0; i < grid.rowWidth(j); i++) {
					let col = 0;
					if (g.get(i,j) != 0) col = 1 + rndint(7); // + rndint(7)
					cells[j].push(col);
					clusterscan[j].push(0);
				}
			}
			// calculate the neighbour geometry
			for (let y = 0; y < g.height; y++) {
				adjsx.push([]); adjsy.push([]);
				for (let x = 0; x < g.rowWidth(y); x++) {				
					adjsx[y].push([]); adjsy[y].push([]);
					for (let i = 0; i < 6; i++) {
						let ncoord = g.neighbor(x,y,i);
						let nx = ncoord[0], ny = ncoord[1];
						if (g.outOfBounds(nx,ny)) continue;					
						adjsx[y][x].push(nx);
						adjsy[y][x].push(ny);
					}
				}
			}
			
			
			
			findland();
			calcship1();
			
			// first calculation of energy
			curenergy = colorenergy();
			
			// now optimize
			let noptsteps = 30000 * sizefactor * Math.max(1,sizefactor);
			for (let k = 0; k < noptsteps; k++) {
				optimizecolor();
				console.log("curenergy", curenergy);
			}		
			
			
			// translating it back to the grid
			
            for (const [x, y] of grid.landCoordinates()) {
                grid.set(x, y, cells[y][x]);
            }
			
			// ############# function storage below, totally professional
			
			function optimizecolor() {
				updaterandomcolor();
				swaprandomcolor();					
			}


			function colorenergy() {
				precalc();
				calcadjfails();
				calccentersfail();
				calccolorclusters();
				calcship1fails();
				calccolorborderfail();
				calcextclusters();

				let sum = 0;
				
				for (let i = 1; i < 8; i++) {
					sum += 3 * Math.abs(colcounts[i] - optcounts[i]);		// incentivizes optimal color count
				}
				sum += 3 * adjfails; // penalizes same colors being adjacent
				sum	+= 5 * neighfails; // penalizes the neighbourhood being too uniform
				sum += centersfail; // penalize uneven distribution of colors spatially
				sum += 3 * clusteropfail + clustergoodfail + 0.015 * clusterdecentfail;	// penalizes large clusters of color+(colors that are adjacent in color-circle)
				sum += 2 * ship1fails; // this penalizes ship1 same color neighbors  (honestly this doesnt look super good since it doesnt seem to penalize if the distribution among the colors is bad, it just reduces total ship1 adjacencies)
				sum += 2 * colorborderfail;  // penalizes uneven distribution of border hex among the colors
				sum += 1.5 * extclusterfail; // penalizes clusters but clusters with ship1
				
				return sum;// + rnd()*2;
			}

			function precalc() { // do somewhat unified pre calculations for energy:
				// centers
				for (let k = 0; k < 8; k++) {
					centersx[k] = 0;
					centersy[k] = 0;
				}
				// total number of colors
				colcounts = [0,0,0,0,0,0,0,0];
				// colors on the border;
				ncolorborder = [0,0,0,0,0,0,0,0];
				// adjcolors per cell
				adjcols = [];
				for (let y = 0; y < g.height; y++) {
					adjcols[y] = [];
					for (let x = 0; x < g.rowWidth(y); x++) {
						let c = cells[y][x];
						// //counts
						colcounts[c]++;
						// color adjacencies
						let ncol = [0,0,0,0,0,0,0,0];
						for (let i = 0; i < adjsx[y][x].length; i++) {
							ncol[cells[adjsy[y][x][i] ][adjsx[y][x][i] ]]++;
						}
						adjcols[y][x] = ncol.slice();
						if (adjsx[y][x].length < 6) ncolorborder[c]++;
						// centers
						centersx[c] += x;
						centersy[c] += y;			
					 }
				 }
				for (let k = 0; k < 8; k++) {
					centersx[k] = centersx[k] / colcounts[k]; 
					centersy[k] = centersy[k] / colcounts[k]; 
				}	
			}

			function calcship1fails() {
				ship1fails = 0;
				for (let i = 0; i < landcellsx.length; i++) {
					let x = landcellsx[i], y = landcellsy[i];
					let c = cells[y][x];
					let sum = 0;
					let sadjx = adjship1x[y][x], sadjy = adjship1y[y][x];
					for (let j = 0; j < sadjx.length; j++) {
						if (cells[sadjy[j]][sadjx[j]] != c) continue;
						sum += 1;
					}
					if (sum > 1) ship1fails += (sum - 1);
				}
			}

			function calccolorborderfail() { // hier muss man noch was automatisieren die 40 macht mich skeptisch
				colorborderfail = 0; 
				let av = (totalborder - ncolorborder[0])/7.;
				for (let i = 1; i < 8; i++) {
					colorborderfail += 4 * (ncolorborder[i] - av) ** 2
				}
			}
			
			function calccentersfail() { 
				let sum = 0;
				for (let k = 1; k < 8; k++) {
					sum += Math.abs(centersx[k] - optcenter[0]) ** 2;
					sum += Math.abs(centersy[k] - optcenter[1]) ** 2; //think its good to square as it also should be balanced
				}
				centersfail = sum;
			}
			
			function calcadjfails() {
				adjfails = 0;
				neighfails = 0;

				for (let j = 0; j < grid.height; j++) {
					for (let i = 0; i < grid.rowWidth(j); i++) {
						if (cells[j][i] == 0) continue; // do water seperately
						adjfailscell(i,j);
					}
				}
			}

			function adjfailscell(x,y) { // only called for non water
				let c = cells[y][x];
				let sum = 0;

				let ncol = adjcols[y][x];
				
				if (ncol[c] > 0) adjfails += ncol[c];
				
				let ndif = 0; // how many different colors appear
				let nn = 0; // number of neighbours
				for (let i = 1; i < 8; i++) {
					if (ncol[i] == 0) continue;
					ndif++;
					nn += ncol[i];
					if (ncol[i] >= 3) neighfails++; // three times is too much
				}
				if ((nn >= 5) && (ndif < 4)) neighfails++;  // too few different neighbor colors
				if ((nn == 4) && (ndif < 3)) neighfails++;  // same but for hex really at the boundary
			}
			

			function calccolorclusters() {
				clusteropfail = 0;
				clustergoodfail = 0;
				clusterdecentfail = 0;
				let clustergoodaverage = 0, clusterdecentaverage = 0;
				for (let c0 = 1; c0 < 8; c0++) {
					opclusters[c0] = 0;
					goodclusters[c0] = 0;
					decentclusters[c0] = 0;
					let c1 = (c0 == 1 ? 7 : c0 - 1);
					let c2 = (c0 == 7 ? 1 : c0 + 1);
					findcolorclusters(c0,c1,c2);
					clusteropfail += opclusters[c0] * 6;
					clustergoodaverage += goodclusters[c0];
					clusterdecentaverage += decentclusters[c0];
				}
				for (let c0 = 1; c0 < 8; c0++) {
					clustergoodfail += (clustergoodaverage/7. - goodclusters[c0])**2;
					clusterdecentfail += Math.abs(clusterdecentaverage/7. - decentclusters[c0])**2;
				}
			}
			function findcolorclusters(c0,c1,c2) { //c0 is the main color and c1, c2 are its neighbours
				for (let j = 0; j < grid.height; j++) {
					for (let i = 0; i < grid.rowWidth(j); i++) {
						clusterscan[j][i] = 0;
					}
				}
				for (let k = 0; k < landcellsx.length; k++) {
					let y = landcellsy[k], x = landcellsx[k];
					if (clusterscan[y][x] == 1) continue;
					let s = reccolorcluster(x,y,c0,c1,c2,0);
					if (s > 5) opclusters[c0]++;
					else if (s > 4) goodclusters[c0]++;
					if (s > 3) decentclusters[c0]++;		
				}
			}
			function reccolorcluster(x,y,c0,c1,c2,score) {
				if (g.outOfBounds(x,y)) return score; // this cell aint existin
				if (clusterscan[y][x] == 1) return score; // already scanned
				clusterscan[y][x] = 1; // scanned this
				let s = score;
				let c = cells[y][x];
				if (c == c0) s += 2;
				else if (c == c1) s += 1;
				else if (c == c2) s += 1;
				else return s; // not of the right color
				for (let i = 0; i < adjsx[y][x].length; i++) {
					s = reccolorcluster(adjsx[y][x][i],adjsy[y][x][i],c0,c1,c2,s);
				}
				return s;
			}			

			// extended clusters are like colorclusters but incoorporate ship1
			function calcextclusters() {
				extclusterfail = 0;
				for (let c0 = 1; c0 < 8; c0++) {
					extclusters[c0] = [];
					let c1 = (c0 == 1 ? 7 : c0 - 1);
					let c2 = (c0 == 7 ? 1 : c0 + 1);
					findextclusters(c0,c1,c2);
				}
				for (let c = 1; c < 8; c++) {
					for (let kk in extclusters[c]) {
						//if (kk >= 10) extclusterfail += 2+5*extclusters[c][kk];
						extclusterfail += .5* Math.max(0, kk - 7) ** 2 * extclusters[c][kk];
					}
				}
			}
			function findextclusters(c0,c1,c2) { //c0 is the main color and c1, c2 are its neighbours
				for (let j = 0; j < grid.height; j++) {
					for (let i = 0; i < grid.rowWidth(j); i++) {
						clusterscan[j][i] = 0;
					}
				}
				for (let k = 0; k < landcellsx.length; k++) {
					let y = landcellsy[k], x = landcellsx[k];
					if (clusterscan[y][x] == 1) continue;
					let s = recextcluster(x,y,c0,c1,c2,0);
					if (!extclusters[c0][s]) extclusters[c0][s] = 1;
					else extclusters[c0][s]++;
					// if (s > 5) opclusters[c0]++;
					// else if (s > 4) goodclusters[c0]++;
					// if (s > 3) decentclusters[c0]++;		
				}
			}
			function recextcluster(x,y,c0,c1,c2,score) {
				if (g.outOfBounds(x,y)) return score; // this cell aint existin
				if (clusterscan[y][x] == 1) return score; // already scanned
				clusterscan[y][x] = 1; // scanned this
				let s = score;
				let c = cells[y][x];
				if (c == c0) s += 2;
				else if (c == c1) s += 1;
				else if (c == c2) s += 1;
				else return s; // not of the right color
				for (let i = 0; i < adjship1x[y][x].length; i++) {
					s = recextcluster(adjship1x[y][x][i],adjship1y[y][x][i],c0,c1,c2,s);
				}
				return s;
			}


			function updaterandomcolor() {
				let ix = rndint(landcellsx.length);
				let y = landcellsy[ix];
				let x = landcellsx[ix]; 
				let c = cells[y][x];
				
				let newc = 1 + rndint(6); // not water, not same
				if (newc >= c) newc++;
				
				cells[y][x] = newc;
				
				let newenergy = colorenergy();
				
				if (newenergy + (Math.random()-.5) >= curenergy) { // need to change back, old stuff won
					cells[y][x] = c;
				} else {
					curenergy = newenergy; // keep the new energy
					// changecount++;
				}		
			}
			function swaprandomcolor() {
				let ix1 = rndint(landcellsx.length);
				let ix2 = rndint(landcellsx.length - 1);
				if (ix2 >= ix1) ix2++; // pick a different index
				
				let y1 = landcellsy[ix1];
				let x1 = landcellsx[ix1];
				let y2 = landcellsy[ix2];
				let x2 = landcellsx[ix2]; 
				let c1 = cells[y1][x1];
				let c2 = cells[y2][x2];
				if (c1 == c2) return;
				
				let newc1 = c2, newc2 = c1;
				cells[y1][x1] = c2; cells[y2][x2] = c1;
				
				let newenergy = colorenergy();
				
				if (newenergy > curenergy) { // need to change back, old stuff won
					cells[y1][x1] = c1; cells[y2][x2] = c2;
				} else {
					curenergy = newenergy; // keep the new energy
					// changecount++;
				}	
			}
			
			function findland() { // generates the landcellsx,y array for faster randomizing of colors
				landcellsx = []; landcellsy = [];
				for (let y = 0; y < g.height; y++) {
					for (let x = 0; x < g.rowWidth(y); x++) {	
						if (cells[y][x] == 0) continue;
						landcellsx.push(x); landcellsy.push(y);
					}
				}
			}			
			
			// I think this somehow counts ship1 adjacency but I havent checked
			function calcship1() {
				adjship1x = []; adjship1y = [];
				shipscan = [];

				for (let y = 0; y < g.height; y++) {
					shipscan[y] = []
					for (let x = 0; x < g.rowWidth(y); x++) {	
						shipscan[y][x] = 0;
					}
				}

				for (let y = 0; y < g.height; y++) {
					adjship1x[y] = []; adjship1y[y] = [];
					for (let x = 0; x < g.rowWidth(y); x++) {	
						let c = cells[y][x];
						if (c == 0) continue;
						let scannedx = [x], scannedy = [y]; // store which ones we scanned and reset them afterwards
						shipscan[y][x] = 1; // dont reach ourselves
						for (let i = 0; i < adjsx[y][x].length; i++) {
							let nx = adjsx[y][x][i], ny = adjsy[y][x][i];
							if (cells[ny][nx] != 0) continue; // cant ship over land can we
							for (let j = 0; j < adjsx[ny][nx].length; j++) { // second neighbours
								let n2x = adjsx[ny][nx][j], n2y = adjsy[ny][nx][j];
								if (cells[n2y][n2x] == 0) continue; // dont want to ship to water
								if (shipscan[n2y][n2x] == 1) continue; // we already counted this
								shipscan[n2y][n2x] = 1;
								scannedx.push(n2x); scannedy.push(n2y);
							}
						}
						adjship1x[y][x] = scannedx.slice(1); adjship1y[y][x] = scannedy.slice(1); // save everything but yourself
						for (let i = 0; i < scannedx.length; i++) {
							shipscan[scannedy[i]][scannedx[i]] = 0;
						}
					}
				}
			}			
			
        }
    });
})(window.TM = window.TM || {});



// (function (TM) {
    // 'use strict';

    // const { TERRAINS } = TM.terrain;
    // const { pick } = TM.utils;

    // TM.algorithms = TM.algorithms || [];
    // TM.algorithms.push({
        // id: 'random',
        // label: 'Random colors',
        // target: 'terrain',
        // description: 'Every land hex gets a uniformly random terrain color, independent of its neighbors.',
        // fill(grid) {
            // for (const [x, y] of grid.landCoordinates()) {
                // grid.set(x, y, pick(TERRAINS));
            // }
        // }
    // });
// })(window.TM = window.TM || {});