const fs = require('fs');

let gameScene = fs.readFileSync('src/scenes/GameScene.ts', 'utf8');
gameScene = gameScene.replace(/import \{ LEVELS, getLevel, LevelDefinition \} from '\.\.\/config\/levels';/, "import { LEVELS, getLevel, type LevelDefinition } from '../config/levels';");
gameScene = gameScene.replace(/this\.hud\.update\(this\.player\.hp, ProgressionManager\.getMaxHP\(\), this\.player\.boostEnergy, 100\);/g, "this.hud.update(this.player.hp, ProgressionManager.getMaxHP(), this.player.boostEnergy, 100);");
fs.writeFileSync('src/scenes/GameScene.ts', gameScene);

let debugUI = fs.readFileSync('src/ui/DebugUI.ts', 'utf8');
debugUI = debugUI.replace(/import \{ Boss100 \} from '\.\.\/entities\/Boss100';/, "import { NumberBoss } from '../entities/NumberBoss';");
debugUI = debugUI.replace(/Boss100/g, "NumberBoss");
fs.writeFileSync('src/ui/DebugUI.ts', debugUI);
