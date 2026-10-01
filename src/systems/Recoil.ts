import type { BodyContact, BodyPoint } from './BodyCollision';

export interface RecoilBounds { minX: number; minY: number; maxX: number; maxY: number }
/** Position correction and short velocity impulse are distinct from damage immunity. */
export function calculateBodyRecoil(head: BodyPoint, contact: BodyContact, bounds: RecoilBounds, separationPx: number, maxImpulsePx: number): { direction: BodyPoint; displacement: BodyPoint } {
    const magnitude = Math.hypot(contact.normal.x, contact.normal.y);
    let direction = magnitude > 1e-8 && Number.isFinite(magnitude) ? { x: contact.normal.x / magnitude, y: contact.normal.y / magnitude } : { x: 1, y: 0 };
    const amount = Math.min(Math.max(0, maxImpulsePx), Math.max(0, separationPx, contact.penetration + 1));
    const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
    const rollback = contact.sweptCorrection ?? { x: 0, y: 0 };
    let dx = clamp(head.x + rollback.x + direction.x * amount, bounds.minX, bounds.maxX) - head.x;
    let dy = clamp(head.y + rollback.y + direction.y * amount, bounds.minY, bounds.maxY) - head.y;
    // A wall must not turn a normal into a zero displacement or trap the actor there.
    if (Math.hypot(dx, dy) < 0.5) {
        direction = { x: -direction.x, y: -direction.y };
        dx = clamp(head.x + direction.x * amount, bounds.minX, bounds.maxX) - head.x;
        dy = clamp(head.y + direction.y * amount, bounds.minY, bounds.maxY) - head.y;
    }
    const displacementLength = Math.hypot(dx, dy);
    if (displacementLength > 0 && dx * direction.x + dy * direction.y < 0) direction = { x: dx / displacementLength, y: dy / displacementLength };
    return { direction, displacement: { x: dx, y: dy } };
}
