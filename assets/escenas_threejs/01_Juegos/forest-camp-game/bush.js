// ══════════════════════════════════════════════
// ── PILLAR BUSH (4×4 grid of rounded pillars) ──
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

const PILLAR_GRID = 4;
const PILLAR_COUNT = PILLAR_GRID * PILLAR_GRID;

const PILLAR_GREENS = [
  new THREE.Color(0x8ba83e),
  new THREE.Color(0x7a9e2a),
  new THREE.Color(0x6b8f28),
  new THREE.Color(0x9bb844),
  new THREE.Color(0xa4c24e),
  new THREE.Color(0x5d7a22),
];

let _sharedPillarGeo = null;
function getSharedPillarGeo() {
  if (_sharedPillarGeo) return _sharedPillarGeo;
  _sharedPillarGeo = new THREE.CapsuleGeometry(1, 2, 3, 5);
  return _sharedPillarGeo;
}

const _sharedPillarMat = new THREE.MeshStandardNodeMaterial({
  roughness: 0.55,
  metalness: 0.02,
  side: THREE.FrontSide,
  flatShading: false,
  envMapIntensity: 1.0,
});
_sharedPillarMat.vertexColors = true;
_sharedPillarMat._shared = true;

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

  const spacing = radius * 0.35;
  const gridOffset = (PILLAR_GRID - 1) * spacing * 0.5;
  const pillarRadius = radius * 0.08;
  const pillarHeight = radius * 1.2;
  const colorCount = PILLAR_GREENS.length;

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

      const px = col * spacing - gridOffset + (rand() - 0.5) * spacing * 0.3;
      const pz = row * spacing - gridOffset + (rand() - 0.5) * spacing * 0.3;

      const cx = (col - (PILLAR_GRID - 1) / 2) / ((PILLAR_GRID - 1) / 2);
      const cz = (row - (PILLAR_GRID - 1) / 2) / ((PILLAR_GRID - 1) / 2);
      const distFromCenter = Math.sqrt(cx * cx + cz * cz);
      const heightMul = 1.0 - distFromCenter * 0.25 + rand() * 0.3;

      const finalHeight = pillarHeight * heightMul;
      const finalRadius = pillarRadius * (0.85 + rand() * 0.3);

      const tiltAngle = 0.1 + distFromCenter * 0.2 + (rand() - 0.5) * 0.15;
      const tiltDir = Math.atan2(pz, px) + (rand() - 0.5) * 0.5;

      const scaleY = finalHeight / 4;
      const scaleXZ = finalRadius;
      const py = scaleY * 2;

      tmpPos.set(px, py, pz);
      tmpEuler.set(
        Math.sin(tiltDir) * tiltAngle,
        rand() * Math.PI * 2,
        Math.cos(tiltDir) * tiltAngle
      );
      tmpQuat.setFromEuler(tmpEuler);
      tmpScale.set(scaleXZ, scaleY, scaleXZ);

      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      im.setMatrixAt(idx, tmpMat);

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