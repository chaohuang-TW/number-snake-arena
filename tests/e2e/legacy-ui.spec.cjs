const { test, expect } = require('playwright/test');
const fs = require('node:fs');
const { boot, startGame, sceneState, fixtureEnemy, clickButton } = require('./helpers.cjs');

const evidence = process.env.EVIDENCE_DIR;
const cjk = /[\u3400-\u9fff\uf900-\ufaff]/u;
const unlockedSave = {
    number_snake_progression: {
        version: 1, highestUnlockedLevel: 4, maxHPBonus: 3,
        claimedRewards: ['level-1-clear-heart', 'level-2-clear-heart', 'level-3-clear-heart'],
        bestScoreByLevel: { 1: 111, 2: 222, 3: 333, 4: 444 }
    }
};
let browserErrors = [];
test.beforeEach(async ({ page }) => {
    browserErrors = [];
    page.on('pageerror', error => browserErrors.push(error.message));
});
test.afterEach(async () => expect(browserErrors, 'no browser exceptions during the real UI flow').toEqual([]));

async function capture(page, name) {
    if (!evidence) return;
    fs.mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: `${evidence}/${name}.png` });
}

async function visibleTexts(page, sceneKey, minDepth = -Infinity) {
    return page.evaluate(({ sceneKey, minDepth }) => {
        const scene = window.__PHASER_GAME__.scene.getScene(sceneKey);
        const result = [];
        const walk = (list, parentVisible = true, parentDepth = -Infinity) => {
            for (const object of list) {
                const visible = parentVisible && object.visible && object.active;
                const depth = Math.max(parentDepth, object.depth ?? 0);
                if (visible && object.type === 'Text' && depth >= minDepth) result.push(object.text);
                if (object.list) walk(object.list, visible, depth);
            }
        };
        walk(scene.children.list);
        return result;
    }, { sceneKey, minDepth });
}

function includesTexts(actual, expected, pageName) {
    // Wheel labels wrap before +values; line breaks do not change their meaning.
    const normalized = actual.map(value => value.replace(/\s+/g, ' ').trim());
    for (const text of expected) expect(normalized.some(value => value.includes(text)), `${pageName} displays ${text}`).toBe(true);
}

async function desktopControls(page) {
    return page.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
        return {
            hasTouch: navigator.maxTouchPoints > 0,
            joystick: scene.joystick.base.visible,
            boost: scene.hud.boostButton.visible,
            magnet: scene.hud.magnetButton.visible,
            boostLabel: scene.hud.boostButtonText.visible,
            magnetLabel: scene.hud.magnetButtonText.visible
        };
    });
}

async function enterWheelByLiveBossContact(page, rewardId = 'E') {
    await startGame(page, { level: 4, value: 401, freeze: true });
    await page.evaluate(rewardId => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
        window.__NUMBER_SNAKE_DEBUG__.setForcedWheelRewardForTest(rewardId);
        window.__NUMBER_SNAKE_DEBUG__.spawnBoss();
        // Initial conditions only. The normal GameScene update decides the collision.
        scene.boss.body.body.reset(scene.player.head.x, scene.player.head.y);
        scene.boss.body.body.moves = false;
    }, rewardId);
    await expect.poll(async () => (await sceneState(page)).state).toBe('LUCKY_WHEEL');
}

async function spinAndConfirmOnce(page) {
    await clickButton(page, 'GameScene', 'luckyWheelOverlay.spinBtn');
    await expect.poll(() => page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getLuckyWheelOverlay()?.hasSpun)).toBe(true);
    await clickButton(page, 'GameScene', 'luckyWheelOverlay.confirmBtn');
    await expect.poll(() => page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.isUltimatePhaseActive())).toBe(true);
}

async function finishUltimateByLiveContact(page) {
    await page.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
        scene.stopSpawning();
        scene.player.value = 501;
        scene.player.teleport(0, 80);
        scene.player.head.body.moves = false;
        scene.ultimateBoss.body.body.reset(0, 80);
        scene.ultimateBoss.body.body.moves = false;
    });
    await expect.poll(async () => (await sceneState(page)).state).toBe('LEVEL_CLEAR');
    await expect.poll(async () => (await visibleTexts(page, 'GameScene', 300)).some(text => text.includes('全部關卡完成'))).toBe(true);
}

test('LUI1 BN,BL,BY,N,AD,BA,X,AW: rendered zh-TW pages, legacy best, desktop controls and one game-over replay', async ({ page }) => {
    await boot(page, { language: null, save: { number_snake_best_score: '123' } });
    const menu = await visibleTexts(page, 'MenuScene');
    includesTexts(menu, ['數字蛇競技場', '關卡選擇', '第 1 關', '第 2 關', '第 3 關', '第 4 關', '數位格線', '霓虹城市', '熔岩核心', '深空星雲', '最高分：123', '開始'], 'menu');
    expect(menu.filter(text => text.includes('未解鎖'))).toHaveLength(3);
    expect(await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('MenuScene').tutorialText.text)).toBe('吃小數字長大，避開相等或更大的蛇頭！\n碰到身體會彈開！');
    const cards = await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('MenuScene').levelCards.map(card => card.list.filter(object => object.type === 'Text').map(object => object.text)));
    for (let index = 0; index < 4; index++) includesTexts(cards[index], [`第 ${index + 1} 關`, `首領 ${(index + 1) * 100}`], `card ${index + 1}`);
    await capture(page, 'LUI1-zh-menu');

    await clickButton(page, 'MenuScene', 'customizeBtn');
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.isActive('CustomizeScene'))).toBe(true);
    includesTexts(await visibleTexts(page, 'CustomizeScene'), ['外觀設定', '經典圓眼', '已裝備', '對手造型', '減少動態', '低特效', '返回'], 'appearance');
    await clickButton(page, 'CustomizeScene', 'backBtn');
    await clickButton(page, 'MenuScene', 'startBtn_1');
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.isActive('PrepScene'))).toBe(true);
    const prep = await visibleTexts(page, 'PrepScene');
    includesTexts(prep, ['戰前準備', '起始數值', '標準', '強化', '威力', '開始關卡', '返回', '生命：3', '首領：100'], 'prep');
    expect(await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('PrepScene').getSelectedStartValue())).toBe(5);
    await capture(page, 'LUI1-zh-prep');
    await clickButton(page, 'PrepScene', 'startLevelBtn');
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.isActive('GameScene'))).toBe(true);
    await page.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
        scene.stopSpawning();
        scene.player.teleport(0, 0);
        scene.player.head.body.moves = false;
        scene.debugUI?.text.setVisible(false);
    });
    const hud = await page.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
        return { value: scene.hud.valueText.text, score: scene.hud.scoreText.text, best: scene.hud.bestScoreText.text, magnet: scene.hud.magnetText.text, hearts: scene.player.hp };
    });
    expect(hud).toEqual({ value: '數值 5', score: '分數: 0', best: '最高分: 123', magnet: '🧲 磁力就緒', hearts: 3 });
    expect(await desktopControls(page)).toEqual({ hasTouch: false, joystick: false, boost: false, magnet: false, boostLabel: false, magnetLabel: false });
    await capture(page, 'LUI1-zh-hud');

    const progressBefore = await page.evaluate(() => JSON.parse(JSON.stringify(window.__NUMBER_SNAKE_DEBUG__.getProgression())));
    await fixtureEnemy(page, { value: 13, x: 0, y: 0 });
    await expect.poll(async () => (await sceneState(page)).state).toBe('GAME_OVER');
    includesTexts(await visibleTexts(page, 'GameScene', 300), ['遊戲結束', '最終數值：5', '分數: 0', '最高分: 123', '再玩一次'], 'game over');
    expect(await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getProgression())).toEqual(progressBefore);
    await capture(page, 'LUI1-zh-game-over');
    await clickButton(page, 'GameScene', 'playAgainBtn');
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.isActive('PrepScene'))).toBe(true);
    expect(await page.evaluate(() => ({ level: window.__PHASER_GAME__.scene.getScene('PrepScene').levelId, selected: window.__PHASER_GAME__.scene.getScene('PrepScene').getSelectedStartValue() }))).toEqual({ level: 1, selected: 5 });
    await clickButton(page, 'PrepScene', 'backBtn');
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.isActive('MenuScene'))).toBe(true);
});

test('LUI2 BX,BY,BM: English tutorial is rendered without CJK and survives a reload', async ({ page }) => {
    await boot(page);
    await clickButton(page, 'MenuScene', 'langBtn_en');
    const tutorial = await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('MenuScene').tutorialText.text);
    expect(tutorial).toBe('Eat smaller. Avoid equal or larger heads.\nBodies bounce you away!');
    expect(tutorial).not.toMatch(cjk);
    includesTexts(await visibleTexts(page, 'MenuScene'), ['NUMBER SNAKE ARENA', 'LEVEL SELECT', 'LEVEL 1', 'LEVEL 2', 'LEVEL 3', 'LEVEL 4', 'LOCKED', 'START'], 'English menu');
    await capture(page, 'LUI2-en-tutorial');
    await page.reload();
    await page.waitForFunction(() => window.__PHASER_GAME__?.scene.isActive('MenuScene'));
    expect(await page.evaluate(() => localStorage.getItem('number_snake_language_v1'))).toBe('en');
    expect(await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('MenuScene').tutorialText.text)).toBe(tutorial);
    await clickButton(page, 'MenuScene', 'startBtn_1');
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.isActive('PrepScene'))).toBe(true);
    const prep = await visibleTexts(page, 'PrepScene');
    includesTexts(prep, ['PRE-BATTLE', 'START VALUE', 'STANDARD', 'BOOST', 'POWER', 'START LEVEL', 'BACK'], 'English prep');
    expect(prep.join(' ')).not.toMatch(cjk);
    await clickButton(page, 'PrepScene', 'backBtn');
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.isActive('MenuScene'))).toBe(true);
});

test('LUI3 BR,BW,BJ: one physical 400 wheel flow starts the centered ecosystem and distant 500 indicator', async ({ page }) => {
    await boot(page, { save: unlockedSave });
    await enterWheelByLiveBossContact(page, 'E');
    includesTexts(await visibleTexts(page, 'GameScene', 250), ['幸運轉盤', '轉動', '威力 +100', '磁力充能', '大獎！'], 'wheel');
    await capture(page, 'LUI3-zh-wheel');
    await clickButton(page, 'GameScene', 'luckyWheelOverlay.spinBtn');
    await expect.poll(() => page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getLuckyWheelOverlay()?.hasSpun)).toBe(true);
    await expect.poll(async () => (await visibleTexts(page, 'GameScene', 250)).some(text => text === '迎戰終極首領')).toBe(true);
    includesTexts(await visibleTexts(page, 'GameScene', 250), ['你的獎勵', '磁力充能', '迎戰終極首領'], 'wheel reward');
    await capture(page, 'LUI3-zh-reward');
    await clickButton(page, 'GameScene', 'luckyWheelOverlay.confirmBtn');
    await expect.poll(() => page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.isUltimatePhaseActive())).toBe(true);
    const initial = await page.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
        return { state: scene.gameState, x: scene.player.head.x, y: scene.player.head.y, enemyCount: scene.enemies.length, bossValue: scene.ultimateBoss.value, bx: scene.ultimateBoss.body.x, by: scene.ultimateBoss.body.y };
    });
    expect(initial.state).toBe('RUNNING');
    expect(Math.abs(initial.x)).toBeLessThan(35);
    expect(Math.abs(initial.y - 80)).toBeLessThan(10);
    expect(initial.enemyCount).toBe(10);
    expect(initial.bossValue).toBe(500);
    expect(Math.abs(initial.bx)).toBeLessThan(35);
    expect(initial.by).toBeLessThanOrEqual(-450);
    expect(Math.hypot(initial.bx - initial.x, initial.by - initial.y)).toBeGreaterThanOrEqual(500);
    await expect.poll(() => page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getBossIndicatorState().visible)).toBe(true);
    const arena = await page.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
        return { values: scene.enemies.map(enemy => enemy.value), indicator: scene.bossIndicator.getState() };
    });
    expect(arena.values).toEqual([25, 31, 37, 43, 49, 55, 61, 67, 73, 79]);
    expect(arena.indicator.visible).toBe(true);
    expect(arena.indicator.text).toContain('500');
    expect(arena.indicator.x).toBeGreaterThanOrEqual(0);
    expect(arena.indicator.y).toBeGreaterThanOrEqual(0);
    expect(await desktopControls(page)).toEqual({ hasTouch: false, joystick: false, boost: false, magnet: false, boostLabel: false, magnetLabel: false });
    await capture(page, 'LUI3-zh-ultimate-arena');
});

for (const [button, nextScene] of [['playAgainBtn', 'PrepScene'], ['levelSelectBtn', 'MenuScene']]) {
    test(`LUI4 BU,BW,AL,BA,AW: zh-TW final clear text and one ${button} routes to ${nextScene}`, async ({ page }) => {
        await boot(page, { save: unlockedSave });
        const cards = await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('MenuScene').levelCards.map(card => card.list.filter(object => object.type === 'Text').map(object => object.text)));
        for (let index = 0; index < 4; index++) includesTexts(cards[index], [`第 ${index + 1} 關`, `最高分：${111 * (index + 1)}`], `unlocked card ${index + 1}`);
        await enterWheelByLiveBossContact(page, 'E');
        await spinAndConfirmOnce(page);
        await finishUltimateByLiveContact(page);
        const finalTexts = await visibleTexts(page, 'GameScene', 300);
        includesTexts(finalTexts, ['第 4 關', '完成', '全部關卡完成！', '你成為數字王者！', '再玩一次', '關卡選擇'], 'final clear');
        expect(finalTexts.some(text => text.includes('下一關') || text.includes('+1 愛心') || text.includes('重玩本關'))).toBe(false);
        const buttons = await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').children.list.filter(object => object.depth >= 300 && object.visible && object.active && object.input?.enabled).map(object => object.name).sort());
        expect(buttons).toEqual(['levelSelectBtn', 'playAgainBtn']);
        expect(await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getProgression().highestUnlockedLevel)).toBe(4);
        expect(await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getUltimateBoss())).toBeNull();
        const best = await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getProgression().bestScoreByLevel[4]);
        await capture(page, `LUI4-zh-final-${button}`);
        await clickButton(page, 'GameScene', button);
        await expect.poll(() => page.evaluate(nextScene => window.__PHASER_GAME__.scene.isActive(nextScene), nextScene)).toBe(true);
        if (nextScene === 'PrepScene') {
            expect(await page.evaluate(() => ({ level: window.__PHASER_GAME__.scene.getScene('PrepScene').levelId, value: window.__PHASER_GAME__.scene.getScene('PrepScene').getSelectedStartValue() }))).toEqual({ level: 4, value: 5 });
            includesTexts(await visibleTexts(page, 'PrepScene'), ['戰前準備', '第 4 關', '開始關卡'], 'replay prep');
            await clickButton(page, 'PrepScene', 'backBtn');
            await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.isActive('MenuScene'))).toBe(true);
        }
        const returnedCards = await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('MenuScene').levelCards.map(card => card.list.filter(object => object.type === 'Text').map(object => object.text)));
        expect(returnedCards).toHaveLength(4);
        includesTexts(returnedCards[3], [`最高分：${best}`, '開始'], 'returned fourth card');
    });
}
