import { describe, expect, it } from 'vitest';
import { getSnakeSectionAppearance, getTailTextureKey, TAIL_RENDER_DIRECTIONS } from '../src/utils/snakeAppearance';

describe('Baked snake tip directions', () => {
    it.each([
        [0, 0], [Math.PI / 2, 8], [Math.PI, 16], [Math.PI * 1.5, 24],
        [-Math.PI / 2, 24], [Math.PI * 2, 0], [Math.PI * 10, 0],
        [NaN, 0], [Infinity, 0], [-Infinity, 0]
    ])('normalizes rotation %s to finite direction %s for both sprite families', (angle, direction) => {
        expect(TAIL_RENDER_DIRECTIONS).toBe(32);
        for (const kind of ['player', 'enemy'] as const) expect(getTailTextureKey(kind, angle)).toBe(`${kind}_tail_dir_${direction}`);
    });

    it('quantizes every direction and wraps the nearest bin through zero', () => {
        for (let direction = 0; direction < TAIL_RENDER_DIRECTIONS; direction++) {
            const angle = direction * Math.PI * 2 / TAIL_RENDER_DIRECTIONS;
            expect(getTailTextureKey('player', angle)).toBe(`player_tail_dir_${direction}`);
        }
        expect(getTailTextureKey('player', Math.PI * 2 - 0.01)).toBe('player_tail_dir_0');
        expect(getTailTextureKey('enemy', Math.PI / 16 + 0.01)).toBe('enemy_tail_dir_1');
    });

    it('keeps circular sections unrotated and selects the baked tip with its half-turn', () => {
        expect(getSnakeSectionAppearance('enemy', 2, 5, Math.PI / 2)).toEqual({ isTail: false, texture: 'enemy_body', scale: 0.85, rotation: 0 });
        expect(getSnakeSectionAppearance('enemy', 3, 5, Math.PI / 2)).toEqual({ isTail: false, texture: 'enemy_body', scale: 0.65, rotation: 0 });
        expect(getSnakeSectionAppearance('enemy', 4, 5, Math.PI / 2)).toEqual({ isTail: true, texture: 'enemy_tail_dir_24', scale: 1, rotation: 0 });
    });
});
