const {defineConfig}=require('playwright/test');
module.exports=defineConfig({
 testDir:'./tests/e2e',testMatch:'*.spec.cjs',timeout:60000,
 expect:{timeout:8000},fullyParallel:false,workers:1,retries:0,
 reporter:[['list'],['json',{outputFile:process.env.EVIDENCE_DIR?process.env.EVIDENCE_DIR+'/results.json':'test-results/results.json'}]],
 outputDir:(process.env.EVIDENCE_DIR||'test-results')+'/playwright-artifacts',
 use:{browserName:process.env.BROWSER||'chromium',baseURL:process.env.BASE_URL||'http://127.0.0.1:3020/',viewport:{width:1366,height:768},trace:'retain-on-failure',screenshot:'only-on-failure',video:'retain-on-failure'},
});
