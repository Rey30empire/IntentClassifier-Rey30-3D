/**
 * CharacterLibraryBuilder - Types
 * 
 * Tipos e interfaces para el sistema de construcción de personajes modulares
 */

// ============================================
// CATEGORIES & SOCKETS
// ============================================

/** Categorías de piezas modulares */
export type PartCategory = 
  | 'body' 
  | 'head' 
  | 'hair' 
  | 'torso' 
  | 'arms' 
  | 'legs' 
  | 'shoes' 
  | 'outfit' 
  | 'accessory'
  | 'helmet'
  | 'gloves'
  | 'cape'
  | 'shoulder'
  | 'weapon'
  | 'back_item'
  | 'face_accessory'
  | 'wings'
  | 'tail';

/** Sockets de anclaje en el personaje */
export type SocketName = 
  | 'head_socket'
  | 'hair_socket'
  | 'neck_socket'
  | 'torso_socket'
  | 'left_arm_socket'
  | 'right_arm_socket'
  | 'left_hand_socket'
  | 'right_hand_socket'
  | 'legs_socket'
  | 'feet_socket'
  | 'back_socket'
  | 'waist_socket'
  | 'shoulder_left_socket'
  | 'shoulder_right_socket';

/** Mapeo de categorías a sockets */
export const CategoryToSocket: Record<PartCategory, SocketName[]> = {
  body: ['torso_socket'],
  head: ['head_socket'],
  hair: ['hair_socket'],
  torso: ['torso_socket'],
  arms: ['left_arm_socket', 'right_arm_socket'],
  legs: ['legs_socket'],
  shoes: ['feet_socket'],
  outfit: ['torso_socket'],
  accessory: ['back_socket', 'waist_socket'],
  helmet: ['head_socket'],
  gloves: ['left_hand_socket', 'right_hand_socket'],
  cape: ['back_socket'],
  shoulder: ['shoulder_left_socket', 'shoulder_right_socket'],
  weapon: ['left_hand_socket', 'right_hand_socket'],
  back_item: ['back_socket'],
  face_accessory: ['head_socket'],
  wings: ['back_socket'],
  tail: ['back_socket'],
};

// ============================================
// BODY TYPES & GENDER
// ============================================

/** Tipos de cuerpo */
export type BodyType = 
  | 'male_small'
  | 'male_medium'
  | 'male_large'
  | 'female_small'
  | 'female_medium'
  | 'female_large'
  | 'universal';

/** Estilos de género */
export type GenderStyle = 'masculine' | 'feminine' | 'unisex';

/** Tipos de raza */
export type RaceType = 'human' | 'elf' | 'dwarf' | 'orc' | 'custom';

// ============================================
// RARITY & TAGS
// ============================================

/** Rareza de items */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** Colores de rareza */
export const RarityColors: Record<Rarity, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

// ============================================
// ASSET METADATA
// ============================================

/** Opción de color */
export interface ColorOption {
  id: string;
  name: string;
  hex: string;
  materialIndex?: number;
}

/** Metadata de asset modular */
export interface AssetMetadata {
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
  thumbnailPath?: string;
  
  // Compatibilidad
  skeletonId: string;
  bodyTypes: BodyType[];
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
  
  // Metadata adicional
  author?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// CHARACTER STATE
// ============================================

/** Pieza equipada */
export interface EquippedPart {
  assetId: string;
  category: PartCategory;
  colorOverride?: string;
  materialVariant?: string;
}

/** Estado del personaje */
export interface CharacterState {
  id: string;
  name: string;
  baseBodyId: string;
  equippedParts: Map<PartCategory, EquippedPart>;
  colorOverrides: Map<string, string>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
  };
}

/** Preset de personaje */
export interface CharacterPreset {
  version: string;
  id: string;
  name: string;
  description?: string;
  baseBodyId: string;
  parts: Partial<Record<PartCategory, string>>;
  colors: Record<string, string>;
  metadata: {
    createdAt: string;
    updatedAt: string;
    tags: string[];
    author?: string;
  };
}

// ============================================
// VALIDATION
// ============================================

/** Resultado de validación */
export interface ValidationResult {
  compatible: boolean;
  reasons: string[];
  warnings: string[];
  canForceEquip?: boolean;
}

/** Filtros de assets */
export interface AssetFilters {
  category?: PartCategory;
  bodyType?: BodyType;
  skeletonId?: string;
  rarity?: Rarity;
  tags?: string[];
  searchTerm?: string;
  genderStyle?: GenderStyle;
  raceType?: RaceType;
}

// ============================================
// DRAG & DROP
// ============================================

/** Estado de drag */
export interface DragState {
  isDragging: boolean;
  assetId: string | null;
  sourceCategory: PartCategory | null;
  currentDropZone: SocketName | null;
  validDropZones: SocketName[];
}

/** Zona de drop */
export interface DropZone {
  socketName: SocketName;
  position: { x: number; y: number; z: number };
  radius: number;
  highlighted: boolean;
  valid: boolean;
}

// ============================================
// UI STATE
// ============================================

/** Estado de UI del builder */
export interface CharacterBuilderUIState {
  isOpen: boolean;
  selectedCategory: PartCategory;
  selectedAssetId: string | null;
  hoveredAssetId: string | null;
  draggedAssetId: string | null;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Viewport
  cameraRotation: { x: number; y: number };
  cameraZoom: number;
  isAutoRotate: boolean;
  
  // Panels
  showPropertiesPanel: boolean;
  showPresetPanel: boolean;
}

// ============================================
// EVENTS
// ============================================

/** Eventos del Character Builder */
export interface CharacterBuilderEvents {
  'character-builder:opened': Record<string, never>;
  'character-builder:closed': Record<string, never>;
  'character-builder:category-selected': { category: PartCategory };
  'character-builder:asset-selected': { assetId: string };
  'character-builder:drag-start': { assetId: string };
  'character-builder:drag-end': { assetId: string; dropped: boolean };
  'character-builder:part-equipped': { assetId: string; category: PartCategory };
  'character-builder:part-unequipped': { category: PartCategory };
  'character-builder:preset-saved': { presetId: string };
  'character-builder:preset-loaded': { presetId: string };
  'character-builder:error': { message: string };
}

// ============================================
// ENGINE WRAPPERS
// ============================================

/**
 * Wrappers abstractos para funciones del motor
 * Estos se conectan a las APIs reales del engine cuando estén disponibles
 */
export interface EngineWrappers {
  // Model Loading
  loadModel(path: string): Promise<string>;
  unloadModel(handle: string): void;
  
  // Scene Management
  attachToScene(nodeHandle: string): void;
  detachFromScene(nodeHandle: string): void;
  
  // Socket System
  attachToSocket(baseHandle: string, childHandle: string, socketName: SocketName): void;
  detachFromSocket(baseHandle: string, socketName: SocketName): void;
  getSocketPosition(baseHandle: string, socketName: SocketName): [number, number, number];
  
  // Rendering
  renderThumbnail(modelPath: string): Promise<string>;
  captureViewport(): string;
  
  // File System
  readJSON(path: string): Promise<unknown>;
  writeJSON(path: string, data: unknown): Promise<void>;
  listFiles(directory: string, pattern: string): string[];
  
  // Messages
  showMessage(type: 'info' | 'warning' | 'error', text: string): void;
}
