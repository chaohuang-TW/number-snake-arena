import Phaser from 'phaser';
import type { LevelDefinition } from '../config/levels';
import { VisualPreferencesManager } from '../models/VisualPreferences';

import { ARENA_THEME_PALETTES, MAX_AMBIENT_EFFECTS } from '../config/visuals';

/** All layers are decorative Graphics, never bodies. At most 6 animated ambient objects. */
export function createArenaBackground(scene: Phaser.Scene, theme: LevelDefinition['theme'], worldW: number, worldH: number) {
    const palette = ARENA_THEME_PALETTES[theme];
    const prefs = VisualPreferencesManager.get();
    const base = scene.add.graphics().setDepth(-20);
    base.fillStyle(palette.ground, 1).fillRect(-worldW / 2, -worldH / 2, worldW, worldH);
    const decor = scene.add.graphics().setDepth(-19);
    if (theme === 'neon-grid') {
        decor.lineStyle(1, palette.ornament, 0.34);
        for (let x = -worldW / 2; x <= worldW / 2; x += 100) decor.lineBetween(x, -worldH / 2, x, worldH / 2);
        for (let y = -worldH / 2; y <= worldH / 2; y += 100) decor.lineBetween(-worldW / 2, y, worldW / 2, y);
        // Cross nodes use squares so they cannot be mistaken for collectible rings.
        decor.fillStyle(palette.edge, 0.16);
        for (let i = 0; i < 20; i++) decor.fillRect(-900 + (i * 173) % 1800, -600 + (i * 211) % 1200, 5, 5);
    } else if (theme === 'cyber-city') {
        // Two layers of buildings anchor the distant skyline without covering the arena edge.
        for (let layer = 0; layer < 2; layer++) {
            decor.fillStyle(layer ? 0x1a2948 : 0x131e35, 0.75);
            for (let i = 0; i < 22; i++) {
                const x = -worldW / 2 + i * 118, height = 90 + (i * 67 + layer * 81) % 280;
                const y = 220 - height - layer * 45;
                decor.fillRoundedRect(x, y, 86, height, 5);
                decor.lineStyle(1.5, palette.ornament, 0.5).lineBetween(x + 4, y, x + 82, y);
                if (!prefs.lowEffects) {
                    decor.fillStyle(0xf1a2ba, 0.14);
                    for (let j = 0; j < 4; j++) decor.fillRect(x + 15 + j * 15, y + 22, 5, Math.min(80, height - 30));
                }
            }
        }
    } else if (theme === 'lava-core') {
        for (let i = 0; i < (prefs.lowEffects ? 18 : 32); i++) {
            const x = -worldW / 2 + 70 + (i * 179) % (worldW - 140), y = -worldH / 2 + 75 + (i * 263) % (worldH - 150);
            decor.lineStyle(8, palette.ornament, 0.18);
            decor.beginPath().moveTo(x, y).lineTo(x + 45, y + 40).lineTo(x + 88, y + 22).lineTo(x + 110, y + 80).strokePath();
            decor.lineStyle(2, 0xee8556, 0.18);
            decor.strokePath();
        }
    } else {
        decor.fillStyle(0x45365e, 0.18).fillEllipse(-500, -180, 1050, 550);
        decor.fillStyle(0x264263, 0.17).fillEllipse(500, 210, 900, 440);
        for (let i = 0; i < (prefs.lowEffects ? 60 : 120); i++) {
            decor.fillStyle(i % 3 ? 0xa5bad9 : 0xcac2ef, 0.24);
            decor.fillRect(-worldW / 2 + (i * 157) % worldW, -worldH / 2 + (i * 241) % worldH, 1 + i % 2, 1 + i % 2);
        }
    }
    const ambient: Phaser.GameObjects.Graphics[] = [];
    if (!prefs.lowEffects && !prefs.reducedMotion && (theme === 'lava-core' || theme === 'deep-space')) {
        for (let i = 0; i < MAX_AMBIENT_EFFECTS; i++) {
            const item = scene.add.graphics({ x: -800 + i * 310, y: -400 + i * 121 }).setDepth(-18);
            item.fillStyle(theme === 'lava-core' ? 0xffab6c : 0x98b2d9, 0.25).fillRect(0, 0, 2, 2);
            scene.tweens.add({ targets: item, y: item.y - 28, duration: 6000 + i * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            ambient.push(item);
        }
    }
    const boundary = scene.add.graphics().setDepth(-17);
    boundary.lineStyle(12, palette.edge, 0.08).strokeRect(-worldW / 2, -worldH / 2, worldW, worldH);
    boundary.lineStyle(3, palette.edge, 0.64).strokeRect(-worldW / 2, -worldH / 2, worldW, worldH);
    return { base, decor, boundary, ambient };
}
