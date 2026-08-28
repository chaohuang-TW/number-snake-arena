const fs = require('fs');
let runE2E = fs.readFileSync('tests/e2e/run-e2e.cjs', 'utf8');

// In Test D, there are two wait timeouts of 4500.
// Let's replace them specifically in Test D block.
const testDIndex = runE2E.indexOf('--- Test D: Boss Damage ---');
const testEIndex = runE2E.indexOf('--- Test E: Boss Reversal & Victory ---');

if (testDIndex !== -1 && testEIndex !== -1) {
    let before = runE2E.substring(0, testDIndex);
    let testDBlock = runE2E.substring(testDIndex, testEIndex);
    let after = runE2E.substring(testEIndex);
    
    // Replace all 4500 with 2100 in Test D
    testDBlock = testDBlock.replace(/4500/g, '2100');
    
    fs.writeFileSync('tests/e2e/run-e2e.cjs', before + testDBlock + after);
    console.log("Patched 4500 -> 2100 in Test D");
} else {
    console.error("Could not find Test D or E markers!");
}
