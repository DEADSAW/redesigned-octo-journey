// Player System
import { CONFIG } from './config.js';
import { vectorLength, clamp, lerp, vectorAngle } from './utils.js';

export class Player {
    constructor(canvas) {
        this.canvas = canvas;
        this.reset();
    }
    
    reset() {
        const cfg = CONFIG.PLAYER;
        
        // Position
        this.x = this.canvas.width * cfg.INITIAL_X_OFFSET;
        this.y = this.canvas.height * cfg.INITIAL_Y_OFFSET;
        
        // Velocity
        this.vx = 0;
        this.vy = 0;
        
        // State
        this.rotation = 0;
        this.targetRotation = 0;
        this.overdrive = 0;
        this.alive = true;
        
        // Danger state tracking
        this.lowVelocityTime = 0;
        this.inDangerState = false;
        
        // Visual state
        this.engineGlow = 0;
        this.trailPositions = [];
    }
    
    update(input, deltaTime, environmentForce = { x: 0, y: 0 }) {
        if (!this.alive) return;
        
        const cfg = CONFIG.PLAYER;
        const movement = input.getMovementVector();
        
        // Apply acceleration
        this.vx += movement.x * cfg.ACCELERATION * deltaTime;
        this.vy += movement.y * cfg.ACCELERATION * deltaTime;
        
        // Apply environment forces
        this.vx += environmentForce.x * deltaTime;
        this.vy += environmentForce.y * deltaTime;
        
        // Apply friction
        this.vx *= Math.pow(cfg.FRICTION, deltaTime);
        this.vy *= Math.pow(cfg.FRICTION, deltaTime);
        
        // Clamp to max speed
        const speed = vectorLength(this.vx, this.vy);
        if (speed > cfg.MAX_SPEED) {
            const scale = cfg.MAX_SPEED / speed;
            this.vx *= scale;
            this.vy *= scale;
        }
        
        // Update position
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        
        // Keep player on screen
        this.x = clamp(this.x, cfg.SIZE, this.canvas.width - cfg.SIZE);
        this.y = clamp(this.y, cfg.SIZE, this.canvas.height - cfg.SIZE);
        
        // Update rotation based on velocity
        if (speed > 0.1) {
            this.targetRotation = vectorAngle(this.vx, this.vy);
        }
        this.rotation = lerp(this.rotation, this.targetRotation, 0.1 * deltaTime);
        
        // Update engine glow based on speed
        this.engineGlow = lerp(this.engineGlow, speed / cfg.MAX_SPEED, 0.1 * deltaTime);
        
        // Track danger state (too slow for too long)
        if (speed < cfg.MIN_VELOCITY_THRESHOLD) {
            this.lowVelocityTime += deltaTime * (1000 / CONFIG.FPS_TARGET);
            this.inDangerState = this.lowVelocityTime > cfg.DANGER_STATE_TIME;
        } else {
            this.lowVelocityTime = 0;
            this.inDangerState = false;
        }
        
        // Decay overdrive
        this.overdrive = Math.max(0, this.overdrive - CONFIG.OVERDRIVE.DECAY_RATE * deltaTime);
        
        // Store trail positions
        this.trailPositions.unshift({ x: this.x, y: this.y, alpha: 1 });
        if (this.trailPositions.length > 10) {
            this.trailPositions.pop();
        }
        
        // Fade trail
        this.trailPositions.forEach((pos, i) => {
            pos.alpha = 1 - (i / this.trailPositions.length);
        });
    }
    
    addOverdrive(amount) {
        this.overdrive = Math.min(CONFIG.OVERDRIVE.MAX, this.overdrive + amount);
    }
    
    getOverdriveMultiplier() {
        const t = this.overdrive / CONFIG.OVERDRIVE.MAX;
        return 1 + t * (CONFIG.OVERDRIVE.FIRE_RATE_MULTIPLIER - 1);
    }
    
    render(ctx) {
        if (!this.alive) return;
        
        const cfg = CONFIG.PLAYER;
        const colors = CONFIG.COLORS;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Draw trail
        this.trailPositions.forEach((pos, i) => {
            if (i === 0) return;
            const relX = pos.x - this.x;
            const relY = pos.y - this.y;
            const rotatedX = relX * Math.cos(-this.rotation) - relY * Math.sin(-this.rotation);
            const rotatedY = relX * Math.sin(-this.rotation) + relY * Math.cos(-this.rotation);
            
            ctx.beginPath();
            ctx.arc(rotatedX, rotatedY, cfg.SIZE * 0.3 * pos.alpha, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 255, 255, ${pos.alpha * 0.3})`;
            ctx.fill();
        });
        
        // Engine glow
        if (this.engineGlow > 0.1) {
            const glowSize = cfg.SIZE * (1 + this.engineGlow * 0.5);
            const gradient = ctx.createRadialGradient(-cfg.SIZE * 0.5, 0, 0, -cfg.SIZE * 0.5, 0, glowSize);
            
            // Color shift with overdrive
            const overdriveT = this.overdrive / CONFIG.OVERDRIVE.MAX;
            const r = Math.floor(lerp(0, 255, overdriveT));
            const g = Math.floor(lerp(255, 0, overdriveT * 0.5));
            const b = 255;
            
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${this.engineGlow * 0.8})`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.beginPath();
            ctx.arc(-cfg.SIZE * 0.5, 0, glowSize, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
        }
        
        // Draw ship body (triangle shape)
        ctx.beginPath();
        ctx.moveTo(cfg.SIZE, 0);
        ctx.lineTo(-cfg.SIZE * 0.6, -cfg.SIZE * 0.5);
        ctx.lineTo(-cfg.SIZE * 0.3, 0);
        ctx.lineTo(-cfg.SIZE * 0.6, cfg.SIZE * 0.5);
        ctx.closePath();
        
        // Fill with gradient
        const bodyGradient = ctx.createLinearGradient(-cfg.SIZE, 0, cfg.SIZE, 0);
        const overdriveT = this.overdrive / CONFIG.OVERDRIVE.MAX;
        const baseColor = colors.PLAYER;
        const glowColor = `rgba(255, ${Math.floor(255 * (1 - overdriveT))}, 255, 1)`;
        
        bodyGradient.addColorStop(0, colors.PLAYER_GLOW);
        bodyGradient.addColorStop(1, lerp(0, 1, overdriveT) > 0.5 ? glowColor : baseColor);
        
        ctx.fillStyle = bodyGradient;
        ctx.fill();
        
        // Outline
        ctx.strokeStyle = colors.PLAYER;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Danger state indicator
        if (this.inDangerState) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(0, 0, cfg.SIZE * 1.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        ctx.restore();
    }
    
    get hitRadius() {
        return CONFIG.PLAYER.SIZE * 0.7;
    }
    
    get speed() {
        return vectorLength(this.vx, this.vy);
    }
}
