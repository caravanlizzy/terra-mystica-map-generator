# Terra Mystica Map Layout Tool

A browser tool to design a Terra Mystica river layout, generate a terrain-color
distribution, and fine-tune the result by swapping hexes.

No dependencies, no build step, no server — open `index.html` in any browser.

## How to use

1. Set **Width**, **Height** and **Form**, or pick a **Preset**.
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
  layouts.js        # river presets + random river generator
  algorithms.js     # terrain algorithms (add yours here)
  renderer.js       # renders hexes to SVG
  app.js            # controller: state, controls, swap, exports
```

Every file is an IIFE that shares one global namespace (`window.TM`).
Scripts are listed in `index.html` in dependency order.

## Adding an algorithm

An algorithm is a plain object in the `TM.algorithms` array in `algorithms.js`:

```js
{
    id:          'my-algo',        // unique string key
    label:       'My algorithm',   // shown in the Algorithm dropdown
    description: 'One sentence.', // shown as a tooltip
    fill(grid) {
        // Assign a terrain color to every land hex.
        const { TERRAINS } = TM.colors;
        const { pick } = TM.utils;
        for (const [x, y] of grid.landCoordinates()) {
            grid.set(x, y, pick(TERRAINS));
        }
    }
}
```

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

