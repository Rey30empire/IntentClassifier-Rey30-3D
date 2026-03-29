/**
 * NEXUS Engine - Topology Brush System
 * 
 * Sistema completo de pinceles topológicos para edición de mallas 3D.
 * Incluye múltiples tipos de brushes, falloff curves, máscaras,
 * y detección de topología.
 */

import {
  Vec3,
  RGBA,
  generateId,
  EditableVertex,
  EditableEdge,
  EditableFace,
  EditableMeshData,
  BoundingBox3D,
  emptyBoundingBox3D,
  mergeBoundingBox3D,
} from '../types';

// ============================================
// BRUSH TYPES
// ============================================

/** Tipos de brush disponibles */
export type BrushType =
  | 'smooth'      // Suavizar superficie
  | 'inflate'     // Inflar hacia afuera
  | 'deflate'     // Desinflar hacia adentro
  | 'grab'        // Arrastrar vértices
  | 'crease'      // Crear pliegues
  | 'flatten'     // Aplanar superficie
  | 'pinch'       // Pellizcar hacia el centro
  | 'mask'        // Pintar máscara
  | 'smooth_mask' // Suavizar máscara
  | 'topology'    // Modificar topología
  | 'relax'       // Relajar distribución de vértices
  | 'clay'        // Añadir volumen como arcilla
  | 'scrape'      // Raspar superficie
  | 'fill'        // Rellenar huecos
  | 'elastic';    // Deformación elástica

/** Modo de falloff del brush */
export type FalloffType =
  | 'smooth'      // Suave (curva gaussiana)
  | 'constant'    // Constante
  | 'linear'      // Lineal
  | 'sharp'       // Cortante
  | 'spike'       // Pico en el centro
  | 'dome'        // Cúpula
  | 'custom';     // Curva personalizada

/** Modo de proyección del brush */
export type ProjectionMode =
  | 'surface'     // Sobre la superficie
  | 'screen'      // Proyección de pantalla
  | 'volume'      // Volumen 3D
  | 'plane';      // Plano definido

/** Dirección del brush */
export type BrushDirection =
  | 'normal'      // A lo largo de la normal
  | 'view'        // Dirección de vista
  | 'x'           // Eje X
  | 'y'           // Eje Y
  | 'z'           // Eje Z
  | 'custom';     // Dirección personalizada

/** Modo de simetría */
export type SymmetryMode =
  | 'none'        // Sin simetría
  | 'x'           // Simetría X
  | 'y'           // Simetría Y
  | 'z'           // Simetría Z
  | 'radial';     // Simetría radial

// ============================================
// BRUSH SETTINGS
// ============================================

/** Configuración base de un brush */
export interface BrushSettings {
  // Tamaño y forma
  radius: number;              // Radio del brush
  innerRadius: number;         // Radio interno (para dona)
  sizeProjection: boolean;     // Proyectar tamaño según profundidad
  
  // Fuerza y comportamiento
  strength: number;            // Fuerza del brush (0-1)
  autoStrength: boolean;       // Ajustar fuerza automáticamente
  pressureSensitivity: boolean; // Sensibilidad a presión
  
  // Falloff
  falloffType: FalloffType;
  falloffCurve: number[];      // Puntos de curva personalizada
  falloffSmooth: number;       // Suavizado del falloff
  
  // Dirección
  direction: BrushDirection;
  customDirection: Vec3;       // Dirección personalizada
  invertDirection: boolean;    // Invertir dirección
  
  // Proyección
  projectionMode: ProjectionMode;
  projectionPlane: Vec3[];     // Plano de proyección
  occlusionAware: boolean;     // Considerar oclusión
  
  // Simetría
  symmetryMode: SymmetryMode;
  symmetrySteps: number;       // Para simetría radial
  symmetryOffset: number;      // Offset del plano de simetría
  
  // Avanzado
  accumulate: boolean;         // Acumular efecto
  spacing: number;             // Espaciado entre strokes
  useFrontFacesOnly: boolean;  // Solo caras frontales
  useConnectedOnly: boolean;   // Solo vértices conectados
  
  // Máscara
  respectMask: boolean;        // Respetar máscara existente
  invertMask: boolean;         // Invertir máscara
  
  // Topología
  autoTopology: boolean;       // Ajustar topología automáticamente
  preserveVolume: boolean;     // Preservar volumen
  preserveBoundary: boolean;   // Preservar bordes
}

/** Configuración específica por tipo de brush */
export interface BrushTypeSettings {
  // Smooth
  smoothIterations: number;
  smoothFactor: number;
  smoothBoundary: boolean;
  
  // Inflate/Deflate
  inflateUniform: boolean;
  
  // Grab
  grabFalloff: number;
  grabOrientToSurface: boolean;
  
  // Crease
  creaseDepth: number;
  creaseWidth: number;
  
  // Flatten
  flattenToAverage: boolean;
  flattenPlane: Vec3;
  
  // Pinch
  pinchStrength: number;
  
  // Mask
  maskValue: number;
  
  // Topology
  topologyMode: 'add' | 'remove' | 'relocate';
  targetQuadRatio: number;
  
  // Clay
  clayBuildup: number;
  clayFlatten: boolean;
  
  // Scrape
  scrapeDepth: number;
  scrapeAccumulate: boolean;
  
  // Elastic
  elasticStiffness: number;
  elasticDamping: number;
}

/** Brush completo */
export interface Brush {
  id: string;
  name: string;
  type: BrushType;
  settings: BrushSettings;
  typeSettings: BrushTypeSettings;
  icon?: string;
  shortcut?: string;
  isCustom: boolean;
}

// ============================================
// STROKE DATA
// ============================================

/** Punto en un stroke */
export interface StrokePoint {
  position: Vec3;              // Posición 3D en superficie
  screenPosition: Vec3;        // Posición en pantalla
  normal: Vec3;                // Normal de superficie
  radius: number;              // Radio efectivo
  strength: number;            // Fuerza efectiva
  pressure: number;            // Presión del input
  rotation: number;            // Rotación del stylus
  timestamp: number;           // Tiempo del punto
  affectedVertices: AffectedVertex[]; // Vértices afectados
}

/** Vértice afectado por el brush */
export interface AffectedVertex {
  vertexId: string;
  influence: number;           // Influencia del brush (0-1)
  originalPosition: Vec3;      // Posición original
  newPosition: Vec3;           // Nueva posición
  distanceToBrush: number;     // Distancia al centro del brush
}

/** Stroke completo */
export interface BrushStroke {
  id: string;
  brushId: string;
  brushType: BrushType;
  points: StrokePoint[];
  startTime: number;
  endTime: number;
  totalVerticesAffected: number;
  canUndo: boolean;
  undoData?: StrokeUndoData;
}

/** Datos para deshacer un stroke */
export interface StrokeUndoData {
  vertexPositions: Map<string, Vec3>;
  vertexMaskValues: Map<string, number>;
  topologyChanges?: TopologyChange[];
}

// ============================================
// MASK SYSTEM
// ============================================

/** Datos de máscara */
export interface MaskData {
  vertexMasks: Map<string, number>; // vertexId -> mask value (0-1)
  faceMasks: Map<string, number>;   // faceId -> mask value
  edgeMasks: Map<string, number>;   // edgeId -> mask value
  
  // Para máscaras de textura
  textureMask?: ImageData;
  textureResolution: number;
  
  // Para máscaras de id
  idMask?: Map<number, string>; // id -> vertexId
  
  // Metadata
  isVisible: boolean;
  opacity: number;
  color: RGBA;
}

/** Modo de visualización de máscara */
export type MaskVisualizationMode =
  | 'color'      // Color sólido
  | 'gradient'   // Gradiente
  | 'pattern'    // Patrón
  | 'outline';   // Solo contorno

// ============================================
// TOPOLOGY DETECTION
// ============================================

/** Tipo de elemento topológico */
export type TopologyElementType =
  | 'vertex'
  | 'edge'
  | 'face'
  | 'boundary'   // Borde abierto
  | 'crease'     // Borde afilado
  | 'corner'     // Esquina
  | 'pole'       // Polo (vértice con N caras)
  | 'ngon'       // Cara con N > 4 lados
  | 'triangle'   // Triángulo
  | 'quad'       // Cuadrilátero
  | 'junction';  // Unión de múltiples caras

/** Elemento topológico detectado */
export interface TopologyElement {
  id: string;
  type: TopologyElementType;
  vertexIds: string[];
  edgeIds: string[];
  faceIds: string[];
  position: Vec3;
  normal: Vec3;
  curvature: number;        // Curvatura local
  valence: number;          // Número de caras conectadas
  isSelected: boolean;
  isMarked: boolean;
  priority: number;         // Prioridad para operaciones
}

/** Análisis topológico de una malla */
export interface TopologyAnalysis {
  // Conteos
  vertexCount: number;
  edgeCount: number;
  faceCount: number;
  triangleCount: number;
  quadCount: number;
  ngonCount: number;
  boundaryCount: number;
  poleCount: number;
  
  // Calidad
  averageValence: number;
  quadRatio: number;        // Proporción de quads
  irregularRatio: number;   // Proporción de vértices irregulares
  
  // Elementos detectados
  boundaries: TopologyElement[];
  poles: TopologyElement[];
  ngons: TopologyElement[];
  creases: TopologyElement[];
  corners: TopologyElement[];
  
  // Problemas
  issues: TopologyIssue[];
  
  // Sugerencias
  suggestions: TopologySuggestion[];
}

/** Problema topológico */
export interface TopologyIssue {
  type: 'ngon' | 'triangle' | 'pole' | 'hole' | 'non_manifold' | 'overlapping';
  severity: 'info' | 'warning' | 'error';
  elementIds: string[];
  position: Vec3;
  description: string;
  autoFixAvailable: boolean;
}

/** Sugerencia de mejora topológica */
export interface TopologySuggestion {
  type: 'retopology' | 'subdivision' | 'cleanup' | 'optimize';
  description: string;
  affectedArea: Vec3[];
  estimatedImprovement: number;
}

// ============================================
// TOPOLOGY CHANGES
// ============================================

/** Tipo de cambio topológico */
export type TopologyChangeType =
  | 'add_vertex'
  | 'remove_vertex'
  | 'add_edge'
  | 'remove_edge'
  | 'add_face'
  | 'remove_face'
  | 'split_edge'
  | 'collapse_edge'
  | 'flip_edge'
  | 'subdivide_face'
  | 'merge_vertices'
  | 'dissolve_face'
  | 'triangulate'
  | 'quadrify';

/** Cambio topológico */
export interface TopologyChange {
  id: string;
  type: TopologyChangeType;
  affectedVertexIds: string[];
  affectedEdgeIds: string[];
  affectedFaceIds: string[];
  createdVertexIds: string[];
  createdEdgeIds: string[];
  createdFaceIds: string[];
  removedVertexIds: string[];
  removedEdgeIds: string[];
  removedFaceIds: string[];
  beforeState: TopologyState;
  afterState: TopologyState;
  timestamp: number;
}

/** Estado topológico para undo/redo */
export interface TopologyState {
  vertices: Map<string, { position: Vec3; edgeIds: string[]; faceIds: string[] }>;
  edges: Map<string, { vertexIds: [string, string]; faceIds: string[] }>;
  faces: Map<string, { vertexIds: string[]; edgeIds: string[] }>;
}

// ============================================
// BRUSH SYSTEM CORE
// ============================================

/**
 * Sistema principal de pinceles topológicos
 */
export class TopologyBrushSystem {
  private brushes: Map<string, Brush> = new Map();
  private activeBrush: Brush | null = null;
  private currentStroke: BrushStroke | null = null;
  private strokeHistory: BrushStroke[] = [];
  private maxHistorySize: number = 50;
  
  private maskData: MaskData;
  private topologyAnalysis: TopologyAnalysis | null = null;
  
  // Cache para rendimiento
  private spatialHash: Map<string, string[]> = new Map();
  private vertexNormals: Map<string, Vec3> = new Map();
  private lastBrushPosition: Vec3 | null = null;
  
  // Estado
  private isDrawing: boolean = false;
  private autoTopologyEnabled: boolean = true;
  
  constructor() {
    this.initializeDefaultBrushes();
    this.maskData = this.createEmptyMaskData();
  }
  
  // ============================================
  // BRUSH MANAGEMENT
  // ============================================
  
  /** Inicializar brushes por defecto */
  private initializeDefaultBrushes(): void {
    const defaultBrushes: Array<{ type: BrushType; name: string; shortcut: string }> = [
      { type: 'smooth', name: 'Smooth', shortcut: 'S' },
      { type: 'inflate', name: 'Inflate', shortcut: 'I' },
      { type: 'deflate', name: 'Deflate', shortcut: 'D' },
      { type: 'grab', name: 'Grab', shortcut: 'G' },
      { type: 'crease', name: 'Crease', shortcut: 'C' },
      { type: 'flatten', name: 'Flatten', shortcut: 'F' },
      { type: 'pinch', name: 'Pinch', shortcut: 'P' },
      { type: 'mask', name: 'Mask', shortcut: 'M' },
      { type: 'topology', name: 'Topology', shortcut: 'T' },
      { type: 'relax', name: 'Relax', shortcut: 'R' },
      { type: 'clay', name: 'Clay', shortcut: 'L' },
      { type: 'scrape', name: 'Scrape', shortcut: 'A' },
      { type: 'fill', name: 'Fill', shortcut: 'B' },
      { type: 'elastic', name: 'Elastic', shortcut: 'E' },
    ];
    
    defaultBrushes.forEach(({ type, name, shortcut }) => {
      const brush = this.createBrush(type, name);
      brush.shortcut = shortcut;
      this.brushes.set(brush.id, brush);
    });
    
    // Establecer el primer brush como activo
    const firstBrush = this.brushes.values().next().value;
    if (firstBrush) {
      this.activeBrush = firstBrush;
    }
  }
  
  /** Crear un nuevo brush */
  createBrush(type: BrushType, name: string): Brush {
    const id = generateId();
    
    const settings: BrushSettings = this.getDefaultSettings(type);
    const typeSettings: BrushTypeSettings = this.getDefaultTypeSettings(type);
    
    return {
      id,
      name,
      type,
      settings,
      typeSettings,
      isCustom: false,
    };
  }
  
  /** Obtener settings por defecto */
  private getDefaultSettings(type: BrushType): BrushSettings {
    const base: BrushSettings = {
      radius: 0.5,
      innerRadius: 0,
      sizeProjection: true,
      strength: 0.5,
      autoStrength: false,
      pressureSensitivity: true,
      falloffType: 'smooth',
      falloffCurve: [],
      falloffSmooth: 0.5,
      direction: 'normal',
      customDirection: { x: 0, y: 1, z: 0 },
      invertDirection: false,
      projectionMode: 'surface',
      projectionPlane: [],
      occlusionAware: true,
      symmetryMode: 'none',
      symmetrySteps: 6,
      symmetryOffset: 0,
      accumulate: true,
      spacing: 0.1,
      useFrontFacesOnly: true,
      useConnectedOnly: false,
      respectMask: true,
      invertMask: false,
      autoTopology: false,
      preserveVolume: false,
      preserveBoundary: true,
    };
    
    // Ajustes específicos por tipo
    switch (type) {
      case 'smooth':
        base.strength = 0.3;
        break;
      case 'grab':
        base.strength = 1.0;
        base.direction = 'view';
        break;
      case 'mask':
        base.strength = 1.0;
        base.respectMask = false;
        break;
      case 'topology':
        base.autoTopology = true;
        break;
    }
    
    return base;
  }
  
  /** Obtener type settings por defecto */
  private getDefaultTypeSettings(type: BrushType): BrushTypeSettings {
    const base: BrushTypeSettings = {
      smoothIterations: 1,
      smoothFactor: 0.5,
      smoothBoundary: false,
      inflateUniform: true,
      grabFalloff: 0.5,
      grabOrientToSurface: true,
      creaseDepth: 0.1,
      creaseWidth: 0.2,
      flattenToAverage: true,
      flattenPlane: { x: 0, y: 1, z: 0 },
      pinchStrength: 0.5,
      maskValue: 1,
      topologyMode: 'relocate',
      targetQuadRatio: 0.8,
      clayBuildup: 0.5,
      clayFlatten: true,
      scrapeDepth: 0.1,
      scrapeAccumulate: false,
      elasticStiffness: 0.5,
      elasticDamping: 0.1,
    };
    
    return base;
  }
  
  /** Obtener brush activo */
  getActiveBrush(): Brush | null {
    return this.activeBrush;
  }
  
  /** Establecer brush activo */
  setActiveBrush(brushId: string): boolean {
    const brush = this.brushes.get(brushId);
    if (brush) {
      this.activeBrush = brush;
      return true;
    }
    return false;
  }
  
  /** Establecer brush activo por tipo */
  setActiveBrushByType(type: BrushType): boolean {
    for (const brush of this.brushes.values()) {
      if (brush.type === type) {
        this.activeBrush = brush;
        return true;
      }
    }
    return false;
  }
  
  /** Obtener todos los brushes */
  getAllBrushes(): Brush[] {
    return Array.from(this.brushes.values());
  }
  
  /** Actualizar settings de brush */
  updateBrushSettings(brushId: string, settings: Partial<BrushSettings>): boolean {
    const brush = this.brushes.get(brushId);
    if (brush) {
      brush.settings = { ...brush.settings, ...settings };
      brush.isCustom = true;
      return true;
    }
    return false;
  }
  
  // ============================================
  // BRUSH CALCULATIONS
  // ============================================
  
  /** Calcular falloff */
  calculateFalloff(
    distance: number,
    radius: number,
    type: FalloffType,
    customCurve?: number[]
  ): number {
    const normalizedDist = Math.min(distance / radius, 1);
    
    switch (type) {
      case 'constant':
        return 1;
        
      case 'linear':
        return 1 - normalizedDist;
        
      case 'smooth':
        // Curva suave (smoothstep)
        const t = normalizedDist;
        return 1 - (t * t * (3 - 2 * t));
        
      case 'sharp':
        // Cortante
        return normalizedDist < 0.5 ? 1 : 0;
        
      case 'spike':
        // Pico en el centro
        return Math.pow(1 - normalizedDist, 2);
        
      case 'dome':
        // Cúpula semicircular
        return Math.sqrt(1 - normalizedDist * normalizedDist);
        
      case 'custom':
        if (customCurve && customCurve.length > 1) {
          // Interpolación de curva personalizada
          const idx = normalizedDist * (customCurve.length - 1);
          const lower = Math.floor(idx);
          const upper = Math.min(lower + 1, customCurve.length - 1);
          const t = idx - lower;
          return customCurve[lower] * (1 - t) + customCurve[upper] * t;
        }
        return 1 - normalizedDist;
        
      default:
        return 1 - normalizedDist;
    }
  }
  
  /** Calcular dirección del brush */
  calculateBrushDirection(
    vertex: EditableVertex,
    viewDirection: Vec3,
    settings: BrushSettings
  ): Vec3 {
    let direction: Vec3;
    
    switch (settings.direction) {
      case 'normal':
        direction = { ...vertex.normal };
        break;
        
      case 'view':
        direction = { ...viewDirection };
        break;
        
      case 'x':
        direction = { x: 1, y: 0, z: 0 };
        break;
        
      case 'y':
        direction = { x: 0, y: 1, z: 0 };
        break;
        
      case 'z':
        direction = { x: 0, y: 0, z: 1 };
        break;
        
      case 'custom':
        direction = { ...settings.customDirection };
        break;
        
      default:
        direction = { ...vertex.normal };
    }
    
    // Normalizar
    const length = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
    if (length > 0) {
      direction.x /= length;
      direction.y /= length;
      direction.z /= length;
    }
    
    // Invertir si es necesario
    if (settings.invertDirection) {
      direction.x = -direction.x;
      direction.y = -direction.y;
      direction.z = -direction.z;
    }
    
    return direction;
  }
  
  /** Encontrar vértices afectados por el brush */
  findAffectedVertices(
    mesh: EditableMeshData,
    center: Vec3,
    radius: number,
    viewDirection: Vec3,
    settings: BrushSettings
  ): AffectedVertex[] {
    const affected: AffectedVertex[] = [];
    
    // Usar spatial hash si está disponible
    const candidates = this.getVerticesInRadius(mesh, center, radius);
    
    for (const vertexId of candidates) {
      const vertex = mesh.vertices.get(vertexId);
      if (!vertex) continue;
      
      // Verificar máscara
      if (settings.respectMask) {
        const maskValue = this.maskData.vertexMasks.get(vertexId) || 0;
        if (settings.invertMask ? maskValue >= 1 : maskValue >= 1) {
          continue;
        }
      }
      
      // Verificar caras frontales
      if (settings.useFrontFacesOnly) {
        const dotProduct = 
          vertex.normal.x * viewDirection.x +
          vertex.normal.y * viewDirection.y +
          vertex.normal.z * viewDirection.z;
        if (dotProduct > 0) continue; // Cara trasera
      }
      
      // Calcular distancia
      const dx = vertex.position.x - center.x;
      const dy = vertex.position.y - center.y;
      const dz = vertex.position.z - center.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      if (distance <= radius) {
        // Calcular influencia con falloff
        const innerInfluence = settings.innerRadius > 0
          ? this.calculateFalloff(Math.max(0, distance - settings.innerRadius), radius - settings.innerRadius, 'constant')
          : 1;
        
        const outerInfluence = this.calculateFalloff(
          distance,
          radius,
          settings.falloffType,
          settings.falloffCurve
        );
        
        const influence = innerInfluence * outerInfluence;
        
        if (influence > 0.001) {
          affected.push({
            vertexId,
            influence,
            originalPosition: { ...vertex.position },
            newPosition: { ...vertex.position },
            distanceToBrush: distance,
          });
        }
      }
    }
    
    // Filtrar por conectividad si es necesario
    if (settings.useConnectedOnly && affected.length > 0) {
      const connectedSet = this.getConnectedVertices(
        mesh,
        affected[0].vertexId,
        new Set(affected.map(v => v.vertexId))
      );
      return affected.filter(v => connectedSet.has(v.vertexId));
    }
    
    return affected;
  }
  
  /** Obtener vértices en radio usando spatial hash */
  private getVerticesInRadius(
    mesh: EditableMeshData,
    center: Vec3,
    radius: number
  ): string[] {
    // Si no hay spatial hash, usar búsqueda lineal
    if (this.spatialHash.size === 0) {
      return this.linearSearchVertices(mesh, center, radius);
    }
    
    // Búsqueda con spatial hash
    const cellSize = radius * 2;
    const minCell = this.worldToCell(center, cellSize, -radius);
    const maxCell = this.worldToCell(center, cellSize, radius);
    
    const result = new Set<string>();
    
    for (let x = minCell.x; x <= maxCell.x; x++) {
      for (let y = minCell.y; y <= maxCell.y; y++) {
        for (let z = minCell.z; z <= maxCell.z; z++) {
          const key = `${x},${y},${z}`;
          const cellVertices = this.spatialHash.get(key);
          if (cellVertices) {
            cellVertices.forEach(id => result.add(id));
          }
        }
      }
    }
    
    return Array.from(result);
  }
  
  /** Búsqueda lineal de vértices */
  private linearSearchVertices(
    mesh: EditableMeshData,
    center: Vec3,
    radius: number
  ): string[] {
    const result: string[] = [];
    const radiusSq = radius * radius;
    
    for (const [id, vertex] of mesh.vertices) {
      const dx = vertex.position.x - center.x;
      const dy = vertex.position.y - center.y;
      const dz = vertex.position.z - center.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      
      if (distSq <= radiusSq) {
        result.push(id);
      }
    }
    
    return result;
  }
  
  /** Convertir posición del mundo a celda */
  private worldToCell(pos: Vec3, cellSize: number, offset: number = 0): { x: number; y: number; z: number } {
    return {
      x: Math.floor((pos.x + offset) / cellSize),
      y: Math.floor((pos.y + offset) / cellSize),
      z: Math.floor((pos.z + offset) / cellSize),
    };
  }
  
  /** Obtener vértices conectados */
  private getConnectedVertices(
    mesh: EditableMeshData,
    startVertexId: string,
    limitSet: Set<string>
  ): Set<string> {
    const connected = new Set<string>();
    const queue = [startVertexId];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (connected.has(currentId)) continue;
      
      connected.add(currentId);
      
      const vertex = mesh.vertices.get(currentId);
      if (!vertex) continue;
      
      for (const edgeId of vertex.edgeIds) {
        const edge = mesh.edges.get(edgeId);
        if (!edge) continue;
        
        const neighborId = edge.vertexIds[0] === currentId
          ? edge.vertexIds[1]
          : edge.vertexIds[0];
        
        if (limitSet.has(neighborId) && !connected.has(neighborId)) {
          queue.push(neighborId);
        }
      }
    }
    
    return connected;
  }
  
  // ============================================
  // BRUSH OPERATIONS
  // ============================================
  
  /** Aplicar brush a vértices */
  applyBrush(
    mesh: EditableMeshData,
    affectedVertices: AffectedVertex[],
    brush: Brush,
    delta: Vec3,
    strength: number
  ): void {
    const { settings, typeSettings, type } = brush;
    const effectiveStrength = strength * settings.strength;
    
    switch (type) {
      case 'smooth':
        this.applySmoothBrush(mesh, affectedVertices, effectiveStrength, typeSettings);
        break;
      case 'inflate':
        this.applyInflateBrush(mesh, affectedVertices, effectiveStrength, settings);
        break;
      case 'deflate':
        settings.invertDirection = true;
        this.applyInflateBrush(mesh, affectedVertices, effectiveStrength, settings);
        break;
      case 'grab':
        this.applyGrabBrush(mesh, affectedVertices, delta, effectiveStrength);
        break;
      case 'crease':
        this.applyCreaseBrush(mesh, affectedVertices, effectiveStrength, typeSettings);
        break;
      case 'flatten':
        this.applyFlattenBrush(mesh, affectedVertices, effectiveStrength, typeSettings);
        break;
      case 'pinch':
        this.applyPinchBrush(mesh, affectedVertices, effectiveStrength, typeSettings);
        break;
      case 'mask':
        this.applyMaskBrush(affectedVertices, typeSettings.maskValue);
        break;
      case 'smooth_mask':
        this.applySmoothMaskBrush(affectedVertices);
        break;
      case 'topology':
        this.applyTopologyBrush(mesh, affectedVertices, effectiveStrength, typeSettings);
        break;
      case 'relax':
        this.applyRelaxBrush(mesh, affectedVertices, effectiveStrength);
        break;
      case 'clay':
        this.applyClayBrush(mesh, affectedVertices, effectiveStrength, typeSettings);
        break;
      case 'scrape':
        this.applyScrapeBrush(mesh, affectedVertices, effectiveStrength, typeSettings);
        break;
      case 'fill':
        this.applyFillBrush(mesh, affectedVertices, effectiveStrength);
        break;
      case 'elastic':
        this.applyElasticBrush(mesh, affectedVertices, delta, effectiveStrength, typeSettings);
        break;
    }
    
    // Aplicar preservación de volumen si está activado
    if (settings.preserveVolume && type !== 'mask') {
      this.preserveVolume(mesh, affectedVertices);
    }
    
    // Aplicar preservación de bordes si está activado
    if (settings.preserveBoundary) {
      this.preserveBoundaries(mesh, affectedVertices);
    }
  }
  
  /** Brush de suavizado */
  private applySmoothBrush(
    mesh: EditableMeshData,
    affectedVertices: AffectedVertex[],
    strength: number,
    typeSettings: BrushTypeSettings
  ): void {
    for (let iter = 0; iter < typeSettings.smoothIterations; iter++) {
      for (const affected of affectedVertices) {
        const vertex = mesh.vertices.get(affected.vertexId);
        if (!vertex) continue;
        
        // Calcular posición promedio de vecinos
        let avgX = 0, avgY = 0, avgZ = 0;
        let count = 0;
        
        for (const edgeId of vertex.edgeIds) {
          const edge = mesh.edges.get(edgeId);
          if (!edge) continue;
          
          const neighborId = edge.vertexIds[0] === affected.vertexId
            ? edge.vertexIds[1]
            : edge.vertexIds[0];
          
          const neighbor = mesh.vertices.get(neighborId);
          if (neighbor) {
            avgX += neighbor.position.x;
            avgY += neighbor.position.y;
            avgZ += neighbor.position.z;
            count++;
          }
        }
        
        if (count > 0) {
          avgX /= count;
          avgY /= count;
          avgZ /= count;
          
          // Interpolar hacia promedio
          const factor = strength * affected.influence * typeSettings.smoothFactor;
          affected.newPosition.x = vertex.position.x + (avgX - vertex.position.x) * factor;
          affected.newPosition.y = vertex.position.y + (avgY - vertex.position.y) * factor;
          affected.newPosition.z = vertex.position.z + (avgZ - vertex.position.z) * factor;
        }
      }
      
      // Aplicar cambios
      for (const affected of affectedVertices) {
        const vertex = mesh.vertices.get(affected.vertexId);
        if (vertex) {
          vertex.position.x = affected.newPosition.x;
          vertex.position.y = affected.newPosition.y;
          vertex.position.z = affected.newPosition.z;
        }
      }
    }
  }
  
  /** Brush de inflado */
  private applyInflateBrush(
    mesh: EditableMeshData,
    affectedVertices: AffectedVertex[],
    strength: number,
    settings: BrushSettings
  ): void {
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (!vertex) continue;
      
      const factor = strength * affected.influence;
      
      affected.newPosition.x = vertex.position.x + vertex.normal.x * factor;
      affected.newPosition.y = vertex.position.y + vertex.normal.y * factor;
      affected.newPosition.z = vertex.position.z + vertex.normal.z * factor;
      
      vertex.position.x = affected.newPosition.x;
      vertex.position.y = affected.newPosition.y;
      vertex.position.z = affected.newPosition.z;
    }
  }
  
  /** Brush de agarre */
  private applyGrabBrush(
    mesh: EditableMeshData,
    affectedVertices: AffectedVertex[],
    delta: Vec3,
    strength: number
  ): void {
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (!vertex) continue;
      
      const factor = strength * affected.influence;
      
      affected.newPosition.x = vertex.position.x + delta.x * factor;
      affected.newPosition.y = vertex.position.y + delta.y * factor;
      affected.newPosition.z = vertex.position.z + delta.z * factor;
      
      vertex.position.x = affected.newPosition.x;
      vertex.position.y = affected.newPosition.y;
      vertex.position.z = affected.newPosition.z;
    }
  }
  
  /** Brush de pliegue */
  private applyCreaseBrush(
    mesh: EditableMeshData,
    affectedVertices: AffectedVertex[],
    strength: number,
    typeSettings: BrushTypeSettings
  ): void {
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (!vertex) continue;
      
      // Mover hacia adentro con más fuerza en el centro
      const factor = strength * affected.influence * typeSettings.creaseDepth;
      
      // Invertir normal en el centro para crear el pliegue
      const inwardFactor = 1 - affected.distanceToBrush / (typeSettings.creaseWidth * 2);
      
      affected.newPosition.x = vertex.position.x - vertex.normal.x * factor * inwardFactor;
      affected.newPosition.y = vertex.position.y - vertex.normal.y * factor * inwardFactor;
      affected.newPosition.z = vertex.position.z - vertex.normal.z * factor * inwardFactor;
      
      vertex.position.x = affected.newPosition.x;
      vertex.position.y = affected.newPosition.y;
      vertex.position.z = affected.newPosition.z;
    }
  }
  
  /** Brush de aplanado */
  private applyFlattenBrush(
    mesh: EditableMeshData,
    affectedVertices: AffectedVertex[],
    strength: number,
    typeSettings: BrushTypeSettings
  ): void {
    // Calcular plano promedio o usar plano definido
    let planeNormal = typeSettings.flattenPlane;
    let planePoint: Vec3 = { x: 0, y: 0, z: 0 };
    
    if (typeSettings.flattenToAverage) {
      // Calcular promedio de posiciones y normales
      let avgX = 0, avgY = 0, avgZ = 0;
      let avgNX = 0, avgNY = 0, avgNZ = 0;
      
      for (const affected of affectedVertices) {
        const vertex = affectedVertices.find(v => v.vertexId === affected.vertexId);
        if (vertex) {
          const v = mesh.vertices.get(vertex.vertexId);
          if (v) {
            avgX += v.position.x;
            avgY += v.position.y;
            avgZ += v.position.z;
            avgNX += v.normal.x;
            avgNY += v.normal.y;
            avgNZ += v.normal.z;
          }
        }
      }
      
      const count = affectedVertices.length;
      planePoint = { x: avgX / count, y: avgY / count, z: avgZ / count };
      
      const len = Math.sqrt(avgNX * avgNX + avgNY * avgNY + avgNZ * avgNZ);
      if (len > 0) {
        planeNormal = { x: avgNX / len, y: avgNY / len, z: avgNZ / len };
      }
    }
    
    // Proyectar vértices al plano
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (!vertex) continue;
      
      const factor = strength * affected.influence;
      
      // Distancia al plano
      const dist =
        (vertex.position.x - planePoint.x) * planeNormal.x +
        (vertex.position.y - planePoint.y) * planeNormal.y +
        (vertex.position.z - planePoint.z) * planeNormal.z;
      
      // Mover hacia el plano
      affected.newPosition.x = vertex.position.x - planeNormal.x * dist * factor;
      affected.newPosition.y = vertex.position.y - planeNormal.y * dist * factor;
      affected.newPosition.z = vertex.position.z - planeNormal.z * dist * factor;
      
      vertex.position.x = affected.newPosition.x;
      vertex.position.y = affected.newPosition.y;
      vertex.position.z = affected.newPosition.z;
    }
  }
  
  /** Brush de pellizco */
  private applyPinchBrush(
    mesh: EditableMeshData,
    affectedVertices: AffectedVertex[],
    strength: number,
    typeSettings: BrushTypeSettings
  ): void {
    // Calcular centro promedio
    let centerX = 0, centerY = 0, centerZ = 0;
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (vertex) {
        centerX += vertex.position.x;
        centerY += vertex.position.y;
        centerZ += vertex.position.z;
      }
    }
    
    const count = affectedVertices.length;
    if (count === 0) return;
    
    centerX /= count;
    centerY /= count;
    centerZ /= count;
    
    // Mover vértices hacia el centro
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (!vertex) continue;
      
      const factor = strength * affected.influence * typeSettings.pinchStrength;
      
      const dx = centerX - vertex.position.x;
      const dy = centerY - vertex.position.y;
      const dz = centerZ - vertex.position.z;
      
      affected.newPosition.x = vertex.position.x + dx * factor;
      affected.newPosition.y = vertex.position.y + dy * factor;
      affected.newPosition.z = vertex.position.z + dz * factor;
      
      vertex.position.x = affected.newPosition.x;
      vertex.position.y = affected.newPosition.y;
      vertex.position.z = affected.newPosition.z;
    }
  }
  
  /** Brush de máscara */
  private applyMaskBrush(affectedVertices: AffectedVertex[], value: number): void {
    for (const affected of affectedVertices) {
      const currentValue = this.maskData.vertexMasks.get(affected.vertexId) || 0;
      const newValue = currentValue + (value - currentValue) * affected.influence;
      this.maskData.vertexMasks.set(affected.vertexId, Math.max(0, Math.min(1, newValue)));
    }
  }
  
  /** Brush de suavizado de máscara */
  private applySmoothMaskBrush(affectedVertices: AffectedVertex[]): void {
    for (const affected of affectedVertices) {
      const currentValue = this.maskData.vertexMasks.get(affected.vertexId) || 0;
      // Simplificación: promedio con valor actual
      const smoothed = currentValue * 0.5 + 0.5 * affected.influence;
      this.maskData.vertexMasks.set(affected.vertexId, smoothed);
    }
  }
  
  /** Brush de topología */
  private applyTopologyBrush(
    mesh: EditableMeshData,
    affectedVertices: AffectedVertex[],
    strength: number,
    typeSettings: BrushTypeSettings
  ): void {
    // Este brush modifica la topología de la malla
    // Por ahora, redistribuye vértices para mejorar el flujo
    switch (typeSettings.topologyMode) {
      case 'relocate':
        this.relocateVertices(mesh, affectedVertices, strength);
        break;
      case 'add':
        // Añadir vértices donde hay densidad baja
        break;
      case 'remove':
        // Eliminar vértices donde hay densidad alta
        break;
    }
  }
  
  /** Relocalizar vértices para mejor distribución */
  private relocateVertices(
    mesh: EditableMeshData,
    affectedVertices: AffectedVertex[],
    strength: number
  ): void {
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (!vertex) continue;
      
      // Calcular posición óptima basada en vecinos
      let optimalX = 0, optimalY = 0, optimalZ = 0;
      let count = 0;
      
      for (const edgeId of vertex.edgeIds) {
        const edge = mesh.edges.get(edgeId);
        if (!edge) continue;
        
        const neighborId = edge.vertexIds[0] === affected.vertexId
          ? edge.vertexIds[1]
          : edge.vertexIds[0];
        
        const neighbor = mesh.vertices.get(neighborId);
        if (neighbor) {
          optimalX += neighbor.position.x;
          optimalY += neighbor.position.y;
          optimalZ += neighbor.position.z;
          count++;
        }
      }
      
      if (count > 0) {
        optimalX /= count;
        optimalY /= count;
        optimalZ /= count;
        
        const factor = strength * affected.influence * 0.5;
        
        affected.newPosition.x = vertex.position.x + (optimalX - vertex.position.x) * factor;
        affected.newPosition.y = vertex.position.y + (optimalY - vertex.position.y) * factor;
        affected.newPosition.z = vertex.position.z + (optimalZ - vertex.position.z) * factor;
        
        vertex.position.x = affected.newPosition.x;
        vertex.position.y = affected.newPosition.y;
        vertex.position.z = affected.newPosition.z;
      }
    }
  }
  
  /** Brush de relajación */
  private applyRelaxBrush(
    mesh: EditableMeshData,
    affectedVertices: AffectedVertex[],
    strength: number
  ): void {
    // Similar a smooth pero preserva más la forma general
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (!vertex) continue;
      
      // Calcular centro de masa de vecinos
      let cx = 0, cy = 0, cz = 0;
      let count = 0;
      
      for (const edgeId of vertex.edgeIds) {
        const edge = mesh.edges.get(edgeId);
        if (!edge) continue;
        
        const neighborId = edge.vertexIds[0] === affected.vertexId
          ? edge.vertexIds[1]
          : edge.vertexIds[0];
        
        const neighbor = mesh.vertices.get(neighborId);
        if (neighbor) {
          cx += neighbor.position.x;
          cy += neighbor.position.y;
          cz += neighbor.position.z;
          count++;
        }
      }
      
      if (count > 0) {
        cx /= count;
        cy /= count;
        cz /= count;
        
        const factor = strength * affected.influence * 0.3;
        
        affected.newPosition.x = vertex.position.x + (cx - vertex.position.x) * factor;
        affected.newPosition.y = vertex.position.y + (cy - vertex.position.y) * factor;
        affected.newPosition.z = vertex.position.z + (cz - vertex.position.z) * factor;
        
        vertex.position.x = affected.newPosition.x;
        vertex.position.y = affected.newPosition.y;
        vertex.position.z = affected.newPosition.z;
      }
    }
  }
  
  /** Brush de arcilla */
  private applyClayBrush(
    mesh: EditableMeshData,
    affectedVertices: AffectedVertex[],
    strength: number,
    typeSettings: BrushTypeSettings
  ): void {
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (!vertex) continue;
      
      const factor = strength * affected.influence * typeSettings.clayBuildup;
      
      // Añadir volumen en dirección normal
      affected.newPosition.x = vertex.position.x + vertex.normal.x * factor;
      affected.newPosition.y = vertex.position.y + vertex.normal.y * factor;
      affected.newPosition.z = vertex.position.z + vertex.normal.z * factor;
      
      // Si clayFlatten está activo, también aplanar
      if (typeSettings.clayFlatten) {
        const flattenFactor = factor * 0.3;
        affected.newPosition.x -= vertex.normal.x * flattenFactor * affected.influence;
        affected.newPosition.y -= vertex.normal.y * flattenFactor * affected.influence;
        affected.newPosition.z -= vertex.normal.z * flattenFactor * affected.influence;
      }
      
      vertex.position.x = affected.newPosition.x;
      vertex.position.y = affected.newPosition.y;
      vertex.position.z = affected.newPosition.z;
    }
  }
  
  /** Brush de raspado */
  private applyScrapeBrush(
    mesh: EditableMeshData,
    affectedVertices: AffectedVertex[],
    strength: number,
    typeSettings: BrushTypeSettings
  ): void {
    // Encontrar el vértice más alto (en dirección normal promedio)
    let maxDist = -Infinity;
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (vertex) {
        const dist = Math.sqrt(
          vertex.position.x ** 2 + vertex.position.y ** 2 + vertex.position.z ** 2
        );
        if (dist > maxDist) maxDist = dist;
      }
    }
    
    // Aplanar hacia ese nivel
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (!vertex) continue;
      
      const factor = strength * affected.influence;
      const dist = Math.sqrt(
        vertex.position.x ** 2 + vertex.position.y ** 2 + vertex.position.z ** 2
      );
      
      if (dist > maxDist - typeSettings.scrapeDepth) {
        const targetDist = maxDist - typeSettings.scrapeDepth;
        const scale = targetDist / dist;
        
        affected.newPosition.x = vertex.position.x + (vertex.position.x * scale - vertex.position.x) * factor;
        affected.newPosition.y = vertex.position.y + (vertex.position.y * scale - vertex.position.y) * factor;
        affected.newPosition.z = vertex.position.z + (vertex.position.z * scale - vertex.position.z) * factor;
        
        vertex.position.x = affected.newPosition.x;
        vertex.position.y = affected.newPosition.y;
        vertex.position.z = affected.newPosition.z;
      }
    }
  }
  
  /** Brush de relleno */
  private applyFillBrush(
    mesh: EditableMeshData,
    affectedVertices: AffectedVertex[],
    strength: number
  ): void {
    // Encontrar el vértice más bajo
    let minDist = Infinity;
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (vertex) {
        const dist = Math.sqrt(
          vertex.position.x ** 2 + vertex.position.y ** 2 + vertex.position.z ** 2
        );
        if (dist < minDist) minDist = dist;
      }
    }
    
    // Rellenar hacia ese nivel
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (!vertex) continue;
      
      const factor = strength * affected.influence;
      const dist = Math.sqrt(
        vertex.position.x ** 2 + vertex.position.y ** 2 + vertex.position.z ** 2
      );
      
      if (dist < minDist + 0.1) {
        // Elevar hacia el nivel mínimo
        const targetDist = minDist + 0.1;
        const scale = targetDist / Math.max(dist, 0.001);
        
        affected.newPosition.x = vertex.position.x + (vertex.position.x * scale - vertex.position.x) * factor;
        affected.newPosition.y = vertex.position.y + (vertex.position.y * scale - vertex.position.y) * factor;
        affected.newPosition.z = vertex.position.z + (vertex.position.z * scale - vertex.position.z) * factor;
        
        vertex.position.x = affected.newPosition.x;
        vertex.position.y = affected.newPosition.y;
        vertex.position.z = affected.newPosition.z;
      }
    }
  }
  
  /** Brush elástico */
  private applyElasticBrush(
    mesh: EditableMeshData,
    affectedVertices: AffectedVertex[],
    delta: Vec3,
    strength: number,
    typeSettings: BrushTypeSettings
  ): void {
    // Simulación simplificada de deformación elástica
    const stiffness = typeSettings.elasticStiffness;
    const damping = typeSettings.elasticDamping;
    
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (!vertex) continue;
      
      // Aplicar movimiento base
      const factor = strength * affected.influence * stiffness;
      
      affected.newPosition.x = vertex.position.x + delta.x * factor;
      affected.newPosition.y = vertex.position.y + delta.y * factor;
      affected.newPosition.z = vertex.position.z + delta.z * factor;
      
      // Aplicar damping (resistencia de vecinos)
      let neighborDeltaX = 0, neighborDeltaY = 0, neighborDeltaZ = 0;
      let count = 0;
      
      for (const edgeId of vertex.edgeIds) {
        const edge = mesh.edges.get(edgeId);
        if (!edge) continue;
        
        const neighborId = edge.vertexIds[0] === affected.vertexId
          ? edge.vertexIds[1]
          : edge.vertexIds[0];
        
        const neighbor = mesh.vertices.get(neighborId);
        if (neighbor) {
          neighborDeltaX += neighbor.position.x - affected.originalPosition.x;
          neighborDeltaY += neighbor.position.y - affected.originalPosition.y;
          neighborDeltaZ += neighbor.position.z - affected.originalPosition.z;
          count++;
        }
      }
      
      if (count > 0) {
        affected.newPosition.x += (neighborDeltaX / count) * damping * affected.influence;
        affected.newPosition.y += (neighborDeltaY / count) * damping * affected.influence;
        affected.newPosition.z += (neighborDeltaZ / count) * damping * affected.influence;
      }
      
      vertex.position.x = affected.newPosition.x;
      vertex.position.y = affected.newPosition.y;
      vertex.position.z = affected.newPosition.z;
    }
  }
  
  // ============================================
  // VOLUME & BOUNDARY PRESERVATION
  // ============================================
  
  /** Preservar volumen de la malla */
  private preserveVolume(mesh: EditableMeshData, affectedVertices: AffectedVertex[]): void {
    // Calcular cambio de volumen
    let volumeDelta = 0;
    
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (!vertex) continue;
      
      // Diferencia de posición
      const dx = affected.newPosition.x - affected.originalPosition.x;
      const dy = affected.newPosition.y - affected.originalPosition.y;
      const dz = affected.newPosition.z - affected.originalPosition.z;
      
      // Contribución al volumen
      volumeDelta += (vertex.normal.x * dx + vertex.normal.y * dy + vertex.normal.z * dz);
    }
    
    // Compensar
    if (Math.abs(volumeDelta) > 0.0001) {
      const compensation = -volumeDelta / affectedVertices.length;
      
      for (const affected of affectedVertices) {
        const vertex = mesh.vertices.get(affected.vertexId);
        if (!vertex) continue;
        
        vertex.position.x += vertex.normal.x * compensation;
        vertex.position.y += vertex.normal.y * compensation;
        vertex.position.z += vertex.normal.z * compensation;
      }
    }
  }
  
  /** Preservar bordes de la malla */
  private preserveBoundaries(mesh: EditableMeshData, affectedVertices: AffectedVertex[]): void {
    for (const affected of affectedVertices) {
      const vertex = mesh.vertices.get(affected.vertexId);
      if (!vertex) continue;
      
      // Verificar si es vértice de borde
      const isBoundary = vertex.edgeIds.some(edgeId => {
        const edge = mesh.edges.get(edgeId);
        return edge && edge.faceIds.length === 1;
      });
      
      if (isBoundary) {
        // Restaurar posición original
        vertex.position.x = affected.originalPosition.x;
        vertex.position.y = affected.originalPosition.y;
        vertex.position.z = affected.originalPosition.z;
      }
    }
  }
  
  // ============================================
  // STROKE MANAGEMENT
  // ============================================
  
  /** Comenzar un stroke */
  beginStroke(
    mesh: EditableMeshData,
    point: StrokePoint,
    viewDirection: Vec3
  ): void {
    if (!this.activeBrush) return;
    
    this.isDrawing = true;
    this.lastBrushPosition = point.position;
    
    // Crear nuevo stroke
    this.currentStroke = {
      id: generateId(),
      brushId: this.activeBrush.id,
      brushType: this.activeBrush.type,
      points: [point],
      startTime: point.timestamp,
      endTime: point.timestamp,
      totalVerticesAffected: 0,
      canUndo: true,
    };
    
    // Encontrar vértices afectados
    const affected = this.findAffectedVertices(
      mesh,
      point.position,
      point.radius,
      viewDirection,
      this.activeBrush.settings
    );
    
    point.affectedVertices = affected;
    
    // Crear datos de undo
    this.currentStroke.undoData = {
      vertexPositions: new Map(
        affected.map(v => [v.vertexId, { ...v.originalPosition }])
      ),
      vertexMaskValues: new Map(
        affected.map(v => [v.vertexId, this.maskData.vertexMasks.get(v.vertexId) || 0])
      ),
    };
    
    // Aplicar brush inicial
    this.applyBrush(
      mesh,
      affected,
      this.activeBrush,
      { x: 0, y: 0, z: 0 },
      point.strength * point.pressure
    );
  }
  
  /** Continuar un stroke */
  continueStroke(
    mesh: EditableMeshData,
    point: StrokePoint,
    viewDirection: Vec3
  ): void {
    if (!this.activeBrush || !this.currentStroke || !this.isDrawing) return;
    
    // Verificar espaciado
    if (this.lastBrushPosition) {
      const dx = point.position.x - this.lastBrushPosition.x;
      const dy = point.position.y - this.lastBrushPosition.y;
      const dz = point.position.z - this.lastBrushPosition.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      if (distance < this.activeBrush.settings.spacing * point.radius) {
        return;
      }
    }
    
    this.lastBrushPosition = point.position;
    
    // Calcular delta para brush de agarre
    let delta: Vec3 = { x: 0, y: 0, z: 0 };
    if (this.activeBrush.type === 'grab' && this.currentStroke.points.length > 0) {
      const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1];
      delta = {
        x: point.position.x - lastPoint.position.x,
        y: point.position.y - lastPoint.position.y,
        z: point.position.z - lastPoint.position.z,
      };
    }
    
    // Encontrar vértices afectados
    const affected = this.findAffectedVertices(
      mesh,
      point.position,
      point.radius,
      viewDirection,
      this.activeBrush.settings
    );
    
    point.affectedVertices = affected;
    
    // Añadir datos de undo para nuevos vértices
    if (this.currentStroke.undoData) {
      for (const v of affected) {
        if (!this.currentStroke.undoData.vertexPositions.has(v.vertexId)) {
          this.currentStroke.undoData.vertexPositions.set(v.vertexId, { ...v.originalPosition });
          this.currentStroke.undoData.vertexMaskValues.set(
            v.vertexId,
            this.maskData.vertexMasks.get(v.vertexId) || 0
          );
        }
      }
    }
    
    // Aplicar brush
    this.applyBrush(
      mesh,
      affected,
      this.activeBrush,
      delta,
      point.strength * point.pressure
    );
    
    // Añadir punto al stroke
    this.currentStroke.points.push(point);
    this.currentStroke.endTime = point.timestamp;
    this.currentStroke.totalVerticesAffected += affected.length;
  }
  
  /** Finalizar un stroke */
  endStroke(): BrushStroke | null {
    if (!this.currentStroke) return null;
    
    this.isDrawing = false;
    this.lastBrushPosition = null;
    
    // Añadir al historial
    this.strokeHistory.push(this.currentStroke);
    
    // Limitar tamaño del historial
    if (this.strokeHistory.length > this.maxHistorySize) {
      this.strokeHistory.shift();
    }
    
    const completedStroke = this.currentStroke;
    this.currentStroke = null;
    
    return completedStroke;
  }
  
  /** Deshacer último stroke */
  undoStroke(mesh: EditableMeshData): boolean {
    const lastStroke = this.strokeHistory.pop();
    if (!lastStroke || !lastStroke.undoData) return false;
    
    // Restaurar posiciones
    for (const [vertexId, position] of lastStroke.undoData.vertexPositions) {
      const vertex = mesh.vertices.get(vertexId);
      if (vertex) {
        vertex.position.x = position.x;
        vertex.position.y = position.y;
        vertex.position.z = position.z;
      }
    }
    
    // Restaurar máscaras
    for (const [vertexId, maskValue] of lastStroke.undoData.vertexMaskValues) {
      this.maskData.vertexMasks.set(vertexId, maskValue);
    }
    
    // Restaurar topología si hubo cambios
    if (lastStroke.undoData.topologyChanges) {
      // Aplicar cambios de topología inversos
    }
    
    return true;
  }
  
  /** Obtener historial de strokes */
  getStrokeHistory(): BrushStroke[] {
    return [...this.strokeHistory];
  }
  
  // ============================================
  // MASK OPERATIONS
  // ============================================
  
  /** Crear datos de máscara vacíos */
  private createEmptyMaskData(): MaskData {
    return {
      vertexMasks: new Map(),
      faceMasks: new Map(),
      edgeMasks: new Map(),
      textureResolution: 1024,
      isVisible: true,
      opacity: 0.5,
      color: { r: 1, g: 0, b: 0, a: 1 },
    };
  }
  
  /** Limpiar todas las máscaras */
  clearMask(): void {
    this.maskData.vertexMasks.clear();
    this.maskData.faceMasks.clear();
    this.maskData.edgeMasks.clear();
  }
  
  /** Invertir máscara */
  invertMask(): void {
    for (const [id, value] of this.maskData.vertexMasks) {
      this.maskData.vertexMasks.set(id, 1 - value);
    }
  }
  
  /** Obtener datos de máscara */
  getMaskData(): MaskData {
    return this.maskData;
  }
  
  /** Establecer valor de máscara para un vértice */
  setVertexMask(vertexId: string, value: number): void {
    this.maskData.vertexMasks.set(vertexId, Math.max(0, Math.min(1, value)));
  }
  
  // ============================================
  // TOPOLOGY ANALYSIS
  // ============================================
  
  /** Analizar topología de la malla */
  analyzeTopology(mesh: EditableMeshData): TopologyAnalysis {
    const analysis: TopologyAnalysis = {
      vertexCount: mesh.vertices.size,
      edgeCount: mesh.edges.size,
      faceCount: mesh.faces.size,
      triangleCount: 0,
      quadCount: 0,
      ngonCount: 0,
      boundaryCount: 0,
      poleCount: 0,
      averageValence: 0,
      quadRatio: 0,
      irregularRatio: 0,
      boundaries: [],
      poles: [],
      ngons: [],
      creases: [],
      corners: [],
      issues: [],
      suggestions: [],
    };
    
    // Contar tipos de caras
    for (const face of mesh.faces.values()) {
      const sides = face.vertexIds.length;
      if (sides === 3) analysis.triangleCount++;
      else if (sides === 4) analysis.quadCount++;
      else analysis.ngonCount++;
    }
    
    // Encontrar bordes y polos
    let totalValence = 0;
    let irregularCount = 0;
    
    for (const [vertexId, vertex] of mesh.vertices) {
      const valence = vertex.faceIds.length;
      totalValence += valence;
      
      // Verificar si es borde
      const isBoundary = vertex.edgeIds.some(edgeId => {
        const edge = mesh.edges.get(edgeId);
        return edge && edge.faceIds.length === 1;
      });
      
      if (isBoundary) {
        analysis.boundaryCount++;
        analysis.boundaries.push({
          id: generateId(),
          type: 'boundary',
          vertexIds: [vertexId],
          edgeIds: vertex.edgeIds,
          faceIds: vertex.faceIds,
          position: vertex.position,
          normal: vertex.normal,
          curvature: 0,
          valence,
          isSelected: false,
          isMarked: false,
          priority: 0,
        });
      }
      
      // Verificar si es polo (valencia != 4 en malla de quads)
      if (valence !== 4 && valence > 2) {
        analysis.poleCount++;
        irregularCount++;
        
        if (valence >= 5 || valence === 3) {
          analysis.poles.push({
            id: generateId(),
            type: 'pole',
            vertexIds: [vertexId],
            edgeIds: vertex.edgeIds,
            faceIds: vertex.faceIds,
            position: vertex.position,
            normal: vertex.normal,
            curvature: 0,
            valence,
            isSelected: false,
            isMarked: false,
            priority: valence === 3 ? 1 : 2,
          });
        }
      }
    }
    
    // Calcular estadísticas
    analysis.averageValence = totalValence / mesh.vertices.size;
    analysis.quadRatio = mesh.faces.size > 0 ? analysis.quadCount / mesh.faces.size : 0;
    analysis.irregularRatio = mesh.vertices.size > 0 ? irregularCount / mesh.vertices.size : 0;
    
    // Generar issues
    if (analysis.ngonCount > 0) {
      analysis.issues.push({
        type: 'ngon',
        severity: 'warning',
        elementIds: analysis.ngons.map(n => n.id),
        position: { x: 0, y: 0, z: 0 },
        description: `Found ${analysis.ngonCount} n-gons (faces with more than 4 sides)`,
        autoFixAvailable: true,
      });
    }
    
    if (analysis.poleCount > analysis.vertexCount * 0.1) {
      analysis.issues.push({
        type: 'pole',
        severity: 'info',
        elementIds: analysis.poles.map(p => p.id),
        position: { x: 0, y: 0, z: 0 },
        description: `High pole count (${analysis.poleCount}) may affect subdivision`,
        autoFixAvailable: false,
      });
    }
    
    // Generar sugerencias
    if (analysis.quadRatio < 0.7) {
      analysis.suggestions.push({
        type: 'retopology',
        description: 'Consider retopologizing to improve quad ratio',
        affectedArea: [],
        estimatedImprovement: 0.3,
      });
    }
    
    this.topologyAnalysis = analysis;
    return analysis;
  }
  
  /** Obtener análisis de topología actual */
  getTopologyAnalysis(): TopologyAnalysis | null {
    return this.topologyAnalysis;
  }
  
  // ============================================
  // SPATIAL HASH
  // ============================================
  
  /** Construir spatial hash para la malla */
  buildSpatialHash(mesh: EditableMeshData, cellSize: number): void {
    this.spatialHash.clear();
    
    for (const [vertexId, vertex] of mesh.vertices) {
      const cell = this.worldToCell(vertex.position, cellSize);
      const key = `${cell.x},${cell.y},${cell.z}`;
      
      let cellVertices = this.spatialHash.get(key);
      if (!cellVertices) {
        cellVertices = [];
        this.spatialHash.set(key, cellVertices);
      }
      cellVertices.push(vertexId);
    }
  }
  
  /** Limpiar spatial hash */
  clearSpatialHash(): void {
    this.spatialHash.clear();
  }
  
  // ============================================
  // SYMMETRY
  // ============================================
  
  /** Aplicar simetría a una posición */
  applySymmetry(position: Vec3, mode: SymmetryMode, offset: number = 0): Vec3[] {
    const positions: Vec3[] = [position];
    
    switch (mode) {
      case 'x':
        positions.push({
          x: offset * 2 - position.x,
          y: position.y,
          z: position.z,
        });
        break;
      case 'y':
        positions.push({
          x: position.x,
          y: offset * 2 - position.y,
          z: position.z,
        });
        break;
      case 'z':
        positions.push({
          x: position.x,
          y: position.y,
          z: offset * 2 - position.z,
        });
        break;
      case 'radial':
        // Simetría radial
        for (let i = 1; i < 6; i++) {
          const angle = (Math.PI * 2 * i) / 6;
          positions.push({
            x: position.x * Math.cos(angle) - position.z * Math.sin(angle),
            y: position.y,
            z: position.x * Math.sin(angle) + position.z * Math.cos(angle),
          });
        }
        break;
    }
    
    return positions;
  }
  
  // ============================================
  // UTILITY
  // ============================================
  
  /** Verificar si está dibujando */
  isActive(): boolean {
    return this.isDrawing;
  }
  
  /** Obtener brush actual */
  getCurrentStroke(): BrushStroke | null {
    return this.currentStroke;
  }
  
  /** Actualizar normales de vértices */
  updateVertexNormals(mesh: EditableMeshData): void {
    this.vertexNormals.clear();
    
    for (const [vertexId, vertex] of mesh.vertices) {
      let nx = 0, ny = 0, nz = 0;
      
      for (const faceId of vertex.faceIds) {
        const face = mesh.faces.get(faceId);
        if (face) {
          nx += face.normal.x;
          ny += face.normal.y;
          nz += face.normal.z;
        }
      }
      
      const count = vertex.faceIds.length;
      if (count > 0) {
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 0) {
          vertex.normal.x = nx / len;
          vertex.normal.y = ny / len;
          vertex.normal.z = nz / len;
        }
      }
      
      this.vertexNormals.set(vertexId, { ...vertex.normal });
    }
  }
  
  /** Serializar configuración */
  serialize(): object {
    return {
      brushes: Array.from(this.brushes.entries()).map(([id, brush]) => ({
        ...brush,
      })),
      activeBrushId: this.activeBrush?.id,
    };
  }
  
  /** Deserializar configuración */
  deserialize(data: { brushes: Brush[]; activeBrushId?: string }): void {
    this.brushes.clear();
    
    for (const brush of data.brushes) {
      this.brushes.set(brush.id, brush);
    }
    
    if (data.activeBrushId) {
      this.activeBrush = this.brushes.get(data.activeBrushId) || null;
    }
  }
}

// ============================================
// BRUSH PRESETS
// ============================================

/** Presets de brush */
export const BRUSH_PRESETS: Record<string, Partial<BrushSettings>> = {
  soft: {
    falloffType: 'smooth',
    strength: 0.3,
  },
  hard: {
    falloffType: 'sharp',
    strength: 0.8,
  },
  precise: {
    falloffType: 'spike',
    radius: 0.2,
    strength: 0.5,
  },
  broad: {
    falloffType: 'dome',
    radius: 1.5,
    strength: 0.4,
  },
  airbrush: {
    falloffType: 'smooth',
    strength: 0.1,
    accumulate: true,
  },
};

export default TopologyBrushSystem;
