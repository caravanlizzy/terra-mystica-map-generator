# Terra Mystica Map Layout Tool

A browser tool to design a Terra Mystica river layout, generate a terrain-color
distribution, and fine-tune the result by swapping hexes.

No dependencies, no build step, no server — open `index.html` in any browser.

## How to use

1. Set **Width**, **Height** and **Form**, or pick a **Preset**. Use the terrain icon next to the zoom controls to switch between the river layout and available terrain colors.
2. Draw the river layout: click a hex to toggle **land / river**
   (or use *Random rivers* / *Reset rivers*).
3. Pick an **Algorithm** and click **Generate colors**.
4. In the colored view, click **two land hexes** to swap them.
5. Export as **SVG / PNG / JSON**, or copy the **BGA format**.

## Project structure

```
index.html          # markup + script loading order
styles.css
src/
  geometry.js       # offset-row grid, neighbors, pixel geometry
  colors.js         # terrain colors, display colors, BGA symbols
  utils.js          # pick(array), shuffle(array)
  grid.js           # MapGrid: cell storage, neighborhood, exports
  water-layouts.js        # river presets + random river generator
  algorithms/       # terrain and water algorithms
  renderer.js       # renders hexes to SVG
  app.js            # controller: state, controls, swap, exports
```

Every file is an IIFE that shares one global namespace (`window.TM`).
Scripts are listed in `index.html` in dependency order.

## Adding an algorithm

An algorithm registers a plain object in the shared `TM.algorithms` array. Its
`inputs` list is the complete control interface: the app automatically renders
one slider per item and passes the current values to `fill` or `run`.

```js
{
    id:          'my-algo',        // unique string key
    label:       'My algorithm',   // shown in the Algorithm dropdown
    description: 'One sentence.', // shown as a tooltip
    inputs: [
        { key: 'iterations', label: 'Optimisation steps', min: 0, max: 30000, step: 1000, value: 10000 }
    ],
    fill(grid, { iterations }) {
        // Assign a terrain color to every land hex.
        const { TERRAINS } = TM.colors;
        const { pick } = TM.utils;
        for (const [x, y] of grid.landCoordinates()) {
            grid.set(x, y, pick(TERRAINS));
        }
    }
}
```

Each input needs a unique `key`, UI `label`, `min`, `max`, and default `value`;
`step` is optional and defaults to `1`. The app and algorithm dispatchers
resolve omitted values from this list, so declared keys are always available in
the `inputs` object. Algorithms should read configurable values directly from
that object (for example, `inputs.iterations`), rather than defining separate
local defaults. Water algorithms use the same declaration and receive the
values as `run(grid, inputs)`. They may return a grid or a promise resolving
to one. The **Live generation updates** switch controls whether async
algorithms publish and redraw intermediate grid state; the final result is
always rendered after generation completes.

### MapGrid API inside `fill`

| | |
|---|---|
| `grid.landCoordinates()` | `[[x,y], …]` — all non-water hexes |
| `grid.neighbors(x, y)` | `[[x,y], …]` — in-bounds neighbors (0–6) |
| `grid.get(x, y)` / `grid.set(x, y, value)` | read / write a cell |
| `grid.isWaterAt(x, y)` | `true` for water/river hexes |
| `grid.count(value)` | number of cells holding `value` |
| `grid.snapshot()` / `grid.restore(s)` | save and restore all cells |

### Colors and utilities

```js
TM.colors.TERRAINS    // ['red','yel','bro','bla','blu','grn','gry']
TM.colors.UNASSIGNED  // '???' — land hex not yet assigned
TM.utils.pick(arr)    // random element
TM.utils.shuffle(arr) // new shuffled copy (original unchanged)
```
