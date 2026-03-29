/**
 * Multi-Script System - Types
 * 
 * Shared types for the entire scripting system
 */

// ============================================
// CORE IDs
// ============================================

export type EntityId = string | number;
export type AssetId = string;
export type ParticleId = string;
export type TransactionId = string;
export type SnapshotId = string;
export type ActionId = string;
export type ActionGraphId = string;

// ============================================
// MATH TYPES
// ============================================

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Euler {
  x: number;
  y: number;
  z: number;
  order?: 'XYZ' | 'XZY' | 'YXZ' | 'YZX' | 'ZXY' | 'ZYX';
}

export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface TransformData {
  position: Vector3;
  rotation: Quaternion | Euler;
  scale: Vector3;
}

// ============================================
// SCRIPT LANGUAGE TYPES
// ============================================

export type ScriptLanguage = 
  | 'lua' 
  | 'python' 
  | 'mruby' 
  | 'typescript' 
  | 'csharp';

export type ScriptSource = 'ai' | 'manual' | 'script' | 'editor';

export interface ScriptRef {
  language: ScriptLanguage;
  path: string;
  compiled?: boolean;
  source?: string;
}

// ============================================
// COMPONENT TYPES
// ============================================

export type ComponentType =
  | 'Transform'
  | 'MeshRenderer'
  | 'Camera'
  | 'Light'
  | 'RigidBody'
  | 'Collider'
  | 'AudioSource'
  | 'ParticleEmitter'
  | 'Script'
  | 'Animation'
  | 'Tag';

export interface ComponentConfig {
  type: string;
  data: Record<string, unknown>;
}

// ============================================
// SECURITY TYPES
// ============================================

export type SecurityLevel =
  | 'safe_scene_only'
  | 'editor_only'
  | 'asset_pipeline'
  | 'restricted_filesystem'
  | 'admin';

export interface SecurityConfig {
  level: SecurityLevel;
  allowed_operations: OperationType[];
  filesystem_access: boolean | 'restricted' | 'full';
  network_access: boolean;
  max_execution_time_ms: number;
  max_memory_mb: number;
}

export const SECURITY_LEVELS: Record<SecurityLevel, SecurityConfig> = {
  safe_scene_only: {
    level: 'safe_scene_only',
    allowed_operations: [
      'spawn_character',
      'destroy_entity',
      'duplicate_entity',
      'add_component',
      'remove_component',
      'set_transform',
      'play_animation',
      'stop_animation',
      'spawn_particle',
      'stop_particle',
      'set_property',
      'get_property',
      'find_entity_by_name',
      'find_entities_by_tag',
    ],
    filesystem_access: false,
    network_access: false,
    max_execution_time_ms: 5000,
    max_memory_mb: 50,
  },
  editor_only: {
    level: 'editor_only',
    allowed_operations: [
      'spawn_character',
      'destroy_entity',
      'duplicate_entity',
      'add_component',
      'remove_component',
      'set_transform',
      'load_asset',
      'instantiate_prefab',
      'set_material',
      'play_animation',
      'stop_animation',
      'spawn_particle',
      'stop_particle',
      'attach_script',
      'set_property',
      'get_property',
    ],
    filesystem_access: false,
    network_access: false,
    max_execution_time_ms: 30000,
    max_memory_mb: 200,
  },
  asset_pipeline: {
    level: 'asset_pipeline',
    allowed_operations: [
      'load_asset',
      'instantiate_prefab',
      'set_material',
      'batch_operation',
      'import_asset',
      'export_asset',
    ],
    filesystem_access: 'restricted',
    network_access: false,
    max_execution_time_ms: 120000,
    max_memory_mb: 500,
  },
  restricted_filesystem: {
    level: 'restricted_filesystem',
    allowed_operations: [
      'spawn_character',
      'destroy_entity',
      'load_asset',
      'save_asset',
      'read_file',
      'write_file',
    ],
    filesystem_access: 'restricted',
    network_access: false,
    max_execution_time_ms: 60000,
    max_memory_mb: 300,
  },
  admin: {
    level: 'admin',
    allowed_operations: ['*'],
    filesystem_access: 'full',
    network_access: true,
    max_execution_time_ms: 300000,
    max_memory_mb: 1024,
  },
};

// ============================================
// OPERATION TYPES
// ============================================

export type OperationType =
  | 'spawn_character'
  | 'destroy_entity'
  | 'duplicate_entity'
  | 'add_component'
  | 'remove_component'
  | 'set_transform'
  | 'get_transform'
  | 'load_asset'
  | 'instantiate_prefab'
  | 'set_material'
  | 'play_animation'
  | 'stop_animation'
  | 'set_anim_parameter'
  | 'spawn_particle'
  | 'stop_particle'
  | 'attach_script'
  | 'detach_script'
  | 'set_property'
  | 'get_property'
  | 'find_entity_by_name'
  | 'find_entities_by_tag'
  | 'find_entities_by_component'
  | 'begin_transaction'
  | 'commit_transaction'
  | 'rollback_transaction'
  | 'validate_scene'
  | 'save_scene_snapshot'
  | 'restore_scene_snapshot'
  | 'batch_operation'
  | 'import_asset'
  | 'export_asset'
  | 'save_asset'
  | 'read_file'
  | 'write_file'
  | 'log_info'
  | 'log_warning'
  | 'log_error'
  | '*';

// ============================================
// INTENT TYPES (AI Command Layer)
// ============================================

export type IntentType =
  | 'create'
  | 'edit'
  | 'repair'
  | 'replace'
  | 'move'
  | 'animate'
  | 'delete'
  | 'generate'
  | 'query'
  | 'batch'
  | 'convert'
  | 'validate'
  | 'rollback';

export interface ParsedIntent {
  intent: IntentType;
  entities: ParsedEntity[];
  operations: ParsedOperation[];
  confidence: number;
  original_text: string;
}

export interface ParsedEntity {
  type: 'character' | 'asset' | 'component' | 'animation' | 'particle' | 'property';
  value: string;
  position?: Vector3 | string;
  properties?: Record<string, unknown>;
}

export interface ParsedOperation {
  op: OperationType;
  target?: string;
  parameters: Record<string, unknown>;
}

// ============================================
// ACTION GRAPH TYPES
// ============================================

export interface ActionGraph {
  id: ActionGraphId;
  timestamp: number;
  source: ScriptSource;
  intent?: ParsedIntent;
  actions: SceneAction[];
  metadata: ActionGraphMetadata;
}

export interface ActionGraphMetadata {
  language?: ScriptLanguage;
  security_level: SecurityLevel;
  dry_run: boolean;
  auto_rollback: boolean;
  timeout_ms?: number;
}

export interface SceneAction {
  action_id: ActionId;
  operation: OperationType;
  target_type?: 'entity' | 'asset' | 'component' | 'scene' | 'particle';
  target_id?: EntityId;
  parameters: Record<string, unknown>;
  asset_refs?: string[];
  validation_rules?: ValidationRule[];
  undo_data?: UndoSnapshot;
  execution_language?: ScriptLanguage;
  security_level: SecurityLevel;
  dependencies?: ActionId[];
  condition?: string;
}

export interface ValidationRule {
  type: 'asset_exists' | 'entity_exists' | 'position_valid' | 'type_check' | 'custom';
  target?: string;
  value?: unknown;
  expression?: string;
  error_message?: string;
}

// ============================================
// EXECUTION TYPES
// ============================================

export type ExecutionStatus =
  | 'pending'
  | 'validating'
  | 'dry_run'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'timeout'
  | 'cancelled';

export interface ExecutionResult {
  action_id: ActionId;
  status: ExecutionStatus;
  error?: ExecutionError;
  duration_ms: number;
  changes: SceneChange[];
  rollback_available: boolean;
  output?: unknown;
}

export interface ExecutionError {
  message: string;
  code: string;
  stack?: string;
  line?: number;
  column?: number;
  language?: ScriptLanguage;
  recoverable: boolean;
  suggested_fix?: string;
}

export interface ExecutionContext {
  entity_id?: EntityId;
  action_id?: ActionId;
  transaction_id?: TransactionId;
  timeout_ms?: number;
  memory_limit_mb?: number;
  security_level?: SecurityLevel;
  dry_run?: boolean;
}

export interface SceneChange {
  change_id: string;
  action_id: ActionId;
  change_type: 'create' | 'update' | 'delete';
  target_type: 'entity' | 'component' | 'property';
  target_id: string;
  property_path?: string;
  old_value?: unknown;
  new_value?: unknown;
  timestamp: number;
}

// ============================================
// LOGGING TYPES
// ============================================

export interface ExecutionLog {
  id: string;
  timestamp: Date;
  source: ScriptSource;
  language?: ScriptLanguage;
  action_graph_id: ActionGraphId;
  actions: ActionLog[];
  result: ExecutionStatus;
  duration_total_ms: number;
  rollback_performed: boolean;
  user_id?: string;
  ai_session_id?: string;
}

export interface ActionLog {
  action_id: ActionId;
  operation: OperationType;
  target_id?: EntityId;
  parameters: Record<string, unknown>;
  status: ExecutionStatus;
  error?: ExecutionError;
  duration_ms: number;
  undo_snapshot_id?: string;
  changes_made: SceneChange[];
  script_generated?: string;
  backend_used?: ScriptLanguage;
}

// ============================================
// ROLLBACK TYPES
// ============================================

export interface UndoSnapshot {
  id: SnapshotId;
  timestamp: Date;
  action_id: ActionId;
  transaction_id?: TransactionId;
  entity_states: Map<EntityId, EntityState>;
  created_entities: EntityId[];
  deleted_entities: EntityId[];
  modified_properties: PropertyChange[];
}

export interface EntityState {
  entity_id: EntityId;
  name: string;
  components: ComponentConfig[];
  transform: TransformData;
  parent_id?: EntityId;
  children: EntityId[];
  tags: string[];
  active: boolean;
}

export interface PropertyChange {
  entity_id: EntityId;
  component_type: ComponentType;
  property_path: string;
  old_value: unknown;
  new_value: unknown;
}

export interface SnapshotInfo {
  id: SnapshotId;
  timestamp: Date;
  label?: string;
  action_count: number;
  can_restore: boolean;
}

// ============================================
// TRANSACTION TYPES
// ============================================

export interface Transaction {
  id: TransactionId;
  label: string;
  started_at: Date;
  completed_at?: Date;
  status: 'active' | 'committed' | 'rolled_back';
  actions: ActionId[];
  snapshot_id: SnapshotId;
}

// ============================================
// VALIDATION TYPES
// ============================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  can_proceed: boolean;
}

export interface ValidationError {
  code: string;
  message: string;
  action_id?: ActionId;
  target?: string;
  severity: 'critical' | 'error' | 'warning';
}

export interface ValidationWarning {
  code: string;
  message: string;
  action_id?: ActionId;
  suggestion?: string;
}

// ============================================
// BACKEND SELECTION TYPES
// ============================================

export type TaskCategory =
  | 'gameplay_runtime'
  | 'quick_action'
  | 'automation'
  | 'pipeline'
  | 'tool'
  | 'batch_operation'
  | 'correction'
  | 'typed_authoring'
  | 'advanced_tooling'
  | 'validation'
  | 'refactoring';

export interface BackendSelection {
  language: ScriptLanguage;
  reason: string;
  confidence: number;
  alternatives: Array<{
    language: ScriptLanguage;
    reason: string;
  }>;
}

export const BACKEND_SELECTION_RULES: Record<TaskCategory, ScriptLanguage> = {
  gameplay_runtime: 'lua',
  quick_action: 'lua',
  automation: 'python',
  pipeline: 'python',
  tool: 'python',
  batch_operation: 'python',
  correction: 'mruby',
  typed_authoring: 'typescript',
  advanced_tooling: 'csharp',
  validation: 'typescript',
  refactoring: 'csharp',
};
