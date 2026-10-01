import Phaser from 'phaser';
import { ProgressionManager } from '../models/Progression';
import { getLevel, type LevelDefinition } from '../config/levels';
import { CosmeticsManager } from '../models/Cosmetics';
import { HEAD_SKINS } from '../config/headSkins';
import { type PrepStartValue, normalizeStartValue } from '../utils/prepValues';
import { t } from '../i18n';
import { arcadeButton, roundedPanel, sceneBackdrop, safeInsets, uiText, ARCADE } from '../ui/ArcadeStyle';

export class PrepScene extends Phaser.Scene {
    public levelId = 1;
    private levelDef!: LevelDefinition;
    private selectedStartValue: PrepStartValue = 5;
    private canPrepare = true;
    public titleText!: Phaser.GameObjects.Text;
    public levelSubText!: Phaser.GameObjects.Text;
    public startValueHeading!: Phaser.GameObjects.Text;
    public cardContainers: Phaser.GameObjects.Container[] = [];
    public cardBgs: Phaser.GameObjects.Rectangle[] = [];
    public startLevelBtnBg!: Phaser.GameObjects.Rectangle;
    public startLevelBtnText!: Phaser.GameObjects.Text;
    public backBtnBg!: Phaser.GameObjects.Rectangle;
    public backBtnText!: Phaser.GameObjects.Text;
    constructor() { super('PrepScene'); }
    init(data: { levelId?: number }) {
        this.levelId = data?.levelId || 1;
        ProgressionManager.load(); CosmeticsManager.load();
        this.selectedStartValue = 5;
        this.levelDef = getLevel(this.levelId);
        this.canPrepare = this.levelId <= ProgressionManager.getHighestUnlockedLevel();
    }
    create() {
        if (!this.canPrepare) { this.scene.start('MenuScene'); return; }
        this.render();
        this.scale.on('resize', this.resize, this);
        this.events.once('shutdown', () => this.scale.off('resize', this.resize, this));
    }
    private render() {
        this.children.removeAll(true);
        this.cardContainers = []; this.cardBgs = [];
        sceneBackdrop(this);
        const w = this.scale.width, h = this.scale.height, cx = w / 2, safe = safeInsets(this), short = h < 500;
        this.titleText = uiText(this, cx, safe.top + 38, t('prepTitle'), short ? 28 : 32, '#b9fff0');
        this.levelSubText = uiText(this, cx, safe.top + 76, `${t(`level_${this.levelId}`)} · ${t('bossInfo', { value: this.levelDef.bossValue })}`, 18, ARCADE.muted);
        const skin = HEAD_SKINS[CosmeticsManager.getSelectedHeadSkin()] || HEAD_SKINS.classic;
        if (!short) uiText(this, cx, safe.top + 114, `${t('hpInfo', { value: ProgressionManager.getMaxHP() })} · ${t(skin.nameKey)}`, 18, ARCADE.muted);
        this.startValueHeading = uiText(this, cx, safe.top + (short ? 113 : 174), t('startValueHeading'), 18);
        const cardW = Math.min(160, (w - safe.left - safe.right - 48) / 3), cardH = short ? 126 : 150;
        const cardY = safe.top + (short ? 189 : 282);
        const options = [{ value: 5, label: 'standardLabel', desc: 'standardDesc' }, { value: 7, label: 'boostLabel', desc: 'boostDesc' }, { value: 10, label: 'powerLabel', desc: 'powerDesc' }] as const;
        options.forEach((opt, index) => {
            const x = cx + (index - 1) * (cardW + 10), chosen = opt.value === this.selectedStartValue;
            const container = this.add.container(x, cardY);
            const panel = roundedPanel(this, 0, 0, cardW, cardH, chosen ? 0x1a4f52 : ARCADE.panel, chosen ? ARCADE.accent : ARCADE.border);
            const bg = this.add.rectangle(0, 0, cardW, cardH, 0, 0).setInteractive({ useHandCursor: true }).setName(`prepCard_${opt.value}`);
            bg.setData('value', opt.value).setData('isSelected', chosen);
            bg.on('pointerdown', () => this.selectStartValue(opt.value));
            container.add([panel, bg, uiText(this, 0, -cardH / 2 + 26, t(opt.label), 18), uiText(this, 0, 0, `${opt.value}`, 40, chosen ? '#b9fff0' : ARCADE.text), uiText(this, 0, cardH / 2 - 25, t(opt.desc), 16, ARCADE.muted)]);
            this.cardContainers.push(container); this.cardBgs.push(bg);
        });
        if (!short) {
            const previewY = Math.min(h - safe.bottom - 184, cardY + cardH / 2 + 106);
            for (let i = 5; i >= 1; i--) this.add.image(cx + 58 - i * 25, previewY + Math.sin(i * 0.7) * 14, 'player_body').setScale(1.5 - i * 0.08);
            this.add.image(cx + 74, previewY, skin.playerTexture).setScale(1.5);
            uiText(this, cx + 74, previewY - 51, String(this.selectedStartValue), 24);
            uiText(this, cx, previewY + 65, t('edibleHint'), 16, ARCADE.muted);
        }
        const actionY = h - safe.bottom - (short ? 70 : 110);
        const start = arcadeButton(this, short ? cx + 120 : cx, actionY, 224, t('startLevelBtn'), () => this.startLevel(), 'startLevelBtn');
        const back = arcadeButton(this, short ? cx - 120 : cx, short ? actionY : actionY + 62, short ? 180 : 224, t('backBtn'), () => this.scene.start('MenuScene'), 'backBtn', false);
        this.startLevelBtnBg = start.bg; this.startLevelBtnText = start.label;
        this.backBtnBg = back.bg; this.backBtnText = back.label;
    }
    public selectStartValue(value: PrepStartValue) { this.selectedStartValue = normalizeStartValue(value); this.render(); }
    public getSelectedStartValue(): number { return this.selectedStartValue; }
    private startLevel() {
        const context = (this.sound as any).context;
        if (context?.state === 'suspended') context.resume();
        this.scene.start('GameScene', { levelId: this.levelId, startValueOverride: this.selectedStartValue });
    }
    resize(_gameSize: Phaser.Structs.Size) { this.render(); }
}
