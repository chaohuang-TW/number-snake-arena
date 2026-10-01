import Phaser from 'phaser';
import { ProgressionManager } from '../models/Progression';
import { LEVELS } from '../config/levels';
import { t, getLanguage, setLanguage } from '../i18n';
import { arcadeButton, roundedPanel, sceneBackdrop, safeInsets, uiText, ARCADE } from '../ui/ArcadeStyle';

export class MenuScene extends Phaser.Scene {
    public levelCards: Phaser.GameObjects.Container[] = [];
    public tutorialText!: Phaser.GameObjects.Text;
    constructor() { super('MenuScene'); }
    create() {
        ProgressionManager.load();
        this.render();
        this.scale.on('resize', this.resize, this);
        this.events.once('shutdown', () => this.scale.off('resize', this.resize, this));
    }
    private render() {
        this.children.removeAll(true);
        this.levelCards = [];
        sceneBackdrop(this);
        const w = this.scale.width, h = this.scale.height, cx = w / 2, safe = safeInsets(this), short = h < 500;
        const languageY = safe.top + 32;
        arcadeButton(this, w - safe.right - 111, languageY, 74, t('langZh'), () => { if (getLanguage() !== 'zh-TW') { setLanguage('zh-TW'); this.render(); } }, 'langBtn_zh', getLanguage() === 'zh-TW');
        arcadeButton(this, w - safe.right - 35, languageY, 62, t('langEn'), () => { if (getLanguage() !== 'en') { setLanguage('en'); this.render(); } }, 'langBtn_en', getLanguage() === 'en');
        uiText(this, cx, safe.top + (short ? 34 : 88), t('menuTitle'), getLanguage() === 'en' ? (w < 600 ? 24 : 32) : 34, '#b9fff0');
        if (!short) uiText(this, cx, safe.top + 130, t('levelSelect'), 18, ARCADE.muted);
        arcadeButton(this, cx, safe.top + (short ? 100 : 180), 210, t('customize'), () => this.scene.start('CustomizeScene'), 'customizeBtn', false);
        this.createLevelCards(cx, h / 2);
        this.tutorialText = uiText(this, cx, h - safe.bottom - 28, t('tutorialText'), 16, ARCADE.muted);
        this.tutorialText.setWordWrapWidth(w - safe.left - safe.right - 36);
        try { localStorage.setItem('tutorialSeen', 'true'); } catch { /* Tutorial remains usable without storage. */ }
    }
    createLevelCards(cx: number, _cy: number) {
        this.levelCards.forEach(card => card.destroy());
        this.levelCards = [];
        const w = this.scale.width, h = this.scale.height, portrait = h > w, short = h < 500, safe = safeInsets(this);
        const cols = portrait ? 2 : 4, rows = Math.ceil(4 / cols), gap = 14;
        const cardW = Math.min(portrait ? 190 : 230, (w - safe.left - safe.right - 32 - gap * (cols - 1)) / cols);
        const top = safe.top + (short ? 140 : 228), bottom = h - safe.bottom - 66;
        const cardH = Math.min(portrait ? 210 : 230, (bottom - top - gap * (rows - 1)) / rows);
        const totalW = cols * cardW + (cols - 1) * gap;
        const highest = ProgressionManager.getHighestUnlockedLevel();
        Object.values(LEVELS).forEach((level, index) => {
            const x = cx - totalW / 2 + cardW / 2 + (index % cols) * (cardW + gap);
            const y = top + cardH / 2 + Math.floor(index / cols) * (cardH + gap);
            this.levelCards.push(this.createCard(x, y, level.id, highest >= level.id, cardW, cardH));
        });
    }
    createCard(x: number, y: number, levelId: number, unlocked: boolean, width = 180, height = 220) {
        const container = this.add.container(x, y), level = LEVELS[levelId];
        const accent = [0x81efdc, 0xf5a4bc, 0xffb978, 0xbcb6ff][levelId - 1];
        const panel = roundedPanel(this, 0, 0, width, height, unlocked ? ARCADE.panel : 0x101c29, unlocked ? accent : ARCADE.border);
        const themeKey = ['themeNeon', 'themeCity', 'themeLava', 'themeSpace'][levelId - 1];
        const title = uiText(this, 0, -height / 2 + 28, t(`level_${levelId}`), 21, unlocked ? ARCADE.text : ARCADE.muted);
        const theme = uiText(this, 0, -height / 2 + 55, t(themeKey), 16, ARCADE.muted);
        const boss = uiText(this, 0, -height / 2 + 80, t('bossLabel', { value: level.bossValue }), 18, '#ffbdc8');
        container.add([panel, title, theme, boss]);
        if (unlocked) {
            const score = uiText(this, 0, height / 2 - 76, `${t('bestLabel')}${ProgressionManager.getBestScore(levelId)}`, 16, ARCADE.muted);
            const button = arcadeButton(this, 0, height / 2 - 35, width - 24, t('start'), () => this.openPrep(levelId), `startBtn_${levelId}`);
            container.add([score, button.art, button.bg, button.label]);
        } else container.add(uiText(this, 0, height / 2 - 40, t('locked'), 18, ARCADE.muted));
        return container;
    }
    openPrep(levelId: number) {
        this.resumeAudio();
        this.scene.start('PrepScene', { levelId });
    }
    startGame(levelId: number) { this.resumeAudio(); this.scene.start('GameScene', { levelId }); }
    private resumeAudio() {
        const context = (this.sound as any).context;
        if (context?.state === 'suspended') context.resume();
    }
    resize(_gameSize: Phaser.Structs.Size) { this.render(); }
}
