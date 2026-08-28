const fs = require('fs');

let code = fs.readFileSync('src/scenes/GameScene.ts', 'utf8');

const levelClearMethod = `
    levelClear() {
        this.gameState = 'LEVEL_CLEAR';
        this.saveScore();
        
        // Handle progression
        let newlyUnlocked = false;
        let newlyClaimedReward = false;
        
        if (this.levelDef.reward) {
            newlyClaimedReward = ProgressionManager.claimReward(this.levelDef.reward.id, this.levelDef.reward.value);
        }
        
        if (this.levelDef.nextLevelId) {
            newlyUnlocked = ProgressionManager.unlockLevel(this.levelDef.nextLevelId);
        }

        // Delay slightly for boss defeat FX
        this.time.delayedCall(400, () => {
            this.showLevelClearScreen(newlyClaimedReward, newlyUnlocked);
        });
    }

    showLevelClearScreen(newlyClaimedReward: boolean, newlyUnlocked: boolean) {
        const cx = this.cameras.main.scrollX + this.scale.width / 2;
        const cy = this.cameras.main.scrollY + this.scale.height / 2;

        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.85);
        bg.fillRect(this.cameras.main.scrollX, this.cameras.main.scrollY, this.scale.width, this.scale.height);
        bg.setDepth(300);

        this.add.text(cx, cy - 140, \`\${this.levelDef.name} CLEAR!\`, { fontSize: '56px', fontStyle: 'bold', color: '#00ff00' }).setOrigin(0.5).setDepth(301);
        
        let currentY = cy - 40;
        
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

    createLevelClearButtons(cx: number, cy: number) {
        if (this.levelDef.nextLevelId && ProgressionManager.getHighestUnlockedLevel() >= this.levelDef.nextLevelId) {
            const nextBtn = this.add.text(cx, cy - 60, 'NEXT LEVEL', {
                fontSize: '32px', backgroundColor: '#00aa00', padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });
            
            nextBtn.on('pointerdown', () => {
                this.scene.start('GameScene', { levelId: this.levelDef.nextLevelId });
            });
        }

        const replayBtn = this.add.text(cx, cy, 'REPLAY LEVEL', {
            fontSize: '24px', backgroundColor: '#555555', padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });
        
        replayBtn.on('pointerdown', () => {
            this.scene.start('GameScene', { levelId: this.levelId });
        });

        const menuBtn = this.add.text(cx, cy + 60, 'MENU', {
            fontSize: '24px', backgroundColor: '#0055aa', padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });
        
        menuBtn.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });
    }
`;

code = code.replace(
    /gameOver\(\) \{/,
    levelClearMethod + '\n    gameOver() {'
);

fs.writeFileSync('src/scenes/GameScene.ts', code);
