const fs = require('fs');
let runE2E = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

runE2E = runE2E.replace(/const texts = ms\.children\.list\.filter\(c => c\.text\)\.map\(c => c\.text\);/g, `let texts = [];
                function extract(c) {
                    if (c.text) texts.push(c.text);
                    if (c.list) c.list.forEach(extract);
                }
                ms.children.list.forEach(extract);`);

runE2E = runE2E.replace(/await page\.evaluate\(\(\) => \{ window\.API\.cleanEnemies\(\); \}\);/g, `await page.evaluate(() => { 
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                if(gs) { gs.enemies.forEach(e => { e.destroy(); }); gs.enemies = []; }
            });`);

fs.writeFileSync('tests/e2e/run-e2e.cjs', runE2E);
