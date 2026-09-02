const fs = require('fs');

let e2e = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf-8');
e2e = e2e.replace(/gs\.player\.value = 229;/g, `
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);
        gs.player.head.setPosition(0, 0);
        gs.enemies.forEach(e => e.destroy());
        gs.enemies = [];
        gs.player.value = 229;
`);
e2e = e2e.replace(/gs\.player\.value = 300;/g, `
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);
        gs.player.head.setPosition(0, 0);
        gs.enemies.forEach(e => e.destroy());
        gs.enemies = [];
        gs.player.value = 300;
`);
e2e = e2e.replace(/gs\.player\.value = 301;/g, `
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);
        gs.player.head.setPosition(0, 0);
        gs.enemies.forEach(e => e.destroy());
        gs.enemies = [];
        gs.player.value = 301;
`);

// also fix Level 4 tests!
e2e = e2e.replace(/gs\.player\.value = 309;/g, `
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);
        gs.player.head.setPosition(0, 0);
        gs.enemies.forEach(e => e.destroy());
        gs.enemies = [];
        gs.player.value = 309;
`);
e2e = e2e.replace(/gs\.player\.value = 310;/g, `
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);
        gs.player.head.setPosition(0, 0);
        gs.enemies.forEach(e => e.destroy());
        gs.enemies = [];
        gs.player.value = 310;
`);
e2e = e2e.replace(/gs\.player\.value = 400;/g, `
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);
        gs.player.head.setPosition(0, 0);
        gs.enemies.forEach(e => e.destroy());
        gs.enemies = [];
        gs.player.value = 400;
`);
e2e = e2e.replace(/gs\.player\.value = 401;/g, `
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);
        gs.player.head.setPosition(0, 0);
        gs.enemies.forEach(e => e.destroy());
        gs.enemies = [];
        gs.player.value = 401;
`);


fs.writeFileSync('tests/e2e/run-e2e.cjs', e2e);
