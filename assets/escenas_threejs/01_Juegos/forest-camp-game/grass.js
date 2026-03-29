// ══════════════════════════════════════════════
// GRASS — Instanced grass blades for free green cells
// ══════════════════════════════════════════════

import * as THREE from 'three/webgpu';

// ── Seeded Random ──
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Grass blade colors — various greens
const GRASS_COLORS = [
  new THREE.Color(0x5ca832),
  new THREE.Color(0x6dbc3a),
  new THREE.Color(0x4e9628),
  new THREE.Color(0x7acc44),
  new THREE.Color(0x3d8020),
  new THREE.Color(0x88d44e),
  new THREE.Color(0x5ab030),
  new THREE.Color(0x448a24),
];

// Shared grass blade geometry — a curved multi-segment blade for lush look
let _grassBladeGeo = null;
function getGrassBladeGeo() {
  if (_grassBladeGeo) return _grassBladeGeo;

  // Multi-segment tapered blade with slight curve
  const w = 0.018;   // half-width at base
  const h = 0.12;    // total height
  const segments = 3;
  const verts = [];

  for (let s = 0; s < segments; s++) {
    const t0 = s / segments;
    const t1 = (s + 1) / segments;
    const y0 = t0 * h;
    const y1 = t1 * h;
    const w0 = w * (1 - t0 * 0.7);  // taper
    const w1 = w * (1 - t1 * 0.7);
    // Slight forward bend at top
    const z0 = t0 * t0 * 0.015;
    const z1 = t1 * t1 * 0.015;

    // Front face quad (2 tris)
    verts.push(
      -w0, y0, z0,   w0, y0, z0,   w1, y1, z1,
      -w0, y0, z0,   w1, y1, z1,  -w1, y1, z1,
    );
    // Back face
    verts.push(
       w0, y0, z0,  -w0, y0, z0,  -w1, y1, z1,
       w1, y1, z1,   w0, y0, z0,  -w1, y1, z1,  // fix winding
    );
  }

  _grassBladeGeo = new THREE.BufferGeometry();
  _grassBladeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  _grassBladeGeo.computeVertexNormals();
  return _grassBladeGeo;
}

// Shared material
const _grassMat = new THREE.MeshLambertMaterial({
  side: THREE.DoubleSide,
});
_grassMat.vertexColors = true;
_grassMat._shared = true;

/**
 * Create an instanced grass field at a given position
 * @param {Object} options
 * @param {number} options.bladeCount - number of grass blades
 * @param {number} options.radius - spread radius of the grass patch
 * @param {number} options.seed - random seed
 * @returns {THREE.InstancedMesh}
 */
export function createGrassField(options = {}) {
  const {
    bladeCount = 120,
    radius = 0.4,
    seed = 12345,
    minHeight = 0.6,
    maxHeight = 1.4,
  } = options;

  const rand = seededRandom(seed);
  const geo = getGrassBladeGeo();

  const im = new THREE.InstancedMesh(geo, _grassMat, bladeCount);
  im.name = 'grassField';
  im.receiveShadow = true;
  im.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(bladeCount * 3), 3
  );

  const tmpMat = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const tmpEuler = new THREE.Euler();

  for (let i = 0; i < bladeCount; i++) {
    // Scatter blades within a circular area
    const angle = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * radius;
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;

    // Random rotation around Y axis
    const rotY = rand() * Math.PI * 2;
    // Slight tilt for natural look
    const tiltX = (rand() - 0.5) * 0.3;
    const tiltZ = (rand() - 0.5) * 0.3;

    // Random height scale
    const heightScale = minHeight + rand() * (maxHeight - minHeight);
    const widthScale = 0.6 + rand() * 0.8;

    tmpPos.set(px, 0, pz);
    tmpEuler.set(tiltX, rotY, tiltZ);
    tmpQuat.setFromEuler(tmpEuler);
    tmpScale.set(widthScale, heightScale, widthScale);

    tmpMat.compose(tmpPos, tmpQuat, tmpScale);
    im.setMatrixAt(i, tmpMat);

    // Assign a random green color
    const colorIdx = Math.floor(rand() * GRASS_COLORS.length);
    im.setColorAt(i, GRASS_COLORS[colorIdx]);
  }

  im.instanceMatrix.needsUpdate = true;
  im.instanceColor.needsUpdate = true;

  return im;
}

/**
 * Build ALL grass as a SINGLE InstancedMesh for maximum performance.
 * Instead of one InstancedMesh per patch (hundreds of draw calls),
 * we merge everything into one draw call.
 * @param {Array<{x: number, z: number}>} positions - world positions
 * @param {Object} options
 * @returns {THREE.InstancedMesh}
 */
export function buildGrassPatches(positions, options = {}) {
  const {
    bladesPerPatch = 80,
    patchRadius = 0.38,
    baseSeed = 42000,
    pondCenter = null,
    pondFadeRadius = 2.5,
    pondMinScale = 0.2,
  } = options;

  const totalBlades = positions.length * bladesPerPatch;
  const geo = getGrassBladeGeo();
  const im = new THREE.InstancedMesh(geo, _grassMat, totalBlades);
  im.name = 'grassAllInstanced';
  im.receiveShadow = true;
  im.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(totalBlades * 3), 3
  );

  const tmpMat = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const tmpEuler = new THREE.Euler();

  let bladeIdx = 0;

  for (let p = 0; p < positions.length; p++) {
    const pos = positions[p];
    const rand = seededRandom(baseSeed + p * 137);

    // Compute height scale based on distance to pond
    let heightScale = 1.0;
    if (pondCenter) {
      const dx = pos.x - pondCenter.x;
      const dz = pos.z - pondCenter.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < pondFadeRadius) {
        const t = dist / pondFadeRadius;
        const smooth = t * t * (3 - 2 * t);
        heightScale = pondMinScale + (1.0 - pondMinScale) * smooth;
      }
    }

    const minH = 0.7 * heightScale;
    const maxH = 1.8 * heightScale;

    for (let i = 0; i < bladesPerPatch; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * patchRadius;
      const px = pos.x + Math.cos(angle) * dist;
      const pz = pos.z + Math.sin(angle) * dist;

      const rotY = rand() * Math.PI * 2;
      const tiltX = (rand() - 0.5) * 0.4;
      const tiltZ = (rand() - 0.5) * 0.4;
      const hScale = minH + rand() * (maxH - minH);
      const wScale = 0.7 + rand() * 1.0;

      tmpPos.set(px, 0.01, pz);
      tmpEuler.set(tiltX, rotY, tiltZ);
      tmpQuat.setFromEuler(tmpEuler);
      tmpScale.set(wScale, hScale, wScale);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      im.setMatrixAt(bladeIdx, tmpMat);

      const colorIdx = Math.floor(rand() * GRASS_COLORS.length);
      im.setColorAt(bladeIdx, GRASS_COLORS[colorIdx]);
      bladeIdx++;
    }
  }

  im.instanceMatrix.needsUpdate = true;
  im.instanceColor.needsUpdate = true;
  im.matrixAutoUpdate = false;
  im.updateMatrix();
  im.frustumCulled = false; // single large mesh, always visible

  return im;
}