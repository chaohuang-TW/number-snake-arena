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
        turnRate: 0.1, // lerp factor for turning
        turnRatePenaltyPerSegment: 0.005,
        maxTurnRatePenalty: 0.25, // 25% drop
    },
    enemy: {
        normalMaxLimit: 45, // active on screen
        safeRatio: 0.55,
        highValueRatio: 0.20,
        hunterRatio: 0.20,
        giantRatio: 0.05,
        preySpeedMultiplier: 0.85, // slightly slower than player so they can be caught
        highValuePreySpeedMultiplier: 1.05, // slightly faster
        hunterSpeedMultiplier: 0.7, // slower than player so player can escape
        giantSpeedMultiplier: 0.4,
        fleeDistance: 250, // pixels
        chaseDistance: 350, // pixels
        spawnDistanceMin: 500,
        spawnDistanceMax: 800,
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
