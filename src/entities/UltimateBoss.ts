import Phaser from 'phaser';
import { getInwardBoundarySteering, clampToSafeWorld, getSafeWorldBounds } from '../utils/boundary';
import { GameBalance } from '../config/gameBalance';
import { t } from '../i18n';

export type UltimateBossState = 'CHASE' | 'DASH_TELEGRAPH' | 'DASH' | 'ORBIT_TELEGRAPH' | 'ORBIT' | 'FLEE';

export class UltimateBoss {
    scene: Phaser.Scene;
    body: Phaser.Physics.Arcade.Image;
    value: number = 500;
    arenaId: string = 'ultimate_boss';
    isUltimate: boolean = true;

    // Visual elements
    private visualContainer: Phaser.GameObjects.Container;
    private coreGraphics: Phaser.GameObjects.Graphics;
    private ringGraphics: Phaser.GameObjects.Graphics;
    private telegraphGraphics: Phaser.GameObjects.Graphics;
    public valueText: Phaser.GameObjects.Text;
    private glowGraphics: Phaser.GameObjects.Graphics;

    // Movement & state constants
    readonly baseSpeed: number = 145;
    readonly dashSpeed: number = 280;
    readonly orbitSpeed: number = 190;
    readonly radius: number = 55;

    // Boundary configuration
    readonly boundaryMargin: number = 100;
    readonly softZone: number = 250;
    readonly boundarySteerStrength: number = 1.8;

    // State machine
    public state: UltimateBossState = 'CHASE';
    private stateTimer: number = 0;
    private attackCycleIndex: number = 0; // alternates between dash and orbit
    private dashTargetX: number = 0;
    private dashTargetY: number = 0;
    private dashDirection: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);
    private ringRotation: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        this.scene = scene;

        // Container holding visual graphics and text
        this.visualContainer = scene.add.container(x, y).setDepth(45);

        this.telegraphGraphics = scene.add.graphics();
        this.glowGraphics = scene.add.graphics();
        this.coreGraphics = scene.add.graphics();
        this.ringGraphics = scene.add.graphics();

        this.valueText = scene.add.text(0, 0, '500', {
            fontSize: '32px',
            fontStyle: 'bold',
            color: '#ffd700'
        }).setOrigin(0.5);

        this.visualContainer.add([this.telegraphGraphics, this.glowGraphics, this.coreGraphics, this.ringGraphics, this.valueText]);

        // Arcade physics body
        this.body = scene.physics.add.image(x, y, 'boss');
        this.body.setCircle(this.radius);
        this.body.setVisible(false);
        this.body.setCollideWorldBounds(true);
        (this.body.body as Phaser.Physics.Arcade.Body).onWorldBounds = true;

        this.drawCore(false);
        this.state = 'CHASE';
        this.stateTimer = 2200; // First attack after 2.2s
    }

    get arenaName(): string {
        return t('ultimateBossLabel', { value: 500 });
    }

    get isFleeing(): boolean {
        return this.state === 'FLEE';
    }

    public drawCore(isEdible: boolean) {
        this.coreGraphics.clear();
        this.glowGraphics.clear();

        if (isEdible) {
            // Golden pulsing edible aura
            this.glowGraphics.fillStyle(0xffd700, 0.35);
            this.glowGraphics.fillCircle(0, 0, this.radius + 14);

            this.coreGraphics.fillStyle(0x4a154b, 1);
            this.coreGraphics.fillCircle(0, 0, this.radius);
            this.coreGraphics.lineStyle(5, 0x00ff88, 1);
            this.coreGraphics.strokeCircle(0, 0, this.radius);
            this.valueText.setColor('#00ff88');
        } else {
            // Menacing dark purple + gold rim
            this.glowGraphics.fillStyle(0x990033, 0.25);
            this.glowGraphics.fillCircle(0, 0, this.radius + 10);

            this.coreGraphics.fillStyle(0x1d0633, 1);
            this.coreGraphics.fillCircle(0, 0, this.radius);
            this.coreGraphics.lineStyle(5, 0xffd700, 1);
            this.coreGraphics.strokeCircle(0, 0, this.radius);
            this.valueText.setColor('#ffd700');
        }
    }

    private drawRings() {
        this.ringGraphics.clear();
        this.ringGraphics.lineStyle(2, this.isFleeing ? 0x00ffff : 0xffaa00, 0.8);
        this.ringGraphics.strokeCircle(0, 0, this.radius - 12);

        // Rotating decorative energy notches
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
            const rx = Math.cos(a + this.ringRotation) * (this.radius - 12);
            const ry = Math.sin(a + this.ringRotation) * (this.radius - 12);
            this.ringGraphics.fillStyle(0xffd700, 0.9);
            this.ringGraphics.fillCircle(rx, ry, 4);
        }
    }

    public update(
        arg1: number,
        arg2: number,
        arg3: number,
        arg4: number = 16.6
    ) {
        if (!this.body || !this.body.body) return;

        // Support both (delta, playerX, playerY, playerValue) and (playerX, playerY, playerValue, delta)
        let delta = 16.6;
        let playerX = 0;
        let playerY = 0;
        let playerValue = 0;

        if (arg4 > 50) {
            delta = arg1;
            playerX = arg2;
            playerY = arg3;
            playerValue = arg4;
        } else {
            playerX = arg1;
            playerY = arg2;
            playerValue = arg3;
            delta = arg4;
        }

        const arcadeBody = this.body.body as Phaser.Physics.Arcade.Body;
        const currentX = this.body.x;
        const currentY = this.body.y;

        // Animate rotating rings
        this.ringRotation += 0.03;
        this.drawRings();

        // 1. Strict threshold check
        // PlayerValue <= 500: cannot eat (CHASE/ATTACK)
        // PlayerValue > 500: FLEE / edible
        if (playerValue > this.value) {
            if (this.state !== 'FLEE') {
                this.state = 'FLEE';
                this.telegraphGraphics.clear();
                this.drawCore(true);
            }
        } else {
            if (this.state === 'FLEE') {
                this.state = 'CHASE';
                this.stateTimer = 2000;
                this.drawCore(false);
            }
        }

        // 2. State Machine Execution
        let targetVx = 0;
        let targetVy = 0;

        if (this.state === 'FLEE') {
            // Flee away from player
            const dx = currentX - playerX;
            const dy = currentY - playerY;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            targetVx = (dx / dist) * this.baseSpeed;
            targetVy = (dy / dist) * this.baseSpeed;
            this.telegraphGraphics.clear();

        } else if (this.state === 'CHASE') {
            // Direct pursuit of player
            const dx = playerX - currentX;
            const dy = playerY - currentY;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            targetVx = (dx / dist) * this.baseSpeed;
            targetVy = (dy / dist) * this.baseSpeed;

            this.stateTimer -= delta;
            if (this.stateTimer <= 0) {
                // Switch to next attack telegraph
                if (this.attackCycleIndex % 2 === 0) {
                    this.state = 'DASH_TELEGRAPH';
                    this.stateTimer = 700; // 700ms telegraph
                    this.dashTargetX = playerX;
                    this.dashTargetY = playerY;
                } else {
                    this.state = 'ORBIT_TELEGRAPH';
                    this.stateTimer = 600; // 600ms telegraph
                }
                this.attackCycleIndex++;
            }

        } else if (this.state === 'DASH_TELEGRAPH') {
            // Slow down while aiming laser line
            targetVx = arcadeBody.velocity.x * 0.9;
            targetVy = arcadeBody.velocity.y * 0.9;

            // Draw red/gold telegraph line towards locked player position
            this.telegraphGraphics.clear();
            const localTargetX = this.dashTargetX - currentX;
            const localTargetY = this.dashTargetY - currentY;

            this.telegraphGraphics.lineStyle(3, 0xff0033, 0.9);
            this.telegraphGraphics.lineBetween(0, 0, localTargetX, localTargetY);
            this.telegraphGraphics.fillStyle(0xffd700, 0.8);
            this.telegraphGraphics.fillCircle(localTargetX, localTargetY, 8);

            this.stateTimer -= delta;
            if (this.stateTimer <= 0) {
                this.state = 'DASH';
                this.stateTimer = 900; // Dash for 900ms
                this.telegraphGraphics.clear();

                const dx = this.dashTargetX - currentX;
                const dy = this.dashTargetY - currentY;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                this.dashDirection.set(dx / dist, dy / dist);
            }

        } else if (this.state === 'DASH') {
            // Dash at 280 px/s in locked direction
            targetVx = this.dashDirection.x * this.dashSpeed;
            targetVy = this.dashDirection.y * this.dashSpeed;

            this.stateTimer -= delta;
            if (this.stateTimer <= 0) {
                this.state = 'CHASE';
                this.stateTimer = 2000;
            }

        } else if (this.state === 'ORBIT_TELEGRAPH') {
            // Circular arc warning around boss
            targetVx = arcadeBody.velocity.x * 0.9;
            targetVy = arcadeBody.velocity.y * 0.9;

            this.telegraphGraphics.clear();
            this.telegraphGraphics.lineStyle(3, 0xff9900, 0.8);
            this.telegraphGraphics.strokeCircle(0, 0, this.radius + 20);

            this.stateTimer -= delta;
            if (this.stateTimer <= 0) {
                this.state = 'ORBIT';
                this.stateTimer = 1500; // Orbit for 1.5s
                this.telegraphGraphics.clear();
            }

        } else if (this.state === 'ORBIT') {
            // Tangential movement around player at 190 px/s
            const dx = currentX - playerX;
            const dy = currentY - playerY;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            // Tangent perpendicular vector (-dy, dx)
            const tangentX = -dy / dist;
            const tangentY = dx / dist;

            // Slight inward pull to keep orbit distance
            const targetDist = 220;
            const radialPull = (dist - targetDist) * 0.003;
            const radialX = -(dx / dist) * radialPull;
            const radialY = -(dy / dist) * radialPull;

            targetVx = (tangentX + radialX) * this.orbitSpeed;
            targetVy = (tangentY + radialY) * this.orbitSpeed;

            this.stateTimer -= delta;
            if (this.stateTimer <= 0) {
                this.state = 'CHASE';
                this.stateTimer = 2000;
            }
        }

        // 3. Apply Boundary Steering Protection
        const ww = GameBalance.world.width;
        const wh = GameBalance.world.height;
        const steer = getInwardBoundarySteering(
            currentX,
            currentY,
            ww,
            wh,
            this.boundaryMargin,
            this.softZone
        );

        if (steer.x !== 0 || steer.y !== 0) {
            const steerForce = this.baseSpeed * this.boundarySteerStrength;
            targetVx += steer.x * steerForce;
            targetVy += steer.y * steerForce;
        }

        arcadeBody.setVelocity(targetVx, targetVy);

        // 4. Hard Clamp Failsafe
        const bounds = getSafeWorldBounds(ww, wh, this.boundaryMargin);
        const clamped = clampToSafeWorld(currentX, currentY, bounds);
        if (clamped.x !== currentX || clamped.y !== currentY) {
            this.body.setPosition(clamped.x, clamped.y);
        }

        // 5. Sync visual container position
        this.visualContainer.setPosition(this.body.x, this.body.y);
    }

    public destroy() {
        this.telegraphGraphics.clear();
        this.visualContainer.destroy();
        if (this.body) {
            this.body.destroy();
        }
    }
}
