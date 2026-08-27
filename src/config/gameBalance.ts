export const GameBalance = {
    player: {
        initialValue: 5,
        initialHP: 3,
        initialSegments: 5,
        maxHP: 3,
        minSegments: 5,
        segmentLossPerHP: 2,
        normalSpeed: 220,
        boostSpeed: 340,
        maxBoostEnergy: 100,
        boostDrainPerSec: 35,
        boostRecoveryPerSec: 18,
        boostEatRecovery: 12,
        invulnerabilityDuration: 1200, // ms
        hitStunDuration: 250, // ms
        turnRate: 0.12, // lerp factor for turning
        turnRatePenaltyPerSegment: 0.004,
        maxTurnRatePenalty: 0.18, // 18% drop max
    },
    enemy: {
        normalMaxLimit: 38, // active on screen
        safeRatio: 0.60,
        highValueRatio: 0.20,
        hunterRatio: 0.17,
        giantRatio: 0.03,
        preySpeedMultiplier: 0.60, // basic prey
        highValuePreySpeedMultiplier: 0.75, // high-value prey
        hunterSpeedMultiplier: 0.72,
        giantSpeedMultiplier: 0.38,
        fleeDistance: 170, // pixels
        chaseDistance: 330, // pixels
        // Base spawn distances, will be overridden by role
        spawnDistanceMin: 240,
        spawnDistanceMax: 520,
        
        spawnRanges: {
            edible: { min: 240, max: 520 },
            hunter: { min: 420, max: 720 },
            giant: { min: 700, max: 1000 }
        }
    },
    assist: {
        earlyGameRescueValue: 25,
        earlyGameRescueTimer: 7000,
        earlyGameRescueCooldown: 10000,
        earlyGameRescueDistMin: 180,
        earlyGameRescueDistMax: 300,
        eatAssistRadius: 65,
        eatAssistConeDeg: 110
    },
    boss: {
        triggerValue: 70,
        value: 100,
        speedMultiplier: 0.6,
        chaseDistance: 2000,
    },
    damage: {
        mildRatioMin: 1.0,
        mildRatioMax: 1.5,
        mildDamage: 1,
        highRatioMin: 1.5,
        highRatioMax: 2.5,
        highDamage: 2,
    },
    world: {
        width: 2400,
        height: 1600,
    },
    combo: {
        window: 2500, // ms
    }
};
