const fs = require('fs');
let code = fs.readFileSync('tests/e2e/test-playwright.cjs', 'utf8');

const regex = /const baseURL = 'http:\/\/localhost:3000\/';/;
const replacement = "const baseURL = process.env.BASE_URL || 'http://localhost:3000/';";
code = code.replace(regex, replacement);

fs.writeFileSync('tests/e2e/run-e2e.cjs', code);
fs.unlinkSync('tests/e2e/test-playwright.cjs');
if (fs.existsSync('tests/e2e/test-production.cjs')) {
    fs.unlinkSync('tests/e2e/test-production.cjs');
}
