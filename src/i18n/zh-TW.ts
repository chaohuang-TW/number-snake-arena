export const zhTW = {
    // Menu
    menuTitle: '數字蛇競技場',
    levelSelect: '關卡選擇',
    customize: '🎨 外觀設定',
    bestLabel: '最高分：',
    start: '開始',
    locked: '🔒 未解鎖',
    tutorialText: '吃掉比你小的數字！\n躲開比你大的數字！',
    langZh: '繁中',
    langEn: 'EN',

    // Levels
    level_1: '第 1 關',
    level_2: '第 2 關',
    level_3: '第 3 關',
    level_4: '第 4 關',

    // PrepScene
    prepTitle: '戰前準備',
    startValueHeading: '起始數值',
    standardLabel: '標準',
    standardDesc: '原始數值',
    boostLabel: '強化',
    boostDesc: '起始 +2',
    powerLabel: '威力',
    powerDesc: '起始 +5',
    startLevelBtn: '開始關卡',
    backBtn: '返回',
    bossInfo: '首領：{value}',
    hpInfo: '生命：{value}',
    skinInfo: '造型：{value}',

    // HUD
    score: '分數',
    best: '最高分',
    magnetReady: '磁力就緒',
    magnetActive: '磁力 {time} 秒',
    boost: '加速',

    // Leaderboard
    leaderboardTitle: '競技排名',
    you: '你',

    // Boss & Combat
    bossLabel: '首領 {value}',
    ultimateBossLabel: '終極首領 {value}',
    bossAppeared: '{value} 出現！',
    ultimateBossAppeared: '終極首領 500 出現！',
    nowHunt: '現在狩獵 {value}！',
    nowHuntUltimate: '現在狩獵終極首領！',

    // End Game & Victory
    gameOver: '遊戲結束',
    victory: '勝利',
    finalValue: '最終數值：{value}',
    newBest: '刷新紀錄！',
    playAgain: '再玩一次',
    replayLevel: '重玩本關',
    nextLevel: '下一關',
    menu: '主選單',
    levelSelectBtn: '關卡選擇',
    levelClearTitle: '{name} 完成！',
    levelRewardHeart: '+1 愛心',
    heartsTransition: '{old} → {new} 愛心',
    levelUnlocked: '第 {next} 關已解鎖！',
    allLevelsCleared: '全部關卡完成！',
    masterTitle: '你成為數字王者！',

    // Pause
    paused: '暫停',
    resume: '繼續遊戲',
    restart: '重新開始',

    // Lucky Wheel
    wheelTitle: '幸運轉盤',
    spin: '轉動',
    yourReward: '你的獎勵',
    faceUltimateBoss: '迎戰終極首領',
    rewardA: '威力 +100',
    rewardB: '超級威力 +150',
    rewardC: '完全恢復',
    rewardD: '極速充能',
    rewardE: '磁力充能',
    rewardF: '大獎！',

    // Customize
    customizeTitle: '外觀設定',
    skinsHeading: '蛇頭造型',
    selectSkin: '選擇',
    equippedSkin: '已裝備',
    skinClassic: 'CLASSIC',
    skinDragon: 'DRAGON',
    skinCyber: 'CYBER',
    skinViper: 'VIPER',
    skinGolden: 'GOLDEN',
    skinVoid: 'VOID'
};

export type TranslationKey = keyof typeof zhTW;
