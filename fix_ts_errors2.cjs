const fs = require('fs');

let gameScene = fs.readFileSync('src/scenes/GameScene.ts', 'utf8');
gameScene = gameScene.replace(/import \{ LEVELS, getLevel, type LevelDefinition \} from '\.\.\/config\/levels';/, "import { type LevelDefinition } from '../config/levels';");
gameScene = gameScene.replace(/this\.hud\.update\(this\.player\.hp, this\.player\.boostEnergy, GameBalance\.player\.maxBoostEnergy\);/g, "this.hud.update(this.player.hp, ProgressionManager.getMaxHP(), this.player.boostEnergy, GameBalance.player.maxBoostEnergy);");
fs.writeFileSync('src/scenes/GameScene.ts', gameScene);
