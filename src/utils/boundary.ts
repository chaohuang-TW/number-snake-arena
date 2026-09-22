export interface SafeWorldBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

/**
 * Computes safe world bounds based on total world width, height, and inset margin.
 * Assumes world origin is at (0, 0), so bounds are [-worldWidth/2 + margin, worldWidth/2 - margin].
 */
export function getSafeWorldBounds(
    worldWidth: number,
    worldHeight: number,
    margin: number
): SafeWorldBounds {
    const halfW = worldWidth / 2;
    const halfH = worldHeight / 2;
    return {
        minX: -halfW + margin,
        maxX: halfW - margin,
        minY: -halfH + margin,
        maxY: halfH - margin
    };
}

/**
 * Hard failsafe clamp to keep coordinates strictly inside safe world limits.
 */
export function clampToSafeWorld(
    x: number,
    y: number,
    bounds: SafeWorldBounds
): { x: number; y: number } {
    return {
        x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, y))
    };
}

/**
 * Soft boundary steering vector calculation.
 * Returns normalized directional weights:
 * - near right edge: steerX < 0
 * - near left edge: steerX > 0
 * - near top edge: steerY > 0
 * - near bottom edge: steerY < 0
 * - near corners: both axes steer inward
 * - center: approximately (0, 0)
 */
export function getInwardBoundarySteering(
    x: number,
    y: number,
    worldWidth: number,
    worldHeight: number,
    margin: number,
    softZone: number = 250
): { x: number; y: number } {
    const halfW = worldWidth / 2;
    const halfH = worldHeight / 2;
    let steerX = 0;
    let steerY = 0;

    const effectiveZone = Math.max(1, softZone - margin);

    if (x > halfW - softZone) {
        const ratio = Math.min(1, (x - (halfW - softZone)) / effectiveZone);
        steerX = -ratio;
    } else if (x < -halfW + softZone) {
        const ratio = Math.min(1, ((-halfW + softZone) - x) / effectiveZone);
        steerX = ratio;
    }

    if (y > halfH - softZone) {
        const ratio = Math.min(1, (y - (halfH - softZone)) / effectiveZone);
        steerY = -ratio;
    } else if (y < -halfH + softZone) {
        const ratio = Math.min(1, ((-halfH + softZone) - y) / effectiveZone);
        steerY = ratio;
    }

    return { x: steerX, y: steerY };
}
