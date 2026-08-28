const fs = require('fs');
let gs = fs.readFileSync('src/scenes/GameScene.ts', 'utf8');

const regex = /stopSpawning: \(\) => { this\.spawnTimer = 9999999; this\.enemies\.clear\(true, true\); },/;
gs = gs.replace(regex, 'stopSpawning: () => { this.spawnTimer = 9999999; for (const e of this.enemies) { e.destroy(); } this.enemies = []; },');

fs.writeFileSync('src/scenes/GameScene.ts', gs);
