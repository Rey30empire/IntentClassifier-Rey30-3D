/**
 * NEXUS Engine - Advanced Shader System
 * 
 * Sistema completo de gestión de shaders con:
 * - Shader library y cache
 * - Hot reloading
 * - Uniform management
 * - Shader variants
 * - Compute shaders
 * - Custom shader nodes
 */

import { generateId } from '../../conversion/types';

// ============================================
// SHADER TYPES
// ============================================

/** Tipo de shader */
export type ShaderType = 
  | 'vertex'
  | 'fragment'
  | 'geometry'
  | 'compute'
  | 'tessellation_control'
  | 'tessellation_evaluation';

/** Tipo de uniform */
export type UniformType =
  | 'float'
  | 'int'
  | 'uint'
  | 'bool'
  | 'vec2'
  | 'vec3'
  | 'vec4'
  | 'ivec2'
  | 'ivec3'
  | 'ivec4'
  | 'uvec2'
  | 'uvec3'
  | 'uvec4'
  | 'mat2'
  | 'mat3'
  | 'mat4'
  | 'sampler2D'
  | 'samplerCube'
  | 'sampler2DArray'
  | 'sampler2DShadow'
  | 'samplerCubeShadow'
  | 'image2D'
  | 'image3D';

/** Tipo de attribute */
export type AttributeType =
  | 'float'
  | 'vec2'
  | 'vec3'
  | 'vec4'
  | 'int'
  | 'ivec2'
  | 'ivec3'
  | 'ivec4'
  | 'mat2'
  | 'mat3'
  | 'mat4';

/** Definición de uniform */
export interface UniformDefinition {
  name: string;
  type: UniformType;
  defaultValue?: number | number[] | string;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  group?: string;
  hidden?: boolean;
  editable?: boolean;
}

/** Definición de attribute */
export interface AttributeDefinition {
  name: string;
  type: AttributeType;
  location: number;
  description?: string;
}

/** Definición de varyings */
export interface VaryingDefinition {
  name: string;
  type: string;
  interpolation?: 'smooth' | 'flat' | 'noperspective';
}

/** Shader source */
export interface ShaderSource {
  vertex?: string;
  fragment?: string;
  geometry?: string;
  compute?: string;
  tessellationControl?: string;
  tessellationEvaluation?: string;
}

/** Shader variant */
export interface ShaderVariant {
  id: string;
  name: string;
  defines: Record<string, string | number | boolean>;
}

// ============================================
// SHADER PROGRAM
// ============================================

/** Programa de shader compilado */
export interface ShaderProgram {
  id: string;
  name: string;
  
  // Sources
  sources: ShaderSource;
  
  // Metadata
  uniforms: Map<string, UniformDefinition>;
  attributes: Map<string, AttributeDefinition>;
  varyings: Map<string, VaryingDefinition>;
  
  // Variants
  variants: Map<string, ShaderVariant>;
  activeVariantId: string | null;
  
  // State
  compiled: boolean;
  compileErrors: string[];
  warnings: string[];
  
  // Cache
  uniformLocations: Map<string, number>;
  attributeLocations: Map<string, number>;
  
  // Hot reload
  lastModified: number;
  filePath?: string;
}

// ============================================
// PBR SHADER DEFINITIONS
// ============================================

/** Parámetros PBR */
export interface PBRParameters {
  // Albedo
  albedoColor: [number, number, number];
  albedoMap: string | null;
  
  // Metallic/Roughness
  metallic: number;
  metallicMap: string | null;
  roughness: number;
  roughnessMap: string | null;
  
  // Normal
  normalMap: string | null;
  normalIntensity: number;
  
  // Height/Parallax
  heightMap: string | null;
  parallaxScale: number;
  parallaxSteps: number;
  
  // AO
  aoMap: string | null;
  aoIntensity: number;
  
  // Emission
  emissionColor: [number, number, number];
  emissionMap: string | null;
  emissionIntensity: number;
  
  // Subsurface
  subsurfaceColor: [number, number, number];
  subsurfaceRadius: [number, number, number];
  subsurfaceFactor: number;
  
  // Clearcoat
  clearcoat: number;
  clearcoatRoughness: number;
  clearcoatNormalMap: string | null;
  
  // Anisotropy
  anisotropy: number;
  anisotropyDirection: [number, number, number];
  
  // Sheen
  sheenColor: [number, number, number];
  sheenRoughness: number;
  
  // IOR
  ior: number;
  transmission: number;
  thickness: number;
}

/** Vertex shader PBR base */
export const PBR_VERTEX_SHADER = `
precision highp float;

// Attributes
attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec4 a_tangent;
attribute vec2 a_texcoord;
attribute vec4 a_color;
attribute vec4 a_jointIndices;
attribute vec4 a_jointWeights;

// Uniforms
uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat4 u_modelViewMatrix;
uniform mat3 u_normalMatrix;
uniform vec3 u_cameraPosition;

// Skinning
#ifdef SKINNING
uniform mat4 u_boneMatrices[256];
uniform int u_numBones;
#endif

// Morphing
#ifdef MORPHING
uniform float u_morphWeights[8];
attribute vec3 a_morphPosition0;
attribute vec3 a_morphPosition1;
attribute vec3 a_morphPosition2;
attribute vec3 a_morphPosition3;
#endif

// Varyings
varying vec3 v_worldPosition;
varying vec3 v_viewPosition;
varying vec3 v_normal;
varying vec4 v_tangent;
varying vec2 v_texcoord;
varying vec4 v_color;
varying mat3 v_tbnMatrix;

void main() {
    vec3 position = a_position;
    vec3 normal = a_normal;
    vec4 tangent = a_tangent;
    
    // Skinning
    #ifdef SKINNING
        mat4 skinMatrix = 
            a_jointWeights.x * u_boneMatrices[int(a_jointIndices.x)] +
            a_jointWeights.y * u_boneMatrices[int(a_jointIndices.y)] +
            a_jointWeights.z * u_boneMatrices[int(a_jointIndices.z)] +
            a_jointWeights.w * u_boneMatrices[int(a_jointIndices.w)];
        
        position = (skinMatrix * vec4(position, 1.0)).xyz;
        normal = (skinMatrix * vec4(normal, 0.0)).xyz;
        tangent = skinMatrix * tangent;
    #endif
    
    // Morphing
    #ifdef MORPHING
        position += u_morphWeights[0] * a_morphPosition0;
        position += u_morphWeights[1] * a_morphPosition1;
        position += u_morphWeights[2] * a_morphPosition2;
        position += u_morphWeights[3] * a_morphPosition3;
    #endif
    
    // Calculate positions
    vec4 worldPosition = u_modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = u_viewMatrix * worldPosition;
    
    v_worldPosition = worldPosition.xyz;
    v_viewPosition = viewPosition.xyz;
    
    // Transform normal and tangent
    v_normal = normalize(u_normalMatrix * normal);
    v_tangent = vec4(normalize(u_normalMatrix * tangent.xyz), tangent.w);
    
    // Calculate TBN matrix
    vec3 T = normalize(v_tangent.xyz);
    vec3 B = cross(v_normal, T) * v_tangent.w;
    vec3 N = v_normal;
    v_tbnMatrix = mat3(T, B, N);
    
    // Pass through
    v_texcoord = a_texcoord;
    v_color = a_color;
    
    gl_Position = u_projectionMatrix * viewPosition;
}
`;

/** Fragment shader PBR base */
export const PBR_FRAGMENT_SHADER = `
precision highp float;

// Varyings from vertex
varying vec3 v_worldPosition;
varying vec3 v_viewPosition;
varying vec3 v_normal;
varying vec4 v_tangent;
varying vec2 v_texcoord;
varying vec4 v_color;
varying mat3 v_tbnMatrix;

// Material uniforms
uniform vec3 u_albedoColor;
uniform sampler2D u_albedoMap;

uniform float u_metallic;
uniform sampler2D u_metallicMap;

uniform float u_roughness;
uniform sampler2D u_roughnessMap;

uniform sampler2D u_normalMap;
uniform float u_normalIntensity;

uniform sampler2D u_heightMap;
uniform float u_parallaxScale;
uniform int u_parallaxSteps;

uniform sampler2D u_aoMap;
uniform float u_aoIntensity;

uniform vec3 u_emissionColor;
uniform sampler2D u_emissionMap;
uniform float u_emissionIntensity;

// Subsurface
uniform vec3 u_subsurfaceColor;
uniform vec3 u_subsurfaceRadius;
uniform float u_subsurfaceFactor;

// Clearcoat
uniform float u_clearcoat;
uniform float u_clearcoatRoughness;
uniform sampler2D u_clearcoatNormalMap;

// Anisotropy
uniform float u_anisotropy;
uniform vec3 u_anisotropyDirection;

// IOR/Transmission
uniform float u_ior;
uniform float u_transmission;
uniform float u_thickness;

// Environment
uniform samplerCube u_envMap;
uniform samplerCube u_envMapPrefiltered;
uniform sampler2D u_brdfLUT;
uniform int u_envMapMipLevels;

// Lighting uniforms
uniform vec3 u_cameraPosition;
uniform int u_numLights;
uniform vec3 u_lightPositions[16];
uniform vec3 u_lightColors[16];
uniform float u_lightIntensities[16];
uniform float u_lightRadii[16];
uniform int u_lightTypes[16]; // 0=directional, 1=point, 2=spot
uniform vec3 u_lightDirections[16];
uniform float u_lightInnerAngles[16];
uniform float u_lightOuterAngles[16];

// Shadow
uniform sampler2D u_shadowMap;
uniform mat4 u_shadowMatrix;
uniform float u_shadowBias;
uniform int u_shadowSamples;
uniform float u_shadowRadius;

// Global
uniform float u_time;
uniform vec4 u_viewport;

// Constants
const float PI = 3.14159265359;
const float EPSILON = 0.0001;

// Utility functions
float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec3 saturate(vec3 x) {
    return clamp(x, vec3(0.0), vec3(1.0));
}

float pow2(float x) {
    return x * x;
}

// Distribution function (GGX/Trowbridge-Reitz)
float D_GGX(float NdotH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH2 = NdotH * NdotH;
    
    float nom = a2;
    float denom = NdotH2 * (a2 - 1.0) + 1.0;
    denom = PI * denom * denom;
    
    return nom / denom;
}

// Geometry function (Smith's method with Schlick-GGX)
float G_SchlickGGX(float NdotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;
    
    return NdotV / (NdotV * (1.0 - k) + k);
}

float G_Smith(float NdotV, float NdotL, float roughness) {
    float ggx1 = G_SchlickGGX(NdotV, roughness);
    float ggx2 = G_SchlickGGX(NdotL, roughness);
    
    return ggx1 * ggx2;
}

// Fresnel function (Schlick approximation)
vec3 F_Schlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

// Fresnel with roughness (for IBL)
vec3 F_SchlickRoughness(float cosTheta, vec3 F0, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
}

// Parallax mapping
vec2 parallaxMapping(vec2 uv, vec3 viewDir) {
    float numLayers = float(u_parallaxSteps);
    float layerDepth = 1.0 / numLayers;
    float currentLayerDepth = 0.0;
    vec2 deltaUV = viewDir.xy * u_parallaxScale / numLayers;
    vec2 currentUV = uv;
    float currentDepth = texture2D(u_heightMap, currentUV).r;
    
    while (currentLayerDepth < currentDepth) {
        currentUV -= deltaUV;
        currentDepth = texture2D(u_heightMap, currentUV).r;
        currentLayerDepth += layerDepth;
    }
    
    // Parallax occlusion mapping refinement
    vec2 prevUV = currentUV + deltaUV;
    float afterDepth = currentDepth - currentLayerDepth;
    float beforeDepth = texture2D(u_heightMap, prevUV).r - currentLayerDepth + layerDepth;
    float weight = afterDepth / (afterDepth - beforeDepth);
    
    return prevUV * weight + currentUV * (1.0 - weight);
}

// Get surface normal (with normal mapping)
vec3 getNormal(vec2 uv) {
    #ifdef NORMAL_MAP
        vec3 tangentNormal = texture2D(u_normalMap, uv).rgb * 2.0 - 1.0;
        tangentNormal.xy *= u_normalIntensity;
        return normalize(v_tbnMatrix * tangentNormal);
    #else
        return normalize(v_normal);
    #endif
}

// Calculate direct lighting
vec3 calculateDirectLight(
    vec3 L, vec3 V, vec3 N, vec3 albedo, float metallic, float roughness, vec3 F0,
    vec3 lightColor, float lightIntensity, float attenuation
) {
    vec3 H = normalize(V + L);
    
    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    float NdotH = max(dot(N, H), 0.0);
    float HdotV = max(dot(H, V), 0.0);
    
    // Cook-Torrance BRDF
    float D = D_GGX(NdotH, roughness);
    float G = G_Smith(NdotV, NdotL, roughness);
    vec3 F = F_Schlick(HdotV, F0);
    
    vec3 numerator = D * G * F;
    float denominator = 4.0 * NdotV * NdotL + EPSILON;
    vec3 specular = numerator / denominator;
    
    // Energy conservation
    vec3 kS = F;
    vec3 kD = (1.0 - kS) * (1.0 - metallic);
    
    vec3 diffuse = kD * albedo / PI;
    
    return (diffuse + specular) * lightColor * lightIntensity * attenuation * NdotL;
}

// Calculate IBL (Image Based Lighting)
vec3 calculateIBL(vec3 N, vec3 V, vec3 albedo, float metallic, float roughness, vec3 F0) {
    vec3 R = reflect(-V, N);
    float NdotV = max(dot(N, V), 0.0);
    
    // Diffuse IBL
    vec3 F = F_SchlickRoughness(NdotV, F0, roughness);
    vec3 kS = F;
    vec3 kD = (1.0 - kS) * (1.0 - metallic);
    
    vec3 irradiance = textureCube(u_envMap, N).rgb;
    vec3 diffuse = irradiance * albedo;
    
    // Specular IBL
    float MAX_REFLECTION_LOD = float(u_envMapMipLevels);
    vec3 prefilteredColor = textureCube(u_envMapPrefiltered, R, roughness * MAX_REFLECTION_LOD).rgb;
    vec2 brdf = texture2D(u_brdfLUT, vec2(NdotV, roughness)).rg;
    vec3 specular = prefilteredColor * (F * brdf.x + brdf.y);
    
    return kD * diffuse + specular;
}

// Shadow calculation
float calculateShadow(vec4 shadowCoord) {
    #ifdef SHADOWS
        vec2 uv = shadowCoord.xy / shadowCoord.w;
        float currentDepth = shadowCoord.z / shadowCoord.w;
        
        // PCF
        float shadow = 0.0;
        vec2 texelSize = 1.0 / vec2(2048.0); // Shadow map size
        
        for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
                float pcfDepth = texture2D(u_shadowMap, uv + vec2(x, y) * texelSize).r;
                shadow += currentDepth - u_shadowBias > pcfDepth ? 1.0 : 0.0;
            }
        }
        
        return 1.0 - shadow / 9.0;
    #else
        return 1.0;
    #endif
}

// Main
void main() {
    vec2 uv = v_texcoord;
    
    // Parallax mapping
    #ifdef HEIGHT_MAP
        vec3 viewDir = normalize(v_tbnMatrix * (u_cameraPosition - v_worldPosition));
        uv = parallaxMapping(uv, viewDir);
    #endif
    
    // Get material properties
    vec4 albedoSample = texture2D(u_albedoMap, uv);
    vec3 albedo = u_albedoColor * albedoSample.rgb * v_color.rgb;
    
    float metallic = u_metallic * texture2D(u_metallicMap, uv).r;
    float roughness = u_roughness * texture2D(u_roughnessMap, uv).r;
    float ao = mix(1.0, texture2D(u_aoMap, uv).r, u_aoIntensity);
    
    vec3 emission = u_emissionColor * texture2D(u_emissionMap, uv).rgb * u_emissionIntensity;
    
    vec3 N = getNormal(uv);
    vec3 V = normalize(u_cameraPosition - v_worldPosition);
    
    // Calculate F0
    vec3 F0 = mix(vec3(0.04), albedo, metallic);
    
    // Initialize output color
    vec3 Lo = vec3(0.0);
    
    // Calculate lights
    for (int i = 0; i < 16; i++) {
        if (i >= u_numLights) break;
        
        vec3 L;
        float attenuation = 1.0;
        
        if (u_lightTypes[i] == 0) {
            // Directional light
            L = normalize(-u_lightDirections[i]);
        } else {
            // Point/spot light
            L = u_lightPositions[i] - v_worldPosition;
            float distance = length(L);
            L = normalize(L);
            
            // Distance attenuation
            float radius = u_lightRadii[i];
            attenuation = 1.0 / (1.0 + pow2(distance / radius));
            attenuation *= pow2(max(0.0, 1.0 - pow2(distance / radius)));
            
            if (u_lightTypes[i] == 2) {
                // Spot light
                float theta = dot(L, normalize(-u_lightDirections[i]));
                float inner = cos(u_lightInnerAngles[i]);
                float outer = cos(u_lightOuterAngles[i]);
                float epsilon = inner - outer;
                attenuation *= clamp((theta - outer) / epsilon, 0.0, 1.0);
            }
        }
        
        Lo += calculateDirectLight(
            L, V, N, albedo, metallic, roughness, F0,
            u_lightColors[i], u_lightIntensities[i], attenuation
        );
    }
    
    // Add IBL
    vec3 ambient = calculateIBL(N, V, albedo, metallic, roughness, F0) * ao;
    
    // Shadow
    vec4 shadowCoord = u_shadowMatrix * vec4(v_worldPosition, 1.0);
    float shadow = calculateShadow(shadowCoord);
    
    // Combine
    vec3 color = ambient + Lo * shadow + emission;
    
    // Output
    gl_FragColor = vec4(color, albedoSample.a * v_color.a);
}
`;

// ============================================
// SHADER LIBRARY
// ============================================

/** Shaders predefinidos */
export const SHADER_LIBRARY: Record<string, ShaderSource> = {
  // Basic
  'unlit': {
    vertex: `
      attribute vec3 a_position;
      attribute vec2 a_texcoord;
      uniform mat4 u_mvp;
      varying vec2 v_uv;
      void main() {
        v_uv = a_texcoord;
        gl_Position = u_mvp * vec4(a_position, 1.0);
      }
    `,
    fragment: `
      precision mediump float;
      uniform vec4 u_color;
      uniform sampler2D u_texture;
      varying vec2 v_uv;
      void main() {
        gl_FragColor = texture2D(u_texture, v_uv) * u_color;
      }
    `,
  },
  
  // PBR
  'pbr': {
    vertex: PBR_VERTEX_SHADER,
    fragment: PBR_FRAGMENT_SHADER,
  },
  
  // Skybox
  'skybox': {
    vertex: `
      attribute vec3 a_position;
      uniform mat4 u_view;
      uniform mat4 u_projection;
      varying vec3 v_direction;
      void main() {
        v_direction = a_position;
        vec4 pos = u_projection * mat4(mat3(u_view)) * vec4(a_position, 1.0);
        gl_Position = pos.xyww;
      }
    `,
    fragment: `
      precision mediump float;
      uniform samplerCube u_envMap;
      varying vec3 v_direction;
      void main() {
        gl_FragColor = textureCube(u_envMap, v_direction);
      }
    `,
  },
  
  // Depth
  'depth': {
    vertex: `
      attribute vec3 a_position;
      uniform mat4 u_mvp;
      void main() {
        gl_Position = u_mvp * vec4(a_position, 1.0);
      }
    `,
    fragment: `
      precision mediump float;
      void main() {
        gl_FragColor = vec4(1.0);
      }
    `,
  },
  
  // Normal visualization
  'normal_visualization': {
    vertex: `
      attribute vec3 a_position;
      attribute vec3 a_normal;
      uniform mat4 u_mvp;
      uniform mat3 u_normalMatrix;
      varying vec3 v_normal;
      void main() {
        v_normal = u_normalMatrix * a_normal;
        gl_Position = u_mvp * vec4(a_position, 1.0);
      }
    `,
    fragment: `
      precision mediump float;
      varying vec3 v_normal;
      void main() {
        vec3 n = normalize(v_normal) * 0.5 + 0.5;
        gl_FragColor = vec4(n, 1.0);
      }
    `,
  },
  
  // Grid
  'grid': {
    vertex: `
      attribute vec3 a_position;
      uniform mat4 u_mvp;
      varying vec3 v_position;
      void main() {
        v_position = a_position;
        gl_Position = u_mvp * vec4(a_position, 1.0);
      }
    `,
    fragment: `
      precision mediump float;
      varying vec3 v_position;
      void main() {
        vec2 grid = abs(fract(v_position.xz - 0.5) - 0.5) / fwidth(v_position.xz);
        float line = min(grid.x, grid.y);
        float alpha = 1.0 - min(line, 1.0);
        gl_FragColor = vec4(0.5, 0.5, 0.5, alpha * 0.5);
      }
    `,
  },
};

// ============================================
// SHADER MANAGER
// ============================================

/**
 * Manager de shaders
 */
export class ShaderManager {
  private programs: Map<string, ShaderProgram> = new Map();
  private cache: Map<string, number> = new Map();
  private hotReloadEnabled: boolean = false;
  
  constructor() {
    // Initialize with library shaders
    this.initializeLibrary();
  }
  
  private initializeLibrary(): void {
    for (const [name, sources] of Object.entries(SHADER_LIBRARY)) {
      this.createProgram(name, sources);
    }
  }
  
  /**
   * Crear programa de shader
   */
  createProgram(name: string, sources: ShaderSource): ShaderProgram | null {
    const program: ShaderProgram = {
      id: generateId(),
      name,
      sources,
      uniforms: new Map(),
      attributes: new Map(),
      varyings: new Map(),
      variants: new Map(),
      activeVariantId: null,
      compiled: false,
      compileErrors: [],
      warnings: [],
      uniformLocations: new Map(),
      attributeLocations: new Map(),
      lastModified: Date.now(),
    };
    
    // Parse uniforms and attributes from source
    this.parseShaderSource(program);
    
    this.programs.set(name, program);
    return program;
  }
  
  /**
   * Parsear source para extraer uniforms y attributes
   */
  private parseShaderSource(program: ShaderProgram): void {
    const allSources = [
      program.sources.vertex,
      program.sources.fragment,
      program.sources.geometry,
    ].filter(Boolean).join('\n');
    
    // Parse uniforms
    const uniformRegex = /uniform\s+(\w+)\s+(\w+)(?:\[(\d+)\])?;/g;
    let match;
    
    while ((match = uniformRegex.exec(allSources)) !== null) {
      const type = match[1] as UniformType;
      const name = match[2];
      const arraySize = match[3] ? parseInt(match[3]) : undefined;
      
      program.uniforms.set(name, {
        name,
        type,
        defaultValue: this.getDefaultValue(type),
        editable: true,
      });
    }
    
    // Parse attributes
    const attributeRegex = /attribute\s+(\w+)\s+(\w+)(?:\[(\d+)\])?;/g;
    
    while ((match = attributeRegex.exec(allSources)) !== null) {
      const type = match[1] as AttributeType;
      const name = match[2];
      
      program.attributes.set(name, {
        name,
        type,
        location: program.attributes.size,
      });
    }
  }
  
  /**
   * Obtener valor por defecto para tipo de uniform
   */
  private getDefaultValue(type: UniformType): number | number[] {
    switch (type) {
      case 'float': return 0;
      case 'int':
      case 'uint':
      case 'bool': return 0;
      case 'vec2':
      case 'ivec2':
      case 'uvec2': return [0, 0];
      case 'vec3':
      case 'ivec3':
      case 'uvec3': return [0, 0, 0];
      case 'vec4':
      case 'ivec4':
      case 'uvec4': return [0, 0, 0, 1];
      case 'mat2': return [1, 0, 0, 1];
      case 'mat3': return [1, 0, 0, 0, 1, 0, 0, 0, 1];
      case 'mat4': return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      default: return 0;
    }
  }
  
  /**
   * Obtener programa
   */
  getProgram(name: string): ShaderProgram | null {
    return this.programs.get(name) || null;
  }
  
  /**
   * Crear variante de shader
   */
  createVariant(programName: string, variantName: string, defines: Record<string, string | number | boolean>): ShaderVariant | null {
    const program = this.programs.get(programName);
    if (!program) return null;
    
    const variant: ShaderVariant = {
      id: generateId(),
      name: variantName,
      defines,
    };
    
    program.variants.set(variant.id, variant);
    return variant;
  }
  
  /**
   * Obtener source con defines aplicados
   */
  getSourceWithVariant(program: ShaderProgram, variantId?: string): ShaderSource {
    const variant = variantId ? program.variants.get(variantId) : null;
    
    if (!variant) {
      return program.sources;
    }
    
    const defineStrings = Object.entries(variant.defines)
      .map(([key, value]) => `#define ${key} ${value}`)
      .join('\n');
    
    const applyDefines = (source: string | undefined) => {
      if (!source) return source;
      // Insert defines after version directive if present
      const lines = source.split('\n');
      const insertIndex = lines[0].startsWith('#version') ? 1 : 0;
      lines.splice(insertIndex, 0, defineStrings);
      return lines.join('\n');
    };
    
    return {
      vertex: applyDefines(program.sources.vertex),
      fragment: applyDefines(program.sources.fragment),
      geometry: applyDefines(program.sources.geometry),
    };
  }
  
  /**
   * Hot reload
   */
  enableHotReload(enabled: boolean): void {
    this.hotReloadEnabled = enabled;
  }
  
  /**
   * Reload shader desde archivo
   */
  async reloadFromFile(programName: string): Promise<boolean> {
    const program = this.programs.get(programName);
    if (!program || !program.filePath) return false;
    
    try {
      const response = await fetch(program.filePath);
      const source = await response.text();
      
      // Parse and update
      program.sources.fragment = source;
      program.lastModified = Date.now();
      program.compiled = false;
      
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Obtener todos los programas
   */
  getAllPrograms(): ShaderProgram[] {
    return Array.from(this.programs.values());
  }
  
  /**
   * Eliminar programa
   */
  deleteProgram(name: string): boolean {
    return this.programs.delete(name);
  }
}

// ============================================
// FACTORY
// ============================================

export function createShaderManager(): ShaderManager {
  return new ShaderManager();
}

export default ShaderManager;
