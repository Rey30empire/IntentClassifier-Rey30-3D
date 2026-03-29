/**
 * NEXUS Engine - Advanced Post Processing System
 * 
 * Sistema completo de post-procesamiento con:
 * - Bloom
 * - Depth of Field (DOF)
 * - Screen Space Ambient Occlusion (SSAO)
 * - Motion Blur
 * - Chromatic Aberration
 * - Vignette
 * - Color Grading
 * - FXAA/TAA/SMAA Anti-aliasing
 * - Custom shaders
 */

import { generateId } from '../../conversion/types';

// ============================================
// POST PROCESSING TYPES
// ============================================

/** Tipos de efectos de post-procesamiento */
export type PostEffectType =
  | 'bloom'
  | 'dof'
  | 'ssao'
  | 'motion_blur'
  | 'chromatic_aberration'
  | 'vignette'
  | 'color_grading'
  | 'tonemapping'
  | 'fxaa'
  | 'smaa'
  | 'taa'
  | 'film_grain'
  | 'lens_flare'
  | 'screen_space_reflection'
  | 'custom';

/** Efecto de post-procesamiento base */
export interface PostEffect {
  id: string;
  type: PostEffectType;
  name: string;
  enabled: boolean;
  order: number;
}

// ============================================
// BLOOM
// ============================================

export interface BloomEffect extends PostEffect {
  type: 'bloom';
  
  // Intensidad y threshold
  intensity: number;          // 0 - 2
  threshold: number;          // 0 - 2
  softKnee: number;           // 0 - 1
  
  // Configuración
  diffusion: number;          // 1 - 10 (número de pasadas)
  radius: number;             // 0 - 10
  quality: 'low' | 'medium' | 'high' | 'ultra';
  
  // Color
  tint: { r: number; g: number; b: number; a: number };
  fastMode: boolean;
}

export function createBloomEffect(options?: Partial<BloomEffect>): BloomEffect {
  return {
    id: generateId(),
    type: 'bloom',
    name: 'Bloom',
    enabled: true,
    order: 10,
    intensity: 0.5,
    threshold: 0.9,
    softKnee: 0.5,
    diffusion: 7,
    radius: 4,
    quality: 'medium',
    tint: { r: 1, g: 1, b: 1, a: 1 },
    fastMode: false,
    ...options,
  };
}

// ============================================
// DEPTH OF FIELD
// ============================================

export interface DOFEffect extends PostEffect {
  type: 'dof';
  
  // Enfoque
  focusDistance: number;      // 0 - 100 (metros)
  focusRange: number;         // 0 - 50 (profundidad de campo)
  focalLength: number;        // 10 - 300 (mm)
  aperture: number;           // f/1.4 - f/22
  
  // Calidad
  maxBlur: number;            // 0 - 10
  quality: 'low' | 'medium' | 'high' | 'ultra';
  
  // Bokeh
  bokehShape: 'circle' | 'hexagon' | 'octagon' | 'custom';
  bokehTexture?: string;
  bokehIntensity: number;     // 0 - 1
}

export function createDOFEffect(options?: Partial<DOFEffect>): DOFEffect {
  return {
    id: generateId(),
    type: 'dof',
    name: 'Depth of Field',
    enabled: false,
    order: 20,
    focusDistance: 10,
    focusRange: 3,
    focalLength: 50,
    aperture: 2.8,
    maxBlur: 5,
    quality: 'medium',
    bokehShape: 'circle',
    bokehIntensity: 0.5,
    ...options,
  };
}

// ============================================
// SSAO
// ============================================

export interface SSAOEffect extends PostEffect {
  type: 'ssao';
  
  // Intensidad
  intensity: number;          // 0 - 4
  radius: number;             // 0 - 2
  power: number;              // 0 - 4
  
  // Calidad
  sampleCount: 8 | 16 | 24 | 32;
  downsample: boolean;
  blurEnabled: boolean;
  blurRadius: number;
  blurQuality: 'low' | 'medium' | 'high';
  
  // Advanced
  bias: number;               // 0 - 0.5
  minDistance: number;        // 0 - 0.1
  maxDistance: number;        // 0.1 - 1
}

export function createSSAOEffect(options?: Partial<SSAOEffect>): SSAOEffect {
  return {
    id: generateId(),
    type: 'ssao',
    name: 'SSAO',
    enabled: true,
    order: 5,
    intensity: 1,
    radius: 0.5,
    power: 1,
    sampleCount: 16,
    downsample: true,
    blurEnabled: true,
    blurRadius: 2,
    blurQuality: 'medium',
    bias: 0.025,
    minDistance: 0.005,
    maxDistance: 0.5,
    ...options,
  };
}

// ============================================
// MOTION BLUR
// ============================================

export interface MotionBlurEffect extends PostEffect {
  type: 'motion_blur';
  
  // Intensidad
  intensity: number;          // 0 - 1
  sampleCount: number;        // 4 - 32
  
  // Configuración
  shutterAngle: number;       // 0 - 360 grados
  maxVelocity: number;        // 1 - 100 (pixels)
  
  // Calidad
  quality: 'low' | 'medium' | 'high';
  depthAware: boolean;
}

export function createMotionBlurEffect(options?: Partial<MotionBlurEffect>): MotionBlurEffect {
  return {
    id: generateId(),
    type: 'motion_blur',
    name: 'Motion Blur',
    enabled: false,
    order: 30,
    intensity: 0.5,
    sampleCount: 8,
    shutterAngle: 270,
    maxVelocity: 50,
    quality: 'medium',
    depthAware: true,
    ...options,
  };
}

// ============================================
// CHROMATIC ABERRATION
// ============================================

export interface ChromaticAberrationEffect extends PostEffect {
  type: 'chromatic_aberration';
  
  // Intensidad
  intensity: number;          // 0 - 1
  
  // Configuración
  direction: { x: number; y: number };
  spectralLuminance: boolean;
  
  // Advanced
  redOffset: number;
  greenOffset: number;
  blueOffset: number;
}

export function createChromaticAberrationEffect(
  options?: Partial<ChromaticAberrationEffect>
): ChromaticAberrationEffect {
  return {
    id: generateId(),
    type: 'chromatic_aberration',
    name: 'Chromatic Aberration',
    enabled: false,
    order: 40,
    intensity: 0.1,
    direction: { x: 1, y: 1 },
    spectralLuminance: false,
    redOffset: 1,
    greenOffset: 0,
    blueOffset: -1,
    ...options,
  };
}

// ============================================
// VIGNETTE
// ============================================

export interface VignetteEffect extends PostEffect {
  type: 'vignette';
  
  // Intensidad
  intensity: number;          // 0 - 1
  roundness: number;          // 0 - 1
  smoothness: number;         // 0 - 1
  
  // Color
  color: { r: number; g: number; b: number; a: number };
  
  // Shape
  centered: boolean;
  center: { x: number; y: number };
  maskTexture?: string;
}

export function createVignetteEffect(options?: Partial<VignetteEffect>): VignetteEffect {
  return {
    id: generateId(),
    type: 'vignette',
    name: 'Vignette',
    enabled: false,
    order: 50,
    intensity: 0.45,
    roundness: 1,
    smoothness: 0.5,
    color: { r: 0, g: 0, b: 0, a: 1 },
    centered: true,
    center: { x: 0.5, y: 0.5 },
    ...options,
  };
}

// ============================================
// COLOR GRADING
// ============================================

export interface ColorGradingEffect extends PostEffect {
  type: 'color_grading';
  
  // Exposure & Contrast
  exposure: number;           // -2 - 2
  contrast: number;           // -1 - 1
  
  // Color adjustments
  saturation: number;         // -1 - 2
  vibrance: number;           // -1 - 1
  hueShift: number;           // -180 - 180 (grados)
  
  // Temperature & Tint
  temperature: number;        // -1 - 1 (azul-amarillo)
  tint: number;               // -1 - 1 (verde-magenta)
  
  // Shadows/Midtones/Highlights
  shadows: { r: number; g: number; b: number };
  midtones: { r: number; g: number; b: number };
  highlights: { r: number; g: number; b: number };
  
  // Curves (simplified)
  masterCurve: number[];      // 256 values
  redCurve: number[];
  greenCurve: number[];
  blueCurve: number[];
  
  // LUT
  lutTexture?: string;
  lutIntensity: number;       // 0 - 1
  
  // Mixer
  channelMixer: {
    red: { r: number; g: number; b: number };
    green: { r: number; g: number; b: number };
    blue: { r: number; g: number; b: number };
  };
}

export function createColorGradingEffect(
  options?: Partial<ColorGradingEffect>
): ColorGradingEffect {
  const identityCurve = Array.from({ length: 256 }, (_, i) => i / 255);
  
  return {
    id: generateId(),
    type: 'color_grading',
    name: 'Color Grading',
    enabled: true,
    order: 60,
    exposure: 0,
    contrast: 0,
    saturation: 0,
    vibrance: 0,
    hueShift: 0,
    temperature: 0,
    tint: 0,
    shadows: { r: 1, g: 1, b: 1 },
    midtones: { r: 1, g: 1, b: 1 },
    highlights: { r: 1, g: 1, b: 1 },
    masterCurve: [...identityCurve],
    redCurve: [...identityCurve],
    greenCurve: [...identityCurve],
    blueCurve: [...identityCurve],
    lutIntensity: 1,
    channelMixer: {
      red: { r: 1, g: 0, b: 0 },
      green: { r: 0, g: 1, b: 0 },
      blue: { r: 0, g: 0, b: 1 },
    },
    ...options,
  };
}

// ============================================
// TONE MAPPING
// ============================================

export type ToneMappingMode =
  | 'none'
  | 'linear'
  | 'reinhard'
  | 'reinhard_extended'
  | 'filmic'
  | 'aces'
  | 'uncharted2'
  | 'custom';

export interface ToneMappingEffect extends PostEffect {
  type: 'tonemapping';
  
  // Mode
  mode: ToneMappingMode;
  
  // Exposure
  exposure: number;           // 0 - 5
  
  // Reinhard
  reinhardWhitePoint: number; // 0 - 10
  
  // Filmic
  filmicToeStrength: number;  // 0 - 1
  filmicToeLength: number;    // 0 - 1
  filmicShoulderStrength: number;
  filmicShoulderLength: number;
  filmicShoulderAngle: number;
  
  // ACES
  acesPreScale: number;
  acesPostScale: number;
  
  // Gamma
  gammaCorrection: boolean;
  gamma: number;              // 1 - 3
}

export function createToneMappingEffect(
  options?: Partial<ToneMappingEffect>
): ToneMappingEffect {
  return {
    id: generateId(),
    type: 'tonemapping',
    name: 'Tone Mapping',
    enabled: true,
    order: 55,
    mode: 'aces',
    exposure: 1,
    reinhardWhitePoint: 4,
    filmicToeStrength: 0.53,
    filmicToeLength: 0.91,
    filmicShoulderStrength: 0.23,
    filmicShoulderLength: 0.55,
    filmicShoulderAngle: 0,
    acesPreScale: 0.85,
    acesPostScale: 0.35,
    gammaCorrection: true,
    gamma: 2.2,
    ...options,
  };
}

// ============================================
// ANTI-ALIASING
// ============================================

export interface AntiAliasingEffect extends PostEffect {
  type: 'fxaa' | 'smaa' | 'taa';
  
  // FXAA
  fxaaQuality: 'low' | 'medium' | 'high' | 'ultra';
  fxaaEdgeThreshold: number;  // 0.063 - 0.25
  fxaaSubpixelQuality: number; // 0 - 1
  
  // SMAA
  smaaQuality: 'low' | 'medium' | 'high' | 'ultra';
  smaaEdgeDetection: 'depth' | 'color' | 'luma';
  smaaThreshold: number;      // 0 - 0.5
  
  // TAA
  taaJitterSpread: number;    // 0.1 - 2
  taaSharpness: number;       // 0 - 1
  taaStationaryBlending: number; // 0 - 1
  taaMotionBlending: number;  // 0 - 1
}

export function createFXAAEffect(options?: Partial<AntiAliasingEffect>): AntiAliasingEffect {
  return {
    id: generateId(),
    type: 'fxaa',
    name: 'FXAA',
    enabled: true,
    order: 100,
    fxaaQuality: 'high',
    fxaaEdgeThreshold: 0.125,
    fxaaSubpixelQuality: 0.75,
    smaaQuality: 'medium',
    smaaEdgeDetection: 'luma',
    smaaThreshold: 0.1,
    taaJitterSpread: 1,
    taaSharpness: 0.5,
    taaStationaryBlending: 0.95,
    taaMotionBlending: 0.85,
    ...options,
  };
}

export function createSMAAEffect(options?: Partial<AntiAliasingEffect>): AntiAliasingEffect {
  return {
    id: generateId(),
    type: 'smaa',
    name: 'SMAA',
    enabled: false,
    order: 100,
    fxaaQuality: 'high',
    fxaaEdgeThreshold: 0.125,
    fxaaSubpixelQuality: 0.75,
    smaaQuality: 'high',
    smaaEdgeDetection: 'color',
    smaaThreshold: 0.1,
    taaJitterSpread: 1,
    taaSharpness: 0.5,
    taaStationaryBlending: 0.95,
    taaMotionBlending: 0.85,
    ...options,
  };
}

export function createTAAEffect(options?: Partial<AntiAliasingEffect>): AntiAliasingEffect {
  return {
    id: generateId(),
    type: 'taa',
    name: 'TAA',
    enabled: false,
    order: 0, // Before main render
    fxaaQuality: 'high',
    fxaaEdgeThreshold: 0.125,
    fxaaSubpixelQuality: 0.75,
    smaaQuality: 'medium',
    smaaEdgeDetection: 'luma',
    smaaThreshold: 0.1,
    taaJitterSpread: 0.75,
    taaSharpness: 0.5,
    taaStationaryBlending: 0.95,
    taaMotionBlending: 0.85,
    ...options,
  };
}

// ============================================
// FILM GRAIN
// ============================================

export interface FilmGrainEffect extends PostEffect {
  type: 'film_grain';
  
  // Intensidad
  intensity: number;          // 0 - 1
  
  // Configuración
  grainSize: number;          // 0.1 - 3
  colored: boolean;
  animate: boolean;
  speed: number;              // 0 - 10
  response: number;           // 0 - 1
  
  // Advanced
  luminanceContribution: number; // 0 - 1
}

export function createFilmGrainEffect(options?: Partial<FilmGrainEffect>): FilmGrainEffect {
  return {
    id: generateId(),
    type: 'film_grain',
    name: 'Film Grain',
    enabled: false,
    order: 70,
    intensity: 0.3,
    grainSize: 1,
    colored: false,
    animate: true,
    speed: 1,
    response: 0.8,
    luminanceContribution: 0.8,
    ...options,
  };
}

// ============================================
// SCREEN SPACE REFLECTIONS
// ============================================

export interface SSREffect extends PostEffect {
  type: 'screen_space_reflection';
  
  // Intensidad
  intensity: number;          // 0 - 1
  
  // Configuración
  maxDistance: number;        // 0 - 100
  stride: number;             // 1 - 8
  steps: number;              // 8 - 128
  
  // Quality
  quality: 'low' | 'medium' | 'high' | 'ultra';
  halfResolution: boolean;
  
  // Advanced
  fadeStart: number;          // 0 - 1
  fadeEnd: number;            // 0 - 1
  fresnelFade: number;        // 0 - 1
  thickness: number;          // 0 - 0.1
  
  // Denoising
  denoiseEnabled: boolean;
  denoiseRadius: number;
}

export function createSSREffect(options?: Partial<SSREffect>): SSREffect {
  return {
    id: generateId(),
    type: 'screen_space_reflection',
    name: 'SSR',
    enabled: false,
    order: 15,
    intensity: 0.5,
    maxDistance: 50,
    stride: 2,
    steps: 32,
    quality: 'medium',
    halfResolution: true,
    fadeStart: 0,
    fadeEnd: 0.5,
    fresnelFade: 0.1,
    thickness: 0.02,
    denoiseEnabled: true,
    denoiseRadius: 2,
    ...options,
  };
}

// ============================================
// CUSTOM SHADER EFFECT
// ============================================

export interface CustomShaderEffect extends PostEffect {
  type: 'custom';
  
  // Shader
  fragmentShader: string;
  vertexShader?: string;
  
  // Uniforms
  uniforms: Record<string, {
    type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'sampler2D' | 'samplerCube';
    value: number | number[] | string;
  }>;
  
  // Render targets
  needsDepthTexture: boolean;
  needsNormalTexture: boolean;
  needsVelocityTexture: boolean;
}

// ============================================
// POST PROCESSING STACK
// ============================================

/** Configuración de render targets */
export interface RenderTargetConfig {
  width: number;
  height: number;
  format: 'rgba8' | 'rgba16f' | 'rgba32f' | 'r8' | 'r16f' | 'rg16f';
  filter: 'nearest' | 'linear';
  wrap: 'clamp' | 'repeat' | 'mirror';
  generateMipmaps: boolean;
}

/** Stack de post-procesamiento */
export interface PostProcessingStack {
  id: string;
  name: string;
  
  // Effects
  effects: PostEffect[];
  
  // Render configuration
  renderScale: number;        // 0.25 - 2
  hdr: boolean;
  hdrFormat: 'rgba16f' | 'rgba32f';
  
  // Debug
  debugView: 'none' | 'depth' | 'normals' | 'motion_vectors' | 'ssao' | 'ssr';
}

// ============================================
// POST PROCESSING MANAGER
// ============================================

/**
 * Manager de post-procesamiento
 */
export class PostProcessingManager {
  private stacks: Map<string, PostProcessingStack> = new Map();
  private activeStackId: string | null = null;
  private renderTargets: Map<string, unknown> = new Map();
  
  constructor() {
    // Create default stack
    const defaultStack = this.createStack('Default');
    this.activeStackId = defaultStack.id;
    
    // Add default effects
    defaultStack.effects.push(createToneMappingEffect());
    defaultStack.effects.push(createFXAAEffect());
  }
  
  /**
   * Crear nuevo stack
   */
  createStack(name: string): PostProcessingStack {
    const stack: PostProcessingStack = {
      id: generateId(),
      name,
      effects: [],
      renderScale: 1,
      hdr: true,
      hdrFormat: 'rgba16f',
      debugView: 'none',
    };
    
    this.stacks.set(stack.id, stack);
    return stack;
  }
  
  /**
   * Obtener stack activo
   */
  getActiveStack(): PostProcessingStack | null {
    if (!this.activeStackId) return null;
    return this.stacks.get(this.activeStackId) || null;
  }
  
  /**
   * Activar stack
   */
  setActiveStack(stackId: string): boolean {
    if (!this.stacks.has(stackId)) return false;
    this.activeStackId = stackId;
    return true;
  }
  
  /**
   * Añadir efecto al stack activo
   */
  addEffect(effect: PostEffect): boolean {
    const stack = this.getActiveStack();
    if (!stack) return false;
    
    // Insert in order
    const insertIndex = stack.effects.findIndex(e => e.order > effect.order);
    if (insertIndex === -1) {
      stack.effects.push(effect);
    } else {
      stack.effects.splice(insertIndex, 0, effect);
    }
    
    return true;
  }
  
  /**
   * Remover efecto
   */
  removeEffect(effectId: string): boolean {
    const stack = this.getActiveStack();
    if (!stack) return false;
    
    const index = stack.effects.findIndex(e => e.id === effectId);
    if (index === -1) return false;
    
    stack.effects.splice(index, 1);
    return true;
  }
  
  /**
   * Obtener efecto por ID
   */
  getEffect<T extends PostEffect>(effectId: string): T | null {
    const stack = this.getActiveStack();
    if (!stack) return null;
    
    return stack.effects.find(e => e.id === effectId) as T || null;
  }
  
  /**
   * Obtener efecto por tipo
   */
  getEffectByType<T extends PostEffect>(type: PostEffectType): T | null {
    const stack = this.getActiveStack();
    if (!stack) return null;
    
    return stack.effects.find(e => e.type === type) as T || null;
  }
  
  /**
   * Actualizar efecto
   */
  updateEffect<T extends PostEffect>(
    effectId: string,
    updates: Partial<T>
  ): boolean {
    const effect = this.getEffect<T>(effectId);
    if (!effect) return false;
    
    Object.assign(effect, updates);
    return true;
  }
  
  /**
   * Habilitar/deshabilitar efecto
   */
  toggleEffect(effectId: string, enabled?: boolean): boolean {
    const effect = this.getEffect(effectId);
    if (!effect) return false;
    
    effect.enabled = enabled ?? !effect.enabled;
    return true;
  }
  
  /**
   * Mover efecto en el orden
   */
  reorderEffect(effectId: string, newOrder: number): boolean {
    const stack = this.getActiveStack();
    if (!stack) return false;
    
    const effect = stack.effects.find(e => e.id === effectId);
    if (!effect) return false;
    
    effect.order = newOrder;
    stack.effects.sort((a, b) => a.order - b.order);
    
    return true;
  }
  
  /**
   * Obtener todos los efectos habilitados
   */
  getEnabledEffects(): PostEffect[] {
    const stack = this.getActiveStack();
    if (!stack) return [];
    
    return stack.effects.filter(e => e.enabled);
  }
  
  /**
   * Crear preset
   */
  applyPreset(preset: PostProcessingPreset): void {
    const stack = this.getActiveStack();
    if (!stack) return;
    
    // Clear current effects
    stack.effects = [];
    
    // Apply preset effects
    for (const effect of preset.effects) {
      stack.effects.push({ ...effect, id: generateId() });
    }
    
    // Apply settings
    stack.renderScale = preset.renderScale;
    stack.hdr = preset.hdr;
  }
  
  /**
   * Exportar configuración
   */
  exportConfig(): string {
    const stack = this.getActiveStack();
    if (!stack) return '{}';
    
    return JSON.stringify({
      ...stack,
      effects: stack.effects.map(e => ({ ...e })),
    });
  }
  
  /**
   * Importar configuración
   */
  importConfig(json: string): boolean {
    try {
      const data = JSON.parse(json);
      const stack = this.createStack(data.name || 'Imported');
      
      stack.effects = data.effects || [];
      stack.renderScale = data.renderScale || 1;
      stack.hdr = data.hdr ?? true;
      
      this.activeStackId = stack.id;
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================
// PRESETS
// ============================================

export interface PostProcessingPreset {
  name: string;
  description: string;
  effects: PostEffect[];
  renderScale: number;
  hdr: boolean;
}

export const POST_PROCESSING_PRESETS: Record<string, PostProcessingPreset> = {
  default: {
    name: 'Default',
    description: 'Balanced post-processing for general use',
    effects: [
      createToneMappingEffect(),
      createFXAAEffect(),
    ],
    renderScale: 1,
    hdr: true,
  },
  
  cinematic: {
    name: 'Cinematic',
    description: 'Film-like appearance with subtle effects',
    effects: [
      createToneMappingEffect({ mode: 'filmic' }),
      createBloomEffect({ intensity: 0.4, threshold: 0.8 }),
      createVignetteEffect({ intensity: 0.35 }),
      createFilmGrainEffect({ intensity: 0.15 }),
      createSMAAEffect(),
    ],
    renderScale: 1,
    hdr: true,
  },
  
  realistic: {
    name: 'Realistic',
    description: 'Physically accurate rendering',
    effects: [
      createSSAOEffect({ intensity: 0.8 }),
      createSSREffect({ intensity: 0.6 }),
      createToneMappingEffect({ mode: 'aces' }),
      createBloomEffect({ intensity: 0.3, threshold: 1.2 }),
      createSMAAEffect({ smaaQuality: 'ultra' }),
    ],
    renderScale: 1,
    hdr: true,
  },
  
  stylized: {
    name: 'Stylized',
    description: 'Bold artistic look',
    effects: [
      createColorGradingEffect({
        saturation: 0.3,
        contrast: 0.2,
        vibrance: 0.4,
      }),
      createBloomEffect({ intensity: 0.7, threshold: 0.7 }),
      createVignetteEffect({ intensity: 0.5 }),
      createChromaticAberrationEffect({ intensity: 0.15 }),
      createFXAAEffect(),
    ],
    renderScale: 1,
    hdr: false,
  },
  
  performance: {
    name: 'Performance',
    description: 'Minimal effects for best performance',
    effects: [
      createToneMappingEffect({ mode: 'linear' }),
      createFXAAEffect({ fxaaQuality: 'low' }),
    ],
    renderScale: 0.75,
    hdr: false,
  },
  
  ultra: {
    name: 'Ultra Quality',
    description: 'Maximum quality with all effects',
    effects: [
      createSSAOEffect({ sampleCount: 32, blurQuality: 'high' }),
      createSSREffect({ quality: 'ultra', steps: 64 }),
      createToneMappingEffect({ mode: 'aces' }),
      createDOFEffect({ quality: 'high' }),
      createBloomEffect({ quality: 'high' }),
      createMotionBlurEffect({ quality: 'high', sampleCount: 16 }),
      createColorGradingEffect(),
      createSMAAEffect({ smaaQuality: 'ultra' }),
    ],
    renderScale: 1.5,
    hdr: true,
  },
};

// ============================================
// FACTORY
// ============================================

export function createPostProcessingManager(): PostProcessingManager {
  return new PostProcessingManager();
}

export default PostProcessingManager;
