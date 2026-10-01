/** Capability, never viewport width: a large iPad still has touch controls. */
export function isTouchCapableDevice(): boolean {
    if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(any-pointer: coarse)').matches);
}
