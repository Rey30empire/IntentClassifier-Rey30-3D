/**
 * NEXUS Engine - EditableMesh
 * 
 * Representación interna de malla editable para el sistema de conversión 2D/3D
 */

import {
  EditableVertex,
  EditableEdge,
  EditableFace,
  EditableMeshData,
  TopologyGraph,
  BoundingBox3D,
  Vec3,
  UV,
  RGBA,
  ReconstructionMetadata,
  generateId,
  vec3,
  uv,
  rgba,
  emptyBoundingBox3D,
  mergeBoundingBox3D,
  InputType,
  PipelineType,
  QualityLevel,
} from '../types';

/**
 * Clase principal para malla editable
 */
export class EditableMesh implements EditableMeshData {
  id: string;
  name: string;
  vertices: Map<string, EditableVertex>;
  edges: Map<string, EditableEdge>;
  faces: Map<string, EditableFace>;
  topology: TopologyGraph;
  attributes: {
    normals: Vec3[];
    uvs: UV[];
    colors: RGBA[];
  };
  materials: string[];
  bounds: BoundingBox3D;
  metadata: ReconstructionMetadata;

  constructor(name = 'UntitledMesh') {
    this.id = generateId();
    this.name = name;
    this.vertices = new Map();
    this.edges = new Map();
    this.faces = new Map();
    this.topology = {
      vertexAdjacency: new Map(),
      edgeAdjacency: new Map(),
      faceAdjacency: new Map(),
    };
    this.attributes = {
      normals: [],
      uvs: [],
      colors: [],
    };
    this.materials = [];
    this.bounds = emptyBoundingBox3D();
    this.metadata = this.createDefaultMetadata();
  }

  // ===== VERTEX OPERATIONS =====

  /**
   * Add a new vertex
   */
  addVertex(position: Vec3, normal?: Vec3, uvCoord?: UV, color?: RGBA): EditableVertex {
    const id = generateId();
    const vertex: EditableVertex = {
      id,
      position: { ...position },
      normal: normal ?? vec3(0, 1, 0),
      uv: uvCoord ?? uv(0, 0),
      color,
      edgeIds: [],
      faceIds: [],
      selected: false,
    };

    this.vertices.set(id, vertex);
    this.topology.vertexAdjacency.set(id, []);
    this.updateBounds(position);

    return vertex;
  }

  /**
   * Remove a vertex
   */
  removeVertex(vertexId: string): boolean {
    const vertex = this.vertices.get(vertexId);
    if (!vertex) return false;

    // Remove associated faces first
    for (const faceId of [...vertex.faceIds]) {
      this.removeFace(faceId);
    }

    // Remove associated edges
    for (const edgeId of [...vertex.edgeIds]) {
      this.removeEdge(edgeId);
    }

    this.vertices.delete(vertexId);
    this.topology.vertexAdjacency.delete(vertexId);

    return true;
  }

  /**
   * Move a vertex to a new position
   */
  moveVertex(vertexId: string, position: Vec3): boolean {
    const vertex = this.vertices.get(vertexId);
    if (!vertex) return false;

    vertex.position = { ...position };
    vertex.normal = this.recalculateVertexNormal(vertexId);
    this.recalculateBounds();

    return true;
  }

  /**
   * Get vertex by ID
   */
  getVertex(vertexId: string): EditableVertex | undefined {
    return this.vertices.get(vertexId);
  }

  /**
   * Get all vertices as array
   */
  getVertices(): EditableVertex[] {
    return Array.from(this.vertices.values());
  }

  // ===== EDGE OPERATIONS =====

  /**
   * Add an edge between two vertices
   */
  addEdge(vertexId1: string, vertexId2: string): EditableEdge | null {
    if (!this.vertices.has(vertexId1) || !this.vertices.has(vertexId2)) {
      return null;
    }

    // Check if edge already exists
    const existingEdge = this.findEdge(vertexId1, vertexId2);
    if (existingEdge) return existingEdge;

    const id = generateId();
    const edge: EditableEdge = {
      id,
      vertexIds: [vertexId1, vertexId2],
      faceIds: [],
      crease: 0,
      sharp: false,
      selected: false,
    };

    this.edges.set(id, edge);

    // Update vertex references
    const v1 = this.vertices.get(vertexId1)!;
    const v2 = this.vertices.get(vertexId2)!;
    v1.edgeIds.push(id);
    v2.edgeIds.push(id);

    // Update topology
    this.topology.vertexAdjacency.get(vertexId1)?.push(vertexId2);
    this.topology.vertexAdjacency.get(vertexId2)?.push(vertexId1);
    this.topology.edgeAdjacency.set(id, []);

    return edge;
  }

  /**
   * Remove an edge
   */
  removeEdge(edgeId: string): boolean {
    const edge = this.edges.get(edgeId);
    if (!edge) return false;

    // Remove associated faces first
    for (const faceId of [...edge.faceIds]) {
      this.removeFace(faceId);
    }

    // Update vertex references
    for (const vertexId of edge.vertexIds) {
      const vertex = this.vertices.get(vertexId);
      if (vertex) {
        vertex.edgeIds = vertex.edgeIds.filter(id => id !== edgeId);
      }
    }

    // Update topology
    for (const vertexId of edge.vertexIds) {
      const adj = this.topology.vertexAdjacency.get(vertexId);
      if (adj) {
        const otherId = edge.vertexIds.find(id => id !== vertexId);
        if (otherId) {
          const index = adj.indexOf(otherId);
          if (index > -1) adj.splice(index, 1);
        }
      }
    }
    this.topology.edgeAdjacency.delete(edgeId);

    this.edges.delete(edgeId);
    return true;
  }

  /**
   * Find edge between two vertices
   */
  findEdge(vertexId1: string, vertexId2: string): EditableEdge | undefined {
    for (const edge of this.edges.values()) {
      if (
        (edge.vertexIds[0] === vertexId1 && edge.vertexIds[1] === vertexId2) ||
        (edge.vertexIds[0] === vertexId2 && edge.vertexIds[1] === vertexId1)
      ) {
        return edge;
      }
    }
    return undefined;
  }

  // ===== FACE OPERATIONS =====

  /**
   * Add a face from vertex IDs
   */
  addFace(vertexIds: string[], materialIndex = 0): EditableFace | null {
    if (vertexIds.length < 3) return null;

    // Validate all vertices exist
    for (const vid of vertexIds) {
      if (!this.vertices.has(vid)) return null;
    }

    // Triangulate if more than 3 vertices
    if (vertexIds.length === 3) {
      return this.addTriangleFace(vertexIds, materialIndex);
    }

    // For quads and ngons, triangulate using fan method
    const faces: EditableFace[] = [];
    for (let i = 1; i < vertexIds.length - 1; i++) {
      const triFace = this.addTriangleFace(
        [vertexIds[0], vertexIds[i], vertexIds[i + 1]],
        materialIndex
      );
      if (triFace) faces.push(triFace);
    }

    return faces[0] ?? null;
  }

  /**
   * Add a triangular face
   */
  private addTriangleFace(vertexIds: string[], materialIndex: number): EditableFace | null {
    // Create or get edges
    const edgeIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const v1 = vertexIds[i];
      const v2 = vertexIds[(i + 1) % 3];
      let edge: EditableEdge | undefined = this.findEdge(v1, v2);
      if (!edge) {
        edge = this.addEdge(v1, v2) ?? undefined;
      }
      if (edge) edgeIds.push(edge.id);
    }

    const id = generateId();
    const normal = this.calculateFaceNormal(vertexIds);
    const face: EditableFace = {
      id,
      vertexIds: [...vertexIds],
      edgeIds,
      normal,
      materialIndex,
      selected: false,
    };

    this.faces.set(id, face);

    // Update vertex and edge references
    for (const vertexId of vertexIds) {
      const vertex = this.vertices.get(vertexId);
      if (vertex && !vertex.faceIds.includes(id)) {
        vertex.faceIds.push(id);
      }
    }

    for (const edgeId of edgeIds) {
      const edge = this.edges.get(edgeId);
      if (edge && !edge.faceIds.includes(id)) {
        edge.faceIds.push(id);
      }
    }

    // Update topology
    this.topology.faceAdjacency.set(id, []);

    // Recalculate vertex normals for affected vertices
    for (const vertexId of vertexIds) {
      const vertex = this.vertices.get(vertexId);
      if (vertex) {
        vertex.normal = this.recalculateVertexNormal(vertexId);
      }
    }

    return face;
  }

  /**
   * Remove a face
   */
  removeFace(faceId: string): boolean {
    const face = this.faces.get(faceId);
    if (!face) return false;

    // Update vertex references
    for (const vertexId of face.vertexIds) {
      const vertex = this.vertices.get(vertexId);
      if (vertex) {
        vertex.faceIds = vertex.faceIds.filter(id => id !== faceId);
      }
    }

    // Update edge references
    for (const edgeId of face.edgeIds) {
      const edge = this.edges.get(edgeId);
      if (edge) {
        edge.faceIds = edge.faceIds.filter(id => id !== faceId);
      }
    }

    this.topology.faceAdjacency.delete(faceId);
    this.faces.delete(faceId);

    return true;
  }

  /**
   * Extrude a face
   */
  extrudeFace(faceId: string, distance: number): EditableFace | null {
    const face = this.faces.get(faceId);
    if (!face) return null;

    const newVertexIds: string[] = [];
    const direction = face.normal;

    // Create new vertices offset by distance
    for (const vertexId of face.vertexIds) {
      const vertex = this.vertices.get(vertexId);
      if (vertex) {
        const newPos = {
          x: vertex.position.x + direction.x * distance,
          y: vertex.position.y + direction.y * distance,
          z: vertex.position.z + direction.z * distance,
        };
        const newVertex = this.addVertex(newPos, { ...direction });
        newVertexIds.push(newVertex.id);
      }
    }

    // Remove original face
    this.removeFace(faceId);

    // Create side faces
    for (let i = 0; i < face.vertexIds.length; i++) {
      const v1 = face.vertexIds[i];
      const v2 = face.vertexIds[(i + 1) % face.vertexIds.length];
      const v3 = newVertexIds[(i + 1) % newVertexIds.length];
      const v4 = newVertexIds[i];
      this.addFace([v1, v2, v3, v4]);
    }

    // Create new top face
    const newFace = this.addFace(newVertexIds);

    return newFace;
  }

  // ===== SELECTION =====

  /**
   * Select a vertex
   */
  selectVertex(vertexId: string, selected = true): void {
    const vertex = this.vertices.get(vertexId);
    if (vertex) vertex.selected = selected;
  }

  /**
   * Select an edge
   */
  selectEdge(edgeId: string, selected = true): void {
    const edge = this.edges.get(edgeId);
    if (edge) edge.selected = selected;
  }

  /**
   * Select a face
   */
  selectFace(faceId: string, selected = true): void {
    const face = this.faces.get(faceId);
    if (face) face.selected = selected;
  }

  /**
   * Clear all selection
   */
  clearSelection(): void {
    for (const vertex of this.vertices.values()) {
      vertex.selected = false;
    }
    for (const edge of this.edges.values()) {
      edge.selected = false;
    }
    for (const face of this.faces.values()) {
      face.selected = false;
    }
  }

  /**
   * Get selected vertices
   */
  getSelectedVertices(): EditableVertex[] {
    return Array.from(this.vertices.values()).filter(v => v.selected);
  }

  /**
   * Get selected edges
   */
  getSelectedEdges(): EditableEdge[] {
    return Array.from(this.edges.values()).filter(e => e.selected);
  }

  /**
   * Get selected faces
   */
  getSelectedFaces(): EditableFace[] {
    return Array.from(this.faces.values()).filter(f => f.selected);
  }

  // ===== CALCULATIONS =====

  /**
   * Calculate face normal
   */
  private calculateFaceNormal(vertexIds: string[]): Vec3 {
    if (vertexIds.length < 3) return vec3(0, 1, 0);

    const v0 = this.vertices.get(vertexIds[0]);
    const v1 = this.vertices.get(vertexIds[1]);
    const v2 = this.vertices.get(vertexIds[2]);

    if (!v0 || !v1 || !v2) return vec3(0, 1, 0);

    const edge1 = {
      x: v1.position.x - v0.position.x,
      y: v1.position.y - v0.position.y,
      z: v1.position.z - v0.position.z,
    };

    const edge2 = {
      x: v2.position.x - v0.position.x,
      y: v2.position.y - v0.position.y,
      z: v2.position.z - v0.position.z,
    };

    // Cross product
    const normal = {
      x: edge1.y * edge2.z - edge1.z * edge2.y,
      y: edge1.z * edge2.x - edge1.x * edge2.z,
      z: edge1.x * edge2.y - edge1.y * edge2.x,
    };

    // Normalize
    const length = Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2);
    if (length > 0) {
      normal.x /= length;
      normal.y /= length;
      normal.z /= length;
    }

    return normal;
  }

  /**
   * Recalculate vertex normal based on adjacent faces
   */
  private recalculateVertexNormal(vertexId: string): Vec3 {
    const vertex = this.vertices.get(vertexId);
    if (!vertex) return vec3(0, 1, 0);

    const normal = vec3(0, 0, 0);
    let count = 0;

    for (const faceId of vertex.faceIds) {
      const face = this.faces.get(faceId);
      if (face) {
        normal.x += face.normal.x;
        normal.y += face.normal.y;
        normal.z += face.normal.z;
        count++;
      }
    }

    if (count > 0) {
      normal.x /= count;
      normal.y /= count;
      normal.z /= count;

      // Normalize
      const length = Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2);
      if (length > 0) {
        normal.x /= length;
        normal.y /= length;
        normal.z /= length;
      }
    }

    return normal;
  }

  /**
   * Update bounds with a new position
   */
  private updateBounds(position: Vec3): void {
    this.bounds = mergeBoundingBox3D(this.bounds, {
      min: position,
      max: position,
    });
  }

  /**
   * Recalculate all bounds
   */
  private recalculateBounds(): void {
    this.bounds = emptyBoundingBox3D();
    for (const vertex of this.vertices.values()) {
      this.updateBounds(vertex.position);
    }
  }

  // ===== UTILITY =====

  /**
   * Create default metadata
   */
  private createDefaultMetadata(): ReconstructionMetadata {
    return {
      sourceType: 'sketch_single' as InputType,
      sourceId: '',
      pipeline: 'sketch2d_to_3d' as PipelineType,
      confidence: 0,
      qualityLevel: 'good' as QualityLevel,
      createdAt: new Date(),
      processingTime: 0,
      parameters: {},
      version: '1.0.0',
    };
  }

  /**
   * Get vertex count
   */
  get vertexCount(): number {
    return this.vertices.size;
  }

  /**
   * Get edge count
   */
  get edgeCount(): number {
    return this.edges.size;
  }

  /**
   * Get face count
   */
  get faceCount(): number {
    return this.faces.size;
  }

  /**
   * Check if mesh is empty
   */
  get isEmpty(): boolean {
    return this.vertices.size === 0;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.vertices.clear();
    this.edges.clear();
    this.faces.clear();
    this.topology.vertexAdjacency.clear();
    this.topology.edgeAdjacency.clear();
    this.topology.faceAdjacency.clear();
    this.bounds = emptyBoundingBox3D();
  }

  // ===== SERIALIZATION =====

  /**
   * Serialize to JSON-compatible object
   */
  serialize(): SerializedEditableMesh {
    return {
      id: this.id,
      name: this.name,
      vertices: Array.from(this.vertices.entries()),
      edges: Array.from(this.edges.entries()),
      faces: Array.from(this.faces.entries()),
      materials: this.materials,
      bounds: this.bounds,
      metadata: this.metadata,
    };
  }

  /**
   * Deserialize from JSON-compatible object
   */
  static deserialize(data: SerializedEditableMesh): EditableMesh {
    const mesh = new EditableMesh(data.name);
    mesh.id = data.id;
    mesh.vertices = new Map(data.vertices);
    mesh.edges = new Map(data.edges);
    mesh.faces = new Map(data.faces);
    mesh.materials = data.materials;
    mesh.bounds = data.bounds;
    mesh.metadata = data.metadata;

    // Rebuild topology
    mesh.topology = {
      vertexAdjacency: new Map(),
      edgeAdjacency: new Map(),
      faceAdjacency: new Map(),
    };

    for (const [vertexId] of mesh.vertices) {
      mesh.topology.vertexAdjacency.set(vertexId, []);
    }

    for (const [edgeId, edge] of mesh.edges) {
      mesh.topology.edgeAdjacency.set(edgeId, []);
      mesh.topology.vertexAdjacency.get(edge.vertexIds[0])?.push(edge.vertexIds[1]);
      mesh.topology.vertexAdjacency.get(edge.vertexIds[1])?.push(edge.vertexIds[0]);
    }

    for (const [faceId] of mesh.faces) {
      mesh.topology.faceAdjacency.set(faceId, []);
    }

    return mesh;
  }

  /**
   * Clone the mesh
   */
  clone(): EditableMesh {
    return EditableMesh.deserialize(this.serialize());
  }
}

/** Serialized mesh format */
export interface SerializedEditableMesh {
  id: string;
  name: string;
  vertices: Array<[string, EditableVertex]>;
  edges: Array<[string, EditableEdge]>;
  faces: Array<[string, EditableFace]>;
  materials: string[];
  bounds: BoundingBox3D;
  metadata: ReconstructionMetadata;
}

/**
 * Factory function to create an EditableMesh
 */
export function createEditableMesh(name?: string): EditableMesh {
  return new EditableMesh(name);
}

/**
 * Create an EditableMesh from raw vertex/face data
 */
export function createEditableMeshFromData(
  vertices: Vec3[],
  faces: number[][],
  name = 'ImportedMesh'
): EditableMesh {
  const mesh = new EditableMesh(name);

  // Add vertices
  const vertexIds: string[] = [];
  for (const pos of vertices) {
    const vertex = mesh.addVertex(pos);
    vertexIds.push(vertex.id);
  }

  // Add faces
  for (const faceIndices of faces) {
    const faceVertexIds = faceIndices.map(i => vertexIds[i]);
    mesh.addFace(faceVertexIds);
  }

  return mesh;
}
