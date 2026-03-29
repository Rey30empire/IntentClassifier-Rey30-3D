// ══════════════════════════════════════════════
// BUSH GENERATOR
// ══════════════════════════════════════════════
//
// Dependencies: THREE.js (three/webgpu), tree-generator.js (shared petal geo)
// Creates dense, low bush clusters using multiple rings of leaves
// with varied green tones — no trunk, sits directly on ground.
// ══════════════════════════════════════════════

import * as THREE from "three/webgpu";
import { getSharedPetalGeo, seededRandom } from "./tree-generator.js";

// ══════════════════════════════════════════════
// ── CONSTANTS ──
// ══════════════════════════════════════════════

// 6 rings: 8+7+6+6+5+4 = 36 leaves per bush
const RINGS = [ // Ring 2
  { count: 8, tilt: Math.PI * 0.28, offset: Math.PI / 3,   lenMul: 0.78, wMul: 0.64, y: 0.002 },
 // Ring 2
  { count: 7, tilt: Math.PI * 0.24, offset: Math.PI / 8,   lenMul: 0.78, wMul: 0.56, y: 0.010 },
  // Ring 3
  { count: 6, tilt: Math.PI * 0.18, offset: Math.PI / 12,  lenMul: 0.72, wMul: 0.50, y: 0.018 },
  // Ring 4
  { count: 6, tilt: Math.PI * 0.13, offset: Math.PI / 6,   lenMul: 0.60, wMul: 0.46, y: 0.028 },
  // Ring 5
  { count: 5, tilt: Math.PI * 0.10, offset: Math.PI / 5,   lenMul: 0.48, wMul: 0.42, y: 0.038 },
  // Ring 6 (top, tightest)
  { count: 4, tilt: Math.PI * 0.06, offset: Math.PI / 4,   lenMul: 0.36, wMul: 0.38, y: 0.052 },
];

const LEAVES_PER_BUSH = RINGS.reduce((sum, r) => sum + r.count, 0); // 36
const BUSH_RADIUS = 0.48; // larger canopy radius

// ══════════════════════════════════════════════
// ── LEAF MATRIX COMPUTATION ──
// ══════════════════════════════════════════════

const _bushMatrixCache = new Map();

function computeBushLeafMatrices(radius) {
  const key = Math.round(radius * 1000);
  if (_bushMatrixCache.has(key)) return _bushMatrixCache.get(key);

  const matrices = [];
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const tmpMat = new THREE.Matrix4();

  for (const ring of RINGS) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + ring.offset;
      tmpPos.set(0, ring.y, 0);

      const m = new THREE.Matrix4();
      m.makeRotationY(angle);
      const tiltMat = new THREE.Matrix4().makeRotationX(-ring.tilt);
      m.multiply(tiltMat);

      tmpQuat.setFromRotationMatrix(m);
      tmpScale.set(ring.wMul * radius, ring.wMul * radius, ring.lenMul * radius);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      matrices.push(tmpMat.clone());
    }
  }
  _bushMatrixCache.set(key, matrices);
  return matrices;
}

// ══════════════════════════════════════════════
// ── GREEN PALETTE ──
// ══════════════════════════════════════════════

// 4 distinct green tones used within a single bush
const BUSH_GREENS = [
  new THREE.Color(0x3d7a14), // dark forest green
  new THREE.Color(0x5a9e2a), // mid green
  new THREE.Color(0x7cc93e), // bright lime green
  new THREE.Color(0x4a8e1e), // standard green
];

// ── Shared leaf material (pooled across all bushes) ──
const _sharedBushLeafMat = new THREE.MeshStandardNodeMaterial({
  roughness: 0.6,
  metalness: 0.02,
  side: THREE.DoubleSide,
  flatShading: false,
  envMapIntensity: 1.0,
});
_sharedBushLeafMat.vertexColors = true;
_sharedBushLeafMat._shared = true;

// ══════════════════════════════════════════════
// ── CREATE SINGLE BUSH ──
// ══════════════════════════════════════════════

export function createStandaloneBush(scene, options = {}) {
  const {
    seed = 12345,
    radius = BUSH_RADIUS,
    position = { x: 0, y: 0, z: 0 },
  } = options;

  const rand = seededRandom(seed);
  const group = new THREE.Group();
  group.name = "standaloneBush";
  group.position.set(position.x, position.y, position.z);

  const petalGeo = getSharedPetalGeo();
  const leafMatrices = computeBushLeafMatrices(radius);

  // Per-bush hue jitter — pre-compute tinted colors for all 4 greens
  const greenCount = BUSH_GREENS.length;
  const tintedColors = [];
  for (let gi = 0; gi < greenCount; gi++) {
    const hueShift = (rand() - 0.5) * 0.04;
    const satShift = (rand() - 0.5) * 0.1;
    const lightShift = (rand() - 0.5) * 0.06;

    const baseHSL = { h: 0, s: 0, l: 0 };
    BUSH_GREENS[gi].getHSL(baseHSL);
    tintedColors.push(new THREE.Color().setHSL(
      baseHSL.h + hueShift,
      Math.min(1, Math.max(0, baseHSL.s + satShift)),
      Math.min(1, Math.max(0, baseHSL.l + lightShift))
    ));
  }

  const im = new THREE.InstancedMesh(petalGeo, _sharedBushLeafMat, LEAVES_PER_BUSH);
  im.name = "bushLeaves";
  im.castShadow = true;
  im.receiveShadow = true;
  im.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(LEAVES_PER_BUSH * 3), 3
  );

  // Place leaves — each leaf gets a random green tone via per-instance color
  const yRot = rand() * Math.PI * 2;
  const canopyMatrix = new THREE.Matrix4();
  const canopyY = BUSH_RADIUS * 0.5;
  canopyMatrix.makeRotationY(yRot);
  canopyMatrix.setPosition(0, canopyY, 0);

  const tmpMat = new THREE.Matrix4();

  for (let m = 0; m < leafMatrices.length; m++) {
    tmpMat.multiplyMatrices(canopyMatrix, leafMatrices[m]);
    const colorIdx = Math.floor(rand() * greenCount);
    im.setMatrixAt(m, tmpMat);
    im.setColorAt(m, tintedColors[colorIdx]);
  }

  im.instanceMatrix.needsUpdate = true;
  im.instanceColor.needsUpdate = true;
  group.add(im);

  if (scene) scene.add(group);
  return group;
}

// ══════════════════════════════════════════════
// ── BUILD BUSH GROVE ──
// ══════════════════════════════════════════════
//
// Scatters multiple bushes on a circular area.
// Options:
//   count       — number of bushes (default: 8)
//   fieldRadius — scatter radius (default: 1.2)
//   bushRadius  — canopy size (default: 0.18)
//   seed        — random seed (default: 555)
//
// Returns a THREE.Group containing all bushes.

export function buildBushGrove(options = {}) {
  const {
    count = 8,
    fieldRadius = 1.2,
    bushRadius = BUSH_RADIUS,
    seed = 555,
  } = options;

  const rand = seededRandom(seed);
  const group = new THREE.Group();
  group.name = "bushGrove";

  const MIN_BUSH_DIST = bushRadius * 2;
  const placed = [];

  for (let i = 0; i < count; i++) {
    const sizeVariation = 0.7 + rand() * 0.6;
    let px, pz, valid;
    let attempts = 0;

    do {
      const angle = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * fieldRadius;
      px = Math.cos(angle) * dist;
      pz = Math.sin(angle) * dist;

      valid = true;
      for (const p of placed) {
        const dx = px - p.x;
        const dz = pz - p.z;
        if (dx * dx + dz * dz < MIN_BUSH_DIST * MIN_BUSH_DIST) {
          valid = false;
          break;
        }
      }
      attempts++;
    } while (!valid && attempts < 200);

    placed.push({ x: px, z: pz });

    const bushSeed = Math.floor(rand() * 999999);

    const bush = createStandaloneBush(null, {
      seed: bushSeed,
      radius: bushRadius * sizeVariation,
      position: { x: px, y: 0, z: pz },
    });
    bush.name = `groveBush_${i}`;
    group.add(bush);
  }

  return group;
}

// ══════════════════════════════════════════════
// ── PILLAR BUSH (4×4 grid of rounded pillars) ──
// ══════════════════════════════════════════════
//
// Inspired by Animal Crossing / Nintendo-style chunky bushes.
// Uses a 4×4 grid of capsule-shaped pillars (cylinder + hemisphere top),
// each slightly tilted at a unique angle for an organic look.

const PILLAR_GRID = 4;
const PILLAR_COUNT = PILLAR_GRID * PILLAR_GRID; // 16

// Green palette for pillars — varied yellowy-greens like the reference
const PILLAR_GREENS = [
  new THREE.Color(0x8ba83e), // olive yellow-green
  new THREE.Color(0x7a9e2a), // muted lime
  new THREE.Color(0x6b8f28), // medium olive
  new THREE.Color(0x9bb844), // bright yellow-green
  new THREE.Color(0xa4c24e), // light lime-green
  new THREE.Color(0x5d7a22), // dark olive
];

// Shared capsule geometry (unit size, scaled per instance)
let _sharedPillarGeo = null;
function getSharedPillarGeo() {
  if (_sharedPillarGeo) return _sharedPillarGeo;
  // CapsuleGeometry(radius, length, capSegments, radialSegments)
  // Reduced polygon count: capSegments=3, radialSegments=5
  _sharedPillarGeo = new THREE.CapsuleGeometry(1, 2, 3, 5);
  return _sharedPillarGeo;
}

// Shared material
const _sharedPillarMat = new THREE.MeshStandardNodeMaterial({
  roughness: 0.55,
  metalness: 0.02,
  side: THREE.FrontSide,
  flatShading: false,
  envMapIntensity: 1.0,
});
_sharedPillarMat.vertexColors = true;
_sharedPillarMat._shared = true;

// ══════════════════════════════════════════════
// ── CREATE SINGLE PILLAR BUSH ──
// ══════════════════════════════════════════════

export function createPillarBush(scene, options = {}) {
  const {
    seed = 99999,
    radius = 0.35,
    position = { x: 0, y: 0, z: 0 },
  } = options;

  const rand = seededRandom(seed);
  const group = new THREE.Group();
  group.name = "pillarBush";
  group.position.set(position.x, position.y, position.z);

  const geo = getSharedPillarGeo();

  const im = new THREE.InstancedMesh(geo, _sharedPillarMat, PILLAR_COUNT);
  im.name = "pillarBushInstances";
  im.castShadow = true;
  im.receiveShadow = true;
  im.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(PILLAR_COUNT * 3), 3
  );

  const tmpMat = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const tmpEuler = new THREE.Euler();

  // Spacing between pillars in the 4×4 grid
  const spacing = radius * 0.35;
  const gridOffset = (PILLAR_GRID - 1) * spacing * 0.5;

  // Pillar dimensions — smaller, taller
  const pillarRadius = radius * 0.08;  // thinner pillars
  const pillarHeight = radius * 1.2;   // taller max height

  const colorCount = PILLAR_GREENS.length;

  // Pre-compute tinted colors with per-bush hue jitter
  const tintedColors = [];
  const hueJitter = (rand() - 0.5) * 0.06;
  for (let ci = 0; ci < colorCount; ci++) {
    const hsl = { h: 0, s: 0, l: 0 };
    PILLAR_GREENS[ci].getHSL(hsl);
    tintedColors.push(new THREE.Color().setHSL(
      hsl.h + hueJitter,
      Math.min(1, Math.max(0, hsl.s + (rand() - 0.5) * 0.1)),
      Math.min(1, Math.max(0, hsl.l + (rand() - 0.5) * 0.08))
    ));
  }

  for (let row = 0; row < PILLAR_GRID; row++) {
    for (let col = 0; col < PILLAR_GRID; col++) {
      const idx = row * PILLAR_GRID + col;

      // Grid position with slight random offset for organic feel
      const px = col * spacing - gridOffset + (rand() - 0.5) * spacing * 0.3;
      const pz = row * spacing - gridOffset + (rand() - 0.5) * spacing * 0.3;

      // Height variation — center pillars taller, edge ones shorter
      const cx = (col - (PILLAR_GRID - 1) / 2) / ((PILLAR_GRID - 1) / 2);
      const cz = (row - (PILLAR_GRID - 1) / 2) / ((PILLAR_GRID - 1) / 2);
      const distFromCenter = Math.sqrt(cx * cx + cz * cz);
      const heightMul = 1.0 - distFromCenter * 0.25 + rand() * 0.3;

      const finalHeight = pillarHeight * heightMul;
      const finalRadius = pillarRadius * (0.85 + rand() * 0.3);

      // Each pillar tilts outward from center + random angle
      const tiltAngle = 0.1 + distFromCenter * 0.2 + (rand() - 0.5) * 0.15;
      const tiltDir = Math.atan2(pz, px) + (rand() - 0.5) * 0.5;

      // CapsuleGeometry(1, 2, ...) => unit geo has radius=1, length=2
      // Total unit height = length + 2*radius = 2 + 2 = 4
      // Scale Y maps: finalHeight = scaleY * 4 => scaleY = finalHeight / 4
      const scaleY = finalHeight / 4;
      const scaleXZ = finalRadius;

      // Position: bottom of scaled capsule at y=0
      // Scaled half-height = scaleY * 2 = finalHeight/2
      const py = scaleY * 2;
      tmpPos.set(px, py, pz);

      // Rotation: tilt outward from center
      tmpEuler.set(
        Math.sin(tiltDir) * tiltAngle,
        rand() * Math.PI * 2,  // random Y spin
        Math.cos(tiltDir) * tiltAngle
      );
      tmpQuat.setFromEuler(tmpEuler);

      tmpScale.set(scaleXZ, scaleY, scaleXZ);

      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      im.setMatrixAt(idx, tmpMat);

      // Assign a random green from the palette
      const colorIdx = Math.floor(rand() * colorCount);
      im.setColorAt(idx, tintedColors[colorIdx]);
    }
  }

  im.instanceMatrix.needsUpdate = true;
  im.instanceColor.needsUpdate = true;
  group.add(im);

  if (scene) scene.add(group);
  return group;
}

// ══════════════════════════════════════════════
// ── BUILD PILLAR BUSH GROVE ──
// ══════════════════════════════════════════════

export function buildPillarBushGrove(options = {}) {
  const {
    count = 6,
    fieldRadius = 1.5,
    bushRadius = 0.35,
    seed = 777,
  } = options;

  const rand = seededRandom(seed);
  const group = new THREE.Group();
  group.name = "pillarBushGrove";

  const MIN_DIST = bushRadius * 2.5;
  const placed = [];

  for (let i = 0; i < count; i++) {
    const sizeVariation = 0.7 + rand() * 0.6;
    let px, pz, valid;
    let attempts = 0;

    do {
      const angle = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * fieldRadius;
      px = Math.cos(angle) * dist;
      pz = Math.sin(angle) * dist;

      valid = true;
      for (const p of placed) {
        const dx = px - p.x;
        const dz = pz - p.z;
        if (dx * dx + dz * dz < MIN_DIST * MIN_DIST) {
          valid = false;
          break;
        }
      }
      attempts++;
    } while (!valid && attempts < 200);

    placed.push({ x: px, z: pz });

    const bushSeed = Math.floor(rand() * 999999);

    const bush = createPillarBush(null, {
      seed: bushSeed,
      radius: bushRadius * sizeVariation,
      position: { x: px, y: 0, z: pz },
    });
    bush.name = `pillarBush_${i}`;
    group.add(bush);
  }

  return group;
}

// ══════════════════════════════════════════════
// ── EXPORTS ──
// ══════════════════════════════════════════════

export {
  computeBushLeafMatrices,
  LEAVES_PER_BUSH,
  BUSH_RADIUS,
  BUSH_GREENS,
  RINGS,
  PILLAR_GREENS,
  PILLAR_COUNT,
};