const { test, expect } = require('playwright/test');
const { boot, startGame, sceneState } = require('./helpers.cjs');

const edges = [
  { name: 'right', dx: 1, dy: 0 },
  { name: 'left', dx: -1, dy: 0 },
  { name: 'bottom', dx: 0, dy: 1 },
  { name: 'top', dx: 0, dy: -1 },
  { name: 'bottom-right', dx: 1, dy: 1 },
  { name: 'top-right', dx: 1, dy: -1 },
  { name: 'bottom-left', dx: -1, dy: 1 },
  { name: 'top-left', dx: -1, dy: -1 },
];
function keysFor(dx, dy) {
  return [dx > 0 ? 'ArrowRight' : dx < 0 ? 'ArrowLeft' : null,
    dy > 0 ? 'ArrowDown' : dy < 0 ? 'ArrowUp' : null].filter(Boolean);
}
function assertInside(samples, radius, label) {
  expect(samples.length, `${label}: actual postupdate frames were recorded`).toBeGreaterThanOrEqual(12);
  expect(new Set(samples.map(sample => sample.frame)).size, `${label}: unique game frames`).toBe(samples.length);
  for (const sample of samples) {
    const context = `${label}, frame ${sample.frame}, center (${sample.x}, ${sample.y})`;
    expect([sample.x, sample.y, sample.cx, sample.cy, sample.vx, sample.vy, sample.radius].every(Number.isFinite), context).toBe(true);
    expect(sample.radius, context).toBe(radius);
    // The 64px accessory texture must share its origin with the Arcade circle.
    expect(Math.abs(sample.x - sample.cx), context).toBeLessThan(0.05);
    expect(Math.abs(sample.y - sample.cy), context).toBeLessThan(0.05);
    expect(Math.abs(sample.x) + radius, context).toBeLessThanOrEqual(1200.05);
    expect(Math.abs(sample.y) + radius, context).toBeLessThanOrEqual(800.05);
    expect(Math.abs(sample.cx) + radius, context).toBeLessThanOrEqual(1200.05);
    expect(Math.abs(sample.cy) + radius, context).toBeLessThanOrEqual(800.05);
    expect(sample.hp, context).toBe(3);
    expect(sample.playerValue, context).toBe(10);
    expect(sample.state, context).toBe('RUNNING');
  }
}

test('WB1: native arrows and boost hit all four walls/corners, stay radius20 inside, and turn away', async ({ page }, info) => {
  // Eight native-input sequences also run under software-rendered CI.
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await boot(page);
  await startGame(page, { value: 10, freeze: true });
  const results = [];
  try {
    for (const edge of edges) {
      const outward = keysFor(edge.dx, edge.dy);
      const inward = keysFor(-edge.dx, -edge.dy);
      const setup = { ...edge, x: edge.dx * 1170, y: edge.dy * 770 };
      await page.evaluate(setup => {
        const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
        const player = scene.player;
        player.head.body.moves = false;
        player.teleport(setup.x, setup.y);
        // Initialization only; the later escape changes direction exclusively
        // through native keyboard events and the ordinary steering/physics loop.
        player.currentAngle = player.targetAngle = Math.atan2(setup.dy, setup.dx);
        player.boostEnergy = 100;
        window.worldBoundsRun = { setup, samples: [], phase: 'setup', start: scene.time.now };
        window.worldBoundsObserver = () => {
          const run = window.worldBoundsRun;
          if (run.phase === 'setup') return;
          const body = player.head.body;
          run.samples.push({
            frame: scene.game.loop.frame, time: scene.time.now, elapsed: scene.time.now - run.start,
            phase: run.phase, x: player.head.x, y: player.head.y,
            cx: body.center.x, cy: body.center.y, radius: body.radius,
            vx: body.velocity.x, vy: body.velocity.y, energy: player.boostEnergy,
            hp: player.hp, playerValue: player.value, state: scene.gameState,
          });
        };
        scene.events.on('postupdate', window.worldBoundsObserver);
      }, setup);
      try {
        for (const key of outward) await page.keyboard.down(key);
        await page.keyboard.down('Space');
        await page.evaluate(() => {
          const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
          window.worldBoundsRun.phase = 'pressure';
          window.worldBoundsRun.start = scene.time.now;
          scene.player.head.body.moves = true;
        });
        await expect.poll(() => page.evaluate(() => {
          const samples = window.worldBoundsRun.samples;
          return samples.length >= 20 && samples.at(-1).elapsed >= 500;
        }), { timeout: 10000, intervals: [50] }).toBe(true);
        await page.keyboard.up('Space');
        for (const key of outward) await page.keyboard.up(key);
        for (const key of inward) await page.keyboard.down(key);
        await page.evaluate(() => { window.worldBoundsRun.phase = 'escape'; });
        await expect.poll(() => page.evaluate(() => {
          const run = window.worldBoundsRun, player = window.__PHASER_GAME__.scene.getScene('GameScene').player;
          return (!run.setup.dx || Math.abs(player.head.x) <= 1120)
            && (!run.setup.dy || Math.abs(player.head.y) <= 720)
            && run.samples.filter(sample => sample.phase === 'escape').length >= 12;
        }), { timeout: 10000, intervals: [50] }).toBe(true);
      } finally {
        for (const key of [...outward, ...inward, 'Space']) await page.keyboard.up(key);
        const result = await page.evaluate(() => {
          const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
          scene.events.off('postupdate', window.worldBoundsObserver);
          scene.player.head.body.moves = false;
          return window.worldBoundsRun;
        });
        results.push(result);
      }
      const run = results.at(-1), pressure = run.samples.filter(sample => sample.phase === 'pressure');
      assertInside(run.samples, 20, edge.name);
      expect(pressure.length).toBeGreaterThanOrEqual(20);
      expect(Math.min(...pressure.map(sample => sample.energy))).toBeLessThan(95);
      expect(pressure.some(sample => Math.hypot(sample.vx, sample.vy) > 300), 'native Space supplies boosted velocity').toBe(true);
      for (const axis of ['x', 'y']) {
        if (!setup[axis === 'x' ? 'dx' : 'dy']) continue;
        const physicalLimit = axis === 'x' ? 1180 : 780;
        expect(pressure.some(sample => Math.abs(Math.abs(sample[axis]) - physicalLimit) < 0.1), `${edge.name}: head actually touches ${axis} physical wall`).toBe(true);
        expect(Math.abs(run.samples.at(-1)[axis]), `${edge.name}: native reverse steering escapes ${axis} wall`).toBeLessThanOrEqual(physicalLimit - 60);
      }
    }
    expect((await sceneState(page)).enemies).toBe(0);
    expect((await sceneState(page)).value).toBe(10);
    expect((await sceneState(page)).hp).toBe(3);
    expect(errors).toEqual([]);
  } finally {
    await info.attach('world-bounds-native-player-frames', { body: JSON.stringify({ build: await page.evaluate(() => window.__NUMBER_SNAKE_BUILD__), results, errors }, null, 2), contentType: 'application/json' });
  }
});

test('WB2: ordinary AI radius18 stays inside every wall/corner during one 150ms outward recoil and normal recovery', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await boot(page);
  await startGame(page, { value: 10, freeze: true });
  await page.evaluate(edges => {
    const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
    window.worldBoundsAI = { start: scene.time.now, fixtures: [], frames: [] };
    for (const edge of edges) {
      const x = edge.dx * 1177, y = edge.dy * 777;
      const enemy = window.__NUMBER_SNAKE_DEBUG__.spawnEnemy(50, x, y, 'classic');
      enemy.body.body.reset(x, y);
      enemy.body.body.moves = true;
      // Force initializes a single recoil episode, not a collision result.
      // No manual update, physics step, repeated force, or position clamp follows.
      enemy.applyRecoil({ x: edge.dx, y: edge.dy }, 260, 150);
      window.worldBoundsAI.fixtures.push({ ...edge, x, y, id: enemy.arenaId, enemy });
    }
    window.worldBoundsAIObserver = () => {
      window.worldBoundsAI.frames.push({
        frame: scene.game.loop.frame, elapsed: scene.time.now - window.worldBoundsAI.start,
        hp: scene.player.hp, playerValue: scene.player.value, state: scene.gameState,
        enemies: window.worldBoundsAI.fixtures.map(({ enemy, id, name }) => {
          const body = enemy.body.body;
          return { frame: scene.game.loop.frame, id, name, x: enemy.body.x, y: enemy.body.y,
            cx: body.center.x, cy: body.center.y, radius: body.radius,
            vx: body.velocity.x, vy: body.velocity.y, value: enemy.value,
            recoil: enemy.isRecoiling, remaining: enemy.recoilRemainingMs };
        }),
      });
    };
    scene.events.on('postupdate', window.worldBoundsAIObserver);
  }, edges);
  let result;
  try {
    await expect.poll(() => page.evaluate(() => {
      const run = window.worldBoundsAI;
      return run.frames.length >= 24 && run.frames.at(-1).elapsed >= 550
        && run.frames.at(-1).enemies.every(enemy => !enemy.recoil);
    }), { timeout: 10000, intervals: [50] }).toBe(true);
  } finally {
    result = await page.evaluate(() => {
      const scene = window.__PHASER_GAME__.scene.getScene('GameScene');
      scene.events.off('postupdate', window.worldBoundsAIObserver);
      const run = window.worldBoundsAI;
      return { build: window.__NUMBER_SNAKE_BUILD__, frames: run.frames,
        fixtures: run.fixtures.map(({ enemy, ...fixture }) => fixture) };
    });
    await info.attach('world-bounds-AI-recoil-frames', { body: JSON.stringify({ ...result, errors }, null, 2), contentType: 'application/json' });
  }
  expect(result.frames.length).toBeGreaterThanOrEqual(24);
  for (const fixture of result.fixtures) {
    const samples = result.frames.map(frame => ({ ...frame.enemies.find(enemy => enemy.id === fixture.id), hp: frame.hp, playerValue: frame.playerValue, state: frame.state }));
    assertInside(samples, 18, fixture.name);
    expect(samples.every(sample => sample.value === 50)).toBe(true);
    expect(samples.some(sample => sample.recoil && sample.remaining > 0 && sample.remaining < 150), `${fixture.name}: real update advances the single recoil`).toBe(true);
    expect(samples.at(-1).remaining).toBe(0);
    expect(Math.max(...samples.map(sample => Math.hypot(sample.x - fixture.x, sample.y - fixture.y))), `${fixture.name}: normal physics actually moves the AI`).toBeGreaterThan(15);
    expect(Math.hypot(samples.at(-1).vx, samples.at(-1).vy), `${fixture.name}: AI resumes normal motion`).toBeGreaterThan(50);
  }
  expect((await sceneState(page)).enemies).toBe(8);
  expect((await sceneState(page)).score).toBe(0);
  expect((await sceneState(page)).orbs).toBe(0);
  expect(errors).toEqual([]);
});

test('WB3: Ultimate500 DASH and FLEE keep radius55 head, collider and drawn centers inside the 100px margin on real frames', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await boot(page);
  await startGame(page, { level: 4, value: 499, freeze: true });
  await page.evaluate(() => window.__NUMBER_SNAKE_DEBUG__.spawnUltimateBossForTest());

  for (const mode of ['DASH', 'FLEE']) for (const edge of edges) {
    await page.evaluate(({ mode, edge }) => {
      const scene = window.__PHASER_GAME__.scene.getScene('GameScene'), boss = scene.ultimateBoss;
      if (window.ultimateBoundsObserver) scene.events.off('postupdate', window.ultimateBoundsObserver);
      const length = Math.hypot(edge.dx, edge.dy), dx = edge.dx / length, dy = edge.dy / length;
      const x = edge.dx * 1080, y = edge.dy * 680;
      scene.player.value = mode === 'FLEE' ? 501 : 499;
      scene.player.teleport(x - dx * 1000, y - dy * 1000);
      scene.player.head.body.moves = false;
      scene.player.isInvulnerable = true;
      // Initial boundary/state fixtures only. Scene.update and Arcade advance every recorded frame.
      boss.body.body.moves = true;
      boss.body.body.reset(x, y);
      boss.state = mode === 'FLEE' ? 'CHASE' : mode;
      boss.stateTimer = 900;
      boss.dashDirection.set(dx, dy);
      const speed = mode === 'DASH' ? boss.dashSpeed : boss.baseSpeed;
      boss.body.setVelocity(dx * speed, dy * speed);
      window.ultimateBoundsRun = { mode, edge: edge.name, initial: { x, y }, samples: [], complete: false };
      window.ultimateBoundsObserver = () => {
        const record = window.ultimateBoundsRun, image = boss.body, body = image.body, visual = boss.visualContainer;
        record.samples.push({ frame: scene.game.loop.frame, x: image.x, y: image.y,
          cx: body.center.x, cy: body.center.y, visualX: visual.x, visualY: visual.y,
          radius: body.radius, circle: body.isCircle, vx: body.velocity.x, vy: body.velocity.y,
          bossState: boss.state, playerValue: scene.player.value, gameState: scene.gameState });
        if (record.samples.length === 24) {
          record.complete = true;
          scene.events.off('postupdate', window.ultimateBoundsObserver);
        }
      };
      scene.events.on('postupdate', window.ultimateBoundsObserver);
    }, { mode, edge });
    await expect.poll(() => page.evaluate(() => window.ultimateBoundsRun.complete), { timeout: 10000, intervals: [50] }).toBe(true);
    const run = await page.evaluate(() => window.ultimateBoundsRun);
    // Attach before assertions so the old build retains its actual failing center/boundary samples.
    await info.attach(`WB3-${mode}-${edge.name}-actual-frames`, { body: JSON.stringify({ build: await page.evaluate(() => window.__NUMBER_SNAKE_BUILD__), run }, null, 2), contentType: 'application/json' });
    expect(run.samples).toHaveLength(24);
    expect(new Set(run.samples.map(sample => sample.frame)).size).toBe(24);
    for (const sample of run.samples) {
      const context = `${mode}/${edge.name}, actual frame ${sample.frame}`;
      expect([sample.x, sample.y, sample.cx, sample.cy, sample.visualX, sample.visualY, sample.vx, sample.vy].every(Number.isFinite), context).toBe(true);
      expect(sample.radius, context).toBe(55);
      expect(sample.circle, context).toBe(true);
      expect(Math.abs(sample.x - sample.cx), context + ': collider is centered').toBeLessThan(0.05);
      expect(Math.abs(sample.y - sample.cy), context + ': collider is centered').toBeLessThan(0.05);
      expect(Math.abs(sample.x - sample.visualX), context + ': drawn boss follows postphysics head').toBeLessThan(0.05);
      expect(Math.abs(sample.y - sample.visualY), context + ': drawn boss follows postphysics head').toBeLessThan(0.05);
      for (const key of ['x', 'cx', 'visualX']) expect(Math.abs(sample[key]), context + ': horizontal 100px margin').toBeLessThanOrEqual(1100.05);
      for (const key of ['y', 'cy', 'visualY']) expect(Math.abs(sample[key]), context + ': vertical 100px margin').toBeLessThanOrEqual(700.05);
      expect(sample.playerValue, context).toBe(mode === 'FLEE' ? 501 : 499);
      expect(sample.gameState, context).toBe('RUNNING');
      if (mode === 'FLEE') expect(sample.bossState, context).toBe('FLEE');
    }
    expect(run.samples.some(sample => sample.bossState === mode), `${mode}/${edge.name}: real state executed`).toBe(true);
    expect(Math.max(...run.samples.map(sample => Math.hypot(sample.x - run.initial.x, sample.y - run.initial.y))), `${mode}/${edge.name}: Arcade actually moves the boss`).toBeGreaterThan(2);
  }
  expect(errors).toEqual([]);
});
