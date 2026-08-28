const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto("https://chaohuang-TW.github.io/number-snake-arena/?e2e=1", { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    let vp = page.viewportSize();
    await page.mouse.click(vp.width / 2, vp.height / 2 + 60);
    await page.waitForTimeout(2000);
    const val = await page.evaluate(() => {
        return {
            e2e: typeof window.__E2E_READONLY__,
            debug: typeof window.__NUMBER_SNAKE_DEBUG__,
            phaser: typeof window.__PHASER_GAME__
        }
    });
    console.log(val);
    await browser.close();
})();
