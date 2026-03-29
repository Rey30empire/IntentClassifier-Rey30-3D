// ══════════════════════════════════════════════
// INTERACTION BOX — Reusable bounding box trigger
// ══════════════════════════════════════════════
//
// Creates an invisible bounding box around a target object group.
// Supports:
//   • click on the target → fires onClick with hit info
//   • per-frame AABB-vs-AABB intersection test (target vs character)
//   • configurable "facing direction" for sit alignment
//
// Usage:
//   const box = new InteractionBox(targetGroup, scene, {
//     padding: 0,
//     direction: Math.PI,
//     onClick: (hit) => { ... },
//     onEnter: () => { ... },
//     onExit:  () => { ... },
//     camera, domElement,
//   });
//   box.update(characterAABB);   // pass THREE.Box3 each frame
//   box.dispose();
// ══════════════════════════════════════════════

import * as THREE from "three/webgpu";

// ── Global debug state ──
let _debugMode = false;
const _allBoxes = [];
let _sharedCharDebugMesh = null; // single char debug mesh shared across all interaction boxes
let _sharedCharDebugScene = null;

export function setDebugMode(enabled) {
  _debugMode = enabled;
  _allBoxes.forEach((ib) => ib._updateDebugVisual());
  if (_sharedCharDebugMesh) _sharedCharDebugMesh.visible = _debugMode;
}

export function getDebugMode() {
  return _debugMode;
}

function getSharedCharDebugMesh(scene) {
  if (!_sharedCharDebugMesh) {
    _sharedCharDebugMesh = createDebugMesh("interactionBoxCharDebug_shared", 0x00ffff);
    _sharedCharDebugMesh.visible = _debugMode;
    scene.add(_sharedCharDebugMesh);
    _sharedCharDebugScene = scene;
  }
  return _sharedCharDebugMesh;
}

// ── Helper: create a wireframe debug box mesh ──
function createDebugMesh(name, colorHex) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicNodeMaterial({
    color: colorHex,
    wireframe: true,
    transparent: true,
    opacity: 0.6,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.renderOrder = 1000;
  mesh.visible = _debugMode;
  return mesh;
}

// ── Helper: sync a debug mesh to an AABB ──
function syncDebugMeshToAABB(mesh, aabb) {
  if (!mesh || !aabb) return;
  // Guard: ensure aabb is a proper Box3 with getSize
  if (typeof aabb.getSize !== "function" || typeof aabb.getCenter !== "function") return;
  // Guard: skip if AABB is empty / uninitialized
  if (aabb.isEmpty()) return;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  aabb.getSize(size);
  aabb.getCenter(center);
  mesh.position.copy(center);
  const pw = mesh.geometry.parameters.width || 1;
  const ph = mesh.geometry.parameters.height || 1;
  const pd = mesh.geometry.parameters.depth || 1;
  mesh.scale.set(size.x / pw, size.y / ph, size.z / pd);
}


export class InteractionBox {
  /**
   * @param {THREE.Object3D} targetGroup
   * @param {THREE.Scene} scene
   * @param {Object} options
   * @param {number}   [options.padding=0]
   * @param {number}   [options.direction=0]   — Y-axis rotation the character should face
   * @param {number}   [options.seatLevel]     — world-space Y of the seat surface (debug helper)
   * @param {number}   [options.rotationY]     — Y rotation of the target (for OBB matching)
   * @param {Function} [options.onClick]
   * @param {Function} [options.onEnter]       — character AABB intersects target AABB
   * @param {Function} [options.onExit]
   * @param {THREE.Camera}  [options.camera]
   * @param {HTMLElement}    [options.domElement]
   */
  constructor(targetGroup, scene, options = {}) {
    this.target = targetGroup;
    this.scene = scene;
    this.padding = options.padding !== undefined ? options.padding : 0;
    this.direction = options.direction !== undefined ? options.direction : 0;
    this.seatLevel = options.seatLevel !== undefined ? options.seatLevel : null;
    this.onClickCb = options.onClick || null;
    this.onEnterCb = options.onEnter || null;
    this.onExitCb = options.onExit || null;
    this.camera = options.camera || null;
    this.domElement = options.domElement || null;
    this.isInside = false;
    this.enabled = true;
    this._debugFrameCount = 0;

    // ── OBB support: if rotationY is provided, use oriented bounding box ──
    this._useOBB = options.rotationY !== undefined;
    this._rotationY = options.rotationY || 0;
    this._customLocalAABB = options.customLocalAABB || null; // override local AABB
    this._widthScale = options.widthScale !== undefined ? options.widthScale : 1.0; // shrink width (X in local space)

    // Compute AABB (world-space axis-aligned) — used as fallback and for world AABB
    this.aabb = new THREE.Box3();

    if (this._useOBB) {
      // Compute local-space AABB by temporarily removing rotation
      this._computeOBB();
    } else {
      this._computeAABB();
    }

    // Get size/center for mesh creation
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    if (this._useOBB) {
      this._obbLocal.getSize(size);
      // Add padding to local size
      size.x += this.padding * 2;
      size.y += this.padding * 2;
      size.z += this.padding * 2;
      center.copy(this._obbWorldCenter);
    } else {
      this.aabb.getSize(size);
      this.aabb.getCenter(center);
    }

    // ── Invisible box mesh for raycasting ──
    const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const boxMat = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0 });
    boxMat.visible = false;
    this.boxMesh = new THREE.Mesh(boxGeo, boxMat);
    this.boxMesh.name = "interactionBox_" + (targetGroup.name || "unknown");
    this.boxMesh.position.copy(center);
    if (this._useOBB) this.boxMesh.rotation.y = this._rotationY;
    this.boxMesh.renderOrder = 999;
    scene.add(this.boxMesh);

    // ── Debug wireframe for target ──
    const debugColorHex = options.debugColor || 0x00ff00;
    this.debugMesh = createDebugMesh(
      "interactionBoxDebug_" + (targetGroup.name || "unknown"),
      debugColorHex
    );
    this.debugMesh.position.copy(center);
    if (this._useOBB) {
      // Oriented debug box: set rotation and scale from local AABB size
      this.debugMesh.rotation.y = this._rotationY;
      const pw = this.debugMesh.geometry.parameters.width || 1;
      const ph = this.debugMesh.geometry.parameters.height || 1;
      const pd = this.debugMesh.geometry.parameters.depth || 1;
      this.debugMesh.scale.set(size.x / pw, size.y / ph, size.z / pd);
    }
    scene.add(this.debugMesh);

    // ── Shared character debug mesh (single instance for all boxes) ──
    this.charDebugMesh = getSharedCharDebugMesh(scene);

    // ── Seat-level helper (orange plane at the seat Y) ──
    this.seatLevelMesh = null;
    if (this.seatLevel !== null) {
      const planeSize = Math.max(size.x, size.z) * 1.3;
      const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
      const planeMat = new THREE.MeshBasicNodeMaterial({
        color: 0xff8800,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      this.seatLevelMesh = new THREE.Mesh(planeGeo, planeMat);
      this.seatLevelMesh.name = "seatLevelHelper";
      this.seatLevelMesh.rotation.x = -Math.PI / 2; // horizontal
      this.seatLevelMesh.position.set(center.x, this.seatLevel, center.z);
      this.seatLevelMesh.renderOrder = 1001;
      this.seatLevelMesh.visible = _debugMode;
      scene.add(this.seatLevelMesh);
    }

    // ── Direction arrow (yellow) — shows bench facing direction ──
    this.directionArrow = null;
    {
      const arrowDir = new THREE.Vector3(
        Math.sin(this.direction), 0, Math.cos(this.direction)
      );
      this.directionArrow = new THREE.ArrowHelper(arrowDir, center.clone(), 0.5, 0xffff00, 0.08, 0.05);
      this.directionArrow.name = "interactionBoxDirArrow";
      this.directionArrow.visible = _debugMode;
      scene.add(this.directionArrow);
    }

    // ── Raycaster for click detection ──
    this.raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();

    this._onPointerDown = this._handlePointerDown.bind(this);
    if (this.domElement) {
      this.domElement.addEventListener("pointerdown", this._onPointerDown);
    }

    _allBoxes.push(this);
  }

  _computeAABB() {
    this.aabb.setFromObject(this.target);
    if (this.padding !== 0) {
      this.aabb.min.x -= this.padding;
      this.aabb.min.y -= this.padding;
      this.aabb.min.z -= this.padding;
      this.aabb.max.x += this.padding;
      this.aabb.max.y += this.padding;
      this.aabb.max.z += this.padding;
    }
  }

  /**
   * Compute an oriented bounding box (OBB).
   * Stores local-space AABB (_obbLocal) and world center (_obbWorldCenter).
   * For intersection, transforms the character point into local space.
   */
  _computeOBB() {
    // Get world position and rotation of target
    const worldPos = new THREE.Vector3();
    this.target.getWorldPosition(worldPos);

    let localBox;

    if (this._customLocalAABB) {
      // Use the provided custom local AABB (already in local space relative to the target's position)
      localBox = this._customLocalAABB.clone();
      // Offset by the target's world position (so it's in "unrotated world space")
      localBox.min.add(worldPos);
      localBox.max.add(worldPos);
    } else {
      // Save the target's current rotation, then zero it to get local-space AABB
      const savedRotY = this.target.rotation.y;
      this.target.rotation.y = 0;
      this.target.updateMatrixWorld(true);

      localBox = new THREE.Box3().setFromObject(this.target);

      // Restore rotation
      this.target.rotation.y = savedRotY;
      this.target.updateMatrixWorld(true);
    }

    // Store local AABB (the tight box without rotation)
    this._obbLocal = localBox.clone();
    // Apply padding to the local box
    this._obbLocalPadded = localBox.clone();
    if (this.padding !== 0) {
      this._obbLocalPadded.min.x -= this.padding;
      this._obbLocalPadded.min.y -= this.padding;
      this._obbLocalPadded.min.z -= this.padding;
      this._obbLocalPadded.max.x += this.padding;
      this._obbLocalPadded.max.y += this.padding;
      this._obbLocalPadded.max.z += this.padding;
    }
    // Apply width scaling (shrink X axis around center in local space)
    if (this._widthScale !== 1.0) {
      const cx = (this._obbLocalPadded.min.x + this._obbLocalPadded.max.x) * 0.5;
      const halfW = (this._obbLocalPadded.max.x - this._obbLocalPadded.min.x) * 0.5;
      this._obbLocalPadded.min.x = cx - halfW * this._widthScale;
      this._obbLocalPadded.max.x = cx + halfW * this._widthScale;
      // Also shrink the unpadded local box for debug mesh sizing
      const cx2 = (this._obbLocal.min.x + this._obbLocal.max.x) * 0.5;
      const halfW2 = (this._obbLocal.max.x - this._obbLocal.min.x) * 0.5;
      this._obbLocal.min.x = cx2 - halfW2 * this._widthScale;
      this._obbLocal.max.x = cx2 + halfW2 * this._widthScale;
    }

    // World center = center of the local box, rotated by target's rotation
    const localCenter = localBox.getCenter(new THREE.Vector3());
    // The local center is already in world space (since we used setFromObject with 0 rotation
    // and the object is at its world position). We need to rotate it around the world position.
    const offset = localCenter.clone().sub(worldPos);
    const savedRotY2 = this._rotationY;
    const cosR = Math.cos(savedRotY2);
    const sinR = Math.sin(savedRotY2);
    const rotatedOffset = new THREE.Vector3(
      offset.x * cosR + offset.z * sinR,
      offset.y,
      -offset.x * sinR + offset.z * cosR
    );
    this._obbWorldCenter = worldPos.clone().add(rotatedOffset);
    this._obbWorldPos = worldPos.clone();

    // Also update the world-space AABB for compatibility (e.g. raycasting fallback)
    this.aabb.setFromObject(this.target);
  }

  /**
   * Test if a world-space point is inside the OBB.
   * Transforms the point into the target's local space and checks against _obbLocalPadded.
   */
  _isPointInOBB(worldPoint) {
    // Transform world point into target's local space (undo rotation around world center)
    const rel = worldPoint.clone().sub(this._obbWorldPos);
    const cosR = Math.cos(-this._rotationY);
    const sinR = Math.sin(-this._rotationY);
    const localPoint = new THREE.Vector3(
      rel.x * cosR + rel.z * sinR,
      rel.y,
      -rel.x * sinR + rel.z * cosR
    ).add(this._obbWorldPos);
    return this._obbLocalPadded.containsPoint(localPoint);
  }

  /**
   * Test if a world-space AABB intersects the OBB.
   * Checks all 4 XZ corners + center of the charAABB against the OBB.
   */
  _doesAABBIntersectOBB(charAABB) {
    const cMin = charAABB.min;
    const cMax = charAABB.max;
    const midY = (cMin.y + cMax.y) * 0.5;
    // Test 5 points: 4 corners + center on XZ plane at midY
    const points = [
      new THREE.Vector3(cMin.x, midY, cMin.z),
      new THREE.Vector3(cMax.x, midY, cMin.z),
      new THREE.Vector3(cMin.x, midY, cMax.z),
      new THREE.Vector3(cMax.x, midY, cMax.z),
      new THREE.Vector3((cMin.x + cMax.x) * 0.5, midY, (cMin.z + cMax.z) * 0.5),
    ];
    for (const p of points) {
      if (this._isPointInOBB(p)) return true;
    }
    return false;
  }

  _updateDebugVisual() {
    if (this.debugMesh) this.debugMesh.visible = _debugMode;
    if (this.charDebugMesh) this.charDebugMesh.visible = _debugMode;
    if (this.directionArrow) this.directionArrow.visible = _debugMode;
    if (this.seatLevelMesh) this.seatLevelMesh.visible = _debugMode;
  }

  _handlePointerDown(event) {
    if (!this.enabled || !this.camera) return;

    const rect = this.domElement.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this._mouse, this.camera);

    const hits = this.raycaster.intersectObject(this.boxMesh, false);
    const targetHits = this.raycaster.intersectObject(this.target, true);
    if (hits.length > 0 || targetHits.length > 0) {
      if (this.onClickCb) this.onClickCb(hits[0] || targetHits[0]);
    }
  }

  /**
   * Call each frame with the character's world-space AABB.
   * Uses real box-vs-box intersection: if the character AABB overlaps the bench AABB → enter.
   * @param {THREE.Box3|null} charAABB — character bounding box in world space
   */
  update(charAABB) {
    if (!this.enabled) return;

    // Recompute bounds (OBB is static — only recompute AABB for non-OBB)
    if (this._useOBB) {
      // OBB is cached from constructor — no need to recompute for static objects
    } else {
      this._computeAABB();
      // Sync target debug/raycast mesh
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      this.aabb.getSize(size);
      this.aabb.getCenter(center);
      this.boxMesh.position.copy(center);
      this.boxMesh.scale.set(
        size.x / (this.boxMesh.geometry.parameters.width || 1),
        size.y / (this.boxMesh.geometry.parameters.height || 1),
        size.z / (this.boxMesh.geometry.parameters.depth || 1)
      );
      syncDebugMeshToAABB(this.debugMesh, this.aabb);
    }

    // Sync shared character debug mesh
    const validCharAABB =
      charAABB &&
      typeof charAABB.getSize === "function" &&
      typeof charAABB.getCenter === "function" &&
      !charAABB.isEmpty();
    if (validCharAABB && this.charDebugMesh) {
      syncDebugMeshToAABB(this.charDebugMesh, charAABB);
    }

    // Update direction arrow position
    if (this.directionArrow) {
      const c = this._useOBB ? this._obbWorldCenter : new THREE.Vector3();
      if (!this._useOBB) this.aabb.getCenter(c);
      this.directionArrow.position.copy(c);
    }

    // ── Intersection test ──
    const wasInside = this.isInside;
    if (validCharAABB) {
      if (this._useOBB) {
        this.isInside = this._doesAABBIntersectOBB(charAABB);
      } else {
        this.isInside = this.aabb.intersectsBox(charAABB);
      }
    } else {
      this.isInside = false;
    }

    // Debug: turn shared char box RED when ANY box intersects
    if (this.charDebugMesh && this.charDebugMesh.material && this.isInside) {
      this.charDebugMesh.material.color.set(0xff0000);
    }

    if (this.isInside && !wasInside) {
      if (this.onEnterCb) this.onEnterCb();
    } else if (!this.isInside && wasInside) {
      if (this.onExitCb) this.onExitCb();
    }
  }

  /**
   * Get the center of the target AABB.
   * @returns {THREE.Vector3}
   */
  getCenter() {
    const c = new THREE.Vector3();
    this.aabb.getCenter(c);
    return c;
  }

  dispose() {
    if (this.domElement) {
      this.domElement.removeEventListener("pointerdown", this._onPointerDown);
    }
    if (this.boxMesh) {
      if (this.boxMesh.parent) this.boxMesh.parent.remove(this.boxMesh);
      this.boxMesh.geometry.dispose();
      this.boxMesh.material.dispose();
    }
    if (this.debugMesh) {
      if (this.debugMesh.parent) this.debugMesh.parent.remove(this.debugMesh);
      this.debugMesh.geometry.dispose();
      this.debugMesh.material.dispose();
    }
    // charDebugMesh is shared — don't dispose it here
    this.charDebugMesh = null;
    if (this.directionArrow) {
      if (this.directionArrow.parent) this.directionArrow.parent.remove(this.directionArrow);
      this.directionArrow.dispose();
    }
    if (this.seatLevelMesh) {
      if (this.seatLevelMesh.parent) this.seatLevelMesh.parent.remove(this.seatLevelMesh);
      this.seatLevelMesh.geometry.dispose();
      this.seatLevelMesh.material.dispose();
    }
    const idx = _allBoxes.indexOf(this);
    if (idx !== -1) _allBoxes.splice(idx, 1);
  }
}