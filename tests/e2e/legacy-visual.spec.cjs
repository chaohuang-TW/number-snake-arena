const { test, expect } = require('playwright/test');
const fs = require('node:fs');
const { boot, startGame, sceneState, fixtureEnemy, clickButton } = require('./helpers.cjs');

const evidence = process.env.EVIDENCE_DIR;
const sizes = [[390, 844], [430, 932], [844, 390], [932, 430], [768, 1024], [1024, 768], [834, 1194], [1024, 1366], [1366, 768], [1920, 1080]];
const skins = ['classic', 'bolt', 'mecha', 'dragon', 'flame', 'alien'];
const skinNames = ['經典圓眼', '閃電造型', '機械面罩', '小龍角', '火焰冠', '外星觸角'];
let errors;
test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(async () => expect(errors, 'visual regression has no browser exceptions').toEqual([]));

async function capture(page, name) {
    if (!evidence) return;
    fs.mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: `${evidence}/${name}.png` });
}
function within(rect, width, height, label) {
    expect(rect.width, `${label} positive width`).toBeGreaterThan(0);
    expect(rect.height, `${label} positive height`).toBeGreaterThan(0);
    expect(rect.x, `${label} left`).toBeGreaterThanOrEqual(-1);
    expect(rect.y, `${label} top`).toBeGreaterThanOrEqual(-1);
    expect(rect.x + rect.width, `${label} right`).toBeLessThanOrEqual(width + 1);
    expect(rect.y + rect.height, `${label} bottom`).toBeLessThanOrEqual(height + 1);
}
function overlaps(a, b) {
    return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 2 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 2;
}

test('LV1 AD,AM,BL,BY: all four drawn cards, locked labels and tutorial fit ten viewport sizes', async ({ page }) => {
    await boot(page, { language: null });
    for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await page.waitForFunction(({ width, height }) => {
            const scene = window.__PHASER_GAME__.scene.getScene('MenuScene');
            return scene.scale.width === width && scene.scale.height === height && scene.levelCards.length === 4;
        }, { width, height });
        const layout = await page.evaluate(() => {
            const game = window.__PHASER_GAME__, scene = game.scene.getScene('MenuScene'), canvas = game.canvas.getBoundingClientRect();
            const cssRect = bounds => ({ x: canvas.left + bounds.x * canvas.width / scene.scale.width, y: canvas.top + bounds.y * canvas.height / scene.scale.height, width: bounds.width * canvas.width / scene.scale.width, height: bounds.height * canvas.height / scene.scale.height });
            // Phaser Graphics has no intrinsic width/height. Read the actual rounded-panel drawing
            // commands instead of mistaking a container's text-only bounds for the whole card.
            const commandSize = { 0: 7, 1: 0, 2: 0, 3: 4, 4: 2, 5: 2, 6: 3, 7: 2, 8: 0, 9: 0, 10: 6, 11: 6, 14: 0, 15: 0, 16: 2, 17: 2, 18: 1, 21: 8, 22: 6 };
            const cards = scene.levelCards.map(card => {
                const panel = card.list.find(child => child.type === 'Graphics'), points = [], commands = panel.commandBuffer;
                for (let index = 0; index < commands.length;) {
                    const command = commands[index++];
                    if (!(command in commandSize)) throw Error(`unknown Graphics command ${command}`);
                    if (command === 4 || command === 5) points.push({ x: commands[index], y: commands[index + 1] });
                    index += commandSize[command];
                }
                const matrix = panel.getWorldTransformMatrix(), world = points.map(point => matrix.transformPoint(point.x, point.y));
                const xs = world.map(point => point.x), ys = world.map(point => point.y);
                const bounds = cssRect({ x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) });
                return { bounds, texts: card.list.filter(child => child.type === 'Text').map(child => ({ text: child.text, visible: child.visible, bounds: cssRect(child.getBounds()) })), buttons: card.list.filter(child => child.input?.enabled).map(child => ({ name: child.name, bounds: cssRect(child.getBounds()) })) };
            });
            return { cards, tutorial: { text: scene.tutorialText.text, visible: scene.tutorialText.visible, bounds: cssRect(scene.tutorialText.getBounds()) } };
        });
        expect(layout.cards).toHaveLength(4);
        for (let index = 0; index < 4; index++) {
            const card = layout.cards[index];
            within(card.bounds, width, height, `card ${index + 1} ${width}x${height}`);
            expect(card.texts.map(text => text.text)).toContain(`第 ${index + 1} 關`);
            expect(card.texts.map(text => text.text)).toContain(`首領 ${(index + 1) * 100}`);
            expect(card.texts.every(text => text.visible)).toBe(true);
            expect(card.texts.some(text => text.text === '🔒 未解鎖')).toBe(index > 0);
            expect(card.buttons.map(button => button.name)).toEqual(index === 0 ? ['startBtn_1'] : []);
            for (const child of [...card.texts, ...card.buttons]) {
                within(child.bounds, width, height, `card ${index + 1} child`);
                expect(child.bounds.x).toBeGreaterThanOrEqual(card.bounds.x - 1);
                expect(child.bounds.y).toBeGreaterThanOrEqual(card.bounds.y - 1);
                expect(child.bounds.x + child.bounds.width).toBeLessThanOrEqual(card.bounds.x + card.bounds.width + 1);
                expect(child.bounds.y + child.bounds.height).toBeLessThanOrEqual(card.bounds.y + card.bounds.height + 1);
            }
            for (let other = index + 1; other < 4; other++) expect(overlaps(card.bounds, layout.cards[other].bounds)).toBe(false);
            expect(overlaps(card.bounds, layout.tutorial.bounds)).toBe(false);
        }
        expect(layout.tutorial.visible).toBe(true);
        expect(layout.tutorial.text).toBe('吃小數字長大，避開相等或更大的蛇頭！\n碰到身體會彈開！');
        within(layout.tutorial.bounds, width, height, 'tutorial');
        await capture(page, `LV1-menu-${width}x${height}`);
    }
    await clickButton(page, 'MenuScene', 'startBtn_1');
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.isActive('PrepScene'))).toBe(true);
});

test('LV2 AN: all six free skins use one UI selection/equip/play and keep radius 20 with distinct drawn silhouettes', async ({ page }) => {
    await boot(page);
    const masks = [];
    for (let index = 0; index < skins.length; index++) {
        if (index > 0) {
            // Only prepare the next independent UI flow; no skin/equip/start result handler is called.
            await page.evaluate(() => window.__PHASER_GAME__.scene.start('MenuScene'));
            await page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('MenuScene'));
        }
        await clickButton(page, 'MenuScene', 'customizeBtn');
        if (index > 0) await clickButton(page, 'CustomizeScene', 'nextSkinBtn');
        const preview = await page.evaluate(skin => {
            const scene = window.__PHASER_GAME__.scene.getScene('CustomizeScene');
            const snake = scene.children.list.find(child => child.type === 'Container' && child.list.some(object => object.texture?.key === `skin_head_${skin}_p`));
            return { name: scene.styleNameText.text, width: snake.getBounds().width, visible: snake.visible, body: snake.list.filter(object => object.texture?.key === 'player_body' && object.visible).length, tail: snake.list.filter(object => object.texture?.key === 'player_tail' && object.visible).length, head: snake.list.filter(object => object.texture?.key === `skin_head_${skin}_p` && object.visible).length };
        }, skins[index]);
        expect(preview).toEqual({ name: skinNames[index], width: expect.any(Number), visible: true, body: 6, tail: 1, head: 1 });
        expect(preview.width).toBeGreaterThan(200);
        await clickButton(page, 'CustomizeScene', 'equipSkinBtn');
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('number_snake_cosmetics_v1')).selectedHeadSkin)).toBe(skins[index]);
        await capture(page, `LV2-${skins[index]}-preview`);
        await clickButton(page, 'CustomizeScene', 'backBtn');
        await clickButton(page, 'MenuScene', 'startBtn_1');
        await clickButton(page, 'PrepScene', 'startLevelBtn');
        await page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('GameScene'));
        const player = await page.evaluate(() => {
            const scene = window.__PHASER_GAME__.scene.getScene('GameScene'), player = scene.player, head = player.head;
            // An offscreen texture readback; the actual game canvas size/style never changes.
            const source = scene.textures.get(head.texture.key).getSourceImage(), readback = document.createElement('canvas');
            readback.width = source.width; readback.height = source.height;
            const context = readback.getContext('2d'); context.drawImage(source, 0, 0);
            const pixels = context.getImageData(0, 0, readback.width, readback.height).data;
            let hash = 2166136261, opaque = 0, eyeGlints = 0;
            for (let offset = 0; offset < pixels.length; offset += 4) {
                const on = pixels[offset + 3] >= 128 ? 1 : 0;
                hash = Math.imul(hash ^ on, 16777619) >>> 0; opaque += on;
                if (on && pixels[offset] > 235 && pixels[offset + 1] > 235 && pixels[offset + 2] > 235) eyeGlints++;
            }
            return { skin: player.headSkinId, texture: head.texture.key, radius: head.body.radius, circle: head.body.isCircle, scale: head.scaleX, mask: hash, opaque, eyeGlints, width: source.width, height: source.height };
        });
        expect(player.skin).toBe(skins[index]);
        expect(player.texture).toBe(`skin_head_${skins[index]}_p`);
        expect(player.radius).toBe(20);
        expect(player.circle).toBe(true);
        expect(player.scale).toBe(1);
        expect([player.width, player.height]).toEqual([64, 64]);
        expect(player.opaque).toBeGreaterThan(800);
        expect(player.eyeGlints).toBeGreaterThan(10);
        masks.push(player.mask);
    }
    expect(new Set(masks).size, 'six alpha silhouettes differ even when colour is ignored').toBe(6);
    await page.reload();
    await page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('MenuScene'));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('number_snake_cosmetics_v1')).selectedHeadSkin)).toBe('alien');
});

test('LV3 AO: edible check and dangerous cross/outline are visible for every AI skin independently of head colour', async ({ page }) => {
    await boot(page);
    await startGame(page, { value: 10, freeze: true });
    for (const [row, value] of [9, 10, 20].entries()) for (let index = 0; index < skins.length; index++) {
        await fixtureEnemy(page, { value, x: -275 + index * 110, y: [-180, 100, 260][row], skin: skins[index] });
    }
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').enemies.map(enemy => enemy.currentThreatType))).toEqual([...Array(6).fill(1), ...Array(6).fill(2), ...Array(6).fill(3)]);
    const threats = await page.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
        return scene.enemies.map(enemy => {
            const position = scene.cameras.main.matrix.transformPoint(enemy.body.x, enemy.body.y);
            return { skin: enemy.headSkinId, texture: enemy.body.texture.key, type: enemy.currentThreatType, visible: enemy.glow.visible && enemy.glow.active && enemy.glow.alpha > 0 && enemy.body.visible, commands: enemy.glow.commandBuffer, x: position.x, y: position.y, label: enemy.valueText.text, labelVisible: enemy.valueText.visible, tint: enemy.body.tintTopLeft };
        });
    });
    const symbolStart = [6, 2, 0xffffff, 0.95];
    const check = [...symbolStart, 1, 5, -5, 29, 4, 0, 34, 9, 1, 5, 0, 34, 4, 7, 26, 9];
    const cross = [...symbolStart, 1, 5, -4, 28, 4, 4, 36, 9, 1, 5, 4, 28, 4, -4, 36, 9];
    const outlines = [];
    for (let row = 0; row < 3; row++) {
        const group = threats.slice(row * 6, row * 6 + 6), symbol = row === 0 ? check : cross;
        for (let index = 0; index < group.length; index++) {
            const threat = group[index];
            expect(threat.skin).toBe(skins[index]);
            expect(threat.texture).toBe(`skin_head_${skins[index]}_e`);
            expect(threat.visible && threat.labelVisible).toBe(true);
            expect(threat.tint).toBe(0xffffff);
            expect(threat.label).toBe(String([9, 10, 20][row]));
            expect(threat.commands.slice(-symbol.length), 'white check/cross drawing commands are present').toEqual(symbol);
            within({ x: threat.x - 31, y: threat.y - 55, width: 62, height: 92 }, 1366, 768, 'visible AI outline, number and symbol');
            expect(threat.commands, 'same semantic prompt across all six cosmetic colours').toEqual(group[0].commands);
        }
        outlines.push(JSON.stringify(group[0].commands.slice(0, -symbol.length)));
    }
    expect(new Set(outlines).size, 'edible circle / equal rounded box / high-danger diamond differ').toBe(3);
    await capture(page, 'LV3-eighteen-AI-threat-prompts');
});

test('LV4 AX,AY: displayed Top5 names/values and extra player rank match; one crown follows the live leader and survives its removal', async ({ page }) => {
    await boot(page);
    await startGame(page, { value: 50, freeze: true });
    await page.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
        window.crownFrames = [];
        window.recordCrownFrame = () => {
            if (!scene.worldCrown.visible) return;
            const leader = scene.currentRanking?.leader;
            const valueText = leader?.type === 'player' ? scene.player.valueText : scene.enemies.find(enemy => enemy.arenaId === leader?.id)?.valueText;
            const crown = scene.worldCrown.getBounds(), label = valueText?.getBounds();
            window.crownFrames.push({ orphan: !valueText?.active, gap: label ? label.y - crown.y - crown.height : null, scale: scene.worldCrown.scaleX });
        };
        scene.events.on('postupdate', window.recordCrownFrame);
    });
    for (const [index, value] of [70, 60, 40, 30, 20].entries()) await fixtureEnemy(page, { value, x: -250 + index * 120, y: 150 });
    await page.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
        scene.bossSpawned = true; // Isolate ordinary ranking; natural boss spawning has separate tests.
        ['NOVA', 'BYTE', 'VOLT', 'PIXEL', 'COMET'].forEach((name, index) => { scene.enemies[index].arenaName = name; });
        window.leaderEnemy = scene.enemies[0];
    });
    const display = () => page.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene'), panel = scene.leaderboard;
        return { names: panel.nameTexts.map(text => text.text), values: panel.valueTexts.map(text => text.text), ranks: panel.rankTexts.map(text => text.text), visible: panel.nameTexts.every(text => text.visible && text.active) && panel.valueTexts.every(text => text.visible && text.active), playerRank: scene.currentRanking.playerRank.rank, extra: panel.playerExtraRow.text, extraVisible: panel.playerExtraRow.visible, crownRow: panel.crownIcons.map(icon => icon.visible) };
    });
    await expect.poll(async () => (await display()).names).toEqual(['NOVA', 'BYTE', '你', 'VOLT', 'PIXEL']);
    expect(await display()).toEqual({ names: ['NOVA', 'BYTE', '你', 'VOLT', 'PIXEL'], values: ['70', '60', '50', '40', '30'], ranks: ['1', '2', '3', '4', '5'], visible: true, playerRank: 3, extra: '', extraVisible: false, crownRow: [true, false, false, false, false] });
    const crownState = () => page.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene'), crown = scene.worldCrown;
        const leader = scene.currentRanking.leader.type === 'player' ? scene.player.head : scene.enemies.find(enemy => enemy.arenaId === scene.currentLeaderId)?.body;
        const valueText = scene.currentRanking.leader.type === 'player' ? scene.player.valueText : scene.enemies.find(enemy => enemy.arenaId === scene.currentLeaderId)?.valueText;
        return { id: scene.currentLeaderId, visible: crown.visible && crown.active, x: crown.x, y: crown.y, leaderX: leader?.x, leaderY: leader?.y, crownBounds: crown.getBounds(), valueBounds: valueText?.getBounds(), worldCrownCount: scene.children.list.filter(object => object.texture?.key === 'crown_gold' && object.depth === 205 && object.active).length };
    });
    await expect.poll(async () => (await crownState()).visible).toBe(true);
    const original = await crownState();
    expect(original.x).toBe(original.leaderX); expect(original.y).toBe(original.leaderY - 80); expect(original.worldCrownCount).toBe(1);
    expect(overlaps(original.crownBounds, original.valueBounds), 'AI leader crown does not cover its number').toBe(false);
    await page.evaluate(() => window.leaderEnemy.body.body.reset(-200, -120));
    await expect.poll(async () => (await crownState()).y).toBe(-200);
    expect((await crownState()).x).toBe(-200);
    await capture(page, 'LV4-ordinary-leader-crown');
    await page.evaluate(() => { window.__PHASER_GAME__.scene.getScene('GameScene').player.value = 10; });
    await expect.poll(async () => (await display()).playerRank).toBe(6);
    expect((await display()).extra).toBe('你 #6 · 10'); expect((await display()).extraVisible).toBe(true);
    await page.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
        scene.player.value = 80;
        scene.player.teleport(window.leaderEnemy.body.x, window.leaderEnemy.body.y);
    });
    await expect.poll(async () => (await sceneState(page)).value).toBe(150);
    expect(await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').enemies.includes(window.leaderEnemy))).toBe(false);
    await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').player.teleport(0, 0));
    await expect.poll(async () => (await crownState()).id).toBe('player');
    const after = await crownState();
    expect(after).toMatchObject({ id: 'player', visible: true, x: 0, y: -80, leaderX: 0, leaderY: 0, worldCrownCount: 1 });
    expect(overlaps(after.crownBounds, after.valueBounds), 'player leader crown does not cover its number').toBe(false);
    await page.waitForTimeout(300);
    const frames = await page.evaluate(() => {
        window.__PHASER_GAME__.scene.getScene('GameScene').events.off('postupdate', window.recordCrownFrame);
        return window.crownFrames;
    });
    expect(frames.length).toBeGreaterThan(5);
    expect(frames.some(frame => frame.scale > 1.2), 'leader transfer pulse was observed').toBe(true);
    expect(frames.every(frame => !frame.orphan), 'a visible crown always has a living leader').toBe(true);
    expect(Math.min(...frames.map(frame => frame.gap)), 'even the pulse stays above the numeric label').toBeGreaterThanOrEqual(1);
    await capture(page, 'LV4-player-leader-no-orphan');
});

test('LV5 BE,BB,BD,Y: portrait-landscape-portrait resize retains exactly one ranking panel and all visible UI bounds stay disjoint', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    try {
        await boot(page);
        await startGame(page, { value: 10, freeze: true });
        await page.evaluate(() => {
            const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
            window.__NUMBER_SNAKE_DEBUG__.spawnBoss();
            scene.boss.body.body.reset(1000, -600); scene.boss.body.body.moves = false;
        });
        for (const [width, height] of [[390, 844], [844, 390], [390, 844]]) {
            await page.setViewportSize({ width, height });
            await page.waitForFunction(({ width, height }) => {
                const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
                return scene.scale.width === width && scene.scale.height === height;
            }, { width, height });
            await page.waitForTimeout(100);
            const layout = await page.evaluate(() => {
                const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
                const bounds = { ...scene.getLayoutBounds(), value: scene.hud.getValueBounds() };
                return { bounds, panels: scene.children.list.filter(object => object.type === 'Container' && object.list.some(child => child.type === 'Text' && child.text === '競技排名')).length, controls: [scene.joystick.base.visible, scene.hud.boostButton.visible, scene.hud.magnetButton.visible], bossVisible: scene.bossIndicator.getState().visible };
            });
            expect(layout.panels).toBe(1); expect(layout.controls).toEqual([true, true, true]); expect(layout.bossVisible).toBe(true);
            const bounds = Object.entries(layout.bounds).filter(([, rect]) => rect && rect.width > 0 && rect.height > 0);
            for (let index = 0; index < bounds.length; index++) {
                const [name, rect] = bounds[index]; within(rect, width, height, `${name} ${width}x${height}`);
                for (let other = index + 1; other < bounds.length; other++) expect(overlaps(rect, bounds[other][1]), `${name}/${bounds[other][0]} ${width}x${height}`).toBe(false);
            }
            await capture(page, `LV5-resize-${width}x${height}`);
        }
        await clickButton(page, 'GameScene', 'hud.magnetButton', { tap: true });
        await expect.poll(() => page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getMagnetState())).toBe('ACTIVE');
    } finally { await context.close(); }
});

test('LV6 CO3,G: real denied preference/cosmetic Storage reads and writes keep the UI and live gameplay usable without erasing progress', async ({ page }) => {
    const progression = { version: 1, highestUnlockedLevel: 3, maxHPBonus: 2, claimedRewards: ['level-1-clear-heart', 'level-2-clear-heart'], bestScoreByLevel: { 2: 777 } };
    await boot(page, { save: { number_snake_progression: progression, number_snake_cosmetics_v1: { version: 1, selectedHeadSkin: 'mecha' } } });
    await page.evaluate(() => {
        const storage = window.localStorage, get = Storage.prototype.getItem, set = Storage.prototype.setItem;
        window.deniedStorageCalls = { reads: 0, writes: 0 };
        Storage.prototype.getItem = function (key) {
            if (this === storage && ['number_snake_visual_preferences_v1', 'number_snake_cosmetics_v1'].includes(key)) { window.deniedStorageCalls.reads++; throw new DOMException('fixture denied local preference read', 'SecurityError'); }
            return get.call(this, key);
        };
        Storage.prototype.setItem = function (key, value) {
            if (this === storage) { window.deniedStorageCalls.writes++; throw new DOMException('fixture denied localStorage write', 'QuotaExceededError'); }
            return set.call(this, key, value);
        };
        window.restoreDeniedStorage = () => { Storage.prototype.getItem = get; Storage.prototype.setItem = set; };
    });
    try {
        await clickButton(page, 'MenuScene', 'customizeBtn');
        expect(await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('CustomizeScene').styleNameText.text)).toBe('經典圓眼');
        await clickButton(page, 'CustomizeScene', 'nextSkinBtn');
        await clickButton(page, 'CustomizeScene', 'equipSkinBtn');
        await clickButton(page, 'CustomizeScene', 'opponentSpecifiedBtn');
        await clickButton(page, 'CustomizeScene', 'lowEffectsBtn');
        const texts = await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('CustomizeScene').children.list.filter(object => object.type === 'Text').map(object => object.text));
        expect(texts).toContain('已裝備'); expect(texts).toContain('低特效: 開');
        await capture(page, 'LV6-denied-storage-settings');
        await clickButton(page, 'CustomizeScene', 'backBtn');
        await clickButton(page, 'MenuScene', 'startBtn_1');
        await clickButton(page, 'PrepScene', 'startLevelBtn');
        await page.waitForFunction(() => window.__NUMBER_SNAKE_DEBUG__?.getGameState() === 'RUNNING');
        await page.evaluate(() => {
            const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
            scene.stopSpawning(); scene.hardReset(); scene.player.teleport(0, 0); scene.player.head.body.moves = false;
            scene.spawnTimer = 9999999; scene.lastEdibleCheckTime = 999999999; scene.lastRescueTime = 999999999;
        });
        expect(await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getMaxHP())).toBe(5);
        expect(await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getProgression().bestScoreByLevel[2])).toBe(777);
        await fixtureEnemy(page, { value: 3, x: 0, y: 0 });
        await expect.poll(async () => (await sceneState(page)).value).toBe(8);
        expect((await sceneState(page)).state).toBe('RUNNING');
        const rejected = await page.evaluate(() => window.deniedStorageCalls);
        expect(rejected.reads).toBeGreaterThan(1); expect(rejected.writes).toBeGreaterThan(1);
    } finally { await page.evaluate(() => window.restoreDeniedStorage()); }
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('number_snake_progression')))).toEqual(progression);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('number_snake_cosmetics_v1')).selectedHeadSkin)).toBe('mecha');
});

test('LV7: actual WebGL snapshot keeps curved player and six mixed-texture AI body cores filled', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page); await startGame(page, { value: 50, freeze: true });
    await page.evaluate(() => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
        scene.bossSpawned = true;
        scene.player.seedPathForTest([{ x: 0, y: 0 }, { x: 0, y: 80 }, { x: -30, y: 145 }, { x: 0, y: 210 }]);
        scene.player.head.body.moves = false;
        scene.physics.world.drawDebug = false; scene.physics.world.debugGraphic?.clear();
    });
    for (const [row, y] of [-105, 75, 245].entries()) for (const [side, x] of [-115, 115].entries()) {
        const index = row * 2 + side, direction = row === 2 ? -1 : 1;
        await fixtureEnemy(page, { value: [5, 10, 25, 40, 60, 80][index], x, y, skin: skins[index], points: [{ x, y }, { x: Math.sign(x) * 155, y: y + direction * 30 }, { x: Math.sign(x) * 153, y: y + direction * 72 }] });
    }
    await page.waitForTimeout(300);
    const snapshot = await page.evaluate(() => new Promise((resolve, reject) => {
        const game = window.__PHASER_GAME__, scene = game.scene.getScene('GameScene'), camera = scene.cameras.main;
        // The snapshot is produced by Phaser's actual renderer. Only its returned
        // image is drawn into a NEW readback canvas; the game canvas is never painted.
        game.renderer.snapshot(image => {
            try {
                const readback = document.createElement('canvas');
                readback.width = image.width; readback.height = image.height;
                const context = readback.getContext('2d', { willReadFrequently: true });
                context.drawImage(image, 0, 0);
                const pixels = context.getImageData(0, 0, readback.width, readback.height).data;
                const sx = readback.width / game.scale.width, sy = readback.height / game.scale.height;
                const actors = [{ id: 'player', snake: scene.player, head: scene.player.head, radius: 20, key: 'player_body' }, ...scene.enemies.map(enemy => ({ id: enemy.arenaId, snake: enemy, head: enemy.body, radius: 18, key: 'enemy_body' }))];
                const ui = Object.entries(scene.getLayoutBounds()).filter(([, rect]) => rect && rect.width > 0 && rect.height > 0).map(([name, rect]) => ({ name, ...rect }));
                const sections = [], actorCounts = [];
                for (const actor of actors) {
                    const headSource = actor.head.texture.getSourceImage();
                    const headAlpha = headSource.getContext('2d').getImageData(0, 0, headSource.width, headSource.height).data;
                    const headTransform = actor.head.getWorldTransformMatrix();
                    const visible = actor.snake.bodySprites.filter(sprite => sprite.visible && sprite.active);
                    actorCounts.push({ id: actor.id, visibleSections: visible.length, nonTailSections: visible.filter(sprite => sprite.texture.key === actor.key).length });
                    for (const [index, sprite] of visible.entries()) {
                        if (sprite.texture.key !== actor.key) continue; // Tapered directional tail is not a circular body section.
                        const point = camera.matrix.transformPoint(sprite.x, sprite.y), radius = 4;
                        const cx = point.x * sx, cy = point.y * sy;
                        let tested = 0, filled = 0, occludedByHead = 0, occludedByThreat = 0;
                        const darkPixels = [];
                        for (let py = Math.ceil(cy - radius * sy); py <= Math.floor(cy + radius * sy); py++) for (let px = Math.ceil(cx - radius * sx); px <= Math.floor(cx + radius * sx); px++) {
                            const dx = (px + .5 - cx) / sx, dy = (py + .5 - cy) / sy;
                            if (dx * dx + dy * dy > radius * radius) continue;
                            // Only alpha from the actual head art masks legal occlusion.
                            // Its drop shadow/accessories extend beyond the collider radius.
                            // This asset alpha never contributes a passing body pixel.
                            const world = camera.matrix.applyInverse((px + .5) / sx, (py + .5) / sy);
                            // The high-threat diamond deliberately overlays the first
                            // section. Its conservative glyph region is excluded from
                            // body-colour coverage; later circular sections remain tested.
                            if (index === 0 && actor.snake.currentThreatType === 3 && actor.snake.glow?.visible && Math.abs(world.x - actor.head.x) + Math.abs(world.y - actor.head.y) <= 34) { occludedByThreat++; continue; }
                            const local = headTransform.applyInverse(world.x, world.y);
                            const hx = Math.floor(local.x + actor.head.displayOriginX + actor.head.frame.cutX), hy = Math.floor(local.y + actor.head.displayOriginY + actor.head.frame.cutY);
                            if (hx >= 0 && hy >= 0 && hx < headSource.width && hy < headSource.height && headAlpha[(hy * headSource.width + hx) * 4 + 3] > 5) { occludedByHead++; continue; }
                            const offset = (py * readback.width + px) * 4;
                            const [r, g, b, a] = pixels.slice(offset, offset + 4);
                            // Body bases are teal (20,143,172) and gray (77,100,123).
                            // The glossy sections also cast teal shadows on neighbours
                            // (e.g. 24,66,84); these are body pixels. The missing shards'
                            // arena colour (8,22,36) fails all three lower/hue bounds.
                            const isBody = actor.id === 'player' ? r <= 140 && g >= 55 && b >= 75 && b - r >= 30 : r >= 55 && r <= 145 && g >= 75 && g <= 170 && b >= 95 && b <= 190 && b - r >= 20 && g - r >= 10;
                            tested++;
                            if (a >= 240 && isBody) filled++; else if (darkPixels.length < 8) darkPixels.push({ x: px, y: py, rgba: [r, g, b, a] });
                        }
                        sections.push({ actor: actor.id, index, key: sprite.texture.key, rotation: sprite.rotation, scaleY: sprite.scaleY, center: { x: point.x, y: point.y }, radius, tested, filled, occludedByHead, occludedByThreat, coverage: tested ? filled / tested : null, darkPixels, uiCover: ui.filter(rect => point.x + radius > rect.x && point.x - radius < rect.x + rect.width && point.y + radius > rect.y && point.y - radius < rect.y + rect.height).map(rect => rect.name) });
                    }
                }
                resolve({ build: window.__NUMBER_SNAKE_BUILD__, rendererType: game.renderer.type, state: scene.gameState, playerValue: scene.player.value, enemyValues: scene.enemies.map(enemy => enemy.value), actorCounts, width: readback.width, height: readback.height, sections, image: readback.toDataURL('image/png') });
            } catch (error) { reject(error); }
        });
    }));
    const renderedImage = Buffer.from(snapshot.image.split(',')[1], 'base64');
    delete snapshot.image;
    if (evidence) {
        fs.mkdirSync(evidence, { recursive: true });
        fs.writeFileSync(`${evidence}/LV7-renderer-snapshot.png`, renderedImage);
        fs.writeFileSync(`${evidence}/LV7-renderer-coverage.json`, JSON.stringify(snapshot, null, 2));
    }
    await info.attach('actual-renderer-snapshot', { body: renderedImage, contentType: 'image/png' });
    await info.attach('body-core-coverage', { body: JSON.stringify(snapshot, null, 2), contentType: 'application/json' });
    await capture(page, 'LV7-actual-curved-game');
    expect(snapshot.rendererType, 'The regression exercises the WebGL renderer').toBe(2);
    expect(snapshot.state).toBe('RUNNING'); expect(snapshot.playerValue).toBe(50);
    expect(snapshot.enemyValues).toEqual([5, 10, 25, 40, 60, 80]);
    expect(snapshot.actorCounts).toHaveLength(7);
    expect(snapshot.actorCounts[0]).toEqual({ id: 'player', visibleSections: 12, nonTailSections: 11 });
    for (const actor of snapshot.actorCounts) expect(actor.nonTailSections).toBeGreaterThanOrEqual(4);
    for (const section of snapshot.sections) {
        expect(section.uiCover, `${section.actor} section ${section.index} is not obscured by UI`).toEqual([]);
        if (section.index > 0) expect(section.tested, `${section.actor} section ${section.index} has actual unoccluded core pixels`).toBeGreaterThan(20);
        if (section.tested > 0) expect.soft(section.coverage, `${section.actor} section ${section.index}: real rendered radius-4 disk is at least 90% body colour`).toBeGreaterThanOrEqual(.9);
        else expect(section.occludedByHead + section.occludedByThreat, `${section.actor} first core is covered by real head or threat art`).toBeGreaterThan(0);
    }
});
