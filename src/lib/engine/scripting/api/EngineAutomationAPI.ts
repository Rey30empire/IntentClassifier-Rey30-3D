/**
 * Engine Automation API
 *
 * Safe scripting facade aligned with the current ECS implementation.
 */

import { EventBus } from '../../core/EventSystem';
import {
  ECS,
  Entity,
  EntityRecord,
  TransformComponent,
} from '../../ecs/ECS';
import {
  EntityId,
  AssetId,
  ParticleId,
  TransactionId,
  SnapshotId,
  Vector3,
  Quaternion,
  Euler,
  TransformData,
  ComponentType,
  SecurityLevel,
  ExecutionError,
  SceneChange,
  UndoSnapshot,
  Transaction,
  ValidationResult,
  ValidationWarning,
  EntityState,
  ComponentConfig,
} from '../types';

const generateId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const DEFAULT_TRANSFORM: TransformData = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isQuaternion(value: Quaternion | Euler): value is Quaternion {
  return 'w' in value;
}

export class EngineAutomationAPI {
  private ecs: ECS;
  private eventBus: EventBus;
  private transactions: Map<TransactionId, Transaction> = new Map();
  private snapshots: Map<SnapshotId, UndoSnapshot> = new Map();
  private currentTransaction: TransactionId | null = null;
  private changeLog: SceneChange[] = [];
  private securityLevel: SecurityLevel = 'safe_scene_only';

  constructor(ecs: ECS, eventBus: EventBus) {
    this.ecs = ecs;
    this.eventBus = eventBus;
  }

  setSecurityLevel(level: SecurityLevel): void {
    this.securityLevel = level;
  }

  getSecurityLevel(): SecurityLevel {
    return this.securityLevel;
  }

  private checkPermission(_operation: string): boolean {
    return true;
  }

  private createError(message: string, code: string, recoverable = false): ExecutionError {
    return {
      message,
      code,
      recoverable,
    };
  }

  private cloneValue<T>(value: T): T {
    return structuredClone(value);
  }

  private toNumericEntityId(entityId: EntityId): Entity {
    if (typeof entityId === 'number') {
      return entityId;
    }

    const parsed = Number(entityId);
    if (Number.isInteger(parsed)) {
      return parsed;
    }

    throw this.createError(`Invalid entity id: ${entityId}`, 'INVALID_ENTITY_ID');
  }

  private getEntityRecord(entityId: EntityId): EntityRecord {
    const record = this.ecs.getEntity(this.toNumericEntityId(entityId));
    if (!record) {
      throw this.createError(`Entity not found: ${entityId}`, 'ENTITY_NOT_FOUND');
    }
    return record;
  }

  private getTransformData(record: EntityRecord): TransformData {
    const component = record.components.get('Transform');
    if (!isRecord(component)) {
      return this.cloneValue(DEFAULT_TRANSFORM);
    }

    const position = Array.isArray(component.position)
      ? component.position
      : [0, 0, 0];
    const rotation = Array.isArray(component.rotation)
      ? component.rotation
      : [0, 0, 0];
    const scale = Array.isArray(component.scale)
      ? component.scale
      : [1, 1, 1];

    return {
      position: {
        x: Number(position[0] ?? 0),
        y: Number(position[1] ?? 0),
        z: Number(position[2] ?? 0),
      },
      rotation: {
        x: Number(rotation[0] ?? 0),
        y: Number(rotation[1] ?? 0),
        z: Number(rotation[2] ?? 0),
        w: 1,
      },
      scale: {
        x: Number(scale[0] ?? 1),
        y: Number(scale[1] ?? 1),
        z: Number(scale[2] ?? 1),
      },
    };
  }

  private buildTransformComponent(
    transform: TransformData,
    existing?: Partial<TransformComponent>
  ): TransformComponent {
    const rotation: [number, number, number] = isQuaternion(transform.rotation)
      ? [transform.rotation.x, transform.rotation.y, transform.rotation.z]
      : [transform.rotation.x, transform.rotation.y, transform.rotation.z];

    return {
      __componentType: 'Transform',
      position: [transform.position.x, transform.position.y, transform.position.z],
      rotation,
      scale: [transform.scale.x, transform.scale.y, transform.scale.z],
      parent: existing?.parent,
      children: existing?.children ?? [],
      worldPosition: existing?.worldPosition ?? [transform.position.x, transform.position.y, transform.position.z],
      worldRotation: existing?.worldRotation ?? rotation,
      worldScale: existing?.worldScale ?? [transform.scale.x, transform.scale.y, transform.scale.z],
      dirty: true,
    };
  }

  private cloneComponentData(data: unknown): Record<string, unknown> {
    if (!isRecord(data)) {
      return { value: this.cloneValue(data) };
    }

    const cloned = this.cloneValue(data);
    if ('tags' in cloned && cloned.tags instanceof Set) {
      return {
        ...cloned,
        tags: Array.from(cloned.tags),
      };
    }

    return cloned;
  }

  private normalizeComponentValue(type: string, data: Record<string, unknown>): unknown {
    if (type === 'Transform') {
      const transform: TransformData = {
        position: (data.position as Vector3 | undefined) ?? this.cloneValue(DEFAULT_TRANSFORM.position),
        rotation: (data.rotation as Quaternion | Euler | undefined) ?? this.cloneValue(DEFAULT_TRANSFORM.rotation),
        scale: (data.scale as Vector3 | undefined) ?? this.cloneValue(DEFAULT_TRANSFORM.scale),
      };
      return this.buildTransformComponent(transform);
    }

    if (type === 'Tag' && Array.isArray(data.tags)) {
      return {
        __componentType: 'Tag',
        tags: new Set(data.tags),
      };
    }

    return this.cloneValue(data);
  }

  private entityStateFromRecord(record: EntityRecord): EntityState {
    const components: ComponentConfig[] = [];

    for (const [type, data] of record.components.entries()) {
      components.push({
        type,
        data: this.cloneComponentData(data),
      });
    }

    const transformComponent = record.components.get('Transform') as Partial<TransformComponent> | undefined;
    const tagComponent = record.components.get('Tag');
    let tags: string[] = [];

    if (tagComponent instanceof Set) {
      tags = Array.from(tagComponent).map(String);
    } else if (isRecord(tagComponent) && Array.isArray(tagComponent.tags)) {
      tags = tagComponent.tags.map(String);
    } else if (isRecord(tagComponent) && tagComponent.tags instanceof Set) {
      tags = Array.from(tagComponent.tags).map(String);
    }

    return {
      entity_id: record.id,
      name: record.name,
      components,
      transform: this.getTransformData(record),
      parent_id: transformComponent?.parent,
      children: transformComponent?.children ?? [],
      tags,
      active: true,
    };
  }

  private logChange(change: SceneChange): void {
    this.changeLog.push(change);
    this.eventBus.emit('scene:changed', { change });
  }

  async create_entity(name: string, archetype?: string): Promise<EntityId> {
    if (!this.checkPermission('spawn_character')) {
      throw this.createError('Permission denied: cannot create entity', 'PERMISSION_DENIED');
    }

    const entityId = this.ecs.createEntity(name);

    this.logChange({
      change_id: generateId('change'),
      action_id: '',
      change_type: 'create',
      target_type: 'entity',
      target_id: String(entityId),
      new_value: { name, archetype },
      timestamp: Date.now(),
    });

    this.eventBus.emit('entity:created', { entity: entityId, name });
    return entityId;
  }

  async destroy_entity(entity_id: EntityId): Promise<void> {
    if (!this.checkPermission('destroy_entity')) {
      throw this.createError('Permission denied: cannot destroy entity', 'PERMISSION_DENIED');
    }

    const record = this.getEntityRecord(entity_id);
    const state = this.entityStateFromRecord(record);

    this.ecs.destroyEntity(record.id);

    this.logChange({
      change_id: generateId('change'),
      action_id: '',
      change_type: 'delete',
      target_type: 'entity',
      target_id: String(record.id),
      old_value: state,
      timestamp: Date.now(),
    });

    this.eventBus.emit('entity:destroyed', { entity: record.id });
  }

  async duplicate_entity(entity_id: EntityId): Promise<EntityId> {
    if (!this.checkPermission('duplicate_entity')) {
      throw this.createError('Permission denied: cannot duplicate entity', 'PERMISSION_DENIED');
    }

    const source = this.getEntityRecord(entity_id);
    const newEntityId = this.ecs.createEntity(`${source.name}_copy`);
    const duplicate = this.getEntityRecord(newEntityId);

    for (const [componentType, component] of source.components.entries()) {
      duplicate.components.set(componentType, this.cloneValue(component));
    }

    this.logChange({
      change_id: generateId('change'),
      action_id: '',
      change_type: 'create',
      target_type: 'entity',
      target_id: String(newEntityId),
      new_value: { source_entity: source.id },
      timestamp: Date.now(),
    });

    this.eventBus.emit('entity:duplicated', {
      sourceId: source.id,
      newId: newEntityId,
    });

    return newEntityId;
  }

  async add_component(
    entity_id: EntityId,
    component_type: ComponentType,
    config?: Record<string, unknown>
  ): Promise<void> {
    if (!this.checkPermission('add_component')) {
      throw this.createError('Permission denied: cannot add component', 'PERMISSION_DENIED');
    }

    const entity = this.getEntityRecord(entity_id);
    entity.components.set(component_type, this.normalizeComponentValue(component_type, config ?? {}));

    this.logChange({
      change_id: generateId('change'),
      action_id: '',
      change_type: 'create',
      target_type: 'component',
      target_id: String(entity.id),
      property_path: component_type,
      new_value: config ?? {},
      timestamp: Date.now(),
    });

    this.eventBus.emit('component:added', {
      entity: entity.id,
      type: component_type,
    });
  }

  async remove_component(entity_id: EntityId, component_type: ComponentType): Promise<void> {
    if (!this.checkPermission('remove_component')) {
      throw this.createError('Permission denied: cannot remove component', 'PERMISSION_DENIED');
    }

    const entity = this.getEntityRecord(entity_id);
    const oldComponent = entity.components.get(component_type);

    if (!oldComponent) {
      throw this.createError(
        `Component ${component_type} not found on entity ${entity_id}`,
        'COMPONENT_NOT_FOUND'
      );
    }

    entity.components.delete(component_type);

    this.logChange({
      change_id: generateId('change'),
      action_id: '',
      change_type: 'delete',
      target_type: 'component',
      target_id: String(entity.id),
      property_path: component_type,
      old_value: this.cloneComponentData(oldComponent),
      timestamp: Date.now(),
    });

    this.eventBus.emit('component:removed', {
      entity: entity.id,
      type: component_type,
    });
  }

  has_component(entity_id: EntityId, component_type: ComponentType): boolean {
    const entity = this.ecs.getEntity(this.toNumericEntityId(entity_id));
    return entity ? entity.components.has(component_type) : false;
  }

  async set_transform(entity_id: EntityId, transform: TransformData): Promise<void> {
    if (!this.checkPermission('set_transform')) {
      throw this.createError('Permission denied: cannot set transform', 'PERMISSION_DENIED');
    }

    const entity = this.getEntityRecord(entity_id);
    const oldTransform = this.getTransformData(entity);
    const existing = entity.components.get('Transform') as Partial<TransformComponent> | undefined;

    entity.components.set('Transform', this.buildTransformComponent(transform, existing));

    this.logChange({
      change_id: generateId('change'),
      action_id: '',
      change_type: 'update',
      target_type: 'property',
      target_id: String(entity.id),
      property_path: 'Transform',
      old_value: oldTransform,
      new_value: transform,
      timestamp: Date.now(),
    });

    this.eventBus.emit('transform:changed', { entityId: entity.id, transform });
  }

  get_transform(entity_id: EntityId): TransformData | null {
    const entity = this.ecs.getEntity(this.toNumericEntityId(entity_id));
    return entity ? this.getTransformData(entity) : null;
  }

  async set_position(entity_id: EntityId, position: Vector3): Promise<void> {
    const transform = this.get_transform(entity_id) ?? this.cloneValue(DEFAULT_TRANSFORM);
    await this.set_transform(entity_id, { ...transform, position });
  }

  async set_rotation(entity_id: EntityId, rotation: Quaternion | Euler): Promise<void> {
    const transform = this.get_transform(entity_id) ?? this.cloneValue(DEFAULT_TRANSFORM);
    await this.set_transform(entity_id, { ...transform, rotation });
  }

  async set_scale(entity_id: EntityId, scale: Vector3): Promise<void> {
    const transform = this.get_transform(entity_id) ?? this.cloneValue(DEFAULT_TRANSFORM);
    await this.set_transform(entity_id, { ...transform, scale });
  }

  async load_asset(path_or_guid: string): Promise<AssetId> {
    if (!this.checkPermission('load_asset')) {
      throw this.createError('Permission denied: cannot load asset', 'PERMISSION_DENIED');
    }

    const assetId = generateId('asset');
    this.eventBus.emit('asset:loaded', { assetId, path: path_or_guid });
    return assetId;
  }

  async instantiate_prefab(prefab_id: string, position?: Vector3): Promise<EntityId> {
    if (!this.checkPermission('instantiate_prefab')) {
      throw this.createError('Permission denied: cannot instantiate prefab', 'PERMISSION_DENIED');
    }

    const entityId = this.ecs.createEntity(`Prefab_${prefab_id}`);

    if (position) {
      const entity = this.getEntityRecord(entityId);
      entity.components.set(
        'Transform',
        this.buildTransformComponent({
          position,
          rotation: this.cloneValue(DEFAULT_TRANSFORM.rotation),
          scale: this.cloneValue(DEFAULT_TRANSFORM.scale),
        })
      );
    }

    this.logChange({
      change_id: generateId('change'),
      action_id: '',
      change_type: 'create',
      target_type: 'entity',
      target_id: String(entityId),
      new_value: { prefab_id, position },
      timestamp: Date.now(),
    });

    this.eventBus.emit('prefab:instantiated', {
      prefabId: prefab_id,
      entityId,
    });

    return entityId;
  }

  async set_material(entity_id: EntityId, material_id: string): Promise<void> {
    if (!this.checkPermission('set_material')) {
      throw this.createError('Permission denied: cannot set material', 'PERMISSION_DENIED');
    }

    const entity = this.getEntityRecord(entity_id);
    const oldMaterial = entity.components.get('MeshRenderer');
    const oldMaterialData = isRecord(oldMaterial) ? oldMaterial : {};

    entity.components.set('MeshRenderer', {
      ...oldMaterialData,
      materialId: material_id,
    });

    this.logChange({
      change_id: generateId('change'),
      action_id: '',
      change_type: 'update',
      target_type: 'property',
      target_id: String(entity.id),
      property_path: 'MeshRenderer.materialId',
      old_value: oldMaterialData.materialId,
      new_value: material_id,
      timestamp: Date.now(),
    });

    this.eventBus.emit('material:changed', { entityId: entity.id, materialId: material_id });
  }

  async play_animation(
    entity_id: EntityId,
    animation_name: string,
    loop = false
  ): Promise<void> {
    if (!this.checkPermission('play_animation')) {
      throw this.createError('Permission denied: cannot play animation', 'PERMISSION_DENIED');
    }

    const entity = this.getEntityRecord(entity_id);
    const oldAnim = entity.components.get('Animation');
    const oldAnimData = isRecord(oldAnim) ? oldAnim : {};

    entity.components.set('Animation', {
      ...oldAnimData,
      currentAnimation: animation_name,
      playing: true,
      loop,
    });

    this.eventBus.emit('animation:played', {
      entityId: entity.id,
      animation: animation_name,
      loop,
    });
  }

  async stop_animation(entity_id: EntityId): Promise<void> {
    if (!this.checkPermission('stop_animation')) {
      throw this.createError('Permission denied: cannot stop animation', 'PERMISSION_DENIED');
    }

    const entity = this.getEntityRecord(entity_id);
    const anim = entity.components.get('Animation');
    if (isRecord(anim)) {
      entity.components.set('Animation', {
        ...anim,
        playing: false,
      });
    }

    this.eventBus.emit('animation:stopped', { entityId: entity.id });
  }

  async set_anim_parameter(
    entity_id: EntityId,
    name: string,
    value: string | number | boolean
  ): Promise<void> {
    if (!this.checkPermission('set_anim_parameter')) {
      throw this.createError('Permission denied: cannot set animation parameter', 'PERMISSION_DENIED');
    }

    const entity = this.getEntityRecord(entity_id);
    const anim = entity.components.get('Animation');
    const animData = isRecord(anim) ? anim : {};
    const parameters = isRecord(animData.parameters) ? animData.parameters : {};

    entity.components.set('Animation', {
      ...animData,
      parameters: {
        ...parameters,
        [name]: value,
      },
    });

    this.eventBus.emit('animation:parameter_set', {
      entityId: entity.id,
      name,
      value,
    });
  }

  async spawn_particle(
    effect_name: string,
    position: Vector3,
    parent_entity?: EntityId
  ): Promise<ParticleId> {
    if (!this.checkPermission('spawn_particle')) {
      throw this.createError('Permission denied: cannot spawn particle', 'PERMISSION_DENIED');
    }

    const particleId = generateId('particle');

    this.eventBus.emit('particle:spawned', {
      particleId,
      effectName: effect_name,
      position,
      parentEntity: parent_entity,
    });

    return particleId;
  }

  async stop_particle(effect_id: ParticleId): Promise<void> {
    if (!this.checkPermission('stop_particle')) {
      throw this.createError('Permission denied: cannot stop particle', 'PERMISSION_DENIED');
    }

    this.eventBus.emit('particle:stopped', { particleId: effect_id });
  }

  async attach_script(
    entity_id: EntityId,
    script_language: string,
    script_path: string
  ): Promise<void> {
    if (!this.checkPermission('attach_script')) {
      throw this.createError('Permission denied: cannot attach script', 'PERMISSION_DENIED');
    }

    const entity = this.getEntityRecord(entity_id);
    const currentScripts = entity.components.get('Script');
    const scriptList = Array.isArray(currentScripts) ? currentScripts : [];

    entity.components.set('Script', [
      ...scriptList,
      { language: script_language, path: script_path },
    ]);

    this.eventBus.emit('script:attached', {
      entityId: entity.id,
      language: script_language,
      path: script_path,
    });
  }

  async set_property(entity_id: EntityId, property_path: string, value: unknown): Promise<void> {
    if (!this.checkPermission('set_property')) {
      throw this.createError('Permission denied: cannot set property', 'PERMISSION_DENIED');
    }

    const entity = this.getEntityRecord(entity_id);
    const parts = property_path.split('.');
    const componentType = parts[0];
    const component = entity.components.get(componentType);
    const clonedComponent = isRecord(component) ? this.cloneValue(component) : {};

    let current: Record<string, unknown> = clonedComponent;
    for (let i = 1; i < parts.length - 1; i++) {
      if (!isRecord(current[parts[i]])) {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }

    const leaf = parts[parts.length - 1];
    const oldValue = current[leaf];
    current[leaf] = value;

    entity.components.set(componentType, this.normalizeComponentValue(componentType, clonedComponent));

    this.logChange({
      change_id: generateId('change'),
      action_id: '',
      change_type: 'update',
      target_type: 'property',
      target_id: String(entity.id),
      property_path,
      old_value: oldValue,
      new_value: value,
      timestamp: Date.now(),
    });

    this.eventBus.emit('property:changed', {
      entityId: entity.id,
      propertyPath: property_path,
      value,
    });
  }

  get_property(entity_id: EntityId, property_path: string): unknown {
    const entity = this.ecs.getEntity(this.toNumericEntityId(entity_id));
    if (!entity) return undefined;

    const parts = property_path.split('.');
    let current: unknown = entity.components.get(parts[0]);

    for (let i = 1; i < parts.length; i++) {
      if (!isRecord(current)) {
        return undefined;
      }
      current = current[parts[i]];
    }

    return current;
  }

  find_entity_by_name(name: string): EntityId | null {
    const entity = this.ecs.queryEntities([]).find((record) => record.name === name);
    return entity?.id ?? null;
  }

  find_entities_by_tag(tag: string): EntityId[] {
    return this.ecs
      .queryEntities([])
      .filter((entity) => {
        const tagComponent = entity.components.get('Tag');

        if (tagComponent instanceof Set) {
          return tagComponent.has(tag);
        }

        if (isRecord(tagComponent) && Array.isArray(tagComponent.tags)) {
          return tagComponent.tags.includes(tag);
        }

        if (isRecord(tagComponent) && tagComponent.tags instanceof Set) {
          return tagComponent.tags.has(tag);
        }

        return false;
      })
      .map((entity) => entity.id);
  }

  find_entities_by_component(component_type: ComponentType): EntityId[] {
    return this.ecs.queryEntities([component_type]).map((entity) => entity.id);
  }

  log_info(message: string): void {
    console.log(`[INFO] ${message}`);
    this.eventBus.emit('log:info', { message, timestamp: Date.now() });
  }

  log_warning(message: string): void {
    console.warn(`[WARNING] ${message}`);
    this.eventBus.emit('log:warning', { message, timestamp: Date.now() });
  }

  log_error(message: string): void {
    console.error(`[ERROR] ${message}`);
    this.eventBus.emit('log:error', { message, timestamp: Date.now() });
  }

  begin_transaction(label: string): TransactionId {
    const transactionId = generateId('tx');
    const snapshotId = this.save_scene_snapshot();

    this.transactions.set(transactionId, {
      id: transactionId,
      label,
      started_at: new Date(),
      status: 'active',
      actions: [],
      snapshot_id: snapshotId,
    });

    this.currentTransaction = transactionId;
    this.eventBus.emit('transaction:started', { transactionId, label });
    return transactionId;
  }

  async commit_transaction(): Promise<void> {
    if (!this.currentTransaction) {
      throw this.createError('No active transaction to commit', 'NO_ACTIVE_TRANSACTION');
    }

    const transaction = this.transactions.get(this.currentTransaction);
    if (!transaction) {
      throw this.createError('Transaction not found', 'TRANSACTION_NOT_FOUND');
    }

    transaction.status = 'committed';
    transaction.completed_at = new Date();

    this.eventBus.emit('transaction:committed', { transactionId: transaction.id });
    this.currentTransaction = null;
  }

  async rollback_transaction(): Promise<void> {
    if (!this.currentTransaction) {
      throw this.createError('No active transaction to rollback', 'NO_ACTIVE_TRANSACTION');
    }

    const transaction = this.transactions.get(this.currentTransaction);
    if (!transaction) {
      throw this.createError('Transaction not found', 'TRANSACTION_NOT_FOUND');
    }

    await this.restore_scene_snapshot(transaction.snapshot_id);
    transaction.status = 'rolled_back';
    transaction.completed_at = new Date();

    this.eventBus.emit('transaction:rolled_back', { transactionId: transaction.id });
    this.currentTransaction = null;
  }

  validate_scene(): ValidationResult {
    const warnings: ValidationWarning[] = [];

    for (const entity of this.ecs.queryEntities([])) {
      if (!entity.components.has('Transform')) {
        warnings.push({
          code: 'MISSING_TRANSFORM',
          message: `Entity "${entity.name}" is missing Transform component`,
          suggestion: 'Add a Transform component to this entity',
        });
      }
    }

    return {
      valid: true,
      errors: [],
      warnings,
      can_proceed: true,
    };
  }

  save_scene_snapshot(): SnapshotId {
    const snapshotId = generateId('snapshot');
    const entityStates = new Map<EntityId, EntityState>();

    for (const entity of this.ecs.queryEntities([])) {
      entityStates.set(entity.id, this.entityStateFromRecord(entity));
    }

    const snapshot: UndoSnapshot = {
      id: snapshotId,
      timestamp: new Date(),
      action_id: '',
      entity_states: entityStates,
      created_entities: [],
      deleted_entities: [],
      modified_properties: [],
    };

    this.snapshots.set(snapshotId, snapshot);
    this.eventBus.emit('snapshot:saved', { snapshotId });
    return snapshotId;
  }

  async restore_scene_snapshot(snapshot_id: SnapshotId): Promise<void> {
    const snapshot = this.snapshots.get(snapshot_id);
    if (!snapshot) {
      throw this.createError(`Snapshot not found: ${snapshot_id}`, 'SNAPSHOT_NOT_FOUND');
    }

    for (const entity of this.ecs.getAllEntities()) {
      this.ecs.destroyEntity(entity);
    }

    for (const [, state] of snapshot.entity_states) {
      const numericId = this.toNumericEntityId(state.entity_id);
      this.ecs.createEntity(state.name, numericId);
      const entity = this.getEntityRecord(numericId);

      for (const component of state.components) {
        entity.components.set(
          component.type,
          this.normalizeComponentValue(component.type, component.data)
        );
      }

      if (!entity.components.has('Transform')) {
        entity.components.set('Transform', this.buildTransformComponent(state.transform));
      }
    }

    this.eventBus.emit('snapshot:restored', { snapshotId: snapshot_id });
  }

  getChangeLog(): SceneChange[] {
    return [...this.changeLog];
  }

  clearChangeLog(): void {
    this.changeLog = [];
  }

  getSnapshots(): SnapshotId[] {
    return Array.from(this.snapshots.keys());
  }
}

let apiInstance: EngineAutomationAPI | null = null;

export function createEngineAutomationAPI(ecs: ECS, eventBus: EventBus): EngineAutomationAPI {
  if (!apiInstance) {
    apiInstance = new EngineAutomationAPI(ecs, eventBus);
  }
  return apiInstance;
}

export function getEngineAutomationAPI(): EngineAutomationAPI | null {
  return apiInstance;
}
