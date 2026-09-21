import Phaser from 'phaser';
import { isTouchCapableDevice } from '../utils/device';
import type { MagnetState } from '../systems/MagnetAbility';

export class HUD {
    scene: Phaser.Scene;
    hpText: Phaser.GameObjects.Text;
    scoreText: Phaser.GameObjects.Text;
    magnetText: Phaser.GameObjects.Text;
    boostBarBg: Phaser.GameObjects.Graphics;
    boostBarFill: Phaser.GameObjects.Graphics;
    
    boostButton!: Phaser.GameObjects.Arc;
    boostButtonText!: Phaser.GameObjects.Text;
    
    magnetButton!: Phaser.GameObjects.Arc;
    magnetButtonText!: Phaser.GameObjects.Text;
    
    isBoostPressed: boolean = false;
    isMagnetPressed: boolean = false;
    onMagnetTrigger?: () => void;
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

        this.magnetText = scene.add.text(20, 80, '🧲 MAGNET READY', {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#00ffff'
        }).setScrollFactor(0).setDepth(200);

        this.boostBarBg = scene.add.graphics().setScrollFactor(0).setDepth(200);
        this.boostBarFill = scene.add.graphics().setScrollFactor(0).setDepth(201);
        
        this.createTouchButtons();
        this.resize(scene.scale.gameSize);
    }

    createTouchButtons() {
        // Boost Button
        this.boostButton = this.scene.add.circle(0, 0, 50, 0xff8800, 0.5)
            .setScrollFactor(0).setDepth(200).setInteractive();
            
        this.boostButtonText = this.scene.add.text(0, 0, 'BOOST', {
            fontSize: '16px', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        this.boostButton.on('pointerdown', () => this.isBoostPressed = true);
        this.boostButton.on('pointerup', () => this.isBoostPressed = false);
        this.boostButton.on('pointerupoutside', () => this.isBoostPressed = false);

        // Magnet Button (placed above Boost)
        this.magnetButton = this.scene.add.circle(0, 0, 42, 0x00aaff, 0.6)
            .setScrollFactor(0).setDepth(200).setInteractive();
            
        this.magnetButtonText = this.scene.add.text(0, 0, 'MAGNET', {
            fontSize: '13px', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

        this.magnetButton.on('pointerdown', () => {
            this.isMagnetPressed = true;
            if (this.onMagnetTrigger) this.onMagnetTrigger();
        });
        this.magnetButton.on('pointerup', () => this.isMagnetPressed = false);
        this.magnetButton.on('pointerupoutside', () => this.isMagnetPressed = false);
    }

    updateValues(
        hp: number,
        maxHP: number,
        boostEnergy: number,
        maxBoostEnergy: number,
        magnetHUDText: string = '🧲 MAGNET READY',
        magnetState: MagnetState = 'READY'
    ) {
        this.update(hp, maxHP, boostEnergy, maxBoostEnergy, magnetHUDText, magnetState);
    }

    update(
        hp: number,
        maxHP: number,
        boostEnergy: number,
        maxBoostEnergy: number,
        magnetHUDText: string = '🧲 MAGNET READY',
        magnetState: MagnetState = 'READY'
    ) {
        // HP
        let hearts = '';
        for (let i = 0; i < hp; i++) hearts += '❤️';
        for (let i = hp; i < maxHP; i++) hearts += '🖤';
        this.hpText.setText(hearts);

        // Score
        this.scoreText.setText(`SCORE: ${this.score}`);

        // Magnet Text
        this.magnetText.setText(magnetHUDText);
        if (magnetState === 'READY') {
            this.magnetText.setColor('#00ffff');
        } else if (magnetState === 'ACTIVE') {
            this.magnetText.setColor('#ffff00');
        } else {
            this.magnetText.setColor('#888888');
        }

        // Magnet Button Visual State
        if (this.magnetButton) {
            if (magnetState === 'READY') {
                this.magnetButton.setFillStyle(0x00ccff, 0.7);
            } else if (magnetState === 'ACTIVE') {
                this.magnetButton.setFillStyle(0x00ffff, 0.95);
            } else {
                this.magnetButton.setFillStyle(0x444444, 0.4);
            }
        }

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
        const isTouch = isTouchCapableDevice();

        if (this.boostButton) {
            const bx = gameSize.width - 80;
            const by = gameSize.height - 80;
            this.boostButton.setPosition(bx, by);
            this.boostButtonText.setPosition(bx, by);
            this.boostButton.setVisible(isTouch);
            this.boostButtonText.setVisible(isTouch);
        }

        if (this.magnetButton) {
            // Position above the BOOST button
            const mx = gameSize.width - 80;
            const my = gameSize.height - 180;
            this.magnetButton.setPosition(mx, my);
            this.magnetButtonText.setPosition(mx, my);
            this.magnetButton.setVisible(isTouch);
            this.magnetButtonText.setVisible(isTouch);
        }
    }
}
