import type { RankingResult, RankedParticipant } from '../utils/ranking';
import { arenaUiLayout, type RectBounds } from '../utils/layout';
import { safeInsets, uiUnit, ARCADE } from './ArcadeStyle';
import Phaser from 'phaser';
import { t } from '../i18n';

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

    private panelWidth: number = 208;
    private panelHeight: number = 186;

    constructor(private scene: Phaser.Scene) {
        this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(210);

        this.bg = scene.add.graphics();
        this.container.add(this.bg);

        this.titleText = scene.add.text(10, 8, t('leaderboardTitle'), {
            fontFamily: ARCADE.font, fontSize: `${uiUnit(scene, 16)}px`,
            fontStyle: 'bold',
            color: '#00ffff'
        });
        this.container.add(this.titleText);

        const rowStartY = 35;
        const rowSpacing = 25;

        for (let i = 0; i < 5; i++) {
            const y = rowStartY + i * rowSpacing;

            // Crown icon for #1
            const crown = scene.textures.exists('crown_gold')
                ? scene.add.image(14, y + 6, 'crown_gold').setScale(0.55).setVisible(false)
                : scene.add.text(8, y, '👑', { fontFamily: ARCADE.font, fontSize: `${uiUnit(scene, 16)}px` }).setVisible(false);

            const rankText = scene.add.text(26, y, `${i + 1}`, {
                fontFamily: ARCADE.font, fontSize: `${uiUnit(scene, 16)}px`,
                fontStyle: 'bold',
                color: '#aaaaaa'
            });

            const nameText = scene.add.text(46, y, '---', {
                fontFamily: ARCADE.font, fontSize: `${uiUnit(scene, 16)}px`,
                fontStyle: 'bold',
                color: '#ffffff'
            });

            const valueText = scene.add.text(this.panelWidth - 12, y, '0', {
                fontFamily: ARCADE.font, fontSize: `${uiUnit(scene, 16)}px`,
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
            fontFamily: ARCADE.font, fontSize: `${uiUnit(scene, 16)}px`,
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
                nText.setText(isPlayer ? t('you') : item.name).setVisible(true);
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
            this.playerExtraRow.setText(`${t('you')} #${playerRank.rank} · ${playerRank.value}`);
            this.playerExtraRow.setVisible(true);
            this.panelHeight = 194;
        } else {
            this.playerExtraRow.setVisible(false);
            this.panelHeight = 170;
        }

        this.drawBackground();
    }

    private drawBackground() {
        this.bg.clear();
        this.bg.fillStyle(0x071321, 0.82);
        this.bg.fillRoundedRect(0, 0, this.panelWidth, this.panelHeight, 8);
        this.bg.lineStyle(1.5, 0x34516a, 0.8);
        this.bg.strokeRoundedRect(0, 0, this.panelWidth, this.panelHeight, 8);
    }

    public resize(gameSize: Phaser.Structs.Size) {
        const layout = arenaUiLayout(gameSize.width, gameSize.height, safeInsets(this.scene));
        this.titleText.setText(t('leaderboardTitle'));
        this.panelWidth = layout.ranking.width;
        this.titleText.setFontSize(uiUnit(this.scene, 16));
        for (let i = 0; i < 5; i++) {
            this.rankTexts[i].setFontSize(uiUnit(this.scene, 16));
            this.nameTexts[i].setFontSize(uiUnit(this.scene, 16));
            this.valueTexts[i].setFontSize(uiUnit(this.scene, 16)).setX(this.panelWidth - 10);
            this.nameTexts[i].setWordWrapWidth(this.panelWidth - 95);
        }
        this.playerExtraRow.setFontSize(uiUnit(this.scene, 16));
        this.container.setPosition(layout.ranking.x, layout.ranking.y);
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
