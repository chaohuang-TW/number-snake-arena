import Phaser from 'phaser';
import { HEAD_SKIN_LIST } from '../config/headSkins';
import { CosmeticsManager } from '../models/Cosmetics';
import { VisualPreferencesManager } from '../models/VisualPreferences';
import { t } from '../i18n';
import { arcadeButton, roundedPanel, sceneBackdrop, safeInsets, uiText, ARCADE } from '../ui/ArcadeStyle';

export class CustomizeScene extends Phaser.Scene {
    private selectedIndex = 0;
    public styleNameText!: Phaser.GameObjects.Text;
    public equipBtnBg!: Phaser.GameObjects.Rectangle;
    public prevBtnBg!: Phaser.GameObjects.Rectangle;
    public nextBtnBg!: Phaser.GameObjects.Rectangle;
    constructor() { super('CustomizeScene'); }
    create() {
        CosmeticsManager.load(); VisualPreferencesManager.load();
        this.selectedIndex = Math.max(0, HEAD_SKIN_LIST.findIndex(skin => skin.id === CosmeticsManager.getSelectedHeadSkin()));
        this.render();
        this.scale.on('resize', this.resize, this);
        this.events.once('shutdown', () => this.scale.off('resize', this.resize, this));
    }
    private render() {
        this.children.removeAll(true);
        sceneBackdrop(this);
        const w = this.scale.width, h = this.scale.height, safe = safeInsets(this), landscape = w > h, cx = w / 2;
        const previewX = landscape ? w * 0.27 : cx, previewY = landscape ? h * 0.4 : safe.top + 172;
        const prefsX = landscape ? w * 0.73 : cx, paneW = landscape ? Math.min(390, w * 0.45) : Math.min(390, w - safe.left - safe.right - 32);
        uiText(this, cx, safe.top + 38, t('customizeTitle'), 30, '#b9fff0');
        if (!landscape) uiText(this, cx, safe.top + 77, t('allSkinsFree'), 16, ARCADE.muted);
        const skin = HEAD_SKIN_LIST[this.selectedIndex], equipped = CosmeticsManager.getSelectedHeadSkin() === skin.id;
        const panel = roundedPanel(this, previewX, previewY, landscape ? Math.min(340, w * 0.4) : paneW, 136, 0x132b3b, 0x386b6c);
        panel.setAlpha(0.8);
        // A complete short snake, including tapered tail and a curved continuous body.
        const fullPreview = this.add.container(previewX, previewY);
        for (let i = 7; i >= 1; i--) {
            const px = 70 - i * 22, py = Math.sin(i * 0.65) * 15;
            fullPreview.add(this.add.image(px, py, i === 7 ? 'player_tail' : 'player_body').setScale(i >= 5 ? 1.1 - (i - 5) * 0.14 : 1.5));
        }
        fullPreview.add(this.add.image(83, 0, skin.playerTexture).setScale(1.6));
        fullPreview.add(uiText(this, 83, -51, '10', 24));
        const arrowOffset = landscape ? Math.min(170, w * 0.205) : (paneW / 2 - 20);
        this.prevBtnBg = arcadeButton(this, previewX - arrowOffset, previewY, 48, '‹', () => this.navigate(-1), 'prevSkinBtn', false).bg;
        this.nextBtnBg = arcadeButton(this, previewX + arrowOffset, previewY, 48, '›', () => this.navigate(1), 'nextSkinBtn', false).bg;
        this.styleNameText = uiText(this, previewX, previewY + 89, t(skin.nameKey), 22, '#c6fff1');
        this.equipBtnBg = arcadeButton(this, previewX, previewY + 139, 224, t(equipped ? 'equippedSkin' : 'selectSkin'), () => this.equipSelectedSkin(), 'equipSkinBtn', !equipped).bg;
        const preferences = VisualPreferencesManager.get();
        const headingY = landscape ? safe.top + 85 : safe.top + 379;
        uiText(this, prefsX, headingY, t('opponentStyle'), 20);
        arcadeButton(this, prefsX - 82, headingY + 45, 150, t('opponentRandom'), () => { VisualPreferencesManager.set({ opponentStyleMode: 'random' }); this.render(); }, 'opponentRandomBtn', preferences.opponentStyleMode === 'random');
        arcadeButton(this, prefsX + 82, headingY + 45, 150, t('opponentSpecified'), () => { VisualPreferencesManager.set({ opponentStyleMode: 'specified' }); this.render(); }, 'opponentSpecifiedBtn', preferences.opponentStyleMode === 'specified');
        const opponentSkin = HEAD_SKIN_LIST.find(item => item.id === preferences.opponentHeadSkin) || HEAD_SKIN_LIST[0];
        const selectorY = headingY + 111;
        const specified = preferences.opponentStyleMode === 'specified';
        const name = uiText(this, prefsX, selectorY, specified ? t(opponentSkin.nameKey) : t('allSkinsFree'), 18, specified ? '#c6fff1' : ARCADE.muted);
        name.setName('opponentSkinName');
        if (specified) {
            arcadeButton(this, prefsX - 135, selectorY, 48, '‹', () => this.navigateOpponent(-1), 'prevOpponentSkinBtn', false);
            arcadeButton(this, prefsX + 135, selectorY, 48, '›', () => this.navigateOpponent(1), 'nextOpponentSkinBtn', false);
        }
        const settingsY = landscape ? headingY + 176 : headingY + 202;
        arcadeButton(this, prefsX, settingsY, Math.min(paneW - 12, 330), `${t('reducedMotion')}: ${t(preferences.reducedMotion ? 'enabled' : 'disabled')}`, () => { VisualPreferencesManager.set({ reducedMotion: !preferences.reducedMotion }); this.render(); }, 'reducedMotionBtn', false);
        arcadeButton(this, prefsX, settingsY + 62, Math.min(paneW - 12, 330), `${t('lowEffects')}: ${t(preferences.lowEffects ? 'enabled' : 'disabled')}`, () => { VisualPreferencesManager.set({ lowEffects: !preferences.lowEffects }); this.render(); }, 'lowEffectsBtn', false);
        arcadeButton(this, landscape ? previewX : cx, h - safe.bottom - 43, 224, t('backBtn'), () => this.scene.start('MenuScene'), 'backBtn', false);
    }
    private navigate(direction: number) { this.selectedIndex = (this.selectedIndex + direction + HEAD_SKIN_LIST.length) % HEAD_SKIN_LIST.length; this.render(); }
    private navigateOpponent(direction: number) {
        const current = HEAD_SKIN_LIST.findIndex(item => item.id === VisualPreferencesManager.get().opponentHeadSkin);
        VisualPreferencesManager.set({ opponentHeadSkin: HEAD_SKIN_LIST[(current + direction + HEAD_SKIN_LIST.length) % HEAD_SKIN_LIST.length].id });
        this.render();
    }
    private equipSelectedSkin() { CosmeticsManager.setSelectedHeadSkin(HEAD_SKIN_LIST[this.selectedIndex].id); this.render(); }
    resize(_gameSize: Phaser.Structs.Size) { this.render(); }
}
