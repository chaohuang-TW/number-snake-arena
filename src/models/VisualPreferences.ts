import { DEFAULT_HEAD_SKIN_ID, HEAD_SKIN_LIST, HEAD_SKINS } from '../config/headSkins';

export type OpponentStyleMode = 'random' | 'specified';
export interface VisualPreferences {
    version: 1;
    opponentStyleMode: OpponentStyleMode;
    opponentHeadSkin: string;
    reducedMotion: boolean;
    lowEffects: boolean;
}
export const VISUAL_PREFERENCES_STORAGE_KEY = 'number_snake_visual_preferences_v1';
const defaults = (): VisualPreferences => ({ version: 1, opponentStyleMode: 'random', opponentHeadSkin: DEFAULT_HEAD_SKIN_ID, reducedMotion: false, lowEffects: false });

/** Presentation preferences are deliberately stored apart from player cosmetics and progression. */
export class VisualPreferencesManager {
    private static data = defaults();
    static load(): VisualPreferences {
        this.data = defaults();
        try {
            const raw = localStorage.getItem(VISUAL_PREFERENCES_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    this.data.opponentStyleMode = parsed.opponentStyleMode === 'specified' ? 'specified' : 'random';
                    this.data.opponentHeadSkin = typeof parsed.opponentHeadSkin === 'string' && Object.hasOwn(HEAD_SKINS, parsed.opponentHeadSkin) ? parsed.opponentHeadSkin : DEFAULT_HEAD_SKIN_ID;
                    this.data.reducedMotion = parsed.reducedMotion === true;
                    this.data.lowEffects = parsed.lowEffects === true;
                }
            }
        } catch { /* Storage and malformed saves never block play. */ }
        return this.get();
    }
    static get(): VisualPreferences { return { ...this.data }; }
    static set(partial: Partial<Omit<VisualPreferences, 'version'>>): VisualPreferences {
        if (partial.opponentStyleMode === 'random' || partial.opponentStyleMode === 'specified') this.data.opponentStyleMode = partial.opponentStyleMode;
        if (typeof partial.opponentHeadSkin === 'string' && Object.hasOwn(HEAD_SKINS, partial.opponentHeadSkin)) this.data.opponentHeadSkin = partial.opponentHeadSkin;
        if (typeof partial.reducedMotion === 'boolean') this.data.reducedMotion = partial.reducedMotion;
        if (typeof partial.lowEffects === 'boolean') this.data.lowEffects = partial.lowEffects;
        try { localStorage.setItem(VISUAL_PREFERENCES_STORAGE_KEY, JSON.stringify(this.data)); } catch { /* Keep session preference if storage is unavailable. */ }
        return this.get();
    }
    static reset(): void { this.data = defaults(); }
}

/** One bag per arena; every six random spawns include all six silhouettes. */
export class EnemySkinSelector {
    private bag: string[] = [];
    private previous: string | undefined;
    constructor(private random: () => number = Math.random) {}
    next(): string {
        const preference = VisualPreferencesManager.get();
        if (preference.opponentStyleMode === 'specified') return preference.opponentHeadSkin;
        if (this.bag.length === 0) {
            this.bag = HEAD_SKIN_LIST.map(skin => skin.id);
            for (let i = this.bag.length - 1; i > 0; i--) {
                const sample = this.random();
                const safeSample = Number.isFinite(sample) ? Math.max(0, Math.min(0.999999999, sample)) : 0;
                const j = Math.floor(safeSample * (i + 1));
                [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
            }
            if (this.bag[this.bag.length - 1] === this.previous) [this.bag[0], this.bag[this.bag.length - 1]] = [this.bag[this.bag.length - 1], this.bag[0]];
        }
        this.previous = this.bag.pop()!;
        return this.previous;
    }
}
