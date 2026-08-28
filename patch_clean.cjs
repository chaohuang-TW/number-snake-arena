const fs = require('fs');
let code = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

const regex = /const cleanEnemies = async \(\) => \{[\s\S]*?\}\;/;
const replacement = `const cleanEnemies = async () => {
                await page.evaluate(() => {
                    if (window.API && window.API.hardReset) {
                        window.API.hardReset();
                    }
                });
            };`;
code = code.replace(regex, replacement);

fs.writeFileSync('tests/e2e/run-e2e.cjs', code);
