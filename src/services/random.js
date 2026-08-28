/*
 * Random helpers. Each takes an optional `rng` (a float in [0, 1)) so a run can
 * be reproduced with a seeded generator instead of Math.random.
 */
(function (TM) {
    'use strict';

    function randomInt(min, max, rng) {
        const random = rng || Math.random;
        return min + Math.floor(random() * (max - min + 1));
    }

    // Random element of a non-empty array.
    function pick(items, rng) {
        return items[randomInt(0, items.length - 1, rng)];
    }

    // Fisher-Yates, on a copy of the input.
    function shuffle(items, rng) {
        const result = items.slice();
        for (let i = result.length - 1; i > 0; i--) {
            const j = randomInt(0, i, rng);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    TM.random = { randomInt, pick, shuffle };
})(window.TM = window.TM || {});
