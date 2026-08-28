# Terra Mystica Map Layout Tool

A browser tool to design a Terra Mystica river layout, generate a terrain-color
distribution for it, and fine-tune the result by swapping hexes.

Everything is plain JavaScript with no dependencies, no build step and no
server. The map generation itself is pluggable: the tool currently ships one
very simple algorithm (**Random colors**), and the UI is built so further
algorithms can be dropped in next to it.

## Running

Open `index.html` in a browser (double-click it, or drag it into a browser
window). Everything runs locally from `file://`.

## How to use

1. Set **Width**, **Height** and **Form**, or pick a **Preset**
   (Original, Fire & Ice, Fjords, Loon Lakes, Onion, Archipelago).
   Pick the generation **Algorithm** (see *The algorithm interface* below).
2. Draw the river layout: click a hex to toggle **land / river**
   (or use *Random rivers*; *Reset rivers* turns every river hex back into land
   without changing the current size and form).
3. Click **Generate colors**. The selected algorithm fills every land hex and
   the result is shown right away.
4. In the colored view, click **exactly two land hexes** to swap them (water
   hexes cannot be swapped; click a selected hex again to deselect).
5. Export the result as **SVG / PNG / JSON**, or copy the **BGA format**.

## Project structure

UI and logic are kept apart: nothing under `src/services/` touches the DOM.

```
index.html                  # markup + script loading order
styles.css                  # page styles
src/
  services/                 # pure logic, no DOM
    colors.js               # terrain colors, display colors, BGA symbols
    hexGeometry.js          # offset-row grid, neighbors, pixel geometry
    random.js               # randomInt / pick / shuffle, with injectable rng
    mapGrid.js              # MapGrid: cell storage, neighborhood, exports
    layoutGenerator.js      # river presets + random river generator
    mapGenerator.js         # runs an algorithm over a layout
    algorithms/
      registry.js           # algorithm registry (contract: see below)
      randomColors.js       # built-in algorithm, and the example to copy
  ui/                       # presentation, depends on services
    mapRenderer.js          # renders hexes to SVG (no game rules)
    app.js                  # controller: state, controls, swap, exports
```

### Module pattern

There is no build step and no module loader, because the tool has to run from
`file://` (browsers block ES modules there). Two conventions stand in for
`import` / `export`:

- **Every file is an IIFE**: `(function (TM) { 'use strict'; ... })(window.TM =
  window.TM || {})`. Plain `<script>` files share one global scope, so the
  wrapper keeps each file's helpers private and avoids name clashes; only what
  the file assigns to `TM` at the end is public.
- **One global namespace, `window.TM`**: `TM.colors`, `TM.geometry`,
  `TM.MapGrid`, `TM.algorithms`, `TM.renderer`, … The `window.TM || {}`
  argument means whichever file loads first creates the namespace and the rest
  reuse it. The destructuring line at the top of each file (e.g.
  `const { WATER, displayColor } = TM.colors;`) is effectively its import list.

Scripts are listed in `index.html` in dependency order, which is also why
registering an algorithm needs nothing but a new `<script>` tag.

## The algorithm interface

Map generation is pluggable, and **this section is the canonical description of
the contract** — the source files point here rather than repeating it.
`src/services/algorithms/registry.js` implements it (validation, lookup, the
random-number context); `randomColors.js` next to it is the built-in algorithm
and the file to copy. Neither needs to be edited to add an algorithm.

An algorithm is a plain object:

| Field | Meaning |
| --- | --- |
| `id` | unique, stable identifier (ends up in the JSON export) |
| `label` | short name, shown in the **Algorithm** dropdown |
| `description` | one sentence, shown as the dropdown's tooltip |
| `fill(grid, context)` | assigns a terrain color to every land hex |

`fill` gets:

- **`grid`** – a `MapGrid` that has already been reset: river hexes carry the
  river marker, land hexes are unassigned. Write with `grid.set(x, y, color)`;
  read with `grid.get/at(x, y)`, `grid.landCoordinates()`,
  `grid.forEachCoordinate(visit)`, `grid.neighbors(x, y)`,
  `grid.isWaterAt(x, y)`, `grid.count(value)` and `grid.width/height/form`.
  Water hexes must not be touched — the caller finishes those.
- **`context`** – `{ rng, randomInt(min, max), pick(items), shuffle(items) }`,
  all bound to one source of randomness. Use these instead of `Math.random` so
  a run can be reproduced with a seeded generator
  (`new TM.MapGenerator(grid, { rng: mySeededRandom })`).

`fill` returns nothing and may be called repeatedly on the same grid, so it
must not keep state between calls.

### Adding one

1. Copy `src/services/algorithms/randomColors.js` to
   `src/services/algorithms/<yourAlgorithm>.js`.
2. Give it a new `id`, `label` and `description`, and replace the body of `fill`:

   ```js
   (function (TM) {
       'use strict';

       TM.algorithms.register({
           id: 'stripes',
           label: 'Stripes',
           description: 'One terrain color per row.',
           fill(grid, context) {
               const terrains = TM.colors.TERRAINS;
               for (const [x, y] of grid.landCoordinates()) {
                   grid.set(x, y, terrains[y % terrains.length]);
               }
           }
       });
   })(window.TM = window.TM || {});
   ```

3. Add a `<script>` tag for the file in `index.html`, below `registry.js`.

That is the whole job. The UI builds its **Algorithm** dropdown from
`TM.algorithms.list()`, so the new entry appears by itself, is selectable, and
is named in the JSON export. The dropdown is disabled while only one algorithm
is registered, and the first registered algorithm is the default.

### What the registry does for you

You only ever call `TM.algorithms.register(...)`; the rest of
`registry.js` is the harness behind it and is not meant to be touched:

| Function | Purpose |
| --- | --- |
| `register(algorithm)` | validates against the contract and stores it |
| `list()` | every algorithm in registration order — the dropdown reads this |
| `get(id)` | look up by id, falling back to the default so callers always get one |
| `has(id)` | used to validate the dropdown value |
| `defaultAlgorithm()` | the first one registered |
| `createContext(rng)` | builds the `context` bundle handed to `fill` |

Validation happens at load time, so mistakes fail loudly and immediately:
registering a duplicate `id`, or an object missing `id`, `label` or `fill`,
throws as soon as the page loads.
