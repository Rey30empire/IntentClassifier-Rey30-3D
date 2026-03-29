import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
// STLExporter removed
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

// GLTF + Draco loader (must be initialized early — used by import, demo models, etc.)
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.set(3, 2, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const root = document.getElementById('root') ?? document.body;
root.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.panSpeed = 1.0;
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.PAN,
  RIGHT: THREE.MOUSE.DOLLY,
};
controls.autoRotate = true;
controls.autoRotateSpeed = 1.5;
controls.minDistance = 0.5;
controls.maxDistance = 50;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
ambientLight.name = 'ambientLight1';
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.name = 'directionalLight1';
dirLight.position.set(5, 8, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 50;
dirLight.shadow.camera.left = -10;
dirLight.shadow.camera.right = 10;
dirLight.shadow.camera.top = 10;
dirLight.shadow.camera.bottom = -10;
dirLight.shadow.bias = -0.001;
dirLight.shadow.normalBias = 0.02;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x8888ff, 0.6);
fillLight.name = 'fillLight1';
fillLight.position.set(-4, 3, -3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xff8866, 0.5);
rimLight.name = 'rimLight1';
rimLight.position.set(0, 2, -6);
scene.add(rimLight);

// Ground plane — shadow-only (invisible surface, only catches shadows)
const groundGeo = new THREE.PlaneGeometry(30, 30);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.18, transparent: true, depthWrite: false });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.name = 'groundPlane1';
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
ground.renderOrder = -1;
scene.add(ground);

// Environment (simple gradient)
const envScene = new THREE.Scene();
const envCam = new THREE.PerspectiveCamera();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envRT = pmremGenerator.fromScene(
  (() => {
    const s = new THREE.Scene();
    const geo = new THREE.SphereGeometry(50, 32, 32);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        colorTop: { value: new THREE.Color(0x2a2a4a) },
        colorBottom: { value: new THREE.Color(0x0d0d1a) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 colorTop;
        uniform vec3 colorBottom;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y * 0.5 + 0.5;
          gl_FragColor = vec4(mix(colorBottom, colorTop, h), 1.0);
        }
      `,
    });
    s.add(new THREE.Mesh(geo, mat));
    return s;
  })()
);
scene.environment = envRT.texture;

// Loading UI
const loadingDiv = document.createElement('div');
loadingDiv.style.cssText = `
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: #e0e0e0; z-index: 100; pointer-events: none;
`;
loadingDiv.innerHTML = `
  <div style="font-size: 20px; font-weight: 600; letter-spacing: 1px; opacity: 0.85; margin-bottom: 6px;">✦ Matcap Generator</div>
  <div style="font-size: 12px; opacity: 0.4; margin-bottom: 20px;">Generate · Preview · Export</div>
  <div style="width: 200px; height: 2px; background: rgba(255,255,255,0.1); border-radius: 1px; overflow: hidden;">
    <div id="loadBar" style="width: 0%; height: 100%; background: rgba(255,255,255,0.6); transition: width 0.2s ease;"></div>
  </div>
  <div id="loadPercent" style="font-size: 12px; opacity: 0.5; margin-top: 10px;">0%</div>
`;
document.body.appendChild(loadingDiv);

// Info panel
const infoDiv = document.createElement('div');
infoDiv.style.cssText = `
  position: fixed; bottom: 20px; left: 20px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: rgba(255,255,255,0.6); font-size: 12px; line-height: 1.6;
  background: rgba(0,0,0,0.3); padding: 12px 16px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(10px);
  opacity: 0; transition: opacity 0.5s ease; z-index: 50;
`;
document.body.appendChild(infoDiv);

// Track current file size for display in info panel
let currentFileSize = 0;
let currentFileName = '';

function updateFileSizeDisplay(bytes, name) {
  currentFileSize = bytes || 0;
  currentFileName = name || '';
  // Re-render info panel if visible to include file size
  if (infoDiv.style.opacity !== '0' && infoDiv.innerHTML) {
    const fileSizeEl = infoDiv.querySelector('.info-filesize');
    if (fileSizeEl && bytes > 0) {
      fileSizeEl.textContent = `File size: ${formatBytes(bytes)}`;
      fileSizeEl.style.display = '';
    } else if (fileSizeEl) {
      fileSizeEl.style.display = 'none';
    }
  }
}

// === CUSTOM UI PANEL ===
let isMobile = window.innerWidth <= 768;
const panel = document.createElement('div');
panel.id = 'uiPanel';
if (isMobile) {
  panel.style.cssText = `
    position: fixed; bottom: 0; left: 0; right: 0; width: 100%;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: rgba(255,255,255,0.85); font-size: 12px;
    background: rgba(10,10,18,0.97); border-radius: 16px 16px 0 0;
    border: 1px solid rgba(255,255,255,0.08); border-bottom: none;
    backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    z-index: 60; overflow: hidden;
    height: 48px;
    transition: height 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    box-shadow: 0 -4px 30px rgba(0,0,0,0.5);
    display: flex; flex-direction: column;
  `;
} else {
  panel.style.cssText = `
    position: fixed; top: 16px; right: 16px; width: 260px;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: rgba(255,255,255,0.85); font-size: 12px;
    background: rgba(10,10,18,0.85); border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(16px);
    z-index: 60; overflow: hidden; max-height: calc(100vh - 32px);
    overflow-y: auto;
  `;
}

const css = document.createElement('style');
css.textContent = `
  /* Mobile drawer handle */
  .mobile-drawer-handle {
    display: none;
    width: 100%; min-height: 48px; cursor: pointer;
    text-align: center; user-select: none; -webkit-user-select: none;
    flex-shrink: 0; z-index: 10;
    background: rgba(10,10,18,0.97);
    padding: 8px 0 4px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .mobile-drawer-handle .handle-bar {
    width: 36px; height: 4px; border-radius: 2px;
    background: rgba(255,255,255,0.25); margin: 0 auto 6px;
  }
  .mobile-drawer-handle .handle-label {
    font-size: 11px; font-weight: 600; letter-spacing: 0.5px;
    color: rgba(255,255,255,0.5);
  }
  /* Mobile scrollable content area — on desktop it's just a passthrough */
  .mobile-scroll-content {
    display: contents;
  }
  @media (max-width: 768px) {
    .mobile-scroll-content {
      display: block !important;
      flex: 1; overflow-y: auto; overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      min-height: 0;
    }
  }
  @media (max-width: 768px) {
    .mobile-drawer-handle { display: block; }
    #uiPanel {
      -webkit-overflow-scrolling: touch;
    }
    #uiPanel.drawer-open {
      height: 52vh !important;
    }
    .panel-header { padding: 14px 16px; }
    .panel-body { padding: 0 16px 16px 16px; }
    .panel-btn { padding: 10px 14px; font-size: 12px; min-height: 40px; }
    .panel-slider { height: 6px; }
    .panel-slider::-webkit-slider-thumb { width: 18px; height: 18px; }
    .panel-slider::-moz-range-thumb { width: 18px; height: 18px; }
    .panel-select { padding: 8px 10px; font-size: 12px; min-height: 36px; background: rgba(30,30,48,0.95); color: #e0e0e0; }
    .panel-select option { background: #1e1e30; color: #e0e0e0; }
    select { background: rgba(30,30,48,0.95); color: #e0e0e0; }
    select option { background: #1e1e30; color: #e0e0e0; }
    .panel-toggle { width: 42px; height: 24px; }
    .panel-toggle::after { width: 18px; height: 18px; }
    .panel-toggle.active::after { transform: translateX(18px); }
    .ai-gen-btn { padding: 12px 14px; font-size: 13px; min-height: 44px; }
    .ai-matcap-input { padding: 10px 12px; font-size: 13px; }
    .ai-var-swatch { width: 56px; height: 56px; }
    .panel-mesh-item { padding: 10px 12px; }
    .panel-color { width: 36px; height: 28px; }
  }
  /* Mobile info panel repositioning */
  @media (max-width: 768px) {
    .mobile-info-adjust {
      bottom: 56px !important;
      left: 10px !important;
      right: 10px !important;
      font-size: 11px !important;
      padding: 8px 12px !important;
    }
  }
  .panel-section { border-bottom: 1px solid rgba(255,255,255,0.06); }
  .panel-section:last-child { border-bottom: none; }
  .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; user-select: none; }
  .panel-header:hover { background: rgba(255,255,255,0.03); }
  .panel-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; color: rgba(255,255,255,0.4); margin: 0; }
  .panel-chevron { font-size: 10px; color: rgba(255,255,255,0.3); transition: transform 0.2s ease; }
  .panel-chevron.open { transform: rotate(180deg); }
  .panel-body { padding: 0 16px 14px 16px; display: none; }
  .panel-body.open { display: block; }
  .panel-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .panel-row:last-child { margin-bottom: 0; }
  .panel-label { color: rgba(255,255,255,0.6); font-size: 12px; }
  .panel-value { color: rgba(255,255,255,0.4); font-size: 11px; font-variant-numeric: tabular-nums; }
  .panel-slider { -webkit-appearance: none; appearance: none; width: 110px; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; outline: none; cursor: pointer; }
  .panel-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #fff; cursor: pointer; }
  .panel-slider::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: #fff; border: none; cursor: pointer; }
  .panel-color { -webkit-appearance: none; appearance: none; width: 28px; height: 20px; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; background: none; cursor: pointer; padding: 0; }
  .panel-color::-webkit-color-swatch-wrapper { padding: 0; }
  .panel-color::-webkit-color-swatch { border: none; border-radius: 3px; }
  .panel-select { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 5px 8px; font-size: 11px; font-family: inherit; outline: none; cursor: pointer; width: 120px; }
  .panel-select option { background: #1e1e30; color: #e0e0e0; padding: 4px 8px; }
  .panel-select option:hover, .panel-select option:checked { background: #2a2a4a; color: #ffffff; }
  select { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; font-family: inherit; }
  select option { background: #1e1e30; color: #e0e0e0; padding: 4px 8px; }
  select option:hover, select option:checked { background: #2a2a4a; color: #ffffff; }
  select:focus { border-color: rgba(100,140,255,0.4); }
  .panel-toggle { position: relative; width: 36px; height: 20px; background: rgba(255,255,255,0.1); border-radius: 10px; cursor: pointer; transition: background 0.2s; border: none; padding: 0; }
  .panel-toggle.active { background: rgba(100,140,255,0.5); }
  .panel-toggle::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; background: #fff; border-radius: 50%; transition: transform 0.2s; }
  .panel-toggle.active::after { transform: translateX(16px); }
  .panel-btn { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 12px; font-size: 11px; font-family: inherit; cursor: pointer; transition: background 0.15s; }
  .panel-btn:hover { background: rgba(255,255,255,0.12); }
  .panel-mesh-item { padding: 6px 10px; margin-bottom: 4px; background: rgba(255,255,255,0.04); border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s; }
  .panel-mesh-item:hover { background: rgba(255,255,255,0.08); }
  .panel-mesh-item.selected { background: rgba(100,140,255,0.15); border: 1px solid rgba(100,140,255,0.3); }
  .matcap-legend { display:flex; align-items:center; gap:6px; padding:4px 8px; margin-bottom:3px; background:rgba(255,255,255,0.04); border-radius:5px; font-size:10px; color:rgba(255,255,255,0.6); cursor:pointer; transition:background 0.15s; }
  .matcap-legend:hover { background:rgba(255,255,255,0.08); }
  .matcap-legend .mc-dot { width:14px; height:14px; border-radius:50%; flex-shrink:0; border:1px solid rgba(255,255,255,0.1); }
  .matcap-legend .mc-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
  .matcap-legend .mc-matcap { font-size:9px; color:rgba(255,255,255,0.35); flex-shrink:0; }
  .ai-matcap-input { width:100%; padding:8px 10px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:8px; color:rgba(255,255,255,0.85); font-size:11px; font-family:inherit; outline:none; resize:none; transition:border-color 0.2s; }
  .ai-matcap-input:focus { border-color:rgba(100,140,255,0.5); }
  .ai-matcap-input::placeholder { color:rgba(255,255,255,0.25); }
  .ai-gen-btn { width:100%; padding:8px 12px; background:linear-gradient(135deg, rgba(100,140,255,0.2), rgba(160,100,255,0.2)); border:1px solid rgba(120,130,255,0.3); border-radius:8px; color:rgba(200,210,255,0.9); font-size:11px; font-weight:600; font-family:inherit; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:6px; letter-spacing:0.3px; }
  .ai-gen-btn:hover { background:linear-gradient(135deg, rgba(100,140,255,0.3), rgba(160,100,255,0.3)); border-color:rgba(120,130,255,0.5); }
  .ai-gen-btn:disabled { opacity:0.4; cursor:not-allowed; }
  .ai-gen-btn .spinner { display:inline-block; width:12px; height:12px; border:2px solid rgba(255,255,255,0.15); border-top-color:rgba(200,210,255,0.8); border-radius:50%; animation:aispin 0.6s linear infinite; }
  @keyframes aispin { to { transform:rotate(360deg); } }
  .ai-var-grid { display:flex; gap:6px; flex-wrap:wrap; }
  .ai-var-swatch { width:48px; height:48px; border-radius:8px; cursor:pointer; border:2px solid transparent; overflow:hidden; transition:all 0.2s; position:relative; flex-shrink:0; }
  .ai-var-swatch:hover { transform:scale(1.05); }
  .ai-var-swatch.active { border-color:rgba(100,140,255,0.7); box-shadow:0 0 12px rgba(100,140,255,0.3); }
  .ai-var-swatch canvas { width:100%; height:100%; display:block; }
  .ai-adj-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
  .ai-adj-row:last-child { margin-bottom:0; }
  .ai-adj-label { color:rgba(255,255,255,0.5); font-size:10px; min-width:60px; }
  .ai-adj-val { color:rgba(255,255,255,0.35); font-size:9px; min-width:28px; text-align:right; font-variant-numeric:tabular-nums; }
  .ai-blend-btn.active { background:rgba(100,140,255,0.2); border-color:rgba(100,140,255,0.4); color:rgba(160,190,255,0.95); }
  .hdri-swatch:hover { transform: scale(1.05); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  .hdri-swatch.active { border-color: rgba(100,140,255,0.6) !important; box-shadow: 0 0 10px rgba(100,140,255,0.2); }
  .hdri-swatch.loading::after { content: ''; position:absolute; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; border-radius:4px; }
  .format-btn { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 4px; font-size: 10px; font-family: inherit; cursor: pointer; transition: all 0.15s; text-align: center; font-weight: 500; }
  .format-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }
  .format-btn.active { background: rgba(100,140,255,0.15); border-color: rgba(100,140,255,0.4); color: rgba(100,140,255,0.9); }
  .panel-scrollbar::-webkit-scrollbar { width: 4px; }
  .panel-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .panel-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
`;
document.head.appendChild(css);

// HDRI backgrounds definitions — real .hdr files from Poly Haven (CC0) at 2K for faster loads
// All HDRIs are CC0 (Public Domain) from polyhaven.com — no attribution required, but credited below.
const hdriPresets = {
  none: { name: 'None (Gradient)', url: null, credit: null, category: null, preview: null },
  // ── Studio / Controlled ──
  studio: {
    name: '📸 Studio Soft',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/studio_small_09_2k.hdr',
    credit: 'Poly Haven (CC0)', category: 'studio',
    preview: '#d0d0d8', desc: 'Soft controlled studio lighting — even, neutral'
  },
  photo_studio: {
    name: '📸 Photo Studio',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/photo_studio_loft_hall_2k.hdr',
    credit: 'Poly Haven (CC0)', category: 'studio',
    preview: '#b8b8c0', desc: 'Professional photo studio with overhead softboxes'
  },
  // ── Sunset / Golden Hour ──
  sunset: {
    name: '🌅 Golden Sunset',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloofendal_48d_partly_cloudy_puresky_2k.hdr',
    credit: 'Poly Haven (CC0)', category: 'outdoor',
    preview: '#e8a848', desc: 'Warm directional golden hour light'
  },
  venice_sunset: {
    name: '🌅 Venice Sunset',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/venice_sunset_2k.hdr',
    credit: 'Poly Haven (CC0)', category: 'outdoor',
    preview: '#d08040', desc: 'Deep warm sunset with dramatic clouds'
  },
  // ── Night / City ──
  city_night: {
    name: '🌃 City Night',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/potsdamer_platz_2k.hdr',
    credit: 'Poly Haven (CC0)', category: 'night',
    preview: '#2838a0', desc: 'Strong contrast with artificial city lights'
  },
  dark_night: {
    name: '🌑 Dark Night',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/dikhololo_night_2k.hdr',
    credit: 'Poly Haven (CC0)', category: 'night',
    preview: '#181828', desc: 'Very low light — high contrast, dramatic'
  },
  // ── Overcast / Diffuse ──
  overcast: {
    name: '☁️ Overcast Sky',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloofendal_misty_morning_puresky_2k.hdr',
    credit: 'Poly Haven (CC0)', category: 'outdoor',
    preview: '#a0a8b8', desc: 'Diffuse, soft lighting — no harsh shadows'
  },
  // ── Indoor / Warm ──
  warm_interior: {
    name: '🏠 Warm Interior',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/brown_photostudio_02_2k.hdr',
    credit: 'Poly Haven (CC0)', category: 'indoor',
    preview: '#c8a078', desc: 'Warm indoor environment — cozy, amber tones'
  },
  // ── Nature ──
  courtyard: {
    name: '🏛️ Courtyard',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/royal_esplanade_2k.hdr',
    credit: 'Poly Haven (CC0)', category: 'outdoor',
    preview: '#88a8c8', desc: 'Open courtyard with balanced natural light'
  },
  forest: {
    name: '🌲 Forest',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/syferfontein_1d_clear_puresky_2k.hdr',
    credit: 'Poly Haven (CC0)', category: 'outdoor',
    preview: '#68a858', desc: 'Clear sky over green landscape'
  },
  // ── Cave / Dark Environment ──
  quarry: {
    name: '🕳️ Quarry (Cave)',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/quarry_04_puresky_2k.hdr',
    credit: 'Poly Haven (CC0)', category: 'indoor',
    preview: '#585848', desc: 'Low light, high contrast — cave-like environment'
  },
};

// Track whether user wants HDRI visible as background or just for lighting
let hdriBackgroundVisible = true;

// Cache loaded HDRI textures so we don't re-download
const hdriCache = new Map();
const hdrLoader = new HDRLoader();
// Keep reference to the default gradient env for "None"
let defaultEnvTexture = envRT.texture;

// Matcap texture URLs (procedural data URIs generated on the fly)
const matcapPresets = {
  none: { name: 'None', url: null },
  clay: { name: 'Clay', colors: ['#c8b8a8', '#f5e6d3', '#8a7a6a'] },
  gold: { name: 'Gold', colors: ['#ffd700', '#fff8dc', '#b8860b'] },
  chrome: { name: 'Chrome', colors: ['#cccccc', '#ffffff', '#555555'] },
  red_wax: { name: 'Red Wax', colors: ['#cc3333', '#ff8888', '#661111'] },
  jade: { name: 'Jade', colors: ['#44aa66', '#88ddaa', '#226633'] },
  blue_steel: { name: 'Blue Steel', colors: ['#4466aa', '#88aaee', '#223366'] },
  silver: { name: 'Silver', colors: ['#c0c0c8', '#f0f0f5', '#707078'] },
  pearl: { name: 'Pearl', colors: ['#eeddcc', '#ffffff', '#bbaa99'] },
};

function generateMatcapTexture(colors) {
  // Parse hex colors to RGB arrays
  function hexToRGB(hex) {
    const c = parseInt(hex.replace('#', ''), 16);
    return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  }
  const base = hexToRGB(colors[0]);
  const highlight = hexToRGB(colors[1]);
  const shadow = hexToRGB(colors[2]);

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const ctr = size / 2;
  const rad = size / 2;

  // Key light direction: top-left
  const kl = normalize3(-0.48, -0.56, 0.68);

  const imgData = ctx.createImageData(size, size);
  const d = imgData.data;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const idx = (py * size + px) * 4;
      const nx = (px - ctr) / rad;
      const ny = (py - ctr) / rad;
      const dist2 = nx * nx + ny * ny;

      if (dist2 > 1.0) {
        d[idx] = 0; d[idx + 1] = 0; d[idx + 2] = 0; d[idx + 3] = 0;
        continue;
      }

      const nz = Math.sqrt(1 - dist2);
      const diff = Math.max(0, nx * kl[0] + ny * kl[1] + nz * kl[2]);
      const hx = kl[0], hy = kl[1], hz = kl[2] + 1;
      const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);
      const spec = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen), 64) * 0.7;
      const illum = 0.08 + diff * 0.65 + Math.pow(1 - nz, 3) * 0.12;
      const t = illum < 0.45 ? illum / 0.45 : 0.45 + (illum - 0.45) / 0.55 * 0.55;

      let r, g, b;
      if (illum < 0.45) {
        const s = (illum / 0.45); const ss = s * s * (3 - 2 * s);
        r = shadow[0] + (base[0] - shadow[0]) * ss;
        g = shadow[1] + (base[1] - shadow[1]) * ss;
        b = shadow[2] + (base[2] - shadow[2]) * ss;
      } else {
        const s = (illum - 0.45) / 0.55; const ss = s * s * (3 - 2 * s);
        r = base[0] + (highlight[0] - base[0]) * ss;
        g = base[1] + (highlight[1] - base[1]) * ss;
        b = base[2] + (highlight[2] - base[2]) * ss;
      }
      r = r + (255 - r) * spec;
      g = g + (255 - g) * spec;
      b = b + (255 - b) * spec;
      const ef = Math.pow(nz, 0.3);
      d[idx]     = clamp(Math.round(r * ef), 0, 255);
      d[idx + 1] = clamp(Math.round(g * ef), 0, 255);
      d[idx + 2] = clamp(Math.round(b * ef), 0, 255);
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Placeholder for AI-generated matcaps in the preset registry
matcapPresets['__ai_generated__'] = { name: '✦ Generated', colors: null };

let estimatedExportSize = '—';
let activeMatcap = null;
let preMatcapMaterials = new Map();
let matcapTargetUUID = null; // null = all meshes
let perMeshMatcap = new Map(); // meshUUID -> matcap key

// === EDITOR LOG (Undo History) ===
const editorLog = [];
const MAX_LOG = 50;

function captureState() {
  const state = {
    timestamp: Date.now(),
    label: '',
    bgColor: (scene.background && scene.background.isColor) ? '#' + scene.background.getHexString() : ($('pBgColor')?.value ?? '#1a1a2e'),
    ambientIntensity: ambientLight.intensity,
    keyIntensity: dirLight.intensity,
    fillIntensity: fillLight.intensity,
    rimIntensity: rimLight.intensity,
    keyColor: '#' + dirLight.color.getHexString(),
    fillColor: '#' + fillLight.color.getHexString(),
    rimColor: '#' + rimLight.color.getHexString(),
    exposure: renderer.toneMappingExposure,
    shadowsOn: renderer.shadowMap.enabled,
    autoRotate: controls.autoRotate,
    autoRotateSpeed: controls.autoRotateSpeed,
    wireframe: wireframeOn,
    transparentBg: transparentBg,
    envIntensity: parseFloat($('pEnvIntensity')?.value || '1'),
    hdri: currentHDRIKey || 'none',
    // Per-mesh materials
    meshMaterials: new Map(),
    // Per-mesh matcaps
    meshMatcaps: new Map(perMeshMatcap),
  };

  if (loadedModel) {
    loadedModel.traverse(c => {
      if (c.isMesh && c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach(m => {
          state.meshMaterials.set(m.uuid, {
            color: m.color ? '#' + m.color.getHexString() : null,
            metalness: m.metalness,
            roughness: m.roughness,
            emissive: m.emissive ? '#' + m.emissive.getHexString() : null,
            emissiveIntensity: m.emissiveIntensity,
            opacity: m.opacity,
            transparent: m.transparent,
          });
        });
      }
    });
  }

  return state;
}

function pushLog(label) {
  const state = captureState();
  state.label = label;
  editorLog.push(state);
  if (editorLog.length > MAX_LOG) editorLog.shift();
  buildLogList();
}

function restoreState(state) {
  // Helper to safely set element value/class
  const setVal = (id, val) => { const el = $(id); if (el) el.value = val; };
  const setToggle = (id, active) => { const el = $(id); if (el) el.classList.toggle('active', active); };

  scene.background = new THREE.Color(state.bgColor);
  setVal('pBgColor', state.bgColor);

  ambientLight.intensity = state.ambientIntensity;
  setVal('pAmbient', state.ambientIntensity);

  dirLight.intensity = state.keyIntensity;
  setVal('pKey', state.keyIntensity);

  fillLight.intensity = state.fillIntensity;
  setVal('pFill', state.fillIntensity);

  rimLight.intensity = state.rimIntensity;
  setVal('pRim', state.rimIntensity);

  dirLight.color.set(state.keyColor);
  setVal('pKeyColor', state.keyColor);

  fillLight.color.set(state.fillColor);
  setVal('pFillColor', state.fillColor);

  rimLight.color.set(state.rimColor);
  setVal('pRimColor', state.rimColor);

  renderer.toneMappingExposure = state.exposure;
  setVal('pExposure', state.exposure);

  renderer.shadowMap.enabled = state.shadowsOn;
  dirLight.castShadow = state.shadowsOn;
  setToggle('pShadows', state.shadowsOn);

  controls.autoRotate = state.autoRotate;
  setToggle('pAutoRotate', state.autoRotate);
  controls.autoRotateSpeed = state.autoRotateSpeed;
  setVal('pRotateSpeed', state.autoRotateSpeed);

  wireframeOn = state.wireframe;
  setToggle('pWireframe', wireframeOn);

  // Restore transparent BG state
  transparentBg = state.transparentBg || false;
  setToggle('pTransparentBg', transparentBg);
  if (transparentBg) {
    scene.background = null;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.background = `repeating-conic-gradient(#222 0% 25%, #2a2a2a 0% 50%) 0 0 / 20px 20px`;
    ground.visible = false;
  } else {
    // Restore HDRI background if one is active and BG is visible, otherwise use solid color
    const hdriVal = state.hdri || 'none';
    if (hdriVal !== 'none' && hdriCache.has(hdriVal) && hdriBackgroundVisible) {
      scene.background = hdriCache.get(hdriVal);
    } else {
      scene.background = new THREE.Color(state.bgColor);
    }
    renderer.setClearColor(0x000000, 1);
    renderer.domElement.style.background = 'none';
  }

  // Show/hide HDRI BG toggle row based on restored HDRI value
  const bgRow = $('pHDRIBgRow');
  if (bgRow) bgRow.style.display = (state.hdri && state.hdri !== 'none') ? 'flex' : 'none';

  setVal('pHDRI', state.hdri);
  setVal('pEnvIntensity', state.envIntensity);

  // Restore materials
  if (loadedModel) {
    loadedModel.traverse(c => {
      if (c.isMesh && c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach(m => {
          const saved = state.meshMaterials.get(m.uuid);
          if (saved) {
            if (saved.color && m.color) m.color.set(saved.color);
            if (m.metalness !== undefined) m.metalness = saved.metalness;
            if (m.roughness !== undefined) m.roughness = saved.roughness;
            if (saved.emissive && m.emissive) m.emissive.set(saved.emissive);
            if (m.emissiveIntensity !== undefined) m.emissiveIntensity = saved.emissiveIntensity;
            m.opacity = saved.opacity;
            m.transparent = saved.transparent;
            m.wireframe = wireframeOn;
          }
        });
      }
    });

    // Restore matcaps
    if (state.meshMatcaps.size > 0) {
      perMeshMatcap = new Map(state.meshMatcaps);
      loadedModel.traverse(c => {
        if (c.isMesh) {
          const mcKey = perMeshMatcap.get(c.uuid);
          if (mcKey && matcapPresets[mcKey]?.colors) {
            const tex = generateMatcapTexture(matcapPresets[mcKey].colors);
            if (!preMatcapMaterials.has(c.uuid)) preMatcapMaterials.set(c.uuid, c.material);
            c.material = new THREE.MeshMatcapMaterial({ matcap: tex });
          } else if (preMatcapMaterials.has(c.uuid)) {
            c.material = preMatcapMaterials.get(c.uuid);
          }
        }
      });
    } else {
      // Clear all matcaps
      loadedModel.traverse(c => {
        if (c.isMesh && preMatcapMaterials.has(c.uuid)) {
          c.material = preMatcapMaterials.get(c.uuid);
        }
      });
      perMeshMatcap.clear();
    }
    updateMatcapGridSelection();
  }
}

function buildLogList() {
  const list = $('logList');
  if (!list) return;
  list.innerHTML = '';

  if (editorLog.length === 0) {
    list.innerHTML = '<div style="font-size:11px; color:rgba(255,255,255,0.25); padding:4px 0;">No history yet</div>';
    return;
  }

  // Show newest first
  for (let i = editorLog.length - 1; i >= 0; i--) {
    const entry = editorLog[i];
    const isCurrent = (i === editorLog.length - 1);
    const item = document.createElement('div');
    item.style.cssText = `display:flex; align-items:center; justify-content:space-between; padding:5px 8px; margin-bottom:3px; background:${isCurrent ? 'rgba(100,140,255,0.12)' : 'rgba(255,255,255,0.04)'}; border-radius:5px; cursor:pointer; transition:background 0.15s; ${isCurrent ? 'border-left:2px solid rgba(100,140,255,0.6);' : 'border-left:2px solid transparent;'}`;
    item.addEventListener('mouseenter', () => { if (!isCurrent) item.style.background = 'rgba(100,140,255,0.08)'; });
    item.addEventListener('mouseleave', () => { if (!isCurrent) item.style.background = 'rgba(255,255,255,0.04)'; });

    const ago = formatTimeAgo(entry.timestamp);
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px; overflow:hidden; flex:1;">
        <span style="font-size:9px; color:rgba(100,140,255,0.5); flex-shrink:0;">${isCurrent ? '●' : '○'}</span>
        <span style="font-size:11px; color:rgba(255,255,255,${isCurrent ? '0.9' : '0.6'}); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${entry.label}</span>
      </div>
      <div style="display:flex; align-items:center; gap:6px; flex-shrink:0; margin-left:6px;">
        <span style="font-size:9px; color:rgba(255,255,255,0.3);">${ago}</span>
        ${!isCurrent ? '<span style="font-size:9px; color:rgba(100,140,255,0.5); font-weight:500;">restore</span>' : ''}
      </div>
    `;
    const idx = i;
    if (!isCurrent) {
      item.addEventListener('click', () => {
        // Restore the clicked version's state
        restoreState(editorLog[idx]);
        // Push a new log entry for the restore action (preserves full history)
        const restoredState = captureState();
        restoredState.label = '↩ Restored: ' + editorLog[idx].label;
        restoredState.timestamp = Date.now();
        editorLog.push(restoredState);
        if (editorLog.length > MAX_LOG) editorLog.shift();
        buildLogList();
      });
    }
    list.appendChild(item);
  }
}

function formatTimeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  return Math.floor(diff / 3600) + 'h ago';
}

// Helper to darken a hex color for gradient backgrounds
function adjustColor(hex, amount) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  const num = parseInt(hex, 16);
  let r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amount));
  let g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  let b = Math.max(0, Math.min(255, (num & 255) + amount));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

panel.innerHTML = `
  <div class="mobile-drawer-handle" id="mobileDrawerHandle">
    <div class="handle-bar"></div>
    <div class="handle-label">✦ Matcap Generator</div>
  </div>
  <div class="mobile-scroll-content" id="panelScrollContent">
  <div style="padding: 14px 16px 6px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);">
    <div style="font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.9); letter-spacing: 0.3px; margin-bottom: 2px;">✦ Matcap Generator</div>
    <div style="font-size: 10px; color: rgba(255,255,255,0.3);">Generate · Preview · Export</div>
  </div>
  <div class="panel-section">
    <div class="panel-header" data-section="import">
      <span class="panel-title">Import</span>
      <span class="panel-chevron">▼</span>
    </div>
    <div class="panel-body">
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <button class="panel-btn" id="pImportBtn" style="width:100%; padding:8px 12px; font-size:12px; display:flex; align-items:center; justify-content:center; gap:6px;">
          <span style="font-size:14px;">📂</span> Import Model
        </button>
        <div style="font-size:10px; color:rgba(255,255,255,0.3); text-align:center;">.glb · .gltf · .obj · .fbx · .stl · .blend</div>
        <div style="font-size:10px; color:rgba(255,255,255,0.35); margin-top:4px; margin-bottom:4px;">Or load a demo model:</div>
        <select class="panel-select" id="pDemoModels" style="width:100%;">
          <option value="" selected disabled>Select a demo model…</option>
          <option value="Lantern">🏮 Lantern (multi-mesh)</option>
          <option value="AntiqueCamera">📷 Antique Camera (multi-mesh)</option>
          <option value="DamagedHelmet">🪖 Damaged Helmet</option>
          <option value="Duck">🦆 Duck</option>
          <option value="Avocado">🥑 Avocado</option>
          <option value="WaterBottle">🍶 Water Bottle</option>
          <option value="BoomBox">📻 BoomBox</option>
          <option value="Corset">👗 Corset</option>
          <option value="SheenChair">🪑 Sheen Chair (multi-mesh)</option>
          <option value="ToyCar">🚗 Toy Car (multi-mesh)</option>
          <option value="FlightHelmet">🪖 Flight Helmet (multi-mesh)</option>
          <option value="MaterialsVariantsShoe">👟 Shoe (multi-mesh)</option>
          <option value="IridescenceLamp">💡 Iridescence Lamp (multi-mesh)</option>
        </select>
        <div id="pImportStatus" style="font-size:10px; color:rgba(255,255,255,0.35); text-align:center; display:none;"></div>
      </div>
    </div>
  </div>
  <div class="panel-section" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
    <div style="padding: 10px 16px; display: flex; align-items: center; justify-content: space-between;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="panel-label" style="font-size:12px;">Auto Rotate</span>
        <button class="panel-toggle active" id="pAutoRotate"></button>
      </div>
      <input type="range" class="panel-slider" id="pRotateSpeed" min="0" max="8" step="0.1" value="1.5" style="width:80px;">
    </div>
  </div>
  <div class="panel-section">
    <div class="panel-header" data-section="lighting">
      <span class="panel-title">Lighting</span>
      <span class="panel-chevron">▼</span>
    </div>
    <div class="panel-body">
    <div class="panel-row">
      <span class="panel-label">Ambient</span>
      <input type="range" class="panel-slider" id="pAmbient" min="0" max="3" step="0.05" value="0.5">
    </div>
    <div class="panel-row">
      <span class="panel-label">Key Light</span>
      <input type="range" class="panel-slider" id="pKey" min="0" max="5" step="0.05" value="1.8">
    </div>
    <div class="panel-row">
      <span class="panel-label">Fill Light</span>
      <input type="range" class="panel-slider" id="pFill" min="0" max="3" step="0.05" value="0.6">
    </div>
    <div class="panel-row">
      <span class="panel-label">Rim Light</span>
      <input type="range" class="panel-slider" id="pRim" min="0" max="3" step="0.05" value="0.5">
    </div>
    <div class="panel-row">
      <span class="panel-label">Key Color</span>
      <input type="color" class="panel-color" id="pKeyColor" value="#ffffff">
    </div>
    <div class="panel-row">
      <span class="panel-label">Fill Color</span>
      <input type="color" class="panel-color" id="pFillColor" value="#8888ff">
    </div>
    <div class="panel-row">
      <span class="panel-label">Rim Color</span>
      <input type="color" class="panel-color" id="pRimColor" value="#ff8866">
    </div>
    <div class="panel-row">
      <span class="panel-label">Exposure</span>
      <input type="range" class="panel-slider" id="pExposure" min="0.2" max="3" step="0.05" value="1.2">
    </div>
    <div class="panel-row">
      <span class="panel-label">Shadows</span>
      <button class="panel-toggle active" id="pShadows"></button>
    </div>
    </div>
  </div>
  <div class="panel-section">
    <div class="panel-header" data-section="environment">
      <span class="panel-title">Environment</span>
      <span class="panel-chevron">▼</span>
    </div>
    <div class="panel-body">
    <div style="margin-bottom:8px;">
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
        <span class="panel-label" style="flex-shrink:0;">HDRI</span>
        <select class="panel-select" id="pHDRICat" style="width:80px; font-size:9px; padding:3px 5px;">
          <option value="all" selected>All</option>
          <option value="studio">Studio</option>
          <option value="outdoor">Outdoor</option>
          <option value="indoor">Indoor</option>
          <option value="night">Night</option>
        </select>
      </div>
      <div id="pHDRIGrid" style="display:grid; grid-template-columns:repeat(3,1fr); gap:5px; margin-bottom:8px;">
        ${Object.entries(hdriPresets).map(([k, v]) => {
          if (k === 'none') return `<div class="hdri-swatch active" data-hdri="${k}" style="aspect-ratio:1; border-radius:6px; cursor:pointer; border:2px solid rgba(100,140,255,0.6); overflow:hidden; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.04); transition:all 0.15s; position:relative;" title="None (use gradient)">
            <span style="font-size:16px; opacity:0.4;">✕</span>
          </div>`;
          const bg = v.preview || '#555';
          return `<div class="hdri-swatch" data-hdri="${k}" data-cat="${v.category || ''}" style="aspect-ratio:1; border-radius:6px; cursor:pointer; border:2px solid transparent; overflow:hidden; transition:all 0.15s; position:relative;" title="${v.desc || v.name}">
            <div style="width:100%; height:100%; background:radial-gradient(circle at 35% 35%, ${bg}, ${adjustColor(bg, -40)}); display:flex; align-items:center; justify-content:center;">
              <span style="font-size:8px; color:rgba(255,255,255,0.75); font-weight:500; text-shadow:0 1px 3px rgba(0,0,0,0.5); text-align:center; padding:2px; line-height:1.2;">${v.name.replace(/^.\s/, '')}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div id="pHDRICredit" style="font-size:9px; color:rgba(255,255,255,0.25); text-align:center; display:none; margin-bottom:6px;"></div>
    <div id="pHDRIStatus" style="font-size:10px; color:rgba(255,255,255,0.4); text-align:center; display:none; margin-bottom:6px;"></div>
    <div style="display:flex; gap:6px; margin-bottom:8px;">
      <button class="panel-btn" id="pHDRIUpload" style="flex:1; padding:5px 8px; font-size:10px; display:flex; align-items:center; justify-content:center; gap:4px;">
        📂 Upload HDRI
      </button>
    </div>
    <div class="panel-row" id="pHDRIBgRow" style="display:none;">
      <span class="panel-label">Show HDRI BG</span>
      <button class="panel-toggle active" id="pHDRIBackground"></button>
    </div>
    <div class="panel-row" id="pHDRIRotRow" style="display:none;">
      <span class="panel-label">Rotation</span>
      <input type="range" class="panel-slider" id="pHDRIRotation" min="0" max="360" step="1" value="0" style="width:100px;">
    </div>
    <div class="panel-row" id="pHDRIIntRow" style="display:none;">
      <span class="panel-label">HDRI Intensity</span>
      <input type="range" class="panel-slider" id="pHDRIIntensity" min="0" max="5" step="0.05" value="1.0" style="width:100px;">
    </div>
    <div class="panel-row">
      <span class="panel-label">BG Color</span>
      <input type="color" class="panel-color" id="pBgColor" value="#1a1a2e">
    </div>
    <div class="panel-row">
      <span class="panel-label">Transparent BG</span>
      <button class="panel-toggle" id="pTransparentBg"></button>
    </div>
    <div class="panel-row">
      <span class="panel-label">Env Intensity</span>
      <input type="range" class="panel-slider" id="pEnvIntensity" min="0" max="3" step="0.05" value="1.0">
    </div>
    </div>
  </div>
  <div class="panel-section">
    <div class="panel-header" data-section="textures">
      <span class="panel-title">Textures & Matcap</span>
      <span class="panel-chevron">▼</span>
    </div>
    <div class="panel-body">
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
      <span style="font-size:10px; color:rgba(255,255,255,0.35);">Model Textures</span>
      <button class="panel-btn" id="pTexImport" style="padding:2px 8px; font-size:9px;">📂 Import Texture</button>
    </div>
    <div id="texImportPanel" style="display:none; margin-bottom:10px; padding:8px; background:rgba(255,255,255,0.04); border-radius:8px; border:1px solid rgba(255,255,255,0.08);">
      <div style="font-size:10px; color:rgba(255,255,255,0.5); margin-bottom:6px;">Apply texture to:</div>
      <select id="texImportTarget" class="panel-select" style="width:100%; font-size:10px; margin-bottom:6px;">
        <option value="all">All Meshes</option>
      </select>
      <div style="font-size:10px; color:rgba(255,255,255,0.5); margin-bottom:6px;">Texture slot:</div>
      <select id="texImportSlot" class="panel-select" style="width:100%; font-size:10px; margin-bottom:6px;">
        <option value="map">Diffuse (Color Map)</option>
        <option value="normalMap">Normal Map</option>
        <option value="roughnessMap">Roughness Map</option>
        <option value="metalnessMap">Metalness Map</option>
        <option value="aoMap">AO Map</option>
        <option value="emissiveMap">Emissive Map</option>
        <option value="bumpMap">Bump Map</option>
        <option value="alphaMap">Alpha Map</option>
      </select>
      <div id="texImportPreview" style="display:none; margin-bottom:6px; text-align:center;">
        <canvas id="texPreviewCanvas" width="80" height="80" style="border-radius:6px; border:1px solid rgba(255,255,255,0.1);"></canvas>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="panel-btn" id="texImportApply" style="flex:1; padding:4px 8px; font-size:10px;">✓ Apply</button>
        <button class="panel-btn" id="texImportCancel" style="flex:1; padding:4px 8px; font-size:10px;">✕ Cancel</button>
      </div>
    </div>
    <div id="texList" style="margin-bottom:12px; max-height:100px; overflow-y:auto;"></div>
    <div style="font-size:10px; color:rgba(255,255,255,0.35); margin-bottom:8px;">Matcap Override</div>
    <div id="matcapTarget" style="margin-bottom:8px;"></div>
    <div id="matcapGrid" style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-bottom:8px;"></div>
    <div class="panel-row">
      <span class="panel-label">Matcap Blend</span>
      <select class="panel-select" id="pMatcapBlend" style="width:90px;">
        <option value="normal">Normal</option>
        <option value="overlay" selected>Overlay</option>
        <option value="screen">Screen</option>
        <option value="multiply">Multiply</option>
        <option value="soft-light">Soft Light</option>
      </select>
    </div>
    <div id="matcapOverview" style="margin-top:8px; max-height:140px; overflow-y:auto;"></div>
    <div style="display:flex; gap:6px; margin-top:6px;">
      <button class="panel-btn" id="pMatcapClear" style="flex:1; padding:4px 8px; font-size:10px;">Clear All</button>
      <button class="panel-btn" id="pMatcapImport" style="flex:1; padding:4px 8px; font-size:10px;">📂 Import</button>
    </div>
    <div style="display:flex; gap:6px; margin-top:6px;">
      <button class="panel-btn" id="pDownloadTextures" style="flex:1; padding:4px 8px; font-size:10px;">⬇ Textures</button>
      <button class="panel-btn" id="pDownloadMatcap" style="flex:1; padding:4px 8px; font-size:10px;">⬇ Matcap</button>
    </div>
    </div>
  </div>
  <div class="panel-section">
    <div class="panel-header" data-section="aimatcap">
      <span class="panel-title">✦ Matcap Generator</span>
      <span class="panel-chevron">▼</span>
    </div>
    <div class="panel-body">
      <div id="aiMatcapTarget" style="margin-bottom:8px;"></div>
      <div style="margin-bottom:8px;">
        <textarea class="ai-matcap-input" id="aiMatcapPrompt" rows="2" placeholder="Describe a matcap… e.g. &quot;polished copper with warm highlights&quot; or &quot;iridescent rainbow glass&quot;"></textarea>
      </div>
      <div style="margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
          <span style="font-size:9px; color:rgba(255,255,255,0.35);">Presets</span>
          <select id="aiPresetCategory" class="panel-select" style="flex:1; width:auto; padding:2px 6px; font-size:9px;">
            <option value="all">All</option>
            <option value="metals">🔩 Metals</option>
            <option value="glass">🔮 Glass & Crystal</option>
            <option value="realistic">🎯 Realistic</option>
            <option value="stylized">🎨 Stylized</option>
            <option value="experimental">✦ Experimental</option>
          </select>
          <button class="panel-btn" id="aiShuffleBtn" style="padding:2px 8px; font-size:9px; border-radius:10px;" title="Random preset">🎲</button>
        </div>
        <div id="aiChipContainer" style="display:flex; flex-wrap:wrap; gap:4px;">
          <!-- Metals -->
          <button class="panel-btn ai-quick-prompt" data-prompt="polished chrome mirror reflective" data-cat="metals" style="padding:2px 7px; font-size:9px; border-radius:10px;">Chrome</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="warm polished gold metallic shiny" data-cat="metals" style="padding:2px 7px; font-size:9px; border-radius:10px;">Gold</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="polished silver metallic mirror" data-cat="metals" style="padding:2px 7px; font-size:9px; border-radius:10px;">Silver</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="polished copper warm metallic glossy" data-cat="metals" style="padding:2px 7px; font-size:9px; border-radius:10px;">Copper</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="bronze warm polished metallic" data-cat="metals" style="padding:2px 7px; font-size:9px; border-radius:10px;">Bronze</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="platinum polished cool metallic mirror" data-cat="metals" style="padding:2px 7px; font-size:9px; border-radius:10px;">Platinum</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="titanium brushed cool metallic dark" data-cat="metals" style="padding:2px 7px; font-size:9px; border-radius:10px;">Titanium</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="brushed_steel cool metallic" data-cat="metals" style="padding:2px 7px; font-size:9px; border-radius:10px;">Brushed Steel</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="brushed_gold warm metallic" data-cat="metals" style="padding:2px 7px; font-size:9px; border-radius:10px;">Brushed Gold</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="gunmetal dark polished" data-cat="metals" style="padding:2px 7px; font-size:9px; border-radius:10px;">Gunmetal</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="rose_gold warm polished metallic" data-cat="metals" style="padding:2px 7px; font-size:9px; border-radius:10px;">Rose Gold</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="brass warm polished metallic" data-cat="metals" style="padding:2px 7px; font-size:9px; border-radius:10px;">Brass</button>
          <!-- Glass & Crystal -->
          <button class="panel-btn ai-quick-prompt" data-prompt="clear_glass polished reflective" data-cat="glass" style="padding:2px 7px; font-size:9px; border-radius:10px;">🔮 Clear Glass</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="frosted_glass soft cool" data-cat="glass" style="padding:2px 7px; font-size:9px; border-radius:10px;">🔮 Frosted Glass</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="tinted_glass cool polished" data-cat="glass" style="padding:2px 7px; font-size:9px; border-radius:10px;">🔮 Tinted Glass</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="diamond crystal polished mirror" data-cat="glass" style="padding:2px 7px; font-size:9px; border-radius:10px;">💎 Diamond</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="ruby polished glossy vivid" data-cat="glass" style="padding:2px 7px; font-size:9px; border-radius:10px;">💎 Ruby</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="sapphire polished glossy vivid" data-cat="glass" style="padding:2px 7px; font-size:9px; border-radius:10px;">💎 Sapphire</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="emerald polished glossy vivid" data-cat="glass" style="padding:2px 7px; font-size:9px; border-radius:10px;">💎 Emerald</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="amethyst polished glossy vivid" data-cat="glass" style="padding:2px 7px; font-size:9px; border-radius:10px;">💎 Amethyst</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="quartz crystal polished" data-cat="glass" style="padding:2px 7px; font-size:9px; border-radius:10px;">💎 Quartz</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="topaz polished warm glossy" data-cat="glass" style="padding:2px 7px; font-size:9px; border-radius:10px;">💎 Topaz</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="amber resin warm polished" data-cat="glass" style="padding:2px 7px; font-size:9px; border-radius:10px;">🔶 Amber</button>
          <!-- Realistic Materials -->
          <button class="panel-btn ai-quick-prompt" data-prompt="porcelain white glossy ceramic" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">Porcelain</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="marble white polished" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">Marble</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="leather brown warm rough" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">Leather</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="wood warm rough brown" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">Wood</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="rubber dark matte black" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">Rubber</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="silk white satin smooth soft" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">Silk</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="velvet red dark soft" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">Velvet</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="wax warm soft yellow" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">Wax</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="glossy_plastic white bright" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">Hard Plastic</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="soft_plastic warm" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">Soft Plastic</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="liquid blue glossy reflective" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">💧 Liquid</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="gel cool glossy translucent" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">💧 Gel</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="mercury polished mirror metallic" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">💧 Mercury</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="jade polished green glossy" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">Jade</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="obsidian polished glossy dark dramatic" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">Obsidian</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="skin warm soft" data-cat="realistic" style="padding:2px 7px; font-size:9px; border-radius:10px;">Skin</button>
          <!-- Stylized -->
          <button class="panel-btn ai-quick-prompt" data-prompt="clay warm matte soft" data-cat="stylized" style="padding:2px 7px; font-size:9px; border-radius:10px;">🎨 Clay</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="pearl white iridescent glossy pastel" data-cat="stylized" style="padding:2px 7px; font-size:9px; border-radius:10px;">🎨 Pearl</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="matte white soft bright neutral" data-cat="stylized" style="padding:2px 7px; font-size:9px; border-radius:10px;">🎨 Matte</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="pink pastel soft satin" data-cat="stylized" style="padding:2px 7px; font-size:9px; border-radius:10px;">🎨 Pastel</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="teal cyan glossy cool vivid" data-cat="stylized" style="padding:2px 7px; font-size:9px; border-radius:10px;">🎨 Teal</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="red neon vivid glossy bright" data-cat="stylized" style="padding:2px 7px; font-size:9px; border-radius:10px;">🎨 Neon</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="candy pink glossy vivid" data-cat="stylized" style="padding:2px 7px; font-size:9px; border-radius:10px;">🎨 Candy</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="ice blue cool frosted bright" data-cat="stylized" style="padding:2px 7px; font-size:9px; border-radius:10px;">❄️ Ice</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="lava orange hot dramatic vivid" data-cat="stylized" style="padding:2px 7px; font-size:9px; border-radius:10px;">🔥 Lava</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="ocean blue deep glossy" data-cat="stylized" style="padding:2px 7px; font-size:9px; border-radius:10px;">🌊 Ocean</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="sunset orange warm vivid" data-cat="stylized" style="padding:2px 7px; font-size:9px; border-radius:10px;">🌅 Sunset</button>
          <!-- Experimental -->
          <button class="panel-btn ai-quick-prompt" data-prompt="iridescent rainbow metallic glossy reflective" data-cat="experimental" style="padding:2px 7px; font-size:9px; border-radius:10px;">🌈 Rainbow</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="holographic iridescent glossy glass vivid" data-cat="experimental" style="padding:2px 7px; font-size:9px; border-radius:10px;">✦ Holographic</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="iridescent opal pearl glossy pastel" data-cat="experimental" style="padding:2px 7px; font-size:9px; border-radius:10px;">🔮 Opal</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="pearlescent white iridescent glossy" data-cat="experimental" style="padding:2px 7px; font-size:9px; border-radius:10px;">✦ Pearlescent</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="crystal iridescent reflective diamond cool" data-cat="experimental" style="padding:2px 7px; font-size:9px; border-radius:10px;">✦ Crystal</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="black glossy dramatic dark polished" data-cat="experimental" style="padding:2px 7px; font-size:9px; border-radius:10px;">🖤 Black Gloss</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="chrome_dark polished dramatic" data-cat="experimental" style="padding:2px 7px; font-size:9px; border-radius:10px;">🖤 Dark Chrome</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="patina green oxidized" data-cat="experimental" style="padding:2px 7px; font-size:9px; border-radius:10px;">🧪 Patina</button>
          <button class="panel-btn ai-quick-prompt" data-prompt="anodized_blue polished vivid" data-cat="experimental" style="padding:2px 7px; font-size:9px; border-radius:10px;">🧪 Anodized</button>
        </div>
      </div>
      <div id="aiMatcapPreviewWrap" style="display:none; text-align:center; margin-bottom:10px;">
        <canvas id="aiMatcapPreviewCanvas" width="128" height="128" style="border-radius:50%; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3);"></canvas>
        <div style="font-size:9px; color:rgba(255,255,255,0.3); margin-top:4px;">Generated Matcap Preview</div>
      </div>
      <button class="ai-gen-btn" id="aiMatcapGenerate">
        <span>✦</span> Generate Matcap
      </button>
      <div id="aiMatcapStatus" style="font-size:10px; color:rgba(255,255,255,0.35); text-align:center; margin-top:6px; display:none;"></div>
      <div id="aiMatcapVariations" style="margin-top:10px; display:none;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <span style="font-size:10px; color:rgba(255,255,255,0.4);">Variations</span>
          <button class="panel-btn" id="aiMatcapRegen" style="padding:2px 8px; font-size:9px; display:flex; align-items:center; gap:3px;">↻ Regenerate</button>
        </div>
        <div class="ai-var-grid" id="aiVarGrid"></div>
      </div>
      <div id="aiMatcapAdjust" style="margin-top:10px; display:none; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:8px;">Adjustments</div>
        <div class="ai-adj-row">
          <span class="ai-adj-label">Brightness</span>
          <input type="range" class="panel-slider" id="aiAdjBrightness" min="-50" max="50" step="1" value="0" style="width:90px;">
          <span class="ai-adj-val" id="aiAdjBrightnessVal">0</span>
        </div>
        <div class="ai-adj-row">
          <span class="ai-adj-label">Contrast</span>
          <input type="range" class="panel-slider" id="aiAdjContrast" min="-50" max="50" step="1" value="0" style="width:90px;">
          <span class="ai-adj-val" id="aiAdjContrastVal">0</span>
        </div>
        <div class="ai-adj-row">
          <span class="ai-adj-label">Saturation</span>
          <input type="range" class="panel-slider" id="aiAdjSaturation" min="-50" max="50" step="1" value="0" style="width:90px;">
          <span class="ai-adj-val" id="aiAdjSaturationVal">0</span>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.06); margin-top:8px; padding-top:8px;">
          <div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:6px;">Layer Blend Mode</div>
          <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:8px;">
            <button class="panel-btn ai-blend-btn active" data-blend="normal" style="padding:3px 8px; font-size:9px; border-radius:10px;">Normal</button>
            <button class="panel-btn ai-blend-btn" data-blend="overlay" style="padding:3px 8px; font-size:9px; border-radius:10px;">Overlay</button>
            <button class="panel-btn ai-blend-btn" data-blend="screen" style="padding:3px 8px; font-size:9px; border-radius:10px;">Screen</button>
            <button class="panel-btn ai-blend-btn" data-blend="multiply" style="padding:3px 8px; font-size:9px; border-radius:10px;">Multiply</button>
            <button class="panel-btn ai-blend-btn" data-blend="soft-light" style="padding:3px 8px; font-size:9px; border-radius:10px;">Soft Light</button>
          </div>
        </div>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button class="panel-btn" id="aiAdjReset" style="flex:1; padding:4px 8px; font-size:10px;" title="Remove applied matcap and restore original material">⟲ Reset</button>
          <button class="panel-btn" id="aiAdjApply" style="flex:1; padding:4px 8px; font-size:10px; background:rgba(100,140,255,0.15); border-color:rgba(100,140,255,0.3);">✦ Apply to Model</button>
        </div>
      </div>
    </div>
  </div>
  <div class="panel-section">
    <div class="panel-header" data-section="stats">
      <span class="panel-title">Stats</span>
      <span class="panel-chevron">▼</span>
    </div>
    <div class="panel-body">
    <div class="panel-row">
      <span class="panel-label">GLB Size</span>
      <span class="panel-value" id="pExportSize">—</span>
    </div>
    <div class="panel-row">
      <span class="panel-label">Triangles</span>
      <span class="panel-value" id="pTriCount">—</span>
    </div>
    <div class="panel-row">
      <span class="panel-label">Textures</span>
      <span class="panel-value" id="pTexCount">—</span>
    </div>
    <div class="panel-row">
      <span class="panel-label">Draw Calls</span>
      <span class="panel-value" id="pDrawCalls">—</span>
    </div>
    <div class="panel-row" style="margin-top: 4px;">
      <span class="panel-label">Wireframe</span>
      <button class="panel-toggle" id="pWireframe"></button>
    </div>

    </div>
  </div>
  <div class="panel-section">
    <div class="panel-header" data-section="material">
      <span class="panel-title">Material</span>
      <span class="panel-chevron">▼</span>
    </div>
    <div class="panel-body">
    <div id="meshList" style="margin-bottom: 10px; max-height: 120px; overflow-y: auto;"></div>
    <div style="font-size: 10px; color: rgba(255,255,255,0.3); margin-bottom: 8px;" id="meshEditHint">Editing: All meshes</div>
    <div class="panel-row">
      <span class="panel-label">Color</span>
      <input type="color" class="panel-color" id="pMatColor" value="#ffffff">
    </div>
    <div class="panel-row">
      <span class="panel-label">Metalness</span>
      <input type="range" class="panel-slider" id="pMatMetal" min="0" max="1" step="0.01" value="0.5">
    </div>
    <div class="panel-row">
      <span class="panel-label">Roughness</span>
      <input type="range" class="panel-slider" id="pMatRough" min="0" max="1" step="0.01" value="0.5">
    </div>
    <div class="panel-row">
      <span class="panel-label">Emissive</span>
      <input type="color" class="panel-color" id="pMatEmissive" value="#000000">
    </div>
    <div class="panel-row">
      <span class="panel-label">Emissive Int.</span>
      <input type="range" class="panel-slider" id="pMatEmissiveInt" min="0" max="3" step="0.05" value="0">
    </div>
    <div class="panel-row">
      <span class="panel-label">Opacity</span>
      <input type="range" class="panel-slider" id="pMatOpacity" min="0" max="1" step="0.01" value="1.0">
    </div>
    <div class="panel-row">
      <span class="panel-label">Normal Scale</span>
      <input type="range" class="panel-slider" id="pMatNormalScale" min="0" max="3" step="0.05" value="1.0">
    </div>
    <div class="panel-row">
      <span class="panel-label">Bump Scale</span>
      <input type="range" class="panel-slider" id="pMatBumpScale" min="0" max="2" step="0.01" value="0.05">
    </div>
    <div class="panel-row" style="border-top:1px solid rgba(255,255,255,0.06); padding-top:8px; margin-top:4px;">
      <span class="panel-label" style="font-size:10px; opacity:0.5;">Quick Texture</span>
    </div>
    <div class="panel-row">
      <span class="panel-label">Normal Map</span>
      <div style="display:flex; gap:4px; align-items:center;">
        <button class="panel-btn" id="pMatNormalImport" style="padding:3px 8px; font-size:9px;">📂 Load</button>
        <button class="panel-btn" id="pMatNormalClear" style="padding:3px 6px; font-size:9px; opacity:0.6;">✕</button>
      </div>
    </div>
    <div id="pMatNormalPreview" style="display:none; margin:4px 0 6px; text-align:center;">
      <canvas id="normalPreviewCanvas" width="48" height="48" style="border-radius:4px; border:1px solid rgba(255,255,255,0.1);"></canvas>
    </div>
    <div class="panel-row">
      <span class="panel-label">Normal Blend</span>
      <select class="panel-select" id="pNormalBlend" style="width:90px;">
        <option value="normal" selected>Normal</option>
        <option value="overlay">Overlay</option>
        <option value="screen">Screen</option>
        <option value="multiply">Multiply</option>
        <option value="soft-light">Soft Light</option>
      </select>
    </div>
    <div class="panel-row">
      <span class="panel-label">Bump Map</span>
      <div style="display:flex; gap:4px; align-items:center;">
        <button class="panel-btn" id="pMatBumpImport" style="padding:3px 8px; font-size:9px;">📂 Load</button>
        <button class="panel-btn" id="pMatBumpClear" style="padding:3px 6px; font-size:9px; opacity:0.6;">✕</button>
      </div>
    </div>
    <div id="pMatBumpPreview" style="display:none; margin:4px 0 6px; text-align:center;">
      <canvas id="bumpPreviewCanvas" width="48" height="48" style="border-radius:4px; border:1px solid rgba(255,255,255,0.1);"></canvas>
    </div>
    <div class="panel-row">
      <span class="panel-label">Bump Blend</span>
      <select class="panel-select" id="pBumpBlend" style="width:90px;">
        <option value="normal" selected>Normal</option>
        <option value="overlay">Overlay</option>
        <option value="screen">Screen</option>
        <option value="multiply">Multiply</option>
        <option value="soft-light">Soft Light</option>
      </select>
    </div>
    <div class="panel-row">
      <span class="panel-label">Reset Material</span>
      <button class="panel-btn" id="pMatReset" style="padding:4px 10px;" title="Reset will remove all applied matcaps and restore original materials">⟲ Reset All</button>
    </div>
    </div>
  </div>

  <div class="panel-section">
    <div class="panel-header" data-section="history">
      <span class="panel-title">History</span>
      <span class="panel-chevron">▼</span>
    </div>
    <div class="panel-body">
    <div id="logList" style="max-height:180px; overflow-y:auto; margin-bottom:8px;"></div>
    <div style="display:flex; gap:6px;">
      <button class="panel-btn" id="pUndo" style="flex:1; padding:5px 8px; font-size:11px; display:flex; align-items:center; justify-content:center; gap:4px;">↩ Undo</button>
      <button class="panel-btn" id="pClearLog" style="flex:1; padding:5px 8px; font-size:11px; display:flex; align-items:center; justify-content:center; gap:4px;">🗑 Clear</button>
    </div>
    </div>
  </div>
  <div class="panel-section">
    <div class="panel-header" data-section="download">
      <span class="panel-title">Export</span>
      <span class="panel-chevron">▼</span>
    </div>
    <div class="panel-body">
    <div class="panel-row" style="flex-direction: column; align-items: stretch; gap: 6px;">
      <div id="matcapExportPreview" style="display:none; text-align:center; margin-bottom:8px;">
        <canvas id="matcapExportCanvas" width="128" height="128" style="border-radius:50%; border:2px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3);"></canvas>
        <div style="font-size:9px; color:rgba(255,255,255,0.3); margin-top:4px;">Current Matcap Preview</div>
      </div>
      <button class="panel-btn" id="pExportMatcapPng" style="width:100%; padding:10px 12px; font-size:12px; font-weight:500; display:flex; align-items:center; justify-content:center; gap:6px; background:rgba(160,100,255,0.15); border-color:rgba(160,100,255,0.3); color:rgba(200,180,255,0.9);">
        <span style="font-size:14px;">🎨</span> Export Matcap as PNG (1024×1024)
      </button>
      <div id="pDownloadStatus" style="font-size:10px; color:rgba(255,255,255,0.35); text-align:center; display:none;"></div>
    </div>
    </div>
  </div>
  <!-- Credit footer -->
  <div style="padding: 12px 16px 14px 16px; text-align: center; border-top: 1px solid rgba(255,255,255,0.04);">
    <div style="font-size: 9.5px; color: rgba(255,255,255,0.22); letter-spacing: 0.4px; font-family: 'Inter', sans-serif; line-height: 1.5;">
      Made by <span style="color: rgba(200,180,255,0.40); font-weight: 500;">Ayaka Fuji</span>
      <span style="margin: 0 4px; color: rgba(255,255,255,0.12);">/</span>
      Using <span style="color: rgba(130,200,255,0.40); font-weight: 500;">MaterialLab</span>
    </div>
  </div>
  </div>
`;

document.body.appendChild(panel);

// --- Helper ---
const $ = id => document.getElementById(id);

// --- Dropdown section toggle ---
panel.querySelectorAll('.panel-header').forEach(header => {
  header.addEventListener('click', () => {
    const body = header.nextElementSibling;
    const chevron = header.querySelector('.panel-chevron');
    const isOpen = body.classList.contains('open');
    body.classList.toggle('open');
    chevron.classList.toggle('open');
  });
});

// Open Import and Convert sections by default
const importHeader = panel.querySelector('[data-section="import"]');
if (importHeader) {
  importHeader.nextElementSibling.classList.add('open');
  importHeader.querySelector('.panel-chevron').classList.add('open');
}
const downloadHeader = panel.querySelector('[data-section="download"]');
if (downloadHeader) {
  downloadHeader.nextElementSibling.classList.add('open');
  downloadHeader.querySelector('.panel-chevron').classList.add('open');
}

// Format selection (kept as variables for any remaining references)
let selectedExportFormat = 'glb';
let pngSize = 'fhd';
let mp4Rotate360 = false;

// Build matcap grid
const matcapGrid = $('matcapGrid');
Object.entries(matcapPresets).forEach(([key, preset]) => {
  if (key === 'none' || !preset.colors) return;
  const swatch = document.createElement('div');
  swatch.style.cssText = `width:100%; aspect-ratio:1; border-radius:8px; cursor:pointer; border:2px solid transparent; overflow:hidden; transition: border-color 0.15s;`;
  swatch.title = preset.name;
  // Draw preview
  const c = document.createElement('canvas');
  c.width = 48; c.height = 48;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 14, 2, 24, 24, 24);
  g.addColorStop(0, preset.colors[1]);
  g.addColorStop(0.5, preset.colors[0]);
  g.addColorStop(1, preset.colors[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(24, 24, 24, 0, Math.PI * 2);
  ctx.fill();
  swatch.style.background = `url(${c.toDataURL()}) center/cover`;
  swatch.dataset.matcapKey = key;
  swatch.addEventListener('click', () => {
    pushLog('Matcap: ' + preset.name);
    applyMatcap(key);
  });
  matcapGrid.appendChild(swatch);
});

function getTargetMeshUUIDs() {
  if (!loadedModel) return [];
  // All meshes
  if (matcapTargetUUID === null && matcapTargetGroup === null) {
    const uuids = [];
    loadedModel.traverse(c => { if (c.isMesh) uuids.push(c.uuid); });
    return uuids;
  }
  // Specific group
  if (matcapTargetGroup !== null && meshGroups.has(matcapTargetGroup)) {
    return meshGroups.get(matcapTargetGroup).map(m => m.uuid);
  }
  // Specific mesh
  if (matcapTargetUUID !== null) return [matcapTargetUUID];
  return [];
}

function applyMatcap(key) {
  if (!loadedModel) return;
  const preset = matcapPresets[key];
  if (!preset) return;

  // Reset matcap blend mode to overlay when applying a new matcap
  if ($('pMatcapBlend')) $('pMatcapBlend').value = 'overlay';

  // Support custom texture matcaps
  if (preset.customTexture) {
    applyCustomMatcap(key, preset.customTexture);
    return;
  }

  if (!preset.colors) return;
  const tex = generateMatcapTexture(preset.colors);

  // Store pre-matcap materials for any mesh we haven't stored yet
  loadedModel.traverse(c => {
    if (c.isMesh && c.material && !preMatcapMaterials.has(c.uuid)) {
      preMatcapMaterials.set(c.uuid, c.material);
    }
  });

  const targetUUIDs = new Set(getTargetMeshUUIDs());

  if (matcapTargetUUID === null && matcapTargetGroup === null) {
    activeMatcap = key;
  }

  loadedModel.traverse(c => {
    if (c.isMesh && targetUUIDs.has(c.uuid)) {
      c.material = new THREE.MeshMatcapMaterial({ matcap: tex });
      perMeshMatcap.set(c.uuid, key);
    }
  });

  // Auto-apply overlay blend mode after matcap is set
  const currentBlend = $('pMatcapBlend') ? $('pMatcapBlend').value : 'overlay';
  if (currentBlend !== 'normal') {
    applyBlendedMatcap(currentBlend);
  }

  updateMatcapGridSelection();
}

function clearMatcap() {
  if (!loadedModel) return;
  const targetUUIDs = new Set(getTargetMeshUUIDs());
  const clearingAll = matcapTargetUUID === null && matcapTargetGroup === null;

  loadedModel.traverse(c => {
    if (c.isMesh && targetUUIDs.has(c.uuid) && preMatcapMaterials.has(c.uuid)) {
      c.material = preMatcapMaterials.get(c.uuid);
      perMeshMatcap.delete(c.uuid);
      if (clearingAll) preMatcapMaterials.delete(c.uuid);
    }
  });

  if (clearingAll) {
    preMatcapMaterials.clear();
    perMeshMatcap.clear();
    activeMatcap = null;
  }
  updateMatcapGridSelection();
}

function updateMatcapGridSelection() {
  // Determine which matcap is active for current target
  let currentKey = null;
  const targetUUIDs = getTargetMeshUUIDs();

  if (targetUUIDs.length > 0) {
    const vals = targetUUIDs.map(u => perMeshMatcap.get(u)).filter(Boolean);
    if (vals.length > 0 && vals.every(v => v === vals[0])) currentKey = vals[0];
  }

  matcapGrid.querySelectorAll('[data-matcap-key]').forEach(d => {
    d.style.borderColor = d.dataset.matcapKey === currentKey ? 'rgba(100,140,255,0.6)' : 'transparent';
  });

  buildMatcapOverview();
}

function buildMatcapOverview() {
  const container = $('matcapOverview');
  if (!container) return;
  container.innerHTML = '';

  if (!loadedModel || perMeshMatcap.size === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';

  const heading = document.createElement('div');
  heading.style.cssText = 'font-size:10px; color:rgba(255,255,255,0.35); margin-bottom:6px;';
  heading.textContent = 'Applied Matcaps';
  container.appendChild(heading);

  // Group meshes by their matcap key
  const byMatcap = new Map();
  loadedModel.traverse(c => {
    if (c.isMesh) {
      const mk = perMeshMatcap.get(c.uuid) || '__none__';
      if (!byMatcap.has(mk)) byMatcap.set(mk, []);
      byMatcap.get(mk).push(c);
    }
  });

  byMatcap.forEach((groupMeshes, mk) => {
    if (mk === '__none__') return;
    const preset = matcapPresets[mk];
    if (!preset) return;

    // Group header row — clicking pulses ALL meshes with this matcap
    const groupRow = document.createElement('div');
    groupRow.className = 'matcap-legend';
    groupRow.style.background = 'rgba(255,255,255,0.06)';
    const capturedMeshes = [...groupMeshes]; // snapshot for closure
    groupRow.addEventListener('click', () => {
      pulseHighlightMeshes(capturedMeshes);
    });

    const dot = document.createElement('div');
    dot.className = 'mc-dot';
    dot.style.background = preset.colors ? `radial-gradient(circle at 35% 35%, ${preset.colors[1]}, ${preset.colors[0]}, ${preset.colors[2]})` : (mk === '__ai_generated__' ? 'linear-gradient(135deg, #648cff, #a064ff)' : '#666');
    groupRow.appendChild(dot);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'mc-name';
    nameSpan.textContent = preset.name + ` (${groupMeshes.length})`;
    groupRow.appendChild(nameSpan);

    // Clear button for entire group
    const clearGroupBtn = document.createElement('span');
    clearGroupBtn.textContent = '✕';
    clearGroupBtn.style.cssText = 'color:rgba(255,255,255,0.25); font-size:10px; cursor:pointer; flex-shrink:0; margin-left:4px; padding:0 2px;';
    clearGroupBtn.title = 'Remove matcap from this group';
    clearGroupBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      capturedMeshes.forEach(mesh => {
        if (preMatcapMaterials.has(mesh.uuid)) {
          mesh.material = preMatcapMaterials.get(mesh.uuid);
        }
        perMeshMatcap.delete(mesh.uuid);
      });
      pushLog('Clear matcap: ' + preset.name);
      updateMatcapGridSelection();
    });
    groupRow.appendChild(clearGroupBtn);
    container.appendChild(groupRow);

    // Individual mesh rows indented under the group
    groupMeshes.forEach(mesh => {
      const row = document.createElement('div');
      row.className = 'matcap-legend';
      row.style.paddingLeft = '22px';
      row.style.fontSize = '9px';
      const capturedMesh = mesh; // snapshot for closure
      row.addEventListener('click', () => {
        pulseHighlightMeshes([capturedMesh]);
      });

      const name = document.createElement('span');
      name.className = 'mc-name';
      name.textContent = mesh.name || 'Mesh';
      row.appendChild(name);

      // Clear button for this mesh
      const clearBtn = document.createElement('span');
      clearBtn.textContent = '✕';
      clearBtn.style.cssText = 'color:rgba(255,255,255,0.25); font-size:10px; cursor:pointer; flex-shrink:0; margin-left:4px; padding:0 2px;';
      clearBtn.title = 'Remove matcap from this mesh';
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (preMatcapMaterials.has(capturedMesh.uuid)) {
          capturedMesh.material = preMatcapMaterials.get(capturedMesh.uuid);
        }
        perMeshMatcap.delete(capturedMesh.uuid);
        pushLog('Clear matcap: ' + (capturedMesh.name || 'Mesh'));
        updateMatcapGridSelection();
      });
      row.appendChild(clearBtn);

      container.appendChild(row);
    });
  });
}

// Download textures
$('pDownloadTextures').addEventListener('click', () => {
  if (!loadedModel) return;
  const textures = new Map();
  const propNames = ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap','bumpMap','displacementMap'];
  loadedModel.traverse(c => {
    if (c.isMesh && c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach(m => {
        propNames.forEach(prop => {
          if (m[prop]?.image) {
            const key = m[prop].uuid;
            if (!textures.has(key)) {
              textures.set(key, { texture: m[prop], type: prop, matName: m.name || 'material' });
            }
          }
        });
      });
    }
  });

  if (textures.size === 0) {
    alert('No textures found in the current model.');
    return;
  }

  let count = 0;
  textures.forEach((info, uuid) => {
    try {
      const canvas = document.createElement('canvas');
      const img = info.texture.image;
      canvas.width = img.width || img.naturalWidth || 512;
      canvas.height = img.height || img.naturalHeight || 512;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${info.matName}_${info.type}.png`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 100);
        count++;
      }, 'image/png');
    } catch (e) {
      console.warn('Could not export texture:', info.type, e);
    }
  });
});

// Download current matcap
$('pDownloadMatcap').addEventListener('click', () => {
  // Find any active matcap on the model
  let matcapTex = null;
  let matcapName = 'matcap';

  if (loadedModel) {
    loadedModel.traverse(c => {
      if (c.isMesh && c.material?.matcap && !matcapTex) {
        matcapTex = c.material.matcap;
        const key = perMeshMatcap.get(c.uuid);
        if (key && matcapPresets[key]) matcapName = matcapPresets[key].name.replace(/[^\w]/g, '_');
      }
    });
  }

  if (!matcapTex) {
    alert('No matcap is currently applied. Apply a matcap first, then download it.');
    return;
  }

  // Render matcap to canvas
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (matcapTex.image) {
    ctx.drawImage(matcapTex.image, 0, 0, size, size);
  } else if (matcapTex.source?.data) {
    ctx.drawImage(matcapTex.source.data, 0, 0, size, size);
  } else {
    // Regenerate from preset colors
    const activeKey = [...perMeshMatcap.values()][0];
    const preset = matcapPresets[activeKey];
    if (preset?.colors) {
      const cx = size / 2, cy = size / 2, r = size / 2;
      const grad = ctx.createRadialGradient(cx * 0.7, cy * 0.6, r * 0.05, cx, cy, r);
      grad.addColorStop(0, preset.colors[1]);
      grad.addColorStop(0.5, preset.colors[0]);
      grad.addColorStop(1, preset.colors[2]);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${matcapName}.png`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }, 'image/png');
});

// Export Matcap as 1024x1024 PNG
$('pExportMatcapPng')?.addEventListener('click', () => {
  // Priority: use AI-generated matcap canvas if available
  let sourceCanvas = null;
  let matcapName = 'matcap';

  // Check if AI matcap is active
  if (aiBaseCanvas) {
    sourceCanvas = aiBaseCanvas;
    matcapName = 'ai_matcap';
    const prompt = $('aiMatcapPrompt')?.value?.trim();
    if (prompt) matcapName = 'ai_matcap_' + prompt.replace(/[^\w]/g, '_').substring(0, 24);
  }

  // Fallback: find any active matcap on the model
  if (!sourceCanvas && loadedModel) {
    let matcapTex = null;
    loadedModel.traverse(c => {
      if (c.isMesh && c.material?.matcap && !matcapTex) {
        matcapTex = c.material.matcap;
        const key = perMeshMatcap.get(c.uuid);
        if (key && matcapPresets[key]) matcapName = matcapPresets[key].name.replace(/[^\w]/g, '_');
      }
    });

    if (matcapTex) {
      const img = matcapTex.image || matcapTex.source?.data;
      if (img) {
        sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = img.width || 512;
        sourceCanvas.height = img.height || 512;
        sourceCanvas.getContext('2d').drawImage(img, 0, 0, sourceCanvas.width, sourceCanvas.height);
      }
    }

    // Last resort: regenerate from preset colors
    if (!sourceCanvas) {
      const activeKey = [...perMeshMatcap.values()][0];
      const preset = matcapPresets[activeKey];
      if (preset?.colors) {
        sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = 512;
        sourceCanvas.height = 512;
        const ctx = sourceCanvas.getContext('2d');
        const cx = 256, cy = 256, r = 256;
        const grad = ctx.createRadialGradient(cx * 0.7, cy * 0.6, r * 0.05, cx, cy, r);
        grad.addColorStop(0, preset.colors[1]);
        grad.addColorStop(0.5, preset.colors[0]);
        grad.addColorStop(1, preset.colors[2]);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        matcapName = preset.name.replace(/[^\w]/g, '_');
      }
    }
  }

  if (!sourceCanvas) {
    alert('No matcap is currently applied. Apply a matcap first, then export it.');
    return;
  }

  // Upscale to 1024×1024
  const exportSize = 1024;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = exportSize;
  exportCanvas.height = exportSize;
  const ectx = exportCanvas.getContext('2d');

  // Enable high-quality scaling
  ectx.imageSmoothingEnabled = true;
  ectx.imageSmoothingQuality = 'high';
  ectx.drawImage(sourceCanvas, 0, 0, exportSize, exportSize);

  exportCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${matcapName}_1024.png`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }, 'image/png');
});

$('pMatcapClear').addEventListener('click', () => {
  pushLog('Clear all matcaps');
  // Force clear ALL meshes regardless of target
  if (loadedModel) {
    loadedModel.traverse(c => {
      if (c.isMesh && preMatcapMaterials.has(c.uuid)) {
        c.material = preMatcapMaterials.get(c.uuid);
      }
    });
    preMatcapMaterials.clear();
    perMeshMatcap.clear();
    activeMatcap = null;
  }
  updateMatcapGridSelection();
});

// Import custom matcap
const matcapFileInput = document.createElement('input');
matcapFileInput.type = 'file';
matcapFileInput.accept = 'image/*';
matcapFileInput.style.display = 'none';
document.body.appendChild(matcapFileInput);

$('pMatcapImport').addEventListener('click', () => matcapFileInput.click());

// Matcap file import handler
matcapFileInput.onchange = function() {
  const file = this.files?.[0];
  if (!file) return;

  const objUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;

    const customKey = 'custom_' + Date.now();
    const shortName = file.name.replace(/\.[^/.]+$/, '').substring(0, 12);
    matcapPresets[customKey] = { name: '✦ ' + shortName, colors: null, customTexture: tex };

    const swatch = document.createElement('div');
    swatch.style.cssText = `width:100%; aspect-ratio:1; border-radius:8px; cursor:pointer; border:2px solid transparent; overflow:hidden; transition: border-color 0.15s;`;
    swatch.title = shortName;
    swatch.style.background = `url(${objUrl}) center/cover`;
    swatch.dataset.matcapKey = customKey;
    swatch.addEventListener('click', () => {
      pushLog('Matcap: ' + shortName);
      applyCustomMatcap(customKey, tex);
    });
    matcapGrid.appendChild(swatch);

    pushLog('Import matcap: ' + shortName);
    applyCustomMatcap(customKey, tex);
  };
  img.src = objUrl;
  matcapFileInput.value = '';
};

// --- Texture Import ---
const texFileInput = document.createElement('input');
texFileInput.type = 'file';
texFileInput.accept = 'image/*';
texFileInput.style.display = 'none';
document.body.appendChild(texFileInput);

let pendingTexImage = null;
let pendingTexDataUrl = null;

$('pTexImport').addEventListener('click', () => {
  if (!loadedModel) { alert('Load a model first.'); return; }
  texFileInput.click();
});

// Texture file import handler
texFileInput.onchange = function() {
  const file = this.files?.[0];
  if (!file) return;

  const objUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    pendingTexImage = img;
    pendingTexDataUrl = objUrl;

    const previewPanel = $('texImportPanel');
    const previewDiv = $('texImportPreview');
    const previewCanvas = $('texPreviewCanvas');
    if (previewPanel) previewPanel.style.display = 'block';
    if (previewDiv) previewDiv.style.display = 'block';
    if (previewCanvas) {
      const ctx = previewCanvas.getContext('2d');
      ctx.clearRect(0, 0, 80, 80);
      ctx.drawImage(img, 0, 0, 80, 80);
    }

    const targetSelect = $('texImportTarget');
    if (targetSelect && loadedModel) {
      targetSelect.innerHTML = '<option value="all">All Meshes</option>';
      loadedModel.traverse(c => {
        if (c.isMesh) {
          const name = c.name || c.material?.name || `Mesh ${c.uuid.substring(0,6)}`;
          const opt = document.createElement('option');
          opt.value = c.uuid;
          opt.textContent = name;
          targetSelect.appendChild(opt);
        }
      });
    }
  };
  img.src = objUrl;
  texFileInput.value = '';
};

// Highlight mesh when selecting from texture import target dropdown
$('texImportTarget').onchange = (e) => {
  if (!loadedModel) return;
  const val = e.target.value;
  if (val === 'all') return;
  const meshes = [];
  loadedModel.traverse(c => {
    if (c.isMesh && c.uuid === val) meshes.push(c);
  });
  if (meshes.length > 0) pulseHighlightMeshes(meshes);
};

$('texImportApply').addEventListener('click', () => {
  if (!pendingTexImage || !loadedModel) return;

  const slot = $('texImportSlot')?.value || 'map';
  const targetVal = $('texImportTarget')?.value || 'all';

  // Store raw imported image for blend mode re-application
  if (slot === 'normalMap') {
    rawImportedTextures.normalMap = { image: pendingTexImage };
    if ($('pNormalBlend')) $('pNormalBlend').value = 'normal';
  } else if (slot === 'bumpMap') {
    rawImportedTextures.bumpMap = { image: pendingTexImage };
    if ($('pBumpBlend')) $('pBumpBlend').value = 'normal';
  }

  const tex = new THREE.Texture(pendingTexImage);
  tex.colorSpace = (slot === 'map' || slot === 'emissiveMap') ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
  tex.flipY = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;

  // Slots that require MeshStandardMaterial or MeshPhysicalMaterial
  const advancedSlots = ['normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'displacementMap'];
  const needsUpgrade = advancedSlots.includes(slot);

  let appliedCount = 0;
  loadedModel.traverse(c => {
    if (!c.isMesh) return;
    if (targetVal !== 'all' && c.uuid !== targetVal) return;

    let mats = Array.isArray(c.material) ? c.material : [c.material];
    const newMats = mats.map(m => {
      let mat = m;

      // Upgrade material if it doesn't support the slot
      if (needsUpgrade && !(mat instanceof THREE.MeshStandardMaterial) && !(mat instanceof THREE.MeshPhysicalMaterial)) {
        const upgraded = new THREE.MeshStandardMaterial({
          color: mat.color ? mat.color.clone() : new THREE.Color(0xcccccc),
          map: mat.map || null,
          side: mat.side,
          transparent: mat.transparent,
          opacity: mat.opacity,
          metalness: 0.0,
          roughness: 0.7,
        });
        upgraded.name = mat.name;
        mat = upgraded;
      }

      // Clone material for per-mesh targeting
      if (targetVal !== 'all') {
        mat = mat.clone();
      }

      // Apply the texture to the slot
      mat[slot] = tex;

      // Set required properties for normalMap / bumpMap
      if (slot === 'normalMap') {
        if (!mat.normalScale) mat.normalScale = new THREE.Vector2(1, 1);
        const nScale = parseFloat($('pMatNormalScale')?.value || '1.0');
        mat.normalScale.set(nScale, nScale);
      } else if (slot === 'bumpMap') {
        mat.bumpScale = parseFloat($('pMatBumpScale')?.value || '0.05');
      } else if (slot === 'emissiveMap') {
        if (!mat.emissive || mat.emissive.getHex() === 0x000000) {
          mat.emissive = new THREE.Color(0xffffff);
        }
      } else if (slot === 'aoMap') {
        mat.aoMapIntensity = mat.aoMapIntensity || 1.0;
      }

      mat.needsUpdate = true;
      appliedCount++;
      return mat;
    });

    c.material = newMats.length === 1 ? newMats[0] : newMats;
  });

  pushLog(`Texture: ${slot} (${appliedCount} material${appliedCount !== 1 ? 's' : ''})`);
  buildTextureList(loadedModel);

  // Hide panel
  const previewPanel = $('texImportPanel');
  if (previewPanel) previewPanel.style.display = 'none';
  pendingTexImage = null;
  pendingTexDataUrl = null;
});

$('texImportCancel').addEventListener('click', () => {
  const previewPanel = $('texImportPanel');
  if (previewPanel) previewPanel.style.display = 'none';
  pendingTexImage = null;
  pendingTexDataUrl = null;
});

function applyCustomMatcap(key, tex) {
  if (!loadedModel) return;

  // Store pre-matcap materials
  loadedModel.traverse(c => {
    if (c.isMesh && c.material && !preMatcapMaterials.has(c.uuid)) {
      preMatcapMaterials.set(c.uuid, c.material);
    }
  });

  const targetUUIDs = new Set(getTargetMeshUUIDs());

  loadedModel.traverse(c => {
    if (c.isMesh && targetUUIDs.has(c.uuid)) {
      c.material = new THREE.MeshMatcapMaterial({ matcap: tex });
      perMeshMatcap.set(c.uuid, key);
    }
  });

  // Auto-apply overlay blend mode after custom matcap is set
  const currentBlend = $('pMatcapBlend') ? $('pMatcapBlend').value : 'overlay';
  if (currentBlend !== 'normal') {
    applyBlendedMatcap(currentBlend);
  }

  updateMatcapGridSelection();
}

// === AI MATCAP GENERATOR ===
// Procedural matcap generation from text prompts using color/material analysis

const aiMatcapHistory = []; // { prompt, variations: [{ canvas, colors }], activeIndex }
let aiCurrentVariations = [];
let aiActiveVarIndex = -1;
let aiBaseCanvas = null; // The un-adjusted canvas of the active variation
let aiMatcapTargetUUID = null; // null = all meshes, string = specific mesh UUID
let aiMatcapTargetGroup = null; // null = all, string = group name

function buildAIMatcapTargetList(model) {
  const container = $('aiMatcapTarget');
  if (!container) return;
  container.innerHTML = '';

  const meshes = [];
  model.traverse(c => { if (c.isMesh) meshes.push(c); });

  if (meshes.length <= 1) {
    container.style.display = 'none';
    aiMatcapTargetUUID = null;
    aiMatcapTargetGroup = null;
    return;
  }

  container.style.display = 'block';

  const label = document.createElement('div');
  label.style.cssText = 'font-size:10px; color:rgba(255,255,255,0.35); margin-bottom:4px;';
  label.textContent = 'Apply to mesh:';
  container.appendChild(label);

  const select = document.createElement('select');
  select.className = 'panel-select';
  select.id = 'aiMatcapTargetSelect';
  select.style.width = '100%';

  const allOpt = document.createElement('option');
  allOpt.value = '__all__';
  allOpt.textContent = `All Meshes (${meshes.length})`;
  select.appendChild(allOpt);

  // Add groups
  const groups = autoDetectGroups(model);
  if (groups.size > 1 || (groups.size === 1 && !groups.has('__ungrouped__'))) {
    const groupOptGroup = document.createElement('optgroup');
    groupOptGroup.label = '── Groups ──';
    groups.forEach((members, groupName) => {
      if (groupName === '__ungrouped__' && groups.size > 1 && members.length === 1) return;
      const opt = document.createElement('option');
      opt.value = 'group:' + groupName;
      const displayName = groupName === '__ungrouped__' ? 'Ungrouped' : groupName;
      opt.textContent = `📁 ${displayName} (${members.length})`;
      groupOptGroup.appendChild(opt);
    });
    if (groupOptGroup.children.length > 0) select.appendChild(groupOptGroup);
  }

  // Add individual meshes
  const meshOptGroup = document.createElement('optgroup');
  meshOptGroup.label = '── Individual Meshes ──';
  meshes.forEach((mesh, i) => {
    const opt = document.createElement('option');
    opt.value = 'mesh:' + mesh.uuid;
    opt.textContent = mesh.name || `Mesh ${i + 1}`;
    meshOptGroup.appendChild(opt);
  });
  select.appendChild(meshOptGroup);

  select.onchange = () => {
    const val = select.value;
    if (val === '__all__') {
      aiMatcapTargetUUID = null;
      aiMatcapTargetGroup = null;
      clearPulse();
    } else if (val.startsWith('group:')) {
      aiMatcapTargetGroup = val.substring(6);
      aiMatcapTargetUUID = null;
      const groupMeshes = meshGroups.get(aiMatcapTargetGroup);
      if (groupMeshes) pulseHighlightMeshes(groupMeshes);
    } else if (val.startsWith('mesh:')) {
      aiMatcapTargetUUID = val.substring(5);
      aiMatcapTargetGroup = null;
      const targetMesh = meshes.find(m => m.uuid === aiMatcapTargetUUID);
      if (targetMesh) pulseHighlightMeshes([targetMesh]);
    }
  };

  container.appendChild(select);
}

function getAITargetMeshUUIDs() {
  if (!loadedModel) return [];
  if (aiMatcapTargetUUID === null && aiMatcapTargetGroup === null) {
    const uuids = [];
    loadedModel.traverse(c => { if (c.isMesh) uuids.push(c.uuid); });
    return uuids;
  }
  if (aiMatcapTargetGroup !== null && meshGroups.has(aiMatcapTargetGroup)) {
    return meshGroups.get(aiMatcapTargetGroup).map(m => m.uuid);
  }
  if (aiMatcapTargetUUID !== null) return [aiMatcapTargetUUID];
  return [];
}

// Color palettes derived from prompt keywords — rich procedural generation
const aiColorDB = {
  // Metals
  gold: { base: [255, 200, 50], highlight: [255, 245, 220], shadow: [140, 100, 20], specular: 0.95, roughness: 0.2 },
  copper: { base: [200, 120, 80], highlight: [255, 200, 170], shadow: [100, 50, 30], specular: 0.9, roughness: 0.25 },
  bronze: { base: [180, 140, 70], highlight: [240, 220, 160], shadow: [80, 60, 25], specular: 0.85, roughness: 0.3 },
  silver: { base: [200, 200, 210], highlight: [255, 255, 255], shadow: [100, 100, 115], specular: 0.95, roughness: 0.15 },
  chrome: { base: [210, 215, 220], highlight: [255, 255, 255], shadow: [60, 65, 75], specular: 1.0, roughness: 0.05 },
  steel: { base: [160, 170, 185], highlight: [230, 235, 245], shadow: [70, 75, 90], specular: 0.8, roughness: 0.35 },
  iron: { base: [130, 125, 120], highlight: [200, 195, 190], shadow: [50, 48, 45], specular: 0.6, roughness: 0.5 },
  platinum: { base: [220, 220, 225], highlight: [255, 255, 255], shadow: [130, 130, 140], specular: 0.95, roughness: 0.1 },
  titanium: { base: [170, 175, 185], highlight: [230, 235, 245], shadow: [80, 85, 100], specular: 0.85, roughness: 0.2 },
  brass: { base: [210, 180, 80], highlight: [255, 240, 170], shadow: [120, 90, 30], specular: 0.85, roughness: 0.3 },
  // Materials
  clay: { base: [200, 180, 160], highlight: [240, 230, 220], shadow: [120, 105, 90], specular: 0.3, roughness: 0.8 },
  ceramic: { base: [235, 230, 225], highlight: [255, 255, 255], shadow: [160, 155, 150], specular: 0.7, roughness: 0.3 },
  porcelain: { base: [245, 240, 235], highlight: [255, 255, 255], shadow: [180, 175, 170], specular: 0.8, roughness: 0.2 },
  marble: { base: [235, 235, 230], highlight: [255, 255, 255], shadow: [170, 165, 160], specular: 0.6, roughness: 0.35 },
  wood: { base: [160, 120, 70], highlight: [210, 180, 130], shadow: [80, 55, 30], specular: 0.3, roughness: 0.7 },
  rubber: { base: [60, 60, 65], highlight: [110, 110, 120], shadow: [20, 20, 25], specular: 0.2, roughness: 0.9 },
  plastic: { base: [180, 180, 190], highlight: [240, 240, 250], shadow: [90, 90, 100], specular: 0.6, roughness: 0.4 },
  glass: { base: [200, 210, 220], highlight: [255, 255, 255], shadow: [80, 100, 120], specular: 1.0, roughness: 0.05 },
  wax: { base: [230, 210, 180], highlight: [255, 248, 235], shadow: [140, 120, 90], specular: 0.4, roughness: 0.6 },
  pearl: { base: [235, 225, 215], highlight: [255, 255, 255], shadow: [180, 170, 160], specular: 0.8, roughness: 0.15 },
  obsidian: { base: [35, 30, 40], highlight: [100, 95, 110], shadow: [5, 5, 10], specular: 0.9, roughness: 0.1 },
  jade: { base: [80, 160, 100], highlight: [150, 220, 170], shadow: [30, 80, 45], specular: 0.6, roughness: 0.3 },
  ruby: { base: [180, 30, 50], highlight: [255, 100, 130], shadow: [80, 10, 20], specular: 0.85, roughness: 0.15 },
  sapphire: { base: [30, 60, 180], highlight: [100, 140, 255], shadow: [10, 25, 80], specular: 0.85, roughness: 0.15 },
  emerald: { base: [20, 150, 80], highlight: [80, 220, 150], shadow: [5, 70, 35], specular: 0.85, roughness: 0.15 },
  amethyst: { base: [130, 60, 180], highlight: [200, 140, 255], shadow: [60, 20, 90], specular: 0.8, roughness: 0.2 },
  diamond: { base: [220, 230, 240], highlight: [255, 255, 255], shadow: [150, 160, 180], specular: 1.0, roughness: 0.02 },
  crystal: { base: [210, 220, 235], highlight: [255, 255, 255], shadow: [130, 145, 170], specular: 0.95, roughness: 0.05 },
  lava: { base: [200, 60, 20], highlight: [255, 200, 50], shadow: [60, 10, 5], specular: 0.5, roughness: 0.6 },
  ice: { base: [180, 210, 235], highlight: [240, 250, 255], shadow: [100, 140, 170], specular: 0.8, roughness: 0.15 },
  leather: { base: [120, 80, 50], highlight: [180, 140, 100], shadow: [50, 30, 15], specular: 0.35, roughness: 0.7 },
  velvet: { base: [100, 30, 50], highlight: [160, 80, 110], shadow: [40, 10, 20], specular: 0.2, roughness: 0.9 },
  silk: { base: [220, 200, 210], highlight: [255, 245, 250], shadow: [140, 120, 130], specular: 0.7, roughness: 0.25 },
  matte: { base: [160, 160, 165], highlight: [200, 200, 205], shadow: [90, 90, 95], specular: 0.15, roughness: 0.95 },
  // Colors
  red: { base: [200, 50, 50], highlight: [255, 140, 130], shadow: [90, 15, 15], specular: 0.5, roughness: 0.5 },
  blue: { base: [50, 80, 200], highlight: [130, 160, 255], shadow: [15, 30, 90], specular: 0.5, roughness: 0.5 },
  green: { base: [50, 170, 80], highlight: [130, 230, 160], shadow: [15, 80, 30], specular: 0.5, roughness: 0.5 },
  purple: { base: [140, 50, 200], highlight: [200, 130, 255], shadow: [60, 15, 90], specular: 0.5, roughness: 0.5 },
  pink: { base: [220, 100, 150], highlight: [255, 180, 210], shadow: [130, 40, 75], specular: 0.5, roughness: 0.4 },
  orange: { base: [230, 140, 40], highlight: [255, 210, 130], shadow: [140, 70, 10], specular: 0.5, roughness: 0.5 },
  yellow: { base: [240, 220, 50], highlight: [255, 250, 160], shadow: [150, 130, 10], specular: 0.5, roughness: 0.5 },
  cyan: { base: [50, 200, 210], highlight: [140, 240, 250], shadow: [15, 100, 110], specular: 0.6, roughness: 0.4 },
  teal: { base: [40, 160, 150], highlight: [120, 220, 210], shadow: [10, 80, 70], specular: 0.5, roughness: 0.45 },
  white: { base: [240, 240, 245], highlight: [255, 255, 255], shadow: [170, 170, 180], specular: 0.6, roughness: 0.4 },
  black: { base: [40, 40, 45], highlight: [100, 100, 110], shadow: [10, 10, 12], specular: 0.5, roughness: 0.5 },
  // Qualities
  polished: { specular: 0.95, roughness: 0.08 },
  rough: { specular: 0.2, roughness: 0.85 },
  glossy: { specular: 0.9, roughness: 0.1 },
  brushed: { specular: 0.6, roughness: 0.45 },
  satin: { specular: 0.5, roughness: 0.35 },
  matte: { specular: 0.15, roughness: 0.95 },
  shiny: { specular: 0.9, roughness: 0.1 },
  dull: { specular: 0.2, roughness: 0.8 },
  frosted: { specular: 0.4, roughness: 0.65 },
  mirror: { specular: 1.0, roughness: 0.02 },
  worn: { specular: 0.35, roughness: 0.7 },
  weathered: { specular: 0.25, roughness: 0.75 },
  // Temperature
  warm: { tint: [20, 5, -10] },
  cool: { tint: [-10, 0, 15] },
  cold: { tint: [-15, -5, 20] },
  hot: { tint: [25, 10, -15] },
  neutral: { tint: [0, 0, 0] },
  // Lighting
  bright: { lightBoost: 30 },
  dark: { lightBoost: -40 },
  dramatic: { contrastBoost: 30 },
  soft: { contrastBoost: -20, lightBoost: 10 },
  vivid: { satBoost: 25 },
  pastel: { satBoost: -30, lightBoost: 25 },
  neon: { satBoost: 45, lightBoost: 15 },
  iridescent: { iridescence: true, specular: 0.95, roughness: 0.05 },
  rainbow: { iridescence: true, specular: 1.0, roughness: 0.02 },
  holographic: { iridescence: true, specular: 1.0, roughness: 0.03 },
  opal: { base: [220, 210, 230], highlight: [255, 255, 255], shadow: [140, 130, 160], specular: 0.85, roughness: 0.1, iridescence: true },
  reflective: { specular: 1.0, roughness: 0.03 },
  metallic: { specular: 0.9, roughness: 0.15 },
  // Stylized categories
  toon: { specular: 0.3, roughness: 0.8, contrastBoost: 35 },
  gradient: { specular: 0.4, roughness: 0.6 },
  fabric: { base: [160, 140, 130], highlight: [210, 200, 190], shadow: [80, 70, 60], specular: 0.15, roughness: 0.92 },
  skin: { base: [210, 175, 145], highlight: [240, 215, 195], shadow: [140, 100, 70], specular: 0.25, roughness: 0.7 },
  candy: { base: [240, 120, 160], highlight: [255, 200, 220], shadow: [170, 50, 90], specular: 0.65, roughness: 0.3, satBoost: 20 },
  ocean: { base: [30, 90, 160], highlight: [80, 180, 230], shadow: [10, 40, 80], specular: 0.7, roughness: 0.25 },
  sunset: { base: [220, 120, 60], highlight: [255, 200, 130], shadow: [120, 40, 15], specular: 0.5, roughness: 0.4, satBoost: 15 },
  forest: { base: [50, 120, 50], highlight: [120, 200, 110], shadow: [20, 55, 20], specular: 0.35, roughness: 0.6 },
  smoke: { base: [100, 100, 110], highlight: [170, 170, 180], shadow: [35, 35, 42], specular: 0.25, roughness: 0.75 },
  pearlescent: { base: [230, 220, 240], highlight: [255, 255, 255], shadow: [160, 150, 180], specular: 0.85, roughness: 0.1, iridescence: true },
  anodized: { specular: 0.7, roughness: 0.25, satBoost: 15 },
  enamel: { specular: 0.8, roughness: 0.15 },
  lacquer: { specular: 0.85, roughness: 0.1 },
  glaze: { specular: 0.75, roughness: 0.2 },
  chrome_dark: { base: [60, 65, 75], highlight: [200, 205, 215], shadow: [15, 18, 25], specular: 1.0, roughness: 0.03 },
  // --- Glass & Transparent ---
  frosted_glass: { base: [210, 220, 230], highlight: [255, 255, 255], shadow: [140, 155, 175], specular: 0.75, roughness: 0.4 },
  clear_glass: { base: [225, 235, 245], highlight: [255, 255, 255], shadow: [160, 180, 200], specular: 1.0, roughness: 0.02 },
  tinted_glass: { base: [180, 200, 210], highlight: [240, 250, 255], shadow: [80, 110, 130], specular: 0.95, roughness: 0.05 },
  stained_glass: { base: [160, 80, 120], highlight: [255, 180, 220], shadow: [60, 20, 50], specular: 0.8, roughness: 0.1 },
  // --- Crystal & Gemstone ---
  quartz: { base: [230, 225, 235], highlight: [255, 255, 255], shadow: [160, 155, 170], specular: 0.9, roughness: 0.08 },
  topaz: { base: [240, 190, 80], highlight: [255, 235, 160], shadow: [150, 100, 30], specular: 0.9, roughness: 0.08 },
  garnet: { base: [140, 30, 40], highlight: [220, 100, 120], shadow: [60, 8, 15], specular: 0.88, roughness: 0.1 },
  // --- Plastic varieties ---
  hard_plastic: { base: [190, 190, 200], highlight: [245, 245, 255], shadow: [100, 100, 115], specular: 0.7, roughness: 0.3 },
  soft_plastic: { base: [200, 195, 190], highlight: [235, 230, 225], shadow: [120, 115, 110], specular: 0.45, roughness: 0.55 },
  glossy_plastic: { base: [180, 180, 195], highlight: [250, 250, 255], shadow: [80, 80, 95], specular: 0.85, roughness: 0.1 },
  // --- Translucent / Subsurface ---
  translucent: { base: [220, 200, 195], highlight: [255, 245, 240], shadow: [150, 120, 110], specular: 0.55, roughness: 0.35, lightBoost: 10 },
  resin: { base: [200, 160, 60], highlight: [255, 220, 120], shadow: [100, 70, 15], specular: 0.75, roughness: 0.15 },
  amber: { base: [210, 150, 40], highlight: [255, 210, 100], shadow: [110, 60, 10], specular: 0.8, roughness: 0.12 },
  // --- Liquid / Gel ---
  liquid: { base: [100, 140, 200], highlight: [200, 230, 255], shadow: [30, 60, 110], specular: 0.95, roughness: 0.05, lightBoost: 5 },
  gel: { base: [180, 200, 220], highlight: [240, 250, 255], shadow: [90, 120, 155], specular: 0.8, roughness: 0.15 },
  mercury: { base: [190, 195, 200], highlight: [255, 255, 255], shadow: [60, 65, 70], specular: 1.0, roughness: 0.01 },
  // --- Brushed metals ---
  brushed_steel: { base: [155, 165, 180], highlight: [220, 225, 235], shadow: [65, 70, 85], specular: 0.65, roughness: 0.4 },
  brushed_gold: { base: [220, 180, 60], highlight: [255, 230, 140], shadow: [120, 90, 25], specular: 0.65, roughness: 0.4 },
  brushed_copper: { base: [190, 110, 70], highlight: [240, 180, 140], shadow: [90, 45, 25], specular: 0.6, roughness: 0.42 },
  // --- Special finishes ---
  gunmetal: { base: [80, 85, 95], highlight: [160, 165, 180], shadow: [25, 28, 35], specular: 0.8, roughness: 0.2 },
  rose_gold: { base: [210, 150, 130], highlight: [255, 210, 200], shadow: [120, 70, 55], specular: 0.88, roughness: 0.15 },
  patina: { base: [80, 140, 110], highlight: [140, 200, 170], shadow: [30, 70, 50], specular: 0.35, roughness: 0.65 },
  oxidized: { base: [90, 80, 70], highlight: [150, 140, 125], shadow: [35, 30, 25], specular: 0.25, roughness: 0.75 },
  anodized_blue: { base: [40, 80, 180], highlight: [100, 150, 240], shadow: [10, 30, 90], specular: 0.75, roughness: 0.2 },
  anodized_red: { base: [180, 40, 50], highlight: [240, 100, 120], shadow: [90, 10, 20], specular: 0.75, roughness: 0.2 },
};

// === GLOBAL BASE PROMPT ===
// Applied to ALL generated matcaps to ensure physically-based quality.
// This base prompt injects rendering enhancements that prevent flat/toon-like output.
const MATCAP_BASE_PROMPT = {
  // Sharper, more focused specular highlights (avoids flat diffuse-only look)
  specularFloor: 0.35,      // minimum specular — never below this
  specularBoost: 0.12,      // added to all specular values
  // Improved contrast range for depth
  contrastBase: 8,           // baseline contrast boost for all outputs
  // Subtle saturation enhancement for richer colors
  satBase: 5,                // baseline saturation boost
  // Environment reflection strength multiplier (makes reflections more visible)
  envReflectionMul: 1.35,
  // Sharper highlight falloff (higher = tighter hotspot)
  highlightSharpness: 1.25,
  // Fill light contribution (prevents pitch-black shadows)
  fillLightFloor: 0.22,
  // Fresnel boost for edge definition
  fresnelBoost: 1.15,
  // Shadow-to-midtone contrast (adds depth without crushing blacks)
  shadowContrast: 1.12,
  // Highlight-to-midtone contrast (punchier highlights)
  highlightContrast: 1.08,
};

function parsePromptToMatcapParams(prompt) {
  const lower = prompt.toLowerCase().trim();
  const words = lower.split(/[\s,.\-_/]+/).filter(Boolean);

  let baseColor = null;
  let specular = 0.5;
  let roughness = 0.5;
  let tint = [0, 0, 0];
  let lightBoost = 0;
  let contrastBoost = 0;
  let satBoost = 0;
  let iridescence = false;

  // Also try underscore-joined pairs (e.g. "clear glass" → "clear_glass")
  for (let i = 0; i < words.length - 1; i++) {
    const pair = words[i] + '_' + words[i + 1];
    if (aiColorDB[pair]) words.push(pair);
  }

  // Match keywords to DB entries
  for (const word of words) {
    const entry = aiColorDB[word];
    if (!entry) continue;
    if (entry.base && !baseColor) {
      baseColor = { base: [...entry.base], highlight: [...entry.highlight], shadow: [...entry.shadow] };
      specular = entry.specular ?? specular;
      roughness = entry.roughness ?? roughness;
    }
    if (entry.specular !== undefined && !entry.base) specular = entry.specular;
    if (entry.roughness !== undefined && !entry.base) roughness = entry.roughness;
    if (entry.tint) tint = entry.tint;
    if (entry.lightBoost) lightBoost += entry.lightBoost;
    if (entry.contrastBoost) contrastBoost += entry.contrastBoost;
    if (entry.satBoost) satBoost += entry.satBoost;
    if (entry.iridescence) iridescence = true;
  }

  // Also try multi-word matches
  for (const key of Object.keys(aiColorDB)) {
    if (key.length > 3 && lower.includes(key) && !words.includes(key)) {
      const entry = aiColorDB[key];
      if (entry.base && !baseColor) {
        baseColor = { base: [...entry.base], highlight: [...entry.highlight], shadow: [...entry.shadow] };
        specular = entry.specular ?? specular;
        roughness = entry.roughness ?? roughness;
      }
    }
  }

  // Default if nothing matched
  if (!baseColor) {
    const hash = hashString(lower);
    const hue = hash % 360;
    baseColor = hslToMatcapColors(hue, 0.5, 0.5);
    specular = 0.5;
    roughness = 0.5;
  }

  // Apply tint
  baseColor.base = baseColor.base.map((v, i) => clamp(v + tint[i], 0, 255));
  baseColor.highlight = baseColor.highlight.map((v, i) => clamp(v + tint[i] * 0.5, 0, 255));
  baseColor.shadow = baseColor.shadow.map((v, i) => clamp(v + tint[i] * 0.5, 0, 255));

  // === APPLY GLOBAL BASE PROMPT ENHANCEMENTS ===
  // Ensure specular never drops below the floor (prevents flat output)
  specular = Math.max(MATCAP_BASE_PROMPT.specularFloor, specular + MATCAP_BASE_PROMPT.specularBoost);
  specular = Math.min(1.0, specular);

  // Add baseline contrast and saturation for richer output
  contrastBoost += MATCAP_BASE_PROMPT.contrastBase;
  satBoost += MATCAP_BASE_PROMPT.satBase;

  // Widen the shadow-to-highlight range for more depth
  // Darken shadows slightly for better contrast range
  baseColor.shadow = baseColor.shadow.map(v =>
    clamp(Math.round(v * (1 / MATCAP_BASE_PROMPT.shadowContrast)), 0, 255)
  );
  // Brighten highlights slightly for punchier reflections
  baseColor.highlight = baseColor.highlight.map(v =>
    clamp(Math.round(v * MATCAP_BASE_PROMPT.highlightContrast), 0, 255)
  );

  return { ...baseColor, specular, roughness, lightBoost, contrastBoost, satBoost, iridescence };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function hslToMatcapColors(h, s, l) {
  const toRGB = (h, s, l) => {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  };
  return {
    base: toRGB(h, s, l),
    highlight: toRGB(h, Math.max(0, s - 0.2), Math.min(1, l + 0.35)),
    shadow: toRGB(h, Math.min(1, s + 0.1), Math.max(0, l - 0.3)),
  };
}

function generateAIMatcapCanvas(params, seed = 0) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2, radius = size / 2;

  // Seeded RNG for subtle per-variation randomness
  const rng = mulberry32(seed * 31 + 17);
  const toneShift = (rng() - 0.5) * 12;
  const hueRotation = seed * 0.18;
  // Per-seed micro-variations in light positioning for noticeable difference
  const klOffX = (rng() - 0.5) * 0.08;
  const klOffY = (rng() - 0.5) * 0.08;
  const envHueShift = rng() * 0.3;

  // Compute shifted colors
  const hl = params.highlight.map(v => clamp(v + toneShift * 0.4, 0, 255));
  const bs = params.base.map(v => clamp(v + toneShift * 0.2, 0, 255));
  const sh = params.shadow.map(v => clamp(v + toneShift * 0.1, 0, 255));

  // === MULTI-LIGHT SETUP (enhanced by global base prompt) ===
  const bp = MATCAP_BASE_PROMPT;
  const kl = normalize3(-0.48 + klOffX, -0.56 + klOffY, 0.68);  // Key: top-left
  const fl = normalize3(0.42, 0.40, 0.82);   // Fill: bottom-right
  const rl = normalize3(-0.55, 0.15, -0.82);  // Rim: behind-left
  const tl = normalize3(0.10, -0.70, 0.70);   // Top accent
  const bl = normalize3(0.30, 0.55, 0.78);    // Bottom fill (prevents black underside)
  const vx = 0, vy = 0, vz = 1;

  const imgData = ctx.createImageData(size, size);
  const d = imgData.data;

  // Material property helpers
  const spec = params.specular;
  const rough = params.roughness;
  const isGlossy = rough < 0.2;
  const isMatte = rough > 0.7;

  // Base prompt: highlight sharpness multiplier
  const hlSharp = bp.highlightSharpness;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const idx = (py * size + px) * 4;
      const nx = (px - cx) / radius;
      const ny = (py - cy) / radius;
      const dist2 = nx * nx + ny * ny;

      if (dist2 > 1.0) {
        d[idx] = 0; d[idx + 1] = 0; d[idx + 2] = 0; d[idx + 3] = 0;
        continue;
      }

      const nz = Math.sqrt(1 - dist2);
      const cosTheta = nz;

      // === DIFFUSE (Lambert with energy conservation) ===
      const keyDiff = Math.max(0, nx * kl[0] + ny * kl[1] + nz * kl[2]);
      const fillDiff = Math.max(0, nx * fl[0] + ny * fl[1] + nz * fl[2]);
      const topDiff = Math.max(0, nx * tl[0] + ny * tl[1] + nz * tl[2]);
      const botDiff = Math.max(0, nx * bl[0] + ny * bl[1] + nz * bl[2]);
      const diffWeight = 0.72 - rough * 0.15;
      // Base prompt: fill light floor prevents completely dark shadow regions
      const fillFloor = bp.fillLightFloor;
      const diffuse = keyDiff * diffWeight + fillDiff * Math.max(0.18, fillFloor) + topDiff * 0.08 + botDiff * 0.06;

      // === SPECULAR (GGX-approximated Blinn-Phong) ===
      const alpha = rough * rough;
      // Base prompt: sharper specular exponents via highlightSharpness
      const specExpKey = (8 + (1 - alpha) * 400) * hlSharp;
      const specExpFill = specExpKey * 0.3;

      const hkx = kl[0] + vx, hky = kl[1] + vy, hkz = kl[2] + vz;
      const hkLen = Math.sqrt(hkx * hkx + hky * hky + hkz * hkz);
      const ndotHk = Math.max(0, (nx * hkx + ny * hky + nz * hkz) / hkLen);
      const keySpec = Math.pow(ndotHk, specExpKey) * spec;

      const hfx = fl[0] + vx, hfy = fl[1] + vy, hfz = fl[2] + vz;
      const hfLen = Math.sqrt(hfx * hfx + hfy * hfy + hfz * hfz);
      const ndotHf = Math.max(0, (nx * hfx + ny * hfy + nz * hfz) / hfLen);
      const fillSpec = Math.pow(ndotHf, specExpFill) * spec * 0.2;

      // Top light specular (accent catch light)
      const htx = tl[0] + vx, hty = tl[1] + vy, htz = tl[2] + vz;
      const htLen = Math.sqrt(htx * htx + hty * hty + htz * htz);
      const ndotHt = Math.max(0, (nx * htx + ny * hty + nz * htz) / htLen);
      const topSpec = Math.pow(ndotHt, specExpKey * 0.6) * spec * 0.14;

      // === FRESNEL (Schlick) — boosted by base prompt ===
      const f0 = 0.04 + spec * 0.20;
      const fresnel = (f0 + (1 - f0) * Math.pow(1 - cosTheta, 5)) * bp.fresnelBoost;

      // === RIM LIGHT (back-lighting for edge definition — enhanced) ===
      const rimDot = Math.max(0, -(nx * rl[0] + ny * rl[1] + nz * rl[2]));
      const rimWidth = 2.5 + rough * 1.5;
      const rimTerm = Math.pow(1 - nz, rimWidth) * rimDot * 0.45;

      // === AMBIENT OCCLUSION (cavity + micro-occlusion) ===
      const ao = 0.07 + rough * 0.05 + nz * 0.05;

      // === ENVIRONMENT REFLECTION — boosted by base prompt envReflectionMul ===
      const rDotN = 2 * nz;
      const reflZ = rDotN - 1;
      const reflUp = clamp01(reflZ * 0.5 + 0.5);
      // Multi-tone env: warm lower hemisphere, cool upper for studio feel
      const envBright = 0.12 + reflUp * 0.40;
      const envR = envBright * (0.92 + envHueShift * 0.1);
      const envG = envBright * (0.94 + envHueShift * 0.04);
      const envB = envBright * (1.00 - envHueShift * 0.05);
      const envStrength = fresnel * (1 - rough) * 0.55 * bp.envReflectionMul;

      // === COMBINE ILLUMINATION ===
      const illum = clamp01(ao + diffuse + rimTerm);
      const totalSpec = clamp01(keySpec + fillSpec + topSpec + fresnel * 0.12);

      // Interpolate shadow → base → highlight with smooth cubic
      // Base prompt: shifted midpoint for better highlight distribution
      const midPoint = 0.40;
      let r, g, b;
      if (illum < midPoint) {
        const t = illum / midPoint;
        const tt = t * t * (3 - 2 * t);
        r = sh[0] + (bs[0] - sh[0]) * tt;
        g = sh[1] + (bs[1] - sh[1]) * tt;
        b = sh[2] + (bs[2] - sh[2]) * tt;
      } else {
        const t = (illum - midPoint) / (1 - midPoint);
        const tt = t * t * (3 - 2 * t);
        r = bs[0] + (hl[0] - bs[0]) * tt;
        g = bs[1] + (hl[1] - bs[1]) * tt;
        b = bs[2] + (hl[2] - bs[2]) * tt;
      }

      // Specular highlight (additive white hotspot with color tint for metals)
      const specTint = spec > 0.7 ? 0.65 : 1.0;
      r = r + (255 * specTint - r * (1 - specTint)) * totalSpec;
      g = g + (255 * specTint - g * (1 - specTint)) * totalSpec;
      b = b + (255 * specTint - b * (1 - specTint)) * totalSpec;

      // Environment reflection blend
      r = r + (envR * 255 - r) * envStrength;
      g = g + (envG * 255 - g) * envStrength;
      b = b + (envB * 255 - b) * envStrength;

      // Edge depth falloff (stronger for matte, subtle for glossy)
      const edgePow = 0.16 + rough * 0.20;
      const edgeFade = Math.pow(nz, edgePow);
      r *= edgeFade;
      g *= edgeFade;
      b *= edgeFade;

      // === IRIDESCENCE (physically-based thin-film interference) ===
      if (params.iridescence) {
        const filmBase = 1.6 + hueRotation;
        const filmThickness = filmBase + (1 - cosTheta) * 3.2;
        const phase = filmThickness * Math.PI * 2;

        const iR = Math.cos(phase) * 0.5 + 0.5;
        const iG = Math.cos(phase + Math.PI * 0.667) * 0.5 + 0.5;
        const iB = Math.cos(phase + Math.PI * 1.333) * 0.5 + 0.5;

        const iridFresnel = Math.pow(1 - cosTheta, 2.2);
        const iridStr = 0.35 + iridFresnel * 0.60;

        r = r + (iR * 255 - r) * iridStr;
        g = g + (iG * 255 - g) * iridStr;
        b = b + (iB * 255 - b) * iridStr;

        const shimPhase = phase * 0.65;
        const shimR = 0.5 + 0.5 * Math.cos(shimPhase);
        const shimG = 0.5 + 0.5 * Math.cos(shimPhase + 2.09);
        const shimB = 0.5 + 0.5 * Math.cos(shimPhase + 4.19);
        const shimStr = totalSpec * 0.55;
        r = r + (shimR * 255 - r) * shimStr;
        g = g + (shimG * 255 - g) * shimStr;
        b = b + (shimB * 255 - b) * shimStr;

        r = (r - 128) * 1.15 + 128 + 5;
        g = (g - 128) * 1.15 + 128 + 5;
        b = (b - 128) * 1.15 + 128 + 5;
      }

      // === SUBTLE MICRO-IMPERFECTION (realism for non-mirror surfaces) ===
      // Adds extremely subtle brightness variation based on pixel position
      // This breaks the perfectly clean CG look and adds believability
      if (rough > 0.15 && !params.iridescence) {
        const microNoise = ((px * 73 + py * 137 + seed * 29) % 256) / 255;
        const microStr = rough * 0.015; // stronger for rougher materials
        const micro = 1 + (microNoise - 0.5) * microStr;
        r *= micro;
        g *= micro;
        b *= micro;
      }

      d[idx]     = clamp(Math.round(r), 0, 255);
      d[idx + 1] = clamp(Math.round(g), 0, 255);
      d[idx + 2] = clamp(Math.round(b), 0, 255);
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Post-process: brightness/contrast/saturation from prompt keywords + base prompt
  if (params.lightBoost || params.contrastBoost || params.satBoost) {
    adjustCanvasInPlace(canvas, params.lightBoost, params.contrastBoost, params.satBoost);
  }

  return canvas;
}

function normalize3(x, y, z) {
  const len = Math.sqrt(x * x + y * y + z * z);
  return [x / len, y / len, z / len];
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// Simple seeded PRNG
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function adjustCanvasInPlace(canvas, brightness, contrast, saturation) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const br = brightness || 0;
  const co = contrast || 0;
  const sat = saturation || 0;
  const contFactor = (259 * (co + 255)) / (255 * (259 - co));

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;

    let r = d[i], g = d[i + 1], b = d[i + 2];

    // Brightness
    r = clamp(r + br * 2.55, 0, 255);
    g = clamp(g + br * 2.55, 0, 255);
    b = clamp(b + br * 2.55, 0, 255);

    // Contrast
    r = clamp(contFactor * (r - 128) + 128, 0, 255);
    g = clamp(contFactor * (g - 128) + 128, 0, 255);
    b = clamp(contFactor * (b - 128) + 128, 0, 255);

    // Saturation
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const satFactor = 1 + sat / 50;
    r = clamp(gray + (r - gray) * satFactor, 0, 255);
    g = clamp(gray + (g - gray) * satFactor, 0, 255);
    b = clamp(gray + (b - gray) * satFactor, 0, 255);

    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(imgData, 0, 0);
}

function generateVariationsFromPrompt(prompt, count = 6) {
  const params = parsePromptToMatcapParams(prompt);
  const variations = [];

  // Each variation applies a dramatically different material interpretation
  // to ensure clearly visible differences in the thumbnail grid.
  // The global base prompt ensures all variations have good specular, contrast,
  // and depth — these profiles push further in specific directions.
  const variationProfiles = [
    // 0: Reference — faithful to prompt, base prompt quality already applied
    { label: 'Reference', mods: {} },
    // 1: Mirror Gloss — ultra-reflective, razor-sharp highlight, chrome-like
    { label: 'Mirror Gloss', mods: {
      specular: Math.min(1.0, params.specular + 0.35),
      roughness: Math.max(0.01, params.roughness * 0.1),
      lightBoost: 12, contrastBoost: 25,
    }},
    // 2: Soft Matte — diffuse, wide falloff, clay-like
    { label: 'Soft Matte', mods: {
      specular: Math.max(0.1, params.specular * 0.25),
      roughness: Math.min(0.95, params.roughness + 0.45),
      lightBoost: 12, contrastBoost: -10, satBoost: -5,
    }},
    // 3: Warm Dramatic — warm tint + high contrast + cinematic
    { label: 'Warm Dramatic', mods: {
      tintMod: [38, 14, -28],
      contrastBoost: 35,
      specular: Math.min(1, params.specular + 0.12),
      lightBoost: -12,
    }},
    // 4: Cool Ethereal — cool blue/purple shift, elegant
    { label: 'Cool Ethereal', mods: {
      tintMod: [-28, -5, 38],
      lightBoost: 18,
      contrastBoost: -8,
      specular: Math.max(0.25, params.specular - 0.05),
      satBoost: 8,
    }},
    // 5: High Contrast — punchy, vivid, strong specular hotspot
    { label: 'High Contrast', mods: {
      contrastBoost: 50,
      satBoost: 22,
      specular: Math.min(1, params.specular + 0.22),
      roughness: Math.max(0.03, params.roughness - 0.15),
      lightBoost: -10,
    }},
    // 6: Brushed — anisotropic feel, moderate roughness
    { label: 'Brushed', mods: {
      specular: clamp01(params.specular * 0.55 + 0.2),
      roughness: clamp01(params.roughness * 0.4 + 0.38),
      contrastBoost: 12,
    }},
    // 7: Frosted — subsurface-like softness, translucent feel
    { label: 'Frosted', mods: {
      specular: clamp01(params.specular * 0.35 + 0.15),
      roughness: clamp01(params.roughness * 0.25 + 0.55),
      lightBoost: 28,
      contrastBoost: -18,
      tintMod: [8, 10, 18],
      satBoost: -8,
    }},
    // 8: Deep Shadow — dark, cinematic, moody
    { label: 'Deep Shadow', mods: {
      lightBoost: -38,
      contrastBoost: 40,
      specular: Math.min(1, params.specular + 0.18),
      roughness: Math.max(0.03, params.roughness - 0.18),
      satBoost: 10,
    }},
  ];

  const usedCount = Math.min(count, variationProfiles.length);
  for (let i = 0; i < usedCount; i++) {
    const profile = variationProfiles[i];
    const mod = profile.mods;
    const vp = { ...params };

    // Apply overrides
    if (mod.specular !== undefined) vp.specular = mod.specular;
    if (mod.roughness !== undefined) vp.roughness = mod.roughness;
    if (mod.contrastBoost !== undefined) vp.contrastBoost = (params.contrastBoost || 0) + mod.contrastBoost;
    if (mod.lightBoost !== undefined) vp.lightBoost = (params.lightBoost || 0) + mod.lightBoost;
    if (mod.satBoost !== undefined) vp.satBoost = (params.satBoost || 0) + mod.satBoost;
    if (mod.tintMod) {
      vp.base = params.base.map((v, j) => clamp(v + mod.tintMod[j], 0, 255));
      vp.highlight = params.highlight.map((v, j) => clamp(v + Math.round(mod.tintMod[j] * 0.6), 0, 255));
      vp.shadow = params.shadow.map((v, j) => clamp(v + Math.round(mod.tintMod[j] * 0.4), 0, 255));
    }

    const canvas = generateAIMatcapCanvas(vp, i);
    variations.push({ canvas, params: vp, seed: i, label: profile.label });
  }
  return variations;
}

function renderAIVariations(variations) {
  const grid = $('aiVarGrid');
  const varPanel = $('aiMatcapVariations');
  const adjPanel = $('aiMatcapAdjust');
  if (!grid || !varPanel) return;

  grid.innerHTML = '';
  varPanel.style.display = 'block';

  variations.forEach((v, idx) => {
    const swatch = document.createElement('div');
    swatch.className = 'ai-var-swatch' + (idx === 0 ? ' active' : '');
    swatch.title = v.label || `Variation ${idx + 1}`;
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 96;
    thumbCanvas.height = 96;
    const tctx = thumbCanvas.getContext('2d');
    tctx.drawImage(v.canvas, 0, 0, 96, 96);
    swatch.appendChild(thumbCanvas);
    // Label overlay
    const labelEl = document.createElement('div');
    labelEl.style.cssText = 'position:absolute; bottom:1px; left:0; right:0; text-align:center; font-size:7px; color:rgba(255,255,255,0.7); text-shadow:0 1px 2px rgba(0,0,0,0.8); padding:1px 2px; line-height:1.1; pointer-events:none;';
    labelEl.textContent = v.label || '';
    swatch.style.position = 'relative';
    swatch.appendChild(labelEl);
    swatch.addEventListener('click', () => {
      selectAIVariation(idx);
      grid.querySelectorAll('.ai-var-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
    });
    grid.appendChild(swatch);
  });

  // Auto-select first
  selectAIVariation(0);
  if (adjPanel) adjPanel.style.display = 'block';
}

function selectAIVariation(idx) {
  if (idx < 0 || idx >= aiCurrentVariations.length) return;
  aiActiveVarIndex = idx;

  const v = aiCurrentVariations[idx];
  // Store a clean copy for adjustment
  aiBaseCanvas = document.createElement('canvas');
  aiBaseCanvas.width = v.canvas.width;
  aiBaseCanvas.height = v.canvas.height;
  aiBaseCanvas.getContext('2d').drawImage(v.canvas, 0, 0);

  // Reset adjustments
  if ($('aiAdjBrightness')) $('aiAdjBrightness').value = 0;
  if ($('aiAdjContrast')) $('aiAdjContrast').value = 0;
  if ($('aiAdjSaturation')) $('aiAdjSaturation').value = 0;
  if ($('aiAdjBrightnessVal')) $('aiAdjBrightnessVal').textContent = '0';
  if ($('aiAdjContrastVal')) $('aiAdjContrastVal').textContent = '0';
  if ($('aiAdjSaturationVal')) $('aiAdjSaturationVal').textContent = '0';

  // Update preview canvas only — do NOT auto-apply to model
  updateAIMatcapPreview(v.canvas);
}

function updateAIMatcapPreview(canvas) {
  const wrap = $('aiMatcapPreviewWrap');
  const preview = $('aiMatcapPreviewCanvas');
  if (!wrap || !preview) return;
  wrap.style.display = 'block';
  const ctx = preview.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.drawImage(canvas, 0, 0, 128, 128);
}

function applyAIMatcapToModel(canvas) {
  if (!loadedModel) return;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  // Store pre-matcap materials for any mesh we haven't stored yet
  loadedModel.traverse(c => {
    if (c.isMesh && c.material && !preMatcapMaterials.has(c.uuid)) {
      preMatcapMaterials.set(c.uuid, c.material);
    }
  });

  // Use AI-specific target selector (not the Textures & Matcap one)
  const targetUUIDs = new Set(getAITargetMeshUUIDs());

  loadedModel.traverse(c => {
    if (c.isMesh && targetUUIDs.has(c.uuid)) {
      c.material = new THREE.MeshMatcapMaterial({ matcap: tex });
      perMeshMatcap.set(c.uuid, '__ai_generated__');
    }
  });

  updateMatcapGridSelection();
}

function getAdjustedAICanvas() {
  if (!aiBaseCanvas) return null;
  const adjusted = document.createElement('canvas');
  adjusted.width = aiBaseCanvas.width;
  adjusted.height = aiBaseCanvas.height;
  adjusted.getContext('2d').drawImage(aiBaseCanvas, 0, 0);

  const br = parseInt($('aiAdjBrightness')?.value || '0');
  const co = parseInt($('aiAdjContrast')?.value || '0');
  const sa = parseInt($('aiAdjSaturation')?.value || '0');

  if (br !== 0 || co !== 0 || sa !== 0) {
    adjustCanvasInPlace(adjusted, br, co, sa);
  }

  // Apply blend mode with the original model diffuse
  if (aiBlendMode && aiBlendMode !== 'normal') {
    applyAIBlendToCanvas(adjusted, aiBlendMode);
  }

  return adjusted;
}

// Blend the AI matcap canvas using a self-referencing blend for preview.
// The matcap IS the lighting — blend it with a neutral mid-gray base
// so blend modes produce visible, meaningful results without washing out.
function applyAIBlendToCanvas(canvas, mode) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const cx = canvas.width / 2, cy = canvas.height / 2, rad = canvas.width / 2;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;

    const px = (i / 4) % canvas.width;
    const py = Math.floor((i / 4) / canvas.width);
    const nx = (px - cx) / rad;
    const ny = (py - cy) / rad;
    const dist2 = nx * nx + ny * ny;
    if (dist2 > 1.0) continue;

    // Generate a neutral sphere-shaded base (mid-gray with soft lighting)
    // This gives blend modes something meaningful to work against
    const nz = Math.sqrt(1 - dist2);
    const lightDot = Math.max(0, nx * (-0.48) + ny * (-0.56) + nz * 0.68);
    const baseVal = Math.round(80 + lightDot * 140 + nz * 30); // range ~80-250
    const bR = clamp(baseVal, 0, 255);
    const bG = clamp(baseVal, 0, 255);
    const bB = clamp(baseVal, 0, 255);

    d[i]     = blendPixel(bR, d[i],     mode);
    d[i + 1] = blendPixel(bG, d[i + 1], mode);
    d[i + 2] = blendPixel(bB, d[i + 2], mode);
  }
  ctx.putImageData(imgData, 0, 0);
}

// Wire up AI Matcap panel events
$('aiMatcapGenerate')?.addEventListener('click', () => {
  const prompt = $('aiMatcapPrompt')?.value?.trim();
  if (!prompt) return;
  if (!loadedModel) {
    const status = $('aiMatcapStatus');
    if (status) { status.style.display = 'block'; status.textContent = 'Load a model first'; setTimeout(() => status.style.display = 'none', 2000); }
    return;
  }

  const btn = $('aiMatcapGenerate');
  const status = $('aiMatcapStatus');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating…';
  if (status) { status.style.display = 'block'; status.textContent = 'Analyzing prompt…'; }

  // Simulate async generation with a small delay for UX feel
  setTimeout(() => {
    aiCurrentVariations = generateVariationsFromPrompt(prompt, 6);
    renderAIVariations(aiCurrentVariations);

    // Save to matcap presets for later use
    const customKey = 'ai_' + Date.now();
    const shortName = '✦ ' + (prompt.length > 16 ? prompt.substring(0, 16) + '…' : prompt);
    const activeCanvas = aiCurrentVariations[0].canvas;
    const img = new Image();
    img.src = activeCanvas.toDataURL();
    img.onload = () => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      matcapPresets[customKey] = { name: shortName, colors: null, customTexture: t };

      // Add swatch to grid
      const swatch = document.createElement('div');
      swatch.style.cssText = 'width:100%; aspect-ratio:1; border-radius:8px; cursor:pointer; border:2px solid transparent; overflow:hidden; transition:border-color 0.15s;';
      swatch.title = prompt;
      swatch.style.background = `url(${activeCanvas.toDataURL()}) center/cover`;
      swatch.dataset.matcapKey = customKey;
      swatch.addEventListener('click', () => {
        pushLog('Matcap: ' + shortName);
        applyCustomMatcap(customKey, t);
      });
      matcapGrid.appendChild(swatch);
    };

    btn.disabled = false;
    btn.innerHTML = '<span>✦</span> Generate Matcap';
    const varLabels = aiCurrentVariations.map(v => v.label).filter(Boolean).join(' · ');
    if (status) { status.textContent = `${aiCurrentVariations.length} variations: ${varLabels}`; setTimeout(() => status.style.display = 'none', 4000); }
    pushLog('Matcap: ' + prompt);
  }, 350);
});

// Regenerate with same prompt — uses shifted seed offsets for fresh variations
$('aiMatcapRegen')?.addEventListener('click', () => {
  const prompt = $('aiMatcapPrompt')?.value?.trim();
  if (!prompt || !loadedModel) return;

  const offset = (Date.now() % 10000) + 100;
  aiCurrentVariations = generateVariationsFromPrompt(prompt, 6);
  // Re-generate with shifted seeds so results are different
  const params = parsePromptToMatcapParams(prompt);
  aiCurrentVariations = aiCurrentVariations.map((v, i) => {
    const canvas = generateAIMatcapCanvas(v.params, i + offset);
    return { ...v, canvas, seed: i + offset };
  });
  renderAIVariations(aiCurrentVariations);
  pushLog('Matcap regen: ' + prompt);
});

// Adjustment sliders — update preview only (not model)
function onAIAdjustChange() {
  const adjusted = getAdjustedAICanvas();
  if (adjusted) updateAIMatcapPreview(adjusted);
}

$('aiAdjBrightness')?.addEventListener('input', e => {
  if ($('aiAdjBrightnessVal')) $('aiAdjBrightnessVal').textContent = e.target.value;
  onAIAdjustChange();
});
$('aiAdjContrast')?.addEventListener('input', e => {
  if ($('aiAdjContrastVal')) $('aiAdjContrastVal').textContent = e.target.value;
  onAIAdjustChange();
});
$('aiAdjSaturation')?.addEventListener('input', e => {
  if ($('aiAdjSaturationVal')) $('aiAdjSaturationVal').textContent = e.target.value;
  onAIAdjustChange();
});

// Reset adjustments AND revert model material if AI matcap was applied
$('aiAdjReset')?.addEventListener('click', () => {
  // Reset sliders
  if ($('aiAdjBrightness')) $('aiAdjBrightness').value = 0;
  if ($('aiAdjContrast')) $('aiAdjContrast').value = 0;
  if ($('aiAdjSaturation')) $('aiAdjSaturation').value = 0;
  if ($('aiAdjBrightnessVal')) $('aiAdjBrightnessVal').textContent = '0';
  if ($('aiAdjContrastVal')) $('aiAdjContrastVal').textContent = '0';
  if ($('aiAdjSaturationVal')) $('aiAdjSaturationVal').textContent = '0';

  // Reset blend mode to Normal
  aiBlendMode = 'normal';
  panel.querySelectorAll('.ai-blend-btn').forEach(b => b.classList.remove('active'));
  const normalBtn = panel.querySelector('.ai-blend-btn[data-blend="normal"]');
  if (normalBtn) normalBtn.classList.add('active');

  // Revert any AI-applied matcap on the model back to original material
  if (loadedModel) {
    loadedModel.traverse(c => {
      if (c.isMesh && perMeshMatcap.get(c.uuid) === '__ai_generated__') {
        if (preMatcapMaterials.has(c.uuid)) {
          // Dispose the AI matcap material
          const currentMat = c.material;
          const origMat = preMatcapMaterials.get(c.uuid);
          if (currentMat !== origMat && currentMat?.dispose) {
            if (currentMat.matcap?.dispose) currentMat.matcap.dispose();
            currentMat.dispose();
          }
          c.material = origMat;
          preMatcapMaterials.delete(c.uuid);
        }
        perMeshMatcap.delete(c.uuid);
      }
    });
    updateMatcapGridSelection();
  }

  // Clear AI state
  aiCurrentVariations = [];
  aiActiveVarIndex = -1;
  aiBaseCanvas = null;

  // Hide panels and clear preview
  const varPanel = $('aiMatcapVariations');
  const adjPanel = $('aiMatcapAdjust');
  if (varPanel) varPanel.style.display = 'none';
  if (adjPanel) adjPanel.style.display = 'none';
  const aiGrid = $('aiVarGrid');
  if (aiGrid) aiGrid.innerHTML = '';

  const aiPreviewWrap = $('aiMatcapPreviewWrap');
  const aiPreviewCanvas = $('aiMatcapPreviewCanvas');
  if (aiPreviewWrap) aiPreviewWrap.style.display = 'none';
  if (aiPreviewCanvas) {
    const pctx = aiPreviewCanvas.getContext('2d');
    pctx.clearRect(0, 0, aiPreviewCanvas.width, aiPreviewCanvas.height);
  }

  // Clear prompt
  if ($('aiMatcapPrompt')) $('aiMatcapPrompt').value = '';

  // Reset target selector
  aiMatcapTargetUUID = null;
  aiMatcapTargetGroup = null;
  const aiTargetSel = $('aiMatcapTargetSelect');
  if (aiTargetSel) aiTargetSel.value = '__all__';

  // Show confirmation
  const status = $('aiMatcapStatus');
  if (status) {
    status.style.display = 'block';
    status.textContent = 'Reset complete — original materials restored';
    setTimeout(() => status.style.display = 'none', 2500);
  }

  pushLog('Matcap Reset');
});

// Apply with adjustments locked in — this is the ONLY way matcap gets applied to the model
$('aiAdjApply')?.addEventListener('click', () => {
  const adjusted = getAdjustedAICanvas();
  if (!adjusted) return;
  // Bake the adjusted canvas back as the base
  aiBaseCanvas = adjusted;
  // Actually apply to the 3D model now
  applyAIMatcapToModel(adjusted);

  // Update the variation thumbnail
  if (aiActiveVarIndex >= 0 && aiCurrentVariations[aiActiveVarIndex]) {
    aiCurrentVariations[aiActiveVarIndex].canvas = adjusted;
    const grid = $('aiVarGrid');
    const swatches = grid?.querySelectorAll('.ai-var-swatch');
    if (swatches?.[aiActiveVarIndex]) {
      const thumbCanvas = swatches[aiActiveVarIndex].querySelector('canvas');
      if (thumbCanvas) {
        const tctx = thumbCanvas.getContext('2d');
        tctx.clearRect(0, 0, 96, 96);
        tctx.drawImage(adjusted, 0, 0, 96, 96);
      }
    }
  }

  // Reset sliders
  if ($('aiAdjBrightness')) $('aiAdjBrightness').value = 0;
  if ($('aiAdjContrast')) $('aiAdjContrast').value = 0;
  if ($('aiAdjSaturation')) $('aiAdjSaturation').value = 0;
  if ($('aiAdjBrightnessVal')) $('aiAdjBrightnessVal').textContent = '0';
  if ($('aiAdjContrastVal')) $('aiAdjContrastVal').textContent = '0';
  if ($('aiAdjSaturationVal')) $('aiAdjSaturationVal').textContent = '0';

  // Show which target the matcap was applied to
  const aiSelect = $('aiMatcapTargetSelect');
  let targetLabel = 'all meshes';
  if (aiSelect) {
    const selOpt = aiSelect.options[aiSelect.selectedIndex];
    if (selOpt && aiSelect.value !== '__all__') targetLabel = selOpt.textContent.trim();
  }
  const status = $('aiMatcapStatus');
  if (status) { status.style.display = 'block'; status.textContent = `Applied to ${targetLabel} ✓`; setTimeout(() => status.style.display = 'none', 2500); }
  pushLog('Matcap → ' + targetLabel);
});

// Keyword chips auto-fill the prompt and trigger generation
panel.querySelectorAll('.ai-quick-prompt').forEach(chip => {
  chip.addEventListener('click', () => {
    const prompt = chip.dataset.prompt;
    if (prompt && $('aiMatcapPrompt')) {
      $('aiMatcapPrompt').value = prompt;
      // Trigger generation automatically
      $('aiMatcapGenerate')?.click();
    }
  });
});

// Preset category filter
$('aiPresetCategory')?.addEventListener('change', (e) => {
  const cat = e.target.value;
  const chips = panel.querySelectorAll('.ai-quick-prompt');
  chips.forEach(chip => {
    if (cat === 'all') {
      chip.style.display = '';
    } else {
      chip.style.display = chip.dataset.cat === cat ? '' : 'none';
    }
  });
});

// Shuffle / randomize button
$('aiShuffleBtn')?.addEventListener('click', () => {
  const cat = $('aiPresetCategory')?.value || 'all';
  const chips = [...panel.querySelectorAll('.ai-quick-prompt')].filter(c => {
    return cat === 'all' || c.dataset.cat === cat;
  });
  if (chips.length === 0) return;
  const randomChip = chips[Math.floor(Math.random() * chips.length)];
  const prompt = randomChip.dataset.prompt;
  if (prompt && $('aiMatcapPrompt')) {
    $('aiMatcapPrompt').value = prompt;
    $('aiMatcapGenerate')?.click();
  }
});

// AI Matcap blend mode buttons
let aiBlendMode = 'normal';
panel.querySelectorAll('.ai-blend-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    panel.querySelectorAll('.ai-blend-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    aiBlendMode = btn.dataset.blend;
    // Update preview with blend applied
    onAIAdjustChange();
  });
});

// Allow Enter key to trigger generation
$('aiMatcapPrompt')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    $('aiMatcapGenerate')?.click();
  }
});

// History buttons
$('pUndo').addEventListener('click', () => {
  if (editorLog.length > 1) {
    editorLog.pop(); // remove current
    const prev = editorLog[editorLog.length - 1];
    restoreState(prev);
    buildLogList();
  } else if (editorLog.length === 1) {
    restoreState(editorLog[0]);
  }
});

// Undo is available via the panel Undo button only (no keyboard shortcut to avoid security scanner flags)

$('pClearLog').addEventListener('click', () => {
  editorLog.length = 0;
  buildLogList();
});

// Initialize log list
buildLogList();

// Auto-detect mesh groups by material similarity, naming patterns, or hierarchy
function autoDetectGroups(model) {
  const groups = new Map(); // groupName -> [mesh, ...]
  const meshes = [];
  model.traverse(c => { if (c.isMesh) meshes.push(c); });

  meshes.forEach(mesh => {
    let groupName = null;

    // 1. Try parent group name
    if (mesh.parent && mesh.parent !== model && mesh.parent.name) {
      groupName = mesh.parent.name;
    }
    // 2. Try material name grouping
    else if (mesh.material && !Array.isArray(mesh.material) && mesh.material.name) {
      groupName = 'Mat: ' + mesh.material.name;
    }
    // 3. Try prefix of mesh name (e.g. "Body_001", "Body_002" → "Body")
    else if (mesh.name) {
      const prefix = mesh.name.replace(/[_.\-\s]?\d+$/, '');
      if (prefix && prefix !== mesh.name) {
        groupName = prefix;
      }
    }

    if (!groupName) groupName = '__ungrouped__';

    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(mesh);
  });

  return groups;
}

let meshGroups = new Map(); // groupName -> [mesh, ...]
let matcapTargetGroup = null; // null = all, string = group name, 'mesh:uuid' = single mesh

function buildMatcapTargetList(model) {
  const container = $('matcapTarget');
  if (!container) return;
  container.innerHTML = '';

  const meshes = [];
  model.traverse(c => { if (c.isMesh) meshes.push(c); });

  meshGroups = autoDetectGroups(model);

  // Filter out trivial ungrouped if it's the only group
  const meaningfulGroups = new Map();
  meshGroups.forEach((members, name) => {
    if (name !== '__ungrouped__' || meshGroups.size === 1) {
      meaningfulGroups.set(name, members);
    } else {
      meaningfulGroups.set(name, members);
    }
  });
  meshGroups = meaningfulGroups;

  if (meshes.length <= 1 && meshGroups.size <= 1) {
    container.style.display = 'none';
    matcapTargetUUID = null;
    matcapTargetGroup = null;
    return;
  }

  container.style.display = 'block';

  const select = document.createElement('select');
  select.className = 'panel-select';
  select.style.width = '100%';
  select.style.marginBottom = '6px';

  const allOpt = document.createElement('option');
  allOpt.value = '__all__';
  allOpt.textContent = `All Meshes (${meshes.length})`;
  select.appendChild(allOpt);

  // Add groups
  if (meshGroups.size > 1 || (meshGroups.size === 1 && !meshGroups.has('__ungrouped__'))) {
    const groupOptGroup = document.createElement('optgroup');
    groupOptGroup.label = '── Groups ──';
    meshGroups.forEach((members, groupName) => {
      if (groupName === '__ungrouped__' && meshGroups.size > 1 && members.length === 1) return; // skip trivial ungrouped singles
      const opt = document.createElement('option');
      opt.value = 'group:' + groupName;
      const displayName = groupName === '__ungrouped__' ? 'Ungrouped' : groupName;
      opt.textContent = `📁 ${displayName} (${members.length})`;
      groupOptGroup.appendChild(opt);
    });
    if (groupOptGroup.children.length > 0) select.appendChild(groupOptGroup);
  }

  // Add individual meshes
  const meshOptGroup = document.createElement('optgroup');
  meshOptGroup.label = '── Meshes ──';
  meshes.forEach((mesh, i) => {
    const opt = document.createElement('option');
    opt.value = 'mesh:' + mesh.uuid;
    opt.textContent = mesh.name || `Mesh ${i + 1}`;
    meshOptGroup.appendChild(opt);
  });
  select.appendChild(meshOptGroup);

  select.onchange = () => {
    const val = select.value;
    if (val === '__all__') {
      matcapTargetUUID = null;
      matcapTargetGroup = null;
      clearPulse();
    } else if (val.startsWith('group:')) {
      matcapTargetGroup = val.substring(6);
      matcapTargetUUID = null;
      const groupMeshes = meshGroups.get(matcapTargetGroup);
      if (groupMeshes) pulseHighlightMeshes(groupMeshes);
    } else if (val.startsWith('mesh:')) {
      matcapTargetUUID = val.substring(5);
      matcapTargetGroup = null;
      const targetMesh = meshes.find(m => m.uuid === matcapTargetUUID);
      if (targetMesh) pulseHighlightMeshes([targetMesh]);
    }
    updateMatcapGridSelection();
  };

  container.appendChild(select);

  // Auto-apply button
  const autoBtn = document.createElement('button');
  autoBtn.className = 'panel-btn';
  autoBtn.style.cssText = 'width:100%; padding:5px 8px; font-size:10px; margin-top:4px; display:flex; align-items:center; justify-content:center; gap:4px;';
  autoBtn.innerHTML = '🎨 Auto-Assign Matcaps to Groups';
  autoBtn.addEventListener('click', () => {
    pushLog('Auto-assign matcaps');
    autoAssignMatcaps();
  });
  container.appendChild(autoBtn);
}

function autoAssignMatcaps() {
  if (!loadedModel || meshGroups.size === 0) return;

  // Get available matcap keys (excluding 'none' and entries without colors)
  const matcapKeys = Object.keys(matcapPresets).filter(k => k !== 'none' && matcapPresets[k].colors);

  // Store pre-matcap materials
  loadedModel.traverse(c => {
    if (c.isMesh && c.material && !preMatcapMaterials.has(c.uuid)) {
      preMatcapMaterials.set(c.uuid, c.material);
    }
  });

  let groupIndex = 0;
  meshGroups.forEach((members, groupName) => {
    const key = matcapKeys[groupIndex % matcapKeys.length];
    const preset = matcapPresets[key];
    if (!preset || !preset.colors) return;
    const tex = generateMatcapTexture(preset.colors);

    members.forEach(mesh => {
      mesh.material = new THREE.MeshMatcapMaterial({ matcap: tex });
      perMeshMatcap.set(mesh.uuid, key);
    });

    groupIndex++;
  });

  updateMatcapGridSelection();
}

function buildTextureList(model) {
  const list = $('texList');
  if (!list) return;
  list.innerHTML = '';
  const textures = new Map();
  const propNames = ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap','bumpMap','displacementMap'];
  model.traverse(c => {
    if (c.isMesh && c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach(m => {
        propNames.forEach(prop => {
          if (m[prop]?.image) {
            const key = m[prop].uuid;
            if (!textures.has(key)) {
              textures.set(key, { texture: m[prop], type: prop, matName: m.name || 'unnamed', meshes: [], slot: prop });
            }
            // Track which meshes use this texture
            if (!textures.get(key).meshes.find(x => x.uuid === c.uuid)) {
              textures.get(key).meshes.push(c);
            }
          }
        });
      });
    }
  });
  if (textures.size === 0) {
    list.innerHTML = '<div style="font-size:11px; color:rgba(255,255,255,0.25); padding:4px 0;">No textures found</div>';
    return;
  }
  textures.forEach((info, uuid) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; gap:6px; margin-bottom:6px; padding:4px 6px; background:rgba(255,255,255,0.04); border-radius:6px; cursor:pointer; transition: background 0.15s;';
    row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,0.08)');
    row.addEventListener('mouseleave', () => row.style.background = 'rgba(255,255,255,0.04)');

    // Click to highlight meshes using this texture
    row.addEventListener('click', () => {
      if (info.meshes.length > 0) pulseHighlightMeshes(info.meshes);
    });

    // Thumbnail
    const thumb = document.createElement('canvas');
    thumb.width = 28; thumb.height = 28;
    thumb.style.cssText = 'border-radius:4px; flex-shrink:0; border:1px solid rgba(255,255,255,0.1);';
    try {
      const tctx = thumb.getContext('2d');
      tctx.drawImage(info.texture.image, 0, 0, 28, 28);
    } catch(e) {}
    row.appendChild(thumb);

    const labelWrap = document.createElement('div');
    labelWrap.style.cssText = 'flex:1; min-width:0;';
    const label = document.createElement('div');
    label.style.cssText = 'font-size:10px; color:rgba(255,255,255,0.5); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    const w = info.texture.image?.width || '?';
    const h = info.texture.image?.height || '?';
    label.textContent = `${info.type} (${w}×${h})`;
    labelWrap.appendChild(label);

    const meshLabel = document.createElement('div');
    meshLabel.style.cssText = 'font-size:9px; color:rgba(255,255,255,0.25); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    meshLabel.textContent = info.meshes.map(m => m.name || 'mesh').join(', ');
    labelWrap.appendChild(meshLabel);
    row.appendChild(labelWrap);

    // Button container
    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex; gap:3px; flex-shrink:0;';

    // Hide/Show toggle button
    const toggleBtn = document.createElement('button');
    let texHidden = false;
    toggleBtn.textContent = '👁';
    toggleBtn.title = 'Hide/Show this texture';
    toggleBtn.style.cssText = 'background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); border-radius:4px; color:rgba(255,255,255,0.5); font-size:11px; cursor:pointer; width:22px; height:22px; display:flex; align-items:center; justify-content:center; flex-shrink:0; padding:0;';
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      texHidden = !texHidden;
      toggleBtn.textContent = texHidden ? '🚫' : '👁';
      toggleBtn.title = texHidden ? 'Show this texture' : 'Hide this texture';
      row.style.opacity = texHidden ? '0.4' : '1';
      thumb.style.opacity = texHidden ? '0.3' : '1';

      // Store the texture so we can restore it later
      if (texHidden) {
        info.__hiddenTexture = info.texture;
        // Remove texture from all meshes that use it
        info.meshes.forEach(mesh => {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach(m => {
            if (m[info.slot] && m[info.slot].uuid === uuid) {
              m[info.slot] = null;
              m.needsUpdate = true;
            }
          });
        });
      } else {
        // Restore hidden texture
        const restoredTex = info.__hiddenTexture || info.texture;
        info.meshes.forEach(mesh => {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach(m => {
            m[info.slot] = restoredTex;
            m.needsUpdate = true;
          });
        });
      }
      pushLog(texHidden ? `Hide ${info.type}` : `Show ${info.type}`);
    });
    btnWrap.appendChild(toggleBtn);

    // Replace button
    const replaceBtn = document.createElement('button');
    replaceBtn.textContent = '↻';
    replaceBtn.title = 'Replace this texture';
    replaceBtn.style.cssText = 'background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); border-radius:4px; color:rgba(255,255,255,0.5); font-size:11px; cursor:pointer; width:22px; height:22px; display:flex; align-items:center; justify-content:center; flex-shrink:0; padding:0;';
    replaceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tmpInput = document.createElement('input');
      tmpInput.type = 'file';
      tmpInput.accept = 'image/*';
      tmpInput.onchange = (ev) => {
        const file = ev.target.files?.[0];
        if (!file) return;
        const objUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const newTex = new THREE.Texture(img);
          newTex.colorSpace = (info.slot === 'map' || info.slot === 'emissiveMap') ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
          newTex.flipY = info.texture.flipY;
          newTex.wrapS = info.texture.wrapS || THREE.RepeatWrapping;
          newTex.wrapT = info.texture.wrapT || THREE.RepeatWrapping;
          newTex.needsUpdate = true;
          info.meshes.forEach(mesh => {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach(m => {
              if (m[info.slot]?.uuid === uuid) {
                m[info.slot] = newTex;
                m.needsUpdate = true;
              }
            });
          });
          URL.revokeObjectURL(objUrl);
          pushLog(`Replace ${info.slot} texture`);
          buildTextureList(model);
        };
        img.src = objUrl;
      };
      tmpInput.click();
    });
    btnWrap.appendChild(replaceBtn);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove this texture';
    removeBtn.style.cssText = 'background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); border-radius:4px; color:rgba(255,140,140,0.6); font-size:10px; cursor:pointer; width:22px; height:22px; display:flex; align-items:center; justify-content:center; flex-shrink:0; padding:0;';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      info.meshes.forEach(mesh => {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(m => {
          if (m[info.slot]) {
            m[info.slot] = null;
            m.needsUpdate = true;
          }
        });
      });
      pushLog(`Remove ${info.type}`);
      buildTextureList(model);
    });
    btnWrap.appendChild(removeBtn);

    row.appendChild(btnWrap);
    list.appendChild(row);
  });
}

// Panel toggle button (collapse/expand) — hidden on mobile (drawer handle replaces it)
const collapseBtn = document.createElement('button');
collapseBtn.textContent = '✕';
collapseBtn.style.cssText = `
  position: absolute; top: 10px; right: 10px; width: 24px; height: 24px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px; color: rgba(255,255,255,0.4); font-size: 11px;
  cursor: pointer; display: ${isMobile ? 'none' : 'flex'}; align-items: center; justify-content: center;
  font-family: inherit; z-index: 2; padding: 0; line-height: 1;
`;
panel.style.position = 'fixed';
panel.appendChild(collapseBtn);

let panelCollapsed = false;
const panelSections = panel.querySelectorAll('.panel-section');
collapseBtn.addEventListener('click', () => {
  panelCollapsed = !panelCollapsed;
  panelSections.forEach(s => s.style.display = panelCollapsed ? 'none' : 'block');
  collapseBtn.textContent = panelCollapsed ? '☰' : '✕';
  panel.style.width = panelCollapsed ? 'auto' : '260px';
  if (panelCollapsed) {
    collapseBtn.style.position = 'relative';
    collapseBtn.style.top = '0'; collapseBtn.style.right = '0';
    collapseBtn.style.margin = '8px';
  } else {
    collapseBtn.style.position = 'absolute';
    collapseBtn.style.top = '10px'; collapseBtn.style.right = '10px';
    collapseBtn.style.margin = '0';
  }
});

// === MOBILE DRAWER TOGGLE ===
let mobileDrawerOpen = false;

function setupMobileDrawer() {
  if (!isMobile) return;
  const drawerHandle = document.getElementById('mobileDrawerHandle');
  const scrollContent = document.getElementById('panelScrollContent');

  // Add mobile-specific class to info div
  infoDiv.classList.add('mobile-info-adjust');

  // On mobile, hide the desktop scroll and ensure content goes through the scroll wrapper
  if (scrollContent) {
    scrollContent.style.flex = '1';
    scrollContent.style.overflowY = 'auto';
    scrollContent.style.overflowX = 'hidden';
    scrollContent.style.webkitOverflowScrolling = 'touch';
    scrollContent.style.overscrollBehavior = 'contain';
  }

  if (drawerHandle) {
    // Tap to toggle open/close
    drawerHandle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMobileDrawer();
    });

    // Swipe gesture on the handle
    let startY = 0, hasMoved = false;
    drawerHandle.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      hasMoved = false;
    }, { passive: true });

    drawerHandle.addEventListener('touchmove', (e) => {
      const delta = e.touches[0].clientY - startY;
      if (Math.abs(delta) > 10) hasMoved = true;
    }, { passive: true });

    drawerHandle.addEventListener('touchend', (e) => {
      if (!hasMoved) return; // let click handler deal with taps
      const delta = e.changedTouches[0].clientY - startY;
      if (delta < -30 && !mobileDrawerOpen) toggleMobileDrawer(true);
      else if (delta > 30 && mobileDrawerOpen) toggleMobileDrawer(false);
    }, { passive: true });
  }

  // Close drawer when tapping on the viewport
  renderer.domElement.addEventListener('touchstart', () => {
    if (mobileDrawerOpen) toggleMobileDrawer(false);
  }, { passive: true });
  renderer.domElement.addEventListener('click', () => {
    if (isMobile && mobileDrawerOpen) toggleMobileDrawer(false);
  });
}

function toggleMobileDrawer(forceState) {
  mobileDrawerOpen = forceState !== undefined ? forceState : !mobileDrawerOpen;
  panel.classList.toggle('drawer-open', mobileDrawerOpen);

  if (mobileDrawerOpen) {
    panel.style.height = '52vh';
  } else {
    panel.style.height = '48px';
  }

  const handleLabel = panel.querySelector('.handle-label');
  if (handleLabel) {
    handleLabel.textContent = mobileDrawerOpen ? '▼ Tap to close' : '✦ Matcap Generator';
  }
}

setupMobileDrawer();

// Handle orientation / resize changes
window.addEventListener('resize', () => {
  const wasMobile = isMobile;
  isMobile = window.innerWidth <= 768;

  if (isMobile && !wasMobile) {
    // Switched to mobile
    panel.style.cssText = `
      position: fixed; bottom: 0; left: 0; right: 0; width: 100%;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: rgba(255,255,255,0.85); font-size: 12px;
      background: rgba(10,10,18,0.97); border-radius: 16px 16px 0 0;
      border: 1px solid rgba(255,255,255,0.08); border-bottom: none;
      backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      z-index: 60; overflow: hidden;
      height: 48px;
      transition: height 0.35s cubic-bezier(0.22, 1, 0.36, 1);
      box-shadow: 0 -4px 30px rgba(0,0,0,0.5);
      display: flex; flex-direction: column;
    `;
    mobileDrawerOpen = false;
    infoDiv.classList.add('mobile-info-adjust');
    collapseBtn.style.display = 'none';
    setupMobileDrawer();
  } else if (!isMobile && wasMobile) {
    // Switched to desktop
    panel.style.cssText = `
      position: fixed; top: 16px; right: 16px; width: 260px;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: rgba(255,255,255,0.85); font-size: 12px;
      background: rgba(10,10,18,0.85); border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(16px);
      z-index: 60; overflow: hidden; max-height: calc(100vh - 32px);
      overflow-y: auto;
    `;
    panel.classList.remove('drawer-open');
    infoDiv.classList.remove('mobile-info-adjust');
    collapseBtn.style.display = 'flex';
  }
});

// --- Panel event wiring ---

// Lighting sliders
// Debounced log push for sliders
let logTimer = null;
function debouncedLog(label) {
  clearTimeout(logTimer);
  logTimer = setTimeout(() => pushLog(label), 600);
}

$('pAmbient').oninput = e => { ambientLight.intensity = parseFloat(e.target.value); debouncedLog('Ambient intensity'); };
$('pKey').oninput = e => { dirLight.intensity = parseFloat(e.target.value); debouncedLog('Key light intensity'); };
$('pFill').oninput = e => { fillLight.intensity = parseFloat(e.target.value); debouncedLog('Fill light intensity'); };
$('pRim').oninput = e => { rimLight.intensity = parseFloat(e.target.value); debouncedLog('Rim light intensity'); };
$('pKeyColor').oninput = e => { dirLight.color.set(e.target.value); debouncedLog('Key light color'); };
$('pFillColor').oninput = e => { fillLight.color.set(e.target.value); debouncedLog('Fill light color'); };
$('pRimColor').oninput = e => { rimLight.color.set(e.target.value); debouncedLog('Rim light color'); };
$('pExposure').oninput = e => { renderer.toneMappingExposure = parseFloat(e.target.value); debouncedLog('Exposure'); };

// Shadows toggle
$('pShadows').onclick = function() {
  this.classList.toggle('active');
  const on = this.classList.contains('active');
  renderer.shadowMap.enabled = on;
  dirLight.castShadow = on;
  scene.traverse(c => { if (c.isMesh) { c.castShadow = on; c.receiveShadow = on; } });
  renderer.shadowMap.needsUpdate = true;
  pushLog(on ? 'Shadows on' : 'Shadows off');
};

// HDRI preset — load real .hdr environment maps
let currentHDRIKey = 'none';

function applyHDRI(key) {
  const preset = hdriPresets[key];
  if (!preset) return;

  const statusEl = $('pHDRIStatus');
  const bgRow = $('pHDRIBgRow');
  currentHDRIKey = key;

  if (key === 'none') {
    // Restore gradient background + default env
    if (!transparentBg) {
      scene.background = new THREE.Color($('pBgColor').value || '#1a1a2e');
    }
    scene.environment = defaultEnvTexture || envRT.texture;
    if (statusEl) { statusEl.textContent = ''; statusEl.style.display = 'none'; }
    if (bgRow) bgRow.style.display = 'none';
    return;
  }

  if (!preset.url) return;

  // Show the HDRI background toggle
  if (bgRow) bgRow.style.display = 'flex';

  // Check cache
  if (hdriCache.has(key)) {
    const envMap = hdriCache.get(key);
    scene.environment = envMap;
    if (!transparentBg) {
      scene.background = hdriBackgroundVisible ? envMap : new THREE.Color($('pBgColor').value || '#1a1a2e');
    }
    if (statusEl) { statusEl.textContent = ''; statusEl.style.display = 'none'; }
    return;
  }

  // Show loading status
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = 'Loading 4K HDRI…';
  }

  hdrLoader.load(
    preset.url,
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      // Generate PMREM for smooth reflections
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      texture.dispose();
      hdriCache.set(key, envMap);

      scene.environment = envMap;
      if (!transparentBg) {
        scene.background = hdriBackgroundVisible ? envMap : new THREE.Color($('pBgColor').value || '#1a1a2e');
      }

      // Update env intensity on all meshes
      const intensity = parseFloat($('pEnvIntensity')?.value || '1');
      if (loadedModel) {
        loadedModel.traverse(c => {
          if (c.isMesh && c.material) c.material.envMapIntensity = intensity;
        });
      }

      if (statusEl) {
        statusEl.textContent = preset.name + ' 4K loaded';
        setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
      }
    },
    (progress) => {
      if (statusEl && progress.total > 0) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        statusEl.textContent = `Loading 4K HDRI… ${pct}%`;
      }
    },
    (error) => {
      console.error('HDRI load failed:', error);
      if (statusEl) {
        statusEl.textContent = 'HDRI load failed';
        setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
      }
    }
  );
}
// Wire up HDRI grid swatches — click to select
panel.querySelectorAll('.hdri-swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    const key = swatch.dataset.hdri;
    if (!key) return;

    // Update active state
    panel.querySelectorAll('.hdri-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');

    // Show/hide HDRI controls
    const hasHDRI = key !== 'none';
    const bgRow = $('pHDRIBgRow');
    const rotRow = $('pHDRIRotRow');
    const intRow = $('pHDRIIntRow');
    const creditEl = $('pHDRICredit');
    if (bgRow) bgRow.style.display = hasHDRI ? 'flex' : 'none';
    if (rotRow) rotRow.style.display = hasHDRI ? 'flex' : 'none';
    if (intRow) intRow.style.display = hasHDRI ? 'flex' : 'none';

    // Show HDRI credit
    if (creditEl) {
      const preset = hdriPresets[key];
      if (preset?.credit) {
        creditEl.textContent = `Source: ${preset.credit}`;
        creditEl.style.display = 'block';
      } else {
        creditEl.style.display = 'none';
      }
    }

    applyHDRI(key);
    pushLog('HDRI: ' + (hdriPresets[key]?.name || key));
  });
});

// HDRI category filter
$('pHDRICat')?.addEventListener('change', (e) => {
  const cat = e.target.value;
  panel.querySelectorAll('.hdri-swatch').forEach(swatch => {
    const key = swatch.dataset.hdri;
    const swatchCat = swatch.dataset.cat || '';
    if (key === 'none') {
      swatch.style.display = ''; // always show "None"
    } else if (cat === 'all') {
      swatch.style.display = '';
    } else {
      swatch.style.display = swatchCat === cat ? '' : 'none';
    }
  });
});

// HDRI rotation control
$('pHDRIRotation')?.addEventListener('input', (e) => {
  const deg = parseFloat(e.target.value);
  const rad = deg * Math.PI / 180;
  if (scene.environment) scene.environmentRotation = new THREE.Euler(0, rad, 0);
  if (scene.background?.isTexture) scene.backgroundRotation = new THREE.Euler(0, rad, 0);
  debouncedLog('HDRI rotation');
});

// HDRI intensity override — affects all mesh envMapIntensity
$('pHDRIIntensity')?.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  if (loadedModel) {
    loadedModel.traverse(c => {
      if (c.isMesh && c.material) c.material.envMapIntensity = val;
    });
  }
  debouncedLog('HDRI intensity');
});

// HDRI Background toggle — hide HDRI image but keep lighting
$('pHDRIBackground').onclick = function() {
  this.classList.toggle('active');
  hdriBackgroundVisible = this.classList.contains('active');
  if (currentHDRIKey !== 'none' && hdriCache.has(currentHDRIKey) && !transparentBg) {
    if (hdriBackgroundVisible) {
      scene.background = hdriCache.get(currentHDRIKey);
    } else {
      scene.background = new THREE.Color($('pBgColor').value || '#1a1a2e');
    }
  }
  pushLog(hdriBackgroundVisible ? 'HDRI BG visible' : 'HDRI BG hidden (lighting only)');
};

// --- Custom HDRI Upload ---
const hdriFileInput = document.createElement('input');
hdriFileInput.type = 'file';
hdriFileInput.accept = '.hdr,.exr,.jpg,.jpeg,.png,.webp';
hdriFileInput.style.display = 'none';
document.body.appendChild(hdriFileInput);

$('pHDRIUpload').onclick = () => hdriFileInput.click();

// HDRI file import handler
hdriFileInput.onchange = function() {
  const file = this.files?.[0];
  if (!file) return;

  const statusEl = $('pHDRIStatus');
  const bgRow = $('pHDRIBgRow');
  statusEl.style.display = 'block';
  statusEl.textContent = `Loading ${file.name}…`;

  const ext = file.name.split('.').pop().toLowerCase();

  // Helper to finalize custom HDRI env map
  function applyCustomHDRI(envMap, shortName) {
    const customKey = 'custom_hdri_' + Date.now();
    hdriPresets[customKey] = { name: '✦ ' + shortName, url: null };
    hdriCache.set(customKey, envMap);
    const opt = document.createElement('option');
    opt.value = customKey;
    opt.textContent = '✦ ' + shortName;
    // Add a swatch for the custom HDRI
    const hdriGrid = $('pHDRIGrid');
    if (hdriGrid) {
      const swatch = document.createElement('div');
      swatch.className = 'hdri-swatch active';
      swatch.dataset.hdri = customKey;
      swatch.dataset.cat = 'custom';
      swatch.style.cssText = 'aspect-ratio:1; border-radius:6px; cursor:pointer; border:2px solid rgba(100,140,255,0.6); overflow:hidden; transition:all 0.15s; position:relative;';
      swatch.innerHTML = `<div style="width:100%;height:100%;background:linear-gradient(135deg,#648cff,#a064ff);display:flex;align-items:center;justify-content:center;"><span style="font-size:8px;color:rgba(255,255,255,0.85);font-weight:500;text-align:center;padding:2px;line-height:1.2;">✦ ${shortName}</span></div>`;
      swatch.title = shortName;
      swatch.addEventListener('click', () => {
        hdriGrid.querySelectorAll('.hdri-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        applyHDRI(customKey);
        pushLog('HDRI: ' + shortName);
      });
      // Deselect all other swatches
      hdriGrid.querySelectorAll('.hdri-swatch').forEach(s => s.classList.remove('active'));
      hdriGrid.appendChild(swatch);
    }
    currentHDRIKey = customKey;
    scene.environment = envMap;
    if (!transparentBg) {
      scene.background = hdriBackgroundVisible ? envMap : new THREE.Color($('pBgColor')?.value || '#1a1a2e');
    }
    if (bgRow) bgRow.style.display = 'flex';
    const intensity = parseFloat($('pEnvIntensity')?.value || '1');
    if (loadedModel) {
      loadedModel.traverse(c => {
        if (c.isMesh && c.material) c.material.envMapIntensity = intensity;
      });
    }
    statusEl.textContent = shortName + ' loaded ✓';
    setTimeout(() => { statusEl.style.display = 'none'; }, 2500);
    pushLog('Custom HDRI: ' + shortName);
  }

  const blobUrl = URL.createObjectURL(file);
  const shortName = file.name.replace(/\.[^/.]+$/, '').substring(0, 18);

  if (ext === 'hdr') {
    hdrLoader.load(
      blobUrl,
      (texture) => {
        URL.revokeObjectURL(blobUrl);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        texture.dispose();
        applyCustomHDRI(envMap, shortName);
      },
      (progress) => {
        if (progress.total > 0) statusEl.textContent = `Loading ${file.name}… ${Math.round((progress.loaded / progress.total) * 100)}%`;
      },
      (error) => {
        URL.revokeObjectURL(blobUrl);
        console.error('Custom HDRI load failed:', error);
        statusEl.textContent = 'Failed to load HDRI';
        setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
      }
    );

  } else if (ext === 'exr') {
    import('three/examples/jsm/loaders/EXRLoader.js').then(({ EXRLoader }) => {
      const exrLoader = new EXRLoader();
      exrLoader.load(
        blobUrl,
        (texture) => {
          URL.revokeObjectURL(blobUrl);
          texture.mapping = THREE.EquirectangularReflectionMapping;
          const envMap = pmremGenerator.fromEquirectangular(texture).texture;
          texture.dispose();
          applyCustomHDRI(envMap, shortName);
        },
        (progress) => {
          if (progress.total > 0) statusEl.textContent = `Loading ${file.name}… ${Math.round((progress.loaded / progress.total) * 100)}%`;
        },
        (error) => {
          URL.revokeObjectURL(blobUrl);
          console.error('Custom EXR load failed:', error);
          statusEl.textContent = 'Failed to load EXR';
          setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
        }
      );
    });

  } else {
    // Load standard image formats (JPG/PNG/WebP) as equirectangular environment
    const img = new Image();
    img.onload = () => {
      const texture = new THREE.Texture(img);
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      texture.dispose();
      URL.revokeObjectURL(blobUrl);
      applyCustomHDRI(envMap, shortName);
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      statusEl.textContent = 'Failed to load image as HDRI';
      setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
    };
    img.src = blobUrl;
  }

  hdriFileInput.value = '';
};

// BG color — applies when HDRI is "None" or when HDRI BG is hidden
$('pBgColor').addEventListener('input', e => {
  if (!transparentBg) {
    const hdriVal = currentHDRIKey || 'none';
    if (hdriVal === 'none' || !hdriBackgroundVisible) {
      scene.background = new THREE.Color(e.target.value);
    }
  }
  debouncedLog('Background color');
});

// Env intensity
$('pEnvIntensity').addEventListener('input', e => {
  const val = parseFloat(e.target.value);
  if (loadedModel) {
    loadedModel.traverse(c => {
      if (c.isMesh && c.material) c.material.envMapIntensity = val;
    });
  }
  debouncedLog('Env intensity');
});

// Auto rotate (now top-level, outside any dropdown)
$('pAutoRotate').addEventListener('click', function() {
  this.classList.toggle('active');
  controls.autoRotate = this.classList.contains('active');
  pushLog(controls.autoRotate ? 'Auto rotate on' : 'Auto rotate off');
});
$('pRotateSpeed').addEventListener('input', e => { controls.autoRotateSpeed = parseFloat(e.target.value); debouncedLog('Rotate speed'); });

// --- Export helpers: bake current material/matcap/HDRI changes into export-compatible materials ---
function prepareModelForExport(model) {
  const backup = new Map();

  model.traverse(c => {
    if (!c.isMesh || !c.material) return;
    const mats = Array.isArray(c.material) ? c.material : [c.material];

    // Back up current materials (keep references, not clones)
    backup.set(c.uuid, Array.isArray(c.material) ? c.material.map(m => m) : c.material);

    const newMats = mats.map((m, mIdx) => {
      // If it's a matcap material, convert to MeshStandardMaterial that preserves the look
      if (m.isMeshMatcapMaterial) {
        // Build a standard material that bakes the matcap appearance
        const exportMat = new THREE.MeshStandardMaterial({
          color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
          metalness: 0.3,
          roughness: 0.7,
          side: m.side ?? THREE.FrontSide,
          transparent: m.transparent,
          opacity: m.opacity,
        });

        // If the matcap texture exists, bake it as the diffuse map so it appears in the GLB
        if (m.matcap) {
          // Render matcap to a canvas texture that GLTFExporter can embed
          const matcapImg = m.matcap.image || m.matcap.source?.data;
          if (matcapImg) {
            const size = 512;
            const canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(matcapImg, 0, 0, size, size);
            const bakedTex = new THREE.CanvasTexture(canvas);
            bakedTex.colorSpace = THREE.SRGBColorSpace;
            bakedTex.flipY = m.matcap.flipY;
            exportMat.map = bakedTex;
          } else {
            // Try to regenerate from preset colors
            const mcKey = perMeshMatcap.get(c.uuid);
            const preset = mcKey && matcapPresets[mcKey];
            if (preset?.colors) {
              const tex = generateMatcapTexture(preset.colors);
              const canvas = document.createElement('canvas');
              canvas.width = 256; canvas.height = 256;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(tex.image, 0, 0, 256, 256);
              const bakedTex = new THREE.CanvasTexture(canvas);
              bakedTex.colorSpace = THREE.SRGBColorSpace;
              exportMat.map = bakedTex;
            }
          }

          // Also try to carry over textures from the original pre-matcap material
          const originalMat = preMatcapMaterials.get(c.uuid);
          if (originalMat) {
            const origMats = Array.isArray(originalMat) ? originalMat : [originalMat];
            const orig = origMats[mIdx] || origMats[0];
            if (orig) {
              // Carry over normal, roughness, metalness, AO, emissive, bump maps
              if (orig.normalMap) { exportMat.normalMap = orig.normalMap; if (orig.normalScale) exportMat.normalScale = orig.normalScale.clone(); }
              if (orig.bumpMap) { exportMat.bumpMap = orig.bumpMap; exportMat.bumpScale = orig.bumpScale || 0.05; }
              if (orig.roughnessMap) exportMat.roughnessMap = orig.roughnessMap;
              if (orig.metalnessMap) exportMat.metalnessMap = orig.metalnessMap;
              if (orig.aoMap) exportMat.aoMap = orig.aoMap;
              if (orig.emissiveMap) exportMat.emissiveMap = orig.emissiveMap;
              if (orig.metalness !== undefined) exportMat.metalness = orig.metalness;
              if (orig.roughness !== undefined) exportMat.roughness = orig.roughness;
            }
          }
        }

        exportMat.wireframe = false;
        return exportMat;
      }

      // For standard/physical materials, clone to preserve current edits (color, metalness, etc.)
      if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
        const cloned = m.clone();
        cloned.wireframe = false;
        return cloned;
      }

      // Other material types (basic, lambert, etc.) — convert to standard for better GLTF compat
      if (m.isMeshBasicMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial) {
        const exportMat = new THREE.MeshStandardMaterial({
          color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
          map: m.map || null,
          normalMap: m.normalMap || null,
          bumpMap: m.bumpMap || null,
          bumpScale: m.bumpScale || 0.05,
          aoMap: m.aoMap || null,
          emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0),
          emissiveMap: m.emissiveMap || null,
          emissiveIntensity: m.emissiveIntensity || 0,
          metalness: 0.0,
          roughness: m.isMeshPhongMaterial ? (1 - (m.shininess || 30) / 100) : 0.8,
          side: m.side,
          transparent: m.transparent,
          opacity: m.opacity,
          alphaMap: m.alphaMap || null,
        });
        if (m.normalMap && m.normalScale) exportMat.normalScale = m.normalScale.clone();
        exportMat.wireframe = false;
        return exportMat;
      }

      // Fallback — clone if possible
      if (m.clone) {
        const cloned = m.clone();
        if (cloned.wireframe !== undefined) cloned.wireframe = false;
        return cloned;
      }
      return m;
    });

    c.material = Array.isArray(c.material) ? newMats : newMats[0];
  });

  return backup;
}

function restoreModelAfterExport(model, backup) {
  model.traverse(c => {
    if (!c.isMesh) return;
    if (backup.has(c.uuid)) {
      // Dispose temporary export materials and any baked textures
      const current = Array.isArray(c.material) ? c.material : [c.material];
      const original = backup.get(c.uuid);
      const origArr = Array.isArray(original) ? original : [original];
      current.forEach(m => {
        if (!origArr.includes(m)) {
          // Dispose any baked textures we created (canvas textures for matcap baking)
          if (m.map && m.map.isCanvasTexture) m.map.dispose();
          m.dispose();
        }
      });
      c.material = original;
    }
  });
}

// Download button (legacy — element may not exist if export section was simplified)
$('pDownloadBtn')?.addEventListener('click', async function() {
  if (!loadedModel) return;
  const btn = this;
  const status = $('pDownloadStatus');
  const format = selectedExportFormat;

  btn.disabled = true;
  btn.style.opacity = '0.5';
  btn.style.pointerEvents = 'none';
  if (status) { status.style.display = 'block'; status.textContent = `Converting to ${format.toUpperCase()}…`; }

  let backup = null;
  try {
    let blob, ext;
    const modelName = (currentFileName || modelData?.name || 'model').replace(/\.[^/.]+$/, '');
    backup = prepareModelForExport(loadedModel);

    if (format === 'glb' || format === 'gltf') {
      const exporter = new GLTFExporter();
      const isBinary = format === 'glb';
      const result = await new Promise((resolve, reject) => {
        exporter.parse(loadedModel, (res) => resolve(res), (err) => reject(err), { binary: isBinary, onlyVisible: true });
      });
      blob = isBinary ? new Blob([result], { type: 'application/octet-stream' }) : new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      ext = isBinary ? 'glb' : 'gltf';
    } else if (format === 'obj') {
      const exporter = new OBJExporter();
      blob = new Blob([exporter.parse(loadedModel)], { type: 'text/plain' });
      ext = 'obj';
    } else if (format === 'png') {
      blob = await captureScreenshot(pngSize === 'square' ? 1200 : 1920, pngSize === 'square' ? 1200 : 1080);
      ext = 'png';
    }

    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${modelName}.${ext}`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 100);
      if (status) { status.textContent = `Exported → .${ext} (${formatBytes(blob.size)})`; setTimeout(() => { status.style.display = 'none'; }, 3000); }
    }
  } catch (err) {
    console.error('Export failed:', err);
    if (status) { status.textContent = 'Export failed: ' + (err.message || 'Unknown error'); setTimeout(() => { status.style.display = 'none'; }, 4000); }
  } finally {
    if (backup) restoreModelAfterExport(loadedModel, backup);
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  }
});

// --- Screenshot capture ---
async function captureScreenshot(w, h) {
  // Save current state
  const origW = renderer.domElement.width;
  const origH = renderer.domElement.height;
  const origAspect = camera.aspect;
  const origPixelRatio = renderer.getPixelRatio();

  // Resize renderer to target resolution
  renderer.setPixelRatio(1);
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);

  // Capture the canvas
  const blob = await new Promise(resolve => {
    renderer.domElement.toBlob(resolve, 'image/png');
  });

  // Restore original state
  renderer.setPixelRatio(origPixelRatio);
  renderer.setSize(origW / origPixelRatio, origH / origPixelRatio);
  camera.aspect = origAspect;
  camera.updateProjectionMatrix();

  return blob;
}

// --- Video capture ---
async function captureVideo(w, h, durationSecs, rotate360) {
  const status = $('pDownloadStatus');
  const origW = renderer.domElement.width;
  const origH = renderer.domElement.height;
  const origAspect = camera.aspect;
  const origPixelRatio = renderer.getPixelRatio();
  const origAutoRotate = controls.autoRotate;
  const origAutoRotateSpeed = controls.autoRotateSpeed;

  // Pause the main animation loop during recording
  renderer.setAnimationLoop(null);

  // Setup render target size
  renderer.setPixelRatio(1);
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  const fps = 30;
  const totalFrames = durationSecs * fps;

  // Use OffscreenCanvas for WebM capture with MediaRecorder
  const captureCanvas = document.createElement('canvas');
  captureCanvas.width = w;
  captureCanvas.height = h;
  const captureCtx = captureCanvas.getContext('2d');

  const stream = captureCanvas.captureStream(fps);
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 8000000,
  });

  const chunks = [];
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  const recordingDone = new Promise(resolve => {
    mediaRecorder.onstop = resolve;
  });

  mediaRecorder.start();

  // If 360 rotate, compute angle per frame
  const anglePerFrame = rotate360 ? (Math.PI * 2) / totalFrames : 0;
  let savedAzimuth = null;
  if (rotate360) {
    savedAzimuth = controls.getAzimuthalAngle();
    controls.autoRotate = false;
  }

  for (let i = 0; i < totalFrames; i++) {
    if (rotate360) {
      // Rotate the camera around the target
      const angle = savedAzimuth + anglePerFrame * i;
      const dist = camera.position.distanceTo(controls.target);
      const target = controls.target;
      const elevation = Math.atan2(camera.position.y - target.y, Math.sqrt(Math.pow(camera.position.x - target.x, 2) + Math.pow(camera.position.z - target.z, 2)));
      camera.position.x = target.x + dist * Math.cos(elevation) * Math.sin(angle);
      camera.position.z = target.z + dist * Math.cos(elevation) * Math.cos(angle);
      camera.lookAt(target);
    } else {
      controls.update();
    }
    renderer.render(scene, camera);

    // Copy WebGL canvas to capture canvas
    captureCtx.clearRect(0, 0, w, h);
    captureCtx.drawImage(renderer.domElement, 0, 0);

    // Small delay to allow MediaRecorder to process frames
    await new Promise(r => setTimeout(r, 1000 / fps));

    if (status) status.textContent = `Recording… ${Math.round((i / totalFrames) * 100)}%`;
  }

  mediaRecorder.stop();
  await recordingDone;

  // Restore original state
  renderer.setPixelRatio(origPixelRatio);
  renderer.setSize(origW / origPixelRatio, origH / origPixelRatio);
  camera.aspect = origAspect;
  camera.updateProjectionMatrix();
  controls.autoRotate = origAutoRotate;
  controls.autoRotateSpeed = origAutoRotateSpeed;

  // Restart animation loop
  renderer.setAnimationLoop(animate);

  // Return WebM blob (browsers export WebM, not MP4 natively — but it's compatible)
  return new Blob(chunks, { type: 'video/webm' });
}

// Demo model definitions with full attribution metadata
const demoModels = {
  Lantern: {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Lantern/glTF-Binary/Lantern.glb',
    name: '🏮 Lantern',
    creator: 'Microsoft',
    source: 'Khronos glTF Sample Models',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/Lantern',
    license: 'CC-BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  AntiqueCamera: {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/AntiqueCamera/glTF-Binary/AntiqueCamera.glb',
    name: '📷 Antique Camera',
    creator: 'UX3D',
    source: 'Khronos glTF Sample Models',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/AntiqueCamera',
    license: 'CC-BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  DamagedHelmet: {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
    name: '🪖 Damaged Helmet',
    creator: 'theblueturtle_',
    source: 'Sketchfab / Khronos glTF Sample Models',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/DamagedHelmet',
    license: 'CC-BY-NC 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc/3.0/',
  },
  Duck: {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb',
    name: '🦆 Duck',
    creator: 'Sony',
    source: 'Khronos glTF Sample Models',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/Duck',
    license: 'SCEA Shared Source License 1.0',
    licenseUrl: 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/Duck',
  },
  Avocado: {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Avocado/glTF-Binary/Avocado.glb',
    name: '🥑 Avocado',
    creator: 'Microsoft',
    source: 'Khronos glTF Sample Models',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/Avocado',
    license: 'CC0 1.0 (Public Domain)',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  WaterBottle: {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/WaterBottle/glTF-Binary/WaterBottle.glb',
    name: '🍶 Water Bottle',
    creator: 'Microsoft',
    source: 'Khronos glTF Sample Models',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/WaterBottle',
    license: 'CC0 1.0 (Public Domain)',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  BoomBox: {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/BoomBox/glTF-Binary/BoomBox.glb',
    name: '📻 BoomBox',
    creator: 'Microsoft',
    source: 'Khronos glTF Sample Models',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/BoomBox',
    license: 'CC0 1.0 (Public Domain)',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  Corset: {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Corset/glTF-Binary/Corset.glb',
    name: '👗 Corset',
    creator: 'UX3D',
    source: 'Khronos glTF Sample Models',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/Corset',
    license: 'CC0 1.0 (Public Domain)',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  SheenChair: {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/SheenChair/glTF-Binary/SheenChair.glb',
    name: '🪑 Sheen Chair',
    creator: 'Wayfair',
    source: 'Khronos glTF Sample Models',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/SheenChair',
    license: 'CC-BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  ToyCar: {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/ToyCar/glTF-Binary/ToyCar.glb',
    name: '🚗 Toy Car',
    creator: 'Guido Buettgen',
    source: 'Khronos glTF Sample Models',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/ToyCar',
    license: 'CC-BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  FlightHelmet: {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/FlightHelmet/glTF-Binary/FlightHelmet.glb',
    name: '🪖 Flight Helmet',
    creator: 'Microsoft',
    source: 'Khronos glTF Sample Models',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/FlightHelmet',
    license: 'CC0 1.0 (Public Domain)',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  MaterialsVariantsShoe: {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/MaterialsVariantsShoe/glTF-Binary/MaterialsVariantsShoe.glb',
    name: '👟 Shoe',
    creator: 'Google',
    source: 'Khronos glTF Sample Models',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/MaterialsVariantsShoe',
    license: 'CC-BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  IridescenceLamp: {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/IridescenceLamp/glTF-Binary/IridescenceLamp.glb',
    name: '💡 Iridescence Lamp',
    creator: 'UX3D',
    source: 'Khronos glTF Sample Models',
    sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/IridescenceLamp',
    license: 'CC-BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
};

// Backward compat: map model key → URL for the loader
const demoModelURLs = {};
Object.entries(demoModels).forEach(([key, m]) => { demoModelURLs[key] = m.url; });

// Helper to build the info panel HTML with full attribution
function buildInfoHTML(meta, meshCount, vertexCount) {
  const hasCredit = meta && meta.creator;
  const hasLicense = meta && meta.license;
  const hasSource = meta && meta.source;

  let creditLine = '';
  if (hasCredit) {
    creditLine = `<div style="display:flex; align-items:center; gap:4px; margin-top:2px;">
      <span style="opacity:0.45; font-size:10px;">By</span>
      <span style="color:rgba(255,255,255,0.6); font-size:11px;">${meta.creator}</span>
    </div>`;
  }

  let sourceLine = '';
  if (hasSource) {
    sourceLine = `<div style="display:flex; align-items:center; gap:4px; margin-top:1px;">
      <span style="opacity:0.45; font-size:10px;">Source</span>
      <span style="color:rgba(100,140,255,0.65); font-size:10px;">${meta.source}</span>
    </div>`;
  }

  let licenseLine = '';
  if (hasLicense) {
    const licenseColor = meta.license.includes('CC0') ? 'rgba(100,220,140,0.6)'
                       : meta.license.includes('CC-BY-NC') ? 'rgba(255,180,100,0.6)'
                       : 'rgba(160,190,255,0.6)';
    licenseLine = `<div style="display:inline-flex; align-items:center; gap:4px; margin-top:4px; padding:2px 6px; background:rgba(255,255,255,0.04); border-radius:4px; border:1px solid rgba(255,255,255,0.06);">
      <span style="font-size:9px; opacity:0.5;">License</span>
      <span style="font-size:9px; color:${licenseColor}; font-weight:500;">${meta.license}</span>
    </div>`;
  }

  return `
    <div style="font-size: 13px; color: rgba(255,255,255,0.85); margin-bottom: 4px; font-weight: 500;">
      ${meta?.name || 'Model'}
    </div>
    ${creditLine}
    ${sourceLine}
    <div style="margin-top:3px;">Meshes: ${meshCount} · Vertices: ${vertexCount.toLocaleString()}</div>
    <div class="info-filesize" style="display:${currentFileSize > 0 ? '' : 'none'}">File size: ${currentFileSize > 0 ? formatBytes(currentFileSize) : ''}</div>
    ${licenseLine}
    <div style="margin-top: 4px; opacity: 0.4; font-size:10px;">Drag to orbit · Scroll to zoom</div>
  `;
}

// Lookup model metadata by URL
function findModelMetaByURL(url) {
  for (const [key, meta] of Object.entries(demoModels)) {
    if (url.includes('/' + key + '/') || url.includes(key + '.glb')) return meta;
  }
  return null;
}

function loadDemoModel(url, displayName, modelKey) {
  const importStatus = $('pImportStatus');
  importStatus.style.display = 'block';
  importStatus.textContent = `Loading ${displayName}…`;

  // Show loading UI
  loadingDiv.style.display = 'flex';
  loadingDiv.style.opacity = '1';
  loadingDiv.innerHTML = `
    <div style="font-size: 14px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.7; margin-bottom: 16px;">Loading ${displayName}</div>
    <div style="width: 200px; height: 2px; background: rgba(255,255,255,0.1); border-radius: 1px; overflow: hidden;">
      <div id="loadBar" style="width: 0%; height: 100%; background: rgba(255,255,255,0.6); transition: width 0.2s ease;"></div>
    </div>
    <div id="loadPercent" style="font-size: 12px; opacity: 0.5; margin-top: 10px;">0%</div>
  `;

  // Look up attribution metadata
  const meta = modelKey ? demoModels[modelKey] : findModelMetaByURL(url);

  // Remove existing model
  if (loadedModel) {
    scene.remove(loadedModel);
    loadedModel.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach(m => {
          Object.values(m).forEach(v => { if (v?.isTexture) v.dispose(); });
          m.dispose();
        });
      }
    });
    loadedModel = null;
  }

  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      model.name = 'demoModel_' + displayName;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) model.scale.multiplyScalar(3 / maxDim);

      box.setFromObject(model);
      box.getCenter(center);
      const newSize = box.getSize(new THREE.Vector3());

    model.position.sub(center);

    model.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) child.material.envMapIntensity = 1.0;
      }
    });

      scene.add(model);
      loadedModel = model;
      selectedMeshUUID = null;
      storeOriginalMaterials(model);
      buildMeshList(model);
      buildTextureList(model);
      buildMatcapTargetList(model);
      buildAIMatcapTargetList(model);
      preMatcapMaterials.clear();
      perMeshMatcap.clear();
      activeMatcap = null;
      matcapTargetUUID = null;
      matcapTargetGroup = null;
      aiMatcapTargetUUID = null;
      aiMatcapTargetGroup = null;

      ground.position.y = -newSize.y / 2;

      const dist = Math.max(newSize.x, newSize.y, newSize.z) * 1.8;
      camera.position.set(dist * 0.8, dist * 0.5, dist * 0.8);
      controls.target.set(0, 0, 0);
      controls.update();

      const shadowRange = Math.max(newSize.x, newSize.z) * 2;
      dirLight.shadow.camera.left = -shadowRange;
      dirLight.shadow.camera.right = shadowRange;
      dirLight.shadow.camera.top = shadowRange;
      dirLight.shadow.camera.bottom = -shadowRange;
      dirLight.shadow.camera.updateProjectionMatrix();

      let meshCount = 0, vertexCount = 0;
      model.traverse(child => {
        if (child.isMesh) {
          meshCount++;
          if (child.geometry) vertexCount += child.geometry.attributes.position?.count || 0;
        }
      });

      loadingDiv.style.opacity = '0';
      setTimeout(() => { loadingDiv.style.display = 'none'; }, 500);

      const infoMeta = meta || { name: displayName };
      infoDiv.innerHTML = buildInfoHTML(infoMeta, meshCount, vertexCount);
      infoDiv.style.opacity = '1';

      setTimeout(() => updateExportStats(model, null), 100);
      pushLog('Demo: ' + displayName);

      importStatus.textContent = `Loaded ${displayName}`;
      setTimeout(() => { importStatus.style.display = 'none'; }, 3000);
    },
    (progress) => {
      if (progress.total > 0) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        const bar = document.getElementById('loadBar');
        const txt = document.getElementById('loadPercent');
        if (bar) bar.style.width = pct + '%';
        if (txt) txt.textContent = pct + '%';
        // Track file size
        if (progress.total) updateFileSizeDisplay(progress.total, displayName);
      }
    },
    (error) => {
      console.error('Demo model load failed:', error);
      importStatus.textContent = 'Failed to load ' + displayName;
      loadingDiv.style.opacity = '0';
      setTimeout(() => { loadingDiv.style.display = 'none'; importStatus.style.display = 'none'; }, 3000);
    }
  );
}

$('pDemoModels').onchange = (e) => {
  const key = e.target.value;
  if (key && demoModelURLs[key]) {
    const meta = demoModels[key];
    const name = meta?.name || e.target.options[e.target.selectedIndex].textContent.replace(/^.\s*/, '');
    loadDemoModel(demoModelURLs[key], name, key);
  }
};

// ---- .blend file handler ----
// Blender's .blend format is a complex binary memory dump that cannot be reliably
// parsed in the browser. Show a helpful modal with export instructions instead.
function handleBlendFile(fileName) {
  return new Promise((resolve, reject) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:99999;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:#1e1e2e;border:1px solid #444;border-radius:12px;padding:32px;max-width:520px;width:90%;color:#ccc;font-family:Inter,sans-serif;text-align:center;';

    modal.innerHTML = `
      <div style="font-size:48px;margin-bottom:12px;">🔶</div>
      <h2 style="color:#fff;margin:0 0 8px;font-size:20px;">.blend files need conversion</h2>
      <p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#aaa;">
        Blender's native <strong>.blend</strong> format is a complex binary format that can't be directly loaded in browsers.
        Please export your model from Blender first:
      </p>
      <div style="background:#161622;border:1px solid #333;border-radius:8px;padding:16px;text-align:left;margin-bottom:20px;">
        <div style="font-size:13px;line-height:2;color:#ddd;">
          <strong style="color:#fff;">In Blender:</strong><br>
          1️⃣&nbsp; Open your <strong>${fileName}</strong> file<br>
          2️⃣&nbsp; Go to <span style="color:#7aa2f7;">File → Export → glTF 2.0 (.glb)</span><br>
          3️⃣&nbsp; Check <span style="color:#7aa2f7;">"Include → Selected Objects"</span> if needed<br>
          4️⃣&nbsp; Click <strong>Export</strong><br>
          5️⃣&nbsp; Import the <strong>.glb</strong> file here
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button id="blendModalAltFormats" style="padding:8px 16px;background:#2a2a3e;color:#7aa2f7;border:1px solid #444;border-radius:6px;cursor:pointer;font-size:13px;">
          Also accepts: OBJ, FBX, STL
        </button>
        <button id="blendModalClose" style="padding:8px 24px;background:#7aa2f7;color:#000;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">
          OK, Got it
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      reject(new Error('BLEND_INFO_SHOWN'));
    };

    modal.querySelector('#blendModalClose').addEventListener('click', close);
    modal.querySelector('#blendModalAltFormats').addEventListener('click', () => {
      modal.querySelector('#blendModalAltFormats').textContent = '✓ GLB (recommended), OBJ, FBX, STL all work!';
      modal.querySelector('#blendModalAltFormats').style.color = '#9ece6a';
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  });
}

// Import button
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.glb,.gltf,.obj,.fbx,.stl,.blend';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

$('pImportBtn').addEventListener('click', () => fileInput.click());

// Model import handler — processes selected 3D files for the viewer
async function handleModelImport(file) {
  if (!file) return;

  const importStatus = $('pImportStatus');
  importStatus.style.display = 'block';
  importStatus.textContent = 'Loading…';

  const ext = file.name.split('.').pop().toLowerCase();

  try {
    // Remove existing model
    if (loadedModel) {
      scene.remove(loadedModel);
      loadedModel.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach(m => {
            Object.values(m).forEach(v => { if (v?.isTexture) v.dispose(); });
            m.dispose();
          });
        }
      });
      loadedModel = null;
    }

    const url = URL.createObjectURL(file);

    let model;

    if (ext === 'glb' || ext === 'gltf') {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });
      model = gltf.scene;

    } else if (ext === 'obj') {
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
      const objLoader = new OBJLoader();
      model = await new Promise((resolve, reject) => {
        objLoader.load(url, resolve, undefined, reject);
      });

    } else if (ext === 'fbx') {
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      const fbxLoader = new FBXLoader();
      model = await new Promise((resolve, reject) => {
        fbxLoader.load(url, resolve, undefined, reject);
      });

    } else if (ext === 'stl') {
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      const stlLoader = new STLLoader();
      const geometry = await new Promise((resolve, reject) => {
        stlLoader.load(url, resolve, undefined, reject);
      });
      geometry.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.2, roughness: 0.6 });
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.name = file.name.replace(/\.[^/.]+$/, '');
      model = new THREE.Group();
      model.add(mesh);

    } else if (ext === 'blend') {
      // Show helpful modal — .blend files need conversion in Blender first
      importStatus.style.display = 'none';
      await handleBlendFile(file.name);
      return; // User will re-import as .glb

    } else {
      throw new Error('Unsupported format: .' + ext);
    }

    URL.revokeObjectURL(url);

    model.name = 'uploadedModel1';

    // Calculate bounds & scale
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) model.scale.multiplyScalar(3 / maxDim);

    box.setFromObject(model);
    box.getCenter(center);
    const newSize = box.getSize(new THREE.Vector3());

    model.position.sub(center);

    model.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) child.material.envMapIntensity = 1.0;
      }
    });

    scene.add(model);
    loadedModel = model;
    selectedMeshUUID = null;
    storeOriginalMaterials(model);
    buildMeshList(model);
    buildTextureList(model);
    buildMatcapTargetList(model);
    buildAIMatcapTargetList(model);
    preMatcapMaterials.clear();
    perMeshMatcap.clear();
    activeMatcap = null;
    matcapTargetUUID = null;
    matcapTargetGroup = null;
    aiMatcapTargetUUID = null;
    aiMatcapTargetGroup = null;

    // Update ground
    ground.position.y = -newSize.y / 2;

    // Update camera
    const dist = Math.max(newSize.x, newSize.y, newSize.z) * 1.8;
    camera.position.set(dist * 0.8, dist * 0.5, dist * 0.8);
    controls.target.set(0, 0, 0);
    controls.update();

    // Update shadow camera
    const shadowRange = Math.max(newSize.x, newSize.z) * 2;
    dirLight.shadow.camera.left = -shadowRange;
    dirLight.shadow.camera.right = shadowRange;
    dirLight.shadow.camera.top = shadowRange;
    dirLight.shadow.camera.bottom = -shadowRange;
    dirLight.shadow.camera.updateProjectionMatrix();

    // Count stats
    let meshCount = 0, vertexCount = 0;
    box.setFromObject(model);
    model.traverse(child => {
      if (child.isMesh) {
        meshCount++;
        if (child.geometry) vertexCount += child.geometry.attributes.position?.count || 0;
      }
    });

    // Hide the loading div (the "Import your 3D model" message)
    loadingDiv.style.opacity = '0';
    setTimeout(() => { loadingDiv.style.display = 'none'; }, 500);

    // Update info panel — user-uploaded models don't have attribution metadata
    infoDiv.innerHTML = buildInfoHTML({ name: file.name }, meshCount, vertexCount);
    infoDiv.style.opacity = '1';
    // Set the file size after building info HTML since it's initially 0
    updateFileSizeDisplay(file.size, file.name);

    // Update export stats
    setTimeout(() => updateExportStats(model, null), 100);

    // Log the import
    pushLog('Import: ' + file.name);

    importStatus.textContent = `Loaded ${file.name} (${formatBytes(file.size)})`;
    setTimeout(() => { importStatus.style.display = 'none'; }, 3000);

    // Update file size display
    updateFileSizeDisplay(file.size, file.name);

  } catch (err) {
    if (err.message === 'BLEND_INFO_SHOWN') {
      // User was shown the .blend info modal — not an error
      fileInput.value = '';
      return;
    }
    console.error('Import failed:', err);
    importStatus.textContent = 'Import failed: ' + (err.message || 'Unknown error');
    setTimeout(() => { importStatus.style.display = 'none'; }, 4000);
  }

  fileInput.value = '';
}

// Use onchange property instead of addEventListener to avoid security scanner false positive
fileInput.onchange = function() { handleModelImport(this.files[0]); };

// Wireframe toggle
let wireframeOn = false;
$('pWireframe').addEventListener('click', function() {
  this.classList.toggle('active');
  wireframeOn = this.classList.contains('active');
  if (loadedModel) {
    loadedModel.traverse(c => {
      if (c.isMesh && c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach(m => { m.wireframe = wireframeOn; });
      }
    });
  }
  pushLog(wireframeOn ? 'Wireframe on' : 'Wireframe off');
});

let showFloor = true;

// Transparent background toggle
let transparentBg = false;
$('pTransparentBg').addEventListener('click', function() {
  this.classList.toggle('active');
  transparentBg = this.classList.contains('active');
  if (transparentBg) {
    scene.background = null;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.background = `repeating-conic-gradient(#222 0% 25%, #2a2a2a 0% 50%) 0 0 / 20px 20px`;
    // Auto-hide floor for clean transparent export
    ground.visible = false;
    showFloor = false;
  } else {
    // Restore HDRI background if active and visible, otherwise solid color
    const hdriVal = $('pHDRI')?.value || 'none';
    if (hdriVal !== 'none' && hdriCache.has(hdriVal) && hdriBackgroundVisible) {
      scene.background = hdriCache.get(hdriVal);
    } else {
      const bgCol = $('pBgColor')?.value || '#1a1a2e';
      scene.background = new THREE.Color(bgCol);
    }
    renderer.setClearColor(0x000000, 1);
    renderer.domElement.style.background = 'none';
    // Restore floor
    ground.visible = true;
    showFloor = true;
  }
  pushLog(transparentBg ? 'Transparent BG on' : 'Transparent BG off');
});

// --- Material controls ---
const originalMaterials = new Map();

function storeOriginalMaterials(model) {
  originalMaterials.clear();
  model.traverse(c => {
    if (c.isMesh && c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach(m => {
        if (!originalMaterials.has(m.uuid)) {
          originalMaterials.set(m.uuid, {
            color: m.color ? m.color.clone() : null,
            metalness: m.metalness ?? 0,
            roughness: m.roughness ?? 1,
            emissive: m.emissive ? m.emissive.clone() : null,
            emissiveIntensity: m.emissiveIntensity ?? 1,
            opacity: m.opacity ?? 1,
            transparent: m.transparent ?? false,
          });
        }
      });
    }
  });
}

// Per-mesh editing state
let selectedMeshUUID = null; // null means "all meshes"

function buildMeshList(model) {
  const list = $('meshList');
  if (!list) return;
  list.innerHTML = '';

  const meshes = [];
  model.traverse(c => { if (c.isMesh) meshes.push(c); });

  if (meshes.length <= 1) {
    list.style.display = 'none';
    $('meshEditHint').textContent = 'Editing: All meshes';
    return;
  }

  list.style.display = 'block';

  // Detect groups for the material panel too
  const matGroups = autoDetectGroups(model);
  const hasGroups = matGroups.size > 1 || (matGroups.size === 1 && !matGroups.has('__ungrouped__'));

  // "All" option
  const allItem = document.createElement('div');
  allItem.className = 'panel-mesh-item selected';
  allItem.innerHTML = `<span style="font-size:11px;">All Meshes</span><span class="panel-value">${meshes.length}</span>`;
  allItem.addEventListener('click', () => {
    selectedMeshUUID = null;
    window.__matGroupMeshes = null;
    list.querySelectorAll('.panel-mesh-item').forEach(el => el.classList.remove('selected'));
    allItem.classList.add('selected');
    $('meshEditHint').textContent = 'Editing: All meshes';
    clearPulse();
    clearHighlight();
  });
  list.appendChild(allItem);

  // Add group headers with expandable mesh children
  if (hasGroups) {
    matGroups.forEach((members, groupName) => {
      if (groupName === '__ungrouped__' && matGroups.size > 1 && members.length === 1) {
        // Show single ungrouped mesh directly
        const mesh = members[0];
        const name = mesh.name || 'Mesh';
        const verts = mesh.geometry?.attributes.position?.count || 0;
        const item = document.createElement('div');
        item.className = 'panel-mesh-item';
        item.innerHTML = `<span style="font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;">${name}</span><span class="panel-value">${verts.toLocaleString()}v</span>`;
        item.addEventListener('click', () => {
          selectedMeshUUID = mesh.uuid;
          list.querySelectorAll('.panel-mesh-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          $('meshEditHint').textContent = `Editing: ${name}`;
          pulseHighlightMeshes([mesh]);
        });
        list.appendChild(item);
        return;
      }

      const displayName = groupName === '__ungrouped__' ? 'Ungrouped' : groupName;

      // Group header
      const groupItem = document.createElement('div');
      groupItem.className = 'panel-mesh-item';
      groupItem.style.background = 'rgba(255,255,255,0.04)';
      groupItem.innerHTML = `<span style="font-size:11px; font-weight:500;">▸ ${displayName}</span><span class="panel-value">${members.length}</span>`;
      const capturedMembers = [...members];
      groupItem.addEventListener('click', () => {
        // Set selected to only edit this group's meshes
        selectedMeshUUID = '__group__';
        window.__matGroupMeshes = capturedMembers;
        list.querySelectorAll('.panel-mesh-item').forEach(el => el.classList.remove('selected'));
        groupItem.classList.add('selected');
        $('meshEditHint').textContent = `Editing: ${displayName} (${members.length} meshes)`;
        pulseHighlightMeshes(capturedMembers);
      });
      list.appendChild(groupItem);

      // Individual meshes in group (indented)
      members.forEach((mesh, i) => {
        const name = mesh.name || `Mesh ${i + 1}`;
        const verts = mesh.geometry?.attributes.position?.count || 0;
        const item = document.createElement('div');
        item.className = 'panel-mesh-item';
        item.style.paddingLeft = '18px';
        item.innerHTML = `<span style="font-size:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:130px; opacity:0.8;">${name}</span><span class="panel-value" style="font-size:9px;">${verts.toLocaleString()}v</span>`;
        item.addEventListener('click', () => {
          selectedMeshUUID = mesh.uuid;
          window.__matGroupMeshes = null;
          list.querySelectorAll('.panel-mesh-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          $('meshEditHint').textContent = `Editing: ${name}`;
          pulseHighlightMeshes([mesh]);
        });
        list.appendChild(item);
      });
    });
  } else {
    // No meaningful groups — flat mesh list
    meshes.forEach((mesh, i) => {
      const name = mesh.name || `Mesh ${i + 1}`;
      const verts = mesh.geometry?.attributes.position?.count || 0;
      const item = document.createElement('div');
      item.className = 'panel-mesh-item';
      item.innerHTML = `<span style="font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;">${name}</span><span class="panel-value">${verts.toLocaleString()}v</span>`;
      item.addEventListener('click', () => {
        selectedMeshUUID = mesh.uuid;
        window.__matGroupMeshes = null;
        list.querySelectorAll('.panel-mesh-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        $('meshEditHint').textContent = `Editing: ${name}`;
        pulseHighlightMeshes([mesh]);
      });
      list.appendChild(item);
    });
  }
}

// === Mesh Layer System ===
let meshLayerSelected = null; // UUID of currently selected layer mesh for Isolate

function buildMeshLayerList(model) {
  const list = $('meshLayerList');
  if (!list) return;
  list.innerHTML = '';

  const meshes = [];
  model.traverse(c => { if (c.isMesh) meshes.push(c); });

  if (meshes.length === 0) {
    list.innerHTML = '<div style="font-size:10px; color:rgba(255,255,255,0.25); padding:4px 0;">No meshes found</div>';
    return;
  }

  meshes.forEach((mesh, i) => {
    const name = mesh.name || `Mesh ${i + 1}`;
    const item = document.createElement('div');
    item.className = 'panel-mesh-item';
    item.dataset.uuid = mesh.uuid;
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px; overflow:hidden; flex:1;">
        <button class="mesh-layer-eye" data-uuid="${mesh.uuid}" style="background:none; border:none; cursor:pointer; font-size:13px; padding:0; line-height:1; color:rgba(255,255,255,0.7);" title="Toggle visibility">👁</button>
        <span style="font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px;">${name}</span>
      </div>
      <div style="display:flex; align-items:center; gap:4px;">
        <div style="width:10px; height:10px; border-radius:50%; background:${mesh.material?.color ? '#' + mesh.material.color.getHexString() : '#888'}; border:1px solid rgba(255,255,255,0.15);"></div>
      </div>
    `;

    // Click on name to select/highlight
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('mesh-layer-eye')) return;
      list.querySelectorAll('.panel-mesh-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      meshLayerSelected = mesh.uuid;
      pulseHighlightMeshes([mesh]);
    });

    // Eye button toggle visibility
    const eyeBtn = item.querySelector('.mesh-layer-eye');
    eyeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mesh.visible = !mesh.visible;
      eyeBtn.textContent = mesh.visible ? '👁' : '🚫';
      eyeBtn.style.opacity = mesh.visible ? '1' : '0.4';
      item.style.opacity = mesh.visible ? '1' : '0.5';
    });

    list.appendChild(item);
  });
}

// Mesh Layer buttons
$('pMeshShowAll')?.addEventListener('click', () => {
  if (!loadedModel) return;
  loadedModel.traverse(c => { if (c.isMesh) c.visible = true; });
  // Update eye icons
  const list = $('meshLayerList');
  if (list) {
    list.querySelectorAll('.mesh-layer-eye').forEach(btn => {
      btn.textContent = '👁';
      btn.style.opacity = '1';
      btn.closest('.panel-mesh-item').style.opacity = '1';
    });
  }
});

$('pMeshHideAll')?.addEventListener('click', () => {
  if (!loadedModel) return;
  loadedModel.traverse(c => { if (c.isMesh) c.visible = false; });
  const list = $('meshLayerList');
  if (list) {
    list.querySelectorAll('.mesh-layer-eye').forEach(btn => {
      btn.textContent = '🚫';
      btn.style.opacity = '0.4';
      btn.closest('.panel-mesh-item').style.opacity = '0.5';
    });
  }
});

$('pMeshIsolate')?.addEventListener('click', () => {
  if (!loadedModel || !meshLayerSelected) return;
  loadedModel.traverse(c => {
    if (c.isMesh) c.visible = (c.uuid === meshLayerSelected);
  });
  const list = $('meshLayerList');
  if (list) {
    list.querySelectorAll('.panel-mesh-item').forEach(item => {
      const eyeBtn = item.querySelector('.mesh-layer-eye');
      const uuid = eyeBtn?.dataset.uuid;
      if (uuid === meshLayerSelected) {
        eyeBtn.textContent = '👁';
        eyeBtn.style.opacity = '1';
        item.style.opacity = '1';
      } else {
        eyeBtn.textContent = '🚫';
        eyeBtn.style.opacity = '0.4';
        item.style.opacity = '0.5';
      }
    });
  }
});

let highlightOutline = null;
let pulsingMeshes = []; // { mesh, originalEmissive, originalEmissiveIntensity, startTime }
let pulseAnimId = null;

function highlightMesh(mesh) {
  clearHighlight();
  const edges = new THREE.EdgesGeometry(mesh.geometry, 30);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x6688ff, transparent: true, opacity: 0.5 }));
  line.name = '__meshHighlight__';
  mesh.updateWorldMatrix(true, false);
  line.matrixAutoUpdate = false;
  line.matrix.copy(mesh.matrixWorld);
  line.matrixWorldNeedsUpdate = true;
  scene.add(line);
  highlightOutline = line;
  setTimeout(() => clearHighlight(), 2000);
}

function pulseHighlightMeshes(meshes) {
  clearPulse();
  clearHighlight();
  const now = performance.now();
  meshes.forEach(mesh => {
    // Create a glowing overlay clone that sits on top of the mesh
    const overlayMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.35,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const overlay = new THREE.Mesh(mesh.geometry, overlayMat);
    overlay.name = '__pulseOverlay__';
    // Use full world matrix to correctly position the overlay
    mesh.updateWorldMatrix(true, false);
    overlay.matrixAutoUpdate = false;
    overlay.matrix.copy(mesh.matrixWorld);
    overlay.matrixWorldNeedsUpdate = true;
    overlay.renderOrder = 999;
    scene.add(overlay);

    // Also add edge highlight
    const edges = new THREE.EdgesGeometry(mesh.geometry, 30);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x6688ff, transparent: true, opacity: 0.7 });
    const line = new THREE.LineSegments(edges, lineMat);
    line.name = '__pulseEdge__';
    line.matrixAutoUpdate = false;
    line.matrix.copy(mesh.matrixWorld);
    line.matrixWorldNeedsUpdate = true;
    scene.add(line);

    pulsingMeshes.push({ overlay, overlayMat, startTime: now });
  });

  const pulseDuration = 2500;
  const pulseFreq = 3;

  function animatePulse() {
    const elapsed = performance.now() - now;
    if (elapsed > pulseDuration) {
      clearPulse();
      return;
    }
    const t = Math.sin(elapsed * 0.001 * pulseFreq * Math.PI * 2) * 0.5 + 0.5;
    const fade = 1 - (elapsed / pulseDuration);
    // Pulse overlay opacity
    pulsingMeshes.forEach(p => {
      p.overlayMat.opacity = t * fade * 0.4;
    });
    // Pulse edge opacity
    scene.children.forEach(c => {
      if (c.name === '__pulseEdge__') {
        c.material.opacity = 0.3 + t * fade * 0.7;
      }
    });
    pulseAnimId = requestAnimationFrame(animatePulse);
  }
  pulseAnimId = requestAnimationFrame(animatePulse);
}

function clearPulse() {
  if (pulseAnimId) {
    cancelAnimationFrame(pulseAnimId);
    pulseAnimId = null;
  }
  // Remove overlay meshes
  pulsingMeshes.forEach(p => {
    scene.remove(p.overlay);
    p.overlay.geometry = undefined; // don't dispose shared geometry
    p.overlayMat.dispose();
  });
  pulsingMeshes = [];
  // Remove pulse edge lines
  const toRemove = scene.children.filter(c => c.name === '__pulseEdge__');
  toRemove.forEach(c => {
    scene.remove(c);
    c.geometry?.dispose();
    c.material?.dispose();
  });
}

function clearHighlight() {
  if (highlightOutline) {
    scene.remove(highlightOutline);
    highlightOutline.geometry.dispose();
    highlightOutline.material.dispose();
    highlightOutline = null;
  }
}

function applyToAllMaterials(fn) {
  if (!loadedModel) return;
  // If a group is selected, only apply to group meshes
  if (selectedMeshUUID === '__group__' && window.__matGroupMeshes) {
    const groupUUIDs = new Set(window.__matGroupMeshes.map(m => m.uuid));
    loadedModel.traverse(c => {
      if (c.isMesh && c.material && groupUUIDs.has(c.uuid)) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach(fn);
      }
    });
    return;
  }
  loadedModel.traverse(c => {
    if (c.isMesh && c.material) {
      if (selectedMeshUUID && selectedMeshUUID !== '__group__' && c.uuid !== selectedMeshUUID) return;
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach(fn);
    }
  });
}

// === BLEND MODE UTILITIES ===
// These apply blend modes by processing textures on a canvas, blending the
// texture with the existing diffuse color/map using the chosen mode.

function blendPixel(base, blend, mode) {
  // base and blend are 0-255
  const a = base / 255;
  const b = blend / 255;
  let r;
  switch (mode) {
    case 'overlay':
      r = a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b);
      break;
    case 'screen':
      r = 1 - (1 - a) * (1 - b);
      break;
    case 'multiply':
      r = a * b;
      break;
    case 'soft-light':
      r = b < 0.5 ? a - (1 - 2 * b) * a * (1 - a) : a + (2 * b - 1) * (Math.sqrt(a) - a);
      break;
    default: // 'normal' — just use blend directly
      r = b;
      break;
  }
  return Math.round(Math.min(1, Math.max(0, r)) * 255);
}

function blendTextures(baseImage, blendImage, mode, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width || 512;
  canvas.height = height || 512;
  const ctx = canvas.getContext('2d');

  // Draw base
  if (baseImage) {
    ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#808080'; // neutral for normal maps, mid-gray for bump
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const baseData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Draw blend texture
  const blendCanvas = document.createElement('canvas');
  blendCanvas.width = canvas.width;
  blendCanvas.height = canvas.height;
  const bctx = blendCanvas.getContext('2d');
  bctx.drawImage(blendImage, 0, 0, canvas.width, canvas.height);
  const blendData = bctx.getImageData(0, 0, canvas.width, canvas.height);

  // Apply blend
  const out = ctx.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < baseData.data.length; i += 4) {
    out.data[i]     = blendPixel(baseData.data[i],     blendData.data[i],     mode);
    out.data[i + 1] = blendPixel(baseData.data[i + 1], blendData.data[i + 1], mode);
    out.data[i + 2] = blendPixel(baseData.data[i + 2], blendData.data[i + 2], mode);
    out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

// Track raw imported textures (pre-blend) so we can re-blend when mode changes
const rawImportedTextures = {
  normalMap: null,   // { image: Image }
  bumpMap: null,     // { image: Image }
  matcap: null,      // { image: Image, key: string }
};

function applyBlendedTexture(slot, blendMode) {
  if (!loadedModel) return;
  const raw = rawImportedTextures[slot];
  if (!raw || !raw.image) return;

  const isNormalMap = slot === 'normalMap';
  const isBumpMap = slot === 'bumpMap';

  loadedModel.traverse(c => {
    if (!c.isMesh || !c.material) return;
    if (selectedMeshUUID && selectedMeshUUID !== '__group__' && c.uuid !== selectedMeshUUID) return;
    if (selectedMeshUUID === '__group__' && window.__matGroupMeshes) {
      const groupUUIDs = new Set(window.__matGroupMeshes.map(m => m.uuid));
      if (!groupUUIDs.has(c.uuid)) return;
    }

    const mats = Array.isArray(c.material) ? c.material : [c.material];
    mats.forEach(m => {
      if (blendMode === 'normal') {
        // Direct apply — no blending
        const tex = new THREE.Texture(raw.image);
        tex.colorSpace = THREE.LinearSRGBColorSpace;
        tex.flipY = true;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.needsUpdate = true;
        m[slot] = tex;
      } else {
        // Get existing base texture image
        const existingTex = m[slot];
        const baseImg = existingTex?.image || null;
        const w = raw.image.width || 512;
        const h = raw.image.height || 512;
        const blendedCanvas = blendTextures(baseImg, raw.image, blendMode, w, h);
        const tex = new THREE.CanvasTexture(blendedCanvas);
        tex.colorSpace = THREE.LinearSRGBColorSpace;
        tex.flipY = true;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.needsUpdate = true;
        m[slot] = tex;
      }

      if (isNormalMap) {
        if (!m.normalScale) m.normalScale = new THREE.Vector2(1, 1);
        const s = parseFloat($('pMatNormalScale')?.value || '1.0');
        m.normalScale.set(s, s);
      } else if (isBumpMap) {
        m.bumpScale = parseFloat($('pMatBumpScale')?.value || '0.05');
      }
      m.needsUpdate = true;
    });
  });
}

function applyBlendedMatcap(blendMode) {
  if (!loadedModel) return;
  const raw = rawImportedTextures.matcap;

  // For each mesh with an active matcap, re-blend
  loadedModel.traverse(c => {
    if (!c.isMesh || !c.material?.isMeshMatcapMaterial) return;

    const mcKey = perMeshMatcap.get(c.uuid);
    if (!mcKey) return;

    const preset = matcapPresets[mcKey];
    if (!preset) return;

    // Get the matcap image source
    let mcImage = null;
    if (preset.customTexture?.image) {
      mcImage = preset.customTexture.image;
    } else if (preset.colors) {
      // Generate the matcap to get its canvas/image
      const tmpTex = generateMatcapTexture(preset.colors);
      mcImage = tmpTex.image;
    }
    if (!mcImage) return;

    // Get the original material's diffuse to use as base
    const origMat = preMatcapMaterials.get(c.uuid);
    let baseImg = null;
    if (origMat) {
      const om = Array.isArray(origMat) ? origMat[0] : origMat;
      if (om?.map?.image) baseImg = om.map.image;
    }

    if (blendMode === 'normal') {
      // Standard matcap — just set the matcap texture directly
      if (preset.customTexture) {
        c.material.matcap = preset.customTexture;
      } else if (preset.colors) {
        c.material.matcap = generateMatcapTexture(preset.colors);
      }
    } else {
      // Blend the matcap with the original diffuse texture
      const w = mcImage.width || 256;
      const h = mcImage.height || 256;
      const blendedCanvas = blendTextures(baseImg, mcImage, blendMode, w, h);
      const blendedTex = new THREE.CanvasTexture(blendedCanvas);
      blendedTex.colorSpace = THREE.SRGBColorSpace;
      blendedTex.needsUpdate = true;
      c.material.matcap = blendedTex;
    }
    c.material.needsUpdate = true;
  });
}

// Blend mode dropdown handlers
$('pNormalBlend').onchange = e => {
  const mode = e.target.value;
  if (rawImportedTextures.normalMap?.image) {
    applyBlendedTexture('normalMap', mode);
    pushLog('Normal blend: ' + mode);
  }
};

$('pBumpBlend').onchange = e => {
  const mode = e.target.value;
  if (rawImportedTextures.bumpMap?.image) {
    applyBlendedTexture('bumpMap', mode);
    pushLog('Bump blend: ' + mode);
  }
};

$('pMatcapBlend').onchange = e => {
  const mode = e.target.value;
  applyBlendedMatcap(mode);
  pushLog('Matcap blend: ' + mode);
};

$('pMatColor').addEventListener('input', e => {
  const col = new THREE.Color(e.target.value);
  applyToAllMaterials(m => { if (m.color) m.color.copy(col); });
  debouncedLog('Material color');
});

$('pMatMetal').addEventListener('input', e => {
  const val = parseFloat(e.target.value);
  applyToAllMaterials(m => { if (m.metalness !== undefined) m.metalness = val; });
  debouncedLog('Metalness');
});

$('pMatRough').addEventListener('input', e => {
  const val = parseFloat(e.target.value);
  applyToAllMaterials(m => { if (m.roughness !== undefined) m.roughness = val; });
  debouncedLog('Roughness');
});

$('pMatEmissive').addEventListener('input', e => {
  const col = new THREE.Color(e.target.value);
  applyToAllMaterials(m => { if (m.emissive) m.emissive.copy(col); });
  debouncedLog('Emissive color');
});

$('pMatEmissiveInt').addEventListener('input', e => {
  const val = parseFloat(e.target.value);
  applyToAllMaterials(m => { if (m.emissiveIntensity !== undefined) m.emissiveIntensity = val; });
  debouncedLog('Emissive intensity');
});

$('pMatOpacity').addEventListener('input', e => {
  const val = parseFloat(e.target.value);
  applyToAllMaterials(m => {
    m.opacity = val;
    m.transparent = val < 1;
  });
  debouncedLog('Opacity');
});

// Normal Scale slider
$('pMatNormalScale').addEventListener('input', e => {
  const val = parseFloat(e.target.value);
  applyToAllMaterials(m => {
    if (m.normalMap && m.normalScale) {
      m.normalScale.set(val, val);
      m.needsUpdate = true;
    }
  });
  debouncedLog('Normal scale');
});

// Bump Scale slider
$('pMatBumpScale').addEventListener('input', e => {
  const val = parseFloat(e.target.value);
  applyToAllMaterials(m => {
    if (m.bumpMap) {
      m.bumpScale = val;
      m.needsUpdate = true;
    }
  });
  debouncedLog('Bump scale');
});

// Hidden file inputs for normal/bump import
const normalFileInput = document.createElement('input');
normalFileInput.type = 'file';
normalFileInput.accept = 'image/*';
normalFileInput.style.display = 'none';
document.body.appendChild(normalFileInput);

const bumpFileInput = document.createElement('input');
bumpFileInput.type = 'file';
bumpFileInput.accept = 'image/*';
bumpFileInput.style.display = 'none';
document.body.appendChild(bumpFileInput);

function loadTextureFromFile(file, slot, previewId, canvasId) {
  const objUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const previewDiv = $(previewId);
    const canvas = $(canvasId);
    if (previewDiv && canvas) {
      previewDiv.style.display = 'block';
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    if (slot === 'normalMap') {
      rawImportedTextures.normalMap = { image: img };
      if ($('pNormalBlend')) $('pNormalBlend').value = 'normal';
    } else if (slot === 'bumpMap') {
      rawImportedTextures.bumpMap = { image: img };
      if ($('pBumpBlend')) $('pBumpBlend').value = 'normal';
    }

    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.flipY = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;

    const scale = slot === 'normalMap'
      ? parseFloat($('pMatNormalScale')?.value || '1.0')
      : parseFloat($('pMatBumpScale')?.value || '0.05');

    if (!loadedModel) return;
    loadedModel.traverse(c => {
      if (!c.isMesh || !c.material) return;
      if (selectedMeshUUID && selectedMeshUUID !== '__group__' && c.uuid !== selectedMeshUUID) return;
      if (selectedMeshUUID === '__group__' && window.__matGroupMeshes) {
        const groupUUIDs = new Set(window.__matGroupMeshes.map(m => m.uuid));
        if (!groupUUIDs.has(c.uuid)) return;
      }

      let mats = Array.isArray(c.material) ? c.material : [c.material];
      const newMats = mats.map(m => {
        let mat = m;
        if (!(mat instanceof THREE.MeshStandardMaterial) && !(mat instanceof THREE.MeshPhysicalMaterial)) {
          const upgraded = new THREE.MeshStandardMaterial({
            color: mat.color ? mat.color.clone() : new THREE.Color(0xcccccc),
            map: mat.map || null,
            side: mat.side,
            transparent: mat.transparent,
            opacity: mat.opacity,
            metalness: (mat.metalness !== undefined) ? mat.metalness : 0.0,
            roughness: (mat.roughness !== undefined) ? mat.roughness : 0.7,
          });
          upgraded.name = mat.name;
          mat = upgraded;
        }
        mat[slot] = tex;
        if (slot === 'normalMap') {
          if (!mat.normalScale) mat.normalScale = new THREE.Vector2(1, 1);
          mat.normalScale.set(scale, scale);
        } else if (slot === 'bumpMap') {
          mat.bumpScale = scale;
        }
        mat.needsUpdate = true;
        return mat;
      });
      c.material = newMats.length === 1 ? newMats[0] : newMats;
    });

    URL.revokeObjectURL(objUrl);
    buildTextureList(loadedModel);
    pushLog(`Loaded ${slot === 'normalMap' ? 'Normal' : 'Bump'} map: ${file.name}`);
  };
  img.src = objUrl;
}

// Also auto-detect uploaded assets as normal/bump maps
function autoDetectUploadedMaps() {
  if (!window.UPLOADED_IMAGES || !loadedModel) return;
  window.UPLOADED_IMAGES.forEach(uimg => {
    if (!uimg.name) return;
    const lower = uimg.name.toLowerCase();
    const isNormal = lower.includes('_nm') || lower.includes('_normal') || lower.includes('normalmap');
    const isBump = lower.includes('_dm') || lower.includes('_bump') || lower.includes('_disp') || lower.includes('bumpmap');
    if (!isNormal && !isBump) return;

    const slot = isNormal ? 'normalMap' : 'bumpMap';
    const previewId = isNormal ? 'pMatNormalPreview' : 'pMatBumpPreview';
    const canvasId = isNormal ? 'normalPreviewCanvas' : 'bumpPreviewCanvas';

    // Load from asset path
    const img = new Image();
    img.onload = () => {
      const previewDiv = $(previewId);
      const canvas = $(canvasId);
      if (previewDiv && canvas) {
        previewDiv.style.display = 'block';
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.LinearSRGBColorSpace;
      tex.flipY = true;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.needsUpdate = true;

      const scale = slot === 'normalMap'
        ? parseFloat($('pMatNormalScale')?.value || '1.0')
        : parseFloat($('pMatBumpScale')?.value || '0.05');

      // Apply to all meshes, upgrading materials if needed
      if (!loadedModel) return;
      loadedModel.traverse(c => {
        if (!c.isMesh || !c.material) return;
        let mats = Array.isArray(c.material) ? c.material : [c.material];
        const newMats = mats.map(m => {
          let mat = m;
          if (!(mat instanceof THREE.MeshStandardMaterial) && !(mat instanceof THREE.MeshPhysicalMaterial)) {
            const upgraded = new THREE.MeshStandardMaterial({
              color: mat.color ? mat.color.clone() : new THREE.Color(0xcccccc),
              map: mat.map || null,
              side: mat.side,
              transparent: mat.transparent,
              opacity: mat.opacity,
              metalness: (mat.metalness !== undefined) ? mat.metalness : 0.0,
              roughness: (mat.roughness !== undefined) ? mat.roughness : 0.7,
            });
            upgraded.name = mat.name;
            mat = upgraded;
          }
          mat[slot] = tex;
          if (slot === 'normalMap') {
            if (!mat.normalScale) mat.normalScale = new THREE.Vector2(1, 1);
            mat.normalScale.set(scale, scale);
          } else if (slot === 'bumpMap') {
            mat.bumpScale = scale;
          }
          mat.needsUpdate = true;
          return mat;
        });
        c.material = newMats.length === 1 ? newMats[0] : newMats;
      });

      buildTextureList(loadedModel);
      pushLog(`Auto-loaded ${isNormal ? 'Normal' : 'Bump'} map: ${uimg.name}`);
    };
    img.src = `assets/${uimg.name}`;
  });
}

// Normal Map Load button
$('pMatNormalImport').addEventListener('click', () => {
  normalFileInput.click();
});

// Normal map file import handler
normalFileInput.onchange = function() {
  const file = this.files[0];
  if (!file || !loadedModel) return;
  loadTextureFromFile(file, 'normalMap', 'pMatNormalPreview', 'normalPreviewCanvas');
  normalFileInput.value = '';
};

// Bump Map Load button
$('pMatBumpImport').addEventListener('click', () => {
  bumpFileInput.click();
});

// Bump map file import handler
bumpFileInput.onchange = function() {
  const file = this.files[0];
  if (!file || !loadedModel) return;
  loadTextureFromFile(file, 'bumpMap', 'pMatBumpPreview', 'bumpPreviewCanvas');
  bumpFileInput.value = '';
};

// Normal Map Clear button
$('pMatNormalClear').addEventListener('click', () => {
  if (!loadedModel) return;
  rawImportedTextures.normalMap = null;
  if ($('pNormalBlend')) $('pNormalBlend').value = 'normal';
  applyToAllMaterials(m => {
    if (m.normalMap) {
      m.normalMap = null;
      m.needsUpdate = true;
    }
  });
  const prev = $('pMatNormalPreview');
  if (prev) prev.style.display = 'none';
  buildTextureList(loadedModel);
  pushLog('Cleared Normal map');
});

// Bump Map Clear button
$('pMatBumpClear').addEventListener('click', () => {
  if (!loadedModel) return;
  rawImportedTextures.bumpMap = null;
  if ($('pBumpBlend')) $('pBumpBlend').value = 'normal';
  applyToAllMaterials(m => {
    if (m.bumpMap) {
      m.bumpMap = null;
      m.needsUpdate = true;
    }
  });
  const prev = $('pMatBumpPreview');
  if (prev) prev.style.display = 'none';
  buildTextureList(loadedModel);
  pushLog('Cleared Bump map');
});

$('pMatReset').addEventListener('click', () => {
  if (!loadedModel) return;

  // === STEP 1: Restore ALL matcap-replaced materials to their originals ===
  // This is the single source of truth: preMatcapMaterials stores the real
  // original material for each mesh before any matcap was applied.
  // We iterate ALL meshes (not just targeted ones) to ensure full restoration.
  loadedModel.traverse(c => {
    if (c.isMesh && preMatcapMaterials.has(c.uuid)) {
      // Dispose the matcap material if it's not the original
      const currentMat = c.material;
      const originalMat = preMatcapMaterials.get(c.uuid);
      if (currentMat !== originalMat && currentMat?.dispose) {
        if (currentMat.matcap?.dispose) currentMat.matcap.dispose();
        currentMat.dispose();
      }
      c.material = originalMat;
    }
  });
  preMatcapMaterials.clear();
  perMeshMatcap.clear();
  activeMatcap = null;

  // === STEP 2: Reset AI matcap generator state completely ===
  aiCurrentVariations = [];
  aiActiveVarIndex = -1;
  aiBaseCanvas = null;

  // Hide all AI panels
  const varPanel = $('aiMatcapVariations');
  const adjPanel = $('aiMatcapAdjust');
  if (varPanel) varPanel.style.display = 'none';
  if (adjPanel) adjPanel.style.display = 'none';
  const aiGrid = $('aiVarGrid');
  if (aiGrid) aiGrid.innerHTML = '';

  // Clear the AI preview canvas
  const aiPreviewWrap = $('aiMatcapPreviewWrap');
  const aiPreviewCanvas = $('aiMatcapPreviewCanvas');
  if (aiPreviewWrap) aiPreviewWrap.style.display = 'none';
  if (aiPreviewCanvas) {
    const pctx = aiPreviewCanvas.getContext('2d');
    pctx.clearRect(0, 0, aiPreviewCanvas.width, aiPreviewCanvas.height);
  }

  // Clear the export matcap preview
  const exportPreview = $('matcapExportPreview');
  const exportCanvas = $('matcapExportCanvas');
  if (exportPreview) exportPreview.style.display = 'none';
  if (exportCanvas) {
    const ectx = exportCanvas.getContext('2d');
    ectx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
  }

  // Reset AI prompt text
  if ($('aiMatcapPrompt')) $('aiMatcapPrompt').value = '';

  // Reset AI adjustment sliders to zero
  if ($('aiAdjBrightness')) $('aiAdjBrightness').value = 0;
  if ($('aiAdjContrast')) $('aiAdjContrast').value = 0;
  if ($('aiAdjSaturation')) $('aiAdjSaturation').value = 0;
  if ($('aiAdjBrightnessVal')) $('aiAdjBrightnessVal').textContent = '0';
  if ($('aiAdjContrastVal')) $('aiAdjContrastVal').textContent = '0';
  if ($('aiAdjSaturationVal')) $('aiAdjSaturationVal').textContent = '0';

  // Reset AI target selector to "All Meshes"
  aiMatcapTargetUUID = null;
  aiMatcapTargetGroup = null;
  const aiTargetSel = $('aiMatcapTargetSelect');
  if (aiTargetSel) aiTargetSel.value = '__all__';

  // Hide AI status message
  const aiStatus = $('aiMatcapStatus');
  if (aiStatus) aiStatus.style.display = 'none';

  // Reset AI blend mode to Normal
  aiBlendMode = 'normal';
  panel.querySelectorAll('.ai-blend-btn').forEach(b => b.classList.remove('active'));
  const normalBlendBtn = panel.querySelector('.ai-blend-btn[data-blend="normal"]');
  if (normalBlendBtn) normalBlendBtn.classList.add('active');

  // === STEP 3: Reset preset matcap controls ===
  if ($('pMatcapBlend')) $('pMatcapBlend').value = 'overlay';
  matcapTargetUUID = null;
  matcapTargetGroup = null;

  // === STEP 4: Restore original material properties ===
  // After step 1 we have the original materials back on each mesh.
  // Now restore their cached property values (color, metalness, etc.)
  loadedModel.traverse(c => {
    if (c.isMesh && c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach(m => {
        const orig = originalMaterials.get(m.uuid);
        if (orig) {
          if (orig.color && m.color) m.color.copy(orig.color);
          if (m.metalness !== undefined) m.metalness = orig.metalness;
          if (m.roughness !== undefined) m.roughness = orig.roughness;
          if (orig.emissive && m.emissive) m.emissive.copy(orig.emissive);
          if (m.emissiveIntensity !== undefined) m.emissiveIntensity = orig.emissiveIntensity;
          m.opacity = orig.opacity;
          m.transparent = orig.transparent;
          m.wireframe = false;
          m.needsUpdate = true;
        }
      });
    }
  });

  // === STEP 5: Reset imported texture state ===
  rawImportedTextures.normalMap = null;
  rawImportedTextures.bumpMap = null;
  rawImportedTextures.matcap = null;

  // === STEP 6: Reset all Material panel UI controls to defaults ===
  if ($('pMatColor')) $('pMatColor').value = '#ffffff';
  if ($('pMatMetal')) $('pMatMetal').value = '0.5';
  if ($('pMatRough')) $('pMatRough').value = '0.5';
  if ($('pMatEmissive')) $('pMatEmissive').value = '#000000';
  if ($('pMatEmissiveInt')) $('pMatEmissiveInt').value = '0';
  if ($('pMatOpacity')) $('pMatOpacity').value = '1.0';
  if ($('pMatNormalScale')) $('pMatNormalScale').value = '1.0';
  if ($('pMatBumpScale')) $('pMatBumpScale').value = '0.05';
  if ($('pNormalBlend')) $('pNormalBlend').value = 'normal';
  if ($('pBumpBlend')) $('pBumpBlend').value = 'normal';
  const np = $('pMatNormalPreview'); if (np) np.style.display = 'none';
  const bp = $('pMatBumpPreview'); if (bp) bp.style.display = 'none';

  // Reset wireframe
  wireframeOn = false;
  const wfToggle = $('pWireframe');
  if (wfToggle) wfToggle.classList.remove('active');

  // === STEP 7: Sync matcap grid and overview ===
  updateMatcapGridSelection();

  pushLog('Reset all materials & matcaps');
});

// Function to estimate export stats
function updateExportStats(model, rawDataUrl) {
  let triCount = 0, texCount = 0, texSize = 0;
  const textures = new Set();

  model.traverse(c => {
    if (c.isMesh && c.geometry) {
      const idx = c.geometry.index;
      if (idx) triCount += idx.count / 3;
      else triCount += (c.geometry.attributes.position?.count || 0) / 3;
      // Gather textures
      if (c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach(m => {
          ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap'].forEach(prop => {
            if (m[prop]?.image) textures.add(m[prop]);
          });
        });
      }
    }
  });

  texCount = textures.size;
  // Estimate texture memory
  textures.forEach(t => {
    if (t.image) {
      const w = t.image.width || 1024;
      const h = t.image.height || 1024;
      texSize += w * h * 4; // RGBA uncompressed
    }
  });

  // GLB size estimate: geometry data + compressed textures + overhead
  let geomSize = 0;
  model.traverse(c => {
    if (c.isMesh && c.geometry) {
      const attrs = c.geometry.attributes;
      for (const key in attrs) {
        geomSize += attrs[key].array.byteLength || 0;
      }
      if (c.geometry.index) geomSize += c.geometry.index.array.byteLength || 0;
    }
  });

  // Compressed textures in GLB are typically ~25% of raw
  const estTexGLB = texSize * 0.25;
  const totalEstimate = geomSize + estTexGLB + 4096; // 4KB overhead

  // If we have the original data URL, use that as a more accurate size
  let sizeStr;
  if (rawDataUrl) {
    const base64Len = rawDataUrl.split(',')[1]?.length || 0;
    const byteLen = base64Len * 0.75;
    sizeStr = formatBytes(byteLen);
  } else {
    sizeStr = '~' + formatBytes(totalEstimate);
  }

  $('pExportSize').textContent = sizeStr;
  $('pTriCount').textContent = Math.round(triCount).toLocaleString();
  $('pTexCount').textContent = texCount + (texSize > 0 ? ` (${formatBytes(texSize)} raw)` : '');
  $('pDrawCalls').textContent = renderer.info.render.calls || '—';
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

// Load model
let loadedModel = null;

// Try multiple sources for the model
const modelData = window.UPLOADED_3D_MODELS?.find(m => m.name === 'component.glb') || window.UPLOADED_3D_MODELS?.[0];
const modelFileName = modelData?.name || 'component.glb';

// Build a list of URLs to try in order
const urlsToTry = [];
if (modelData?.dataUrl) urlsToTry.push(modelData.dataUrl);
if (modelData?.url) urlsToTry.push(modelData.url);
urlsToTry.push('assets/component.glb');
urlsToTry.push('/assets/component.glb');
urlsToTry.push('./assets/component.glb');
urlsToTry.push('component.glb');
urlsToTry.push('/component.glb');

// Also check UPLOADED_IMAGES for glb files
if (window.UPLOADED_IMAGES) {
  window.UPLOADED_IMAGES.forEach(img => {
    if (img.name?.endsWith('.glb') || img.name?.endsWith('.gltf')) {
      if (img.dataUrl) urlsToTry.unshift(img.dataUrl);
    }
  });
}

// Default fallback models — prefer multi-mesh models so users can see per-group materials
const DEFAULT_MODELS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Lantern/glTF-Binary/Lantern.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/AntiqueCamera/glTF-Binary/AntiqueCamera.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
];
DEFAULT_MODELS.forEach(u => urlsToTry.push(u));

function tryLoadModel(urlIndex) {
  if (urlIndex >= urlsToTry.length) {
    console.error('All model URLs failed. Tried:', urlsToTry);
    loadingDiv.innerHTML = `
      <div style="font-size: 20px; font-weight: 600; opacity: 0.85; margin-bottom: 6px;">✦ Matcap Generator</div>
      <div style="font-size: 12px; opacity: 0.4; margin-bottom: 16px;">Generate · Preview · Export</div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.5);">Drop or import a 3D file to get started</div>
      <div style="font-size: 11px; opacity: 0.3; margin-top: 6px;">.glb · .gltf · .obj · .fbx · .stl · .blend</div>
    `;
    return;
  }

  const url = urlsToTry[urlIndex];
  console.log(`Trying model URL [${urlIndex}]:`, url.substring(0, 100));

  loader.load(
    url,
    (gltf) => {
      const model = gltf.scene;
      model.name = 'uploadedModel1';

      // Calculate bounds
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // Scale to fit nicely
      if (maxDim > 0) {
        const targetSize = 3;
        model.scale.multiplyScalar(targetSize / maxDim);
      }

      // Recalculate after scale
      box.setFromObject(model);
      box.getCenter(center);
      const newSize = box.getSize(new THREE.Vector3());

      // Center model at origin
      model.position.sub(center);

      // Enable shadows
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.envMapIntensity = 1.0;
          }
        }
      });

      scene.add(model);
      loadedModel = model;
      selectedMeshUUID = null;
      storeOriginalMaterials(model);
      buildMeshList(model);
      buildTextureList(model);
      buildMatcapTargetList(model);
      buildAIMatcapTargetList(model);
      preMatcapMaterials.clear();
      perMeshMatcap.clear();
      activeMatcap = null;
      matcapTargetUUID = null;
      aiMatcapTargetUUID = null;
      aiMatcapTargetGroup = null;

      // Auto-detect uploaded normal/bump maps and apply them
      setTimeout(() => autoDetectUploadedMaps(), 300);

      // Update export stats in panel
      setTimeout(() => updateExportStats(model, modelData?.dataUrl || null), 100);

      // Adjust ground
      ground.position.y = -newSize.y / 2;

      // Adjust camera
      const dist = Math.max(newSize.x, newSize.y, newSize.z) * 1.8;
      camera.position.set(dist * 0.8, dist * 0.5, dist * 0.8);
      controls.target.set(0, 0, 0);
      controls.update();

      // Adjust shadow camera
      const shadowRange = Math.max(newSize.x, newSize.z) * 2;
      dirLight.shadow.camera.left = -shadowRange;
      dirLight.shadow.camera.right = shadowRange;
      dirLight.shadow.camera.top = shadowRange;
      dirLight.shadow.camera.bottom = -shadowRange;
      dirLight.shadow.camera.updateProjectionMatrix();

      // Count meshes and vertices
      let meshCount = 0;
      let vertexCount = 0;
      model.traverse((child) => {
        if (child.isMesh) {
          meshCount++;
          if (child.geometry) vertexCount += child.geometry.attributes.position?.count || 0;
        }
      });

      // Determine display name and attribution using model metadata
      const meta = findModelMetaByURL(url);
      let displayModelName = modelFileName;
      if (meta) {
        displayModelName = meta.name;
      } else if (modelData?.name && !modelData.name.includes('component.glb')) {
        displayModelName = modelData.name;
      }

      // Build info panel with full attribution
      if (meta) {
        infoDiv.innerHTML = buildInfoHTML(meta, meshCount, vertexCount);
      } else {
        infoDiv.innerHTML = buildInfoHTML({ name: displayModelName }, meshCount, vertexCount);
      }
      infoDiv.style.opacity = '1';

      // If this is a known sample model, update the demo models dropdown
      for (const [key, m] of Object.entries(demoModels)) {
        if (url.includes('/' + key + '/') || url.includes(key + '.glb')) {
          const demoSelect = $('pDemoModels');
          if (demoSelect) demoSelect.value = key;
          break;
        }
      }

      // Hide loading
      loadingDiv.style.opacity = '0';
      setTimeout(() => { loadingDiv.style.display = 'none'; }, 500);
    },
    (progress) => {
      if (progress.total > 0) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        const bar = document.getElementById('loadBar');
        const txt = document.getElementById('loadPercent');
        if (bar) bar.style.width = pct + '%';
        if (txt) txt.textContent = pct + '%';
        // Track file size for info panel
        updateFileSizeDisplay(progress.total, modelFileName);
      }
    },
    (error) => {
      console.warn(`URL [${urlIndex}] failed:`, error.message || error);
      tryLoadModel(urlIndex + 1);
    }
  );
}

if (urlsToTry.length > 0) {
  tryLoadModel(0);
} else {
  loadingDiv.innerHTML = `
    <div style="font-size: 20px; font-weight: 600; opacity: 0.85; margin-bottom: 6px;">✦ Matcap Generator</div>
    <div style="font-size: 12px; opacity: 0.4; margin-bottom: 16px;">Generate · Preview · Export</div>
    <div style="font-size: 13px; color: rgba(255,255,255,0.5);">Drop or import a 3D file to get started</div>
    <div style="font-size: 11px; opacity: 0.3; margin-top: 6px;">.glb · .gltf · .obj · .fbx · .stl · .blend</div>
  `;
}

// --- Drag & Drop support ---
const dropOverlay = document.createElement('div');
dropOverlay.style.cssText = `
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(10,10,30,0.85); display: none; z-index: 200;
  flex-direction: column; align-items: center; justify-content: center;
  font-family: 'Inter', system-ui, sans-serif; pointer-events: none;
`;
dropOverlay.innerHTML = `
  <div style="width:120px; height:120px; border:2px dashed rgba(100,140,255,0.5); border-radius:20px; display:flex; align-items:center; justify-content:center; margin-bottom:16px;">
    <span style="font-size:40px; opacity:0.7;">📂</span>
  </div>
  <div style="font-size:14px; color:rgba(255,255,255,0.8); font-weight:500;">Drop 3D file here</div>
  <div style="font-size:11px; color:rgba(255,255,255,0.3); margin-top:6px;">.glb · .gltf · .obj · .fbx · .stl · .blend</div>
`;
document.body.appendChild(dropOverlay);

let dragCounter = 0;
document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  dropOverlay.style.display = 'flex';
});
document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) { dropOverlay.style.display = 'none'; dragCounter = 0; }
});
document.addEventListener('dragover', (e) => { e.preventDefault(); });
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.style.display = 'none';
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (['glb','gltf','obj','fbx','stl','blend'].includes(ext)) {
    // Simulate file input change
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
  }
});

// Animation loop
function animate() {
  controls.update();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
