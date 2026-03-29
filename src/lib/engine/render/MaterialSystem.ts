/**
 * Material System
 * 
 * Manages materials with caching, cloning, and disposal.
 * Supports PBR materials and custom shaders.
 */

import * as THREE from 'three';
import { EventBus } from '../core/EventSystem';
import {
  MaterialConfig,
  MaterialType,
  BlendMode,
  TextureConfig,
} from './types';

// ============================================
// MATERIAL SYSTEM
// ============================================

export class MaterialSystem {
  private materials: Map<string, THREE.Material> = new Map();
  private textures: Map<string, THREE.Texture> = new Map();
  private eventBus: EventBus;
  private textureLoader: THREE.TextureLoader;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.textureLoader = new THREE.TextureLoader();
  }

  // ============================================
  // MATERIAL CREATION
  // ============================================

  /**
   * Create a new material
   */
  createMaterial(id: string, config: Partial<MaterialConfig>): THREE.Material {
    if (this.materials.has(id)) {
      console.warn(`[MaterialSystem] Material already exists: ${id}`);
      return this.materials.get(id)!;
    }

    let material: THREE.Material;

    switch (config.type) {
      case 'standard':
        material = this.createStandardMaterial(config);
        break;

      case 'physical':
        material = this.createPhysicalMaterial(config);
        break;

      case 'phong':
        material = this.createPhongMaterial(config);
        break;

      case 'lambert':
        material = this.createLambertMaterial(config);
        break;

      case 'toon':
        material = this.createToonMaterial(config);
        break;

      case 'basic':
        material = this.createBasicMaterial(config);
        break;

      case 'shader':
        material = this.createShaderMaterial(config);
        break;

      default:
        material = this.createStandardMaterial(config);
    }

    // Store material
    this.materials.set(id, material);

    this.eventBus.emit('material:created', { id, type: config.type || 'standard' });

    return material;
  }

  private createStandardMaterial(config: Partial<MaterialConfig>): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color: this.toThreeColor(config.color),
      metalness: config.metalness ?? 0.0,
      roughness: config.roughness ?? 0.5,
      emissive: this.toThreeColor(config.emissive),
      emissiveIntensity: config.emissiveIntensity ?? 0,
      opacity: config.opacity ?? 1,
      transparent: config.transparent ?? (config.opacity !== undefined && config.opacity < 1),
      side: this.getSide(config.side),
      depthWrite: config.depthWrite ?? true,
      depthTest: config.depthTest ?? true,
    });

    // Load textures
    if (config.map) material.map = this.loadTexture(config.map);
    if (config.normalMap) {
      material.normalMap = this.loadTexture(config.normalMap);
      if (config.normalScale) {
        material.normalScale.set(config.normalScale.x, config.normalScale.y);
      }
    }
    if (config.roughnessMap) material.roughnessMap = this.loadTexture(config.roughnessMap);
    if (config.metalnessMap) material.metalnessMap = this.loadTexture(config.metalnessMap);
    if (config.aoMap) {
      material.aoMap = this.loadTexture(config.aoMap);
      material.aoMapIntensity = config.aoMapIntensity ?? 1;
    }
    if (config.emissiveMap) material.emissiveMap = this.loadTexture(config.emissiveMap);

    return material;
  }

  private createPhysicalMaterial(config: Partial<MaterialConfig>): THREE.MeshPhysicalMaterial {
    const material = new THREE.MeshPhysicalMaterial({
      color: this.toThreeColor(config.color),
      metalness: config.metalness ?? 0.0,
      roughness: config.roughness ?? 0.5,
      emissive: this.toThreeColor(config.emissive),
      emissiveIntensity: config.emissiveIntensity ?? 0,
      opacity: config.opacity ?? 1,
      transparent: config.transparent ?? (config.opacity !== undefined && config.opacity < 1),
      side: this.getSide(config.side),
      clearcoat: config.clearcoat ?? 0,
      clearcoatRoughness: config.clearcoatRoughness ?? 0,
      sheen: config.sheen ?? 0,
      sheenColor: this.toThreeColor(config.sheenColor),
      transmission: config.transmission ?? 0,
      thickness: config.thickness ?? 0,
      ior: config.ior ?? 1.5,
    });

    // Load textures (same as standard)
    if (config.map) material.map = this.loadTexture(config.map);
    if (config.normalMap) material.normalMap = this.loadTexture(config.normalMap);
    if (config.roughnessMap) material.roughnessMap = this.loadTexture(config.roughnessMap);
    if (config.metalnessMap) material.metalnessMap = this.loadTexture(config.metalnessMap);

    return material;
  }

  private createPhongMaterial(config: Partial<MaterialConfig>): THREE.MeshPhongMaterial {
    return new THREE.MeshPhongMaterial({
      color: this.toThreeColor(config.color),
      shininess: (1 - (config.roughness ?? 0.5)) * 100,
      emissive: this.toThreeColor(config.emissive),
      emissiveIntensity: config.emissiveIntensity ?? 0,
      opacity: config.opacity ?? 1,
      transparent: config.transparent ?? (config.opacity !== undefined && config.opacity < 1),
      side: this.getSide(config.side),
    });
  }

  private createLambertMaterial(config: Partial<MaterialConfig>): THREE.MeshLambertMaterial {
    return new THREE.MeshLambertMaterial({
      color: this.toThreeColor(config.color),
      emissive: this.toThreeColor(config.emissive),
      emissiveIntensity: config.emissiveIntensity ?? 0,
      opacity: config.opacity ?? 1,
      transparent: config.transparent ?? (config.opacity !== undefined && config.opacity < 1),
      side: this.getSide(config.side),
    });
  }

  private createToonMaterial(config: Partial<MaterialConfig>): THREE.MeshToonMaterial {
    return new THREE.MeshToonMaterial({
      color: this.toThreeColor(config.color),
      gradientMap: config.gradientMap ? this.loadTexture(config.gradientMap) : undefined,
      opacity: config.opacity ?? 1,
      transparent: config.transparent ?? (config.opacity !== undefined && config.opacity < 1),
    });
  }

  private createBasicMaterial(config: Partial<MaterialConfig>): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color: this.toThreeColor(config.color),
      opacity: config.opacity ?? 1,
      transparent: config.transparent ?? (config.opacity !== undefined && config.opacity < 1),
      side: this.getSide(config.side),
      depthWrite: config.depthWrite ?? true,
      wireframe: false,
    });
  }

  private createShaderMaterial(config: Partial<MaterialConfig>): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: config.vertexShader || this.getDefaultVertexShader(),
      fragmentShader: config.fragmentShader || this.getDefaultFragmentShader(),
      uniforms: config.uniforms || {},
      transparent: config.transparent ?? true,
      side: this.getSide(config.side),
      depthWrite: config.depthWrite ?? true,
    });
  }

  private getSide(side?: 'front' | 'back' | 'double'): THREE.Side {
    switch (side) {
      case 'front':
        return THREE.FrontSide;
      case 'back':
        return THREE.BackSide;
      case 'double':
        return THREE.DoubleSide;
      default:
        return THREE.FrontSide;
    }
  }

  private toThreeColor(color?: MaterialConfig['color']): THREE.Color | undefined {
    if (!color) return undefined;
    if (color instanceof THREE.Color) {
      return color.clone();
    }
    return new THREE.Color(color.r, color.g, color.b);
  }

  // ============================================
  // TEXTURE LOADING
  // ============================================

  /**
   * Load a texture
   */
  private loadTexture(config: TextureConfig): THREE.Texture {
    const cacheKey = config.path;

    // Check cache
    if (this.textures.has(cacheKey)) {
      return this.textures.get(cacheKey)!;
    }

    // Load texture
    const texture = this.textureLoader.load(config.path);
    
    // Apply settings
    if (config.repeat) {
      texture.repeat.set(config.repeat.x, config.repeat.y);
    }
    if (config.offset) {
      texture.offset.set(config.offset.x, config.offset.y);
    }
    if (config.rotation !== undefined) {
      texture.rotation = config.rotation;
    }
    if (config.wrapS) {
      texture.wrapS = this.getWrapMode(config.wrapS);
    }
    if (config.wrapT) {
      texture.wrapT = this.getWrapMode(config.wrapT);
    }
    if (config.anisotropy !== undefined) {
      texture.anisotropy = config.anisotropy;
    }

    // Cache texture
    this.textures.set(cacheKey, texture);

    return texture;
  }

  private getWrapMode(mode: 'repeat' | 'clamp' | 'mirror'): THREE.Wrapping {
    switch (mode) {
      case 'repeat':
        return THREE.RepeatWrapping;
      case 'clamp':
        return THREE.ClampToEdgeWrapping;
      case 'mirror':
        return THREE.MirroredRepeatWrapping;
      default:
        return THREE.RepeatWrapping;
    }
  }

  // ============================================
  // MATERIAL MANAGEMENT
  // ============================================

  /**
   * Get a material by ID
   */
  getMaterial(id: string): THREE.Material | undefined {
    return this.materials.get(id);
  }

  /**
   * Clone an existing material
   */
  cloneMaterial(sourceId: string, newId: string): THREE.Material | undefined {
    const source = this.materials.get(sourceId);
    if (!source) return undefined;

    const cloned = source.clone();
    this.materials.set(newId, cloned);

    this.eventBus.emit('material:cloned', { sourceId, newId });

    return cloned;
  }

  /**
   * Update a material's properties
   */
  updateMaterial(id: string, updates: Partial<MaterialConfig>): void {
    const material = this.materials.get(id);
    if (!material) return;

    // Update properties based on material type
    if (material instanceof THREE.MeshStandardMaterial) {
      if (updates.color) {
        const color = this.toThreeColor(updates.color);
        if (color) material.color.copy(color);
      }
      if (updates.metalness !== undefined) material.metalness = updates.metalness;
      if (updates.roughness !== undefined) material.roughness = updates.roughness;
      if (updates.emissive) {
        const emissive = this.toThreeColor(updates.emissive);
        if (emissive) material.emissive.copy(emissive);
      }
      if (updates.emissiveIntensity !== undefined) material.emissiveIntensity = updates.emissiveIntensity;
      if (updates.opacity !== undefined) material.opacity = updates.opacity;
      if (updates.transparent !== undefined) material.transparent = updates.transparent;
    }

    material.needsUpdate = true;

    this.eventBus.emit('material:updated', { id, updates });
  }

  /**
   * Remove a material
   */
  disposeMaterial(id: string): void {
    const material = this.materials.get(id);
    if (!material) return;

    material.dispose();
    this.materials.delete(id);

    this.eventBus.emit('material:disposed', { id });
  }

  // ============================================
  // PRESET MATERIALS
  // ============================================

  /**
   * Create preset materials
   */
  createPresets(): void {
    // Holographic material
    this.createMaterial('preset_holographic', {
      type: 'shader',
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 baseColor;
        varying vec2 vUv;
        varying vec3 vNormal;
        
        void main() {
          float scanline = sin(vUv.y * 100.0 + time * 2.0) * 0.1;
          float edge = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
          vec3 color = baseColor + edge * 0.5 + scanline * 0.3;
          gl_FragColor = vec4(color, 0.9);
        }
      `,
      uniforms: {
        time: { value: 0 },
        baseColor: { value: new THREE.Color(0, 0.8, 1) },
      },
      transparent: true,
    });

    // Wireframe material
    this.createMaterial('preset_wireframe', {
      type: 'basic',
      color: new THREE.Color(0, 0.8, 1),
      transparent: true,
      opacity: 0.5,
    });

    // Emissive glow material
    this.createMaterial('preset_emissive', {
      type: 'standard',
      color: new THREE.Color(0, 0.5, 0.5),
      emissive: new THREE.Color(0, 1, 1),
      emissiveIntensity: 0.5,
    });

    // Metallic gold material
    this.createMaterial('preset_gold', {
      type: 'standard',
      color: new THREE.Color(1, 0.765, 0.3),
      metalness: 1.0,
      roughness: 0.3,
    });

    // Matte material
    this.createMaterial('preset_matte', {
      type: 'standard',
      color: new THREE.Color(0.5, 0.5, 0.5),
      metalness: 0.0,
      roughness: 1.0,
    });

    this.eventBus.emit('material:presets_created', {});
  }

  // ============================================
  // DEFAULT SHADERS
  // ============================================

  private getDefaultVertexShader(): string {
    return `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  private getDefaultFragmentShader(): string {
    return `
      uniform vec3 color;
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        gl_FragColor = vec4(color, opacity);
      }
    `;
  }

  // ============================================
  // DISPOSE
  // ============================================

  /**
   * Dispose all materials and textures
   */
  dispose(): void {
    // Dispose materials
    this.materials.forEach((material, id) => {
      material.dispose();
    });
    this.materials.clear();

    // Dispose textures
    this.textures.forEach((texture, id) => {
      texture.dispose();
    });
    this.textures.clear();

    this.eventBus.emit('material:disposed_all', {});
    console.log('[MaterialSystem] Disposed');
  }
}

// ============================================
// SINGLETON
// ============================================

let materialSystemInstance: MaterialSystem | null = null;

export function createMaterialSystem(eventBus: EventBus): MaterialSystem {
  if (!materialSystemInstance) {
    materialSystemInstance = new MaterialSystem(eventBus);
  }
  return materialSystemInstance;
}

export function getMaterialSystem(): MaterialSystem | null {
  return materialSystemInstance;
}
