const { test, expect } = require('playwright/test');
const { boot, startGame, buttonPoint } = require('./helpers.cjs');

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`iPhone floating joystick ${viewport.width}x${viewport.height}: native drag with independent boost and magnet fingers`, async ({ browser, browserName }, info) => {
    test.skip(browserName !== 'chromium', 'Native simultaneous touch injection uses Chromium CDP; desktop WebKit is not a physical iPhone.');
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await boot(page);
      await startGame(page, { value: 10 });
      const cdp = await context.newCDPSession(page);
      const read = () => page.evaluate(() => {
        const s = window.__PHASER_GAME__.scene.getScene('GameScene');
        return { active: s.joystick.active, dx: s.joystick.deltaX, dy: s.joystick.deltaY,
          base: { x: s.joystick.base.x, y: s.joystick.base.y }, angle: s.player.targetAngle,
          currentAngle: s.player.currentAngle, speed: s.player.head.body.speed,
          boost: s.hud.isBoostPressed, magnet: s.hud.isMagnetPressed };
      });
      const home = (await read()).base;
      const anchor = { x: Math.round(viewport.width * .35), y: Math.round(viewport.height * .65), id: 1 };
      expect(Math.hypot(anchor.x - home.x, anchor.y - home.y)).toBeGreaterThan(100);
      // Wait for the live canvas before one native touch starts away from the old circle.
      await expect(page.locator('canvas')).toBeVisible();
      let previousBounds;
      await expect.poll(async () => {
        const bounds = await page.locator('canvas').boundingBox();
        const stable = bounds && previousBounds && ['x', 'y', 'width', 'height'].every(key => Math.abs(bounds[key] - previousBounds[key]) < .5);
        previousBounds = bounds;
        return !!stable;
      }).toBe(true);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [anchor] });
      await expect.poll(async () => (await read()).active).toBe(true);
      expect((await read()).base).toEqual({ x: anchor.x, y: anchor.y });
      expect((await read()).dx).toBe(0);
      expect((await read()).dy).toBe(0);
      const drag = { ...anchor, y: anchor.y - 45 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [drag] });
      await expect.poll(async () => (await read()).angle).toBeCloseTo(-Math.PI / 2, 2);
      await expect.poll(async () => Math.abs((await read()).currentAngle + Math.PI / 2)).toBeLessThan(.08);
      const boost = await buttonPoint(page, 'GameScene', 'hud.boostButton');
      const magnet = await buttonPoint(page, 'GameScene', 'hud.magnetButton');
      const boostTouch = { x: boost.x, y: boost.y, id: 2 };
      const magnetTouch = { x: magnet.x, y: magnet.y, id: 3 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [drag, boostTouch] });
      await expect.poll(async () => (await read()).speed).toBeCloseTo(340, 1);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [drag, boostTouch, magnetTouch] });
      await expect.poll(async () => (await read()).magnet).toBe(true);
      expect((await read()).base).toEqual({ x: anchor.x, y: anchor.y });
      expect((await read()).dy).toBeLessThan(-.5);
      // CDP touchEnd lists the fingers being released, unlike touchStart/Move.
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [magnetTouch] });
      await expect.poll(async () => (await read()).magnet).toBe(false);
      expect((await read()).active).toBe(true);
      expect((await read()).boost).toBe(true);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [boostTouch] });
      await expect.poll(async () => (await read()).speed).toBeCloseTo(220, 1);
      expect((await read()).active).toBe(true);
      const turned = { ...anchor, x: anchor.x + 45 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [turned] });
      await expect.poll(async () => (await read()).angle).toBeCloseTo(0, 2);
      await info.attach('floating-stick-multitouch', { body: JSON.stringify(await read()), contentType: 'application/json' });
      await page.screenshot({ path: `${process.env.EVIDENCE_DIR || 'test-results'}/iphone-floating-${viewport.width}x${viewport.height}.png` });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await expect.poll(async () => (await read()).active).toBe(false);
      expect((await read()).base).toEqual(home);
      expect((await read()).dx).toBe(0);
      expect((await read()).dy).toBe(0);
      // A tap on the HUD or an ability must never claim a new joystick finger.
      await page.touchscreen.tap(40, 70);
      expect((await read()).active).toBe(false);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [boostTouch] });
      await expect.poll(async () => (await read()).boost).toBe(true);
      expect((await read()).active).toBe(false);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`iPhone touch capture ${viewport.width}x${viewport.height}: native press origin and release on Chromium/WebKit`, async ({ browser }, info) => {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await boot(page);
      await startGame(page, { value: 10 });
      await expect(page.locator('canvas')).toBeVisible();
      const home = await buttonPoint(page, 'GameScene', 'joystick.base');
      let previous;
      await expect.poll(async () => {
        const current = await buttonPoint(page, 'GameScene', 'joystick.base');
        const stable = current && previous && Math.abs(current.x - previous.x) < .5 && Math.abs(current.y - previous.y) < .5;
        previous = current; return !!stable;
      }).toBe(true);
      // Observe native DOM events after Phaser has processed them; no input handlers are invoked.
      await page.evaluate(() => {
        window.nativeTouchObservations = [];
        for (const type of ['touchstart', 'touchend']) document.addEventListener(type, () => {
          const s = window.__PHASER_GAME__.scene.getScene('GameScene');
          window.nativeTouchObservations.push({ type, active: s.joystick.active, dx: s.joystick.deltaX, dy: s.joystick.deltaY,
            x: s.joystick.base.x, y: s.joystick.base.y, boost: s.hud.isBoostPressed });
        });
      });
      const anchor = { x: Math.round(viewport.width * .35), y: Math.round(viewport.height * .65) };
      await page.touchscreen.tap(anchor.x, anchor.y);
      const events = await page.evaluate(() => window.nativeTouchObservations);
      expect(events.map(event => event.type)).toEqual(['touchstart', 'touchend']);
      expect(events[0]).toMatchObject({ active: true, x: anchor.x, y: anchor.y, dx: 0, dy: 0 });
      expect(events[1]).toMatchObject({ active: false, dx: 0, dy: 0 });
      expect(events[1].x).toBeCloseTo(home.x, 3);
      expect(events[1].y).toBeCloseTo(home.y, 3);
      await page.touchscreen.tap(40, 70);
      const hudEvents = await page.evaluate(() => window.nativeTouchObservations.slice(-2));
      expect(hudEvents.every(event => !event.active)).toBe(true);
      const boost = await buttonPoint(page, 'GameScene', 'hud.boostButton');
      await page.touchscreen.tap(boost.x, boost.y);
      const boostEvents = await page.evaluate(() => window.nativeTouchObservations.slice(-2));
      expect(boostEvents[0]).toMatchObject({ active: false, boost: true });
      expect(boostEvents[1]).toMatchObject({ active: false, boost: false });
      await info.attach('native-touch-start-end', { body: JSON.stringify(await page.evaluate(() => window.nativeTouchObservations)), contentType: 'application/json' });
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}
