/**
 * Render System - Types
 *
 * Shared types for the render system.
 * These are intentionally serializable editor-side shapes, not live Three.js instances.
 */

// ============================================
// SERIALIZABLE MATH TYPES
// ============================================

export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 extends Vector2 {
  z: number;
}

export interface Quaternion extends Vector3 {
  w: number;
}

export interface Euler extends Vector3 {
  order?: string;
}

export interface Color {
  r: number;
  g: number;
  b: number;
}

export function createVector2(x = 0, y = 0): Vector2 {
  return { x, y };
}

export function createVector3(x = 0, y = 0, z = 0): Vector3 {
  return { x, y, z };
}

export function createQuaternion(x = 0, y = 0, z = 0, w = 1): Quaternion {
  return { x, y, z, w };
}

export function createColor(r = 1, g = 1, b = 1): Color {
  return { r, g, b };
}

// ============================================
// RENDERER TYPES
// ============================================

export type ToneMappingType =
  | 'none'
  | 'linear'
  | 'reinhard'
  | 'cineon'
  | 'acesfilmic'
  | 'agx';

export type ColorSpace = 'srgb' | 'srgb-linear' | 'display-p3';

export interface RenderSystemConfig {
  antialias: boolean;
  shadows: boolean;
  shadowMapType: 'pcf' | 'pcfsoft' | 'basic';
  shadowMapSize: number;
  toneMapping: ToneMappingType;
  toneMappingExposure: number;
  outputColorSpace: ColorSpace;
  pixelRatio: number;
  maxAnisotropy: number;
}

export const DefaultRenderConfig: RenderSystemConfig = {
  antialias: true,
  shadows: true,
  shadowMapType: 'pcfsoft',
  shadowMapSize: 2048,
  toneMapping: 'acesfilmic',
  toneMappingExposure: 1.0,
  outputColorSpace: 'srgb',
  pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  maxAnisotropy: 16,
};

// ============================================
// CAMERA TYPES
// ============================================

export type CameraType = 'perspective' | 'orthographic';
export type CameraMode = 'perspective' | 'orthographic' | 'top' | 'front' | 'side' | 'game';

export interface CameraConfig {
  id: string;
  type: CameraType;
  fov?: number;
  zoom?: number;
  near: number;
  far: number;
  position: Vector3;
  target: Vector3;
  up?: Vector3;
  layers?: number[];
  priority?: number;
}

export interface EditorCameraConfig extends CameraConfig {
  enableOrbit: boolean;
  enablePan: boolean;
  enableZoom: boolean;
  rotateSpeed: number;
  panSpeed: number;
  zoomSpeed: number;
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
}

export const DefaultCameraConfig: CameraConfig = {
  id: 'default_camera',
  type: 'perspective',
  fov: 50,
  near: 0.1,
  far: 1000,
  position: createVector3(5, 5, 5),
  target: createVector3(0, 0, 0),
};

export const DefaultEditorCameraConfig: EditorCameraConfig = {
  ...DefaultCameraConfig,
  id: 'editor_camera',
  enableOrbit: true,
  enablePan: true,
  enableZoom: true,
  rotateSpeed: 0.5,
  panSpeed: 0.5,
  zoomSpeed: 1.0,
  minDistance: 0.1,
  maxDistance: 1000,
  minPolarAngle: 0,
  maxPolarAngle: Math.PI,
};

// ============================================
// LIGHT TYPES
// ============================================

export type LightType =
  | 'ambient'
  | 'directional'
  | 'point'
  | 'spot'
  | 'hemisphere'
  | 'rectarea';

export interface ShadowConfig {
  enabled: boolean;
  mapSize: number;
  bias: number;
  normalBias: number;
  radius: number;
  cameraNear: number;
  cameraFar: number;
  cameraLeft?: number;
  cameraRight?: number;
  cameraTop?: number;
  cameraBottom?: number;
}

export const DefaultShadowConfig: ShadowConfig = {
  enabled: true,
  mapSize: 2048,
  bias: -0.0001,
  normalBias: 0.02,
  radius: 4,
  cameraNear: 0.1,
  cameraFar: 100,
};

export interface LightConfig {
  id: string;
  type: LightType;
  color: Color;
  intensity: number;
  position?: Vector3;
  target?: Vector3;
  rotation?: Euler;
  castShadow?: boolean;
  shadow?: ShadowConfig;
  distance?: number;
  decay?: number;
  angle?: number;
  penumbra?: number;
  groundColor?: Color;
  width?: number;
  height?: number;
}

export const DefaultLightConfigs: Record<LightType, Omit<LightConfig, 'id'>> = {
  ambient: {
    type: 'ambient',
    color: createColor(1, 1, 1),
    intensity: 0.4,
  },
  directional: {
    type: 'directional',
    color: createColor(1, 1, 1),
    intensity: 1.0,
    position: createVector3(5, 10, 5),
    target: createVector3(0, 0, 0),
    castShadow: true,
    shadow: DefaultShadowConfig,
  },
  point: {
    type: 'point',
    color: createColor(1, 1, 1),
    intensity: 1.0,
    position: createVector3(0, 5, 0),
    distance: 10,
    decay: 2,
  },
  spot: {
    type: 'spot',
    color: createColor(1, 1, 1),
    intensity: 1.0,
    position: createVector3(0, 10, 0),
    target: createVector3(0, 0, 0),
    angle: Math.PI / 6,
    penumbra: 0.5,
    distance: 20,
    decay: 2,
    castShadow: true,
  },
  hemisphere: {
    type: 'hemisphere',
    color: createColor(0.6, 0.6, 1),
    groundColor: createColor(0.4, 0.3, 0.2),
    intensity: 0.5,
  },
  rectarea: {
    type: 'rectarea',
    color: createColor(1, 1, 1),
    intensity: 1.0,
    width: 2,
    height: 2,
  },
};

// ============================================
// MATERIAL TYPES
// ============================================

export type MaterialType =
  | 'standard'
  | 'phong'
  | 'lambert'
  | 'basic'
  | 'toon'
  | 'shader'
  | 'physical';

export type BlendMode = 'normal' | 'additive' | 'subtractive' | 'multiply';

export interface TextureConfig {
  path: string;
  repeat?: Vector2;
  offset?: Vector2;
  rotation?: number;
  center?: Vector2;
  wrapS?: 'repeat' | 'clamp' | 'mirror';
  wrapT?: 'repeat' | 'clamp' | 'mirror';
  anisotropy?: number;
  encoding?: 'srgb' | 'linear';
}

export interface MaterialConfig {
  id: string;
  type: MaterialType;
  name?: string;
  color?: Color;
  opacity?: number;
  transparent?: boolean;
  side?: 'front' | 'back' | 'double';
  metalness?: number;
  roughness?: number;
  emissive?: Color;
  emissiveIntensity?: number;
  map?: TextureConfig;
  normalMap?: TextureConfig;
  normalScale?: Vector2;
  roughnessMap?: TextureConfig;
  metalnessMap?: TextureConfig;
  aoMap?: TextureConfig;
  aoMapIntensity?: number;
  emissiveMap?: TextureConfig;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenColor?: Color;
  transmission?: number;
  thickness?: number;
  ior?: number;
  gradientMap?: TextureConfig;
  blendMode?: BlendMode;
  depthWrite?: boolean;
  depthTest?: boolean;
  renderOrder?: number;
  vertexShader?: string;
  fragmentShader?: string;
  uniforms?: Record<string, { value: unknown }>;
}

// ============================================
// MESH TYPES
// ============================================

export type GeometryType =
  | 'box'
  | 'sphere'
  | 'capsule'
  | 'cylinder'
  | 'cone'
  | 'plane'
  | 'torus'
  | 'torusknot'
  | 'icosahedron'
  | 'octahedron'
  | 'dodecahedron'
  | 'custom';

export interface GeometryConfig {
  type: GeometryType;
  customPath?: string;
  width?: number;
  height?: number;
  depth?: number;
  widthSegments?: number;
  heightSegments?: number;
  depthSegments?: number;
  radius?: number;
  radiusTop?: number;
  radiusBottom?: number;
  radialSegments?: number;
  openEnded?: boolean;
  tube?: number;
  tubularSegments?: number;
  arc?: number;
  p?: number;
  q?: number;
  length?: number;
  capSegments?: number;
  detail?: number;
}

export interface MeshConfig {
  id: string;
  geometry: GeometryConfig;
  material: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
  visible?: boolean;
  renderOrder?: number;
  frustumCulled?: boolean;
}

// ============================================
// POST-PROCESSING TYPES
// ============================================

export interface PostProcessingConfig {
  enabled: boolean;
  passes: PostProcessingPass[];
}

export type PostProcessingPassType =
  | 'bloom'
  | 'dof'
  | 'motionblur'
  | 'chromaticaberration'
  | 'vignette'
  | 'colorgrading'
  | 'ssao'
  | 'ssr'
  | 'smaa'
  | 'fxaa';

export interface PostProcessingPass {
  type: PostProcessingPassType;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface BloomConfig {
  intensity: number;
  luminanceThreshold: number;
  luminanceSmoothing: number;
  mipmapBlur: boolean;
  radius: number;
}

export interface DOFConfig {
  focusDistance: number;
  focalLength: number;
  bokehScale: number;
  height: number;
}

export interface VignetteConfig {
  offset: number;
  darkness: number;
}

export interface ChromaticAberrationConfig {
  offset: Vector2;
  radialModulation: boolean;
  modulationOffset: number;
}

// ============================================
// VIEWPORT TYPES
// ============================================

export type ViewportMode = 'perspective' | 'top' | 'front' | 'side';
export type ViewportRenderMode = 'solid' | 'wireframe' | 'rendered';

export interface ViewportConfig {
  mode: ViewportMode;
  renderMode: ViewportRenderMode;
  showGrid: boolean;
  showAxes: boolean;
  showStats: boolean;
  backgroundColor: Color;
  gridSize: number;
  gridDivisions: number;
}

export const DefaultViewportConfig: ViewportConfig = {
  mode: 'perspective',
  renderMode: 'solid',
  showGrid: true,
  showAxes: true,
  showStats: false,
  backgroundColor: createColor(0.1, 0.1, 0.12),
  gridSize: 20,
  gridDivisions: 20,
};
