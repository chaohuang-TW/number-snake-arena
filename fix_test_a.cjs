const fs = require('fs');
let pw = fs.readFileSync('tests/e2e/test-playwright.cjs', 'utf8');

// Replace Test A
const testARegex = /console\.log\(\'\\\\n--- Test A: Core Eating ---\'\);\s*await page\.evaluate\(\(\) => \{[\s\S]*?assert\(enemiesLen === 0, `Enemy should be removed, got \$\{enemiesLen\}`\);/;
const testAReplacement = `console.log('\\n--- Test A: Core Eating ---');
            let initialSegments = await page.evaluate(() => API.getBodySegments());
            await page.evaluate(() => { 
                for (const e of API.getEnemies()) { e.destroy(); } API.getEnemies().length = 0; 
                API.setPlayerValue(5); API.setPlayerHP(3); 
                let pos = API.getPlayerPos();
                let e = API.spawnEnemy(3, pos.x + 500, pos.y);
                API.forceCollisionWithEnemy(API.getEnemies().indexOf(e));
            });
            let pValA1 = await page.evaluate(() => API.getPlayerValue());
            let segments = await page.evaluate(() => API.getBodySegments());
            let enemiesLen = await page.evaluate(() => API.getEnemies().length);
            assert(pValA1 === 8, \`Player value should be 8, got \$\{pValA1\}\`);
            assert(segments === initialSegments + 1, \`Body segments should be \$\{initialSegments + 1\}, got \$\{segments\}\`);
            assert(enemiesLen === 0, \`Enemy should be removed, got \$\{enemiesLen\}\`);`;

pw = pw.replace(testARegex, testAReplacement);
fs.writeFileSync('tests/e2e/test-playwright.cjs', pw);
