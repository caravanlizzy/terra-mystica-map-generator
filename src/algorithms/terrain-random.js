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
 
 
 /* some comparative data:
 land degree sequences:
	original:		[ 0, 3, 24, 26, 48, 6, 6 ]
	fire and ice:	[ 0, 2, 18, 29, 51, 9, 3 ]
	fjords:			[ 0, 5, 16, 29, 47, 4, 12 ]
	loon lakes:		[ 0, 3, 16, 39, 30, 24, 0 ]
	archipelago:	[ 0, 5, 25, 27, 39, 7, 10 ]


	// neigh diversity 
	// 0 | 3	// original
	// 0 | 0 | 18
	// 0 | 0 | 1 | 20
	// 0 | 0 | 1 | 5 | 17
	// 0 | 0 | 0 | 0 | 2 | 4
	// 0 | 0 | 0 | 0 | 4 | 2 | 0
	// 0 | 2 //fire and ice
	// 0 | 0 | 18	
	// 0 | 0 | 2 | 17
	// 0 | 0 | 0 | 14 | 12
	// 0 | 0 | 0 | 0 | 4 | 5
	// 0 | 0 | 0 | 0 | 0 | 3 | 0
	// 0 | 5	// fjords
	// 0 | 0 | 14
	// 0 | 0 | 2 | 19
	// 0 | 0 | 0 | 4 | 20
	// 0 | 0 | 0 | 0 | 2 | 2
	// 0 | 0 | 0 | 0 | 2 | 9 | 1
	// 0 | 3	// loon lakes
	// 0 | 0 | 13
	// 0 | 0 | 2 | 28
	// 0 | 0 | 0 | 4 | 14
	// 0 | 0 | 0 | 0 | 4 | 9
	// 0 | 0 | 0 | 0 | 0 | 0 | 0
	// 0 | 5	// archipelago
	// 0 | 0 | 19
	// 0 | 0 | 0 | 14
	// 0 | 0 | 0 | 7 | 15
	// 0 | 0 | 0 | 1 | 4 | 2
	// 0 | 0 | 0 | 0 | 3 | 6 | 1

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
        inputs: [
            { key: 'iterations', label: 'Optimisation steps', min: 0, max: 30000, step: 1000, value: 0 }
        ],
        async fill(grid, inputs, options = {}) {
			// ######################### variables we need while running the algorithm and dont want to pass around the whole time
			let g = grid; 	// the grid from the UI that we currently need to calculate grid.rowWidth()
			let sizefactor = g.nHexes() / 113.;

			let cells = [];		// terrain information as 2d array		
			let adjsx = []; // list of adjacent cells for each cell (that is excluding the border)
			let adjsy = [];
			let adjcols = []; // list per cell of number of each adjacent color
			let landcellsx = [];
			let landcellsy = [];
			let landdegrees = []; // number of land hex with given adjacency degree 0-6

			let adjship1x = []; // for any given cell a list of all the other cells that are within ship1 reach
			let adjship1y = [];
			let adjship1cols = []; // list per cell of number of each adjacent color with ship1
			let shipscan = [];	// used to store progress in ship1 search
			let adjextx = []; // extended is the union of land and ship1 neighbour hood 
			let adjexty = [];
			let adjextcols = []; // 
			let adj2x = [], adj2y = []; // for land hex a list of all land hexes that are exactly 2 steps away (interesting for fakirs and dwarfs)
	
			let step2pairs = [];		// for each color the number of step2 (flight distance) pairs

			let centersx = [0,0,0,0,0,0,0,0]; // stores the center of mass of every color
			let centersy = [0,0,0,0,0,0,0,0];
			let optcenter = g.centerOfMass(); // [x,y] array storing optimal center of mass
			let centerdist = [0,0,0,0,0,0,0,0]; // stores the distance of each colors center of mass to the center of the map
			let centersfail = 0;
			let avdist = [0,0,0,0,0,0,0,0]; // stores the average distance to center
			let optdist = 0; // land average distance

			let corex = []; // the  coordinates of the land hex that we consider to be in the core of the map
			let corey = []; 
			let corecols = [0,0,0,0,0,0,0,0];	// color counts in the core
			let corecolmin = 0, corecolmax = 0; // minimum and maximum number of core hexes per color
			
			let ncolorborder = [0,0,0,0,0,0,0,0]; // how many of that color are at the border
			let totalborder = g.nBorderHexes(); // need to know
			let bordercolmin = 0, bordercolmax = 0; // minimum and maximum number of border hexes per color
			let colorborderfail = 0;

			let countfails = 0; // total number of each color deviations
			let adjfails = 0; // no two colors adjacent
			let triplefails = 0; // number of patterns XAX with A = X+/-1
			let marcfails = 0; // number of patterns XAX with A = X+/-3
			let neighfails = 0; // counts the number of hex that have the same color three times as neighbor
			let neighextfails = 0; // counts the number of hex that have the same color three times as neighbor with ship1
			let neighdivs = []; 	// 2d array... counts the occurrence for every hex degree of different adjcolors 
			
			
			let ship1fails = 0; 

			let clusterscan = []; // temp state for color+next2colors cluster recognition
			let opclusters = [0,0,0,0,0,0,0,0];
			let goodclusters = [0,0,0,0,0,0,0,0];
			let decentclusters = [0,0,0,0,0,0,0,0];
			let clusteropfail = 0;
			let clustergoodfail = 0;
			let clusterdecentfail = 0;
			let colorclusters = []; // for each color the number of clusters of certain size

			let extclusters = [];		// similar to colorclusters but including ship1
			let extclusterfail = 0;
			
			let colcounts = [];		// counts the total number of hexes of each color
			let curenergy = 0; // stores current energy
			

			let optavg = (g.nHexes() - g.count(0)) / 7.;
			
			let optcounts = [g.count(0),optavg,optavg,optavg,optavg,optavg,optavg,optavg];  // optimal envisioned number of terrains
			

			cells = []; adjsx = []; adjsy = []; adjcols = [];
			// generate the field
			let landcount = 0;
			for (let j = 0; j < grid.height; j++) {
				cells.push([]);
				clusterscan.push([]);
				for (let i = 0; i < grid.rowWidth(j); i++) {
					let col = 0;
					if (!options.continueFromCurrentLayout) {
						if (g.get(i,j) !== 0) col =  1 + Math.floor(landcount++/optavg); // 1 + rndint(7);
					} else {
						col = g.get(i,j);
					}
					cells[j].push(col);
					clusterscan[j].push(0);
				}
			}
			// prepare neighdivs and landdegrees
			for (let i = 0; i <= 6; i++) {
				landdegrees[i] = 0;
				neighdivs[i] = [];
				for (let j = 0; j <= i; j++) {
					neighdivs[i][j] = 0;
				}
			}
			// calculate the neighbour geometry
			for (let y = 0; y < g.height; y++) {
				adjsx.push([]); adjsy.push([]);
				adj2x.push([]); adj2y.push([]);
				for (let x = 0; x < g.rowWidth(y); x++) {				
					adjsx[y].push([]); adjsy[y].push([]);
					adj2x[y].push([]); adj2y[y].push([]);
					let nland = 0; // count land neighbors
					for (let i = 0; i < 6; i++) {
						let ncoord = g.neighbor(x,y,i);
						let nx = ncoord[0], ny = ncoord[1];
						if (g.outOfBounds(nx,ny)) continue;					
						adjsx[y][x].push(nx); adjsy[y][x].push(ny);
						if (cells[ny][nx] != 0) nland++;						
					}
					if (cells[y][x] != 0) landdegrees[nland]++;
					
					// now 2steps away:
					for (let i = 0; i < 6; i++) {
						let ncoord = g.neighbor(x,y,i);
						let nx = ncoord[0], ny = ncoord[1];
						let ncoord1 = g.neighbor(nx,ny,i);
						let nx1 = ncoord1[0], ny1 = ncoord1[1];
						let ncoord2 = g.neighbor(nx,ny,(i+1) % 6);
						let nx2 = ncoord2[0], ny2 = ncoord2[1];
						if (!g.outOfBounds(nx1,ny1) && cells[ny1][nx1] != 0) {
							adj2x[y][x].push(nx1); adj2y[y][x].push(ny1);
						}
						if (!g.outOfBounds(nx2,ny2) && cells[ny2][nx2] != 0) {
							adj2x[y][x].push(nx2); adj2y[y][x].push(ny2);
						}						
					}
					
				}
			}
			
			// some border distri calculations
			bordercolmin = Math.floor(totalborder / 7.); 
			bordercolmax = Math.ceil(totalborder / 7.);
			
			// find the core
			let corescan = [];
			for (let y = 0; y < g.height; y++) {
				corescan.push([]);
				for (let x = 0; x < g.rowWidth(y); x++) {
					corescan[y][x] = 0;
				}
			}
			let supercorex = [], supercorey = [];
			if (g.height % 2 == 1) { 	// there is a center row
				let cy = Math.floor(g.height/2);
				if (g.rowWidth(cy) % 2 == 1) {	// there is a center hex
					let cx = Math.floor(g.rowWidth(cy)/2);
					supercorex.push(cx); supercorey.push(cy);					
				} else {	// there are two center hex
					let cx1 = Math.floor(g.rowWidth(cy)/2);
					let cx2 = cx1 - 1;
					supercorex.push(cx1); supercorey.push(cy);					
					supercorex.push(cx2); supercorey.push(cy);					
				}
			} else {	// no center row
				let cy1 = Math.floor(g.height / 2);
				let cy2 = cy1 - 1;
				if (g.rowWidth(cy1) % 2 == 1) {  // the row with an single hex
					let cx = Math.floor(g.rowWidth(cy1)/2);
					supercorex.push(cx); supercorey.push(cy1);					
					let cx1 = Math.floor(g.rowWidth(cy2)/2);
					let cx2 = cx1 - 1;
					supercorex.push(cx1); supercorey.push(cy2);					
					supercorex.push(cx2); supercorey.push(cy2);					
				} else {
					let cx = Math.floor(g.rowWidth(cy2)/2);
					supercorex.push(cx); supercorey.push(cy2);					
					let cx1 = Math.floor(g.rowWidth(cy1)/2);
					let cx2 = cx1 - 1;
					supercorex.push(cx1); supercorey.push(cy1);					
					supercorex.push(cx2); supercorey.push(cy1);					
				}
			}
			for (let i = 0; i < supercorex.length; i++) {
				let cx = supercorex[i], cy = supercorey[i];
				if (cells[cy][cx] != 0 && corescan[cy][cx] == 0) { 
					corex.push(cx); corey.push(cy);
					corescan[cy][cx] = 1;
				}
				let ax = adj2x[cy][cx].concat(adjsx[cy][cx]), ay = adj2y[cy][cx].concat(adjsy[cy][cx]);
				for (let i = 0; i < ax.length; i++) {
					if (cells[ay[i]][ax[i]] == 0 || corescan[ay[i]][ax[i]] == 1) continue;
					corex.push(ax[i]); corey.push(ay[i]);						
					corescan[ay[i]][ax[i]] = 1;
				}				
			}
			corecolmin = Math.floor(corex.length / 7.); 
			corecolmax = Math.ceil(corex.length / 7.);
			
			findland();
			calcship1();
			
			// first calculation of energy
			curenergy = colorenergy();
			
			
			// now optimize
			let noptsteps = inputs.iterations * sizefactor * Math.max(1, sizefactor);
			for (let k = 0; k < noptsteps; k++) {
				optimizecolor();
				if ((k + 1) % 100 === 0 && TM.app.liveGenerationUpdatesEnabled()) {
					// Publish this batch to the UI's live grid before redrawing it.
					writeCellsToGrid(grid);
					TM.app.renderCurrent();
					// Let the browser paint the redraw before optimizing the next batch.
					await new Promise(requestAnimationFrame);
				}
			}		


			const toTable = arr => {
				const w = arr[0].map((_, i) => Math.max(...arr.map(r => String(r[i]).length)));
				return arr.map(r => r.map((v, i) => String(v).padEnd(w[i])).join(" | ")).join("\n");
			};
			
			// function toTable (a) {
				// let s = "";
				// for (let i = 0; i < a.length; i++) {
					// if (a[i] === undefined) continue;
					// s += i + ":";
					// for (let j = 0; j < a[i].length; j++) {
						// let b = (a[i][j] === undefined ? " 0" : ( a[i][j] < 10 ? " " + a[i][j] : a[i][j] ));
						// s += " " + b + " |";
					// }
					// s += "\n";
				// }
				// return s;
			// };
			
			console.log("######### land algo report ##########");
			console.log("cur energy/color energy", curenergy, colorenergy());	//its important to call colorenergy here so the rest of the numbers below are correct
			console.log("color counts, #adj, #neigh, #ext neigh, #X|X+1|X, #X|X+3|X", colcounts, adjfails, neighfails, neighextfails, triplefails, marcfails);
			console.log("step2 pairs gray and yellow:", step2pairs[4]/2, step2pairs[6]/2);
			//console.log("neigh diversities\n", toTable(neighdivs));
			console.log("tot/min/max border + border colors", totalborder + "/" + bordercolmin + "/" + bordercolmax, ncolorborder);
			console.log("center and avg dists:", centerdist, avdist, optdist);
			//console.log("core hexx:", corex,corey);
			console.log("core color counts:", corecols, corecolmin + "/" + corecolmax);
			for (let i = 0; i < colorclusters.length; i++) colorclusters[i].sort();
			console.log("color clusters:", colorclusters, toTable(colorclusters)); // 
			extclusters[0] = [];
			for (let i = 1; i < extclusters.length; i++) extclusters[i].sort();
			console.log("ext clusters:", extclusters, toTable(extclusters)); //  
			
			// translating it back to the grid
			writeCellsToGrid(grid);

			function writeCellsToGrid(g2) {
				for (const [x, y] of g2.landCoordinates()) {
					g2.set(x, y, cells[y][x]);
				}
			}
			
			// ############# function storage below, totally professional


			function colorenergy() {
				precalc();
				calcadjfails();
				calccentersfail();
				calccolorclusters();
				calcship1fails();
				// calccolorborderfail();
				calcextclusters();
				calc2steps();
				calccore();

				let sum = 0;
				
				// optimal number of colors
				for (let i = 1; i < 8; i++) {
					sum += 5. * Math.abs(colcounts[i] - optcounts[i]);
				}			
				
				sum += 3. * adjfails; // penalizes same colors being adjacent
				sum += 1. * triplefails; // penalizes X-(Xpm1)-X

				// border optimization
				for (let i = 1; i < 8; i++) {
					sum += 2. * Math.max(ncolorborder[i] - bordercolmax, bordercolmin - ncolorborder[i],0);
				}

				// core optimization
				for (let i = 1; i < 8; i++) {
					sum += 1. * Math.max(corecols[i] - corecolmax, corecolmin - corecols[i],0);
				}

				
				// neighbourhood hard diversity fails:
				sum += 3.* neighdivs[3][2];
				sum += 3. * neighdivs[4][2];
				sum += 3. * neighdivs[5][2] + 3. * neighdivs[5][3];
				sum += 3. * neighdivs[6][2] + 3. * neighdivs[6][3] + 3. * neighdivs[6][4];
				// neighbourhood soft diversity fails:
				sum += 1. * Math.max(neighdivs[4][3] - Math.round(0.12*landdegrees[4]), Math.round(0.05*landdegrees[4]) - neighdivs[4][3], 0);
				sum += 1. * Math.max(neighdivs[5][4] - Math.round(0.66*landdegrees[5]), Math.round(0.33*landdegrees[5]) - neighdivs[5][4], 0);	// since 5/4 and 5/5 are the only non-hard fails this balances 5/5 already
				sum += 1. * Math.max(neighdivs[6][4] - Math.round(0.66*landdegrees[6]), Math.round(0.25*landdegrees[6]) - neighdivs[6][4], 0);
				sum += 2. * Math.max(neighdivs[6][6] - Math.round(0.11*landdegrees[6]), 0);

				sum	+= 4. * neighfails; // penalizes hexes that have one color three times as neighbor
				sum	+= 2. * neighextfails; // penalizes hexes that have 2+ samecolor ext neighbors, and hexes that have 3+ ext neighbors of one adjacent color
			
				//sum += centersfail; // penalize centers of mass being off
				for (let i = 1; i < 8; i++) {
					sum += 2.*Math.max((Math.round(4. * centerdist[i]) - 1.5)*0.25, 0);
					sum += 1.*Math.max(Math.round(10* (Math.abs(avdist[i] - optdist) - 0.2) )/5, 0);
				}				

				
				
				// cluster optimization... at least one 2,2+ cluster for each color would be nice.
				for (let i = 1; i < 8; i++) {
					let twotwoplus = 0;
					for (let j = 0; j < colorclusters[i].length; j++) {
						let cc = colorclusters[i][j];
						if (cc[0] >= 2 && cc[1] >= 2) twotwoplus++; 
					}
					sum += 2. * Math.max(twotwoplus - 2, 0 - twotwoplus, 0);
				}		

				sum += 0.5 * Math.max(step2pairs[4] - 10 * sizefactor, 6 * sizefactor - step2pairs[4], 0);		// dwarfs 2steppairs
				sum += 0.5 * Math.max(step2pairs[6] - 8 * sizefactor, 4 * sizefactor - step2pairs[6], 0);		// fakirs 2steppairs


				// specific extended cluster optimizatino for merqueens
				// for (let i = 2; i <= 2; i++) {
					// let twotwoplus = 0;
					// for (let j = 0; j < colorclusters[i].length; j++) {
						// let cc = colorclusters[i][j];
						// if (cc[0] >= 2 && cc[1] >= 2) twotwoplus++; 
					// }
					// sum += 2. * Math.max(twotwoplus - 4, 3 - twotwoplus, 0);
				// }		

							
				
				return sum;
			}
			
			function optimizecolor() {
				// updaterandomcolor();
				swaprandomcolor();	
				triplerandomcolor();
			}
			
			function precalc() { // do somewhat unified pre calculations for energy:
				// centers
				for (let k = 0; k < 8; k++) {
					centersx[k] = 0;
					centersy[k] = 0;
					avdist[k] = 0;
				}
				colcounts = [0,0,0,0,0,0,0,0]; 	// total number of colors
				ncolorborder = [0,0,0,0,0,0,0,0]; // colors on the border;
				adjcols = [];					// adjcolors per cells
				adjship1cols = [];					// adjcolors per cells
				adjextcols = [];					// adjcolors per cells

				for (let y = 0; y < g.height; y++) {
					adjcols[y] = [];
					adjship1cols[y] = [];
					adjextcols[y] = [];
					for (let x = 0; x < g.rowWidth(y); x++) {
						let c = cells[y][x];
						
						// general color count
						colcounts[c]++;
						if (adjsx[y][x].length < 6) ncolorborder[c]++;
						
						// color adjacencies
						let ncol = [0,0,0,0,0,0,0,0];
						for (let i = 0; i < adjsx[y][x].length; i++) {
							ncol[cells[adjsy[y][x][i] ][adjsx[y][x][i] ]]++;
						}
						adjcols[y][x] = ncol.slice();

						// color ship1 adjacencies
						if (c != 0) {
							ncol = [0,0,0,0,0,0,0,0];
							for (let i = 0; i < adjship1x[y][x].length; i++) {
								ncol[cells[adjship1y[y][x][i] ][adjship1x[y][x][i] ]]++;
							}
							adjship1cols[y][x] = ncol.slice();
						}


						// color extended adjacencies
						if (c != 0) {
							ncol = [0,0,0,0,0,0,0,0];
							for (let i = 0; i < adjextx[y][x].length; i++) {
								ncol[cells[adjexty[y][x][i] ][adjextx[y][x][i] ]]++;
							}
							adjextcols[y][x] = ncol.slice();
						}

						
						// centers
						centersx[c] += x;
						centersy[c] += y;
						avdist[c] += Math.sqrt((x-optcenter[0])**2 + (y-optcenter[1])**2); // this is not a completely accurate formula but for our purposes probably suffices
					 }
				}
				for (let k = 0; k < 8; k++) {
					centersx[k] = Math.round(centersx[k] / colcounts[k] * 100) / 100; 
					centersy[k] = Math.round(centersy[k] / colcounts[k] * 100) / 100; 
					avdist[k] = Math.round(avdist[k] / colcounts[k] * 100) / 100; 
				}	
			}
			
			function calccore() {
				corecols = [0,0,0,0,0,0,0,0];
				for (let i = 0; i < corex.length; i++) {
					let x = corex[i], y = corey[i];
					let c = cells[y][x];
					corecols[c]++;
				}									
			}

			function calc2steps() {
				step2pairs[4] = 0;
				step2pairs[6] = 0;
				for (let i = 0; i < landcellsx.length; i++) {
					let x = landcellsx[i], y = landcellsy[i];
					let c = cells[y][x];		
					if (c == 0) continue;
					if (c == 4 || c == 6) {
						let adx = adj2x[y][x], ady = adj2y[y][x];
						for (let j = 0; j < adx.length; j++) {
							if (cells[ady[j]][adx[j]] != c) continue;
							step2pairs[c]++;
						}
					}
				}					
			}

			function calcship1fails() {
				// ship1fails = 0;
				neighextfails = 0;
				
				for (let i = 0; i < landcellsx.length; i++) {
					let x = landcellsx[i], y = landcellsy[i];
					let c = cells[y][x];
					
					// // ship1 direct fails
					// let sum = 0;
					// let sadjx = adjship1x[y][x], sadjy = adjship1y[y][x];
					// for (let j = 0; j < sadjx.length; j++) {
						// if (cells[sadjy[j]][sadjx[j]] != c) continue;
						// sum += 1;
					// }
					// if (sum > 1) ship1fails += (sum - 1);
					
					// 3 neighbors of adjacent color via ship1
					let ncol = adjcols[y][x];
					let ncolext = adjextcols[y][x];
					let c1 = (c == 1 ? 7 : c - 1);
					let c2 = (c == 7 ? 1 : c + 1);
					if (ncolext[c] >= 2) {
						neighextfails++;
						// console.log("double own color ship1 fail!!",x,y,c);
					}
					if (ncolext[c1] >= 3) {
						neighextfails++;  //ncol[c1] + 
						// console.log("triple adj color ship1 fail!!",x,y,c,c1);
					}
					if (ncolext[c2] >= 3) {
						neighextfails++; 	// ncol[c2] 		
						// console.log("triple adj  color ship1 fail!!",x,y,c,c2);
					}						
				}

			}

			// function calccolorborderfail() { // hier muss man noch was automatisieren die 40 macht mich skeptisch
				// colorborderfail = 0; 
				// let av = (totalborder - ncolorborder[0])/7.;
				// for (let i = 1; i < 8; i++) {
					// colorborderfail += 4 * (ncolorborder[i] - av) ** 2
				// }
			// }
			
			
			/*	center distributions:
				original: 		[ 0, 0.67, 0.59, 0.10, 0.91, 0.58, 0.24, 0.12 ]
				fireice: 		[ 0, 0.46, 1.56, 0.78, 0.46, 0.25, 0.94, 0.57 ]
				fjords: 		[ 0, 0.11, 0.48, 0.97, 0.62, 0.49, 0.94, 0.23 ]
				loonlakes: 		[ 0, 0.57, 0.18, 0.09, 0.29, 0.53, 0.65, 0.09 ]
				archipel:		[ 0, 0.58, 0.84, 0.82, 1.44, 0.55, 1.12, 0.73 ]
				algo:			[ 0, 0.18, 0.35, 0.52, 0.35, 0.61, 0.49, 0.33 ]
			
			*/
			function calccentersfail() { 
				let sum = 0;
				let templog = [];
				for (let k = 1; k < 8; k++) {
					centerdist[k] = 0.01*Math.round(100*  Math.sqrt((centersx[k] - optcenter[0]) ** 2 + (centersy[k] - optcenter[1]) ** 2));
					sum += centerdist[k];
					sum += Math.abs; //think its good to square as it also should be balanced
				}
				centersfail = sum;
			}
			
			function calcadjfails() {
				adjfails = 0;
				neighfails = 0;
				triplefails = 0;
				marcfails = 0;

				// prepare neighdivs
				for (let i = 1; i <= 6; i++) {
					for (let j = 0; j <= i; j++) {
						neighdivs[i][j] = 0;
					}
				}

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
				
				if (ncol[c] > 0) adjfails += ncol[c];  // add how many neighbors with the same color
				if (ncol[c == 1 ? 7 : c - 1] > 1) triplefails += 1;
				if (ncol[c == 7 ? 1 : c + 1] > 1) triplefails += 1;
				if (ncol[(c + 3 - 1) % 7 + 1] > 1 ) marcfails += 1;
				if (ncol[(c - 3 + 6) % 7 + 1] > 1) marcfails += 1;
				
				let ndif = 0; // how many different colors appear
				let nn = 0; // number of neighbours
				for (let i = 1; i < 8; i++) {
					if (ncol[i] == 0) continue;
					ndif++;
					nn += ncol[i];
					if (ncol[i] >= 3) neighfails++; // three times is too much
				}
				neighdivs[nn][ndif]++;
				// if ((nn >= 5) && (ndif < 4)) neighfails++;  // too few different neighbor colors
				// if ((nn == 4) && (ndif < 3)) neighfails++;  // same but for hex really at the boundary
				
			}
			

			function calccolorclusters() {
				colorclusters = [];
				
				//clusteropfail = 0;
				//clustergoodfail = 0;
				// clusterdecentfail = 0;
				// let clustergoodaverage = 0, clusterdecentaverage = 0;
				colorclusters[0] = [];
				for (let c0 = 1; c0 < 8; c0++) {
					colorclusters[c0] = [];
					
					// opclusters[c0] = 0;
					// goodclusters[c0] = 0;
					// decentclusters[c0] = 0;
					let c1 = (c0 == 1 ? 7 : c0 - 1);
					let c2 = (c0 == 7 ? 1 : c0 + 1);
					findcolorclusters(c0,c1,c2);
					// clusteropfail += opclusters[c0] * 6;
					// clustergoodaverage += goodclusters[c0];
					// clusterdecentaverage += decentclusters[c0];
				}
				// for (let c0 = 1; c0 < 8; c0++) {
					// clustergoodfail += (clustergoodaverage/7. - goodclusters[c0])**2;
					// clusterdecentfail += Math.abs(clusterdecentaverage/7. - decentclusters[c0])**2;
				// }
			}
			function findcolorclusters(c0,c1,c2) { //c0 is the main color and c1, c2 are its neighbours.
				colorclusters[c0] = [];
				for (let j = 0; j < grid.height; j++) {
					for (let i = 0; i < grid.rowWidth(j); i++) {
						clusterscan[j][i] = 0;
					}
				}
				for (let k = 0; k < landcellsx.length; k++) {
					let y = landcellsy[k], x = landcellsx[k];
					if (clusterscan[y][x] == 1) continue;	//already in a previous cluster
					if (cells[y][x] != c0) continue; // no need to start recursion, we only care about clusters if they contain c0 hexes
					
					let s = reccolorcluster(x,y,c0,c1,c2,[0,0]);
					
					colorclusters[c0].push(s);

					
					// if (s > 5) opclusters[c0]++;
					// else if (s > 4) goodclusters[c0]++;
					// if (s > 3) decentclusters[c0]++;		
				}
			}
			function reccolorcluster(x,y,c0,c1,c2,score) { // we return arrays with [n0,na] which is #n0 of c0 in cluster and na = # of adjacent colors
				if (g.outOfBounds(x,y)) return score; // this cell aint existin
				if (clusterscan[y][x] == 1) return score; // already scanned
				clusterscan[y][x] = 1; // scanned this
				let s = score.slice();
				let c = cells[y][x];
				if (c == c0) s[0] += 1;
				else if (c == c1) s[1] += 1;
				else if (c == c2) s[1] += 1;
				else return s; // not of the right color
				for (let i = 0; i < adjsx[y][x].length; i++) {
					s = reccolorcluster(adjsx[y][x][i],adjsy[y][x][i],c0,c1,c2,s);
				}
				return s;
			}				
			

			// extended clusters are like colorclusters but incoorporate ship1
			function calcextclusters() {
				extclusters = [];
				// extclusterfail = 0;
				for (let c0 = 1; c0 < 8; c0++) {
					extclusters[c0] = [];
					let c1 = (c0 == 1 ? 7 : c0 - 1);
					let c2 = (c0 == 7 ? 1 : c0 + 1);
					findextclusters(c0,c1,c2);
				}
				// for (let c = 1; c < 8; c++) {
					// for (let kk in extclusters[c]) {
						// //if (kk >= 10) extclusterfail += 2+5*extclusters[c][kk];
						// extclusterfail += .5* Math.max(0, kk - 7) ** 2 * extclusters[c][kk];
					// }
				// }
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
					if (cells[y][x] != c0) continue;
					let s = recextcluster(x,y,c0,c1,c2,[0,0]);
					extclusters[c0].push(s);
					
					// if (s == 0) continue;
					// if (!extclusters[c0][s]) extclusters[c0][s] = 1;
					// else extclusters[c0][s]++;
					// if (s > 5) opclusters[c0]++;
					// else if (s > 4) goodclusters[c0]++;
					// if (s > 3) decentclusters[c0]++;		
				}
			}
			function recextcluster(x,y,c0,c1,c2,score) {
				if (g.outOfBounds(x,y)) return score; // this cell aint existin
				if (clusterscan[y][x] == 1) return score; // already scanned
				clusterscan[y][x] = 1; // scanned this
				let s = score.slice();
				let c = cells[y][x];
				if (c == c0) s[0] += 1;
				else if (c == c1) s[1] += 1;
				else if (c == c2) s[1] += 1;
				else return s; // not of the right color
				// for (let i = 0; i < adjship1x[y][x].length; i++) {
					// s = recextcluster(adjship1x[y][x][i],adjship1y[y][x][i],c0,c1,c2,s);
				for (let i = 0; i < adjextx[y][x].length; i++) {
					s = recextcluster(adjextx[y][x][i], adjexty[y][x][i],c0,c1,c2,s);
				}
				return s.slice();
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

			function triplerandomcolor() {
				let ix1 = rndint(landcellsx.length);
				let ix2 = rndint(landcellsx.length - 1);
				if (ix2 >= ix1) ix2++; // pick a different index
				
				let ix = [];
				ix[0] = rndint(landcellsx.length);
				ix[1] = rndint(landcellsx.length - 1);
				if (ix[1] >= ix[0]) ix[1] += 1; // pick a different index
				ix[2] = rndint(landcellsx.length - 2);
				if (ix[2] >= ix[0]) ix[2] += 1; // pick a different index
				if (ix[2] >= ix[1]) ix[2] += 1; // pick a different index
				
				let xi = [], yi = [], ci = [];
				for (let i = 0; i <= 2; i++) {
					xi[i] = landcellsx[ix[i]];
					yi[i] = landcellsy[ix[i]];
					ci[i] = cells[yi[i]][xi[i]];
				}
				
				if ( (ci[0] == ci[1]) && (ci[1] == ci[2])) return;
				
				let perms = [[0,1,2], [1,0,2], [0,2,1], [2,1,0], [1,2,0], [2,0,1] ];
				
				let bestenergy = curenergy;
				let bestperm = 0;
				for (let k = 1; k < perms.length; k++) {
					for (let i = 0; i <= 2; i++) {
						cells[yi[i]][xi[i]] = ci[perms[k][i]];
					}
					let newenergy = colorenergy();
					if (newenergy >= bestenergy) continue;
					bestenergy = newenergy;
					bestperm = k;
				}
				
				curenergy = bestenergy;
				for (let i = 0; i <= 2; i++) {
					cells[yi[i]][xi[i]] = ci[perms[bestperm][i]];
				}	
			}
			
			function findland() { // generates the landcellsx,y array for faster randomizing of colors
				landcellsx = []; landcellsy = [];
				optdist = 0;
				for (let y = 0; y < g.height; y++) {
					for (let x = 0; x < g.rowWidth(y); x++) {	
						let c = cells[y][x];
						if (c == 0) continue;
						landcellsx.push(x); landcellsy.push(y);
						optdist += Math.sqrt((x-optcenter[0])**2 + (y-optcenter[1])**2);
					}
				}
				optdist = optdist / landcellsx.length;
			}			
			
			// I think this somehow counts ship1 adjacency but I havent checked
			function calcship1() {
				adjship1x = []; adjship1y = [];
				adjextx = []; adjexty = [];
				shipscan = [];

				for (let y = 0; y < g.height; y++) {
					shipscan[y] = []
					for (let x = 0; x < g.rowWidth(y); x++) {	
						shipscan[y][x] = 0;
					}
				}

				for (let y = 0; y < g.height; y++) {
					adjship1x[y] = []; adjship1y[y] = [];
					adjextx[y] = []; adjexty[y] = [];
					for (let x = 0; x < g.rowWidth(y); x++) {	
						let c = cells[y][x];
						if (c == 0) continue;
						let scannedx = [x], scannedy = [y]; // store which ones we scanned and reset them afterwards
						shipscan[y][x] = 1; // dont reach ourselves
						for (let i = 0; i < adjsx[y][x].length; i++) {
							let nx = adjsx[y][x][i], ny = adjsy[y][x][i];
							if (cells[ny][nx] != 0) { // cant ship over land, but counts for extended adjacency
								continue; 
							}
							for (let j = 0; j < adjsx[ny][nx].length; j++) { // second neighbours
								let n2x = adjsx[ny][nx][j], n2y = adjsy[ny][nx][j];
								if (cells[n2y][n2x] == 0) continue; // dont want to ship to water
								if (shipscan[n2y][n2x] == 1) continue; // we already counted this
								shipscan[n2y][n2x] = 1;
								scannedx.push(n2x); scannedy.push(n2y);
							}
						}
						adjship1x[y][x] = scannedx.slice(1); adjship1y[y][x] = scannedy.slice(1); // save everything but yourself
						adjextx[y][x] = scannedx.slice(1); adjexty[y][x] = scannedy.slice(1);
						for (let i = 0; i < adjsx[y][x].length; i++) {
							let ax = adjsx[y][x][i], ay = adjsy[y][x][i];
							if (shipscan[ay][ax] == 1) continue; // is already included anyway
							adjextx[y][x].push(ax); // otherwise add the neighbor
							adjexty[y][x].push(ay);
						}
						
						
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