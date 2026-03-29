// ══════════════════════════════════════════════
// LANDSCAPE GENERATOR — Grid-based placement
// ══════════════════════════════════════════════
//
// Uses a 64×64 grid. Each cell is 0.15 units.
// Randomly places trees (1×1), bushes (1×1),
// flower clusters (2×2), and gardens (variable grid cells).
// All objects snap to grid; gardens align horizontally/vertically.
// ══════════════════════════════════════════════

import * as THREE from "three/webgpu";
import { createStandaloneTree, createSapinTree, getSharedPetalGeo, getSharedTrunkGeo, computeTreeLeafMatrices, seededRandom as treeSeededRandom, LEAVES_PER_TREE, TRUNK_PARTS_PER_TREE } from "./tree-generator.js";
import { createStandaloneBush, createPillarBush } from "./bush.js";
import { buildFlowerGrove, createButterflies } from "./flower.js";
import { buildGarden, buildBerryGarden } from "./garden.js";
import { buildFenceLine } from "./fence.js";
import { buildRoadNetwork } from "./road.js";
import { createStandaloneBench } from "./bench.js";
import { buildDuckPond } from "./water.js";

// ── Seeded Random ──
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ══════════════════════════════════════════════
// ── BUILD LANDSCAPE ──
// ══════════════════════════════════════════════

export function buildLandscape(options = {}) {
  const { seed = 42 } = options;
  const rand = seededRandom(seed);

  const GRID = 40;
  const CELL = 0.15; // world units per cell
  const HALF = (GRID * CELL) / 2; // center offset

  const group = new THREE.Group();
  group.name = "landscapeGroup";

  // Occupied grid: 0 = free, 1 = general occupied, 2 = garden (reserved zone), 3 = road
  const occupied = new Uint8Array(GRID * GRID);

  function idx(gx, gz) { return gz * GRID + gx; }

  // Check if area is free. If excludeGarden=true, garden cells (value 2) are also treated as free
  // (used for fences which can be placed near gardens)
  function isFree(gx, gz, w, d, excludeGarden = false) {
    if (gx < 0 || gz < 0 || gx + w > GRID || gz + d > GRID) return false;
    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        const val = occupied[idx(gx + dx, gz + dz)];
        if (val === 0) continue;
        if (excludeGarden && val === 2) continue; // fences ignore garden reservation
        return false;
      }
    }
    return true;
  }

  function markOccupied(gx, gz, w, d, value = 1) {
    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = gx + dx;
        const cz = gz + dz;
        if (cx >= 0 && cx < GRID && cz >= 0 && cz < GRID) {
          occupied[idx(cx, cz)] = value;
        }
      }
    }
  }

  function gridToWorld(gx, gz) {
    return { x: gx * CELL - HALF + CELL * 0.5, z: gz * CELL - HALF + CELL * 0.5 };
  }

  // ── Build roads FIRST so other objects avoid road cells ──
  const roadDestinations = 4 + Math.floor(rand() * 5); // 4–8
  const { group: roadGroup, roadGrid, destinations: roadPoints } = buildRoadNetwork({
    GRID, CELL, occupied, rand, gridToWorld, markOccupied,
    destinations: roadDestinations,
    roadWidth: 2,
  });
  group.add(roadGroup);

  // ── Place two duck ponds on opposite edges of the grid ──
  const pondData = []; // { pos, cellsW, cellsD }
  {
    const pw = 8;
    const pd = 8;
    const bufW = pw + 2;
    const bufD = pd + 2;

    // Try placing on a random grid edge (0=bottom, 1=top, 2=left, 3=right)
    const edgeOrder = [0, 1, 2, 3];
    // Shuffle edge order
    for (let i = edgeOrder.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [edgeOrder[i], edgeOrder[j]] = [edgeOrder[j], edgeOrder[i]];
    }

    // Opposite edge mapping: 0<->1 (bottom<->top), 2<->3 (left<->right)
    const oppositeEdge = { 0: 1, 1: 0, 2: 3, 3: 2 };

    let firstEdge = -1;
    // Place first pond
    for (let e = 0; e < edgeOrder.length && firstEdge < 0; e++) {
      const edge = edgeOrder[e];
      for (let attempt = 0; attempt < 60; attempt++) {
        let gx, gz;
        if (edge === 0) { gx = Math.floor(rand() * (GRID - bufW)); gz = 0; }
        else if (edge === 1) { gx = Math.floor(rand() * (GRID - bufW)); gz = GRID - bufD; }
        else if (edge === 2) { gx = 0; gz = Math.floor(rand() * (GRID - bufD)); }
        else { gx = GRID - bufW; gz = Math.floor(rand() * (GRID - bufD)); }

        if (isFree(gx, gz, bufW, bufD)) {
          markOccupied(gx, gz, bufW, bufD, 1);
          const cx = gx + 1 + pw / 2;
          const cz = gz + 1 + pd / 2;
          const pos = gridToWorld(Math.floor(cx), Math.floor(cz));
          const pond = buildDuckPond({ seed: seed * 800, cellsW: pw, cellsD: pd, cellSize: CELL });
          pond.position.set(pos.x, 0, pos.z);
          pond.name = `landscape_pond_0`;
          group.add(pond);
          pondData.push({ pos, cellsW: pw, cellsD: pd });
          firstEdge = edge;
          break;
        } else { rand(); }
      }
    }

    // Place second pond on the opposite edge
    if (firstEdge >= 0) {
      const edge2 = oppositeEdge[firstEdge];
      for (let attempt = 0; attempt < 60; attempt++) {
        let gx, gz;
        if (edge2 === 0) { gx = Math.floor(rand() * (GRID - bufW)); gz = 0; }
        else if (edge2 === 1) { gx = Math.floor(rand() * (GRID - bufW)); gz = GRID - bufD; }
        else if (edge2 === 2) { gx = 0; gz = Math.floor(rand() * (GRID - bufD)); }
        else { gx = GRID - bufW; gz = Math.floor(rand() * (GRID - bufD)); }

        if (isFree(gx, gz, bufW, bufD)) {
          markOccupied(gx, gz, bufW, bufD, 1);
          const cx = gx + 1 + pw / 2;
          const cz = gz + 1 + pd / 2;
          const pos = gridToWorld(Math.floor(cx), Math.floor(cz));
          const pond = buildDuckPond({ seed: seed * 801, cellsW: pw, cellsD: pd, cellSize: CELL });
          pond.position.set(pos.x, 0, pos.z);
          pond.name = `landscape_pond_1`;
          group.add(pond);
          pondData.push({ pos, cellsW: pw, cellsD: pd });
          break;
        } else { rand(); }
      }
    }

    // ── GUARANTEE: if no pond was placed, force a smaller one anywhere on the grid ──
    if (pondData.length === 0) {
      const fpw = 5, fpd = 5;
      const fbufW = fpw + 2, fbufD = fpd + 2;
      let placed = false;
      // Try random interior positions first
      for (let attempt = 0; attempt < 200 && !placed; attempt++) {
        const gx = Math.floor(rand() * (GRID - fbufW));
        const gz = Math.floor(rand() * (GRID - fbufD));
        if (isFree(gx, gz, fbufW, fbufD)) {
          markOccupied(gx, gz, fbufW, fbufD, 1);
          const cx = gx + 1 + fpw / 2;
          const cz = gz + 1 + fpd / 2;
          const pos = gridToWorld(Math.floor(cx), Math.floor(cz));
          const pond = buildDuckPond({ seed: seed * 802, cellsW: fpw, cellsD: fpd, cellSize: CELL });
          pond.position.set(pos.x, 0, pos.z);
          pond.name = `landscape_pond_fallback`;
          group.add(pond);
          pondData.push({ pos, cellsW: fpw, cellsD: fpd });
          placed = true;
        }
      }
      // Last resort: force place at grid center, overriding occupancy
      if (!placed) {
        const gx = Math.floor((GRID - fbufW) / 2);
        const gz = Math.floor((GRID - fbufD) / 2);
        markOccupied(gx, gz, fbufW, fbufD, 1);
        const cx = gx + 1 + fpw / 2;
        const cz = gz + 1 + fpd / 2;
        const pos = gridToWorld(Math.floor(cx), Math.floor(cz));
        const pond = buildDuckPond({ seed: seed * 802, cellsW: fpw, cellsD: fpd, cellSize: CELL });
        pond.position.set(pos.x, 0, pos.z);
        pond.name = `landscape_pond_fallback`;
        group.add(pond);
        pondData.push({ pos, cellsW: fpw, cellsD: fpd });
      }
    }
  }

  // ── Place pillar bushes around each pond ──
  for (let p = 0; p < pondData.length; p++) {
    const pd = pondData[p];
    const pondHalfW = (pd.cellsW * CELL) / 2;
    const pondHalfD = (pd.cellsD * CELL) / 2;
    const margin = CELL * 1.5;

    const bushPositions = [
      { x: pd.pos.x - pondHalfW - margin, z: pd.pos.z - pondHalfD - margin },
      { x: pd.pos.x + pondHalfW + margin, z: pd.pos.z - pondHalfD - margin },
      { x: pd.pos.x - pondHalfW - margin, z: pd.pos.z + pondHalfD + margin },
      { x: pd.pos.x + pondHalfW + margin, z: pd.pos.z + pondHalfD + margin },
      { x: pd.pos.x, z: pd.pos.z - pondHalfD - margin },
      { x: pd.pos.x, z: pd.pos.z + pondHalfD + margin },
      { x: pd.pos.x - pondHalfW - margin, z: pd.pos.z },
      { x: pd.pos.x + pondHalfW + margin, z: pd.pos.z },
    ];

    for (let b = 0; b < bushPositions.length; b++) {
      const bp = bushPositions[b];
      if (Math.abs(bp.x) > HALF - CELL || Math.abs(bp.z) > HALF - CELL) continue;

      const isCorner = b < 4;
      const bushRadius = isCorner ? 0.08 : 0.11;
      const bushScale = isCorner ? 0.35 : 0.45;

      const pillarBush = createPillarBush(null, {
        seed: seed * 900 + p * 100 + b,
        radius: bushRadius,
        position: { x: bp.x, y: 0, z: bp.z },
      });
      pillarBush.name = `landscape_pondPillarBush_${p}_${b}`;
      pillarBush.scale.setScalar(bushScale);
      group.add(pillarBush);
    }
  }

  // ── Place gardens (they take multiple cells) ──
  const gardenCount = 1 + Math.floor(rand() * 3); // 1–3
  let gardenIdx = 0;
  const gardenPlacements = []; // store for fence attachment

  for (let g = 0; g < gardenCount; g++) {
    // Randomly pick orientation: tall-narrow vs wide-short
    const isVertical = rand() > 0.5;
    let gw, gd;
    if (isVertical) {
      gw = 2 + Math.floor(rand() * 2);  // 2–3 wide
      gd = 4 + Math.floor(rand() * 4);  // 4–7 deep
    } else {
      gw = 4 + Math.floor(rand() * 4);  // 4–7 wide
      gd = 2 + Math.floor(rand() * 2);  // 2–3 deep
    }

    // Try to place
    for (let attempt = 0; attempt < 100; attempt++) {
      const gx = Math.floor(rand() * (GRID - gw));
      const gz = Math.floor(rand() * (GRID - gd));
      // Leave 1-cell margin between gardens
      if (isFree(gx - 1, gz - 1, gw + 2, gd + 2) || isFree(gx, gz, gw, gd)) {
        if (!isFree(gx, gz, gw, gd)) continue;
        // Mark garden cells AND a 1-cell buffer around them as garden-reserved (value 2)
        // This prevents bushes/trees/flowers from spawning on or adjacent to the garden
        markOccupied(gx - 1, gz - 1, gw + 2, gd + 2, 2);

        const cx = gx + gw / 2;
        const cz = gz + gd / 2;
        const pos = gridToWorld(Math.floor(cx), Math.floor(cz));

        const useBerry = rand() > 0.5;
        const garden = useBerry
          ? buildBerryGarden({ seed: seed * 100 + g })
          : buildGarden({ seed: seed * 100 + g });
        garden.scale.setScalar(1);
        garden.position.set(pos.x, 0, pos.z);
        garden.name = `landscape_garden_${gardenIdx++}`;
        group.add(garden);

        // Store placement info for fence attachment, including actual bed dimensions
        const gardenScale = garden.userData.groupScale || 1.25;
        const actualBedW = (garden.userData.bedW || 0.45) * gardenScale;
        const actualBedD = (garden.userData.bedD || 1.0) * gardenScale;
        gardenPlacements.push({ gx, gz, gw, gd, pos, actualBedW, actualBedD });
        break;
      }
    }
  }

  // ── Add fences to ~half of gardens, along their longest edge ──
  // At least 1 fence is always shown (first garden guaranteed)
  // Place fence right at the edge of the actual garden bed (not inside it)
  // Small gap so the bed soil is still visible
  const FENCE_GAP = 0.02; // tiny gap between bed edge and fence
  let fenceCount = 0;
  const allFencePositions = []; // { x, z } for proximity checks
  const MIN_FENCE_DIST = CELL * 6; // minimum distance between any two fences

  function isTooCloseToFence(x, z) {
    for (const fp of allFencePositions) {
      const dx = fp.x - x;
      const dz = fp.z - z;
      if (Math.sqrt(dx * dx + dz * dz) < MIN_FENCE_DIST) return true;
    }
    return false;
  }

  // Grid center in world coords
  const gridCenterX = 0;
  const gridCenterZ = 0;

  for (let g = 0; g < gardenPlacements.length; g++) {
    // First garden always gets a fence; rest ~50% chance
    if (g > 0 && rand() > 0.5) continue;

    const gp = gardenPlacements[g];
    // Use actual bed dimensions (world-space) for precise placement
    const bedHalfW = gp.actualBedW / 2;
    const bedHalfD = gp.actualBedD / 2;

    // Determine longest side using actual bed dimensions
    const longestIsWidth = gp.actualBedW >= gp.actualBedD;
    const fenceWorldLen = longestIsWidth ? gp.actualBedW : gp.actualBedD;

    // Place fence right at the bed edge + small gap
    // Choose the side that faces AWAY from grid center
    let fx, fz, fenceRotY;

    if (longestIsWidth) {
      // Fence runs along X (width). Place on Z edge of bed
      const gardenCenterZ = gp.pos.z;
      const side = gardenCenterZ >= gridCenterZ ? 1 : -1;
      fx = gp.pos.x;
      fz = gp.pos.z + side * (bedHalfD + FENCE_GAP);
      // Face toward garden (nails face the bed)
      fenceRotY = side > 0 ? 0 : Math.PI;
    } else {
      // Fence runs along Z (depth). Place on X edge of bed
      const gardenCenterX = gp.pos.x;
      const side = gardenCenterX >= gridCenterX ? 1 : -1;
      fx = gp.pos.x + side * (bedHalfW + FENCE_GAP);
      fz = gp.pos.z;
      // Rotate 90° to run along Z, nails face the garden bed
      fenceRotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    }

    // Skip if too close to an existing fence (but guarantee at least 1)
    if (fenceCount > 0 && isTooCloseToFence(fx, fz)) continue;

    const fence = buildFenceLine({
      targetWidth: fenceWorldLen,
      seed: seed * 500 + g,
    });

    fence.position.set(fx, 0, fz);
    fence.rotation.y = fenceRotY;

    fence.name = `landscape_gardenFence_${fenceCount++}`;
    group.add(fence);
    allFencePositions.push({ x: fx, z: fz });
  }

  // ── Add fences along grid corners/edges (up to 6) ──
  const cornerFenceMax = 2;
  let cornerFenceCount = 0;

  // Define possible corner/edge positions:
  // Each entry: { gx, gz, rotation, lengthCells }
  // Corners: short fences at grid corners
  // Edges: longer fences along grid edges
  // Corner/edge fences face INWARD toward grid center
  // rot is the Y-rotation so nails (front face) point toward center
  const cornerCandidates = [
    // Bottom edge (gz=0) — fence faces +Z (inward)
    { gx: 0, gz: 0, rot: 0, cells: 5 + Math.floor(rand() * 4), side: 'bottom-left' },
    { gx: GRID - 8, gz: 0, rot: 0, cells: 5 + Math.floor(rand() * 4), side: 'bottom-right' },
    { gx: Math.floor(GRID * 0.4), gz: 0, rot: 0, cells: 5 + Math.floor(rand() * 4), side: 'bottom-mid' },
    // Top edge (gz=GRID-1) — fence faces -Z (inward), so rotate 180°
    { gx: 0, gz: GRID - 1, rot: Math.PI, cells: 5 + Math.floor(rand() * 4), side: 'top-left' },
    { gx: GRID - 8, gz: GRID - 1, rot: Math.PI, cells: 5 + Math.floor(rand() * 4), side: 'top-right' },
    { gx: Math.floor(GRID * 0.4), gz: GRID - 1, rot: Math.PI, cells: 5 + Math.floor(rand() * 4), side: 'top-mid' },
    // Left edge (gx=0) — fence faces +X (inward), rotate -90°
    { gx: 0, gz: Math.floor(GRID * 0.3), rot: -Math.PI / 2, cells: 5 + Math.floor(rand() * 4), side: 'left-mid' },
    // Right edge (gx=GRID-1) — fence faces -X (inward), rotate +90°
    { gx: GRID - 1, gz: Math.floor(GRID * 0.3), rot: Math.PI / 2, cells: 5 + Math.floor(rand() * 4), side: 'right-mid' },
  ];

  // Shuffle candidates
  for (let i = cornerCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cornerCandidates[i], cornerCandidates[j]] = [cornerCandidates[j], cornerCandidates[i]];
  }

  // Place up to cornerFenceMax fences
  for (let i = 0; i < cornerCandidates.length && cornerFenceCount < cornerFenceMax; i++) {
    const c = cornerCandidates[i];
    // ~70% chance to place each candidate (but always place at least 2)
    if (cornerFenceCount >= 2) break;

    const fenceWorldLen = c.cells * CELL;

    const fence = buildFenceLine({
      targetWidth: fenceWorldLen,
      seed: seed * 700 + i,
    });

    const pos = gridToWorld(c.gx, c.gz);

    // Skip if too close to any existing fence (garden or corner)
    if (isTooCloseToFence(pos.x, pos.z)) continue;

    fence.position.set(pos.x, 0, pos.z);
    fence.rotation.y = c.rot;
    fence.name = `landscape_cornerFence_${cornerFenceCount}`;
    group.add(fence);
    allFencePositions.push({ x: pos.x, z: pos.z });

    // Mark cells as occupied so nothing overlaps the fence
    // rot 0 or PI = fence runs along X, rot ±PI/2 = fence runs along Z
    const runsAlongX = Math.abs(Math.abs(c.rot) - Math.PI) < 0.1 || Math.abs(c.rot) < 0.1;
    if (runsAlongX) {
      const fenceW = Math.min(c.cells, GRID - c.gx);
      if (isFree(c.gx, Math.max(0, c.gz - 1), fenceW, 2, true)) {
        markOccupied(c.gx, Math.max(0, c.gz - 1), fenceW, 2, 1);
      }
    } else {
      const fenceD = Math.min(c.cells, GRID - c.gz);
      if (isFree(Math.max(0, c.gx - 1), c.gz, 2, fenceD, true)) {
        markOccupied(Math.max(0, c.gx - 1), c.gz, 2, fenceD, 1);
      }
    }

    cornerFenceCount++;
  }

  // ── Collect tree placements first, then batch-build ──
  const treeCount = 5 + Math.floor(rand() * 3); // 5–7 max trees
  const treePlacements = [];

  for (let t = 0; t < treeCount; t++) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const gx = Math.floor(rand() * GRID);
      const gz = Math.floor(rand() * GRID);
      if (isFree(gx - 1, gz - 1, 3, 3)) {
        markOccupied(gx - 1, gz - 1, 3, 3);
        const pos = gridToWorld(gx, gz);
        treePlacements.push({
          x: pos.x, z: pos.z,
          radius: 0.25 + rand() * 0.15,
          treeSeed: seed * 200 + t,
        });
        break;
      } else {
        rand(); // consume to keep determinism
      }
    }
  }

  // Batch-build all landscape trees as individual groups (with scale)
  // ~40% chance each tree is a sapin (stylized pine) instead of standard tree
  for (let t = 0; t < treePlacements.length; t++) {
    const tp = treePlacements[t];
    const useSapin = rand() < 0.75; // 75% sapin, 25% standard tree

    let tree;
    if (useSapin) {
      tree = createSapinTree(null, {
        seed: tp.treeSeed,
        radius: tp.radius,
        position: { x: tp.x, y: 0, z: tp.z },
      });
      tree.name = `landscape_sapin_${t}`;
      tree.scale.setScalar(1.2);
    } else {
      tree = createStandaloneTree(null, {
        seed: tp.treeSeed,
        radius: tp.radius,
        position: { x: tp.x, y: 0, z: tp.z },
      });
      tree.name = `landscape_tree_${t}`;
      tree.scale.setScalar(1.4);
    }
    group.add(tree);
  }

  // ── Collect bush placements, then batch-build ──
  const bushCount = 3 + Math.floor(rand() * 3); // 3–5 (max 5)
  const bushPlacements = [];

  for (let b = 0; b < bushCount; b++) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const gx = Math.floor(rand() * GRID);
      const gz = Math.floor(rand() * GRID);
      if (isFree(gx, gz, 1, 1)) {
        markOccupied(gx, gz, 1, 1);
        const pos = gridToWorld(gx, gz);
        bushPlacements.push({
          x: pos.x, z: pos.z,
          radius: 0.18 + rand() * 0.12,
          bushSeed: seed * 300 + b,
        });
        break;
      } else {
        rand(); // consume to keep determinism
      }
    }
  }

  for (let b = 0; b < bushPlacements.length; b++) {
    const bp = bushPlacements[b];
    const bush = createStandaloneBush(null, {
      seed: bp.bushSeed,
      radius: bp.radius,
      position: { x: bp.x, y: 0, z: bp.z },
    });
    bush.name = `landscape_bush_${b}`;
    bush.scale.setScalar(0.75);
    group.add(bush);
  }

  // ── Place pillar bushes in 5 clustered spots (2–3 per spot, max 15 total) ──
  const pillarPlacements = [];
  const PILLAR_CELL = 2; // each pillar bush occupies 2×2 cells
  const MAX_PILLAR_BUSHES = 15;
  const clusterSpots = []; // { anchorGx, anchorGz }

  // Find 5 anchor spots spread across the grid
  for (let s = 0; s < 5; s++) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const gx = Math.floor(rand() * (GRID - 6)) + 1;
      const gz = Math.floor(rand() * (GRID - 6)) + 1;

      // Check that a 6×4 area is mostly free (room for 2–3 adjacent pillar bushes)
      let hasRoom = true;
      for (let dx = 0; dx < 6; dx++) {
        for (let dz = 0; dz < 4; dz++) {
          if (occupied[idx(gx + dx, gz + dz)]) { hasRoom = false; break; }
        }
        if (!hasRoom) break;
      }

      // Make sure this spot isn't too close to other cluster anchors
      if (hasRoom && clusterSpots.length > 0) {
        for (const prev of clusterSpots) {
          const dist = Math.abs(gx - prev.anchorGx) + Math.abs(gz - prev.anchorGz);
          if (dist < 6) { hasRoom = false; break; }
        }
      }

      if (hasRoom) {
        clusterSpots.push({ anchorGx: gx, anchorGz: gz });
        break;
      } else {
        rand(); // consume to keep determinism
      }
    }
  }

  // Size tiers for cluster spots — creates natural layered variation
  // Each tier defines: base radius range, scale, and slight height emphasis
  const CLUSTER_SIZE_TIERS = [
    { radiusMin: 0.16, radiusMax: 0.22, scale: 0.75 }, // large
    { radiusMin: 0.12, radiusMax: 0.17, scale: 0.60 }, // medium
    { radiusMin: 0.08, radiusMax: 0.13, scale: 0.45 }, // small
  ];

  // For each anchor spot, place 2–3 pillar bushes in adjacent cells (capped at 15 total)
  let pillarIdx = 0;
  for (let s = 0; s < clusterSpots.length; s++) {
    if (pillarPlacements.length >= MAX_PILLAR_BUSHES) break;
    const spot = clusterSpots[s];
    const countInCluster = 2 + (rand() > 0.5 ? 1 : 0); // 2 or 3

    // Assign a size tier to this cluster spot for natural variation
    const tier = CLUSTER_SIZE_TIERS[s % CLUSTER_SIZE_TIERS.length];

    // Offsets for tightly packed neighbors (each pillar is 2×2 cells)
    const neighborOffsets = [
      { dx: 0, dz: 0 },
      { dx: PILLAR_CELL, dz: 0 },              // right neighbor
      { dx: PILLAR_CELL - 1, dz: PILLAR_CELL }, // below-right, slightly overlapping column
    ];

    for (let c = 0; c < countInCluster; c++) {
      if (pillarPlacements.length >= MAX_PILLAR_BUSHES) break;
      const off = neighborOffsets[c];
      const gx = spot.anchorGx + off.dx;
      const gz = spot.anchorGz + off.dz;

      if (gx + PILLAR_CELL <= GRID && gz + PILLAR_CELL <= GRID && isFree(gx, gz, PILLAR_CELL, PILLAR_CELL)) {
        markOccupied(gx, gz, PILLAR_CELL, PILLAR_CELL);
        const pos = gridToWorld(gx, gz);
        // Per-bush jitter within the tier range for subtle variation within a cluster
        const bushJitter = 0.85 + rand() * 0.3; // 0.85–1.15
        pillarPlacements.push({
          x: pos.x, z: pos.z,
          radius: tier.radiusMin + rand() * (tier.radiusMax - tier.radiusMin),
          clusterScale: tier.scale * bushJitter,
          pillarSeed: seed * 600 + pillarIdx,
        });
        pillarIdx++;
      } else {
        rand(); // consume for determinism
      }
    }
  }

  for (let p = 0; p < pillarPlacements.length; p++) {
    const pp = pillarPlacements[p];
    const pillarBush = createPillarBush(null, {
      seed: pp.pillarSeed,
      radius: pp.radius,
      position: { x: pp.x, y: 0, z: pp.z },
    });
    pillarBush.name = `landscape_pillarBush_${p}`;
    pillarBush.scale.setScalar(pp.clusterScale);
    group.add(pillarBush);
  }

  // ── Place flower clusters (random 3–10 cells wide/deep) ──
  const flowerClusterCount = 2 + Math.floor(rand() * 3); // 2–4
  let flowerIdx = 0;
  const landscapeButterflies = []; // collect all butterfly data for animation

  for (let f = 0; f < flowerClusterCount; f++) {
    const fw = 3 + Math.floor(rand() * 8); // 3–10 cells wide
    const fd = 3 + Math.floor(rand() * 8); // 3–10 cells deep

    for (let attempt = 0; attempt < 50; attempt++) {
      const gx = Math.floor(rand() * (GRID - fw));
      const gz = Math.floor(rand() * (GRID - fd));
      if (isFree(gx, gz, fw, fd)) {
        markOccupied(gx, gz, fw, fd);
        const cx = gx + fw / 2;
        const cz = gz + fd / 2;
        const pos = gridToWorld(Math.floor(cx), Math.floor(cz));
        const fieldR = Math.max(fw, fd) * CELL * 0.6;
        // Reject callback: prevent flowers on road cells
        // Flower local coords are relative to cluster center (pos.x, pos.z)
        const rejectFn = (localX, localZ) => {
          const worldX = pos.x + localX;
          const worldZ = pos.z + localZ;
          // Convert world coords back to grid coords
          const cellX = Math.floor((worldX + HALF) / CELL);
          const cellZ = Math.floor((worldZ + HALF) / CELL);
          if (cellX < 0 || cellX >= GRID || cellZ < 0 || cellZ >= GRID) return true;
          const cellVal = occupied[idx(cellX, cellZ)];
          return cellVal === 3; // 3 = road
        };
        const flowers = buildFlowerGrove({
          count: 8 + Math.floor(rand() * 8) * Math.min(fw, fd),
          fieldRadius: fieldR,
          seed: seed * 400 + f,
          rejectFn,
        });
        flowers.position.set(pos.x, 0, pos.z);
        flowers.name = `landscape_flowers_${flowerIdx++}`;
        group.add(flowers);

        // Attach butterflies to each flower field (max 3 per field for performance)
        const bflies = createButterflies(flowers, {
          count: 2 + Math.floor(rand() * 2), // 2–3 per field
          fieldRadius: fieldR,
          seed: seed * 400 + f + 9999,
        });
        landscapeButterflies.push(...bflies);
        break;
      }
    }
  }

  // Store butterfly data on the group so scene.js can manage animation
  group.userData.landscapeButterflies = landscapeButterflies;

  // ── Place benches near destination points (3 benches) ──
  const BENCH_COUNT = 3;
  let benchIdx = 0;
  const benchCellSize = 3; // bench occupies ~3x2 cells
  const placedBenchCells = []; // track placed bench grid positions
  const MIN_BENCH_DIST = 10; // minimum grid-cell distance between benches

  // Shuffle destination points to pick random ones
  const shuffledDests = [...roadPoints];
  for (let i = shuffledDests.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffledDests[i], shuffledDests[j]] = [shuffledDests[j], shuffledDests[i]];
  }

  for (let d = 0; d < shuffledDests.length && benchIdx < BENCH_COUNT; d++) {
    const dest = shuffledDests[d];

    // Search in a ring around the destination point for a free spot
    let placed = false;
    for (let radius = 2; radius <= 5 && !placed; radius++) {
      for (let attempt = 0; attempt < 20 && !placed; attempt++) {
        // Pick a random offset at this radius from the destination
        const angle = rand() * Math.PI * 2;
        const gx = Math.round(dest.x + Math.cos(angle) * radius);
        const gz = Math.round(dest.z + Math.sin(angle) * radius);

        // Bounds check
        if (gx < 1 || gz < 1 || gx + benchCellSize >= GRID - 1 || gz + 2 >= GRID - 1) continue;

        // Cell must be free
        if (!isFree(gx, gz, benchCellSize, 2)) continue;

        // Enforce minimum distance from other benches
        let tooClose = false;
        for (const prev of placedBenchCells) {
          const ddx = gx - prev.x;
          const ddz = gz - prev.z;
          if (Math.sqrt(ddx * ddx + ddz * ddz) < MIN_BENCH_DIST) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        // Compute direction from bench toward the destination point (road)
        const dx = dest.x - gx;
        const dz = dest.z - gz;
        const benchAngle = Math.atan2(dx, dz) + Math.PI;

        // Mark cells as occupied
        markOccupied(gx, gz, benchCellSize, 2);
        placedBenchCells.push({ x: gx, z: gz });

        const pos = gridToWorld(gx + 1, gz);
        const bench = createStandaloneBench(null, {
          seed: seed * 900 + benchIdx,
          position: { x: pos.x, y: 0, z: pos.z },
          scale: 0.8,
        });
        bench.rotation.y = benchAngle;
        bench.name = `landscape_bench_${benchIdx}`;
        // Store bench facing info so scene.js can create InteractionBoxes
        bench.userData.benchAngle = benchAngle;
        bench.userData.isBench = true;
        benchIdx++;
        group.add(bench);
        placed = true;
      }
    }
  }

  // Center the whole landscape
  group.position.set(0, 0, 0);

  return group;
}