const fs = require('fs');

let e2e = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf-8');

const newTests = `
    // --- Test AD: FOUR LEVEL SELECT ---
    console.log('\\n--- Test AD: FOUR LEVEL SELECT ---');
    const adContext = await browser.newContext();
    const adPage = await adContext.newPage();
    await adPage.goto(TEST_URL);
    await adPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
    await adPage.evaluate(() => { localStorage.clear(); });
    await adPage.reload();
    await adPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
    await adPage.waitForTimeout(1000); // wait for menu to render
    const adMenuText = await adPage.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
        return scene.levelCards.map(c => c.list.find(go => go.type === 'Text' && go.text.includes('LEVEL')).text);
    });
    const adLockText = await adPage.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
        return scene.levelCards.map(c => c.list.find(go => go.type === 'Text' && go.text.includes('LOCKED')) ? 'LOCKED' : 'UNLOCKED');
    });
    if (adMenuText.join(',') !== 'LEVEL 1,LEVEL 2,LEVEL 3,LEVEL 4') {
        console.error('❌ ASSERT FAILED: Four levels not visible', adMenuText);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: Menu displays LEVEL 1, 2, 3, 4');
    }
    if (adLockText.join(',') !== 'UNLOCKED,LOCKED,LOCKED,LOCKED') {
        console.error('❌ ASSERT FAILED: Lock progression incorrect', adLockText);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: Fresh player L1 unlocked, rest locked');
    }

    // --- Test AE: LEVEL 2 FIRST CLEAR REWARD ---
    console.log('\\n--- Test AE: LEVEL 2 FIRST CLEAR REWARD ---');
    await adPage.evaluate(() => {
        localStorage.setItem('number_snake_progression', JSON.stringify({
            version: 1, highestUnlockedLevel: 2, maxHPBonus: 1, claimedRewards: ["level-1-clear-heart"], bestScoreByLevel: {}
        }));
    });
    await adPage.reload();
    await adPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
    await adPage.waitForTimeout(500);
    await adPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene').startGame(2); });
    await adPage.waitForTimeout(500);
    
    let aeInitOk = await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs.player.value === 5 && gs.player.hp === 4 && gs.levelId === 2;
    });
    if (!aeInitOk) {
        console.error('❌ ASSERT FAILED: Level 2 initial state wrong');
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: Level 2 Value=5, HP=4');
    }
    
    // Simulate Game Over before clear to ensure no progression (Task 37)
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.hp = 0; // die
        gs.handleEnemyCollision(gs.player, { body: { y: 0, x: 0}, value: 9999, destroy: ()=>{} }); // force death
    });
    await adPage.waitForTimeout(500);
    let aeProg = await adPage.evaluate(() => JSON.parse(localStorage.getItem('number_snake_progression')));
    if (aeProg.highestUnlockedLevel !== 2 || aeProg.maxHPBonus !== 1) {
        console.error('❌ ASSERT FAILED: Game Over granted progression!');
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: Game Over on L2 did not grant reward');
    }

    // Restart L2 and clear it
    await adPage.reload();
    await adPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
    await adPage.waitForTimeout(500);
    await adPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene').startGame(2); });
    await adPage.waitForTimeout(500);
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.levelClear();
    });
    await adPage.waitForTimeout(2000);
    
    let aeUI = await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const texts = gs.children.list.filter(c => c.type === 'Text').map(t => t.text);
        return { texts };
    });
    aeProg = await adPage.evaluate(() => JSON.parse(localStorage.getItem('number_snake_progression')));
    
    if (aeProg.highestUnlockedLevel !== 3 || aeProg.maxHPBonus !== 2 || !aeProg.claimedRewards.includes('level-2-clear-heart')) {
        console.error('❌ ASSERT FAILED: L2 Clear did not grant proper progression', aeProg);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: L2 Clear granted +1 maxHPBonus and unlocked L3');
    }
    if (!aeUI.texts.find(t => t.includes('+1 HEART')) || !aeUI.texts.find(t => t.includes('LEVEL 3 UNLOCKED'))) {
        console.error('❌ ASSERT FAILED: L2 Clear UI missing elements', aeUI.texts);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: L2 Clear UI displayed +1 HEART and LEVEL 3 UNLOCKED');
    }

    // Click NEXT LEVEL to test transition
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const nextBtn = gs.children.list.find(c => c.type === 'Text' && c.text === 'NEXT LEVEL');
        nextBtn.emit('pointerdown');
    });
    await adPage.waitForTimeout(1000);
    let agInit = await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            lvl: gs.levelId, val: gs.player.value, hp: gs.player.hp, seg: gs.player.segments,
            boss: gs.boss, normalCount: gs.enemies.length
        };
    });

    // --- Test AF: LEVEL 2 NO HEART FARMING ---
    console.log('\\n--- Test AF: LEVEL 2 NO HEART FARMING ---');
    await adPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').scene.start('GameScene', {levelId: 2}); });
    await adPage.waitForTimeout(500);
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.levelClear();
    });
    await adPage.waitForTimeout(1500);
    let afProg = await adPage.evaluate(() => JSON.parse(localStorage.getItem('number_snake_progression')));
    if (afProg.maxHPBonus !== 2) {
        console.error('❌ ASSERT FAILED: L2 Duplicate clear granted heart!', afProg);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: L2 Duplicate clear granted 0 additional hearts');
    }

    // --- Test AG: LEVEL 3 INITIALIZATION ---
    console.log('\\n--- Test AG: LEVEL 3 INITIALIZATION ---');
    if (agInit.lvl !== 3 || agInit.val !== 5 || agInit.hp !== 5 || agInit.seg !== 5 || agInit.boss !== null || agInit.normalCount > 38) {
        console.error('❌ ASSERT FAILED: Level 3 initialized incorrectly', agInit);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: Level 3 initialized correctly (Value5, HP5, boss null)');
    }

    // --- Test AH: LEVEL 3 BOSS300 ---
    console.log('\\n--- Test AH: LEVEL 3 BOSS300 ---');
    await adPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').scene.start('GameScene', {levelId: 3}); });
    await adPage.waitForTimeout(500);
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.value = 229;
    });
    await adPage.waitForTimeout(500);
    let ahBoss229 = await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs.boss !== null;
    });
    if (ahBoss229) { console.error('❌ ASSERT FAILED: Boss300 spawned early'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss300 not spawned at 229');

    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.value = 230;
    });
    await adPage.waitForTimeout(500);
    let ahBossState = await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        if (!gs.boss) return null;
        return { isFleeing: gs.boss.isFleeing };
    });
    if (!ahBossState) { console.error('❌ ASSERT FAILED: Boss300 did not spawn at 230'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss300 spawned at 230');

    if (ahBossState && ahBossState.isFleeing) { console.error('❌ ASSERT FAILED: Boss300 fleeing at 230'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss300 chasing at 230');

    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.value = 300;
    });
    await adPage.waitForTimeout(500);
    ahBossState = await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return { isFleeing: gs.boss.isFleeing };
    });
    if (ahBossState.isFleeing) { console.error('❌ ASSERT FAILED: Boss300 fleeing at 300'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss300 chasing at 300');

    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.value = 301;
    });
    await adPage.waitForTimeout(500);
    ahBossState = await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return { isFleeing: gs.boss.isFleeing };
    });
    if (!ahBossState.isFleeing) { console.error('❌ ASSERT FAILED: Boss300 NOT fleeing at 301'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss300 fleeing at 301');

    // --- Test AI: LEVEL 3 REWARD + LEVEL 4 UNLOCK ---
    console.log('\\n--- Test AI: LEVEL 3 REWARD + LEVEL 4 UNLOCK ---');
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.handleBossCollision(); // This triggers win
    });
    await adPage.waitForTimeout(2000);
    let aiProg = await adPage.evaluate(() => JSON.parse(localStorage.getItem('number_snake_progression')));
    if (aiProg.highestUnlockedLevel !== 4 || aiProg.maxHPBonus !== 3 || !aiProg.claimedRewards.includes('level-3-clear-heart')) {
        console.error('❌ ASSERT FAILED: L3 Clear did not grant proper progression', aiProg);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: L3 Clear granted +1 maxHPBonus and unlocked L4');
    }
    
    // Test GAME OVER on L4 does not grant progression
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const nextBtn = gs.children.list.find(c => c.type === 'Text' && c.text === 'NEXT LEVEL');
        nextBtn.emit('pointerdown');
    });
    await adPage.waitForTimeout(1000);
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.hp = 0; gs.gameOver();
    });
    await adPage.waitForTimeout(500);
    aiProg = await adPage.evaluate(() => JSON.parse(localStorage.getItem('number_snake_progression')));
    if (aiProg.highestUnlockedLevel !== 4 || aiProg.maxHPBonus !== 3) {
        console.error('❌ ASSERT FAILED: L4 Game Over granted progression!', aiProg);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: Game Over on L4 did not grant progression');
    }

    // --- Test AJ: LEVEL 4 INITIALIZATION ---
    console.log('\\n--- Test AJ: LEVEL 4 INITIALIZATION ---');
    await adPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').scene.start('GameScene', {levelId: 4}); });
    await adPage.waitForTimeout(1000);
    let ajInit = await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            lvl: gs.levelId, val: gs.player.value, hp: gs.player.hp, maxHp: gs.player.maxHP, seg: gs.player.segments,
            boss: gs.boss, normalCount: gs.enemies.length
        };
    });
    if (ajInit.lvl !== 4 || ajInit.val !== 5 || ajInit.hp !== 6 || ajInit.seg !== 5 || ajInit.boss !== null || ajInit.normalCount > 38) {
        console.error('❌ ASSERT FAILED: Level 4 initialized incorrectly', ajInit);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: Level 4 initialized correctly (Value5, HP6, boss null)');
    }

    // --- Test AK: LEVEL 4 BOSS400 ---
    console.log('\\n--- Test AK: LEVEL 4 BOSS400 ---');
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.value = 309;
    });
    await adPage.waitForTimeout(500);
    let akBoss309 = await adPage.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').boss !== null);
    if (akBoss309) { console.error('❌ ASSERT FAILED: Boss400 spawned early'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss400 not spawned at 309');

    await adPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').player.value = 310; });
    await adPage.waitForTimeout(500);
    let akBoss310 = await adPage.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').boss !== null);
    if (!akBoss310) { console.error('❌ ASSERT FAILED: Boss400 did not spawn at 310'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss400 spawned at 310');

    await adPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').player.value = 400; });
    await adPage.waitForTimeout(500);
    let akFlee400 = await adPage.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').boss.isFleeing);
    if (akFlee400) { console.error('❌ ASSERT FAILED: Boss400 fleeing at 400'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss400 chasing at 400');

    await adPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').player.value = 401; });
    await adPage.waitForTimeout(500);
    let akFlee401 = await adPage.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').boss.isFleeing);
    if (!akFlee401) { console.error('❌ ASSERT FAILED: Boss400 NOT fleeing at 401'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss400 fleeing at 401');

    // --- Test AL: FINAL COMPLETION ---
    console.log('\\n--- Test AL: FINAL COMPLETION ---');
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.handleBossCollision(); // Trigger win
    });
    await adPage.waitForTimeout(2000);
    let alUI = await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs.children.list.filter(c => c.type === 'Text').map(t => t.text);
    });
    if (!alUI.find(t => t.includes('ALL LEVELS CLEARED')) || !alUI.find(t => t.includes('NUMBER MASTER'))) {
        console.error('❌ ASSERT FAILED: Final clear UI missing elements', alUI);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: Final clear UI displayed ALL LEVELS CLEARED');
    }
    if (alUI.find(t => t.includes('+1 HEART')) || alUI.find(t => t.includes('NEXT LEVEL'))) {
        console.error('❌ ASSERT FAILED: Final clear UI contains +1 HEART or NEXT LEVEL', alUI);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: Final clear UI lacks NEXT LEVEL and HEART');
    }
    
    let alProg = await adPage.evaluate(() => JSON.parse(localStorage.getItem('number_snake_progression')));
    if (alProg.highestUnlockedLevel !== 4 || alProg.maxHPBonus !== 3) {
        console.error('❌ ASSERT FAILED: Final clear changed progression incorrectly', alProg);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: Progression capped at highestUnlockedLevel=4');
    }

    await adContext.close();
`;

e2e = e2e.replace(/console\.log\(`\\n=== FINAL SCRIPT RESULTS ===`\);/, newTests + "\n    console.log(`\\n=== FINAL SCRIPT RESULTS ===`);");

fs.writeFileSync('tests/e2e/run-e2e.cjs', e2e);
