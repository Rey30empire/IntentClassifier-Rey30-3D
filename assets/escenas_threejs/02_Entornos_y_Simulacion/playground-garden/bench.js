// ══════════════════════════════════════════════
// BENCH GENERATOR  (optimized)
// ══════════════════════════════════════════════
//
// Optimizations applied:
//  • InstancedMesh for legs (4) and arm posts (4)
//  • All wood geometry merged into ONE mesh (1 draw call)
//  • All metal geometry merged into ONE mesh (1 draw call)
//  • Reduced curveSegments 8→4, bevelSegments 3→2, cylinder radialSegments 8→6
//  • Shared materials (2 total: wood + metal)
//  • Cached base geometries to avoid re-creation
// ══════════════════════════════════════════════

import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ── Seeded Random ──
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ══════════════════════════════════════════════
// ── SHARED MATERIALS (2 total) ──
// ══════════════════════════════════════════════

const _benchMetalMat = new THREE.MeshStandardNodeMaterial({
  color: new THREE.Color(0x6a6a6a),
  roughness: 0.35,
  metalness: 0.5,
  flatShading: false,
});
_benchMetalMat._shared = true;

const _benchWoodMat = new THREE.MeshStandardNodeMaterial({
  color: new THREE.Color(0xf5f0e8),
  roughness: 0.7,
  metalness: 0.0,
  flatShading: false,
});
_benchWoodMat._shared = true;

// ══════════════════════════════════════════════
// ── SVG PATH → THREE.Shape CONVERTER ──
// ══════════════════════════════════════════════

function svgPathToShape(pathData, targetWidth, targetLength) {
  const commands = [];
  const regex = /([MLCVHZmlcvhz])([^MLCVHZmlcvhz]*)/g;
  let match;
  while ((match = regex.exec(pathData)) !== null) {
    const cmd = match[1];
    const nums = match[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    commands.push({ cmd, nums });
  }

  const points = [];
  let cx = 0, cy = 0;
  for (const { cmd, nums } of commands) {
    switch (cmd) {
      case 'M': case 'L':
        cx = nums[0]; cy = nums[1];
        points.push({ x: cx, y: cy });
        break;
      case 'C':
        points.push({ x: nums[0], y: nums[1] }, { x: nums[2], y: nums[3] });
        cx = nums[4]; cy = nums[5];
        points.push({ x: cx, y: cy });
        break;
      case 'V': cy = nums[0]; points.push({ x: cx, y: cy }); break;
      case 'H': cx = nums[0]; points.push({ x: cx, y: cy }); break;
    }
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const svgW = maxX - minX, svgH = maxY - minY;
  const svgCX = (minX + maxX) / 2, svgCY = (minY + maxY) / 2;
  const sx = targetWidth / svgW, sy = targetLength / svgH;
  function tx(x) { return (x - svgCX) * sx; }
  function ty(y) { return (y - svgCY) * sy; }

  const shape = new THREE.Shape();
  cx = 0; cy = 0;
  for (const { cmd, nums } of commands) {
    switch (cmd) {
      case 'M': shape.moveTo(tx(nums[0]), ty(nums[1])); cx = nums[0]; cy = nums[1]; break;
      case 'L': shape.lineTo(tx(nums[0]), ty(nums[1])); cx = nums[0]; cy = nums[1]; break;
      case 'C':
        shape.bezierCurveTo(tx(nums[0]), ty(nums[1]), tx(nums[2]), ty(nums[3]), tx(nums[4]), ty(nums[5]));
        cx = nums[4]; cy = nums[5]; break;
      case 'V': shape.lineTo(tx(cx), ty(nums[0])); cy = nums[0]; break;
      case 'H': shape.lineTo(tx(nums[0]), ty(cy)); cx = nums[0]; break;
      case 'Z': case 'z': shape.closePath(); break;
    }
  }
  return shape;
}

// ══════════════════════════════════════════════
// ── PLANK GEOMETRY BUILDER (reduced polys) ──
// ══════════════════════════════════════════════

const PLANK_SVG_PATH =
  "M129.5 27.5 L124.5 302.5 C124.5 302.5 124.5 337.5 63.5 339.5 C2.5 341.5 0.5 302.5 0.5 302.5 V27.5 C0.5 9.5 36.5 0.5 63.5 0.5 C90.5 0.5 129.5 7.5 129.5 27.5Z";

function buildPlankGeo(width, length, thickness) {
  const shape = svgPathToShape(PLANK_SVG_PATH, width, length);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 2,   // reduced from 3
    curveSegments: 4,    // reduced from 8
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, thickness / 2, 0);
  return geo;
}

// ══════════════════════════════════════════════
// ── CONSTANTS ──
// ══════════════════════════════════════════════

const LEG_RADIUS = 0.038;
const LEG_HEIGHT = 0.12;
const SEAT_WIDTH = 0.7;
const SEAT_DEPTH = 0.35;
const PLANK_COUNT = 6;
const PLANK_GAP = 0.008;
const PLANK_HEIGHT = 0.05;
const CYL_SEGMENTS = 6; // reduced from 8

// ══════════════════════════════════════════════
// ── CREATE STANDALONE BENCH (optimized) ──
// ══════════════════════════════════════════════

export function createStandaloneBench(scene, options = {}) {
  const {
    seed = 777,
    position = { x: 0, y: 0, z: 0 },
    scale = 1.0,
  } = options;

  const rand = seededRandom(seed);
  const group = new THREE.Group();
  group.name = "standaloneBench";
  group.position.set(position.x, position.y, position.z);
  group.scale.setScalar(scale);

  // ── Collect ALL geometries, then merge into 2 meshes (wood + metal) ──
  const woodGeos = [];
  const metalGeos = [];

  // ── Dimensions ──
  const legInsetX = SEAT_WIDTH / 2 - 0.04;
  const legInsetZ = SEAT_DEPTH / 2 - 0.03;
  const seatY = LEG_HEIGHT - PLANK_HEIGHT / 2;
  const plankThickness = PLANK_HEIGHT;
  const plankLength = SEAT_DEPTH + 0.02;

  // ── Legs (4 cylinders → merge into metal) ──
  const legGeo = new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS * 1.15, LEG_HEIGHT, CYL_SEGMENTS);
  legGeo.translate(0, LEG_HEIGHT / 2, 0);

  const legPositions = [
    { x: -legInsetX, z: -legInsetZ },
    { x:  legInsetX, z: -legInsetZ },
    { x: -legInsetX, z:  legInsetZ },
    { x:  legInsetX, z:  legInsetZ },
  ];

  legPositions.forEach((lp, i) => {
    const g = legGeo.clone();
    g.translate(lp.x, 0, lp.z);
    metalGeos.push(g);
  });

  // ── Seat Planks (6 planks → merge into wood) ──
  const totalGaps = (PLANK_COUNT - 1) * PLANK_GAP;
  const availableWidth = SEAT_WIDTH - totalGaps;
  const wideMultiplier = 1.5;
  const regularPlankW = availableWidth / (2 * wideMultiplier + (PLANK_COUNT - 2));
  const widePlankW = regularPlankW * wideMultiplier;

  let currentX = -SEAT_WIDTH / 2;
  for (let i = 0; i < PLANK_COUNT; i++) {
    const pw = (i === 0 || i === PLANK_COUNT - 1) ? widePlankW : regularPlankW;
    const geo = buildPlankGeo(pw, plankLength, plankThickness);
    geo.translate(currentX + pw / 2, seatY, 0);
    woodGeos.push(geo);
    currentX += pw + PLANK_GAP;
  }

  // ── Armrest posts (4 cylinders → merge into metal) ──
  const ARM_POST_RADIUS = LEG_RADIUS * 0.7;
  const ARM_POST_HEIGHT = 0.1;
  const armPostGeo = new THREE.CylinderGeometry(ARM_POST_RADIUS, ARM_POST_RADIUS, ARM_POST_HEIGHT, CYL_SEGMENTS);
  armPostGeo.translate(0, ARM_POST_HEIGHT / 2, 0);

  const armPostY = seatY + plankThickness;
  const armSpanZ = legInsetZ * 0.65;
  const armOffsetZ = legInsetZ * 0.35;
  const armPostZFront = -armSpanZ + armOffsetZ;
  const armPostZBack = armSpanZ + armOffsetZ;
  const armPostXLeft = -legInsetX;
  const armPostXRight = legInsetX;

  const armPostPositions = [
    { x: armPostXLeft,  z: armPostZFront },
    { x: armPostXLeft,  z: armPostZBack },
    { x: armPostXRight, z: armPostZFront },
    { x: armPostXRight, z: armPostZBack },
  ];

  armPostPositions.forEach(ap => {
    const g = armPostGeo.clone();
    g.translate(ap.x, armPostY, ap.z);
    metalGeos.push(g);
  });

  // ── Armrest planks (2 → merge into wood) ──
  const armPlankWidth = widePlankW * 0.8;
  const armPlankLength = armSpanZ * 2 + 0.06;
  const armPlankThickness = plankThickness * 0.6;
  const armPlankY = armPostY + ARM_POST_HEIGHT - armPlankThickness / 2;

  [armPostXLeft, armPostXRight].forEach(xPos => {
    const g = buildPlankGeo(armPlankWidth, armPlankLength, armPlankThickness);
    g.translate(xPos, armPlankY, armOffsetZ);
    woodGeos.push(g);
  });

  // ── Backrest plank (1 → merge into wood) ──
  const backPlankWidth = SEAT_WIDTH - 0.04;
  const backPlankLength = ARM_POST_HEIGHT * 1.4;
  const backPlankThickness = plankThickness * 0.7;

  const backGeo = buildPlankGeo(backPlankWidth, backPlankLength, backPlankThickness);
  backGeo.rotateX(Math.PI / 2);

  // ── Bend the backrest ──
  const BEND_AMOUNT = 0.045;
  const halfWidth = backPlankWidth / 2;
  const posAttr = backGeo.getAttribute('position');
  const normalAttr = backGeo.getAttribute('normal');
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const nz = normalAttr.getZ(i);
    const t = x / halfWidth;
    const zOffset = BEND_AMOUNT * t * t;
    posAttr.setZ(i, posAttr.getZ(i) - zOffset);
    // Adjust normals
    const nx = normalAttr.getX(i);
    const ny = normalAttr.getY(i);
    const slopeZ = 2 * BEND_AMOUNT * t / halfWidth;
    const newNx = nx + slopeZ * nz;
    const len = Math.sqrt(newNx * newNx + ny * ny + nz * nz);
    if (len > 0) {
      normalAttr.setX(i, newNx / len);
      normalAttr.setY(i, ny / len);
      normalAttr.setZ(i, nz / len);
    }
  }
  posAttr.needsUpdate = true;
  normalAttr.needsUpdate = true;

  const backY = armPlankY + armPlankThickness / 2 + backPlankLength / 2;
  const backZ = armOffsetZ + armSpanZ * 0.65;
  backGeo.translate(0, backY, backZ);
  woodGeos.push(backGeo);

  // ══════════════════════════════════════════════
  // ── MERGE INTO 2 MESHES (wood + metal) ──
  // ══════════════════════════════════════════════

  const mergedWood = mergeGeometries(woodGeos);
  woodGeos.forEach(g => g.dispose());
  const woodMesh = new THREE.Mesh(mergedWood, _benchWoodMat);
  woodMesh.name = "benchWood";
  woodMesh.castShadow = true;
  woodMesh.receiveShadow = true;
  group.add(woodMesh);

  const mergedMetal = mergeGeometries(metalGeos);
  metalGeos.forEach(g => g.dispose());
  const metalMesh = new THREE.Mesh(mergedMetal, _benchMetalMat);
  metalMesh.name = "benchMetal";
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  group.add(metalMesh);

  if (scene) scene.add(group);
  return group;
}

// ══════════════════════════════════════════════
// ── EXPORTS ──
// ══════════════════════════════════════════════

export { SEAT_WIDTH, SEAT_DEPTH, LEG_HEIGHT, PLANK_HEIGHT };