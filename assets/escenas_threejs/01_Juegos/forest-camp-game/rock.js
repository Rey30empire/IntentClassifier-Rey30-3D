// ══════════════════════════════════════════════
// ROCK — Scattered rock decorations (shared mat)
// ══════════════════════════════════════════════

import * as THREE from 'three';

let _rockMat = null;
function getRockMat() {
  if (!_rockMat) {
    _rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8a7a, roughness: 0.9, metalness: 0.0, flatShading: true });
    _rockMat._shared = true;
  }
  return _rockMat;
}

export function createRock(size = 'medium') {
  const group = new THREE.Group();
  group.name = `rock_${size}`;

  const scales = { small: 0.4, medium: 0.7, large: 1.0 };
  const s = scales[size] || 0.7;

  // Each rock gets its own deformed geo (cheap since rocks are few)
  const rockGeo = new THREE.DodecahedronGeometry(0.08 * s, 1);
  const pos = rockGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const noise = 0.85 + Math.random() * 0.3;
    pos.setXYZ(i, x * noise, y * noise * 0.7, z * noise);
  }
  rockGeo.computeVertexNormals();

  const rock = new THREE.Mesh(rockGeo, getRockMat());
  rock.position.y = 0.04 * s;
  rock.castShadow = true;
  rock.receiveShadow = true;
  group.add(rock);

  return group;
}