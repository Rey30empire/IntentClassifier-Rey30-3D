/**
 * NEXUS Engine - Brush Engine Core
 * 
 * Core brush engine with falloff calculations, spatial queries,
 * and brush application system
 */

import {
  Vec3,
  BrushSettings,
  BrushMesh,
  BrushVertex,
  BrushResult,
  FalloffCurve,
  FalloffType,
  SymmetrySettings,
  SymmetryAxis,
  MeshQualityMetrics,
  generateId,
  vec3,
  addVec3,
  subVec3,
  mulVec3,
  divVec3,
  dotVec3,
  crossVec3,
  lengthVec3,
  normalizeVec3,
  distanceVec3,
  mirrorPoint,
} from './types';

// ============================================
// FALLOFF CALCULATOR
// ============================================

/**
 * Calculates falloff values based on curve type
 */
export class FalloffCalculator {
  private curve: FalloffCurve;
  private lut: Float32Array;
  private lutSize = 256;

  constructor(curve: FalloffCurve) {
    this.curve = curve;
    this.lut = new Float32Array(this.lutSize);
    this.buildLUT();
  }

  /**
   * Build lookup table for fast falloff evaluation
   */
  private buildLUT(): void {
    for (let i = 0; i < this.lutSize; i++) {
      const t = i / (this.lutSize - 1);
      this.lut[i] = this.calculateRaw(t);
    }
  }

  /**
   * Calculate raw falloff value
   */
  private calculateRaw(t: number): number {
    const clampedT = Math.max(0, Math.min(1, t));

    switch (this.curve.type) {
      case 'constant':
        return 1.0;

      case 'linear':
        return 1.0 - clampedT;

      case 'smooth':
        // Smoothstep: 3t² - 2t³
        return 1.0 - (clampedT * clampedT * (3.0 - 2.0 * clampedT));

      case 'sphere':
        // Spherical falloff: sqrt(1 - t²)
        return Math.sqrt(Math.max(0, 1.0 - clampedT * clampedT));

      case 'root':
        // Square root falloff
        return Math.sqrt(1.0 - clampedT);

      case 'sharp':
        // Sharp falloff - drops quickly
        return Math.pow(1.0 - clampedT, 2);

      case 'linear_square':
        // Linear squared
        const linear = 1.0 - clampedT;
        return linear * linear;

      case 'custom':
        return this.evaluateCustomCurve(clampedT);

      default:
        return 1.0 - clampedT;
    }
  }

  /**
   * Evaluate custom curve from points
   */
  private evaluateCustomCurve(t: number): number {
    const points = this.curve.points;
    if (points.length === 0) return 1.0 - t;

    // Sort points by position
    const sorted = [...points].sort((a, b) => a.position - b.position);

    // Find surrounding points
    let lower = sorted[0];
    let upper = sorted[sorted.length - 1];

    for (let i = 0; i < sorted.length - 1; i++) {
      if (t >= sorted[i].position && t <= sorted[i + 1].position) {
        lower = sorted[i];
        upper = sorted[i + 1];
        break;
      }
    }

    // Interpolate
    const range = upper.position - lower.position;
    if (range === 0) return lower.value;

    const localT = (t - lower.position) / range;
    const smoothT = localT * localT * (3.0 - 2.0 * localT);

    return lower.value + (upper.value - lower.value) * smoothT;
  }

  /**
   * Get falloff value from lookup table
   */
  getValue(t: number): number {
    const clampedT = Math.max(0, Math.min(1, t));
    const index = Math.floor(clampedT * (this.lutSize - 1));
    return this.lut[index];
  }

  /**
   * Get derivative of falloff (for smooth transitions)
   */
  getDerivative(t: number): number {
    const delta = 1.0 / this.lutSize;
    const t0 = Math.max(0, t - delta);
    const t1 = Math.min(1, t + delta);
    return (this.getValue(t1) - this.getValue(t0)) / (2 * delta);
  }

  /**
   * Update curve and rebuild LUT
   */
  updateCurve(curve: FalloffCurve): void {
    this.curve = curve;
    this.buildLUT();
  }
}

// ============================================
// SPATIAL QUERY SYSTEM
// ============================================

/**
 * Spatial acceleration structure for brush queries
 */
export class SpatialAccelerator {
  private mesh: BrushMesh;
  private cellSize: number;
  private grid: Map<string, string[]> = new Map();
  private bounds: { min: Vec3; max: Vec3 };

  constructor(mesh: BrushMesh, cellSize = 1.0) {
    this.mesh = mesh;
    this.cellSize = cellSize;
    this.bounds = mesh.bounds;
    this.buildGrid();
  }

  /**
   * Build spatial grid
   */
  private buildGrid(): void {
    this.grid.clear();

    for (const [vertexId, vertex] of this.mesh.vertices) {
      const cellKey = this.getCellKey(vertex.position);
      if (!this.grid.has(cellKey)) {
        this.grid.set(cellKey, []);
      }
      this.grid.get(cellKey)!.push(vertexId);
    }
  }

  /**
   * Get cell key from position
   */
  private getCellKey(position: Vec3): string {
    const x = Math.floor((position.x - this.bounds.min.x) / this.cellSize);
    const y = Math.floor((position.y - this.bounds.min.y) / this.cellSize);
    const z = Math.floor((position.z - this.bounds.min.z) / this.cellSize);
    return `${x},${y},${z}`;
  }

  /**
   * Get cell indices from position
   */
  private getCellIndices(position: Vec3): [number, number, number] {
    return [
      Math.floor((position.x - this.bounds.min.x) / this.cellSize),
      Math.floor((position.y - this.bounds.min.y) / this.cellSize),
      Math.floor((position.z - this.bounds.min.z) / this.cellSize),
    ];
  }

  /**
   * Query vertices within sphere
   */
  querySphere(center: Vec3, radius: number): string[] {
    const results: string[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const [cx, cy, cz] = this.getCellIndices(center);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
          const cellKey = `${cx + dx},${cy + dy},${cz + dz}`;
          const cellVertices = this.grid.get(cellKey);
          if (cellVertices) {
            for (const vertexId of cellVertices) {
              const vertex = this.mesh.vertices.get(vertexId);
              if (vertex && distanceVec3(vertex.position, center) <= radius) {
                results.push(vertexId);
              }
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Update grid when vertices move
   */
  updateVertex(vertexId: string, oldPosition: Vec3, newPosition: Vec3): void {
    const oldKey = this.getCellKey(oldPosition);
    const newKey = this.getCellKey(newPosition);

    if (oldKey !== newKey) {
      // Remove from old cell
      const oldCell = this.grid.get(oldKey);
      if (oldCell) {
        const index = oldCell.indexOf(vertexId);
        if (index > -1) oldCell.splice(index, 1);
      }

      // Add to new cell
      if (!this.grid.has(newKey)) {
        this.grid.set(newKey, []);
      }
      this.grid.get(newKey)!.push(vertexId);
    }
  }

  /**
   * Rebuild entire grid
   */
  rebuild(): void {
    this.buildGrid();
  }
}

// ============================================
// SYMMETRY SYSTEM
// ============================================

/**
 * Handles symmetry calculations for brush operations
 */
export class SymmetrySystem {
  private settings: SymmetrySettings;

  constructor(settings: SymmetrySettings) {
    this.settings = settings;
  }

  /**
   * Check if symmetry is enabled
   */
  isEnabled(): boolean {
    return this.settings.enabled;
  }

  /**
   * Get symmetric positions for a point
   */
  getSymmetricPositions(position: Vec3): Vec3[] {
    if (!this.settings.enabled) {
      return [position];
    }

    const positions: Vec3[] = [position];

    switch (this.settings.mode) {
      case 'mirror':
        for (const axis of this.settings.axes) {
          const mirrored = mirrorPoint(position, axis);
          positions.push(mirrored);
        }
        break;

      case 'radial':
        const count = this.settings.radialCount;
        const angleStep = (2 * Math.PI) / count;
        for (let i = 1; i < count; i++) {
          const angle = angleStep * i;
          const rotated = this.rotateAroundAxis(position, 'y', angle);
          positions.push(rotated);
        }
        break;
    }

    return positions;
  }

  /**
   * Rotate point around axis
   */
  private rotateAroundAxis(point: Vec3, axis: SymmetryAxis, angle: number): Vec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    switch (axis) {
      case 'x':
        return {
          x: point.x,
          y: point.y * cos - point.z * sin,
          z: point.y * sin + point.z * cos,
        };
      case 'y':
        return {
          x: point.x * cos + point.z * sin,
          y: point.y,
          z: -point.x * sin + point.z * cos,
        };
      case 'z':
        return {
          x: point.x * cos - point.y * sin,
          y: point.x * sin + point.y * cos,
          z: point.z,
        };
    }
  }

  /**
   * Find symmetric vertex in mesh
   */
  findSymmetricVertex(vertex: BrushVertex, mesh: BrushMesh): string | null {
    if (!this.settings.enabled) return null;

    for (const axis of this.settings.axes) {
      const mirroredPos = mirrorPoint(vertex.position, axis);
      
      // Find closest vertex to mirrored position
      let closestId: string | null = null;
      let closestDist = this.settings.tolerance;

      for (const [candidateId, candidate] of mesh.vertices) {
        if (candidateId === vertex.id) continue;
        const dist = distanceVec3(candidate.position, mirroredPos);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = candidateId;
        }
      }

      if (closestId) return closestId;
    }

    return null;
  }

  /**
   * Update symmetry settings
   */
  updateSettings(settings: SymmetrySettings): void {
    this.settings = settings;
  }
}

// ============================================
// BRUSH ENGINE
// ============================================

/**
 * Main brush engine that coordinates all brush operations
 */
export class BrushEngine {
  private mesh: BrushMesh | null = null;
  private spatial: SpatialAccelerator | null = null;
  private falloff: FalloffCalculator;
  private symmetry: SymmetrySystem;
  private settings: BrushSettings;
  private history: Vec3[][] = [];

  constructor(settings: BrushSettings) {
    this.settings = settings;
    this.falloff = new FalloffCalculator(settings.falloff);
    this.symmetry = new SymmetrySystem(settings.symmetry);
  }

  /**
   * Set the mesh to operate on
   */
  setMesh(mesh: BrushMesh): void {
    this.mesh = mesh;
    const cellSize = settings.size * 2;
    this.spatial = new SpatialAccelerator(mesh, cellSize);
  }

  /**
   * Get vertices affected by brush at position
   */
  getAffectedVertices(center: Vec3): Map<string, number> {
    const affected = new Map<string, number>();

    if (!this.mesh || !this.spatial) return affected;

    // Get vertices in sphere
    const verticesInSphere = this.spatial.querySphere(center, this.settings.size);

    for (const vertexId of verticesInSphere) {
      const vertex = this.mesh.vertices.get(vertexId);
      if (!vertex) continue;

      // Check mask
      if (this.settings.constraints.respectMask && vertex.mask > 0) {
        const maskFactor = 1.0 - (vertex.mask * this.settings.constraints.maskStrength);
        if (maskFactor <= 0) continue;
      }

      // Calculate falloff
      const dist = distanceVec3(vertex.position, center);
      const normalizedDist = dist / this.settings.size;

      // Apply inner radius
      let falloffValue: number;
      if (normalizedDist < this.settings.innerRadius) {
        falloffValue = 1.0;
      } else {
        const adjustedT = (normalizedDist - this.settings.innerRadius) / 
                         (1.0 - this.settings.innerRadius);
        falloffValue = this.falloff.getValue(adjustedT);
      }

      if (falloffValue > 0) {
        affected.set(vertexId, falloffValue);
      }
    }

    return affected;
  }

  /**
   * Apply brush operation with symmetry
   */
  applyBrush(center: Vec3, normal: Vec3, operation: BrushOperation): BrushResult {
    const result = this.createEmptyResult();

    if (!this.mesh) return result;

    // Get all brush positions including symmetric ones
    const brushPositions = this.symmetry.getSymmetricPositions(center);

    for (const position of brushPositions) {
      const affected = this.getAffectedVertices(position);
      
      for (const [vertexId, falloff] of affected) {
        const vertex = this.mesh!.vertices.get(vertexId);
        if (!vertex) continue;

        // Calculate operation delta
        const delta = operation.calculate(
          vertex,
          position,
          normal,
          falloff * this.settings.strength * this.settings.pressure,
          this.settings
        );

        if (delta) {
          const currentDelta = result.vertexDeltas.get(vertexId) || vec3(0, 0, 0);
          result.vertexDeltas.set(vertexId, addVec3(currentDelta, delta));
          
          if (!result.affectedVertices.includes(vertexId)) {
            result.affectedVertices.push(vertexId);
          }
        }
      }
    }

    // Apply deltas to mesh
    this.applyDeltas(result.vertexDeltas);

    // Update quality metrics
    result.meshQuality = this.calculateQualityMetrics();
    result.success = result.affectedVertices.length > 0;

    return result;
  }

  /**
   * Apply vertex deltas to mesh
   */
  private applyDeltas(deltas: Map<string, Vec3>): void {
    if (!this.mesh || !this.spatial) return;

    for (const [vertexId, delta] of deltas) {
      const vertex = this.mesh.vertices.get(vertexId);
      if (!vertex) continue;

      const oldPosition = { ...vertex.position };
      vertex.position = addVec3(vertex.position, delta);

      // Update spatial accelerator
      this.spatial.updateVertex(vertexId, oldPosition, vertex.position);
    }

    // Recalculate normals for affected vertices
    this.recalculateNormals(deltas);
  }

  /**
   * Recalculate normals for affected vertices
   */
  private recalculateNormals(deltas: Map<string, Vec3>): void {
    if (!this.mesh) return;

    const processed = new Set<string>();

    for (const vertexId of deltas.keys()) {
      const vertex = this.mesh!.vertices.get(vertexId);
      if (!vertex || processed.has(vertexId)) continue;

      // Get all adjacent faces
      const faceNormals: Vec3[] = [];
      for (const faceId of vertex.adjacentFaces) {
        const face = this.mesh!.faces.get(faceId);
        if (face) {
          const normal = this.calculateFaceNormal(face);
          faceNormals.push(normal);
        }
      }

      // Average face normals
      if (faceNormals.length > 0) {
        const averaged = faceNormals.reduce(
          (acc, n) => addVec3(acc, n),
          vec3(0, 0, 0)
        );
        vertex.normal = normalizeVec3(averaged);
      }

      processed.add(vertexId);
    }
  }

  /**
   * Calculate face normal
   */
  private calculateFaceNormal(face: { vertexIds: string[] }): Vec3 {
    if (!this.mesh || face.vertexIds.length < 3) {
      return vec3(0, 1, 0);
    }

    const v0 = this.mesh.vertices.get(face.vertexIds[0]);
    const v1 = this.mesh.vertices.get(face.vertexIds[1]);
    const v2 = this.mesh.vertices.get(face.vertexIds[2]);

    if (!v0 || !v1 || !v2) return vec3(0, 1, 0);

    const edge1 = subVec3(v1.position, v0.position);
    const edge2 = subVec3(v2.position, v0.position);

    return normalizeVec3(crossVec3(edge1, edge2));
  }

  /**
   * Calculate mesh quality metrics
   */
  private calculateQualityMetrics(): MeshQualityMetrics {
    const metrics: MeshQualityMetrics = {
      averageEdgeLength: 0,
      edgeLengthVariance: 0,
      averageFaceArea: 0,
      triangleCount: 0,
      quadCount: 0,
      ngonCount: 0,
      nonManifoldEdges: 0,
      flippedNormals: 0,
      degenerateFaces: 0,
    };

    if (!this.mesh) return metrics;

    // Calculate edge metrics
    const edgeLengths: number[] = [];
    for (const edge of this.mesh.edges.values()) {
      const v0 = this.mesh.vertices.get(edge.vertexIds[0]);
      const v1 = this.mesh.vertices.get(edge.vertexIds[1]);
      if (v0 && v1) {
        edgeLengths.push(distanceVec3(v0.position, v1.position));
      }

      // Check for non-manifold edges
      if (edge.crease > 0 && edge.crease !== 1) {
        metrics.nonManifoldEdges++;
      }
    }

    if (edgeLengths.length > 0) {
      metrics.averageEdgeLength = edgeLengths.reduce((a, b) => a + b, 0) / edgeLengths.length;
      const variance = edgeLengths.reduce((sum, l) => sum + Math.pow(l - metrics.averageEdgeLength, 2), 0);
      metrics.edgeLengthVariance = variance / edgeLengths.length;
    }

    // Count face types
    const faceAreas: number[] = [];
    for (const face of this.mesh.faces.values()) {
      if (face.vertexIds.length === 3) {
        metrics.triangleCount++;
      } else if (face.vertexIds.length === 4) {
        metrics.quadCount++;
      } else {
        metrics.ngonCount++;
      }

      // Calculate face area
      const area = this.calculateFaceArea(face);
      faceAreas.push(area);
    }

    if (faceAreas.length > 0) {
      metrics.averageFaceArea = faceAreas.reduce((a, b) => a + b, 0) / faceAreas.length;
    }

    return metrics;
  }

  /**
   * Calculate face area
   */
  private calculateFaceArea(face: { vertexIds: string[] }): number {
    if (!this.mesh || face.vertexIds.length < 3) return 0;

    let totalArea = 0;

    // Triangulate and sum areas
    for (let i = 1; i < face.vertexIds.length - 1; i++) {
      const v0 = this.mesh!.vertices.get(face.vertexIds[0]);
      const v1 = this.mesh!.vertices.get(face.vertexIds[i]);
      const v2 = this.mesh!.vertices.get(face.vertexIds[i + 1]);

      if (v0 && v1 && v2) {
        const edge1 = subVec3(v1.position, v0.position);
        const edge2 = subVec3(v2.position, v0.position);
        const cross = crossVec3(edge1, edge2);
        totalArea += lengthVec3(cross) * 0.5;
      }
    }

    return totalArea;
  }

  /**
   * Create empty result
   */
  private createEmptyResult(): BrushResult {
    return {
      success: false,
      affectedVertices: [],
      affectedEdges: [],
      affectedFaces: [],
      vertexDeltas: new Map(),
      newVertices: [],
      newEdges: [],
      newFaces: [],
      removedVertexIds: [],
      removedEdgeIds: [],
      removedFaceIds: [],
      meshQuality: {
        averageEdgeLength: 0,
        edgeLengthVariance: 0,
        averageFaceArea: 0,
        triangleCount: 0,
        quadCount: 0,
        ngonCount: 0,
        nonManifoldEdges: 0,
        flippedNormals: 0,
        degenerateFaces: 0,
      },
    };
  }

  /**
   * Update brush settings
   */
  updateSettings(settings: BrushSettings): void {
    this.settings = settings;
    this.falloff.updateCurve(settings.falloff);
    this.symmetry.updateSettings(settings.symmetry);
  }

  /**
   * Get current settings
   */
  getSettings(): BrushSettings {
    return this.settings;
  }

  /**
   * Store state for undo
   */
  pushState(): void {
    if (!this.mesh) return;

    const state: Vec3[] = [];
    for (const vertex of this.mesh.vertices.values()) {
      state.push(vertex.position);
    }
    this.history.push(state);

    // Limit history size
    if (this.history.length > 50) {
      this.history.shift();
    }
  }

  /**
   * Restore previous state (undo)
   */
  popState(): boolean {
    if (this.history.length === 0 || !this.mesh) return false;

    const state = this.history.pop();
    if (!state) return false;

    const vertices = Array.from(this.mesh.vertices.values());
    for (let i = 0; i < vertices.length && i < state.length; i++) {
      vertices[i].position = state[i];
    }

    if (this.spatial) {
      this.spatial.rebuild();
    }

    return true;
  }
}

// ============================================
// BRUSH OPERATION INTERFACE
// ============================================

/**
 * Interface for brush operations
 */
export interface BrushOperation {
  calculate(
    vertex: BrushVertex,
    center: Vec3,
    normal: Vec3,
    strength: number,
    settings: BrushSettings
  ): Vec3 | null;
}

// Import settings reference
const settings = { size: 1.0 };
