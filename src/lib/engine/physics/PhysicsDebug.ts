/**
 * Physics Debug - Rey30_NEXUS
 * Debug visualization for physics colliders and forces
 */

import * as THREE from 'three';
import type { Vector3Tuple } from 'three';
import { PhysicsDebugConfig, DEFAULT_PHYSICS_DEBUG_CONFIG } from './types';
import { PhysicsSystem, getPhysicsSystem } from './PhysicsSystem';

export class PhysicsDebug {
  private physicsSystem: PhysicsSystem;
  private config: PhysicsDebugConfig;
  private scene: THREE.Scene | null = null;
  private debugGroup: THREE.Group | null = null;
  private colliderMeshes: Map<string, THREE.Mesh> = new Map();
  private rayHelper: THREE.ArrowHelper | null = null;

  constructor(physicsSystem?: PhysicsSystem, config: Partial<PhysicsDebugConfig> = {}) {
    this.physicsSystem = physicsSystem ?? getPhysicsSystem();
    this.config = { ...DEFAULT_PHYSICS_DEBUG_CONFIG, ...config };
  }

  // ============================================================================
  // Setup
  // ============================================================================

  /**
   * Initialize debug visualization with a Three.js scene
   */
  initialize(scene: THREE.Scene): void {
    this.scene = scene;
    this.debugGroup = new THREE.Group();
    this.debugGroup.name = 'PhysicsDebug';
    scene.add(this.debugGroup);
  }

  /**
   * Set debug configuration
   */
  setConfig(config: Partial<PhysicsDebugConfig>): void {
    this.config = { ...this.config, ...config };
    this.updateVisualization();
  }

  /**
   * Enable or disable debug visualization
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (this.debugGroup) {
      this.debugGroup.visible = enabled;
    }
  }

  // ============================================================================
  // Visualization Update
  // ============================================================================

  /**
   * Update debug visualization
   * Call this in the render loop
   */
  update(): void {
    if (!this.config.enabled || !this.debugGroup || !this.scene) return;

    if (this.config.showColliders) {
      this.updateColliderVisualization();
    }

    if (this.config.showVelocity) {
      this.updateVelocityVisualization();
    }
  }

  private updateVisualization(): void {
    if (!this.debugGroup) return;

    // Clear existing visualization
    this.clearColliderMeshes();

    if (this.config.enabled) {
      this.updateColliderVisualization();
    }
  }

  private updateColliderVisualization(): void {
    // This would iterate through all bodies and update their visual representations
    // Simplified implementation
  }

  private updateVelocityVisualization(): void {
    // Show velocity vectors for bodies
    // Simplified implementation
  }

  // ============================================================================
  // Collider Visualization
  // ============================================================================

  /**
   * Create a wireframe mesh for a box collider
   */
  createBoxWireframe(halfExtents: Vector3Tuple, color: string): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(
      halfExtents[0] * 2,
      halfExtents[1] * 2,
      halfExtents[2] * 2
    );
    const material = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    return new THREE.Mesh(geometry, material);
  }

  /**
   * Create a wireframe mesh for a sphere collider
   */
  createSphereWireframe(radius: number, color: string): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(radius, 16, 12);
    const material = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    return new THREE.Mesh(geometry, material);
  }

  /**
   * Create a wireframe mesh for a capsule collider
   */
  createCapsuleWireframe(radius: number, height: number, color: string): THREE.Mesh {
    // Capsule as cylinder with hemisphere caps (simplified as cylinder)
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
    const material = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    return new THREE.Mesh(geometry, material);
  }

  /**
   * Create a wireframe mesh for a cylinder collider
   */
  createCylinderWireframe(radius: number, height: number, color: string): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
    const material = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    return new THREE.Mesh(geometry, material);
  }

  // ============================================================================
  // Ray Visualization
  // ============================================================================

  /**
   * Visualize a raycast
   */
  visualizeRay(
    origin: Vector3Tuple,
    direction: Vector3Tuple,
    distance: number = 10,
    color: string = '#ff0000'
  ): void {
    if (!this.debugGroup || !this.scene) return;

    // Remove previous ray
    if (this.rayHelper) {
      this.debugGroup.remove(this.rayHelper);
    }

    // Create arrow helper
    const end: Vector3Tuple = [
      origin[0] + direction[0] * distance,
      origin[1] + direction[1] * distance,
      origin[2] + direction[2] * distance,
    ];

    const startVec = new THREE.Vector3(...origin);
    const endVec = new THREE.Vector3(...end);
    const dir = endVec.clone().sub(startVec).normalize();

    this.rayHelper = new THREE.ArrowHelper(
      dir,
      startVec,
      distance,
      color,
      0.1,
      0.05
    );

    this.debugGroup.add(this.rayHelper);
  }

  /**
   * Visualize a raycast hit
   */
  visualizeHit(point: Vector3Tuple, normal: Vector3Tuple): void {
    if (!this.debugGroup) return;

    // Hit point
    const hitGeometry = new THREE.SphereGeometry(0.1, 8, 6);
    const hitMaterial = new THREE.MeshBasicMaterial({ color: '#ff0000' });
    const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
    hitMesh.position.set(...point);
    this.debugGroup.add(hitMesh);

    // Normal
    const normalArrow = new THREE.ArrowHelper(
      new THREE.Vector3(...normal),
      new THREE.Vector3(...point),
      1,
      '#00ff00'
    );
    this.debugGroup.add(normalArrow);

    // Auto-remove after a delay (using timeout simulation)
    setTimeout(() => {
      this.debugGroup?.remove(hitMesh);
      this.debugGroup?.remove(normalArrow);
      hitGeometry.dispose();
      hitMaterial.dispose();
    }, 2000);
  }

  // ============================================================================
  // AABB Visualization
  // ============================================================================

  /**
   * Visualize an AABB (Axis-Aligned Bounding Box)
   */
  visualizeAABB(
    min: Vector3Tuple,
    max: Vector3Tuple,
    color: string = '#ffff00'
  ): THREE.Mesh {
    const size: Vector3Tuple = [
      max[0] - min[0],
      max[1] - min[1],
      max[2] - min[2],
    ];

    const center: Vector3Tuple = [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ];

    const geometry = new THREE.BoxGeometry(...size);
    const material = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...center);

    if (this.debugGroup) {
      this.debugGroup.add(mesh);
    }

    return mesh;
  }

  // ============================================================================
  // Contact Point Visualization
  // ============================================================================

  /**
   * Visualize contact points
   */
  visualizeContact(point: Vector3Tuple, normal: Vector3Tuple): void {
    if (!this.debugGroup || !this.config.showContacts) return;

    // Contact point sphere
    const geometry = new THREE.SphereGeometry(0.05, 8, 6);
    const material = new THREE.MeshBasicMaterial({ color: '#ff00ff' });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...point);
    this.debugGroup.add(mesh);

    // Normal arrow
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(...normal),
      new THREE.Vector3(...point),
      0.5,
      '#00ffff'
    );
    this.debugGroup.add(arrow);

    // Auto-remove
    setTimeout(() => {
      this.debugGroup?.remove(mesh);
      this.debugGroup?.remove(arrow);
      geometry.dispose();
      material.dispose();
    }, 500);
  }

  // ============================================================================
  // Utility
  // ============================================================================

  private clearColliderMeshes(): void {
    for (const mesh of this.colliderMeshes.values()) {
      this.debugGroup?.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    }
    this.colliderMeshes.clear();
  }

  /**
   * Clear all debug visualization
   */
  clear(): void {
    this.clearColliderMeshes();

    if (this.rayHelper && this.debugGroup) {
      this.debugGroup.remove(this.rayHelper);
      this.rayHelper = null;
    }
  }

  /**
   * Dispose debug system
   */
  dispose(): void {
    this.clear();

    if (this.debugGroup && this.scene) {
      this.scene.remove(this.debugGroup);
    }

    this.debugGroup = null;
    this.scene = null;
  }

  // ============================================================================
  // Color Helpers
  // ============================================================================

  /**
   * Get color for body type
   */
  getBodyTypeColor(type: 'static' | 'dynamic' | 'kinematic', isSleeping: boolean): string {
    if (isSleeping && this.config.showSleepState) {
      return this.config.sleepingColor;
    }

    switch (type) {
      case 'static':
        return this.config.staticColor;
      case 'dynamic':
        return this.config.dynamicColor;
      case 'kinematic':
        return this.config.kinematicColor;
      default:
        return this.config.colliderColor;
    }
  }

  /**
   * Get color for trigger
   */
  getTriggerColor(): string {
    return this.config.triggerColor;
  }
}

// Singleton
let _instance: PhysicsDebug | null = null;

export function getPhysicsDebug(): PhysicsDebug {
  if (!_instance) {
    _instance = new PhysicsDebug();
  }
  return _instance;
}

export function createPhysicsDebug(
  physicsSystem: PhysicsSystem,
  config?: Partial<PhysicsDebugConfig>
): PhysicsDebug {
  return new PhysicsDebug(physicsSystem, config);
}
