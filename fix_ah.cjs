const fs = require('fs');

let e2e = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf-8');
e2e = e2e.replace(/ahBossState = await adPage\.evaluate\(\(\) => \{[\s\S]*?return \{ isFleeing: gs\.boss\.isFleeing \};[\s\S]*?\}\);/g, `ahBossState = await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return { isFleeing: gs.boss.isFleeing, pVal: gs.player.value };
    });`);

fs.writeFileSync('tests/e2e/run-e2e.cjs', e2e);
