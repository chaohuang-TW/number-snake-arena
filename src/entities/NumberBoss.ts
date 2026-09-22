import Phaser from 'phaser';
import { GameBalance } from '../config/gameBalance';
import { getSafeWorldBounds, clampToSafeWorld, getInwardBoundarySteering } from '../utils/boundary';

export class NumberBoss {
    scene: Phaser.Scene;
    body: Phaser.Physics.Arcade.Image;
    valueText: Phaser.GameObjects.Text;
    
    value: number;
    isFleeing: boolean = false;
    readonly arenaId: string = 'boss';
    get arenaName(): string {
        return `BOSS ${this.value}`;
    }

    constructor(scene: Phaser.Scene, x: number, y: number, value: number) {
        this.scene = scene;
        this.value = value;
        
        this.body = scene.physics.add.image(x, y, 'boss');
        this.body.setCircle(40);
        this.body.setDepth(60);
        this.body.setCollideWorldBounds(true);

        this.valueText = scene.add.text(x, y, value.toString(), {
            fontSize: '32px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(61);
    }

    update(playerX: number, playerY: number, playerValue: number) {
        const speed = GameBalance.player.normalSpeed * GameBalance.boss.speedMultiplier;
        let targetAngle = 0;

        // Player must be strictly greater than bossValue to eat boss
        if (playerValue > this.value) {
            this.isFleeing = true;
            this.body.setTint(0x00ff00); // Edible tint
            targetAngle = Math.atan2(this.body.y - playerY, this.body.x - playerX); // Flee
        } else {
            this.isFleeing = false;
            this.body.clearTint();
            targetAngle = Math.atan2(playerY - this.body.y, playerX - this.body.x); // Chase
        }

        let vx = Math.cos(targetAngle) * speed;
        let vy = Math.sin(targetAngle) * speed;

        // Soft boundary steering
        const ww = GameBalance.world.width;
        const wh = GameBalance.world.height;
        const margin = GameBalance.boss.boundaryMargin;
        const softZone = GameBalance.boss.softZone;
        const steerStrength = GameBalance.boss.boundarySteerStrength;

        const steer = getInwardBoundarySteering(this.body.x, this.body.y, ww, wh, margin, softZone);
        if (steer.x !== 0 || steer.y !== 0) {
            const steerForce = speed * steerStrength;
            vx += steer.x * steerForce;
            vy += steer.y * steerForce;

            // Tangential deflection to avoid collinear head-on deadlock between player and boundary
            if (Math.abs(steer.x) > 0.5 && Math.abs(vy) < 15) {
                vy += (this.body.y >= 0 ? 0.6 : -0.6) * speed;
            }
            if (Math.abs(steer.y) > 0.5 && Math.abs(vx) < 15) {
                vx += (this.body.x >= 0 ? 0.6 : -0.6) * speed;
            }

            const newSpeed = Math.sqrt(vx * vx + vy * vy);
            if (newSpeed > 0) {
                vx = (vx / newSpeed) * speed;
                vy = (vy / newSpeed) * speed;
            }
        }

        this.body.setVelocity(vx, vy);

        // Emergency hard clamp failsafe
        const bounds = getSafeWorldBounds(ww, wh, margin);
        const clamped = clampToSafeWorld(this.body.x, this.body.y, bounds);
        if (clamped.x !== this.body.x || clamped.y !== this.body.y) {
            this.body.setPosition(clamped.x, clamped.y);
            if (clamped.x <= bounds.minX && this.body.body!.velocity.x < 0) this.body.setVelocityX(0);
            if (clamped.x >= bounds.maxX && this.body.body!.velocity.x > 0) this.body.setVelocityX(0);
            if (clamped.y <= bounds.minY && this.body.body!.velocity.y < 0) this.body.setVelocityY(0);
            if (clamped.y >= bounds.maxY && this.body.body!.velocity.y > 0) this.body.setVelocityY(0);
        }

        this.valueText.setPosition(this.body.x, this.body.y);
    }

    destroy() {
        this.body.destroy();
        this.valueText.destroy();
    }
}
