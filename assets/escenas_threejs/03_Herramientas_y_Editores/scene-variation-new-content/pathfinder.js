// ─── Pathfinder: BFS on block grid ───
// Rules:
//   - Player walks on the TOP surface of blocks (surface y = block.y + block.h)
//   - Same-height horizontal movement is allowed ONLY if no block body obstructs the path
//   - Height changes (+1 / -1) require a STAIR block at either the source or destination
//   - Tall blocks (h >= 2) act as walls — you cannot walk sideways into a cell whose block
//     body occupies the elevation you're standing on

export class Pathfinder {

  static find(blocks, from, to) {
    const key = (x, y, z) => `${x},${y},${z}`;

    // ── Build lookup structures ──

    // surfMap: key(x, surfaceY, z) → { x, y (surface), z, block }
    const surfMap = new Map();
    // blockAt: key(x, z) → block  (raw block data for occupancy checks)
    const blockAt = new Map();

    blocks.forEach(b => {
      // Water blocks are not walkable
      if (b.type === 'water') return;

      const surfY = b.y + b.h;              // walkable surface height
      const sk = key(b.x, surfY, b.z);
      // If multiple blocks at same (x,z), keep the one whose surface is at surfY
      // Movable blocks get priority so the player can walk on/off them
      if (!surfMap.has(sk) || b.isMovable) {
        surfMap.set(sk, { x: b.x, y: surfY, z: b.z, block: b });
      }
      // blockAt stores the tallest block at (x,z) for obstruction checks
      const bk = `${b.x},${b.z}`;
      const prev = blockAt.get(bk);
      if (!prev || (b.y + b.h) > (prev.y + prev.h)) {
        blockAt.set(bk, b);
      }
    });

    const startKey = key(from.x, from.y, from.z);
    const endKey   = key(to.x, to.y, to.z);

    if (!surfMap.has(startKey) || !surfMap.has(endKey)) return null;
    if (startKey === endKey) return [];

    // ── Helper: does a block body at (bx, bz) obstruct a given elevation? ──
    // A block occupies y-range [ block.y , block.y + block.h )
    const bodyObstructs = (bx, bz, elevation) => {
      const b = blockAt.get(`${bx},${bz}`);
      if (!b) return false;
      // Block body spans from b.y to b.y + b.h
      // Player feet are at `elevation` (the surface they stand on)
      // Player occupies roughly elevation .. elevation + 1
      // If the block body overlaps that band, it's a wall
      const bodyBot = b.y;
      const bodyTop = b.y + b.h;
      const playerBot = elevation;
      const playerTop = elevation + 1;   // assume 1-unit player height
      return bodyTop > playerBot && bodyBot < playerTop;
    };

    // ── Helper: is there a stair connecting current ↔ neighbour for a height change? ──
    const hasStairConnection = (curSurf, nbrSurf) => {
      // A stair at the SOURCE means the player can walk off it to a different height
      // A stair at the DEST means the player can walk onto it from a different height
      const srcBlock = curSurf.block;
      const dstBlock = nbrSurf.block;
      return srcBlock.type === 'stair' || dstBlock.type === 'stair';
    };

    // ── BFS ──
    const visited = new Set();
    const queue = [{ key: startKey, path: [] }];
    visited.add(startKey);

    const dirs = [
      { dx: 1, dz: 0 },
      { dx: -1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 0, dz: -1 }
    ];

    while (queue.length > 0) {
      const { key: currKey, path } = queue.shift();
      const [cx, cy, cz] = currKey.split(',').map(Number);
      const curSurf = surfMap.get(currKey);

      for (const d of dirs) {
        const nx = cx + d.dx;
        const nz = cz + d.dz;

        // Try same height and ±1 height
        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          const nk = key(nx, ny, nz);

          if (visited.has(nk)) continue;
          if (!surfMap.has(nk)) continue;

          const nbrSurf = surfMap.get(nk);

          // ── Rule 1: height change requires a stair ──
          if (dy !== 0) {
            if (!hasStairConnection(curSurf, nbrSurf)) continue;
          }

          // ── Rule 2: destination block body must not act as a wall ──
          // If moving at the SAME elevation, the neighbour's block body must not
          // block the player's walking band. For same-height moves the surface
          // equals cy, so we only worry about blocks whose body rises ABOVE that.
          // (The surface we're moving TO is at ny, so it's fine — but any SECOND
          // block stacked in that cell would block.)  We already know a surface
          // exists at ny for the destination, so we just check the body doesn't
          // obstruct our current elevation when dy == 0.
          if (dy === 0 && bodyObstructs(nx, nz, cy) && nbrSurf.y !== cy) {
            continue;
          }

          // ── Rule 3: make sure we can leave the current cell in this direction ──
          // Check if the neighbour cell has a block body that walls off at our
          // current walking elevation (the band cy .. cy+1). If the destination
          // surface is at the same height it's fine (we'll step onto it), but if
          // there is a tall block body in between that is higher than where we
          // want to go, block it.
          if (dy === 0) {
            const nb = blockAt.get(`${nx},${nz}`);
            if (nb) {
              const nbTop = nb.y + nb.h;
              // If the neighbour block's TOP is above where we walk + 1 and its
              // body overlaps our elevation, we can't squeeze through.
              if (nb.y < cy && nbTop > cy + 1) continue;
            }
          }

          const newPath = [...path, { x: nx, y: ny, z: nz }];

          if (nk === endKey) return newPath;

          visited.add(nk);
          queue.push({ key: nk, path: newPath });
        }
      }
    }

    return null; // No path found
  }
}