const fs = require('fs');

let code = fs.readFileSync('src/scenes/GameScene.ts', 'utf8');

code = code.replace(
    /this\.hud\.update\(this\.player\.hp, this\.player\.boostEnergy, 100\);/g,
    `this.hud.update(this.player.hp, ProgressionManager.getMaxHP(), this.player.boostEnergy, 100);`
);

fs.writeFileSync('src/scenes/GameScene.ts', code);
