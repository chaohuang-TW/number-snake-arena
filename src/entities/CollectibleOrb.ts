import Phaser from 'phaser';
import { GameBalance } from '../config/gameBalance';

export class CollectibleOrb {
    scene: Phaser.Scene;
    sprite: Phaser.GameObjects.Image;
    createdAt: number;
    lifetime: number;
    isCollected: boolean = false;

    private floatOffset: number;
    private baseY: number;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        this.scene = scene;
        this.baseY = y;
        this.createdAt = scene.time.now;
        this.lifetime = GameBalance.orb.lifetime;
        this.floatOffset = Math.random() * Math.PI * 2;

        const textureKey = scene.textures.exists('collectible_orb') ? 'collectible_orb' : 'particle';
        this.sprite = scene.add.image(x, y, textureKey);
        this.sprite.setDepth(45);
        this.sprite.setScale(0);

        // Pop outward animation
        const angle = Math.random() * Math.PI * 2;
        const popDist = 10 + Math.random() * 20;
        const targetX = x + Math.cos(angle) * popDist;
        const targetY = y + Math.sin(angle) * popDist;

        scene.tweens.add({
            targets: this.sprite,
            x: targetX,
            y: targetY,
            scale: 1,
            duration: 250,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.baseY = targetY;
            }
        });
    }

    update(time: number, _dt?: number) {
        if (this.isCollected) return;

        const age = time - this.createdAt;

        // Fade out near end of lifetime
        if (age > this.lifetime - 2000) {
            const remaining = Math.max(0, this.lifetime - age);
            this.sprite.setAlpha(remaining / 2000);
        }

        // Gentle floating motion
        const floatY = Math.sin((time * 0.004) + this.floatOffset) * 3;
        this.sprite.y = this.baseY + floatY;
    }

    pullTowards(targetX: number, targetY: number, speed: number, dt: number) {
        if (this.isCollected) return;
        const angle = Math.atan2(targetY - this.sprite.y, targetX - this.sprite.x);
        const step = speed * (dt / 1000);
        this.sprite.x += Math.cos(angle) * step;
        this.sprite.y += Math.sin(angle) * step;
        this.baseY = this.sprite.y;
    }

    isExpired(time: number): boolean {
        return time - this.createdAt >= this.lifetime;
    }

    destroy() {
        this.isCollected = true;
        this.sprite.destroy();
    }
}
