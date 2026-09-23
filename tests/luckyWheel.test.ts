import { describe, it, expect } from 'vitest';
import { WHEEL_REWARDS, pickWheelReward, applyWheelReward, type WheelReward } from '../src/utils/luckyWheel';

describe('Lucky Wheel Reward System', () => {
    it('defines exactly 6 unique rewards', () => {
        expect(WHEEL_REWARDS.length).toBe(6);
        const ids = WHEEL_REWARDS.map(r => r.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(6);
        expect(ids).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    });

    it('picks deterministic rewards based on random value across [0, 1)', () => {
        expect(pickWheelReward(0.0).id).toBe('A');
        expect(pickWheelReward(0.16).id).toBe('A');
        expect(pickWheelReward(0.17).id).toBe('B');
        expect(pickWheelReward(0.33).id).toBe('B');
        expect(pickWheelReward(0.34).id).toBe('C');
        expect(pickWheelReward(0.49).id).toBe('C');
        expect(pickWheelReward(0.50).id).toBe('D');
        expect(pickWheelReward(0.66).id).toBe('D');
        expect(pickWheelReward(0.67).id).toBe('E');
        expect(pickWheelReward(0.83).id).toBe('E');
        expect(pickWheelReward(0.84).id).toBe('F');
        expect(pickWheelReward(0.9999).id).toBe('F');
    });

    it('clamps negative or >= 1 values safely', () => {
        expect(pickWheelReward(-0.5).id).toBe('A');
        expect(pickWheelReward(1.0).id).toBe('F');
        expect(pickWheelReward(1.5).id).toBe('F');
    });

    it('applies Reward A (+100 value)', () => {
        const player = { value: 10, hp: 1, maxHp: 3, boostEnergy: 50 };
        const reward = WHEEL_REWARDS.find(r => r.id === 'A')!;
        applyWheelReward(player, reward);

        expect(player.value).toBe(110);
        expect(player.hp).toBe(1);
        expect(player.boostEnergy).toBe(50);
    });

    it('applies Reward B (+150 value)', () => {
        const player = { value: 20, hp: 2, maxHp: 3, boostEnergy: 30 };
        const reward = WHEEL_REWARDS.find(r => r.id === 'B')!;
        applyWheelReward(player, reward);

        expect(player.value).toBe(170);
        expect(player.hp).toBe(2);
        expect(player.boostEnergy).toBe(30);
    });

    it('applies Reward C (+75 value, Full HP)', () => {
        const player = { value: 50, hp: 1, maxHp: 4, boostEnergy: 40 };
        const reward = WHEEL_REWARDS.find(r => r.id === 'C')!;
        applyWheelReward(player, reward);

        expect(player.value).toBe(125);
        expect(player.hp).toBe(4); // Restored to maxHp
        expect(player.boostEnergy).toBe(40);
    });

    it('applies Reward D (+75 value, Boost 100)', () => {
        const player = { value: 100, hp: 2, maxHp: 3, boostEnergy: 10 };
        const reward = WHEEL_REWARDS.find(r => r.id === 'D')!;
        applyWheelReward(player, reward);

        expect(player.value).toBe(175);
        expect(player.hp).toBe(2);
        expect(player.boostEnergy).toBe(100); // Restored to 100
    });

    it('applies Reward E (+75 value, Magnet Ready)', () => {
        const player = { value: 80, hp: 3, maxHp: 3, boostEnergy: 60 };
        let resetCalled = false;
        const fakeMagnet = {
            resetCooldown: () => { resetCalled = true; }
        };
        const reward = WHEEL_REWARDS.find(r => r.id === 'E')!;
        applyWheelReward(player, reward, fakeMagnet);

        expect(player.value).toBe(155);
        expect(resetCalled).toBe(true);
    });

    it('applies Reward F (+200 value, Full HP, Boost 100)', () => {
        const player = { value: 150, hp: 1, maxHp: 5, boostEnergy: 0 };
        const reward = WHEEL_REWARDS.find(r => r.id === 'F')!;
        applyWheelReward(player, reward);

        expect(player.value).toBe(350);
        expect(player.hp).toBe(5);
        expect(player.boostEnergy).toBe(100);
    });
});
