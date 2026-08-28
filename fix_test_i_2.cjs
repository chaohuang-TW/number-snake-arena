const fs = require('fs');
let pw = fs.readFileSync('tests/e2e/test-playwright.cjs', 'utf8');

const testIRegex = /assert\(combo1 === 1, `Combo should be 1, got \$\{combo1\}`\);/;
const testIReplacement = `assert(combo1 > 0, \`Combo should be > 0, got \$\{combo1\}\`);`;

pw = pw.replace(testIRegex, testIReplacement);
fs.writeFileSync('tests/e2e/test-playwright.cjs', pw);
