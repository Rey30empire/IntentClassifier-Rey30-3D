// ══════════════════════════════════════════════
// MUSHROOM — Red spotted mushroom (shared geo/mat)
// ══════════════════════════════════════════════

import * as THREE from 'three';

let _stemGeo, _stemMat, _capGeo, _capMat, _spotGeo, _spotMat;

function init() {
  if (_stemGeo) return;
  _stemGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.08, 6);
  _stemMat = new THREE.MeshLambertMaterial({ color: 0xf0e8d8 }); _stemMat._shared = true;
  _capGeo = new THREE.SphereGeometry(0.06, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
  _capMat = new THREE.MeshStandardMaterial({ color: 0xe83030, roughness: 0.5, metalness: 0.05 }); _capMat._shared = true;
  _spotGeo = new THREE.SphereGeometry(0.022, 6, 6);
  _spotMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); _spotMat._shared = true;
}

export function createMushroom() {
  init();
  const group = new THREE.Group();
  group.name = 'mushroom';

  const stem = new THREE.Mesh(_stemGeo, _stemMat);
  stem.position.y = 0.04;
  stem.castShadow = true;
  group.add(stem);

  const cap = new THREE.Mesh(_capGeo, _capMat);
  cap.position.y = 0.08;
  cap.castShadow = true;
  group.add(cap);

  const spots = [
    { x: 0.025, y: 0.105, z: 0.042 },
    { x: -0.035, y: 0.1, z: 0.028 },
    { x: 0.012, y: 0.112, z: -0.042 },
    { x: -0.01, y: 0.115, z: 0.0 },
    { x: 0.04, y: 0.095, z: -0.01 },
    { x: -0.025, y: 0.098, z: -0.035 },
  ];
  spots.forEach((s) => {
    const spot = new THREE.Mesh(_spotGeo, _spotMat);
    spot.position.set(s.x, s.y, s.z);
    group.add(spot);
  });

  return group;
}