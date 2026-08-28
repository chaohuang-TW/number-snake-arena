const fs = require('fs');
let code = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');
code = code.replace(/assert\(sE === 'VICTORY', `Game state should be VICTORY, got \$\{sE\}`\);/g, "assert(sE === 'LEVEL_CLEAR', `Game state should be LEVEL_CLEAR, got ${sE}`);");
fs.writeFileSync('tests/e2e/run-e2e.cjs', code);
