/**
 * CharacterLibraryBuilder - Main Export
 */

// Types
export * from './types';

// Core - Order matters for initialization
export { AssetLibrary, assetLibrary, DemoAssets } from './AssetLibrary';
export { 
  CharacterAssembler,
  CompatibilityValidator,
  initializeCharacterAssembler,
  getCharacterAssembler,
  getCompatibilityValidator,
  characterAssembler,
  compatibilityValidator,
} from './CharacterAssembler';
export type { 
  ValidationRule, 
  ValidationContext, 
  DetailedValidationResult 
} from './CharacterAssembler';

// Preset Manager
export { PresetManager, presetManager } from './PresetManager';
export type { PresetInfo } from './PresetManager';

// Drag & Drop Controller
export { 
  DragDropController, 
  getDragDropController, 
  createDragDropController 
} from './DragDropController';

// Auto-initialize CharacterAssembler with AssetLibrary
import { assetLibrary } from './AssetLibrary';
import { initializeCharacterAssembler } from './CharacterAssembler';

// Initialize on module load
initializeCharacterAssembler(assetLibrary);
