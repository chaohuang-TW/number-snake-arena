import Phaser from 'phaser';
import { GameBalance } from '../config/gameBalance';
import { calculateTurnRate, getTailScale } from '../utils/gameRules';
import { lerpAngle } from '../utils/math';
import { CosmeticsManager } from '../models/Cosmetics';
import { HEAD_SKINS } from '../config/headSkins';

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
    headSkinId: string;

    currentAngle: number = 0; // radians
    history: HistoryPoint[] = [];
    bodySprites: Phaser.GameObjects.Image[] = [];

    isInvulnerable: boolean = false;
    isStunned: boolean = false;
    
    public targetAngle: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, initialValue: number, initialHP: number, customSkinId?: string) {
        this.scene = scene;
        this.value = initialValue;
        this.hp = initialHP;
        this.segments = GameBalance.player.initialSegments;
        this.boostEnergy = GameBalance.player.maxBoostEnergy;

        const selectedSkin = customSkinId || CosmeticsManager.getSelectedHeadSkin();
        const skinDef = HEAD_SKINS[selectedSkin] || HEAD_SKINS.classic;
        this.headSkinId = skinDef.id;

        const textureKey = scene.textures.exists(skinDef.playerTexture) ? skinDef.playerTexture : 'player_head';
        this.head = scene.physics.add.image(x, y, textureKey);
        this.head.setCircle(20);
        this.head.setDepth(100);

        this.valueText = scene.add.text(x, y, this.value.toString(), {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(101);

        this.updateBodySprites();
    }

    setHeadSkin(skinId: string) {
        const skinDef = HEAD_SKINS[skinId];
        if (skinDef) {
            this.headSkinId = skinDef.id;
            const textureKey = this.scene.textures.exists(skinDef.playerTexture) ? skinDef.playerTexture : 'player_head';
            this.head.setTexture(textureKey);
        }
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

        // Update body positions & rotation
        for (let i = 0; i < this.bodySprites.length; i++) {
            const historyIdx = Math.min(i * 2 + 2, this.history.length - 1);
            if (this.history[historyIdx]) {
                const pt = this.history[historyIdx];
                this.bodySprites[i].setPosition(pt.x, pt.y);
                this.bodySprites[i].setVisible(true);

                // For tail segment, orient with movement path
                if (i === this.bodySprites.length - 1) {
                    const prevIdx = Math.max(0, historyIdx - 2);
                    const prevPt = this.history[prevIdx];
                    if (prevPt) {
                        const angle = Math.atan2(pt.y - prevPt.y, pt.x - prevPt.x);
                        this.bodySprites[i].setRotation(angle);
                    }
                }
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
            const isTail = this.bodySprites.length === this.segments - 1;
            const texture = isTail && this.scene.textures.exists('player_tail') ? 'player_tail' : 'player_body';
            const spr = this.scene.add.image(this.head.x, this.head.y, texture);
            spr.setDepth(99 - this.bodySprites.length);
            this.bodySprites.push(spr);
        }
        while (this.bodySprites.length > this.segments) {
            const spr = this.bodySprites.pop();
            spr?.destroy();
        }

        // Recompute textures & scales for tapered tail
        const total = this.bodySprites.length;
        for (let i = 0; i < total; i++) {
            const spr = this.bodySprites[i];
            const isTail = i === total - 1;
            const targetTexture = isTail && this.scene.textures.exists('player_tail') ? 'player_tail' : 'player_body';
            if (spr.texture.key !== targetTexture) {
                spr.setTexture(targetTexture);
            }
            const scale = getTailScale(i, total);
            spr.setScale(scale);
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

    teleport(x: number, y: number) {
        this.head.setPosition(x, y);
        if (this.head.body) {
            (this.head.body as Phaser.Physics.Arcade.Body).reset(x, y);
            this.head.setVelocity(0, 0);
        }
        this.history = [];
        const maxHistory = Math.max(30, this.segments * 3);
        for (let i = 0; i < maxHistory; i++) {
            this.history.push({ x, y });
        }
        for (const spr of this.bodySprites) {
            spr.setPosition(x, y);
        }
        this.valueText.setPosition(x, y);
    }

    destroy() {
        this.head.destroy();
        this.valueText.destroy();
        this.bodySprites.forEach(s => s.destroy());
    }
}
