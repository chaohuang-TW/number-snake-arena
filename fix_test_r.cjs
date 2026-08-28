const fs = require('fs');
let runE2E = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

const testRBlock = `            // ==========================================
            // TEST R: Real Reload Persistence Test
            // ==========================================
            console.log('\\n--- Test R: Real Reload Persistence Test ---');
            await page.goto(process.env.BASE_URL + '?debug=1&e2e=1');
            await page.waitForTimeout(1500);
            
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            let pDataR = await page.evaluate(() => window.API.getProgression());
            assert(pDataR.highestUnlockedLevel === 2, \`Expected Level 2 unlocked across reload\`);
            assert(pDataR.maxHPBonus === 1, \`Expected MaxHP Bonus 1 across reload\`);
            
            let lData = await page.evaluate(() => localStorage.getItem('progressionData'));
            const page2 = await browser.newPage();
            await page2.goto(process.env.BASE_URL);
            await page2.evaluate((data) => { localStorage.setItem('progressionData', data); }, lData);
            await page2.goto(process.env.BASE_URL + '?debug=1&e2e=1');
            await page2.waitForTimeout(1500);
            await page2.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            let pDataR2 = await page2.evaluate(() => window.API.getProgression());
            assert(pDataR2.highestUnlockedLevel === 2, \`Fresh page: Expected Level 2 unlocked\`);
            assert(pDataR2.maxHPBonus === 1, \`Fresh page: Expected MaxHP Bonus 1\`);
            await page2.close();`;

const sIdx = runE2E.indexOf('--- Test S: Game Over No Reward ---');
const rIdx = runE2E.indexOf('--- Test R: Real Reload Persistence Test ---');

if (rIdx !== -1 && sIdx !== -1) {
    // Find the end of Test Q
    const qEndIdx = runE2E.lastIndexOf('// ==========================================', rIdx);
    const sStartIdx = runE2E.lastIndexOf('// ==========================================', sIdx);
    
    let before = runE2E.substring(0, qEndIdx);
    let after = runE2E.substring(sStartIdx);
    
    fs.writeFileSync('tests/e2e/run-e2e.cjs', before + testRBlock + '\n\n' + after);
    console.log("Patched Test R");
} else {
    console.log("Could not find Test R or S");
}
