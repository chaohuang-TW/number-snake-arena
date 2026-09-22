export const PREP_START_VALUES = [5, 7, 10] as const;
export type PrepStartValue = typeof PREP_START_VALUES[number];

/**
 * Validates and normalizes pre-battle Start Value choices.
 * Allowed: 5, 7, 10. Fallback: 5.
 */
export function normalizeStartValue(value: unknown): PrepStartValue {
    if (typeof value === 'number' && PREP_START_VALUES.includes(value as PrepStartValue)) {
        return value as PrepStartValue;
    }
    return 5;
}
