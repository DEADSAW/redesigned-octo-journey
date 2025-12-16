// Main Game Logic - Game loop, collision detection, state management
import { CONFIG } from './config.js';
import { Player } from './player.js';
import { WeaponSystem } from './weapons.js';
import { EnemySystem, EnemyType } from './enemies.js';
import { EnvironmentSystem } from './environment.js';
import { EffectsSystem } from './effects.js';
import { AudioSystem } from './audio.js';
import { DeltaTime, InputManager, vectorDistance, circleCollision } from './utils.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Resize canvas to fill window
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Core systems
        this.deltaTime = new DeltaTime();
        this.input = new InputManager();
        
        // Game systems
        this.player = new Player(canvas);
        this.weapons = new WeaponSystem();
        this.enemies = new EnemySystem(canvas);
        this.environment = new EnvironmentSystem(canvas);
        this.effects = new EffectsSystem(canvas);
        this.audio = new AudioSystem();
        
        // Game state
        this.running = false;
        this.gameTime = 0;
        this.timeSurvived = 0;
        this.peakOverdrive = 0;
        this.currentTime = 0;
        
        // Start on first interaction
        this.waitingForStart = true;
        this.setupStartListener();
        
        // Render initial start screen
        this.renderStartScreen();
    }
    
    renderStartScreen() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear with background
        ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
        ctx.fillRect(0, 0, width, height);
        
        // Background gradient
        const bgGradient = ctx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, Math.max(width, height) * 0.7
        );
        bgGradient.addColorStop(0, 'rgba(10, 22, 40, 0.5)');
        bgGradient.addColorStop(1, 'rgba(10, 10, 26, 0.5)');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
        
        // Animate the start screen
        const animate = () => {
            if (!this.waitingForStart) return;
            
            // Clear
            ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, width, height);
            
            // Pulsing effect
            const pulse = 0.5 + Math.sin(Date.now() * 0.003) * 0.3;
            
            // Draw a pulsing visual cue (no text instructions per spec)
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, 30 + pulse * 10, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 255, ${pulse})`;
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Inner circle
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, 15, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 255, 255, ${pulse * 0.5})`;
            ctx.fill();
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    setupStartListener() {
        const startGame = () => {
            if (this.waitingForStart) {
                this.waitingForStart = false;
                this.audio.init();
                this.audio.resume();
                this.start();
            }
            document.removeEventListener('click', startGame);
            document.removeEventListener('keydown', startGame);
            document.removeEventListener('touchstart', startGame);
        };
        
        document.addEventListener('click', startGame);
        document.addEventListener('keydown', startGame);
        document.addEventListener('touchstart', startGame);
    }
    
    start() {
        this.reset();
        this.running = true;
        this.gameLoop();
    }
    
    reset() {
        this.player.reset();
        this.weapons.reset();
        this.enemies.reset();
        this.environment.reset();
        this.effects.reset();
        this.audio.reset();
        
        this.gameTime = 0;
        this.timeSurvived = 0;
        this.peakOverdrive = 0;
        this.deltaTime = new DeltaTime();
    }
    
    gameLoop() {
        if (!this.running) return;
        
        this.currentTime = performance.now();
        const dt = this.deltaTime.update();
        const normalizedDt = this.deltaTime.dt;
        
        // Get time scale (for death slowmo)
        const timeScale = this.effects.getTimeScale();
        const scaledDt = normalizedDt * timeScale;
        
        // Update
        this.update(scaledDt, this.currentTime);
        
        // Render
        this.render();
        
        // Check death completion
        if (this.effects.isDeathComplete()) {
            this.reset();
        }
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    update(deltaTime, currentTime) {
        // Skip updates if in death freeze
        if (this.effects.deathState.active && this.effects.deathState.phase === 0) {
            this.effects.update(deltaTime);
            return;
        }
        
        // Update game time
        if (this.player.alive) {
            this.gameTime += deltaTime * (1000 / CONFIG.FPS_TARGET);
            this.timeSurvived = this.gameTime / 1000;
        }
        
        // Update environment
        this.environment.update(deltaTime, currentTime);
        
        // Get environment force at player position
        const envForce = this.environment.getForceAtPosition(this.player.x, this.player.y);
        
        // Update player
        this.player.update(this.input, deltaTime, envForce);
        
        // Track peak overdrive
        if (this.player.overdrive > this.peakOverdrive) {
            this.peakOverdrive = this.player.overdrive;
        }
        
        // Update weapons (auto-fire)
        if (this.player.alive) {
            this.weapons.update(this.player, currentTime, deltaTime);
        }
        
        // Update enemies
        this.enemies.update(deltaTime, currentTime, this.player.x, this.player.y);
        
        // Collision detection
        this.checkCollisions();
        
        // Update effects
        this.effects.update(deltaTime);
        
        // Update audio
        this.audio.update(this.player.overdrive, deltaTime);
    }
    
    checkCollisions() {
        if (!this.player.alive) return;
        
        const bullets = this.weapons.getBullets();
        const enemies = this.enemies.getEnemies();
        
        // Track close enemies for weapon system
        let closeEnemyCount = 0;
        
        enemies.forEach(enemy => {
            if (!enemy.active) return;
            
            // Check player-enemy collision
            const distToPlayer = vectorDistance(
                this.player.x, this.player.y,
                enemy.x, enemy.y
            );
            
            // Death collision
            if (circleCollision(
                this.player.x, this.player.y, this.player.hitRadius,
                enemy.x, enemy.y, enemy.hitRadius
            )) {
                this.handlePlayerDeath(enemy);
                return;
            }
            
            // Graze detection (near miss)
            if (!enemy.grazed && distToPlayer < enemy.grazeRadius + this.player.hitRadius) {
                enemy.grazed = true;
                this.player.addOverdrive(CONFIG.OVERDRIVE.GRAZE_BONUS);
                this.weapons.registerNearMiss();
                this.effects.addGrazeFlash(
                    (this.player.x + enemy.x) / 2,
                    (this.player.y + enemy.y) / 2
                );
                this.audio.playGraze();
            }
            
            // Track close enemies
            if (distToPlayer < 150) {
                closeEnemyCount++;
            }
            
            // Check bullet-enemy collisions
            bullets.forEach(bullet => {
                if (!bullet.active) return;
                
                if (circleCollision(
                    bullet.x, bullet.y, bullet.size,
                    enemy.x, enemy.y, enemy.hitRadius
                )) {
                    // Bullet hits enemy
                    bullet.active = false;
                    
                    const killed = enemy.takeDamage(bullet.damage);
                    this.audio.playHit();
                    
                    if (killed) {
                        // Handle enemy death
                        this.handleEnemyDeath(enemy);
                    } else {
                        // Small hit effect
                        this.effects.addShake(CONFIG.EFFECTS.SCREEN_SHAKE.INTENSITY_LIGHT);
                    }
                }
            });
        });
        
        // Update weapon system with close proximity count
        if (closeEnemyCount > 3) {
            this.weapons.registerCloseProximity();
        }
        
        // Near misses add screen stress
        enemies.forEach(enemy => {
            if (!enemy.active) return;
            
            const distToPlayer = vectorDistance(
                this.player.x, this.player.y,
                enemy.x, enemy.y
            );
            
            // Very close call - add crack
            if (distToPlayer < enemy.hitRadius + this.player.hitRadius + 20) {
                this.effects.addCrack(
                    (this.player.x + enemy.x) / 2,
                    (this.player.y + enemy.y) / 2
                );
            }
        });
    }
    
    handleEnemyDeath(enemy) {
        // Spawn explosion effect
        let color = CONFIG.COLORS.ENEMY_BASE;
        let particleCount = 20;
        
        if (enemy.type === EnemyType.MARTYR) {
            // Big explosion
            this.effects.spawnMartyrExplosion(enemy.x, enemy.y);
            this.audio.playExplosion();
            
            // Check if player is caught in explosion
            const distToPlayer = vectorDistance(
                this.player.x, this.player.y,
                enemy.x, enemy.y
            );
            
            if (distToPlayer < enemy.explosionRadius) {
                this.handlePlayerDeath(enemy);
                return;
            }
        } else {
            this.effects.spawnExplosion(enemy.x, enemy.y, color, particleCount);
            this.audio.playExplosion();
        }
        
        // Destroy the enemy (handles splitters too)
        this.enemies.destroyEnemy(enemy);
    }
    
    handlePlayerDeath(enemy) {
        if (!this.player.alive) return;
        
        this.player.alive = false;
        
        // Start death sequence
        this.effects.startDeathSequence(this.player.x, this.player.y);
        this.audio.playDeath();
        
        // Spawn player explosion
        this.effects.spawnExplosion(
            this.player.x, this.player.y,
            CONFIG.COLORS.PLAYER, 40, 10
        );
    }
    
    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Apply screen shake
        ctx.save();
        this.effects.applyShake(ctx);
        
        // Clear with motion trail (slight alpha)
        ctx.fillStyle = `rgba(10, 10, 26, ${1 - CONFIG.MOTION_TRAIL_ALPHA})`;
        ctx.fillRect(0, 0, width, height);
        
        // Background gradient
        const bgGradient = ctx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, Math.max(width, height) * 0.7
        );
        bgGradient.addColorStop(0, 'rgba(10, 22, 40, 0.3)');
        bgGradient.addColorStop(1, 'rgba(10, 10, 26, 0.3)');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
        
        // Render environment (background layer)
        this.environment.render(ctx);
        
        // Render effects (particles, etc.)
        this.effects.render(ctx);
        
        // Render enemies
        this.enemies.render(ctx);
        
        // Render weapons (bullets)
        this.weapons.render(ctx, this.player.overdrive);
        
        // Render player
        this.player.render(ctx);
        
        // Restore before overlay (shake should not affect overlay)
        ctx.restore();
        
        // Render overlay effects (vignette, death wipe)
        this.effects.renderOverlay(ctx);
        
        // Render minimal HUD
        this.renderHUD(ctx);
        
        // Render start prompt if waiting
        if (this.waitingForStart) {
            this.renderStartPrompt(ctx);
        }
    }
    
    renderHUD(ctx) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Time survived (bottom left, subtle)
        ctx.font = '14px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign = 'left';
        ctx.fillText(
            `${this.timeSurvived.toFixed(1)}s`,
            20, height - 20
        );
        
        // Peak overdrive indicator (bottom right, very subtle)
        if (this.peakOverdrive > 0) {
            const overdriveAlpha = 0.2 + (this.player.overdrive / 100) * 0.4;
            ctx.fillStyle = `rgba(255, 100, 255, ${overdriveAlpha})`;
            ctx.textAlign = 'right';
            ctx.fillText(
                `◈ ${Math.floor(this.player.overdrive)}`,
                width - 20, height - 20
            );
        }
    }
    
    renderStartPrompt(ctx) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Pulsing effect (no text per spec)
        const pulse = 0.5 + Math.sin(Date.now() * 0.003) * 0.3;
        
        // Draw a pulsing visual cue
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 30 + pulse * 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Inner circle
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 15, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse * 0.5})`;
        ctx.fill();
    }
}
