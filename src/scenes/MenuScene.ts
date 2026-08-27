import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
    private titleText!: Phaser.GameObjects.Text;
    private startButton!: Phaser.GameObjects.Text;
    private bestScoreText!: Phaser.GameObjects.Text;
    private tutorialText!: Phaser.GameObjects.Text;

    constructor() {
        super('MenuScene');
    }

    create() {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        this.titleText = this.add.text(cx, cy - 100, 'NUMBER SNAKE ARENA', {
            fontSize: '48px',
            fontStyle: 'bold',
            color: '#00ffff'
        }).setOrigin(0.5);

        const bestScore = localStorage.getItem('bestScore') || '0';
        this.bestScoreText = this.add.text(cx, cy - 20, `BEST SCORE: ${bestScore}`, {
            fontSize: '24px',
            color: '#aaaaaa'
        }).setOrigin(0.5);

        this.startButton = this.add.text(cx, cy + 60, 'START', {
            fontSize: '36px',
            fontStyle: 'bold',
            color: '#ffffff',
            backgroundColor: '#0055aa',
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.startButton.on('pointerdown', () => {
            // init audio context on user gesture
            if ((this.sound as any).context && (this.sound as any).context.state === 'suspended') {
                (this.sound as any).context.resume();
            }
            this.scene.start('GameScene');
        });

        // Tutorial
        const tutorialSeen = localStorage.getItem('tutorialSeen') === 'true';
        if (!tutorialSeen) {
            this.tutorialText = this.add.text(cx, cy + 180, '吃掉比你小的數字！\n躲開比你大的數字！', {
                fontSize: '20px',
                align: 'center',
                color: '#ffff00'
            }).setOrigin(0.5);
            localStorage.setItem('tutorialSeen', 'true');
        }

        this.scale.on('resize', this.resize, this);
    }

    resize(gameSize: Phaser.Structs.Size) {
        const cx = gameSize.width / 2;
        const cy = gameSize.height / 2;
        
        if (this.titleText) this.titleText.setPosition(cx, cy - 100);
        if (this.bestScoreText) this.bestScoreText.setPosition(cx, cy - 20);
        if (this.startButton) this.startButton.setPosition(cx, cy + 60);
        if (this.tutorialText) this.tutorialText.setPosition(cx, cy + 180);
    }
}
