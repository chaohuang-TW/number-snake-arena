const fs = require('fs');
let code = fs.readFileSync('src/scenes/GameScene.ts', 'utf8');
code = code.replace(
    /if \(this\.gameState === 'GAME_OVER' \|\| this\.gameState === 'VICTORY'\) return this\.gameState;/,
    "if (this.gameState === 'GAME_OVER' || this.gameState === 'VICTORY' || this.gameState === 'LEVEL_CLEAR') return this.gameState;"
);
fs.writeFileSync('src/scenes/GameScene.ts', code);
