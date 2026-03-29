// ─── Editor Controller ───
import * as THREE from 'three/webgpu';

// Pure math plane for raycasting — no mesh needed, works reliably with WebGPU
const _editorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _editorIntersect = new THREE.Vector3();

export class EditorController {
  static currentTool = 'block';
  static currentHeight = 1;
  static currentAngle = 0; // 0, 90, 180, 270 degrees — rotation for any block
  static currentYLevel = 0;  // base Y for placing blocks (supports negative)
  static mvMin = -3;  // movable range min
  static mvMax = 3;   // movable range max

  static isMovableTool(tool) {
    return tool === 'mv-x' || tool === 'mv-z' || tool === 'mv-y';
  }

  static handleClick(raycaster, state, scene, rebuildCallback, cs) {
    const s = cs || window.CELL_SIZE || 0.6;
    const ops = window._editorOps;

    // Raycast onto math plane at the current Y level (no mesh required)
    _editorPlane.constant = -EditorController.currentYLevel * s;
    const hit = raycaster.ray.intersectPlane(_editorPlane, _editorIntersect);
    if (!hit) return;

    const point = _editorIntersect;
    const gx = Math.round(point.x / s);
    const gz = Math.round(point.z / s);
    const useY = EditorController.currentYLevel;

    if (EditorController.currentTool === 'eraser') {
      const idx = state.levelData.blocks.findIndex(b => b.x === gx && b.z === gz && b.y === useY);
      if (idx !== -1) {
        state.levelData.blocks.splice(idx, 1);
        if (ops) ops.removeBlockFast(gx, useY, gz);
      } else {
        // Fallback: erase any block at x,z
        const idx2 = state.levelData.blocks.findIndex(b => b.x === gx && b.z === gz);
        if (idx2 !== -1) {
          const removedBlock = state.levelData.blocks[idx2];
          state.levelData.blocks.splice(idx2, 1);
          if (ops) ops.removeBlockFast(gx, removedBlock.y, gz);
        }
      }
      // Also check for teleport pads at this position
      if (state.levelData.teleports) {
        const tpIdx = state.levelData.teleports.findIndex(t => t.x === gx && t.z === gz && t.y === useY);
        if (tpIdx !== -1) {
          state.levelData.teleports.splice(tpIdx, 1);
          if (rebuildCallback) rebuildCallback();
        }
      }
      // Also check for movables at this position
      if (state.levelData.movables) {
        const mvIdx = state.levelData.movables.findIndex(m => m.x === gx && m.z === gz && m.y === useY);
        if (mvIdx !== -1) {
          state.levelData.movables.splice(mvIdx, 1);
          if (rebuildCallback) rebuildCallback();
        }
      }
      return;
    }

    if (EditorController.currentTool === 'rotate') {
      const existing = state.levelData.blocks.find(b => b.x === gx && b.z === gz && b.y === useY);
      if (existing) {
        if (ops) ops.removeBlockFast(existing.x, existing.y, existing.z);
        existing.angle = ((existing.angle || 0) + 90) % 360;
        if (ops) ops.addBlockFast(existing);
      }
      return;
    }

    // Teleport pad tools — manage teleports array on levelData
    if (EditorController.currentTool === 'tp-a' || EditorController.currentTool === 'tp-b') {
      if (!state.levelData.teleports) state.levelData.teleports = [];
      const isA = EditorController.currentTool === 'tp-a';
      const id = isA ? 'A' : 'B';
      const pairId = isA ? 'B' : 'A';

      // Remove existing teleport with same id (only one A and one B allowed)
      const existIdx = state.levelData.teleports.findIndex(t => t.id === id);
      if (existIdx !== -1) {
        state.levelData.teleports.splice(existIdx, 1);
      }

      state.levelData.teleports.push({ id, x: gx, y: useY, z: gz, pairId });

      // Rebuild to show pads (teleport pads need full rebuild)
      if (rebuildCallback) rebuildCallback();
      return;
    }

    // Movable block tools — place a movable with axis and range
    if (EditorController.isMovableTool(EditorController.currentTool)) {
      if (!state.levelData.movables) state.levelData.movables = [];

      // Don't place if one already exists at this position
      const existMv = state.levelData.movables.find(m => m.x === gx && m.z === gz && m.y === useY);
      if (existMv) return;

      const axisMap = { 'mv-x': 'x', 'mv-z': 'z', 'mv-y': 'y' };
      const axis = axisMap[EditorController.currentTool];
      const rangeMin = EditorController.mvMin;
      const rangeMax = EditorController.mvMax;

      const newMovable = {
        x: gx, y: useY, z: gz,
        h: EditorController.currentHeight,
        axis: axis,
        range: [rangeMin, rangeMax],
        type: 'block'
      };
      state.levelData.movables.push(newMovable);

      // Rebuild to show the movable block with rail
      if (rebuildCallback) rebuildCallback();
      return;
    }

    // Block/stair/etc tools — place new block (don't replace existing at same position)
    const existing = state.levelData.blocks.find(b => b.x === gx && b.z === gz && b.y === useY);
    if (existing) {
      return; // block already exists here, do nothing
    }
    const newBlock = {
      x: gx, y: useY, z: gz,
      h: EditorController.currentHeight,
      type: EditorController.currentTool,
      angle: EditorController.currentAngle
    };
    state.levelData.blocks.push(newBlock);
    if (ops) ops.addBlockFast(newBlock);
  }
}