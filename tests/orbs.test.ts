import { describe, it, expect } from 'vitest';
import { calculateOrbRewards } from '../src/utils/gameRules';
import { GameBalance } from '../src/config/gameBalance';
import { allocateOrbRewards, applyOrbReward, createSnakeOrbDrops } from '../src/systems/OrbRewards';

describe('Collectible Body Orbs', () => {
    it('grants the assigned share with zero player value gain', () => {
        const initialScore = 150;
        const initialBoost = 50;
        const maxBoost = GameBalance.player.maxBoostEnergy;

        const result = calculateOrbRewards(initialScore, initialBoost, maxBoost, { score: 10, energy: 2, value: 0 });
        expect(result.newScore).toBe(160); // +10 score
        expect(result.newBoost).toBe(52);  // +2 boost
        expect(result.valueGain).toBe(0);  // 0 player value gain
    });

    it('clamps boost energy to maxBoostEnergy', () => {
        const initialScore = 0;
        const initialBoost = 99;
        const maxBoost = 100;

        const result = calculateOrbRewards(initialScore, initialBoost, maxBoost, { score: 10, energy: 2, value: 0 });
        expect(result.newBoost).toBe(100);

        const resultAtMax = calculateOrbRewards(initialScore, 100, maxBoost, { score: 10, energy: 2, value: 0 });
        expect(resultAtMax.newBoost).toBe(100);
    });

    it('has correct balance configuration', () => {
        expect(GameBalance.orb.rewardScorePerSnake).toBe(50);
        expect(GameBalance.orb.rewardEnergyPerSnake).toBe(10);
        expect(GameBalance.orb.rewardValuePerSnake).toBe(0);
        expect(GameBalance.orb.maxActive).toBe(160);
        expect(GameBalance.orb.lifetime).toBeGreaterThanOrEqual(10000);
        expect(GameBalance.orb.lifetime).toBeLessThanOrEqual(12000);
    });

    it.each([1, 3, 5, 29, 160])('conserves the fixed pool for %i actual orbs using only integers', count => {
        const rewards = allocateOrbRewards(count);
        expect(rewards.reduce((sum, reward) => sum + reward.score, 0)).toBe(50);
        expect(rewards.reduce((sum, reward) => sum + reward.energy, 0)).toBe(10);
        expect(rewards.every(reward => Number.isInteger(reward.score) && Number.isInteger(reward.energy) && reward.value === 0)).toBe(true);
        const collected = rewards.reduce((state, reward) => {
            const next = applyOrbReward(state.score, state.energy, reward);
            return { score: next.newScore, energy: next.newBoost };
        }, { score: 0, energy: 20 });
        expect(collected).toEqual({ score: 50, energy: 30 });
    });

    it('does not silently grant the obsolete per-circle reward without an assigned share', () => {
        expect(calculateOrbRewards(150, 50)).toEqual({ newScore: 150, newBoost: 50, valueGain: 0 });
        expect(allocateOrbRewards(0)).toEqual([]);
        expect(allocateOrbRewards(NaN)).toEqual([]);
    });

    it('samples the original curved visible path and locks every orb until the full chain ends', () => {
        const path = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
        const drops = createSnakeOrbDrops(path, { maxDrops: 160, spacing: 20, minMs: 250, maxMs: 450, score: 50, energy: 10 });
        expect(drops).toHaveLength(10);
        expect(drops[0].position).toEqual({ x: 20, y: 0 });
        expect(drops[9].position).toEqual({ x: 100, y: 100 });
        expect(drops.every(drop => drop.unlockDelay === 450)).toBe(true);
        expect(drops[0].transformDelay + drops[0].transformDuration).toBe(250);
        expect(drops[9].transformDelay + drops[9].transformDuration).toBe(450);
        expect(drops.reduce((sum, drop) => sum + drop.reward.score, 0)).toBe(50);
    });

    it('caps chain capacity, clamps energy, and never grants value', () => {
        const drops = createSnakeOrbDrops([{ x: 0, y: 0 }, { x: 10000, y: 0 }], { maxDrops: 160, spacing: 20, minMs: 250, maxMs: 450, score: 50, energy: 10 });
        expect(drops).toHaveLength(160);
        expect(applyOrbReward(0, 99, { score: 50, energy: 10, value: 500 })).toEqual({ newScore: 50, newBoost: 100, valueGain: 0 });
    });
});
