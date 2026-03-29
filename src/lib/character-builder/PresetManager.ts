/**
 * CharacterLibraryBuilder - Preset Manager
 * 
 * Gestiona el guardado y carga de presets de personajes
 */

import { CharacterPreset, PartCategory } from './types';

// ============================================
// PRESET MANAGER
// ============================================

export interface PresetInfo {
  id: string;
  name: string;
  thumbnail?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

export class PresetManager {
  private presets: Map<string, CharacterPreset> = new Map();
  private storageKey = 'nexus_character_presets';

  constructor() {
    this.loadFromStorage();
  }

  // ===== CRUD =====

  /** Save a new preset */
  save(preset: CharacterPreset): void {
    this.presets.set(preset.id, preset);
    this.saveToStorage();
  }

  /** Get preset by ID */
  getById(id: string): CharacterPreset | undefined {
    return this.presets.get(id);
  }

  /** Save a preset (alias for save) */
  savePreset(preset: CharacterPreset): void {
    this.save(preset);
  }

  /** Get all presets as list */
  getAll(): CharacterPreset[] {
    return Array.from(this.presets.values());
  }

  /** Get preset info list */
  getInfoList(): PresetInfo[] {
    return this.getAll().map(preset => ({
      id: preset.id,
      name: preset.name,
      thumbnail: undefined, // Could add thumbnail support
      description: preset.description,
      createdAt: new Date(preset.metadata.createdAt),
      updatedAt: new Date(preset.metadata.updatedAt),
      tags: preset.metadata.tags,
    }));
  }

  /** Update existing preset */
  update(id: string, updates: Partial<CharacterPreset>): boolean {
    const existing = this.presets.get(id);
    if (!existing) return false;

    const updated: CharacterPreset = {
      ...existing,
      ...updates,
      metadata: {
        ...existing.metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    this.presets.set(id, updated);
    this.saveToStorage();
    return true;
  }

  /** Delete preset */
  delete(id: string): boolean {
    if (!this.presets.has(id)) return false;
    this.presets.delete(id);
    this.saveToStorage();
    return true;
  }

  // ===== IMPORT/EXPORT =====

  /** Export preset to JSON string */
  exportToJSON(preset: CharacterPreset): string {
    return JSON.stringify(preset, null, 2);
  }

  /** Import preset from JSON string */
  importFromJSON(json: string): CharacterPreset | null {
    try {
      const preset = JSON.parse(json) as CharacterPreset;
      
      // Validate required fields
      if (!preset.id || !preset.name || !preset.version) {
        console.error('Invalid preset format');
        return null;
      }

      return preset;
    } catch (error) {
      console.error('Failed to parse preset JSON:', error);
      return null;
    }
  }

  /** Import and save preset */
  importAndSave(json: string): CharacterPreset | null {
    const preset = this.importFromJSON(json);
    if (preset) {
      this.save(preset);
    }
    return preset;
  }

  // ===== STORAGE =====

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored) as CharacterPreset[];
        for (const preset of data) {
          this.presets.set(preset.id, preset);
        }
      }
    } catch (error) {
      console.error('Failed to load presets from storage:', error);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = this.getAll();
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save presets to storage:', error);
    }
  }

  // ===== DEMO PRESETS =====

  /** Create demo presets */
  createDemoPresets(): void {
    const demoPresets: CharacterPreset[] = [
      {
        version: '1.0',
        id: 'preset_warrior_01',
        name: 'Guerrero Oscuro',
        description: 'Un guerrero blindado con armadura de placas oscuras',
        baseBodyId: 'male_medium',
        parts: {
          hair: 'hair_short_01',
          torso: 'armor_plate_01',
          shoes: 'boots_armored_01',
          cape: 'cape_basic_01',
        },
        colors: {
          'armor_plate_01': '#2d2d44',
          'cape_basic_01': '#8b0000',
        },
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: ['warrior', 'dark', 'armor'],
        },
      },
      {
        version: '1.0',
        id: 'preset_mage_01',
        name: 'Mago Arcano',
        description: 'Un poderoso hechicero con túnica mística',
        baseBodyId: 'universal',
        parts: {
          hair: 'hair_long_01',
          torso: 'robe_mage_01',
          shoes: 'boots_leather_01',
          accessory: 'crown_royal_01',
        },
        colors: {
          'hair_long_01': '#4a0080',
          'robe_mage_01': '#4a0080',
        },
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: ['mage', 'magic', 'arcane'],
        },
      },
      {
        version: '1.0',
        id: 'preset_rogue_01',
        name: 'Pícaro Sigiloso',
        description: 'Un ágil ladrón con armadura ligera de cuero',
        baseBodyId: 'universal',
        parts: {
          hair: 'hair_short_01',
          torso: 'armor_leather_01',
          shoes: 'boots_leather_01',
        },
        colors: {
          'hair_short_01': '#1a1a1a',
          'armor_leather_01': '#1a1a1a',
          'boots_leather_01': '#1a1a1a',
        },
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: ['rogue', 'stealth', 'assassin'],
        },
      },
    ];

    for (const preset of demoPresets) {
      this.save(preset);
    }
  }

  // ===== STATISTICS =====

  get count(): number {
    return this.presets.size;
  }

  hasPresets(): boolean {
    return this.presets.size > 0;
  }
}

// Singleton instance
export const presetManager = new PresetManager();

// Create demo presets if none exist
if (presetManager.count === 0) {
  presetManager.createDemoPresets();
}
