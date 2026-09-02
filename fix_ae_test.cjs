const fs = require('fs');

let e2e = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf-8');
e2e = e2e.replace(/gs\.handleEnemyCollision\(gs\.player, \{ body: \{ y: 0, x: 0\}, value: 9999, destroy: \(\)=>\(\)\} \);/g, "gs.handleEnemyCollision({ body: { y: gs.player.head.y, x: gs.player.head.x }, value: 9999, destroy: ()=>{} }, -1, 0);");

fs.writeFileSync('tests/e2e/run-e2e.cjs', e2e);
