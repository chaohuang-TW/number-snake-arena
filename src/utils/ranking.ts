export interface ArenaParticipant {
    id: string;
    name: string;
    value: number;
    type: 'player' | 'enemy' | 'boss';
}

export interface RankedParticipant extends ArenaParticipant {
    rank: number;
}

export interface RankingResult {
    all: RankedParticipant[];
    top5: RankedParticipant[];
    playerRank: RankedParticipant | null;
    leader: RankedParticipant | null;
}

/**
 * Deterministically ranks arena participants:
 * 1. Value descending
 * 2. Stable participant ID ascending (tie-breaker)
 */
export function rankArenaParticipants(participants: ArenaParticipant[]): RankedParticipant[] {
    const sorted = [...participants].sort((a, b) => {
        if (b.value !== a.value) {
            return b.value - a.value;
        }
        return a.id.localeCompare(b.id);
    });

    return sorted.map((p, index) => ({
        ...p,
        rank: index + 1
    }));
}

export function getRankingResult(participants: ArenaParticipant[]): RankingResult {
    const ranked = rankArenaParticipants(participants);
    const top5 = ranked.slice(0, 5);
    const playerRank = ranked.find(p => p.type === 'player') || null;
    const leader = ranked.length > 0 ? ranked[0] : null;

    return {
        all: ranked,
        top5,
        playerRank,
        leader
    };
}
