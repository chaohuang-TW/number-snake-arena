import Phaser from 'phaser';
import { HEAD_SKIN_LIST } from '../config/headSkins';
import { CosmeticsManager } from '../models/Cosmetics';
import { t } from '../i18n';

export class CustomizeScene extends Phaser.Scene {
    private selectedIndex: number = 0;
    private previewContainer!: Phaser.GameObjects.Container;
    private previewHeadImage!: Phaser.GameObjects.Image;
    private previewValueText!: Phaser.GameObjects.Text;
    public styleNameText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    public equipBtnBg!: Phaser.GameObjects.Rectangle;
    private equipBtnText!: Phaser.GameObjects.Text;

    public prevBtnBg!: Phaser.GameObjects.Rectangle;
    private prevBtnText!: Phaser.GameObjects.Text;
    public nextBtnBg!: Phaser.GameObjects.Rectangle;
    private nextBtnText!: Phaser.GameObjects.Text;
    private backBtnBg!: Phaser.GameObjects.Rectangle;
    private backBtnText!: Phaser.GameObjects.Text;
    private titleText!: Phaser.GameObjects.Text;

    constructor() {
        super('CustomizeScene');
    }

    create() {
        CosmeticsManager.load();
        const currentSkinId = CosmeticsManager.getSelectedHeadSkin();
        this.selectedIndex = HEAD_SKIN_LIST.findIndex(s => s.id === currentSkinId);
        if (this.selectedIndex < 0) this.selectedIndex = 0;

        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        // Background
        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x111625).setOrigin(0);

        this.titleText = this.add.text(cx, 60, t('customizeTitle'), {
            fontSize: '38px',
            fontStyle: 'bold',
            color: '#00ffff'
        }).setOrigin(0.5);

        // Preview container
        this.previewContainer = this.add.container(cx, cy - 60);

        // Preview circle backing glow
        const previewGlow = this.add.circle(0, 0, 75, 0x00ffff, 0.15);
        this.previewHeadImage = this.add.image(0, 0, 'skin_head_classic_p');
        this.previewHeadImage.setScale(2.8);

        this.previewValueText = this.add.text(0, 0, '5', {
            fontSize: '32px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.previewContainer.add([previewGlow, this.previewHeadImage, this.previewValueText]);

        // Style name text
        this.styleNameText = this.add.text(cx, cy + 45, '', {
            fontSize: '28px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Prev & Next Buttons
        this.prevBtnBg = this.add.rectangle(cx - 150, cy - 60, 60, 60, 0x0055aa, 0.8)
            .setStrokeStyle(2, 0x00ffff)
            .setInteractive({ useHandCursor: true });
        this.prevBtnText = this.add.text(cx - 150, cy - 60, '<', {
            fontSize: '32px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.prevBtnBg.on('pointerdown', () => this.navigate(-1));

        this.nextBtnBg = this.add.rectangle(cx + 150, cy - 60, 60, 60, 0x0055aa, 0.8)
            .setStrokeStyle(2, 0x00ffff)
            .setInteractive({ useHandCursor: true });
        this.nextBtnText = this.add.text(cx + 150, cy - 60, '>', {
            fontSize: '32px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.nextBtnBg.on('pointerdown', () => this.navigate(1));

        // Use this head / equip button
        this.equipBtnBg = this.add.rectangle(cx, cy + 110, 220, 50, 0x00aa44, 1)
            .setStrokeStyle(2, 0x00ff88)
            .setInteractive({ useHandCursor: true });
        this.equipBtnText = this.add.text(cx, cy + 110, t('selectSkin'), {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.equipBtnBg.on('pointerdown', () => this.equipSelectedSkin());

        // Status text (Equipped)
        this.statusText = this.add.text(cx, cy + 160, '', {
            fontSize: '18px',
            color: '#00ff88'
        }).setOrigin(0.5);

        // Back button
        this.backBtnBg = this.add.rectangle(cx, cy + 220, 160, 44, 0x334455, 0.9)
            .setStrokeStyle(2, 0x8899aa)
            .setInteractive({ useHandCursor: true });
        this.backBtnText = this.add.text(cx, cy + 220, t('backBtn'), {
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.backBtnBg.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });

        this.updateView();

        this.scale.on('resize', this.resize, this);
        this.events.once('shutdown', () => {
            this.scale.off('resize', this.resize, this);
        });
    }

    private navigate(dir: number) {
        this.selectedIndex = (this.selectedIndex + dir + HEAD_SKIN_LIST.length) % HEAD_SKIN_LIST.length;
        this.updateView();
    }

    private equipSelectedSkin() {
        const skin = HEAD_SKIN_LIST[this.selectedIndex];
        CosmeticsManager.setSelectedHeadSkin(skin.id);
        this.updateView();
    }

    private updateView() {
        const skin = HEAD_SKIN_LIST[this.selectedIndex];
        const currentEquipped = CosmeticsManager.getSelectedHeadSkin();
        const isEquipped = currentEquipped === skin.id;

        // Texture
        const tex = this.textures.exists(skin.playerTexture) ? skin.playerTexture : 'player_head';
        this.previewHeadImage.setTexture(tex);

        // Style Name
        this.styleNameText.setText(skin.displayName);
        this.styleNameText.setColor(Phaser.Display.Color.IntegerToColor(skin.accentColor).rgba);

        // Button state
        if (isEquipped) {
            this.equipBtnBg.setFillStyle(0x225533, 0.8);
            this.equipBtnText.setText(t('equippedSkin'));
            this.statusText.setText(`✓ ${t('equippedSkin')}`);
            this.statusText.setColor('#00ff88');
        } else {
            this.equipBtnBg.setFillStyle(0x00aa44, 1);
            this.equipBtnText.setText(t('selectSkin'));
            this.statusText.setText('');
        }
    }

    resize(gameSize: Phaser.Structs.Size) {
        const cx = gameSize.width / 2;
        const cy = gameSize.height / 2;

        if (this.titleText) this.titleText.setPosition(cx, Math.min(80, gameSize.height * 0.1));
        if (this.previewContainer) this.previewContainer.setPosition(cx, cy - 60);

        const sideOffset = Math.min(150, cx - 40);
        if (this.prevBtnBg) {
            this.prevBtnBg.setPosition(cx - sideOffset, cy - 60);
            this.prevBtnText.setPosition(cx - sideOffset, cy - 60);
        }
        if (this.nextBtnBg) {
            this.nextBtnBg.setPosition(cx + sideOffset, cy - 60);
            this.nextBtnText.setPosition(cx + sideOffset, cy - 60);
        }

        if (this.styleNameText) this.styleNameText.setPosition(cx, cy + 45);
        if (this.equipBtnBg) {
            this.equipBtnBg.setPosition(cx, cy + 110);
            this.equipBtnText.setPosition(cx, cy + 110);
        }
        if (this.statusText) this.statusText.setPosition(cx, cy + 155);
        if (this.backBtnBg) {
            this.backBtnBg.setPosition(cx, Math.min(cy + 215, gameSize.height - 40));
            this.backBtnText.setPosition(cx, Math.min(cy + 215, gameSize.height - 40));
        }
    }
}
