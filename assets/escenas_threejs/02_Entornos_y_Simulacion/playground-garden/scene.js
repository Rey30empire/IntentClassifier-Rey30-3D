import * as THREE from "three/webgpu";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildTreeGrove, createStandaloneTree, animateSapinWind, animateLeafWind } from "./tree-generator.js";
import { buildFlowerGrove, createButterflies, animateButterflies, removeButterflies } from "./flower.js";
import { buildBushGrove, createStandaloneBush, buildPillarBushGrove, createPillarBush } from "./bush.js";
import { buildGarden, buildBerryGarden } from "./garden.js";
import { buildLandscape } from "./landscape.js";
import { buildFenceLine } from "./fence.js";
import { buildRoadSlide } from "./road.js";
import { createStandaloneBench, SEAT_WIDTH, SEAT_DEPTH, LEG_HEIGHT, PLANK_HEIGHT } from "./bench.js";
import { buildPondSlide } from "./water.js";
import { createCharacter, animateCharacter } from "./character.js";
import { updateSkeletonAnimation, resetCharacterPosition, getAnimState, setForcedAnimation, setWalkTarget, triggerSitJump, triggerStandJump, setSeatLevel, lockInput, triggerFenceLeap } from "./skeleton-animation.js";
import { InteractionBox, setDebugMode, getDebugMode } from "./interaction-box.js";
import { createRenderer, createScene, createCamera, setupLighting, setupPostProcessing, loadHDR } from "./env-settings.js";
import { createGUI } from "./gui-panel.js";
import {
  uv, float, vec2, vec3, abs, fract, step, smoothstep, mix, sin, cos,
  floor, hash, min, max, dot as tslDot, uniform, color
} from "three/tsl";

// ── Renderer ──
const renderer = await createRenderer();

// ── Scene ──
const scene = createScene();

// ── Camera ──
const camera = createCamera();

// ── Controls ──
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 2.0;
controls.maxDistance = 8;
controls.maxPolarAngle = Math.PI * 0.48;
controls.update();

// ── Camera follow state (Zelda-style third-person) ──
let cameraFollowMode = false;
let cameraFollowBlend = 0;
let isMouseInteracting = false;
const FOLLOW_DISTANCE = 2.5;   // distance behind the character
const FOLLOW_DISTANCE_BACK = 5.0; // distance when walking backward (prevent flip)
const FOLLOW_HEIGHT = 1.2;     // camera height above character
const FOLLOW_HEIGHT_BACK = 1.8; // higher camera when walking backward
const FOLLOW_LOOK_HEIGHT = 0.4; // look-at point height on character
const FOLLOW_SMOOTH = 4.0;     // camera lerp speed
const MIN_CAMERA_DISTANCE = 2.0; // minimum distance camera can be from character
const FOLLOW_DELAY = 2.0;      // seconds of continuous movement before camera follows
let movingTimer = 0;            // tracks how long character has been moving
let lastFollowedRot = null;     // last rotation the camera was tracking
let currentFollowDist = FOLLOW_DISTANCE;  // animated follow distance
let currentFollowHeight = FOLLOW_HEIGHT;  // animated follow height
let rotationDelayTimer = 0;               // delay before camera rotates on left/right turns
const ROTATION_DELAY = 1.2;               // seconds before camera starts rotating behind on turns
let isTurning = false;                    // whether character is only turning left/right

renderer.domElement.addEventListener("pointerdown", () => {
  isMouseInteracting = true;
  // Mouse grab — exit follow mode and hand control back to orbit
  if (cameraFollowMode) {
    cameraFollowMode = false;
    cameraFollowBlend = 0;
    movingTimer = 0;
    rotationDelayTimer = 0;
    isTurning = false;
    lastFollowedRot = null;
  }
});
renderer.domElement.addEventListener("pointerup", () => {
  isMouseInteracting = false;
});
renderer.domElement.addEventListener("wheel", () => {
  // Scroll zoom — exit follow mode
  if (cameraFollowMode) {
    cameraFollowMode = false;
    cameraFollowBlend = 0;
    movingTimer = 0;
    rotationDelayTimer = 0;
    isTurning = false;
    lastFollowedRot = null;
  }
});

// ── Lighting ──
const lights = setupLighting(scene);

// ── HDR Environment ──
loadHDR(scene);

// ── Post-Processing (SSGI + TRAA) ──
const { renderPipeline, aoPass, updateOutputPipeline } = setupPostProcessing(renderer, scene, camera);

// ── Ground Quad ──
const PLANE_HEIGHT = 0.04;

const groundGeo = new THREE.PlaneGeometry(40, 40);
const groundMat = new THREE.MeshStandardNodeMaterial({
  roughness: 0.9,
  metalness: 0.0,
});

// ── Ground shader uniforms (exposed to GUI) ──
const groundUniforms = {
  baseColor:      uniform(color(0x355e1a)),   // dark base grass green
  triColor1:      uniform(color(0x3d6b1e)),   // dark olive
  triColor2:      uniform(color(0x2f5214)),   // deep forest green
  triColor3:      uniform(color(0x4a7a28)),   // mid green
  triColor4:      uniform(color(0x3a6a1c)),   // muted olive green
  tileScale:      uniform(float(594.0)),      // number of tile cells
  triSizeMin:     uniform(float(0.14)),       // min triangle size
  triSizeMax:     uniform(float(0.80)),       // max triangle size
  triDensity:     uniform(float(1.00)),       // 0–1 triangle visibility ratio
  triBrightVar:   uniform(float(0.12)),       // per-triangle brightness variation
};

// ── TSL triangle pattern for ground ──
const uvScaled = uv().mul(groundUniforms.tileScale);

// Grid cell coords
const cellXY = floor(uvScaled);
const cellFrac = fract(uvScaled);

// Hash-based random per cell for triangle orientation, color, visibility
const cellSeed = hash(cellXY.x.add(cellXY.y.mul(137.31)));
const cellSeed2 = hash(cellXY.x.mul(73.17).add(cellXY.y.mul(259.93)));
const cellSeed3 = hash(cellXY.x.mul(311.07).add(cellXY.y.mul(43.71)));

// Random triangle size
const triSizeRange = groundUniforms.triSizeMax.sub(groundUniforms.triSizeMin);
const triSize = cellSeed2.mul(triSizeRange).add(groundUniforms.triSizeMin);

// Random offset within cell
const offX = hash(cellXY.x.mul(17.3).add(cellXY.y.mul(91.7))).mul(float(1.0).sub(triSize)).mul(0.8).add(0.1);
const offY = hash(cellXY.x.mul(53.1).add(cellXY.y.mul(29.3))).mul(float(1.0).sub(triSize)).mul(0.8).add(0.1);

// Local coords relative to triangle center
const lx = cellFrac.x.sub(offX).sub(triSize.mul(0.5));
const ly = cellFrac.y.sub(offY).sub(triSize.mul(0.5));

// Normalize to triangle size
const nlx = lx.div(triSize);
const nly = ly.div(triSize);

// Random rotation per cell (0, 90, 180, 270 degrees)
const rotIdx = floor(cellSeed3.mul(4.0));
const angle = rotIdx.mul(Math.PI * 0.5);
const ca = cos(angle);
const sa = sin(angle);
const rlx = nlx.mul(ca).sub(nly.mul(sa));
const rly = nlx.mul(sa).add(nly.mul(ca));

// Triangle SDF: equilateral-ish triangle
const k = float(1.732);
const tx = abs(rlx).mul(k).add(rly);
const triEdge1 = step(tx, float(0.65));
const triEdge2 = step(rly, float(0.35));
const triEdge3 = step(float(-0.3), rly);
const inTriangle = triEdge1.mul(triEdge2).mul(triEdge3);

// Visibility based on density
const triVisible = step(cellSeed, groundUniforms.triDensity);
const triFinal = inTriangle.mul(triVisible);

// Pick triangle color from palette based on cell hash (4 equal buckets)
const colorChoice = cellSeed2;
// Use step functions to create 4 equal ranges: 0-0.25, 0.25-0.5, 0.5-0.75, 0.75-1.0
const isAbove25 = step(float(0.25), colorChoice);
const isAbove50 = step(float(0.50), colorChoice);
const isAbove75 = step(float(0.75), colorChoice);
// Start with color1, progressively override
const triColor12 = mix(groundUniforms.triColor1, groundUniforms.triColor2, isAbove25);
const triColor123 = mix(triColor12, groundUniforms.triColor3, isAbove50);
const triColor = mix(triColor123, groundUniforms.triColor4, isAbove75);

// Slight per-triangle brightness variation
const brightness = cellSeed3.mul(groundUniforms.triBrightVar).add(float(1.0).sub(groundUniforms.triBrightVar.mul(0.5)));
const finalTriColor = triColor.mul(brightness);

// Blend triangle onto base color
const groundColor = mix(groundUniforms.baseColor, finalTriColor, triFinal);

groundMat.colorNode = groundColor;

const ground = new THREE.Mesh(groundGeo, groundMat);
ground.name = "ground";
ground.rotation.x = -Math.PI / 2;
ground.position.y = PLANE_HEIGHT;
ground.receiveShadow = true;
scene.add(ground);

// ══════════════════════════════════════════════
// ── SLIDES ──
// ══════════════════════════════════════════════

const slides = [];
let currentSlide = parseInt(localStorage.getItem("currentSlide") || "0", 10);
if (currentSlide < 0 || currentSlide >= 12) currentSlide = 0;

// ── Slide build configs (seed can be randomized) ──
const slideConfigs = {
  landscape: { seed: Math.floor(Math.random() * 999999) },
  tree: { count: 5, fieldRadius: 1.0, treeRadius: 0.38, seed: 4 },
  flower: { count: 120, fieldRadius: 1.5, seed: 9876 },
  bush: { count: 10, fieldRadius: 1.8, bushRadius: 0.28, seed: 555 },
  pillarBush: { count: 6, fieldRadius: 1.5, bushRadius: 0.35, seed: 777 },
  garden: { seed: 2024, berrySeed: 7777 },
  fence: { sections: 3, pickets: 5, seed: 321 },
  road: { seed: 54321, destinations: 4 },
  bench: { seed: 777 },
  pond: { seed: 1234 },
  character: { seed: 42 },
  benchInteraction: { seed: 999 },
};

// ── Butterfly tracking ──
let activeFlowerButterflies = null;
let activeLandscapeButterflies = null;

// ── InteractionBox tracking (array — supports multiple benches per slide) ──
let activeBenchInteractionBoxes = [];
let activeFenceInteractionBoxes = [];

function buildSlide(index) {
  if (index === 0) {
    // Clean up old landscape butterflies
    if (activeLandscapeButterflies) {
      removeButterflies(activeLandscapeButterflies);
      activeLandscapeButterflies = null;
    }
    const g = buildLandscape(slideConfigs.landscape);
    g.name = "slide_landscape";
    // Capture butterfly data created inside landscape builder
    activeLandscapeButterflies = g.userData.landscapeButterflies || null;
    // Add playable character to the landscape (scaled down 50%)
    const landscapeChar = createCharacter();
    landscapeChar.position.set(0, 0, 0);
    landscapeChar.scale.setScalar(0.5);
    g.add(landscapeChar);
    return g;
  } else if (index === 1) {
    const g = buildTreeGrove(slideConfigs.tree);
    g.name = "slide_tree";
    return g;
  } else if (index === 2) {
    // Clean up old butterflies if any
    if (activeFlowerButterflies) {
      removeButterflies(activeFlowerButterflies);
      activeFlowerButterflies = null;
    }
    const g = buildFlowerGrove(slideConfigs.flower);
    g.name = "slide_flowerField";
    // Add butterflies to flower field (max 4 for performance)
    activeFlowerButterflies = createButterflies(g, {
      count: 4,
      fieldRadius: slideConfigs.flower.fieldRadius || 1.5,
      seed: slideConfigs.flower.seed || 9876,
    });
    return g;
  } else if (index === 3) {
    const g = buildBushGrove(slideConfigs.bush);
    g.name = "slide_bushGrove";
    return g;
  } else if (index === 4) {
    const g = buildPillarBushGrove(slideConfigs.pillarBush);
    g.name = "slide_pillarBushGrove";
    return g;
  } else if (index === 5) {
    const wrapper = new THREE.Group();
    wrapper.name = "slide_garden";
    // Herb garden on the left
    const herbGarden = buildGarden({ seed: slideConfigs.garden.seed });
    herbGarden.name = "slide_herbGarden";
    herbGarden.position.x = -0.7;
    wrapper.add(herbGarden);
    // Berry garden on the right
    const berryGarden = buildBerryGarden({ seed: slideConfigs.garden.berrySeed });
    berryGarden.name = "slide_berryGarden";
    berryGarden.position.x = 0.7;
    wrapper.add(berryGarden);
    return wrapper;
  } else if (index === 6) {
    const g = buildFenceLine(slideConfigs.fence);
    g.name = "slide_fence";
    return g;
  } else if (index === 7) {
    const g = buildRoadSlide(slideConfigs.road);
    g.name = "slide_road";
    return g;
  } else if (index === 8) {
    const g = new THREE.Group();
    g.name = "slide_bench";
    const bench = createStandaloneBench(null, {
      seed: slideConfigs.bench.seed,
      position: { x: 0, y: 0, z: 0 },
      scale: 1.0,
    });
    bench.rotation.y = Math.PI; // rotate 180° so front faces camera
    g.add(bench);
    return g;
  } else if (index === 9) {
    const g = buildPondSlide({ seed: slideConfigs.pond.seed });
    g.name = "slide_pond";
    return g;
  } else if (index === 10) {
    const g = new THREE.Group();
    g.name = "slide_character";
    const character = createCharacter();
    g.add(character);
    return g;
  } else {
    // Slide 11: Bench + Character interaction
    // Clean up old interaction boxes
    activeBenchInteractionBoxes.forEach((ib) => ib.dispose());
    activeBenchInteractionBoxes = [];

    const g = new THREE.Group();
    g.name = "slide_benchInteraction";

    // Add bench — positioned slightly back so character can walk up to it
    const bench = createStandaloneBench(null, {
      seed: slideConfigs.benchInteraction.seed,
      position: { x: 0, y: 0, z: 0.3 },
      scale: 1.0,
    });
    bench.rotation.y = Math.PI; // front faces camera
    bench.name = "interactionBench";
    g.add(bench);

    // Add playable character — starts in front of bench (front is +Z after rotation)
    const character = createCharacter();
    character.position.set(0, 0, 0);
    character.scale.setScalar(0.5);
    g.add(character);

    // Store bench ref so setupBenchInteractions can find it
    g.userData.benchRef = bench;

    return g;
  }
}

// ── Slide 0: Landscape ──
slides.push(buildSlide(0));

// ── Slide 1: Tree Grove ──
slides.push(buildSlide(1));

// ── Slide 2: Flower Field ──
slides.push(buildSlide(2));

// ── Slide 3: Bush Grove ──
slides.push(buildSlide(3));

// ── Slide 4: Pillar Bush Grove ──
slides.push(buildSlide(4));

// ── Slide 5: Garden ──
slides.push(buildSlide(5));

// ── Slide 6: Fence ──
slides.push(buildSlide(6));

// ── Slide 7: Road ──
slides.push(buildSlide(7));

// ── Slide 8: Bench ──
slides.push(buildSlide(8));

// ── Slide 9: Duck Pond ──
slides.push(buildSlide(9));

// ── Slide 10: Character ──
slides.push(buildSlide(10));

// ── Slide 11: Bench + Character Interaction ──
slides.push(buildSlide(11));

// ══════════════════════════════════════════════
// ── NAVIGATION ARROWS (created before showSlide) ──
// ══════════════════════════════════════════════

const navStyle = document.createElement("style");
navStyle.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

  #slide-nav {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 14px;
    background: rgba(18, 18, 22, 0.88);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px; padding: 8px 18px;
    font-family: 'Inter', sans-serif;
    backdrop-filter: blur(12px); z-index: 9999;
    user-select: none;
  }
  #slide-nav button {
    background: none; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px; color: rgba(255,255,255,0.7);
    font-size: 16px; width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.15s, color 0.15s;
    font-family: 'Inter', sans-serif;
  }
  #slide-nav button:hover:not(:disabled) {
    background: rgba(255,255,255,0.08); color: #fff;
  }
  #slide-nav button:disabled {
    opacity: 0.2; cursor: default;
  }
  #generate-wrap {
    position: fixed; left: 50%; transform: translateX(-50%);
    z-index: 9999; display: flex; justify-content: center;
    font-family: 'Inter', sans-serif;
  }
  #generate-btn {
    padding: 8px 24px;
    font-size: 11px; font-weight: 500;
    letter-spacing: 0.3px;
    background: rgba(18, 18, 22, 0.88);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    color: rgba(255,255,255,0.7);
    cursor: pointer;
    backdrop-filter: blur(12px);
    transition: background 0.15s, color 0.15s;
    font-family: 'Inter', sans-serif;
  }
  #generate-btn:hover {
    background: rgba(255,255,255,0.08);
    color: #fff;
  }
  #slide-nav .slide-label {
    font-size: 11px; color: rgba(255,255,255,0.5);
    min-width: 100px; text-align: center;
    letter-spacing: 0.3px;
  }
  #slide-nav .slide-dots {
    display: flex; gap: 6px;
  }
  #slide-nav .dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: rgba(255,255,255,0.15); transition: background 0.2s;
  }
  #slide-nav .dot.active {
    background: rgba(255,255,255,0.7);
  }
`;
document.head.appendChild(navStyle);

const slideNames = ["Landscape", "Tree", "Flower Field", "Bush", "Pillar Bush", "Garden", "Fence", "Road", "Bench", "Duck Pond", "Character", "Bench Sit"];

const nav = document.createElement("div");
nav.id = "slide-nav";

const prevBtn = document.createElement("button");
prevBtn.textContent = "←";
prevBtn.addEventListener("click", () => {
  currentSlide = (currentSlide - 1 + slides.length) % slides.length;
  showSlide(currentSlide);
});

const nextBtn = document.createElement("button");
nextBtn.textContent = "→";
nextBtn.addEventListener("click", () => {
  currentSlide = (currentSlide + 1) % slides.length;
  showSlide(currentSlide);
});

const labelEl = document.createElement("div");
labelEl.className = "slide-label";

const dotsEl = document.createElement("div");
dotsEl.className = "slide-dots";
slides.forEach(() => {
  const dot = document.createElement("div");
  dot.className = "dot";
  dotsEl.appendChild(dot);
});

const generateBtn = document.createElement("button");
generateBtn.id = "generate-btn";
generateBtn.textContent = "Generate";
generateBtn.addEventListener("click", () => {
  // Pick a new random seed for the current slide
  const newSeed = Math.floor(Math.random() * 999999);
  if (currentSlide === 0) {
    slideConfigs.landscape.seed = newSeed;
  } else if (currentSlide === 1) {
    slideConfigs.tree.seed = newSeed;
  } else if (currentSlide === 2) {
    slideConfigs.flower.seed = newSeed;
  } else if (currentSlide === 3) {
    slideConfigs.bush.seed = newSeed;
  } else if (currentSlide === 4) {
    slideConfigs.pillarBush.seed = newSeed;
  } else if (currentSlide === 5) {
    slideConfigs.garden.seed = newSeed;
    slideConfigs.garden.berrySeed = newSeed + 42;
  } else if (currentSlide === 6) {
    slideConfigs.fence.seed = newSeed;
  } else if (currentSlide === 7) {
    slideConfigs.road.seed = newSeed;
  } else if (currentSlide === 8) {
    slideConfigs.bench.seed = newSeed;
  } else if (currentSlide === 9) {
    slideConfigs.pond.seed = newSeed;
  } else if (currentSlide === 10) {
    slideConfigs.character.seed = newSeed;
  } else if (currentSlide === 11) {
    slideConfigs.benchInteraction.seed = newSeed;
  }

  // Remove old slide from scene
  const oldGroup = slides[currentSlide];
  if (oldGroup.parent) scene.remove(oldGroup);
  oldGroup.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    // Only dispose materials that are NOT shared module-level singletons
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (!m._shared) m.dispose();
      });
    }
  });

  // Build & show new slide
  slides[currentSlide] = buildSlide(currentSlide);
  slides[currentSlide].position.y += PLANE_HEIGHT;
  scene.add(slides[currentSlide]);
  // Use showSlide to properly set up interaction boxes and reset state
  showSlide(currentSlide);
});

nav.appendChild(prevBtn);
nav.appendChild(dotsEl);
nav.appendChild(labelEl);
nav.appendChild(nextBtn);
document.body.appendChild(nav);

const generateWrap = document.createElement("div");
generateWrap.id = "generate-wrap";
generateWrap.appendChild(generateBtn);
document.body.appendChild(generateWrap);

// Position generate button 16px above nav bar
function positionGenerateBtn() {
  const navRect = nav.getBoundingClientRect();
  const navBottom = window.innerHeight - navRect.top; // distance from bottom of viewport to top of nav
  generateWrap.style.bottom = (navBottom + 16) + "px";
}
requestAnimationFrame(positionGenerateBtn);
window.addEventListener("resize", positionGenerateBtn);

// ── Debug Mode Toggle Button ──
const debugBtnStyle = document.createElement("style");
debugBtnStyle.textContent = `
  #debug-toggle {
    position: fixed; top: 14px; left: 14px; z-index: 9999;
    padding: 6px 14px;
    font-size: 11px; font-weight: 500;
    letter-spacing: 0.3px;
    background: rgba(18, 18, 22, 0.88);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    backdrop-filter: blur(12px);
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    font-family: 'Inter', sans-serif;
    user-select: none;
  }
  #debug-toggle:hover {
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.8);
  }
  #debug-toggle.active {
    border-color: rgba(0, 255, 100, 0.4);
    color: rgba(0, 255, 100, 0.8);
    background: rgba(0, 255, 100, 0.08);
  }
`;
document.head.appendChild(debugBtnStyle);

const debugBtn = document.createElement("button");
debugBtn.id = "debug-toggle";
debugBtn.textContent = "Debug";
debugBtn.addEventListener("click", () => {
  const next = !getDebugMode();
  setDebugMode(next);
  debugBtn.classList.toggle("active", next);
  debugBtn.textContent = next ? "Debug ●" : "Debug";
});
document.body.appendChild(debugBtn);

function updateArrows() {
  prevBtn.disabled = false;
  nextBtn.disabled = false;
  labelEl.textContent = slideNames[currentSlide] || `Slide ${currentSlide + 1}`;
  dotsEl.querySelectorAll(".dot").forEach((d, i) => {
    d.classList.toggle("active", i === currentSlide);
  });
}

// ══════════════════════════════════════════════
// ── BENCH INTERACTION SETUP (generic — works for any slide) ──
// ══════════════════════════════════════════════

/**
 * Creates an InteractionBox for a single bench object.
 * Computes seat level, walk-to target, sit-facing angle from the bench's
 * world transform, then wires up click → walk → sit-jump → sit-down.
 */
function createBenchInteraction(benchObj, slideGroup) {
  const benchWorldPos = new THREE.Vector3();
  benchObj.getWorldPosition(benchWorldPos);

  // Seat level = half the bench bounding box height
  const benchBox = new THREE.Box3().setFromObject(benchObj);
  const benchSize = benchBox.getSize(new THREE.Vector3());
  const seatLevelWorld = benchBox.min.y + benchSize.y * 0.5;

  // The bench's local +Z is the backrest side.
  // After rotation by benchAngle, the seat front direction in world space is:
  //   front = rotate(0,0,+1) by benchAngle around Y → (sin(angle), 0, cos(angle))
  // The character should sit with its back toward the backrest (face opposite = front).
  const benchAngle = benchObj.rotation.y;
  // The "front" direction of the bench (seat open side) in world space
  const frontDirX = Math.sin(benchAngle + Math.PI);
  const frontDirZ = Math.cos(benchAngle + Math.PI);
  // The character faces outward (away from backrest) when seated
  const sitFacingAngle = Math.atan2(frontDirX, frontDirZ);

  // Walk-to target: a point in front of the bench, offset by jumpDistance along the front direction
  const jumpDistance = 0.25;
  const walkToPos = new THREE.Vector3(
    benchWorldPos.x + frontDirX * jumpDistance,
    0,
    benchWorldPos.z + frontDirZ * jumpDistance
  );

  // Seat lock position: bench center (world XZ), y=0 (skeleton handles Y via seatLevel)
  const seatLockPos = new THREE.Vector3(benchWorldPos.x, 0, benchWorldPos.z);

  // Walk facing angle: character should face TOWARD the bench while walking (opposite of front dir)
  const walkFacingAngle = Math.atan2(-frontDirX, -frontDirZ);

  let sitTriggered = false;

  /** Common sit trigger — used by both click-arrival and walk-into-box */
  function doSit() {
    if (sitTriggered) return;
    const state = getAnimState();
    if (state.forcedAnim === "sitdown" || state.forcedAnim === "sitjump" || state.forcedAnim === "standjump") return;
    sitTriggered = true;
    setSeatLevel(seatLevelWorld);
    // Lock input for 1 second so held movement keys don't immediately cancel the sit-jump
    lockInput(1.0);
    // Use current character position as jump start
    const startPos = state.characterPos.clone();
    triggerSitJump(seatLockPos, sitFacingAngle, startPos);
  }

  const ib = new InteractionBox(benchObj, scene, {
    padding: 0.03,
    widthScale: 0.55,
    rotationY: benchAngle,
    direction: sitFacingAngle,
    seatLevel: seatLevelWorld,
    camera: camera,
    domElement: renderer.domElement,
    onClick: () => {
      const state = getAnimState();
      if (state.forcedAnim === "sitdown" || state.forcedAnim === "sitjump" || state.forcedAnim === "standjump") return;
      sitTriggered = false;
      setWalkTarget(walkToPos, walkFacingAngle, () => {
        doSit();
      });
    },
    onEnter: () => {
      // Character walked into the bench bounding box — trigger sit automatically
      doSit();
    },
    onExit: () => {
      // Always reset sitTriggered when the character leaves the box
      // so they can re-enter and sit again later
      sitTriggered = false;
    },
  });

  // Store slideGroup ref so the animate loop can compute the world-space char AABB
  ib._slideGroup = slideGroup;
  return ib;
}

/**
 * Scans the given slide group for:
 *  • benches with userData.isBench (landscape benches)
 *  • benches with userData.benchRef (dedicated bench-interaction slide)
 * Creates an InteractionBox for each one.
 */
function setupBenchInteractions(slideGroup) {
  if (!slideGroup) return;

  // Check if the slide has a character (only slides with a character need interaction)
  let hasCharacter = false;
  slideGroup.traverse((obj) => {
    if (obj.name === "character") hasCharacter = true;
  });
  if (!hasCharacter) return;

  // Case 1: Dedicated bench-interaction slide (slide 11) — benchRef stored in userData
  if (slideGroup.userData.benchRef) {
    const ib = createBenchInteraction(slideGroup.userData.benchRef, slideGroup);
    activeBenchInteractionBoxes.push(ib);
  }

  // Case 2: Landscape or any slide with benches marked userData.isBench
  slideGroup.traverse((obj) => {
    if (obj.userData && obj.userData.isBench) {
      const ib = createBenchInteraction(obj, slideGroup);
      activeBenchInteractionBoxes.push(ib);
    }
  });
}

// ══════════════════════════════════════════════
// ── FENCE INTERACTION SETUP (leap over fences) ──
// ══════════════════════════════════════════════

/**
 * Creates an InteractionBox for a single fence object.
 * The interaction box is tight to the fence depth (thin axis only).
 * When the character's AABB intersects, triggers a lamb-like leap animation.
 */
function createFenceInteraction(fenceObj, slideGroup) {
  const fenceRotY = fenceObj.rotation.y;

  // Compute the fence's LOCAL bounding box (unrotated) to get true width and depth
  const savedRotY = fenceObj.rotation.y;
  fenceObj.rotation.y = 0;
  fenceObj.updateMatrixWorld(true);
  const localBox = new THREE.Box3().setFromObject(fenceObj);
  fenceObj.rotation.y = savedRotY;
  fenceObj.updateMatrixWorld(true);

  const localSize = localBox.getSize(new THREE.Vector3());
  const fenceWorldPos = new THREE.Vector3();
  fenceObj.getWorldPosition(fenceWorldPos);

  // The fence's width is the longer local axis (X), depth is the shorter (Z)
  const fenceWidth = localSize.x;
  const fenceDepth = localSize.z;  // the thin picket depth
  const fenceHeight = localSize.y;

  // Build a custom local AABB centered on the fence — tight to actual width and depth
  // Local space: X = width (long axis), Z = depth (thin axis), Y = height
  const localCenter = localBox.getCenter(new THREE.Vector3()).sub(fenceWorldPos);
  const customLocalAABB = new THREE.Box3(
    new THREE.Vector3(localCenter.x - fenceWidth * 0.5, localCenter.y - fenceHeight * 0.5, localCenter.z - fenceDepth * 0.5),
    new THREE.Vector3(localCenter.x + fenceWidth * 0.5, localCenter.y + fenceHeight * 0.5, localCenter.z + fenceDepth * 0.5)
  );

  let leapTriggered = false;

  // Use OBB with small padding — customLocalAABB is already tight to the fence
  const ib = new InteractionBox(fenceObj, scene, {
    padding: 0.04,
    rotationY: fenceRotY,
    customLocalAABB: customLocalAABB,
    direction: fenceRotY,
    debugColor: 0xff00ff,  // magenta for fences
    camera: camera,
    domElement: renderer.domElement,
    onClick: null,
    onEnter: () => {
      if (leapTriggered) return;
      const state = getAnimState();
      if (state.forcedAnim) return;
      if (state.fenceLeapCooldown > 0) return;

      leapTriggered = true;
      lockInput(1.0);

      // Use the character's current facing direction — leap straight through
      const charPos = state.characterPos;
      const facing = state.characterRotation;
      const dirX = Math.sin(facing);
      const dirZ = Math.cos(facing);

      const startPos = charPos.clone();
      // Land on the other side of the fence, keeping the same direction
      const totalLeapDist = fenceDepth + 0.35;
      const endPos = new THREE.Vector3(
        charPos.x + dirX * totalLeapDist,
        0,
        charPos.z + dirZ * totalLeapDist
      );

      triggerFenceLeap(startPos, endPos, facing);
    },
    onExit: () => {
      leapTriggered = false;
    },
  });

  ib._slideGroup = slideGroup;
  return ib;
}

/**
 * Scans the given slide group for fence objects and creates InteractionBoxes.
 * Looks for objects named like "fenceLine", "landscape_gardenFence_*",
 * "landscape_cornerFence_*", or containing "fence"/"Fence" in the name.
 */
function setupFenceInteractions(slideGroup) {
  if (!slideGroup) return;

  // Check if the slide has a character
  let hasCharacter = false;
  slideGroup.traverse((obj) => {
    if (obj.name === "character") hasCharacter = true;
  });
  if (!hasCharacter) return;

  // Find all fence groups in the slide
  slideGroup.traverse((obj) => {
    if (!obj.name) return;
    const n = obj.name.toLowerCase();
    if (n.includes("fence") && obj instanceof THREE.Group && obj.children.length > 0) {
      // Skip if it's a child of another fence (e.g. fenceSection inside fenceLine)
      if (obj.parent && obj.parent.name && obj.parent.name.toLowerCase().includes("fence")) return;
      const ib = createFenceInteraction(obj, slideGroup);
      activeFenceInteractionBoxes.push(ib);
    }
  });
}

// ── Show only current slide ──
function showSlide(index) {
  // Clean up all interaction boxes from any previous slide
  activeBenchInteractionBoxes.forEach((ib) => ib.dispose());
  activeBenchInteractionBoxes = [];
  activeFenceInteractionBoxes.forEach((ib) => ib.dispose());
  activeFenceInteractionBoxes = [];

  slides.forEach((g, i) => {
    if (i === index) {
      if (!g.parent) scene.add(g);
      g.visible = true;
    } else {
      g.visible = false;
    }
  });
  // Reset character position and camera follow when switching slides
  // For slide 11 (index 11): character starts in front of the bench (+Z side)
  if (index === 11) {
    resetCharacterPosition(0, 0.8);
  } else {
    resetCharacterPosition();
  }
  cameraFollowMode = false;
  cameraFollowBlend = 0;
  movingTimer = 0;
  rotationDelayTimer = 0;
  isTurning = false;
  lastFollowedRot = null;
  currentFollowDist = FOLLOW_DISTANCE;
  currentFollowHeight = FOLLOW_HEIGHT;
  controls.target.set(0, 0.5, 0);
  localStorage.setItem("currentSlide", index.toString());
  updateArrows();

  // ── Setup InteractionBoxes for every bench and fence in the current slide ──
  setupBenchInteractions(slides[index]);
  setupFenceInteractions(slides[index]);
}

// Add all slides to scene initially — raise to match ground plane height
slides.forEach((g) => {
  g.position.y += PLANE_HEIGHT;
  scene.add(g);
});
showSlide(currentSlide);

// ── GUI Panel ──
createGUI({ scene, renderer, lights, aoPass, updateOutputPipeline, groundUniforms });

// ── Performance Meter ──
const perfDiv = document.createElement("div");
perfDiv.style.cssText = `
  position: fixed; bottom: 10px; right: 10px; z-index: 9999;
  font-family: 'Inter', monospace; font-size: 11px;
  color: #fff; background: rgba(0,0,0,0.5);
  padding: 8px 12px; border-radius: 6px;
  pointer-events: none; line-height: 1.6;
  min-width: 120px;
`;
document.body.appendChild(perfDiv);
let fpsFrames = 0, fpsTime = performance.now(), fpsCurrent = 0;
let gpuTimeMs = 0;
let frameTimes = [];
let lastAnimTime = performance.now() / 1000;
const animClock = { elapsed: 0 };

// ── Animation ──
async function animate() {
  const nowSec = performance.now() / 1000;
  const delta = Math.min(nowSec - lastAnimTime, 0.05); // cap delta at 50ms
  lastAnimTime = nowSec;
  animClock.elapsed += delta;

  // Animate butterflies
  animateButterflies(delta, animClock.elapsed);

  // Animate sapin wind sway
  animateSapinWind(scene, animClock.elapsed);

  // Animate leaf rustling on standard trees
  animateLeafWind(scene, animClock.elapsed);

  // Animate character blink + talk
  animateCharacter(scene, animClock.elapsed, delta);

  // Animate character skeleton (walk/run/jump)
  scene.traverse((obj) => {
    if (obj.name === "character" && obj.userData.skeleton && obj.visible && obj.parent) {
      updateSkeletonAnimation(obj, animClock.elapsed, delta, camera);
    }
  });

  // Update all InteractionBoxes (benches + fences)
  {
    const animState = getAnimState();
    const cAABB = animState.charAABB;
    for (let i = 0; i < activeBenchInteractionBoxes.length; i++) {
      activeBenchInteractionBoxes[i].update(cAABB);
    }
    for (let i = 0; i < activeFenceInteractionBoxes.length; i++) {
      activeFenceInteractionBoxes[i].update(cAABB);
    }
  }

  // Camera follow — Zelda-style third-person: camera behind character
  if (currentSlide === 0) {
    const animState = getAnimState();
    const charWorldPos = animState.characterPos;
    const charRot = animState.characterRotation;
    const walkingBack = animState.moveBack;

    // Smoothly adjust distance & height — pull back when walking backward
    const targetDist = walkingBack ? FOLLOW_DISTANCE_BACK : FOLLOW_DISTANCE;
    const targetHeight = walkingBack ? FOLLOW_HEIGHT_BACK : FOLLOW_HEIGHT;
    const distLerp = 2.0 * delta;
    currentFollowDist += (targetDist - currentFollowDist) * distLerp;
    currentFollowHeight += (targetHeight - currentFollowHeight) * distLerp;

    // Detect if the character is only turning (left/right without forward)
    const turningOnly = (animState.moveLeft || animState.moveRight) && !animState.moveForwardOnly && !walkingBack;

    if (animState.isMoving || animState.isJumping) {
      // Accumulate movement timer
      movingTimer += delta;

      // Track rotation delay for left/right turns
      if (turningOnly) {
        rotationDelayTimer += delta;
        isTurning = true;
      } else {
        // Moving forward or back — reset turn delay, allow normal rotation
        rotationDelayTimer = ROTATION_DELAY; // instantly allow rotation for forward movement
        isTurning = false;
      }

      if (movingTimer >= FOLLOW_DELAY) {
        // Enough continuous movement — enter follow mode
        cameraFollowMode = true;
        // When walking backward, do NOT update lastFollowedRot — keep camera in front
        // When turning only and under rotation delay, also freeze camera rotation
        if (!walkingBack && !(isTurning && rotationDelayTimer < ROTATION_DELAY)) {
          lastFollowedRot = charRot;
        }
        cameraFollowBlend = Math.min(cameraFollowBlend + 3.0 * delta, 1.0);
      } else {
        // Still under delay — only track the look-at target, not the camera behind position
        const lookX = charWorldPos.x;
        const lookY = FOLLOW_LOOK_HEIGHT;
        const lookZ = charWorldPos.z;
        const trackSpeed = 3.0 * delta;
        controls.target.x += (lookX - controls.target.x) * trackSpeed;
        controls.target.y += (lookY - controls.target.y) * trackSpeed;
        controls.target.z += (lookZ - controls.target.z) * trackSpeed;
      }
    } else {
      // Not moving — reset timers
      movingTimer = 0;
      rotationDelayTimer = 0;
      isTurning = false;

      if (cameraFollowMode && !isMouseInteracting) {
        // Keep follow mode active after stopping, use last known rotation
        cameraFollowBlend = Math.min(cameraFollowBlend + 2.0 * delta, 1.0);
      }
    }

    if (cameraFollowMode) {
      // Use the last followed rotation so camera doesn't flip on stop
      const useRot = lastFollowedRot !== null ? lastFollowedRot : charRot;
      const t = cameraFollowBlend;

      // When turning only under the delay, use a much slower lerp so camera lags behind
      let lerpSpeed;
      if (isTurning && rotationDelayTimer < ROTATION_DELAY) {
        // Very slow — camera barely moves during the rotation delay
        lerpSpeed = 0.5 * t * delta;
      } else {
        lerpSpeed = FOLLOW_SMOOTH * t * delta;
      }

      // Target look-at point: character position at chest height
      const lookX = charWorldPos.x;
      const lookY = FOLLOW_LOOK_HEIGHT;
      const lookZ = charWorldPos.z;

      // Desired camera position: behind the character using animated distance
      const behindX = charWorldPos.x - Math.sin(useRot) * currentFollowDist;
      const behindZ = charWorldPos.z - Math.cos(useRot) * currentFollowDist;
      const behindY = currentFollowHeight;

      // Smoothly move camera toward the desired behind position
      camera.position.x += (behindX - camera.position.x) * lerpSpeed;
      camera.position.y += (behindY - camera.position.y) * lerpSpeed;
      camera.position.z += (behindZ - camera.position.z) * lerpSpeed;

      // Enforce minimum camera distance from character
      const dx = camera.position.x - charWorldPos.x;
      const dz = camera.position.z - charWorldPos.z;
      const horizontalDist = Math.sqrt(dx * dx + dz * dz);
      if (horizontalDist < MIN_CAMERA_DISTANCE && horizontalDist > 0.001) {
        const pushScale = MIN_CAMERA_DISTANCE / horizontalDist;
        camera.position.x = charWorldPos.x + dx * pushScale;
        camera.position.z = charWorldPos.z + dz * pushScale;
      }

      // Smoothly move the orbit target to character position
      controls.target.x += (lookX - controls.target.x) * lerpSpeed;
      controls.target.y += (lookY - controls.target.y) * lerpSpeed;
      controls.target.z += (lookZ - controls.target.z) * lerpSpeed;

      // Update tracked rotation while moving in follow mode (not when walking back or during turn delay)
      if (animState.isMoving && !walkingBack && !(isTurning && rotationDelayTimer < ROTATION_DELAY)) {
        lastFollowedRot = charRot;
      }
    }
  }

  const frameStart = performance.now();
  controls.update();
  await renderPipeline.renderAsync();
  const frameEnd = performance.now();
  const frameDelta = frameEnd - frameStart;
  frameTimes.push(frameDelta);

  fpsFrames++;
  const now = performance.now();
  if (now - fpsTime >= 500) {
    fpsCurrent = (fpsFrames / ((now - fpsTime) / 1000)).toFixed(0);
    // average frame time over the interval
    if (frameTimes.length > 0) {
      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      gpuTimeMs = avg.toFixed(1);
    }
    frameTimes = [];
    fpsFrames = 0;
    fpsTime = now;
    const info = renderer.info;
    const tris = info.render ? info.render.triangles : 0;
    const polys = tris;
    const geos = info.memory ? info.memory.geometries : 0;
    const texs = info.memory ? info.memory.textures : 0;
    const polysK = polys >= 1000000 ? (polys / 1000000).toFixed(1) + "M" : polys >= 1000 ? (polys / 1000).toFixed(1) + "K" : polys;
    perfDiv.innerHTML =
      `<span style="font-size:14px;font-weight:600">${fpsCurrent} FPS</span><br>` +
      `Frame: ${gpuTimeMs} ms<br>` +
      `Polygons: ${polysK}<br>` +
      `Geometries: ${geos}<br>` +
      `Textures: ${texs}`;
  }
}
renderer.setAnimationLoop(animate);

// ── Resize ──
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});