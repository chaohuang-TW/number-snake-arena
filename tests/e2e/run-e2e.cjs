const { chromium } = require('playwright');

const baseURL = process.env.BASE_URL || 'http://localhost:3000/';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    let totalErrors = 0;
    let pageErrors = 0;
    let missingAssets = 0;

    page.on('pageerror', err => {
        console.error('Page Error:', err.message);
        pageErrors++;
    });
    page.on('response', response => {
        if (response.status() >= 400 && response.status() !== 999) {
            // Ignore analytics or 3rd party 404s if any
            if(response.url().startsWith(baseURL)) {
                console.error(`Asset failed: ${response.url()} (${response.status()})`);
                missingAssets++;
            }
        }
    });

    const assert = (condition, message) => {
        if (!condition) {
            console.error(`❌ ASSERT FAILED: ${message}`);
            totalErrors++;
        } else {
            console.log(`✅ ASSERT OK: ${message.split(',')[0]}`);
        }
    };

    const runTests = async () => {
        try {
            console.log('\nLaunching playwright browser for E2E testing...');
            console.log(`Base URL: ${baseURL}`); page.on("console", msg => console.log("BROWSER:", msg.text()));

            // === Testing NORMAL URL Security ===
            console.log('\n=== Testing NORMAL URL Security ===');
            await page.goto(baseURL + "?e2e=1", { waitUntil: 'networkidle' });
            await page.waitForTimeout(6000);
            
            // start game
            let vpNormal = page.viewportSize();
            await page.mouse.click(vpNormal.width / 2 - 120, vpNormal.height / 2 + 100); 
            await page.waitForTimeout(3000);
            
            for(let i=0; i<10; i++) {
                await page.keyboard.press('c');
                await page.waitForTimeout(300);
            }
            
            let e2ePVal = await page.evaluate(() => window.__E2E_READONLY__.getPlayerValue());
            let e2eBoss = await page.evaluate(() => window.__E2E_READONLY__.getBossSpawned());
            assert(e2ePVal < 25, `PlayerValue should not massively change on normal URL when pressing C, got ${e2ePVal}`);
            assert(e2eBoss === false, `Boss should not spawn unexpectedly`);
            
            let isDebugExposed = await page.evaluate(() => typeof window.__NUMBER_SNAKE_DEBUG__ !== 'undefined');
            assert(!isDebugExposed, `Debug API must be undefined on normal URL`);
            let isPhaserExposed = await page.evaluate(() => typeof window.__PHASER_GAME__ !== 'undefined');
            assert(!isPhaserExposed, `Phaser API must be undefined on normal URL`);

            // === Testing DEBUG URL Gameplay ===
            console.log('\n=== Testing DEBUG URL Gameplay ===');
            await page.goto(baseURL + '?debug=1', { waitUntil: 'networkidle' });
            await page.waitForTimeout(6000);
            
            let vp = page.viewportSize();
            await page.mouse.click(vp.width / 2 - 120, vp.height / 2 + 100); 
            await page.waitForTimeout(3000);

            let debugObj = await page.evaluate(() => typeof window.__NUMBER_SNAKE_DEBUG__);
            assert(debugObj === 'object', `__NUMBER_SNAKE_DEBUG__ must be exposed on ?debug=1, got ${debugObj}`);

            // Setup API
            await page.evaluate(() => {
                window.API = window.__NUMBER_SNAKE_DEBUG__;
                window.API.stopSpawning();
            });

            const cleanEnemies = async () => {
                await page.evaluate(() => {
                    if (window.API && window.API.hardReset) {
                        window.API.hardReset();
                    }
                });
            };
            await cleanEnemies();

            // === TEST A: Core Eating ===
            console.log('\\n--- Test A: Core Eating ---');
            await page.evaluate(() => { 
                API.getEnemies().length = 0; API.setPlayerValue(5); API.setPlayerHP(3); 
                let pos = API.getPlayerPos();
                let e = API.spawnEnemy(3, pos.x + 500, pos.y);
                API.forceCollisionWithEnemy(API.getEnemies().indexOf(e));
            });
            let pValA1 = await page.evaluate(() => API.getPlayerValue());
            let segments = await page.evaluate(() => API.getBodySegments());
            let enemiesLen = await page.evaluate(() => API.getEnemies().length);
            assert(pValA1 === 8, `Player value should be 8, got ${pValA1}`);
            assert(segments === 6, `Body segments should be 6, got ${segments}`);
            assert(enemiesLen === 0, `Enemy should be removed`);

            await cleanEnemies();
            await page.waitForTimeout(4500);
            
            await page.evaluate(() => {
                API.setPlayerValue(5);
                API.setPlayerHP(3);
                let pos = API.getPlayerPos();
                let e = API.spawnEnemy(5, pos.x + 500, pos.y);
                API.forceCollisionWithEnemy(API.getEnemies().indexOf(e));
            });
            let pValA2 = await page.evaluate(() => API.getPlayerValue());
            let hpA2 = await page.evaluate(() => API.getPlayerHP());
            assert(pValA2 === 5, `Player value should remain 5, got ${pValA2}`);
            assert(hpA2 === 2, `Player HP should be reduced to 2 by same size enemy, got ${hpA2}`);
            
            await cleanEnemies();

            // === TEST B: Role Reversal ===
            console.log('\\n--- Test B: Role Reversal ---');
            await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(3000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await cleanEnemies();

            let stateB1 = await page.evaluate(() => {
                API.setPlayerValue(10);
                let pos = API.getPlayerPos();
                let e = API.spawnEnemy(24, pos.x + 200, pos.y);
                e.update(16, pos.x, pos.y, 10); 
                return { state: e.state, dist: Math.hypot(e.body.x - pos.x, e.body.y - pos.y) };
            });
            assert(stateB1.state === 2, `Enemy state should be 2 (CHASE), got ${stateB1.state} (dist: ${stateB1.dist})`);
            await cleanEnemies();

            let stateB2 = await page.evaluate(() => {
                API.setPlayerValue(10);
                let pos = API.getPlayerPos();
                let e = API.spawnEnemy(5, pos.x + 100, pos.y);
                e.update(16, pos.x, pos.y, 10); 
                return { state: e.state, dist: Math.hypot(e.body.x - pos.x, e.body.y - pos.y) };
            });
            assert(stateB2.state === 1, `Enemy state should be 1 (FLEE), got ${stateB2.state} (dist: ${stateB2.dist})`);
            await cleanEnemies();

            // === TEST C: Damage Boundaries ===
            console.log('\n--- Test C: Damage Boundaries ---');
            await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(3000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await cleanEnemies();
            
            await page.evaluate(() => { API.setPlayerValue(10); API.setPlayerHP(3); API.spawnEnemy(14, API.getPlayerPos().x, API.getPlayerPos().y); API.forceCollisionWithEnemy(0); });
            let hpC1 = await page.evaluate(() => API.getPlayerHP());
            assert(hpC1 === 2, `HP should be 2, got ${hpC1}`);
            await cleanEnemies();
            await page.waitForTimeout(4500);

            await page.evaluate(() => { API.setPlayerValue(10); API.setPlayerHP(3); let e2 = API.spawnEnemy(24, API.getPlayerPos().x, API.getPlayerPos().y); console.log('SPAWNED e2:', e2.value, API.getEnemies().length); API.forceSpecificEnemy(e2); });
            let hpC2 = await page.evaluate(() => API.getPlayerHP());
            assert(hpC2 === 1, `HP should be 1, got ${hpC2}`);
            await cleanEnemies();
            await page.waitForTimeout(4500);

            await page.evaluate(() => { API.setPlayerValue(10); API.setPlayerHP(3); let e3 = API.spawnEnemy(26, API.getPlayerPos().x, API.getPlayerPos().y); console.log('SPAWNED e3:', e3.value, API.getEnemies().length); API.forceSpecificEnemy(e3); });
            let gStateC3 = await page.evaluate(() => API.getGameState());
            assert(gStateC3 === 'GAME_OVER', `Game state should be GAME_OVER, got ${gStateC3}`);

            // === TEST D: Boss Damage ===
            console.log('\n--- Test D: Boss Damage ---');
            await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(3000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); API.spawnBoss(); });
            
            await page.evaluate(() => { API.setPlayerValue(80); API.setPlayerHP(3); API.forceCollisionWithBoss(); });
            let hpD1 = await page.evaluate(() => API.getPlayerHP());
            let sD1 = await page.evaluate(() => API.getGameState());
            assert(hpD1 === 2, `HP should be 2, got ${hpD1}`);
            assert(sD1 === 'RUNNING', `Game state should be RUNNING, got ${sD1}`);
            await page.waitForTimeout(4500);

            await page.evaluate(() => { API.setPlayerValue(60); API.setPlayerHP(3); API.forceCollisionWithBoss(); });
            let hpD2 = await page.evaluate(() => API.getPlayerHP());
            let sD2 = await page.evaluate(() => API.getGameState());
            assert(hpD2 === 1, `HP should be 1, got ${hpD2}`);
            assert(sD2 === 'RUNNING', `Game state should be RUNNING, got ${sD2}`);
            await page.waitForTimeout(4500);

            await page.evaluate(() => { API.setPlayerValue(30); API.setPlayerHP(3); API.forceCollisionWithBoss(); });
            let sD3 = await page.evaluate(() => API.getGameState());
            assert(sD3 === 'GAME_OVER', `Game state should be GAME_OVER, got ${sD3}`);

            // === TEST E: Boss Reversal & Victory ===
            console.log('\\n--- Test E: Boss Reversal & Victory ---');
            await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(3000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); API.spawnBoss(); });
            
            await page.evaluate(() => { API.setPlayerValue(99); }); await page.waitForTimeout(300); let bossSE1 = await page.evaluate(() => API.getBossState());
            assert(bossSE1 === 'CHASE', `Boss should be CHASE, got ${bossSE1}`);
            
            await page.evaluate(() => { API.setPlayerValue(100); }); await page.waitForTimeout(300); let bossSE2 = await page.evaluate(() => API.getBossState());
            assert(bossSE2 === 'CHASE', `Boss should be CHASE, got ${bossSE2}`);
            
            await page.evaluate(() => { API.setPlayerValue(101); }); await page.waitForTimeout(300); let bossSE3 = await page.evaluate(() => API.getBossState());
            assert(bossSE3 === 'FLEE', `Boss should be FLEE, got ${bossSE3}`);
            
            await page.evaluate(() => { API.setPlayerValue(105); API.forceCollisionWithBoss(); });
            let bossSE4 = await page.evaluate(() => API.getBossState());
            let sE = await page.evaluate(() => API.getGameState());
            assert(bossSE4 === 'NONE', `Boss should be NONE (destroyed)`);
            assert(sE === 'LEVEL_CLEAR', `Game state should be LEVEL_CLEAR, got ${sE}`);

            // === TEST F: Eat Assist & Early Game ===
            console.log('\\n--- Test F: Eat Assist & Early Game ---');
            await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(3000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await cleanEnemies();
            
            await page.evaluate(() => { 
                API.setPlayerValue(30); 
                let pos = API.getPlayerPos();
                let e = API.spawnEnemy(5, pos.x + 25, pos.y); 
                API.forceCollisionWithEnemy(API.getEnemies().indexOf(e)); 
            });
            let pValF1 = await page.evaluate(() => API.getPlayerValue());
            assert(pValF1 === 35, `Player should eat enemy via assist, got ${pValF1}`);
            
            await cleanEnemies();
            await page.evaluate(() => { 
                API.setPlayerValue(20); API.setPlayerHP(3);
                let pos = API.getPlayerPos();
                let e = API.spawnEnemy(40, pos.x + 25, pos.y); 
                API.forceCollisionWithEnemy(API.getEnemies().indexOf(e)); 
            });
            let pValF2 = await page.evaluate(() => API.getPlayerValue());
            assert(pValF2 === 20, `Player should NOT eat larger enemy via assist, got ${pValF2}`);

            // === TEST G: Pause / Resume ===
            console.log('\\n--- Test G: Pause / Resume ---');
            await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(3000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; API.simulateVisibilityHidden(); });
            await page.waitForTimeout(600);
            let sG1 = await page.evaluate(() => API.getGameState());
            assert(sG1 === 'PAUSED', `Game should be PAUSED after hidden`);
            
            await page.evaluate(() => { API.simulateVisibilityVisible(); });
            await page.waitForTimeout(600);
            let sG2 = await page.evaluate(() => API.getGameState());
            assert(sG2 === 'PAUSED', `Game should remain PAUSED after visible (waiting for overlay click)`);
            
            await page.evaluate(() => {
                const pauseScene = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PauseScene');
                pauseScene.scene.resume('GameScene'); pauseScene.scene.stop();
            });
            await page.waitForTimeout(600);
            let sG3 = await page.evaluate(() => API.getGameState());
            assert(sG3 === 'RUNNING', `Game should be RUNNING after RESUME click`);

            // === TEST I: Combo Timeout ===
            console.log('\\n--- Test I: Combo Timeout ---');
            await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(3000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await cleanEnemies();
            await page.evaluate(() => { 
                API.setPlayerValue(5); 
                let pos = API.getPlayerPos();
                let e = API.spawnEnemy(1, pos.x, pos.y); 
                API.forceCollisionWithEnemy(API.getEnemies().indexOf(e)); 
            });
            let combo1 = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').comboCount);
            assert(combo1 === 1, `Combo should be 1, got ${combo1}`);
            
            await page.waitForTimeout(15000); // Wait for combo timeout
            await page.evaluate(() => { 
                let pos = API.getPlayerPos();
                let e = API.spawnEnemy(1, pos.x, pos.y); 
                API.forceCollisionWithEnemy(API.getEnemies().indexOf(e)); 
            });
            let combo2 = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').comboCount);
            assert(combo2 === 1, `Combo should restart at 1, got ${combo2}`);


            // === TEST J: Real Keyboard Control E2E ===
            console.log('\\n--- Test J: Real Keyboard Control ---');
            await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(3000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            
            const keys = [
                { k: 'w', angle: -Math.PI/2, axis: 'y', dir: -1 },
                { k: 'a', angle: Math.PI, axis: 'x', dir: -1 },
                { k: 's', angle: Math.PI/2, axis: 'y', dir: 1 },
                { k: 'd', angle: 0, axis: 'x', dir: 1 },
                { k: 'ArrowUp', angle: -Math.PI/2, axis: 'y', dir: -1 },
                { k: 'ArrowLeft', angle: Math.PI, axis: 'x', dir: -1 },
                { k: 'ArrowDown', angle: Math.PI/2, axis: 'y', dir: 1 },
                { k: 'ArrowRight', angle: 0, axis: 'x', dir: 1 },
            ];

            for (const t of keys) {
                let pos1 = await page.evaluate(() => API.getPlayerPosition());
                let cur1 = await page.evaluate(() => API.getCurrentAngle());
                
                await page.keyboard.down(t.k);
                await page.waitForTimeout(900);
                
                let target2 = await page.evaluate(() => API.getTargetAngle());
                let cur2 = await page.evaluate(() => API.getCurrentAngle());
                let pos2 = await page.evaluate(() => API.getPlayerPosition());
                
                await page.keyboard.up(t.k);
                await page.waitForTimeout(300);

                assert(Math.abs(target2 - t.angle) < 0.1 || (Math.abs(t.angle) === Math.PI && Math.abs(target2) === Math.PI), `Key ${t.k} targetAngle should be ${t.angle}, got ${target2}`);
                assert(cur1 !== cur2, `Key ${t.k} currentAngle should move`);
                let delta = pos2[t.axis] - pos1[t.axis];
                assert(delta * t.dir > 0, `Key ${t.k} position ${t.axis} should move in dir ${t.dir}, got delta ${delta}`);
            }

            // === TEST K & L: Mobile Boost & Joystick E2E ===
            console.log('\\n--- Test K & L: Mobile Controls ---');
            
            const viewports = [
                { width: 390, height: 844 },
                { width: 430, height: 932 },
                { width: 768, height: 1024 }
            ];
            for (const v of viewports) {
                console.log(`Testing viewport ${v.width}x${v.height}`);
                await page.setViewportSize(v);
                await page.evaluate(() => { API.restartGame(); });
                await page.waitForTimeout(3000);
                await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
                
                // Boost E2E
                let initialBoost = await page.evaluate(() => API.getBoostEnergy());
                let pos1 = await page.evaluate(() => API.getPlayerPosition());
                await page.waitForTimeout(900);
                let pos2 = await page.evaluate(() => API.getPlayerPosition());
                let speedNormal = await page.evaluate(() => API.getPlayerSpeed());
                
                await page.mouse.move(v.width - 70, v.height - 70);
                await page.mouse.down();
                await page.waitForTimeout(900);
                
                let midBoost = await page.evaluate(() => API.getBoostEnergy());
                let pos3 = await page.evaluate(() => API.getPlayerPosition());
                await page.waitForTimeout(900);
                let pos4 = await page.evaluate(() => API.getPlayerPosition());
                let speedBoost = await page.evaluate(() => API.getPlayerSpeed());
                
                assert(midBoost < initialBoost, `Boost energy should decrease on ${v.width}, got ${midBoost}`);
                assert(speedBoost > speedNormal, `Speed should increase on ${v.width}, got boost ${speedBoost} normal ${speedNormal}`);
                
                await page.mouse.up();
                await page.waitForTimeout(3000);
                let endBoost = await page.evaluate(() => API.getBoostEnergy());
                assert(endBoost > midBoost, `Boost energy should recover on ${v.width}, got ${endBoost} > ${midBoost}`);

                // Joystick E2E
                let jPos1 = await page.evaluate(() => API.getPlayerPosition());
                await page.mouse.move(80, v.height - 80);
                await page.mouse.down();
                await page.mouse.move(80, v.height - 180, { steps: 5 }); // drag UP
                await page.waitForTimeout(900);
                
                let jTarget = await page.evaluate(() => API.getTargetAngle());
                let jCur = await page.evaluate(() => API.getCurrentAngle());
                let jPos2 = await page.evaluate(() => API.getPlayerPosition());
                await page.mouse.up();

                assert(Math.abs(jTarget - (-Math.PI/2)) < 0.1, `Joystick UP targetAngle should be ~-1.57 on ${v.width}, got ${jTarget}`);
                assert(jCur < 0, `Joystick currentAngle should move UP, got ${jCur}`);
                assert(jPos2.y < jPos1.y - 10, `Joystick actual trajectory should move UP, delta y: ${jPos2.y - jPos1.y}`);
            }

            // === TEST M: RESTART 10 LEAK TEST ===
            console.log('\\n--- Test M: Restart 10 Leak Test ---');
            await page.setViewportSize({ width: 1024, height: 768 });
            await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(3000);
            
            let listenersBase = await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getResizeListenerCount());
            
            for(let i=0; i<10; i++) {
                await page.evaluate(() => { API.restartGame(); });
                await page.waitForTimeout(900);
            }
            
            let listenersEnd = await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getResizeListenerCount());
            assert(listenersEnd === listenersBase, `Resize listeners leaked! Initial: ${listenersBase}, Final: ${listenersEnd}`);
            
            await page.keyboard.down('ArrowLeft');
            await page.waitForTimeout(600);
            let tAngle = await page.evaluate(() => API.getTargetAngle());
            assert(tAngle === Math.PI || tAngle === -Math.PI, `Keyboard after restart failed, got ${tAngle}`);
            await page.keyboard.up('ArrowLeft');

            let startBoost = await page.evaluate(() => API.getBoostEnergy());
            await page.keyboard.down(' ');
            await page.waitForTimeout(600);
            let endBoost = await page.evaluate(() => API.getBoostEnergy());
            assert(endBoost < startBoost, `Boost after restart failed, got ${endBoost} < ${startBoost}`);
            await page.keyboard.up(' ');

            console.log('\\n✅ ALL E2E TESTS PASSED SUCCESSFULLY');
            assert(pageErrors === 0, `Expected 0 page errors, got ${pageErrors}`);
            assert(missingAssets === 0, `Expected 0 404s, got ${missingAssets}`);

        } catch (err) {
            console.error('Test Execution Error:', err);
            totalErrors++;
        } finally {
            await page.close();
        }
    };

    await runTests();
    
    console.log(`\n=== FINAL SCRIPT RESULTS ===`);
    console.log(`Total Errors/Failed Asserts: ${totalErrors}`);
    
    await browser.close();
    
    if (totalErrors > 0) {
        process.exit(1);
    }
})();
