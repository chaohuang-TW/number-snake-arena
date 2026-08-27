import Phaser from 'phaser';

export class AudioSystem {
    scene: Phaser.Scene;
    audioCtx!: AudioContext;
    enabled: boolean = true;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        const ContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        if (ContextClass) {
            this.audioCtx = new ContextClass();
        }
        this.enabled = localStorage.getItem('audioEnabled') !== 'false';
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

        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    }

    playEatSFX(combo: number) {
        const baseFreq = 400 + (combo * 50);
        this.playTone(baseFreq, 'sine', 0.1, 0.5);
        setTimeout(() => this.playTone(baseFreq * 1.5, 'sine', 0.15, 0.5), 50);
    }

    playHitSFX() {
        this.playTone(150, 'sawtooth', 0.3, 0.8);
        setTimeout(() => this.playTone(100, 'square', 0.3, 0.8), 50);
    }

    playBossAlert() {
        this.playTone(300, 'square', 0.5, 0.5);
        setTimeout(() => this.playTone(250, 'square', 0.5, 0.5), 250);
        setTimeout(() => this.playTone(200, 'square', 0.5, 0.5), 500);
    }

    playBossReversal() {
        this.playTone(800, 'sine', 0.2, 0.6);
        setTimeout(() => this.playTone(1200, 'sine', 0.4, 0.6), 100);
    }

    playVictory() {
        [400, 500, 600, 800].forEach((f, i) => {
            setTimeout(() => this.playTone(f, 'square', 0.3, 0.5), i * 150);
        });
    }

    playGameOver() {
        [300, 250, 200, 150].forEach((f, i) => {
            setTimeout(() => this.playTone(f, 'sawtooth', 0.4, 0.5), i * 200);
        });
    }
}
