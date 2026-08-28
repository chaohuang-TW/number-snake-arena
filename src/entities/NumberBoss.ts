import Phaser from 'phaser';
import { GameBalance } from '../config/gameBalance';

export class NumberBoss {
    scene: Phaser.Scene;
    body: Phaser.Physics.Arcade.Image;
    valueText: Phaser.GameObjects.Text;
    
    value: number;
    isFleeing: boolean = false;

    constructor(scene: Phaser.Scene, x: number, y: number, value: number) {
        this.scene = scene;
        this.value = value;
        
        this.body = scene.physics.add.image(x, y, 'boss');
        this.body.setCircle(40);
        this.body.setDepth(60);

        this.valueText = scene.add.text(x, y, value.toString(), {
            fontSize: '32px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(61);
    }

    update(playerX: number, playerY: number, playerValue: number) {
        let speed = GameBalance.player.normalSpeed * GameBalance.boss.speedMultiplier;
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

        const vx = Math.cos(targetAngle) * speed;
        const vy = Math.sin(targetAngle) * speed;
        this.body.setVelocity(vx, vy);

        this.valueText.setPosition(this.body.x, this.body.y);
    }

    destroy() {
        this.body.destroy();
        this.valueText.destroy();
    }
}
