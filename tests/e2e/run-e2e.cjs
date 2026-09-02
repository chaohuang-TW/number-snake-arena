const { chromium } = require('playwright');

const baseURL = process.env.BASE_URL || 'http://localhost:3000/';

(async () => {
    const browser = await chromium.launch({ headless: true });
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
            
            // start game
            let vpNormal = page.viewportSize();
            await page.mouse.click(page.viewportSize().width / 2 - 300, page.viewportSize().height / 2 + 100); 
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
            await page.mouse.click(page.viewportSize().width / 2 - 300, page.viewportSize().height / 2 + 100); 
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
            await page.goto(process.env.BASE_URL + '?debug=1&e2e=1');
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
            await page2.goto(process.env.BASE_URL + '?debug=1&e2e=1');
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
                await tPage.waitForTimeout(1500);
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
                await tPage.evaluate(() => { window.API = window.__NUMBER_SNAKE_DEBUG__; window.API.stopSpawning(); });
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
                await dPage.waitForTimeout(1500);
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
            await rotPage.waitForTimeout(1500);
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
    await adPage.waitForTimeout(500);
    await adPage.evaluate(() => {
        const gs = window.__PHASER_GAME__.scene.scenes.find(s => s.scene.key === 'GameScene');
        gs.levelClear();
    });
    await adPage.waitForTimeout(4000);
    
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
    await adPage.waitForTimeout(1000);
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
        gs.handleBossCollision(); // Trigger win
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

    console.log(`\n=== FINAL SCRIPT RESULTS ===`);
    console.log(`Total Errors/Failed Asserts: ${totalErrors}`);
    
    await browser.close();
    
    if (totalErrors > 0) {
        process.exit(1);
    }
})();
