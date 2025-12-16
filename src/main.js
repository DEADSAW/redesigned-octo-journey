// Main Entry Point
import { Game } from './game.js';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Get or create canvas
    let canvas = document.getElementById('gameCanvas');
    
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'gameCanvas';
        document.body.appendChild(canvas);
    }
    
    // Create and start game
    const game = new Game(canvas);
});
