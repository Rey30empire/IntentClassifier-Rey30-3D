/**
 * CharacterLibraryBuilder - Character Assembler
 * 
 * Ensambla y gestiona las piezas equipadas en un personaje
 */

import {
  CharacterState,
  EquippedPart,
  PartCategory,
  AssetMetadata,
  BodyType,
} from './types';
import { AssetLibrary } from './AssetLibrary';

// ============================================
// CHARACTER ASSEMBLER
// ============================================

export class CharacterAssembler {
  private state: CharacterState;
  private library: AssetLibrary;
  private onStateChange?: (state: CharacterState) => void;

  constructor(library: AssetLibrary) {
    this.library = library;
    this.state = this.createDefaultState();
  }

  // ===== STATE MANAGEMENT =====

  private createDefaultState(): CharacterState {
    return {
      id: this.generateId(),
      name: 'Nuevo Personaje',
      baseBodyId: 'human_base_v1',
      equippedParts: new Map(),
      colorOverrides: new Map(),
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      },
    };
  }

  private generateId(): string {
    return `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /** Get current character state */
  getState(): CharacterState {
    return { ...this.state };
  }

  /** Set state change callback */
  setOnStateChange(callback: (state: CharacterState) => void): void {
    this.onStateChange = callback;
  }

  private notifyStateChange(): void {
    this.state.metadata.updatedAt = new Date();
    this.onStateChange?.(this.state);
  }

  // ===== BASE BODY =====

  /** Set base body */
  setBaseBody(bodyId: string): void {
    this.state.baseBodyId = bodyId;
    // Could unequip incompatible parts here
    this.notifyStateChange();
  }

  /** Get base body ID */
  getBaseBody(): string {
    return this.state.baseBodyId;
  }

  // ===== EQUIPMENT =====

  /** Equip a part by asset ID */
  equipPart(assetId: string, colorOverride?: string): boolean {
    const asset = this.library.getById(assetId);
    if (!asset) {
      console.warn(`Asset not found: ${assetId}`);
      return false;
    }

    return this.equipPartDirect(asset, colorOverride);
  }

  /** Equip a part with asset metadata */
  equipPartDirect(asset: AssetMetadata, colorOverride?: string): boolean {
    // Check if there's already a part in this category
    const existing = this.state.equippedParts.get(asset.category);
    
    // Create equipped part
    const equipped: EquippedPart = {
      assetId: asset.id,
      category: asset.category,
      colorOverride: colorOverride,
    };

    // Equip the part
    this.state.equippedParts.set(asset.category, equipped);
    
    // Set default color if available
    if (!colorOverride && asset.colorOptions && asset.colorOptions.length > 0) {
      const defaultColor = asset.colorOptions[0].hex;
      this.state.colorOverrides.set(asset.id, defaultColor);
    }

    this.notifyStateChange();
    return true;
  }

  /** Unequip a part by category */
  unequipPart(category: PartCategory): boolean {
    const part = this.state.equippedParts.get(category);
    if (!part) return false;

    // Remove color override
    this.state.colorOverrides.delete(part.assetId);
    
    // Remove equipped part
    this.state.equippedParts.delete(category);
    
    this.notifyStateChange();
    return true;
  }

  /** Unequip all parts */
  unequipAll(): void {
    this.state.equippedParts.clear();
    this.state.colorOverrides.clear();
    this.notifyStateChange();
  }

  /** Get equipped part by category */
  getEquippedPart(category: PartCategory): EquippedPart | undefined {
    return this.state.equippedParts.get(category);
  }

  /** Get all equipped parts */
  getAllEquipped(): Map<PartCategory, EquippedPart> {
    return new Map(this.state.equippedParts);
  }

  /** Check if category has equipped part */
  hasEquippedPart(category: PartCategory): boolean {
    return this.state.equippedParts.has(category);
  }

  // ===== COLORS =====

  /** Set color override for a part */
  setColorOverride(assetId: string, color: string): void {
    this.state.colorOverrides.set(assetId, color);
    this.notifyStateChange();
  }

  /** Remove color override */
  removeColorOverride(assetId: string): void {
    this.state.colorOverrides.delete(assetId);
    this.notifyStateChange();
  }

  /** Get color override */
  getColorOverride(assetId: string): string | undefined {
    return this.state.colorOverrides.get(assetId);
  }

  // ===== RANDOM EQUIPMENT =====

  /** Equip random parts for all categories */
  randomize(): void {
    const categories: PartCategory[] = ['hair', 'torso', 'shoes', 'accessory'];
    
    for (const category of categories) {
      const assets = this.library.getByCategory(category);
      if (assets.length > 0) {
        const randomAsset = assets[Math.floor(Math.random() * assets.length)];
        this.equipPartDirect(randomAsset);
      }
    }
    
    this.notifyStateChange();
  }

  /** Equip random part for specific category */
  randomizeCategory(category: PartCategory): void {
    const assets = this.library.getByCategory(category);
    if (assets.length > 0) {
      const randomAsset = assets[Math.floor(Math.random() * assets.length)];
      this.equipPartDirect(randomAsset);
    }
  }

  // ===== SERIALIZATION =====

  /** Export to preset JSON */
  exportPreset(): object {
    const parts: Record<string, string> = {};
    const colors: Record<string, string> = {};

    this.state.equippedParts.forEach((part, category) => {
      parts[category] = part.assetId;
    });

    this.state.colorOverrides.forEach((color, assetId) => {
      colors[assetId] = color;
    });

    return {
      version: '1.0',
      id: this.state.id,
      name: this.state.name,
      baseBodyId: this.state.baseBodyId,
      parts,
      colors,
      metadata: {
        createdAt: this.state.metadata.createdAt.toISOString(),
        updatedAt: this.state.metadata.updatedAt.toISOString(),
        tags: this.state.metadata.tags,
      },
    };
  }

  /** Import from preset JSON */
  importPreset(preset: {
    baseBodyId?: string;
    parts?: Record<string, string>;
    colors?: Record<string, string>;
    name?: string;
  }): boolean {
    try {
      // Set base body
      if (preset.baseBodyId) {
        this.state.baseBodyId = preset.baseBodyId;
      }

      // Set name
      if (preset.name) {
        this.state.name = preset.name;
      }

      // Clear current equipment
      this.state.equippedParts.clear();
      this.state.colorOverrides.clear();

      // Equip parts
      if (preset.parts) {
        for (const [category, assetId] of Object.entries(preset.parts)) {
          this.equipPart(assetId);
        }
      }

      // Set colors
      if (preset.colors) {
        for (const [assetId, color] of Object.entries(preset.colors)) {
          this.state.colorOverrides.set(assetId, color);
        }
      }

      this.notifyStateChange();
      return true;
    } catch (error) {
      console.error('Failed to import preset:', error);
      return false;
    }
  }

  // ===== RESET =====

  /** Reset to default state */
  reset(): void {
    this.state = this.createDefaultState();
    this.notifyStateChange();
  }

  // ===== STATISTICS =====

  /** Get total equipped count */
  get equippedCount(): number {
    return this.state.equippedParts.size;
  }

  /** Check if character has any equipment */
  get hasEquipment(): boolean {
    return this.state.equippedParts.size > 0;
  }
}

// ============================================
// COMPATIBILITY VALIDATOR
// ============================================

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  validate: (asset: AssetMetadata, context: ValidationContext) => boolean;
  getReason?: (asset: AssetMetadata, context: ValidationContext) => string;
}

export interface ValidationContext {
  baseBodyId: string;
  bodyType: BodyType;
  skeletonId: string;
  equippedParts: Map<PartCategory, EquippedPart>;
}

export interface DetailedValidationResult {
  compatible: boolean;
  passed: string[];
  failed: string[];
  warnings: string[];
  canForceEquip: boolean;
}

export class CompatibilityValidator {
  private rules: ValidationRule[] = [];
  private defaultBodyType: BodyType = 'universal';

  constructor() {
    this.registerDefaultRules();
  }

  private registerDefaultRules(): void {
    // Rule: Skeleton compatibility
    this.rules.push({
      id: 'skeleton_match',
      name: 'Skeleton Match',
      description: 'Asset must be compatible with character skeleton',
      validate: (asset, context) => {
        return asset.skeletonId === context.skeletonId;
      },
      getReason: (asset, context) => 
        `Skeleton mismatch: asset uses "${asset.skeletonId}" but character uses "${context.skeletonId}"`,
    });

    // Rule: Body type compatibility
    this.rules.push({
      id: 'body_type_match',
      name: 'Body Type Match',
      description: 'Asset must fit character body type',
      validate: (asset, context) => {
        return asset.bodyTypes.includes(context.bodyType) || 
               asset.bodyTypes.includes('universal');
      },
      getReason: (asset, context) => 
        `Body type mismatch: asset supports [${asset.bodyTypes.join(', ')}] but character is "${context.bodyType}"`,
    });

    // Rule: Socket compatibility (soft rule)
    this.rules.push({
      id: 'socket_available',
      name: 'Socket Available',
      description: 'Socket must be available on character',
      validate: () => true, // Assume sockets exist for now
    });
  }

  /** Add custom validation rule */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  /** Remove rule by ID */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  /** Validate single asset */
  validate(
    asset: AssetMetadata,
    context: ValidationContext
  ): DetailedValidationResult {
    const result: DetailedValidationResult = {
      compatible: true,
      passed: [],
      failed: [],
      warnings: [],
      canForceEquip: false,
    };

    for (const rule of this.rules) {
      const passed = rule.validate(asset, context);
      
      if (passed) {
        result.passed.push(rule.id);
      } else {
        result.failed.push(rule.id);
        result.compatible = false;
        
        if (rule.getReason) {
          result.warnings.push(rule.getReason(asset, context));
        }
      }
    }

    // Some failures can be forced (e.g., body type mismatch with scaling)
    result.canForceEquip = result.failed.length === 0 || 
                           result.failed.includes('body_type_match');

    return result;
  }

  /** Quick compatibility check */
  isCompatible(asset: AssetMetadata, context: ValidationContext): boolean {
    return this.validate(asset, context).compatible;
  }

  /** Get validation context from state */
  createContext(
    baseBodyId: string,
    equippedParts: Map<PartCategory, EquippedPart>
  ): ValidationContext {
    return {
      baseBodyId,
      bodyType: this.defaultBodyType,
      skeletonId: 'human_base_v1',
      equippedParts,
    };
  }

  /** Set default body type for validation */
  setDefaultBodyType(bodyType: BodyType): void {
    this.defaultBodyType = bodyType;
  }
}

// ============================================
// SINGLETON INSTANCES (Lazy Initialization)
// ============================================

let _characterAssembler: CharacterAssembler | null = null;
let _compatibilityValidator: CompatibilityValidator | null = null;

/** Initialize the CharacterAssembler singleton with an AssetLibrary */
export function initializeCharacterAssembler(library: AssetLibrary): CharacterAssembler {
  _characterAssembler = new CharacterAssembler(library);
  return _characterAssembler;
}

/** Get the CharacterAssembler singleton */
export function getCharacterAssembler(): CharacterAssembler {
  if (!_characterAssembler) {
    throw new Error('CharacterAssembler not initialized. Call initializeCharacterAssembler first.');
  }
  return _characterAssembler;
}

/** Get the CompatibilityValidator singleton */
export function getCompatibilityValidator(): CompatibilityValidator {
  if (!_compatibilityValidator) {
    _compatibilityValidator = new CompatibilityValidator();
  }
  return _compatibilityValidator;
}

// For backward compatibility - these will throw if not initialized
export const characterAssembler = {
  get instance() { return getCharacterAssembler(); }
};
export const compatibilityValidator = {
  get instance() { return getCompatibilityValidator(); }
};
