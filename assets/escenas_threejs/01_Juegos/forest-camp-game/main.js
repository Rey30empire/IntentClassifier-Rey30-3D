// ══════════════════════════════════════════════
// MAIN — Entry point, game loop
// ══════════════════════════════════════════════

import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createRenderer,
  createScene,
  createCamera,
  loadHDR,
  setupLighting,
  setupPostProcessing,
} from './env-settings.js';
import { buildScene } from './scene.js';
import { TILE_SIZE, TILE_GAP, setTileSize, setTileGap } from './grid.js';
import { TILE_COLORS, setTileColor } from './tile.js';
import { Game } from './game.js';

// ══════════════════════════════════════════════
// ── INIT (async for WebGPU) ──
// ══════════════════════════════════════════════

(async () => {
  // ── Renderer ──
  const renderer = await createRenderer();

  // ── Scene ──
  const scene = createScene();

  // ── Camera ──
  const camera = createCamera();
  camera.position.set(-6.1, 6.7, 5.2);
  camera.lookAt(0, 0, 0);

  // ── Controls ──
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5.0;
  controls.maxDistance = 20.0;
  controls.maxPolarAngle = Math.PI / 2.5;
  controls.minPolarAngle = Math.PI / 6;
  controls.target.set(0, 0, 0);
  controls.enablePan = false;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.3;

  // ── Lighting ──
  const lights = setupLighting(scene);

  // ── HDR Environment ──
  loadHDR(scene);

  // ── Build Scene ──
  let sceneState = buildScene(scene);

  // ── Game ──
  let game = new Game(scene, sceneState.grid, sceneState.boardPath, sceneState.animatedObjects);

  // Rebuild helper — removes old scene objects and rebuilds
  function rebuildBoard() {
    // Keep only lights, camera, and renderer-internal objects
    const keepNames = new Set(['ambientLight', 'sunLight', 'fillLight']);
    const toRemove = [];
    scene.children.forEach((child) => {
      if (!keepNames.has(child.name) && !child.isLight) {
        toRemove.push(child);
      }
    });
    toRemove.forEach((obj) => {
      obj.removeFromParent();
      if (obj.traverse) obj.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else if (!c.material._shared) c.material.dispose();
        }
      });
    });
    // Clear tile geometry cache
    if (window.__clearTileGeoCache) window.__clearTileGeoCache();
    sceneState = buildScene(scene);
    game = new Game(scene, sceneState.grid, sceneState.boardPath, sceneState.animatedObjects);
  }

  // ── Wire roll-dice button ──
  const rollBtn = document.querySelector('.roll-btn');
  if (rollBtn) {
    rollBtn.addEventListener('click', () => {
      if (game) game.rollDiceFromButton();
    });
  }

  // ── Post-Processing ──
  const { renderPipeline } = setupPostProcessing(renderer, scene, camera);

  // ══════════════════════════════════════════════
  // ── ENV GUI ──
  // ══════════════════════════════════════════════

  buildEnvGUI(renderer, scene, camera, lights, controls, rebuildBoard);

  // ══════════════════════════════════════════════
  // ── ANIMATION LOOP ──
  // ══════════════════════════════════════════════

  const timer = new THREE.Timer();
  const _charWorldPos = new THREE.Vector3(); // reuse — avoid per-frame allocation

  renderer.setAnimationLoop(() => {
    timer.update();
    const time = timer.getElapsed();

    const objs = sceneState.animatedObjects;
    for (let i = 0, n = objs.length; i < n; i++) {
      const fn = objs[i].userData.animate;
      if (fn) fn(time);
    }

    // Update game logic
    if (game) game.update(time);

    // Camera follows the player character
    if (game && game.character) {
      game.character.getWorldPosition(_charWorldPos);
      controls.target.lerp(_charWorldPos, 0.08);
    }

    controls.update();
    renderPipeline.render();
  });

  // ── Resize ──
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

// ══════════════════════════════════════════════
// ── GUI BUILDER ──
// ══════════════════════════════════════════════

function buildEnvGUI(renderer, scene, camera, lights, controls, rebuildBoard) {
  const gui = document.getElementById('env-gui');
  if (!gui) return;

  // Helpers
  function toHex(c) {
    return '#' + new THREE.Color(c).getHexString();
  }

  let rowId = 0;
  function slider(parent, label, val, min, max, step, onChange) {
    const id = 'gui-s-' + (rowId++);
    const row = document.createElement('div');
    row.className = 'gui-row';
    const valDisplay = document.createElement('span');
    valDisplay.className = 'val';
    valDisplay.textContent = val.toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 1);
    row.innerHTML = `<label for="${id}">${label}</label><div class="ctrl"></div>`;
    const input = document.createElement('input');
    input.type = 'range'; input.id = id;
    input.min = min; input.max = max; input.step = step; input.value = val;
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      valDisplay.textContent = v.toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 1);
      onChange(v);
    });
    row.querySelector('.ctrl').appendChild(input);
    row.querySelector('.ctrl').appendChild(valDisplay);
    parent.appendChild(row);
    return input;
  }

  function colorPicker(parent, label, hex, onChange) {
    const id = 'gui-c-' + (rowId++);
    const row = document.createElement('div');
    row.className = 'gui-row';
    row.innerHTML = `<label for="${id}">${label}</label><div class="ctrl"></div>`;
    const input = document.createElement('input');
    input.type = 'color'; input.id = id; input.value = hex;
    input.addEventListener('input', () => onChange(input.value));
    row.querySelector('.ctrl').appendChild(input);
    parent.appendChild(row);
    return input;
  }

  function checkbox(parent, label, checked, onChange) {
    const id = 'gui-cb-' + (rowId++);
    const row = document.createElement('div');
    row.className = 'gui-row';
    row.innerHTML = `<label for="${id}">${label}</label><div class="ctrl"></div>`;
    const input = document.createElement('input');
    input.type = 'checkbox'; input.id = id; input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    row.querySelector('.ctrl').appendChild(input);
    parent.appendChild(row);
    return input;
  }

  function dropdown(parent, label, options, current, onChange) {
    const id = 'gui-dd-' + (rowId++);
    const row = document.createElement('div');
    row.className = 'gui-row';
    row.innerHTML = `<label for="${id}">${label}</label><div class="ctrl"></div>`;
    const select = document.createElement('select');
    select.id = id;
    options.forEach(([val, text]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = text;
      if (val == current) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => onChange(select.value));
    row.querySelector('.ctrl').appendChild(select);
    parent.appendChild(row);
    return select;
  }

  function makeSection(body, title, open = true) {
    const section = document.createElement('div');
    section.className = 'gui-section';
    const titleEl = document.createElement('div');
    titleEl.className = 'section-title' + (open ? '' : ' closed');
    titleEl.innerHTML = `<span class="s-arrow">▼</span>${title}`;
    const rows = document.createElement('div');
    rows.className = 'section-rows' + (open ? '' : ' hidden');
    titleEl.addEventListener('click', () => {
      titleEl.classList.toggle('closed');
      rows.classList.toggle('hidden');
    });
    section.appendChild(titleEl);
    section.appendChild(rows);
    body.appendChild(section);
    return rows;
  }

  // ── Header ──
  const header = gui.querySelector('.gui-header');
  header.addEventListener('click', () => gui.classList.toggle('collapsed'));

  const body = gui.querySelector('.gui-body');

  // ═══ TONE MAPPING ═══
  const tmRows = makeSection(body, 'Tone Mapping');
  dropdown(tmRows, 'Mode', [
    [String(THREE.NoToneMapping), 'None'],
    [String(THREE.LinearToneMapping), 'Linear'],
    [String(THREE.ReinhardToneMapping), 'Reinhard'],
    [String(THREE.CineonToneMapping), 'Cineon'],
    [String(THREE.ACESFilmicToneMapping), 'ACES Filmic'],
    [String(THREE.AgXToneMapping), 'AgX'],
    [String(THREE.NeutralToneMapping), 'Neutral'],
  ], String(renderer.toneMapping), (v) => {
    renderer.toneMapping = parseInt(v);
  });
  slider(tmRows, 'Exposure', renderer.toneMappingExposure, 0.1, 4, 0.05, (v) => {
    renderer.toneMappingExposure = v;
  });

  // ═══ SCENE ═══
  const scRows = makeSection(body, 'Scene');
  colorPicker(scRows, 'Background', toHex(scene.background), (v) => {
    scene.background.set(v);
    if (scene.fog) { scene.fog.color.set(v); }
  });
  slider(scRows, 'Fog Near', scene.fog.near, 1, 40, 0.5, (v) => { scene.fog.near = v; });
  slider(scRows, 'Fog Far', scene.fog.far, 5, 60, 0.5, (v) => { scene.fog.far = v; });
  slider(scRows, 'Env Intensity', scene.environmentIntensity, 0, 3, 0.05, (v) => {
    scene.environmentIntensity = v;
  });

  // ═══ BOARD ═══
  const boardRows = makeSection(body, 'Board');
  slider(boardRows, 'Tile Size', TILE_SIZE, 0.3, 2.0, 0.01, (v) => {
    setTileSize(v);
    rebuildBoard();
  });
  slider(boardRows, 'Tile Gap', TILE_GAP, 0.0, 0.15, 0.005, (v) => {
    setTileGap(v);
    rebuildBoard();
  });

  // ═══ TILE COLORS ═══
  const tcRows = makeSection(body, 'Tile Colors', false);
  const tileColorLabels = {
    star: 'Star',
    green: 'Green',
    blue: 'Blue',
    white: 'White',
    orange: 'Orange',
    skull: 'Skull',
    arrow: 'Arrow',
    gem: 'Gem',
    ice: 'Ice',
    portal: 'Portal',
    dice: 'Dice',
  };
  Object.keys(TILE_COLORS).forEach((type) => {
    const hex = '#' + new THREE.Color(TILE_COLORS[type]).getHexString();
    colorPicker(tcRows, tileColorLabels[type] || type, hex, (v) => {
      const newHex = parseInt(v.replace('#', ''), 16);
      setTileColor(type, newHex);
    });
  });

  // ═══ CAMERA ═══
  const camRows = makeSection(body, 'Camera', false);
  slider(camRows, 'FOV', camera.fov, 15, 90, 1, (v) => {
    camera.fov = v;
    camera.updateProjectionMatrix();
  });
  const camPosXSlider = slider(camRows, 'Pos X', camera.position.x, -20, 20, 0.1, (v) => { camera.position.x = v; });
  const camPosYSlider = slider(camRows, 'Pos Y', camera.position.y, 0, 30, 0.1, (v) => { camera.position.y = v; });
  const camPosZSlider = slider(camRows, 'Pos Z', camera.position.z, -20, 20, 0.1, (v) => { camera.position.z = v; });

  // Zoom (distance from target)
  const getZoom = () => camera.position.distanceTo(controls ? controls.target : new THREE.Vector3(0,0,0));
  const zoomSlider = slider(camRows, 'Zoom', getZoom(), 1, 25, 0.1, (v) => {
    if (!controls) return;
    const dir = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, v);
  });

  // Min / Max distance
  slider(camRows, 'Min Distance', controls ? controls.minDistance : 1, 0.5, 20, 0.5, (v) => {
    if (controls) controls.minDistance = v;
  });
  slider(camRows, 'Max Distance', controls ? controls.maxDistance : 50, 5, 50, 0.5, (v) => {
    if (controls) controls.maxDistance = v;
  });

  // Sync sliders when orbit controls move the camera
  if (controls) {
    controls.addEventListener('change', () => {
      [camPosXSlider, camPosYSlider, camPosZSlider].forEach((sl, i) => {
        const val = [camera.position.x, camera.position.y, camera.position.z][i];
        sl.value = val;
        sl.parentElement.querySelector('.val').textContent = val.toFixed(1);
      });
      // Sync zoom slider
      const dist = getZoom();
      zoomSlider.value = dist;
      zoomSlider.parentElement.querySelector('.val').textContent = dist.toFixed(1);
    });
  }

}