const {test,expect}=require('playwright/test');
const fs=require('node:fs');
const {boot,startGame,sceneState,fixtureEnemy,seedPlayer,buttonPoint,clickButton,realBossContact}=require('./helpers.cjs');
const evidence=process.env.EVIDENCE_DIR;
const shot=async(page,name)=>{if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:evidence+'/'+name+'.png'})}};
let errors=[];
test.beforeEach(async({page})=>{errors=[];page.on('pageerror',e=>errors.push(e.message))});
test.afterEach(async()=>expect(errors,'no browser exceptions').toEqual([]));

test('A,B,C,F,I: live strict head comparison, damage and combo',async({page})=>{
 await boot(page);
 for(const [enemyValue,hp,state]of[[9,3,'RUNNING'],[10,2,'RUNNING'],[11,2,'RUNNING'],[15,1,'RUNNING'],[25,3,'GAME_OVER']]){
  await startGame(page,{value:10,freeze:true});const before=await sceneState(page);
  await fixtureEnemy(page,{value:enemyValue,x:0,y:0});
  await expect.poll(async()=>{const s=await sceneState(page);return enemyValue<10?s.value:s.hp<3||s.state==='GAME_OVER'}).toBe(enemyValue<10?19:true);
  const s=await sceneState(page);expect(s.hp).toBe(hp);expect(s.state).toBe(state);
  if(enemyValue>=10){expect(s.value).toBe(10);expect(s.targetLength).toBe(before.targetLength);expect(s.segments).toBe(before.segments)}
 }
 await startGame(page,{value:30,freeze:true});await fixtureEnemy(page,{value:3});await expect.poll(async()=>(await sceneState(page)).value).toBe(33);
 await fixtureEnemy(page,{value:4});await expect.poll(async()=>(await sceneState(page)).value).toBe(37);
 expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').comboCount)).toBe(2);
 await page.waitForTimeout(2700);expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').comboCount)).toBe(0);
});

test('new A, AN: shared Value length, deployed path, boost and turns',async({page})=>{
 await boot(page);
 for(const value of[5,50,100,500]){
  await startGame(page,{value,freeze:true});
  const expected=Math.min(720,Math.max(60,36+24*Math.sqrt(value)));
  await seedPlayer(page,[{x:0,y:0},{x:-800,y:0}]);
  await fixtureEnemy(page,{value,x:650,y:0,points:[{x:650,y:0},{x:650,y:700}]});await page.waitForTimeout(80);
  const lengths=await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');return{p:s.player.pathLength,e:s.enemies[0].pathLength,target:s.enemies[0].targetLength,count:s.player.bodySprites.filter(x=>x.visible).length,radius:s.enemies[0].body.body.radius}});
  expect(lengths.p).toBeCloseTo(expected,3);expect(lengths.e).toBeCloseTo(expected,3);expect(lengths.target).toBeCloseTo(expected,3);expect(lengths.count).toBeLessThanOrEqual(40);expect(lengths.radius).toBe(18);
 }
 await fixtureEnemy(page,{value:5,x:180,y:-140,points:[{x:180,y:-140},{x:60,y:-140}]});await fixtureEnemy(page,{value:50,x:450,y:-140,points:[{x:450,y:-140},{x:450,y:90}]});await page.waitForTimeout(80);await shot(page,'long-short-snakes');
 await startGame(page,{value:500});await page.keyboard.down('Space');await page.waitForTimeout(1200);await page.keyboard.down('ArrowDown');await page.waitForTimeout(1000);await page.keyboard.up('ArrowDown');await page.keyboard.up('Space');
 const continuity=await page.evaluate(()=>{const p=window.__PHASER_GAME__.scene.getScene('GameScene').player,a=[{x:p.head.x,y:p.head.y},...p.bodySprites.filter(s=>s.visible).map(s=>({x:s.x,y:s.y}))];return{gap:Math.max(...a.slice(2).map((s,i)=>Math.hypot(s.x-a[i+1].x,s.y-a[i+1].y))),length:p.pathLength,energy:p.boostEnergy}});
 expect(continuity.gap).toBeLessThanOrEqual(19);expect(continuity.length).toBeGreaterThan(450);expect(continuity.energy).toBeLessThan(100);expect((await sceneState(page)).zoom).toBe(1);
});

test('new C,D,F: player body recoil persists, has cooldown, no rewards or damage',async({page})=>{
 await boot(page);await startGame(page,{value:10});
 await page.evaluate(()=>{const p=window.__PHASER_GAME__.scene.getScene('GameScene').player;p.teleport(0,-42);p.currentAngle=Math.PI/2;p.targetAngle=Math.PI/2});
 await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');window.recoilFrames=[];s.events.on('postupdate',()=>window.recoilFrames.push({recoil:s.player.isRecoiling,vy:s.player.head.body.velocity.y,y:s.player.head.y}))});await fixtureEnemy(page,{value:50,x:200,y:0,points:[{x:200,y:0},{x:-100,y:0}]});
 const before=await sceneState(page);await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getBodyRecoilCount()),{intervals:[10,20]}).toBeGreaterThan(0);
 const hit=await sceneState(page);expect(hit.value).toBe(before.value);expect(hit.hp).toBe(before.hp);expect(hit.score).toBe(before.score);expect(hit.enemies).toBe(1);
 await page.waitForTimeout(70);const recorded=await page.evaluate(()=>window.recoilFrames);expect(recorded.filter(f=>f.recoil&&f.vy<0).length).toBeGreaterThanOrEqual(2);
 const bounced=recorded.filter(f=>f.recoil);expect(Math.min(...bounced.map(f=>f.y))).toBeLessThan(Math.max(...bounced.map(f=>f.y))-10);
 await page.waitForTimeout(170);expect((await sceneState(page)).recoil).toBe(false);
 expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').player.isInvulnerable)).toBe(false);
 await shot(page,'tail-recoil');
});

test('new C: AI head rebounds from player body; own body and bosses excluded',async({page})=>{
 await boot(page);await startGame(page,{value:100,freeze:true});await seedPlayer(page,[{x:200,y:0},{x:-400,y:0}]);
 await fixtureEnemy(page,{value:150,x:0,y:20});await expect.poll(()=>page.evaluate(()=>window.fixtureEnemy.isRecoiling),{intervals:[10,20]}).toBe(true);
 expect((await sceneState(page)).hp).toBe(3);expect(await page.evaluate(()=>window.fixtureEnemy.body.body.velocity.y)).toBeGreaterThan(0);
 await startGame(page,{value:10,freeze:true});await seedPlayer(page,[{x:0,y:0},{x:100,y:0},{x:100,y:60},{x:0,y:0}]);await page.waitForTimeout(200);expect((await sceneState(page)).recoil).toBe(false);
});

test('new D: eat head wins same-frame body overlap; dead trail removed',async({page})=>{
 await boot(page);await startGame(page,{value:10,freeze:true});
 await fixtureEnemy(page,{value:9,x:0,y:0,points:[{x:0,y:0},{x:90,y:0},{x:0,y:0},{x:0,y:120}]});
 await expect.poll(async()=>(await sceneState(page)).value).toBe(19);expect((await sceneState(page)).enemies).toBe(0);expect((await sceneState(page)).recoil).toBe(false);await page.waitForTimeout(250);expect((await sceneState(page)).recoil).toBe(false);
});

test('new E, AS: chain circles along visible trail, locked then real collection conserves rewards',async({page})=>{
 await boot(page);await startGame(page,{value:500,freeze:true});await fixtureEnemy(page,{value:100,x:0,y:0,points:[{x:0,y:0},{x:-290,y:0}]});
 await expect.poll(async()=>(await sceneState(page)).enemies).toBe(0);
 const initial=await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');const initial={value:s.player.value,score:s.hud.getScore(),orbs:s.orbs.map(o=>({x:o.sprite.x,y:o.sprite.y,score:o.reward.score,energy:o.reward.energy,can:o.canCollect}))};s.player.teleport(400,0);return initial});
 expect(initial.value).toBe(600);expect(initial.orbs.length).toBeGreaterThan(10);expect(initial.orbs.filter(o=>o.x<-100).length).toBeGreaterThan(4);expect(initial.orbs.every(o=>!o.can)).toBe(true);
 await shot(page,'eat-head-chain');await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').player.teleport(400,0));await page.waitForTimeout(500);
 const rewards=await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.player.boostEnergy=0;return s.orbs.map(o=>({x:o.sprite.x,y:o.sprite.y,score:o.reward.score,energy:o.reward.energy}))});
 expect(rewards.reduce((sum,o)=>sum+o.score,0)).toBe(50);expect(rewards.reduce((sum,o)=>sum+o.energy,0)).toBe(10);
 // Position setup only; every collection below is detected by the ordinary update loop.
 for(const o of rewards){await page.evaluate(({x,y})=>window.__PHASER_GAME__.scene.getScene('GameScene').player.teleport(x,y),o);await page.waitForTimeout(20)}
 await expect.poll(async()=>(await sceneState(page)).orbs).toBe(0);const after=await sceneState(page);expect(after.value).toBe(600);expect(after.score-initial.score).toBe(50);expect(after.energy).toBeGreaterThanOrEqual(10);expect(after.energy).toBeLessThanOrEqual(100);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getOrbRewardTotals().energy)).toBe(10);
});

test('AP,AQ,AR,new F: magnet eligibility, time, real enemy/orb attraction and recoil block',async({page})=>{
 await boot(page);await startGame(page,{value:10,freeze:true});
 for(const[value,x,y]of[[9,-150,0],[10,150,0],[11,0,150]])await fixtureEnemy(page,{value,x,y});
 await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');for(const e of s.enemies)e.body.body.moves=true;window.__NUMBER_SNAKE_DEBUG__.spawnBoss();s.boss.body.body.reset(0,-150);s.boss.body.body.moves=false});
 await page.keyboard.press('m');await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getMagnetState())).toBe('ACTIVE');
 const velocities=await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');return s.enemies.map(e=>({value:e.value,velocity:{x:e.body.body.velocity.x,y:e.body.body.velocity.y}}))});
 expect(velocities.find(e=>e.value===9).velocity.x).toBeGreaterThan(200);expect(velocities.find(e=>e.value===10).velocity.x).toBeGreaterThan(-200);expect(velocities.find(e=>e.value===11).velocity.y).toBeGreaterThan(-200);
 await expect.poll(async()=>(await sceneState(page)).value).toBeGreaterThanOrEqual(19);
 await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getMagnetState()),{timeout:13000}).toBe('COOLDOWN');
 await startGame(page,{value:100,freeze:true});await fixtureEnemy(page,{value:50,x:160,y:0,points:[{x:160,y:0},{x:0,y:0},{x:-200,y:0}]});await page.keyboard.press('m');
 await expect.poll(async()=>(await sceneState(page)).recoil,{intervals:[10,20]}).toBe(true);
 expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').magnet.isEnemySuppressed(window.fixtureEnemy.arenaId))).toBe(true);
});

for(const[level,boss,trigger]of[[1,100,70],[2,200,150],[3,300,230],[4,400,310]]){
 test(`D,E,O,U,AH,AK,BG: level ${level} boss live threshold, boundary and strict eat`,async({page})=>{
  await boot(page);await startGame(page,{level,value:trigger-1,freeze:true});await page.waitForTimeout(80);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getBossSpawned?.()??window.__PHASER_GAME__.scene.getScene('GameScene').bossSpawned)).toBe(false);
  await page.evaluate(trigger=>window.__NUMBER_SNAKE_DEBUG__.setPlayerValue(trigger),trigger);await expect.poll(()=>page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').boss?.value)).toBe(boss);
  await page.evaluate(boss=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.player.value=boss;s.boss.body.body.reset(500,0);s.boss.body.body.moves=false;},boss);await page.waitForTimeout(80);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getBossState())).toBe('CHASE');
  await page.evaluate(boss=>window.__NUMBER_SNAKE_DEBUG__.setPlayerValue(boss+1),boss);await page.waitForTimeout(80);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getBossState())).toBe('FLEE');
  for(const[x,y]of[[-2000,-2000],[2000,2000],[-2000,2000],[2000,-2000]]){await page.evaluate(({x,y})=>window.__PHASER_GAME__.scene.getScene('GameScene').boss.body.body.reset(x,y),{x,y});await page.waitForTimeout(50);const p=await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getBossPosition());expect(Math.abs(p.x)).toBeLessThanOrEqual(1100);expect(Math.abs(p.y)).toBeLessThanOrEqual(700)}
  await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.boss.body.body.reset(0,0)});
  await expect.poll(async()=>(await sceneState(page)).state).toBe(level===4?'LUCKY_WHEEL':'LEVEL_CLEAR');
 });
}

for(const[id,bonus]of[['A',100],['B',150],['C',75],['D',75],['E',75],['F',200]]){
 test(`BO,BP,BQ,BR,BW,BZ,new H: reward ${id}, one real spin/confirm and live ultimate finish`,async({page})=>{
  await boot(page);await startGame(page,{level:4,value:401,freeze:true});
  await page.evaluate(id=>{window.__NUMBER_SNAKE_DEBUG__.setForcedWheelRewardForTest(id);window.__NUMBER_SNAKE_DEBUG__.spawnBoss();const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.boss.body.body.reset(0,0);s.boss.body.body.moves=false},id);
  await expect.poll(async()=>(await sceneState(page)).state).toBe('LUCKY_WHEEL');expect((await sceneState(page)).score).toBe(1000);
  await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.player.hp=2;s.player.boostEnergy=37;s.magnet.state='COOLDOWN';s.magnet.timer=12345});
  await clickButton(page,'GameScene','luckyWheelOverlay.spinBtn');await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getLuckyWheelOverlay().hasSpun)).toBe(true);
  await clickButton(page,'GameScene','luckyWheelOverlay.confirmBtn');await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.isUltimatePhaseActive())).toBe(true);
  const snapshot=await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').__wheelTestSnapshot);
  expect(snapshot.value).toBe(401+bonus);expect(snapshot.segments).toBe(Math.ceil(Math.min(720,36+24*Math.sqrt(401+bonus))/18));
  expect(await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').player.targetLength)).toBeGreaterThan(36+24*Math.sqrt(401));
  expect(snapshot.hp).toBe(['C','F'].includes(id)?snapshot.maxHp:2);expect(snapshot.boostEnergy).toBe(['D','F'].includes(id)?100:37);expect(snapshot.magnetState).toBe(id==='E'?'READY':'COOLDOWN');
  await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.player.value=501;s.player.teleport(0,0);s.player.head.body.moves=false;s.ultimateBoss.body.body.reset(0,0);s.ultimateBoss.body.body.moves=false});
  await expect.poll(async()=>(await sceneState(page)).state).toBe('LEVEL_CLEAR');expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getUltimateBoss())).toBe(null);expect((await sceneState(page)).score).toBe(4000);
  await clickButton(page,'GameScene','playAgainBtn');await expect.poll(()=>page.evaluate(()=>window.__PHASER_GAME__.scene.isActive('PrepScene'))).toBe(true);
 });
}

test('BP: deliberate double spin and double confirm do not give duplicate reward',async({page})=>{
 await boot(page);await startGame(page,{level:4,value:401,freeze:true});await page.evaluate(()=>{window.__NUMBER_SNAKE_DEBUG__.setForcedWheelRewardForTest('F');window.__NUMBER_SNAKE_DEBUG__.spawnBoss();const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.boss.body.body.reset(0,0);s.boss.body.body.moves=false});
 await expect.poll(async()=>(await sceneState(page)).state).toBe('LUCKY_WHEEL');await clickButton(page,'GameScene','luckyWheelOverlay.spinBtn',{double:true});await clickButton(page,'GameScene','luckyWheelOverlay.confirmBtn',{double:true});await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.isUltimatePhaseActive())).toBe(true);expect((await sceneState(page)).value).toBe(601);await page.waitForTimeout(200);expect((await sceneState(page)).value).toBe(601);
});

test('BS,BT: ultimate attacks, reversal and playable catch preserve original rules',async({page})=>{
 await boot(page);await startGame(page,{level:4,value:500,freeze:true});await page.evaluate(()=>{const b=window.__NUMBER_SNAKE_DEBUG__.spawnUltimateBossForTest();b.body.body.moves=false});await page.waitForTimeout(100);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getBossState())).toBe('CHASE');
 const states=new Set();for(let i=0;i<24;i++){await page.waitForTimeout(200);states.add(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getUltimateBoss()?.state));}expect(states.size).toBeGreaterThan(1);
 await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.player.value=501;s.ultimateBoss.body.body.reset(300,0);s.player.head.body.moves=true;s.player.currentAngle=0;s.player.targetAngle=0});
 await page.keyboard.down('Space');await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getBossState())).toBe('FLEE');await page.waitForTimeout(800);await page.keyboard.up('Space');expect((await sceneState(page)).x).toBeGreaterThan(100);
});
