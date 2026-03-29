# Sistema Multi-Script

## Visión General

El Sistema Multi-Script es una capa unificada de automatización donde el asistente puede recibir órdenes en lenguaje natural y ejecutarlas de forma segura dentro del motor de videojuegos. Soporta múltiples lenguajes de scripting (Lua, Python, mruby, TypeScript, C#) a través de una API unificada con control de seguridad, validación, logging y rollback.

---

## Arquitectura en Capas

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI COMMAND LAYER                              │
│  - Natural Language Parser                                       │
│  - Intent Detection                                              │
│  - Entity/Resource Resolution                                    │
│  - Action Planning                                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               INTERMEDIATE REPRESENTATION                        │
│  - Action Graph (JSON/AST neutral)                              │
│  - Operation Types: create, edit, repair, move, animate...      │
│  - Validation Rules & Undo Data                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SCRIPT ORCHESTRATOR                            │
│  - Backend Selection                                            │
│  - Execution Queue                                              │
│  - Error Handling & Rollback                                    │
│  - Audit Logging                                                │
│  - Dry-Run Support                                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ENGINE AUTOMATION API                           │
│  - Unified, Safe, Controlled API                                │
│  - Entity CRUD                                                  │
│  - Transform Operations                                         │
│  - Asset Management                                             │
│  - Animation & Particles                                        │
│  - Transaction Support                                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ LUA ADAPTER   │ │ PYTHON ADAPTER│ │ MRUBY ADAPTER │
│ - Gameplay    │ │ - Tools       │ │ - Automation  │
│ - Quick Ops   │ │ - Pipelines   │ │ - Corrections │
└───────────────┘ └───────────────┘ └───────────────┘
            │               │               │
            ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐
│ TS ADAPTER    │ │ C# ADAPTER    │
│ - Typed Auth  │ │ - Tooling     │
│ - Compile JS  │ │ - Validation  │
└───────────────┘ └───────────────┘
```

---

## Capa 1: AI Command Layer

### Responsabilidades
- Recibir órdenes en lenguaje natural
- Detectar intención del usuario
- Identificar entidades y recursos mencionados
- Generar plan de acciones estructurado

### Tipos de Intención Soportados
```typescript
type IntentType =
  | 'create'      // Crear entidades/prefabs
  | 'edit'        // Modificar propiedades
  | 'repair'      // Corregir errores
  | 'replace'     // Reemplazar assets/componentes
  | 'move'        // Cambiar posición/rotación/escala
  | 'animate'     // Aplicar animaciones
  | 'delete'      // Eliminar entidades
  | 'generate'    // Crear variantes/procedural
  | 'query'       // Buscar/consultar
  | 'batch'       // Operaciones por lote
  | 'convert'     // Traducir a otro lenguaje
```

### Ejemplo de Parsing
```
Input: "crea un guerrero en el centro con animación idle"

Output:
{
  "intent": "create",
  "entities": [
    {
      "type": "character",
      "archetype": "warrior",
      "position": "center",
      "components": ["animation"]
    }
  ],
  "operations": [
    { "op": "spawn_character", "archetype": "warrior", "position": [0,0,0] },
    { "op": "play_animation", "name": "idle" }
  ]
}
```

---

## Capa 2: Intermediate Representation (Action Graph)

### Estructura del Action Graph
```typescript
interface ActionGraph {
  id: string;
  timestamp: number;
  source: 'ai' | 'manual' | 'script';
  actions: SceneAction[];
  metadata: {
    language?: ScriptLanguage;
    security_level: SecurityLevel;
    dry_run: boolean;
  };
}

interface SceneAction {
  action_id: string;
  operation: OperationType;
  target_type?: 'entity' | 'asset' | 'component' | 'scene';
  target_id?: string;
  parameters: Record<string, any>;
  asset_refs?: string[];
  validation_rules?: ValidationRule[];
  undo_data?: UndoSnapshot;
  execution_language?: ScriptLanguage;
  security_level: SecurityLevel;
  dependencies?: string[]; // IDs de acciones previas requeridas
}

type OperationType =
  | 'spawn_character'
  | 'destroy_entity'
  | 'duplicate_entity'
  | 'add_component'
  | 'remove_component'
  | 'set_transform'
  | 'load_asset'
  | 'instantiate_prefab'
  | 'set_material'
  | 'play_animation'
  | 'stop_animation'
  | 'spawn_particle'
  | 'attach_script'
  | 'set_property'
  | 'begin_transaction'
  | 'commit_transaction'
  | 'rollback_transaction';

type SecurityLevel =
  | 'safe_scene_only'
  | 'editor_only'
  | 'asset_pipeline'
  | 'restricted_filesystem'
  | 'admin';
```

### Ejemplo de Action Graph Completo
```json
{
  "id": "ag_001",
  "timestamp": 1699876543210,
  "source": "ai",
  "actions": [
    {
      "action_id": "act_001",
      "operation": "spawn_character",
      "target_type": "entity",
      "parameters": {
        "archetype": "warrior",
        "position": [0, 0, 0],
        "rotation": [0, 0, 0],
        "scale": [1, 1, 1]
      },
      "validation_rules": [
        { "type": "asset_exists", "asset": "warrior" },
        { "type": "position_valid", "value": [0, 0, 0] }
      ],
      "execution_language": "lua",
      "security_level": "safe_scene_only"
    },
    {
      "action_id": "act_002",
      "operation": "play_animation",
      "target_type": "entity",
      "parameters": {
        "animation": "idle",
        "loop": true
      },
      "dependencies": ["act_001"],
      "execution_language": "lua",
      "security_level": "safe_scene_only"
    }
  ],
  "metadata": {
    "language": "lua",
    "security_level": "safe_scene_only",
    "dry_run": false
  }
}
```

---

## Capa 3: Script Orchestrator

### Responsabilidades
- Recibir Action Graph
- Seleccionar backend óptimo
- Encolar y ejecutar acciones
- Manejar errores y rollback
- Mantener logs de auditoría
- Soportar dry-run

### Reglas de Selección de Backend
```typescript
interface BackendSelectionRules {
  // Gameplay runtime o acción inmediata → Lua
  gameplay: 'lua';
  
  // Herramientas, automatización, editor, lotes → Python
  automation: 'python';
  
  // Correcciones, scripts embebidos adicionales → mruby
  correction: 'mruby';
  
  // Autoría con tipos, API documentada → TypeScript
  typed_authoring: 'typescript';
  
  // Análisis fuerte, tooling, ecosistema .NET → C#
  advanced_tooling: 'csharp';
}
```

### Estados de Ejecución
```typescript
type ExecutionStatus =
  | 'pending'
  | 'validating'
  | 'dry_run'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rolled_back';

interface ExecutionResult {
  action_id: string;
  status: ExecutionStatus;
  error?: ExecutionError;
  duration_ms: number;
  changes: SceneChange[];
  rollback_available: boolean;
}
```

---

## Capa 4: Engine Automation API

### Contrato de la API

```typescript
interface EngineAutomationAPI {
  // === ENTITY MANAGEMENT ===
  create_entity(name: string, archetype?: string): Promise<EntityId>;
  destroy_entity(entity_id: EntityId): Promise<void>;
  duplicate_entity(entity_id: EntityId): Promise<EntityId>;
  
  // === COMPONENT MANAGEMENT ===
  add_component(entity_id: EntityId, component_type: ComponentType, config?: any): Promise<void>;
  remove_component(entity_id: EntityId, component_type: ComponentType): Promise<void>;
  has_component(entity_id: EntityId, component_type: ComponentType): boolean;
  
  // === TRANSFORM ===
  set_transform(entity_id: EntityId, transform: TransformData): Promise<void>;
  get_transform(entity_id: EntityId): TransformData;
  set_position(entity_id: EntityId, position: Vector3): Promise<void>;
  set_rotation(entity_id: EntityId, rotation: Quaternion | Euler): Promise<void>;
  set_scale(entity_id: EntityId, scale: Vector3): Promise<void>;
  
  // === ASSETS ===
  load_asset(path_or_guid: string): Promise<AssetId>;
  instantiate_prefab(prefab_id: string, position?: Vector3): Promise<EntityId>;
  set_material(entity_id: EntityId, material_id: string): Promise<void>;
  
  // === ANIMATION ===
  play_animation(entity_id: EntityId, animation_name: string, loop?: boolean): Promise<void>;
  stop_animation(entity_id: EntityId): Promise<void>;
  set_anim_parameter(entity_id: EntityId, name: string, value: any): Promise<void>;
  
  // === PARTICLES ===
  spawn_particle(effect_name: string, position: Vector3, parent_entity?: EntityId): Promise<ParticleId>;
  stop_particle(effect_id: ParticleId): Promise<void>;
  
  // === SCRIPTING ===
  attach_script(entity_id: EntityId, script_ref: ScriptRef): Promise<void>;
  detach_script(entity_id: EntityId, script_ref: ScriptRef): Promise<void>;
  
  // === PROPERTIES ===
  set_property(entity_id: EntityId, property_path: string, value: any): Promise<void>;
  get_property(entity_id: EntityId, property_path: string): any;
  
  // === QUERY ===
  find_entity_by_name(name: string): EntityId | null;
  find_entities_by_tag(tag: string): EntityId[];
  find_entities_by_component(component_type: ComponentType): EntityId[];
  
  // === LOGGING ===
  log_info(message: string): void;
  log_warning(message: string): void;
  log_error(message: string): void;
  
  // === TRANSACTIONS ===
  begin_transaction(label: string): TransactionId;
  commit_transaction(): Promise<void>;
  rollback_transaction(): Promise<void>;
  
  // === VALIDATION & SNAPSHOTS ===
  validate_scene(): ValidationResult;
  save_scene_snapshot(): SnapshotId;
  restore_scene_snapshot(snapshot_id: SnapshotId): Promise<void>;
}

// === TYPES ===
type EntityId = string;
type AssetId = string;
type ParticleId = string;
type TransactionId = string;
type SnapshotId = string;

interface Vector3 { x: number; y: number; z: number; }
interface Quaternion { x: number; y: number; z: number; w: number; }
interface Euler { x: number; y: number; z: number; }

interface TransformData {
  position: Vector3;
  rotation: Quaternion | Euler;
  scale: Vector3;
}

type ComponentType =
  | 'Transform'
  | 'MeshRenderer'
  | 'Camera'
  | 'Light'
  | 'RigidBody'
  | 'Collider'
  | 'AudioSource'
  | 'ParticleEmitter'
  | 'Script'
  | 'Animation';

interface ScriptRef {
  language: ScriptLanguage;
  path: string;
  compiled?: boolean;
}

type ScriptLanguage = 'lua' | 'python' | 'mruby' | 'typescript' | 'csharp';
```

---

## Capa 5: Language Adapters

### Interfaz Común del Adapter
```typescript
interface LanguageAdapter {
  readonly language: ScriptLanguage;
  readonly runtime: any;
  
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  
  // Execution
  execute_script(source: string, context: ExecutionContext): Promise<ExecutionResult>;
  execute_file(path: string, context: ExecutionContext): Promise<ExecutionResult>;
  
  // API Binding
  bind_api(api: EngineAutomationAPI): void;
  
  // Sandbox
  set_security_level(level: SecurityLevel): void;
  get_allowed_functions(): string[];
  
  // Introspection
  is_ready(): boolean;
  get_version(): string;
}

interface ExecutionContext {
  entity_id?: EntityId;
  action_id?: string;
  transaction_id?: string;
  timeout_ms?: number;
  memory_limit_mb?: number;
}
```

### A. Lua Adapter
```typescript
// Uso ideal: Gameplay runtime, acciones rápidas en escena
class LuaAdapter implements LanguageAdapter {
  readonly language = 'lua';
  
  // Características:
  // - Runtime embebido ligero (fengari o wasmoon)
  // - Exposición de Engine Automation API
  // - Sandbox configurable
  // - Hot reload support
  // - Coroutines para operaciones async
}
```

### B. Python Adapter
```typescript
// Uso ideal: Herramientas editor, automatización, pipelines
class PythonAdapter implements LanguageAdapter {
  readonly language = 'python';
  
  // Características:
  // - Pyodide o microPython embebido
  // - Acceso a bibliotecas de procesamiento
  // - Validación de assets
  // - Operaciones por lote
}
```

### C. mruby Adapter
```typescript
// Uso ideal: Correcciones, scripts embebidos
class MrubyAdapter implements LanguageAdapter {
  readonly language = 'mruby';
  
  // Características:
  // - Ruby embebido compilado a bytecode
  // - Scripts cortos de automatización
  // - Refactors de contenido
}
```

### D. TypeScript Adapter
```typescript
// Uso ideal: Autoría con tipado, validación
class TypeScriptAdapter implements LanguageAdapter {
  readonly language = 'typescript';
  
  // Características:
  // - Compilación TS → JS
  // - Generación de tipos/stubs para API
  // - Validación en tiempo de compilación
  // - Mejor DX para desarrolladores
}
```

### E. C# Adapter
```typescript
// Uso ideal: Tooling avanzado, validación semántica
class CSharpAdapter implements LanguageAdapter {
  readonly language = 'csharp';
  
  // Características:
  // - Integración con ecosistema .NET
  // - Analizadores y refactor tools
  // - Validación estática avanzada
  // - Reglas de editor complejas
}
```

---

## Sistema de Seguridad

### Niveles de Permiso
```typescript
const SECURITY_LEVELS = {
  safe_scene_only: {
    allowed_operations: ['entity_crud', 'transform', 'animation', 'particles'],
    filesystem_access: false,
    network_access: false,
    max_execution_time_ms: 5000,
    max_memory_mb: 50
  },
  editor_only: {
    allowed_operations: ['scene_only', 'prefab_management', 'material_editing'],
    filesystem_access: false,
    network_access: false,
    max_execution_time_ms: 30000,
    max_memory_mb: 200
  },
  asset_pipeline: {
    allowed_operations: ['asset_import', 'asset_export', 'batch_processing'],
    filesystem_access: 'restricted',
    network_access: false,
    max_execution_time_ms: 120000,
    max_memory_mb: 500
  },
  restricted_filesystem: {
    allowed_operations: ['all_scene', 'file_read', 'file_write_limited'],
    filesystem_access: 'restricted',
    network_access: false,
    max_execution_time_ms: 60000,
    max_memory_mb: 300
  },
  admin: {
    allowed_operations: ['all'],
    filesystem_access: 'full',
    network_access: true,
    max_execution_time_ms: 300000,
    max_memory_mb: 1024
  }
};
```

### Sandbox por Lenguaje
- **Lua**: Tabla de entorno restringida, solo funciones expuestas explícitamente
- **Python**: Restricted Python o Pyodide con módulos limitados
- **mruby**: Compile-time exclusion de módulos peligrosos
- **TypeScript**: Runtime JS sandboxed (VM2 o similar)
- **C#**: AppDomain con permisos restrictivos

---

## Sistema de Logging y Rollback

### Estructura de Log
```typescript
interface ExecutionLog {
  id: string;
  timestamp: Date;
  source: 'ai' | 'manual' | 'script';
  language: ScriptLanguage;
  action_graph_id: string;
  actions: ActionLog[];
  result: ExecutionStatus;
  duration_total_ms: number;
  rollback_performed: boolean;
  user_id?: string;
}

interface ActionLog {
  action_id: string;
  operation: OperationType;
  target_id?: string;
  parameters: Record<string, any>;
  status: ExecutionStatus;
  error?: {
    message: string;
    stack?: string;
    line?: number;
    column?: number;
  };
  duration_ms: number;
  undo_snapshot?: UndoSnapshot;
  changes_made: SceneChange[];
}
```

### Undo/Rollback System
```typescript
interface UndoSnapshot {
  id: string;
  timestamp: Date;
  action_id: string;
  entity_states: Map<EntityId, EntityState>;
  created_entities: EntityId[];
  modified_properties: PropertyChange[];
}

interface RollbackManager {
  create_snapshot(): SnapshotId;
  restore_snapshot(id: SnapshotId): Promise<void>;
  get_snapshot_history(): SnapshotInfo[];
  clear_history(): void;
}
```

---

## Flujo Completo de Ejecución

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Usuario/IA envía orden en lenguaje natural                   │
│    "crea un guerrero en el centro con animación idle"           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. AI Command Layer parsea la intención                         │
│    - Intent: create                                             │
│    - Archetype: warrior                                         │
│    - Position: center (0,0,0)                                   │
│    - Animation: idle                                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Se genera Action Graph neutral                               │
│    { operation: "spawn_character", ... }                        │
│    { operation: "play_animation", ... }                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Validator revisa permisos, assets, riesgos                   │
│    - Asset 'warrior' existe: ✓                                  │
│    - Security level: safe_scene_only                            │
│    - No filesystem access needed                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Script Orchestrator selecciona backend                       │
│    - Task: gameplay runtime action                              │
│    - Selected: Lua (mejor para acciones rápidas en escena)      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Lua Adapter traduce a código ejecutable                      │
│    local entity = engine.create_entity("warrior")               │
│    engine.set_position(entity, 0, 0, 0)                         │
│    engine.play_animation(entity, "idle", true)                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Engine Automation API ejecuta las acciones                   │
│    - begin_transaction()                                        │
│    - create_entity() → entity_001                               │
│    - set_transform()                                            │
│    - play_animation()                                           │
│    - commit_transaction()                                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Logging y persistencia                                       │
│    - ExecutionLog guardado                                      │
│    - UndoSnapshot creado                                        │
│    - Audit trail registrado                                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. Resultado devuelto                                           │
│    { status: "completed", entity_id: "entity_001" }             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Requisitos de UX del Editor

### Paneles Requeridos
1. **AI Command Panel** - Input de órdenes en lenguaje natural
2. **Script Console** - Editor de scripts con syntax highlighting
3. **Execution Trace** - Log detallado de ejecución
4. **Scene Diff** - Visualización de cambios antes/después
5. **Rollback History** - Historial de snapshots recuperables

### Controles
- Selector de lenguaje
- Botón Run
- Botón Dry Run
- Botón Validate
- Botón Rollback
- Botón Apply Suggested Fix

---

## Plan de Implementación por Fases

### FASE 1: Fundamentos
- [x] Engine Automation API mínima
- [ ] Action Graph básico
- [ ] Script Orchestrator básico
- [ ] Lua Adapter funcional
- [ ] Consola Run
- [ ] Operaciones: create_entity, move_entity, simple_animation, simple_particle
- [ ] Logging y rollback básico

### FASE 2: Python y Validación
- [ ] Python Adapter
- [ ] Validación de assets
- [ ] Automatización de editor
- [ ] Importación/corrección por lotes
- [ ] Diff visual

### FASE 3: mruby y TypeScript
- [ ] mruby Adapter
- [ ] TypeScript pipeline → JavaScript
- [ ] Generación de tipos/stubs
- [ ] Selección automática de backend

### FASE 4: C# y Tooling Avanzado
- [ ] C# Adapter
- [ ] Analizadores
- [ ] Refactorización asistida
- [ ] Validación semántica avanzada
- [ ] Autocorrección guiada por IA

---

## Estructura de Archivos

```
/src/lib/engine/scripting/
├── index.ts                      # Export principal
├── types.ts                      # Tipos compartidos
│
├── api/
│   ├── EngineAutomationAPI.ts    # API principal del motor
│   ├── EntityAPI.ts              # Operaciones de entidades
│   ├── TransformAPI.ts           # Operaciones de transform
│   ├── AssetAPI.ts               # Gestión de assets
│   ├── AnimationAPI.ts           # Sistema de animación
│   ├── ParticleAPI.ts            # Sistema de partículas
│   └── TransactionAPI.ts         # Sistema de transacciones
│
├── action-graph/
│   ├── ActionGraph.ts            # Representación intermedia
│   ├── ActionBuilder.ts          # Constructor de acciones
│   ├── ActionValidator.ts        # Validador de acciones
│   └── ActionExecutor.ts         # Ejecutor de acciones
│
├── orchestrator/
│   ├── ScriptOrchestrator.ts     # Orquestador central
│   ├── BackendSelector.ts        # Selector de backend
│   ├── ExecutionQueue.ts         # Cola de ejecución
│   └── ExecutionResult.ts        # Resultados de ejecución
│
├── adapters/
│   ├── LanguageAdapter.ts        # Interfaz base
│   ├── LuaAdapter.ts             # Adapter Lua
│   ├── PythonAdapter.ts          # Adapter Python
│   ├── MrubyAdapter.ts           # Adapter mruby
│   ├── TypeScriptAdapter.ts      # Adapter TypeScript
│   └── CSharpAdapter.ts          # Adapter C#
│
├── ai-command/
│   ├── AICommandLayer.ts         # Capa de comandos AI
│   ├── IntentParser.ts           # Parser de intención
│   ├── EntityResolver.ts         # Resolvedor de entidades
│   └── ActionPlanner.ts          # Planificador de acciones
│
├── security/
│   ├── SecurityManager.ts        # Manager de seguridad
│   ├── Sandbox.ts                # Sistema de sandbox
│   ├── PermissionManager.ts      # Manager de permisos
│   └── SecurityLevels.ts         # Niveles de seguridad
│
├── logging/
│   ├── ExecutionLogger.ts        # Logger de ejecución
│   ├── AuditTrail.ts             # Trail de auditoría
│   └── ConsoleOutput.ts          # Output de consola
│
└── rollback/
    ├── RollbackManager.ts        # Manager de rollback
    ├── UndoSnapshot.ts           # Snapshots de undo
    └── SceneHistory.ts           # Historial de escena
```

---

## Ejemplos de Uso

### Ejemplo 1: Crear Personaje
```typescript
// Input: "crea un mago en posición 5,0,3"

// Action Graph generado:
{
  "actions": [
    {
      "operation": "spawn_character",
      "parameters": {
        "archetype": "mage",
        "position": [5, 0, 3]
      },
      "execution_language": "lua"
    }
  ]
}

// Código Lua ejecutado:
local entity = engine.create_entity("Mage", "mage")
engine.set_position(entity, 5, 0, 3)
```

### Ejemplo 2: Animar y Añadir Partículas
```typescript
// Input: "agrega animación idle y partículas de fuego en la espada"

// Action Graph generado:
{
  "actions": [
    {
      "operation": "play_animation",
      "target_id": "${selected_entity}",
      "parameters": { "animation": "idle", "loop": true }
    },
    {
      "operation": "spawn_particle",
      "parameters": {
        "effect": "fire_sword",
        "position": "sword_socket"
      }
    }
  ]
}
```

### Ejemplo 3: Corrección por Lote
```typescript
// Input: "corrige todas las colisiones de enemigos"

// Action Graph generado:
{
  "actions": [
    {
      "operation": "batch_operation",
      "parameters": {
        "query": "find_entities_by_tag('enemy')",
        "operations": [
          { "op": "validate_collider" },
          { "op": "fix_collider_bounds" }
        ]
      },
      "execution_language": "python"
    }
  ]
}
```

---

## Consideraciones de Producción

1. **Performance**: Cacheo de scripts compilados, lazy loading de runtimes
2. **Testing**: Unit tests para cada adapter, integration tests para flujos completos
3. **Monitoring**: Métricas de ejecución, alertas de seguridad
4. **Documentation**: API docs auto-generados, ejemplos interactivos
5. **Extensibility**: Plugin system para nuevos adapters

---

## Notas de Implementación

- La IA nunca debe tocar internals del motor directamente
- Todo debe pasar por la Engine Automation API
- Los adapters son intercambiables y extensible
- El Action Graph es el contrato neutral entre todos los componentes
- El sistema debe fallar de forma segura (fail-safe)
- Preferir rollback automático sobre estado inconsistente
