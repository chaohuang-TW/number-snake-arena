const fs = require('fs');
let pw = fs.readFileSync('tests/e2e/test-playwright.cjs', 'utf8');

// The mobile boost test currently does this:
// await page.mouse.move(v.width / 2, v.height / 2);
// await page.mouse.down();
// await page.waitForTimeout(500); // Wait for double tap window
// await page.mouse.up();
// await page.waitForTimeout(50);
// await page.mouse.down(); // Second tap to activate boost
// let initialBoost = await page.evaluate(() => API.getBoostEnergy());
// await page.waitForTimeout(200);
// let speedBoost = await page.evaluate(() => API.getPlayerSpeed());

// We need to replace it with pressing the boost button:
const searchString = `                await page.mouse.move(v.width / 2, v.height / 2);
                await page.mouse.down();
                await page.waitForTimeout(500); // Wait for double tap window
                await page.mouse.up();
                await page.waitForTimeout(50);
                await page.mouse.down(); // Second tap to activate boost`;
                
const replaceString = `                let bx = v.width - 80;
                let by = v.height - 80;
                await page.mouse.move(bx, by);
                await page.mouse.down();`;

pw = pw.replace(searchString, replaceString);
fs.writeFileSync('tests/e2e/test-playwright.cjs', pw);
