import { describe, it, expect } from 'vitest';
import { getBoundarySteering } from '../src/utils/math';

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
