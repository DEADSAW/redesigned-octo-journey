// Effects System - Visual feedback, screen shake, death effects, particles
import { CONFIG } from './config.js';
import { randomRange, lerp, clamp, ObjectPool } from './utils.js';

// Particle class for explosions and effects
class Particle {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.size = 4;
        this.alpha = 1;
        this.color = '#ffffff';
        this.active = false;
        this.lifetime = 0;
        this.maxLifetime = 1000;
        this.decay = 0.98;
    }
    
    init(x, y, vx, vy, color, size, lifetime) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.maxLifetime = lifetime;
        this.lifetime = 0;
        this.alpha = 1;
        this.active = true;
    }
    
    update(deltaTime) {
        if (!this.active) return;
        
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        this.vx *= Math.pow(this.decay, deltaTime);
        this.vy *= Math.pow(this.decay, deltaTime);
        
        this.lifetime += deltaTime * (1000 / CONFIG.FPS_TARGET);
        this.alpha = 1 - (this.lifetime / this.maxLifetime);
        
        if (this.lifetime >= this.maxLifetime) {
            this.active = false;
        }
    }
    
    render(ctx) {
        if (!this.active || this.alpha <= 0) return;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * this.alpha, 0, Math.PI * 2);
        ctx.fillStyle = this.color.replace(')', `, ${this.alpha})`).replace('rgb', 'rgba');
        ctx.fill();
    }
}

// Screen crack for stress indication
class ScreenCrack {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.points = [];
        this.alpha = 0;
        this.active = false;
    }
    
    init(startX, startY, length) {
        this.points = [{ x: startX, y: startY }];
        this.active = true;
        this.alpha = 0.8;
        
        // Generate crack path
        let x = startX;
        let y = startY;
        const segments = Math.floor(length / 20);
        
        for (let i = 0; i < segments; i++) {
            const angle = randomRange(-Math.PI / 3, Math.PI / 3) + (Math.random() < 0.5 ? 0 : Math.PI);
            const segLength = randomRange(15, 30);
            
            x += Math.cos(angle) * segLength;
            y += Math.sin(angle) * segLength;
            
            this.points.push({ x, y });
            
            // Occasional branch
            if (Math.random() < 0.3) {
                const branchAngle = angle + randomRange(-Math.PI / 2, Math.PI / 2);
                const branchLength = randomRange(10, 20);
                this.points.push({
                    x: x + Math.cos(branchAngle) * branchLength,
                    y: y + Math.sin(branchAngle) * branchLength,
                    branch: true
                });
                this.points.push({ x, y, rejoin: true });
            }
        }
    }
    
    update(deltaTime) {
        if (!this.active) return;
        
        this.alpha -= deltaTime * 0.01;
        if (this.alpha <= 0) {
            this.active = false;
        }
    }
    
    render(ctx) {
        if (!this.active || this.alpha <= 0) return;
        
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        
        for (let i = 1; i < this.points.length; i++) {
            const p = this.points[i];
            if (p.rejoin) {
                ctx.moveTo(p.x, p.y);
            } else {
                ctx.lineTo(p.x, p.y);
            }
        }
        
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Glow effect
        ctx.strokeStyle = `rgba(255, 200, 200, ${this.alpha * 0.5})`;
        ctx.lineWidth = 4;
        ctx.stroke();
    }
}

// Main Effects System
export class EffectsSystem {
    constructor(canvas) {
        this.canvas = canvas;
        
        // Particle pool
        this.particlePool = new ObjectPool(
            () => new Particle(),
            (p) => p.reset(),
            200
        );
        
        // Screen cracks
        this.cracks = [];
        for (let i = 0; i < 5; i++) {
            this.cracks.push(new ScreenCrack());
        }
        
        // Screen shake
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        
        // Vignette
        this.vignetteIntensity = CONFIG.EFFECTS.VIGNETTE.BASE_INTENSITY;
        this.targetVignetteIntensity = CONFIG.EFFECTS.VIGNETTE.BASE_INTENSITY;
        
        // Death state
        this.deathState = {
            active: false,
            phase: 0, // 0: freeze, 1: slowmo, 2: wipe
            progress: 0,
            startTime: 0,
            replayFrames: [],
            wipeAngle: 0
        };
        
        // Color desaturation
        this.desaturation = 0;
        this.targetDesaturation = 0;
        
        // Near miss flash
        this.flashIntensity = 0;
    }
    
    reset() {
        this.particlePool.releaseAll();
        this.cracks.forEach(c => c.reset());
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        this.vignetteIntensity = CONFIG.EFFECTS.VIGNETTE.BASE_INTENSITY;
        this.targetVignetteIntensity = CONFIG.EFFECTS.VIGNETTE.BASE_INTENSITY;
        this.deathState.active = false;
        this.desaturation = 0;
        this.targetDesaturation = 0;
        this.flashIntensity = 0;
    }
    
    // Add screen shake
    addShake(intensity) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }
    
    // Add crack effect (near hit)
    addCrack(x, y) {
        const inactiveCrack = this.cracks.find(c => !c.active);
        if (inactiveCrack) {
            inactiveCrack.init(x, y, randomRange(50, 100));
        }
        
        // Also add screen stress
        this.targetVignetteIntensity = Math.min(
            CONFIG.EFFECTS.VIGNETTE.MAX_INTENSITY,
            this.targetVignetteIntensity + 0.05
        );
        this.targetDesaturation = Math.min(0.5, this.targetDesaturation + 0.1);
    }
    
    // Near miss flash
    addGrazeFlash(x, y) {
        this.flashIntensity = 0.3;
        
        // Spawn graze particles
        const count = 10;
        for (let i = 0; i < count; i++) {
            const particle = this.particlePool.get();
            const angle = (Math.PI * 2 / count) * i + randomRange(-0.2, 0.2);
            const speed = randomRange(3, 6);
            
            particle.init(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                CONFIG.COLORS.GRAZE,
                randomRange(2, 4),
                500
            );
        }
    }
    
    // Explosion effect
    spawnExplosion(x, y, color, count = 20, speed = 8) {
        for (let i = 0; i < count; i++) {
            const particle = this.particlePool.get();
            const angle = randomRange(0, Math.PI * 2);
            const vel = randomRange(speed * 0.5, speed);
            
            particle.init(
                x, y,
                Math.cos(angle) * vel,
                Math.sin(angle) * vel,
                color,
                randomRange(2, 6),
                randomRange(500, 1000)
            );
        }
        
        this.addShake(CONFIG.EFFECTS.SCREEN_SHAKE.INTENSITY_MEDIUM);
    }
    
    // Martyr explosion (bigger)
    spawnMartyrExplosion(x, y) {
        this.spawnExplosion(x, y, '#ffaa00', 40, 12);
        this.addShake(CONFIG.EFFECTS.SCREEN_SHAKE.INTENSITY_HEAVY);
    }
    
    // Start death sequence
    startDeathSequence(playerX, playerY) {
        this.deathState = {
            active: true,
            phase: 0,
            progress: 0,
            startTime: performance.now(),
            playerX,
            playerY,
            wipeAngle: randomRange(0, Math.PI * 2)
        };
        
        // Massive screen crack
        for (let i = 0; i < 5; i++) {
            const crack = this.cracks[i];
            crack.init(
                playerX + randomRange(-50, 50),
                playerY + randomRange(-50, 50),
                randomRange(100, 200)
            );
        }
        
        this.addShake(CONFIG.EFFECTS.SCREEN_SHAKE.INTENSITY_HEAVY * 2);
    }
    
    // Check if death sequence is complete
    isDeathComplete() {
        if (!this.deathState.active) return false;
        
        const elapsed = performance.now() - this.deathState.startTime;
        const cfg = CONFIG.EFFECTS.DEATH;
        const totalDuration = cfg.FREEZE_DURATION + cfg.SLOWMO_DURATION + cfg.WIPE_DURATION;
        
        return elapsed >= totalDuration;
    }
    
    // Get time scale for slowmo
    getTimeScale() {
        if (!this.deathState.active) return 1;
        
        const elapsed = performance.now() - this.deathState.startTime;
        const cfg = CONFIG.EFFECTS.DEATH;
        
        if (elapsed < cfg.FREEZE_DURATION) {
            return 0; // Freeze
        } else if (elapsed < cfg.FREEZE_DURATION + cfg.SLOWMO_DURATION) {
            return 0.2; // Slow motion
        }
        
        return 1;
    }
    
    update(deltaTime) {
        // Update particles
        this.particlePool.forEach((particle) => {
            particle.update(deltaTime);
            if (!particle.active) {
                this.particlePool.release(particle);
            }
        });
        
        // Update cracks
        this.cracks.forEach(crack => crack.update(deltaTime));
        
        // Update screen shake
        if (this.shakeIntensity > 0.1) {
            this.shakeOffsetX = randomRange(-this.shakeIntensity, this.shakeIntensity);
            this.shakeOffsetY = randomRange(-this.shakeIntensity, this.shakeIntensity);
            this.shakeIntensity *= Math.pow(CONFIG.EFFECTS.SCREEN_SHAKE.DECAY, deltaTime);
        } else {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
            this.shakeIntensity = 0;
        }
        
        // Lerp vignette
        this.vignetteIntensity = lerp(this.vignetteIntensity, this.targetVignetteIntensity, 0.05 * deltaTime);
        
        // Slowly recover from stress
        this.targetVignetteIntensity = lerp(this.targetVignetteIntensity, CONFIG.EFFECTS.VIGNETTE.BASE_INTENSITY, 0.01 * deltaTime);
        this.targetDesaturation = lerp(this.targetDesaturation, 0, 0.01 * deltaTime);
        this.desaturation = lerp(this.desaturation, this.targetDesaturation, 0.05 * deltaTime);
        
        // Flash decay
        if (this.flashIntensity > 0) {
            this.flashIntensity -= deltaTime * 0.05;
        }
        
        // Update death state
        if (this.deathState.active) {
            const elapsed = performance.now() - this.deathState.startTime;
            const cfg = CONFIG.EFFECTS.DEATH;
            
            if (elapsed < cfg.FREEZE_DURATION) {
                this.deathState.phase = 0;
            } else if (elapsed < cfg.FREEZE_DURATION + cfg.SLOWMO_DURATION) {
                this.deathState.phase = 1;
                this.deathState.progress = (elapsed - cfg.FREEZE_DURATION) / cfg.SLOWMO_DURATION;
            } else {
                this.deathState.phase = 2;
                this.deathState.progress = (elapsed - cfg.FREEZE_DURATION - cfg.SLOWMO_DURATION) / cfg.WIPE_DURATION;
            }
        }
    }
    
    // Apply canvas transforms for shake
    applyShake(ctx) {
        ctx.translate(this.shakeOffsetX, this.shakeOffsetY);
    }
    
    render(ctx) {
        // Render particles
        this.particlePool.forEach((particle) => {
            particle.render(ctx);
        });
        
        // Render cracks
        this.cracks.forEach(crack => crack.render(ctx));
    }
    
    renderOverlay(ctx) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Vignette
        const vignetteGradient = ctx.createRadialGradient(
            width / 2, height / 2, Math.min(width, height) * 0.3,
            width / 2, height / 2, Math.max(width, height) * 0.7
        );
        vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignetteGradient.addColorStop(1, `rgba(0, 0, 0, ${this.vignetteIntensity})`);
        
        ctx.fillStyle = vignetteGradient;
        ctx.fillRect(0, 0, width, height);
        
        // Near miss flash
        if (this.flashIntensity > 0) {
            ctx.fillStyle = `rgba(255, 255, 100, ${this.flashIntensity})`;
            ctx.fillRect(0, 0, width, height);
        }
        
        // Death wipe effect
        if (this.deathState.active && this.deathState.phase === 2) {
            const progress = this.deathState.progress;
            const centerX = this.deathState.playerX;
            const centerY = this.deathState.playerY;
            const maxRadius = Math.max(width, height) * 1.5;
            
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(centerX, centerY, maxRadius * progress, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
