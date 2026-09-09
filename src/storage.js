/*
 * Browser persistence for UI preferences. Generated map cells deliberately
 * remain session-only; this module stores configuration controls only.
 */
(function (TM) {
    'use strict';

    const UI_STORAGE_KEY = 'terra-mystica-map-generator.ui.v1';

    function savedInputGroups(groups) {
        if (!groups || typeof groups !== 'object' || Array.isArray(groups)) return {};
        return Object.keys(groups).reduce((saved, algorithmId) => {
            const values = groups[algorithmId];
            if (!values || typeof values !== 'object' || Array.isArray(values)) return saved;
            const numericValues = Object.keys(values).reduce((numeric, key) => {
                if (Number.isFinite(values[key])) numeric[key] = values[key];
                return numeric;
            }, {});
            saved[algorithmId] = numericValues;
            return saved;
        }, {});
    }

    function loadUiPreferences() {
        const raw = localStorage.getItem(UI_STORAGE_KEY);
        if (!raw) return null;

        let saved;
        try {
            saved = JSON.parse(raw);
        } catch (error) {
            console.warn('Ignoring invalid saved map preferences.', error);
            localStorage.removeItem(UI_STORAGE_KEY);
            return null;
        }
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
            console.warn('Ignoring invalid saved map preferences.');
            localStorage.removeItem(UI_STORAGE_KEY);
            return null;
        }

        return {
            width: Number.isFinite(saved.width) ? saved.width : null,
            height: Number.isFinite(saved.height) ? saved.height : null,
            form: saved.form === 1 ? 1 : 0,
            algorithmId: typeof saved.algorithmId === 'string' ? saved.algorithmId : null,
            waterAlgorithmId: typeof saved.waterAlgorithmId === 'string'
                ? saved.waterAlgorithmId
                : null,
            algorithmInputs: savedInputGroups(saved.algorithmInputs),
            waterAlgorithmInputs: savedInputGroups(saved.waterAlgorithmInputs),
            continueTerrain: saved.continueTerrain === true,
            continueWater: saved.continueWater === true,
            liveGenerationUpdates: saved.liveGenerationUpdates !== false
        };
    }

    function saveUiPreferences(preferences) {
        localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(preferences));
    }

    function clearUiPreferences() {
        localStorage.removeItem(UI_STORAGE_KEY);
    }

    TM.storage = { loadUiPreferences, saveUiPreferences, clearUiPreferences };
})(window.TM = window.TM || {});
