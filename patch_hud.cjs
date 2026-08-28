const fs = require('fs');

let code = fs.readFileSync('src/ui/HUD.ts', 'utf8');

code = code.replace(
    /update\(hp: number, boostEnergy: number, maxBoostEnergy: number\) \{/,
    `update(hp: number, maxHP: number, boostEnergy: number, maxBoostEnergy: number) {`
);

code = code.replace(
    /let hearts = '';\s*for \(let i = 0; i < hp; i\+\+\) hearts \+= '❤️';\s*this\.hpText\.setText\(hearts\);/,
    `let hearts = '';\n        for (let i = 0; i < hp; i++) hearts += '❤️';\n        for (let i = hp; i < maxHP; i++) hearts += '🖤';\n        this.hpText.setText(hearts);`
);

fs.writeFileSync('src/ui/HUD.ts', code);
