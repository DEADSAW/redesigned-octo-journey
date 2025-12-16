// Enemies System - All enemy types with behaviors
import { CONFIG } from './config.js';
import { ObjectPool, vectorDistance, vectorAngle, angleToVector, randomRange, randomChoice, isOffScreen } from './utils.js';

// Enemy types enum
export const EnemyType = {
    ASTEROID: 'asteroid',
    SPLITTER: 'splitter',
    HUNTER: 'hunter',
    DRIFTER: 'drifter',
    SHIELDED: 'shielded',
    MARTYR: 'martyr'
};

// Base enemy class
class Enemy {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.size = 25;
        this.health = 20;
        this.maxHealth = 20;
        this.type = EnemyType.ASTEROID;
        this.active = false;
        this.grazeRadius = 50;
        this.points = 10;
        this.grazed = false;
        
        // Type-specific properties
        this.waveOffset = 0;
        this.baseY = 0;
        this.splitCount = 0;
        this.explosionRadius = 0;
        this.shieldActive = true;
    }
    
    init(type, x, y, targetX, targetY, isSplit = false) {
        const config = CONFIG.ENEMIES.TYPES[type.toUpperCase()];
        
        this.type = type;
        this.x = x;
        this.y = y;
        this.size = isSplit ? config.size * 0.5 : config.size;
        this.health = isSplit ? config.health * 0.3 : config.health;
        this.maxHealth = this.health;
        this.grazeRadius = config.grazeRadius;
        this.points = config.points;
        this.active = true;
        this.grazed = false;
        
        // Calculate velocity toward target
        const angle = vectorAngle(targetX - x, targetY - y);
        const speed = config.speed * (isSplit ? 1.5 : 1);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        // Random rotation
        this.rotationSpeed = randomRange(-0.05, 0.05);
        
        // Type-specific initialization
        switch (type) {
            case EnemyType.SPLITTER:
                this.splitCount = isSplit ? 0 : config.splitCount;
                break;
            case EnemyType.DRIFTER:
                this.waveOffset = randomRange(0, Math.PI * 2);
                this.baseY = y;
                break;
            case EnemyType.MARTYR:
                this.explosionRadius = config.explosionRadius;
                break;
            case EnemyType.SHIELDED:
                this.shieldActive = true;
                break;
        }
    }
    
    update(deltaTime, playerX, playerY, gameTime) {
        if (!this.active) return;
        
        // Type-specific behavior
        switch (this.type) {
            case EnemyType.HUNTER:
                this.updateHunter(deltaTime, playerX, playerY);
                break;
            case EnemyType.DRIFTER:
                this.updateDrifter(deltaTime, gameTime);
                break;
        }
        
        // Update position
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        
        // Update rotation
        this.rotation += this.rotationSpeed * deltaTime;
    }
    
    updateHunter(deltaTime, playerX, playerY) {
        const config = CONFIG.ENEMIES.TYPES.HUNTER;
        const targetAngle = vectorAngle(playerX - this.x, playerY - this.y);
        const currentAngle = vectorAngle(this.vx, this.vy);
        
        // Slightly adjust angle toward player
        let diff = targetAngle - currentAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        
        const newAngle = currentAngle + diff * config.trackingStrength * deltaTime;
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        
        this.vx = Math.cos(newAngle) * speed;
        this.vy = Math.sin(newAngle) * speed;
    }
    
    updateDrifter(deltaTime, gameTime) {
        const config = CONFIG.ENEMIES.TYPES.DRIFTER;
        const wave = Math.sin(gameTime * config.waveFrequency + this.waveOffset);
        this.vy += wave * config.waveAmplitude * deltaTime * 0.1;
    }
    
    takeDamage(amount) {
        if (!this.active) return false;
        
        // Shielded enemies take reduced damage until shield breaks
        if (this.type === EnemyType.SHIELDED && this.shieldActive) {
            if (this.health > this.maxHealth * 0.5) {
                amount *= 0.3;
            } else {
                this.shieldActive = false;
            }
        }
        
        this.health -= amount;
        return this.health <= 0;
    }
    
    render(ctx) {
        if (!this.active) return;
        
        const colors = CONFIG.COLORS;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Glow effect
        const glowSize = this.size * 1.5;
        const gradient = ctx.createRadialGradient(0, 0, this.size * 0.5, 0, 0, glowSize);
        gradient.addColorStop(0, 'rgba(255, 100, 50, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Render based on type
        switch (this.type) {
            case EnemyType.ASTEROID:
            case EnemyType.SPLITTER:
                this.renderAsteroid(ctx);
                break;
            case EnemyType.HUNTER:
                this.renderHunter(ctx);
                break;
            case EnemyType.DRIFTER:
                this.renderDrifter(ctx);
                break;
            case EnemyType.SHIELDED:
                this.renderShielded(ctx);
                break;
            case EnemyType.MARTYR:
                this.renderMartyr(ctx);
                break;
        }
        
        // Health indicator (subtle)
        if (this.health < this.maxHealth) {
            const healthPercent = this.health / this.maxHealth;
            ctx.strokeStyle = `rgba(255, ${Math.floor(255 * healthPercent)}, 0, 0.5)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.size + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * healthPercent);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    renderAsteroid(ctx) {
        const points = this.type === EnemyType.SPLITTER ? 8 : 6;
        const colors = CONFIG.COLORS;
        
        ctx.beginPath();
        for (let i = 0; i < points; i++) {
            const angle = (Math.PI * 2 / points) * i;
            const radius = this.size * (0.8 + Math.sin(i * 2.5) * 0.2);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        
        ctx.fillStyle = this.type === EnemyType.SPLITTER ? '#885544' : '#664433';
        ctx.fill();
        ctx.strokeStyle = colors.ENEMY_BASE;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    renderHunter(ctx) {
        // Dart-like shape
        ctx.beginPath();
        ctx.moveTo(this.size, 0);
        ctx.lineTo(-this.size * 0.5, -this.size * 0.6);
        ctx.lineTo(-this.size * 0.2, 0);
        ctx.lineTo(-this.size * 0.5, this.size * 0.6);
        ctx.closePath();
        
        ctx.fillStyle = '#aa3333';
        ctx.fill();
        ctx.strokeStyle = CONFIG.COLORS.ENEMY_GLOW;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    renderDrifter(ctx) {
        // Jellyfish-like shape
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 50, 150, 0.7)';
        ctx.fill();
        ctx.strokeStyle = '#aa66cc';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Tendrils
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(i * this.size * 0.25, this.size * 0.4);
            ctx.quadraticCurveTo(
                i * this.size * 0.3,
                this.size * 0.8,
                i * this.size * 0.2,
                this.size * 1.2
            );
            ctx.strokeStyle = 'rgba(170, 100, 200, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
    
    renderShielded(ctx) {
        // Core
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = '#555566';
        ctx.fill();
        ctx.strokeStyle = '#888899';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Shield
        if (this.shieldActive) {
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(100, 150, 255, 0.7)';
            ctx.lineWidth = 4;
            ctx.stroke();
            
            // Shield glow
            const shieldGradient = ctx.createRadialGradient(0, 0, this.size * 0.8, 0, 0, this.size * 1.2);
            shieldGradient.addColorStop(0, 'rgba(100, 150, 255, 0)');
            shieldGradient.addColorStop(0.5, 'rgba(100, 150, 255, 0.2)');
            shieldGradient.addColorStop(1, 'rgba(100, 150, 255, 0)');
            
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 1.2, 0, Math.PI * 2);
            ctx.fillStyle = shieldGradient;
            ctx.fill();
        }
    }
    
    renderMartyr(ctx) {
        // Glowing core that pulses
        const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.1;
        
        // Outer glow
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * pulse);
        gradient.addColorStop(0, 'rgba(255, 200, 50, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(0, 0, this.size * pulse, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Core
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffcc00';
        ctx.fill();
    }
    
    get hitRadius() {
        return this.size * 0.9;
    }
}

export class EnemySystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.enemyPool = new ObjectPool(
            () => new Enemy(),
            (enemy) => enemy.reset(),
            50
        );
        
        this.lastSpawnTime = 0;
        this.gameTime = 0;
        this.spawnQueue = []; // For splitter children
    }
    
    reset() {
        this.enemyPool.releaseAll();
        this.lastSpawnTime = 0;
        this.gameTime = 0;
        this.spawnQueue = [];
    }
    
    getSpawnRate() {
        const diff = CONFIG.DIFFICULTY;
        const time = this.gameTime / 1000; // Convert to seconds
        
        let multiplier = 1;
        if (time > diff.PHASE_3) {
            multiplier = diff.SPAWN_MULTIPLIER_MAX;
        } else if (time > diff.PHASE_2) {
            multiplier = diff.SPAWN_MULTIPLIER_PHASE_3;
        } else if (time > diff.PHASE_1) {
            multiplier = diff.SPAWN_MULTIPLIER_PHASE_2;
        }
        
        return CONFIG.ENEMIES.BASE_SPAWN_RATE * multiplier;
    }
    
    selectEnemyType() {
        const time = this.gameTime / 1000;
        const types = [EnemyType.ASTEROID];
        
        // Unlock enemy types based on time
        if (time > 10) types.push(EnemyType.DRIFTER);
        if (time > 20) types.push(EnemyType.HUNTER);
        if (time > 30) types.push(EnemyType.SPLITTER);
        if (time > 45) types.push(EnemyType.SHIELDED);
        if (time > 60) types.push(EnemyType.MARTYR);
        
        return randomChoice(types);
    }
    
    getSpawnPosition(playerX, playerY) {
        const margin = CONFIG.ENEMIES.SPAWN_MARGIN;
        const minDist = CONFIG.ENEMIES.MIN_SPAWN_DISTANCE;
        
        let x, y;
        let attempts = 0;
        
        do {
            // Spawn from edge of screen
            const side = Math.floor(Math.random() * 4);
            
            switch (side) {
                case 0: // Top
                    x = randomRange(0, this.canvas.width);
                    y = -margin;
                    break;
                case 1: // Right
                    x = this.canvas.width + margin;
                    y = randomRange(0, this.canvas.height);
                    break;
                case 2: // Bottom
                    x = randomRange(0, this.canvas.width);
                    y = this.canvas.height + margin;
                    break;
                case 3: // Left
                    x = -margin;
                    y = randomRange(0, this.canvas.height);
                    break;
            }
            
            attempts++;
        } while (vectorDistance(x, y, playerX, playerY) < minDist && attempts < 10);
        
        return { x, y };
    }
    
    spawn(playerX, playerY) {
        const type = this.selectEnemyType();
        const pos = this.getSpawnPosition(playerX, playerY);
        
        // Target is roughly toward center/player with some randomness
        const targetX = this.canvas.width * 0.5 + randomRange(-100, 100);
        const targetY = this.canvas.height * 0.5 + randomRange(-100, 100);
        
        const enemy = this.enemyPool.get();
        enemy.init(type, pos.x, pos.y, targetX, targetY);
    }
    
    spawnSplitterChildren(parentEnemy) {
        const count = CONFIG.ENEMIES.TYPES.SPLITTER.splitCount;
        
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + randomRange(-0.3, 0.3);
            const targetX = parentEnemy.x + Math.cos(angle) * 200;
            const targetY = parentEnemy.y + Math.sin(angle) * 200;
            
            this.spawnQueue.push({
                type: EnemyType.SPLITTER,
                x: parentEnemy.x,
                y: parentEnemy.y,
                targetX,
                targetY,
                isSplit: true
            });
        }
    }
    
    update(deltaTime, currentTime, playerX, playerY) {
        this.gameTime += deltaTime * (1000 / CONFIG.FPS_TARGET);
        
        // Spawn from queue (splitter children)
        while (this.spawnQueue.length > 0) {
            const spawn = this.spawnQueue.shift();
            const enemy = this.enemyPool.get();
            enemy.init(spawn.type, spawn.x, spawn.y, spawn.targetX, spawn.targetY, spawn.isSplit);
        }
        
        // Regular spawning
        const spawnRate = this.getSpawnRate();
        const spawnInterval = 1000 / spawnRate;
        
        if (currentTime - this.lastSpawnTime > spawnInterval) {
            this.spawn(playerX, playerY);
            this.lastSpawnTime = currentTime;
        }
        
        // Update all enemies
        this.enemyPool.forEach((enemy) => {
            enemy.update(deltaTime, playerX, playerY, this.gameTime);
            
            // Deactivate if too far off screen
            if (isOffScreen(enemy.x, enemy.y, 200, this.canvas.width, this.canvas.height)) {
                enemy.active = false;
                this.enemyPool.release(enemy);
            }
        });
    }
    
    render(ctx) {
        this.enemyPool.forEach((enemy) => {
            enemy.render(ctx);
        });
    }
    
    getEnemies() {
        return this.enemyPool.active.filter(e => e.active);
    }
    
    destroyEnemy(enemy) {
        if (!enemy.active) return;
        
        // Handle splitter splitting
        if (enemy.type === EnemyType.SPLITTER && enemy.splitCount > 0) {
            this.spawnSplitterChildren(enemy);
        }
        
        enemy.active = false;
        this.enemyPool.release(enemy);
    }
}
