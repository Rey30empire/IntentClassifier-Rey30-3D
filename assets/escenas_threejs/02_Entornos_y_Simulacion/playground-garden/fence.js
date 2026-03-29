// ══════════════════════════════════════════════
// FENCE GENERATOR
// ══════════════════════════════════════════════
//
// Dependencies: THREE.js (three/webgpu)
// Creates a fence section: extruded SVG pickets,
// horizontal rails, and nail spheres.
// Uses shared geometry + InstancedMesh for perf.
// ══════════════════════════════════════════════

import * as THREE from "three/webgpu";

// ── Seeded Random ──
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ══════════════════════════════════════════════
// ── PICKET SHAPE (from SVG path) ──
// ══════════════════════════════════════════════
// SVG: 125×348 — rectangle with arched top
// Normalize to unit height (~0.35 wide × 1.0 tall)

let _sharedPicketGeo = null;
const PICKET_SCALE = 1 / 348; // normalize SVG to ~1 unit tall

function buildPicketShape() {
  const s = PICKET_SCALE;
  const shape = new THREE.Shape();

  // Start bottom-left, go clockwise
  shape.moveTo(0.5 * s, 0);                      // bottom-left
  shape.lineTo(124.5 * s, 0);                     // bottom-right
  shape.lineTo(124.5 * s, (348 - 100) * s);       // right side up to arch start (lower for bigger arch)
  // Very rounded arch top using cubic bezier
  shape.bezierCurveTo(
    124.5 * s, (348 + 20) * s,                     // control1: right, above peak
    0.5 * s, (348 + 20) * s,                       // control2: left, above peak
    0.5 * s, (348 - 100) * s                       // end: left side arch start
  );
  shape.lineTo(0.5 * s, 0);                       // back to bottom-left

  return shape;
}

function getSharedPicketGeo() {
  if (!_sharedPicketGeo) {
    const shape = buildPicketShape();
    const extrudeSettings = {
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 3,
      curveSegments: 16,
    };
    _sharedPicketGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Center horizontally and on Z
    _sharedPicketGeo.translate(-62.5 * PICKET_SCALE, 0, -0.09);
  }
  return _sharedPicketGeo;
}

// ══════════════════════════════════════════════
// ── HORIZONTAL RAIL GEOMETRY ──
// ══════════════════════════════════════════════

let _sharedRailGeo = null;
function getSharedRailGeo() {
  if (!_sharedRailGeo) {
    // Extruded rounded-rect for subtle bevel on the rail
    const w = 1, h = 0.09, r = 0.008;
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    _sharedRailGeo = new THREE.ExtrudeGeometry(s, {
      depth: 0.15,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.006,
      bevelSegments: 2,
      curveSegments: 4,
    });
    _sharedRailGeo.translate(0, 0, -0.075);
  }
  return _sharedRailGeo;
}

// ══════════════════════════════════════════════
// ── NAIL GEOMETRY ──
// ══════════════════════════════════════════════

let _sharedNailGeo = null;
function getSharedNailGeo() {
  if (!_sharedNailGeo) {
    _sharedNailGeo = new THREE.SphereGeometry(0.05, 5, 4);
  }
  return _sharedNailGeo;
}

// ══════════════════════════════════════════════
// ── SHARED MATERIALS ──
// ══════════════════════════════════════════════

const _sharedPicketMat = new THREE.MeshStandardNodeMaterial({
  color: new THREE.Color(0xf5f0e8),
  roughness: 0.7,
  metalness: 0.0,
  flatShading: false,
  envMapIntensity: 0.8,
});
_sharedPicketMat._shared = true;

const _sharedRailMat = _sharedPicketMat; // same white material

const _sharedNailMat = new THREE.MeshStandardNodeMaterial({
  color: new THREE.Color(0x1a1a1a),
  roughness: 0.3,
  metalness: 0.6,
  flatShading: false,
  envMapIntensity: 1.0,
});
_sharedNailMat._shared = true;

// ══════════════════════════════════════════════
// ── FENCE CONSTANTS ──
// ══════════════════════════════════════════════

const PICKET_HEIGHT = 348 * PICKET_SCALE;  // ~1.0
const PICKET_WIDTH = 125 * PICKET_SCALE;   // ~0.359
const PICKET_SPACING = 0.04;               // gap between pickets
const RAIL_HEIGHT_MID = PICKET_HEIGHT * 0.42;

// ══════════════════════════════════════════════
// ── CREATE STANDALONE FENCE ──
// ══════════════════════════════════════════════
//
// Options:
//   seed       — random seed (default: 100)
//   pickets    — number of vertical pickets (default: 5)
//   position   — { x, y, z }
//
// Returns a THREE.Group.

export function createStandaloneFence(scene, options = {}) {
  const {
    seed = 100,
    pickets = 5,
    position = { x: 0, y: 0, z: 0 },
    includeRail = true,   // set false when buildFenceLine adds its own continuous rail
  } = options;

  const rand = seededRandom(seed);
  const group = new THREE.Group();
  group.name = "standaloneFence";
  group.position.set(position.x, position.y, position.z);

  const picketGeo = getSharedPicketGeo();
  const railGeo = getSharedRailGeo();
  const nailGeo = getSharedNailGeo();

  const totalWidth = pickets * PICKET_WIDTH + (pickets - 1) * PICKET_SPACING;
  const startX = -totalWidth / 2 + PICKET_WIDTH / 2;

  // ── Pickets: single InstancedMesh ──
  const picketIM = new THREE.InstancedMesh(picketGeo, _sharedPicketMat, pickets);
  picketIM.name = "fencePickets";
  picketIM.castShadow = false;
  picketIM.receiveShadow = true;

  const mat = new THREE.Matrix4();
  const picketPositions = [];

  for (let i = 0; i < pickets; i++) {
    const px = startX + i * (PICKET_WIDTH + PICKET_SPACING);
    // Pattern: short, short, TALL, short, short, TALL ...
    const patIdx = i % 3;
    const heightVar = patIdx === 2 ? 1.15 : 0.95;
    mat.compose(
      new THREE.Vector3(px, 0, 0),
      new THREE.Quaternion(),
      new THREE.Vector3(1, heightVar, 1)
    );
    picketIM.setMatrixAt(i, mat);
    picketPositions.push(px);
  }
  picketIM.instanceMatrix.needsUpdate = true;
  group.add(picketIM);

  // ── Horizontal rail: only when standalone (not part of a fence line) ──
  if (includeRail) {
    const railIM = new THREE.InstancedMesh(railGeo, _sharedRailMat, 1);
    railIM.name = "fenceRails";
    railIM.castShadow = false;
    railIM.receiveShadow = true;

    mat.compose(
      new THREE.Vector3(0, RAIL_HEIGHT_MID, -0.09),
      new THREE.Quaternion(),
      new THREE.Vector3(totalWidth + PICKET_SPACING, 1, 1)
    );
    railIM.setMatrixAt(0, mat);
    railIM.instanceMatrix.needsUpdate = true;
    group.add(railIM);
  }

  // ── Nails: every 2nd picket (on front face at rail height) ──
  const nailCount = Math.ceil(pickets / 2);
  const nailIM = new THREE.InstancedMesh(nailGeo, _sharedNailMat, nailCount);
  nailIM.name = "fenceNails";
  nailIM.castShadow = false;
  nailIM.receiveShadow = false;

  let nailIdx = 0;
  for (let i = 0; i < pickets; i += 2) {
    const px = picketPositions[i];
    mat.compose(
      new THREE.Vector3(px, RAIL_HEIGHT_MID, 0.10),
      new THREE.Quaternion(),
      new THREE.Vector3(1, 1, 1)
    );
    nailIM.setMatrixAt(nailIdx++, mat);
  }
  nailIM.instanceMatrix.needsUpdate = true;
  group.add(nailIM);

  if (scene) scene.add(group);
  return group;
}

// ══════════════════════════════════════════════
// ── BUILD FENCE LINE ──
// ══════════════════════════════════════════════
//
// Creates a longer fence by chaining multiple sections.
// Options:
//   sections   — number of fence sections (default: 3)
//   pickets    — pickets per section (default: 5)
//   seed       — random seed
//
// Returns a THREE.Group.

export function buildFenceLine(options = {}) {
  const {
    sections = 3,
    pickets = 5,
    seed = 100,
    targetWidth = 0,  // if > 0, compute total pickets to fit this width (in world units, pre-scale)
  } = options;

  const group = new THREE.Group();
  group.name = "fenceLine";
  const SCALE_XZ = 0.25;
  const SCALE_Y = 0.25 * 0.75;
  group.scale.set(SCALE_XZ, SCALE_Y, SCALE_XZ);

  // If targetWidth is set, calculate total pickets to match that width
  let totalPickets;
  if (targetWidth > 0) {
    // targetWidth is in world units; pickets are drawn at unscaled size then group is scaled
    const unscaledTarget = targetWidth / SCALE_XZ;
    const picketStep = PICKET_WIDTH + PICKET_SPACING;
    totalPickets = Math.max(3, Math.round(unscaledTarget / picketStep));
  } else {
    totalPickets = sections * pickets;
  }

  // Build as a single section with totalPickets
  const fence = createStandaloneFence(null, {
    seed,
    pickets: totalPickets,
    position: { x: 0, y: 0, z: 0 },
    includeRail: true,
  });
  fence.name = "fenceSection_0";
  group.add(fence);

  return group;
}

// ══════════════════════════════════════════════
// ── EXPORTS ──
// ══════════════════════════════════════════════

export {
  PICKET_HEIGHT,
  PICKET_WIDTH,
  PICKET_SPACING,
};