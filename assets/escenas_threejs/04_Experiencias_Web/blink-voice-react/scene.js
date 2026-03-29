import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Auto-generated 3D Model Viewer
const scene = new THREE.Scene();
scene.background = new THREE.Color('#182831');

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.2, 4.);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
renderer.outputColorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// Big centered text overlay
const link = document.createElement('link');
link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
link.rel = 'stylesheet';
document.head.appendChild(link);

const textOverlay = document.createElement('div');
textOverlay.textContent = 'BLINK';
textOverlay.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%) translateY(30px);font-family:"Press Start 2P",monospace;font-size:clamp(16px,3.5vw,40px);font-weight:400;color:rgba(255,255,255,0);letter-spacing:0.05em;text-transform:uppercase;pointer-events:none;z-index:100;text-align:center;white-space:nowrap;text-shadow:0 2px 6px rgba(0,0,0,0.5),0 0 30px rgba(0,0,0,0.3),0 0 60px rgba(0,0,0,0.15);transition:color 0.6s ease, text-shadow 0.6s ease;';

// Text morphing helper
let textMorphTarget = 'BLINK';
let textGlowActive = false;
function setTextOverlay(text, glow) {
  textMorphTarget = text;
  textGlowActive = glow;
  textOverlay.style.opacity = '0';
  textOverlay.style.transition = 'opacity 0.3s ease';
  setTimeout(() => {
    textOverlay.textContent = text;
    textOverlay.style.opacity = '1';
  }, 300);
}
document.body.appendChild(textOverlay);

// Dither post-processing setup
const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

const ditherShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    pixelSize: { value: 3.0 },
    colorLevels: { value: 4.0 },
    grainIntensity: { value: 0.06 },
    uTime: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float pixelSize;
    uniform float colorLevels;
    uniform float grainIntensity;
    uniform float uTime;
    varying vec2 vUv;

    // 8x8 Bayer matrix for ordered dithering
    float bayer8(vec2 p) {
      ivec2 ip = ivec2(mod(p, 8.0));
      int index = ip.x + ip.y * 8;
      
      // 8x8 Bayer matrix values (normalized to 0-1)
      int b[64];
      b[0]=0;  b[1]=32; b[2]=8;  b[3]=40; b[4]=2;  b[5]=34; b[6]=10; b[7]=42;
      b[8]=48; b[9]=16; b[10]=56;b[11]=24;b[12]=50;b[13]=18;b[14]=58;b[15]=26;
      b[16]=12;b[17]=44;b[18]=4; b[19]=36;b[20]=14;b[21]=46;b[22]=6; b[23]=38;
      b[24]=60;b[25]=28;b[26]=52;b[27]=20;b[28]=62;b[29]=30;b[30]=54;b[31]=22;
      b[32]=3; b[33]=35;b[34]=11;b[35]=43;b[36]=1; b[37]=33;b[38]=9; b[39]=41;
      b[40]=51;b[41]=19;b[42]=59;b[43]=27;b[44]=49;b[45]=17;b[46]=57;b[47]=25;
      b[48]=15;b[49]=47;b[50]=7; b[51]=39;b[52]=13;b[53]=45;b[54]=5; b[55]=37;
      b[56]=63;b[57]=31;b[58]=55;b[59]=23;b[60]=61;b[61]=29;b[62]=53;b[63]=21;
      
      return float(b[index]) / 64.0;
    }

    void main() {
      // Pixelate UV
      vec2 pixelUv = floor(vUv * resolution / pixelSize) * pixelSize / resolution;
      vec4 color = texture2D(tDiffuse, pixelUv);
      
      // Get screen-space pixel coordinate for dither pattern
      vec2 screenPos = vUv * resolution / pixelSize;
      float threshold = bayer8(screenPos) - 0.5;
      
      // Apply dithering per channel with quantization
      float spread = 1.0 / colorLevels;
      vec3 dithered;
      dithered.r = floor(color.r * colorLevels + threshold + 0.5) / colorLevels;
      dithered.g = floor(color.g * colorLevels + threshold + 0.5) / colorLevels;
      dithered.b = floor(color.b * colorLevels + threshold + 0.5) / colorLevels;
      
      // Map dithered color to white pixels on dark background
      // Preserve color instead of converting to grayscale
            vec3 finalColor = dithered;
      
      // Film grain
      float grainTime = fract(sin(dot(vUv * resolution + vec2(uTime * 37.0, uTime * 71.0), vec2(12.9898, 78.233))) * 43758.5453);
      float grain = (grainTime - 0.5) * grainIntensity;
      finalColor += grain;
      
      gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), color.a);
    }
  `
};

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.8,   // strength
  0.4,   // radius
  0.85   // threshold
);
composer.addPass(bloomPass);

const ditherPass = new ShaderPass(ditherShader);
composer.addPass(ditherPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// Dither intensity slider UI
let ditherIntensity = 0.1;
function updateDitherFromIntensity(t) {
  ditherPass.uniforms.pixelSize.value = 1.0 + t * 4.0;
  ditherPass.uniforms.colorLevels.value = 16 - t * 14;
}
updateDitherFromIntensity(ditherIntensity);

// ── Web Audio / Microphone reactivity ──
let audioCtx = null;
let analyser = null;
let freqData = null;
let timeDomainData = null;
let micActive = false;
let smoothVolume = 0;
let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;
const AUDIO_SMOOTH = 0.15;
const MIC_EXPAND_STRENGTH = 0.18;
const PULSE_SCALE_AMOUNT = 0.06;

// Mic button UI — created early so it can be added to slider bar
const micBtn = document.createElement('button');
micBtn.innerHTML = 'GO TO VOICE MODE';
micBtn.style.cssText = 'background:transparent;color:#61F2F2;border:2px solid #61F2F2;border-radius:8px;padding:8px 32px;font-family:Inter,system-ui,sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.35s ease;user-select:none;white-space:nowrap;letter-spacing:0.08em;text-transform:uppercase;';

// Live pulsing dot element
const liveDot = document.createElement('span');
liveDot.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;background:#FF5393;margin-right:8px;vertical-align:middle;animation:none;';
const liveDotKeyframes = `@keyframes livePulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.7); } }`;
const liveDotStyle = document.createElement('style');
liveDotStyle.textContent = liveDotKeyframes;
document.head.appendChild(liveDotStyle);

// Volume meter — thin bar inside slider bar
const meterWrap = document.createElement('div');
meterWrap.style.cssText = 'width:40px;height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;opacity:0;transition:opacity 0.3s;';
const meterFill = document.createElement('div');
meterFill.style.cssText = 'width:0%;height:100%;background:linear-gradient(90deg,#61F2F2,#FF5393);border-radius:2px;transition:width 0.06s;';
meterWrap.appendChild(meterFill);

const sliderBar = document.createElement('div');
sliderBar.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:14px;background:rgba(26,26,26,0.85);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 20px;font-family:Inter,system-ui,sans-serif;font-size:12px;color:rgba(255,255,255,0.6);z-index:100;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);user-select:none;';

const labelLeft = document.createElement('span');
labelLeft.textContent = 'Clean';
labelLeft.style.cssText = 'white-space:nowrap;min-width:32px;font-size:10px;color:rgba(255,255,255,0.35);';

const slider = document.createElement('input');
slider.type = 'range';
slider.min = '0';
slider.max = '100';
slider.value = '10';
slider.style.cssText = 'width:100px;accent-color:rgba(255,255,255,0.3);cursor:pointer;';

const labelRight = document.createElement('span');
labelRight.textContent = 'Retro';
labelRight.style.cssText = 'white-space:nowrap;min-width:32px;font-size:10px;color:rgba(255,255,255,0.35);';

const valDisplay = document.createElement('span');
valDisplay.textContent = '10%';
valDisplay.style.cssText = 'min-width:28px;text-align:right;color:rgba(255,255,255,0.25);font-variant-numeric:tabular-nums;font-size:10px;';

// Separator
const sep1 = document.createElement('div');
sep1.style.cssText = 'width:1px;height:16px;background:rgba(255,255,255,0.1);';

// Rotation toggle button — minimal/secondary style
const rotateBtn = document.createElement('button');
rotateBtn.textContent = '⟳';
rotateBtn.title = 'Toggle auto-rotation';
rotateBtn.style.cssText = 'background:transparent;color:rgba(255,255,255,0.3);border:none;border-radius:4px;padding:4px 8px;font-size:16px;cursor:pointer;transition:color 0.2s,background 0.2s;user-select:none;line-height:1;';
let autoRotateOn = true;
function updateRotateBtnStyle() {
  rotateBtn.style.color = autoRotateOn ? 'rgba(97,242,242,0.8)' : 'rgba(255,255,255,0.3)';
  rotateBtn.style.background = autoRotateOn ? 'rgba(97,242,242,0.08)' : 'transparent';
}
updateRotateBtnStyle();
rotateBtn.addEventListener('mouseenter', () => { rotateBtn.style.color = 'rgba(255,255,255,0.6)'; rotateBtn.style.background = 'rgba(255,255,255,0.05)'; });
rotateBtn.addEventListener('mouseleave', updateRotateBtnStyle);
rotateBtn.addEventListener('click', () => {
  autoRotateOn = !autoRotateOn;
  controls.autoRotate = autoRotateOn;
  updateRotateBtnStyle();
});

const sep2 = document.createElement('div');
sep2.style.cssText = 'width:1px;height:16px;background:rgba(255,255,255,0.1);';

// Layout: [Rotate] [sep] [Clean --- Retro] [spacer] [=== GO LIVE ===] [meter]
sliderBar.appendChild(rotateBtn);
sliderBar.appendChild(sep1);
sliderBar.appendChild(labelLeft);
sliderBar.appendChild(slider);
sliderBar.appendChild(labelRight);
sliderBar.appendChild(valDisplay);

// Flexible spacer to push GO LIVE to the right
const spacer = document.createElement('div');
spacer.style.cssText = 'flex:1;min-width:8px;';
sliderBar.appendChild(spacer);

sliderBar.appendChild(micBtn);
sliderBar.appendChild(meterWrap);
document.body.appendChild(sliderBar);

slider.addEventListener('input', () => {
  ditherIntensity = parseInt(slider.value) / 100;
  valDisplay.textContent = slider.value + '%';
  updateDitherFromIntensity(ditherIntensity);
});

window.addEventListener('keydown', (e) => {
  if (e.key === '[') { ditherIntensity = Math.max(0, ditherIntensity - 0.05); }
  else if (e.key === ']') { ditherIntensity = Math.min(1, ditherIntensity + 0.05); }
  else if (e.key === '0') { ditherIntensity = 0.5; }
  else return;
  slider.value = Math.round(ditherIntensity * 100);
  valDisplay.textContent = Math.round(ditherIntensity * 100) + '%';
  updateDitherFromIntensity(ditherIntensity);
});

// Procedural environment map for realistic reflections
(function createEnvironment() {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  
  const envScene = new THREE.Scene();
  
  // Gradient sky dome
  const skyGeo = new THREE.SphereGeometry(50, 32, 32);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x1a1a2e) },
      bottomColor: { value: new THREE.Color(0x0a0a0a) },
      midColor: { value: new THREE.Color(0x151520) },
      offset: { value: 10 },
      exponent: { value: 0.4 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform vec3 midColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        float t = max(pow(max(h, 0.0), exponent), 0.0);
        vec3 color = mix(bottomColor, midColor, smoothstep(0.0, 0.3, t));
        color = mix(color, topColor, smoothstep(0.3, 1.0, t));
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  envScene.add(new THREE.Mesh(skyGeo, skyMat));
  
  // Add some soft area lights to the env scene for reflections
  const envLight1 = new THREE.PointLight(0xffffff, 80, 100);
  envLight1.position.set(10, 15, 10);
  envScene.add(envLight1);
  
  const envLight2 = new THREE.PointLight(0x8888cc, 40, 100);
  envLight2.position.set(-10, 10, -5);
  envScene.add(envLight2);
  
  const envLight3 = new THREE.PointLight(0xccaa88, 30, 100);
  envLight3.position.set(5, 3, -10);
  envScene.add(envLight3);
  
  const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
  scene.environment = envMap;
  envScene.traverse(child => { if (child.geometry) child.geometry.dispose(); if (child.material) child.material.dispose(); });
  pmremGenerator.dispose();
})();

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xc8d0e0, 0x2a2a3a, 0.6);
scene.add(hemiLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.8);
mainLight.position.set(5, 8, 5);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
mainLight.shadow.camera.near = 0.1;
mainLight.shadow.camera.far = 30;
mainLight.shadow.camera.left = -5;
mainLight.shadow.camera.right = 5;
mainLight.shadow.camera.top = 5;
mainLight.shadow.camera.bottom = -5;
mainLight.shadow.bias = -0.001;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xcccccc, 0.6);
fillLight.position.set(-3, 4, -3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
rimLight.position.set(0, 2, -5);
scene.add(rimLight);

// Floating dust particles (ambient background)
const dustCount = 150;
const dustGeo = new THREE.BufferGeometry();
const dustPositions = new Float32Array(dustCount * 3);
const dustVelocities = new Float32Array(dustCount * 3);
const dustSizes = new Float32Array(dustCount);

for (let i = 0; i < dustCount; i++) {
  dustPositions[i * 3] = (Math.random() - 0.5) * 10;
  dustPositions[i * 3 + 1] = Math.random() * 6 - 1;
  dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  dustVelocities[i * 3] = (Math.random() - 0.5) * 0.003;
  dustVelocities[i * 3 + 1] = Math.random() * 0.002 + 0.001;
  dustVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.003;
  dustSizes[i] = Math.random() * 3 + 1;
}

dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
dustGeo.setAttribute('aSize', new THREE.BufferAttribute(dustSizes, 1));

const dustMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uTime: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
  },
  vertexShader: `
    attribute float aSize;
    uniform float uTime;
    uniform float uPixelRatio;
    varying float vAlpha;
    void main() {
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * uPixelRatio * (80.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
      float dist = length(position.xz);
      vAlpha = smoothstep(5.5, 2.0, dist) * (0.15 + 0.1 * sin(uTime * 0.5 + position.x * 3.0));
    }
  `,
  fragmentShader: `
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float strength = 1.0 - smoothstep(0.0, 1.0, d);
      strength = pow(strength, 2.0);
      gl_FragColor = vec4(vec3(0.38, 0.95, 0.95), strength * vAlpha);
    }
  `,
});

const dustParticles = new THREE.Points(dustGeo, dustMat);
dustParticles.name = 'dustParticles';
scene.add(dustParticles);

// Mouse raycaster for particle interaction
const mouse = new THREE.Vector2(9999, 9999);
const raycaster = new THREE.Raycaster();
const mouseWorld3D = new THREE.Vector3();
const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const mouseRay = new THREE.Ray();

window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});
window.addEventListener('mouseleave', () => {
  mouse.x = 9999;
  mouse.y = 9999;
});

// Mic button event listeners (defined after creation above)
function updateMicBtnStyle() {
  if (micActive) {
    micBtn.innerHTML = '';
    micBtn.appendChild(liveDot);
    micBtn.appendChild(document.createTextNode('LIVE'));
    micBtn.style.background = 'rgba(255,83,147,0.2)';
    micBtn.style.borderColor = '#FF5393';
    micBtn.style.color = '#fff';
    micBtn.style.boxShadow = '0 0 20px rgba(255,83,147,0.25), inset 0 0 12px rgba(255,83,147,0.1)';
    liveDot.style.animation = 'livePulse 1.2s ease-in-out infinite';
  } else {
    micBtn.innerHTML = 'GO TO VOICE MODE';
    micBtn.style.background = 'transparent';
    micBtn.style.borderColor = '#61F2F2';
    micBtn.style.color = '#61F2F2';
    micBtn.style.boxShadow = '0 0 12px rgba(97,242,242,0.1)';
    liveDot.style.animation = 'none';
  }
}
micBtn.addEventListener('mouseenter', () => {
  if (!micActive) {
    micBtn.style.background = 'rgba(97,242,242,0.1)';
    micBtn.style.boxShadow = '0 0 20px rgba(97,242,242,0.2)';
  } else {
    micBtn.style.background = 'rgba(255,83,147,0.3)';
  }
});
micBtn.addEventListener('mouseleave', updateMicBtnStyle);

async function initMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeDomainData = new Uint8Array(analyser.fftSize);
    micActive = true;
    updateMicBtnStyle();
    meterWrap.style.opacity = '1';
    setTextOverlay('BLINK · LIVE', true);
  } catch (e) {
    console.warn('Mic access denied:', e);
    micBtn.innerHTML = '⚠ ERROR';
    micBtn.style.color = 'rgba(255,80,80,0.8)';
    micBtn.style.borderColor = 'rgba(255,80,80,0.4)';
  }
}

micBtn.addEventListener('click', () => {
  if (micActive) {
    // Toggle off — reassemble back to solid
    micActive = false;
    if (audioCtx) { audioCtx.close(); audioCtx = null; analyser = null; }
    updateMicBtnStyle();
    meterWrap.style.opacity = '0';
    setTextOverlay('BLINK', false);
    smoothVolume = 0; smoothBass = 0; smoothMid = 0; smoothTreble = 0;
    startReassemble();
  } else {
    initMic().then(() => {
      if (micActive) startDissolve();
    });
  }
});

function updateAudioData() {
  if (!micActive || !analyser) return;
  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeDomainData);

  const binCount = freqData.length; // 256
  const third = Math.floor(binCount / 3);

  // Bass (low frequencies), mid, treble (high frequencies)
  let bassSum = 0, midSum = 0, trebleSum = 0;
  for (let i = 0; i < third; i++) bassSum += freqData[i];
  for (let i = third; i < third * 2; i++) midSum += freqData[i];
  for (let i = third * 2; i < binCount; i++) trebleSum += freqData[i];

  const rawBass = bassSum / (third * 255);
  const rawMid = midSum / (third * 255);
  const rawTreble = trebleSum / ((binCount - third * 2) * 255);

  // Overall RMS volume from time domain
  let rms = 0;
  for (let i = 0; i < timeDomainData.length; i++) {
    const v = (timeDomainData[i] - 128) / 128;
    rms += v * v;
  }
  rms = Math.sqrt(rms / timeDomainData.length);

  // Smooth everything
  smoothVolume += (rms - smoothVolume) * AUDIO_SMOOTH;
  smoothBass += (rawBass - smoothBass) * AUDIO_SMOOTH;
  smoothMid += (rawMid - smoothMid) * AUDIO_SMOOTH;
  smoothTreble += (rawTreble - smoothTreble) * AUDIO_SMOOTH;

  // Update volume meter
  const meterPct = Math.min(smoothVolume * 5, 1) * 100;
  meterFill.style.width = meterPct + '%';
}

// Molecular point cloud system — will be populated after model loads
let moleculePoints = null;
let moleculeBasePositions = null;
let moleculeCurrentPositions = null;
let moleculeColors = null;
let moleculeOffsets = null; // random per-particle offsets for breathing
let moleculeBaseColors = null; // original texture colors for color shift blending
const MOLECULE_COUNT = 25000;
const PARTICLE_SIZE = 0.018;
const REPEL_RADIUS = 0.6;
const REPEL_STRENGTH = 0.35;
const BREATHE_AMPLITUDE = 0.012;
const BREATHE_SPEED = 1.2;
const RETURN_SPEED = 0.04;

// Morph transition state
let solidModel = null; // reference to the loaded GLTF model
let morphState = 'solid'; // 'solid' | 'dissolving' | 'particles' | 'reassembling'
let morphProgress = 0; // 0 = solid, 1 = fully particles
const MORPH_DURATION = 1.5; // seconds
let morphStartTime = 0;

// Explosion origin positions (randomized outward burst before settling)
let moleculeExplosionPositions = null;

// Per-particle stagger delays (normalized 0-1, based on height for wave effect)
let moleculeStaggerDelays = null;
const STAGGER_SPREAD = 0.45; // how much time spread between first and last particle (0-1)

// ── Sweep line (glowing horizontal ring that tracks the dissolve/reassemble wave front) ──
let sweepLine = null;
let sweepTrail = null;
let sweepLineYMin = 0;
let sweepLineYMax = 2;
const TRAIL_LAG = 0.15; // trail follows 15% behind main ring

// ── Sweep spark emitter — tiny cyan sparks burst from the ring as it passes ──
const SWEEP_SPARK_COUNT = 600;
const SWEEP_SPARK_LIFE = 0.8; // seconds each spark lives
let sweepSparks = null;
let sweepSparkData = null; // { life, maxLife, vx, vy, vz, active }
let sweepSparkLastY = null; // track last ring Y to detect movement

(function createSweepSparks() {
  const positions = new Float32Array(SWEEP_SPARK_COUNT * 3);
  const alphas = new Float32Array(SWEEP_SPARK_COUNT);
  const sizes = new Float32Array(SWEEP_SPARK_COUNT);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float aAlpha;
      attribute float aSize;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (120.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float glow = pow(1.0 - d, 2.5);
        // Cyan core fading to magenta at edges
        vec3 col = mix(vec3(0.38, 0.95, 0.95), vec3(1.0, 0.325, 0.576), d * 0.5);
        gl_FragColor = vec4(col, glow * vAlpha);
      }
    `
  });

  sweepSparks = new THREE.Points(geo, mat);
  sweepSparks.name = 'sweepSparks';
  sweepSparks.frustumCulled = false;
  scene.add(sweepSparks);

  sweepSparkData = [];
  for (let i = 0; i < SWEEP_SPARK_COUNT; i++) {
    sweepSparkData.push({ life: 0, maxLife: 0, vx: 0, vy: 0, vz: 0, active: false });
    sizes[i] = 1.0 + Math.random() * 2.0;
  }
})();

function emitSweepSparks(y, count) {
  if (!sweepSparkData) return;
  let emitted = 0;
  for (let i = 0; i < SWEEP_SPARK_COUNT && emitted < count; i++) {
    if (!sweepSparkData[i].active) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.5 + Math.random() * 0.15;
      const posArr = sweepSparks.geometry.attributes.position.array;
      const i3 = i * 3;
      posArr[i3] = Math.cos(angle) * radius;
      posArr[i3 + 1] = y;
      posArr[i3 + 2] = Math.sin(angle) * radius;

      // Outward radial velocity + slight upward/downward spray
      const speed = 0.4 + Math.random() * 0.8;
      sweepSparkData[i].vx = Math.cos(angle) * speed;
      sweepSparkData[i].vy = (Math.random() - 0.5) * 0.6;
      sweepSparkData[i].vz = Math.sin(angle) * speed;
      sweepSparkData[i].life = SWEEP_SPARK_LIFE * (0.5 + Math.random() * 0.5);
      sweepSparkData[i].maxLife = sweepSparkData[i].life;
      sweepSparkData[i].active = true;

      sweepSparks.geometry.attributes.aSize.array[i] = 1.0 + Math.random() * 2.5;
      emitted++;
    }
  }
}

function updateSweepSparks(dt) {
  if (!sweepSparks || !sweepSparkData) return;
  const posArr = sweepSparks.geometry.attributes.position.array;
  const alphaArr = sweepSparks.geometry.attributes.aAlpha.array;
  let anyActive = false;

  for (let i = 0; i < SWEEP_SPARK_COUNT; i++) {
    const s = sweepSparkData[i];
    if (!s.active) {
      alphaArr[i] = 0;
      continue;
    }
    s.life -= dt;
    if (s.life <= 0) {
      s.active = false;
      alphaArr[i] = 0;
      continue;
    }
    anyActive = true;
    const i3 = i * 3;
    // Apply velocity with drag
    const drag = 0.96;
    s.vx *= drag;
    s.vy *= drag;
    s.vz *= drag;
    posArr[i3] += s.vx * dt;
    posArr[i3 + 1] += s.vy * dt;
    posArr[i3 + 2] += s.vz * dt;

    // Fade out based on remaining life
    const lifeRatio = s.life / s.maxLife;
    alphaArr[i] = lifeRatio * lifeRatio * 0.9;
  }

  sweepSparks.geometry.attributes.position.needsUpdate = true;
  sweepSparks.geometry.attributes.aAlpha.needsUpdate = true;
  sweepSparks.visible = anyActive || (morphState === 'dissolving' || morphState === 'reassembling');
}

(function createSweepLine() {
  // Shared shader factory for sweep rings
  function makeSweepMaterial(baseColor, opacityScale) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(baseColor) },
        uOpacity: { value: 0.0 },
        uTime: { value: 0.0 },
        uOpacityScale: { value: opacityScale },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uTime;
        uniform float uOpacityScale;
        varying vec2 vUv;
        void main() {
          float r = length(vUv - 0.5) * 2.0;
          float glow = smoothstep(1.0, 0.3, r) * smoothstep(0.0, 0.3, r);
          float shimmer = 0.85 + 0.15 * sin(uTime * 12.0 + r * 20.0);
          float alpha = glow * uOpacity * shimmer * uOpacityScale;
          vec3 col = mix(uColor, vec3(1.0, 0.325, 0.576), smoothstep(0.4, 0.9, r) * 0.6);
          gl_FragColor = vec4(col, alpha);
        }
      `
    });
  }

  // Main sweep ring
  const sweepGeo = new THREE.RingGeometry(0.55, 0.62, 64);
  sweepGeo.rotateX(-Math.PI / 2);
  sweepLine = new THREE.Mesh(sweepGeo, makeSweepMaterial('#61F2F2', 1.0));
  sweepLine.name = 'sweepLine';
  sweepLine.visible = false;
  scene.add(sweepLine);

  // Trail ring — slightly larger, fainter, follows behind
  const trailGeo = new THREE.RingGeometry(0.58, 0.66, 64);
  trailGeo.rotateX(-Math.PI / 2);
  sweepTrail = new THREE.Mesh(trailGeo, makeSweepMaterial('#61F2F2', 0.35));
  sweepTrail.name = 'sweepTrail';
  sweepTrail.visible = false;
  scene.add(sweepTrail);
})();

function startDissolve() {
  if (morphState === 'particles' || morphState === 'dissolving') return;
  morphState = 'dissolving';
  morphStartTime = performance.now() / 1000;
  morphProgress = 0;
  sweepSparkLastY = null; // reset spark tracking
  // Show and reset sweep line
  if (sweepLine && moleculePoints && moleculePoints.userData.yMin !== undefined) {
    sweepLineYMin = moleculePoints.userData.yMin;
    sweepLineYMax = moleculePoints.userData.yMin + (moleculePoints.userData.yRange || 2);
    sweepLine.position.y = sweepLineYMin;
    sweepLine.visible = true;
    sweepLine.material.uniforms.uOpacity.value = 0.0;
    sweepTrail.position.y = sweepLineYMin;
    sweepTrail.visible = true;
    sweepTrail.material.uniforms.uOpacity.value = 0.0;
  }
  // Show particle cloud
  if (moleculePoints) moleculePoints.visible = true;
  // Generate explosion midpoint positions
  if (moleculeBasePositions && !moleculeExplosionPositions) {
    const count = moleculeBasePositions.length / 3;
    moleculeExplosionPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const bx = moleculeBasePositions[i3];
      const by = moleculeBasePositions[i3 + 1];
      const bz = moleculeBasePositions[i3 + 2];
      // Radial outward direction from Y-axis
      const radX = bx;
      const radZ = bz;
      const radLen = Math.sqrt(radX * radX + radZ * radZ) || 0.01;
      const burst = 0.3 + Math.random() * 0.5;
      moleculeExplosionPositions[i3] = bx + (radX / radLen) * burst + (Math.random() - 0.5) * 0.2;
      moleculeExplosionPositions[i3 + 1] = by + (Math.random() - 0.3) * 0.4;
      moleculeExplosionPositions[i3 + 2] = bz + (radZ / radLen) * burst + (Math.random() - 0.5) * 0.2;
    }
  }
  // Initialize current positions to mesh surface (solid)
  if (moleculeCurrentPositions && moleculeBasePositions) {
    for (let i = 0; i < moleculeBasePositions.length; i++) {
      moleculeCurrentPositions[i] = moleculeBasePositions[i];
    }
    moleculePoints.geometry.attributes.position.needsUpdate = true;
  }
}

function startReassemble() {
  if (morphState === 'solid' || morphState === 'reassembling') return;
  morphState = 'reassembling';
  morphStartTime = performance.now() / 1000;
  morphProgress = 1;
  sweepSparkLastY = null; // reset spark tracking
  // Show and reset sweep line (starts at head, sweeps down to feet)
  if (sweepLine && moleculePoints && moleculePoints.userData.yMin !== undefined) {
    sweepLineYMin = moleculePoints.userData.yMin;
    sweepLineYMax = moleculePoints.userData.yMin + (moleculePoints.userData.yRange || 2);
    sweepLine.position.y = sweepLineYMax;
    sweepLine.visible = true;
    sweepLine.material.uniforms.uOpacity.value = 0.0;
    sweepTrail.position.y = sweepLineYMax;
    sweepTrail.visible = true;
    sweepTrail.material.uniforms.uOpacity.value = 0.0;
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function sampleModelSurface(model) {
  // Collect all meshes
  const meshes = [];
  model.traverse((child) => {
    if (child.isMesh && child.geometry) {
      meshes.push(child);
    }
  });
  if (meshes.length === 0) return;

  // Calculate total surface area for proportional sampling
  const areas = [];
  let totalArea = 0;
  meshes.forEach((mesh) => {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    let area = 0;
    const idx = geo.index;
    const triCount = idx ? idx.count / 3 : pos.count / 3;
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
    for (let i = 0; i < triCount; i++) {
      const a = idx ? idx.getX(i * 3) : i * 3;
      const b = idx ? idx.getX(i * 3 + 1) : i * 3 + 1;
      const c = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
      vA.fromBufferAttribute(pos, a);
      vB.fromBufferAttribute(pos, b);
      vC.fromBufferAttribute(pos, c);
      // Apply mesh world transform
      vA.applyMatrix4(mesh.matrixWorld);
      vB.applyMatrix4(mesh.matrixWorld);
      vC.applyMatrix4(mesh.matrixWorld);
      const ab = new THREE.Vector3().subVectors(vB, vA);
      const ac = new THREE.Vector3().subVectors(vC, vA);
      area += ab.cross(ac).length() * 0.5;
    }
    areas.push(area);
    totalArea += area;
  });

  // Sample points from each mesh proportionally
  const basePos = new Float32Array(MOLECULE_COUNT * 3);
  const colors = new Float32Array(MOLECULE_COUNT * 3);
  const offsets = new Float32Array(MOLECULE_COUNT * 3);
  let sampleIdx = 0;

  const tempPos = new THREE.Vector3();
  const tempNormal = new THREE.Vector3();
  const tempColor = new THREE.Color();

  meshes.forEach((mesh, mi) => {
    const samplesForMesh = Math.round((areas[mi] / totalArea) * MOLECULE_COUNT);
    if (samplesForMesh === 0) return;

    // Build sampler
    const sampler = new MeshSurfaceSampler(mesh).setWeightAttribute(null).build();

    // Get material color/map info
    const mat = mesh.material;
    const map = mat.map;
    let canvas2d = null, ctx2d = null, imgData = null, texW = 0, texH = 0;

    if (map && map.image) {
      try {
        const img = map.image;
        texW = img.width || img.naturalWidth || 256;
        texH = img.height || img.naturalHeight || 256;
        canvas2d = document.createElement('canvas');
        canvas2d.width = texW;
        canvas2d.height = texH;
        ctx2d = canvas2d.getContext('2d');
        ctx2d.drawImage(img, 0, 0, texW, texH);
        imgData = ctx2d.getImageData(0, 0, texW, texH).data;
      } catch (e) {
        imgData = null;
      }
    }

    const geo = mesh.geometry;
    const hasUv = !!geo.attributes.uv;
    const tempUv = new THREE.Vector2();

    for (let i = 0; i < samplesForMesh && sampleIdx < MOLECULE_COUNT; i++) {
      sampler.sample(tempPos, tempNormal);

      // Transform to world space
      tempPos.applyMatrix4(mesh.matrixWorld);

      basePos[sampleIdx * 3] = tempPos.x;
      basePos[sampleIdx * 3 + 1] = tempPos.y;
      basePos[sampleIdx * 3 + 2] = tempPos.z;

      // Sample color from texture at this point
      let r = 0.8, g = 0.8, b = 0.8;
      if (imgData && hasUv) {
        // Approximate UV by re-sampling (MeshSurfaceSampler doesn't give UV directly,
        // so we use the face's UV via a secondary sample approach)
        // We'll use a workaround: sample color from the texture using the position-based UV hack
        // Actually, let's use the geometry's UV attribute by finding the nearest vertex
        const posAttr = geo.attributes.position;
        const uvAttr = geo.attributes.uv;
        let minDist = Infinity;
        // Convert tempPos back to local space for vertex matching
        const localPos = tempPos.clone().applyMatrix4(mesh.matrixWorld.clone().invert());
        const vt = new THREE.Vector3();
        for (let v = 0; v < posAttr.count; v++) {
          vt.fromBufferAttribute(posAttr, v);
          const d = vt.distanceToSquared(localPos);
          if (d < minDist) {
            minDist = d;
            tempUv.x = uvAttr.getX(v);
            tempUv.y = uvAttr.getY(v);
          }
        }
        // Sample from texture
        const tx = Math.floor(((tempUv.x % 1) + 1) % 1 * texW);
        const ty = Math.floor((1 - ((tempUv.y % 1) + 1) % 1) * texH);
        const pi = (ty * texW + tx) * 4;
        if (pi >= 0 && pi < imgData.length - 3) {
          r = imgData[pi] / 255;
          g = imgData[pi + 1] / 255;
          b = imgData[pi + 2] / 255;
        }
      } else if (mat.color) {
        r = mat.color.r;
        g = mat.color.g;
        b = mat.color.b;
      }

      colors[sampleIdx * 3] = r;
      colors[sampleIdx * 3 + 1] = g;
      colors[sampleIdx * 3 + 2] = b;

      // Random breathing offsets
      offsets[sampleIdx * 3] = Math.random() * Math.PI * 2;
      offsets[sampleIdx * 3 + 1] = Math.random() * Math.PI * 2;
      offsets[sampleIdx * 3 + 2] = 0.5 + Math.random() * 0.5; // speed variation

      sampleIdx++;
    }
  });

  // Trim if we didn't fill all slots
  const actualCount = sampleIdx;

  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute('position', new THREE.BufferAttribute(basePos.slice(0, actualCount * 3), 3));
  pointGeo.setAttribute('aBaseColor', new THREE.BufferAttribute(colors.slice(0, actualCount * 3), 3));
  pointGeo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(colors.slice(0, actualCount * 3)), 3));
  pointGeo.setAttribute('aOffset', new THREE.BufferAttribute(offsets.slice(0, actualCount * 3), 3));

  const pointMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uPointSize: { value: PARTICLE_SIZE },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute vec3 aBaseColor;
      attribute vec3 aOffset;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uPointSize;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = aColor;
        vAlpha = 1.0;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        float size = uPointSize * uPixelRatio * (300.0 / -mvPos.z);
        gl_PointSize = max(size, 1.5);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        // Soft sphere shading
        float sphere = sqrt(1.0 - d * d);
        vec3 normal = vec3(gl_PointCoord.x - 0.5, 0.5 - gl_PointCoord.y, sphere);
        normal = normalize(normal);
        // Simple lighting
        vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
        float diffuse = max(dot(normal, lightDir), 0.0);
        float ambient = 0.35;
        float spec = pow(max(dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0)), 0.0), 16.0) * 0.3;
        // Emissive glow at edges
        float rim = 1.0 - sphere;
        vec3 glow = vColor * rim * 0.5;
        vec3 finalColor = vColor * (ambient + diffuse * 0.65) + spec + glow;
        float alpha = smoothstep(1.0, 0.85, d) * vAlpha;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `
  });

  const points = new THREE.Points(pointGeo, pointMat);
  points.name = 'moleculeCloud';
  scene.add(points);

  moleculePoints = points;
  moleculeBasePositions = new Float32Array(basePos.slice(0, actualCount * 3));
  moleculeCurrentPositions = pointGeo.attributes.position.array;
  moleculeColors = new Float32Array(colors.slice(0, actualCount * 3));
  moleculeBaseColors = new Float32Array(colors.slice(0, actualCount * 3));
  moleculeOffsets = offsets.slice(0, actualCount * 3);

  // Compute per-particle stagger delays based on Y height (feet first → head last)
  moleculeStaggerDelays = new Float32Array(actualCount);
  let sYMin = Infinity, sYMax = -Infinity;
  for (let i = 0; i < actualCount; i++) {
    const y = moleculeBasePositions[i * 3 + 1];
    if (y < sYMin) sYMin = y;
    if (y > sYMax) sYMax = y;
  }
  const sYRange = sYMax - sYMin || 1;
  for (let i = 0; i < actualCount; i++) {
    const heightNorm = (moleculeBasePositions[i * 3 + 1] - sYMin) / sYRange; // 0=feet, 1=head
    // Add small random jitter so particles at same height don't all move identically
    moleculeStaggerDelays[i] = heightNorm * STAGGER_SPREAD + (Math.random() * 0.05);
  }

  return actualCount;
}

// Shadow catcher (invisible ground that only shows shadows)
const groundGeo = new THREE.PlaneGeometry(20, 20);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.4 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 0.7, 0);
controls.autoRotate = true;
controls.autoRotateSpeed = 2;
controls.update();

// Loading indicator with spinner
const loadingDiv = document.createElement('div');
loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:white;font-family:system-ui;font-size:14px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px;';
loadingDiv.innerHTML = `
  <div style="width:32px;height:32px;border:2px solid rgba(255,255,255,0.15);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
  <div id="load-text">Loading 3D model...</div>
  <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
`;
document.body.appendChild(loadingDiv);
const loadText = loadingDiv.querySelector('#load-text');

// Load GLB/GLTF model (with Draco decompression support)
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
dracoLoader.preload();
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
const modelData = window.UPLOADED_3D_MODELS?.find(m => m.name === 'Meshy_AI_blink_0324224626_texture.glb');
const modelUrl = modelData ? modelData.dataUrl : '';
loader.load(
  modelUrl,
  (gltf) => {
    const model = gltf.scene;
    
    // Center and scale model
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const scaleFactor = 2 / maxDim;
    model.scale.multiplyScalar(scaleFactor);
    
    // Recompute after scaling
    box.setFromObject(model);
    box.getCenter(center);
    model.position.sub(center);
    model.position.y += size.y * scaleFactor / 2;
    
    // Ensure all texture images are loaded before sampling
    const texturePromises = [];
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material && child.material.map) {
          const tex = child.material.map;
          if (tex.image && tex.image.complete === false) {
            texturePromises.push(new Promise((resolve) => {
              tex.image.addEventListener('load', resolve);
              setTimeout(resolve, 2000); // fallback timeout
            }));
          }
        }
      }
    });
    
    // Add model temporarily to sample, then hide solid mesh
    scene.add(model);
    model.updateMatrixWorld(true);
    
    // Wait for textures then sample
    Promise.all(texturePromises).then(() => {
      const actualCount = sampleModelSurface(model);
      console.log(`Sampled ${actualCount} molecular particles from model`);
      
          // Keep solid model VISIBLE by default — particles hidden until mic activates
      if (moleculePoints) moleculePoints.visible = false;
      solidModel = model;
    });
    
    // Fade-in animation over 800ms (text + point cloud synced)
    const fadeStart = performance.now();
    const fadeDuration = 800;
    const textDelay = 200;
    const textDuration = 600;
    function fadeIn() {
      const elapsed = performance.now() - fadeStart;
      const t = Math.min(elapsed / fadeDuration, 1.0);
      const eased = t * (2 - t);

      // Fade point cloud opacity
      if (moleculePoints) {
        moleculePoints.material.uniforms.uPointSize.value = PARTICLE_SIZE * eased;
        moleculePoints.material.opacity = eased;
      }

      // Text fade-in + slide-up
      const textElapsed = Math.max(0, elapsed - textDelay);
      const textT = Math.min(textElapsed / textDuration, 1.0);
      const textEased = 1 - Math.pow(1 - textT, 3);
      const slideOffset = 30 * (1 - textEased);
      textOverlay.style.color = `rgba(255,255,255,${textEased})`;
      textOverlay.style.transform = `translateX(-50%) translateY(${slideOffset}px)`;

      if (t < 1.0 || textT < 1.0) requestAnimationFrame(fadeIn);
    }
    requestAnimationFrame(fadeIn);
    controls.target.set(0, size.y * scaleFactor / 2, 0);
    controls.update();
    
    loadingDiv.remove();
  },
  (progress) => {
    if (progress.total > 0) {
      const pct = Math.round((progress.loaded / progress.total) * 100);
      loadText.textContent = 'Loading 3D model... ' + pct + '%';
    } else if (progress.loaded > 0) {
      const mb = (progress.loaded / 1024 / 1024).toFixed(1);
      loadText.textContent = 'Downloading... ' + mb + ' MB';
    }
  },
  (error) => {
    console.error('Error loading model:', error);
    loadingDiv.innerHTML = 'Failed to load model';
  }
);

// Animation loop
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();
  controls.update();

  // Update dither time for grain animation
  ditherPass.uniforms.uTime.value = elapsed;

  // Pulsing text glow synced with audio
  if (textGlowActive && micActive) {
    const glowIntensity = 8 + smoothVolume * 80;
    const pulseGlow = 0.7 + smoothVolume * 4;
    textOverlay.style.textShadow = `0 0 ${glowIntensity}px rgba(255,83,147,${Math.min(pulseGlow, 1)}), 0 0 ${glowIntensity * 2}px rgba(255,83,147,0.3), 0 2px 6px rgba(0,0,0,0.5)`;
    // Pulse the live dot size in sync with volume
    const dotScale = 1 + smoothVolume * 3;
    liveDot.style.transform = `scale(${dotScale})`;
  } else {
    textOverlay.style.textShadow = '0 2px 6px rgba(0,0,0,0.5),0 0 30px rgba(0,0,0,0.3),0 0 60px rgba(0,0,0,0.15)';
  }

  // Animate ambient dust
  dustMat.uniforms.uTime.value = elapsed;
  const dPos = dustGeo.attributes.position;
  for (let i = 0; i < dustCount; i++) {
    let x = dPos.getX(i) + dustVelocities[i * 3] + Math.sin(elapsed * 0.3 + i) * 0.001;
    let y = dPos.getY(i) + dustVelocities[i * 3 + 1];
    let z = dPos.getZ(i) + dustVelocities[i * 3 + 2] + Math.cos(elapsed * 0.2 + i) * 0.001;
    if (y > 5) { y = -1; x = (Math.random() - 0.5) * 10; z = (Math.random() - 0.5) * 10; }
    if (Math.abs(x) > 5) x *= -0.9;
    if (Math.abs(z) > 5) z *= -0.9;
    dPos.setXYZ(i, x, y, z);
  }
  dPos.needsUpdate = true;

  // Update audio analysis
  updateAudioData();

  // ── Morph transition logic ──
  const now = performance.now() / 1000;
  if (morphState === 'dissolving') {
    const rawT = Math.min((now - morphStartTime) / MORPH_DURATION, 1.0);
    morphProgress = easeInOutCubic(rawT);
    // Fade solid model opacity
    if (solidModel) {
      solidModel.traverse((child) => {
        if (child.isMesh) {
          child.visible = true;
          if (!child.material._origOpacity) child.material._origOpacity = child.material.opacity ?? 1;
          child.material.transparent = true;
          child.material.opacity = child.material._origOpacity * (1.0 - morphProgress);
          child.material.needsUpdate = true;
        }
      });
    }
    // Scale particle point size with morph
    if (moleculePoints) {
      moleculePoints.material.uniforms.uPointSize.value = PARTICLE_SIZE * morphProgress;
    }
    // Sweep line tracks the wave front — synced to particle stagger curve (feet → head)
    if (sweepLine) {
      // The particles use eased morphProgress with per-particle stagger delays.
      // The wave front is where particles are just starting to transition:
      // a particle transitions when morphProgress >= its staggerDelay.
      // So the "leading edge" height = morphProgress mapped back to height via STAGGER_SPREAD.
      const waveFrontNorm = Math.min(morphProgress / STAGGER_SPREAD, 1.0);
      const sweepY = sweepLineYMin + waveFrontNorm * (sweepLineYMax - sweepLineYMin);
      sweepLine.position.y = sweepY;
      const fadeIn = smoothstep(0, 0.08, rawT);
      const fadeOut = smoothstep(1.0, 0.85, rawT);
      sweepLine.material.uniforms.uOpacity.value = fadeIn * fadeOut * 0.9;
      sweepLine.material.uniforms.uTime.value = elapsed;
      // Trail ring follows behind — same curve but lagged
      const trailMorph = Math.max(0, morphProgress - TRAIL_LAG);
      const trailFrontNorm = Math.min(trailMorph / STAGGER_SPREAD, 1.0);
      const trailY = sweepLineYMin + trailFrontNorm * (sweepLineYMax - sweepLineYMin);
      sweepTrail.position.y = trailY;
      const trailFadeIn = smoothstep(0, 0.12, rawT);
      const trailFadeOut = smoothstep(1.0, 0.8, rawT);
      sweepTrail.material.uniforms.uOpacity.value = trailFadeIn * trailFadeOut * 0.9;
      sweepTrail.material.uniforms.uTime.value = elapsed;
    }
    // Emit sparks from sweep ring when it moves
    if (sweepLine && sweepLine.visible) {
      const currentSweepY = sweepLine.position.y;
      if (sweepSparkLastY !== null) {
        const delta = Math.abs(currentSweepY - sweepSparkLastY);
        if (delta > 0.005) {
          emitSweepSparks(currentSweepY, Math.ceil(delta * 80) + 2);
        }
      }
      sweepSparkLastY = currentSweepY;
    }
    if (rawT >= 1.0) {
      morphState = 'particles';
      morphProgress = 1;
      sweepSparkLastY = null;
      if (solidModel) solidModel.traverse((child) => { if (child.isMesh) child.visible = false; });
      if (sweepLine) { sweepLine.visible = false; sweepLine.material.uniforms.uOpacity.value = 0; }
      if (sweepTrail) { sweepTrail.visible = false; sweepTrail.material.uniforms.uOpacity.value = 0; }
    }
  } else if (morphState === 'reassembling') {
    const rawT = Math.min((now - morphStartTime) / MORPH_DURATION, 1.0);
    morphProgress = 1.0 - easeInOutCubic(rawT);
    // Fade solid model back in
    if (solidModel) {
      solidModel.traverse((child) => {
        if (child.isMesh) {
          child.visible = true;
          child.material.transparent = true;
          child.material.opacity = (child.material._origOpacity || 1) * (1.0 - morphProgress);
          child.material.needsUpdate = true;
        }
      });
    }
    // Shrink particles
    if (moleculePoints) {
      moleculePoints.material.uniforms.uPointSize.value = PARTICLE_SIZE * morphProgress;
    }
    // Sweep line tracks the wave front — synced to particle stagger curve (head → feet)
    if (sweepLine) {
      // During reassemble, morphProgress goes 1→0. Particles reassemble when
      // morphProgress drops below their staggerDelay. The wave front sweeps
      // from head (high stagger) down to feet (low stagger).
      // Leading edge height = (1 - morphProgress) mapped via STAGGER_SPREAD
      const reassembleNorm = Math.min((1.0 - morphProgress) / STAGGER_SPREAD, 1.0);
      const sweepY = sweepLineYMax - reassembleNorm * (sweepLineYMax - sweepLineYMin);
      sweepLine.position.y = sweepY;
      const fadeIn = smoothstep(0, 0.08, rawT);
      const fadeOut = smoothstep(1.0, 0.85, rawT);
      sweepLine.material.uniforms.uOpacity.value = fadeIn * fadeOut * 0.9;
      sweepLine.material.uniforms.uTime.value = elapsed;
      // Trail ring follows behind (above the main ring during reassemble)
      const trailReassemble = Math.max(0, (1.0 - morphProgress) - TRAIL_LAG);
      const trailNorm = Math.min(trailReassemble / STAGGER_SPREAD, 1.0);
      const trailY = sweepLineYMax - trailNorm * (sweepLineYMax - sweepLineYMin);
      sweepTrail.position.y = trailY;
      const trailFadeIn = smoothstep(0, 0.12, rawT);
      const trailFadeOut = smoothstep(1.0, 0.8, rawT);
      sweepTrail.material.uniforms.uOpacity.value = trailFadeIn * trailFadeOut * 0.9;
      sweepTrail.material.uniforms.uTime.value = elapsed;
    }
    // Emit sparks from sweep ring when it moves (reassemble direction)
    if (sweepLine && sweepLine.visible) {
      const currentSweepY = sweepLine.position.y;
      if (sweepSparkLastY !== null) {
        const delta = Math.abs(currentSweepY - sweepSparkLastY);
        if (delta > 0.005) {
          emitSweepSparks(currentSweepY, Math.ceil(delta * 80) + 2);
        }
      }
      sweepSparkLastY = currentSweepY;
    }
    if (rawT >= 1.0) {
      morphState = 'solid';
      morphProgress = 0;
      sweepSparkLastY = null;
      if (moleculePoints) moleculePoints.visible = false;
      if (sweepLine) { sweepLine.visible = false; sweepLine.material.uniforms.uOpacity.value = 0; }
      if (sweepTrail) { sweepTrail.visible = false; sweepTrail.material.uniforms.uOpacity.value = 0; }
      // Restore solid model fully
      if (solidModel) {
        solidModel.traverse((child) => {
          if (child.isMesh) {
            child.visible = true;
            child.material.opacity = child.material._origOpacity || 1;
            child.material.transparent = child.material.opacity < 1;
            child.material.needsUpdate = true;
          }
        });
      }
    }
  }

  // Animate molecular point cloud — breathing + mouse repulsion + audio reactivity
  if (moleculePoints && moleculePoints.visible && moleculeBasePositions) {
    moleculePoints.material.uniforms.uTime.value = elapsed;

    // Project mouse into 3D world space for repulsion
    raycaster.setFromCamera(mouse, camera);
    const ray = raycaster.ray;

    // Compute model Y bounds for frequency mapping
    const count = moleculeBasePositions.length / 3;
    const posArr = moleculeCurrentPositions;
    const baseArr = moleculeBasePositions;
    const offArr = moleculeOffsets;
    const tempV = new THREE.Vector3();
    const closestPt = new THREE.Vector3();

    // Cache Y min/max (computed once)
    if (!moleculePoints.userData.yMin) {
      let yMin = Infinity, yMax = -Infinity;
      for (let i = 0; i < count; i++) {
        const y = baseArr[i * 3 + 1];
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
      moleculePoints.userData.yMin = yMin;
      moleculePoints.userData.yMax = yMax;
      moleculePoints.userData.yRange = yMax - yMin || 1;
    }
    const yMin = moleculePoints.userData.yMin;
    const yRange = moleculePoints.userData.yRange;

    // Audio-driven pulse scale for the whole system
    const pulseScale = 1.0 + smoothVolume * PULSE_SCALE_AMOUNT * 8.0;

    // During dissolve/reassemble, particles transition through explosion midpoints
    const isTransitioning = (morphState === 'dissolving' || morphState === 'reassembling');

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const ox = offArr[i3];
      const oy = offArr[i3 + 1];
      const speedVar = offArr[i3 + 2];

      if (isTransitioning && moleculeExplosionPositions) {
        // Per-particle staggered transition: feet start first, wave ripples to head
        const delay = moleculeStaggerDelays ? moleculeStaggerDelays[i] : 0;
        // Remap morphProgress per particle: each particle has its own effective progress
        // that starts after its delay and completes within the remaining window
        const window = 1.0 - STAGGER_SPREAD;
        const localProgress = Math.max(0, Math.min((morphProgress - delay) / window, 1.0));

        const burstEnd = 0.4;
        let tx, ty, tz;
        if (localProgress < burstEnd) {
          // Lerp from mesh surface to explosion position
          const t = localProgress / burstEnd;
          const et = t * t; // ease-in for burst
          tx = baseArr[i3] + (moleculeExplosionPositions[i3] - baseArr[i3]) * et;
          ty = baseArr[i3 + 1] + (moleculeExplosionPositions[i3 + 1] - baseArr[i3 + 1]) * et;
          tz = baseArr[i3 + 2] + (moleculeExplosionPositions[i3 + 2] - baseArr[i3 + 2]) * et;
        } else {
          // Lerp from explosion position to settled (base + breathing)
          const t = (localProgress - burstEnd) / (1.0 - burstEnd);
          const et = 1 - (1 - t) * (1 - t); // ease-out for settle
          const breathX = Math.sin(elapsed * BREATHE_SPEED * speedVar + ox) * BREATHE_AMPLITUDE;
          const breathY = Math.sin(elapsed * BREATHE_SPEED * speedVar * 0.8 + oy) * BREATHE_AMPLITUDE;
          const breathZ = Math.cos(elapsed * BREATHE_SPEED * speedVar * 0.6 + ox + oy) * BREATHE_AMPLITUDE;
          const settledX = baseArr[i3] + breathX;
          const settledY = baseArr[i3 + 1] + breathY;
          const settledZ = baseArr[i3 + 2] + breathZ;
          tx = moleculeExplosionPositions[i3] + (settledX - moleculeExplosionPositions[i3]) * et;
          ty = moleculeExplosionPositions[i3 + 1] + (settledY - moleculeExplosionPositions[i3 + 1]) * et;
          tz = moleculeExplosionPositions[i3 + 2] + (settledZ - moleculeExplosionPositions[i3 + 2]) * et;
        }
        // Snap directly during transition (no smoothing lag)
        posArr[i3] = tx;
        posArr[i3 + 1] = ty;
        posArr[i3 + 2] = tz;
      } else if (morphState === 'particles') {
        // Full particle mode — breathing + audio + mouse repulsion
        const breathX = Math.sin(elapsed * BREATHE_SPEED * speedVar + ox) * BREATHE_AMPLITUDE;
        const breathY = Math.sin(elapsed * BREATHE_SPEED * speedVar * 0.8 + oy) * BREATHE_AMPLITUDE;
        const breathZ = Math.cos(elapsed * BREATHE_SPEED * speedVar * 0.6 + ox + oy) * BREATHE_AMPLITUDE;

        let tx = baseArr[i3] + breathX;
        let ty = baseArr[i3 + 1] + breathY;
        let tz = baseArr[i3 + 2] + breathZ;

        // Audio reactivity
        if (micActive && smoothVolume > 0.005) {
          const heightNorm = (baseArr[i3 + 1] - yMin) / yRange;
          let freqInfluence;
          if (heightNorm < 0.33) {
            freqInfluence = smoothBass * (1.0 - heightNorm / 0.33) + smoothMid * (heightNorm / 0.33);
          } else if (heightNorm < 0.66) {
            const t = (heightNorm - 0.33) / 0.33;
            freqInfluence = smoothMid * (1.0 - t) + smoothTreble * t;
          } else {
            freqInfluence = smoothTreble;
          }

          const dirX = baseArr[i3];
          const dirZ = baseArr[i3 + 2];
          const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ) || 0.001;
          const nDirX = dirX / dirLen;
          const nDirZ = dirZ / dirLen;
          const upPush = heightNorm > 0.5 ? smoothTreble * MIC_EXPAND_STRENGTH * 0.5 : 0;
          const expand = freqInfluence * MIC_EXPAND_STRENGTH * (1.0 + smoothVolume * 3.0);
          tx += nDirX * expand;
          ty += upPush;
          tz += nDirZ * expand;

          const jitter = smoothVolume * 0.015;
          tx += Math.sin(elapsed * 17.3 + ox * 5.0) * jitter;
          ty += Math.cos(elapsed * 13.7 + oy * 5.0) * jitter;
          tz += Math.sin(elapsed * 19.1 + ox * 3.0 + oy * 7.0) * jitter;
        }

        // Mouse repulsion
        tempV.set(baseArr[i3], baseArr[i3 + 1], baseArr[i3 + 2]);
        ray.closestPointToPoint(tempV, closestPt);
        const dx = tempV.x - closestPt.x;
        const dy = tempV.y - closestPt.y;
        const dz = tempV.z - closestPt.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < REPEL_RADIUS && dist > 0.001) {
          const force = (1.0 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
          const invDist = 1.0 / dist;
          tx += dx * invDist * force;
          ty += dy * invDist * force;
          tz += dz * invDist * force;
        }

        // Audio pulse scale
        if (micActive && smoothVolume > 0.005) {
          const centerY = yMin + yRange * 0.5;
          tx = tx * pulseScale;
          ty = centerY + (ty - centerY) * pulseScale;
          tz = tz * pulseScale;
        }

        const returnRate = micActive ? RETURN_SPEED * 2.5 : RETURN_SPEED;
        posArr[i3] += (tx - posArr[i3]) * returnRate;
        posArr[i3 + 1] += (ty - posArr[i3 + 1]) * returnRate;
        posArr[i3 + 2] += (tz - posArr[i3 + 2]) * returnRate;
      }
    }
    moleculePoints.geometry.attributes.position.needsUpdate = true;

    // Update sweep sparks
    updateSweepSparks(clock.getDelta() || 0.016);

    // Audio-reactive color shift: magenta at high volume, cyan during silence
    if (moleculeBaseColors && morphState === 'particles') {
      const colorArr = moleculePoints.geometry.attributes.aColor.array;
      const magR = 1.0, magG = 0.325, magB = 0.576;
      const cyaR = 0.38, cyaG = 0.949, cyaB = 0.949;
      const audioIntensity = micActive ? Math.min(smoothVolume * 6.0, 1.0) : 0.0;
      const silenceTint = micActive && smoothVolume < 0.02 ? 0.15 : 0.0;
      const tintStrength = Math.max(audioIntensity * 0.55, silenceTint);

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const baseR = moleculeBaseColors[i3];
        const baseG = moleculeBaseColors[i3 + 1];
        const baseB = moleculeBaseColors[i3 + 2];
        const tintR = cyaR + (magR - cyaR) * audioIntensity;
        const tintG = cyaG + (magG - cyaG) * audioIntensity;
        const tintB = cyaB + (magB - cyaB) * audioIntensity;
        colorArr[i3]     += (baseR + (tintR - baseR) * tintStrength - colorArr[i3]) * 0.08;
        colorArr[i3 + 1] += (baseG + (tintG - baseG) * tintStrength - colorArr[i3 + 1]) * 0.08;
        colorArr[i3 + 2] += (baseB + (tintB - baseB) * tintStrength - colorArr[i3 + 2]) * 0.08;
      }
      moleculePoints.geometry.attributes.aColor.needsUpdate = true;
    }
  }

  // Update sparks even when not in transition (so existing sparks fade out)
  if (morphState !== 'dissolving' && morphState !== 'reassembling') {
    updateSweepSparks(0.016);
  }

  // Helper for sweep line fade curves
  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min((x - edge0) / (edge1 - edge0), 1.0));
    return t * t * (3 - 2 * t);
  }

  composer.render();
}
animate();

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.resolution.set(window.innerWidth, window.innerHeight);
  ditherPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
});