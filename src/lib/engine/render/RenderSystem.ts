/**
 * Render System
 * 
 * Core rendering system for Rey30_NEXUS engine.
 * Manages WebGL renderer configuration and rendering pipeline.
 */

import * as THREE from 'three';
import { EventBus } from '../core/EventSystem';
import {
  RenderSystemConfig,
  DefaultRenderConfig,
  ToneMappingType,
  ColorSpace,
} from './types';

// ============================================
// RENDER SYSTEM
// ============================================

export class RenderSystem {
  private renderer: THREE.WebGLRenderer | null = null;
  private config: RenderSystemConfig;
  private eventBus: EventBus;
  private canvas: HTMLCanvasElement | null = null;
  private isInitialized = false;
  private animationFrameId: number | null = null;

  constructor(eventBus: EventBus, config: Partial<RenderSystemConfig> = {}) {
    this.eventBus = eventBus;
    this.config = { ...DefaultRenderConfig, ...config };
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize the renderer with a canvas element
   */
  initialize(canvas: HTMLCanvasElement): void {
    if (this.isInitialized) {
      console.warn('[RenderSystem] Already initialized');
      return;
    }

    this.canvas = canvas;

    // Create WebGL renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.config.antialias,
      alpha: true,
      powerPreference: 'high-performance',
    });

    // Apply configuration
    this.applyConfig();

    this.isInitialized = true;

    this.eventBus.emit('render:initialized', {
      config: this.config,
    });

    console.log('[RenderSystem] Initialized successfully');
  }

  /**
   * Apply renderer configuration
   */
  private applyConfig(): void {
    if (!this.renderer) return;

    // Shadows
    this.renderer.shadowMap.enabled = this.config.shadows;
    this.renderer.shadowMap.type = this.getShadowMapType();

    // Tone mapping
    this.renderer.toneMapping = this.getToneMapping();
    this.renderer.toneMappingExposure = this.config.toneMappingExposure;

    // Color space
    this.renderer.outputColorSpace = this.getColorSpace();

    // Pixel ratio
    this.renderer.setPixelRatio(this.config.pixelRatio);

    // Anisotropy
    this.config.maxAnisotropy = Math.min(
      this.config.maxAnisotropy,
      this.renderer.capabilities.getMaxAnisotropy()
    );

    // Info
    console.log('[RenderSystem] Config applied:', {
      shadows: this.config.shadows,
      toneMapping: this.config.toneMapping,
      pixelRatio: this.config.pixelRatio,
    });
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  /**
   * Update renderer configuration
   */
  updateConfig(updates: Partial<RenderSystemConfig>): void {
    this.config = { ...this.config, ...updates };
    this.applyConfig();

    this.eventBus.emit('render:config_updated', {
      config: this.config,
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): RenderSystemConfig {
    return { ...this.config };
  }

  /**
   * Set tone mapping exposure
   */
  setExposure(exposure: number): void {
    if (!this.renderer) return;
    this.config.toneMappingExposure = exposure;
    this.renderer.toneMappingExposure = exposure;
  }

  // ============================================
  // RENDERING
  // ============================================

  /**
   * Render a scene with a camera
   */
  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.renderer || !this.isInitialized) {
      console.warn('[RenderSystem] Cannot render: not initialized');
      return;
    }

    this.renderer.render(scene, camera);
  }

  /**
   * Get the WebGL context
   */
  getContext(): WebGLRenderingContext | WebGL2RenderingContext | null {
    return this.renderer?.getContext() || null;
  }

  /**
   * Get renderer info
   */
  getInfo(): THREE.WebGLInfo | null {
    return this.renderer?.info || null;
  }

  /**
   * Get rendering statistics
   */
  getStats(): {
    fps: number;
    memory: { geometries: number; textures: number };
    render: { calls: number; triangles: number; points: number; lines: number };
  } {
    const info = this.renderer?.info;
    return {
      fps: 0, // Calculated by TimeSystem
      memory: {
        geometries: info?.memory?.geometries || 0,
        textures: info?.memory?.textures || 0,
      },
      render: {
        calls: info?.render?.calls || 0,
        triangles: info?.render?.triangles || 0,
        points: info?.render?.points || 0,
        lines: info?.render?.lines || 0,
      },
    };
  }

  // ============================================
  // RESIZE
  // ============================================

  /**
   * Resize the renderer
   */
  resize(width: number, height: number): void {
    if (!this.renderer) return;

    this.renderer.setSize(width, height);

    this.eventBus.emit('render:resized', { width, height });
  }

  /**
   * Set viewport
   */
  setViewport(x: number, y: number, width: number, height: number): void {
    if (!this.renderer) return;
    this.renderer.setViewport(x, y, width, height);
  }

  /**
   * Set scissor test
   */
  setScissor(x: number, y: number, width: number, height: number): void {
    if (!this.renderer) return;
    this.renderer.setScissorTest(true);
    this.renderer.setScissor(x, y, width, height);
  }

  /**
   * Clear scissor test
   */
  clearScissor(): void {
    if (!this.renderer) return;
    this.renderer.setScissorTest(false);
  }

  // ============================================
  // CLEAR
  // ============================================

  /**
   * Clear the renderer
   */
  clear(color: boolean = true, depth: boolean = true, stencil: boolean = true): void {
    if (!this.renderer) return;
    this.renderer.clear(color, depth, stencil);
  }

  /**
   * Set clear color
   */
  setClearColor(color: THREE.ColorRepresentation, alpha: number = 1): void {
    if (!this.renderer) return;
    this.renderer.setClearColor(color, alpha);
  }

  // ============================================
  // HELPERS
  // ============================================

  private getShadowMapType(): THREE.ShadowMapType {
    switch (this.config.shadowMapType) {
      case 'basic':
        return THREE.BasicShadowMap;
      case 'pcf':
        return THREE.PCFShadowMap;
      case 'pcfsoft':
        return THREE.PCFSoftShadowMap;
      default:
        return THREE.PCFSoftShadowMap;
    }
  }

  private getToneMapping(): THREE.ToneMapping {
    const mapping: Record<ToneMappingType, THREE.ToneMapping> = {
      'none': THREE.NoToneMapping,
      'linear': THREE.LinearToneMapping,
      'reinhard': THREE.ReinhardToneMapping,
      'cineon': THREE.CineonToneMapping,
      'acesfilmic': THREE.ACESFilmicToneMapping,
      'agx': THREE.AgXToneMapping,
    };
    return mapping[this.config.toneMapping] || THREE.ACESFilmicToneMapping;
  }

  private getColorSpace(): THREE.ColorSpace {
    const threeWithDisplayP3 = THREE as typeof THREE & {
      DisplayP3ColorSpace?: THREE.ColorSpace;
    };

    const spaces: Record<ColorSpace, THREE.ColorSpace> = {
      'srgb': THREE.SRGBColorSpace,
      'srgb-linear': THREE.LinearSRGBColorSpace,
      'display-p3': threeWithDisplayP3.DisplayP3ColorSpace ?? THREE.SRGBColorSpace,
    };
    return spaces[this.config.outputColorSpace] || THREE.SRGBColorSpace;
  }

  // ============================================
  // DISPOSE
  // ============================================

  /**
   * Dispose the renderer
   */
  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer = null;
    }

    this.isInitialized = false;
    this.canvas = null;

    this.eventBus.emit('render:disposed', {});

    console.log('[RenderSystem] Disposed');
  }

  /**
   * Get the underlying Three.js renderer
   */
  getRenderer(): THREE.WebGLRenderer | null {
    return this.renderer;
  }

  /**
   * Check if initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }
}

// ============================================
// SINGLETON
// ============================================

let renderSystemInstance: RenderSystem | null = null;

export function createRenderSystem(
  eventBus: EventBus, 
  config?: Partial<RenderSystemConfig>
): RenderSystem {
  if (!renderSystemInstance) {
    renderSystemInstance = new RenderSystem(eventBus, config);
  }
  return renderSystemInstance;
}

export function getRenderSystem(): RenderSystem | null {
  return renderSystemInstance;
}
