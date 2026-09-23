import Phaser from 'phaser';
import { t } from '../i18n';
import { WHEEL_REWARDS, type WheelReward, pickWheelReward } from '../utils/luckyWheel';

export class LuckyWheelOverlay {
    private scene: Phaser.Scene;
    public container: Phaser.GameObjects.Container;
    private bgDim: Phaser.GameObjects.Rectangle;
    private wheelContainer: Phaser.GameObjects.Container;
    private wheelGraphics: Phaser.GameObjects.Graphics;
    private sectorTexts: Phaser.GameObjects.Text[] = [];
    private hubGraphics: Phaser.GameObjects.Graphics;
    private pointer: Phaser.GameObjects.Text;
    private titleText: Phaser.GameObjects.Text;
    private spinBtnBg!: Phaser.GameObjects.Rectangle;
    private spinBtnText!: Phaser.GameObjects.Text;
    private resultContainer!: Phaser.GameObjects.Container;
    private resultTitleText!: Phaser.GameObjects.Text;
    private resultRewardText!: Phaser.GameObjects.Text;
    private faceBossBtnBg!: Phaser.GameObjects.Rectangle;
    private faceBossBtnText!: Phaser.GameObjects.Text;

    private isSpinning: boolean = false;
    public hasSpun: boolean = false;
    public rewardApplied: boolean = false;
    public selectedReward: WheelReward | null = null;
    private onCompleteCallback?: (reward: WheelReward) => void;

    // For deterministic testing injection
    public forcedRewardId: string | null = null;

    private wheelRadius: number = 140;

    constructor(scene: Phaser.Scene, onComplete?: (reward: WheelReward) => void) {
        this.scene = scene;
        this.onCompleteCallback = onComplete;

        this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(400);

        const w = scene.scale.width;
        const h = scene.scale.height;

        // Dim background
        this.bgDim = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85)
            .setScrollFactor(0);
        this.container.add(this.bgDim);

        // Title
        this.titleText = scene.add.text(w / 2, 45, t('wheelTitle'), {
            fontSize: '36px',
            fontStyle: 'bold',
            color: '#ffd700'
        }).setOrigin(0.5).setScrollFactor(0);
        this.container.add(this.titleText);

        // Wheel container for rotation
        this.wheelContainer = scene.add.container(w / 2, h / 2 - 20).setScrollFactor(0);
        this.wheelGraphics = scene.add.graphics().setScrollFactor(0);
        this.wheelContainer.add(this.wheelGraphics);
        this.container.add(this.wheelContainer);

        // Center hub
        this.hubGraphics = scene.add.graphics().setScrollFactor(0);
        this.wheelContainer.add(this.hubGraphics);

        // Fixed Pointer at the top of the wheel (pointing downward: ▼)
        this.pointer = scene.add.text(w / 2, (h / 2 - 20) - this.wheelRadius - 6, '▼', {
            fontSize: '32px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0);
        this.container.add(this.pointer);

        this.drawWheel();

        // Spin Button
        this.createSpinButton(w / 2, h / 2 + this.wheelRadius + 45);

        // Result Container (hidden until spin ends)
        this.createResultSection(w / 2, h / 2 + this.wheelRadius + 45);

        this.resize(w, h);
    }

    private drawWheel() {
        this.wheelGraphics.clear();
        this.sectorTexts.forEach(t => t.destroy());
        this.sectorTexts = [];

        const numSectors = WHEEL_REWARDS.length;
        const arc = (Math.PI * 2) / numSectors;

        for (let i = 0; i < numSectors; i++) {
            const reward = WHEEL_REWARDS[i];
            const startAngle = i * arc;
            const endAngle = (i + 1) * arc;

            // Draw pie slice
            this.wheelGraphics.fillStyle(reward.color, 1);
            this.wheelGraphics.slice(0, 0, this.wheelRadius, startAngle, endAngle, false);
            this.wheelGraphics.fillPath();

            // Border
            this.wheelGraphics.lineStyle(2, 0xffffff, 0.6);
            this.wheelGraphics.slice(0, 0, this.wheelRadius, startAngle, endAngle, false);
            this.wheelGraphics.strokePath();

            // Label text in sector
            const midAngle = startAngle + arc / 2;
            const textDist = this.wheelRadius * 0.62;
            const tx = Math.cos(midAngle) * textDist;
            const ty = Math.sin(midAngle) * textDist;

            const labelStr = t(reward.labelKey);
            const textObj = this.scene.add.text(tx, ty, labelStr, {
                fontSize: '13px',
                fontStyle: 'bold',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
            textObj.setRotation(midAngle + Math.PI / 2);

            this.wheelContainer.add(textObj);
            this.sectorTexts.push(textObj);
        }

        // Draw outer rim
        this.wheelGraphics.lineStyle(6, 0xffd700, 1);
        this.wheelGraphics.strokeCircle(0, 0, this.wheelRadius);

        // Draw center hub
        this.hubGraphics.clear();
        this.hubGraphics.fillStyle(0x1a1a2e, 1);
        this.hubGraphics.fillCircle(0, 0, 24);
        this.hubGraphics.lineStyle(3, 0xffd700, 1);
        this.hubGraphics.strokeCircle(0, 0, 24);
    }

    private createSpinButton(x: number, y: number) {
        this.spinBtnBg = this.scene.add.rectangle(x, y, 160, 44, 0x00aa00, 1)
            .setScrollFactor(0)
            .setStrokeStyle(3, 0x00ff88)
            .setInteractive({ useHandCursor: true });
        this.spinBtnBg.setName('wheelSpinBtn');

        this.spinBtnText = this.scene.add.text(x, y, t('spin'), {
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0);

        this.spinBtnBg.on('pointerdown', () => {
            this.spin();
        });

        this.container.add([this.spinBtnBg, this.spinBtnText]);
    }

    public get spinBtn(): Phaser.GameObjects.Rectangle {
        return this.spinBtnBg;
    }

    public get confirmBtn(): Phaser.GameObjects.Rectangle {
        return this.faceBossBtnBg;
    }

    private cardBg!: Phaser.GameObjects.Rectangle;
    public completed: boolean = false;

    private createResultSection(x: number, y: number) {
        this.resultContainer = this.scene.add.container(0, 0).setScrollFactor(0).setVisible(false);

        this.cardBg = this.scene.add.rectangle(x, y, 280, 96, 0x112233, 0.95)
            .setScrollFactor(0)
            .setStrokeStyle(2, 0xffd700);

        this.resultTitleText = this.scene.add.text(x, y - 32, t('yourReward'), {
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#aaaaaa'
        }).setOrigin(0.5).setScrollFactor(0);

        this.resultRewardText = this.scene.add.text(x, y - 12, '', {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#ffd700'
        }).setOrigin(0.5).setScrollFactor(0);

        this.faceBossBtnBg = this.scene.add.rectangle(x, y + 24, 230, 36, 0x990000, 1)
            .setScrollFactor(0)
            .setStrokeStyle(2, 0xff4444)
            .setInteractive({ useHandCursor: true });
        this.faceBossBtnBg.setName('faceUltimateBossBtn');

        this.faceBossBtnText = this.scene.add.text(x, y + 24, t('faceUltimateBoss'), {
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0);

        this.faceBossBtnBg.on('pointerdown', () => {
            if (this.selectedReward && this.onCompleteCallback && !this.completed) {
                this.completed = true;
                this.faceBossBtnBg.disableInteractive();
                const cb = this.onCompleteCallback;
                this.onCompleteCallback = undefined;
                cb(this.selectedReward);
            }
        });

        this.resultContainer.add([this.cardBg, this.resultTitleText, this.resultRewardText, this.faceBossBtnBg, this.faceBossBtnText]);
        this.container.add(this.resultContainer);
    }

    public spin(targetRewardId?: string): WheelReward | null {
        if (this.hasSpun || this.isSpinning) return null;
        this.hasSpun = true;
        this.isSpinning = true;

        // Disable spin button immediately
        this.spinBtnBg.disableInteractive();
        this.spinBtnBg.setFillStyle(0x444444);

        // Select reward: check if forced or random
        let reward: WheelReward;
        const forced = targetRewardId || this.forcedRewardId;
        if (forced) {
            const found = WHEEL_REWARDS.find(r => r.id === forced);
            reward = found || pickWheelReward(Math.random());
        } else {
            reward = pickWheelReward(Math.random());
        }
        this.selectedReward = reward;

        // Calculate rotation angle so pointer (at top: -90° / 270°) points to selected segment
        // Each sector i covers [i * arc, (i + 1) * arc], with center midAngle = (i + 0.5) * arc
        // Top pointer is at angle -PI / 2 (-90°).
        // For sector i center to be at -PI / 2: midAngle + rotation = -PI / 2 (mod 2*PI)
        // rotation = -PI / 2 - midAngle = 3*PI/2 - midAngle
        const numSectors = WHEEL_REWARDS.length;
        const arc = (Math.PI * 2) / numSectors;
        const targetSectorCenter = reward.index * arc + arc / 2;
        const baseAlignment = -Math.PI / 2 - targetSectorCenter;

        // Add 5 full rotations (10*PI) for cinematic spin
        const totalRotation = Math.PI * 10 + baseAlignment;

        this.scene.tweens.add({
            targets: this.wheelContainer,
            rotation: totalRotation,
            duration: 3000,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.isSpinning = false;
                this.onSpinFinished();
            }
        });

        return reward;
    }

    private onSpinFinished() {
        if (!this.selectedReward) return;

        // Hide spin button, show result
        this.spinBtnBg.setVisible(false);
        this.spinBtnText.setVisible(false);

        this.resultRewardText.setText(t(this.selectedReward.labelKey));
        this.resultContainer.setVisible(true);
        this.rewardApplied = true;

        // Flash pointer
        this.scene.tweens.add({
            targets: this.pointer,
            scale: 1.4,
            yoyo: true,
            duration: 200,
            repeat: 2
        });
    }

    public resize(sizeOrW: Phaser.Structs.Size | number, maybeH?: number) {
        let w: number;
        let h: number;
        if (typeof sizeOrW === 'number') {
            w = sizeOrW;
            h = maybeH ?? this.scene.scale.height;
        } else {
            w = sizeOrW.width;
            h = sizeOrW.height;
        }
        this.bgDim.setPosition(w / 2, h / 2).setSize(w, h);
        this.titleText.setPosition(w / 2, Math.max(30, h * 0.08));

        // Adapt wheel size to compact screen
        const availableHeight = h - 220;
        const availableWidth = w - 40;
        const maxRadius = Math.min(150, availableHeight / 2.3, availableWidth / 2.3);
        const radius = Math.max(105, maxRadius);

        if (radius !== this.wheelRadius) {
            this.wheelRadius = radius;
            this.drawWheel();
        }

        const centerY = Math.max(160, h * 0.44);
        this.wheelContainer.setPosition(w / 2, centerY);
        this.pointer.setPosition(w / 2, centerY - this.wheelRadius - 6);

        const actionY = Math.min(h - 55, centerY + this.wheelRadius + 50);
        this.spinBtnBg.setPosition(w / 2, actionY);
        this.spinBtnText.setPosition(w / 2, actionY);
        if (this.cardBg) this.cardBg.setPosition(w / 2, actionY);
        if (this.resultTitleText) this.resultTitleText.setPosition(w / 2, actionY - 32);
        if (this.resultRewardText) this.resultRewardText.setPosition(w / 2, actionY - 12);
        if (this.faceBossBtnBg) this.faceBossBtnBg.setPosition(w / 2, actionY + 24);
        if (this.faceBossBtnText) this.faceBossBtnText.setPosition(w / 2, actionY + 24);
    }

    public destroy() {
        this.container.destroy();
    }
}
