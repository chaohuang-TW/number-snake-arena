import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
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
        
        // Base Player Head (for backward compatibility)
        graphics.clear();
        graphics.fillStyle(0x00ffff, 1);
        graphics.fillCircle(20, 20, 20);
        graphics.lineStyle(2, 0xffffff, 0.8);
        graphics.strokeCircle(20, 20, 19);
        graphics.generateTexture('player_head', 40, 40);

        // Player Body Segment
        graphics.clear();
        graphics.fillStyle(0x0088ff, 0.85);
        graphics.fillCircle(15, 15, 15);
        graphics.lineStyle(2, 0x00ffff, 0.6);
        graphics.strokeCircle(15, 15, 14);
        graphics.generateTexture('player_body', 30, 30);

        // Player Tail Tip (tapered teardrop)
        graphics.clear();
        graphics.fillStyle(0x0066cc, 0.9);
        graphics.fillTriangle(0, 15, 30, 5, 30, 25);
        graphics.fillCircle(20, 15, 8);
        graphics.lineStyle(2, 0x00ffff, 0.7);
        graphics.strokeTriangle(0, 15, 30, 5, 30, 25);
        graphics.generateTexture('player_tail', 30, 30);

        // AI Body Segment
        graphics.clear();
        graphics.fillStyle(0x334455, 0.8);
        graphics.fillCircle(12, 12, 12);
        graphics.lineStyle(1.5, 0x667788, 0.6);
        graphics.strokeCircle(12, 12, 11);
        graphics.generateTexture('enemy_body', 24, 24);

        // AI Tail Tip
        graphics.clear();
        graphics.fillStyle(0x223344, 0.85);
        graphics.fillTriangle(0, 12, 24, 4, 24, 20);
        graphics.fillCircle(16, 12, 6);
        graphics.generateTexture('enemy_tail', 24, 24);

        // Collectible Body Orb
        graphics.clear();
        graphics.fillStyle(0xffff00, 0.3);
        graphics.fillCircle(12, 12, 12);
        graphics.fillStyle(0xffffff, 0.9);
        graphics.fillCircle(12, 12, 6);
        graphics.lineStyle(2, 0xffd700, 1);
        graphics.strokeCircle(12, 12, 10);
        graphics.generateTexture('collectible_orb', 24, 24);

        // Magnet Particle
        graphics.clear();
        graphics.fillStyle(0x00ffff, 0.9);
        graphics.fillCircle(4, 4, 4);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(4, 4, 2);
        graphics.generateTexture('magnet_particle', 8, 8);

        // Generate 6 Head Skins for Player (40x40) and Enemy (36x36)
        this.generateSkinTextures(graphics);

        // Edible Enemy (legacy / fallback)
        graphics.clear();
        graphics.fillStyle(0x00ff00, 1);
        graphics.fillCircle(18, 18, 18);
        graphics.generateTexture('enemy_edible', 36, 36);

        // Mild Threat (legacy / fallback)
        graphics.clear();
        graphics.fillStyle(0xffaa00, 1);
        graphics.fillCircle(22, 22, 22);
        graphics.generateTexture('enemy_mild', 44, 44);

        // High Threat (legacy / fallback)
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

        graphics.destroy();
    }

    private generateSkinTextures(g: Phaser.GameObjects.Graphics) {
        // 1. CLASSIC
        // Player (40x40)
        g.clear();
        g.fillStyle(0x00c8ff, 1);
        g.fillCircle(20, 20, 20);
        g.lineStyle(2, 0xffffff, 0.9);
        g.strokeCircle(20, 20, 19);
        g.fillStyle(0xffffff, 0.4);
        g.fillCircle(20, 12, 5);
        g.generateTexture('skin_head_classic_p', 40, 40);

        // Enemy (36x36)
        g.clear();
        g.fillStyle(0x2288bb, 1);
        g.fillCircle(18, 18, 18);
        g.lineStyle(2, 0xffffff, 0.7);
        g.strokeCircle(18, 18, 17);
        g.generateTexture('skin_head_classic_e', 36, 36);

        // 2. BOLT
        // Player (40x40) - Gold/Yellow with Lightning Fins
        g.clear();
        g.fillStyle(0xffcc00, 1);
        g.fillCircle(20, 20, 20);
        // Lightning bolt crest on side/top
        g.fillStyle(0xff9900, 1);
        g.fillTriangle(10, 4, 20, 0, 16, 12);
        g.fillTriangle(30, 4, 20, 0, 24, 12);
        g.lineStyle(2, 0xffffff, 0.9);
        g.strokeCircle(20, 20, 19);
        g.generateTexture('skin_head_bolt_p', 40, 40);

        // Enemy (36x36)
        g.clear();
        g.fillStyle(0xcc9900, 1);
        g.fillCircle(18, 18, 18);
        g.fillStyle(0xff6600, 1);
        g.fillTriangle(9, 3, 18, 0, 14, 10);
        g.fillTriangle(27, 3, 18, 0, 22, 10);
        g.lineStyle(2, 0xffe600, 0.8);
        g.strokeCircle(18, 18, 17);
        g.generateTexture('skin_head_bolt_e', 36, 36);

        // 3. MECHA
        // Player (40x40) - Cybernetic Steel & Cyan Visor
        g.clear();
        g.fillStyle(0x334466, 1);
        g.fillCircle(20, 20, 20);
        g.lineStyle(3, 0x00ffcc, 1);
        g.strokeCircle(20, 20, 19);
        // Visor slit
        g.fillStyle(0x00ffff, 1);
        g.fillRect(8, 16, 24, 8);
        g.fillStyle(0xffffff, 0.9);
        g.fillRect(14, 18, 12, 4);
        g.generateTexture('skin_head_mecha_p', 40, 40);

        // Enemy (36x36)
        g.clear();
        g.fillStyle(0x2a3344, 1);
        g.fillCircle(18, 18, 18);
        g.lineStyle(2, 0x00ccaa, 0.9);
        g.strokeCircle(18, 18, 17);
        g.fillStyle(0x00ddff, 1);
        g.fillRect(7, 14, 22, 7);
        g.generateTexture('skin_head_mecha_e', 36, 36);

        // 4. DRAGON
        // Player (40x40) - Purple with Horns
        g.clear();
        // Horns
        g.fillStyle(0xcc00ff, 1);
        g.fillTriangle(6, 12, 12, 2, 16, 14);
        g.fillTriangle(34, 12, 28, 2, 24, 14);
        // Head
        g.fillStyle(0x6611aa, 1);
        g.fillCircle(20, 20, 19);
        g.lineStyle(2, 0xff33cc, 0.9);
        g.strokeCircle(20, 20, 19);
        // Reptilian slit eyes
        g.fillStyle(0xffff00, 1);
        g.fillRect(12, 16, 3, 7);
        g.fillRect(25, 16, 3, 7);
        g.generateTexture('skin_head_dragon_p', 40, 40);

        // Enemy (36x36)
        g.clear();
        g.fillStyle(0xaa00cc, 1);
        g.fillTriangle(5, 10, 11, 2, 14, 12);
        g.fillTriangle(31, 10, 25, 2, 22, 12);
        g.fillStyle(0x550088, 1);
        g.fillCircle(18, 18, 17);
        g.lineStyle(2, 0xdd22aa, 0.8);
        g.strokeCircle(18, 18, 17);
        g.generateTexture('skin_head_dragon_e', 36, 36);

        // 5. FLAME
        // Player (40x40) - Fire Orange/Red with Flame Spikes
        g.clear();
        g.fillStyle(0xff3300, 1);
        // Flames on top
        g.fillTriangle(10, 10, 15, 0, 20, 12);
        g.fillTriangle(20, 12, 25, 0, 30, 10);
        g.fillCircle(20, 20, 19);
        g.fillStyle(0xffaa00, 1);
        g.fillCircle(20, 20, 14);
        g.lineStyle(2, 0xffff66, 0.9);
        g.strokeCircle(20, 20, 19);
        g.generateTexture('skin_head_flame_p', 40, 40);

        // Enemy (36x36)
        g.clear();
        g.fillStyle(0xdd2200, 1);
        g.fillTriangle(9, 9, 14, 0, 18, 11);
        g.fillTriangle(18, 11, 22, 0, 27, 9);
        g.fillCircle(18, 18, 17);
        g.fillStyle(0xee8800, 1);
        g.fillCircle(18, 18, 12);
        g.generateTexture('skin_head_flame_e', 36, 36);

        // 6. ALIEN
        // Player (40x40) - Lime Green with Large Dark Alien Eyes
        g.clear();
        g.fillStyle(0x33ee33, 1);
        g.fillCircle(20, 20, 20);
        // Antennae
        g.lineStyle(2, 0x22aa22, 1);
        g.lineBetween(14, 6, 8, 1);
        g.lineBetween(26, 6, 32, 1);
        g.fillStyle(0x00ff88, 1);
        g.fillCircle(8, 1, 3);
        g.fillCircle(32, 1, 3);
        // Alien large dark eyes
        g.fillStyle(0x002200, 1);
        g.fillCircle(13, 18, 5);
        g.fillCircle(27, 18, 5);
        g.lineStyle(2, 0x88ff88, 0.8);
        g.strokeCircle(20, 20, 19);
        g.generateTexture('skin_head_alien_p', 40, 40);

        // Enemy (36x36)
        g.clear();
        g.fillStyle(0x22bb22, 1);
        g.fillCircle(18, 18, 18);
        g.fillStyle(0x002200, 1);
        g.fillCircle(12, 16, 4);
        g.fillCircle(24, 16, 4);
        g.lineStyle(2, 0x66dd66, 0.8);
        g.strokeCircle(18, 18, 17);
        g.generateTexture('skin_head_alien_e', 36, 36);
    }
}
