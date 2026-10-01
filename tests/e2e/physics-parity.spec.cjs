const {test,expect}=require('playwright/test');
const {boot,startGame,fixtureEnemy,sceneState,clickButton}=require('./helpers.cjs');

test('visual modes share orb collection and magnet positions at boundary distances',async({page})=>{
 await boot(page);
 for(const reducedMotion of[false,true]){
  await page.evaluate(reducedMotion=>localStorage.setItem('number_snake_visual_preferences_v1',JSON.stringify({version:1,reducedMotion,lowEffects:reducedMotion})),reducedMotion);
  await startGame(page,{value:10,freeze:true});
  await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.spawnOrb(0,31.5);s.spawnOrb(0,32.5);s.spawnOrb(0,259);s.spawnOrb(0,261);});
  await page.waitForTimeout(150);expect((await sceneState(page)).orbs).toBe(3);
  const before=await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getOrbs().map(o=>o.getCollectionPosition().y));expect(before).toEqual([32.5,259,261]);
  await page.keyboard.press('m');await page.waitForTimeout(120);
  const remaining=await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getOrbs().map(o=>o.getCollectionPosition().y));expect(remaining.length).toBe(2);expect(remaining[0]).toBeLessThan(259);expect(remaining[1]).toBe(261);
 }
});

test('all six AI heads and recoil effects keep their physical radii in every visual mode',async({page})=>{
 await boot(page);
 for(const lowEffects of[false,true]){
  await page.evaluate(lowEffects=>localStorage.setItem('number_snake_visual_preferences_v1',JSON.stringify({version:1,lowEffects,reducedMotion:lowEffects})),lowEffects);
  await startGame(page,{value:10,freeze:true});
  for(const[skin,index]of['classic','bolt','mecha','dragon','flame','alien'].map((s,i)=>[s,i]))await fixtureEnemy(page,{value:100,x:600,y:-400+index*120,skin});
  const radii=await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');return{player:s.player.head.body.radius,enemies:s.enemies.map(e=>({radius:e.body.body.radius,scale:e.body.scaleX,skin:e.headSkinId}))}});expect(radii.player).toBe(20);expect(radii.enemies.map(e=>e.radius)).toEqual([18,18,18,18,18,18]);expect(radii.enemies.every(e=>e.scale===1)).toBe(true);
  await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.hardReset();s.player.teleport(0,20)});await fixtureEnemy(page,{value:50,x:200,y:0,points:[{x:200,y:0},{x:-100,y:0}]});await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getBodyRecoilCount())).toBeGreaterThan(0);expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').player.head.body.radius)).toBe(20);expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').player.head.scaleX)).toBe(1);
 }
});

test('an invulnerable head contact still allows a different living body to recoil',async({page})=>{
 await boot(page);await startGame(page,{value:10,freeze:true});
 await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.player.isInvulnerable=true});
 await fixtureEnemy(page,{value:10,x:0,y:0});await fixtureEnemy(page,{value:50,x:200,y:20,points:[{x:200,y:20},{x:-100,y:20}]});
 await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getBodyRecoilCount())).toBeGreaterThan(0);expect((await sceneState(page)).hp).toBe(3);expect((await sceneState(page)).enemies).toBe(2);
});

test('specified opponent skin applies to newly spawned ultimate arena ordinary AI',async({page})=>{
 await boot(page);await page.evaluate(()=>localStorage.setItem('number_snake_visual_preferences_v1',JSON.stringify({version:1,opponentStyleMode:'specified',opponentHeadSkin:'alien'})));await startGame(page,{level:4,value:499,freeze:true});
 await page.evaluate(()=>{window.__NUMBER_SNAKE_DEBUG__.spawnUltimateBossForTest();const s=window.__PHASER_GAME__.scene.getScene('GameScene');for(let i=0;i<6;i++)s.spawnFinalEcosystemEnemy()});
 const skins=await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').enemies.map(e=>e.headSkinId));expect(skins).toHaveLength(6);expect(skins.every(id=>id==='alien')).toBe(true);
});

test('same frame eat removes only the dead trail and preserves another living tail recoil',async({page})=>{
 await boot(page);await startGame(page,{value:10,freeze:true});await fixtureEnemy(page,{value:50,x:200,y:20,points:[{x:200,y:20},{x:-100,y:20}]});await fixtureEnemy(page,{value:9,x:0,y:0});
 await expect.poll(async()=>(await sceneState(page)).value).toBe(19);expect((await sceneState(page)).enemies).toBe(1);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getOrbRewardTotals().snakes)).toBe(1);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getBodyRecoilCount())).toBeGreaterThan(0);
});

test('B,F: AI strict chase/flee and the 65px 110degree head assist remain usable',async({page})=>{
 await boot(page);
 for(const[value,flee]of[[9,true],[10,false],[11,false]]){await startGame(page,{value:10,freeze:true});await fixtureEnemy(page,{value,x:150,y:0});await page.waitForTimeout(80);expect(await page.evaluate(()=>window.fixtureEnemy.state===1)).toBe(flee)}
 for(const[distance,degrees,enemy,edible]of[[64,0,3,true],[66,0,3,false],[64,60,3,false],[64,0,10,false],[64,0,11,false]]){
  await startGame(page,{value:10,freeze:true});const a=degrees*Math.PI/180;await fixtureEnemy(page,{value:enemy,x:distance*Math.cos(a),y:distance*Math.sin(a)});await page.waitForTimeout(100);expect((await sceneState(page)).value).toBe(edible?13:10);
 }
});

test('AP,AQ: outside enemies/boss resist magnet; active and cooldown M cannot restart timers',async({page})=>{
 test.setTimeout(75000);await boot(page);await startGame(page,{value:10,freeze:true});await fixtureEnemy(page,{value:3,x:340,y:0});
 await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');window.__NUMBER_SNAKE_DEBUG__.spawnBoss();s.boss.body.body.reset(-180,0);s.boss.body.body.moves=false});
 await page.waitForTimeout(100);const before=await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');return{enemy:s.enemies[0].body.body.velocity.x,boss:s.boss.body.body.velocity.x}});await page.keyboard.press('m');await page.waitForTimeout(120);
 const active=await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');return{enemy:s.enemies[0].body.body.velocity.x,boss:s.boss.body.body.velocity.x,timer:s.magnet.timer}});expect(active.enemy).toBe(before.enemy);expect(active.boss).toBe(before.boss);await page.keyboard.press('m');expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').magnet.timer)).toBeLessThanOrEqual(active.timer);
 await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getMagnetState()),{timeout:16000}).toBe('COOLDOWN');const cooldown=await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').magnet.timer);await page.keyboard.press('m');expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getMagnetState())).toBe('COOLDOWN');expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').magnet.timer)).toBeLessThanOrEqual(cooldown);await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getMagnetState()),{timeout:35000}).toBe('READY');
});

test('denied legacy score storage still allows real KO and the one-click end screen',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);await startGame(page,{value:10,freeze:true});await fixtureEnemy(page,{value:3});await expect.poll(async()=>(await sceneState(page)).value).toBe(13);await page.evaluate(()=>{window.deniedGet=Storage.prototype.getItem;window.deniedSet=Storage.prototype.setItem;Storage.prototype.getItem=()=>{throw new DOMException('Denied','SecurityError')};Storage.prototype.setItem=()=>{throw new DOMException('Denied','SecurityError')};window.__PHASER_GAME__.scene.getScene('GameScene').player.teleport(300,0)});await fixtureEnemy(page,{value:40,x:300,y:0});await expect.poll(async()=>(await sceneState(page)).state).toBe('GAME_OVER');await clickButton(page,'GameScene','playAgainBtn');await expect.poll(()=>page.evaluate(()=>window.__PHASER_GAME__.scene.isActive('PrepScene'))).toBe(true);await page.evaluate(()=>{Storage.prototype.getItem=window.deniedGet;Storage.prototype.setItem=window.deniedSet});expect(errors).toEqual([]);
});
