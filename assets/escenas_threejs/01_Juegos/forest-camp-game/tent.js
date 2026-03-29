// ══════════════════════════════════════════════
// TENT — Camp tent with sign
// ══════════════════════════════════════════════

import * as THREE from 'three';

export function createTent() {
  const group = new THREE.Group();
  group.name = 'tent';

  // Tent body — triangular prism via extrude
  const tentShape = new THREE.Shape();
  tentShape.moveTo(-0.35, 0);
  tentShape.lineTo(0.35, 0);
  tentShape.lineTo(0, 0.45);
  tentShape.closePath();

  const tentGeoIndexed = new THREE.ExtrudeGeometry(tentShape, {
    depth: 0.55,
    bevelEnabled: false,
  });
  const tentGeo = tentGeoIndexed.index ? tentGeoIndexed.toNonIndexed() : tentGeoIndexed.clone();
  tentGeo.computeVertexNormals();
  tentGeoIndexed.dispose();
  const tentMat = new THREE.MeshStandardMaterial({
    color: 0xf0a832,
    roughness: 0.65,
    metalness: 0.0,
  });
  const tentMesh = new THREE.Mesh(tentGeo, tentMat);
  tentMesh.position.set(0, 0, -0.275);
  tentMesh.castShadow = true;
  tentMesh.receiveShadow = true;
  group.add(tentMesh);

  // Door — smaller darker triangle on front face
  const doorShape = new THREE.Shape();
  doorShape.moveTo(-0.13, 0);
  doorShape.lineTo(0.13, 0);
  doorShape.lineTo(0, 0.25);
  doorShape.closePath();
  const doorGeo = new THREE.ShapeGeometry(doorShape);
  doorGeo.computeVertexNormals();
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0xb07418,
    roughness: 0.7,
    metalness: 0.0,
  });
  const doorMesh = new THREE.Mesh(doorGeo, doorMat);
  doorMesh.name = 'tentDoor';
  doorMesh.position.set(0, 0.001, 0.276);
  doorMesh.castShadow = false;
  doorMesh.receiveShadow = false;
  group.add(doorMesh);

  // Sign post
  const postGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.9 });
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.set(0.35, 0.11, 0.1);
  post.castShadow = true;
  group.add(post);

  // Sign board
  const signGeo = new THREE.BoxGeometry(0.22, 0.07, 0.02);
  const signMat = new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.85 });
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(0.35, 0.2, 0.1);
  sign.castShadow = true;
  group.add(sign);

  // "CAMP" text — canvas texture
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#5c3d1e';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CAMP', 64, 32);
  const signTexture = new THREE.CanvasTexture(canvas);
  const signFaceGeo = new THREE.PlaneGeometry(0.2, 0.06);
  const signFaceMat = new THREE.MeshStandardMaterial({ map: signTexture, roughness: 0.7 });
  const signFace = new THREE.Mesh(signFaceGeo, signFaceMat);
  signFace.position.set(0.35, 0.2, 0.115);
  group.add(signFace);

  return group;
}