// ══════════════════════════════════════════════
// FLOWER — Daisy / small flowers (shared geo/mat)
// ══════════════════════════════════════════════

import * as THREE from 'three';

// ── Shared geometry & materials ──
let _stemGeo = null, _stemMat = null, _petalGeo = null, _centerGeo = null, _centerMat = null;
const _petalMatCache = new Map();

function getStemGeo() {
  if (!_stemGeo) _stemGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.06, 4);
  return _stemGeo;
}
function getStemMat() {
  if (!_stemMat) { _stemMat = new THREE.MeshLambertMaterial({ color: 0x4a8a3a }); _stemMat._shared = true; }
  return _stemMat;
}
function getPetalGeo() {
  if (!_petalGeo) _petalGeo = new THREE.SphereGeometry(0.04, 5, 4);
  return _petalGeo;
}
function getPetalMat(hex) {
  if (_petalMatCache.has(hex)) return _petalMatCache.get(hex);
  const m = new THREE.MeshLambertMaterial({ color: hex });
  m._shared = true;
  _petalMatCache.set(hex, m);
  return m;
}
function getCenterGeo() {
  if (!_centerGeo) _centerGeo = new THREE.SphereGeometry(0.022, 6, 4);
  return _centerGeo;
}
function getCenterMat() {
  if (!_centerMat) {
    _centerMat = new THREE.MeshStandardMaterial({ color: 0xf5d442, roughness: 0.4, emissive: 0xf5c800, emissiveIntensity: 0.2 });
    _centerMat._shared = true;
  }
  return _centerMat;
}

export function createFlower(color = 0xffffff) {
  const group = new THREE.Group();
  group.name = 'flower';

  const stem = new THREE.Mesh(getStemGeo(), getStemMat());
  stem.position.y = 0.03;
  group.add(stem);

  const petalMat = getPetalMat(color);
  const petalGeo = getPetalGeo();
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.position.set(Math.cos(angle) * 0.04, 0.07, Math.sin(angle) * 0.04);
    petal.scale.set(1, 0.5, 1);
    group.add(petal);
  }

  const center = new THREE.Mesh(getCenterGeo(), getCenterMat());
  center.position.y = 0.07;
  group.add(center);

  return group;
}