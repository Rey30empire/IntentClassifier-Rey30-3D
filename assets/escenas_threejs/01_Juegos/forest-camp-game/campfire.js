// ══════════════════════════════════════════════
// CAMPFIRE — Fire pit with animated flames (shared geo/mat)
// ══════════════════════════════════════════════

import * as THREE from 'three';

let _stoneGeo, _stoneMat, _logGeo, _logMat, _flameGeo, _flameMat, _innerFlameGeo, _innerFlameMat;

function init() {
  if (_stoneGeo) return;
  _stoneGeo = new THREE.SphereGeometry(0.04, 5, 4);
  _stoneMat = new THREE.MeshLambertMaterial({ color: 0x777777 }); _stoneMat._shared = true;
  _logGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.18, 5);
  _logMat = new THREE.MeshLambertMaterial({ color: 0x5c3820 }); _logMat._shared = true;
  _flameGeo = new THREE.ConeGeometry(0.03, 0.12, 5);
  _flameMat = new THREE.MeshStandardMaterial({
    color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 2.0,
    roughness: 0.5, transparent: true, opacity: 0.9,
  }); _flameMat._shared = true;
  _innerFlameGeo = new THREE.ConeGeometry(0.015, 0.08, 4);
  _innerFlameMat = new THREE.MeshStandardMaterial({
    color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 3.0,
    transparent: true, opacity: 0.85,
  }); _innerFlameMat._shared = true;
}

export function createCampfire() {
  init();
  const group = new THREE.Group();
  group.name = 'campfire';

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(_stoneGeo, _stoneMat);
    stone.position.set(Math.cos(angle) * 0.1, 0.03, Math.sin(angle) * 0.1);
    stone.scale.set(1, 0.6, 1);
    stone.receiveShadow = true;
    group.add(stone);
  }

  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(_logGeo, _logMat);
    log.position.set(0, 0.03, 0);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI * 2;
    group.add(log);
  }

  const flames = [];
  // Use same flameMat for all outer flames — no clone needed since we only animate transform
  for (let i = 0; i < 4; i++) {
    const flame = new THREE.Mesh(_flameGeo, _flameMat);
    flame.position.set((Math.random() - 0.5) * 0.06, 0.08, (Math.random() - 0.5) * 0.06);
    flame.castShadow = false;
    flames.push(flame);
    group.add(flame);
  }

  const innerFlame = new THREE.Mesh(_innerFlameGeo, _innerFlameMat);
  innerFlame.position.y = 0.1;
  flames.push(innerFlame);
  group.add(innerFlame);

  const fireLight = new THREE.PointLight(0xff6622, 1.5, 2.0);
  fireLight.position.y = 0.15;
  fireLight.castShadow = false;
  group.add(fireLight);

  group.userData.animate = (time) => {
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i], offset = i * 1.7;
      f.scale.y = 0.8 + Math.sin(time * 8 + offset) * 0.4;
      f.scale.x = 0.8 + Math.sin(time * 6 + offset + 1) * 0.2;
      f.position.y = 0.08 + Math.sin(time * 7 + offset) * 0.02;
    }
    fireLight.intensity = 1.2 + Math.sin(time * 10) * 0.4;
  };

  return group;
}