const { chromium } = require('playwright');

(async () => {
  console.log('Launching playwright browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  let errors = 0;
  let warnings = 0;
  page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      if (type === 'error') {
          errors++;
          console.error('PAGE ERROR:', text);
      } else if (type === 'warning') {
          warnings++;
      } else {
          console.log('PAGE LOG:', text);
      }
  });
  
  page.on('pageerror', error => {
      errors++;
      console.error('PAGE UNCAUGHT ERROR:', error.message);
  });

  page.on('requestfailed', request => {
      errors++;
      console.error('NETWORK 404/FAIL:', request.url(), request.failure().errorText);
  });

  try {
      console.log('Navigating to http://localhost:3000/?debug=1');
      await page.goto('http://localhost:3000/?debug=1', { waitUntil: 'networkidle' });
      
      console.log('Waiting for MenuScene to load...');
      await page.waitForTimeout(2000);
      
      console.log('Clicking START button in center of screen...');
      const viewport = page.viewportSize();
      await page.mouse.click(viewport.width / 2, viewport.height / 2 + 60); 
      
      console.log('Waiting for GameScene to initialize...');
      await page.waitForTimeout(2000);
      
      console.log('Pressing D to move right...');
      await page.keyboard.down('d');
      await page.waitForTimeout(1000);
      await page.keyboard.up('d');

      console.log('Pressing C (cheat key) multiple times to reach Boss...');
      for(let i=0; i<7; i++) {
          await page.keyboard.press('c');
          await page.waitForTimeout(100);
      }

      console.log('Letting the game run for a bit...');
      await page.waitForTimeout(5000);
      
      console.log('Testing viewports...');
      const viewports = [
          { width: 390, height: 844 },
          { width: 430, height: 932 },
          { width: 768, height: 1024 },
          { width: 1024, height: 768 },
          { width: 1366, height: 768 },
          { width: 1920, height: 1080 }
      ];
      
      for (const vp of viewports) {
          console.log(`Setting viewport to ${vp.width}x${vp.height}`);
          await page.setViewportSize(vp);
          await page.waitForTimeout(1000);
      }

      console.log('Game run complete.');

      console.log(`\n--- RESULTS ---`);
      console.log(`Errors: ${errors}`);
      console.log(`Warnings: ${warnings}`);
      
  } catch (err) {
      console.error('Automation error:', err);
  } finally {
      await browser.close();
  }
})();
