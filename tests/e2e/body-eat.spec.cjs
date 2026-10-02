const { test, expect } = require('playwright/test');
const { boot, startGame, fixtureEnemy, sceneState, seedPlayer } = require('./helpers.cjs');

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.bodyEatErrors = errors;
});
test.afterEach(async ({ page }) => expect(page.bodyEatErrors).toEqual([]));

for (const section of ['body', 'tail']) {
  test(`smaller ordinary AI ${section} contact eats once and converts its original path`, async ({ page }) => {
    await boot(page);
    await startGame(page, { value: 15, freeze: true });
    await fixtureEnemy(page, { value: 9, x: 200, y: 0, points: [{ x: 200, y: 0 }, { x: 0, y: 0 }] });
    const setup = await page.evaluate(section => {
      const s = window.__PHASER_GAME__.scene.getScene('GameScene');
      const path = window.fixtureEnemy.getVisiblePath();
      const tip = path.at(-1);
      const point = section === 'tail' ? tip : { x: 200 + (tip.x - 200) * .7, y: 0 };
      const observe = () => {
        if (s.player.value !== 24) return;
        window.bodyEatConsumed = { value: s.player.value, hp: s.player.hp, score: s.hud.getScore(), combo: s.comboCount,
          enemies: s.enemies.length, recoil: s.bodyRecoilCount, drops: s.snakeDropCount,
          orbs: s.orbs.map(o => ({ x: o.sprite.x, y: o.sprite.y, reward: o.reward, canCollect: o.canCollect })) };
        s.events.off('postupdate', observe);
        // Prepare the next observation away from drops, after recording the real eat frame.
        s.player.teleport(400, 300);
      };
      s.events.on('postupdate', observe);
      s.player.teleport(point.x, point.y + 20);
      return { path, point, headDistance: Math.hypot(200 - point.x, point.y + 20) };
    }, section);
    expect(setup.headDistance).toBeGreaterThan(65); // Outside head collision and eat assist.
    await expect.poll(async () => (await sceneState(page)).value).toBe(24);
    const consumed = await page.evaluate(() => window.bodyEatConsumed);
    expect(consumed).toMatchObject({ value: 24, hp: 3, score: 9, combo: 1, enemies: 0, recoil: 0, drops: 1 });
    expect(consumed.orbs.length).toBeGreaterThan(3);
    expect(consumed.orbs.every(o => o.x >= setup.path.at(-1).x - .1 && o.x <= 200 && Math.abs(o.y) < .1)).toBe(true);
    const dropX = consumed.orbs.map(o => o.x);
    expect(Math.max(...dropX) - Math.min(...dropX)).toBeGreaterThan(60);
    expect(Math.min(...dropX)).toBeCloseTo(setup.path.at(-1).x, 3);
    expect(consumed.orbs.every(o => !o.canCollect && o.reward.value === 0)).toBe(true);
    expect(consumed.orbs.reduce((sum, o) => sum + o.reward.score, 0)).toBe(50);
    expect(consumed.orbs.reduce((sum, o) => sum + o.reward.energy, 0)).toBe(10);
    await page.waitForTimeout(500);
    expect((await sceneState(page)).value).toBe(24);
    expect((await sceneState(page)).score).toBe(9);
    expect(await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').snakeDropCount)).toBe(1);
  });
}

for (const value of [10, 11]) {
  test(`equal/larger AI ${value} tail still rebounds without rewards or damage`, async ({ page }) => {
    await boot(page);
    await startGame(page, { value: 10, freeze: true });
    await fixtureEnemy(page, { value, x: 200, y: 0, points: [{ x: 200, y: 0 }, { x: 0, y: 0 }] });
    await page.evaluate(() => {
      const s = window.__PHASER_GAME__.scene.getScene('GameScene');
      const tip = window.fixtureEnemy.getVisiblePath().at(-1);
      s.player.teleport(tip.x, tip.y + 20);
    });
    await expect.poll(() => page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').bodyRecoilCount)).toBe(1);
    expect(await sceneState(page)).toMatchObject({ value: 10, hp: 3, score: 0, enemies: 1, orbs: 0 });
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').bodyRecoilCount)).toBe(1);
  });
}

test('two smaller touching tails are eaten on consecutive frames without a 450ms lock', async ({ page }) => {
  await boot(page);
  await startGame(page, { value: 15, freeze: true });
  await fixtureEnemy(page, { value: 9, x: 200, y: 0, points: [{ x: 200, y: 0 }, { x: 0, y: 0 }] });
  await fixtureEnemy(page, { value: 8, x: 200, y: 20, points: [{ x: 200, y: 20 }, { x: 0, y: 20 }] });
  const expected = await page.evaluate(() => {
    const s = window.__PHASER_GAME__.scene.getScene('GameScene');
    const values = s.enemies.slice().sort((a, b) => a.arenaId.localeCompare(b.arenaId)).map(e => e.value);
    window.bodyEatFrames = [];
    let lastValue = s.player.value, frame = 0;
    s.events.on('postupdate', () => {
      frame++;
      if (s.player.value !== lastValue) {
        window.bodyEatFrames.push({ value: s.player.value, frame, enemies: s.enemies.length });
        lastValue = s.player.value;
        if (!s.enemies.length) {
          window.bodyEatResult = { frames: window.bodyEatFrames, drops: s.snakeDropCount, combo: s.comboCount, recoil: s.bodyRecoilCount,
            score: s.hud.getScore(), reward: s.orbs.reduce((sum, o) => sum + o.reward.score, 0), cooling: s.bodyCollisions.isCoolingDown('player', s.time.now) };
          s.player.teleport(400, 300);
        }
      }
    });
    s.player.teleport(96, 10);
    return { values: [15 + values[0], 32], score: values[0] + 2 * values[1] };
  });
  await expect.poll(async () => (await sceneState(page)).value).toBe(32);
  const result = await page.evaluate(() => window.bodyEatResult);
  expect(result.frames.map(f => f.value)).toEqual(expected.values);
  expect(result.frames.map(f => f.enemies)).toEqual([1, 0]);
  expect(result.frames[1].frame - result.frames[0].frame).toBe(1);
  expect(result).toMatchObject({ drops: 2, combo: 2, recoil: 0, score: expected.score, reward: 100, cooling: false });
});

test('a smaller AI head touching player body still rebounds instead of being consumed', async ({ page }) => {
  await boot(page);
  await startGame(page, { value: 15, freeze: true });
  await seedPlayer(page, [{ x: 200, y: 0 }, { x: -200, y: 0 }]);
  await fixtureEnemy(page, { value: 9, x: 100, y: 20 });
  await expect.poll(() => page.evaluate(() => window.fixtureEnemy.isRecoiling)).toBe(true);
  expect(await sceneState(page)).toMatchObject({ value: 15, hp: 3, score: 0, enemies: 1, orbs: 0 });
});

test('body consumption discards the same eaten AI pending reverse body contact', async ({ page }) => {
  await boot(page);
  await startGame(page, { value: 15, freeze: true });
  await fixtureEnemy(page, { value: 9, x: 200, y: 0, points: [{ x: 200, y: 0 }, { x: 0, y: 0 }] });
  // Both heads touch the other snake's deployed body, away from head-to-head contact.
  await seedPlayer(page, [{ x: 92, y: 20 }, { x: 250, y: 20 }]);
  await expect.poll(async () => (await sceneState(page)).value).toBe(24);
  expect(await sceneState(page)).toMatchObject({ hp: 3, enemies: 0, recoil: false });
  expect(await page.evaluate(() => {
    const s = window.__PHASER_GAME__.scene.getScene('GameScene');
    return { recoil: s.bodyRecoilCount, drops: s.snakeDropCount };
  })).toEqual({ recoil: 0, drops: 1 });
});

test('a recent larger-body rebound does not block eating a different smaller tail', async ({ page }, info) => {
  await boot(page);
  await startGame(page, { value: 15, freeze: true });
  await fixtureEnemy(page, { value: 9, x: 200, y: 100, points: [{ x: 200, y: 100 }, { x: 0, y: 100 }] });
  await page.evaluate(() => {
    const s = window.__PHASER_GAME__.scene.getScene('GameScene'), smaller = window.fixtureEnemy;
    let bouncedAt;
    const observe = () => {
      if (bouncedAt === undefined) {
        if (s.bodyRecoilCount !== 1) return;
        bouncedAt = s.time.now;
        window.recentBodyRebound = { cooling: s.bodyCollisions.isCoolingDown('player', bouncedAt), value: s.player.value };
        // Prepare the second contact in the first actual rebound frame, before browser RPC latency can consume the cooldown.
        const tip = smaller.getVisiblePath().at(-1);
        s.player.teleport(tip.x, tip.y + 20);
      } else if (s.player.value === 24) {
        window.recentBodyEat = { cooling: s.bodyCollisions.isCoolingDown('player', s.time.now),
          elapsedMs: s.time.now - bouncedAt, recoil: s.bodyRecoilCount, drops: s.snakeDropCount,
          value: s.player.value, hp: s.player.hp, score: s.hud.getScore(),
          headDistance: Math.hypot(smaller.body.x - s.player.head.x, smaller.body.y - s.player.head.y) };
        s.events.off('postupdate', observe);
        s.player.teleport(400, 300);
      }
    };
    s.events.on('postupdate', observe);
    s.player.teleport(0, 20);
  });
  await fixtureEnemy(page, { value: 50, x: 200, y: 0, points: [{ x: 200, y: 0 }, { x: -100, y: 0 }] });
  await expect.poll(() => page.evaluate(() => !!window.recentBodyEat)).toBe(true);
  const result = await page.evaluate(() => ({ rebound: window.recentBodyRebound, eat: window.recentBodyEat }));
  await info.attach('eat-during-real-rebound-cooldown', { body: JSON.stringify(result), contentType: 'application/json' });
  expect(result.rebound).toEqual({ cooling: true, value: 15 });
  expect(result.eat).toMatchObject({ cooling: true, recoil: 1, drops: 1, value: 24, hp: 3, score: 9 });
  expect(result.eat.elapsedMs).toBeGreaterThan(0);
  expect(result.eat.elapsedMs).toBeLessThan(450);
  expect(result.eat.headDistance).toBeGreaterThan(65);
});

test('active magnet and native steering meet a smaller tail before head contact without a rebound cycle', async ({ page }, info) => {
  await boot(page);
  await startGame(page, { value: 65, freeze: true });
  await fixtureEnemy(page, { value: 50, x: 300, y: 60, points: [{ x: 300, y: 60 }, { x: 0, y: 60 }] });
  const setup = await page.evaluate(() => {
    const s = window.__PHASER_GAME__.scene.getScene('GameScene'), e = window.fixtureEnemy;
    s.player.teleport(160, 0);
    s.player.currentAngle = Math.PI / 2;
    s.player.targetAngle = Math.PI / 2;
    window.magnetBodySamples = [];
    const observe = () => {
      if (e.body.active && s.enemies.includes(e)) {
        const velocity = e.body.body.velocity;
        window.magnetBodySamples.push({ frame: s.game.loop.frame, px: s.player.head.x, py: s.player.head.y,
          x: e.body.x, y: e.body.y, vx: velocity.x, vy: velocity.y, speed: Math.hypot(velocity.x, velocity.y),
          state: s.magnet.state, headDistance: Math.hypot(e.body.x - s.player.head.x, e.body.y - s.player.head.y) });
      } else if (s.player.value === 115) {
        window.magnetBodyEat = { distance: Math.hypot(e.body.x - s.player.head.x, e.body.y - s.player.head.y),
          drops: s.snakeDropCount, recoil: s.bodyRecoilCount, state: s.magnet.state, hp: s.player.hp,
          enemies: s.enemies.length, score: s.hud.getScore(), playerRecoil: s.player.isRecoiling,
          player: { x: s.player.head.x, y: s.player.head.y }, enemy: { x: e.body.x, y: e.body.y }, samples: window.magnetBodySamples };
        s.events.off('postupdate', observe);
        s.player.head.body.moves = false;
        s.player.teleport(400, 300);
      }
    };
    s.events.on('postupdate', observe);
    return { length: e.pathLength, tip: e.getVisiblePath().at(-1), headDistance: Math.hypot(140, 60) };
  });
  expect(setup.length).toBeCloseTo(36 + 24 * Math.sqrt(50), 3);
  expect(setup.tip.x).toBeLessThan(160);
  expect(setup.tip.y).toBe(60);
  expect(setup.headDistance).toBeGreaterThan(65);
  await page.keyboard.press('m');
  await expect.poll(() => page.evaluate(() => {
    const s = window.__PHASER_GAME__.scene.getScene('GameScene'), e = window.fixtureEnemy;
    return s.magnet.state === 'ACTIVE' && e.body.body.velocity.x < 0 && e.body.body.velocity.y < 0
      && Math.abs(e.body.body.velocity.length() - 380) < .01;
  })).toBe(true);
  try {
    await page.keyboard.down('ArrowDown');
    await page.evaluate(() => {
      const s = window.__PHASER_GAME__.scene.getScene('GameScene');
      s.player.head.body.moves = true;
      window.fixtureEnemy.body.body.moves = true;
    });
    await expect.poll(() => page.evaluate(() => !!window.magnetBodyEat)).toBe(true);
  } finally {
    await page.keyboard.up('ArrowDown');
  }
  const hit = await page.evaluate(() => window.magnetBodyEat);
  await info.attach('native-magnet-body-contact', { body: JSON.stringify({ setup, hit }, null, 2), contentType: 'application/json' });
  expect(hit.distance).toBeGreaterThan(65);
  expect(hit).toMatchObject({ drops: 1, recoil: 0, state: 'ACTIVE', hp: 3, enemies: 0, score: 50, playerRecoil: false });
  expect(hit.player.y).toBeGreaterThan(20);
  expect(Math.hypot(hit.enemy.x - 300, hit.enemy.y - 60)).toBeGreaterThan(10);
  const pulled = hit.samples.filter(sample => sample.state === 'ACTIVE' && Math.abs(sample.speed - 380) < .01
    && sample.vx < 0 && sample.vy < 0 && Math.hypot(sample.x - 300, sample.y - 60) > 1);
  expect(pulled.length).toBeGreaterThanOrEqual(2);
  expect(pulled.every(sample => sample.headDistance > 65)).toBe(true);
  expect((await sceneState(page)).value).toBe(115);
  expect(await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('GameScene').bodyRecoilCount)).toBe(0);
});
