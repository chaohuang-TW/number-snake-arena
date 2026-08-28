const fs = require('fs');
let runE2E = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

// Fix Test R2 (initScript)
runE2E = runE2E.replace(/let lData = await page\.evaluate\(\(\) => localStorage\.getItem\('progressionData'\)\);\n\s*const page2 = await browser\.newPage\(\);\n\s*await page2\.goto\(process\.env\.BASE_URL\);\n\s*await page2\.evaluate\(\(data\) => \{ localStorage\.setItem\('progressionData', data\); \}, lData\);\n\s*await page2\.goto\(process\.env\.BASE_URL \+ '\?debug=1&e2e=1'\);/g,
`let lData = await page.evaluate(() => localStorage.getItem('progressionData'));
            const page2 = await browser.newPage();
            await page2.addInitScript((data) => { localStorage.setItem('progressionData', data); }, lData);
            await page2.goto(process.env.BASE_URL + '?debug=1&e2e=1');`);

// Fix Test T (Set player value high to test enemy cap)
runE2E = runE2E.replace(/for\(let i=0; i<100; i\+\+\) gs\.spawnEnemy\(\);\n\s*\}\);\n\s*let l2Enemies = await page\.evaluate\(\(\) => \{/g,
`window.API.setPlayerValue(150);
                for(let i=0; i<100; i++) gs.spawnEnemy();
            });
            
            let l2Enemies = await page.evaluate(() => {`);

// Fix Test U (getBossSpawned -> getBossState)
runE2E = runE2E.replace(/let bossUSpawn1 = await page\.evaluate\(\(\) => window\.API\.getBossSpawned\(\)\);\n\s*assert\(!bossUSpawn1, `Boss should NOT spawn at 70 in Level 2`\);\n\s*await page\.evaluate\(\(\) => \{ window\.API\.setPlayerValue\(149\); \}\);\n\s*await page\.waitForTimeout\(600\);\n\s*let bossUSpawn2 = await page\.evaluate\(\(\) => window\.API\.getBossSpawned\(\)\);\n\s*assert\(!bossUSpawn2, `Boss should NOT spawn at 149 in Level 2`\);\n\s*await page\.evaluate\(\(\) => \{ window\.API\.setPlayerValue\(150\); \}\);\n\s*await page\.waitForTimeout\(600\);\n\s*let bossUSpawn3 = await page\.evaluate\(\(\) => window\.API\.getBossSpawned\(\)\);\n\s*assert\(bossUSpawn3, `Boss should spawn at 150 in Level 2`\);/g,
`let bossUSpawn1 = await page.evaluate(() => window.API.getBossState());
            assert(bossUSpawn1 === 'NONE', \`Boss should NOT spawn at 70 in Level 2\`);
            
            await page.evaluate(() => { window.API.setPlayerValue(149); });
            await page.waitForTimeout(600);
            let bossUSpawn2 = await page.evaluate(() => window.API.getBossState());
            assert(bossUSpawn2 === 'NONE', \`Boss should NOT spawn at 149 in Level 2\`);
            
            await page.evaluate(() => { window.API.setPlayerValue(150); });
            await page.waitForTimeout(600);
            let bossUSpawn3 = await page.evaluate(() => window.API.getBossState());
            assert(bossUSpawn3 !== 'NONE', \`Boss should spawn at 150 in Level 2\`);`);

fs.writeFileSync('tests/e2e/run-e2e.cjs', runE2E);
