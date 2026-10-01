import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import { CollectibleOrb } from '../src/entities/CollectibleOrb';
import { VisualPreferencesManager } from '../src/models/VisualPreferences';

class FakeImage {
    x = 0; y = 0; active = true; visible = true; destroyed = false; texture = '';
    setDepth(_depth: number) { return this; }
    setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
    setActive(active: boolean) { this.active = active; return this; }
    setVisible(visible: boolean) { this.visible = visible; return this; }
    setAlpha(_alpha: number) { return this; }
    setScale(_scale: number) { return this; }
    setRotation(_rotation: number) { return this; }
    clearTint() { return this; }
    setTint(_tint: number) { return this; }
    setTexture(texture: string) { this.texture = texture; return this; }
    destroy() { this.destroyed = true; }
}
const fakeScene = () => ({ time: { now: 1000 }, textures: { exists: () => true }, tweens: { killTweensOf: () => {} }, add: { image: () => new FakeImage() } });

describe('pooled orb lifecycle', () => {
    it('keeps decorative bobbing out of collection and attraction coordinates', () => {
        const scene = fakeScene();
        const orb = new CollectibleOrb(scene as unknown as Phaser.Scene, 0, 32.5);
        VisualPreferencesManager.set({ reducedMotion: false });
        orb.update(1800);
        expect(orb.getCollectionPosition()).toEqual({ x: 0, y: 32.5 });
        orb.pullTowards(0, 0, 10, 1000);
        expect(orb.getCollectionPosition()).toEqual({ x: 0, y: 22.5 });
        VisualPreferencesManager.set({ reducedMotion: true });
        orb.update(1900);
        expect(orb.sprite.y).toBe(22.5);
        VisualPreferencesManager.reset();
    });
    it('keeps chain position, rejects collection and magnetic pull until the shared unlock time', () => {
        const scene = fakeScene();
        const orb = new CollectibleOrb(scene as unknown as Phaser.Scene, 100, 200, { reward: { score: 5, energy: 1, value: 0 }, transformDelay: 200, transformDuration: 250, unlockDelay: 450, sourceTexture: 'enemy_body' });
        expect(orb.canCollect).toBe(false);
        expect(orb.collect()).toBeNull();
        orb.pullTowards(0, 0, 480, 1000);
        expect(orb.sprite.x).toBe(100);
        expect(orb.sprite.y).toBe(200);
        scene.time.now = 1449;
        orb.update(1449);
        expect(orb.canCollect).toBe(false);
        scene.time.now = 1450;
        orb.update(1450);
        expect(orb.canCollect).toBe(true);
        expect(orb.collect()).toEqual({ score: 5, energy: 1, value: 0 });
        expect(orb.collect()).toBeNull();
        expect(orb.sprite.active).toBe(false);
    });

    it('reuses the same sprite with a fresh reward and lifetime', () => {
        const scene = fakeScene();
        const orb = new CollectibleOrb(scene as unknown as Phaser.Scene, 1, 2);
        const sprite = orb.sprite;
        orb.deactivate();
        scene.time.now = 5000;
        orb.activate(4, 5, { reward: { score: 7, energy: 2, value: 0 } });
        expect(orb.sprite).toBe(sprite);
        expect(orb.sprite.active).toBe(true);
        expect(orb.isExpired(15999)).toBe(false);
        expect(orb.isExpired(16000)).toBe(true);
        expect(orb.collect()).toEqual({ score: 7, energy: 2, value: 0 });
    });

    it('expiry, eviction and generic destroy yield no reward', () => {
        const scene = fakeScene();
        const orb = new CollectibleOrb(scene as unknown as Phaser.Scene, 1, 2, { reward: { score: 50, energy: 10, value: 0 } });
        scene.time.now = 12000;
        expect(orb.isExpired(scene.time.now)).toBe(true);
        orb.deactivate();
        expect(orb.collect()).toBeNull();
        expect(orb.reward).toEqual({ score: 0, energy: 0, value: 0 });
        orb.destroy();
        expect(orb.collect()).toBeNull();
    });
});
