// Weapons System - Auto-fire with dynamic weapon switching
import { CONFIG } from './config.js';
import { ObjectPool, vectorAngle, angleToVector, randomRange } from './utils.js';

// Bullet class
class Bullet {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.active = false;
        this.damage = 10;
        this.size = CONFIG.WEAPONS.BULLET_SIZE;
        this.glow = 1;
    }
    
    update(deltaTime, canvasWidth, canvasHeight) {
        if (!this.active) return;
        
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        
        // Deactivate if off screen
        if (this.x < -50 || this.x > canvasWidth + 50 ||
            this.y < -50 || this.y > canvasHeight + 50) {
            this.active = false;
        }
    }
    
    render(ctx, overdrive = 0) {
        if (!this.active) return;
        
        const colors = CONFIG.COLORS;
        const glowSize = this.size * (1.5 + overdrive * 0.5);
        
        // Glow effect
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, glowSize
        );
        
        const overdriveT = overdrive / 100;
        const r = Math.floor(255);
        const g = Math.floor(255 * (1 - overdriveT * 0.5));
        const b = Math.floor(255);
        
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.5)`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Core
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = colors.BULLET;
        ctx.fill();
    }
}

// Weapon types
export const WeaponType = {
    FOCUSED: 'focused',
    CHAIN: 'chain',
    SPREAD: 'spread',
    SCATTER: 'scatter'
};

export class WeaponSystem {
    constructor() {
        this.bulletPool = new ObjectPool(
            () => new Bullet(),
            (bullet) => bullet.reset(),
            100
        );
        
        this.lastFireTime = 0;
        this.currentWeapon = WeaponType.FOCUSED;
        
        // Play style tracking for weapon selection
        this.nearMissStreak = 0;
        this.closeProximityCount = 0;
        this.panicMovementScore = 0;
        this.smoothMovementScore = 0;
    }
    
    reset() {
        this.bulletPool.releaseAll();
        this.lastFireTime = 0;
        this.currentWeapon = WeaponType.FOCUSED;
        this.nearMissStreak = 0;
        this.closeProximityCount = 0;
        this.panicMovementScore = 0;
        this.smoothMovementScore = 0;
    }
    
    // Called when player grazes an enemy
    registerNearMiss() {
        this.nearMissStreak++;
        setTimeout(() => {
            this.nearMissStreak = Math.max(0, this.nearMissStreak - 1);
        }, 2000);
    }
    
    // Called when enemies are close
    registerCloseProximity() {
        this.closeProximityCount++;
        setTimeout(() => {
            this.closeProximityCount = Math.max(0, this.closeProximityCount - 1);
        }, 1000);
    }
    
    // Update play style metrics
    updatePlayStyle(player, deltaTime) {
        const speed = player.speed;
        const maxSpeed = CONFIG.PLAYER.MAX_SPEED;
        
        // Smooth movement = consistent medium-high speed
        if (speed > maxSpeed * 0.5 && speed < maxSpeed * 0.9) {
            this.smoothMovementScore += deltaTime * 0.1;
        } else {
            this.smoothMovementScore = Math.max(0, this.smoothMovementScore - deltaTime * 0.05);
        }
        
        // Panic movement = erratic speed changes (tracked externally would be better)
        if (player.inDangerState || speed < maxSpeed * 0.2) {
            this.panicMovementScore += deltaTime * 0.1;
        } else {
            this.panicMovementScore = Math.max(0, this.panicMovementScore - deltaTime * 0.05);
        }
        
        // Cap scores
        this.smoothMovementScore = Math.min(100, this.smoothMovementScore);
        this.panicMovementScore = Math.min(100, this.panicMovementScore);
    }
    
    // Select weapon based on play style
    selectWeapon() {
        // Priority order for weapon selection
        if (this.panicMovementScore > 50) {
            return WeaponType.SCATTER;
        } else if (this.closeProximityCount > 3) {
            return WeaponType.SPREAD;
        } else if (this.nearMissStreak > 2) {
            return WeaponType.CHAIN;
        } else if (this.smoothMovementScore > 30) {
            return WeaponType.FOCUSED;
        }
        
        return WeaponType.FOCUSED; // Default
    }
    
    getWeaponConfig(type) {
        switch (type) {
            case WeaponType.CHAIN:
                return CONFIG.WEAPONS.CHAIN;
            case WeaponType.SPREAD:
                return CONFIG.WEAPONS.SPREAD;
            case WeaponType.SCATTER:
                return CONFIG.WEAPONS.SCATTER;
            default:
                return CONFIG.WEAPONS.FOCUSED;
        }
    }
    
    update(player, currentTime, deltaTime) {
        if (!player.alive) return;
        
        // Update play style
        this.updatePlayStyle(player, deltaTime);
        
        // Select weapon
        this.currentWeapon = this.selectWeapon();
        
        // Calculate fire rate with overdrive bonus
        const baseRate = CONFIG.WEAPONS.BASE_FIRE_RATE;
        const overdriveMultiplier = player.getOverdriveMultiplier();
        const fireRate = baseRate / overdriveMultiplier;
        
        // Auto-fire
        if (currentTime - this.lastFireTime > fireRate) {
            this.fire(player);
            this.lastFireTime = currentTime;
        }
        
        // Update all bullets
        this.bulletPool.forEach((bullet) => {
            bullet.update(deltaTime, player.canvas.width, player.canvas.height);
            if (!bullet.active) {
                this.bulletPool.release(bullet);
            }
        });
    }
    
    fire(player) {
        const weaponConfig = this.getWeaponConfig(this.currentWeapon);
        const baseAngle = player.rotation;
        
        for (let i = 0; i < weaponConfig.count; i++) {
            const bullet = this.bulletPool.get();
            
            // Calculate spread angle
            let spreadAngle = 0;
            if (weaponConfig.count > 1) {
                const spreadRange = weaponConfig.spread * Math.PI;
                spreadAngle = -spreadRange / 2 + (spreadRange / (weaponConfig.count - 1)) * i;
            }
            
            // Add some randomness for scatter
            if (this.currentWeapon === WeaponType.SCATTER) {
                spreadAngle += randomRange(-0.2, 0.2);
            }
            
            const angle = baseAngle + spreadAngle;
            const direction = angleToVector(angle);
            
            bullet.x = player.x + direction.x * CONFIG.PLAYER.SIZE;
            bullet.y = player.y + direction.y * CONFIG.PLAYER.SIZE;
            bullet.vx = direction.x * CONFIG.WEAPONS.BULLET_SPEED;
            bullet.vy = direction.y * CONFIG.WEAPONS.BULLET_SPEED;
            bullet.damage = weaponConfig.damage;
            bullet.active = true;
        }
    }
    
    render(ctx, overdrive) {
        this.bulletPool.forEach((bullet) => {
            bullet.render(ctx, overdrive);
        });
    }
    
    getBullets() {
        return this.bulletPool.active.filter(b => b.active);
    }
}
