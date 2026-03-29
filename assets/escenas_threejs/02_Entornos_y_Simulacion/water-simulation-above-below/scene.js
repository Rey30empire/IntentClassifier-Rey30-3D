// Ocean Water Simulation with FFT, Gerstner Waves, Foam, and Buoyancy
// Complete Three.js implementation
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const CONFIG = {
  water: {
    size: 512,
    segments: 256,
    depth: 50,
    color: new THREE.Color(0x006994),
    opacity: 0.85,
  },
  fft: {
    resolution: 128,
    windSpeed: 12,
    windDirection: Math.PI / 4,
    amplitude: 1.0,
    choppiness: 1.5,
  },
  gerstner: {
    waves: [
      { amplitude: 1.2, wavelength: 40, speed: 1.0, direction: new THREE.Vector2(1, 0.3), steepness: 0.4 },
      { amplitude: 0.8, wavelength: 25, speed: 0.8, direction: new THREE.Vector2(0.7, 0.7), steepness: 0.35 },
      { amplitude: 0.5, wavelength: 15, speed: 1.2, direction: new THREE.Vector2(-0.3, 1), steepness: 0.3 },
      { amplitude: 0.3, wavelength: 8, speed: 1.5, direction: new THREE.Vector2(0.5, -0.5), steepness: 0.25 },
    ],
    enabled: true,
    scale: 1.0,
  },
  // ============================================================
  // ARC WAVES (surfable swells)
  //
  // These simulate long-crested ocean swells that originate from
  // a distant storm or point source. The wavefronts are circular
  // arcs that expand outward from an origin, creating the large
  // rolling swells that surfers ride.
  //
  // Key parameters:
  //   origin: XZ position of the virtual storm center. Waves
  //           radiate outward from here as expanding circles.
  //   count: Number of arc wave layers (different wavelengths
  //          give realistic multi-frequency swell packets).
  //   amplitude: Base height of the tallest arc swell.
  //   wavelength: Distance between arc crests (100-300m typical).
  //   speed: Phase speed of the swell propagation.
  //   steepness: Gerstner steepness for the arc wave shape.
  //              Higher values → more peaked, surfable crests.
  //   spread: Angular spread (radians). 0 = perfectly circular
  //           arcs, π = nearly planar wave fronts.
  //   enabled: Master toggle for the arc wave system.
  // ============================================================
  arcWaves: {
    enabled: true,
    origin: new THREE.Vector2(-300, -200),  // distant storm center
    amplitude: 1.8,
    wavelength: 120,
    speed: 1.2,
    steepness: 0.35,
    spread: 1.2,         // angular spread in radians
    count: 3,            // number of arc swell layers
    scale: 1.0,
  },
  foam: {
    whitecap: { threshold: 0.6, intensity: 1.0, scale: 8.0, speed: 0.5, enabled: true },
    ambient: { density: 0.3, scale: 15.0, speed: 0.2, opacity: 0.4, enabled: true },
    shoreline: { distance: 10.0, intensity: 1.0, scale: 5.0, width: 3.0, enabled: true },
  },
  underwater: {
    fogDensity: 0.04,
    fogColor: new THREE.Color(0x0a3d5c),
    distortionAmount: 0.02,
    distortionSpeed: 1.0,
    causticsScale: 8.0,
    causticsSpeed: 1.0,
    causticsIntensity: 0.5,
  },
  sun: {
    // Spherical coordinates for the sun position.
    // Azimuth: horizontal angle in radians (0 = +X, π/2 = +Z, etc.)
    // Elevation: angle above the horizon in radians (0 = horizon, π/2 = zenith)
    // Distance: how far the directional light source is (cosmetic; only direction matters for shading)
    azimuth: 0.38,       // ~22° — slightly off to the side
    elevation: 0.37,     // ~21° above horizon — low golden-hour sun
    distance: 230,       // distance of the directional light from origin
    intensity: 2.2,      // directional light intensity
    color: new THREE.Color(0xffaa55),  // warm sunset colour
  },
  rendering: {
    // Toon mode removed — realistic only
  },
  buoyancy: {
    gravity: 9.81,
    waterDensity: 1025,
    drag: 3.5,
    angularDrag: 4.0,
  },
};

// ============================================================
// SUN POSITION HELPER
// ============================================================
// Converts spherical sun coordinates (azimuth + elevation) to
// a Cartesian direction vector and world-space position.
//
// Azimuth (θ): horizontal angle from +X axis, CCW when viewed from above.
//   0     → sun along +X
//   π/2   → sun along +Z
//   π     → sun along -X
//
// Elevation (φ): angle above the horizon.
//   0     → sun at horizon
//   π/2   → sun at zenith (straight up)
//
// The returned position = direction * distance, used for the
// DirectionalLight source. The normalised direction is what
// shaders use for dot(N, L) lighting calculations.
// ============================================================
function getSunPosition() {
  const az = CONFIG.sun.azimuth;
  const el = CONFIG.sun.elevation;
  const dist = CONFIG.sun.distance;

  // Spherical → Cartesian:
  //   x = cos(elevation) * cos(azimuth)
  //   y = sin(elevation)              — height above horizon
  //   z = cos(elevation) * sin(azimuth)
  const x = Math.cos(el) * Math.cos(az) * dist;
  const y = Math.sin(el) * dist;
  const z = Math.cos(el) * Math.sin(az) * dist;

  return new THREE.Vector3(x, y, z);
}

function getSunDirection() {
  return getSunPosition().normalize();
}

// Propagate sun position/direction/colour/intensity to all objects
// that reference the sun: directional light, sky dome, water shader,
// ocean floor shader, and post-processing.
function updateSunEverywhere() {
  const sunPos = getSunPosition();
  const sunDir = getSunDirection();
  const sunColor = CONFIG.sun.color;
  const sunIntensity = CONFIG.sun.intensity;

  // ---- Directional light (the actual shadow-casting sun) ----
  const sunLight = scene.getObjectByName('sunLight');
  if (sunLight) {
    sunLight.position.copy(sunPos);
    sunLight.color.copy(sunColor);
    sunLight.intensity = sunIntensity;
  }

  // ---- Sky dome: update sun direction and elevation for palette blend ----
  const skyDome = scene.getObjectByName('skyDome');
  if (skyDome && skyDome.material.uniforms) {
    skyDome.material.uniforms.uSunDirection.value.copy(sunDir);
    skyDome.material.uniforms.uSunElevation.value = CONFIG.sun.elevation / (Math.PI * 0.5);
  }

  // ---- Water shader: sun direction for specular, SSS, and foam tinting ----
  if (waterMesh && waterMesh.material.uniforms) {
    waterMesh.material.uniforms.uSunDirection.value.copy(sunDir);
    waterMesh.material.uniforms.uSunColor.value.copy(sunColor);
  }

  // ---- Ocean floor: light direction for diffuse shading ----
  if (oceanFloor && oceanFloor.material.uniforms) {
    oceanFloor.material.uniforms.uLightDir.value.copy(sunDir);
  }

  // ---- Update scene background & fog tones based on sun elevation ----
  // As the sun gets higher, the sky brightens from deep sunset to daylight.
  // As it drops lower, everything gets more orange/red.
  const elNorm = CONFIG.sun.elevation / (Math.PI * 0.5); // 0 = horizon, 1 = zenith
  // Interpolate background colour: deep sunset (el≈0) → brighter sky (el≈1)
  const bgLow = new THREE.Color(0x1a0a10);   // deep sunset horizon
  const bgHigh = new THREE.Color(0x4a6080);   // daylight-ish
  if (!isUnderwater) {
    scene.background = new THREE.Color().lerpColors(bgLow, bgHigh, elNorm);
    scene.fog = new THREE.FogExp2(
      new THREE.Color().lerpColors(new THREE.Color(0x2a1018), new THREE.Color(0x607890), elNorm).getHex(),
      0.0008
    );
  }
}

// ============================================================
// GLOBALS
// ============================================================
let renderer, scene, camera, controls;
let waterMesh, oceanFloor;
let clock = new THREE.Clock();
let isUnderwater = false;
let boat;
let boatPhysics;
let gui;
let depthRenderTarget, depthMaterial;
let underwaterPostProcessing;
let reflectionRenderTarget, reflectionCamera;
// Total Internal Reflection: render target for the vertically-flipped
// underwater scene used outside the Snell's window
let tirRenderTarget;

// FFT data
let fftData = {
  spectrum: null,
  heightMap: null,
  normalMap: null,
};

// ============================================================
// INIT
// ============================================================
function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.appendChild(renderer.domElement);

  // Scene — warm sunset tones for background / fog
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1520);
  scene.fog = new THREE.FogExp2(0x4a2530, 0.0008);

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(30, 15, 30);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI * 0.95;
  controls.target.set(0, 0, 0);

  // Depth render target for water masking and shore foam
  depthRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  });

  setupLighting();
  createSkyDome();
  createOceanFloor();
  createWater();
  createBoat();
  initFFT();
  setupReflection();
  createUI();
  setupPostProcessing();

  window.addEventListener('resize', onResize);
  animate();
}

// ============================================================
// LIGHTING
// ============================================================
function setupLighting() {
  // ---- Ambient: warm fill reflecting sunset sky bounce ----
  const ambientLight = new THREE.AmbientLight(0x3a2a40, 0.5);
  ambientLight.name = 'ambientLight';
  scene.add(ambientLight);

  // ---- Sun: position derived from CONFIG.sun spherical coords ----
  // The helper getSunPosition() converts azimuth + elevation to XYZ.
  const sunPos = getSunPosition();
  const sunLight = new THREE.DirectionalLight(CONFIG.sun.color, CONFIG.sun.intensity);
  sunLight.name = 'sunLight';
  sunLight.position.copy(sunPos);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -100;
  sunLight.shadow.camera.right = 100;
  sunLight.shadow.camera.top = 100;
  sunLight.shadow.camera.bottom = -100;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 400;
  sunLight.shadow.bias = -0.001;
  sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight);

  // ---- Hemisphere: sunset sky (warm top) / deep water bounce (cool bottom) ----
  const hemisphereLight = new THREE.HemisphereLight(0xffcc88, 0x002244, 0.35);
  hemisphereLight.name = 'hemisphereLight';
  scene.add(hemisphereLight);

  // ---- Subtle backlight to rim-light the boat from behind ----
  const backLight = new THREE.DirectionalLight(0xff6633, 0.4);
  backLight.name = 'backLight';
  backLight.position.set(-100, 20, -60);
  scene.add(backLight);
}

// ============================================================
// SKY DOME
// ============================================================
function createSkyDome() {
  // ---- Sunset sky dome ----
  // Uses a multi-stop gradient from deep blue zenith through
  // warm oranges/pinks at the horizon, with a large sun disc
  // and atmospheric Mie scattering halo near the horizon.
  const skyGeo = new THREE.SphereGeometry(800, 32, 32);

  // Sun direction: computed from CONFIG.sun spherical coordinates
  const sunDir = getSunDirection();

  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uSunDirection: { value: sunDir },
      // Sun elevation normalized: 0 = horizon, 1 = zenith.
      // Controls the sky gradient blend between sunset and daytime palettes.
      uSunElevation: { value: CONFIG.sun.elevation / (Math.PI * 0.5) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection;
      uniform float uSunElevation; // 0 = horizon, 1 = zenith
      varying vec3 vWorldPosition;
      void main() {
        vec3 dir = normalize(vWorldPosition);
        float y = dir.y;
        vec3 col;

        // ---- Elevation-driven palette blend ----
        // el = 0 → deep sunset (warm oranges, purples)
        // el = 1 → bright midday (blues, whites)
        // This lets the sky respond dynamically to the sun slider.
        float el = clamp(uSunElevation, 0.0, 1.0);

        if (y > 0.0) {
          // Sunset palette (el ≈ 0)
          vec3 zenithLow   = vec3(0.12, 0.10, 0.28);
          vec3 highSkyLow  = vec3(0.20, 0.18, 0.45);
          vec3 midSkyLow   = vec3(0.65, 0.30, 0.35);
          vec3 horizonLow  = vec3(1.0, 0.55, 0.18);

          // Midday palette (el ≈ 1)
          vec3 zenithHigh  = vec3(0.22, 0.38, 0.68);
          vec3 highSkyHigh = vec3(0.35, 0.52, 0.78);
          vec3 midSkyHigh  = vec3(0.55, 0.70, 0.88);
          vec3 horizonHigh = vec3(0.75, 0.85, 0.95);

          // Blend between the two palettes based on sun elevation
          vec3 zenith  = mix(zenithLow,  zenithHigh,  el);
          vec3 highSky = mix(highSkyLow, highSkyHigh, el);
          vec3 midSky  = mix(midSkyLow,  midSkyHigh,  el);
          vec3 horizon = mix(horizonLow, horizonHigh, el);

          // Height-based gradient: pow(y, 0.5) lingers on warm tones near horizon
          float t = pow(y, 0.5);
          if (t < 0.15) {
            col = mix(horizon, midSky, t / 0.15);
          } else if (t < 0.45) {
            col = mix(midSky, highSky, (t - 0.15) / 0.3);
          } else {
            col = mix(highSky, zenith, (t - 0.45) / 0.55);
          }

          // ---- Sun disc (Mie-like forward scattering) ----
          float sunDot = max(dot(dir, uSunDirection), 0.0);
          // Core: tight brilliant disc. Colour shifts from orange at low el to white at high el.
          vec3 sunCoreCol = mix(vec3(1.0, 0.85, 0.6), vec3(1.0, 0.97, 0.9), el);
          col += sunCoreCol * pow(sunDot, 512.0) * 4.0;
          // Inner glow: warm halo
          vec3 sunGlowCol = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.8, 0.5), el);
          col += sunGlowCol * pow(sunDot, 64.0) * 1.5;
          // Wide scatter: atmospheric haze around the sun
          vec3 sunScatterCol = mix(vec3(1.0, 0.4, 0.1), vec3(0.9, 0.85, 0.7), el);
          col += sunScatterCol * pow(sunDot, 8.0) * 0.35;

          // ---- Horizon glow band ----
          // Warm band at horizon, stronger at low elevation (sunset)
          float horizonBand = smoothstep(0.15, 0.0, y);
          vec3 horizonGlow = mix(vec3(0.9, 0.4, 0.12), vec3(0.6, 0.7, 0.8), el);
          col += horizonGlow * horizonBand * mix(0.4, 0.1, el);

        } else {
          // Below horizon: dark reflected tones
          vec3 horizonBelow = mix(vec3(0.35, 0.18, 0.10), vec3(0.2, 0.3, 0.4), el);
          vec3 deep = vec3(0.02, 0.03, 0.06);
          col = mix(horizonBelow, deep, min(-y * 3.0, 1.0));
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'skyDome';
  scene.add(sky);
}

// ============================================================
// OCEAN FLOOR
// ============================================================
function createOceanFloor() {
  const floorGeo = new THREE.PlaneGeometry(CONFIG.water.size, CONFIG.water.size, 128, 128);
  floorGeo.rotateX(-Math.PI / 2);
  const posAttr = floorGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    let h = -CONFIG.water.depth;
    h += Math.sin(x * 0.05) * 3.0 + Math.cos(z * 0.07) * 2.5;
    h += Math.sin(x * 0.02 + z * 0.03) * 5.0;
    const distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter > 180) {
      h += (distFromCenter - 180) * 0.15;
    }
    posAttr.setY(i, h);
  }
  floorGeo.computeVertexNormals();

  const floorMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCausticsScale: { value: CONFIG.underwater.causticsScale },
      uCausticsSpeed: { value: CONFIG.underwater.causticsSpeed },
      uCausticsIntensity: { value: CONFIG.underwater.causticsIntensity },
      uSandColor: { value: new THREE.Color(0x8B7355) },
      uLightDir: { value: getSunDirection() },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uCausticsScale;
      uniform float uCausticsSpeed;
      uniform float uCausticsIntensity;
      uniform vec3 uSandColor;
      uniform vec3 uLightDir;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      // -------------------------------------------------------
      // Hash: deterministic pseudo-random number from 2D input
      // The magic constants produce good distribution when
      // combined with fract(sin(...)) trick
      // -------------------------------------------------------
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      // -------------------------------------------------------
      // Value noise: smooth interpolation of random lattice values
      // Uses cubic Hermite (smoothstep) for C1 continuity to
      // avoid visible grid artifacts
      // -------------------------------------------------------
      float valueNoise(vec2 p) {
        vec2 i = floor(p);          // which grid cell we're in
        vec2 f = fract(p);          // position within the cell [0,1]
        f = f * f * (3.0 - 2.0 * f); // smoothstep: removes linear interpolation artifacts

        // Sample pseudo-random values at the 4 cell corners
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        // Bilinear blend between corners
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // -------------------------------------------------------
      // FBM (Fractal Brownian Motion): layers multiple octaves
      // of noise, each at 2x frequency and 0.5x amplitude.
      // This creates natural-looking detail at multiple scales,
      // like ocean floor sand ripples viewed at different distances.
      // -------------------------------------------------------
      float fbm(vec2 p) {
        float v = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 5; i++) {
          v += amp * valueNoise(p);
          p *= 2.0;    // zoom in (increase frequency)
          amp *= 0.5;  // reduce contribution of fine details
        }
        return v;
      }

      // -------------------------------------------------------
      // Caustics: simulates the bright rippling light network
      // that sunlight creates on the ocean floor.
      //
      // How it works: two FBM noise fields are sampled with
      // rotating UV coordinates. Where BOTH fields are bright,
      // we see a caustic line. The rotation creates the
      // characteristic shifting diamond/polygon pattern.
      //
      // The rotation angles change with time, making the
      // pattern drift and evolve continuously.
      // -------------------------------------------------------
      float caustics(vec2 uv, float time) {
        vec2 p = uv * uCausticsScale;
        float t = time * uCausticsSpeed;

        // Layer 1: FBM noise rotating clockwise
        float angle1 = t * 0.2;
        // 2D rotation matrix: [cos θ, -sin θ; sin θ, cos θ]
        mat2 rot1 = mat2(cos(angle1), -sin(angle1), sin(angle1), cos(angle1));
        float c1 = fbm(rot1 * p * 1.5 + t * 0.3);

        // Layer 2: FBM noise rotating counter-clockwise
        // Offset by (3.7, 1.2) so layers are uncorrelated
        float angle2 = -t * 0.15;
        mat2 rot2 = mat2(cos(angle2), -sin(angle2), sin(angle2), cos(angle2));
        float c2 = fbm(rot2 * (p + vec2(3.7, 1.2)) * 1.8 - t * 0.25);

        // Layer 3: a third layer adds fine-grained detail
        float angle3 = t * 0.1;
        mat2 rot3 = mat2(cos(angle3), -sin(angle3), sin(angle3), cos(angle3));
        float c3 = fbm(rot3 * p * 3.0 + vec2(7.1, 2.9) + t * 0.15);

        // Multiply layers: caustic bright only where all are bright
        // This models how real caustics form at wave-lens focal lines
        float caustic = c1 * c2;
        // Add fine detail from third layer
        caustic = caustic + c3 * 0.2;

        // pow() sharpens the pattern: makes bright lines brighter,
        // dark areas darker — mimicking real caustic intensity curves
        return pow(clamp(caustic, 0.0, 1.0), 0.7) * 2.5;
      }

      // -------------------------------------------------------
      // Ripple light: the moving bright pattern on the floor
      // caused by waves acting as lenses above. Uses overlapping
      // sine waves at various angles to create interference.
      //
      // Each sine wave represents one wave direction on the
      // surface; together they create a complex animated pattern.
      // -------------------------------------------------------
      float rippleLight(vec2 pos, float time) {
        float ripple = 0.0;
        // Wave 1: large-scale diagonal
        ripple += sin(pos.x * 0.8 + pos.y * 0.5 + time * 1.5) * 0.3;
        // Wave 2: perpendicular to wave 1
        ripple += sin(pos.x * -0.5 + pos.y * 1.0 + time * -1.2) * 0.25;
        // Wave 3: fine-scale, mostly aligned with X
        ripple += sin(pos.x * 1.5 + pos.y * 0.2 + time * 2.0) * 0.2;
        // Wave 4: fine-scale, mostly aligned with Z
        ripple += sin(pos.x * 0.3 + pos.y * -1.3 + time * 1.8) * 0.22;
        // Wave 5: very fine detail for sparkle effect
        ripple += sin(pos.x * 2.5 + pos.y * 1.8 + time * 3.0) * 0.1;

        // FBM noise layer adds organic variation to break regularity
        ripple += fbm(pos * 0.5 + time * 0.15) * 0.3;

        // Map from [-1,1] → [0,1], then sharpen
        // pow(x, 1.5) makes bright spots brighter and dims mid-tones
        return pow(clamp(ripple * 0.5 + 0.5, 0.0, 1.0), 1.5);
      }

      void main() {
        vec3 baseColor = uSandColor;

        // ---- Sand texture variation ----
        // Hash-based noise makes each 0.5m² patch slightly different
        float noise = fract(sin(dot(floor(vWorldPos.xz * 0.5), vec2(12.9898, 78.233))) * 43758.5453);
        baseColor = mix(baseColor, baseColor * 0.8, noise * 0.3);

        // FBM gives larger-scale sandy ripple patterns
        float sandDetail = fbm(vWorldPos.xz * 0.3);
        baseColor = mix(baseColor, baseColor * vec3(0.9, 0.85, 0.75), sandDetail * 0.2);

        // ---- Caustics: the main rippling light network ----
        // Two caustic samples at different scales/offsets
        float c1 = caustics(vWorldPos.xz * 0.05, uTime);
        float c2 = caustics(vWorldPos.xz * 0.05 + vec2(5.3, 2.7), uTime * 0.8);

        // Combine: multiply for realistic intersection pattern
        float causticsVal = max(c1, c2 * 0.8) * uCausticsIntensity;

        // ---- Ripple light on the floor ----
        // This is the "swimming pool floor" effect: dancing bright patterns
        // Scale by world position so it tiles seamlessly across the floor
        float ripple = rippleLight(vWorldPos.xz * 0.3, uTime);

        // Fade ripple with depth: deeper floors get dimmer light
        // (light intensity decreases exponentially with water depth)
        float depthFade = exp(vWorldPos.y * 0.04); // y is negative, so this decays with depth
        depthFade = clamp(depthFade, 0.1, 1.0);

        float rippleIntensity = ripple * depthFade * uCausticsIntensity * 0.6;

        // ---- Direct lighting from the sun ----
        float ndl = max(dot(vNormal, uLightDir), 0.0);
        float ambient = 0.35;

        // Physically-based lighting + caustics + ripple light
        vec3 col = baseColor * (ndl * 0.7 + ambient);

        // Caustics add warm white light (sunlight colour)
        col += vec3(1.0, 0.95, 0.8) * causticsVal;

        // Ripple light adds teal-tinted dancing patterns
        col += vec3(0.6, 0.85, 0.8) * rippleIntensity;

        // Subtle specular highlight on the sand from ripple light
        float rippleSpec = pow(ripple, 3.0) * depthFade * 0.3;
        col += vec3(0.8, 0.95, 1.0) * rippleSpec * uCausticsIntensity;

        // ---- Depth-based darkening ----
        // Simulates light absorption by water column above:
        // deeper areas receive less sunlight, so they appear darker.
        // Normalized to the configured water depth (50m default).
        float depth = clamp(-vWorldPos.y / 50.0, 0.0, 1.0);
        // Mix toward very dark blue-black at maximum depth
        vec3 deepColor = vec3(0.01, 0.04, 0.08);
        col = mix(col, deepColor, depth * 0.55);

        // Add a subtle blue shift with depth (red is absorbed first IRL)
        col.r *= 1.0 - depth * 0.3;
        col.b *= 1.0 + depth * 0.15;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  oceanFloor = new THREE.Mesh(floorGeo, floorMat);
  oceanFloor.receiveShadow = true;
  scene.add(oceanFloor);

  // Add some rocks
  for (let i = 0; i < 15; i++) {
    const rockGeo = new THREE.DodecahedronGeometry(Math.random() * 3 + 1, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x556655,
      roughness: 0.9,
      metalness: 0.1,
    });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(
      (Math.random() - 0.5) * 200,
      -CONFIG.water.depth + Math.random() * 5,
      (Math.random() - 0.5) * 200
    );
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    rock.scale.y = 0.6 + Math.random() * 0.4;
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }
}

// ============================================================
// FFT OCEAN SPECTRUM
// ============================================================
function initFFT() {
  const N = CONFIG.fft.resolution;
  fftData.spectrum = new Float32Array(N * N * 4);
  fftData.heightMap = new Float32Array(N * N);
  fftData.normalMap = new Float32Array(N * N * 3);
  generatePhillipsSpectrum();
}

function generatePhillipsSpectrum() {
  const N = CONFIG.fft.resolution;
  const L = 256;
  const V = CONFIG.fft.windSpeed;
  const w = new THREE.Vector2(Math.cos(CONFIG.fft.windDirection), Math.sin(CONFIG.fft.windDirection));
  const g = 9.81;
  const Lw = V * V / g;

  for (let m = 0; m < N; m++) {
    for (let n = 0; n < N; n++) {
      const kx = (2 * Math.PI * (m - N / 2)) / L;
      const kz = (2 * Math.PI * (n - N / 2)) / L;
      const k = Math.sqrt(kx * kx + kz * kz);
      const idx = (m * N + n) * 4;

      if (k < 0.0001) {
        fftData.spectrum[idx] = 0;
        fftData.spectrum[idx + 1] = 0;
        fftData.spectrum[idx + 2] = 0;
        fftData.spectrum[idx + 3] = 0;
        continue;
      }

      const kNorm = new THREE.Vector2(kx / k, kz / k);
      const kdotw = kNorm.dot(w);
      const L2 = Lw * Lw;
      const k2 = k * k;
      const k4 = k2 * k2;
      const damping = 0.001;
      const l2 = L2 * damping * damping;

      let phillips = CONFIG.fft.amplitude * (Math.exp(-1.0 / (k2 * L2)) / k4) * (kdotw * kdotw);
      phillips *= Math.exp(-k2 * l2);
      phillips = Math.sqrt(Math.max(phillips, 0));

      // Gaussian random
      const u1 = Math.random();
      const u2 = Math.random();
      const g1 = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
      const g2 = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.sin(2 * Math.PI * u2);

      fftData.spectrum[idx] = phillips * g1 * 0.7071;
      fftData.spectrum[idx + 1] = phillips * g2 * 0.7071;
      fftData.spectrum[idx + 2] = kx;
      fftData.spectrum[idx + 3] = kz;
    }
  }
}

function updateFFT(time) {
  const N = CONFIG.fft.resolution;
  const g = 9.81;

  // Update height map from spectrum
  for (let m = 0; m < N; m++) {
    for (let n = 0; n < N; n++) {
      const idx = (m * N + n) * 4;
      const kx = fftData.spectrum[idx + 2];
      const kz = fftData.spectrum[idx + 3];
      const k = Math.sqrt(kx * kx + kz * kz);
      const omega = Math.sqrt(g * k);

      const phase = omega * time;
      const cosP = Math.cos(phase);
      const sinP = Math.sin(phase);

      const h0r = fftData.spectrum[idx];
      const h0i = fftData.spectrum[idx + 1];

      const hr = h0r * cosP - h0i * sinP;
      const hi = h0r * sinP + h0i * cosP;

      fftData.heightMap[m * N + n] = hr;
    }
  }

  // Simple IDFT for a few samples (performance-friendly approximation)
  // In practice we sample this in the shader
}

// ============================================================
// WATER MESH
// ============================================================
function createWater() {
  const size = CONFIG.water.size;
  const segs = CONFIG.water.segments;
  const geometry = new THREE.PlaneGeometry(size, size, segs, segs);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: size },
      uWaterColor: { value: CONFIG.water.color.clone() },
      uWaterDeep: { value: new THREE.Color(0x001a33) },
      uOpacity: { value: CONFIG.water.opacity },
      uCameraPos: { value: new THREE.Vector3() },
      uSunDirection: { value: getSunDirection() },
      uSunColor: { value: CONFIG.sun.color.clone() },

      // FFT
      uWindSpeed: { value: CONFIG.fft.windSpeed },
      uWindDirection: { value: CONFIG.fft.windDirection },
      uFFTAmplitude: { value: CONFIG.fft.amplitude },
      uChoppiness: { value: CONFIG.fft.choppiness },

      // Gerstner
      uGerstnerEnabled: { value: true },
      uGerstnerScale: { value: CONFIG.gerstner.scale },
      uGWave0: { value: new THREE.Vector4(1.2, 40, 1.0, 0.4) },
      uGDir0: { value: new THREE.Vector2(1, 0.3).normalize() },
      uGWave1: { value: new THREE.Vector4(0.8, 25, 0.8, 0.35) },
      uGDir1: { value: new THREE.Vector2(0.7, 0.7).normalize() },
      uGWave2: { value: new THREE.Vector4(0.5, 15, 1.2, 0.3) },
      uGDir2: { value: new THREE.Vector2(-0.3, 1).normalize() },
      uGWave3: { value: new THREE.Vector4(0.3, 8, 1.5, 0.25) },
      uGDir3: { value: new THREE.Vector2(0.5, -0.5).normalize() },

      // Foam
      uWhitecapThreshold: { value: CONFIG.foam.whitecap.threshold },
      uWhitecapIntensity: { value: CONFIG.foam.whitecap.intensity },
      uWhitecapScale: { value: CONFIG.foam.whitecap.scale },
      uWhitecapSpeed: { value: CONFIG.foam.whitecap.speed },
      uWhitecapEnabled: { value: true },
      uAmbientFoamDensity: { value: CONFIG.foam.ambient.density },
      uAmbientFoamScale: { value: CONFIG.foam.ambient.scale },
      uAmbientFoamSpeed: { value: CONFIG.foam.ambient.speed },
      uAmbientFoamOpacity: { value: CONFIG.foam.ambient.opacity },
      uAmbientFoamEnabled: { value: true },
      uShorelineFoamDist: { value: CONFIG.foam.shoreline.distance },
      uShorelineFoamIntensity: { value: CONFIG.foam.shoreline.intensity },
      uShorelineFoamScale: { value: CONFIG.foam.shoreline.scale },
      uShorelineFoamWidth: { value: CONFIG.foam.shoreline.width },
      uShorelineFoamEnabled: { value: true },

      // Depth
      uDepthTexture: { value: null },
      uScreenSize: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uNear: { value: 0.1 },
      uFar: { value: 2000 },

      // Environment — sunset sky colour for reflections
      uSkyColor: { value: new THREE.Color(0xcc7744) },
      uIsUnderwater: { value: false },

      // Waterline: distance from camera to water surface (signed)
      // Positive = above water, negative = below. Used to render
      // a foam/splash depth line where the surface meets the camera.
      uCameraWaterDist: { value: 10.0 },

      // Planar reflection
      uReflectionMap: { value: null },
      uReflectionStrength: { value: 0.6 },
      uFresnelPower: { value: 3.0 },
      uReflectionDistortion: { value: 0.03 },

      // ---- Arc waves: surfable swells radiating from a distant origin ----
      uArcWaveEnabled: { value: CONFIG.arcWaves.enabled },
      uArcWaveOrigin: { value: CONFIG.arcWaves.origin.clone() },
      uArcWaveAmplitude: { value: CONFIG.arcWaves.amplitude },
      uArcWaveLength: { value: CONFIG.arcWaves.wavelength },
      uArcWaveSpeed: { value: CONFIG.arcWaves.speed },
      uArcWaveSteepness: { value: CONFIG.arcWaves.steepness },
      uArcWaveSpread: { value: CONFIG.arcWaves.spread },
      uArcWaveCount: { value: CONFIG.arcWaves.count },
      uArcWaveScale: { value: CONFIG.arcWaves.scale },

      // Boat foam: position + dimensions for proximity-based foam ring
      uBoatPos: { value: new THREE.Vector3(10, 0, 10) },
      uBoatSize: { value: new THREE.Vector3(3, 1.5, 8) }, // width, height, length
      uBoatFoamIntensity: { value: 1.0 },
      uBoatFoamRadius: { value: 5.0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uSize;
      uniform float uWindSpeed;
      uniform float uWindDirection;
      uniform float uFFTAmplitude;
      uniform float uChoppiness;
      uniform bool uGerstnerEnabled;
      uniform float uGerstnerScale;
      uniform vec4 uGWave0, uGWave1, uGWave2, uGWave3;
      uniform vec2 uGDir0, uGDir1, uGDir2, uGDir3;

      // ---- Arc wave uniforms ----
      uniform bool uArcWaveEnabled;
      uniform vec2 uArcWaveOrigin;    // XZ origin of the distant swell source
      uniform float uArcWaveAmplitude;
      uniform float uArcWaveLength;
      uniform float uArcWaveSpeed;
      uniform float uArcWaveSteepness;
      uniform float uArcWaveSpread;   // angular spread (radians)
      uniform int uArcWaveCount;      // number of arc swell layers
      uniform float uArcWaveScale;    // master amplitude scale

      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying float vFoamFactor;
      varying float vHeight;
      varying vec4 vClipPos;

      // Simplex-like noise for FFT approximation
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289v2(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      // FFT-based wave approximation using octaves
      float fftWaves(vec2 pos, float time) {
        float windDirX = cos(uWindDirection);
        float windDirZ = sin(uWindDirection);
        vec2 windDir = vec2(windDirX, windDirZ);

        float h = 0.0;
        float amp = uFFTAmplitude;
        float freq = 0.03;
        float speed = 1.0;

        for(int i = 0; i < 6; i++) {
          vec2 dir = normalize(windDir + vec2(float(i) * 0.3 - 0.9, float(i) * 0.2 - 0.5));
          float phase = dot(pos * freq, dir) - time * speed * freq * uWindSpeed * 0.1;
          h += snoise(pos * freq + dir * time * speed * 0.1) * amp;
          h += sin(phase) * amp * 0.5;
          amp *= 0.55;
          freq *= 1.8;
          speed *= 1.1;
        }
        return h;
      }

      // Gerstner wave
      vec3 gerstnerWave(vec2 pos, float amp, float wavelength, float speed, float steepness, vec2 dir, float time, inout vec3 tangent, inout vec3 binormal) {
        float k = 6.28318 / wavelength;
        float c = sqrt(9.81 / k) * speed;
        vec2 d = normalize(dir);
        float f = k * (dot(d, pos) - c * time);
        float a = steepness / k;
        float sf = sin(f);
        float cf = cos(f);

        tangent += vec3(-d.x * d.x * steepness * sf, d.x * steepness * cf, -d.x * d.y * steepness * sf);
        binormal += vec3(-d.x * d.y * steepness * sf, d.y * steepness * cf, -d.y * d.y * steepness * sf);

        return vec3(d.x * a * cf, amp * sf, d.y * a * cf);
      }

      // ============================================================
      // ARC WAVE: Gerstner wave with circular wavefronts
      //
      // Unlike standard Gerstner waves which have planar wavefronts
      // (infinite parallel lines), arc waves have CIRCULAR wavefronts
      // radiating from a point source (the distant storm origin).
      //
      // The wave propagation direction at each vertex is the radial
      // direction FROM the origin TO that vertex. This means:
      //   - Near the origin: wavefronts are tightly curved arcs
      //   - Far from origin: wavefronts flatten to near-planar
      //
      // This is exactly how real open-ocean swells behave: they
      // start as circular ripples at the storm and become long,
      // gently curved arcs by the time they reach the coast.
      //
      // The Gerstner displacement is applied along this radial
      // direction, creating the characteristic circular arc shape
      // that surfers ride diagonally across.
      //
      // Parameters:
      //   pos      - vertex XZ position
      //   origin   - XZ position of the wave source
      //   amp      - wave amplitude (crest height above still water)
      //   wl       - wavelength (distance between crests)
      //   spd      - phase speed multiplier
      //   steep    - Gerstner steepness Q (0=sine, ~0.5=peaked crests)
      //   spread   - angular spread for fan-out (radians)
      //   idx      - wave layer index (for frequency offset)
      //   time     - animation time
      //   tangent  - accumulated tangent vector (for normal calc)
      //   binormal - accumulated binormal vector (for normal calc)
      // ============================================================
      vec3 arcWave(vec2 pos, vec2 origin, float amp, float wl, float spd,
                   float steep, float spread, float idx, float time,
                   inout vec3 tangent, inout vec3 binormal) {

        // ---- Radial direction from origin to this vertex ----
        // This is the local propagation direction of the circular wave
        vec2 toPoint = pos - origin;
        float dist = length(toPoint);

        // Avoid division by zero at the origin
        if (dist < 0.01) return vec3(0.0);

        // Normalized radial direction
        vec2 radialDir = toPoint / dist;

        // ---- Angular spread: fan the wave slightly ----
        // Each layer (idx) is offset by a fraction of the spread angle
        // to create a packet of swell arcs at slightly different angles.
        // This mimics how real swell fans out from a storm.
        float angleOffset = (idx - 1.0) * spread * 0.3;
        // 2D rotation of the radial direction by angleOffset
        float cosA = cos(angleOffset);
        float sinA = sin(angleOffset);
        vec2 dir = vec2(
          radialDir.x * cosA - radialDir.y * sinA,
          radialDir.x * sinA + radialDir.y * cosA
        );

        // ---- Gerstner wave along the radial direction ----
        // k = 2π/λ (wave number)
        float k = 6.28318 / wl;
        // Phase velocity from deep-water dispersion: c = √(g/k)
        // Multiplied by user speed control
        float c = sqrt(9.81 / k) * spd;

        // Phase: distance from origin determines where on the wave
        // cycle each vertex sits. Using 'dist' (radial distance)
        // instead of dot(dir, pos) is what makes the wavefronts
        // circular arcs rather than straight lines.
        float f = k * (dist - c * time);

        // Gerstner Q parameter: steepness / k
        // Q controls how much the surface points bunch up at crests.
        // Q = 0 → pure sine wave
        // Q = 1/(k·A) → wave would form a cusp (theoretical breaking point)
        float a = steep / k;

        float sf = sin(f);
        float cf = cos(f);

        // ---- Amplitude falloff with distance ----
        // Real swells attenuate as 1/√r (energy conserved over
        // expanding wavefront circumference). We use a softer
        // falloff to keep waves visible at reasonable distances.
        //
        // The +50 prevents singularity near the origin.
        // The sqrt creates the 1/√r cylindrical spreading loss.
        float falloff = 1.0 / (1.0 + sqrt(dist / 50.0) * 0.3);

        float finalAmp = amp * falloff;

        // ---- Update tangent/binormal for normal computation ----
        // These partial derivatives account for the Gerstner
        // displacement and will be used to compute the surface
        // normal via cross product after all wave layers.
        tangent  += vec3(-dir.x * dir.x * steep * sf, dir.x * steep * cf, -dir.x * dir.y * steep * sf) * falloff;
        binormal += vec3(-dir.x * dir.y * steep * sf, dir.y * steep * cf, -dir.y * dir.y * steep * sf) * falloff;

        // ---- Gerstner displacement ----
        // Horizontal displacement (bunching at crests) + vertical displacement
        return vec3(dir.x * a * cf, finalAmp * sf, dir.y * a * cf);
      }

      void main() {
        vec3 pos = position;
        vUv = uv;
        float time = uTime;

        // FFT waves
        float fftH = fftWaves(pos.xz, time);
        pos.y += fftH;

        // Choppiness displacement
        float chop = uChoppiness;
        float windDirX = cos(uWindDirection);
        float windDirZ = sin(uWindDirection);
        pos.x += snoise(pos.xz * 0.05 + time * 0.1) * chop * 0.3;
        pos.z += snoise(pos.xz * 0.05 + vec2(7.0, 3.0) + time * 0.1) * chop * 0.3;

        // Gerstner swells
        vec3 gerstnerDisp = vec3(0.0);
        vec3 tangent = vec3(1.0, 0.0, 0.0);
        vec3 binormal = vec3(0.0, 0.0, 1.0);

        if(uGerstnerEnabled) {
          float gs = uGerstnerScale;
          gerstnerDisp += gerstnerWave(position.xz, uGWave0.x * gs, uGWave0.y, uGWave0.z, uGWave0.w, uGDir0, time, tangent, binormal);
          gerstnerDisp += gerstnerWave(position.xz, uGWave1.x * gs, uGWave1.y, uGWave1.z, uGWave1.w, uGDir1, time, tangent, binormal);
          gerstnerDisp += gerstnerWave(position.xz, uGWave2.x * gs, uGWave2.y, uGWave2.z, uGWave2.w, uGDir2, time, tangent, binormal);
          gerstnerDisp += gerstnerWave(position.xz, uGWave3.x * gs, uGWave3.y, uGWave3.z, uGWave3.w, uGDir3, time, tangent, binormal);
          pos += gerstnerDisp;
        }

        // ============================================================
        // ARC WAVES: surfable circular swell arcs
        //
        // Each layer has a different wavelength (progressively shorter)
        // and frequency, creating a realistic swell packet with a
        // dominant long-period wave and shorter harmonics.
        //
        // The layers fan out slightly (controlled by spread) to
        // avoid perfect constructive interference that would create
        // unnaturally tall isolated peaks.
        // ============================================================
        if (uArcWaveEnabled) {
          float arcScale = uArcWaveScale;
          for (int i = 0; i < 3; i++) {
            if (i >= uArcWaveCount) break;
            float fi = float(i);
            // Each layer: shorter wavelength, less amplitude, faster
            // This creates the classic swell packet where the dominant
            // wave has the most energy and harmonics add texture.
            float layerAmp = uArcWaveAmplitude * arcScale * (1.0 - fi * 0.25);
            float layerWL  = uArcWaveLength * (1.0 - fi * 0.3);
            float layerSpd = uArcWaveSpeed * (1.0 + fi * 0.15);
            float layerSteep = uArcWaveSteepness * (1.0 - fi * 0.1);

            vec3 arcDisp = arcWave(
              position.xz, uArcWaveOrigin,
              layerAmp, layerWL, layerSpd,
              layerSteep, uArcWaveSpread, fi,
              time, tangent, binormal
            );
            pos += arcDisp;
          }
        }

        vec3 normal = normalize(cross(binormal, tangent));

        vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
        vNormal = normalize(normalMatrix * normal);
        vHeight = pos.y;

        // Foam factor from wave steepness (Jacobian approximation)
        float jacobian = length(cross(tangent, binormal));
        vFoamFactor = clamp(1.0 - jacobian, 0.0, 1.0) + clamp(pos.y * 0.5, 0.0, 1.0);

        vec4 mvp = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        vClipPos = mvp;
        gl_Position = mvp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uWaterColor;
      uniform vec3 uWaterDeep;
      uniform float uOpacity;
      uniform vec3 uCameraPos;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uSkyColor;
      uniform bool uIsUnderwater;
      uniform float uCameraWaterDist;
      uniform sampler2D uReflectionMap;
      uniform float uReflectionStrength;
      uniform float uFresnelPower;
      uniform float uReflectionDistortion;

      // Wind (needed for directional whitecap foam stretching)
      uniform float uWindDirection;

      // Foam
      uniform float uWhitecapThreshold;
      uniform float uWhitecapIntensity;
      uniform float uWhitecapScale;
      uniform float uWhitecapSpeed;
      uniform bool uWhitecapEnabled;
      uniform float uAmbientFoamDensity;
      uniform float uAmbientFoamScale;
      uniform float uAmbientFoamSpeed;
      uniform float uAmbientFoamOpacity;
      uniform bool uAmbientFoamEnabled;
      uniform float uShorelineFoamDist;
      uniform float uShorelineFoamIntensity;
      uniform float uShorelineFoamScale;
      uniform float uShorelineFoamWidth;
      uniform bool uShorelineFoamEnabled;

      // Depth
      uniform sampler2D uDepthTexture;
      uniform vec2 uScreenSize;
      uniform float uNear;
      uniform float uFar;

      // Boat foam: renders a foam ring where the boat hull
      // intersects/sits in the water surface
      uniform vec3 uBoatPos;
      uniform vec3 uBoatSize;
      uniform float uBoatFoamIntensity;
      uniform float uBoatFoamRadius;

      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying float vFoamFactor;
      varying float vHeight;
      varying vec4 vClipPos;

      // -------------------------------------------------------
      // REALISTIC FOAM NOISE SYSTEM
      //
      // Instead of Voronoi (which gives a cellular/toony look),
      // we use multi-octave gradient noise (simplex) combined
      // with FBM for organic, photorealistic foam textures.
      //
      // Real ocean foam is:
      //  - Wispy, fibrous patches (not uniform cells)
      //  - Multi-scale: large patches with fine-grain texture
      //  - Directional: streaked by wind
      //  - Soft-edged with internal density variation
      //
      // The key insight: layered FBM with domain warping creates
      // foam that looks like real turbulent water foam because
      // it models the same chaotic mixing process.
      // -------------------------------------------------------

      // ---- Simplex noise (gradient noise, C1 continuous) ----
      // Superior to value noise: no grid artifacts, isotropic,
      // and produces smoother foam textures at all scales.
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289v2(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      // ---- Hash for deterministic randomness ----
      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      // -------------------------------------------------------
      // FBM (Fractal Brownian Motion) for foam
      //
      // Multiple octaves of simplex noise at increasing frequency
      // and decreasing amplitude create natural multi-scale detail.
      //
      // gain < 0.5 → smoother, softer foam (like real whitecaps)
      // gain > 0.5 → grittier, more detailed foam
      //
      // We use 6 octaves for rich detail without being too noisy.
      // Each octave doubles the frequency and halves the amplitude.
      // -------------------------------------------------------
      float foamFBM(vec2 p, float gain) {
        float sum = 0.0;
        float amp = 0.5;
        float freq = 1.0;
        // Rotation matrix between octaves prevents axis-aligned
        // artifacts. The angle (1.6 rad ≈ 92°) is intentionally
        // not 90° to avoid reinforcing grid patterns.
        mat2 rot = mat2(cos(1.6), sin(1.6), -sin(1.6), cos(1.6));
        for (int i = 0; i < 6; i++) {
          // snoise returns [-1,1], remap to [0,1] for foam density
          sum += amp * (snoise(p * freq) * 0.5 + 0.5);
          p = rot * p;  // rotate domain to decorrelate octaves
          freq *= 2.1;  // slightly above 2 to avoid periodicity
          amp *= gain;   // each octave contributes less
        }
        return sum;
      }

      // -------------------------------------------------------
      // Domain-warped FBM: creates fibrous, streaky foam
      //
      // Domain warping feeds the output of one FBM into the input
      // of another, creating organic, turbulent patterns that look
      // like wind-stretched foam filaments.
      //
      // The process:
      //   1. Evaluate FBM at the original position → displacement vector
      //   2. Offset the original position by this displacement
      //   3. Evaluate FBM again at the warped position
      //
      // The warp strength controls how "turbulent" and stretched
      // the foam filaments appear. ~2.0 gives realistic ocean foam.
      // -------------------------------------------------------
      float warpedFBM(vec2 p, float t, float warpStrength) {
        // First pass: coarse noise field for warping
        vec2 warp = vec2(
          foamFBM(p + vec2(0.0, 0.0) + t * 0.15, 0.45),
          foamFBM(p + vec2(5.2, 1.3) + t * 0.12, 0.45)
        );
        // Second pass: FBM at the warped position
        return foamFBM(p + warp * warpStrength, 0.5);
      }

      // -------------------------------------------------------
      // Ridged FBM: creates sharp crests in foam
      //
      // Standard FBM has rounded peaks. By taking abs() of the
      // noise before summing, we fold negative values upward,
      // creating sharp "ridges" at zero-crossings. Subtracting
      // from 1.0 inverts so ridges become bright lines — perfect
      // for foam streaks and whitecap edges.
      //
      // This mimics how foam collects along wave crests and
      // convergence zones in real turbulent water.
      // -------------------------------------------------------
      float ridgedFBM(vec2 p, float t) {
        float sum = 0.0;
        float amp = 0.5;
        float freq = 1.0;
        float prev = 1.0;
        mat2 rot = mat2(cos(1.3), sin(1.3), -sin(1.3), cos(1.3));
        for (int i = 0; i < 5; i++) {
          // abs() creates the ridge; (1 - abs) inverts for bright ridges
          float n = 1.0 - abs(snoise(p * freq + t * 0.1 * float(i + 1)));
          // Square the ridge value to sharpen peaks further
          n = n * n;
          // Weight by previous octave: ridges in fine detail only
          // appear where coarse features are also ridged, preventing
          // uniform noise and making detail follow major structures
          sum += n * amp * prev;
          prev = n;
          p = rot * p;
          freq *= 2.2;
          amp *= 0.5;
        }
        return sum;
      }

      void main() {
        vec3 viewDir = normalize(uCameraPos - vWorldPos);
        vec3 normal = normalize(vNormal);

        // ---- Fresnel: physically-based reflectance ----
        // At grazing angles (low dot product), water reflects almost
        // everything. At steep angles (looking straight down), most
        // light transmits through. The power curve approximates
        // Schlick's Fresnel, which is ~2% at normal, ~100% at grazing.
        float NdotV = max(dot(viewDir, normal), 0.0);
        float fresnel = pow(1.0 - NdotV, uFresnelPower);
        fresnel = clamp(fresnel, 0.02, 1.0);

        // ---- Base water colour with depth gradient ----
        // Deeper water appears darker (light absorption).
        // At sunset, the water takes on warm amber tones from
        // reflected sky light mixed with the inherent ocean blue.
        float depthFactor = clamp(vHeight * 0.1 + 0.5, 0.0, 1.0);
        vec3 waterCol = mix(uWaterDeep, uWaterColor, depthFactor);
        // Warm the water colour slightly to match sunset ambient
        waterCol = mix(waterCol, waterCol * vec3(1.3, 0.95, 0.8), 0.15);

        // ---- Dual specular highlights ----
        // Low sun produces a long, bright specular streak across the
        // water surface. We use two specular lobes:
        //  1. Tight core: intense sun reflection (like a mirror)
        //  2. Wide glow: atmospheric scatter around the sun path
        vec3 halfDir = normalize(uSunDirection + viewDir);
        float NdotH = max(dot(normal, halfDir), 0.0);
        // Core highlight: very tight (power 512) for sun disc
        float specCore = pow(NdotH, 512.0);
        // Wide glow: softer lobe (power 32) for the glitter path
        float specWide = pow(NdotH, 32.0);
        // Sun colour for specular: warm orange-gold at sunset
        vec3 specular = uSunColor * specCore * 3.5
                      + uSunColor * vec3(1.0, 0.7, 0.4) * specWide * 0.6;

        // ---- Subsurface scattering (SSS) ----
        // Light passing through thin wave crests creates a warm
        // translucent glow. At sunset, this glow is amber/gold
        // because the low sun angle sends light through more
        // water, absorbing blue and leaving warm tones.
        float sss = pow(max(dot(viewDir, -uSunDirection + normal * 0.4), 0.0), 3.0);
        vec3 sssColor = vec3(0.4, 0.25, 0.1) * sss * 0.6;
        // Extra SSS at wave crests (thin water → more transmission)
        float crestSSS = smoothstep(0.0, 1.5, vHeight) * sss;
        sssColor += vec3(0.6, 0.35, 0.1) * crestSSS * 0.3;

        // ---- Planar reflection sampling ----
        vec2 screenUV_refl = (vClipPos.xy / vClipPos.w) * 0.5 + 0.5;
        vec2 reflUV = vec2(screenUV_refl.x, 1.0 - screenUV_refl.y);
        reflUV += normal.xz * uReflectionDistortion;
        reflUV = clamp(reflUV, 0.001, 0.999);
        vec3 reflectionSample = texture2D(uReflectionMap, reflUV).rgb;
        // Tone map reflection to prevent clipping
        reflectionSample = reflectionSample / (reflectionSample + vec3(1.0)) * 1.8;

        // ---- Sky reflection fallback ----
        // When the planar reflection is dark (below geometry, or out of view),
        // fall back to an analytical sunset sky gradient
        vec3 reflDir = reflect(-viewDir, normal);
        float skyY = clamp(reflDir.y, 0.0, 1.0);
        // Sunset sky gradient: deep purple top → orange horizon
        vec3 skyReflection = mix(
          vec3(0.8, 0.35, 0.12),  // horizon: warm orange
          vec3(0.15, 0.12, 0.3),  // zenith: deep twilight
          pow(skyY, 0.4)
        );
        // Sun glow in reflection direction
        float reflSunDot = max(dot(reflDir, uSunDirection), 0.0);
        skyReflection += uSunColor * pow(reflSunDot, 64.0) * 0.8;
        skyReflection += vec3(1.0, 0.5, 0.2) * pow(reflSunDot, 8.0) * 0.25;

        float reflLuminance = dot(reflectionSample, vec3(0.299, 0.587, 0.114));
        vec3 reflection = mix(skyReflection, reflectionSample, clamp(reflLuminance * 3.0, 0.3, 1.0));
        reflection += specular;

        // ---- Final surface colour: blend water + reflection via Fresnel ----
        vec3 col = mix(waterCol + sssColor, reflection, fresnel * uReflectionStrength);

        // ============================================================
        // REALISTIC FOAM RENDERING
        //
        // Three foam layers, each using FBM-based noise instead of
        // Voronoi to avoid the cellular/toony look. The key techniques:
        //
        //  1. Warped FBM: domain warping creates organic, wind-stretched
        //     filaments (like real foam streaks on water).
        //  2. Ridged FBM: sharp crests for whitecap edges where waves
        //     are actively breaking.
        //  3. Multi-octave blending: soft inner density + sharp edges
        //     gives foam patches that look thick in the middle and wispy
        //     at the borders, matching how real foam thins out.
        //  4. Foam colour varies by density: thin foam is translucent
        //     blue-white, thick foam is opaque white with warm highlights
        //     from the sunset light.
        // ============================================================
        float totalFoam = 0.0;
        // Per-layer alpha for separate colour tinting
        float whitecapAlpha = 0.0;
        float ambientAlpha = 0.0;
        float shoreAlpha = 0.0;
        float boatAlpha = 0.0;

        // ----------------------------------------------------------
        // 1. WHITECAP FOAM (wave-breaking)
        //
        // Driven by the vertex shader's vFoamFactor which estimates
        // wave steepness from the Jacobian of the Gerstner displacement.
        // High steepness = wave is cresting = foam forms.
        //
        // We use warped FBM for the large-scale foam shape (wispy,
        // directional patches) and ridged FBM for fine detail that
        // mimics the sharp streaks in breaking wave foam.
        // ----------------------------------------------------------
        if (uWhitecapEnabled) {
          // Wind-aligned UV: stretch foam along wind direction
          // so whitecaps appear as streaks, not round blobs
          float wdx = cos(uWindDirection);
          float wdz = sin(uWindDirection);
          vec2 windUV = vec2(
            vWorldPos.x * wdx + vWorldPos.z * wdz,  // along-wind
            vWorldPos.x * -wdz + vWorldPos.z * wdx   // cross-wind
          );
          // Stretch 2:1 along wind for realistic directional foam
          windUV *= vec2(uWhitecapScale * 0.06, uWhitecapScale * 0.12);

          // Large-scale warped foam shape: organic, turbulent patches
          float foamShape = warpedFBM(windUV, uTime * uWhitecapSpeed, 2.0);
          // Fine detail: ridged FBM for sharp streak edges
          float foamDetail = ridgedFBM(windUV * 1.8 + vec2(3.7), uTime * uWhitecapSpeed * 0.8);
          // Blend: 70% warped shape, 30% ridge detail
          float foamPattern = foamShape * 0.7 + foamDetail * 0.3;

          // Activation mask: only where wave steepness exceeds threshold
          // The smoothstep creates a soft onset — foam fades in gradually
          // as waves steepen, rather than popping in at a hard cutoff
          float steepnessMask = smoothstep(uWhitecapThreshold, uWhitecapThreshold + 0.4, vFoamFactor);

          // Additional height mask: foam favours wave crests
          float crestMask = smoothstep(-0.2, 0.8, vHeight) * 0.5 + 0.5;

          whitecapAlpha = steepnessMask * foamPattern * crestMask * uWhitecapIntensity;
          whitecapAlpha = clamp(whitecapAlpha, 0.0, 1.0);
          totalFoam += whitecapAlpha;
        }

        // ----------------------------------------------------------
        // 2. AMBIENT SURFACE FOAM
        //
        // Persistent foam patches that drift on the surface even
        // in calm water. In reality this is organic material,
        // dissolved surfactants, and persistent micro-bubbles.
        //
        // Uses pure warped FBM (no ridges) for soft, cloud-like patches.
        // A secondary FBM layer creates internal density variation
        // so patches aren't uniformly white — they have see-through
        // thin areas and opaque thick areas.
        // ----------------------------------------------------------
        if (uAmbientFoamEnabled) {
          vec2 ambUV = vWorldPos.xz * uAmbientFoamScale * 0.035;
          // Drift slowly with time for ambient motion
          ambUV += uTime * uAmbientFoamSpeed * vec2(0.12, 0.08);

          // Primary shape: warped FBM for organic patches
          float ambShape = warpedFBM(ambUV, uTime * uAmbientFoamSpeed * 0.5, 1.5);
          // Internal density variation: thinner FBM at finer scale
          float ambDensity = foamFBM(ambUV * 2.5 + vec2(7.3, 2.1), 0.45);

          // Combine: shape provides on/off, density provides internal texture
          float ambFoam = ambShape * ambDensity;
          // Threshold by density slider: higher density = more foam coverage
          ambFoam = smoothstep(1.0 - uAmbientFoamDensity, 1.0, ambFoam * 1.5);

          ambientAlpha = ambFoam * uAmbientFoamOpacity;
          ambientAlpha = clamp(ambientAlpha, 0.0, 1.0);
          totalFoam += ambientAlpha;
        }

        // ----------------------------------------------------------
        // 3. SHORELINE FOAM (depth-based)
        //
        // Foam that collects where the water meets shallow areas
        // (rocks, the ocean floor near edges). Driven by the depth
        // difference between the water surface and the scene geometry
        // behind it.
        //
        // Uses ridged FBM for the sharp, bubbly texture of surf foam,
        // plus a rolling wave pattern from sine waves that create
        // the characteristic advancing/retreating foam lines.
        // ----------------------------------------------------------
        if (uShorelineFoamEnabled) {
          vec2 screenUV = (vClipPos.xy / vClipPos.w) * 0.5 + 0.5;
          float sceneDepth = texture2D(uDepthTexture, screenUV).r;
          float waterDepth = gl_FragCoord.z;
          float depthDiff = abs(sceneDepth - waterDepth) * uFar;

          // Proximity mask: strong near shore, fading with depth
          float shoreMask = smoothstep(uShorelineFoamDist, 0.0, depthDiff);

          if (shoreMask > 0.01) {
            vec2 shoreUV = vWorldPos.xz * uShorelineFoamScale * 0.08;
            // Ridged FBM for bubbly surf texture
            float shoreRidges = ridgedFBM(shoreUV, uTime * 0.4);
            // Warped FBM for larger lacy patterns
            float shoreLace = warpedFBM(shoreUV * 0.6, uTime * 0.2, 2.5);

            // Rolling foam lines: sine waves in depth-space create
            // the advancing/retreating bands of surf foam
            float depthPhase = depthDiff * 3.14159 / uShorelineFoamWidth;
            float foamLine1 = smoothstep(0.3, 0.8, sin(depthPhase + uTime * 1.5) * 0.5 + 0.5);
            float foamLine2 = smoothstep(0.4, 0.85, sin(depthPhase * 1.7 + uTime * 1.1 + 1.0) * 0.5 + 0.5);
            float rollingLines = max(foamLine1, foamLine2 * 0.7);

            // Combine: ridged texture × rolling lines × proximity
            float shoreFoam = mix(shoreRidges, shoreLace, 0.4) * rollingLines * shoreMask;

            shoreAlpha = shoreFoam * uShorelineFoamIntensity;
            shoreAlpha = clamp(shoreAlpha, 0.0, 1.0);
            totalFoam += shoreAlpha;
          }
        }

        // ----------------------------------------------------------
        // 4. BOAT INTERSECTION FOAM
        //
        // Foam ring where the boat hull meets the water. Uses
        // warped FBM for turbulent wake foam and ridged FBM
        // for the sharp contact line at the hull edge.
        // ----------------------------------------------------------
        {
          vec2 toBoat = vWorldPos.xz - uBoatPos.xz;
          float halfW = uBoatSize.x * 0.55;
          float halfL = uBoatSize.z * 0.55;
          vec2 normDist = toBoat / vec2(halfW, halfL);
          float ellipseDist = length(normDist);

          float innerEdge = smoothstep(0.6, 1.0, ellipseDist);
          float outerEdge = 1.0 - smoothstep(1.0, 1.0 + uBoatFoamRadius * 0.3, ellipseDist);
          float boatFoamMask = innerEdge * outerEdge;

          if (boatFoamMask > 0.01) {
            // Wake turbulence: warped FBM stretched behind the boat
            float wakeFoam = warpedFBM(vWorldPos.xz * 0.4, uTime * 0.5, 2.0);
            // Fine churning detail
            float churn = ridgedFBM(vWorldPos.xz * 0.8 + vec2(1.3, 4.7), uTime * 0.6);
            float boatFoamPattern = wakeFoam * 0.6 + churn * 0.4;
            boatFoamPattern = pow(boatFoamPattern, 0.65);

            // Contact line: Gaussian peak at hull edge
            float contactLine = exp(-pow((ellipseDist - 1.0) * 10.0, 2.0));
            contactLine *= 0.7 + 0.3 * sin(atan(toBoat.y, toBoat.x) * 6.0 + uTime * 2.5);

            boatAlpha = boatFoamMask * boatFoamPattern * uBoatFoamIntensity;
            boatAlpha += contactLine * 0.4 * uBoatFoamIntensity;
            boatAlpha = clamp(boatAlpha, 0.0, 1.0);
            totalFoam += boatAlpha;
          }
        }

        totalFoam = clamp(totalFoam, 0.0, 1.0);

        // ---- Foam colour: varies by density for realism ----
        // Thin foam: translucent, shows water colour through it
        // Thick foam: opaque white with warm sunset highlight
        vec3 thinFoamCol = vec3(0.80, 0.85, 0.88);  // blue-tinted translucent
        vec3 thickFoamCol = vec3(1.0, 0.97, 0.92);   // warm white
        // Sunset reflection tint on thick foam
        thickFoamCol += vec3(0.15, 0.06, 0.0) * max(dot(normal, uSunDirection), 0.0);
        vec3 foamColor = mix(thinFoamCol, thickFoamCol, clamp(totalFoam * 1.5, 0.0, 1.0));

        // Soft blend: squared alpha gives soft onset (no hard edges)
        float foamBlend = totalFoam * totalFoam * (3.0 - 2.0 * totalFoam); // smoothstep
        col = mix(col, foamColor, foamBlend);

        // ==============================================
        // WATERLINE DEPTH-BASED FOAM TRANSITION
        //
        // When the camera is near the water surface (partially
        // submerged), we render a foam/splash line where the water
        // mesh is very close to the near clip plane. This simulates
        // water droplets and foam "touching" the camera lens.
        //
        // How it works:
        // 1. uCameraWaterDist = signed distance from camera to water
        //    surface. Small values mean we're near the waterline.
        // 2. The water fragments closest to the camera (small
        //    gl_FragCoord.z → near plane) get a foam overlay.
        // 3. We add animated noise patterns to make it look like
        //    churning, bubbly foam clinging to the lens.
        //
        // The effect fades in as the camera approaches the surface
        // and fades out when fully above or below water.
        // ==============================================

        // How close the camera is to the water surface (0=at surface, 1=far)
        float waterlineDist = abs(uCameraWaterDist);
        // Activation: effect is strongest within 3 units of the surface
        float waterlineActive = 1.0 - smoothstep(0.0, 3.0, waterlineDist);

        if (waterlineActive > 0.01) {
          // ---- Screen-space depth proximity ----
          // gl_FragCoord.z: 0 = near plane, 1 = far plane
          // Fragments near the camera (low z) are where the water surface
          // intersects the camera's view — the waterline.
          // We create a mask that's strongest for near-camera fragments.
          float linearDepth = gl_FragCoord.z;
          // Map to a waterline band: strongest at near plane, fading by z=0.15
          float depthProximity = 1.0 - smoothstep(0.0, 0.15, linearDepth);

          // ---- Screen-space position for foam patterns ----
          vec2 screenPos = gl_FragCoord.xy / uScreenSize;

          // ---- Animated foam noise (bubbly, churning look) ----
          // Layer 1: Large bubble patches using warped FBM
          float foamBubbles = warpedFBM(
            screenPos * vec2(8.0, 4.0) + uTime * vec2(0.15, 0.35), uTime * 0.4, 1.8
          );
          foamBubbles = smoothstep(0.3, 0.7, foamBubbles);
          // Layer 2: Fine noise for foam spray
          float foamSpray = foamFBM(
            screenPos * 12.0 + vec2(uTime * 0.8, uTime * 0.4), 0.5
          );
          // Layer 3: Streaky horizontal foam lines (water dripping down lens)
          float dripNoise = snoise(vec2(screenPos.x * 8.0, screenPos.y * 30.0 - uTime * 3.0));
          float drips = smoothstep(0.3, 0.7, dripNoise * 0.5 + 0.5);

          // ---- Combine foam layers ----
          // The foam is primarily driven by depth proximity (only near fragments)
          // and modulated by the noise for organic, bubbly appearance
          float waterlineFoam = depthProximity * waterlineActive;

          // Edge wave pattern: as camera bobs through the surface,
          // the waterline shifts. We add a wobbly edge based on the
          // signed distance to make the line feel like a natural wave edge.
          float edgeWobble = sin(screenPos.x * 40.0 + uTime * 4.0) * 0.02
                           + sin(screenPos.x * 25.0 - uTime * 3.0) * 0.015
                           + sin(screenPos.x * 65.0 + uTime * 6.0) * 0.008;
          float edgeLine = smoothstep(0.0, 0.08, depthProximity + edgeWobble);

          // Screen-edge foam: thicker at bottom of screen (water settles down)
          float bottomWeight = smoothstep(0.5, 0.0, screenPos.y);
          waterlineFoam *= 0.5 + bottomWeight * 0.8;

          // Apply noise patterns to the foam
          float foamPattern = mix(foamBubbles, foamSpray, 0.4) * 0.7 + drips * 0.3;
          waterlineFoam *= foamPattern;

          // Clamp and boost for visible foam
          waterlineFoam = clamp(waterlineFoam * 3.0, 0.0, 1.0);

          // ---- Foam colour: white with slight blue-green water tint ----
          vec3 waterlineFoamColor = vec3(0.92, 0.96, 1.0);
          // Mix in some translucent water colour for realism
          vec3 translucentEdge = mix(
            vec3(0.3, 0.7, 0.7),    // teal translucent water
            waterlineFoamColor,       // white foam
            foamPattern
          );

          // ---- Blend the waterline foam onto the water colour ----
          col = mix(col, translucentEdge, waterlineFoam * 0.8);

          // ---- Bright edge highlight at the exact waterline ----
          // A thin bright line right at the depth discontinuity
          float thinLine = smoothstep(0.0, 0.02, depthProximity)
                         * (1.0 - smoothstep(0.02, 0.06, depthProximity));
          thinLine *= waterlineActive;
          // Wobble the thin line for a wave-crest look
          thinLine *= 0.5 + 0.5 * sin(screenPos.x * 50.0 + uTime * 5.0);
          col = mix(col, vec3(1.0, 1.0, 1.0), thinLine * 0.6);

          // ---- Water droplets on the lens (above waterline) ----
          // Small bright dots that linger briefly as if the lens is wet
          float droplets = 0.0;
          for (int i = 0; i < 12; i++) {
            float fi = float(i);
            // Each droplet has a pseudo-random position on screen
            vec2 dropPos = vec2(
              fract(sin(fi * 53.23) * 437.58),
              fract(cos(fi * 71.17) * 312.43)
            );
            // Droplets slowly slide down (gravity)
            dropPos.y -= fract(uTime * 0.15 + fi * 0.1) * 0.3;
            // Only show droplets in the upper part (above waterline)
            float dropVisible = smoothstep(0.4, 0.6, dropPos.y) * waterlineActive;
            
            float d = length(screenPos - dropPos);
            // Droplet shape: small circle with soft edge
            float drop = smoothstep(0.015, 0.005, d) * dropVisible;
            // Fade droplets over time
            drop *= 0.5 + 0.5 * sin(uTime * 0.8 + fi * 2.0);
            droplets += drop;
          }
          // Droplets refract/brighten slightly
          col += vec3(0.15, 0.2, 0.22) * droplets;
        }

        // Underwater view
        if(uIsUnderwater) {
          col = mix(col, uWaterDeep, 0.3);
          float opacity = 0.6;
          gl_FragColor = vec4(col, opacity);
        } else {
          gl_FragColor = vec4(col, uOpacity);
        }
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  waterMesh = new THREE.Mesh(geometry, material);
  waterMesh.renderOrder = 1;
  scene.add(waterMesh);
}

// ============================================================
// BOAT
// ============================================================
function createBoat() {
  boat = new THREE.Group();

  // Hull
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, 0);
  hullShape.lineTo(2, 0);
  hullShape.lineTo(1.7, 1.5);
  hullShape.lineTo(0.3, 1.5);
  hullShape.lineTo(0, 0);

  const hullGeo = new THREE.BufferGeometry();
  // Build hull as a simple elongated shape
  const hullLength = 8;
  const hullWidth = 3;
  const hullHeight = 1.5;
  const hullDepth = 1.2;

  // Custom hull geometry
  const vertices = [];
  const indices = [];
  const normals = [];
  const segments = 16;

  // Bottom of hull (V-shaped)
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const z = (t - 0.5) * hullLength;
    const bowFactor = 1.0 - Math.pow(Math.abs(t - 0.5) * 2, 2);
    const w = hullWidth * 0.5 * bowFactor;
    const d = hullDepth * bowFactor;

    // Left bottom
    vertices.push(-w, -d, z);
    // Center bottom
    vertices.push(0, -d - 0.3 * bowFactor, z);
    // Right bottom
    vertices.push(w, -d, z);
    // Left top
    vertices.push(-w - 0.2 * bowFactor, hullHeight * 0.3, z);
    // Right top
    vertices.push(w + 0.2 * bowFactor, hullHeight * 0.3, z);
  }

  for (let i = 0; i < segments; i++) {
    const b = i * 5;
    const n = (i + 1) * 5;
    // Left side
    indices.push(b + 0, n + 0, b + 3); indices.push(n + 0, n + 3, b + 3);
    // Left bottom
    indices.push(b + 1, n + 1, b + 0); indices.push(n + 1, n + 0, b + 0);
    // Right bottom
    indices.push(b + 2, n + 2, b + 1); indices.push(n + 2, n + 1, b + 1);
    // Right side
    indices.push(b + 4, n + 4, b + 2); indices.push(n + 4, n + 2, b + 2);
  }

  const hullGeometry = new THREE.BufferGeometry();
  hullGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  hullGeometry.setIndex(indices);
  hullGeometry.computeVertexNormals();

  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.6,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  const hull = new THREE.Mesh(hullGeometry, hullMaterial);
  hull.castShadow = true;
  hull.receiveShadow = true;
  boat.add(hull);

  // Deck
  const deckGeo = new THREE.BoxGeometry(hullWidth * 0.85, 0.15, hullLength * 0.75);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xDEB887, roughness: 0.7 });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.y = hullHeight * 0.3;
  deck.castShadow = true;
  boat.add(deck);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(1.8, 1.2, 2.5);
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0xF5F5DC, roughness: 0.5 });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, hullHeight * 0.3 + 0.7, -0.5);
  cabin.castShadow = true;
  boat.add(cabin);

  // Cabin roof
  const roofGeo = new THREE.BoxGeometry(2.0, 0.1, 2.8);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, hullHeight * 0.3 + 1.35, -0.5);
  roof.castShadow = true;
  boat.add(roof);

  // Mast
  const mastGeo = new THREE.CylinderGeometry(0.06, 0.08, 6, 8);
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x8B7355 });
  const mast = new THREE.Mesh(mastGeo, mastMat);
  mast.position.set(0, hullHeight * 0.3 + 3, 1.5);
  mast.castShadow = true;
  boat.add(mast);

  // Flag
  const flagGeo = new THREE.PlaneGeometry(1.2, 0.8, 8, 4);
  const flagMat = new THREE.MeshStandardMaterial({
    color: 0xcc3333,
    side: THREE.DoubleSide,
    roughness: 0.9,
  });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(0.6, hullHeight * 0.3 + 5.5, 1.5);
  flag.userData.isFlag = true;
  boat.add(flag);

  // Railing posts
  for (let i = -3; i <= 3; i++) {
    if (Math.abs(i) < 1) continue;
    const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const bowFact = 1.0 - Math.pow(Math.abs(i / 3.5), 2);
    const w = hullWidth * 0.42 * bowFact;
    const postL = new THREE.Mesh(postGeo, postMat);
    postL.position.set(-w, hullHeight * 0.3 + 0.3, i * 0.9);
    boat.add(postL);
    const postR = new THREE.Mesh(postGeo, postMat);
    postR.position.set(w, hullHeight * 0.3 + 0.3, i * 0.9);
    boat.add(postR);
  }

  boat.position.set(10, 0.3, 10);
  scene.add(boat);

  // Water mask (invisible inside of boat to prevent water rendering inside)
  const maskGeo = new THREE.BoxGeometry(hullWidth * 0.75, hullHeight + 1.0, hullLength * 0.7);
  const maskMat = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    side: THREE.BackSide,
  });
  const waterMask = new THREE.Mesh(maskGeo, maskMat);
  waterMask.position.y = -0.2;
  waterMask.renderOrder = 0;
  boat.add(waterMask);
  boat.userData.waterMask = waterMask;

  // Physics — multi-point buoyancy with spring-damper stabilisation.
  // 12 sample points spread across the hull bottom provide torque resolution
  // for pitch and roll, preventing flipping. Each point contributes an
  // independent buoyancy force proportional to its submersion depth.
  boatPhysics = {
    velocity: new THREE.Vector3(0, 0, 0),
    angularVelocity: new THREE.Vector3(0, 0, 0),
    mass: 800,
    // Displaced volume per sample point (total hull volume / numPoints)
    volumePerPoint: (hullWidth * hullLength * hullDepth * 0.6) / 12,
    // 12 sample points: 4 rows × 3 columns across the hull bottom.
    // Wider spacing gives better torque leverage for roll stability,
    // bow/stern spacing gives pitch stability.
    samplePoints: [
      // Bow (front) — 3 points across the width
      new THREE.Vector3(-hullWidth * 0.25, -hullDepth * 0.6, hullLength * 0.4),
      new THREE.Vector3(0,                 -hullDepth * 0.8, hullLength * 0.4),
      new THREE.Vector3( hullWidth * 0.25, -hullDepth * 0.6, hullLength * 0.4),
      // Forward mid — 3 points
      new THREE.Vector3(-hullWidth * 0.35, -hullDepth * 0.5, hullLength * 0.15),
      new THREE.Vector3(0,                 -hullDepth * 0.9, hullLength * 0.15),
      new THREE.Vector3( hullWidth * 0.35, -hullDepth * 0.5, hullLength * 0.15),
      // Aft mid — 3 points
      new THREE.Vector3(-hullWidth * 0.35, -hullDepth * 0.5, -hullLength * 0.15),
      new THREE.Vector3(0,                 -hullDepth * 0.9, -hullLength * 0.15),
      new THREE.Vector3( hullWidth * 0.35, -hullDepth * 0.5, -hullLength * 0.15),
      // Stern (back) — 3 points
      new THREE.Vector3(-hullWidth * 0.25, -hullDepth * 0.6, -hullLength * 0.4),
      new THREE.Vector3(0,                 -hullDepth * 0.8, -hullLength * 0.4),
      new THREE.Vector3( hullWidth * 0.25, -hullDepth * 0.6, -hullLength * 0.4),
    ],
    // Waterline position on boat for foam rendering (world-space, updated each frame)
    waterlineY: 0,
    // Smoothed position/rotation for gentle motion
    smoothY: 0.3,
    smoothPitch: 0,
    smoothRoll: 0,
  };
}

// ============================================================
// GET WATER HEIGHT (for buoyancy)
// ============================================================
function getWaterHeight(x, z, time) {
  let h = 0;
  const windDirX = Math.cos(CONFIG.fft.windDirection);
  const windDirZ = Math.sin(CONFIG.fft.windDirection);

  // FFT approximation
  let amp = CONFIG.fft.amplitude;
  let freq = 0.03;
  for (let i = 0; i < 5; i++) {
    const dx = windDirX + (i * 0.3 - 0.6);
    const dz = windDirZ + (i * 0.2 - 0.4);
    const len = Math.sqrt(dx * dx + dz * dz);
    const ndx = dx / len, ndz = dz / len;
    const phase = (x * ndx + z * ndz) * freq - time * 0.5 * freq * CONFIG.fft.windSpeed * 0.1;
    h += Math.sin(phase) * amp;
    const nx = (x * freq + time * 0.1 * i) * 0.7;
    const nz = (z * freq + time * 0.05 * i) * 0.7;
    h += Math.sin(nx) * Math.cos(nz) * amp * 0.5;
    amp *= 0.55;
    freq *= 1.8;
  }

  // Gerstner waves
  if (CONFIG.gerstner.enabled) {
    const gs = CONFIG.gerstner.scale;
    for (const wave of CONFIG.gerstner.waves) {
      const k = (2 * Math.PI) / wave.wavelength;
      const c = Math.sqrt(9.81 / k) * wave.speed;
      const dx = wave.direction.x / wave.direction.length();
      const dz = wave.direction.y / wave.direction.length();
      const f = k * (dx * x + dz * z - c * time);
      h += wave.amplitude * gs * Math.sin(f);
    }
  }

  // ---- Arc waves: circular swell arcs from distant origin ----
  // Must match the GPU vertex shader logic so the boat tracks
  // the same wave surface that is being rendered.
  if (CONFIG.arcWaves.enabled) {
    const origin = CONFIG.arcWaves.origin;
    const arcScale = CONFIG.arcWaves.scale;
    for (let i = 0; i < CONFIG.arcWaves.count; i++) {
      const fi = i;
      // Layer parameters (must match vertex shader formulas)
      const layerAmp = CONFIG.arcWaves.amplitude * arcScale * (1.0 - fi * 0.25);
      const layerWL = CONFIG.arcWaves.wavelength * (1.0 - fi * 0.3);
      const layerSpd = CONFIG.arcWaves.speed * (1.0 + fi * 0.15);

      // Radial distance from arc wave origin
      const dx = x - origin.x;
      const dz = z - origin.y;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.01) continue;

      // Wave number and phase velocity
      const k = (2 * Math.PI) / layerWL;
      const c = Math.sqrt(9.81 / k) * layerSpd;

      // Phase based on radial distance (circular wavefronts)
      const f = k * (dist - c * time);

      // Amplitude falloff with distance (cylindrical spreading)
      const falloff = 1.0 / (1.0 + Math.sqrt(dist / 50.0) * 0.3);

      h += layerAmp * falloff * Math.sin(f);
    }
  }

  return h;
}

// ============================================================
// BUOYANCY PHYSICS
// ============================================================
// ============================================================
// KINEMATIC WAVE-FOLLOWING BUOYANCY
//
// Instead of a full force-based simulation (which can explode),
// this approach directly samples the wave surface at multiple
// hull points and fits the boat to that surface.
//
// How it works:
//   1. Sample wave height at 4 key hull points (bow, stern,
//      port, starboard).
//   2. Average height → boat Y position (with smoothing).
//   3. Fit a plane through the 4 points → derive pitch & roll
//      angles that follow the wave slope.
//   4. Slerp the boat's quaternion toward the wave-aligned
//      orientation each frame for smooth, natural rocking.
//
// This is unconditionally stable: no forces, no integration,
// no possibility of explosion. The boat simply "rides" the
// surface like a cork. Smoothing parameters control how
// tightly vs. lazily it follows.
// ============================================================
function updateBoatPhysics(dt) {
  if (!boat || !boatPhysics) return;

  dt = Math.min(dt, 0.033);
  const time = clock.elapsedTime;

  const boatPos = boat.position;

  // ============================================================
  // STEP 1: Sample wave heights at four hull extremities
  //
  // The four points are positioned at the bow (front), stern
  // (back), port (left), and starboard (right) of the hull.
  // These give us the wave slope in both the forward/back
  // (pitch) and left/right (roll) directions.
  // ============================================================

  // Half-dimensions of the hull for sampling offsets
  const halfLength = 3.5;  // fore/aft distance from centre
  const halfWidth  = 1.2;  // port/starboard distance

  // Get the boat's current forward and right vectors in world space
  // so samples follow the hull orientation
  const fwd   = new THREE.Vector3(0, 0, 1).applyQuaternion(boat.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(boat.quaternion);

  // Bow sample (front of hull)
  const bowX  = boatPos.x + fwd.x * halfLength;
  const bowZ  = boatPos.z + fwd.z * halfLength;
  const hBow  = getWaterHeight(bowX, bowZ, time);

  // Stern sample (back of hull)
  const sternX = boatPos.x - fwd.x * halfLength;
  const sternZ = boatPos.z - fwd.z * halfLength;
  const hStern = getWaterHeight(sternX, sternZ, time);

  // Port sample (left side)
  const portX = boatPos.x - right.x * halfWidth;
  const portZ = boatPos.z - right.z * halfWidth;
  const hPort = getWaterHeight(portX, portZ, time);

  // Starboard sample (right side)
  const stbdX = boatPos.x + right.x * halfWidth;
  const stbdZ = boatPos.z + right.z * halfWidth;
  const hStbd = getWaterHeight(stbdX, stbdZ, time);

  // Centre sample (directly beneath the boat)
  const hCentre = getWaterHeight(boatPos.x, boatPos.z, time);

  // ============================================================
  // STEP 2: Compute target Y position
  //
  // Average of all 5 samples gives a stable height estimate.
  // We weight the centre point higher to reduce oscillation.
  // The hullDraft offset keeps the deck above the waterline.
  // ============================================================
  const avgHeight = (hBow + hStern + hPort + hStbd + hCentre * 2.0) / 6.0;
  const hullDraft = 0.3; // how far the deck sits above water
  const targetY = avgHeight + hullDraft;

  // Smooth Y tracking: exponential moving average.
  // Higher alpha = tighter tracking (follows every ripple).
  // Lower alpha = smoother (lags behind, but no jitter).
  // 0.04 gives a gentle, realistic bob with ~0.4s response time.
  const yAlpha = 0.04;
  boatPhysics.smoothY += (targetY - boatPhysics.smoothY) * yAlpha;
  boatPos.y = boatPhysics.smoothY;
  boatPhysics.waterlineY = avgHeight;

  // ============================================================
  // STEP 3: Compute target pitch and roll from wave slope
  //
  // Pitch = rotation about the boat's local X axis (bow up/down)
  //   Derived from the height difference between bow and stern.
  //   atan2(Δh, distance) gives the angle of the wave slope.
  //
  // Roll = rotation about the boat's local Z axis (lean left/right)
  //   Derived from the height difference between port and starboard.
  //
  // Both are attenuated by 0.5 to make the boat feel heavier
  // than a perfect surface follower (real boats have inertia).
  // ============================================================
  const pitchAngle = Math.atan2(hBow - hStern, halfLength * 2.0) * 0.5;
  const rollAngle  = Math.atan2(hStbd - hPort, halfWidth * 2.0) * 0.5;

  // Clamp angles to prevent extreme tilts in steep waves
  const maxPitch = 0.3;  // ~17° max pitch
  const maxRoll  = 0.25; // ~14° max roll
  const clampedPitch = Math.max(-maxPitch, Math.min(maxPitch, pitchAngle));
  const clampedRoll  = Math.max(-maxRoll, Math.min(maxRoll, rollAngle));

  // Smooth the pitch and roll targets to prevent snapping
  boatPhysics.smoothPitch += (clampedPitch - boatPhysics.smoothPitch) * 0.03;
  boatPhysics.smoothRoll  += (clampedRoll - boatPhysics.smoothRoll) * 0.03;

  // ============================================================
  // STEP 4: Build target quaternion and slerp toward it
  //
  // We reconstruct the target orientation from:
  //   - Current yaw (preserved from boat's existing rotation)
  //   - Smoothed pitch and roll from wave slope
  //
  // Slerp (spherical linear interpolation) provides smooth,
  // framerate-independent rotation blending. Factor 0.04
  // gives approximately 0.7s convergence time — natural for
  // a heavy boat rocking on swells.
  // ============================================================
  const currentEuler = new THREE.Euler().setFromQuaternion(boat.quaternion, 'YXZ');
  const targetEuler = new THREE.Euler(
    boatPhysics.smoothPitch,   // pitch (X rotation)
    currentEuler.y,             // yaw (Y rotation) — preserved
    boatPhysics.smoothRoll,    // roll (Z rotation)
    'YXZ'
  );
  const targetQuat = new THREE.Quaternion().setFromEuler(targetEuler);
  boat.quaternion.slerp(targetQuat, 0.04);

  // ============================================================
  // STEP 5: Animate the flag (wind flutter)
  //
  // Each vertex is displaced in Z based on its X position
  // (distance from the mast). The sine wave creates a
  // rippling cloth effect that intensifies toward the free edge.
  // ============================================================
  boat.traverse((child) => {
    if (child.userData.isFlag && child.geometry) {
      const posArr = child.geometry.attributes.position;
      const orig = child.geometry.userData.original || posArr.array.slice();
      if (!child.geometry.userData.original) child.geometry.userData.original = orig;

      for (let i = 0; i < posArr.count; i++) {
        const x = orig[i * 3];
        const z = orig[i * 3 + 2];
        const wave = Math.sin(x * 4 + time * 5) * 0.1 * (x + 0.6);
        posArr.setZ(i, z + wave);
      }
      posArr.needsUpdate = true;
    }
  });
}

// ============================================================
// POST PROCESSING (underwater effects)
// ============================================================
function setupPostProcessing() {
  underwaterPostProcessing = {
    renderTarget: new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight),
    aboveWaterTarget: new THREE.WebGLRenderTarget(
      Math.floor(window.innerWidth * 0.5),
      Math.floor(window.innerHeight * 0.5),
      { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }
    ),
    quad: null,
    material: null,
  };

  // ---- Total Internal Reflection render target ----
  // This captures the underwater scene from a vertically-flipped camera
  // (looking downward from the surface) to simulate the mirror-like
  // reflection seen outside Snell's window. In real physics, light
  // hitting the water-air boundary beyond the critical angle (~48.6°)
  // is 100% reflected back down, so the underside of the surface
  // acts as a perfect mirror of the underwater world.
  tirRenderTarget = new THREE.WebGLRenderTarget(
    Math.floor(window.innerWidth * 0.5),
    Math.floor(window.innerHeight * 0.5),
    { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }
  );

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: null },
      uTime: { value: 0 },
      uIsUnderwater: { value: false },
      uDistortionAmount: { value: CONFIG.underwater.distortionAmount },
      uDistortionSpeed: { value: CONFIG.underwater.distortionSpeed },
      uFogDensity: { value: CONFIG.underwater.fogDensity },
      uFogColor: { value: CONFIG.underwater.fogColor.clone() },
      uScreenSize: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uAboveWaterTexture: { value: null },
      uSnellWindowRadius: { value: 0.45 },
      uSnellWindowEdgeSoftness: { value: 0.25 },
      uCameraDir: { value: new THREE.Vector3(0, 0, -1) },
      uCameraUpDot: { value: 0 },
      // Total Internal Reflection: the vertically-flipped underwater scene
      // sampled outside Snell's window to simulate the mirror effect
      uTIRTexture: { value: null },
      uTIRStrength: { value: 0.6 },
      // Fresnel blend: controls how strongly the physically-based
      // Fresnel transition replaces the hard window/TIR boundary.
      // At 1.0, uses real Fresnel equations; at 0.0, falls back
      // to the simple smoothstep mask.
      uFresnelBlend: { value: 1.0 },
      // Camera-to-water signed distance for waterline transition
      uCameraWaterDist: { value: 10.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform sampler2D uAboveWaterTexture;
      uniform float uTime;
      uniform bool uIsUnderwater;
      uniform float uDistortionAmount;
      uniform float uDistortionSpeed;
      uniform float uFogDensity;
      uniform vec3 uFogColor;
      uniform vec2 uScreenSize;
      uniform float uSnellWindowRadius;
      uniform float uSnellWindowEdgeSoftness;
      uniform vec3 uCameraDir;
      uniform float uCameraUpDot;
      // Total Internal Reflection texture: the underwater scene rendered
      // from a vertically-flipped camera, used as a mirror image outside
      // Snell's window where light undergoes total internal reflection
      uniform sampler2D uTIRTexture;
      uniform float uTIRStrength;
      // Fresnel blend: 0 = simple smoothstep mask, 1 = physically-based
      // Fresnel equations (smooth angular transition from refraction to TIR)
      uniform float uFresnelBlend;
      // Camera-water distance for waterline foam overlay
      uniform float uCameraWaterDist;
      varying vec2 vUv;

      // -------------------------------------------------------
      // Hash helper: deterministic pseudo-random from a 2D seed
      // Uses the classic dot-product + fract trick
      // -------------------------------------------------------
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      // -------------------------------------------------------
      // Value noise: bilinear interpolation of hashed lattice
      // Returns smooth noise in [0,1] for procedural patterns
      // -------------------------------------------------------
      float valueNoise(vec2 p) {
        vec2 i = floor(p);         // integer lattice cell
        vec2 f = fract(p);         // fractional position inside cell
        f = f * f * (3.0 - 2.0 * f); // cubic Hermite smoothstep for C1 continuity

        // Four corner hashes, bilinearly interpolated
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // -------------------------------------------------------
      // FBM (Fractal Brownian Motion): stacks multiple octaves
      // of value noise with halving amplitude & doubling freq
      // to create natural-looking multi-scale detail
      // -------------------------------------------------------
      float fbm(vec2 p) {
        float v = 0.0;
        float amp = 0.5;
        // 5 octaves: each adds finer detail at lower amplitude
        for (int i = 0; i < 5; i++) {
          v += amp * valueNoise(p);
          p *= 2.0;    // double frequency (zoom in)
          amp *= 0.5;  // halve contribution
        }
        return v;
      }

      // -------------------------------------------------------
      // Volumetric god-rays via radial marching
      // Samples along the line from each pixel toward the sun's
      // screen position, accumulating bright values to simulate
      // light scattering through the water column.
      // -------------------------------------------------------
      float godRays(vec2 uv, vec2 lightPos, float time) {
        // Direction from this pixel toward the sun
        vec2 delta = (lightPos - uv);
        float dist = length(delta);
        delta /= dist; // normalize direction

        // Step size: we take 48 samples along the ray
        float stepSize = min(dist, 0.5) / 48.0;
        vec2 stepDir = delta * stepSize;

        float accumLight = 0.0;
        vec2 samplePos = uv;

        // Progressive decay simulates light attenuation with distance
        float decay = 0.97;   // each step keeps 97% of the previous
        float weight = 1.0;

        for (int i = 0; i < 48; i++) {
          samplePos += stepDir;

          // Sample scene brightness at this point along the ray
          vec3 sampleCol = texture2D(uTexture, clamp(samplePos, 0.0, 1.0)).rgb;
          // Luminance weighting: bright areas contribute more
          float brightness = dot(sampleCol, vec3(0.299, 0.587, 0.114));

          // Noise modulation makes rays feel organic, not uniform
          float noise = fbm(samplePos * 8.0 + time * 0.3);
          brightness *= (0.7 + noise * 0.6);

          accumLight += brightness * weight;
          weight *= decay; // attenuate further samples
        }

        return accumLight / 48.0; // normalize by sample count
      }

      // -------------------------------------------------------
      // Animated caustic pattern (water ripple light)
      // Two rotating noise layers are multiplied together;
      // the interference creates bright diamond-shaped caustic
      // shapes that drift and shimmer over time.
      // -------------------------------------------------------
      float causticsPattern(vec2 uv, float time) {
        // Layer 1: noise field rotating slowly clockwise
        float angle1 = time * 0.15;
        // 2D rotation matrix applied to UV
        mat2 rot1 = mat2(cos(angle1), -sin(angle1), sin(angle1), cos(angle1));
        float c1 = fbm(rot1 * uv * 6.0 + time * 0.4);

        // Layer 2: noise field rotating counter-clockwise at different speed
        float angle2 = -time * 0.12;
        mat2 rot2 = mat2(cos(angle2), -sin(angle2), sin(angle2), cos(angle2));
        float c2 = fbm(rot2 * (uv + vec2(3.7, 1.2)) * 7.0 - time * 0.3);

        // Multiply layers: only where BOTH are bright do we see a caustic
        // This creates the characteristic diamond/network pattern
        float caustic = c1 * c2;

        // Sharpen with power curve and boost contrast
        return pow(caustic, 0.8) * 2.5;
      }

      // -------------------------------------------------------
      // Surface ripple light: simulates the dancing light pattern
      // seen on the underside of the water surface when viewed
      // from below. Uses overlapping sine waves at different
      // scales/angles to mimic real wave-refracted sunlight.
      // -------------------------------------------------------
      float surfaceRippleLight(vec2 uv, float time) {
        float ripple = 0.0;
        // Four overlapping wave directions create interference pattern
        // Each has different frequency, direction, and phase speed

        // Wave 1: diagonal, large scale
        ripple += sin(uv.x * 12.0 + uv.y * 8.0 + time * 1.5) * 0.25;
        // Wave 2: opposite diagonal, medium scale
        ripple += sin(uv.x * -9.0 + uv.y * 15.0 + time * -1.2) * 0.2;
        // Wave 3: mostly horizontal, fine detail
        ripple += sin(uv.x * 20.0 + uv.y * 3.0 + time * 2.0) * 0.15;
        // Wave 4: mostly vertical, medium detail
        ripple += sin(uv.x * 5.0 + uv.y * -18.0 + time * 1.8) * 0.18;

        // Smooth noise layer adds organic variation
        ripple += fbm(uv * 4.0 + time * 0.2) * 0.3;

        // Map to [0, 1] and sharpen: pow() concentrates bright areas
        return pow(clamp(ripple * 0.5 + 0.5, 0.0, 1.0), 1.5);
      }

      void main() {
        vec2 uv = vUv;

        if(uIsUnderwater) {
          // ==============================================
          // MULTI-LAYER DISTORTION
          // Three sine-based UV offsets at different
          // frequencies create organic, non-repeating
          // underwater waviness
          // ==============================================
          float distort = uDistortionAmount;
          float spd = uDistortionSpeed;
          // Low-freq sway
          uv.x += sin(uv.y * 12.0 + uTime * spd * 1.3) * distort * 1.2;
          uv.y += cos(uv.x * 10.0 + uTime * spd * 1.0) * distort * 0.9;
          // Mid-freq ripple
          uv.x += sin(uv.y * 25.0 + uTime * spd * 2.5) * distort * 0.4;
          uv.y += cos(uv.x * 22.0 + uTime * spd * 2.0) * distort * 0.35;
          // High-freq shimmer (subtle)
          uv.x += sin(uv.y * 50.0 + uTime * spd * 4.0) * distort * 0.12;

          vec4 col = texture2D(uTexture, clamp(uv, 0.0, 1.0));

          // ==============================================
          // DEPTH-BASED FOG: heavier fog toward bottom of
          // screen (further from surface). Uses a quadratic
          // curve so the top stays clearer.
          // ==============================================
          float depthGradient = 1.0 - vUv.y; // 0 at top, 1 at bottom
          // Quadratic ramp makes fog thicken faster with depth
          float fogAmount = uFogDensity * (1.5 + depthGradient * depthGradient * 6.0);
          // Slightly shift fog color: greener near surface, bluer at depth
          vec3 fogCol = mix(
            uFogColor * vec3(0.8, 1.1, 1.0),  // near-surface: slightly green
            uFogColor * vec3(0.6, 0.7, 1.2),   // deep: deeper blue
            depthGradient
          );
          col.rgb = mix(col.rgb, fogCol, clamp(fogAmount, 0.0, 0.85));

          // ==============================================
          // UNDERWATER COLOUR GRADING
          // Physically, water absorbs red first, then green;
          // blue penetrates deepest. We attenuate R and G
          // based on screen-space depth proxy.
          // ==============================================
          col.r *= 0.45 + 0.15 * vUv.y;   // red drops off fast at depth
          col.g *= 0.7 + 0.15 * vUv.y;    // green less so
          col.b *= 1.05 + 0.1 * (1.0 - vUv.y); // blue slightly boosted at depth

          // ==============================================
          // CAUSTIC LIGHT PATTERNS ON EVERYTHING
          // These simulate the rippling bright patterns
          // cast by wave-refracted sunlight onto surfaces.
          // We project them in screen space, with intensity
          // fading toward the bottom (further from light).
          // ==============================================
          // Two caustic layers at different scales for complexity
          float caustic1 = causticsPattern(vUv, uTime);
          float caustic2 = causticsPattern(vUv * 1.5 + vec2(2.3, 1.7), uTime * 0.8);
          // Combine with max for bright intersections
          float caustics = max(caustic1, caustic2 * 0.7);
          // Fade caustics with depth: strong near surface, faint at bottom
          float causticsFade = smoothstep(0.0, 0.8, vUv.y); // stronger near top
          causticsFade *= (1.0 - depthGradient * 0.7); // weaker far from surface
          // Warm amber caustic light from sunset sun filtering through water
          vec3 causticsColor = vec3(0.55, 0.35, 0.15) * caustics * causticsFade * 0.4;
          // Subtle cooler secondary caustic layer for depth
          causticsColor += vec3(0.15, 0.25, 0.3) * caustics * causticsFade * 0.15;
          col.rgb += causticsColor;

          // ==============================================
          // SURFACE RIPPLE LIGHT (dancing light seen on
          // objects near the surface — the classic underwater
          // "swimming pool" light pattern)
          // ==============================================
          float ripple = surfaceRippleLight(vUv, uTime);
          // Only visible in the upper half of the view
          float rippleMask = smoothstep(0.3, 0.9, vUv.y);
          // Warm sunset ripple light instead of teal
          col.rgb += vec3(0.4, 0.25, 0.12) * ripple * rippleMask * 0.25;

          // ==============================================
          // VOLUMETRIC GOD-RAYS from the sunset sun
          //
          // The sun is low on the horizon, so god-rays enter the
          // water at a steep angle. The screen-space sun position
          // is offset to the right (matching the sunset sun direction)
          // and the ray colour is warm amber, not teal, because
          // at sunset the sun's spectrum is already red-shifted
          // by atmospheric Rayleigh scattering before entering the water.
          //
          // Water then further absorbs the remaining blue, making
          // underwater sunset god-rays intensely warm/golden.
          // ==============================================
          vec2 sunScreenPos = vec2(
            0.65 + sin(uTime * 0.1) * 0.08,  // offset right, gentle sway
            1.0  // near top edge (low sun enters at steep angle)
          );

          float rays = godRays(vUv, sunScreenPos, uTime);
          float rayFade = smoothstep(0.15, 0.95, vUv.y);
          // Warm amber god-ray tint for sunset (not teal)
          vec3 rayColor = vec3(0.6, 0.35, 0.12) * rays * rayFade * 2.2;
          // Add a secondary cooler component for depth
          rayColor += vec3(0.15, 0.3, 0.35) * rays * rayFade * 0.6;
          col.rgb += rayColor;

          // ==============================================
          // SECONDARY SCATTERED LIGHT SHAFTS
          // Wider, softer god-ray beams that sweep slowly
          // across the scene, simulating wave-lensed light.
          // Each beam is a Gaussian falloff from a moving
          // center line, multiplied by a noise texture for
          // organic breakup.
          // ==============================================
          float shafts = 0.0;
          for (int i = 0; i < 5; i++) {
            float fi = float(i);
            // Each shaft has a unique horizontal position that drifts with time
            // Golden-ratio-based offsets ensure even spacing
            float shaftX = fract(fi * 0.618 + uTime * (0.04 + fi * 0.008));
            // Gaussian beam profile: exp(-x²/σ²) gives smooth bell curve
            float beamWidth = 0.06 + fi * 0.015;
            float beam = exp(-pow((vUv.x - shaftX) / beamWidth, 2.0));
            // Vertical: strongest at top, fading down
            beam *= smoothstep(0.1, 0.95, vUv.y);
            // Noise modulation breaks up the beam into dappled light
            float noiseBreakup = fbm(vec2(vUv.x * 5.0 + fi, vUv.y * 3.0 + uTime * 0.2));
            beam *= (0.5 + noiseBreakup * 0.8);
            // Oscillating intensity makes beams pulse gently
            beam *= 0.5 + 0.5 * sin(uTime * 0.5 + fi * 1.5);
            shafts += beam;
          }
          // Warm amber shafts for sunset light filtering through water
          col.rgb += vec3(0.45, 0.25, 0.1) * shafts * 0.3;

          // ==============================================
          // BRIGHT SPOT directly under the sun
          // Simulates the visible disc of the sun seen
          // through the water surface (Snell's window).
          // Smoothstep creates a soft-edged circular glow.
          // ==============================================
          float sunGlow = smoothstep(0.35, 0.0, length(vUv - sunScreenPos));
          col.rgb += vec3(0.5, 0.8, 0.7) * sunGlow * 0.5;
          // Tighter bright core
          float sunCore = smoothstep(0.12, 0.0, length(vUv - sunScreenPos));
          col.rgb += vec3(0.6, 0.9, 0.8) * sunCore * 0.4;

          // ==============================================
          // FLOATING PARTICLES (dust/plankton motes)
          // Small bright dots scattered via hash noise,
          // animated with sine-based drift. Adds life to
          // the underwater scene.
          // ==============================================
          float particles = 0.0;
          for (int i = 0; i < 30; i++) {
            float fi = float(i);
            // Deterministic pseudo-random position for each particle
            vec2 particlePos = vec2(
              fract(sin(fi * 73.23) * 437.58),
              fract(cos(fi * 91.17) * 312.43)
            );
            // Slow drifting animation: each particle sways independently
            particlePos.x += sin(uTime * 0.3 + fi * 0.7) * 0.05;
            particlePos.y += cos(uTime * 0.2 + fi * 0.5) * 0.03;
            particlePos = fract(particlePos); // wrap around edges

            // Distance from pixel to particle center
            float d = length(vUv - particlePos);
            // Tiny bright dot with soft falloff
            float brightness = smoothstep(0.008, 0.001, d);
            // Twinkle: sinusoidal fade in/out per particle
            brightness *= 0.5 + 0.5 * sin(uTime * 1.5 + fi * 2.0);
            particles += brightness;
          }
          col.rgb += vec3(0.5, 0.8, 0.7) * particles * 0.4;

          // ==============================================
          // VIGNETTE: darkens edges for a goggle/porthole
          // feel. Uses distance from center squared for a
          // natural radial falloff.
          // ==============================================
          float vig = length(vUv - 0.5) * 1.4;
          col.rgb *= 1.0 - vig * vig * 0.6;

          // ==============================================
          // WATER SURFACE LINE at top of viewport
          // A bright horizontal band suggesting the
          // air-water interface seen from below
          // ==============================================
          float surfaceLine = smoothstep(0.94, 0.99, vUv.y);
          // Wobbly edge using sine waves for wave-like deformation
          float wobble = sin(vUv.x * 30.0 + uTime * 2.0) * 0.01
                       + sin(vUv.x * 50.0 - uTime * 3.0) * 0.005;
          float surfaceLine2 = smoothstep(0.93 + wobble, 0.97 + wobble, vUv.y);
          // Bright teal surface glow
          col.rgb = mix(col.rgb, vec3(0.5, 0.9, 1.0), surfaceLine2 * 0.6);
          // Brighter at the very top
          col.rgb = mix(col.rgb, vec3(0.7, 1.0, 1.0), surfaceLine * 0.3);

          // ==============================================
          // SNELL'S WINDOW EFFECT
          // When light passes from water (n≈1.33) to air (n≈1.0),
          // total internal reflection occurs at angles greater
          // than the critical angle θc = arcsin(n_air / n_water)
          //   θc = arcsin(1.0 / 1.33) ≈ 48.6°
          //
          // This means an underwater observer looking up sees
          // the above-water world compressed into a circular
          // cone of ~48.6° half-angle — called "Snell's window".
          // Outside this cone, the surface acts as a perfect
          // mirror reflecting the underwater scene.
          //
          // We implement this by:
          // 1. Computing the angular distance from view-up in
          //    screen space (approximated as distance from a
          //    screen-space center point shifted by camera pitch)
          // 2. Inside the cone: blend in the above-water texture
          //    with chromatic aberration for refraction dispersion
          // 3. At the boundary: bright caustic ring (Fresnel peak)
          // 4. Outside: total internal reflection (just underwater)
          // ==============================================

          // uCameraUpDot = dot(cameraForward, worldUp)
          // When looking straight up: ~1.0, horizontally: ~0.0, down: ~-1.0
          // The Snell's window center is where the vertical (up) direction
          // projects onto the screen. When looking up, it's near screen center.
          // When looking sideways, it moves toward the top of the screen.

          // Approximate the screen-space position of "straight up" direction
          // The window is centred above us — its screen position depends on
          // how much we're looking up vs. horizontally.
          // When cameraUpDot=1 (looking straight up): center of screen
          // When cameraUpDot=0 (looking horizontally): top edge of screen
          float upDot = uCameraUpDot; // dot(camForward, vec3(0,1,0))

          // Map upDot to the Y position of Snell's window center on screen
          // Looking straight up (upDot≈1): window center at screen center (0.5)
          // Looking horizontally (upDot≈0): window center above screen (>1.0)
          float windowCenterY = mix(1.4, 0.5, clamp(upDot * 1.2, 0.0, 1.0));
          vec2 windowCenter = vec2(0.5, windowCenterY);

          // Distance from pixel to window center in screen space
          // Correct for aspect ratio so the window is circular, not elliptical
          float aspect = uScreenSize.x / uScreenSize.y;
          vec2 delta = vUv - windowCenter;
          delta.x *= aspect; // stretch X so circular in world = circular on screen

          float distFromCenter = length(delta);

          // Snell's window angular radius mapped to screen-space radius.
          // The critical angle is ~48.6°. In screen space, the apparent
          // radius depends on FOV and how far up we're looking.
          // uSnellWindowRadius is a tunable parameter (~0.45 default).
          // When looking more upward, the window appears larger on screen.
          float windowRadius = uSnellWindowRadius * (0.5 + upDot * 0.7);

          // Edge softness controls the transition band width
          float edgeSoft = uSnellWindowEdgeSoftness;

          // Normalized distance: 0 at center, 1 at edge of Snell's window
          float normalizedDist = distFromCenter / max(windowRadius, 0.001);

          // ==============================================
          // PHYSICALLY-BASED FRESNEL REFLECTANCE
          //
          // In real optics, the reflectance at a water-air boundary
          // follows the Fresnel equations. For light going from water
          // (n1 = 1.33) to air (n2 = 1.0):
          //
          //   θi = incidence angle (from surface normal, i.e. from "up")
          //   sin(θt) = (n1/n2) * sin(θi)   — Snell's law
          //
          // When sin(θt) >= 1.0, no refracted ray exists → Total Internal
          // Reflection (TIR). This happens at the critical angle:
          //   θc = arcsin(n2/n1) = arcsin(1/1.33) ≈ 48.6°
          //
          // Below θc, the Fresnel reflectance for unpolarized light is:
          //   R = 0.5 * [ ((n1·cosθi - n2·cosθt)/(n1·cosθi + n2·cosθt))²
          //             + ((n1·cosθt - n2·cosθi)/(n1·cosθt + n2·cosθi))² ]
          //
          // This gives ~2% reflection at normal incidence (looking straight
          // up) and ramps to 100% at the critical angle. The Schlick
          // approximation captures this behaviour with a power curve:
          //   R ≈ R0 + (1 - R0) * (1 - cosθi)^5
          // where R0 = ((n1-n2)/(n1+n2))² ≈ 0.02 for water-air.
          //
          // We blend between the old sharp smoothstep mask and this
          // physically-accurate Fresnel curve using uFresnelBlend.
          // ==============================================

          // ==============================================
          // WAVELENGTH-DEPENDENT FRESNEL REFLECTANCE
          //
          // Water's refractive index varies with wavelength (dispersion):
          //   Red   (λ ≈ 650nm): n ≈ 1.331
          //   Green (λ ≈ 550nm): n ≈ 1.335
          //   Blue  (λ ≈ 450nm): n ≈ 1.341
          //
          // This means each colour channel has a slightly different
          // critical angle and Fresnel curve:
          //   θc_red   = arcsin(1/1.331) ≈ 48.72°
          //   θc_green = arcsin(1/1.335) ≈ 48.49°
          //   θc_blue  = arcsin(1/1.341) ≈ 48.21°
          //
          // Blue light hits TIR first (smallest critical angle),
          // then green, then red — creating a subtle rainbow-like
          // dispersion halo at the Snell's window boundary, similar
          // to how a prism splits white light.
          //
          // We compute separate Fresnel reflectance per channel:
          //   fresnelR_rgb = vec3(R_red, R_green, R_blue)
          // ==============================================

          // Per-channel refractive indices (water → air)
          vec3 n1_rgb = vec3(1.331, 1.335, 1.341); // water IOR per wavelength
          float n2 = 1.0;  // air

          // Per-channel critical angles:
          // θc = arcsin(n2 / n1) — the angle beyond which TIR occurs
          vec3 criticalAngles = vec3(
            asin(n2 / n1_rgb.r),  // red:   ~0.8486 rad
            asin(n2 / n1_rgb.g),  // green: ~0.8472 rad
            asin(n2 / n1_rgb.b)   // blue:  ~0.8454 rad
          );

          // Use a reference critical angle (green) for the base mapping
          float criticalAngle = criticalAngles.g;

          // Map normalizedDist to incidence angle θi.
          // normalizedDist=0 → θi=0 (looking straight up, normal incidence)
          // normalizedDist=1 → θi=criticalAngle (~48.5°)
          // normalizedDist>1 → θi > criticalAngle (TIR region)
          float thetaI = clamp(normalizedDist * criticalAngle, 0.0, 1.5707);

          float cosI = cos(thetaI);
          float sinI = sin(thetaI);

          // ---- Per-channel Fresnel reflectance computation ----
          // For each RGB channel, apply Snell's law with its own IOR
          // and compute the exact Fresnel equations for unpolarized light.
          vec3 fresnelR_rgb;

          // Snell's law per channel: sinθt = (n1/n2) · sinθi
          vec3 sinT_rgb = (n1_rgb / n2) * sinI;

          // Red channel Fresnel
          if (sinT_rgb.r >= 1.0) {
            fresnelR_rgb.r = 1.0; // TIR for red
          } else {
            float cosT_r = sqrt(1.0 - sinT_rgb.r * sinT_rgb.r);
            float rs_r = (n1_rgb.r * cosI - n2 * cosT_r) / (n1_rgb.r * cosI + n2 * cosT_r);
            float rp_r = (n1_rgb.r * cosT_r - n2 * cosI) / (n1_rgb.r * cosT_r + n2 * cosI);
            fresnelR_rgb.r = 0.5 * (rs_r * rs_r + rp_r * rp_r);
          }

          // Green channel Fresnel
          if (sinT_rgb.g >= 1.0) {
            fresnelR_rgb.g = 1.0; // TIR for green
          } else {
            float cosT_g = sqrt(1.0 - sinT_rgb.g * sinT_rgb.g);
            float rs_g = (n1_rgb.g * cosI - n2 * cosT_g) / (n1_rgb.g * cosI + n2 * cosT_g);
            float rp_g = (n1_rgb.g * cosT_g - n2 * cosI) / (n1_rgb.g * cosT_g + n2 * cosI);
            fresnelR_rgb.g = 0.5 * (rs_g * rs_g + rp_g * rp_g);
          }

          // Blue channel Fresnel
          if (sinT_rgb.b >= 1.0) {
            fresnelR_rgb.b = 1.0; // TIR for blue
          } else {
            float cosT_b = sqrt(1.0 - sinT_rgb.b * sinT_rgb.b);
            float rs_b = (n1_rgb.b * cosI - n2 * cosT_b) / (n1_rgb.b * cosI + n2 * cosT_b);
            float rp_b = (n1_rgb.b * cosT_b - n2 * cosI) / (n1_rgb.b * cosT_b + n2 * cosI);
            fresnelR_rgb.b = 0.5 * (rs_b * rs_b + rp_b * rp_b);
          }

          // Scalar Fresnel for masks (average of channels)
          float fresnelR = dot(fresnelR_rgb, vec3(0.333));

          // fresnelR_rgb: each channel goes from ~0.02 at center to 1.0
          // at its own critical angle. In the narrow band between blue's
          // critical angle and red's critical angle (~0.5° difference),
          // blue is already at TIR (R=1.0) while red is still partially
          // transmitting — creating a rainbow-like colour fringe.

          // ---- Legacy sharp smoothstep mask for comparison ----
          float sharpMask = 1.0 - smoothstep(1.0 - edgeSoft, 1.0 + edgeSoft, normalizedDist);

          // ---- Per-channel window transmission masks ----
          // T_rgb = 1 - R_rgb: how much of each colour passes through
          // the window. Blue drops to zero first (highest IOR → smallest
          // critical angle), then green, then red.
          vec3 fresnelTransmission_rgb = vec3(1.0) - fresnelR_rgb;

          // Blend between legacy sharp mask and per-channel Fresnel
          vec3 windowMask_rgb = mix(vec3(sharpMask), fresnelTransmission_rgb, uFresnelBlend);

          // Scalar window mask for overall blending logic
          float windowMask = dot(windowMask_rgb, vec3(0.333));

          // Only apply when looking somewhat upward
          float lookUpFactor = smoothstep(-0.1, 0.3, upDot);
          windowMask *= lookUpFactor;
          windowMask_rgb *= lookUpFactor;

          // ---- Per-channel TIR masks ----
          // The TIR contribution per channel — blue reflects most first,
          // creating the chromatic split in the TIR mirror image.
          vec3 tirMask_rgb = mix(vec3(1.0 - sharpMask), fresnelR_rgb, uFresnelBlend);
          tirMask_rgb *= lookUpFactor;

          float tirMask = dot(tirMask_rgb, vec3(0.333));
          tirMask *= lookUpFactor;

          if (windowMask > 0.001) {
            // ---- Sample above-water scene with refraction ----
            // Refraction bends light at the water-air interface.
            // Chromatic aberration: different wavelengths (R,G,B)
            // refract at slightly different angles because the
            // refractive index of water varies with wavelength
            // (dispersion). Red bends least, blue bends most.

            // Direction from window center, used to compute
            // radial refraction offset
            vec2 refractDir = normalize(delta + vec2(0.0001));

            // Refraction magnification: objects appear ~25% closer/larger
            // through Snell's window due to the index ratio (1/1.33 ≈ 0.75)
            // We compress UVs toward the center to simulate this.
            float refractionScale = 0.75;
            vec2 baseRefractUV = windowCenter + (vUv - windowCenter) * refractionScale;

            // Chromatic aberration offsets (dispersion)
            // Red: smallest offset (longest wavelength, least refraction)
            // Blue: largest offset (shortest wavelength, most refraction)
            float chromaStrength = 0.008 * normalizedDist; // stronger at edges
            vec2 uvR = baseRefractUV + refractDir * chromaStrength * 0.5;
            vec2 uvG = baseRefractUV;
            vec2 uvB = baseRefractUV - refractDir * chromaStrength * 1.0;

            // Add wave-animated distortion to the refracted view
            // This makes the above-water world shimmer as seen through waves
            float waveDistort = 0.006;
            vec2 waveDelta = vec2(
              sin(vUv.y * 20.0 + uTime * 2.0) * waveDistort,
              cos(vUv.x * 18.0 + uTime * 1.7) * waveDistort
            );
            uvR += waveDelta;
            uvG += waveDelta * 0.8;
            uvB += waveDelta * 0.6;

            // Sample above-water texture per channel
            float aboveR = texture2D(uAboveWaterTexture, clamp(uvR, 0.0, 1.0)).r;
            float aboveG = texture2D(uAboveWaterTexture, clamp(uvG, 0.0, 1.0)).g;
            float aboveB = texture2D(uAboveWaterTexture, clamp(uvB, 0.0, 1.0)).b;
            vec3 aboveColor = vec3(aboveR, aboveG, aboveB);

            // Slightly tint the above-water view with water color
            // (light passes through water on both the way in and out)
            aboveColor = mix(aboveColor, aboveColor * vec3(0.85, 0.95, 1.1), 0.3);

            // ---- Dispersion ring at the Snell's window boundary ----
            // Because each wavelength has a different critical angle,
            // there's a narrow annular zone (~0.5° wide) where blue is
            // already at TIR (R_b=1.0) but red is still partially
            // transmitting (R_r<1.0). This creates a visible rainbow-like
            // colour fringe — a "dispersion halo" — at the window edge.
            //
            // We compute per-channel edge rings at slightly different
            // radii corresponding to each wavelength's critical angle.
            // The angular separation between red and blue critical angles
            // is only ~0.5°, but when magnified by the Fresnel curve's
            // steep gradient, it becomes a visible colour split.

            // Per-channel ring positions: each colour's critical angle
            // maps to a slightly different normalizedDist where TIR begins.
            // Blue (highest IOR) hits TIR first → ring at smaller radius.
            // Red (lowest IOR) hits TIR last → ring at larger radius.
            vec3 ringOffsets = criticalAngles / criticalAngle; // ~[1.002, 1.0, 0.998]
            
            // Gaussian ring profile per channel, each peaked at its own
            // critical angle boundary
            float ringWidth = edgeSoft * 0.8;
            vec3 edgeRing_rgb = vec3(
              exp(-pow((normalizedDist - ringOffsets.r) / ringWidth, 2.0)),
              exp(-pow((normalizedDist - ringOffsets.g) / ringWidth, 2.0)),
              exp(-pow((normalizedDist - ringOffsets.b) / ringWidth, 2.0))
            );

            // Fresnel-weighted: each channel's ring brightness is
            // amplified by its own Fresnel reflectance at this angle
            vec3 fresnelRingBoost = mix(vec3(1.0), fresnelR_rgb * 2.0, uFresnelBlend);
            edgeRing_rgb *= fresnelRingBoost;

            // Animate the ring for a living caustic feel
            float ringCaustic = 0.5 + 0.5 * sin(atan(delta.y, delta.x) * 12.0 + uTime * 3.0);
            edgeRing_rgb *= (0.7 + ringCaustic * 0.6);

            // Tint per-channel rings with spectral colours:
            // Red ring → warm tint, green ring → neutral, blue ring → cool tint
            vec3 ringColor = vec3(
              edgeRing_rgb.r * 0.7,   // red contribution
              edgeRing_rgb.g * 0.85,  // green contribution
              edgeRing_rgb.b * 1.0    // blue contribution
            ) * 0.5;

            // ---- Per-channel blend of above-water view ----
            // Each colour channel of the above-water texture is blended
            // using its own Fresnel transmission mask. This means:
            //  - At center: all channels ≈ 98% visible (clear window)
            //  - Near edge: blue drops first, then green, then red
            //  - The result is a subtle warm (red/orange) colour fringe
            //    at the window boundary, like real underwater dispersion
            col.r = mix(col.r, aboveColor.r, windowMask_rgb.r * 0.85);
            col.g = mix(col.g, aboveColor.g, windowMask_rgb.g * 0.85);
            col.b = mix(col.b, aboveColor.b, windowMask_rgb.b * 0.85);
            col.rgb += ringColor * lookUpFactor;
          }

          // ==============================================
          // TOTAL INTERNAL REFLECTION (TIR) WITH FRESNEL BLEND
          //
          // Physics: Beyond the critical angle, R = 1.0 (perfect mirror).
          // But with the Fresnel blend, partial reflection also occurs
          // INSIDE the window — at ~2% at center, rising smoothly.
          // This means even looking straight up, you see a faint ghost
          // of the underwater world overlaid on the above-water view.
          //
          // The tirMask now equals fresnelR (when uFresnelBlend=1),
          // producing physically-correct partial reflections everywhere:
          //  - Center: tirMask ≈ 0.02 (barely visible reflection)
          //  - Halfway to edge: tirMask ≈ 0.10 (subtle)
          //  - Near edge: tirMask ≈ 0.50 (strong partial reflection)
          //  - Beyond edge: tirMask = 1.0 (total internal reflection)
          //
          // This gradual ramp eliminates the hard binary boundary
          // between the refracted window and the TIR mirror.
          // ==============================================

          if (tirMask > 0.001) {
            // Sample the TIR texture with vertically flipped UVs.
            // The TIR camera was positioned above the water looking down,
            // so its image is already a mirror of the underwater scene.
            // We flip Y here to match the "reflection on the ceiling" look.
            vec2 tirUV = vec2(vUv.x, 1.0 - vUv.y);

            // ---- Wave-animated distortion on the TIR reflection ----
            // The water surface is not flat; small waves distort the
            // reflected image. We add animated sine-wave offsets to
            // simulate this rippling mirror effect.
            float tirDistort = 0.012;
            tirUV.x += sin(vUv.y * 15.0 + uTime * 1.8) * tirDistort;
            tirUV.y += cos(vUv.x * 13.0 + uTime * 1.5) * tirDistort * 0.8;
            // Second layer of finer distortion for detail
            tirUV.x += sin(vUv.y * 30.0 + uTime * 3.0) * tirDistort * 0.3;
            tirUV.y += cos(vUv.x * 28.0 + uTime * 2.5) * tirDistort * 0.25;

            tirUV = clamp(tirUV, 0.001, 0.999);

            vec3 tirSample = texture2D(uTIRTexture, tirUV).rgb;

            // ---- Tint the TIR reflection with underwater color ----
            // The reflected light travels through water twice (down to
            // object, back up to surface, reflected back down to eye),
            // so it picks up more of the water's color absorption.
            // Red is absorbed most, blue least.
            tirSample *= vec3(0.6, 0.8, 0.95);

            // ---- Darken slightly to distinguish from direct view ----
            // Pure TIR is a perfect mirror, but suspended particles
            // and absorption dim the reflection in real ocean water.
            tirSample *= 0.55;

            // ---- Caustic shimmer on the TIR surface ----
            // The reflected image has subtle bright caustic highlights
            // where wave-focused light concentrates on the surface
            float tirCaustic = 0.5 + 0.5 * sin(vUv.x * 25.0 + vUv.y * 18.0 + uTime * 2.5);
            tirCaustic *= 0.5 + 0.5 * sin(vUv.x * -15.0 + vUv.y * 22.0 + uTime * -1.8);
            tirCaustic = pow(tirCaustic, 2.0) * 0.2;
            tirSample += vec3(0.3, 0.5, 0.6) * tirCaustic;

            // ---- Per-channel TIR blending with dispersion ----
            // Each colour channel of the TIR reflection is blended
            // using its own Fresnel reflectance mask. Blue reflects
            // most (highest IOR), so the TIR image gains a cool blue
            // tint in the transition zone. Red reflects least, so
            // it fades in last — creating a subtle warm-to-cool
            // gradient across the Snell's window boundary.
            //
            // This is the complementary effect to the per-channel
            // window transmission above: where transmission drops
            // per channel, reflection increases by the same amount.
            col.r = mix(col.r, tirSample.r, tirMask_rgb.r * uTIRStrength);
            col.g = mix(col.g, tirSample.g, tirMask_rgb.g * uTIRStrength);
            col.b = mix(col.b, tirSample.b, tirMask_rgb.b * uTIRStrength);
          }

          // ---- Subtle circular highlight even when window is faint ----
          // A very soft glow where the window would be, suggesting
          // light from above even at oblique viewing angles
          float softGlow = exp(-distFromCenter * distFromCenter * 3.0) * lookUpFactor * 0.15;
          col.rgb += vec3(0.3, 0.6, 0.7) * softGlow;

          // Final output with slight brightness boost
          col.rgb *= 1.1;
          gl_FragColor = vec4(col.rgb, 1.0);
        } else {
          gl_FragColor = texture2D(uTexture, uv);
        }
      }
    `,
  });

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(quadGeo, mat);
  underwaterPostProcessing.quad = quad;
  underwaterPostProcessing.material = mat;
  underwaterPostProcessing.scene = new THREE.Scene();
  underwaterPostProcessing.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  underwaterPostProcessing.scene.add(quad);
}

// ============================================================
// UI
// ============================================================
function createUI() {
  const panel = document.createElement('div');
  panel.id = 'ui-panel';
  panel.innerHTML = `
    <style>
      #ui-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 310px;
        height: 100vh;
        background: rgba(10,15,25,0.92);
        color: #c8d8e8;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 12px;
        overflow-y: auto;
        z-index: 1000;
        backdrop-filter: blur(10px);
        border-left: 1px solid rgba(100,150,200,0.15);
        transform: translateX(0);
        transition: transform 0.3s ease;
      }
      #ui-panel.collapsed {
        transform: translateX(calc(100% - 32px));
      }
      #ui-toggle {
        position: absolute;
        left: -32px;
        top: 10px;
        width: 32px;
        height: 32px;
        background: rgba(10,15,25,0.9);
        border: 1px solid rgba(100,150,200,0.2);
        border-right: none;
        color: #7ab;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px 0 0 4px;
      }
      .ui-header {
        padding: 12px 16px;
        background: rgba(20,40,60,0.5);
        font-size: 14px;
        font-weight: 600;
        color: #7ab8d8;
        letter-spacing: 0.5px;
        border-bottom: 1px solid rgba(100,150,200,0.1);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ui-section {
        border-bottom: 1px solid rgba(100,150,200,0.08);
      }
      .ui-section-header {
        padding: 10px 16px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 500;
        color: #8ab;
        user-select: none;
        transition: background 0.2s;
      }
      .ui-section-header:hover {
        background: rgba(40,70,100,0.2);
      }
      .ui-section-header .arrow {
        font-size: 10px;
        transition: transform 0.2s;
      }
      .ui-section-header.open .arrow {
        transform: rotate(90deg);
      }
      .ui-section-content {
        padding: 0 16px 12px;
        display: none;
      }
      .ui-section-content.open {
        display: block;
      }
      .ui-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 6px 0;
        gap: 8px;
      }
      .ui-row label {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
        color: #8a9ab0;
      }
      .ui-row input[type="range"] {
        flex: 1.2;
        height: 4px;
        -webkit-appearance: none;
        background: rgba(100,150,200,0.15);
        border-radius: 2px;
        outline: none;
      }
      .ui-row input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #5a9bc0;
        cursor: pointer;
        border: 2px solid #2a4a60;
      }
      .ui-row .value {
        width: 38px;
        text-align: right;
        font-size: 11px;
        color: #6a8a9a;
        font-variant-numeric: tabular-nums;
      }
      .ui-row input[type="checkbox"] {
        accent-color: #5a9bc0;
      }
      .btn-row {
        padding: 12px 16px;
        display: flex;
        gap: 8px;
      }
      .btn {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid rgba(100,150,200,0.2);
        background: rgba(30,50,70,0.5);
        color: #8ab;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s;
        text-align: center;
      }
      .btn:hover {
        background: rgba(50,80,110,0.5);
        color: #acd;
      }
      .btn.active {
        background: rgba(60,120,180,0.3);
        border-color: #5a9bc0;
        color: #adf;
      }
      .ui-info {
        padding: 8px 16px;
        font-size: 10px;
        color: #556;
        text-align: center;
        border-top: 1px solid rgba(100,150,200,0.08);
      }
    </style>
    <button id="ui-toggle">⚙</button>
    <div class="ui-header">🌊 Ocean Simulation</div>

    <div class="ui-section">
      <div class="ui-section-header open" onclick="toggleSection(this)">
        Wind & FFT Waves <span class="arrow">▶</span>
      </div>
      <div class="ui-section-content open">
        ${slider('Wind Speed', 'windSpeed', 1, 30, 0.5, CONFIG.fft.windSpeed)}
        ${slider('Wind Direction', 'windDir', 0, 6.28, 0.01, CONFIG.fft.windDirection)}
        ${slider('FFT Amplitude', 'fftAmp', 0.1, 5, 0.1, CONFIG.fft.amplitude)}
        ${slider('Choppiness', 'choppiness', 0, 4, 0.1, CONFIG.fft.choppiness)}
      </div>
    </div>

    <div class="ui-section">
      <div class="ui-section-header" onclick="toggleSection(this)">
        Gerstner Swells <span class="arrow">▶</span>
      </div>
      <div class="ui-section-content">
        ${checkbox('Enable Gerstner', 'gerstnerEnabled', true)}
        ${slider('Swell Scale', 'gerstnerScale', 0, 3, 0.1, CONFIG.gerstner.scale)}
        ${slider('Wave 1 Amp', 'gw1amp', 0, 3, 0.1, 1.2)}
        ${slider('Wave 1 Length', 'gw1len', 5, 80, 1, 40)}
        ${slider('Wave 2 Amp', 'gw2amp', 0, 3, 0.1, 0.8)}
        ${slider('Wave 2 Length', 'gw2len', 5, 60, 1, 25)}
        ${slider('Wave 3 Amp', 'gw3amp', 0, 2, 0.1, 0.5)}
        ${slider('Wave 4 Amp', 'gw4amp', 0, 2, 0.1, 0.3)}
      </div>
    </div>

    <div class="ui-section">
      <div class="ui-section-header" onclick="toggleSection(this)">
        🏄 Arc Waves (Swells) <span class="arrow">▶</span>
      </div>
      <div class="ui-section-content">
        ${checkbox('Enable Arc Waves', 'arcWaveEnabled', CONFIG.arcWaves.enabled)}
        ${slider('Amplitude', 'arcAmp', 0, 5, 0.1, CONFIG.arcWaves.amplitude)}
        ${slider('Wavelength', 'arcWaveLen', 30, 300, 5, CONFIG.arcWaves.wavelength)}
        ${slider('Speed', 'arcSpeed', 0.1, 3, 0.1, CONFIG.arcWaves.speed)}
        ${slider('Steepness', 'arcSteep', 0, 0.6, 0.05, CONFIG.arcWaves.steepness)}
        ${slider('Spread', 'arcSpread', 0, 3.14, 0.1, CONFIG.arcWaves.spread)}
        ${slider('Scale', 'arcScale', 0, 3, 0.1, CONFIG.arcWaves.scale)}
        ${slider('Origin X', 'arcOriginX', -500, 500, 10, CONFIG.arcWaves.origin.x)}
        ${slider('Origin Z', 'arcOriginZ', -500, 500, 10, CONFIG.arcWaves.origin.y)}
      </div>
    </div>

    <div class="ui-section">
      <div class="ui-section-header" onclick="toggleSection(this)">
        🫧 Whitecap Foam <span class="arrow">▶</span>
      </div>
      <div class="ui-section-content">
        ${checkbox('Enable', 'whitecapEnabled', true)}
        ${slider('Threshold', 'whitecapThresh', 0, 1.5, 0.05, CONFIG.foam.whitecap.threshold)}
        ${slider('Intensity', 'whitecapInt', 0, 3, 0.1, CONFIG.foam.whitecap.intensity)}
        ${slider('Scale', 'whitecapScale', 1, 30, 0.5, CONFIG.foam.whitecap.scale)}
        ${slider('Speed', 'whitecapSpeed', 0, 2, 0.05, CONFIG.foam.whitecap.speed)}
      </div>
    </div>

    <div class="ui-section">
      <div class="ui-section-header" onclick="toggleSection(this)">
        🫧 Ambient Foam <span class="arrow">▶</span>
      </div>
      <div class="ui-section-content">
        ${checkbox('Enable', 'ambientFoamEnabled', true)}
        ${slider('Density', 'ambFoamDensity', 0, 1, 0.05, CONFIG.foam.ambient.density)}
        ${slider('Scale', 'ambFoamScale', 1, 40, 0.5, CONFIG.foam.ambient.scale)}
        ${slider('Speed', 'ambFoamSpeed', 0, 1, 0.05, CONFIG.foam.ambient.speed)}
        ${slider('Opacity', 'ambFoamOpacity', 0, 1, 0.05, CONFIG.foam.ambient.opacity)}
      </div>
    </div>

    <div class="ui-section">
      <div class="ui-section-header" onclick="toggleSection(this)">
        🫧 Shoreline Foam <span class="arrow">▶</span>
      </div>
      <div class="ui-section-content">
        ${checkbox('Enable', 'shorelineFoamEnabled', true)}
        ${slider('Distance', 'shoreDist', 1, 30, 0.5, CONFIG.foam.shoreline.distance)}
        ${slider('Intensity', 'shoreInt', 0, 3, 0.1, CONFIG.foam.shoreline.intensity)}
        ${slider('Scale', 'shoreScale', 1, 20, 0.5, CONFIG.foam.shoreline.scale)}
        ${slider('Width', 'shoreWidth', 0.5, 10, 0.5, CONFIG.foam.shoreline.width)}
      </div>
    </div>

    <div class="ui-section">
      <div class="ui-section-header" onclick="toggleSection(this)">
        🌊 Water Appearance <span class="arrow">▶</span>
      </div>
      <div class="ui-section-content">
        ${slider('Opacity', 'waterOpacity', 0.3, 1, 0.05, CONFIG.water.opacity)}
        ${slider('Fresnel Power', 'fresnelPow', 1, 8, 0.5, 3)}
        ${slider('Reflection', 'reflStr', 0, 1, 0.05, 0.6)}
        ${slider('Refl Distortion', 'reflDistort', 0, 0.1, 0.005, 0.03)}
      </div>
    </div>

    <div class="ui-section">
      <div class="ui-section-header" onclick="toggleSection(this)">
        ☀️ Sun Position <span class="arrow">▶</span>
      </div>
      <div class="ui-section-content">
        ${slider('Azimuth', 'sunAzimuth', 0, 6.28, 0.01, CONFIG.sun.azimuth)}
        ${slider('Elevation', 'sunElevation', 0.01, 1.57, 0.01, CONFIG.sun.elevation)}
        ${slider('Intensity', 'sunIntensity', 0.5, 5.0, 0.1, CONFIG.sun.intensity)}
      </div>
    </div>

    <div class="ui-section">
      <div class="ui-section-header" onclick="toggleSection(this)">
        🐠 Underwater Effects <span class="arrow">▶</span>
      </div>
      <div class="ui-section-content">
        ${slider('Fog Density', 'uwFogDensity', 0, 0.15, 0.005, CONFIG.underwater.fogDensity)}
        ${slider('Distortion', 'uwDistortion', 0, 0.08, 0.002, CONFIG.underwater.distortionAmount)}
        ${slider('Distort Speed', 'uwDistortSpeed', 0, 3, 0.1, CONFIG.underwater.distortionSpeed)}
        ${slider('Caustics Scale', 'uwCausticsScale', 1, 20, 0.5, CONFIG.underwater.causticsScale)}
        ${slider('Caustics Speed', 'uwCausticsSpeed', 0, 3, 0.1, CONFIG.underwater.causticsSpeed)}
        ${slider('Caustics Intensity', 'uwCausticsInt', 0, 2, 0.1, CONFIG.underwater.causticsIntensity)}
        ${slider('Snell Window Size', 'snellRadius', 0.1, 1.0, 0.05, 0.45)}
        ${slider('Snell Edge Soft', 'snellEdge', 0.05, 0.6, 0.05, 0.25)}
        ${slider('TIR Strength', 'tirStrength', 0, 1, 0.05, 0.6)}
        ${slider('Fresnel Blend', 'fresnelBlend', 0, 1, 0.05, 1.0)}
      </div>
    </div>

    <div class="ui-section">
      <div class="ui-section-header" onclick="toggleSection(this)">
        ⚓ Buoyancy <span class="arrow">▶</span>
      </div>
      <div class="ui-section-content">
        ${slider('Water Density', 'buoyDensity', 500, 2000, 50, CONFIG.buoyancy.waterDensity)}
        ${slider('Drag', 'buoyDrag', 0, 8, 0.1, CONFIG.buoyancy.drag)}
        ${slider('Angular Drag', 'buoyAngDrag', 0, 8, 0.1, CONFIG.buoyancy.angularDrag)}
        ${slider('Boat Foam', 'boatFoamInt', 0, 3, 0.1, 1.0)}
        ${slider('Foam Radius', 'boatFoamRad', 1, 10, 0.5, 5.0)}
      </div>
    </div>

    <div class="ui-info">
      Scroll down to go underwater • Drag to orbit
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById('ui-toggle').addEventListener('click', () => {
    panel.classList.toggle('collapsed');
  });

  // Bind all sliders
  panel.querySelectorAll('input[type="range"]').forEach(input => {
    input.addEventListener('input', () => {
      updateUIValue(input.dataset.param, parseFloat(input.value));
      const valSpan = input.parentElement.querySelector('.value');
      if (valSpan) valSpan.textContent = parseFloat(input.value).toFixed(2);
    });
  });

  panel.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', () => {
      updateUIValue(input.dataset.param, input.checked);
    });
  });
}

function slider(label, param, min, max, step, value) {
  return `<div class="ui-row">
    <label>${label}</label>
    <input type="range" data-param="${param}" min="${min}" max="${max}" step="${step}" value="${value}">
    <span class="value">${value.toFixed(2)}</span>
  </div>`;
}

function checkbox(label, param, checked) {
  return `<div class="ui-row">
    <label>${label}</label>
    <input type="checkbox" data-param="${param}" ${checked ? 'checked' : ''}>
  </div>`;
}

window.toggleSection = function(header) {
  header.classList.toggle('open');
  const content = header.nextElementSibling;
  content.classList.toggle('open');
};

function updateUIValue(param, value) {
  const wm = waterMesh?.material?.uniforms;
  const fm = oceanFloor?.material?.uniforms;
  const pp = underwaterPostProcessing?.material?.uniforms;

  switch(param) {
    // Wind & FFT
    case 'windSpeed':
      CONFIG.fft.windSpeed = value;
      if(wm) wm.uWindSpeed.value = value;
      generatePhillipsSpectrum();
      break;
    case 'windDir':
      CONFIG.fft.windDirection = value;
      if(wm) wm.uWindDirection.value = value;
      generatePhillipsSpectrum();
      break;
    case 'fftAmp':
      CONFIG.fft.amplitude = value;
      if(wm) wm.uFFTAmplitude.value = value;
      generatePhillipsSpectrum();
      break;
    case 'choppiness':
      CONFIG.fft.choppiness = value;
      if(wm) wm.uChoppiness.value = value;
      break;

    // Gerstner
    case 'gerstnerEnabled':
      CONFIG.gerstner.enabled = value;
      if(wm) wm.uGerstnerEnabled.value = value;
      break;
    case 'gerstnerScale':
      CONFIG.gerstner.scale = value;
      if(wm) wm.uGerstnerScale.value = value;
      break;
    case 'gw1amp':
      CONFIG.gerstner.waves[0].amplitude = value;
      if(wm) wm.uGWave0.value.x = value;
      break;
    case 'gw1len':
      CONFIG.gerstner.waves[0].wavelength = value;
      if(wm) wm.uGWave0.value.y = value;
      break;
    case 'gw2amp':
      CONFIG.gerstner.waves[1].amplitude = value;
      if(wm) wm.uGWave1.value.x = value;
      break;
    case 'gw2len':
      CONFIG.gerstner.waves[1].wavelength = value;
      if(wm) wm.uGWave1.value.y = value;
      break;
    case 'gw3amp':
      CONFIG.gerstner.waves[2].amplitude = value;
      if(wm) wm.uGWave2.value.x = value;
      break;
    case 'gw4amp':
      CONFIG.gerstner.waves[3].amplitude = value;
      if(wm) wm.uGWave3.value.x = value;
      break;

    // ---- Arc wave controls ----
    case 'arcWaveEnabled':
      CONFIG.arcWaves.enabled = value;
      if(wm) wm.uArcWaveEnabled.value = value;
      break;
    case 'arcAmp':
      CONFIG.arcWaves.amplitude = value;
      if(wm) wm.uArcWaveAmplitude.value = value;
      break;
    case 'arcWaveLen':
      CONFIG.arcWaves.wavelength = value;
      if(wm) wm.uArcWaveLength.value = value;
      break;
    case 'arcSpeed':
      CONFIG.arcWaves.speed = value;
      if(wm) wm.uArcWaveSpeed.value = value;
      break;
    case 'arcSteep':
      CONFIG.arcWaves.steepness = value;
      if(wm) wm.uArcWaveSteepness.value = value;
      break;
    case 'arcSpread':
      CONFIG.arcWaves.spread = value;
      if(wm) wm.uArcWaveSpread.value = value;
      break;
    case 'arcScale':
      CONFIG.arcWaves.scale = value;
      if(wm) wm.uArcWaveScale.value = value;
      break;
    case 'arcOriginX':
      CONFIG.arcWaves.origin.x = value;
      if(wm) wm.uArcWaveOrigin.value.x = value;
      break;
    case 'arcOriginZ':
      CONFIG.arcWaves.origin.y = value;
      if(wm) wm.uArcWaveOrigin.value.y = value;
      break;

    // Whitecap foam
    case 'whitecapEnabled':
      CONFIG.foam.whitecap.enabled = value;
      if(wm) wm.uWhitecapEnabled.value = value;
      break;
    case 'whitecapThresh':
      CONFIG.foam.whitecap.threshold = value;
      if(wm) wm.uWhitecapThreshold.value = value;
      break;
    case 'whitecapInt':
      CONFIG.foam.whitecap.intensity = value;
      if(wm) wm.uWhitecapIntensity.value = value;
      break;
    case 'whitecapScale':
      CONFIG.foam.whitecap.scale = value;
      if(wm) wm.uWhitecapScale.value = value;
      break;
    case 'whitecapSpeed':
      CONFIG.foam.whitecap.speed = value;
      if(wm) wm.uWhitecapSpeed.value = value;
      break;

    // Ambient foam
    case 'ambientFoamEnabled':
      CONFIG.foam.ambient.enabled = value;
      if(wm) wm.uAmbientFoamEnabled.value = value;
      break;
    case 'ambFoamDensity':
      CONFIG.foam.ambient.density = value;
      if(wm) wm.uAmbientFoamDensity.value = value;
      break;
    case 'ambFoamScale':
      CONFIG.foam.ambient.scale = value;
      if(wm) wm.uAmbientFoamScale.value = value;
      break;
    case 'ambFoamSpeed':
      CONFIG.foam.ambient.speed = value;
      if(wm) wm.uAmbientFoamSpeed.value = value;
      break;
    case 'ambFoamOpacity':
      CONFIG.foam.ambient.opacity = value;
      if(wm) wm.uAmbientFoamOpacity.value = value;
      break;

    // Shoreline foam
    case 'shorelineFoamEnabled':
      CONFIG.foam.shoreline.enabled = value;
      if(wm) wm.uShorelineFoamEnabled.value = value;
      break;
    case 'shoreDist':
      CONFIG.foam.shoreline.distance = value;
      if(wm) wm.uShorelineFoamDist.value = value;
      break;
    case 'shoreInt':
      CONFIG.foam.shoreline.intensity = value;
      if(wm) wm.uShorelineFoamIntensity.value = value;
      break;
    case 'shoreScale':
      CONFIG.foam.shoreline.scale = value;
      if(wm) wm.uShorelineFoamScale.value = value;
      break;
    case 'shoreWidth':
      CONFIG.foam.shoreline.width = value;
      if(wm) wm.uShorelineFoamWidth.value = value;
      break;

    // Water appearance
    case 'waterOpacity':
      CONFIG.water.opacity = value;
      if(wm) wm.uOpacity.value = value;
      break;
    case 'fresnelPow':
      if(wm) wm.uFresnelPower.value = value;
      break;
    case 'reflStr':
      if(wm) wm.uReflectionStrength.value = value;
      break;
    case 'reflDistort':
      if(wm) wm.uReflectionDistortion.value = value;
      break;

    // ---- Sun position controls ----
    // These update the CONFIG values and then call updateSunEverywhere()
    // which propagates the new position to the directional light, sky dome,
    // water shader, and ocean floor shader in one call.
    case 'sunAzimuth':
      CONFIG.sun.azimuth = value;
      updateSunEverywhere();
      break;
    case 'sunElevation':
      CONFIG.sun.elevation = value;
      updateSunEverywhere();
      break;
    case 'sunIntensity':
      CONFIG.sun.intensity = value;
      updateSunEverywhere();
      break;

    // Underwater
    case 'uwFogDensity':
      CONFIG.underwater.fogDensity = value;
      if(pp) pp.uFogDensity.value = value;
      break;
    case 'uwDistortion':
      CONFIG.underwater.distortionAmount = value;
      if(pp) pp.uDistortionAmount.value = value;
      break;
    case 'uwDistortSpeed':
      CONFIG.underwater.distortionSpeed = value;
      if(pp) pp.uDistortionSpeed.value = value;
      break;
    case 'uwCausticsScale':
      CONFIG.underwater.causticsScale = value;
      if(fm) fm.uCausticsScale.value = value;
      break;
    case 'uwCausticsSpeed':
      CONFIG.underwater.causticsSpeed = value;
      if(fm) fm.uCausticsSpeed.value = value;
      break;
    case 'uwCausticsInt':
      CONFIG.underwater.causticsIntensity = value;
      if(fm) fm.uCausticsIntensity.value = value;
      break;

    // Snell's window
    case 'snellRadius':
      if(pp) pp.uSnellWindowRadius.value = value;
      break;
    case 'snellEdge':
      if(pp) pp.uSnellWindowEdgeSoftness.value = value;
      break;
    case 'tirStrength':
      if(pp) pp.uTIRStrength.value = value;
      break;
    case 'fresnelBlend':
      if(pp) pp.uFresnelBlend.value = value;
      break;

    // Buoyancy
    case 'buoyDensity':
      CONFIG.buoyancy.waterDensity = value;
      break;
    case 'buoyDrag':
      CONFIG.buoyancy.drag = value;
      break;
    case 'buoyAngDrag':
      CONFIG.buoyancy.angularDrag = value;
      break;
    case 'boatFoamInt':
      if(wm) wm.uBoatFoamIntensity.value = value;
      break;
    case 'boatFoamRad':
      if(wm) wm.uBoatFoamRadius.value = value;
      break;
  }
}

// ============================================================
// PLANAR REFLECTION
// ============================================================
function setupReflection() {
  reflectionRenderTarget = new THREE.WebGLRenderTarget(
    Math.floor(window.innerWidth * 0.5),
    Math.floor(window.innerHeight * 0.5),
    {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    }
  );

  reflectionCamera = camera.clone();

  // Pass reflection texture to water
  if (waterMesh) {
    waterMesh.material.uniforms.uReflectionMap.value = reflectionRenderTarget.texture;
  }
}

function renderReflection() {
  if (!reflectionRenderTarget || !waterMesh) return;

  // Mirror camera across water plane (y=0)
  reflectionCamera.copy(camera);
  reflectionCamera.position.y = -camera.position.y;
  reflectionCamera.up.set(0, -1, 0);
  reflectionCamera.lookAt(
    controls.target.x,
    -controls.target.y,
    controls.target.z
  );
  reflectionCamera.updateMatrixWorld();
  reflectionCamera.updateProjectionMatrix();

  // Oblique clipping plane to avoid rendering below water
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.1);
  const clipVector = new THREE.Vector4(
    clipPlane.normal.x,
    clipPlane.normal.y,
    clipPlane.normal.z,
    clipPlane.constant
  );

  // Transform clip plane to camera space
  const viewMatrix = reflectionCamera.matrixWorldInverse;
  const projMatrix = reflectionCamera.projectionMatrix;

  const camSpaceClip = clipVector.clone().applyMatrix4(viewMatrix.clone().transpose().invert());

  // Modify projection matrix for oblique near clipping
  if (camSpaceClip.w > 0) {
    // Standard oblique projection
    const q = new THREE.Vector4();
    q.x = (Math.sign(camSpaceClip.x) + projMatrix.elements[8]) / projMatrix.elements[0];
    q.y = (Math.sign(camSpaceClip.y) + projMatrix.elements[9]) / projMatrix.elements[5];
    q.z = -1.0;
    q.w = (1.0 + projMatrix.elements[10]) / projMatrix.elements[14];
    const dot = camSpaceClip.dot(q);
    const c = camSpaceClip.multiplyScalar(2.0 / dot);
    reflectionCamera.projectionMatrix.elements[2] = c.x;
    reflectionCamera.projectionMatrix.elements[6] = c.y;
    reflectionCamera.projectionMatrix.elements[10] = c.z + 1.0;
    reflectionCamera.projectionMatrix.elements[14] = c.w;
  }

  // Hide water during reflection pass
  waterMesh.visible = false;

  // Flip face winding for reflected scene
  const prevShadowAutoUpdate = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = false;

  const prevToneMapping = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;

  renderer.setRenderTarget(reflectionRenderTarget);
  renderer.clear();
  renderer.render(scene, reflectionCamera);
  renderer.setRenderTarget(null);

  renderer.toneMapping = prevToneMapping;
  renderer.shadowMap.autoUpdate = prevShadowAutoUpdate;

  waterMesh.visible = true;
}

// ============================================================
// DEPTH PASS for shore foam and water masking
// ============================================================
function renderDepthPass() {
  const prevOverrideMaterial = scene.overrideMaterial;

  // Simple depth material
  if (!depthMaterial) {
    depthMaterial = new THREE.MeshBasicMaterial({
      colorWrite: true,
    });
    depthMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = `
        void main() {
          gl_FragColor = vec4(vec3(gl_FragCoord.z), 1.0);
        }
      `;
    };
  }

  // Hide water for depth pass
  if (waterMesh) waterMesh.visible = false;

  scene.overrideMaterial = depthMaterial;
  renderer.setRenderTarget(depthRenderTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  scene.overrideMaterial = prevOverrideMaterial;

  if (waterMesh) waterMesh.visible = true;

  // Pass depth texture to water shader
  if (waterMesh) {
    waterMesh.material.uniforms.uDepthTexture.value = depthRenderTarget.texture;
  }
}

// ============================================================
// RESIZE
// ============================================================
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);

  depthRenderTarget.setSize(w, h);
  if (reflectionRenderTarget) {
    reflectionRenderTarget.setSize(Math.floor(w * 0.5), Math.floor(h * 0.5));
  }
  underwaterPostProcessing.renderTarget.setSize(w, h);
  if (underwaterPostProcessing.aboveWaterTarget) {
    underwaterPostProcessing.aboveWaterTarget.setSize(Math.floor(w * 0.5), Math.floor(h * 0.5));
  }
  if (tirRenderTarget) {
    tirRenderTarget.setSize(Math.floor(w * 0.5), Math.floor(h * 0.5));
  }

  if (waterMesh) {
    waterMesh.material.uniforms.uScreenSize.value.set(w, h);
  }
  if (underwaterPostProcessing.material) {
    underwaterPostProcessing.material.uniforms.uScreenSize.value.set(w, h);
  }
}

// ============================================================
// UNDERWATER TRANSITION
// ============================================================
function checkUnderwaterTransition() {
  const waterH = getWaterHeight(camera.position.x, camera.position.z, clock.elapsedTime);
  const wasUnderwater = isUnderwater;
  isUnderwater = camera.position.y < waterH;

  // Signed distance from camera to water surface:
  // positive = above water, negative = below water.
  // Used by the waterline foam transition effect in the water shader.
  const cameraWaterDist = camera.position.y - waterH;

  if (isUnderwater !== wasUnderwater) {
    if (isUnderwater) {
      scene.background = new THREE.Color(0x061820);
      scene.fog = new THREE.FogExp2(0x082830, CONFIG.underwater.fogDensity);
    } else {
      scene.background = new THREE.Color(0x2a1520);
      scene.fog = new THREE.FogExp2(0x4a2530, 0.0008);
    }
  }

  if (waterMesh) {
    waterMesh.material.uniforms.uIsUnderwater.value = isUnderwater;
    // Pass the signed camera-water distance for the waterline effect
    waterMesh.material.uniforms.uCameraWaterDist.value = cameraWaterDist;
  }
  if (underwaterPostProcessing.material) {
    underwaterPostProcessing.material.uniforms.uIsUnderwater.value = isUnderwater;
  }
}

// ============================================================
// ANIMATE
// ============================================================
function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  const time = clock.elapsedTime;

  controls.update();

  // Update water uniforms
  if (waterMesh) {
    const u = waterMesh.material.uniforms;
    u.uTime.value = time;
    u.uCameraPos.value.copy(camera.position);

    // Pass boat position to water shader for foam rendering
    if (boat) {
      u.uBoatPos.value.copy(boat.position);
    }
  }

  // Update ocean floor
  if (oceanFloor) {
    oceanFloor.material.uniforms.uTime.value = time;
  }

  // Buoyancy physics
  updateBoatPhysics(dt);

  // Water masking render order
  if (boat && boat.userData.waterMask && waterMesh) {
    boat.userData.waterMask.renderOrder = 0;
    waterMesh.renderOrder = 1;
  }

  // Underwater detection
  checkUnderwaterTransition();

    // Depth pass for shore foam
    renderDepthPass();

    // Reflection pass (only above water)
    if (!isUnderwater) {
      renderReflection();
    }

    // Main render
    if (isUnderwater) {
    // ---- Render above-water view for Snell's window ----
    // We render the scene from a camera positioned just above the
    // water surface, looking in the same direction as the player.
    // This texture is sampled inside the Snell's window circle
    // to show the refracted above-water world.
    const aboveWaterCam = camera.clone();
    const waterH = getWaterHeight(camera.position.x, camera.position.z, time);
    // Position camera just above the surface, mirroring vertical position
    aboveWaterCam.position.y = waterH + Math.abs(waterH - camera.position.y) * 0.5 + 0.5;
    aboveWaterCam.updateMatrixWorld();

    // Temporarily switch to above-water sunset visuals
    const prevBg = scene.background.clone();
    const prevFog = scene.fog;
    scene.background = new THREE.Color(0x2a1520);
    scene.fog = new THREE.FogExp2(0x4a2530, 0.0008);
    if (waterMesh) waterMesh.visible = false;

    renderer.setRenderTarget(underwaterPostProcessing.aboveWaterTarget);
    renderer.clear();
    renderer.render(scene, aboveWaterCam);
    renderer.setRenderTarget(null);

    // Restore underwater visuals
    scene.background = prevBg;
    scene.fog = prevFog;
    if (waterMesh) waterMesh.visible = true;

    // Pass the above-water texture to the post-processing shader
    underwaterPostProcessing.material.uniforms.uAboveWaterTexture.value =
      underwaterPostProcessing.aboveWaterTarget.texture;

    // ---- Total Internal Reflection (TIR) render pass ----
    // To simulate what an underwater observer sees reflected in the
    // surface outside Snell's window, we render the underwater scene
    // from a camera that is vertically flipped across the water plane.
    //
    // Physics: Beyond the critical angle, the water surface acts as
    // a perfect mirror. The reflected image is the underwater world
    // as if you were looking "down" from above the surface — i.e.
    // the camera's Y is mirrored across y=0 and it looks in the
    // opposite vertical direction.
    //
    // We keep the underwater fog and background so the TIR texture
    // has the correct murky underwater look (it IS underwater light
    // bouncing back down).
    const tirCam = camera.clone();
    // Mirror Y position across the water surface (y=0)
    // If camera is at y=-5, TIR camera goes to y=+5
    tirCam.position.y = -camera.position.y;
    // Flip the up vector so the image is vertically mirrored
    tirCam.up.set(0, -1, 0);
    // Look at the mirrored target point
    tirCam.lookAt(
      controls.target.x,
      -controls.target.y,
      controls.target.z
    );
    tirCam.updateMatrixWorld();
    tirCam.updateProjectionMatrix();

    // Render TIR pass — keep underwater visuals (fog, dark background)
    // because TIR reflects the underwater environment, not above-water
    renderer.setRenderTarget(tirRenderTarget);
    renderer.clear();
    renderer.render(scene, tirCam);
    renderer.setRenderTarget(null);

    // Pass TIR texture to post-processing shader
    underwaterPostProcessing.material.uniforms.uTIRTexture.value =
      tirRenderTarget.texture;

    // Compute camera forward direction's dot with world up
    // This tells the shader how much we're looking upward
    const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    underwaterPostProcessing.material.uniforms.uCameraDir.value.copy(camForward);
    underwaterPostProcessing.material.uniforms.uCameraUpDot.value = camForward.y;

    // Render underwater scene to offscreen target, then post-process
    renderer.setRenderTarget(underwaterPostProcessing.renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    underwaterPostProcessing.material.uniforms.uTexture.value = underwaterPostProcessing.renderTarget.texture;
    underwaterPostProcessing.material.uniforms.uTime.value = time;

    renderer.render(underwaterPostProcessing.scene, underwaterPostProcessing.camera);
  } else {
    renderer.render(scene, camera);
  }
}

// ============================================================
// START
// ============================================================
init();