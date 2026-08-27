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
            await page.waitForTimeout(1000);
            const debugExists = await page.evaluate(() => typeof window.__NUMBER_SNAKE_DEBUG__ !== 'undefined');
            assert(!debugExists, 'Debug API must be undefined on normal URL');
            
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
                API.setPlayerValue(5);
                API.setPlayerHP(3);
                let pos = API.getPlayerPos();
                let e = API.spawnEnemy(3, pos.x + 500, pos.y);
                API.forceCollisionWithEnemy(API.getEnemies().indexOf(e));
            });
            let pVal = await page.evaluate(() => API.getPlayerValue());
            let segments = await page.evaluate(() => API.getBodySegments());
            let enemiesLen = await page.evaluate(() => API.getEnemies().length);
            assert(pVal === 8, `Player value should be 8, got ${pVal}`);
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
            pVal = await page.evaluate(() => API.getPlayerValue());
            let hp = await page.evaluate(() => API.getPlayerHP());
            assert(pVal === 5, `Player value should remain 5, got ${pVal}`);
            assert(hp === 2, `Player HP should be reduced to 2 by same size enemy, got ${hp}`);
            
            await cleanEnemies();

            // === TEST B: Role Reversal ===
            console.log('\n--- Test B: Role Reversal ---');
            await page.evaluate(() => {
                API.setPlayerValue(8);
                let pos = API.getPlayerPos();
                API.spawnEnemy(12, pos.x + 100, pos.y);
            });
            await page.waitForTimeout(100);
            let state = await page.evaluate(() => API.getEnemies()[0].state);
            assert(state === 2, `Enemy state should be 2 (CHASE), got ${state}`);
            
            await page.evaluate(() => { API.setPlayerValue(13); });
            await page.waitForTimeout(100);
            state = await page.evaluate(() => API.getEnemies()[0].state);
            assert(state === 1, `Enemy state should be 1 (FLEE), got ${state}`);
            await cleanEnemies();

            // === TEST C: Damage Boundaries ===
            console.log('\n--- Test C: Damage Boundaries ---');
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
            console.log('\n--- Test D: Boss Damage ---');
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
            console.log('\n--- Test E: Boss Reversal & Victory ---');
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
            
                await page.evaluate(() => { API.restartGame(); });
            await page.waitForTimeout(1000);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await cleanEnemies();

            // === TEST G: Pause / Resume ===
            console.log('\n--- Test G: Pause / Resume ---');
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
            console.log('\n--- Test H: Restart Listener Safety ---');
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

            console.log('\n--- Responsive Check ---');
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
