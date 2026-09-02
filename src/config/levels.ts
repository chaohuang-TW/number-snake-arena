export interface LevelReward {
    type: 'MAX_HP';
    value: number;
    id: string; // e.g. "level-1-clear-heart"
}

export interface LevelDefinition {
    id: number;
    name: string;
    startValue: number;
    bossValue: number;
    bossTriggerValue: number;
    normalEnemyMax: number;
    reward?: LevelReward;
    nextLevelId?: number;
}

export const LEVELS: Record<number, LevelDefinition> = {
    1: {
        id: 1,
        name: "LEVEL 1",
        startValue: 5,
        bossValue: 100,
        bossTriggerValue: 70,
        normalEnemyMax: 99,
        reward: {
            type: 'MAX_HP',
            value: 1,
            id: 'level-1-clear-heart'
        },
        nextLevelId: 2
    },
    2: {
        id: 2,
        name: "LEVEL 2",
        startValue: 5,
        bossValue: 200,
        bossTriggerValue: 150,
        normalEnemyMax: 199,
        reward: {
            type: 'MAX_HP',
            value: 1,
            id: 'level-2-clear-heart'
        },
        nextLevelId: 3
    },
    3: {
        id: 3,
        name: "LEVEL 3",
        startValue: 5,
        bossValue: 300,
        bossTriggerValue: 230,
        normalEnemyMax: 299,
        reward: {
            type: 'MAX_HP',
            value: 1,
            id: 'level-3-clear-heart'
        },
        nextLevelId: 4
    },
    4: {
        id: 4,
        name: "LEVEL 4",
        startValue: 5,
        bossValue: 400,
        bossTriggerValue: 310,
        normalEnemyMax: 399
    }
};

export const getLevel = (id: number): LevelDefinition => {
    return LEVELS[id] || LEVELS[1];
};
