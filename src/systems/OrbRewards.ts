import type { BodyPoint } from './BodyCollision';

export interface OrbReward { score: number; energy: number; value: number }
export interface SnakeOrbDrop { position: BodyPoint; reward: OrbReward; transformDelay: number; transformDuration: number; unlockDelay: number }

export function allocateOrbRewards(count: number, score = 50, energy = 10): OrbReward[] {
    const size = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
    if (!size) return [];
    const scorePool = Math.max(0, Math.floor(Number.isFinite(score) ? score : 0));
    const energyPool = Math.max(0, Math.floor(Number.isFinite(energy) ? energy : 0));
    return Array.from({ length: size }, (_, i) => ({
        score: Math.floor(scorePool / size) + (i < scorePool % size ? 1 : 0),
        energy: Math.floor(energyPool / size) + (i < energyPool % size ? 1 : 0), value: 0
    }));
}

/** Head-to-tail chain positions are frozen before the source snake is removed. */
export function createSnakeOrbDrops(path: readonly BodyPoint[], options: { maxDrops: number; spacing: number; minMs: number; maxMs: number; score: number; energy: number }): SnakeOrbDrop[] {
    const points = path.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!points.length) return [];
    const lengths = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    const total = lengths[lengths.length - 1];
    const count = Math.min(Math.max(1, Math.floor(options.maxDrops)), Math.max(1, Math.ceil(total / Math.max(1, options.spacing))));
    const rewards = allocateOrbRewards(count, options.score, options.energy);
    let segment = 1;
    return rewards.map((reward, i) => {
        const distance = total * (i + 1) / count;
        while (segment < lengths.length - 1 && lengths[segment] < distance) segment++;
        const a = points[Math.max(0, segment - 1)], b = points[Math.min(segment, points.length - 1)];
        const span = (lengths[segment] ?? 0) - (lengths[segment - 1] ?? 0);
        const t = span > 0 ? (distance - lengths[segment - 1]) / span : 0;
        return { position: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, reward,
            transformDelay: count > 1 ? (options.maxMs - options.minMs) * i / (count - 1) : 0,
            transformDuration: options.minMs, unlockDelay: options.maxMs };
    });
}

export function applyOrbReward(score: number, boost: number, reward: OrbReward, maxBoost = 100) {
    return { newScore: score + reward.score, newBoost: Math.min(maxBoost, boost + reward.energy), valueGain: 0 };
}
