import { describe, it, expect, beforeEach } from 'vitest';
import { CosmeticsManager } from '../src/models/Cosmetics';
import { HEAD_SKINS, HEAD_SKIN_LIST, DEFAULT_HEAD_SKIN_ID } from '../src/config/headSkins';

describe('CosmeticsManager', () => {
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
        CosmeticsManager.reset();
    });

    it('contains all 6 expected head skins with unique IDs', () => {
        const expectedIds = ['classic', 'bolt', 'mecha', 'dragon', 'flame', 'alien'];
        expect(HEAD_SKIN_LIST.length).toBe(6);
        for (const id of expectedIds) {
            expect(HEAD_SKINS[id]).toBeDefined();
            expect(HEAD_SKINS[id].id).toBe(id);
            expect(HEAD_SKINS[id].displayName).toBeTruthy();
        }
        const ids = HEAD_SKIN_LIST.map(s => s.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(6);
    });

    it('initializes with classic default', () => {
        CosmeticsManager.load();
        expect(CosmeticsManager.getSelectedHeadSkin()).toBe(DEFAULT_HEAD_SKIN_ID);
    });

    it('saves and reloads selected head skin', () => {
        CosmeticsManager.load();
        expect(CosmeticsManager.setSelectedHeadSkin('mecha')).toBe(true);
        expect(CosmeticsManager.getSelectedHeadSkin()).toBe('mecha');

        // Reload
        CosmeticsManager.load();
        expect(CosmeticsManager.getSelectedHeadSkin()).toBe('mecha');
    });

    it('falls back safely to classic on unknown skin ID', () => {
        localStorage.setItem('number_snake_cosmetics_v1', JSON.stringify({
            version: 1,
            selectedHeadSkin: 'non_existent_skin'
        }));
        CosmeticsManager.load();
        expect(CosmeticsManager.getSelectedHeadSkin()).toBe('classic');
    });

    it('falls back safely to classic on malformed JSON', () => {
        localStorage.setItem('number_snake_cosmetics_v1', '{"invalid_json: 123');
        CosmeticsManager.load();
        expect(CosmeticsManager.getSelectedHeadSkin()).toBe('classic');
    });
});
