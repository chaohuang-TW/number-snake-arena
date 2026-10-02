import { describe, it, expect } from 'vitest';
import { BodyCollisionSystem, bodyCapsules, bodyContactOutcome, sweptCapsuleContact, type BodyActor } from '../src/systems/BodyCollision';
import { calculateBodyRecoil } from '../src/systems/Recoil';
import { GameBalance } from '../src/config/gameBalance';

const actor = (id: string, kind: BodyActor['kind'], x: number, y: number, path = [{ x, y }], value = kind === 'player' ? 10 : 100): BodyActor => ({ id, kind, value, head: { x, y }, previousHead: { x, y }, headRadius: 20, path, active: true });
const verticalEnemy = () => actor('enemy', 'enemy', 0, -160, [{ x: 0, y: -160 }, { x: 0, y: 200 }]);
const system = () => new BodyCollisionSystem(GameBalance.bodyCollision);

describe('visible-path body collision and recoil', () => {
    it.each([[9, 'eat'], [10, 'recoil'], [11, 'recoil']] as const)('player Value 10 body contact with ordinary AI Value %s resolves as %s', (value, expected) => {
        const player = actor('player', 'player', 1, 70);
        const enemy = { ...verticalEnemy(), value };
        expect(bodyContactOutcome(player, enemy)).toBe(expected);
        const collision = system();
        const contacts = collision.detect([player, enemy], 0);
        expect(contacts.filter(hit => hit.actorId === 'player')).toHaveLength(1);
        expect(collision.isCoolingDown('player', 0)).toBe(expected === 'recoil');
    });

    it('keeps AI head versus player body as recoil regardless of either Value, and excludes bosses', () => {
        const player = actor('player', 'player', 0, -160, [{ x: 0, y: -160 }, { x: 0, y: 200 }], 10);
        for (const value of [9, 10, 11]) {
            const enemy = actor('enemy', 'enemy', 1, 70, undefined, value);
            expect(bodyContactOutcome(enemy, player)).toBe('recoil');
            expect(system().detect([player, enemy], 0).map(hit => hit.actorId)).toContain('enemy');
        }
        const boss = { ...verticalEnemy(), kind: 'boss' as const, value: 1 };
        expect(bodyContactOutcome(actor('player', 'player', 1, 70), boss)).toBe(null);
        expect(bodyContactOutcome(boss, player)).toBe(null);
        expect(bodyContactOutcome(actor('other-player', 'player', 1, 70), player)).toBe(null);
        expect(bodyContactOutcome(actor('enemy', 'enemy', 1, 70, undefined, 100), actor('smaller-enemy', 'enemy', 1, 70, undefined, 1))).toBe(null);
        expect(system().detect([actor('player', 'player', 1, 70), boss], 0)).toEqual([]);
    });

    it('edible body contacts do not create a recoil cooldown and permit the next prey on the next frame', () => {
        const player = actor('player', 'player', 1, 70);
        const first = { ...verticalEnemy(), id: 'first', value: 9 };
        const second = { ...verticalEnemy(), id: 'second', value: 8 };
        const collision = system();
        const firstContacts = collision.detect([player, first, second], 1000);
        expect(firstContacts.filter(hit => hit.actorId === 'player')).toHaveLength(1);
        expect(firstContacts.find(hit => hit.actorId === 'player')?.ownerId).toBe('first');
        expect(collision.isCoolingDown('player', 1000)).toBe(false);
        expect(collision.detect([player, second], 1001).find(hit => hit.actorId === 'player')?.ownerId).toBe('second');
        expect(collision.isCoolingDown('player', 1001)).toBe(false);
    });

    it('an existing recoil cooldown still blocks another recoil but permits eating a smaller body', () => {
        const player = actor('player', 'player', 1, 70);
        const collision = system();
        expect(collision.detect([player, verticalEnemy()], 1000).find(hit => hit.actorId === 'player')).toBeDefined();
        expect(collision.isCoolingDown('player', 1001)).toBe(true);
        expect(collision.detect([player, verticalEnemy()], 1001)).toEqual([]);
        const prey = { ...verticalEnemy(), id: 'prey', value: 9 };
        expect(collision.detect([player, prey], 1001).find(hit => hit.actorId === 'player')?.ownerId).toBe('prey');
        expect(collision.isCoolingDown('player', 1001)).toBe(true);
    });

    it('prefers an actually touching smaller body over an overlapping larger body', () => {
        const player = actor('player', 'player', 1, 70);
        const threat = { ...verticalEnemy(), id: 'a-threat', value: 11 };
        const prey = { ...verticalEnemy(), id: 'z-prey', value: 9 };
        const collision = system();
        const contacts = collision.detect([player, threat, prey], 0);
        expect(contacts.filter(hit => hit.actorId === 'player')).toHaveLength(1);
        expect(contacts.find(hit => hit.actorId === 'player')?.ownerId).toBe('z-prey');
        expect(collision.isCoolingDown('player', 0)).toBe(false);
    });

    it('does not let a nearby non-touching prey hide an actual threatening body contact', () => {
        const player = actor('player', 'player', 1, 70);
        const threat = { ...verticalEnemy(), id: 'a-threat', value: 11 };
        const prey = actor('z-prey', 'enemy', 55, -160, [{ x: 55, y: -160 }, { x: 55, y: 200 }], 9);
        const collision = system();
        expect(collision.detect([player, threat, prey], 0).find(hit => hit.actorId === 'player')?.ownerId).toBe('a-threat');
        expect(collision.isCoolingDown('player', 0)).toBe(true);
    });

    it('only player/ordinary AI pairs collide; own, AI/AI and bosses never do', () => {
        const player = actor('player', 'player', 1, 70, [{ x: 1, y: 70 }, { x: 1, y: 300 }]);
        const enemy = verticalEnemy();
        expect(system().detect([player, enemy], 0).map(hit => hit.actorId)).toContain('player');
        expect(system().detect([player], 0)).toEqual([]);
        expect(system().detect([enemy, actor('enemy2', 'enemy', 1, 70)], 0)).toEqual([]);
        expect(system().detect([player, { ...enemy, kind: 'boss' }], 0)).toEqual([]);
    });

    it('head priority and dead snakes prevent a second body response', () => {
        const player = actor('player', 'player', 1, 70);
        expect(system().detect([player, verticalEnemy()], 0, new Set(['player']))).toEqual([]);
        expect(system().detect([player, { ...verticalEnemy(), active: false }], 0)).toEqual([]);
    });

    it('excludes unexpanded body and trims the neck by distance', () => {
        const enemy = verticalEnemy();
        const capsules = bodyCapsules(enemy, 44);
        expect(capsules[0].a.y).toBe(-116);
        expect(bodyCapsules({ ...enemy, path: [{ x: 0, y: -160 }] }, 44)).toEqual([]);
        expect(system().detect([actor('player', 'player', 0, -158), enemy], 0)).toEqual([]);
    });

    it('detects a fast sweep and rolls a crossing back to the entry side', () => {
        const player = { ...actor('player', 'player', 100, 70), previousHead: { x: -100, y: 70 } };
        const hit = system().detect([player, verticalEnemy()], 0)[0];
        expect(hit.normal.x).toBeLessThan(0);
        const recoil = calculateBodyRecoil(player.head, hit, { minX: -1000, minY: -700, maxX: 1000, maxY: 700 }, 18, 28);
        expect(player.head.x + recoil.displacement.x).toBeLessThan(-34);
    });

    it('uses a finite unit normal at zero distance and degenerate path points', () => {
        const player = actor('player', 'player', 0, 70);
        const cap = bodyCapsules(verticalEnemy(), 44)[0];
        const hit = sweptCapsuleContact(player, cap)!;
        expect(Math.hypot(hit.normal.x, hit.normal.y)).toBeCloseTo(1);
        expect(Number.isFinite(hit.penetration)).toBe(true);
        expect(bodyCapsules({ ...verticalEnemy(), path: [{ x: 0, y: 0 }, { x: 0, y: 0 }] }, 44)).toEqual([]);
    });

    it('deduplicates overlapping segments and obeys 450ms actor cooldown', () => {
        const player = actor('player', 'player', 1, 70);
        const enemy = verticalEnemy();
        enemy.path = [{ x: 0, y: -160 }, { x: 0, y: 200 }, { x: 5, y: 70 }, { x: 0, y: -100 }];
        const collision = system();
        expect(collision.detect([player, enemy], 1000).filter(hit => hit.actorId === 'player')).toHaveLength(1);
        expect(collision.detect([player, enemy], 1449)).toEqual([]);
        expect(collision.detect([player, enemy], 1450).filter(hit => hit.actorId === 'player')).toHaveLength(1);
    });

    it('wall separation stays bounded and does not become a zero direction', () => {
        const hit = { actorId: 'player', ownerId: 'enemy', normal: { x: 1, y: 0 }, contact: { x: 99, y: 0 }, penetration: 34, sweptCorrection: { x: 0, y: 0 } };
        const recoil = calculateBodyRecoil({ x: 100, y: 0 }, hit, { minX: -100, minY: -100, maxX: 100, maxY: 100 }, 18, 28);
        expect(recoil.displacement.x).toBe(-28);
        expect(recoil.direction.x).toBe(-1);
    });

    it('keeps broadphase narrow for 38 distant maximum-length paths', () => {
        const actors = [actor('player', 'player', 0, 0)];
        for (let i = 0; i < 38; i++) actors.push(actor(`enemy${i}`, 'enemy', 1000 + i * 100, 1000, [{ x: 1000 + i * 100, y: 1000 }, { x: 1000 + i * 100, y: 1720 }]));
        const collision = system();
        expect(collision.detect(actors, 0)).toEqual([]);
        expect(collision.lastCandidateChecks).toBe(0);
    });
});
