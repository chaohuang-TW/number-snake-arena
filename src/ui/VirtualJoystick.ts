import Phaser from 'phaser';
import { isTouchCapableDevice } from '../utils/device';
import { arenaUiLayout, type RectBounds } from '../utils/layout';
import { safeInsets, uiUnit } from './ArcadeStyle';

export class VirtualJoystick {
    scene: Phaser.Scene;
    base: Phaser.GameObjects.Arc;
    thumb: Phaser.GameObjects.Arc;
    active = false;
    deltaX = 0;
    deltaY = 0;
    private pointerId: number | null = null;
    private radius: number;
    private readonly cancel = () => this.release();
    constructor(scene: Phaser.Scene) {
        this.scene = scene; this.radius = uiUnit(scene, 56);
        this.base = scene.add.circle(0, 0, this.radius, 0x203d50, 0.65).setStrokeStyle(2, 0x88c9d5, 0.6).setScrollFactor(0).setDepth(200).setInteractive();
        this.thumb = scene.add.circle(0, 0, uiUnit(scene, 24), 0x8cddd1, 0.85).setStrokeStyle(2, 0xc5fff2).setScrollFactor(0).setDepth(201);
        scene.input.on('pointerdown', this.onPointerDown, this);
        scene.input.on('pointermove', this.onPointerMove, this);
        scene.input.on('pointerup', this.onPointerUp, this);
        scene.input.on('pointerupoutside', this.onPointerUp, this);
        scene.events.on('pause', this.cancel);
        scene.events.on('sleep', this.cancel);
        window.addEventListener('blur', this.cancel);
        window.addEventListener('pointercancel', this.cancel);
        document.addEventListener('visibilitychange', this.cancel);
        scene.events.once('shutdown', this.destroy, this);
        this.resize(scene.scale.gameSize);
    }
    onPointerDown(pointer: Phaser.Input.Pointer) {
        const fromTouch = (pointer.event as PointerEvent | undefined)?.pointerType === 'touch' || pointer.wasTouch;
        if (!isTouchCapableDevice() && !fromTouch) return;
        // Keep a fixed lower-left anchor and never capture menu, ranking, or ability taps.
        const distance = Math.hypot(pointer.x - this.base.x, pointer.y - this.base.y);
        if (this.pointerId === null && distance <= this.radius * 1.35) {
            this.active = true; this.pointerId = pointer.id;
            this.updateDelta(pointer.x, pointer.y);
        }
    }
    onPointerMove(pointer: Phaser.Input.Pointer) { if (this.active && pointer.id === this.pointerId && pointer.isDown) this.updateDelta(pointer.x, pointer.y); }
    onPointerUp(pointer: Phaser.Input.Pointer) { if (pointer.id === this.pointerId) this.release(); }
    private release() { this.active = false; this.pointerId = null; this.deltaX = 0; this.deltaY = 0; this.thumb.setPosition(this.base.x, this.base.y); }
    updateDelta(px: number, py: number) {
        const dx = px - this.base.x, dy = py - this.base.y, distance = Math.hypot(dx, dy);
        const ratio = distance > this.radius ? this.radius / distance : 1;
        this.thumb.setPosition(this.base.x + dx * ratio, this.base.y + dy * ratio);
        this.deltaX = dx * ratio / this.radius; this.deltaY = dy * ratio / this.radius;
    }
    resize(gameSize: Phaser.Structs.Size) {
        const layout = arenaUiLayout(gameSize.width, gameSize.height, safeInsets(this.scene));
        this.base.setPosition(layout.joystick.x, layout.joystick.y);
        this.release();
        this.base.setVisible(isTouchCapableDevice()); this.thumb.setVisible(isTouchCapableDevice());
    }
    getBounds(): RectBounds { return this.base.visible ? { x: this.base.x - this.radius, y: this.base.y - this.radius, width: 2 * this.radius, height: 2 * this.radius } : { x: 0, y: 0, width: 0, height: 0 }; }
    destroy() {
        this.release();
        this.scene.input.off('pointerdown', this.onPointerDown, this);
        this.scene.input.off('pointermove', this.onPointerMove, this);
        this.scene.input.off('pointerup', this.onPointerUp, this);
        this.scene.input.off('pointerupoutside', this.onPointerUp, this);
        this.scene.events.off('pause', this.cancel); this.scene.events.off('sleep', this.cancel);
        window.removeEventListener('blur', this.cancel); window.removeEventListener('pointercancel', this.cancel);
        document.removeEventListener('visibilitychange', this.cancel);
        this.base.destroy(); this.thumb.destroy();
    }
}
