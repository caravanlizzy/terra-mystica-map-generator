/*
 * Shared utility functions available to all algorithms as TM.utils.
 *
 *   pick(items)     – return a random element of a non-empty array.
 *   shuffle(items)  – return a new array with the same elements in random order
 *                     (Fisher-Yates; does not mutate the original).
 */
(function (TM) {
    'use strict';

    // Return a random element of a non-empty array.
    function pick(items) {
        return items[Math.floor(Math.random() * items.length)];
    }

    // Return a new array with the same elements in a random order.
    function shuffle(items) {
        const arr = items.slice();
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
        return arr;
    }

    TM.utils = { pick, shuffle };
})(window.TM = window.TM || {});
