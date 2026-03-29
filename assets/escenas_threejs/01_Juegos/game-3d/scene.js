import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

// ===================== SCENE SETUP =====================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 12, 25);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const root = document.getElementById('root') ?? document.body;
root.appendChild(renderer.domElement);

// Sky gradient
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 2; skyCanvas.height = 512;
const skyCtx = skyCanvas.getContext('2d');
const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 512);
skyGrad.addColorStop(0, '#1a0a3e');
skyGrad.addColorStop(0.3, '#4a1a8a');
skyGrad.addColorStop(0.6, '#ff6b35');
skyGrad.addColorStop(0.8, '#ffcc02');
skyGrad.addColorStop(1, '#87ceeb');
skyCtx.fillStyle = skyGrad;
skyCtx.fillRect(0, 0, 2, 512);
const skyTex = new THREE.CanvasTexture(skyCanvas);
scene.background = skyTex;
scene.fog = new THREE.FogExp2(0x4a1a8a, 0.008);

// Lights
const ambLight = new THREE.AmbientLight(0xffc0ff, 0.6);
ambLight.name = 'ambientLight';
scene.add(ambLight);
const sunLight = new THREE.DirectionalLight(0xffe0a0, 2.0);
sunLight.name = 'sunLight';
sunLight.position.set(20, 30, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 100;
sunLight.shadow.camera.left = -40;
sunLight.shadow.camera.right = 40;
sunLight.shadow.camera.top = 40;
sunLight.shadow.camera.bottom = -40;
sunLight.shadow.bias = -0.001;
sunLight.shadow.normalBias = 0.02;
scene.add(sunLight);
const rimLight = new THREE.DirectionalLight(0x00ccff, 0.5);
rimLight.name = 'rimLight';
rimLight.position.set(-15, 10, -15);
scene.add(rimLight);
const pointLight1 = new THREE.PointLight(0xff00ff, 2, 30);
pointLight1.name = 'discoLight1';
pointLight1.position.set(0, 15, 0);
scene.add(pointLight1);

// Controls (for spectator mode)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2.1;
controls.minDistance = 8;
controls.maxDistance = 50;
controls.enabled = false; // disabled by default, player mode is default

// ===================== MATERIALS =====================
const grassMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.9 });
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.7 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.8 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.6 });
const waterMat = new THREE.MeshStandardMaterial({ color: 0x2196F3, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2 });
const neonPink = new THREE.MeshStandardMaterial({ color: 0xff1493, emissive: 0xff1493, emissiveIntensity: 0.5 });
const neonBlue = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.5 });
const rainbowMats = [
  new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.3 }),
  new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff8800, emissiveIntensity: 0.3 }),
  new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.3 }),
  new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.3 }),
  new THREE.MeshStandardMaterial({ color: 0x0088ff, emissive: 0x0088ff, emissiveIntensity: 0.3 }),
  new THREE.MeshStandardMaterial({ color: 0x8800ff, emissive: 0x8800ff, emissiveIntensity: 0.3 }),
];

// ===================== PLAYER CHARACTER =====================
let playerMode = true;
let score = 0;
let playerLevel = 1;
let playerSpeed = 0.18;
let jumpVelocity = 0;
let isGrounded = true;
const GRAVITY = -0.015;
const JUMP_FORCE = 0.32;
const PLAYER_GROUND_Y = 0;

// Build the player character (special golden outline)
const playerGroup = new THREE.Group();
playerGroup.name = 'playerCharacter';

const playerSkinMat = new THREE.MeshStandardMaterial({ color: 0x44ddff, roughness: 0.6 });
const playerShirtMat = new THREE.MeshStandardMaterial({ color: 0xff2266, roughness: 0.7 });
const playerPantsMat = new THREE.MeshStandardMaterial({ color: 0x1a1a4e, roughness: 0.8 });
const playerGlowMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.6, transparent: true, opacity: 0.25 });

// Head
const playerHead = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), playerSkinMat);
playerHead.name = 'playerHead';
playerHead.position.y = 4.3;
playerHead.castShadow = true;

// Player face (super cool sunglasses + big grin)
const pFaceCanvas = document.createElement('canvas');
pFaceCanvas.width = 128; pFaceCanvas.height = 128;
const pCtx = pFaceCanvas.getContext('2d');
pCtx.fillStyle = '#44ddff';
pCtx.fillRect(0, 0, 128, 128);
// Cool sunglasses
pCtx.fillStyle = '#111';
pCtx.fillRect(22, 38, 84, 20);
pCtx.fillStyle = '#0088ff';
pCtx.fillRect(26, 42, 30, 12);
pCtx.fillRect(72, 42, 30, 12);
// Star on glasses
pCtx.fillStyle = '#ffd700';
pCtx.font = '14px sans-serif';
pCtx.fillText('★', 33, 53);
pCtx.fillText('★', 79, 53);
// Big grin
pCtx.fillStyle = '#222';
pCtx.beginPath(); pCtx.arc(64, 82, 22, 0, Math.PI); pCtx.fill();
pCtx.fillStyle = '#fff';
pCtx.beginPath(); pCtx.arc(64, 82, 18, 0, Math.PI); pCtx.fill();
pCtx.fillStyle = '#ff6666';
pCtx.beginPath(); pCtx.arc(64, 88, 8, 0, Math.PI); pCtx.fill();

const pFaceTex = new THREE.CanvasTexture(pFaceCanvas);
const pFaceMats = [playerSkinMat, playerSkinMat, playerSkinMat, playerSkinMat, new THREE.MeshStandardMaterial({ map: pFaceTex, roughness: 0.6 }), playerSkinMat];
playerHead.material = pFaceMats;
playerGroup.add(playerHead);

// Crown (player is special!)
const pCrownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.5, 6), goldMat);
pCrownBase.position.y = 5.4;
playerGroup.add(pCrownBase);
for (let i = 0; i < 6; i++) {
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 4), goldMat);
  spike.position.set(Math.cos(i / 6 * Math.PI * 2) * 0.75, 5.95, Math.sin(i / 6 * Math.PI * 2) * 0.75);
  playerGroup.add(spike);
  const gem = new THREE.Mesh(new THREE.SphereGeometry(0.12), rainbowMats[i % 6]);
  gem.position.copy(spike.position); gem.position.y -= 0.25;
  playerGroup.add(gem);
}

// Torso
const playerTorso = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1), playerShirtMat);
playerTorso.name = 'playerTorso';
playerTorso.position.y = 2.6;
playerTorso.castShadow = true;
playerGroup.add(playerTorso);

// Star emblem on shirt
const starCanvas = document.createElement('canvas');
starCanvas.width = 64; starCanvas.height = 64;
const sCtx = starCanvas.getContext('2d');
sCtx.fillStyle = '#ff2266';
sCtx.fillRect(0, 0, 64, 64);
sCtx.fillStyle = '#ffd700';
sCtx.font = 'bold 40px sans-serif';
sCtx.textAlign = 'center';
sCtx.fillText('★', 32, 46);
const starTex = new THREE.CanvasTexture(starCanvas);
const starMats = [playerShirtMat, playerShirtMat, playerShirtMat, playerShirtMat, new THREE.MeshStandardMaterial({ map: starTex, roughness: 0.7 }), playerShirtMat];
playerTorso.material = starMats;

// Arms
for (let side of [-1, 1]) {
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), playerSkinMat);
  arm.name = `playerArm_${side === -1 ? 'L' : 'R'}`;
  arm.position.set(side * 1.1, 2.6, 0);
  arm.castShadow = true;
  playerGroup.add(arm);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), playerSkinMat);
  hand.name = `playerHand_${side === -1 ? 'L' : 'R'}`;
  hand.position.set(side * 1.1, 1.5, 0);
  playerGroup.add(hand);
}

// Legs
for (let side of [-1, 1]) {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.7), playerPantsMat);
  leg.name = `playerLeg_${side === -1 ? 'L' : 'R'}`;
  leg.position.set(side * 0.4, 0.8, 0);
  leg.castShadow = true;
  playerGroup.add(leg);
}

// Cape
const playerCape = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.15), new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xcc8800, emissiveIntensity: 0.3 }));
playerCape.name = 'playerCape';
playerCape.position.set(0, 2.8, -0.65);
playerGroup.add(playerCape);

// Glow aura
const playerAura = new THREE.Mesh(new THREE.SphereGeometry(2.8, 16, 16), playerGlowMat);
playerAura.name = 'playerAura';
playerAura.position.y = 2.5;
playerGroup.add(playerAura);

playerGroup.position.set(0, 0, 0);
playerGroup.scale.setScalar(0.85);
scene.add(playerGroup);

// ===================== COLLECTIBLE COINS =====================
const coins = [];
const COIN_COUNT = 25;
for (let i = 0; i < COIN_COUNT; i++) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16), goldMat);
  c.name = `coin_${i}`;
  c.rotation.x = Math.PI / 2;
  const cGroup = new THREE.Group();
  cGroup.name = `coinGroup_${i}`;
  cGroup.add(c);
  // "R" label
  const rCanvas = document.createElement('canvas');
  rCanvas.width = 32; rCanvas.height = 32;
  const rCtx = rCanvas.getContext('2d');
  rCtx.fillStyle = '#ffd700';
  rCtx.beginPath(); rCtx.arc(16, 16, 16, 0, Math.PI * 2); rCtx.fill();
  rCtx.fillStyle = '#aa7700';
  rCtx.font = 'bold 22px sans-serif';
  rCtx.textAlign = 'center';
  rCtx.fillText('R', 16, 23);

  const angle = (i / COIN_COUNT) * Math.PI * 2;
  const radius = 8 + Math.random() * 25;
  cGroup.position.set(
    Math.cos(angle) * radius,
    1.5 + Math.random() * 4,
    Math.sin(angle) * radius
  );
  cGroup.position.x = Math.max(-38, Math.min(38, cGroup.position.x));
  cGroup.position.z = Math.max(-38, Math.min(38, cGroup.position.z));
  cGroup.userData = { collected: false, baseY: cGroup.position.y, bobOffset: Math.random() * Math.PI * 2 };
  scene.add(cGroup);
  coins.push(cGroup);
}

// ===================== KEYBOARD INPUT =====================
const keys = { w: false, a: false, s: false, d: false, up: false, down: false, left: false, right: false, space: false };

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

// ===================== GROUND =====================
const groundGeo = new THREE.BoxGeometry(80, 2, 80);
const ground = new THREE.Mesh(groundGeo, grassMat);
ground.name = 'ground';
ground.position.y = -1;
ground.receiveShadow = true;
scene.add(ground);

// Baseplate border
const borderMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.5 });
for (let i = 0; i < 4; i++) {
  const border = new THREE.Mesh(new THREE.BoxGeometry(i < 2 ? 82 : 2, 3, i < 2 ? 2 : 82), borderMat);
  border.name = `border_${i}`;
  border.position.set(
    i === 2 ? -41 : i === 3 ? 41 : 0,
    0.5,
    i === 0 ? -41 : i === 1 ? 41 : 0
  );
  border.receiveShadow = true;
  scene.add(border);
}

// ===================== ROBLOX CHARACTER BUILDER =====================
const characters = [];
const SKIN_COLORS = [0xffcc99, 0x8d5524, 0xffdbac, 0xc68642, 0xf1c27d, 0xe0ac69, 0xff9999, 0x99ccff, 0xcc99ff, 0x99ffcc];
const SHIRT_COLORS = [0xff3333, 0x3333ff, 0x33cc33, 0xffcc00, 0xff66cc, 0x00cccc, 0xff8800, 0x8833ff, 0x33ffcc, 0xff3388];
const PANTS_COLORS = [0x222244, 0x333366, 0x444488, 0x1a1a2e, 0x2d2d5e, 0x553322, 0x224422, 0x442244];
const HAT_TYPES = ['none', 'tophat', 'crown', 'antenna', 'halo', 'party', 'viking', 'propeller', 'chef', 'wizard'];
const FACE_TYPES = ['happy', 'derp', 'cool', 'wink', 'surprised', 'mischief', 'love', 'rage', 'chill', 'clown'];
const ACCESSORY_TYPES = ['none', 'cape', 'wings', 'jetpack', 'sword', 'guitar', 'balloon'];

function createRobloxCharacter(x, z, seed) {
  const rng = (s) => { s = Math.sin(s * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const r = (i) => rng(seed * 100 + i);

  const group = new THREE.Group();
  group.name = `character_${seed}`;

  const skinColor = SKIN_COLORS[Math.floor(r(0) * SKIN_COLORS.length)];
  const shirtColor = SHIRT_COLORS[Math.floor(r(1) * SHIRT_COLORS.length)];
  const pantsColor = PANTS_COLORS[Math.floor(r(2) * PANTS_COLORS.length)];
  const hatType = HAT_TYPES[Math.floor(r(3) * HAT_TYPES.length)];
  const faceType = FACE_TYPES[Math.floor(r(4) * FACE_TYPES.length)];
  const accType = ACCESSORY_TYPES[Math.floor(r(5) * ACCESSORY_TYPES.length)];
  const scale = 0.7 + r(6) * 0.6;

  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });

  // HEAD (blocky Roblox style)
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), skinMat);
  head.name = `head_${seed}`;
  head.position.y = 4.3;
  head.castShadow = true;
  group.add(head);

  // FACE - drawn on canvas texture
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 128; faceCanvas.height = 128;
  const fCtx = faceCanvas.getContext('2d');
  fCtx.fillStyle = '#' + skinColor.toString(16).padStart(6, '0');
  fCtx.fillRect(0, 0, 128, 128);

  // Draw face based on type
  fCtx.fillStyle = '#222';
  fCtx.strokeStyle = '#222';
  fCtx.lineWidth = 3;
  fCtx.lineCap = 'round';

  switch(faceType) {
    case 'happy':
      fCtx.beginPath(); fCtx.arc(40, 48, 8, 0, Math.PI * 2); fCtx.fill();
      fCtx.beginPath(); fCtx.arc(88, 48, 8, 0, Math.PI * 2); fCtx.fill();
      fCtx.beginPath(); fCtx.arc(64, 78, 20, 0, Math.PI); fCtx.stroke();
      break;
    case 'derp':
      fCtx.beginPath(); fCtx.arc(38, 45, 10, 0, Math.PI * 2); fCtx.fill();
      fCtx.fillStyle = '#fff'; fCtx.beginPath(); fCtx.arc(35, 43, 4, 0, Math.PI * 2); fCtx.fill();
      fCtx.fillStyle = '#222';
      fCtx.beginPath(); fCtx.arc(90, 52, 10, 0, Math.PI * 2); fCtx.fill();
      fCtx.fillStyle = '#fff'; fCtx.beginPath(); fCtx.arc(93, 50, 4, 0, Math.PI * 2); fCtx.fill();
      fCtx.fillStyle = '#222';
      fCtx.beginPath(); fCtx.arc(64, 85, 12, 0, Math.PI * 2); fCtx.fill();
      fCtx.fillStyle = '#ff6666'; fCtx.beginPath(); fCtx.arc(64, 88, 6, 0, Math.PI); fCtx.fill();
      break;
    case 'cool':
      fCtx.fillStyle = '#111'; fCtx.fillRect(25, 40, 78, 18);
      fCtx.fillStyle = '#333'; fCtx.fillRect(28, 43, 30, 12);
      fCtx.fillRect(70, 43, 30, 12);
      fCtx.fillStyle = '#222';
      fCtx.beginPath(); fCtx.moveTo(40, 85); fCtx.lineTo(64, 78); fCtx.lineTo(88, 85); fCtx.stroke();
      break;
    case 'wink':
      fCtx.beginPath(); fCtx.arc(40, 48, 8, 0, Math.PI * 2); fCtx.fill();
      fCtx.lineWidth = 4;
      fCtx.beginPath(); fCtx.moveTo(78, 48); fCtx.lineTo(98, 48); fCtx.stroke();
      fCtx.lineWidth = 3;
      fCtx.beginPath(); fCtx.arc(64, 78, 18, 0.1, Math.PI - 0.1); fCtx.stroke();
      fCtx.fillStyle = '#ff6666'; fCtx.beginPath(); fCtx.arc(64, 80, 8, 0, Math.PI); fCtx.fill();
      break;
    case 'surprised':
      fCtx.beginPath(); fCtx.arc(40, 45, 12, 0, Math.PI * 2); fCtx.fill();
      fCtx.fillStyle = '#fff'; fCtx.beginPath(); fCtx.arc(37, 42, 5, 0, Math.PI * 2); fCtx.fill();
      fCtx.fillStyle = '#222';
      fCtx.beginPath(); fCtx.arc(88, 45, 12, 0, Math.PI * 2); fCtx.fill();
      fCtx.fillStyle = '#fff'; fCtx.beginPath(); fCtx.arc(85, 42, 5, 0, Math.PI * 2); fCtx.fill();
      fCtx.fillStyle = '#222';
      fCtx.beginPath(); fCtx.arc(64, 85, 10, 0, Math.PI * 2); fCtx.fill();
      break;
    case 'mischief':
      fCtx.lineWidth = 4;
      fCtx.beginPath(); fCtx.moveTo(30, 42); fCtx.lineTo(50, 50); fCtx.stroke();
      fCtx.beginPath(); fCtx.moveTo(98, 42); fCtx.lineTo(78, 50); fCtx.stroke();
      fCtx.beginPath(); fCtx.arc(40, 50, 5, 0, Math.PI * 2); fCtx.fill();
      fCtx.beginPath(); fCtx.arc(88, 50, 5, 0, Math.PI * 2); fCtx.fill();
      fCtx.lineWidth = 3;
      fCtx.beginPath(); fCtx.moveTo(44, 80); fCtx.quadraticCurveTo(64, 95, 84, 75); fCtx.stroke();
      break;
    case 'love':
      fCtx.fillStyle = '#ff3366';
      for (let eye of [40, 88]) {
        fCtx.beginPath();
        fCtx.moveTo(eye, 52); fCtx.bezierCurveTo(eye - 8, 38, eye - 14, 48, eye, 56);
        fCtx.bezierCurveTo(eye + 14, 48, eye + 8, 38, eye, 52);
        fCtx.fill();
      }
      fCtx.fillStyle = '#222';
      fCtx.beginPath(); fCtx.arc(64, 80, 16, 0, Math.PI); fCtx.fill();
      fCtx.fillStyle = '#ff6666'; fCtx.beginPath(); fCtx.arc(64, 82, 8, 0, Math.PI); fCtx.fill();
      break;
    case 'rage':
      fCtx.fillStyle = '#cc0000';
      fCtx.lineWidth = 4;
      fCtx.beginPath(); fCtx.moveTo(28, 38); fCtx.lineTo(52, 48); fCtx.stroke();
      fCtx.beginPath(); fCtx.moveTo(100, 38); fCtx.lineTo(76, 48); fCtx.stroke();
      fCtx.fillStyle = '#222';
      fCtx.beginPath(); fCtx.arc(40, 50, 6, 0, Math.PI * 2); fCtx.fill();
      fCtx.beginPath(); fCtx.arc(88, 50, 6, 0, Math.PI * 2); fCtx.fill();
      fCtx.fillRect(42, 78, 44, 8);
      for (let tx = 48; tx < 86; tx += 8) { fCtx.fillStyle = '#fff'; fCtx.fillRect(tx, 80, 4, 4); }
      break;
    case 'chill':
      fCtx.lineWidth = 4;
      fCtx.beginPath(); fCtx.moveTo(30, 48); fCtx.quadraticCurveTo(40, 42, 50, 48); fCtx.stroke();
      fCtx.beginPath(); fCtx.moveTo(78, 48); fCtx.quadraticCurveTo(88, 42, 98, 48); fCtx.stroke();
      fCtx.beginPath(); fCtx.moveTo(48, 82); fCtx.quadraticCurveTo(64, 88, 80, 82); fCtx.stroke();
      break;
    case 'clown':
      fCtx.beginPath(); fCtx.arc(40, 48, 7, 0, Math.PI * 2); fCtx.fill();
      fCtx.beginPath(); fCtx.arc(88, 48, 7, 0, Math.PI * 2); fCtx.fill();
      fCtx.fillStyle = '#ff0000';
      fCtx.beginPath(); fCtx.arc(64, 62, 10, 0, Math.PI * 2); fCtx.fill();
      fCtx.fillStyle = '#ff0000';
      fCtx.beginPath(); fCtx.arc(64, 85, 18, 0, Math.PI); fCtx.fill();
      break;
  }

  const faceTex = new THREE.CanvasTexture(faceCanvas);
  const faceMats = [skinMat, skinMat, skinMat, skinMat, new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.7 }), skinMat];
  head.material = faceMats;

  // TORSO
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1), shirtMat);
  torso.name = `torso_${seed}`;
  torso.position.y = 2.6;
  torso.castShadow = true;
  group.add(torso);

  // ARMS
  for (let side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), skinMat);
    arm.name = `arm_${side === -1 ? 'L' : 'R'}_${seed}`;
    arm.position.set(side * 1.1, 2.6, 0);
    arm.castShadow = true;
    group.add(arm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
    hand.name = `hand_${side === -1 ? 'L' : 'R'}_${seed}`;
    hand.position.set(side * 1.1, 1.5, 0);
    group.add(hand);
  }

  // LEGS
  for (let side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.7), pantsMat);
    leg.name = `leg_${side === -1 ? 'L' : 'R'}_${seed}`;
    leg.position.set(side * 0.4, 0.8, 0);
    leg.castShadow = true;
    group.add(leg);
  }

  // HAT
  switch(hatType) {
    case 'tophat': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.15, 16), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      brim.position.y = 5.2;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.2, 16), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      top.position.y = 5.8;
      group.add(brim); group.add(top);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.81, 0.81, 0.15, 16), goldMat);
      band.position.y = 5.35;
      group.add(band);
      break;
    }
    case 'crown': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 6), goldMat);
      base.position.y = 5.4;
      group.add(base);
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 4), goldMat);
        spike.position.set(Math.cos(i / 6 * Math.PI * 2) * 0.7, 5.9, Math.sin(i / 6 * Math.PI * 2) * 0.7);
        group.add(spike);
        const gem = new THREE.Mesh(new THREE.SphereGeometry(0.1), rainbowMats[i % rainbowMats.length]);
        gem.position.copy(spike.position); gem.position.y -= 0.2;
        group.add(gem);
      }
      break;
    }
    case 'antenna': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 }));
      pole.position.y = 5.8;
      group.add(pole);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), neonPink);
      ball.name = `antennaBall_${seed}`;
      ball.position.y = 6.6;
      group.add(ball);
      break;
    }
    case 'halo': {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 8, 32), goldMat);
      halo.name = `halo_${seed}`;
      halo.position.y = 5.8;
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
      break;
    }
    case 'party': {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.5, 16), rainbowMats[Math.floor(r(10) * 6)]);
      cone.position.y = 5.8;
      group.add(cone);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.2), rainbowMats[(Math.floor(r(10) * 6) + 3) % 6]);
      pom.position.y = 6.6;
      group.add(pom);
      break;
    }
    case 'viking': {
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7 }));
      helm.position.y = 5.1;
      group.add(helm);
      for (let side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1, 8), new THREE.MeshStandardMaterial({ color: 0xffe0a0 }));
        horn.position.set(side * 0.9, 5.5, 0);
        horn.rotation.z = side * -0.6;
        group.add(horn);
      }
      break;
    }
    case 'propeller': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), rainbowMats[Math.floor(r(11) * 6)]);
      cap.position.y = 5.1;
      group.add(cap);
      const propGroup = new THREE.Group();
      propGroup.name = `propeller_${seed}`;
      propGroup.position.y = 5.9;
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 1), rainbowMats[(i * 2) % 6]);
        blade.rotation.y = (i / 3) * Math.PI * 2;
        propGroup.add(blade);
      }
      group.add(propGroup);
      break;
    }
    case 'chef': {
      const chefBase = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.85, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      chefBase.position.y = 5.2;
      group.add(chefBase);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      puff.position.y = 5.7;
      group.add(puff);
      break;
    }
    case 'wizard': {
      const wizHat = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2, 16), new THREE.MeshStandardMaterial({ color: 0x220066, emissive: 0x110033, emissiveIntensity: 0.3 }));
      wizHat.position.y = 6.1;
      group.add(wizHat);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), goldMat);
      star.position.set(0.3, 5.8, 0.8);
      group.add(star);
      break;
    }
  }

  // ACCESSORIES
  switch(accType) {
    case 'cape': {
      const cape = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.15), new THREE.MeshStandardMaterial({ color: 0xcc0000, emissive: 0x330000, emissiveIntensity: 0.2 }));
      cape.name = `cape_${seed}`;
      cape.position.set(0, 2.8, -0.6);
      group.add(cape);
      break;
    }
    case 'wings': {
      for (let side of [-1, 1]) {
        const wing = new THREE.Group();
        for (let f = 0; f < 3; f++) {
          const feather = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2 - f * 0.2, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xaaddff, emissiveIntensity: 0.3, transparent: true, opacity: 0.8 }));
          feather.position.set(side * (1.2 + f * 0.3), 3.2 - f * 0.3, -0.3);
          feather.rotation.z = side * (0.3 + f * 0.15);
          group.add(feather);
        }
      }
      break;
    }
    case 'jetpack': {
      for (let side of [-0.4, 0.4]) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8 }));
        tank.position.set(side, 2.6, -0.8);
        group.add(tank);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 1.0, transparent: true, opacity: 0.8 }));
        flame.name = `flame_${side > 0 ? 'R' : 'L'}_${seed}`;
        flame.position.set(side, 1.7, -0.8);
        flame.rotation.x = Math.PI;
        group.add(flame);
      }
      break;
    }
    case 'sword': {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2, 0.06), new THREE.MeshStandardMaterial({ color: 0xccccee, metalness: 0.9, roughness: 0.1 }));
      blade.position.set(1.5, 2.8, 0);
      blade.rotation.z = 0.3;
      group.add(blade);
      const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.15), goldMat);
      hilt.position.set(1.35, 1.8, 0);
      hilt.rotation.z = 0.3;
      group.add(hilt);
      break;
    }
    case 'guitar': {
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), woodMat);
      neck.position.set(-1.2, 3.2, 0.4);
      neck.rotation.z = -0.4;
      group.add(neck);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.15, 16), new THREE.MeshStandardMaterial({ color: 0xcc4400 }));
      body.position.set(-1.6, 2.2, 0.4);
      body.rotation.x = Math.PI / 2;
      group.add(body);
      break;
    }
    case 'balloon': {
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3, 4), new THREE.MeshStandardMaterial({ color: 0x999999 }));
      string.position.set(0.8, 5.5, 0);
      group.add(string);
      const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), rainbowMats[Math.floor(r(12) * 6)]);
      balloon.name = `balloon_${seed}`;
      balloon.position.set(0.8, 7.2, 0);
      group.add(balloon);
      break;
    }
  }

  group.scale.setScalar(scale);
  group.position.set(x, 0, z);
  group.userData = { seed, hatType, accType, faceType, bounceOffset: r(7) * Math.PI * 2, walkOffset: r(8) * Math.PI * 2, speed: 0.3 + r(9) * 0.7, walkRadius: 3 + r(13) * 8, baseX: x, baseZ: z };
  scene.add(group);
  characters.push(group);
  return group;
}

// Spawn 15 unique characters
const charPositions = [
  [0, 0], [-8, -5], [8, -5], [-5, 8], [5, 8],
  [-15, -12], [15, -12], [-12, 15], [12, 15], [0, -15],
  [-20, 0], [20, 0], [0, 20], [-18, 18], [18, -18]
];
charPositions.forEach((pos, i) => createRobloxCharacter(pos[0], pos[1], i + 1));

// ===================== ENVIRONMENT =====================

// TREES (instanced trunks and leaves)
const treePositions = [
  [-25, -25], [-20, -15], [-30, 5], [-15, 20], [-25, 25],
  [25, -25], [20, -15], [30, 5], [15, 20], [25, 25],
  [-35, -35], [35, -35], [-35, 35], [35, 35], [0, -30], [0, 30]
];
treePositions.forEach((pos, i) => {
  const h = 3 + Math.random() * 4;
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.8), woodMat);
  trunk.name = `trunk_${i}`;
  trunk.position.set(pos[0], h / 2, pos[1]);
  trunk.castShadow = true;
  scene.add(trunk);
  const leaves = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random(), 8, 8), leafMat);
  leaves.name = `leaves_${i}`;
  leaves.position.set(pos[0], h + 1.5, pos[1]);
  leaves.castShadow = true;
  scene.add(leaves);
});

// RAINBOW BRIDGE
const rainbowGroup = new THREE.Group();
rainbowGroup.name = 'rainbowBridge';
for (let i = 0; i < 6; i++) {
  const radius = 12 - i * 0.5;
  const tube = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.4, 8, 48, Math.PI),
    rainbowMats[i]
  );
  tube.position.set(-20, 0, -10);
  tube.rotation.y = Math.PI / 4;
  rainbowGroup.add(tube);
}
scene.add(rainbowGroup);

// POND
const pond = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.3, 32), waterMat);
pond.name = 'pond';
pond.position.set(18, 0.15, 18);
pond.receiveShadow = true;
scene.add(pond);

// FLOATING PLATFORMS
const platformColors = [0xff4488, 0x44ff88, 0x4488ff, 0xffaa00, 0xaa44ff];
const platforms = [];
for (let i = 0; i < 5; i++) {
  const plat = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.5, 3),
    new THREE.MeshStandardMaterial({ color: platformColors[i], emissive: platformColors[i], emissiveIntensity: 0.2 })
  );
  plat.name = `platform_${i}`;
  const angle = (i / 5) * Math.PI * 2;
  plat.position.set(Math.cos(angle) * 15, 4 + i * 1.5, Math.sin(angle) * 15);
  plat.castShadow = true;
  plat.receiveShadow = true;
  scene.add(plat);
  platforms.push(plat);
}

// GIANT SPINNING COIN
const coinGroup = new THREE.Group();
coinGroup.name = 'giantCoin';
const coin = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.3, 32), goldMat);
coin.rotation.x = Math.PI / 2;
coinGroup.add(coin);
const coinR = new THREE.Mesh(new THREE.TorusGeometry(2, 0.15, 8, 32), new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.9, roughness: 0.1 }));
coinR.rotation.x = Math.PI / 2;
coinGroup.add(coinR);
coinGroup.position.set(0, 10, -15);
scene.add(coinGroup);

// DISCO FLOOR
const discoTiles = [];
for (let dx = -4; dx <= 4; dx++) {
  for (let dz = -4; dz <= 4; dz++) {
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.2, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 })
    );
    tile.name = `discoTile_${dx + 4}_${dz + 4}`;
    tile.position.set(dx * 2 - 20, 0.1, dz * 2);
    scene.add(tile);
    discoTiles.push(tile);
  }
}

// BOUNCY MUSHROOMS
const mushrooms = [];
const mushColors = [0xff4466, 0x44aaff, 0xffcc00, 0xaa44ff, 0x44ff88];
for (let i = 0; i < 5; i++) {
  const mGroup = new THREE.Group();
  mGroup.name = `mushroom_${i}`;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0xffeedd }));
  mGroup.add(stem);
  stem.position.y = 0.75;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: mushColors[i], emissive: mushColors[i], emissiveIntensity: 0.3 }));
  cap.position.y = 1.5;
  mGroup.add(cap);
  // White spots
  for (let s = 0; s < 4; s++) {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    spot.position.set(Math.cos(s * 1.5) * 0.6, 1.7 + Math.sin(s * 2) * 0.2, Math.sin(s * 1.5) * 0.6);
    mGroup.add(spot);
  }
  const angle = (i / 5) * Math.PI * 2 + 0.5;
  mGroup.position.set(Math.cos(angle) * 10, 0, Math.sin(angle) * 10);
  scene.add(mGroup);
  mushrooms.push(mGroup);
}

// SPARKLE PARTICLES
const sparkleCount = 200;
const sparkleGeo = new THREE.BufferGeometry();
const sparklePos = new Float32Array(sparkleCount * 3);
const sparkleSizes = new Float32Array(sparkleCount);
for (let i = 0; i < sparkleCount; i++) {
  sparklePos[i * 3] = (Math.random() - 0.5) * 80;
  sparklePos[i * 3 + 1] = Math.random() * 20;
  sparklePos[i * 3 + 2] = (Math.random() - 0.5) * 80;
  sparkleSizes[i] = Math.random() * 0.3 + 0.1;
}
sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePos, 3));
sparkleGeo.setAttribute('size', new THREE.BufferAttribute(sparkleSizes, 1));
const sparkleMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.8, sizeAttenuation: true });
const sparkles = new THREE.Points(sparkleGeo, sparkleMat);
sparkles.name = 'sparkles';
scene.add(sparkles);

// OBBY TOWER
const obbyColors = [0xff3333, 0xff8833, 0xffff33, 0x33ff33, 0x3333ff, 0x8833ff, 0xff33ff];
for (let i = 0; i < 7; i++) {
  const obbyBlock = new THREE.Mesh(
    new THREE.BoxGeometry(2.5 - i * 0.15, 1, 2.5 - i * 0.15),
    new THREE.MeshStandardMaterial({ color: obbyColors[i], emissive: obbyColors[i], emissiveIntensity: 0.15 })
  );
  obbyBlock.name = `obbyBlock_${i}`;
  obbyBlock.position.set(25, 0.5 + i * 1.2, -20);
  obbyBlock.castShadow = true;
  scene.add(obbyBlock);
}
// Flag on top
const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8 }));
flagPole.name = 'flagPole';
flagPole.position.set(25, 10, -20);
scene.add(flagPole);
const flag = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.05), neonPink);
flag.name = 'flag';
flag.position.set(25.8, 11, -20);
scene.add(flag);

// ===================== UI / HUD =====================
const hudDiv = document.createElement('div');
hudDiv.style.cssText = `
  position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.7); border: 2px solid rgba(255,255,255,0.15);
  border-radius: 12px; padding: 10px 24px;
  font-family: 'Inter', sans-serif; color: white; font-size: 16px;
  z-index: 1000; text-align: center; pointer-events: none;
  backdrop-filter: blur(8px);
`;
hudDiv.innerHTML = `<div style="font-size:22px;font-weight:700;letter-spacing:1px;">🎮 ROBLOX WORLD 🎮</div>
<div style="font-size:12px;opacity:0.7;margin-top:4px;">WASD to move • SPACE to jump • Collect coins! • Click NPCs to dance!</div>`;
document.body.appendChild(hudDiv);

// Score display
const scoreDiv = document.createElement('div');
scoreDiv.style.cssText = `
  position: fixed; top: 70px; right: 15px;
  background: rgba(0,0,0,0.75); border: 2px solid rgba(255,215,0,0.4);
  border-radius: 14px; padding: 14px 22px;
  font-family: 'Inter', sans-serif; color: white; font-size: 14px;
  z-index: 1000; pointer-events: none;
  backdrop-filter: blur(8px); min-width: 160px;
`;
scoreDiv.innerHTML = `
<div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;opacity:0.5;margin-bottom:8px;">Scoreboard</div>
<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
  <span style="font-size:20px;">🪙</span>
  <span style="color:#ffd740;font-weight:700;font-size:20px;" id="scoreDisplay">0</span>
  <span style="opacity:0.5;font-size:12px;">/ ${COIN_COUNT}</span>
</div>
<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
  <span style="font-size:20px;">🏆</span>
  <span style="color:#69f0ae;font-weight:700;font-size:16px;" id="levelDisplay">Level 1</span>
</div>
<div style="display:flex;align-items:center;gap:8px;">
  <span style="font-size:20px;">⭐</span>
  <span style="color:#4fc3f7;font-weight:700;font-size:16px;" id="robuxDisplay">0</span>
  <span style="opacity:0.5;font-size:12px;">Robux</span>
</div>
`;
document.body.appendChild(scoreDiv);

// Combo / message display
const comboDiv = document.createElement('div');
comboDiv.style.cssText = `
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  font-family: 'Inter', sans-serif; color: #ffd700; font-size: 36px; font-weight: 700;
  z-index: 1000; pointer-events: none; text-align: center;
  text-shadow: 0 0 20px rgba(255,215,0,0.8), 0 2px 4px rgba(0,0,0,0.5);
  opacity: 0; transition: opacity 0.3s;
`;
document.body.appendChild(comboDiv);

let comboTimer = 0;
function showMessage(msg, color = '#ffd700') {
  comboDiv.textContent = msg;
  comboDiv.style.color = color;
  comboDiv.style.opacity = '1';
  comboTimer = 2.0;
}

// Camera mode toggle button
const modeBtn = document.createElement('div');
modeBtn.style.cssText = `
  position: fixed; bottom: 15px; right: 15px;
  background: rgba(0,0,0,0.75); border: 2px solid rgba(255,255,255,0.2);
  border-radius: 10px; padding: 10px 18px;
  font-family: 'Inter', sans-serif; color: white; font-size: 13px;
  z-index: 1000; cursor: pointer; user-select: none;
  backdrop-filter: blur(8px); transition: border-color 0.2s;
`;
modeBtn.innerHTML = '🎥 <span style="font-weight:700;">Tab</span> Free Camera';
modeBtn.addEventListener('click', toggleMode);
document.body.appendChild(modeBtn);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') { e.preventDefault(); toggleMode(); }
});

function toggleMode() {
  playerMode = !playerMode;
  controls.enabled = !playerMode;
  modeBtn.innerHTML = playerMode
    ? '🎥 <span style="font-weight:700;">Tab</span> Free Camera'
    : '🏃 <span style="font-weight:700;">Tab</span> Player Mode';
  if (!playerMode) {
    controls.target.copy(playerGroup.position);
    controls.target.y += 3;
  }
}

// Bottom stats
const statsDiv = document.createElement('div');
statsDiv.style.cssText = `
  position: fixed; bottom: 15px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.7); border: 2px solid rgba(255,255,255,0.15);
  border-radius: 12px; padding: 8px 20px;
  font-family: 'Inter', sans-serif; color: white; font-size: 13px;
  z-index: 1000; display: flex; gap: 20px; pointer-events: none;
  backdrop-filter: blur(8px);
`;
statsDiv.innerHTML = `
<div>👤 NPCs: <span style="color:#4fc3f7;font-weight:700;">15</span></div>
<div>🍄 Mushrooms: <span style="color:#69f0ae;font-weight:700;">5</span></div>
<div>🌈 Rainbow: <span style="color:#e040fb;font-weight:700;">ON</span></div>
<div>🪙 Coins: <span style="color:#ffd740;font-weight:700;">${COIN_COUNT}</span></div>
`;
document.body.appendChild(statsDiv);

// Load Inter font
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

// ===================== MINIMAP =====================
const minimapSize = 180;
const minimapPadding = 15;
const minimapScale = 80; // world units mapped to minimap

const minimapContainer = document.createElement('div');
minimapContainer.style.cssText = `
  position: fixed; bottom: ${minimapPadding}px; left: ${minimapPadding}px;
  width: ${minimapSize}px; height: ${minimapSize}px;
  border-radius: 12px; overflow: hidden;
  border: 2px solid rgba(255,255,255,0.2);
  background: rgba(0,0,0,0.75);
  backdrop-filter: blur(8px);
  z-index: 1000; pointer-events: none;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
`;
document.body.appendChild(minimapContainer);

const minimapLabel = document.createElement('div');
minimapLabel.style.cssText = `
  position: absolute; top: 6px; left: 0; width: 100%; text-align: center;
  font-family: 'Inter', sans-serif; font-size: 9px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 2px; color: rgba(255,255,255,0.4);
  z-index: 2; pointer-events: none;
`;
minimapLabel.textContent = 'MINIMAP';
minimapContainer.appendChild(minimapLabel);

const minimapCanvas = document.createElement('canvas');
minimapCanvas.width = minimapSize * 2;
minimapCanvas.height = minimapSize * 2;
minimapCanvas.style.cssText = `width: ${minimapSize}px; height: ${minimapSize}px;`;
minimapContainer.appendChild(minimapCanvas);
const mCtx = minimapCanvas.getContext('2d');

function worldToMinimap(wx, wz) {
  const cx = minimapCanvas.width / 2;
  const cy = minimapCanvas.height / 2;
  const scale = minimapCanvas.width / minimapScale;
  return {
    x: cx + wx * scale,
    y: cy + wz * scale
  };
}

function drawMinimap() {
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  mCtx.clearRect(0, 0, w, h);

  // Background ground area
  const topLeft = worldToMinimap(-40, -40);
  const botRight = worldToMinimap(40, 40);
  mCtx.fillStyle = 'rgba(76, 175, 80, 0.25)';
  mCtx.fillRect(topLeft.x, topLeft.y, botRight.x - topLeft.x, botRight.y - topLeft.y);

  // Border of ground
  mCtx.strokeStyle = 'rgba(76, 175, 80, 0.4)';
  mCtx.lineWidth = 1;
  mCtx.strokeRect(topLeft.x, topLeft.y, botRight.x - topLeft.x, botRight.y - topLeft.y);

  // Pond
  const pondPos = worldToMinimap(18, 18);
  const pondR = (6 / minimapScale) * w;
  mCtx.fillStyle = 'rgba(33, 150, 243, 0.35)';
  mCtx.beginPath();
  mCtx.arc(pondPos.x, pondPos.y, pondR, 0, Math.PI * 2);
  mCtx.fill();

  // Disco floor area
  const discoTL = worldToMinimap(-29, -9);
  const discoBR = worldToMinimap(-11, 9);
  mCtx.fillStyle = 'rgba(200, 100, 255, 0.2)';
  mCtx.fillRect(discoTL.x, discoTL.y, discoBR.x - discoTL.x, discoBR.y - discoTL.y);

  // Trees (small green dots)
  treePositions.forEach(pos => {
    const tp = worldToMinimap(pos[0], pos[1]);
    mCtx.fillStyle = 'rgba(46, 204, 113, 0.5)';
    mCtx.beginPath();
    mCtx.arc(tp.x, tp.y, 4, 0, Math.PI * 2);
    mCtx.fill();
  });

  // Coins (gold diamonds)
  coins.forEach(cg => {
    if (cg.userData.collected) return;
    const cp = worldToMinimap(cg.position.x, cg.position.z);
    mCtx.save();
    mCtx.translate(cp.x, cp.y);
    mCtx.rotate(Math.PI / 4);
    mCtx.fillStyle = '#ffd740';
    mCtx.shadowColor = '#ffd740';
    mCtx.shadowBlur = 6;
    mCtx.fillRect(-3, -3, 6, 6);
    mCtx.restore();
  });

  // NPCs (colored circles)
  characters.forEach(char => {
    const np = worldToMinimap(char.position.x, char.position.z);
    const isDancing = dancingChars.has(char.userData.seed);
    mCtx.fillStyle = isDancing ? '#e040fb' : '#4fc3f7';
    mCtx.shadowColor = isDancing ? '#e040fb' : '#4fc3f7';
    mCtx.shadowBlur = isDancing ? 8 : 4;
    mCtx.beginPath();
    mCtx.arc(np.x, np.y, isDancing ? 5 : 4, 0, Math.PI * 2);
    mCtx.fill();
    mCtx.shadowBlur = 0;
  });

  // Mushrooms (small magenta dots)
  mushrooms.forEach(m => {
    const mp = worldToMinimap(m.position.x, m.position.z);
    mCtx.fillStyle = 'rgba(255, 68, 102, 0.6)';
    mCtx.beginPath();
    mCtx.arc(mp.x, mp.y, 3, 0, Math.PI * 2);
    mCtx.fill();
  });

  // Player (white arrow showing facing direction)
  const pp = worldToMinimap(playerGroup.position.x, playerGroup.position.z);
  mCtx.save();
  mCtx.translate(pp.x, pp.y);

  // Player glow ring
  mCtx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
  mCtx.lineWidth = 2;
  mCtx.shadowColor = '#ffd700';
  mCtx.shadowBlur = 12;
  mCtx.beginPath();
  mCtx.arc(0, 0, 8, 0, Math.PI * 2);
  mCtx.stroke();
  mCtx.shadowBlur = 0;

  // Player arrow
  mCtx.rotate(-playerGroup.rotation.y);
  mCtx.fillStyle = '#ffffff';
  mCtx.shadowColor = '#ffffff';
  mCtx.shadowBlur = 8;
  mCtx.beginPath();
  mCtx.moveTo(0, -7);
  mCtx.lineTo(-5, 5);
  mCtx.lineTo(0, 2);
  mCtx.lineTo(5, 5);
  mCtx.closePath();
  mCtx.fill();
  mCtx.shadowBlur = 0;
  mCtx.restore();

  // Minimap legend dots in bottom
  const legendY = h - 14;
  const legendItems = [
    { x: 16, color: '#ffffff', label: 'YOU' },
    { x: 62, color: '#ffd740', label: 'COIN' },
    { x: 114, color: '#4fc3f7', label: 'NPC' },
  ];
  mCtx.font = '600 14px Inter, sans-serif';
  legendItems.forEach(item => {
    mCtx.fillStyle = item.color;
    mCtx.beginPath();
    mCtx.arc(item.x, legendY, 3, 0, Math.PI * 2);
    mCtx.fill();
    mCtx.fillStyle = 'rgba(255,255,255,0.4)';
    mCtx.fillText(item.label, item.x + 6, legendY + 4);
  });
}

// ===================== INTERACTION =====================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dancingChars = new Set();

renderer.domElement.addEventListener('click', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  
  for (const char of characters) {
    const intersects = raycaster.intersectObjects(char.children, true);
    if (intersects.length > 0) {
      if (dancingChars.has(char.userData.seed)) {
        dancingChars.delete(char.userData.seed);
      } else {
        dancingChars.add(char.userData.seed);
        // Spawn celebration particles
        spawnParticleBurst(char.position.clone().add(new THREE.Vector3(0, 5, 0)));
      }
      break;
    }
  }
});

// Celebration particles
const burstParticles = [];
function spawnParticleBurst(pos) {
  for (let i = 0; i < 20; i++) {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      rainbowMats[Math.floor(Math.random() * 6)]
    );
    p.position.copy(pos);
    p.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      Math.random() * 0.3 + 0.1,
      (Math.random() - 0.5) * 0.3
    );
    p.userData.life = 1.0;
    scene.add(p);
    burstParticles.push(p);
  }
}

// ===================== ANIMATION =====================
const clock = new THREE.Clock();

function animate() {
  const t = clock.getElapsedTime();
  const dt = clock.getDelta();
  controls.update();

  // ===================== PLAYER MOVEMENT =====================
  if (playerMode) {
    let moveX = 0, moveZ = 0;
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    camDir.normalize();
    const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

    if (keys.w) { moveX += camDir.x; moveZ += camDir.z; }
    if (keys.s) { moveX -= camDir.x; moveZ -= camDir.z; }
    if (keys.a) { moveX -= camRight.x; moveZ -= camRight.z; }
    if (keys.d) { moveX += camRight.x; moveZ += camRight.z; }

    const isMoving = moveX !== 0 || moveZ !== 0;
    if (isMoving) {
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= len; moveZ /= len;
      playerGroup.position.x += moveX * playerSpeed;
      playerGroup.position.z += moveZ * playerSpeed;
      // Face movement direction
      playerGroup.rotation.y = Math.atan2(moveX, moveZ);
    }

    // Clamp to world bounds
    playerGroup.position.x = Math.max(-38, Math.min(38, playerGroup.position.x));
    playerGroup.position.z = Math.max(-38, Math.min(38, playerGroup.position.z));

    // Jumping
    if (keys.space && isGrounded) {
      jumpVelocity = JUMP_FORCE;
      isGrounded = false;
    }
    jumpVelocity += GRAVITY;
    playerGroup.position.y += jumpVelocity;
    if (playerGroup.position.y <= PLAYER_GROUND_Y) {
      playerGroup.position.y = PLAYER_GROUND_Y;
      jumpVelocity = 0;
      isGrounded = true;
    }

    // Player walk animation
    playerGroup.children.forEach(c => {
      if (!c.name) return;
      if (isMoving) {
        if (c.name === 'playerArm_L') c.rotation.x = Math.sin(t * 8) * 0.6;
        if (c.name === 'playerArm_R') c.rotation.x = -Math.sin(t * 8) * 0.6;
        if (c.name === 'playerLeg_L') c.rotation.x = -Math.sin(t * 8) * 0.6;
        if (c.name === 'playerLeg_R') c.rotation.x = Math.sin(t * 8) * 0.6;
      } else {
        // Idle breathing
        if (c.name === 'playerArm_L') c.rotation.x = Math.sin(t * 1.5) * 0.08;
        if (c.name === 'playerArm_R') c.rotation.x = -Math.sin(t * 1.5) * 0.08;
        if (c.name === 'playerLeg_L') c.rotation.x = 0;
        if (c.name === 'playerLeg_R') c.rotation.x = 0;
      }
      // Cape flutter
      if (c.name === 'playerCape') {
        c.rotation.x = isMoving ? Math.sin(t * 6) * 0.15 + 0.2 : Math.sin(t * 1.5) * 0.05;
      }
    });

    // Player aura pulse
    const aura = playerGroup.getObjectByName('playerAura');
    if (aura) {
      aura.material.opacity = 0.15 + Math.sin(t * 3) * 0.1;
      aura.scale.setScalar(1 + Math.sin(t * 2) * 0.08);
    }

    // Third-person camera follow
    const cameraOffset = new THREE.Vector3(0, 10, 14);
    const targetCamPos = playerGroup.position.clone().add(cameraOffset);
    camera.position.lerp(targetCamPos, 0.05);
    const lookTarget = playerGroup.position.clone();
    lookTarget.y += 3;
    camera.lookAt(lookTarget);
  }

  // ===================== COIN COLLECTION =====================
  coins.forEach((cg, i) => {
    if (cg.userData.collected) return;
    // Bob animation
    cg.position.y = cg.userData.baseY + Math.sin(t * 3 + cg.userData.bobOffset) * 0.4;
    cg.rotation.y = t * 3 + i;
    // Check distance to player
    const dx = playerGroup.position.x - cg.position.x;
    const dy = (playerGroup.position.y + 2.5) - cg.position.y;
    const dz = playerGroup.position.z - cg.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 2.5) {
      cg.userData.collected = true;
      scene.remove(cg);
      score++;
      const robux = score * 100;
      document.getElementById('scoreDisplay').textContent = score;
      document.getElementById('robuxDisplay').textContent = robux.toLocaleString();
      spawnParticleBurst(cg.position.clone());

      // Level up every 5 coins
      if (score % 5 === 0) {
        playerLevel++;
        playerSpeed += 0.02;
        document.getElementById('levelDisplay').textContent = `Level ${playerLevel}`;
        showMessage(`⬆️ LEVEL ${playerLevel}!`, '#69f0ae');
      } else if (score === COIN_COUNT) {
        showMessage('🏆 ALL COINS COLLECTED! YOU WIN! 🏆', '#ffd700');
      } else {
        const msgs = ['Nice! 🪙', 'Cha-ching! 💰', 'ROBUX!! 💎', 'Awesome! ⭐', 'Yoink! 😎', 'Ka-ching! 🤑', 'EPIC! 🔥'];
        showMessage(msgs[Math.floor(Math.random() * msgs.length)]);
      }
    }
  });

  // Combo message fade
  if (comboTimer > 0) {
    comboTimer -= 0.016;
    if (comboTimer <= 0) comboDiv.style.opacity = '0';
  }

  // Animate characters
  characters.forEach((char) => {
    const d = char.userData;
    const isDancing = dancingChars.has(d.seed);

    if (isDancing) {
      // DANCE MODE - crazy fun animations!
      char.rotation.y = Math.sin(t * 8 + d.bounceOffset) * 0.5;
      char.position.y = Math.abs(Math.sin(t * 6 + d.bounceOffset)) * 2;
      
      // Arm flailing
      char.children.forEach(c => {
        if (c.name && c.name.startsWith('arm_L')) {
          c.rotation.z = Math.sin(t * 10 + d.bounceOffset) * 1.2 - 0.5;
          c.rotation.x = Math.cos(t * 8) * 0.5;
        }
        if (c.name && c.name.startsWith('arm_R')) {
          c.rotation.z = -Math.sin(t * 10 + d.bounceOffset + 1) * 1.2 + 0.5;
          c.rotation.x = Math.cos(t * 8 + 1) * 0.5;
        }
        if (c.name && c.name.startsWith('leg_L')) {
          c.rotation.x = Math.sin(t * 12 + d.bounceOffset) * 0.6;
        }
        if (c.name && c.name.startsWith('leg_R')) {
          c.rotation.x = -Math.sin(t * 12 + d.bounceOffset) * 0.6;
        }
      });
    } else {
      // WALK AROUND
      const wx = d.baseX + Math.cos(t * d.speed * 0.3 + d.walkOffset) * d.walkRadius;
      const wz = d.baseZ + Math.sin(t * d.speed * 0.3 + d.walkOffset) * d.walkRadius;
      char.position.x = wx;
      char.position.z = wz;
      char.position.y = Math.abs(Math.sin(t * 4 + d.bounceOffset)) * 0.3;

      // Face walking direction
      const nextX = d.baseX + Math.cos(t * d.speed * 0.3 + d.walkOffset + 0.01) * d.walkRadius;
      const nextZ = d.baseZ + Math.sin(t * d.speed * 0.3 + d.walkOffset + 0.01) * d.walkRadius;
      char.rotation.y = Math.atan2(nextX - wx, nextZ - wz);

      // Walk animation
      char.children.forEach(c => {
        if (c.name && c.name.startsWith('arm_L')) c.rotation.x = Math.sin(t * 5 + d.bounceOffset) * 0.4;
        if (c.name && c.name.startsWith('arm_R')) c.rotation.x = -Math.sin(t * 5 + d.bounceOffset) * 0.4;
        if (c.name && c.name.startsWith('leg_L')) c.rotation.x = -Math.sin(t * 5 + d.bounceOffset) * 0.4;
        if (c.name && c.name.startsWith('leg_R')) c.rotation.x = Math.sin(t * 5 + d.bounceOffset) * 0.4;
      });
    }

    // Animate special accessories
    char.children.forEach(c => {
      if (c.name && c.name.startsWith('propeller_')) c.rotation.y = t * 15;
      if (c.name && c.name.startsWith('halo_')) c.rotation.z = t * 2;
      if (c.name && c.name.startsWith('balloon_')) c.position.y = 7.2 + Math.sin(t * 2 + d.bounceOffset) * 0.3;
      if (c.name && c.name.startsWith('antennaBall_')) {
        c.material.emissiveIntensity = 0.5 + Math.sin(t * 5 + d.bounceOffset) * 0.5;
      }
      if (c.name && c.name.startsWith('flame_')) {
        c.scale.y = 0.8 + Math.random() * 0.5;
        c.material.emissiveIntensity = 0.5 + Math.random() * 0.5;
      }
    });
  });

  // Floating platforms
  platforms.forEach((p, i) => {
    p.position.y = 4 + i * 1.5 + Math.sin(t * 1.5 + i * 1.2) * 1.5;
    p.rotation.y = t * 0.3 + i;
  });

  // Spinning coin
  coinGroup.rotation.y = t * 2;
  coinGroup.position.y = 10 + Math.sin(t) * 1.5;

  // Disco floor
  discoTiles.forEach((tile, i) => {
    const hue = ((t * 100 + i * 30) % 360) / 360;
    const col = new THREE.Color().setHSL(hue, 1, 0.5);
    tile.material.color.copy(col);
    tile.material.emissive.copy(col);
    tile.material.emissiveIntensity = 0.3 + Math.sin(t * 4 + i * 0.5) * 0.3;
  });

  // Disco light
  pointLight1.color.setHSL((t * 0.1) % 1, 1, 0.5);
  pointLight1.position.x = Math.sin(t) * 5 - 20;
  pointLight1.position.z = Math.cos(t) * 5;

  // Mushroom bounce
  mushrooms.forEach((m, i) => {
    m.scale.y = 1 + Math.sin(t * 3 + i * 1.5) * 0.15;
    m.scale.x = 1 - Math.sin(t * 3 + i * 1.5) * 0.05;
    m.scale.z = 1 - Math.sin(t * 3 + i * 1.5) * 0.05;
  });

  // Sparkle animation
  const positions = sparkles.geometry.attributes.position.array;
  for (let i = 0; i < sparkleCount; i++) {
    positions[i * 3 + 1] += Math.sin(t * 2 + i) * 0.01;
    if (positions[i * 3 + 1] > 20) positions[i * 3 + 1] = 0;
  }
  sparkles.geometry.attributes.position.needsUpdate = true;
  sparkleMat.opacity = 0.5 + Math.sin(t * 3) * 0.3;

  // Burst particles
  for (let i = burstParticles.length - 1; i >= 0; i--) {
    const p = burstParticles[i];
    p.position.add(p.userData.vel);
    p.userData.vel.y -= 0.01;
    p.userData.life -= 0.02;
    p.rotation.x += 0.1;
    p.rotation.y += 0.1;
    p.scale.setScalar(p.userData.life);
    if (p.userData.life <= 0) {
      scene.remove(p);
      burstParticles.splice(i, 1);
    }
  }

  // Gentle camera bob (only in free camera mode)
  if (!playerMode) {
    camera.position.y += Math.sin(t * 0.5) * 0.002;
  }

  // Pond shimmer
  pond.material.opacity = 0.6 + Math.sin(t * 2) * 0.1;

  // Flag wave
  flag.rotation.y = Math.sin(t * 3) * 0.2;
  flag.scale.x = 1 + Math.sin(t * 4) * 0.1;

  // Update minimap
  drawMinimap();

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});