/**
 * Physics System Types - Rey30_NEXUS
 * Type definitions for the physics engine
 */

import type { Vector3Tuple } from 'three';

// ============================================================================
// Collision Groups
// ============================================================================

export const CollisionGroups = {
  DEFAULT:     1 << 0,  // 1
  PLAYER:      1 << 1,  // 2
  ENEMY:       1 << 2,  // 4
  ENVIRONMENT: 1 << 3,  // 8
  PROJECTILE:  1 << 4,  // 16
  TRIGGER:     1 << 5,  // 32
  RAGDOLL:     1 << 6,  // 64
  DEBRIS:      1 << 7,  // 128
  VEHICLE:     1 << 8,  // 256
  WATER:       1 << 9,  // 512
  INTERACTIVE: 1 << 10, // 1024
  ALL:         0xFFFFFFFF,
} as const;

export type CollisionGroup = typeof CollisionGroups[keyof typeof CollisionGroups];

// ============================================================================
// Physics Material
// ============================================================================

export type CombineMode = 'average' | 'minimum' | 'maximum' | 'multiply';

export interface PhysicsMaterialConfig {
  friction: number;           // 0 = ice, 1 = rubber
  restitution: number;        // 0 = no bounce, 1 = super bouncy
  frictionCombine: CombineMode;
  restitutionCombine: CombineMode;
}

export interface PhysicsMaterial extends PhysicsMaterialConfig {
  id: string;
  name: string;
}

// ============================================================================
// Rigid Body
// ============================================================================

export type BodyType = 'static' | 'dynamic' | 'kinematic';

export interface RigidBodyConfig {
  type: BodyType;
  mass: number;
  velocity: Vector3Tuple;
  angularVelocity: Vector3Tuple;
  linearDamping: number;
  angularDamping: number;
  fixedRotation: boolean;
  useGravity: boolean;
  collisionGroup: number;
  collisionMask: number;
  sleepThreshold: number;
  sleepTimeThreshold: number;
  // Constraints
  lockPositionX: boolean;
  lockPositionY: boolean;
  lockPositionZ: boolean;
  lockRotationX: boolean;
  lockRotationY: boolean;
  lockRotationZ: boolean;
}

export interface RigidBodyState {
  id: string;
  entityId: string;
  config: RigidBodyConfig;
  // Runtime state
  isSleeping: boolean;
  totalForce: Vector3Tuple;
  totalTorque: Vector3Tuple;
  // Cannon.js body reference
  cannonBody?: unknown; // CANNON.Body reference
}

// ============================================================================
// Collider
// ============================================================================

export type ColliderType = 'box' | 'sphere' | 'capsule' | 'cylinder' | 'convex' | 'trimesh' | 'plane';

export interface BaseColliderConfig {
  type: ColliderType;
  isTrigger: boolean;
  center: Vector3Tuple;
  collisionGroup: number;
  collisionMask: number;
  materialId?: string;
}

export interface BoxColliderConfig extends BaseColliderConfig {
  type: 'box';
  size: Vector3Tuple; // Half extents [x, y, z]
}

export interface SphereColliderConfig extends BaseColliderConfig {
  type: 'sphere';
  radius: number;
}

export interface CapsuleColliderConfig extends BaseColliderConfig {
  type: 'capsule';
  radius: number;
  height: number;
}

export interface CylinderColliderConfig extends BaseColliderConfig {
  type: 'cylinder';
  radius: number;
  height: number;
  segments?: number;
}

export interface ConvexColliderConfig extends BaseColliderConfig {
  type: 'convex';
  vertices: Vector3Tuple[];
  faces?: number[][];
}

export interface TrimeshColliderConfig extends BaseColliderConfig {
  type: 'trimesh';
  vertices: Vector3Tuple[];
  indices: number[];
}

export interface PlaneColliderConfig extends BaseColliderConfig {
  type: 'plane';
  normal: Vector3Tuple;
}

export type ColliderConfig =
  | BoxColliderConfig
  | SphereColliderConfig
  | CapsuleColliderConfig
  | CylinderColliderConfig
  | ConvexColliderConfig
  | TrimeshColliderConfig
  | PlaneColliderConfig;

export interface ColliderState {
  id: string;
  entityId: string;
  bodyId: string;
  config: ColliderConfig;
  // Cannon.js shape reference
  cannonShape?: unknown; // CANNON.Shape reference
}

// ============================================================================
// Raycast
// ============================================================================

export interface RaycastConfig {
  origin: Vector3Tuple;
  direction: Vector3Tuple;
  maxDistance: number;
  layerMask: number;
  hitTriggers: boolean;
}

export interface RaycastHit {
  entityId: string;
  bodyId: string;
  colliderId: string;
  point: Vector3Tuple;
  normal: Vector3Tuple;
  distance: number;
  isTrigger: boolean;
}

export interface SphereCastConfig extends RaycastConfig {
  radius: number;
}

export interface BoxCastConfig extends RaycastConfig {
  halfExtents: Vector3Tuple;
  orientation?: Vector3Tuple; // Euler angles
}

// ============================================================================
// Collision Events
// ============================================================================

export type CollisionEventType = 'enter' | 'stay' | 'exit' | 'trigger_enter' | 'trigger_exit';

export interface CollisionContact {
  point: Vector3Tuple;
  normal: Vector3Tuple;
  depth: number;
}

export interface CollisionEvent {
  type: CollisionEventType;
  bodyA: RigidBodyState;
  bodyB: RigidBodyState;
  colliderA: ColliderState;
  colliderB: ColliderState;
  contacts: CollisionContact[];
  impactVelocity: number;
}

// ============================================================================
// Physics System Config
// ============================================================================

export type BroadphaseType = 'naive' | 'sap';

export interface PhysicsSystemConfig {
  gravity: Vector3Tuple;
  fixedTimeStep: number;
  maxSubSteps: number;
  broadphase: BroadphaseType;
  allowSleep: boolean;
  solverIterations: number;
  defaultContactMaterial: Partial<PhysicsMaterialConfig>;
}

// ============================================================================
// Physics Debug
// ============================================================================

export interface PhysicsDebugConfig {
  enabled: boolean;
  showColliders: boolean;
  showAABBs: boolean;
  showContacts: boolean;
  showVelocity: boolean;
  showNormals: boolean;
  showSleepState: boolean;
  colliderColor: string;
  staticColor: string;
  dynamicColor: string;
  kinematicColor: string;
  triggerColor: string;
  sleepingColor: string;
}

// ============================================================================
// Force Modes
// ============================================================================

export type ForceMode = 'force' | 'impulse' | 'acceleration' | 'velocityChange';

// ============================================================================
// Joints (for future implementation)
// ============================================================================

export type JointType = 'distance' | 'hinge' | 'slider' | 'cone' | 'pointToPoint' | 'lock';

export interface JointConfig {
  type: JointType;
  bodyA: string; // body id
  bodyB: string; // body id
  pivotA: Vector3Tuple;
  pivotB: Vector3Tuple;
  breakForce?: number;
  breakTorque?: number;
}

// ============================================================================
// Default Configs
// ============================================================================

export const DEFAULT_RIGID_BODY_CONFIG: RigidBodyConfig = {
  type: 'dynamic',
  mass: 1,
  velocity: [0, 0, 0],
  angularVelocity: [0, 0, 0],
  linearDamping: 0.01,
  angularDamping: 0.01,
  fixedRotation: false,
  useGravity: true,
  collisionGroup: CollisionGroups.DEFAULT,
  collisionMask: CollisionGroups.ALL,
  sleepThreshold: 0.1,
  sleepTimeThreshold: 1,
  lockPositionX: false,
  lockPositionY: false,
  lockPositionZ: false,
  lockRotationX: false,
  lockRotationY: false,
  lockRotationZ: false,
};

export const DEFAULT_PHYSICS_CONFIG: PhysicsSystemConfig = {
  gravity: [0, -9.81, 0],
  fixedTimeStep: 1 / 60,
  maxSubSteps: 3,
  broadphase: 'sap',
  allowSleep: true,
  solverIterations: 10,
  defaultContactMaterial: {
    friction: 0.3,
    restitution: 0.3,
    frictionCombine: 'average',
    restitutionCombine: 'average',
  },
};

export const DEFAULT_PHYSICS_MATERIAL: PhysicsMaterialConfig = {
  friction: 0.3,
  restitution: 0.3,
  frictionCombine: 'average',
  restitutionCombine: 'average',
};

export const DEFAULT_PHYSICS_DEBUG_CONFIG: PhysicsDebugConfig = {
  enabled: false,
  showColliders: true,
  showAABBs: false,
  showContacts: false,
  showVelocity: false,
  showNormals: false,
  showSleepState: true,
  colliderColor: '#00ff00',
  staticColor: '#888888',
  dynamicColor: '#00ff00',
  kinematicColor: '#ffff00',
  triggerColor: '#ff00ff',
  sleepingColor: '#666666',
};
