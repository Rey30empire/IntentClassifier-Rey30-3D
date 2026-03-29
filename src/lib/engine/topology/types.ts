/**
 * NEXUS Engine - Topology Brush System Types
 * 
 * Complete type definitions for the topology brush system
 */

// ============================================
// VECTOR TYPES
// ============================================

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Ray {
  origin: Vec3;
  direction: Vec3;
}

export interface Plane {
  point: Vec3;
  normal: Vec3;
}

export interface Sphere {
  center: Vec3;
  radius: number;
}

// ============================================
// BRUSH TYPES
// ============================================

export type BrushType = 
  | 'smooth'       // Suavizar superficie
  | 'add'          // Añadir geometría (inflar)
  | 'subtract'     // Quitar geometría (excavar)
  | 'sharpen'      // Aumentar detalles/crestas
  | 'flatten'      // Aplanar hacia plano
  | 'pinch'        // Pellizcar hacia línea central
  | 'grab'         // Mover vértices arrastrando
  | 'twist'        // Rotar vértices
  | 'crease'       // Crear pliegues/bordes
  | 'scrape'       // Rascar/eliminar material
  | 'fill'         // Rellenar huecos
  | 'clay'         // Añadir arcilla
  | 'move'         // Mover sin alterar topología
  | 'relax'        // Relajar tensión de malla
  | 'mask'         // Pintar máscara
  | 'select'       // Seleccionar vértices
  | 'retopo'       // Retopología asistida
  | 'poly_strip'   // Tira de polígonos
  | 'poly_fill';   // Rellenar agujeros

export type BrushMode = 
  | 'vertex'       // Operar sobre vértices
  | 'edge'         // Operar sobre aristas
  | 'face'         // Operar sobre caras
  | 'topology';    // Operar sobre topología

export type FalloffType = 
  | 'constant'     // Sin falloff
  | 'linear'       // Lineal
  | 'smooth'       // Smoothstep
  | 'sphere'       // Esférico
  | 'root'         // Raíz cuadrada
  | 'sharp'        // Brusco
  | 'linear_square'// Lineal al cuadrado
  | 'custom';      // Curva personalizada

export type SymmetryAxis = 'x' | 'y' | 'z';
export type SymmetryMode = 'none' | 'mirror' | 'radial';

// ============================================
// BRUSH SETTINGS
// ============================================

export interface FalloffCurve {
  type: FalloffType;
  points: CurvePoint[];  // Para custom
  tension: number;       // Tensión de la curva
}

export interface CurvePoint {
  position: number;  // 0-1
  value: number;     // 0-1
}

export interface BrushSettings {
  id: string;
  name: string;
  type: BrushType;
  mode: BrushMode;
  
  // Size & Strength
  size: number;           // Radio del brush
  strength: number;       // Fuerza de la operación
  pressure: number;       // Sensibilidad presión
  
  // Falloff
  falloff: FalloffCurve;
  innerRadius: number;    // Radio interior (0-1)
  
  // Stroke
  spacing: number;        // Espaciado entre stamps
  strokeMode: 'dots' | 'drag' | 'space';
  accumulate: boolean;    // Acumular sobre mismo stroke
  
  // Direction
  directionMode: 'normal' | 'view' | 'x' | 'y' | 'z' | 'custom';
  customDirection: Vec3;
  
  // Advanced
  autoSmooth: number;     // Suavizado automático post-stroke
  topologyBias: number;   // Bias hacia mantener topología
  detailAmount: number;   // Cantidad de detalle para ciertos brushes
  
  // Symmetry
  symmetry: SymmetrySettings;
  
  // Constraints
  constraints: BrushConstraints;
}

export interface SymmetrySettings {
  enabled: boolean;
  mode: SymmetryMode;
  axes: SymmetryAxis[];
  radialCount: number;    // Para radial
  tolerance: number;      // Tolerancia para detectar simétricos
}

export interface BrushConstraints {
  // Surface constraints
  constrainToSurface: boolean;
  surfaceDistance: number;
  
  // Boundary constraints  
  respectBoundaries: boolean;
  boundarySoftness: number;
  
  // Topology constraints
  preserveQuads: boolean;
  minQuadness: number;    // Calidad mínima de quads
  
  // Mask constraints
  respectMask: boolean;
  maskStrength: number;
}

// ============================================
// BRUSH STATE
// ============================================

export interface BrushStroke {
  id: string;
  brushId: string;
  settings: BrushSettings;
  points: StrokePoint[];
  startTime: number;
  endTime: number;
  affectedVertices: string[];
}

export interface StrokePoint {
  position: Vec3;         // Posición en world space
  normal: Vec3;           // Normal de superficie
  pressure: number;       // Presión en este punto
  timestamp: number;      // Tiempo del punto
  affectedVertices: AffectedVertex[];
}

export interface AffectedVertex {
  vertexId: string;
  originalPosition: Vec3;
  deltaPosition: Vec3;
  falloff: number;
}

export interface BrushState {
  active: boolean;
  currentBrush: BrushSettings;
  currentStroke: BrushStroke | null;
  
  // Cursor
  cursorPosition: Vec3;
  cursorNormal: Vec3;
  cursorVisible: boolean;
  
  // Preview
  previewActive: boolean;
  previewVertices: Map<string, Vec3>;
  
  // Statistics
  strokeCount: number;
  verticesAffected: number;
  lastStrokeTime: number;
}

// ============================================
// MESH ELEMENTS (simplified from EditableMesh)
// ============================================

export interface BrushVertex {
  id: string;
  position: Vec3;
  normal: Vec3;
  uv: Vec2;
  color: Vec4;
  mask: number;           // 0-1, 0 = fully masked
  selectionWeight: number;
  adjacentVertices: string[];
  adjacentEdges: string[];
  adjacentFaces: string[];
}

export interface BrushEdge {
  id: string;
  vertexIds: [string, string];
  crease: number;         // 0-1
  sharp: boolean;
  length: number;
}

export interface BrushFace {
  id: string;
  vertexIds: string[];
  edgeIds: string[];
  normal: Vec3;
  centroid: Vec3;
  area: number;
  materialIndex: number;
}

export interface BrushMesh {
  id: string;
  vertices: Map<string, BrushVertex>;
  edges: Map<string, BrushEdge>;
  faces: Map<string, BrushFace>;
  bounds: { min: Vec3; max: Vec3 };
}

// ============================================
// RETOPOLOGY TYPES
// ============================================

export interface RetopoGuide {
  id: string;
  type: 'line' | 'loop' | 'patch';
  vertices: Vec3[];
  connectedGuides: string[];
}

export interface RetopoPatch {
  id: string;
  guideIds: string[];
  quadCount: number;
  density: number;
  flow: 'uniform' | 'adaptive' | 'curvature';
}

export interface RetopoStroke {
  id: string;
  points: Vec3[];
  projectedPoints: Vec3[];  // Proyectados a superficie
  guides: RetopoGuide[];
}

export interface RetopoResult {
  success: boolean;
  vertices: Vec3[];
  faces: number[][];        // Índices de vértices
  guides: RetopoGuide[];
  quality: RetopoQuality;
}

export interface RetopoQuality {
  quadRatio: number;        // Ratio de quads vs tris
  averageQuadness: number;  // Cuán cuadrados son los quads
  edgeFlow: number;         // Calidad del flujo de aristas
  density: number;          // Densidad de polígonos
}

// ============================================
// BRUSH OPERATION RESULT
// ============================================

export interface BrushResult {
  success: boolean;
  affectedVertices: string[];
  affectedEdges: string[];
  affectedFaces: string[];
  
  // Delta movements
  vertexDeltas: Map<string, Vec3>;
  
  // New topology (for add operations)
  newVertices: BrushVertex[];
  newEdges: BrushEdge[];
  newFaces: BrushFace[];
  
  // Removed topology (for subtract operations)
  removedVertexIds: string[];
  removedEdgeIds: string[];
  removedFaceIds: string[];
  
  // Quality metrics
  meshQuality: MeshQualityMetrics;
}

export interface MeshQualityMetrics {
  averageEdgeLength: number;
  edgeLengthVariance: number;
  averageFaceArea: number;
  triangleCount: number;
  quadCount: number;
  ngonCount: number;
  nonManifoldEdges: number;
  flippedNormals: number;
  degenerateFaces: number;
}

// ============================================
// BRUSH PRESET
// ============================================

export interface BrushPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  settings: BrushSettings;
  thumbnail?: string;
  tags: string[];
}

// ============================================
// BRUSH EVENTS
// ============================================

export type TopologyEventType = 
  | 'brush:start'
  | 'brush:stroke'
  | 'brush:end'
  | 'brush:preview'
  | 'brush:cancel'
  | 'settings:change'
  | 'preset:load'
  | 'preset:save'
  | 'symmetry:toggle'
  | 'mask:apply'
  | 'mask:clear'
  | 'retopo:start'
  | 'retopo:complete';

export interface TopologyEvent {
  type: TopologyEventType;
  data: Record<string, unknown>;
  timestamp: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function vec4(x: number, y: number, z: number, w: number): Vec4 {
  return { x, y, z, w };
}

export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function mulVec3(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function divVec3(v: Vec3, s: number): Vec3 {
  return s !== 0 ? { x: v.x / s, y: v.y / s, z: v.z / s } : v;
}

export function dotVec3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossVec3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function lengthVec3(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalizeVec3(v: Vec3): Vec3 {
  const len = lengthVec3(v);
  return len > 0 ? divVec3(v, len) : { x: 0, y: 1, z: 0 };
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function distanceVec3(a: Vec3, b: Vec3): number {
  return lengthVec3(subVec3(a, b));
}

export function reflectVec3(v: Vec3, n: Vec3): Vec3 {
  const d = 2 * dotVec3(v, n);
  return subVec3(v, mulVec3(n, d));
}

export function mirrorPoint(point: Vec3, axis: SymmetryAxis): Vec3 {
  switch (axis) {
    case 'x': return { x: -point.x, y: point.y, z: point.z };
    case 'y': return { x: point.x, y: -point.y, z: point.z };
    case 'z': return { x: point.x, y: point.y, z: -point.z };
  }
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// DEFAULT BRUSH SETTINGS
// ============================================

export function createDefaultBrushSettings(type: BrushType = 'smooth'): BrushSettings {
  return {
    id: generateId(),
    name: `Brush_${type}`,
    type,
    mode: 'vertex',
    size: 1.0,
    strength: 0.5,
    pressure: 1.0,
    falloff: {
      type: 'smooth',
      points: [],
      tension: 0.5,
    },
    innerRadius: 0.0,
    spacing: 0.1,
    strokeMode: 'space',
    accumulate: false,
    directionMode: 'normal',
    customDirection: { x: 0, y: 1, z: 0 },
    autoSmooth: 0.0,
    topologyBias: 0.5,
    detailAmount: 0.5,
    symmetry: {
      enabled: false,
      mode: 'mirror',
      axes: ['x'],
      radialCount: 8,
      tolerance: 0.001,
    },
    constraints: {
      constrainToSurface: false,
      surfaceDistance: 0,
      respectBoundaries: true,
      boundarySoftness: 0.5,
      preserveQuads: false,
      minQuadness: 0.7,
      respectMask: true,
      maskStrength: 1.0,
    },
  };
}

export function createDefaultBrushState(): BrushState {
  return {
    active: false,
    currentBrush: createDefaultBrushSettings(),
    currentStroke: null,
    cursorPosition: { x: 0, y: 0, z: 0 },
    cursorNormal: { x: 0, y: 1, z: 0 },
    cursorVisible: false,
    previewActive: false,
    previewVertices: new Map(),
    strokeCount: 0,
    verticesAffected: 0,
    lastStrokeTime: 0,
  };
}
