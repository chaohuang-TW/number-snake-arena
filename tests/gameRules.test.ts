import { describe, it, expect } from 'vitest';
import { isEdible, calculateNewPlayerValue, calculateDamage } from '../src/utils/gameRules';

describe('Game Rules', () => {
    describe('isEdible', () => {
        it('Player 5 / Enemy 4 -> true', () => {
            expect(isEdible(5, 4)).toBe(true);
        });
        it('Player 5 / Enemy 5 -> false', () => {
            expect(isEdible(5, 5)).toBe(false);
        });
        it('Player 5 / Enemy 6 -> false', () => {
            expect(isEdible(5, 6)).toBe(false);
        });
        it('Player 99 / Boss 100 -> false', () => {
            expect(isEdible(99, 100)).toBe(false);
        });
        it('Player 100 / Boss 100 -> false', () => {
            expect(isEdible(100, 100)).toBe(false);
        });
        it('Player 101 / Boss 100 -> true', () => {
            expect(isEdible(101, 100)).toBe(true);
        });
    });

    describe('calculateNewPlayerValue', () => {
        it('5 + 3 = 8', () => {
            expect(calculateNewPlayerValue(5, 3)).toBe(8);
        });
        it('8 + 7 = 15', () => {
            expect(calculateNewPlayerValue(8, 7)).toBe(15);
        });
    });

    describe('calculateDamage', () => {
        it('R = 1.0 (Mild)', () => {
            const { hpLoss, instantKO } = calculateDamage(10, 10);
            expect(hpLoss).toBe(1);
            expect(instantKO).toBe(false);
        });
        it('R = 1.49 (Mild)', () => {
            const { hpLoss, instantKO } = calculateDamage(100, 149);
            expect(hpLoss).toBe(1);
            expect(instantKO).toBe(false);
        });
        it('R = 1.5 (High)', () => {
            const { hpLoss, instantKO } = calculateDamage(10, 15);
            expect(hpLoss).toBe(2);
            expect(instantKO).toBe(false);
        });
        it('R = 2.49 (High)', () => {
            const { hpLoss, instantKO } = calculateDamage(100, 249);
            expect(hpLoss).toBe(2);
            expect(instantKO).toBe(false);
        });
        it('R = 2.5 (Instant KO)', () => {
            const { hpLoss, instantKO } = calculateDamage(10, 25);
            expect(instantKO).toBe(true);
        });
        
        it('Boss: Player 100 / Boss 100 (R = 1.0)', () => {
            const { hpLoss, instantKO } = calculateDamage(100, 100);
            expect(hpLoss).toBe(1);
            expect(instantKO).toBe(false);
        });
        it('Boss: Player 80 / Boss 100 (R = 1.25)', () => {
            const { hpLoss, instantKO } = calculateDamage(80, 100);
            expect(hpLoss).toBe(1);
            expect(instantKO).toBe(false);
        });
        it('Boss: Player 50 / Boss 100 (R = 2.0)', () => {
            const { hpLoss, instantKO } = calculateDamage(50, 100);
            expect(hpLoss).toBe(2);
            expect(instantKO).toBe(false);
        });
        it('Boss: Player 40 / Boss 100 (R = 2.5)', () => {
            const { hpLoss, instantKO } = calculateDamage(40, 100);
            expect(instantKO).toBe(true);
        });
    });
});
