const fs = require('fs');

let e2e = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf-8');
e2e = e2e.replace(/await page\.evaluate\(\(\) => \{ window\.__PHASER_GAME__\.scene\.scenes\.find\(s => s\.scene\.key === 'MenuScene'\)\.startGame\(1\); \}\);/g, "await page.mouse.click(page.viewportSize().width / 2 - 300, page.viewportSize().height / 2 + 100);");

fs.writeFileSync('tests/e2e/run-e2e.cjs', e2e);
