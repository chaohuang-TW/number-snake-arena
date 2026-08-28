const fs = require('fs');
let code = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

const regex = /await page\.waitForTimeout\(7800\); \/\/ Wait for combo timeout/;
const replacement = "await page.waitForTimeout(15000); // Wait for combo timeout";
code = code.replace(regex, replacement);

fs.writeFileSync('tests/e2e/run-e2e.cjs', code);
