/**
 * NEXUS Engine - Character Library System
 * 
 * Sistema completo de biblioteca de personajes con:
 * - Personajes pre-definidos paramétricos
 * - Personalización (colores, accesorios, proporciones)
 * - Sistema de categorías y tags
 * - Drag-and-drop para añadir a escena
 * - Preview y thumbnails
 */

import { Vec3, Quat, RGBA, generateId } from '../conversion/types';

// ============================================
// CHARACTER TYPES
// ============================================

/** Tipo de personaje */
export type CharacterType =
  | 'human'
  | 'humanoid'
  | 'animal'
  | 'creature'
  | 'robot'
  | 'monster'
  | 'fantasy'
  | 'custom';

/** Categoría de personaje */
export type CharacterCategory =
  | 'protagonist'
  | 'antagonist'
  | 'npc'
  | 'enemy'
  | 'ally'
  | 'civilian'
  | 'animal'
  | 'creature'
  | 'robot'
  | 'custom';

/** Estilo de personaje */
export type CharacterStyle =
  | 'realistic'
  | 'stylized'
  | 'cartoon'
  | 'anime'
  | 'low_poly'
  | 'voxel'
  | 'pixel_art';

/** Género del personaje */
export type CharacterGender = 'male' | 'female' | 'neutral' | 'other';

// ============================================
// BODY PARAMETERS
// ============================================

/** Proporciones del cuerpo */
export interface BodyProportions {
  // Altura y escala
  height: number;              // Metros
  scale: number;               // Multiplicador general
  
  // Proporciones de cuerpo
  headSize: number;            // 0.5 - 2.0
  torsoLength: number;         // 0.5 - 2.0
  armLength: number;           // 0.5 - 2.0
  legLength: number;           // 0.5 - 2.0
  handSize: number;            // 0.5 - 2.0
  footSize: number;            // 0.5 - 2.0
  
  // Grosor
  shoulderWidth: number;       // 0.5 - 2.0
  chestWidth: number;          // 0.5 - 2.0
  waistWidth: number;          // 0.5 - 2.0
  hipWidth: number;            // 0.5 - 2.0
  neckThickness: number;       // 0.5 - 2.0
  armThickness: number;        // 0.5 - 2.0
  legThickness: number;        // 0.5 - 2.0
  
  // Tipo de cuerpo
  bodyType: 'slim' | 'average' | 'athletic' | 'muscular' | 'heavy';
  fitness: number;             // 0 - 1 (delgado a musculoso)
}

/** Parámetros de cabeza */
export interface HeadParameters {
  // Forma de la cara
  faceShape: 'oval' | 'round' | 'square' | 'heart' | 'diamond' | 'oblong';
  faceWidth: number;           // 0.5 - 2.0
  faceHeight: number;          // 0.5 - 2.0
  
  // Ojos
  eyeSize: number;             // 0.5 - 2.0
  eyeSpacing: number;          // 0.5 - 2.0
  eyeShape: 'round' | 'almond' | 'cat' | 'droopy' | 'wide';
  eyeAngle: number;            // -30 a 30 grados
  
  // Nariz
  noseSize: number;            // 0.5 - 2.0
  noseWidth: number;           // 0.5 - 2.0
  noseShape: 'straight' | 'aquiline' | 'button' | 'flat' | 'pointed';
  
  // Boca
  mouthSize: number;           // 0.5 - 2.0
  lipThickness: number;        // 0.5 - 2.0
  mouthShape: 'neutral' | 'smile' | 'frown';
  
  // Orejas
  earSize: number;             // 0.5 - 2.0
  earShape: 'normal' | 'pointed' | 'round' | 'elongated';
  
  // Otros
  chinShape: 'pointed' | 'round' | 'square' | 'cleft';
  cheekbones: number;          // 0 - 1
  jawline: number;             // 0 - 1
}

/** Parámetros de cabello */
export interface HairParameters {
  style: string;               // ID del estilo
  length: 'bald' | 'buzz' | 'short' | 'medium' | 'long' | 'very_long';
  color: RGBA;
  secondaryColor?: RGBA;
  
  // Styling
  volume: number;              // 0 - 1
  curliness: number;           // 0 - 1 (0 = liso, 1 = muy rizado)
  messiness: number;           // 0 - 1
  
  // Extras
  hasHighlights: boolean;
  highlightColor?: RGBA;
  hasUndercut: boolean;
  hasBangs: boolean;
  bangsStyle?: 'straight' | 'side' | 'curtain' | 'wispy';
}

/** Parámetros de rostro */
export interface FacialHairParameters {
  style: 'none' | 'stubble' | 'goatee' | 'mustache' | 'beard' | 'full_beard';
  color: RGBA;
  density: number;             // 0 - 1
  length: number;              // 0 - 1
}

// ============================================
// CLOTHING & ACCESSORIES
// ============================================

/** Categoría de ropa */
export type ClothingCategory =
  | 'headwear'
  | 'eyewear'
  | 'top'
  | 'outerwear'
  | 'bottom'
  | 'footwear'
  | 'accessory'
  | 'underwear';

/** Item de ropa */
export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  style: string;
  color: RGBA;
  secondaryColor?: RGBA;
  pattern?: 'solid' | 'striped' | 'plaid' | 'floral' | 'camo' | 'custom';
  material?: 'cotton' | 'leather' | 'denim' | 'wool' | 'silk' | 'synthetic';
  
  // Variants
  variants?: Map<string, string | number | RGBA>;
}

/** Accesorio */
export interface Accessory {
  id: string;
  name: string;
  type: 'jewelry' | 'bag' | 'scarf' | 'belt' | 'watch' | 'glasses' | 'other';
  position: 'head' | 'neck' | 'wrist' | 'waist' | 'hand' | 'back' | 'ankle';
  color: RGBA;
  material?: string;
  style?: string;
}

/** Outfit completo */
export interface Outfit {
  id: string;
  name: string;
  items: Map<ClothingCategory, ClothingItem>;
  accessories: Accessory[];
}

// ============================================
// ANIMATION & POSES
// ============================================

/** Pose predefinida */
export interface CharacterPose {
  id: string;
  name: string;
  category: 'standing' | 'sitting' | 'lying' | 'action' | 'expression' | 'custom';
  jointRotations: Map<string, Quat>;
  description?: string;
}

/** Animación del personaje */
export interface CharacterAnimation {
  id: string;
  name: string;
  category: 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'interact' | 'emote' | 'custom';
  duration: number;
  loop: boolean;
  keyframes: AnimationKeyframe[];
  blendTime?: number;
}

/** Keyframe de animación */
export interface AnimationKeyframe {
  time: number;
  jointRotations: Map<string, Quat>;
  jointPositions?: Map<string, Vec3>;
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce';
}

// ============================================
// CHARACTER INSTANCE
// ============================================

/** Personaje instanciado en la escena */
export interface CharacterInstance {
  id: string;
  libraryId: string;           // Referencia al personaje en la biblioteca
  name: string;
  
  // Transform
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
  
  // Personalización override
  overrides: CharacterOverrides;
  
  // Estado actual
  currentPose: string;
  currentAnimation?: string;
  animationTime: number;
  
  // Metadatos
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  modifiedAt: Date;
}

/** Overrides de personalización */
export interface CharacterOverrides {
  colors?: Map<string, RGBA>;
  bodyProportions?: Partial<BodyProportions>;
  headParameters?: Partial<HeadParameters>;
  hair?: Partial<HairParameters>;
  facialHair?: Partial<FacialHairParameters>;
  outfit?: Outfit;
}

// ============================================
// CHARACTER DEFINITION
// ============================================

/** Personaje en la biblioteca */
export interface CharacterDefinition {
  id: string;
  name: string;
  description?: string;
  type: CharacterType;
  category: CharacterCategory;
  style: CharacterStyle;
  gender: CharacterGender;
  tags: string[];
  
  // Parámetros base
  baseProportions: BodyProportions;
  headParameters: HeadParameters;
  hairParameters: HairParameters;
  facialHair?: FacialHairParameters;
  
  // Colores base
  skinColor: RGBA;
  eyeColor: RGBA;
  
  // Outfit default
  defaultOutfit: Outfit;
  
  // Poses y animaciones
  defaultPose: string;
  poses: Map<string, CharacterPose>;
  animations: Map<string, CharacterAnimation>;
  
  // Preview
  thumbnail?: string;
  previewModel?: string;
  
  // Metadatos
  author?: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  isCustom: boolean;
  isFavorite: boolean;
}

// ============================================
// CHARACTER LIBRARY
// ============================================

/** Entrada de biblioteca con metadata adicional */
export interface LibraryEntry {
  character: CharacterDefinition;
  usageCount: number;
  lastUsed?: Date;
  customTags: string[];
}

/** Filtros de búsqueda */
export interface CharacterFilters {
  types?: CharacterType[];
  categories?: CharacterCategory[];
  styles?: CharacterStyle[];
  genders?: CharacterGender[];
  tags?: string[];
  search?: string;
  favorites?: boolean;
  custom?: boolean;
}

/** Opciones de ordenamiento */
export type CharacterSortField = 'name' | 'type' | 'category' | 'usage' | 'date' | 'style';
export type CharacterSortOrder = 'asc' | 'desc';

export interface CharacterSortOptions {
  field: CharacterSortField;
  order: CharacterSortOrder;
}

// ============================================
// CHARACTER LIBRARY MANAGER
// ============================================

/**
 * Manager de la biblioteca de personajes
 */
export class CharacterLibraryManager {
  private library: Map<string, LibraryEntry> = new Map();
  private instances: Map<string, CharacterInstance> = new Map();
  private categories: Map<CharacterCategory, string[]> = new Map();
  private tags: Map<string, string[]> = new Map();
  
  private favorites: Set<string> = new Set();
  private recentUsed: string[] = [];
  private maxRecentCount: number = 20;
  
  constructor() {
    this.initializeDefaultCharacters();
  }
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  /** Inicializar personajes por defecto */
  private initializeDefaultCharacters(): void {
    // Crear algunos personajes básicos
    const defaultCharacters = this.createDefaultCharacters();
    
    for (const char of defaultCharacters) {
      this.addCharacter(char);
    }
  }
  
  /** Crear personajes por defecto */
  private createDefaultCharacters(): CharacterDefinition[] {
    const characters: CharacterDefinition[] = [];
    
    // Humano masculino básico
    characters.push(this.createHumanCharacter({
      name: 'Male Human - Basic',
      gender: 'male',
      type: 'human',
      category: 'civilian',
      style: 'stylized',
    }));
    
    // Humano femenino básico
    characters.push(this.createHumanCharacter({
      name: 'Female Human - Basic',
      gender: 'female',
      type: 'human',
      category: 'civilian',
      style: 'stylized',
    }));
    
    // Robot básico
    characters.push(this.createRobotCharacter({
      name: 'Robot - Basic',
      category: 'robot',
      style: 'low_poly',
    }));
    
    // Criatura fantástica
    characters.push(this.createFantasyCharacter({
      name: 'Fantasy Creature - Basic',
      type: 'fantasy',
      category: 'creature',
      style: 'stylized',
    }));
    
    return characters;
  }
  
  /** Crear personaje humano */
  private createHumanCharacter(options: {
    name: string;
    gender: CharacterGender;
    type: CharacterType;
    category: CharacterCategory;
    style: CharacterStyle;
  }): CharacterDefinition {
    const isMale = options.gender === 'male';
    
    return {
      id: generateId(),
      name: options.name,
      type: options.type,
      category: options.category,
      style: options.style,
      gender: options.gender,
      tags: ['human', options.gender, 'basic'],
      
      baseProportions: {
        height: isMale ? 1.75 : 1.65,
        scale: 1.0,
        headSize: 1.0,
        torsoLength: 1.0,
        armLength: 1.0,
        legLength: 1.0,
        handSize: 1.0,
        footSize: 1.0,
        shoulderWidth: isMale ? 1.2 : 1.0,
        chestWidth: isMale ? 1.1 : 0.9,
        waistWidth: isMale ? 0.9 : 0.8,
        hipWidth: isMale ? 0.9 : 1.1,
        neckThickness: isMale ? 1.1 : 0.9,
        armThickness: isMale ? 1.1 : 0.9,
        legThickness: isMale ? 1.0 : 0.95,
        bodyType: 'average',
        fitness: 0.5,
      },
      
      headParameters: {
        faceShape: 'oval',
        faceWidth: 1.0,
        faceHeight: 1.0,
        eyeSize: 1.0,
        eyeSpacing: 1.0,
        eyeShape: 'almond',
        eyeAngle: 0,
        noseSize: isMale ? 1.1 : 0.95,
        noseWidth: isMale ? 1.1 : 0.9,
        noseShape: 'straight',
        mouthSize: 1.0,
        lipThickness: isMale ? 0.9 : 1.1,
        mouthShape: 'neutral',
        earSize: 1.0,
        earShape: 'normal',
        chinShape: isMale ? 'square' : 'round',
        cheekbones: 0.5,
        jawline: isMale ? 0.7 : 0.4,
      },
      
      hairParameters: {
        style: isMale ? 'short_mens' : 'long_womens',
        length: isMale ? 'short' : 'long',
        color: { r: 0.15, g: 0.1, b: 0.05, a: 1 },
        volume: 0.5,
        curliness: 0.2,
        messiness: 0.1,
        hasHighlights: false,
        hasUndercut: false,
        hasBangs: !isMale,
      },
      
      skinColor: { r: 0.9, g: 0.75, b: 0.65, a: 1 },
      eyeColor: { r: 0.3, g: 0.5, b: 0.7, a: 1 },
      
      defaultOutfit: {
        id: generateId(),
        name: 'Default Outfit',
        items: new Map([
          ['top', {
            id: generateId(),
            name: 'T-Shirt',
            category: 'top',
            style: 'casual',
            color: { r: 0.3, g: 0.3, b: 0.3, a: 1 },
          }],
          ['bottom', {
            id: generateId(),
            name: 'Pants',
            category: 'bottom',
            style: 'casual',
            color: { r: 0.2, g: 0.2, b: 0.25, a: 1 },
          }],
          ['footwear', {
            id: generateId(),
            name: 'Shoes',
            category: 'footwear',
            style: 'casual',
            color: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
          }],
        ]),
        accessories: [],
      },
      
      defaultPose: 'standing_idle',
      poses: new Map([
        ['standing_idle', {
          id: 'standing_idle',
          name: 'Standing Idle',
          category: 'standing',
          jointRotations: new Map(),
        }],
        ['standing_relaxed', {
          id: 'standing_relaxed',
          name: 'Standing Relaxed',
          category: 'standing',
          jointRotations: new Map(),
        }],
      ]),
      animations: new Map([
        ['idle', {
          id: 'idle',
          name: 'Idle',
          category: 'idle',
          duration: 3.0,
          loop: true,
          keyframes: [],
        }],
        ['walk', {
          id: 'walk',
          name: 'Walk',
          category: 'walk',
          duration: 1.0,
          loop: true,
          keyframes: [],
        }],
      ]),
      
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      isCustom: false,
      isFavorite: false,
    };
  }
  
  /** Crear personaje robot */
  private createRobotCharacter(options: {
    name: string;
    category: CharacterCategory;
    style: CharacterStyle;
  }): CharacterDefinition {
    return {
      id: generateId(),
      name: options.name,
      type: 'robot',
      category: options.category,
      style: options.style,
      gender: 'neutral',
      tags: ['robot', 'mechanical', 'basic'],
      
      baseProportions: {
        height: 1.8,
        scale: 1.0,
        headSize: 0.8,
        torsoLength: 1.2,
        armLength: 1.1,
        legLength: 1.0,
        handSize: 1.2,
        footSize: 1.3,
        shoulderWidth: 1.3,
        chestWidth: 1.2,
        waistWidth: 1.0,
        hipWidth: 1.0,
        neckThickness: 0.8,
        armThickness: 1.2,
        legThickness: 1.1,
        bodyType: 'athletic',
        fitness: 0.8,
      },
      
      headParameters: {
        faceShape: 'square',
        faceWidth: 1.0,
        faceHeight: 1.0,
        eyeSize: 0.8,
        eyeSpacing: 1.2,
        eyeShape: 'round',
        eyeAngle: 0,
        noseSize: 0.5,
        noseWidth: 0.5,
        noseShape: 'flat',
        mouthSize: 0.6,
        lipThickness: 0.3,
        mouthShape: 'neutral',
        earSize: 0.5,
        earShape: 'round',
        chinShape: 'square',
        cheekbones: 0.2,
        jawline: 0.9,
      },
      
      hairParameters: {
        style: 'none',
        length: 'bald',
        color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
        volume: 0,
        curliness: 0,
        messiness: 0,
        hasHighlights: false,
        hasUndercut: false,
        hasBangs: false,
      },
      
      skinColor: { r: 0.6, g: 0.6, b: 0.65, a: 1 },
      eyeColor: { r: 0, g: 1, b: 0.5, a: 1 },
      
      defaultOutfit: {
        id: generateId(),
        name: 'Default Plating',
        items: new Map(),
        accessories: [],
      },
      
      defaultPose: 'standing_idle',
      poses: new Map([
        ['standing_idle', {
          id: 'standing_idle',
          name: 'Standing Idle',
          category: 'standing',
          jointRotations: new Map(),
        }],
      ]),
      animations: new Map([
        ['idle', {
          id: 'idle',
          name: 'Idle',
          category: 'idle',
          duration: 2.0,
          loop: true,
          keyframes: [],
        }],
      ]),
      
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      isCustom: false,
      isFavorite: false,
    };
  }
  
  /** Crear personaje fantástico */
  private createFantasyCharacter(options: {
    name: string;
    type: CharacterType;
    category: CharacterCategory;
    style: CharacterStyle;
  }): CharacterDefinition {
    return {
      id: generateId(),
      name: options.name,
      type: options.type,
      category: options.category,
      style: options.style,
      gender: 'neutral',
      tags: ['fantasy', 'creature', 'magical'],
      
      baseProportions: {
        height: 1.5,
        scale: 1.0,
        headSize: 1.3,
        torsoLength: 0.8,
        armLength: 1.2,
        legLength: 0.9,
        handSize: 1.1,
        footSize: 1.0,
        shoulderWidth: 0.9,
        chestWidth: 0.85,
        waistWidth: 0.8,
        hipWidth: 0.9,
        neckThickness: 0.9,
        armThickness: 0.8,
        legThickness: 0.85,
        bodyType: 'slim',
        fitness: 0.4,
      },
      
      headParameters: {
        faceShape: 'oval',
        faceWidth: 0.9,
        faceHeight: 1.1,
        eyeSize: 1.3,
        eyeSpacing: 1.0,
        eyeShape: 'cat',
        eyeAngle: 10,
        noseSize: 0.8,
        noseWidth: 0.7,
        noseShape: 'pointed',
        mouthSize: 0.8,
        lipThickness: 0.9,
        mouthShape: 'neutral',
        earSize: 1.5,
        earShape: 'pointed',
        chinShape: 'pointed',
        cheekbones: 0.7,
        jawline: 0.3,
      },
      
      hairParameters: {
        style: 'long_flow',
        length: 'long',
        color: { r: 0.8, g: 0.6, b: 0.2, a: 1 },
        volume: 0.7,
        curliness: 0.3,
        messiness: 0.2,
        hasHighlights: true,
        highlightColor: { r: 1, g: 0.9, b: 0.5, a: 1 },
        hasUndercut: false,
        hasBangs: true,
      },
      
      skinColor: { r: 0.7, g: 0.85, b: 0.7, a: 1 },
      eyeColor: { r: 0.9, g: 0.7, b: 0.2, a: 1 },
      
      defaultOutfit: {
        id: generateId(),
        name: 'Mystic Robes',
        items: new Map([
          ['outerwear', {
            id: generateId(),
            name: 'Mystic Cloak',
            category: 'outerwear',
            style: 'fantasy',
            color: { r: 0.2, g: 0.1, b: 0.4, a: 1 },
          }],
        ]),
        accessories: [],
      },
      
      defaultPose: 'standing_idle',
      poses: new Map([
        ['standing_idle', {
          id: 'standing_idle',
          name: 'Standing Idle',
          category: 'standing',
          jointRotations: new Map(),
        }],
      ]),
      animations: new Map([
        ['idle', {
          id: 'idle',
          name: 'Idle',
          category: 'idle',
          duration: 4.0,
          loop: true,
          keyframes: [],
        }],
      ]),
      
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      isCustom: false,
      isFavorite: false,
    };
  }
  
  // ============================================
  // LIBRARY MANAGEMENT
  // ============================================
  
  /**
   * Añadir personaje a la biblioteca
   */
  addCharacter(character: CharacterDefinition): void {
    const entry: LibraryEntry = {
      character,
      usageCount: 0,
      customTags: [],
    };
    
    this.library.set(character.id, entry);
    
    // Actualizar índices
    this.addToCategoryIndex(character.category, character.id);
    for (const tag of character.tags) {
      this.addToTagIndex(tag, character.id);
    }
    
    if (character.isFavorite) {
      this.favorites.add(character.id);
    }
  }
  
  /**
   * Obtener personaje por ID
   */
  getCharacter(id: string): CharacterDefinition | null {
    return this.library.get(id)?.character || null;
  }
  
  /**
   * Eliminar personaje
   */
  removeCharacter(id: string): boolean {
    const entry = this.library.get(id);
    if (!entry) return false;
    
    // Remover de índices
    this.removeFromCategoryIndex(entry.character.category, id);
    for (const tag of entry.character.tags) {
      this.removeFromTagIndex(tag, id);
    }
    this.favorites.delete(id);
    
    this.library.delete(id);
    return true;
  }
  
  /**
   * Actualizar personaje
   */
  updateCharacter(id: string, updates: Partial<CharacterDefinition>): boolean {
    const entry = this.library.get(id);
    if (!entry) return false;
    
    entry.character = {
      ...entry.character,
      ...updates,
      updatedAt: new Date(),
    };
    
    return true;
  }
  
  // ============================================
  // SEARCH & FILTER
  // ============================================
  
  /**
   * Buscar personajes con filtros
   */
  search(filters?: CharacterFilters, sort?: CharacterSortOptions): CharacterDefinition[] {
    let results = Array.from(this.library.values());
    
    // Aplicar filtros
    if (filters) {
      if (filters.types?.length) {
        results = results.filter(e => filters.types!.includes(e.character.type));
      }
      if (filters.categories?.length) {
        results = results.filter(e => filters.categories!.includes(e.character.category));
      }
      if (filters.styles?.length) {
        results = results.filter(e => filters.styles!.includes(e.character.style));
      }
      if (filters.genders?.length) {
        results = results.filter(e => filters.genders!.includes(e.character.gender));
      }
      if (filters.tags?.length) {
        results = results.filter(e =>
          filters.tags!.some(t => e.character.tags.includes(t))
        );
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(e =>
          e.character.name.toLowerCase().includes(searchLower) ||
          e.character.description?.toLowerCase().includes(searchLower)
        );
      }
      if (filters.favorites) {
        results = results.filter(e => this.favorites.has(e.character.id));
      }
      if (filters.custom !== undefined) {
        results = results.filter(e => e.character.isCustom === filters.custom);
      }
    }
    
    // Aplicar ordenamiento
    if (sort) {
      results.sort((a, b) => {
        let cmp = 0;
        
        switch (sort.field) {
          case 'name':
            cmp = a.character.name.localeCompare(b.character.name);
            break;
          case 'type':
            cmp = a.character.type.localeCompare(b.character.type);
            break;
          case 'category':
            cmp = a.character.category.localeCompare(b.character.category);
            break;
          case 'usage':
            cmp = a.usageCount - b.usageCount;
            break;
          case 'date':
            cmp = a.character.createdAt.getTime() - b.character.createdAt.getTime();
            break;
          case 'style':
            cmp = a.character.style.localeCompare(b.character.style);
            break;
        }
        
        return sort.order === 'desc' ? -cmp : cmp;
      });
    }
    
    return results.map(e => e.character);
  }
  
  /**
   * Obtener todos los personajes
   */
  getAllCharacters(): CharacterDefinition[] {
    return Array.from(this.library.values()).map(e => e.character);
  }
  
  /**
   * Obtener personajes por categoría
   */
  getCharactersByCategory(category: CharacterCategory): CharacterDefinition[] {
    const ids = this.categories.get(category) || [];
    return ids.map(id => this.library.get(id)?.character).filter(Boolean) as CharacterDefinition[];
  }
  
  /**
   * Obtener personajes por tag
   */
  getCharactersByTag(tag: string): CharacterDefinition[] {
    const ids = this.tags.get(tag) || [];
    return ids.map(id => this.library.get(id)?.character).filter(Boolean) as CharacterDefinition[];
  }
  
  // ============================================
  // FAVORITES & RECENT
  // ============================================
  
  /**
   * Toggle favorito
   */
  toggleFavorite(id: string): boolean {
    const entry = this.library.get(id);
    if (!entry) return false;
    
    if (this.favorites.has(id)) {
      this.favorites.delete(id);
      entry.character.isFavorite = false;
    } else {
      this.favorites.add(id);
      entry.character.isFavorite = true;
    }
    
    return true;
  }
  
  /**
   * Obtener favoritos
   */
  getFavorites(): CharacterDefinition[] {
    return Array.from(this.favorites)
      .map(id => this.library.get(id)?.character)
      .filter(Boolean) as CharacterDefinition[];
  }
  
  /**
   * Obtener usados recientemente
   */
  getRecent(): CharacterDefinition[] {
    return this.recentUsed
      .map(id => this.library.get(id)?.character)
      .filter(Boolean) as CharacterDefinition[];
  }
  
  // ============================================
  // INSTANCE MANAGEMENT
  // ============================================
  
  /**
   * Crear instancia de personaje
   */
  createInstance(
    characterId: string,
    options?: {
      name?: string;
      position?: Vec3;
      rotation?: Quat;
      scale?: Vec3;
      overrides?: CharacterOverrides;
    }
  ): CharacterInstance | null {
    const character = this.getCharacter(characterId);
    if (!character) return null;
    
    const instance: CharacterInstance = {
      id: generateId(),
      libraryId: characterId,
      name: options?.name || `${character.name} #${this.instances.size + 1}`,
      position: options?.position || { x: 0, y: 0, z: 0 },
      rotation: options?.rotation || { x: 0, y: 0, z: 0, w: 1 },
      scale: options?.scale || { x: 1, y: 1, z: 1 },
      overrides: options?.overrides || {},
      currentPose: character.defaultPose,
      animationTime: 0,
      tags: [...character.tags],
      metadata: {},
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
    
    this.instances.set(instance.id, instance);
    
    // Actualizar uso
    const entry = this.library.get(characterId);
    if (entry) {
      entry.usageCount++;
      entry.lastUsed = new Date();
    }
    
    // Actualizar recientes
    this.addToRecent(characterId);
    
    return instance;
  }
  
  /**
   * Obtener instancia
   */
  getInstance(instanceId: string): CharacterInstance | null {
    return this.instances.get(instanceId) || null;
  }
  
  /**
   * Actualizar instancia
   */
  updateInstance(instanceId: string, updates: Partial<CharacterInstance>): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    
    Object.assign(instance, updates, { modifiedAt: new Date() });
    return true;
  }
  
  /**
   * Eliminar instancia
   */
  removeInstance(instanceId: string): boolean {
    return this.instances.delete(instanceId);
  }
  
  /**
   * Obtener todas las instancias
   */
  getAllInstances(): CharacterInstance[] {
    return Array.from(this.instances.values());
  }
  
  /**
   * Obtener instancias de un personaje
   */
  getInstancesOfCharacter(characterId: string): CharacterInstance[] {
    return Array.from(this.instances.values())
      .filter(i => i.libraryId === characterId);
  }
  
  // ============================================
  // DUPLICATION
  // ============================================
  
  /**
   * Duplicar personaje
   */
  duplicateCharacter(characterId: string, newName?: string): CharacterDefinition | null {
    const original = this.getCharacter(characterId);
    if (!original) return null;
    
    const duplicate: CharacterDefinition = {
      ...original,
      id: generateId(),
      name: newName || `${original.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      isCustom: true,
    };
    
    // Copiar maps
    duplicate.poses = new Map(original.poses);
    duplicate.animations = new Map(original.animations);
    duplicate.defaultOutfit = {
      ...original.defaultOutfit,
      id: generateId(),
      items: new Map(original.defaultOutfit.items),
    };
    
    this.addCharacter(duplicate);
    return duplicate;
  }
  
  // ============================================
  // EXPORT / IMPORT
  // ============================================
  
  /**
   * Exportar personaje
   */
  exportCharacter(characterId: string): string | null {
    const character = this.getCharacter(characterId);
    if (!character) return null;
    
    return JSON.stringify({
      ...character,
      poses: Array.from(character.poses.entries()),
      animations: Array.from(character.animations.entries()),
      defaultOutfit: {
        ...character.defaultOutfit,
        items: Array.from(character.defaultOutfit.items.entries()),
      },
    });
  }
  
  /**
   * Importar personaje
   */
  importCharacter(json: string): CharacterDefinition | null {
    try {
      const data = JSON.parse(json);
      
      const character: CharacterDefinition = {
        ...data,
        id: generateId(),
        poses: new Map(data.poses),
        animations: new Map(data.animations),
        defaultOutfit: {
          ...data.defaultOutfit,
          items: new Map(data.defaultOutfit.items),
        },
        isCustom: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      this.addCharacter(character);
      return character;
    } catch {
      return null;
    }
  }
  
  // ============================================
  // INDEX HELPERS
  // ============================================
  
  private addToCategoryIndex(category: CharacterCategory, id: string): void {
    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    this.categories.get(category)!.push(id);
  }
  
  private removeFromCategoryIndex(category: CharacterCategory, id: string): void {
    const ids = this.categories.get(category);
    if (ids) {
      const idx = ids.indexOf(id);
      if (idx >= 0) ids.splice(idx, 1);
    }
  }
  
  private addToTagIndex(tag: string, id: string): void {
    if (!this.tags.has(tag)) {
      this.tags.set(tag, []);
    }
    this.tags.get(tag)!.push(id);
  }
  
  private removeFromTagIndex(tag: string, id: string): void {
    const ids = this.tags.get(tag);
    if (ids) {
      const idx = ids.indexOf(id);
      if (idx >= 0) ids.splice(idx, 1);
    }
  }
  
  private addToRecent(id: string): void {
    // Remover si ya existe
    const idx = this.recentUsed.indexOf(id);
    if (idx >= 0) this.recentUsed.splice(idx, 1);
    
    // Añadir al inicio
    this.recentUsed.unshift(id);
    
    // Limitar tamaño
    if (this.recentUsed.length > this.maxRecentCount) {
      this.recentUsed.pop();
    }
  }
  
  // ============================================
  // STATISTICS
  // ============================================
  
  /**
   * Obtener estadísticas de la biblioteca
   */
  getStatistics(): {
    totalCharacters: number;
    totalInstances: number;
    byType: Record<CharacterType, number>;
    byCategory: Record<CharacterCategory, number>;
    favorites: number;
    custom: number;
  } {
    const stats = {
      totalCharacters: this.library.size,
      totalInstances: this.instances.size,
      byType: {} as Record<CharacterType, number>,
      byCategory: {} as Record<CharacterCategory, number>,
      favorites: this.favorites.size,
      custom: 0,
    };
    
    for (const entry of this.library.values()) {
      stats.byType[entry.character.type] = (stats.byType[entry.character.type] || 0) + 1;
      stats.byCategory[entry.character.category] = (stats.byCategory[entry.character.category] || 0) + 1;
      if (entry.character.isCustom) stats.custom++;
    }
    
    return stats;
  }
}

// ============================================
// FACTORY
// ============================================

export function createCharacterLibrary(): CharacterLibraryManager {
  return new CharacterLibraryManager();
}

export default CharacterLibraryManager;
