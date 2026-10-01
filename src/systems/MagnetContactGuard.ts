/** A contact suppresses only its ordinary AI target, independently of damage immunity. */
export class MagnetContactGuard {
    private suppressedUntil = new Map<string, number>();
    suppress(id: string, until: number) { this.suppressedUntil.set(id, until); }
    isSuppressed(id: string, time: number) {
        const until = this.suppressedUntil.get(id);
        if (until === undefined) return false;
        if (time >= until) { this.suppressedUntil.delete(id); return false; }
        return true;
    }
    forget(id: string) { this.suppressedUntil.delete(id); }
    clear() { this.suppressedUntil.clear(); }
}
