import { describe, it, expect, beforeEach } from 'vitest';
import {
    getLanguage,
    setLanguage,
    t,
    isTraditionalChinese,
    onLanguageChange,
    LANGUAGE_STORAGE_KEY,
    resetLanguageStateForTest
} from '../src/i18n';
import { zhTW } from '../src/i18n/zh-TW';
import { en } from '../src/i18n/en';

describe('i18n Localization System', () => {
    let store: Record<string, string> = {};

    beforeEach(() => {
        store = {};
        (global as any).localStorage = {
            getItem: (key: string) => store[key] || null,
            setItem: (key: string, value: string) => { store[key] = value; },
            removeItem: (key: string) => { delete store[key]; },
            clear: () => { store = {}; },
            length: 0,
            key: () => null
        };
        resetLanguageStateForTest();
    });

    it('defaults to Traditional Chinese (zh-TW) when localStorage is empty', () => {
        expect(getLanguage()).toBe('zh-TW');
        expect(isTraditionalChinese()).toBe(true);
    });

    it('falls back to zh-TW when localStorage contains invalid locale', () => {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
        resetLanguageStateForTest();
        expect(getLanguage()).toBe('zh-TW');

        localStorage.setItem(LANGUAGE_STORAGE_KEY, 'unknown_xyz');
        resetLanguageStateForTest();
        expect(getLanguage()).toBe('zh-TW');
    });

    it('switches language and persists to localStorage', () => {
        setLanguage('en');
        expect(getLanguage()).toBe('en');
        expect(isTraditionalChinese()).toBe(false);
        expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');

        setLanguage('zh-TW');
        expect(getLanguage()).toBe('zh-TW');
        expect(isTraditionalChinese()).toBe(true);
        expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('zh-TW');
    });

    it('notifies listeners when language changes', () => {
        let notifiedLang = '';
        const unsubscribe = onLanguageChange((lang) => {
            notifiedLang = lang;
        });

        setLanguage('en');
        expect(notifiedLang).toBe('en');

        unsubscribe();
        setLanguage('zh-TW');
        expect(notifiedLang).toBe('en'); // Unsubscribed, should not update
    });

    it('has 100% key parity between zh-TW and en dictionaries', () => {
        const zhKeys = Object.keys(zhTW).sort();
        const enKeys = Object.keys(en).sort();

        expect(zhKeys).toEqual(enKeys);
        for (const key of zhKeys) {
            expect(typeof (zhTW as any)[key]).toBe('string');
            expect(typeof (en as any)[key]).toBe('string');
            expect((zhTW as any)[key].length).toBeGreaterThan(0);
            expect((en as any)[key].length).toBeGreaterThan(0);
        }
    });

    it('performs parameter substitution correctly in t()', () => {
        setLanguage('en');
        expect(t('bossAppeared', { value: 400 })).toBe('400 APPEARED!');
        expect(t('nowHunt', { value: 300 })).toBe('NOW HUNT 300!');
        expect(t('levelUnlocked', { next: 2 })).toBe('LEVEL 2 UNLOCKED!');

        setLanguage('zh-TW');
        expect(t('bossAppeared', { value: 400 })).toBe('400 出現！');
        expect(t('nowHunt', { value: 300 })).toBe('現在狩獵 300！');
        expect(t('levelUnlocked', { next: 2 })).toBe('第 2 關已解鎖！');
    });

    it('returns translation for simple keys', () => {
        setLanguage('zh-TW');
        expect(t('menuTitle')).toBe('數字蛇競技場');
        expect(t('start')).toBe('開始');
        expect(t('gameOver')).toBe('遊戲結束');
        expect(t('wheelTitle')).toBe('幸運轉盤');

        setLanguage('en');
        expect(t('menuTitle')).toBe('NUMBER SNAKE ARENA');
        expect(t('start')).toBe('START');
        expect(t('gameOver')).toBe('GAME OVER');
        expect(t('wheelTitle')).toBe('LUCKY WHEEL');
    });
});
