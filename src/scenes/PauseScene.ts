import Phaser from 'phaser';
import { t } from '../i18n';
import { arcadeButton, roundedPanel, uiText, ARCADE } from '../ui/ArcadeStyle';

export class PauseScene extends Phaser.Scene {
    constructor() { super({ key: 'PauseScene' }); }
    create() {
        this.render();
        this.scale.on('resize', this.resize, this);
        this.events.once('shutdown', () => this.scale.off('resize', this.resize, this));
    }
    private render() {
        this.children.removeAll(true);
        const w = this.scale.width, h = this.scale.height, cx = w / 2, cy = h / 2;
        this.add.rectangle(cx, cy, w, h, 0x030c17, 0.86);
        roundedPanel(this, cx, cy, Math.min(370, w - 32), 252);
        uiText(this, cx, cy - 75, t('paused'), 36, '#b9fff0');
        uiText(this, cx, cy - 26, t('pauseHint'), 18, ARCADE.muted);
        arcadeButton(this, cx, cy + 49, Math.min(290, w - 64), t('resume'), () => { this.scene.resume('GameScene'); this.scene.stop(); }, 'resumeBtn');
    }
    resize(_gameSize: Phaser.Structs.Size) { this.render(); }
}
