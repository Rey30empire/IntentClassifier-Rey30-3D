// ══════════════════════════════════════════════
// COIN — Glowing collectible coin (shared geo/mat)
// ══════════════════════════════════════════════

import * as THREE from 'three';

// ── Shared geometry & materials ──
let _coinGeo = null, _coinMat = null, _glowGeo = null, _glowMat = null;

function getCoinGeo() {
  if (!_coinGeo) _coinGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.03, 16);
  return _coinGeo;
}
function getCoinMat() {
  if (!_coinMat) {
    _coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd700, roughness: 0.2, metalness: 0.85,
      emissive: 0xffa500, emissiveIntensity: 0.35,
    });
    _coinMat._shared = true;
  }
  return _coinMat;
}
function getGlowGeo() {
  if (!_glowGeo) _glowGeo = new THREE.TorusGeometry(0.1, 0.015, 6, 16);
  return _glowGeo;
}
function getGlowMat() {
  if (!_glowMat) {
    _glowMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.8,
      transparent: true, opacity: 0.4, roughness: 0.5,
    });
    _glowMat._shared = true;
  }
  return _glowMat;
}

export function createCoin() {
  const group = new THREE.Group();
  group.name = 'coin';

  const coinMesh = new THREE.Mesh(getCoinGeo(), getCoinMat());
  coinMesh.rotation.z = Math.PI / 2;
  coinMesh.castShadow = true;
  group.add(coinMesh);

  const glowMesh = new THREE.Mesh(getGlowGeo(), getGlowMat());
  glowMesh.rotation.y = Math.PI / 2;
  group.add(glowMesh);

  group.userData.baseY = 0;
  group.userData.animate = (time) => {
    group.position.y = group.userData.baseY + Math.sin(time * 3) * 0.08;
    coinMesh.rotation.y += 0.03;
  };

  return group;
}