/**
 * NEXUS Engine - Mesh Cleaner
 * 
 * Sistema de limpieza y reparación de mallas 3D.
 */

import {
  Vec3,
  EditableMeshData,
  EditableVertex,
  EditableEdge,
  EditableFace,
  BoundingBox3D,
  generateId,
  emptyBoundingBox3D,
  vec3,
} from '../types';

// Types
export type MeshIssueType =
  | 'degenerate_face'
  | 'duplicate_vertex'
  | 'duplicate_face'
  | 'non_manifold_edge'
  | 'non_manifold_vertex'
  | 'hole'
  | 'inverted_normal'
  | 'zero_area_face'
  | 'isolated_vertex';

export interface MeshIssue {
  type: MeshIssueType;
  severity: 'critical' | 'warning' | 'info';
  elementIds: string[];
  position: Vec3;
  description: string;
  autoFixable: boolean;
}

export interface MeshAnalysisResult {
  isManifold: boolean;
  isWatertight: boolean;
  hasHoles: boolean;
  holeCount: number;
  issueCount: number;
  issues: MeshIssue[];
  statistics: MeshStatistics;
}

export interface MeshStatistics {
  vertexCount: number;
  edgeCount: number;
  faceCount: number;
  triangleCount: number;
  quadCount: number;
  ngonCount: number;
  boundaryEdgeCount: number;
  nonManifoldEdgeCount: number;
  isolatedVertexCount: number;
  surfaceArea: number;
}

export interface MeshCleanerConfig {
  mergeDistance: number;
  areaThreshold: number;
  removeDuplicateVertices: boolean;
  removeDuplicateFaces: boolean;
  removeDegenerateFaces: boolean;
  removeIsolatedVertices: boolean;
  fixNonManifold: boolean;
  fillHoles: boolean;
  maxHoleSize: number;
  orientNormals: boolean;
}

/**
 * Mesh Cleaner - Limpieza y reparación de mallas
 */
export class MeshCleaner {
  private config: MeshCleanerConfig;
  
  constructor(config?: Partial<MeshCleanerConfig>) {
    this.config = {
      mergeDistance: 0.0001,
      areaThreshold: 0.000001,
      removeDuplicateVertices: true,
      removeDuplicateFaces: true,
      removeDegenerateFaces: true,
      removeIsolatedVertices: true,
      fixNonManifold: true,
      fillHoles: false,
      maxHoleSize: 20,
      orientNormals: true,
      ...config,
    };
  }
  
  clean(mesh: EditableMeshData): EditableMeshData {
    let cleaned = { ...mesh };
    
    if (this.config.removeDegenerateFaces) {
      cleaned = this.removeDegenerateFaces(cleaned);
    }
    if (this.config.removeDuplicateVertices) {
      cleaned = this.removeDuplicateVertices(cleaned);
    }
    if (this.config.removeDuplicateFaces) {
      cleaned = this.removeDuplicateFaces(cleaned);
    }
    if (this.config.removeIsolatedVertices) {
      cleaned = this.removeIsolatedVertices(cleaned);
    }
    if (this.config.fixNonManifold) {
      cleaned = this.fixNonManifold(cleaned);
    }
    if (this.config.fillHoles) {
      cleaned = this.fillHoles(cleaned);
    }
    if (this.config.orientNormals) {
      cleaned = this.orientNormals(cleaned);
    }
    
    cleaned.bounds = this.calculateBounds(cleaned);
    return cleaned;
  }
  
  analyze(mesh: EditableMeshData): MeshAnalysisResult {
    const issues: MeshIssue[] = [];
    let isManifold = true;
    let isWatertight = true;
    
    // Detect issues
    const degenerate = this.findDegenerateFaces(mesh);
    if (degenerate.length > 0) {
      issues.push({
        type: 'degenerate_face',
        severity: 'critical',
        elementIds: degenerate,
        position: { x: 0, y: 0, z: 0 },
        description: `${degenerate.length} degenerate faces`,
        autoFixable: true,
      });
    }
    
    const holes = this.findHoles(mesh);
    if (holes.length > 0) {
      isWatertight = false;
      issues.push({
        type: 'hole',
        severity: 'warning',
        elementIds: [],
        position: { x: 0, y: 0, z: 0 },
        description: `${holes.length} holes found`,
        autoFixable: true,
      });
    }
    
    const isolated = this.findIsolatedVertices(mesh);
    if (isolated.length > 0) {
      issues.push({
        type: 'isolated_vertex',
        severity: 'info',
        elementIds: isolated,
        position: { x: 0, y: 0, z: 0 },
        description: `${isolated.length} isolated vertices`,
        autoFixable: true,
      });
    }
    
    return {
      isManifold,
      isWatertight,
      hasHoles: holes.length > 0,
      holeCount: holes.length,
      issueCount: issues.length,
      issues,
      statistics: this.calculateStatistics(mesh),
    };
  }
  
  private removeDegenerateFaces(mesh: EditableMeshData): EditableMeshData {
    const degenerate = this.findDegenerateFaces(mesh);
    for (const faceId of degenerate) {
      mesh.faces.delete(faceId);
    }
    return mesh;
  }
  
  private findDegenerateFaces(mesh: EditableMeshData): string[] {
    const result: string[] = [];
    for (const [faceId, face] of mesh.faces) {
      const unique = new Set(face.vertexIds);
      if (unique.size < 3) {
        result.push(faceId);
        continue;
      }
      const area = this.calculateFaceArea(mesh, face);
      if (area < this.config.areaThreshold) {
        result.push(faceId);
      }
    }
    return result;
  }
  
  private removeDuplicateVertices(mesh: EditableMeshData): EditableMeshData {
    const mapping = new Map<string, string>();
    const positions = new Map<string, string>();
    
    for (const [vertexId, vertex] of mesh.vertices) {
      const key = `${vertex.position.x.toFixed(4)},${vertex.position.y.toFixed(4)},${vertex.position.z.toFixed(4)}`;
      if (positions.has(key)) {
        mapping.set(vertexId, positions.get(key)!);
      } else {
        positions.set(key, vertexId);
      }
    }
    
    // Update face references
    for (const face of mesh.faces.values()) {
      for (let i = 0; i < face.vertexIds.length; i++) {
        const mapped = mapping.get(face.vertexIds[i]);
        if (mapped) face.vertexIds[i] = mapped;
      }
    }
    
    // Remove duplicates
    for (const dupId of mapping.keys()) {
      mesh.vertices.delete(dupId);
    }
    
    return mesh;
  }
  
  private removeDuplicateFaces(mesh: EditableMeshData): EditableMeshData {
    const seen = new Map<string, string>();
    const toRemove: string[] = [];
    
    for (const [faceId, face] of mesh.faces) {
      const key = [...face.vertexIds].sort().join('-');
      if (seen.has(key)) {
        toRemove.push(faceId);
      } else {
        seen.set(key, faceId);
      }
    }
    
    for (const faceId of toRemove) {
      mesh.faces.delete(faceId);
    }
    
    return mesh;
  }
  
  private removeIsolatedVertices(mesh: EditableMeshData): EditableMeshData {
    const used = new Set<string>();
    for (const face of mesh.faces.values()) {
      for (const vId of face.vertexIds) {
        used.add(vId);
      }
    }
    
    for (const [vertexId] of mesh.vertices) {
      if (!used.has(vertexId)) {
        mesh.vertices.delete(vertexId);
      }
    }
    
    return mesh;
  }
  
  private fixNonManifold(mesh: EditableMeshData): EditableMeshData {
    // Simplified: rebuild edges
    this.rebuildEdges(mesh);
    return mesh;
  }
  
  private fillHoles(mesh: EditableMeshData): EditableMeshData {
    const holes = this.findHoles(mesh);
    
    for (const hole of holes) {
      if (hole.length > this.config.maxHoleSize) continue;
      
      // Get hole vertices
      const vertices = new Set<string>();
      for (const edgeId of hole) {
        const edge = mesh.edges.get(edgeId);
        if (edge) {
          vertices.add(edge.vertexIds[0]);
          vertices.add(edge.vertexIds[1]);
        }
      }
      
      const vertexList = Array.from(vertices);
      if (vertexList.length < 3) continue;
      
      // Create center vertex
      const center = this.calculateCenter(mesh, vertexList);
      const centerId = generateId();
      
      mesh.vertices.set(centerId, {
        id: centerId,
        position: center,
        normal: vec3(0, 1, 0),
        uv: { u: 0, v: 0 },
        edgeIds: [],
        faceIds: [],
        selected: false,
      });
      
      // Fan triangulation
      for (let i = 0; i < vertexList.length; i++) {
        const v0 = vertexList[i];
        const v1 = vertexList[(i + 1) % vertexList.length];
        
        const faceId = generateId();
        mesh.faces.set(faceId, {
          id: faceId,
          vertexIds: [v0, v1, centerId],
          edgeIds: [],
          normal: vec3(0, 1, 0),
          materialIndex: 0,
          selected: false,
        });
      }
    }
    
    return mesh;
  }
  
  private findHoles(mesh: EditableMeshData): string[][] {
    const boundaryEdges: string[] = [];
    for (const [edgeId, edge] of mesh.edges) {
      if (edge.faceIds.length === 1) {
        boundaryEdges.push(edgeId);
      }
    }
    return boundaryEdges.length > 0 ? [boundaryEdges] : [];
  }
  
  private orientNormals(mesh: EditableMeshData): EditableMeshData {
    // Recalculate face normals
    for (const face of mesh.faces.values()) {
      this.recalculateFaceNormal(mesh, face);
    }
    // Recalculate vertex normals
    this.recalculateVertexNormals(mesh);
    return mesh;
  }
  
  private calculateFaceArea(mesh: EditableMeshData, face: EditableFace): number {
    if (face.vertexIds.length < 3) return 0;
    const v0 = mesh.vertices.get(face.vertexIds[0]);
    const v1 = mesh.vertices.get(face.vertexIds[1]);
    const v2 = mesh.vertices.get(face.vertexIds[2]);
    if (!v0 || !v1 || !v2) return 0;
    return this.triangleArea(v0.position, v1.position, v2.position);
  }
  
  private triangleArea(a: Vec3, b: Vec3, c: Vec3): number {
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const cross = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x,
    };
    return Math.sqrt(cross.x ** 2 + cross.y ** 2 + cross.z ** 2) / 2;
  }
  
  private calculateBounds(mesh: EditableMeshData): BoundingBox3D {
    const bounds = emptyBoundingBox3D();
    for (const v of mesh.vertices.values()) {
      bounds.min.x = Math.min(bounds.min.x, v.position.x);
      bounds.min.y = Math.min(bounds.min.y, v.position.y);
      bounds.min.z = Math.min(bounds.min.z, v.position.z);
      bounds.max.x = Math.max(bounds.max.x, v.position.x);
      bounds.max.y = Math.max(bounds.max.y, v.position.y);
      bounds.max.z = Math.max(bounds.max.z, v.position.z);
    }
    return bounds;
  }
  
  private calculateCenter(mesh: EditableMeshData, vertexIds: string[]): Vec3 {
    let cx = 0, cy = 0, cz = 0;
    for (const id of vertexIds) {
      const v = mesh.vertices.get(id);
      if (v) {
        cx += v.position.x;
        cy += v.position.y;
        cz += v.position.z;
      }
    }
    const count = vertexIds.length || 1;
    return { x: cx / count, y: cy / count, z: cz / count };
  }
  
  private findIsolatedVertices(mesh: EditableMeshData): string[] {
    const result: string[] = [];
    const used = new Set<string>();
    for (const face of mesh.faces.values()) {
      for (const vId of face.vertexIds) used.add(vId);
    }
    for (const [vertexId] of mesh.vertices) {
      if (!used.has(vertexId)) result.push(vertexId);
    }
    return result;
  }
  
  private rebuildEdges(mesh: EditableMeshData): void {
    mesh.edges.clear();
    for (const v of mesh.vertices.values()) v.edgeIds = [];
    
    const edgeMap = new Map<string, string>();
    
    for (const face of mesh.faces.values()) {
      face.edgeIds = [];
      for (let i = 0; i < face.vertexIds.length; i++) {
        const v0 = face.vertexIds[i];
        const v1 = face.vertexIds[(i + 1) % face.vertexIds.length];
        const key = v0 < v1 ? `${v0}-${v1}` : `${v1}-${v0}`;
        
        let edgeId = edgeMap.get(key);
        if (!edgeId) {
          edgeId = generateId();
          mesh.edges.set(edgeId, {
            id: edgeId,
            vertexIds: [v0, v1] as [string, string],
            faceIds: [],
            crease: 0,
            sharp: false,
            selected: false,
          });
          edgeMap.set(key, edgeId);
          mesh.vertices.get(v0)?.edgeIds.push(edgeId);
          mesh.vertices.get(v1)?.edgeIds.push(edgeId);
        }
        
        face.edgeIds.push(edgeId);
        mesh.edges.get(edgeId)?.faceIds.push(face.id);
      }
    }
  }
  
  private recalculateFaceNormal(mesh: EditableMeshData, face: EditableFace): void {
    if (face.vertexIds.length < 3) return;
    const v0 = mesh.vertices.get(face.vertexIds[0]);
    const v1 = mesh.vertices.get(face.vertexIds[1]);
    const v2 = mesh.vertices.get(face.vertexIds[2]);
    if (!v0 || !v1 || !v2) return;
    
    const e1 = { x: v1.position.x - v0.position.x, y: v1.position.y - v0.position.y, z: v1.position.z - v0.position.z };
    const e2 = { x: v2.position.x - v0.position.x, y: v2.position.y - v0.position.y, z: v2.position.z - v0.position.z };
    
    face.normal = {
      x: e1.y * e2.z - e1.z * e2.y,
      y: e1.z * e2.x - e1.x * e2.z,
      z: e1.x * e2.y - e1.y * e2.x,
    };
    
    const len = Math.sqrt(face.normal.x ** 2 + face.normal.y ** 2 + face.normal.z ** 2);
    if (len > 0) {
      face.normal.x /= len;
      face.normal.y /= len;
      face.normal.z /= len;
    }
  }
  
  private recalculateVertexNormals(mesh: EditableMeshData): void {
    for (const vertex of mesh.vertices.values()) {
      let nx = 0, ny = 0, nz = 0;
      for (const faceId of vertex.faceIds) {
        const face = mesh.faces.get(faceId);
        if (face) {
          nx += face.normal.x;
          ny += face.normal.y;
          nz += face.normal.z;
        }
      }
      const len = Math.sqrt(nx ** 2 + ny ** 2 + nz ** 2);
      if (len > 0) {
        vertex.normal.x = nx / len;
        vertex.normal.y = ny / len;
        vertex.normal.z = nz / len;
      }
    }
  }
  
  private calculateStatistics(mesh: EditableMeshData): MeshStatistics {
    let triangles = 0, quads = 0, ngons = 0, boundary = 0, nonManifold = 0, isolated = 0, area = 0;
    
    for (const face of mesh.faces.values()) {
      if (face.vertexIds.length === 3) triangles++;
      else if (face.vertexIds.length === 4) quads++;
      else ngons++;
      area += this.calculateFaceArea(mesh, face);
    }
    
    for (const edge of mesh.edges.values()) {
      if (edge.faceIds.length === 1) boundary++;
      else if (edge.faceIds.length !== 2) nonManifold++;
    }
    
    const used = new Set<string>();
    for (const face of mesh.faces.values()) {
      for (const vId of face.vertexIds) used.add(vId);
    }
    for (const [vertexId] of mesh.vertices) {
      if (!used.has(vertexId)) isolated++;
    }
    
    return {
      vertexCount: mesh.vertices.size,
      edgeCount: mesh.edges.size,
      faceCount: mesh.faces.size,
      triangleCount: triangles,
      quadCount: quads,
      ngonCount: ngons,
      boundaryEdgeCount: boundary,
      nonManifoldEdgeCount: nonManifold,
      isolatedVertexCount: isolated,
      surfaceArea: area,
    };
  }
}

export function createMeshCleaner(config?: Partial<MeshCleanerConfig>): MeshCleaner {
  return new MeshCleaner(config);
}

export default MeshCleaner;
