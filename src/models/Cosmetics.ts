import { HEAD_SKINS, DEFAULT_HEAD_SKIN_ID } from '../config/headSkins';

export interface CosmeticsData {
    version: number;
    selectedHeadSkin: string;
}

const COSMETICS_STORAGE_KEY = 'number_snake_cosmetics_v1';

export class CosmeticsManager {
    private static data: CosmeticsData = {
        version: 1,
        selectedHeadSkin: DEFAULT_HEAD_SKIN_ID
    };

    static load(): CosmeticsData {
        try {
            const raw = localStorage.getItem(COSMETICS_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed.selectedHeadSkin === 'string') {
                    if (HEAD_SKINS[parsed.selectedHeadSkin]) {
                        this.data.selectedHeadSkin = parsed.selectedHeadSkin;
                    } else {
                        this.data.selectedHeadSkin = DEFAULT_HEAD_SKIN_ID;
                    }
                }
            } else {
                this.data.selectedHeadSkin = DEFAULT_HEAD_SKIN_ID;
            }
        } catch (e) {
            this.data.selectedHeadSkin = DEFAULT_HEAD_SKIN_ID;
        }
        return { ...this.data };
    }

    static save(): void {
        try {
            localStorage.setItem(COSMETICS_STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            // Ignore storage errors
        }
    }

    static getSelectedHeadSkin(): string {
        return this.data.selectedHeadSkin;
    }

    static setSelectedHeadSkin(skinId: string): boolean {
        if (HEAD_SKINS[skinId]) {
            this.data.selectedHeadSkin = skinId;
            this.save();
            return true;
        }
        return false;
    }

    static reset(): void {
        this.data = {
            version: 1,
            selectedHeadSkin: DEFAULT_HEAD_SKIN_ID
        };
        try {
            localStorage.removeItem(COSMETICS_STORAGE_KEY);
        } catch (e) {}
    }
}
