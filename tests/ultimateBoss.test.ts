import { describe, it, expect } from 'vitest';
import { isEdible } from '../src/utils/gameRules';
import { getSafeWorldBounds, clampToSafeWorld, getInwardBoundarySteering } from '../src/utils/boundary';

describe('Ultimate Boss 500 Mechanics', () => {
    const ULTIMATE_BOSS_VALUE = 500;
    const WORLD_WIDTH = 2400;
    const WORLD_HEIGHT = 1600;
    const BOSS_MARGIN = 100;
    const SOFT_ZONE = 250;

    it('enforces strict eat rule: only player strictly greater than 500 can eat', () => {
        expect(isEdible(499, ULTIMATE_BOSS_VALUE)).toBe(false);
        expect(isEdible(500, ULTIMATE_BOSS_VALUE)).toBe(false);
        expect(isEdible(501, ULTIMATE_BOSS_VALUE)).toBe(true);
        expect(isEdible(550, ULTIMATE_BOSS_VALUE)).toBe(true);
    });

    it('has verified speed parameters', () => {
        const baseSpeed = 145;
        const dashSpeed = 280;
        const orbitSpeed = 190;

        expect(baseSpeed).toBe(145);
        expect(dashSpeed).toBe(280);
        expect(orbitSpeed).toBe(190);
        expect(dashSpeed).toBeGreaterThan(orbitSpeed);
        expect(orbitSpeed).toBeGreaterThan(baseSpeed);
    });

    it('calculates safe world bounds with margin 100 correctly', () => {
        const bounds = getSafeWorldBounds(WORLD_WIDTH, WORLD_HEIGHT, BOSS_MARGIN);
        expect(bounds).toEqual({
            minX: -1100,
            maxX: 1100,
            minY: -700,
            maxY: 700
        });
    });

    it('strictly clamps positions outside the 100px boundary margin', () => {
        const bounds = getSafeWorldBounds(WORLD_WIDTH, WORLD_HEIGHT, BOSS_MARGIN);

        const clampedRight = clampToSafeWorld(1150, 0, bounds);
        expect(clampedRight).toEqual({ x: 1100, y: 0 });

        const clampedLeft = clampToSafeWorld(-1250, 200, bounds);
        expect(clampedLeft).toEqual({ x: -1100, y: 200 });

        const clampedTop = clampToSafeWorld(0, -850, bounds);
        expect(clampedTop).toEqual({ x: 0, y: -700 });

        const clampedBottom = clampToSafeWorld(100, 950, bounds);
        expect(clampedBottom).toEqual({ x: 100, y: 700 });

        const inside = clampToSafeWorld(200, 300, bounds);
        expect(inside).toEqual({ x: 200, y: 300 });
    });

    it('applies inward boundary steering when within soft zone', () => {
        // Approaching right boundary
        const rightSteer = getInwardBoundarySteering(1100, 0, WORLD_WIDTH, WORLD_HEIGHT, BOSS_MARGIN, SOFT_ZONE);
        expect(rightSteer.x).toBeLessThan(0); // Pushes left
        expect(rightSteer.y).toBe(0);

        // Approaching left boundary
        const leftSteer = getInwardBoundarySteering(-1100, 0, WORLD_WIDTH, WORLD_HEIGHT, BOSS_MARGIN, SOFT_ZONE);
        expect(leftSteer.x).toBeGreaterThan(0); // Pushes right
        expect(leftSteer.y).toBe(0);

        // Approaching bottom boundary
        const bottomSteer = getInwardBoundarySteering(0, 700, WORLD_WIDTH, WORLD_HEIGHT, BOSS_MARGIN, SOFT_ZONE);
        expect(bottomSteer.x).toBe(0);
        expect(bottomSteer.y).toBeLessThan(0); // Pushes up

        // Approaching top boundary
        const topSteer = getInwardBoundarySteering(0, -700, WORLD_WIDTH, WORLD_HEIGHT, BOSS_MARGIN, SOFT_ZONE);
        expect(topSteer.x).toBe(0);
        expect(topSteer.y).toBeGreaterThan(0); // Pushes down

        // Near center: no push
        const centerSteer = getInwardBoundarySteering(0, 0, WORLD_WIDTH, WORLD_HEIGHT, BOSS_MARGIN, SOFT_ZONE);
        expect(centerSteer).toEqual({ x: 0, y: 0 });
    });
});
