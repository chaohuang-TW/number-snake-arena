import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Anti-Cheat Static Audit for Physical Acceptance', () => {
    const e2ePath = path.resolve(__dirname, 'e2e/run-e2e.cjs');
    const e2eSource = fs.readFileSync(e2ePath, 'utf-8');

    const forbiddenPatterns = [
        ".emit('pointerdown')",
        '.emit("pointerdown")',
        '.spin(',
        'forceWheelSpin',
        'forceCollisionWithBoss',
        'forceCollisionWithUltimateBoss',
        'handleBossCollision',
        'handleUltimateBossCollision'
    ];

    function extractSection(source: string, startMarker: string, endMarker: string): string {
        const start = source.indexOf(startMarker);
        if (start === -1) throw new Error(`Start marker "${startMarker}" not found`);
        const end = source.indexOf(endMarker, start);
        if (end === -1) throw new Error(`End marker "${endMarker}" not found`);
        return source.substring(start, end);
    }

    it('asserts Test AW contains NO synthetic UI fallbacks', () => {
        const section = extractSection(e2eSource, '--- Test AW: PREP ROUTING ---', '--- Test AX:');
        for (const pattern of forbiddenPatterns) {
            expect(section.includes(pattern), `Test AW should not contain ${pattern}`).toBe(false);
        }
    });

    it('asserts Test BP contains NO synthetic spin fallbacks or helpers', () => {
        const section = extractSection(e2eSource, '--- Test BP: Lucky Wheel Real Spin & Single-Spin Guard ---', '--- Test BR:');
        for (const pattern of forbiddenPatterns) {
            expect(section.includes(pattern), `Test BP should not contain ${pattern}`).toBe(false);
        }
    });

    it('asserts executeRealWheelRewardFlow (BQ & BZ) contains NO synthetic UI or spin fallbacks', () => {
        const section = extractSection(e2eSource, 'async function executeRealWheelRewardFlow', '--- Test BQ:');
        for (const pattern of forbiddenPatterns) {
            expect(section.includes(pattern), `executeRealWheelRewardFlow should not contain ${pattern}`).toBe(false);
        }
    });

    it('asserts Test BQ contains NO synthetic UI fallbacks or forced transitions', () => {
        const section = extractSection(e2eSource, '--- Test BQ: Production Rewards Verification', '--- Test BW:');
        for (const pattern of forbiddenPatterns) {
            expect(section.includes(pattern), `Test BQ should not contain ${pattern}`).toBe(false);
        }
    });

    it('asserts Test BW contains NO synthetic physics or UI fallbacks', () => {
        const section = extractSection(e2eSource, '--- Test BW: Real End-To-End Finale (zh-TW) ---', '--- Test BX:');
        for (const pattern of forbiddenPatterns) {
            expect(section.includes(pattern), `Test BW should not contain ${pattern}`).toBe(false);
        }
    });

    it('asserts Test BZ contains NO synthetic UI fallbacks', () => {
        const section = extractSection(e2eSource, '--- Test BZ: Production Rewards Verification', '=== FINAL SCRIPT RESULTS ===');
        for (const pattern of forbiddenPatterns) {
            expect(section.includes(pattern), `Test BZ should not contain ${pattern}`).toBe(false);
        }
    });
});
