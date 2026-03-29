import * as THREE from 'three/webgpu';
import { float, vec2, vec3, vec4, positionWorld, positionLocal, smoothstep, mix, time, sin, cos, uniform, color as tslColor, Fn, clamp, uv, normalWorld, dot, normalize, max as tslMax, pow, step, abs as tslAbs, fract, floor as tslFloor, output } from 'three/tsl';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Expose THREE globally for other modules (sceneBuilder, editor, player)
window.THREE = THREE;

import { LevelData } from './levels.js';
import { EditorController } from './editor.js';
import { PlayerController } from './player.js';
import { SceneBuilder, PALETTE } from './sceneBuilder.js';
import { Pathfinder } from './pathfinder.js';

// ─── Globals ───
const canvas = document.getElementById('gameCanvas');
let renderer, scene, camera, clock, orbitControls;
let currentLevel = 1;
let editMode = false;
let debugOpen = false;

// Perf tracking
let frameCount = 0;
let fpsAccum = 0;
let lastFpsUpdate = 0;
let gpuFrameMs = 0;
let gpuAccum = 0;
let gpuFrames = 0;

// Fog config (reactive uniforms)
const fogConfig = {
  yTop: 1.0,       // height where fog is 0% (fully clear)
  yBottom: -1.5,   // height where fog is 100% (fully opaque)
  density: 1.0,  // overall density multiplier
  color: new THREE.Color(0x2b9173),
  // TSL uniforms
  uFogColor: uniform(new THREE.Color(0x2b9173)),
  uFogTop: uniform(1.0),
  uFogBottom: uniform(-1.5),
  uFogDensity: uniform(1.0),
};

// Cell size (default 0.70, range 0.3–1.0)
let cellSize = 0.80; // default matches debug panel
window.CELL_SIZE = cellSize;

const state = {
  levelData: {},
  meshes: [],
  player: null,
  gridHelper: null,
  groundPlane: null,
  movables: [],       // { mesh, data, railMesh } for draggable blocks
  dragging: null,      // currently dragged movable
  dragPlane: null,     // invisible plane for drag projection
  meshCache: new Map(), // key: "x,z" → group mesh, for fast add/remove
  targetDiamond: null, // level goal diamond mesh
  transitioning: false, // true during level fade-out
  teleportPads: [],    // { mesh, data, partner } for teleportation
  starField: null,     // THREE.Points for space background
  currentTheme: null,  // 'space', 'ocean', or null (default)
  waterOcean: null,    // water plane mesh replacing ground
  godRayLight: null,   // god ray volumetric light group
  godRayMeshes: [],    // god ray cone meshes for animation
  windClouds: null,    // wind & clouds group for default theme
  oceanEnv: null,      // ocean environment group (level 3)
  cloudColor: 0xf5d8b0, // current cloud color
  movableColor: 0x575757, // current movable block color
};

// Material cache to avoid re-creating fog materials
const fogMatCache = new Map();

// ─── Init ───
async function init() {
  // Renderer — WebGPU
  renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(fogConfig.color, 1);
  await renderer.init();

  // Handle tab visibility — skip rendering when hidden to avoid stale swap-chain textures
  let _tabVisible = true;
  document.addEventListener('visibilitychange', () => {
    _tabVisible = !document.hidden;
  });
  window._isTabVisible = () => _tabVisible;

  scene = new THREE.Scene();
  clock = new THREE.Clock();

  scene.background = fogConfig.color.clone();
  scene.fog = null; // We use custom TSL vertical fog

  // Camera — isometric
  const aspect = window.innerWidth / window.innerHeight;
  const d = 10;
  camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 200);
  camera.position.set(20, 20, 20);
  camera.lookAt(0, 0, 0);
  camera.zoom = 1.3;
  camera.updateProjectionMatrix();

  // Orbit controls — edit mode only, right-click to orbit
  orbitControls = new OrbitControls(camera, canvas);
  orbitControls.enabled = false;
  orbitControls.enableRotate = true;
  orbitControls.enablePan = true;
  orbitControls.enableZoom = true;
  orbitControls.mouseButtons = {
    LEFT: null,                           // left click reserved for editor actions
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE
  };
  orbitControls.target.set(0, 2, 0);
  orbitControls.update();

  // Lights
  setupLights();

  // Nothing here — fog is applied per-material via TSL

  // Load level
  loadLevel(currentLevel);

  // Events
  window.addEventListener('resize', onResize);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);

  // Editor grid cursor + drag
  setupEditorCursor();

  setupUI();
  setupDebugUI();
  setupCellSizeUI();
  renderer.setAnimationLoop(animate);
}

// ─── TSL Vertical Fog — applied per-material ───
// Patches any MeshStandardMaterial / MeshStandardNodeMaterial so fragments
// blend toward fogColor based on their world-space Y position.

function applyVerticalFog(material) {
  if (material._verticalFogApplied) return material;

  // Build a cache key from material properties
  const c = material.color ? material.color.getHexString() : 'cccccc';
  const r = material.roughness !== undefined ? material.roughness : 0.8;
  const m = material.metalness !== undefined ? material.metalness : 0.05;
  const o = material.opacity !== undefined ? material.opacity : 1.0;
  const tr = material.transparent ? 1 : 0;
  const em = material.emissive ? material.emissive.getHexString() : '000000';
  const ei = material.emissiveIntensity || 0;
  const cacheKey = `${c}_${r}_${m}_${o}_${tr}_${em}_${ei}`;

  if (fogMatCache.has(cacheKey)) {
    const cached = fogMatCache.get(cacheKey);
    // Ensure cached material is registered for palette updates
    if (material._paletteKey && !cached._paletteKey) {
      cached._paletteKey = material._paletteKey;
    }
    _registerPaletteMat(cached);
    return cached;
  }

  // Convert MeshStandardMaterial → MeshStandardNodeMaterial
  const nodeMat = new THREE.MeshStandardNodeMaterial();
  nodeMat.color = material.color ? material.color.clone() : new THREE.Color(0xcccccc);
  nodeMat.roughness = r;
  nodeMat.metalness = m;
  nodeMat.transparent = material.transparent || false;
  nodeMat.opacity = o;
  nodeMat.side = material.side !== undefined ? material.side : THREE.FrontSide;
  if (material.emissive) nodeMat.emissive = material.emissive.clone();
  if (material.emissiveIntensity) nodeMat.emissiveIntensity = material.emissiveIntensity;

  const worldY = positionWorld.y;
  const fogFactor = clamp(
    smoothstep(fogConfig.uFogBottom, fogConfig.uFogTop, worldY),
    float(0.0),
    float(1.0)
  );
  const fogAmount = float(1.0).sub(fogFactor).mul(fogConfig.uFogDensity);
  // Use a uniform() wrapper so mutating nodeMat.color updates the shader
  // without recompilation. Store the uniform on the material for reference.
  const baseColorUniform = uniform(nodeMat.color);
  nodeMat._baseColorUniform = baseColorUniform;
  // Apply gradient AFTER lighting via outputNode so it renders as a flat
  // color overlay unaffected by lighting, shadows, or shading.
  nodeMat.outputNode = mix(output, vec4(fogConfig.uFogColor, 1.0), fogAmount);

  nodeMat._verticalFogApplied = true;
  // Propagate palette key so live color updates can find this material
  if (material._paletteKey) nodeMat._paletteKey = material._paletteKey;
  _registerPaletteMat(nodeMat);
  fogMatCache.set(cacheKey, nodeMat);
  return nodeMat;
}

// Walk the scene and patch all materials after building
function applyFogToScene() {
  scene.traverse(obj => {
    if (!obj.isMesh) return;
    if (obj.name === 'groundPlane') return; // skip the deep ground

    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map(m => applyVerticalFog(m));
    } else {
      obj.material = applyVerticalFog(obj.material);
    }
  });
}

// Lightweight palette color update — updates material uniform colors in-place.
// NO shader recompilation, NO scene rebuild. TSL uniform references pick up
// the new color automatically on the next render frame.

// Track fog-wrapped materials by palette key so we don't need to traverse
// the full scene on every color change.
const _paletteMats = new Map(); // paletteKey → Set<MeshStandardNodeMaterial>

function _registerPaletteMat(mat) {
  if (!mat._paletteKey) return;
  let set = _paletteMats.get(mat._paletteKey);
  if (!set) { set = new Set(); _paletteMats.set(mat._paletteKey, set); }
  set.add(mat);
}

// Debounce timer for deferred fogMatCache rebuild
let _fogCacheRebuildTimer = null;

function updatePaletteColors(changedKeys) {
  for (let i = 0; i < changedKeys.length; i++) {
    const key = changedKeys[i];
    const newHex = PALETTE[key];
    if (newHex === undefined) continue;
    const matSet = _paletteMats.get(key);
    if (!matSet) continue;
    matSet.forEach(mat => {
      // Update the THREE.Color on the material and on the TSL uniform.
      // The uniform() wrapper holds a reference to the Color object, so
      // mutating it in-place updates the GPU uniform without recompilation.
      if (mat.color) mat.color.set(newHex);
      if (mat._baseColorUniform && mat._baseColorUniform.value) {
        mat._baseColorUniform.value.set(newHex);
      }
      // Do NOT set mat.needsUpdate or rebuild colorNode — that triggers
      // expensive shader recompilation in WebGPU.
    });
  }

  // Debounced fogMatCache rebuild — only runs 300ms after the last change
  if (_fogCacheRebuildTimer) clearTimeout(_fogCacheRebuildTimer);
  _fogCacheRebuildTimer = setTimeout(_rebuildFogCache, 300);
}

function _rebuildFogCache() {
  fogMatCache.clear();
  _paletteMats.forEach(matSet => {
    matSet.forEach(mat => {
      if (!mat._verticalFogApplied) return;
      const c = mat.color ? mat.color.getHexString() : 'cccccc';
      const r = mat.roughness !== undefined ? mat.roughness : 0.8;
      const m = mat.metalness !== undefined ? mat.metalness : 0.05;
      const o = mat.opacity !== undefined ? mat.opacity : 1.0;
      const tr = mat.transparent ? 1 : 0;
      const em = mat.emissive ? mat.emissive.getHexString() : '000000';
      const ei = mat.emissiveIntensity || 0;
      const cacheKey = `${c}_${r}_${m}_${o}_${tr}_${em}_${ei}`;
      fogMatCache.set(cacheKey, mat);
    });
  });
}

function setupLights() {
  const ambient = new THREE.AmbientLight(0xffe8d6, 0.6);
  ambient.name = 'ambientLight';
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xffeedd, 0xd4884a, 0.5);
  hemi.name = 'hemiLight';
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
  sun.name = 'sunLight';
  sun.position.set(8, 16, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.002;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xb8d4e3, 0.3);
  fill.name = 'fillLight';
  fill.position.set(-6, 8, -4);
  scene.add(fill);
}

// Recursively dispose geometry and materials from an object
function disposeObject(obj) {
  if (!obj) return;
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(m => {
      if (m.map) m.map.dispose();
      if (m.normalMap) m.normalMap.dispose();
      if (m.emissiveMap) m.emissiveMap.dispose();
      m.dispose();
    });
  }
  if (obj.children) obj.children.forEach(c => disposeObject(c));
}

function removeAndDispose(obj) {
  if (!obj) return;
  scene.remove(obj);
  disposeObject(obj);
}

function loadLevel(num) {
  // Clear — dispose GPU resources to prevent stale WebGPU textures
  state.meshes.forEach(m => removeAndDispose(m));
  state.meshes = [];
  if (state.player) { removeAndDispose(state.player.mesh); state.player = null; }
  if (state.gridHelper) { removeAndDispose(state.gridHelper); state.gridHelper = null; }
  if (state.groundPlane) { removeAndDispose(state.groundPlane); state.groundPlane = null; }
  if (state.targetDiamond) { removeAndDispose(state.targetDiamond); state.targetDiamond = null; }
  // Clear teleport pads
  state.teleportPads.forEach(tp => removeAndDispose(tp.mesh));
  state.teleportPads = [];
  // Clear star field
  if (state.starField) { removeAndDispose(state.starField); state.starField = null; }
  // Clear water ocean
  if (state.waterOcean) { removeAndDispose(state.waterOcean); state.waterOcean = null; }
  // Clear god ray
  if (state.godRayLight) { removeAndDispose(state.godRayLight); state.godRayLight = null; }
  state.godRayMeshes = [];
  // Clear wind & clouds
  if (state.windClouds) { removeAndDispose(state.windClouds); state.windClouds = null; }
  // Clear ocean environment
  if (state.oceanEnv) { removeAndDispose(state.oceanEnv); state.oceanEnv = null; }

  currentLevel = num;
  state.levelData = JSON.parse(JSON.stringify(LevelData[num]));

  // Apply theme
  const theme = state.levelData.theme || null;
  state.currentTheme = theme;
  applyTheme(theme);

  rebuildScene();

  document.getElementById('level-indicator').textContent = `Level ${num}`;
  document.querySelectorAll('.level-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.level) === num);
  });
}

// Store original palette for restoration
const _defaultPalette = { ...PALETTE };

// Per-theme fog/bg/palette presets — fully independent, no shared state
const themePresets = {
  default: {
    bg: 0x2b9173,
    fogColor: 0x2b9173,
    fogBottom: -1.5,
    fogTop: 1.0,
    fogDensity: 1.0,
    palette: null, // uses _defaultPalette
    cloudColor: 0xffffff,
    movableColor: 0x575757,
  },
  space: {
    bg: 0x0a0a1a,
    fogColor: 0x1a1030,
    fogBottom: -5,
    fogTop: 6,
    fogDensity: 0.6,
    palette: {
      blockTop: 0xb0a8c0, blockSide: 0x7a8ab8, blockDark: 0x5a6a98,
      stair: 0x9090b8, pillar: 0x8080b0, arch: 0xa888b0, dome: 0x7060a0,
      accent: 0x5098b8, accentDark: 0x4088a0, cream: 0xc0b8d0,
    },
    cloudColor: 0x8888cc,
    movableColor: 0x9088b8,
  },
  ocean: {
    bg: 0x1f62ff,
    fogColor: 0x47aff0,
    fogBottom: -3,
    fogTop: 5,
    fogDensity: 0.8,
    palette: {
      blockTop: 0xe8d8b8, blockSide: 0xc4a882, blockDark: 0xa08868,
      stair: 0xd0b890, pillar: 0xc8b088, arch: 0xd8c098, dome: 0xb09878,
      accent: 0x6ab0b8, accentDark: 0x4a9098, cream: 0xf0e0c0,
    },
    cloudColor: 0xd0e8f0,
    movableColor: 0xc8b090,
  },
};

function applyTheme(theme) {
  const preset = themePresets[theme] || themePresets['default'];

  // Background
  const bg = new THREE.Color(preset.bg);
  scene.background = bg;
  renderer.setClearColor(bg, 1);
  document.body.style.background = '#' + bg.getHexString();

  // Fog — each theme gets its own independent values
  const fc = new THREE.Color(preset.fogColor);
  fogConfig.color.copy(fc);
  fogConfig.uFogColor.value.copy(fc);
  fogConfig.uFogBottom.value = preset.fogBottom;
  fogConfig.uFogTop.value = preset.fogTop;
  fogConfig.uFogDensity.value = preset.fogDensity;

  // Palette
  if (preset.palette) {
    Object.assign(PALETTE, _defaultPalette, preset.palette);
  } else {
    Object.assign(PALETTE, _defaultPalette);
  }

  // Sync all brick color debug pickers with current palette
  const _syncPicker = (id, paletteKey) => {
    const el = document.getElementById(id);
    const valEl = document.getElementById(id + '-val');
    if (el && valEl) {
      const hex = '#' + PALETTE[paletteKey].toString(16).padStart(6, '0');
      el.value = hex;
      valEl.textContent = hex;
    }
  };
  _syncPicker('brick-top-color', 'blockTop');
  _syncPicker('brick-side-color', 'blockSide');
  _syncPicker('brick-accent-color', 'cream');
  _syncPicker('brick-window-color', 'window');
  _syncPicker('brick-dome-color', 'dome');

  // Sync cloud color
  state.cloudColor = preset.cloudColor || 0xf5d8b0;
  const _cloudHex = '#' + state.cloudColor.toString(16).padStart(6, '0');
  const _cloudEl = document.getElementById('cloud-color');
  const _cloudVal = document.getElementById('cloud-color-val');
  if (_cloudEl) _cloudEl.value = _cloudHex;
  if (_cloudVal) _cloudVal.textContent = _cloudHex;

  // Sync movable color
  state.movableColor = preset.movableColor || 0x575757;
  const _movHex = '#' + state.movableColor.toString(16).padStart(6, '0');
  const _movEl = document.getElementById('movable-color');
  const _movVal = document.getElementById('movable-color-val');
  if (_movEl) _movEl.value = _movHex;
  if (_movVal) _movVal.textContent = _movHex;

  // Theme-specific extras
  if (theme === 'space') {
    createStarField();
  }
}

function createStarField() {
  const count = 2000;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // Distribute stars in a large sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 40 + Math.random() * 60;
    positions[i * 3]     = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
    positions[i * 3 + 2] = Math.cos(phi) * r;

    sizes[i] = 0.05 + Math.random() * 0.15;

    // Warm white to cool blue star colors
    const temp = Math.random();
    if (temp < 0.3) {
      colors[i * 3] = 0.8 + Math.random() * 0.2;
      colors[i * 3 + 1] = 0.7 + Math.random() * 0.2;
      colors[i * 3 + 2] = 0.5 + Math.random() * 0.2;
    } else if (temp < 0.6) {
      colors[i * 3] = 0.6 + Math.random() * 0.3;
      colors[i * 3 + 1] = 0.6 + Math.random() * 0.3;
      colors[i * 3 + 2] = 0.9 + Math.random() * 0.1;
    } else {
      colors[i * 3] = 0.9 + Math.random() * 0.1;
      colors[i * 3 + 1] = 0.9 + Math.random() * 0.1;
      colors[i * 3 + 2] = 0.9 + Math.random() * 0.1;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const stars = new THREE.Points(geo, mat);
  stars.name = 'starField';
  scene.add(stars);
  state.starField = stars;
}

// ─── Water Ocean (TSL displacement) ───
function createWaterOcean() {
  const size = 120;
  const segments = 80;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);

  const mat = new THREE.MeshStandardNodeMaterial();
  mat.transparent = true;
  mat.side = THREE.DoubleSide;
  mat.depthWrite = true;

  // TSL water displacement — very basic gentle waves
  const worldPos = positionLocal;
  const t = time.mul(0.4);

  // Simple sum-of-sines displacement on Y
  const wave1 = sin(worldPos.x.mul(0.8).add(t)).mul(0.12);
  const wave2 = sin(worldPos.z.mul(0.6).add(t.mul(1.3))).mul(0.08);
  const wave3 = cos(worldPos.x.mul(0.3).add(worldPos.z.mul(0.5)).add(t.mul(0.7))).mul(0.06);
  const displacement = wave1.add(wave2).add(wave3);

  // Displace position
  const displaced = vec3(
    positionLocal.x,
    positionLocal.y.add(displacement),
    positionLocal.z
  );
  mat.positionNode = displaced;

  // Water color — theme-aware
  let deepHex = 0x2a6868, shallowHex = 0x4a9a8a;
  if (state.currentTheme === 'ocean') {
    deepHex = 0x2a8a8a;
    shallowHex = 0x5ec4b0;
  }
  const deepColor = tslColor(new THREE.Color(deepHex));
  const shallowColor = tslColor(new THREE.Color(shallowHex));
  const shimmer = sin(worldPos.x.mul(2.0).add(t.mul(1.5))).mul(0.5).add(0.5);
  const waterCol = mix(deepColor, shallowColor, shimmer.mul(0.3).add(0.2));
  mat.colorNode = waterCol;

  // Opacity — slightly variable
  mat.opacityNode = float(0.85).add(sin(worldPos.z.mul(1.2).add(t)).mul(0.08));

  mat.roughness = 0.15;
  mat.metalness = 0.3;

  const water = new THREE.Mesh(geo, mat);
  water.name = 'waterOceanPlane';
  water.rotation.x = -Math.PI / 2;
  water.position.y = -1.4;
  water.receiveShadow = true;
  scene.add(water);
  state.waterOcean = water;
}

// ─── Wind & Clouds (default theme atmospheric details) ───
function createWindAndClouds() {
  if (state.windClouds) { removeAndDispose(state.windClouds); state.windClouds = null; }

  const group = new THREE.Group();
  group.name = 'windCloudsGroup';

  // --- Stylized low-poly clouds ---
  const cloudMat = new THREE.MeshLambertMaterial({
    color: state.cloudColor || 0xf5d8b0,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  cloudMat.name = 'cloudMaterial';

  const cloudCount = 10;
  for (let i = 0; i < cloudCount; i++) {
    const cloud = new THREE.Group();
    cloud.name = 'cloud_' + i;

    // Each cloud = 3-5 merged spheres for a puffy look
    const puffCount = 3 + Math.floor(Math.random() * 3);
    for (let p = 0; p < puffCount; p++) {
      const radius = 0.3 + Math.random() * 0.5;
      const geo = new THREE.IcosahedronGeometry(radius, 1);
      const puff = new THREE.Mesh(geo, cloudMat);
      puff.name = 'cloudPuff_' + i + '_' + p;
      puff.position.set(
        (p - puffCount / 2) * 0.5 + Math.random() * 0.2,
        Math.random() * 0.2,
        Math.random() * 0.3 - 0.15
      );
      puff.scale.y = 0.5 + Math.random() * 0.3;
      cloud.add(puff);
    }

    // Place clouds within the camera's visible zone
    // Ortho camera at (20,20,20), visible range ~±8 units from lookAt target
    // Spread clouds around the city at moderate distances
    const angle = (i / cloudCount) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 4 + Math.random() * 7;
    cloud.position.set(
      Math.cos(angle) * dist,
      4 + Math.random() * 5,
      Math.sin(angle) * dist
    );
    cloud.scale.setScalar(0.5 + Math.random() * 0.5);

    // Store drift data
    cloud.userData.driftSpeed = 0.1 + Math.random() * 0.15;
    cloud.userData.driftAngle = angle;
    cloud.userData.driftDist = dist;
    cloud.userData.baseY = cloud.position.y;
    cloud.userData.bobPhase = Math.random() * Math.PI * 2;

    group.add(cloud);
  }

  // --- Wind streaks (thin transparent ribbons) ---
  const streakMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const streakCount = 14;
  for (let i = 0; i < streakCount; i++) {
    const len = 1 + Math.random() * 3;
    const geo = new THREE.PlaneGeometry(len, 0.015 + Math.random() * 0.02);
    const streak = new THREE.Mesh(geo, streakMat);
    streak.name = 'windStreak_' + i;

    const angle = Math.random() * Math.PI * 2;
    const dist = 3 + Math.random() * 8;
    streak.position.set(
      Math.cos(angle) * dist,
      1 + Math.random() * 7,
      Math.sin(angle) * dist
    );
    // Align roughly with wind direction (diagonal)
    streak.rotation.y = -0.4 + Math.random() * 0.3;
    streak.rotation.z = (Math.random() - 0.5) * 0.15;

    streak.userData.speed = 1.0 + Math.random() * 1.5;
    streak.userData.startX = streak.position.x;
    streak.userData.startZ = streak.position.z;
    streak.userData.driftRange = 12;

    group.add(streak);
  }

  // --- Floating dust/leaf particles ---
  const particleCount = 60;
  const pPositions = new Float32Array(particleCount * 3);
  const pSizes = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    pPositions[i * 3]     = (Math.random() - 0.5) * 18;
    pPositions[i * 3 + 1] = 0.5 + Math.random() * 8;
    pPositions[i * 3 + 2] = (Math.random() - 0.5) * 18;
    pSizes[i] = 0.03 + Math.random() * 0.06;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xffd8b0,
    size: 0.06,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const dustParticles = new THREE.Points(pGeo, pMat);
  dustParticles.name = 'windDustParticles';
  group.add(dustParticles);



  scene.add(group);
  state.windClouds = group;
}

// ─── Animate Wind & Clouds ───
function animateWindAndClouds(t) {
  if (!state.windClouds) return;
  const group = state.windClouds;

  group.children.forEach(child => {
    // Clouds — slow circular drift + gentle bob
    if (child.name.startsWith('cloud_')) {
      const speed = child.userData.driftSpeed;
      const baseAngle = child.userData.driftAngle;
      const dist = child.userData.driftDist;
      const newAngle = baseAngle + t * speed * 0.02;
      child.position.x = Math.cos(newAngle) * dist;
      child.position.z = Math.sin(newAngle) * dist;
      child.position.y = child.userData.baseY + Math.sin(t * 0.3 + child.userData.bobPhase) * 0.3;
    }

    // Wind streaks — sweep across the scene
    if (child.name.startsWith('windStreak_')) {
      const spd = child.userData.speed;
      const range = child.userData.driftRange;
      const offset = (t * spd) % (range * 2) - range;
      child.position.x = child.userData.startX + offset * 0.7;
      child.position.z = child.userData.startZ + offset * 0.3;
      // Fade in/out at edges
      const edgeFade = 1.0 - Math.abs(offset) / range;
      child.material.opacity = 0.12 * Math.max(0, edgeFade);
    }

    // Dust particles — gentle upward spiral
    if (child.name === 'windDustParticles') {
      const pos = child.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);

        // Drift with wind
        x += 0.008;
        z += 0.003;
        y += 0.003 + Math.sin(t + i) * 0.001;

        // Wrap around within view zone
        if (x > 9) x = -9;
        if (z > 9) z = -9;
        if (y > 8) y = 0.5;

        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }
  });
}

// ─── Ocean Environment (ocean theme foreground) ───
function createOceanEnvironment() {
  if (state.oceanEnv) { removeAndDispose(state.oceanEnv); state.oceanEnv = null; }

  const group = new THREE.Group();
  group.name = 'oceanEnvGroup';

  // --- Jellyfish-like floating organisms ---
  const jellyMat = new THREE.MeshLambertMaterial({
    color: 0x88ddff,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    side: THREE.DoubleSide,
    emissive: 0x44aacc,
    emissiveIntensity: 0.3,
  });

  for (let i = 0; i < 6; i++) {
    const jelly = new THREE.Group();
    jelly.name = 'jellyfish_' + i;

    // Dome body
    const domeGeo = new THREE.SphereGeometry(0.2 + Math.random() * 0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const dome = new THREE.Mesh(domeGeo, jellyMat);
    dome.name = 'jellyDome_' + i;
    jelly.add(dome);

    // Trailing tentacles
    const tentMat = new THREE.MeshBasicMaterial({
      color: 0x66ccee,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    for (let t = 0; t < 4; t++) {
      const tentGeo = new THREE.CylinderGeometry(0.008, 0.003, 0.4 + Math.random() * 0.3, 4);
      const tent = new THREE.Mesh(tentGeo, tentMat);
      tent.name = 'jellyTent_' + i + '_' + t;
      tent.position.set((Math.random() - 0.5) * 0.12, -0.2 - Math.random() * 0.1, (Math.random() - 0.5) * 0.12);
      tent.rotation.x = (Math.random() - 0.5) * 0.3;
      tent.rotation.z = (Math.random() - 0.5) * 0.3;
      jelly.add(tent);
    }

    const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 5 + Math.random() * 6;
    jelly.position.set(
      Math.cos(angle) * dist,
      2 + Math.random() * 5,
      Math.sin(angle) * dist
    );
    jelly.scale.setScalar(0.6 + Math.random() * 0.6);

    jelly.userData.floatSpeed = 0.15 + Math.random() * 0.2;
    jelly.userData.floatAngle = angle;
    jelly.userData.floatDist = dist;
    jelly.userData.baseY = jelly.position.y;
    jelly.userData.bobPhase = Math.random() * Math.PI * 2;
    jelly.userData.pulsePhase = Math.random() * Math.PI * 2;

    group.add(jelly);
  }

  // --- Bubble particles rising upward ---
  const bubbleCount = 80;
  const bPositions = new Float32Array(bubbleCount * 3);
  for (let i = 0; i < bubbleCount; i++) {
    bPositions[i * 3]     = (Math.random() - 0.5) * 20;
    bPositions[i * 3 + 1] = -1 + Math.random() * 10;
    bPositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
  }
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPositions, 3));
  const bMat = new THREE.PointsMaterial({
    color: 0xaaeeff,
    size: 0.08,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const bubbles = new THREE.Points(bGeo, bMat);
  bubbles.name = 'oceanBubbles';
  group.add(bubbles);

  scene.add(group);
  state.oceanEnv = group;
}

// ─── Animate Ocean Environment ───
function animateOceanEnvironment(t) {
  if (!state.oceanEnv) return;
  const group = state.oceanEnv;

  group.children.forEach(child => {
    // Jellyfish — gentle drift + bob + pulse
    if (child.name.startsWith('jellyfish_')) {
      const speed = child.userData.floatSpeed;
      const baseAngle = child.userData.floatAngle;
      const dist = child.userData.floatDist;
      const newAngle = baseAngle + t * speed * 0.015;
      child.position.x = Math.cos(newAngle) * dist;
      child.position.z = Math.sin(newAngle) * dist;
      child.position.y = child.userData.baseY + Math.sin(t * 0.4 + child.userData.bobPhase) * 0.5;

      // Pulse scale (breathing)
      const pulse = 1.0 + Math.sin(t * 1.5 + child.userData.pulsePhase) * 0.1;
      child.scale.y = child.scale.x * (0.8 + pulse * 0.2);

      // Sway tentacles
      child.children.forEach(c => {
        if (c.name.startsWith('jellyTent_')) {
          c.rotation.x = Math.sin(t * 2 + parseFloat(c.name.split('_')[2])) * 0.3;
          c.rotation.z = Math.cos(t * 1.5 + parseFloat(c.name.split('_')[2])) * 0.2;
        }
      });
    }

    // Bubbles — rise upward
    if (child.name === 'oceanBubbles') {
      const pos = child.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);

        y += 0.01 + Math.sin(t + i * 0.5) * 0.003;
        x += Math.sin(t * 0.7 + i) * 0.002;

        if (y > 10) {
          y = -1;
          x = (Math.random() - 0.5) * 20;
          z = (Math.random() - 0.5) * 20;
        }

        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }


  });
}

function rebuildScene() {
  state.meshes.forEach(m => removeAndDispose(m));
  state.meshes = [];
  state.meshCache.clear();
  if (state.player) removeAndDispose(state.player.mesh);

  // Clear fog material cache so stale node materials don't reference disposed textures
  fogMatCache.clear();
  _paletteMats.clear();

  // Build scene from level data
  const meshes = SceneBuilder.build(state.levelData, cellSize);
  meshes.forEach(m => {
    scene.add(m);
    state.meshes.push(m);
    // Cache by grid position (x,y,z) so blocks at different Y levels coexist
    const bd = m.userData.blockData;
    if (bd) state.meshCache.set(`${bd.x},${bd.y},${bd.z}`, m);
  });

  // Ground plane / water ocean — hidden for space theme
  if (state.currentTheme !== 'space') {
    // Remove old ground if exists
    if (state.groundPlane) { removeAndDispose(state.groundPlane); state.groundPlane = null; }
    if (state.waterOcean) { removeAndDispose(state.waterOcean); state.waterOcean = null; }

    // Create water ocean plane with TSL displacement
    createWaterOcean();

    // Wind & clouds only for default theme (not space, not ocean)
    if (state.currentTheme !== 'ocean') {
      createWindAndClouds();
    }

    // Ocean environment for ocean theme
    if (state.currentTheme === 'ocean') {
      createOceanEnvironment();
    }
  }

  // Player
  if (!editMode) {
    const sp = state.levelData.playerStart || { x: 0, y: 1, z: 0 };
    state.player = new PlayerController(scene, sp);
  }

  // Build movable blocks (puzzle pieces)
  if (!editMode) {
    buildMovables();
  }

  // Grid helper in edit mode
  if (editMode) {
    showGrid();
  }

  // Build target diamond (level goal)
  if (!editMode && state.levelData.target) {
    createTargetDiamond(state.levelData.target);
  }

  // Build teleport pads (show in both play and edit mode)
  if (state.levelData.teleports) {
    buildTeleportPads(state.levelData.teleports);
  }

  // Apply vertical fog to all objects
  applyFogToScene();
}

// ─── Target Diamond (Level Goal) ───
function createTargetDiamond(target) {
  // Remove old diamond
  if (state.targetDiamond) {
    scene.remove(state.targetDiamond);
    state.targetDiamond = null;
  }

  const s = cellSize;
  const group = new THREE.Group();
  group.name = 'targetDiamond';

  // Diamond shape — two octahedrons nested
  const outerGeo = new THREE.OctahedronGeometry(s * 0.18, 0);
  const outerMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffa500,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.8,
    transparent: true,
    opacity: 0.85,
  });
  const outerDiamond = new THREE.Mesh(outerGeo, outerMat);
  outerDiamond.name = 'diamondOuter';
  group.add(outerDiamond);

  // Inner core — smaller, brighter
  const innerGeo = new THREE.OctahedronGeometry(s * 0.09, 0);
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffdd44,
    emissiveIntensity: 1.5,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.95,
  });
  const innerDiamond = new THREE.Mesh(innerGeo, innerMat);
  innerDiamond.name = 'diamondInner';
  group.add(innerDiamond);

  // Point light — warm golden glow
  const pointLight = new THREE.PointLight(0xffd700, 1.5, s * 3);
  pointLight.name = 'diamondLight1';
  group.add(pointLight);

  // Secondary softer light
  const pointLight2 = new THREE.PointLight(0xffa500, 0.8, s * 2);
  pointLight2.name = 'diamondLight2';
  pointLight2.position.set(0, s * 0.15, 0);
  group.add(pointLight2);

  // ─── Sparkle particle system ───
  const particleCount = 60;
  const sparkleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const lifetimes = new Float32Array(particleCount);
  const sizes = new Float32Array(particleCount);
  const radius = s * 0.7;

  for (let i = 0; i < particleCount; i++) {
    // Random spherical position around center
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = Math.random() * radius;
    positions[i * 3]     = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
    positions[i * 3 + 2] = Math.cos(phi) * r;
    // Outward velocity
    velocities[i * 3]     = positions[i * 3] * 0.3;
    velocities[i * 3 + 1] = positions[i * 3 + 1] * 0.3 + Math.random() * 0.3;
    velocities[i * 3 + 2] = positions[i * 3 + 2] * 0.3;
    lifetimes[i] = Math.random(); // stagger start
    sizes[i] = s * (0.03 + Math.random() * 0.06);
  }

  sparkleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  sparkleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const sparkleMat = new THREE.PointsMaterial({
    color: 0xffd700,
    size: s * 0.06,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const sparkles = new THREE.Points(sparkleGeo, sparkleMat);
  sparkles.name = 'diamondSparkles';
  sparkles.userData.velocities = velocities;
  sparkles.userData.lifetimes = lifetimes;
  sparkles.userData.basePositions = new Float32Array(positions);
  group.add(sparkles);

  // Position in the scene — float above the target position
  // Level data target: { x: gridX, y: gridZ, z: gridY (height) }
  group.position.set(target.x * s, target.z * s + s * 0.6, target.y * s);

  scene.add(group);
  state.targetDiamond = group;
}

// ─── Teleport Pads ───
function buildTeleportPads(teleportDefs) {
  state.teleportPads.forEach(tp => scene.remove(tp.mesh));
  state.teleportPads = [];

  const s = cellSize;
  const padsByID = {};

  teleportDefs.forEach(tDef => {
    const group = new THREE.Group();
    group.name = `telepad_${tDef.id}`;

    // Glowing platform ring
    const ringGeo = new THREE.TorusGeometry(s * 0.32, s * 0.05, 8, 24);
    const isA = tDef.id === 'A';
    const padColor = isA ? 0x00ccff : 0xff6600;
    const ringMat = new THREE.MeshStandardMaterial({
      color: padColor,
      emissive: padColor,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.6,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.name = 'telepadRing';
    group.add(ring);

    // Inner circle glow
    const innerGeo = new THREE.CircleGeometry(s * 0.25, 24);
    const innerMat = new THREE.MeshStandardMaterial({
      color: padColor,
      emissive: padColor,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.01;
    inner.name = 'telepadInner';
    group.add(inner);

    // Floating rune symbols (vertical rotating ring)
    const runeGeo = new THREE.TorusGeometry(s * 0.22, s * 0.015, 4, 6);
    const runeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: padColor,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.6,
    });
    const rune = new THREE.Mesh(runeGeo, runeMat);
    rune.position.y = s * 0.25;
    rune.name = 'telepadRune';
    group.add(rune);

    // Point light
    const light = new THREE.PointLight(padColor, 1.5, s * 3);
    light.name = 'telepadLight';
    light.position.y = s * 0.2;
    group.add(light);

    // Vertical beam
    const beamGeo = new THREE.CylinderGeometry(s * 0.03, s * 0.12, s * 1.2, 8);
    const beamMat = new THREE.MeshStandardMaterial({
      color: padColor,
      emissive: padColor,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.25,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = s * 0.6;
    beam.name = 'telepadBeam';
    group.add(beam);

    // Floating particles around the pad
    const pCount = 30;
    const pPositions = new Float32Array(pCount * 3);
    const pRadius = s * 0.5;
    for (let i = 0; i < pCount; i++) {
      const angle = (i / pCount) * Math.PI * 2;
      pPositions[i * 3] = Math.cos(angle) * pRadius * (0.5 + Math.random() * 0.5);
      pPositions[i * 3 + 1] = Math.random() * s * 0.8;
      pPositions[i * 3 + 2] = Math.sin(angle) * pRadius * (0.5 + Math.random() * 0.5);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: padColor,
      size: s * 0.04,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(pGeo, pMat);
    particles.name = 'telepadParticles';
    group.add(particles);

    // Position: teleport pads sit on the surface at (x, z), height y
    // Target data: x=gridX, y=height, z=gridZ
    group.position.set(tDef.x * s, tDef.y * s + 0.02, tDef.z * s);

    scene.add(group);
    padsByID[tDef.id] = { mesh: group, data: tDef };
  });

  // Link partners
  teleportDefs.forEach(tDef => {
    const pad = padsByID[tDef.id];
    const partner = padsByID[tDef.pairId];
    if (pad && partner) {
      pad.partner = partner;
    }
    state.teleportPads.push(pad);
  });
}

function animateTeleportPads(elapsed) {
  state.teleportPads.forEach(tp => {
    const group = tp.mesh;

    // Rotate rune ring
    const rune = group.getObjectByName('telepadRune');
    if (rune) {
      rune.rotation.x = elapsed * 1.5;
      rune.rotation.y = elapsed * 0.8;
    }

    // Pulse inner glow
    const inner = group.getObjectByName('telepadInner');
    if (inner) {
      inner.material.opacity = 0.3 + Math.sin(elapsed * 2.5) * 0.15;
    }

    // Pulse ring
    const ring = group.getObjectByName('telepadRing');
    if (ring) {
      ring.material.emissiveIntensity = 0.6 + Math.sin(elapsed * 3) * 0.3;
    }

    // Pulse light
    const light = group.getObjectByName('telepadLight');
    if (light) {
      light.intensity = 1.5 + Math.sin(elapsed * 2) * 0.5;
    }

    // Beam pulse
    const beam = group.getObjectByName('telepadBeam');
    if (beam) {
      beam.material.opacity = 0.15 + Math.sin(elapsed * 1.8) * 0.1;
      beam.scale.y = 1 + Math.sin(elapsed * 2) * 0.1;
    }

    // Animate particles — orbit slowly upward
    const particles = group.getObjectByName('telepadParticles');
    if (particles) {
      const pos = particles.geometry.attributes.position;
      const s = cellSize;
      for (let i = 0; i < pos.count; i++) {
        const angle = elapsed * 0.5 + (i / pos.count) * Math.PI * 2;
        const r = s * 0.35 * (0.6 + 0.4 * Math.sin(i * 1.7 + elapsed));
        pos.array[i * 3] = Math.cos(angle + i * 0.3) * r;
        pos.array[i * 3 + 1] = (pos.array[i * 3 + 1] + 0.008) % (s * 0.9);
        pos.array[i * 3 + 2] = Math.sin(angle + i * 0.3) * r;
      }
      pos.needsUpdate = true;
    }
  });
}

function isPlayerOnPad(pg, td) {
  return Math.abs(pg.x - td.x) <= 0.5 && Math.abs(pg.z - td.z) <= 0.5 && Math.abs(pg.y - td.y) <= 1.5;
}

function checkTeleportPads() {
  if (!state.player || state.transitioning || state.teleportPads.length === 0) return;
  if (state.player.moving) return; // Don't teleport while moving
  if (state._teleporting) return; // Don't check during teleport animation

  const pg = state.player.gridPos;

  // If player was on a destination pad, wait until they leave before allowing re-teleport
  if (state._lastTeleportDest) {
    const destPad = state._lastTeleportDest;
    if (isPlayerOnPad(pg, destPad)) {
      return; // Still standing on arrival pad — do nothing
    } else {
      state._lastTeleportDest = null; // Player stepped off, clear the lock
    }
  }

  const s = cellSize;

  for (const tp of state.teleportPads) {
    if (!tp.partner) continue;
    const td = tp.data;

    if (isPlayerOnPad(pg, td)) {
      // Teleport to partner pad
      const dest = tp.partner.data;
      playTeleportSound();
      playTeleportFlash(tp, tp.partner);

      state._teleporting = true;

      // Quick fade out
      const mesh = state.player.mesh;
      const origScale = mesh.scale.clone();
      const startTime = performance.now();

      function teleportAnimate() {
        const t = Math.min((performance.now() - startTime) / 300, 1);
        if (t < 1) {
          mesh.scale.setScalar(1 - t);
          mesh.material.opacity = 1 - t;
          requestAnimationFrame(teleportAnimate);
        } else {
          // Move player to destination
          state.player.gridPos = { x: dest.x, y: dest.y, z: dest.z };
          mesh.position.set(dest.x * s, (dest.y + 0.25) * s, dest.z * s);
          state.player.moving = false;
          state.player.path = [];

          // Mark destination pad so we won't re-teleport until player leaves it
          state._lastTeleportDest = dest;

          // Fade in
          const fadeInStart = performance.now();
          function fadeIn() {
            const ft = Math.min((performance.now() - fadeInStart) / 300, 1);
            mesh.scale.copy(origScale).multiplyScalar(ft);
            if (mesh.material.opacity !== undefined) mesh.material.opacity = ft;
            if (ft < 1) requestAnimationFrame(fadeIn);
            else {
              mesh.scale.copy(origScale);
              state._teleporting = false; // Animation done, re-enable checks
            }
          }
          fadeIn();
        }
      }
      teleportAnimate();
      break;
    }
  }
}

function playTeleportSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.2, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
    master.connect(ctx.destination);

    // Whoosh sweep
    const sweep = ctx.createOscillator();
    const sweepEnv = ctx.createGain();
    sweep.type = 'sine';
    sweep.frequency.setValueAtTime(200, ctx.currentTime);
    sweep.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.3);
    sweep.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.8);
    sweepEnv.gain.setValueAtTime(0.15, ctx.currentTime);
    sweepEnv.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    sweep.connect(sweepEnv);
    sweepEnv.connect(master);
    sweep.start(ctx.currentTime);
    sweep.stop(ctx.currentTime + 1.0);

    // Crystalline ping
    const ping = ctx.createOscillator();
    const pingEnv = ctx.createGain();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(1800, ctx.currentTime + 0.15);
    pingEnv.gain.setValueAtTime(0, ctx.currentTime);
    pingEnv.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.2);
    pingEnv.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    ping.connect(pingEnv);
    pingEnv.connect(master);
    ping.start(ctx.currentTime + 0.15);
    ping.stop(ctx.currentTime + 1.2);

    // Sub rumble
    const sub = ctx.createOscillator();
    const subEnv = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(60, ctx.currentTime);
    subEnv.gain.setValueAtTime(0.1, ctx.currentTime);
    subEnv.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    sub.connect(subEnv);
    subEnv.connect(master);
    sub.start(ctx.currentTime);
    sub.stop(ctx.currentTime + 0.8);

    setTimeout(() => ctx.close(), 2000);
  } catch (e) { /* Audio unavailable */ }
}

function playTeleportFlash(fromPad, toPad) {
  const flash = document.getElementById('diamond-flash');
  if (!flash) return;

  // Cyan flash for teleportation
  flash.style.background = 'radial-gradient(circle at 50% 50%, rgba(0,204,255,0.5) 0%, rgba(100,150,255,0.2) 30%, transparent 60%)';
  flash.style.transition = 'none';
  flash.style.opacity = '1';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      flash.style.transition = 'opacity 0.6s ease-out';
      flash.style.opacity = '0';
      // Restore original gradient after animation
      setTimeout(() => {
        flash.style.background = 'radial-gradient(circle at 50% 50%, rgba(255,215,0,0.6) 0%, rgba(255,255,255,0.3) 30%, transparent 70%)';
      }, 700);
    });
  });
}

// ─── Water Animation ───
function animateWater(elapsed) {
  scene.traverse(obj => {
    if (obj.name === 'waterSurface' && obj.isMesh) {
      // Gentle bob
      const baseY = obj.userData._baseY ?? obj.position.y;
      if (!obj.userData._baseY) obj.userData._baseY = baseY;
      obj.position.y = baseY + Math.sin(elapsed * 1.2 + obj.parent.position.x * 2) * cellSize * 0.02;
      // Slight opacity pulse
      if (obj.material.opacity !== undefined) {
        obj.material.opacity = 0.7 + Math.sin(elapsed * 1.5 + obj.parent.position.z * 3) * 0.08;
      }
    }
  });
}

function animateTargetDiamond(elapsed) {
  if (!state.targetDiamond) return;

  const group = state.targetDiamond;

  // Slow hover bob
  const baseY = group.userData.baseY ?? group.position.y;
  if (!group.userData.baseY) group.userData.baseY = baseY;
  group.position.y = baseY + Math.sin(elapsed * 1.5) * cellSize * 0.15;

  // Slow rotation
  const outer = group.getObjectByName('diamondOuter');
  const inner = group.getObjectByName('diamondInner');
  if (outer) {
    outer.rotation.y = elapsed * 0.8;
    outer.rotation.x = Math.sin(elapsed * 0.5) * 0.2;
  }
  if (inner) {
    inner.rotation.y = -elapsed * 1.2;
    inner.rotation.z = Math.cos(elapsed * 0.7) * 0.3;
  }

  // Pulsing light intensity
  const light1 = group.getObjectByName('diamondLight1');
  const light2 = group.getObjectByName('diamondLight2');
  if (light1) light1.intensity = 2 + Math.sin(elapsed * 3) * 0.8;
  if (light2) light2.intensity = 1 + Math.cos(elapsed * 2.5) * 0.5;

  // Pulsing opacity on outer diamond
  if (outer) outer.material.opacity = 0.7 + Math.sin(elapsed * 2) * 0.15;

  // Animate sparkle particles
  const sparkles = group.getObjectByName('diamondSparkles');
  if (sparkles) {
    const pos = sparkles.geometry.attributes.position;
    const basePosArr = sparkles.userData.basePositions;
    const velArr = sparkles.userData.velocities;
    const lifeArr = sparkles.userData.lifetimes;
    const dt = 0.016; // approx frame time
    const radius = cellSize * 0.7;

    for (let i = 0; i < lifeArr.length; i++) {
      lifeArr[i] += dt * (0.4 + Math.sin(i) * 0.15);

      if (lifeArr[i] >= 1.0) {
        // Respawn particle at a random position near center
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = Math.random() * radius * 0.3;
        basePosArr[i * 3]     = Math.sin(phi) * Math.cos(theta) * r;
        basePosArr[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
        basePosArr[i * 3 + 2] = Math.cos(phi) * r;
        velArr[i * 3]     = basePosArr[i * 3] * 0.5;
        velArr[i * 3 + 1] = basePosArr[i * 3 + 1] * 0.5 + 0.2 + Math.random() * 0.3;
        velArr[i * 3 + 2] = basePosArr[i * 3 + 2] * 0.5;
        lifeArr[i] = 0;
      }

      const life = lifeArr[i];
      // Move outward along velocity
      pos.array[i * 3]     = basePosArr[i * 3]     + velArr[i * 3]     * life;
      pos.array[i * 3 + 1] = basePosArr[i * 3 + 1] + velArr[i * 3 + 1] * life;
      pos.array[i * 3 + 2] = basePosArr[i * 3 + 2] + velArr[i * 3 + 2] * life;
    }
    pos.needsUpdate = true;

    // Fade particles based on overall pulsing
    sparkles.material.opacity = 0.5 + Math.sin(elapsed * 3) * 0.35;
    sparkles.material.size = cellSize * (0.04 + Math.sin(elapsed * 4) * 0.02);
  }
}

function checkTargetReached() {
  if (!state.player || !state.levelData.target || state.transitioning) return;

  const target = state.levelData.target;
  const playerPos = state.player.gridPos;

  // Target: { x: gridX, y: gridZ, z: gridY (height/surface) }
  // Player gridPos: { x: gridX, y: surfaceY, z: gridZ }
  const dx = Math.abs(playerPos.x - target.x);
  const dz = Math.abs(playerPos.z - target.y);  // target.y = grid Z
  const dy = Math.abs(playerPos.y - target.z);   // target.z = height

  // Player must be on the same cell
  if (dx <= 0.5 && dz <= 0.5 && dy <= 1.5) {
    triggerLevelComplete();
  }
}

function playCollectChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.25, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.8);
    master.connect(ctx.destination);

    // Sparkling arpeggio — pentatonic notes
    const notes = [784, 988, 1175, 1319, 1568, 1760]; // G5 B5 D6 E6 G6 A6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      env.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
      env.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.08 + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.8);
      osc.connect(env);
      env.connect(master);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 1.0);
    });

    // Shimmer layer — high harmonic
    const shimmer = ctx.createOscillator();
    const shimEnv = ctx.createGain();
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(2350, ctx.currentTime);
    shimmer.frequency.linearRampToValueAtTime(3000, ctx.currentTime + 0.6);
    shimEnv.gain.setValueAtTime(0.08, ctx.currentTime);
    shimEnv.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    shimmer.connect(shimEnv);
    shimEnv.connect(master);
    shimmer.start(ctx.currentTime);
    shimmer.stop(ctx.currentTime + 1.5);

    // Sub bass resonance
    const bass = ctx.createOscillator();
    const bassEnv = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(196, ctx.currentTime); // G3
    bassEnv.gain.setValueAtTime(0.15, ctx.currentTime + 0.1);
    bassEnv.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    bass.connect(bassEnv);
    bassEnv.connect(master);
    bass.start(ctx.currentTime);
    bass.stop(ctx.currentTime + 1.8);

    // Clean up
    setTimeout(() => ctx.close(), 3000);
  } catch (e) { /* Audio not available */ }
}

function playDiamondFlash() {
  const flash = document.getElementById('diamond-flash');
  const ring = document.getElementById('diamond-ring');
  if (!flash || !ring) return;

  // Flash burst
  flash.style.transition = 'none';
  flash.style.opacity = '1';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      flash.style.transition = 'opacity 0.9s ease-out';
      flash.style.opacity = '0';
    });
  });

  // Expanding ring
  ring.style.transition = 'none';
  ring.style.width = '0px';
  ring.style.height = '0px';
  ring.style.opacity = '1';
  ring.style.borderWidth = '3px';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ring.style.transition = 'width 0.8s ease-out, height 0.8s ease-out, opacity 0.8s ease-out, border-width 0.8s ease-out';
      ring.style.width = '120vmax';
      ring.style.height = '120vmax';
      ring.style.opacity = '0';
      ring.style.borderWidth = '1px';
    });
  });
}

function triggerLevelComplete() {
  if (state.transitioning) return;
  state.transitioning = true;

  // Play collection effects
  playCollectChime();
  playDiamondFlash();

  // Diamond burst — scale up and fade
  if (state.targetDiamond) {
    const diamond = state.targetDiamond;
    const startScale = diamond.scale.x;
    const startTime = performance.now();
    const burstDuration = 600;

    function burstAnimate() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / burstDuration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const s = startScale + ease * 3;
      diamond.scale.set(s, s, s);
      diamond.traverse(child => {
        if (child.material && child.material.opacity !== undefined) {
          child.material.opacity = Math.max(0, 1 - ease);
        }
      });
      if (t < 1) requestAnimationFrame(burstAnimate);
    }
    burstAnimate();
  }

  // Fade overlay after flash
  const overlay = document.getElementById('fade-overlay');
  setTimeout(() => {
    if (overlay) overlay.style.opacity = '1';
  }, 500);

  // After fade completes, load next level
  setTimeout(() => {
    const nextLevel = currentLevel + 1;
    if (LevelData[nextLevel]) {
      loadLevel(nextLevel);
    } else {
      loadLevel(1);
    }

    setTimeout(() => {
      if (overlay) overlay.style.opacity = '0';
      state.transitioning = false;
    }, 400);
  }, 1800);
}

// ─── Fast single-block operations for editor (no full rebuild) ───

function addBlockFast(block) {
  const key = `${block.x},${block.y},${block.z}`;
  // Remove existing mesh at that exact position (same x,y,z) if any
  if (state.meshCache.has(key)) {
    const old = state.meshCache.get(key);
    scene.remove(old);
    const idx = state.meshes.indexOf(old);
    if (idx !== -1) state.meshes.splice(idx, 1);
    state.meshCache.delete(key);
  }
  // Build just this one block
  const group = SceneBuilder.createBlock(block);
  // Apply fog to it
  group.traverse(obj => {
    if (!obj.isMesh) return;
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map(m => applyVerticalFog(m));
    } else {
      obj.material = applyVerticalFog(obj.material);
    }
  });
  scene.add(group);
  state.meshes.push(group);
  state.meshCache.set(key, group);
}

function removeBlockFast(x, y, z) {
  const key = `${x},${y},${z}`;
  if (state.meshCache.has(key)) {
    const old = state.meshCache.get(key);
    scene.remove(old);
    const idx = state.meshes.indexOf(old);
    if (idx !== -1) state.meshes.splice(idx, 1);
    state.meshCache.delete(key);
  }
}

function moveBlockFast(blockIdx, newX, newZ) {
  const block = state.levelData.blocks[blockIdx];
  if (!block) return;
  // Remove old mesh using full x,y,z key
  removeBlockFast(block.x, block.y, block.z);
  // Update data
  block.x = newX;
  block.z = newZ;
  // Add new mesh
  addBlockFast(block);
}

// Rotate the block at the current cursor position by +90°
function rotateBlockAtCursor() {
  const gx = _editorLastGX;
  const gz = _editorLastGZ;
  const useY = EditorController.currentYLevel;
  const block = state.levelData.blocks.find(b => b.x === gx && b.z === gz && b.y === useY);
  if (!block) {
    const fallback = state.levelData.blocks.find(b => b.x === gx && b.z === gz);
    if (fallback) {
      removeBlockFast(fallback.x, fallback.y, fallback.z);
      fallback.angle = ((fallback.angle || 0) + 90) % 360;
      addBlockFast(fallback);
    }
    return;
  }
  removeBlockFast(block.x, block.y, block.z);
  block.angle = ((block.angle || 0) + 90) % 360;
  addBlockFast(block);
}

// Expose fast ops for editor
window._editorOps = { addBlockFast, removeBlockFast, moveBlockFast };
// removeBlockFast now requires (x, y, z)

function showGrid() {
  if (state.gridHelper) scene.remove(state.gridHelper);
  const count = 20;
  const totalSize = count * cellSize;
  const grid = new THREE.GridHelper(totalSize, count, 0x999999, 0xcccccc);
  // Offset grid by half a cell so block positions land at cell centers
  // Position at the current Y level
  const yPos = EditorController.currentYLevel * cellSize + 0.01;
  grid.position.set(cellSize / 2, yPos, cellSize / 2);
  grid.material.opacity = 0.25;
  grid.material.transparent = true;
  scene.add(grid);
  state.gridHelper = grid;
}

// Move the grid plane + cursor helpers to the current Y level (called on key press)
function updateGridPlaneLevel() {
  const s = cellSize;
  const yLevel = EditorController.currentYLevel;
  const yPos = yLevel * s + 0.01;

  // Move the grid helper
  if (state.gridHelper) {
    state.gridHelper.position.y = yPos;
  }

  // Update the cursor highlight position at last known mouse X/Z
  const gx = _editorLastGX;
  const gz = _editorLastGZ;
  const hlMesh = scene.getObjectByName('editorCursorHL');
  if (hlMesh) {
    hlMesh.position.set(gx * s, yLevel * s + 0.04, gz * s);
    hlMesh.visible = true;
  }

  // Update ground shadow + vertical line
  const shMesh = scene.getObjectByName('editorCursorShadow');
  if (shMesh) {
    shMesh.position.set(gx * s, 0.02, gz * s);
    shMesh.visible = yLevel !== 0;
  }
  const lineMesh = scene.getObjectByName('editorCursorLine');
  if (lineMesh) {
    const cursorY = yLevel * s + 0.04;
    const groundY = 0.02;
    const lineH = Math.abs(cursorY - groundY);
    lineMesh.scale.set(1, lineH > 0.01 ? lineH : 0.01, 1);
    lineMesh.position.set(gx * s, (cursorY + groundY) / 2, gz * s);
    lineMesh.visible = yLevel !== 0;
  }

  // Update the grid cursor readout
  const gcY = document.getElementById('gc-y');
  if (gcY) gcY.textContent = yLevel;
  document.getElementById('grid-cursor').classList.toggle('visible', editMode);

  // Show toast with current level
  toast(`Level Y: ${yLevel}`);
}

function hideGrid() {
  if (state.gridHelper) { scene.remove(state.gridHelper); state.gridHelper = null; }
}

function onClick(e) {
  // Skip if we just finished dragging
  if (state._justDragged) { state._justDragged = false; return; }

  const mouse = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const s = cellSize;

  if (editMode) {
    EditorController.handleClick(raycaster, state, scene, rebuildScene.bind(null), s);
  } else {
    // Play mode — find clicked block, move player
    const hits = raycaster.intersectObjects(state.meshes, true);
    if (hits.length > 0 && state.player) {
      const p = hits[0].point;
      const gx = Math.round(p.x / s);
      const gz = Math.round(p.z / s);
      // Gather all blocks including current movable positions
      const allBlocks = getAllBlocksWithMovables();

      // Find all blocks at this grid column
      const blocksHere = allBlocks.filter(b => b.x === gx && b.z === gz);
      if (blocksHere.length === 0) return;

      // Determine which block the click actually landed on by checking the
      // hit point's Y coordinate against each block's vertical extent.
      // Prioritise stair blocks — when clicking a stair, the player must
      // target the stair surface, not a block hidden underneath.
      const hitY = p.y / s; // convert world Y to grid units
      let block = null;

      // First pass: prefer a stair whose body range contains the hit point
      block = blocksHere.find(b =>
        b.type === 'stair' && hitY >= b.y - 0.1 && hitY <= b.y + b.h + 0.1
      );

      // Second pass: pick the block whose surface is closest to the hit point
      if (!block) {
        block = blocksHere.reduce((best, b) => {
          const surfY = b.y + b.h;
          const bestSurfY = best.y + best.h;
          return Math.abs(hitY - surfY) < Math.abs(hitY - bestSurfY) ? b : best;
        });
      }

      if (block) {
        const targetY = block.y + block.h;
        const from = state.player.gridPos;
        const to = { x: gx, y: targetY, z: gz };
        const path = Pathfinder.find(allBlocks, from, to);
        if (path && path.length > 0) {
          state.player.followPath(path, cellSize);
        }
      }
    }
  }
}

// ─── Movable block helpers ───

function getAllBlocksWithMovables() {
  // Start with static blocks
  const blocks = state.levelData.blocks.map(b => ({ ...b }));

  // Add movables at their CURRENT snapped positions
  state.movables.forEach(mv => {
    const snappedX = Math.round(mv.currentX);
    const snappedZ = Math.round(mv.currentZ);
    const snappedY = mv.data.axis === 'y' ? Math.round(mv.currentY) : mv.data.y;

    // Remove any static block at the movable's current position to avoid duplicates
    const dupIdx = blocks.findIndex(b => b.x === snappedX && b.z === snappedZ && b.y === snappedY);
    if (dupIdx !== -1) blocks.splice(dupIdx, 1);

    blocks.push({
      x: snappedX,
      y: snappedY,
      z: snappedZ,
      h: mv.data.h || 1,
      type: mv.data.type || 'block',
      isMovable: true
    });
  });
  return blocks;
}

function buildMovables() {
  // Clear old movables
  state.movables.forEach(mv => {
    scene.remove(mv.mesh);
    if (mv.railMesh) scene.remove(mv.railMesh);
  });
  state.movables = [];

  const movDefs = state.levelData.movables || [];
  const s = cellSize;

  movDefs.forEach((mDef, idx) => {
    // Create the draggable block
    const h = (mDef.h || 1) * s;

    const group = new THREE.Group();
    group.name = `movable_${idx}`;

    // Main block — use movable color from state
    const geo = new THREE.BoxGeometry(s, h, s);
    const mc = state.movableColor;
    // Top is the chosen color, side is a blueish-shifted variant
    const mr = (mc >> 16) & 0xff, mg = (mc >> 8) & 0xff, mb = mc & 0xff;
    const sideR = Math.max(0, mr - 54), sideG = Math.min(255, mg + 4), sideB = Math.min(255, mb + 12);
    const sideHex = (sideR << 16) | (sideG << 8) | sideB;
    const topMat = new THREE.MeshStandardMaterial({ color: mc, roughness: 0.65, metalness: 0.08 });
    topMat._paletteKey = 'movableTop';
    const sideMat = new THREE.MeshStandardMaterial({
      color: sideHex, roughness: 0.75, metalness: 0.05
    });
    sideMat._paletteKey = 'movableSide';
    const mesh = new THREE.Mesh(geo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
    mesh.position.y = h / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isBlockBody = true; // mark for top-face exclusion
    group.add(mesh);

    // Grip lines on the SIDE face (not on top)
    // For x-axis: lines on the front face (z+ side), stacked vertically
    // For z-axis: lines on the right face (x+ side), stacked vertically
    // For y-axis: lines on the front face (z+ side), stacked vertically
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.5, transparent: true, opacity: 0.5
    });
    for (let i = -1; i <= 1; i++) {
      let lineGeo, linePos;
      if (mDef.axis === 'x') {
        // Lines on front face, horizontal stripes
        lineGeo = new THREE.BoxGeometry(s * 0.5, 0.04 * s, 0.03 * s);
        linePos = new THREE.Vector3(0, h / 2 + i * 0.15 * s, s / 2 + 0.01 * s);
      } else if (mDef.axis === 'z') {
        // Lines on right face, horizontal stripes
        lineGeo = new THREE.BoxGeometry(0.03 * s, 0.04 * s, s * 0.5);
        linePos = new THREE.Vector3(s / 2 + 0.01 * s, h / 2 + i * 0.15 * s, 0);
      } else {
        // y-axis: lines on front face, horizontal stripes
        lineGeo = new THREE.BoxGeometry(s * 0.5, 0.04 * s, 0.03 * s);
        linePos = new THREE.Vector3(0, h / 2 + i * 0.15 * s, s / 2 + 0.01 * s);
      }
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.copy(linePos);
      group.add(line);
    }

    // Arrow indicators on the block
    const arrowLen = 0.2 * s;
    const arrowGeo = new THREE.ConeGeometry(0.06 * s, arrowLen, 6);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.4, transparent: true, opacity: 0.7
    });

    if (mDef.axis === 'x') {
      const arrL = new THREE.Mesh(arrowGeo, arrowMat);
      arrL.rotation.z = Math.PI / 2;
      arrL.position.set(-s * 0.35, h / 2, 0);
      group.add(arrL);
      const arrR = new THREE.Mesh(arrowGeo, arrowMat);
      arrR.rotation.z = -Math.PI / 2;
      arrR.position.set(s * 0.35, h / 2, 0);
      group.add(arrR);
    } else if (mDef.axis === 'y') {
      // Vertical (up/down) arrows
      const arrUp = new THREE.Mesh(arrowGeo, arrowMat);
      arrUp.rotation.z = 0; // cone points up by default
      arrUp.position.set(0, h + 0.15 * s, 0);
      group.add(arrUp);
      const arrDown = new THREE.Mesh(arrowGeo, arrowMat);
      arrDown.rotation.z = Math.PI;
      arrDown.position.set(0, -0.15 * s, 0);
      group.add(arrDown);
    } else {
      const arrF = new THREE.Mesh(arrowGeo, arrowMat);
      arrF.rotation.x = Math.PI / 2;
      arrF.position.set(0, h / 2, -s * 0.35);
      group.add(arrF);
      const arrB = new THREE.Mesh(arrowGeo, arrowMat);
      arrB.rotation.x = -Math.PI / 2;
      arrB.position.set(0, h / 2, s * 0.35);
      group.add(arrB);
    }

    // Set initial position
    const startX = mDef.x;
    const startZ = mDef.z;
    const startY = mDef.y;
    group.position.set(startX * s, startY * s, startZ * s);
    group.userData.isMovable = true;
    group.userData.movableIndex = idx;
    scene.add(group);

    // Build the rail
    const railGroup = buildRail(mDef, s);
    scene.add(railGroup);

    state.movables.push({
      mesh: group,
      data: mDef,
      railMesh: railGroup,
      currentX: startX,
      currentY: startY,
      currentZ: startZ,
    });
    state.meshes.push(group);
  });
}

function buildRail(mDef, s) {
  const railGroup = new THREE.Group();
  railGroup.name = `rail_${mDef.x}_${mDef.z}`;

  const mc = state.movableColor;
  const mr = (mc >> 16) & 0xff, mg = (mc >> 8) & 0xff, mb = mc & 0xff;
  const sideHex = ((Math.max(0, mr - 54)) << 16) | ((Math.min(255, mg + 4)) << 8) | Math.min(255, mb + 12);
  const railColor = new THREE.Color(sideHex).multiplyScalar(0.6);
  const h = (mDef.h || 1) * s;

  if (mDef.axis === 'x') {
    const minX = mDef.range[0];
    const maxX = mDef.range[1];
    const length = (maxX - minX) * s;
    const centerX = ((minX + maxX) / 2) * s;

    const trackGeo = new THREE.BoxGeometry(length + s, 0.04 * s, s * 0.15);
    const trackMat = new THREE.MeshStandardMaterial({
      color: railColor, roughness: 0.7, transparent: true, opacity: 0.6
    });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(centerX, mDef.y * s + 0.02 * s, mDef.z * s);
    railGroup.add(track);

    for (const ex of [minX, maxX]) {
      const markerGeo = new THREE.BoxGeometry(0.08 * s, 0.12 * s, s * 0.2);
      const markerMat = new THREE.MeshStandardMaterial({
        color: railColor, roughness: 0.6, transparent: true, opacity: 0.8
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(ex * s, mDef.y * s + 0.06 * s, mDef.z * s);
      railGroup.add(marker);
    }

    const dashCount = Math.max(2, Math.floor(length / (0.3 * s)));
    for (let i = 0; i <= dashCount; i++) {
      const t = i / dashCount;
      const dx = minX * s + t * length;
      const dashGeo = new THREE.BoxGeometry(0.15 * s, 0.02 * s, 0.06 * s);
      const dashMat = new THREE.MeshStandardMaterial({
        color: railColor, roughness: 0.8, transparent: true, opacity: 0.35
      });
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(dx, mDef.y * s + 0.03 * s, mDef.z * s);
      railGroup.add(dash);
    }
  } else if (mDef.axis === 'y') {
    // Vertical rail (up/down)
    const minY = mDef.range[0];
    const maxY = mDef.range[1];
    const length = (maxY - minY) * s;
    const centerY = ((minY + maxY) / 2) * s;

    // Vertical track strip on two sides of the block
    for (const offsetX of [-0.4 * s, 0.4 * s]) {
      const trackGeo = new THREE.BoxGeometry(0.06 * s, length + s, 0.06 * s);
      const trackMat = new THREE.MeshStandardMaterial({
        color: railColor, roughness: 0.7, transparent: true, opacity: 0.6
      });
      const track = new THREE.Mesh(trackGeo, trackMat);
      track.position.set(mDef.x * s + offsetX, centerY + (mDef.h || 1) * s * 0.5, mDef.z * s);
      railGroup.add(track);
    }

    // End markers (top and bottom)
    for (const ey of [minY, maxY]) {
      const markerGeo = new THREE.BoxGeometry(s * 0.3, 0.08 * s, s * 0.3);
      const markerMat = new THREE.MeshStandardMaterial({
        color: railColor, roughness: 0.6, transparent: true, opacity: 0.8
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(mDef.x * s, ey * s + (mDef.h || 1) * s * 0.5, mDef.z * s);
      railGroup.add(marker);
    }

    // Tick marks along the vertical rail
    const tickCount = Math.max(2, maxY - minY + 1);
    for (let i = 0; i < tickCount; i++) {
      const ty = (minY + i) * s + (mDef.h || 1) * s * 0.5;
      for (const offsetX of [-0.4 * s, 0.4 * s]) {
        const tickGeo = new THREE.BoxGeometry(0.12 * s, 0.03 * s, 0.03 * s);
        const tickMat = new THREE.MeshStandardMaterial({
          color: railColor, roughness: 0.8, transparent: true, opacity: 0.4
        });
        const tick = new THREE.Mesh(tickGeo, tickMat);
        tick.position.set(mDef.x * s + offsetX, ty, mDef.z * s);
        railGroup.add(tick);
      }
    }
  } else {
    // z-axis rail
    const minZ = mDef.range[0];
    const maxZ = mDef.range[1];
    const length = (maxZ - minZ) * s;
    const centerZ = ((minZ + maxZ) / 2) * s;

    const trackGeo = new THREE.BoxGeometry(s * 0.15, 0.04 * s, length + s);
    const trackMat = new THREE.MeshStandardMaterial({
      color: railColor, roughness: 0.7, transparent: true, opacity: 0.6
    });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(mDef.x * s, mDef.y * s + 0.02 * s, centerZ);
    railGroup.add(track);

    for (const ez of [minZ, maxZ]) {
      const markerGeo = new THREE.BoxGeometry(s * 0.2, 0.12 * s, 0.08 * s);
      const markerMat = new THREE.MeshStandardMaterial({
        color: railColor, roughness: 0.6, transparent: true, opacity: 0.8
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(mDef.x * s, mDef.y * s + 0.06 * s, ez * s);
      railGroup.add(marker);
    }

    const dashCount = Math.max(2, Math.floor(length / (0.3 * s)));
    for (let i = 0; i <= dashCount; i++) {
      const t = i / dashCount;
      const dz = minZ * s + t * length;
      const dashGeo = new THREE.BoxGeometry(0.06 * s, 0.02 * s, 0.15 * s);
      const dashMat = new THREE.MeshStandardMaterial({
        color: railColor, roughness: 0.8, transparent: true, opacity: 0.35
      });
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(mDef.x * s, mDef.y * s + 0.03 * s, dz);
      railGroup.add(dash);
    }
  }

  return railGroup;
}

// ─── Drag interaction ───

function onPointerDown(e) {
  if (editMode) return;
  const mouse = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  // Check movable block hits — exclude top face
  const movableMeshes = state.movables.map(mv => mv.mesh);
  const hits = raycaster.intersectObjects(movableMeshes, true);
  if (hits.length === 0) return;

  // Filter out hits on the top face of the main block body
  const validHit = hits.find(h => {
    // If hit is on the block body, check the face normal
    if (h.object.userData.isBlockBody && h.face) {
      // Top face normal in local space points up (0, 1, 0)
      const ny = h.face.normal.y;
      if (ny > 0.9) return false; // skip top face
    }
    return true;
  });
  if (!validHit) return;

  // Find which movable was hit
  let hitObj = validHit.object;
  while (hitObj && !hitObj.userData.isMovable) hitObj = hitObj.parent;
  if (!hitObj) return;

  const mvIdx = hitObj.userData.movableIndex;
  const mv = state.movables[mvIdx];
  if (!mv) return;

  state.dragging = mv;
  state._dragStartMouse = { x: e.clientX, y: e.clientY };
  state._dragStartPos = { x: mv.currentX, y: mv.currentY, z: mv.currentZ };
  state._didDrag = false;
  state._playerRiding = isPlayerOnMovable(mv);

  // Create drag plane perpendicular to camera
  if (state.dragPlane) scene.remove(state.dragPlane);
  const planeGeo = new THREE.PlaneGeometry(200, 200);
  const planeMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  state.dragPlane = new THREE.Mesh(planeGeo, planeMat);

  // Orient plane based on drag axis
  if (mv.data.axis === 'x') {
    // Horizontal plane at the block's y for x-axis dragging
    state.dragPlane.rotation.x = -Math.PI / 2;
    state.dragPlane.position.set(0, mv.currentY * cellSize, mv.currentZ * cellSize);
  } else if (mv.data.axis === 'y') {
    // Vertical plane facing camera for y-axis (up/down) dragging
    // Camera is at (20,20,20) looking at origin, so plane faces camera direction
    state.dragPlane.lookAt(camera.position);
    state.dragPlane.position.set(mv.currentX * cellSize, mv.currentY * cellSize, mv.currentZ * cellSize);
  } else {
    // Horizontal plane at the block's y for z-axis dragging
    state.dragPlane.rotation.x = -Math.PI / 2;
    state.dragPlane.position.set(mv.currentX * cellSize, mv.currentY * cellSize, 0);
  }
  scene.add(state.dragPlane);

  canvas.style.cursor = 'grabbing';
  e.preventDefault();
}

function isPlayerOnMovable(mv) {
  if (!state.player) return false;
  const pg = state.player.gridPos;
  const surfY = (mv.data.axis === 'y' ? mv.currentY : mv.data.y) + (mv.data.h || 1);
  return Math.round(mv.currentX) === pg.x
      && Math.round(surfY) === pg.y
      && Math.round(mv.currentZ) === pg.z;
}

function updatePlayerOnMovable(mv) {
  if (!state.player || !state._playerRiding) return;
  const s = cellSize;
  const player = state.player;

  // Mark the player as riding — this prevents the idle bob from overriding position
  player.ridingBlock = true;
  player.moving = false;
  player.path = [];

  // The group.position.y is the base of the block in world space.
  // Inside the group, the box mesh sits at local y = h/2, so the
  // block top in world space = group.position.y + h (full height).
  const blockH = (mv.data.h || 1) * s;
  const blockTopY = mv.mesh.position.y + blockH;
  // Player sphere radius is 0.25 * s — place center just above the surface
  const playerRadius = 0.25 * s;

  player.mesh.position.x = mv.mesh.position.x;
  player.mesh.position.y = blockTopY + playerRadius;
  player.mesh.position.z = mv.mesh.position.z;

  // Keep scale and rotation neutral while riding
  player.mesh.scale.set(1, 1, 1);
  player.mesh.rotation.set(0, 0, 0);
}

function onPointerMove(e) {
  if (!state.dragging) return;

  const mv = state.dragging;
  const s = cellSize;

  const mouse = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObject(state.dragPlane);
  if (hits.length === 0) return;

  const point = hits[0].point;
  state._didDrag = true;

  if (mv.data.axis === 'x') {
    let gx = point.x / s;
    gx = Math.max(mv.data.range[0], Math.min(mv.data.range[1], gx));
    mv.currentX = gx;
    mv.mesh.position.x = gx * s;
  } else if (mv.data.axis === 'y') {
    let gy = point.y / s;
    gy = Math.max(mv.data.range[0], Math.min(mv.data.range[1], gy));
    mv.currentY = gy;
    mv.mesh.position.y = gy * s;
  } else {
    let gz = point.z / s;
    gz = Math.max(mv.data.range[0], Math.min(mv.data.range[1], gz));
    mv.currentZ = gz;
    mv.mesh.position.z = gz * s;
  }

  // Move player along with the block if they're riding it
  updatePlayerOnMovable(mv);
}

function onPointerUp(e) {
  if (!state.dragging) return;

  const mv = state.dragging;
  const s = cellSize;

  // Snap to nearest integer grid position
  if (mv.data.axis === 'x') {
    mv.currentX = Math.round(mv.currentX);
    mv.currentX = Math.max(mv.data.range[0], Math.min(mv.data.range[1], mv.currentX));
    mv.mesh.position.x = mv.currentX * s;
  } else if (mv.data.axis === 'y') {
    mv.currentY = Math.round(mv.currentY);
    mv.currentY = Math.max(mv.data.range[0], Math.min(mv.data.range[1], mv.currentY));
    mv.mesh.position.y = mv.currentY * s;
  } else {
    mv.currentZ = Math.round(mv.currentZ);
    mv.currentZ = Math.max(mv.data.range[0], Math.min(mv.data.range[1], mv.currentZ));
    mv.mesh.position.z = mv.currentZ * s;
  }

  // Settle player to final snapped position on release
  if (state._playerRiding && state.player) {
    const player = state.player;

    // Compute final grid position from the snapped block
    const blockH = mv.data.h || 1;
    const surfYGrid = (mv.data.axis === 'y' ? mv.currentY : mv.data.y) + blockH;
    player.gridPos = {
      x: Math.round(mv.currentX),
      y: Math.round(surfYGrid),
      z: Math.round(mv.currentZ)
    };

    // Place player exactly on top of the snapped block
    // group.position.y is the base; block top = base + full height
    const blockTopY = mv.mesh.position.y + blockH * s;
    const playerRadius = 0.25 * s;
    player.mesh.position.set(mv.mesh.position.x, blockTopY + playerRadius, mv.mesh.position.z);
    player.mesh.scale.set(1, 1, 1);
    player.mesh.rotation.set(0, 0, 0);

    // Trigger landing bounce + dust
    player.landing = true;
    player.squashTime = 0;
    player.ridingBlock = false;
    player.moving = false;
    player.path = [];
    player.spawnDustPuff(player.mesh.position);
  }

  // Clean up
  if (state.dragPlane) { scene.remove(state.dragPlane); state.dragPlane = null; }
  if (state._didDrag) state._justDragged = true;
  state._playerRiding = false;
  state.dragging = null;
  canvas.style.cursor = 'default';
}

let _resizeTimer = null;
function onResize() {
  // Debounce resize to avoid setSize during an in-flight WebGPU frame
  if (_resizeTimer) clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    _resizeTimer = null;
    const aspect = window.innerWidth / window.innerHeight;
    const d = 10;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, 100);
}

function setupUI() {
  document.getElementById('btn-edit').addEventListener('click', () => {
    editMode = true;
    document.getElementById('btn-edit').classList.add('active');
    document.getElementById('btn-play').classList.remove('active');
    document.getElementById('editor-panel').classList.add('visible');
    document.getElementById('height-control').classList.add('visible');
    if (state.player) { scene.remove(state.player.mesh); state.player = null; }
    orbitControls.enabled = true;
    // Reset Y level
    EditorController.currentYLevel = 0;
    showGrid();
    updateGridPlaneLevel();
    toast('Editor — ▲▼ keys change level, right-click orbit');
  });

  document.getElementById('btn-play').addEventListener('click', () => {
    editMode = false;
    document.getElementById('btn-play').classList.add('active');
    document.getElementById('btn-edit').classList.remove('active');
    document.getElementById('editor-panel').classList.remove('visible');
    document.getElementById('height-control').classList.remove('visible');
    document.getElementById('movable-panel').classList.remove('visible');
    orbitControls.enabled = false;
    // Reset camera to default isometric position
    camera.position.set(20, 20, 20);
    camera.zoom = 1.3;
    camera.updateProjectionMatrix();
    orbitControls.target.set(0, 2, 0);
    orbitControls.update();
    hideGrid();
    rebuildScene();
    toast('Play mode');
  });

  document.querySelectorAll('.editor-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.editor-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      EditorController.currentTool = btn.dataset.tool;
      // Show/hide movable range panel based on tool
      const mvPanel = document.getElementById('movable-panel');
      if (EditorController.isMovableTool(btn.dataset.tool)) {
        mvPanel.classList.add('visible');
      } else {
        mvPanel.classList.remove('visible');
      }
    });
  });

  document.getElementById('h-up').addEventListener('click', () => {
    EditorController.currentHeight = Math.min(EditorController.currentHeight + 1, 8);
    document.getElementById('height-val').textContent = EditorController.currentHeight;
  });
  document.getElementById('h-down').addEventListener('click', () => {
    EditorController.currentHeight = Math.max(EditorController.currentHeight - 1, 1);
    document.getElementById('height-val').textContent = EditorController.currentHeight;
  });

  // Movable range inputs
  document.getElementById('mv-min').addEventListener('change', (e) => {
    EditorController.mvMin = parseInt(e.target.value) || -3;
  });
  document.getElementById('mv-max').addEventListener('change', (e) => {
    EditorController.mvMax = parseInt(e.target.value) || 3;
  });

  // Y Level is now controlled only by Arrow Up/Down keys (no UI buttons)

  // Keyboard shortcuts for editor — Arrow Up/Down to move the grid plane up/down
  window.addEventListener('keydown', (e) => {
    if (!editMode) return;
    if (e.target.tagName === 'INPUT') return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        EditorController.currentYLevel = Math.min(EditorController.currentYLevel + 1, 12);
        updateGridPlaneLevel();
        break;
      case 'ArrowDown':
        e.preventDefault();
        EditorController.currentYLevel = Math.max(EditorController.currentYLevel - 1, -6);
        updateGridPlaneLevel();
        break;
    }
  });

  // Snippet button — show level code modal
  document.getElementById('btn-snippet').addEventListener('click', () => {
    const ld = state.levelData;
    const snippet = {
      name: ld.name || 'Untitled',
      target: ld.target || { x: 0, y: 0, z: 0 },
      playerStart: ld.playerStart || { x: 0, y: 1, z: 0 },
      blocks: ld.blocks.map(b => {
        const o = { x: b.x, y: b.y, z: b.z, h: b.h, type: b.type };
        if (b.angle) o.angle = b.angle;
        return o;
      }),
    };
    if (ld.theme) snippet.theme = ld.theme;
    if (ld.movables && ld.movables.length > 0) {
      snippet.movables = ld.movables;
    }
    if (ld.teleports && ld.teleports.length > 0) {
      snippet.teleports = ld.teleports;
    }
    // Include any other custom properties
    const knownKeys = ['name', 'target', 'playerStart', 'blocks', 'theme', 'movables', 'teleports'];
    for (const key of Object.keys(ld)) {
      if (!knownKeys.includes(key) && ld[key] !== undefined) {
        snippet[key] = ld[key];
      }
    }
    const code = JSON.stringify(snippet, null, 2);
    document.getElementById('snippet-code').value = code;
    document.getElementById('snippet-modal').style.display = 'flex';
  });

  document.getElementById('snippet-close').addEventListener('click', () => {
    document.getElementById('snippet-modal').style.display = 'none';
  });

  document.getElementById('snippet-copy').addEventListener('click', () => {
    const textarea = document.getElementById('snippet-code');
    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
      toast('Copied to clipboard!');
    }).catch(() => {
      document.execCommand('copy');
      toast('Copied!');
    });
  });

  // Close modal on backdrop click
  document.getElementById('snippet-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('snippet-modal')) {
      document.getElementById('snippet-modal').style.display = 'none';
    }
  });

  // Rotate button is now handled by the generic data-tool loop above

  document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      loadLevel(parseInt(btn.dataset.level));
    });
  });
}

// ─── Debug UI ───
function setupDebugUI() {
  // Start with debug hidden
  document.getElementById('debug-panel').classList.remove('visible');
  document.getElementById('perf-panel').classList.remove('visible');
  document.getElementById('btn-debug').classList.remove('active');

  document.getElementById('btn-debug').addEventListener('click', () => {
    debugOpen = !debugOpen;
    document.getElementById('debug-panel').classList.toggle('visible', debugOpen);
    document.getElementById('perf-panel').classList.toggle('visible', debugOpen);
    document.getElementById('btn-debug').classList.toggle('active', debugOpen);
  });

  // Y Top (fog clear height)
  const fogYInput = document.getElementById('fog-y');
  const fogYVal = document.getElementById('fog-y-val');
  fogYInput.addEventListener('input', () => {
    fogConfig.yTop = parseFloat(fogYInput.value);
    fogYVal.textContent = fogConfig.yTop.toFixed(1);
    fogConfig.uFogTop.value = fogConfig.yTop;
  });

  // Y Bottom (fog full height)
  const fogDepthInput = document.getElementById('fog-depth');
  const fogDepthVal = document.getElementById('fog-depth-val');
  fogDepthInput.addEventListener('input', () => {
    fogConfig.yBottom = parseFloat(fogDepthInput.value);
    fogDepthVal.textContent = fogConfig.yBottom.toFixed(1);
    fogConfig.uFogBottom.value = fogConfig.yBottom;
  });

  // Density
  const fogDensityInput = document.getElementById('fog-density');
  const fogDensityVal = document.getElementById('fog-density-val');
  fogDensityInput.addEventListener('input', () => {
    fogConfig.density = parseFloat(fogDensityInput.value);
    fogDensityVal.textContent = fogConfig.density.toFixed(2);
    fogConfig.uFogDensity.value = fogConfig.density;
  });

  // Color
  const fogColorInput = document.getElementById('fog-color');
  const fogColorVal = document.getElementById('fog-color-val');
  const bgColorInput = document.getElementById('bg-color');
  const bgColorVal = document.getElementById('bg-color-val');
  const fogBgLinkBtn = document.getElementById('fog-bg-link');
  let fogBgLinked = true;

  fogBgLinkBtn.addEventListener('click', () => {
    fogBgLinked = !fogBgLinked;
    fogBgLinkBtn.classList.toggle('linked', fogBgLinked);
    fogBgLinkBtn.title = fogBgLinked ? 'Fog & background linked' : 'Fog & background independent';
    if (fogBgLinked) {
      // Sync background to current fog color
      const hex = fogColorInput.value;
      bgColorInput.value = hex;
      bgColorVal.textContent = hex;
      scene.background.set(hex);
      renderer.setClearColor(hex, 1);
      document.body.style.background = hex;
    }
  });

  fogColorInput.addEventListener('input', () => {
    const hex = fogColorInput.value;
    fogColorVal.textContent = hex;
    fogConfig.color.set(hex);
    fogConfig.uFogColor.value.copy(fogConfig.color);
    if (fogBgLinked) {
      scene.background.copy(fogConfig.color);
      renderer.setClearColor(fogConfig.color, 1);
      document.body.style.background = hex;
      bgColorInput.value = hex;
      bgColorVal.textContent = hex;
    }
  });

  // Side color (secondary / teal)
  const sideColorInput = document.getElementById('brick-side-color');
  const sideColorVal = document.getElementById('brick-side-color-val');
  sideColorInput.addEventListener('input', () => {
    const hex = sideColorInput.value;
    sideColorVal.textContent = hex;
    const c = parseInt(hex.replace('#', ''), 16);
    PALETTE.blockSide = c;
    PALETTE.stair = c;
    // Derive darker variant for blockDark, accent, accentDark
    const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
    const dark = ((Math.max(0, r - 32) << 16) | (Math.max(0, g - 32) << 8) | Math.max(0, b - 32));
    PALETTE.blockDark = dark;
    PALETTE.accent = c;
    PALETTE.accentDark = dark;
    // Slightly lighter for pillar
    const pr = Math.min(255, r + 16), pg = Math.min(255, g + 4), pb = Math.min(255, b - 12);
    PALETTE.pillar = (pr << 16) | (pg << 8) | Math.max(0, pb);
    updatePaletteColors(['blockSide', 'stair', 'blockDark', 'accent', 'accentDark', 'pillar']);
  });

  // Window color
  const winColorInput = document.getElementById('brick-window-color');
  const winColorVal = document.getElementById('brick-window-color-val');
  winColorInput.addEventListener('input', () => {
    const hex = winColorInput.value;
    winColorVal.textContent = hex;
    PALETTE.window = parseInt(hex.replace('#', ''), 16);
    updatePaletteColors(['window']);
  });

  // Top color (blockTop)
  const topColorInput = document.getElementById('brick-top-color');
  const topColorVal = document.getElementById('brick-top-color-val');
  topColorInput.addEventListener('input', () => {
    const hex = topColorInput.value;
    topColorVal.textContent = hex;
    const c = parseInt(hex.replace('#', ''), 16);
    PALETTE.blockTop = c;
    // Also update arch which uses a similar warm tone derived from top
    const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
    const ar = Math.max(0, r - 20), ag = Math.max(0, g - 40), ab = Math.max(0, b - 30);
    PALETTE.arch = (ar << 16) | (ag << 8) | ab;
    updatePaletteColors(['blockTop', 'arch']);
  });

  // Accent color (cream / decorative bands)
  const accentColorInput = document.getElementById('brick-accent-color');
  const accentColorVal = document.getElementById('brick-accent-color-val');
  accentColorInput.addEventListener('input', () => {
    const hex = accentColorInput.value;
    accentColorVal.textContent = hex;
    PALETTE.cream = parseInt(hex.replace('#', ''), 16);
    updatePaletteColors(['cream']);
  });

  // Dome color
  const domeColorInput = document.getElementById('brick-dome-color');
  const domeColorVal = document.getElementById('brick-dome-color-val');
  domeColorInput.addEventListener('input', () => {
    const hex = domeColorInput.value;
    domeColorVal.textContent = hex;
    PALETTE.dome = parseInt(hex.replace('#', ''), 16);
    updatePaletteColors(['dome']);
  });

  // Shadow color — controls the ambient light color which tints shadow areas
  const shadowColorInput = document.getElementById('shadow-color');
  const shadowColorVal = document.getElementById('shadow-color-val');
  shadowColorInput.addEventListener('input', () => {
    const hex = shadowColorInput.value;
    shadowColorVal.textContent = hex;
    const ambientLight = scene.getObjectByName('ambientLight');
    if (ambientLight) ambientLight.color.set(hex);
  });

  // Shadow strength — controls ambient light intensity (lower = darker shadows)
  const shadowStrengthInput = document.getElementById('shadow-strength');
  const shadowStrengthVal = document.getElementById('shadow-strength-val');
  shadowStrengthInput.addEventListener('input', () => {
    const val = parseFloat(shadowStrengthInput.value);
    shadowStrengthVal.textContent = val.toFixed(2);
    const ambientLight = scene.getObjectByName('ambientLight');
    if (ambientLight) ambientLight.intensity = val;
  });

  // Cloud color — updates cloud materials in-place without rebuilding
  const cloudColorInput = document.getElementById('cloud-color');
  const cloudColorVal = document.getElementById('cloud-color-val');
  cloudColorInput.addEventListener('input', () => {
    const hex = cloudColorInput.value;
    cloudColorVal.textContent = hex;
    const c = parseInt(hex.replace('#', ''), 16);
    state.cloudColor = c;
    // Update existing cloud materials in-place
    if (state.windClouds) {
      state.windClouds.traverse(child => {
        if (child.isMesh && child.name.startsWith('cloudPuff_')) {
          child.material.color.setHex(c);
        }
      });
    }
  });

  // Movable block color — updates materials in-place without rebuilding
  const movableColorInput = document.getElementById('movable-color');
  const movableColorVal = document.getElementById('movable-color-val');
  movableColorInput.addEventListener('input', () => {
    const hex = movableColorInput.value;
    movableColorVal.textContent = hex;
    const c = parseInt(hex.replace('#', ''), 16);
    state.movableColor = c;
    // Derive side color from chosen color (same formula as buildMovables)
    const mr = (c >> 16) & 0xff, mg = (c >> 8) & 0xff, mb = c & 0xff;
    const sideR = Math.max(0, mr - 54), sideG = Math.min(255, mg + 4), sideB = Math.min(255, mb + 12);
    const sideHex = (sideR << 16) | (sideG << 8) | sideB;
    // Update all registered movableTop / movableSide materials
    const topSet = _paletteMats.get('movableTop');
    if (topSet) topSet.forEach(mat => {
      if (mat.color) mat.color.setHex(c);
      if (mat._baseColorUniform && mat._baseColorUniform.value) mat._baseColorUniform.value.setHex(c);
    });
    const sideSet = _paletteMats.get('movableSide');
    if (sideSet) sideSet.forEach(mat => {
      if (mat.color) mat.color.setHex(sideHex);
      if (mat._baseColorUniform && mat._baseColorUniform.value) mat._baseColorUniform.value.setHex(sideHex);
    });
  });

  // Background color
  bgColorInput.addEventListener('input', () => {
    const hex = bgColorInput.value;
    bgColorVal.textContent = hex;
    scene.background.set(hex);
    renderer.setClearColor(hex, 1);
    document.body.style.background = hex;
    if (fogBgLinked) {
      fogColorInput.value = hex;
      fogColorVal.textContent = hex;
      fogConfig.color.set(hex);
      fogConfig.uFogColor.value.copy(fogConfig.color);
    }
  });

  // Ground Y position
  const groundYInput = document.getElementById('ground-y');
  const groundYVal = document.getElementById('ground-y-val');
  groundYInput.addEventListener('input', () => {
    const y = parseFloat(groundYInput.value);
    groundYVal.textContent = y.toFixed(1);
    if (state.groundPlane) {
      state.groundPlane.position.y = y;
    }
    if (state.waterOcean) {
      state.waterOcean.position.y = y;
    }
  });

  // Ground Color
  const groundColorInput = document.getElementById('ground-color');
  const groundColorVal = document.getElementById('ground-color-val');
  groundColorInput.addEventListener('input', () => {
    const hex = groundColorInput.value;
    groundColorVal.textContent = hex;
    if (fogConfig.uGroundColor) {
      fogConfig.uGroundColor.value.set(hex);
    }
  });

  // Ground Opacity
  const groundOpacityInput = document.getElementById('ground-opacity');
  const groundOpacityVal = document.getElementById('ground-opacity-val');
  groundOpacityInput.addEventListener('input', () => {
    const v = parseFloat(groundOpacityInput.value);
    groundOpacityVal.textContent = v.toFixed(2);
    if (fogConfig.uGroundOpacity) {
      fogConfig.uGroundOpacity.value = v;
    }
  });
}

function setupCellSizeUI() {
  const sizeInput = document.getElementById('cell-size');
  const sizeVal = document.getElementById('cell-size-val');
  sizeInput.value = cellSize.toFixed(2);
  sizeVal.textContent = cellSize.toFixed(2);

  let sizeTimeout = null;
  sizeInput.addEventListener('input', () => {
    cellSize = parseFloat(sizeInput.value);
    sizeVal.textContent = cellSize.toFixed(2);
    window.CELL_SIZE = cellSize;
    // Debounce rebuild to avoid lag while dragging
    if (sizeTimeout) clearTimeout(sizeTimeout);
    sizeTimeout = setTimeout(() => rebuildScene(), 80);
  });
}

// ─── Editor cursor helper + drag-to-move ───
let _editorLastGX = 0;
let _editorLastGZ = 0;

function setupEditorCursor() {
  const cursorEl = document.getElementById('grid-cursor');
  const gcX = document.getElementById('gc-x');
  const gcZ = document.getElementById('gc-z');
  const gcY = document.getElementById('gc-y');

  // Highlight mesh that follows the mouse on the grid
  const hlGeo = new THREE.BoxGeometry(1, 0.08, 1);
  const hlMat = new THREE.MeshStandardMaterial({
    color: 0x5ec4b6, roughness: 0.5, transparent: true, opacity: 0.45
  });
  const hlMesh = new THREE.Mesh(hlGeo, hlMat);
  hlMesh.name = 'editorCursorHL';
  hlMesh.visible = false;
  scene.add(hlMesh);

  // Shadow helper projected on the ground (y=0) plane
  const shGeo = new THREE.BoxGeometry(1, 0.04, 1);
  const shMat = new THREE.MeshStandardMaterial({
    color: 0x5ec4b6, roughness: 0.5, transparent: true, opacity: 0.18
  });
  const shMesh = new THREE.Mesh(shGeo, shMat);
  shMesh.name = 'editorCursorShadow';
  shMesh.visible = false;
  scene.add(shMesh);

  // Vertical dashed line connecting cursor to shadow
  const lineGeo = new THREE.BoxGeometry(0.03, 1, 0.03);
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0x5ec4b6, roughness: 0.5, transparent: true, opacity: 0.2
  });
  const lineMesh = new THREE.Mesh(lineGeo, lineMat);
  lineMesh.name = 'editorCursorLine';
  lineMesh.visible = false;
  scene.add(lineMesh);

  // Drag state for editor
  let edDragging = null;   // { blockIdx, startGX, startGZ }
  let edDragPlane = null;

  // Pure math plane for raycasting — no mesh needed, works reliably with WebGPU
  const _rcRaycaster = new THREE.Raycaster();
  const _rcMathPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const _rcIntersect = new THREE.Vector3();

  function editorRayToGrid(e) {
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    _rcRaycaster.setFromCamera(mouse, camera);
    // Set the plane at the current Y level: plane normal is (0,1,0), constant = -yLevel*cellSize
    // THREE.Plane equation: normal.dot(point) + constant = 0
    // For y = h: (0,1,0).dot(p) + constant = 0 → constant = -h
    _rcMathPlane.constant = -EditorController.currentYLevel * cellSize;
    const hit = _rcRaycaster.ray.intersectPlane(_rcMathPlane, _rcIntersect);
    if (!hit) return null;
    return _rcIntersect;
  }

  canvas.addEventListener('pointermove', (e) => {
    if (!editMode) {
      hlMesh.visible = false;
      cursorEl.classList.remove('visible');
      return;
    }

    const s = cellSize;
    const point = editorRayToGrid(e);
    if (!point) return;

    const gx = Math.round(point.x / s);
    const gz = Math.round(point.z / s);
    const yLevel = EditorController.currentYLevel;

    // Track last cursor grid position
    _editorLastGX = gx;
    _editorLastGZ = gz;

    // Find block at this grid pos for display
    const block = state.levelData.blocks.find(b => b.x === gx && b.z === gz && b.y === yLevel);

    gcX.textContent = gx;
    gcZ.textContent = gz;
    gcY.textContent = yLevel;
    cursorEl.classList.add('visible');

    // Update highlight — sits on the grid plane at the current Y level
    hlMesh.scale.set(s, 1, s);
    hlMesh.position.set(gx * s, yLevel * s + 0.04, gz * s);
    hlMesh.visible = true;

    // Update ground shadow helper (only when Y level ≠ 0)
    const shMeshHover = scene.getObjectByName('editorCursorShadow');
    if (shMeshHover) {
      shMeshHover.scale.set(s, 1, s);
      shMeshHover.position.set(gx * s, 0.02, gz * s);
      shMeshHover.visible = yLevel !== 0;
    }

    // Update vertical connecting line
    const lineMeshHover = scene.getObjectByName('editorCursorLine');
    if (lineMeshHover) {
      const cursorYPos = yLevel * s + 0.04;
      const groundYPos = 0.02;
      const lineHeight = Math.abs(cursorYPos - groundYPos);
      lineMeshHover.scale.set(1, lineHeight > 0.01 ? lineHeight : 0.01, 1);
      lineMeshHover.position.set(gx * s, (cursorYPos + groundYPos) / 2, gz * s);
      lineMeshHover.visible = yLevel !== 0;
    }

    // If dragging a block, move it
    if (edDragging) {
      const bi = edDragging.blockIdx;
      const b = state.levelData.blocks[bi];
      if (b && (b.x !== gx || b.z !== gz)) {
        const ops = window._editorOps;
        if (ops) {
          ops.moveBlockFast(bi, gx, gz);
        }
        edDragging.lastGX = gx;
        edDragging.lastGZ = gz;
      }
    }
  });

  // Pointer down in edit mode — check if clicking an existing block to drag
  canvas.addEventListener('pointerdown', (e) => {
    if (!editMode) return;
    if (!e.shiftKey) return;

    const s = cellSize;
    const point = editorRayToGrid(e);
    if (!point) return;
    const gx = Math.round(point.x / s);
    const gz = Math.round(point.z / s);
    const useY = EditorController.currentYLevel;

    const bi = state.levelData.blocks.findIndex(b => b.x === gx && b.z === gz && b.y === useY);
    if (bi === -1) return;

    edDragging = { blockIdx: bi, startGX: gx, startGZ: gz, lastGX: gx, lastGZ: gz };
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
    e.stopPropagation();
  });

  canvas.addEventListener('pointerup', () => {
    if (edDragging) {
      edDragging = null;
      canvas.style.cursor = 'default';
    }
  });

  // Hide cursor when leaving edit mode
  const origPlay = document.getElementById('btn-play');
  origPlay.addEventListener('click', () => {
    hlMesh.visible = false;
    const shMeshPlay = scene.getObjectByName('editorCursorShadow');
    if (shMeshPlay) shMeshPlay.visible = false;
    const lineMeshPlay = scene.getObjectByName('editorCursorLine');
    if (lineMeshPlay) lineMeshPlay.visible = false;
    cursorEl.classList.remove('visible');
    edDragging = null;
  });
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1500);
}

// ─── Animation Loop ───
function animate() {
  // Skip rendering when tab is hidden to prevent stale WebGPU swap-chain errors
  if (window._isTabVisible && !window._isTabVisible()) {
    clock.getDelta(); // keep clock ticking to avoid huge dt spike on return
    return;
  }
  const dt = clock.getDelta();
  const now = performance.now();

  if (state.player) state.player.update(dt);

  if (editMode) {
    // Edit mode — orbit controls handle camera
    orbitControls.update();
  } else {
    // Gentle camera sway
    const t = clock.getElapsedTime();
    camera.position.x = 20 + Math.sin(t * 0.1) * 0.3;
    camera.position.z = 20 + Math.cos(t * 0.15) * 0.3;
    camera.lookAt(0, 2, 0);

    // Animate target diamond
    animateTargetDiamond(t);

    // Animate teleport pads
    animateTeleportPads(t);

    // Rotate star field slowly
    if (state.starField) {
      state.starField.rotation.y = t * 0.01;
      state.starField.rotation.x = Math.sin(t * 0.005) * 0.02;
    }

    // Animate wind & clouds
    animateWindAndClouds(t);

    // Animate ocean environment
    animateOceanEnvironment(t);

    // Check if player reached the diamond
    checkTargetReached();

    // Check teleport pads
    checkTeleportPads();
  }

  const renderStart = performance.now();
  renderer.render(scene, camera);
  const renderEnd = performance.now();

  // Perf metering
  frameCount++;
  gpuAccum += (renderEnd - renderStart);
  gpuFrames++;

  if (now - lastFpsUpdate >= 500) {
    const elapsed = (now - lastFpsUpdate) / 1000;
    const fps = Math.round(frameCount / elapsed);
    const avgGpu = gpuFrames > 0 ? (gpuAccum / gpuFrames) : 0;

    document.getElementById('fps-val').textContent = fps;
    document.getElementById('gpu-val').textContent = avgGpu.toFixed(1) + ' ms';

    frameCount = 0;
    lastFpsUpdate = now;
    gpuAccum = 0;
    gpuFrames = 0;
  }
}

init();