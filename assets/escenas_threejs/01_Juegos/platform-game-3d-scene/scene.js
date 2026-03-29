import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// Scene setup — bright blue Mario sky
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x5c94fc);
scene.fog = new THREE.FogExp2(0x5c94fc, 0.008);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 5, 18);
camera.lookAt(0, 3, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
const root = document.getElementById('root') ?? document.body;
root.appendChild(renderer.domElement);

// Post-processing — subtle bloom for coins
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.35, 0.5, 0.9
);
composer.addPass(bloomPass);

// Lighting — bright sunny Mario world
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
ambientLight.name = 'ambientLight';
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.5);
sunLight.name = 'sunLight';
sunLight.position.set(10, 20, 12);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 60;
sunLight.shadow.camera.left = -20;
sunLight.shadow.camera.right = 20;
sunLight.shadow.camera.top = 20;
sunLight.shadow.camera.bottom = -5;
sunLight.shadow.radius = 3;
sunLight.shadow.bias = -0.0005;
sunLight.shadow.normalBias = 0.02;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x88bbff, 0.3);
fillLight.name = 'fillLight';
fillLight.position.set(-8, 6, -4);
scene.add(fillLight);

// ===== MATERIALS =====
const marioRedMat = new THREE.MeshStandardMaterial({ color: 0xe52521, roughness: 0.5, metalness: 0.05 });
const marioSkinMat = new THREE.MeshStandardMaterial({ color: 0xfbb37a, roughness: 0.5, metalness: 0.0 });
const marioBlueMat = new THREE.MeshStandardMaterial({ color: 0x2038ec, roughness: 0.5, metalness: 0.05 });
const marioWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.0 });
const marioEyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.2, metalness: 0.1 });
const marioMustacheMat = new THREE.MeshStandardMaterial({ color: 0x2a1506, roughness: 0.6, metalness: 0.0 });
const marioShoeMat = new THREE.MeshStandardMaterial({ color: 0x6b3a1f, roughness: 0.6, metalness: 0.05 });

const brickMat = new THREE.MeshStandardMaterial({ color: 0xc84c09, roughness: 0.7, metalness: 0.05 });
const brickLineMat = new THREE.MeshStandardMaterial({ color: 0x8a3006, roughness: 0.8, metalness: 0.0 });
const questionMat = new THREE.MeshStandardMaterial({ color: 0xffa500, roughness: 0.4, metalness: 0.15, emissive: 0xffa500, emissiveIntensity: 0.15 });
const questionMarkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 });

const groundMat = new THREE.MeshStandardMaterial({ color: 0xc84c09, roughness: 0.7, metalness: 0.05 });
const grassMat = new THREE.MeshStandardMaterial({ color: 0x00a800, roughness: 0.6, metalness: 0.05 });
const dirtMat = new THREE.MeshStandardMaterial({ color: 0xd2691e, roughness: 0.8, metalness: 0.0 });

const pipeDarkGreen = new THREE.MeshStandardMaterial({ color: 0x00a800, roughness: 0.4, metalness: 0.15 });
const pipeLightGreen = new THREE.MeshStandardMaterial({ color: 0x30d030, roughness: 0.35, metalness: 0.15 });
const pipeHighlight = new THREE.MeshStandardMaterial({ color: 0x60ff60, roughness: 0.3, metalness: 0.2 });

const coinMat = new THREE.MeshStandardMaterial({
  color: 0xffd700, roughness: 0.2, metalness: 0.7,
  emissive: 0xffa500, emissiveIntensity: 0.3
});

// ===== AUDIO — Web Audio API coin sound =====
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playCoinSound() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;

  // "Cha" — bright metallic ping
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'square';
  osc1.frequency.setValueAtTime(988, now);           // B5
  osc1.frequency.setValueAtTime(1319, now + 0.06);   // E6
  gain1.gain.setValueAtTime(0.15, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc1.connect(gain1).connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.15);

  // "Ching" — higher shimmer
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1319, now + 0.06);   // E6
  osc2.frequency.setValueAtTime(1568, now + 0.1);    // G6
  gain2.gain.setValueAtTime(0, now);
  gain2.gain.linearRampToValueAtTime(0.12, now + 0.07);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(now + 0.06);
  osc2.stop(now + 0.35);

  // Sparkle harmonic
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(2637, now + 0.08);   // E7
  gain3.gain.setValueAtTime(0, now);
  gain3.gain.linearRampToValueAtTime(0.06, now + 0.1);
  gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc3.connect(gain3).connect(ctx.destination);
  osc3.start(now + 0.08);
  osc3.stop(now + 0.3);
}

function playJumpSound() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;

  // Ascending "boing" — quick sine sweep up
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(280, now);
  osc1.frequency.exponentialRampToValueAtTime(780, now + 0.12);
  gain1.gain.setValueAtTime(0.13, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc1.connect(gain1).connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.15);

  // Soft harmonic overtone for springy feel
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(560, now);
  osc2.frequency.exponentialRampToValueAtTime(1400, now + 0.1);
  gain2.gain.setValueAtTime(0.06, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + 0.12);
}

function playLandSound() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;

  // Low thump — fast pitch drop
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);

  // Subtle noise burst for impact texture
  const bufferSize = ctx.sampleRate * 0.06;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.07, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  noise.connect(filter).connect(noiseGain).connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.06);
}

function playBumpSound() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

function playPowerUpSound() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  // Cheerful ascending scale: C5 D5 E5 F5 G5 A5 B5 C6
  const notes = [523, 587, 659, 698, 784, 880, 988, 1047];
  const step = 0.06;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + i * step);
    gain.gain.setValueAtTime(0, now + i * step);
    gain.gain.linearRampToValueAtTime(0.1, now + i * step + 0.01);
    gain.gain.setValueAtTime(0.1, now + i * step + step * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * step + step);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * step);
    osc.stop(now + i * step + step + 0.02);
  });
  // Final shimmer
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(2093, now + notes.length * step);
  gain2.gain.setValueAtTime(0.08, now + notes.length * step);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + notes.length * step + 0.3);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(now + notes.length * step);
  osc2.stop(now + notes.length * step + 0.3);
}

function playPowerDownSound() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  // Descending scale: C6 B5 A5 G5 F5 E5 D5 C5
  const notes = [1047, 988, 880, 784, 698, 659, 587, 523];
  const step = 0.055;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + i * step);
    gain.gain.setValueAtTime(0, now + i * step);
    gain.gain.linearRampToValueAtTime(0.09, now + i * step + 0.01);
    gain.gain.setValueAtTime(0.09, now + i * step + step * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * step + step);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * step);
    osc.stop(now + i * step + step + 0.02);
  });
  // Final low thud
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(180, now + notes.length * step);
  osc2.frequency.exponentialRampToValueAtTime(60, now + notes.length * step + 0.15);
  gain2.gain.setValueAtTime(0.1, now + notes.length * step);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + notes.length * step + 0.2);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(now + notes.length * step);
  osc2.stop(now + notes.length * step + 0.2);
}

function playStompSound() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  // Satisfying squish — short descending thwack
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
  // Squelch noise
  const bufSize = ctx.sampleRate * 0.07;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * 0.2;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.1, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 600;
  filt.Q.value = 2;
  noise.connect(filt).connect(ng).connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.07);
}

function playMushroomAppearSound() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(330, now);
  osc.frequency.exponentialRampToValueAtTime(660, now + 0.15);
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

// ===== HUD =====
let coinCount = 0;
const coinCountEl = document.getElementById('coin-count');
const coinHud = document.getElementById('coin-hud');

// Score system
let totalScore = 0;
const scoreValueEl = document.getElementById('score-value');
const scoreHud = document.getElementById('score-hud');

// Combo points for successive shell kills: 100 → 200 → 400 → 800 → 1000 (1UP)
const comboPoints = [100, 200, 400, 800, 1000];
const comboLabels = ['100', '200', '400', '800', '1UP'];

// === LIVES SYSTEM ===
let lives = 3;
let coinsFor1UP = 0;        // coins towards next 1UP (resets at 10)
let isGameOver = false;
const heartEls = [
  document.getElementById('heart0'),
  document.getElementById('heart1'),
  document.getElementById('heart2')
];
const gameOverOverlay = document.getElementById('game-over-overlay');
const retryBtn = document.getElementById('retry-btn');

function updateHeartsHUD() {
  heartEls.forEach((el, i) => {
    el.classList.remove('empty', 'lost', 'gained');
    if (i < lives) {
      // filled heart
    } else {
      el.classList.add('empty');
    }
  });
}
updateHeartsHUD();

function loseLife() {
  if (isGameOver) return;
  lives--;
  if (lives >= 0 && lives < 3) {
    const lostHeart = heartEls[lives];
    lostHeart.classList.remove('lost');
    void lostHeart.offsetWidth;
    lostHeart.classList.add('lost');
    setTimeout(() => lostHeart.classList.add('empty'), 500);
  }
  if (lives <= 0) {
    triggerGameOver();
  }
}

function gainLife() {
  if (isGameOver || lives >= 3) return;
  const idx = lives;
  lives++;
  heartEls[idx].classList.remove('empty', 'lost');
  heartEls[idx].classList.add('gained');
  play1UPSound();
  // Show floating 1UP text at Mario's position
  createScoreText(
    new THREE.Vector3(character.position.x, character.position.y + 1.5, character.position.z),
    '1UP', '#44ff44'
  );
  createSparkleBurst(character.position.clone(), 0x44ff44);
  createSparkleBurst(
    new THREE.Vector3(character.position.x, character.position.y + 0.8, character.position.z),
    0xffffff
  );
}

function play1UPSound() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  // Cheerful ascending fanfare — E5 G5 B5 E6
  const notes = [659, 784, 988, 1319, 1568];
  const step = 0.07;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + i * step);
    gain.gain.setValueAtTime(0, now + i * step);
    gain.gain.linearRampToValueAtTime(0.11, now + i * step + 0.015);
    gain.gain.setValueAtTime(0.11, now + i * step + step * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * step + step + 0.02);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * step);
    osc.stop(now + i * step + step + 0.04);
  });
  // High shimmer at the end
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(2637, now + notes.length * step);
  gain2.gain.setValueAtTime(0.08, now + notes.length * step);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + notes.length * step + 0.4);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(now + notes.length * step);
  osc2.stop(now + notes.length * step + 0.4);
}

function playGameOverSound() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  // Dramatic descending jingle: E5 D5 C5 B4 A4 ... slow tempo
  const notes = [659, 587, 523, 494, 440, 392, 349, 330, 262];
  const step = 0.12;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + i * step);
    gain.gain.setValueAtTime(0, now + i * step);
    gain.gain.linearRampToValueAtTime(0.1, now + i * step + 0.02);
    gain.gain.setValueAtTime(0.08, now + i * step + step * 0.75);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * step + step + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * step);
    osc.stop(now + i * step + step + 0.06);
  });
  // Final low bass hit
  const endT = now + notes.length * step;
  const bassOsc = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bassOsc.type = 'sine';
  bassOsc.frequency.setValueAtTime(130, endT);
  bassOsc.frequency.exponentialRampToValueAtTime(55, endT + 0.5);
  bassGain.gain.setValueAtTime(0.15, endT);
  bassGain.gain.exponentialRampToValueAtTime(0.001, endT + 0.8);
  bassOsc.connect(bassGain).connect(ctx.destination);
  bassOsc.start(endT);
  bassOsc.stop(endT + 0.8);
}

function triggerGameOver() {
  isGameOver = true;
  playGameOverSound();
  // Show game over screen with delay for dramatic effect
  setTimeout(() => {
    gameOverOverlay.classList.add('active');
  }, 600);
}

function resetGame() {
  isGameOver = false;
  lives = 3;
  totalScore = 0;
  coinCount = 0;
  coinsFor1UP = 0;
  isBigMario = false;
  marioScaleTarget = 1;
  marioScaleCurrent = 1;
  growAnimTime = -1;
  shrinkAnimTime = -1;
  isInvincible = false;
  invincibleTime = 0;
  character.scale.setScalar(1);
  character.position.set(-4, 0.6, 2);
  charY = 0.6;
  velocityY = 0;
  isGrounded = true;
  // Reset level
  currentLevel = 0;
  levelTransitioning = false;
  levelTransitionTimer = 0;
  applyLevelTheme(0);
  updateLevelBar();
  levelOverlay.classList.remove('active');
  // Reset visuals
  character.traverse(child => {
    if (child.isMesh && child.material) {
      if (child.material._origTransparent !== undefined) {
        child.material.transparent = child.material._origTransparent;
        child.material.opacity = child.material._origOpacity;
        delete child.material._origTransparent;
        delete child.material._origOpacity;
      }
    }
  });
  // Update HUD
  updateHeartsHUD();
  scoreValueEl.textContent = '000000';
  coinCountEl.textContent = '00';
  document.getElementById('super-indicator').classList.remove('active');
  gameOverOverlay.classList.remove('active');
  // Reset all coins
  collectibles.forEach(c => {
    const d = c.userData;
    d.collected = false;
    d.isFlashing = false;
    d.collectAnim = undefined;
    d.respawnTimer = 0;
    c.visible = true;
    d.coin.scale.setScalar(1);
    d.glowSphere.scale.setScalar(1);
    d.glowSphere.material.opacity = 0.1;
    d.coinMat.emissiveIntensity = 0.3;
    d.light.intensity = 0.5;
    d.particles.material.opacity = 0.5;
  });
  // Reset ? blocks
  platforms.forEach(p => {
    const d = p.userData;
    if (d && d.isQuestion) {
      d.bumped = false;
      d.bumpTime = 0;
      p.position.y = d.baseY;
      p.children[0].material = questionMat.clone();
    }
  });
  // Reset enemies
  goombas.forEach(g => {
    const gd = g.userData;
    gd.alive = true;
    gd.squished = false;
    gd.squishTime = 0;
    gd.respawning = false;
    gd.respawnTime = 0;
    gd.velocityX = 1.2 * (Math.random() > 0.5 ? 1 : -1);
    gd.velocityY = 0;
    g.position.set(gd.startX, gd.startY, gd.startZ);
    gd.bodyParts.forEach(p => p.visible = true);
    gd.squishMesh.visible = false;
    gd.xEyes.forEach(x => x.visible = false);
    g.scale.set(1, 1, 1);
    g.rotation.set(0, 0, 0);
    g.visible = true;
  });
  koopas.forEach(k => {
    const kd = k.userData;
    kd.alive = true;
    kd.state = 'walking';
    kd.respawning = false;
    kd.respawnTime = 0;
    kd.stompTime = 0;
    kd.shellVelocityX = 0;
    kd.shellSpinAngle = 0;
    kd.comboCount = 0;
    kd.velocityX = 1.0 * (Math.random() > 0.5 ? 1 : -1);
    kd.velocityY = 0;
    k.position.set(kd.startX, kd.startY, kd.startZ);
    kd.walkGroup.visible = true;
    kd.shellGroup.visible = false;
    k.visible = true;
    k.scale.setScalar(1);
    k.rotation.set(0, 0, 0);
  });
}

retryBtn.addEventListener('click', () => {
  resetGame();
});

// === LEVEL SYSTEM ===
const levelDefs = [
  { world: '1-1', name: 'GRASSLAND',    target: 200,  sky: 0x5c94fc, fog: 0x5c94fc, speed: 1.0,  enemySpeed: 1.0, gravity: 1.0  },
  { world: '1-2', name: 'UNDERGROUND',  target: 500,  sky: 0x1a1a2e, fog: 0x1a1a2e, speed: 1.1,  enemySpeed: 1.15, gravity: 1.0  },
  { world: '1-3', name: 'TWILIGHT',     target: 1000, sky: 0x4a2060, fog: 0x4a2060, speed: 1.15, enemySpeed: 1.3, gravity: 1.0  },
  { world: '1-4', name: 'CASTLE',       target: 2000, sky: 0x2a0a0a, fog: 0x2a0a0a, speed: 1.2,  enemySpeed: 1.5, gravity: 1.05 },
  { world: '2-1', name: 'SKY GARDEN',   target: 3500, sky: 0x88ccff, fog: 0x88ccff, speed: 1.3,  enemySpeed: 1.6, gravity: 0.95 },
  { world: '2-2', name: 'LAVA DEPTHS',  target: 5000, sky: 0x3a0800, fog: 0x3a0800, speed: 1.35, enemySpeed: 1.8, gravity: 1.1  },
  { world: '2-3', name: 'STAR ROAD',    target: 8000, sky: 0x0a0a30, fog: 0x0a0a30, speed: 1.4,  enemySpeed: 2.0, gravity: 1.0  },
  { world: '∞',   name: 'ENDLESS',      target: 99999,sky: 0x5c94fc, fog: 0x5c94fc, speed: 1.5,  enemySpeed: 2.2, gravity: 1.0  },
];
let currentLevel = 0;
let levelTransitioning = false;
let levelTransitionTimer = 0;
let lastLevelScore = 0; // score at which current level started

const levelOverlay = document.getElementById('level-overlay');
const levelOverlayWorld = document.getElementById('level-overlay-world');
const levelOverlayName = document.getElementById('level-overlay-name');
const levelOverlayLives = document.getElementById('level-overlay-lives');
const levelBarFill = document.getElementById('level-bar-fill');
const levelBarLabel = document.getElementById('level-bar-label');
const levelBarTarget = document.getElementById('level-bar-target');
const worldLabel = document.getElementById('world-label');

function updateLevelBar() {
  const def = levelDefs[currentLevel];
  const prevTarget = currentLevel > 0 ? levelDefs[currentLevel - 1].target : 0;
  const range = def.target - prevTarget;
  const progress = Math.max(0, Math.min(1, (totalScore - prevTarget) / range));
  levelBarFill.style.width = (progress * 100) + '%';
  levelBarLabel.textContent = 'LV ' + (currentLevel + 1);
  levelBarTarget.textContent = def.target;
}

function applyLevelTheme(lvl) {
  const def = levelDefs[lvl];
  const skyColor = new THREE.Color(def.sky);
  const fogColor = new THREE.Color(def.fog);

  // Smooth transition colors
  scene.background = skyColor;
  scene.fog.color = fogColor;
  document.body.style.background = '#' + skyColor.getHexString();
  document.querySelector('html').style.background = '#' + skyColor.getHexString();
  const rootEl = document.getElementById('root');
  if (rootEl) rootEl.style.background = '#' + skyColor.getHexString();

  // Adjust lighting per level
  if (lvl === 1) {
    // Underground — darker, bluer
    ambientLight.intensity = 0.35;
    sunLight.intensity = 0.6;
    sunLight.color.setHex(0x6688cc);
    fillLight.intensity = 0.4;
    fillLight.color.setHex(0x4466aa);
    grassMat.color.setHex(0x005500);
    groundMat.color.setHex(0x664422);
    dirtMat.color.setHex(0x554433);
  } else if (lvl === 2) {
    // Twilight — purple tones
    ambientLight.intensity = 0.5;
    sunLight.intensity = 1.0;
    sunLight.color.setHex(0xff8866);
    fillLight.intensity = 0.35;
    fillLight.color.setHex(0x8844cc);
    grassMat.color.setHex(0x226622);
    groundMat.color.setHex(0x884422);
    dirtMat.color.setHex(0x553322);
  } else if (lvl === 3) {
    // Castle — dark red
    ambientLight.intensity = 0.3;
    sunLight.intensity = 0.8;
    sunLight.color.setHex(0xff4422);
    fillLight.intensity = 0.3;
    fillLight.color.setHex(0xff2200);
    grassMat.color.setHex(0x333333);
    groundMat.color.setHex(0x555555);
    dirtMat.color.setHex(0x443333);
  } else if (lvl === 4) {
    // Sky Garden — bright heavenly
    ambientLight.intensity = 0.8;
    sunLight.intensity = 1.8;
    sunLight.color.setHex(0xffffff);
    fillLight.intensity = 0.5;
    fillLight.color.setHex(0xaaddff);
    grassMat.color.setHex(0x44cc44);
    groundMat.color.setHex(0xddaa66);
    dirtMat.color.setHex(0xcc9944);
  } else if (lvl === 5) {
    // Lava Depths — fiery
    ambientLight.intensity = 0.25;
    sunLight.intensity = 0.9;
    sunLight.color.setHex(0xff6600);
    fillLight.intensity = 0.5;
    fillLight.color.setHex(0xff3300);
    grassMat.color.setHex(0x553300);
    groundMat.color.setHex(0x662200);
    dirtMat.color.setHex(0x441100);
  } else if (lvl === 6) {
    // Star Road — deep space
    ambientLight.intensity = 0.4;
    sunLight.intensity = 1.0;
    sunLight.color.setHex(0xaaaaff);
    fillLight.intensity = 0.4;
    fillLight.color.setHex(0x6644ff);
    grassMat.color.setHex(0x2244aa);
    groundMat.color.setHex(0x333366);
    dirtMat.color.setHex(0x222244);
  } else {
    // Default / Endless — reset to normal
    ambientLight.intensity = 0.7;
    sunLight.intensity = 1.5;
    sunLight.color.setHex(0xfff5e0);
    fillLight.intensity = 0.3;
    fillLight.color.setHex(0x88bbff);
    grassMat.color.setHex(0x00a800);
    groundMat.color.setHex(0xc84c09);
    dirtMat.color.setHex(0xd2691e);
  }

  // Update world label
  worldLabel.innerHTML = 'WORLD<span class="sub">' + def.world + '</span>';
  updateLevelBar();
}

function playLevelUpSound() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  // Triumphant ascending fanfare: C5 E5 G5 C6 E6 G6 C7
  const notes = [523, 659, 784, 1047, 1319, 1568, 2093];
  const step = 0.08;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now + i * step);
    gain.gain.setValueAtTime(0, now + i * step);
    gain.gain.linearRampToValueAtTime(0.12, now + i * step + 0.01);
    gain.gain.setValueAtTime(0.1, now + i * step + step * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * step + step + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * step);
    osc.stop(now + i * step + step + 0.05);
  });
  // Grand final chord
  const endT = now + notes.length * step;
  [2093, 2637, 3136].forEach(freq => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, endT);
    gain.gain.setValueAtTime(0.07, endT);
    gain.gain.exponentialRampToValueAtTime(0.001, endT + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(endT);
    osc.stop(endT + 0.5);
  });
}

function checkLevelUp() {
  if (levelTransitioning || isGameOver) return;
  const def = levelDefs[currentLevel];
  if (totalScore >= def.target && currentLevel < levelDefs.length - 1) {
    triggerLevelTransition();
  }
  updateLevelBar();
}

function triggerLevelTransition() {
  levelTransitioning = true;
  levelTransitionTimer = 0;
  currentLevel++;

  const def = levelDefs[currentLevel];
  playLevelUpSound();

  // Show level overlay
  levelOverlayWorld.textContent = 'WORLD';
  levelOverlayName.textContent = def.world + ' ' + def.name;
  levelOverlayLives.textContent = lives;
  levelOverlay.classList.add('active');

  // Apply theme during overlay
  setTimeout(() => {
    applyLevelTheme(currentLevel);
    // Reset enemy speeds for the new level
    goombas.forEach(g => {
      const base = 1.2 * def.enemySpeed;
      g.userData.velocityX = base * (g.userData.velocityX > 0 ? 1 : -1);
    });
    koopas.forEach(k => {
      if (k.userData.state === 'walking') {
        const base = 1.0 * def.enemySpeed;
        k.userData.velocityX = base * (k.userData.velocityX > 0 ? 1 : -1);
      }
    });
  }, 800);

  // Reset coins for new level
  setTimeout(() => {
    collectibles.forEach(c => {
      const d = c.userData;
      d.collected = false;
      d.isFlashing = false;
      d.collectAnim = undefined;
      d.respawnTimer = 0;
      c.visible = true;
      d.coin.scale.setScalar(1);
      d.glowSphere.scale.setScalar(1);
      d.glowSphere.material.opacity = 0.1;
      d.coinMat.emissiveIntensity = 0.3;
      d.light.intensity = 0.5;
      d.particles.material.opacity = 0.5;
    });
    // Reset ? blocks
    platforms.forEach(p => {
      const d = p.userData;
      if (d && d.isQuestion) {
        d.bumped = false;
        d.bumpTime = 0;
        p.position.y = d.baseY;
        p.children[0].material = questionMat.clone();
      }
    });
  }, 1000);

  // Hide overlay and resume
  setTimeout(() => {
    levelOverlay.classList.remove('active');
    levelTransitioning = false;
    // Reset Mario position
    character.position.set(-4, 0.6, 2);
    charY = 0.6;
    velocityY = 0;
    isGrounded = true;
    // Create sparkle celebratory burst
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        createSparkleBurst(
          new THREE.Vector3(
            character.position.x + (Math.random() - 0.5) * 2,
            character.position.y + Math.random() * 1.5,
            character.position.z + (Math.random() - 0.5) * 1
          ),
          [0xffd700, 0xff4444, 0x44ff44, 0x4488ff, 0xff44ff][i]
        );
      }, i * 100);
    }
  }, 2800);
}

// Initialize level bar
updateLevelBar();

function addScore(points) {
  totalScore += points;
  if (totalScore < 0) totalScore = 0;
  scoreValueEl.textContent = totalScore.toString().padStart(6, '0');
  scoreHud.classList.remove('pop');
  scoreHud.classList.remove('lose');
  void scoreHud.offsetWidth;
  scoreHud.classList.add('pop');
  checkLevelUp();
}

function loseScore(points, position) {
  totalScore -= points;
  if (totalScore < 0) totalScore = 0;
  scoreValueEl.textContent = totalScore.toString().padStart(6, '0');
  scoreHud.classList.remove('pop');
  scoreHud.classList.remove('lose');
  void scoreHud.offsetWidth;
  scoreHud.classList.add('lose');
  updateLevelBar();
  // Show floating penalty text
  if (position) {
    createScoreText(position.clone(), '-' + points, '#ff4444');
  }
  // Play penalty sound
  playPenaltySound();
}

function playPenaltySound() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  // Descending "ouch" — two quick tones dropping
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'square';
  osc1.frequency.setValueAtTime(400, now);
  osc1.frequency.exponentialRampToValueAtTime(180, now + 0.15);
  gain1.gain.setValueAtTime(0.12, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc1.connect(gain1).connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.2);
  // Second lower tone
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(250, now + 0.05);
  osc2.frequency.exponentialRampToValueAtTime(100, now + 0.2);
  gain2.gain.setValueAtTime(0.1, now + 0.05);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(now + 0.05);
  osc2.stop(now + 0.25);
}

function updateCoinHUD() {
  coinCount++;
  coinCountEl.textContent = coinCount.toString().padStart(2, '0');
  // Trigger pop animation
  coinHud.classList.remove('pop');
  void coinHud.offsetWidth; // reflow
  coinHud.classList.add('pop');
  // Coins are worth 200 points
  addScore(200);
  // Every 10 coins = 1UP!
  coinsFor1UP++;
  if (coinsFor1UP >= 10) {
    coinsFor1UP = 0;
    gainLife();
  }
}

// Combo-aware floating score text (supports custom label + color)
function createScoreText(position, label, textColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 52px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 7;
  ctx.strokeText(label, 128, 40);
  ctx.fillStyle = textColor || '#ffd700';
  ctx.fillText(label, 128, 40);

  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: 1,
    depthTest: false, blending: THREE.AdditiveBlending
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.name = 'scoreText_' + floatingTexts.length;
  sprite.position.copy(position);
  sprite.position.y += 0.6;
  sprite.scale.set(2.0, 0.6, 1);
  scene.add(sprite);
  floatingTexts.push({ sprite, life: 0, maxLife: 1.0, startY: position.y + 0.6 });
}

function playComboSound(comboIndex) {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  // Rising pitch based on combo index — gets more exciting!
  const basePitch = 500 + comboIndex * 200;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(basePitch, now);
  osc.frequency.exponentialRampToValueAtTime(basePitch * 1.5, now + 0.1);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.15);

  // Shimmer overtone
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(basePitch * 2, now + 0.05);
  gain2.gain.setValueAtTime(0.07, now + 0.05);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(now + 0.05);
  osc2.stop(now + 0.2);

  // Extra fanfare for 1UP
  if (comboIndex >= 4) {
    const notes = [784, 988, 1175, 1319, 1568];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(freq, now + 0.08 + i * 0.05);
      g.gain.setValueAtTime(0.09, now + 0.08 + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15 + i * 0.05);
      o.connect(g).connect(ctx.destination);
      o.start(now + 0.08 + i * 0.05);
      o.stop(now + 0.18 + i * 0.05);
    });
  }
}

// ===== GROUND — multi-layer like Mario =====
const groundGroup = new THREE.Group();
groundGroup.name = 'groundGroup';

// Grass top layer
const grassTop = new THREE.Mesh(new THREE.BoxGeometry(60, 0.5, 12), grassMat);
grassTop.name = 'grassTop';
grassTop.position.y = -0.25;
grassTop.receiveShadow = true;
groundGroup.add(grassTop);

// Dirt layer below
const dirtLayer = new THREE.Mesh(new THREE.BoxGeometry(60, 2.0, 12), dirtMat);
dirtLayer.name = 'dirtLayer';
dirtLayer.position.y = -1.5;
dirtLayer.receiveShadow = true;
groundGroup.add(dirtLayer);

// Brick pattern on dirt face
for (let row = 0; row < 3; row++) {
  for (let col = -14; col <= 14; col++) {
    const brickLine = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 0.02, 0.02),
      brickLineMat
    );
    brickLine.name = `brickLineH_${row}_${col}`;
    brickLine.position.set(col * 2, -0.6 - row * 0.65, 6.01);
    groundGroup.add(brickLine);
  }
}

scene.add(groundGroup);

// ===== MARIO CHARACTER =====
const character = new THREE.Group();
character.name = 'mario';

// Body (blue overalls)
const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.5, 8, 16);
const body = new THREE.Mesh(bodyGeo, marioBlueMat);
body.name = 'marioBody';
body.castShadow = true;
character.add(body);

// Overall strap details
const strapGeo = new THREE.BoxGeometry(0.08, 0.35, 0.35);
const strapL = new THREE.Mesh(strapGeo, marioBlueMat);
strapL.name = 'strapL';
strapL.position.set(-0.25, 0.25, 0);
character.add(strapL);
const strapR = new THREE.Mesh(strapGeo, marioBlueMat);
strapR.name = 'strapR';
strapR.position.set(0.25, 0.25, 0);
character.add(strapR);

// Overall buttons
const buttonGeo = new THREE.SphereGeometry(0.04, 8, 8);
const buttonMatY = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.4 });
const btnL = new THREE.Mesh(buttonGeo, buttonMatY);
btnL.name = 'buttonL';
btnL.position.set(-0.25, 0.2, 0.28);
character.add(btnL);
const btnR = new THREE.Mesh(buttonGeo, buttonMatY);
btnR.name = 'buttonR';
btnR.position.set(0.25, 0.2, 0.28);
character.add(btnR);

// Head (skin)
const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), marioSkinMat);
head.name = 'marioHead';
head.position.y = 0.72;
head.castShadow = true;
character.add(head);

// Hat — red cap
const hatBrim = new THREE.Mesh(
  new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16),
  marioRedMat
);
hatBrim.name = 'hatBrim';
hatBrim.position.set(0, 0.92, 0.08);
hatBrim.castShadow = true;
character.add(hatBrim);

const hatTop = new THREE.Mesh(
  new THREE.SphereGeometry(0.33, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  marioRedMat
);
hatTop.name = 'hatTop';
hatTop.position.set(0, 0.93, -0.02);
hatTop.castShadow = true;
character.add(hatTop);

// Hat "M" emblem — small white circle
const emblemGeo = new THREE.CircleGeometry(0.1, 16);
const emblemMesh = new THREE.Mesh(emblemGeo, marioWhiteMat);
emblemMesh.name = 'hatEmblem';
emblemMesh.position.set(0, 0.96, 0.32);
character.add(emblemMesh);

// Nose (big and round!)
const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), marioSkinMat);
nose.name = 'marioNose';
nose.position.set(0, 0.65, 0.35);
nose.scale.set(1, 0.8, 1.2);
character.add(nose);

// Eyes
const eyeWhiteGeo = new THREE.SphereGeometry(0.09, 8, 8);
const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, marioWhiteMat);
leftEyeWhite.name = 'leftEyeWhite';
leftEyeWhite.position.set(-0.13, 0.77, 0.28);
character.add(leftEyeWhite);
const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, marioWhiteMat);
rightEyeWhite.name = 'rightEyeWhite';
rightEyeWhite.position.set(0.13, 0.77, 0.28);
character.add(rightEyeWhite);

const pupilGeo = new THREE.SphereGeometry(0.05, 8, 8);
const leftPupil = new THREE.Mesh(pupilGeo, marioEyeMat);
leftPupil.name = 'leftPupil';
leftPupil.position.set(-0.12, 0.77, 0.35);
character.add(leftPupil);
const rightPupil = new THREE.Mesh(pupilGeo, marioEyeMat);
rightPupil.name = 'rightPupil';
rightPupil.position.set(0.12, 0.77, 0.35);
character.add(rightPupil);

// Mustache
const mustacheGeo = new THREE.BoxGeometry(0.28, 0.06, 0.08);
const mustache = new THREE.Mesh(mustacheGeo, marioMustacheMat);
mustache.name = 'mustache';
mustache.position.set(0, 0.6, 0.32);
character.add(mustache);

// Left mustache curl
const mustCurlL = new THREE.Mesh(
  new THREE.SphereGeometry(0.05, 6, 6), marioMustacheMat
);
mustCurlL.name = 'mustCurlL';
mustCurlL.position.set(-0.16, 0.6, 0.3);
character.add(mustCurlL);
const mustCurlR = new THREE.Mesh(
  new THREE.SphereGeometry(0.05, 6, 6), marioMustacheMat
);
mustCurlR.name = 'mustCurlR';
mustCurlR.position.set(0.16, 0.6, 0.3);
character.add(mustCurlR);

// Arms (skin)
const armGeo = new THREE.CapsuleGeometry(0.1, 0.25, 4, 8);
const leftArm = new THREE.Mesh(armGeo, marioSkinMat);
leftArm.name = 'leftArm';
leftArm.position.set(-0.42, 0.1, 0);
leftArm.rotation.z = 0.3;
leftArm.castShadow = true;
character.add(leftArm);
const rightArm = new THREE.Mesh(armGeo, marioSkinMat);
rightArm.name = 'rightArm';
rightArm.position.set(0.42, 0.1, 0);
rightArm.rotation.z = -0.3;
rightArm.castShadow = true;
character.add(rightArm);

// Gloves
const gloveGeo = new THREE.SphereGeometry(0.1, 8, 8);
const leftGlove = new THREE.Mesh(gloveGeo, marioWhiteMat);
leftGlove.name = 'leftGlove';
leftGlove.position.set(-0.5, -0.05, 0);
character.add(leftGlove);
const rightGlove = new THREE.Mesh(gloveGeo, marioWhiteMat);
rightGlove.name = 'rightGlove';
rightGlove.position.set(0.5, -0.05, 0);
character.add(rightGlove);

// Shoes
const shoeGeo = new THREE.CapsuleGeometry(0.12, 0.12, 4, 8);
const leftShoe = new THREE.Mesh(shoeGeo, marioShoeMat);
leftShoe.name = 'leftShoe';
leftShoe.position.set(-0.15, -0.55, 0.06);
leftShoe.rotation.x = Math.PI / 2;
leftShoe.scale.set(1, 1.3, 0.8);
leftShoe.castShadow = true;
character.add(leftShoe);
const rightShoe = new THREE.Mesh(shoeGeo, marioShoeMat);
rightShoe.name = 'rightShoe';
rightShoe.position.set(0.15, -0.55, 0.06);
rightShoe.rotation.x = Math.PI / 2;
rightShoe.scale.set(1, 1.3, 0.8);
rightShoe.castShadow = true;
character.add(rightShoe);

character.position.set(-4, 0.6, 2);
scene.add(character);

// Shadow blob
const shadowBlobMat = new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false
});
const shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), shadowBlobMat);
shadowBlob.name = 'shadowBlob';
shadowBlob.rotation.x = -Math.PI / 2;
shadowBlob.position.set(character.position.x, 0.02, character.position.z);
scene.add(shadowBlob);

// ===== BRICK & QUESTION BLOCKS =====
function createBrickBlock(x, y, z) {
  const group = new THREE.Group();
  group.name = `brick_${x}_${y}`;
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), brickMat);
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);
  // Brick line details
  const lineH = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.03, 0.03), brickLineMat);
  lineH.position.set(0, 0, 0.51);
  group.add(lineH);
  const lineV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.98, 0.03), brickLineMat);
  lineV.position.set(0, 0, 0.51);
  group.add(lineV);
  const lineV2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.48, 0.03), brickLineMat);
  lineV2.position.set(-0.25, 0.25, 0.51);
  group.add(lineV2);
  const lineV3 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.48, 0.03), brickLineMat);
  lineV3.position.set(0.25, -0.25, 0.51);
  group.add(lineV3);
  group.position.set(x, y, z);
  scene.add(group);
  return group;
}

function createQuestionBlock(x, y, z) {
  const group = new THREE.Group();
  group.name = `question_${x}_${y}`;
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), questionMat.clone());
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);
  // "?" mark on front
  const qGeo = new THREE.BoxGeometry(0.3, 0.45, 0.02);
  const qMark = new THREE.Mesh(qGeo, questionMarkMat);
  qMark.position.set(0, 0.05, 0.52);
  group.add(qMark);
  const qDot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), questionMarkMat);
  qDot.position.set(0, -0.28, 0.52);
  group.add(qDot);
  // Subtle rim
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(1.04, 1.04, 1.04),
    new THREE.MeshStandardMaterial({ color: 0xcc8800, roughness: 0.5, metalness: 0.1 })
  );
  rim.scale.set(1, 1, 1);
  group.add(rim);
  group.position.set(x, y, z);
  group.userData = { baseY: y, isQuestion: true, bumped: false, bumpTime: 0 };
  scene.add(group);
  return group;
}

// Platform layout — Mario style
const platforms = [];
const platformMeta = [];

// Row 1 — low brick row with question block
[-2, -1, 1, 2].forEach(x => {
  const b = createBrickBlock(x, 3, 0);
  platforms.push(b);
  platformMeta.push({ x, y: 3, w: 1, d: 1, phase: x * 0.5, type: 'brick' });
});
const q1 = createQuestionBlock(0, 3, 0);
platforms.push(q1);
platformMeta.push({ x: 0, y: 3, w: 1, d: 1, phase: 0, type: 'question' });

// Row 2 — higher platform
[4, 5, 6].forEach(x => {
  const b = createBrickBlock(x, 5, 0);
  platforms.push(b);
  platformMeta.push({ x, y: 5, w: 1, d: 1, phase: x * 0.3, type: 'brick' });
});
const q2 = createQuestionBlock(5, 5, 0);
// Place it visually on top row instead of replacing
q2.position.set(7, 5, 0);
platforms.push(q2);
platformMeta.push({ x: 7, y: 5, w: 1, d: 1, phase: 1.5, type: 'question' });

// Floating steps — staircase
[-5, -6, -7].forEach((x, i) => {
  const b = createBrickBlock(x, 2 + i * 1.5, 0);
  platforms.push(b);
  platformMeta.push({ x, y: 2 + i * 1.5, w: 1, d: 1, phase: i, type: 'brick' });
});
const q3 = createQuestionBlock(-8, 6.5, 0);
platforms.push(q3);
platformMeta.push({ x: -8, y: 6.5, w: 1, d: 1, phase: 2.5, type: 'question' });

// ===== PIPES =====
function createPipe(x, height, z) {
  const group = new THREE.Group();
  group.name = `pipe_${x}`;
  // Pipe body
  const pipeBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, height, 16),
    pipeDarkGreen
  );
  pipeBody.name = `pipeBody_${x}`;
  pipeBody.position.y = height / 2;
  pipeBody.castShadow = true;
  pipeBody.receiveShadow = true;
  group.add(pipeBody);
  // Highlight strip
  const strip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.52, height, 16, 1, true, 0, 0.6),
    pipeHighlight
  );
  strip.position.y = height / 2;
  group.add(strip);
  // Pipe top rim
  const pipeTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 0.35, 16),
    pipeLightGreen
  );
  pipeTop.name = `pipeTop_${x}`;
  pipeTop.position.y = height + 0.175;
  pipeTop.castShadow = true;
  group.add(pipeTop);
  // Top inner dark
  const innerTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.36, 16),
    new THREE.MeshStandardMaterial({ color: 0x004400, roughness: 0.8 })
  );
  innerTop.position.y = height + 0.18;
  group.add(innerTop);
  group.position.set(x, 0, z);
  scene.add(group);
  return { group, height, x, z, topY: height + 0.35, radius: 0.62 };
}

const pipes = [];
pipes.push(createPipe(8, 2, 1.5));
pipes.push(createPipe(11, 3, 1.5));
pipes.push(createPipe(-10, 2.5, 1.5));

// ===== COINS (collectibles) =====
const collectibles = [];
const coinPositions = [
  // Above blocks (original)
  { x: 0, y: 4.6, z: 0, color: 0xffd700 },
  { x: 5, y: 6.6, z: 0, color: 0xffd700 },
  { x: -8, y: 8.1, z: 0, color: 0xffd700 },
  { x: 7, y: 6.6, z: 0, color: 0xffd700 },
  // Ground-level coins — easy to collect trail
  { x: -1, y: 1.2, z: 2, color: 0xffd700 },
  { x: 1, y: 1.2, z: 2, color: 0xffd700 },
  { x: 3, y: 1.2, z: 2, color: 0xffd700 },
  // Coins near pipes
  { x: 8, y: 3.0, z: 1.5, color: 0xffd700 },
  { x: 11, y: 3.8, z: 1.5, color: 0xffd700 },
  // Coins between platforms (air trail)
  { x: -5, y: 2.2, z: 0, color: 0xffd700 },
  { x: -6, y: 3.2, z: 0, color: 0xffd700 },
  // Coins near staircase
  { x: -11, y: 1.2, z: 1.5, color: 0xffd700 },
  { x: -12, y: 1.2, z: 1.5, color: 0xffd700 },
];

coinPositions.forEach((c, i) => {
  const group = new THREE.Group();
  group.name = `coin_${i}`;

  // Coin disc
  const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 16);
  const mat = coinMat.clone();
  const coin = new THREE.Mesh(coinGeo, mat);
  coin.name = `coinMesh_${i}`;
  coin.rotation.x = Math.PI / 2;
  coin.castShadow = true;
  group.add(coin);

  // Inner circle detail
  const innerGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.07, 16);
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xffaa00, roughness: 0.25, metalness: 0.6,
    emissive: 0xff8800, emissiveIntensity: 0.2
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.name = `coinInner_${i}`;
  inner.rotation.x = Math.PI / 2;
  group.add(inner);

  // Glow sphere
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffd700, transparent: true, opacity: 0.1
  });
  const glowSphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), glowMat);
  glowSphere.name = `coinGlow_${i}`;
  group.add(glowSphere);

  // Point light
  const light = new THREE.PointLight(0xffd700, 0.5, 4);
  light.name = `coinLight_${i}`;
  group.add(light);

  // Sparkle particles
  const pCount = 12;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for (let j = 0; j < pCount; j++) {
    const angle = (j / pCount) * Math.PI * 2;
    const r = 0.35 + Math.random() * 0.3;
    pPos[j * 3] = Math.cos(angle) * r;
    pPos[j * 3 + 1] = (Math.random() - 0.5) * 0.5;
    pPos[j * 3 + 2] = Math.sin(angle) * r;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xffd700, size: 0.05, transparent: true,
    opacity: 0.5, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.name = `coinParticles_${i}`;
  group.add(particles);

  group.position.set(c.x, c.y, c.z);
  group.userData = {
    baseY: c.y, phase: i * 1.8, coin, glowSphere, light,
    particles, coinMat: mat, innerMat,
    isFlashing: false, flashTime: 0, collected: false, collectAnim: undefined,
    respawnTimer: 0
  };
  scene.add(group);
  collectibles.push(group);
});

// ===== MUSHROOM SYSTEM =====
const mushroomMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.45, metalness: 0.05 });
const mushroomStemMat = new THREE.MeshStandardMaterial({ color: 0xfff8dc, roughness: 0.5, metalness: 0.0 });
const mushroomSpotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.0 });

const mushrooms = [];

function createMushroom(x, y, z) {
  const group = new THREE.Group();
  group.name = 'mushroom_' + mushrooms.length;

  // Stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.35, 12), mushroomStemMat);
  stem.name = 'mushroomStem';
  stem.position.y = 0.175;
  stem.castShadow = true;
  group.add(stem);

  // Cap
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    mushroomMat
  );
  cap.name = 'mushroomCap';
  cap.position.y = 0.34;
  cap.castShadow = true;
  group.add(cap);

  // White spots on cap
  const spotGeo = new THREE.CircleGeometry(0.07, 8);
  const spotPositions = [
    { x: 0, y: 0.62, z: 0.12, rx: -0.3, ry: 0 },
    { x: -0.15, y: 0.55, z: 0.1, rx: -0.2, ry: -0.5 },
    { x: 0.17, y: 0.53, z: 0.08, rx: -0.15, ry: 0.5 },
    { x: 0, y: 0.56, z: -0.12, rx: 0.3, ry: Math.PI },
  ];
  spotPositions.forEach((sp, i) => {
    const spot = new THREE.Mesh(spotGeo, mushroomSpotMat);
    spot.name = `mushroomSpot_${i}`;
    spot.position.set(sp.x, sp.y, sp.z);
    spot.rotation.set(sp.rx, sp.ry, 0);
    group.add(spot);
  });

  // Eyes — cute face
  const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.2 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.name = 'mushEyeL';
  leftEye.position.set(-0.08, 0.26, 0.16);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.name = 'mushEyeR';
  rightEye.position.set(0.08, 0.26, 0.16);
  group.add(rightEye);

  // Glow
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff4444, transparent: true, opacity: 0.08
  });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 10), glowMat);
  glow.name = 'mushroomGlow';
  glow.position.y = 0.3;
  group.add(glow);

  group.position.set(x, y, z);
  group.userData = {
    velocityX: 1.5 * (Math.random() > 0.5 ? 1 : -1),
    velocityY: 0,
    grounded: false,
    spawnAnim: 0,      // 0–1: rising from block
    spawnBaseY: y,
    spawning: true,
    alive: true,
    glow
  };

  scene.add(group);
  mushrooms.push(group);
  return group;
}

// ===== GOOMBA ENEMIES =====
// ===== KOOPA TROOPA ENEMIES =====
const koopaGreenMat = new THREE.MeshStandardMaterial({ color: 0x00a800, roughness: 0.5, metalness: 0.1 });
const koopaDarkGreenMat = new THREE.MeshStandardMaterial({ color: 0x006600, roughness: 0.6, metalness: 0.1 });
const koopaShellMat = new THREE.MeshStandardMaterial({ color: 0x00cc00, roughness: 0.35, metalness: 0.15 });
const koopaShellRimMat = new THREE.MeshStandardMaterial({ color: 0xffdd44, roughness: 0.4, metalness: 0.2 });
const koopaSkinMat = new THREE.MeshStandardMaterial({ color: 0xffe0a0, roughness: 0.5, metalness: 0.0 });
const koopaWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.0 });
const koopaEyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.2, metalness: 0.1 });
const koopaBootMat = new THREE.MeshStandardMaterial({ color: 0xcc6600, roughness: 0.6, metalness: 0.05 });

const koopas = [];

function playShellKickSound() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(500, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
  gain.gain.setValueAtTime(0.13, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
  // Impact thud
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(120, now);
  osc2.frequency.exponentialRampToValueAtTime(50, now + 0.06);
  gain2.gain.setValueAtTime(0.12, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + 0.08);
}

function playShellHitSound() {
  const ctx = ensureAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

function createKoopa(x, y, z, patrolMinX, patrolMaxX) {
  const group = new THREE.Group();
  group.name = 'koopa_' + koopas.length;

  // === Walking body parts (hidden when in shell) ===
  const walkGroup = new THREE.Group();
  walkGroup.name = 'koopaWalk';

  // Shell (back)
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 14, 10),
    koopaShellMat
  );
  shell.name = 'koopaShellBody';
  shell.position.y = 0.4;
  shell.scale.set(1, 0.85, 0.9);
  shell.castShadow = true;
  walkGroup.add(shell);

  // Shell rim/belly stripe
  const rimGeo = new THREE.TorusGeometry(0.33, 0.03, 8, 16);
  const rim = new THREE.Mesh(rimGeo, koopaShellRimMat);
  rim.name = 'koopaRim';
  rim.position.y = 0.38;
  rim.rotation.x = Math.PI / 2;
  walkGroup.add(rim);

  // Shell pattern lines
  for (let i = 0; i < 3; i++) {
    const lineGeo = new THREE.BoxGeometry(0.02, 0.3, 0.5);
    const line = new THREE.Mesh(lineGeo, koopaDarkGreenMat);
    line.name = `koopaShellLine_${i}`;
    line.position.set(-0.12 + i * 0.12, 0.48, -0.05);
    line.rotation.x = 0.1;
    walkGroup.add(line);
  }

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    koopaSkinMat
  );
  head.name = 'koopaHead';
  head.position.set(0, 0.72, 0.22);
  head.castShadow = true;
  walkGroup.add(head);

  // Eyes
  const eyeWhGeo = new THREE.SphereGeometry(0.07, 8, 8);
  const lEyeW = new THREE.Mesh(eyeWhGeo, koopaWhiteMat);
  lEyeW.name = 'koopaEyeWL';
  lEyeW.position.set(-0.1, 0.76, 0.38);
  walkGroup.add(lEyeW);
  const rEyeW = new THREE.Mesh(eyeWhGeo, koopaWhiteMat);
  rEyeW.name = 'koopaEyeWR';
  rEyeW.position.set(0.1, 0.76, 0.38);
  walkGroup.add(rEyeW);

  const pupGeo = new THREE.SphereGeometry(0.04, 8, 8);
  const lEyeP = new THREE.Mesh(pupGeo, koopaEyeMat);
  lEyeP.name = 'koopaEyePL';
  lEyeP.position.set(-0.1, 0.76, 0.44);
  walkGroup.add(lEyeP);
  const rEyeP = new THREE.Mesh(pupGeo, koopaEyeMat);
  rEyeP.name = 'koopaEyePR';
  rEyeP.position.set(0.1, 0.76, 0.44);
  walkGroup.add(rEyeP);

  // Beak/mouth
  const beak = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 6, 6),
    koopaShellRimMat
  );
  beak.name = 'koopaBeak';
  beak.position.set(0, 0.68, 0.42);
  beak.scale.set(1.2, 0.6, 1);
  walkGroup.add(beak);

  // Arms (short)
  const armGeo = new THREE.CapsuleGeometry(0.06, 0.15, 4, 8);
  const lArm = new THREE.Mesh(armGeo, koopaSkinMat);
  lArm.name = 'koopaArmL';
  lArm.position.set(-0.35, 0.38, 0.1);
  lArm.rotation.z = 0.5;
  lArm.castShadow = true;
  walkGroup.add(lArm);
  const rArm = new THREE.Mesh(armGeo, koopaSkinMat);
  rArm.name = 'koopaArmR';
  rArm.position.set(0.35, 0.38, 0.1);
  rArm.rotation.z = -0.5;
  rArm.castShadow = true;
  walkGroup.add(rArm);

  // Feet (boots)
  const footGeo = new THREE.CapsuleGeometry(0.08, 0.08, 4, 8);
  const lFoot = new THREE.Mesh(footGeo, koopaBootMat);
  lFoot.name = 'koopaFootL';
  lFoot.position.set(-0.13, 0.06, 0.08);
  lFoot.rotation.x = Math.PI / 2;
  lFoot.scale.set(1, 1.2, 0.8);
  lFoot.castShadow = true;
  walkGroup.add(lFoot);
  const rFoot = new THREE.Mesh(footGeo, koopaBootMat);
  rFoot.name = 'koopaFootR';
  rFoot.position.set(0.13, 0.06, 0.08);
  rFoot.rotation.x = Math.PI / 2;
  rFoot.scale.set(1, 1.2, 0.8);
  rFoot.castShadow = true;
  walkGroup.add(rFoot);

  group.add(walkGroup);

  // === Shell-only mode (shown when stomped) ===
  const shellGroup = new THREE.Group();
  shellGroup.name = 'koopaShellOnly';

  const shellAlone = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 16, 12),
    koopaShellMat
  );
  shellAlone.name = 'koopaShellAlone';
  shellAlone.position.y = 0.28;
  shellAlone.scale.set(1, 0.65, 0.95);
  shellAlone.castShadow = true;
  shellGroup.add(shellAlone);

  // Shell bottom (belly)
  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 14, 8, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.6),
    koopaShellRimMat
  );
  belly.name = 'koopaShellBelly';
  belly.position.y = 0.22;
  belly.scale.set(1, 0.65, 0.95);
  shellGroup.add(belly);

  // Shell rim
  const shellRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.025, 8, 18),
    koopaShellRimMat
  );
  shellRim.name = 'koopaShellRim';
  shellRim.position.y = 0.26;
  shellRim.rotation.x = Math.PI / 2;
  shellGroup.add(shellRim);

  // Shell top pattern
  for (let i = 0; i < 3; i++) {
    const pGeo = new THREE.BoxGeometry(0.025, 0.22, 0.45);
    const p = new THREE.Mesh(pGeo, koopaDarkGreenMat);
    p.name = `koopaShellPattern_${i}`;
    p.position.set(-0.1 + i * 0.1, 0.38, 0);
    shellGroup.add(p);
  }

  shellGroup.visible = false;
  group.add(shellGroup);

  group.position.set(x, y, z);
  group.userData = {
    velocityX: 1.0 * (Math.random() > 0.5 ? 1 : -1),
    velocityY: 0,
    grounded: false,
    alive: true,
    state: 'walking', // 'walking', 'shell', 'sliding'
    shellVelocityX: 0,
    shellSpinAngle: 0,
    comboCount: 0,
    stompTime: 0,
    respawnTime: 0,
    respawning: false,
    startX: x,
    startY: y,
    startZ: z,
    patrolMinX,
    patrolMaxX,
    walkGroup,
    shellGroup,
    lFoot,
    rFoot,
    lArm,
    rArm,
    head
  };

  scene.add(group);
  koopas.push(group);
  return group;
}

// Place Koopas
createKoopa(6, 0.0, 2, 3, 9);
createKoopa(-4, 0.0, 2, -8, 0);
createKoopa(-6, 5.0, 0, -8, -5);

const goombaBrownMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.6, metalness: 0.05 });
const goombaDarkMat = new THREE.MeshStandardMaterial({ color: 0x5C2E00, roughness: 0.7, metalness: 0.05 });
const goombaFeetMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.0 });

const goombas = [];

function createGoomba(x, y, z, patrolMinX, patrolMaxX) {
  const group = new THREE.Group();
  group.name = 'goomba_' + goombas.length;

  // Body — mushroom shaped brown blob
  const bodyGeo = new THREE.SphereGeometry(0.35, 12, 10);
  const goombaBody = new THREE.Mesh(bodyGeo, goombaBrownMat);
  goombaBody.name = 'goombaBody';
  goombaBody.position.y = 0.35;
  goombaBody.scale.set(1, 0.85, 1);
  goombaBody.castShadow = true;
  group.add(goombaBody);

  // Head/cap — darker top dome
  const capGeo = new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const cap = new THREE.Mesh(capGeo, goombaDarkMat);
  cap.name = 'goombaCap';
  cap.position.y = 0.45;
  cap.castShadow = true;
  group.add(cap);

  // Angry eyebrows (angled rectangles) — thick brows
  const browGeo = new THREE.BoxGeometry(0.16, 0.04, 0.06);
  const browMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
  const leftBrow = new THREE.Mesh(browGeo, browMat);
  leftBrow.name = 'goombaBrowL';
  leftBrow.position.set(-0.1, 0.52, 0.3);
  leftBrow.rotation.z = 0.35; // angry angle
  group.add(leftBrow);
  const rightBrow = new THREE.Mesh(browGeo, browMat);
  rightBrow.name = 'goombaBrowR';
  rightBrow.position.set(0.1, 0.52, 0.3);
  rightBrow.rotation.z = -0.35;
  group.add(rightBrow);

  // Eyes — white with black pupils
  const eyeWhGeo = new THREE.SphereGeometry(0.07, 8, 8);
  const eyeWhMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const eyePupGeo = new THREE.SphereGeometry(0.04, 8, 8);
  const eyePupMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.2 });

  const lEyeW = new THREE.Mesh(eyeWhGeo, eyeWhMat);
  lEyeW.name = 'goombaEyeWL';
  lEyeW.position.set(-0.12, 0.42, 0.3);
  group.add(lEyeW);
  const rEyeW = new THREE.Mesh(eyeWhGeo, eyeWhMat);
  rEyeW.name = 'goombaEyeWR';
  rEyeW.position.set(0.12, 0.42, 0.3);
  group.add(rEyeW);
  const lEyeP = new THREE.Mesh(eyePupGeo, eyePupMat);
  lEyeP.name = 'goombaEyePL';
  lEyeP.position.set(-0.12, 0.41, 0.36);
  group.add(lEyeP);
  const rEyeP = new THREE.Mesh(eyePupGeo, eyePupMat);
  rEyeP.name = 'goombaEyePR';
  rEyeP.position.set(0.12, 0.41, 0.36);
  group.add(rEyeP);

  // Mouth — small frown
  const mouthGeo = new THREE.BoxGeometry(0.12, 0.03, 0.04);
  const mouth = new THREE.Mesh(mouthGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  mouth.name = 'goombaMouth';
  mouth.position.set(0, 0.28, 0.33);
  group.add(mouth);

  // Two little fangs
  const fangGeo = new THREE.BoxGeometry(0.03, 0.05, 0.03);
  const fangMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const fangL = new THREE.Mesh(fangGeo, fangMat);
  fangL.name = 'goombaFangL';
  fangL.position.set(-0.04, 0.26, 0.33);
  group.add(fangL);
  const fangR = new THREE.Mesh(fangGeo, fangMat);
  fangR.name = 'goombaFangR';
  fangR.position.set(0.04, 0.26, 0.33);
  group.add(fangR);

  // Feet — two little dark shoes that waddle
  const footGeo = new THREE.CapsuleGeometry(0.09, 0.08, 4, 8);
  const leftFoot = new THREE.Mesh(footGeo, goombaFeetMat);
  leftFoot.name = 'goombaFootL';
  leftFoot.position.set(-0.15, 0.06, 0.04);
  leftFoot.rotation.x = Math.PI / 2;
  leftFoot.scale.set(1, 1.2, 0.8);
  leftFoot.castShadow = true;
  group.add(leftFoot);
  const rightFoot = new THREE.Mesh(footGeo, goombaFeetMat);
  rightFoot.name = 'goombaFootR';
  rightFoot.position.set(0.15, 0.06, 0.04);
  rightFoot.rotation.x = Math.PI / 2;
  rightFoot.scale.set(1, 1.2, 0.8);
  rightFoot.castShadow = true;
  group.add(rightFoot);

  // Squished version (hidden initially) — flat pancake
  const squishGeo = new THREE.CylinderGeometry(0.42, 0.45, 0.08, 14);
  const squishMesh = new THREE.Mesh(squishGeo, goombaDarkMat);
  squishMesh.name = 'goombaSquish';
  squishMesh.position.y = 0.04;
  squishMesh.visible = false;
  squishMesh.castShadow = true;
  group.add(squishMesh);

  // X-eyes for squished state
  const xEyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 });
  const xGeo = new THREE.BoxGeometry(0.04, 0.12, 0.02);
  const xEyeL1 = new THREE.Mesh(xGeo, xEyeMat);
  xEyeL1.position.set(-0.1, 0.1, 0.4);
  xEyeL1.rotation.z = Math.PI / 4;
  xEyeL1.visible = false;
  xEyeL1.name = 'goombaXL1';
  group.add(xEyeL1);
  const xEyeL2 = new THREE.Mesh(xGeo, xEyeMat);
  xEyeL2.position.set(-0.1, 0.1, 0.4);
  xEyeL2.rotation.z = -Math.PI / 4;
  xEyeL2.visible = false;
  xEyeL2.name = 'goombaXL2';
  group.add(xEyeL2);
  const xEyeR1 = new THREE.Mesh(xGeo, xEyeMat);
  xEyeR1.position.set(0.1, 0.1, 0.4);
  xEyeR1.rotation.z = Math.PI / 4;
  xEyeR1.visible = false;
  xEyeR1.name = 'goombaXR1';
  group.add(xEyeR1);
  const xEyeR2 = new THREE.Mesh(xGeo, xEyeMat);
  xEyeR2.position.set(0.1, 0.1, 0.4);
  xEyeR2.rotation.z = -Math.PI / 4;
  xEyeR2.visible = false;
  xEyeR2.name = 'goombaXR2';
  group.add(xEyeR2);

  group.position.set(x, y, z);
  group.userData = {
    velocityX: 1.2 * (Math.random() > 0.5 ? 1 : -1),
    velocityY: 0,
    grounded: false,
    alive: true,
    squished: false,
    squishTime: 0,
    respawnTime: 0,
    respawning: false,
    startX: x,
    startY: y,
    startZ: z,
    patrolMinX: patrolMinX,
    patrolMaxX: patrolMaxX,
    // Part references for show/hide
    bodyParts: [goombaBody, cap, leftBrow, rightBrow, lEyeW, rEyeW, lEyeP, rEyeP, mouth, fangL, fangR, leftFoot, rightFoot],
    squishMesh,
    xEyes: [xEyeL1, xEyeL2, xEyeR1, xEyeR2],
    leftFoot,
    rightFoot
  };

  scene.add(group);
  goombas.push(group);
  return group;
}

// Place Goombas at strategic spots
createGoomba(2, 0.0, 2, -1, 6);         // Ground patrol near start
createGoomba(-6, 0.0, 2, -9, -3);        // Ground patrol left side
createGoomba(10, 0.0, 1.5, 7.5, 13);     // Ground patrol near pipes
createGoomba(5, 5.5, 0, 4, 6);           // On the high brick platform
createGoomba(-7, 5.0, 0, -8, -5);        // On the staircase bricks

// Mario big / small state
let isBigMario = false;
let marioScaleTarget = 1;
let marioScaleCurrent = 1;
let growAnimTime = -1;
const growAnimDuration = 0.6;

// Hit / shrink state
let isInvincible = false;
let invincibleTime = 0;
const invincibleDuration = 2.0; // seconds of flashing invincibility after hit
let shrinkAnimTime = -1;
const shrinkAnimDuration = 0.5;

// Hazard spikes
const hazards = [];
function createHazardSpike(x, z) {
  const group = new THREE.Group();
  group.name = `hazard_${x}_${z}`;
  // Spike cone
  const spikeMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.5 });
  const spikePositions = [-0.2, 0, 0.2];
  spikePositions.forEach((ox, i) => {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 6), spikeMat);
    spike.name = `spike_${x}_${i}`;
    spike.position.set(ox, 0.225, 0);
    spike.castShadow = true;
    group.add(spike);
  });
  // Base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.1, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.3 })
  );
  base.name = `hazardBase_${x}`;
  base.position.y = 0.05;
  group.add(base);
  // Warning stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.04, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.5, metalness: 0.1 })
  );
  stripe.name = `hazardStripe_${x}`;
  stripe.position.y = 0.01;
  group.add(stripe);
  group.position.set(x, 0, z);
  scene.add(group);
  hazards.push({ group, x, z, radiusX: 0.5, radiusZ: 0.3 });
  return group;
}

// Place hazard spikes at strategic spots
createHazardSpike(3, 2);
createHazardSpike(-2, 3.5);
createHazardSpike(9.5, 1.5);

function triggerHit() {
  if (isInvincible || isGameOver) return;
  if (isBigMario) {
    // Shrink Mario back to normal — lose 300 points
    isBigMario = false;
    marioScaleTarget = 1;
    shrinkAnimTime = 0;
    isInvincible = true;
    invincibleTime = 0;
    playPowerDownSound();
    loseScore(300, character.position);
    document.getElementById('super-indicator').classList.remove('active');
    // Small upward knockback
    velocityY = 5;
    isGrounded = false;
    // Burst particles
    createSparkleBurst(character.position.clone(), 0xff6666);
    createSparkleBurst(
      new THREE.Vector3(character.position.x, character.position.y + 0.8, character.position.z),
      0xffaa44
    );
  } else {
    // Small Mario hit — lose a life!
    loseLife();
    isInvincible = true;
    invincibleTime = 0;
    loseScore(150, character.position);
    velocityY = 5;
    isGrounded = false;
    createSparkleBurst(character.position.clone(), 0xff6666);
  }
}

// ===== DECORATIVE CLOUDS =====
function createCloud(x, y, z, scale) {
  const group = new THREE.Group();
  group.name = `cloud_${x}_${y}`;
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.9, metalness: 0.0
  });
  const parts = [
    { px: 0, py: 0, pz: 0, s: 1 },
    { px: -0.6, py: -0.1, pz: 0, s: 0.7 },
    { px: 0.7, py: -0.05, pz: 0, s: 0.8 },
    { px: 0.2, py: 0.3, pz: 0, s: 0.6 },
    { px: -0.3, py: 0.25, pz: 0, s: 0.55 },
  ];
  parts.forEach((p, i) => {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), cloudMat);
    sphere.name = `cloudPart_${x}_${i}`;
    sphere.position.set(p.px, p.py, p.pz);
    sphere.scale.setScalar(p.s);
    group.add(sphere);
  });
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  scene.add(group);
  return group;
}

const clouds = [];
clouds.push(createCloud(-8, 9, -4, 1.2));
clouds.push(createCloud(3, 10.5, -6, 1.5));
clouds.push(createCloud(12, 8.5, -5, 1.0));
clouds.push(createCloud(-3, 11, -7, 0.9));
clouds.push(createCloud(8, 12, -8, 1.3));

// ===== DECORATIVE BUSHES =====
function createBush(x, z, scale) {
  const group = new THREE.Group();
  group.name = `bush_${x}`;
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.7, metalness: 0.0 });
  const sizes = [1, 0.7, 0.65];
  const offsets = [0, -0.55, 0.6];
  sizes.forEach((s, i) => {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), bushMat);
    sphere.name = `bushPart_${x}_${i}`;
    sphere.position.set(offsets[i], 0, 0);
    sphere.scale.set(s, s * 0.75, s);
    group.add(sphere);
  });
  group.position.set(x, 0.15, z);
  group.scale.setScalar(scale);
  scene.add(group);
  return group;
}

createBush(-3, 3, 1.0);
createBush(5, 3.5, 0.8);
createBush(13, 2.5, 1.2);
createBush(-12, 3, 0.9);

// ===== HILLS in background =====
function createHill(x, z, scaleX, scaleY) {
  const hill = new THREE.Mesh(
    new THREE.SphereGeometry(3, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x2ecc40, roughness: 0.8, metalness: 0.0 })
  );
  hill.name = `hill_${x}`;
  hill.position.set(x, 0, z);
  hill.scale.set(scaleX, scaleY, 1);
  hill.receiveShadow = true;
  scene.add(hill);
}
createHill(-9, -3, 2.5, 1.2);
createHill(6, -4, 3, 1.5);
createHill(15, -3, 2, 1.0);

// ===== BACKGROUND PARTICLES =====
const bgParticleCount = 80;
const bgGeo = new THREE.BufferGeometry();
const bgPos = new Float32Array(bgParticleCount * 3);
for (let i = 0; i < bgParticleCount; i++) {
  bgPos[i * 3] = (Math.random() - 0.5) * 40;
  bgPos[i * 3 + 1] = Math.random() * 14;
  bgPos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
}
bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
const bgMat = new THREE.PointsMaterial({
  color: 0xffffff, size: 0.04, transparent: true,
  opacity: 0.25, blending: THREE.AdditiveBlending
});
const bgParticles = new THREE.Points(bgGeo, bgMat);
bgParticles.name = 'bgParticles';
scene.add(bgParticles);

// ===== SPARKLE BURST POOL =====
const sparkleBursts = [];
function createSparkleBurst(position, burstColor) {
  const count = 25;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = position.x;
    pos[i * 3 + 1] = position.y;
    pos[i * 3 + 2] = position.z;
    vel.push(new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      Math.random() * 4 + 2,
      (Math.random() - 0.5) * 5
    ));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: burstColor, size: 0.09, transparent: true,
    opacity: 1, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'sparkleBurst_' + sparkleBursts.length;
  scene.add(points);
  sparkleBursts.push({ points, velocities: vel, life: 0, maxLife: 0.7 });
}

// ===== INPUT =====
const keys = { w: false, a: false, s: false, d: false, space: false };
let velocityY = 0;
let isGrounded = true;
let wasGrounded = true;
const gravity = -22;
const jumpForce = 10;
const moveSpeed = 5;
const characterBaseY = 0.6;
let charY = character.position.y;
let targetRotY = 0;
let facingRight = true;

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') keys.w = true;
  if (key === 's' || key === 'arrowdown') keys.s = true;
  if (key === 'a' || key === 'arrowleft') keys.a = true;
  if (key === 'd' || key === 'arrowright') keys.d = true;
  if (key === ' ') { keys.space = true; e.preventDefault(); }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') keys.w = false;
  if (key === 's' || key === 'arrowdown') keys.s = false;
  if (key === 'a' || key === 'arrowleft') keys.a = false;
  if (key === 'd' || key === 'arrowright') keys.d = false;
  if (key === ' ') keys.space = false;
});

  // Click to jump — only if not moving mouse (prevent disappearing on drag)
  let mouseDownPos = null;
  window.addEventListener('mousedown', (e) => {
    mouseDownPos = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mouseup', (e) => {
    if (mouseDownPos) {
      const dx = Math.abs(e.clientX - mouseDownPos.x);
      const dy = Math.abs(e.clientY - mouseDownPos.y);
      if (dx < 5 && dy < 5 && isGrounded) {
        velocityY = jumpForce;
        isGrounded = false;
        playJumpSound();
      }
    }
    mouseDownPos = null;
  });

// Collectible collection — full juicy feedback
function collectCoin(collectible) {
  const d = collectible.userData;
  if (d.collected) return;
  d.collected = true;
  d.isFlashing = true;
  d.flashTime = 0;
  d.collectAnim = 0;

  // Multiple sparkle bursts for juicier effect
  const pos = collectible.position.clone();
  createSparkleBurst(pos, 0xffd700);
  createSparkleBurst(new THREE.Vector3(pos.x, pos.y + 0.3, pos.z), 0xffffff);

  // Create floating "+1" score text sprite
  createFloatingText(pos);

  playCoinSound();
  updateCoinHUD();
}

// Floating "+1" text that rises and fades
const floatingTexts = [];
function createFloatingText(position) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 48px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 6;
  ctx.strokeText('+1', 64, 32);
  ctx.fillStyle = '#ffd700';
  ctx.fillText('+1', 64, 32);

  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: 1,
    depthTest: false, blending: THREE.AdditiveBlending
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.name = 'floatingText_' + floatingTexts.length;
  sprite.position.copy(position);
  sprite.position.y += 0.5;
  sprite.scale.set(1.2, 0.6, 1);
  scene.add(sprite);
  floatingTexts.push({ sprite, life: 0, maxLife: 0.8, startY: position.y + 0.5 });
}

// Question block bump — spawns mushroom!
function bumpQuestionBlock(block) {
  const d = block.userData;
  if (!d.isQuestion || d.bumped) return;
  d.bumped = true;
  d.bumpTime = 0;
  playBumpSound();
  // Change color to used (dark)
  block.children[0].material = new THREE.MeshStandardMaterial({
    color: 0x8b6914, roughness: 0.7, metalness: 0.1
  });
  // Spawn sparkle burst
  createSparkleBurst(
    new THREE.Vector3(block.position.x, block.position.y + 1.2, block.position.z),
    0xffd700
  );
  // Spawn mushroom from block (rises up)
  playMushroomAppearSound();
  const mush = createMushroom(block.position.x, block.position.y + 0.5, block.position.z);
  mush.userData.spawnBaseY = block.position.y + 0.5;
  mush.scale.setScalar(0.01); // Start tiny, grows during spawn anim
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ===== ANIMATION LOOP =====
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const dt = Math.min(clock.getDelta(), 0.05) || 0.016;

  // === Camera follows character — side-scrolling feel ===
  const camTargetX = character.position.x * 0.6 + Math.sin(t * 0.12) * 0.3;
  const camTargetY = 5 + character.position.y * 0.2 + Math.sin(t * 0.18) * 0.15;
  camera.position.x += (camTargetX - camera.position.x) * 2.5 * dt;
  camera.position.y += (camTargetY - camera.position.y) * 2.5 * dt;
  camera.position.z = 18 - Math.abs(character.position.y) * 0.08;
  camera.lookAt(
    character.position.x * 0.4 + 0.5,
    character.position.y * 0.4 + 2.5,
    0
  );

  // === Game Over / Level Transition freeze — only animate visuals ===
  if (isGameOver || levelTransitioning) {
    // Keep rendering scene but freeze Mario
    clouds.forEach((cloud, i) => {
      cloud.position.x += 0.08 * dt;
      if (cloud.position.x > 22) cloud.position.x = -22;
    });
    // Coins still spin
    collectibles.forEach(c => {
      if (!c.visible) return;
      const d = c.userData;
      c.position.y = d.baseY + Math.sin(t * 1.5 + d.phase) * 0.15;
      d.coin.rotation.y = t * 3 + d.phase;
    });
    // Sparkle bursts still animate during transitions
    for (let i = sparkleBursts.length - 1; i >= 0; i--) {
      const b = sparkleBursts[i];
      b.life += dt;
      const progress = b.life / b.maxLife;
      if (progress >= 1) {
        scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        sparkleBursts.splice(i, 1);
        continue;
      }
      const posArr = b.points.geometry.attributes.position.array;
      for (let j = 0; j < b.velocities.length; j++) {
        posArr[j * 3] += b.velocities[j].x * dt;
        posArr[j * 3 + 1] += b.velocities[j].y * dt;
        posArr[j * 3 + 2] += b.velocities[j].z * dt;
        b.velocities[j].y -= 8 * dt;
      }
      b.points.geometry.attributes.position.needsUpdate = true;
      b.points.material.opacity = 1 - progress;
    }
    composer.render();
    return;
  }

  // === Movement ===
  let moveX = 0, moveZ = 0;
  if (keys.a) { moveX -= 1; facingRight = false; }
  if (keys.d) { moveX += 1; facingRight = true; }
  if (keys.w) moveZ -= 1;
  if (keys.s) moveZ += 1;
  const moving = moveX !== 0 || moveZ !== 0;
  if (moving) {
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    moveX /= len; moveZ /= len;
    character.position.x += moveX * moveSpeed * dt;
    character.position.z += moveZ * moveSpeed * dt;
    targetRotY = Math.atan2(moveX, moveZ);
  }
  character.position.x = Math.max(-14, Math.min(14, character.position.x));
  character.position.z = Math.max(-4, Math.min(5, character.position.z));

  // Smooth rotation
  const rotDiff = targetRotY - character.rotation.y;
  const wrappedDiff = ((rotDiff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  character.rotation.y += wrappedDiff * Math.min(1, 10 * dt);

  // Jump
  if (keys.space && isGrounded) {
    velocityY = jumpForce;
    isGrounded = false;
    playJumpSound();
  }

  // Gravity
  velocityY += gravity * dt;
  charY += velocityY * dt;

  // Platform collision (blocks)
  let onPlatform = false;
  const charFeetY = charY - 0.6;
  const charHeadY = charY + 1.1;
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    const m = platformMeta[i];
    const hw = m.w / 2 + 0.2;
    const hd = m.d / 2 + 0.3;
    const platTop = p.position.y + 0.5;
    const platBottom = p.position.y - 0.5;
    const dx = character.position.x - p.position.x;
    const dz = character.position.z - p.position.z;

    if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
      // Landing on top
      if (velocityY <= 0 && charFeetY <= platTop && charFeetY > platTop - 1.2) {
        charY = platTop + 0.6;
        velocityY = 0;
        isGrounded = true;
        onPlatform = true;
      }
      // Hitting from below (head bump)
      if (velocityY > 0 && charHeadY >= platBottom && charHeadY < platBottom + 0.5) {
        velocityY = -1;
        charY = platBottom - 1.1;
        // Bump question block
        if (p.userData && p.userData.isQuestion) {
          bumpQuestionBlock(p);
        }
      }
    }
  }

  // Pipe collision — stand on top
  pipes.forEach(pipe => {
    const dx = character.position.x - pipe.x;
    const dz = character.position.z - pipe.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < pipe.radius + 0.15) {
      if (velocityY <= 0 && charFeetY <= pipe.topY && charFeetY > pipe.topY - 1.0) {
        charY = pipe.topY + 0.6;
        velocityY = 0;
        isGrounded = true;
        onPlatform = true;
      }
    }
  });

  // Ground collision
  if (charY <= characterBaseY && !onPlatform) {
    charY = characterBaseY;
    velocityY = 0;
    isGrounded = true;
  }
  // Landing detection — play thump when transitioning from air to ground
  if (isGrounded && !wasGrounded) {
    playLandSound();
  }
  wasGrounded = isGrounded;

  character.position.y = charY;

  // Shadow blob
  shadowBlob.position.x = character.position.x;
  shadowBlob.position.z = character.position.z;
  const heightAboveGround = character.position.y - 0.02;
  const shadowScale = Math.max(0.2, 1 - heightAboveGround * 0.06);
  shadowBlob.scale.setScalar(shadowScale);
  shadowBlobMat.opacity = Math.max(0.03, 0.2 - heightAboveGround * 0.012);

  // === Character animations ===
  const breathe = Math.sin(t * 2.5) * 0.05;

  if (!isGrounded) {
    // Jumping pose
    const stretch = 1 + Math.min(Math.abs(velocityY) * 0.015, 0.2);
    const squash = 1 / Math.sqrt(stretch);
    body.scale.set(squash, stretch, squash);
    head.scale.set(squash, 1, squash);
    // Arms up when jumping
    leftArm.rotation.z = 1.2;
    rightArm.rotation.z = -1.2;
    leftArm.position.y = 0.25;
    rightArm.position.y = 0.25;
  } else {
    body.scale.set(1 - breathe * 0.12, 1 + breathe * 0.25, 1 - breathe * 0.12);
    head.scale.set(1, 1, 1);
    // Arms down idle / swing when running
    if (moving) {
      leftArm.rotation.z = 0.3 + Math.sin(t * 12) * 0.5;
      rightArm.rotation.z = -0.3 + Math.sin(t * 12 + Math.PI) * 0.5;
      leftArm.position.y = 0.1;
      rightArm.position.y = 0.1;
      // Feet running
      leftShoe.position.y = -0.55 + Math.sin(t * 12) * 0.08;
      rightShoe.position.y = -0.55 + Math.sin(t * 12 + Math.PI) * 0.08;
      leftShoe.position.z = 0.06 + Math.sin(t * 12) * 0.1;
      rightShoe.position.z = 0.06 + Math.sin(t * 12 + Math.PI) * 0.1;
      // Run bob
      character.position.y += Math.sin(t * 12) * 0.03;
    } else {
      leftArm.rotation.z = 0.3;
      rightArm.rotation.z = -0.3;
      leftArm.position.y = 0.1;
      rightArm.position.y = 0.1;
      leftShoe.position.y = -0.55;
      rightShoe.position.y = -0.55;
      leftShoe.position.z = 0.06;
      rightShoe.position.z = 0.06;
    }
  }

  // === Koopa Troopa update ===
  for (let ki = 0; ki < koopas.length; ki++) {
    const k = koopas[ki];
    const kd = k.userData;

    // Respawn logic
    if (kd.respawning) {
      kd.respawnTime += dt;
      if (kd.respawnTime > 8.0) {
        kd.respawning = false;
        kd.alive = true;
        kd.state = 'walking';
        kd.respawnTime = 0;
        kd.stompTime = 0;
        k.position.set(kd.startX, kd.startY, kd.startZ);
        kd.velocityX = 1.0 * (Math.random() > 0.5 ? 1 : -1);
        kd.velocityY = 0;
        kd.shellVelocityX = 0;
        kd.shellSpinAngle = 0;
        kd.walkGroup.visible = true;
        kd.shellGroup.visible = false;
        k.visible = true;
        k.scale.setScalar(0.01);
        k.rotation.set(0, 0, 0);
      }
      continue;
    }

    // Scale pop-in
    if (kd.alive && k.scale.x < 0.99) {
      const sc = Math.min(k.scale.x + dt * 3, 1);
      k.scale.setScalar(sc);
    }

    if (!kd.alive) continue;

    // Gravity
    kd.velocityY += gravity * dt;
    k.position.y += kd.velocityY * dt;

    const moveX = kd.state === 'sliding' ? kd.shellVelocityX : kd.velocityX;
    k.position.x += moveX * dt;

    // Ground collision
    const kGroundY = kd.state === 'walking' ? 0 : 0;
    if (k.position.y <= kGroundY) {
      k.position.y = kGroundY;
      kd.velocityY = 0;
      kd.grounded = true;
    }

    // Platform collision
    for (let pi = 0; pi < platforms.length; pi++) {
      const pl = platforms[pi];
      const pm = platformMeta[pi];
      const hw = pm.w / 2 + 0.15;
      const hd = pm.d / 2 + 0.3;
      const platTop = pl.position.y + 0.5;
      const dx = k.position.x - pl.position.x;
      const dz = k.position.z - pl.position.z;
      if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
        if (kd.velocityY <= 0 && k.position.y <= platTop + 0.1 && k.position.y > platTop - 0.8) {
          k.position.y = platTop;
          kd.velocityY = 0;
          kd.grounded = true;
        }
      }
    }

    // Pipe collision
    pipes.forEach(pipe => {
      const dx = k.position.x - pipe.x;
      const dz = k.position.z - pipe.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < pipe.radius + 0.35) {
        if (kd.state === 'sliding') {
          kd.shellVelocityX *= -1;
          k.position.x += kd.shellVelocityX * dt * 3;
          playShellHitSound();
          createSparkleBurst(new THREE.Vector3(k.position.x, k.position.y + 0.3, k.position.z), 0x00ff00);
        } else {
          kd.velocityX *= -1;
          k.position.x += kd.velocityX * dt * 3;
        }
      }
    });

    // Wall bouncing
    if (k.position.x > 14 || k.position.x < -14) {
      if (kd.state === 'sliding') {
        kd.shellVelocityX *= -1;
        k.position.x = Math.max(-13.5, Math.min(13.5, k.position.x));
        playShellHitSound();
      } else {
        kd.velocityX *= -1;
      }
    }

    // Walking state
    if (kd.state === 'walking') {
      // Patrol boundaries
      if (k.position.x <= kd.patrolMinX) {
        kd.velocityX = Math.abs(kd.velocityX);
      } else if (k.position.x >= kd.patrolMaxX) {
        kd.velocityX = -Math.abs(kd.velocityX);
      }

      // Walk animation
      const wt = t * 6 + ki * 2;
      kd.lFoot.position.z = 0.08 + Math.sin(wt) * 0.06;
      kd.rFoot.position.z = 0.08 + Math.sin(wt + Math.PI) * 0.06;
      kd.lFoot.position.y = 0.06 + Math.max(0, Math.sin(wt)) * 0.04;
      kd.rFoot.position.y = 0.06 + Math.max(0, Math.sin(wt + Math.PI)) * 0.04;
      kd.lArm.rotation.z = 0.5 + Math.sin(wt) * 0.3;
      kd.rArm.rotation.z = -0.5 + Math.sin(wt + Math.PI) * 0.3;
      kd.head.position.y = 0.72 + Math.sin(wt * 0.5) * 0.02;

      // Face direction
      k.rotation.y = kd.velocityX > 0 ? 0 : Math.PI;
    }

    // Shell state (stationary — waiting to be kicked)
    if (kd.state === 'shell') {
      kd.stompTime += dt;
      // Wobble after a few seconds to indicate it's about to recover
      if (kd.stompTime > 4.0) {
        k.rotation.z = Math.sin(t * 12) * 0.15;
      }
      // Recover after 6 seconds
      if (kd.stompTime > 6.0) {
        kd.state = 'walking';
        kd.stompTime = 0;
        kd.walkGroup.visible = true;
        kd.shellGroup.visible = false;
        kd.velocityX = 1.0 * (Math.random() > 0.5 ? 1 : -1);
        k.rotation.z = 0;
      }
    }

    // Sliding shell state
    if (kd.state === 'sliding') {
      // Spin the shell
      kd.shellSpinAngle += dt * 15 * Math.sign(kd.shellVelocityX);
      kd.shellGroup.children[0].rotation.y = kd.shellSpinAngle;

      // Hit Goombas — with combo multiplier
      for (let gi = 0; gi < goombas.length; gi++) {
        const g = goombas[gi];
        const gd = g.userData;
        if (!gd.alive || gd.squished) continue;
        const dx = k.position.x - g.position.x;
        const dz = k.position.z - g.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.8) {
          // Knock out goomba
          gd.alive = false;
          gd.squished = true;
          gd.squishTime = 0;
          gd.velocityX = 0;
          playShellHitSound();
          gd.bodyParts.forEach(p => p.visible = false);
          gd.squishMesh.visible = true;
          gd.xEyes.forEach(x => x.visible = true);
          // Combo scoring
          const ci = Math.min(kd.comboCount, comboPoints.length - 1);
          const pts = comboPoints[ci];
          const label = comboLabels[ci];
          const is1UP = ci >= 4;
          const txtColor = is1UP ? '#44ff44' : (ci >= 3 ? '#ff44ff' : (ci >= 2 ? '#44ddff' : '#ffd700'));
          addScore(pts);
          if (is1UP) gainLife();
          playComboSound(ci);
          createSparkleBurst(new THREE.Vector3(g.position.x, g.position.y + 0.3, g.position.z), 0x8B4513);
          // Extra sparkles for high combos
          if (ci >= 2) {
            createSparkleBurst(new THREE.Vector3(g.position.x, g.position.y + 0.6, g.position.z), 0xffdd44);
          }
          if (ci >= 4) {
            createSparkleBurst(new THREE.Vector3(g.position.x + 0.3, g.position.y + 0.5, g.position.z), 0x44ff44);
            createSparkleBurst(new THREE.Vector3(g.position.x - 0.3, g.position.y + 0.5, g.position.z), 0x44ff44);
          }
          createScoreText(g.position.clone(), label, txtColor);
          kd.comboCount++;
        }
      }

      // Hit other Koopas — with combo multiplier
      for (let ki2 = 0; ki2 < koopas.length; ki2++) {
        if (ki2 === ki) continue;
        const k2 = koopas[ki2];
        const kd2 = k2.userData;
        if (!kd2.alive || kd2.respawning) continue;
        const dx = k.position.x - k2.position.x;
        const dz = k.position.z - k2.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.8) {
          // Knock out the other koopa — flip it
          kd2.alive = false;
          playShellHitSound();
          // Combo scoring
          const ci = Math.min(kd.comboCount, comboPoints.length - 1);
          const pts = comboPoints[ci];
          const label = comboLabels[ci];
          const is1UP = ci >= 4;
          const txtColor = is1UP ? '#44ff44' : (ci >= 3 ? '#ff44ff' : (ci >= 2 ? '#44ddff' : '#ffd700'));
          addScore(pts);
          playComboSound(ci);
          createSparkleBurst(new THREE.Vector3(k2.position.x, k2.position.y + 0.3, k2.position.z), 0x00cc00);
          if (ci >= 2) {
            createSparkleBurst(new THREE.Vector3(k2.position.x, k2.position.y + 0.6, k2.position.z), 0xffdd44);
          }
          if (ci >= 4) {
            createSparkleBurst(new THREE.Vector3(k2.position.x + 0.3, k2.position.y + 0.5, k2.position.z), 0x44ff44);
            createSparkleBurst(new THREE.Vector3(k2.position.x - 0.3, k2.position.y + 0.5, k2.position.z), 0x44ff44);
          }
          createScoreText(k2.position.clone(), label, txtColor);
          kd.comboCount++;
          // Flip upside down and fall
          kd2.velocityY = 6;
          kd2.state = 'walking';
          kd2.respawning = true;
          kd2.respawnTime = 2.0;
          k2.rotation.z = Math.PI;
        }
      }
    }

    // === Collision with Mario ===
    const dx = character.position.x - k.position.x;
    const dz = character.position.z - k.position.z;
    const horizDist = Math.sqrt(dx * dx + dz * dz);

    if (horizDist < 0.8 && kd.alive) {
      const marioFeetY = charY - 0.6 * marioScaleCurrent;
      const koopaTopY = k.position.y + (kd.state === 'walking' ? 0.7 : 0.4);
      const koopaMidY = k.position.y + (kd.state === 'walking' ? 0.35 : 0.2);

      if (marioFeetY >= koopaMidY && velocityY < 0) {
        // STOMP from above
        playStompSound();
        velocityY = 8;
        isGrounded = false;

        createSparkleBurst(new THREE.Vector3(k.position.x, k.position.y + 0.3, k.position.z), 0x00cc00);

        if (kd.state === 'walking') {
          // Enter shell mode — score 100 for stomp
          kd.state = 'shell';
          kd.stompTime = 0;
          kd.walkGroup.visible = false;
          kd.shellGroup.visible = true;
          k.rotation.z = 0;
          addScore(100);
          createScoreText(k.position.clone(), '100', '#ffd700');
        } else if (kd.state === 'shell') {
          // Kick the shell! — reset combo counter for fresh chain
          kd.state = 'sliding';
          kd.comboCount = 0;
          const kickDir = dx > 0 ? -1 : 1;
          kd.shellVelocityX = kickDir * 10;
          playShellKickSound();
          createSparkleBurst(new THREE.Vector3(k.position.x, k.position.y + 0.2, k.position.z), 0xffdd44);
        } else if (kd.state === 'sliding') {
          // Stop the shell
          kd.state = 'shell';
          kd.stompTime = 0;
          kd.shellVelocityX = 0;
        }
      } else if (!isInvincible) {
        if (kd.state === 'shell') {
          // Kick stationary shell from the side — reset combo counter
          kd.state = 'sliding';
          kd.comboCount = 0;
          const kickDir = dx > 0 ? -1 : 1;
          kd.shellVelocityX = kickDir * 10;
          playShellKickSound();
          createSparkleBurst(new THREE.Vector3(k.position.x, k.position.y + 0.2, k.position.z), 0xffdd44);
        } else if (kd.state === 'walking' || kd.state === 'sliding') {
          // Hit by walking koopa or sliding shell — triggerHit handles everything
          const knockDir = dx > 0 ? 1 : -1;
          triggerHit();
          character.position.x += knockDir * 0.5;
        }
      }
    }

    // Despawn if fallen
    if (k.position.y < -10) {
      kd.alive = false;
      kd.respawning = true;
      kd.respawnTime = 0;
      k.visible = false;
    }
  }

  // === Goomba update ===
  const goombaT = t;
  for (let gi = 0; gi < goombas.length; gi++) {
    const g = goombas[gi];
    const gd = g.userData;

    // Respawn logic
    if (gd.respawning) {
      gd.respawnTime += dt;
      if (gd.respawnTime > 6.0) {
        // Respawn goomba at start position
        gd.respawning = false;
        gd.squished = false;
        gd.alive = true;
        gd.respawnTime = 0;
        gd.squishTime = 0;
        g.position.set(gd.startX, gd.startY, gd.startZ);
        gd.velocityX = 1.2 * (Math.random() > 0.5 ? 1 : -1);
        gd.velocityY = 0;
        // Show normal parts, hide squish
        gd.bodyParts.forEach(p => p.visible = true);
        gd.squishMesh.visible = false;
        gd.xEyes.forEach(x => x.visible = false);
        g.scale.set(1, 1, 1);
        g.rotation.set(0, 0, 0);
        // Fade-in pop
        g.scale.setScalar(0.01);
      }
      continue;
    }

    // Respawn fade-in scale
    if (gd.alive && g.scale.x < 0.99) {
      const sc = Math.min(g.scale.x + dt * 3, 1);
      g.scale.setScalar(sc);
    }

    // Squished state — stay flat, then start respawn timer
    if (gd.squished) {
      gd.squishTime += dt;
      // Flatten animation
      if (gd.squishTime < 0.15) {
        const sq = gd.squishTime / 0.15;
        g.scale.y = Math.max(0.15, 1 - sq * 0.85);
        g.scale.x = 1 + sq * 0.3;
        g.scale.z = 1 + sq * 0.3;
      }
      // After being flat for a while, blink then disappear
      if (gd.squishTime > 1.5 && gd.squishTime < 2.0) {
        g.visible = Math.sin(gd.squishTime * 20) > 0;
      }
      if (gd.squishTime >= 2.0) {
        g.visible = false;
        gd.respawning = true;
        gd.respawnTime = 0;
      }
      continue;
    }

    if (!gd.alive) continue;

    // Gravity
    gd.velocityY += gravity * dt;
    g.position.y += gd.velocityY * dt;
    g.position.x += gd.velocityX * dt;

    // Ground collision
    if (g.position.y <= gd.startY && gd.startY <= 0.1) {
      g.position.y = 0;
      gd.velocityY = 0;
      gd.grounded = true;
    } else if (g.position.y < 0) {
      g.position.y = 0;
      gd.velocityY = 0;
      gd.grounded = true;
    }

    // Platform collision for goombas
    for (let pi = 0; pi < platforms.length; pi++) {
      const pl = platforms[pi];
      const pm = platformMeta[pi];
      const hw = pm.w / 2 + 0.15;
      const hd = pm.d / 2 + 0.3;
      const platTop = pl.position.y + 0.5;
      const dx = g.position.x - pl.position.x;
      const dz = g.position.z - pl.position.z;
      if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
        if (gd.velocityY <= 0 && g.position.y <= platTop + 0.1 && g.position.y > platTop - 0.8) {
          g.position.y = platTop;
          gd.velocityY = 0;
          gd.grounded = true;
        }
      }
    }

    // Patrol boundaries — reverse at edges
    if (g.position.x <= gd.patrolMinX) {
      gd.velocityX = Math.abs(gd.velocityX);
    } else if (g.position.x >= gd.patrolMaxX) {
      gd.velocityX = -Math.abs(gd.velocityX);
    }

    // Pipe collision
    pipes.forEach(pipe => {
      const dx = g.position.x - pipe.x;
      const dz = g.position.z - pipe.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < pipe.radius + 0.35) {
        gd.velocityX *= -1;
        g.position.x += gd.velocityX * dt * 3;
      }
    });

    // Waddle animation — feet shuffle + slight body bob
    const waddle = Math.sin(goombaT * 8 + gi * 2) * 0.06;
    gd.leftFoot.position.z = 0.04 + Math.sin(goombaT * 8 + gi * 2) * 0.06;
    gd.rightFoot.position.z = 0.04 + Math.sin(goombaT * 8 + gi * 2 + Math.PI) * 0.06;
    gd.leftFoot.position.y = 0.06 + Math.max(0, Math.sin(goombaT * 8 + gi * 2)) * 0.04;
    gd.rightFoot.position.y = 0.06 + Math.max(0, Math.sin(goombaT * 8 + gi * 2 + Math.PI)) * 0.04;
    g.children[0].position.y = 0.35 + Math.abs(waddle) * 0.3; // body bobs

    // Face movement direction
    g.rotation.y = gd.velocityX > 0 ? 0 : Math.PI;

    // === COLLISION WITH MARIO ===
    const dx = character.position.x - g.position.x;
    const dz = character.position.z - g.position.z;
    const horizDist = Math.sqrt(dx * dx + dz * dz);

    if (horizDist < 0.75) {
      const marioFeetY = charY - 0.6 * marioScaleCurrent;
      const goombaTopY = g.position.y + 0.55;
      const goombaMidY = g.position.y + 0.25;

      // Stomp from above — Mario's feet above goomba's mid-height and falling
      if (marioFeetY >= goombaMidY && velocityY < 0) {
        // STOMP!
        gd.alive = false;
        gd.squished = true;
        gd.squishTime = 0;
        gd.velocityX = 0;
        playStompSound();

        // Hide normal parts, show squished version
        gd.bodyParts.forEach(p => p.visible = false);
        gd.squishMesh.visible = true;
        gd.xEyes.forEach(x => x.visible = true);

        // Mario bounces up
        velocityY = 8;
        isGrounded = false;

        // Score for direct stomp — 100 points
        addScore(100);
        createScoreText(g.position.clone(), '100', '#ffd700');

        // Particles burst
        createSparkleBurst(
          new THREE.Vector3(g.position.x, g.position.y + 0.3, g.position.z),
          0x8B4513
        );
      } else if (!isInvincible) {
        // Side hit — triggerHit handles big & small Mario (points, knockback, invincibility)
        const knockDir = dx > 0 ? 1 : -1;
        triggerHit();
        character.position.x += knockDir * 0.5;
      }
    }

    // Despawn if fallen off world
    if (g.position.y < -10) {
      gd.alive = false;
      gd.respawning = true;
      gd.respawnTime = 0;
      g.visible = false;
    }
  }

  // === Mushroom update ===
  for (let mi = mushrooms.length - 1; mi >= 0; mi--) {
    const m = mushrooms[mi];
    const md = m.userData;
    if (!md.alive) continue;

    // Spawn animation — rise up from block
    if (md.spawning) {
      md.spawnAnim += dt * 2.5;
      const sp = Math.min(md.spawnAnim, 1);
      const ease = 1 - (1 - sp) * (1 - sp);
      m.position.y = md.spawnBaseY + ease * 0.8;
      m.scale.setScalar(0.3 + ease * 0.7);
      if (sp >= 1) {
        md.spawning = false;
        md.grounded = false;
      }
      continue;
    }

    // Gravity
    md.velocityY += gravity * dt;
    m.position.y += md.velocityY * dt;
    m.position.x += md.velocityX * dt;

    // Mushroom glow pulse
    md.glow.material.opacity = 0.06 + Math.sin(t * 4) * 0.04;

    // Ground collision
    if (m.position.y <= 0.35) {
      m.position.y = 0.35;
      md.velocityY = 0;
      md.grounded = true;
    }

    // Platform collision for mushroom
    for (let pi = 0; pi < platforms.length; pi++) {
      const pl = platforms[pi];
      const pm = platformMeta[pi];
      const hw = pm.w / 2 + 0.1;
      const hd = pm.d / 2 + 0.3;
      const platTop = pl.position.y + 0.5;
      const dx = m.position.x - pl.position.x;
      const dz = m.position.z - pl.position.z;
      if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
        if (md.velocityY <= 0 && m.position.y - 0.35 <= platTop && m.position.y > platTop - 0.8) {
          m.position.y = platTop + 0.35;
          md.velocityY = 0;
          md.grounded = true;
        }
      }
    }

    // Pipe collision — reverse direction
    pipes.forEach(pipe => {
      const dx = m.position.x - pipe.x;
      const dz = m.position.z - pipe.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < pipe.radius + 0.25) {
        md.velocityX *= -1;
        m.position.x += md.velocityX * dt * 3;
      }
    });

    // Reverse at world edges
    if (m.position.x > 14 || m.position.x < -14) {
      md.velocityX *= -1;
    }

    // Wobble animation while sliding
    m.rotation.z = Math.sin(t * 8 + mi) * 0.08;

    // Player collection — grow Mario!
    const dist = character.position.distanceTo(m.position);
    if (dist < 1.0 && !isBigMario && !isInvincible) {
      md.alive = false;
      m.visible = false;
      scene.remove(m);
      mushrooms.splice(mi, 1);
      // Grow Mario!
      isBigMario = true;
      marioScaleTarget = 1.6;
      growAnimTime = 0;
      playPowerUpSound();
      document.getElementById('super-indicator').classList.add('active');
      createSparkleBurst(character.position.clone(), 0xff4444);
      createSparkleBurst(new THREE.Vector3(character.position.x, character.position.y + 1, character.position.z), 0xffdd44);
      continue;
    }

    // Despawn if fallen
    if (m.position.y < -10) {
      md.alive = false;
      scene.remove(m);
      mushrooms.splice(mi, 1);
    }
  }

  // === Mario grow/shrink animation ===
  if (growAnimTime >= 0) {
    growAnimTime += dt;
    const gp = Math.min(growAnimTime / growAnimDuration, 1);
    // Flicker effect during transformation
    if (gp < 0.8) {
      const flicker = Math.sin(gp * 30) > 0;
      const flickerScale = flicker ? marioScaleTarget : 1;
      marioScaleCurrent = flickerScale;
    } else {
      marioScaleCurrent = 1 + (marioScaleTarget - 1) * ((gp - 0.8) / 0.2);
    }
    character.scale.setScalar(marioScaleCurrent);
    if (gp >= 1) {
      growAnimTime = -1;
      marioScaleCurrent = marioScaleTarget;
      character.scale.setScalar(marioScaleCurrent);
    }
  }

  // === Shrink animation (power-down) ===
  if (shrinkAnimTime >= 0) {
    shrinkAnimTime += dt;
    const sp = Math.min(shrinkAnimTime / shrinkAnimDuration, 1);
    // Flicker between big and small rapidly
    if (sp < 0.7) {
      const flicker = Math.sin(sp * 35) > 0;
      marioScaleCurrent = flicker ? 1.6 : 1;
    } else {
      // Ease down to target scale
      const easeP = (sp - 0.7) / 0.3;
      marioScaleCurrent = 1.6 - 0.6 * easeP;
    }
    character.scale.setScalar(marioScaleCurrent);
    if (sp >= 1) {
      shrinkAnimTime = -1;
      marioScaleCurrent = 1;
      character.scale.setScalar(1);
    }
  }

    // === Invincibility timer & flashing — use opacity, NEVER hide character ===
  if (isInvincible) {
    invincibleTime += dt;
    const flashRate = invincibleTime < 0.5 ? 20 : 12;
    const flashAlpha = Math.sin(invincibleTime * flashRate * Math.PI) > -0.3 ? 1.0 : 0.25;
    character.traverse(child => {
      if (child.isMesh && child.material) {
        if (!child.material._origTransparent) {
          child.material._origTransparent = child.material.transparent;
          child.material._origOpacity = child.material.opacity;
        }
        child.material.transparent = true;
        child.material.opacity = flashAlpha;
      }
    });
    if (invincibleTime >= invincibleDuration) {
      isInvincible = false;
      invincibleTime = 0;
      character.traverse(child => {
        if (child.isMesh && child.material && child.material._origTransparent !== undefined) {
          child.material.transparent = child.material._origTransparent;
          child.material.opacity = child.material._origOpacity;
          delete child.material._origTransparent;
          delete child.material._origOpacity;
        }
      });
    }
  }
  // Mario is ALWAYS visible
  character.visible = true;

  // === Hazard spike collision ===
  hazards.forEach(h => {
    const dx = Math.abs(character.position.x - h.x);
    const dz = Math.abs(character.position.z - h.z);
    if (dx < h.radiusX + 0.25 && dz < h.radiusZ + 0.25 && character.position.y < 1.2) {
      triggerHit();
    }
  });

  // === Fall off world — lose life and reset position ===
  if (character.position.y < -5 && !isGameOver) {
    if (isBigMario) {
      triggerHit();
    } else if (!isInvincible) {
      // Small Mario falls off — lose a life
      loseLife();
      loseScore(200, character.position);
      isInvincible = true;
      invincibleTime = 0;
    }
    charY = characterBaseY + 3;
    character.position.y = charY;
    character.position.x = -4;
    character.position.z = 2;
    velocityY = 0;
    isGrounded = false;
    character.visible = true;
    // Reset invincibility visuals
    character.traverse(child => {
      if (child.isMesh && child.material && child.material._origTransparent !== undefined) {
        child.material.transparent = child.material._origTransparent;
        child.material.opacity = child.material._origOpacity;
        delete child.material._origTransparent;
        delete child.material._origOpacity;
      }
    });
  }

  // === Auto-collect coins — proximity with generous hitbox ===
  collectibles.forEach(c => {
    const d = c.userData;
    if (d.collected && d.collectAnim !== undefined && d.collectAnim >= 0.5) {
      // Respawn timer
      d.respawnTimer += dt;
      if (d.respawnTimer > 4.0) {
        d.collected = false;
        d.isFlashing = false;
        d.collectAnim = undefined;
        d.respawnTimer = 0;
        c.visible = true;
        d.coin.scale.setScalar(1);
        d.glowSphere.scale.setScalar(1);
        d.glowSphere.material.opacity = 0.1;
        d.coinMat.emissiveIntensity = 0.3;
        d.light.intensity = 0.5;
        d.particles.material.opacity = 0.5;
        // Fade-in respawn
        d.respawnFade = 0;
      }
      return;
    }
    // Respawn fade-in effect
    if (d.respawnFade !== undefined && d.respawnFade < 1) {
      d.respawnFade += dt * 2;
      const fade = Math.min(d.respawnFade, 1);
      d.coin.scale.setScalar(fade);
      d.glowSphere.scale.setScalar(fade);
      d.particles.material.opacity = 0.5 * fade;
      if (fade >= 1) delete d.respawnFade;
    }
    if (d.collected) return;
    // Generous collection radius — scaled if big Mario
    const collectRadius = isBigMario ? 1.4 : 1.0;
    const dist = character.position.distanceTo(c.position);
    if (dist < collectRadius) collectCoin(c);
  });

  // === Question block bump animation ===
  platforms.forEach(p => {
    const d = p.userData;
    if (d && d.isQuestion && d.bumped && d.bumpTime < 0.3) {
      d.bumpTime += dt;
      const prog = d.bumpTime / 0.3;
      const bounce = Math.sin(prog * Math.PI) * 0.4;
      p.position.y = d.baseY + bounce;
      if (prog >= 1) p.position.y = d.baseY;
    }
  });

  // === Coin animations ===
  collectibles.forEach(c => {
    const d = c.userData;
    if (!c.visible) return;

    // Spin & float
    c.position.y = d.baseY + Math.sin(t * 1.5 + d.phase) * 0.15;
    d.coin.rotation.y = t * 3 + d.phase; // Fast spin like Mario coins

    // Pulse glow
    const pulse = 0.25 + Math.sin(t * 3 + d.phase) * 0.15;
    d.coinMat.emissiveIntensity = pulse;
    d.glowSphere.material.opacity = 0.06 + Math.sin(t * 3 + d.phase) * 0.04;
    d.light.intensity = 0.4 + Math.sin(t * 3 + d.phase) * 0.2;

    // Particles
    const posArr = d.particles.geometry.attributes.position.array;
    for (let i = 0; i < posArr.length / 3; i++) {
      const angle = (i / (posArr.length / 3)) * Math.PI * 2 + t * 0.8;
      const r = 0.35 + Math.sin(t * 1.5 + i) * 0.1;
      posArr[i * 3] = Math.cos(angle) * r;
      posArr[i * 3 + 1] = Math.sin(t * 2 + i * 0.5) * 0.25;
      posArr[i * 3 + 2] = Math.sin(angle) * r;
    }
    d.particles.geometry.attributes.position.needsUpdate = true;

    // Collection animation
    if (d.isFlashing && d.collected && d.collectAnim !== undefined) {
      d.collectAnim += dt;
      const p2 = Math.min(d.collectAnim / 0.5, 1);
      const ease = 1 - (1 - p2) * (1 - p2);
      c.position.y = d.baseY + ease * 2;
      d.coin.scale.setScalar((1 - ease));
      d.glowSphere.scale.setScalar(1 + ease * 3);
      d.glowSphere.material.opacity = 0.5 * (1 - ease);
      d.coinMat.emissiveIntensity = 2 * (1 - ease);
      d.light.intensity = 5 * (1 - ease);
      d.particles.material.opacity = 0.6 * (1 - ease);
      if (p2 >= 1) c.visible = false;
    }
  });

  // === Clouds drift ===
  clouds.forEach((cloud, i) => {
    cloud.position.x += 0.08 * dt;
    if (cloud.position.x > 22) cloud.position.x = -22;
    cloud.position.y += Math.sin(t * 0.3 + i) * 0.002;
  });

  // === Background particles ===
  const bpArr = bgParticles.geometry.attributes.position.array;
  for (let i = 0; i < bgParticleCount; i++) {
    bpArr[i * 3 + 1] += 0.004;
    if (bpArr[i * 3 + 1] > 14) bpArr[i * 3 + 1] = -1;
  }
  bgParticles.geometry.attributes.position.needsUpdate = true;

  // === Floating "+1" texts ===
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.life += dt;
    const p = ft.life / ft.maxLife;
    if (p >= 1) {
      scene.remove(ft.sprite);
      ft.sprite.material.map.dispose();
      ft.sprite.material.dispose();
      floatingTexts.splice(i, 1);
      continue;
    }
    ft.sprite.position.y = ft.startY + p * 1.8;
    ft.sprite.material.opacity = 1 - p * p;
    ft.sprite.scale.set(1.2 + p * 0.3, 0.6 + p * 0.15, 1);
  }

  // === Sparkle bursts ===
  for (let i = sparkleBursts.length - 1; i >= 0; i--) {
    const b = sparkleBursts[i];
    b.life += dt;
    const progress = b.life / b.maxLife;
    if (progress >= 1) {
      scene.remove(b.points);
      b.points.geometry.dispose();
      b.points.material.dispose();
      sparkleBursts.splice(i, 1);
      continue;
    }
    const posArr = b.points.geometry.attributes.position.array;
    for (let j = 0; j < b.velocities.length; j++) {
      posArr[j * 3] += b.velocities[j].x * dt;
      posArr[j * 3 + 1] += b.velocities[j].y * dt;
      posArr[j * 3 + 2] += b.velocities[j].z * dt;
      b.velocities[j].y -= 8 * dt;
    }
    b.points.geometry.attributes.position.needsUpdate = true;
    b.points.material.opacity = 1 - progress;
    b.points.material.size = 0.09 * (1 - progress * 0.5);
  }

  composer.render();
}

animate();