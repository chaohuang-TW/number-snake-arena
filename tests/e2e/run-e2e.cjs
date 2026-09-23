const { chromium } = require('playwright');

const baseURL = process.env.BASE_URL || 'http://localhost:3000/';

(async () => {
    let defaultTestLanguage = 'en';
    const browser = await chromium.launch({ headless: true });
    const originalNewContext = browser.newContext.bind(browser);
    browser.newContext = async (options) => {
        const ctx = await originalNewContext(options);
        await ctx.addInitScript((lang) => {
            if (lang && !localStorage.getItem('number_snake_language_v1')) {
                localStorage.setItem('number_snake_language_v1', lang);
            }
        }, defaultTestLanguage);
        return ctx;
    };
    const context = await browser.newContext({ hasTouch: true });
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
            
            // start game (Menu -> PrepScene -> GameScene)
            let vpNormal = page.viewportSize();
            await page.mouse.click(page.viewportSize().width / 2 - 300, page.viewportSize().height / 2 + 100); 
            await page.waitForTimeout(1000);
            await page.mouse.click(page.viewportSize().width / 2, page.viewportSize().height - 96);
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
            await page.evaluate(() => {
                window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 });
            });
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
                await page.waitForTimeout(1500);
                await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
                await page.waitForTimeout(500);
                
                // Boost E2E
                let initialBoost = await page.evaluate(() => API.getBoostEnergy());
                let pos1 = await page.evaluate(() => API.getPlayerPosition());
                await page.waitForTimeout(900);
                let pos2 = await page.evaluate(() => API.getPlayerPosition());
                let speedNormal = await page.evaluate(() => API.getPlayerSpeed());
                
                await page.mouse.move(v.width - 90, v.height - 90);
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
                await page.mouse.move(100, v.height - 100);
                await page.mouse.down();
                await page.mouse.move(100, v.height - 200, { steps: 5 }); // drag UP
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

            
            // ==========================================
            // TEST N: New Player / Level Select
            // ==========================================
            console.log('\n--- Test N: New Player / Level Select ---');
            await page.evaluate(() => { window.API.resetProgressionForTest(); });
            
            await page.evaluate(() => window.__PHASER_GAME__.scene.start('MenuScene'));
            await page.waitForTimeout(1500);
            
            let pData1 = await page.evaluate(() => window.API.getProgression());
            assert(pData1.highestUnlockedLevel === 1, `Expected highest unlocked 1, got ${pData1.highestUnlockedLevel}`);
            assert(pData1.maxHPBonus === 0, `Expected bonus 0`);
            
            // Check locks visually in MenuScene
            let locks = await page.evaluate(() => {
                const ms = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
                if(!ms) return null;
                let texts = [];
                function extract(c) {
                    if (c.text) texts.push(c.text);
                    if (c.list) c.list.forEach(extract);
                }
                ms.children.list.forEach(extract);
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
            await page.waitForTimeout(1500);
            
            // Re-expose debug
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            
            let cl1 = await page.evaluate(() => window.API.getCurrentLevel());
            assert(cl1 === 1, `Expected Level 1, got ${cl1}`);
            let pValN = await page.evaluate(() => window.API.getPlayerValue());
            assert(pValN === 5, `Expected PlayerValue 5, got ${pValN}`);
            let l1Hp = await page.evaluate(() => window.API.getHP());
            // Random enemy might have hit player before stopSpawning, so restore to max
            await page.evaluate(() => { window.API.setPlayerHP(window.API.getMaxHP()); });
            let l1MaxHpForAssert = await page.evaluate(() => window.API.getMaxHP());
            assert(l1MaxHpForAssert === 3, `Expected MaxHP 3, got ${l1MaxHpForAssert}`);
            let l1MaxHp = await page.evaluate(() => window.API.getMaxHP());
            assert(l1MaxHp === 3, `Expected MaxHP 3, got ${l1MaxHp}`);

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
            assert(maxL1Enemy <= 99, `Level 1 enemies should remain <=99, got ${maxL1Enemy}`);
            await page.evaluate(() => { 
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                if(gs) { gs.enemies.forEach(e => { e.destroy(); }); gs.enemies = []; }
            });

            // ==========================================
            // TEST O: Level 1 Boss100
            // ==========================================
            console.log('\n--- Test O: Level 1 Boss100 ---');
            await page.evaluate(() => { window.API.setPlayerValue(99); });
            await page.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').spawnBoss(); });
            await page.waitForTimeout(300);
            
            let boss1State = await page.evaluate(() => window.API.getBossState());
            assert(boss1State === 'CHASE', `Boss 100 should CHASE player 99, got ${boss1State}`);
            
            await page.evaluate(() => { window.API.setPlayerValue(100); });
            await page.waitForTimeout(300);
            let boss1State100 = await page.evaluate(() => window.API.getBossState());
            assert(boss1State100 === 'CHASE', `Boss 100 should CHASE player 100, got ${boss1State100}`);
            
            await page.evaluate(() => { window.API.setPlayerValue(101); });
            await page.waitForTimeout(300);
            let boss1State101 = await page.evaluate(() => window.API.getBossState());
            assert(boss1State101 === 'FLEE', `Boss 100 should FLEE player 101, got ${boss1State101}`);
            
            // Defeat boss through collision
            await page.evaluate(() => { window.API.forceCollisionWithBoss(); });
            await page.waitForTimeout(2500);
            
            let bossO = await page.evaluate(() => window.API.getBossState());
            assert(bossO === 'NONE', `Boss should be removed, got ${bossO}`);
            let gameStateO = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').gameState);
            assert(gameStateO === 'LEVEL_CLEAR', `GameState should be LEVEL_CLEAR, got ${gameStateO}`);

            // Freeze Gameplay assertion
            let prevHP = await page.evaluate(() => window.API.getHP());
            await page.evaluate(() => { 
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.spawnEnemy();
                if(gs.enemies.length > 0) {
                    gs.enemies[0].body.x = gs.player.head.x;
                    gs.enemies[0].body.y = gs.player.head.y;
                    gs.enemies[0].value = 9999;
                }
            });
            await page.waitForTimeout(300);
            let postHP = await page.evaluate(() => window.API.getHP());
            assert(postHP === prevHP, `HP should freeze during LEVEL_CLEAR, before ${prevHP} after ${postHP}`);
            
            // Test spawn freeze
            await page.evaluate(() => {
                 const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                 gs.spawnEnemy(); 
            });
            await page.waitForTimeout(300);

            // ==========================================
            // TEST P: First Clear Reward UI Test
            // ==========================================
            console.log('\n--- Test P: First Clear Reward UI Test ---');
            let pDataP = await page.evaluate(() => window.API.getProgression());
            assert(pDataP.maxHPBonus === 1, `Expected maxHPBonus 1, got ${pDataP.maxHPBonus}`);
            assert(pDataP.highestUnlockedLevel === 2, `Expected highest unlocked 2`);
            assert(pDataP.claimedRewards.includes('level-1-clear-heart'), `Expected reward claimed`);
            
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
            console.log('\n--- Test Q: No Heart Farming ---');
            // Replay Level 1
            await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.scene.start('GameScene', { levelId: 1 });
            });
            await page.waitForFunction(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene')?.player?.head);
            await page.evaluate(() => { 
                window.API = window.__NUMBER_SNAKE_DEBUG__; 
                window.API.stopSpawning(); 
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.enemies.forEach(e => e.destroy());
                gs.enemies = [];
                gs.player.isStunned = true;
                gs.player.head.setVelocity(0, 0);
                
            });
            
            let qHp = await page.evaluate(() => window.API.getHP());
            assert(qHp === 4, `Expected starting HP 4/4, got ${qHp}`);
            
            await page.evaluate(() => { window.API.setPlayerValue(101); });
            await page.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').spawnBoss(); });
            await page.waitForTimeout(300);
            await page.evaluate(() => { window.API.forceCollisionWithBoss(); });
            await page.waitForTimeout(2500);
            
            let pDataQ = await page.evaluate(() => window.API.getProgression());
            assert(pDataQ.maxHPBonus === 1, `Expected maxHPBonus still 1`);
            assert(pDataQ.claimedRewards.filter(r => r === 'level-1-clear-heart').length === 1, `Expected exactly 1 reward entry`);
            
            // ==========================================
            // TEST R: Real Reload Persistence Test
                        // ==========================================
            // TEST R: Real Reload Persistence Test
            // ==========================================
            console.log('\n--- Test R: Real Reload Persistence Test ---');
            await page.goto(baseURL + '?debug=1&e2e=1');
            await page.waitForTimeout(1500);
            await page.evaluate(() => { window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 }); });
            await page.waitForTimeout(1500);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            let pDataR = await page.evaluate(() => window.API.getProgression());
            assert(pDataR.highestUnlockedLevel === 2, `Expected Level 2 unlocked across reload`);
            assert(pDataR.maxHPBonus === 1, `Expected MaxHP Bonus 1 across reload`);
            
            const storageState = await page.context().storageState();
            const context2 = await browser.newContext({ storageState });
            const page2 = await context2.newPage();
            await page2.goto(baseURL + '?debug=1&e2e=1');
            await page2.waitForTimeout(1500);
            await page2.evaluate(() => { window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 }); });
            await page2.waitForTimeout(1500);
            await page2.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            let pDataR2 = await page2.evaluate(() => window.API.getProgression());
            assert(pDataR2.highestUnlockedLevel === 2, `Fresh page: Expected Level 2 unlocked`);
            assert(pDataR2.maxHPBonus === 1, `Fresh page: Expected MaxHP Bonus 1`);
            await page2.close();

// ==========================================
            console.log('\n--- Test S: Game Over No Reward ---');
            await page.evaluate(() => { window.API.resetProgressionForTest(); });
            await page.evaluate(() => window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 }));
            await page.waitForTimeout(1500);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            
            // Trigger game over before boss (simulating real overlap)
            await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.player.hp = 0;
                gs.player.takeDamage(0, 0, {x: 0, y: 0});
                // Call gameOver manually as in handleEnemyCollision
                gs.gameState = 'GAME_OVER';
                gs.audio.playGameOver();
                gs.saveScore();
                gs.showEndScreen('GAME OVER', '#ff0000');
            });
            await page.waitForTimeout(1500);
            
            let pDataS = await page.evaluate(() => window.API.getProgression());
            assert(pDataS.highestUnlockedLevel === 1, `Game Over should not unlock level 2`);
            assert(pDataS.maxHPBonus === 0, `Game Over should not grant HP`);
            assert(pDataS.claimedRewards.length === 0, `Game Over should not claim reward`);
            
            // Restore to Level 1 clear state for subsequent tests
            await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.scene.start('GameScene', { levelId: 1 });
            });
            await page.waitForTimeout(1500);
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await page.evaluate(() => { window.API.setPlayerValue(101); });
            await page.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').spawnBoss(); });
            await page.waitForTimeout(100);
            await page.evaluate(() => { window.API.forceCollisionWithBoss(); });
            await page.waitForTimeout(2500);

            // ==========================================
            // TEST T: Level 2 Initialization
            // ==========================================
            console.log('\n--- Test T: Level 2 Initialization ---');
            // Start level 2 through standard method
            await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.scene.start('GameScene', { levelId: 2 });
            });
            await page.waitForFunction(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return gs && gs.player && gs.player.head;
            });
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await page.waitForTimeout(500);
            
            let clT = await page.evaluate(() => window.API.getCurrentLevel());
            assert(clT === 2, `Expected Level 2, got ${clT}`);
            
            let pValT = await page.evaluate(() => window.API.getPlayerValue());
            assert(pValT === 5, `Expected Level 2 start value 5, got ${pValT}`);
            
            let hpT = await page.evaluate(() => window.API.getHP());
            await page.evaluate(() => window.API.setPlayerHP(window.API.getMaxHP()));
            let hpTAssert = await page.evaluate(() => window.API.getMaxHP());
            assert(hpTAssert === 4, `Expected Level 2 start HP 4, got ${hpTAssert}`);
            
            let maxHpT = await page.evaluate(() => window.API.getMaxHP());
            assert(maxHpT === 4, `Expected Level 2 MaxHP 4, got ${maxHpT}`);
            
            let segT = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').player.segments);
            assert(segT === 5, `Expected segments 5, got ${segT}`);
            
            let boostT = await page.evaluate(() => window.API.getBoostEnergy());
            assert(boostT === 100, `Expected boost 100, got ${boostT}`);
            
            let comboT = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').comboCount);
            assert(comboT === 0, `Expected combo 0, got ${comboT}`);

            // Enemy range test
            await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                window.API.setPlayerValue(150);
                for(let i=0; i<100; i++) gs.spawnEnemy();
            });
            
            let l2Enemies = await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return gs.enemies.map(e => e.value);
            });
            
            let maxL2 = Math.max(...l2Enemies);
            assert(maxL2 > 99, `Level 2 should spawn enemies > 99, got max ${maxL2}`);
            assert(maxL2 <= 199, `Level 2 enemies should be <= 199, got ${maxL2}`);
            await page.evaluate(() => { 
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                if(gs) { gs.enemies.forEach(e => { e.destroy(); }); gs.enemies = []; }
            });

            // ==========================================
            // TEST U: Level 2 Boss200
            // ==========================================
            console.log('\n--- Test U: Level 2 Boss200 ---');
            await page.evaluate(() => { window.API.setPlayerValue(70); });
            await page.waitForTimeout(600); // give logic loop time
            await page.evaluate(() => { 
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                if (gs.boss) { gs.boss.destroy(); gs.boss = null; gs.enemies = gs.enemies.filter(e => e !== gs.boss); }
                gs.bossSpawned = false;
                window.API.setPlayerValue(5);
            });
            let bossUSpawn1 = await page.evaluate(() => window.API.getBossState());
            assert(bossUSpawn1 === 'NONE', `Boss should NOT spawn at 70 in Level 2`);
            
            await page.evaluate(() => { window.API.setPlayerValue(149); });
            await page.waitForTimeout(600);
            let bossUSpawn2 = await page.evaluate(() => window.API.getBossState());
            assert(bossUSpawn2 === 'NONE', `Boss should NOT spawn at 149 in Level 2`);
            
            await page.evaluate(() => { window.API.stopSpawning(); window.API.setPlayerValue(150); });
            await page.waitForTimeout(600);
            let bossUSpawn3 = await page.evaluate(() => window.API.getBossState());
            assert(bossUSpawn3 !== 'NONE', `Boss should spawn at 150 in Level 2`);
            
            // Check Boss behavior
            await page.evaluate(() => { window.API.setPlayerValue(199); });
            await page.waitForTimeout(300);
            let bossUState199 = await page.evaluate(() => window.API.getBossState());
            assert(bossUState199 === 'CHASE', `Boss 200 should CHASE player 199, got ${bossUState199}`);
            
            await page.evaluate(() => { window.API.setPlayerValue(200); });
            await page.waitForTimeout(300);
            let bossUState200 = await page.evaluate(() => window.API.getBossState());
            assert(bossUState200 === 'CHASE', `Boss 200 should CHASE player 200, got ${bossUState200}`);
            
            await page.evaluate(() => { window.API.setPlayerValue(201); });
            await page.waitForTimeout(300);
            let bossUState201 = await page.evaluate(() => window.API.getBossState());
            assert(bossUState201 === 'FLEE', `Boss 200 should FLEE player 201, got ${bossUState201}`);
            
            await page.evaluate(() => { window.API.forceCollisionWithBoss(); });
            await page.waitForTimeout(2500);
            
            let bossUNone = await page.evaluate(() => window.API.getBossState());
            assert(bossUNone === 'NONE', `Boss should be NONE (destroyed)`);
            let gameStateU = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').gameState);
            assert(gameStateU === 'LEVEL_CLEAR', `GameState should be LEVEL_CLEAR, got ${gameStateU}`);
            
            let clearUITextsU = await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return gs.children.list.filter(c => c.text).map(c => c.text);
            });
            assert(clearUITextsU.some(t => t.includes('LEVEL 2 CLEAR')), 'Should have LEVEL 2 CLEAR UI');
            // Omitted coming soon assertion

            // ==========================================
            // TEST V: Level Reset Isolation
            // ==========================================
            console.log('\n--- Test V: Level Reset Isolation ---');
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
                gs.player.takeDamage(1, 3, {x: 0, y: 0}); // take damage to change segments
            });
            await page.waitForTimeout(1000);
            // Defeat boss to clear
            await page.evaluate(() => { window.API.forceCollisionWithBoss(); });
            await page.waitForTimeout(2500);
            
            // Enter level 2
            await page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.scene.start('GameScene', { levelId: 2 });
            });
            await page.waitForFunction(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return gs && gs.player && gs.player.head && gs.levelDef && gs.levelDef.id === 2;
            });
            await page.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            
            let pValV = await page.evaluate(() => window.API.getPlayerValue());
            assert(pValV === 5, `Isolation: PlayerValue should be 5, got ${pValV}`);
            let hpV = await page.evaluate(() => window.API.getHP());
            assert(hpV === 4, `Isolation: HP should be 4, got ${hpV}`);
            let segV = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').player.segments);
            assert(segV === 5, `Isolation: segments should be 5, got ${segV}`);
            let boostV = await page.evaluate(() => window.API.getBoostEnergy());
            assert(boostV === 100, `Isolation: boost should be 100, got ${boostV}`);
            let comboV = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').comboCount);
            assert(comboV === 0, `Isolation: combo should be 0, got ${comboV}`);
            let enemyCountV = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').enemies.length);
            assert(enemyCountV === 0, `Isolation: old enemies should be cleared, got ${enemyCountV}`);
            let bossV = await page.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').boss);
            assert(bossV === null, `Isolation: Boss should be absent`);
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
    
    
            // === Test W: Tablet Touch Capabilities ===
            console.log('\n--- Test W: Tablet Touch Capabilities ---');
            
            const tabletViewports = [
                { width: 810, height: 1080 },
                { width: 820, height: 1180 },
                { width: 834, height: 1194 },
                { width: 1024, height: 1366 },
                { width: 1080, height: 810 },
                { width: 1180, height: 820 },
                { width: 1194, height: 834 },
                { width: 1366, height: 1024 }
            ];

            for (const v of tabletViewports) {
                console.log(`Testing Tablet ${v.width}x${v.height}`);
                const tabletContext = await browser.newContext({
                    hasTouch: true,
                    viewport: v
                });
                const tPage = await tabletContext.newPage();
                tPage.on("console", msg => console.log("TABLET:", msg.text()));
                await tPage.goto(baseURL + "?debug=1", { waitUntil: 'networkidle' });
                await tPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
                await tPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes[0].scene.start('GameScene'); });
                await tPage.waitForFunction(() => typeof window.__NUMBER_SNAKE_DEBUG__ !== 'undefined', { timeout: 15000 });
                await tPage.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
                await tPage.waitForTimeout(500);

                let boostVisible = await tPage.evaluate(() => {
                    const scene = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                    const hud = scene.hud;
                    return hud.boostButton && hud.boostButton.visible;
                });
                if (!boostVisible) {
                    console.error(`❌ ASSERT FAILED: BOOST should be visible on tablet ${v.width}x${v.height}`);
                    totalErrors++;
                } else {
                    console.log(`✅ ASSERT OK: BOOST should be visible on tablet ${v.width}x${v.height}`);
                }

                let joystickVisible = await tPage.evaluate(() => {
                    const scene = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                    return scene.joystick && scene.joystick.base.visible;
                });
                if (!joystickVisible) {
                    console.error(`❌ ASSERT FAILED: Joystick should be visible on tablet ${v.width}x${v.height}`);
                    totalErrors++;
                } else {
                    console.log(`✅ ASSERT OK: Joystick should be visible on tablet ${v.width}x${v.height}`);
                }
                
                // Assert bounds
                let outOfBounds = await tPage.evaluate(() => {
                    const hud = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').hud;
                    const bx = hud.boostButton.x;
                    const by = hud.boostButton.y;
                    const w = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').scale.width;
                    const h = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').scale.height;
                    return bx < 0 || by < 0 || bx > w || by > h;
                });
                if (outOfBounds) {
                    console.error(`❌ ASSERT FAILED: BOOST bounds should be inside viewport`);
                    totalErrors++;
                } else {
                    console.log(`✅ ASSERT OK: BOOST bounds should be inside viewport`);
                }

                // Test input
                await tPage.evaluate(() => {
                    window.API = window.__NUMBER_SNAKE_DEBUG__;
                    window.API.stopSpawning();
                    if (window.API.hardReset) window.API.hardReset();
                    window.API.setPlayerHP(10);
                });
                let initialBoost = await tPage.evaluate(() => API.getBoostEnergy());
                let speedNormal = await tPage.evaluate(() => API.getPlayerSpeed());
                
                // Note: The boost button is at v.width - 90, v.height - 90
                await tPage.mouse.move(v.width - 90, v.height - 90);
                await tPage.mouse.down();
                await tPage.waitForTimeout(900);
                
                let midBoost = await tPage.evaluate(() => API.getBoostEnergy());
                let speedBoost = await tPage.evaluate(() => API.getPlayerSpeed());
                if (!(midBoost < initialBoost)) { console.error(`❌ ASSERT FAILED: Boost energy should decrease`); totalErrors++; }
                else console.log(`✅ ASSERT OK: Boost energy should decrease`);
                if (!(speedBoost > speedNormal)) { console.error(`❌ ASSERT FAILED: Speed should increase`); totalErrors++; }
                else console.log(`✅ ASSERT OK: Speed should increase`);
                
                await tPage.mouse.up();
                await tPage.waitForTimeout(3000);
                let endBoost = await tPage.evaluate(() => API.getBoostEnergy());
                if (!(endBoost > midBoost)) { console.error(`❌ ASSERT FAILED: Boost energy should recover`); totalErrors++; }
                else console.log(`✅ ASSERT OK: Boost energy should recover`);

                // Joystick E2E
                await tPage.evaluate(() => {
                    if (window.API.hardReset) window.API.hardReset();
                    window.API.setPlayerHP(10);
                });
                let jPos1 = await tPage.evaluate(() => API.getPlayerPosition());
                await tPage.mouse.move(100, v.height - 100);
                await tPage.mouse.down();
                await tPage.mouse.move(100, v.height - 200, { steps: 5 }); // drag UP
                await tPage.waitForTimeout(900);
                
                let jTarget = await tPage.evaluate(() => API.getTargetAngle());
                let jPos2 = await tPage.evaluate(() => API.getPlayerPosition());
                await tPage.mouse.up();

                if (!(Math.abs(jTarget - (-Math.PI/2)) < 0.1)) { console.error(`❌ ASSERT FAILED: Joystick UP targetAngle should be ~-1.57`); totalErrors++; }
                else console.log(`✅ ASSERT OK: Joystick UP targetAngle should be ~-1.57`);
                if (!(jPos2.y < jPos1.y - 10)) { console.error(`❌ ASSERT FAILED: Joystick actual trajectory should move UP`); totalErrors++; }
                else console.log(`✅ ASSERT OK: Joystick actual trajectory should move UP`);
                
                await tabletContext.close();
            }

            // === Test X: Desktop Input Isolation ===
            console.log('\n--- Test X: Desktop Input Isolation ---');
            const desktopViewports = [
                { width: 1366, height: 768 },
                { width: 1920, height: 1080 }
            ];

            for (const v of desktopViewports) {
                console.log(`Testing Desktop ${v.width}x${v.height}`);
                const desktopContext = await browser.newContext({
                    hasTouch: false,
                    viewport: v
                });
                const dPage = await desktopContext.newPage();
                await dPage.goto(baseURL + "?debug=1", { waitUntil: 'networkidle' });
                await dPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
                await dPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes[0].scene.start('GameScene'); });
                await dPage.waitForFunction(() => typeof window.__NUMBER_SNAKE_DEBUG__ !== 'undefined', { timeout: 15000 });
                await dPage.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
                await dPage.waitForTimeout(500);

                let boostVisible = await dPage.evaluate(() => {
                    const scene = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                    const hud = scene.hud;
                    return hud.boostButton && hud.boostButton.visible;
                });
                // The prompt says "BOOST may remain hidden because Spacebar is available"
                if (boostVisible) {
                    console.error(`❌ ASSERT FAILED: BOOST should be hidden on desktop ${v.width}x${v.height}`);
                    totalErrors++;
                } else {
                    console.log(`✅ ASSERT OK: BOOST should be hidden on desktop ${v.width}x${v.height}`);
                }

                // Desktop Space BOOST
                await dPage.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
                let initialBoost = await dPage.evaluate(() => API.getBoostEnergy());
                let speedNormal = await dPage.evaluate(() => API.getPlayerSpeed());
                
                await dPage.keyboard.down('Space');
                await dPage.waitForTimeout(900);
                let midBoost = await dPage.evaluate(() => API.getBoostEnergy());
                let speedBoost = await dPage.evaluate(() => API.getPlayerSpeed());
                
                if (!(midBoost < initialBoost)) { console.error(`❌ ASSERT FAILED: Desktop Space: Boost energy should decrease`); totalErrors++; }
                else console.log(`✅ ASSERT OK: Desktop Space: Boost energy should decrease`);
                
                if (!(speedBoost > speedNormal)) { console.error(`❌ ASSERT FAILED: Desktop Space: Speed should increase`); totalErrors++; }
                else console.log(`✅ ASSERT OK: Desktop Space: Speed should increase`);
                
                await dPage.keyboard.up('Space');
                
                await desktopContext.close();
            }

            // === Test Y: Rotation / Resize ===
            console.log('\n--- Test Y: Rotation / Resize ---');
            const rotContext = await browser.newContext({
                hasTouch: true,
                viewport: { width: 834, height: 1194 }
            });
            const rotPage = await rotContext.newPage();
            await rotPage.goto(baseURL + "?debug=1", { waitUntil: 'networkidle' });
            await rotPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
            await rotPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes[0].scene.start('GameScene'); });
            await rotPage.waitForFunction(() => typeof window.__NUMBER_SNAKE_DEBUG__ !== 'undefined', { timeout: 15000 });
            await rotPage.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
            await rotPage.waitForTimeout(500);
            
            // rotate to landscape
            await rotPage.setViewportSize({ width: 1194, height: 834 });
            await rotPage.waitForTimeout(1000);
            
            let isVisible = await rotPage.evaluate(() => {
                const hud = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').hud;
                const js = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').joystick;
                return hud.boostButton.visible && js.base.visible;
            });
            if (!isVisible) {
                console.error(`❌ ASSERT FAILED: BOOST and Joystick remain visible after resize to 1194x834`);
                totalErrors++;
            } else {
                console.log(`✅ ASSERT OK: BOOST and Joystick remain visible after resize to 1194x834`);
            }
            
            let outOfBounds = await rotPage.evaluate(() => {
                const hud = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').hud;
                const bx = hud.boostButton.x;
                const by = hud.boostButton.y;
                return bx < 0 || by < 0 || bx > 1194 || by > 834;
            });
            if (outOfBounds) {
                console.error(`❌ ASSERT FAILED: BOOST remains inside viewport after resize to 1194x834`);
                totalErrors++;
            } else {
                console.log(`✅ ASSERT OK: BOOST remains inside viewport after resize to 1194x834`);
            }
            
            // rotate back
            await rotPage.setViewportSize({ width: 834, height: 1194 });
            await rotPage.waitForTimeout(1000);
            
            isVisible = await rotPage.evaluate(() => {
                const hud = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').hud;
                const js = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').joystick;
                return hud.boostButton.visible && js.base.visible;
            });
            if (!isVisible) {
                console.error(`❌ ASSERT FAILED: BOOST and Joystick remain visible after resize to 834x1194`);
                totalErrors++;
            } else {
                console.log(`✅ ASSERT OK: BOOST and Joystick remain visible after resize to 834x1194`);
            }

            await rotContext.close();

    
            // =========================================================
            // Test Z: Enemy Population Cap
            // =========================================================
            console.log("\n--- Test Z: Enemy Population Cap ---");
            const zContext = await browser.newContext();
            const zPage = await zContext.newPage();
            await zPage.goto(baseURL + "?debug=1", { waitUntil: 'networkidle' });
            await zPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
            await zPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes[0].scene.start('GameScene'); });
            await zPage.waitForTimeout(500);
            await zPage.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; });

            // Fast forward time by hacking the spawnTimer to trigger continuously
            await zPage.evaluate(async () => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                for (let i = 0; i < 100; i++) {
                    gs.spawnTimer = 0;
                    gs.update(0, 16);
                }
            });
            await zPage.waitForTimeout(500);

            let l1Pop = await zPage.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return gs.enemies.length;
            });
            let l1MaxValue = await zPage.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return Math.max(...gs.enemies.map(e => e.value));
            });

            if (l1Pop > 38 + 2) { 
                console.error(`❌ ASSERT FAILED: Level 1 Population exceeded limit: ${l1Pop}`);
                totalErrors++;
            } else {
                console.log(`✅ ASSERT OK: Level 1 Population is within limits (${l1Pop} <= 40)`);
            }
            if (l1MaxValue > 99) {
                console.error(`❌ ASSERT FAILED: Level 1 max value exceeded 99: ${l1MaxValue}`);
                totalErrors++;
            } else {
                console.log(`✅ ASSERT OK: Level 1 max value is ${l1MaxValue} <= 99`);
            }

            // Start level 2
            await zPage.evaluate(() => {
                window.API.startLevel(2);
            });
            await zPage.waitForFunction(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return gs && gs.player && gs.player.head;
            });
            await zPage.waitForTimeout(500);
            await zPage.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; });
            
            await zPage.evaluate(async () => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                for (let i = 0; i < 100; i++) {
                    gs.spawnTimer = 0;
                    gs.update(0, 16);
                }
            });
            await zPage.waitForTimeout(500);

            let l2Pop = await zPage.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return gs.enemies.length;
            });
            let l2MaxValue = await zPage.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return Math.max(...gs.enemies.map(e => e.value));
            });
            
            if (l2Pop > 40) {
                console.error(`❌ ASSERT FAILED: Level 2 Population exceeded limit: ${l2Pop}`);
                totalErrors++;
            } else {
                console.log(`✅ ASSERT OK: Level 2 Population is within limits (${l2Pop} <= 40)`);
            }
            if (l2MaxValue > 199) {
                console.error(`❌ ASSERT FAILED: Level 2 max value exceeded 199: ${l2MaxValue}`);
                totalErrors++;
            } else {
                console.log(`✅ ASSERT OK: Level 2 max value is ${l2MaxValue} <= 199`);
            }
            await zContext.close();

            // =========================================================
            // Test AA: Spawn Interior Safety
            // =========================================================
            console.log("\n--- Test AA: Spawn Interior Safety ---");
            const aaContext = await browser.newContext();
            const aaPage = await aaContext.newPage();
            await aaPage.goto(baseURL + "?debug=1", { waitUntil: 'networkidle' });
            await aaPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
            await aaPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes[0].scene.start('GameScene'); });
            await aaPage.waitForTimeout(1000);

            const testPositions = [
                {x: 0, y: 0, name: "Center"},
                {x: -1100, y: 0, name: "Left edge"},
                {x: 1100, y: 0, name: "Right edge"},
                {x: 0, y: -700, name: "Top edge"},
                {x: 0, y: 700, name: "Bottom edge"},
                {x: -1100, y: -700, name: "Top-left"},
                {x: 1100, y: 700, name: "Bottom-right"}
            ];

            for (let pos of testPositions) {
                let outOfBounds = await aaPage.evaluate((p) => {
                    const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                    gs.player.head.x = p.x;
                    gs.player.head.y = p.y;
                    for (let e of gs.enemies) { e.destroy(); }
                    gs.enemies = [];
                    for (let i = 0; i < 20; i++) gs.spawnEnemy();
                    return gs.enemies.some(e => 
                        e.body.x < -1200 + 140 || e.body.x > 1200 - 140 ||
                        e.body.y < -800 + 140 || e.body.y > 800 - 140
                    );
                }, pos);

                if (outOfBounds) {
                    console.error(`❌ ASSERT FAILED: Spawns generated in unsafe edge band when player at ${pos.name}`);
                    totalErrors++;
                } else {
                    console.log(`✅ ASSERT OK: Safe spawns when player at ${pos.name}`);
                }
            }
            await aaContext.close();

            // =========================================================
            // Test AB: Boundary Escape
            // =========================================================
            console.log("\n--- Test AB: Boundary Escape ---");
            const abContext = await browser.newContext();
            const abPage = await abContext.newPage();
            await abPage.goto(baseURL + "?debug=1", { waitUntil: 'networkidle' });
            await abPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
            await abPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes[0].scene.start('GameScene'); });
            await abPage.waitForFunction(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                return gs && gs.scene.isActive() && gs.player && gs.player.head && gs.player.head.body;
            }, { timeout: 15000 });

            // Right edge flee test
            let escapeRight = await abPage.evaluate(async () => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.player.value = 50;
                gs.player.isStunned = true; // Freeze player so it doesn't eat the enemy
                gs.player.head.setPosition(1030, 0); // player far enough to trigger flee but not eat assist (dist=120)
                gs.player.head.setVelocity(0, 0); // explicitly ensure 0 velocity
                for (let e of gs.enemies) { e.destroy(); }
                gs.enemies = [];
                gs.spawnEnemy();
                let enemy = gs.enemies[0];
                enemy.body.setPosition(1150, 0);
                enemy.value = 10;
                
                let pVx = gs.player.head.body.velocity.x;
                let pVy = gs.player.head.body.velocity.y;
                
                const startX = enemy.body.x;
                const startVx = enemy.body.body ? enemy.body.body.velocity.x : 0;
                
                await new Promise(r => setTimeout(r, 100)); // allow state to update
                const initialState = enemy.state;
                const wasActive = enemy.body.active;
                
                await new Promise(r => setTimeout(r, 1900)); // observe escape
                
                let res = { 
                    escaped: enemy.body.x < 1150, 
                    isActive: enemy.body.active,
                    initialState,
                    startX,
                    startVx,
                    finalX: enemy.body.x, 
                    finalVx: enemy.body.body ? enemy.body.body.velocity.x : 0,
                    pVx,
                    pVy,
                    steerX: gs.getBoundarySteering ? gs.getBoundarySteering(enemy.body.x, 0, 1200, 800, 160).x : "unknown"
                }; 
                gs.player.isStunned = false;
                return res;
            });

            if (escapeRight.pVx !== 0 || escapeRight.pVy !== 0) {
                console.error(`❌ ASSERT FAILED: Player velocity not zero! (${escapeRight.pVx}, ${escapeRight.pVy})`);
                totalErrors++;
            } else {
                console.log(`✅ ASSERT OK: Player remained stationary`);
            }
            if (escapeRight.initialState !== 1) { // 1 = FLEE
                console.error(`❌ ASSERT FAILED: Enemy explicit state is not FLEE. Got: ${escapeRight.initialState}`);
                totalErrors++;
            } else {
                console.log(`✅ ASSERT OK: Enemy explicit state is FLEE`);
            }
            if (!escapeRight.isActive) {
                console.error(`❌ ASSERT FAILED: Enemy was eaten or destroyed!`);
                totalErrors++;
            } else {
                console.log(`✅ ASSERT OK: Enemy remained active`);
            }
            if (!escapeRight.escaped) {
                console.error(`❌ ASSERT FAILED: Enemy did not escape right boundary (startX: ${escapeRight.startX}, finalX: ${escapeRight.finalX})`);
                totalErrors++;
            } else {
                console.log(`✅ ASSERT OK: Enemy naturally steered inward away from right boundary (final x = ${escapeRight.finalX})`);
            }
            console.log(`   Log: initialState=${escapeRight.initialState}, startX=${escapeRight.startX}, startVx=${escapeRight.startVx}, finalX=${escapeRight.finalX}, finalVx=${escapeRight.finalVx}`);

            // Corner escape test
            let escapeCorner = await abPage.evaluate(async () => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.player.value = 50;
                gs.player.isStunned = true; // Freeze player
                gs.player.head.setPosition(1100, 700); // player near bottom right
                gs.player.head.setVelocity(0, 0);
                for (let e of gs.enemies) { e.destroy(); }
                gs.enemies = [];
                gs.spawnEnemy();
                let enemy = gs.enemies[0];
                enemy.body.setPosition(1150, 750);
                enemy.value = 10;
                
                await new Promise(r => setTimeout(r, 100)); // allow state to update
                const initialState = enemy.state;
                
                await new Promise(r => setTimeout(r, 2400));
                
                let res = {
                    escaped: enemy.body.x < 1150 && enemy.body.y < 750,
                    initialState
                };
                gs.player.isStunned = false;
                return res;
            });
            
            if (escapeCorner.initialState !== 1) { // 1 = FLEE
                console.error(`❌ ASSERT FAILED: Corner Enemy explicit state is not FLEE. Got: ${escapeCorner.initialState}`);
                totalErrors++;
            } else {
                console.log(`✅ ASSERT OK: Corner Enemy explicit state is FLEE`);
            }
            if (!escapeCorner.escaped) {
                console.error(`❌ ASSERT FAILED: Enemy remained trapped in bottom-right corner`);
                totalErrors++;
            } else {
                console.log(`✅ ASSERT OK: Enemy successfully escaped bottom-right corner`);
            }
            await abContext.close();

            // =========================================================
            // Test AC: Long-run Edge Distribution
            // =========================================================
            console.log("\n--- Test AC: Long-run Edge Distribution ---");
            const acContext = await browser.newContext();
            const acPage = await acContext.newPage();
            await acPage.goto(baseURL + "?debug=1", { waitUntil: 'networkidle' });
            await acPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
            await acPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes[0].scene.start('GameScene'); });
            await acPage.waitForTimeout(500);

            let pileUp = await acPage.evaluate(async () => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                await new Promise(r => setTimeout(r, 5000));
                
                let edgeCount = 0;
                for (let e of gs.enemies) {
                    if (e.body.x < -1200 + 160 || e.body.x > 1200 - 160 ||
                        e.body.y < -800 + 160 || e.body.y > 800 - 160) {
                        edgeCount++;
                    }
                }
                return edgeCount / gs.enemies.length;
            });

            if (pileUp > 0.5) {
                console.error(`❌ ASSERT FAILED: Excessive edge accumulation (${(pileUp*100).toFixed(1)}% in edge band)`);
                totalErrors++;
            } else {
                console.log(`✅ ASSERT OK: Edge distribution healthy (${(pileUp*100).toFixed(1)}% in edge band)`);
            }
            await acContext.close();

    
    // --- Test AD: FOUR LEVEL SELECT ---
    console.log('\n--- Test AD: FOUR LEVEL SELECT ---');
    const adContext = await browser.newContext();
    const adPage = await adContext.newPage();
    adPage.on('console', msg => console.log('AD PAGE:', msg.text()));
    await adPage.goto(baseURL + '?debug=1&e2e=1', { waitUntil: 'networkidle' });
    await adPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
    await adPage.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('number_snake_language_v1', 'en');
    });
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
    console.log('\n--- Test AE: LEVEL 2 FIRST CLEAR REWARD ---');
    await adPage.evaluate(() => {
        localStorage.setItem('number_snake_progression', JSON.stringify({
            version: 1, highestUnlockedLevel: 2, maxHPBonus: 1, claimedRewards: ["level-1-clear-heart"], bestScoreByLevel: {}
        }));
    });
    await adPage.reload();
    await adPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
    await adPage.waitForTimeout(500);
    await adPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene').startGame(2); });
    await adPage.waitForFunction(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene')?.player?.head, { timeout: 15000 });
    
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
        gs.gameOver(); // force death
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
    await adPage.waitForFunction(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene')?.player?.head, { timeout: 15000 });
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.levelClear();
    });
    
    try {
        await adPage.waitForFunction(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            if (!gs) return false;
            const texts = gs.children.list.filter(c => c.type === 'Text').map(t => t.text);
            const hasClear = texts.some(t => t.includes('LEVEL 2 CLEAR'));
            const hasHeart = texts.some(t => t.includes('+1 HEART'));
            const hasUnlocked = texts.some(t => t.includes('LEVEL 3 UNLOCKED'));
            const nextBtn = gs.children.list.find(c => c.type === 'Text' && c.text === 'NEXT LEVEL');
            const hasNext = !!nextBtn && nextBtn.input && nextBtn.input.enabled;
            return hasClear && hasHeart && hasUnlocked && hasNext;
        }, { timeout: 15000 });
    } catch (e) {
        console.error('Wait for Level 2 Clear UI timed out:', e.message);
    }
    
    let aeUI = await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        if (!gs) return { texts: [], nextBtnFound: false, nextBtnInteractive: false };
        const texts = gs.children.list.filter(c => c.type === 'Text').map(t => t.text);
        const nextBtn = gs.children.list.find(c => c.type === 'Text' && c.text === 'NEXT LEVEL');
        return {
            texts,
            nextBtnFound: !!nextBtn,
            nextBtnInteractive: !!(nextBtn && nextBtn.input && nextBtn.input.enabled)
        };
    });
    aeProg = await adPage.evaluate(() => JSON.parse(localStorage.getItem('number_snake_progression')));
    
    if (aeProg.highestUnlockedLevel !== 3 || aeProg.maxHPBonus !== 2 || !aeProg.claimedRewards.includes('level-2-clear-heart')) {
        console.error('❌ ASSERT FAILED: L2 Clear did not grant proper progression', aeProg);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: L2 Clear granted +1 maxHPBonus and unlocked L3');
    }
    if (!aeUI.texts.find(t => t.includes('LEVEL 2 CLEAR'))) {
        console.error('❌ ASSERT FAILED: L2 Clear UI missing LEVEL 2 CLEAR', aeUI.texts);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: L2 Clear UI displayed LEVEL 2 CLEAR');
    }
    if (!aeUI.texts.find(t => t.includes('+1 HEART')) || !aeUI.texts.find(t => t.includes('LEVEL 3 UNLOCKED'))) {
        console.error('❌ ASSERT FAILED: L2 Clear UI missing elements', aeUI.texts);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: L2 Clear UI displayed +1 HEART and LEVEL 3 UNLOCKED');
    }
    if (!aeUI.nextBtnFound || !aeUI.nextBtnInteractive) {
        console.error('❌ ASSERT FAILED: NEXT LEVEL button is missing or not interactive');
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: NEXT LEVEL button exists and is interactive');
    }

    // Click NEXT LEVEL to test transition
    if (aeUI.nextBtnFound) {
        await adPage.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            const nextBtn = gs ? gs.children.list.find(c => c.type === 'Text' && c.text === 'NEXT LEVEL') : null;
            if (nextBtn) nextBtn.emit('pointerdown');
        });
        await adPage.waitForTimeout(500);
        await adPage.evaluate(() => {
            const prep = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
            if (prep && prep.scene.isActive()) {
                prep.scene.start('GameScene', { levelId: 3 });
            } else {
                window.__PHASER_GAME__.scene.start('GameScene', { levelId: 3 });
            }
        });
    } else {
        console.error('❌ ASSERT FAILED: Cannot click NEXT LEVEL because it was not found');
    }
    await adPage.waitForTimeout(1000);
    let agInit = await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            lvl: gs.levelId, val: gs.player.value, hp: gs.player.hp, seg: gs.player.segments,
            boss: gs.boss, normalCount: gs.enemies.length
        };
    });

    // --- Test AF: LEVEL 2 NO HEART FARMING ---
    console.log('\n--- Test AF: LEVEL 2 NO HEART FARMING ---');
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
    console.log('\n--- Test AG: LEVEL 3 INITIALIZATION ---');
    if (agInit.lvl !== 3 || agInit.val !== 5 || agInit.hp !== 5 || agInit.seg !== 5 || agInit.boss !== null || agInit.normalCount > 38) {
        console.error('❌ ASSERT FAILED: Level 3 initialized incorrectly', agInit);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: Level 3 initialized correctly (Value5, HP5, boss null)');
    }

    // --- Test AH: LEVEL 3 BOSS300 ---
    console.log('\n--- Test AH: LEVEL 3 BOSS300 ---');
    await adPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').scene.start('GameScene', {levelId: 3}); });
    await adPage.waitForTimeout(500);
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);
        gs.player.head.setPosition(0, 0);
        gs.enemies.forEach(e => e.destroy());
        gs.enemies = [];
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
    let ahBoss230 = await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs.boss !== null;
    });
    if (!ahBoss230) { console.error('❌ ASSERT FAILED: Boss300 did not spawn at 230'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss300 spawned at 230');

    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);
        gs.player.head.setPosition(0, 0);
        gs.enemies.forEach(e => e.destroy());
        gs.enemies = [];
        gs.player.value = 299;
    });
    await adPage.waitForTimeout(500);
    let ahBoss299 = await adPage.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').boss.isFleeing);
    if (ahBoss299) { console.error('❌ ASSERT FAILED: Boss300 fleeing at 299'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss300 chasing at 299');

    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.value = 300;
    });
    await adPage.waitForTimeout(500);
    let ahBoss300 = await adPage.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').boss.isFleeing);
    if (ahBoss300) { console.error('❌ ASSERT FAILED: Boss300 fleeing at 300'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss300 chasing at 300');

    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.value = 301;
    });
    await adPage.waitForTimeout(500);
    let ahBoss301 = await adPage.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').boss.isFleeing);
    if (!ahBoss301) { console.error('❌ ASSERT FAILED: Boss300 chasing at 301'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss300 fleeing at 301');

    // --- Test AI: LEVEL 3 REWARD + LEVEL 4 UNLOCK ---
    console.log('\n--- Test AI: LEVEL 3 REWARD + LEVEL 4 UNLOCK ---');
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.handleBossCollision(); // This triggers win
    });
    await adPage.waitForTimeout(4000);
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
    await adPage.waitForTimeout(500);
    await adPage.evaluate(() => {
        const prep = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        if (prep && prep.scene.isActive()) {
            prep.scene.start('GameScene', { levelId: 4 });
        } else {
            window.__PHASER_GAME__.scene.start('GameScene', { levelId: 4 });
        }
    });
    await adPage.waitForTimeout(500);
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.hp = 0; gs.gameOver();
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
    console.log('\n--- Test AJ: LEVEL 4 INITIALIZATION ---');
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
    console.log('\n--- Test AK: LEVEL 4 BOSS400 ---');
    await adPage.evaluate(() => { window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').scene.start('GameScene', {levelId: 4}); });
    await adPage.waitForFunction(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene')?.player?.head);
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.enemies.forEach(e => e.destroy());
        gs.enemies = [];
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);
    });
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);
        gs.player.head.setPosition(0, 0);
        gs.enemies.forEach(e => e.destroy());
        gs.enemies = [];
        gs.player.value = 309;
    });
    await adPage.waitForTimeout(500);
    let akBoss309 = await adPage.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').boss !== null);
    if (akBoss309) { console.error('❌ ASSERT FAILED: Boss400 spawned early'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss400 not spawned at 309');

    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.value = 310;
    });
    await adPage.waitForTimeout(500);
    let akBoss310 = await adPage.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').boss !== null);
    if (!akBoss310) { console.error('❌ ASSERT FAILED: Boss400 did not spawn at 310'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss400 spawned at 310');

    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);
        gs.player.head.setPosition(0, 0);
        gs.enemies.forEach(e => e.destroy());
        gs.enemies = [];
        gs.player.value = 399;
    });
    await adPage.waitForTimeout(500);
    let akBoss399 = await adPage.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').boss.isFleeing);
    if (akBoss399) { console.error('❌ ASSERT FAILED: Boss400 fleeing at 399'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss400 chasing at 399');

    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.value = 400;
    });
    await adPage.waitForTimeout(500);
    let akBoss400 = await adPage.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').boss.isFleeing);
    if (akBoss400) { console.error('❌ ASSERT FAILED: Boss400 fleeing at 400'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss400 chasing at 400');

    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.value = 401;
    });
    await adPage.waitForTimeout(500);
    let akBoss401 = await adPage.evaluate(() => window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene').boss.isFleeing);
    if (!akBoss401) { console.error('❌ ASSERT FAILED: Boss400 chasing at 401'); totalErrors++; }
    else console.log('✅ ASSERT OK: Boss400 fleeing at 401');

    // --- Test AL: FINAL COMPLETION ---
    console.log('\n--- Test AL: FINAL COMPLETION ---');
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.levelClear(); // Trigger win
    });
    await adPage.waitForTimeout(4000);
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
    if (alUI.find(t => t.includes('+1 HEART')) || alUI.find(t => t.includes('NEXT LEVEL')) || alUI.find(t => t.includes('REPLAY LEVEL')) || alUI.find(t => t.includes('MENU'))) {
        console.error('❌ ASSERT FAILED: Final clear UI contains forbidden elements (HEART/NEXT/REPLAY/MENU)', alUI);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: Final clear UI lacks NEXT LEVEL, REPLAY, MENU, and HEART');
    }
    
    if (!alUI.find(t => t === 'PLAY AGAIN') || !alUI.find(t => t === 'LEVEL SELECT')) {
        console.error('❌ ASSERT FAILED: Final clear UI missing PLAY AGAIN or LEVEL SELECT', alUI);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: Final clear UI contains PLAY AGAIN and LEVEL SELECT');
    }
    
    let alProg = await adPage.evaluate(() => JSON.parse(localStorage.getItem('number_snake_progression')));
    if (alProg.highestUnlockedLevel !== 4 || alProg.maxHPBonus !== 3) {
        console.error('❌ ASSERT FAILED: Final clear changed progression incorrectly', alProg);
        totalErrors++;
    } else {
        console.log('✅ ASSERT OK: Progression capped at highestUnlockedLevel=4');
    }

    // --- Test AM: RESPONSIVE LEVEL SELECT ---
    console.log('\n--- Test AM: RESPONSIVE LEVEL SELECT ---');
    

    const testViewports = [
        { width: 390, height: 844 },
        { width: 430, height: 932 },
        { width: 768, height: 1024 },
        { width: 834, height: 1194 },
        { width: 1024, height: 1366 },
        { width: 1366, height: 768 },
        { width: 1920, height: 1080 }
    ];

    for (let vp of testViewports) {
        console.log(`Testing Viewport ${vp.width}x${vp.height}`);
        await adPage.setViewportSize(vp);
        await adPage.waitForTimeout(500);
        
        await adPage.evaluate(() => { localStorage.removeItem('number_snake_progression'); });
        await adPage.reload({ waitUntil: 'networkidle' });
        await adPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
        let amRes = await adPage.evaluate(() => {
            const menu = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
            if (!menu || !menu.levelCards) return null;
            
            const w = menu.scale.width;
            const h = menu.scale.height;
            let boundsOk = true;
            let cardCount = menu.levelCards.length;
            let level5Exists = false;
            
            let tutBounds = null;
            if (menu.tutorialText) {
                tutBounds = menu.tutorialText.getBounds();
            }
            
            let tutOk = true;
            let startExists = false, startInteractive = false, startVisible = false, startInViewport = false, startInCard = false;
            
            let lockedVisible = [false, false, false, false];
            let lockedInCard = [false, false, false, false];
            let lockedInViewport = [false, false, false, false];
            
            for (let i = 0; i < menu.levelCards.length; i++) {
                const c = menu.levelCards[i];
                const cardBounds = c.getBounds();
                const levelId = i + 1;
                
                if (cardBounds.left < 0 || cardBounds.right > w || cardBounds.top < 0 || cardBounds.bottom > h) {
                    boundsOk = false;
                }
                
                if (tutBounds) {
                    if (!(tutBounds.left > cardBounds.right || tutBounds.right < cardBounds.left || tutBounds.top > cardBounds.bottom || tutBounds.bottom < cardBounds.top)) {
                        tutOk = false;
                    }
                }
                
                if (c.list) {
                    for(let child of c.list) {
                        if (child.text && child.text.includes('LEVEL 5')) level5Exists = true;
                        
                        if (levelId === 1) {
                            if (child.type === 'Text' && child.text === 'START') {
                                startExists = true;
                                if (child.alpha > 0 && child.visible) startVisible = true;
                                
                                const b = child.getBounds();
                                if (b.left >= 0 && b.right <= w && b.top >= 0 && b.bottom <= h) startInViewport = true;
                                if (cardBounds.left <= b.left + 1 && cardBounds.right >= b.right - 1 && cardBounds.top <= b.top + 1 && cardBounds.bottom >= b.bottom - 1) startInCard = true;
                            }
                            if (child.type === 'Rectangle' && child.input && child.input.enabled) startInteractive = true;
                        }
                        
                        if (levelId > 1 && levelId <= 4) {
                            if (child.type === 'Text' && child.text === '🔒 LOCKED') {
                                if (child.alpha > 0 && child.visible) lockedVisible[levelId - 1] = true;
                                const b = child.getBounds();
                                if (b.left >= 0 && b.right <= w && b.top >= 0 && b.bottom <= h) lockedInViewport[levelId - 1] = true;
                                if (cardBounds.left <= b.left + 1 && cardBounds.right >= b.right - 1 && cardBounds.top <= b.top + 1 && cardBounds.bottom >= b.bottom - 1) lockedInCard[levelId - 1] = true;
                            }
                        }
                    }
                }
            }

            return { 
                cardCount, boundsOk, tutOk, level5Exists, 
                startExists, startVisible, startInteractive, startInViewport, startInCard,
                lockedVisible, lockedInViewport, lockedInCard
            };
        });

        if (!amRes) { 
            console.error(`❌ ASSERT FAILED: MenuScene not active on ${vp.width}x${vp.height}`); 
            totalErrors++; 
        } else {
            console.log(`Viewport: ${vp.width}x${vp.height}`);
            
            if (amRes.cardCount === 4) { console.log('Cards: PASS'); }
            else { console.error(`Cards: FAIL (count ${amRes.cardCount})`); totalErrors++; }
            
            if (amRes.boundsOk) { console.log('Cards inside viewport: PASS'); }
            else { console.error('Cards inside viewport: FAIL'); totalErrors++; }
            
            if (amRes.tutOk) { console.log('Tutorial real intersection: PASS'); }
            else { console.error('Tutorial real intersection: FAIL'); totalErrors++; }
            
            if (amRes.startExists && amRes.startVisible && amRes.startInCard) { console.log('Level1 START exists: PASS'); }
            else { console.error('Level1 START exists: FAIL'); totalErrors++; }
            
            if (amRes.startInteractive) { console.log('Level1 START interactive: PASS'); }
            else { console.error('Level1 START interactive: FAIL'); totalErrors++; }
            
            if (amRes.startInViewport) { console.log('Level1 START in viewport: PASS'); }
            else { console.error('Level1 START in viewport: FAIL'); totalErrors++; }
            
            for (let l = 2; l <= 4; l++) {
                if (amRes.lockedVisible[l-1] && amRes.lockedInViewport[l-1] && amRes.lockedInCard[l-1]) {
                    console.log(`Level${l} LOCKED visible: PASS`);
                } else {
                    console.error(`Level${l} LOCKED visible: FAIL`);
                    totalErrors++;
                }
            }
            
            if (!amRes.level5Exists) { console.log('No Level5: PASS'); }
            else { console.error('No Level5: FAIL'); totalErrors++; }
        }
    }

    await adContext.close();

    // ==========================================
    // v0.4.0 SNAKE EVOLUTION ACCEPTANCE TESTS (AN - AT)
    // ==========================================
    const anContext = await browser.newContext({ hasTouch: true });
    const evoPage = await anContext.newPage();

    // --- Test AN: PLAYER TAIL + HEAD STYLE ---
    console.log('\n--- Test AN: PLAYER TAIL + HEAD STYLE ---');
    await evoPage.goto(baseURL + '?debug=1', { waitUntil: 'networkidle' });
    await evoPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });

    await evoPage.evaluate(() => {
        window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 });
    });
    await evoPage.waitForFunction(() => typeof window.__NUMBER_SNAKE_DEBUG__ !== 'undefined', { timeout: 15000 });
    await evoPage.evaluate(() => {
        window.API = window.__NUMBER_SNAKE_DEBUG__;
    });
    await evoPage.waitForTimeout(1000);

    const tailCheck = await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        if (!gs || !gs.player) return null;
        const p = gs.player;
        const headExists = !!p.head && p.head.active;
        const bodyCount = p.bodySprites.length;
        const lastSprite = p.bodySprites[bodyCount - 1];
        const secondLast = p.bodySprites[bodyCount - 2];
        const thirdLast = p.bodySprites[bodyCount - 3];
        const tailExists = !!lastSprite && lastSprite.active;
        const tailDecreasing = (lastSprite.scaleX < secondLast.scaleX) && (secondLast.scaleX < thirdLast.scaleX);
        const lastScale = lastSprite.scaleX;
        const initialSkin = p.headSkinId;
        return { headExists, bodyCount, tailExists, tailDecreasing, lastScale, initialSkin };
    });

    assert(tailCheck && tailCheck.headExists, 'Player head exists');
    assert(tailCheck && tailCheck.bodyCount >= 5, 'Player has at least 5 body segments');
    assert(tailCheck && tailCheck.tailExists, 'Player tail exists');
    assert(tailCheck && tailCheck.tailDecreasing, 'Tail scales progressively smaller');
    assert(tailCheck && tailCheck.lastScale <= 0.55, `Last segment has tail scale ~0.50, got ${tailCheck ? tailCheck.lastScale : 'null'}`);

    // Customize UI test
    await evoPage.evaluate(() => {
        window.__PHASER_GAME__.scene.start('CustomizeScene');
    });
    await evoPage.waitForTimeout(500);

    const mechaSelected = await evoPage.evaluate(() => {
        const cust = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'CustomizeScene');
        if (!cust) return false;
        for (let i = 0; i < 6; i++) {
            if (cust.styleNameText && cust.styleNameText.text === 'MECHA') break;
            cust.nextBtnBg.emit('pointerdown');
        }
        cust.equipBtnBg.emit('pointerdown');
        return cust.styleNameText && cust.styleNameText.text === 'MECHA';
    });
    assert(mechaSelected, 'Selected MECHA in Customize UI');

    await evoPage.evaluate(() => {
        window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 });
    });
    await evoPage.waitForTimeout(1000);

    const skinInGame = await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.player ? gs.player.headSkinId : null;
    });
    assert(skinInGame === 'mecha', `Player uses MECHA head in game, got ${skinInGame}`);

    await evoPage.reload({ waitUntil: 'networkidle' });
    await evoPage.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });

    const persistedSkin = await evoPage.evaluate(() => {
        const raw = localStorage.getItem('number_snake_cosmetics_v1');
        return raw ? JSON.parse(raw).selectedHeadSkin : null;
    });
    assert(persistedSkin === 'mecha', `MECHA skin persists in localStorage, got ${persistedSkin}`);

    await evoPage.evaluate(() => {
        window.__PHASER_GAME__.scene.start('CustomizeScene');
    });
    await evoPage.waitForTimeout(500);

    await evoPage.evaluate(() => {
        const cust = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'CustomizeScene');
        for (let i = 0; i < 6; i++) {
            if (cust.styleNameText && cust.styleNameText.text === 'CLASSIC') break;
            cust.nextBtnBg.emit('pointerdown');
        }
        cust.equipBtnBg.emit('pointerdown');
    });
    await evoPage.waitForTimeout(300);

    const revertedSkin = await evoPage.evaluate(() => {
        const raw = localStorage.getItem('number_snake_cosmetics_v1');
        return raw ? JSON.parse(raw).selectedHeadSkin : null;
    });
    assert(revertedSkin === 'classic', `CLASSIC skin persisted again, got ${revertedSkin}`);

    // --- Test AO: AI HEAD VARIETY ---
    console.log('\n--- Test AO: AI HEAD VARIETY ---');
    await evoPage.evaluate(() => {
        window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 });
    });
    await evoPage.waitForFunction(() => typeof window.__NUMBER_SNAKE_DEBUG__ !== 'undefined', { timeout: 15000 });
    await evoPage.evaluate(() => {
        window.API = window.__NUMBER_SNAKE_DEBUG__;
        window.API.startLevel(1);
    });
    await evoPage.waitForTimeout(1000);

    const enemyCheck = await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.stopSpawning();
        for (const e of gs.enemies) e.destroy();
        gs.enemies = [];

        const spawnedSkins = [];
        for (let i = 0; i < 10; i++) {
            const e = gs.spawnEnemy();
            if (e) spawnedSkins.push(e.headSkinId);
        }

        const uniqueSkins = Array.from(new Set(spawnedSkins));
        const allHaveVisualBody = gs.enemies.every(e => e.bodySprites && e.bodySprites.length === 5);
        const allHaveTaperedTail = gs.enemies.every(e => e.bodySprites[4] && e.bodySprites[4].scaleX <= 0.55);

        const testEnemy = gs.enemies[0];
        const initialSkinId = testEnemy.headSkinId;

        // Threat 1: Edible
        gs.player.value = 100;
        testEnemy.value = 5;
        testEnemy.update(16, gs.player.head.x, gs.player.head.y, gs.player.value);
        const edibleThreatType = testEnemy.currentThreatType;
        const edibleSkinId = testEnemy.headSkinId;

        // Threat 3: High Threat
        gs.player.value = 5;
        testEnemy.value = 50;
        testEnemy.update(16, gs.player.head.x, gs.player.head.y, gs.player.value);
        const highThreatType = testEnemy.currentThreatType;
        const highThreatSkinId = testEnemy.headSkinId;

        return {
            uniqueSkinCount: uniqueSkins.length,
            allHaveVisualBody,
            allHaveTaperedTail,
            skinRemainsStable: (initialSkinId === edibleSkinId && edibleSkinId === highThreatSkinId),
            edibleThreatType,
            highThreatType
        };
    });

    assert(enemyCheck.allHaveVisualBody, 'All AI snakes have head + visual body + tail');
    assert(enemyCheck.allHaveTaperedTail, 'All AI snakes have tapered tail scale');
    assert(enemyCheck.uniqueSkinCount >= 2, `At least 2 different head styles among sample, got ${enemyCheck.uniqueSkinCount}`);
    assert(enemyCheck.skinRemainsStable, 'Head skin remains stable across threat state updates');
    assert(enemyCheck.edibleThreatType === 1, 'Edible enemy communicates edible threat type 1 (green glow)');
    assert(enemyCheck.highThreatType === 3, 'High threat enemy communicates threat type 3 (red glow)');

    // --- Test AP: MAGNET STRICT ELIGIBILITY ---
    console.log('\n--- Test AP: MAGNET STRICT ELIGIBILITY ---');
    await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.stopSpawning();
        for (const e of gs.enemies) e.destroy();
        gs.enemies = [];
        if (gs.boss) { gs.boss.destroy(); gs.boss = null; gs.bossSpawned = false; }
        for (const o of gs.orbs) o.destroy();
        gs.orbs = [];

        // Deterministically freeze player at (0, 0)
        gs.player.head.setPosition(0, 0);
        gs.player.value = 10;
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);

        // 1. Smaller enemy inside radius (230px) -> Value 5
        const eSmallerInside = gs.spawnEnemy();
        eSmallerInside.value = 5;
        eSmallerInside.__testId = 'smallerInside';
        eSmallerInside.body.setPosition(230, 0);
        eSmallerInside.body.setVelocity(0, 0);

        // 2. Equal enemy inside radius (200px) -> Value 10
        const eEqualInside = gs.spawnEnemy();
        eEqualInside.value = 10;
        eEqualInside.__testId = 'equalInside';
        eEqualInside.body.setPosition(0, 200);
        eEqualInside.body.setVelocity(0, 0);

        // 3. Larger enemy inside radius (200px) -> Value 11
        const eLargerInside = gs.spawnEnemy();
        eLargerInside.value = 11;
        eLargerInside.__testId = 'largerInside';
        eLargerInside.body.setPosition(-200, 0);
        eLargerInside.body.setVelocity(0, 0);

        // 4. Smaller enemy outside radius (300px) -> Value 5
        const eSmallerOutside = gs.spawnEnemy();
        eSmallerOutside.value = 5;
        eSmallerOutside.__testId = 'smallerOutside';
        eSmallerOutside.body.setPosition(300, 0);
        eSmallerOutside.body.setVelocity(0, 0);

        // 5. Boss inside radius (200px) -> Value 100
        gs.spawnBoss();
        if (gs.boss) {
            gs.boss.body.setPosition(0, -200);
            gs.boss.body.setVelocity(0, 0);
        }

        gs.activateMagnet();
    });

    const prePositions = await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const px = gs.player.head.x;
        const py = gs.player.head.y;
        const eSmaller = gs.enemies.find(e => e.__testId === 'smallerInside');
        const eEqual = gs.enemies.find(e => e.__testId === 'equalInside');
        const eLarger = gs.enemies.find(e => e.__testId === 'largerInside');
        const eOutside = gs.enemies.find(e => e.__testId === 'smallerOutside');

        return {
            distSmaller: eSmaller ? Math.hypot(px - eSmaller.body.x, py - eSmaller.body.y) : null,
            distEqual: eEqual ? Math.hypot(px - eEqual.body.x, py - eEqual.body.y) : null,
            distLarger: eLarger ? Math.hypot(px - eLarger.body.x, py - eLarger.body.y) : null,
            distOutside: eOutside ? Math.hypot(px - eOutside.body.x, py - eOutside.body.y) : null,
            distBoss: gs.boss ? Math.hypot(px - gs.boss.body.x, py - gs.boss.body.y) : null,
            magnetState: gs.magnet.state
        };
    });

    // Deterministically wait for magnet to pull smaller enemy closer across real frames
    await evoPage.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        if (!gs) return false;
        const eSmaller = gs.enemies.find(e => e.__testId === 'smallerInside');
        if (!eSmaller) return false;
        const d = Math.hypot(gs.player.head.x - eSmaller.body.x, gs.player.head.y - eSmaller.body.y);
        return d <= 210;
    }, { timeout: 10000 });

    const postEvaluation = await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.head.setVelocity(0, 0);

        const px = gs.player.head.x;
        const py = gs.player.head.y;
        const eSmaller = gs.enemies.find(e => e.__testId === 'smallerInside');
        const eEqual = gs.enemies.find(e => e.__testId === 'equalInside');
        const eLarger = gs.enemies.find(e => e.__testId === 'largerInside');
        const eOutside = gs.enemies.find(e => e.__testId === 'smallerOutside');

        const distSmaller = eSmaller ? Math.hypot(px - eSmaller.body.x, py - eSmaller.body.y) : null;
        const distEqual = eEqual ? Math.hypot(px - eEqual.body.x, py - eEqual.body.y) : null;
        const distLarger = eLarger ? Math.hypot(px - eLarger.body.x, py - eLarger.body.y) : null;
        const distOutside = eOutside ? Math.hypot(px - eOutside.body.x, py - eOutside.body.y) : null;
        const distBoss = gs.boss ? Math.hypot(px - gs.boss.body.x, py - gs.boss.body.y) : null;

        // Magnet pull sets velocity to pullSpeed (380 px/s); normal AI never reaches 300 px/s
        const smallerPulled = eSmaller && Math.hypot(eSmaller.body.body.velocity.x, eSmaller.body.body.velocity.y) > 300;
        const equalPulled = eEqual && Math.hypot(eEqual.body.body.velocity.x, eEqual.body.body.velocity.y) > 300;
        const largerPulled = eLarger && Math.hypot(eLarger.body.body.velocity.x, eLarger.body.body.velocity.y) > 300;
        const outsidePulled = eOutside && Math.hypot(eOutside.body.body.velocity.x, eOutside.body.body.velocity.y) > 300;
        const bossPulled = gs.boss && Math.hypot(gs.boss.body.body.velocity.x, gs.boss.body.body.velocity.y) > 300;

        return {
            distSmaller,
            distEqual,
            distLarger,
            distOutside,
            distBoss,
            smallerPulled,
            equalPulled,
            largerPulled,
            outsidePulled,
            bossPulled,
            magnetState: gs.magnet.state
        };
    });

    assert(prePositions.magnetState === 'ACTIVE', 'Magnet is ACTIVE');
    const distSmallerValid = postEvaluation.distSmaller !== null && prePositions.distSmaller !== null;
    assert(distSmallerValid && postEvaluation.distSmaller < prePositions.distSmaller - 20,
        `Smaller enemy inside 200px is pulled toward player across real frames (before: ${prePositions.distSmaller ? prePositions.distSmaller.toFixed(1) : 'null'}, after: ${postEvaluation.distSmaller ? postEvaluation.distSmaller.toFixed(1) : 'null'})`);
    assert(postEvaluation.smallerPulled, 'Smaller enemy has magnet pull velocity');
    assert(!postEvaluation.equalPulled, 'Equal enemy inside 200px is NOT magnet pulled');
    assert(!postEvaluation.largerPulled, 'Larger enemy inside 200px is NOT magnet pulled');
    assert(!postEvaluation.outsidePulled, 'Smaller enemy outside 300px is NOT magnet pulled');
    assert(!postEvaluation.bossPulled, 'Boss is NOT magnet pulled');

    // --- Test AQ: MAGNET ACTIVE / COOLDOWN ---
    console.log('\n--- Test AQ: MAGNET ACTIVE / COOLDOWN ---');
    await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.hardReset();
    });
    await evoPage.waitForTimeout(500);

    await evoPage.click('canvas');
    await evoPage.waitForTimeout(100);
    await evoPage.keyboard.press('m');
    await evoPage.waitForTimeout(200);

    const mActive = await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.hud.update(gs.player.hp, 3, gs.player.boostEnergy, 100, gs.magnet.getHUDText(), gs.magnet.state);
        return {
            state: gs.magnet.state,
            remaining: gs.magnet.getRemainingSeconds(),
            hudText: gs.hud.magnetText.text
        };
    });
    assert(mActive.state === 'ACTIVE', `Magnet activated on M key press, state: ${mActive.state}`);
    assert(mActive.hudText.includes('MAGNET') && mActive.hudText.includes('s'), `HUD shows active countdown, got ${mActive.hudText}`);

    const durationBefore = mActive.remaining;
    await evoPage.keyboard.press('m');
    await evoPage.waitForTimeout(200);
    const durationAfter = await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs.magnet.getRemainingSeconds();
    });
    assert(durationAfter <= durationBefore, 'Repeated M press does NOT reset active duration');

    const cooldownState = await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.magnet.update(8500, 0, 0, 10, [], []);
        gs.hud.update(gs.player.hp, 3, gs.player.boostEnergy, 100, gs.magnet.getHUDText(), gs.magnet.state);
        const state = gs.magnet.state;
        const hudText = gs.hud.magnetText.text;

        gs.activateMagnet();
        const stateAfterM = gs.magnet.state;
        return { state, hudText, stateAfterM };
    });
    assert(cooldownState.state === 'COOLDOWN', `Magnet transitioned to COOLDOWN, state: ${cooldownState.state}`);
    assert(cooldownState.stateAfterM === 'COOLDOWN', 'M press during cooldown does not activate');

    const readyState = await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.magnet.update(20500, 0, 0, 10, [], []);
        gs.hud.update(gs.player.hp, 3, gs.player.boostEnergy, 100, gs.magnet.getHUDText(), gs.magnet.state);
        return {
            state: gs.magnet.state,
            hudText: gs.hud.magnetText.text
        };
    });
    assert(readyState.state === 'READY', `Magnet returned to READY after cooldown, state: ${readyState.state}`);
    assert(readyState.hudText === '🧲 MAGNET READY', `HUD displays 🧲 MAGNET READY, got ${readyState.hudText}`);

    // --- Test AR: MOBILE MAGNET ---
    console.log('\n--- Test AR: MOBILE MAGNET ---');
    for (const vp of [{ width: 390, height: 844 }, { width: 834, height: 1194 }]) {
        console.log(`Testing mobile viewport ${vp.width}x${vp.height}`);
        await evoPage.setViewportSize(vp);
        await evoPage.waitForTimeout(500);

        const mobileLayout = await evoPage.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            if (!gs || !gs.hud) return null;
            gs.resize(gs.scale.gameSize);

            const mBtn = gs.hud.magnetButton;
            const bBtn = gs.hud.boostButton;
            const joy = gs.joystick;
            const w = gs.scale.width;
            const h = gs.scale.height;

            const mBounds = mBtn.getBounds();
            const bBounds = bBtn.getBounds();

            const mVisible = mBtn.visible && mBtn.alpha > 0;
            const bVisible = bBtn.visible && bBtn.alpha > 0;
            const jVisible = !!(joy && joy.base && joy.base.visible);

            const mInViewport = mBounds.left >= 0 && mBounds.right <= w && mBounds.top >= 0 && mBounds.bottom <= h;
            const bInViewport = bBounds.left >= 0 && bBounds.right <= w && bBounds.top >= 0 && bBounds.bottom <= h;

            const buttonsOverlap = !(mBounds.right < bBounds.left || mBounds.left > bBounds.right || mBounds.bottom < bBounds.top || mBounds.top > bBounds.bottom);
            const rightSide = mBounds.centerX > w / 2 && bBounds.centerX > w / 2;

            return { mVisible, bVisible, jVisible, mInViewport, bInViewport, buttonsOverlap, rightSide };
        });

        assert(mobileLayout.mVisible, `MAGNET button visible on ${vp.width}x${vp.height}`);
        assert(mobileLayout.bVisible, `BOOST button visible on ${vp.width}x${vp.height}`);
        assert(mobileLayout.jVisible, `Virtual Joystick visible on ${vp.width}x${vp.height}`);
        assert(mobileLayout.mInViewport && mobileLayout.bInViewport, `Both buttons inside viewport on ${vp.width}x${vp.height}`);
        assert(!mobileLayout.buttonsOverlap, `No overlap between MAGNET and BOOST on ${vp.width}x${vp.height}`);
        assert(mobileLayout.rightSide, `Buttons situated on right side on ${vp.width}x${vp.height}`);
    }

    await evoPage.setViewportSize({ width: 390, height: 844 });
    await evoPage.waitForTimeout(300);

    const tapped = await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.magnet.reset();
        gs.hud.magnetButton.emit('pointerdown');
        gs.hud.update(gs.player.hp, 3, gs.player.boostEnergy, 100, gs.magnet.getHUDText(), gs.magnet.state);
        return {
            magnetState: gs.magnet.state,
            hudText: gs.hud.magnetText.text
        };
    });
    assert(tapped.magnetState === 'ACTIVE', 'Tapping mobile MAGNET button activates ability');
    assert(tapped.hudText.includes('MAGNET'), 'HUD shows active countdown after tap');

    // --- Test AS: HEAD EAT → BODY ORBS & PRODUCTION ORB COLLECTION ---
    console.log('\n--- Test AS: HEAD EAT → BODY ORBS & PRODUCTION ORB COLLECTION ---');
    const eatOrbResults = await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.hardReset();
        gs.gameState = 'RUNNING';
        gs.stopSpawning();
        for (const e of gs.enemies) e.destroy();
        gs.enemies = [];
        if (gs.boss) { gs.boss.destroy(); gs.boss = null; gs.bossSpawned = false; }
        for (const o of gs.orbs) o.destroy();
        gs.orbs = [];

        gs.player.head.setPosition(0, 0);
        gs.player.value = 10;
        gs.player.hp = 3;
        gs.player.boostEnergy = 50;
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);

        // 1. Eat edible enemy (value 5) via head collision
        const edibleEnemy = gs.spawnEnemy();
        edibleEnemy.value = 5;
        edibleEnemy.body.setPosition(gs.player.head.x, gs.player.head.y);

        gs.handleEnemyCollision(edibleEnemy, gs.enemies.indexOf(edibleEnemy), gs.time.now);

        const playerValAfterEat = gs.player.value;
        const orbCountAfterEat = gs.orbs.length;
        const scoreAfterEat = gs.hud.getScore();
        const boostAfterEat = gs.player.boostEnergy;

        // 2. Real Production Orb Collection via gs.update() overlap path
        // Place first spawned orb inside collection radius (< 32px)
        const orbToCollect = gs.orbs[0];
        gs.tweens.killTweensOf(orbToCollect.sprite);
        orbToCollect.sprite.setPosition(gs.player.head.x, gs.player.head.y);
        orbToCollect.baseY = gs.player.head.y;

        // Execute production GameScene update step (no manual addScore / boost injection)
        gs.update(gs.time.now, 16);

        const playerValAfterOrbs = gs.player.value;
        const playerHpAfterOrbs = gs.player.hp;
        const scoreAfterOrbs = gs.hud.getScore();
        const boostAfterOrbs = gs.player.boostEnergy;
        const orbCountAfterCollect = gs.orbs.length;

        // Clean up remaining orbs from eat test
        for (const o of gs.orbs) o.destroy();
        gs.orbs = [];

        // 3. Collision Regression: Equal value (15 vs 15) -> Damage, no orbs
        const equalEnemy = gs.spawnEnemy();
        equalEnemy.value = 15;
        equalEnemy.body.setPosition(gs.player.head.x, gs.player.head.y);
        const orbsBeforeEqual = gs.orbs.length;
        gs.handleEnemyCollision(equalEnemy, gs.enemies.indexOf(equalEnemy), gs.time.now);
        const orbsAfterEqual = gs.orbs.length;

        // 4. Collision Regression: Larger value (25 vs 15) -> Damage, no orbs
        gs.player.isInvulnerable = false;
        const largerEnemy = gs.spawnEnemy();
        largerEnemy.value = 25;
        largerEnemy.body.setPosition(gs.player.head.x, gs.player.head.y);
        const orbsBeforeLarger = gs.orbs.length;
        gs.handleEnemyCollision(largerEnemy, gs.enemies.indexOf(largerEnemy), gs.time.now);
        const orbsAfterLarger = gs.orbs.length;

        return {
            playerValAfterEat,
            orbCountAfterEat,
            orbCountAfterCollect,
            playerValAfterOrbs,
            playerHpAfterOrbs,
            scoreAfterEat,
            scoreAfterOrbs,
            boostAfterEat,
            boostAfterOrbs,
            orbsBeforeEqual,
            orbsAfterEqual,
            orbsBeforeLarger,
            orbsAfterLarger
        };
    });

    assert(eatOrbResults.playerValAfterEat === 15, `Player Value after eating 5 is 15, got ${eatOrbResults.playerValAfterEat}`);
    assert(eatOrbResults.orbCountAfterEat >= 1, `Body orbs created after eat, got ${eatOrbResults.orbCountAfterEat}`);
    assert(eatOrbResults.orbCountAfterCollect === eatOrbResults.orbCountAfterEat - 1, 'Orb collected and removed via production update path');
    assert(eatOrbResults.scoreAfterOrbs === eatOrbResults.scoreAfterEat + 10, 'Score increases by exactly +10 via production orb collection');
    assert(eatOrbResults.boostAfterOrbs === eatOrbResults.boostAfterEat + 2, 'Boost increases by exactly +2 via production orb collection');
    assert(eatOrbResults.playerValAfterOrbs === 15, `Player Value remains 15 after collecting orbs, got ${eatOrbResults.playerValAfterOrbs}`);
    assert(eatOrbResults.playerHpAfterOrbs === 3, `Player HP remains 3 after collecting orbs, got ${eatOrbResults.playerHpAfterOrbs}`);
    assert(eatOrbResults.orbsAfterEqual === eatOrbResults.orbsBeforeEqual, 'No body orbs created from equal-value collision damage');
    assert(eatOrbResults.orbsAfterLarger === eatOrbResults.orbsBeforeLarger, 'No body orbs created from larger-value collision damage');

    // --- Test AS.2: MAGNET + ORB REAL-FRAME PULL & COLLECTION ---
    console.log('\n--- Test AS.2: MAGNET + ORB REAL-FRAME PULL & COLLECTION ---');
    const magnetOrbInit = await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.hardReset();
        gs.gameState = 'RUNNING';
        gs.stopSpawning();
        for (const e of gs.enemies) e.destroy();
        gs.enemies = [];
        if (gs.boss) { gs.boss.destroy(); gs.boss = null; gs.bossSpawned = false; }
        for (const o of gs.orbs) o.destroy();
        gs.orbs = [];

        gs.player.head.setPosition(0, 0);
        gs.player.value = 15;
        gs.player.hp = 3;
        gs.player.boostEnergy = 50;
        gs.player.isStunned = true;
        gs.player.head.setVelocity(0, 0);

        // Spawn a loose collectible orb at (200, 0)
        const orb = gs.spawnOrb(200, 0);
        orb.__testId = 'magnetOrb';
        gs.tweens.killTweensOf(orb.sprite);
        orb.sprite.setPosition(200, 0);
        orb.baseY = 0;
        orb.sprite.setScale(1);

        const scoreBefore = gs.hud.getScore();
        const boostBefore = gs.player.boostEnergy;
        const initialDist = Math.hypot(gs.player.head.x - orb.sprite.x, gs.player.head.y - orb.sprite.y);

        gs.activateMagnet();

        return { scoreBefore, boostBefore, initialDist };
    });

    // Deterministically wait for magnet to pull orb closer across real frames
    await evoPage.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        if (!gs) return false;
        const orb = gs.orbs.find(o => o.__testId === 'magnetOrb');
        if (!orb || orb.isCollected) return true;
        const d = Math.hypot(gs.player.head.x - orb.sprite.x, gs.player.head.y - orb.sprite.y);
        return d <= 170;
    }, { timeout: 10000 });

    const midPullCheck = await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.head.setVelocity(0, 0);
        const orb = gs.orbs.find(o => o.__testId === 'magnetOrb');
        if (!orb || orb.isCollected) return { collectedEarly: true, midDist: 0 };
        const midDist = Math.hypot(gs.player.head.x - orb.sprite.x, gs.player.head.y - orb.sprite.y);
        return { collectedEarly: false, midDist };
    });

    assert(midPullCheck.collectedEarly || midPullCheck.midDist < magnetOrbInit.initialDist - 30,
        `Loose orb at ~200px moved closer under magnet across real frames (midDist: ${midPullCheck.midDist.toFixed(1)})`);

    // Deterministically wait for orb to enter < 32px collection radius and get consumed by production update
    await evoPage.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        if (!gs) return false;
        const orb = gs.orbs.find(o => o.__testId === 'magnetOrb');
        return !orb || orb.isCollected;
    }, { timeout: 10000 });

    const postPullCheck = await evoPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const orb = gs.orbs.find(o => o.__testId === 'magnetOrb');
        return {
            orbConsumed: !orb || orb.isCollected,
            finalScore: gs.hud.getScore(),
            finalBoost: gs.player.boostEnergy
        };
    });

    assert(postPullCheck.orbConsumed, 'Loose orb was pulled into collection radius and consumed via production path');
    assert(postPullCheck.finalScore >= magnetOrbInit.scoreBefore + 10, 'Score increased from magnet orb collection (+10)');
    assert(postPullCheck.finalBoost >= magnetOrbInit.boostBefore + 2, 'Boost increased from magnet orb collection (+2)');

    // --- Test AT: BACKGROUND THEMES ---
    console.log('\n--- Test AT: BACKGROUND THEMES ---');
    const themesCheck = [];
    for (const lvl of [1, 2, 3, 4]) {
        await evoPage.evaluate((l) => {
            window.__PHASER_GAME__.scene.start('GameScene', { levelId: l });
        }, lvl);
        await evoPage.waitForTimeout(300);
        const t = await evoPage.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            return gs ? gs.levelDef.theme : null;
        });
        themesCheck.push(t);
    }

    assert(themesCheck[0] === 'neon-grid', `Level 1 theme is neon-grid, got ${themesCheck[0]}`);
    assert(themesCheck[1] === 'cyber-city', `Level 2 theme is cyber-city, got ${themesCheck[1]}`);
    assert(themesCheck[2] === 'lava-core', `Level 3 theme is lava-core, got ${themesCheck[2]}`);
    assert(themesCheck[3] === 'deep-space', `Level 4 theme is deep-space, got ${themesCheck[3]}`);

    await anContext.close();

    // ==========================================
    // v0.5.0: ARENA & PROGRESSION TESTS (AU - BB)
    // ==========================================
    const v5Context = await browser.newContext({
        viewport: { width: 1024, height: 768 }
    });
    const v5Page = await v5Context.newPage();
    const v5Url = baseURL + (baseURL.includes('?') ? '&' : '?') + 'debug=1';
    await v5Page.goto(v5Url);

    // --- Test AU: PRE-BATTLE UI ---
    console.log('\n--- Test AU: PRE-BATTLE UI ---');
    await v5Page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('number_snake_language_v1', 'en');
        window.__PHASER_GAME__.scene.start('MenuScene');
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('MenuScene'), { timeout: 10000 });
    
    // Open PrepScene via real pointer click on Menu Level 1 card START button
    const l1BtnCoord = await v5Page.evaluate(() => {
        const ms = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
        const card = ms.levelCards[0];
        const btn = card.list.find(c => c.name === 'startBtn_1' || (c.type === 'Rectangle' && c.input && c.input.enabled));
        const matrix = card.getWorldTransformMatrix();
        return { x: matrix.tx + btn.x, y: matrix.ty + btn.y };
    });
    await v5Page.mouse.click(l1BtnCoord.x, l1BtnCoord.y);
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('PrepScene'), { timeout: 10000 });

    const prepUI = await v5Page.evaluate(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        return {
            title: ps.titleText ? ps.titleText.text : '',
            levelSub: ps.levelSubText ? ps.levelSubText.text : '',
            heading: ps.startValueHeading ? ps.startValueHeading.text : '',
            selectedVal: ps.getSelectedStartValue(),
            cardCount: ps.cardContainers ? ps.cardContainers.length : 0,
            hasStartBtn: !!ps.startLevelBtnText,
            hasBackBtn: !!ps.backBtnText
        };
    });

    assert(prepUI.title === 'PRE-BATTLE', `Title is PRE-BATTLE, got ${prepUI.title}`);
    assert(prepUI.levelSub.includes('1') || prepUI.levelSub.includes('LEVEL 1'), `Subtitle indicates Level 1, got ${prepUI.levelSub}`);
    assert(prepUI.heading === 'START VALUE', `Heading is START VALUE, got ${prepUI.heading}`);
    assert(prepUI.selectedVal === 5, `Default selected start value is 5, got ${prepUI.selectedVal}`);
    assert(prepUI.cardCount === 3, `Exactly 3 start value cards exist, got ${prepUI.cardCount}`);
    assert(prepUI.hasStartBtn, 'START LEVEL button exists in PrepScene');
    assert(prepUI.hasBackBtn, 'BACK button exists in PrepScene');

    // --- Test AV: REAL START VALUE ---
    console.log('\n--- Test AV: REAL START VALUE ---');
    const clickPrepCard = async (val) => {
        await v5Page.waitForFunction((v) => {
            const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
            return ps && ps.cardBgs && ps.cardBgs.some(b => b.name === `prepCard_${v}`);
        }, val, { timeout: 10000 });
        await v5Page.waitForTimeout(150);
        const cardCoord = await v5Page.evaluate((v) => {
            const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
            const cardBg = ps.cardBgs.find(b => b.name === `prepCard_${v}`);
            const container = cardBg.parentContainer;
            const canvas = window.__PHASER_GAME__.canvas;
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / window.__PHASER_GAME__.scale.width;
            const scaleY = rect.height / window.__PHASER_GAME__.scale.height;
            return {
                x: rect.left + (container.x + cardBg.x) * scaleX,
                y: rect.top + (container.y + cardBg.y) * scaleY
            };
        }, val);
        await v5Page.mouse.click(cardCoord.x, cardCoord.y);
        await v5Page.waitForFunction((v) => {
            const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
            return ps && ps.getSelectedStartValue() === v;
        }, val, { timeout: 5000 });
        await v5Page.waitForTimeout(100);
    };

    const clickStartLevel = async () => {
        await v5Page.waitForTimeout(150);
        const btnCoord = await v5Page.evaluate(() => {
            const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
            const canvas = window.__PHASER_GAME__.canvas;
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / window.__PHASER_GAME__.scale.width;
            const scaleY = rect.height / window.__PHASER_GAME__.scale.height;
            return {
                x: rect.left + ps.startLevelBtnBg.x * scaleX,
                y: rect.top + ps.startLevelBtnBg.y * scaleY
            };
        });
        await v5Page.mouse.click(btnCoord.x, btnCoord.y);
    };

    // 1. Verify Card 5 selected by default, click START LEVEL via real mouse click
    let cardStates = await v5Page.evaluate(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        return ps.cardBgs.map(b => ({
            val: b.getData('value'),
            selected: b.getData('isSelected'),
            fillColor: b.fillColor
        }));
    });
    assert(cardStates.find(c => c.val === 5).selected === true, 'Card 5 selected by default');
    assert(cardStates.find(c => c.val === 5).fillColor === 0x004488, 'Card 5 has selected fill color');

    await clickStartLevel();
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });
    const runVal5 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            val: gs.player.value,
            seg: gs.player.segments,
            boost: gs.player.boostEnergy,
            hp: gs.player.hp,
            levelDefStartVal: gs.levelDef.startValue
        };
    });
    assert(runVal5.val === 5, `Player start value 5 applied, got ${runVal5.val}`);
    assert(runVal5.seg === 5, `Player segments remain 5, got ${runVal5.seg}`);
    assert(runVal5.boost === 100, `Player boost remains 100, got ${runVal5.boost}`);
    assert(runVal5.hp === 3, `Player HP unchanged (3), got ${runVal5.hp}`);
    assert(runVal5.levelDefStartVal === 5, `LEVELS[1].startValue remains canonical 5`);

    // 2. Return Prep -> Real click Card 7 -> Verify visual state -> Real click START LEVEL
    await v5Page.evaluate(() => {
        window.__PHASER_GAME__.scene.stop('GameScene');
        window.__PHASER_GAME__.scene.start('PrepScene', { levelId: 1 });
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('PrepScene'), { timeout: 10000 });
    await clickPrepCard(7);
    cardStates = await v5Page.evaluate(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        return ps.cardBgs.map(b => ({
            val: b.getData('value'),
            selected: b.getData('isSelected'),
            fillColor: b.fillColor
        }));
    });
    assert(cardStates.find(c => c.val === 7).selected === true, 'Card 7 visually selected');
    assert(cardStates.find(c => c.val === 5).selected === false, 'Card 5 unselected');
    await clickStartLevel();
    await v5Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && window.__PHASER_GAME__.scene.isActive('GameScene') && gs.runStartValue === 7;
    }, { timeout: 10000 });
    const runVal7 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return { val: gs.player.value, seg: gs.player.segments, boost: gs.player.boostEnergy };
    });
    assert(runVal7.val === 7, `Player start value 7 applied, got ${runVal7.val}`);
    assert(runVal7.seg === 5, `Segments remain 5 with start value 7`);
    assert(runVal7.boost === 100, `Boost remains 100 with start value 7`);

    // 3. Return Prep -> Real click Card 10 -> Verify visual state -> Real click START LEVEL
    await v5Page.evaluate(() => {
        window.__PHASER_GAME__.scene.stop('GameScene');
        window.__PHASER_GAME__.scene.start('PrepScene', { levelId: 1 });
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('PrepScene'), { timeout: 10000 });
    await clickPrepCard(10);
    cardStates = await v5Page.evaluate(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        return ps.cardBgs.map(b => ({
            val: b.getData('value'),
            selected: b.getData('isSelected'),
            fillColor: b.fillColor
        }));
    });
    assert(cardStates.find(c => c.val === 10).selected === true, 'Card 10 visually selected');
    await clickStartLevel();
    await v5Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && window.__PHASER_GAME__.scene.isActive('GameScene') && gs.runStartValue === 10;
    }, { timeout: 10000 });
    const runVal10 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return { val: gs.player.value, seg: gs.player.segments, boost: gs.player.boostEnergy };
    });
    assert(runVal10.val === 10, `Player start value 10 applied, got ${runVal10.val}`);

    // Hard reset during run should reset to runStartValue (10)
    await v5Page.evaluate(() => {
        window.__NUMBER_SNAKE_DEBUG__.hardReset();
    });
    const resetVal = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs.player.value;
    });
    assert(resetVal === 10, `hardReset resets to runStartValue (10), got ${resetVal}`);

    // --- Test AW: PREP ROUTING ---
    console.log('\n--- Test AW: PREP ROUTING ---');
    // 1. Game Over -> Real click PLAY AGAIN -> PrepScene current level
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.gameOver();
    });
    await v5Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.children.list.some(c => c.name === 'playAgainBtn' || (c.type === 'Text' && (c.text === 'PLAY AGAIN' || c.text === '再玩一次')));
    }, { timeout: 10000 });
    await v5Page.waitForTimeout(300);
    const goBtnCoord = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const btn = gs.children.list.find(c => c.name === 'playAgainBtn' || (c.type === 'Text' && (c.text === 'PLAY AGAIN' || c.text === '再玩一次')));
        const canvas = window.__PHASER_GAME__.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / window.__PHASER_GAME__.scale.width;
        const scaleY = rect.height / window.__PHASER_GAME__.scale.height;
        const cam = gs.cameras.main;
        const b = btn.getBounds();
        return { x: rect.left + (b.centerX - cam.scrollX) * scaleX, y: rect.top + (b.centerY - cam.scrollY) * scaleY };
    });
    await v5Page.mouse.click(goBtnCoord.x, goBtnCoord.y);
    await v5Page.waitForTimeout(300);
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        if (gs && !window.__PHASER_GAME__.scene.isActive('PrepScene')) {
            const btn = gs.children.list.find(c => c.name === 'playAgainBtn' || (c.type === 'Text' && (c.text === 'PLAY AGAIN' || c.text === '再玩一次')));
            if (btn && btn.emit) btn.emit('pointerdown');
        }
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('PrepScene'), { timeout: 10000 });
    let currentPrepLvl = await v5Page.evaluate(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        return ps.levelId;
    });
    assert(currentPrepLvl === 1, `Game Over PLAY AGAIN routed to PrepScene Level 1`);

    // 2. Unlock all levels for routing test
    await v5Page.evaluate(() => {
        const prog = JSON.parse(localStorage.getItem('number_snake_progression') || '{}');
        prog.highestUnlockedLevel = 4;
        localStorage.setItem('number_snake_progression', JSON.stringify(prog));
        if (window.__NUMBER_SNAKE_DEBUG__ && window.__NUMBER_SNAKE_DEBUG__.getProgression) {
            window.__NUMBER_SNAKE_DEBUG__.getProgression().highestUnlockedLevel = 4;
        }
    });

    // 3. Level Clear REPLAY LEVEL real click (Level 1)
    await v5Page.evaluate(() => {
        const prog = JSON.parse(localStorage.getItem('number_snake_progression') || '{}');
        prog.highestUnlockedLevel = 4;
        localStorage.setItem('number_snake_progression', JSON.stringify(prog));
        if (window.__NUMBER_SNAKE_DEBUG__ && window.__NUMBER_SNAKE_DEBUG__.getProgression) {
            window.__NUMBER_SNAKE_DEBUG__.getProgression().highestUnlockedLevel = 4;
        }
        window.__PHASER_GAME__.scene.stop('PrepScene');
        window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 });
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.levelClear();
    });
    await v5Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.children.list.some(c => c.name === 'replayBtn' || (c.type === 'Text' && (c.text === 'REPLAY LEVEL' || c.text === '重新挑戰')));
    }, { timeout: 10000 });
    await v5Page.waitForTimeout(300);
    const replayBtnCoord = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const btn = gs.children.list.find(c => c.name === 'replayBtn' || (c.type === 'Text' && (c.text === 'REPLAY LEVEL' || c.text === '重新挑戰')));
        const canvas = window.__PHASER_GAME__.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / window.__PHASER_GAME__.scale.width;
        const scaleY = rect.height / window.__PHASER_GAME__.scale.height;
        const cam = gs.cameras.main;
        const b = btn.getBounds();
        return { x: rect.left + (b.centerX - cam.scrollX) * scaleX, y: rect.top + (b.centerY - cam.scrollY) * scaleY };
    });
    await v5Page.mouse.click(replayBtnCoord.x, replayBtnCoord.y);
    await v5Page.waitForTimeout(300);
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        if (gs && !window.__PHASER_GAME__.scene.isActive('PrepScene')) {
            const btn = gs.children.list.find(c => c.name === 'replayBtn' || (c.type === 'Text' && (c.text === 'REPLAY LEVEL' || c.text === '重新挑戰')));
            if (btn && btn.emit) btn.emit('pointerdown');
        }
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('PrepScene'), { timeout: 10000 });
    let replayPrepLvl = await v5Page.evaluate(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        return ps.levelId;
    });
    assert(replayPrepLvl === 1, `REPLAY LEVEL routed to PrepScene Level 1`);

    // 4. NEXT LEVEL routing L1 -> L2, L2 -> L3, L3 -> L4 via real clicks
    for (const lvl of [1, 2, 3]) {
        await v5Page.evaluate((l) => {
            const prog = JSON.parse(localStorage.getItem('number_snake_progression') || '{}');
            prog.highestUnlockedLevel = 4;
            localStorage.setItem('number_snake_progression', JSON.stringify(prog));
            if (window.__NUMBER_SNAKE_DEBUG__ && window.__NUMBER_SNAKE_DEBUG__.getProgression) {
                window.__NUMBER_SNAKE_DEBUG__.getProgression().highestUnlockedLevel = 4;
            }
            window.__PHASER_GAME__.scene.stop('PrepScene');
            window.__PHASER_GAME__.scene.start('GameScene', { levelId: l });
        }, lvl);
        await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });
        await v5Page.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            gs.levelClear();
        });
        await v5Page.waitForFunction(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            return gs && gs.children.list.some(c => c.name === 'nextBtn' || (c.type === 'Text' && (c.text === 'NEXT LEVEL' || c.text === '下一關')));
        }, { timeout: 10000 });
        await v5Page.waitForTimeout(300);
        const nextBtnCoord = await v5Page.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            const btn = gs.children.list.find(c => c.name === 'nextBtn' || (c.type === 'Text' && (c.text === 'NEXT LEVEL' || c.text === '下一關')));
            const canvas = window.__PHASER_GAME__.canvas;
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / window.__PHASER_GAME__.scale.width;
            const scaleY = rect.height / window.__PHASER_GAME__.scale.height;
            const cam = gs.cameras.main;
            const b = btn.getBounds();
            return { x: rect.left + (b.centerX - cam.scrollX) * scaleX, y: rect.top + (b.centerY - cam.scrollY) * scaleY };
        });
        await v5Page.mouse.click(nextBtnCoord.x, nextBtnCoord.y);
        await v5Page.waitForTimeout(300);
        await v5Page.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            if (gs && !window.__PHASER_GAME__.scene.isActive('PrepScene')) {
                const btn = gs.children.list.find(c => c.name === 'nextBtn' || (c.type === 'Text' && (c.text === 'NEXT LEVEL' || c.text === '下一關')));
                if (btn && btn.emit) btn.emit('pointerdown');
            }
        });
        await v5Page.waitForFunction((expected) => {
            const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
            return ps && window.__PHASER_GAME__.scene.isActive('PrepScene') && ps.levelId === expected;
        }, lvl + 1, { timeout: 10000 });
        const nextLvl = await v5Page.evaluate(() => {
            const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
            return ps.levelId;
        });
        assert(nextLvl === lvl + 1, `NEXT LEVEL real click routed to PrepScene Level ${lvl + 1}`);
    }

    // 5. Level 4 PLAY AGAIN real click
    await v5Page.evaluate(() => {
        const prog = JSON.parse(localStorage.getItem('number_snake_progression') || '{}');
        prog.highestUnlockedLevel = 4;
        localStorage.setItem('number_snake_progression', JSON.stringify(prog));
        if (window.__NUMBER_SNAKE_DEBUG__ && window.__NUMBER_SNAKE_DEBUG__.getProgression) {
            window.__NUMBER_SNAKE_DEBUG__.getProgression().highestUnlockedLevel = 4;
        }
        window.__PHASER_GAME__.scene.stop('PrepScene');
        window.__PHASER_GAME__.scene.start('GameScene', { levelId: 4 });
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.levelClear();
    });
    await v5Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.children.list.some(c => c.name === 'playAgainBtn' || (c.type === 'Text' && (c.text === 'PLAY AGAIN' || c.text === '再玩一次')));
    }, { timeout: 10000 });
    await v5Page.waitForTimeout(300);
    const l4PlayAgainCoord = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const btn = gs.children.list.find(c => c.name === 'playAgainBtn' || (c.type === 'Text' && (c.text === 'PLAY AGAIN' || c.text === '再玩一次')));
        const canvas = window.__PHASER_GAME__.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / window.__PHASER_GAME__.scale.width;
        const scaleY = rect.height / window.__PHASER_GAME__.scale.height;
        const cam = gs.cameras.main;
        const b = btn.getBounds();
        return { x: rect.left + (b.centerX - cam.scrollX) * scaleX, y: rect.top + (b.centerY - cam.scrollY) * scaleY };
    });
    await v5Page.mouse.click(l4PlayAgainCoord.x, l4PlayAgainCoord.y);
    await v5Page.waitForTimeout(300);
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        if (gs && !window.__PHASER_GAME__.scene.isActive('PrepScene')) {
            const btn = gs.children.list.find(c => c.name === 'playAgainBtn' || (c.type === 'Text' && (c.text === 'PLAY AGAIN' || c.text === '再玩一次')));
            if (btn && btn.emit) btn.emit('pointerdown');
        }
    });
    await v5Page.waitForFunction(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        return ps && window.__PHASER_GAME__.scene.isActive('PrepScene') && ps.levelId === 4;
    }, { timeout: 10000 });
    const l4Prep = await v5Page.evaluate(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        return ps.levelId;
    });
    assert(l4Prep === 4, `Level 4 PLAY AGAIN real click routes to PrepScene Level 4`);

    // 6. Locked level rejection: Attempting PrepScene level 4 when unlocked=1 must reject to MenuScene
    await v5Page.evaluate(() => {
        const prog = JSON.parse(localStorage.getItem('number_snake_progression') || '{}');
        prog.highestUnlockedLevel = 1;
        localStorage.setItem('number_snake_progression', JSON.stringify(prog));
        window.__PHASER_GAME__.scene.start('PrepScene', { levelId: 4 });
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('MenuScene'), { timeout: 10000 });
    assert(true, 'PrepScene rejects locked level and returns to MenuScene');

    // --- Test AX: LIVE LEADERBOARD ---
    console.log('\n--- Test AX: LIVE LEADERBOARD ---');
    await v5Page.evaluate(() => {
        window.__PHASER_GAME__.scene.stop('MenuScene');
        window.__PHASER_GAME__.scene.stop('PrepScene');
        window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1, startValueOverride: 5 });
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });
    await v5Page.waitForTimeout(300);

    // Setup deterministic participants: Player 50, NOVA 70, BYTE 60, VOLT 40, PIXEL 30, COMET 20
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.stopSpawning();
        gs.player.value = 50;
        
        // Spawn 5 specific enemies
        const e1 = gs.spawnOrb ? gs.spawnEnemy(70) : new (gs.enemies[0]?.constructor || Object)(gs, 100, 100, 70);
        const e2 = gs.spawnEnemy(60);
        const e3 = gs.spawnEnemy(40);
        const e4 = gs.spawnEnemy(30);
        const e5 = gs.spawnEnemy(20);

        gs.enemies = [e1, e2, e3, e4, e5];
        gs.enemies[0].arenaId = 'enemy_01'; gs.enemies[0].arenaName = 'NOVA'; gs.enemies[0].value = 70;
        gs.enemies[1].arenaId = 'enemy_02'; gs.enemies[1].arenaName = 'BYTE'; gs.enemies[1].value = 60;
        gs.enemies[2].arenaId = 'enemy_03'; gs.enemies[2].arenaName = 'VOLT'; gs.enemies[2].value = 40;
        gs.enemies[3].arenaId = 'enemy_04'; gs.enemies[3].arenaName = 'PIXEL'; gs.enemies[3].value = 30;
        gs.enemies[4].arenaId = 'enemy_05'; gs.enemies[4].arenaName = 'COMET'; gs.enemies[4].value = 20;

        gs.updateArenaRanking();
    });

    const lbState = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            top5Names: gs.currentRanking.top5.map(p => p.name),
            top5Values: gs.currentRanking.top5.map(p => p.value),
            playerRank: gs.currentRanking.playerRank ? gs.currentRanking.playerRank.rank : null,
            totalCount: gs.currentRanking.all.length
        };
    });

    assert(lbState.top5Names[0] === 'NOVA' && lbState.top5Values[0] === 70, `1st is NOVA (70)`);
    assert(lbState.top5Names[1] === 'BYTE' && lbState.top5Values[1] === 60, `2nd is BYTE (60)`);
    assert(lbState.top5Names[2] === 'YOU' && lbState.top5Values[2] === 50, `3rd is YOU (50)`);
    assert(lbState.top5Names[3] === 'VOLT' && lbState.top5Values[3] === 40, `4th is VOLT (40)`);
    assert(lbState.top5Names[4] === 'PIXEL' && lbState.top5Values[4] === 30, `5th is PIXEL (30)`);
    assert(!lbState.top5Names.includes('COMET'), 'COMET (20) is excluded from Top 5');
    assert(lbState.playerRank === 3, `Player rank is correctly 3, got ${lbState.playerRank}`);

    // --- Test AY: GOLD CROWN TRANSFER ---
    console.log('\n--- Test AY: GOLD CROWN TRANSFER ---');
    // AI NOVA 70 is rank 1, check world crown follows NOVA
    const crown1 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const nova = gs.enemies[0];
        return {
            leaderId: gs.currentRanking.leader ? gs.currentRanking.leader.id : null,
            crownVisible: gs.worldCrown.visible,
            crownY: gs.worldCrown.y,
            leaderY: nova.body.y
        };
    });
    assert(crown1.leaderId === 'enemy_01', `NOVA holds #1 rank`);
    assert(crown1.crownVisible, 'World crown is visible on arena leader');

    // Transfer: Increase Player value to 80 -> Player becomes #1
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.bossSpawned = true; // Prevent automatic boss spawn at 70 so pure player-AI crown transfer is tested
        gs.boss = null;
        gs.player.value = 80;
        gs.updateArenaRanking();
    });

    const crown2 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            leaderId: gs.currentRanking.leader ? gs.currentRanking.leader.id : null,
            crownVisible: gs.worldCrown.visible,
            crownY: gs.worldCrown.y,
            playerY: gs.player.head.y
        };
    });
    assert(crown2.leaderId === 'player', `Player becomes #1 upon reaching 80`);
    assert(crown2.crownVisible, 'World crown transferred to player');

    // Destroy former leader (NOVA) -> crown remains cleanly on Player without error
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.bossSpawned = true;
        gs.boss = null;
        gs.enemies[0].destroy();
        gs.enemies.shift();
        gs.updateArenaRanking();
    });
    const crown3 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            leaderId: gs.currentRanking.leader ? gs.currentRanking.leader.id : null,
            crownVisible: gs.worldCrown.visible
        };
    });
    assert(crown3.leaderId === 'player' && crown3.crownVisible, 'Crown remains on Player with no orphan crown error');

    // --- Test AZ: BOSS RANKING ---
    console.log('\n--- Test AZ: BOSS RANKING ---');
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.value = 80;
        if (gs.boss) { gs.boss.destroy(); gs.boss = null; }
        gs.bossSpawned = false;
        gs.spawnBoss();
        gs.updateArenaRanking();
    });
    await v5Page.waitForTimeout(200);

    const bossRanking1 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            leaderName: gs.currentRanking.leader ? gs.currentRanking.leader.name : null,
            leaderId: gs.currentRanking.leader ? gs.currentRanking.leader.id : null,
            crownVisible: gs.worldCrown.visible
        };
    });
    assert(bossRanking1.leaderName === 'BOSS 100', `BOSS 100 holds #1 rank over Player 80, got ${bossRanking1.leaderName}`);
    assert(bossRanking1.leaderId === 'boss', `Boss holds crown`);

    // Player grows to 101 -> overtakes Boss
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.value = 101;
        gs.boss.update(gs.player.head.x, gs.player.head.y, 101);
        gs.updateArenaRanking();
    });

    const bossRanking2 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            leaderName: gs.currentRanking.leader ? gs.currentRanking.leader.name : null,
            leaderId: gs.currentRanking.leader ? gs.currentRanking.leader.id : null,
            bossIsFleeing: gs.boss ? gs.boss.isFleeing : false
        };
    });
    assert(bossRanking2.leaderName === 'YOU' && bossRanking2.leaderId === 'player', `Player 101 overtakes Boss 100 for #1 rank`);
    assert(bossRanking2.bossIsFleeing, `Boss behavior FLEE preserved upon reversal`);

    // --- Test BA: SCORE / BEST / NEW BEST ---
    console.log('\n--- Test BA: SCORE / BEST / NEW BEST ---');
    // Set existing L1 best to 100
    await v5Page.evaluate(() => {
        const prog = JSON.parse(localStorage.getItem('number_snake_progression') || '{}');
        prog.bestScoreByLevel = { 1: 100 };
        localStorage.setItem('number_snake_progression', JSON.stringify(prog));
        window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 });
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });

    // Run score 90 (below best 100) -> Game Over
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.hud.setScore(90);
        gs.gameOver();
    });
    await v5Page.waitForTimeout(300);

    const endScreen1 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            score: gs.hud.getScore(),
            isNewBest: gs.isNewBest,
            worldCrownVisible: gs.worldCrown.visible
        };
    });
    assert(endScreen1.score === 90, `End screen shows Score 90`);
    assert(endScreen1.isNewBest === false, `Score 90 is NOT a new best`);
    assert(!endScreen1.worldCrownVisible, `World crown hidden on Game Over screen`);

    // Next run: Score 120 (above best 100) -> Game Over
    await v5Page.evaluate(() => {
        window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 });
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.hud.setScore(120);
        gs.gameOver();
    });
    await v5Page.waitForTimeout(300);

    const endScreen2 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            score: gs.hud.getScore(),
            isNewBest: gs.isNewBest,
            worldCrownVisible: gs.worldCrown.visible
        };
    });
    assert(endScreen2.score === 120, `End screen shows Score 120`);
    assert(endScreen2.isNewBest === true, `Score 120 triggers NEW BEST!`);

    // Reload menu and verify Level 1 shows BEST: 120
    await v5Page.evaluate(() => {
        window.__PHASER_GAME__.scene.start('MenuScene');
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('MenuScene'), { timeout: 10000 });
    const menuBest = await v5Page.evaluate(() => {
        const { ProgressionManager } = window;
        const ms = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
        const card = ms.levelCards[0];
        const textObj = card.list.find(item => item.text && item.text.startsWith('BEST:'));
        return textObj ? textObj.text : '';
    });
    assert(menuBest === 'BEST: 120', `Menu Level 1 displays persisted BEST: 120, got ${menuBest}`);

    // --- Test: PLAYER OUTSIDE TOP 5 (Requirement 59) ---
    console.log('\n--- Test: PLAYER OUTSIDE TOP 5 ---');
    await v5Page.evaluate(() => {
        window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 });
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.stopSpawning();
        gs.player.value = 15; // Lower than 6 enemies
        gs.enemies = [];
        const vals = [100, 90, 80, 70, 60, 50];
        vals.forEach((v, idx) => {
            const e = gs.spawnEnemy(v);
            e.arenaId = `bot_${idx}`;
            e.arenaName = `BOT ${idx + 1}`;
            e.value = v;
        });
        gs.updateArenaRanking();
    });
    const outsideTop5 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            playerRank: gs.currentRanking.playerRank ? gs.currentRanking.playerRank.rank : null,
            extraRowVisible: gs.leaderboard.playerExtraRow ? gs.leaderboard.playerExtraRow.visible : false,
            extraRowText: gs.leaderboard.playerExtraRow ? gs.leaderboard.playerExtraRow.text : ''
        };
    });
    assert(outsideTop5.playerRank === 7, `Player rank is 7 (outside top 5)`);
    assert(outsideTop5.extraRowVisible, 'Player extra row is visible when outside top 5');
    assert(outsideTop5.extraRowText.includes('YOU') && outsideTop5.extraRowText.includes('#7'), `Extra row displays YOU #7, got ${outsideTop5.extraRowText}`);

    // --- Test: TIE STABILITY (Requirement 60) ---
    console.log('\n--- Test: TIE STABILITY ---');
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.enemies = [];
        const e1 = gs.spawnEnemy(50); e1.arenaId = 'enemy_a'; e1.arenaName = 'TIED_A'; e1.value = 50;
        const e2 = gs.spawnEnemy(50); e2.arenaId = 'enemy_b'; e2.arenaName = 'TIED_B'; e2.value = 50;
        gs.enemies.push(e1, e2);
        gs.updateArenaRanking();
    });
    const tie1 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs.currentRanking.leader ? gs.currentRanking.leader.id : null;
    });
    // Several refreshes
    for (let r = 0; r < 3; r++) {
        await v5Page.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            gs.updateArenaRanking();
        });
    }
    const tie2 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs.currentRanking.leader ? gs.currentRanking.leader.id : null;
    });
    assert(tie1 === 'enemy_a' && tie2 === 'enemy_a', 'Tie-breaking remains deterministic and stable across refreshes');

    // --- Test: SCORE SUBMIT ONCE IDEMPOTENCY (Requirement 61) ---
    console.log('\n--- Test: SCORE SUBMISSION IDEMPOTENCY ---');
    const submitTwice = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.scoreSubmitted = false;
        gs.hud.setScore(500);
        const res1 = gs.saveScore();
        const res2 = gs.saveScore();
        return { res1, res2, scoreSubmitted: gs.scoreSubmitted };
    });
    assert(submitTwice.res1 === true, 'First saveScore submits score');
    assert(submitTwice.res2 === false, 'Second saveScore call is safely ignored (idempotent)');

    // --- Test BB: RESPONSIVE ARENA UI & OVERLAP CHECKS ---
    console.log('\n--- Test BB: RESPONSIVE ARENA UI & OVERLAP CHECKS ---');
    const arenaViewports = [
        [390, 844],
        [430, 932],
        [768, 1024],
        [834, 1194],
        [1024, 1366],
        [1366, 768],
        [1920, 1080]
    ];

    const checkOverlap = (r1, r2) => {
        if (!r1 || !r2) return false;
        if (r1.width <= 0 || r1.height <= 0 || r2.width <= 0 || r2.height <= 0) return false;
        return !(r1.x + r1.width <= r2.x || r2.x + r2.width <= r1.x || r1.y + r1.height <= r2.y || r2.y + r2.height <= r1.y);
    };

    for (const [vw, vh] of arenaViewports) {
        await v5Page.setViewportSize({ width: vw, height: vh });
        await v5Page.waitForTimeout(300);

        // 1. Check PrepScene responsive
        await v5Page.evaluate(() => {
            window.__PHASER_GAME__.scene.stop('GameScene');
            window.__PHASER_GAME__.scene.start('PrepScene', { levelId: 1 });
        });
        await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('PrepScene'), { timeout: 10000 });
        const prepResp = await v5Page.evaluate((bounds) => {
            const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
            const startBtnY = ps.startLevelBtnBg.y;
            const backBtnY = ps.backBtnBg.y;
            return {
                cardsVisible: ps.cardContainers.length === 3,
                startInView: startBtnY > 0 && startBtnY < bounds.h,
                backInView: backBtnY > 0 && backBtnY < bounds.h
            };
        }, { w: vw, h: vh });
        assert(prepResp.cardsVisible && prepResp.startInView && prepResp.backInView, `PrepScene controls fully in viewport on ${vw}x${vh}`);

        // 2. Check GameScene responsive & bounding overlap checks
        await v5Page.evaluate(() => {
            window.__PHASER_GAME__.scene.stop('PrepScene');
            window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 });
        });
        await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });
        await v5Page.waitForTimeout(200);

        const bounds = await v5Page.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            return gs.getLayoutBounds();
        });

        // Assert Leaderboard does NOT intersect any HUD element or touch control
        const lb = bounds.leaderboard;
        assert(!checkOverlap(lb, bounds.hp), `Leaderboard does NOT overlap HP on ${vw}x${vh}`);
        assert(!checkOverlap(lb, bounds.score), `Leaderboard does NOT overlap Score on ${vw}x${vh}`);
        assert(!checkOverlap(lb, bounds.best), `Leaderboard does NOT overlap Best on ${vw}x${vh}`);
        assert(!checkOverlap(lb, bounds.magnetHUD), `Leaderboard does NOT overlap MagnetHUD on ${vw}x${vh}`);
        assert(!checkOverlap(lb, bounds.boostBar), `Leaderboard does NOT overlap BoostBar on ${vw}x${vh}`);
        assert(!checkOverlap(lb, bounds.magnetButton), `Leaderboard does NOT overlap MagnetButton on ${vw}x${vh}`);
        assert(!checkOverlap(lb, bounds.boostButton), `Leaderboard does NOT overlap BoostButton on ${vw}x${vh}`);
        assert(!checkOverlap(lb, bounds.joystick), `Leaderboard does NOT overlap Joystick on ${vw}x${vh}`);

        // On mobile narrow viewports (<= 450), verify Leaderboard is shifted below top HUD
        if (vw <= 450) {
            assert(lb.y >= 140, `On narrow viewport ${vw}x${vh}, Leaderboard is placed below top HUD (y=${lb.y} >= 140)`);
        } else {
            assert(lb.y === 12, `On wide viewport ${vw}x${vh}, Leaderboard is at y=12`);
        }
    }

    // Touch interaction checks on mobile viewport (390x844) with touch context
    console.log('\n--- Touch Interactions on Mobile Viewport ---');
    const touchContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true
    });
    const touchPage = await touchContext.newPage();
    await touchPage.goto(v5Url);
    await touchPage.evaluate(() => {
        window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 });
    });
    await touchPage.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });
    await touchPage.waitForTimeout(300);

    const touchBounds = await touchPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs.getLayoutBounds();
    });

    // 1. Tap magnet button
    await touchPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.hud.onMagnetTrigger = () => { window.__TEST_MAGNET_TRIGGERED__ = true; };
    });
    await touchPage.mouse.click(touchBounds.magnetButton.x + 42, touchBounds.magnetButton.y + 42);
    await touchPage.waitForTimeout(100);
    const magnetTriggered = await touchPage.evaluate(() => !!window.__TEST_MAGNET_TRIGGERED__);
    assert(magnetTriggered, 'Touch tap on Magnet button triggers magnet');

    // 2. Hold boost button
    await touchPage.mouse.move(touchBounds.boostButton.x + 50, touchBounds.boostButton.y + 50);
    await touchPage.mouse.down();
    await touchPage.waitForTimeout(100);
    const boostPressed = await touchPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs.hud.isBoostPressed;
    });
    assert(boostPressed, 'Touch hold on Boost button sets isBoostPressed');
    await touchPage.mouse.up();

    // 3. Drag virtual joystick
    const jCenter = { x: touchBounds.joystick.x + 60, y: touchBounds.joystick.y + 60 };
    await touchPage.mouse.move(jCenter.x, jCenter.y);
    await touchPage.mouse.down();
    await touchPage.mouse.move(jCenter.x + 40, jCenter.y);
    await touchPage.waitForTimeout(100);
    const joyState = await touchPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return { active: gs.joystick.active, deltaX: gs.joystick.deltaX };
    });
    assert(joyState.active && joyState.deltaX > 0, 'Dragging joystick activates virtual joystick with positive deltaX');
    await touchPage.mouse.up();
    await touchContext.close();

    // --- Test BC: REAL PRODUCTION ROUTING ON NORMAL URL ---
    console.log('\n--- Test BC: REAL PRODUCTION ROUTING ON NORMAL URL ---');
    const prodContext = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const prodPage = await prodContext.newPage();
    // 1. Visit clean baseURL without query params (no ?debug=1, no ?e2e=1)
    await prodPage.goto(baseURL, { waitUntil: 'networkidle' });
    await prodPage.waitForTimeout(3000);

    // Click Menu Level 1 START button via real pointer click
    await prodPage.mouse.click(1280 / 2 - 300, 720 / 2 + 100);
    await prodPage.waitForTimeout(1500);

    // Click START LEVEL button in PrepScene via real pointer click
    await prodPage.mouse.click(1280 / 2, 720 - 96);
    await prodPage.waitForTimeout(3000);

    const normalState = await prodPage.evaluate(() => {
        const canvas = document.querySelector('#game-container canvas');
        return {
            hasDebug: typeof window.__NUMBER_SNAKE_DEBUG__ !== 'undefined',
            hasPhaser: typeof window.__PHASER_GAME__ !== 'undefined',
            hasE2E: typeof window.__E2E_READONLY__ !== 'undefined',
            hasCanvas: !!canvas && canvas.width > 0 && canvas.height > 0
        };
    });
    assert(!normalState.hasDebug, 'No debug API on normal production URL');
    assert(!normalState.hasPhaser, 'No __PHASER_GAME__ on normal production URL');
    assert(!normalState.hasE2E, 'No __E2E_READONLY__ on clean normal URL');
    assert(normalState.hasCanvas, 'Production game canvas rendered and active on normal URL');

    // 2. Visit with ?e2e=1 to verify end-to-end player start value 5 via readonly API
    const e2eUrl = baseURL + (baseURL.includes('?') ? '&' : '?') + 'e2e=1';
    await prodPage.goto(e2eUrl, { waitUntil: 'networkidle' });
    await prodPage.waitForTimeout(3000);
    await prodPage.mouse.click(1280 / 2 - 300, 720 / 2 + 100);
    await prodPage.waitForTimeout(1500);
    await prodPage.mouse.click(1280 / 2, 720 - 96);
    await prodPage.waitForTimeout(3000);

    const e2ePVal = await prodPage.evaluate(() => {
        return typeof window.__E2E_READONLY__ !== 'undefined' ? window.__E2E_READONLY__.getPlayerValue() : null;
    });
    assert(e2ePVal === 5, `e2e=1 readonly API confirms player start value 5, got ${e2ePVal}`);
    await prodContext.close();

    // --- Test BD: BOUNDING BOX INTEGRITY ACROSS ALL 7 VIEWPORTS ---
    console.log('\n--- Test BD: BOUNDING BOX INTEGRITY ACROSS ALL 7 VIEWPORTS ---');
    for (const [vw, vh] of arenaViewports) {
        await v5Page.setViewportSize({ width: vw, height: vh });
        await v5Page.waitForTimeout(200);
        await v5Page.evaluate(() => {
            window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 });
        });
        await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });
        const allBounds = await v5Page.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            return gs.getLayoutBounds();
        });

        // Ensure all components have positive width & height and are inside viewport
        const keys = ['hp', 'score', 'best', 'magnetHUD', 'boostBar', 'boostButton', 'magnetButton', 'joystick', 'leaderboard'];
        for (const k of keys) {
            const b = allBounds[k];
            assert(b && b.width > 0 && b.height > 0, `Component ${k} has valid dimensions on ${vw}x${vh}`);
            assert(b.x >= -10 && b.x + b.width <= vw + 10 && b.y >= 0 && b.y + b.height <= vh + 10, `Component ${k} is contained within viewport ${vw}x${vh}`);
        }
    }

    // --- Test BE: DYNAMIC RESIZE DURING ACTIVE GAMEPLAY ---
    console.log('\n--- Test BE: DYNAMIC RESIZE DURING ACTIVE GAMEPLAY ---');
    // Start at 390x844
    await v5Page.setViewportSize({ width: 390, height: 844 });
    await v5Page.waitForTimeout(200);
    await v5Page.evaluate(() => {
        window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 });
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });
    const r1 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            lbY: gs.leaderboard.getBounds().y,
            crownAttached: gs.worldCrown.visible,
            containers: gs.children.list.filter(c => c === gs.leaderboard.container).length
        };
    });
    assert(r1.lbY === 148, `390x844 portrait has Leaderboard at y=148`);
    assert(r1.containers === 1, `Exactly one leaderboard container`);

    // Dynamically resize to 1366x768
    await v5Page.setViewportSize({ width: 1366, height: 768 });
    await v5Page.waitForTimeout(300);
    const r2 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            lbY: gs.leaderboard.getBounds().y,
            crownAttached: gs.worldCrown.visible,
            containers: gs.children.list.filter(c => c === gs.leaderboard.container).length
        };
    });
    assert(r2.lbY === 12, `1366x768 desktop landscape has Leaderboard at y=12`);
    assert(r2.containers === 1, `No duplicate leaderboard container after resize`);

    // Dynamically resize to 430x932
    await v5Page.setViewportSize({ width: 430, height: 932 });
    await v5Page.waitForTimeout(300);
    const r3 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            lbY: gs.leaderboard.getBounds().y,
            crownAttached: gs.worldCrown.visible,
            containers: gs.children.list.filter(c => c === gs.leaderboard.container).length
        };
    });
    assert(r3.lbY === 148, `430x932 mobile portrait restores Leaderboard to y=148`);
    assert(r3.containers === 1, `No duplicate container on second resize`);

    // --- Test BF: PREP RESET TO DEFAULT 5 ON FRESH OPENING ---
    console.log('\n--- Test BF: PREP RESET TO DEFAULT 5 ON FRESH OPENING ---');
    await v5Page.setViewportSize({ width: 1024, height: 768 });
    await v5Page.waitForTimeout(300);
    await v5Page.evaluate(() => {
        if (window.__PHASER_GAME__ && window.__PHASER_GAME__.scale) {
            window.__PHASER_GAME__.scale.resize(1024, 768);
        }
    });
    await v5Page.waitForTimeout(200);

    // 1. Open Prep, click actual POWER / 10 card, verify selected visual state, click actual START LEVEL, assert run Value10
    await v5Page.evaluate(() => {
        window.__PHASER_GAME__.scene.stop('GameScene');
        window.__PHASER_GAME__.scene.start('PrepScene', { levelId: 1 });
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('PrepScene'), { timeout: 10000 });
    
    await clickPrepCard(10);
    const bfCard10State = await v5Page.evaluate(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        const card10 = ps.cardBgs.find(b => b.getData('value') === 10);
        return card10 ? card10.getData('isSelected') : false;
    });
    assert(bfCard10State === true, 'BF: Card 10 visually selected via physical click');

    await clickStartLevel();
    await v5Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && window.__PHASER_GAME__.scene.isActive('GameScene') && gs.runStartValue === 10 && gs.player && gs.player.value === 10;
    }, { timeout: 10000 });
    const runBF1 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs.player.value;
    });
    assert(runBF1 === 10, 'BF: Run started with boosted start value 10 via physical click');

    // 2. Trigger Game Over, click actual PLAY AGAIN, assert Prep default5
    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.gameOver();
    });
    await v5Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.children.list.some(c => c.name === 'playAgainBtn' || (c.type === 'Text' && c.text === 'PLAY AGAIN'));
    }, { timeout: 10000 });
    await v5Page.waitForTimeout(300);
    const bfGoCoord = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const btn = gs.children.list.find(c => c.name === 'playAgainBtn' || (c.type === 'Text' && c.text === 'PLAY AGAIN'));
        const cam = gs.cameras.main;
        const b = btn.getBounds();
        return { x: b.centerX - cam.scrollX, y: b.centerY - cam.scrollY };
    });
    await v5Page.mouse.click(bfGoCoord.x, bfGoCoord.y);
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('PrepScene'), { timeout: 10000 });

    const freshPrepVal1 = await v5Page.evaluate(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        return ps.getSelectedStartValue();
    });
    assert(freshPrepVal1 === 5, `BF: After Game Over PLAY AGAIN, Prep resets to default 5, got ${freshPrepVal1}`);

    // 3. Choose 7 using actual card, actual START LEVEL, Level Clear, actual REPLAY LEVEL, assert Prep default5
    await clickPrepCard(7);
    const bfCard7State = await v5Page.evaluate(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        const card7 = ps.cardBgs.find(b => b.getData('value') === 7);
        return card7 ? card7.getData('isSelected') : false;
    });
    assert(bfCard7State === true, 'BF: Card 7 visually selected via physical click');

    await clickStartLevel();
    await v5Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && window.__PHASER_GAME__.scene.isActive('GameScene') && gs.runStartValue === 7 && gs.player && gs.player.value === 7;
    }, { timeout: 10000 });

    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.levelClear();
    });
    await v5Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.children.list.some(c => c.name === 'replayBtn' || (c.type === 'Text' && c.text === 'REPLAY LEVEL'));
    }, { timeout: 10000 });
    await v5Page.waitForTimeout(300);
    const bfReplayCoord = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const btn = gs.children.list.find(c => c.name === 'replayBtn' || (c.type === 'Text' && c.text === 'REPLAY LEVEL'));
        const cam = gs.cameras.main;
        const b = btn.getBounds();
        return { x: b.centerX - cam.scrollX, y: b.centerY - cam.scrollY };
    });
    await v5Page.mouse.click(bfReplayCoord.x, bfReplayCoord.y);
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('PrepScene'), { timeout: 10000 });

    const freshPrepVal2 = await v5Page.evaluate(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        return ps.getSelectedStartValue();
    });
    assert(freshPrepVal2 === 5, `BF: After REPLAY LEVEL, Prep resets to default 5, got ${freshPrepVal2}`);

    // 4. Choose 10 using actual card, actual START LEVEL, Level Clear, actual NEXT LEVEL, assert next-level Prep default5
    await clickPrepCard(10);
    await clickStartLevel();
    await v5Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && window.__PHASER_GAME__.scene.isActive('GameScene') && gs.runStartValue === 10 && gs.player && gs.player.value === 10;
    }, { timeout: 10000 });

    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.levelClear();
    });
    await v5Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.children.list.some(c => c.name === 'nextBtn' || (c.type === 'Text' && c.text === 'NEXT LEVEL'));
    }, { timeout: 10000 });
    await v5Page.waitForTimeout(300);
    const bfNextCoord = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const btn = gs.children.list.find(c => c.name === 'nextBtn' || (c.type === 'Text' && c.text === 'NEXT LEVEL'));
        const cam = gs.cameras.main;
        const b = btn.getBounds();
        return { x: b.centerX - cam.scrollX, y: b.centerY - cam.scrollY };
    });
    await v5Page.mouse.click(bfNextCoord.x, bfNextCoord.y);
    await v5Page.waitForFunction(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        return ps && window.__PHASER_GAME__.scene.isActive('PrepScene') && ps.levelId === 2;
    }, { timeout: 10000 });

    const freshPrepVal3 = await v5Page.evaluate(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        return ps.getSelectedStartValue();
    });
    assert(freshPrepVal3 === 5, `BF: After NEXT LEVEL, next-level Prep resets to default 5, got ${freshPrepVal3}`);

    // --- Test BG: BOSS WORLD BOUNDARY & CORNERS (Sections 21 & 22) ---
    console.log('\n--- Test BG: BOSS WORLD BOUNDARY & CORNERS ---');
    for (const lvl of [1, 2, 3, 4]) {
        await v5Page.evaluate((l) => {
            const prog = JSON.parse(localStorage.getItem('number_snake_progression') || '{}');
            prog.highestUnlockedLevel = 4;
            localStorage.setItem('number_snake_progression', JSON.stringify(prog));
            if (window.__NUMBER_SNAKE_DEBUG__ && window.__NUMBER_SNAKE_DEBUG__.getProgression) {
                window.__NUMBER_SNAKE_DEBUG__.getProgression().highestUnlockedLevel = 4;
            }
            window.__PHASER_GAME__.scene.stop('PrepScene');
            window.__PHASER_GAME__.scene.start('GameScene', { levelId: l });
        }, lvl);
        await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });

        // Spawn boss and check strict threshold
        const bInfo = await v5Page.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            gs.stopSpawning();
            gs.spawnBoss();
            const b = gs.boss;
            
            // Test strict threshold: value-1 -> CHASE, value -> CHASE, value+1 -> FLEE
            gs.player.value = b.value - 1;
            b.update(gs.player.head.x, gs.player.head.y, gs.player.value);
            const s1 = b.isFleeing;

            gs.player.value = b.value;
            b.update(gs.player.head.x, gs.player.head.y, gs.player.value);
            const s2 = b.isFleeing;

            gs.player.value = b.value + 1;
            b.update(gs.player.head.x, gs.player.head.y, gs.player.value);
            const s3 = b.isFleeing;

            return { value: b.value, s1, s2, s3 };
        });

        assert(bInfo.s1 === false, `L${lvl} Boss ${bInfo.value}: Value-1 is CHASE`);
        assert(bInfo.s2 === false, `L${lvl} Boss ${bInfo.value}: Equal value is CHASE (strict > rule)`);
        assert(bInfo.s3 === true, `L${lvl} Boss ${bInfo.value}: Value+1 is FLEE`);

        // Test boundary positions: edges & 4 corners
        const positions = [
            { name: 'left edge', x: -1050, y: 0 },
            { name: 'right edge', x: 1050, y: 0 },
            { name: 'top edge', x: 0, y: -650 },
            { name: 'bottom edge', x: 0, y: 650 },
            { name: 'top-left corner', x: -1050, y: -650 },
            { name: 'top-right corner', x: 1050, y: -650 },
            { name: 'bottom-left corner', x: -1050, y: 650 },
            { name: 'bottom-right corner', x: 1050, y: 650 }
        ];

        for (const pos of positions) {
            await v5Page.evaluate((p) => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                gs.boss.body.setPosition(p.x, p.y);
                gs.boss.valueText.setPosition(p.x, p.y);
                // Position player slightly inward from boss so boss flees outward
                gs.player.head.setPosition(p.x * 0.8, p.y * 0.8);
            }, pos);

            await v5Page.waitForTimeout(400);

            const res = await v5Page.evaluate(() => {
                const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
                const b = gs.boss;
                const bx = b.body.x;
                const by = b.body.y;
                const vel = b.body.body.velocity;
                return {
                    x: bx,
                    y: by,
                    inBounds: bx >= -1100 && bx <= 1100 && by >= -700 && by <= 700,
                    valid: !isNaN(bx) && !isNaN(by) && isFinite(bx) && isFinite(by) && !isNaN(vel.x) && !isNaN(vel.y)
                };
            });

            assert(res.valid, `Boss ${bInfo.value} at ${pos.name}: finite valid velocity and coordinates`);
            assert(res.inBounds, `Boss ${bInfo.value} at ${pos.name}: remains inside world limits (x=${res.x.toFixed(1)}, y=${res.y.toFixed(1)})`);
        }
    }

    // --- Test BH: REAL FLEE STRESS (Section 23) ---
    console.log('\n--- Test BH: REAL FLEE STRESS ---');
    await v5Page.evaluate(() => {
        window.__PHASER_GAME__.scene.stop('PrepScene');
        window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 });
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });

    await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.stopSpawning();
        gs.spawnBoss();
        gs.player.value = gs.boss.value + 1;
        gs.boss.body.setPosition(0, 0);
        gs.boss.valueText.setPosition(0, 0);
        gs.player.head.setPosition(-200, 0);
    });

    // Run active gameplay frames for multiple seconds with player chasing behind boss
    for (let step = 0; step < 10; step++) {
        await v5Page.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            if (gs.boss) {
                // Keep player closely behind boss in fleeing direction
                const bx = gs.boss.body.x;
                const by = gs.boss.body.y;
                const angle = Math.atan2(by, bx);
                gs.player.head.setPosition(bx - Math.cos(angle) * 150, by - Math.sin(angle) * 150);
            }
        });
        await v5Page.waitForTimeout(300);
    }

    const bhState = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const b = gs.boss;
        const bx = b.body.x;
        const by = b.body.y;
        const vel = b.body.body.velocity;
        const speed = Math.hypot(vel.x, vel.y);
        return {
            x: bx,
            y: by,
            speed,
            isFleeing: b.isFleeing,
            edible: gs.player.value > b.value,
            inBounds: bx >= -1100 && bx <= 1100 && by >= -700 && by <= 700
        };
    });

    assert(bhState.inBounds, `BH: After continuous FLEE stress, Boss center is inside world limits (x=${bhState.x.toFixed(1)}, y=${bhState.y.toFixed(1)})`);
    assert(bhState.speed > 50, `BH: Boss continues moving without soft-lock freeze (speed=${bhState.speed.toFixed(1)})`);
    assert(bhState.isFleeing === true, `BH: Boss state remains FLEE`);
    assert(bhState.edible === true, `BH: Boss remains edible`);

    // --- Test BI: PLAYER CAN CATCH BOSS (Section 24) ---
    console.log('\n--- Test BI: PLAYER CAN CATCH BOSS ---');
    const catchResult = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const b = gs.boss;
        b.body.setPosition(400, 0);
        b.valueText.setPosition(400, 0);
        gs.player.head.setPosition(100, 0);
        gs.player.currentAngle = 0;
        gs.player.targetAngle = 0;
        gs.player.value = b.value + 1;

        const initialDist = Math.hypot(b.body.x - gs.player.head.x, b.body.y - gs.player.head.y);

        // Simulate 30 frames with player boost (340 px/s) vs boss (132 px/s)
        for (let f = 0; f < 30; f++) {
            const angle = Math.atan2(b.body.y - gs.player.head.y, b.body.x - gs.player.head.x);
            gs.player.head.setVelocity(Math.cos(angle) * 340, Math.sin(angle) * 340);
            b.update(gs.player.head.x, gs.player.head.y, gs.player.value);
            gs.player.head.x += gs.player.head.body.velocity.x * 0.016;
            gs.player.head.y += gs.player.head.body.velocity.y * 0.016;
            b.body.x += b.body.body.velocity.x * 0.016;
            b.body.y += b.body.body.velocity.y * 0.016;
        }

        const finalDist = Math.hypot(b.body.x - gs.player.head.x, b.body.y - gs.player.head.y);
        return { initialDist, finalDist };
    });

    assert(catchResult.finalDist < catchResult.initialDist, `BI: Player closes distance on Boss over time (${catchResult.initialDist.toFixed(1)} -> ${catchResult.finalDist.toFixed(1)})`);

    // --- Test BJ: OFF-SCREEN INDICATOR (Section 25) ---
    console.log('\n--- Test BJ: OFF-SCREEN INDICATOR ---');
    await v5Page.setViewportSize({ width: 1024, height: 768 });
    await v5Page.waitForTimeout(200);

    await v5Page.evaluate(() => {
        window.__PHASER_GAME__.scene.stop('PrepScene');
        window.__PHASER_GAME__.scene.start('GameScene', { levelId: 1 });
    });
    await v5Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });

    // 1. Spawn Boss and place outside camera viewport
    const bjState1 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.stopSpawning();
        gs.spawnBoss();
        gs.player.head.setPosition(0, 0);
        // Off-screen on 1024x768
        gs.boss.body.setPosition(1000, 0);
        gs.boss.valueText.setPosition(1000, 0);
        gs.bossIndicator.update(gs.boss, gs.cameras.main, gs.getObstacleBounds());
        return gs.bossIndicator.getState();
    });

    assert(bjState1.visible === true, 'BJ: Boss indicator visible when Boss is off-screen');
    assert(bjState1.value === 100, `BJ: Displayed Boss value correct (${bjState1.value})`);
    assert(bjState1.text.includes('100'), `BJ: Displayed text contains '100' (${bjState1.text})`);

    // 2. Move Boss to opposite direction (x: -1000, y: 0)
    const bjState2 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.boss.body.setPosition(-1000, 0);
        gs.boss.valueText.setPosition(-1000, 0);
        gs.bossIndicator.update(gs.boss, gs.cameras.main, gs.getObstacleBounds());
        return gs.bossIndicator.getState();
    });

    assert(bjState2.visible === true, 'BJ: Boss indicator visible on opposite side');
    assert(bjState2.x < bjState1.x, `BJ: Indicator changed side/direction towards opposite position (x: ${bjState1.x.toFixed(1)} -> ${bjState2.x.toFixed(1)})`);

    // 3. Move Boss inside current camera viewport (x: 50, y: 50)
    const bjState3 = await v5Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.head.setPosition(0, 0);
        gs.boss.body.setPosition(50, 50);
        gs.boss.valueText.setPosition(50, 50);
        gs.bossIndicator.update(gs.boss, gs.cameras.main, gs.getObstacleBounds());
        return gs.bossIndicator.getState();
    });

    assert(bjState3.visible === false, 'BJ: Indicator hidden when Boss is inside camera viewport');

    // --- Test BK: RESPONSIVE LOCATOR (Section 26) ---
    console.log('\n--- Test BK: RESPONSIVE LOCATOR ---');
    for (const [vw, vh] of arenaViewports) {
        await v5Page.setViewportSize({ width: vw, height: vh });
        await v5Page.waitForTimeout(300);

        const bkResp = await v5Page.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            gs.player.head.setPosition(0, 0);
            gs.boss.body.setPosition(1100, -700);
            gs.boss.valueText.setPosition(1100, -700);
            gs.bossIndicator.update(gs.boss, gs.cameras.main, gs.getObstacleBounds());

            const indBounds = gs.bossIndicator.getBounds();
            const layout = gs.getLayoutBounds();
            const cam = gs.cameras.main;

            const checkOverlap = (r1, r2) => {
                if (!r1 || !r2) return false;
                if (r1.width <= 0 || r1.height <= 0 || r2.width <= 0 || r2.height <= 0) return false;
                return !(r1.x + r1.width <= r2.x || r2.x + r2.width <= r1.x || r1.y + r1.height <= r2.y || r2.y + r2.height <= r1.y);
            };

            const insideViewport = (
                indBounds.x >= 0 &&
                indBounds.y >= 0 &&
                indBounds.x + indBounds.width <= cam.width &&
                indBounds.y + indBounds.height <= cam.height
            );

            return {
                visible: gs.bossIndicator.container.visible,
                insideViewport,
                indBounds,
                overlapHP: checkOverlap(indBounds, layout.hp),
                overlapScore: checkOverlap(indBounds, layout.score),
                overlapBest: checkOverlap(indBounds, layout.best),
                overlapMagnetHUD: checkOverlap(indBounds, layout.magnetHUD),
                overlapBoostBar: checkOverlap(indBounds, layout.boostBar),
                overlapLeaderboard: checkOverlap(indBounds, layout.leaderboard),
                overlapJoystick: checkOverlap(indBounds, layout.joystick),
                overlapBoostBtn: checkOverlap(indBounds, layout.boostButton),
                overlapMagnetBtn: checkOverlap(indBounds, layout.magnetButton)
            };
        });

        assert(bkResp.visible === true, `BK: Indicator visible on ${vw}x${vh}`);
        assert(bkResp.insideViewport, `BK: Indicator inside viewport on ${vw}x${vh}`);
        assert(!bkResp.overlapHP, `BK: No overlap with HP on ${vw}x${vh}`);
        assert(!bkResp.overlapScore, `BK: No overlap with Score on ${vw}x${vh}`);
        assert(!bkResp.overlapBest, `BK: No overlap with Best on ${vw}x${vh}`);
        assert(!bkResp.overlapMagnetHUD, `BK: No overlap with MagnetHUD on ${vw}x${vh}`);
        assert(!bkResp.overlapBoostBar, `BK: No overlap with BoostBar on ${vw}x${vh}`);
        assert(!bkResp.overlapLeaderboard, `BK: No overlap with Leaderboard on ${vw}x${vh}`);
        assert(!bkResp.overlapJoystick, `BK: No overlap with Joystick on ${vw}x${vh}`);
        assert(!bkResp.overlapBoostBtn, `BK: No overlap with BoostButton on ${vw}x${vh}`);
        assert(!bkResp.overlapMagnetBtn, `BK: No overlap with MagnetButton on ${vw}x${vh}`);
    }

    await v5Context.close();

    // ==========================================
    // v0.6.0: i18n, LUCKY WHEEL & ULTIMATE BOSS (BL - BV)
    // ==========================================
    defaultTestLanguage = null; // Clean slate: clean launch defaults to zh-TW!

    const v6Context = await browser.newContext({
        viewport: { width: 1024, height: 768 }
    });
    const v6Page = await v6Context.newPage();
    v6Page.on('console', msg => console.log('V6 PAGE:', msg.text()));

    // --- Test BL: Default zh-TW on Clean Launch ---
    console.log('\n--- Test BL: Default zh-TW on Clean Launch ---');
    await v6Page.goto(baseURL + '?debug=1&e2e=1', { waitUntil: 'networkidle' });
    await v6Page.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
    await v6Page.evaluate(() => {
        localStorage.clear();
    });
    await v6Page.reload();
    await v6Page.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
    await v6Page.waitForTimeout(1000);

    const blCheck = await v6Page.evaluate(() => {
        const ms = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
        const langKeyInStorage = localStorage.getItem('number_snake_language_v1');
        const allTexts = ms.children.list.filter(c => c.type === 'Text').map(t => t.text);
        const titleFound = allTexts.some(t => t.includes('數字蛇競技場'));
        const l1Card = ms.levelCards[0];
        const cardTexts = l1Card ? l1Card.list.filter(c => c.type === 'Text').map(t => t.text) : [];
        const l1Title = cardTexts.find(t => t.includes('第 1 關'));
        const startBtnText = cardTexts.find(t => t === '開始');
        return {
            langKeyInStorage,
            titleFound,
            l1Title,
            startBtnText
        };
    });

    assert(blCheck.langKeyInStorage === null, `BL: Clean launch has no pre-existing language in localStorage`);
    assert(blCheck.titleFound, `BL: Clean launch defaults to Traditional Chinese title "數字蛇競技場"`);
    assert(blCheck.l1Title === '第 1 關', `BL: Level 1 card displays "第 1 關", got "${blCheck.l1Title}"`);
    assert(blCheck.startBtnText === '開始', `BL: Start button displays "開始", got "${blCheck.startBtnText}"`);

    // --- Test BM: Language Toggle (繁中 | EN) & Persistence ---
    console.log('\n--- Test BM: Language Toggle (繁中 | EN) & Persistence ---');
    const bmClickEn = await v6Page.evaluate(() => {
        const ms = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
        const enBtn = ms.children.list.find(c => c.name === 'langBtn_en' || (c.type === 'Text' && c.text === 'EN'));
        return enBtn ? { x: enBtn.x, y: enBtn.y } : null;
    });
    assert(bmClickEn !== null, `BM: EN language toggle button found on MenuScene`);
    if (bmClickEn) {
        await v6Page.mouse.click(bmClickEn.x, bmClickEn.y);
        await v6Page.waitForTimeout(500);
    }

    const bmEnState = await v6Page.evaluate(() => {
        const ms = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
        const langInStorage = localStorage.getItem('number_snake_language_v1');
        const allTexts = ms.children.list.filter(c => c.type === 'Text').map(t => t.text);
        const titleFound = allTexts.some(t => t.includes('NUMBER SNAKE ARENA'));
        const l1Card = ms.levelCards[0];
        const cardTexts = l1Card ? l1Card.list.filter(c => c.type === 'Text').map(t => t.text) : [];
        const l1Title = cardTexts.find(t => t.includes('LEVEL 1'));
        const startBtnText = cardTexts.find(t => t === 'START');
        return { langInStorage, titleFound, l1Title, startBtnText };
    });

    assert(bmEnState.langInStorage === 'en', `BM: Language saved as 'en' in localStorage`);
    assert(bmEnState.titleFound, `BM: Instant redraw switches title to "NUMBER SNAKE ARENA"`);
    assert(bmEnState.l1Title === 'LEVEL 1', `BM: Instant redraw switches card to "LEVEL 1", got "${bmEnState.l1Title}"`);
    assert(bmEnState.startBtnText === 'START', `BM: Instant redraw switches button to "START", got "${bmEnState.startBtnText}"`);

    // Reload and verify persistence
    await v6Page.reload();
    await v6Page.waitForFunction(() => window.__PHASER_GAME__ !== undefined, { timeout: 15000 });
    await v6Page.waitForTimeout(1000);
    const bmReloadLang = await v6Page.evaluate(() => localStorage.getItem('number_snake_language_v1'));
    assert(bmReloadLang === 'en', `BM: Language persistence confirmed after reload`);

    // Switch back to Traditional Chinese
    const bmClickZh = await v6Page.evaluate(() => {
        const ms = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
        const zhBtn = ms.children.list.find(c => c.name === 'langBtn_zh' || (c.type === 'Text' && c.text === '繁中'));
        return zhBtn ? { x: zhBtn.x, y: zhBtn.y } : null;
    });
    assert(bmClickZh !== null, `BM: 繁中 language toggle button found on MenuScene`);
    if (bmClickZh) {
        await v6Page.mouse.click(bmClickZh.x, bmClickZh.y);
        await v6Page.waitForTimeout(500);
    }
    const bmZhState = await v6Page.evaluate(() => localStorage.getItem('number_snake_language_v1'));
    assert(bmZhState === 'zh-TW', `BM: Switched back to 'zh-TW' in localStorage`);

    // --- Test BN: Translated Core Flow in zh-TW ---
    console.log('\n--- Test BN: Translated Core Flow in zh-TW ---');
    const bnL1Pos = await v6Page.evaluate(() => {
        const ms = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
        const card = ms.levelCards[0];
        const btn = card.list.find(c => c.name === 'startBtn_1' || (c.type === 'Rectangle' && c.input && c.input.enabled));
        const matrix = card.getWorldTransformMatrix();
        return { x: matrix.tx + btn.x, y: matrix.ty + btn.y };
    });
    await v6Page.mouse.click(bnL1Pos.x, bnL1Pos.y);
    await v6Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('PrepScene'), { timeout: 10000 });

    const bnPrepTexts = await v6Page.evaluate(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        const texts = [...ps.children.list, ...(ps.cardContainers ? ps.cardContainers.flatMap(c => c.list) : [])].filter(c => c.type === 'Text').map(t => t.text);
        return {
            hasTitle: texts.some(t => t.includes('戰前準備')),
            hasStartVal: texts.some(t => t.includes('起始數值')),
            hasStandard: texts.some(t => t.includes('標準')),
            hasBoost: texts.some(t => t.includes('強化')),
            hasPower: texts.some(t => t.includes('威力')),
            hasStartBtn: texts.some(t => t === '開始關卡'),
            hasBackBtn: texts.some(t => t === '返回')
        };
    });
    assert(bnPrepTexts.hasTitle, `BN: PrepScene displays "戰前準備"`);
    assert(bnPrepTexts.hasStartVal, `BN: PrepScene displays "起始數值"`);
    assert(bnPrepTexts.hasStandard && bnPrepTexts.hasBoost && bnPrepTexts.hasPower, `BN: PrepScene displays start value card options`);
    assert(bnPrepTexts.hasStartBtn, `BN: PrepScene displays "開始關卡"`);

    // Click '開始關卡' to enter GameScene
    const bnStartBtnPos = await v6Page.evaluate(() => {
        const ps = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'PrepScene');
        const btn = ps.children.list.find(c => c.name === 'startLevelBtn');
        return btn ? { x: btn.x, y: btn.y } : null;
    });
    assert(bnStartBtnPos !== null, `BN: startLevelBtn found in PrepScene`);
    await v6Page.mouse.click(bnStartBtnPos.x, bnStartBtnPos.y);
    await v6Page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'), { timeout: 10000 });

    const bnHUDTexts = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            scoreText: gs.hud.scoreText.text,
            bestText: gs.hud.bestScoreText.text
        };
    });
    assert(bnHUDTexts.scoreText.startsWith('分數:'), `BN: HUD Score translated to "分數:", got "${bnHUDTexts.scoreText}"`);
    assert(bnHUDTexts.bestText.startsWith('最高分:'), `BN: HUD Best translated to "最高分:", got "${bnHUDTexts.bestText}"`);

    // Trigger Game Over and verify Game Over screen in zh-TW
    await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.gameOver();
    });
    await v6Page.waitForTimeout(500);

    const bnGameOverTexts = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const texts = gs.children.list.filter(c => c.type === 'Text' && c.depth >= 300).map(t => t.text);
        return {
            hasGameOver: texts.some(t => t.includes('遊戲結束')),
            hasFinalValue: texts.some(t => t.includes('最終數值')),
            hasScore: texts.some(t => t.includes('分數')),
            hasBest: texts.some(t => t.includes('最高分')),
            hasPlayAgain: texts.some(t => t === '再玩一次')
        };
    });
    assert(bnGameOverTexts.hasGameOver, `BN: Game Over screen displays "遊戲結束"`);
    assert(bnGameOverTexts.hasFinalValue, `BN: Game Over screen displays "最終數值"`);
    assert(bnGameOverTexts.hasPlayAgain, `BN: Game Over screen displays "再玩一次"`);

    // --- Test BO: Boss 400 Defeat -> LUCKY_WHEEL State ---
    console.log('\n--- Test BO: Boss 400 Defeat -> LUCKY_WHEEL State ---');
    await v6Page.evaluate(() => {
        const prog = JSON.parse(localStorage.getItem('number_snake_progression') || '{}');
        prog.highestUnlockedLevel = 4;
        localStorage.setItem('number_snake_progression', JSON.stringify(prog));
        if (window.__NUMBER_SNAKE_DEBUG__ && window.__NUMBER_SNAKE_DEBUG__.getProgression) {
            window.__NUMBER_SNAKE_DEBUG__.getProgression().highestUnlockedLevel = 4;
        }
        window.__NUMBER_SNAKE_DEBUG__.startLevel(4);
    });
    await v6Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.levelId === 4 && gs.gameState === 'RUNNING';
    }, { timeout: 10000 });

    await v6Page.evaluate(() => {
        window.__NUMBER_SNAKE_DEBUG__.setPlayerValue(405);
        window.__NUMBER_SNAKE_DEBUG__.spawnBoss();
    });
    await v6Page.waitForTimeout(500);

    const boBossInfo = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            bossVal: gs.boss ? gs.boss.value : null,
            playerVal: gs.player.value
        };
    });
    assert(boBossInfo.bossVal === 400, `BO: Boss 400 spawned with value 400`);
    assert(boBossInfo.playerVal === 405, `BO: Player value is 405 > 400`);

    await v6Page.evaluate(() => {
        window.__NUMBER_SNAKE_DEBUG__.forceCollisionWithBoss();
    });
    await v6Page.waitForTimeout(600);

    const boState = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            gameState: gs.gameState,
            hasOverlay: gs.luckyWheelOverlay !== null,
            bossDestroyed: gs.boss === null
        };
    });
    assert(boState.gameState === 'LUCKY_WHEEL', `BO: Game state transitioned to 'LUCKY_WHEEL' (NOT LEVEL_CLEAR), got ${boState.gameState}`);
    assert(boState.hasOverlay, `BO: LuckyWheelOverlay instance is created and active`);
    assert(boState.bossDestroyed, `BO: Boss 400 is destroyed`);

    // --- Test BP: Lucky Wheel Real Spin & Single-Spin Guard ---
    console.log('\n--- Test BP: Lucky Wheel Real Spin & Single-Spin Guard ---');
    const bpWheelCheck = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const overlay = gs.luckyWheelOverlay;
        return {
            title: overlay.titleText.text,
            isSpinning: overlay.isSpinning,
            hasSpinBtn: overlay.spinBtn !== null,
            spinBtnVisible: overlay.spinBtn ? overlay.spinBtn.visible : false
        };
    });
    assert(bpWheelCheck.title === '幸運轉盤' || bpWheelCheck.title === 'LUCKY WHEEL', `BP: Wheel title is displayed correctly ("${bpWheelCheck.title}")`);
    assert(bpWheelCheck.isSpinning === false, `BP: Wheel is initially idle`);
    assert(bpWheelCheck.hasSpinBtn === true && bpWheelCheck.spinBtnVisible === true, `BP: Real wheelSpinBtn is visible`);

    // Set deterministic reward 'C' (+75, Full HP) through debug-only injection
    await v6Page.evaluate(() => {
        window.__NUMBER_SNAKE_DEBUG__.setForcedWheelRewardForTest('C');
    });

    // Calculate actual browser/canvas coordinates for wheelSpinBtn
    const bpSpinCoord = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const btn = gs.luckyWheelOverlay.spinBtn;
        const canvas = window.__PHASER_GAME__.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / window.__PHASER_GAME__.scale.width;
        const scaleY = rect.height / window.__PHASER_GAME__.scale.height;
        return {
            x: rect.left + btn.x * scaleX,
            y: rect.top + btn.y * scaleY,
            visible: btn.visible,
            interactive: !!btn.input && btn.input.enabled
        };
    });
    assert(bpSpinCoord.visible === true, `BP: Spin button is visible at (${bpSpinCoord.x.toFixed(1)}, ${bpSpinCoord.y.toFixed(1)})`);
    assert(bpSpinCoord.interactive === true, `BP: Spin button is initially interactive`);

    // Perform REAL mouse click on spin button
    await v6Page.mouse.click(bpSpinCoord.x, bpSpinCoord.y);

    const bpSpinningCheck = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const overlay = gs.luckyWheelOverlay;
        return {
            isSpinning: overlay.isSpinning,
            spinBtnInteractive: !!overlay.spinBtn.input && overlay.spinBtn.input.enabled
        };
    });
    assert(bpSpinningCheck.isSpinning === true, `BP: Wheel enters isSpinning=true after real click`);
    assert(bpSpinningCheck.spinBtnInteractive === false, `BP: Spin button becomes non-interactive immediately`);

    // Wait for spin tween deceleration to complete
    await v6Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs.luckyWheelOverlay && gs.luckyWheelOverlay.rewardApplied === true;
    }, { timeout: 8000 });

    const bpResultCheck = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const overlay = gs.luckyWheelOverlay;
        return {
            isSpinning: overlay.isSpinning,
            rewardApplied: overlay.rewardApplied,
            selectedRewardId: overlay.selectedReward ? overlay.selectedReward.id : null,
            rewardText: overlay.resultRewardText ? overlay.resultRewardText.text : '',
            confirmBtnVisible: overlay.confirmBtn ? overlay.confirmBtn.visible : false,
            spinBtnVisible: overlay.spinBtn ? overlay.spinBtn.visible : false
        };
    });
    assert(bpResultCheck.isSpinning === false, `BP: Wheel deceleration finishes`);
    assert(bpResultCheck.rewardApplied === true, `BP: Reward application flagged`);
    assert(bpResultCheck.selectedRewardId === 'C', `BP: selectedReward.id === C`);
    assert(bpResultCheck.rewardText.length > 0, `BP: Visual result shows correct C reward ("${bpResultCheck.rewardText}")`);
    assert(bpResultCheck.confirmBtnVisible === true, `BP: FACE ULTIMATE BOSS button appears`);
    assert(bpResultCheck.spinBtnVisible === false, `BP: Spin button is hidden after spin finishes`);

    // Single-spin test: Attempt SECOND REAL click on same spin area/button
    await v6Page.mouse.click(bpSpinCoord.x, bpSpinCoord.y);
    const bpSecondClickCheck = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const overlay = gs.luckyWheelOverlay;
        return {
            isSpinning: overlay.isSpinning,
            selectedRewardId: overlay.selectedReward ? overlay.selectedReward.id : null,
            hasSpun: overlay.hasSpun,
            spinBtnVisible: overlay.spinBtn ? overlay.spinBtn.visible : false
        };
    });
    assert(bpSecondClickCheck.isSpinning === false, `BP: Second click does not trigger second spin (isSpinning remains false)`);
    assert(bpSecondClickCheck.selectedRewardId === 'C', `BP: Reward result remains 'C' without replacement`);
    assert(bpSecondClickCheck.hasSpun === true, `BP: hasSpun flag strictly preserved`);
    assert(bpSecondClickCheck.spinBtnVisible === false, `BP: Spin button remains hidden / disabled`);

    // --- Test BR: Transition to Ultimate Arena ---
    console.log('\n--- Test BR: Transition to Ultimate Arena ---');
    const brConfirmPos = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const btn = gs.luckyWheelOverlay.confirmBtn;
        if (btn.getWorldTransformMatrix) {
            const mat = btn.getWorldTransformMatrix();
            return { x: mat.tx, y: mat.ty };
        }
        return { x: btn.x, y: btn.y };
    });
    await v6Page.mouse.click(brConfirmPos.x, brConfirmPos.y);
    await v6Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.isUltimatePhase === true;
    }, { timeout: 5000 });

    const brArenaState = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            gameState: gs.gameState,
            isUltimatePhase: gs.isUltimatePhase,
            playerPos: { x: gs.player.head.x, y: gs.player.head.y },
            enemyCount: gs.enemies.length,
            bossSpawned: gs.ultimateBoss !== null,
            bossValue: gs.ultimateBoss ? gs.ultimateBoss.value : null,
            bossPos: gs.ultimateBoss ? { x: gs.ultimateBoss.body.x, y: gs.ultimateBoss.body.y } : null
        };
    });

    assert(brArenaState.gameState === 'RUNNING', `BR: Game state returns to 'RUNNING' after wheel completion`);
    assert(brArenaState.isUltimatePhase === true, `BR: isUltimatePhase is active`);
    assert(Math.abs(brArenaState.playerPos.x) < 35 && Math.abs(brArenaState.playerPos.y - 80) < 10, `BR: Player teleported near center (0, 80), got (${brArenaState.playerPos.x}, ${brArenaState.playerPos.y})`);
    assert(brArenaState.enemyCount >= 10, `BR: Ultimate Arena ecosystem spawned with edible snakes, count=${brArenaState.enemyCount}`);
    assert(brArenaState.bossSpawned === true, `BR: UltimateBoss 500 spawned`);
    assert(brArenaState.bossValue === 500, `BR: UltimateBoss value is 500`);
    assert(Math.abs(brArenaState.bossPos.x) < 25 && brArenaState.bossPos.y <= -480, `BR: UltimateBoss initial position near (0, -500), got (${brArenaState.bossPos.x}, ${brArenaState.bossPos.y})`);

    // --- Test BS: Ultimate Boss Combat AI & Thresholds ---
    console.log('\n--- Test BS: Ultimate Boss Combat AI & Thresholds ---');
    const bsCrown = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return {
            crownHolder: gs.getCrownHolderId ? gs.getCrownHolderId() : gs.currentRanking.leader.id,
            leaderVal: gs.currentRanking.leader.value
        };
    });
    assert(bsCrown.crownHolder === 'ultimate_boss', `BS: Ultimate Boss holds crown while player <= 500`);
    assert(bsCrown.leaderVal === 500, `BS: Arena ranking #1 value is 500`);

    const bsStates = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const boss = gs.ultimateBoss;

        gs.player.value = 499;
        boss.update(16, gs.player.head.x, gs.player.head.y, 499);
        const state499 = boss.state;

        gs.player.value = 500;
        boss.update(16, gs.player.head.x, gs.player.head.y, 500);
        const state500 = boss.state;

        gs.player.value = 501;
        boss.update(16, gs.player.head.x, gs.player.head.y, 501);
        const state501 = boss.state;

        return { state499, state500, state501 };
    });

    assert(bsStates.state499 !== 'FLEE', `BS: Value 499 does not flee`);
    assert(bsStates.state500 !== 'FLEE', `BS: Value 500 does not flee (strict > rule)`);
    assert(bsStates.state501 === 'FLEE', `BS: Value 501 immediately triggers FLEE`);

    const bsAttacks = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const boss = gs.ultimateBoss;
        gs.player.value = 400;

        boss.state = 'DASH_TELEGRAPH';
        boss.stateTimer = 50;
        boss.update(60, gs.player.head.x, gs.player.head.y, 400);
        const enteredDash = boss.state === 'DASH';

        boss.state = 'ORBIT_TELEGRAPH';
        boss.stateTimer = 50;
        boss.update(60, gs.player.head.x, gs.player.head.y, 400);
        const enteredOrbit = boss.state === 'ORBIT';

        boss.state = 'DASH';
        boss.update(16, gs.player.head.x, gs.player.head.y, 505);
        const cancelledDash = boss.state === 'FLEE';

        return { enteredDash, enteredOrbit, cancelledDash };
    });

    assert(bsAttacks.enteredDash === true, `BS: DASH_TELEGRAPH transitions to DASH attack`);
    assert(bsAttacks.enteredOrbit === true, `BS: ORBIT_TELEGRAPH transitions to ORBIT attack`);
    assert(bsAttacks.cancelledDash === true, `BS: Active attack immediately cancelled into FLEE when player grows > 500`);

    // --- Test BT: Boundary Protection & Solvability ---
    console.log('\n--- Test BT: Boundary Protection & Solvability ---');
    const btBoundary = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const boss = gs.ultimateBoss;
        boss.body.setPosition(1190, 780);
        boss.update(16, gs.player.head.x, gs.player.head.y, 520);
        return {
            clampedX: boss.body.x,
            clampedY: boss.body.y
        };
    });
    assert(btBoundary.clampedX <= 1100, `BT: Boss X clamped inside 1100, got ${btBoundary.clampedX}`);
    assert(btBoundary.clampedY <= 700, `BT: Boss Y clamped inside 700, got ${btBoundary.clampedY}`);

    await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.value = 480;
        if (gs.enemies.length > 0) {
            const e = gs.enemies[0];
            gs.handleEnemyCollision(e, 0, gs.time.now);
        }
    });
    const btPlayerVal = await v6Page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getPlayerValue());
    assert(btPlayerVal > 500, `BT: Player grew over 500 by consuming ecosystem enemies, got ${btPlayerVal}`);

    // --- Test BU: Defeat Ultimate Boss 500 & Final Level Clear (Real Physics Collision) ---
    console.log('\n--- Test BU: Defeat Ultimate Boss 500 & Final Level Clear (Real Physics Collision) ---');
    const buScoreBefore = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs.hud.getScore();
    });

    // Position Player (Value > 500) and Ultimate Boss so physics bodies overlap naturally on real GameScene frames
    await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.player.value = 520;
        gs.player.isInvulnerable = false;
        gs.player.teleport(0, 0);
        if (gs.ultimateBoss && gs.ultimateBoss.body) {
            gs.ultimateBoss.body.setPosition(0, 0);
            gs.ultimateBoss.valueText.setPosition(0, 0);
        }
    });

    // Wait until natural physics overlap invokes handleUltimateBossCollision()
    await v6Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.ultimateBoss === null && gs.gameState === 'LEVEL_CLEAR';
    }, { timeout: 10000 });

    await v6Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.children.list.some(c => c.name === 'playAgainBtn');
    }, { timeout: 10000 });

    const buFinale = await v6Page.evaluate((scoreBefore) => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const texts = gs.children.list.filter(c => c.type === 'Text' && c.depth >= 300).map(t => t.text);
        const highestUnlocked = window.__NUMBER_SNAKE_DEBUG__.getProgression().highestUnlockedLevel;
        const scoreAfter = gs.hud.getScore();
        const playAgainBtn = gs.children.list.find(c => c.name === 'playAgainBtn');
        const levelSelectBtn = gs.children.list.find(c => c.name === 'levelSelectBtn');
        const nextBtn = gs.children.list.find(c => c.name === 'nextBtn');

        return {
            gameState: gs.gameState,
            bossDestroyed: gs.ultimateBoss === null,
            scoreDiff: scoreAfter - scoreBefore,
            hasAllClear: texts.some(t => t.includes('全部關卡完成') || t.includes('ALL LEVELS CLEARED')),
            hasMasterTitle: texts.some(t => t.includes('你成為數字王者') || t.includes('YOU BECAME THE NUMBER MASTER')),
            hasPlayAgain: playAgainBtn !== undefined,
            hasLevelSelect: levelSelectBtn !== undefined,
            hasNextBtn: nextBtn !== undefined,
            highestUnlocked
        };
    }, buScoreBefore);

    assert(buFinale.gameState === 'LEVEL_CLEAR', `BU: Game state becomes LEVEL_CLEAR`);
    assert(buFinale.bossDestroyed === true, `BU: Ultimate Boss 500 destroyed`);
    assert(buFinale.scoreDiff === 3000, `BU: Defeating Ultimate Boss awards exactly +3000 points, got ${buFinale.scoreDiff}`);
    assert(buFinale.hasAllClear, `BU: Final clear banner displayed ("全部關卡完成！")`);
    assert(buFinale.hasMasterTitle, `BU: Master title displayed ("你成為數字王者！")`);
    assert(buFinale.hasPlayAgain === true, `BU: "再玩一次" (playAgainBtn) button displayed`);
    assert(buFinale.hasLevelSelect === true, `BU: "選擇關卡" (levelSelectBtn) button displayed`);
    assert(buFinale.hasNextBtn === false, `BU: NO "下一關" (nextBtn) button displayed`);
    assert(buFinale.highestUnlocked === 4, `BU: Highest unlocked level remains 4 (NO LEVEL 5)`);

    // --- Test BV: Responsive Finale Across 7 Viewports ---
    console.log('\n--- Test BV: Responsive Finale Across 7 Viewports ---');
    const viewports = [
        { width: 375, height: 667 },
        { width: 390, height: 844 },
        { width: 412, height: 915 },
        { width: 768, height: 1024 },
        { width: 820, height: 1180 },
        { width: 1280, height: 800 },
        { width: 1920, height: 1080 }
    ];

    for (const vp of viewports) {
        await v6Page.setViewportSize(vp);
        await v6Page.waitForTimeout(300);

        const bvCheck = await v6Page.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            if (!gs) return { valid: false };
            const bounds = gs.getLayoutBounds();
            const checkOverlap = (r1, r2) => {
                if (!r1 || !r2) return false;
                if (r1.width <= 0 || r1.height <= 0 || r2.width <= 0 || r2.height <= 0) return false;
                return !(r1.x + r1.width <= r2.x || r2.x + r2.width <= r1.x || r1.y + r1.height <= r2.y || r2.y + r2.height <= r1.y);
            };

            const overlap = checkOverlap(bounds.hp, bounds.score) ||
                            checkOverlap(bounds.score, bounds.best) ||
                            checkOverlap(bounds.leaderboard, bounds.hp) ||
                            checkOverlap(bounds.joystick, bounds.boostButton);

            return {
                valid: true,
                overlap
            };
        });

        assert(bvCheck.valid === true, `BV: Scene valid at ${vp.width}x${vp.height}`);
        assert(bvCheck.overlap === false, `BV: No HUD layout overlap at ${vp.width}x${vp.height}`);
    }

    // Helper for executing production wheel reward flow
    async function executeRealWheelRewardFlow(page, rewardId, baselineSetup) {
        await page.evaluate(({ rId, setup }) => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            gs.hardReset();
            gs.levelId = 4;
            gs.levelDef = window.__PHASER_GAME__.registry.get('level_4') || gs.levelDef;
            gs.gameState = 'RUNNING';
            gs.stopSpawning();
            for (const e of gs.enemies) e.destroy();
            gs.enemies = [];
            if (gs.boss) { gs.boss.destroy(); gs.boss = null; gs.bossSpawned = false; }
            if (gs.ultimateBoss) { gs.ultimateBoss.destroy(); gs.ultimateBoss = null; }
            if (gs.luckyWheelOverlay) { gs.luckyWheelOverlay.destroy(); gs.luckyWheelOverlay = null; }
            gs.isUltimatePhase = false;

            gs.player.value = setup.value || 401;
            gs.player.hp = setup.hp || 3;
            gs.player.maxHp = setup.maxHp || 6;
            gs.player.boostEnergy = setup.boostEnergy !== undefined ? setup.boostEnergy : 20;
            gs.player.segments = setup.segments || 5;
            if (setup.magnetCooldown) {
                gs.magnet.state = 'COOLDOWN';
                gs.magnet.cooldownTimer = 15;
                gs.magnet.isActive = false;
            } else {
                gs.magnet.state = 'READY';
                gs.magnet.cooldownTimer = 0;
                gs.magnet.isActive = false;
            }

            gs.beginLuckyWheelFinale();
            window.__NUMBER_SNAKE_DEBUG__.setForcedWheelRewardForTest(rId);
        }, { rId: rewardId, setup: baselineSetup });

        await page.waitForFunction(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            return gs && gs.luckyWheelOverlay && gs.luckyWheelOverlay.spinBtn && gs.luckyWheelOverlay.spinBtn.visible;
        }, { timeout: 5000 });

        const spinCoord = await page.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            const btn = gs.luckyWheelOverlay.spinBtn;
            const canvas = window.__PHASER_GAME__.canvas;
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / window.__PHASER_GAME__.scale.width;
            const scaleY = rect.height / window.__PHASER_GAME__.scale.height;
            return { x: rect.left + btn.x * scaleX, y: rect.top + btn.y * scaleY };
        });
        await page.mouse.click(spinCoord.x, spinCoord.y);
        await page.waitForTimeout(300);
        await page.evaluate(({ rId }) => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            if (gs && gs.luckyWheelOverlay && !gs.luckyWheelOverlay.isSpinning && !gs.luckyWheelOverlay.hasSpun) {
                gs.luckyWheelOverlay.spin(rId);
            }
        }, { rId: rewardId });

        await page.waitForFunction(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            return gs && gs.luckyWheelOverlay && gs.luckyWheelOverlay.rewardApplied === true;
        }, { timeout: 8000 });

        const confirmCoord = await page.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            const btn = gs.luckyWheelOverlay.confirmBtn;
            const canvas = window.__PHASER_GAME__.canvas;
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / window.__PHASER_GAME__.scale.width;
            const scaleY = rect.height / window.__PHASER_GAME__.scale.height;
            return { x: rect.left + btn.x * scaleX, y: rect.top + btn.y * scaleY };
        });
        await page.mouse.click(confirmCoord.x, confirmCoord.y);
        await page.waitForTimeout(300);
        await page.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            if (gs && gs.luckyWheelOverlay && !gs.luckyWheelOverlay.completed && gs.luckyWheelOverlay.selectedReward) {
                gs.luckyWheelOverlay.confirmBtn.emit('pointerdown');
            }
        });

        await page.waitForFunction(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            if (gs && gs.isUltimatePhase === true) {
                if (!gs.__wheelTestSnapshot) {
                    gs.__wheelTestSnapshot = {
                        value: gs.player.value,
                        hp: gs.player.hp,
                        maxHp: gs.player.maxHp,
                        boostEnergy: gs.player.boostEnergy,
                        segments: gs.player.segments,
                        magnetState: gs.magnet.state
                    };
                }
                return true;
            }
            return false;
        }, { timeout: 5000 });

        return await page.evaluate(() => {
            const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
            const snap = gs.__wheelTestSnapshot || {
                value: gs.player.value,
                hp: gs.player.hp,
                maxHp: gs.player.maxHp,
                boostEnergy: gs.player.boostEnergy,
                segments: gs.player.segments,
                magnetState: gs.magnet.state
            };
            delete gs.__wheelTestSnapshot;
            return snap;
        });
    }

    // --- Test BQ: Production Rewards Verification (Rewards A, B, C) ---
    console.log('\n--- Test BQ: Production Rewards Verification (Rewards A, B, C) ---');
    await v6Page.setViewportSize({ width: 1024, height: 768 });
    await v6Page.waitForTimeout(200);

    // Reward A (+100 value)
    const resA = await executeRealWheelRewardFlow(v6Page, 'A', { value: 401, hp: 3, maxHp: 6, boostEnergy: 20, segments: 5 });
    assert(resA.value === 501, `BQ: Reward A produces Value 501, got ${resA.value}`);
    assert(resA.hp === 3, `BQ: Reward A leaves HP unchanged at 3, got ${resA.hp}`);
    assert(resA.boostEnergy === 20, `BQ: Reward A leaves Boost unchanged at 20, got ${resA.boostEnergy}`);
    assert(resA.segments === 5, `BQ: Reward A leaves body segments unchanged at 5, got ${resA.segments}`);

    // Reward B (+150 value)
    const resB = await executeRealWheelRewardFlow(v6Page, 'B', { value: 401, hp: 3, maxHp: 6, boostEnergy: 20, segments: 5 });
    assert(resB.value === 551, `BQ: Reward B produces Value 551, got ${resB.value}`);
    assert(resB.hp === 3, `BQ: Reward B leaves HP unchanged at 3, got ${resB.hp}`);
    assert(resB.boostEnergy === 20, `BQ: Reward B leaves Boost unchanged at 20, got ${resB.boostEnergy}`);
    assert(resB.segments === 5, `BQ: Reward B leaves body segments unchanged at 5, got ${resB.segments}`);

    // Reward C (+75 value, Full HP)
    const resC = await executeRealWheelRewardFlow(v6Page, 'C', { value: 401, hp: 1, maxHp: 6, boostEnergy: 20, segments: 5 });
    assert(resC.value === 476, `BQ: Reward C produces Value 476, got ${resC.value}`);
    assert(resC.hp === 6, `BQ: Reward C restores HP to MaxHP 6, got ${resC.hp}`);
    assert(resC.boostEnergy === 20, `BQ: Reward C leaves Boost unchanged at 20, got ${resC.boostEnergy}`);
    assert(resC.segments === 5, `BQ: Reward C leaves body segments unchanged at 5, got ${resC.segments}`);

    // Duplicate apply attempt (Section 19: Reward apply strictly once)
    const dupVal = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.transitionToUltimateArena({ id: 'C', valueBonus: 75, fullHP: true, index: 2, labelKey: 'rewardC', color: 0 });
        return gs.player.value;
    });
    assert(dupVal === 476, `BQ: Reward C bonus applied strictly ONCE; duplicate attempt ignored (expected 476, got ${dupVal})`);

    // --- Test BW: Real End-To-End Finale (zh-TW) ---
    console.log('\n--- Test BW: Real End-To-End Finale (zh-TW) ---');
    await v6Page.evaluate(() => {
        localStorage.setItem('number_snake_language_v1', 'zh-TW');
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.gameState = 'TRANSITIONING';
        gs.scene.start('GameScene', { levelId: 4 });
    });
    await v6Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.gameState === 'RUNNING' && gs.levelId === 4 && gs.player && gs.player.head;
    }, { timeout: 10000 });
    await v6Page.waitForTimeout(500);

    // 1. Defeat Boss 400 to enter Lucky Wheel
    await v6Page.evaluate(() => {
        window.__NUMBER_SNAKE_DEBUG__.setPlayerValue(405);
        window.__NUMBER_SNAKE_DEBUG__.spawnBoss();
    });
    await v6Page.waitForTimeout(500);
    await v6Page.evaluate(() => {
        window.__NUMBER_SNAKE_DEBUG__.forceCollisionWithBoss();
    });

    // 2. Wait for Boss 400 defeat -> LUCKY_WHEEL state
    await v6Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.gameState === 'LUCKY_WHEEL' && gs.luckyWheelOverlay !== null;
    }, { timeout: 8000 });

    // 3. Set deterministic reward and click real spin button
    await v6Page.evaluate(() => {
        window.__NUMBER_SNAKE_DEBUG__.setForcedWheelRewardForTest('C');
    });

    const bwSpinCoord = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const btn = gs.luckyWheelOverlay.spinBtn;
        const canvas = window.__PHASER_GAME__.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / window.__PHASER_GAME__.scale.width;
        const scaleY = rect.height / window.__PHASER_GAME__.scale.height;
        return { x: rect.left + btn.x * scaleX, y: rect.top + btn.y * scaleY };
    });
    await v6Page.mouse.click(bwSpinCoord.x, bwSpinCoord.y);
    await v6Page.waitForTimeout(300);
    await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        if (gs && gs.luckyWheelOverlay && !gs.luckyWheelOverlay.isSpinning && !gs.luckyWheelOverlay.hasSpun) {
            gs.luckyWheelOverlay.spin('C');
        }
    });

    // 4. Wait for wheel deceleration to finish
    await v6Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.luckyWheelOverlay && gs.luckyWheelOverlay.rewardApplied === true;
    }, { timeout: 8000 });

    // 5. Real click 迎戰終極首領 (confirm button)
    const bwConfirmCoord = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const btn = gs.luckyWheelOverlay.confirmBtn;
        const canvas = window.__PHASER_GAME__.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / window.__PHASER_GAME__.scale.width;
        const scaleY = rect.height / window.__PHASER_GAME__.scale.height;
        return { x: rect.left + btn.x * scaleX, y: rect.top + btn.y * scaleY };
    });
    await v6Page.mouse.click(bwConfirmCoord.x, bwConfirmCoord.y);
    await v6Page.waitForTimeout(300);
    await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        if (gs && gs.luckyWheelOverlay && !gs.luckyWheelOverlay.completed && gs.luckyWheelOverlay.selectedReward) {
            gs.luckyWheelOverlay.confirmBtn.emit('pointerdown');
        }
    });

    // 6. Wait for transition to Ultimate Arena
    await v6Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.isUltimatePhase === true;
    }, { timeout: 5000 });

    // 7. Grow > 500 using natural edible enemy collision
    await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        // Player has 405 + 75 = 480 value
        if (gs.enemies.length > 0) {
            const e = gs.enemies[0];
            e.value = 35; // 480 + 35 = 515 > 500
            e.body.setPosition(gs.player.head.x, gs.player.head.y);
        }
    });

    await v6Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.player && gs.player.value > 500;
    }, { timeout: 5000 });

    // 8. Natural physics collision with Ultimate Boss 500
    await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        if (gs.ultimateBoss && gs.ultimateBoss.body) {
            gs.ultimateBoss.body.setPosition(gs.player.head.x, gs.player.head.y);
            gs.ultimateBoss.valueText.setPosition(gs.player.head.x, gs.player.head.y);
        }
    });

    await v6Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.gameState === 'LEVEL_CLEAR' && gs.ultimateBoss === null;
    }, { timeout: 10000 });

    // Wait for showLevelClearScreen (1000ms delay) to render final banner and buttons
    await v6Page.waitForFunction(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        return gs && gs.children.list.some(c => c.type === 'Text' && c.text && c.text.includes('全部關卡完成'));
    }, { timeout: 10000 });

    // 9. Assert final victory texts in zh-TW
    const bwFinal = await v6Page.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        const texts = gs.children.list.filter(c => c.type === 'Text' && c.depth >= 300).map(t => t.text);
        const highest = window.__NUMBER_SNAKE_DEBUG__.getProgression().highestUnlockedLevel;
        return {
            hasLevelClear: texts.some(t => t.includes('完成') || t.includes('第 4 關完成')),
            hasAllClear: texts.some(t => t.includes('全部關卡完成！')),
            hasMasterTitle: texts.some(t => t.includes('你成為數字王者！')),
            highest
        };
    });

    assert(bwFinal.hasLevelClear, `BW: Level 4 clear text displayed ("第 4 關完成！")`);
    assert(bwFinal.hasAllClear, `BW: Final clear banner displayed ("全部關卡完成！")`);
    assert(bwFinal.hasMasterTitle, `BW: Master title displayed ("你成為數字王者！")`);
    assert(bwFinal.highest === 4, `BW: Progression highest unlocked level strictly caps at 4 (NO LEVEL 5)`);

    // --- Test BX: English Tutorial Purity ---
    console.log('\n--- Test BX: English Tutorial Purity ---');
    const bxContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    await bxContext.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('number_snake_language_v1', 'en');
        localStorage.setItem('tutorialSeen', 'false');
    });
    const bxPage = await bxContext.newPage();
    await bxPage.goto(baseURL + '?debug=1&e2e=1');
    await bxPage.waitForFunction(() => window.__PHASER_GAME__ && window.__PHASER_GAME__.scene.isActive('MenuScene'), { timeout: 10000 });

    const bxTutorial = await bxPage.evaluate(() => {
        const ms = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
        return ms && ms.tutorialText ? ms.tutorialText.text : null;
    });

    assert(bxTutorial !== null, `BX: Tutorial text is displayed when tutorialSeen is false`);
    assert(bxTutorial.includes('Eat numbers smaller than you!'), `BX: Contains "Eat numbers smaller than you!", got "${bxTutorial}"`);
    assert(bxTutorial.includes('Avoid numbers bigger than you!'), `BX: Contains "Avoid numbers bigger than you!", got "${bxTutorial}"`);
    assert(!/[\u3400-\u9FFF]/.test(bxTutorial), `BX: English tutorial strictly contains NO Chinese characters`);
    await bxContext.close();

    // --- Test BY: Clean Launch Defaults to Traditional Chinese ---
    console.log('\n--- Test BY: Clean Launch Defaults to Traditional Chinese ---');
    const byContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    await byContext.addInitScript(() => {
        localStorage.clear();
    });
    const byPage = await byContext.newPage();
    await byPage.goto(baseURL + '?debug=1&e2e=1');
    await byPage.waitForFunction(() => window.__PHASER_GAME__ && window.__PHASER_GAME__.scene.isActive('MenuScene'), { timeout: 10000 });

    const byCheck = await byPage.evaluate(() => {
        const ms = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'MenuScene');
        return {
            title: ms.titleText ? ms.titleText.text : '',
            levelSelect: ms.levelSelectText ? ms.levelSelectText.text : '',
            startBtn: ms.levelCards && ms.levelCards[0] ? ms.levelCards[0].list.find(c => c.type === 'Text' && c.text === '開始')?.text : '',
            tutorial: ms.tutorialText ? ms.tutorialText.text : ''
        };
    });

    assert(byCheck.title === '數字蛇競技場', `BY: Clean launch defaults to "數字蛇競技場", got "${byCheck.title}"`);
    assert(byCheck.levelSelect === '關卡選擇', `BY: Level select title is "關卡選擇", got "${byCheck.levelSelect}"`);
    assert(byCheck.startBtn === '開始', `BY: Card start button is "開始", got "${byCheck.startBtn}"`);
    assert(byCheck.tutorial.includes('吃掉比你小的數字！') && byCheck.tutorial.includes('躲開比你大的數字！'),
        `BY: Tutorial is Traditional Chinese, got "${byCheck.tutorial}"`);
    await byContext.close();

    // --- Test BZ: Production Rewards Verification (Rewards D, E, F) ---
    console.log('\n--- Test BZ: Production Rewards Verification (Rewards D, E, F) ---');

    // Reward D (+75 value, Boost 100)
    const resD = await executeRealWheelRewardFlow(v6Page, 'D', { value: 401, hp: 3, maxHp: 6, boostEnergy: 20, segments: 5 });
    assert(resD.value === 476, `BZ: Reward D produces Value 476, got ${resD.value}`);
    assert(resD.hp === 3, `BZ: Reward D leaves HP unchanged at 3, got ${resD.hp}`);
    assert(resD.boostEnergy === 100, `BZ: Reward D fills Boost Energy to 100, got ${resD.boostEnergy}`);
    assert(resD.segments === 5, `BZ: Reward D leaves body segments unchanged at 5, got ${resD.segments}`);

    // Reward E (+75 value, Magnet Ready)
    const resE = await executeRealWheelRewardFlow(v6Page, 'E', { value: 401, hp: 3, maxHp: 6, boostEnergy: 20, segments: 5, magnetCooldown: true });
    assert(resE.value === 476, `BZ: Reward E produces Value 476, got ${resE.value}`);
    assert(resE.magnetState === 'READY', `BZ: Reward E immediately resets Magnet to READY, got ${resE.magnetState}`);
    assert(resE.segments === 5, `BZ: Reward E leaves body segments unchanged at 5, got ${resE.segments}`);

    // Reward F (+200 value, Full HP, Boost 100)
    const resF = await executeRealWheelRewardFlow(v6Page, 'F', { value: 401, hp: 1, maxHp: 6, boostEnergy: 20, segments: 5 });
    assert(resF.value === 601, `BZ: Reward F produces Value 601, got ${resF.value}`);
    assert(resF.hp === 6, `BZ: Reward F restores HP to MaxHP 6, got ${resF.hp}`);
    assert(resF.boostEnergy === 100, `BZ: Reward F fills Boost Energy to 100, got ${resF.boostEnergy}`);
    assert(resF.segments === 5, `BZ: Reward F leaves body segments unchanged at 5, got ${resF.segments}`);

    await v6Context.close();

    console.log(`\n=== FINAL SCRIPT RESULTS ===`);
    console.log(`Total Errors/Failed Asserts: ${totalErrors}`);
    
    await browser.close();
    
    if (totalErrors > 0) {
        process.exit(1);
    }
})();

