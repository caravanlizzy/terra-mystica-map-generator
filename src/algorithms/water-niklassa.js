/*
 * Niklassa water algorithm (target: water).
 *
 * A water-target algorithm is a plain object:
 *
 *   { id, name, label, target: 'water', description, run(grid) }
 *
 * `run` receives a MapGrid, assigns grid.water (a Set of "x,y" strings) and
 * returns the grid. It is picked up automatically by the water select in the
 * UI because it registers itself in the shared TM.algorithms registry.
 *
 * The whole simulated-annealing generator below was lifted verbatim out of
 * water-layouts.js; the state it needs while running lives as variables shared
 * by the inner functions of a WaterNiklassa instance, so the helper functions
 * can share it without passing it around the whole time.
 */
(function (TM) {
    'use strict';

	function rndint(max) {
		return Math.floor(Math.random() * max);
	}

	function WaterNiklassa() {
		// ######################### variables we need while running the algorithm and dont want to pass around the whole time
		let cells = [];		// terrain information as 2d array
		let adjsx = []; // list of adjacent cells for each cell (that is excluding the border)
		let adjsy = [];
		let adjcols = []; // list per cell of number of each adjacent color

		let waterborders = 0; // counts how many water hex are at the border
		let wateradjborders = 0;  // I think this counts water hex at the border that are adjacent to other water hex at the border (and water hex in the corner)
		let wateradjs = [0,0,0,0,0,0,0]; // lists number of water hex that have this number of water neighbors
		let landadjs = [0,0,0,0,0,0,0]; // lists number of land hex that have this number of land neighbors

		let colcounts = [];		// counts the total number of hexes of each color
		let g = null; 	// the grid from the UI that we currently need to calculate grid.rowWidth()
		let curenergy = 0; // stores current energy
		let optcounts = [36,11,11,11,11,11,11,11];  // optimal envisioned number of terrains

		let landclustern = [];		// counts land clusters of size i
		let waterclustern = [];	// counts water clusters of size i
		let nlandcluster = 0;
		let nwatercluster = 0;
		let clusterscan = [];	// temp variable that saves whether a hex has already been counted for cluster computations

	function run(grid) {
        const water = new Set();

		g = grid;

		cells = []; adjsx = []; adjsy = []; adjcols = [];
		// generate the field
		for (let j = 0; j < grid.height; j++) {
			cells.push([]);
			clusterscan.push([]);
			for (let i = 0; i < grid.rowWidth(j); i++) {
				let col = (rndint(113) < 2*optcounts[0] ? 0 :1); // + rndint(7)
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

		// first calculation of energy
		curenergy = waterenergy();
		
		// now optimize
		for (let k = 0; k < 10000; k++) {
			optimizewater();
			//console.log(waterborders);
			console.log("curenergy", curenergy);
			console.log(wateradjs);
		}		



		// translating it to string format (???)
		for (let j = 0; j < grid.height; j++) {
			for (let i = 0; i < grid.rowWidth(j); i++) {
				if (cells[j][i] != 0) continue;
				water.add(i + ',' + j);
			}
		}
        grid.water = water;
        grid.reset();

        return grid;
	}

	function optimizewater() {
		updaterandomwater();
		swaprandomwater()
		

	}
	function precalc() { // do somewhat unified pre calculations for energy:
		// // centers
		// for (let k = 0; k < ncols; k++) { // cx = 5.79, cy = 4
			// centersx[k] = 0;
			// centersy[k] = 0;
		// }
		// total number of colors
		colcounts = [0,0,0,0,0,0,0,0];
		// colors on the border;
		// ncolorborder = [0,0,0,0,0,0,0,0];
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
				//if (adjsx[y][x].length < 6) ncolorborder[c]++;
				// // centers
				// centersx[c] += x;
				// centersy[c] += y;			
			 }
		 }
		// for (let k = 0; k < ncols; k++) {
			// centersx[k] = (centersx[k] / colcounts[k]) - 5.79; 
			// centersy[k] = (centersy[k] / colcounts[k]) - 4; 
		// }	
	}

	function waterenergy() {
		precalc();
		calcwaterfails();
		calcwaterclusters();
		
		let sum = 0;
		sum += 3 * Math.abs(colcounts[0] - optcounts[0]); // target number of water hex
		sum += 2 * Math.max(waterborders - 6, 0); // target number of water hex at border 
		sum += 2 * wateradjborders;			// penalizes adjacent border water hexx
		sum += 3 * wateradjs[0]; // penalty for isolated water hex		
		sum += 2 * Math.max(wateradjs[1] - 1.5, 0);	// penalty for having too many "river ends"
		sum += Math.max(wateradjs[3] - 3.5, 0); 	// penalty for too many river crossings
		sum += Math.max(wateradjs[4] - 0.5, 0);	// penalty for too many "fords"
		sum += 2 * Math.max(wateradjs[5],0);		// penalty for any almost ocean tiles
		sum += 3 * Math.max(wateradjs[6],0);		// penalty for true ocean
		
		sum += 5 * landadjs[0];	// penalty for islands
		sum += Math.max(landadjs[1] - 5, 0);	// penalty for too many halfislands
		sum += Math.max(landadjs[2] - 10, 0);	// penalty for too many landbridges
		sum += 5 * Math.max(1 - landadjs[5], 0); // penalty for too few coastal hex
		sum += Math.max(landadjs[6] - 10, 0);	// penalty for too many inland hex
		sum += 5 * Math.max(2 - landadjs[6], 0);	// penalty for too few inland hex
		
		for (let i = 0; i < 6; i++) {
			if (waterclustern[i] > 0) sum += waterclustern[i]*5;  // penalizes water clusters below size 6?
		}
		for (let i = 0; i < 4; i++) {
			if (landclustern[i] > 0) sum += landclustern[i]*5;  // penalizes small land clusters?
		}
		sum += 3*Math.max(nwatercluster - 1.25,0);  // penalty for too many water clusters?
		
		return sum + Math.random()*2;
	}	

	
	function calcwaterfails() {
		landadjs = [0,0,0,0,0,0,0];
		wateradjs = [0,0,0,0,0,0,0];
		waterborders = 0;
		wateradjborders = 0;
		for (let j = 0; j < g.height; j++) {
			for (let i = 0; i < g.rowWidth(j); i++) {
				if (cells[j][i] != 0) calclandfailscell(i,j);
				else calcwaterfailscell(i,j);
				// if (cells[j][i] == 0) calcwaterfailscell(i,j);
			}
		}
	}
	function calcwaterfailscell(x, y) {
		let nn = adjsx[y][x].length; // number of neighbor hexs
		let nw = adjcols[y][x][0]; // number of water neighbors
		if (nn < 6) { // on the border
			waterborders += 1;
			if (nn < 3) wateradjborders += 3; // in the corner is also bad
			if (nw != 1) wateradjborders++;		
		} else {
			wateradjs[nw]++;
		}
	}
	function calclandfailscell(x, y) {
		let nn = adjsx[y][x].length;
		let nw = adjcols[y][x][0];
		landadjs[nn-nw] += 1;
	}


	function calcwaterclusters() {
		landclustern = [];
		waterclustern = [];
		nlandcluster = 0; nwatercluster = 0;

		// init: nothing scanned
		for (let j = 0; j < g.height; j++) {
			for (let i = 0; i < g.rowWidth(j); i++) {
				clusterscan[j][i] = 0;
			}
		}
		// begin recursive scans everywhere
		for (let j = 0; j < g.height; j++) {
			for (let i = 0; i < g.rowWidth(j); i++) {
				if (clusterscan[j][i] == 1) continue; // already scanned
				if (cells[j][i] ==  0) {
					nwatercluster++;
					let s = recwatercluster(i,j,0,0);
					if (!waterclustern[s]) waterclustern[s] = 1;
					else waterclustern[s]++;
				} else {
					nlandcluster++;
					let s = recwatercluster(i,j,0,1);
					if (!landclustern[s]) landclustern[s] = 1;
					else landclustern[s]++;
				}
			}
		}

	}

	function recwatercluster(x,y,size, wland) {
		if (g.outOfBounds(x,y)) return size; // this cell aint existin
		if (clusterscan[y][x] == 1) return size; // already scanned
		let s = size;
		let c = cells[y][x];
		if ((c == 0) && (wland == 1)) return s;
		if ((c > 0) && (wland == 0)) return s;
		clusterscan[y][x] = 1; // scanned this
		s++;
		
		// lets recurse
		for (let i = 0; i < adjsx[y][x].length; i++) {
			s = recwatercluster(adjsx[y][x][i],adjsy[y][x][i],s,wland);
		}
		return s;
	}

	function updaterandomwater() {
		let y = rndint(g.height);
		let x = rndint(g.rowWidth(y)); 
		let c = cells[y][x];
		
		let newc = (c == 0 ? 1: 0);
		cells[y][x] = newc;
		
		let newenergy = waterenergy();
		
		if (newenergy + (Math.random()-.5) >= curenergy) { // need to change back, old stuff won
			cells[y][x] = c;
		} else {
			curenergy = newenergy; // keep the new energy
			// changecount++;
		}		
	}
	function swaprandomwater() {
		let y1 = rndint(g.height);
		let x1 = rndint(g.rowWidth(y1)); 
		let y2 = rndint(g.height);
		let x2 = rndint(g.rowWidth(y2)); 
		if ((x1 == x2) && (y1 == y2)) return;
		let c1 = cells[y1][x1];
		let c2 = cells[y2][x2];
		if ( (c1 == 0) && (c2 == 0) ) return;
		if ( (c1 != 0) && (c2 != 0) ) return;
		
		let newc1 = c2, newc2 = c1;
		cells[y1][x1] = c2; cells[y2][x2] = c1;
		
		let newenergy = waterenergy();
		
		if (newenergy + (Math.random()-.5) >= curenergy) { // need to change back, old stuff won
			cells[y1][x1] = c1; cells[y2][x2] = c2;
		} else {
			curenergy = newenergy; // keep the new energy
			//changecount++;
		}	
	}

		// expose the entry point on the instance
		this.run = run;
	}


	// ##### eof niklas massacer

    TM.algorithms = TM.algorithms || [];
    TM.algorithms.push({
        id: 'water-niklassa',
        label: 'Niklassa Water',
        target: 'water',
        description: 'Simulated-annealing water generator that grows rivers and lakes while penalising isolated hexes, oversized oceans and border clumps.',
        run: function (grid) { return new WaterNiklassa().run(grid); }
    });
})(window.TM = window.TM || {});
