import Phaser from 'phaser';
import { ProgressionManager } from '../models/Progression';
import { LEVELS } from '../config/levels';

export class MenuScene extends Phaser.Scene {
    private titleText!: Phaser.GameObjects.Text;
    private levelCards: Phaser.GameObjects.Container[] = [];
    private tutorialText!: Phaser.GameObjects.Text;

    constructor() {
        super('MenuScene');
    }

    create() {
        ProgressionManager.load();
        
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        this.titleText = this.add.text(cx, 60, 'NUMBER SNAKE ARENA', {
            fontSize: '42px',
            fontStyle: 'bold',
            color: '#00ffff'
        }).setOrigin(0.5);

        this.add.text(cx, 110, 'LEVEL SELECT', {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.createLevelCards(cx, cy);

        // Tutorial
        const tutorialSeen = localStorage.getItem('tutorialSeen') === 'true';
        if (!tutorialSeen) {
            this.tutorialText = this.add.text(cx, this.scale.height - 40, '吃掉比你小的數字！\n躲開比你大的數字！', {
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
        const maxHeightPerCard = (h - 220) / rows; // leave room for title and tutorial
        
        let scale = Math.min(1.0, maxWidthPerCard / 180, maxHeightPerCard / 220);
        
        const cardWidth = 180 * scale;
        const cardHeight = 220 * scale;
        const padX = 20 * scale;
        const padY = 30 * scale;
        
        const totalW = cols * cardWidth + (cols - 1) * padX;
        const totalH = rows * cardHeight + (rows - 1) * padY;
        
        const startX = cx - totalW / 2 + cardWidth / 2;
        const startY = Math.max(160, cy - totalH / 2 + cardHeight / 2 + 20); // Push down from title
        
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

        const title = this.add.text(0, -60, levelDef.name, {
            fontSize: '28px',
            fontStyle: 'bold',
            color: unlocked ? '#ffffff' : '#aaaaaa'
        }).setOrigin(0.5);

        const bossText = this.add.text(0, -10, `BOSS ${levelDef.bossValue}`, {
            fontSize: '20px',
            color: unlocked ? '#ff5555' : '#777777'
        }).setOrigin(0.5);

        container.add([bg, title, bossText]);

        if (unlocked) {
            const bestScore = ProgressionManager.getBestScore(levelId);
            const scoreText = this.add.text(0, 30, `BEST: ${bestScore}`, {
                fontSize: '16px',
                color: '#aaaaaa'
            }).setOrigin(0.5);
            
            const btnBg = this.add.rectangle(0, 80, 120, 40, 0x00aa00, 1).setInteractive({ useHandCursor: true });
            const btnText = this.add.text(0, 80, 'START', { fontSize: '20px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);
            
            btnBg.on('pointerdown', () => {
                this.startGame(levelId);
            });
            
            container.add([scoreText, btnBg, btnText]);
        } else {
            const lockText = this.add.text(0, 50, '🔒 LOCKED', {
                fontSize: '24px',
                color: '#aaaaaa'
            }).setOrigin(0.5);
            container.add(lockText);
        }

        return container;
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
        
        if (this.titleText) this.titleText.setPosition(cx, 60);
        this.createLevelCards(cx, cy);
        if (this.tutorialText) this.tutorialText.setPosition(cx, gameSize.height - 30);
    }
}
