import Phaser from 'phaser';
import { canvasUnitsForCssPixels, readSafeAreaInsets } from '../utils/layout';

export const ARCADE = { background: 0x081321, panel: 0x12273b, border: 0x34516a, accent: 0x81efdc, primary: 0x176954, text: '#eff9ff', muted: '#b4c7d8', font: 'system-ui, -apple-system, "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif' };
export function uiUnit(scene: Phaser.Scene, css: number): number {
    const rect = scene.game.canvas.getBoundingClientRect();
    return canvasUnitsForCssPixels(css, scene.scale.width, rect.width);
}
export function uiText(scene: Phaser.Scene, x: number, y: number, text: string, size = 18, color: string | number = ARCADE.text): Phaser.GameObjects.Text {
    return scene.add.text(x, y, text, { fontFamily: ARCADE.font, fontSize: `${uiUnit(scene, size)}px`, color: typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color, align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
}
export function roundedPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color = ARCADE.panel, border = ARCADE.border): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics({ x, y });
    g.fillStyle(color, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    g.lineStyle(1.5, border, 0.8).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    return g;
}
export interface ArcadeButton { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; art: Phaser.GameObjects.Graphics; move(x: number, y: number): void; destroy(): void; }
export function arcadeButton(scene: Phaser.Scene, x: number, y: number, width: number, label: string, onPress: () => void, name = '', primary = true): ArcadeButton {
    const height = uiUnit(scene, 52);
    const color = primary ? ARCADE.primary : ARCADE.panel;
    const art = roundedPanel(scene, x, y, width, height, color, primary ? ARCADE.accent : ARCADE.border);
    const bg = scene.add.rectangle(x, y, width, height, color, 0).setInteractive({ useHandCursor: true }).setName(name);
    const text = uiText(scene, x, y, label, 18);
    bg.on('pointerover', () => art.setAlpha(0.85));
    bg.on('pointerout', () => art.setAlpha(1));
    // Geometry stays stationary throughout the click; callbacks are never attached to a tween target.
    bg.on('pointerdown', () => { art.setAlpha(0.75); onPress(); });
    bg.on('pointerup', () => art.setAlpha(1));
    return { bg, label: text, art, move: (nx, ny) => { bg.setPosition(nx, ny); text.setPosition(nx, ny); art.setPosition(nx, ny); }, destroy: () => { bg.destroy(); text.destroy(); art.destroy(); } };
}
export function sceneBackdrop(scene: Phaser.Scene): void {
    const w = scene.scale.width, h = scene.scale.height;
    const g = scene.add.graphics().setDepth(-20);
    g.fillStyle(ARCADE.background, 1).fillRect(0, 0, w, h);
    g.lineStyle(1, 0x225668, 0.13);
    for (let x = 0; x < w; x += 80) g.lineBetween(x, 0, x, h);
    for (let y = 0; y < h; y += 80) g.lineBetween(0, y, w, y);
    g.fillStyle(0x2da897, 0.07).fillEllipse(w * 0.2, h * 0.25, w * 0.6, h * 0.7);
    g.fillStyle(0x4278af, 0.07).fillEllipse(w * 0.8, h * 0.7, w * 0.5, h * 0.7);
}
export function safeInsets(scene: Phaser.Scene) {
    const safe = readSafeAreaInsets();
    return { top: uiUnit(scene, safe.top), right: uiUnit(scene, safe.right), bottom: uiUnit(scene, safe.bottom), left: uiUnit(scene, safe.left) };
}
