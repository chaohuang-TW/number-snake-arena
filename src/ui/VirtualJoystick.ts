import Phaser from 'phaser';

export class VirtualJoystick {
    scene: Phaser.Scene;
    base: Phaser.GameObjects.Arc;
    thumb: Phaser.GameObjects.Arc;
    
    active: boolean = false;
    deltaX: number = 0;
    deltaY: number = 0;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        
        // Use Arc directly from the scene add method instead of circle
        this.base = scene.add.circle(100, scene.scale.height - 100, 60, 0xffffff, 0.2);
        this.base.setScrollFactor(0).setDepth(200);
        
        this.thumb = scene.add.circle(100, scene.scale.height - 100, 30, 0xffffff, 0.5);
        this.thumb.setScrollFactor(0).setDepth(201);

        this.base.setInteractive();
        
        scene.input.on('pointerdown', this.onPointerDown, this);
        scene.input.on('pointermove', this.onPointerMove, this);
        scene.input.on('pointerup', this.onPointerUp, this);
        scene.input.on('pointerupoutside', this.onPointerUp, this);

        this.resize(scene.scale.gameSize);
    }

    onPointerDown(pointer: Phaser.Input.Pointer) {
        // Only activate if pointer is on the left half of the screen
        if (pointer.x < this.scene.scale.width / 2) {
            this.active = true;
            this.base.setPosition(pointer.x, pointer.y);
            this.thumb.setPosition(pointer.x, pointer.y);
            this.updateDelta(pointer.x, pointer.y);
        }
    }

    onPointerMove(pointer: Phaser.Input.Pointer) {
        if (this.active && pointer.isDown) {
            this.updateDelta(pointer.x, pointer.y);
        }
    }

    onPointerUp(_pointer: Phaser.Input.Pointer) {
        if (this.active) {
            this.active = false;
            this.thumb.setPosition(this.base.x, this.base.y);
            this.deltaX = 0;
            this.deltaY = 0;
        }
    }

    updateDelta(px: number, py: number) {
        const dx = px - this.base.x;
        const dy = py - this.base.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 60;
        
        if (dist > maxDist) {
            const angle = Math.atan2(dy, dx);
            this.thumb.x = this.base.x + Math.cos(angle) * maxDist;
            this.thumb.y = this.base.y + Math.sin(angle) * maxDist;
            this.deltaX = Math.cos(angle);
            this.deltaY = Math.sin(angle);
        } else {
            this.thumb.x = px;
            this.thumb.y = py;
            if (dist > 0) {
                this.deltaX = dx / maxDist;
                this.deltaY = dy / maxDist;
            } else {
                this.deltaX = 0;
                this.deltaY = 0;
            }
        }
    }

    resize(gameSize: Phaser.Structs.Size) {
        // Reset base position to bottom left area
        this.base.setPosition(100, gameSize.height - 100);
        this.thumb.setPosition(100, gameSize.height - 100);
    }
}
