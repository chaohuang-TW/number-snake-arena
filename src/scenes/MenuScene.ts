import Phaser from 'phaser';
import { ProgressionManager } from '../models/Progression';
import { LEVELS } from '../config/levels';
import { t, getLanguage, setLanguage } from '../i18n';

export class MenuScene extends Phaser.Scene {
    private titleText!: Phaser.GameObjects.Text;
    private levelSelectText!: Phaser.GameObjects.Text;
    private customizeBtnBg!: Phaser.GameObjects.Rectangle;
    private customizeBtnText!: Phaser.GameObjects.Text;
    public levelCards: Phaser.GameObjects.Container[] = [];
    public tutorialText!: Phaser.GameObjects.Text;

    // Language switch
    private langBg!: Phaser.GameObjects.Rectangle;
    private langZhBtn!: Phaser.GameObjects.Text;
    private langDivider!: Phaser.GameObjects.Text;
    private langEnBtn!: Phaser.GameObjects.Text;

    constructor() {
        super('MenuScene');
    }

    create() {
        ProgressionManager.load();
        
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;
        const w = this.scale.width;

        // Language toggle top right
        this.createLanguageToggle(w - 60, 24);

        this.titleText = this.add.text(cx, 45, t('menuTitle'), {
            fontSize: '36px',
            fontStyle: 'bold',
            color: '#00ffff'
        }).setOrigin(0.5);

        this.levelSelectText = this.add.text(cx, 88, t('levelSelect'), {
            fontSize: '22px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Customize button
        this.customizeBtnBg = this.add.rectangle(cx, 126, 160, 32, 0x0055aa, 0.9)
            .setStrokeStyle(2, 0x00ffff)
            .setInteractive({ useHandCursor: true });
        this.customizeBtnText = this.add.text(cx, 126, t('customize'), {
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.customizeBtnBg.on('pointerdown', () => {
            this.scene.start('CustomizeScene');
        });

        this.createLevelCards(cx, cy);

        // Tutorial
        const tutorialSeen = localStorage.getItem('tutorialSeen') === 'true';
        if (!tutorialSeen) {
            this.tutorialText = this.add.text(cx, this.scale.height - 40, t('tutorialText'), {
                fontSize: '20px',
                align: 'center',
                color: '#ffff00'
            }).setOrigin(0.5);
            localStorage.setItem('tutorialSeen', 'true');
        }

        this.scale.on('resize', this.resize, this);
        this.events.once('shutdown', () => {
            this.scale.off('resize', this.resize, this);
        });
    }

    private createLanguageToggle(x: number, y: number) {
        if (this.langBg) this.langBg.destroy();
        if (this.langZhBtn) this.langZhBtn.destroy();
        if (this.langDivider) this.langDivider.destroy();
        if (this.langEnBtn) this.langEnBtn.destroy();

        const currentLang = getLanguage();
        this.langBg = this.add.rectangle(x, y, 96, 26, 0x001122, 0.8)
            .setStrokeStyle(1, 0x0088cc)
            .setDepth(300);

        this.langZhBtn = this.add.text(x - 22, y, '繁中', {
            fontSize: '13px',
            fontStyle: currentLang === 'zh-TW' ? 'bold' : 'normal',
            color: currentLang === 'zh-TW' ? '#ffd700' : '#888888'
        }).setOrigin(0.5).setDepth(301).setName('langBtn_zh').setInteractive({ useHandCursor: true });

        this.langDivider = this.add.text(x, y, '|', {
            fontSize: '12px',
            color: '#446688'
        }).setOrigin(0.5).setDepth(301);

        this.langEnBtn = this.add.text(x + 22, y, 'EN', {
            fontSize: '13px',
            fontStyle: currentLang === 'en' ? 'bold' : 'normal',
            color: currentLang === 'en' ? '#ffd700' : '#888888'
        }).setOrigin(0.5).setDepth(301).setName('langBtn_en').setInteractive({ useHandCursor: true });

        this.langZhBtn.on('pointerdown', () => {
            if (getLanguage() !== 'zh-TW') {
                setLanguage('zh-TW');
                this.scene.restart();
            }
        });

        this.langEnBtn.on('pointerdown', () => {
            if (getLanguage() !== 'en') {
                setLanguage('en');
                this.scene.restart();
            }
        });
    }

    createLevelCards(cx: number, cy: number) {
        this.levelCards.forEach(c => c.destroy());
        this.levelCards = [];

        const highestUnlocked = ProgressionManager.getHighestUnlockedLevel();
        const w = this.scale.width;
        const h = this.scale.height;
        
        const isPortrait = h > w;
        
        let cols = isPortrait ? 2 : 4;
        if (w < 400 && isPortrait) cols = 1; // Super narrow like iphone SE portrait
        
        const levelList = Object.values(LEVELS).sort((a, b) => a.id - b.id);
        const rows = Math.ceil(levelList.length / cols);
        
        // Calculate max allowed sizes
        const maxWidthPerCard = (w - (cols + 1) * 20) / cols;
        const maxHeightPerCard = (h - 220) / rows; // leave room for title, customize, and tutorial
        
        let scale = Math.min(1.0, maxWidthPerCard / 180, maxHeightPerCard / 220);
        
        const cardWidth = 180 * scale;
        const cardHeight = 220 * scale;
        const padX = 20 * scale;
        const padY = 30 * scale;
        
        const totalW = cols * cardWidth + (cols - 1) * padX;
        const totalH = rows * cardHeight + (rows - 1) * padY;
        
        const startX = cx - totalW / 2 + cardWidth / 2;
        const startY = Math.max(160, cy - totalH / 2 + cardHeight / 2 + 20); // Push down from header
        
        if (this.tutorialText) {
            this.tutorialText.setPosition(cx, h - 30);
        }

        levelList.forEach((levelDef, idx) => {
            const levelId = levelDef.id;
            const c = idx % cols;
            const r = Math.floor(idx / cols);
            
            const xPos = startX + c * (cardWidth + padX);
            const yPos = startY + r * (cardHeight + padY);
            
            const card = this.createCard(xPos, yPos, levelId, highestUnlocked >= levelId, scale);
            this.levelCards.push(card);
        });
    }

    createCard(x: number, y: number, levelId: number, unlocked: boolean, scale: number = 1.0) {
        const container = this.add.container(x, y);
        container.setScale(scale);
        const levelDef = LEVELS[levelId];
        
        const bg = this.add.rectangle(0, 0, 180, 220, unlocked ? 0x0055aa : 0x333333, 1)
            .setStrokeStyle(4, unlocked ? 0x00ffff : 0x555555);

        // Translated level title
        const levelTitleStr = t(`level_${levelId}`);
        const title = this.add.text(0, -60, levelTitleStr, {
            fontSize: '28px',
            fontStyle: 'bold',
            color: unlocked ? '#ffffff' : '#aaaaaa'
        }).setOrigin(0.5);

        const bossTextStr = t('bossLabel', { value: levelDef.bossValue });
        const bossText = this.add.text(0, -10, bossTextStr, {
            fontSize: '20px',
            color: unlocked ? '#ff5555' : '#777777'
        }).setOrigin(0.5);

        container.add([bg, title, bossText]);

        if (unlocked) {
            const bestScore = ProgressionManager.getBestScore(levelId);
            const scoreText = this.add.text(0, 30, `${t('bestLabel')}${bestScore}`, {
                fontSize: '16px',
                color: '#aaaaaa'
            }).setOrigin(0.5);
            
            const btnBg = this.add.rectangle(0, 80, 120, 40, 0x00aa00, 1).setInteractive({ useHandCursor: true });
            btnBg.setName(`startBtn_${levelId}`);
            const btnText = this.add.text(0, 80, t('start'), { fontSize: '20px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);
            
            btnBg.on('pointerdown', () => {
                this.openPrep(levelId);
            });
            
            container.add([scoreText, btnBg, btnText]);
        } else {
            const lockText = this.add.text(0, 50, t('locked'), {
                fontSize: '24px',
                color: '#aaaaaa'
            }).setOrigin(0.5);
            container.add(lockText);
        }

        return container;
    }

    openPrep(levelId: number) {
        if ((this.sound as any).context && (this.sound as any).context.state === 'suspended') {
            (this.sound as any).context.resume();
        }
        this.scene.start('PrepScene', { levelId });
    }

    startGame(levelId: number) {
        if ((this.sound as any).context && (this.sound as any).context.state === 'suspended') {
            (this.sound as any).context.resume();
        }
        this.scene.start('GameScene', { levelId });
    }

    resize(gameSize: Phaser.Structs.Size) {
        const cx = gameSize.width / 2;
        const cy = gameSize.height / 2;
        const w = gameSize.width;
        
        const toggleX = w - 60;
        const toggleY = 24;
        if (this.langBg) this.langBg.setPosition(toggleX, toggleY);
        if (this.langZhBtn) this.langZhBtn.setPosition(toggleX - 22, toggleY);
        if (this.langDivider) this.langDivider.setPosition(toggleX, toggleY);
        if (this.langEnBtn) this.langEnBtn.setPosition(toggleX + 22, toggleY);
        if (this.titleText) this.titleText.setPosition(cx, 45);
        if (this.levelSelectText) this.levelSelectText.setPosition(cx, 88);
        if (this.customizeBtnBg) {
            this.customizeBtnBg.setPosition(cx, 126);
            this.customizeBtnText.setPosition(cx, 126);
        }
        this.createLevelCards(cx, cy);
        if (this.tutorialText) this.tutorialText.setPosition(cx, gameSize.height - 30);
    }
}
