// ══════════════════════════════════════════════
// TILE — Beveled board tiles with plastic material
// ══════════════════════════════════════════════

import * as THREE from 'three/webgpu';
import { TILE_SIZE, TILE_HEIGHT } from './grid.js';

export const TILE_COLORS = {
  star:     0xe4b50c,
  green:    0x17ab30,
  blue:     0x00a6ff,
  white:    0xf5f5f0,
  orange:   0xe8953a,
  skull:    0x2a2a3a,
  arrow:    0x258203,
  gem:      0x9b30ff,
  ice:      0xa8e8ff,
  portal:   0xff2f92,
  dice:     0xf5f5f5,
};

// ── Update a tile color at runtime ──
export function setTileColor(type, hexInt) {
  const oldHex = TILE_COLORS[type];
  TILE_COLORS[type] = hexInt;
  if (_matCache.has(oldHex)) {
    const mat = _matCache.get(oldHex);
    mat.color.setHex(hexInt);
    mat.needsUpdate = true;
    _matCache.delete(oldHex);
    _matCache.set(hexInt, mat);
  }
}

// ── Cache for rounded-rect extruded geometry per type (they share shape) ──
let _cachedTileGeo = null;

// Allow main.js to clear the cache on rebuild
window.__clearTileGeoCache = function () {
  if (_cachedTileGeo) {
    _cachedTileGeo.dispose();
    _cachedTileGeo = null;
  }
};

function createRoundedRectShape(w, h, r) {
  const shape = new THREE.Shape();
  const hw = w / 2, hh = h / 2;
  r = Math.min(r, hw, hh);
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
}

function getTileGeo() {
  if (_cachedTileGeo) return _cachedTileGeo;

  const faceSize = TILE_SIZE * 0.88;
  const cornerR = TILE_SIZE * 0.09;
  const shape = createRoundedRectShape(faceSize, faceSize, cornerR);

  const indexedGeo = new THREE.ExtrudeGeometry(shape, {
    depth: TILE_HEIGHT,
    bevelEnabled: true,
    bevelThickness: TILE_HEIGHT * 0.35,
    bevelSize: TILE_SIZE * 0.04,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: 6,
  });

  // Rotate so extrusion goes along Y
  indexedGeo.rotateX(-Math.PI / 2);

  // Convert to non-indexed for WebGPU compatibility
  _cachedTileGeo = indexedGeo.index ? indexedGeo.toNonIndexed() : indexedGeo.clone();
  _cachedTileGeo.computeVertexNormals();
  indexedGeo.dispose();

  return _cachedTileGeo;
}

// ── Shared plastic materials per color (cached) ──
const _matCache = new Map();

function getPlasticMat(hex) {
  if (_matCache.has(hex)) return _matCache.get(hex);

  const mat = new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.22,
    metalness: 0.05,
    envMapIntensity: 1.2,
    flatShading: false,
  });
  _matCache.set(hex, mat);
  return mat;
}

// ── White plastic for icons ──
let _iconMat = null;
function getIconMat() {
  if (_iconMat) return _iconMat;
  _iconMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.25,
    metalness: 0.05,
    envMapIntensity: 1.0,
  });
  return _iconMat;
}

// ══════════════════════════════════════════════
// ── CREATE TILE ──
// ══════════════════════════════════════════════

export function createTile(type = 'blue') {
  const group = new THREE.Group();
  group.name = `tile_${type}`;

  const colorHex = TILE_COLORS[type] || TILE_COLORS.blue;

  // ── Base tile: beveled rounded rect extruded ──
  const geo = getTileGeo();
  const mat = getPlasticMat(colorHex);
  const baseMesh = new THREE.Mesh(geo, mat);
  baseMesh.name = `tile_base_${type}`;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Scale factor relative to tile size
  const S = TILE_SIZE;
  const topY = TILE_HEIGHT + TILE_HEIGHT * 0.35; // top of bevel
  const iconMat = getIconMat();

  // ── Icon decorations ──
  if (type === 'star') {
    const starShape = createStarShape(0.18 * S, 0.09 * S, 5);
    const starGeoIdx = new THREE.ExtrudeGeometry(starShape, {
      depth: 0.025 * S, bevelEnabled: true,
      bevelThickness: 0.008 * S, bevelSize: 0.008 * S, bevelSegments: 2,
    });
    const starGeo = starGeoIdx.index ? starGeoIdx.toNonIndexed() : starGeoIdx.clone(); starGeo.computeVertexNormals(); starGeoIdx.dispose();
    const starMesh = new THREE.Mesh(starGeo, iconMat);
    starMesh.rotation.x = -Math.PI / 2;
    starMesh.position.y = topY + 0.002;
    group.add(starMesh);
  }

  if (type === 'arrow') {
    const arrowShape = createArrowShape(S);
    const arrowGeoIdx = new THREE.ExtrudeGeometry(arrowShape, {
      depth: 0.018 * S, bevelEnabled: true,
      bevelThickness: 0.006 * S, bevelSize: 0.006 * S, bevelSegments: 2,
    });
    const arrowGeo = arrowGeoIdx.index ? arrowGeoIdx.toNonIndexed() : arrowGeoIdx.clone(); arrowGeo.computeVertexNormals(); arrowGeoIdx.dispose();
    const arrowMesh = new THREE.Mesh(arrowGeo, iconMat);
    arrowMesh.rotation.x = -Math.PI / 2;
    arrowMesh.position.y = topY + 0.002;
    group.add(arrowMesh);
  }

  if (type === 'skull') {
    const dotGeo = new THREE.SphereGeometry(0.055 * S, 12, 12);
    const dot1 = new THREE.Mesh(dotGeo, iconMat);
    dot1.position.set(-0.1 * S, topY + 0.03 * S, -0.05 * S);
    group.add(dot1);
    const dot2 = new THREE.Mesh(dotGeo, iconMat);
    dot2.position.set(0.1 * S, topY + 0.03 * S, -0.05 * S);
    group.add(dot2);

    const boneGeo = new THREE.CylinderGeometry(0.018 * S, 0.018 * S, 0.32 * S, 6);
    const bone1 = new THREE.Mesh(boneGeo, iconMat);
    bone1.rotation.z = Math.PI / 4;
    bone1.position.set(0, topY + 0.025 * S, 0.1 * S);
    bone1.rotation.x = -Math.PI / 2;
    group.add(bone1);
    const bone2 = new THREE.Mesh(boneGeo, iconMat);
    bone2.rotation.z = -Math.PI / 4;
    bone2.position.set(0, topY + 0.025 * S, 0.1 * S);
    bone2.rotation.x = -Math.PI / 2;
    group.add(bone2);
  }

  if (type === 'green') {
    const fpGeo = new THREE.CapsuleGeometry(0.038 * S, 0.09 * S, 4, 8);
    const fp1 = new THREE.Mesh(fpGeo, iconMat);
    fp1.position.set(-0.08 * S, topY + 0.005, 0);
    fp1.rotation.x = -Math.PI / 2;
    fp1.rotation.z = 0.2;
    group.add(fp1);
    const fp2 = new THREE.Mesh(fpGeo, iconMat);
    fp2.position.set(0.08 * S, topY + 0.005, 0.05 * S);
    fp2.rotation.x = -Math.PI / 2;
    fp2.rotation.z = -0.2;
    group.add(fp2);
  }

  if (type === 'gem') {
    const diamondShape = createDiamondShape(0.14 * S, 0.22 * S);
    const diamondGeoIdx = new THREE.ExtrudeGeometry(diamondShape, {
      depth: 0.03 * S, bevelEnabled: true,
      bevelThickness: 0.008 * S, bevelSize: 0.008 * S, bevelSegments: 2,
    });
    const diamondGeo = diamondGeoIdx.index ? diamondGeoIdx.toNonIndexed() : diamondGeoIdx.clone(); diamondGeo.computeVertexNormals(); diamondGeoIdx.dispose();
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 0.1,
      emissive: 0xcc88ff,
      emissiveIntensity: 0.3,
    });
    const diamond = new THREE.Mesh(diamondGeo, gemMat);
    diamond.rotation.x = -Math.PI / 2;
    diamond.position.y = topY + 0.002;
    diamond.name = 'gem-icon';
    group.add(diamond);
  }

  if (type === 'ice') {
    const barGeo = new THREE.BoxGeometry(0.28 * S, 0.02 * S, 0.04 * S);
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.0,
      emissive: 0x88ddff,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.85,
    });
    for (let i = 0; i < 3; i++) {
      const bar = new THREE.Mesh(barGeo, iceMat);
      bar.position.y = topY + 0.015;
      bar.rotation.y = (i * Math.PI) / 3;
      bar.name = `ice-bar-${i}`;
      group.add(bar);
    }
  }

  if (type === 'portal') {
    const ringGeo = new THREE.TorusGeometry(0.14 * S, 0.025 * S, 8, 24);
    const portalMat = new THREE.MeshStandardMaterial({
      color: 0xff66cc,
      roughness: 0.1,
      metalness: 0.2,
      emissive: 0xff2288,
      emissiveIntensity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeo, portalMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = topY + 0.03;
    ring.name = 'portal-ring';
    group.add(ring);
    // Inner dot
    const dotGeo = new THREE.SphereGeometry(0.05 * S, 12, 12);
    const dot = new THREE.Mesh(dotGeo, portalMat);
    dot.position.y = topY + 0.03;
    dot.name = 'portal-dot';
    group.add(dot);
  }

  if (type === 'dice') {
    // Mini dice icon on the tile
    const diceIconSize = 0.12 * S;
    const diceIconGeo = new THREE.BoxGeometry(diceIconSize, diceIconSize, diceIconSize);
    const diceIconMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.15, metalness: 0.03,
    });
    const diceIcon = new THREE.Mesh(diceIconGeo, diceIconMat);
    diceIcon.position.set(-0.08 * S, topY + diceIconSize * 0.5 + 0.005, 0);
    diceIcon.rotation.y = 0.3;
    diceIcon.name = 'dice-icon-1';
    group.add(diceIcon);

    const diceIcon2 = new THREE.Mesh(diceIconGeo, diceIconMat);
    diceIcon2.position.set(0.08 * S, topY + diceIconSize * 0.5 + 0.005, 0.04 * S);
    diceIcon2.rotation.y = -0.2;
    diceIcon2.name = 'dice-icon-2';
    group.add(diceIcon2);

    // Dots on the mini dice
    const miniDotGeo = new THREE.SphereGeometry(0.015 * S, 6, 6);
    const miniDotMat = new THREE.MeshStandardMaterial({ color: 0x2255aa, roughness: 0.35 });
    const dh = diceIconSize * 0.5 + 0.002;
    // Top face dots on first dice (showing 5)
    [[-1,-1],[1,-1],[0,0],[-1,1],[1,1]].forEach(([a,b]) => {
      const dd = new THREE.Mesh(miniDotGeo, miniDotMat);
      const spacing = diceIconSize * 0.22;
      dd.position.set(
        diceIcon.position.x + a * spacing,
        diceIcon.position.y + dh,
        diceIcon.position.z + b * spacing
      );
      group.add(dd);
    });
  }

  return group;
}

// ══════════════════════════════════════════════
// ── SHAPE HELPERS ──
// ══════════════════════════════════════════════

function createStarShape(outerR, innerR, points) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createArrowShape(scale = 1) {
  const k = scale;
  const s = new THREE.Shape();
  s.moveTo(0, 0.15 * k);
  s.lineTo(0.12 * k, 0);
  s.lineTo(0.05 * k, 0);
  s.lineTo(0.05 * k, -0.15 * k);
  s.lineTo(-0.05 * k, -0.15 * k);
  s.lineTo(-0.05 * k, 0);
  s.lineTo(-0.12 * k, 0);
  s.closePath();
  return s;
}

function createDiamondShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(0, h / 2);
  s.lineTo(w / 2, 0);
  s.lineTo(0, -h / 2);
  s.lineTo(-w / 2, 0);
  s.closePath();
  return s;
}