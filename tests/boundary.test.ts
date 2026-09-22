import { describe, it, expect } from 'vitest';
import { getBoundarySteering } from '../src/utils/math';
import { getSafeWorldBounds, clampToSafeWorld, getInwardBoundarySteering } from '../src/utils/boundary';

describe('Boundary Steering', () => {
    const hw = 1200;
    const hh = 800;
    const soft = 160;

    it('returns zero at center', () => {
        const s = getBoundarySteering(0, 0, hw, hh, soft);
        expect(s.x).toBe(0);
        expect(s.y).toBe(0);
    });

    it('returns left steer near right edge', () => {
        const s = getBoundarySteering(1100, 0, hw, hh, soft);
        expect(s.x).toBeLessThan(0);
        expect(s.y).toBe(0);
    });

    it('returns right steer near left edge', () => {
        const s = getBoundarySteering(-1100, 0, hw, hh, soft);
        expect(s.x).toBeGreaterThan(0);
        expect(s.y).toBe(0);
    });

    it('returns up steer near bottom edge', () => {
        const s = getBoundarySteering(0, 700, hw, hh, soft);
        expect(s.x).toBe(0);
        expect(s.y).toBeLessThan(0);
    });

    it('returns down steer near top edge', () => {
        const s = getBoundarySteering(0, -700, hw, hh, soft);
        expect(s.x).toBe(0);
        expect(s.y).toBeGreaterThan(0);
    });

    it('returns diagonal down-left near top-right corner', () => {
        const s = getBoundarySteering(1100, -700, hw, hh, soft);
        expect(s.x).toBeLessThan(0);
        expect(s.y).toBeGreaterThan(0);
    });

    it('returns diagonal up-left near bottom-right corner', () => {
        const s = getBoundarySteering(1100, 700, hw, hh, soft);
        expect(s.x).toBeLessThan(0);
        expect(s.y).toBeLessThan(0);
    });

    it('strength near hard edge > strength near soft-zone entrance', () => {
        const sSoft = getBoundarySteering(1050, 0, hw, hh, soft); // 10px in
        const sHard = getBoundarySteering(1190, 0, hw, hh, soft); // 150px in
        expect(Math.abs(sHard.x)).toBeGreaterThan(Math.abs(sSoft.x));
    });
});

describe('Boss Boundary Safe Limits & Clamp (Section 19)', () => {
    const worldW = 2400;
    const worldH = 1600;
    const margin = 100;
    const bounds = getSafeWorldBounds(worldW, worldH, margin);

    it('computes correct legal Boss center limits (-1100 to +1100, -700 to +700)', () => {
        expect(bounds.minX).toBe(-1100);
        expect(bounds.maxX).toBe(1100);
        expect(bounds.minY).toBe(-700);
        expect(bounds.maxY).toBe(700);
    });

    it('center remains unchanged', () => {
        const c = clampToSafeWorld(0, 0, bounds);
        expect(c.x).toBe(0);
        expect(c.y).toBe(0);
    });

    it('left outside is clamped to -1100', () => {
        const c = clampToSafeWorld(-1250, 50, bounds);
        expect(c.x).toBe(-1100);
        expect(c.y).toBe(50);
    });

    it('right outside is clamped to +1100', () => {
        const c = clampToSafeWorld(1300, -20, bounds);
        expect(c.x).toBe(1100);
        expect(c.y).toBe(-20);
    });

    it('top outside is clamped to -700', () => {
        const c = clampToSafeWorld(100, -900, bounds);
        expect(c.x).toBe(100);
        expect(c.y).toBe(-700);
    });

    it('bottom outside is clamped to +700', () => {
        const c = clampToSafeWorld(-100, 850, bounds);
        expect(c.x).toBe(-100);
        expect(c.y).toBe(700);
    });

    it('all four corners are clamped correctly', () => {
        const topLeft = clampToSafeWorld(-1500, -1000, bounds);
        expect(topLeft.x).toBe(-1100);
        expect(topLeft.y).toBe(-700);

        const topRight = clampToSafeWorld(1500, -1000, bounds);
        expect(topRight.x).toBe(1100);
        expect(topRight.y).toBe(-700);

        const bottomLeft = clampToSafeWorld(-1500, 1000, bounds);
        expect(bottomLeft.x).toBe(-1100);
        expect(bottomLeft.y).toBe(700);

        const bottomRight = clampToSafeWorld(1500, 1000, bounds);
        expect(bottomRight.x).toBe(1100);
        expect(bottomRight.y).toBe(700);
    });
});

describe('Boss Inward Boundary Steering (Section 20)', () => {
    const worldW = 2400;
    const worldH = 1600;
    const margin = 100;
    const softZone = 250;

    it('near right boundary: steering X < 0 and Y ≈ 0', () => {
        const s = getInwardBoundarySteering(1100, 0, worldW, worldH, margin, softZone);
        expect(s.x).toBeLessThan(0);
        expect(s.y).toBe(0);
    });

    it('near left boundary: steering X > 0 and Y ≈ 0', () => {
        const s = getInwardBoundarySteering(-1100, 0, worldW, worldH, margin, softZone);
        expect(s.x).toBeGreaterThan(0);
        expect(s.y).toBe(0);
    });

    it('near top boundary: steering Y > 0 and X ≈ 0', () => {
        const s = getInwardBoundarySteering(0, -700, worldW, worldH, margin, softZone);
        expect(s.x).toBe(0);
        expect(s.y).toBeGreaterThan(0);
    });

    it('near bottom boundary: steering Y < 0 and X ≈ 0', () => {
        const s = getInwardBoundarySteering(0, 700, worldW, worldH, margin, softZone);
        expect(s.x).toBe(0);
        expect(s.y).toBeLessThan(0);
    });

    it('corners: both axes steer inward', () => {
        const tr = getInwardBoundarySteering(1100, -700, worldW, worldH, margin, softZone);
        expect(tr.x).toBeLessThan(0);
        expect(tr.y).toBeGreaterThan(0);

        const bl = getInwardBoundarySteering(-1100, 700, worldW, worldH, margin, softZone);
        expect(bl.x).toBeGreaterThan(0);
        expect(bl.y).toBeLessThan(0);

        const tl = getInwardBoundarySteering(-1100, -700, worldW, worldH, margin, softZone);
        expect(tl.x).toBeGreaterThan(0);
        expect(tl.y).toBeGreaterThan(0);

        const br = getInwardBoundarySteering(1100, 700, worldW, worldH, margin, softZone);
        expect(br.x).toBeLessThan(0);
        expect(br.y).toBeLessThan(0);
    });

    it('center: boundary steering is approximately zero', () => {
        const s = getInwardBoundarySteering(0, 0, worldW, worldH, margin, softZone);
        expect(s.x).toBe(0);
        expect(s.y).toBe(0);
    });
});
