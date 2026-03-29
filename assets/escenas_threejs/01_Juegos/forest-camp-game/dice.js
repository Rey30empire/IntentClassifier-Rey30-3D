// ══════════════════════════════════════════════
// DICE — 3D beveled dice with dots (shared geo/mat)
// ══════════════════════════════════════════════

import * as THREE from 'three/webgpu';

// ── Shared resources ──
let _diceGeo = null, _diceMat = null, _dotGeo = null, _dotMat = null;

function getDiceGeo() {
  if (_diceGeo) return _diceGeo;
  const size = 0.18, half = size * 0.5, bevelR = 0.025;
  const shape = new THREE.Shape();
  const w = size - bevelR * 2, x0 = -half + bevelR, y0 = -half + bevelR;
  shape.moveTo(x0, -half);
  shape.lineTo(x0 + w, -half);
  shape.quadraticCurveTo(half, -half, half, y0);
  shape.lineTo(half, y0 + w);
  shape.quadraticCurveTo(half, half, x0 + w, half);
  shape.lineTo(x0, half);
  shape.quadraticCurveTo(-half, half, -half, y0 + w);
  shape.lineTo(-half, y0);
  shape.quadraticCurveTo(-half, -half, x0, -half);
  let geo = new THREE.ExtrudeGeometry(shape, {
    depth: size, bevelEnabled: true, bevelThickness: bevelR,
    bevelSize: bevelR, bevelOffset: 0, bevelSegments: 4,
  });
  geo.translate(0, 0, -half);
  _diceGeo = geo.index ? geo.toNonIndexed() : geo.clone();
  _diceGeo.computeVertexNormals();
  geo.dispose();
  return _diceGeo;
}
function getDiceMat() {
  if (!_diceMat) { _diceMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.15, metalness: 0.03 }); _diceMat._shared = true; }
  return _diceMat;
}
function getDotGeo() {
  if (!_dotGeo) _dotGeo = new THREE.SphereGeometry(0.026, 8, 8);
  return _dotGeo;
}
function getDotMat() {
  if (!_dotMat) { _dotMat = new THREE.MeshStandardMaterial({ color: 0x2255aa, roughness: 0.35 }); _dotMat._shared = true; }
  return _dotMat;
}

export function createDice(value = 5) {
  const group = new THREE.Group();
  group.name = 'dice_' + value;

  const size = 0.18, half = size * 0.5, bevelR = 0.025;

  const diceMesh = new THREE.Mesh(getDiceGeo(), getDiceMat());
  diceMesh.name = 'diceBody_' + value;
  diceMesh.castShadow = true;
  diceMesh.receiveShadow = true;
  group.add(diceMesh);

  const dotGeo = getDotGeo(), dotMat = getDotMat();
  const hs = half + bevelR * 0.5 + 0.002;
  const d = size * 0.24;

  const faces = {
    1: { normal: [0, 0, 1], dots: [[0, 0]] },
    2: { normal: [1, 0, 0], dots: [[-d, d], [d, -d]] },
    3: { normal: [0, 1, 0], dots: [[-d, d], [0, 0], [d, -d]] },
    4: { normal: [-1, 0, 0], dots: [[-d, -d], [-d, d], [d, -d], [d, d]] },
    5: { normal: [0, 0, -1], dots: [[-d, -d], [-d, d], [0, 0], [d, -d], [d, d]] },
    6: { normal: [0, -1, 0], dots: [[-d, -d], [-d, 0], [-d, d], [d, -d], [d, 0], [d, d]] },
  };

  Object.entries(faces).forEach(([val, face]) => {
    const [nx, ny, nz] = face.normal;
    face.dots.forEach(([a, b]) => {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      if (nx !== 0) dot.position.set(nx * hs, a, b);
      else if (ny !== 0) dot.position.set(a, ny * hs, b);
      else dot.position.set(a, b, nz * hs);
      group.add(dot);
    });
  });

  group.userData.animate = null;
  return group;
}