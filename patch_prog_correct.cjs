const fs = require('fs');
let code = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

const newTests = `
            console.log('\\n--- Test N: New Player Progression ---');
            await page.evaluate(() => { window.API.resetProgressionForTest(); });
            let pData1 = await page.evaluate(() => window.API.getProgression());
            assert(pData1.highestUnlockedLevel === 1, \`Expected highest unlocked 1, got \${pData1.highestUnlockedLevel}\`);
            assert(pData1.maxHPBonus === 0, \`Expected bonus 0, got \${pData1.maxHPBonus}\`);
            
            // Go to menu and check locks
            await page.evaluate(() => window.__PHASER_GAME__.scene.start('MenuScene'));
            await page.waitForTimeout(1500);
            
            // Start level 1
            await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene').startGame(1));
            await page.waitForTimeout(1500);
            
            // Expose debug API again since it might be reset
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            
            let l1Hp = await page.evaluate(() => window.API.getMaxHP());
            assert(l1Hp === 3, \`Expected Level 1 MaxHP 3, got \${l1Hp}\`);
            let cl1 = await page.evaluate(() => window.API.getCurrentLevel());
            assert(cl1 === 1, \`Expected Level 1, got \${cl1}\`);
            
            console.log('\\n--- Test O: Boss 100 & Level 1 Clear ---');
            await page.evaluate(() => { window.API.setPlayerValue(99); });
            await page.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').spawnBoss(); });
            await page.waitForTimeout(300);
            
            let boss1State = await page.evaluate(() => window.API.getBossState());
            assert(boss1State === 'CHASE', \`Boss 100 should CHASE player 99, got \${boss1State}\`);
            
            await page.evaluate(() => { window.API.setPlayerValue(101); });
            await page.waitForTimeout(300);
            let boss2State = await page.evaluate(() => window.API.getBossState());
            assert(boss2State === 'FLEE', \`Boss 100 should FLEE player 101, got \${boss2State}\`);
            
            // Defeat boss
            await page.evaluate(() => { window.API.forceLevelClear(); });
            await page.waitForTimeout(3000); // Wait for animations
            
            let gameStateClear = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').gameState);
            assert(gameStateClear === 'LEVEL_CLEAR', \`GameState should be LEVEL_CLEAR, got \${gameStateClear}\`);
            
            console.log('\\n--- Test P: Reward & Persistence ---');
            let pData2 = await page.evaluate(() => window.API.getProgression());
            assert(pData2.maxHPBonus === 1, \`Expected maxHPBonus 1, got \${pData2.maxHPBonus}\`);
            assert(pData2.highestUnlockedLevel === 2, \`Expected highest unlocked 2, got \${pData2.highestUnlockedLevel}\`);
            assert(pData2.claimedRewards.includes('level-1-clear-heart'), \`Expected reward claimed\`);
            
            console.log('\\n--- Test Q: No Farming & Replay ---');
            // Replay level 1
            await page.evaluate(() => window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 }));
            await page.waitForTimeout(1500);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); window.API.forceLevelClear(); });
            await page.waitForTimeout(3000);
            
            let pData3 = await page.evaluate(() => window.API.getProgression());
            assert(pData3.maxHPBonus === 1, \`Expected maxHPBonus still 1, got \${pData3.maxHPBonus}\`);
            assert(pData3.claimedRewards.length === 1, \`Expected 1 reward, got \${pData3.claimedRewards.length}\`);
            
            console.log('\\n--- Test R: Level 2 & Boss 200 ---');
            await page.evaluate(() => window.__PHASER_GAME__.scene.start('GameScene', { levelId: 2 }));
            await page.waitForTimeout(1500);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            
            let l2Hp = await page.evaluate(() => window.API.getMaxHP());
            assert(l2Hp === 4, \`Expected Level 2 MaxHP 4, got \${l2Hp}\`);
            let l2HpCurrent = await page.evaluate(() => window.API.getHP());
            assert(l2HpCurrent === 4, \`Expected Level 2 current HP 4, got \${l2HpCurrent}\`);
            
            let pVal2 = await page.evaluate(() => window.API.getPlayerValue());
            assert(pVal2 === 5, \`Expected Level 2 start value 5, got \${pVal2}\`);
            
            // Boss 200 tests
            await page.evaluate(() => { window.API.setPlayerValue(199); });
            await page.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').spawnBoss(); });
            await page.waitForTimeout(300);
            
            let bossL2State1 = await page.evaluate(() => window.API.getBossState());
            assert(bossL2State1 === 'CHASE', \`Boss 200 should CHASE player 199, got \${bossL2State1}\`);
            
            await page.evaluate(() => { window.API.setPlayerValue(201); });
            await page.waitForTimeout(300);
            let bossL2State2 = await page.evaluate(() => window.API.getBossState());
            assert(bossL2State2 === 'FLEE', \`Boss 200 should FLEE player 201, got \${bossL2State2}\`);
            
            await page.evaluate(() => { window.API.forceLevelClear(); });
            await page.waitForTimeout(3000);
            let gameStateClear2 = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').gameState);
            assert(gameStateClear2 === 'LEVEL_CLEAR', \`GameState should be LEVEL_CLEAR in L2, got \${gameStateClear2}\`);
`;

code = code.replace("console.log('\\n✅ ALL E2E TESTS PASSED SUCCESSFULLY');", newTests + "\n            console.log('\\n✅ ALL E2E TESTS PASSED SUCCESSFULLY');");

fs.writeFileSync('tests/e2e/run-e2e.cjs', code);
