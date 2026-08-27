import Phaser from 'phaser';
import { GameBalance } from '../config/gameBalance';
import { distance } from '../utils/math';

export enum EnemyState {
    WANDER,
    FLEE,
    CHASE
}

export class NumberEnemy {
    scene: Phaser.Scene;
    body: Phaser.Physics.Arcade.Image;
    valueText: Phaser.GameObjects.Text;
    glow: Phaser.GameObjects.Graphics;
    
    value: number;
    state: EnemyState = EnemyState.WANDER;
    
    private wanderAngle: number = 0;
    private wanderTimer: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, value: number) {
        this.scene = scene;
        this.value = value;
        
        this.glow = scene.add.graphics();
        this.glow.setDepth(49);
        
        this.body = scene.physics.add.image(x, y, 'enemy_edible'); // default
        this.body.setCircle(18);
        this.body.setDepth(50);

        this.valueText = scene.add.text(x, y, this.value.toString(), {
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#000000'
        }).setOrigin(0.5).setDepth(51);

        this.wanderAngle = Math.random() * Math.PI * 2;
    }

    update(dt: number, playerX: number, playerY: number, playerValue: number) {
        const dist = distance(this.body.x, this.body.y, playerX, playerY);
        
        // Role reversal logic
        if (this.value < playerValue) {
            // Edible -> PREY
            if (dist < GameBalance.enemy.fleeDistance) {
                this.state = EnemyState.FLEE;
            } else {
                this.state = EnemyState.WANDER;
            }
            this.updateAppearance(1); // Edible
        } else {
            // HUNTER
            if (dist < GameBalance.enemy.chaseDistance) {
                this.state = EnemyState.CHASE;
            } else {
                this.state = EnemyState.WANDER;
            }
            const ratio = this.value / playerValue;
            if (ratio >= GameBalance.damage.highRatioMin) {
                this.updateAppearance(3); // High Threat
            } else {
                this.updateAppearance(2); // Mild Threat
            }
        }

        // Movement
        let speed = 0;
        let targetAngle = this.wanderAngle;

        switch (this.state) {
            case EnemyState.WANDER:
                speed = GameBalance.player.normalSpeed * 0.4;
                this.wanderTimer -= dt;
                if (this.wanderTimer <= 0) {
                    this.wanderAngle += (Math.random() - 0.5) * Math.PI;
                    this.wanderTimer = 1000 + Math.random() * 2000;
                }
                break;
            case EnemyState.FLEE:
                speed = GameBalance.player.normalSpeed * (this.value > playerValue * 0.45 ? GameBalance.enemy.highValuePreySpeedMultiplier : GameBalance.enemy.preySpeedMultiplier);
                targetAngle = Math.atan2(this.body.y - playerY, this.body.x - playerX); // away from player
                break;
            case EnemyState.CHASE:
                speed = GameBalance.player.normalSpeed * GameBalance.enemy.hunterSpeedMultiplier;
                targetAngle = Math.atan2(playerY - this.body.y, playerX - this.body.x); // towards player
                break;
        }

        const vx = Math.cos(targetAngle) * speed;
        const vy = Math.sin(targetAngle) * speed;
        this.body.setVelocity(vx, vy);

        // Boundary bounce
        const hw = GameBalance.world.width / 2;
        const hh = GameBalance.world.height / 2;
        if (this.body.x < -hw || this.body.x > hw) {
            this.body.setVelocityX(-this.body.body!.velocity.x);
            this.wanderAngle = Math.PI - this.wanderAngle;
        }
        if (this.body.y < -hh || this.body.y > hh) {
            this.body.setVelocityY(-this.body.body!.velocity.y);
            this.wanderAngle = -this.wanderAngle;
        }

        // Sync text and glow
        this.valueText.setPosition(this.body.x, this.body.y);
        this.glow.setPosition(this.body.x, this.body.y);
    }

    private updateAppearance(type: number) {
        if (type === 1) { // Edible
            this.body.setTexture('enemy_edible');
            this.glow.clear();
            this.glow.fillStyle(0x00ff00, 0.3);
            this.glow.fillCircle(0, 0, 25);
            this.valueText.setColor('#000000');
        } else if (type === 2) { // Mild
            this.body.setTexture('enemy_mild');
            this.glow.clear();
            this.glow.fillStyle(0xffaa00, 0.4);
            this.glow.fillCircle(0, 0, 30);
            this.valueText.setColor('#000000');
        } else { // High
            this.body.setTexture('enemy_high');
            this.glow.clear();
            this.glow.fillStyle(0xff0000, 0.5);
            this.glow.fillCircle(0, 0, 35);
            this.valueText.setColor('#ffffff');
        }
    }

    destroy() {
        this.body.destroy();
        this.valueText.destroy();
        this.glow.destroy();
    }
}
