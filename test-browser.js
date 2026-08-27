import puppeteer from 'puppeteer';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // To collect console errors
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
      await page.goto('http://localhost:3000/?debug=1', { waitUntil: 'networkidle0' });
      
      console.log('Waiting for MenuScene to load...');
      await new Promise(r => setTimeout(r, 2000));
      
      // Since it's a Canvas, we can't easily query DOM elements for the game UI, except via mouse clicks
      console.log('Clicking START button in center of screen...');
      const viewport = page.viewport();
      await page.mouse.click(viewport.width / 2, viewport.height / 2 + 60); // approx start button
      
      console.log('Waiting for GameScene to initialize...');
      await new Promise(r => setTimeout(r, 2000));
      
      // Moving character
      console.log('Pressing D to move right...');
      await page.keyboard.down('d');
      await new Promise(r => setTimeout(r, 1000));
      await page.keyboard.up('d');

      console.log('Pressing C (cheat key) multiple times to reach Boss...');
      for(let i=0; i<7; i++) {
          await page.keyboard.press('c');
          await new Promise(r => setTimeout(r, 100));
      }

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
          await page.setViewport(vp);
          await new Promise(r => setTimeout(r, 1000));
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
