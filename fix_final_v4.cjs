const fs = require('fs');
let runE2E = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

// Fix Test R2 (Playwright storageState)
runE2E = runE2E.replace(/let lData = await page\.evaluate\(\(\) => localStorage\.getItem\('progressionData'\)\);\n\s*const page2 = await browser\.newPage\(\);\n\s*await page2\.goto\(process\.env\.BASE_URL\);\n\s*await page2\.evaluate\(\(data\) => \{ localStorage\.setItem\('progressionData', data\); \}, lData\);\n\s*await page2\.goto\(process\.env\.BASE_URL \+ '\?debug=1&e2e=1'\);/g,
`const storageState = await page.context().storageState();
            const context2 = await browser.newContext({ storageState });
            const page2 = await context2.newPage();
            await page2.goto(process.env.BASE_URL + '?debug=1&e2e=1');`);

// Fix Test U (destroy boss from Test T)
runE2E = runE2E.replace(/let bossUSpawn1 = await page\.evaluate\(\(\) => window\.API\.getBossState\(\)\);/g,
`await page.evaluate(() => { 
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                if (gs.boss) { gs.boss.destroy(); gs.boss = null; gs.enemies = gs.enemies.filter(e => e !== gs.boss); }
                window.API.setPlayerValue(5);
            });
            let bossUSpawn1 = await page.evaluate(() => window.API.getBossState());`);

fs.writeFileSync('tests/e2e/run-e2e.cjs', runE2E);
