import { describe, it, expect } from 'vitest';
import { rankArenaParticipants, getRankingResult, type ArenaParticipant } from '../src/utils/ranking';

describe('Ranking Utility', () => {
    it('ranks higher value first and lower value later', () => {
        const participants: ArenaParticipant[] = [
            { id: 'p1', name: 'BOT A', value: 20, type: 'enemy' },
            { id: 'player', name: 'YOU', value: 50, type: 'player' },
            { id: 'p2', name: 'BOT B', value: 80, type: 'enemy' }
        ];

        const ranked = rankArenaParticipants(participants);
        expect(ranked[0].id).toBe('p2');
        expect(ranked[0].rank).toBe(1);
        expect(ranked[1].id).toBe('player');
        expect(ranked[1].rank).toBe(2);
        expect(ranked[2].id).toBe('p1');
        expect(ranked[2].rank).toBe(3);
    });

    it('breaks ties deterministically and stably by participant id ascending', () => {
        const participants: ArenaParticipant[] = [
            { id: 'enemy_03', name: 'VOLT', value: 50, type: 'enemy' },
            { id: 'enemy_01', name: 'NOVA', value: 50, type: 'enemy' },
            { id: 'enemy_02', name: 'BYTE', value: 50, type: 'enemy' }
        ];

        const ranked = rankArenaParticipants(participants);
        expect(ranked[0].id).toBe('enemy_01');
        expect(ranked[1].id).toBe('enemy_02');
        expect(ranked[2].id).toBe('enemy_03');
    });

    it('includes Player and Boss correctly in ranking', () => {
        const participants: ArenaParticipant[] = [
            { id: 'player', name: 'YOU', value: 80, type: 'player' },
            { id: 'boss', name: 'BOSS 100', value: 100, type: 'boss' },
            { id: 'enemy_01', name: 'NOVA', value: 30, type: 'enemy' }
        ];

        const result = getRankingResult(participants);
        expect(result.leader?.id).toBe('boss');
        expect(result.playerRank?.rank).toBe(2);
        expect(result.all.length).toBe(3);
    });

    it('correctly selects Top 5 and computes player actual rank when outside Top 5', () => {
        const participants: ArenaParticipant[] = [
            { id: 'e1', name: 'P1', value: 100, type: 'enemy' },
            { id: 'e2', name: 'P2', value: 90, type: 'enemy' },
            { id: 'e3', name: 'P3', value: 80, type: 'enemy' },
            { id: 'e4', name: 'P4', value: 70, type: 'enemy' },
            { id: 'e5', name: 'P5', value: 60, type: 'enemy' },
            { id: 'e6', name: 'P6', value: 50, type: 'enemy' },
            { id: 'player', name: 'YOU', value: 40, type: 'player' }
        ];

        const result = getRankingResult(participants);
        expect(result.top5.length).toBe(5);
        expect(result.top5.map(p => p.id)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
        expect(result.playerRank?.rank).toBe(7);
        expect(result.playerRank?.value).toBe(40);
    });
});
