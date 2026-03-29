/**
 * Physics System - Rey30_NEXUS
 * Main physics engine with cannon-es integration
 */

import * as CANNON from 'cannon-es';
import type { Vector3Tuple } from 'three';
import {
  PhysicsSystemConfig,
  DEFAULT_PHYSICS_CONFIG,
  RigidBodyState,
  RigidBodyConfig,
  ColliderState,
  RaycastHit,
  RaycastConfig,
  SphereCastConfig,
  BoxCastConfig,
  CollisionEvent,
  CollisionEventType,
  ForceMode,
  PhysicsMaterialConfig,
  DEFAULT_PHYSICS_MATERIAL,
} from './types';

export class PhysicsSystem {
  private world: CANNON.World;
  private config: PhysicsSystemConfig;
  private bodies: Map<string, RigidBodyState> = new Map();
  private colliders: Map<string, ColliderState> = new Map();
  private materials: Map<string, CANNON.Material> = new Map();
  private contactMaterials: Map<string, CANNON.ContactMaterial> = new Map();
  private collisionEvents: CollisionEvent[] = [];
  private accumulator: number = 0;
  private isRunning: boolean = false;
  private onCollisionCallback?: (event: CollisionEvent) => void;

  constructor(config: Partial<PhysicsSystemConfig> = {}) {
    this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
    this.world = this.createWorld();
    this.setupDefaultMaterial();
  }

  // ============================================================================
  // World Setup
  // ============================================================================

  private createWorld(): CANNON.World {
    const world = new CANNON.World();

    // Gravity
    world.gravity.set(
      ...this.config.gravity
    );

    // Broadphase
    world.broadphase = this.config.broadphase === 'sap'
      ? new CANNON.SAPBroadphase(world)
      : new CANNON.NaiveBroadphase();

    // Solver
    const solver = world.solver as CANNON.GSSolver;
    solver.iterations = this.config.solverIterations;

    // Sleep
    world.allowSleep = this.config.allowSleep;

    return world;
  }

  private setupDefaultMaterial(): void {
    const defaultMaterial = new CANNON.Material('default');
    this.materials.set('default', defaultMaterial);

    const contactMaterial = new CANNON.ContactMaterial(
      defaultMaterial,
      defaultMaterial,
      {
        friction: this.config.defaultContactMaterial.friction ?? DEFAULT_PHYSICS_MATERIAL.friction,
        restitution: this.config.defaultContactMaterial.restitution ?? DEFAULT_PHYSICS_MATERIAL.restitution,
      }
    );
    this.contactMaterials.set('default-default', contactMaterial);
    this.world.addContactMaterial(contactMaterial);
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  start(): void {
    this.isRunning = true;
  }

  stop(): void {
    this.isRunning = false;
  }

  /**
   * Step the physics simulation
   * Should be called with fixed timestep in game loop
   */
  update(deltaTime: number): void {
    if (!this.isRunning) return;

    // Fixed timestep with accumulator
    this.accumulator += deltaTime;

    const maxSteps = this.config.maxSubSteps;
    let steps = 0;

    while (this.accumulator >= this.config.fixedTimeStep && steps < maxSteps) {
      this.world.step(this.config.fixedTimeStep);
      this.accumulator -= this.config.fixedTimeStep;
      steps++;
    }

    // Process collision events
    this.processCollisionEvents();
  }

  /**
   * Fixed update - step once with fixed timestep
   */
  fixedUpdate(): void {
    if (!this.isRunning) return;
    this.world.step(this.config.fixedTimeStep);
    this.processCollisionEvents();
  }

  // ============================================================================
  // Body Management
  // ============================================================================

  createBody(id: string, config: Partial<RigidBodyState['config']> = {}): RigidBodyState {
    const fullConfig: RigidBodyConfig = {
      type: 'dynamic',
      mass: 1,
      velocity: [0, 0, 0] as Vector3Tuple,
      angularVelocity: [0, 0, 0] as Vector3Tuple,
      linearDamping: 0.01,
      angularDamping: 0.01,
      fixedRotation: false,
      useGravity: true,
      collisionGroup: 1,
      collisionMask: 0xFFFFFFFF,
      sleepThreshold: 0.1,
      sleepTimeThreshold: 1,
      lockPositionX: false,
      lockPositionY: false,
      lockPositionZ: false,
      lockRotationX: false,
      lockRotationY: false,
      lockRotationZ: false,
      ...config,
    };

    const body = new CANNON.Body({
      mass: fullConfig.type === 'static' ? 0 : fullConfig.mass,
      type: this.getBodyType(fullConfig.type),
      linearDamping: fullConfig.linearDamping,
      angularDamping: fullConfig.angularDamping,
      fixedRotation: fullConfig.fixedRotation,
      sleepSpeedLimit: fullConfig.sleepThreshold,
      sleepTimeLimit: fullConfig.sleepTimeThreshold,
    });

    // Set velocity
    body.velocity.set(...fullConfig.velocity);

    // Set angular velocity
    body.angularVelocity.set(...fullConfig.angularVelocity);

    // Gravity
    (body as CANNON.Body & { useGravity?: boolean }).useGravity = fullConfig.useGravity;

    // Collision filtering
    body.collisionFilterGroup = fullConfig.collisionGroup;
    body.collisionFilterMask = fullConfig.collisionMask;

    // Default material
    body.material = this.materials.get('default') ?? null;

    // Add to world
    this.world.addBody(body);

    const state: RigidBodyState = {
      id,
      entityId: '',
      config: fullConfig,
      isSleeping: false,
      totalForce: [0, 0, 0],
      totalTorque: [0, 0, 0],
      cannonBody: body,
    };

    this.bodies.set(id, state);
    return state;
  }

  private getBodyType(type: RigidBodyConfig['type']): CANNON.BodyType {
    switch (type) {
      case 'static':
        return CANNON.Body.STATIC;
      case 'kinematic':
        return CANNON.Body.KINEMATIC;
      case 'dynamic':
      default:
        return CANNON.Body.DYNAMIC;
    }
  }

  getBody(id: string): RigidBodyState | undefined {
    return this.bodies.get(id);
  }

  removeBody(id: string): void {
    const state = this.bodies.get(id);
    if (state?.cannonBody) {
      this.world.removeBody(state.cannonBody as CANNON.Body);
    }
    this.bodies.delete(id);
  }

  // ============================================================================
  // Position & Transform
  // ============================================================================

  setBodyPosition(id: string, position: Vector3Tuple): void {
    const state = this.bodies.get(id);
    if (state?.cannonBody) {
      (state.cannonBody as CANNON.Body).position.set(...position);
    }
  }

  getBodyPosition(id: string): Vector3Tuple | null {
    const state = this.bodies.get(id);
    if (state?.cannonBody) {
      const pos = (state.cannonBody as CANNON.Body).position;
      return [pos.x, pos.y, pos.z];
    }
    return null;
  }

  setBodyRotation(id: string, rotation: Vector3Tuple): void {
    const state = this.bodies.get(id);
    if (state?.cannonBody) {
      const body = state.cannonBody as CANNON.Body;
      body.quaternion.setFromEuler(rotation[0], rotation[1], rotation[2]);
    }
  }

  getBodyRotation(id: string): Vector3Tuple | null {
    const state = this.bodies.get(id);
    if (state?.cannonBody) {
      const euler = new CANNON.Vec3();
      (state.cannonBody as CANNON.Body).quaternion.toEuler(euler);
      return [euler.x, euler.y, euler.z];
    }
    return null;
  }

  // ============================================================================
  // Forces & Impulses
  // ============================================================================

  applyForce(id: string, force: Vector3Tuple, mode: ForceMode = 'force'): void {
    const state = this.bodies.get(id);
    if (!state?.cannonBody) return;

    const body = state.cannonBody as CANNON.Body;

    switch (mode) {
      case 'force':
        body.applyForce(new CANNON.Vec3(...force));
        break;
      case 'impulse':
        body.applyImpulse(new CANNON.Vec3(...force));
        break;
      case 'acceleration':
        body.applyForce(new CANNON.Vec3(
          force[0] * body.mass,
          force[1] * body.mass,
          force[2] * body.mass
        ));
        break;
      case 'velocityChange':
        body.velocity.x += force[0];
        body.velocity.y += force[1];
        body.velocity.z += force[2];
        break;
    }
  }

  applyTorque(id: string, torque: Vector3Tuple): void {
    const state = this.bodies.get(id);
    if (state?.cannonBody) {
      (state.cannonBody as CANNON.Body).applyTorque(new CANNON.Vec3(...torque));
    }
  }

  applyForceAtPoint(
    id: string,
    force: Vector3Tuple,
    point: Vector3Tuple
  ): void {
    const state = this.bodies.get(id);
    if (state?.cannonBody) {
      (state.cannonBody as CANNON.Body).applyForce(
        new CANNON.Vec3(...force),
        new CANNON.Vec3(...point)
      );
    }
  }

  setVelocity(id: string, velocity: Vector3Tuple): void {
    const state = this.bodies.get(id);
    if (state?.cannonBody) {
      (state.cannonBody as CANNON.Body).velocity.set(...velocity);
    }
  }

  getVelocity(id: string): Vector3Tuple | null {
    const state = this.bodies.get(id);
    if (state?.cannonBody) {
      const vel = (state.cannonBody as CANNON.Body).velocity;
      return [vel.x, vel.y, vel.z];
    }
    return null;
  }

  setAngularVelocity(id: string, velocity: Vector3Tuple): void {
    const state = this.bodies.get(id);
    if (state?.cannonBody) {
      (state.cannonBody as CANNON.Body).angularVelocity.set(...velocity);
    }
  }

  // ============================================================================
  // Collider Management
  // ============================================================================

  addCollider(
    bodyId: string,
    colliderId: string,
    shape: CANNON.Shape,
    isTrigger: boolean = false,
    offset?: CANNON.Vec3,
    orientation?: CANNON.Quaternion
  ): ColliderState {
    const bodyState = this.bodies.get(bodyId);
    if (!bodyState?.cannonBody) {
      throw new Error(`Body ${bodyId} not found`);
    }

    const body = bodyState.cannonBody as CANNON.Body;
    shape.collisionResponse = !isTrigger;
    body.addShape(shape, offset, orientation);

    const colliderState: ColliderState = {
      id: colliderId,
      entityId: bodyState.entityId,
      bodyId,
      config: {
        type: 'box',
        isTrigger,
        size: [0.5, 0.5, 0.5],
        center: [0, 0, 0],
        collisionGroup: bodyState.config.collisionGroup,
        collisionMask: bodyState.config.collisionMask,
      },
      cannonShape: shape,
    };

    this.colliders.set(colliderId, colliderState);
    return colliderState;
  }

  removeCollider(colliderId: string): void {
    const state = this.colliders.get(colliderId);
    if (state?.cannonShape && state.bodyId) {
      const bodyState = this.bodies.get(state.bodyId);
      if (bodyState?.cannonBody) {
        (bodyState.cannonBody as CANNON.Body).removeShape(state.cannonShape as CANNON.Shape);
      }
    }
    this.colliders.delete(colliderId);
  }

  // ============================================================================
  // Shape Factory
  // ============================================================================

  createBoxShape(halfExtents: Vector3Tuple): CANNON.Box {
    return new CANNON.Box(new CANNON.Vec3(...halfExtents));
  }

  createSphereShape(radius: number): CANNON.Sphere {
    return new CANNON.Sphere(radius);
  }

  createCapsuleShape(radius: number, height: number): CANNON.Cylinder {
    // Cannon doesn't have native capsule, approximate with cylinder
    // Note: This is a simplification; proper capsule needs custom implementation
    return new CANNON.Cylinder(radius, radius, height, 16);
  }

  createCylinderShape(radius: number, height: number, segments: number = 16): CANNON.Cylinder {
    return new CANNON.Cylinder(radius, radius, height, segments);
  }

  createPlaneShape(): CANNON.Plane {
    return new CANNON.Plane();
  }

  createTrimeshShape(vertices: number[], indices: number[]): CANNON.Trimesh {
    return new CANNON.Trimesh(vertices, indices);
  }

  // ============================================================================
  // Raycasting
  // ============================================================================

  raycast(config: RaycastConfig): RaycastHit | null {
    const from = new CANNON.Vec3(...config.origin);
    const to = new CANNON.Vec3(
      config.origin[0] + config.direction[0] * config.maxDistance,
      config.origin[1] + config.direction[1] * config.maxDistance,
      config.origin[2] + config.direction[2] * config.maxDistance
    );

    const result = new CANNON.RaycastResult();
    this.world.raycastClosest(from, to, {
      collisionFilterMask: config.layerMask,
      skipBackfaces: true,
    }, result);

    if (result.hasHit && result.body) {
      const bodyId = this.findBodyId(result.body);

      return {
        entityId: '',
        bodyId: bodyId || '',
        colliderId: '',
        point: [result.hitPointWorld.x, result.hitPointWorld.y, result.hitPointWorld.z],
        normal: [result.hitNormalWorld.x, result.hitNormalWorld.y, result.hitNormalWorld.z],
        distance: result.distance,
        isTrigger: false,
      };
    }

    return null;
  }

  raycastAll(config: RaycastConfig): RaycastHit[] {
    const from = new CANNON.Vec3(...config.origin);
    const to = new CANNON.Vec3(
      config.origin[0] + config.direction[0] * config.maxDistance,
      config.origin[1] + config.direction[1] * config.maxDistance,
      config.origin[2] + config.direction[2] * config.maxDistance
    );

    const results: CANNON.RaycastResult[] = [];
    this.world.raycastAll(from, to, {
      collisionFilterMask: config.layerMask,
    }, (result) => {
      results.push(result);
    });

    return results
      .filter(r => r.hasHit && r.body)
      .map(result => ({
        entityId: '',
        bodyId: this.findBodyId(result.body!) || '',
        colliderId: '',
        point: [result.hitPointWorld.x, result.hitPointWorld.y, result.hitPointWorld.z] as Vector3Tuple,
        normal: [result.hitNormalWorld.x, result.hitNormalWorld.y, result.hitNormalWorld.z] as Vector3Tuple,
        distance: result.distance,
        isTrigger: false,
      }));
  }

  sphereCast(_config: SphereCastConfig): RaycastHit | null {
    // Cannon-es doesn't support sphere cast directly
    // This would need custom implementation or a workaround
    console.warn('SphereCast not fully implemented');
    return null;
  }

  boxCast(_config: BoxCastConfig): RaycastHit | null {
    // Cannon-es doesn't support box cast directly
    console.warn('BoxCast not fully implemented');
    return null;
  }

  private findBodyId(body: CANNON.Body): string | null {
    for (const [id, state] of this.bodies) {
      if (state.cannonBody === body) {
        return id;
      }
    }
    return null;
  }

  // ============================================================================
  // Collision Events
  // ============================================================================

  setCollisionCallback(callback: (event: CollisionEvent) => void): void {
    this.onCollisionCallback = callback;
  }

  private processCollisionEvents(): void {
    // Cannon-es uses events on bodies for collision detection
    // This is handled when bodies are created with event listeners
  }

  // This should be called when creating bodies that need collision events
  setupBodyCollisionEvents(bodyId: string): void {
    const state = this.bodies.get(bodyId);
    if (!state?.cannonBody) return;

    const body = state.cannonBody as CANNON.Body;

    body.addEventListener('collide', (event: { body: CANNON.Body; contact: CANNON.ContactEquation }) => {
      const otherBodyId = this.findBodyId(event.body);
      const otherState = otherBodyId ? this.bodies.get(otherBodyId) : null;

      if (this.onCollisionCallback && otherBodyId && otherState) {
        this.onCollisionCallback({
          type: 'enter',
          bodyA: state,
          bodyB: otherState,
          colliderA: this.colliders.get(bodyId) || this.createDefaultCollider(bodyId, state),
          colliderB: this.colliders.get(otherBodyId) || this.createDefaultCollider(otherBodyId, otherState),
          contacts: [{
            point: [
              event.contact.bi.position.x,
              event.contact.bi.position.y,
              event.contact.bi.position.z,
            ],
            normal: [
              event.contact.ni.x,
              event.contact.ni.y,
              event.contact.ni.z,
            ],
            depth: 0,
          }],
          impactVelocity: 0,
        });
      }
    });
  }

  private createDefaultCollider(bodyId: string, bodyState: RigidBodyState): ColliderState {
    return {
      id: `${bodyId}_default_collider`,
      entityId: bodyState.entityId,
      bodyId,
      config: {
        type: 'box',
        isTrigger: false,
        size: [0.5, 0.5, 0.5],
        center: [0, 0, 0],
        collisionGroup: bodyState.config.collisionGroup,
        collisionMask: bodyState.config.collisionMask,
      },
    };
  }

  // ============================================================================
  // Materials
  // ============================================================================

  createMaterial(id: string, config: PhysicsMaterialConfig): CANNON.Material {
    const material = new CANNON.Material(id);
    this.materials.set(id, material);

    // Create contact materials with existing materials
    for (const [otherId, otherMaterial] of this.materials) {
      if (otherId !== id) {
        const contactMaterial = new CANNON.ContactMaterial(material, otherMaterial, {
          friction: config.friction,
          restitution: config.restitution,
        });
        this.contactMaterials.set(`${id}-${otherId}`, contactMaterial);
        this.world.addContactMaterial(contactMaterial);
      }
    }

    return material;
  }

  setBodyMaterial(bodyId: string, materialId: string): void {
    const state = this.bodies.get(bodyId);
    const material = this.materials.get(materialId);

    if (state?.cannonBody && material) {
      (state.cannonBody as CANNON.Body).material = material;
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  setGravity(gravity: Vector3Tuple): void {
    this.world.gravity.set(...gravity);
  }

  getGravity(): Vector3Tuple {
    return [this.world.gravity.x, this.world.gravity.y, this.world.gravity.z];
  }

  clearForces(): void {
    for (const state of this.bodies.values()) {
      if (state.cannonBody) {
        (state.cannonBody as CANNON.Body).force.set(0, 0, 0);
        (state.cannonBody as CANNON.Body).torque.set(0, 0, 0);
      }
    }
  }

  /**
   * Get all bodies within a radius of a point
   */
  getBodiesInRadius(point: Vector3Tuple, radius: number): RigidBodyState[] {
    const result: RigidBodyState[] = [];
    const radiusSq = radius * radius;

    for (const state of this.bodies.values()) {
      if (state.cannonBody) {
        const pos = (state.cannonBody as CANNON.Body).position;
        const dx = pos.x - point[0];
        const dy = pos.y - point[1];
        const dz = pos.z - point[2];
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq <= radiusSq) {
          result.push(state);
        }
      }
    }

    return result;
  }

  /**
   * Check if a point is inside any body
   */
  pointInBody(point: Vector3Tuple): RigidBodyState | null {
    const rayFrom = new CANNON.Vec3(point[0], point[1], point[2]);
    const rayTo = new CANNON.Vec3(point[0] + 0.001, point[1] + 0.001, point[2] + 0.001);

    const result = new CANNON.RaycastResult();
    this.world.raycastClosest(rayFrom, rayTo, {}, result);

    if (result.hasHit && result.body) {
      const bodyId = this.findBodyId(result.body);
      return bodyId ? this.bodies.get(bodyId) || null : null;
    }

    return null;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    // Remove all bodies
    for (const body of this.world.bodies) {
      this.world.removeBody(body);
    }

    this.bodies.clear();
    this.colliders.clear();
    this.materials.clear();
    this.contactMaterials.clear();
    this.collisionEvents = [];
    this.isRunning = false;
  }
}

// Singleton instance
let _instance: PhysicsSystem | null = null;

export function createPhysicsSystem(config?: Partial<PhysicsSystemConfig>): PhysicsSystem {
  if (!_instance) {
    _instance = new PhysicsSystem(config);
  }
  return _instance;
}

export function getPhysicsSystem(): PhysicsSystem {
  if (!_instance) {
    throw new Error('PhysicsSystem not initialized. Call createPhysicsSystem first.');
  }
  return _instance;
}

export function destroyPhysicsSystem(): void {
  if (_instance) {
    _instance.destroy();
    _instance = null;
  }
}
