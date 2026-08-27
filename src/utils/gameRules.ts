import { GameBalance } from '../config/gameBalance';

export function isEdible(playerValue: number, enemyValue: number): boolean {
    return enemyValue < playerValue;
}

export function calculateNewPlayerValue(playerValue: number, enemyValue: number): number {
    return playerValue + enemyValue;
}

export function calculateDamage(playerValue: number, enemyValue: number): { hpLoss: number, instantKO: boolean } {
    const r = enemyValue / playerValue;
    if (r >= GameBalance.damage.highRatioMax) {
        return { hpLoss: 0, instantKO: true };
    } else if (r >= GameBalance.damage.highRatioMin) {
        return { hpLoss: GameBalance.damage.highDamage, instantKO: false };
    } else if (r >= GameBalance.damage.mildRatioMin) {
        return { hpLoss: GameBalance.damage.mildDamage, instantKO: false };
    }
    return { hpLoss: 0, instantKO: false };
}

export function calculateNewBodySegments(currentSegments: number, hpLoss: number): number {
    const newSegments = currentSegments - (hpLoss * GameBalance.player.segmentLossPerHP);
    return Math.max(newSegments, GameBalance.player.minSegments);
}

export function calculateTurnRate(segments: number): number {
    const extraSegments = Math.max(0, segments - GameBalance.player.minSegments);
    const penalty = Math.min(
        GameBalance.player.maxTurnRatePenalty,
        extraSegments * GameBalance.player.turnRatePenaltyPerSegment
    );
    // Base turn rate minus penalty (e.g. 0.1 - up to 0.025)
    return GameBalance.player.turnRate * (1 - penalty);
}
