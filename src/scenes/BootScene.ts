import Phaser from 'phaser';
import { HEAD_SKIN_LIST, HEAD_TEXTURE_SIZE } from '../config/headSkins';
import { VisualPreferencesManager } from '../models/VisualPreferences';
import { TAIL_RENDER_DIRECTIONS, getTailTextureKey } from '../utils/snakeAppearance';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        this.generateTextures();
    }

    create() {
        try {
            if (localStorage.getItem('tutorialSeen') === null) localStorage.setItem('tutorialSeen', 'false');
            if (localStorage.getItem('audioEnabled') === null) localStorage.setItem('audioEnabled', 'true');
        } catch { /* Private browsing must not stop boot. */ }
        VisualPreferencesManager.load();
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

        // Overlapping glossy sections make a continuous ribbon, without bloom emitters.
        for (const [key, size, color, edge] of [
            ['player_body', 30, 0x148fac, 0x88f4ed],
            ['enemy_body', 30, 0x4d647b, 0xa7c3d1]
        ] as const) {
            graphics.clear();
            const r = size / 2;
            graphics.fillStyle(0x071321, 0.7);
            graphics.fillCircle(r, r + 1, r - 1);
            graphics.fillStyle(color, 1);
            graphics.fillCircle(r, r, r - 1);
            graphics.lineStyle(1, edge, 0.45);
            graphics.strokeCircle(r, r, r - 2);
            graphics.fillStyle(0xffffff, 0.18);
            graphics.fillEllipse(r, r - size * 0.2, size * 0.62, size * 0.3);
            graphics.generateTexture(key, size, size);
        }
        for (const [key, size, color] of [['player_tail', 30, 0x148fac], ['enemy_tail', 24, 0x4d647b]] as const) {
            graphics.clear();
            graphics.fillStyle(color, 1);
            graphics.fillTriangle(1, size / 2, size - 4, 3, size - 4, size - 3);
            graphics.fillCircle(size - 8, size / 2, size / 3);
            graphics.generateTexture(key, size, size);
        }
        this.generateDirectionalTailTextures(graphics);

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

        // Gold Crown (32x24)
        graphics.clear();
        // Subtle glow
        graphics.fillStyle(0xffd700, 0.35);
        graphics.fillCircle(16, 12, 12);
        // Crown path
        graphics.fillStyle(0xffd700, 1);
        graphics.beginPath();
        graphics.moveTo(4, 20);
        graphics.lineTo(4, 8);
        graphics.lineTo(10, 14);
        graphics.lineTo(16, 4);
        graphics.lineTo(22, 14);
        graphics.lineTo(28, 8);
        graphics.lineTo(28, 20);
        graphics.closePath();
        graphics.fillPath();
        // Dark outline
        graphics.lineStyle(1.5, 0x3a2000, 1);
        graphics.strokePath();
        // Jewels / Highlights on tips
        graphics.fillStyle(0xffff77, 1);
        graphics.fillCircle(4, 8, 2);
        graphics.fillCircle(16, 4, 2.5);
        graphics.fillCircle(28, 8, 2);
        // Base rim highlight
        graphics.fillStyle(0xffffff, 0.7);
        graphics.fillRect(8, 17, 16, 2);
        graphics.generateTexture('crown_gold', 32, 24);

        graphics.destroy();
    }

    private generateDirectionalTailTextures(graphics: Phaser.GameObjects.Graphics) {
        // Bake orientation into padded textures: runtime rotation clips mixed-texture
        // quads in the current WebGL renderer. Legacy tails remain for menu previews.
        for (const [kind, size, color] of [['player', 30, 0x148fac], ['enemy', 24, 0x4d647b]] as const) {
            const halfWidth = (size / 2 - 3) * 0.5;
            const triangle = [
                { x: -size / 2 + 1, y: 0 },
                { x: size / 2 - 4, y: -halfWidth },
                { x: size / 2 - 4, y: halfWidth }
            ];
            const ellipse = Array.from({ length: 20 }, (_, i) => {
                const angle = i * Math.PI * 2 / 20;
                return {
                    x: size / 2 - 8 + Math.cos(angle) * size / 3,
                    y: Math.sin(angle) * size / 6
                };
            });
            for (let i = 0; i < TAIL_RENDER_DIRECTIONS; i++) {
                const angle = i * Math.PI * 2 / TAIL_RENDER_DIRECTIONS;
                const cos = Math.cos(angle), sin = Math.sin(angle);
                const rotate = (point: { x: number; y: number }) => new Phaser.Math.Vector2(
                    32 + point.x * cos - point.y * sin,
                    32 + point.x * sin + point.y * cos
                );
                graphics.clear();
                graphics.fillStyle(color, 1);
                graphics.fillPoints(triangle.map(rotate), true);
                graphics.fillPoints(ellipse.map(rotate), true);
                graphics.generateTexture(getTailTextureKey(kind, angle), 64, 64);
            }
        }
    }

    private generateSkinTextures(g: Phaser.GameObjects.Graphics) {
        // A 64px canvas leaves real silhouette space outside the unchanged central collider.
        for (const skin of HEAD_SKIN_LIST) {
            for (const isPlayer of [true, false]) {
                g.clear();
                const x = 32, y = 32, r = isPlayer ? 20 : 18;
                const color = skin.accentColor;
                const outline = isPlayer ? 0xb8ffff : 0xe5edf6;
                g.lineStyle(2, outline, 0.85);
                g.fillStyle(skin.detailColor, 1);
                // Every accessory changes the outer shape rather than repainting a disk.
                if (skin.silhouette === 'lightning') {
                    g.fillTriangle(14, 25, 3, 11, 22, 15);
                    g.fillTriangle(15, 22, 5, 31, 21, 30);
                    g.fillTriangle(49, 25, 61, 11, 41, 15);
                    g.fillTriangle(48, 22, 59, 31, 43, 30);
                } else if (skin.silhouette === 'horns') {
                    g.fillStyle(0xffe0a3, 1);
                    g.fillTriangle(16, 25, 10, 6, 26, 17);
                    g.fillTriangle(48, 25, 54, 6, 38, 17);
                    g.fillStyle(skin.detailColor, 1);
                    g.fillTriangle(13, 37, 4, 29, 15, 25);
                    g.fillTriangle(51, 37, 60, 29, 49, 25);
                } else if (skin.silhouette === 'flames') {
                    g.fillStyle(0xffbd6b, 1);
                    g.fillTriangle(13, 23, 15, 6, 27, 24);
                    g.fillTriangle(22, 21, 33, 1, 42, 23);
                    g.fillTriangle(37, 23, 50, 5, 52, 27);
                    g.fillStyle(0xff713f, 1);
                    g.fillTriangle(22, 22, 33, 8, 43, 25);
                } else if (skin.silhouette === 'antennae') {
                    g.lineStyle(3, color, 1);
                    g.lineBetween(22, 20, 14, 7);
                    g.lineBetween(42, 20, 50, 7);
                    g.fillStyle(0xc6ffc2, 1);
                    g.fillCircle(13, 6, 5);
                    g.fillCircle(51, 6, 5);
                }
                g.fillStyle(0x031a29, 0.85);
                if (skin.silhouette === 'mask') {
                    g.fillRoundedRect(9, 15, 46, 38, 9);
                    g.fillStyle(0x536784, 1);
                    g.fillRoundedRect(10, 13, 44, 37, 9);
                    g.fillStyle(0x90eeea, 1);
                    g.fillRoundedRect(15, 22, 34, 16, 5);
                    g.fillStyle(0x173046, 1);
                    g.fillRoundedRect(18, 26, 28, 9, 4);
                    g.fillStyle(0xf3ffff, 1);
                    g.fillRect(13, 42, 9, 3);
                    g.fillRect(42, 42, 9, 3);
                } else {
                    g.fillEllipse(x, y + 3, r * 2, r * 2);
                    g.fillStyle(color, 1);
                    if (skin.silhouette === 'antennae') g.fillEllipse(x, y, r * 1.9, r * 2.05);
                    else g.fillCircle(x, y, r);
                    g.lineStyle(1.5, outline, 0.7);
                    g.strokeEllipse(x, y, r * 1.9, r * 1.9);
                    g.fillStyle(0xffffff, 0.26);
                    g.fillEllipse(x - 4, y - 10, r * 1.2, 9);
                }
                // Eyes and glints are below the separate number badge.
                const eyeR = skin.silhouette === 'antennae' ? 6 : 4.5;
                g.fillStyle(0xffffff, 1);
                g.fillEllipse(24, 31, eyeR * 1.8, eyeR * 2);
                g.fillEllipse(40, 31, eyeR * 1.8, eyeR * 2);
                g.fillStyle(0x10243a, 1);
                g.fillCircle(25, 32, eyeR * 0.6);
                g.fillCircle(41, 32, eyeR * 0.6);
                g.fillStyle(0xffffff, 1);
                g.fillCircle(24, 30, 1.5);
                g.fillCircle(40, 30, 1.5);
                g.lineStyle(1.5, 0x10243a, 0.8);
                g.lineBetween(29, 41, 35, 41);
                g.generateTexture(isPlayer ? skin.playerTexture : skin.enemyTexture, HEAD_TEXTURE_SIZE, HEAD_TEXTURE_SIZE);
            }
        }
    }
}
