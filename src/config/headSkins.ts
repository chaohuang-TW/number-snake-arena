export interface HeadSkinDefinition {
    id: string;
    displayName: string;
    nameKey: string;
    silhouette: 'round' | 'lightning' | 'mask' | 'horns' | 'flames' | 'antennae';
    playerTexture: string;
    enemyTexture: string;
    accentColor: number;
    detailColor: number;
}

export const HEAD_SKINS: Record<string, HeadSkinDefinition> = {
    classic: {
        id: 'classic',
        nameKey: 'skinClassic',
        silhouette: 'round',
        displayName: 'CLASSIC',
        playerTexture: 'skin_head_classic_p',
        enemyTexture: 'skin_head_classic_e',
        accentColor: 0x58d6e1,
        detailColor: 0xffffff
    },
    bolt: {
        id: 'bolt',
        nameKey: 'skinBolt',
        silhouette: 'lightning',
        displayName: 'BOLT',
        playerTexture: 'skin_head_bolt_p',
        enemyTexture: 'skin_head_bolt_e',
        accentColor: 0xf7d15d,
        detailColor: 0xff8800
    },
    mecha: {
        id: 'mecha',
        nameKey: 'skinMecha',
        silhouette: 'mask',
        displayName: 'MECHA',
        playerTexture: 'skin_head_mecha_p',
        enemyTexture: 'skin_head_mecha_e',
        accentColor: 0x91bbc6,
        detailColor: 0x0044ff
    },
    dragon: {
        id: 'dragon',
        nameKey: 'skinDragon',
        silhouette: 'horns',
        displayName: 'DRAGON',
        playerTexture: 'skin_head_dragon_p',
        enemyTexture: 'skin_head_dragon_e',
        accentColor: 0xbba0f0,
        detailColor: 0xff00ff
    },
    flame: {
        id: 'flame',
        nameKey: 'skinFlame',
        silhouette: 'flames',
        displayName: 'FLAME',
        playerTexture: 'skin_head_flame_p',
        enemyTexture: 'skin_head_flame_e',
        accentColor: 0xff936d,
        detailColor: 0xffaa00
    },
    alien: {
        id: 'alien',
        nameKey: 'skinAlien',
        silhouette: 'antennae',
        displayName: 'ALIEN',
        playerTexture: 'skin_head_alien_p',
        enemyTexture: 'skin_head_alien_e',
        accentColor: 0xa4dc82,
        detailColor: 0x008800
    }
};

export const HEAD_SKIN_LIST = Object.values(HEAD_SKINS);
export const DEFAULT_HEAD_SKIN_ID = 'classic';

// Padding preserves central collision circles while allowing protruding accessories.
export const HEAD_TEXTURE_SIZE = 64;
export const HEAD_TEXTURE_CENTER = HEAD_TEXTURE_SIZE / 2;
