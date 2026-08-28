const fs = require('fs');
let pw = fs.readFileSync('tests/e2e/test-playwright.cjs', 'utf8');

const regex = /scene\.enemies = \[\];/;
const replacement = `scene.enemies = [];
                    scene.comboCount = 0;
                    scene.player.value = 5;
                    scene.player.hp = 3;
                    scene.player.segments = 5;`;

pw = pw.replace(regex, replacement);
fs.writeFileSync('tests/e2e/test-playwright.cjs', pw);
