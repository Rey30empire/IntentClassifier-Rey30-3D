/**
 * Lighting System
 * 
 * Manages dynamic lights in the scene including:
 * - Ambient, Directional, Point, Spot, Hemisphere lights
 * - Shadow configuration
 * - Light presets
 */

import * as THREE from 'three';
import { EventBus } from '../core/EventSystem';
import {
  LightConfig,
  LightType,
  ShadowConfig,
  DefaultShadowConfig,
  DefaultLightConfigs,
} from './types';

// ============================================
// LIGHTING SYSTEM
// ============================================

export class LightingSystem {
  private lights: Map<string, THREE.Light> = new Map();
  private scene: THREE.Scene | null = null;
  private eventBus: EventBus;
  private defaultLights: string[] = [];

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  private toThreeColor(color: LightConfig['color'] | undefined): THREE.Color {
    if (color instanceof THREE.Color) {
      return color.clone();
    }

    return new THREE.Color(color?.r ?? 1, color?.g ?? 1, color?.b ?? 1);
  }

  private isShadowCapableLight(
    light: THREE.Light
  ): light is THREE.DirectionalLight | THREE.PointLight | THREE.SpotLight {
    return (
      light instanceof THREE.DirectionalLight ||
      light instanceof THREE.PointLight ||
      light instanceof THREE.SpotLight
    );
  }

  private isTargetedLight(light: THREE.Light): light is THREE.DirectionalLight | THREE.SpotLight {
    return light instanceof THREE.DirectionalLight || light instanceof THREE.SpotLight;
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Set the scene to add lights to
   */
  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  /**
   * Create default lighting setup
   */
  createDefaultLighting(): void {
    // Clear existing default lights
    this.clearDefaultLights();

    // Ambient light
    const ambientId = this.createLight('default_ambient', {
      type: 'ambient',
      color: new THREE.Color(0.4, 0.4, 0.4),
      intensity: 0.4,
    });
    this.defaultLights.push(ambientId);

    // Directional light (sun)
    const directionalId = this.createLight('default_directional', {
      type: 'directional',
      color: new THREE.Color(1, 1, 0.95),
      intensity: 1.0,
      position: { x: 10, y: 15, z: 10 },
      castShadow: true,
      shadow: {
        enabled: true,
        mapSize: 2048,
        bias: -0.0001,
        normalBias: 0.02,
        radius: 4,
        cameraNear: 0.1,
        cameraFar: 50,
        cameraLeft: -20,
        cameraRight: 20,
        cameraTop: 20,
        cameraBottom: -20,
      },
    });
    this.defaultLights.push(directionalId);

    // Hemisphere light for ambient
    const hemiId = this.createLight('default_hemisphere', {
      type: 'hemisphere',
      color: new THREE.Color(0.6, 0.6, 0.8),
      groundColor: new THREE.Color(0.3, 0.25, 0.2),
      intensity: 0.3,
    });
    this.defaultLights.push(hemiId);

    this.eventBus.emit('lighting:defaults_created', { ids: this.defaultLights });
  }

  /**
   * Clear default lights
   */
  clearDefaultLights(): void {
    for (const id of this.defaultLights) {
      this.removeLight(id);
    }
    this.defaultLights = [];
  }

  // ============================================
  // LIGHT CREATION
  // ============================================

  /**
   * Create a new light
   */
  createLight(id: string, config: Partial<LightConfig>): string {
    if (this.lights.has(id)) {
      console.warn(`[LightingSystem] Light already exists: ${id}`);
      return id;
    }

    const defaultConfig = DefaultLightConfigs[config.type || 'directional'];
    const fullConfig: LightConfig = { ...defaultConfig, ...config, id };

    let light: THREE.Light;

    switch (fullConfig.type) {
      case 'ambient':
        light = new THREE.AmbientLight(this.toThreeColor(fullConfig.color), fullConfig.intensity);
        break;

      case 'directional':
        light = this.createDirectionalLight(fullConfig);
        break;

      case 'point':
        light = this.createPointLight(fullConfig);
        break;

      case 'spot':
        light = this.createSpotLight(fullConfig);
        break;

      case 'hemisphere':
        light = this.createHemisphereLight(fullConfig);
        break;

      default:
        light = new THREE.AmbientLight(this.toThreeColor(fullConfig.color), fullConfig.intensity);
    }

    // Set position if applicable
    if (fullConfig.position && 'position' in light) {
      light.position.set(
        fullConfig.position.x,
        fullConfig.position.y,
        fullConfig.position.z
      );
    }

    // Store light
    this.lights.set(id, light);

    // Add to scene
    if (this.scene) {
      this.scene.add(light);
    }

    this.eventBus.emit('lighting:created', { id, config: fullConfig });

    return id;
  }

  private createDirectionalLight(config: LightConfig): THREE.DirectionalLight {
    const light = new THREE.DirectionalLight(this.toThreeColor(config.color), config.intensity);

    // Configure shadows
    if (config.castShadow && config.shadow) {
      light.castShadow = true;
      light.shadow.mapSize.width = config.shadow.mapSize;
      light.shadow.mapSize.height = config.shadow.mapSize;
      light.shadow.bias = config.shadow.bias;
      light.shadow.normalBias = config.shadow.normalBias;
      light.shadow.radius = config.shadow.radius;

      if (config.shadow.cameraLeft !== undefined) {
        light.shadow.camera.left = config.shadow.cameraLeft;
        light.shadow.camera.right = config.shadow.cameraRight!;
        light.shadow.camera.top = config.shadow.cameraTop!;
        light.shadow.camera.bottom = config.shadow.cameraBottom!;
      }
    }

    // Set target if provided
    if (config.target) {
      light.target.position.set(
        config.target.x,
        config.target.y,
        config.target.z
      );
    }

    return light;
  }

  private createPointLight(config: LightConfig): THREE.PointLight {
    const light = new THREE.PointLight(
      this.toThreeColor(config.color),
      config.intensity,
      config.distance || 0,
      config.decay || 2
    );

    if (config.castShadow && config.shadow) {
      light.castShadow = true;
      light.shadow.mapSize.width = config.shadow.mapSize;
      light.shadow.mapSize.height = config.shadow.mapSize;
      light.shadow.bias = config.shadow.bias;
      light.shadow.radius = config.shadow.radius;
    }

    return light;
  }

  private createSpotLight(config: LightConfig): THREE.SpotLight {
    const light = new THREE.SpotLight(
      this.toThreeColor(config.color),
      config.intensity,
      config.distance || 0,
      config.angle || Math.PI / 6,
      config.penumbra || 0.5,
      config.decay || 2
    );

    if (config.castShadow && config.shadow) {
      light.castShadow = true;
      light.shadow.mapSize.width = config.shadow.mapSize;
      light.shadow.mapSize.height = config.shadow.mapSize;
      light.shadow.bias = config.shadow.bias;
      light.shadow.radius = config.shadow.radius;
    }

    if (config.target) {
      light.target.position.set(
        config.target.x,
        config.target.y,
        config.target.z
      );
    }

    return light;
  }

  private createHemisphereLight(config: LightConfig): THREE.HemisphereLight {
    return new THREE.HemisphereLight(
      this.toThreeColor(config.color),
      this.toThreeColor(config.groundColor ?? { r: 0.3, g: 0.3, b: 0.3 }),
      config.intensity
    );
  }

  // ============================================
  // LIGHT MANAGEMENT
  // ============================================

  /**
   * Get a light by ID
   */
  getLight(id: string): THREE.Light | undefined {
    return this.lights.get(id);
  }

  /**
   * Remove a light
   */
  removeLight(id: string): void {
    const light = this.lights.get(id);
    if (!light) return;

    // Remove from scene
    if (this.scene) {
      this.scene.remove(light);
    }

    // Dispose shadow map if exists
    if (this.isShadowCapableLight(light) && light.shadow.map) {
      light.shadow.map.dispose();
    }

    // Dispose light
    light.dispose();

    this.lights.delete(id);
    this.eventBus.emit('lighting:removed', { id });
  }

  /**
   * Update a light's properties
   */
  updateLight(id: string, updates: Partial<LightConfig>): void {
    const light = this.lights.get(id);
    if (!light) return;

    // Update color
    if (updates.color) {
      light.color.copy(this.toThreeColor(updates.color));
    }

    // Update intensity
    if (updates.intensity !== undefined) {
      light.intensity = updates.intensity;
    }

    // Update position
    if (updates.position && 'position' in light) {
      light.position.set(
        updates.position.x,
        updates.position.y,
        updates.position.z
      );
    }

    // Update target
    if (updates.target && this.isTargetedLight(light)) {
      light.target.position.set(
        updates.target.x,
        updates.target.y,
        updates.target.z
      );
    }

    // Update shadow
    if (updates.castShadow !== undefined && 'castShadow' in light) {
      light.castShadow = updates.castShadow;
    }

    this.eventBus.emit('lighting:updated', { id, updates });
  }

  /**
   * Get all lights
   */
  getAllLights(): Map<string, THREE.Light> {
    return new Map(this.lights);
  }

  /**
   * Get lights by type
   */
  getLightsByType(type: LightType): THREE.Light[] {
    const result: THREE.Light[] = [];
    
    this.lights.forEach((light) => {
      if (this.isLightOfType(light, type)) {
        result.push(light);
      }
    });

    return result;
  }

  private isLightOfType(light: THREE.Light, type: LightType): boolean {
    switch (type) {
      case 'ambient':
        return light instanceof THREE.AmbientLight;
      case 'directional':
        return light instanceof THREE.DirectionalLight;
      case 'point':
        return light instanceof THREE.PointLight;
      case 'spot':
        return light instanceof THREE.SpotLight;
      case 'hemisphere':
        return light instanceof THREE.HemisphereLight;
      default:
        return false;
    }
  }

  // ============================================
  // LIGHT PRESETS
  // ============================================

  /**
   * Apply a lighting preset
   */
  applyPreset(preset: 'day' | 'night' | 'sunset' | 'studio' | 'outdoor'): void {
    this.clearDefaultLights();

    switch (preset) {
      case 'day':
        this.createLight('preset_ambient', {
          type: 'ambient',
          color: new THREE.Color(0.5, 0.5, 0.5),
          intensity: 0.3,
        });
        this.createLight('preset_sun', {
          type: 'directional',
          color: new THREE.Color(1, 0.95, 0.9),
          intensity: 1.2,
          position: { x: 10, y: 20, z: 10 },
          castShadow: true,
        });
        break;

      case 'night':
        this.createLight('preset_ambient', {
          type: 'ambient',
          color: new THREE.Color(0.1, 0.1, 0.2),
          intensity: 0.1,
        });
        this.createLight('preset_moon', {
          type: 'directional',
          color: new THREE.Color(0.3, 0.3, 0.5),
          intensity: 0.3,
          position: { x: -10, y: 15, z: -5 },
          castShadow: true,
        });
        break;

      case 'sunset':
        this.createLight('preset_ambient', {
          type: 'ambient',
          color: new THREE.Color(0.4, 0.3, 0.2),
          intensity: 0.2,
        });
        this.createLight('preset_sun', {
          type: 'directional',
          color: new THREE.Color(1, 0.6, 0.3),
          intensity: 0.8,
          position: { x: 20, y: 5, z: 10 },
          castShadow: true,
        });
        break;

      case 'studio':
        this.createLight('preset_ambient', {
          type: 'ambient',
          color: new THREE.Color(0.4, 0.4, 0.4),
          intensity: 0.5,
        });
        this.createLight('preset_key', {
          type: 'directional',
          color: new THREE.Color(1, 1, 1),
          intensity: 1.0,
          position: { x: 5, y: 8, z: 5 },
          castShadow: true,
        });
        this.createLight('preset_fill', {
          type: 'directional',
          color: new THREE.Color(0.8, 0.8, 0.9),
          intensity: 0.3,
          position: { x: -5, y: 3, z: 5 },
          castShadow: false,
        });
        break;

      case 'outdoor':
        this.createLight('preset_ambient', {
          type: 'hemisphere',
          color: new THREE.Color(0.6, 0.6, 0.8),
          groundColor: new THREE.Color(0.4, 0.35, 0.3),
          intensity: 0.5,
        });
        this.createLight('preset_sun', {
          type: 'directional',
          color: new THREE.Color(1, 0.95, 0.9),
          intensity: 1.0,
          position: { x: 15, y: 25, z: 15 },
          castShadow: true,
          shadow: {
            ...DefaultShadowConfig,
            mapSize: 4096,
            cameraLeft: -30,
            cameraRight: 30,
            cameraTop: 30,
            cameraBottom: -30,
          },
        });
        break;
    }

    this.eventBus.emit('lighting:preset_applied', { preset });
  }

  // ============================================
  // DISPOSE
  // ============================================

  /**
   * Dispose all lights
   */
  dispose(): void {
    // Remove all lights
    this.lights.forEach((light, id) => {
      if (this.scene) {
        this.scene.remove(light);
      }
      if (this.isShadowCapableLight(light) && light.shadow.map) {
        light.shadow.map.dispose();
      }
      light.dispose();
    });

    this.lights.clear();
    this.defaultLights = [];
    this.scene = null;

    this.eventBus.emit('lighting:disposed', {});
    console.log('[LightingSystem] Disposed');
  }
}

// ============================================
// SINGLETON
// ============================================

let lightingSystemInstance: LightingSystem | null = null;

export function createLightingSystem(eventBus: EventBus): LightingSystem {
  if (!lightingSystemInstance) {
    lightingSystemInstance = new LightingSystem(eventBus);
  }
  return lightingSystemInstance;
}

export function getLightingSystem(): LightingSystem | null {
  return lightingSystemInstance;
}
