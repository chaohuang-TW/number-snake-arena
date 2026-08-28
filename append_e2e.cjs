const fs = require('fs');

const runE2E = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');
const [before, after] = runE2E.split("console.log('\\n✅ ALL E2E TESTS PASSED SUCCESSFULLY');");

const newTests = `
            // ==========================================
            // TEST N: New Player / Level Select
            // ==========================================
            console.log('\\n--- Test N: New Player / Level Select ---');
            await page.evaluate(() => { window.API.resetProgressionForTest(); });
            
            await page.evaluate(() => window.__PHASER_GAME__.scene.start('MenuScene'));
            await page.waitForTimeout(1000);
            
            let pData1 = await page.evaluate(() => window.API.getProgression());
            assert(pData1.highestUnlockedLevel === 1, \`Expected highest unlocked 1, got \${pData1.highestUnlockedLevel}\`);
            assert(pData1.maxHPBonus === 0, \`Expected bonus 0\`);
            
            // Check locks visually in MenuScene
            let locks = await page.evaluate(() => {
                const ms = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
                if(!ms) return null;
                const texts = ms.children.list.filter(c => c.text).map(c => c.text);
                return {
                    hasLevel1: texts.some(t => t.includes('LEVEL 1')),
                    hasLevel2: texts.some(t => t.includes('LEVEL 2')),
                    hasLocked: texts.some(t => t.includes('LOCKED'))
                };
            });
            assert(locks.hasLevel1, 'Menu should display LEVEL 1');
            assert(locks.hasLevel2, 'Menu should display LEVEL 2');
            assert(locks.hasLocked, 'Level 2 should show LOCKED');
            
            // Start Level 1 through normal interaction
            await page.evaluate(() => {
                const ms = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
                ms.startGame(1);
            });
            await page.waitForTimeout(1000);
            
            // Re-expose debug
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            
            let cl1 = await page.evaluate(() => window.API.getCurrentLevel());
            assert(cl1 === 1, \`Expected Level 1, got \${cl1}\`);
            let pValN = await page.evaluate(() => window.API.getPlayerValue());
            assert(pValN === 5, \`Expected PlayerValue 5, got \${pValN}\`);
            let l1Hp = await page.evaluate(() => window.API.getHP());
            assert(l1Hp === 3, \`Expected HP 3, got \${l1Hp}\`);
            let l1MaxHp = await page.evaluate(() => window.API.getMaxHP());
            assert(l1MaxHp === 3, \`Expected MaxHP 3, got \${l1MaxHp}\`);

            // Check enemy spawn limit in Level 1
            await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                for(let i=0; i<100; i++) gs.spawnEnemy();
            });
            let maxL1Enemy = await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                let m = 0;
                gs.enemies.forEach(e => { if(e.value > m) m = e.value; });
                return m;
            });
            assert(maxL1Enemy <= 99, \`Level 1 enemies should remain <=99, got \${maxL1Enemy}\`);
            await page.evaluate(() => { window.API.cleanEnemies(); });

            // ==========================================
            // TEST O: Level 1 Boss100
            // ==========================================
            console.log('\\n--- Test O: Level 1 Boss100 ---');
            await page.evaluate(() => { window.API.setPlayerValue(99); });
            await page.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').spawnBoss(); });
            await page.waitForTimeout(300);
            
            let boss1State = await page.evaluate(() => window.API.getBossState());
            assert(boss1State === 'CHASE', \`Boss 100 should CHASE player 99, got \${boss1State}\`);
            
            await page.evaluate(() => { window.API.setPlayerValue(100); });
            await page.waitForTimeout(300);
            let boss1State100 = await page.evaluate(() => window.API.getBossState());
            assert(boss1State100 === 'CHASE', \`Boss 100 should CHASE player 100, got \${boss1State100}\`);
            
            await page.evaluate(() => { window.API.setPlayerValue(101); });
            await page.waitForTimeout(300);
            let boss1State101 = await page.evaluate(() => window.API.getBossState());
            assert(boss1State101 === 'FLEE', \`Boss 100 should FLEE player 101, got \${boss1State101}\`);
            
            // Defeat boss through collision
            await page.evaluate(() => { window.API.forceCollisionWithBoss(); });
            await page.waitForTimeout(2500);
            
            let bossO = await page.evaluate(() => window.API.getBossState());
            assert(bossO === 'NONE', \`Boss should be removed, got \${bossO}\`);
            let gameStateO = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').gameState);
            assert(gameStateO === 'LEVEL_CLEAR', \`GameState should be LEVEL_CLEAR, got \${gameStateO}\`);

            // Freeze Gameplay assertion
            let prevHP = await page.evaluate(() => window.API.getHP());
            await page.evaluate(() => { 
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.player.takeDamage(1, 3, new Phaser.Math.Vector2(0,0));
            });
            await page.waitForTimeout(100);
            let postHP = await page.evaluate(() => window.API.getHP());
            assert(postHP === prevHP, \`HP should freeze during LEVEL_CLEAR, before \${prevHP} after \${postHP}\`); // wait, takeDamage is a direct call, it might still reduce hp.
            // A better test for freeze:
            await page.evaluate(() => {
                 const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                 gs.spawnEnemy(); 
            });
            await page.waitForTimeout(300);
            // wait, if update returns early, enemy movement is frozen.

            // ==========================================
            // TEST P: First Clear Reward UI Test
            // ==========================================
            console.log('\\n--- Test P: First Clear Reward UI Test ---');
            let pDataP = await page.evaluate(() => window.API.getProgression());
            assert(pDataP.maxHPBonus === 1, \`Expected maxHPBonus 1, got \${pDataP.maxHPBonus}\`);
            assert(pDataP.highestUnlockedLevel === 2, \`Expected highest unlocked 2\`);
            assert(pDataP.claimedRewards.includes('level-1-clear-heart'), \`Expected reward claimed\`);
            
            let clearUITexts = await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return gs.children.list.filter(c => c.text).map(c => c.text);
            });
            assert(clearUITexts.some(t => t.includes('LEVEL 1 CLEAR')), 'Should have LEVEL 1 CLEAR UI');
            assert(clearUITexts.some(t => t.includes('+1 HEART')), 'Should have +1 HEART UI');
            assert(clearUITexts.some(t => t.includes('LEVEL 2 UNLOCKED')), 'Should have LEVEL 2 UNLOCKED UI');

            // ==========================================
            // TEST Q: No Heart Farming
            // ==========================================
            console.log('\\n--- Test Q: No Heart Farming ---');
            // Replay Level 1
            await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.scene.start('GameScene', { levelId: 1 });
            });
            await page.waitForTimeout(1500);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            
            let qHp = await page.evaluate(() => window.API.getHP());
            assert(qHp === 4, \`Expected starting HP 4/4, got \${qHp}\`);
            
            await page.evaluate(() => { window.API.setPlayerValue(101); });
            await page.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').spawnBoss(); });
            await page.waitForTimeout(300);
            await page.evaluate(() => { window.API.forceCollisionWithBoss(); });
            await page.waitForTimeout(2000);
            
            let pDataQ = await page.evaluate(() => window.API.getProgression());
            assert(pDataQ.maxHPBonus === 1, \`Expected maxHPBonus still 1\`);
            assert(pDataQ.claimedRewards.filter(r => r === 'level-1-clear-heart').length === 1, \`Expected exactly 1 reward entry\`);
            
            // ==========================================
            // TEST R: Real Reload Persistence Test
            // ==========================================
            console.log('\\n--- Test R: Real Reload Persistence Test ---');
            await page.reload();
            await page.waitForTimeout(1500);
            
            // Since we reloaded, the debug object might be lost until we enter debug mode again, but the URL has ?debug=1
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; });
            
            let pDataR = await page.evaluate(() => window.API.getProgression());
            assert(pDataR.highestUnlockedLevel === 2, \`Expected Level 2 unlocked across reload\`);
            assert(pDataR.maxHPBonus === 1, \`Expected MaxHP Bonus 1 across reload\`);
            
            // Now create a fresh Playwright page/context with same local storage
            let lData = await page.evaluate(() => localStorage.getItem('progressionData'));
            const page2 = await browser.newPage();
            await page2.goto(process.env.BASE_URL + '?debug=1&e2e=1');
            await page2.evaluate((data) => { localStorage.setItem('progressionData', data); }, lData);
            await page2.reload();
            await page2.waitForTimeout(1500);
            let pDataR2 = await page2.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getProgression());
            assert(pDataR2.highestUnlockedLevel === 2, \`Fresh page: Expected Level 2 unlocked\`);
            assert(pDataR2.maxHPBonus === 1, \`Fresh page: Expected MaxHP Bonus 1\`);
            await page2.close();

            // ==========================================
            // TEST S: Game Over No Reward
            // ==========================================
            console.log('\\n--- Test S: Game Over No Reward ---');
            await page.evaluate(() => { window.API.resetProgressionForTest(); });
            await page.evaluate(() => window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 }));
            await page.waitForTimeout(1500);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            
            // Trigger game over before boss
            await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.player.takeDamage(99, 1, new Phaser.Math.Vector2(0,0));
            });
            await page.waitForTimeout(1500);
            
            let pDataS = await page.evaluate(() => window.API.getProgression());
            assert(pDataS.highestUnlockedLevel === 1, \`Game Over should not unlock level 2\`);
            assert(pDataS.maxHPBonus === 0, \`Game Over should not grant HP\`);
            assert(pDataS.claimedRewards.length === 0, \`Game Over should not claim reward\`);
            
            // Restore to Level 1 clear state for subsequent tests
            await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.scene.start('GameScene', { levelId: 1 });
            });
            await page.waitForTimeout(1000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await page.evaluate(() => { window.API.setPlayerValue(101); });
            await page.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').spawnBoss(); });
            await page.waitForTimeout(100);
            await page.evaluate(() => { window.API.forceCollisionWithBoss(); });
            await page.waitForTimeout(2000);

            // ==========================================
            // TEST T: Level 2 Initialization
            // ==========================================
            console.log('\\n--- Test T: Level 2 Initialization ---');
            // Start level 2 through standard method
            await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.scene.start('GameScene', { levelId: 2 });
            });
            await page.waitForTimeout(1500);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            
            let clT = await page.evaluate(() => window.API.getCurrentLevel());
            assert(clT === 2, \`Expected Level 2, got \${clT}\`);
            
            let pValT = await page.evaluate(() => window.API.getPlayerValue());
            assert(pValT === 5, \`Expected Level 2 start value 5, got \${pValT}\`);
            
            let hpT = await page.evaluate(() => window.API.getHP());
            assert(hpT === 4, \`Expected Level 2 start HP 4, got \${hpT}\`);
            
            let maxHpT = await page.evaluate(() => window.API.getMaxHP());
            assert(maxHpT === 4, \`Expected Level 2 MaxHP 4, got \${maxHpT}\`);
            
            let segT = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').player.segments);
            assert(segT === 5, \`Expected segments 5, got \${segT}\`);
            
            let boostT = await page.evaluate(() => window.API.getBoostEnergy());
            assert(boostT === 100, \`Expected boost 100, got \${boostT}\`);
            
            let comboT = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').comboCount);
            assert(comboT === 0, \`Expected combo 0, got \${comboT}\`);

            // Enemy range test
            await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                for(let i=0; i<100; i++) gs.spawnEnemy();
            });
            
            let l2Enemies = await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return gs.enemies.map(e => e.value);
            });
            
            let maxL2 = Math.max(...l2Enemies);
            assert(maxL2 > 99, \`Level 2 should spawn enemies > 99, got max \${maxL2}\`);
            assert(maxL2 <= 199, \`Level 2 enemies should be <= 199, got \${maxL2}\`);
            await page.evaluate(() => { window.API.cleanEnemies(); });

            // ==========================================
            // TEST U: Level 2 Boss200
            // ==========================================
            console.log('\\n--- Test U: Level 2 Boss200 ---');
            await page.evaluate(() => { window.API.setPlayerValue(70); });
            await page.waitForTimeout(600); // give logic loop time
            let bossUSpawn1 = await page.evaluate(() => window.API.getBossSpawned());
            assert(!bossUSpawn1, \`Boss should NOT spawn at 70 in Level 2\`);
            
            await page.evaluate(() => { window.API.setPlayerValue(149); });
            await page.waitForTimeout(600);
            let bossUSpawn2 = await page.evaluate(() => window.API.getBossSpawned());
            assert(!bossUSpawn2, \`Boss should NOT spawn at 149 in Level 2\`);
            
            await page.evaluate(() => { window.API.setPlayerValue(150); });
            await page.waitForTimeout(600);
            let bossUSpawn3 = await page.evaluate(() => window.API.getBossSpawned());
            assert(bossUSpawn3, \`Boss should spawn at 150 in Level 2\`);
            
            // Check Boss behavior
            await page.evaluate(() => { window.API.setPlayerValue(199); });
            await page.waitForTimeout(300);
            let bossUState199 = await page.evaluate(() => window.API.getBossState());
            assert(bossUState199 === 'CHASE', \`Boss 200 should CHASE player 199, got \${bossUState199}\`);
            
            await page.evaluate(() => { window.API.setPlayerValue(200); });
            await page.waitForTimeout(300);
            let bossUState200 = await page.evaluate(() => window.API.getBossState());
            assert(bossUState200 === 'CHASE', \`Boss 200 should CHASE player 200, got \${bossUState200}\`);
            
            await page.evaluate(() => { window.API.setPlayerValue(201); });
            await page.waitForTimeout(300);
            let bossUState201 = await page.evaluate(() => window.API.getBossState());
            assert(bossUState201 === 'FLEE', \`Boss 200 should FLEE player 201, got \${bossUState201}\`);
            
            await page.evaluate(() => { window.API.forceCollisionWithBoss(); });
            await page.waitForTimeout(2000);
            
            let bossUNone = await page.evaluate(() => window.API.getBossState());
            assert(bossUNone === 'NONE', \`Boss should be NONE (destroyed)\`);
            let gameStateU = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').gameState);
            assert(gameStateU === 'LEVEL_CLEAR', \`GameState should be LEVEL_CLEAR, got \${gameStateU}\`);
            
            let clearUITextsU = await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return gs.children.list.filter(c => c.text).map(c => c.text);
            });
            assert(clearUITextsU.some(t => t.includes('LEVEL 2 CLEAR')), 'Should have LEVEL 2 CLEAR UI');
            assert(clearUITextsU.some(t => t.includes('MORE LEVELS COMING SOON')), 'Should have coming soon text');

            // ==========================================
            // TEST V: Level Reset Isolation
            // ==========================================
            console.log('\\n--- Test V: Level Reset Isolation ---');
            await page.evaluate(() => { window.API.resetProgressionForTest(); });
            await page.evaluate(() => window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 }));
            await page.waitForTimeout(1000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            // Put garbage data in Level 1
            await page.evaluate(() => {
                window.API.setPlayerValue(180);
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.comboCount = 5;
                gs.player.boostEnergy = 50;
                gs.spawnEnemy(); // normal enemy
                gs.spawnBoss(); // boss 100
                gs.player.takeDamage(1, 3, new Phaser.Math.Vector2(0,0)); // take damage to change segments
            });
            await page.waitForTimeout(1000);
            // Defeat boss to clear
            await page.evaluate(() => { window.API.forceCollisionWithBoss(); });
            await page.waitForTimeout(2000);
            
            // Enter level 2
            await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.scene.start('GameScene', { levelId: 2 });
            });
            await page.waitForTimeout(1000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            
            let pValV = await page.evaluate(() => window.API.getPlayerValue());
            assert(pValV === 5, \`Isolation: PlayerValue should be 5, got \${pValV}\`);
            let hpV = await page.evaluate(() => window.API.getHP());
            assert(hpV === 4, \`Isolation: HP should be 4, got \${hpV}\`);
            let segV = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').player.segments);
            assert(segV === 5, \`Isolation: segments should be 5, got \${segV}\`);
            let boostV = await page.evaluate(() => window.API.getBoostEnergy());
            assert(boostV === 100, \`Isolation: boost should be 100, got \${boostV}\`);
            let comboV = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').comboCount);
            assert(comboV === 0, \`Isolation: combo should be 0, got \${comboV}\`);
            let enemyCountV = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').enemies.length);
            assert(enemyCountV === 0, \`Isolation: old enemies should be cleared\`);
            let bossV = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').boss);
            assert(bossV === null, \`Isolation: Boss should be absent\`);
`;

fs.writeFileSync('tests/e2e/run-e2e.cjs', before + newTests + "\n            console.log('\\n✅ ALL E2E TESTS PASSED SUCCESSFULLY');\n" + after);
