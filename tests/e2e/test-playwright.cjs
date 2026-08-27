const { chromium } = require('playwright');

(async () => {
    console.log('Launching playwright browser for E2E testing...');
    const browser = await chromium.launch({ headless: true });
    
    // Determine the URL based on env (local vs prod)
    const baseUrl = process.env.TEST_PROD === '1' 
        ? 'https://chaohuang-TW.github.io/number-snake-arena/'
        : 'http://localhost:3000/';

    console.log(`Base URL: ${baseUrl}`);
    
    let totalErrors = 0;
    
    const assert = (condition, message) => {
        if (!condition) {
            console.error(`❌ ASSERT FAILED: ${message}`);
            totalErrors++;
        } else {
            console.log(`✅ ASSERT OK: ${message}`);
        }
    };

    const runTests = async () => {
        const page = await browser.newPage();
        let pageErrors = 0;
        let missingAssets = 0;

        page.on('console', msg => {
            if (msg.type() === 'error' && !msg.text().includes('favicon')) {
                pageErrors++;
                console.error('PAGE ERROR:', msg.text());
            }
        });
        
        page.on('pageerror', err => {
            pageErrors++;
            console.error('PAGE UNCAUGHT ERROR:', err.message);
        });

        page.on('response', res => {
            if (res.status() === 404 && !res.url().includes('favicon')) {
                missingAssets++;
                console.error('NETWORK 404:', res.url());
            }
        });

        try {
            console.log(`\n=== Testing NORMAL URL Security ===`);
            await page.goto(baseUrl, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);
            
            let vpNormal = page.viewportSize();
            await page.mouse.click(vpNormal.width / 2, vpNormal.height / 2 + 60); 
            await page.waitForTimeout(1000);
            
            let pValNormal = await page.evaluate(() => {
                let scene = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return scene.player.value;
            });
            
            await page.keyboard.press('c');
            await page.keyboard.press('C');
            await page.keyboard.down('c');
            await page.keyboard.up('c');
            await page.waitForTimeout(500);
            
            let pValAfter = await page.evaluate(() => {
                let scene = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return scene.player.value;
            });
            assert(pValNormal === pValAfter, `PlayerValue should not change on normal URL when pressing C, got ${pValAfter}`);
            
            let debugExists = await page.evaluate(() => typeof window.__NUMBER_SNAKE_DEBUG__ !== 'undefined');
            assert(!debugExists, `Debug API must be undefined on normal URL`);
            
            console.log(`\n=== Testing DEBUG URL Gameplay ===`);
            await page.goto(baseUrl + '?debug=1', { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);
            
            let vp = page.viewportSize();
            await page.mouse.click(vp.width / 2, vp.height / 2 + 60); 
            await page.waitForTimeout(1000);

            await page.evaluate(() => {
                window.API = window.__NUMBER_SNAKE_DEBUG__;
                window.API.stopSpawning();
            });

            const cleanEnemies = async () => {
                await page.evaluate(() => {
                    API.getEnemies().forEach(e => e.destroy());
                    API.getEnemies().length = 0;
                });
            };
            await cleanEnemies();

            // === TEST A: Core Eating ===
            console.log('\n--- Test A: Core Eating ---');
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
            await page.waitForTimeout(1500); // wait invulnerable
            
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
            await page.waitForTimeout(1000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await cleanEnemies();
            await page.evaluate(() => {
                API.setPlayerValue(8);
                let pos = API.getPlayerPos();
                API.spawnEnemy(12, pos.x + 200, pos.y);
            });
            await page.waitForTimeout(100);
            let stateInfo = await page.evaluate(() => {
                let e = API.getEnemies()[0];
                let p = API.getPlayerPos();
                let dist = Math.sqrt(Math.pow(e.body.x - p.x, 2) + Math.pow(e.body.y - p.y, 2));
                return { state: e.state, dist };
            });
            assert(stateInfo.state === 2, `Enemy state should be 2 (CHASE), got ${stateInfo.state} (dist: ${stateInfo.dist})`);
            
            await page.evaluate(() => { API.setPlayerValue(13); });
            await page.waitForTimeout(100);
            stateInfo = await page.evaluate(() => {
                let e = API.getEnemies()[0];
                let p = API.getPlayerPos();
                let dist = Math.sqrt(Math.pow(e.body.x - p.x, 2) + Math.pow(e.body.y - p.y, 2));
                return { state: e.state, dist };
            });
            assert(stateInfo.state === 1, `Enemy state should be 1 (FLEE), got ${stateInfo.state} (dist: ${stateInfo.dist})`);
            await cleanEnemies();



            // === TEST C: Damage Boundaries ===
            console.log('\\n--- Test C: Damage Boundaries ---');
            await page.waitForTimeout(1500);
            
            await page.evaluate(() => { 
                API.getEnemies().length = 0; API.setPlayerValue(10); API.setPlayerHP(3); 
                let e = API.spawnEnemy(10, 0, 0); 
                API.forceCollisionWithEnemy(API.getEnemies().indexOf(e)); 
            });
            hp = await page.evaluate(() => API.getPlayerHP());
            assert(hp === 2, `HP should be 2, got ${hp}`);
            await page.waitForTimeout(2000);

            await page.evaluate(() => { 
                API.getEnemies().length = 0; API.setPlayerValue(100); API.setPlayerHP(3); 
                let e = API.spawnEnemy(149, 0, 0); API.forceCollisionWithEnemy(API.getEnemies().indexOf(e)); 
            });
            hp = await page.evaluate(() => API.getPlayerHP());
            assert(hp === 2, `HP should be 2, got ${hp}`);
            await page.waitForTimeout(2000);

            await page.evaluate(() => { 
                API.getEnemies().length = 0; API.setPlayerValue(10); API.setPlayerHP(3); 
                let e = API.spawnEnemy(15, 0, 0); API.forceCollisionWithEnemy(API.getEnemies().indexOf(e)); 
            });
            hp = await page.evaluate(() => API.getPlayerHP());
            assert(hp === 1, `HP should be 1, got ${hp}`);
            await page.waitForTimeout(2000);

            await page.evaluate(() => { 
                API.getEnemies().length = 0; API.setPlayerValue(10); API.setPlayerHP(3); 
                let e = API.spawnEnemy(25, 0, 0); API.forceCollisionWithEnemy(API.getEnemies().indexOf(e)); 
            });
            let gameState = await page.evaluate(() => window.API.getGameState());
            assert(gameState === 'GAME_OVER', `Game state should be GAME_OVER, got ${gameState}`);
            
            // Restart game for next tests
                await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(1000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await cleanEnemies();

            // === TEST D: Boss Damage ===
            console.log('\\n--- Test D: Boss Damage ---');
            await page.evaluate(() => { API.setPlayerValue(100); API.setPlayerHP(3); API.spawnBoss(); });
            await page.waitForTimeout(500);
            await page.evaluate(() => { API.forceCollisionWithBoss(); });
            hp = await page.evaluate(() => API.getPlayerHP());
            gameState = await page.evaluate(() => window.API.getGameState());
            assert(hp === 2, `HP should be 2, got ${hp}`);
            assert(gameState === 'RUNNING', `Game state should be RUNNING, got ${gameState}`);
            await page.waitForTimeout(1500);

            await page.evaluate(() => { API.setPlayerValue(50); API.setPlayerHP(3); API.forceCollisionWithBoss(); });
            hp = await page.evaluate(() => API.getPlayerHP());
            assert(hp === 1, `HP should be 1, got ${hp}`);
            await page.waitForTimeout(1500);

            await page.evaluate(() => { API.setPlayerValue(40); API.setPlayerHP(3); API.forceCollisionWithBoss(); });
            gameState = await page.evaluate(() => window.API.getGameState());
            assert(gameState === 'GAME_OVER', `Game state should be GAME_OVER, got ${gameState}`);

                await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(1000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await cleanEnemies();

            // === TEST E: Boss Reversal & Victory ===
            console.log('\\n--- Test E: Boss Reversal & Victory ---');
            await page.evaluate(() => { API.setPlayerValue(70); });
            await page.waitForTimeout(500);
            let bState = await page.evaluate(() => API.getBossState());
            assert(bState === 'CHASE', `Boss should be CHASE, got ${bState}`);
            
            await page.evaluate(() => { API.setPlayerValue(100); });
            await page.waitForTimeout(500);
            bState = await page.evaluate(() => API.getBossState());
            assert(bState === 'CHASE', `Boss should be CHASE, got ${bState}`);

            await page.evaluate(() => { API.setPlayerValue(101); });
            await page.waitForTimeout(500);
            bState = await page.evaluate(() => API.getBossState());
            assert(bState === 'FLEE', `Boss should be FLEE, got ${bState}`);

            await page.evaluate(() => { API.forceCollisionWithBoss(); });
            await page.waitForTimeout(500);
            bState = await page.evaluate(() => API.getBossState());
            assert(bState === 'NONE', `Boss should be NONE (destroyed)`);
            let gStateVict = await page.evaluate(() => API.getGameState());
            assert(gStateVict === 'VICTORY', `Game state should be VICTORY, got ${gStateVict}`);
            
                await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(1000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await cleanEnemies();

            // === TEST G: Pause / Resume ===
            // === TEST F: Eat Assist & Early Game ===
            console.log('\\n--- Test F: Eat Assist & Early Game ---');
            await page.evaluate(() => { 
                API.getEnemies().length = 0; API.setPlayerValue(20); API.setPlayerHP(3); 
                let pos = API.getPlayerPos();
                let e = API.spawnEnemy(15, pos.x + 50, pos.y); 
            });
            await page.waitForTimeout(500); // give it time to trigger assist
            let pValAssist = await page.evaluate(() => API.getPlayerValue());
            assert(pValAssist === 35, `Player should eat enemy via assist, got ${pValAssist}`);
            
            // Should not eat larger enemy
            await page.evaluate(() => { 
                API.getEnemies().length = 0; API.setPlayerValue(20);
                let pos = API.getPlayerPos();
                let e = API.spawnEnemy(25, pos.x + 50, pos.y); 
            });
            await page.waitForTimeout(500);
            pValAssist = await page.evaluate(() => API.getPlayerValue());
            assert(pValAssist === 20, `Player should NOT eat larger enemy via assist, got ${pValAssist}`);
            
            await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(1000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await cleanEnemies();

            console.log('\\n--- Test G: Pause / Resume ---');

            await page.evaluate(() => { API.simulateVisibilityHidden(); });
            await page.waitForTimeout(500);
            let gState = await page.evaluate(() => API.getGameState());
            assert(gState === 'PAUSED', `Game should be PAUSED after hidden`);
            
            await page.evaluate(() => { API.simulateVisibilityVisible(); });
            await page.waitForTimeout(500);
            gState = await page.evaluate(() => API.getGameState());
            assert(gState === 'PAUSED', `Game should remain PAUSED after visible (waiting for overlay click)`);
            
            await page.mouse.click(vp.width / 2, vp.height / 2 + 50); 
            await page.waitForTimeout(500);
            gState = await page.evaluate(() => API.getGameState());
            assert(gState === 'RUNNING', `Game should be RUNNING after RESUME click`);

            // === TEST H: Restart Listener Safety ===
            console.log('\\n--- Test H: Restart Listener Safety ---');
            let initialListeners = await page.evaluate(() => API.getResizeListenerCount());
            for (let i = 0; i < 10; i++) {
                await page.evaluate(() => { API.setPlayerHP(0); API.setPlayerValue(10); let e = API.spawnEnemy(25, 0, 0); API.forceCollisionWithEnemy(API.getEnemies().indexOf(e)); });
                await page.waitForTimeout(200);
                await page.evaluate(() => { API.restartGame(); });
                await page.waitForTimeout(200);
                await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; });
            }
            let finalListeners = await page.evaluate(() => API.getResizeListenerCount());
            assert(initialListeners === finalListeners, `Listener count should not increase. Initial: ${initialListeners}, Final: ${finalListeners}`);


            // === TEST I: Combo Timeout ===
            console.log('\\n--- Test I: Combo Timeout ---');
            await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(1000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await page.evaluate(() => { 
                API.getEnemies().length = 0; API.setPlayerValue(5); 
                let pos = API.getPlayerPos();
                let e = API.spawnEnemy(1, pos.x, pos.y); 
                API.forceCollisionWithEnemy(API.getEnemies().indexOf(e)); 
            });
            let combo1 = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').comboCount);
            assert(combo1 === 1, `Combo should be 1, got ${combo1}`);
            
            await page.waitForTimeout(2600); // Wait for combo timeout
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
            await page.waitForTimeout(1000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            
            // Check W (Up)
            await page.keyboard.down('w');
            await page.waitForTimeout(200);
            let targetAngle = await page.evaluate(() => API.getTargetAngle());
            // Up is roughly -PI/2 (-1.57)
            assert(targetAngle < -1.0 && targetAngle > -2.0, `Target angle should be UP (~-1.57), got ${targetAngle}`);
            await page.keyboard.up('w');

            // Check D (Right)
            await page.keyboard.down('d');
            await page.waitForTimeout(200);
            targetAngle = await page.evaluate(() => API.getTargetAngle());
            assert(targetAngle === 0, `Target angle should be RIGHT (0), got ${targetAngle}`);
            await page.keyboard.up('d');
            
            // Check ArrowDown
            await page.keyboard.down('ArrowDown');
            await page.waitForTimeout(200);
            targetAngle = await page.evaluate(() => API.getTargetAngle());
            assert(targetAngle > 1.0 && targetAngle < 2.0, `Target angle should be DOWN (~1.57), got ${targetAngle}`);
            await page.keyboard.up('ArrowDown');
            
            // Check ArrowLeft
            await page.keyboard.down('ArrowLeft');
            await page.waitForTimeout(200);
            targetAngle = await page.evaluate(() => API.getTargetAngle());
            assert(targetAngle === Math.PI || targetAngle === -Math.PI, `Target angle should be LEFT (PI), got ${targetAngle}`);
            await page.keyboard.up('ArrowLeft');

            // === TEST K: Real Mobile Boost E2E ===
            console.log('\\n--- Test K: Mobile Boost ---');
            await page.setViewportSize({ width: 390, height: 844 });
            await page.waitForTimeout(1000);
            await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(1000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            
            let initialBoost = await page.evaluate(() => API.getBoostEnergy());
            
            // Touch BOOST button (bottom right)
            await page.mouse.move(390 - 70, 844 - 70);
            await page.mouse.down();
            await page.waitForTimeout(600);
            let afterBoost = await page.evaluate(() => API.getBoostEnergy());
            assert(afterBoost < initialBoost, `Boost energy should decrease, got ${afterBoost} < ${initialBoost}`);
            await page.mouse.up();
            await page.waitForTimeout(600);
            let recoveringBoost = await page.evaluate(() => API.getBoostEnergy());
            assert(recoveringBoost > afterBoost, `Boost energy should recover, got ${recoveringBoost} > ${afterBoost}`);

            // === TEST L: Real Virtual Joystick E2E ===
            console.log('\\n--- Test L: Virtual Joystick ---');
            // Joystick center is at 80, height - 80. Viewport 390x844 -> 80, 764
            // Let's press at center, drag UP (to y=664)
            await page.mouse.move(80, 764);
            await page.mouse.down();
            await page.mouse.move(80, 664, { steps: 5 });
            await page.waitForTimeout(200);
            
            targetAngle = await page.evaluate(() => API.getTargetAngle());
            assert(targetAngle < -1.0 && targetAngle > -2.0, `Joystick drag UP should set target angle to ~-1.57, got ${targetAngle}`);
            await page.mouse.up();

            console.log('\\n--- Responsive Check ---');
            const viewports = [
                { width: 390, height: 844 },
                { width: 430, height: 932 },
                { width: 768, height: 1024 },
                { width: 1024, height: 768 },
                { width: 1366, height: 768 },
                { width: 1920, height: 1080 }
            ];
            for (const v of viewports) {
                await page.setViewportSize(v);
                await page.waitForTimeout(500);
                
                // Assert canvas bounds
                const canvasBounds = await page.evaluate(() => {
                    const c = document.querySelector('canvas');
                    if (!c) return null;
                    return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight };
                });
                assert(canvasBounds !== null, `Canvas missing at ${v.width}x${v.height}`);
                assert(canvasBounds.cw <= v.width, `Canvas overflows horizontally at ${v.width}x${v.height}`);
                
                // If mobile size, test Joystick and Boost
                if (v.width <= 768) {
                    await page.evaluate(() => { API.restartGame(); });
                    await page.waitForTimeout(1000);
                    await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
                    
                    // BOOST test
                    let initialBoost = await page.evaluate(() => API.getBoostEnergy());
                    await page.mouse.move(v.width - 70, v.height - 70);
                    await page.mouse.down();
                    await page.waitForTimeout(600);
                    let afterBoost = await page.evaluate(() => API.getBoostEnergy());
                    assert(afterBoost < initialBoost, `Boost energy should decrease on ${v.width}x${v.height}, got ${afterBoost}`);
                    await page.mouse.up();
                    
                    // Joystick test (move RIGHT)
                    await page.mouse.move(80, v.height - 80);
                    await page.mouse.down();
                    await page.mouse.move(180, v.height - 80, { steps: 5 });
                    await page.waitForTimeout(200);
                    let targetAngle = await page.evaluate(() => API.getTargetAngle());
                    assert(targetAngle === 0, `Joystick should steer RIGHT on ${v.width}x${v.height}, got ${targetAngle}`);
                    await page.mouse.up();
                }
            }
            console.log('✅ Responsive OK');

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
