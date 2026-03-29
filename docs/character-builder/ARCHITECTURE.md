# CharacterLibraryBuilder - Arquitectura del Sistema

## Visión General

CharacterLibraryBuilder es un módulo del motor Rey30_NEXUS que permite construir personajes 3D modulares mediante un sistema visual de drag-and-drop.

### Concepto Principal

Una **mesa de trabajo digital** donde:
- A la izquierda: Biblioteca de piezas 3D organizadas por categorías
- En el centro: Personaje base con vista previa 3D interactiva
- A la derecha: Panel de propiedades y acciones

---

## Módulos del Sistema

### 1. AssetLibrary
**Responsabilidad**: Gestiona la biblioteca de assets modulares.

```typescript
interface AssetLibrary {
  // Cargar biblioteca desde metadata
  loadFromMetadata(path: string): Promise<void>;
  
  // Obtener assets por categoría
  getByCategory(category: PartCategory): AssetMetadata[];
  
  // Buscar assets
  search(query: string, filters: AssetFilters): AssetMetadata[];
  
  // Obtener asset por ID
  getById(id: string): AssetMetadata | undefined;
  
  // Refrescar biblioteca
  refresh(): Promise<void>;
}
```

### 2. MetadataDatabase
**Responsabilidad**: Almacena y gestiona la metadata de cada pieza.

```typescript
interface AssetMetadata {
  // Identificación
  id: string;
  name: string;
  description?: string;
  
  // Clasificación
  category: PartCategory;
  subcategory?: string;
  tags: string[];
  
  // Rutas
  modelPath: string;
  thumbnailPath: string;
  
  // Compatibilidad
  skeletonId: string;
  bodyType: BodyType;
  attachmentSocket: SocketName;
  
  // Estado
  enabled: boolean;
  rarity?: Rarity;
  
  // Opcionales
  materialVariants?: string[];
  colorOptions?: ColorOption[];
  genderStyle?: GenderStyle;
  raceType?: RaceType;
  lodAvailable?: boolean;
}

type PartCategory = 
  | 'body' | 'head' | 'hair' | 'torso' 
  | 'arms' | 'legs' | 'shoes' | 'outfit' 
  | 'accessory' | 'helmet' | 'gloves' | 'cape'
  | 'shoulder' | 'weapon' | 'back_item' 
  | 'face_accessory' | 'wings' | 'tail';

type BodyType = 'male_small' | 'male_medium' | 'male_large' 
  | 'female_small' | 'female_medium' | 'female_large'
  | 'universal';

type SocketName = 
  | 'head_socket' | 'hair_socket' | 'neck_socket'
  | 'torso_socket' | 'left_arm_socket' | 'right_arm_socket'
  | 'legs_socket' | 'feet_socket' | 'back_socket'
  | 'waist_socket' | 'left_hand_socket' | 'right_hand_socket';
```

### 3. CharacterAssembler
**Responsabilidad**: Ensambla y desensambla piezas del personaje.

```typescript
interface CharacterAssembler {
  // Cargar personaje base
  loadBaseCharacter(baseId: string): Promise<void>;
  
  // Equipar pieza
  equipPart(assetId: string): Promise<boolean>;
  
  // Desequipar pieza por categoría
  unequipPart(category: PartCategory): void;
  
  // Desequipar todo
  unequipAll(): void;
  
  // Obtener estado actual
  getCurrentState(): CharacterState;
  
  // Restaurar desde estado
  restoreFromState(state: CharacterState): Promise<void>;
}

interface CharacterState {
  baseBodyId: string;
  equippedParts: Map<PartCategory, string>;
  colorOverrides: Map<string, string>;
}
```

### 4. CompatibilityValidator
**Responsabilidad**: Valida si una pieza es compatible con el personaje actual.

```typescript
interface CompatibilityValidator {
  // Validar compatibilidad completa
  validate(asset: AssetMetadata, character: CharacterState): ValidationResult;
  
  // Validar categoría
  validateCategory(asset: AssetMetadata, targetSocket: SocketName): boolean;
  
  // Validar skeleton
  validateSkeleton(asset: AssetMetadata, baseBody: BaseBody): boolean;
  
  // Validar body type
  validateBodyType(asset: AssetMetadata, currentBodyType: BodyType): boolean;
  
  // Obtener razones de incompatibilidad
  getIncompatibilityReasons(asset: AssetMetadata, character: CharacterState): string[];
}

interface ValidationResult {
  compatible: boolean;
  reasons: string[];
  warnings: string[];
}
```

### 5. DragDropController
**Responsabilidad**: Controla el sistema de drag-and-drop.

```typescript
interface DragDropController {
  // Iniciar drag
  startDrag(assetId: string, event: DragEvent): void;
  
  // Mover durante drag
  onDragMove(event: DragEvent): void;
  
  // Terminar drag
  endDrag(event: DragEvent): void;
  
  // Detectar zona de drop
  detectDropZone(position: Vector2): SocketName | null;
  
  // Resaltar sockets válidos
  highlightValidSockets(asset: AssetMetadata): void;
  
  // Limpiar highlights
  clearHighlights(): void;
}
```

### 6. PreviewViewport
**Responsabilidad**: Vista previa 3D interactiva del personaje.

```typescript
interface PreviewViewport {
  // Inicializar viewport
  initialize(container: HTMLElement): void;
  
  // Cargar personaje
  loadCharacter(state: CharacterState): Promise<void>;
  
  // Rotar personaje
  rotate(deltaX: number, deltaY: number): void;
  
  // Zoom
  zoom(delta: number): void;
  
  // Resetear cámara
  resetCamera(): void;
  
  // Seleccionar socket
  selectSocket(socketName: SocketName): void;
  
  // Highlight socket
  highlightSocket(socketName: SocketName, active: boolean): void;
  
  // Screenshot
  captureScreenshot(): string;
}
```

### 7. PresetManager
**Responsabilidad**: Guarda y carga presets de personajes.

```typescript
interface PresetManager {
  // Guardar preset
  savePreset(name: string, state: CharacterState): Promise<void>;
  
  // Cargar preset
  loadPreset(presetId: string): Promise<CharacterState>;
  
  // Listar presets
  listPresets(): PresetInfo[];
  
  // Eliminar preset
  deletePreset(presetId: string): Promise<void>;
  
  // Exportar a JSON
  exportToJSON(state: CharacterState): string;
  
  // Importar desde JSON
  importFromJSON(json: string): CharacterState;
}

interface PresetInfo {
  id: string;
  name: string;
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 8. UICharacterBuilder
**Responsabilidad**: Interfaz visual del constructor de personajes.

```typescript
interface UICharacterBuilder {
  // Abrir ventana
  open(): void;
  
  // Cerrar ventana
  close(): void;
  
  // Actualizar categorías
  updateCategories(categories: PartCategory[]): void;
  
  // Actualizar miniaturas
  updateThumbnails(assets: AssetMetadata[]): void;
  
  // Mostrar mensaje
  showMessage(type: 'info' | 'warning' | 'error', text: string): void;
  
  // Actualizar estado de botones
  updateButtonStates(state: ButtonStates): void;
}
```

---

## Estructura de Archivos

```
src/lib/character-builder/
├── index.ts                    # Exports principales
├── types.ts                    # Tipos y interfaces
├── AssetLibrary.ts             # Gestión de biblioteca
├── MetadataDatabase.ts         # Base de datos de metadata
├── CharacterAssembler.ts       # Ensamblador de personaje
├── CompatibilityValidator.ts   # Validador de compatibilidad
├── DragDropController.ts       # Controlador de drag-drop
├── PreviewViewport.ts          # Vista previa 3D
├── PresetManager.ts            # Gestión de presets
└── wrappers/
    ├── EngineWrappers.ts       # Wrappers para funciones del motor
    └── SceneWrappers.ts        # Wrappers para escena 3D

src/components/character-builder/
├── CharacterBuilderPanel.tsx   # Panel principal
├── AssetLibraryPanel.tsx       # Panel de biblioteca
├── CategoryTabs.tsx            # Tabs de categorías
├── ThumbnailGrid.tsx           # Grid de miniaturas
├── PreviewViewport.tsx         # Viewport 3D
├── PropertiesPanel.tsx         # Panel de propiedades
├── ActionBar.tsx               # Barra de acciones
└── hooks/
    ├── useCharacterBuilder.ts  # Hook principal
    ├── useAssetLibrary.ts      # Hook para biblioteca
    └── useDragDrop.ts          # Hook para drag-drop
```

---

## Flujo de Eventos

```
Usuario abre Character Builder
        ↓
[open_character_builder]
        ↓
create_window("Character Builder")
load_base_character()
load_asset_library()
build_category_tabs()
activate_preview_camera()
        ↓
Usuario selecciona categoría
        ↓
[select_category(category)]
        ↓
filter_library_by_category(category)
refresh_thumbnail_grid()
        ↓
Usuario arrastra pieza
        ↓
[start_drag(asset_id)]
        ↓
create_drag_preview(asset_id)
highlight_valid_drop_zones(asset_id)
        ↓
Usuario suelta pieza
        ↓
[drop_asset(asset_id, target_zone)]
        ↓
read_asset_metadata(asset_id)
validate_asset_with_target(asset_id, target_zone)
        ↓
    ¿Válido?
    ↓           ↓
   SÍ           NO
    ↓           ↓
equip_part()  show_error()
refresh_preview()
        ↓
Usuario guarda preset
        ↓
[click_save_preset]
        ↓
serialize_current_character()
write_json_to_presets_folder()
```

---

## Wrappers del Motor

### Funciones que el motor debe proporcionar:

```typescript
// Window Management
engine_create_window(name: string): WindowHandle;
engine_close_window(handle: WindowHandle): void;

// Model Loading
engine_load_model(path: string): Promise<ModelHandle>;
engine_unload_model(handle: ModelHandle): void;

// Scene Management
engine_attach_to_scene(node: NodeHandle): void;
engine_detach_from_scene(node: NodeHandle): void;

// Socket System
engine_attach_to_socket(base: NodeHandle, child: NodeHandle, socket: string): void;
engine_detach_from_socket(base: NodeHandle, socket: string): void;
engine_get_socket_position(base: NodeHandle, socket: string): Vector3;

// Rendering
engine_render_thumbnail(path: string, model: ModelHandle): Promise<string>;
engine_capture_viewport(): string;

// UI
engine_show_message(type: MessageType, text: string): void;
engine_create_button(label: string, callback: () => void): ButtonHandle;

// File System
engine_read_json(path: string): Promise<object>;
engine_write_json(path: string, data: object): Promise<void>;
engine_list_files(directory: string, pattern: string): string[];

// Camera
engine_set_camera_orbit(camera: CameraHandle, enabled: boolean): void;
engine_set_camera_zoom(camera: CameraHandle, zoom: number): void;
engine_reset_camera(camera: CameraHandle): void;
```

---

## Ejemplo de Preset JSON

```json
{
  "version": "1.0",
  "name": "Guerrera Oscura",
  "baseBodyId": "female_base_01",
  "parts": {
    "hair": "hair_long_dark_02",
    "head": "head_female_01",
    "torso": "armor_dark_plate_03",
    "arms": "arms_plate_dark_01",
    "legs": "legs_plate_dark_01",
    "shoes": "boots_armored_02",
    "accessory": "cape_dark_01"
  },
  "colors": {
    "hair": "#1a1a2e",
    "armor_primary": "#2d2d44",
    "armor_secondary": "#8b0000"
  },
  "metadata": {
    "createdAt": "2024-01-15T10:30:00Z",
    "tags": ["warrior", "dark", "armor"]
  }
}
```

---

## Fases de Implementación

### Fase 1: MVP (Mínimo Viable)
- [x] Tipos y interfaces base
- [ ] AssetLibrary básico
- [ ] CharacterAssembler simple
- [ ] Vista previa 3D
- [ ] Equipar por clic (sin drag-drop)
- [ ] Guardar/cargar preset JSON

### Fase 2: Drag & Drop
- [ ] DragDropController completo
- [ ] Detección de sockets
- [ ] Highlight de zonas válidas
- [ ] Reemplazo automático de piezas

### Fase 3: Validación
- [ ] CompatibilityValidator completo
- [ ] Mensajes de error claros
- [ ] Filtros por body type
- [ ] Filtros por skeleton

### Fase 4: Features Avanzadas
- [ ] Botón Random
- [ ] Sistema de colores
- [ ] Thumbnails generados
- [ ] Búsqueda y filtros
- [ ] Favoritos

### Fase 5: Polish
- [ ] Animación de preview
- [ ] Morph targets
- [ ] Razas y géneros
- [ ] Marketplace interno

---

## Consideraciones Técnicas

### Rendimiento
- Lazy loading de modelos 3D
- Pooling de thumbnails
- Instancing para piezas compartidas
- LOD para preview

### Compatibilidad
- Todas las piezas deben compartir skeleton base
- Escala uniforme (1 unidad = 1 metro)
- Pivots en el origen
- Nomenclatura consistente de sockets

### Extensibilidad
- Sistema de plugins para nuevas categorías
- Eventos para integración con otros módulos
- API pública documentada
