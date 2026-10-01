import Phaser from 'phaser';
import { PlayerSnake } from '../entities/PlayerSnake';
import { NumberEnemy } from '../entities/NumberEnemy';
import { NumberBoss } from '../entities/NumberBoss';
import { ProgressionManager } from '../models/Progression';
import { CosmeticsManager } from '../models/Cosmetics';
import { getLevel, type LevelDefinition } from '../config/levels';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { HUD } from '../ui/HUD';
import { AudioSystem } from '../systems/AudioSystem';
import { GameBalance } from '../config/gameBalance';
import { isEdible, calculateDamage, calculateNewBodySegments } from '../utils/gameRules';
import { DebugUI } from '../ui/DebugUI';
import { MagnetAbility } from '../systems/MagnetAbility';
import { CollectibleOrb, type OrbActivation } from '../entities/CollectibleOrb';
import { LeaderboardPanel } from '../ui/LeaderboardPanel';
import { BossIndicator } from '../ui/BossIndicator';
import type { RectBounds } from '../utils/layout';
import { getRankingResult, type ArenaParticipant, type RankingResult } from '../utils/ranking';
import { normalizeStartValue } from '../utils/prepValues';
import { t } from '../i18n';
import { UltimateBoss } from '../entities/UltimateBoss';
import { LuckyWheelOverlay } from '../ui/LuckyWheelOverlay';
import { type WheelReward, applyWheelReward } from '../utils/luckyWheel';
import { BodyCollisionSystem, type BodyActor, type BodyPoint } from '../systems/BodyCollision';
import { calculateBodyRecoil } from '../systems/Recoil';
import { createSnakeOrbDrops } from '../systems/OrbRewards';
import { EnemySkinSelector, VisualPreferencesManager } from '../models/VisualPreferences';
import { createArenaBackground } from '../ui/ArenaBackground';
import { ARCADE, arcadeButton, roundedPanel, uiText, uiUnit } from '../ui/ArcadeStyle';

export class GameScene extends Phaser.Scene {
    player!: PlayerSnake;
    enemies: NumberEnemy[] = [];
    boss: NumberBoss | null = null;
    ultimateBoss: UltimateBoss | null = null;
    luckyWheelOverlay: LuckyWheelOverlay | null = null;
    forcedWheelRewardId: string | null = null;
    wheelReward: WheelReward | null = null;
    isUltimatePhase: boolean = false;
    bossIndicator!: BossIndicator;
    orbs: CollectibleOrb[] = [];
    magnet!: MagnetAbility;
    bodyCollisions = new BodyCollisionSystem(GameBalance.bodyCollision);
    private previousHeads = new Map<string, BodyPoint>();
    private freeOrbs: CollectibleOrb[] = [];
    private skinSelector = new EnemySkinSelector();
    private particles = new Set<Phaser.GameObjects.Arc>();
    private recoilEchoes = new Set<Phaser.GameObjects.Image>();
    bodyRecoilCount = 0;
    orbCollectedScore = 0;
    orbCollectedEnergy = 0;
    snakeDropCount = 0;

    joystick!: VirtualJoystick;
    hud!: HUD;
    audio!: AudioSystem;
    debugUI?: DebugUI;
    leaderboard!: LeaderboardPanel;
    leaderboardTimer?: Phaser.Time.TimerEvent;
    worldCrown!: Phaser.GameObjects.Image;
    currentLeaderId: string | null = null;
    currentRanking: RankingResult | null = null;

    runStartValue: number = 5;
    scoreSubmitted: boolean = false;
    isNewBest: boolean = false;

    keys!: {
        w: Phaser.Input.Keyboard.Key,
        a: Phaser.Input.Keyboard.Key,
        s: Phaser.Input.Keyboard.Key,
        d: Phaser.Input.Keyboard.Key,
        up: Phaser.Input.Keyboard.Key,
        down: Phaser.Input.Keyboard.Key,
        left: Phaser.Input.Keyboard.Key,
        right: Phaser.Input.Keyboard.Key,
        space: Phaser.Input.Keyboard.Key,
        m: Phaser.Input.Keyboard.Key
    };

    comboCount: number = 0;
    lastEatTime: number = 0;
    bossSpawned: boolean = false;
    levelId: number = 1;
    levelDef!: LevelDefinition;
    gameState: string = 'RUNNING';

    // Background grid
    grid!: Phaser.GameObjects.Grid;

    // Spawn timer
    spawnTimer: number = 0;

    gameStartTime: number = 0;
    lastRescueTime: number = 0;
    lastEdibleCheckTime: number = 0;

    constructor() {
        super('GameScene');
    }

    init(data: any) {
        this.levelId = data?.levelId || 1;
        ProgressionManager.load();
        CosmeticsManager.load();
        this.levelDef = getLevel(this.levelId);
        this.runStartValue = normalizeStartValue(data?.startValueOverride ?? this.levelDef.startValue);
    }

    create() {
        this.gameState = 'RUNNING';
        this.enemies = [];
        this.orbs = [];
        this.freeOrbs = [];
        this.previousHeads.clear();
        this.bodyCollisions.reset();
        this.bodyRecoilCount = 0;
        this.orbCollectedScore = 0;
        this.orbCollectedEnergy = 0;
        this.snakeDropCount = 0;
        VisualPreferencesManager.load();
        this.skinSelector = new EnemySkinSelector();
        this.boss = null;
        this.ultimateBoss = null;
        this.luckyWheelOverlay = null;
        this.wheelReward = null;
        this.isUltimatePhase = false;
        this.bossSpawned = false;
        this.comboCount = 0;
        this.lastEatTime = 0;
        this.gameStartTime = this.time.now;
        this.lastRescueTime = this.time.now;
        this.lastEdibleCheckTime = this.time.now;

        // World setup
        const ww = GameBalance.world.width;
        const wh = GameBalance.world.height;
        this.physics.world.setBounds(-ww/2, -wh/2, ww, wh);
        this.cameras.main.setBounds(-ww/2, -wh/2, ww, wh);

        // Data-driven background theme
        this.createBackgroundTheme();

        const maxHP = ProgressionManager.getMaxHP();
        this.scoreSubmitted = false;
        this.isNewBest = false;
        this.currentLeaderId = null;
        this.player = new PlayerSnake(this, 0, 0, this.runStartValue, maxHP);
        this.cameras.main.startFollow(this.player.head, true, 0.1, 0.1);
        this.cameras.main.setZoom(1);

        // Systems
        this.magnet = new MagnetAbility(this);
        this.joystick = new VirtualJoystick(this);
        this.hud = new HUD(this);
        this.hud.onMagnetTrigger = () => this.activateMagnet();
        this.hud.setBestScore(ProgressionManager.getBestScore(this.levelId));
        this.audio = new AudioSystem(this);

        // Leaderboard panel, boss indicator, and world crown
        this.leaderboard = new LeaderboardPanel(this);
        this.bossIndicator = new BossIndicator(this);
        this.worldCrown = this.add.image(0, -9999, 'crown_gold').setDepth(205).setVisible(false);

        this.leaderboardTimer = this.time.addEvent({
            delay: 250,
            callback: this.updateArenaRanking,
            callbackScope: this,
            loop: true
        });
        this.updateArenaRanking();

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('e2e') === '1') {
            (window as any).__E2E_READONLY__ = {
                getPlayerValue: () => this.player ? this.player.value : 0,
                getBossSpawned: () => this.bossSpawned,
                getBossState: () => {
                    if (this.ultimateBoss) return this.ultimateBoss.isFleeing ? 'FLEE' : 'CHASE';
                    return this.boss ? (this.boss.isFleeing ? 'FLEE' : 'CHASE') : 'NONE';
                },
                getGameState: () => this.gameState
            };
        }
        if (urlParams.get('debug') === '1') {
            this.debugUI = new DebugUI(this, this.player, () => this.enemies.length, () => this.boss);
            this.input.keyboard!.on('keydown-C', () => {
                this.player.value += 10;
            });

            // Expose debug API for E2E tests
            (window as any).__NUMBER_SNAKE_DEBUG__ = {
                getPlayerValue: () => this.player.value,
                setPlayerValue: (val: number) => { this.player.value = val; },
                getCurrentLevel: () => this.levelId,
                startLevel: (id: number) => this.scene.start('GameScene', { levelId: id }),
                getMaxHP: () => ProgressionManager.getMaxHP(),
                getHP: () => this.player.hp,
                getProgression: () => ProgressionManager._getData(),
                resetProgressionForTest: () => ProgressionManager.reset(),
                forceLevelClear: () => this.levelClear(),
                getPlayerHP: () => this.player.hp,
                setPlayerHP: (val: number) => { this.player.hp = val; this.player.isInvulnerable = false; this.lastEatTime = 0; },
                getBodySegments: () => this.player.segments,
                getPlayerPosition: () => ({ x: this.player.head.x, y: this.player.head.y }),
                getPlayerSpeed: () => this.player.head.body ? (this.player.head.body as Phaser.Physics.Arcade.Body).speed : 0,
                getCurrentAngle: () => this.player.currentAngle,
                getTargetAngle: () => this.player.targetAngle,
                getBoostEnergy: () => this.player.boostEnergy,

                spawnEnemy: (val: number, x: number, y: number, skinStyle?: string) => {
                    const e = new NumberEnemy(this, x, y, val, skinStyle ?? this.skinSelector.next());
                    this.enemies.push(e);
                    return e;
                },
                getEnemies: () => this.enemies,
                spawnBoss: () => {
                    if (!this.bossSpawned) this.spawnBoss();
                },
                getBossState: () => {
                    if (this.ultimateBoss) return this.ultimateBoss.isFleeing ? 'FLEE' : 'CHASE';
                    return this.boss ? (this.boss.isFleeing ? 'FLEE' : 'CHASE') : 'NONE';
                },
                getBossPosition: () => {
                    if (this.ultimateBoss && this.ultimateBoss.body) return { x: this.ultimateBoss.body.x, y: this.ultimateBoss.body.y };
                    return this.boss && this.boss.body ? { x: this.boss.body.x, y: this.boss.body.y } : null;
                },
                setBossPositionForTest: (x: number, y: number) => {
                    if (this.ultimateBoss && this.ultimateBoss.body) {
                        this.ultimateBoss.body.setPosition(x, y);
                        this.ultimateBoss.valueText.setPosition(x, y);
                    } else if (this.boss && this.boss.body) {
                        this.boss.body.setPosition(x, y);
                        this.boss.valueText.setPosition(x, y);
                    }
                },
                getBossVelocity: () => {
                    if (this.ultimateBoss && this.ultimateBoss.body && this.ultimateBoss.body.body) {
                        return { x: this.ultimateBoss.body.body.velocity.x, y: this.ultimateBoss.body.body.velocity.y };
                    }
                    return this.boss && this.boss.body && this.boss.body.body ? { x: this.boss.body.body.velocity.x, y: this.boss.body.body.velocity.y } : { x: 0, y: 0 };
                },
                getBossIndicatorState: () => this.bossIndicator ? this.bossIndicator.getState() : { visible: false, x: 0, y: 0, value: 0, text: '', angle: 0, bounds: null },
                forceSpecificEnemy: (e: any) => { this.player.isInvulnerable = false; this.handleEnemyCollision(e, 0, this.time.now); },
                forceCollisionWithEnemy: (index: number) => {
                    this.player.isInvulnerable = false;
                    if (this.enemies[index]) {
                        this.handleEnemyCollision(this.enemies[index], index, this.time.now);
                    }
                },
                forceCollisionWithBoss: () => {
                    this.player.isInvulnerable = false;
                    if (this.ultimateBoss) this.handleUltimateBossCollision();
                    else if (this.boss) this.handleBossCollision();
                },
                getGameState: () => {
                    if (this.gameState === 'GAME_OVER' || this.gameState === 'VICTORY' || this.gameState === 'LEVEL_CLEAR' || this.gameState === 'LUCKY_WHEEL') return this.gameState;
                    return this.scene.isPaused('GameScene') ? 'PAUSED' : 'RUNNING';
                },
                simulateVisibilityHidden: () => {
                    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
                    this.handleVisibilityChange();
                },
                simulateVisibilityVisible: () => {
                    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
                    this.handleVisibilityChange();
                },
                getResizeListenerCount: () => this.scale.listenerCount('resize'),
                stopSpawning: () => this.stopSpawning(),
                getPlayerPos: () => ({ x: this.player.head.x, y: this.player.head.y }),
                restartGame: () => { this.scene.start('GameScene'); },
                hardReset: () => this.hardReset(),
                // v0.4.0 Debug APIs
                getMagnetState: () => this.magnet.state,
                activateMagnetForTest: () => this.activateMagnet(),
                getActiveOrbCount: () => this.orbs.length,
                getPlayerHeadSkin: () => this.player.headSkinId,
                setPlayerHeadSkinForTest: (id: string) => this.player.setHeadSkin(id),
                getEnemyVisualInfo: (index: number) => ({
                    headSkinId: this.enemies[index]?.headSkinId,
                    segmentCount: this.enemies[index]?.bodySprites?.length
                }),
                getCurrentThemeKey: () => this.levelDef.theme,
                getOrbs: () => this.orbs,
                // v0.5.0 Debug APIs
                getArenaRanking: () => this.currentRanking?.all || [],
                getPlayerArenaRank: () => this.currentRanking?.playerRank?.rank || 0,
                getCrownHolderId: () => this.currentRanking?.leader?.id || null,
                getRunStartValue: () => this.runStartValue,
                setDeterministicArenaParticipantNamesForTest: (names: string[]) => {
                    this.enemies.forEach((e, i) => {
                        if (names[i]) {
                            e.arenaId = `enemy_${i + 1}`;
                            e.arenaName = names[i];
                        }
                    });
                    this.updateArenaRanking();
                },
                // v0.6.0 Debug APIs
                getLuckyWheelOverlay: () => this.luckyWheelOverlay,
                setForcedWheelRewardForTest: (id: string) => {
                    this.forcedWheelRewardId = id;
                    if (this.luckyWheelOverlay) {
                        this.luckyWheelOverlay.forcedRewardId = id;
                    }
                },
                setPlayerPositionForTest: (x: number, y: number) => {
                    if (this.player) {
                        this.player.teleport(x, y);
                        this.previousHeads.delete('player');
                    }
                },
                forceWheelSpin: (rewardId?: string) => this.luckyWheelOverlay ? this.luckyWheelOverlay.spin(rewardId) : null,
                getUltimateBoss: () => this.ultimateBoss,
                spawnUltimateBossForTest: () => {
                    if (!this.ultimateBoss) {
                        this.boss?.destroy();
                        this.boss = null;
                        this.bossSpawned = true;
                        this.ultimateBoss = new UltimateBoss(this, 0, -500);
                        this.isUltimatePhase = true;
                    }
                    return this.ultimateBoss;
                },
                forceCollisionWithUltimateBoss: () => {
                    this.player.isInvulnerable = false;
                    if (this.ultimateBoss) this.handleUltimateBossCollision();
                },
                getWheelReward: () => this.wheelReward,
                isUltimatePhaseActive: () => this.isUltimatePhase,
                getPlayerPath: () => this.player.getVisiblePath(),
                getPlayerTargetLength: () => this.player.targetLength,
                getBodyRecoilCount: () => this.bodyRecoilCount,
                getPlayerRecoilState: () => ({ active: this.player.isRecoiling, remainingMs: this.player.recoilRemainingMs, velocity: { x: this.player.head.body!.velocity.x, y: this.player.head.body!.velocity.y } }),
                getOrbRewardTotals: () => ({ score: this.orbCollectedScore, energy: this.orbCollectedEnergy, snakes: this.snakeDropCount }),
                getOrbPoolSize: () => this.orbs.length + this.freeOrbs.length,
                getBodyCandidateChecks: () => this.bodyCollisions.lastCandidateChecks,
                getArenaTestSnapshot: () => ({
                    time: this.time.now,
                    player: { value: this.player.value, hp: this.player.hp, x: this.player.head.x, y: this.player.head.y, path: this.player.getVisiblePath(), targetLength: this.player.targetLength, isRecoiling: this.player.isRecoiling, velocity: { x: this.player.head.body!.velocity.x, y: this.player.head.body!.velocity.y } },
                    enemies: this.enemies.map(enemy => ({ id: enemy.arenaId, value: enemy.value, x: enemy.body.x, y: enemy.body.y, path: enemy.getVisiblePath(), targetLength: enemy.targetLength, isRecoiling: enemy.isRecoiling, magnetSuppressed: this.magnet.isEnemySuppressed(enemy.arenaId), velocity: { x: enemy.body.body!.velocity.x, y: enemy.body.body!.velocity.y } })),
                    orbs: this.orbs.map(orb => ({ x: orb.sprite.x, y: orb.sprite.y, canCollect: orb.canCollect, isTransforming: orb.isTransforming, reward: { ...orb.reward } })),
                    score: this.hud.getScore(), boost: this.player.boostEnergy, recoils: this.bodyRecoilCount,
                    orbRewards: { score: this.orbCollectedScore, energy: this.orbCollectedEnergy, snakes: this.snakeDropCount }
                }),
                seedPlayerPathForTest: (points: BodyPoint[]) => { this.player.seedPathForTest(points); this.previousHeads.delete('player'); },
                seedEnemyPathForTest: (index: number, points: BodyPoint[]) => {
                    const enemy = this.enemies[index];
                    if (enemy) { enemy.seedPathForTest(points); this.previousHeads.delete(enemy.arenaId); }
                },
                setPlayerDirectionForTest: (angle: number) => { this.player.currentAngle = angle; this.player.targetAngle = angle; },
                spawnOrbForTest: (x: number, y: number) => this.spawnOrb(x, y),
                getPlayerScore: () => this.hud.getScore(),
                setBoostEnergyForTest: (value: number) => { this.player.boostEnergy = Phaser.Math.Clamp(value, 0, 100); }
            };
        } else {
            // Ensure no debug API exists in normal mode
            (window as any).__NUMBER_SNAKE_DEBUG__ = undefined;
        }

        this.keys = this.input.keyboard!.addKeys('w,a,s,d,up,down,left,right,space,m') as any;
        this.input.keyboard?.on('keydown-M', () => {
            this.activateMagnet();
        });

        this.scale.on('resize', this.resize, this);

        // Visibility API pause
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        this.events.once('shutdown', this.teardown, this);
        this.events.on('postupdate', this.syncMotionTrails, this);

        // Initial spawn
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 240 + Math.random() * 200;
            const sx = Phaser.Math.Clamp(Math.cos(angle) * dist, -ww/2+50, ww/2-50);
            const sy = Phaser.Math.Clamp(Math.sin(angle) * dist, -wh/2+50, wh/2-50);
            const val = Phaser.Math.Between(1, 4);
            const enemy = new NumberEnemy(this, sx, sy, val, this.skinSelector.next());
            this.enemies.push(enemy);
        }
        for (let i = 0; i < 14; i++) this.spawnEnemy();
    }

    createBackgroundTheme() {
        createArenaBackground(this, this.levelDef.theme, GameBalance.world.width, GameBalance.world.height);
    }

    activateMagnet() {
        this.magnet.activate();
    }

    clearOrbs() {
        for (const orb of this.orbs) {
            this.recycleOrb(orb);
        }
        this.orbs = [];
    }

    handleVisibilityChange = () => {
        if (document.hidden) {
            if (!this.scene.isPaused('GameScene')) {
                this.scene.pause('GameScene');
                this.scene.launch('PauseScene');
            }
        }
    }

    update(time: number, dt: number) {
        if (this.gameState === 'GAME_OVER' || this.gameState === 'VICTORY' || this.gameState === 'LEVEL_CLEAR' || this.gameState === 'LUCKY_WHEEL') return;

        let dx = 0;
        let dy = 0;

        if (this.keys.a.isDown || this.keys.left.isDown) dx -= 1;
        if (this.keys.d.isDown || this.keys.right.isDown) dx += 1;
        if (this.keys.w.isDown || this.keys.up.isDown) dy -= 1;
        if (this.keys.s.isDown || this.keys.down.isDown) dy += 1;

        if (this.joystick && this.joystick.active) {
            dx = this.joystick.deltaX;
            dy = this.joystick.deltaY;
        }

        this.player.setDesiredDirection(dx, dy);

        let isBoosting = false;
        if ((this.keys.space.isDown || (this.hud && this.hud.isBoostPressed)) && this.player.boostEnergy > 0) {
            isBoosting = true;
        }
        this.player.update(dt, isBoosting);

        // Update AI enemies normal movement first
        for (const e of this.enemies) {
            e.update(dt, this.player.head.x, this.player.head.y, this.player.value);
        }

        if (time - this.lastEatTime > GameBalance.combo.window) this.comboCount = 0;
        const headResolved = this.resolveEnemyHeadContacts(time);
        this.updateBossLogic(dt);
        if (this.gameState !== 'RUNNING') return;
        this.resolveBodyContacts(time, headResolved);

        // Magnet desktop trigger & update (Applied AFTER normal AI velocity so magnetic pull survives)
        if (Phaser.Input.Keyboard.JustDown(this.keys.m)) {
            this.activateMagnet();
        }
        this.magnet.update(dt, this.player.head.x, this.player.head.y, this.player.value, this.enemies, this.orbs);

        // Collectible Orbs Update & Collection
        for (let i = this.orbs.length - 1; i >= 0; i--) {
            const orb = this.orbs[i];
            orb.update(time, dt);
            if (orb.isExpired(time)) {
                this.recycleOrb(orb);
                this.orbs.splice(i, 1);
                continue;
            }
            // Head overlap collects orb
            const orbPosition = orb.getCollectionPosition();
            const dist = Phaser.Math.Distance.Between(this.player.head.x, this.player.head.y, orbPosition.x, orbPosition.y);
            if (dist < 32 && orb.canCollect) {
                const ox = orb.sprite.x;
                const oy = orb.sprite.y;
                const reward = orb.collect();
                if (!reward) continue;
                this.orbs.splice(i, 1);
                this.recycleOrb(orb);
                this.hud.addScore(reward.score);
                this.orbCollectedScore += reward.score;
                this.orbCollectedEnergy += reward.energy;
                this.player.boostEnergy = Math.min(GameBalance.player.maxBoostEnergy, this.player.boostEnergy + reward.energy);
                this.createParticles(ox, oy, 0xffff00, 6);
            }
        }

        // Keep the head readable; longer tails may naturally leave the camera view.
        this.cameras.main.setZoom(1);

        if (!this.isUltimatePhase) {
            // Assist: Early Game Rescue
            if (!this.bossSpawned && this.player.value < GameBalance.assist.earlyGameRescueValue) {
                if (time - this.lastEatTime > GameBalance.assist.earlyGameRescueTimer) {
                    if (time - this.lastRescueTime > GameBalance.assist.earlyGameRescueCooldown) {
                        this.spawnEnemy(true);
                        this.spawnEnemy(true);
                        this.lastRescueTime = time;
                    }
                }
            }

            // Assist: Local Edible Availability
            if (time - this.lastEdibleCheckTime > 2000 && !this.bossSpawned) {
                this.lastEdibleCheckTime = time;
                let edibleCount = 0;
                this.enemies.forEach(e => {
                    if (!e.body.active) return;
                    if (e.value < this.player.value) {
                        if (Phaser.Math.Distance.Between(this.player.head.x, this.player.head.y, e.body.x, e.body.y) < 450) {
                            edibleCount++;
                        }
                    }
                });
                if (edibleCount < 4 && this.enemies.length < GameBalance.enemy.normalMaxLimit) {
                    this.spawnEnemy(true);
                }
            }
        }

        // Spawning
        if (this.isUltimatePhase) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0 && this.enemies.length < 16) {
                this.spawnFinalEcosystemEnemy();
                this.spawnTimer = 400;
            }
        } else {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0 && this.enemies.length < GameBalance.enemy.normalMaxLimit) {
                this.spawnEnemy();
                this.spawnTimer = 500;
            }
        }

        if (this.debugUI?.text.visible) {
            this.debugUI.update();
        }

        this.hud.update(
            this.player.hp,
            ProgressionManager.getMaxHP(),
            this.player.boostEnergy,
            GameBalance.player.maxBoostEnergy,
            this.magnet.getHUDText(),
            this.magnet.state
        );
        this.hud.setValue(this.player.value);

        if (this.worldCrown && this.worldCrown.visible && this.gameState === 'RUNNING') {
            this.followLeaderHead();
        }
    }

    private resolveEnemyHeadContacts(time: number): Set<string> {
        const headResolved = new Set<string>();
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.body.active) continue;
            let isHit = this.physics.overlap(this.player.head, e.body);

            // Eat Assist
            if (!isHit && e.value < this.player.value) {
                const dist = Phaser.Math.Distance.Between(this.player.head.x, this.player.head.y, e.body.x, e.body.y);
                if (dist < GameBalance.assist.eatAssistRadius) {
                    const angleToEnemy = Phaser.Math.Angle.Between(this.player.head.x, this.player.head.y, e.body.x, e.body.y);
                    const playerAngle = Math.atan2(this.player.head.body ? (this.player.head.body as Phaser.Physics.Arcade.Body).velocity.y : 0, this.player.head.body ? (this.player.head.body as Phaser.Physics.Arcade.Body).velocity.x : 0);
                    let diff = Phaser.Math.Angle.Wrap(angleToEnemy - playerAngle);
                    if (Math.abs(Phaser.Math.RadToDeg(diff)) < GameBalance.assist.eatAssistConeDeg / 2) {
                        isHit = true;
                    }
                }
            }

            if (isHit) {
                headResolved.add(e.arenaId);
                this.handleEnemyCollision(e, i, time);
                if (this.gameState !== 'RUNNING') break;
            }
        }

        return headResolved;
    }

    private updateBossLogic(dt: number) {
        if (this.gameState !== 'RUNNING') return;
        if (!this.isUltimatePhase && this.player.value >= this.levelDef.bossTriggerValue && !this.bossSpawned) {
            this.spawnBoss();
        }

        if (this.boss) {
            this.boss.update(this.player.head.x, this.player.head.y, this.player.value);
            if (this.bossIndicator) {
                this.bossIndicator.update(this.boss, this.cameras.main, this.getObstacleBounds());
            }
            if (this.physics.overlap(this.player.head, this.boss.body)) {
                this.handleBossCollision();
            }
        } else if (this.ultimateBoss) {
            this.ultimateBoss.update(dt, this.player.head.x, this.player.head.y, this.player.value);
            if (this.bossIndicator) {
                this.bossIndicator.update(this.ultimateBoss, this.cameras.main, this.getObstacleBounds());
            }
            if (this.physics.overlap(this.player.head, this.ultimateBoss.body)) {
                this.handleUltimateBossCollision();
            }
        } else if (this.bossIndicator) {
            this.bossIndicator.hide();
        }

    }

    private resolveBodyContacts(time: number, headResolved: Set<string>) {
        const playerPoint = { x: this.player.head.x, y: this.player.head.y };
        const playerPath = this.player.getVisiblePath();
        const actors: BodyActor[] = [{ id: 'player', kind: 'player', head: playerPoint,
            previousHead: playerPath.length > 1 ? this.previousHeads.get('player') ?? playerPoint : playerPoint,
            headRadius: 20, path: playerPath, active: this.player.head.active }];
        for (const enemy of this.enemies) {
            const point = { x: enemy.body.x, y: enemy.body.y };
            actors.push({ id: enemy.arenaId, kind: 'enemy', head: point,
                previousHead: this.previousHeads.get(enemy.arenaId) ?? point,
                headRadius: 18, path: enemy.getVisiblePath(), active: enemy.body.active });
        }
        const hw = GameBalance.world.width / 2, hh = GameBalance.world.height / 2;
        for (const contact of this.bodyCollisions.detect(actors, time, headResolved)) {
            const snake = contact.actorId === 'player' ? this.player : this.enemies.find(enemy => enemy.arenaId === contact.actorId);
            if (!snake) continue;
            const head = snake instanceof PlayerSnake ? snake.head : snake.body;
            const recoil = calculateBodyRecoil(head, contact,
                { minX: -hw + 40, minY: -hh + 40, maxX: hw - 40, maxY: hh - 40 },
                GameBalance.bodyCollision.separationPx, GameBalance.bodyCollision.maxImpulsePx);
            snake.separateFromBody(recoil.displacement.x, recoil.displacement.y);
            snake.applyRecoil(recoil.direction, GameBalance.bodyCollision.recoilSpeed, GameBalance.bodyCollision.recoilDurationMs);
            const enemyId = contact.actorId === 'player' ? contact.ownerId : contact.actorId;
            this.magnet.suppressEnemyForRecoil(enemyId, time + GameBalance.bodyCollision.detectionCooldownMs);
            this.bodyRecoilCount++;
            this.createParticles(contact.contact.x, contact.contact.y, 0xb8e7ff, 4);
            this.audio.playBounceSFX();
            if (!VisualPreferencesManager.get().reducedMotion) {
                // Squash a bounded visual copy; the Arcade collider stays the same in every mode.
                if (this.recoilEchoes.size < (VisualPreferencesManager.get().lowEffects ? 8 : 24)) {
                    const echo = this.add.image(head.x, head.y, head.texture.key).setDepth(head.depth + 1).setAlpha(0.6);
                    this.recoilEchoes.add(echo);
                    this.tweens.add({ targets: echo, scaleX: 0.87, scaleY: 1.08, alpha: 0, duration: 150,
                        onComplete: () => { this.recoilEchoes.delete(echo); echo.destroy(); } });
                }
            }
        }
        this.previousHeads.clear();
        this.previousHeads.set('player', { x: this.player.head.x, y: this.player.head.y });
        for (const enemy of this.enemies) if (enemy.body.active) this.previousHeads.set(enemy.arenaId, { x: enemy.body.x, y: enemy.body.y });
    }

    private syncMotionTrails() {
        if (this.gameState !== 'RUNNING') return;
        this.player?.syncMotionTrail();
        for (const enemy of this.enemies) if (enemy.body.active) enemy.syncMotionTrail();
        this.ultimateBoss?.syncVisualPosition();
    }

    updateArenaRanking() {
        if (this.gameState !== 'RUNNING') {
            if (this.worldCrown) this.worldCrown.setVisible(false);
            return;
        }

        const participants: ArenaParticipant[] = [];

        if (this.player && this.player.head && this.player.head.active) {
            participants.push({
                id: 'player',
                name: 'YOU',
                value: this.player.value,
                type: 'player'
            });
        }

        for (const e of this.enemies) {
            if (e.body && e.body.active) {
                participants.push({
                    id: e.arenaId,
                    name: e.arenaName,
                    value: e.value,
                    type: 'enemy'
                });
            }
        }

        if (this.boss && this.boss.body && this.boss.body.active) {
            participants.push({
                id: this.boss.arenaId,
                name: this.boss.arenaName,
                value: this.boss.value,
                type: 'boss'
            });
        }

        if (this.ultimateBoss && this.ultimateBoss.body && this.ultimateBoss.body.active) {
            participants.push({
                id: this.ultimateBoss.arenaId,
                name: this.ultimateBoss.arenaName,
                value: this.ultimateBoss.value,
                type: 'boss'
            });
        }

        const result = getRankingResult(participants);
        this.currentRanking = result;
        if (this.leaderboard) {
            this.leaderboard.updateRanking(result);
        }

        if (result.leader) {
            const newLeaderId = result.leader.id;
            if (this.currentLeaderId !== newLeaderId) {
                this.currentLeaderId = newLeaderId;
                const preference = VisualPreferencesManager.get();
                if (!preference.reducedMotion && !preference.lowEffects) {
                    this.tweens.add({ targets: this.worldCrown, scale: { from: 1.4, to: 1.0 }, duration: 250 });
                }
            }
            this.followLeaderHead();
            this.worldCrown.setVisible(this.gameState === 'RUNNING');
        } else {
            this.currentLeaderId = null;
            this.worldCrown.setVisible(false);
        }
    }

    followLeaderHead() {
        if (!this.currentRanking?.leader || this.gameState !== 'RUNNING') {
            if (this.worldCrown) this.worldCrown.setVisible(false);
            return;
        }

        const leader = this.currentRanking.leader;
        if (leader.type === 'player') {
            if (this.player?.head?.active) {
                this.worldCrown.setPosition(this.player.head.x, this.player.head.y - 80);
                this.worldCrown.setVisible(true);
            } else {
                this.worldCrown.setVisible(false);
            }
        } else if (leader.type === 'boss') {
            if (this.boss?.body?.active) {
                this.worldCrown.setPosition(this.boss.body.x, this.boss.body.y - 48);
                this.worldCrown.setVisible(true);
            } else if (this.ultimateBoss?.body?.active) {
                this.worldCrown.setPosition(this.ultimateBoss.body.x, this.ultimateBoss.body.y - 55);
                this.worldCrown.setVisible(true);
            } else {
                this.worldCrown.setVisible(false);
            }
        } else if (leader.type === 'enemy') {
            const e = this.enemies.find(en => en.arenaId === leader.id);
            if (e && e.body && e.body.active) {
                this.worldCrown.setPosition(e.body.x, e.body.y - 80);
                this.worldCrown.setVisible(true);
            } else {
                this.worldCrown.setVisible(false);
            }
        }
    }

    hardReset() {
        this.gameState = 'RUNNING';
        this.player.value = this.runStartValue;
        this.player.hp = ProgressionManager.getMaxHP();
        this.player.resetSteering();
        this.player.boostEnergy = 100;
        this.comboCount = 0;
        this.player.isInvulnerable = false;
        this.scoreSubmitted = false;
        this.isNewBest = false;
        for (const e of this.enemies) { e.destroy(); }
        this.enemies = [];
        this.clearOrbs();
        this.magnet.reset();
        this.bodyCollisions.reset();
        this.previousHeads.clear();
        if (this.boss) { this.boss.destroy(); this.boss = null; this.bossSpawned = false; }
        if (this.ultimateBoss) { this.ultimateBoss.destroy(); this.ultimateBoss = null; }
        if (this.luckyWheelOverlay) { this.luckyWheelOverlay.destroy(); this.luckyWheelOverlay = null; }
        this.forcedWheelRewardId = null;
        this.isUltimatePhase = false;
        this.wheelReward = null;
        this.spawnTimer = 9999999;
        if (this.cameras && this.cameras.main) {
            this.cameras.main.stopFollow();
            this.cameras.main.setScroll(0, 0);
            this.cameras.main.setZoom(1);
        }
        if (this.player && this.player.head) {
            this.player.teleport(0, 0);
            if ((this.player.head as any).body) {
                this.player.head.setVelocity(0, 0);
            }
        }
        this.updateArenaRanking();
    }

    stopSpawning() {
        this.spawnTimer = 9999999;
        this.lastEdibleCheckTime = 999999999;
        this.lastRescueTime = 999999999;
        for (const e of this.enemies) { e.destroy(); }
        this.enemies = [];
        this.bodyCollisions.reset();
        this.previousHeads.clear();
    }

    spawnEnemy(isRescue = false) {
        if (this.enemies.length >= GameBalance.enemy.normalMaxLimit) return;
        const pVal = this.player.value;
        const now = this.time.now;
        const gameTime = now - this.gameStartTime;

        let role = '';
        let val = 1;

        if (isRescue) {
            role = 'edible';
            val = Math.max(1, Math.floor(Math.random() * 3) + 1);
        } else {
            const rand = Math.random();
            if (rand < GameBalance.enemy.safeRatio) {
                role = 'edible';
                val = Math.max(1, Math.floor(Math.random() * (pVal * 0.45)));
                if (gameTime < 20000 && pVal <= 10) val = Math.floor(Math.random() * 4) + 1;
            } else if (rand < GameBalance.enemy.safeRatio + GameBalance.enemy.highValueRatio) {
                role = 'edible';
                val = Math.max(1, Math.floor(pVal * 0.45 + Math.random() * (pVal * 0.55)));
                if (val >= pVal) val = Math.max(1, pVal - 1);
            } else if (rand < GameBalance.enemy.safeRatio + GameBalance.enemy.highValueRatio + GameBalance.enemy.hunterRatio) {
                role = 'hunter';
                val = Math.floor(pVal + Math.random() * (pVal * 0.6));
            } else {
                role = 'giant';
                val = Math.floor(pVal * 2.5 + Math.random() * (pVal * 0.5));
                if (gameTime < 15000) {
                    role = 'hunter';
                    val = Math.floor(pVal + Math.random() * (pVal * 0.6));
                }
            }
            if (val > this.levelDef.normalEnemyMax) val = this.levelDef.normalEnemyMax;
        }

        let range = { min: GameBalance.enemy.spawnRanges.edible.min, max: GameBalance.enemy.spawnRanges.edible.max };
        if (role === 'hunter') range = GameBalance.enemy.spawnRanges.hunter;
        else if (role === 'giant') range = GameBalance.enemy.spawnRanges.giant;

        if (isRescue) {
            range = { min: GameBalance.assist.earlyGameRescueDistMin, max: GameBalance.assist.earlyGameRescueDistMax };
        }

        let sx = 0, sy = 0;
        let validSpawn = false;
        let attempts = 0;
        const SPAWN_EDGE_MARGIN = 140;
        const hw = GameBalance.world.width / 2;
        const hh = GameBalance.world.height / 2;

        while (!validSpawn && attempts < 20) {
            let angle = Math.random() * Math.PI * 2;
            let dist = range.min + Math.random() * (range.max - range.min);

            if (isRescue) {
                const vAngle = Math.atan2(this.player.head.body ? (this.player.head.body as Phaser.Physics.Arcade.Body).velocity.y : 0, this.player.head.body ? (this.player.head.body as Phaser.Physics.Arcade.Body).velocity.x : 0);
                let bestAngle = angle;
                let bestMargin = -9999;

                for (let i = 0; i < 3; i++) {
                    const testAngle = vAngle + (Math.random() * 1.5 - 0.75);
                    const tx = this.player.head.x + Math.cos(testAngle) * dist;
                    const ty = this.player.head.y + Math.sin(testAngle) * dist;
                    const margin = Math.min(hw - Math.abs(tx), hh - Math.abs(ty));
                    if (margin > bestMargin) {
                        bestMargin = margin;
                        bestAngle = testAngle;
                    }
                }
                angle = bestAngle;
            }

            sx = this.player.head.x + Math.cos(angle) * dist;
            sy = this.player.head.y + Math.sin(angle) * dist;

            if (sx >= -hw + SPAWN_EDGE_MARGIN && sx <= hw - SPAWN_EDGE_MARGIN &&
                sy >= -hh + SPAWN_EDGE_MARGIN && sy <= hh - SPAWN_EDGE_MARGIN) {
                const actualDist = Phaser.Math.Distance.Between(this.player.head.x, this.player.head.y, sx, sy);
                if (actualDist >= range.min - 10) {
                    validSpawn = true;
                }
            }
            attempts++;
        }

        if (!validSpawn) {
            const angleToCenter = Math.atan2(-this.player.head.y, -this.player.head.x);
            sx = this.player.head.x + Math.cos(angleToCenter) * range.min;
            sy = this.player.head.y + Math.sin(angleToCenter) * range.min;
            sx = Phaser.Math.Clamp(sx, -hw + SPAWN_EDGE_MARGIN, hw - SPAWN_EDGE_MARGIN);
            sy = Phaser.Math.Clamp(sy, -hh + SPAWN_EDGE_MARGIN, hh - SPAWN_EDGE_MARGIN);
        }

        const enemy = new NumberEnemy(this, sx, sy, val, this.skinSelector.next());
        this.enemies.push(enemy);
        return enemy;
    }

    spawnOrb(x: number, y: number, activation: OrbActivation = {}): CollectibleOrb {
        if (this.orbs.length >= GameBalance.orb.maxActive) {
            const oldest = this.orbs.shift();
            if (oldest) this.recycleOrb(oldest);
        }
        const orb = this.freeOrbs.pop();
        if (orb) orb.activate(x, y, activation);
        const activated = orb ?? new CollectibleOrb(this, x, y, activation);
        this.orbs.push(activated);
        return activated;
    }

    private recycleOrb(orb: CollectibleOrb) {
        orb.deactivate();
        if (!this.freeOrbs.includes(orb)) this.freeOrbs.push(orb);
    }

    spawnBoss() {
        this.bossSpawned = true;

        let sx = 0, sy = 0;
        let validSpawn = false;
        let attempts = 0;
        const SPAWN_EDGE_MARGIN = 140;
        const hw = GameBalance.world.width / 2;
        const hh = GameBalance.world.height / 2;
        const dist = 1000;

        while (!validSpawn && attempts < 20) {
            let angle = Math.random() * Math.PI * 2;
            sx = this.player.head.x + Math.cos(angle) * dist;
            sy = this.player.head.y + Math.sin(angle) * dist;

            if (sx >= -hw + SPAWN_EDGE_MARGIN && sx <= hw - SPAWN_EDGE_MARGIN &&
                sy >= -hh + SPAWN_EDGE_MARGIN && sy <= hh - SPAWN_EDGE_MARGIN) {
                validSpawn = true;
            }
            attempts++;
        }

        if (!validSpawn) {
            const angleToCenter = Math.atan2(-this.player.head.y, -this.player.head.x);
            sx = this.player.head.x + Math.cos(angleToCenter) * dist;
            sy = this.player.head.y + Math.sin(angleToCenter) * dist;
            sx = Phaser.Math.Clamp(sx, -hw + SPAWN_EDGE_MARGIN, hw - SPAWN_EDGE_MARGIN);
            sy = Phaser.Math.Clamp(sy, -hh + SPAWN_EDGE_MARGIN, hh - SPAWN_EDGE_MARGIN);
        }

        this.boss = new NumberBoss(this, sx, sy, this.levelDef.bossValue);
        this.audio.playBossAlert();

        const alertText = t('bossAppeared', { value: this.levelDef.bossValue }) || `${this.levelDef.bossValue} APPEARED!`;
        const alert = this.add.text(this.player.head.x, this.player.head.y - 100, alertText, {
            fontSize: '48px', fontStyle: 'bold', color: '#ff0000', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(200);

        this.tweens.add({
            targets: alert, y: alert.y - 50, alpha: 0, duration: 2000,
            onComplete: () => alert.destroy()
        });
    }

    handleEnemyCollision(e: NumberEnemy, index: number, time: number) {
        if (!e.body?.active || !this.enemies.includes(e)) return;
        if (isEdible(this.player.value, e.value)) {
            // Freeze valid geometry before removing AI/physics; generic destroy never drops.
            const visiblePath = e.getVisiblePath().map(point => ({ ...point }));
            const drops = createSnakeOrbDrops(visiblePath, {
                maxDrops: GameBalance.orb.maxActive, spacing: GameBalance.snake.sampleSpacing,
                minMs: GameBalance.orb.chainTransformMinMs, maxMs: GameBalance.orb.chainTransformMaxMs,
                score: GameBalance.orb.rewardScorePerSnake, energy: GameBalance.orb.rewardEnergyPerSnake
            });
            // EAT
            this.player.eat(e.value);
            this.comboCount++;
            this.lastEatTime = time;
            this.hud.addScore(e.value * this.comboCount);
            this.audio.playEatSFX(this.comboCount);

            this.createParticles(e.body.x, e.body.y, 0x00ff00);

            this.snakeDropCount++;
            e.destroy();
            this.bodyCollisions.forget(e.arenaId);
            this.previousHeads.delete(e.arenaId);
            this.magnet.forgetEnemy(e.arenaId);
            // Index can change while multiple head contacts resolve in the same frame.
            const actualIndex = this.enemies.indexOf(e);
            this.enemies.splice(actualIndex === index ? index : actualIndex, 1);
            for (const drop of drops) {
                this.spawnOrb(drop.position.x, drop.position.y, {
                    reward: drop.reward, transformDelay: drop.transformDelay,
                    transformDuration: drop.transformDuration, unlockDelay: drop.unlockDelay,
                    sourceTexture: 'enemy_body'
                });
            }

            const oldVal = this.player.value - e.value;
            if (this.boss && this.player.value > this.levelDef.bossValue && oldVal <= this.levelDef.bossValue) {
                this.showReversalText(t('nowHuntBoss', { value: this.levelDef.bossValue }) || `NOW HUNT ${this.levelDef.bossValue}!`);
                this.audio.playBossReversal();
            }
            if (this.ultimateBoss && this.player.value > this.ultimateBoss.value && oldVal <= this.ultimateBoss.value) {
                this.showReversalText(t('nowHuntBoss', { value: 500 }) || `NOW HUNT 500!`);
                this.audio.playBossReversal();
            }

            if (!VisualPreferencesManager.get().reducedMotion) this.cameras.main.shake(100, 0.002);

        } else if (!this.player.isInvulnerable) {
            // DAMAGE
            const dmg = calculateDamage(this.player.value, e.value);
            if (dmg.instantKO) {
                this.gameState = 'GAME_OVER';
                this.audio.playGameOver();
                this.saveScore();
                this.showEndScreen('GAME OVER', '#ff0000');
            } else if (dmg.hpLoss > 0) {
                const newSeg = calculateNewBodySegments(this.player.segments, dmg.hpLoss);
                const angle = Math.atan2(this.player.head.y - e.body.y, this.player.head.x - e.body.x);
                this.player.takeDamage(dmg.hpLoss, newSeg, new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle)));
                if (!VisualPreferencesManager.get().reducedMotion) this.cameras.main.shake(160, 0.006);
                this.audio.playHitSFX();
                if (this.player.hp <= 0) {
                    this.gameState = 'GAME_OVER';
                    this.audio.playGameOver();
                    this.saveScore();
                    this.showEndScreen('GAME OVER', '#ff0000');
                }
            }
        }
    }

    handleBossCollision() {
        if (!this.boss || !this.boss.body) return;
        if (this.player.value > this.boss.value) {
            // Victory or Wheel Finale
            if (this.bossIndicator) this.bossIndicator.hide();
            this.boss.destroy();
            this.boss = null;
            this.createParticles(this.player.head.x, this.player.head.y, 0xff0055, 50);
            this.audio.playEatSFX(10);
            this.hud.addScore(1000);

            if (this.levelId === 4) {
                this.beginLuckyWheelFinale();
            } else {
                this.levelClear();
            }
        } else if (!this.player.isInvulnerable) {
            // DAMAGE
            const dmg = calculateDamage(this.player.value, this.boss.value);
            if (dmg.instantKO) {
                this.gameState = 'GAME_OVER';
                this.audio.playGameOver();
                this.saveScore();
                this.showEndScreen('GAME OVER', '#ff0000');
            } else if (dmg.hpLoss > 0) {
                const newSeg = calculateNewBodySegments(this.player.segments, dmg.hpLoss);
                const angle = Math.atan2(this.player.head.y - this.boss.body.y, this.player.head.x - this.boss.body.x);
                this.player.takeDamage(dmg.hpLoss, newSeg, new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle)));
                if (!VisualPreferencesManager.get().reducedMotion) this.cameras.main.shake(160, 0.006);
                this.audio.playHitSFX();
                if (this.player.hp <= 0) {
                    this.gameState = 'GAME_OVER';
                    this.audio.playGameOver();
                    this.saveScore();
                    this.showEndScreen('GAME OVER', '#ff0000');
                }
            }
        }
    }

    beginLuckyWheelFinale() {
        this.gameState = 'LUCKY_WHEEL';
        if (this.worldCrown) this.worldCrown.setVisible(false);
        if (this.bossIndicator) this.bossIndicator.hide();
        if (this.cameras && this.cameras.main) {
            this.cameras.main.stopFollow();
        }
        if (this.player && this.player.head && (this.player.head as any).body) {
            this.player.head.setVelocity(0, 0);
        }
        this.luckyWheelOverlay = new LuckyWheelOverlay(this, (reward) => {
            this.luckyWheelOverlay?.destroy();
            this.luckyWheelOverlay = null;
            this.transitionToUltimateArena(reward);
        });
        if (this.forcedWheelRewardId) {
            this.luckyWheelOverlay.forcedRewardId = this.forcedWheelRewardId;
        }
    }

    transitionToUltimateArena(reward: WheelReward) {
        if (this.isUltimatePhase) return;
        this.isUltimatePhase = true;
        if (this.cameras && this.cameras.main && this.player && this.player.head) {
            this.cameras.main.startFollow(this.player.head, true, 0.1, 0.1);
        }
        this.wheelReward = reward;
        applyWheelReward(this.player, reward, this.magnet);
        (this as any).__wheelTestSnapshot = {
            value: this.player.value,
            hp: this.player.hp,
            maxHp: this.player.maxHp,
            boostEnergy: this.player.boostEnergy,
            segments: this.player.segments,
            magnetState: this.magnet.state
        };

        // Clear previous enemies and orbs
        for (const e of this.enemies) { e.destroy(); }
        this.enemies = [];
        this.bodyCollisions.reset();
        this.previousHeads.clear();
        this.magnet.clearContactSuppression();
        this.clearOrbs();

        // Teleport player near center
        this.player.teleport(0, 80);

        // Spawn 10 edible snakes (values 25-80)
        for (let i = 0; i < 10; i++) {
            const val = 25 + i * 6; // 25 to 79
            const angle = (i / 10) * Math.PI * 2;
            const dist = 350 + (i % 3) * 80;
            const sx = Math.cos(angle) * dist;
            const sy = Math.sin(angle) * dist;
            const enemy = new NumberEnemy(this, sx, sy, val, this.skinSelector.next());
            this.enemies.push(enemy);
        }

        // Spawn UltimateBoss at (0, -500)
        this.ultimateBoss = new UltimateBoss(this, 0, -500);
        this.audio.playBossAlert();

        const bannerText = t('ultimateBossAppeared') || 'ULTIMATE BOSS 500 APPEARED!';
        const alert = this.add.text(this.player.head.x, this.player.head.y - 100, bannerText, {
            fontSize: '44px', fontStyle: 'bold', color: '#ff0055', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(200);

        this.tweens.add({
            targets: alert, y: alert.y - 50, alpha: 0, duration: 2500,
            onComplete: () => alert.destroy()
        });

        this.isUltimatePhase = true;
        this.gameState = 'RUNNING';
        this.updateArenaRanking();
    }

    spawnFinalEcosystemEnemy(): NumberEnemy {
        const hw = GameBalance.world.width / 2;
        const hh = GameBalance.world.height / 2;
        const SPAWN_EDGE_MARGIN = 140;
        const angle = Math.random() * Math.PI * 2;
        const dist = 300 + Math.random() * 500;
        let sx = this.player.head.x + Math.cos(angle) * dist;
        let sy = this.player.head.y + Math.sin(angle) * dist;
        sx = Phaser.Math.Clamp(sx, -hw + SPAWN_EDGE_MARGIN, hw - SPAWN_EDGE_MARGIN);
        sy = Phaser.Math.Clamp(sy, -hh + SPAWN_EDGE_MARGIN, hh - SPAWN_EDGE_MARGIN);
        const val = Phaser.Math.Between(10, 90);
        const enemy = new NumberEnemy(this, sx, sy, val, this.skinSelector.next());
        this.enemies.push(enemy);
        return enemy;
    }

    handleUltimateBossCollision() {
        if (!this.ultimateBoss || !this.ultimateBoss.body.active) return;

        if (this.player.value > this.ultimateBoss.value) {
            // Victory
            if (this.bossIndicator) this.bossIndicator.hide();
            this.createParticles(this.ultimateBoss.body.x, this.ultimateBoss.body.y, 0xff00ff, 80);
            this.audio.playEatSFX(10);
            this.audio.playVictory();
            this.hud.addScore(3000);
            this.ultimateBoss.destroy();
            this.ultimateBoss = null;
            this.levelClear();
        } else if (!this.player.isInvulnerable) {
            // DAMAGE
            const dmg = calculateDamage(this.player.value, this.ultimateBoss.value);
            if (dmg.instantKO) {
                this.gameState = 'GAME_OVER';
                this.audio.playGameOver();
                this.saveScore();
                this.showEndScreen('GAME OVER', '#ff0000');
            } else if (dmg.hpLoss > 0) {
                const newSeg = calculateNewBodySegments(this.player.segments, dmg.hpLoss);
                const angle = Math.atan2(this.player.head.y - this.ultimateBoss.body.y, this.player.head.x - this.ultimateBoss.body.x);
                this.player.takeDamage(dmg.hpLoss, newSeg, new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle)));
                if (!VisualPreferencesManager.get().reducedMotion) this.cameras.main.shake(160, 0.006);
                this.audio.playHitSFX();
                if (this.player.hp <= 0) {
                    this.gameState = 'GAME_OVER';
                    this.audio.playGameOver();
                    this.saveScore();
                    this.showEndScreen('GAME OVER', '#ff0000');
                }
            }
        }
    }

    showReversalText(text: string) {
        const t = this.add.text(this.player.head.x, this.player.head.y - 80, text, {
            fontSize: '32px', fontStyle: 'bold', color: '#00ffff'
        }).setOrigin(0.5).setDepth(200);

        this.tweens.add({
            targets: t, y: t.y - 40, alpha: 0, duration: 1500,
            onComplete: () => t.destroy()
        });
    }

    createParticles(x: number, y: number, color: number, count = 20) {
        const preference = VisualPreferencesManager.get();
        const limit = preference.lowEffects || preference.reducedMotion ? 32 : 96;
        const visibleCount = Math.min(preference.reducedMotion ? Math.min(2, count) : preference.lowEffects ? Math.min(4, count) : count, limit - this.particles.size);
        for (let i = 0; i < visibleCount; i++) {
            const p = this.add.circle(x, y, 4, color).setDepth(150);
            this.particles.add(p);
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 150;
            if (!preference.reducedMotion) {
                this.physics.add.existing(p);
                (p.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            }

            this.tweens.add({
                targets: p, alpha: 0, scale: 0.1, duration: 600,
                onComplete: () => { this.particles.delete(p); p.destroy(); }
            });
        }
    }

    levelClear() {
        this.gameState = 'LEVEL_CLEAR';
        this.updateArenaRanking();
        if (this.cameras && this.cameras.main) this.cameras.main.stopFollow();
        if (this.player && this.player.head && (this.player.head as any).body) this.player.head.setVelocity(0, 0);
        if (this.bossIndicator) this.bossIndicator.hide();
        this.saveScore();
        this.clearOrbs();
        this.audio.playVictory();

        let newlyClaimedReward = false;
        if (this.levelDef.reward) {
            newlyClaimedReward = ProgressionManager.claimReward(this.levelDef.reward.id, this.levelDef.reward.value);
        }

        let newlyUnlocked = false;
        if (this.levelDef.nextLevelId) {
            newlyUnlocked = ProgressionManager.unlockLevel(this.levelDef.nextLevelId);
        }

        this.time.delayedCall(1000, () => {
            this.showLevelClearScreen(newlyClaimedReward, newlyUnlocked);
        });
    }

    showLevelClearScreen(newlyClaimedReward: boolean, newlyUnlocked: boolean) {
        this.worldCrown?.setVisible(false);
        this.cameras.main.stopFollow();
        this.cameras.main.setZoom(1);
        const w = this.scale.width, h = this.scale.height, cx = w / 2, cy = h / 2;
        const panelH = Math.min(h - 28, uiUnit(this, 520));
        this.createEndPanel(cx, cy, Math.min(w - 28, uiUnit(this, 560)), panelH);
        const top = cy - panelH / 2;
        const title = uiText(this, cx, top + 38, t('levelClearTitle', { name: t(`level_${this.levelId}`) }), Math.min(26, w / uiUnit(this, 1) * 0.06), '#81efdc');
        title.setWordWrapWidth(w - 48).setDepth(302).setScrollFactor(0);
        uiText(this, cx, top + 83, `${t('score')}: ${this.hud.getScore()}    ${t('best')}: ${ProgressionManager.getBestScore(this.levelId)}`, 18).setDepth(302).setScrollFactor(0);
        if (this.isNewBest) uiText(this, cx, top + 112, t('newBest'), 16, '#ffe198').setDepth(302).setScrollFactor(0);
        let message = '';
        if (!this.levelDef.nextLevelId) message = `${t('allLevelsCleared')} · ${t('masterTitle')}`;
        else {
            if (newlyClaimedReward) message = `${t('levelRewardHeart')} · ${t('heartsTransition', { old: ProgressionManager.getMaxHP() - this.levelDef.reward!.value, new: ProgressionManager.getMaxHP() })}`;
            if (newlyUnlocked) message += `${message ? '\n' : ''}${t('levelUnlocked', { next: this.levelDef.nextLevelId })}`;
        }
        if (message) uiText(this, cx, top + 146, message, 18, '#e8b8c3').setWordWrapWidth(w - 48).setDepth(302).setScrollFactor(0);
        this.createLevelClearButtons(cx, cy + panelH / 2 - uiUnit(this, 88));
    }

    private createEndPanel(cx: number, cy: number, width: number, height: number) {
        this.add.rectangle(cx, cy, this.scale.width, this.scale.height, ARCADE.background, 0.88).setDepth(300).setScrollFactor(0);
        roundedPanel(this, cx, cy, width, height).setDepth(301).setScrollFactor(0);
    }

    private fixedEndButton(cx: number, cy: number, label: string, onPress: () => void, name: string, primary = true) {
        const button = arcadeButton(this, cx, cy, Math.min(this.scale.width - 64, uiUnit(this, 300)), label, onPress, name, primary);
        button.art.setDepth(302).setScrollFactor(0);
        button.bg.setDepth(303).setScrollFactor(0);
        button.label.setDepth(304).setScrollFactor(0);
    }

    createLevelClearButtons(cx: number, cy: number) {
        const row = uiUnit(this, 64);
        if (!this.levelDef.nextLevelId) {
            this.fixedEndButton(cx, cy - row / 2, t('playAgain'), () => this.scene.start('PrepScene', { levelId: 4 }), 'playAgainBtn');
            this.fixedEndButton(cx, cy + row / 2, t('levelSelect'), () => this.scene.start('MenuScene'), 'levelSelectBtn', false);
            return;
        }
        if (ProgressionManager.getHighestUnlockedLevel() >= this.levelDef.nextLevelId) {
            this.fixedEndButton(cx, cy - row, t('nextLevel'), () => this.scene.start('PrepScene', { levelId: this.levelDef.nextLevelId }), 'nextBtn');
        }
        this.fixedEndButton(cx, cy, t('replayLevel'), () => this.scene.start('PrepScene', { levelId: this.levelId }), 'replayBtn', false);
        this.fixedEndButton(cx, cy + row, t('menu'), () => this.scene.start('MenuScene'), 'menuBtn', false);
    }

    gameOver() {
        this.gameState = 'GAME_OVER';
        if (this.cameras && this.cameras.main) this.cameras.main.stopFollow();
        if (this.player && this.player.head && (this.player.head as any).body) this.player.head.setVelocity(0, 0);
        if (this.bossIndicator) this.bossIndicator.hide();
        if (this.worldCrown) this.worldCrown.setVisible(false);
        this.clearOrbs();
        this.audio.playGameOver();
        this.saveScore();
        this.showEndScreen('GAME OVER', '#ff0000');
    }

    victory() {
        this.gameState = 'VICTORY';
        if (this.cameras && this.cameras.main) this.cameras.main.stopFollow();
        if (this.player && this.player.head && (this.player.head as any).body) this.player.head.setVelocity(0, 0);
        if (this.bossIndicator) this.bossIndicator.hide();
        if (this.worldCrown) this.worldCrown.setVisible(false);
        this.clearOrbs();
        this.audio.playVictory();
        this.saveScore();
        this.showEndScreen('VICTORY', '#00ff00');
    }

    saveScore(): boolean {
        if (this.scoreSubmitted) return false;
        this.scoreSubmitted = true;
        const s = this.hud.getScore();
        try {
            const b = parseInt(localStorage.getItem('bestScore') || '0', 10);
            if (s > b) localStorage.setItem('bestScore', s.toString());
        } catch { /* Session play and the end screen remain available without storage. */ }
        this.isNewBest = ProgressionManager.submitScore(this.levelId, s);
        this.hud.setBestScore(ProgressionManager.getBestScore(this.levelId));
        return this.isNewBest;
    }

    showEndScreen(title: string, color: string) {
        this.worldCrown?.setVisible(false);
        this.cameras.main.stopFollow();
        this.cameras.main.setZoom(1);
        const w = this.scale.width, h = this.scale.height, cx = w / 2, cy = h / 2;
        const panelH = Math.min(h - 28, uiUnit(this, 400));
        this.createEndPanel(cx, cy, Math.min(w - 28, uiUnit(this, 520)), panelH);
        const top = cy - panelH / 2;
        const titleText = title === 'GAME OVER' ? t('gameOver') : (title === 'VICTORY' ? t('victory') : title);
        uiText(this, cx, top + 48, titleText, 30, color).setDepth(302).setScrollFactor(0);
        uiText(this, cx, top + 105, t('finalValue', { value: this.player.value }), 20).setDepth(302).setScrollFactor(0);
        uiText(this, cx, top + 145, `${t('score')}: ${this.hud.getScore()}`, 20).setDepth(302).setScrollFactor(0);
        uiText(this, cx, top + 180, `${t('best')}: ${ProgressionManager.getBestScore(this.levelId)}`, 18, ARCADE.muted).setDepth(302).setScrollFactor(0);
        if (this.isNewBest) uiText(this, cx, top + 215, t('newBest'), 18, '#ffe198').setDepth(302).setScrollFactor(0);
        this.fixedEndButton(cx, cy + panelH / 2 - uiUnit(this, 42), t('playAgain'), () => this.scene.start('PrepScene', { levelId: this.levelId }), 'playAgainBtn');
    }

    teardown() {
        this.events.off('postupdate', this.syncMotionTrails, this);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        this.scale.off('resize', this.resize, this);
        this.leaderboardTimer?.remove();
        this.worldCrown?.destroy();
        this.leaderboard?.destroy();
        this.bossIndicator?.destroy();
        this.enemies.forEach(e => e.destroy());
        this.clearOrbs();
        this.freeOrbs.forEach(orb => orb.destroy());
        this.freeOrbs = [];
        this.previousHeads.clear();
        this.bodyCollisions.reset();
        this.particles.forEach(particle => particle.destroy());
        this.particles.clear();
        this.recoilEchoes.forEach(echo => echo.destroy());
        this.recoilEchoes.clear();
        this.player.destroy();
        this.boss?.destroy();
        this.ultimateBoss?.destroy();
        this.luckyWheelOverlay?.destroy();
        this.magnet?.destroy();
        if (this.debugUI) this.debugUI.text.destroy();
    }

    resize(gameSize: Phaser.Structs.Size) {
        this.joystick.resize(gameSize);
        this.hud.resize(gameSize);
        this.leaderboard?.resize(gameSize);
        this.bossIndicator?.resize(gameSize);
        this.luckyWheelOverlay?.resize(gameSize);
    }

    getObstacleBounds(): RectBounds[] {
        const list: RectBounds[] = [];
        if (this.hud) {
            list.push(this.hud.getValueBounds());
            list.push(this.hud.getHPBounds());
            list.push(this.hud.getScoreBounds());
            list.push(this.hud.getBestBounds());
            list.push(this.hud.getMagnetHUDBounds());
            list.push(this.hud.getBoostBarBounds());
            list.push(this.hud.getBoostButtonBounds());
            list.push(this.hud.getMagnetButtonBounds());
        }
        if (this.leaderboard) {
            list.push(this.leaderboard.getBounds());
        }
        if (this.joystick) {
            list.push(this.joystick.getBounds());
        }
        return list;
    }

    getLayoutBounds() {
        return {
            hp: this.hud.getHPBounds(),
            value: this.hud.getValueBounds(),
            score: this.hud.getScoreBounds(),
            best: this.hud.getBestBounds(),
            magnetHUD: this.hud.getMagnetHUDBounds(),
            boostBar: this.hud.getBoostBarBounds(),
            boostButton: this.hud.getBoostButtonBounds(),
            magnetButton: this.hud.getMagnetButtonBounds(),
            joystick: this.joystick.getBounds(),
            leaderboard: this.leaderboard.getBounds(),
            bossIndicator: this.bossIndicator ? this.bossIndicator.getBounds() : null
        };
    }
}
