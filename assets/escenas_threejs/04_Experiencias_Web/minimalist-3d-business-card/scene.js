import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

// ---- SCENE SETUP ----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.FogExp2(0x1a1a2e, 0.04);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.2;
const root = document.getElementById('root') ?? document.body;
root.appendChild(renderer.domElement);

// ---- PROCEDURAL ENVIRONMENT MAP ----
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
const envScene = new THREE.Scene();
const envGeo = new THREE.SphereGeometry(10, 32, 32);
const envCanvas = document.createElement('canvas');
envCanvas.width = 512;
envCanvas.height = 512;
const envCtx = envCanvas.getContext('2d');
const gradient = envCtx.createLinearGradient(0, 0, 0, 512);
gradient.addColorStop(0, '#2a2a4a');
gradient.addColorStop(0.3, '#3a3548');
gradient.addColorStop(0.5, '#4a4040');
gradient.addColorStop(0.7, '#3a3548');
gradient.addColorStop(1, '#1a1a2e');
envCtx.fillStyle = gradient;
envCtx.fillRect(0, 0, 512, 512);
envCtx.globalAlpha = 0.15;
envCtx.fillStyle = '#c9a84c';
envCtx.beginPath(); envCtx.arc(380, 120, 80, 0, Math.PI * 2); envCtx.fill();
envCtx.fillStyle = '#6688cc';
envCtx.beginPath(); envCtx.arc(130, 350, 100, 0, Math.PI * 2); envCtx.fill();
envCtx.globalAlpha = 1.0;
const envTexture = new THREE.CanvasTexture(envCanvas);
envTexture.mapping = THREE.EquirectangularReflectionMapping;
const envMat = new THREE.MeshBasicMaterial({ map: envTexture, side: THREE.BackSide });
envScene.add(new THREE.Mesh(envGeo, envMat));
const envRT = pmremGenerator.fromScene(envScene, 0.04);
scene.environment = envRT.texture;
pmremGenerator.dispose();
envScene.clear();

// ---- POST PROCESSING ----
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.8, 0.85));
composer.addPass(new SMAAPass(window.innerWidth, window.innerHeight));

// ---- CONTROLS ----
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI * 0.75;
controls.minPolarAngle = Math.PI * 0.2;
controls.minDistance = 3;
controls.maxDistance = 10;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.4;

// ---- LIGHTING ----
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
ambientLight.name = 'ambientLight'; scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xfff5e6, 5.5);
keyLight.name = 'keyLight';
keyLight.position.set(4, 6, 3);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5; keyLight.shadow.camera.far = 20;
keyLight.shadow.camera.left = -5; keyLight.shadow.camera.right = 5;
keyLight.shadow.camera.top = 5; keyLight.shadow.camera.bottom = -5;
keyLight.shadow.bias = -0.0005; keyLight.shadow.normalBias = 0.02;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xc8d8ff, 3.5);
rimLight.name = 'rimLight'; rimLight.position.set(-3, 3, -4); scene.add(rimLight);

const fillLight = new THREE.PointLight(0xffeedd, 2.5, 20);
fillLight.name = 'fillLight'; fillLight.position.set(-2, 1, 4); scene.add(fillLight);

const underLight = new THREE.PointLight(0x556677, 1.5, 12);
underLight.name = 'underLight'; underLight.position.set(0, -2, 2); scene.add(underLight);

const spotLight = new THREE.SpotLight(0xfff8f0, 6.0, 15, Math.PI * 0.25, 0.6, 1.2);
spotLight.name = 'museumSpotlight'; spotLight.position.set(0, 5, 0.5);
spotLight.target.position.set(0, 0, 0);
spotLight.castShadow = true; spotLight.shadow.mapSize.set(1024, 1024);
spotLight.shadow.bias = -0.0005; spotLight.shadow.normalBias = 0.02;
scene.add(spotLight); scene.add(spotLight.target);

// ---- MATERIALS ----
const cardMaterial = new THREE.MeshStandardMaterial({
  color: 0x8a8a9a, roughness: 0.35, metalness: 0.75, bumpScale: 0.002, envMapIntensity: 1.2,
});
cardMaterial.bumpMap = generateBumpTexture('smooth');

const embossMaterial = new THREE.MeshStandardMaterial({ color: 0xb0b0c0, roughness: 0.25, metalness: 0.85 });

const goldMaterial = new THREE.MeshStandardMaterial({
  color: 0xc9a84c, roughness: 0.3, metalness: 0.85, emissive: 0x1a1200, emissiveIntensity: 0.2,
});

const titleMaterial = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.4, metalness: 0.6 });
const contactMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.45, metalness: 0.5 });

// ---- CARD TEXTURE GENERATOR ----
function generateBumpTexture(type) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  const id = ctx.createImageData(512, 512);

  if (type === 'smooth') {
    // Subtle fine noise
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 120 + Math.random() * 16;
      id.data[i] = v; id.data[i+1] = v; id.data[i+2] = v; id.data[i+3] = 255;
    }
  } else if (type === 'brushed') {
    // Horizontal directional lines
    for (let y = 0; y < 512; y++) {
      const base = 120 + Math.random() * 8;
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        const v = base + Math.random() * 6 + Math.sin(x * 0.5) * 3;
        id.data[idx] = v; id.data[idx+1] = v; id.data[idx+2] = v; id.data[idx+3] = 255;
      }
    }
  } else if (type === 'linen') {
    // Cross-hatch pattern
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        const hatch = ((x + y) % 4 < 2 ? 8 : 0) + ((x - y + 512) % 6 < 3 ? 6 : 0);
        const v = 118 + Math.random() * 10 + hatch;
        id.data[idx] = v; id.data[idx+1] = v; id.data[idx+2] = v; id.data[idx+3] = 255;
      }
    }
  } else if (type === 'carbon') {
    // Diagonal weave pattern
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        const px = (x % 8 < 4) ? 1 : 0;
        const py = (y % 8 < 4) ? 1 : 0;
        const weave = (px ^ py) ? 135 : 115;
        const v = weave + Math.random() * 6;
        id.data[idx] = v; id.data[idx+1] = v; id.data[idx+2] = v; id.data[idx+3] = 255;
      }
    }
  } else if (type === 'leather') {
    // Organic bumpy texture
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        const n1 = Math.sin(x * 0.08) * Math.cos(y * 0.08) * 12;
        const n2 = Math.sin(x * 0.23 + 1.5) * Math.sin(y * 0.19 + 0.7) * 8;
        const n3 = Math.random() * 10;
        const v = 120 + n1 + n2 + n3;
        id.data[idx] = v; id.data[idx+1] = v; id.data[idx+2] = v; id.data[idx+3] = 255;
      }
    }
  }

  ctx.putImageData(id, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(type === 'leather' ? 2 : 4, type === 'leather' ? 2 : 4);
  return tex;
}

const bumpScales = { smooth: 0.002, brushed: 0.004, linen: 0.005, carbon: 0.006, leather: 0.008 };

// ---- BACKGROUND SYSTEM ----
let bgCanvasTexture = null;
let bgMesh = null;

function createBgCanvas(colors, angleDeg) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  const rad = (angleDeg || 180) * Math.PI / 180;
  const cx = 512, cy = 512, len = 724;
  const x0 = cx - Math.sin(rad) * len, y0 = cy - Math.cos(rad) * len;
  const x1 = cx + Math.sin(rad) * len, y1 = cy + Math.cos(rad) * len;
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  if (colors.length === 2) {
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[1]);
  } else {
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.5, colors[1]);
    grad.addColorStop(1, colors[2]);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);
  return c;
}

const bgPresets = {
  void:    { colors: ['#1a1a2e','#12121e','#1a1a2e'], fog: 0x1a1a2e, fogDensity: 0.04 },
  clouds:  { colors: ['#3a3a5c','#5a5a7a','#4a4a6a'], fog: 0x4a4a6a, fogDensity: 0.02, particles: true },
  studio:  { colors: ['#2a2a2a','#3a3a3a','#1a1a1a'], fog: 0x2a2a2a, fogDensity: 0.01 },
  sunset:  { colors: ['#1a0a20','#4a1530','#8a4010'], fog: 0x2a1020, fogDensity: 0.03 },
  ocean:   { colors: ['#040818','#0a1828','#061020'], fog: 0x060e1c, fogDensity: 0.04 },
  forest:  { colors: ['#0a1a0a','#102810','#081808'], fog: 0x0c180c, fogDensity: 0.05 },
};

function buildBgSphere(canvas) {
  if (bgMesh) {
    scene.remove(bgMesh);
    bgMesh.geometry.dispose();
    bgMesh.material.dispose();
    bgCanvasTexture?.dispose();
  }
  bgCanvasTexture = new THREE.CanvasTexture(canvas);
  bgCanvasTexture.mapping = THREE.EquirectangularReflectionMapping;
  const geo = new THREE.SphereGeometry(40, 32, 32);
  const mat = new THREE.MeshBasicMaterial({ map: bgCanvasTexture, side: THREE.BackSide, depthWrite: false });
  bgMesh = new THREE.Mesh(geo, mat);
  bgMesh.name = 'backgroundSphere';
  bgMesh.renderOrder = -1;
  scene.add(bgMesh);
}

function applyBackground(preset) {
  if (preset === 'solid') {
    const c = document.getElementById('bg-solid-color').value;
    const canvas = createBgCanvas([c, c], 180);
    buildBgSphere(canvas);
    scene.background = null;
    scene.fog = new THREE.FogExp2(new THREE.Color(c).getHex(), 0.03);
  } else if (preset === 'gradient') {
    const top = document.getElementById('bg-grad-top').value;
    const mid = document.getElementById('bg-grad-mid').value;
    const bot = document.getElementById('bg-grad-bottom').value;
    const angle = parseFloat(document.getElementById('bg-grad-angle').value) || 180;
    const canvas = createBgCanvas([top, mid, bot], angle);
    buildBgSphere(canvas);
    scene.background = null;
    scene.fog = new THREE.FogExp2(new THREE.Color(mid).getHex(), 0.03);
  } else if (preset === 'clouds') {
    // Clouds: paint soft cloudy blobs on gradient
    const canvas = createBgCanvas(bgPresets.clouds.colors, 180);
    const ctx = canvas.getContext('2d');
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const r = 60 + Math.random() * 200;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(200,200,220,0.6)');
      rg.addColorStop(1, 'rgba(200,200,220,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    buildBgSphere(canvas);
    scene.background = null;
    scene.fog = new THREE.FogExp2(bgPresets.clouds.fog, bgPresets.clouds.fogDensity);
  } else {
    const p = bgPresets[preset] || bgPresets.void;
    const canvas = createBgCanvas(p.colors, 180);
    // Add subtle noise/stars for depth
    const ctx = canvas.getContext('2d');
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const sz = 1 + Math.random() * 2;
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random()*0.3})`;
      ctx.fillRect(x, y, sz, sz);
    }
    if (preset === 'sunset') {
      ctx.globalAlpha = 0.08;
      const sg = ctx.createRadialGradient(512, 700, 50, 512, 700, 500);
      sg.addColorStop(0, '#ff8830');
      sg.addColorStop(1, 'transparent');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, 1024, 1024);
    }
    if (preset === 'ocean') {
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < 30; i++) {
        ctx.strokeStyle = `rgba(50,120,200,${0.1 + Math.random()*0.15})`;
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        const y = Math.random() * 1024;
        ctx.moveTo(0, y);
        for (let x = 0; x < 1024; x += 40) {
          ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 20);
        }
        ctx.stroke();
      }
    }
    if (preset === 'forest') {
      ctx.globalAlpha = 0.06;
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * 1024;
        const y = 300 + Math.random() * 700;
        const h = 40 + Math.random() * 120;
        ctx.fillStyle = `rgba(20,80,20,${0.3 + Math.random()*0.3})`;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x - 10 - Math.random()*15, y + h);
        ctx.lineTo(x + 10 + Math.random()*15, y + h); ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    buildBgSphere(canvas);
    scene.background = null;
    scene.fog = new THREE.FogExp2(p.fog, p.fogDensity);
  }
}

// ---- CARD BODY ----
const cardW = 3.5, cardH = 2.0, cardD = 0.04;
const r = 0.06;
const cardShape = new THREE.Shape();
cardShape.moveTo(-cardW/2+r, -cardH/2);
cardShape.lineTo(cardW/2-r, -cardH/2);
cardShape.quadraticCurveTo(cardW/2, -cardH/2, cardW/2, -cardH/2+r);
cardShape.lineTo(cardW/2, cardH/2-r);
cardShape.quadraticCurveTo(cardW/2, cardH/2, cardW/2-r, cardH/2);
cardShape.lineTo(-cardW/2+r, cardH/2);
cardShape.quadraticCurveTo(-cardW/2, cardH/2, -cardW/2, cardH/2-r);
cardShape.lineTo(-cardW/2, -cardH/2+r);
cardShape.quadraticCurveTo(-cardW/2, -cardH/2, -cardW/2+r, -cardH/2);

const cardExtrudeGeo = new THREE.ExtrudeGeometry(cardShape, { depth: cardD, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 3 });
cardExtrudeGeo.center();

const card = new THREE.Mesh(cardExtrudeGeo, cardMaterial);
card.name = 'businessCard';
card.castShadow = true; card.receiveShadow = true;
card.rotation.x = -0.1;
scene.add(card);

// Apply initial background
applyBackground('void');

// ---- GEOMETRIC LOGO (default) ----
const logoEmbossHeight = 0.012;
let logoGroup = new THREE.Group();
logoGroup.name = 'logoGroup';

function buildDefaultLogo() {
  // Clear any existing children
  while (logoGroup.children.length) {
    const c = logoGroup.children[0];
    c.geometry?.dispose();
    logoGroup.remove(c);
  }

  const hexShape = new THREE.Shape();
  const hexR = 0.28;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    if (i === 0) hexShape.moveTo(Math.cos(a)*hexR, Math.sin(a)*hexR);
    else hexShape.lineTo(Math.cos(a)*hexR, Math.sin(a)*hexR);
  }
  hexShape.closePath();
  const hexHole = new THREE.Path();
  const hexRI = 0.22;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    if (i === 0) hexHole.moveTo(Math.cos(a)*hexRI, Math.sin(a)*hexRI);
    else hexHole.lineTo(Math.cos(a)*hexRI, Math.sin(a)*hexRI);
  }
  hexShape.holes.push(hexHole);
  const hexMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(hexShape, { depth: logoEmbossHeight, bevelEnabled: false }), embossMaterial);
  hexMesh.name = 'logoHexFrame'; logoGroup.add(hexMesh);

  const tri1Shape = new THREE.Shape();
  tri1Shape.moveTo(0, 0.16); tri1Shape.lineTo(-0.14, -0.08); tri1Shape.lineTo(0.14, -0.08); tri1Shape.closePath();
  const tri1 = new THREE.Mesh(new THREE.ExtrudeGeometry(tri1Shape, { depth: logoEmbossHeight*1.5, bevelEnabled: false }), goldMaterial);
  tri1.name = 'logoTriangle1'; logoGroup.add(tri1);

  const tri2Shape = new THREE.Shape();
  tri2Shape.moveTo(0, -0.12); tri2Shape.lineTo(-0.09, 0.04); tri2Shape.lineTo(0.09, 0.04); tri2Shape.closePath();
  const tri2 = new THREE.Mesh(new THREE.ExtrudeGeometry(tri2Shape, { depth: logoEmbossHeight*2, bevelEnabled: false }), embossMaterial);
  tri2.name = 'logoTriangle2'; logoGroup.add(tri2);

  const dShape = new THREE.Shape();
  dShape.moveTo(0,0.05); dShape.lineTo(-0.03,0); dShape.lineTo(0,-0.05); dShape.lineTo(0.03,0); dShape.closePath();
  const diamond = new THREE.Mesh(new THREE.ExtrudeGeometry(dShape, { depth: logoEmbossHeight*2.5, bevelEnabled: true, bevelThickness:0.003, bevelSize:0.003, bevelSegments:2 }), goldMaterial);
  diamond.name = 'logoDiamond'; logoGroup.add(diamond);
}

buildDefaultLogo();
logoGroup.position.set(1.15, 0.5, cardD/2 + 0.001);
card.add(logoGroup);

// ---- Custom logo sprite (hidden by default) ----
let customLogoMesh = null;
let customLogoTexture = null;

function setCustomLogo(dataUrl) {
  // Remove default geometric logo meshes (hide them)
  logoGroup.children.forEach(c => c.visible = false);

  // Remove old mesh if it exists
  if (customLogoMesh) {
    logoGroup.remove(customLogoMesh);
    customLogoMesh.geometry?.dispose();
    customLogoMesh.material?.dispose();
    customLogoTexture?.dispose();
  }

  const tex = new THREE.TextureLoader().load(dataUrl, () => { tex.needsUpdate = true; });
  tex.colorSpace = THREE.SRGBColorSpace;
  customLogoTexture = tex;

  // Use an extruded shape so the logo is physically raised from the card surface
  const logoPlaneShape = new THREE.Shape();
  const hw = 0.5, hh = 0.5;
  logoPlaneShape.moveTo(-hw, -hh);
  logoPlaneShape.lineTo(hw, -hh);
  logoPlaneShape.lineTo(hw, hh);
  logoPlaneShape.lineTo(-hw, hh);
  logoPlaneShape.closePath();
  const extrudedGeo = new THREE.ExtrudeGeometry(logoPlaneShape, {
    depth: logoEmbossHeight * 2,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
  });
  // Shift UVs so the texture maps correctly on the front face
  const uvAttr = extrudedGeo.attributes.uv;
  const posAttr = extrudedGeo.attributes.position;
  const normalAttr = extrudedGeo.attributes.normal;
  for (let i = 0; i < uvAttr.count; i++) {
    // Only remap front-facing verts (normal z > 0.5)
    if (normalAttr.getZ(i) > 0.5) {
      uvAttr.setXY(i,
        (posAttr.getX(i) + hw) / (hw * 2),
        (posAttr.getY(i) + hh) / (hh * 2)
      );
    }
  }
  uvAttr.needsUpdate = true;

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    depthWrite: true,
    roughness: 0.35,
    metalness: 0.6,
  });
  // Side faces get a subtle matching material
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0xb0b0c0,
    roughness: 0.25,
    metalness: 0.85,
  });
  customLogoMesh = new THREE.Mesh(extrudedGeo, [mat, sideMat]);
  customLogoMesh.name = 'customLogoMesh';

  // Apply current slider values
  const s = parseFloat(document.getElementById('logo-scale').value) || 0.55;
  const rot = parseFloat(document.getElementById('logo-rotation').value) || 0;
  customLogoMesh.scale.set(s, s, 1);
  customLogoMesh.rotation.z = (rot * Math.PI) / 180;
  // Sit just above card surface (z offset accounts for extrusion pointing outward)
  customLogoMesh.position.set(0, 0, logoEmbossHeight * 1.5);
  logoGroup.add(customLogoMesh);

  // Show position controls
  document.getElementById('logo-position-controls').style.display = '';
}

function removeCustomLogo() {
  if (customLogoMesh) {
    logoGroup.remove(customLogoMesh);
    customLogoMesh.geometry?.dispose();
    customLogoMesh.material?.dispose();
    customLogoTexture?.dispose();
    customLogoMesh = null;
    customLogoTexture = null;
  }
  logoGroup.children.forEach(c => c.visible = true);

  // Hide position controls & reset sliders
  document.getElementById('logo-position-controls').style.display = 'none';
  document.getElementById('logo-pos-x').value = 1.15;
  document.getElementById('logo-pos-y').value = 0.5;
  document.getElementById('logo-scale').value = 0.55;
  document.getElementById('logo-rotation').value = 0;
  logoGroup.position.set(1.15, 0.5, cardD / 2 + 0.001);
}

// ---- EMBOSSED LINES ----
const dividerLine = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.008, logoEmbossHeight*1.5), goldMaterial);
dividerLine.name = 'dividerLine';
dividerLine.position.set(-0.2, 0.05, cardD/2 + logoEmbossHeight);
card.add(dividerLine);

const accentLine = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.004, logoEmbossHeight), embossMaterial);
accentLine.name = 'accentLine';
accentLine.position.set(-0.95, -0.12, cardD/2 + logoEmbossHeight*0.5);
card.add(accentLine);

// ---- TEXT MANAGEMENT ----
let regularFont = null;
let boldFont = null;
let textMeshes = {}; // track named text meshes on card

function clearTextMeshes() {
  Object.values(textMeshes).forEach(mesh => {
    card.remove(mesh);
    mesh.geometry?.dispose();
  });
  textMeshes = {};
}

// ---- 3D ICON BUILDERS ----
function buildEnvelopeIcon() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.055, 0.006), goldMaterial);
  body.name = 'iconEnvBody';
  g.add(body);
  const flapShape = new THREE.Shape();
  flapShape.moveTo(-0.04, 0); flapShape.lineTo(0, 0.025); flapShape.lineTo(0.04, 0); flapShape.closePath();
  const flap = new THREE.Mesh(new THREE.ExtrudeGeometry(flapShape, { depth: 0.004, bevelEnabled: false }), embossMaterial);
  flap.name = 'iconEnvFlap';
  flap.position.set(0, 0.0275, -0.002);
  g.add(flap);
  return g;
}

function buildPhoneIcon() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.065, 0.006), goldMaterial);
  body.name = 'iconPhoneBody';
  g.add(body);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.007), embossMaterial);
  screen.name = 'iconPhoneScreen';
  screen.position.set(0, 0.005, 0);
  g.add(screen);
  const btn = new THREE.Mesh(new THREE.CircleGeometry(0.004, 12), embossMaterial);
  btn.name = 'iconPhoneBtn';
  btn.position.set(0, -0.025, 0.004);
  g.add(btn);
  return g;
}

function buildGlobeIcon() {
  const g = new THREE.Group();
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), goldMaterial);
  sphere.name = 'iconGlobeSphere';
  g.add(sphere);
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.002, 8, 24), embossMaterial);
  ring1.name = 'iconGlobeRing1';
  ring1.rotation.y = Math.PI / 2;
  g.add(ring1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.002, 8, 24), embossMaterial);
  ring2.name = 'iconGlobeRing2';
  g.add(ring2);
  return g;
}

function buildPinIcon() {
  const g = new THREE.Group();
  const pinShape = new THREE.Shape();
  pinShape.moveTo(0, -0.04);
  pinShape.quadraticCurveTo(-0.025, -0.01, -0.025, 0.01);
  pinShape.absarc(0, 0.01, 0.025, Math.PI, 0, false);
  pinShape.quadraticCurveTo(0.025, -0.01, 0, -0.04);
  const pin = new THREE.Mesh(new THREE.ExtrudeGeometry(pinShape, { depth: 0.006, bevelEnabled: false }), goldMaterial);
  pin.name = 'iconPinBody';
  g.add(pin);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), embossMaterial);
  dot.name = 'iconPinDot';
  dot.position.set(0, 0.012, 0.007);
  g.add(dot);
  return g;
}

function buildLinkIcon() {
  const g = new THREE.Group();
  const link1 = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 8, 16, Math.PI), goldMaterial);
  link1.name = 'iconLink1';
  link1.position.set(-0.008, 0, 0);
  link1.rotation.z = Math.PI / 4;
  g.add(link1);
  const link2 = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 8, 16, Math.PI), embossMaterial);
  link2.name = 'iconLink2';
  link2.position.set(0.008, 0, 0);
  link2.rotation.z = Math.PI + Math.PI / 4;
  g.add(link2);
  return g;
}

function build3DIcon(type) {
  switch (type) {
    case 'envelope': return buildEnvelopeIcon();
    case 'phone':    return buildPhoneIcon();
    case 'globe':    return buildGlobeIcon();
    case 'pin':      return buildPinIcon();
    case 'link':     return buildLinkIcon();
    default:         return null;
  }
}

function buildAllText(fields) {
  clearTextMeshes();
  if (!regularFont || !boldFont) return;

  const { name, title, brand, email, phone, website } = fields;

  // Name
  const nameGeo = new TextGeometry(name, {
    font: regularFont, size: 0.14, depth: 0.018, curveSegments: 16,
    bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 4,
  });
  const nameMesh = new THREE.Mesh(nameGeo, embossMaterial);
  nameMesh.name = 'nameText';
  nameMesh.position.set(-1.35, 0.18, cardD/2 + 0.001);
  card.add(nameMesh);
  textMeshes.name = nameMesh;

  // Title
  const titleGeo = new TextGeometry(title, {
    font: regularFont, size: 0.055, depth: 0.006, curveSegments: 12, bevelEnabled: false,
  });
  const titleMesh = new THREE.Mesh(titleGeo, titleMaterial);
  titleMesh.name = 'titleText';
  titleMesh.position.set(-1.35, -0.22, cardD/2 + 0.001);
  card.add(titleMesh);
  textMeshes.title = titleMesh;

  // Contact lines — read dynamically from the DOM
  const lineFields = document.querySelectorAll('#contact-lines .contact-line-field');
  lineFields.forEach((field, i) => {
    const lineText = field.querySelector('input[type="text"]').value || '';
    const iconSelect = field.querySelector('.icon-select');
    const iconType = iconSelect ? iconSelect.value : 'none';

    // Build the 3D icon
    const iconXOffset = 0.06;
    let textX = -1.35;

    if (iconType !== 'none') {
      const iconMesh = build3DIcon(iconType);
      if (iconMesh) {
        iconMesh.name = `contactIcon_${i}`;
        iconMesh.position.set(-1.38, -0.42 - i * 0.09 + 0.018, cardD/2 + 0.006);
        iconMesh.scale.setScalar(0.7);
        card.add(iconMesh);
        textMeshes[`contactIcon_${i}`] = iconMesh;
        textX = -1.35 + iconXOffset;
      }
    }

    const geo = new TextGeometry(lineText, {
      font: regularFont, size: 0.042, depth: 0.004, curveSegments: 8, bevelEnabled: false,
    });
    const mesh = new THREE.Mesh(geo, contactMaterial);
    mesh.name = `contactText_${i}`;
    mesh.position.set(textX, -0.42 - i * 0.09, cardD/2 + 0.001);
    card.add(mesh);
    textMeshes[`contact_${i}`] = mesh;
  });

  // Brand initials
  const brandGeo = new TextGeometry(brand, {
    font: boldFont, size: 0.07, depth: 0.01, curveSegments: 12,
    bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.001, bevelSegments: 3,
  });
  const brandMesh = new THREE.Mesh(brandGeo, goldMaterial);
  brandMesh.name = 'brandMark';
  brandMesh.position.set(1.07, 0.15, cardD/2 + 0.001);
  card.add(brandMesh);
  textMeshes.brand = brandMesh;
}

// ---- LOAD FONTS ----
const fontLoader = new FontLoader();
let fontsLoaded = 0;

function onFontReady() {
  fontsLoaded++;
  if (fontsLoaded === 2) {
    buildAllText(getFieldValues());
  }
}

fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
  regularFont = font;
  onFontReady();
});
fontLoader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
  boldFont = font;
  onFontReady();
});

// ---- GROUND ----
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.5 }));
ground.name = 'shadowGround'; ground.rotation.x = -Math.PI/2; ground.position.y = -2;
ground.receiveShadow = true; scene.add(ground);

// ---- PARTICLES ----
const particleCount = 80;
const particleGeo = new THREE.BufferGeometry();
const particlePositions = new Float32Array(particleCount * 3);
const particleSizes = new Float32Array(particleCount);
for (let i = 0; i < particleCount; i++) {
  particlePositions[i*3] = (Math.random()-0.5)*12;
  particlePositions[i*3+1] = (Math.random()-0.5)*8;
  particlePositions[i*3+2] = (Math.random()-0.5)*8;
  particleSizes[i] = Math.random()*2 + 0.5;
}
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
particleGeo.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({
  color: 0x333333, size: 0.015, transparent: true, opacity: 0.4, sizeAttenuation: true,
}));
particles.name = 'floatingParticles'; scene.add(particles);

// ---- ANIMATION ----
const clock = new THREE.Clock();
function animate() {
  const elapsed = clock.getElapsedTime();
  card.position.y = Math.sin(elapsed * 0.5) * 0.08;
  card.rotation.y = Math.sin(elapsed * 0.3) * 0.03;
  card.rotation.z = Math.cos(elapsed * 0.4) * 0.01;

  if (logoGroup) {
    logoGroup.children.forEach((child, i) => {
      if (child !== customLogoMesh) {
        child.position.z = logoGroup.position.z + Math.sin(elapsed*0.8 + i*0.5)*0.002;
      }
    });
  }

  const positions = particleGeo.attributes.position.array;
  for (let i = 0; i < particleCount; i++) {
    positions[i*3+1] += Math.sin(elapsed*0.3 + i) * 0.0005;
    positions[i*3] += Math.cos(elapsed*0.2 + i*0.5) * 0.0003;
  }
  particleGeo.attributes.position.needsUpdate = true;

  fillLight.intensity = 2.5 + Math.sin(elapsed * 0.6) * 0.4;

  controls.update();
  composer.render();
}
renderer.setAnimationLoop(animate);

// ---- RESIZE ----
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
//  LIGHTING SYSTEM
// ============================================================
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RectAreaLightHelper } from 'three/examples/jsm/helpers/RectAreaLightHelper.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();

// Track user-added lights
const userPointLights = [];
const userAreaLights = [];
let userHDRTexture = null;
let proceduralEnvTexture = envRT.texture;

const lightingPresets = {
  default:  { key: { color: '#fff5e6', intensity: 5.5 }, rim: { color: '#c8d8ff', intensity: 3.5 }, fill: { color: '#ffeedd', intensity: 2.5 }, ambient: { color: '#ffffff', intensity: 1.2 }, spot: { color: '#fff8f0', intensity: 6.0 }, exposure: 2.2 },
  dramatic: { key: { color: '#ffddaa', intensity: 8.0 }, rim: { color: '#4466cc', intensity: 5.0 }, fill: { color: '#110800', intensity: 0.5 }, ambient: { color: '#111122', intensity: 0.3 }, spot: { color: '#ffe8d0', intensity: 10.0 }, exposure: 2.0 },
  warm:     { key: { color: '#ffcc66', intensity: 6.0 }, rim: { color: '#ff9944', intensity: 4.0 }, fill: { color: '#ffddaa', intensity: 3.0 }, ambient: { color: '#ffeedd', intensity: 1.5 }, spot: { color: '#ffcc88', intensity: 7.0 }, exposure: 2.4 },
  cool:     { key: { color: '#aaccff', intensity: 5.0 }, rim: { color: '#6688ff', intensity: 4.5 }, fill: { color: '#88aadd', intensity: 2.0 }, ambient: { color: '#ccddff', intensity: 1.0 }, spot: { color: '#bbddff', intensity: 5.0 }, exposure: 2.0 },
  neon:     { key: { color: '#ff00ff', intensity: 4.0 }, rim: { color: '#00ffff', intensity: 5.0 }, fill: { color: '#ff44aa', intensity: 3.0 }, ambient: { color: '#220033', intensity: 0.6 }, spot: { color: '#ff88ff', intensity: 8.0 }, exposure: 2.5 },
  soft:     { key: { color: '#ffffff', intensity: 3.0 }, rim: { color: '#ffffff', intensity: 2.0 }, fill: { color: '#ffffff', intensity: 3.5 }, ambient: { color: '#ffffff', intensity: 2.5 }, spot: { color: '#ffffff', intensity: 3.0 }, exposure: 2.8 },
};

function applyLightingPreset(name) {
  const p = lightingPresets[name];
  if (!p) return;
  keyLight.color.set(p.key.color); keyLight.intensity = p.key.intensity;
  rimLight.color.set(p.rim.color); rimLight.intensity = p.rim.intensity;
  fillLight.color.set(p.fill.color); fillLight.intensity = p.fill.intensity;
  ambientLight.color.set(p.ambient.color); ambientLight.intensity = p.ambient.intensity;
  spotLight.color.set(p.spot.color); spotLight.intensity = p.spot.intensity;
  renderer.toneMappingExposure = p.exposure;

  // Sync custom controls
  document.getElementById('light-key-color').value = p.key.color;
  document.getElementById('light-key-intensity').value = p.key.intensity;
  document.getElementById('light-rim-color').value = p.rim.color;
  document.getElementById('light-rim-intensity').value = p.rim.intensity;
  document.getElementById('light-fill-color').value = p.fill.color;
  document.getElementById('light-fill-intensity').value = p.fill.intensity;
  document.getElementById('light-ambient-color').value = p.ambient.color;
  document.getElementById('light-ambient-intensity').value = p.ambient.intensity;
  document.getElementById('light-spot-color').value = p.spot.color;
  document.getElementById('light-spot-intensity').value = p.spot.intensity;
  document.getElementById('light-exposure').value = p.exposure;
}

// --- POINT LIGHT UI ---
function addPointLightUI(config) {
  const idx = userPointLights.length;
  const light = new THREE.PointLight(config?.color || 0xffffff, config?.intensity ?? 3.0, config?.distance ?? 15);
  light.position.set(config?.x ?? 0, config?.y ?? 2, config?.z ?? 3);
  light.name = `userPointLight_${idx}`;
  scene.add(light);

  // Helper sphere
  const helper = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshBasicMaterial({ color: light.color, transparent: true, opacity: 0.6, depthTest: false })
  );
  helper.name = `userPointLightHelper_${idx}`;
  helper.position.copy(light.position);
  scene.add(helper);

  userPointLights.push({ light, helper });

  const container = document.getElementById('point-lights-container');
  const div = document.createElement('div');
  div.className = 'field';
  div.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px;margin-bottom:8px;';
  div.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
      <span style="font-size:11px;color:rgba(255,255,255,0.6);">Point Light ${idx + 1}</span>
      <span class="remove-line" data-pt-idx="${idx}" title="Remove">✕</span>
    </div>
    <div class="color-row"><label>Color</label><input type="color" data-pt="color" data-idx="${idx}" value="#${light.color.getHexString()}"></div>
    <div class="field"><label>Intensity</label><input type="range" data-pt="intensity" data-idx="${idx}" min="0" max="15" step="0.1" value="${light.intensity}" style="width:100%;accent-color:#c9a84c;cursor:pointer;"></div>
    <div class="field"><label>X Position</label><input type="range" data-pt="x" data-idx="${idx}" min="-8" max="8" step="0.1" value="${light.position.x}" style="width:100%;accent-color:#c9a84c;cursor:pointer;"></div>
    <div class="field"><label>Y Position</label><input type="range" data-pt="y" data-idx="${idx}" min="-5" max="8" step="0.1" value="${light.position.y}" style="width:100%;accent-color:#c9a84c;cursor:pointer;"></div>
    <div class="field"><label>Z Position</label><input type="range" data-pt="z" data-idx="${idx}" min="-8" max="8" step="0.1" value="${light.position.z}" style="width:100%;accent-color:#c9a84c;cursor:pointer;"></div>
  `;
  container.appendChild(div);

  // Wire up events
  div.querySelectorAll('input[type="range"], input[type="color"]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const i = parseInt(e.target.dataset.idx);
      const prop = e.target.dataset.pt;
      const entry = userPointLights[i];
      if (!entry) return;
      if (prop === 'color') { entry.light.color.set(e.target.value); entry.helper.material.color.set(e.target.value); }
      else if (prop === 'intensity') entry.light.intensity = parseFloat(e.target.value);
      else if (prop === 'x') { entry.light.position.x = parseFloat(e.target.value); entry.helper.position.x = parseFloat(e.target.value); }
      else if (prop === 'y') { entry.light.position.y = parseFloat(e.target.value); entry.helper.position.y = parseFloat(e.target.value); }
      else if (prop === 'z') { entry.light.position.z = parseFloat(e.target.value); entry.helper.position.z = parseFloat(e.target.value); }
    });
  });

  div.querySelector('.remove-line').addEventListener('click', (e) => {
    const i = parseInt(e.target.dataset.ptIdx);
    const entry = userPointLights[i];
    if (entry) {
      scene.remove(entry.light); entry.light.dispose?.();
      scene.remove(entry.helper); entry.helper.geometry.dispose(); entry.helper.material.dispose();
      userPointLights[i] = null;
    }
    div.remove();
  });
}

// --- AREA LIGHT UI ---
function addAreaLightUI(config) {
  const idx = userAreaLights.length;
  const light = new THREE.RectAreaLight(config?.color || 0xffffff, config?.intensity ?? 5.0, config?.width ?? 2, config?.height ?? 1);
  light.position.set(config?.x ?? 0, config?.y ?? 2, config?.z ?? 2);
  light.lookAt(0, 0, 0);
  light.name = `userAreaLight_${idx}`;
  scene.add(light);

  const helper = new RectAreaLightHelper(light);
  helper.name = `userAreaLightHelper_${idx}`;
  light.add(helper);

  userAreaLights.push({ light, helper });

  const container = document.getElementById('area-lights-container');
  const div = document.createElement('div');
  div.className = 'field';
  div.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px;margin-bottom:8px;';
  div.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
      <span style="font-size:11px;color:rgba(255,255,255,0.6);">Area Light ${idx + 1}</span>
      <span class="remove-line" data-al-idx="${idx}" title="Remove">✕</span>
    </div>
    <div class="color-row"><label>Color</label><input type="color" data-al="color" data-idx="${idx}" value="#${light.color.getHexString()}"></div>
    <div class="field"><label>Intensity</label><input type="range" data-al="intensity" data-idx="${idx}" min="0" max="20" step="0.1" value="${light.intensity}" style="width:100%;accent-color:#c9a84c;cursor:pointer;"></div>
    <div class="field"><label>Width</label><input type="range" data-al="width" data-idx="${idx}" min="0.2" max="8" step="0.1" value="${light.width}" style="width:100%;accent-color:#c9a84c;cursor:pointer;"></div>
    <div class="field"><label>Height</label><input type="range" data-al="height" data-idx="${idx}" min="0.2" max="8" step="0.1" value="${light.height}" style="width:100%;accent-color:#c9a84c;cursor:pointer;"></div>
    <div class="field"><label>X Position</label><input type="range" data-al="x" data-idx="${idx}" min="-8" max="8" step="0.1" value="${light.position.x}" style="width:100%;accent-color:#c9a84c;cursor:pointer;"></div>
    <div class="field"><label>Y Position</label><input type="range" data-al="y" data-idx="${idx}" min="-5" max="8" step="0.1" value="${light.position.y}" style="width:100%;accent-color:#c9a84c;cursor:pointer;"></div>
    <div class="field"><label>Z Position</label><input type="range" data-al="z" data-idx="${idx}" min="-8" max="8" step="0.1" value="${light.position.z}" style="width:100%;accent-color:#c9a84c;cursor:pointer;"></div>
  `;
  container.appendChild(div);

  div.querySelectorAll('input[type="range"], input[type="color"]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const i = parseInt(e.target.dataset.idx);
      const prop = e.target.dataset.al;
      const entry = userAreaLights[i];
      if (!entry) return;
      if (prop === 'color') entry.light.color.set(e.target.value);
      else if (prop === 'intensity') entry.light.intensity = parseFloat(e.target.value);
      else if (prop === 'width') entry.light.width = parseFloat(e.target.value);
      else if (prop === 'height') entry.light.height = parseFloat(e.target.value);
      else if (prop === 'x') { entry.light.position.x = parseFloat(e.target.value); entry.light.lookAt(0,0,0); }
      else if (prop === 'y') { entry.light.position.y = parseFloat(e.target.value); entry.light.lookAt(0,0,0); }
      else if (prop === 'z') { entry.light.position.z = parseFloat(e.target.value); entry.light.lookAt(0,0,0); }
    });
  });

  div.querySelector('.remove-line').addEventListener('click', (e) => {
    const i = parseInt(e.target.dataset.alIdx);
    const entry = userAreaLights[i];
    if (entry) {
      scene.remove(entry.light); entry.light.dispose?.();
      userAreaLights[i] = null;
    }
    div.remove();
  });
}

// --- HDRI LOADING ---
const hdrLoader = new HDRLoader();

function loadHDRI(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const buffer = ev.target.result;
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);

    hdrLoader.load(url, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;

      // Dispose old user HDR
      if (userHDRTexture) userHDRTexture.dispose();
      userHDRTexture = texture;

      // Generate PMREM from HDR
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const rt = pmrem.fromEquirectangular(texture);
      scene.environment = rt.texture;
      pmrem.dispose();

      if (document.getElementById('hdri-as-background').checked) {
        scene.background = texture;
        if (bgMesh) bgMesh.visible = false;
      }

      // Update env intensity
      const intVal = parseFloat(document.getElementById('hdri-intensity').value);
      cardMaterial.envMapIntensity = intVal;
      embossMaterial.envMapIntensity = intVal;
      goldMaterial.envMapIntensity = intVal;

      URL.revokeObjectURL(url);
    });
  };
  reader.readAsArrayBuffer(file);
}

function removeHDRI() {
  if (userHDRTexture) {
    userHDRTexture.dispose();
    userHDRTexture = null;
  }
  // Restore procedural env map
  scene.environment = proceduralEnvTexture;
  scene.background = null;
  if (bgMesh) bgMesh.visible = true;
  cardMaterial.envMapIntensity = 1.2;
  embossMaterial.envMapIntensity = 1.0;
  goldMaterial.envMapIntensity = 1.0;
}

// ============================================================
//  UI PANEL LOGIC
// ============================================================
function getFieldValues() {
  return {
    name:    document.getElementById('inp-name').value   || 'ALEXANDER GREY',
    title:   document.getElementById('inp-title').value  || 'CREATIVE DIRECTOR',
    brand:   document.getElementById('inp-brand').value  || 'GS',
  };
}

// Card finish dropdown
const finishPresets = {
  matte:  { roughness: 0.75, metalness: 0.3,  envMapIntensity: 0.4 },
  satin:  { roughness: 0.35, metalness: 0.75, envMapIntensity: 1.2 },
  mirror: { roughness: 0.05, metalness: 0.95, envMapIntensity: 2.0 },
};

// Card texture dropdown
document.getElementById('card-texture').addEventListener('change', (e) => {
  const type = e.target.value;
  if (cardMaterial.bumpMap) cardMaterial.bumpMap.dispose();
  cardMaterial.bumpMap = generateBumpTexture(type);
  cardMaterial.bumpScale = bumpScales[type] || 0.002;
  cardMaterial.needsUpdate = true;
});

// Background preset
const bgPresetSelect = document.getElementById('bg-preset');
const bgSolidControls = document.getElementById('bg-solid-controls');
const bgGradControls = document.getElementById('bg-gradient-controls');

bgPresetSelect.addEventListener('change', (e) => {
  const v = e.target.value;
  bgSolidControls.style.display = v === 'solid' ? '' : 'none';
  bgGradControls.style.display = v === 'gradient' ? '' : 'none';
  applyBackground(v);
});

document.getElementById('bg-solid-color').addEventListener('input', () => {
  if (bgPresetSelect.value === 'solid') applyBackground('solid');
});
document.getElementById('bg-grad-top').addEventListener('input', () => {
  if (bgPresetSelect.value === 'gradient') applyBackground('gradient');
});
document.getElementById('bg-grad-mid').addEventListener('input', () => {
  if (bgPresetSelect.value === 'gradient') applyBackground('gradient');
});
document.getElementById('bg-grad-bottom').addEventListener('input', () => {
  if (bgPresetSelect.value === 'gradient') applyBackground('gradient');
});
document.getElementById('bg-grad-angle').addEventListener('input', () => {
  if (bgPresetSelect.value === 'gradient') applyBackground('gradient');
});

document.getElementById('card-finish').addEventListener('change', (e) => {
  const preset = finishPresets[e.target.value];
  if (preset) {
    cardMaterial.roughness = preset.roughness;
    cardMaterial.metalness = preset.metalness;
    cardMaterial.envMapIntensity = preset.envMapIntensity;
    cardMaterial.needsUpdate = true;
  }
});

// Color pickers — live preview on input
document.getElementById('clr-card').addEventListener('input', (e) => {
  cardMaterial.color.set(e.target.value);
});
document.getElementById('clr-emboss').addEventListener('input', (e) => {
  embossMaterial.color.set(e.target.value);
});
document.getElementById('clr-gold').addEventListener('input', (e) => {
  goldMaterial.color.set(e.target.value);
  goldMaterial.emissive.set(e.target.value).multiplyScalar(0.12);
});
document.getElementById('clr-title').addEventListener('input', (e) => {
  titleMaterial.color.set(e.target.value);
});
document.getElementById('clr-contact').addEventListener('input', (e) => {
  contactMaterial.color.set(e.target.value);
});

// Logo upload
const uploadArea = document.getElementById('upload-area');
const logoInput = document.getElementById('logo-input');
const logoPreview = document.getElementById('logo-preview');
const logoThumb = document.getElementById('logo-thumb');
const logoNameSpan = document.getElementById('logo-name');
const removeLogoBtn = document.getElementById('remove-logo');

uploadArea.addEventListener('click', () => logoInput.click());
uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = 'rgba(201,168,76,0.6)'; });
uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = '';
  if (e.dataTransfer.files.length) handleLogoFile(e.dataTransfer.files[0]);
});

logoInput.addEventListener('change', (e) => {
  if (e.target.files.length) handleLogoFile(e.target.files[0]);
});

function handleLogoFile(file) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    logoThumb.src = dataUrl;
    logoNameSpan.textContent = file.name;
    uploadArea.style.display = 'none';
    logoPreview.style.display = 'flex';
    setCustomLogo(dataUrl);
  };
  reader.readAsDataURL(file);
}

removeLogoBtn.addEventListener('click', () => {
  uploadArea.style.display = '';
  logoPreview.style.display = 'none';
  logoInput.value = '';
  removeCustomLogo();
});

// ---- LOGO POSITION / SCALE / ROTATION SLIDERS ----
document.getElementById('logo-pos-x').addEventListener('input', (e) => {
  logoGroup.position.x = parseFloat(e.target.value);
});
document.getElementById('logo-pos-y').addEventListener('input', (e) => {
  logoGroup.position.y = parseFloat(e.target.value);
});
document.getElementById('logo-scale').addEventListener('input', (e) => {
  const s = parseFloat(e.target.value);
  if (customLogoMesh) customLogoMesh.scale.set(s, s, 1);
  else logoGroup.scale.setScalar(s / 0.55); // scale default logo relative to base
});
document.getElementById('logo-rotation').addEventListener('input', (e) => {
  const deg = parseFloat(e.target.value);
  const rad = (deg * Math.PI) / 180;
  if (customLogoMesh) {
    customLogoMesh.rotation.z = rad;
  } else {
    logoGroup.rotation.z = rad;
  }
});

// Preset position buttons
document.querySelectorAll('.logo-preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const x = parseFloat(btn.dataset.x);
    const y = parseFloat(btn.dataset.y);
    document.getElementById('logo-pos-x').value = x;
    document.getElementById('logo-pos-y').value = y;
    logoGroup.position.x = x;
    logoGroup.position.y = y;
  });
});

// Apply button — rebuild text
document.getElementById('apply-btn').addEventListener('click', () => {
  buildAllText(getFieldValues());
});

// Also apply on Enter key in any text input
document.querySelectorAll('#panel input[type="text"], #panel input[type="email"], #panel input[type="tel"]').forEach(inp => {
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buildAllText(getFieldValues());
    }
  });
});

// ---- LIGHTING PRESET ----
const lightPresetSelect = document.getElementById('light-preset');
const lightCustomControls = document.getElementById('light-custom-controls');

lightPresetSelect.addEventListener('change', (e) => {
  const v = e.target.value;
  lightCustomControls.style.display = v === 'custom' ? '' : 'none';
  if (v !== 'custom') applyLightingPreset(v);
});

// Custom light sliders
document.getElementById('light-key-color').addEventListener('input', (e) => { keyLight.color.set(e.target.value); });
document.getElementById('light-key-intensity').addEventListener('input', (e) => { keyLight.intensity = parseFloat(e.target.value); });
document.getElementById('light-rim-color').addEventListener('input', (e) => { rimLight.color.set(e.target.value); });
document.getElementById('light-rim-intensity').addEventListener('input', (e) => { rimLight.intensity = parseFloat(e.target.value); });
document.getElementById('light-fill-color').addEventListener('input', (e) => { fillLight.color.set(e.target.value); });
document.getElementById('light-fill-intensity').addEventListener('input', (e) => { fillLight.intensity = parseFloat(e.target.value); });
document.getElementById('light-ambient-color').addEventListener('input', (e) => { ambientLight.color.set(e.target.value); });
document.getElementById('light-ambient-intensity').addEventListener('input', (e) => { ambientLight.intensity = parseFloat(e.target.value); });
document.getElementById('light-spot-color').addEventListener('input', (e) => { spotLight.color.set(e.target.value); });
document.getElementById('light-spot-intensity').addEventListener('input', (e) => { spotLight.intensity = parseFloat(e.target.value); });
document.getElementById('light-exposure').addEventListener('input', (e) => { renderer.toneMappingExposure = parseFloat(e.target.value); });

// Point light add button
document.getElementById('add-point-light-btn').addEventListener('click', () => {
  if (userPointLights.filter(Boolean).length >= 6) return;
  addPointLightUI();
});

// Area light add button
document.getElementById('add-area-light-btn').addEventListener('click', () => {
  if (userAreaLights.filter(Boolean).length >= 4) return;
  addAreaLightUI();
});

// HDRI upload
const hdriUploadArea = document.getElementById('hdri-upload-area');
const hdriInput = document.getElementById('hdri-input');
const hdriPreview = document.getElementById('hdri-preview');
const hdriNameSpan = document.getElementById('hdri-name');

hdriUploadArea.addEventListener('click', () => hdriInput.click());
hdriUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); hdriUploadArea.style.borderColor = 'rgba(201,168,76,0.6)'; });
hdriUploadArea.addEventListener('dragleave', () => { hdriUploadArea.style.borderColor = ''; });
hdriUploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  hdriUploadArea.style.borderColor = '';
  if (e.dataTransfer.files.length) {
    const f = e.dataTransfer.files[0];
    if (f.name.match(/\.(hdr|exr)$/i)) {
      hdriNameSpan.textContent = f.name;
      hdriUploadArea.style.display = 'none';
      hdriPreview.style.display = '';
      loadHDRI(f);
    }
  }
});
hdriInput.addEventListener('change', (e) => {
  if (e.target.files.length) {
    const f = e.target.files[0];
    hdriNameSpan.textContent = f.name;
    hdriUploadArea.style.display = 'none';
    hdriPreview.style.display = '';
    loadHDRI(f);
  }
});
document.getElementById('remove-hdri').addEventListener('click', () => {
  hdriUploadArea.style.display = '';
  hdriPreview.style.display = 'none';
  hdriInput.value = '';
  removeHDRI();
});

document.getElementById('hdri-intensity').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  cardMaterial.envMapIntensity = v;
  embossMaterial.envMapIntensity = v;
  goldMaterial.envMapIntensity = v;
});

document.getElementById('hdri-rotation').addEventListener('input', (e) => {
  const deg = parseFloat(e.target.value);
  const rad = (deg * Math.PI) / 180;
  if (scene.environment) scene.environmentRotation = new THREE.Euler(0, rad, 0);
});

document.getElementById('hdri-as-background').addEventListener('change', (e) => {
  if (e.target.checked && userHDRTexture) {
    scene.background = userHDRTexture;
    if (bgMesh) bgMesh.visible = false;
  } else {
    scene.background = null;
    if (bgMesh) bgMesh.visible = true;
  }
});

// Toggle panel visibility
const toggleBtn = document.getElementById('toggle-panel');
const panel = document.getElementById('panel');
let panelVisible = true;
toggleBtn.addEventListener('click', () => {
  panelVisible = !panelVisible;
  panel.style.display = panelVisible ? '' : 'none';
  toggleBtn.style.display = panelVisible ? 'none' : 'flex';
});