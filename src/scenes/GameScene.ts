import Phaser from 'phaser';
import { PlayerSnake } from '../entities/PlayerSnake';
import { NumberEnemy } from '../entities/NumberEnemy';
import { Boss100 } from '../entities/Boss100';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { HUD } from '../ui/HUD';
import { AudioSystem } from '../systems/AudioSystem';
import { GameBalance } from '../config/gameBalance';
import { isEdible, calculateDamage, calculateNewBodySegments } from '../utils/gameRules';

export class GameScene extends Phaser.Scene {
    player!: PlayerSnake;
    enemies: NumberEnemy[] = [];
    boss: Boss100 | null = null;
    
    joystick!: VirtualJoystick;
    hud!: HUD;
    audio!: AudioSystem;

    keys!: {
        w: Phaser.Input.Keyboard.Key,
        a: Phaser.Input.Keyboard.Key,
        s: Phaser.Input.Keyboard.Key,
        d: Phaser.Input.Keyboard.Key,
        up: Phaser.Input.Keyboard.Key,
        down: Phaser.Input.Keyboard.Key,
        left: Phaser.Input.Keyboard.Key,
        right: Phaser.Input.Keyboard.Key,
        space: Phaser.Input.Keyboard.Key
    };

    comboCount: number = 0;
    lastEatTime: number = 0;
    bossSpawned: boolean = false;
    isGameOver: boolean = false;

    // Background grid
    grid!: Phaser.GameObjects.Grid;
    
    // Spawn timer
    spawnTimer: number = 0;

    constructor() {
        super('GameScene');
    }

    create() {
        this.isGameOver = false;
        this.enemies = [];
        this.boss = null;
        this.bossSpawned = false;
        this.comboCount = 0;
        this.lastEatTime = 0;

        // World setup
        const ww = GameBalance.world.width;
        const wh = GameBalance.world.height;
        this.physics.world.setBounds(-ww/2, -wh/2, ww, wh);
        this.cameras.main.setBounds(-ww/2, -wh/2, ww, wh);

        // Visual Boundary
        const boundary = this.add.graphics();
        boundary.lineStyle(10, 0x00ffff, 0.3);
        boundary.strokeRect(-ww/2, -wh/2, ww, wh);
        boundary.setDepth(-10);

        this.grid = this.add.grid(0, 0, ww, wh, 100, 100, 0x000000, 0, 0x333333, 0.2);
        this.grid.setDepth(-11);

        this.player = new PlayerSnake(this, 0, 0);
        this.cameras.main.startFollow(this.player.head, true, 0.1, 0.1);
        this.cameras.main.setZoom(1);

        this.joystick = new VirtualJoystick(this);
        this.hud = new HUD(this);
        this.audio = new AudioSystem(this);

        this.keys = this.input.keyboard!.addKeys('w,a,s,d,up,down,left,right,space') as any;

        this.scale.on('resize', this.resize, this);

        // Visibility API pause
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Initial spawn
        for (let i=0; i<20; i++) this.spawnEnemy();
    }

    handleVisibilityChange = () => {
        if (document.hidden) {
            this.scene.pause();
        }
    }

    update(time: number, dt: number) {
        if (this.isGameOver) return;

        // Input
        let dx = 0;
        let dy = 0;
        if (this.keys.a.isDown || this.keys.left.isDown) dx -= 1;
        if (this.keys.d.isDown || this.keys.right.isDown) dx += 1;
        if (this.keys.w.isDown || this.keys.up.isDown) dy -= 1;
        if (this.keys.s.isDown || this.keys.down.isDown) dy += 1;

        if (this.joystick.active) {
            dx = this.joystick.deltaX;
            dy = this.joystick.deltaY;
        }

        this.player.setDesiredDirection(dx, dy);
        
        const isBoosting = this.keys.space.isDown || this.hud.isBoostPressed;
        this.player.update(dt, isBoosting);

        // Dynamic Camera Zoom
        const targetZoom = 1 - (this.player.segments * 0.002);
        const clampedZoom = Phaser.Math.Clamp(targetZoom, 0.7, 1);
        this.cameras.main.setZoom(Phaser.Math.Linear(this.cameras.main.zoom, clampedZoom, 0.05));

        // Combo check
        if (time - this.lastEatTime > GameBalance.combo.window) {
            this.comboCount = 0;
        }

        // Enemies update & collision
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt, this.player.head.x, this.player.head.y, this.player.value);
            
            // Collision check
            if (this.physics.overlap(this.player.head, e.body)) {
                this.handleEnemyCollision(e, i, time);
            }
        }

        // Boss Logic
        if (this.player.value >= GameBalance.boss.triggerValue && !this.bossSpawned) {
            this.spawnBoss();
        }

        if (this.boss) {
            this.boss.update(this.player.head.x, this.player.head.y, this.player.value);
            if (this.physics.overlap(this.player.head, this.boss.body)) {
                this.handleBossCollision();
            }
        }

        // Spawning
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.enemies.length < GameBalance.enemy.normalMaxLimit) {
            this.spawnEnemy();
            this.spawnTimer = 500;
        }

        this.hud.update(this.player.hp, this.player.boostEnergy, GameBalance.player.maxBoostEnergy);
    }

    spawnEnemy() {
        // Find safe spawn pos
        let angle = Math.random() * Math.PI * 2;
        let dist = GameBalance.enemy.spawnDistanceMin + Math.random() * (GameBalance.enemy.spawnDistanceMax - GameBalance.enemy.spawnDistanceMin);
        let sx = this.player.head.x + Math.cos(angle) * dist;
        let sy = this.player.head.y + Math.sin(angle) * dist;
        
        // Clamp to world
        const hw = GameBalance.world.width / 2 - 50;
        const hh = GameBalance.world.height / 2 - 50;
        sx = Phaser.Math.Clamp(sx, -hw, hw);
        sy = Phaser.Math.Clamp(sy, -hh, hh);

        // Determine value
        const rand = Math.random();
        let val = 1;
        const pVal = this.player.value;

        if (rand < GameBalance.enemy.safeRatio) {
            // 1 to ~45% pVal
            val = Math.max(1, Math.floor(Math.random() * (pVal * 0.45)));
        } else if (rand < GameBalance.enemy.safeRatio + GameBalance.enemy.highValueRatio) {
            // ~45% to pVal - 1
            val = Math.max(1, Math.floor(pVal * 0.45 + Math.random() * (pVal * 0.55)));
            if (val >= pVal) val = Math.max(1, pVal - 1);
        } else if (rand < GameBalance.enemy.safeRatio + GameBalance.enemy.highValueRatio + GameBalance.enemy.hunterRatio) {
            // pVal to 1.6 pVal
            val = Math.floor(pVal + Math.random() * (pVal * 0.6));
        } else {
            // Giant Threat
            val = Math.floor(pVal * 2.5 + Math.random() * (pVal * 0.5));
        }

        if (val > 99) val = 99; // Cap normal enemies

        const enemy = new NumberEnemy(this, sx, sy, val);
        this.enemies.push(enemy);
    }

    spawnBoss() {
        this.bossSpawned = true;
        
        let angle = Math.random() * Math.PI * 2;
        let dist = 1000;
        let sx = this.player.head.x + Math.cos(angle) * dist;
        let sy = this.player.head.y + Math.sin(angle) * dist;
        const hw = GameBalance.world.width / 2 - 100;
        const hh = GameBalance.world.height / 2 - 100;
        sx = Phaser.Math.Clamp(sx, -hw, hw);
        sy = Phaser.Math.Clamp(sy, -hh, hh);

        this.boss = new Boss100(this, sx, sy);
        this.audio.playBossAlert();
        
        const alert = this.add.text(this.player.head.x, this.player.head.y - 100, '100 APPEARED!', {
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
            
            // Reversal cue check inside update is enough, but maybe text cue?
            const oldVal = this.player.value - e.value;
            // Check if this eat makes any current hunter flee
            if (this.boss && this.player.value > 100 && oldVal <= 100) {
                this.showReversalText('NOW HUNT 100!');
                this.audio.playBossReversal();
            }

            e.destroy();
            this.enemies.splice(index, 1);
            this.cameras.main.shake(100, 0.002);
            
        } else if (!this.player.isInvulnerable) {
            // DAMAGE
            const dmg = calculateDamage(this.player.value, e.value);
            if (dmg.instantKO) {
                this.gameOver();
            } else if (dmg.hpLoss > 0) {
                const newSeg = calculateNewBodySegments(this.player.segments, dmg.hpLoss);
                const angle = Math.atan2(this.player.head.y - e.body.y, this.player.head.x - e.body.x);
                this.player.takeDamage(dmg.hpLoss, newSeg, new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle)));
                this.cameras.main.shake(200, 0.01);
                this.audio.playHitSFX();
                if (this.player.hp <= 0) {
                    this.gameOver();
                }
            }
        }
    }

    handleBossCollision() {
        if (this.player.value > this.boss!.value) {
            // Victory
            this.boss!.destroy();
            this.boss = null;
            this.createParticles(this.player.head.x, this.player.head.y, 0xff0055, 50);
            this.audio.playEatSFX(10);
            this.hud.addScore(1000);
            this.victory();
        } else if (!this.player.isInvulnerable) {
            // Boss instant kills if not > 100
            this.gameOver();
        }
    }

    showReversalText(text: string) {
        const t = this.add.text(this.player.head.x, this.player.head.y - 80, text, {
            fontSize: '32px', fontStyle: 'bold', color: '#00ffff'
        }).setOrigin(0.5).setDepth(200);
        
        this.tweens.add({
            targets: t, y: t.y - 50, alpha: 0, duration: 1500,
            onComplete: () => t.destroy()
        });
    }

    createParticles(x: number, y: number, color: number, count: number = 10) {
        const emitter = this.add.particles(x, y, 'particle', {
            speed: { min: 50, max: 200 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            lifespan: 500,
            tint: color,
            quantity: count,
            emitting: false
        });
        emitter.setDepth(150);
        emitter.explode(count);
        setTimeout(() => emitter.destroy(), 600);
    }

    gameOver() {
        this.isGameOver = true;
        this.audio.playGameOver();
        this.saveScore();
        this.showEndScreen('GAME OVER', '#ff0000');
    }

    victory() {
        this.isGameOver = true;
        this.audio.playVictory();
        this.saveScore();
        this.showEndScreen('VICTORY', '#00ff00');
    }

    saveScore() {
        const s = this.hud.getScore();
        const b = parseInt(localStorage.getItem('bestScore') || '0', 10);
        if (s > b) localStorage.setItem('bestScore', s.toString());
    }

    showEndScreen(title: string, color: string) {
        const cx = this.cameras.main.scrollX + this.scale.width / 2;
        const cy = this.cameras.main.scrollY + this.scale.height / 2;

        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRect(this.cameras.main.scrollX, this.cameras.main.scrollY, this.scale.width, this.scale.height);
        bg.setDepth(300);

        this.add.text(cx, cy - 100, title, { fontSize: '64px', fontStyle: 'bold', color }).setOrigin(0.5).setDepth(301);
        this.add.text(cx, cy - 20, `FINAL VALUE: ${this.player.value}`, { fontSize: '24px', color: '#fff' }).setOrigin(0.5).setDepth(301);
        this.add.text(cx, cy + 20, `SCORE: ${this.hud.getScore()}`, { fontSize: '24px', color: '#fff' }).setOrigin(0.5).setDepth(301);

        const btn = this.add.text(cx, cy + 100, 'PLAY AGAIN', {
            fontSize: '32px', backgroundColor: '#0055aa', padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });

        btn.on('pointerdown', () => {
            this.teardown();
            this.scene.start('GameScene');
        });
    }

    teardown() {
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        this.enemies.forEach(e => e.destroy());
        this.player.destroy();
        this.boss?.destroy();
    }

    resize(gameSize: Phaser.Structs.Size) {
        this.joystick.resize(gameSize);
        this.hud.resize(gameSize);
    }
}
