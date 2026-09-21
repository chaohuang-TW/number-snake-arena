import { describe, it, expect } from 'vitest';
import { calculateOrbRewards } from '../src/utils/gameRules';
import { GameBalance } from '../src/config/gameBalance';

describe('Collectible Body Orbs', () => {
    it('grants +10 score and +2 boost with 0 player value gain', () => {
        const initialScore = 150;
        const initialBoost = 50;
        const maxBoost = GameBalance.player.maxBoostEnergy;

        const result = calculateOrbRewards(initialScore, initialBoost, maxBoost);
        expect(result.newScore).toBe(160); // +10 score
        expect(result.newBoost).toBe(52);  // +2 boost
        expect(result.valueGain).toBe(0);  // 0 player value gain
    });

    it('clamps boost energy to maxBoostEnergy', () => {
        const initialScore = 0;
        const initialBoost = 99;
        const maxBoost = 100;

        const result = calculateOrbRewards(initialScore, initialBoost, maxBoost);
        expect(result.newBoost).toBe(100);

        const resultAtMax = calculateOrbRewards(initialScore, 100, maxBoost);
        expect(resultAtMax.newBoost).toBe(100);
    });

    it('has correct balance configuration', () => {
        expect(GameBalance.orb.scoreReward).toBe(10);
        expect(GameBalance.orb.boostReward).toBe(2);
        expect(GameBalance.orb.maxActive).toBe(80);
        expect(GameBalance.orb.lifetime).toBeGreaterThanOrEqual(10000);
        expect(GameBalance.orb.lifetime).toBeLessThanOrEqual(12000);
    });
});
