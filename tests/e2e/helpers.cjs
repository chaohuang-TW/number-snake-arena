const {expect}=require('playwright/test');
async function boot(page,{language='zh-TW',normal=false,save}={}){
 await page.addInitScript(({language,save})=>{if(sessionStorage.getItem('number_snake_e2e_seeded'))return;sessionStorage.setItem('number_snake_e2e_seeded','1');if(language)localStorage.setItem('number_snake_language_v1',language);if(save)for(const[k,v]of Object.entries(save))localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));},{language,save});
 await page.goto(normal?'?e2e=1':'?debug=1');
 if(!normal)await page.waitForFunction(()=>window.__PHASER_GAME__?.scene.isActive('MenuScene'));
 else await page.locator('canvas').waitFor({state:'visible'});
 if(process.env.EXPECT_BUILD_COMMIT)expect(await page.evaluate(()=>window.__NUMBER_SNAKE_BUILD__?.commit)).toBe(process.env.EXPECT_BUILD_COMMIT);
}
async function startGame(page,{level=1,value=5,clean=true,freeze=false}={}){
 await page.evaluate(({level,value})=>{const key='number_snake_progression',saved=JSON.parse(localStorage.getItem(key)||'null')||{version:1,highestUnlockedLevel:1,maxHPBonus:0,claimedRewards:[],bestScoreByLevel:{}};if(saved.highestUnlockedLevel<level){saved.highestUnlockedLevel=level;localStorage.setItem(key,JSON.stringify(saved))}window.__PHASER_GAME__.scene.start('GameScene',{levelId:level,startValueOverride:value})},{level,value});
 await page.waitForFunction(()=>window.__PHASER_GAME__?.scene.isActive('GameScene')&&window.__NUMBER_SNAKE_DEBUG__?.getGameState()==='RUNNING');
 await page.evaluate(({value,clean,freeze})=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');s.spawnTimer=9999999;s.lastEdibleCheckTime=999999999;s.lastRescueTime=999999999;if(clean){s.stopSpawning();s.hardReset()}s.player.value=value;s.player.teleport(0,0);s.cameras.main.startFollow(s.player.head,true,1,1);s.cameras.main.centerOn(0,0);if(freeze)s.player.head.body.moves=false;s.debugUI?.text.setVisible(false);s.physics.world.drawDebug=false;s.physics.world.debugGraphic?.clear();},{value,clean,freeze});
}
async function sceneState(page){return page.evaluate(()=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');return{value:s.player.value,hp:s.player.hp,segments:s.player.segments,targetLength:s.player.targetLength,pathLength:s.player.pathLength,energy:s.player.boostEnergy,score:s.hud.getScore(),enemies:s.enemies.length,orbs:s.orbs.length,state:s.gameState,zoom:s.cameras.main.zoom,x:s.player.head.x,y:s.player.head.y,recoil:s.player.isRecoiling,ranking:s.currentRanking,children:s.children.length,resizeListeners:s.scale.listenerCount('resize'),shutdownListeners:s.events.listenerCount('shutdown'),keyboardListeners:s.input.keyboard.eventNames().map(e=>[e,s.input.keyboard.listenerCount(e)])}})}
async function fixtureEnemy(page,{value=9,x=0,y=0,skin='classic',points}={}){await page.evaluate(({value,x,y,skin,points})=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene'),e=window.__NUMBER_SNAKE_DEBUG__.spawnEnemy(value,x,y,skin);e.body.body.reset(x,y);e.body.body.moves=false;if(points&&e.path)e.path.seed(points);window.fixtureEnemy=e;},{value,x,y,skin,points});}
async function seedPlayer(page,points){await page.evaluate(points=>{const p=window.__PHASER_GAME__.scene.getScene('GameScene').player;p.teleport(points[0].x,points[0].y);p.path.seed(points);},points)}
async function buttonPoint(page,sceneKey,target){
 return page.evaluate(({sceneKey,target})=>{
  const g=window.__PHASER_GAME__,s=g.scene.getScene(sceneKey);let o=s;for(const part of target.split('.'))o=o?.[part];
  if(!o||typeof o.getBounds!=='function'){
   const walk=list=>{for(const c of list){if(c.name===target||(c.type==='Text'&&c.text===target))return c;if(c.list){const found=walk(c.list);if(found)return found}}};o=walk(s.children.list);
  }
  if(!o)return null;let visible=o.visible&&o.active;for(let p=o.parentContainer;p;p=p.parentContainer)visible=visible&&p.visible&&p.active;
  if(!visible||!o.input?.enabled)return null;
  const b=o.getBounds(),cam=s.cameras.main,sfX=o.scrollFactorX??1,sfY=o.scrollFactorY??1;
  const pt=cam.matrix.transformPoint(b.centerX+cam.scrollX*(1-sfX),b.centerY+cam.scrollY*(1-sfY));
  const rect=g.canvas.getBoundingClientRect(),sx=rect.width/g.scale.width,sy=rect.height/g.scale.height;
  return{x:rect.left+pt.x*sx,y:rect.top+pt.y*sy,width:b.width*cam.zoom*sx,height:b.height*cam.zoom*sy};
 },{sceneKey,target});
}
async function clickButton(page,scene,target,{tap=false,double=false}={}){
 let previous;await expect.poll(async()=>{const p=await buttonPoint(page,scene,target);if(!p)return false;const stable=previous&&Math.abs(previous.x-p.x)<.5&&Math.abs(previous.y-p.y)<.5;previous=p;return !!stable;},{message:`${scene}.${target} must be visible, enabled and stable before one click`}).toBe(true);
 const p=previous;expect(p.x).toBeGreaterThan(0);expect(p.y).toBeGreaterThan(0);expect(p.x).toBeLessThan(page.viewportSize().width);expect(p.y).toBeLessThan(page.viewportSize().height);
 if(double)await page.mouse.dblclick(p.x,p.y);else if(tap)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);
}
async function realBossContact(page,{level=1,value=101,ultimate=false}={}){
 await startGame(page,{level,value,freeze:true});await page.evaluate(({ultimate})=>{const s=window.__PHASER_GAME__.scene.getScene('GameScene');if(ultimate)window.__NUMBER_SNAKE_DEBUG__.spawnUltimateBossForTest();else window.__NUMBER_SNAKE_DEBUG__.spawnBoss();const b=ultimate?s.ultimateBoss:s.boss;b.body.body.reset(s.player.head.x,s.player.head.y);b.body.body.moves=false;},{ultimate});
}
module.exports={boot,startGame,sceneState,fixtureEnemy,seedPlayer,buttonPoint,clickButton,realBossContact};
