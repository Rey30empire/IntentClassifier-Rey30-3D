// ══════════════════════════════════════════════
// TREE GENERATOR — Extracted from island scene
// ══════════════════════════════════════════════
//
// Dependencies: THREE.js (three/webgpu)
// Usage: Call createStandaloneTree(scene, options) to place a tree
//
// This file contains:
//  - Petal geometry builder (shared leaf shape)
//  - Trunk geometry (shared sphere)
//  - Tree leaf matrix computation (4 rings, 22 leaves)
//  - Materials (leaf dark/light, trunk)
//  - Standalone tree builder that creates a complete tree group
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
// ── PETAL GEOMETRY ──
// ══════════════════════════════════════════════

// Builds petal geometry: sphere → squash width → flatten Y → shift origin to center-left
// Smooth, rounded petal shape with origin at the base (left edge center)
function buildPetalGeo(widthSegs, heightSegs) {
  const sphere = new THREE.SphereGeometry(1, widthSegs, heightSegs);
  const pos = sphere.attributes.position;
  const count = pos.count;

  for (let i = 0; i < count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // 1) Squash width (X axis) to make it elongated like a petal
    x *= 0.55;
    // 2) Flatten vertically (Y axis) to make it thin/flat
    y *= 0.32;
    // 3) Shift origin to center-left: petal extends in -Z direction
    z -= 1.0;
    // 4) Slight upward curl toward the tip for organic feel
    const t = Math.abs(z) / 2.0;
    y += Math.sin(t * Math.PI) * 0.08;
    // 5) Subtle cupping: edges lift slightly
    const edgeness = Math.abs(x) / 0.45;
    y += edgeness * edgeness * 0.06;

    pos.setXYZ(i, x, y, z);
  }

  pos.needsUpdate = true;
  sphere.computeVertexNormals();
  return sphere;
}

// Shared petal geometry (created once, reused)
let _sharedPetalGeo = null;
function getSharedPetalGeo() {
  if (!_sharedPetalGeo) _sharedPetalGeo = buildPetalGeo(6, 4);
  return _sharedPetalGeo;
}

// ══════════════════════════════════════════════
// ── TRUNK GEOMETRY ──
// ══════════════════════════════════════════════

let _sharedTrunkGeo = null;
function getSharedTrunkGeo() {
  if (!_sharedTrunkGeo) {
    _sharedTrunkGeo = new THREE.SphereGeometry(1, 5, 4);
  }
  return _sharedTrunkGeo;
}



// ══════════════════════════════════════════════
// ── MATERIALS ──
// ══════════════════════════════════════════════

// Shared leaf material (per-instance vertex colors provide the tint)
const _sharedTreeLeafMat = new THREE.MeshStandardNodeMaterial({
  roughness: 0.6,
  metalness: 0.02,
  side: THREE.DoubleSide,
  flatShading: false,
  envMapIntensity: 1.0,
});
_sharedTreeLeafMat.vertexColors = true;
_sharedTreeLeafMat._shared = true;

// Default base colors (used for standalone trees outside a grove)
const treeDarkMat = _sharedTreeLeafMat;
const treeLightMat = _sharedTreeLeafMat;

// Shared tree trunk material (pooled across all trees)
const _sharedTreeTrunkMat = new THREE.MeshStandardNodeMaterial({
  color: new THREE.Color(0x8b5e4b),
  roughness: 0.85,
  metalness: 0.02,
  flatShading: false,
  envMapIntensity: 1.0,
});
_sharedTreeTrunkMat._shared = true;
const treeTrunkMat = _sharedTreeTrunkMat;

// Darker trunk material for sapin trees
const _sapinTrunkMat = new THREE.MeshStandardNodeMaterial({
  color: new THREE.Color(0x5a3a2a),
  roughness: 0.9,
  metalness: 0.02,
  flatShading: false,
  envMapIntensity: 1.0,
});
_sapinTrunkMat._shared = true;



// ══════════════════════════════════════════════
// ── TREE LEAF MATRIX COMPUTATION ──
// ══════════════════════════════════════════════

// 3 rings: 6+5+4 = 15 leaves per tree (reduced from 22 — minimal visual impact)
const LEAVES_PER_TREE = 15;
const TRUNK_PARTS_PER_TREE = 4; // 1 main sphere + 3 root spheres

// ── Matrix cache keyed by rounded radius ──
const _leafMatrixCache = new Map();

function computeTreeLeafMatrices(radius) {
  const key = Math.round(radius * 1000);
  if (_leafMatrixCache.has(key)) return _leafMatrixCache.get(key);

  const matrices = [];
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const tmpMat = new THREE.Matrix4();

  const rings = [
    // Ring 1 (outermost): wide, drooping leaves — slightly larger to compensate fewer leaves
    { count: 6, tilt: Math.PI * 0.32, offset: 0, lenMul: 0.78, wMul: 0.6, y: 0.0 },
    // Ring 2
    { count: 5, tilt: Math.PI * 0.2, offset: Math.PI / 6, lenMul: 0.58, wMul: 0.5, y: 0.035 },
    // Ring 3 (topmost): small upright leaves
    { count: 4, tilt: Math.PI * 0.08, offset: Math.PI / 4, lenMul: 0.42, wMul: 0.4, y: 0.08 },
  ];

  for (const ring of rings) {
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
  _leafMatrixCache.set(key, matrices);
  return matrices;
}

// ══════════════════════════════════════════════
// ── STANDALONE TREE BUILDER ──
// ══════════════════════════════════════════════
//
// Creates a single tree as a THREE.Group with InstancedMeshes.
// Options:
//   seed     — random seed (default: 12345)
//   radius   — tree canopy radius (default: 0.35)
//   position — { x, y, z } base position (default: 0,0,0)
//
// Returns the THREE.Group (already added to the scene if `scene` is provided).

export function createStandaloneTree(scene, options = {}) {
  const {
    seed = 12345,
    radius: treeRadius = 0.35,
    position = { x: 0, y: 0, z: 0 },
  } = options;

  const rand = seededRandom(seed);
  const group = new THREE.Group();
  group.name = "standaloneTree";
  group.position.set(position.x, position.y, position.z);

  const petalGeo = getSharedPetalGeo();
  const trunkGeo = getSharedTrunkGeo();

  // ── Trunk: 1 main sphere + 3 root spheres ──
  const trunkIM = new THREE.InstancedMesh(trunkGeo, _sharedTreeTrunkMat, TRUNK_PARTS_PER_TREE);
  trunkIM.name = "treeTrunk";
  trunkIM.castShadow = true;
  trunkIM.receiveShadow = true;

  const mat = new THREE.Matrix4();
  const yRot = rand() * Math.PI * 2;
  const mainSphereRadius = treeRadius * 0.5;
  const rootSphereRadius = treeRadius * 0.3;
  const trunkHeight = treeRadius * 1.4;

  // Main trunk sphere (slightly taller)
  mat.compose(
    new THREE.Vector3(0, mainSphereRadius * 0.5, 0),
    new THREE.Quaternion(),
    new THREE.Vector3(mainSphereRadius, mainSphereRadius * 1.2, mainSphereRadius)
  );
  trunkIM.setMatrixAt(0, mat);

  // 3 root spheres
  for (let r = 0; r < 3; r++) {
    const rootAngle = yRot + (r / 3) * Math.PI * 2 + rand();
    const rootDist = mainSphereRadius * 0.75;
    const rx = Math.cos(rootAngle) * rootDist;
    const rz = Math.sin(rootAngle) * rootDist;
    const rootY = rootSphereRadius * 0.3;

    const outDirX = Math.cos(rootAngle);
    const outDirZ = Math.sin(rootAngle);
    const rootQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(-outDirZ, 0, outDirX).normalize(),
      0.3 + rand() * 0.2
    );
    rootQuat.premultiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rootAngle)
    );

    mat.compose(
      new THREE.Vector3(rx, rootY, rz),
      rootQuat,
      new THREE.Vector3(rootSphereRadius * 1.3, rootSphereRadius * 0.5, rootSphereRadius * 0.9)
    );
    trunkIM.setMatrixAt(1 + r, mat);
  }
  trunkIM.instanceMatrix.needsUpdate = true;
  group.add(trunkIM);

  // ── Canopy: 15 leaves in a single InstancedMesh with per-instance color ──
  const useDark = rand() > 0.5;
  const leafMatrices = computeTreeLeafMatrices(treeRadius);
  const baseLeafColor = useDark ? new THREE.Color(0x4a8e1e) : new THREE.Color(0x7cc93e);

  const leafIM = new THREE.InstancedMesh(petalGeo, _sharedTreeLeafMat, LEAVES_PER_TREE);
  leafIM.name = "treeLeaves";
  leafIM.castShadow = true;
  leafIM.receiveShadow = true;
  leafIM.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(LEAVES_PER_TREE * 3), 3
  );

  const canopyY = trunkHeight;
  const maxDroop = Math.sin(Math.PI * 0.32) * 0.6 * treeRadius;

  const canopyMat = new THREE.Matrix4();
  canopyMat.makeRotationY(yRot);
  canopyMat.setPosition(0, canopyY + maxDroop * 0.5, 0);

  const tmpMat = new THREE.Matrix4();

  // Store base matrices for wind animation
  const baseLeafMatricesWorld = [];
  for (let m = 0; m < leafMatrices.length; m++) {
    tmpMat.multiplyMatrices(canopyMat, leafMatrices[m]);
    leafIM.setMatrixAt(m, tmpMat);
    leafIM.setColorAt(m, baseLeafColor);
    baseLeafMatricesWorld.push(tmpMat.clone());
  }
  leafIM.instanceMatrix.needsUpdate = true;
  leafIM.instanceColor.needsUpdate = true;
  group.add(leafIM);

  // ── Store wind animation data on group for leaf rustling ──
  group.userData.leafWind = {
    leafIM,
    baseMatrices: baseLeafMatricesWorld,
    phaseOffset: yRot * 3.7, // unique per tree based on rotation
    leafCount: LEAVES_PER_TREE,
  };

  if (scene) scene.add(group);
  return group;
}

// ══════════════════════════════════════════════
// ── BUILD TREE GROVE ──
// ══════════════════════════════════════════════
//
// Creates a group of trees scattered on a circular ground area.
// Each tree gets a slightly different green hue for variety.
//
// Options:
//   count       — number of trees (default: 5)
//   fieldRadius — scatter radius (default: 1.0)
//   treeRadius  — canopy size (default: 0.35)
//   seed        — random seed (default: 777)
//
// Returns a THREE.Group containing all trees.

export function buildTreeGrove(options = {}) {
  const {
    count = 5,
    fieldRadius = 1.0,
    treeRadius = 0.35,
    seed = 777,
  } = options;

  const rand = seededRandom(seed);
  const group = new THREE.Group();
  group.name = "treeGrove";

  // Collect valid positions using rejection sampling (no overlap)
  // Minimum distance between any two trees = treeRadius * 2
  const MIN_TREE_DIST = treeRadius * 2;
  const placed = []; // { x, z }

  for (let i = 0; i < count; i++) {
    const sizeVariation = 0.8 + rand() * 0.5;
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
        if (dx * dx + dz * dz < MIN_TREE_DIST * MIN_TREE_DIST) {
          valid = false;
          break;
        }
      }
      attempts++;
    } while (!valid && attempts < 200);

    placed.push({ x: px, z: pz });

    const treeSeed = Math.floor(rand() * 999999);
    const useSapin = rand() < 0.4; // ~40% chance of sapin variety

    let tree;
    if (useSapin) {
      tree = createSapinTree(null, {
        seed: treeSeed,
        radius: treeRadius * sizeVariation,
        position: { x: px, y: 0, z: pz },
      });
      tree.name = `groveSapin_${i}`;
      tree.scale.setScalar(1.2);
    } else {
      tree = createStandaloneTree(null, {
        seed: treeSeed,
        radius: treeRadius * sizeVariation,
        position: { x: px, y: 0, z: pz },
      });
      tree.name = `groveTree_${i}`;

      // ── Tint leaves with a unique green per tree ──
      const hueShift = (rand() - 0.5) * 0.06; // ±0.06 hue offset
      const satShift = (rand() - 0.5) * 0.15;

      const darkBase = new THREE.Color(0x4a8e1e);
      const lightBase = new THREE.Color(0x7cc93e);

      const darkHSL = { h: 0, s: 0, l: 0 };
      const lightHSL = { h: 0, s: 0, l: 0 };
      darkBase.getHSL(darkHSL);
      lightBase.getHSL(lightHSL);

      const tintedDark = new THREE.Color().setHSL(
        darkHSL.h + hueShift,
        Math.min(1, Math.max(0, darkHSL.s + satShift)),
        darkHSL.l + (rand() - 0.5) * 0.06
      );
      const tintedLight = new THREE.Color().setHSL(
        lightHSL.h + hueShift,
        Math.min(1, Math.max(0, lightHSL.s + satShift)),
        lightHSL.l + (rand() - 0.5) * 0.06
      );

      // Tint per-instance colors on the single leaf InstancedMesh
      tree.traverse((child) => {
        if (child.name === "treeLeaves" && child.instanceColor) {
          const probe = new THREE.Color();
          child.getColorAt(0, probe);
          const probeHSL = { h: 0, s: 0, l: 0 };
          probe.getHSL(probeHSL);
          const tint = probeHSL.l < 0.4 ? tintedDark : tintedLight;
          for (let li = 0; li < child.count; li++) {
            child.setColorAt(li, tint);
          }
          child.instanceColor.needsUpdate = true;
        }
      });
    }

    group.add(tree);
  }

  return group;
}

// ══════════════════════════════════════════════
// ── SAPIN (STYLIZED PINE/FIR TREE) ──
// ══════════════════════════════════════════════
//
// Creates a cute stylized pine tree inspired by the reference:
// - 3 stacked cone tiers with smooth rounded edges
// - 4 puffy spheres at the base of each tier
// - Same trunk as the standard tree
//
// The cones use a smoothed ConeGeometry (high segment count).
// Each tier is slightly wider and shorter as it goes down.
// ══════════════════════════════════════════════

// ── Shared sapin foliage material ──
const _sapinFoliageMat = new THREE.MeshStandardNodeMaterial({
  color: new THREE.Color(0x6fbf3b),
  roughness: 0.65,
  metalness: 0.0,
  vertexColors: true,
});
_sapinFoliageMat._shared = true;

// ── Smooth sapin cone geometry builder ──
// Normalized unit cone (radius=1, height=1) — scaled per-instance via matrix
let _sapinUnitConeGeo = null;
function getSapinUnitConeGeo() {
  if (_sapinUnitConeGeo) return _sapinUnitConeGeo;
  // 32 horizontal segments for smooth silhouette, 14 vertical for good shading
  const wSeg = 32, hSeg = 14;
  const geo = new THREE.SphereGeometry(1, wSeg, hSeg);
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const count = pos.count;

  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const t = (y + 1) * 0.5; // 0 = bottom, 1 = top
    const taper = 1.0 - Math.pow(t, 0.8);
    const bulge = Math.pow(Math.sin(t * Math.PI), 0.3);
    const radiusScale = taper * bulge;

    const hDist = Math.sqrt(x * x + z * z);
    if (hDist > 0.001) {
      x = (x / hDist) * radiusScale;
      z = (z / hDist) * radiusScale;
    }

    y = t - 0.5; // unit height [-0.5, 0.5]

    pos.setXYZ(i, x, y, z);

    const grad = t * t;
    const brightness = 0.55 + 0.45 * grad;
    colors[i * 3]     = brightness;
    colors[i * 3 + 1] = brightness;
    colors[i * 3 + 2] = brightness;
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // Fix the seam: sphere geometry duplicates vertices along the UV seam.
  // Smooth normals at matching positions so there's no hard edge.
  const EPS = 0.0001;
  for (let i = 0; i < count; i++) {
    const ix = pos.getX(i), iy = pos.getY(i), iz = pos.getZ(i);
    let nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
    let shared = 1;
    for (let j = i + 1; j < count; j++) {
      if (Math.abs(pos.getX(j) - ix) < EPS &&
          Math.abs(pos.getY(j) - iy) < EPS &&
          Math.abs(pos.getZ(j) - iz) < EPS) {
        nx += nrm.getX(j); ny += nrm.getY(j); nz += nrm.getZ(j);
        shared++;
      }
    }
    if (shared > 1) {
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len; ny /= len; nz /= len;
      for (let j = i; j < count; j++) {
        if (Math.abs(pos.getX(j) - ix) < EPS &&
            Math.abs(pos.getY(j) - iy) < EPS &&
            Math.abs(pos.getZ(j) - iz) < EPS) {
          nrm.setXYZ(j, nx, ny, nz);
        }
      }
    }
  }
  nrm.needsUpdate = true;

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  _sapinUnitConeGeo = geo;
  return geo;
}

export function createSapinTree(scene, options = {}) {
  const {
    seed = 12345,
    radius: treeRadius = 0.35,
    position = { x: 0, y: 0, z: 0 },
    bend = null, // { amount: 0-1, angle: radians } or null for random
  } = options;

  const rand = seededRandom(seed);
  const group = new THREE.Group();
  group.name = "sapinTree";
  group.position.set(position.x, position.y, position.z);

  const scale = treeRadius / 0.35; // normalize to default

  // ── Bend parameters ──
  // All sapins get a gentle bend for organic feel
  const doBend = bend !== null ? bend.amount > 0 : true;
  const bendAmount = bend !== null ? Math.min(bend.amount, 0.4) : (doBend ? 0.15 + rand() * 0.15 : 0); // 0.15–0.30 radians (~9–17°)
  const bendAngle = bend !== null ? bend.angle : rand() * Math.PI * 2; // random direction
  const bendDirX = Math.cos(bendAngle);
  const bendDirZ = Math.sin(bendAngle);

  // ── Trunk (darker for sapin) ──
  const trunkGeo = getSharedTrunkGeo();
  const trunkIM = new THREE.InstancedMesh(trunkGeo, _sapinTrunkMat, TRUNK_PARTS_PER_TREE);
  trunkIM.name = "sapinTrunk";
  trunkIM.castShadow = true;
  trunkIM.receiveShadow = true;

  const mat = new THREE.Matrix4();
  const yRot = rand() * Math.PI * 2;
  const mainSphereRadius = treeRadius * 0.28;
  const rootSphereRadius = treeRadius * 0.18;
  const trunkStretch = 2.2; // taller trunk for sapin

  // Main trunk sphere (stretched vertically, thin) — tilted to start the bend arc
  const trunkTiltAxis = new THREE.Vector3(-bendDirZ, 0, bendDirX).normalize();
  // Trunk tilt = lean matching the bend direction
  const trunkTiltAngle = bendAmount * 0.35;
  const trunkQuat = new THREE.Quaternion().setFromAxisAngle(trunkTiltAxis, trunkTiltAngle);
  // Offset trunk slightly in the bend direction to start the arc
  const trunkArcOffset = bendAmount * mainSphereRadius * 0.3;
  mat.compose(
    new THREE.Vector3(
      bendDirX * trunkArcOffset,
      mainSphereRadius * 0.5 * trunkStretch,
      bendDirZ * trunkArcOffset
    ),
    trunkQuat,
    new THREE.Vector3(mainSphereRadius * 0.6, mainSphereRadius * trunkStretch, mainSphereRadius * 0.6)
  );
  trunkIM.setMatrixAt(0, mat);

  // 3 root bumps
  for (let r = 0; r < 3; r++) {
    const rootAngle = yRot + (r / 3) * Math.PI * 2 + rand() * 0.5;
    const rootDist = mainSphereRadius * 0.55;
    const rx = Math.cos(rootAngle) * rootDist;
    const rz = Math.sin(rootAngle) * rootDist;

    const outDirX = Math.cos(rootAngle);
    const outDirZ = Math.sin(rootAngle);
    const rootQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(-outDirZ, 0, outDirX).normalize(),
      0.3 + rand() * 0.2
    );
    rootQuat.premultiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rootAngle)
    );

    mat.compose(
      new THREE.Vector3(rx, rootSphereRadius * 0.2, rz),
      rootQuat,
      new THREE.Vector3(rootSphereRadius * 0.8, rootSphereRadius * 0.4, rootSphereRadius * 0.6)
    );
    trunkIM.setMatrixAt(1 + r, mat);
  }
  trunkIM.instanceMatrix.needsUpdate = true;
  group.add(trunkIM);

  // ── Foliage: 3 stacked cone tiers via single InstancedMesh ──
  const trunkCenterY = mainSphereRadius * 0.5 * trunkStretch;
  const trunkScaleY = mainSphereRadius * trunkStretch;
  const trunkVisualTop = trunkCenterY + trunkScaleY;
  const trunkTop = trunkVisualTop - trunkScaleY * 0.6;

  const tierData = [
    { coneR: 0.42 * scale, coneH: 0.48 * scale },
    { coneR: 0.32 * scale, coneH: 0.42 * scale },
    { coneR: 0.22 * scale, coneH: 0.36 * scale },
  ];

  const overlap = 0.55;
  const tiers = [];
  let currentBase = trunkTop;
  for (let i = 0; i < tierData.length; i++) {
    const td = tierData[i];
    const centerY = currentBase + td.coneH * 0.5;
    tiers.push({ coneR: td.coneR, coneH: td.coneH, y: centerY });
    currentBase = currentBase + td.coneH * (1 - overlap);
  }

  // Foliage color with variation per tier — bottom darker/warmer, top lighter/cooler
  const hueShift = (rand() - 0.5) * 0.04;
  const satShift = (rand() - 0.5) * 0.1;
  const baseHSL = { h: 0, s: 0, l: 0 };
  new THREE.Color(0x6fbf3b).getHSL(baseHSL);

  // 3 tier colors: bottom = dark warm green, middle = base, top = bright cool green
  const tierColors = [
    new THREE.Color().setHSL(
      baseHSL.h + hueShift + 0.03,  // slightly warmer (yellowish)
      Math.min(1, Math.max(0, baseHSL.s + satShift - 0.05)),
      baseHSL.l - 0.08 + (rand() - 0.5) * 0.04  // darker
    ),
    new THREE.Color().setHSL(
      baseHSL.h + hueShift,
      Math.min(1, Math.max(0, baseHSL.s + satShift)),
      baseHSL.l + (rand() - 0.5) * 0.04
    ),
    new THREE.Color().setHSL(
      baseHSL.h + hueShift - 0.02,  // slightly cooler
      Math.min(1, Math.max(0, baseHSL.s + satShift + 0.06)),
      baseHSL.l + 0.07 + (rand() - 0.5) * 0.04  // brighter
    ),
  ];

  // Single InstancedMesh for all 3 cone tiers — unit geometry scaled per instance
  const unitCone = getSapinUnitConeGeo();
  const coneIM = new THREE.InstancedMesh(unitCone, _sapinFoliageMat, 3);
  coneIM.name = "sapinCones";
  coneIM.castShadow = true;
  coneIM.receiveShadow = true;
  coneIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(9), 3);

  // Bend spine computation — using quadratic displacement for visible, smooth curves
  const foliageBaseY = tiers[0].y - tiers[0].coneH * 0.5;
  const foliageTopY = tiers[tiers.length - 1].y + tiers[tiers.length - 1].coneH * 0.5;
  const totalSpineH = foliageTopY - foliageBaseY;
  // Max horizontal displacement at the tip = bendAmount * totalSpineH (proportional to tree height)
  const maxDisplace = bendAmount * totalSpineH * 0.5;
  const tiltAxis = new THREE.Vector3(-bendDirZ, 0, bendDirX).normalize();

  const tierMat = new THREE.Matrix4();
  const tierPos = new THREE.Vector3();
  const tierQuat = new THREE.Quaternion();
  const tierScale = new THREE.Vector3();

  for (let ti = 0; ti < tiers.length; ti++) {
    const tier = tiers[ti];

    // Scale from unit cone to actual tier dimensions
    tierScale.set(tier.coneR, tier.coneH, tier.coneR);

    if (bendAmount > 0.001) {
      // t = 0 at base, 1 at top
      const spineD = tier.y - foliageBaseY;
      const t = spineD / totalSpineH;
      // Quadratic curve: displacement grows quadratically with height
      const hOffset = maxDisplace * t * t;
      // Y stays close to original — slight dip from the bend
      const vPos = tier.y - hOffset * bendAmount * 0.1;
      tierPos.set(bendDirX * hOffset, vPos, bendDirZ * hOffset);
      // Tilt each tier to follow the curve tangent: d(t²)/dt = 2t
      const tangentAngle = Math.atan2(maxDisplace * 2 * t, totalSpineH);
      tierQuat.setFromAxisAngle(tiltAxis, -tangentAngle);
    } else {
      tierPos.set(0, tier.y, 0);
      tierQuat.identity();
    }

    tierMat.compose(tierPos, tierQuat, tierScale);
    coneIM.setMatrixAt(ti, tierMat);
    coneIM.setColorAt(ti, tierColors[ti]);
  }
  coneIM.instanceMatrix.needsUpdate = true;
  coneIM.instanceColor.needsUpdate = true;
  group.add(coneIM);

  // ── Store wind animation data on group for external animate() calls ──
  group.userData.sapinWind = {
    coneIM,
    tiers,
    foliageBaseY,
    totalSpineH,
    baseBendAmount: bendAmount,
    bendAngle,
    bendDirX,
    bendDirZ,
    // Each sapin gets a unique phase offset so they don't all sway in sync
    phaseOffset: rand() * Math.PI * 2,
    // Wind strength (subtle)
    windStrength: 0.06 + rand() * 0.04,
  };

  if (scene) scene.add(group);
  return group;
}

// ══════════════════════════════════════════════
// ── SAPIN WIND ANIMATION ──
// ══════════════════════════════════════════════
//
// Call this every frame from the main animation loop.
// It gently oscillates each sapin's bend amount with eased sine,
// creating a subtle wind sway effect.
//
// Usage: animateSapinWind(elapsed) where elapsed is total seconds.

const _windTierMat = new THREE.Matrix4();
const _windTierPos = new THREE.Vector3();
const _windTierQuat = new THREE.Quaternion();
const _windTierScale = new THREE.Vector3();
const _windTiltAxis = new THREE.Vector3();

export function animateSapinWind(scene, elapsed) {
  scene.traverse((obj) => {
    const wd = obj.userData.sapinWind;
    if (!wd) return;

    const { coneIM, tiers, foliageBaseY, totalSpineH, baseBendAmount, bendDirX, bendDirZ, phaseOffset, windStrength } = wd;

    // Eased sine oscillation — smooth in/out with slight asymmetry for organic feel
    const t1 = Math.sin(elapsed * 1.2 + phaseOffset);
    const t2 = Math.sin(elapsed * 0.7 + phaseOffset * 1.3) * 0.3;
    const easedWind = t1 * t1 * Math.sign(t1) * 0.7 + t2; // cubic ease gives softer peaks
    // Clamp total bend to prevent extreme angles
    const currentBend = Math.max(0, Math.min(0.45, baseBendAmount + easedWind * windStrength));

    // Quadratic bend — same math as initial placement
    const maxDisplace = currentBend * totalSpineH * 0.5;
    _windTiltAxis.set(-bendDirZ, 0, bendDirX).normalize();

    for (let ti = 0; ti < tiers.length; ti++) {
      const tier = tiers[ti];
      _windTierScale.set(tier.coneR, tier.coneH, tier.coneR);

      if (currentBend > 0.001) {
        const spineD = tier.y - foliageBaseY;
        const spineT = spineD / totalSpineH;
        // Quadratic displacement
        const hOffset = maxDisplace * spineT * spineT;
        const vPos = tier.y - hOffset * currentBend * 0.1;
        _windTierPos.set(bendDirX * hOffset, vPos, bendDirZ * hOffset);
        // Tangent-based tilt
        const tangentAngle = Math.atan2(maxDisplace * 2 * spineT, totalSpineH);
        _windTierQuat.setFromAxisAngle(_windTiltAxis, -tangentAngle);
      } else {
        _windTierPos.set(0, tier.y, 0);
        _windTierQuat.identity();
      }

      _windTierMat.compose(_windTierPos, _windTierQuat, _windTierScale);
      coneIM.setMatrixAt(ti, _windTierMat);
    }
    coneIM.instanceMatrix.needsUpdate = true;
  });
}


// ══════════════════════════════════════════════
// ── LEAF WIND ANIMATION ──
// ══════════════════════════════════════════════
//
// Call every frame from the main animation loop.
// Gently oscillates each leaf on standard (non-sapin) trees,
// simulating a rustling wind effect via per-leaf rotation offsets.
//
// Usage: animateLeafWind(scene, elapsed)

const _leafWindMat = new THREE.Matrix4();
const _leafWindPos = new THREE.Vector3();
const _leafWindQuat = new THREE.Quaternion();
const _leafBasePos = new THREE.Vector3();
const _leafBaseQuat = new THREE.Quaternion();
const _leafBaseScale = new THREE.Vector3();
const _leafExtraQuat = new THREE.Quaternion();
const _leafEuler = new THREE.Euler();

export function animateLeafWind(scene, elapsed) {
  scene.traverse((obj) => {
    const lw = obj.userData.leafWind;
    if (!lw) return;

    const { leafIM, baseMatrices, phaseOffset, leafCount } = lw;

    for (let i = 0; i < leafCount; i++) {
      // Decompose the original base matrix
      baseMatrices[i].decompose(_leafBasePos, _leafBaseQuat, _leafBaseScale);

      // Per-leaf unique phase based on index
      const leafPhase = phaseOffset + i * 1.47;

      // Multi-frequency sine for organic feel (gentle)
      const wave1 = Math.sin(elapsed * 1.8 + leafPhase) * 0.018;
      const wave2 = Math.sin(elapsed * 2.9 + leafPhase * 0.7) * 0.009;
      const wave3 = Math.sin(elapsed * 0.6 + leafPhase * 1.5) * 0.012;
      const totalSway = wave1 + wave2 + wave3;

      // Apply a small rotation around X (pitch) and Y (yaw) to simulate rustling
      _leafEuler.set(totalSway, totalSway * 0.4, 0);
      _leafExtraQuat.setFromEuler(_leafEuler);
      _leafWindQuat.copy(_leafBaseQuat).multiply(_leafExtraQuat);

      // Slight position wobble (very subtle vertical bob)
      _leafWindPos.copy(_leafBasePos);
      _leafWindPos.y += totalSway * 0.005;

      _leafWindMat.compose(_leafWindPos, _leafWindQuat, _leafBaseScale);
      leafIM.setMatrixAt(i, _leafWindMat);
    }
    leafIM.instanceMatrix.needsUpdate = true;
  });
}


// ══════════════════════════════════════════════
// ── EXPORTS ──
// ══════════════════════════════════════════════

export {
  // Geometry builders
  buildPetalGeo,
  getSharedPetalGeo,
  getSharedTrunkGeo,

  // Matrix computers
  computeTreeLeafMatrices,

  // Materials
  treeDarkMat,
  treeLightMat,
  treeTrunkMat,

  // Constants
  LEAVES_PER_TREE,
  TRUNK_PARTS_PER_TREE,

  // Utility
  seededRandom,
};