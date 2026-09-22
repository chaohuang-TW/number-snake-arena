import { describe, it, expect } from 'vitest';
import { rectsOverlap, isRectInside, type RectBounds } from '../src/utils/layout';

describe('Layout Geometry Helpers', () => {
    describe('rectsOverlap', () => {
        it('should detect intersecting rectangles', () => {
            const r1: RectBounds = { x: 10, y: 10, width: 50, height: 50 };
            const r2: RectBounds = { x: 30, y: 30, width: 50, height: 50 };
            expect(rectsOverlap(r1, r2)).toBe(true);
            expect(rectsOverlap(r2, r1)).toBe(true);
        });

        it('should treat completely separated rectangles as non-overlapping', () => {
            const r1: RectBounds = { x: 10, y: 10, width: 20, height: 20 };
            const r2: RectBounds = { x: 100, y: 100, width: 30, height: 30 };
            expect(rectsOverlap(r1, r2)).toBe(false);
            expect(rectsOverlap(r2, r1)).toBe(false);
        });

        it('should treat touching edges as non-overlapping', () => {
            const r1: RectBounds = { x: 0, y: 0, width: 50, height: 50 };
            const rRight: RectBounds = { x: 50, y: 0, width: 50, height: 50 };
            const rBottom: RectBounds = { x: 0, y: 50, width: 50, height: 50 };
            expect(rectsOverlap(r1, rRight)).toBe(false);
            expect(rectsOverlap(r1, rBottom)).toBe(false);
        });

        it('should detect containment as overlapping', () => {
            const outer: RectBounds = { x: 0, y: 0, width: 200, height: 200 };
            const inner: RectBounds = { x: 50, y: 50, width: 50, height: 50 };
            expect(rectsOverlap(outer, inner)).toBe(true);
            expect(rectsOverlap(inner, outer)).toBe(true);
        });

        it('should return false for zero or negative dimensions', () => {
            const r1: RectBounds = { x: 0, y: 0, width: 0, height: 50 };
            const r2: RectBounds = { x: 0, y: 0, width: 50, height: 50 };
            expect(rectsOverlap(r1, r2)).toBe(false);
        });
    });

    describe('isRectInside', () => {
        const outer: RectBounds = { x: 0, y: 0, width: 390, height: 844 };

        it('should return true when inner rect is completely inside outer', () => {
            const inner: RectBounds = { x: 222, y: 148, width: 156, height: 160 };
            expect(isRectInside(inner, outer)).toBe(true);
        });

        it('should return false when rect extends outside outer horizontally or vertically', () => {
            const outRight: RectBounds = { x: 300, y: 100, width: 100, height: 50 };
            const outBottom: RectBounds = { x: 100, y: 800, width: 50, height: 50 };
            expect(isRectInside(outRight, outer)).toBe(false);
            expect(isRectInside(outBottom, outer)).toBe(false);
        });
    });
});
