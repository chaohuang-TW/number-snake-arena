import Phaser from 'phaser';
import { t } from '../i18n';

export class PauseScene extends Phaser.Scene {
    private resumeBtn!: Phaser.GameObjects.Text;
    private titleText!: Phaser.GameObjects.Text;
    private bg!: Phaser.GameObjects.Rectangle;

    constructor() {
        super({ key: 'PauseScene' });
    }

    create() {
        const { width, height } = this.scale.gameSize;
        
        // Semi-transparent background
        this.bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
        this.bg.setScrollFactor(0);
        
        this.titleText = this.add.text(width / 2, height / 2 - 50, t('paused'), {
            fontSize: '48px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.resumeBtn = this.add.text(width / 2, height / 2 + 50, t('resume'), {
            fontSize: '32px',
            backgroundColor: '#0055aa',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.resumeBtn.setName('resumeBtn');

        this.resumeBtn.on('pointerdown', () => {
            this.scene.resume('GameScene');
            this.scene.stop();
        });
        
        this.scale.on('resize', this.resize, this);
        this.events.on('shutdown', () => {
            this.scale.off('resize', this.resize, this);
        });
    }

    resize(gameSize: Phaser.Structs.Size) {
        if (!this.scene.isActive()) return;
        this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
        if (this.bg) {
            this.bg.setSize(gameSize.width, gameSize.height);
            this.bg.setPosition(gameSize.width / 2, gameSize.height / 2);
        }
        if (this.titleText) {
            this.titleText.setPosition(gameSize.width / 2, gameSize.height / 2 - 50);
        }
        if (this.resumeBtn) {
            this.resumeBtn.setPosition(gameSize.width / 2, gameSize.height / 2 + 50);
        }
    }
}
