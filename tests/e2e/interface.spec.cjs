const {test,expect}=require('playwright/test');
const fs=require('node:fs');
const {boot,startGame,sceneState,clickButton,buttonPoint}=require('./helpers.cjs');
const viewports=[[390,844],[430,932],[844,390],[932,430],[768,1024],[1024,768],[834,1194],[1024,1366],[1366,768],[1920,1080]];
const evidence=process.env.EVIDENCE_DIR;
function overlaps(a,b){return a&&b&&a.width>0&&a.height>0&&b.width>0&&b.height>0&&Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>2&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>2}
async function capture(page,name){if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:evidence+'/'+name+'.png'})}}
for(const[w,h]of viewports)for(const language of(w<h&&w<500?['zh-TW','en']:['zh-TW'])){
 test(`AM,BB,BD,BK,BV: ${w}x${h} ${language} real UI bounds and touch capability`,async({browser})=>{
  const touch=w<1100,ctx=await browser.newContext({viewport:{width:w,height:h},hasTouch:touch,recordVideo:undefined});const page=await ctx.newPage();
  try{await boot(page,{language});
   const start=await buttonPoint(page,'MenuScene','startBtn_1');expect(start.height).toBeGreaterThanOrEqual(48);await clickButton(page,'MenuScene','startBtn_1',{tap:touch});await expect.poll(()=>page.evaluate(()=>window.__PHASER_GAME__.scene.isActive('PrepScene'))).toBe(true);
   await clickButton(page,'PrepScene','startLevelBtn',{tap:touch});await expect.poll(()=>page.evaluate(()=>window.__PHASER_GAME__.scene.isActive('GameScene'))).toBe(true);
   await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.stopSpawning();s.hardReset();s.player.head.body.moves=false;s.cameras.main.startFollow(s.player.head,true,1,1);s.cameras.main.centerOn(0,0);s.debugUI?.text.setVisible(false);s.physics.world.drawDebug=false;s.physics.world.debugGraphic?.clear();window.__NUMBER_SNAKE_DEBUG__.spawnBoss();s.boss.body.body.reset(1000,-600);s.boss.body.body.moves=false});await page.waitForTimeout(200);
   const bounds=await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').getLayoutBounds());
   for(const[k,b]of Object.entries(bounds)){if(!b||!b.width||!b.height)continue;expect(b.x,`${k} left`).toBeGreaterThanOrEqual(-1);expect(b.y,`${k} top`).toBeGreaterThanOrEqual(-1);expect(b.x+b.width,`${k} right`).toBeLessThanOrEqual(w+1);expect(b.y+b.height,`${k} bottom`).toBeLessThanOrEqual(h+1)}
   for(const pair of[['value','leaderboard'],['value','hp'],['value','bossIndicator'],['hp','leaderboard'],['score','leaderboard'],['best','leaderboard'],['magnetHUD','leaderboard'],['boostBar','boostButton'],['boostBar','magnetButton'],['boostButton','magnetButton'],['joystick','boostButton'],['joystick','magnetButton'],['bossIndicator','leaderboard'],['bossIndicator','hp'],['bossIndicator','boostButton'],['bossIndicator','magnetButton']])expect(overlaps(bounds[pair[0]],bounds[pair[1]]),pair.join(' / ')).toBe(false);
   const visible=Object.entries(bounds).filter(([name,b])=>b&&b.width>0&&b.height>0);for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++)expect(overlaps(visible[i][1],visible[j][1]),`${visible[i][0]} / ${visible[j][0]}`).toBe(false);
   const input=await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');return{touch:s.joystick.isVisible?.()??s.joystick.base.visible,boost:s.hud.boostButton.visible,magnet:s.hud.magnetButton.visible}});
   expect(input.boost).toBe(touch);expect(input.magnet).toBe(touch);
   if(touch){await clickButton(page,'GameScene','hud.magnetButton',{tap:true});await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getMagnetState())).toBe('ACTIVE')}
   await capture(page,`${w}x${h}-${language}-game`);
   // Finale must remain usable through one native tap even in landscape.
   await startGame(page,{level:4,value:401,freeze:true});await page.evaluate(()=>{window.__NUMBER_SNAKE_DEBUG__.spawnBoss();const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.boss.body.body.reset(0,0);s.boss.body.body.moves=false});await expect.poll(async()=>(await sceneState(page)).state).toBe('LUCKY_WHEEL');
   const spin=await buttonPoint(page,'GameScene','luckyWheelOverlay.spinBtn');expect(spin.height).toBeGreaterThanOrEqual(48);await clickButton(page,'GameScene','luckyWheelOverlay.spinBtn',{tap:touch});await clickButton(page,'GameScene','luckyWheelOverlay.confirmBtn',{tap:touch});await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.isUltimatePhaseActive())).toBe(true);
   await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.stopSpawning();s.player.value=501;s.player.head.body.moves=false;s.ultimateBoss.body.body.reset(s.player.head.x,s.player.head.y);s.ultimateBoss.body.body.moves=false});await expect.poll(async()=>(await sceneState(page)).state).toBe('LEVEL_CLEAR');
   await expect.poll(()=>buttonPoint(page,'GameScene','playAgainBtn')).not.toBe(null);for(const name of['playAgainBtn','levelSelectBtn']){const b=await buttonPoint(page,'GameScene',name);expect(b.height).toBeGreaterThanOrEqual(48);expect(b.x-b.width/2).toBeGreaterThanOrEqual(0);expect(b.x+b.width/2).toBeLessThanOrEqual(w);expect(b.y-b.height/2).toBeGreaterThanOrEqual(0);expect(b.y+b.height/2).toBeLessThanOrEqual(h)}
   await capture(page,`${w}x${h}-${language}-final-clear`);await clickButton(page,'GameScene','playAgainBtn',{tap:touch});await expect.poll(()=>page.evaluate(()=>window.__PHASER_GAME__.scene.isActive('PrepScene'))).toBe(true);
  }finally{await ctx.close()}
 });
}

test('AU,AV,AW,BF: prep values 5/7/10, back and default reset use one click',async({page})=>{
 await boot(page);for(const value of[5,7,10]){
  await clickButton(page,'MenuScene','startBtn_1');await clickButton(page,'PrepScene',`prepCard_${value}`);await clickButton(page,'PrepScene','startLevelBtn');await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__?.getRunStartValue())).toBe(value);expect((await sceneState(page)).targetLength).toBeCloseTo(36+24*Math.sqrt(value));
  if(value===10){await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.hardReset());expect((await sceneState(page)).value).toBe(10)}
  await page.evaluate(()=>window.__PHASER_GAME__.scene.start('MenuScene'));await page.waitForFunction(()=>window.__PHASER_GAME__.scene.isActive('MenuScene'));
 }
 await clickButton(page,'MenuScene','startBtn_1');const prep=await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('PrepScene').getSelectedStartValue());expect(prep).toBe(5);await clickButton(page,'PrepScene','backBtn');await expect.poll(()=>page.evaluate(()=>window.__PHASER_GAME__.scene.isActive('MenuScene'))).toBe(true);
});

test('G,J,K,L,W,X,Y,BE: pause, keyboard/boost, touch cancellation and rotation',async({browser})=>{
 const ctx=await browser.newContext({viewport:{width:834,height:1194},hasTouch:true});const page=await ctx.newPage();try{await boot(page);await startGame(page,{value:10});await page.keyboard.down('ArrowDown');await page.keyboard.down('Space');await page.waitForTimeout(400);await page.keyboard.up('Space');await page.keyboard.up('ArrowDown');const active=await sceneState(page);expect(active.y).toBeGreaterThan(30);expect(active.energy).toBeLessThan(100);
  const boost=await buttonPoint(page,'GameScene','hud.boostButton');await page.mouse.move(boost.x,boost.y);await page.mouse.down();await page.waitForTimeout(100);expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').hud.isBoostPressed)).toBe(true);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').hud.isBoostPressed)).toBe(false);await page.mouse.up();
  await page.setViewportSize({width:1194,height:834});await page.waitForTimeout(150);expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').hud.boostButton.visible)).toBe(true);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});await page.waitForFunction(()=>window.__PHASER_GAME__.scene.isActive('PauseScene'));const before=await sceneState(page);await page.waitForTimeout(150);const paused=await sceneState(page);expect(paused.x).toBe(before.x);expect(paused.y).toBe(before.y);expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.isPaused('GameScene'))).toBe(true);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))});await clickButton(page,'PauseScene','resumeBtn');await expect.poll(()=>page.evaluate(()=>window.__PHASER_GAME__.scene.isPaused('GameScene'))).toBe(false);
 }finally{await ctx.close()}
});

test('M,new I: 20 replays keep objects/events bounded, and old progress persists',async({page})=>{
 const save={number_snake_progression:{version:1,highestUnlockedLevel:4,maxHPBonus:3,claimedRewards:['L1_HP','L2_HP','L3_HP'],bestScoreByLevel:{1:222,4:444}},number_snake_cosmetics_v1:{version:1,selectedHeadSkin:'dragon'}};
 await boot(page,{save});let initial;for(let i=0;i<20;i++){await startGame(page,{value:5,freeze:true});const s=await sceneState(page);if(!initial)initial=s;expect(s.children).toBe(initial.children);expect(s.resizeListeners).toBe(initial.resizeListeners);expect(s.shutdownListeners).toBe(initial.shutdownListeners);expect(s.keyboardListeners).toEqual(initial.keyboardListeners)}
 await page.reload();await page.waitForFunction(()=>window.__PHASER_GAME__.scene.isActive('MenuScene'));await startGame(page,{freeze:true});expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getMaxHP())).toBe(6);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getProgression().bestScoreByLevel[4])).toBe(444);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getPlayerHeadSkin())).toBe('dragon');
});

test('N,P,Q,R,S,AE,AF,AI,AJ,BA: first-clear reward once, next/replay routes, best score and no farming',async({page})=>{
 await boot(page);await page.evaluate(()=>window.__PHASER_GAME__.scene.start('GameScene',{levelId:1}));await page.waitForFunction(()=>window.__NUMBER_SNAKE_DEBUG__);await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.resetProgressionForTest());
 for(const level of[1,2,3]){await startGame(page,{level,value:level*100+1,freeze:true});await page.evaluate(()=>{window.__NUMBER_SNAKE_DEBUG__.spawnBoss();const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.boss.body.body.reset(0,0);s.boss.body.body.moves=false});await expect.poll(async()=>(await sceneState(page)).state).toBe('LEVEL_CLEAR');expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getMaxHP())).toBe(3+level);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getProgression().highestUnlockedLevel)).toBe(level+1);await clickButton(page,'GameScene','nextBtn');await expect.poll(()=>page.evaluate(()=>window.__PHASER_GAME__.scene.isActive('PrepScene'))).toBe(true);await clickButton(page,'PrepScene','backBtn')}
 await startGame(page,{level:1,value:101,freeze:true});await page.evaluate(()=>{window.__NUMBER_SNAKE_DEBUG__.spawnBoss();const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.boss.body.body.reset(0,0);s.boss.body.body.moves=false});await expect.poll(async()=>(await sceneState(page)).state).toBe('LEVEL_CLEAR');expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getMaxHP())).toBe(6);await clickButton(page,'GameScene','replayBtn');await clickButton(page,'PrepScene','startLevelBtn');expect((await sceneState(page)).value).toBe(5);
});

test('AX,AY,AZ,BJ: live Top5, crown transfer and boss direction',async({page})=>{
 await boot(page);await startGame(page,{value:10,freeze:true});await page.evaluate(()=>{for(let i=0;i<6;i++)window.__NUMBER_SNAKE_DEBUG__.spawnEnemy(20+i,600+i*40,300)});await page.waitForTimeout(300);const r=(await sceneState(page)).ranking;expect(r.top5.length).toBe(5);expect(r.playerRank.rank).toBe(7);expect(r.leader.value).toBe(25);await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.setPlayerValue(30));await page.waitForTimeout(300);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getCrownHolderId())).toBe('player');
 await page.evaluate(()=>{window.__NUMBER_SNAKE_DEBUG__.spawnBoss();const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.boss.body.body.reset(1000,-600);s.boss.body.body.moves=false});await page.waitForTimeout(300);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getCrownHolderId())).toBe('boss');expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getBossIndicatorState().visible)).toBe(true);
});

test('BL,BM,BN,BX,BY: unconditional zh-TW default and native language reload',async({page})=>{
 await boot(page,{language:null});expect(await page.evaluate(()=>localStorage.getItem('number_snake_language_v1')||'zh-TW')).toBe('zh-TW');
 await clickButton(page,'MenuScene','langBtn_en');expect(await page.evaluate(()=>localStorage.getItem('number_snake_language_v1'))).toBe('en');await page.reload();await page.waitForFunction(()=>window.__PHASER_GAME__.scene.isActive('MenuScene'));const strings=await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('MenuScene').children.list.filter(c=>c.type==='Text').map(c=>c.text));expect(strings.join(' ')).not.toMatch(/數字|關卡|開始/);await clickButton(page,'MenuScene','langBtn_zh');expect(await page.evaluate(()=>localStorage.getItem('number_snake_language_v1'))).toBe('zh-TW');
});

test('BC: normal URL has no debug mutations; real play routing remains accessible',async({page})=>{
 await boot(page,{normal:true});await page.waitForTimeout(250);const exposed=await page.evaluate(()=>({debug:typeof window.__NUMBER_SNAKE_DEBUG__,phaser:typeof window.__PHASER_GAME__,build:window.__NUMBER_SNAKE_BUILD__}));expect(exposed.debug).toBe('undefined');expect(exposed.phaser).toBe('undefined');expect(exposed.build.version).toBe('0.7.0-candidate');
 // Matching production canvas layout, no game object access is exposed on this URL.
 const probe=await page.context().newPage();await boot(probe);const menuPoint=await buttonPoint(probe,'MenuScene','startBtn_1');await clickButton(probe,'MenuScene','startBtn_1');const prepPoint=await buttonPoint(probe,'PrepScene','startLevelBtn');await probe.close();await page.mouse.click(menuPoint.x,menuPoint.y);await page.waitForTimeout(300);await page.mouse.click(prepPoint.x,prepPoint.y);await page.waitForTimeout(300);
 // Read-only security contract is installed only after gameplay begins.
 await expect.poll(()=>page.evaluate(()=>typeof window.__E2E_READONLY__)).toBe('object');const before=await page.evaluate(()=>window.__E2E_READONLY__.getPlayerValue());for(let i=0;i<5;i++)await page.keyboard.press('c');expect(await page.evaluate(()=>window.__E2E_READONLY__.getPlayerValue())).toBe(before);
});

for(const[level,theme]of[[1,'neon-grid'],[2,'cyber-city'],[3,'lava-core'],[4,'deep-space']])test(`AT: actual layered theme ${theme}`,async({page})=>{await boot(page);await startGame(page,{level,value:50,freeze:true});await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').player.seedPathForTest([{x:0,y:0},{x:-240,y:0}]));expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getCurrentThemeKey())).toBe(theme);await capture(page,`theme-${theme}`)});
