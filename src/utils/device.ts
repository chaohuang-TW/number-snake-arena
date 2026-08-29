export function isTouchCapableDevice(): boolean {
    if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) {
        return true;
    }
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
        return true;
    }
    return false;
}
