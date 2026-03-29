// ══════════════════════════════════════════════
// GARDEN GENERATOR
// ══════════════════════════════════════════════
//
// Dependencies: THREE.js (three/webgpu)
// Creates a garden bed: rounded-rectangle ground plane
// filled with instanced squashed spheres as herbs,
// using Poisson disk sampling and a green + accent palette.
// ══════════════════════════════════════════════

import * as THREE from "three/webgpu";

// ══════════════════════════════════════════════
// ── SEEDED RANDOM ──
// ══════════════════════════════════════════════

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ══════════════════════════════════════════════
// ── ROUNDED RECTANGLE SHAPE ──
// ══════════════════════════════════════════════

function createRoundedRectShape(width, depth, radius) {
  const shape = new THREE.Shape();
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.min(radius, hw, hd);

  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  return shape;
}

// ══════════════════════════════════════════════
// ── POISSON DISK SAMPLING (2D rectangle) ──
// ══════════════════════════════════════════════

function poissonDiskSampling(width, depth, minDist, rand, maxAttempts = 30) {
  const hw = width / 2;
  const hd = depth / 2;
  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.ceil(width / cellSize);
  const gridH = Math.ceil(depth / cellSize);
  const grid = new Array(gridW * gridH).fill(-1);
  const points = [];
  const active = [];

  function gridIdx(x, z) {
    const gx = Math.floor((x + hw) / cellSize);
    const gz = Math.floor((z + hd) / cellSize);
    if (gx < 0 || gx >= gridW || gz < 0 || gz >= gridH) return -1;
    return gz * gridW + gx;
  }

  // Seed point at center
  const p0 = { x: 0, z: 0 };
  points.push(p0);
  active.push(0);
  const idx0 = gridIdx(0, 0);
  if (idx0 >= 0) grid[idx0] = 0;

  while (active.length > 0) {
    const ai = Math.floor(rand() * active.length);
    const pi = active[ai];
    const point = points[pi];
    let found = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angle = rand() * Math.PI * 2;
      const dist = minDist + rand() * minDist;
      const nx = point.x + Math.cos(angle) * dist;
      const nz = point.z + Math.sin(angle) * dist;

      // Check bounds
      if (nx < -hw || nx > hw || nz < -hd || nz > hd) continue;

      // Check grid neighbors
      const gx = Math.floor((nx + hw) / cellSize);
      const gz = Math.floor((nz + hd) / cellSize);
      let tooClose = false;

      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const cx = gx + dx;
          const cz = gz + dy;
          if (cx < 0 || cx >= gridW || cz < 0 || cz >= gridH) continue;
          const ci = cz * gridW + cx;
          if (grid[ci] === -1) continue;
          const other = points[grid[ci]];
          const ddx = nx - other.x;
          const ddz = nz - other.z;
          if (ddx * ddx + ddz * ddz < minDist * minDist) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) break;
      }

      if (!tooClose) {
        const newIdx = points.length;
        points.push({ x: nx, z: nz });
        active.push(newIdx);
        const gi = gridIdx(nx, nz);
        if (gi >= 0) grid[gi] = newIdx;
        found = true;
        break;
      }
    }

    if (!found) {
      active.splice(ai, 1);
    }
  }

  return points;
}

// ══════════════════════════════════════════════
// ── CHECK IF POINT IS INSIDE ROUNDED RECT ──
// ══════════════════════════════════════════════

function isInsideRoundedRect(x, z, hw, hd, r) {
  const ax = Math.abs(x);
  const az = Math.abs(z);

  // Inside the inner cross — no corner check needed
  if (ax <= hw - r && az <= hd) return true;
  if (az <= hd - r && ax <= hw) return true;

  // Corner region — check distance to corner circle center
  if (ax > hw - r && az > hd - r) {
    const cx = hw - r;
    const cz = hd - r;
    const dx = ax - cx;
    const dz = az - cz;
    return (dx * dx + dz * dz) <= r * r;
  }

  return false;
}

// ══════════════════════════════════════════════
// ── HERB COLOR PALETTE ──
// ══════════════════════════════════════════════

const HERB_COLORS = [
  // Greens (80% of herbs)
  new THREE.Color(0x3d7a14), // dark forest
  new THREE.Color(0x4a8e1e), // standard green
  new THREE.Color(0x5a9e2a), // mid green
  new THREE.Color(0x6db535), // fresh green
  new THREE.Color(0x7cc93e), // bright lime
  new THREE.Color(0x8fd44a), // light lime
  // Accents (20% of herbs)
  new THREE.Color(0xf2899e), // soft pink
  new THREE.Color(0xe85d8a), // rose pink
  new THREE.Color(0xf5e042), // yellow
  new THREE.Color(0xf0c830), // golden yellow
  new THREE.Color(0xd94f7a), // magenta-pink
  new THREE.Color(0xeaa8c0), // pale pink
];

const GREEN_COUNT = 6;
const ACCENT_START = 6;

// ══════════════════════════════════════════════
// ── BERRY COLOR PALETTE ──
// ══════════════════════════════════════════════

const BERRY_COLORS = [
  // Greens – leaves / stems (60%)
  new THREE.Color(0x3d7a14), // dark forest
  new THREE.Color(0x4a8e1e), // standard green
  new THREE.Color(0x5a9e2a), // mid green
  new THREE.Color(0x2e6b10), // deep green
  // Berries – pink / red / purple (40%)
  new THREE.Color(0xd94f7a), // magenta-pink
  new THREE.Color(0xc62828), // deep red
  new THREE.Color(0xe85d8a), // rose pink
  new THREE.Color(0x8e24aa), // purple
  new THREE.Color(0xad1457), // dark pink
  new THREE.Color(0x7b1fa2), // deep purple
  new THREE.Color(0xd81b60), // hot pink
  new THREE.Color(0xba3a5e), // cranberry
];

const BERRY_GREEN_COUNT = 4;
const BERRY_ACCENT_START = 4;

// ══════════════════════════════════════════════
// ── GARDEN BED DIMENSIONS ──
// ══════════════════════════════════════════════

const BED_WIDTH = 0.45;
const BED_DEPTH = 1.0;
const BED_CORNER_RADIUS = 0.1;
const BED_HEIGHT = 0.015;
const HERB_MIN_DIST = 0.024;
const HERB_BASE_RADIUS = 0.016;

// ══════════════════════════════════════════════
// ── BUILD GARDEN ──
// ══════════════════════════════════════════════
//
// High-level builder (mirrors buildTreeGrove / buildFlowerGrove).
// Options:
//   seed — random seed (default: 2024)
//
// Returns a THREE.Group containing the bed + herbs.

export function buildGarden(options = {}) {
  const { seed = 2024 } = options;
  const rand = seededRandom(seed);

  const group = new THREE.Group();
  group.name = "gardenGroup";
  group.scale.setScalar(1.25);

  // ── Randomize bed dimensions based on seed ──
  const widthVar = 0.8 + rand() * 0.5;   // 0.8–1.3× multiplier
  const depthVar = 0.75 + rand() * 0.6;   // 0.75–1.35× multiplier
  const bedW = BED_WIDTH * widthVar;
  const bedD = BED_DEPTH * depthVar;
  const bedR = Math.min(BED_CORNER_RADIUS, bedW / 2, bedD / 2);

  // ── Garden bed (rounded rectangle, extruded) ──
  const bedShape = createRoundedRectShape(bedW, bedD, bedR);
  const extrudeSettings = {
    depth: BED_HEIGHT,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 1,
    curveSegments: 6,
  };
  const bedGeo = new THREE.ExtrudeGeometry(bedShape, extrudeSettings);
  // Rotate so it lies flat (extrude goes along Z by default, we want Y)
  bedGeo.rotateX(-Math.PI / 2);

  const bedMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0xc4a882),
    roughness: 0.75,
    metalness: 0.02,
    flatShading: false,
    envMapIntensity: 0.8,
  });

  const bedMesh = new THREE.Mesh(bedGeo, bedMat);
  bedMesh.name = "gardenBed";
  bedMesh.receiveShadow = true;
  bedMesh.castShadow = true;
  bedMesh.position.y = 0.001; // just above ground

  // Tint top faces darker to simulate soil (skip separate soil mesh)
  const bedPosAttr = bedGeo.attributes.position;
  const bedNrmAttr = bedGeo.attributes.normal;
  const faceCount = bedPosAttr.count;
  const bedColors = new Float32Array(faceCount * 3);
  const bedBaseColor = new THREE.Color(0xc4a882);
  const soilColor = new THREE.Color(0x8b6b4a);
  for (let i = 0; i < faceCount; i++) {
    const ny = bedNrmAttr.getY(i);
    // Top-facing faces (normal pointing up) get soil color
    const c = ny > 0.8 ? soilColor : bedBaseColor;
    bedColors[i * 3] = c.r;
    bedColors[i * 3 + 1] = c.g;
    bedColors[i * 3 + 2] = c.b;
  }
  bedGeo.setAttribute("color", new THREE.BufferAttribute(bedColors, 3));
  bedMat.vertexColors = true;

  group.add(bedMesh);

  // ── Herbs: Poisson-sampled squashed spheres ──
  const hw = (bedW - 0.04) / 2;
  const hd = (bedD - 0.04) / 2;
  const cornerR = Math.max(0.01, bedR - 0.01);

  // Generate Poisson points over the bed area
  const allPoints = poissonDiskSampling(bedW - 0.04, bedD - 0.04, HERB_MIN_DIST, rand);

  // Filter to only points inside the rounded rect, cap at 500
  const MAX_HERBS = 800;
  const filteredPoints = allPoints.filter((p) => isInsideRoundedRect(p.x, p.z, hw, hd, cornerR));
  const herbPoints = filteredPoints.length > MAX_HERBS ? filteredPoints.slice(0, MAX_HERBS) : filteredPoints;

  // Shared squashed sphere geometry — higher segment count for smooth shading
  const herbSphereGeo = new THREE.SphereGeometry(1, 6, 5);
  // Squash vertically
  const hpos = herbSphereGeo.attributes.position;
  for (let i = 0; i < hpos.count; i++) {
    const y = hpos.getY(i);
    hpos.setY(i, y * 0.45);
  }
  hpos.needsUpdate = true;
  herbSphereGeo.computeVertexNormals();

  // ── 2 InstancedMeshes: one for greens, one for accents ──
  const totalHerbs = herbPoints.length;
  const colorCount = HERB_COLORS.length;

  // Count greens vs accents for pre-allocation
  // We'll do two passes: first count, then fill
  const herbDecisions = [];
  for (let i = 0; i < totalHerbs; i++) {
    const isAccent = rand() >= 0.95;
    let colorIdx;
    if (!isAccent) {
      colorIdx = Math.floor(rand() * GREEN_COUNT);
    } else {
      colorIdx = ACCENT_START + Math.floor(rand() * (colorCount - ACCENT_START));
    }
    herbDecisions.push({ isAccent, colorIdx });
    // Consume same rand calls for size/height/rotation to keep determinism
    rand(); rand(); rand(); rand(); rand();
  }

  let greenCount2 = 0;
  let accentCount = 0;
  for (const d of herbDecisions) {
    if (d.isAccent) accentCount++;
    else greenCount2++;
  }

  // Shared material with vertex colors (single instance for both green + accent)
  const herbMat = new THREE.MeshStandardNodeMaterial({
    roughness: 0.55,
    metalness: 0.02,
    flatShading: false,
    envMapIntensity: 1.0,
  });
  herbMat.vertexColors = true;

  const greenIM = new THREE.InstancedMesh(herbSphereGeo, herbMat, Math.max(1, greenCount2));
  greenIM.name = "gardenHerbsGreen";
  greenIM.castShadow = false;
  greenIM.receiveShadow = true;
  greenIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, greenCount2) * 3), 3);

  const accentIM = new THREE.InstancedMesh(herbSphereGeo, herbMat, Math.max(1, accentCount));
  accentIM.name = "gardenHerbsAccent";
  accentIM.castShadow = false;
  accentIM.receiveShadow = true;
  accentIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, accentCount) * 3), 3);

  const tmpMat = new THREE.Matrix4();

  // Reset rand for the second pass with same sequence
  const rand2 = seededRandom(seed);
  // Re-consume the same calls from bed dimension randomization
  rand2(); rand2();

  // Re-consume Poisson internal calls — not feasible, so use separate rand for placement
  // Instead, store rand state by using a sub-seed for herb placement
  const herbRand = seededRandom(seed * 3 + 7919);

  let gi = 0;
  let ai = 0;

  for (let i = 0; i < totalHerbs; i++) {
    const pt = herbPoints[i];
    const decision = herbDecisions[i];

    // Size variation
    const baseR = HERB_BASE_RADIUS * (0.7 + herbRand() * 0.6);
    const heightVar = (0.6 + herbRand() * 0.8) * 3.5;

    const finalHeight = decision.isAccent ? heightVar * 1.7 : heightVar;
    const herbY = BED_HEIGHT + baseR * finalHeight * 0.3;

    tmpMat.compose(
      new THREE.Vector3(pt.x, herbY, pt.z),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          (herbRand() - 0.5) * 0.2,
          herbRand() * Math.PI * 2,
          (herbRand() - 0.5) * 0.2
        )
      ),
      new THREE.Vector3(baseR, baseR * finalHeight, baseR)
    );

    const color = HERB_COLORS[decision.colorIdx];

    if (decision.isAccent) {
      accentIM.setMatrixAt(ai, tmpMat);
      accentIM.setColorAt(ai, color);
      ai++;
    } else {
      greenIM.setMatrixAt(gi, tmpMat);
      greenIM.setColorAt(gi, color);
      gi++;
    }
  }

  greenIM.instanceMatrix.needsUpdate = true;
  greenIM.instanceColor.needsUpdate = true;
  accentIM.instanceMatrix.needsUpdate = true;
  accentIM.instanceColor.needsUpdate = true;

  greenIM.count = gi;
  accentIM.count = ai;

  group.add(greenIM);
  if (ai > 0) group.add(accentIM);

  // Store actual bed dimensions (in local space before group scale) for fence placement
  group.userData.bedW = bedW;
  group.userData.bedD = bedD;
  group.userData.groupScale = 1.25;

  return group;
}

// ══════════════════════════════════════════════
// ── BUILD BERRY GARDEN ──
// ══════════════════════════════════════════════
//
// Variant garden using small spheres (berries/fruits)
// instead of squashed herb blobs. Pink, red, purple palette.

export function buildBerryGarden(options = {}) {
  const { seed = 7777 } = options;
  const rand = seededRandom(seed);

  const group = new THREE.Group();
  group.name = "berryGardenGroup";
  group.scale.setScalar(1.25);

  // ── Randomize bed dimensions ──
  const widthVar = 0.8 + rand() * 0.5;
  const depthVar = 0.75 + rand() * 0.6;
  const bedW = BED_WIDTH * widthVar;
  const bedD = BED_DEPTH * depthVar;
  const bedR = Math.min(BED_CORNER_RADIUS, bedW / 2, bedD / 2);

  // ── Garden bed (rounded rectangle, extruded) ──
  const bedShape = createRoundedRectShape(bedW, bedD, bedR);
  const extrudeSettings = {
    depth: BED_HEIGHT,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 1,
    curveSegments: 6,
  };
  const bedGeo = new THREE.ExtrudeGeometry(bedShape, extrudeSettings);
  bedGeo.rotateX(-Math.PI / 2);

  const bedMat = new THREE.MeshStandardNodeMaterial({
    color: new THREE.Color(0xc4a882),
    roughness: 0.75,
    metalness: 0.02,
    flatShading: false,
    envMapIntensity: 0.8,
  });

  const bedMesh = new THREE.Mesh(bedGeo, bedMat);
  bedMesh.name = "berryGardenBed";
  bedMesh.receiveShadow = true;
  bedMesh.castShadow = true;
  bedMesh.position.y = 0.001;

  // Tint top faces darker (soil)
  const bedPosAttr = bedGeo.attributes.position;
  const bedNrmAttr = bedGeo.attributes.normal;
  const faceCount = bedPosAttr.count;
  const bedColors = new Float32Array(faceCount * 3);
  const bedBaseColor = new THREE.Color(0xc4a882);
  const soilColor = new THREE.Color(0x8b6b4a);
  for (let i = 0; i < faceCount; i++) {
    const ny = bedNrmAttr.getY(i);
    const c = ny > 0.8 ? soilColor : bedBaseColor;
    bedColors[i * 3] = c.r;
    bedColors[i * 3 + 1] = c.g;
    bedColors[i * 3 + 2] = c.b;
  }
  bedGeo.setAttribute("color", new THREE.BufferAttribute(bedColors, 3));
  bedMat.vertexColors = true;

  group.add(bedMesh);

  // ── Berry plants: Poisson-sampled ──
  const hw = (bedW - 0.04) / 2;
  const hd = (bedD - 0.04) / 2;
  const cornerR = Math.max(0.01, bedR - 0.01);

  const BERRY_MIN_DIST = 0.0135;
  const allPoints = poissonDiskSampling(bedW - 0.04, bedD - 0.04, BERRY_MIN_DIST, rand);

  const MAX_BERRIES = 2000;
  const filteredPoints = allPoints.filter((p) => isInsideRoundedRect(p.x, p.z, hw, hd, cornerR));
  const berryPoints = filteredPoints.length > MAX_BERRIES ? filteredPoints.slice(0, MAX_BERRIES) : filteredPoints;

  // ── Sphere geometry for berries (round, low-poly) ──
  const berrySphereGeo = new THREE.SphereGeometry(1, 6, 4);

  // ── Leaf geometry: thin & tall elongated sphere, very low-poly ──
  const leafSphereGeo = new THREE.SphereGeometry(1, 4, 3);
  const lpos = leafSphereGeo.attributes.position;
  for (let i = 0; i < lpos.count; i++) {
    // Squeeze X/Z to make thin, stretch Y to make tall
    lpos.setX(i, lpos.getX(i) * 0.55);
    lpos.setZ(i, lpos.getZ(i) * 0.55);
    lpos.setY(i, lpos.getY(i) * 1.4);
  }
  lpos.needsUpdate = true;
  leafSphereGeo.computeVertexNormals();

  // ── Decide colors per point ──
  const totalBerries = berryPoints.length;
  const colorCount = BERRY_COLORS.length;

  const MAX_FRUITS = 25;
  // Evenly spread fruit slots across the entire bed area
  const fruitCount_target = Math.min(MAX_FRUITS, totalBerries);
  const fruitIndices = new Set();
  if (fruitCount_target > 0 && totalBerries > 0) {
    // Spread fruits evenly by stride, with small random jitter
    const stride = totalBerries / fruitCount_target;
    const jitterRand = seededRandom(seed * 13 + 77);
    for (let f = 0; f < fruitCount_target; f++) {
      const base = Math.floor(f * stride);
      const jitter = Math.floor(jitterRand() * Math.max(1, stride * 0.6));
      const idx = Math.min(totalBerries - 1, base + jitter);
      fruitIndices.add(idx);
    }
  }

  const berryDecisions = [];
  const berryRandPre = seededRandom(seed * 7 + 42);
  for (let i = 0; i < totalBerries; i++) {
    const isBerry = fruitIndices.has(i);
    let colorIdx;
    if (!isBerry) {
      colorIdx = Math.floor(berryRandPre() * BERRY_GREEN_COUNT);
    } else {
      colorIdx = BERRY_ACCENT_START + Math.floor(berryRandPre() * (colorCount - BERRY_ACCENT_START));
    }
    berryDecisions.push({ isBerry, colorIdx });
  }

  // Thin out green leaves by randomly culling ~30% so red berries pop more
  const LEAF_CULL_CHANCE = 0.30;
  const cullRand = seededRandom(seed * 11 + 3571);
  const leafCulled = [];
  let leafCount = 0;
  let fruitCount = 0;
  for (const d of berryDecisions) {
    if (d.isBerry) {
      fruitCount++;
      leafCulled.push(false);
    } else {
      const culled = cullRand() < LEAF_CULL_CHANCE;
      leafCulled.push(culled);
      if (!culled) leafCount++;
    }
  }

  // ── Materials ──
  const leafMat = new THREE.MeshStandardNodeMaterial({
    roughness: 0.55,
    metalness: 0.02,
    flatShading: false,
    envMapIntensity: 1.0,
  });
  leafMat.vertexColors = true;

  const berryMat = new THREE.MeshStandardNodeMaterial({
    roughness: 0.3,
    metalness: 0.05,
    flatShading: false,
    envMapIntensity: 1.2,
  });
  berryMat.vertexColors = true;

  // ── InstancedMeshes ──
  const leafIM = new THREE.InstancedMesh(leafSphereGeo, leafMat, Math.max(1, leafCount));
  leafIM.name = "berryGardenLeaves";
  leafIM.castShadow = false;
  leafIM.receiveShadow = true;
  leafIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, leafCount) * 3), 3);

  const berryIM = new THREE.InstancedMesh(berrySphereGeo, berryMat, Math.max(1, fruitCount));
  berryIM.name = "berryGardenFruits";
  berryIM.castShadow = false;
  berryIM.receiveShadow = true;
  berryIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, fruitCount) * 3), 3);

  const tmpMat = new THREE.Matrix4();
  const berryRand = seededRandom(seed * 5 + 1337);

  let li = 0;
  let bi = 0;

  for (let i = 0; i < totalBerries; i++) {
    const pt = berryPoints[i];
    const decision = berryDecisions[i];

    if (decision.isBerry) {
      // Berry: small round sphere sitting on top of foliage
      const radius = HERB_BASE_RADIUS * (0.5 + berryRand() * 0.5);
      const berryY = BED_HEIGHT + radius + 0.01 + berryRand() * 0.015;

      tmpMat.compose(
        new THREE.Vector3(pt.x, berryY, pt.z),
        new THREE.Quaternion(),
        new THREE.Vector3(radius, radius, radius)
      );

      const color = BERRY_COLORS[decision.colorIdx];
      berryIM.setMatrixAt(bi, tmpMat);
      berryIM.setColorAt(bi, color);
      bi++;

      // consume extra rands for determinism
      berryRand(); berryRand(); berryRand();
    } else {
      // Leaf: thin & tall upright herb — larger, denser, taller
      const baseR = HERB_BASE_RADIUS * (0.55 + berryRand() * 0.45);
      const heightVar = (1.2 + berryRand() * 1.2);
      const herbY = BED_HEIGHT + baseR * heightVar * 0.3;

      // Always consume the same random calls for determinism
      const rx = (berryRand() - 0.5) * 0.3;
      const ry = berryRand() * Math.PI * 2;
      const rz = (berryRand() - 0.5) * 0.3;

      // Skip culled leaves (thinned out so red berries stand out)
      if (leafCulled[i]) continue;

      tmpMat.compose(
        new THREE.Vector3(pt.x, herbY, pt.z),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(rx, ry, rz)
        ),
        new THREE.Vector3(baseR * 1.2, baseR * heightVar * 1.6, baseR * 1.2)
      );

      const color = BERRY_COLORS[decision.colorIdx];
      leafIM.setMatrixAt(li, tmpMat);
      leafIM.setColorAt(li, color);
      li++;
    }
  }

  leafIM.instanceMatrix.needsUpdate = true;
  leafIM.instanceColor.needsUpdate = true;
  berryIM.instanceMatrix.needsUpdate = true;
  berryIM.instanceColor.needsUpdate = true;

  leafIM.count = li;
  berryIM.count = bi;

  group.add(leafIM);
  if (bi > 0) group.add(berryIM);

  // Store bed dimensions for fence placement
  group.userData.bedW = bedW;
  group.userData.bedD = bedD;
  group.userData.groupScale = 1.25;

  return group;
}

// ══════════════════════════════════════════════
// ── EXPORTS ──
// ══════════════════════════════════════════════

export {
  BED_WIDTH,
  BED_DEPTH,
  BED_CORNER_RADIUS,
  BED_HEIGHT,
  HERB_COLORS,
  HERB_MIN_DIST,
  HERB_BASE_RADIUS,
};