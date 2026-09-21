import Phaser from 'phaser';
import { GameBalance } from '../config/gameBalance';
import { distance, getBoundarySteering } from '../utils/math';
import { HEAD_SKINS } from '../config/headSkins';
import { getTailScale } from '../utils/gameRules';

export enum EnemyState {
    WANDER,
    FLEE,
    CHASE
}

interface HistoryPoint {
    x: number;
    y: number;
}

export class NumberEnemy {
    scene: Phaser.Scene;
    body: Phaser.Physics.Arcade.Image; // The head (Arcade physics)
    valueText: Phaser.GameObjects.Text;
    glow: Phaser.GameObjects.Graphics;
    
    value: number;
    state: EnemyState = EnemyState.WANDER;
    headSkinId: string;
    
    // Visual-only body segments and tail
    bodySprites: Phaser.GameObjects.Image[] = [];
    history: HistoryPoint[] = [];

    private wanderAngle: number = 0;
    private wanderTimer: number = 0;
    currentThreatType: number = 1;

    constructor(scene: Phaser.Scene, x: number, y: number, value: number, skinStyle?: string) {
        this.scene = scene;
        this.value = value;
        
        // Deterministic or random head skin assignment
        const skinKeys = Object.keys(HEAD_SKINS);
        const chosenKey = skinStyle && HEAD_SKINS[skinStyle] ? skinStyle : skinKeys[Math.floor(Math.random() * skinKeys.length)];
        this.headSkinId = chosenKey;
        const skinDef = HEAD_SKINS[chosenKey] || HEAD_SKINS.classic;

        this.glow = scene.add.graphics();
        this.glow.setDepth(49);
        
        const textureKey = scene.textures.exists(skinDef.enemyTexture) ? skinDef.enemyTexture : 'enemy_edible';
        this.body = scene.physics.add.image(x, y, textureKey);
        this.body.setCircle(18);
        this.body.setDepth(50);

        this.valueText = scene.add.text(x, y, this.value.toString(), {
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(51);

        this.wanderAngle = Math.random() * Math.PI * 2;

        // Initialize visual body segments: 4 segments + 1 tail = 5 total
        const totalSegments = 5;
        for (let i = 0; i < totalSegments; i++) {
            const isTail = i === totalSegments - 1;
            const tex = isTail && scene.textures.exists('enemy_tail') ? 'enemy_tail' : 'enemy_body';
            const seg = scene.add.image(x, y, tex);
            seg.setDepth(48 - i);
            seg.setScale(getTailScale(i, totalSegments));
            this.bodySprites.push(seg);
        }

        // Initialize history
        this.history.push({ x, y });
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

        let vx = Math.cos(targetAngle) * speed;
        let vy = Math.sin(targetAngle) * speed;

        // Soft boundary steering
        const hw = GameBalance.world.width / 2;
        const hh = GameBalance.world.height / 2;
        const EDGE_SOFT_ZONE = 160;
        const EDGE_HARD_MARGIN = 40;
        
        const steer = getBoundarySteering(this.body.x, this.body.y, hw, hh, EDGE_SOFT_ZONE, EDGE_HARD_MARGIN);
        
        if (steer.x !== 0 || steer.y !== 0) {
            const steerForce = speed * 1.5;
            vx += steer.x * steerForce;
            vy += steer.y * steerForce;
            
            const newSpeed = Math.sqrt(vx * vx + vy * vy);
            if (newSpeed > 0) {
                vx = (vx / newSpeed) * speed;
                vy = (vy / newSpeed) * speed;
            }
        }

        this.body.setVelocity(vx, vy);

        // Emergency hard clamp
        if (this.body.x < -hw + EDGE_HARD_MARGIN) {
            this.body.setX(-hw + EDGE_HARD_MARGIN);
            if (this.body.body!.velocity.x < 0) this.body.setVelocityX(-this.body.body!.velocity.x);
        } else if (this.body.x > hw - EDGE_HARD_MARGIN) {
            this.body.setX(hw - EDGE_HARD_MARGIN);
            if (this.body.body!.velocity.x > 0) this.body.setVelocityX(-this.body.body!.velocity.x);
        }

        if (this.body.y < -hh + EDGE_HARD_MARGIN) {
            this.body.setY(-hh + EDGE_HARD_MARGIN);
            if (this.body.body!.velocity.y < 0) this.body.setVelocityY(-this.body.body!.velocity.y);
        } else if (this.body.y > hh - EDGE_HARD_MARGIN) {
            this.body.setY(hh - EDGE_HARD_MARGIN);
            if (this.body.body!.velocity.y > 0) this.body.setVelocityY(-this.body.body!.velocity.y);
        }

        // Trailing movement history update
        const historySpacing = 12;
        if (this.history.length === 0) {
            this.history.push({ x: this.body.x, y: this.body.y });
        } else {
            const last = this.history[0];
            const dist = Phaser.Math.Distance.Between(this.body.x, this.body.y, last.x, last.y);
            if (dist > historySpacing) {
                this.history.unshift({ x: this.body.x, y: this.body.y });
                const maxHistory = this.bodySprites.length * 3;
                if (this.history.length > maxHistory) {
                    this.history.pop();
                }
            }
        }

        // Sync visual body positions
        for (let i = 0; i < this.bodySprites.length; i++) {
            const historyIdx = Math.min(i * 2 + 1, this.history.length - 1);
            if (this.history[historyIdx]) {
                const pt = this.history[historyIdx];
                this.bodySprites[i].setPosition(pt.x, pt.y);
                this.bodySprites[i].setVisible(true);

                // Orient tail
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

        // Sync text and glow
        this.valueText.setPosition(this.body.x, this.body.y);
        this.glow.setPosition(this.body.x, this.body.y);
    }

    private updateAppearance(type: number) {
        if (this.currentThreatType === type && this.glow.visible) return;
        this.currentThreatType = type;

        this.glow.clear();
        if (type === 1) { // Edible: GREEN glow
            this.glow.fillStyle(0x00ff00, 0.35);
            this.glow.fillCircle(0, 0, 26);
            this.glow.lineStyle(2, 0x00ff00, 0.8);
            this.glow.strokeCircle(0, 0, 25);
        } else if (type === 2) { // Mild Threat: ORANGE glow
            this.glow.fillStyle(0xffaa00, 0.4);
            this.glow.fillCircle(0, 0, 28);
            this.glow.lineStyle(2, 0xffaa00, 0.8);
            this.glow.strokeCircle(0, 0, 27);
        } else { // High Threat: RED glow
            this.glow.fillStyle(0xff0000, 0.5);
            this.glow.fillCircle(0, 0, 32);
            this.glow.lineStyle(3, 0xff0000, 0.9);
            this.glow.strokeCircle(0, 0, 30);
        }
    }

    getDropPositions(): { x: number, y: number }[] {
        const positions: { x: number, y: number }[] = [];
        // Return positions of visible body segments
        for (const spr of this.bodySprites) {
            if (spr.visible) {
                positions.push({ x: spr.x, y: spr.y });
            }
        }
        if (positions.length === 0) {
            positions.push({ x: this.body.x, y: this.body.y });
        }
        return positions;
    }

    destroy() {
        this.body.destroy();
        this.valueText.destroy();
        this.glow.destroy();
        this.bodySprites.forEach(s => s.destroy());
    }
}
