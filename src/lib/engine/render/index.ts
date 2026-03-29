/**
 * Render System - Main Export
 */

// Types
export * from './types';

// Core Systems
export { RenderSystem, createRenderSystem, getRenderSystem } from './RenderSystem';
export { CameraSystem, createCameraSystem, getCameraSystem } from './CameraSystem';
export { LightingSystem, createLightingSystem, getLightingSystem } from './LightingSystem';
export { MaterialSystem, createMaterialSystem, getMaterialSystem } from './MaterialSystem';

// Advanced Systems
export * from './advanced';

// ============================================
// FACTORY FUNCTION
// ============================================

import { EventBus } from '../core/EventSystem';
import { RenderSystem } from './RenderSystem';
import { CameraSystem } from './CameraSystem';
import { LightingSystem } from './LightingSystem';
import { MaterialSystem } from './MaterialSystem';
import { PostProcessingManager } from './advanced/PostProcessingSystem';
import { ShaderManager } from './advanced/ShaderSystem';
import type { RenderSystemConfig } from './types';

export interface RenderSystemBundle {
  render: RenderSystem;
  camera: CameraSystem;
  lighting: LightingSystem;
  material: MaterialSystem;
  postProcessing: PostProcessingManager;
  shaders: ShaderManager;
}

/**
 * Create a complete render system bundle
 */
export function createRenderSystemBundle(
  eventBus: EventBus,
  renderConfig?: Partial<RenderSystemConfig>
): RenderSystemBundle {
  const render = new RenderSystem(eventBus, renderConfig);
  const camera = new CameraSystem(eventBus);
  const lighting = new LightingSystem(eventBus);
  const material = new MaterialSystem(eventBus);
  const postProcessing = new PostProcessingManager();
  const shaders = new ShaderManager();

  // Create preset materials
  material.createPresets();

  return {
    render,
    camera,
    lighting,
    material,
    postProcessing,
    shaders,
  };
}

// ============================================
// RENDER EVENTS
// ============================================

export const RenderEvents = {
  // Renderer events
  RENDER_INITIALIZED: 'render:initialized',
  RENDER_CONFIG_UPDATED: 'render:config_updated',
  RENDER_RESIZED: 'render:resized',
  RENDER_DISPOSED: 'render:disposed',

  // Camera events
  CAMERA_CREATED: 'camera:created',
  CAMERA_ACTIVATED: 'camera:activated',
  CAMERA_REMOVED: 'camera:removed',
  CAMERA_MODE_CHANGED: 'camera:mode_changed',
  CAMERA_FOCUSED: 'camera:focused',
  CAMERA_RESIZED: 'camera:resized',
  CAMERA_DISPOSED: 'camera:disposed',

  // Lighting events
  LIGHTING_DEFAULTS_CREATED: 'lighting:defaults_created',
  LIGHTING_CREATED: 'lighting:created',
  LIGHTING_REMOVED: 'lighting:removed',
  LIGHTING_UPDATED: 'lighting:updated',
  LIGHTING_PRESET_APPLIED: 'lighting:preset_applied',
  LIGHTING_DISPOSED: 'lighting:disposed',

  // Material events
  MATERIAL_CREATED: 'material:created',
  MATERIAL_CLONED: 'material:cloned',
  MATERIAL_UPDATED: 'material:updated',
  MATERIAL_DISPOSED: 'material:disposed',
  MATERIAL_PRESETS_CREATED: 'material:presets_created',
  MATERIAL_DISPOSED_ALL: 'material:disposed_all',
} as const;
