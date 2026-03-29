// ══════════════════════════════════════════════
// SCENE — Main landscape setup & board layout
// Figure-8 shaped board path with pond on right
// ══════════════════════════════════════════════

import * as THREE from 'three/webgpu';
import { Grid, TILE_SIZE, TILE_GAP, TILE_HEIGHT } from './grid.js';
import { createTile } from './tile.js';
import { createCoin } from './coin.js';
import { buildTreeInstances } from './tree.js';
import { createTent } from './tent.js';
import { createCampfire } from './campfire.js';
import { buildDuckPond } from './pond.js';
import { createFlower } from './flower.js';
import { createMushroom } from './mushroom.js';
import { createLog, createStump } from './log.js';
import { createRock } from './rock.js';
import { buildGrassPatches } from './grass.js';
import { createDice } from './dice.js';

export function buildScene(scene) {
  const animatedObjects = [];
  // 8 rows × 12 cols grid to accommodate the figure-8
  const grid = new Grid(8, 12);
  grid.addToScene(scene);

  const step = TILE_SIZE + TILE_GAP;

  // ── Ground plane ──
  const groundGeo = new THREE.PlaneGeometry(30, 30);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x7ec850 });
  groundMat._shared = true;
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  ground.name = 'ground';
  ground.matrixAutoUpdate = false;
  ground.updateMatrix();
  scene.add(ground);

  // ── Raised grass island ──
  const islandGeo = new THREE.BoxGeometry(13, 0.3, 10);
  const islandMat = new THREE.MeshStandardMaterial({ color: 0x6db844, roughness: 0.72, metalness: 0.0 });
  islandMat._shared = true;
  const island = new THREE.Mesh(islandGeo, islandMat);
  island.position.y = -0.15;
  island.castShadow = true;
  island.receiveShadow = true;
  island.name = 'island';
  island.matrixAutoUpdate = false;
  island.updateMatrix();
  scene.add(island);

  // Dirt layer underneath
  const dirtGeo = new THREE.BoxGeometry(12.9, 0.15, 9.9);
  const dirtMat = new THREE.MeshLambertMaterial({ color: 0x8b6d3a });
  dirtMat._shared = true;
  const dirt = new THREE.Mesh(dirtGeo, dirtMat);
  dirt.position.y = -0.38;
  dirt.castShadow = true;
  dirt.name = 'dirt';
  dirt.matrixAutoUpdate = false;
  dirt.updateMatrix();
  scene.add(dirt);

  // ══════════════════════════════════════════════
  // ── FIGURE-8 BOARD TILE LAYOUT ──
  //
  // The board forms a figure-8 (infinity ∞) shape:
  //   Left loop (cols 1-5) + crossing bridge + Right loop (cols 6-10)
  //   The pond sits inside the right loop (2×2 cells at rows 3-4, cols 8-9)
  //
  // ══════════════════════════════════════════════

  const boardPath = [
    // ── LEFT LOOP — Top row (left to right) ──
    { r: 1, c: 1, type: 'blue' },
    { r: 1, c: 2, type: 'star' },
    { r: 1, c: 3, type: 'white' },
    { r: 1, c: 4, type: 'blue' },
    { r: 1, c: 5, type: 'green' },

    // ── LEFT LOOP — Right side going down ──
    { r: 2, c: 5, type: 'white' },
    { r: 3, c: 5, type: 'blue' },

    // ── CROSSING bridge tiles ──
    { r: 3, c: 6, type: 'white' },

    // ── LEFT LOOP — Bottom row (right to left) ──
    { r: 5, c: 5, type: 'orange' },
    { r: 5, c: 4, type: 'white' },
    { r: 5, c: 3, type: 'star' },
    { r: 5, c: 2, type: 'blue' },
    { r: 5, c: 1, type: 'white' },

    // ── LEFT LOOP — Left side (bottom to top) ──
    { r: 4, c: 1, type: 'blue' },
    { r: 3, c: 1, type: 'star' },
    { r: 2, c: 1, type: 'white' },

    // ── LEFT LOOP — Inner tiles (middle row) ──
    { r: 3, c: 2, type: 'white' },
    { r: 3, c: 3, type: 'star' },
    { r: 3, c: 4, type: 'blue' },

    // ── LEFT LOOP — connecting down from crossing ──
    { r: 4, c: 5, type: 'white' },

    // ── RIGHT LOOP — Top row (left to right) ──
    { r: 1, c: 6, type: 'white' },
    { r: 1, c: 7, type: 'arrow' },
    { r: 1, c: 8, type: 'blue' },
    { r: 1, c: 9, type: 'white' },
    { r: 1, c: 10, type: 'star' },

    // ── RIGHT LOOP — Right side (top to bottom) ──
    { r: 2, c: 10, type: 'white' },
    { r: 3, c: 10, type: 'skull' },
    { r: 4, c: 10, type: 'blue' },

    // ── RIGHT LOOP — Bottom row (right to left) ──
    { r: 5, c: 10, type: 'white' },
    { r: 5, c: 9, type: 'blue' },
    { r: 5, c: 8, type: 'orange' },
    { r: 5, c: 7, type: 'white' },
    { r: 5, c: 6, type: 'star' },

    // ── RIGHT LOOP — Left side (bottom to top) ──
    { r: 4, c: 6, type: 'arrow' },
    { r: 3, c: 7, type: 'white' },
    { r: 2, c: 6, type: 'blue' },
  ];

  boardPath.forEach(({ r, c, type }) => {
    const tile = createTile(type);
    const pos = grid.worldPos(r, c);
    tile.position.copy(pos);
    grid.set(r, c, tile);
    grid.group.add(tile);
  });

  // ── COINS along the path (skip skull tiles) ──
  const coinPositions = [
    { r: 1, c: 1 }, { r: 1, c: 4 }, { r: 5, c: 3 },
    { r: 3, c: 1 }, { r: 1, c: 8 }, { r: 1, c: 10 },
    { r: 5, c: 9 }, { r: 5, c: 6 },
    { r: 3, c: 3 }, { r: 5, c: 5 },
  ].filter(({ r, c }) => {
    const tileDef = boardPath.find(t => t.r === r && t.c === c);
    return !tileDef || tileDef.type !== 'skull';
  });
  const tileTopY = TILE_HEIGHT + TILE_HEIGHT * 0.35 + 0.02; // top of bevel + small gap
  coinPositions.forEach(({ r, c }) => {
    const coin = createCoin();
    const pos = grid.worldPos(r, c);
    const baseY = tileTopY + 0.45; // float well above tile surface
    coin.position.set(pos.x, baseY, pos.z);
    coin.userData.baseY = baseY;
    grid.group.add(coin);
    animatedObjects.push(coin);
  });

  // ══════════════════════════════════════════════
  // ── POND — inside right loop (2×2 cells) ──
  // Center between cells (2,8), (2,9), (3,8), (3,9)
  // ══════════════════════════════════════════════

  const pondCellSize = step;
  const pond = buildDuckPond({
    seed: 42,
    cellsW: 2,
    cellsD: 2,
    cellSize: pondCellSize,
  });
  // Center the pond on the 2×2 area
  const p1 = grid.worldPos(2, 8);
  const p2 = grid.worldPos(4, 9);
  const pondCX = (p1.x + p2.x) * 0.5;
  const pondCZ = (p1.z + p2.z) * 0.5;
  pond.position.set(pondCX, 0.04, pondCZ);
  pond.name = 'pond';
  grid.group.add(pond);

  // ── DECORATIVE DICE — laid down near the campfire ──
  {
    const diceScale = 2.2;
    const groundY = 0.18 * diceScale * 0.5 + 0.02;

    // Dice 1 — showing 5, slightly tilted and laid on the ground
    const d1 = createDice(5);
    const d1Pos = grid.worldPos(4, 3);
    d1.position.set(d1Pos.x - 0.15, groundY, d1Pos.z + 0.1);
    d1.scale.setScalar(diceScale);
    d1.rotation.set(Math.PI / 2, 0.3, 0.05); // laid on side, face 5 up
    d1.name = 'decor-dice-1';
    grid.group.add(d1);

    // Dice 2 — showing 3, slightly offset and rotated differently
    const d2 = createDice(3);
    const d2Pos = grid.worldPos(4, 3);
    d2.position.set(d2Pos.x + 0.25, groundY, d2Pos.z - 0.15);
    d2.scale.setScalar(diceScale);
    d2.rotation.set(-Math.PI / 2, -0.2, 0.08); // laid on opposite side, face 3 up
    d2.name = 'decor-dice-2';
    grid.group.add(d2);
  }

  // ── TENT — above the left loop, spans ~2 tiles ──
  const tent = createTent();
  const tentPos = grid.worldPos(0, 3);
  tent.position.set(tentPos.x + 0.3, 0.06, tentPos.z - 0.8);
  tent.rotation.y = -0.3;
  tent.scale.setScalar(2.8);
  tent.matrixAutoUpdate = false;
  tent.updateMatrix();
  grid.group.add(tent);

  // ── CAMPFIRE — near the tent ──
  const campfire = createCampfire();
  const cfPos = grid.worldPos(0, 5);
  campfire.position.set(cfPos.x, 0.06, cfPos.z + 0.1);
  campfire.scale.setScalar(2.2);
  grid.group.add(campfire);
  animatedObjects.push(campfire);



  // ══════════════════════════════════════════════
  // ── DECORATIONS: Trees, Flowers, Mushrooms ──
  // ══════════════════════════════════════════════

  // Helper: check if a world position overlaps any tile cell
  // Uses a radius (in cells) to account for tree trunk/canopy footprint
  function isOnTile(worldX, worldZ, radiusCells = 0) {
    const step = TILE_SIZE + TILE_GAP;
    const offsetR = (grid.rows - 1) * step * 0.5;
    const offsetC = (grid.cols - 1) * step * 0.5;
    // Convert world position to grid row/col
    const col = Math.round((worldX + offsetC) / step);
    const row = Math.round((worldZ + offsetR) / step);
    // Check the cell and its neighbors within radiusCells
    for (let dr = -radiusCells; dr <= radiusCells; dr++) {
      for (let dc = -radiusCells; dc <= radiusCells; dc++) {
        if (grid.has(row + dr, col + dc)) return true;
      }
    }
    return false;
  }

  // (isNearDice removed — decorative dice are now board tiles)

  // Also check if position overlaps the pond area (2×2 cells at rows 2-4, cols 8-9)
  function isOnPond(worldX, worldZ) {
    const step = TILE_SIZE + TILE_GAP;
    const offsetR = (grid.rows - 1) * step * 0.5;
    const offsetC = (grid.cols - 1) * step * 0.5;
    const col = (worldX + offsetC) / step;
    const row = (worldZ + offsetR) / step;
    return (row >= 1.5 && row <= 4.5 && col >= 7.5 && col <= 9.5);
  }

  // ── CHECKERBOARD GROUND under the tree edges ──
  {
    const checkSize = 1.0; // size of each checker square
    const gridExtent = 15; // half-extent of checkerboard area
    const halfCount = Math.ceil(gridExtent / checkSize);
    const islandHalfW = 6.5; // island is 13 wide
    const islandHalfD = 5.0; // island is 10 deep

    const color1 = 0x5cad38; // darker green
    const color2 = 0x7ec850; // lighter green (matches ground)

    const checkDepth = 0.12;
    const checkGeo = new THREE.BoxGeometry(checkSize, checkDepth, checkSize);
    const mat1 = new THREE.MeshLambertMaterial({ color: color1 });
    const mat2 = new THREE.MeshLambertMaterial({ color: color2 });
    mat1._shared = true;
    mat2._shared = true;

    // Count tiles needed for InstancedMesh
    let count1 = 0, count2 = 0;
    for (let ix = -halfCount; ix <= halfCount; ix++) {
      for (let iz = -halfCount; iz <= halfCount; iz++) {
        const cx = ix * checkSize;
        const cz = iz * checkSize;
        // Skip tiles that overlap the island
        if (cx > -islandHalfW && cx < islandHalfW && cz > -islandHalfD && cz < islandHalfD) continue;
        if ((ix + iz) % 2 === 0) count1++; else count2++;
      }
    }

    const inst1 = new THREE.InstancedMesh(checkGeo, mat1, count1);
    const inst2 = new THREE.InstancedMesh(checkGeo, mat2, count2);
    inst1.name = 'checkerboard-dark';
    inst2.name = 'checkerboard-light';
    inst1.receiveShadow = true;
    inst2.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let idx1 = 0, idx2 = 0;
    for (let ix = -halfCount; ix <= halfCount; ix++) {
      for (let iz = -halfCount; iz <= halfCount; iz++) {
        const cx = ix * checkSize;
        const cz = iz * checkSize;
        if (cx > -islandHalfW && cx < islandHalfW && cz > -islandHalfD && cz < islandHalfD) continue;
        dummy.position.set(cx, -0.01 - checkDepth / 2, cz);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        if ((ix + iz) % 2 === 0) {
          inst1.setMatrixAt(idx1++, dummy.matrix);
        } else {
          inst2.setMatrixAt(idx2++, dummy.matrix);
        }
      }
    }
    inst1.instanceMatrix.needsUpdate = true;
    inst2.instanceMatrix.needsUpdate = true;
    inst1.matrixAutoUpdate = false;
    inst2.matrixAutoUpdate = false;
    scene.add(inst1);
    scene.add(inst2);
  }

  const variants = ['pine', 'round', 'bush'];
  const treeData = [
    // ── LEFT EDGE (dense forest wall) ──
    { x: -5.8, z: -5.0, variant: 'pine', s: 2.4 },
    { x: -6.2, z: -3.8, variant: 'round', s: 2.0 },
    { x: -5.5, z: -2.5, variant: 'pine', s: 2.6 },
    { x: -6.0, z: -1.2, variant: 'pine', s: 2.2 },
    { x: -5.3, z:  0.0, variant: 'round', s: 1.9 },
    { x: -6.1, z:  1.0, variant: 'pine', s: 2.5 },
    { x: -5.6, z:  2.2, variant: 'pine', s: 2.3 },
    { x: -6.3, z:  3.3, variant: 'round', s: 2.0 },
    { x: -5.4, z:  4.5, variant: 'pine', s: 2.1 },
    { x: -5.9, z:  5.5, variant: 'pine', s: 2.4 },
    // second row behind left edge
    { x: -7.0, z: -4.5, variant: 'pine', s: 2.8 },
    { x: -7.3, z: -2.8, variant: 'round', s: 2.3 },
    { x: -7.1, z: -0.8, variant: 'pine', s: 2.6 },
    { x: -6.8, z:  0.8, variant: 'pine', s: 2.5 },
    { x: -7.2, z:  2.5, variant: 'round', s: 2.2 },
    { x: -7.0, z:  4.2, variant: 'pine', s: 2.7 },
    // third row (far background)
    { x: -8.2, z: -3.5, variant: 'pine', s: 3.0 },
    { x: -8.0, z: -1.0, variant: 'pine', s: 2.8 },
    { x: -8.3, z:  1.5, variant: 'round', s: 2.5 },
    { x: -8.1, z:  3.8, variant: 'pine', s: 2.9 },

    // ── RIGHT EDGE (dense forest wall) ──
    { x:  5.8, z: -5.0, variant: 'pine', s: 2.3 },
    { x:  6.2, z: -3.5, variant: 'round', s: 2.1 },
    { x:  5.5, z: -2.0, variant: 'pine', s: 2.5 },
    { x:  6.0, z: -0.5, variant: 'pine', s: 2.0 },
    { x:  5.7, z:  0.8, variant: 'round', s: 1.8 },
    { x:  6.1, z:  2.0, variant: 'pine', s: 2.4 },
    { x:  5.4, z:  3.2, variant: 'bush', s: 2.0 },
    { x:  6.3, z:  4.3, variant: 'pine', s: 2.2 },
    { x:  5.9, z:  5.5, variant: 'pine', s: 2.6 },
    // second row behind right edge
    { x:  7.0, z: -4.2, variant: 'pine', s: 2.7 },
    { x:  7.3, z: -2.0, variant: 'round', s: 2.4 },
    { x:  7.1, z:  0.5, variant: 'pine', s: 2.5 },
    { x:  6.8, z:  2.5, variant: 'pine', s: 2.3 },
    { x:  7.2, z:  4.5, variant: 'round', s: 2.6 },
    // third row (far background)
    { x:  8.0, z: -3.0, variant: 'pine', s: 3.0 },
    { x:  8.2, z: -0.5, variant: 'pine', s: 2.7 },
    { x:  8.1, z:  2.0, variant: 'round', s: 2.8 },
    { x:  8.3, z:  4.0, variant: 'pine', s: 2.9 },

    // ── TOP EDGE (far side, behind board) ──
    { x: -4.5, z: -5.5, variant: 'pine', s: 2.2 },
    { x: -3.0, z: -5.8, variant: 'round', s: 2.0 },
    { x: -1.5, z: -5.3, variant: 'pine', s: 2.4 },
    { x:  0.0, z: -5.6, variant: 'pine', s: 2.1 },
    { x:  1.5, z: -5.4, variant: 'round', s: 2.3 },
    { x:  3.0, z: -5.7, variant: 'pine', s: 2.5 },
    { x:  4.5, z: -5.2, variant: 'bush', s: 1.9 },
    // second row top
    { x: -4.0, z: -6.8, variant: 'pine', s: 2.7 },
    { x: -2.0, z: -7.0, variant: 'pine', s: 2.5, c: 'blue' },
    { x:  0.0, z: -6.5, variant: 'round', s: 2.3, c: 'green' },
    { x:  2.0, z: -6.8, variant: 'pine', s: 2.6, c: 'teal' },
    { x:  4.0, z: -6.3, variant: 'pine', s: 2.4, c: 'blue' },
    // third row top (very far)
    { x: -3.0, z: -8.0, variant: 'pine', s: 3.0, c: 'darkGreen' },
    { x:  0.5, z: -7.8, variant: 'pine', s: 2.8, c: 'blue' },
    { x:  3.5, z: -7.5, variant: 'round', s: 2.9, c: 'teal' },

    // ── BOTTOM EDGE (near camera side) ──
    { x: -4.5, z:  5.0, variant: 'pine', s: 2.0, c: 'blue' },
    { x: -3.0, z:  5.3, variant: 'round', s: 1.8, c: 'green' },
    { x: -1.5, z:  5.5, variant: 'pine', s: 2.2, c: 'blue' },
    { x:  0.0, z:  5.2, variant: 'pine', s: 1.9, c: 'darkGreen' },
    { x:  1.5, z:  5.6, variant: 'bush', s: 1.7, c: 'green' },
    { x:  3.0, z:  5.4, variant: 'pine', s: 2.1, c: 'teal' },
    { x:  4.5, z:  5.1, variant: 'round', s: 2.0, c: 'blue' },
    // second row bottom
    { x: -3.5, z:  6.5, variant: 'pine', s: 2.5, c: 'blue' },
    { x: -1.0, z:  6.8, variant: 'pine', s: 2.3, c: 'darkGreen' },
    { x:  1.0, z:  6.5, variant: 'round', s: 2.4, c: 'teal' },
    { x:  3.0, z:  6.8, variant: 'pine', s: 2.6, c: 'blue' },
    { x:  5.0, z:  6.2, variant: 'pine', s: 2.2, c: 'green' },
    // third row bottom
    { x: -2.0, z:  7.8, variant: 'pine', s: 2.9, c: 'blue' },
    { x:  1.5, z:  8.0, variant: 'pine', s: 2.7, c: 'teal' },
    { x:  4.0, z:  7.5, variant: 'round', s: 2.8, c: 'darkGreen' },

    // ── CORNER CLUSTERS (fill diagonal gaps) ──
    // top-left corner
    { x: -5.8, z: -5.5, variant: 'pine', s: 2.5, c: 'blue' },
    { x: -6.5, z: -6.0, variant: 'pine', s: 2.8, c: 'darkGreen' },
    { x: -7.0, z: -5.0, variant: 'round', s: 2.3, c: 'teal' },
    // top-right corner
    { x:  5.8, z: -5.5, variant: 'pine', s: 2.4, c: 'teal' },
    { x:  6.5, z: -6.0, variant: 'round', s: 2.7, c: 'blue' },
    { x:  7.0, z: -5.2, variant: 'pine', s: 2.5, c: 'green' },
    // bottom-left corner
    { x: -5.5, z:  5.5, variant: 'pine', s: 2.3, c: 'darkGreen' },
    { x: -6.2, z:  6.0, variant: 'pine', s: 2.6, c: 'blue' },
    { x: -7.0, z:  5.2, variant: 'round', s: 2.4, c: 'teal' },
    // bottom-right corner
    { x:  5.5, z:  5.5, variant: 'round', s: 2.2, c: 'blue' },
    { x:  6.2, z:  6.0, variant: 'pine', s: 2.7, c: 'green' },
    { x:  7.0, z:  5.3, variant: 'pine', s: 2.5, c: 'teal' },

    // ── ORIGINAL INNER-AREA TREES ──
    // closer surrounding ring
    { x: -4.2, z: -3.0, variant: 'pine', s: 1.8, c: 'blue' },
    { x: -3.8, z: -2.2, variant: 'pine', s: 2.2, c: 'green' },
    { x: -4.5, z: -1.0, variant: 'round', s: 1.6, c: 'teal' },
    { x: -4.3, z:  2.5, variant: 'round', s: 1.5, c: 'green' },
    { x:  4.2, z: -2.5, variant: 'pine', s: 2.1, c: 'teal' },
    { x:  4.5, z: -1.2, variant: 'round', s: 1.7, c: 'blue' },
    { x:  4.0, z:  0.8, variant: 'pine', s: 1.8, c: 'green' },
    { x:  4.3, z:  2.0, variant: 'bush', s: 2.0, c: 'darkGreen' },
    { x:  4.6, z:  3.0, variant: 'pine', s: 2.3, c: 'blue' },
    { x: -3.0, z:  3.5, variant: 'pine', s: 2.0, c: 'teal' },
    { x: -1.5, z:  3.8, variant: 'round', s: 1.6, c: 'blue' },
    { x:  0.5, z:  3.8, variant: 'pine', s: 1.9, c: 'green' },
    { x:  2.5, z:  3.6, variant: 'pine', s: 2.1, c: 'blue' },
    { x:  3.5, z:  3.2, variant: 'bush', s: 1.5, c: 'teal' },
    // On-island trees (only placed if NOT on a tile or pond)
    { x: -1.8, z: -1.8, variant: 'pine', s: 1.0, c: 'blue' },
    { x:  2.8, z: -2.0, variant: 'bush', s: 0.8, c: 'green' },
    { x: -2.5, z:  1.0, variant: 'round', s: 0.7, c: 'teal' },
    { x:  3.2, z:  0.2, variant: 'bush', s: 0.6, c: 'darkGreen' },
    // Extra free-cell trees between/around the loops
    { x:  0.0, z: -2.8, variant: 'pine', s: 0.9, c: 'blue' },
    { x: -0.5, z:  2.8, variant: 'round', s: 0.8, c: 'green' },
    { x:  1.5, z: -1.5, variant: 'bush', s: 0.7, c: 'teal' },
  ];

  // Filter valid trees, then batch into InstancedMeshes
  const validTrees = treeData.filter(({ x, z }) =>
    !isOnTile(x, z, 0) && !isOnPond(x, z)
  );
  const treeBatch = buildTreeInstances(validTrees);
  scene.add(treeBatch);

  // Flowers — only on free cells
  const flowerColors = [0xffffff, 0xffaacc, 0xff6688, 0xffdd44];
  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 2.5 + Math.random() * 2.5;
    const fx = Math.cos(angle) * dist;
    const fz = Math.sin(angle) * dist;
    if (isOnTile(fx, fz, 0) || isOnPond(fx, fz)) continue;
    const flower = createFlower(flowerColors[i % flowerColors.length]);
    flower.position.set(fx, 0, fz);
    flower.scale.setScalar(0.6 + Math.random() * 0.8);
    flower.rotation.y = Math.random() * Math.PI;
    scene.add(flower);
  }

  // Mushrooms — mini fields of 2 mushrooms per spot
  const mushroomPositions = [
    { x: -3.2, z: -2.6 },
    { x: 3.8, z: -1.8 },
    { x: -2.8, z: 2.8 },
    { x: 1.2, z: 3.2 },
    { x: -1.0, z: -2.5 },
    { x: 3.0, z: 2.5 },
    // Near the camp (tent + campfire area)
    { x: -2.6, z: -3.6 },
    { x: 0.8, z: -4.5 },
    { x: -1.8, z: -4.0 },
  ];
  let mushroomIdx = 0;
  mushroomPositions.forEach(({ x, z }) => {
    if (isOnTile(x, z, 0) || isOnPond(x, z)) return;
    const big = createMushroom();
    big.name = `mushroom_big_${mushroomIdx}`;
    big.position.set(x, 0, z);
    const bigScale = (1.6 + Math.random() * 0.6) * 1.3;
    big.scale.setScalar(bigScale);
    big.rotation.y = Math.random() * Math.PI * 2;
    scene.add(big);
    const small = createMushroom();
    small.name = `mushroom_small_${mushroomIdx}`;
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.15 + Math.random() * 0.12;
    small.position.set(x + Math.cos(angle) * dist, 0, z + Math.sin(angle) * dist);
    const smallScale = (0.8 + Math.random() * 0.5) * 1.3;
    small.scale.setScalar(smallScale);
    small.rotation.y = Math.random() * Math.PI * 2;
    scene.add(small);
    mushroomIdx++;
  });

  // Logs & stumps — only on free cells
  if (!isOnTile(-2.0, -2.3, 0) && !isOnPond(-2.0, -2.3)) {
    const log1 = createLog();
    log1.position.set(-2.0, 0, -2.3);
    log1.rotation.y = 0.6;
    scene.add(log1);
  }

  if (!isOnTile(3.5, 1.5, 0) && !isOnPond(3.5, 1.5)) {
    const log2 = createLog();
    log2.position.set(3.5, 0, 1.5);
    log2.rotation.y = -0.8;
    log2.scale.setScalar(0.8);
    scene.add(log2);
  }

  if (!isOnTile(3.2, -1.6, 0) && !isOnPond(3.2, -1.6)) {
    const stump1 = createStump();
    stump1.position.set(3.2, 0, -1.6);
    scene.add(stump1);
  }

  if (!isOnTile(-3.5, 1.8, 0) && !isOnPond(-3.5, 1.8)) {
    const stump2 = createStump();
    stump2.position.set(-3.5, 0, 1.8);
    stump2.scale.setScalar(0.7);
    scene.add(stump2);
  }

  // Rocks — only on free cells
  const rockPositions = [
    { x: 2.0, z: 2.5, size: 'large' },
    { x: -1.5, z: 2.0, size: 'medium' },
    { x: 3.6, z: -0.5, size: 'small' },
    { x: -3.0, z: -0.5, size: 'medium' },
    { x: 1.5, z: -2.5, size: 'small' },
  ];
  rockPositions.forEach(({ x, z, size }) => {
    if (isOnTile(x, z, 0) || isOnPond(x, z)) return;
    const rock = createRock(size);
    rock.position.set(x, 0, z);
    rock.rotation.y = Math.random() * Math.PI * 2;
    scene.add(rock);
  });

  // ══════════════════════════════════════════════
  // ── GRASS FIELDS — dense coverage on all free green areas ──
  // Scan the island grid area and place grass where there are
  // no tiles, pond, dice, tent, or campfire
  // ══════════════════════════════════════════════
  {
    const grassPositions = [];
    const islandHalfW = 6.0;
    const islandHalfD = 4.5;
    const grassStep = 0.45; // tighter grid for dense coverage

    // Avoid tent, campfire, and dice areas
    function isNearTent(wx, wz) {
      const tx = tentPos.x + 0.3;
      const tz = tentPos.z - 0.8;
      const dx = wx - tx, dz = wz - tz;
      return (dx * dx + dz * dz) < 1.8 * 1.8;
    }
    function isNearCampfire(wx, wz) {
      const cx = cfPos.x, cz = cfPos.z + 0.1;
      const dx = wx - cx, dz = wz - cz;
      return (dx * dx + dz * dz) < 1.3 * 1.3;
    }
    // Decorative dice are at grid cell (4, 3) — keep grass away
    const diceWorldPos = grid.worldPos(4, 3);
    function isNearDice(wx, wz) {
      const dx = wx - diceWorldPos.x, dz = wz - diceWorldPos.z;
      return (dx * dx + dz * dz) < 0.8 * 0.8;
    }

    for (let gx = -islandHalfW; gx <= islandHalfW; gx += grassStep) {
      for (let gz = -islandHalfD; gz <= islandHalfD; gz += grassStep) {
        // Add slight jitter for natural look
        const jx = gx + (Math.sin(gx * 13.7 + gz * 7.3) * 0.18);
        const jz = gz + (Math.cos(gz * 11.3 + gx * 5.7) * 0.18);

        // Skip if on or near a tile (use radius 1 to keep clear margin)
        if (isOnTile(jx, jz, 1)) continue;
        if (isOnPond(jx, jz)) continue;
        if (isNearTent(jx, jz)) continue;
        if (isNearCampfire(jx, jz)) continue;
        if (isNearDice(jx, jz)) continue;

        grassPositions.push({ x: jx, z: jz });
      }
    }

    const grassGroup = buildGrassPatches(grassPositions, {
      bladesPerPatch: 40,
      patchRadius: 0.28,
      baseSeed: 77700,
      pondCenter: { x: pondCX, z: pondCZ },
      pondFadeRadius: 2.8,
      pondMinScale: 0.1,
    });
    scene.add(grassGroup);
  }

  return { grid, animatedObjects, boardPath };
}