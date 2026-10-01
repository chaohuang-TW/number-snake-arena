import { GameBalance } from '../config/gameBalance';

export interface SnakePoint {
    x: number;
    y: number;
}

export interface SnakePathSample extends SnakePoint {
    distance: number;
    angle: number;
}

const EPSILON = 0.000001;

export function normalizeSnakeValue(value: number, fallback = GameBalance.player.initialValue): number {
    if (Number.isFinite(value) && value > 0) return value;
    return Number.isFinite(fallback) && fallback > 0 ? fallback : GameBalance.player.initialValue;
}

export function calculateSnakeLength(value: number): number {
    const settings = GameBalance.snake;
    const length = settings.baseLength + settings.sqrtScale * Math.sqrt(normalizeSnakeValue(value));
    return Math.max(settings.minLength, Math.min(settings.maxLength, length));
}

export function calculateRenderSegments(value: number): number {
    return renderSegmentCount(calculateSnakeLength(value));
}

export function renderSegmentCount(length: number): number {
    return Math.min(GameBalance.snake.maxRenderSegments, Math.max(1, Math.ceil(length / GameBalance.snake.sampleSpacing)));
}

function pointDistance(a: SnakePoint, b: SnakePoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export function measurePath(points: readonly SnakePoint[]): number {
    let length = 0;
    for (let i = 1; i < points.length; i++) length += pointDistance(points[i - 1], points[i]);
    return length;
}

/** Distance records are independent of render density, speed and frame rate. */
export class DistanceSnakePath {
    private head: SnakePoint;
    private records: SnakePoint[];
    private pendingDistance = 0;
    private value: number;
    currentLength: number;

    readonly maxPointCount = Math.ceil(GameBalance.snake.maxLength / GameBalance.snake.pathRecordSpacing) + 4;

    constructor(x: number, y: number, value: number) {
        this.value = normalizeSnakeValue(value);
        this.currentLength = calculateSnakeLength(this.value);
        this.head = { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
        this.records = [{ ...this.head }];
    }

    get targetLength(): number {
        return calculateSnakeLength(this.value);
    }

    get pointCount(): number {
        return this.records.length + 1;
    }

    get points(): SnakePoint[] {
        const newest = this.records[0];
        return pointDistance(this.head, newest) < EPSILON
            ? this.records.map(point => ({ ...point }))
            : [{ ...this.head }, ...this.records.map(point => ({ ...point }))];
    }

    get availableLength(): number {
        return pointDistance(this.head, this.records[0]) + measurePath(this.records);
    }

    get visibleLength(): number {
        return Math.min(this.currentLength, this.availableLength);
    }

    setValue(value: number): void {
        this.value = normalizeSnakeValue(value, this.value);
        // Shrinking is an explicit Value change, never a damage/render side effect.
        this.currentLength = Math.min(this.currentLength, this.targetLength);
    }

    reset(x: number, y: number): void {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        this.head = { x, y };
        this.records = [{ x, y }];
        this.pendingDistance = 0;
        this.currentLength = this.targetLength;
    }

    update(x: number, y: number, dt: number): void {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
        this.currentLength = Math.min(this.targetLength, this.currentLength + GameBalance.snake.growthSpeed * elapsed / 1000);

        const next = { x, y };
        const movement = pointDistance(this.head, next);
        if (movement < EPSILON) return;

        const spacing = GameBalance.snake.pathRecordSpacing;
        const recordCount = Math.floor((this.pendingDistance + movement + EPSILON) / spacing);
        const firstOffset = spacing - this.pendingDistance;
        // Even an invalidly large jump cannot allocate an unbounded history.
        const firstRecord = Math.max(0, recordCount - (this.maxPointCount - 1));
        if (firstRecord > 0) this.records = [];
        for (let i = firstRecord; i < recordCount; i++) {
            const fraction = Math.min(1, (firstOffset + i * spacing) / movement);
            this.records.unshift({
                x: this.head.x + (next.x - this.head.x) * fraction,
                y: this.head.y + (next.y - this.head.y) * fraction
            });
        }
        this.pendingDistance = Math.max(0, this.pendingDistance + movement - recordCount * spacing);
        if (this.records.length > this.maxPointCount - 1) this.records.length = this.maxPointCount - 1;
        this.head = next;
    }

    /** Translate the existing shape for a small contact separation, preserving its trail. */
    translate(dx: number, dy: number): void {
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
        this.head.x += dx;
        this.head.y += dy;
        for (const point of this.records) {
            point.x += dx;
            point.y += dy;
        }
    }

    /** Seed an already travelled, head-first path through the same distance recorder. */
    seed(points: readonly SnakePoint[]): void {
        if (points.length === 0 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return;
        this.reset(points[points.length - 1].x, points[points.length - 1].y);
        for (let i = points.length - 2; i >= 0; i--) this.update(points[i].x, points[i].y, 0);
    }

    getVisiblePath(): SnakePoint[] {
        const result: SnakePoint[] = [{ ...this.head }];
        let remaining = this.currentLength;
        let previous = this.head;
        for (let i = 0; i < this.records.length && remaining > EPSILON; i++) {
            const next = this.records[i];
            const distance = pointDistance(previous, next);
            if (distance < EPSILON) continue;
            if (distance <= remaining + EPSILON) {
                result.push({ ...next });
                remaining -= distance;
            } else {
                const fraction = remaining / distance;
                result.push({ x: previous.x + (next.x - previous.x) * fraction, y: previous.y + (next.y - previous.y) * fraction });
                remaining = 0;
            }
            previous = next;
        }
        return result;
    }

    sample(distance: number): SnakePathSample | undefined {
        if (!Number.isFinite(distance) || distance < 0 || distance > this.visibleLength + EPSILON) return undefined;
        return this.sampleDistances([distance])[0];
    }

    getVisibleSamples(): SnakePathSample[] {
        const visibleLength = this.visibleLength;
        const spacing = GameBalance.snake.sampleSpacing;
        // A newborn snake has no folded-up or invisible collidable body at its head.
        if (visibleLength < spacing) return [];
        const count = renderSegmentCount(visibleLength);
        const distances = Array.from({ length: count }, (_, i) => Math.min((i + 1) * spacing, visibleLength));
        return this.sampleDistances(distances);
    }

    private sampleDistances(distances: readonly number[]): SnakePathSample[] {
        const points = this.getVisiblePath();
        const samples: SnakePathSample[] = [];
        let index = 1;
        let travelled = 0;
        for (const offset of distances) {
            while (index < points.length) {
                const start = points[index - 1];
                const end = points[index];
                const span = pointDistance(start, end);
                if (travelled + span + EPSILON >= offset && span > EPSILON) {
                    const fraction = Math.max(0, Math.min(1, (offset - travelled) / span));
                    samples.push({
                        x: start.x + (end.x - start.x) * fraction,
                        y: start.y + (end.y - start.y) * fraction,
                        distance: offset,
                        angle: Math.atan2(end.y - start.y, end.x - start.x)
                    });
                    break;
                }
                travelled += span;
                index++;
            }
        }
        return samples;
    }
}
