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

// Player Colors
let p1Color = '#00FFFF'; // Default Cyan
let p2Color = '#FF0000'; // Default Red

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

// Constants for Timing
const END_FRAMES = {
    PHASE1: 2400,
    PHASE2: 5400,
    FULL: 9000
};

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
}

function setPlayerColor(playerNum, color) {
    let errorMsg = document.getElementById('color-error-msg');
    
    if (playerNum === 1) {
        if (color === p2Color) {
            errorMsg.textContent = "Player 1 cannot pick the same color as Player 2!";
            return;
        }
        p1Color = color;
        document.getElementById('p1-color-header').style.color = color;
        errorMsg.textContent = "";
    } else if (playerNum === 2) {
        if (color === p1Color) {
            errorMsg.textContent = "Player 2 cannot pick the same color as Player 1!";
            return;
        }
        p2Color = color;
        document.getElementById('p2-color-header').style.color = color;
        errorMsg.textContent = "";
    }
}

function spawnProjectile(x, y, vx, vy, size, life = Infinity, isBouncy = false) {
    projectiles.push({ x, y, vx, vy, size, life, isBouncy });
}

function spawnWarning(x, y, vx, vy, size, delayTimer) {
    warnings.push({ x, y, vx, vy, size, timer: delayTimer, maxTimer: delayTimer });
}

function setupMode(mode, phase = '1') {
    isMagneticMode = false;
    if (mode === 'invisible' || mode === 'bullet-colored') {
        gameMode = 'full';
        challengeMode = mode;
    } else {
        gameMode = mode;
        challengeMode = 'none';
        if (mode === 'practice') selectedPracticePhase = phase;
    }
}

function startMagneticMode(frames) {
    let magneticScreen = document.getElementById('magnetic-screen');
    if (magneticScreen) magneticScreen.classList.remove('active');
    
    let specialScreen = document.getElementById('special-screen');
    if (specialScreen) specialScreen.classList.remove('active');

    let menuScreen = document.getElementById('menu-screen');
    if (menuScreen) menuScreen.classList.remove('active');

    gameMode = 'multiplayer';
    challengeMode = 'none';
    isMagneticMode = true;
    magneticTimeLimit = frames;
    magneticTimer = frames;
    magneticHits = 0; 

    p1.active = true;
    p2.active = true;

    startGame('Debug', 'Debug'); 
}

function goBackFromDifficulty() {
    if (gameMode === 'practice') showScreen('practice-phase-screen');
    else if (isMagneticMode) showScreen('magnetic-screen');
    else if (gameMode === 'multiplayer' || challengeMode !== 'none') showScreen('special-screen');
    else showScreen('menu-screen');
}

function pauseGame() {
    if (!gameActive || isPaused) return;
    isPaused = true;
    pauseStartTime = Date.now();
    cancelAnimationFrame(animationId);
    document.getElementById('pause-screen').classList.add('active');
}

function resumeGame() {
    if (!isPaused) return;
    isPaused = false;
    totalPausedTime += Date.now() - pauseStartTime;
    document.getElementById('pause-screen').classList.remove('active');
    update();
}

function quitToMenu() {
    isPaused = false;
    gameActive = false;
    cancelAnimationFrame(animationId);
    document.getElementById('pause-screen').classList.remove('active');
    showScreen('menu-screen');
}

function toggleCustomHp() {
    let container = document.getElementById('custom-hp-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
}

function handleCustomHpInput() {
    let input = document.getElementById('custom-hp-input');
    input.value = input.value.replace(/\s/g, ''); 
    let val = parseInt(input.value);
    document.getElementById('custom-hp-btn').disabled = isNaN(val) || val <= 0;
}

function startCustomGame() {
    let hp = parseInt(document.getElementById('custom-hp-input').value);
    startGame(hp, 'Custom HP');
}

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    keys[e.code] = true; 
    
    if (e.key === 'p' || e.key === 'P') {
        if (gameActive) {
            if (!isPaused) pauseGame();
            else resumeGame();
        }
    }

    if ((e.code === 'Space' || e.code === 'Slash' || e.code === 'ShiftRight' || e.key === '/') && gameActive && !isPaused && p1.dashCooldown <= 0 && p1.active) {
        let dx = 0; let dy = 0;
        if (keys.ArrowUp || (gameMode !== 'multiplayer' && (keys.w || keys.W))) dy -= 1;
        if (keys.ArrowDown || (gameMode !== 'multiplayer' && (keys.s || keys.S))) dy += 1;
        if (keys.ArrowLeft || (gameMode !== 'multiplayer' && (keys.a || keys.A))) dx -= 1;
        if (keys.ArrowRight || (gameMode !== 'multiplayer' && (keys.d || keys.D))) dx += 1;
        
        if (dx === 0 && dy === 0) dx = 1;
        let length = Math.sqrt(dx*dx + dy*dy);
        p1.x += (dx / length) * p1.dashDistance;
        p1.y += (dy / length) * p1.dashDistance;
        
        p1.x = Math.max(p1.size, Math.min(canvas.width - p1.size, p1.x));
        p1.y = Math.max(p1.size, Math.min(canvas.height - p1.size, p1.y));
        p1.dashCooldown = p1.maxDashCooldown;
        p1.isInvulnerable = Math.max(p1.isInvulnerable, 25); 
    }

    if ((e.code === 'ShiftLeft' || e.code === 'KeyQ' || e.code === 'KeyF' || e.key === 'q' || e.key === 'Q' || e.key === 'f' || e.key === 'F') && gameActive && !isPaused && p2.dashCooldown <= 0 && p2.active) {
        let dx = 0; let dy = 0;
        if (keys.w || keys.W) dy -= 1;
        if (keys.s || keys.S) dy += 1;
        if (keys.a || keys.A) dx -= 1;
        if (keys.d || keys.D) dx += 1;
        
        if (dx === 0 && dy === 0) dx = 1;
        let length = Math.sqrt(dx*dx + dy*dy);
        p2.x += (dx / length) * p2.dashDistance;
        p2.y += (dy / length) * p2.dashDistance;
        
        p2.x = Math.max(p2.size, Math.min(canvas.width - p2.size, p2.x));
        p2.y = Math.max(p2.size, Math.min(canvas.height - p2.size, p2.y));
        p2.dashCooldown = p2.maxDashCooldown;
        p2.isInvulnerable = Math.max(p2.isInvulnerable, 25); 
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    keys[e.code] = false;
});

function executePhase1(t) {
    if (t === 120) {
        spawnWarning(0, 0, "diag_laser_1", 0, 0, 60); 
        spawnWarning(canvas.width, 0, "diag_laser_2", 0, 0, 60);
    }

    if (t === 740) {
        spawnWarning(canvas.width/2, canvas.height/2, "spinner_warn", 0, 80, 60);
    }

    if (t === 800) {
        spawnProjectile(100, 100, 6, 6, 50, 800, true); 
    }

    if (t > 800 && t < 1600 && t % 4 === 0) {
        let angle = t * 0.15;
        let cx = canvas.width / 2; let cy = canvas.height / 2;
        spawnProjectile(cx, cy, Math.cos(angle)*7, Math.sin(angle)*7, 12);
        spawnProjectile(cx, cy, Math.cos(angle + Math.PI/2)*7, Math.sin(angle + Math.PI/2)*7, 12);
        spawnProjectile(cx, cy, Math.cos(angle + Math.PI)*7, Math.sin(angle + Math.PI)*7, 12);
        spawnProjectile(cx, cy, Math.cos(angle + Math.PI*1.5)*7, Math.sin(angle + Math.PI*1.5)*7, 12);
    }

    if (t > 1560 && t < 2360) {
        if (t % 80 === 0) {
            let dir = Math.random() > 0.5 ? 1 : -1;
            let startX = dir === 1 ? -50 : canvas.width + 50;
            let gapY = Math.random() * (canvas.height - 150) + 75;
            spawnWarning(startX, gapY, "wall_h", dir, 20, 40);
        }
        if (t % 110 === 0) {
            let dir = Math.random() > 0.5 ? 1 : -1;
            let startY = dir === 1 ? -50 : canvas.height + 50;
            let gap1X = Math.random() * (canvas.width/2 - 100) + 50;
            let gap2X = Math.random() * (canvas.width/2 - 100) + canvas.width/2 + 50;
            spawnWarning(gap1X, gap2X, "wall_v", dir, startY, 40);
        }
    }
}

function executePhase2(t) {
    if (t > 2700 && t < 3600 && t % 5 === 0) {
        let px = Math.random() * canvas.width;
        spawnProjectile(px, -30, (Math.random()-0.5)*4, 8 + Math.random()*6, Math.random()*20 + 10);
    }
    if (t > 3600 && t < 4500 && t % 45 === 0) {
        spawnWarning(Math.random() * (canvas.width - 100) + 50, Math.random() * (canvas.height - 100) + 50, "firecracker", 0, 40, 45); 
        spawnWarning(Math.random() * (canvas.width - 100) + 50, Math.random() * (canvas.height - 100) + 50, "firecracker", 0, 40, 45); 
    }
    if (t > 4500 && t < 5400 && t % 40 === 0) {
        spawnWarning(Math.random() * canvas.width, Math.random() * canvas.height, "ring", 0, 40, 30);
    }
}

function executePhase3(t) {
    if (t > 5700 && t < 6800 && t % 7 === 0) {
        let edge = Math.floor(Math.random() * 4);
        let px, py, vx, vy;
        if(edge === 0) { px=Math.random()*canvas.width; py=-20; vx=(Math.random()-0.5)*6; vy=8; } 
        if(edge === 1) { px=Math.random()*canvas.width; py=canvas.height+20; vx=(Math.random()-0.5)*6; vy=-8; } 
        if(edge === 2) { px=-20; py=Math.random()*canvas.height; vx=8; vy=(Math.random()-0.5)*6; } 
        if(edge === 3) { px=canvas.width+20; py=Math.random()*canvas.height; vx=-8; vy=(Math.random()-0.5)*6; } 
        spawnProjectile(px, py, vx, vy, Math.random()*12 + 8);
    }

    if (t === 6740) {
        spawnWarning(canvas.width / 2, canvas.height / 2, "middle_line", 0, 40, 60);
    }

    if (t === 6800) {
        for(let i = 0; i < canvas.width; i += 25) spawnProjectile(i, canvas.height / 2, 0, 0, 15);
    }
    if (t > 6800 && t < 7900 && t % 50 === 0) {
        let dir = Math.random() > 0.5 ? 1 : -1;
        let startX = dir === 1 ? -50 : canvas.width + 50;
        let gap1Y = Math.random() * (canvas.height/2 - 100) + 50;
        let gap2Y = Math.random() * (canvas.height/2 - 100) + canvas.height/2 + 50;
        spawnWarning(startX === -50 ? 50 : canvas.width - 50, gap1Y, dir, "split_wall", gap2Y, 25);
    }
    
    if (t === 7900) { projectiles = []; warnings = []; }

    if (t > 7960 && t < 9000) {
        if (t % 20 === 0) {
            spawnWarning(p1.x, p1.y, "track", "p1", 0, 30);
            if (gameMode === 'multiplayer' && p2.active) spawnWarning(p2.x, p2.y, "track", "p2", 0, 30);
            
            if (t % 40 === 0) spawnProjectile(Math.random()*canvas.width, -20, 0, 10, 15);
        }
        if (t % 60 === 0) {
            let startX1 = Math.random() > 0.5 ? -20 : canvas.width + 20;
            let startX2 = Math.random() > 0.5 ? -20 : canvas.width + 20;
            spawnWarning(startX1, Math.random() * canvas.height, "sniper_line", p1.x, p1.y, 45);
            if (gameMode === 'multiplayer' && p2.active) spawnWarning(startX2, Math.random() * canvas.height, "sniper_line", p2.x, p2.y, 45);
        }
    }
}

function executeAttacks() {
    let t = frameCount;
    let majorPhase = selectedPracticePhase.charAt(0);

    if (gameMode === 'full' || gameMode === 'multiplayer' || (gameMode === 'practice' && majorPhase === '1')) executePhase1(t);

    if (gameMode === 'full' || gameMode === 'multiplayer') {
        if (t === 2400) { projectiles = []; warnings = []; }
        if (t === 2460 || t === 2470 || t === 2480) {
            for(let i = 0; i < canvas.height; i += 20) {
                spawnProjectile(-50, i, 8, 0, 20);
                spawnProjectile(canvas.width + 50, i, -8, 0, 20);
            }
        }
    }

    if (gameMode === 'full' || gameMode === 'multiplayer' || (gameMode === 'practice' && majorPhase === '2')) executePhase2(t);

    if (gameMode === 'full' || gameMode === 'multiplayer') {
        if (t === 5400) { projectiles = []; warnings = []; }
        if (t === 5460) {
            for(let x = 100; x < canvas.width; x += 150) spawnWarning(x, 0, "grid_laser_v", 0, 0, 90); 
            for(let y = 100; y < canvas.height; y += 150) spawnWarning(0, y, "grid_laser_h", 0, 0, 90); 
        }
    }

    if (gameMode === 'full' || gameMode === 'multiplayer' || (gameMode === 'practice' && majorPhase === '3')) executePhase3(t);

    if (gameMode === 'practice') {
        if (selectedPracticePhase === '1.1' && t === 800) gameWon();
        if (selectedPracticePhase === '1.2' && t === 1600) gameWon();
        if (selectedPracticePhase === '1.3' && t === END_FRAMES.PHASE1) gameWon();
        if (selectedPracticePhase === '1' && t === END_FRAMES.PHASE1) gameWon();

        if (selectedPracticePhase === '2.1' && t === 3600) gameWon();
        if (selectedPracticePhase === '2.2' && t === 4500) gameWon();
        if (selectedPracticePhase === '2.3' && t === END_FRAMES.PHASE2) gameWon();
        if (selectedPracticePhase === '2' && t === END_FRAMES.PHASE2) gameWon();

        if (selectedPracticePhase === '3.1' && t === 6800) gameWon();
        if (selectedPracticePhase === '3.2' && t === 7900) gameWon();
        if (selectedPracticePhase === '3.3' && t === END_FRAMES.FULL) gameWon();
        if (selectedPracticePhase === '3' && t === END_FRAMES.FULL) gameWon();
    }

    if ((gameMode === 'full' || gameMode === 'multiplayer') && t === END_FRAMES.FULL) gameWon();
}

function updatePlayer(player, keysArr) {
    if (!player.active) return;
    
    let dx = 0; let dy = 0;
    if (keysArr.up) dy -= 1;
    if (keysArr.down) dy += 1;
    if (keysArr.left) dx -= 1;
    if (keysArr.right) dx += 1;

    if (dx !== 0 && dy !== 0) {
        let length = Math.sqrt(dx*dx + dy*dy);
        dx /= length; dy /= length;
    }

    player.x += dx * player.speed;
    player.y += dy * player.speed;
    player.x = Math.max(player.size/2, Math.min(canvas.width - player.size/2, player.x));
    player.y = Math.max(player.size/2, Math.min(canvas.height - player.size/2, player.y));

    if (player.dashCooldown > 0) player.dashCooldown--;
    if (player.isInvulnerable > 0) player.isInvulnerable--;
}

function update() {
    if (!gameActive || isPaused) return;

    let timeSurvived = Math.floor((Date.now() - startTime - totalPausedTime) / 1000);

    let p1Keys = {
        up: keys.ArrowUp || (gameMode !== 'multiplayer' && (keys.w || keys.W)),
        down: keys.ArrowDown || (gameMode !== 'multiplayer' && (keys.s || keys.S)),
        left: keys.ArrowLeft || (gameMode !== 'multiplayer' && (keys.a || keys.A)),
        right: keys.ArrowRight || (gameMode !== 'multiplayer' && (keys.d || keys.D))
    };
    updatePlayer(p1, p1Keys);

    if (gameMode === 'multiplayer') {
        let p2Keys = { up: keys.w || keys.W, down: keys.s || keys.S, left: keys.a || keys.A, right: keys.d || keys.D };
        updatePlayer(p2, p2Keys);
    }

    if (isMagneticMode && p1.active && p2.active) {
        let dx = p1.x - p2.x;
        let dy = p1.y - p2.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < (p1.size / 2 + p2.size / 2)) {
            magneticTimer = magneticTimeLimit; 
        } else {
            magneticTimer--;
            if (magneticTimer <= 0) {
                magneticHits++; 
                magneticTimer = magneticTimeLimit; 
            }
        }
    }

    for (let i = warnings.length - 1; i >= 0; i--) {
        let w = warnings[i];
        w.timer--;
        
        if (w.timer <= 0) {
            if (w.vx === "ring") {
                for(let j = 0; j < Math.PI * 2; j += Math.PI / 8) spawnProjectile(w.x, w.y, Math.cos(j)*9, Math.sin(j)*9, 14);
            } else if (w.vx === "track") {
                let target = w.vy === "p2" ? p2 : p1;
                let angle = Math.atan2(target.y - w.y, target.x - w.x);
                spawnProjectile(w.x, w.y, Math.cos(angle)*12, Math.sin(angle)*12, 16);
            } else if (w.vy === "split_wall") {
                for(let j=0; j<canvas.height; j+=25) {
                    if (Math.abs(j - canvas.height/2) < 25) continue; 
                    if (Math.abs(j - w.y) > 40 && Math.abs(j - w.size) > 40) spawnProjectile(w.vx === 1 ? -50 : canvas.width + 50, j, w.vx * 14, 0, 20);
                }
            } else if (w.vx === "wall_h") {
                for(let i = 0; i < canvas.height; i += 30) {
                    if(Math.abs(i - w.y) > 40) spawnProjectile(w.x, i, w.vy * 8.5, 0, 20);
                }
            } else if (w.vx === "wall_v") {
                for(let i = 0; i < canvas.width; i += 30) {
                    if(Math.abs(i - w.x) > 40 && Math.abs(i - w.y) > 40) spawnProjectile(i, w.size, 0, w.vy * 8.5, 20);
                }
            } else if (w.vx === "sniper_line") {
                let angle = Math.atan2(w.size - w.y, w.vy - w.x);
                spawnProjectile(w.x, w.y, Math.cos(angle)*18, Math.sin(angle)*18, 22);
            } else if (w.vx === "grid_laser_v") {
                for(let j=0; j<canvas.height; j+=25) spawnProjectile(w.x, j, 0, 0, 25, 45); 
            } else if (w.vx === "grid_laser_h") {
                for(let j=0; j<canvas.width; j+=25) spawnProjectile(j, w.y, 0, 0, 25, 45); 
            } else if (w.vx === "diag_laser_1") {
                let dist = Math.sqrt(canvas.width*canvas.width + canvas.height*canvas.height);
                for(let i = 0; i < dist; i += 5) spawnProjectile(i * (canvas.width/dist), i * (canvas.height/dist), 0, 0, 25, 1380);
            } else if (w.vx === "diag_laser_2") {
                let dist = Math.sqrt(canvas.width*canvas.width + canvas.height*canvas.height);
                for(let i = 0; i < dist; i += 5) spawnProjectile(canvas.width - i * (canvas.width/dist), i * (canvas.height/dist), 0, 0, 25, 1380);
            } else if (w.vx === "spinner_warn" || w.vx === "middle_line") {
                // Do nothing
            } else {
                for(let j = 0; j < Math.PI * 2; j += Math.PI / 6) spawnProjectile(w.x, w.y, Math.cos(j)*8, Math.sin(j)*8, 12);
            }
            warnings.splice(i, 1);
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        if (p.isBouncy) {
            if (p.x - p.size/2 < 0) { p.x = p.size/2; p.vx *= -1; }
            if (p.x + p.size/2 > canvas.width) { p.x = canvas.width - p.size/2; p.vx *= -1; }
            if (p.y - p.size/2 < 0) { p.y = p.size/2; p.vy *= -1; }
            if (p.y + p.size/2 > canvas.height) { p.y = canvas.height - p.size/2; p.vy *= -1; }
        } else {
            if (p.x < -100 || p.x > canvas.width + 100 || p.y < -100 || p.y > canvas.height + 100) {
                projectiles.splice(i, 1); continue;
            }
        }

        if (p.life <= 0) { projectiles.splice(i, 1); continue; }

        let checkHit = (playerObj) => {
            if (playerObj.active && playerObj.isInvulnerable <= 0) {
                if (Math.abs(playerObj.x - p.x) < (playerObj.size/2 + p.size/2 - 3) && 
                    Math.abs(playerObj.y - p.y) < (playerObj.size/2 + p.size/2 - 3)) {
                    
                    playerObj.hitsTaken++;
                    if (currentDifficulty !== 'Debug') {
                        playerObj.health--;
                        if (playerObj.health <= 0) {
                            playerObj.active = false;
                            if (!p1.active && !p2.active) gameOver();
                        } else playerObj.isInvulnerable = 60; 
                    } else {
                        playerObj.isInvulnerable = 60;
                    }
                }
            }
        };

        checkHit(p1);
        if (gameMode === 'multiplayer') checkHit(p2);
    }

    executeAttacks();
    frameCount++;
    
    let displayTime = timeSurvived;
    if (gameMode === 'practice') displayTime += Math.floor(PHASE_FRAMES[selectedPracticePhase] / 60);
    
    document.getElementById('timer-display').innerText = displayTime;
    
    if (currentDifficulty === 'Debug') {
        document.getElementById('hp-display').innerText = `DEBUG P1 (Hits: ${p1.hitsTaken})` + (gameMode === 'multiplayer' ? ` | P2 (Hits: ${p2.hitsTaken})` : '');
    } else {
        document.getElementById('hp-display').innerText = `P1 HP: ${p1.health > 0 ? p1.health : 'DEAD'}` + (gameMode === 'multiplayer' ? ` | P2 HP: ${p2.health > 0 ? p2.health : 'DEAD'}` : '');
    }
    
    draw();
    animationId = requestAnimationFrame(update);
}

function drawPlayer(player) {
    if (!player.active) return;

    if (player.isInvulnerable > 0 && player.isInvulnerable < 120 && frameCount % 10 < 5) ctx.globalAlpha = 0.2;
    else if (player.isInvulnerable > 0) ctx.globalAlpha = 0.5;
    else ctx.globalAlpha = 1.0;
    
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x - player.size/2, player.y - player.size/2, player.size, player.size);
    ctx.globalAlpha = 1.0;
    
    if (player.dashCooldown > 0) {
        ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.arc(player.x, player.y, player.size + 5, -Math.PI/2, (-Math.PI/2) + (Math.PI * 2 * (1 - player.dashCooldown/player.maxDashCooldown)));
        ctx.stroke();
    }
}

function draw() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let isPhase1_2 = (gameMode === 'full' || gameMode === 'multiplayer') && frameCount >= 800 && frameCount <= 1660 || 
                     (gameMode === 'practice' && ['1', '1.2'].includes(selectedPracticePhase.charAt(0)) && frameCount >= 800 && frameCount <= 1660);

    if (isPhase1_2) {
        let cx = canvas.width / 2; let cy = canvas.height / 2;
        let radius = 80; let opacity = 1;

        if (frameCount > 1600) {
            let fadeProgress = (frameCount - 1600) / 60; 
            radius = 80 + fadeProgress * 150; 
            opacity = 1 - fadeProgress; 
        }

        if (opacity > 0) {
            ctx.strokeStyle = `rgba(128, 0, 128, ${opacity})`; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = `rgba(128, 0, 128, ${opacity * 0.2})`; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
        }
    }

    drawPlayer(p1);
    if (gameMode === 'multiplayer') drawPlayer(p2);

    ctx.fillStyle = '#00FF00';
    ctx.shadowBlur = 12; ctx.shadowColor = '#00FF00';
    for (let p of projectiles) ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    ctx.shadowBlur = 0; 

    for (let w of warnings) {
        let progress = 1 - (w.timer / w.maxTimer);

        if (w.vx === "wall_h") {
            ctx.fillStyle = `rgba(255, 0, 0, ${0.2 + 0.3 * Math.sin(frameCount * 0.2)})`;
            let rectX = w.vy === 1 ? 0 : canvas.width - 40; ctx.fillRect(rectX, 0, 40, canvas.height);
        }
        else if (w.vx === "wall_v") {
            ctx.fillStyle = `rgba(255, 0, 0, ${0.2 + 0.3 * Math.sin(frameCount * 0.2)})`;
            let rectY = w.vy === 1 ? 0 : canvas.height - 40; ctx.fillRect(0, rectY, canvas.width, 40);
        }
        else if (w.vy === "split_wall") {
            ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + 0.5 * Math.sin(frameCount * 0.2)})`;
            let rectX = w.vx === 1 ? 0 : canvas.width - 40;
            ctx.fillRect(rectX, 0, 40, canvas.height/2 - 20); ctx.fillRect(rectX, canvas.height/2 + 20, 40, canvas.height/2 - 20);
        }
        else if (w.vx === "middle_line") {
            ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + 0.3 * Math.sin(frameCount * 0.2)})`;
            ctx.fillRect(0, canvas.height / 2 - 20, canvas.width, 40);
            ctx.fillStyle = 'white'; ctx.font = 'bold 3rem Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', canvas.width / 2, canvas.height / 2);
        }
        else if (w.vx === "sniper_line") {
            let angle = Math.atan2(w.size - w.y, w.vy - w.x);
            ctx.strokeStyle = `rgba(255, 50, 50, ${0.5 + 0.5 * Math.abs(Math.sin(frameCount * 0.2))})`;
            ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(w.x + Math.cos(angle)*3000, w.y + Math.sin(angle)*3000); ctx.stroke();
        }
        else if (w.vx === "grid_laser_v") {
            ctx.fillStyle = `rgba(255, 0, 0, ${0.2 + 0.4 * Math.sin(frameCount * 0.3)})`; ctx.fillRect(w.x - 12, 0, 24, canvas.height);
        }
        else if (w.vx === "grid_laser_h") {
            ctx.fillStyle = `rgba(255, 0, 0, ${0.2 + 0.4 * Math.sin(frameCount * 0.3)})`; ctx.fillRect(0, w.y - 12, canvas.width, 24);
        }
        else if (w.vx === "spinner_warn") {
            let radius = w.size || 80;
            ctx.strokeStyle = `rgba(128, 0, 128, ${0.4 + 0.6 * progress})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w.x, w.y, radius, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = `rgba(128, 0, 128, ${0.2 * progress})`; ctx.beginPath(); ctx.arc(w.x, w.y, radius * progress, 0, Math.PI * 2); ctx.fill();
        }
        else if (w.vx === "firecracker" || w.vx === "ring") {
            let radius = w.size || 40;
            ctx.strokeStyle = w.vx === "ring" ? `rgba(255, 0, 0, ${0.4 + 0.6 * progress})` : `rgba(255, 255, 255, ${0.4 + 0.6 * progress})`;
            ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w.x, w.y, radius, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = w.vx === "ring" ? `rgba(255, 0, 0, ${0.2 * progress})` : `rgba(255, 255, 255, ${0.2 * progress})`; ctx.beginPath(); ctx.arc(w.x, w.y, radius * progress, 0, Math.PI * 2); ctx.fill();
            if (w.timer >= 15 || frameCount % 4 >= 2) { ctx.fillStyle = 'white'; ctx.font = 'bold 2rem Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', w.x, w.y); }
        }
        else if (w.vx === "track") {
            let target = w.vy === "p2" ? p2 : p1;
            let angle = Math.atan2(target.y - w.y, target.x - w.x);
            let triSize = 30;
            ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(angle);
            ctx.strokeStyle = `rgba(255, 255, 0, ${0.5 + 0.5 * progress})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(triSize, 0); ctx.lineTo(-triSize/2, triSize/2); ctx.lineTo(-triSize/2, -triSize/2); ctx.closePath(); ctx.stroke();
            ctx.fillStyle = `rgba(255, 255, 0, ${0.2 * progress})`; ctx.fill(); ctx.rotate(-angle);
            if (w.timer >= 15 || frameCount % 4 >= 2) { ctx.fillStyle = 'white'; ctx.font = 'bold 1.5rem Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 0); }
            ctx.restore();
        }
        else if (w.vx === "diag_laser_1") {
            ctx.strokeStyle = `rgba(255, 50, 50, ${0.3 + 0.7 * progress})`; ctx.lineWidth = 2 + 5 * progress;
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(canvas.width, canvas.height); ctx.stroke();
        }
        else if (w.vx === "diag_laser_2") {
            ctx.strokeStyle = `rgba(255, 50, 50, ${0.3 + 0.7 * progress})`; ctx.lineWidth = 2 + 5 * progress;
            ctx.beginPath(); ctx.moveTo(canvas.width,0); ctx.lineTo(0, canvas.height); ctx.stroke();
        }
        else {
            if (w.timer < 15 && frameCount % 4 < 2) continue; 
            ctx.fillStyle = 'white'; ctx.font = 'bold 2.5rem Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.globalAlpha = progress; ctx.fillText('!', w.x, w.y); ctx.globalAlpha = 1.0;
        }
    }

    if (isMagneticMode) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px Courier New';
        ctx.textAlign = 'center';
        
        ctx.fillText(`Magnetic hits taken: ${magneticHits}`, canvas.width / 2, 30);
        ctx.fillText(`Time to touch: ${(magneticTimer / 60).toFixed(1)}s`, canvas.width / 2, 50);
    }

    ctx.textAlign = 'center';
    let startFrame = gameMode === 'practice' ? PHASE_FRAMES[selectedPracticePhase] : 0;
    if (p1.isInvulnerable > 0 && frameCount < startFrame + 120) {
        ctx.fillStyle = `rgba(255, 255, 255, ${p1.isInvulnerable / 120})`; ctx.font = '3rem Courier New';
        ctx.fillText(gameMode === 'practice' ? `PHASE ${selectedPracticePhase} PRACTICE` : (isMagneticMode ? 'MAGNETIC MODE' : 'GET READY!'), canvas.width / 2, canvas.height / 2 - 100);
    }
    if (gameMode === 'full' || gameMode === 'multiplayer') {
        if (frameCount >= 2400 && frameCount < 2520) {
            ctx.fillStyle = `rgba(255, 50, 50, ${(2520 - frameCount)/100})`; ctx.font = 'bold 5rem Courier New';
            ctx.fillText('THE CRUSH', canvas.width / 2, canvas.height / 2); ctx.font = '2rem Courier New'; ctx.fillText('DASH THROUGH!', canvas.width / 2, canvas.height / 2 + 60);
        }
        if (frameCount >= 5400 && frameCount < 5520) {
            ctx.fillStyle = `rgba(255, 0, 0, ${(5520 - frameCount)/100})`; ctx.font = 'bold 5rem Courier New';
            ctx.fillText('THE GRID', canvas.width / 2, canvas.height / 2); ctx.font = '2rem Courier New'; ctx.fillText('FIND THE SAFE ZONE', canvas.width / 2, canvas.height / 2 + 60);
        }
    }
}

function startGame(hp, difficultyName) {
    currentDifficulty = difficultyName; currentHpSetting = hp;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('debug-hits-display').style.display = 'none';
    resize(); canvas.style.display = 'block'; document.getElementById('hud').style.display = 'flex';

    if (gameMode === 'full' || gameMode === 'multiplayer') {
        frameCount = 0; 
        document.getElementById('timer-max').innerText = '/ ' + Math.floor(END_FRAMES.FULL / 60);
    } else {
        frameCount = PHASE_FRAMES[selectedPracticePhase]; 
        let majorPhase = selectedPracticePhase.charAt(0);
        if (majorPhase === '1') document.getElementById('timer-max').innerText = '/ ' + Math.floor(END_FRAMES.PHASE1 / 60);
        if (majorPhase === '2') document.getElementById('timer-max').innerText = '/ ' + Math.floor(END_FRAMES.PHASE2 / 60);
        if (majorPhase === '3') document.getElementById('timer-max').innerText = '/ ' + Math.floor(END_FRAMES.FULL / 60);
    }

    if (challengeMode === 'invisible') p1.color = '#000000';
    else if (challengeMode === 'bullet-colored') p1.color = '#00FF00';
    else p1.color = p1Color;

    p2.color = p2Color; 

    p1.x = canvas.width / 2 - (gameMode === 'multiplayer' ? 50 : 0); p1.y = canvas.height / 2; 
    p1.hitsTaken = 0; p1.active = true; p1.isInvulnerable = 120;
    
    if (gameMode === 'multiplayer') {
        p2.x = canvas.width / 2 + 50; p2.y = canvas.height / 2;
        p2.hitsTaken = 0; p2.active = true; p2.isInvulnerable = 120;
    } else {
        p2.active = false;
    }

    if (currentDifficulty !== 'Debug') {
        p1.health = hp; 
        if (gameMode === 'multiplayer') p2.health = hp;
    }
    
    projectiles = []; warnings = []; gameActive = true; isPaused = false;
    startTime = Date.now(); totalPausedTime = 0;

    update();
}

function retryPractice() { startGame(currentHpSetting, currentDifficulty); }

function gameOver() {
    gameActive = false; 
    cancelAnimationFrame(animationId);
    let challengeText = challengeMode !== 'none' ? ` Challenge - ${challengeMode.charAt(0).toUpperCase() + challengeMode.slice(1)}` : '';

    if (gameMode === 'practice') {
        document.getElementById('practice-failed-mode').innerText = `Phase ${selectedPracticePhase}, ${currentDifficulty}`;
        showScreen('practice-failed-screen');
    } else {
        let timeSurvived = Math.floor((Date.now() - startTime - totalPausedTime) / 1000);
        let modeLabel = isMagneticMode ? 'Magnetic Mode' : (gameMode === 'multiplayer' ? 'Multiplayer' : 'Full Fight');
        document.getElementById('death-stats-mode').innerText = `${modeLabel}${challengeText}, ${currentDifficulty}`;
        document.getElementById('survival-time').innerText = timeSurvived; 
        showScreen('game-over-screen');
    }
}

function gameWon() {
    gameActive = false; cancelAnimationFrame(animationId);
    let challengeText = challengeMode !== 'none' ? ` Challenge - ${challengeMode.charAt(0).toUpperCase() + challengeMode.slice(1)}` : '';

    if (gameMode === 'practice') {
        document.getElementById('victory-title').innerText = "PHASE CLEARED";
        document.getElementById('victory-stats-mode').innerText = `Phase ${selectedPracticePhase} Practice${challengeText}, ${currentDifficulty}`;
    } else {
        document.getElementById('victory-title').innerText = "FULL FIGHT CLEARED";
        let modeLabel = isMagneticMode ? 'Magnetic Mode' : (gameMode === 'multiplayer' ? 'Multiplayer' : 'Full Fight');
        document.getElementById('victory-stats-mode').innerText = `${modeLabel}${challengeText}, ${currentDifficulty}`;
    }
    if (currentDifficulty === 'Debug') {
        document.getElementById('debug-hits-display').style.display = 'block';
        if (gameMode === 'multiplayer') {
            document.getElementById('final-hits').innerText = `P1: ${p1.hitsTaken} | P2: ${p2.hitsTaken}${isMagneticMode ? ` | Magnetic Hits: ${magneticHits}` : ''}`;
        } else {
            document.getElementById('final-hits').innerText = `${p1.hitsTaken}`;
        }
    }
    showScreen('victory-screen');
}
