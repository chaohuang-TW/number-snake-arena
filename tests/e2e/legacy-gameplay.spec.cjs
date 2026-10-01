const {test,expect}=require('playwright/test');
const {boot,startGame,sceneState,fixtureEnemy,clickButton,realBossContact}=require('./helpers.cjs');
const expectedBuildVersion=require('../../package.json').version;

test('N,T,V,AG,AJ: four arenas reset run state and preserve real progress',async({page})=>{
 await boot(page,{save:{number_snake_progression:{version:1,highestUnlockedLevel:4,maxHPBonus:3,claimedRewards:['level-1-clear-heart','level-2-clear-heart','level-3-clear-heart'],bestScoreByLevel:{1:20,2:30}}}});
 for(const level of[1,2,3,4]){
  await startGame(page,{level,clean:false,freeze:true});await page.waitForTimeout(100);const s=await sceneState(page);expect(s.value).toBe(5);expect(s.hp).toBe(6);expect(s.energy).toBe(100);expect(s.enemies).toBeGreaterThanOrEqual(20);expect(s.enemies).toBeLessThanOrEqual(38);expect(s.score).toBe(0);expect(s.orbs).toBe(0);
  const state=await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');return{combo:s.comboCount,boss:s.boss,ultimate:s.ultimateBoss,magnet:s.magnet.state,values:s.enemies.map(e=>e.value)}});expect(state.combo).toBe(0);expect(state.boss).toBe(null);expect(state.ultimate).toBe(null);expect(state.magnet).toBe('READY');expect(state.values.every(v=>v>=1&&v<=level*100-1)).toBe(true);
 }
});

test('O,P,R,AE,AF,AI: live clear freezes, first rewards persist after reload and replay cannot farm',async({page})=>{
 await boot(page);
 for(const level of[1,2,3]){
  await realBossContact(page,{level,value:level*100+1});await expect.poll(async()=>(await sceneState(page)).state).toBe('LEVEL_CLEAR');
  const before=await sceneState(page);await page.waitForTimeout(1100);const after=await sceneState(page);expect(after.hp).toBe(before.hp);expect(after.enemies).toBe(before.enemies);expect(after.value).toBe(before.value);
  await expect.poll(()=>page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').children.list.filter(o=>o.type==='Text').map(o=>o.text).join(' '))).toContain('完成！');const texts=await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').children.list.filter(o=>o.type==='Text').map(o=>o.text).join(' '));expect(texts).toContain('完成！');expect(texts).toContain('+1 愛心');expect(texts).toContain('解鎖');
  await page.reload();await page.waitForFunction(()=>window.__PHASER_GAME__.scene.isActive('MenuScene'));const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('number_snake_progression')));expect(saved.highestUnlockedLevel).toBe(level+1);expect(saved.maxHPBonus).toBe(level);expect(saved.claimedRewards).toHaveLength(level);
  await realBossContact(page,{level,value:level*100+1});await expect.poll(async()=>(await sceneState(page)).state).toBe('LEVEL_CLEAR');expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getMaxHP())).toBe(3+level);
  await clickButton(page,'GameScene','nextBtn');expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('PrepScene').getSelectedStartValue())).toBe(5);await clickButton(page,'PrepScene','startLevelBtn');expect((await sceneState(page)).value).toBe(5);expect((await sceneState(page)).hp).toBe(3+level);
 }
 const progress=await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getProgression());await startGame(page,{level:4,value:5,freeze:true});await fixtureEnemy(page,{value:500});await expect.poll(async()=>(await sceneState(page)).state).toBe('GAME_OVER');expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getProgression())).toEqual(progress);
});

test('I,AV: combo timeout restarts at one; hard reset retains this run starting choice10',async({page})=>{
 await boot(page);await startGame(page,{value:10,freeze:true});await fixtureEnemy(page,{value:3});await expect.poll(async()=>(await sceneState(page)).value).toBe(13);await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').player.teleport(400,0));await page.waitForTimeout(2700);expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').comboCount)).toBe(0);await fixtureEnemy(page,{value:4,x:400,y:0});await expect.poll(async()=>(await sceneState(page)).value).toBe(17);expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').comboCount)).toBe(1);await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.hardReset());expect((await sceneState(page)).value).toBe(10);expect((await sceneState(page)).targetLength).toBeCloseTo(36+24*Math.sqrt(10));
 expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').player.steeringSegments)).toBe(5);
});

test('AC: normal mixed population stays below50percent in the160px edge band after five seconds',async({page})=>{
 await boot(page);await page.evaluate(()=>{let seed=7341;window.savedRandom=Math.random;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}});await startGame(page,{value:5,clean:false});await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.player.isInvulnerable=true;for(let i=0;i<18;i++)s.spawnEnemy()});const initial=await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getEnemies().map(e=>e.value));expect(initial.some(v=>v<5)).toBe(true);expect(initial.some(v=>v>=5)).toBe(true);await page.waitForTimeout(5100);
 const points=await page.evaluate(()=>{const result=window.__NUMBER_SNAKE_DEBUG__.getEnemies().map(e=>({x:e.body.x,y:e.body.y}));Math.random=window.savedRandom;return result});expect(points.length).toBeGreaterThan(0);expect(points.length).toBeLessThanOrEqual(38);expect(points.filter(p=>Math.abs(p.x)>1040||Math.abs(p.y)>640).length/points.length).toBeLessThanOrEqual(.5);
});

test('BH,BI,BT: ordinary boss flees while boosted player closes and really catches it',async({page})=>{
 await boot(page);await startGame(page,{value:101});await page.evaluate(()=>{window.__NUMBER_SNAKE_DEBUG__.spawnBoss();const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.boss.body.body.reset(600,0)});
 await page.waitForTimeout(100);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getBossState())).toBe('FLEE');const distance=()=>page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');return s.boss?Math.hypot(s.boss.body.x-s.player.head.x,s.boss.body.y-s.player.head.y):0});const before=await distance();await page.keyboard.down('Space');await page.waitForTimeout(800);expect(await distance()).toBeLessThan(before);const speed=await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');return s.boss?Math.hypot(s.boss.body.body.velocity.x,s.boss.body.body.velocity.y):100});expect(speed).toBeGreaterThan(50);await expect.poll(async()=>(await sceneState(page)).state,{timeout:8000}).toBe('LEVEL_CLEAR');await page.keyboard.up('Space');
});

test('M: after twenty replays keyboard movement and boost remain functional',async({page})=>{
 await boot(page);for(let i=0;i<20;i++)await startGame(page,{value:10});await page.keyboard.down('ArrowDown');await page.keyboard.down('Space');await page.waitForTimeout(350);const s=await sceneState(page);expect(s.y).toBeGreaterThan(25);expect(s.energy).toBeLessThan(100);await page.keyboard.up('Space');await page.keyboard.up('ArrowDown');
});

test('BC: URL with no query exposes build only and no mutating game globals',async({page})=>{
 await page.goto('./');await page.locator('canvas').waitFor({state:'visible'});const build=await page.evaluate(()=>window.__NUMBER_SNAKE_BUILD__);expect(build.version).toBe(expectedBuildVersion);if(process.env.EXPECT_BUILD_COMMIT)expect(build.commit).toBe(process.env.EXPECT_BUILD_COMMIT);
 const globals=await page.evaluate(()=>({debug:typeof window.__NUMBER_SNAKE_DEBUG__,phaser:typeof window.__PHASER_GAME__,readonly:typeof window.__E2E_READONLY__,version:window.__NUMBER_SNAKE_BUILD__.version}));expect(globals).toEqual({debug:'undefined',phaser:'undefined',readonly:'undefined',version:expectedBuildVersion});
});

test('BT: eating the live ultimate arena ecosystem grows below500 player and reverses boss pursuit',async({page})=>{
 await boot(page);await startGame(page,{level:4,value:401,freeze:true});await page.evaluate(()=>{window.__NUMBER_SNAKE_DEBUG__.setForcedWheelRewardForTest('C');window.__NUMBER_SNAKE_DEBUG__.spawnBoss();const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.boss.body.body.reset(0,0);s.boss.body.body.moves=false});await expect.poll(async()=>(await sceneState(page)).state).toBe('LUCKY_WHEEL');await clickButton(page,'GameScene','luckyWheelOverlay.spinBtn');await clickButton(page,'GameScene','luckyWheelOverlay.confirmBtn');await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.isUltimatePhaseActive())).toBe(true);expect((await sceneState(page)).value).toBe(476);
 // Use enemies spawned by the ordinary finale, position setup only. No value award is injected.
 await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.ultimateBoss.body.body.moves=false;const e=s.enemies.find(e=>e.value===31);e.seedPathForTest([{x:s.player.head.x,y:s.player.head.y},{x:s.player.head.x-140,y:s.player.head.y}]);e.body.body.moves=false});await expect.poll(async()=>(await sceneState(page)).value).toBe(507);await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getUltimateBoss().state)).toBe('FLEE');expect((await sceneState(page)).targetLength).toBeCloseTo(36+24*Math.sqrt(507));
});

for(const value of[499,500])test(`BS: player${value} real head contact cannot eat Ultimate500`,async({page})=>{
 await boot(page);await realBossContact(page,{level:4,value,ultimate:true});await expect.poll(async()=>(await sceneState(page)).hp).toBe(2);expect((await sceneState(page)).value).toBe(value);expect((await sceneState(page)).state).toBe('RUNNING');expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getUltimateBoss().body.active)).toBe(true);
});

test('J: each native arrow turns the real head and moves in its corresponding direction',async({page})=>{
 await boot(page);await startGame(page,{value:5});
 for(const[key,angle,axis,sign]of[['ArrowRight',0,'x',1],['ArrowDown',Math.PI/2,'y',1],['ArrowLeft',Math.PI,'x',-1],['ArrowUp',-Math.PI/2,'y',-1]]){
  const before=await sceneState(page);await page.keyboard.down(key);await page.waitForTimeout(700);const after=await sceneState(page);expect((after[axis]-before[axis])*sign).toBeGreaterThan(20);const diff=await page.evaluate(angle=>{const p=window.__PHASER_GAME__.scene.getScene('GameScene').player;return Math.abs(Math.atan2(Math.sin(p.currentAngle-angle),Math.cos(p.currentAngle-angle)))},angle);expect(diff).toBeLessThan(.2);await page.keyboard.up(key);
 }
});

test('T,U: level2 can spawn ordinary enemies above99 while capped199; Value70 cannot trigger200',async({page})=>{
 await boot(page);await startGame(page,{level:2,value:70,freeze:true});await page.waitForTimeout(100);expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').boss)).toBe(null);await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene'),random=Math.random;try{s.player.value=150;for(let i=0;i<4;i++){let draws=0;Math.random=()=>draws++<2?.9:random();s.spawnEnemy()}}finally{Math.random=random}});const values=await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getEnemies().map(e=>e.value));expect(values.every(v=>v<=199)).toBe(true);expect(values.some(v=>v>99)).toBe(true);
});

test('AW,V: locked preparation returns to the real menu; arena transitions load no404 resources',async({page})=>{
 const missing=[];page.on('response',r=>{if(r.status()===404)missing.push(r.url())});await boot(page);await page.evaluate(()=>window.__PHASER_GAME__.scene.start('PrepScene',{levelId:4}));await expect.poll(()=>page.evaluate(()=>window.__PHASER_GAME__.scene.isActive('MenuScene'))).toBe(true);expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.isActive('PrepScene'))).toBe(false);await clickButton(page,'MenuScene','startBtn_1');await clickButton(page,'PrepScene','startLevelBtn');await page.waitForFunction(()=>window.__PHASER_GAME__.scene.isActive('GameScene'));await page.waitForTimeout(100);expect(missing).toEqual([]);
});
