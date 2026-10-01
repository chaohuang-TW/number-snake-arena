const { test, expect } = require('playwright/test');
const { boot, startGame, sceneState, fixtureEnemy, buttonPoint, clickButton, realBossContact } = require('./helpers.cjs');

// Restores behavioral coverage removed with a291da6's monolithic A–BZ suite.
// Fixtures only initialize world state; results come from ordinary game frames/input.
let browserErrors;
test.beforeEach(async ({ page }) => {
  browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
});
test.afterEach(() => expect(browserErrors, 'game loop has no browser exceptions').toEqual([]));

for (const [value, hp, state] of [[80, 2, 'RUNNING'], [60, 1, 'RUNNING'], [30, 3, 'GAME_OVER']]) {
  test(`legacy D: Boss100 live contact at player ${value} yields HP ${hp} and ${state}`, async ({ page }) => {
    await boot(page);
    await realBossContact(page, { value });
    await expect.poll(async () => {
      const snapshot = await sceneState(page);
      return state === 'GAME_OVER' ? snapshot.state : snapshot.hp;
    }).toBe(state === 'GAME_OVER' ? state : hp);
    const snapshot = await sceneState(page);
    expect(snapshot.value).toBe(value);
    expect(snapshot.hp).toBe(hp);
    expect(snapshot.state).toBe(state);
    expect(snapshot.targetLength).toBeCloseTo(36 + 24 * Math.sqrt(value));
  });
}

test('damage invulnerability lasts 1200ms, then another live Boss contact damages again', async ({ page }) => {
  await boot(page);
  await startGame(page, { value: 80, freeze: true });
  await page.evaluate(() => {
    const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
    window.damageEvents = [];
    window.protectedFrames = [];
    let previousHP = scene.player.hp;
    window.recordDamage = () => {
      if (scene.player.hp !== previousHP) {
        window.damageEvents.push({ time: scene.time.now, hp: scene.player.hp, invulnerable: scene.player.isInvulnerable });
        previousHP = scene.player.hp;
      }
      if (window.damageEvents.length === 1) {
        window.protectedFrames.push({ elapsed: scene.time.now - window.damageEvents[0].time, hp: scene.player.hp, invulnerable: scene.player.isInvulnerable });
      }
    };
    scene.events.on('postupdate', window.recordDamage);
    window.__NUMBER_SNAKE_DEBUG__.spawnBoss();
    scene.boss.body.body.reset(0, 0);
    scene.boss.body.body.moves = false;
  });
  // The browser records every game frame, so delayed test polling cannot consume
  // part of the 1200ms protection period before its assertions begin.
  await expect.poll(() => page.evaluate(() => window.damageEvents.length), { timeout: 8000, intervals: [20] }).toBeGreaterThanOrEqual(2);
  const { events, protectedFrames } = await page.evaluate(() => ({ events: window.damageEvents, protectedFrames: window.protectedFrames }));
  expect(events.slice(0, 2).map(event => event.hp)).toEqual([2, 1]);
  expect(events[0].invulnerable).toBe(true);
  const protectedAt700 = protectedFrames.find(frame => frame.elapsed >= 700);
  expect(protectedAt700, 'live overlapping Boss contact stays harmless after 700ms of game time').toBeDefined();
  expect(protectedAt700.elapsed).toBeLessThan(1180);
  expect(protectedAt700.hp).toBe(2);
  expect(protectedAt700.invulnerable).toBe(true);
  expect(protectedFrames.filter(frame => frame.elapsed < 1180).every(frame => frame.hp === 2 && frame.invulnerable)).toBe(true);
  expect(events[1].time - events[0].time).toBeGreaterThanOrEqual(1180);
  expect(events[1].time - events[0].time).toBeLessThan(1400);
  await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').events.off('postupdate', window.recordDamage));
});

test('legacy BS: Ultimate500 strict 499/500/501, named dash/orbit attacks, active attack cancellation', async ({ page }) => {
  await boot(page);
  await startGame(page, { level: 4, value: 499, freeze: true });
  await page.evaluate(() => {
    const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
    window.__NUMBER_SNAKE_DEBUG__.spawnUltimateBossForTest();
    scene.ultimateBoss.body.body.moves = false;
    window.ultimateStates = [];
    window.recordUltimateState = () => {
      const state = scene.ultimateBoss?.state;
      if (state && window.ultimateStates.at(-1) !== state) window.ultimateStates.push(state);
    };
    scene.events.on('postupdate', window.recordUltimateState);
  });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getUltimateBoss().state)).toBe('CHASE');
  await expect.poll(() => page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getCrownHolderId())).toBe('ultimate_boss');
  expect(await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').worldCrown.visible)).toBe(true);
  await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.setPlayerValue(500));
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getUltimateBoss().state)).toBe('CHASE');
  await expect.poll(() => page.evaluate(() => window.ultimateStates.includes('ORBIT')), { timeout: 12000, intervals: [50] }).toBe(true);
  const states = await page.evaluate(() => window.ultimateStates);
  for (const state of ['CHASE', 'DASH_TELEGRAPH', 'DASH', 'ORBIT_TELEGRAPH', 'ORBIT']) expect(states).toContain(state);
  expect(states).not.toContain('FLEE');
  await expect.poll(() => page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getUltimateBoss().state), { timeout: 9000, intervals: [20] }).toBe('DASH');
  await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.setPlayerValue(501));
  await expect.poll(() => page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getUltimateBoss().state), { intervals: [20] }).toBe('FLEE');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getUltimateBoss().state)).toBe('FLEE');
  await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').events.off('postupdate', window.recordUltimateState));
});

test('legacy BT/BJ: Ultimate500 moves safely at every corner and locator points both ways then hides on-screen', async ({ page }) => {
  await boot(page);
  await startGame(page, { level: 4, value: 499, freeze: true });
  await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.spawnUltimateBossForTest());
  for (const value of [499, 501]) {
    await page.evaluate(value => window.__NUMBER_SNAKE_DEBUG__.setPlayerValue(value), value);
    for (const [x, y] of [[-1350, -950], [1350, -950], [-1350, 950], [1350, 950]]) {
      await page.evaluate(({ x, y }) => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
        scene.ultimateBoss.body.body.moves = true;
        scene.ultimateBoss.body.body.reset(x, y);
      }, { x, y });
      await page.waitForTimeout(250);
      const boss = await page.evaluate(() => {
        const boss = window.__NUMBER_SNAKE_DEBUG__.getUltimateBoss();
        return { x: boss.body.x, y: boss.body.y, vx: boss.body.body.velocity.x, vy: boss.body.body.velocity.y, state: boss.state };
      });
      for (const number of [boss.x, boss.y, boss.vx, boss.vy]) expect(Number.isFinite(number)).toBe(true);
      expect(Math.abs(boss.x)).toBeLessThanOrEqual(1100);
      expect(Math.abs(boss.y)).toBeLessThanOrEqual(700);
      expect(Math.hypot(boss.vx, boss.vy)).toBeGreaterThan(50);
      expect(boss.state === 'FLEE').toBe(value === 501);
    }
  }
  const indicators = [];
  for (const x of [1000, -1000]) {
    await page.evaluate(x => {
      const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
      scene.player.teleport(0, 0);
      scene.ultimateBoss.body.body.moves = false;
      scene.ultimateBoss.body.body.reset(x, -500);
    }, x);
    await page.waitForTimeout(100);
    const indicator = await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getBossIndicatorState());
    expect(indicator.visible).toBe(true);
    expect(indicator.value).toBe(500);
    expect(indicator.text).toContain('500');
    indicators.push(indicator);
  }
  expect(Math.cos(indicators[0].angle)).toBeGreaterThan(0);
  expect(Math.cos(indicators[1].angle)).toBeLessThan(0);
  expect(indicators[1].x).toBeLessThan(indicators[0].x);
  await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getUltimateBoss().body.body.reset(200, 0));
  await expect.poll(() => page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getBossIndicatorState().visible)).toBe(false);
});

test('legacy BA/S/BF: live score and KO save a new best, retain older best, reload and replay reset', async ({ page }) => {
  await boot(page);
  // One-time setup: no addInitScript seed that would overwrite the real save on reload.
  await page.evaluate(() => localStorage.setItem('number_snake_progression', JSON.stringify({ version: 1, highestUnlockedLevel: 1, maxHPBonus: 0, claimedRewards: [], bestScoreByLevel: { 1: 5 } })));
  async function eatAt(value, x) {
    const before = await sceneState(page);
    await page.evaluate(x => window.__PHASER_GAME__.scene.getScene('GameScene').player.teleport(x, 0), x);
    await fixtureEnemy(page, { value, x, y: 0 });
    await expect.poll(async () => (await sceneState(page)).value).toBe(before.value + value);
    await page.evaluate(x => window.__PHASER_GAME__.scene.getScene('GameScene').player.teleport(x + 150, 0), x);
  }
  async function koAt(x) {
    const value = (await sceneState(page)).value;
    await page.evaluate(x => window.__PHASER_GAME__.scene.getScene('GameScene').player.teleport(x, 0), x);
    await fixtureEnemy(page, { value: value * 3, x, y: 0 });
    await expect.poll(async () => (await sceneState(page)).state).toBe('GAME_OVER');
    return page.evaluate(() => {
      const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
      return { score: scene.hud.getScore(), newBest: scene.isNewBest, submitted: scene.scoreSubmitted, crown: scene.worldCrown.visible, save: JSON.parse(localStorage.getItem('number_snake_progression')), texts: scene.children.list.filter(child => child.type === 'Text').map(child => child.text).join(' ') };
    });
  }
  await startGame(page, { value: 10, freeze: true });
  await eatAt(3, 0);
  const lower = await koAt(400);
  expect(lower.score).toBe(3);
  expect(lower.newBest).toBe(false);
  expect(lower.save.bestScoreByLevel[1]).toBe(5);
  await startGame(page, { value: 10, freeze: true });
  await eatAt(3, 0);
  await eatAt(4, 300);
  const higher = await koAt(600);
  expect(higher.score).toBe(11);
  expect(higher.newBest).toBe(true);
  expect(higher.submitted).toBe(true);
  // The first submission happened through real KO above; a later duplicate is an internal persistence invariant.
  expect(await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').saveScore())).toBe(false);
  expect(higher.crown).toBe(false);
  expect(higher.save.bestScoreByLevel[1]).toBe(11);
  expect(higher.save.highestUnlockedLevel).toBe(1);
  expect(higher.save.maxHPBonus).toBe(0);
  expect(higher.save.claimedRewards).toEqual([]);
  expect(higher.texts).toContain('刷新紀錄');
  await clickButton(page, 'GameScene', 'playAgainBtn');
  expect(await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('PrepScene').getSelectedStartValue())).toBe(5);
  await clickButton(page, 'PrepScene', 'startLevelBtn');
  const replay = await sceneState(page);
  expect(replay.value).toBe(5);
  expect(replay.hp).toBe(3);
  expect(replay.energy).toBe(100);
  expect(replay.score).toBe(0);
  expect(await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').comboCount)).toBe(0);
  expect(await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getMagnetState())).toBe('READY');
  await page.reload();
  await page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('MenuScene'));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('number_snake_progression')).bestScoreByLevel[1])).toBe(11);
  const menuText = await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('MenuScene').children.list.flatMap(child => child.list ?? [child]).filter(child => child.type === 'Text').map(child => child.text).join(' '));
  expect(menuText).toContain('11');
});

test('legacy Z/AA: 140px safe births at edges/corners and timed rescue preserves the cap of 38', async ({ page }) => {
  await boot(page);
  for (const [x, y] of [[0, 0], [-1100, 0], [1100, 0], [0, -700], [0, 700], [-1100, -700], [1100, -700], [-1100, 700], [1100, 700]]) {
    await startGame(page, { value: 5, freeze: true });
    const births = await page.evaluate(({ x, y }) => {
      const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
      scene.player.teleport(x, y);
      for (let i = 0; i < 80; i++) scene.spawnEnemy(i % 2 === 0);
      return scene.enemies.map(enemy => ({ x: enemy.body.x, y: enemy.body.y, value: enemy.value }));
    }, { x, y });
    expect(births).toHaveLength(38);
    for (const birth of births) {
      expect(Number.isFinite(birth.x) && Number.isFinite(birth.y) && Number.isFinite(birth.value)).toBe(true);
      expect(Math.abs(birth.x)).toBeLessThanOrEqual(1060);
      expect(Math.abs(birth.y)).toBeLessThanOrEqual(660);
      expect(birth.value).toBeLessThanOrEqual(99);
    }
  }
  await startGame(page, { value: 5, freeze: true });
  await page.evaluate(() => {
    const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
    for (let i = 0; i < 38; i++) scene.spawnEnemy();
    window.populationFrames = [];
    window.recordPopulation = () => window.populationFrames.push(scene.enemies.length);
    scene.events.on('postupdate', window.recordPopulation);
    // Initial expired timers force ordinary update to exercise both rescue and local assistance.
    scene.lastEatTime = scene.time.now - 7100;
    scene.lastRescueTime = scene.time.now - 10100;
    scene.lastEdibleCheckTime = scene.time.now - 2100;
    scene.spawnTimer = 0;
  });
  await page.waitForTimeout(700);
  const populations = await page.evaluate(() => window.populationFrames);
  expect(populations.length).toBeGreaterThan(5);
  expect(Math.max(...populations)).toBe(38);
  await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').events.off('postupdate', window.recordPopulation));
});

test('legacy AB: ordinary prey genuinely flee inward from a right edge and corner without freezing', async ({ page }) => {
  await boot(page);
  for (const setup of [{ x: 1150, y: 0, px: 1030, py: 0 }, { x: 1150, y: 750, px: 1050, py: 650 }]) {
    await startGame(page, { value: 50, freeze: true });
    await page.evaluate(({ px, py }) => {
      const player = window.__PHASER_GAME__.scene.getScene('GameScene').player;
      player.teleport(px, py);
      player.currentAngle = Math.PI;
      player.targetAngle = Math.PI;
    }, setup);
    await fixtureEnemy(page, { value: 10, x: setup.x, y: setup.y });
    await page.evaluate(() => { window.fixtureEnemy.body.body.moves = true; });
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.fixtureEnemy.state)).toBe(1);
    await page.waitForTimeout(700);
    const enemy = await page.evaluate(() => ({ active: window.fixtureEnemy.body.active, x: window.fixtureEnemy.body.x, y: window.fixtureEnemy.body.y, vx: window.fixtureEnemy.body.body.velocity.x, vy: window.fixtureEnemy.body.body.velocity.y }));
    expect(enemy.active).toBe(true);
    expect(enemy.x).toBeLessThan(setup.x - 10);
    if (setup.y > 0) expect(enemy.y).toBeLessThan(setup.y - 10);
    expect(Math.abs(enemy.x)).toBeLessThanOrEqual(1160);
    expect(Math.abs(enemy.y)).toBeLessThanOrEqual(760);
    expect(Math.hypot(enemy.vx, enemy.vy)).toBeGreaterThan(50);
    expect((await sceneState(page)).value).toBe(50);
  }
});

test('legacy J/X: desktop native keyboard uses 220/340 speed and recovers boost after release', async ({ page }, info) => {
  await boot(page);
  await startGame(page, { value: 10 });
  const controls = await page.evaluate(() => {
    const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
    return { joystick: scene.joystick.base.visible, boost: scene.hud.boostButton.visible };
  });
  expect(controls).toEqual({ joystick: false, boost: false });
  await expect.poll(() => page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getPlayerSpeed())).toBeCloseTo(220, 1);
  const measureLiveMotion = () => page.evaluate(() => new Promise(resolve => {
    const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
    const capture = () => ({ frame: scene.game.loop.frame, sceneTime: scene.time.now, performanceTime: performance.now(), x: scene.player.head.x, y: scene.player.head.y, speed: scene.player.head.body.speed, energy: scene.player.boostEnergy, currentAngle: scene.player.currentAngle, targetAngle: scene.player.targetAngle, space: scene.keys.space.isDown, down: scene.keys.down.isDown, state: scene.gameState });
    const start = capture(), frames = [];
    let elapsed = 0;
    const observe = (_time, delta) => {
      // Clock.now is a raw RAF timestamp; timers, steering and motion consume
      // the processed Scene delta. Record both instead of relying on wall time.
      elapsed += delta * scene.time.timeScale;
      const frame = { ...capture(), delta, elapsed };
      frames.push(frame);
      if (elapsed < 300) return;
      scene.events.off('postupdate', observe);
      resolve({ start, end: frame, elapsed, displacementY: frame.y - start.y, frames });
    };
    scene.events.on('postupdate', observe);
  }));
  let keysHeld = false;
  try {
    keysHeld = true;
    await page.keyboard.down('Space');
    await page.keyboard.down('ArrowDown');
    await page.waitForFunction(() => {
      const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
      const error = Math.atan2(Math.sin(scene.player.currentAngle - Math.PI / 2), Math.cos(scene.player.currentAngle - Math.PI / 2));
      return scene.keys.space.isDown && scene.keys.down.isDown && Math.abs(error) < 0.08;
    });
    const boosted = await measureLiveMotion();
    await info.attach('desktop-native-boost-frames', { body: JSON.stringify(boosted, null, 2), contentType: 'application/json' });
    expect(boosted.elapsed).toBeGreaterThanOrEqual(300);
    expect(boosted.elapsed).toBeLessThan(500);
    expect(boosted.frames.length).toBeGreaterThan(1);
    for (const frame of boosted.frames) {
      expect(frame.speed).toBeCloseTo(340, 1);
      expect(frame.space && frame.down && frame.state === 'RUNNING').toBe(true);
    }
    expect(boosted.end.energy).toBeLessThan(95);
    expect(boosted.end.energy).toBeLessThan(boosted.start.energy);
    expect(boosted.end.y).toBeGreaterThan(20);
    expect(boosted.displacementY).toBeGreaterThan(20);
    await page.keyboard.up('Space');
    await page.keyboard.up('ArrowDown');
    keysHeld = false;
    await expect.poll(() => page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getPlayerSpeed())).toBeCloseTo(220, 1);
    const recovered = await measureLiveMotion();
    await info.attach('desktop-native-release-frames', { body: JSON.stringify(recovered, null, 2), contentType: 'application/json' });
    expect(recovered.elapsed).toBeGreaterThanOrEqual(300);
    expect(recovered.elapsed).toBeLessThan(500);
    for (const frame of recovered.frames) {
      expect(frame.speed).toBeCloseTo(220, 1);
      expect(!frame.space && !frame.down && frame.state === 'RUNNING').toBe(true);
    }
    expect(recovered.end.energy).toBeGreaterThan(recovered.start.energy);
    expect(recovered.end.energy).toBeGreaterThan(boosted.end.energy);
  } finally {
    if (keysHeld) { await page.keyboard.up('Space'); await page.keyboard.up('ArrowDown'); }
  }
});

test('legacy K/L/W: native touch drag/up/cancel and boost 340→220 with energy recovery', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 834, height: 1194 }, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await boot(page);
    await startGame(page, { value: 10 });
    const cdp = await context.newCDPSession(page);
    const joystick = await buttonPoint(page, 'GameScene', 'joystick.base');
    expect(joystick).not.toBe(null);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: joystick.x, y: joystick.y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: joystick.x, y: joystick.y - 50, id: 1 }] });
    await page.waitForFunction(() => {
      const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
      const error = Math.atan2(Math.sin(scene.player.currentAngle + Math.PI / 2), Math.cos(scene.player.currentAngle + Math.PI / 2));
      return scene.joystick.active && Math.abs(error) < 0.08;
    });
    // Measure real movement after the snake finishes its finite turn. The interval
    // comes from game frames rather than wall time or remote command latency.
    const drag = await page.evaluate(() => new Promise(resolve => {
      const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
      const start = { time: scene.time.now, y: scene.player.head.y };
      const observe = () => {
        if (scene.time.now - start.time < 300) return;
        scene.events.off('postupdate', observe);
        resolve({ active: scene.joystick.active, dy: scene.joystick.deltaY, angle: scene.player.targetAngle, displacementY: scene.player.head.y - start.y, elapsed: scene.time.now - start.time, speed: scene.player.head.body.speed });
      };
      scene.events.on('postupdate', observe);
    }));
    expect(drag.active).toBe(true);
    expect(drag.dy).toBeLessThan(-0.5);
    expect(drag.angle).toBeCloseTo(-Math.PI / 2, 2);
    expect(drag.elapsed).toBeGreaterThanOrEqual(300);
    expect(drag.elapsed).toBeLessThan(500);
    expect(drag.speed).toBeCloseTo(220, 1);
    expect(drag.displacementY).toBeLessThan(-20);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').joystick.active)).toBe(false);
    expect(await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').joystick.deltaY)).toBe(0);
    const boost = await buttonPoint(page, 'GameScene', 'hud.boostButton');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: boost.x, y: boost.y, id: 2 }] });
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').hud.isBoostPressed)).toBe(true);
    const measureEnergy = () => page.evaluate(() => new Promise(resolve => {
      const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
      const start = { time: scene.time.now, energy: scene.player.boostEnergy };
      const observe = () => {
        if (scene.time.now - start.time < 250) return;
        scene.events.off('postupdate', observe);
        resolve({ initialEnergy: start.energy, energy: scene.player.boostEnergy, speed: scene.player.head.body.speed, elapsed: scene.time.now - start.time, pressed: scene.hud.isBoostPressed });
      };
      scene.events.on('postupdate', observe);
    }));
    const boosted = await measureEnergy();
    expect(boosted.pressed).toBe(true);
    expect(boosted.speed).toBeCloseTo(340, 1);
    expect(boosted.energy).toBeLessThan(boosted.initialEnergy);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').hud.isBoostPressed)).toBe(false);
    await expect.poll(() => page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getPlayerSpeed())).toBeCloseTo(220, 1);
    const recovered = await measureEnergy();
    expect(recovered.pressed).toBe(false);
    expect(recovered.speed).toBeCloseTo(220, 1);
    expect(recovered.energy).toBeGreaterThan(recovered.initialEnergy);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: joystick.x, y: joystick.y, id: 3 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: joystick.x - 35, y: joystick.y, id: 3 }] });
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').joystick.active)).toBe(true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').joystick.active)).toBe(false);
    const released = await page.evaluate(() => {
      const joystick = window.__PHASER_GAME__.scene.getScene('GameScene').joystick;
      return { x: joystick.deltaX, y: joystick.deltaY };
    });
    expect(released).toEqual({ x: 0, y: 0 });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('legacy G: hidden pause freezes both axes, boost/magnet/orb clocks; visible waits for one resume click', async ({ page }) => {
  await boot(page);
  await startGame(page, { value: 10 });
  await page.keyboard.down('ArrowDown');
  await page.keyboard.down('Space');
  await page.keyboard.press('m');
  await page.waitForTimeout(250);
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowDown');
  await page.evaluate(() => {
    const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
    window.pauseOrb = scene.spawnOrb(400, 0, { unlockDelay: 900, reward: { score: 1, energy: 1, value: 0 } });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => window.__PHASER_GAME__.scene.isPaused('GameScene') && window.__PHASER_GAME__.scene.isActive('PauseScene'));
  const snapshot = () => page.evaluate(() => {
    const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
    return { x: scene.player.head.x, y: scene.player.head.y, energy: scene.player.boostEnergy, magnet: scene.magnet.timer, clock: scene.time.now, collectible: window.pauseOrb.canCollect };
  });
  const before = await snapshot();
  await page.waitForTimeout(300);
  expect(await snapshot()).toEqual(before);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__PHASER_GAME__.scene.isPaused('GameScene'))).toBe(true);
  await clickButton(page, 'PauseScene', 'resumeBtn');
  await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.isPaused('GameScene'))).toBe(false);
  await page.waitForTimeout(150);
  const resumed = await snapshot();
  expect(resumed.y).toBeGreaterThan(before.y + 10);
  expect(resumed.magnet).toBeLessThan(before.magnet);
  expect(resumed.clock).toBeGreaterThan(before.clock);
  expect(await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.getPlayerSpeed())).toBeCloseTo(220, 1);
});
