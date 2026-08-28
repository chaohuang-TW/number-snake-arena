const fs = require('fs');
let pw = fs.readFileSync('tests/e2e/test-playwright.cjs', 'utf8');

// Replace:
// await page.mouse.up();
// await page.waitForTimeout(500);

pw = pw.replace(
    "await page.mouse.up();\\n                await page.waitForTimeout(500);",
    "await page.mouse.up();\\n                await page.mouse.move(0, 0);\\n                await page.waitForTimeout(500);"
);

// Actually, wait, maybe I should just use regex since the indentation might be weird
const regex = /await page\.mouse\.up\(\);\s*await page\.waitForTimeout\(500\);/;
pw = pw.replace(regex, 'await page.mouse.up();\\n                await page.mouse.move(v.width/2, v.height/2);\\n                await page.waitForTimeout(500);');

fs.writeFileSync('tests/e2e/test-playwright.cjs', pw);
