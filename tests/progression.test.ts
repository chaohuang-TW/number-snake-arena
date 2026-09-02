import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProgressionManager } from '../src/models/Progression';
import { LEVELS, getLevel } from '../src/config/levels';

describe('ProgressionManager', () => {
    beforeEach(() => {
        // Mock localStorage
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

    it('should initialize with correct defaults', () => {
        ProgressionManager.load();
        expect(ProgressionManager.getHighestUnlockedLevel()).toBe(1);
        expect(ProgressionManager.getMaxHP()).toBe(3);
    });

    it('should migrate old best score', () => {
        localStorage.setItem('number_snake_best_score', '250');
        ProgressionManager.load();
        expect(ProgressionManager.getBestScore(1)).toBe(250);
    });

    it('should fallback on malformed save', () => {
        localStorage.setItem('number_snake_progression', '{ invalid json ');
        ProgressionManager.load();
        expect(ProgressionManager.getHighestUnlockedLevel()).toBe(1);
    });

    it('should unlock levels correctly', () => {
        ProgressionManager.load();
        expect(ProgressionManager.unlockLevel(2)).toBe(true);
        expect(ProgressionManager.getHighestUnlockedLevel()).toBe(2);
        // Duplicate unlock should return false
        expect(ProgressionManager.unlockLevel(2)).toBe(false);
    });

    it('should handle one-time rewards and maxHP', () => {
        ProgressionManager.load();
        expect(ProgressionManager.getMaxHP()).toBe(3);
        
        expect(ProgressionManager.claimReward('test-reward', 1)).toBe(true);
        expect(ProgressionManager.getMaxHP()).toBe(4);
    });

    it('should handle L2 and L3 rewards correctly (first time vs duplicate)', () => {
        ProgressionManager.load();
        expect(ProgressionManager.getMaxHP()).toBe(3);
        
        // L2 first clear
        expect(ProgressionManager.claimReward('level-2-clear-heart', 1)).toBe(true);
        expect(ProgressionManager.getMaxHP()).toBe(4);
        
        // L2 duplicate
        expect(ProgressionManager.claimReward('level-2-clear-heart', 1)).toBe(false);
        expect(ProgressionManager.getMaxHP()).toBe(4);

        // L3 first clear
        expect(ProgressionManager.claimReward('level-3-clear-heart', 1)).toBe(true);
        expect(ProgressionManager.getMaxHP()).toBe(5);
        
        // L3 duplicate
        expect(ProgressionManager.claimReward('level-3-clear-heart', 1)).toBe(false);
        expect(ProgressionManager.getMaxHP()).toBe(5);
    });

    it('should unlock Level 3 and Level 4 sequentially', () => {
        ProgressionManager.load();
        expect(ProgressionManager.unlockLevel(3)).toBe(true);
        expect(ProgressionManager.getHighestUnlockedLevel()).toBe(3);
        
        expect(ProgressionManager.unlockLevel(4)).toBe(true);
        expect(ProgressionManager.getHighestUnlockedLevel()).toBe(4);
        
        // Cannot unlock 5 (no NextLevelId in L4 definition anyway, but test it)
        expect(ProgressionManager.unlockLevel(5)).toBe(false);
        expect(ProgressionManager.getHighestUnlockedLevel()).toBe(4);
    });

    it('existing v0.2.4-style save remains valid', () => {
        // v0.2.4 player had L2 unlocked, 1 maxHPBonus, claimed level-1-clear-heart
        localStorage.setItem('number_snake_progression', JSON.stringify({
            version: 1,
            highestUnlockedLevel: 2,
            maxHPBonus: 1,
            claimedRewards: ["level-1-clear-heart"],
            bestScoreByLevel: { 1: 1500, 2: 2500 }
        }));
        
        ProgressionManager.load();
        expect(ProgressionManager.getHighestUnlockedLevel()).toBe(2);
        expect(ProgressionManager.getMaxHP()).toBe(4);
        expect(ProgressionManager.hasClaimedReward('level-1-clear-heart')).toBe(true);
        expect(ProgressionManager.hasClaimedReward('level-2-clear-heart')).toBe(false); // L2 reward must NOT be auto-granted
    });

    it('best scores remain isolated by level', () => {
        ProgressionManager.load();
        ProgressionManager.submitScore(2, 500);
        ProgressionManager.submitScore(3, 800);
        ProgressionManager.submitScore(4, 300);
        
        expect(ProgressionManager.getBestScore(2)).toBe(500);
        expect(ProgressionManager.getBestScore(3)).toBe(800);
        expect(ProgressionManager.getBestScore(4)).toBe(300);
        
        // Overwrite one doesn't affect others
        ProgressionManager.submitScore(3, 1200);
        expect(ProgressionManager.getBestScore(3)).toBe(1200);
        expect(ProgressionManager.getBestScore(2)).toBe(500);
    });
});

describe('Level Config', () => {
    it('should define Level 1 correctly', () => {
        const l1 = getLevel(1);
        expect(l1.id).toBe(1);
        expect(l1.startValue).toBe(5);
        expect(l1.bossValue).toBe(100);
        expect(l1.reward?.type).toBe('MAX_HP');
        expect(l1.nextLevelId).toBe(2);
    });

    it('should define Level 2 correctly', () => {
        const l2 = getLevel(2);
        expect(l2.id).toBe(2);
        expect(l2.startValue).toBe(5);
        expect(l2.bossValue).toBe(200);
        expect(l2.reward?.type).toBe('MAX_HP');
        expect(l2.nextLevelId).toBe(3);
    });

    it('should define Level 3 correctly', () => {
        const l3 = getLevel(3);
        expect(l3.id).toBe(3);
        expect(l3.startValue).toBe(5);
        expect(l3.bossValue).toBe(300);
        expect(l3.bossTriggerValue).toBe(230);
        expect(l3.normalEnemyMax).toBe(299);
        expect(l3.reward?.type).toBe('MAX_HP');
        expect(l3.nextLevelId).toBe(4);
    });

    it('should define Level 4 correctly', () => {
        const l4 = getLevel(4);
        expect(l4.id).toBe(4);
        expect(l4.startValue).toBe(5);
        expect(l4.bossValue).toBe(400);
        expect(l4.bossTriggerValue).toBe(310);
        expect(l4.normalEnemyMax).toBe(399);
        expect(l4.reward).toBeUndefined();
        expect(l4.nextLevelId).toBeUndefined();
    });
});
