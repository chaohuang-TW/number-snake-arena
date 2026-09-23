import type { TranslationKey } from '../i18n';

export type WheelRewardId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface WheelReward {
    id: WheelRewardId;
    index: number;
    labelKey: TranslationKey;
    valueBonus: number;
    fullHP?: boolean;
    boostMax?: boolean;
    magnetReady?: boolean;
    color: number;
}

export const WHEEL_REWARDS: WheelReward[] = [
    {
        id: 'A',
        index: 0,
        labelKey: 'rewardA',
        valueBonus: 100,
        color: 0x3b82f6 // Blue
    },
    {
        id: 'B',
        index: 1,
        labelKey: 'rewardB',
        valueBonus: 150,
        color: 0x8b5cf6 // Purple
    },
    {
        id: 'C',
        index: 2,
        labelKey: 'rewardC',
        valueBonus: 75,
        fullHP: true,
        color: 0x10b981 // Green
    },
    {
        id: 'D',
        index: 3,
        labelKey: 'rewardD',
        valueBonus: 75,
        boostMax: true,
        color: 0xf59e0b // Amber
    },
    {
        id: 'E',
        index: 4,
        labelKey: 'rewardE',
        valueBonus: 75,
        magnetReady: true,
        color: 0x06b6d4 // Cyan
    },
    {
        id: 'F',
        index: 5,
        labelKey: 'rewardF',
        valueBonus: 200,
        fullHP: true,
        boostMax: true,
        color: 0xef4444 // Red / Gold Jackpot
    }
];

export function pickWheelReward(randomValue: number): WheelReward {
    // Clamp to [0, 1)
    let r = Math.max(0, Math.min(0.9999999, randomValue));
    const index = Math.floor(r * WHEEL_REWARDS.length);
    return WHEEL_REWARDS[Math.min(index, WHEEL_REWARDS.length - 1)];
}

export function applyWheelReward(
    player: { value: number; hp: number; maxHp?: number; boostEnergy: number },
    reward: WheelReward,
    magnetAbility?: { resetCooldown?: () => void; cooldownTimer?: number; isActive?: boolean }
): void {
    // 1. Numeric value only (does NOT increase body segments)
    player.value += reward.valueBonus;

    // 2. Full HP if applicable
    if (reward.fullHP) {
        player.hp = player.maxHp ?? 3;
    }

    // 3. Boost 100 if applicable
    if (reward.boostMax) {
        player.boostEnergy = 100;
    }

    // 4. Magnet Ready immediately if applicable
    if (reward.magnetReady && magnetAbility) {
        if (typeof magnetAbility.resetCooldown === 'function') {
            magnetAbility.resetCooldown();
        } else {
            magnetAbility.cooldownTimer = 0;
            magnetAbility.isActive = false;
        }
    }
}
