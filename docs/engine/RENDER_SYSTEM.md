# Render System - Documentación

## Visión General

El Render System es responsable de todo el renderizado 3D del motor Rey30_NEXUS. Utiliza Three.js como backend WebGL y está integrado con React Three Fiber para el renderizado declarativo.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                      RENDER SYSTEM                               │
├─────────────────────────────────────────────────────────────────┤
│  RenderSystem                                                    │
│  ├── Renderer (WebGL configuration)                             │
│  ├── CameraSystem (Editor + Game cameras)                       │
│  ├── LightingSystem (Dynamic lights)                            │
│  └── PostProcessing (Effects pipeline)                          │
├─────────────────────────────────────────────────────────────────┤
│  MaterialSystem                                                  │
│  ├── MaterialCache (Reuse materials)                            │
│  ├── ShaderLibrary (Custom shaders)                             │
│  └── TextureManager (Load/cache textures)                       │
├─────────────────────────────────────────────────────────────────┤
│  ViewportSystem                                                  │
│  ├── EditorViewport (Editor camera)                             │
│  ├── GameViewport (Runtime camera)                              │
│  └── GizmoRenderer (Transform gizmos)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Módulos

### 1. RenderSystem

**Responsabilidades:**
- Configurar el renderer WebGL
- Gestionar el ciclo de renderizado
- Manejar resoluciones y anti-aliasing
- Configurar sombras

**API:**
```typescript
interface RenderSystemConfig {
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  toneMapping: ToneMappingType;
  toneMappingExposure: number;
  outputColorSpace: ColorSpace;
}

class RenderSystem {
  initialize(config: RenderSystemConfig): void;
  render(scene: Scene, camera: Camera): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
```

### 2. CameraSystem

**Responsabilidades:**
- Gestionar cámaras de editor y juego
- Cámaras múltiples (perspective, orthographic)
- Frustum culling
- Camera layers

**API:**
```typescript
interface CameraConfig {
  type: 'perspective' | 'orthographic';
  fov?: number;
  near: number;
  far: number;
  position: Vector3;
  target: Vector3;
}

class CameraSystem {
  createCamera(id: string, config: CameraConfig): Camera;
  getActiveCamera(): Camera;
  setActiveCamera(id: string): void;
  setCameraMode(mode: 'perspective' | 'orthographic' | 'top' | 'front' | 'side'): void;
}
```

### 3. LightingSystem

**Responsabilidades:**
- Gestión de luces dinámicas
- Tipos: ambient, directional, point, spot, hemisphere
- Sombras dinámicas
- Light probes

**API:**
```typescript
interface LightConfig {
  type: 'ambient' | 'directional' | 'point' | 'spot' | 'hemisphere';
  color: Color;
  intensity: number;
  position?: Vector3;
  target?: Vector3;
  castShadow?: boolean;
  shadowConfig?: ShadowConfig;
}

class LightingSystem {
  createLight(id: string, config: LightConfig): Light;
  removeLight(id: string): void;
  updateLight(id: string, updates: Partial<LightConfig>): void;
  getLights(): Light[];
}
```

### 4. MaterialSystem

**Responsabilidades:**
- Caché de materiales
- Materiales PBR estándar
- Shaders personalizados
- Variantes de material

**API:**
```typescript
interface MaterialConfig {
  type: 'standard' | 'phong' | 'lambert' | 'basic' | 'shader';
  color?: Color;
  metalness?: number;
  roughness?: number;
  emissive?: Color;
  emissiveIntensity?: number;
  normalMap?: string;
  roughnessMap?: string;
  metalnessMap?: string;
  aoMap?: string;
}

class MaterialSystem {
  createMaterial(id: string, config: MaterialConfig): Material;
  getMaterial(id: string): Material | undefined;
  cloneMaterial(sourceId: string, newId: string): Material;
  updateMaterial(id: string, updates: Partial<MaterialConfig>): void;
  disposeMaterial(id: string): void;
}
```

### 5. PostProcessing

**Responsabilidades:**
- Efectos post-proceso
- Bloom, DOF, Motion Blur
- Color grading
- Anti-aliasing (SMAA, FXAA)

**Efectos Disponibles:**
- Bloom (glow effects)
- Depth of Field (DOF)
- Motion Blur
- Chromatic Aberration
- Vignette
- Color Grading (LUT)
- Ambient Occlusion (SSAO)
- Screen Space Reflections (SSR)

---

## Integración con ECS

El Render System se integra con el ECS mediante componentes:

```typescript
// Componente MeshRenderer
interface MeshRendererComponent {
  meshId: string;
  materialId: string;
  castShadow: boolean;
  receiveShadow: boolean;
  visible: boolean;
  renderOrder: number;
}

// Componente Light
interface LightComponent {
  type: LightType;
  color: Color;
  intensity: number;
  castShadow: boolean;
}

// Componente Camera
interface CameraComponent {
  type: 'perspective' | 'orthographic';
  fov: number;
  near: number;
  far: number;
  priority: number;
  layers: number[];
}
```

---

## Rendimiento

### Objetivos
- 60 FPS con 10,000 objetos en escena
- 30 FPS con 100,000 partículas
- Shadow map rendering < 5ms
- Post-processing < 3ms

### Optimizaciones
- Frustum culling automático
- Occlusion culling (opcional)
- LOD (Level of Detail)
- Instancing para objetos repetidos
- Material batching
- Texture atlasing

---

## Dependencias

```json
{
  "three": "^0.160.0",
  "@react-three/fiber": "^8.15.0",
  "@react-three/drei": "^9.92.0",
  "@react-three/postprocessing": "^2.16.0",
  "postprocessing": "^6.34.0"
}
```

---

## Estado de Implementación

### ✅ Completado
- [x] Documentación

### 📋 Pendiente
- [ ] RenderSystem.ts - Core renderer
- [ ] CameraSystem.ts - Camera management
- [ ] LightingSystem.ts - Light management
- [ ] MaterialSystem.ts - Material cache
- [ ] PostProcessing.ts - Effects pipeline
- [ ] ShaderLibrary.ts - Custom shaders
- [ ] Integración con Viewport3D
