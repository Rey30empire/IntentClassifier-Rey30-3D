/**
 * RigidBody Manager - Rey30_NEXUS
 * Factory and helper functions for rigid body management
 */

import type { Vector3Tuple } from 'three';
import {
  RigidBodyConfig,
  RigidBodyState,
  DEFAULT_RIGID_BODY_CONFIG,
  BodyType,
  ForceMode,
} from './types';
import { PhysicsSystem, getPhysicsSystem } from './PhysicsSystem';

export class RigidBodyManager {
  private physicsSystem: PhysicsSystem;

  constructor(physicsSystem?: PhysicsSystem) {
    this.physicsSystem = physicsSystem ?? getPhysicsSystem();
  }

  // ============================================================================
  // Factory Methods
  // ============================================================================

  /**
   * Create a dynamic body (affected by forces and collisions)
   */
  createDynamic(id: string, mass: number = 1, config: Partial<RigidBodyConfig> = {}): RigidBodyState {
    return this.physicsSystem.createBody(id, {
      ...DEFAULT_RIGID_BODY_CONFIG,
      ...config,
      type: 'dynamic',
      mass,
    });
  }

  /**
   * Create a static body (never moves, infinite mass)
   */
  createStatic(id: string, config: Partial<RigidBodyConfig> = {}): RigidBodyState {
    return this.physicsSystem.createBody(id, {
      ...DEFAULT_RIGID_BODY_CONFIG,
      ...config,
      type: 'static',
      mass: 0,
    });
  }

  /**
   * Create a kinematic body (moved by code, affects dynamics)
   */
  createKinematic(id: string, config: Partial<RigidBodyConfig> = {}): RigidBodyState {
    return this.physicsSystem.createBody(id, {
      ...DEFAULT_RIGID_BODY_CONFIG,
      ...config,
      type: 'kinematic',
      mass: 0,
    });
  }

  // ============================================================================
  // Preset Bodies
  // ============================================================================

  /**
   * Create a player character body with capsule-like properties
   */
  createPlayerBody(id: string, config: {
    position?: Vector3Tuple;
    mass?: number;
    height?: number;
    radius?: number;
  } = {}): RigidBodyState {
    const body = this.createDynamic(id, config.mass ?? 70, {
      fixedRotation: true,
      linearDamping: 0.9,
      angularDamping: 1,
      useGravity: true,
    });

    if (config.position) {
      this.physicsSystem.setBodyPosition(id, config.position);
    }

    return body;
  }

  /**
   * Create a projectile body (fast moving, low mass)
   */
  createProjectile(id: string, config: {
    position?: Vector3Tuple;
    velocity?: Vector3Tuple;
    mass?: number;
  } = {}): RigidBodyState {
    const body = this.createDynamic(id, config.mass ?? 0.1, {
      linearDamping: 0,
      angularDamping: 0,
      useGravity: false,
    });

    if (config.position) {
      this.physicsSystem.setBodyPosition(id, config.position);
    }

    if (config.velocity) {
      this.physicsSystem.setVelocity(id, config.velocity);
    }

    return body;
  }

  /**
   * Create a vehicle body
   */
  createVehicleBody(id: string, config: {
    position?: Vector3Tuple;
    mass?: number;
  } = {}): RigidBodyState {
    const body = this.createDynamic(id, config.mass ?? 1000, {
      linearDamping: 0.1,
      angularDamping: 0.3,
    });

    if (config.position) {
      this.physicsSystem.setBodyPosition(id, config.position);
    }

    return body;
  }

  /**
   * Create a floating object (hovering, affected by gravity but dampened)
   */
  createFloatingBody(id: string, config: {
    position?: Vector3Tuple;
    mass?: number;
  } = {}): RigidBodyState {
    const body = this.createDynamic(id, config.mass ?? 1, {
      linearDamping: 0.95,
      angularDamping: 0.95,
      useGravity: true,
    });

    if (config.position) {
      this.physicsSystem.setBodyPosition(id, config.position);
    }

    return body;
  }

  // ============================================================================
  // Body Properties
  // ============================================================================

  /**
   * Get body position
   */
  getPosition(id: string): Vector3Tuple | null {
    return this.physicsSystem.getBodyPosition(id);
  }

  /**
   * Set body position
   */
  setPosition(id: string, position: Vector3Tuple): void {
    this.physicsSystem.setBodyPosition(id, position);
  }

  /**
   * Get body rotation
   */
  getRotation(id: string): Vector3Tuple | null {
    return this.physicsSystem.getBodyRotation(id);
  }

  /**
   * Set body rotation
   */
  setRotation(id: string, rotation: Vector3Tuple): void {
    this.physicsSystem.setBodyRotation(id, rotation);
  }

  /**
   * Get body velocity
   */
  getVelocity(id: string): Vector3Tuple | null {
    return this.physicsSystem.getVelocity(id);
  }

  /**
   * Set body velocity
   */
  setVelocity(id: string, velocity: Vector3Tuple): void {
    this.physicsSystem.setVelocity(id, velocity);
  }

  // ============================================================================
  // Forces & Movement
  // ============================================================================

  /**
   * Apply a force to the body
   */
  applyForce(id: string, force: Vector3Tuple, mode: ForceMode = 'force'): void {
    this.physicsSystem.applyForce(id, force, mode);
  }

  /**
   * Apply an impulse (instant force)
   */
  applyImpulse(id: string, impulse: Vector3Tuple): void {
    this.physicsSystem.applyForce(id, impulse, 'impulse');
  }

  /**
   * Apply torque
   */
  applyTorque(id: string, torque: Vector3Tuple): void {
    this.physicsSystem.applyTorque(id, torque);
  }

  /**
   * Move body to target position (for kinematic bodies)
   */
  moveTo(id: string, target: Vector3Tuple, speed: number): void {
    const current = this.getPosition(id);
    if (!current) return;

    const direction: Vector3Tuple = [
      target[0] - current[0],
      target[1] - current[1],
      target[2] - current[2],
    ];

    const length = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2);
    if (length < 0.001) return;

    const normalized: Vector3Tuple = [
      direction[0] / length,
      direction[1] / length,
      direction[2] / length,
    ];

    const velocity: Vector3Tuple = [
      normalized[0] * speed,
      normalized[1] * speed,
      normalized[2] * speed,
    ];

    this.setVelocity(id, velocity);
  }

  /**
   * Make body look at target
   */
  lookAt(id: string, target: Vector3Tuple): void {
    const current = this.getPosition(id);
    if (!current) return;

    const direction: Vector3Tuple = [
      target[0] - current[0],
      target[1] - current[1],
      target[2] - current[2],
    ];

    const yaw = Math.atan2(direction[0], direction[2]);
    const pitch = Math.atan2(direction[1], Math.sqrt(direction[0] ** 2 + direction[2] ** 2));

    this.setRotation(id, [pitch, yaw, 0]);
  }

  // ============================================================================
  // Body State
  // ============================================================================

  /**
   * Check if body exists
   */
  exists(id: string): boolean {
    return this.physicsSystem.getBody(id) !== undefined;
  }

  /**
   * Check if body is sleeping
   */
  isSleeping(id: string): boolean {
    const state = this.physicsSystem.getBody(id);
    return state?.isSleeping ?? false;
  }

  /**
   * Wake up a sleeping body
   */
  wakeUp(id: string): void {
    const state = this.physicsSystem.getBody(id);
    if (state?.cannonBody) {
      (state.cannonBody as { wakeUp: () => void }).wakeUp();
    }
  }

  /**
   * Put body to sleep
   */
  sleep(id: string): void {
    const state = this.physicsSystem.getBody(id);
    if (state?.cannonBody) {
      (state.cannonBody as { sleep: () => void }).sleep();
    }
  }

  /**
   * Change body type
   */
  setType(id: string, type: BodyType): void {
    const state = this.physicsSystem.getBody(id);
    if (state) {
      state.config.type = type;
      // Note: In cannon-es, changing body type requires recreation
      // This is a simplified approach
      console.warn('Body type change requires body recreation for full effect');
    }
  }

  /**
   * Set body mass
   */
  setMass(id: string, mass: number): void {
    const state = this.physicsSystem.getBody(id);
    if (state?.cannonBody) {
      (state.cannonBody as { mass: number }).mass = mass;
      state.config.mass = mass;
    }
  }

  /**
   * Set body damping
   */
  setDamping(id: string, linear: number, angular?: number): void {
    const state = this.physicsSystem.getBody(id);
    if (state?.cannonBody) {
      const body = state.cannonBody as { linearDamping: number; angularDamping: number };
      body.linearDamping = linear;
      if (angular !== undefined) {
        body.angularDamping = angular;
      }
    }
  }

  /**
   * Remove body
   */
  remove(id: string): void {
    this.physicsSystem.removeBody(id);
  }
}

// Singleton
let _instance: RigidBodyManager | null = null;

export function getRigidBodyManager(): RigidBodyManager {
  if (!_instance) {
    _instance = new RigidBodyManager();
  }
  return _instance;
}

export function createRigidBodyManager(physicsSystem: PhysicsSystem): RigidBodyManager {
  return new RigidBodyManager(physicsSystem);
}
