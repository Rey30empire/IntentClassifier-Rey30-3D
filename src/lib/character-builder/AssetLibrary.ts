/**
 * CharacterLibraryBuilder - Asset Library
 * 
 * Gestiona la biblioteca de assets modulares para personajes
 */

import { 
  AssetMetadata, 
  PartCategory, 
  AssetFilters,
  BodyType
} from './types';

// ============================================
// ASSET LIBRARY
// ============================================

export class AssetLibrary {
  private assets: Map<string, AssetMetadata> = new Map();
  private byCategory: Map<PartCategory, Set<string>> = new Map();
  private byBodyType: Map<BodyType, Set<string>> = new Map();
  private isLoaded: boolean = false;

  constructor() {
    // Initialize category maps
    const categories: PartCategory[] = [
      'body', 'head', 'hair', 'torso', 'arms', 'legs', 'shoes',
      'outfit', 'accessory', 'helmet', 'gloves', 'cape', 'shoulder',
      'weapon', 'back_item', 'face_accessory', 'wings', 'tail'
    ];
    
    for (const category of categories) {
      this.byCategory.set(category, new Set());
    }
    
    const bodyTypes: BodyType[] = [
      'male_small', 'male_medium', 'male_large',
      'female_small', 'female_medium', 'female_large',
      'universal'
    ];
    
    for (const bodyType of bodyTypes) {
      this.byBodyType.set(bodyType, new Set());
    }
  }

  // ===== LOADING =====

  /** Load library from metadata array */
  loadFromMetadata(assets: AssetMetadata[]): void {
    this.clear();
    
    for (const asset of assets) {
      this.registerAsset(asset);
    }
    
    this.isLoaded = true;
  }

  /** Register a single asset */
  registerAsset(asset: AssetMetadata): void {
    if (!asset.enabled) return;
    
    this.assets.set(asset.id, asset);
    
    // Index by category
    const categorySet = this.byCategory.get(asset.category);
    if (categorySet) {
      categorySet.add(asset.id);
    }
    
    // Index by body types
    for (const bodyType of asset.bodyTypes) {
      const bodyTypeSet = this.byBodyType.get(bodyType);
      if (bodyTypeSet) {
        bodyTypeSet.add(asset.id);
      }
    }
  }

  /** Remove an asset */
  unregisterAsset(assetId: string): void {
    const asset = this.assets.get(assetId);
    if (!asset) return;
    
    // Remove from category index
    const categorySet = this.byCategory.get(asset.category);
    if (categorySet) {
      categorySet.delete(assetId);
    }
    
    // Remove from body type indexes
    for (const bodyType of asset.bodyTypes) {
      const bodyTypeSet = this.byBodyType.get(bodyType);
      if (bodyTypeSet) {
        bodyTypeSet.delete(assetId);
      }
    }
    
    this.assets.delete(assetId);
  }

  /** Clear all assets */
  clear(): void {
    this.assets.clear();
    
    for (const [, set] of this.byCategory) {
      set.clear();
    }
    
    for (const [, set] of this.byBodyType) {
      set.clear();
    }
    
    this.isLoaded = false;
  }

  // ===== QUERIES =====

  /** Get asset by ID */
  getById(assetId: string): AssetMetadata | undefined {
    return this.assets.get(assetId);
  }

  /** Get all assets in a category */
  getByCategory(category: PartCategory): AssetMetadata[] {
    const ids = this.byCategory.get(category);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.assets.get(id))
      .filter((a): a is AssetMetadata => a !== undefined);
  }

  /** Get assets compatible with body type */
  getByBodyType(bodyType: BodyType): AssetMetadata[] {
    const ids = this.byBodyType.get(bodyType);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.assets.get(id))
      .filter((a): a is AssetMetadata => a !== undefined);
  }

  /** Search with filters */
  search(filters: AssetFilters): AssetMetadata[] {
    let results = Array.from(this.assets.values());
    
    // Filter by category
    if (filters.category) {
      results = results.filter(a => a.category === filters.category);
    }
    
    // Filter by body type
    if (filters.bodyType) {
      results = results.filter(a => 
        a.bodyTypes.includes(filters.bodyType!) || 
        a.bodyTypes.includes('universal')
      );
    }
    
    // Filter by skeleton
    if (filters.skeletonId) {
      results = results.filter(a => a.skeletonId === filters.skeletonId);
    }
    
    // Filter by rarity
    if (filters.rarity) {
      results = results.filter(a => a.rarity === filters.rarity);
    }
    
    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(a => 
        filters.tags!.some(tag => a.tags.includes(tag))
      );
    }
    
    // Filter by gender style
    if (filters.genderStyle) {
      results = results.filter(a => 
        a.genderStyle === filters.genderStyle || 
        a.genderStyle === 'unisex' || 
        !a.genderStyle
      );
    }
    
    // Filter by race type
    if (filters.raceType) {
      results = results.filter(a => 
        a.raceType === filters.raceType || 
        !a.raceType
      );
    }
    
    // Filter by search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      results = results.filter(a => 
        a.name.toLowerCase().includes(term) ||
        a.description?.toLowerCase().includes(term) ||
        a.tags.some(t => t.toLowerCase().includes(term))
      );
    }
    
    return results;
  }

  /** Get all assets */
  getAll(): AssetMetadata[] {
    return Array.from(this.assets.values());
  }

  // ===== STATISTICS =====

  /** Get total asset count */
  get count(): number {
    return this.assets.size;
  }

  /** Get count by category */
  getCountByCategory(category: PartCategory): number {
    return this.byCategory.get(category)?.size ?? 0;
  }

  /** Check if library is loaded */
  get loaded(): boolean {
    return this.isLoaded;
  }

  /** Get available categories with assets */
  getAvailableCategories(): PartCategory[] {
    const result: PartCategory[] = [];
    
    for (const [category, ids] of this.byCategory) {
      if (ids.size > 0) {
        result.push(category);
      }
    }
    
    return result;
  }
}

// ============================================
// DEMO DATA
// ============================================

/** Demo assets for testing */
export const DemoAssets: AssetMetadata[] = [
  // Hair
  {
    id: 'hair_short_01',
    name: 'Cabello Corto',
    category: 'hair',
    tags: ['casual', 'modern'],
    modelPath: '/assets/characters/parts/hair/hair_short_01.glb',
    thumbnailPath: '/assets/characters/thumbnails/hair_short_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['male_medium', 'female_medium', 'universal'],
    attachmentSocket: 'hair_socket',
    enabled: true,
    rarity: 'common',
    colorOptions: [
      { id: 'black', name: 'Negro', hex: '#1a1a1a' },
      { id: 'brown', name: 'Castaño', hex: '#4a3728' },
      { id: 'blonde', name: 'Rubio', hex: '#d4a84b' },
      { id: 'red', name: 'Rojo', hex: '#8b2500' },
    ],
  },
  {
    id: 'hair_long_01',
    name: 'Cabello Largo',
    category: 'hair',
    tags: ['fantasy', 'feminine'],
    modelPath: '/assets/characters/parts/hair/hair_long_01.glb',
    thumbnailPath: '/assets/characters/thumbnails/hair_long_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['female_medium', 'female_small', 'universal'],
    attachmentSocket: 'hair_socket',
    enabled: true,
    rarity: 'common',
    genderStyle: 'feminine',
    colorOptions: [
      { id: 'black', name: 'Negro', hex: '#1a1a1a' },
      { id: 'brown', name: 'Castaño', hex: '#4a3728' },
      { id: 'blonde', name: 'Rubio', hex: '#d4a84b' },
      { id: 'white', name: 'Blanco', hex: '#e8e8e8' },
    ],
  },
  
  // Head
  {
    id: 'head_male_01',
    name: 'Cabeza Masculina 01',
    category: 'head',
    tags: ['human', 'male'],
    modelPath: '/assets/characters/parts/head/head_male_01.glb',
    thumbnailPath: '/assets/characters/thumbnails/head_male_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['male_small', 'male_medium', 'male_large'],
    attachmentSocket: 'head_socket',
    enabled: true,
    rarity: 'common',
    genderStyle: 'masculine',
  },
  {
    id: 'head_female_01',
    name: 'Cabeza Femenina 01',
    category: 'head',
    tags: ['human', 'female'],
    modelPath: '/assets/characters/parts/head/head_female_01.glb',
    thumbnailPath: '/assets/characters/thumbnails/head_female_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['female_small', 'female_medium', 'female_large'],
    attachmentSocket: 'head_socket',
    enabled: true,
    rarity: 'common',
    genderStyle: 'feminine',
  },
  
  // Torso / Armor
  {
    id: 'armor_leather_01',
    name: 'Armadura de Cuero',
    category: 'torso',
    tags: ['armor', 'rogue', 'light'],
    modelPath: '/assets/characters/parts/torso/armor_leather_01.glb',
    thumbnailPath: '/assets/characters/thumbnails/armor_leather_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['male_medium', 'female_medium', 'universal'],
    attachmentSocket: 'torso_socket',
    enabled: true,
    rarity: 'uncommon',
    colorOptions: [
      { id: 'brown', name: 'Marrón', hex: '#5c4033' },
      { id: 'black', name: 'Negro', hex: '#1a1a1a' },
    ],
  },
  {
    id: 'armor_plate_01',
    name: 'Armadura de Placas',
    category: 'torso',
    tags: ['armor', 'warrior', 'heavy'],
    modelPath: '/assets/characters/parts/torso/armor_plate_01.glb',
    thumbnailPath: '/assets/characters/thumbnails/armor_plate_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['male_medium', 'male_large', 'female_medium'],
    attachmentSocket: 'torso_socket',
    enabled: true,
    rarity: 'rare',
    colorOptions: [
      { id: 'steel', name: 'Acero', hex: '#708090' },
      { id: 'gold', name: 'Dorado', hex: '#b8860b' },
    ],
  },
  {
    id: 'robe_mage_01',
    name: 'Túnica de Mago',
    category: 'torso',
    tags: ['armor', 'mage', 'cloth'],
    modelPath: '/assets/characters/parts/torso/robe_mage_01.glb',
    thumbnailPath: '/assets/characters/thumbnails/robe_mage_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['universal'],
    attachmentSocket: 'torso_socket',
    enabled: true,
    rarity: 'uncommon',
    colorOptions: [
      { id: 'blue', name: 'Azul', hex: '#1e3a5f' },
      { id: 'purple', name: 'Púrpura', hex: '#4a0080' },
      { id: 'red', name: 'Rojo', hex: '#8b0000' },
    ],
  },
  
  // Shoes / Boots
  {
    id: 'boots_leather_01',
    name: 'Botas de Cuero',
    category: 'shoes',
    tags: ['casual', 'travel'],
    modelPath: '/assets/characters/parts/shoes/boots_leather_01.glb',
    thumbnailPath: '/assets/characters/thumbnails/boots_leather_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['universal'],
    attachmentSocket: 'feet_socket',
    enabled: true,
    rarity: 'common',
    colorOptions: [
      { id: 'brown', name: 'Marrón', hex: '#5c4033' },
      { id: 'black', name: 'Negro', hex: '#1a1a1a' },
    ],
  },
  {
    id: 'boots_armored_01',
    name: 'Botas Blindadas',
    category: 'shoes',
    tags: ['armor', 'warrior'],
    modelPath: '/assets/characters/parts/shoes/boots_armored_01.glb',
    thumbnailPath: '/assets/characters/thumbnails/boots_armored_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['male_medium', 'male_large', 'female_medium'],
    attachmentSocket: 'feet_socket',
    enabled: true,
    rarity: 'rare',
  },
  
  // Accessories
  {
    id: 'cape_basic_01',
    name: 'Capa Básica',
    category: 'cape',
    tags: ['accessory', 'travel'],
    modelPath: '/assets/characters/parts/cape/cape_basic_01.glb',
    thumbnailPath: '/assets/characters/thumbnails/cape_basic_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['universal'],
    attachmentSocket: 'back_socket',
    enabled: true,
    rarity: 'common',
    colorOptions: [
      { id: 'red', name: 'Rojo', hex: '#8b0000' },
      { id: 'blue', name: 'Azul', hex: '#1e3a5f' },
      { id: 'black', name: 'Negro', hex: '#1a1a1a' },
    ],
  },
  {
    id: 'crown_royal_01',
    name: 'Corona Real',
    category: 'accessory',
    tags: ['accessory', 'royal', 'rare'],
    modelPath: '/assets/characters/parts/accessory/crown_royal_01.glb',
    thumbnailPath: '/assets/characters/thumbnails/crown_royal_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['universal'],
    attachmentSocket: 'head_socket',
    enabled: true,
    rarity: 'legendary',
  },
];

// Singleton instance
export const assetLibrary = new AssetLibrary();

// Load demo data
assetLibrary.loadFromMetadata(DemoAssets);
