# Contributing – Adding a new algorithm

Terrain generation algorithms live in **`src/algorithms.js`**.
Each algorithm is a plain JavaScript object pushed into the `TM.algorithms` array.
That's the only file you normally need to touch.

---

## Algorithm contract

```js
{
    id:          'my-algo',           // unique string key
    label:       'My algorithm',      // shown in the UI dropdown
    description: 'One sentence …',   // shown as a tooltip
    fill(grid) {
        // Assign a terrain color to every land hex.
        // See API reference below.
    }
}
```

`fill` is called with a freshly reset `MapGrid`.
Every land hex starts as `TM.colors.UNASSIGNED`.
Your job is to call `grid.set(x, y, color)` on every land hex before returning.
After `fill` returns, the framework converts any remaining river markers to water automatically.

---

## MapGrid API

| Method | Returns | Description |
|---|---|---|
| `grid.landCoordinates()` | `[[x,y], …]` | All non-water hexes that need a terrain color |
| `grid.neighbors(x, y)` | `[[x,y], …]` | In-bounds neighbors (0–6 elements) |
| `grid.get(x, y)` | value | Current cell value |
| `grid.set(x, y, value)` | – | Assign a terrain color to a cell |
| `grid.isWaterAt(x, y)` | `bool` | `true` for water/river hexes |
| `grid.count(value)` | `number` | Number of cells currently holding `value` |
| `grid.snapshot()` | object | Save a copy of all cell values |
| `grid.restore(snapshot)` | – | Roll back to a saved snapshot |

---

## Terrain colors

```js
TM.colors.TERRAINS   // ['red', 'yel', 'bro', 'bla', 'blu', 'grn', 'gry']
TM.colors.UNASSIGNED // '???' – land hex not yet assigned (useful in multi-pass algorithms)
TM.colors.WATER      // '~~~' – finished water hex (read-only inside fill)
```

---

## Utility helpers

```js
TM.utils.pick(array)     // → random element  (e.g. pick(TERRAINS))
TM.utils.shuffle(array)  // → new shuffled copy; original array is not mutated
```

---

## Minimal example

```js
// Assign every land hex a uniformly random terrain color.
{
    id: 'random',
    label: 'Random colors',
    description: 'Every land hex gets a uniformly random terrain color.',
    fill(grid) {
        const { TERRAINS } = TM.colors;
        const { pick } = TM.utils;
        for (const [x, y] of grid.landCoordinates()) {
            grid.set(x, y, pick(TERRAINS));
        }
    }
}
```

## Balanced example (uses `shuffle`)

```js
// Split land hexes into seven equal-sized bands, one per terrain.
{
    id: 'balanced',
    label: 'Balanced random',
    description: 'Each terrain color appears roughly the same number of times.',
    fill(grid) {
        const { TERRAINS } = TM.colors;
        const { shuffle } = TM.utils;
        const land = shuffle(grid.landCoordinates());
        land.forEach(([x, y], i) => {
            grid.set(x, y, TERRAINS[Math.floor(i * TERRAINS.length / land.length)]);
        });
    }
}
```

---

## Checklist for a new algorithm

1. Open `src/algorithms.js`.
2. Add your object to the `TM.algorithms` array (anywhere in the array).
3. Choose a unique `id` string.
4. Open the app and select your algorithm from the dropdown to test it.
5. Make sure every land hex gets a value from `TM.colors.TERRAINS` (not `UNASSIGNED`).
