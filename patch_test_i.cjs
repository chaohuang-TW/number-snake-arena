const fs = require('fs');
let code = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

const regex = /assert\(combo1 > 0, `Combo should be > 0, got \$\{combo1\}`\);/;
const replacement = "assert(combo1 === 1, `Combo should be 1, got ${combo1}`);";
code = code.replace(regex, replacement);

fs.writeFileSync('tests/e2e/run-e2e.cjs', code);
