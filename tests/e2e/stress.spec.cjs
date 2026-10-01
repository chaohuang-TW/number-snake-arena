const {test,expect}=require('playwright/test');
const fs=require('node:fs'),os=require('node:os');
const {performance}=require('node:perf_hooks');
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
 const durationMs=300000,startedAt=performance.now();
 const output=process.env.EVIDENCE_DIR||info.outputDir;
 fs.mkdirSync(output,{recursive:true});
 const runtimeErrors=[];
 page.on('pageerror',error=>runtimeErrors.push({name:error.name,message:error.message,stack:error.stack}));
 const hardwareGPURequested=process.env.PERF_HARDWARE_GPU==='1';
 const machine={platform:os.platform(),arch:os.arch(),cpus:os.cpus()[0]?.model,browser:page.context().browser().version(),viewport:page.viewportSize(),headless:true,realMobile:false,
  launchProfile:{hardwareGPURequested,channel:hardwareGPURequested?'chromium':null,requestedHeadless:true,description:hardwareGPURequested?'Full Chromium new headless':'Playwright default headless browser'},
  hostLoad:{capturedAt:new Date().toISOString(),loadAverage:os.loadavg(),cpuCount:os.cpus().length,note:'Shared host: other user applications remain running; this measurement does not establish an idle-machine benchmark'}};
 let latest=null,phase='setup',complete=false,failure=null,captureError=null,hostStart=null,hostStartedAt=null,hostElapsedMs=0,observerInstalled=false,observerStopped=false;
 const readMetrics=async stop=>{
  const metrics=await page.evaluate(stop=>{
   const data=window.perfData;if(!data)return null;
   if(stop)window.__PHASER_GAME__.scene.getScene('GameScene').events.off('postupdate',window.perfTick);
   const now=performance.now();
   return{...data,elapsedMs:now-data.start,endedAtPerformanceMs:now,sceneTimeMs:window.__PHASER_GAME__.scene.getScene('GameScene').time.now};
  },stop);
  if(stop)observerStopped=true;
  if(metrics)latest=metrics;
  if(hostStart!==null)hostElapsedMs=performance.now()-hostStart;
 };
 const makeReport=()=>{
  const samples=latest?.samples??[],rawFrames=latest?.frames??[],frames=[...rawFrames].sort((a,b)=>a-b);
  const maxAbs=values=>values.length?Math.max(...values):null;
  return{status:complete?'MEASURED':'PARTIAL',complete,phase,failure,captureError,machine,build:latest?.build??null,elapsedMs:latest?.elapsedMs??0,hostElapsedMs,runtimeErrors,
   clock:{targetDurationMs:durationMs,hostStartedAt,hostElapsedMs,testElapsedMs:performance.now()-startedAt,browserTimeOriginMs:latest?.timeOrigin??null,browserStartedAtPerformanceMs:latest?.start??null,browserEndedAtPerformanceMs:latest?.endedAtPerformanceMs??null,sceneTimeMs:latest?.sceneTimeMs??null},
   capture:{trace:'off',video:'off',failureScreenshot:'only-on-failure',checkpointEveryMs:30000},
   maintenance:latest?.maintenance??null,
   frameTimeMs:{sampleCount:frames.length,p50:frames[Math.floor(frames.length*.5)]??null,p95:frames[Math.floor(frames.length*.95)]??null,p99:frames[Math.floor(frames.length*.99)]??null,max:frames.at(-1)??null},frameIntervalsMs:rawFrames,
   fps:{observedFrames:rawFrames.length,fromObservedIntervals:rawFrames.length?rawFrames.length*1000/rawFrames.reduce((sum,frame)=>sum+frame,0):null,phaserSamples:samples.map(s=>({elapsedMs:s.elapsed,fps:s.fps}))},
   collisionWork:{maxCandidateChecks:latest?.candidateCheckMax??0,measurement:'Maximum actual swept-capsule candidate checks from every postupdate frame; AI-to-AI pairs are excluded'},
   frameBounds:latest?.frameBounds??null,
   objectStability:{caps:latest?.decorCaps??null,measurement:'Subtract tracked particle and recoil-echo sets, the single owned magnet graphic, and non-HUD depth-200 temporary alert texts; all five identity-tracked HUD Texts, circle pool and snake sprite capacities remain part of the stable base',stableChildren:samples.map(s=>({elapsedMs:s.elapsed,count:s.stableChildren})),childSpread:samples.length?Math.max(...samples.map(s=>s.children))-Math.min(...samples.map(s=>s.children)):null},
   boundsSummary:{measurement:'Ten-second diagnostic head snapshots; continuous bounds acceptance is recorded separately in frameBounds',playerOutOfWorldSamples:samples.filter(s=>s.bounds.playerOutOfWorld).length,enemyOutOfWorldSamples:samples.filter(s=>s.bounds.enemyOutOfWorldIds.length>0).length,ultimateBossOutOfWorldSamples:samples.filter(s=>s.bounds.ultimateBossOutOfWorld).length,playerMaxAbsX:maxAbs(samples.map(s=>Math.abs(s.player.x))),playerMaxAbsY:maxAbs(samples.map(s=>Math.abs(s.player.y))),enemyMaxAbsX:maxAbs(samples.map(s=>Math.max(Math.abs(s.bounds.enemyX.min),Math.abs(s.bounds.enemyX.max)))),enemyMaxAbsY:maxAbs(samples.map(s=>Math.max(Math.abs(s.bounds.enemyY.min),Math.abs(s.bounds.enemyY.max))))},samples};
 };
 const saveReport=()=>fs.writeFileSync(output+'/performance.json',JSON.stringify(makeReport(),null,2));
 try{
  await boot(page);await startGame(page,{level:4,value:499});
  machine.gameRenderer=await page.evaluate(()=>{
   const renderer=window.__PHASER_GAME__.renderer,gl=renderer.gl,extension=gl?.getExtension('WEBGL_debug_renderer_info');
   return{type:renderer.type,webgl:gl?{vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),unmaskedVendor:extension?gl.getParameter(extension.UNMASKED_VENDOR_WEBGL):null,unmaskedRenderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):null,version:gl.getParameter(gl.VERSION),contextLost:gl.isContextLost()}:null};
  });
  let gpuSession;
  try{
   gpuSession=await page.context().browser().newBrowserCDPSession();
   const info=await gpuSession.send('SystemInfo.getInfo'),attributes=info.gpu.auxAttributes;
   machine.gpu={devices:info.gpu.devices,modelName:info.modelName,modelVersion:info.modelVersion,featureStatus:info.gpu.featureStatus,
    attributes:{glImplementationParts:attributes.glImplementationParts,glRenderer:attributes.glRenderer,glVendor:attributes.glVendor,displayType:attributes.displayType,processCrashCount:attributes.processCrashCount}};
   machine.launchProfile.actualHeadless=/--headless(?:[=\s]|$)/.test(info.commandLine);
   machine.headless=machine.launchProfile.actualHeadless;
  }catch(error){machine.gpuCaptureError={name:error.name,message:error.message};}
  finally{if(gpuSession)await gpuSession.detach();}
  if(hardwareGPURequested){
   const softwareRenderer=/swiftshader|software|llvmpipe|softpipe|lavapipe|basic render|\bwarp\b/i;
   const actualRenderer=machine.gameRenderer.webgl?.unmaskedRenderer;
   expect(machine.gpuCaptureError??null,'Hardware mode must preserve actual CDP GPU evidence').toBe(null);
   expect(typeof actualRenderer==='string'&&actualRenderer.length>0,'Hardware mode requires the game context\'s unmasked renderer').toBe(true);
   expect(softwareRenderer.test(actualRenderer),'Hardware-requested mode must not silently measure a software fallback').toBe(false);
   expect(machine.gpu.featureStatus.webgl,'CDP must report enabled hardware WebGL').toBe('enabled');
   expect(softwareRenderer.test(machine.gpu.attributes.glRenderer),'The active CDP renderer must also be hardware').toBe(false);
   expect(machine.gameRenderer.webgl.contextLost).toBe(false);expect(machine.headless).toBe(true);
   // Metal is one supported backend; the physical device name is recorded,
   // rather than hardcoding this host's Apple M5 into a portable test.
   if(/angle=metal/.test(machine.gpu.attributes.glImplementationParts))expect(/metal/i.test(actualRenderer)).toBe(true);
  }
  await page.evaluate(()=>{
   const s=window.__PHASER_GAME__.scene.getScene('GameScene');
   s.player.isInvulnerable=true;s.player.seedPathForTest([{x:0,y:0},{x:-600,y:0}]);
   for(let i=0;i<38;i++){const x=-950+(i%10)*190,y=-570+Math.floor(i/10)*330,e=window.__NUMBER_SNAKE_DEBUG__.spawnEnemy(500,x,y);e.seedPathForTest([{x,y},{x:x>0?x-550:x+550,y}]);}
   window.__NUMBER_SNAKE_DEBUG__.spawnUltimateBossForTest();
   const now=performance.now();
   let preference={};try{preference=JSON.parse(localStorage.getItem('number_snake_visual_preferences_v1')||'{}')||{};}catch{}
   // Caps come from GameScene.createParticles/resolveBodyContacts and the
   // one Graphics allocated by MagnetAbility's constructor.
   const decorCaps={particles:preference.lowEffects===true||preference.reducedMotion===true?32:96,recoilEchoes:preference.reducedMotion===true?0:preference.lowEffects===true?8:24,magnetGraphics:1};
   const actorBounds=(halfWidth,halfHeight,radius)=>({halfWidth,halfHeight,radius,checked:0,outOfBounds:0,nonFinite:0,maxAbsX:0,maxAbsY:0,firstViolation:null});
   const data=window.perfData={start:now,timeOrigin:performance.timeOrigin,build:window.__NUMBER_SNAKE_BUILD__,frames:[],samples:[],candidateCheckMax:0,decorCaps,
    frameBounds:{measurement:'Actual rendered head centers on every postupdate frame; player/AI world edges include collider radius, UltimateBoss keeps its existing 100px safe margin',framesChecked:0,missingUltimateBossFrames:0,player:actorBounds(1180,780,20),enemies:actorBounds(1182,782,18),ultimateBoss:actorBounds(1100,700,55)},
    maintenance:{everyMs:1000,sampleEveryMs:10000,refillTicks:0,circlesSpawned:0,magnetActivations:0,lastMaintenanceElapsedMs:0}};
   let last=now,nextRefill=now,nextSample=now+10000;
   const permanentHudTexts=new Set([s.hud.hpText,s.hud.valueText,s.hud.scoreText,s.hud.bestScoreText,s.hud.magnetText]);
   const sample=sampleTime=>{
    const range=values=>({min:Math.min(...values),max:Math.max(...values)});
    const p=s.player,enemyHeads=s.enemies.map(e=>({id:e.arenaId,x:e.body.x,y:e.body.y}));
    const boss=s.ultimateBoss?{x:s.ultimateBoss.body.x,y:s.ultimateBoss.body.y}:null;
    const outOfWorld=head=>!Number.isFinite(head.x)||!Number.isFinite(head.y)||Math.abs(head.x)>1200||Math.abs(head.y)>800;
    const children=s.children.list,activeOrbs=s.orbs,freeOrbs=s.freeOrbs,allOrbs=[...activeOrbs,...freeOrbs];
    // HUD's five permanent Text objects also use depth 200. Keep them in the
    // fixed base; exclude only non-HUD alert Texts from that base.
    const decor={particles:s.particles.size,recoilEchoes:s.recoilEchoes.size,magnetGraphics:children.includes(s.magnet.auraGraphics)?1:0,temporaryAlerts:children.filter(child=>child.type==='Text'&&child.depth===200&&!permanentHudTexts.has(child)).length};
    const permanentHudTextCount=children.filter(child=>permanentHudTexts.has(child)).length;
    const stableChildren=s.children.length-decor.particles-decor.recoilEchoes-decor.magnetGraphics-decor.temporaryAlerts;
    const orbGeometry=orb=>{const position=orb.getCollectionPosition(),sprite=orb.sprite;return[position.x,position.y,sprite.x,sprite.y,sprite.displayWidth,sprite.displayHeight].every(Number.isFinite)&&sprite.displayWidth>0&&sprite.displayHeight>0;};
    data.samples.push({
     elapsed:sampleTime-data.start,clock:{performanceMs:sampleTime,wallTimestampMs:Date.now(),sceneTimeMs:s.time.now},enemies:s.enemies.length,orbs:s.orbs.length,pool:window.__NUMBER_SNAKE_DEBUG__.getOrbPoolSize(),children:s.children.length,decor,permanentHudTextCount,stableChildren,
     orbPool:{active:activeOrbs.length,free:freeOrbs.length,total:allOrbs.length,uniqueSprites:new Set(allOrbs.map(orb=>orb.sprite)).size,activeSprites:activeOrbs.filter(orb=>orb.sprite.active&&orb.sprite.visible&&!orb.isCollected).length,inactiveFreeSprites:freeOrbs.filter(orb=>!orb.sprite.active&&!orb.sprite.visible&&orb.isCollected).length,finiteGeometry:allOrbs.every(orbGeometry)},
     checks:window.__NUMBER_SNAKE_DEBUG__.getBodyCandidateChecks(),candidateCheckMax:data.candidateCheckMax,fps:s.game.loop.actualFps,boss:!!s.ultimateBoss,state:s.gameState,
     player:{value:p.value,targetLength:p.targetLength,pathLength:p.pathLength,bodySpriteCapacity:p.bodySprites.length,visibleBodySegments:p.bodySprites.filter(sprite=>sprite.visible&&sprite.active).length,x:p.head.x,y:p.head.y},
     enemyValues:range(s.enemies.map(e=>e.value)),enemyTargetLengths:range(s.enemies.map(e=>e.targetLength)),enemyVisiblePathLengths:range(s.enemies.map(e=>e.pathLength)),enemyVisibleBodySegments:range(s.enemies.map(e=>e.bodySprites.filter(sprite=>sprite.visible&&sprite.active).length)),
     enemyBodySpriteCapacities:range(s.enemies.map(e=>e.bodySprites.length)),
     bounds:{world:{halfWidth:1200,halfHeight:800},playerOutOfWorld:outOfWorld(p.head),enemyX:range(enemyHeads.map(e=>e.x)),enemyY:range(enemyHeads.map(e=>e.y)),enemyOutOfWorldIds:enemyHeads.filter(outOfWorld).map(e=>e.id),ultimateBoss:boss,ultimateBossOutOfWorld:boss?outOfWorld(boss):null}
    });
   };
   const refill=refillTime=>{
    while(s.orbs.length<160){window.__NUMBER_SNAKE_DEBUG__.spawnOrbForTest(220+(s.orbs.length%10)*30,Math.floor(s.orbs.length/10)*25-250);data.maintenance.circlesSpawned++;}
    if(s.magnet.state==='READY'){s.magnet.activate();data.maintenance.magnetActivations++;}
    data.maintenance.refillTicks++;data.maintenance.lastMaintenanceElapsedMs=refillTime-data.start;
   };
   refill(now);
   nextRefill=now+1000;
   sample(now);
   const checkHeadBounds=(aggregate,head,id,tickTime)=>{
    aggregate.checked++;
    const finite=Number.isFinite(head.x)&&Number.isFinite(head.y);
    if(!finite)aggregate.nonFinite++;
    else{
     aggregate.maxAbsX=Math.max(aggregate.maxAbsX,Math.abs(head.x));aggregate.maxAbsY=Math.max(aggregate.maxAbsY,Math.abs(head.y));
     if(Math.abs(head.x)>aggregate.halfWidth+1e-6||Math.abs(head.y)>aggregate.halfHeight+1e-6)aggregate.outOfBounds++;
    }
    if((!finite||Math.abs(head.x)>aggregate.halfWidth+1e-6||Math.abs(head.y)>aggregate.halfHeight+1e-6)&&!aggregate.firstViolation){
     aggregate.firstViolation={id,x:head.x,y:head.y,elapsedMs:tickTime-data.start,sceneTimeMs:s.time.now,frame:s.game.loop.frame};
    }
   };
   window.perfTick=()=>{
    const tickTime=performance.now();
    data.frames.push(tickTime-last);last=tickTime;
    data.candidateCheckMax=Math.max(data.candidateCheckMax,window.__NUMBER_SNAKE_DEBUG__.getBodyCandidateChecks());
    data.frameBounds.framesChecked++;
    checkHeadBounds(data.frameBounds.player,s.player.head,'player',tickTime);
    for(const enemy of s.enemies)checkHeadBounds(data.frameBounds.enemies,enemy.body,enemy.arenaId,tickTime);
    if(s.ultimateBoss)checkHeadBounds(data.frameBounds.ultimateBoss,s.ultimateBoss.body,'ultimate_boss',tickTime);else data.frameBounds.missingUltimateBossFrames++;
    // Monotonic browser time keeps the workload independent of driver round trips.
    if(tickTime>=nextRefill){refill(tickTime);nextRefill=data.start+(Math.floor((tickTime-data.start)/1000)+1)*1000;}
    if(tickTime>=nextSample){sample(tickTime);nextSample=data.start+(Math.floor((tickTime-data.start)/10000)+1)*10000;}
   };
   s.events.on('postupdate',window.perfTick);
  });
  observerInstalled=true;phase='measure';hostStart=performance.now();hostStartedAt=new Date().toISOString();
  await readMetrics(false);saveReport();
  // Ten wall-clock deadlines, rather than 300 serialized one-second driver calls.
  // Each checkpoint is persisted so even a terminated browser/test retains metrics.
  for(let checkpoint=1;checkpoint<=10;checkpoint++){
   const remaining=hostStart+checkpoint*30000-performance.now();
   if(remaining>0)await page.waitForTimeout(remaining);
   await readMetrics(false);saveReport();
  }
  await readMetrics(true);phase='assert';saveReport();
  const samples=latest.samples,elapsedMs=latest.elapsedMs,maxCandidateChecks=latest.candidateCheckMax;
  expect(runtimeErrors,'No uncaught browser exceptions during the full-load run').toEqual([]);
  expect(hostElapsedMs).toBeGreaterThanOrEqual(durationMs);
  expect(elapsedMs).toBeGreaterThanOrEqual(300000);expect(samples.length).toBeGreaterThanOrEqual(30);expect(samples.every(s=>s.enemies===38&&s.boss&&s.state==='RUNNING'&&s.pool<=160)).toBe(true);
  const frameBounds=latest.frameBounds;
  expect(frameBounds.framesChecked).toBe(latest.frames.length);expect(frameBounds.framesChecked).toBeGreaterThan(0);expect(frameBounds.missingUltimateBossFrames).toBe(0);
  for(const [actor,aggregate]of Object.entries({player:frameBounds.player,enemies:frameBounds.enemies,ultimateBoss:frameBounds.ultimateBoss})){
   expect(aggregate.checked,actor+' must be observed every frame').toBe(frameBounds.framesChecked*(actor==='enemies'?38:1));
   expect(aggregate.nonFinite,actor+' head centers remain finite').toBe(0);
   expect(aggregate.outOfBounds,actor+' remains within its actual safe bounds: '+JSON.stringify(aggregate.firstViolation)).toBe(0);
  }
  const stableBase=samples[0].stableChildren;
  for(const sample of samples){
   expect(sample.permanentHudTextCount,'All five permanent HUD Text objects remain in the fixed base').toBe(5);
   expect(sample.decor.particles).toBeLessThanOrEqual(latest.decorCaps.particles);expect(sample.decor.recoilEchoes).toBeLessThanOrEqual(latest.decorCaps.recoilEchoes);expect(sample.decor.magnetGraphics).toBe(1);
   expect(sample.stableChildren,'Fixed children must not grow after subtracting tracked temporary effects').toBe(stableBase);
   if(sample.elapsed>=10000)expect(sample.decor.temporaryAlerts,'Startup alert texts must expire').toBe(0);
   expect(sample.orbPool.total).toBe(sample.pool);expect(sample.orbPool.active).toBe(sample.orbs);expect(sample.orbPool.active+sample.orbPool.free).toBe(sample.orbPool.total);expect(sample.orbPool.total).toBe(160);
   expect(sample.orbPool.uniqueSprites).toBe(sample.orbPool.total);expect(sample.orbPool.activeSprites).toBe(sample.orbPool.active);expect(sample.orbPool.inactiveFreeSprites).toBe(sample.orbPool.free);expect(sample.orbPool.finiteGeometry).toBe(true);
   expect(sample.player.value).toBe(499);
   expect(sample.player.targetLength).toBeCloseTo(36+24*Math.sqrt(499),3);
   expect(sample.player.pathLength).toBeGreaterThan(450);expect(sample.player.pathLength).toBeLessThanOrEqual(sample.player.targetLength+.01);
   expect(sample.player.visibleBodySegments).toBeGreaterThanOrEqual(20);expect(sample.player.visibleBodySegments).toBeLessThanOrEqual(40);
   expect(sample.player.bodySpriteCapacity).toBe(32);expect(sample.enemyBodySpriteCapacities).toEqual({min:32,max:32});
   expect(sample.enemyValues).toEqual({min:500,max:500});
   expect(sample.enemyTargetLengths.min).toBeCloseTo(36+24*Math.sqrt(500),3);expect(sample.enemyTargetLengths.max).toBeCloseTo(36+24*Math.sqrt(500),3);
   expect(sample.enemyVisiblePathLengths.min).toBeGreaterThan(450);expect(sample.enemyVisiblePathLengths.max).toBeLessThanOrEqual(sample.enemyTargetLengths.max+.01);
   expect(sample.enemyVisibleBodySegments.min).toBeGreaterThanOrEqual(20);expect(sample.enemyVisibleBodySegments.max).toBeLessThanOrEqual(40);
  }
  expect(Number.isInteger(maxCandidateChecks)&&maxCandidateChecks>=0).toBe(true);
  phase='cleanup';await startGame(page,{freeze:true});expect((await sceneState(page)).enemies).toBe(0);expect((await sceneState(page)).orbs).toBe(0);
  expect(runtimeErrors,'The cleanup and fresh scene also remain free of browser exceptions').toEqual([]);
  complete=true;phase='complete';
 }catch(error){
  failure={name:error.name,message:error.message};throw error;
 }finally{
  if(observerInstalled&&!observerStopped){try{await readMetrics(true);}catch(error){captureError={name:error.name,message:error.message};if(hostStart!==null)hostElapsedMs=performance.now()-hostStart;}}
  // Writing is synchronous and does not depend on a live Playwright page. If the
  // timeout already closed it, the last completed checkpoint is still available.
  const report=makeReport();fs.writeFileSync(output+'/performance.json',JSON.stringify(report,null,2));
  try{await info.attach('performance',{body:JSON.stringify(report,null,2),contentType:'application/json'});}catch(error){
   report.attachmentError={name:error.name,message:error.message};fs.writeFileSync(output+'/performance.json',JSON.stringify(report,null,2));
  }
 }
});
