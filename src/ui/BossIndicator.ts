import Phaser from 'phaser';
import type { RectBounds } from '../utils/layout';
import { rectsOverlap } from '../utils/layout';
import { t } from '../i18n';

export interface BossIndicatorTarget {
    body?: { x: number; y: number; active?: boolean };
    value: number;
    isUltimate?: boolean;
}

export class BossIndicator {
    scene: Phaser.Scene;
    container: Phaser.GameObjects.Container;
    private bg: Phaser.GameObjects.Graphics;
    private arrow: Phaser.GameObjects.Text;
    private text: Phaser.GameObjects.Text;

    private panelWidth: number = 96;
    private panelHeight: number = 28;
    private currentValue: number = 0;
    private currentAngle: number = 0;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(205).setVisible(false);

        this.bg = scene.add.graphics();
        this.container.add(this.bg);

        // Arrow icon pointing towards Boss
        this.arrow = scene.add.text(0, 0, '▶', {
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#ffd700'
        }).setOrigin(0.5);
        this.container.add(this.arrow);

        // Boss label text
        this.text = scene.add.text(0, 0, 'BOSS', {
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.container.add(this.text);

        this.drawBackground();
    }

    private drawBackground() {
        this.bg.clear();
        this.bg.fillStyle(0x3a0000, 0.88);
        this.bg.fillRoundedRect(-this.panelWidth / 2, -this.panelHeight / 2, this.panelWidth, this.panelHeight, 6);
        this.bg.lineStyle(1.5, 0xff3333, 0.9);
        this.bg.strokeRoundedRect(-this.panelWidth / 2, -this.panelHeight / 2, this.panelWidth, this.panelHeight, 6);
    }

    public resize(_gameSize?: any) {
        // Boss indicator repositions dynamically in update()
    }

    public update(boss: BossIndicatorTarget | null, camera: Phaser.Cameras.Scene2D.Camera, obstacles: RectBounds[] = []) {
        if (!boss || !boss.body || boss.body.active === false) {
            this.container.setVisible(false);
            return;
        }

        this.currentValue = boss.value;
        const camView = camera.worldView;
        const bossX = boss.body.x;
        const bossY = boss.body.y;
        const bossRadius = boss.isUltimate ? 55 : 40;

        // Check if Boss is within the camera's visible viewport
        const onScreen = (
            bossX + bossRadius >= camView.x &&
            bossX - bossRadius <= camView.right &&
            bossY + bossRadius >= camView.y &&
            bossY - bossRadius <= camView.bottom
        );

        if (onScreen) {
            this.container.setVisible(false);
            return;
        }

        this.container.setVisible(true);
        const labelStr = boss.isUltimate
            ? t('ultimateBossLabel', { value: boss.value })
            : t('bossLabel', { value: boss.value });
        this.text.setText(labelStr);

        // Adjust panel width if needed based on text length
        const neededWidth = Math.max(92, this.text.width + 36);
        if (neededWidth !== this.panelWidth) {
            this.panelWidth = neededWidth;
            this.drawBackground();
        }

        // Layout arrow on the left, text on the right inside container
        this.arrow.setPosition(-this.panelWidth / 2 + 14, 0);
        this.text.setPosition(8, 0);

        // Calculate angle from camera center to Boss
        const camCenterX = camView.centerX;
        const camCenterY = camView.centerY;
        const dx = bossX - camCenterX;
        const dy = bossY - camCenterY;
        const angle = Math.atan2(dy, dx);
        this.currentAngle = angle;
        this.arrow.setRotation(angle);

        // Determine perimeter target on screen
        const viewW = camera.width;
        const viewH = camera.height;
        const edgeMargin = 45; // 40-60px margin

        const minX = this.panelWidth / 2 + 10;
        const maxX = viewW - this.panelWidth / 2 - 10;
        const minY = this.panelHeight / 2 + 10;
        const maxY = viewH - this.panelHeight / 2 - 10;

        const scx = viewW / 2;
        const scy = viewH / 2;

        let tX = Infinity;
        let tY = Infinity;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        if (cos > 1e-5) tX = (viewW - edgeMargin - scx) / cos;
        else if (cos < -1e-5) tX = (edgeMargin - scx) / cos;
        if (sin > 1e-5) tY = (viewH - edgeMargin - scy) / sin;
        else if (sin < -1e-5) tY = (edgeMargin - scy) / sin;

        const tMin = Math.min(Math.abs(tX), Math.abs(tY));
        let bestX = Phaser.Math.Clamp(scx + cos * tMin, minX, maxX);
        let bestY = Phaser.Math.Clamp(scy + sin * tMin, minY, maxY);

        // Anti-overlap avoidance algorithm
        let candidateRect: RectBounds = {
            x: bestX - this.panelWidth / 2,
            y: bestY - this.panelHeight / 2,
            width: this.panelWidth,
            height: this.panelHeight
        };

        const hasOverlap = (rect: RectBounds) => {
            return obstacles.some(obs => rectsOverlap(rect, obs));
        };

        if (hasOverlap(candidateRect)) {
            // Sample perimeter points clockwise and counter-clockwise to find nearest non-overlapping position
            const maxStep = 24;
            const stepRad = (Math.PI * 2) / maxStep;
            let found = false;

            for (let i = 1; i <= maxStep / 2; i++) {
                // Test +i and -i angles
                for (const sign of [1, -1]) {
                    const testAngle = angle + sign * i * stepRad;
                    const testCos = Math.cos(testAngle);
                    const testSin = Math.sin(testAngle);

                    let stepTX = Infinity;
                    let stepTY = Infinity;
                    if (testCos > 1e-5) stepTX = (viewW - edgeMargin - scx) / testCos;
                    else if (testCos < -1e-5) stepTX = (edgeMargin - scx) / testCos;
                    if (testSin > 1e-5) stepTY = (viewH - edgeMargin - scy) / testSin;
                    else if (testSin < -1e-5) stepTY = (edgeMargin - scy) / testSin;

                    const stepT = Math.min(Math.abs(stepTX), Math.abs(stepTY));
                    const candX = Phaser.Math.Clamp(scx + testCos * stepT, minX, maxX);
                    const candY = Phaser.Math.Clamp(scy + testSin * stepT, minY, maxY);

                    const testRect: RectBounds = {
                        x: candX - this.panelWidth / 2,
                        y: candY - this.panelHeight / 2,
                        width: this.panelWidth,
                        height: this.panelHeight
                    };

                    if (!hasOverlap(testRect)) {
                        bestX = candX;
                        bestY = candY;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
        }

        this.container.setPosition(bestX, bestY);
    }

    public hide() {
        this.container.setVisible(false);
    }

    public getBounds(): RectBounds {
        return {
            x: this.container.x - this.panelWidth / 2,
            y: this.container.y - this.panelHeight / 2,
            width: this.panelWidth,
            height: this.panelHeight
        };
    }

    public getState() {
        return {
            visible: this.container.visible,
            x: this.container.x,
            y: this.container.y,
            value: this.currentValue,
            text: this.text.text,
            angle: this.currentAngle,
            bounds: this.getBounds()
        };
    }

    public destroy() {
        this.container.destroy();
    }
}
