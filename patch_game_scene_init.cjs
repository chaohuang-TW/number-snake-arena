const fs = require('fs');

let code = fs.readFileSync('src/scenes/GameScene.ts', 'utf8');

code = code.replace(
    /constructor\(\) \{\n        super\('GameScene'\);\n    \}/,
    `constructor() {
        super('GameScene');
    }

    init(data: any) {
        this.levelId = data?.levelId || 1;
        ProgressionManager.load();
        this.levelDef = getLevel(this.levelId);
    }`
);
// Make sure getLevel is imported! I replaced it with `import { type LevelDefinition } from '../config/levels';` earlier!
code = code.replace(
    /import \{ type LevelDefinition \} from '\.\.\/config\/levels';/,
    `import { LEVELS, getLevel, type LevelDefinition } from '../config/levels';`
);

fs.writeFileSync('src/scenes/GameScene.ts', code);
