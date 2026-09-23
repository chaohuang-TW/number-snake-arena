import { zhTW, type TranslationKey } from './zh-TW';
import { en } from './en';

export type Language = 'zh-TW' | 'en';
export type { TranslationKey };

export const LANGUAGE_STORAGE_KEY = 'number_snake_language_v1';

const dictionaries: Record<Language, Record<TranslationKey, string>> = {
    'zh-TW': zhTW,
    'en': en
};

let currentLanguage: Language | null = null;
const listeners: Array<(lang: Language) => void> = [];

export function resetLanguageStateForTest(): void {
    currentLanguage = null;
}

export function getLanguage(): Language {
    if (currentLanguage !== null) {
        return currentLanguage;
    }

    try {
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
            if (stored === 'en' || stored === 'zh-TW') {
                currentLanguage = stored;
                return currentLanguage;
            }
        }
    } catch {
        // Ignore localStorage error and fallback
    }

    currentLanguage = 'zh-TW';
    return currentLanguage;
}

export function setLanguage(lang: Language): void {
    const validLang: Language = (lang === 'en') ? 'en' : 'zh-TW';
    currentLanguage = validLang;

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, validLang);
        }
    } catch {
        // Ignore localStorage error
    }

    for (const listener of listeners) {
        try {
            listener(validLang);
        } catch (e) {
            console.error('Error in language change listener', e);
        }
    }
}

export function isTraditionalChinese(): boolean {
    return getLanguage() === 'zh-TW';
}

export function t(key: TranslationKey | string, params?: Record<string, string | number>): string {
    const lang = getLanguage();
    const dict = dictionaries[lang] || dictionaries['zh-TW'];
    let template = (dict as any)[key];

    if (template === undefined) {
        template = (dictionaries['zh-TW'] as any)[key];
    }

    if (template === undefined) {
        return String(key);
    }

    if (params) {
        return template.replace(/\{(\w+)\}/g, (_: string, paramKey: string) => {
            return params[paramKey] !== undefined ? String(params[paramKey]) : `{${paramKey}}`;
        });
    }

    return template;
}

export function onLanguageChange(callback: (lang: Language) => void): () => void {
    listeners.push(callback);
    return () => {
        const idx = listeners.indexOf(callback);
        if (idx !== -1) {
            listeners.splice(idx, 1);
        }
    };
}
