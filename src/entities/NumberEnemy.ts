import Phaser from 'phaser';
import { GameBalance } from '../config/gameBalance';
import { distance, getBoundarySteering } from '../utils/math';
import { HEAD_SKINS } from '../config/headSkins';
import { getTailScale } from '../utils/gameRules';
import { DistanceSnakePath, calculateRenderSegments, normalizeSnakeValue, renderSegmentCount } from '../systems/SnakePath';
import type { SnakePoint } from '../systems/SnakePath';

export enum EnemyState { WANDER, FLEE, CHASE }

export class NumberEnemy {
    public static readonly NAME_POOL = ['NOVA', 'BYTE', 'VOLT', 'PIXEL', 'NEXUS', 'COMET', 'SPARK', 'ORBIT', 'NEON', 'PULSE', 'QUARK', 'FLUX'];
    private static nextEnemyIndex = 1;
    public static resetEnemyIdCounter() { NumberEnemy.nextEnemyIndex = 1; }

    scene: Phaser.Scene;
    body: Phaser.Physics.Arcade.Image;
    valueText: Phaser.GameObjects.Text;
    glow: Phaser.GameObjects.Graphics;
    state: EnemyState = EnemyState.WANDER;
    headSkinId: string;
    arenaId: string;
    arenaName: string;
    bodySprites: Phaser.GameObjects.Image[] = [];
    readonly path: DistanceSnakePath;
    currentThreatType = 0;
    recoilRemainingMs = 0;

    private _value: number;
    private wanderAngle = 0;
    private wanderTimer = 0;
    private recoilVelocity: SnakePoint = { x: 0, y: 0 };
    private destroyed = false;

    constructor(scene: Phaser.Scene, x: number, y: number, value: number, skinStyle?: string) {
        this.scene = scene;
        this._value = normalizeSnakeValue(value);
        this.path = new DistanceSnakePath(x, y, this._value);
        const idNum = NumberEnemy.nextEnemyIndex++;
        this.arenaId = `enemy_${idNum}`;
        const nameIdx = (idNum - 1) % NumberEnemy.NAME_POOL.length;
        const cycle = Math.floor((idNum - 1) / NumberEnemy.NAME_POOL.length);
        this.arenaName = cycle === 0 ? NumberEnemy.NAME_POOL[nameIdx] : `${NumberEnemy.NAME_POOL[nameIdx]} ${String(cycle + 1).padStart(2, '0')}`;

        const skinKeys = Object.keys(HEAD_SKINS);
        const chosenKey = skinStyle && HEAD_SKINS[skinStyle] ? skinStyle : skinKeys[Math.floor(Math.random() * skinKeys.length)];
        this.headSkinId = chosenKey;
        const skinDef = HEAD_SKINS[chosenKey] || HEAD_SKINS.classic;
        this.glow = scene.add.graphics().setDepth(49);
        const textureKey = scene.textures.exists(skinDef.enemyTexture) ? skinDef.enemyTexture : 'enemy_edible';
        this.body = scene.physics.add.image(x, y, textureKey);
        const radius = 18;
        this.body.setCircle(radius, this.body.width / 2 - radius, this.body.height / 2 - radius).setDepth(50);
        this.valueText = scene.add.text(x, y - 42, this.value.toString(), {
            fontFamily: 'system-ui, -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif',
            fontSize: '22px', fontStyle: 'bold', color: '#ffffff', stroke: '#10263d', strokeThickness: 4
        }).setOrigin(0.5).setDepth(51);
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.updateBodySprites();
        this.updateAppearance(1);
    }

    get value(): number { return this._value; }
    set value(value: number) { this.setValue(value); }
    get segments(): number { return calculateRenderSegments(this._value); }
    get history(): SnakePoint[] { return this.path.points; }
    get targetLength(): number { return this.path.targetLength; }
    get pathLength(): number { return this.path.visibleLength; }
    get isRecoiling(): boolean { return this.recoilRemainingMs > 0; }

    setValue(value: number): void {
        this._value = normalizeSnakeValue(value, this._value);
        this.path.setValue(this._value);
        this.updateBodySprites();
        this.valueText.setText(this._value.toString());
    }

    updateValue(addedValue: number): void {
        if (Number.isFinite(addedValue)) this.setValue(this._value + addedValue);
    }

    update(dt: number, playerX: number, playerY: number, playerValue: number): void {
        if (this.destroyed) return;
        const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
        const dist = distance(this.body.x, this.body.y, playerX, playerY);
        if (this.value < playerValue) {
            this.state = dist < GameBalance.enemy.fleeDistance ? EnemyState.FLEE : EnemyState.WANDER;
            this.updateAppearance(1);
        } else {
            this.state = dist < GameBalance.enemy.chaseDistance ? EnemyState.CHASE : EnemyState.WANDER;
            this.updateAppearance(this.value / playerValue >= GameBalance.damage.highRatioMin ? 3 : 2);
        }

        let speed = 0;
        let targetAngle = this.wanderAngle;
        switch (this.state) {
            case EnemyState.WANDER:
                speed = GameBalance.player.normalSpeed * 0.4;
                this.wanderTimer -= elapsed;
                if (this.wanderTimer <= 0) {
                    this.wanderAngle += (Math.random() - 0.5) * Math.PI;
                    this.wanderTimer = 1000 + Math.random() * 2000;
                }
                break;
            case EnemyState.FLEE:
                speed = GameBalance.player.normalSpeed * (this.value > playerValue * 0.45 ? GameBalance.enemy.highValuePreySpeedMultiplier : GameBalance.enemy.preySpeedMultiplier);
                targetAngle = Math.atan2(this.body.y - playerY, this.body.x - playerX);
                break;
            case EnemyState.CHASE:
                speed = GameBalance.player.normalSpeed * GameBalance.enemy.hunterSpeedMultiplier;
                targetAngle = Math.atan2(playerY - this.body.y, playerX - this.body.x);
                break;
        }

        let vx = Math.cos(targetAngle) * speed;
        let vy = Math.sin(targetAngle) * speed;
        const hw = GameBalance.world.width / 2;
        const hh = GameBalance.world.height / 2;
        const edgeMargin = 40;
        const steer = getBoundarySteering(this.body.x, this.body.y, hw, hh, 160, edgeMargin);
        if (steer.x !== 0 || steer.y !== 0) {
            vx += steer.x * speed * 1.5;
            vy += steer.y * speed * 1.5;
            const newSpeed = Math.hypot(vx, vy);
            if (newSpeed > 0) { vx = vx / newSpeed * speed; vy = vy / newSpeed * speed; }
        }

        if (this.isRecoiling) {
            this.body.setVelocity(this.recoilVelocity.x, this.recoilVelocity.y);
            this.recoilRemainingMs = Math.max(0, this.recoilRemainingMs - elapsed);
        } else this.body.setVelocity(vx, vy);

        if (this.body.x < -hw + edgeMargin) {
            this.body.setX(-hw + edgeMargin);
            if (this.body.body!.velocity.x < 0) this.body.setVelocityX(-this.body.body!.velocity.x);
        } else if (this.body.x > hw - edgeMargin) {
            this.body.setX(hw - edgeMargin);
            if (this.body.body!.velocity.x > 0) this.body.setVelocityX(-this.body.body!.velocity.x);
        }
        if (this.body.y < -hh + edgeMargin) {
            this.body.setY(-hh + edgeMargin);
            if (this.body.body!.velocity.y < 0) this.body.setVelocityY(-this.body.body!.velocity.y);
        } else if (this.body.y > hh - edgeMargin) {
            this.body.setY(hh - edgeMargin);
            if (this.body.body!.velocity.y > 0) this.body.setVelocityY(-this.body.body!.velocity.y);
        }

        this.path.update(this.body.x, this.body.y, elapsed);
        this.updateBodySprites();
        this.valueText.setPosition(this.body.x, this.body.y - 42);
        this.glow.setPosition(this.body.x, this.body.y);
    }

    updateBodySprites(): void {
        if (!this.body || this.destroyed) return;
        const capacity = renderSegmentCount(this.path.currentLength);
        while (this.bodySprites.length < capacity) {
            const spr = this.scene.add.image(this.body.x, this.body.y, 'enemy_body');
            spr.setDepth(48 - this.bodySprites.length).setVisible(false);
            this.bodySprites.push(spr);
        }
        while (this.bodySprites.length > capacity) this.bodySprites.pop()?.destroy();
        const samples = this.path.getVisibleSamples();
        for (let i = 0; i < this.bodySprites.length; i++) {
            const spr = this.bodySprites[i];
            const sample = samples[i];
            spr.setVisible(!!sample);
            if (!sample) continue;
            const isTail = i === samples.length - 1;
            const texture = isTail && this.scene.textures.exists('enemy_tail') ? 'enemy_tail' : 'enemy_body';
            if (spr.texture.key !== texture) spr.setTexture(texture);
            spr.setPosition(sample.x, sample.y).setRotation(sample.angle + (isTail ? Math.PI : 0)).setScale(1, getTailScale(i, samples.length));
        }
    }

    private updateAppearance(type: number): void {
        if (this.currentThreatType === type && this.glow.visible) return;
        this.currentThreatType = type;
        this.glow.clear();
        const color = type === 1 ? 0x68efcd : type === 2 ? 0xffc768 : 0xff8d9f;
        this.glow.fillStyle(color, 0.12).fillCircle(0, 0, type === 3 ? 30 : 26);
        this.glow.lineStyle(type === 3 ? 3 : 2, color, 0.9);
        if (type === 1) this.glow.strokeCircle(0, 0, 24);
        else if (type === 2) this.glow.strokeRoundedRect(-25, -25, 50, 50, 12);
        else this.glow.lineBetween(0, -30, 30, 0).lineBetween(30, 0, 0, 30).lineBetween(0, 30, -30, 0).lineBetween(-30, 0, 0, -30);
        // Shape and a small symbol preserve readability independently of skin colour.
        this.glow.lineStyle(2, 0xffffff, 0.95);
        if (type === 1) this.glow.lineBetween(-5, 29, 0, 34).lineBetween(0, 34, 7, 26);
        else this.glow.lineBetween(-4, 28, 4, 36).lineBetween(4, 28, -4, 36);
    }

    getVisiblePath(): SnakePoint[] { return this.path.getVisiblePath(); }

    /** Align the trail after Arcade's postupdate reconciles the head sprite. */
    syncMotionTrail(): void {
        if (this.destroyed) return;
        this.path.update(this.body.x, this.body.y, 0);
        this.updateBodySprites();
        this.valueText.setPosition(this.body.x, this.body.y - 42);
        this.glow.setPosition(this.body.x, this.body.y);
    }

    getDropPositions(): SnakePoint[] {
        return this.path.getVisibleSamples().map(({ x, y }) => ({ x, y }));
    }

    applyRecoil(direction: SnakePoint, speed = GameBalance.bodyCollision.recoilSpeed, durationMs = GameBalance.bodyCollision.recoilDurationMs): void {
        let dx = Number.isFinite(direction.x) ? direction.x : 0;
        let dy = Number.isFinite(direction.y) ? direction.y : 0;
        const length = Math.hypot(dx, dy);
        if (length > 0.000001) { dx /= length; dy /= length; }
        else { dx = -Math.cos(this.wanderAngle); dy = -Math.sin(this.wanderAngle); }
        const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : GameBalance.bodyCollision.recoilSpeed;
        this.recoilVelocity = { x: dx * safeSpeed, y: dy * safeSpeed };
        this.recoilRemainingMs = Number.isFinite(durationMs) ? Math.max(0, durationMs) : GameBalance.bodyCollision.recoilDurationMs;
        this.body.setVelocity(this.recoilVelocity.x, this.recoilVelocity.y);
    }

    separateFromBody(dx: number, dy: number): void {
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
        const vx = this.body.body!.velocity.x;
        const vy = this.body.body!.velocity.y;
        this.path.translate(dx, dy);
        (this.body.body as Phaser.Physics.Arcade.Body).reset(this.body.x + dx, this.body.y + dy);
        this.body.setVelocity(vx, vy);
        this.updateBodySprites();
        this.valueText.setPosition(this.body.x, this.body.y - 42);
        this.glow.setPosition(this.body.x, this.body.y);
    }

    seedPathForTest(points: SnakePoint[]): void {
        if (typeof window === 'undefined' || new URLSearchParams(window.location.search).get('debug') !== '1') return;
        const hw = GameBalance.world.width / 2;
        const hh = GameBalance.world.height / 2;
        if (!points.length || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > hw || Math.abs(point.y) > hh)) return;
        this.path.seed(points);
        (this.body.body as Phaser.Physics.Arcade.Body).reset(points[0].x, points[0].y);
        this.updateBodySprites();
        this.valueText.setPosition(this.body.x, this.body.y - 42);
        this.glow.setPosition(this.body.x, this.body.y);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.body.destroy();
        this.valueText.destroy();
        this.glow.destroy();
        this.bodySprites.forEach(spr => spr.destroy());
        this.bodySprites.length = 0;
        this.recoilRemainingMs = 0;
    }
}
