export interface SaveData {
    version: number;
    highestUnlockedLevel: number;
    maxHPBonus: number;
    claimedRewards: string[];
    bestScoreByLevel: Record<number, number>;
}

export class ProgressionManager {
    private static readonly SAVE_KEY = 'number_snake_progression';
    private static readonly CURRENT_VERSION = 1;

    private static data: SaveData = {
        version: ProgressionManager.CURRENT_VERSION,
        highestUnlockedLevel: 1,
        maxHPBonus: 0,
        claimedRewards: [],
        bestScoreByLevel: {}
    };

    static load() {
        try {
            const stored = localStorage.getItem(ProgressionManager.SAVE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Safe migration
                ProgressionManager.data = {
                    version: ProgressionManager.CURRENT_VERSION,
                    highestUnlockedLevel: parsed.highestUnlockedLevel || 1,
                    maxHPBonus: parsed.maxHPBonus || 0,
                    claimedRewards: Array.isArray(parsed.claimedRewards) ? parsed.claimedRewards : [],
                    bestScoreByLevel: parsed.bestScoreByLevel || {}
                };
            }
            
            // Migrate old best score if it exists and level 1 score doesn't
            const oldScore = localStorage.getItem('number_snake_best_score');
            if (oldScore && !ProgressionManager.data.bestScoreByLevel[1]) {
                const score = parseInt(oldScore, 10);
                if (!isNaN(score)) {
                    ProgressionManager.data.bestScoreByLevel[1] = score;
                }
            }
        } catch (e) {
            console.error("Failed to load progression, resetting to default.", e);
            ProgressionManager.reset();
        }
    }

    static save() {
        try {
            localStorage.setItem(ProgressionManager.SAVE_KEY, JSON.stringify(ProgressionManager.data));
            // Backwards compatibility for other places if needed, but we should rely on bestScoreByLevel
            if (ProgressionManager.data.bestScoreByLevel[1]) {
                localStorage.setItem('number_snake_best_score', ProgressionManager.data.bestScoreByLevel[1].toString());
            }
        } catch (e) {
            console.error("Failed to save progression.", e);
        }
    }

    static reset() {
        ProgressionManager.data = {
            version: ProgressionManager.CURRENT_VERSION,
            highestUnlockedLevel: 1,
            maxHPBonus: 0,
            claimedRewards: [],
            bestScoreByLevel: {}
        };
        ProgressionManager.save();
    }

    static getHighestUnlockedLevel(): number {
        return ProgressionManager.data.highestUnlockedLevel;
    }

    static getMaxHP(): number {
        return 3 + ProgressionManager.data.maxHPBonus;
    }

    static hasClaimedReward(rewardId: string): boolean {
        return ProgressionManager.data.claimedRewards.includes(rewardId);
    }

    static claimReward(rewardId: string, hpBonus: number) {
        if (!ProgressionManager.hasClaimedReward(rewardId)) {
            ProgressionManager.data.claimedRewards.push(rewardId);
            ProgressionManager.data.maxHPBonus += hpBonus;
            ProgressionManager.save();
            return true;
        }
        return false;
    }

    static unlockLevel(levelId: number) {
        if (levelId > ProgressionManager.data.highestUnlockedLevel) {
            ProgressionManager.data.highestUnlockedLevel = levelId;
            ProgressionManager.save();
            return true;
        }
        return false;
    }

    static getBestScore(levelId: number): number {
        return ProgressionManager.data.bestScoreByLevel[levelId] || 0;
    }

    static submitScore(levelId: number, score: number) {
        const currentBest = ProgressionManager.getBestScore(levelId);
        if (score > currentBest) {
            ProgressionManager.data.bestScoreByLevel[levelId] = score;
            ProgressionManager.save();
            return true;
        }
        return false;
    }
    
    // For E2E testing
    static _getData() {
        return ProgressionManager.data;
    }
}
