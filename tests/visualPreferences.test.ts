import { beforeEach, describe, expect, it } from 'vitest';
import { EnemySkinSelector, VisualPreferencesManager, VISUAL_PREFERENCES_STORAGE_KEY } from '../src/models/VisualPreferences';
import { CosmeticsManager } from '../src/models/Cosmetics';
import { HEAD_SKIN_LIST } from '../src/config/headSkins';

describe('Separate visual preferences and deterministic opponent skins', () => {
    let store: Record<string, string>;
    beforeEach(() => {
        store = {};
        global.localStorage = { getItem: key => store[key] ?? null, setItem: (key, value) => { store[key] = value; }, removeItem: key => { delete store[key]; }, clear: () => { store = {}; }, length: 0, key: () => null };
        VisualPreferencesManager.reset();
    });
    it('preserves an old equipped skin and progression bytes when writing preferences', () => {
        const old = JSON.stringify({ version: 1, selectedHeadSkin: 'dragon' });
        store.number_snake_cosmetics_v1 = old;
        store.number_snake_progression_v1 = '{"highestUnlockedLevel":4}';
        CosmeticsManager.load();
        VisualPreferencesManager.load();
        VisualPreferencesManager.set({ opponentStyleMode: 'specified', opponentHeadSkin: 'alien', lowEffects: true });
        expect(CosmeticsManager.getSelectedHeadSkin()).toBe('dragon');
        expect(store.number_snake_cosmetics_v1).toBe(old);
        expect(store.number_snake_progression_v1).toBe('{"highestUnlockedLevel":4}');
        expect(VisualPreferencesManager.load().opponentHeadSkin).toBe('alien');
    });
    it.each(['{bad', 'null', '42', '{}', '{"opponentHeadSkin":"toString","opponentStyleMode":"unknown"}'])('handles corrupted preference %s', raw => {
        store[VISUAL_PREFERENCES_STORAGE_KEY] = raw;
        const result = VisualPreferencesManager.load();
        expect(result.opponentHeadSkin).toBe('classic');
        expect(result.opponentStyleMode).toBe('random');
    });
    it('uses every silhouette exactly once per deterministic shuffled bag without repeats across its boundary', () => {
        const selector = new EnemySkinSelector(() => 0.42);
        const first = Array.from({ length: 6 }, () => selector.next());
        const second = Array.from({ length: 6 }, () => selector.next());
        expect(new Set(first)).toEqual(new Set(HEAD_SKIN_LIST.map(s => s.id)));
        expect(new Set(second)).toEqual(new Set(first));
        expect(first[5]).not.toBe(second[0]);
        const again = new EnemySkinSelector(() => 0.42);
        expect(Array.from({ length: 12 }, () => again.next())).toEqual([...first, ...second]);
    });
    it('specified style chooses every new spawn and preference changes affect subsequent spawns only', () => {
        const selector = new EnemySkinSelector(() => 0.25);
        const aliveSkin = selector.next();
        VisualPreferencesManager.set({ opponentStyleMode: 'specified', opponentHeadSkin: 'mecha' });
        expect(selector.next()).toBe('mecha'); expect(selector.next()).toBe('mecha');
        expect(aliveSkin).toBe('bolt');
    });
    it('denied reads and writes safely retain a valid playable session', () => {
        global.localStorage = { ...localStorage, getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
        expect(() => VisualPreferencesManager.load()).not.toThrow();
        expect(() => VisualPreferencesManager.set({ reducedMotion: true, opponentHeadSkin: 'alien' })).not.toThrow();
        expect(VisualPreferencesManager.get().opponentHeadSkin).toBe('alien');
    });
});
