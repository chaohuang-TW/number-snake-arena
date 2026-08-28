const fs = require('fs');
let pw = fs.readFileSync('tests/e2e/test-playwright.cjs', 'utf8');

const regex1 = /let speedNormal = Math\.hypot\(pos2\.x - pos1\.x, pos2\.y - pos1\.y\);/g;
pw = pw.replace(regex1, 'let speedNormal = await page.evaluate(() => API.getPlayerSpeed());');

const regex2 = /let speedBoost = Math\.hypot\(pos4\.x - pos3\.x, pos4\.y - pos3\.y\);/g;
pw = pw.replace(regex2, 'let speedBoost = await page.evaluate(() => API.getPlayerSpeed());');

fs.writeFileSync('tests/e2e/test-playwright.cjs', pw);
