import Phaser from 'phaser';

export class AudioSystem {
    scene: Phaser.Scene;
    audioCtx!: AudioContext;
    enabled: boolean = true;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        // Phaser owns one context and its existing user-gesture unlock flow.
        this.audioCtx = (scene.sound as Phaser.Sound.WebAudioSoundManager).context;
        try { this.enabled = localStorage.getItem('audioEnabled') !== 'false'; }
        catch { this.enabled = true; }
    }

    private playTone(freq: number, type: OscillatorType, duration: number, vol: number) {
        if (!this.enabled || !this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') return;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        
        gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };

        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    }

    private later(delay: number, callback: () => void) {
        this.scene.time.delayedCall(delay, callback);
    }

    playBounceSFX() {
        this.playTone(260, 'sine', 0.11, 0.18);
        this.later(35, () => this.playTone(390, 'sine', 0.08, 0.12));
    }

    playEatSFX(combo: number) {
        const baseFreq = 400 + (combo * 50);
        this.playTone(baseFreq, 'sine', 0.1, 0.5);
        this.later(50, () => this.playTone(baseFreq * 1.5, 'sine', 0.15, 0.5));
    }

    playHitSFX() {
        this.playTone(150, 'sawtooth', 0.3, 0.8);
        this.later(50, () => this.playTone(100, 'square', 0.3, 0.8));
    }

    playBossAlert() {
        this.playTone(300, 'square', 0.5, 0.5);
        this.later(250, () => this.playTone(250, 'square', 0.5, 0.5));
        this.later(500, () => this.playTone(200, 'square', 0.5, 0.5));
    }

    playBossReversal() {
        this.playTone(800, 'sine', 0.2, 0.6);
        this.later(100, () => this.playTone(1200, 'sine', 0.4, 0.6));
    }

    playVictory() {
        [400, 500, 600, 800].forEach((f, i) => {
            this.later(i * 150, () => this.playTone(f, 'square', 0.3, 0.5));
        });
    }

    playGameOver() {
        [300, 250, 200, 150].forEach((f, i) => {
            this.later(i * 200, () => this.playTone(f, 'sawtooth', 0.4, 0.5));
        });
    }
}
