export interface RectBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Checks whether two axis-aligned bounding rectangles overlap.
 * Touching edges are treated as non-overlapping.
 */
export function rectsOverlap(a: RectBounds, b: RectBounds): boolean {
    // If either rectangle has non-positive dimension, they cannot overlap
    if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) {
        return false;
    }
    return !(
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y
    );
}

/**
 * Checks whether an inner rectangle is completely contained within an outer rectangle.
 */
export function isRectInside(inner: RectBounds, outer: RectBounds): boolean {
    return (
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        inner.x + inner.width <= outer.x + outer.width &&
        inner.y + inner.height <= outer.y + outer.height
    );
}
