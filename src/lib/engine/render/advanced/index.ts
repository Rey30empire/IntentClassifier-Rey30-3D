/**
 * NEXUS Engine - Advanced Render Systems
 * 
 * Sistemas avanzados de renderizado
 */

// Post Processing
export {
  PostProcessingManager,
  createPostProcessingManager,
  
  // Effect creators
  createBloomEffect,
  createDOFEffect,
  createSSAOEffect,
  createMotionBlurEffect,
  createChromaticAberrationEffect,
  createVignetteEffect,
  createColorGradingEffect,
  createToneMappingEffect,
  createFXAAEffect,
  createSMAAEffect,
  createTAAEffect,
  createFilmGrainEffect,
  createSSREffect,
  
  // Presets
  POST_PROCESSING_PRESETS,
  
  // Types
  type PostEffect,
  type PostEffectType,
  type BloomEffect,
  type DOFEffect,
  type SSAOEffect,
  type MotionBlurEffect,
  type ChromaticAberrationEffect,
  type VignetteEffect,
  type ColorGradingEffect,
  type ToneMappingEffect,
  type ToneMappingMode,
  type AntiAliasingEffect,
  type FilmGrainEffect,
  type SSREffect,
  type CustomShaderEffect,
  type PostProcessingStack,
  type PostProcessingPreset,
  type RenderTargetConfig,
} from './PostProcessingSystem';

// Shaders
export {
  ShaderManager,
  createShaderManager,
  
  // Shader library
  SHADER_LIBRARY,
  PBR_VERTEX_SHADER,
  PBR_FRAGMENT_SHADER,
  
  // Types
  type ShaderType,
  type UniformType,
  type AttributeType,
  type UniformDefinition,
  type AttributeDefinition,
  type VaryingDefinition,
  type ShaderSource,
  type ShaderVariant,
  type ShaderProgram,
  type PBRParameters,
} from './ShaderSystem';
