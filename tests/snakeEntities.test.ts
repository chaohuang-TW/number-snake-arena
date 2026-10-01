import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Math: { Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)) } } }));

import { PlayerSnake } from '../src/entities/PlayerSnake';
import { NumberEnemy } from '../src/entities/NumberEnemy';
import { GameBalance } from '../src/config/gameBalance';
import { HEAD_SKIN_LIST } from '../src/config/headSkins';
import { calculateRenderSegments, calculateSnakeLength, measurePath } from '../src/systems/SnakePath';
import { applyWheelReward, WHEEL_REWARDS } from '../src/utils/luckyWheel';
import { getTailTextureKey } from '../src/utils/snakeAppearance';

function fakeScene() {
    const timers: { callback: () => void; removed: boolean; remove: () => void }[] = [];
    const tweens: { stopped: boolean; stop: () => void; onComplete?: () => void }[] = [];
    function image(x: number, y: number, texture: string) {
        const object: any = {
            x, y, width: 64, height: 64, visible: true, alpha: 1, texture: { key: texture },
            body: { velocity: { x: 0, y: 0 }, reset: (nextX: number, nextY: number) => {
                object.x = nextX; object.y = nextY;
                object.body.velocity = { x: 0, y: 0 };
            } },
            setPosition: (nextX: number, nextY: number) => { object.x = nextX; object.y = nextY; return object; },
            setX: (nextX: number) => { object.x = nextX; return object; },
            setY: (nextY: number) => { object.y = nextY; return object; },
            setVelocity: (vx: number, vy: number) => { object.body.velocity = { x: vx, y: vy }; return object; },
            setVelocityX: (vx: number) => { object.body.velocity.x = vx; return object; },
            setVelocityY: (vy: number) => { object.body.velocity.y = vy; return object; },
            setVisible: (visible: boolean) => { object.visible = visible; return object; },
            setAlpha: (alpha: number) => { object.alpha = alpha; return object; },
            setTexture: (key: string) => { object.texture.key = key; return object; },
            setCircle: (radius: number, offsetX: number, offsetY: number) => { object.collider = { radius, offsetX, offsetY }; return object; },
            setText: (text: string) => { object.text = text; return object; },
            setRotation: (rotation: number) => { object.rotation = rotation; return object; },
            setScale: (scaleX: number, scaleY = scaleX) => { object.scaleX = scaleX; object.scaleY = scaleY; return object; },
            destroy: () => { object.destroyed = true; }
        };
        for (const method of ['setDepth', 'setDrag', 'setOrigin', 'clear', 'fillStyle', 'fillCircle', 'lineStyle', 'strokeCircle', 'strokeRoundedRect', 'lineBetween']) object[method] = () => object;
        return object;
    }
    const scene: any = {
        textures: { exists: () => true },
        physics: { add: { image } },
        add: { image, text: (x: number, y: number) => image(x, y, 'text'), graphics: () => image(0, 0, 'graphics') },
        time: { delayedCall: (_delay: number, callback: () => void) => {
            const timer = { callback, removed: false, remove() { timer.removed = true; } };
            timers.push(timer); return timer;
        } },
        tweens: { add: (config: { onComplete?: () => void }) => {
            const tween = { stopped: false, stop() { tween.stopped = true; }, onComplete: config.onComplete };
            tweens.push(tween); return tween;
        } }
    };
    return { scene, timers, tweens };
}

describe('Entity length and motion integration', () => {
    it.each([5, 7, 10])('warms up Player and same-value AI from Value %s without collidable stacked tails', value => {
        const { scene } = fakeScene();
        const player = new PlayerSnake(scene, 0, 0, value, 3, 'classic');
        const enemy = new NumberEnemy(scene, 200, 0, value, 'classic');
        expect(player.targetLength).toBe(enemy.targetLength);
        expect(player.segments).toBe(calculateRenderSegments(value));
        expect(player.bodySprites.every(sprite => !sprite.visible)).toBe(true);
        expect(enemy.bodySprites.every(sprite => !sprite.visible)).toBe(true);
        expect(player.pathLength).toBe(0);
        expect(enemy.getDropPositions()).toEqual([]);
    });

    it('updates Value through direct assignment, eating and the real wheel reward helper', () => {
        const { scene } = fakeScene();
        const player = new PlayerSnake(scene, 0, 0, 5, 3, 'classic');
        player.value = 10;
        expect(player.targetLength).toBe(calculateSnakeLength(10));
        player.eat(40);
        expect(player.value).toBe(50);
        expect(player.targetLength).toBe(calculateSnakeLength(50));
        applyWheelReward(player, WHEEL_REWARDS[0]);
        expect(player.value).toBe(150);
        expect(player.targetLength).toBe(calculateSnakeLength(150));
        expect(player.segments).toBe(calculateRenderSegments(150));
        // Compatibility assignments cannot restore an obsolete fixed-length snake.
        player.segments = 5;
        expect(player.segments).toBe(calculateRenderSegments(150));
        player.value = NaN;
        expect(player.value).toBe(150);
    });

    it('Value increases leave normal/boost speed and steering response unchanged', () => {
        const { scene } = fakeScene();
        const short = new PlayerSnake(scene, 0, 0, 5, 3, 'classic');
        const long = new PlayerSnake(scene, 0, 0, 500, 3, 'classic');
        for (const player of [short, long]) player.setDesiredDirection(0, 1);
        short.update(16, false); long.update(16, false);
        expect(short.currentAngle).toBe(long.currentAngle);
        expect(Math.hypot(short.head.body!.velocity.x, short.head.body!.velocity.y)).toBeCloseTo(220);
        expect(Math.hypot(long.head.body!.velocity.x, long.head.body!.velocity.y)).toBeCloseTo(220);
        short.update(16, true); long.update(16, true);
        expect(Math.hypot(short.head.body!.velocity.x, short.head.body!.velocity.y)).toBeCloseTo(340);
        expect(Math.hypot(long.head.body!.velocity.x, long.head.body!.velocity.y)).toBeCloseTo(340);
    });

    it('resetSteering restores initial turning after 45 eats while preserving Value-derived length and angles', () => {
        const { scene } = fakeScene();
        const player = new PlayerSnake(scene, 0, 0, 10, 3, 'classic');
        const fresh = new PlayerSnake(scene, 0, 0, 10, 3, 'classic');
        for (let i = 0; i < 45; i++) player.eat(1);
        player.value = 10;
        for (const snake of [player, fresh]) snake.setDesiredDirection(0, 1);
        player.update(16, false);
        fresh.update(16, false);
        expect(player.currentAngle).toBeCloseTo(fresh.currentAngle * (1 - GameBalance.player.maxTurnRatePenalty));

        player.path.seed([{ x: 0, y: 0 }, { x: -150, y: 0 }]);
        for (const snake of [player, fresh]) {
            snake.currentAngle = 0.45;
            snake.targetAngle = -0.7;
        }
        const length = player.pathLength;
        player.resetSteering();
        expect(player.currentAngle).toBe(0.45);
        expect(player.targetAngle).toBe(-0.7);
        expect(player.value).toBe(10);
        expect(player.targetLength).toBe(calculateSnakeLength(10));
        expect(player.pathLength).toBe(length);
        player.update(16, false);
        fresh.update(16, false);
        expect(player.currentAngle).toBeCloseTo(fresh.currentAngle);
        expect(player.value).toBe(10);
        expect(player.targetLength).toBe(calculateSnakeLength(10));
    });

    it('damage loses HP, preserves Value and body length, and cleans up its pending effects', () => {
        const { scene, timers, tweens } = fakeScene();
        const player = new PlayerSnake(scene, 0, 0, 100, 3, 'classic');
        player.path.seed([{ x: 0, y: 0 }, { x: -400, y: 0 }]);
        player.updateBodySprites();
        player.takeDamage(1, 2, { x: 1, y: 0 } as any);
        expect(player.hp).toBe(2);
        expect(player.value).toBe(100);
        expect(player.targetLength).toBe(276);
        expect(player.segments).toBe(16);
        expect(player.pathLength).toBe(276);
        player.destroy();
        expect(timers[0].removed).toBe(true);
        expect(tweens[0].stopped).toBe(true);
        expect(player.bodySprites).toEqual([]);
    });

    it('body recoil survives player update without granting damage invulnerability', () => {
        const { scene } = fakeScene();
        const player = new PlayerSnake(scene, 0, 0, 10, 3, 'classic');
        player.applyRecoil({ x: 0, y: -1 });
        player.update(16, true);
        expect(player.head.body!.velocity).toEqual({ x: 0, y: -260 });
        expect(player.recoilRemainingMs).toBe(134);
        expect(player.isInvulnerable).toBe(false);
        expect(player.isStunned).toBe(false);
        expect(player.hp).toBe(3);
        expect(player.value).toBe(10);
        player.update(134, false);
        expect(player.head.body!.velocity).toEqual({ x: 0, y: -260 });
        player.update(16, false);
        expect(player.head.body!.velocity).toEqual({ x: 220, y: 0 });
    });

    it('body recoil survives AI steering and safe zero-vector recoil cannot become NaN', () => {
        const { scene } = fakeScene();
        const enemy = new NumberEnemy(scene, 0, 0, 10, 'classic');
        enemy.applyRecoil({ x: 1, y: 0 });
        enemy.update(16, 100, 0, 5);
        expect(enemy.body.body!.velocity).toEqual({ x: 260, y: 0 });
        enemy.applyRecoil({ x: NaN, y: 0 });
        enemy.update(16, 100, 0, 5);
        expect(Number.isFinite(enemy.body.body!.velocity.x)).toBe(true);
        expect(Number.isFinite(enemy.body.body!.velocity.y)).toBe(true);
    });

    it('post-physics sync closes the one-frame head/path gap without overriding recoil', () => {
        const { scene } = fakeScene();
        const player = new PlayerSnake(scene, 0, 0, 10, 3, 'classic');
        player.path.seed([{ x: 0, y: 0 }, { x: -200, y: 0 }]);
        player.applyRecoil({ x: 0, y: 1 });
        player.update(16, false);
        // Model Arcade's later sprite reconciliation using only position setup.
        player.head.setPosition(0, 8);
        const velocity = { ...player.head.body!.velocity };
        const remaining = player.recoilRemainingMs;
        player.syncMotionTrail();
        expect(player.getVisiblePath()[0]).toEqual({ x: 0, y: 8 });
        const first = player.bodySprites.find(sprite => sprite.visible)!;
        expect(Math.hypot(player.head.x - first.x, player.head.y - first.y)).toBeLessThanOrEqual(18);
        expect(player.head.body!.velocity).toEqual(velocity);
        expect(player.recoilRemainingMs).toBe(remaining);
    });

    it('small separation moves the visible trail with the synchronized collider; teleport clears it', () => {
        const { scene } = fakeScene();
        const player = new PlayerSnake(scene, 0, 0, 50, 3, 'classic');
        player.path.seed([{ x: 0, y: 0 }, { x: -300, y: 0 }]);
        const before = player.getVisiblePath();
        player.separateFromBody(12, 10);
        expect(player.head.x).toBe(12);
        expect(player.head.y).toBe(10);
        expect(player.getVisiblePath()).toEqual(before.map(point => ({ x: point.x + 12, y: point.y + 10 })));
        expect(measurePath(player.getVisiblePath())).toBeCloseTo(player.targetLength);
        player.teleport(200, 200);
        expect(player.getDropPositions()).toEqual([]);
        expect(player.bodySprites.every(sprite => !sprite.visible)).toBe(true);
        expect(player.targetLength).toBe(calculateSnakeLength(50));
    });

    it('all skins retain the same centered hit circles despite padded accessory textures', () => {
        const { scene } = fakeScene();
        for (const skin of HEAD_SKIN_LIST) {
            const player = new PlayerSnake(scene, 0, 0, 5, 3, skin.id);
            const enemy = new NumberEnemy(scene, 0, 0, 5, skin.id);
            expect((player.head as any).collider).toEqual({ radius: 20, offsetX: 12, offsetY: 12 });
            expect((enemy.body as any).collider).toEqual({ radius: 18, offsetX: 14, offsetY: 14 });
        }
        expect(GameBalance.player.maxBoostEnergy).toBe(100);
    });

    it.each(['player', 'enemy'] as const)('%s curved drawing stays unrotated with uniform taper and unchanged path/collider', kind => {
        const { scene } = fakeScene();
        const snake = kind === 'player' ? new PlayerSnake(scene, 0, 0, 100, 3, 'classic') : new NumberEnemy(scene, 0, 0, 100, 'classic');
        const head = snake instanceof PlayerSnake ? snake.head : snake.body;
        snake.path.seed([{ x: 0, y: 0 }, { x: -55, y: -20 }, { x: -100, y: -70 }, { x: -155, y: -40 }, { x: -210, y: -95 }, { x: -265, y: -20 }, { x: -320, y: -100 }]);
        head.setVelocity(123, -76);
        const path = snake.getVisiblePath();
        const samples = snake.path.getVisibleSamples();
        expect(samples.some(sample => Math.abs(sample.angle) > 0.2)).toBe(true);
        snake.updateBodySprites();

        const sprites = snake.bodySprites.filter(sprite => sprite.visible);
        expect(sprites).toHaveLength(calculateRenderSegments(100));
        expect(sprites.map(sprite => ({ x: sprite.x, y: sprite.y }))).toEqual(samples.map(sample => ({ x: sample.x, y: sample.y })));
        expect(sprites.every(sprite => sprite.rotation === 0 && sprite.scaleX === sprite.scaleY)).toBe(true);
        for (let i = 1; i < sprites.length; i++) {
            expect(Math.hypot(sprites[i].x - sprites[i - 1].x, sprites[i].y - sprites[i - 1].y)).toBeLessThanOrEqual(18.000001);
        }
        expect(sprites.slice(-3).map(sprite => [sprite.scaleX, sprite.scaleY])).toEqual([[0.85, 0.85], [0.65, 0.65], [1, 1]]);
        expect(sprites.slice(0, -1).every(sprite => sprite.texture.key === `${kind}_body`)).toBe(true);
        expect(sprites.at(-1)!.texture.key).toBe(getTailTextureKey(kind, samples.at(-1)!.angle + Math.PI));
        expect(sprites.at(-1)!.texture.key).toMatch(new RegExp(`^${kind}_tail_dir_(?:[0-9]|[12][0-9]|3[01])$`));
        expect(snake.getVisiblePath()).toEqual(path);
        expect(measurePath(path)).toBeCloseTo(276);
        expect(snake.pathLength).toBeCloseTo(276);
        expect(snake.targetLength).toBe(276);
        expect(snake.value).toBe(100);
        expect(head.body!.velocity).toEqual({ x: 123, y: -76 });
        expect({ x: head.x, y: head.y }).toEqual({ x: 0, y: 0 });
        expect((head as any).collider.radius).toBe(kind === 'player' ? 20 : 18);
    });

    it.each([
        ['player', 'legacy'], ['player', 'body'], ['enemy', 'legacy'], ['enemy', 'body']
    ] as const)('%s tip safely falls back to %s when baked direction textures are missing', (kind, fallback) => {
        const { scene } = fakeScene();
        scene.textures.exists = (key: string) => !key.startsWith(`${kind}_tail_dir_`) && (fallback === 'legacy' || key !== `${kind}_tail`);
        const snake = kind === 'player' ? new PlayerSnake(scene, 0, 0, 10, 3, 'classic') : new NumberEnemy(scene, 0, 0, 10, 'classic');
        snake.path.seed([{ x: 0, y: 0 }, { x: -150, y: 80 }]);
        snake.updateBodySprites();
        const tip = snake.bodySprites.filter(sprite => sprite.visible).at(-1)!;
        expect(tip.texture.key).toBe(`${kind}_${fallback === 'legacy' ? 'tail' : 'body'}`);
        expect(tip.rotation).toBe(0);
        expect(tip.scaleX).toBe(1);
        expect(tip.scaleY).toBe(1);
        expect(Number.isFinite(tip.x) && Number.isFinite(tip.y)).toBe(true);
    });
});
