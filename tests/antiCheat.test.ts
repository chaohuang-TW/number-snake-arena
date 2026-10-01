import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Canonical browser acceptance integrity', () => {
    const sources = readdirSync(resolve(__dirname, 'e2e'))
        .filter(file => file.endsWith('.spec.cjs') || file === 'helpers.cjs')
        .map(file => readFileSync(resolve(__dirname, 'e2e', file), 'utf8'));
    it('retains browser coverage and excludes synthetic UI/collision results', () => {
        expect(sources.length).toBeGreaterThan(1);
        for (const source of sources) {
            for (const pattern of [".emit('pointerdown')", '.emit("pointerdown")',
                'forceWheelSpin', 'forceCollisionWith', 'forceSpecificEnemy',
                'handleEnemyCollision', 'handleBossCollision', 'handleUltimateBossCollision', '.spin(']) {
                expect(source.includes(pattern), pattern).toBe(false);
            }
        }
    });
    it('never changes canvas size or styles to fit acceptance coordinates', () => {
        expect(sources.join('\n')).not.toMatch(/canvas\.(?:style|width|height)\s*=/);
        expect(readFileSync(resolve(__dirname, '../playwright.config.cjs'), 'utf8')).toContain('retries:0');
    });
});
