const fs = require('fs');

let e2e = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf-8');
e2e = e2e.replace(/await adPage\.goto\(baseURL \+ "\?debug=1&e2e=1"\);/, "adPage.on('console', msg => console.log('AD PAGE:', msg.text()));\n    await adPage.goto(baseURL + '?debug=1&e2e=1', { waitUntil: 'networkidle' });");

fs.writeFileSync('tests/e2e/run-e2e.cjs', e2e);
