const fs = require('fs');

let code = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

code = code.replace(
    /await page\.mouse\.click\(vpNormal\.width \/ 2, vpNormal\.height \/ 2 \+ 60\);/g,
    `await page.mouse.click(vpNormal.width / 2 - 120, vpNormal.height / 2 + 100);`
);
code = code.replace(
    /await page\.mouse\.click\(vp\.width \/ 2, vp\.height \/ 2 \+ 60\);/g,
    `await page.mouse.click(vp.width / 2 - 120, vp.height / 2 + 100);`
);
fs.writeFileSync('tests/e2e/run-e2e.cjs', code);
