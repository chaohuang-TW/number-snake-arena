const fs = require('fs');

let code = fs.readFileSync('src/scenes/GameScene.ts', 'utf8');

// 1. Imports
code = code.replace(
    /import \{ Boss100 \} from '\.\.\/entities\/Boss100';/,
    `import { NumberBoss } from '../entities/NumberBoss';\nimport { ProgressionManager } from '../models/Progression';\nimport { LEVELS, getLevel, LevelDefinition } from '../config/levels';`
);

// 2. Class properties
code = code.replace(
    /bossSpawned: boolean = false;/,
    `bossSpawned: boolean = false;\n    levelId: number = 1;\n    levelDef!: LevelDefinition;`
);

// 3. init method
code = code.replace(
    /init\(\) \{/,
    `init(data: any) {\n        this.levelId = data?.levelId || 1;\n        ProgressionManager.load();\n        this.levelDef = getLevel(this.levelId);`
);

// 4. Game state typing (assuming it's a string, maybe typed as 'RUNNING' | 'PAUSED' | 'GAME_OVER' | 'LEVEL_CLEAR')
code = code.replace(
    /gameState: 'RUNNING' \| 'PAUSED' \| 'GAME_OVER' = 'RUNNING';/,
    `gameState: 'RUNNING' | 'PAUSED' | 'GAME_OVER' | 'LEVEL_CLEAR' = 'RUNNING';`
);

// 5. Boss100 -> NumberBoss in declaration
code = code.replace(
    /boss: Boss100 \| null = null;/,
    `boss: NumberBoss | null = null;`
);

// 6. create() - setup player
code = code.replace(
    /this\.player = new NumberPlayer\(this, 0, 0, 5, 3\);/,
    `this.player = new NumberPlayer(this, 0, 0, this.levelDef.startValue, ProgressionManager.getMaxHP());`
);

// 7. Debug API
code = code.replace(
    /setPlayerValue: \(val: number\) => \{ this\.player\.value = val; \},/,
    `setPlayerValue: (val: number) => { this.player.value = val; },\n                getCurrentLevel: () => this.levelId,\n                startLevel: (id: number) => this.scene.start('GameScene', { levelId: id }),\n                getMaxHP: () => ProgressionManager.getMaxHP(),\n                getHP: () => this.player.hp,\n                getProgression: () => ProgressionManager._getData(),\n                resetProgressionForTest: () => ProgressionManager.reset(),\n                forceLevelClear: () => this.levelClear(),`
);
code = code.replace(
    /this\.player\.value = 5;\n\s*this\.player\.hp = 3;/,
    `this.player.value = this.levelDef.startValue;\n                    this.player.hp = ProgressionManager.getMaxHP();`
);

// 8. update() - boss trigger
code = code.replace(
    /if \(!this\.bossSpawned && this\.player\.value >= 70\) \{/,
    `if (!this.bossSpawned && this.player.value >= this.levelDef.bossTriggerValue) {`
);
code = code.replace(
    /const maxEnemies = this\.bossSpawned \? 8 : 12;/,
    `const maxEnemies = this.bossSpawned ? 8 : 12;`
);

// 9. spawnRandomEnemy() - use normalEnemyMax
code = code.replace(
    /const maxVal = Math\.min\(this\.player\.value \+ 15, 99\);/,
    `const maxVal = Math.min(this.player.value + 15, this.levelDef.normalEnemyMax);`
);

// 10. spawnBoss()
code = code.replace(
    /this\.boss = new Boss100\(this, sx, sy\);/,
    `this.boss = new NumberBoss(this, sx, sy, this.levelDef.bossValue);`
);
code = code.replace(
    /'100 APPEARED!'/,
    `\`\${this.levelDef.bossValue} APPEARED!\``
);

// 11. handleEnemyCollision - reversal check
code = code.replace(
    /if \(this\.boss && this\.player\.value > 100 && oldVal <= 100\) \{/,
    `if (this.boss && this.player.value > this.levelDef.bossValue && oldVal <= this.levelDef.bossValue) {`
);
code = code.replace(
    /'NOW HUNT 100!'/,
    `\`NOW HUNT \${this.levelDef.bossValue}!\``
);

// 12. handleBossCollision - victory -> levelClear
code = code.replace(
    /this\.victory\(\);/,
    `this.levelClear();`
);

fs.writeFileSync('src/scenes/GameScene.ts', code);
