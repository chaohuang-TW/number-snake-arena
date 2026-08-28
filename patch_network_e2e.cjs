const fs = require('fs');

let code = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

code = code.replace(
    /if\(response\.url\(\)\.includes\('localhost'\)\) \{/,
    `if(response.url().startsWith(baseURL)) {`
);

fs.writeFileSync('tests/e2e/run-e2e.cjs', code);
