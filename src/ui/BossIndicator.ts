import Phaser from 'phaser';
import type { RectBounds } from '../utils/layout';
import { rectsOverlap } from '../utils/layout';
import type { NumberBoss } from '../entities/NumberBoss';

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

    public update(boss: NumberBoss | null, camera: Phaser.Cameras.Scene2D.Camera, obstacles: RectBounds[] = []) {
        if (!boss || !boss.body || !boss.body.active) {
            this.container.setVisible(false);
            return;
        }

        this.currentValue = boss.value;
        const camView = camera.worldView;
        const bossX = boss.body.x;
        const bossY = boss.body.y;
        const bossRadius = 40;

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
        const labelStr = `BOSS ${boss.value}`;
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
        const edgeMargin = 45; // recommended 40-60px

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
        const t = Math.min(tX, tY);

        const idealX = Math.max(minX, Math.min(maxX, scx + cos * t));
        const idealY = Math.max(minY, Math.min(maxY, scy + sin * t));

        // Perimeter search for non-overlapping placement
        const pos = this.resolveNonOverlappingPosition(
            idealX, idealY,
            minX, maxX, minY, maxY,
            obstacles
        );

        this.container.setPosition(pos.x, pos.y);
    }

    private resolveNonOverlappingPosition(
        idealX: number,
        idealY: number,
        minX: number,
        maxX: number,
        minY: number,
        maxY: number,
        obstacles: RectBounds[]
    ): { x: number; y: number } {
        const w = this.panelWidth;
        const h = this.panelHeight;

        // Check if ideal position itself is free
        const idealBounds: RectBounds = { x: idealX - w / 2, y: idealY - h / 2, width: w, height: h };
        if (!obstacles.some(obs => rectsOverlap(idealBounds, obs))) {
            return { x: idealX, y: idealY };
        }

        // Perimeter parameterization: Top -> Right -> Bottom -> Left
        const L_top = maxX - minX;
        const L_right = maxY - minY;
        const L_bottom = maxX - minX;
        const totalL = 2 * (L_top + L_right);

        if (totalL <= 0) return { x: idealX, y: idealY };

        const getPoint = (dist: number): { x: number; y: number } => {
            let p = ((dist % totalL) + totalL) % totalL;
            if (p < L_top) return { x: minX + p, y: minY };
            p -= L_top;
            if (p < L_right) return { x: maxX, y: minY + p };
            p -= L_right;
            if (p < L_bottom) return { x: maxX - p, y: maxY };
            p -= L_bottom;
            return { x: minX, y: maxY - p };
        };

        // Determine ideal perimeter distance
        let dIdeal = 0;
        const distToTop = Math.abs(idealY - minY);
        const distToBottom = Math.abs(idealY - maxY);
        const distToLeft = Math.abs(idealX - minX);
        const distToRight = Math.abs(idealX - maxX);
        const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);

        if (minDist === distToTop) dIdeal = idealX - minX;
        else if (minDist === distToRight) dIdeal = L_top + (idealY - minY);
        else if (minDist === distToBottom) dIdeal = L_top + L_right + (maxX - idealX);
        else dIdeal = L_top + L_right + L_bottom + (maxY - idealY);

        // Search alternating clockwise/counter-clockwise with step size 8px
        const maxSteps = Math.ceil(totalL / 8);
        for (let i = 1; i <= maxSteps; i++) {
            const step = i * 8;
            for (const sign of [1, -1]) {
                const pt = getPoint(dIdeal + sign * step);
                const candidate: RectBounds = { x: pt.x - w / 2, y: pt.y - h / 2, width: w, height: h };
                if (!obstacles.some(obs => rectsOverlap(candidate, obs))) {
                    return pt;
                }
            }
        }

        return { x: idealX, y: idealY };
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

    public resize(_gameSize: Phaser.Structs.Size) {
        // Will be dynamically positioned in update()
    }

    public destroy() {
        this.container.destroy();
    }
}
