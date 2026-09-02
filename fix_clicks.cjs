const fs = require('fs');

let e2e = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf-8');
e2e = e2e.replace(/await page\.mouse\.click\(vpNormal\.width \/ 2 - 120, vpNormal\.height \/ 2 \+ 100\);/g, "await page.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene').startGame(1); });");
e2e = e2e.replace(/await page\.mouse\.click\(vp\.width \/ 2 - 120, vp\.height \/ 2 \+ 100\);/g, "await page.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene').startGame(1); });");

fs.writeFileSync('tests/e2e/run-e2e.cjs', e2e);
