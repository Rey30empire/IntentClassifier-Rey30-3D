// ══════════════════════════════════════════════
// CHARACTER — Player sphere with floating animation
// ══════════════════════════════════════════════

import * as THREE from 'three/webgpu';

export function createCharacter() {
  const group = new THREE.Group();
  group.name = 'player-character';

  // Main body — glowing sphere
  const bodyGeo = new THREE.SphereGeometry(0.22, 20, 16);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x44aaff,
    roughness: 0.15,
    metalness: 0.1,
    emissive: 0x2266cc,
    emissiveIntensity: 0.3,
    envMapIntensity: 1.5,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.name = 'player-body';
  body.castShadow = true;
  group.add(body);

  // Inner glow core
  const coreGeo = new THREE.SphereGeometry(0.12, 12, 10);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x88ccff,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.6,
    roughness: 0.1,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.name = 'player-core';
  group.add(core);

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.045, 8, 6);
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111122 });
  const eyeWhiteGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const eyeWhiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

  const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
  leftEyeWhite.position.set(-0.08, 0.06, 0.18);
  leftEyeWhite.name = 'player-eye-white-l';
  group.add(leftEyeWhite);

  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.08, 0.06, 0.21);
  leftEye.name = 'player-eye-l';
  group.add(leftEye);

  const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
  rightEyeWhite.position.set(0.08, 0.06, 0.18);
  rightEyeWhite.name = 'player-eye-white-r';
  group.add(rightEyeWhite);

  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.08, 0.06, 0.21);
  rightEye.name = 'player-eye-r';
  group.add(rightEye);

  // Shadow disc underneath
  const shadowGeo = new THREE.CircleGeometry(0.2, 12);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.35;
  shadow.name = 'player-shadow';
  group.add(shadow);

  // Cap on top of head
  const capGroup = new THREE.Group();
  capGroup.name = 'player-cap';

  // Cap brim (flat disc)
  const brimGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.025, 12);
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xee3333,
    roughness: 0.6,
    metalness: 0.0,
  });
  const brim = new THREE.Mesh(brimGeo, capMat);
  brim.name = 'cap-brim';
  capGroup.add(brim);

  // Cap dome (top part)
  const domeGeo = new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, capMat);
  dome.position.y = 0.01;
  dome.name = 'cap-dome';
  capGroup.add(dome);

  // Cap button on top
  const buttonGeo = new THREE.SphereGeometry(0.035, 12, 12);
  const buttonMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
  });
  const button = new THREE.Mesh(buttonGeo, buttonMat);
  button.position.y = 0.155;
  button.name = 'cap-button';
  capGroup.add(button);

  capGroup.position.y = 0.14;
  capGroup.rotation.set(0, 0, 0);  // no angle, sitting flat
  group.add(capGroup);

  // Floating animation data
  group.userData.floatOffset = Math.random() * Math.PI * 2;

  group.userData.animate = (time) => {
    const t = time + group.userData.floatOffset;
    const floatY = Math.sin(t * 2.0) * 0.06;
    body.position.y = floatY;
    core.position.y = floatY;
    leftEyeWhite.position.y = 0.06 + floatY;
    leftEye.position.y = 0.06 + floatY;
    rightEyeWhite.position.y = 0.06 + floatY;
    rightEye.position.y = 0.06 + floatY;
    capGroup.position.y = 0.15 + floatY;
    const squash = 1.0 + Math.sin(t * 2.0) * 0.04;
    body.scale.set(1.0 / squash, squash, 1.0 / squash);
    const h = Math.sin(t * 2.0) * 0.06;
    shadow.scale.setScalar(1.0 - h * 1.5);
    shadow.material.opacity = 0.25 - h * 0.3;
  };

  return group;
}