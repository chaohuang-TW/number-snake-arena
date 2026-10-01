import { describe, expect, it } from 'vitest';
import { GameBalance } from '../src/config/gameBalance';
import { calculateRenderSegments, calculateSnakeLength, DistanceSnakePath, measurePath, normalizeSnakeValue } from '../src/systems/SnakePath';
import { calculateNewBodySegments, calculateTurnRate } from '../src/utils/gameRules';

describe('Value-derived snake length', () => {
    it.each([5, 7, 10, 50, 100, 200, 400, 500])('uses the common curve for Value %s', value => {
        expect(calculateSnakeLength(value)).toBeCloseTo(Math.min(720, Math.max(60, 36 + 24 * Math.sqrt(value))), 8);
        const playerPath = new DistanceSnakePath(0, 0, value);
        const enemyPath = new DistanceSnakePath(100, 80, value);
        expect(playerPath.targetLength).toBe(enemyPath.targetLength);
    });

    it('bounds body length and rendering without bounding Value', () => {
        expect(calculateSnakeLength(0.01)).toBe(60);
        expect(calculateSnakeLength(1000000)).toBe(720);
        expect(normalizeSnakeValue(1000000)).toBe(1000000);
        expect(calculateRenderSegments(1000000)).toBe(40);
        expect(calculateRenderSegments(5)).toBe(5);
        expect(calculateRenderSegments(10)).toBe(7);
    });

    it.each([NaN, Infinity, -Infinity, 0, -5])('safely falls back for invalid Value %s', value => {
        expect(calculateSnakeLength(value)).toBe(calculateSnakeLength(5));
        expect(Number.isFinite(calculateSnakeLength(value))).toBe(true);
        const path = new DistanceSnakePath(0, 0, 50);
        path.setValue(value);
        expect(path.targetLength).toBe(calculateSnakeLength(50));
    });

    it('damage cannot trim the Value-defined drawing count', () => {
        expect(calculateNewBodySegments(12, 1)).toBe(12);
        expect(calculateNewBodySegments(32, 3)).toBe(32);
    });

    it('retains the original steering penalty cap independently of draw density', () => {
        expect(calculateTurnRate(5)).toBe(GameBalance.player.turnRate);
        expect(calculateTurnRate(10000)).toBeCloseTo(GameBalance.player.turnRate * 0.82);
    });
});

describe('Distance-recorded paths', () => {
    it.each([30, 60, 144])('keeps length and sample spacing at %s fps during normal and boost movement', fps => {
        for (const speed of [220, 340]) {
            const path = new DistanceSnakePath(0, 0, 500);
            const frames = fps * 5;
            for (let frame = 1; frame <= frames; frame++) path.update(speed * frame / fps, 0, 1000 / fps);
            expect(measurePath(path.getVisiblePath())).toBeCloseTo(calculateSnakeLength(500), 6);
            const samples = path.getVisibleSamples();
            for (let i = 1; i < samples.length - 1; i++) expect(samples[i].distance - samples[i - 1].distance).toBeCloseTo(18, 6);
            expect(samples[samples.length - 1].distance).toBeCloseTo(calculateSnakeLength(500), 6);
            expect(path.pointCount).toBeLessThanOrEqual(path.maxPointCount);
        }
    });

    it('turns remain connected and sampling follows the travelled corner', () => {
        const path = new DistanceSnakePath(0, 0, 100);
        for (let x = 4; x <= 200; x += 4) path.update(x, 0, 16);
        for (let y = 4; y <= 200; y += 4) path.update(200, y, 16);
        expect(measurePath(path.getVisiblePath())).toBeCloseTo(276, 6);
        const samples = path.getVisibleSamples();
        expect(samples.some(point => point.x < 200 && point.y === 0)).toBe(true);
        expect(samples.some(point => point.x === 200 && point.y > 0)).toBe(true);
        for (let i = 1; i < samples.length; i++) {
            expect(Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y)).toBeLessThanOrEqual(18.000001);
        }
    });

    it('grows backwards from the existing tail instead of creating new nodes at the head', () => {
        const path = new DistanceSnakePath(0, 0, 5);
        path.update(1000, 0, 1000);
        const oldTail = path.getVisibleSamples().at(-1)!;
        path.setValue(100);
        expect(path.currentLength).toBeCloseTo(calculateSnakeLength(5));
        path.update(1000, 0, 16);
        const newTail = path.getVisibleSamples().at(-1)!;
        expect(oldTail.x - newTail.x).toBeCloseTo(GameBalance.snake.growthSpeed * 0.016);
        expect(newTail.x).toBeGreaterThan(700);
        expect(newTail.x).toBeLessThan(oldTail.x);
        path.update(1000, 0, 2000);
        expect(path.currentLength).toBe(calculateSnakeLength(100));
    });

    it('spawn, teleport and stationary updates have no stacked or hidden body path', () => {
        const path = new DistanceSnakePath(10, 20, 500);
        expect(path.getVisibleSamples()).toEqual([]);
        expect(path.getVisiblePath()).toEqual([{ x: 10, y: 20 }]);
        for (let i = 0; i < 10000; i++) path.update(10, 20, 16);
        expect(path.pointCount).toBe(2);
        path.update(1000, 20, 1000);
        expect(path.getVisibleSamples().length).toBeGreaterThan(0);
        path.reset(-10, -20);
        expect(path.getVisibleSamples()).toEqual([]);
        expect(path.visibleLength).toBe(0);
    });

    it('only samples distances that have been visibly deployed', () => {
        const path = new DistanceSnakePath(0, 0, 500);
        path.update(30, 0, 16);
        expect(path.sample(36)).toBeUndefined();
        expect(measurePath(path.getVisiblePath())).toBe(30);
        expect(path.getVisibleSamples().map(point => point.distance)).toEqual([18, 30]);
    });

    it('bounds repeated movement and large jumps and ignores non-finite positions', () => {
        const path = new DistanceSnakePath(0, 0, 1000000);
        for (let i = 1; i <= 10000; i++) path.update(i * 10, 0, 16);
        expect(path.pointCount).toBeLessThanOrEqual(path.maxPointCount);
        expect(path.getVisibleSamples()).toHaveLength(40);
        path.update(1000000, 0, 16);
        expect(path.pointCount).toBeLessThanOrEqual(path.maxPointCount);
        const before = path.getVisiblePath();
        path.update(NaN, Infinity, 16);
        expect(path.getVisiblePath()).toEqual(before);
    });

    it('separation preserves shape and head-first test initialization uses valid records', () => {
        const path = new DistanceSnakePath(0, 0, 100);
        path.seed([{ x: 0, y: -140 }, { x: 0, y: 180 }]);
        const before = path.getVisiblePath();
        expect(before[0]).toEqual({ x: 0, y: -140 });
        expect(measurePath(before)).toBe(276);
        path.translate(12, -4);
        expect(path.getVisiblePath()).toEqual(before.map(point => ({ x: point.x + 12, y: point.y - 4 })));
        expect(measurePath(path.getVisiblePath())).toBe(276);
    });
});
