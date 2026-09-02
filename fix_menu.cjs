const fs = require('fs');

let content = fs.readFileSync('src/scenes/MenuScene.ts', 'utf-8');

const newCreateCards = `    createLevelCards(cx: number, cy: number) {
        // Clear previous if any
        this.levelCards.forEach(c => c.destroy());
        this.levelCards = [];

        const highestUnlocked = ProgressionManager.getHighestUnlockedLevel();
        const screenWidth = this.scale.width;
        
        let cols = screenWidth >= 800 ? 4 : 2;
        let scale = screenWidth < 450 ? 0.8 : 1.0;
        
        const cardWidth = 180 * scale;
        const cardHeight = 220 * scale;
        const padX = 20 * scale;
        const padY = 30 * scale;
        
        const totalW = cols * cardWidth + (cols - 1) * padX;
        const startX = cx - totalW / 2 + cardWidth / 2;
        
        // Ensure tutorial is placed out of the way
        if (this.tutorialText) {
            this.tutorialText.setPosition(cx, cy + (cols === 2 ? 260 : 180));
        }

        const levelIds = [1, 2, 3, 4];
        
        levelIds.forEach((levelId, idx) => {
            if (!LEVELS[levelId]) return;
            const c = idx % cols;
            const r = Math.floor(idx / cols);
            
            const xPos = startX + c * (cardWidth + padX);
            const yPos = cy + r * (cardHeight + padY) - (cols === 2 ? 80 : 0) * scale + 20;
            
            const card = this.createCard(xPos, yPos, levelId, highestUnlocked >= levelId, scale);
            this.levelCards.push(card);
        });
    }

    createCard(x: number, y: number, levelId: number, unlocked: boolean, scale: number = 1.0) {
        const container = this.add.container(x, y);
        container.setScale(scale);
        const levelDef = LEVELS[levelId];
        
        const bg = this.add.rectangle(0, 0, 180, 220, unlocked ? 0x0055aa : 0x333333, 1)
            .setStrokeStyle(4, unlocked ? 0x00ffff : 0x555555);

        const title = this.add.text(0, -60, levelDef.name, {
            fontSize: '28px',
            fontStyle: 'bold',
            color: unlocked ? '#ffffff' : '#aaaaaa'
        }).setOrigin(0.5);

        const bossText = this.add.text(0, -10, \`BOSS \${levelDef.bossValue}\`, {
            fontSize: '20px',
            color: unlocked ? '#ff5555' : '#777777'
        }).setOrigin(0.5);

        container.add([bg, title, bossText]);

        if (unlocked) {
            const bestScore = ProgressionManager.getBestScore(levelId);
            const scoreText = this.add.text(0, 30, \`BEST: \${bestScore}\`, {
                fontSize: '16px',
                color: '#aaaaaa'
            }).setOrigin(0.5);
            
            const btnBg = this.add.rectangle(0, 80, 120, 40, 0x00aa00, 1).setInteractive({ useHandCursor: true });
            const btnText = this.add.text(0, 80, 'START', { fontSize: '20px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);
            
            btnBg.on('pointerdown', () => {
                this.startGame(levelId);
            });
            
            container.add([scoreText, btnBg, btnText]);
        } else {
            const lockText = this.add.text(0, 50, '🔒 LOCKED', {
                fontSize: '24px',
                color: '#aaaaaa'
            }).setOrigin(0.5);
            container.add(lockText);
        }

        return container;
    }`;

content = content.replace(/createLevelCards\(cx: number, cy: number\) {[\s\S]*?startGame\(levelId: number\) {/, newCreateCards + '\n\n    startGame(levelId: number) {');
fs.writeFileSync('src/scenes/MenuScene.ts', content);
