const {test,expect}=require('playwright/test');
const fs=require('node:fs'),os=require('node:os');
const {boot,startGame,sceneState,fixtureEnemy}=require('./helpers.cjs');
test('Z,AA: population cap, safe boundary and a fresh ordinary AI native boost catch',async({page},info)=>{
 await boot(page);await startGame(page,{value:50,freeze:true});await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');for(let i=0;i<80;i++)s.spawnEnemy();});expect((await sceneState(page)).enemies).toBeLessThanOrEqual(38);
 const pos=await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getEnemies().map(e=>({x:e.body.x,y:e.body.y})));for(const e of pos){expect(Math.abs(e.x)).toBeLessThanOrEqual(1160);expect(Math.abs(e.y)).toBeLessThanOrEqual(760)}
 // A new prey starts outside head/assist contact, inside FLEE range, with no
 // already deployed tail shielding its head. Catching a mature tail directly
 // from behind is no longer guaranteed by the v0.7.0 body-recoil rules.
 await startGame(page,{value:50,freeze:true});
 await fixtureEnemy(page,{value:25,x:105,y:0});
 await page.evaluate(()=>{
  const s=window.__PHASER_GAME__.scene.getScene('GameScene'),prey=window.fixtureEnemy;
  window.ordinaryCatchSamples=[];
  window.ordinaryCatchObserver=()=>{
   if(!s.enemies.includes(prey))return;
   window.ordinaryCatchSamples.push({px:s.player.head.x,py:s.player.head.y,x:prey.body.x,y:prey.body.y,state:prey.state,speed:prey.body.body.velocity.length(),distance:Math.hypot(prey.body.x-s.player.head.x,prey.body.y-s.player.head.y)});
  };
  s.events.on('postupdate',window.ordinaryCatchObserver);
 });
 try{
  await page.keyboard.down('ArrowRight');await page.keyboard.down('Space');
  await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.player.head.body.moves=true;window.fixtureEnemy.body.body.moves=true});
  await expect.poll(async()=>(await sceneState(page)).value,{timeout:5000,intervals:[50]}).toBe(75);
 }finally{
  await page.keyboard.up('Space');await page.keyboard.up('ArrowRight');
  await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').events.off('postupdate',window.ordinaryCatchObserver));
 }
 const chase=await page.evaluate(()=>window.ordinaryCatchSamples);
 await info.attach('ordinary-live-chase',{body:JSON.stringify(chase,null,2),contentType:'application/json'});
 expect(chase.length).toBeGreaterThanOrEqual(12);
 expect(chase.every(sample=>sample.state===1&&Math.abs(sample.speed-165)<.01)).toBe(true);
 expect(chase[0].distance).toBeGreaterThan(65);
 expect(chase.at(-1).x-chase[0].x).toBeGreaterThan(20);
 expect(chase.at(-1).px-chase[0].px).toBeGreaterThan(40);
 expect(chase.at(-1).distance).toBeLessThan(chase[0].distance-30);
 expect((await sceneState(page)).enemies).toBe(0);
});
test('AS: circle cap160 oldest removal, expiry and clean scene never award drops',async({page})=>{
 await boot(page);await startGame(page,{value:10,freeze:true});await page.evaluate(()=>{for(let i=0;i<170;i++)window.__NUMBER_SNAKE_DEBUG__.spawnOrbForTest(400+i,400)});expect((await sceneState(page)).orbs).toBe(160);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getOrbPoolSize())).toBe(160);
 const xs=await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getOrbs().map(o=>o.sprite.x));expect(Math.min(...xs)).toBe(410);const score=(await sceneState(page)).score;
 await page.evaluate(()=>{for(const orb of window.__NUMBER_SNAKE_DEBUG__.getOrbs())orb.createdAt-=11001});await expect.poll(async()=>(await sceneState(page)).orbs).toBe(0);expect((await sceneState(page)).score).toBe(score);
 await startGame(page,{value:10,clean:false,freeze:true});await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.hardReset());expect((await sceneState(page)).orbs).toBe(0);
});

test('BH: ordinary boss stays moving, edible and inside bounds through 60 pressured live FLEE frames',async({page},info)=>{
 await boot(page);await startGame(page,{value:101,freeze:true});
 await page.evaluate(()=>{
  const s=window.__PHASER_GAME__.scene.getScene('GameScene');
  window.__NUMBER_SNAKE_DEBUG__.spawnBoss();
  s.boss.body.body.reset(940,0);
  s.player.teleport(820,0);
  window.bossFleeSamples=[];
  // Pressure fixture only: every frame the player remains 120px behind the
  // boss's actual motion. The normal update supplies all boss motion/state.
  window.bossFleeObserver=()=>{
   const boss=s.boss;if(!boss)return;
   const velocity=boss.body.body.velocity,speed=Math.hypot(velocity.x,velocity.y);
   window.bossFleeSamples.push({frame:s.game.loop.frame,x:boss.body.x,y:boss.body.y,speed,isFleeing:boss.isFleeing,edible:s.player.value>boss.value});
   const dx=speed>0?velocity.x/speed:1,dy=speed>0?velocity.y/speed:0;
   s.player.teleport(boss.body.x-dx*120,boss.body.y-dy*120);
  };
  s.events.on('postupdate',window.bossFleeObserver);
 });
 try{
  await expect.poll(()=>page.evaluate(()=>window.bossFleeSamples.length),{timeout:10000,intervals:[50]}).toBeGreaterThanOrEqual(60);
 }finally{
  await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').events.off('postupdate',window.bossFleeObserver));
 }
 const frames=await page.evaluate(()=>window.bossFleeSamples);
 await info.attach('boss-live-flee-pressure',{body:JSON.stringify(frames,null,2),contentType:'application/json'});
 expect(frames.length).toBeGreaterThanOrEqual(60);
 expect(new Set(frames.map(sample=>sample.frame)).size).toBe(frames.length);
 expect(frames.every(sample=>Math.abs(sample.x)<=1100&&Math.abs(sample.y)<=700&&sample.speed>50&&sample.isFleeing&&sample.edible)).toBe(true);
 expect(Math.max(...frames.map(sample=>Math.hypot(sample.x-frames[0].x,sample.y-frames[0].y)))).toBeGreaterThan(50);
 expect((await sceneState(page)).state).toBe('RUNNING');
});
test('C: swept high-speed body contact does not tunnel',async({page})=>{
 await boot(page);await startGame(page,{value:10});await page.evaluate(()=>{const p=window.__PHASER_GAME__.scene.getScene('GameScene').player;p.teleport(0,-60);p.currentAngle=Math.PI/2;p.targetAngle=Math.PI/2});await fixtureEnemy(page,{value:50,x:200,y:0,points:[{x:200,y:0},{x:-100,y:0}]});await page.keyboard.down('Space');await expect.poll(()=>page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getBodyRecoilCount()),{intervals:[10,20]}).toBeGreaterThan(0);await page.keyboard.up('Space');expect((await sceneState(page)).y).toBeLessThan(25);expect((await sceneState(page)).hp).toBe(3);
});

test('full load: 38 long AI + long player +160 circles + magnet + boss for five minutes',async({page},info)=>{
 test.skip(process.env.PERF_TEST!=='1','Explicit five-minute machine performance run');test.setTimeout(360000);
 await boot(page);await startGame(page,{level:4,value:499});
 await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.player.isInvulnerable=true;s.player.seedPathForTest([{x:0,y:0},{x:-600,y:0}]);for(let i=0;i<38;i++){const x=-950+(i%10)*190,y=-570+Math.floor(i/10)*330,e=window.__NUMBER_SNAKE_DEBUG__.spawnEnemy(500,x,y);e.seedPathForTest([{x,y},{x:x>0?x-550:x+550,y}]);}window.__NUMBER_SNAKE_DEBUG__.spawnUltimateBossForTest();window.perfStart=performance.now();window.perfFrames=[];window.perfLast=performance.now();window.perfTick=()=>{const now=performance.now();window.perfFrames.push(now-window.perfLast);window.perfLast=now};s.events.on('postupdate',window.perfTick);});
 const samples=[];for(let i=0;i<300;i++){
  await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');while(s.orbs.length<160)window.__NUMBER_SNAKE_DEBUG__.spawnOrbForTest(220+(s.orbs.length%10)*30,Math.floor(s.orbs.length/10)*25-250);if(s.magnet.state==='READY')s.magnet.activate();});
  await page.waitForTimeout(1000);if(i%10===0)samples.push(await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');return{elapsed:performance.now()-window.perfStart,enemies:s.enemies.length,orbs:s.orbs.length,pool:window.__NUMBER_SNAKE_DEBUG__.getOrbPoolSize(),children:s.children.length,checks:window.__NUMBER_SNAKE_DEBUG__.getBodyCandidateChecks(),fps:s.game.loop.actualFps,boss:!!s.ultimateBoss,state:s.gameState}}));
 }
 const frames=await page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.events.off('postupdate',window.perfTick);return window.perfFrames});frames.sort((a,b)=>a-b);
 const elapsedMs=await page.evaluate(()=>performance.now()-window.perfStart);
 const report={status:'MEASURED',machine:{platform:os.platform(),arch:os.arch(),cpus:os.cpus()[0]?.model,browser:await page.context().browser().version(),viewport:page.viewportSize(),headless:true,realMobile:false},elapsedMs,frameTimeMs:{p50:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)],max:frames.at(-1)},samples};
 const output=process.env.EVIDENCE_DIR||info.outputDir;fs.mkdirSync(output,{recursive:true});fs.writeFileSync(output+'/performance.json',JSON.stringify(report,null,2));await info.attach('performance',{body:JSON.stringify(report,null,2),contentType:'application/json'});
 expect(elapsedMs).toBeGreaterThanOrEqual(300000);expect(samples.every(s=>s.enemies===38&&s.boss&&s.state==='RUNNING'&&s.pool<=160)).toBe(true);expect(Math.max(...samples.map(s=>s.children))-Math.min(...samples.map(s=>s.children))).toBeLessThan(60);
 await startGame(page,{freeze:true});expect((await sceneState(page)).enemies).toBe(0);expect((await sceneState(page)).orbs).toBe(0);
});
