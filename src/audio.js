// Audio System - Web Audio API layered sound system
import { CONFIG } from './config.js';
import { lerp, clamp } from './utils.js';

// Generate a simple tone
function createToneBuffer(audioContext, frequency, duration, type = 'sine') {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        let sample = 0;
        
        switch (type) {
            case 'sine':
                sample = Math.sin(2 * Math.PI * frequency * t);
                break;
            case 'square':
                sample = Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1;
                break;
            case 'sawtooth':
                sample = 2 * (t * frequency % 1) - 1;
                break;
            case 'triangle':
                sample = 2 * Math.abs(2 * (t * frequency % 1) - 1) - 1;
                break;
            case 'noise':
                sample = Math.random() * 2 - 1;
                break;
        }
        
        // Envelope
        const attackTime = 0.01;
        const releaseTime = 0.1;
        let envelope = 1;
        
        if (t < attackTime) {
            envelope = t / attackTime;
        } else if (t > duration - releaseTime) {
            envelope = (duration - t) / releaseTime;
        }
        
        data[i] = sample * envelope;
    }
    
    return buffer;
}

// Noise buffer for percussion
function createNoiseBuffer(audioContext, duration) {
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 10); // Quick decay
        data[i] = (Math.random() * 2 - 1) * envelope;
    }
    
    return buffer;
}

export class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.initialized = false;
        
        // Layer gains
        this.ambientGain = null;
        this.rhythmGain = null;
        this.percussionGain = null;
        this.bassGain = null;
        
        // Layer sources
        this.ambientOscillators = [];
        this.rhythmInterval = null;
        this.bassOscillator = null;
        
        // State
        this.overdrive = 0;
        this.nearMissIntensity = 0;
        this.muted = false;
        
        // Pre-generated buffers
        this.buffers = {};
    }
    
    async init() {
        if (this.initialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Master gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = CONFIG.AUDIO.MASTER_VOLUME;
            this.masterGain.connect(this.audioContext.destination);
            
            // Create layer gains
            this.ambientGain = this.audioContext.createGain();
            this.ambientGain.gain.value = CONFIG.AUDIO.AMBIENT_VOLUME;
            this.ambientGain.connect(this.masterGain);
            
            this.rhythmGain = this.audioContext.createGain();
            this.rhythmGain.gain.value = CONFIG.AUDIO.RHYTHM_VOLUME;
            this.rhythmGain.connect(this.masterGain);
            
            this.percussionGain = this.audioContext.createGain();
            this.percussionGain.gain.value = CONFIG.AUDIO.PERCUSSION_VOLUME;
            this.percussionGain.connect(this.masterGain);
            
            this.bassGain = this.audioContext.createGain();
            this.bassGain.gain.value = CONFIG.AUDIO.BASS_VOLUME;
            this.bassGain.connect(this.masterGain);
            
            // Create distortion for overdrive
            this.distortion = this.audioContext.createWaveShaper();
            this.distortion.curve = this.makeDistortionCurve(0);
            this.distortion.connect(this.masterGain);
            
            // Generate sound buffers
            this.buffers.shoot = createToneBuffer(this.audioContext, 880, 0.05, 'square');
            this.buffers.hit = createNoiseBuffer(this.audioContext, 0.1);
            this.buffers.graze = createToneBuffer(this.audioContext, 1200, 0.08, 'sine');
            this.buffers.explosion = createNoiseBuffer(this.audioContext, 0.3);
            this.buffers.death = createNoiseBuffer(this.audioContext, 0.5);
            
            this.initialized = true;
            
            // Start ambient layer
            this.startAmbient();
            
        } catch (e) {
            console.warn('Audio system could not initialize:', e);
        }
    }
    
    makeDistortionCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }
        
        return curve;
    }
    
    startAmbient() {
        if (!this.initialized || this.ambientOscillators.length > 0) return;
        
        // Create ambient pad with multiple oscillators
        const frequencies = [55, 82.5, 110, 165]; // Low drone
        
        frequencies.forEach((freq, i) => {
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const oscGain = this.audioContext.createGain();
            oscGain.gain.value = 0.1 / (i + 1);
            
            osc.connect(oscGain);
            oscGain.connect(this.ambientGain);
            
            osc.start();
            this.ambientOscillators.push({ osc, gain: oscGain });
        });
        
        // Start bass pulse
        this.startBassPulse();
    }
    
    startBassPulse() {
        if (!this.initialized) return;
        
        const pulseFrequency = 0.5; // Hz
        const now = this.audioContext.currentTime;
        
        this.bassOscillator = this.audioContext.createOscillator();
        this.bassOscillator.type = 'sine';
        this.bassOscillator.frequency.value = 40;
        
        // LFO for pulsing
        const lfo = this.audioContext.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = pulseFrequency;
        
        const lfoGain = this.audioContext.createGain();
        lfoGain.gain.value = 0.3;
        
        lfo.connect(lfoGain);
        lfoGain.connect(this.bassGain.gain);
        
        this.bassOscillator.connect(this.bassGain);
        
        lfo.start(now);
        this.bassOscillator.start(now);
    }
    
    stopAmbient() {
        this.ambientOscillators.forEach(({ osc }) => {
            try {
                osc.stop();
            } catch (e) {
                // Oscillator may have already stopped
            }
        });
        this.ambientOscillators = [];
        
        if (this.bassOscillator) {
            try {
                this.bassOscillator.stop();
            } catch (e) {
                // Oscillator may have already stopped
            }
            this.bassOscillator = null;
        }
    }
    
    playBuffer(bufferName, volume = 1, playbackRate = 1, destination = null) {
        if (!this.initialized || this.muted) return;
        
        const buffer = this.buffers[bufferName];
        if (!buffer) return;
        
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = playbackRate;
        
        const gain = this.audioContext.createGain();
        gain.gain.value = volume;
        
        source.connect(gain);
        gain.connect(destination || this.masterGain);
        
        source.start();
    }
    
    playShoot() {
        // Slight variation in pitch based on overdrive
        const pitchMultiplier = 1 + this.overdrive / 200;
        this.playBuffer('shoot', 0.2, pitchMultiplier);
    }
    
    playHit() {
        this.playBuffer('hit', 0.3);
        
        // Trigger percussion hit
        this.triggerPercussion();
    }
    
    playGraze() {
        const pitchMultiplier = 1 + Math.random() * 0.2;
        this.playBuffer('graze', 0.3, pitchMultiplier);
        
        this.nearMissIntensity = Math.min(1, this.nearMissIntensity + 0.2);
    }
    
    playExplosion() {
        this.playBuffer('explosion', 0.5, 0.8 + Math.random() * 0.4);
    }
    
    playDeath() {
        // Hard cut - stop all audio briefly
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(0, this.audioContext.currentTime);
            this.masterGain.gain.linearRampToValueAtTime(
                CONFIG.AUDIO.MASTER_VOLUME,
                this.audioContext.currentTime + 0.5
            );
        }
        
        this.playBuffer('death', 0.6, 0.5);
    }
    
    triggerPercussion() {
        if (!this.initialized || this.muted) return;
        
        // Quick hi-hat like sound
        const osc = this.audioContext.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 800 + Math.random() * 400;
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.15 * (1 + this.nearMissIntensity), this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);
        
        osc.connect(gain);
        gain.connect(this.percussionGain);
        
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.05);
    }
    
    update(overdrive, deltaTime) {
        if (!this.initialized) return;
        
        this.overdrive = overdrive;
        
        // Update distortion based on overdrive
        const distortionAmount = overdrive / 100 * 50;
        this.distortion.curve = this.makeDistortionCurve(distortionAmount);
        
        // Decay near miss intensity
        this.nearMissIntensity = Math.max(0, this.nearMissIntensity - deltaTime * 0.02);
        
        // Update percussion volume based on near misses
        if (this.percussionGain) {
            const targetVolume = CONFIG.AUDIO.PERCUSSION_VOLUME * (1 + this.nearMissIntensity);
            this.percussionGain.gain.linearRampToValueAtTime(
                targetVolume,
                this.audioContext.currentTime + 0.1
            );
        }
        
        // Update ambient based on overdrive
        this.ambientOscillators.forEach(({ osc }, i) => {
            // Slight pitch shift with overdrive
            const baseFreq = [55, 82.5, 110, 165][i];
            osc.frequency.linearRampToValueAtTime(
                baseFreq * (1 + overdrive / 500),
                this.audioContext.currentTime + 0.1
            );
        });
    }
    
    reset() {
        this.overdrive = 0;
        this.nearMissIntensity = 0;
        
        // Reset gains
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(CONFIG.AUDIO.MASTER_VOLUME, this.audioContext.currentTime);
        }
    }
    
    mute() {
        this.muted = true;
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(0, this.audioContext.currentTime);
        }
    }
    
    unmute() {
        this.muted = false;
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(CONFIG.AUDIO.MASTER_VOLUME, this.audioContext.currentTime);
        }
    }
    
    toggleMute() {
        if (this.muted) {
            this.unmute();
        } else {
            this.mute();
        }
        return this.muted;
    }
    
    // Resume audio context (required after user interaction)
    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
}
