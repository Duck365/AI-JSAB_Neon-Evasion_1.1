const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const timerDisplay = document.getElementById('timer-display');
const timerMaxDisplay = document.getElementById('timer-max');
const hpDisplay = document.getElementById('hp-display');

// Global Game State
let gameActive = false;
let isPaused = false;
let animationId;
let gameTime = 0;
let lastTime = 0;
let currentMode = 'full';
let practicePhase = '1';
let currentPhase = '1';
let difficulty = 'Normal';
let maxHp = 8;
let magneticTimer = 0;
let magneticMaxTime = 0;

// Entities
let players = [];
let bullets = [];
let particles = [];

// Settings
const SCREEN_WIDTH = window.innerWidth;
const SCREEN_HEIGHT = window.innerHeight;
canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;

const p1ColorText = document.getElementById('p1-color-text');
const p2ColorText = document.getElementById('p2-color-text');
let colors = {
    p1: '#00FFFF',
    p2: '#FF0000'
};

const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    w: false, a: false, s: false, d: false,
    Space: false, Slash: false, ShiftRight: false,
    q: false, f: false, ShiftLeft: false
};

// UI Functions
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function setupMode(mode, phase = '1') {
    currentMode = mode;
    if (mode === 'practice') {
        practicePhase = phase;
    }
}

function goBackFromDifficulty() {
    if (currentMode === 'practice') showScreen('practice-phase-screen');
    else if (currentMode === 'multiplayer' || currentMode === 'magnetic') showScreen('special-screen');
    else if (currentMode === 'invisible' || currentMode === 'bullet-colored') showScreen('challenges-screen');
    else showScreen('menu-screen');
}

function toggleCustomHp() {
    const container = document.getElementById('custom-hp-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
}

function handleCustomHpInput() {
    const input = document.getElementById('custom-hp-input').value;
    document.getElementById('custom-hp-btn').disabled = !input || input < 1;
}

function startCustomGame() {
    const hp = parseInt(document.getElementById('custom-hp-input').value);
    startGame(hp, `Custom (${hp} HP)`);
}

function setPlayerColor(playerNum, color) {
    colors[`p${playerNum}`] = color;
    document.getElementById(`p${playerNum}-color-text`).innerText = color;
    document.getElementById(`p${playerNum}-color-text`).style.color = color;
}

function startMagneticMode(time) {
    currentMode = 'magnetic';
    magneticMaxTime = time;
    startGame(1, 'Hardcore'); // Magnetic is usually 1 hit
}

// Game Initialization
function startGame(hp, diffName) {
    maxHp = hp === 'Debug' ? 999999 : hp;
    difficulty = diffName;
    gameActive = true;
    isPaused = false;
    gameTime = 0;
    bullets = [];
    particles = [];
    currentPhase = currentMode === 'practice' ? practicePhase : '1.1';
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    canvas.style.display = 'block';
    hud.style.display = 'flex';
    
    initPlayers();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function initPlayers() {
    players = [];
    players.push(new Player(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 100, colors.p1, 1, maxHp));
    
    if (currentMode === 'multiplayer' || currentMode === 'magnetic') {
        players[0].x -= 50;
        players.push(new Player(SCREEN_WIDTH / 2 + 50, SCREEN_HEIGHT / 2 + 100, colors.p2, 2, maxHp));
        if (currentMode === 'magnetic') magneticTimer = magneticMaxTime;
    }
}

// Player Class
class Player {
    constructor(x, y, color, id, hp) {
        this.x = x;
        this.y = y;
        this.size = 10;
        this.color = color;
        this.id = id;
        this.hp = hp;
        this.speed = 5;
        this.isDashing = false;
        this.dashCooldown = 0;
        this.invulnTimer = 0;
        this.hitsTaken = 0;
    }

    update(dt) {
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        let dx = 0, dy = 0;
        
        if (this.id === 1) {
            if (keys.ArrowUp) dy -= 1;
            if (keys.ArrowDown) dy += 1;
            if (keys.ArrowLeft) dx -= 1;
            if (keys.ArrowRight) dx += 1;
            
            if ((keys.Space || keys.Slash || keys.ShiftRight) && this.dashCooldown <= 0) {
                this.dash(dx, dy);
            }
        } else {
            if (keys.w) dy -= 1;
            if (keys.s) dy += 1;
            if (keys.a) dx -= 1;
            if (keys.d) dx += 1;
            
            if ((keys.q || keys.f || keys.ShiftLeft) && this.dashCooldown <= 0) {
                this.dash(dx, dy);
            }
        }

        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length; dy /= length;
        }

        this.x += dx * this.speed;
        this.y += dy * this.speed;

        this.x = Math.max(this.size, Math.min(SCREEN_WIDTH - this.size, this.x));
        this.y = Math.max(this.size, Math.min(SCREEN_HEIGHT - this.size, this.y));
    }

    dash(dx, dy) {
        if (dx === 0 && dy === 0) return;
        this.x += dx * 100;
        this.y += dy * 100;
        this.dashCooldown = 1.0;
        this.invulnTimer = 0.2;
        createParticles(this.x, this.y, this.color, 10);
    }

    draw(ctx) {
        if (currentMode === 'invisible' && this.invulnTimer <= 0) return;
        
        ctx.fillStyle = this.invulnTimer > 0 ? '#FFFFFF' : this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    takeDamage() {
        if (this.invulnTimer > 0 || difficulty === 'Debug') return;
        this.hp--;
        this.hitsTaken++;
        this.invulnTimer = 1.0;
        createParticles(this.x, this.y, '#FFFFFF', 20);
        if (this.hp <= 0) checkGameOver();
    }
}

// Bullet Class
class Bullet {
    constructor(x, y, vx, vy, radius, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = radius;
        this.color = currentMode === 'bullet-colored' ? '#FFFFFF' : color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1.0,
            color: color
        });
    }
}

// Phase Spawners
let phaseTimer = 0;

function handlePhases(dt) {
    phaseTimer += dt;
    
    // NEW COMBINED 1.1: Simple targets + Spread bullets
    if (currentPhase === '1.1') {
        if (phaseTimer > 0.4) {
            phaseTimer = 0;
            // Target
            const p = players[Math.floor(Math.random() * players.length)];
            const angle = Math.atan2(p.y - 0, p.x - SCREEN_WIDTH/2);
            bullets.push(new Bullet(SCREEN_WIDTH/2, 0, Math.cos(angle)*4, Math.sin(angle)*4, 6, '#FF00FF'));
            
            // Spread
            for(let i=0; i<3; i++) {
                bullets.push(new Bullet(Math.random()*SCREEN_WIDTH, 0, 0, 3, 5, '#00FFFF'));
            }
        }
        if (gameTime > 15 && currentMode !== 'practice') changePhase('1.2');
    }
    
    // NEW 1.2: Hard/Tight with same bullets (Corridors & Grids)
    if (currentPhase === '1.2') {
        if (phaseTimer > 0.8) { // Slower fire rate but massive walls
            phaseTimer = 0;
            const gapX = players[0].x; // Target gap at player 1
            
            // Tight horizontal wall dropping down
            for(let x=0; x<SCREEN_WIDTH; x+=30) {
                if (Math.abs(x - gapX) > 60) { // Only 120px safe zone
                    bullets.push(new Bullet(x, 0, 0, 5, 6, '#FF00FF'));
                }
            }
            
            // Fast cross-fire
            const sideY = players[0].y;
            bullets.push(new Bullet(0, sideY, 7, 0, 5, '#00FFFF'));
            bullets.push(new Bullet(SCREEN_WIDTH, sideY+30, -7, 0, 5, '#00FFFF'));
        }
        if (gameTime > 30 && currentMode !== 'practice') changePhase('1.3'); // Example transition
    }

    // Default filler for other phases just to prevent crashing
    if (!['1.1', '1.2'].includes(currentPhase)) {
         if (phaseTimer > 0.5) {
             phaseTimer = 0;
             bullets.push(new Bullet(Math.random()*SCREEN_WIDTH, 0, 0, 4, 8, '#FFFF00'));
         }
    }
}

function changePhase(newPhase) {
    currentPhase = newPhase;
    phaseTimer = 0;
}

// Game Loop
function gameLoop(timestamp) {
    if (!gameActive) return;
    
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (!isPaused) {
        gameTime += dt;
        update(dt);
        draw();
    }

    animationId = requestAnimationFrame(gameLoop);
}

function update(dt) {
    players.forEach(p => p.update(dt));
    handlePhases(dt);

    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.update();
        
        if (b.x < -50 || b.x > SCREEN_WIDTH + 50 || b.y < -50 || b.y > SCREEN_HEIGHT + 50) {
            bullets.splice(i, 1);
            continue;
        }

        players.forEach(p => {
            const dist = Math.hypot(p.x - b.x, p.y - b.y);
            if (dist < p.size + b.radius) p.takeDamage();
        });
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= dt * 2;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // HUD Update
    timerDisplay.innerText = Math.floor(gameTime);
    hpDisplay.innerText = players.map(p => p.hp).join(' | ');

    if (currentMode === 'magnetic') {
        magneticTimer -= dt * 60; // frames roughly
        const dist = Math.hypot(players[0].x - players[1].x, players[0].y - players[1].y);
        if (dist < players[0].size * 2) {
            magneticTimer = magneticMaxTime; // Reset if touching
        } else if (magneticTimer <= 0) {
            players[0].takeDamage();
            players[1].takeDamage();
            magneticTimer = magneticMaxTime;
        }
        timerMaxDisplay.innerText = ` / Mag: ${Math.floor(magneticTimer)}`;
    } else {
        timerMaxDisplay.innerText = '';
    }
}

function draw() {
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1.0;
    
    bullets.forEach(b => b.draw(ctx));
    players.forEach(p => p.draw(ctx));
}

function checkGameOver() {
    gameActive = false;
    canvas.style.display = 'none';
    hud.style.display = 'none';
    
    if (currentMode === 'practice') {
        document.getElementById('practice-failed-mode').innerText = `Phase ${practicePhase}, ${difficulty}`;
        showScreen('practice-failed-screen');
    } else {
        document.getElementById('death-stats-mode').innerText = `${currentMode === 'full' ? 'Full Fight' : currentMode}, ${difficulty}`;
        document.getElementById('survival-time').innerText = Math.floor(gameTime);
        showScreen('game-over-screen');
    }
}

function retryPractice() {
    startGame(maxHp, difficulty);
}

function resumeGame() {
    isPaused = false;
    showScreen(''); // Hide screens, resume canvas
    lastTime = performance.now();
}

function quitToMenu() {
    gameActive = false;
    canvas.style.display = 'none';
    hud.style.display = 'none';
    showScreen('menu-screen');
}

// Input Handling
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code) || keys.hasOwnProperty(e.key)) {
        if (e.code === 'Space') keys.Space = true;
        if (e.code === 'Slash') keys.Slash = true;
        if (e.code === 'ShiftRight') keys.ShiftRight = true;
        if (e.code === 'ShiftLeft') keys.ShiftLeft = true;
        if (e.key === 'q' || e.key === 'Q') keys.q = true;
        if (e.key === 'f' || e.key === 'F') keys.f = true;
        keys[e.key] = true;
    }
    if (e.key === 'p' || e.key === 'P') {
        if (gameActive && !isPaused) {
            isPaused = true;
            showScreen('pause-screen');
        } else if (gameActive && isPaused) {
            resumeGame();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code) || keys.hasOwnProperty(e.key)) {
        if (e.code === 'Space') keys.Space = false;
        if (e.code === 'Slash') keys.Slash = false;
        if (e.code === 'ShiftRight') keys.ShiftRight = false;
        if (e.code === 'ShiftLeft') keys.ShiftLeft = false;
        if (e.key === 'q' || e.key === 'Q') keys.q = false;
        if (e.key === 'f' || e.key === 'F') keys.f = false;
        keys[e.key] = false;
    }
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
