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
        
        // Cannot claim twice
        expect(ProgressionManager.claimReward('test-reward', 1)).toBe(false);
        expect(ProgressionManager.getMaxHP()).toBe(4);
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
    });
});
