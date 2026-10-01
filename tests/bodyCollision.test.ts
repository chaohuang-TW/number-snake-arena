import { describe, it, expect } from 'vitest';
import { BodyCollisionSystem, bodyCapsules, sweptCapsuleContact, type BodyActor } from '../src/systems/BodyCollision';
import { calculateBodyRecoil } from '../src/systems/Recoil';
import { GameBalance } from '../src/config/gameBalance';

const actor = (id: string, kind: BodyActor['kind'], x: number, y: number, path = [{ x, y }]): BodyActor => ({ id, kind, head: { x, y }, previousHead: { x, y }, headRadius: 20, path, active: true });
const verticalEnemy = () => actor('enemy', 'enemy', 0, -160, [{ x: 0, y: -160 }, { x: 0, y: 200 }]);
const system = () => new BodyCollisionSystem(GameBalance.bodyCollision);

describe('visible-path body collision and recoil', () => {
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
