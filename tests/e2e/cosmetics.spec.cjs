const {test,expect}=require('playwright/test');
const fs=require('node:fs');
const {boot,startGame,sceneState,clickButton}=require('./helpers.cjs');
test('G,AO: old player cosmetic, opponent selection, full snake preview and reload',async({page})=>{
 await boot(page,{save:{number_snake_cosmetics_v1:{version:1,selectedHeadSkin:'mecha'}}});
 await clickButton(page,'MenuScene','customizeBtn');await page.waitForFunction(()=>window.__PHASER_GAME__.scene.isActive('CustomizeScene'));
 expect(await page.evaluate(()=>localStorage.getItem('number_snake_cosmetics_v1'))).toContain('mecha');
 await clickButton(page,'CustomizeScene','opponentSpecifiedBtn');await clickButton(page,'CustomizeScene','nextOpponentSkinBtn');await clickButton(page,'CustomizeScene','lowEffectsBtn');await clickButton(page,'CustomizeScene','reducedMotionBtn');
 const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('number_snake_visual_preferences_v1')));expect(prefs.opponentStyleMode).toBe('specified');expect(prefs.lowEffects).toBe(true);expect(prefs.reducedMotion).toBe(true);
 if(process.env.EVIDENCE_DIR){fs.mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:process.env.EVIDENCE_DIR+'/appearance-settings.png'})}
 await clickButton(page,'CustomizeScene','backBtn');await page.reload();await page.waitForFunction(()=>window.__PHASER_GAME__.scene.isActive('MenuScene'));
 await startGame(page,{clean:false,freeze:true});const skins=await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').enemies.map(e=>e.headSkinId));expect(skins.every(id=>id===prefs.opponentHeadSkin)).toBe(true);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getPlayerHeadSkin())).toBe('mecha');
});
test('AO: random first six spawn all silhouettes and each AI keeps its face',async({page})=>{
 await boot(page);await startGame(page,{clean:false,freeze:true});const first=await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').enemies.slice(0,6).map(e=>({id:e.arenaId,skin:e.headSkinId})));expect(new Set(first.map(e=>e.skin)).size).toBe(6);await page.waitForTimeout(200);const next=await page.evaluate(()=>window.__PHASER_GAME__.scene.getScene('GameScene').enemies.slice(0,6).map(e=>({id:e.arenaId,skin:e.headSkinId})));expect(next).toEqual(first);
});
test('G: corrupt preferences remain playable without erasing progress',async({page})=>{
 await boot(page,{save:{number_snake_visual_preferences_v1:'{broken',number_snake_cosmetics_v1:'{"selectedHeadSkin":"unknown"}',number_snake_progression:{version:1,highestUnlockedLevel:3,maxHPBonus:2,claimedRewards:['level1'],bestScoreByLevel:{2:777}}}});await startGame(page,{freeze:true});expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getPlayerHeadSkin())).toBe('classic');expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getMaxHP())).toBe(5);expect(await page.evaluate(()=>window.__NUMBER_SNAKE_DEBUG__.getProgression().bestScoreByLevel[2])).toBe(777);
});
