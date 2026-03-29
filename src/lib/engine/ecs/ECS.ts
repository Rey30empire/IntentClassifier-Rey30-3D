/**
 * NEXUS Engine - Entity Component System (ECS)
 * 
 * Implementación de ECS inspirada en:
 * - Unity DOTS
 * - Bevy Engine
 * - ECSY
 * 
 * Componentes:
 * - Entity: ID único (solo un número)
 * - Component: Datos puros
 * - System: Lógica que opera en componentes
 * - World: Contenedor de todo
 */

// ============================================
// ENTITY
// ============================================

/** Entity es solo un ID único */
export type Entity = number;

/** Entity name component for debugging */
export interface EntityName {
  name: string;
  tags: string[];
}

export interface EntityRecord {
  id: Entity;
  name: string;
  components: Map<string, unknown>;
}

// ============================================
// COMPONENT TYPES
// ============================================

/** Component data interface - components are pure data */
export interface IComponent {
  readonly __componentType: string;
}

/** Transform Component */
export interface TransformComponent extends IComponent {
  __componentType: 'Transform';
  position: [number, number, number];
  rotation: [number, number, number]; // Euler angles in radians
  scale: [number, number, number];
  parent?: Entity;
  children: Entity[];
  worldPosition: [number, number, number];
  worldRotation: [number, number, number];
  worldScale: [number, number, number];
  dirty: boolean;
}

/** Transform methods */
export const Transform = {
  create(partial?: Partial<TransformComponent>): TransformComponent {
    return {
      __componentType: 'Transform',
      position: partial?.position ?? [0, 0, 0],
      rotation: partial?.rotation ?? [0, 0, 0],
      scale: partial?.scale ?? [1, 1, 1],
      children: partial?.children ?? [],
      worldPosition: [0, 0, 0],
      worldRotation: [0, 0, 0],
      worldScale: [1, 1, 1],
      dirty: true,
    };
  },

  setPosition(transform: TransformComponent, x: number, y: number, z: number): void {
    transform.position[0] = x;
    transform.position[1] = y;
    transform.position[2] = z;
    transform.dirty = true;
  },

  setRotation(transform: TransformComponent, x: number, y: number, z: number): void {
    transform.rotation[0] = x;
    transform.rotation[1] = y;
    transform.rotation[2] = z;
    transform.dirty = true;
  },

  setScale(transform: TransformComponent, x: number, y: number, z: number): void {
    transform.scale[0] = x;
    transform.scale[1] = y;
    transform.scale[2] = z;
    transform.dirty = true;
  },

  translate(transform: TransformComponent, x: number, y: number, z: number): void {
    transform.position[0] += x;
    transform.position[1] += y;
    transform.position[2] += z;
    transform.dirty = true;
  },

  rotate(transform: TransformComponent, x: number, y: number, z: number): void {
    transform.rotation[0] += x;
    transform.rotation[1] += y;
    transform.rotation[2] += z;
    transform.dirty = true;
  },
};

/** Mesh Renderer Component */
export interface MeshRendererComponent extends IComponent {
  __componentType: 'MeshRenderer';
  meshId: string;         // Reference to mesh data-block
  materialId: string;     // Reference to material data-block
  visible: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
}

/** Camera Component */
export interface CameraComponent extends IComponent {
  __componentType: 'Camera';
  fov: number;
  near: number;
  far: number;
  aspect: number;
  isPerspective: boolean;
  orthoSize: number;
  priority: number;
  enabled: boolean;
}

/** Light Component */
export interface LightComponent extends IComponent {
  __componentType: 'Light';
  type: 'directional' | 'point' | 'spot' | 'ambient';
  color: [number, number, number];
  intensity: number;
  range: number;         // For point/spot
  angle: number;         // For spot
  castShadow: boolean;
}

/** Rigid Body Component */
export interface RigidBodyComponent extends IComponent {
  __componentType: 'RigidBody';
  mass: number;
  velocity: [number, number, number];
  angularVelocity: [number, number, number];
  useGravity: boolean;
  isKinematic: boolean;
  friction: number;
  restitution: number;  // Bounciness
  linearDamping: number;
  angularDamping: number;
}

/** Collider Component */
export interface ColliderComponent extends IComponent {
  __componentType: 'Collider';
  type: 'box' | 'sphere' | 'capsule' | 'mesh';
  size: [number, number, number];      // For box
  radius: number;                       // For sphere/capsule
  height: number;                       // For capsule
  center: [number, number, number];
  isTrigger: boolean;
}

/** Audio Source Component */
export interface AudioSourceComponent extends IComponent {
  __componentType: 'AudioSource';
  clipId: string;
  volume: number;
  pitch: number;
  loop: boolean;
  playOnAwake: boolean;
  spatialBlend: number;  // 0 = 2D, 1 = 3D
  minDistance: number;
  maxDistance: number;
  isPlaying: boolean;
}

/** Particle Emitter Component */
export interface ParticleEmitterComponent extends IComponent {
  __componentType: 'ParticleEmitter';
  rate: number;           // Particles per second
  maxParticles: number;
  lifetime: [number, number];  // Min, max
  speed: [number, number];
  size: [number, number];
  color: [[number, number, number], [number, number, number]];
  velocityShape: 'cone' | 'sphere' | 'box';
  velocityParams: [number, number, number, number];
  emitting: boolean;
}

/** Script Component */
export interface ScriptComponent extends IComponent {
  __componentType: 'Script';
  scriptId: string;
  enabled: boolean;
  variables: Record<string, unknown>;
}

/** Animation Component */
export interface AnimationComponent extends IComponent {
  __componentType: 'Animation';
  clips: string[];         // Animation clip IDs
  currentClip: string | null;
  time: number;
  speed: number;
  looping: boolean;
  playing: boolean;
}

/** Tag Component (for queries) */
export interface TagComponent extends IComponent {
  __componentType: 'Tag';
  tags: Set<string>;
}

/** All component types union */
export type ComponentType = 
  | TransformComponent
  | MeshRendererComponent
  | CameraComponent
  | LightComponent
  | RigidBodyComponent
  | ColliderComponent
  | AudioSourceComponent
  | ParticleEmitterComponent
  | ScriptComponent
  | AnimationComponent
  | TagComponent;

/** Component type names */
export type ComponentTypeName = ComponentType['__componentType'];

// ============================================
// SYSTEM
// ============================================

/** System execution priority */
export type SystemPriority = 'earliest' | 'early' | 'normal' | 'late' | 'latest';

/** System interface */
export interface ISystem {
  name: string;
  priority: SystemPriority;
  enabled: boolean;
  
  /** Called once when system is registered */
  init?(world: World): void;
  
  /** Called every frame */
  update(world: World, deltaTime: number): void;
  
  /** Called once when system is removed */
  destroy?(world: World): void;
}

// ============================================
// QUERY
// ============================================

/** Query for filtering entities by components */
export interface Query {
  all: ComponentTypeName[];      // Must have all these
  any?: ComponentTypeName[];     // Must have at least one
  none?: ComponentTypeName[];    // Must not have any
}

// ============================================
// WORLD
// ============================================

/** Component storage type */
type ComponentStore = Map<string, Map<Entity, unknown>>;

class EntityComponentView extends Map<string, unknown> {
  constructor(private world: World, private entity: Entity) {
    super();
  }

  override get(type: string): unknown {
    return this.world.getComponentData(type, this.entity);
  }

  override set(type: string, value: unknown): this {
    this.world.setComponentData(this.entity, type, value);
    return this;
  }

  override has(type: string): boolean {
    return this.world.hasComponent(this.entity, type);
  }

  override delete(type: string): boolean {
    const existed = this.has(type);
    this.world.removeComponent(this.entity, type);
    return existed;
  }

  override entries(): MapIterator<[string, unknown]> {
    return this.world.getComponentEntries(this.entity);
  }

  override keys(): MapIterator<string> {
    return this.world.getComponentKeys(this.entity);
  }

  override values(): MapIterator<unknown> {
    return this.world.getComponentValues(this.entity);
  }

  override [Symbol.iterator](): MapIterator<[string, unknown]> {
    return this.entries();
  }
}

/** World - the main container */
export class World {
  protected nextEntityId: Entity = 1;
  protected entities: Set<Entity> = new Set();
  protected entityNames: Map<Entity, EntityName> = new Map();
  protected components: ComponentStore = new Map();
  protected systems: ISystem[] = [];
  protected queries: Map<string, Set<Entity>> = new Map();

  constructor() {
    // Initialize component storage for all types
    const componentTypes: ComponentTypeName[] = [
      'Transform', 'MeshRenderer', 'Camera', 'Light',
      'RigidBody', 'Collider', 'AudioSource', 'ParticleEmitter',
      'Script', 'Animation', 'Tag'
    ];
    for (const type of componentTypes) {
      this.components.set(type, new Map());
    }
  }

  // ===== ENTITY MANAGEMENT =====

  /** Create a new entity */
  createEntity(name?: string, entityId?: Entity): Entity {
    const entity = entityId ?? this.nextEntityId++;
    if (entityId !== undefined) {
      this.nextEntityId = Math.max(this.nextEntityId, entityId + 1);
    }
    this.entities.add(entity);
    this.entityNames.set(entity, {
      name: name ?? `Entity_${entity}`,
      tags: [],
    });
    return entity;
  }

  getEntity(entity: Entity): EntityRecord | undefined {
    if (!this.entities.has(entity)) {
      return undefined;
    }

    return {
      id: entity,
      name: this.getEntityName(entity) ?? `Entity_${entity}`,
      components: new EntityComponentView(this, entity),
    };
  }

  /** Destroy an entity and all its components */
  destroyEntity(entity: Entity): void {
    if (!this.entities.has(entity)) return;
    
    // Remove all components
    for (const [, store] of this.components) {
      store.delete(entity);
    }
    
    this.entities.delete(entity);
    this.entityNames.delete(entity);
    this.invalidateQueries();
  }

  /** Check if entity exists */
  hasEntity(entity: Entity): boolean {
    return this.entities.has(entity);
  }

  /** Get all entities */
  getAllEntities(): Entity[] {
    return Array.from(this.entities);
  }

  /** Get entity count */
  get entityCount(): number {
    return this.entities.size;
  }

  /** Get entity name */
  getEntityName(entity: Entity): string | undefined {
    return this.entityNames.get(entity)?.name;
  }

  /** Set entity name */
  setEntityName(entity: Entity, name: string): void {
    const data = this.entityNames.get(entity);
    if (data) data.name = name;
  }

  // ===== COMPONENT MANAGEMENT =====

  /** Add component to entity */
  addComponent<T extends ComponentType>(entity: Entity, component: T): T {
    if (!this.entities.has(entity)) {
      throw new Error(`Entity ${entity} does not exist`);
    }
    
    const store = this.components.get(component.__componentType);
    if (store) {
      store.set(entity, component);
    }
    
    this.invalidateQueries();
    return component;
  }

  /** Remove component from entity */
  removeComponent(entity: Entity, type: string): void {
    const store = this.components.get(type);
    if (store) {
      store.delete(entity);
    }
    this.invalidateQueries();
  }

  /** Get component from entity */
  getComponent<T = unknown>(entity: Entity, type: string): T | undefined {
    const store = this.components.get(type);
    return store?.get(entity) as T | undefined;
  }

  /** Check if entity has component */
  hasComponent(entity: Entity, type: string): boolean {
    const store = this.components.get(type);
    return store?.has(entity) ?? false;
  }

  /** Check if entity has all components */
  hasComponents(entity: Entity, types: ComponentTypeName[]): boolean {
    return types.every(type => this.hasComponent(entity, type));
  }

  /** Get all components for entity */
  getComponents(entity: Entity): unknown[] {
    const result: unknown[] = [];
    for (const [, store] of this.components) {
      const component = store.get(entity);
      if (component) result.push(component);
    }
    return result;
  }

  setComponentData(entity: Entity, type: string, data: unknown): void {
    if (!this.entities.has(entity)) {
      throw new Error(`Entity ${entity} does not exist`);
    }

    const store = this.components.get(type) ?? new Map<Entity, unknown>();
    store.set(entity, data);
    this.components.set(type, store);
    this.invalidateQueries();
  }

  getComponentData(type: string, entity: Entity): unknown {
    return this.components.get(type)?.get(entity);
  }

  getComponentEntries(entity: Entity): MapIterator<[string, unknown]> {
    const entries = new Map<string, unknown>();

    for (const [type, store] of this.components) {
      const component = store.get(entity);
      if (component !== undefined) {
        entries.set(type, component);
      }
    }

    return entries.entries();
  }

  getComponentKeys(entity: Entity): MapIterator<string> {
    return new Map(Array.from(this.getComponentEntries(entity))).keys();
  }

  getComponentValues(entity: Entity): MapIterator<unknown> {
    return new Map(Array.from(this.getComponentEntries(entity))).values();
  }

  // ===== QUERY SYSTEM =====

  /** Query entities by components */
  query(query: Query): Entity[] {
    const results: Entity[] = [];
    
    for (const entity of this.entities) {
      // Check "all" - must have all these components
      if (query.all.length > 0 && !this.hasComponents(entity, query.all)) {
        continue;
      }
      
      // Check "any" - must have at least one
      if (query.any && query.any.length > 0) {
        const hasAny = query.any.some(type => this.hasComponent(entity, type));
        if (!hasAny) continue;
      }
      
      // Check "none" - must not have any
      if (query.none && query.none.length > 0) {
        const hasNone = query.none.some(type => this.hasComponent(entity, type));
        if (hasNone) continue;
      }
      
      results.push(entity);
    }
    
    return results;
  }

  /** Quick query - entities with single component */
  queryByComponent<T extends ComponentType>(type: T['__componentType']): Entity[] {
    const store = this.components.get(type);
    return store ? Array.from(store.keys()) : [];
  }

  queryEntities(types: string[]): EntityRecord[] {
    const entities = types.length === 0
      ? this.getAllEntities()
      : this.query({ all: types as ComponentTypeName[] });

    return entities
      .map((entity) => this.getEntity(entity))
      .filter((entity): entity is EntityRecord => entity !== undefined);
  }

  /** Quick query - entities with two components */
  queryByTwo<A extends ComponentTypeName, B extends ComponentTypeName>(
    typeA: A,
    typeB: B
  ): Entity[] {
    return this.query({ all: [typeA, typeB] });
  }

  /** Quick query - entities with three components */
  queryByThree<A extends ComponentTypeName, B extends ComponentTypeName, C extends ComponentTypeName>(
    typeA: A,
    typeB: B,
    typeC: C
  ): Entity[] {
    return this.query({ all: [typeA, typeB, typeC] });
  }

  /** Iterate over entities with components */
  forEach<A extends ComponentType>(
    type: A['__componentType'],
    callback: (entity: Entity, component: A) => void
  ): void {
    const store = this.components.get(type);
    if (store) {
      for (const [entity, component] of store) {
        callback(entity, component as A);
      }
    }
  }

  /** Iterate over entities with two components */
  forEachPair<A extends ComponentType, B extends ComponentType>(
    typeA: A['__componentType'],
    typeB: B['__componentType'],
    callback: (entity: Entity, a: A, b: B) => void
  ): void {
    const storeA = this.components.get(typeA);
    const storeB = this.components.get(typeB);
    
    if (storeA && storeB) {
      for (const [entity, componentA] of storeA) {
        const componentB = storeB.get(entity);
        if (componentB) {
          callback(entity, componentA as A, componentB as B);
        }
      }
    }
  }

  /** Invalidate cached queries */
  private invalidateQueries(): void {
    this.queries.clear();
  }

  // ===== SYSTEM MANAGEMENT =====

  /** Register a system */
  registerSystem(system: ISystem): void {
    this.systems.push(system);
    this.sortSystems();
    system.init?.(this);
  }

  /** Remove a system */
  removeSystem(name: string): void {
    const index = this.systems.findIndex(s => s.name === name);
    if (index > -1) {
      this.systems[index].destroy?.(this);
      this.systems.splice(index, 1);
    }
  }

  /** Get system by name */
  getSystem<T extends ISystem>(name: string): T | undefined {
    return this.systems.find(s => s.name === name) as T | undefined;
  }

  /** Enable/disable system */
  setSystemEnabled(name: string, enabled: boolean): void {
    const system = this.systems.find(s => s.name === name);
    if (system) system.enabled = enabled;
  }

  /** Sort systems by priority */
  private sortSystems(): void {
    const priorityOrder: Record<SystemPriority, number> = {
      earliest: 0,
      early: 1,
      normal: 2,
      late: 3,
      latest: 4,
    };
    
    this.systems.sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /** Update all systems */
  update(deltaTime: number): void {
    for (const system of this.systems) {
      if (system.enabled) {
        system.update(this, deltaTime);
      }
    }
  }

  // ===== SERIALIZATION =====

  /** Serialize world to JSON */
  serialize(): object {
    const data: {
      entities: Array<{
        id: Entity;
        name: string;
        components: unknown[];
      }>;
    } = {
      entities: [],
    };

    for (const entity of this.entities) {
      const name = this.entityNames.get(entity);
      data.entities.push({
        id: entity,
        name: name?.name ?? `Entity_${entity}`,
        components: this.getComponents(entity),
      });
    }

    return data;
  }

  // ===== CLEANUP =====

  /** Clear all entities and components */
  clear(): void {
    this.entities.clear();
    this.entityNames.clear();
    for (const [, store] of this.components) {
      store.clear();
    }
    this.queries.clear();
    this.nextEntityId = 1;
  }
}

// ============================================
// BUILT-IN SYSTEMS
// ============================================

/** Transform hierarchy system - updates world transforms */
export class TransformSystem implements ISystem {
  name = 'TransformSystem';
  priority: SystemPriority = 'earliest';
  enabled = true;

  update(world: World, _deltaTime: number): void {
    // Get all entities with transform
    const entities = world.query({ all: ['Transform'] });

    for (const entity of entities) {
      const transform = world.getComponent<TransformComponent>(entity, 'Transform');
      if (!transform) continue;

      if (transform.dirty || transform.parent !== undefined) {
        this.updateWorldTransform(world, entity, transform);
      }
    }
  }

  private updateWorldTransform(
    world: World,
    _entity: Entity,
    transform: TransformComponent
  ): void {
    if (transform.parent !== undefined) {
      const parentTransform = world.getComponent<TransformComponent>(transform.parent, 'Transform');
      if (parentTransform) {
        // Combine with parent transforms
        transform.worldPosition[0] = parentTransform.worldPosition[0] + transform.position[0];
        transform.worldPosition[1] = parentTransform.worldPosition[1] + transform.position[1];
        transform.worldPosition[2] = parentTransform.worldPosition[2] + transform.position[2];
        
        transform.worldRotation[0] = parentTransform.worldRotation[0] + transform.rotation[0];
        transform.worldRotation[1] = parentTransform.worldRotation[1] + transform.rotation[1];
        transform.worldRotation[2] = parentTransform.worldRotation[2] + transform.rotation[2];
        
        transform.worldScale[0] = parentTransform.worldScale[0] * transform.scale[0];
        transform.worldScale[1] = parentTransform.worldScale[1] * transform.scale[1];
        transform.worldScale[2] = parentTransform.worldScale[2] * transform.scale[2];
      }
    } else {
      // No parent, world = local
      transform.worldPosition[0] = transform.position[0];
      transform.worldPosition[1] = transform.position[1];
      transform.worldPosition[2] = transform.position[2];
      
      transform.worldRotation[0] = transform.rotation[0];
      transform.worldRotation[1] = transform.rotation[1];
      transform.worldRotation[2] = transform.rotation[2];
      
      transform.worldScale[0] = transform.scale[0];
      transform.worldScale[1] = transform.scale[1];
      transform.worldScale[2] = transform.scale[2];
    }

    transform.dirty = false;
  }
}

// ============================================
// SINGLETON WORLD
// ============================================

/** Default world instance */
export class ECS extends World {}

export type System = ISystem;
export type ComponentData = ComponentType;
export type EntityQuery = Query;

export const EngineWorld = new ECS();

// Register built-in systems
EngineWorld.registerSystem(new TransformSystem());

export function createECS(): ECS {
  const ecs = new ECS();
  ecs.registerSystem(new TransformSystem());
  return ecs;
}
