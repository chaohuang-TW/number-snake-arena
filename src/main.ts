import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { PauseScene } from './scenes/PauseScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1a1a2e',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false, // will be toggleable via URL ?debug=1
        }
    },
    scene: [BootScene, MenuScene, GameScene, PauseScene],
    input: {
        activePointers: 3, // For multi-touch (joystick + boost)
    }
};

// Check for debug param
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('debug') === '1') {
    if (config.physics && config.physics.arcade) {
        config.physics.arcade.debug = true;
    }
}

(window as any).__PHASER_GAME__ = new Phaser.Game(config);
