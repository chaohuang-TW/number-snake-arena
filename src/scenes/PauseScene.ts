import Phaser from 'phaser';

export class PauseScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PauseScene' });
    }

    create() {
        const { width, height } = this.scale.gameSize;
        
        // Semi-transparent background
        const bg = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.6);
        bg.setScrollFactor(0);
        
        this.add.text(width/2, height/2 - 50, 'GAME PAUSED', {
            fontSize: '48px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        const btn = this.add.text(width/2, height/2 + 50, 'RESUME', {
            fontSize: '32px',
            backgroundColor: '#0055aa',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerdown', () => {
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
        this.children.getAll().forEach(child => {
            if (child.type === 'Rectangle') {
                (child as Phaser.GameObjects.Rectangle).setSize(gameSize.width, gameSize.height);
                (child as Phaser.GameObjects.Rectangle).setPosition(gameSize.width/2, gameSize.height/2);
            } else if (child.type === 'Text') {
                const yOffset = (child as Phaser.GameObjects.Text).text === 'RESUME' ? 50 : -50;
                (child as Phaser.GameObjects.Text).setPosition(gameSize.width/2, gameSize.height/2 + yOffset);
            }
        });
    }
}
