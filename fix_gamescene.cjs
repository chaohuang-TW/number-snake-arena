const fs = require('fs');
let gs = fs.readFileSync('src/scenes/GameScene.ts', 'utf8');

const searchStr = 'getPlayerPosition: () => ({ x: this.player.head.x, y: this.player.head.y }),';
const replaceStr = searchStr + '\n                getPlayerSpeed: () => this.player.head.body ? (this.player.head.body as Phaser.Physics.Arcade.Body).speed : 0,';

gs = gs.replace(searchStr, replaceStr);
fs.writeFileSync('src/scenes/GameScene.ts', gs);
