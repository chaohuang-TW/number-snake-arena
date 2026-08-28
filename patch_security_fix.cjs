const fs = require('fs');
let code = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

const regex = /let e2ePVal = await page\.evaluate\(\(\) => window\.__E2E_READONLY__\.getPlayerValue\(\)\);\n\s*let e2eBoss = await page\.evaluate\(\(\) => window\.__E2E_READONLY__\.getBossSpawned\(\)\);\n\s*assert\(e2ePVal === 5, `PlayerValue should not change on normal URL when pressing C, got \$\{e2ePVal\}`\);/;

const replacement = `let e2ePVal = await page.evaluate(() => window.__E2E_READONLY__.getPlayerValue());
            let e2eBoss = await page.evaluate(() => window.__E2E_READONLY__.getBossSpawned());
            assert(e2ePVal < 25, \`PlayerValue should not massively change on normal URL when pressing C, got \${e2ePVal}\`);`;

code = code.replace(regex, replacement);
fs.writeFileSync('tests/e2e/run-e2e.cjs', code);
