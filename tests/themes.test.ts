import { describe, it, expect } from 'vitest';
import { LEVELS, getLevel } from '../src/config/levels';

describe('Level Background Themes', () => {
    it('defines distinct themes for levels 1 through 4', () => {
        expect(LEVELS[1].theme).toBe('neon-grid');
        expect(LEVELS[2].theme).toBe('cyber-city');
        expect(LEVELS[3].theme).toBe('lava-core');
        expect(LEVELS[4].theme).toBe('deep-space');
    });

    it('preserves all locked numeric gameplay parameters', () => {
        // Level 1
        const l1 = getLevel(1);
        expect(l1.startValue).toBe(5);
        expect(l1.bossValue).toBe(100);
        expect(l1.bossTriggerValue).toBe(70);
        expect(l1.normalEnemyMax).toBe(99);

        // Level 2
        const l2 = getLevel(2);
        expect(l2.startValue).toBe(5);
        expect(l2.bossValue).toBe(200);
        expect(l2.bossTriggerValue).toBe(150);
        expect(l2.normalEnemyMax).toBe(199);

        // Level 3
        const l3 = getLevel(3);
        expect(l3.startValue).toBe(5);
        expect(l3.bossValue).toBe(300);
        expect(l3.bossTriggerValue).toBe(230);
        expect(l3.normalEnemyMax).toBe(299);

        // Level 4
        const l4 = getLevel(4);
        expect(l4.startValue).toBe(5);
        expect(l4.bossValue).toBe(400);
        expect(l4.bossTriggerValue).toBe(310);
        expect(l4.normalEnemyMax).toBe(399);

        // Level 5 does NOT exist
        expect(LEVELS[5]).toBeUndefined();
    });
});
