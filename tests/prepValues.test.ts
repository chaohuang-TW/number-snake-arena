import { describe, it, expect } from 'vitest';
import { normalizeStartValue, PREP_START_VALUES } from '../src/utils/prepValues';

describe('Prep Start Values Utility', () => {
    it('defines the three allowed options: 5, 7, 10', () => {
        expect(PREP_START_VALUES).toEqual([5, 7, 10]);
    });

    it('accepts valid values: 5, 7, 10', () => {
        expect(normalizeStartValue(5)).toBe(5);
        expect(normalizeStartValue(7)).toBe(7);
        expect(normalizeStartValue(10)).toBe(10);
    });

    it('falls back to 5 for invalid or out-of-range values', () => {
        expect(normalizeStartValue(0)).toBe(5);
        expect(normalizeStartValue(999)).toBe(5);
        expect(normalizeStartValue(NaN)).toBe(5);
        expect(normalizeStartValue(undefined)).toBe(5);
        expect(normalizeStartValue(null)).toBe(5);
        expect(normalizeStartValue('10')).toBe(5);
        expect(normalizeStartValue(-5)).toBe(5);
    });
});
