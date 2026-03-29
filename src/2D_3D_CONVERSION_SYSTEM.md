# NEXUS Engine - Sistema de Conversión 2D/3D

## Documentación Técnica Completa

**Versión:** 1.0.0  
**Autor:** Arquitecto Senior de Motores 3D  
**Fecha:** 2025

---

## Índice

1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Módulos Detallados](#módulos-detallados)
4. [Pipelines de Conversión](#pipelines-de-conversión)
5. [Tipos e Interfaces](#tipos-e-interfaces)
6. [Sistema de Calidad y Confianza](#sistema-de-calidad-y-confianza)
7. [Integración con el Motor](#integración-con-el-motor)
8. [Errores a Evitar](#errores-a-evitar)
9. [Orden de Implementación](#orden-de-implementación)

---

## Visión General

### Objetivo General

Sistema unificado que permite crear contenido 3D a partir de múltiples tipos de entrada:

1. **Dibujo 2D** hecho dentro de la app
2. **Varios dibujos** del mismo objeto/personaje en diferentes ángulos
3. **Una imagen** subida por el usuario
4. **Varias imágenes** del mismo objeto/personaje en diferentes ángulos
5. **Conjunto de fotos** de un objeto real para escanearlo
6. **Un video** alrededor de un objeto real
7. **Escaneo de entorno** o habitación para crear una escena 3D base

### Resultados Esperados

- Malla 3D base editable
- Modelo 3D base editable
- Escena 3D base editable
- Blockout 3D paramétrico
- Reconstrucción 3D por fotogrametría
- Geometría sugerida por interpretación de intención

---

## Arquitectura del Sistema

### Diagrama de Módulos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         2D/3D CONVERSION SYSTEM                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐   ┌─────────────────┐   ┌──────────────────┐              │
│  │ INPUT LAYER │──▶│ PREPROCESSING   │──▶│ INTERPRETATION   │              │
│  │             │   │ LAYER           │   │ LAYER            │              │
│  └─────────────┘   └─────────────────┘   └──────────────────┘              │
│         │                   │                      │                        │
│         ▼                   ▼                      ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    GEOMETRY RECONSTRUCTION LAYER                 │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────┐   ┌─────────────────┐   ┌──────────────────┐          │
│  │ TEMPLATE/       │──▶│ POSTPROCESSING  │──▶│ INTERNAL         │          │
│  │ ASSISTED GEN    │   │ LAYER           │   │ REPRESENTATION   │          │
│  └─────────────────┘   └─────────────────┘   └──────────────────┘          │
│                                                       │                     │
│                                                       ▼                     │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                         UI/UX LAYER                              │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │              COMMANDS / HISTORY / SERIALIZATION                  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Capas del Sistema

| Capa | Responsabilidad | Módulos |
|------|----------------|---------|
| INPUT | Recibir y organizar entradas | SketchInputSystem, ImageImportSystem, VideoImportSystem |
| PREPROCESSING | Limpiar y preparar datos | ImagePreprocessor, SilhouetteExtractor, FeatureDetector |
| INTERPRETATION | Entender intención del usuario | IntentClassifier, TemplateSuggestionEngine |
| RECONSTRUCTION | Generar geometría 3D | SingleViewProxyBuilder, PhotoGrammetryReconstructor |
| TEMPLATE | Generar bases paramétricas | Template3DGenerator, HumanBaseGenerator |
| POSTPROCESSING | Limpiar resultados | MeshCleanupSystem, RemeshSystem |
| REPRESENTATION | Formato interno editable | EditableMesh, EditableObject3D, EditableScene3D |
| UI/UX | Interfaz de usuario | ConversionWizardPanel, Preview panels |

---

## Módulos Detallados

### 1. INPUT LAYER

#### SketchInputSystem
```typescript
/**
 * Sistema para capturar y gestionar dibujos 2D creados dentro de la app.
 * Soporta:
 * - Trazos vectoriales
 * - Múltiples capas
 * - Diferentes vistas (frente, lado, atrás, perspectiva)
 */
class SketchInputSystem {
  // Crear nueva sesión de dibujo
  createSketchSession(): SketchSession;
  
  // Capturar trazo
  captureStroke(stroke: Stroke): void;
  
  // Registrar vista
  registerView(view: SketchView): void;
  
  // Exportar a formato interno
  exportToInternal(): SketchData;
}
```

#### ImageImportSystem
```typescript
/**
 * Sistema para importar y gestionar imágenes.
 * Soporta:
 * - PNG, JPEG, WebP
 * - Múltiples imágenes por sesión
 * - Etiquetado de vistas
 */
class ImageImportSystem {
  // Importar imagen única
  importSingleImage(file: File): Promise<ImageData>;
  
  // Importar múltiples imágenes
  importMultiViewImages(files: File[]): Promise<MultiViewData>;
  
  // Validar calidad de imagen
  validateImageQuality(image: ImageData): QualityReport;
}
```

#### VideoImportSystem
```typescript
/**
 * Sistema para importar y procesar videos.
 * Soporta:
 * - MP4, WebM
 * - Extracción de frames
 * - Análisis de cobertura
 */
class VideoImportSystem {
  // Importar video
  importVideo(file: File): Promise<VideoData>;
  
  // Extraer frames útiles
  extractUsefulFrames(video: VideoData): Promise<Frame[]>;
  
  // Analizar cobertura angular
  analyzeCoverage(frames: Frame[]): CoverageReport;
}
```

#### ScanSessionManager
```typescript
/**
 * Gestor de sesiones de escaneo.
 * Coordina fotos, videos y datos de escaneo.
 */
class ScanSessionManager {
  // Crear sesión de escaneo de objeto
  createObjectScanSession(): ObjectScanSession;
  
  // Crear sesión de escaneo de escena
  createSceneScanSession(): SceneScanSession;
  
  // Gestionar progreso
  updateProgress(sessionId: string, progress: number): void;
}
```

---

### 2. PREPROCESSING LAYER

#### ImagePreprocessor
```typescript
/**
 * Preprocesamiento de imágenes.
 */
class ImagePreprocessor {
  // Normalizar tamaño y formato
  normalize(image: ImageData): ImageData;
  
  // Ajustar contraste/brillo
  adjustLevels(image: ImageData, params: LevelParams): ImageData;
  
  // Aplicar filtros
  applyFilter(image: ImageData, filter: Filter): ImageData;
}
```

#### SilhouetteExtractor
```typescript
/**
 * Extracción de siluetas.
 */
class SilhouetteExtractor {
  // Extraer silueta del objeto
  extract(image: ImageData): SilhouetteData;
  
  // Suavizar bordes
  smoothSilhouette(silhouette: SilhouetteData): SilhouetteData;
  
  // Convertir a vector
  toVector(silhouette: SilhouetteData): VectorPath[];
}
```

#### FeatureDetector
```typescript
/**
 * Detección de características/puntos de interés.
 */
class FeatureDetector {
  // Detectar puntos SIFT/ORB
  detectKeypoints(image: ImageData): Keypoint[];
  
  // Calcular descriptores
  computeDescriptors(keypoints: Keypoint[]): Descriptor[];
  
  // Encontrar correspondencias
  matchFeatures(desc1: Descriptor[], desc2: Descriptor[]): Match[];
}
```

#### BackgroundRemovalModule
```typescript
/**
 * Eliminación de fondo.
 */
class BackgroundRemovalModule {
  // Remover fondo automáticamente
  removeBackground(image: ImageData): ImageData;
  
  // Refinar bordes
  refineEdges(image: ImageData, mask: Mask): ImageData;
}
```

#### FrameExtractorFromVideo
```typescript
/**
 * Extracción inteligente de frames desde video.
 */
class FrameExtractorFromVideo {
  // Extraer frames útiles (no borrosos, no redundantes)
  extractUsefulFrames(video: VideoData, config: ExtractConfig): Frame[];
  
  // Detectar frames borrosos
  detectBlur(frame: Frame): number;
  
  // Detectar redundancia
  detectRedundancy(frames: Frame[]): number[];
}
```

#### InputQualityAnalyzer
```typescript
/**
 * Análisis de calidad de entrada.
 */
class InputQualityAnalyzer {
  // Analizar calidad general
  analyze(input: ConversionInput): QualityReport;
  
  // Verificar cobertura angular
  checkAngularCoverage(views: View[]): CoverageReport;
  
  // Sugerir mejoras
  suggestImprovements(report: QualityReport): Suggestion[];
}
```

---

### 3. INTERPRETATION LAYER

#### IntentClassifier
```typescript
/**
 * Clasificador de intención del usuario.
 * Determina QUÉ quiere crear el usuario.
 */
class IntentClassifier {
  // Clasificar intención
  classify(input: PreprocessedInput): IntentResult;
  
  // Obtener nivel de confianza
  getConfidence(): ConfidenceLevel;
  
  // Explicar clasificación
  explain(): Explanation;
}

// Categorías de intención
type IntentCategory =
  | 'human'
  | 'animal'
  | 'furniture'  // silla, mesa, cama
  | 'vehicle'
  | 'architecture'
  | 'object_mechanical'
  | 'object_generic'
  | 'scene_room'
  | 'scene_environment';
```

#### ShapeCategoryClassifier
```typescript
/**
 * Clasificador de forma geométrica.
 */
class ShapeCategoryClassifier {
  // Clasificar forma
  classify(silhouette: SilhouetteData): ShapeCategory;
  
  // Detectar simetría
  detectSymmetry(silhouette: SilhouetteData): SymmetryAxis[];
  
  // Detectar proporciones
  detectProportions(silhouette: SilhouetteData): Proportions;
}
```

#### MultiViewConsistencyAnalyzer
```typescript
/**
 * Analizador de consistencia multi-vista.
 */
class MultiViewConsistencyAnalyzer {
  // Verificar consistencia entre vistas
  analyze(views: View[]): ConsistencyReport;
  
  // Detectar conflictos
  detectConflicts(views: View[]): Conflict[];
  
  // Sugerir correcciones
  suggestCorrections(conflicts: Conflict[]): Correction[];
}
```

#### TemplateSuggestionEngine
```typescript
/**
 * Motor de sugerencias de plantillas.
 */
class TemplateSuggestionEngine {
  // Sugerir plantilla basada en intención
  suggest(intent: IntentResult): TemplateSuggestion[];
  
  // Rankear sugerencias
  rank(suggestions: TemplateSuggestion[]): RankedSuggestion[];
  
  // Construir preview
  buildPreview(suggestion: TemplateSuggestion): PreviewMesh;
}
```

---

### 4. GEOMETRY RECONSTRUCTION LAYER

#### SingleViewProxyBuilder
```typescript
/**
 * Constructor de proxy 3D desde una sola vista.
 */
class SingleViewProxyBuilder {
  // Construir proxy desde silueta
  buildFromSilhouette(silhouette: SilhouetteData): ProxyMesh;
  
  // Estimar profundidad
  estimateDepth(silhouette: SilhouetteData): DepthMap;
  
  // Generar malla de bloqueo inicial
  generateBlockout(silhouette: SilhouetteData, depth: DepthMap): BlockoutMesh;
}
```

#### MultiViewReconstructor
```typescript
/**
 * Reconstrucción desde múltiples vistas.
 */
class MultiViewReconstructor {
  // Reconstruir desde múltiples imágenes
  reconstruct(views: View[]): ReconstructedMesh;
  
  // Alinear vistas
  alignViews(views: View[]): AlignedViews;
  
  // Fusionar información
  fuse(alignedViews: AlignedViews): FusedData;
}
```

#### PhotoGrammetryReconstructor
```typescript
/**
 * Reconstrucción fotogramétrica.
 */
class PhotoGrammetryReconstructor {
  // Procesar conjunto de fotos
  process(photos: Photo[]): PointCloud;
  
  // Estimar poses de cámara
  estimateCameraPoses(photos: Photo[]): CameraPose[];
  
  // Generar nube de puntos
  generatePointCloud(photos: Photo[], poses: CameraPose[]): PointCloud;
  
  // Generar malla desde nube de puntos
  generateMesh(cloud: PointCloud): Mesh;
}
```

#### VideoToFramesReconstructor
```typescript
/**
 * Reconstrucción desde video.
 */
class VideoToFramesReconstructor {
  // Procesar video
  process(video: VideoData): ReconstructedMesh;
  
  // Seleccionar frames clave
  selectKeyFrames(frames: Frame[]): KeyFrame[];
  
  // Estimar trayectoria de cámara
  estimateCameraTrajectory(frames: Frame[]): CameraTrajectory;
}
```

#### SceneReconstructionModule
```typescript
/**
 * Reconstrucción de escenas completas.
 */
class SceneReconstructionModule {
  // Reconstruir escena desde capturas
  reconstruct(captures: Capture[]): SceneData;
  
  // Detectar planos principales (suelo, paredes)
  detectMainPlanes(pointCloud: PointCloud): Plane[];
  
  // Segmentar objetos
  segmentObjects(scene: SceneData): ObjectSegment[];
  
  // Generar SceneGraph
  generateSceneGraph(segments: ObjectSegment[]): SceneGraph;
}
```

---

### 5. TEMPLATE GENERATION LAYER

#### Template3DGenerator
```typescript
/**
 * Generador base de plantillas 3D.
 */
class Template3DGenerator {
  // Generar plantilla por categoría
  generate(category: TemplateCategory, params: TemplateParams): TemplateMesh;
  
  // Personalizar parámetros
  customize(template: TemplateMesh, params: Partial<TemplateParams>): TemplateMesh;
  
  // Convertir a malla editable
  toEditableMesh(template: TemplateMesh): EditableMesh;
}
```

#### HumanBaseGenerator
```typescript
/**
 * Generador de base humana.
 */
class HumanBaseGenerator {
  // Generar base humana
  generate(params: HumanParams): HumanMesh;
  
  // Ajustar proporciones
  adjustProportions(mesh: HumanMesh, proportions: BodyProportions): HumanMesh;
  
  // Añadir detalle base
  addBaseDetail(mesh: HumanMesh): HumanMesh;
}

interface HumanParams {
  height: number;
  bodyType: 'slim' | 'average' | 'athletic' | 'heavy';
  gender: 'male' | 'female' | 'neutral';
  proportionStyle: 'realistic' | 'stylized' | 'cartoon';
  subdivisions: number;
}
```

#### FurnitureGenerator (Chair, Table, Bed)
```typescript
/**
 * Generadores de muebles.
 */
class ChairGenerator {
  generate(params: ChairParams): ChairMesh;
}

class TableGenerator {
  generate(params: TableParams): TableMesh;
}

class BedGenerator {
  generate(params: BedParams): BedMesh;
}

interface ChairParams {
  seatHeight: number;
  seatWidth: number;
  seatDepth: number;
  backrestHeight: number;
  legStyle: 'straight' | 'curved' | 'cross';
  legCount: 4 | 3 | 5;
  armrests: boolean;
  subdivisions: number;
}
```

#### VehicleGenerator
```typescript
/**
 * Generador de vehículos.
 */
class VehicleGenerator {
  generate(params: VehicleParams): VehicleMesh;
  
  // Generar ruedas
  generateWheels(count: number, size: number): WheelMesh[];
  
  // Generar carrocería
  generateBody(style: BodyStyle): BodyMesh;
}
```

---

### 6. POSTPROCESSING LAYER

#### MeshCleanupSystem
```typescript
/**
 * Sistema de limpieza de mallas.
 */
class MeshCleanupSystem {
  // Limpieza completa
  cleanup(mesh: Mesh): Mesh;
  
  // Eliminar vértices duplicados
  removeDuplicateVertices(mesh: Mesh): Mesh;
  
  // Eliminar caras degeneradas
  removeDegenerateFaces(mesh: Mesh): Mesh;
  
  // Eliminar islas flotantes
  removeFloatingIslands(mesh: Mesh): Mesh;
}
```

#### HoleFillSystem
```typescript
/**
 * Sistema de relleno de huecos.
 */
class HoleFillSystem {
  // Detectar huecos
  detectHoles(mesh: Mesh): Hole[];
  
  // Rellenar huecos
  fillHoles(mesh: Mesh, holes: Hole[]): Mesh;
  
  // Verificar si es seguro rellenar
  isSafeToFill(hole: Hole): boolean;
}
```

#### RemeshSystem
```typescript
/**
 * Sistema de remallado.
 */
class RemeshSystem {
  // Remallado uniforme
  remesh(mesh: Mesh, targetDensity: number): Mesh;
  
  // Simplificación
  simplify(mesh: Mesh, targetCount: number): Mesh;
  
  // Subdivisión
  subdivide(mesh: Mesh, iterations: number): Mesh;
}
```

#### UVSeedGenerator
```typescript
/**
 * Generador de UVs iniciales.
 */
class UVSeedGenerator {
  // Generar UVs básicas
  generate(mesh: Mesh): UVMap;
  
  // Proyectar desde vista
  projectFromView(mesh: Mesh, view: ViewDirection): UVMap;
  
  // Unfolding básico
  unfold(mesh: Mesh): UVMap;
}
```

---

### 7. INTERNAL REPRESENTATION LAYER

#### EditableMesh
```typescript
/**
 * Malla editable - representación interna principal.
 */
class EditableMesh {
  // Datos de vértices
  vertices: Vertex[];
  
  // Datos de aristas
  edges: Edge[];
  
  // Datos de caras
  faces: Face[];
  
  // Atributos
  normals: Vector3[];
  uvs: UV[];
  colors: Color[];
  
  // Topología
  topology: TopologyGraph;
  
  // Metadatos de reconstrucción
  reconstructionMeta: ReconstructionMetadata;
  
  // Operaciones
  addVertex(position: Vector3): Vertex;
  addEdge(v1: Vertex, v2: Vertex): Edge;
  addFace(vertices: Vertex[]): Face;
  
  // Edición
  moveVertex(vertex: Vertex, position: Vector3): void;
  extrudeFace(face: Face): Face;
  subdivideEdge(edge: Edge): Vertex[];
  
  // Serialización
  serialize(): MeshData;
  static deserialize(data: MeshData): EditableMesh;
}
```

#### EditableObject3D
```typescript
/**
 * Objeto 3D editable.
 */
class EditableObject3D {
  id: string;
  name: string;
  mesh: EditableMesh;
  transform: Transform;
  materials: Material[];
  metadata: ObjectMetadata;
  
  // Operaciones
  applyTransform(transform: Transform): void;
  setMaterial(material: Material): void;
  
  // Exportación
  toSceneNode(): SceneNode;
}
```

#### EditableScene3D
```typescript
/**
 * Escena 3D editable.
 */
class EditableScene3D {
  id: string;
  name: string;
  objects: Map<string, EditableObject3D>;
  hierarchy: SceneHierarchy;
  environment: EnvironmentSettings;
  
  // Operaciones
  addObject(object: EditableObject3D): void;
  removeObject(id: string): void;
  
  // Generación de SceneGraph
  toSceneGraph(): SceneGraph;
  toSceneData(): SceneData;
}
```

---

### 8. UI/UX LAYER

#### ConversionWizardPanel
```typescript
/**
 * Panel de wizard de conversión.
 */
class ConversionWizardPanel {
  // Pasos del wizard
  steps: WizardStep[];
  
  // Paso actual
  currentStep: number;
  
  // Configuración actual
  config: ConversionConfig;
  
  // Navegación
  nextStep(): void;
  prevStep(): void;
  goToStep(index: number): void;
  
  // Acciones
  startConversion(): void;
  cancelConversion(): void;
}
```

#### MultiViewAlignmentPanel
```typescript
/**
 * Panel de alineación multi-vista.
 */
class MultiViewAlignmentPanel {
  // Vistas cargadas
  views: View[];
  
  // Etiquetado de vistas
  labelView(viewId: string, label: ViewLabel): void;
  
  // Alineación manual
  alignManually(views: View[]): void;
  
  // Preview de alineación
  previewAlignment(): AlignmentPreview;
}
```

#### ConversionPreviewPanel
```typescript
/**
 * Panel de preview de conversión.
 */
class ConversionPreviewPanel {
  // Preview actual
  preview: PreviewMesh;
  
  // Calidad del resultado
  qualityIndicators: QualityIndicator[];
  
  // Acciones
  accept(): void;
  reject(): void;
  requestRefinement(): void;
}
```

---

## Pipelines de Conversión

### PIPELINE A: Dibujo 2D Único → 3D

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Capturar    │────▶│ Extraer      │────▶│ Clasificar    │
│ Trazos      │     │ Silueta      │     │ Categoría     │
└─────────────┘     └──────────────┘     └───────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Convertir   │◀────│ Sugerir      │◀────│ Estimar       │
│ a Editable  │     │ Plantilla    │     │ Simetría      │
└─────────────┘     └──────────────┘     └───────────────┘
```

### PIPELINE B: Varios Dibujos → 3D

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Registrar   │────▶│ Alinear      │────▶│ Detectar      │
│ Vistas      │     │ Vistas       │     │ Partes Comunes│
└─────────────┘     └──────────────┘     └───────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Limpiar     │◀────│ Generar      │◀────│ Estimar       │
│ Resultado   │     │ Malla Base   │     │ Proporciones  │
└─────────────┘     └──────────────┘     └───────────────┘
```

### PIPELINE C: Imagen Única → 3D

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Importar    │────▶│ Segmentar    │────▶│ Inferir       │
│ Imagen      │     │ Objeto       │     │ Profundidad   │
└─────────────┘     └──────────────┘     └───────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Convertir   │◀────│ Sugerir      │◀────│ Construir     │
│ a Editable  │     │ Plantilla    │     │ Proxy 3D      │
└─────────────┘     └──────────────┘     └───────────────┘
```

### PIPELINE D: Varias Imágenes → 3D

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Importar    │────▶│ Detectar     │────▶│ Estimar       │
│ Múltiples   │     │ Corresp.     │     │ Cámaras       │
└─────────────┘     └──────────────┘     └───────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Limpiar     │◀────│ Generar      │◀────│ Reconstruir   │
│ Resultado   │     │ Malla        │     │ Volumen       │
└─────────────┘     └──────────────┘     └───────────────┘
```

### PIPELINE E: Fotos → Objeto 3D Escaneado

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Analizar    │────▶│ Detectar     │────▶│ Estimar       │
│ Cobertura   │     │ Features     │     │ Poses Cam.    │
└─────────────┘     └──────────────┘     └───────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Convertir   │◀────│ Generar      │◀────│ Reconstruir   │
│ a Editable  │     │ Malla        │     │ Nube Puntos   │
└─────────────┘     └──────────────┘     └───────────────┘
```

### PIPELINE F: Video → Objeto 3D

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Importar    │────▶│ Extraer      │────▶│ Filtrar       │
│ Video       │     │ Frames       │     │ Borrosos      │
└─────────────┘     └──────────────┘     └───────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Convertir   │◀────│ Generar      │◀────│ Estimar       │
│ a Editable  │     │ Malla        │     │ Trayect. Cam. │
└─────────────┘     └──────────────┘     └───────────────┘
```

### PIPELINE G: Fotos/Video → Escena 3D

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Detectar    │────▶│ Reconstruir  │────▶│ Separar       │
│ Tipo Escena │     │ Geometría    │     │ Superficies   │
└─────────────┘     └──────────────┘     └───────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Crear       │◀────│ Limpiar      │◀────│ Construir     │
│ Editable    │     │ Escena       │     │ SceneGraph    │
│ Scene3D     │     │              │     │               │
└─────────────┘     └──────────────┘     └───────────────┘
```

---

## Tipos e Interfaces

### Tipos Principales

```typescript
// ===== INPUT TYPES =====

interface SketchSession {
  id: string;
  strokes: Stroke[];
  layers: Layer[];
  views: SketchView[];
  createdAt: Date;
}

interface Stroke {
  id: string;
  points: Point2D[];
  pressure: number[];
  color: Color;
  width: number;
  layerId: string;
}

interface SketchView {
  id: string;
  label: ViewLabel;
  angle: number; // Ángulo aproximado en grados
  drawing: SketchSession;
}

type ViewLabel = 'front' | 'side' | 'back' | 'top' | 'perspective' | 'custom';

interface ImageData {
  id: string;
  source: File | Blob | string;
  width: number;
  height: number;
  format: string;
  pixels: Uint8ClampedArray;
  metadata: ImageMetadata;
}

interface MultiViewData {
  id: string;
  views: LabeledView[];
  coverageReport: CoverageReport;
}

interface LabeledView {
  id: string;
  image: ImageData;
  label: ViewLabel;
  estimatedAngle: number;
}

interface VideoData {
  id: string;
  source: File | Blob;
  duration: number;
  fps: number;
  width: number;
  height: number;
  frames: Frame[];
}

interface Frame {
  id: string;
  index: number;
  timestamp: number;
  image: ImageData;
  blur: number;
  keypoints?: Keypoint[];
}

// ===== PREPROCESSING TYPES =====

interface SilhouetteData {
  id: string;
  contours: Contour[];
  holes: Contour[];
  boundingBox: BoundingBox;
  area: number;
}

interface Contour {
  points: Point2D[];
  closed: boolean;
  area: number;
}

interface Keypoint {
  id: string;
  position: Point2D;
  scale: number;
  angle: number;
  response: number;
}

interface Descriptor {
  keypointsId: string;
  data: Float32Array;
}

interface Match {
  queryId: string;
  trainId: string;
  distance: number;
}

interface QualityReport {
  score: number; // 0-100
  level: QualityLevel;
  issues: QualityIssue[];
  suggestions: string[];
}

type QualityLevel = 'excellent' | 'good' | 'acceptable' | 'poor';

// ===== INTERPRETATION TYPES =====

interface IntentResult {
  category: IntentCategory;
  confidence: number; // 0-1
  subcategories: SubCategory[];
  explanation: string;
}

interface TemplateSuggestion {
  templateId: string;
  templateType: TemplateCategory;
  confidence: number;
  params: TemplateParams;
  preview: PreviewMesh;
  reason: string;
}

type TemplateCategory =
  | 'human'
  | 'animal'
  | 'chair'
  | 'table'
  | 'bed'
  | 'vehicle'
  | 'furniture'
  | 'architecture';

// ===== RECONSTRUCTION TYPES =====

interface ProxyMesh {
  id: string;
  vertices: Vector3[];
  faces: Face3[];
  confidence: number;
  blockoutReady: boolean;
}

interface ReconstructedMesh {
  id: string;
  vertices: Vector3[];
  faces: Face3[];
  normals: Vector3[];
  uvs: UV[];
  confidence: number;
  sourceViews: string[];
}

interface PointCloud {
  id: string;
  points: Point3D[];
  colors: Color[];
  normals: Vector3[];
}

interface Point3D {
  position: Vector3;
  color: Color;
  normal?: Vector3;
}

interface CameraPose {
  id: string;
  position: Vector3;
  rotation: Quaternion;
  fov: number;
  aspectRatio: number;
}

// ===== EDITABLE TYPES =====

interface Vertex {
  id: string;
  position: Vector3;
  normal: Vector3;
  uv: UV;
  color?: Color;
  edgeIds: string[];
  faceIds: string[];
}

interface Edge {
  id: string;
  vertexIds: [string, string];
  faceIds: string[];
  crease: number;
}

interface Face {
  id: string;
  vertexIds: string[];
  edgeIds: string[];
  normal: Vector3;
  materialIndex: number;
}

interface UV {
  u: number;
  v: number;
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

// ===== METADATA TYPES =====

interface ReconstructionMetadata {
  sourceType: InputType;
  sourceId: string;
  pipeline: PipelineType;
  confidence: number;
  qualityLevel: QualityLevel;
  createdAt: Date;
  processingTime: number;
  parameters: Record<string, unknown>;
}

type InputType =
  | 'sketch_single'
  | 'sketch_multi'
  | 'image_single'
  | 'image_multi'
  | 'photo_set'
  | 'video'
  | 'scene_scan';

type PipelineType =
  | 'sketch2d_to_3d'
  | 'multiview_sketch'
  | 'image_to_3d'
  | 'multiview_image'
  | 'photogrammetry'
  | 'video_reconstruction'
  | 'scene_reconstruction';
```

---

## Sistema de Calidad y Confianza

### Niveles de Confianza

| Nivel | Valor | Acción |
|-------|-------|--------|
| **Alta** | 0.8 - 1.0 | Proceder automáticamente, mostrar preview |
| **Media** | 0.5 - 0.8 | Mostrar sugerencias, permitir ajustes |
| **Baja** | 0.0 - 0.5 | Sugerir más datos, usar plantilla base |

### Indicadores de Calidad

```typescript
interface QualityIndicators {
  // Calidad de entrada
  inputQuality: number;      // 0-100
  
  // Cobertura angular (para multi-view)
  angularCoverage: number;   // 0-360 grados
  
  // Calidad de imagen
  imageQuality: number;      // 0-100
  
  // Claridad de silueta
  silhouetteClarity: number; // 0-100
  
  // Consistencia entre vistas
  viewConsistency: number;   // 0-100
  
  // Calidad de reconstrucción
  reconstructionQuality: number; // 0-100
}
```

### Mensajes al Usuario

El sistema debe informar claramente:

1. **"Calidad de entrada insuficiente"** → Sugerir más fotos/mejor iluminación
2. **"Cobertura angular incompleta"** → Indicar qué ángulos faltan
3. **"Fondo perjudica la conversión"** → Sugerir quitar fondo
4. **"Resultado será mejor como blockout"** → Ajustar expectativas
5. **"Convendría usar plantilla asistida"** → Ofrecer templates

---

## Integración con el Motor

### Dependencias del Motor

Antes de integrar el sistema, el motor debe tener:

| Sistema | Estado | Descripción |
|---------|--------|-------------|
| EditableMesh | ✅ Implementar | Estructura de malla editable |
| SceneGraph | ✅ Existe | Grafo de escena |
| Raycast | ✅ Existe | Sistema de raycast |
| Selección | ✅ Existe | Sistema de selección |
| Importación | ⚠️ Extender | Soporte para imágenes/video |
| Procesamiento Async | ✅ Existe | Jobs/Workers |
| Preview System | ⚠️ Extender | Preview de conversión |
| Serialización | ✅ Existe | Sistema de guardado |
| Paneles UI | ✅ Existe | Sistema de paneles |
| Comandos | ✅ Existe | Undo/Redo |
| Materiales | ✅ Existe | Sistema de materiales |

### Puntos de Integración

```typescript
// En src/lib/engine/index.ts
export * from './conversion';

// Nuevos componentes en ECS
declare module './ecs/ECS' {
  interface ComponentType {
    __componentType: 'EditableMesh';
    meshId: string;
    editable: boolean;
  }
}

// Nuevos eventos
declare module './core/EventSystem' {
  interface EngineEvents {
    'conversion:started': ConversionStartedEvent;
    'conversion:progress': ConversionProgressEvent;
    'conversion:completed': ConversionCompletedEvent;
    'conversion:failed': ConversionFailedEvent;
  }
}
```

---

## Errores a Evitar

### 1. Mezclar Responsabilidades

❌ **Incorrecto:**
```typescript
class MegaConverter {
  convert(input: any): Mesh {
    // Fotogrametría + edición + UI + cleanup TODO EN UNO
  }
}
```

✅ **Correcto:**
```typescript
// Separar en módulos
class PhotoGrammetryPipeline {
  process(photos: Photo[]): PointCloud { ... }
}

class MeshCleanupSystem {
  cleanup(mesh: Mesh): Mesh { ... }
}

class ConversionCoordinator {
  async convert(input: ConversionInput): Promise<EditableMesh> {
    const cloud = await this.photogrammetry.process(input.photos);
    const mesh = await this.reconstructor.generateMesh(cloud);
    return this.cleanup.cleanup(mesh);
  }
}
```

### 2. No Distinguir Tipos de Entrada

❌ **Incorrecto:**
```typescript
function convertTo3D(input: any): Mesh { ... }
```

✅ **Correcto:**
```typescript
// Pipeline factory
function getPipeline(input: ConversionInput): ConversionPipeline {
  switch (input.type) {
    case 'sketch_single': return new SketchSingleViewPipeline();
    case 'sketch_multi': return new SketchMultiViewPipeline();
    case 'image_single': return new ImageSingleViewPipeline();
    case 'image_multi': return new ImageMultiViewPipeline();
    case 'photo_set': return new PhotoGrammetryPipeline();
    case 'video': return new VideoReconstructionPipeline();
    case 'scene_scan': return new SceneReconstructionPipeline();
  }
}
```

### 3. Prometer Exactitud Perfecta

❌ **Incorrecto:**
```typescript
// Promesa irreal
function reconstructPerfect3D(photos: Photo[]): Mesh {
  return perfectMesh;
}
```

✅ **Correcto:**
```typescript
function reconstruct(photos: Photo[]): ReconstructionResult {
  return {
    mesh: generatedMesh,
    confidence: 0.75,
    qualityLevel: 'good',
    suggestions: ['Add more photos from the back'],
    limitations: ['Some details may be approximated']
  };
}
```

### 4. Destruir Sin Historial

❌ **Incorrecto:**
```typescript
function applyConversion(mesh: Mesh, conversion: Conversion): void {
  mesh.vertices = conversion.newVertices; // Directo, sin undo
}
```

✅ **Correcto:**
```typescript
function applyConversion(mesh: Mesh, conversion: Conversion): void {
  const command = new ConversionCommand(mesh, conversion);
  commandStack.execute(command);
}
```

---

## Orden de Implementación

### Fase 1: Fundamentos (Semana 1-2)

1. ✅ Tipos e interfaces base
2. ✅ `EditableMesh` - Representación interna
3. ✅ `EditableObject3D` y `EditableScene3D`
4. ✅ Sistema de eventos de conversión

### Fase 2: Input Layer (Semana 3-4)

1. ✅ `SketchInputSystem` - Captura de dibujos
2. ✅ `ImageImportSystem` - Importación de imágenes
3. ✅ `MultiViewInputManager` - Gestión multi-vista
4. ✅ `VideoImportSystem` - Importación de video
5. ✅ `ScanSessionManager` - Gestión de sesiones

### Fase 3: Preprocessing (Semana 5-6)

1. ✅ `ImagePreprocessor`
2. ✅ `BackgroundRemovalModule`
3. ✅ `SilhouetteExtractor`
4. ✅ `FeatureDetector`
5. ✅ `FrameExtractorFromVideo`
6. ✅ `InputQualityAnalyzer`

### Fase 4: Interpretation (Semana 7-8)

1. ✅ `IntentClassifier`
2. ✅ `ShapeCategoryClassifier`
3. ✅ `MultiViewConsistencyAnalyzer`
4. ✅ `TemplateSuggestionEngine`

### Fase 5: Geometry Reconstruction (Semana 9-12)

1. ✅ `SingleViewProxyBuilder`
2. ✅ `MultiViewReconstructor`
3. ✅ `DepthEstimationModule`
4. ✅ `PhotoGrammetryReconstructor` (básico)
5. ✅ `VideoToFramesReconstructor`
6. ✅ `SceneReconstructionModule`

### Fase 6: Template Generation (Semana 13-14)

1. ✅ `Template3DGenerator` base
2. ✅ `HumanBaseGenerator`
3. ✅ `ChairGenerator`, `TableGenerator`, `BedGenerator`
4. ✅ `VehicleGenerator`
5. ✅ `RoomLayoutGenerator`

### Fase 7: Postprocessing (Semana 15-16)

1. ✅ `MeshCleanupSystem`
2. ✅ `HoleFillSystem`
3. ✅ `RemeshSystem`
4. ✅ `UVSeedGenerator`
5. ✅ `NormalCorrectionSystem`

### Fase 8: UI/UX (Semana 17-18)

1. ✅ `ConversionWizardPanel`
2. ✅ `MultiViewAlignmentPanel`
3. ✅ `ConversionPreviewPanel`
4. ✅ `ConfidenceInspector`
5. ✅ `TemplateSuggestionPanel`

### Fase 9: Integración Final (Semana 19-20)

1. ✅ Integración con viewport 3D
2. ✅ Integración con selección
3. ✅ Integración con materiales
4. ✅ Testing exhaustivo
5. ✅ Documentación final

---

## Conclusión

Este sistema está diseñado para ser:

- **Modular**: Cada capa es independiente
- **Escalable**: Fácil agregar nuevos pipelines
- **Mantenible**: Separación clara de responsabilidades
- **Extensible**: Preparado para futuras mejoras

El enfoque de pipelines separados permite que cada tipo de entrada tenga su flujo optimizado, mientras que la representación interna unificada (`EditableMesh`, `EditableObject3D`, `EditableScene3D`) garantiza compatibilidad con las herramientas existentes del motor.

---

**Fin del Documento**
