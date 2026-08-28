/*
 * The map-algorithm registry: validates implementations, stores them, and
 * builds the context they run with. The UI reads it for its algorithm picker.
 *
 * An algorithm is { id, label, description, fill(grid, context) }.
 *
 * >> Contract: README.md, "The algorithm interface" - canonical. Read it
 * >> before writing an algorithm; update it when changing anything here that
 * >> an author can observe. Adding an algorithm needs no edit to this file.
 */
(function (TM) {
    'use strict';

    const { randomInt, pick, shuffle } = TM.random;

    const registry = new Map();

    // Throw early and loudly on a contract violation.
    function validate(algorithm) {
        if (!algorithm || typeof algorithm !== 'object') {
            throw new Error('A map algorithm must be an object.');
        }
        for (const field of ['id', 'label']) {
            if (typeof algorithm[field] !== 'string' || !algorithm[field]) {
                throw new Error('A map algorithm needs a non-empty "' + field + '".');
            }
        }
        if (typeof algorithm.fill !== 'function') {
            throw new Error('Map algorithm "' + algorithm.id + '" needs a fill(grid, context) function.');
        }
        if (registry.has(algorithm.id)) {
            throw new Error('A map algorithm with id "' + algorithm.id + '" is already registered.');
        }
    }

    // Register an implementation of the contract; returns the stored entry.
    function register(algorithm) {
        validate(algorithm);
        const entry = {
            id: algorithm.id,
            label: algorithm.label,
            description: algorithm.description || '',
            fill: algorithm.fill
        };
        registry.set(entry.id, entry);
        return entry;
    }

    // Registration order - the dropdown reads this.
    function list() {
        return [...registry.values()];
    }

    function has(id) {
        return registry.has(id);
    }

    // Used when nothing is selected: the first one registered.
    function defaultAlgorithm() {
        return registry.size ? registry.values().next().value : null;
    }

    // Falls back to the default, so callers always get an algorithm.
    function get(id) {
        return registry.get(id) || defaultAlgorithm();
    }

    // The helper bundle for `fill`, bound to one source of randomness.
    function createContext(rng) {
        const random = rng || Math.random;
        return {
            rng: random,
            randomInt: (min, max) => randomInt(min, max, random),
            pick: (items) => pick(items, random),
            shuffle: (items) => shuffle(items, random)
        };
    }

    TM.algorithms = { register, list, has, get, defaultAlgorithm, createContext };
})(window.TM = window.TM || {});
