// ══════════════════════════════════════════════
// GRID SYSTEM — Manages tile placement & lookup
// ══════════════════════════════════════════════

import * as THREE from 'three/webgpu';

export let TILE_SIZE = 1.0;
export let TILE_GAP = 0.0;
export let TILE_HEIGHT = 0.08;

export function setTileSize(v) {
  TILE_SIZE = v;
}
export function setTileGap(v) {
  TILE_GAP = v;
}

export class Grid {
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.cells = new Map();
    this.group = new THREE.Group();
    this.group.name = 'grid';
  }

  key(r, c) {
    return `${r},${c}`;
  }

  worldPos(r, c) {
    const step = TILE_SIZE + TILE_GAP;
    const offsetR = (this.rows - 1) * step * 0.5;
    const offsetC = (this.cols - 1) * step * 0.5;
    return new THREE.Vector3(
      c * step - offsetC,
      0,
      r * step - offsetR
    );
  }

  set(r, c, obj) {
    this.cells.set(this.key(r, c), obj);
  }

  get(r, c) {
    return this.cells.get(this.key(r, c)) || null;
  }

  has(r, c) {
    return this.cells.has(this.key(r, c));
  }

  addToScene(scene) {
    scene.add(this.group);
  }
}