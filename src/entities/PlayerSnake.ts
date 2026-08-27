import Phaser from 'phaser';
import { GameBalance } from '../config/gameBalance';
import { calculateTurnRate } from '../utils/gameRules';
import { lerpAngle } from '../utils/math';

interface HistoryPoint {
    x: number;
    y: number;
}

export class PlayerSnake {
    scene: Phaser.Scene;
    head: Phaser.Physics.Arcade.Image;
    valueText: Phaser.GameObjects.Text;
    
    value: number;
    hp: number;
    segments: number;
    boostEnergy: number;

    currentAngle: number = 0; // radians
    history: HistoryPoint[] = [];
    bodySprites: Phaser.GameObjects.Image[] = [];

    isInvulnerable: boolean = false;
    isStunned: boolean = false;
    
    public targetAngle: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        this.scene = scene;
        this.value = GameBalance.player.initialValue;
        this.hp = GameBalance.player.initialHP;
        this.segments = GameBalance.player.initialSegments;
        this.boostEnergy = GameBalance.player.maxBoostEnergy;

        this.head = scene.physics.add.image(x, y, 'player_head');
        this.head.setCircle(20);
        this.head.setDepth(100);

        this.valueText = scene.add.text(x, y, this.value.toString(), {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(101);

        this.updateBodySprites();
    }

    setDesiredDirection(dx: number, dy: number) {
        if (this.isStunned) return;
        if (dx !== 0 || dy !== 0) {
            this.targetAngle = Math.atan2(dy, dx);
        }
    }

    update(dt: number, isBoosting: boolean) {
        if (!this.isStunned) {
            // Smooth turning
            const turnRate = calculateTurnRate(this.segments);
            this.currentAngle = lerpAngle(this.currentAngle, this.targetAngle, turnRate * (dt / 16.66));
            
            // Movement
            let speed = GameBalance.player.normalSpeed;
            if (isBoosting && this.boostEnergy > 0) {
                speed = GameBalance.player.boostSpeed;
                this.boostEnergy = Math.max(0, this.boostEnergy - GameBalance.player.boostDrainPerSec * (dt / 1000));
            } else {
                this.boostEnergy = Math.min(GameBalance.player.maxBoostEnergy, this.boostEnergy + GameBalance.player.boostRecoveryPerSec * (dt / 1000));
            }

            const vx = Math.cos(this.currentAngle) * speed;
            const vy = Math.sin(this.currentAngle) * speed;
            this.head.setVelocity(vx, vy);
        } else {
            // Drag during stun
            this.head.setDrag(1000);
        }

        // Boundary constraint with soft push
        const hw = GameBalance.world.width / 2;
        const hh = GameBalance.world.height / 2;
        const margin = 50;
        let pvx = this.head.body!.velocity.x;
        let pvy = this.head.body!.velocity.y;

        if (this.head.x < -hw + margin) pvx += 10;
        if (this.head.x > hw - margin) pvx -= 10;
        if (this.head.y < -hh + margin) pvy += 10;
        if (this.head.y > hh - margin) pvy -= 10;
        this.head.setVelocity(pvx, pvy);
        
        // Clamp position strictly
        this.head.x = Phaser.Math.Clamp(this.head.x, -hw, hw);
        this.head.y = Phaser.Math.Clamp(this.head.y, -hh, hh);

        // History update
        const historySpacing = 15; // px distance before recording new point
        if (this.history.length === 0) {
            this.history.push({ x: this.head.x, y: this.head.y });
        } else {
            const last = this.history[0];
            const dist = Phaser.Math.Distance.Between(this.head.x, this.head.y, last.x, last.y);
            if (dist > historySpacing) {
                this.history.unshift({ x: this.head.x, y: this.head.y });
                // limit history size based on segments needed
                const maxHistory = this.segments * 3;
                if (this.history.length > maxHistory) {
                    this.history.pop();
                }
            }
        }

        // Update body positions
        for (let i = 0; i < this.bodySprites.length; i++) {
            const historyIdx = Math.min(i * 2 + 2, this.history.length - 1);
            if (this.history[historyIdx]) {
                const pt = this.history[historyIdx];
                this.bodySprites[i].setPosition(pt.x, pt.y);
                this.bodySprites[i].setVisible(true);
            } else {
                this.bodySprites[i].setVisible(false);
            }
        }

        // Update text pos
        this.valueText.setPosition(this.head.x, this.head.y);
        this.valueText.setText(this.value.toString());
    }

    updateBodySprites() {
        while (this.bodySprites.length < this.segments) {
            const spr = this.scene.add.image(this.head.x, this.head.y, 'player_body');
            spr.setDepth(99 - this.bodySprites.length);
            this.bodySprites.push(spr);
        }
        while (this.bodySprites.length > this.segments) {
            const spr = this.bodySprites.pop();
            spr?.destroy();
        }
    }

    takeDamage(hpLoss: number, newSegments: number, knockbackDir: Phaser.Math.Vector2) {
        this.hp -= hpLoss;
        this.segments = newSegments;
        this.updateBodySprites();

        this.isInvulnerable = true;
        this.isStunned = true;
        
        // Knockback
        this.head.setVelocity(knockbackDir.x * 500, knockbackDir.y * 500);

        // Flash
        this.scene.tweens.add({
            targets: [this.head, ...this.bodySprites],
            alpha: 0.2,
            yoyo: true,
            repeat: 5,
            duration: GameBalance.player.invulnerabilityDuration / 12,
            onComplete: () => {
                this.head.setAlpha(1);
                this.bodySprites.forEach(s => s.setAlpha(1));
                this.isInvulnerable = false;
            }
        });

        // Stun timeout
        this.scene.time.delayedCall(GameBalance.player.hitStunDuration, () => {
            this.isStunned = false;
            this.targetAngle = this.currentAngle; // reset target
        });
    }

    eat(addedValue: number) {
        this.value += addedValue;
        this.segments += 1;
        this.boostEnergy = Math.min(GameBalance.player.maxBoostEnergy, this.boostEnergy + GameBalance.player.boostEatRecovery);
        this.updateBodySprites();
    }

    destroy() {
        this.head.destroy();
        this.valueText.destroy();
        this.bodySprites.forEach(s => s.destroy());
    }
}
