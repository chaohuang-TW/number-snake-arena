export interface HeadSkinDefinition {
    id: string;
    displayName: string;
    playerTexture: string;
    enemyTexture: string;
    accentColor: number;
    detailColor: number;
}

export const HEAD_SKINS: Record<string, HeadSkinDefinition> = {
    classic: {
        id: 'classic',
        displayName: 'CLASSIC',
        playerTexture: 'skin_head_classic_p',
        enemyTexture: 'skin_head_classic_e',
        accentColor: 0x00ffff,
        detailColor: 0xffffff
    },
    bolt: {
        id: 'bolt',
        displayName: 'BOLT',
        playerTexture: 'skin_head_bolt_p',
        enemyTexture: 'skin_head_bolt_e',
        accentColor: 0xffe600,
        detailColor: 0xff8800
    },
    mecha: {
        id: 'mecha',
        displayName: 'MECHA',
        playerTexture: 'skin_head_mecha_p',
        enemyTexture: 'skin_head_mecha_e',
        accentColor: 0x00ff88,
        detailColor: 0x0044ff
    },
    dragon: {
        id: 'dragon',
        displayName: 'DRAGON',
        playerTexture: 'skin_head_dragon_p',
        enemyTexture: 'skin_head_dragon_e',
        accentColor: 0x9933ff,
        detailColor: 0xff00ff
    },
    flame: {
        id: 'flame',
        displayName: 'FLAME',
        playerTexture: 'skin_head_flame_p',
        enemyTexture: 'skin_head_flame_e',
        accentColor: 0xff4400,
        detailColor: 0xffaa00
    },
    alien: {
        id: 'alien',
        displayName: 'ALIEN',
        playerTexture: 'skin_head_alien_p',
        enemyTexture: 'skin_head_alien_e',
        accentColor: 0x33ff33,
        detailColor: 0x008800
    }
};

export const HEAD_SKIN_LIST = Object.values(HEAD_SKINS);
export const DEFAULT_HEAD_SKIN_ID = 'classic';
