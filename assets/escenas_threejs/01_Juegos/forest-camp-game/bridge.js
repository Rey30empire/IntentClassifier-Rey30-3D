// ══════════════════════════════════════════════
// BRIDGE — Small wooden plank bridge (shared geo/mat)
// ══════════════════════════════════════════════

import * as THREE from 'three';

let _plankGeo, _plankMatA, _plankMatB, _railGeo, _railMat;

function init() {
  if (_plankGeo) return;
  const plankWidth = 0.16, plankGap = 0.02, plankCount = 5;
  const totalWidth = plankCount * (plankWidth + plankGap);
  _plankGeo = new THREE.BoxGeometry(plankWidth, 0.02, 0.45);
  _plankMatA = new THREE.MeshStandardMaterial({ color: 0x8b6d4a, roughness: 0.85, metalness: 0.0 }); _plankMatA._shared = true;
  _plankMatB = new THREE.MeshStandardMaterial({ color: 0x7a5c3a, roughness: 0.85, metalness: 0.0 }); _plankMatB._shared = true;
  _railGeo = new THREE.CylinderGeometry(0.012, 0.012, totalWidth + 0.05, 6);
  _railMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 }); _railMat._shared = true;
}

export function createBridge() {
  init();
  const group = new THREE.Group();
  group.name = 'bridge';

  const plankCount = 5, plankWidth = 0.16, plankGap = 0.02;
  const totalWidth = plankCount * (plankWidth + plankGap);

  for (let i = 0; i < plankCount; i++) {
    const plank = new THREE.Mesh(_plankGeo, i % 2 === 0 ? _plankMatA : _plankMatB);
    plank.position.set(
      i * (plankWidth + plankGap) - totalWidth * 0.5 + plankWidth * 0.5,
      0.06, 0
    );
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }

  [-1, 1].forEach((side) => {
    const rail = new THREE.Mesh(_railGeo, _railMat);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 0.075, side * 0.22);
    rail.castShadow = true;
    group.add(rail);
  });

  return group;
}