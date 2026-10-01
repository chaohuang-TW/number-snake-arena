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

export interface SafeAreaInsets { top: number; right: number; bottom: number; left: number; }
export const ZERO_SAFE_AREA: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Reads CSS env safe areas without relying on a particular notch or device width. */
export function readSafeAreaInsets(): SafeAreaInsets {
    if (typeof document === 'undefined') return { ...ZERO_SAFE_AREA };
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    const values = { top: parseFloat(style.paddingTop) || 0, right: parseFloat(style.paddingRight) || 0, bottom: parseFloat(style.paddingBottom) || 0, left: parseFloat(style.paddingLeft) || 0 };
    probe.remove();
    return values;
}

export function canvasUnitsForCssPixels(cssPixels: number, canvasWidth: number, cssWidth: number): number {
    return cssPixels * (Number.isFinite(canvasWidth) && canvasWidth > 0 && Number.isFinite(cssWidth) && cssWidth > 0 ? canvasWidth / cssWidth : 1);
}

/** Reserved screen rectangles shared by HUD and ranking, including short landscape layouts. */
export function arenaUiLayout(width: number, height: number, safe: SafeAreaInsets = ZERO_SAFE_AREA) {
    const left = safe.left + 16;
    const top = safe.top + 14;
    const narrow = width < 600;
    const short = height < 500;
    const rankingWidth = narrow ? 168 : 208;
    const ranking = { x: width - safe.right - rankingWidth - 16, y: short ? top + 52 : top + 62, width: rankingWidth, height: 186 };
    const energy = { x: left, y: top + 102, width: narrow ? 162 : 204, height: 12 };
    const boostRadius = 36;
    const bottom = height - safe.bottom - 56;
    return { left, top, ranking, energy, joystick: { x: safe.left + 78, y: bottom - 8, radius: 56 }, boost: { x: width - safe.right - 62, y: bottom, radius: boostRadius }, magnet: { x: width - safe.right - 148, y: bottom, radius: boostRadius }, narrow, short };
}
