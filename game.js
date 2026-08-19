/* =========================================================
   MAKE IT POP
   Foge dos clichês de feedback. Apanha os tokens de design.
   ========================================================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let W, H, DPR;
function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight - 56; // toolbar height
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resize);
resize();

// ---------- UI refs ----------
const startOverlay = document.getElementById('start-overlay');
const overOverlay = document.getElementById('over-overlay');
const scoreChip = document.getElementById('score-val');
const levelChip = document.getElementById('level-val');
const livesEl = document.getElementById('lives');
const comboToast = document.getElementById('combo-toast');
const playBtn = document.getElementById('play-btn');
const retryBtn = document.getElementById('retry-btn');

const finalScoreEl = document.getElementById('final-score');
const finalTokensEl = document.getElementById('final-tokens');
const finalComboEl = document.getElementById('final-combo');
const finalTimeEl = document.getElementById('final-time');

// ---------- constants ----------
const PHRASES = [
  "make it pop",
  "can we make it red?",
  "i don't like it, not sure why",
  "can you make the logo bigger?",
  "just a quick tweak",
  "let's circle back on this",
  "can we try a different font?",
  "it needs more... pizzazz",
  "can you send me the figma link?",
  "this isn't what i asked for",
  "let's take it in a new direction",
  "can we A/B test this?",
  "make the button bigger",
  "less white space please",
];

const AVATARS = ["PM","CEO","VP","CX","GM","Biz","Ops","Sr."];

const TOKEN_TYPES = [
  { kind:'swatch', color:'#00C2A8', soft:'#DFFAF6', points:10 },
  { kind:'type',   color:'#5551FF', soft:'#E8E7FF', points:10 },
  { kind:'grid',   color:'#FFC53D', soft:'#FFF4DA', points:10 },
];

const PLAYER_RADIUS = 20;
const TOKEN_RADIUS = 15;
const ENEMY_RADIUS = 34;
const MAX_LIVES = 3;

// ---------- state ----------
let state = 'idle'; // idle | playing | over
let player, tokens, enemies, particles, shields;
let score, combo, maxCombo, tokensCollected, lives, level, elapsed;
let spawnTokenTimer, spawnEnemyTimer, spawnShieldTimer;
let keys = {};
let pointerTarget = null;
let lastTime = 0;
let shakeAmount = 0;
let flashAmount = 0;

function resetState(){
  player = { x: W/2, y: H/2, vx:0, vy:0, invuln: 0, shielded: 0 };
  tokens = [];
  enemies = [];
  particles = [];
  shields = [];
  score = 0;
  combo = 0;
  maxCombo = 0;
  tokensCollected = 0;
  lives = MAX_LIVES;
  level = 1;
  elapsed = 0;
  spawnTokenTimer = 0;
  spawnEnemyTimer = 0;
  spawnShieldTimer = 6;
  shakeAmount = 0;
  flashAmount = 0;
  pointerTarget = null;
  updateHUD();
}

// ---------- helpers ----------
function rand(a,b){ return a + Math.random()*(b-a); }
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a)*t; }

function safeSpawnPos(margin){
  return {
    x: rand(margin, W-margin),
    y: rand(margin, H-margin)
  };
}

function spawnToken(){
  const type = TOKEN_TYPES[Math.floor(rand(0,TOKEN_TYPES.length))];
  const pos = safeSpawnPos(60);
  tokens.push({ ...pos, r: TOKEN_RADIUS, type, born: elapsed, pulse: rand(0,6.28) });
}

function spawnEnemy(){
  const edge = Math.floor(rand(0,4));
  let x,y;
  if(edge===0){ x = -60; y = rand(60,H-60); }
  else if(edge===1){ x = W+60; y = rand(60,H-60); }
  else if(edge===2){ x = rand(0,W); y = -60; }
  else { x = rand(0,W); y = H+60; }

  const speed = rand(28, 42) + level*4;
  enemies.push({
    x, y,
    text: PHRASES[Math.floor(rand(0,PHRASES.length))],
    avatar: AVATARS[Math.floor(rand(0,AVATARS.length))],
    speed,
    wobblePhase: rand(0,6.28),
    r: ENEMY_RADIUS,
    born: elapsed,
  });
}

function spawnShield(){
  const pos = safeSpawnPos(60);
  shields.push({ ...pos, r: 17, pulse:0 });
}

function addParticles(x,y,color,count=10){
  for(let i=0;i<count;i++){
    const ang = rand(0,Math.PI*2);
    const spd = rand(60,220);
    particles.push({
      x, y,
      vx: Math.cos(ang)*spd,
      vy: Math.sin(ang)*spd,
      life: rand(.4,.8),
      age:0,
      color,
      size: rand(3,7),
    });
  }
}

function showCombo(text){
  comboToast.textContent = text;
  comboToast.style.transition = 'none';
  comboToast.style.opacity = '1';
  comboToast.style.transform = 'translateX(-50%) translateY(0)';
  requestAnimationFrame(()=>{
    comboToast.style.transition = 'opacity .6s ease, transform .6s ease';
    comboToast.style.opacity = '0';
    comboToast.style.transform = 'translateX(-50%) translateY(-14px)';
  });
}

function updateHUD(){
  scoreChip.textContent = Math.floor(score).toLocaleString('pt-PT');
  levelChip.textContent = level;
  livesEl.querySelectorAll('.life-dot').forEach((el,i)=>{
    el.classList.toggle('lost', i >= lives);
  });
}

// ---------- input ----------
window.addEventListener('keydown', e=>{
  keys[e.key.toLowerCase()] = true;
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });

function pointerPos(e){
  const rect = canvas.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  return { x: p.clientX - rect.left, y: p.clientY - rect.top };
}
canvas.addEventListener('pointerdown', e=>{ pointerTarget = pointerPos(e); });
canvas.addEventListener('pointermove', e=>{
  if(e.buttons === 1 || e.pointerType === 'touch') pointerTarget = pointerPos(e);
});
window.addEventListener('pointerup', ()=>{ /* keep last target, gentle stop via keys check */ });

// ---------- game flow ----------
function startGame(){
  resetState();
  state = 'playing';
  startOverlay.classList.add('hidden');
  overOverlay.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function endGame(){
  state = 'over';
  finalScoreEl.textContent = Math.floor(score).toLocaleString('pt-PT');
  finalTokensEl.textContent = tokensCollected;
  finalComboEl.textContent = 'x' + maxCombo;
  finalTimeEl.textContent = Math.floor(elapsed) + 's';
  overOverlay.classList.remove('hidden');
}

playBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);

function hitPlayer(){
  if(player.invuln > 0 || player.shielded > 0) return;
  lives -= 1;
  combo = 0;
  player.invuln = 1.4;
  shakeAmount = 14;
  flashAmount = 1;
  addParticles(player.x, player.y, '#FF5C5C', 16);
  updateHUD();
  if(lives <= 0){
    setTimeout(endGame, 260);
  }
}

// ---------- update ----------
function update(dt){
  elapsed += dt;

  // difficulty ramp
  level = 1 + Math.floor(elapsed / 14);

  // --- player movement ---
  let dx=0, dy=0;
  if(keys['arrowup']||keys['w']) dy -= 1;
  if(keys['arrowdown']||keys['s']) dy += 1;
  if(keys['arrowleft']||keys['a']) dx -= 1;
  if(keys['arrowright']||keys['d']) dx += 1;

  const usingKeys = dx!==0 || dy!==0;
  const speed = 300;

  if(usingKeys){
    const len = Math.hypot(dx,dy) || 1;
    player.vx = (dx/len) * speed;
    player.vy = (dy/len) * speed;
    pointerTarget = null;
  } else if(pointerTarget){
    const ddx = pointerTarget.x - player.x;
    const ddy = pointerTarget.y - player.y;
    const d = Math.hypot(ddx,ddy);
    if(d > 4){
      player.vx = (ddx/d) * speed;
      player.vy = (ddy/d) * speed;
    } else {
      player.vx = 0; player.vy = 0;
    }
  } else {
    player.vx *= 0.85;
    player.vy *= 0.85;
  }

  player.x = clamp(player.x + player.vx*dt, PLAYER_RADIUS, W-PLAYER_RADIUS);
  player.y = clamp(player.y + player.vy*dt, PLAYER_RADIUS, H-PLAYER_RADIUS);

  if(player.invuln > 0) player.invuln -= dt;
  if(player.shielded > 0) player.shielded -= dt;

  // --- spawn tokens ---
  spawnTokenTimer -= dt;
  const tokenInterval = clamp(1.4 - level*0.05, 0.55, 1.4);
  if(spawnTokenTimer <= 0 && tokens.length < 6){
    spawnToken();
    spawnTokenTimer = tokenInterval;
  }

  // --- spawn enemies ---
  spawnEnemyTimer -= dt;
  const enemyInterval = clamp(2.6 - level*0.15, 0.9, 2.6);
  const maxEnemies = clamp(2 + Math.floor(level/2), 2, 8);
  if(spawnEnemyTimer <= 0 && enemies.length < maxEnemies){
    spawnEnemy();
    spawnEnemyTimer = enemyInterval;
  }

  // --- spawn shield powerup ---
  spawnShieldTimer -= dt;
  if(spawnShieldTimer <= 0 && shields.length < 1){
    spawnShield();
    spawnShieldTimer = rand(14,20);
  }

  // --- tokens: pulse + collect check ---
  for(let i=tokens.length-1;i>=0;i--){
    const t = tokens[i];
    t.pulse += dt*3;
    if(dist(player,t) < PLAYER_RADIUS + t.r*0.7){
      tokens.splice(i,1);
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      tokensCollected += 1;
      const mult = 1 + Math.floor(combo/5)*0.5;
      const pts = t.type.points * level * mult;
      score += pts;
      addParticles(t.x, t.y, t.type.color, 14);
      if(combo>0 && combo % 5 === 0) showCombo(`combo x${combo}!`);
      updateHUD();
    }
  }

  // --- shields ---
  for(let i=shields.length-1;i>=0;i--){
    const s = shields[i];
    s.pulse += dt*4;
    if(dist(player,s) < PLAYER_RADIUS + s.r){
      shields.splice(i,1);
      player.shielded = 3.2;
      addParticles(s.x,s.y,'#5551FF',18);
      showCombo('"but why?" — escudo ativo');
    }
  }

  // --- enemies: home toward player, collide ---
  for(let i=enemies.length-1;i>=0;i--){
    const e = enemies[i];
    e.wobblePhase += dt*2;
    const ddx = player.x - e.x;
    const ddy = player.y - e.y;
    const d = Math.hypot(ddx,ddy) || 1;
    const wob = Math.sin(e.wobblePhase) * 18;
    const nx = ddx/d, ny = ddy/d;
    e.x += (nx*e.speed) * dt + (-ny*wob*dt*0.5);
    e.y += (ny*e.speed) * dt + (nx*wob*dt*0.5);

    if(d < PLAYER_RADIUS + e.r*0.55){
      hitPlayer();
      // knock the enemy away so it's not an instant repeat-hit
      e.x -= nx*140; e.y -= ny*140;
    }
  }

  // --- particles ---
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.age += dt;
    if(p.age >= p.life){ particles.splice(i,1); continue; }
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.vx *= 0.92; p.vy *= 0.92;
  }

  if(shakeAmount>0) shakeAmount = Math.max(0, shakeAmount - dt*40);
  if(flashAmount>0) flashAmount = Math.max(0, flashAmount - dt*2.4);
}

// ---------- draw ----------
function drawDotGrid(){
  ctx.fillStyle = getCss('--canvas-dot');
  const step = 34;
  const offsetX = 0, offsetY = 0;
  for(let x = offsetX % step; x < W; x += step){
    for(let y = offsetY % step; y < H; y += step){
      ctx.beginPath();
      ctx.arc(x,y,1.4,0,Math.PI*2);
      ctx.fill();
    }
  }
}

let cssCache = {};
function getCss(v){
  if(cssCache[v]) return cssCache[v];
  const val = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  cssCache[v] = val;
  return val;
}

function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function drawPlayer(){
  const blink = player.invuln > 0 && Math.floor(player.invuln*12)%2===0;
  if(blink) return;

  ctx.save();
  ctx.translate(player.x, player.y);

  if(player.shielded > 0){
    ctx.beginPath();
    ctx.arc(0,0, PLAYER_RADIUS+10 + Math.sin(elapsed*8)*2, 0, Math.PI*2);
    ctx.strokeStyle = '#5551FF';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // cursor arrow (figma style)
  ctx.fillStyle = '#5551FF';
  ctx.beginPath();
  ctx.moveTo(-4,-4);
  ctx.lineTo(9,2);
  ctx.lineTo(3,4);
  ctx.lineTo(6,11);
  ctx.lineTo(2,13);
  ctx.lineTo(-1,5);
  ctx.lineTo(-7,7);
  ctx.closePath();
  ctx.fill();

  // avatar circle
  ctx.beginPath();
  ctx.arc(0,0, PLAYER_RADIUS, 0, Math.PI*2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#5551FF';
  ctx.stroke();

  ctx.fillStyle = '#5551FF';
  ctx.font = '700 11px Space Grotesk, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YOU', 0, 1);

  // nameplate
  ctx.font = '600 11px Inter, sans-serif';
  const label = 'you';
  const tw = ctx.measureText(label).width;
  roundRectAbs(-tw/2-8, PLAYER_RADIUS+8, tw+16, 20, 10);
  ctx.fillStyle = '#5551FF';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(label, 0, PLAYER_RADIUS+18);

  ctx.restore();
}

function roundRectAbs(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function drawToken(t){
  const s = 1 + Math.sin(t.pulse)*0.08;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.scale(s,s);

  ctx.beginPath();
  ctx.arc(0,0, t.r+6, 0, Math.PI*2);
  ctx.fillStyle = t.type.soft;
  ctx.fill();

  if(t.type.kind === 'swatch'){
    ctx.beginPath();
    ctx.arc(0,0,t.r*0.62,0,Math.PI*2);
    ctx.fillStyle = t.type.color;
    ctx.fill();
  } else if(t.type.kind === 'type'){
    ctx.fillStyle = t.type.color;
    ctx.font = '700 15px Space Grotesk, sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('Aa', 0, 1);
  } else {
    ctx.strokeStyle = t.type.color;
    ctx.lineWidth = 2;
    const g = t.r*0.55;
    ctx.beginPath();
    ctx.moveTo(-g,0); ctx.lineTo(g,0);
    ctx.moveTo(0,-g); ctx.lineTo(0,g);
    roundRectAbs(-g,-g,g*2,g*2,3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShield(s){
  ctx.save();
  ctx.translate(s.x,s.y);
  const pulse = 1+Math.sin(s.pulse)*0.12;
  ctx.scale(pulse,pulse);
  ctx.beginPath();
  ctx.arc(0,0,s.r+7,0,Math.PI*2);
  ctx.fillStyle = '#E8E7FF';
  ctx.fill();
  ctx.strokeStyle = '#5551FF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0,0,s.r-2,0,Math.PI*2);
  ctx.stroke();
  ctx.fillStyle = '#5551FF';
  ctx.font = '700 13px Space Grotesk, sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('?', 0, 1);
  ctx.restore();
}

function drawEnemy(e){
  const bob = Math.sin(e.wobblePhase*1.3) * 4;
  ctx.save();
  ctx.translate(e.x, e.y+bob);

  ctx.font = '600 11px Inter, sans-serif';
  const maxW = 168;
  const words = e.text.split(' ');
  let lines = [];
  let cur = '';
  for(const w of words){
    const test = cur ? cur+' '+w : w;
    if(ctx.measureText(test).width > maxW-24 && cur){
      lines.push(cur); cur = w;
    } else { cur = test; }
  }
  if(cur) lines.push(cur);
  const lineH = 15;
  const bh = lines.length*lineH + 22;
  const bw = maxW;

  // bubble
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FF5C5C';
  ctx.lineWidth = 2;
  roundRectAbs(-bw/2, -bh - 14, bw, bh, 12);
  ctx.fill();
  ctx.stroke();

  // tail
  ctx.beginPath();
  ctx.moveTo(-8,-14);
  ctx.lineTo(8,-14);
  ctx.lineTo(-2,-2);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-8,-14); ctx.lineTo(-2,-2); ctx.lineTo(3,-13.5);
  ctx.strokeStyle='#FF5C5C'; ctx.stroke();

  // avatar chip
  ctx.beginPath();
  ctx.arc(-bw/2+18, -bh, 12, 0, Math.PI*2);
  ctx.fillStyle = '#FFE7E7';
  ctx.fill();
  ctx.fillStyle = '#FF5C5C';
  ctx.font = '700 9px Space Grotesk, sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(e.avatar, -bw/2+18, -bh+1);
  ctx.restore();

  // text (drawn in its own pass, positioned relative to the bubble)
  ctx.save();
  ctx.translate(e.x, e.y+bob);
  ctx.fillStyle = '#3A3A42';
  ctx.font = '600 11px Inter, sans-serif';
  ctx.textAlign='left';
  ctx.textBaseline = 'middle';
  const topY = -14 - bh + 16;
  lines.forEach((l,i)=>{
    ctx.fillText(l, -bw/2+34, topY + i*lineH);
  });
  ctx.restore();

  // pin dot at true position
  ctx.save();
  ctx.translate(e.x,e.y+bob);
  ctx.beginPath();
  ctx.arc(0,0,4,0,Math.PI*2);
  ctx.fillStyle = '#FF5C5C';
  ctx.fill();
  ctx.restore();
}

function drawParticles(){
  particles.forEach(p=>{
    const t = 1 - p.age/p.life;
    ctx.globalAlpha = clamp(t,0,1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.size*t,0,Math.PI*2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function draw(){
  ctx.clearRect(0,0,W,H);

  ctx.save();
  if(shakeAmount>0){
    ctx.translate(rand(-shakeAmount,shakeAmount), rand(-shakeAmount,shakeAmount));
  }

  drawDotGrid();
  shields.forEach(drawShield);
  tokens.forEach(drawToken);
  enemies.forEach(drawEnemy);
  drawParticles();
  drawPlayer();

  ctx.restore();

  if(flashAmount>0){
    ctx.fillStyle = `rgba(255,92,92,${flashAmount*0.25})`;
    ctx.fillRect(0,0,W,H);
  }
}

// ---------- loop ----------
function loop(now){
  const dt = Math.min((now-lastTime)/1000, 0.05);
  lastTime = now;

  if(state === 'playing'){
    update(dt);
    draw();
    requestAnimationFrame(loop);
  } else if(state === 'over'){
    draw();
  }
}

// idle background render (subtle grid before play)
function idleFrame(){
  ctx.clearRect(0,0,W,H);
  drawDotGrid();
  if(state === 'idle') requestAnimationFrame(idleFrame);
}
idleFrame();
