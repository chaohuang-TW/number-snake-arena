import Phaser from 'phaser';
import { isTouchCapableDevice } from '../utils/device';
import type { MagnetState } from '../systems/MagnetAbility';
import { arenaUiLayout, type RectBounds } from '../utils/layout';
import { t } from '../i18n';
import { uiUnit, safeInsets, ARCADE } from './ArcadeStyle';

export class HUD {
    scene: Phaser.Scene;
    hpText: Phaser.GameObjects.Text;
    valueText: Phaser.GameObjects.Text;
    scoreText: Phaser.GameObjects.Text;
    bestScoreText: Phaser.GameObjects.Text;
    magnetText: Phaser.GameObjects.Text;
    boostBarBg: Phaser.GameObjects.Graphics;
    boostBarFill: Phaser.GameObjects.Graphics;
    private backing: Phaser.GameObjects.Graphics;
    boostButton!: Phaser.GameObjects.Arc;
    boostButtonText!: Phaser.GameObjects.Text;
    magnetButton!: Phaser.GameObjects.Arc;
    magnetButtonText!: Phaser.GameObjects.Text;
    isBoostPressed = false;
    isMagnetPressed = false;
    onMagnetTrigger?: () => void;
    private score = 0;
    private bestScore = 0;
    private value = 5;
    private energyRatio = 1;
    private boostPointer: number | null = null;
    private magnetPointer: number | null = null;
    private barBounds: RectBounds = { x: 0, y: 0, width: 1, height: 1 };
    private radius = 36;
    private readonly releaseAll = () => { this.isBoostPressed = false; this.isMagnetPressed = false; this.boostPointer = null; this.magnetPointer = null; };
    private readonly pointerReleased = (pointer: Phaser.Input.Pointer) => {
        if (pointer.id === this.boostPointer) { this.isBoostPressed = false; this.boostPointer = null; }
        if (pointer.id === this.magnetPointer) { this.isMagnetPressed = false; this.magnetPointer = null; }
    };
    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.backing = scene.add.graphics().setScrollFactor(0).setDepth(198);
        const text = (size: number, color: string) => scene.add.text(0, 0, '', { fontFamily: ARCADE.font, fontSize: `${uiUnit(scene, size)}px`, color, fontStyle: 'bold' }).setScrollFactor(0).setDepth(200);
        this.hpText = text(24, '#ffc5d2');
        this.valueText = text(28, '#b9fff0');
        this.scoreText = text(18, ARCADE.text);
        this.bestScoreText = text(16, ARCADE.muted);
        this.magnetText = text(16, '#b9fff0');
        this.boostBarBg = scene.add.graphics().setScrollFactor(0).setDepth(200);
        this.boostBarFill = scene.add.graphics().setScrollFactor(0).setDepth(201);
        this.createTouchButtons();
        scene.input.on('pointerup', this.pointerReleased);
        scene.input.on('pointerupoutside', this.pointerReleased);
        scene.events.on('pause', this.releaseAll);
        scene.events.on('sleep', this.releaseAll);
        window.addEventListener('blur', this.releaseAll);
        window.addEventListener('pointercancel', this.releaseAll);
        document.addEventListener('visibilitychange', this.releaseAll);
        scene.events.once('shutdown', this.destroy, this);
        this.resize(scene.scale.gameSize);
    }
    createTouchButtons() {
        this.radius = uiUnit(this.scene, 36);
        this.boostButton = this.scene.add.circle(0, 0, this.radius, 0x554225, 0.9).setStrokeStyle(2, 0xffc16e).setScrollFactor(0).setDepth(200).setInteractive();
        this.boostButtonText = this.scene.add.text(0, 0, t('boost'), { fontFamily: ARCADE.font, fontSize: `${uiUnit(this.scene, 18)}px`, fontStyle: 'bold', color: '#fff1d2' }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        this.boostButton.on('pointerdown', (pointer: Phaser.Input.Pointer) => { this.boostPointer = pointer.id; this.isBoostPressed = true; });
        this.boostButton.on('pointerup', this.pointerReleased);
        this.boostButton.on('pointerupoutside', this.pointerReleased);
        this.magnetButton = this.scene.add.circle(0, 0, this.radius, 0x1c4a69, 0.9).setStrokeStyle(2, 0x8bdaf5).setScrollFactor(0).setDepth(200).setInteractive();
        this.magnetButtonText = this.scene.add.text(0, 0, t('magnet'), { fontFamily: ARCADE.font, fontSize: `${uiUnit(this.scene, 18)}px`, fontStyle: 'bold', color: '#e8faff' }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        this.magnetButton.on('pointerdown', (pointer: Phaser.Input.Pointer) => { this.magnetPointer = pointer.id; this.isMagnetPressed = true; this.onMagnetTrigger?.(); });
        this.magnetButton.on('pointerup', this.pointerReleased);
        this.magnetButton.on('pointerupoutside', this.pointerReleased);
    }
    updateValues(hp: number, maxHP: number, energy: number, maxEnergy: number, magnetText?: string, state: MagnetState = 'READY') { this.update(hp, maxHP, energy, maxEnergy, magnetText, state); }
    update(hp: number, maxHP: number, energy: number, maxEnergy: number, magnetHUDText?: string, state: MagnetState = 'READY') {
        this.hpText.setText('♥'.repeat(Math.max(0, hp)) + '♡'.repeat(Math.max(0, maxHP - hp)));
        this.valueText.setText(`${t('playerValue')} ${this.value}`);
        this.scoreText.setText(`${t('score')}: ${this.score}`);
        this.bestScoreText.setText(`${t('best')}: ${this.bestScore}`);
        this.magnetText.setText(magnetHUDText || t('magnetReady'));
        const magnetColor = state === 'READY' ? '#b9fff0' : state === 'ACTIVE' ? '#ffe69c' : ARCADE.muted;
        if (this.magnetText.style.color !== magnetColor) this.magnetText.setColor(magnetColor);
        this.magnetButton.setFillStyle(state === 'COOLDOWN' ? 0x273744 : state === 'ACTIVE' ? 0x297780 : 0x1c4a69, 0.9);
        this.energyRatio = maxEnergy > 0 ? Phaser.Math.Clamp(energy / maxEnergy, 0, 1) : 0;
        this.drawEnergy();
    }
    private drawEnergy() {
        const b = this.barBounds;
        this.boostBarBg.clear().fillStyle(0x2c4053, 1).fillRoundedRect(b.x, b.y, b.width, b.height, 5);
        this.boostBarFill.clear().fillStyle(0x8ae0ef, 1);
        if (this.energyRatio > 0) this.boostBarFill.fillRoundedRect(b.x, b.y, b.width * this.energyRatio, b.height, Math.min(5, b.width * this.energyRatio / 2));
    }
    setValue(value: number) { this.value = Number.isFinite(value) ? value : 5; this.valueText.setText(`${t('playerValue')} ${this.value}`); }
    addScore(points: number) { this.setScore(this.score + points); }
    setScore(score: number) { this.score = score; this.scoreText.setText(`${t('score')}: ${score}`); }
    setBestScore(best: number) { this.bestScore = best; this.bestScoreText.setText(`${t('best')}: ${best}`); }
    getScore(): number { return this.score; }
    getBestScore(): number { return this.bestScore; }
    resize(gameSize: Phaser.Structs.Size) {
        this.releaseAll();
        const layout = arenaUiLayout(gameSize.width, gameSize.height, safeInsets(this.scene));
        const x = layout.left, top = layout.top;
        this.hpText.setPosition(x, top);
        this.valueText.setPosition(x, top + 34);
        this.scoreText.setPosition(x, top + 75);
        this.bestScoreText.setPosition(x, top + 100);
        this.magnetText.setPosition(x, top + 143);
        this.barBounds = { x, y: top + 127, width: gameSize.width < 600 ? 162 : 204, height: 9 };
        this.backing.clear().fillStyle(0x071321, 0.75).fillRoundedRect(x - 8, top - 7, gameSize.width < 600 ? 184 : 226, 179, 12);
        this.boostButton.setPosition(layout.boost.x, layout.boost.y);
        this.boostButtonText.setPosition(layout.boost.x, layout.boost.y);
        this.magnetButton.setPosition(layout.magnet.x, layout.magnet.y);
        this.magnetButtonText.setPosition(layout.magnet.x, layout.magnet.y);
        for (const object of [this.boostButton, this.boostButtonText, this.magnetButton, this.magnetButtonText]) object.setVisible(isTouchCapableDevice());
        this.drawEnergy();
    }
    private textBounds(text: Phaser.GameObjects.Text): RectBounds { const b = text.getBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height }; }
    getHPBounds(): RectBounds { return this.textBounds(this.hpText); }
    getValueBounds(): RectBounds { return this.textBounds(this.valueText); }
    getScoreBounds(): RectBounds { return this.textBounds(this.scoreText); }
    getBestBounds(): RectBounds { return this.textBounds(this.bestScoreText); }
    getMagnetHUDBounds(): RectBounds { return this.textBounds(this.magnetText); }
    getBoostBarBounds(): RectBounds { return { ...this.barBounds }; }
    getBoostButtonBounds(): RectBounds { return this.boostButton.visible ? { x: this.boostButton.x - this.radius, y: this.boostButton.y - this.radius, width: 2 * this.radius, height: 2 * this.radius } : { x: 0, y: 0, width: 0, height: 0 }; }
    getMagnetButtonBounds(): RectBounds { return this.magnetButton.visible ? { x: this.magnetButton.x - this.radius, y: this.magnetButton.y - this.radius, width: 2 * this.radius, height: 2 * this.radius } : { x: 0, y: 0, width: 0, height: 0 }; }
    destroy() {
        this.releaseAll();
        this.scene.input.off('pointerup', this.pointerReleased);
        this.scene.input.off('pointerupoutside', this.pointerReleased);
        this.scene.events.off('pause', this.releaseAll);
        this.scene.events.off('sleep', this.releaseAll);
        window.removeEventListener('blur', this.releaseAll);
        window.removeEventListener('pointercancel', this.releaseAll);
        document.removeEventListener('visibilitychange', this.releaseAll);
        for (const object of [this.hpText, this.valueText, this.scoreText, this.bestScoreText, this.magnetText, this.backing, this.boostBarBg, this.boostBarFill, this.boostButton, this.boostButtonText, this.magnetButton, this.magnetButtonText]) object.destroy();
    }
}
