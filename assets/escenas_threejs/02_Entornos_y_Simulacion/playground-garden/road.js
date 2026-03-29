// ══════════════════════════════════════════════
// ROAD GENERATOR — A* Pathfinding on Grid
// ══════════════════════════════════════════════
//
// Creates road paths between 2–5 destination points
// using A* pathfinding on the landscape grid.
// Roads are built as extruded flat meshes following
// the computed path, with intersections (carrefours).
// ══════════════════════════════════════════════

import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ── Seeded Random ──
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ══════════════════════════════════════════════
// ── A* PATHFINDING ──
// ══════════════════════════════════════════════

class MinHeap {
  constructor() { this.data = []; }
  push(node) {
    this.data.push(node);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) { this.data[0] = last; this._sinkDown(0); }
    return top;
  }
  get size() { return this.data.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].f >= this.data[parent].f) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.data[l].f < this.data[smallest].f) smallest = l;
      if (r < n && this.data[r].f < this.data[smallest].f) smallest = r;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

/**
 * A* pathfinding on a 2D grid.
 * @param {Uint8Array} grid - occupancy grid (0 = free, >0 = blocked)
 * @param {number} gridSize - grid dimension (gridSize x gridSize)
 * @param {number} startX - start cell X
 * @param {number} startZ - start cell Z
 * @param {number} endX - end cell X
 * @param {number} endZ - end cell Z
 * @param {Uint8Array} roadGrid - cells already used by roads (treated as free for road pathfinding)
 * @returns {Array<{x:number, z:number}>|null} - path cells or null if no path
 */
function astarPath(grid, gridSize, startX, startZ, endX, endZ, roadGrid) {
  const idx = (x, z) => z * gridSize + x;

  // Allow walking on free cells (0) or cells already used by roads
  function isWalkable(x, z) {
    if (x < 0 || z < 0 || x >= gridSize || z >= gridSize) return false;
    const i = idx(x, z);
    if (roadGrid[i]) return true; // already a road cell, always walkable
    return grid[i] === 0; // free cell
  }

  function heuristic(ax, az, bx, bz) {
    return Math.abs(ax - bx) + Math.abs(az - bz); // Manhattan distance
  }

  const open = new MinHeap();
  const gScore = new Float32Array(gridSize * gridSize).fill(Infinity);
  const cameFrom = new Int32Array(gridSize * gridSize).fill(-1);
  const closed = new Uint8Array(gridSize * gridSize);

  const startIdx = idx(startX, startZ);
  gScore[startIdx] = 0;
  open.push({ x: startX, z: startZ, f: heuristic(startX, startZ, endX, endZ) });

  // 4-directional neighbors
  const dirs = [
    { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
    { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
  ];

  while (open.size > 0) {
    const current = open.pop();
    const ci = idx(current.x, current.z);

    if (current.x === endX && current.z === endZ) {
      // Reconstruct path
      const path = [];
      let ni = ci;
      while (ni !== -1) {
        const pz = Math.floor(ni / gridSize);
        const px = ni % gridSize;
        path.push({ x: px, z: pz });
        ni = cameFrom[ni];
      }
      path.reverse();
      return path;
    }

    if (closed[ci]) continue;
    closed[ci] = 1;

    for (const d of dirs) {
      const nx = current.x + d.dx;
      const nz = current.z + d.dz;
      if (!isWalkable(nx, nz)) continue;

      const ni = idx(nx, nz);
      if (closed[ni]) continue;

      const tentG = gScore[ci] + 1;
      if (tentG < gScore[ni]) {
        gScore[ni] = tentG;
        cameFrom[ni] = ci;
        const f = tentG + heuristic(nx, nz, endX, endZ);
        open.push({ x: nx, z: nz, f });
      }
    }
  }

  return null; // no path found
}

// ══════════════════════════════════════════════
// ── BUILD ROAD MESH ──
// ══════════════════════════════════════════════

const ROAD_COLOR = 0xc4a46c;      // sandy/dirt road
const ROAD_EDGE_COLOR = 0x9e8855; // darker edge
const ROAD_Y = 0.005;             // slight elevation above ground

/**
 * Build road network on the grid.
 *
 * @param {Object} options
 * @param {number} options.GRID - grid dimension
 * @param {number} options.CELL - cell size in world units
 * @param {Uint8Array} options.occupied - occupancy grid
 * @param {Function} options.rand - seeded random function
 * @param {Function} options.gridToWorld - cell-to-world converter
 * @param {Function} options.markOccupied - function to mark cells
 * @param {number} [options.destinations=6] - number of destination points (3–8)
 * @param {number} [options.roadWidth=2] - road width in cells
 * @returns {{ group: THREE.Group, roadGrid: Uint8Array }}
 */
export function buildRoadNetwork(options = {}) {
  const {
    GRID, CELL, occupied, rand, gridToWorld, markOccupied,
    destinations: destCount = 6,
    roadWidth = 2,
  } = options;

  const group = new THREE.Group();
  group.name = "roadNetwork";

  const roadGrid = new Uint8Array(GRID * GRID); // tracks which cells are road
  const HALF = (GRID * CELL) / 2;

  // ── Generate destination points at grid edges ──
  const numDest = Math.max(3, Math.min(8, destCount));
  const points = [];
  const margin = 1; // how close to the very edge (0 or 1)

  // Edge generators — each places a point right at a grid border
  const edgeGenerators = [
    // Left edge (x = margin)
    () => ({ x: margin, z: Math.floor(GRID * (0.1 + rand() * 0.8)) }),
    // Right edge (x = GRID - 1 - margin)
    () => ({ x: GRID - 1 - margin, z: Math.floor(GRID * (0.1 + rand() * 0.8)) }),
    // Top edge (z = margin)
    () => ({ x: Math.floor(GRID * (0.1 + rand() * 0.8)), z: margin }),
    // Bottom edge (z = GRID - 1 - margin)
    () => ({ x: Math.floor(GRID * (0.1 + rand() * 0.8)), z: GRID - 1 - margin }),
    // Top-left corner
    () => ({ x: margin + Math.floor(rand() * 3), z: margin + Math.floor(rand() * 3) }),
    // Top-right corner
    () => ({ x: GRID - 1 - margin - Math.floor(rand() * 3), z: margin + Math.floor(rand() * 3) }),
    // Bottom-left corner
    () => ({ x: margin + Math.floor(rand() * 3), z: GRID - 1 - margin - Math.floor(rand() * 3) }),
    // Bottom-right corner
    () => ({ x: GRID - 1 - margin - Math.floor(rand() * 3), z: GRID - 1 - margin - Math.floor(rand() * 3) }),
  ];

  // Shuffle edge generators
  for (let i = edgeGenerators.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [edgeGenerators[i], edgeGenerators[j]] = [edgeGenerators[j], edgeGenerators[i]];
  }

  // Place all destination points at grid edges/corners
  const minSeparation = Math.floor(GRID * 0.15);
  for (let i = 0; i < numDest; i++) {
    const gen = edgeGenerators[i % edgeGenerators.length];
    let pt;
    let placed = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      pt = gen();
      // Clamp to grid bounds
      pt.x = Math.max(0, Math.min(GRID - 1, pt.x));
      pt.z = Math.max(0, Math.min(GRID - 1, pt.z));
      // Ensure minimum distance from other points
      const tooClose = points.some(p =>
        Math.abs(p.x - pt.x) + Math.abs(p.z - pt.z) < minSeparation
      );
      if (!tooClose) { placed = true; break; }
    }
    if (placed) points.push(pt);
  }

  // ── Build a connected road network between edge points ──
  // Use a hub approach: pick ~2 interior hub points, connect edge points to nearest hub
  const allPaths = [];
  const connections = [];

  // Generate 1–2 interior hub points where roads converge (carrefours)
  const hubs = [];
  const hubCount = points.length >= 5 ? 2 : 1;
  for (let h = 0; h < hubCount; h++) {
    const hx = Math.floor(GRID * (0.25 + rand() * 0.5));
    const hz = Math.floor(GRID * (0.25 + rand() * 0.5));
    hubs.push({ x: hx, z: hz });
    points.push({ x: hx, z: hz }); // add hubs to points array for plaza rendering
  }

  // Connect each edge point to its nearest hub
  const edgeCount = points.length - hubCount; // edge points are first in array
  for (let i = 0; i < edgeCount; i++) {
    let bestHub = 0;
    let bestDist = Infinity;
    for (let h = 0; h < hubCount; h++) {
      const hub = hubs[h];
      const dist = Math.abs(points[i].x - hub.x) + Math.abs(points[i].z - hub.z);
      if (dist < bestDist) { bestDist = dist; bestHub = edgeCount + h; }
    }
    connections.push([i, bestHub]);
  }

  // Connect hubs together if there are 2+
  if (hubCount >= 2) {
    connections.push([edgeCount, edgeCount + 1]);
  }

  // Add a few extra cross-connections between edge points for variety
  if (edgeCount >= 4) {
    // Connect two random edge points directly
    const a = Math.floor(rand() * edgeCount);
    let b = Math.floor(rand() * edgeCount);
    while (b === a) b = Math.floor(rand() * edgeCount);
    connections.push([a, b]);
  }

  for (const [ai, bi] of connections) {
    const a = points[ai];
    const b = points[bi];
    const path = astarPath(occupied, GRID, a.x, a.z, b.x, b.z, roadGrid);
    if (path) {
      allPaths.push(path);
      // Mark path cells in roadGrid (with width)
      for (const cell of path) {
        for (let dz = 0; dz < roadWidth; dz++) {
          for (let dx = 0; dx < roadWidth; dx++) {
            const rx = cell.x + dx - Math.floor(roadWidth / 2);
            const rz = cell.z + dz - Math.floor(roadWidth / 2);
            if (rx >= 0 && rx < GRID && rz >= 0 && rz < GRID) {
              roadGrid[rz * GRID + rx] = 1;
            }
          }
        }
      }
    }
  }

  // ── Mark road cells as occupied in the main grid ──
  for (let i = 0; i < GRID * GRID; i++) {
    if (roadGrid[i]) {
      occupied[i] = 3; // value 3 = road
    }
  }

  // ── Build road mesh from roadGrid ──
  // Use merged box geometries for each road cell (flat quads)
  const roadGeos = [];
  const cellGeo = new THREE.PlaneGeometry(CELL * 1.05, CELL * 1.05); // slight overlap to avoid gaps
  cellGeo.rotateX(-Math.PI / 2);

  // Count neighbors for each road cell to determine intersection vs straight
  function isRoad(x, z) {
    if (x < 0 || z < 0 || x >= GRID || z >= GRID) return false;
    return roadGrid[z * GRID + x] === 1;
  }

  const intersectionCells = new Set(); // cells where 3+ neighbors = intersection

  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      if (!roadGrid[z * GRID + x]) continue;

      // Count orthogonal road neighbors
      let neighbors = 0;
      if (isRoad(x + 1, z)) neighbors++;
      if (isRoad(x - 1, z)) neighbors++;
      if (isRoad(x, z + 1)) neighbors++;
      if (isRoad(x, z - 1)) neighbors++;

      if (neighbors >= 3) {
        intersectionCells.add(z * GRID + x);
      }

      const wx = x * CELL - HALF + CELL * 0.5;
      const wz = z * CELL - HALF + CELL * 0.5;

      const clone = cellGeo.clone();
      clone.translate(wx, ROAD_Y, wz);
      roadGeos.push(clone);
    }
  }

  cellGeo.dispose();

  if (roadGeos.length > 0) {
    const merged = mergeGeometries(roadGeos, false);
    const roadMat = new THREE.MeshStandardNodeMaterial({
      color: new THREE.Color(ROAD_COLOR),
      roughness: 0.95,
      metalness: 0.0,
    });
    const roadMesh = new THREE.Mesh(merged, roadMat);
    roadMesh.name = "roadSurface";
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // Clean up temp geos
    roadGeos.forEach(g => g.dispose());

    // ── Road edge/border markers at intersections ──
    const markerGeo = new THREE.CircleGeometry(CELL * 1.2, 8);
    markerGeo.rotateX(-Math.PI / 2);
    const markerGeos = [];

    for (const cellIdx of intersectionCells) {
      const cz = Math.floor(cellIdx / GRID);
      const cx = cellIdx % GRID;
      const wx = cx * CELL - HALF + CELL * 0.5;
      const wz = cz * CELL - HALF + CELL * 0.5;
      const clone = markerGeo.clone();
      clone.translate(wx, ROAD_Y + 0.002, wz);
      markerGeos.push(clone);
    }

    if (markerGeos.length > 0) {
      const mergedMarkers = mergeGeometries(markerGeos, false);
      const markerMat = new THREE.MeshStandardNodeMaterial({
        color: new THREE.Color(ROAD_EDGE_COLOR),
        roughness: 0.9,
        metalness: 0.0,
      });
      const markerMesh = new THREE.Mesh(mergedMarkers, markerMat);
      markerMesh.name = "roadIntersections";
      markerMesh.receiveShadow = true;
      group.add(markerMesh);
      markerGeos.forEach(g => g.dispose());
    }

    markerGeo.dispose();

    // ── Small edge lines along road borders ──
    const edgeGeos = [];
    const edgePieceGeo = new THREE.PlaneGeometry(CELL * 0.2, CELL * 1.05);
    edgePieceGeo.rotateX(-Math.PI / 2);

    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (!roadGrid[z * GRID + x]) continue;
        const wx = x * CELL - HALF + CELL * 0.5;
        const wz = z * CELL - HALF + CELL * 0.5;

        // Add edge pieces on sides where there's no neighboring road
        if (!isRoad(x + 1, z)) {
          const e = edgePieceGeo.clone();
          e.translate(wx + CELL * 0.45, ROAD_Y + 0.001, wz);
          edgeGeos.push(e);
        }
        if (!isRoad(x - 1, z)) {
          const e = edgePieceGeo.clone();
          e.translate(wx - CELL * 0.45, ROAD_Y + 0.001, wz);
          edgeGeos.push(e);
        }
        // Rotated for Z-axis edges
        if (!isRoad(x, z + 1)) {
          const e = edgePieceGeo.clone();
          e.rotateY(Math.PI / 2);
          e.translate(wx, ROAD_Y + 0.001, wz + CELL * 0.45);
          edgeGeos.push(e);
        }
        if (!isRoad(x, z - 1)) {
          const e = edgePieceGeo.clone();
          e.rotateY(Math.PI / 2);
          e.translate(wx, ROAD_Y + 0.001, wz - CELL * 0.45);
          edgeGeos.push(e);
        }
      }
    }

    edgePieceGeo.dispose();

    if (edgeGeos.length > 0) {
      const mergedEdges = mergeGeometries(edgeGeos, false);
      const edgeMat = new THREE.MeshStandardNodeMaterial({
        color: new THREE.Color(ROAD_EDGE_COLOR),
        roughness: 0.85,
        metalness: 0.0,
      });
      const edgeMesh = new THREE.Mesh(mergedEdges, edgeMat);
      edgeMesh.name = "roadEdges";
      edgeMesh.receiveShadow = true;
      group.add(edgeMesh);
      edgeGeos.forEach(g => g.dispose());
    }
  }

  // ── Destination markers (small circular plazas) ──
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const wx = pt.x * CELL - HALF + CELL * 0.5;
    const wz = pt.z * CELL - HALF + CELL * 0.5;

    const plazaGeo = new THREE.CircleGeometry(CELL * 2.5, 16);
    plazaGeo.rotateX(-Math.PI / 2);
    const plazaMat = new THREE.MeshStandardNodeMaterial({
      color: new THREE.Color(ROAD_EDGE_COLOR),
      roughness: 0.85,
      metalness: 0.0,
    });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.position.set(wx, ROAD_Y + 0.003, wz);
    plaza.name = `roadPlaza_${i}`;
    plaza.receiveShadow = true;
    group.add(plaza);
  }

  return { group, roadGrid, destinations: points };
}

// ══════════════════════════════════════════════
// ── STANDALONE ROAD (for slide preview) ──
// ══════════════════════════════════════════════

export function buildRoadSlide(options = {}) {
  const { seed = 42, destinations = 6 } = options;
  const rand = seededRandom(seed);

  const GRID = 45;
  const CELL = 0.15;
  const HALF = (GRID * CELL) / 2;

  const occupied = new Uint8Array(GRID * GRID);

  function gridToWorld(gx, gz) {
    return { x: gx * CELL - HALF + CELL * 0.5, z: gz * CELL - HALF + CELL * 0.5 };
  }

  function markOccupied(gx, gz, w, d, value = 1) {
    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = gx + dx;
        const cz = gz + dz;
        if (cx >= 0 && cx < GRID && cz >= 0 && cz < GRID) {
          occupied[cz * GRID + cx] = value;
        }
      }
    }
  }

  const { group } = buildRoadNetwork({
    GRID, CELL, occupied, rand, gridToWorld, markOccupied,
    destinations,
    roadWidth: 2,
  });

  return group;
}