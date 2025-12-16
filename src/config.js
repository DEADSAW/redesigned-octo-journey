// Game Configuration - All tuning values in one place
export const CONFIG = {
    // Display
    FPS_TARGET: 60,
    MOTION_TRAIL_ALPHA: 0.15,
    
    // Player
    PLAYER: {
        SIZE: 20,
        ACCELERATION: 0.4,
        MAX_SPEED: 8,
        FRICTION: 0.98,
        MIN_VELOCITY_THRESHOLD: 0.5,
        DANGER_STATE_TIME: 1500, // ms
        INITIAL_X_OFFSET: 0.2, // fraction of screen width
        INITIAL_Y_OFFSET: 0.5  // fraction of screen height
    },
    
    // Overdrive System
    OVERDRIVE: {
        MAX: 100,
        DECAY_RATE: 0.1, // per frame
        GRAZE_BONUS: 5,
        FIRE_RATE_MULTIPLIER: 2 // at max overdrive
    },
    
    // Weapons
    WEAPONS: {
        BASE_FIRE_RATE: 150, // ms
        BULLET_SPEED: 12,
        BULLET_SIZE: 4,
        
        // Weapon types based on play style
        FOCUSED: { spread: 0, count: 1, damage: 10 },
        CHAIN: { spread: 0.1, count: 3, damage: 6 },
        SPREAD: { spread: 0.4, count: 5, damage: 4 },
        SCATTER: { spread: 0.6, count: 7, damage: 2 }
    },
    
    // Enemies
    ENEMIES: {
        SPAWN_MARGIN: 100,
        MIN_SPAWN_DISTANCE: 150,
        
        // Base spawn rates (enemies per second)
        BASE_SPAWN_RATE: 0.5,
        MAX_SPAWN_RATE: 3,
        
        TYPES: {
            ASTEROID: {
                health: 20,
                speed: 2,
                size: 25,
                points: 10,
                grazeRadius: 50
            },
            SPLITTER: {
                health: 30,
                speed: 1.5,
                size: 35,
                points: 25,
                grazeRadius: 60,
                splitCount: 3
            },
            HUNTER: {
                health: 15,
                speed: 3,
                size: 20,
                points: 20,
                grazeRadius: 40,
                trackingStrength: 0.02
            },
            DRIFTER: {
                health: 25,
                speed: 1,
                size: 30,
                points: 15,
                grazeRadius: 55,
                waveAmplitude: 2,
                waveFrequency: 0.02
            },
            SHIELDED: {
                health: 60,
                speed: 1.5,
                size: 28,
                points: 40,
                grazeRadius: 50
            },
            MARTYR: {
                health: 10,
                speed: 2.5,
                size: 22,
                points: 30,
                grazeRadius: 45,
                explosionRadius: 80
            }
        }
    },
    
    // Environment
    ENVIRONMENT: {
        GRAVITY_WELL: {
            STRENGTH: 0.3,
            RADIUS: 150,
            SPAWN_CHANCE: 0.001 // per frame
        },
        SOLAR_WIND: {
            STRENGTH: 0.05,
            DIRECTION_CHANGE_MIN: 20000, // ms
            DIRECTION_CHANGE_MAX: 30000  // ms
        },
        DEBRIS_CLOUD: {
            VISIBILITY_REDUCTION: 0.3,
            SIZE: 200
        }
    },
    
    // Difficulty scaling (time in seconds)
    DIFFICULTY: {
        PHASE_1: 30,  // Few enemies
        PHASE_2: 60,  // Faster spawns
        PHASE_3: 90,  // Screen pressure
        // After PHASE_3: Maximum chaos
        SPAWN_MULTIPLIER_PHASE_2: 1.5,
        SPAWN_MULTIPLIER_PHASE_3: 2.5,
        SPAWN_MULTIPLIER_MAX: 4
    },
    
    // Visual Effects
    EFFECTS: {
        SCREEN_SHAKE: {
            INTENSITY_LIGHT: 2,
            INTENSITY_MEDIUM: 5,
            INTENSITY_HEAVY: 10,
            DECAY: 0.9
        },
        VIGNETTE: {
            BASE_INTENSITY: 0.2,
            MAX_INTENSITY: 0.6
        },
        DEATH: {
            FREEZE_DURATION: 100, // ms
            SLOWMO_DURATION: 400, // ms
            WIPE_DURATION: 300    // ms
        }
    },
    
    // Colors
    COLORS: {
        BACKGROUND: '#0a0a1a',
        BACKGROUND_GRADIENT: '#0a1628',
        PLAYER: '#00ffff',
        PLAYER_GLOW: '#00aaff',
        BULLET: '#ffffff',
        BULLET_GLOW: '#88ffff',
        ENEMY_BASE: '#ff4444',
        ENEMY_GLOW: '#ff8844',
        OVERDRIVE: '#ff00ff',
        GRAZE: '#ffff00'
    },
    
    // Audio
    AUDIO: {
        MASTER_VOLUME: 0.5,
        AMBIENT_VOLUME: 0.3,
        RHYTHM_VOLUME: 0.4,
        PERCUSSION_VOLUME: 0.3,
        BASS_VOLUME: 0.4
    }
};
