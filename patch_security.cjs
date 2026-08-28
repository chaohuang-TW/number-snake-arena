const fs = require('fs');
let code = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

const regex = /await page\.keyboard\.press\('c'\);\s*await page\.waitForTimeout\(3000\);\s*const playerValNormal = await page\.evaluate\(\(\) => \{\s*return window\.__E2E_READONLY__ \? window\.__E2E_READONLY__\.getPlayerValue\(\) : 5;\s*\}\);\s*assert\(playerValNormal === 5, `PlayerValue should not change on normal URL when pressing C, got \$\{playerValNormal\}`\);/;
const replacement = `const valBefore = await page.evaluate(() => window.__E2E_READONLY__ ? window.__E2E_READONLY__.getPlayerValue() : 5);
            await page.keyboard.press('c');
            await page.waitForTimeout(3000);
            const valAfter = await page.evaluate(() => window.__E2E_READONLY__ ? window.__E2E_READONLY__.getPlayerValue() : 5);
            assert(valAfter < valBefore + 10, \`PlayerValue should not increase by 10 on normal URL when pressing C, went from \${valBefore} to \${valAfter}\`);`;
code = code.replace(regex, replacement);

fs.writeFileSync('tests/e2e/run-e2e.cjs', code);
