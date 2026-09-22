import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressionManager } from '../src/models/Progression';

describe('Score and Best Score Progression', () => {
    beforeEach(() => {
        let store: Record<string, string> = {};
        global.localStorage = {
            getItem: (key: string) => store[key] || null,
            setItem: (key: string, value: string) => { store[key] = value; },
            removeItem: (key: string) => { delete store[key]; },
            clear: () => { store = {}; },
            length: 0,
            key: () => null
        };
        ProgressionManager.reset();
    });

    it('handles best score updates and newBest conditions correctly', () => {
        ProgressionManager.submitScore(1, 100);
        expect(ProgressionManager.getBestScore(1)).toBe(100);

        // Submitting lower score does not change best, returns false
        const lowerRes = ProgressionManager.submitScore(1, 90);
        expect(lowerRes).toBe(false);
        expect(ProgressionManager.getBestScore(1)).toBe(100);

        // Submitting equal score does not change best, returns false
        const equalRes = ProgressionManager.submitScore(1, 100);
        expect(equalRes).toBe(false);
        expect(ProgressionManager.getBestScore(1)).toBe(100);

        // Submitting higher score updates best, returns true
        const higherRes = ProgressionManager.submitScore(1, 120);
        expect(higherRes).toBe(true);
        expect(ProgressionManager.getBestScore(1)).toBe(120);
    });

    it('persists best scores across save/load reload', () => {
        ProgressionManager.submitScore(2, 250);
        ProgressionManager.save();

        // Reload
        ProgressionManager.load();
        expect(ProgressionManager.getBestScore(2)).toBe(250);
    });
});
