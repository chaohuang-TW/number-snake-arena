import { describe, it, expect } from 'vitest';
import { getTailScale } from '../src/utils/gameRules';

describe('Snake Tapered Tail', () => {
    it('scales correctly for a 5-segment snake', () => {
        const total = 5;
        // Segment 0, 1: Middle segments (full scale ~1.0)
        expect(getTailScale(0, total)).toBe(1.0);
        expect(getTailScale(1, total)).toBe(1.0);
        // Segment 2: third-from-last (~0.85)
        expect(getTailScale(2, total)).toBeCloseTo(0.85, 2);
        // Segment 3: second-from-last (~0.65)
        expect(getTailScale(3, total)).toBeCloseTo(0.65, 2);
        // Segment 4: last segment (~0.50)
        expect(getTailScale(4, total)).toBeCloseTo(0.50, 2);
    });

    it('scales correctly for an 8-segment snake', () => {
        const total = 8;
        // Segments 0 to 4: full scale
        for (let i = 0; i < 5; i++) {
            expect(getTailScale(i, total)).toBe(1.0);
        }
        // Segment 5: third-from-last
        expect(getTailScale(5, total)).toBeCloseTo(0.85, 2);
        // Segment 6: second-from-last
        expect(getTailScale(6, total)).toBeCloseTo(0.65, 2);
        // Segment 7: last
        expect(getTailScale(7, total)).toBeCloseTo(0.50, 2);
    });

    it('does not crash for edge case segment counts', () => {
        expect(() => getTailScale(0, 1)).not.toThrow();
        expect(getTailScale(0, 1)).toBeCloseTo(0.50, 2);

        expect(() => getTailScale(0, 2)).not.toThrow();
        expect(getTailScale(0, 2)).toBeCloseTo(0.65, 2);
        expect(getTailScale(1, 2)).toBeCloseTo(0.50, 2);

        expect(() => getTailScale(0, 0)).not.toThrow();
        expect(getTailScale(0, 0)).toBe(1.0);
    });
});
