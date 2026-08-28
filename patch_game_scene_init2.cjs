const fs = require('fs');
let code = fs.readFileSync('src/scenes/GameScene.ts', 'utf8');
code = code.replace(
    /import \{ LEVELS, getLevel, type LevelDefinition \} from '\.\.\/config\/levels';/,
    `import { getLevel, type LevelDefinition } from '../config/levels';`
);
fs.writeFileSync('src/scenes/GameScene.ts', code);
