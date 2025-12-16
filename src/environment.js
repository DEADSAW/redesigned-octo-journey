// Environment System - Gravity wells, solar wind, debris clouds
import { CONFIG } from './config.js';
import { vectorDistance, randomRange, clamp } from './utils.js';

// Gravity Well
class GravityWell {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.x = 0;
        this.y = 0;
        this.radius = CONFIG.ENVIRONMENT.GRAVITY_WELL.RADIUS;
        this.strength = CONFIG.ENVIRONMENT.GRAVITY_WELL.STRENGTH;
        this.active = false;
        this.lifetime = 0;
        this.maxLifetime = 15000; // 15 seconds
        this.pulsePhase = 0;
    }
    
    init(x, y) {
        this.x = x;
        this.y = y;
        this.active = true;
        this.lifetime = 0;
        this.pulsePhase = Math.random() * Math.PI * 2;
    }
    
    update(deltaTime) {
        if (!this.active) return;
        
        this.lifetime += deltaTime * (1000 / CONFIG.FPS_TARGET);
        this.pulsePhase += deltaTime * 0.05;
        
        if (this.lifetime > this.maxLifetime) {
            this.active = false;
        }
    }
    
    getForce(x, y) {
        if (!this.active) return { x: 0, y: 0 };
        
        const dist = vectorDistance(x, y, this.x, this.y);
        if (dist > this.radius || dist < 10) return { x: 0, y: 0 };
        
        // Force increases as you get closer
        const forceMagnitude = this.strength * (1 - dist / this.radius);
        const dx = this.x - x;
        const dy = this.y - y;
        
        return {
            x: (dx / dist) * forceMagnitude,
            y: (dy / dist) * forceMagnitude
        };
    }
    
    render(ctx) {
        if (!this.active) return;
        
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.1;
        const fadeout = Math.min(1, (this.maxLifetime - this.lifetime) / 2000);
        
        // Outer influence ring
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100, 50, 150, ${0.3 * fadeout})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Center gradient
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.radius * 0.5 * pulse
        );
        gradient.addColorStop(0, `rgba(50, 0, 100, ${0.6 * fadeout})`);
        gradient.addColorStop(0.5, `rgba(100, 50, 150, ${0.3 * fadeout})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.5 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Core
        ctx.beginPath();
        ctx.arc(this.x, this.y, 10 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(150, 100, 200, ${0.8 * fadeout})`;
        ctx.fill();
    }
}

// Debris Cloud (visual only)
class DebrisCloud {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.size = CONFIG.ENVIRONMENT.DEBRIS_CLOUD.SIZE;
        this.active = false;
        this.particles = [];
        this.lifetime = 0;
        this.maxLifetime = 20000;
    }
    
    init(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.active = true;
        this.lifetime = 0;
        
        // Generate particles
        this.particles = [];
        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                offsetX: randomRange(-this.size / 2, this.size / 2),
                offsetY: randomRange(-this.size / 2, this.size / 2),
                size: randomRange(2, 6),
                alpha: randomRange(0.2, 0.5),
                rotation: randomRange(0, Math.PI * 2),
                rotationSpeed: randomRange(-0.02, 0.02)
            });
        }
    }
    
    update(deltaTime) {
        if (!this.active) return;
        
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        this.lifetime += deltaTime * (1000 / CONFIG.FPS_TARGET);
        
        // Update particles
        this.particles.forEach(p => {
            p.rotation += p.rotationSpeed * deltaTime;
        });
        
        if (this.lifetime > this.maxLifetime) {
            this.active = false;
        }
    }
    
    render(ctx) {
        if (!this.active) return;
        
        const fadeout = Math.min(1, (this.maxLifetime - this.lifetime) / 3000);
        
        // Cloud fog
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.size
        );
        gradient.addColorStop(0, `rgba(50, 50, 80, ${0.3 * fadeout})`);
        gradient.addColorStop(1, 'rgba(50, 50, 80, 0)');
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Particles
        this.particles.forEach(p => {
            ctx.save();
            ctx.translate(this.x + p.offsetX, this.y + p.offsetY);
            ctx.rotate(p.rotation);
            
            ctx.fillStyle = `rgba(100, 100, 120, ${p.alpha * fadeout})`;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            
            ctx.restore();
        });
    }
    
    isInCloud(x, y) {
        return vectorDistance(x, y, this.x, this.y) < this.size;
    }
}

// Solar Wind
class SolarWind {
    constructor() {
        this.direction = 1; // 1 = right, -1 = left
        this.strength = CONFIG.ENVIRONMENT.SOLAR_WIND.STRENGTH;
        this.lastDirectionChange = 0;
        this.nextDirectionChange = this.getNextChangeTime();
        this.transitionProgress = 1;
        this.targetDirection = 1;
    }
    
    getNextChangeTime() {
        const cfg = CONFIG.ENVIRONMENT.SOLAR_WIND;
        return randomRange(cfg.DIRECTION_CHANGE_MIN, cfg.DIRECTION_CHANGE_MAX);
    }
    
    update(deltaTime, currentTime) {
        // Check for direction change
        if (currentTime - this.lastDirectionChange > this.nextDirectionChange) {
            this.targetDirection = -this.direction;
            this.transitionProgress = 0;
            this.lastDirectionChange = currentTime;
            this.nextDirectionChange = this.getNextChangeTime();
        }
        
        // Smooth transition
        if (this.transitionProgress < 1) {
            this.transitionProgress = Math.min(1, this.transitionProgress + deltaTime * 0.02);
            this.direction = this.direction + (this.targetDirection - this.direction) * this.transitionProgress;
        }
    }
    
    getForce() {
        return {
            x: this.strength * this.direction,
            y: 0
        };
    }
    
    render(ctx, canvasWidth, canvasHeight) {
        // Subtle wind lines
        const lineCount = 10;
        const alpha = 0.1 + Math.abs(this.direction) * 0.1;
        
        ctx.strokeStyle = `rgba(100, 150, 200, ${alpha})`;
        ctx.lineWidth = 1;
        
        for (let i = 0; i < lineCount; i++) {
            const y = (canvasHeight / lineCount) * i + (Date.now() * 0.01 * this.direction) % (canvasHeight / lineCount);
            const length = 50 + Math.sin(i + Date.now() * 0.001) * 20;
            
            ctx.beginPath();
            ctx.moveTo(this.direction > 0 ? 0 : canvasWidth, y);
            ctx.lineTo(this.direction > 0 ? length : canvasWidth - length, y);
            ctx.stroke();
        }
    }
}

// Main Environment System
export class EnvironmentSystem {
    constructor(canvas) {
        this.canvas = canvas;
        
        this.gravityWells = [];
        this.debrisClouds = [];
        this.solarWind = new SolarWind();
        
        // Pre-create some objects
        for (let i = 0; i < 3; i++) {
            this.gravityWells.push(new GravityWell());
            this.debrisClouds.push(new DebrisCloud());
        }
    }
    
    reset() {
        this.gravityWells.forEach(gw => gw.reset());
        this.debrisClouds.forEach(dc => dc.reset());
        this.solarWind = new SolarWind();
    }
    
    update(deltaTime, currentTime) {
        // Update solar wind
        this.solarWind.update(deltaTime, currentTime);
        
        // Update gravity wells
        this.gravityWells.forEach(gw => gw.update(deltaTime));
        
        // Update debris clouds
        this.debrisClouds.forEach(dc => dc.update(deltaTime));
        
        // Randomly spawn gravity wells
        if (Math.random() < CONFIG.ENVIRONMENT.GRAVITY_WELL.SPAWN_CHANCE * deltaTime) {
            const inactiveWell = this.gravityWells.find(gw => !gw.active);
            if (inactiveWell) {
                inactiveWell.init(
                    randomRange(100, this.canvas.width - 100),
                    randomRange(100, this.canvas.height - 100)
                );
            }
        }
        
        // Randomly spawn debris clouds
        if (Math.random() < 0.0005 * deltaTime) {
            const inactiveCloud = this.debrisClouds.find(dc => !dc.active);
            if (inactiveCloud) {
                const edge = Math.random() < 0.5;
                inactiveCloud.init(
                    edge ? (Math.random() < 0.5 ? -100 : this.canvas.width + 100) : randomRange(0, this.canvas.width),
                    !edge ? (Math.random() < 0.5 ? -100 : this.canvas.height + 100) : randomRange(0, this.canvas.height),
                    randomRange(-0.3, 0.3),
                    randomRange(-0.3, 0.3)
                );
            }
        }
    }
    
    getForceAtPosition(x, y) {
        let force = { x: 0, y: 0 };
        
        // Add solar wind
        const windForce = this.solarWind.getForce();
        force.x += windForce.x;
        force.y += windForce.y;
        
        // Add gravity wells
        this.gravityWells.forEach(gw => {
            if (gw.active) {
                const gwForce = gw.getForce(x, y);
                force.x += gwForce.x;
                force.y += gwForce.y;
            }
        });
        
        return force;
    }
    
    getVisibilityAtPosition(x, y) {
        let visibility = 1;
        
        this.debrisClouds.forEach(dc => {
            if (dc.active && dc.isInCloud(x, y)) {
                visibility *= (1 - CONFIG.ENVIRONMENT.DEBRIS_CLOUD.VISIBILITY_REDUCTION);
            }
        });
        
        return visibility;
    }
    
    render(ctx) {
        // Render solar wind (background)
        this.solarWind.render(ctx, this.canvas.width, this.canvas.height);
        
        // Render debris clouds
        this.debrisClouds.forEach(dc => dc.render(ctx));
        
        // Render gravity wells
        this.gravityWells.forEach(gw => gw.render(ctx));
    }
}
