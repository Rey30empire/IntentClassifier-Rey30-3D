/**
 * Scene System - Main Export
 */

// Types
export * from './types';

// Scene Manager
export { SceneManager, createSceneManager, getSceneManager } from './SceneManager';

// Prefab System
export { PrefabSystem, createPrefabSystem, getPrefabSystem } from './PrefabSystem';

// ============================================
// FACTORY FUNCTION
// ============================================

import { EventBus } from '../core/EventSystem';
import { ECS } from '../ecs/ECS';
import { SceneManager } from './SceneManager';
import { PrefabSystem } from './PrefabSystem';

export interface SceneSystemBundle {
  scene: SceneManager;
  prefab: PrefabSystem;
}

/**
 * Create a complete scene system bundle
 */
export function createSceneSystemBundle(eventBus: EventBus, ecs: ECS): SceneSystemBundle {
  const scene = new SceneManager(eventBus, ecs);
  const prefab = new PrefabSystem(eventBus, scene);

  // Create built-in prefabs
  prefab.createBuiltInPrefabs();

  return {
    scene,
    prefab,
  };
}

// ============================================
// SCENE EVENTS
// ============================================

export const SceneEvents = {
  // Scene lifecycle
  SCENE_CREATED: 'scene:created',
  SCENE_LOADED: 'scene:loaded',
  SCENE_SAVED: 'scene:saved',
  SCENE_CLEARED: 'scene:cleared',
  SCENE_DISPOSED: 'scene:disposed',

  // Node events
  NODE_CREATED: 'scene:node_created',
  NODE_DELETED: 'scene:node_deleted',
  NODE_RENAMED: 'scene:node_renamed',
  NODE_TRANSFORMED: 'scene:node_transformed',
  NODE_REPARENTED: 'scene:node_reparented',
  NODE_SELECTED: 'scene:node_selected',
  NODE_DESELECTED: 'scene:node_deselected',

  // Selection events
  SELECTION_CLEARED: 'scene:selection_cleared',

  // Environment events
  AMBIENT_CHANGED: 'scene:ambient_changed',
  FOG_CHANGED: 'scene:fog_changed',

  // Undo/Redo
  UNDO: 'scene:undo',
  REDO: 'scene:redo',
} as const;

export const PrefabEvents = {
  PREFAB_CREATED: 'prefab:created',
  PREFAB_UPDATED: 'prefab:updated',
  PREFAB_DELETED: 'prefab:deleted',
  PREFAB_INSTANTIATED: 'prefab:instantiated',
  PREFAB_VARIANT_CREATED: 'prefab:variant_created',
  PREFAB_IMPORTED: 'prefab:imported',
  PREFAB_BUILTINS_CREATED: 'prefab:builtins_created',
  PREFAB_DISPOSED: 'prefab:disposed',
} as const;
