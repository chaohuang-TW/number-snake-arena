import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Here we can generate some procedural textures if needed
        this.generateTextures();
    }

    create() {
        // Initialize localStorage defaults
        if (localStorage.getItem('tutorialSeen') === null) {
            localStorage.setItem('tutorialSeen', 'false');
        }
        if (localStorage.getItem('audioEnabled') === null) {
            localStorage.setItem('audioEnabled', 'true');
        }
        
        this.scene.start('MenuScene');
    }

    private generateTextures() {
        const graphics = this.make.graphics({ x: 0, y: 0 }, false);
        
        // Player Head
        graphics.clear();
        graphics.fillStyle(0x00ffff, 1);
        graphics.fillCircle(20, 20, 20);
        graphics.generateTexture('player_head', 40, 40);

        // Player Body Segment
        graphics.clear();
        graphics.fillStyle(0x0088ff, 0.8);
        graphics.fillCircle(15, 15, 15);
        graphics.generateTexture('player_body', 30, 30);

        // Edible Enemy
        graphics.clear();
        graphics.fillStyle(0x00ff00, 1);
        graphics.fillCircle(18, 18, 18);
        graphics.generateTexture('enemy_edible', 36, 36);

        // Mild Threat
        graphics.clear();
        graphics.fillStyle(0xffaa00, 1);
        graphics.fillCircle(22, 22, 22);
        graphics.generateTexture('enemy_mild', 44, 44);

        // High Threat
        graphics.clear();
        graphics.fillStyle(0xff0000, 1);
        graphics.fillCircle(25, 25, 25);
        graphics.generateTexture('enemy_high', 50, 50);

        // Boss
        graphics.clear();
        graphics.fillStyle(0xff0055, 1);
        graphics.fillCircle(40, 40, 40);
        graphics.lineStyle(4, 0xffffff);
        graphics.strokeCircle(40, 40, 40);
        graphics.generateTexture('boss', 80, 80);
        
        // Particle
        graphics.clear();
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('particle', 8, 8);
    }
}
