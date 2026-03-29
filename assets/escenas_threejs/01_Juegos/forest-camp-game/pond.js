// ══════════════════════════════════════════════
// WATER / DUCK POND GENERATOR
// ══════════════════════════════════════════════

import * as THREE from "three/webgpu";
import {
  uv, float, vec2, color, abs, smoothstep,
  mix, sin, cos, min, max, time
} from "three/tsl";
import { createPillarBush } from "./bush.js";

// ── Seeded Random ──
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ══════════════════════════════════════════════
// ── ROUNDED SQUARE SHAPE ──
// ══════════════════════════════════════════════

function createRoundedSquareShape(size, radius) {
  const shape = new THREE.Shape();
  const h = size / 2;
  const r = Math.min(radius, h);

  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h);
  shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r);
  shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h);
  shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r);
  shape.quadraticCurveTo(-h, -h, -h + r, -h);

  return shape;
}

// ══════════════════════════════════════════════
// ── WATER MATERIAL (TSL shader) ──
// ══════════════════════════════════════════════

let _sharedWaterMat = null;

function createWaterMaterial() {
  if (_sharedWaterMat) return _sharedWaterMat.clone();

  const mat = new THREE.MeshStandardNodeMaterial({
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
  });

  const uvVal = uv();
  const timeVal = time;

  const uvCentered = uvVal.sub(vec2(0.5, 0.5)).mul(2.0);
  const ax = abs(uvCentered.x);
  const ay = abs(uvCentered.y);
  const rr = float(0.42);
  const b = float(0.58);
  const qx = ax.sub(b);
  const qy = ay.sub(b);
  const outerX = max(qx, float(0.0));
  const outerY = max(qy, float(0.0));
  const outerLen = outerX.mul(outerX).add(outerY.mul(outerY)).sqrt();
  const innerLen = min(max(qx, qy), float(0.0));
  const distFromCenter = outerLen.add(innerLen).sub(rr).add(1.0);

  const midColor = color(0x0d47a1);
  const foamColor = color(0xbbdefb);

  const t = timeVal.mul(0.5);
  const waveUV = uvVal.mul(8.0);
  const wave1 = sin(waveUV.x.mul(1.5).add(waveUV.y).add(t));
  const wave2 = sin(waveUV.y.mul(1.8).sub(waveUV.x.mul(0.6)).add(t.mul(0.7)));
  const waveCombined = wave1.add(wave2).mul(0.25);
  const rippleHighlight = smoothstep(float(0.15), float(0.45), waveCombined);
  const rippleMask = smoothstep(float(0.70), float(0.45), distFromCenter);
  const waterBase = midColor.add(foamColor.mul(rippleHighlight.mul(rippleMask).mul(0.05)));

  const breathOffset = sin(timeVal).mul(0.06).add(0.06);
  const foamTime = timeVal.mul(0.3);
  const nUV = uvCentered.mul(8.0);
  const foamNoise = sin(nUV.x.mul(3.7).add(foamTime))
    .mul(cos(nUV.y.mul(4.3).sub(foamTime.mul(0.7)))).mul(0.035);

  const foamStart = float(0.68).sub(breathOffset).add(foamNoise);
  const foamFactor = smoothstep(foamStart, float(0.95).add(foamNoise), distFromCenter);

  mat.colorNode = mix(waterBase, foamColor, foamFactor.mul(0.2));
  mat.opacityNode = smoothstep(float(1.02), float(0.90), distFromCenter);
  mat.roughnessNode = mix(float(0.05), float(0.4), foamFactor);

  _sharedWaterMat = mat;
  return mat.clone();
}

// ══════════════════════════════════════════════
// ── BUILD DUCK POND ──
// ══════════════════════════════════════════════

export function buildDuckPond(options = {}) {
  const {
    seed = 42,
    cellsW = 2,
    cellsD = 2,
    cellSize = 1.0,
  } = options;

  const rand = seededRandom(seed);
  const group = new THREE.Group();
  group.name = "duckPond";

  const pondW = cellsW * cellSize;
  const pondD = cellsD * cellSize;
  const pondSize = Math.max(pondW, pondD);
  const cornerRadius = pondSize * 0.22;

  // ── Water surface ──
  const waterShape = createRoundedSquareShape(pondSize, cornerRadius);
  const waterGeo = new THREE.ShapeGeometry(waterShape, 8);

  const uvAttr = waterGeo.getAttribute("uv");
  const posAttr = waterGeo.getAttribute("position");
  const invHalf = 0.5 / (pondSize / 2);
  for (let i = 0, n = uvAttr.count; i < n; i++) {
    uvAttr.setXY(i, posAttr.getX(i) * invHalf + 0.5, posAttr.getY(i) * invHalf + 0.5);
  }
  uvAttr.needsUpdate = true;

  const waterMat = createWaterMaterial();
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.006;
  water.name = "pond_water";
  water.frustumCulled = true;
  water.matrixAutoUpdate = false;
  water.updateMatrix();
  group.add(water);

  // ── Pillar bushes emerging from the water ──
  const innerZone = pondSize * 0.3;
  const pillarCount = 3 + Math.floor(rand() * 3);
  const placedPillars = [];
  const minDistSq = pondSize * 0.18 * pondSize * 0.18;

  for (let i = 0; i < pillarCount; i++) {
    let px, pz, valid;
    let attempts = 0;
    do {
      px = (rand() - 0.5) * 2 * innerZone;
      pz = (rand() - 0.5) * 2 * innerZone;
      valid = true;
      for (let j = 0, n = placedPillars.length; j < n; j++) {
        const dx = px - placedPillars[j].x, dz = pz - placedPillars[j].z;
        if (dx * dx + dz * dz < minDistSq) { valid = false; break; }
      }
      attempts++;
    } while (!valid && attempts < 40);

    placedPillars.push({ x: px, z: pz });

    const pillarScale = 0.12 + rand() * 0.12;
    const pillarSeed = Math.floor(rand() * 999999);
    const pillar = createPillarBush(null, {
      seed: pillarSeed,
      radius: pillarScale,
      position: { x: px, y: 0.005, z: pz },
    });
    pillar.name = `pondPillar_${i}`;
    group.add(pillar);
  }

  group.userData.pondCellsW = cellsW;
  group.userData.pondCellsD = cellsD;

  return group;
}

// Legacy wrapper for backward compatibility
export function createPond() {
  return buildDuckPond({ seed: 42, cellsW: 2, cellsD: 2, cellSize: 1.0 });
}