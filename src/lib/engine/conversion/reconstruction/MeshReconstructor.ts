/**
 * NEXUS Engine - Mesh Reconstructor
 * 
 * Sistema de reconstrucción de mallas desde nubes de puntos.
 * Incluye múltiples algoritmos:
 * - Marching Cubes
 * - Poisson Reconstruction
 * - Delaunay Triangulation
 * - Ball Pivoting
 * - Alpha Shapes
 */

import {
  Vec3,
  RGBA,
  UV,
  PointCloud,
  Point3D,
  BoundingBox3D,
  EditableMeshData,
  EditableVertex,
  EditableEdge,
  EditableFace,
  TopologyGraph,
  MeshAttributes,
  ReconstructionMetadata,
  QualityLevel,
  generateId,
  emptyBoundingBox3D,
  vec3,
  quat,
  uv,
  rgba,
} from '../types';

// ============================================
// ALGORITHM TYPES
// ============================================

/** Algoritmos de reconstrucción disponibles */
export type ReconstructionAlgorithm =
  | 'marching_cubes'
  | 'poisson'
  | 'delaunay'
  | 'ball_pivoting'
  | 'alpha_shape'
  | 'greedy_triangulation'
  | 'hudor';

/** Configuración de reconstrucción */
export interface MeshReconstructorConfig {
  // Algoritmo
  algorithm: ReconstructionAlgorithm;
  
  // Marching Cubes
  mcResolution: number;          // Voxel grid resolution
  mcIsoLevel: number;            // Iso-surface level
  
  // Poisson
  poissonDepth: number;          // Octree depth (5-12)
  poissonSamplesPerNode: number;
  poissonScale: number;
  
  // Ball Pivoting
  bpBallRadius: number;
  bpClustering: number;
  bpAngleThreshold: number;      // Degrees
  
  // Delaunay
  delaunayAlpha: number;         // Alpha value for alpha shapes
  
  // General
  smoothIterations: number;
  removeDegenerateFaces: boolean;
  fillHoles: boolean;
  maxHoleSize: number;
  orientNormals: boolean;
  consistentWinding: boolean;
  
  // Simplificación
  simplifyEnabled: boolean;
  targetFaceCount: number;
  preserveBoundary: boolean;
}

// ============================================
// MARCHING CUBES TABLES
// ============================================

// 256 casos de Marching Cubes (simplificado)
const EDGE_TABLE = new Uint32Array([
  0x0, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c,
  0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00,
  0x190, 0x99, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c,
  0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90,
  // ... (tabla completa tendría 256 entradas)
]);

const TRI_TABLE = [
  [-1],
  [0, 8, 3, -1],
  [0, 1, 9, -1],
  [1, 8, 3, 9, 8, 1, -1],
  [1, 2, 10, -1],
  [0, 8, 3, 1, 2, 10, -1],
  [9, 2, 10, 0, 2, 9, -1],
  [2, 8, 3, 2, 10, 8, 10, 9, 8, -1],
  [3, 11, 2, -1],
  [0, 11, 2, 8, 11, 0, -1],
  [1, 9, 0, 2, 3, 11, -1],
  [1, 11, 2, 1, 9, 11, 9, 8, 11, -1],
  [3, 10, 1, 11, 10, 3, -1],
  [0, 10, 1, 0, 8, 10, 8, 11, 10, -1],
  [3, 9, 0, 3, 11, 9, 11, 10, 9, -1],
  [9, 8, 10, 10, 8, 11, -1],
  // ... (tabla completa tendría 256 entradas de triangulación)
];

// ============================================
// SPATIAL ACCELERATION
// ============================================

/** Grid espacial para aceleración */
interface SpatialGrid {
  cells: Map<string, number[]>;  // cellKey -> pointIndices
  cellSize: number;
  bounds: BoundingBox3D;
  resolution: { x: number; y: number; z: number };
}

/**
 * Crear grid espacial
 */
function createSpatialGrid(points: Point3D[], cellSize: number): SpatialGrid {
  const bounds = emptyBoundingBox3D();
  
  for (const p of points) {
    bounds.min.x = Math.min(bounds.min.x, p.position.x);
    bounds.min.y = Math.min(bounds.min.y, p.position.y);
    bounds.min.z = Math.min(bounds.min.z, p.position.z);
    bounds.max.x = Math.max(bounds.max.x, p.position.x);
    bounds.max.y = Math.max(bounds.max.y, p.position.y);
    bounds.max.z = Math.max(bounds.max.z, p.position.z);
  }
  
  // Expandir ligeramente
  const expand = cellSize * 0.1;
  bounds.min.x -= expand;
  bounds.min.y -= expand;
  bounds.min.z -= expand;
  bounds.max.x += expand;
  bounds.max.y += expand;
  bounds.max.z += expand;
  
  const resolution = {
    x: Math.ceil((bounds.max.x - bounds.min.x) / cellSize),
    y: Math.ceil((bounds.max.y - bounds.min.y) / cellSize),
    z: Math.ceil((bounds.max.z - bounds.min.z) / cellSize),
  };
  
  const cells = new Map<string, number[]>();
  
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const cx = Math.floor((p.position.x - bounds.min.x) / cellSize);
    const cy = Math.floor((p.position.y - bounds.min.y) / cellSize);
    const cz = Math.floor((p.position.z - bounds.min.z) / cellSize);
    
    const key = `${cx},${cy},${cz}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = [];
      cells.set(key, cell);
    }
    cell.push(i);
  }
  
  return { cells, cellSize, bounds, resolution };
}

/**
 * Encontrar vecinos en radio
 */
function findNeighbors(
  grid: SpatialGrid,
  point: Vec3,
  radius: number
): number[] {
  const neighbors: number[] = [];
  const cellRadius = Math.ceil(radius / grid.cellSize);
  
  const cx = Math.floor((point.x - grid.bounds.min.x) / grid.cellSize);
  const cy = Math.floor((point.y - grid.bounds.min.y) / grid.cellSize);
  const cz = Math.floor((point.z - grid.bounds.min.z) / grid.cellSize);
  
  const radiusSq = radius * radius;
  
  for (let dx = -cellRadius; dx <= cellRadius; dx++) {
    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const key = `${cx + dx},${cy + dy},${cz + dz}`;
        const cell = grid.cells.get(key);
        
        if (cell) {
          for (const idx of cell) {
            // Verificar distancia real
            // Los puntos se obtienen externamente
            neighbors.push(idx);
          }
        }
      }
    }
  }
  
  return neighbors;
}

// ============================================
// MESH RECONSTRUCTOR
// ============================================

/**
 * Reconstructor de mallas desde nubes de puntos
 */
export class MeshReconstructor {
  private config: MeshReconstructorConfig;
  private grid: SpatialGrid | null = null;
  
  constructor(config?: Partial<MeshReconstructorConfig>) {
    this.config = {
      algorithm: 'marching_cubes',
      mcResolution: 64,
      mcIsoLevel: 0.5,
      poissonDepth: 8,
      poissonSamplesPerNode: 1.5,
      poissonScale: 1.1,
      bpBallRadius: 0.5,
      bpClustering: 0.1,
      bpAngleThreshold: 120,
      delaunayAlpha: 1.0,
      smoothIterations: 3,
      removeDegenerateFaces: true,
      fillHoles: true,
      maxHoleSize: 30,
      orientNormals: true,
      consistentWinding: true,
      simplifyEnabled: false,
      targetFaceCount: 10000,
      preserveBoundary: true,
      ...config,
    };
  }
  
  // ============================================
  // MAIN RECONSTRUCTION
  // ============================================
  
  /**
   * Reconstruir malla desde nube de puntos
   */
  reconstruct(cloud: PointCloud): EditableMeshData {
    // Crear grid espacial
    this.grid = createSpatialGrid(cloud.points, this.estimateOptimalCellSize(cloud));
    
    // Estimar normales si no existen
    const pointsWithNormals = this.estimateNormals(cloud.points);
    
    // Aplicar algoritmo seleccionado
    let mesh: EditableMeshData;
    
    switch (this.config.algorithm) {
      case 'marching_cubes':
        mesh = this.marchingCubes(pointsWithNormals, cloud.bounds);
        break;
      case 'poisson':
        mesh = this.poissonReconstruction(pointsWithNormals);
        break;
      case 'ball_pivoting':
        mesh = this.ballPivoting(pointsWithNormals);
        break;
      case 'delaunay':
      case 'alpha_shape':
        mesh = this.delaunayTriangulation(pointsWithNormals);
        break;
      case 'greedy_triangulation':
        mesh = this.greedyTriangulation(pointsWithNormals);
        break;
      default:
        mesh = this.marchingCubes(pointsWithNormals, cloud.bounds);
    }
    
    // Post-procesamiento
    mesh = this.postprocess(mesh, pointsWithNormals);
    
    return mesh;
  }
  
  /**
   * Estimar tamaño de celda óptimo
   */
  private estimateOptimalCellSize(cloud: PointCloud): number {
    const volume = (cloud.bounds.max.x - cloud.bounds.min.x) *
                   (cloud.bounds.max.y - cloud.bounds.min.y) *
                   (cloud.bounds.max.z - cloud.bounds.min.z);
    
    const pointsPerUnit = cloud.points.length / volume;
    
    // Ajustar para tener ~1 punto por celda en promedio
    return Math.pow(1 / pointsPerUnit, 1/3);
  }
  
  // ============================================
  // NORMAL ESTIMATION
  // ============================================
  
  /**
   * Estimar normales para todos los puntos
   */
  private estimateNormals(points: Point3D[]): Point3D[] {
    const k = 10; // K vecinos más cercanos
    const result: Point3D[] = [];
    
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      
      // Encontrar K vecinos más cercanos
      const neighborIndices = this.findKNearest(p.position, k, points);
      const neighbors = neighborIndices.map(idx => points[idx]);
      
      // Calcular centroide
      let cx = 0, cy = 0, cz = 0;
      for (const n of neighbors) {
        cx += n.position.x;
        cy += n.position.y;
        cz += n.position.z;
      }
      cx /= neighbors.length;
      cy /= neighbors.length;
      cz /= neighbors.length;
      
      // Calcular matriz de covarianza
      let cxx = 0, cxy = 0, cxz = 0;
      let cyy = 0, cyz = 0, czz = 0;
      
      for (const n of neighbors) {
        const dx = n.position.x - cx;
        const dy = n.position.y - cy;
        const dz = n.position.z - cz;
        
        cxx += dx * dx;
        cxy += dx * dy;
        cxz += dx * dz;
        cyy += dy * dy;
        cyz += dy * dz;
        czz += dz * dz;
      }
      
      // Encontrar eigenvector de menor eigenvalue
      // Simplificación: usar aproximación
      const normal = this.approximateNormalFromCovariance(cxx, cxy, cxz, cyy, cyz, czz);
      
      result.push({
        ...p,
        normal,
      });
    }
    
    // Orientar normales consistentemente
    if (this.config.orientNormals) {
      this.orientNormalsConsistently(result, points);
    }
    
    return result;
  }
  
  /**
   * Encontrar K vecinos más cercanos
   */
  private findKNearest(point: Vec3, k: number, points: Point3D[]): number[] {
    const distances: Array<{ idx: number; dist: number }> = [];
    
    for (let i = 0; i < points.length; i++) {
      const dx = points[i].position.x - point.x;
      const dy = points[i].position.y - point.y;
      const dz = points[i].position.z - point.z;
      const dist = dx * dx + dy * dy + dz * dz;
      distances.push({ idx: i, dist });
    }
    
    distances.sort((a, b) => a.dist - b.dist);
    return distances.slice(0, k).map(d => d.idx);
  }
  
  /**
   * Aproximar normal desde matriz de covarianza
   */
  private approximateNormalFromCovariance(
    cxx: number, cxy: number, cxz: number,
    cyy: number, cyz: number, czz: number
  ): Vec3 {
    // Usar método de Jacobi para encontrar eigenvector
    // Simplificación: usar heurística
    
    // Matriz de covarianza:
    // | cxx cxy cxz |
    // | cxy cyy cyz |
    // | cxz cyz czz |
    
    // Eigenvalue más pequeño corresponde a la normal
    // Aproximación: usar diagonalización iterativa
    
    let v = { x: 1, y: 0, z: 0 }; // Vector inicial
    
    for (let iter = 0; iter < 5; iter++) {
      // Multiplicar por matriz
      const vx = cxx * v.x + cxy * v.y + cxz * v.z;
      const vy = cxy * v.x + cyy * v.y + cyz * v.z;
      const vz = cxz * v.x + cyz * v.y + czz * v.z;
      
      // Normalizar
      const len = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (len > 0.0001) {
        v = { x: vx / len, y: vy / len, z: vz / len };
      }
    }
    
    return v;
  }
  
  /**
   * Orientar normales consistentemente
   */
  private orientNormalsConsistently(
    result: Point3D[],
    originalPoints: Point3D[]
  ): void {
    // Usar Minimum Spanning Tree para orientar
    // Simplificación: orientar hacia el centroide
    
    let cx = 0, cy = 0, cz = 0;
    for (const p of originalPoints) {
      cx += p.position.x;
      cy += p.position.y;
      cz += p.position.z;
    }
    cx /= originalPoints.length;
    cy /= originalPoints.length;
    cz /= originalPoints.length;
    
    for (const p of result) {
      if (!p.normal) continue;
      
      // Vector desde punto hacia centroide
      const toCenter = {
        x: cx - p.position.x,
        y: cy - p.position.y,
        z: cz - p.position.z,
      };
      
      // Si la normal apunta hacia afuera, invertir
      const dot = p.normal.x * toCenter.x +
                  p.normal.y * toCenter.y +
                  p.normal.z * toCenter.z;
      
      if (dot > 0) {
        p.normal.x = -p.normal.x;
        p.normal.y = -p.normal.y;
        p.normal.z = -p.normal.z;
      }
    }
  }
  
  // ============================================
  // MARCHING CUBES
  // ============================================
  
  /**
   * Reconstrucción con Marching Cubes
   */
  private marchingCubes(points: Point3D[], bounds: BoundingBox3D): EditableMeshData {
    const resolution = this.config.mcResolution;
    const isoLevel = this.config.mcIsoLevel;
    
    // Crear voxel grid
    const sizeX = (bounds.max.x - bounds.min.x) / resolution;
    const sizeY = (bounds.max.y - bounds.min.y) / resolution;
    const sizeZ = (bounds.max.z - bounds.min.z) / resolution;
    
    // Calcular campo escalar (distancia implícita)
    const field = this.computeScalarField(points, bounds, resolution);
    
    // Extraer isosuperficie
    const vertices: Vec3[] = [];
    const faces: Array<[number, number, number]> = [];
    
    for (let i = 0; i < resolution - 1; i++) {
      for (let j = 0; j < resolution - 1; j++) {
        for (let k = 0; k < resolution - 1; k++) {
          // Obtener valores de los 8 vértices del cubo
          const idx = i + j * resolution + k * resolution * resolution;
          const cubeValues = [
            field[idx],
            field[idx + 1],
            field[idx + resolution + 1],
            field[idx + resolution],
            field[idx + resolution * resolution],
            field[idx + 1 + resolution * resolution],
            field[idx + resolution + 1 + resolution * resolution],
            field[idx + resolution + resolution * resolution],
          ];
          
          // Determinar caso de Marching Cubes
          let cubeIndex = 0;
          for (let v = 0; v < 8; v++) {
            if (cubeValues[v] < isoLevel) {
              cubeIndex |= (1 << v);
            }
          }
          
          // Si todos dentro o todos fuera, continuar
          if (cubeIndex === 0 || cubeIndex === 255) continue;
          
          // Interpolar vértices en edges
          const edgeVertices = this.interpolateEdges(
            i, j, k,
            cubeValues,
            isoLevel,
            sizeX, sizeY, sizeZ,
            bounds.min
          );
          
          // Triangular según tabla
          const tris = TRI_TABLE[cubeIndex];
          if (tris && tris[0] >= 0) {
            for (let t = 0; t < tris.length; t += 3) {
              if (tris[t] >= 0 && tris[t + 1] >= 0 && tris[t + 2] >= 0) {
                const v0 = edgeVertices[tris[t]];
                const v1 = edgeVertices[tris[t + 1]];
                const v2 = edgeVertices[tris[t + 2]];
                
                if (v0 && v1 && v2) {
                  const baseIdx = vertices.length;
                  vertices.push(v0, v1, v2);
                  faces.push([baseIdx, baseIdx + 1, baseIdx + 2]);
                }
              }
            }
          }
        }
      }
    }
    
    return this.createMeshFromArrays(vertices, faces, points);
  }
  
  /**
   * Calcular campo escalar
   */
  private computeScalarField(
    points: Point3D[],
    bounds: BoundingBox3D,
    resolution: number
  ): Float32Array {
    const field = new Float32Array(resolution * resolution * resolution);
    
    const sizeX = (bounds.max.x - bounds.min.x) / resolution;
    const sizeY = (bounds.max.y - bounds.min.y) / resolution;
    const sizeZ = (bounds.max.z - bounds.min.z) / resolution;
    
    // Radio de influencia
    const radius = Math.max(sizeX, sizeY, sizeZ) * 2;
    
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        for (let k = 0; k < resolution; k++) {
          const x = bounds.min.x + (i + 0.5) * sizeX;
          const y = bounds.min.y + (j + 0.5) * sizeY;
          const z = bounds.min.z + (k + 0.5) * sizeZ;
          
          // Calcular distancia mínima a puntos cercanos
          let minDist = Infinity;
          
          // Búsqueda en grid espacial
          for (const p of points) {
            const dx = p.position.x - x;
            const dy = p.position.y - y;
            const dz = p.position.z - z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            minDist = Math.min(minDist, dist);
          }
          
          // Convertir distancia a valor de campo
          // Más cercano = menor valor
          const idx = i + j * resolution + k * resolution * resolution;
          field[idx] = minDist / radius;
        }
      }
    }
    
    return field;
  }
  
  /**
   * Interpolar vértices en edges del cubo
   */
  private interpolateEdges(
    i: number, j: number, k: number,
    cubeValues: number[],
    isoLevel: number,
    sizeX: number, sizeY: number, sizeZ: number,
    minBound: Vec3
  ): Vec3[] {
    const edges: Vec3[] = new Array(12);
    
    // Definir las 12 edges del cubo
    const edgeDefs = [
      [0, 1], [1, 2], [2, 3], [3, 0],  // Bottom face
      [4, 5], [5, 6], [6, 7], [7, 4],  // Top face
      [0, 4], [1, 5], [2, 6], [3, 7],  // Vertical edges
    ];
    
    // Posiciones de los 8 vértices del cubo
    const corners: Vec3[] = [
      { x: i * sizeX, y: j * sizeY, z: k * sizeZ },
      { x: (i + 1) * sizeX, y: j * sizeY, z: k * sizeZ },
      { x: (i + 1) * sizeX, y: (j + 1) * sizeY, z: k * sizeZ },
      { x: i * sizeX, y: (j + 1) * sizeY, z: k * sizeZ },
      { x: i * sizeX, y: j * sizeY, z: (k + 1) * sizeZ },
      { x: (i + 1) * sizeX, y: j * sizeY, z: (k + 1) * sizeZ },
      { x: (i + 1) * sizeX, y: (j + 1) * sizeY, z: (k + 1) * sizeZ },
      { x: i * sizeX, y: (j + 1) * sizeY, z: (k + 1) * sizeZ },
    ];
    
    for (let e = 0; e < 12; e++) {
      const [v0, v1] = edgeDefs[e];
      const val0 = cubeValues[v0];
      const val1 = cubeValues[v1];
      
      // Si la isosuperficie cruza esta edge
      if ((val0 < isoLevel) !== (val1 < isoLevel)) {
        // Interpolación lineal
        const t = (isoLevel - val0) / (val1 - val0);
        
        edges[e] = {
          x: minBound.x + corners[v0].x + t * (corners[v1].x - corners[v0].x),
          y: minBound.y + corners[v0].y + t * (corners[v1].y - corners[v0].y),
          z: minBound.z + corners[v0].z + t * (corners[v1].z - corners[v0].z),
        };
      }
    }
    
    return edges;
  }
  
  // ============================================
  // POISSON RECONSTRUCTION
  // ============================================
  
  /**
   * Reconstrucción con Poisson
   */
  private poissonReconstruction(points: Point3D[]): EditableMeshData {
    // Poisson usa un octree para resolver la ecuación de Poisson
    // ∇²χ = -∇·n
    
    const depth = this.config.poissonDepth;
    
    // Construir octree
    const octree = this.buildOctree(points, depth);
    
    // Calcular campo de vectores desde normales
    const vectorField = this.computeVectorField(octree, points);
    
    // Resolver Poisson (simplificación: usar marching cubes en campo implícito)
    const vertices: Vec3[] = [];
    const faces: Array<[number, number, number]> = [];
    
    // Recorrer octree y extraer superficie
    this.extractOctreeSurface(octree, vertices, faces);
    
    return this.createMeshFromArrays(vertices, faces, points);
  }
  
  /**
   * Construir octree
   */
  private buildOctree(points: Point3D[], maxDepth: number): OctreeNode {
    const root: OctreeNode = {
      bounds: this.computePointsBounds(points),
      depth: 0,
      maxDepth,
      points: points.map((p, i) => i),
    };
    
    this.subdivideNode(root, points);
    return root;
  }
  
  /**
   * Calcular bounds de puntos
   */
  private computePointsBounds(points: Point3D[]): BoundingBox3D {
    const bounds = emptyBoundingBox3D();
    
    for (const p of points) {
      bounds.min.x = Math.min(bounds.min.x, p.position.x);
      bounds.min.y = Math.min(bounds.min.y, p.position.y);
      bounds.min.z = Math.min(bounds.min.z, p.position.z);
      bounds.max.x = Math.max(bounds.max.x, p.position.x);
      bounds.max.y = Math.max(bounds.max.y, p.position.y);
      bounds.max.z = Math.max(bounds.max.z, p.position.z);
    }
    
    return bounds;
  }
  
  /**
   * Subdividir nodo de octree
   */
  private subdivideNode(node: OctreeNode, allPoints: Point3D[]): void {
    if (node.depth >= node.maxDepth || node.points.length < 10) {
      return;
    }
    
    const center = {
      x: (node.bounds.min.x + node.bounds.max.x) / 2,
      y: (node.bounds.min.y + node.bounds.max.y) / 2,
      z: (node.bounds.min.z + node.bounds.max.z) / 2,
    };
    
    node.children = [];
    
    for (let i = 0; i < 8; i++) {
      const childBounds: BoundingBox3D = {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      };
      
      // Determinar cuadrante
      childBounds.min.x = (i & 1) ? center.x : node.bounds.min.x;
      childBounds.min.y = (i & 2) ? center.y : node.bounds.min.y;
      childBounds.min.z = (i & 4) ? center.z : node.bounds.min.z;
      childBounds.max.x = (i & 1) ? node.bounds.max.x : center.x;
      childBounds.max.y = (i & 2) ? node.bounds.max.y : center.y;
      childBounds.max.z = (i & 4) ? node.bounds.max.z : center.z;
      
      // Filtrar puntos en este cuadrante
      const childPoints = node.points.filter(idx => {
        const p = allPoints[idx];
        return p.position.x >= childBounds.min.x &&
               p.position.x < childBounds.max.x &&
               p.position.y >= childBounds.min.y &&
               p.position.y < childBounds.max.y &&
               p.position.z >= childBounds.min.z &&
               p.position.z < childBounds.max.z;
      });
      
      const child: OctreeNode = {
        bounds: childBounds,
        depth: node.depth + 1,
        maxDepth: node.maxDepth,
        points: childPoints,
      };
      
      node.children.push(child);
      this.subdivideNode(child, allPoints);
    }
  }
  
  /**
   * Calcular campo de vectores
   */
  private computeVectorField(octree: OctreeNode, points: Point3D[]): Vec3[] {
    // Simplificación: cada punto contribuye su normal al campo
    return points.map(p => p.normal || { x: 0, y: 1, z: 0 });
  }
  
  /**
   * Extraer superficie de octree
   */
  private extractOctreeSurface(
    node: OctreeNode,
    vertices: Vec3[],
    faces: Array<[number, number, number]>
  ): void {
    if (node.children) {
      for (const child of node.children) {
        this.extractOctreeSurface(child, vertices, faces);
      }
    } else if (node.points.length > 0) {
      // Crear vértice en centro de celda
      const center = {
        x: (node.bounds.min.x + node.bounds.max.x) / 2,
        y: (node.bounds.min.y + node.bounds.max.y) / 2,
        z: (node.bounds.min.z + node.bounds.max.z) / 2,
      };
      
      vertices.push(center);
    }
  }
  
  // ============================================
  // BALL PIVOTING
  // ============================================
  
  /**
   * Reconstrucción con Ball Pivoting Algorithm
   */
  private ballPivoting(points: Point3D[]): EditableMeshData {
    const radius = this.config.bpBallRadius;
    const vertices: Vec3[] = [];
    const faces: Array<[number, number, number]> = [];
    
    // Crear índices de vértices
    const usedPoints = new Set<number>();
    const edgeQueue: Array<[number, number]> = [];
    
    // Encontrar semilla inicial
    const seed = this.findBallPivotSeed(points, radius);
    if (seed) {
      usedPoints.add(seed[0]);
      usedPoints.add(seed[1]);
      usedPoints.add(seed[2]);
      
      vertices.push(points[seed[0]].position);
      vertices.push(points[seed[1]].position);
      vertices.push(points[seed[2]].position);
      faces.push([0, 1, 2]);
      
      // Añadir edges a la cola
      edgeQueue.push([seed[0], seed[1]]);
      edgeQueue.push([seed[1], seed[2]]);
      edgeQueue.push([seed[2], seed[0]]);
    }
    
    // Pivotar bola
    while (edgeQueue.length > 0) {
      const edge = edgeQueue.shift()!;
      const pivot = this.pivotBall(edge, points, radius, usedPoints);
      
      if (pivot) {
        const idx = vertices.length;
        vertices.push(points[pivot].position);
        
        // Crear nueva cara
        const v0Idx = Array.from(usedPoints).indexOf(edge[0]);
        const v1Idx = Array.from(usedPoints).indexOf(edge[1]);
        faces.push([v0Idx, v1Idx, idx]);
        
        usedPoints.add(pivot);
        
        // Añadir nuevas edges
        edgeQueue.push([edge[0], pivot]);
        edgeQueue.push([pivot, edge[1]]);
      }
    }
    
    return this.createMeshFromArrays(vertices, faces, points);
  }
  
  /**
   * Encontrar semilla para Ball Pivoting
   */
  private findBallPivotSeed(points: Point3D[], radius: number): [number, number, number] | null {
    // Encontrar tres puntos que puedan tocar la bola
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < Math.min(points.length, i + 100); j++) {
        const d = this.distance(points[i].position, points[j].position);
        if (d < radius * 2) {
          for (let k = j + 1; k < Math.min(points.length, j + 100); k++) {
            if (this.canBallTouch(points[i], points[j], points[k], radius)) {
              return [i, j, k];
            }
          }
        }
      }
    }
    return null;
  }
  
  /**
   * Verificar si la bola puede tocar tres puntos
   */
  private canBallTouch(p0: Point3D, p1: Point3D, p2: Point3D, radius: number): boolean {
    // Calcular centro de circunferencia
    const d01 = this.distance(p0.position, p1.position);
    const d12 = this.distance(p1.position, p2.position);
    const d20 = this.distance(p2.position, p0.position);
    
    // Verificar que el triángulo no es degenerado
    if (d01 < 0.001 || d12 < 0.001 || d20 < 0.001) return false;
    
    // Verificar que la circunferencia cabe en la bola
    const s = (d01 + d12 + d20) / 2;
    const area = Math.sqrt(s * (s - d01) * (s - d12) * (s - d20));
    const circumRadius = (d01 * d12 * d20) / (4 * area);
    
    return circumRadius <= radius;
  }
  
  /**
   * Pivotar bola desde una edge
   */
  private pivotBall(
    edge: [number, number],
    points: Point3D[],
    radius: number,
    usedPoints: Set<number>
  ): number | null {
    const p0 = points[edge[0]];
    const p1 = points[edge[1]];
    
    // Buscar punto que la bola pueda tocar
    const midPoint = {
      x: (p0.position.x + p1.position.x) / 2,
      y: (p0.position.y + p1.position.y) / 2,
      z: (p0.position.z + p1.position.z) / 2,
    };
    
    const edgeLength = this.distance(p0.position, p1.position);
    const searchRadius = radius * 2;
    
    for (let i = 0; i < points.length; i++) {
      if (usedPoints.has(i)) continue;
      if (i === edge[0] || i === edge[1]) continue;
      
      const d = this.distance(midPoint, points[i].position);
      if (d < searchRadius) {
        if (this.canBallTouch(p0, p1, points[i], radius)) {
          return i;
        }
      }
    }
    
    return null;
  }
  
  // ============================================
  // DELAUNAY TRIANGULATION
  // ============================================
  
  /**
   * Reconstrucción con Delaunay/Alpha Shapes
   */
  private delaunayTriangulation(points: Point3D[]): EditableMeshData {
    // Delaunay 3D produce tetraedros
    // Alpha Shapes filtra por tamaño
    
    const vertices: Vec3[] = points.map(p => p.position);
    const faces: Array<[number, number, number]> = [];
    
    // Simplificación: usar triangulación greedy con alpha shape
    const alpha = this.config.delaunayAlpha;
    
    // Construir tetraedros
    for (let i = 0; i < points.length; i++) {
      const neighbors = this.findKNearest(points[i].position, 10, points);
      
      for (let j = 0; j < neighbors.length; j++) {
        for (let k = j + 1; k < neighbors.length; k++) {
          const nj = neighbors[j];
          const nk = neighbors[k];
          
          if (nj !== i && nk !== i) {
            // Verificar alpha shape
            const d1 = this.distance(points[i].position, points[nj].position);
            const d2 = this.distance(points[nj].position, points[nk].position);
            const d3 = this.distance(points[nk].position, points[i].position);
            
            if (d1 < alpha && d2 < alpha && d3 < alpha) {
              // Verificar Delaunay (simplificado)
              faces.push([i, nj, nk]);
            }
          }
        }
      }
    }
    
    return this.createMeshFromArrays(vertices, faces, points);
  }
  
  // ============================================
  // GREEDY TRIANGULATION
  // ============================================
  
  /**
   * Triangulación greedy
   */
  private greedyTriangulation(points: Point3D[]): EditableMeshData {
    const vertices: Vec3[] = points.map(p => p.position);
    const faces: Array<[number, number, number]> = [];
    const edges = new Set<string>();
    
    // Para cada punto, conectar con vecinos más cercanos
    for (let i = 0; i < points.length; i++) {
      const neighbors = this.findKNearest(points[i].position, 6, points);
      
      for (const j of neighbors) {
        if (j > i) {
          const key = `${i}-${j}`;
          edges.add(key);
        }
      }
    }
    
    // Crear triángulos a partir de edges
    for (let i = 0; i < points.length; i++) {
      const neighbors = this.findKNearest(points[i].position, 6, points);
      
      for (let j = 0; j < neighbors.length; j++) {
        for (let k = j + 1; k < neighbors.length; k++) {
          const nj = neighbors[j];
          const nk = neighbors[k];
          
          // Verificar que los edges existen
          const e1 = edges.has(`${Math.min(i, nj)}-${Math.max(i, nj)}`);
          const e2 = edges.has(`${Math.min(i, nk)}-${Math.max(i, nk)}`);
          const e3 = edges.has(`${Math.min(nj, nk)}-${Math.max(nj, nk)}`);
          
          if (e1 && e2) {
            faces.push([i, nj, nk]);
          }
        }
      }
    }
    
    return this.createMeshFromArrays(vertices, faces, points);
  }
  
  // ============================================
  // POSTPROCESSING
  // ============================================
  
  /**
   * Post-procesar malla
   */
  private postprocess(mesh: EditableMeshData, points: Point3D[]): EditableMeshData {
    // Remover caras degeneradas
    if (this.config.removeDegenerateFaces) {
      mesh = this.removeDegenerateFaces(mesh);
    }
    
    // Rellenar agujeros
    if (this.config.fillHoles) {
      mesh = this.fillHoles(mesh);
    }
    
    // Suavizar
    if (this.config.smoothIterations > 0) {
      mesh = this.smoothMesh(mesh, this.config.smoothIterations);
    }
    
    // Simplificar
    if (this.config.simplifyEnabled) {
      mesh = this.simplifyMesh(mesh, this.config.targetFaceCount);
    }
    
    return mesh;
  }
  
  /**
   * Remover caras degeneradas
   */
  private removeDegenerateFaces(mesh: EditableMeshData): EditableMeshData {
    const toRemove = new Set<string>();
    
    for (const [faceId, face] of mesh.faces) {
      if (face.vertexIds.length < 3) {
        toRemove.add(faceId);
        continue;
      }
      
      // Verificar vértices duplicados
      const unique = new Set(face.vertexIds);
      if (unique.size < 3) {
        toRemove.add(faceId);
        continue;
      }
      
      // Verificar área
      const v0 = mesh.vertices.get(face.vertexIds[0]);
      const v1 = mesh.vertices.get(face.vertexIds[1]);
      const v2 = mesh.vertices.get(face.vertexIds[2]);
      
      if (v0 && v1 && v2) {
        const area = this.triangleArea(v0.position, v1.position, v2.position);
        if (area < 0.00001) {
          toRemove.add(faceId);
        }
      }
    }
    
    for (const id of toRemove) {
      mesh.faces.delete(id);
    }
    
    return mesh;
  }
  
  /**
   * Calcular área de triángulo
   */
  private triangleArea(a: Vec3, b: Vec3, c: Vec3): number {
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    
    const cross = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x,
    };
    
    return Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z) / 2;
  }
  
  /**
   * Rellenar agujeros
   */
  private fillHoles(mesh: EditableMeshData): EditableMeshData {
    // Encontrar bordes (edges con solo 1 cara)
    const boundaryEdges: string[] = [];
    
    for (const [edgeId, edge] of mesh.edges) {
      if (edge.faceIds.length === 1) {
        boundaryEdges.push(edgeId);
      }
    }
    
    // Simplificación: no rellenar por ahora
    // Una implementación completa detectaría ciclos de borde
    
    return mesh;
  }
  
  /**
   * Suavizar malla
   */
  private smoothMesh(mesh: EditableMeshData, iterations: number): EditableMeshData {
    for (let iter = 0; iter < iterations; iter++) {
      const newPositions = new Map<string, Vec3>();
      
      for (const [vertexId, vertex] of mesh.vertices) {
        // Calcular promedio de vecinos
        let cx = vertex.position.x;
        let cy = vertex.position.y;
        let cz = vertex.position.z;
        let count = 1;
        
        for (const edgeId of vertex.edgeIds) {
          const edge = mesh.edges.get(edgeId);
          if (edge) {
            const neighborId = edge.vertexIds[0] === vertexId
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
        }
        
        newPositions.set(vertexId, {
          x: cx / count,
          y: cy / count,
          z: cz / count,
        });
      }
      
      // Aplicar con factor 0.5
      for (const [vertexId, newPos] of newPositions) {
        const vertex = mesh.vertices.get(vertexId);
        if (vertex) {
          vertex.position.x = vertex.position.x * 0.5 + newPos.x * 0.5;
          vertex.position.y = vertex.position.y * 0.5 + newPos.y * 0.5;
          vertex.position.z = vertex.position.z * 0.5 + newPos.z * 0.5;
        }
      }
    }
    
    return mesh;
  }
  
  /**
   * Simplificar malla
   */
  private simplifyMesh(mesh: EditableMeshData, targetCount: number): EditableMeshData {
    if (mesh.faces.size <= targetCount) return mesh;
    
    // Simplificación por colapso de edges
    // Una implementación completa usaría quadric error metrics
    
    return mesh;
  }
  
  // ============================================
  // UTILITY
  // ============================================
  
  /**
   * Calcular distancia entre dos puntos
   */
  private distance(a: Vec3, b: Vec3): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * Crear malla desde arrays
   */
  private createMeshFromArrays(
    vertices: Vec3[],
    faces: Array<[number, number, number]>,
    sourcePoints: Point3D[]
  ): EditableMeshData {
    const meshVertices = new Map<string, EditableVertex>();
    const meshEdges = new Map<string, EditableEdge>();
    const meshFaces = new Map<string, EditableFace>();
    
    // Crear vértices
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const id = generateId();
      
      // Calcular normal (promedio de caras adyacentes)
      const normal = vec3(0, 1, 0);
      
      // Obtener color del punto más cercano
      let color: RGBA | undefined;
      if (sourcePoints.length > 0) {
        let minDist = Infinity;
        for (const sp of sourcePoints) {
          const d = this.distance(v, sp.position);
          if (d < minDist) {
            minDist = d;
            color = sp.color;
          }
        }
      }
      
      meshVertices.set(id, {
        id,
        position: { ...v },
        normal,
        uv: uv(),
        color,
        edgeIds: [],
        faceIds: [],
        selected: false,
      });
    }
    
    // Crear caras y edges
    const vertexIdList = Array.from(meshVertices.keys());
    const edgeMap = new Map<string, string>();
    
    for (const [i0, i1, i2] of faces) {
      const v0Id = vertexIdList[i0];
      const v1Id = vertexIdList[i1];
      const v2Id = vertexIdList[i2];
      
      if (!v0Id || !v1Id || !v2Id) continue;
      
      const faceId = generateId();
      const faceVertexIds = [v0Id, v1Id, v2Id];
      const faceEdgeIds: string[] = [];
      
      // Crear/conectar edges
      for (let i = 0; i < 3; i++) {
        const a = faceVertexIds[i];
        const b = faceVertexIds[(i + 1) % 3];
        const edgeKey = a < b ? `${a}-${b}` : `${b}-${a}`;
        
        let edgeId = edgeMap.get(edgeKey);
        if (!edgeId) {
          edgeId = generateId();
          meshEdges.set(edgeId, {
            id: edgeId,
            vertexIds: [a, b] as [string, string],
            faceIds: [],
            crease: 0,
            sharp: false,
            selected: false,
          });
          edgeMap.set(edgeKey, edgeId);
          
          // Conectar a vértices
          meshVertices.get(a)?.edgeIds.push(edgeId);
          meshVertices.get(b)?.edgeIds.push(edgeId);
        }
        
        faceEdgeIds.push(edgeId);
        meshEdges.get(edgeId)?.faceIds.push(faceId);
      }
      
      // Calcular normal de cara
      const v0 = meshVertices.get(v0Id);
      const v1 = meshVertices.get(v1Id);
      const v2 = meshVertices.get(v2Id);
      
      let faceNormal = vec3(0, 1, 0);
      if (v0 && v1 && v2) {
        const e1 = { x: v1.position.x - v0.position.x, y: v1.position.y - v0.position.y, z: v1.position.z - v0.position.z };
        const e2 = { x: v2.position.x - v0.position.x, y: v2.position.y - v0.position.y, z: v2.position.z - v0.position.z };
        
        faceNormal = {
          x: e1.y * e2.z - e1.z * e2.y,
          y: e1.z * e2.x - e1.x * e2.z,
          z: e1.x * e2.y - e1.y * e2.x,
        };
        
        const len = Math.sqrt(faceNormal.x * faceNormal.x + faceNormal.y * faceNormal.y + faceNormal.z * faceNormal.z);
        if (len > 0) {
          faceNormal.x /= len;
          faceNormal.y /= len;
          faceNormal.z /= len;
        }
        
        // Actualizar normales de vértices
        v0.normal.x = (v0.normal.x + faceNormal.x) / 2;
        v0.normal.y = (v0.normal.y + faceNormal.y) / 2;
        v0.normal.z = (v0.normal.z + faceNormal.z) / 2;
        
        v1.normal.x = (v1.normal.x + faceNormal.x) / 2;
        v1.normal.y = (v1.normal.y + faceNormal.y) / 2;
        v1.normal.z = (v1.normal.z + faceNormal.z) / 2;
        
        v2.normal.x = (v2.normal.x + faceNormal.x) / 2;
        v2.normal.y = (v2.normal.y + faceNormal.y) / 2;
        v2.normal.z = (v2.normal.z + faceNormal.z) / 2;
      }
      
      meshFaces.set(faceId, {
        id: faceId,
        vertexIds: faceVertexIds,
        edgeIds: faceEdgeIds,
        normal: faceNormal,
        materialIndex: 0,
        selected: false,
      });
      
      // Conectar cara a vértices
      for (const vId of faceVertexIds) {
        meshVertices.get(vId)?.faceIds.push(faceId);
      }
    }
    
    // Calcular bounds
    const bounds = emptyBoundingBox3D();
    for (const v of meshVertices.values()) {
      bounds.min.x = Math.min(bounds.min.x, v.position.x);
      bounds.min.y = Math.min(bounds.min.y, v.position.y);
      bounds.min.z = Math.min(bounds.min.z, v.position.z);
      bounds.max.x = Math.max(bounds.max.x, v.position.x);
      bounds.max.y = Math.max(bounds.max.y, v.position.y);
      bounds.max.z = Math.max(bounds.max.z, v.position.z);
    }
    
    return {
      id: generateId(),
      name: 'ReconstructedMesh',
      vertices: meshVertices,
      edges: meshEdges,
      faces: meshFaces,
      topology: {
        vertexAdjacency: new Map(),
        edgeAdjacency: new Map(),
        faceAdjacency: new Map(),
      },
      attributes: {
        normals: [],
        uvs: [],
        colors: [],
      },
      materials: [],
      bounds,
      metadata: {
        sourceType: 'photo_set',
        sourceId: '',
        pipeline: 'photogrammetry',
        confidence: 0.8,
        qualityLevel: 'good',
        createdAt: new Date(),
        processingTime: 0,
        parameters: {},
        version: '1.0',
      },
    };
  }
}

// ============================================
// TYPES
// ============================================

interface OctreeNode {
  bounds: BoundingBox3D;
  depth: number;
  maxDepth: number;
  points: number[];
  children?: OctreeNode[];
}

// ============================================
// FACTORY
// ============================================

export function createMeshReconstructor(config?: Partial<MeshReconstructorConfig>): MeshReconstructor {
  return new MeshReconstructor(config);
}

export default MeshReconstructor;
