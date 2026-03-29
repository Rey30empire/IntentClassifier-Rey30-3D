// ══════════════════════════════════════════════
// FLOWER GENERATOR
// ══════════════════════════════════════════════
//
// Dependencies: THREE.js (three/webgpu)
// Contains:
//  - Flower center geometry (shared sphere)
//  - Flower petal matrix computation (6 petals per flower)
//  - Flower materials (white petals, yellow centers)
// ══════════════════════════════════════════════

import * as THREE from "three/webgpu";
import { attribute, uniform, float, sin, abs, positionLocal, vec3 } from "three/tsl";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ══════════════════════════════════════════════
// ── FLOWER CENTER GEOMETRY ──
// ══════════════════════════════════════════════

let _sharedFlowerCenterGeo = null;
function getSharedFlowerCenterGeo() {
  if (!_sharedFlowerCenterGeo) {
    _sharedFlowerCenterGeo = new THREE.SphereGeometry(1, 4, 3);
  }
  return _sharedFlowerCenterGeo;
}

// ══════════════════════════════════════════════
// ── FLOWER PETAL MATRICES ──
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
// ── FLOWER CONSTANTS ──
// ══════════════════════════════════════════════

const PETALS_PER_FLOWER = 5;
const FLOWER_RADIUS = 0.06;

// Compute flower center matrix (yellow sphere, flush with ground)
function computeFlowerCenterMatrix(radius, stemH, fx, fy, fz) {
  const mat = new THREE.Matrix4();
  const sphereR = radius * 0.32;
  mat.compose(
    new THREE.Vector3(fx, fy + radius * 0.22, fz),
    new THREE.Quaternion(),
    new THREE.Vector3(sphereR, sphereR, sphereR)
  );
  return mat;
}

// ── Petal matrix cache ──
const _flowerMatrixCache = new Map();

// Compute flower petal matrices: 1 ring of 6 petals
function computeFlowerPetalMatrices(radius) {
  const key = Math.round(radius * 1000);
  if (_flowerMatrixCache.has(key)) return _flowerMatrixCache.get(key);

  const matrices = [];
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const tmpMat = new THREE.Matrix4();

  const count = PETALS_PER_FLOWER;
  const tiltAngle = Math.PI * 0.18;
  const scaleLen = radius * 0.55;
  const scaleW = radius * 0.45;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    tmpPos.set(0, -radius * 0.06, 0);
    const m = new THREE.Matrix4();
    m.makeRotationY(angle);
    const tiltMat = new THREE.Matrix4().makeRotationX(tiltAngle);
    m.multiply(tiltMat);
    tmpQuat.setFromRotationMatrix(m);
    tmpScale.set(scaleW, scaleW, scaleLen);
    tmpMat.compose(tmpPos, tmpQuat, tmpScale);
    matrices.push(tmpMat.clone());
  }
  _flowerMatrixCache.set(key, matrices);
  return matrices;
}

// ══════════════════════════════════════════════
// ── SEEDED RANDOM (local copy) ──
// ══════════════════════════════════════════════

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ══════════════════════════════════════════════
// ── BUILD FLOWER GROVE ──
// ══════════════════════════════════════════════
//
// High-level builder (mirrors buildTreeGrove).
// Options:
//   count       — number of flowers (default: 175)
//   fieldRadius — scatter radius (default: 1.5)
//   seed        — random seed (default: 9876)
//
// Returns a THREE.Group containing the complete flower field.

export function buildFlowerGrove(options = {}) {
  const {
    count = 175,
    fieldRadius = 1.5,
    seed = 9876,
    rejectFn = null, // optional callback(worldX, worldZ) => true if position is blocked (e.g. road)
  } = options;

  const rand = seededRandom(seed);
  const positions = [];
  const MIN_DIST = FLOWER_RADIUS * 2;

  for (let f = 0; f < count; f++) {
    let fx, fz, valid;
    let attempts = 0;
    do {
      const angle = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * fieldRadius;
      fx = Math.cos(angle) * dist;
      fz = Math.sin(angle) * dist;
      valid = true;
      // Check against road/occupied cells via reject callback
      if (rejectFn && rejectFn(fx, fz)) {
        valid = false;
      }
      if (valid) {
        for (const p of positions) {
          const dx = fx - p.x;
          const dz = fz - p.z;
          if (dx * dx + dz * dz < MIN_DIST * MIN_DIST) {
            valid = false;
            break;
          }
        }
      }
      attempts++;
    } while (!valid && attempts < 200);
    if (!valid) continue; // skip this flower if no valid position found
    positions.push({
      x: fx,
      z: fz,
      stemH: 0.04 + rand() * 0.06,
      yRot: rand() * Math.PI * 2,
      tilt: (rand() - 0.5) * 0.15,
    });
  }

  const group = buildFlowerField(positions);
  group.name = "slide_flowerField";
  // Store flower positions so butterflies can land on them
  group.userData.flowerPositions = positions.map(p => ({
    x: p.x,
    y: FLOWER_RADIUS * 0.22 + 0.01, // top of center sphere
    z: p.z,
  }));
  return group;
}

// ══════════════════════════════════════════════
// ── BUILD FLOWER FIELD (low-level) ──
// ══════════════════════════════════════════════
//
// Creates all instanced meshes for the flower field.
// Receives an array of flower positions:
//   [{ x, z, stemH, yRot, tilt }, ...]
// Returns a THREE.Group containing the petal + center InstancedMeshes.

import { buildPetalGeo } from "./tree-generator.js";

// Low-poly petal geometry for flowers (4x3 instead of tree's 8x6)
let _sharedFlowerPetalGeo = null;
function getSharedFlowerPetalGeo() {
  if (!_sharedFlowerPetalGeo) _sharedFlowerPetalGeo = buildPetalGeo(4, 3);
  return _sharedFlowerPetalGeo;
}

// Shared petal material (one for all flowers, vertex colors for per-instance tint)
let _sharedPetalMat = null;
function getSharedPetalMat() {
  if (!_sharedPetalMat) {
    _sharedPetalMat = new THREE.MeshLambertNodeMaterial({
      side: THREE.DoubleSide,
      flatShading: false,
    });
    _sharedPetalMat.vertexColors = true;
    _sharedPetalMat._shared = true;
  }
  return _sharedPetalMat;
}

function buildFlowerField(positions) {
  const group = new THREE.Group();
  group.name = "flowerFieldGroup";

  const flowerCount = positions.length;
  const petalGeo = getSharedFlowerPetalGeo();
  const centerGeo = getSharedFlowerCenterGeo();
  const colorCount = PETAL_COLORS.length;
  const totalPetals = flowerCount * PETALS_PER_FLOWER;

  // Single InstancedMesh for ALL petals with shared material + per-instance color
  const petalIM = new THREE.InstancedMesh(petalGeo, getSharedPetalMat(), totalPetals);
  petalIM.name = "flowerFieldPetals";
  petalIM.castShadow = false;
  petalIM.receiveShadow = false;
  petalIM.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(totalPetals * 3), 3
  );

  const centerIM = new THREE.InstancedMesh(centerGeo, flowerCenterMat, flowerCount);
  centerIM.name = "flowerFieldCenters";
  centerIM.castShadow = false;
  centerIM.receiveShadow = false;

  const petalMatrices = computeFlowerPetalMatrices(FLOWER_RADIUS);
  const posMat = new THREE.Matrix4();
  const composedMat = new THREE.Matrix4();
  const tiltMat = new THREE.Matrix4(); // reuse instead of allocating per flower

  let petalIdx = 0;

  for (let f = 0; f < flowerCount; f++) {
    const { x: fx, z: fz, stemH, yRot, tilt } = positions[f];
    const fy = 0.0;
    const colorIdx = f % colorCount;
    const petalColor = PETAL_COLORS[colorIdx];

    // Center sphere
    centerIM.setMatrixAt(f, computeFlowerCenterMatrix(FLOWER_RADIUS, stemH, fx, fy, fz));

    // Petal ring
    posMat.makeRotationY(yRot);
    tiltMat.makeRotationX(tilt);
    posMat.multiply(tiltMat);
    posMat.setPosition(fx, fy, fz);

    for (let p = 0; p < PETALS_PER_FLOWER; p++) {
      composedMat.multiplyMatrices(posMat, petalMatrices[p]);
      petalIM.setMatrixAt(petalIdx, composedMat);
      petalIM.setColorAt(petalIdx, petalColor);
      petalIdx++;
    }
  }

  petalIM.instanceMatrix.needsUpdate = true;
  petalIM.instanceColor.needsUpdate = true;
  centerIM.instanceMatrix.needsUpdate = true;

  group.add(petalIM);
  group.add(centerIM);
  return group;
}

// ══════════════════════════════════════════════
// ── MATERIALS ──
// ══════════════════════════════════════════════

// ── Petal color palette: blue, white, yellow, pink ──
const PETAL_COLORS = [
  new THREE.Color(0x5b8def), // blue
  new THREE.Color(0xffffff), // white
  new THREE.Color(0xf5e042), // yellow
  new THREE.Color(0xf2899e), // soft rose-pink
];

const flowerCenterMat = new THREE.MeshLambertNodeMaterial({
  color: new THREE.Color(0xf5c842),
  flatShading: false,
});
flowerCenterMat._shared = true;


// ══════════════════════════════════════════════
// ── BUTTERFLY SYSTEM (single-mesh GPU-animated) ──
// ══════════════════════════════════════════════

const BUTTERFLY_COLORS = [
  { base: 0xff6b9d, lower: 0xc2185b },
  { base: 0xc084fc, lower: 0x7b1fa2 },
  { base: 0x60a5fa, lower: 0x1565c0 },
  { base: 0xfbbf24, lower: 0xf57f17 },
  { base: 0x34d399, lower: 0x2e7d32 },
  { base: 0xf472b6, lower: 0xad1457 },
  { base: 0xa78bfa, lower: 0x512da8 },
  { base: 0x38bdf8, lower: 0x0277bd },
  { base: 0xfb923c, lower: 0xe65100 },
  { base: 0x4ade80, lower: 0x33691e },
];

// ── Part IDs baked into vertex attribute ──
const PART_BODY = 0;
const PART_LEFT_UPPER = 1;
const PART_LEFT_LOWER = 2;
const PART_RIGHT_UPPER = 3;
const PART_RIGHT_LOWER = 4;

/**
 * Build the merged butterfly BufferGeometry once.
 * All 5 parts (body + 4 wings) merged into one geometry.
 * Custom attributes:
 *   aPartId  — float per vertex: which part (0–4)
 *   aPivotX  — float per vertex: x-distance from wing pivot (for flap rotation)
 */
let _mergedButterflyGeo = null;

function getMergedButterflyGeo() {
  if (_mergedButterflyGeo) return _mergedButterflyGeo;

  // Upper forewing — larger, more prominent with swept tip
  const upperShape = new THREE.Shape();
  upperShape.moveTo(0, 0);
  upperShape.bezierCurveTo(0.003, 0.015, 0.012, 0.04, 0.03, 0.055);
  upperShape.bezierCurveTo(0.045, 0.065, 0.06, 0.068, 0.072, 0.062);
  upperShape.bezierCurveTo(0.078, 0.055, 0.078, 0.042, 0.073, 0.03);
  upperShape.bezierCurveTo(0.065, 0.015, 0.04, 0.002, 0.02, -0.004);
  upperShape.bezierCurveTo(0.008, -0.006, 0.002, -0.002, 0, 0);
  const upperGeo = new THREE.ShapeGeometry(upperShape, 4);

  // Lower hindwing — rounder, shifted back with scalloped trailing edge
  const lowerShape = new THREE.Shape();
  lowerShape.moveTo(0, 0);
  lowerShape.bezierCurveTo(0.006, -0.004, 0.02, -0.016, 0.038, -0.026);
  lowerShape.bezierCurveTo(0.05, -0.033, 0.058, -0.034, 0.062, -0.03);
  lowerShape.bezierCurveTo(0.065, -0.024, 0.062, -0.015, 0.054, -0.008);
  lowerShape.bezierCurveTo(0.044, 0.0, 0.028, 0.005, 0.014, 0.004);
  lowerShape.bezierCurveTo(0.006, 0.003, 0.001, 0.001, 0, 0);
  const lowerGeo = new THREE.ShapeGeometry(lowerShape, 4);

  // Body capsule (rotated so it runs along Y-up / Z-forward)
  const bodyGeo = new THREE.CapsuleGeometry(0.0025, 0.03, 2, 4);
  bodyGeo.rotateX(Math.PI / 2);
  bodyGeo.translate(0, 0.015, 0);

  // Tag geometry vertices with partId, pivotX, and aPivotNorm (0..1 distance from root)
  function tagGeo(geo, partId, flipX, offsetZ) {
    const pos = geo.attributes.position;
    const count = pos.count;
    const partIds = new Float32Array(count);
    const pivotXs = new Float32Array(count);
    const pivotNorms = new Float32Array(count);

    // First pass: flip X and find max distance from root for normalization
    let maxDist = 0;
    for (let i = 0; i < count; i++) {
      const px = pos.getX(i) * flipX;
      pos.setX(i, px);
      if (offsetZ) pos.setZ(i, pos.getZ(i) + offsetZ);
      const py = pos.getY(i);
      const d = Math.sqrt(px * px + py * py);
      if (d > maxDist) maxDist = d;
    }
    if (maxDist < 0.0001) maxDist = 1;

    // Second pass: set attributes
    for (let i = 0; i < count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      partIds[i] = partId;
      pivotXs[i] = px;
      pivotNorms[i] = Math.sqrt(px * px + py * py) / maxDist;
    }
    geo.setAttribute("aPartId", new THREE.BufferAttribute(partIds, 1));
    geo.setAttribute("aPivotX", new THREE.BufferAttribute(pivotXs, 1));
    geo.setAttribute("aPivotNorm", new THREE.BufferAttribute(pivotNorms, 1));
    return geo;
  }

  // Tag body (partId=0, pivotX=0, pivotNorm=0 for all vertices — no flap)
  {
    const pos = bodyGeo.attributes.position;
    const count = pos.count;
    const partIds = new Float32Array(count);
    const pivotXs = new Float32Array(count);
    const pivotNorms = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      partIds[i] = PART_BODY;
      pivotXs[i] = 0;
      pivotNorms[i] = 0;
    }
    bodyGeo.setAttribute("aPartId", new THREE.BufferAttribute(partIds, 1));
    bodyGeo.setAttribute("aPivotX", new THREE.BufferAttribute(pivotXs, 1));
    bodyGeo.setAttribute("aPivotNorm", new THREE.BufferAttribute(pivotNorms, 1));
  }

  // Create wing copies for left (-1) and right (+1)
  const leftUpper = tagGeo(upperGeo.clone(), PART_LEFT_UPPER, -1, 0);
  const leftLower = tagGeo(lowerGeo.clone(), PART_LEFT_LOWER, -1, 0.0003);
  const rightUpper = tagGeo(upperGeo.clone(), PART_RIGHT_UPPER, 1, 0);
  const rightLower = tagGeo(lowerGeo.clone(), PART_RIGHT_LOWER, 1, 0.0003);

  // Merge all 5 geometries into one BufferGeometry
  _mergedButterflyGeo = mergeGeometries([bodyGeo, leftUpper, leftLower, rightUpper, rightLower], false);

  // Clean up source geos
  upperGeo.dispose(); lowerGeo.dispose(); bodyGeo.dispose();
  leftUpper.dispose(); leftLower.dispose(); rightUpper.dispose(); rightLower.dispose();

  return _mergedButterflyGeo;
}

/**
 * Create the TSL-powered material for a single butterfly.
 * Uses uniforms for flapPhase and flapStrength, and vertex attributes
 * to know which part each vertex belongs to and how far from the pivot.
 *
 * Each wing part gets INDEPENDENT flap behavior on the GPU:
 *   - Upper wings: main flap with fast flutter
 *   - Lower wings: phase-lagged, wider amplitude, softer flutter
 * This creates the natural staggered motion of real butterfly wings
 * while keeping everything in a single draw call.
 */
function createButterflyMaterial(baseColor, lowerColor) {
  const mat = new THREE.MeshLambertNodeMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });

  // Per-butterfly uniforms (updated from JS each frame)
  const uFlapPhase = uniform(float(0));
  const uFlapStrength = uniform(float(1));

  mat.userData.uFlapPhase = uFlapPhase;
  mat.userData.uFlapStrength = uFlapStrength;

  // Read custom vertex attributes
  const partId = attribute("aPartId");
  const pivotX = attribute("aPivotX");
  const pivotNorm = attribute("aPivotNorm"); // 0 at root, 1 at wingtip

  // ── Classify wing parts ──
  const isLeftUpper = partId.sub(1).abs().lessThan(0.5);   // partId == 1
  const isLeftLower = partId.sub(2).abs().lessThan(0.5);   // partId == 2
  const isRightUpper = partId.sub(3).abs().lessThan(0.5);  // partId == 3
  const isRightLower = partId.sub(4).abs().lessThan(0.5);  // partId == 4
  const isLeftWing = isLeftUpper.or(isLeftLower);
  const isRightWing = isRightUpper.or(isRightLower);
  const isUpper = isLeftUpper.or(isRightUpper);
  const isLower = isLeftLower.or(isRightLower);

  // Progressive curl factor: wingtips flex more than root (quadratic falloff)
  // pivotNorm=0 at body root → 0 displacement, pivotNorm=1 at wingtip → full displacement
  const curlFactor = pivotNorm.mul(pivotNorm); // quadratic = natural flex curve

  // ── Upper forewing flap: main stroke + fast flutter ──
  const upperMainFlap = sin(uFlapPhase).mul(0.85).mul(uFlapStrength);
  const upperFlutter = sin(uFlapPhase.mul(3.4)).mul(0.12).mul(uFlapStrength).mul(curlFactor);
  const upperFlapAngle = upperMainFlap.add(upperFlutter);

  // ── Lower hindwing flap: phase-lagged, wider sweep, softer flutter ──
  const lowerPhase = uFlapPhase.sub(0.6); // hindwings trail behind forewings
  const lowerMainFlap = sin(lowerPhase).mul(1.05).mul(uFlapStrength);
  const lowerFlutter = sin(lowerPhase.mul(2.3)).mul(0.07).mul(uFlapStrength).mul(curlFactor);
  const lowerFlapAngle = lowerMainFlap.add(lowerFlutter);

  // Select flap angle based on wing part, amplified by curl at the tips
  const rawFlapAngle = isUpper.select(upperFlapAngle, isLower.select(lowerFlapAngle, float(0)));
  const flapAngle = rawFlapAngle.mul(float(0.35).add(curlFactor.mul(0.65)));

  // ── Y displacement from flap — both wings rise and fall together (mirrored) ──
  const absPivot = abs(pivotX);
  const wingDisp = absPivot.mul(sin(flapAngle));
  const yDisp = isLeftWing.or(isRightWing).select(wingDisp, float(0));

  // ── Z displacement: lower wings sweep back during downstroke ──
  const lowerZSweep = isLower.select(
    sin(lowerPhase).mul(absPivot).mul(0.35).mul(uFlapStrength).mul(curlFactor),
    float(0)
  );

  // ── Wingtip twist: tips rotate slightly forward on downstroke ──
  const tipTwist = curlFactor.mul(sin(uFlapPhase)).mul(0.004).mul(uFlapStrength);
  const zTwist = isUpper.select(tipTwist, isLower.select(tipTwist.negate(), float(0)));

  // Apply combined displacement to position
  const pos = positionLocal;
  mat.positionNode = vec3(
    pos.x,
    pos.y.add(yDisp),
    pos.z.add(lowerZSweep).add(zTwist)
  );

  // Color node: body is dark, upper wings are baseColor, lower wings are lowerColor
  const isBody = partId.lessThan(0.5);

  const bodyCol = vec3(0.1, 0.1, 0.18);
  const baseCol = vec3(float(baseColor.r), float(baseColor.g), float(baseColor.b));
  const lowerCol = vec3(float(lowerColor.r), float(lowerColor.g), float(lowerColor.b));

  mat.colorNode = isBody.select(bodyCol, isLower.select(lowerCol, baseCol));

  return mat;
}

/**
 * Create a single butterfly — ONE mesh, ONE draw call.
 * Returns { mesh, uFlapPhase, uFlapStrength }
 */
function createButterfly(rand) {
  const geo = getMergedButterflyGeo();

  const palette = BUTTERFLY_COLORS[Math.floor(rand() * BUTTERFLY_COLORS.length)];
  const baseColor = new THREE.Color(palette.base);
  baseColor.offsetHSL((rand() - 0.5) * 0.06, (rand() - 0.5) * 0.1, (rand() - 0.5) * 0.08);
  const lowerColor = baseColor.clone().offsetHSL(-0.02, 0.05, -0.06);

  const mat = createButterflyMaterial(baseColor, lowerColor);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "butterfly_" + Math.floor(rand() * 99999);
  mesh.frustumCulled = false;

  const s = 0.6 + rand() * 0.5;
  mesh.scale.setScalar(s);

  return {
    mesh,
    uFlapPhase: mat.userData.uFlapPhase,
    uFlapStrength: mat.userData.uFlapStrength,
  };
}

/**
 * Generate patrol waypoints within a circular field.
 */
function generateWaypoints(fieldRadius, rand) {
  const waypoints = [];
  const count = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * fieldRadius * 0.85;
    const height = 0.15 + rand() * 0.45;
    waypoints.push(new THREE.Vector3(
      Math.cos(angle) * dist,
      height,
      Math.sin(angle) * dist
    ));
  }
  return waypoints;
}

// Active butterfly data for animation
const _activeButterflies = [];

// ── Reusable temp vectors — zero allocations per frame ──
const _tmpPos = new THREE.Vector3();
const _tmpLook = new THREE.Vector3();
const _tmpMid = new THREE.Vector3();

/**
 * Create butterflies for a flower field and add them to the group.
 * Each butterfly is now a SINGLE mesh with GPU-driven wing animation.
 */
export function createButterflies(fieldGroup, options = {}) {
  const {
    count = 4,
    fieldRadius = 1.5,
    seed = 12345,
  } = options;

  const flowerPositions = fieldGroup.userData.flowerPositions || [];
  const rand = seededRandom(seed + 777);
  const butterflies = [];

  for (let i = 0; i < count; i++) {
    const { mesh, uFlapPhase, uFlapStrength } = createButterfly(rand);
    const waypoints = generateWaypoints(fieldRadius, rand);

    mesh.position.copy(waypoints[0]);
    fieldGroup.add(mesh);

    const data = {
      mesh,
      uFlapPhase,
      uFlapStrength,
      waypoints,
      currentWP: 0,
      speed: 0.15 + rand() * 0.25,
      wingSpeed: 8 + rand() * 6,
      wobblePhase: rand() * Math.PI * 2,
      wobbleAmp: 0.02 + rand() * 0.03,
      fieldRadius,
      rand,
      progress: 0,
      startPos: waypoints[0].clone(),
      endPos: waypoints[1 % waypoints.length].clone(),
      controlPoint: new THREE.Vector3(),
      state: 0,
      restTimer: 0,
      restDuration: 0,
      nextRestIn: 3 + rand() * 8,
      restAccum: 0,
      dStartX: 0, dStartY: 0, dStartZ: 0,
      dTargetX: 0, dTargetY: 0, dTargetZ: 0,
      descentProgress: 0,
      preRestRX: 0,
      flowerPositions,
    };

    _computeControlPoint(data);
    butterflies.push(data);
    _activeButterflies.push(data);
  }

  return butterflies;
}

/**
 * Compute bezier control point — reuses _tmpMid, no allocations.
 */
function _computeControlPoint(data) {
  _tmpMid.addVectors(data.startPos, data.endPos).multiplyScalar(0.5);
  data.controlPoint.set(
    _tmpMid.x + (data.rand() - 0.5) * 0.4,
    Math.max(0.1, Math.min(0.6, _tmpMid.y + 0.1 + data.rand() * 0.3)),
    _tmpMid.z + (data.rand() - 0.5) * 0.4
  );

  const hDist = Math.sqrt(data.controlPoint.x ** 2 + data.controlPoint.z ** 2);
  if (hDist > data.fieldRadius * 0.9) {
    const sc = (data.fieldRadius * 0.9) / hDist;
    data.controlPoint.x *= sc;
    data.controlPoint.z *= sc;
  }
}

/**
 * Inline bezier — writes to out vector, zero allocs.
 */
function _bezierPoint(a, b, c, t, out) {
  const t1 = 1 - t;
  const t1sq = t1 * t1;
  const t1t = 2 * t1 * t;
  const tsq = t * t;
  out.x = t1sq * a.x + t1t * b.x + tsq * c.x;
  out.y = t1sq * a.y + t1t * b.y + tsq * c.y;
  out.z = t1sq * a.z + t1t * b.z + tsq * c.z;
}

/**
 * Pick a random nearby flower — O(n) scan with reservoir sampling,
 * no sort, no allocation of scored array.
 */
function _pickNearestFlower(d) {
  const flowers = d.flowerPositions;
  if (!flowers || flowers.length === 0) return false;

  const px = d.mesh.position.x;
  const pz = d.mesh.position.z;

  // Find the 8 nearest flowers in-place using a tiny fixed-size buffer
  const POOL = 8;
  const nearIdx = new Int32Array(POOL);
  const nearDist = new Float32Array(POOL);
  nearDist.fill(1e10);
  let poolCount = 0;

  for (let i = 0; i < flowers.length; i++) {
    const dx = flowers[i].x - px;
    const dz = flowers[i].z - pz;
    const distSq = dx * dx + dz * dz;
    if (poolCount < POOL) {
      nearIdx[poolCount] = i;
      nearDist[poolCount] = distSq;
      poolCount++;
    } else {
      // Replace the farthest in the pool
      let maxJ = 0;
      for (let j = 1; j < POOL; j++) {
        if (nearDist[j] > nearDist[maxJ]) maxJ = j;
      }
      if (distSq < nearDist[maxJ]) {
        nearIdx[maxJ] = i;
        nearDist[maxJ] = distSq;
      }
    }
  }

  const chosen = nearIdx[Math.floor(d.rand() * poolCount)];
  const f = flowers[chosen];
  d.dTargetX = f.x;
  d.dTargetY = f.y;
  d.dTargetZ = f.z;
  return true;
}

/**
 * Update wing flap via TSL uniforms — zero JS child traversal.
 * The GPU vertex shader handles all wing rotation.
 */
function _updateWingUniforms(d, elapsed, flapStrength) {
  const phase = elapsed * d.wingSpeed + d.wobblePhase;
  d.uFlapPhase.value = phase;
  d.uFlapStrength.value = flapStrength;
}

/**
 * Smoothstep for descent/ascent easing.
 */
function _smoothstep(t) {
  return t * t * (3 - 2 * t);
}

// ── State constants (avoid string comparisons per frame) ──
const ST_FLYING = 0;
const ST_DESCENDING = 1;
const ST_RESTING = 2;
const ST_ASCENDING = 3;

/**
 * Animate all active butterflies — single-mesh GPU-animated version.
 * Wing flap is driven entirely by two uniforms (uFlapPhase, uFlapStrength)
 * updated once per butterfly per frame. Position/rotation still in JS.
 */
export function animateButterflies(delta, elapsed) {
  for (let i = 0; i < _activeButterflies.length; i++) {
    const d = _activeButterflies[i];
    const bfly = d.mesh;

    // Walk up parent chain to check visibility (handles nested groups like landscape)
    let hidden = !bfly.visible;
    if (!hidden) {
      let p = bfly.parent;
      while (p) {
        if (!p.visible) { hidden = true; break; }
        p = p.parent;
      }
    }
    if (hidden) continue;

    // ── FLYING ──
    if (d.state === ST_FLYING) {

      _updateWingUniforms(d, elapsed, 1.0);

      d.progress += delta * d.speed;

      if (d.progress >= 1.0) {
        d.progress -= 1.0;
        d.currentWP = (d.currentWP + 1) % d.waypoints.length;
        const nextWP = (d.currentWP + 1) % d.waypoints.length;
        d.startPos.copy(d.waypoints[d.currentWP]);
        d.endPos.copy(d.waypoints[nextWP]);
        _computeControlPoint(d);
      }

      _bezierPoint(d.startPos, d.controlPoint, d.endPos, d.progress, _tmpPos);
      _tmpPos.y += Math.sin(elapsed * 3.5 + d.wobblePhase) * d.wobbleAmp;
      bfly.position.copy(_tmpPos);

      const lookT = Math.min(d.progress + 0.05, 1.0);
      _bezierPoint(d.startPos, d.controlPoint, d.endPos, lookT, _tmpLook);
      _tmpLook.y = _tmpPos.y;
      const dx = _tmpLook.x - _tmpPos.x;
      const dz = _tmpLook.z - _tmpPos.z;
      if (dx * dx + dz * dz > 0.000001) {
        bfly.lookAt(_tmpLook);
      }
      bfly.rotation.z += Math.sin(elapsed * 2.0 + d.wobblePhase) * 0.15;

      // Check rest timing
      d.restAccum += delta;
      if (d.restAccum >= d.nextRestIn && d.flowerPositions.length > 0) {
        if (_pickNearestFlower(d)) {
          d.state = ST_DESCENDING;
          d.dStartX = bfly.position.x;
          d.dStartY = bfly.position.y;
          d.dStartZ = bfly.position.z;
          d.descentProgress = 0;
          d.restDuration = 2.5 + d.rand() * 4.0;
          d.restAccum = 0;
        }
      }
    }

    // ── DESCENDING ──
    else if (d.state === ST_DESCENDING) {

      d.descentProgress += delta * 0.7;
      const t = Math.min(d.descentProgress, 1.0);
      const st = _smoothstep(t);

      _updateWingUniforms(d, elapsed, 1.0 - st * 0.85);

      const arcY = Math.sin(st * Math.PI) * 0.08;
      bfly.position.x = d.dStartX + (d.dTargetX - d.dStartX) * st;
      bfly.position.y = d.dStartY + (d.dTargetY - d.dStartY) * st + arcY;
      bfly.position.z = d.dStartZ + (d.dTargetZ - d.dStartZ) * st;

      _tmpLook.set(d.dTargetX, bfly.position.y, d.dTargetZ);
      const ddx = _tmpLook.x - bfly.position.x;
      const ddz = _tmpLook.z - bfly.position.z;
      if (ddx * ddx + ddz * ddz > 0.000001) {
        bfly.lookAt(_tmpLook);
      }
      bfly.rotation.z = 0;
      bfly.rotation.x += (1 - st) * 0.1;

      if (t >= 1.0) {
        d.state = ST_RESTING;
        d.restTimer = d.restDuration;
        bfly.position.set(d.dTargetX, d.dTargetY, d.dTargetZ);
        d.preRestRX = bfly.rotation.x;
      }
    }

    // ── RESTING ──
    else if (d.state === ST_RESTING) {

      d.restTimer -= delta;

      const pulse = Math.sin(elapsed * 0.8 + d.wobblePhase) * 0.5 + 0.5;
      _updateWingUniforms(d, elapsed, pulse * 0.15);

      bfly.rotation.z = Math.sin(elapsed * 1.2 + d.wobblePhase) * 0.03;
      bfly.rotation.x = d.preRestRX + Math.sin(elapsed * 0.7 + d.wobblePhase) * 0.02;

      if (d.restTimer <= 0) {
        d.state = ST_ASCENDING;
        d.dStartX = bfly.position.x;
        d.dStartY = bfly.position.y;
        d.dStartZ = bfly.position.z;
        d.descentProgress = 0;

        const flyH = 0.15 + d.rand() * 0.4;
        const angle = d.rand() * Math.PI * 2;
        const dist = 0.15 + d.rand() * 0.3;
        d.dTargetX = d.dStartX + Math.cos(angle) * dist;
        d.dTargetY = flyH;
        d.dTargetZ = d.dStartZ + Math.sin(angle) * dist;

        const hDist = Math.sqrt(d.dTargetX * d.dTargetX + d.dTargetZ * d.dTargetZ);
        if (hDist > d.fieldRadius * 0.85) {
          const sc = (d.fieldRadius * 0.85) / hDist;
          d.dTargetX *= sc;
          d.dTargetZ *= sc;
        }
      }
    }

    // ── ASCENDING ──
    else if (d.state === ST_ASCENDING) {

      d.descentProgress += delta * 0.6;
      const t = Math.min(d.descentProgress, 1.0);
      const st = _smoothstep(t);

      _updateWingUniforms(d, elapsed, 0.15 + st * 0.85);

      const arcY = Math.sin(st * Math.PI) * 0.12;
      bfly.position.x = d.dStartX + (d.dTargetX - d.dStartX) * st;
      bfly.position.y = d.dStartY + (d.dTargetY - d.dStartY) * st + arcY;
      bfly.position.z = d.dStartZ + (d.dTargetZ - d.dStartZ) * st;

      _tmpLook.set(d.dTargetX, bfly.position.y, d.dTargetZ);
      const ddx = _tmpLook.x - bfly.position.x;
      const ddz = _tmpLook.z - bfly.position.z;
      if (ddx * ddx + ddz * ddz > 0.000001) {
        bfly.lookAt(_tmpLook);
      }
      bfly.rotation.z = 0;

      if (t >= 1.0) {
        d.state = ST_FLYING;
        d.nextRestIn = 4 + d.rand() * 10;
        d.restAccum = 0;

        let bestIdx = 0, bestDist = 1e10;
        const wp = d.waypoints;
        const bx = bfly.position.x, by = bfly.position.y, bz = bfly.position.z;
        for (let w = 0; w < wp.length; w++) {
          const wdx = bx - wp[w].x, wdy = by - wp[w].y, wdz = bz - wp[w].z;
          const dd = wdx * wdx + wdy * wdy + wdz * wdz;
          if (dd < bestDist) { bestDist = dd; bestIdx = w; }
        }
        d.currentWP = bestIdx;
        const nextWP = (bestIdx + 1) % wp.length;
        d.startPos.copy(bfly.position);
        d.endPos.copy(wp[nextWP]);
        d.progress = 0;
        _computeControlPoint(d);
      }
    }
  }
}

/**
 * Remove butterfly animation data.
 */
export function removeButterflies(butterfliesData) {
  if (!butterfliesData) return;
  for (const bd of butterfliesData) {
    const idx = _activeButterflies.indexOf(bd);
    if (idx !== -1) _activeButterflies.splice(idx, 1);
  }
}

// ══════════════════════════════════════════════
// ── EXPORTS ──
// ══════════════════════════════════════════════

export {
  getSharedFlowerCenterGeo,
  computeFlowerCenterMatrix,
  computeFlowerPetalMatrices,
  buildFlowerField,
  flowerCenterMat,
  PETAL_COLORS,
  PETALS_PER_FLOWER,
  FLOWER_RADIUS,
};