const fs = require('fs');

let gameScene = fs.readFileSync('src/scenes/GameScene.ts', 'utf-8');

gameScene = gameScene.replace(/showLevelClearScreen\(newlyClaimedReward: boolean, newlyUnlocked: boolean\) {[\s\S]*?createLevelClearButtons\(cx: number, cy: number\) {/m, `showLevelClearScreen(newlyClaimedReward: boolean, newlyUnlocked: boolean) {
        const cx = this.cameras.main.scrollX + this.scale.width / 2;
        const cy = this.cameras.main.scrollY + this.scale.height / 2;

        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.85);
        bg.fillRect(this.cameras.main.scrollX, this.cameras.main.scrollY, this.scale.width, this.scale.height);
        bg.setDepth(300);

        this.add.text(cx, cy - 140, \`\${this.levelDef.name} CLEAR!\`, { fontSize: '56px', fontStyle: 'bold', color: '#00ff00' }).setOrigin(0.5).setDepth(301);
        
        let currentY = cy - 40;
        
        if (!this.levelDef.nextLevelId) {
            this.add.text(cx, currentY, 'ALL LEVELS CLEARED!', { fontSize: '36px', fontStyle: 'bold', color: '#ffff00' }).setOrigin(0.5).setDepth(301);
            this.add.text(cx, currentY + 60, 'YOU BECAME THE NUMBER MASTER!', { fontSize: '24px', fontStyle: 'bold', color: '#00ffff' }).setOrigin(0.5).setDepth(301);
            this.time.delayedCall(500, () => {
                this.createLevelClearButtons(cx, cy + 140);
            });
            return;
        }
        
        if (newlyClaimedReward) {
            this.add.text(cx, currentY, '+1 HEART', { fontSize: '32px', fontStyle: 'bold', color: '#ff5555' }).setOrigin(0.5).setDepth(301);
            const oldMax = ProgressionManager.getMaxHP() - this.levelDef.reward!.value;
            let heartStr = '';
            for(let i=0; i<oldMax; i++) heartStr += '❤️';
            const heartText = this.add.text(cx, currentY + 40, heartStr, { fontSize: '32px' }).setOrigin(0.5).setDepth(301);
            
            // Animate reward
            this.time.delayedCall(800, () => {
                heartStr += '❤️';
                heartText.setText(heartStr);
                // quick scale bounce
                this.tweens.add({
                    targets: heartText,
                    scale: 1.5,
                    yoyo: true,
                    duration: 150,
                    onComplete: () => {
                        if (newlyUnlocked) {
                            this.time.delayedCall(400, () => {
                                this.add.text(cx, currentY + 100, \`LEVEL \${this.levelDef.nextLevelId} UNLOCKED!\`, { fontSize: '36px', fontStyle: 'bold', color: '#00ffff' }).setOrigin(0.5).setDepth(301);
                                this.createLevelClearButtons(cx, cy + 180);
                            });
                        } else {
                            this.createLevelClearButtons(cx, cy + 180);
                        }
                    }
                });
            });
        } else {
            if (newlyUnlocked) {
                this.add.text(cx, currentY + 60, \`LEVEL \${this.levelDef.nextLevelId} UNLOCKED!\`, { fontSize: '36px', fontStyle: 'bold', color: '#00ffff' }).setOrigin(0.5).setDepth(301);
            }
            this.time.delayedCall(500, () => {
                this.createLevelClearButtons(cx, cy + 140);
            });
        }
    }

    createLevelClearButtons(cx: number, cy: number) {`);

fs.writeFileSync('src/scenes/GameScene.ts', gameScene);
