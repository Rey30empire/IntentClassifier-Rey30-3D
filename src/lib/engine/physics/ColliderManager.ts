/**
 * Collider Manager - Rey30_NEXUS
 * Factory and helper functions for collider management
 */

import * as CANNON from 'cannon-es';
import type { Vector3Tuple } from 'three';
import {
  ColliderConfig,
  ColliderState,
  BoxColliderConfig,
  SphereColliderConfig,
  CapsuleColliderConfig,
  CylinderColliderConfig,
  TrimeshColliderConfig,
  ConvexColliderConfig,
  PlaneColliderConfig,
} from './types';
import { PhysicsSystem, getPhysicsSystem } from './PhysicsSystem';

export class ColliderManager {
  private physicsSystem: PhysicsSystem;
  private colliderCounter: number = 0;

  constructor(physicsSystem?: PhysicsSystem) {
    this.physicsSystem = physicsSystem ?? getPhysicsSystem();
  }

  // ============================================================================
  // Collider Creation
  // ============================================================================

  private generateId(): string {
    return `collider_${++this.colliderCounter}`;
  }

  /**
   * Add a box collider to a body
   */
  addBoxCollider(
    bodyId: string,
    config: Partial<Omit<BoxColliderConfig, 'type'>> = {}
  ): ColliderState {
    const halfExtents = config.size ?? [0.5, 0.5, 0.5];
    const shape = this.physicsSystem.createBoxShape(halfExtents);
    const colliderId = this.generateId();

    return this.physicsSystem.addCollider(bodyId, colliderId, shape, config.isTrigger);
  }

  /**
   * Add a sphere collider to a body
   */
  addSphereCollider(
    bodyId: string,
    config: Partial<Omit<SphereColliderConfig, 'type'>> = {}
  ): ColliderState {
    const radius = config.radius ?? 0.5;
    const shape = this.physicsSystem.createSphereShape(radius);
    const colliderId = this.generateId();

    return this.physicsSystem.addCollider(bodyId, colliderId, shape, config.isTrigger);
  }

  /**
   * Add a capsule collider to a body
   * Note: Cannon-es doesn't have native capsule, approximated with cylinder
   */
  addCapsuleCollider(
    bodyId: string,
    config: Partial<Omit<CapsuleColliderConfig, 'type'>> = {}
  ): ColliderState {
    const radius = config.radius ?? 0.3;
    const height = config.height ?? 1.8;
    const shape = this.physicsSystem.createCapsuleShape(radius, height);
    const colliderId = this.generateId();

    return this.physicsSystem.addCollider(bodyId, colliderId, shape, config.isTrigger);
  }

  /**
   * Add a cylinder collider to a body
   */
  addCylinderCollider(
    bodyId: string,
    config: Partial<Omit<CylinderColliderConfig, 'type'>> = {}
  ): ColliderState {
    const radius = config.radius ?? 0.5;
    const height = config.height ?? 1;
    const segments = config.segments ?? 16;
    const shape = this.physicsSystem.createCylinderShape(radius, height, segments);
    const colliderId = this.generateId();

    return this.physicsSystem.addCollider(bodyId, colliderId, shape, config.isTrigger);
  }

  /**
   * Add a plane collider to a body
   * Planes are infinite and only face in one direction
   */
  addPlaneCollider(
    bodyId: string,
    config: Partial<Omit<PlaneColliderConfig, 'type'>> = {}
  ): ColliderState {
    const shape = this.physicsSystem.createPlaneShape();
    const colliderId = this.generateId();

    return this.physicsSystem.addCollider(bodyId, colliderId, shape, config.isTrigger);
  }

  /**
   * Add a trimesh collider to a body
   * Best for static geometry only (no collision response between trimeshes)
   */
  addTrimeshCollider(
    bodyId: string,
    vertices: number[],
    indices: number[],
    config: Partial<Omit<TrimeshColliderConfig, 'type' | 'vertices' | 'indices'>> = {}
  ): ColliderState {
    const shape = this.physicsSystem.createTrimeshShape(vertices, indices);
    const colliderId = this.generateId();

    return this.physicsSystem.addCollider(bodyId, colliderId, shape, config.isTrigger);
  }

  /**
   * Add a convex collider to a body
   */
  addConvexCollider(
    bodyId: string,
    vertices: Vector3Tuple[],
    config: Partial<Omit<ConvexColliderConfig, 'type' | 'vertices'>> = {}
  ): ColliderState {
    const v: CANNON.Vec3[] = vertices.map(v => new CANNON.Vec3(...v));
    const shape = new CANNON.ConvexPolyhedron({
      vertices: v,
      faces: [], // Would need proper face data
    });
    const colliderId = this.generateId();

    return this.physicsSystem.addCollider(bodyId, colliderId, shape, config.isTrigger);
  }

  // ============================================================================
  // Compound Colliders
  // ============================================================================

  /**
   * Create a compound collider from multiple shapes
   * Useful for complex objects
   */
  addCompoundCollider(
    bodyId: string,
    shapes: Array<{
      type: 'box' | 'sphere' | 'cylinder';
      offset?: Vector3Tuple;
      rotation?: Vector3Tuple;
      config?: Record<string, unknown>;
    }>
  ): ColliderState[] {
    const colliders: ColliderState[] = [];

    for (const shapeConfig of shapes) {
      let shape: CANNON.Shape | null = null;

      switch (shapeConfig.type) {
        case 'box':
          shape = this.physicsSystem.createBoxShape(
            (shapeConfig.config?.size as Vector3Tuple) ?? [0.5, 0.5, 0.5]
          );
          break;
        case 'sphere':
          shape = this.physicsSystem.createSphereShape(
            (shapeConfig.config?.radius as number) ?? 0.5
          );
          break;
        case 'cylinder':
          shape = this.physicsSystem.createCylinderShape(
            (shapeConfig.config?.radius as number) ?? 0.5,
            (shapeConfig.config?.height as number) ?? 1
          );
          break;
      }

      if (shape) {
        const offset = shapeConfig.offset
          ? new CANNON.Vec3(...shapeConfig.offset)
          : undefined;
        const orientation = shapeConfig.rotation
          ? (() => {
              const [x, y, z] = shapeConfig.rotation;
              const rotation = new CANNON.Quaternion();
              rotation.setFromEuler(x, y, z, 'XYZ');
              return rotation;
            })()
          : undefined;

        const colliderId = this.generateId();
        const collider = this.physicsSystem.addCollider(
          bodyId,
          colliderId,
          shape,
          false,
          offset,
          orientation
        );
        colliders.push(collider);
      }
    }

    return colliders;
  }

  // ============================================================================
  // Preset Colliders
  // ============================================================================

  /**
   * Create character capsule collider (standing)
   */
  addCharacterCollider(bodyId: string, height: number = 1.8, radius: number = 0.3): ColliderState {
    // Capsule is approximated with cylinder + spheres at ends
    // For simplicity, using cylinder
    return this.addCapsuleCollider(bodyId, { radius, height, center: [0, height / 2, 0] });
  }

  /**
   * Create ground plane collider
   */
  addGroundCollider(bodyId: string): ColliderState {
    return this.addPlaneCollider(bodyId);
  }

  /**
   * Create box trigger zone
   */
  addTriggerZone(bodyId: string, size: Vector3Tuple): ColliderState {
    return this.addBoxCollider(bodyId, {
      size,
      isTrigger: true,
    });
  }

  /**
   * Create sphere trigger zone
   */
  addSphereTrigger(bodyId: string, radius: number): ColliderState {
    return this.addSphereCollider(bodyId, {
      radius,
      isTrigger: true,
    });
  }

  // ============================================================================
  // Collider Properties
  // ============================================================================

  /**
   * Set collider as trigger
   */
  setTrigger(colliderId: string, isTrigger: boolean): void {
    // Would need to recreate shape in cannon-es
    console.warn('Trigger change requires collider recreation');
  }

  /**
   * Set collider offset
   */
  setOffset(_colliderId: string, _offset: Vector3Tuple): void {
    // Would need to access shape and modify offset
    console.warn('Offset change not implemented');
  }

  // ============================================================================
  // Utility
  // ============================================================================

  /**
   * Remove collider
   */
  remove(colliderId: string): void {
    this.physicsSystem.removeCollider(colliderId);
  }

  /**
   * Get collider bounds (for broadphase optimizations)
   */
  getBounds(colliderId: string): { min: Vector3Tuple; max: Vector3Tuple } | null {
    const state = this.physicsSystem.getBody(colliderId);
    if (!state?.cannonBody) return null;

    const pos = this.physicsSystem.getBodyPosition(colliderId);
    if (!pos) return null;

    // Simple AABB based on position (would need shape info for proper bounds)
    return {
      min: [pos[0] - 1, pos[1] - 1, pos[2] - 1],
      max: [pos[0] + 1, pos[1] + 1, pos[2] + 1],
    };
  }
}

// Singleton
let _instance: ColliderManager | null = null;

export function getColliderManager(): ColliderManager {
  if (!_instance) {
    _instance = new ColliderManager();
  }
  return _instance;
}

export function createColliderManager(physicsSystem: PhysicsSystem): ColliderManager {
  return new ColliderManager(physicsSystem);
}
