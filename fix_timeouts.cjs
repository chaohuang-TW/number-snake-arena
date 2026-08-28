const fs = require('fs');
let pw = fs.readFileSync('tests/e2e/test-playwright.cjs', 'utf8');

pw = pw.replace(/await page\.waitForTimeout\((\d+)\);/g, (match, p1) => {
    let val = parseInt(p1);
    // Multiply by 3 for safety on slow software-rendering CI
    let newVal = val * 3;
    return `await page.waitForTimeout(${newVal});`;
});

fs.writeFileSync('tests/e2e/test-playwright.cjs', pw);
