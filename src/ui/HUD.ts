import Phaser from 'phaser';
import { isTouchCapableDevice } from '../utils/device';

export class HUD {
    scene: Phaser.Scene;
    hpText: Phaser.GameObjects.Text;
    scoreText: Phaser.GameObjects.Text;
    boostBarBg: Phaser.GameObjects.Graphics;
    boostBarFill: Phaser.GameObjects.Graphics;
    boostButton!: Phaser.GameObjects.Arc;
    boostButtonText!: Phaser.GameObjects.Text;
    
    isBoostPressed: boolean = false;
    private score: number = 0;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        
        this.hpText = scene.add.text(20, 20, '❤️❤️❤️', { fontSize: '24px' })
            .setScrollFactor(0).setDepth(200);
            
        this.scoreText = scene.add.text(20, 50, 'SCORE: 0', { 
            fontSize: '24px', 
            fontStyle: 'bold',
            color: '#ffffff'
        }).setScrollFactor(0).setDepth(200);

        this.boostBarBg = scene.add.graphics().setScrollFactor(0).setDepth(200);
        this.boostBarFill = scene.add.graphics().setScrollFactor(0).setDepth(201);
        
        this.createBoostButton();
        this.resize(scene.scale.gameSize);
    }

    createBoostButton() {
        this.boostButton = this.scene.add.circle(0, 0, 50, 0xff8800, 0.5)
            .setScrollFactor(0).setDepth(200).setInteractive();
            
        this.boostButtonText = this.scene.add.text(0, 0, 'BOOST', {
            fontSize: '16px', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        this.boostButton.on('pointerdown', () => this.isBoostPressed = true);
        this.boostButton.on('pointerup', () => this.isBoostPressed = false);
        this.boostButton.on('pointerupoutside', () => this.isBoostPressed = false);
    }

    update(hp: number, maxHP: number, boostEnergy: number, maxBoostEnergy: number) {
        // HP
        let hearts = '';
        for (let i = 0; i < hp; i++) hearts += '❤️';
        for (let i = hp; i < maxHP; i++) hearts += '🖤';
        this.hpText.setText(hearts);

        // Boost Bar
        const barWidth = 200;
        const barHeight = 20;
        const cx = this.scene.scale.width / 2;
        const bx = cx - barWidth / 2;
        const by = 20;

        this.boostBarBg.clear();
        this.boostBarBg.fillStyle(0x333333, 0.8);
        this.boostBarBg.fillRect(bx, by, barWidth, barHeight);

        this.boostBarFill.clear();
        this.boostBarFill.fillStyle(0x00aaff, 1);
        const fillW = (boostEnergy / maxBoostEnergy) * barWidth;
        this.boostBarFill.fillRect(bx, by, fillW, barHeight);
    }

    addScore(points: number) {
        this.score += points;
        this.scoreText.setText(`SCORE: ${this.score}`);
    }

    getScore(): number {
        return this.score;
    }

    resize(gameSize: Phaser.Structs.Size) {
        if (this.boostButton) {
            const bx = gameSize.width - 90;
            const by = gameSize.height - 90;
            this.boostButton.setPosition(bx, by);
            this.boostButtonText.setPosition(bx, by);
            // Show on touch-capable devices, hide on desktop
            const isTouch = isTouchCapableDevice();
            this.boostButton.setVisible(isTouch);
            this.boostButtonText.setVisible(isTouch);
        }
    }
}
