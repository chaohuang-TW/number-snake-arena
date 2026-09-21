import Phaser from 'phaser';
import { GameBalance } from '../config/gameBalance';
import { isMagnetEligible } from '../utils/gameRules';
import { NumberEnemy } from '../entities/NumberEnemy';
import { CollectibleOrb } from '../entities/CollectibleOrb';

export type MagnetState = 'READY' | 'ACTIVE' | 'COOLDOWN';

export class MagnetAbility {
    scene: Phaser.Scene;
    state: MagnetState = 'READY';
    timer: number = 0; // ms remaining in current state

    private auraGraphics: Phaser.GameObjects.Graphics;
    private auraParticles: { angle: number, dist: number, speed: number }[] = [];
    private rotationAngle: number = 0;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.auraGraphics = scene.add.graphics();
        this.auraGraphics.setDepth(90);
        this.auraGraphics.setVisible(false);

        // Inward floating sparkle offsets
        for (let i = 0; i < 16; i++) {
            this.auraParticles.push({
                angle: Math.random() * Math.PI * 2,
                dist: 50 + Math.random() * (GameBalance.magnet.radius - 60),
                speed: 60 + Math.random() * 80
            });
        }
    }

    activate(): boolean {
        if (this.state !== 'READY') return false;
        this.state = 'ACTIVE';
        this.timer = GameBalance.magnet.duration;
        this.auraGraphics.setVisible(true);
        return true;
    }

    update(dt: number, playerHeadX: number, playerHeadY: number, playerValue: number, enemies: NumberEnemy[], orbs: CollectibleOrb[]) {
        if (this.state === 'ACTIVE') {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 'COOLDOWN';
                this.timer = GameBalance.magnet.cooldown;
                this.auraGraphics.setVisible(false);
            } else {
                this.renderAura(playerHeadX, playerHeadY, dt);
                this.applyMagnetForces(dt, playerHeadX, playerHeadY, playerValue, enemies, orbs);
            }
        } else if (this.state === 'COOLDOWN') {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 'READY';
                this.timer = 0;
            }
        }
    }

    private renderAura(px: number, py: number, dt: number) {
        this.auraGraphics.clear();
        this.auraGraphics.setPosition(px, py);

        const radius = GameBalance.magnet.radius;
        this.rotationAngle += 0.003 * dt;

        // Outer electric ring
        this.auraGraphics.lineStyle(2, 0x00ffff, 0.5 + 0.2 * Math.sin(this.rotationAngle * 3));
        this.auraGraphics.strokeCircle(0, 0, radius);

        // Inner secondary pulse ring
        const innerPulse = radius * (0.6 + 0.3 * (1 - (this.timer % 1500) / 1500));
        this.auraGraphics.lineStyle(1.5, 0x00aaff, 0.3);
        this.auraGraphics.strokeCircle(0, 0, innerPulse);

        // Soft filled aura
        this.auraGraphics.fillStyle(0x00e1ff, 0.04);
        this.auraGraphics.fillCircle(0, 0, radius);

        // Inward particles
        for (const p of this.auraParticles) {
            p.dist -= p.speed * (dt / 1000);
            p.angle += 0.002 * dt;
            if (p.dist < 30) {
                p.dist = radius - 10;
                p.angle = Math.random() * Math.PI * 2;
            }
            const pxPos = Math.cos(p.angle) * p.dist;
            const pyPos = Math.sin(p.angle) * p.dist;
            this.auraGraphics.fillStyle(0x00ffff, 0.8);
            this.auraGraphics.fillCircle(pxPos, pyPos, 2.5);
        }
    }

    private applyMagnetForces(dt: number, px: number, py: number, playerValue: number, enemies: NumberEnemy[], orbs: CollectibleOrb[]) {
        const radius = GameBalance.magnet.radius;
        const enemyPullSpeed = GameBalance.magnet.pullSpeed;
        const orbPullSpeed = GameBalance.magnet.orbPullSpeed;

        // Pull edible enemies
        for (const e of enemies) {
            if (!e.body || !e.body.active) continue;
            if (!isMagnetEligible(playerValue, e.value, false)) continue;

            const dist = Phaser.Math.Distance.Between(px, py, e.body.x, e.body.y);
            if (dist <= radius) {
                // Smooth pull toward player head
                const angle = Math.atan2(py - e.body.y, px - e.body.x);
                // Blend with existing velocity
                const vx = Math.cos(angle) * enemyPullSpeed;
                const vy = Math.sin(angle) * enemyPullSpeed;
                e.body.setVelocity(vx, vy);
            }
        }

        // Pull loose orbs
        for (const orb of orbs) {
            if (orb.isCollected || !orb.sprite.active) continue;
            const dist = Phaser.Math.Distance.Between(px, py, orb.sprite.x, orb.sprite.y);
            if (dist <= radius) {
                orb.pullTowards(px, py, orbPullSpeed, dt);
            }
        }
    }

    getRemainingSeconds(): number {
        return Math.max(0, this.timer / 1000);
    }

    getHUDText(): string {
        if (this.state === 'READY') {
            return '🧲 MAGNET READY';
        } else if (this.state === 'ACTIVE') {
            return `🧲 MAGNET ${this.getRemainingSeconds().toFixed(1)}s`;
        } else {
            return `🧲 ${this.getRemainingSeconds().toFixed(1)}s`;
        }
    }

    reset() {
        this.state = 'READY';
        this.timer = 0;
        this.auraGraphics.setVisible(false);
        this.auraGraphics.clear();
    }

    destroy() {
        this.auraGraphics.destroy();
    }
}
