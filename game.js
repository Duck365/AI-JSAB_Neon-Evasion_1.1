/**
 * ==============================================================================
 * NEON EVASION (ROBOT MODE) - ENGINE & ATTACK SCRIPT
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
// p2Color is removed; the robot is strictly #808080

// Time tracking
let startTime;
let pauseStartTime = 0;
let totalPausedTime = 0;

let currentDifficulty = 'Debug';

// Input tracking
const keys = {};

// Player Objects
const p1 = {
    x: 0, y: 0, size: 20, speed: 6.5, health: 5,
    dashCooldown: 0, maxDashCooldown: 40, dashDistance: 180, isInvulnerable: 0,
    hitsTaken: 0, active: true, color: p1Color
};

const p2 = {
    x: 0, y: 0, size: 20, speed: 6.5, health: 5,
    dashCooldown: 0, maxDashCooldown: 40, dashDistance: 180, isInvulnerable: 0,
    hitsTaken: 0, active: true, color: '#808080',
    
    // AI Specific tracking
    aiTargetX: canvas.width / 2, 
    aiTargetY: canvas.height / 2,
    aiState: 'path', 
    aiTimer: 0 
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
    if (playerNum === 1) {
        p1Color = color;
        p1.color = color;
        document.getElementById('p1-color-text').textContent = color;
        document.getElementById('p1-color-text').style.color = color;
    }
}

function spawnProjectile(x, y, vx, vy, size, life = Infinity, isBouncy = false) {
    projectiles.push({ x, y, vx, vy, size, life, isBouncy });
}

function spawnWarning(x, y, vx, vy, size, delayTimer) {
    warnings.push({ x, y, vx, vy, size, timer: delayTimer, maxTimer: delayTimer });
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

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    keys[e.code] = true; 
    
    if (e.key === 'p' || e.key === 'P') {
        if (gameActive) {
            if (!isPaused) pauseGame();
            else resumeGame();
        }
    }

    // Only Player 1 Dash
    if ((e.code === 'Space' || e.code === 'Slash' || e.code === 'ShiftRight' || e.key === '/') && gameActive && !isPaused && p1.dashCooldown <= 0 && p1.active) {
        let dx = 0; let dy = 0;
        if (keys.ArrowUp || keys.w || keys.W) dy -= 1;
        if (keys.ArrowDown || keys.s || keys.S) dy += 1;
        if (keys.ArrowLeft || keys.a || keys.A) dx -= 1;
        if (keys.ArrowRight || keys.d || keys.D) dx += 1;
        
        if (dx === 0 && dy === 0) dx = 1;
        let length = Math.sqrt(dx*dx + dy*dy);
        p1.x += (dx / length) * p1.dashDistance;
        p1.y += (dy / length) * p1.dashDistance;
        
        p1.x = Math.max(p1.size, Math.min(canvas.width - p1.size, p1.x));
        p1.y = Math.max(p1.size, Math.min(canvas.height - p1.size, p1.y));
        p1.dashCooldown = p1.maxDashCooldown;
        p1.isInvulnerable = Math.max(p1.isInvulnerable, 25); 
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    keys[e.code] = false;
});

// ==========================================
// THE ROBOT BRAIN
// ==========================================
function updateRobot(t) {
    if (!p2.active) return;

    // Safety Boundary Check
    let margin = 40;
    if (p2.aiState.startsWith('random') && (p2.x < margin || p2.x > canvas.width - margin || p2.y < margin || p2.y > canvas.height - margin)) {
        p2.x = canvas.width / 2;
        p2.y = canvas.height / 2;
        p2.aiTargetX = p2.x;
        p2.aiTargetY = p2.y;
    }

    // Active Danger Evasion (Calculated Escape)
    if (p2.aiState === 'random' || p2.aiState === 'bottom_dash') {
        for (let w of warnings) {
            if ((w.vx === "firecracker" || w.vx === "ring") && w.timer < 35) {
                let dx = p2.x - w.x;
                let dy = p2.y - w.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < (w.size || 40) + 50 && p2.dashCooldown <= 0) {
                    if (dist === 0) { dx = 1; dy = 0; dist = 1; }
                    p2.x += (dx / dist) * 350; 
                    p2.y += (dy / dist) * 350;
                    p2.dashCooldown = p2.maxDashCooldown;
                    p2.aiTargetX = p2.x; 
                    p2.aiTargetY = p2.y;
                }
            }
        }
    }

    // Phase 1.1: Hover in the top-middle safe zone (0 - 740)
    if (t >= 0 && t < 740) {
        p2.aiState = 'path';
        p2.aiTargetX = canvas.width / 2;
        p2.aiTargetY = canvas.height * 0.15;
    }
    // Phase 1.2: Very Bottom Left/Right Dashing (740 - 1560)
    else if (t >= 740 && t < 1560) {
        p2.aiState = 'path';
        p2.aiTargetY = canvas.height - 40; // Very bottom
        p2.aiTargetX = canvas.width / 2;
        
        if (p2.dashCooldown <= 0) {
            // Dash Right, then Dash Left depending on screen position
            if (p2.x <= canvas.width / 2) {
                p2.x += 400; // Dash Right
            } else {
                p2.x -= 400; // Dash Left
            }
            p2.dashCooldown = p2.maxDashCooldown;
        }
    }
    // Phase 1.3: Random Middle (1560 - 2400)
    else if (t >= 1560 && t < 2400) {
        p2.aiState = 'random';
        if (t % 50 === 0) { 
            p2.aiTargetX = canvas.width/2 + (Math.random() * 400 - 200);
            p2.aiTargetY = canvas.height/2 + (Math.random() * 400 - 200);
        }
        if (t % 90 === 0 && p2.dashCooldown <= 0) {
            p2.x = p2.aiTargetX; p2.y = p2.aiTargetY;
            p2.dashCooldown = p2.maxDashCooldown;
        }
    }
    // The Crush Transition (2400 - 2700)
    else if (t >= 2400 && t < 2700) {
        p2.aiState = 'crush_dodge';
        if (t === 2401) { 
            p2.x = canvas.width / 2; p2.y = canvas.height / 2; 
            p2.aiTargetX = p2.x; p2.aiTargetY = p2.y; 
        }
        // Wait... half-wait... dash left (2475)... wait... dash right (2515)
        if (t === 2475 && p2.dashCooldown <= 0) { 
            p2.x -= 400; p2.dashCooldown = p2.maxDashCooldown; // Dash left
        } 
        if (t === 2515 && p2.dashCooldown <= 0) { 
            p2.x += 800; p2.dashCooldown = p2.maxDashCooldown; // Dash right
        }
    }
    // Phase 2.1: Random Bottom (2700 - 3600)
    else if (t >= 2700 && t < 3600) {
        p2.aiState = 'random';
        if (t % 60 === 0) {
            p2.aiTargetX = canvas.width/2 + (Math.random() * 400 - 200);
            p2.aiTargetY = canvas.height - (Math.random() * 150 + 50);
        }
        if (t % 100 === 0 && p2.dashCooldown <= 0) {
            p2.x = p2.aiTargetX; p2.y = p2.aiTargetY;
            p2.dashCooldown = p2.maxDashCooldown;
        }
    }
    // Phases 2.2 & 2.3: Bottom Dash & Evasion (3600 - 5400)
    else if (t >= 3600 && t < 5400) {
        p2.aiState = 'bottom_dash';
        p2.aiTargetY = canvas.height - 40; // Lock pathing to the very bottom
        
        if (t % 30 === 0) {
            // Pick a new random X target along the bottom
            p2.aiTargetX = canvas.width/2 + (Math.random() * 600 - 300);
        }
        
        // 90-95% dashing behavior along the bottom
        if (p2.dashCooldown <= 0 && Math.random() < 0.95) {
            p2.x = p2.aiTargetX;
            // Evasion logic above will alter Y if needed, but pathing pulls it back down
            p2.dashCooldown = p2.maxDashCooldown;
        }
    }
    // The Grid Transition (5400 - 5700)
    else if (t >= 5400 && t < 5700) {
        p2.aiState = 'grid_safe';
        if (t === 5401) {
            let safeX = 175 + 150 * Math.floor(canvas.width / 2 / 150);
            let safeY = 175 + 150 * Math.floor(canvas.height / 2 / 150);
            p2.x = safeX; p2.y = safeY;
            p2.aiTargetX = p2.x; p2.aiTargetY = p2.y;
        }
    }
    // Phase 3.1: Random Middle (5700 - 6800)
    else if (t >= 5700 && t < 6800) {
        p2.aiState = 'random';
        if (t % 50 === 0) {
            p2.aiTargetX = canvas.width/2 + (Math.random() * 300 - 150);
            p2.aiTargetY = canvas.height/2 + (Math.random() * 300 - 150);
        }
        if (t % 150 === 0 && p2.dashCooldown <= 0) {
            p2.x = p2.aiTargetX; p2.y = p2.aiTargetY;
            p2.dashCooldown = p2.maxDashCooldown;
        }
    }
    // Phase 3.2: Horizontal Teleport Only (6800 - 7900)
    else if (t >= 6800 && t < 7900) {
        p2.aiState = 'random_side';
        p2.aiTargetY = canvas.height / 4; 
        
        if (t % 60 === 0) {
            p2.aiTargetX = canvas.width/2 + (Math.random() * 400 - 200);
        }
        if (t % 120 === 0 && p2.dashCooldown <= 0) {
            p2.x = canvas.width - p2.x; 
            p2.dashCooldown = p2.maxDashCooldown;
        }
    }
    // Phase 3.3: Circle Spin (7960 - 9000)
    else if (t >= 7960 && t < 9000) {
        p2.aiState = 'path';
        p2.aiTargetX = canvas.width / 2 + Math.cos(t * 0.05) * 150;
        p2.aiTargetY = canvas.height / 2 + Math.sin(t * 0.05) * 150;
    }

    // Move Robot towards calculated target
    let dx = p2.aiTargetX - p2.x;
    let dy = p2.aiTargetY - p2.y;
    let dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist > p2.speed) {
        p2.x += (dx / dist) * p2.speed;
        p2.y += (dy / dist) * p2.speed;
    } else {
        p2.x = p2.aiTargetX;
        p2.y = p2.aiTargetY;
    }

    // Cooldown management
    if (p2.dashCooldown > 0) p2.dashCooldown--;
    if (p2.isInvulnerable > 0) p2.isInvulnerable--;
    
    // Final hard clamp to screen boundaries
    p2.x = Math.max(p2.size/2, Math.min(canvas.width - p2.size/2, p2.x));
    p2.y = Math.max(p2.size/2, Math.min(canvas.height - p2.size/2, p2.y));
}

// ==========================================
// PHASES
// ==========================================
function executePhase1(t) {
    if (t === 120) {
        spawnWarning(0, 0, "diag_laser_1", 0, 0, 60); 
        spawnWarning(canvas.width, 0, "diag_laser_2", 0, 0, 60);
        spawnWarning(canvas.width/2, canvas.height/2, "spinner_warn", 0, 80, 60);
    }
    if (t === 180) spawnProjectile(100, 100, 6, 6, 50, 800, true); 
    if (t > 180 && t < 740 && t % 4 === 0) {
        let angle = t * 0.15;
        let cx = canvas.width / 2; let cy = canvas.height / 2;
        spawnProjectile(cx, cy, Math.cos(angle)*7, Math.sin(angle)*7, 12);
        spawnProjectile(cx, cy, Math.cos(angle + Math.PI/2)*7, Math.sin(angle + Math.PI/2)*7, 12);
        spawnProjectile(cx, cy, Math.cos(angle + Math.PI)*7, Math.sin(angle + Math.PI)*7, 12);
        spawnProjectile(cx, cy, Math.cos(angle + Math.PI*1.5)*7, Math.sin(angle + Math.PI*1.5)*7, 12);
    }
    if (t === 740) { projectiles = []; warnings = []; }
    if (t > 740 && t < 1560) {
        if (t % 8 === 0) {
            let sweepY = (Math.sin(t * 0.05) * (canvas.height / 2.5)) + (canvas.height / 2);
            spawnProjectile(0, sweepY, 9, 0, 12); 
            spawnProjectile(canvas.width, canvas.height - sweepY, -9, 0, 12); 
        }
        if (t % 100 === 0) {
            // Robot mode: Boss only targets p2
            let activePlayers = [p2];
            activePlayers.forEach(player => {
                for (let i = 0; i < Math.PI * 2; i += Math.PI / 8) {
                    let startX = player.x + Math.cos(i) * 400;
                    let startY = player.y + Math.sin(i) * 400;
                    let angleToPlayer = Math.atan2(player.y - startY, player.x - startX);
                    spawnProjectile(startX, startY, Math.cos(angleToPlayer) * 4, Math.sin(angleToPlayer) * 4, 15);
                }
            });
        }
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
            spawnWarning(p2.x, p2.y, "track", "p2", 0, 30); // Targets Robot
            if (t % 40 === 0) spawnProjectile(Math.random()*canvas.width, -20, 0, 10, 15);
        }
        if (t % 60 === 0) {
            let startX1 = Math.random() > 0.5 ? -20 : canvas.width + 20;
            spawnWarning(startX1, Math.random() * canvas.height, "sniper_line", p2.x, p2.y, 45); // Targets Robot
        }
    }
}

function executeAttacks() {
    let t = frameCount;

    executePhase1(t);

    if (t === 2400) { projectiles = []; warnings = []; }
    if (t === 2460 || t === 2470 || t === 2480) {
        for(let i = 0; i < canvas.height; i += 20) {
            spawnProjectile(-50, i, 8, 0, 20);
            spawnProjectile(canvas.width + 50, i, -8, 0, 20);
        }
    }

    executePhase2(t);

    if (t === 5400) { projectiles = []; warnings = []; }
    if (t === 5460) {
        for(let x = 100; x < canvas.width; x += 150) spawnWarning(x, 0, "grid_laser_v", 0, 0, 90); 
        for(let y = 100; y < canvas.height; y += 150) spawnWarning(0, y, "grid_laser_h", 0, 0, 90); 
    }

    executePhase3(t);

    if (t === 9000) gameWon();
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

    let p1Keys = {
        up: keys.ArrowUp || keys.w || keys.W,
        down: keys.ArrowDown || keys.s || keys.S,
        left: keys.ArrowLeft || keys.a || keys.A,
        right: keys.ArrowRight || keys.d || keys.D
    };
    updatePlayer(p1, p1Keys);
    
    // Call the robot brain
    updateRobot(frameCount);

    for (let i = warnings.length - 1; i >= 0; i--) {
        let w = warnings[i];
        w.timer--;
        
        if (w.timer <= 0) {
            if (w.vx === "ring") {
                for(let j = 0; j < Math.PI * 2; j += Math.PI / 8) spawnProjectile(w.x, w.y, Math.cos(j)*9, Math.sin(j)*9, 14);
            } else if (w.vx === "track") {
                let target = p2; // Hardcoded to target the robot
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
                    playerObj.isInvulnerable = 60;
                }
            }
        };

        checkHit(p1);
        checkHit(p2);
    }

    executeAttacks();
    frameCount++;
    
    let displayTime = Math.floor(frameCount / 60);
    document.getElementById('timer-display').innerText = displayTime;
    document.getElementById('hp-display').innerText = `DEBUG P1 (Hits: ${p1.hitsTaken}) | ROBOT (Hits: ${p2.hitsTaken})`;
    
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

    let isPhase1_2 = frameCount >= 800 && frameCount <= 1660;

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
    drawPlayer(p2);

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
            let target = p2; 
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

    ctx.textAlign = 'center';
    if (p1.isInvulnerable > 0 && frameCount < 120) {
        ctx.fillStyle = `rgba(255, 255, 255, ${p1.isInvulnerable / 120})`; ctx.font = '3rem Courier New';
        ctx.fillText('GET READY!', canvas.width / 2, canvas.height / 2 - 100);
    }
    if (frameCount >= 2400 && frameCount < 2520) {
        ctx.fillStyle = `rgba(255, 50, 50, ${(2520 - frameCount)/100})`; ctx.font = 'bold 5rem Courier New';
        ctx.fillText('THE CRUSH', canvas.width / 2, canvas.height / 2); ctx.font = '2rem Courier New'; ctx.fillText('DASH THROUGH!', canvas.width / 2, canvas.height / 2 + 60);
    }
    if (frameCount >= 5400 && frameCount < 5520) {
        ctx.fillStyle = `rgba(255, 0, 0, ${(5520 - frameCount)/100})`; ctx.font = 'bold 5rem Courier New';
        ctx.fillText('THE GRID', canvas.width / 2, canvas.height / 2); ctx.font = '2rem Courier New'; ctx.fillText('FIND THE SAFE ZONE', canvas.width / 2, canvas.height / 2 + 60);
    }
}

function startGame() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('debug-hits-display').style.display = 'none';
    resize(); canvas.style.display = 'block'; document.getElementById('hud').style.display = 'flex';
    
    p1.color = p1Color;

    p1.x = canvas.width / 2 - 50; p1.y = canvas.height / 2; 
    p1.hitsTaken = 0; p1.active = true; p1.isInvulnerable = 120;
    
    p2.x = canvas.width / 2 + 50; p2.y = canvas.height / 2;
    p2.hitsTaken = 0; p2.active = true; p2.isInvulnerable = 120;
    
    projectiles = []; warnings = []; gameActive = true; isPaused = false;
    startTime = Date.now(); totalPausedTime = 0;
    frameCount = 0; 
    
    document.getElementById('timer-max').innerText = '/ 150';
    
    update();
}

function gameWon() {
    gameActive = false; cancelAnimationFrame(animationId);
    document.getElementById('victory-title').innerText = "ROBOT MODE CLEARED";
    document.getElementById('debug-hits-display').style.display = 'block';
    document.getElementById('final-hits').innerText = `P1: ${p1.hitsTaken} | ROBOT: ${p2.hitsTaken}`;
    showScreen('victory-screen');
}
