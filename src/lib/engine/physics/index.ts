/**
 * Physics System - Rey30_NEXUS
 * Main exports for the physics engine module
 */

// Types
export * from './types';

// Core
export { PhysicsSystem, createPhysicsSystem, getPhysicsSystem, destroyPhysicsSystem } from './PhysicsSystem';

// Managers
export { RigidBodyManager, getRigidBodyManager, createRigidBodyManager } from './RigidBodyManager';
export { ColliderManager, getColliderManager, createColliderManager } from './ColliderManager';
export { RaycastSystem, getRaycastSystem, createRaycastSystem } from './RaycastSystem';

// Debug
export { PhysicsDebug, getPhysicsDebug, createPhysicsDebug } from './PhysicsDebug';

// ============================================================================
// Factory Function - Create Complete Physics System
// ============================================================================

import { PhysicsSystemConfig, DEFAULT_PHYSICS_CONFIG } from './types';
import { PhysicsSystem } from './PhysicsSystem';
import { RigidBodyManager } from './RigidBodyManager';
import { ColliderManager } from './ColliderManager';
import { RaycastSystem } from './RaycastSystem';
import { PhysicsDebug } from './PhysicsDebug';

export interface PhysicsSystemBundle {
  physics: PhysicsSystem;
  bodies: RigidBodyManager;
  colliders: ColliderManager;
  raycast: RaycastSystem;
  debug: PhysicsDebug;
}

/**
 * Create a complete physics system bundle
 * This initializes all physics components together
 */
export function createPhysicsSystemBundle(
  config: Partial<PhysicsSystemConfig> = {}
): PhysicsSystemBundle {
  const physics = new PhysicsSystem({ ...DEFAULT_PHYSICS_CONFIG, ...config });
  const bodies = new RigidBodyManager(physics);
  const colliders = new ColliderManager(physics);
  const raycast = new RaycastSystem(physics);
  const debug = new PhysicsDebug(physics);

  return {
    physics,
    bodies,
    colliders,
    raycast,
    debug,
  };
}

// ============================================================================
// Quick Setup Functions
// ============================================================================

/**
 * Quick setup for a static ground plane
 */
export function setupGroundPlane(physics: PhysicsSystem, y: number = 0): string {
  const bodyId = 'ground';
  physics.createBody(bodyId, { type: 'static' });
  physics.setBodyPosition(bodyId, [0, y, 0]);

  const planeShape = physics.createPlaneShape();
  physics.addCollider(bodyId, `${bodyId}_collider`, planeShape);

  return bodyId;
}

/**
 * Quick setup for a bouncing ball
 */
export function createBouncingBall(
  physics: PhysicsSystem,
  position: Vector3Tuple,
  radius: number = 0.5,
  restitution: number = 0.8
): string {
  const bodyId = `ball_${Date.now()}`;
  physics.createBody(bodyId, {
    type: 'dynamic',
    mass: 1,
    linearDamping: 0.01,
  });
  physics.setBodyPosition(bodyId, position);

  const sphereShape = physics.createSphereShape(radius);
  physics.addCollider(bodyId, `${bodyId}_collider`, sphereShape);

  return bodyId;
}

/**
 * Quick setup for a falling box
 */
export function createFallingBox(
  physics: PhysicsSystem,
  position: Vector3Tuple,
  size: [number, number, number] = [1, 1, 1]
): string {
  const bodyId = `box_${Date.now()}`;
  physics.createBody(bodyId, {
    type: 'dynamic',
    mass: 1,
  });
  physics.setBodyPosition(bodyId, position);

  const boxShape = physics.createBoxShape([size[0] / 2, size[1] / 2, size[2] / 2]);
  physics.addCollider(bodyId, `${bodyId}_collider`, boxShape);

  return bodyId;
}

// Type import for Vector3Tuple
import type { Vector3Tuple } from 'three';

// ============================================================================
// Physics Events
// ============================================================================

export const PhysicsEvents = {
  BODY_CREATED: 'physics:body_created',
  BODY_REMOVED: 'physics:body_removed',
  COLLISION_ENTER: 'physics:collision_enter',
  COLLISION_STAY: 'physics:collision_stay',
  COLLISION_EXIT: 'physics:collision_exit',
  TRIGGER_ENTER: 'physics:trigger_enter',
  TRIGGER_EXIT: 'physics:trigger_exit',
  BODY_SLEEP: 'physics:body_sleep',
  BODY_WAKE: 'physics:body_wake',
} as const;

export type PhysicsEventType = typeof PhysicsEvents[keyof typeof PhysicsEvents];
