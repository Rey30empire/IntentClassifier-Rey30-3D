// ─── Scene Builder: Creates Three.js meshes from level data ───
import * as THREE from 'three/webgpu';

export const PALETTE = {
  blockTop: 0xff7c5c,
  blockSide: 0xff7070,
  blockDark: 0xdf5050,
  stair: 0xff7070,
  pillar: 0xff8080,
  arch: 0xe05c3c,
  dome: 0x575757,
  window: 0xfff4e6,
  accent: 0xff7070,
  accentDark: 0xdf5050,
  cream: 0xff957a,
};

export class SceneBuilder {
  static cellSize = 0.6;

  static build(levelData, cellSize) {
    if (cellSize !== undefined) SceneBuilder.cellSize = cellSize;
    const meshes = [];
    const blocks = levelData.blocks || [];

    // Build a set of water block positions for neighbor lookup
    const waterSet = new Set();
    blocks.forEach(b => {
      if (b.type === 'water') waterSet.add(`${b.x},${b.y},${b.z}`);
    });

    blocks.forEach(block => {
      const group = SceneBuilder.createBlock(block, waterSet);
      meshes.push(group);
    });

    return meshes;
  }

  static createBlock(block, waterSet) {
    const s = SceneBuilder.cellSize;
    const group = new THREE.Group();
    group.position.set(block.x * s, block.y * s, block.z * s);
    group.userData = { blockData: block };

    switch (block.type) {
      case 'block': SceneBuilder.addBlock(group, block); break;
      case 'stair': SceneBuilder.addStair(group, block); break;
      case 'pillar': SceneBuilder.addPillar(group, block); break;
      case 'arch': SceneBuilder.addArch(group, block); break;
      case 'dome': SceneBuilder.addDome(group, block); break;
      case 'water': SceneBuilder.addWater(group, block, waterSet); break;
      default: SceneBuilder.addBlock(group, block); break;
    }

    // Apply rotation from angle property (0, 90, 180, 270 degrees)
    if (block.angle) {
      group.rotation.y = (block.angle * Math.PI) / 180;
    }

    return group;
  }

  static addBlock(group, block) {
    const s = SceneBuilder.cellSize;
    const h = (block.h || 1) * s;
    const geo = new THREE.BoxGeometry(s, h, s);
    const topMat = new THREE.MeshStandardMaterial({
      color: PALETTE.blockTop, roughness: 0.85, metalness: 0.05
    });
    topMat._paletteKey = 'blockTop';
    const sideMat = new THREE.MeshStandardMaterial({
      color: PALETTE.blockSide, roughness: 0.9, metalness: 0.05
    });
    sideMat._paletteKey = 'blockSide';
    const bottomMat = new THREE.MeshStandardMaterial({
      color: PALETTE.blockDark, roughness: 0.95, metalness: 0.05
    });
    bottomMat._paletteKey = 'blockDark';

    const mesh = new THREE.Mesh(geo, [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat]);
    mesh.position.y = h / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Decorative line on top
    if ((block.h || 1) >= 2) {
      const lineGeo = new THREE.BoxGeometry(s * 1.02, 0.06 * s, s * 1.02);
      const lineMat = new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.8 });
      lineMat._paletteKey = 'cream';
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.y = h - 0.3 * s;
      group.add(line);
    }

    // Windows for tall blocks (h >= 3)
    if ((block.h || 1) >= 3) {
      SceneBuilder.addWindows(group, block, s, h);
    }

    // Edge detail
    const edgeGeo = new THREE.BoxGeometry(s * 1.01, 0.04 * s, s * 1.01);
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.15
    });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.y = h;
    group.add(edge);
  }

  static addWindows(group, block, s, h) {
    const winMat = new THREE.MeshStandardMaterial({
      color: PALETTE.window, roughness: 1.0, metalness: 0.0
    });
    winMat._paletteKey = 'window';

    const bh = block.h || 1;
    // Window dimensions
    const winW = s * 0.16;
    const winH = s * 0.35;
    const winDepth = 0.02 * s;
    const archRadius = winW / 2;

    // Create window shape: rectangle with rounded (arch) top
    const shape = new THREE.Shape();
    shape.moveTo(-winW / 2, 0);
    shape.lineTo(-winW / 2, winH - archRadius);
    shape.absarc(0, winH - archRadius, archRadius, Math.PI, 0, true);
    shape.lineTo(winW / 2, 0);
    shape.lineTo(-winW / 2, 0);

    const winGeo = new THREE.ExtrudeGeometry(shape, {
      depth: winDepth, bevelEnabled: false
    });

    // Determine how many rows of windows (one per full cell height, skip top and bottom)
    const startRow = 1;
    const endRow = bh - 1;

    // Place windows on all 4 faces
    const faces = [
      { dir: 'front', offsetX: 0, offsetZ: s / 2 + 0.001, rotY: 0 },
      { dir: 'back', offsetX: 0, offsetZ: -s / 2 - 0.001, rotY: Math.PI },
      { dir: 'left', offsetX: -s / 2 - 0.001, offsetZ: 0, rotY: -Math.PI / 2 },
      { dir: 'right', offsetX: s / 2 + 0.001, offsetZ: 0, rotY: Math.PI / 2 },
    ];

    for (let row = startRow; row <= endRow; row++) {
      const yCenter = row * s + s * 0.15;

      // For wide blocks, place 2 windows side by side; otherwise 1
      const windowPositions = [-s * 0.18, s * 0.18];

      for (const face of faces) {
        for (const lateral of windowPositions) {
          const win = new THREE.Mesh(winGeo, winMat);

          // Position along the face
          if (face.dir === 'front' || face.dir === 'back') {
            win.position.set(lateral, yCenter, face.offsetZ);
          } else {
            win.position.set(face.offsetX, yCenter, lateral);
          }

          win.rotation.y = face.rotY;
          win.name = `window_${face.dir}_${row}`;
          group.add(win);
        }
      }
    }
  }

  static addStair(group, block) {
    const s = SceneBuilder.cellSize;
    const h = (block.h || 1) * s;
    const steps = 4;
    const stepH = h / steps;
    const stepD = s / steps;
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.stair, roughness: 0.85, metalness: 0.05
    });
    mat._paletteKey = 'stair';

    // Container for the steps so we can rotate the whole stair
    const stairGroup = new THREE.Group();
    stairGroup.name = 'stairSteps';

    for (let i = 0; i < steps; i++) {
      const sh = stepH * (i + 1);
      const geo = new THREE.BoxGeometry(s, sh, stepD);
      const step = new THREE.Mesh(geo, mat);
      step.position.set(0, sh / 2, -s / 2 + stepD / 2 + i * stepD);
      step.castShadow = true;
      step.receiveShadow = true;
      stairGroup.add(step);
    }

    // Default stair faces +Z (flipped 180°), angle rotation handled at group level
    stairGroup.rotation.y = Math.PI;

    group.add(stairGroup);
  }

  static addPillar(group, block) {
    const s = SceneBuilder.cellSize;
    const h = (block.h || 3) * s;

    // Base
    const baseGeo = new THREE.BoxGeometry(s, 0.2 * s, s);
    const baseMat = new THREE.MeshStandardMaterial({ color: PALETTE.blockDark, roughness: 0.9 });
    baseMat._paletteKey = 'blockDark';
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.1 * s;
    base.castShadow = true;
    group.add(base);

    // Column
    const colGeo = new THREE.BoxGeometry(0.7 * s, h - 0.4 * s, 0.7 * s);
    const colMat = new THREE.MeshStandardMaterial({ color: PALETTE.pillar, roughness: 0.85 });
    colMat._paletteKey = 'pillar';
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.y = h / 2;
    col.castShadow = true;
    col.receiveShadow = true;
    group.add(col);

    // Cap
    const capGeo = new THREE.BoxGeometry(s, 0.2 * s, s);
    const cap = new THREE.Mesh(capGeo, baseMat);
    cap.position.y = h - 0.1 * s;
    cap.castShadow = true;
    group.add(cap);

    // Decorative bands
    for (let i = 1; i < (block.h || 3) - 1; i++) {
      const bandGeo = new THREE.BoxGeometry(0.75 * s, 0.05 * s, 0.75 * s);
      const bandMat = new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.8 });
      bandMat._paletteKey = 'cream';
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = i * s;
      group.add(band);
    }
  }

  static addArch(group, block) {
    const s = SceneBuilder.cellSize;
    const bh = block.h || 3;
    const h = bh * s;

    const sideMat = new THREE.MeshStandardMaterial({ color: PALETTE.blockSide, roughness: 0.85, metalness: 0.05 });
    sideMat._paletteKey = 'blockSide';
    const topMat = new THREE.MeshStandardMaterial({ color: PALETTE.blockTop, roughness: 0.85, metalness: 0.05 });
    topMat._paletteKey = 'blockTop';
    const darkMat = new THREE.MeshStandardMaterial({ color: PALETTE.blockDark, roughness: 0.9, metalness: 0.05 });
    darkMat._paletteKey = 'blockDark';
    const creamMat = new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.8 });
    creamMat._paletteKey = 'cream';

    // === Arch wall shape: full rectangle with arched opening cut out ===
    // Wall dimensions
    const wallW = s;          // full cell width
    const wallH = h;          // full cell height
    const wallD = s * 0.25;   // wall depth/thickness

    // Arch opening dimensions
    const openW = s * 0.48;   // opening width
    const archR = openW / 2;  // arch radius = half opening width
    const legH = h * 0.35;    // straight leg height before arch curve starts
    const archTopY = legH + archR; // top of arch curve

    // Create the wall shape (full rectangle)
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-wallW / 2, 0);
    wallShape.lineTo(-wallW / 2, wallH);
    wallShape.lineTo(wallW / 2, wallH);
    wallShape.lineTo(wallW / 2, 0);
    wallShape.lineTo(-wallW / 2, 0);

    // Cut out the arch hole
    const holePath = new THREE.Path();
    holePath.moveTo(-openW / 2, 0);
    holePath.lineTo(-openW / 2, legH);
    holePath.absarc(0, legH, archR, Math.PI, 0, true); // arch curve top
    holePath.lineTo(openW / 2, 0);
    holePath.lineTo(-openW / 2, 0);
    wallShape.holes.push(holePath);

    // Extrude the wall with arch cutout — front face
    const wallGeo = new THREE.ExtrudeGeometry(wallShape, {
      depth: wallD, bevelEnabled: false
    });
    const frontWall = new THREE.Mesh(wallGeo, sideMat);
    frontWall.position.set(0, 0, s / 2 - wallD);
    frontWall.castShadow = true;
    frontWall.receiveShadow = true;
    frontWall.name = 'arch_front_wall';
    group.add(frontWall);

    // Back wall (same shape, positioned at back)
    const backWall = new THREE.Mesh(wallGeo, sideMat);
    backWall.position.set(0, 0, -s / 2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    backWall.name = 'arch_back_wall';
    group.add(backWall);

    // === Side walls (connecting front and back, solid) ===
    const sideGeo = new THREE.BoxGeometry(wallD, wallH, s - wallD * 2);
    // Left side
    const leftSide = new THREE.Mesh(sideGeo, sideMat);
    leftSide.position.set(-wallW / 2 + wallD / 2, wallH / 2, 0);
    leftSide.castShadow = true;
    leftSide.name = 'arch_left_side';
    group.add(leftSide);

    // Right side
    const rightSide = new THREE.Mesh(sideGeo, sideMat);
    rightSide.position.set(wallW / 2 - wallD / 2, wallH / 2, 0);
    rightSide.castShadow = true;
    rightSide.name = 'arch_right_side';
    group.add(rightSide);

    // === Top slab ===
    const topCapH = s * 0.18;
    const topGeo = new THREE.BoxGeometry(s * 1.02, topCapH, s * 1.02);
    const topCap = new THREE.Mesh(topGeo, [sideMat, sideMat, topMat, darkMat, sideMat, sideMat]);
    topCap.position.y = wallH + topCapH / 2;
    topCap.castShadow = true;
    topCap.receiveShadow = true;
    topCap.name = 'arch_top_cap';
    group.add(topCap);

    // === Decorative band below the top cap ===
    const bandGeo = new THREE.BoxGeometry(s * 1.04, 0.05 * s, s * 1.04);
    const band = new THREE.Mesh(bandGeo, creamMat);
    band.position.y = wallH - 0.02 * s;
    band.name = 'arch_cream_band';
    group.add(band);

    // === Inner arch ceiling surface (curved soffit connecting front & back walls) ===
    const soffitSegs = 16;
    const soffitD = s - wallD * 2; // distance between front and back inner faces
    const soffitVerts = [];
    const soffitIndices = [];
    const soffitNormals = [];

    for (let i = 0; i <= soffitSegs; i++) {
      const angle = Math.PI - (i / soffitSegs) * Math.PI; // from PI to 0
      const cx = Math.cos(angle) * archR;
      const cy = Math.sin(angle) * archR + legH;
      // front edge
      soffitVerts.push(cx, cy, soffitD / 2);
      // back edge
      soffitVerts.push(cx, cy, -soffitD / 2);
      // normal points inward toward center of arch
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      soffitNormals.push(-nx, -ny, 0);
      soffitNormals.push(-nx, -ny, 0);
    }

    for (let i = 0; i < soffitSegs; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      soffitIndices.push(a, c, b);
      soffitIndices.push(b, c, d);
    }

    const soffitGeo = new THREE.BufferGeometry();
    soffitGeo.setAttribute('position', new THREE.Float32BufferAttribute(soffitVerts, 3));
    soffitGeo.setAttribute('normal', new THREE.Float32BufferAttribute(soffitNormals, 3));
    soffitGeo.setIndex(soffitIndices);

    const soffitMesh = new THREE.Mesh(soffitGeo, darkMat);
    soffitMesh.name = 'arch_soffit';
    group.add(soffitMesh);

    // === Floor/base slab ===
    const baseH = 0.08 * s;
    const baseGeo = new THREE.BoxGeometry(s * 1.01, baseH, s * 1.01);
    const baseMesh = new THREE.Mesh(baseGeo, darkMat);
    baseMesh.position.y = baseH / 2;
    baseMesh.receiveShadow = true;
    baseMesh.name = 'arch_base';
    group.add(baseMesh);

    // === Edge detail on top ===
    const edgeGeo = new THREE.BoxGeometry(s * 1.01, 0.04 * s, s * 1.01);
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.15
    });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.y = wallH + topCapH;
    edge.name = 'arch_edge';
    group.add(edge);
  }

  static addDome(group, block) {
    const s = SceneBuilder.cellSize;

    // Dome sphere
    const domeGeo = new THREE.SphereGeometry(0.45 * s, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
      color: PALETTE.dome, roughness: 0.6, metalness: 0.15
    });
    domeMat._paletteKey = 'dome';
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0;
    dome.castShadow = true;
    group.add(dome);

    // Base ring
    const ringGeo = new THREE.BoxGeometry(0.95 * s, 0.15 * s, 0.95 * s);
    const ringMat = new THREE.MeshStandardMaterial({ color: PALETTE.blockDark, roughness: 0.9 });
    ringMat._paletteKey = 'blockDark';
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0;
    group.add(ring);

    // Spire
    const spireGeo = new THREE.ConeGeometry(0.04 * s, 0.35 * s, 8);
    const spireMat = new THREE.MeshStandardMaterial({ color: PALETTE.dome, roughness: 0.5, metalness: 0.3 });
    spireMat._paletteKey = 'dome';
    const spire = new THREE.Mesh(spireGeo, spireMat);
    spire.position.y = 0.6 * s;
    group.add(spire);
  }

  static addWater(group, block, waterSet) {
    const s = SceneBuilder.cellSize;
    const h = (block.h || 1) * s;

    // Check which neighbors are also water blocks (same y, same h)
    const key = (dx, dz) => `${block.x + dx},${block.y},${block.z + dz}`;
    const hasPX = waterSet && waterSet.has(key(1, 0));   // +X neighbor
    const hasNX = waterSet && waterSet.has(key(-1, 0));  // -X neighbor
    const hasPZ = waterSet && waterSet.has(key(0, 1));   // +Z neighbor
    const hasNZ = waterSet && waterSet.has(key(0, -1));  // -Z neighbor

    // Helper: build a box with selective faces removed
    // Face order for BoxGeometry: +X, -X, +Y, -Y, +Z, -Z (groups 0-5)
    function buildSelectiveFaceBox(width, height, depth, skipFaces) {
      const geo = new THREE.BoxGeometry(width, height, depth);
      // Remove triangles for skipped faces by setting their indices to degenerate (0,0,0)
      const index = geo.index;
      const indexArr = index.array;
      for (const faceIdx of skipFaces) {
        // Each face has 2 triangles = 6 indices, starting at faceIdx * 6
        const start = faceIdx * 6;
        for (let i = start; i < start + 6; i++) {
          indexArr[i] = 0;
        }
      }
      index.needsUpdate = true;
      return geo;
    }

    // Determine which faces to skip for the stone base
    const baseSkip = [];
    if (hasPX) baseSkip.push(0);  // skip +X face
    if (hasNX) baseSkip.push(1);  // skip -X face
    if (hasPZ) baseSkip.push(4);  // skip +Z face
    if (hasNZ) baseSkip.push(5);  // skip -Z face

    // Stone base underneath (lower portion)
    const baseH = h * 0.7;
    const baseGeo = baseSkip.length > 0
      ? buildSelectiveFaceBox(s, baseH, s, baseSkip)
      : new THREE.BoxGeometry(s, baseH, s);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x3a5a5a, roughness: 0.95, metalness: 0.05
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.name = 'waterBase';
    base.position.y = baseH / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Water surface on top — skip same neighbor faces
    const waterH = h * 0.3;
    const waterGeo = baseSkip.length > 0
      ? buildSelectiveFaceBox(s, waterH, s, baseSkip)
      : new THREE.BoxGeometry(s, waterH, s);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x48b0a0,
      roughness: 0.05,
      metalness: 0.4,
      transparent: true,
      opacity: 0.8,
      emissive: 0x1a6a6a,
      emissiveIntensity: 0.3,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.name = 'waterSurface';
    water.position.y = baseH + waterH / 2;
    water.receiveShadow = true;
    group.add(water);
  }
}