const fs = require('fs');
let gs = fs.readFileSync('src/scenes/GameScene.ts', 'utf8');

const regex = /this\.disableSpawning = true;\s*\/\/\s*disable background spawning/;
gs = gs.replace(regex, 'this.disableSpawning = true; // disable background spawning\n                    this.enemies.clear(true, true); // destroy existing enemies');

fs.writeFileSync('src/scenes/GameScene.ts', gs);
