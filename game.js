/**
 * ==============================================================================
 * NEON EVASION - ENGINE & ATTACK SCRIPT
 * ==============================================================================
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let animationId;
let gameActive = false;
let isPaused = false;
let frameCount = 0;
let projectiles = [];
let warnings = [];
let player1Color = '#00FFFF'; // Default Cyan
let player2Color = '#FF0000'; // Default Red

// Magnetic Mode State Variables
let magneticTimeLimit = 0;
let magneticTimer = 0;
let magneticHits = 0;
let isMagneticMode = false;

// Time tracking
let startTime;
let pauseStartTime = 0;
let totalPausedTime = 0;

let currentDifficulty = '';
let gameMode = 'full'; 
let challengeMode = 'none'; // 'none', 'invisible', 'bullet-colored'
let selectedPracticePhase = '1';
let currentHpSetting = 5;

// Input tracking
const keys = {};

// Player Objects
const p1 = {
    x: 0, y: 0, size: 20, speed: 6.5, health: 5,
    dashCooldown: 0, maxDashCooldown: 40, dashDistance: 180, isInvulnerable: 0,
    hitsTaken: 0, active: true, color: '#00FFFF' 
};

const p2 = {
    x: 0, y: 0, size: 20, speed: 6.5, health: 5,
    dashCooldown: 0, maxDashCooldown: 40, dashDistance: 180, isInvulnerable: 0,
    hitsTaken: 0, active: false, color: '#FF0000' 
};

const PHASE_FRAMES = {
    '1': 0, '1.1': 0, '1.2': 740, '1.3': 1560,
    '2': 2700, '2.1': 2700, '2.2': 3600, '2.3': 4500,
    '3': 5700, '3.1': 5700, '3.2': 6800, '3.3': 7900
};

const TOTAL_GAME_FRAMES = 9000;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    let target = document.getElementById(screenId);
    if (target) target.classList.add('active');
    canvas.style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('color-error-msg').style.display = 'none'; // Reset color error message
}

function setPlayerColor(playerNum, color) {
    let errorMsg = document.getElementById('color-error-msg');
    errorMsg.style.display = 'none';

    if (playerNum === 1) {
        if (color === player2Color) {
            errorMsg.style.display = 'block';
            return;
        }
        player1Color = color;
        document.getElementById('p1-color-text').textContent = color;
        document.getElementById('p1-color-text').style.color = color;
    } else {
        if (color === player1Color) {
            errorMsg.style.display = 'block';
            return;
        }
        player2Color = color;
        document.getElementById('p2-color-text').textContent = color;
        document.getElementById('p2-color-text').style.color = color;
    }
}

function setupMode(mode, phase = '1') {
    gameMode = mode;
    isMagneticMode = false;
    if (mode === 'practice') selectedPracticePhase = phase;
    
    challengeMode = 'none';
    if (mode === 'invisible') {
        gameMode = 'full';
        challengeMode = 'invisible';
    } else if (mode === 'bullet-colored') {
        gameMode = 'full';
        challengeMode = 'bullet-colored';
    }

    if (mode === 'multiplayer' || isMagneticMode) {
        p2.active = true;
    } else {
        p2.active = false;
    }
}

function startMagneticMode(limit) {
    gameMode = 'multiplayer';
    isMagneticMode = true;
    magneticTimeLimit = limit;
    p2.active = true;
    showScreen('difficulty-screen');
}

function toggleCustomHp() {
    let container = document.getElementById('custom-hp-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
    handleCustomHpInput();
}

function handleCustomHpInput() {
    let val = parseInt(document.getElementById('custom-hp-input').value);
    let btn = document.getElementById('custom-hp-btn');
    if (val && val > 0) {
        btn.disabled = false;
        currentHpSetting = val;
    } else {
        btn.disabled = true;
    }
}

function startCustomGame() {
    startGame(currentHpSetting, 'Custom (' + currentHpSetting + ')');
}

function goBackFromDifficulty() {
    document.getElementById('custom-hp-container').style.display = 'none';
    if (isMagneticMode) showScreen('magnetic-screen');
    else if (gameMode === 'multiplayer') showScreen('special-screen');
    else if (challengeMode !== 'none') showScreen('challenges-screen');
    else if (gameMode === 'practice') showScreen('practice-phase-screen');
    else showScreen('menu-screen');
}

function startGame(hp, diffName) {
    currentDifficulty = diffName;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    canvas.style.display = 'block';
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('debug-hits-display').style.display = 'none';

    // Apply colors
    p1.color = player1Color;
    p2.color = player2Color;

    p1.health = hp;
    p1.hitsTaken = 0;
    p2.health = hp;
    p2.hitsTaken = 0;

    magneticHits = 0;
    magneticTimer = magneticTimeLimit;

    if (hp === 'Debug') {
        p1.health = 9999;
        p2.health = 9999;
    }

    resetGameVariables();
    updateHUD();

    if (gameMode === 'practice') {
        frameCount = PHASE_FRAMES[selectedPracticePhase] || 0;
    }

    // Set Max Timer Dynamically
    let maxTimerSpan = document.getElementById('timer-max');
    if (gameMode === 'full' || gameMode === 'multiplayer') {
        maxTimerSpan.textContent = ' / ' + Math.floor(TOTAL_GAME_FRAMES / 60);
    } else if (gameMode === 'practice') {
        let maxFrames = TOTAL_GAME_FRAMES; // Default if phase 3
        if (selectedPracticePhase.startsWith('1')) maxFrames = PHASE_FRAMES['2'];
        if (selectedPracticePhase.startsWith('2')) maxFrames = PHASE_FRAMES['3'];
        maxTimerSpan.textContent = ' / ' + Math.floor((maxFrames - frameCount) / 60);
    }

    gameActive = true;
    isPaused = false;
    startTime = Date.now();
    totalPausedTime = 0;
    requestAnimationFrame(gameLoop);
}

function resetGameVariables() {
    if (p2.active) {
        p1.x = canvas.width / 2 - 50;
        p2.x = canvas.width / 2 + 50;
    } else {
        p1.x = canvas.width / 2;
    }
    p1.y = canvas.height / 2;
    p2.y = canvas.height / 2;
    
    p1.dashCooldown = 0; p1.isInvulnerable = 0;
    p2.dashCooldown = 0; p2.isInvulnerable = 0;

    projectiles = [];
    warnings = [];
    frameCount = 0;
}

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key.toLowerCase() === 'p' && gameActive) togglePause();
    
    if (gameActive && !isPaused) {
        // P1 Dash
        if ((e.key === ' ' || e.key === '/' || e.code === 'ShiftRight') && p1.dashCooldown <= 0 && p1.active) executeDash(p1, getP1Input());
        // P2 Dash
        if ((e.key.toLowerCase() === 'q' || e.key.toLowerCase() === 'f' || e.code === 'ShiftLeft') && p2.dashCooldown <= 0 && p2.active) executeDash(p2, getP2Input());
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

function getP1Input() {
    let dx = 0, dy = 0;
    if (keys['ArrowUp']) dy -= 1;
    if (keys['ArrowDown']) dy += 1;
    if (keys['ArrowLeft']) dx -= 1;
    if (keys['ArrowRight']) dx += 1;
    if (!p2.active) {
        if (keys['w'] || keys['W']) dy -= 1;
        if (keys['s'] || keys['S']) dy += 1;
        if (keys['a'] || keys['A']) dx -= 1;
        if (keys['d'] || keys['D']) dx += 1;
    }
    return { dx, dy };
}

function getP2Input() {
    let dx = 0, dy = 0;
    if (keys['w'] || keys['W']) dy -= 1;
    if (keys['s'] || keys['S']) dy += 1;
    if (keys['a'] || keys['A']) dx -= 1;
    if (keys['d'] || keys['D']) dx += 1;
    return { dx, dy };
}

function executeDash(player, input) {
    if (input.dx === 0 && input.dy === 0) return;
    const mag = Math.hypot(input.dx, input.dy);
    const dashX = (input.dx / mag) * player.dashDistance;
    const dashY = (input.dy / mag) * player.dashDistance;
    
    player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x + dashX));
    player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y + dashY));
    
    player.dashCooldown = player.maxDashCooldown;
    player.isInvulnerable = 10;
}

function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        pauseStartTime = Date.now();
        document.getElementById('pause-screen').classList.add('active');
    } else {
        resumeGame();
    }
}

function resumeGame() {
    isPaused = false;
    document.getElementById('pause-screen').classList.remove('active');
    totalPausedTime += Date.now() - pauseStartTime;
    requestAnimationFrame(gameLoop);
}

function quitToMenu() {
    gameActive = false;
    isPaused = false;
    document.getElementById('pause-screen').classList.remove('active');
    showScreen('menu-screen');
}

function checkPlayerCollision(p, proj) {
    const dist = Math.hypot(p.x - proj.x, p.y - proj.y);
    return dist < p.size + proj.size;
}

function handleDamage(p) {
    p.health--;
    p.hitsTaken++;
    p.isInvulnerable = 30;
    updateHUD();

    if (currentDifficulty !== 'Debug') {
        if (!p2.active && p1.health <= 0) gameOver();
        else if (p2.active && (p1.health <= 0 || p2.health <= 0)) gameOver();
    }
}

function gameOver() {
    gameActive = false;
    const timeAlive = Math.floor((Date.now() - startTime - totalPausedTime) / 1000);
    document.getElementById('survival-time').textContent = timeAlive;
    
    let modeText = "Full Fight";
    if (gameMode === 'practice') modeText = `Practice Phase ${selectedPracticePhase}`;
    if (gameMode === 'multiplayer') modeText = isMagneticMode ? "Magnetic Mode" : "Multiplayer";
    if (challengeMode !== 'none') modeText = challengeMode.toUpperCase();

    document.getElementById('death-stats-mode').textContent = `${modeText} - ${currentDifficulty}`;
    showScreen('game-over-screen');
}

function gameWon() {
    gameActive = false;
    document.getElementById('victory-title').textContent = gameMode === 'practice' ? "PHASE CLEARED" : "FULL FIGHT CLEARED";
    
    let modeText = "Full Fight";
    if (gameMode === 'practice') modeText = `Practice Phase ${selectedPracticePhase}`;
    if (gameMode === 'multiplayer') modeText = isMagneticMode ? "Magnetic Mode" : "Multiplayer";
    if (challengeMode !== 'none') modeText = challengeMode.toUpperCase();

    document.getElementById('victory-stats-mode').textContent = `${modeText} - ${currentDifficulty}`;

    if (currentDifficulty === 'Debug') {
        let debugText = document.getElementById('debug-hits-display');
        debugText.style.display = 'block';
        let hitsStr = p1.hitsTaken;
        if (p2.active) hitsStr = `P1: ${p1.hitsTaken} | P2: ${p2.hitsTaken}`;
        if (isMagneticMode) hitsStr += ` | Mag Hits: ${magneticHits}`;
        document.getElementById('final-hits').textContent = hitsStr;
    }

    showScreen('victory-screen');
}

function updateHUD() {
    let hpStr = p1.health;
    if (p2.active) hpStr = `P1: ${p1.health}  P2: ${p2.health}`;
    if (currentDifficulty === 'Debug') {
        hpStr = `P1 Hits: ${p1.hitsTaken}`;
        if (p2.active) hpStr += ` | P2 Hits: ${p2.hitsTaken}`;
        if (isMagneticMode) hpStr += ` | Mag Hits: ${magneticHits}`;
    }
    document.getElementById('hp-display').textContent = hpStr;
}

function updateTimer() {
    let currentTimerSecs = 0;
    if (gameMode === 'full' || gameMode === 'multiplayer') {
        currentTimerSecs = Math.floor(frameCount / 60);
    } else if (gameMode === 'practice') {
        let baseFrames = PHASE_FRAMES[selectedPracticePhase];
        currentTimerSecs = Math.floor((frameCount - baseFrames) / 60);
    }
    document.getElementById('timer-display').textContent = currentTimerSecs;
}

function retryPractice() {
    showScreen('difficulty-screen');
}

function handleMagneticMode() {
    if (!isMagneticMode || !p2.active) return;
    
    magneticTimer--;
    
    if (magneticTimer <= 0) {
        magneticHits++;
        p1.health--;
        p1.hitsTaken++;
        p2.health--;
        p2.hitsTaken++;
        
        magneticTimer = magneticTimeLimit;
        
        ctx.fillStyle = "rgba(255, 0, 255, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        updateHUD();
        
        if (currentDifficulty !== 'Debug' && (p1.health <= 0 || p2.health <= 0)) {
            gameOver();
            return;
        }
    }

    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    if (dist < p1.size + p2.size) {
        magneticTimer = magneticTimeLimit;
        ctx.strokeStyle = "rgba(0, 255, 0, 0.8)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.size + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p2.x, p2.y, p2.size + 15, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function renderPlayer(p, isP1) {
    if (!p.active) return;
    ctx.globalAlpha = p.isInvulnerable > 0 ? (Math.floor(Date.now() / 100) % 2 === 0 ? 0.5 : 1) : 1;
    if (challengeMode === 'invisible' && p.isInvulnerable <= 0) {
        ctx.globalAlpha = 0.05;
    }
    
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Draw magnetic timer circle if applicable
    if (isMagneticMode && isP1) {
        let progress = magneticTimer / magneticTimeLimit;
        ctx.strokeStyle = `rgba(255, ${255 * progress}, 0, 0.7)`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + 10, -Math.PI/2, (-Math.PI/2) + (Math.PI * 2 * progress));
        ctx.stroke();
    }
}

function movePlayer(p, input) {
    if (!p.active) return;
    
    let speed = p.speed;
    if (input.dx !== 0 && input.dy !== 0) speed *= 0.707;
    
    p.x += input.dx * speed;
    p.y += input.dy * speed;
    
    p.x = Math.max(p.size, Math.min(canvas.width - p.size, p.x));
    p.y = Math.max(p.size, Math.min(canvas.height - p.size, p.y));

    if (p.dashCooldown > 0) p.dashCooldown--;
    if (p.isInvulnerable > 0) p.isInvulnerable--;
}

function gameLoop() {
    if (!gameActive) return;
    if (isPaused) return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateTimer();

    movePlayer(p1, getP1Input());
    movePlayer(p2, getP2Input());
    
    handleMagneticMode();

    spawnAttacks(frameCount);

    // Update Warnings
    for (let i = warnings.length - 1; i >= 0; i--) {
        let w = warnings[i];
        w.timer--;
        
        ctx.globalAlpha = 0.5 + Math.sin(frameCount * 0.2) * 0.3;
        ctx.fillStyle = 'red';
        if (w.type === 'rect') ctx.fillRect(w.x, w.y, w.w, w.h);
        if (w.type === 'circle') {
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (w.timer <= 0) warnings.splice(i, 1);
    }

    // Update Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.accel) { p.vx *= p.accel; p.vy *= p.accel; }

        ctx.fillStyle = challengeMode === 'bullet-colored' ? p1.color : p.color;
        
        ctx.beginPath();
        if (p.type === 'rect') ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
        else ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p1.active && p1.isInvulnerable <= 0 && checkPlayerCollision(p1, p)) handleDamage(p1);
        if (p2.active && p2.isInvulnerable <= 0 && checkPlayerCollision(p2, p)) handleDamage(p2);

        if (p.x < -200 || p.x > canvas.width + 200 || p.y < -200 || p.y > canvas.height + 200) {
            projectiles.splice(i, 1);
        }
    }

    renderPlayer(p1, true);
    renderPlayer(p2, false);

    checkWinCondition(frameCount);

    frameCount++;
    animationId = requestAnimationFrame(gameLoop);
}

// ----------------------------------------------------------------------
// ATTACK LOGIC HELPERS
// ----------------------------------------------------------------------

function warnRect(x, y, w, h, time) { warnings.push({ type: 'rect', x, y, w, h, timer: time }); }
function warnCircle(x, y, r, time) { warnings.push({ type: 'circle', x, y, r, timer: time }); }

function spawnBullet(x, y, vx, vy, size = 8, color = 'white', type = 'circle') {
    projectiles.push({ x, y, vx, vy, size, color, type });
}

function spawnTargeted(x, y, speed, targetPlayer, color = 'red', size = 8) {
    if (!targetPlayer) targetPlayer = p1;
    const angle = Math.atan2(targetPlayer.y - y, targetPlayer.x - x);
    spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, size, color);
}

function spawnRing(x, y, count, speed, offsetAngle = 0, color = 'yellow') {
    for (let i = 0; i < count; i++) {
        const angle = offsetAngle + (Math.PI * 2 * (i / count));
        spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 8, color);
    }
}

// ----------------------------------------------------------------------
// TIMELINE (T) BASED ATTACKS
// ----------------------------------------------------------------------

function spawnAttacks(t) {
    
    // --- PHASE 1 (0 - 2700) ---
    if (t >= 0 && t < 2700) {
        
        // 1.1 Intro Streams
        if (t > 120 && t < 700 && t % 15 === 0) {
            spawnTargeted(canvas.width/2, 0, 4, p1, 'yellow', 10);
            if (p2.active) spawnTargeted(canvas.width/2, 0, 4, p2, 'cyan', 10);
        }

        // 1.2 Side Lasers
        if (t >= 740 && t < 1500) {
            if (t % 120 === 0) warnRect(0, p1.y - 20, canvas.width, 40, 60);
            if (t % 120 === 60) {
                for (let i = 0; i < canvas.width; i+=40) spawnBullet(i, p1.y, 0, 0, 15, 'red', 'rect'); 
                // Quick fake laser logic - they vanish immediately if speed 0? Let's give them slight vx to exist
                for (let i = 0; i < canvas.width; i+=40) spawnBullet(i, p1.y, 10, 0, 15, 'red', 'rect');
            }
        }

        // 1.3 Burst Rings
        if (t >= 1560 && t < 2600 && t % 90 === 0) {
            spawnRing(canvas.width/2, canvas.height/2, 16, 5, t * 0.01, 'orange');
        }
    }

    // --- PHASE 2 (2700 - 5700) ---
    if (t >= 2700 && t < 5700) {
        
        // 2.1 Crossing Walls
        if (t > 2700 && t < 3500 && t % 120 === 0) {
            for(let i = 0; i < canvas.width; i+=60) spawnBullet(i, 0, 0, 4, 12, 'blue');
            for(let j = 0; j < canvas.height; j+=60) spawnBullet(0, j, 4, 0, 12, 'blue');
        }

        // 2.2 Dual Target
        if (t > 3600 && t < 4400 && t % 10 === 0) {
            spawnTargeted(0, 0, 6, p1, 'purple', 8);
            spawnTargeted(canvas.width, canvas.height, 6, p1, 'purple', 8);
        }

        // 2.3 Spinners
        if (t > 4500 && t < 5600 && t % 20 === 0) {
            let cx = canvas.width/2; let cy = canvas.height/2;
            let a1 = t * 0.05; let a2 = -t * 0.05;
            spawnBullet(cx, cy, Math.cos(a1)*7, Math.sin(a1)*7, 10, 'white');
            spawnBullet(cx, cy, Math.cos(a2)*7, Math.sin(a2)*7, 10, 'white');
        }
    }

    // --- PHASE 3 (5700 - 9000) ---
    if (t >= 5700 && t < 9000) {
        
        // 3.1 Bullet Hell Chaos
        if (t > 5700 && t < 6700 && t % 5 === 0) {
            spawnBullet(Math.random()*canvas.width, 0, (Math.random()-0.5)*2, 5 + Math.random()*3, 6, 'red');
        }

        // 3.2 Targeted Rings
        if (t > 6800 && t < 7800 && t % 60 === 0) {
            spawnRing(p1.x, p1.y - 300, 12, 6, 0, 'magenta');
        }

        // 3.3 Final Squeeze
        if (t > 7900 && t < 8900 && t % 8 === 0) {
            spawnBullet(0, p1.y, 8, 0, 10, 'yellow');
            spawnBullet(canvas.width, p1.y, -8, 0, 10, 'yellow');
            if (p2.active) {
                spawnBullet(0, p2.y, 8, 0, 10, 'cyan');
                spawnBullet(canvas.width, p2.y, -8, 0, 10, 'cyan');
            }
        }
    }
}

function checkWinCondition(t) {
    if (gameMode === 'practice') {
        let maxT = TOTAL_GAME_FRAMES;
        if (selectedPracticePhase.startsWith('1')) maxT = PHASE_FRAMES['2'];
        if (selectedPracticePhase.startsWith('2')) maxT = PHASE_FRAMES['3'];
        
        if (t >= maxT) gameWon();
    } else {
        if (t === TOTAL_GAME_FRAMES) gameWon();
    }
}
