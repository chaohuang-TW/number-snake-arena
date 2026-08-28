const fs = require('fs');
let runE2E = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

runE2E = runE2E.replace(/await page2\.goto\(process\.env\.BASE_URL \+ '\?debug=1&e2e=1'\);\n\s*await page2\.waitForTimeout\(1500\);\n\s*await page2\.evaluate\(\(\) => \{ window\.API = window\.__NUMBER_SNAKE_DEBUG__; window\.API\.stopSpawning\(\); \}\);/g,
`await page2.goto(process.env.BASE_URL + '?debug=1&e2e=1');
            await page2.waitForTimeout(1500);
            await page2.evaluate(() => { window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 }); });
            await page2.waitForTimeout(1500);
            await page2.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });`);

fs.writeFileSync('tests/e2e/run-e2e.cjs', runE2E);
console.log("Patched Test R2");
