import Phaser from 'phaser';
import { PlayerSnake } from '../entities/PlayerSnake';
import { NumberEnemy } from '../entities/NumberEnemy';
import { NumberBoss } from '../entities/NumberBoss';
import { ProgressionManager } from '../models/Progression';
import { getLevel, type LevelDefinition } from '../config/levels';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { HUD } from '../ui/HUD';
import { AudioSystem } from '../systems/AudioSystem';
import { GameBalance } from '../config/gameBalance';
import { isEdible, calculateDamage, calculateNewBodySegments } from '../utils/gameRules';
import { DebugUI } from '../ui/DebugUI';
import { MagnetAbility } from '../systems/MagnetAbility';
import { CollectibleOrb } from '../entities/CollectibleOrb';
import { LeaderboardPanel } from '../ui/LeaderboardPanel';
import { BossIndicator } from '../ui/BossIndicator';
import type { RectBounds } from '../utils/layout';
import { getRankingResult, type ArenaParticipant, type RankingResult } from '../utils/ranking';
import { normalizeStartValue } from '../utils/prepValues';

export class GameScene extends Phaser.Scene {
    player!: PlayerSnake;
    enemies: NumberEnemy[] = [];
    boss: NumberBoss | null = null;
    bossIndicator!: BossIndicator;
    orbs: CollectibleOrb[] = [];
    magnet!: MagnetAbility;
    
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
        this.levelDef = getLevel(this.levelId);
        this.runStartValue = normalizeStartValue(data?.startValueOverride ?? this.levelDef.startValue);
    }

    create() {
        this.gameState = 'RUNNING';
        this.enemies = [];
        this.orbs = [];
        this.boss = null;
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
                getBossState: () => this.boss ? (this.boss.isFleeing ? 'FLEE' : 'CHASE') : 'NONE'
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
                    const e = new NumberEnemy(this, x, y, val, skinStyle);
                    this.enemies.push(e);
                    return e;
                },
                getEnemies: () => this.enemies,
                spawnBoss: () => {
                    if (!this.bossSpawned) this.spawnBoss();
                },
                getBossState: () => this.boss ? (this.boss.isFleeing ? 'FLEE' : 'CHASE') : 'NONE',
                getBossPosition: () => this.boss && this.boss.body ? { x: this.boss.body.x, y: this.boss.body.y } : null,
                setBossPositionForTest: (x: number, y: number) => {
                    if (this.boss && this.boss.body) {
                        this.boss.body.setPosition(x, y);
                        this.boss.valueText.setPosition(x, y);
                    }
                },
                getBossVelocity: () => this.boss && this.boss.body && this.boss.body.body ? { x: this.boss.body.body.velocity.x, y: this.boss.body.body.velocity.y } : { x: 0, y: 0 },
                getBossIndicatorState: () => this.bossIndicator ? this.bossIndicator.getState() : { visible: false, x: 0, y: 0, value: 0, text: '', angle: 0, bounds: null },
                forceSpecificEnemy: (e: any) => { this.player.isInvulnerable = false; this.handleEnemyCollision(e, 0, this.time.now); },
                forceCollisionWithEnemy: (index: number) => {
                    this.player.isInvulnerable = false;
                    if (this.enemies[index]) {
                        this.handleEnemyCollision(this.enemies[index], index, this.time.now);
                    }
                },
                forceCollisionWithBoss: () => { this.player.isInvulnerable = false; 
                    if (this.boss) this.handleBossCollision();
                },
                getGameState: () => {
                    if (this.gameState === 'GAME_OVER' || this.gameState === 'VICTORY' || this.gameState === 'LEVEL_CLEAR') return this.gameState;
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
                }
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

        this.events.on('shutdown', this.teardown, this);

        // Initial spawn
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 240 + Math.random() * 200;
            const sx = Phaser.Math.Clamp(Math.cos(angle) * dist, -ww/2+50, ww/2-50);
            const sy = Phaser.Math.Clamp(Math.sin(angle) * dist, -wh/2+50, wh/2-50);
            const val = Phaser.Math.Between(1, 4);
            const enemy = new NumberEnemy(this, sx, sy, val);
            this.enemies.push(enemy);
        }
        for (let i = 0; i < 14; i++) this.spawnEnemy();
    }

    createBackgroundTheme() {
        const ww = GameBalance.world.width;
        const wh = GameBalance.world.height;
        const theme = this.levelDef.theme || 'neon-grid';

        const bgGraphics = this.add.graphics();
        bgGraphics.setDepth(-12);

        let gridFill = 0x000000;
        let gridLine = 0x333333;
        let gridAlpha = 0.2;
        let boundaryColor = 0x00ffff;

        if (theme === 'neon-grid') {
            // L1: Neon Grid - dark blue, cyan grid
            bgGraphics.fillStyle(0x060c1a, 1);
            bgGraphics.fillRect(-ww/2, -wh/2, ww, wh);
            gridLine = 0x00ffff;
            gridAlpha = 0.15;
            boundaryColor = 0x00ffff;
        } else if (theme === 'cyber-city') {
            // L2: Cyber City - dark navy/purple, magenta/purple lines
            bgGraphics.fillStyle(0x0e0c24, 1);
            bgGraphics.fillRect(-ww/2, -wh/2, ww, wh);
            gridLine = 0xcc00ff;
            gridAlpha = 0.15;
            boundaryColor = 0xff00cc;
            // Distant geometric city lines
            bgGraphics.lineStyle(1.5, 0x8800bb, 0.12);
            for (let x = -ww/2 + 200; x < ww/2; x += 300) {
                const h = 200 + ((Math.abs(x) * 7) % 300);
                bgGraphics.strokeRect(x, wh/2 - h, 140, h);
            }
        } else if (theme === 'lava-core') {
            // L3: Lava Core - dark charcoal, red/orange energy cracks
            bgGraphics.fillStyle(0x180b0b, 1);
            bgGraphics.fillRect(-ww/2, -wh/2, ww, wh);
            gridLine = 0xff3300;
            gridAlpha = 0.18;
            boundaryColor = 0xff5500;
            // Lava cracks
            bgGraphics.lineStyle(2, 0xff6600, 0.15);
            for (let i = 0; i < 20; i++) {
                const cx = -ww/2 + 100 + (i * 115) % (ww - 200);
                const cy = -wh/2 + 100 + (i * 97) % (wh - 200);
                bgGraphics.beginPath();
                bgGraphics.moveTo(cx, cy);
                bgGraphics.lineTo(cx + 40, cy + 25);
                bgGraphics.lineTo(cx + 70, cy + 10);
                bgGraphics.strokePath();
            }
        } else if (theme === 'deep-space') {
            // L4: Deep Space - black/deep purple, stars & cosmic rings
            bgGraphics.fillStyle(0x050310, 1);
            bgGraphics.fillRect(-ww/2, -wh/2, ww, wh);
            gridLine = 0x443377;
            gridAlpha = 0.12;
            boundaryColor = 0x9955ff;
            // Stars
            bgGraphics.fillStyle(0xffffff, 0.4);
            for (let i = 0; i < 60; i++) {
                const sx = -ww/2 + ((i * 137) % ww);
                const sy = -wh/2 + ((i * 241) % wh);
                const r = (i % 3 === 0) ? 2 : 1;
                bgGraphics.fillCircle(sx, sy, r);
            }
            // Cosmic ring
            bgGraphics.lineStyle(2, 0x9955ff, 0.1);
            bgGraphics.strokeCircle(0, 0, 450);
            bgGraphics.strokeCircle(0, 0, 750);
        }

        this.grid = this.add.grid(0, 0, ww, wh, 100, 100, gridFill, 0, gridLine, gridAlpha);
        this.grid.setDepth(-11);

        // Visual Boundary
        const boundary = this.add.graphics();
        boundary.lineStyle(10, boundaryColor, 0.35);
        boundary.strokeRect(-ww/2, -wh/2, ww, wh);
        boundary.setDepth(-10);
    }

    activateMagnet() {
        this.magnet.activate();
    }

    clearOrbs() {
        for (const orb of this.orbs) {
            orb.destroy();
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
        if (this.gameState === 'GAME_OVER' || this.gameState === 'VICTORY' || this.gameState === 'LEVEL_CLEAR') return;

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
                orb.destroy();
                this.orbs.splice(i, 1);
                continue;
            }
            // Head overlap collects orb
            const dist = Phaser.Math.Distance.Between(this.player.head.x, this.player.head.y, orb.sprite.x, orb.sprite.y);
            if (dist < 32) {
                const ox = orb.sprite.x;
                const oy = orb.sprite.y;
                orb.destroy();
                this.orbs.splice(i, 1);
                this.hud.addScore(GameBalance.orb.scoreReward);
                this.player.boostEnergy = Math.min(GameBalance.player.maxBoostEnergy, this.player.boostEnergy + GameBalance.orb.boostReward);
                this.createParticles(ox, oy, 0xffff00, 6);
            }
        }

        // Dynamic Camera Zoom
        const targetZoom = 1 - (this.player.segments * 0.002);
        const clampedZoom = Phaser.Math.Clamp(targetZoom, 0.7, 1);
        this.cameras.main.setZoom(Phaser.Math.Linear(this.cameras.main.zoom, clampedZoom, 0.05));

        if (time - this.lastEatTime > GameBalance.combo.window) {
            this.comboCount = 0;
        }

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
            if (edibleCount < 4 && this.enemies.length < GameBalance.enemy.normalMaxLimit + 2) {
                this.spawnEnemy(true);
            }
        }

        // Enemy Collision & Eat Assist
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
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
                this.handleEnemyCollision(e, i, time);
            }
        }

        // Boss Logic
        if (this.player.value >= this.levelDef.bossTriggerValue && !this.bossSpawned) {
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
        } else if (this.bossIndicator) {
            this.bossIndicator.hide();
        }

        // Spawning
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.enemies.length < GameBalance.enemy.normalMaxLimit) {
            this.spawnEnemy();
            this.spawnTimer = 500;
        }
        
        if (this.debugUI) {
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

        if (this.worldCrown && this.worldCrown.visible && this.gameState === 'RUNNING') {
            this.followLeaderHead();
        }
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

        const result = getRankingResult(participants);
        this.currentRanking = result;
        if (this.leaderboard) {
            this.leaderboard.updateRanking(result);
        }

        if (result.leader) {
            const newLeaderId = result.leader.id;
            if (this.currentLeaderId !== newLeaderId) {
                this.currentLeaderId = newLeaderId;
                this.tweens.add({
                    targets: this.worldCrown,
                    scale: { from: 1.4, to: 1.0 },
                    duration: 250
                });
            }
            this.followLeaderHead();
            this.worldCrown.setVisible(true);
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
                this.worldCrown.setPosition(this.player.head.x, this.player.head.y - 38);
                this.worldCrown.setVisible(true);
            } else {
                this.worldCrown.setVisible(false);
            }
        } else if (leader.type === 'boss') {
            if (this.boss?.body?.active) {
                this.worldCrown.setPosition(this.boss.body.x, this.boss.body.y - 48);
                this.worldCrown.setVisible(true);
            } else {
                this.worldCrown.setVisible(false);
            }
        } else if (leader.type === 'enemy') {
            const e = this.enemies.find(en => en.arenaId === leader.id);
            if (e && e.body && e.body.active) {
                this.worldCrown.setPosition(e.body.x, e.body.y - 38);
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
        this.player.segments = 5;
        this.player.boostEnergy = 100;
        this.comboCount = 0;
        this.player.isInvulnerable = false;
        this.scoreSubmitted = false;
        this.isNewBest = false;
        for (const e of this.enemies) { e.destroy(); }
        this.enemies = [];
        this.clearOrbs();
        this.magnet.reset();
        if (this.boss) { this.boss.destroy(); this.boss = null; this.bossSpawned = false; }
        this.spawnTimer = 9999999;
        this.updateArenaRanking();
    }

    stopSpawning() {
        this.spawnTimer = 9999999;
        this.lastEdibleCheckTime = 999999999;
        this.lastRescueTime = 999999999;
        for (const e of this.enemies) { e.destroy(); }
        this.enemies = [];
    }

    spawnEnemy(isRescue = false) {
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

        const enemy = new NumberEnemy(this, sx, sy, val);
        this.enemies.push(enemy);
        return enemy;
    }

    spawnOrb(x: number, y: number): CollectibleOrb {
        if (this.orbs.length >= GameBalance.orb.maxActive) {
            const oldest = this.orbs.shift();
            oldest?.destroy();
        }
        const orb = new CollectibleOrb(this, x, y);
        this.orbs.push(orb);
        return orb;
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
        
        const alert = this.add.text(this.player.head.x, this.player.head.y - 100, `${this.levelDef.bossValue} APPEARED!`, {
            fontSize: '48px', fontStyle: 'bold', color: '#ff0000'
        }).setOrigin(0.5).setDepth(200);
        
        this.tweens.add({
            targets: alert, y: alert.y - 50, alpha: 0, duration: 2000,
            onComplete: () => alert.destroy()
        });
    }

    handleEnemyCollision(e: NumberEnemy, index: number, time: number) {
        if (isEdible(this.player.value, e.value)) {
            // EAT
            this.player.eat(e.value);
            this.comboCount++;
            this.lastEatTime = time;
            this.hud.addScore(e.value * this.comboCount);
            this.audio.playEatSFX(this.comboCount);

            this.createParticles(e.body.x, e.body.y, 0x00ff00);
            
            // Spawn body orbs from former body positions
            const dropPositions = e.getDropPositions();
            for (const pos of dropPositions) {
                this.spawnOrb(pos.x, pos.y);
            }

            const oldVal = this.player.value - e.value;
            if (this.boss && this.player.value > this.levelDef.bossValue && oldVal <= this.levelDef.bossValue) {
                this.showReversalText(`NOW HUNT ${this.levelDef.bossValue}!`);
                this.audio.playBossReversal();
            }

            e.destroy();
            this.enemies.splice(index, 1);
            this.cameras.main.shake(100, 0.002);
            
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
                this.cameras.main.shake(200, 0.01);
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
        if (this.player.value > this.boss!.value) {
            // Victory
            if (this.bossIndicator) this.bossIndicator.hide();
            this.boss!.destroy();
            this.boss = null;
            this.createParticles(this.player.head.x, this.player.head.y, 0xff0055, 50);
            this.audio.playEatSFX(10);
            this.hud.addScore(1000);
            this.levelClear();
        } else if (!this.player.isInvulnerable) {
            // DAMAGE
            const dmg = calculateDamage(this.player.value, this.boss!.value);
            if (dmg.instantKO) {
                this.gameState = 'GAME_OVER';
                this.audio.playGameOver();
                this.saveScore();
                this.showEndScreen('GAME OVER', '#ff0000');
            } else if (dmg.hpLoss > 0) {
                const newSeg = calculateNewBodySegments(this.player.segments, dmg.hpLoss);
                const angle = Math.atan2(this.player.head.y - this.boss!.body.y, this.player.head.x - this.boss!.body.x);
                this.player.takeDamage(dmg.hpLoss, newSeg, new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle)));
                this.cameras.main.shake(200, 0.01);
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
        for (let i = 0; i < count; i++) {
            const p = this.add.circle(x, y, 4, color).setDepth(150);
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 150;
            this.physics.add.existing(p);
            (p.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            
            this.tweens.add({
                targets: p, alpha: 0, scale: 0.1, duration: 600,
                onComplete: () => p.destroy()
            });
        }
    }

    levelClear() {
        this.gameState = 'LEVEL_CLEAR';
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
        if (this.worldCrown) this.worldCrown.setVisible(false);

        const cx = this.cameras.main.scrollX + this.scale.width / 2;
        const cy = this.cameras.main.scrollY + this.scale.height / 2;

        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.85);
        bg.fillRect(this.cameras.main.scrollX, this.cameras.main.scrollY, this.scale.width, this.scale.height);
        bg.setDepth(300);

        this.add.text(cx, cy - 140, `${this.levelDef.name} CLEAR!`, { fontSize: '56px', fontStyle: 'bold', color: '#00ff00' }).setOrigin(0.5).setDepth(301);
        
        let currentY = cy - 40;

        const scoreVal = this.hud.getScore();
        const bestVal = ProgressionManager.getBestScore(this.levelId);
        this.add.text(cx, currentY - 30, `SCORE: ${scoreVal}    BEST: ${bestVal}`, {
            fontSize: '22px', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5).setDepth(301);

        if (this.isNewBest) {
            this.add.text(cx, currentY - 5, 'NEW BEST!', {
                fontSize: '20px', fontStyle: 'bold', color: '#ffd700'
            }).setOrigin(0.5).setDepth(301);
        }
        
        if (!this.levelDef.nextLevelId) {
            this.add.text(cx, currentY + 25, 'ALL LEVELS CLEARED!', { fontSize: '36px', fontStyle: 'bold', color: '#ffff00' }).setOrigin(0.5).setDepth(301);
            this.add.text(cx, currentY + 75, 'YOU BECAME THE NUMBER MASTER!', { fontSize: '24px', fontStyle: 'bold', color: '#00ffff' }).setOrigin(0.5).setDepth(301);
            this.time.delayedCall(500, () => {
                this.createLevelClearButtons(cx, cy + 145);
            });
            return;
        }

        if (newlyClaimedReward) {
            this.add.text(cx, currentY + 20, '+1 HEART', { fontSize: '32px', fontStyle: 'bold', color: '#ff5555' }).setOrigin(0.5).setDepth(301);
            const oldMax = ProgressionManager.getMaxHP() - this.levelDef.reward!.value;
            const newMax = ProgressionManager.getMaxHP();
            const heartText = this.add.text(cx, currentY + 60, `${oldMax} HEARTS`, { fontSize: '32px' }).setOrigin(0.5).setDepth(301);
            
            this.time.delayedCall(800, () => {
                heartText.setText(`${oldMax} → ${newMax} HEARTS`);
                this.tweens.add({
                    targets: heartText,
                    scale: 1.5,
                    yoyo: true,
                    duration: 150,
                    onComplete: () => {
                        if (newlyUnlocked) {
                            this.time.delayedCall(400, () => {
                                this.add.text(cx, currentY + 110, `LEVEL ${this.levelDef.nextLevelId} UNLOCKED!`, { fontSize: '36px', fontStyle: 'bold', color: '#00ffff' }).setOrigin(0.5).setDepth(301);
                                this.createLevelClearButtons(cx, cy + 185);
                            });
                        } else {
                            this.createLevelClearButtons(cx, cy + 185);
                        }
                    }
                });
            });
        } else {
            if (newlyUnlocked) {
                this.add.text(cx, currentY + 30, `LEVEL ${this.levelDef.nextLevelId} UNLOCKED!`, { fontSize: '36px', fontStyle: 'bold', color: '#00ffff' }).setOrigin(0.5).setDepth(301);
            }
            this.time.delayedCall(500, () => {
                this.createLevelClearButtons(cx, cy + 140);
            });
        }
    }

    createLevelClearButtons(cx: number, cy: number) {
        if (!this.levelDef.nextLevelId) {
            const playAgainBtn = this.add.text(cx, cy - 30, 'PLAY AGAIN', {
                fontSize: '32px', backgroundColor: '#555555', padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });
            playAgainBtn.setName('playAgainBtn');
            
            playAgainBtn.on('pointerdown', () => {
                this.scene.start('PrepScene', { levelId: 4 });
            });

            const levelSelectBtn = this.add.text(cx, cy + 50, 'LEVEL SELECT', {
                fontSize: '32px', backgroundColor: '#0055aa', padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });
            levelSelectBtn.setName('levelSelectBtn');
            
            levelSelectBtn.on('pointerdown', () => {
                this.scene.start('MenuScene');
            });
            return;
        }

        if (this.levelDef.nextLevelId && ProgressionManager.getHighestUnlockedLevel() >= this.levelDef.nextLevelId) {
            const nextBtn = this.add.text(cx, cy - 60, 'NEXT LEVEL', {
                fontSize: '32px', backgroundColor: '#00aa00', padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });
            nextBtn.setName('nextBtn');
            
            nextBtn.on('pointerdown', () => {
                this.scene.start('PrepScene', { levelId: this.levelDef.nextLevelId });
            });
        }

        const replayBtn = this.add.text(cx, cy, 'REPLAY LEVEL', {
            fontSize: '24px', backgroundColor: '#555555', padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });
        replayBtn.setName('replayBtn');
        
        replayBtn.on('pointerdown', () => {
            this.scene.start('PrepScene', { levelId: this.levelId });
        });

        const menuBtn = this.add.text(cx, cy + 60, 'MENU', {
            fontSize: '24px', backgroundColor: '#0055aa', padding: { x: 15, y: 8 }
        }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });
        menuBtn.setName('menuBtn');
        
        menuBtn.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });
    }

    gameOver() {
        this.gameState = 'GAME_OVER';
        if (this.bossIndicator) this.bossIndicator.hide();
        if (this.worldCrown) this.worldCrown.setVisible(false);
        this.clearOrbs();
        this.audio.playGameOver();
        this.saveScore();
        this.showEndScreen('GAME OVER', '#ff0000');
    }

    victory() {
        this.gameState = 'VICTORY';
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
        const b = parseInt(localStorage.getItem('bestScore') || '0', 10);
        if (s > b) localStorage.setItem('bestScore', s.toString());
        this.isNewBest = ProgressionManager.submitScore(this.levelId, s);
        this.hud.setBestScore(ProgressionManager.getBestScore(this.levelId));
        return this.isNewBest;
    }

    showEndScreen(title: string, color: string) {
        if (this.worldCrown) this.worldCrown.setVisible(false);

        const cx = this.cameras.main.scrollX + this.scale.width / 2;
        const cy = this.cameras.main.scrollY + this.scale.height / 2;

        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRect(this.cameras.main.scrollX, this.cameras.main.scrollY, this.scale.width, this.scale.height);
        bg.setDepth(300);

        this.add.text(cx, cy - 110, title, { fontSize: '64px', fontStyle: 'bold', color }).setOrigin(0.5).setDepth(301);
        this.add.text(cx, cy - 35, `FINAL VALUE: ${this.player.value}`, { fontSize: '24px', color: '#fff' }).setOrigin(0.5).setDepth(301);
        this.add.text(cx, cy + 5, `SCORE: ${this.hud.getScore()}`, { fontSize: '24px', color: '#fff' }).setOrigin(0.5).setDepth(301);
        this.add.text(cx, cy + 38, `BEST: ${ProgressionManager.getBestScore(this.levelId)}`, { fontSize: '20px', color: '#aaaaaa' }).setOrigin(0.5).setDepth(301);

        if (this.isNewBest) {
            this.add.text(cx, cy + 68, 'NEW BEST!', { fontSize: '22px', fontStyle: 'bold', color: '#ffd700' }).setOrigin(0.5).setDepth(301);
        }

        const btn = this.add.text(cx, cy + (this.isNewBest ? 116 : 100), 'PLAY AGAIN', {
            fontSize: '32px', backgroundColor: '#0055aa', padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });
        btn.setName('playAgainBtn');

        btn.on('pointerdown', () => {
            this.scene.start('PrepScene', { levelId: this.levelId });
        });
    }

    teardown() {
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        this.scale.off('resize', this.resize, this);
        this.leaderboardTimer?.remove();
        this.worldCrown?.destroy();
        this.leaderboard?.destroy();
        this.bossIndicator?.destroy();
        this.enemies.forEach(e => e.destroy());
        this.clearOrbs();
        this.player.destroy();
        this.boss?.destroy();
        this.magnet?.destroy();
        if (this.debugUI) this.debugUI.text.destroy();
    }

    resize(gameSize: Phaser.Structs.Size) {
        this.joystick.resize(gameSize);
        this.hud.resize(gameSize);
        this.leaderboard?.resize(gameSize);
        this.bossIndicator?.resize(gameSize);
    }

    getObstacleBounds(): RectBounds[] {
        const list: RectBounds[] = [];
        if (this.hud) {
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
