import Phaser from 'phaser';
import { PlayerSnake } from '../entities/PlayerSnake';
import { Boss100 } from '../entities/Boss100';

export class DebugUI {
    scene: Phaser.Scene;
    text: Phaser.GameObjects.Text;
    player: PlayerSnake;
    getEnemiesCount: () => number;
    getBoss: () => Boss100 | null;

    constructor(scene: Phaser.Scene, player: PlayerSnake, getEnemiesCount: () => number, getBoss: () => Boss100 | null) {
        this.scene = scene;
        this.player = player;
        this.getEnemiesCount = getEnemiesCount;
        this.getBoss = getBoss;

        this.text = scene.add.text(10, 100, '', {
            fontSize: '16px',
            color: '#00ff00',
            backgroundColor: '#00000088',
            padding: { x: 10, y: 10 }
        }).setScrollFactor(0).setDepth(1000);
    }

    update() {
        const boss = this.getBoss();
        const info = [
            `FPS: ${Math.round(this.scene.game.loop.actualFps)}`,
            `PlayerValue: ${this.player.value}`,
            `HP: ${this.player.hp}`,
            `BodySegments: ${this.player.segments}`,
            `Enemy Count: ${this.getEnemiesCount()}`,
            `Player Coordinates: ${Math.round(this.player.head.x)}, ${Math.round(this.player.head.y)}`,
            `Player State: ${this.player.isStunned ? 'STUNNED' : this.player.isInvulnerable ? 'INVULNERABLE' : 'NORMAL'}`,
            `Boss State: ${boss ? (boss.isFleeing ? 'FLEEING' : 'CHASING') : 'NONE'}`
        ];
        this.text.setText(info.join('\n'));
    }
}
