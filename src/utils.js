// Utility functions
import { CONFIG } from './config.js';

// Vector math utilities
export function vectorLength(vx, vy) {
    return Math.sqrt(vx * vx + vy * vy);
}

export function vectorNormalize(vx, vy) {
    const len = vectorLength(vx, vy);
    if (len === 0) return { x: 0, y: 0 };
    return { x: vx / len, y: vy / len };
}

export function vectorDistance(x1, y1, x2, y2) {
    return vectorLength(x2 - x1, y2 - y1);
}

export function vectorAngle(vx, vy) {
    return Math.atan2(vy, vx);
}

export function angleToVector(angle) {
    return { x: Math.cos(angle), y: Math.sin(angle) };
}

// Random utilities
export function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

export function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
}

export function randomChoice(array) {
    return array[randomInt(0, array.length - 1)];
}

// Clamping and interpolation
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
}

// Collision detection
export function circleCollision(x1, y1, r1, x2, y2, r2) {
    const dist = vectorDistance(x1, y1, x2, y2);
    return dist < r1 + r2;
}

export function pointInCircle(px, py, cx, cy, r) {
    return vectorDistance(px, py, cx, cy) < r;
}

// Screen utilities
export function isOffScreen(x, y, margin = 0, width, height) {
    return x < -margin || x > width + margin || 
           y < -margin || y > height + margin;
}

export function wrapPosition(x, y, width, height, margin = 0) {
    let newX = x;
    let newY = y;
    
    if (x < -margin) newX = width + margin;
    else if (x > width + margin) newX = -margin;
    
    if (y < -margin) newY = height + margin;
    else if (y > height + margin) newY = -margin;
    
    return { x: newX, y: newY };
}

// Object pooling helper
export class ObjectPool {
    constructor(createFn, resetFn, initialSize = 20) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
        this.active = [];
        
        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }
    
    get() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.createFn();
        }
        this.active.push(obj);
        return obj;
    }
    
    release(obj) {
        const index = this.active.indexOf(obj);
        if (index !== -1) {
            this.active.splice(index, 1);
            this.resetFn(obj);
            this.pool.push(obj);
        }
    }
    
    releaseAll() {
        while (this.active.length > 0) {
            const obj = this.active.pop();
            this.resetFn(obj);
            this.pool.push(obj);
        }
    }
    
    forEach(fn) {
        // Iterate backwards to safely handle removals
        for (let i = this.active.length - 1; i >= 0; i--) {
            fn(this.active[i], i);
        }
    }
    
    get count() {
        return this.active.length;
    }
}

// Delta time management
export class DeltaTime {
    constructor() {
        this.lastTime = performance.now();
        this.deltaTime = 0;
        this.maxDelta = 100; // Cap at 100ms to prevent huge jumps
    }
    
    update() {
        const currentTime = performance.now();
        this.deltaTime = Math.min(currentTime - this.lastTime, this.maxDelta);
        this.lastTime = currentTime;
        return this.deltaTime;
    }
    
    get dt() {
        return this.deltaTime / (1000 / CONFIG.FPS_TARGET);
    }
}

// Input state management
export class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touch = { active: false, x: 0, y: 0 };
        
        this.setupListeners();
    }
    
    setupListeners() {
        // Keyboard
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            e.preventDefault();
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // Mouse
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        window.addEventListener('mousedown', () => {
            this.mouse.down = true;
        });
        
        window.addEventListener('mouseup', () => {
            this.mouse.down = false;
        });
        
        // Touch
        window.addEventListener('touchstart', (e) => {
            this.touch.active = true;
            this.touch.x = e.touches[0].clientX;
            this.touch.y = e.touches[0].clientY;
            e.preventDefault();
        });
        
        window.addEventListener('touchmove', (e) => {
            if (this.touch.active) {
                this.touch.x = e.touches[0].clientX;
                this.touch.y = e.touches[0].clientY;
            }
            e.preventDefault();
        });
        
        window.addEventListener('touchend', () => {
            this.touch.active = false;
        });
    }
    
    isKeyDown(code) {
        return !!this.keys[code];
    }
    
    getMovementVector() {
        let vx = 0;
        let vy = 0;
        
        // WASD and Arrow keys
        if (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp')) vy -= 1;
        if (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown')) vy += 1;
        if (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft')) vx -= 1;
        if (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')) vx += 1;
        
        // Normalize diagonal movement
        const len = vectorLength(vx, vy);
        if (len > 0) {
            vx /= len;
            vy /= len;
        }
        
        return { x: vx, y: vy };
    }
}

// Easing functions
export const Easing = {
    linear: t => t,
    easeInQuad: t => t * t,
    easeOutQuad: t => t * (2 - t),
    easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeOutElastic: t => {
        const p = 0.3;
        return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    }
};
