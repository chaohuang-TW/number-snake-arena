import Phaser from 'phaser';
import { GameBalance } from '../config/gameBalance';
import { calculateTurnRate } from '../utils/gameRules';
import { lerpAngle } from '../utils/math';
import { CosmeticsManager } from '../models/Cosmetics';
import { HEAD_SKINS } from '../config/headSkins';
import { DistanceSnakePath, calculateRenderSegments, normalizeSnakeValue, renderSegmentCount } from '../systems/SnakePath';
import type { SnakePoint } from '../systems/SnakePath';
import { getSnakeSectionAppearance } from '../utils/snakeAppearance';

export class PlayerSnake {
    scene: Phaser.Scene;
    head: Phaser.Physics.Arcade.Image;
    valueText: Phaser.GameObjects.Text;
    hp: number;
    maxHp: number;
    boostEnergy: number;
    headSkinId: string;
    readonly path: DistanceSnakePath;
    bodySprites: Phaser.GameObjects.Image[] = [];
    currentAngle = 0;
    targetAngle = 0;
    isInvulnerable = false;
    isStunned = false;
    recoilRemainingMs = 0;

    private _value: number;
    // Keep the original eat-count turn penalty separate from drawing resolution.
    private steeringSegments = GameBalance.player.initialSegments;
    private recoilVelocity: SnakePoint = { x: 0, y: 0 };
    private stunTimer?: Phaser.Time.TimerEvent;
    private damageTween?: Phaser.Tweens.Tween;
    private destroyed = false;

    constructor(scene: Phaser.Scene, x: number, y: number, initialValue: number, initialHP: number, customSkinId?: string) {
        this.scene = scene;
        this._value = normalizeSnakeValue(initialValue);
        this.path = new DistanceSnakePath(x, y, this._value);
        this.hp = initialHP;
        this.maxHp = initialHP;
        this.boostEnergy = GameBalance.player.maxBoostEnergy;

        const selectedSkin = customSkinId || CosmeticsManager.getSelectedHeadSkin();
        const skinDef = HEAD_SKINS[selectedSkin] || HEAD_SKINS.classic;
        this.headSkinId = skinDef.id;
        const textureKey = scene.textures.exists(skinDef.playerTexture) ? skinDef.playerTexture : 'player_head';
        this.head = scene.physics.add.image(x, y, textureKey);
        this.setHeadCollider();
        this.head.setDepth(100);
        this.valueText = scene.add.text(x, y - 42, this.value.toString(), {
            fontFamily: 'system-ui, -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif',
            fontSize: '22px', fontStyle: 'bold', color: '#ffffff', stroke: '#10263d', strokeThickness: 4
        }).setOrigin(0.5).setDepth(101);
        this.updateBodySprites();
    }

    get value(): number { return this._value; }
    set value(value: number) { this.setValue(value); }
    get segments(): number { return calculateRenderSegments(this._value); }
    // Legacy reset/debug assignments cannot change Value-derived body length.
    set segments(_segments: number) { this.updateBodySprites(); }
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

    resetSteering(): void {
        this.steeringSegments = GameBalance.player.initialSegments;
    }

    setHeadSkin(skinId: string): void {
        const skinDef = HEAD_SKINS[skinId];
        if (!skinDef) return;
        this.headSkinId = skinDef.id;
        this.head.setTexture(this.scene.textures.exists(skinDef.playerTexture) ? skinDef.playerTexture : 'player_head');
        this.setHeadCollider();
    }

    private setHeadCollider(): void {
        // Accessories may extend outside the circle; all skins share the same radius.
        const radius = 20;
        this.head.setCircle(radius, this.head.width / 2 - radius, this.head.height / 2 - radius);
    }

    setDesiredDirection(dx: number, dy: number): void {
        if (!this.isStunned && (dx !== 0 || dy !== 0)) this.targetAngle = Math.atan2(dy, dx);
    }

    update(dt: number, isBoosting: boolean): void {
        if (this.destroyed) return;
        const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
        if (this.isRecoiling) {
            this.head.setDrag(0);
            this.head.setVelocity(this.recoilVelocity.x, this.recoilVelocity.y);
            this.recoilRemainingMs = Math.max(0, this.recoilRemainingMs - elapsed);
        } else if (!this.isStunned) {
            this.head.setDrag(0);
            const turnRate = calculateTurnRate(this.steeringSegments);
            this.currentAngle = lerpAngle(this.currentAngle, this.targetAngle, turnRate * (elapsed / 16.66));
            let speed = GameBalance.player.normalSpeed;
            if (isBoosting && this.boostEnergy > 0) {
                speed = GameBalance.player.boostSpeed;
                this.boostEnergy = Math.max(0, this.boostEnergy - GameBalance.player.boostDrainPerSec * elapsed / 1000);
            } else {
                this.boostEnergy = Math.min(GameBalance.player.maxBoostEnergy, this.boostEnergy + GameBalance.player.boostRecoveryPerSec * elapsed / 1000);
            }
            this.head.setVelocity(Math.cos(this.currentAngle) * speed, Math.sin(this.currentAngle) * speed);
        } else {
            this.head.setDrag(1000);
        }

        const hw = GameBalance.world.width / 2;
        const hh = GameBalance.world.height / 2;
        const margin = 50;
        let vx = this.head.body!.velocity.x;
        let vy = this.head.body!.velocity.y;
        if (this.head.x < -hw + margin) vx += 10;
        if (this.head.x > hw - margin) vx -= 10;
        if (this.head.y < -hh + margin) vy += 10;
        if (this.head.y > hh - margin) vy -= 10;
        this.head.setVelocity(vx, vy);
        this.head.x = Phaser.Math.Clamp(this.head.x, -hw, hw);
        this.head.y = Phaser.Math.Clamp(this.head.y, -hh, hh);
        this.path.update(this.head.x, this.head.y, elapsed);
        this.updateBodySprites();
        this.valueText.setPosition(this.head.x, this.head.y - 42);
    }

    updateBodySprites(): void {
        if (!this.head || this.destroyed) return;
        const capacity = renderSegmentCount(this.path.currentLength);
        while (this.bodySprites.length < capacity) {
            const spr = this.scene.add.image(this.head.x, this.head.y, 'player_body');
            spr.setDepth(99 - this.bodySprites.length).setVisible(false);
            this.bodySprites.push(spr);
        }
        while (this.bodySprites.length > capacity) this.bodySprites.pop()?.destroy();

        const samples = this.path.getVisibleSamples();
        for (let i = 0; i < this.bodySprites.length; i++) {
            const spr = this.bodySprites[i];
            const sample = samples[i];
            spr.setVisible(!!sample);
            if (!sample) continue;
            const appearance = getSnakeSectionAppearance('player', i, samples.length, sample.angle);
            const texture = this.scene.textures.exists(appearance.texture) ? appearance.texture
                : appearance.isTail && this.scene.textures.exists('player_tail') ? 'player_tail' : 'player_body';
            if (spr.texture.key !== texture) spr.setTexture(texture);
            spr.setPosition(sample.x, sample.y).setRotation(appearance.rotation).setScale(appearance.scale, appearance.scale);
        }
    }

    getVisiblePath(): SnakePoint[] { return this.path.getVisiblePath(); }

    /** Arcade reconciles sprite positions after Scene.update; align visuals then too. */
    syncMotionTrail(): void {
        if (this.destroyed) return;
        this.path.update(this.head.x, this.head.y, 0);
        this.updateBodySprites();
        this.valueText.setPosition(this.head.x, this.head.y - 42);
    }

    getDropPositions(): SnakePoint[] {
        return this.path.getVisibleSamples().map(({ x, y }) => ({ x, y }));
    }

    applyRecoil(direction: SnakePoint, speed = GameBalance.bodyCollision.recoilSpeed, durationMs = GameBalance.bodyCollision.recoilDurationMs): void {
        let dx = Number.isFinite(direction.x) ? direction.x : 0;
        let dy = Number.isFinite(direction.y) ? direction.y : 0;
        const length = Math.hypot(dx, dy);
        if (length > 0.000001) { dx /= length; dy /= length; }
        else { dx = -Math.cos(this.currentAngle); dy = -Math.sin(this.currentAngle); }
        const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : GameBalance.bodyCollision.recoilSpeed;
        this.recoilVelocity = { x: dx * safeSpeed, y: dy * safeSpeed };
        this.recoilRemainingMs = Number.isFinite(durationMs) ? Math.max(0, durationMs) : GameBalance.bodyCollision.recoilDurationMs;
        this.head.setDrag(0).setVelocity(this.recoilVelocity.x, this.recoilVelocity.y);
    }

    separateFromBody(dx: number, dy: number): void {
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
        const vx = this.head.body!.velocity.x;
        const vy = this.head.body!.velocity.y;
        this.path.translate(dx, dy);
        (this.head.body as Phaser.Physics.Arcade.Body).reset(this.head.x + dx, this.head.y + dy);
        this.head.setVelocity(vx, vy);
        this.updateBodySprites();
        this.valueText.setPosition(this.head.x, this.head.y - 42);
    }

    seedPathForTest(points: SnakePoint[]): void {
        if (typeof window === 'undefined' || new URLSearchParams(window.location.search).get('debug') !== '1') return;
        const hw = GameBalance.world.width / 2;
        const hh = GameBalance.world.height / 2;
        if (!points.length || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > hw || Math.abs(point.y) > hh)) return;
        this.path.seed(points);
        (this.head.body as Phaser.Physics.Arcade.Body).reset(points[0].x, points[0].y);
        this.updateBodySprites();
        this.valueText.setPosition(this.head.x, this.head.y - 42);
    }

    takeDamage(hpLoss: number, _newSegments: number, knockbackDir: Phaser.Math.Vector2): void {
        this.hp -= hpLoss;
        this.isInvulnerable = true;
        this.isStunned = true;
        this.recoilRemainingMs = 0;
        this.head.setVelocity(knockbackDir.x * 500, knockbackDir.y * 500);
        this.damageTween?.stop();
        this.damageTween = this.scene.tweens.add({
            targets: [this.head, ...this.bodySprites], alpha: 0.45, yoyo: true, repeat: 3,
            duration: GameBalance.player.invulnerabilityDuration / 8,
            onComplete: () => {
                if (this.destroyed) return;
                this.head.setAlpha(1);
                this.bodySprites.forEach(spr => spr.setAlpha(1));
                this.isInvulnerable = false;
            }
        });
        this.stunTimer?.remove(false);
        this.stunTimer = this.scene.time.delayedCall(GameBalance.player.hitStunDuration, () => {
            this.isStunned = false;
            this.targetAngle = this.currentAngle;
            this.head.setDrag(0);
        });
    }

    eat(addedValue: number): void {
        this.updateValue(addedValue);
        this.steeringSegments += 1;
        this.boostEnergy = Math.min(GameBalance.player.maxBoostEnergy, this.boostEnergy + GameBalance.player.boostEatRecovery);
    }

    teleport(x: number, y: number): void {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        (this.head.body as Phaser.Physics.Arcade.Body).reset(x, y);
        this.head.setVelocity(0, 0).setDrag(0);
        this.path.reset(x, y);
        this.recoilRemainingMs = 0;
        this.updateBodySprites();
        this.valueText.setPosition(x, y - 42);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.stunTimer?.remove(false);
        this.damageTween?.stop();
        this.head.destroy();
        this.valueText.destroy();
        this.bodySprites.forEach(spr => spr.destroy());
        this.bodySprites.length = 0;
        this.recoilRemainingMs = 0;
    }
}
