/**
 * Camera System
 * 
 * Manages cameras for editor and game rendering.
 * Supports perspective, orthographic, and predefined views.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EventBus } from '../core/EventSystem';
import {
  CameraConfig,
  CameraType,
  CameraMode,
  EditorCameraConfig,
  DefaultCameraConfig,
  DefaultEditorCameraConfig,
} from './types';

// ============================================
// CAMERA SYSTEM
// ============================================

export class CameraSystem {
  private cameras: Map<string, THREE.Camera> = new Map();
  private controls: Map<string, OrbitControls> = new Map();
  private activeCameraId: string = '';
  private eventBus: EventBus;
  private defaultCamera: THREE.PerspectiveCamera | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ============================================
  // CAMERA CREATION
  // ============================================

  /**
   * Create a new camera
   */
  createCamera(config: Partial<CameraConfig> & { id: string }): THREE.Camera {
    const fullConfig: CameraConfig = { ...DefaultCameraConfig, ...config };

    let camera: THREE.Camera;

    if (fullConfig.type === 'perspective') {
      camera = new THREE.PerspectiveCamera(
        fullConfig.fov || 50,
        16 / 9, // Will be updated on resize
        fullConfig.near,
        fullConfig.far
      );
    } else {
      camera = new THREE.OrthographicCamera(
        -10, 10, 10, -10, // Will be updated on resize
        fullConfig.near,
        fullConfig.far
      );
    }

    // Set position
    camera.position.set(
      fullConfig.position.x,
      fullConfig.position.y,
      fullConfig.position.z
    );

    // Set layers if provided
    if (fullConfig.layers) {
      camera.layers.disableAll();
      fullConfig.layers.forEach(layer => camera.layers.enable(layer));
    }

    // Store camera
    this.cameras.set(fullConfig.id, camera);

    // Set as active if first camera
    if (this.cameras.size === 1) {
      this.activeCameraId = fullConfig.id;
    }

    this.eventBus.emit('camera:created', { id: fullConfig.id, config: fullConfig });

    return camera;
  }

  /**
   * Create editor camera with orbit controls
   */
  createEditorCamera(
    canvas: HTMLElement,
    config: Partial<EditorCameraConfig> = {}
  ): { camera: THREE.Camera; controls: OrbitControls } {
    const fullConfig: EditorCameraConfig = {
      ...DefaultEditorCameraConfig,
      ...config,
    };

    const camera = this.createCamera(fullConfig);

    // Create orbit controls
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(
      fullConfig.target.x,
      fullConfig.target.y,
      fullConfig.target.z
    );
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = fullConfig.enableZoom;
    controls.enablePan = fullConfig.enablePan;
    controls.enableRotate = fullConfig.enableOrbit;
    controls.rotateSpeed = fullConfig.rotateSpeed;
    controls.panSpeed = fullConfig.panSpeed;
    controls.zoomSpeed = fullConfig.zoomSpeed;
    controls.minDistance = fullConfig.minDistance;
    controls.maxDistance = fullConfig.maxDistance;
    controls.minPolarAngle = fullConfig.minPolarAngle;
    controls.maxPolarAngle = fullConfig.maxPolarAngle;

    // Store controls
    this.controls.set(fullConfig.id, controls);

    this.eventBus.emit('camera:editor_created', { id: fullConfig.id });

    return { camera, controls };
  }

  // ============================================
  // CAMERA MANAGEMENT
  // ============================================

  /**
   * Get a camera by ID
   */
  getCamera(id: string): THREE.Camera | undefined {
    return this.cameras.get(id);
  }

  /**
   * Get the active camera
   */
  getActiveCamera(): THREE.Camera | undefined {
    return this.cameras.get(this.activeCameraId);
  }

  /**
   * Set the active camera
   */
  setActiveCamera(id: string): void {
    if (!this.cameras.has(id)) {
      console.warn(`[CameraSystem] Camera not found: ${id}`);
      return;
    }

    this.activeCameraId = id;
    this.eventBus.emit('camera:activated', { id });
  }

  /**
   * Remove a camera
   */
  removeCamera(id: string): void {
    const camera = this.cameras.get(id);
    if (camera) {
      // Dispose of camera
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.clear();
      }
      this.cameras.delete(id);
    }

    // Remove controls if exists
    const controls = this.controls.get(id);
    if (controls) {
      controls.dispose();
      this.controls.delete(id);
    }

    this.eventBus.emit('camera:removed', { id });
  }

  // ============================================
  // CAMERA MODES
  // ============================================

  /**
   * Set camera mode (perspective, orthographic, or predefined view)
   */
  setCameraMode(mode: CameraMode): void {
    const activeCamera = this.getActiveCamera();
    if (!activeCamera) return;

    switch (mode) {
      case 'perspective':
        this.setPerspectiveView();
        break;
      case 'orthographic':
        this.setOrthographicView();
        break;
      case 'top':
        this.setTopView();
        break;
      case 'front':
        this.setFrontView();
        break;
      case 'side':
        this.setSideView();
        break;
      case 'game':
        // Game camera is handled separately
        break;
    }

    this.eventBus.emit('camera:mode_changed', { mode });
  }

  /**
   * Set perspective view (default 3D view)
   */
  setPerspectiveView(): void {
    const controls = this.controls.get(this.activeCameraId);
    if (!controls) return;

    controls.object.position.set(5, 5, 5);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  /**
   * Set orthographic view
   */
  setOrthographicView(): void {
    const currentCamera = this.getActiveCamera();
    if (!currentCamera) return;

    // Convert perspective to orthographic view
    // (In a full implementation, would switch to an orthographic camera)
    const controls = this.controls.get(this.activeCameraId);
    if (controls) {
      controls.object.position.set(0, 10, 0);
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }

  /**
   * Set top view (Y-axis)
   */
  setTopView(): void {
    const controls = this.controls.get(this.activeCameraId);
    if (!controls) return;

    controls.object.position.set(0, 20, 0);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  /**
   * Set front view (Z-axis)
   */
  setFrontView(): void {
    const controls = this.controls.get(this.activeCameraId);
    if (!controls) return;

    controls.object.position.set(0, 0, 20);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  /**
   * Set side view (X-axis)
   */
  setSideView(): void {
    const controls = this.controls.get(this.activeCameraId);
    if (!controls) return;

    controls.object.position.set(20, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  // ============================================
  // CAMERA CONTROLS
  // ============================================

  /**
   * Update controls (call in animation loop)
   */
  updateControls(): void {
    const controls = this.controls.get(this.activeCameraId);
    if (controls) {
      controls.update();
    }
  }

  /**
   * Get controls for a camera
   */
  getControls(id: string): OrbitControls | undefined {
    return this.controls.get(id);
  }

  /**
   * Focus camera on a target
   */
  focusOnTarget(target: THREE.Vector3, distance: number = 5): void {
    const controls = this.controls.get(this.activeCameraId);
    if (!controls) return;

    const direction = new THREE.Vector3();
    direction.subVectors(controls.object.position, controls.target).normalize();
    controls.target.copy(target);
    controls.object.position.copy(target).add(direction.multiplyScalar(distance));
    controls.update();

    this.eventBus.emit('camera:focused', { target: target.toArray(), distance });
  }

  /**
   * Frame all objects in the scene
   */
  frameAll(objects: THREE.Object3D[]): void {
    const controls = this.controls.get(this.activeCameraId);
    if (!controls || objects.length === 0) return;

    // Calculate bounding box of all objects
    const box = new THREE.Box3();
    objects.forEach(obj => {
      box.expandByObject(obj);
    });

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2;

    controls.target.copy(center);
    controls.object.position.set(
      center.x + distance * 0.5,
      center.y + distance * 0.5,
      center.z + distance * 0.5
    );
    controls.update();

    this.eventBus.emit('camera:framed_all', { center: center.toArray(), distance });
  }

  // ============================================
  // RESIZE
  // ============================================

  /**
   * Handle window resize
   */
  resize(width: number, height: number): void {
    const aspect = width / height;

    this.cameras.forEach((camera, id) => {
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      } else if (camera instanceof THREE.OrthographicCamera) {
        const frustumSize = 10;
        camera.left = -frustumSize * aspect;
        camera.right = frustumSize * aspect;
        camera.top = frustumSize;
        camera.bottom = -frustumSize;
        camera.updateProjectionMatrix();
      }
    });

    this.eventBus.emit('camera:resized', { width, height });
  }

  // ============================================
  // UTILITY
  // ============================================

  /**
   * Get camera forward direction
   */
  getForwardDirection(): THREE.Vector3 {
    const camera = this.getActiveCamera();
    if (!camera) return new THREE.Vector3(0, 0, -1);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    return forward;
  }

  /**
   * Get camera right direction
   */
  getRightDirection(): THREE.Vector3 {
    const camera = this.getActiveCamera();
    if (!camera) return new THREE.Vector3(1, 0, 0);

    const right = new THREE.Vector3(1, 0, 0);
    right.applyQuaternion(camera.quaternion);
    return right;
  }

  /**
   * Get camera up direction
   */
  getUpDirection(): THREE.Vector3 {
    const camera = this.getActiveCamera();
    if (!camera) return new THREE.Vector3(0, 1, 0);

    const up = new THREE.Vector3(0, 1, 0);
    up.applyQuaternion(camera.quaternion);
    return up;
  }

  /**
   * Ray from camera through screen point
   */
  screenPointToRay(x: number, y: number, screenWidth: number, screenHeight: number): THREE.Ray {
    const camera = this.getActiveCamera();
    if (!camera) return new THREE.Ray();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
      (x / screenWidth) * 2 - 1,
      -(y / screenHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);

    return raycaster.ray;
  }

  // ============================================
  // DISPOSE
  // ============================================

  /**
   * Dispose all cameras and controls
   */
  dispose(): void {
    // Dispose controls
    this.controls.forEach(controls => controls.dispose());
    this.controls.clear();

    // Clear cameras
    this.cameras.clear();

    this.eventBus.emit('camera:disposed', {});
    console.log('[CameraSystem] Disposed');
  }

  /**
   * Get all camera IDs
   */
  getCameraIds(): string[] {
    return Array.from(this.cameras.keys());
  }
}

// ============================================
// SINGLETON
// ============================================

let cameraSystemInstance: CameraSystem | null = null;

export function createCameraSystem(eventBus: EventBus): CameraSystem {
  if (!cameraSystemInstance) {
    cameraSystemInstance = new CameraSystem(eventBus);
  }
  return cameraSystemInstance;
}

export function getCameraSystem(): CameraSystem | null {
  return cameraSystemInstance;
}
