// ══════════════════════════════════════════════
// TREE — Low-poly stylized trees (InstancedMesh batched)
// ══════════════════════════════════════════════

import * as THREE from 'three';

// Color palettes
const COLOR_PALETTES = {
  green: {
    pine:  [0x2d7a3a, 0x3a8f4a, 0x267032],
    round: 0x3d9e50,
    bush:  0x4caf50,
    trunk: 0x6b4226,
  },
  blue: {
    pine:  [0x2a7b9b, 0x3a9ab8, 0x1f6d8a],
    round: 0x3a98b0,
    bush:  0x48a8b8,
    trunk: 0x5a4a3a,
  },
  darkGreen: {
    pine:  [0x1e5a28, 0x2a6e34, 0x1a5022],
    round: 0x2a7040,
    bush:  0x358045,
    trunk: 0x6b4226,
  },
  teal: {
    pine:  [0x1a8a7a, 0x28a090, 0x157a6a],
    round: 0x2a9888,
    bush:  0x35a898,
    trunk: 0x5a4a3a,
  },
};

// Shared geometries
const trunkGeo = new THREE.CylinderGeometry(0.10, 0.11, 0.15, 8);
const coneGeos = [
  new THREE.ConeGeometry(0.25, 0.25, 8),
  new THREE.ConeGeometry(0.19, 0.22, 8),
  new THREE.ConeGeometry(0.12, 0.18, 8),
];
const sphereGeo = new THREE.SphereGeometry(0.22, 10, 8);
const bushGeo = new THREE.SphereGeometry(0.16, 8, 6);

const PINE_LAYERS = [
  { y: 0.275, geoIdx: 0 },
  { y: 0.425, geoIdx: 1 },
  { y: 0.555, geoIdx: 2 },
];

// Material cache
const _matCache = new Map();
function getMat(hex, roughness = 0.75, flatShading = true) {
  const key = `${hex}_${roughness}_${flatShading}`;
  if (!_matCache.has(key)) {
    _matCache.set(key, new THREE.MeshStandardMaterial({
      color: hex, roughness, metalness: 0.0, flatShading,
    }));
  }
  return _matCache.get(key);
}

/**
 * Build all trees as batched InstancedMeshes — one draw call per unique (geometry, color) pair.
 * @param {Array} treeData — [{x, z, variant, s, c}] already filtered for valid positions
 * @returns {THREE.Group} containing InstancedMesh objects
 */
export function buildTreeInstances(treeData) {
  const group = new THREE.Group();
  group.name = 'trees_instanced';

  // Key → { geo, matHex, instances: [Matrix4] }
  const batches = new Map();

  const _m = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _scale = new THREE.Vector3();
  const _euler = new THREE.Euler();
  const _parentPos = new THREE.Vector3();

  for (const tree of treeData) {
    const { x, z, variant, s, c } = tree;
    const palette = COLOR_PALETTES[c || 'green'] || COLOR_PALETTES.green;
    const rotY = Math.random() * Math.PI * 2;

    _euler.set(0, rotY, 0);
    _quat.setFromEuler(_euler);
    _parentPos.set(x, 0, z);

    function addInst(key, geo, matHex, ly, lx = 0, lz = 0, ls = 1) {
      if (!batches.has(key)) batches.set(key, { geo, matHex, instances: [] });
      _pos.set(lx * s, ly * s, lz * s).applyQuaternion(_quat).add(_parentPos);
      _scale.set(s * ls, s * ls, s * ls);
      _m.compose(_pos, _quat, _scale);
      batches.get(key).instances.push(_m.clone());
    }

    // Trunk (every tree has one)
    addInst(`trunk|${palette.trunk}`, trunkGeo, palette.trunk, 0.075);

    if (variant === 'pine') {
      PINE_LAYERS.forEach((layer, i) => {
        const ch = palette.pine[i % palette.pine.length];
        addInst(`cone${layer.geoIdx}|${ch}`, coneGeos[layer.geoIdx], ch, layer.y);
      });
    } else if (variant === 'round') {
      addInst(`sphere|${palette.round}`, sphereGeo, palette.round, 0.30);
    } else if (variant === 'bush') {
      addInst(`bush|${palette.bush}`, bushGeo, palette.bush, 0.10);
      addInst(`bush2|${palette.bush}`, bushGeo, palette.bush, 0.14, 0.1, 0.05, 0.75);
    }
  }

  // Create one InstancedMesh per batch
  for (const [key, { geo, matHex, instances }] of batches) {
    const mat = key.startsWith('trunk')
      ? getMat(matHex, 0.85, false)
      : getMat(matHex, 0.75, true);

    const mesh = new THREE.InstancedMesh(geo, mat, instances.length);
    mesh.name = `tree_batch_${key}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;

    for (let i = 0; i < instances.length; i++) {
      mesh.setMatrixAt(i, instances[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  group.matrixAutoUpdate = false;
  group.updateMatrixWorld(true);
  return group;
}

// Legacy single-tree creator kept for potential non-batched use
export function createTree(variant = 'pine', colorScheme = 'green') {
  const group = new THREE.Group();
  group.name = `tree_${variant}_${colorScheme}`;
  const palette = COLOR_PALETTES[colorScheme] || COLOR_PALETTES.green;
  const trunk = new THREE.Mesh(trunkGeo, getMat(palette.trunk, 0.85, false));
  trunk.position.y = 0.075;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);
  if (variant === 'pine') {
    PINE_LAYERS.forEach((l, i) => {
      const cone = new THREE.Mesh(coneGeos[l.geoIdx], getMat(palette.pine[i % palette.pine.length]));
      cone.position.y = l.y;
      cone.castShadow = true;
      cone.receiveShadow = true;
      group.add(cone);
    });
  } else if (variant === 'round') {
    const sp = new THREE.Mesh(sphereGeo, getMat(palette.round, 0.7, true));
    sp.position.y = 0.30;
    sp.castShadow = true;
    sp.receiveShadow = true;
    group.add(sp);
  } else if (variant === 'bush') {
    const bm = getMat(palette.bush, 0.8, true);
    const b1 = new THREE.Mesh(bushGeo, bm);
    b1.position.set(0, 0.10, 0);
    b1.castShadow = true;
    group.add(b1);
    const b2 = new THREE.Mesh(bushGeo, bm);
    b2.position.set(0.1, 0.14, 0.05);
    b2.scale.setScalar(0.75);
    b2.castShadow = true;
    group.add(b2);
  }
  return group;
}