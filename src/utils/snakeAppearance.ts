import { getTailScale } from './gameRules';

export type SnakeAppearanceKind = 'player' | 'enemy';
export const TAIL_RENDER_DIRECTIONS = 32;
export const TAIL_DIRECTIONS = TAIL_RENDER_DIRECTIONS;

/** Angle rotates the legacy left-pointing tip; direction is baked into its texture. */
export function getTailTextureKey(kind: SnakeAppearanceKind, angle: number): string {
    const turn = Math.PI * 2;
    const normalized = Number.isFinite(angle) ? ((angle % turn) + turn) % turn : 0;
    const direction = Math.round(normalized / turn * TAIL_RENDER_DIRECTIONS) % TAIL_RENDER_DIRECTIONS;
    return `${kind}_tail_dir_${direction}`;
}

export function getSnakeSectionAppearance(kind: SnakeAppearanceKind, index: number, count: number, sampleAngle: number) {
    const isTail = index === count - 1;
    return {
        isTail,
        texture: isTail ? getTailTextureKey(kind, sampleAngle + Math.PI) : `${kind}_body`,
        scale: isTail ? 1 : getTailScale(index, count),
        rotation: 0
    };
}
