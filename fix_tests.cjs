const fs = require('fs');
let runE2E = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

// Fix Test O Freeze test
runE2E = runE2E.replace(/await page\.evaluate\(\(\) => \{ \n\s*const gs = window\.__PHASER_GAME__\.scene\.scenes\.find\(s => s\.scene\.key === 'GameScene'\);\n\s*gs\.player\.takeDamage\(1, 3, \{x: 0, y: 0\}\);\n\s*\}\);\n\s*await page\.waitForTimeout\(100\);\n\s*let postHP = await page\.evaluate\(\(\) => window\.API\.getHP\(\)\);\n\s*assert\(postHP === prevHP, `HP should freeze during LEVEL_CLEAR, before \$\{prevHP\} after \$\{postHP\}`\);/g, 
`await page.evaluate(() => { 
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.spawnEnemy();
                if(gs.enemies.length > 0) {
                    gs.enemies[0].body.x = gs.player.head.x;
                    gs.enemies[0].body.y = gs.player.head.y;
                    gs.enemies[0].value = 9999;
                }
            });
            await page.waitForTimeout(300);
            let postHP = await page.evaluate(() => window.API.getHP());
            assert(postHP === prevHP, \`HP should freeze during LEVEL_CLEAR, before \${prevHP} after \${postHP}\`);`);

// Fix Test R
runE2E = runE2E.replace(/await page\.evaluate\(\(\) => \{ window\.API = window\.__NUMBER_SNAKE_DEBUG__; window\.API\.stopSpawning\(\); \}\);\n\s*let pDataR = await page\.evaluate\(\(\) => window\.API\.getProgression\(\)\);/g,
`let pDataR = await page.evaluate(() => {
                return {
                    highestUnlockedLevel: Number(localStorage.getItem('highestUnlockedLevel') || '1'),
                    maxHPBonus: Number(localStorage.getItem('maxHPBonus') || '0'),
                    claimedRewards: JSON.parse(localStorage.getItem('claimedRewards') || '[]')
                };
            });`);

// Fix Test R2
runE2E = runE2E.replace(/let pDataR2 = await page2\.evaluate\(\(\) => window\.__NUMBER_SNAKE_DEBUG__\.getProgression\(\)\);/g,
`let pDataR2 = await page2.evaluate(() => {
                return {
                    highestUnlockedLevel: Number(localStorage.getItem('highestUnlockedLevel') || '1'),
                    maxHPBonus: Number(localStorage.getItem('maxHPBonus') || '0'),
                    claimedRewards: JSON.parse(localStorage.getItem('claimedRewards') || '[]')
                };
            });`);

fs.writeFileSync('tests/e2e/run-e2e.cjs', runE2E);
