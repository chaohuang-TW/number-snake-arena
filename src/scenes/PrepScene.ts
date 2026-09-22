import Phaser from 'phaser';
import { ProgressionManager } from '../models/Progression';
import { getLevel, type LevelDefinition } from '../config/levels';
import { CosmeticsManager } from '../models/Cosmetics';
import { HEAD_SKINS } from '../config/headSkins';
import { type PrepStartValue, normalizeStartValue } from '../utils/prepValues';

export class PrepScene extends Phaser.Scene {
    private levelId: number = 1;
    private levelDef!: LevelDefinition;
    private selectedStartValue: PrepStartValue = 5;

    private titleText!: Phaser.GameObjects.Text;
    private levelSubText!: Phaser.GameObjects.Text;
    private infoContainer!: Phaser.GameObjects.Container;
    private startValueHeading!: Phaser.GameObjects.Text;

    private cardContainers: Phaser.GameObjects.Container[] = [];
    private cardBgs: Phaser.GameObjects.Rectangle[] = [];

    private startLevelBtnBg!: Phaser.GameObjects.Rectangle;
    private startLevelBtnText!: Phaser.GameObjects.Text;
    private backBtnBg!: Phaser.GameObjects.Rectangle;
    private backBtnText!: Phaser.GameObjects.Text;

    constructor() {
        super('PrepScene');
    }

    init(data: any) {
        this.levelId = data?.levelId || 1;
        ProgressionManager.load();
        this.selectedStartValue = 5; // always default to standard 5 each time prep is opened

        // Validate that level is unlocked
        const highestUnlocked = ProgressionManager.getHighestUnlockedLevel();
        if (this.levelId > highestUnlocked) {
            // Locked level protection
            this.scene.start('MenuScene');
            return;
        }

        this.levelDef = getLevel(this.levelId);
    }

    create() {
        const cx = this.scale.width / 2;
        const h = this.scale.height;

        this.titleText = this.add.text(cx, 40, 'PRE-BATTLE', {
            fontSize: '34px',
            fontStyle: 'bold',
            color: '#00ffff'
        }).setOrigin(0.5);

        this.levelSubText = this.add.text(cx, 80, `${this.levelDef.name}`, {
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Info container: Boss Value, Max HP, Selected Skin
        this.createInfoSection(cx, 120);

        // Heading for Start Value
        this.startValueHeading = this.add.text(cx, 175, 'START VALUE', {
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#ffd700'
        }).setOrigin(0.5);

        // Three selectable cards (5, 7, 10)
        this.createStartValueCards(cx, 260);

        // Action buttons
        this.createActionButtons(cx, h - 70);

        this.scale.on('resize', this.resize, this);
        this.events.once('shutdown', () => {
            this.scale.off('resize', this.resize, this);
        });
    }

    private createInfoSection(cx: number, y: number) {
        if (this.infoContainer) this.infoContainer.destroy();
        this.infoContainer = this.add.container(cx, y);

        const skinId = CosmeticsManager.getSelectedHeadSkin();
        const skinDef = HEAD_SKINS[skinId] || HEAD_SKINS.classic;
        const maxHP = ProgressionManager.getMaxHP();

        const infoBg = this.add.rectangle(0, 0, 360, 48, 0x05152a, 0.8)
            .setStrokeStyle(1.5, 0x0088cc);

        const bossInfo = this.add.text(-120, 0, `BOSS: ${this.levelDef.bossValue}`, {
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#ff5555'
        }).setOrigin(0.5);

        const hpInfo = this.add.text(0, 0, `HP: ${maxHP}`, {
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#ff3366'
        }).setOrigin(0.5);

        const skinInfo = this.add.text(110, 0, `SKIN: ${skinDef.displayName}`, {
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#00ffcc'
        }).setOrigin(0.5);

        this.infoContainer.add([infoBg, bossInfo, hpInfo, skinInfo]);
    }

    private createStartValueCards(cx: number, centerY: number) {
        this.cardContainers.forEach(c => c.destroy());
        this.cardContainers = [];
        this.cardBgs = [];

        const options: { label: string; value: PrepStartValue; desc: string }[] = [
            { label: 'STANDARD', value: 5, desc: 'Original' },
            { label: 'BOOST', value: 7, desc: '+2 Start' },
            { label: 'POWER', value: 10, desc: '+5 Start' }
        ];

        const w = this.scale.width;
        const cardW = Math.min(105, (w - 40) / 3 - 10);
        const cardH = 130;
        const spacing = cardW + 14;
        const totalW = (options.length - 1) * spacing;
        const startX = cx - totalW / 2;

        options.forEach((opt, idx) => {
            const cardX = startX + idx * spacing;
            const container = this.add.container(cardX, centerY);

            const isSelected = this.selectedStartValue === opt.value;
            const bg = this.add.rectangle(0, 0, cardW, cardH, isSelected ? 0x004488 : 0x112233, 0.95)
                .setStrokeStyle(isSelected ? 3 : 1.5, isSelected ? 0x00ffff : 0x446688)
                .setInteractive({ useHandCursor: true });

            const labelText = this.add.text(0, -42, opt.label, {
                fontSize: cardW < 90 ? '11px' : '13px',
                fontStyle: 'bold',
                color: isSelected ? '#00ffff' : '#aaaaaa'
            }).setOrigin(0.5);

            const valueText = this.add.text(0, -4, `${opt.value}`, {
                fontSize: '38px',
                fontStyle: 'bold',
                color: isSelected ? '#ffd700' : '#ffffff'
            }).setOrigin(0.5);

            const descText = this.add.text(0, 36, opt.desc, {
                fontSize: '11px',
                color: '#88aacc'
            }).setOrigin(0.5);

            bg.on('pointerdown', () => {
                this.selectStartValue(opt.value);
            });

            container.add([bg, labelText, valueText, descText]);
            this.cardContainers.push(container);
            this.cardBgs.push(bg);
        });
    }

    public selectStartValue(val: PrepStartValue) {
        this.selectedStartValue = normalizeStartValue(val);
        const cx = this.scale.width / 2;
        const centerY = this.scale.height < 600 ? 210 : 255;
        this.createStartValueCards(cx, centerY);
    }

    public getSelectedStartValue(): number {
        return this.selectedStartValue;
    }

    private createActionButtons(cx: number, btnY: number) {
        if (this.startLevelBtnBg) this.startLevelBtnBg.destroy();
        if (this.startLevelBtnText) this.startLevelBtnText.destroy();
        if (this.backBtnBg) this.backBtnBg.destroy();
        if (this.backBtnText) this.backBtnText.destroy();

        // START LEVEL button (large green)
        this.startLevelBtnBg = this.add.rectangle(cx, btnY - 26, 220, 44, 0x00aa00, 1)
            .setStrokeStyle(2, 0x00ff88)
            .setInteractive({ useHandCursor: true });
        this.startLevelBtnText = this.add.text(cx, btnY - 26, 'START LEVEL', {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.startLevelBtnBg.on('pointerdown', () => {
            this.startLevel();
        });

        // BACK button
        this.backBtnBg = this.add.rectangle(cx, btnY + 28, 140, 34, 0x334455, 0.9)
            .setStrokeStyle(1.5, 0x6688aa)
            .setInteractive({ useHandCursor: true });
        this.backBtnText = this.add.text(cx, btnY + 28, 'BACK', {
            fontSize: '15px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.backBtnBg.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });
    }

    private startLevel() {
        if ((this.sound as any).context && (this.sound as any).context.state === 'suspended') {
            (this.sound as any).context.resume();
        }
        this.scene.start('GameScene', {
            levelId: this.levelId,
            startValueOverride: this.selectedStartValue
        });
    }

    resize(gameSize: Phaser.Structs.Size) {
        const cx = gameSize.width / 2;
        const h = gameSize.height;

        if (this.titleText) this.titleText.setPosition(cx, 38);
        if (this.levelSubText) this.levelSubText.setPosition(cx, 75);
        if (this.infoContainer) this.infoContainer.setPosition(cx, 114);
        if (this.startValueHeading) this.startValueHeading.setPosition(cx, 162);

        const cardY = h < 600 ? 215 : 255;
        this.createStartValueCards(cx, cardY);
        this.createActionButtons(cx, Math.max(370, h - 65));
    }
}
