import { describe, it, expect } from 'vitest';
import { isMagnetEligible } from '../src/utils/gameRules';
import { GameBalance } from '../src/config/gameBalance';
import { MagnetContactGuard } from '../src/systems/MagnetContactGuard';

describe('Magnet Ability', () => {
    it('suppresses only the contacted enemy for 450ms and cleans expired/reset entries', () => {
        const guard = new MagnetContactGuard();
        guard.suppress('enemy1', 1450);
        expect(guard.isSuppressed('enemy1', 1000)).toBe(true);
        expect(guard.isSuppressed('enemy1', 1449)).toBe(true);
        expect(guard.isSuppressed('enemy2', 1000)).toBe(false);
        expect(guard.isSuppressed('enemy1', 1450)).toBe(false);
        guard.suppress('enemy1', 2000);
        guard.forget('enemy1');
        expect(guard.isSuppressed('enemy1', 1500)).toBe(false);
        guard.suppress('enemy2', 2000);
        guard.clear();
        expect(guard.isSuppressed('enemy2', 1500)).toBe(false);
    });
    describe('Balance Configuration', () => {
        it('has correct radius, duration, and cooldown', () => {
            expect(GameBalance.magnet.radius).toBe(260);
            expect(GameBalance.magnet.duration).toBe(8000);
            expect(GameBalance.magnet.cooldown).toBe(20000);
        });
    });

    describe('Target Eligibility', () => {
        it('smaller enemy is eligible (Player 10 vs Enemy 5)', () => {
            expect(isMagnetEligible(10, 5, false)).toBe(true);
        });

        it('equal enemy is NOT eligible (Player 10 vs Enemy 10)', () => {
            expect(isMagnetEligible(10, 10, false)).toBe(false);
        });

        it('larger enemy is NOT eligible (Player 10 vs Enemy 11)', () => {
            expect(isMagnetEligible(10, 11, false)).toBe(false);
        });

        it('boss is NEVER eligible even if player value is greater', () => {
            expect(isMagnetEligible(150, 100, true)).toBe(false);
            expect(isMagnetEligible(250, 200, true)).toBe(false);
            expect(isMagnetEligible(350, 300, true)).toBe(false);
            expect(isMagnetEligible(450, 400, true)).toBe(false);
        });

        it('boundary check (Player 5 vs Enemy 4)', () => {
            expect(isMagnetEligible(5, 4, false)).toBe(true);
            expect(isMagnetEligible(5, 5, false)).toBe(false);
            expect(isMagnetEligible(5, 6, false)).toBe(false);
        });
    });
});
