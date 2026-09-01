

export function lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return a + diff * t;
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function getBoundarySteering(
    x: number,
    y: number,
    worldHalfWidth: number,
    worldHalfHeight: number,
    softZone: number,
    hardMargin: number = 0
): { x: number, y: number } {
    let steerX = 0;
    let steerY = 0;
    
    const effectiveZone = Math.max(1, softZone - hardMargin);

    if (x > worldHalfWidth - softZone) {
        let ratio = Math.min(1, (x - (worldHalfWidth - softZone)) / effectiveZone);
        steerX = -ratio;
    } else if (x < -worldHalfWidth + softZone) {
        let ratio = Math.min(1, ((-worldHalfWidth + softZone) - x) / effectiveZone);
        steerX = ratio;
    }

    if (y > worldHalfHeight - softZone) {
        let ratio = Math.min(1, (y - (worldHalfHeight - softZone)) / effectiveZone);
        steerY = -ratio;
    } else if (y < -worldHalfHeight + softZone) {
        let ratio = Math.min(1, ((-worldHalfHeight + softZone) - y) / effectiveZone);
        steerY = ratio;
    }

    return { x: steerX, y: steerY };
}
