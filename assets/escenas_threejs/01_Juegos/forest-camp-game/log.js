// ══════════════════════════════════════════════
// LOG — Wooden log & stump decorations (shared geo/mat)
// ══════════════════════════════════════════════

import * as THREE from 'three';

let _logGeo, _logMat, _ringGeo, _ringMat, _stumpGeo, _stumpMat, _topGeo, _topMat;

function initLog() {
  if (_logGeo) return;
  _logGeo = new THREE.CylinderGeometry(0.05, 0.055, 0.35, 8);
  _logMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a }); _logMat._shared = true;
  _ringGeo = new THREE.CircleGeometry(0.05, 8);
  _ringMat = new THREE.MeshLambertMaterial({ color: 0x9a7a5a }); _ringMat._shared = true;
}

function initStump() {
  if (_stumpGeo) return;
  _stumpGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.12, 8);
  _stumpMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.85, flatShading: true }); _stumpMat._shared = true;
  _topGeo = new THREE.CircleGeometry(0.065, 8);
  _topMat = new THREE.MeshLambertMaterial({ color: 0x9a7a5a }); _topMat._shared = true;
}

export function createLog() {
  initLog();
  const group = new THREE.Group();
  group.name = 'log';

  const logMesh = new THREE.Mesh(_logGeo, _logMat);
  logMesh.rotation.z = Math.PI / 2;
  logMesh.position.y = 0.055;
  logMesh.castShadow = true;
  logMesh.receiveShadow = true;
  group.add(logMesh);

  const ring1 = new THREE.Mesh(_ringGeo, _ringMat);
  ring1.position.set(0.175, 0.055, 0);
  ring1.rotation.y = Math.PI / 2;
  group.add(ring1);
  const ring2 = new THREE.Mesh(_ringGeo, _ringMat);
  ring2.position.set(-0.175, 0.055, 0);
  ring2.rotation.y = -Math.PI / 2;
  group.add(ring2);

  return group;
}

export function createStump() {
  initStump();
  const group = new THREE.Group();
  group.name = 'stump';

  const stump = new THREE.Mesh(_stumpGeo, _stumpMat);
  stump.position.y = 0.06;
  stump.castShadow = true;
  stump.receiveShadow = true;
  group.add(stump);

  const top = new THREE.Mesh(_topGeo, _topMat);
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.121;
  group.add(top);

  return group;
}