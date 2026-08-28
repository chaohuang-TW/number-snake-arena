const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

pkg.scripts['test:e2e'] = "BASE_URL=http://localhost:3000/ node tests/e2e/run-e2e.cjs";
pkg.scripts['test:prod'] = "BASE_URL=https://chaohuang-TW.github.io/number-snake-arena/ node tests/e2e/run-e2e.cjs";

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
