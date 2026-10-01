import type Phaser from 'phaser';
import { GameBalance } from '../config/gameBalance';
import type { OrbReward } from '../systems/OrbRewards';
import { VisualPreferencesManager } from '../models/VisualPreferences';

export interface OrbActivation { reward?: OrbReward; transformDelay?: number; transformDuration?: number; unlockDelay?: number; sourceTexture?: string }

/** Reusable sprite; deactivation never grants a reward. Collection is explicit and once-only. */
export class CollectibleOrb {
    scene: Phaser.Scene;
    sprite: Phaser.GameObjects.Image;
    createdAt = 0;
    lifetime = GameBalance.orb.lifetime;
    isCollected = true;
    reward: OrbReward = { score: 0, energy: 0, value: 0 };
    private availableAt = 0;
    private transformAt = 0;
    private transformDuration = 0;
    private transformed = false;
    private position = { x: 0, y: 0 };
    private floatOffset = 0;
    private orbTexture: string;

    constructor(scene: Phaser.Scene, x: number, y: number, activation: OrbActivation = {}) {
        this.scene = scene;
        this.orbTexture = scene.textures.exists('collectible_orb') ? 'collectible_orb' : 'particle';
        this.sprite = scene.add.image(x, y, this.orbTexture).setDepth(45);
        this.activate(x, y, activation);
    }

    activate(x: number, y: number, activation: OrbActivation = {}) {
        this.scene.tweens.killTweensOf(this.sprite);
        this.createdAt = this.scene.time.now;
        this.position = { x, y };
        this.floatOffset = Math.random() * Math.PI * 2;
        this.reward = { ...(activation.reward ?? { score: 0, energy: 0, value: 0 }), value: 0 };
        this.availableAt = this.createdAt + (activation.unlockDelay ?? 0);
        this.transformAt = this.createdAt + (activation.transformDelay ?? 0);
        this.transformDuration = activation.transformDuration ?? 0;
        this.transformed = this.transformDuration === 0;
        this.isCollected = false;
        const source = activation.sourceTexture && this.scene.textures.exists(activation.sourceTexture) ? activation.sourceTexture : this.orbTexture;
        this.sprite.setPosition(x, y).setActive(true).setVisible(true).setAlpha(1).setScale(1).setRotation(0).clearTint();
        this.sprite.setTexture(this.transformed ? this.orbTexture : source);
        if (!this.transformed) this.sprite.setTint(0xffe89a).setAlpha(0.8);
    }

    get canCollect(): boolean { return !this.isCollected && this.sprite.active && this.scene.time.now >= this.availableAt && !this.isExpired(this.scene.time.now); }
    get isTransforming(): boolean { return !this.isCollected && this.scene.time.now < this.availableAt; }
    getCollectionPosition(): Readonly<{ x: number; y: number }> { return this.position; }

    update(time: number, _dt?: number) {
        if (this.isCollected) return;
        if (time >= this.transformAt && !this.transformed) {
            this.sprite.setTexture(this.orbTexture).clearTint();
            const progress = Math.min(1, Math.max(0, (time - this.transformAt) / this.transformDuration));
            this.sprite.setScale(VisualPreferencesManager.get().reducedMotion ? 1 : 0.55 + 0.45 * Math.sin(progress * Math.PI / 2)).setAlpha(0.7 + 0.3 * progress);
            if (progress >= 1) this.transformed = true;
        }
        if (time < this.availableAt) return;
        const age = time - this.createdAt;
        this.sprite.setAlpha(age > this.lifetime - 2000 ? Math.max(0, (this.lifetime - age) / 2000) : 1);
        this.sprite.setPosition(this.position.x, this.position.y + (VisualPreferencesManager.get().reducedMotion ? 0 : Math.sin(time * 0.004 + this.floatOffset) * 3));
    }

    pullTowards(targetX: number, targetY: number, speed: number, dt: number) {
        if (!this.canCollect) return;
        const dx = targetX - this.position.x, dy = targetY - this.position.y;
        const dist = Math.hypot(dx, dy);
        if (!dist) return;
        const step = Math.min(dist, Math.max(0, speed * dt / 1000));
        this.position.x += dx / dist * step;
        this.position.y += dy / dist * step;
        this.sprite.setPosition(this.position.x, this.position.y);
    }

    collect(): OrbReward | null {
        if (!this.canCollect) return null;
        const reward = { ...this.reward };
        this.deactivate();
        return reward;
    }
    isExpired(time: number): boolean { return time - this.createdAt >= this.lifetime; }
    deactivate() {
        this.isCollected = true;
        this.scene.tweens.killTweensOf(this.sprite);
        this.sprite.setActive(false).setVisible(false);
        this.reward = { score: 0, energy: 0, value: 0 };
    }
    destroy() { this.deactivate(); this.sprite.destroy(); }
}
