import type { RankingResult, RankedParticipant } from '../utils/ranking';
import type { RectBounds } from '../utils/layout';

export class LeaderboardPanel {
    public container: Phaser.GameObjects.Container;
    private bg: Phaser.GameObjects.Graphics;
    private titleText: Phaser.GameObjects.Text;
    
    // Top 5 rows
    private crownIcons: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] = [];
    private rankTexts: Phaser.GameObjects.Text[] = [];
    private nameTexts: Phaser.GameObjects.Text[] = [];
    private valueTexts: Phaser.GameObjects.Text[] = [];
    
    // 6th compact row for player when outside top 5
    private playerExtraRow: Phaser.GameObjects.Text;

    private panelWidth: number = 190;
    private panelHeight: number = 160;

    constructor(scene: Phaser.Scene) {
        this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(210);

        this.bg = scene.add.graphics();
        this.container.add(this.bg);

        this.titleText = scene.add.text(10, 8, 'ARENA RANK', {
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#00ffff'
        });
        this.container.add(this.titleText);

        const rowStartY = 28;
        const rowSpacing = 20;

        for (let i = 0; i < 5; i++) {
            const y = rowStartY + i * rowSpacing;

            // Crown icon for #1
            const crown = scene.textures.exists('crown_gold')
                ? scene.add.image(14, y + 6, 'crown_gold').setScale(0.55).setVisible(false)
                : scene.add.text(8, y, '👑', { fontSize: '11px' }).setVisible(false);

            const rankText = scene.add.text(26, y, `${i + 1}`, {
                fontSize: '12px',
                fontStyle: 'bold',
                color: '#aaaaaa'
            });

            const nameText = scene.add.text(44, y, '---', {
                fontSize: '12px',
                fontStyle: 'bold',
                color: '#ffffff'
            });

            const valueText = scene.add.text(this.panelWidth - 12, y, '0', {
                fontSize: '12px',
                fontStyle: 'bold',
                color: '#ffffff'
            }).setOrigin(1, 0);

            this.crownIcons.push(crown);
            this.rankTexts.push(rankText);
            this.nameTexts.push(nameText);
            this.valueTexts.push(valueText);

            this.container.add([crown, rankText, nameText, valueText]);
        }

        // Extra player row
        this.playerExtraRow = scene.add.text(10, rowStartY + 5 * rowSpacing + 4, '', {
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#00ffff'
        }).setVisible(false);
        this.container.add(this.playerExtraRow);

        this.resize(scene.scale.gameSize);
    }

    public updateRanking(result: RankingResult) {
        const { top5, playerRank } = result;

        for (let i = 0; i < 5; i++) {
            const item: RankedParticipant | undefined = top5[i];
            const crown = this.crownIcons[i];
            const rText = this.rankTexts[i];
            const nText = this.nameTexts[i];
            const vText = this.valueTexts[i];

            if (item) {
                const isPlayer = item.type === 'player';
                const isFirst = item.rank === 1;

                crown.setVisible(isFirst);
                rText.setText(`${item.rank}`).setVisible(true);
                nText.setText(isPlayer ? 'YOU' : item.name).setVisible(true);
                vText.setText(`${item.value}`).setVisible(true);

                // Colors
                if (isFirst) {
                    rText.setColor('#ffd700');
                    nText.setColor('#ffd700');
                    vText.setColor('#ffd700');
                } else if (isPlayer) {
                    rText.setColor('#00ffff');
                    nText.setColor('#00ffff');
                    vText.setColor('#00ffff');
                } else {
                    rText.setColor('#aaaaaa');
                    nText.setColor('#ffffff');
                    vText.setColor('#ffffff');
                }
            } else {
                crown.setVisible(false);
                rText.setVisible(false);
                nText.setVisible(false);
                vText.setVisible(false);
            }
        }

        // Check if player is outside top 5
        if (playerRank && playerRank.rank > 5) {
            this.playerExtraRow.setText(`YOU  #${playerRank.rank}  VALUE ${playerRank.value}`);
            this.playerExtraRow.setVisible(true);
            this.panelHeight = 162;
        } else {
            this.playerExtraRow.setVisible(false);
            this.panelHeight = 138;
        }

        this.drawBackground();
    }

    private drawBackground() {
        this.bg.clear();
        this.bg.fillStyle(0x050d1a, 0.75);
        this.bg.fillRoundedRect(0, 0, this.panelWidth, this.panelHeight, 8);
        this.bg.lineStyle(1.5, 0x005588, 0.8);
        this.bg.strokeRoundedRect(0, 0, this.panelWidth, this.panelHeight, 8);
    }

    public resize(gameSize: Phaser.Structs.Size) {
        const w = gameSize.width;
        // Narrow viewport adjustment
        if (w <= 450) {
            this.panelWidth = 156;
            this.titleText.setFontSize('11px');
            for (let i = 0; i < 5; i++) {
                this.rankTexts[i].setFontSize('10px');
                this.nameTexts[i].setFontSize('10px');
                this.valueTexts[i].setFontSize('10px');
                this.valueTexts[i].setX(this.panelWidth - 8);
            }
            this.playerExtraRow.setFontSize('10px');
        } else {
            this.panelWidth = 186;
            this.titleText.setFontSize('13px');
            for (let i = 0; i < 5; i++) {
                this.rankTexts[i].setFontSize('12px');
                this.nameTexts[i].setFontSize('12px');
                this.valueTexts[i].setFontSize('12px');
                this.valueTexts[i].setX(this.panelWidth - 10);
            }
            this.playerExtraRow.setFontSize('11px');
        }

        // Top-right corner (placed below top HUD on narrow screens to prevent overlap)
        const posX = Math.max(10, w - this.panelWidth - 12);
        const posY = w <= 450 ? 148 : 12;
        this.container.setPosition(posX, posY);
        this.drawBackground();
    }

    public getBounds(): RectBounds {
        return {
            x: this.container.x,
            y: this.container.y,
            width: this.panelWidth,
            height: this.panelHeight
        };
    }

    public destroy() {
        this.container.destroy();
    }
}
