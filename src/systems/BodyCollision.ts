/** Gameplay geometry uses the visible distance path, never decorative sprite counts. */
export interface BodyPoint { x: number; y: number }
export interface BodyActor {
    id: string;
    kind: 'player' | 'enemy' | 'boss';
    head: BodyPoint;
    previousHead: BodyPoint;
    headRadius: number;
    path: readonly BodyPoint[];
    active: boolean;
}
export interface BodyContact {
    actorId: string;
    ownerId: string;
    normal: BodyPoint;
    contact: BodyPoint;
    penetration: number;
    sweptCorrection: BodyPoint;
}
interface Capsule { ownerId: string; kind: BodyActor['kind']; a: BodyPoint; b: BodyPoint; radius: number; order: number }
interface CollisionOptions { spatialCellSize: number; detectionCooldownMs: number; neckSafeDistance: number; sweptRadiusPadding: number }
const EPS = 1e-8;
const sub = (a: BodyPoint, b: BodyPoint): BodyPoint => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: BodyPoint, b: BodyPoint) => a.x * b.x + a.y * b.y;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const finite = (p: BodyPoint) => Number.isFinite(p.x) && Number.isFinite(p.y);

export function closestPointOnSegment(point: BodyPoint, a: BodyPoint, b: BodyPoint): BodyPoint {
    const delta = sub(b, a);
    const lengthSquared = dot(delta, delta);
    const t = lengthSquared > EPS ? clamp01(dot(sub(point, a), delta) / lengthSquared) : 0;
    return { x: a.x + delta.x * t, y: a.y + delta.y * t };
}

/** Closest points of two segments, including degenerate and parallel segments. */
function closestSegments(p1: BodyPoint, q1: BodyPoint, p2: BodyPoint, q2: BodyPoint): [BodyPoint, BodyPoint] {
    const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
    const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
    let s = 0, t = 0;
    if (a <= EPS && e <= EPS) return [p1, p2];
    if (a <= EPS) t = clamp01(f / e);
    else {
        const c = dot(d1, r);
        if (e <= EPS) s = clamp01(-c / a);
        else {
            const b = dot(d1, d2), denominator = a * e - b * b;
            s = denominator > EPS ? clamp01((b * f - c * e) / denominator) : 0;
            t = (b * s + f) / e;
            if (t < 0) { t = 0; s = clamp01(-c / a); }
            else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
        }
    }
    return [{ x: p1.x + d1.x * s, y: p1.y + d1.y * s }, { x: p2.x + d2.x * t, y: p2.y + d2.y * t }];
}

/** Trim head/neck by actual path distance; unexpanded tails produce no capsule. */
export function bodyCapsules(actor: BodyActor, neckSafeDistance: number, bodyRadius = 14): Capsule[] {
    if (!actor.active || actor.kind === 'boss') return [];
    const result: Capsule[] = [];
    let walked = 0;
    for (let i = 1; i < actor.path.length; i++) {
        const a = actor.path[i - 1], b = actor.path[i];
        if (!finite(a) || !finite(b)) continue;
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        if (length <= EPS) continue;
        const end = walked + length;
        if (end > neckSafeDistance) {
            const fraction = clamp01((neckSafeDistance - walked) / length);
            result.push({ ownerId: actor.id, kind: actor.kind, a: { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction }, b, radius: bodyRadius, order: i });
        }
        walked = end;
    }
    return result;
}

export function sweptCapsuleContact(actor: BodyActor, capsule: Capsule, padding = 0): BodyContact | null {
    if (!finite(actor.head) || !finite(actor.previousHead)) return null;
    const [sweep, contact] = closestSegments(actor.previousHead, actor.head, capsule.a, capsule.b);
    const totalRadius = actor.headRadius + capsule.radius + padding;
    const separation = sub(sweep, contact);
    const distance = Math.hypot(separation.x, separation.y);
    if (distance > totalRadius) return null;
    let normal: BodyPoint;
    if (distance > EPS) normal = { x: separation.x / distance, y: separation.y / distance };
    else {
        const tangent = sub(capsule.b, capsule.a);
        const length = Math.hypot(tangent.x, tangent.y);
        normal = length > EPS ? { x: -tangent.y / length, y: tangent.x / length } : { x: 1, y: 0 };
        const movement = sub(actor.head, actor.previousHead);
        if (dot(normal, movement) > 0) normal = { x: -normal.x, y: -normal.y };
    }
    const currentContact = closestPointOnSegment(actor.head, capsule.a, capsule.b);
    const currentDistance = Math.hypot(actor.head.x - currentContact.x, actor.head.y - currentContact.y);
    // Roll back a crossing to the entry side. This restores missed movement, rather
    // than adding a larger impulse, and is bounded again by world limits.
    const signedCurrent = dot(sub(actor.head, contact), normal);
    const crossed = signedCurrent < 0 && dot(sub(actor.previousHead, contact), normal) >= 0;
    const sweptCorrection = crossed ? { x: contact.x + normal.x * (totalRadius + 1) - actor.head.x, y: contact.y + normal.y * (totalRadius + 1) - actor.head.y } : { x: 0, y: 0 };
    return { actorId: actor.id, ownerId: capsule.ownerId, normal, contact, penetration: Math.max(0, totalRadius - currentDistance), sweptCorrection };
}

/** A fresh bounded spatial index each frame with actor-specific contact cooldown. */
export class BodyCollisionSystem {
    private cooldownUntil = new Map<string, number>();
    lastCandidateChecks = 0;
    constructor(private options: CollisionOptions) {}
    reset() { this.cooldownUntil.clear(); this.lastCandidateChecks = 0; }
    forget(id: string) { this.cooldownUntil.delete(id); }
    isCoolingDown(id: string, time: number) { return time < (this.cooldownUntil.get(id) ?? -Infinity); }

    detect(actors: readonly BodyActor[], time: number, headResolved: ReadonlySet<string> = new Set()): BodyContact[] {
        const activeIds = new Set(actors.filter(actor => actor.active).map(actor => actor.id));
        for (const id of this.cooldownUntil.keys()) if (!activeIds.has(id)) this.cooldownUntil.delete(id);
        const cells = new Map<string, Capsule[]>();
        const size = Math.max(1, this.options.spatialCellSize);
        const visit = (minX: number, minY: number, maxX: number, maxY: number, cb: (key: string) => void) => {
            for (let x = Math.floor(minX / size); x <= Math.floor(maxX / size); x++)
                for (let y = Math.floor(minY / size); y <= Math.floor(maxY / size); y++) cb(`${x},${y}`);
        };
        for (const actor of actors) for (const cap of bodyCapsules(actor, this.options.neckSafeDistance)) {
            visit(Math.min(cap.a.x, cap.b.x) - cap.radius, Math.min(cap.a.y, cap.b.y) - cap.radius,
                Math.max(cap.a.x, cap.b.x) + cap.radius, Math.max(cap.a.y, cap.b.y) + cap.radius,
                key => { const list = cells.get(key) ?? []; list.push(cap); cells.set(key, list); });
        }
        const result: BodyContact[] = [];
        this.lastCandidateChecks = 0;
        for (const actor of actors) {
            if (!actor.active || actor.kind === 'boss' || headResolved.has(actor.id) || this.isCoolingDown(actor.id, time)) continue;
            const candidates = new Set<Capsule>();
            const radius = actor.headRadius + this.options.sweptRadiusPadding;
            visit(Math.min(actor.previousHead.x, actor.head.x) - radius, Math.min(actor.previousHead.y, actor.head.y) - radius,
                Math.max(actor.previousHead.x, actor.head.x) + radius, Math.max(actor.previousHead.y, actor.head.y) + radius,
                key => { for (const cap of cells.get(key) ?? []) if (cap.ownerId !== actor.id && cap.kind !== actor.kind) candidates.add(cap); });
            // Stable order makes simultaneous multi-segment/owner contact deterministic.
            const ordered = [...candidates].sort((a, b) => a.ownerId.localeCompare(b.ownerId) || a.order - b.order);
            for (const cap of ordered) {
                this.lastCandidateChecks++;
                const contact = sweptCapsuleContact(actor, cap, this.options.sweptRadiusPadding);
                if (!contact) continue;
                result.push(contact);
                this.cooldownUntil.set(actor.id, time + this.options.detectionCooldownMs);
                break;
            }
        }
        return result;
    }
}
