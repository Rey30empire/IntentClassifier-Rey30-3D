/**
 * NEXUS Engine - Template 3D Generator
 * 
 * Genera plantillas 3D paramétricas para diferentes categorías
 */

import {
  TemplateType,
  TemplateParams,
  HumanTemplateParams,
  ChairTemplateParams,
  TableTemplateParams,
  BedTemplateParams,
  Vec3,
  generateId,
} from '../types';
import { EditableMesh, createEditableMesh } from '../representation/EditableMesh';

/**
 * Template 3D Generator
 * 
 * Genera mallas base paramétricas para diferentes categorías de objetos
 */
export class Template3DGenerator {
  /**
   * Generate template mesh by category
   */
  generate(type: TemplateType, params: TemplateParams): EditableMesh {
    switch (type) {
      case 'human':
        return this.generateHuman(params as HumanTemplateParams);
      case 'chair':
        return this.generateChair(params as ChairTemplateParams);
      case 'table':
        return this.generateTable(params as TableTemplateParams);
      case 'bed':
        return this.generateBed(params as BedTemplateParams);
      case 'sofa':
        return this.generateSofa(params);
      case 'cabinet':
        return this.generateCabinet(params);
      case 'vehicle':
        return this.generateVehicle(params);
      case 'room':
        return this.generateRoom(params);
      default:
        return this.generateGeneric(params);
    }
  }

  /**
   * Generate human base mesh
   */
  private generateHuman(params: Partial<HumanTemplateParams>): EditableMesh {
    const {
      height = 1.8,
      bodyType = 'average',
      gender = 'neutral',
      proportionStyle = 'realistic',
      subdivisions = 1,
    } = params;

    const mesh = createEditableMesh('Human_Base');

    // Body proportions based on height
    const headHeight = height * 0.13;
    const neckHeight = height * 0.05;
    const torsoHeight = height * 0.3;
    const hipHeight = height * 0.1;
    const legHeight = height * 0.42;

    // Width variations based on body type
    const widthMultiplier = bodyType === 'slim' ? 0.8 : bodyType === 'athletic' ? 1.0 : bodyType === 'heavy' ? 1.3 : 1.0;

    // Body dimensions
    const shoulderWidth = 0.45 * widthMultiplier;
    const torsoWidth = 0.35 * widthMultiplier;
    const hipWidth = 0.35 * widthMultiplier;

    // Create head (simple sphere approximation)
    const headCenter = { x: 0, y: height - headHeight / 2, z: 0 };
    const headRadius = headHeight / 2;
    this.addSphere(mesh, headCenter, headRadius, subdivisions);

    // Create neck (cylinder)
    const neckBottom = height - headHeight - neckHeight;
    this.addCylinder(mesh, 
      { x: 0, y: neckBottom + neckHeight / 2, z: 0 },
      0.08,
      neckHeight,
      subdivisions
    );

    // Create torso (elongated box)
    const torsoBottom = neckBottom - torsoHeight;
    this.addBox(mesh,
      { x: 0, y: torsoBottom + torsoHeight / 2, z: 0 },
      { x: shoulderWidth, y: torsoHeight, z: 0.2 },
      subdivisions
    );

    // Create hips
    const hipBottom = torsoBottom - hipHeight;
    this.addBox(mesh,
      { x: 0, y: hipBottom + hipHeight / 2, z: 0 },
      { x: hipWidth, y: hipHeight, z: 0.2 },
      subdivisions
    );

    // Create legs
    const legBottom = hipBottom - legHeight;
    const legSpacing = hipWidth * 0.4;
    
    // Left leg
    this.addCylinder(mesh,
      { x: -legSpacing / 2, y: hipBottom - legHeight / 2, z: 0 },
      0.08,
      legHeight,
      subdivisions
    );

    // Right leg
    this.addCylinder(mesh,
      { x: legSpacing / 2, y: hipBottom - legHeight / 2, z: 0 },
      0.08,
      legHeight,
      subdivisions
    );

    // Create arms
    const armLength = height * 0.35;
    const armSpacing = shoulderWidth * 0.9;
    
    // Left arm
    this.addCylinder(mesh,
      { x: -armSpacing, y: neckBottom - armLength / 2, z: 0 },
      0.05,
      armLength,
      subdivisions
    );

    // Right arm
    this.addCylinder(mesh,
      { x: armSpacing, y: neckBottom - armLength / 2, z: 0 },
      0.05,
      armLength,
      subdivisions
    );

    // Update metadata
    mesh.metadata.sourceType = 'sketch_single';
    mesh.metadata.pipeline = 'sketch2d_to_3d';
    mesh.metadata.confidence = 0.7;
    mesh.metadata.qualityLevel = 'good';

    return mesh;
  }

  /**
   * Generate chair mesh
   */
  private generateChair(params: Partial<ChairTemplateParams>): EditableMesh {
    const {
      seatHeight = 0.45,
      seatWidth = 0.45,
      seatDepth = 0.4,
      backrestHeight = 0.5,
      legStyle = 'straight',
      legCount = 4,
      armrests = false,
      subdivisions = 1,
    } = params;

    const mesh = createEditableMesh('Chair_Base');

    // Create seat
    this.addBox(mesh,
      { x: 0, y: seatHeight, z: 0 },
      { x: seatWidth, y: 0.05, z: seatDepth },
      subdivisions
    );

    // Create legs
    const legPositions = this.getLegPositions(legCount, seatWidth * 0.45, seatDepth * 0.45);
    for (const pos of legPositions) {
      this.addCylinder(mesh,
        { x: pos.x, y: seatHeight / 2, z: pos.z },
        0.025,
        seatHeight,
        subdivisions
      );
    }

    // Create backrest
    if (backrestHeight > 0) {
      this.addBox(mesh,
        { x: 0, y: seatHeight + backrestHeight / 2, z: -seatDepth / 2 + 0.02 },
        { x: seatWidth, y: backrestHeight, z: 0.04 },
        subdivisions
      );
    }

    // Create armrests
    if (armrests) {
      const armrestHeight = 0.2;
      const armrestWidth = 0.05;
      
      // Left armrest
      this.addBox(mesh,
        { x: -seatWidth / 2 - armrestWidth / 2, y: seatHeight + armrestHeight / 2, z: 0 },
        { x: armrestWidth, y: armrestHeight, z: seatDepth * 0.6 },
        subdivisions
      );

      // Right armrest
      this.addBox(mesh,
        { x: seatWidth / 2 + armrestWidth / 2, y: seatHeight + armrestHeight / 2, z: 0 },
        { x: armrestWidth, y: armrestHeight, z: seatDepth * 0.6 },
        subdivisions
      );
    }

    mesh.metadata.confidence = 0.8;
    mesh.metadata.qualityLevel = 'good';

    return mesh;
  }

  /**
   * Generate table mesh
   */
  private generateTable(params: Partial<TableTemplateParams>): EditableMesh {
    const {
      height = 0.75,
      width = 1.2,
      depth = 0.8,
      topThickness = 0.04,
      legStyle = 'straight',
      legCount = 4,
      subdivisions = 1,
    } = params;

    const mesh = createEditableMesh('Table_Base');

    // Create top
    this.addBox(mesh,
      { x: 0, y: height - topThickness / 2, z: 0 },
      { x: width, y: topThickness, z: depth },
      subdivisions
    );

    // Create legs
    const legPositions = this.getLegPositions(legCount, width * 0.45, depth * 0.45);
    for (const pos of legPositions) {
      this.addCylinder(mesh,
        { x: pos.x, y: (height - topThickness) / 2, z: pos.z },
        0.04,
        height - topThickness,
        subdivisions
      );
    }

    mesh.metadata.confidence = 0.85;
    mesh.metadata.qualityLevel = 'good';

    return mesh;
  }

  /**
   * Generate bed mesh
   */
  private generateBed(params: Partial<BedTemplateParams>): EditableMesh {
    const {
      length = 2.0,
      width = 1.0,
      height = 0.4,
      headboardHeight = 0.8,
      footboardHeight = 0.3,
      frameThickness = 0.05,
      subdivisions = 1,
    } = params;

    const mesh = createEditableMesh('Bed_Base');

    // Create frame base
    this.addBox(mesh,
      { x: 0, y: frameThickness / 2, z: 0 },
      { x: width - frameThickness * 2, y: frameThickness, z: length - frameThickness * 2 },
      subdivisions
    );

    // Create mattress
    this.addBox(mesh,
      { x: 0, y: frameThickness + height / 2, z: 0 },
      { x: width * 0.95, y: height * 0.8, z: length * 0.95 },
      subdivisions
    );

    // Create headboard
    if (headboardHeight > 0) {
      this.addBox(mesh,
        { x: 0, y: headboardHeight / 2 + frameThickness, z: -length / 2 + frameThickness },
        { x: width, y: headboardHeight, z: frameThickness },
        subdivisions
      );
    }

    // Create footboard
    if (footboardHeight > 0) {
      this.addBox(mesh,
        { x: 0, y: footboardHeight / 2 + frameThickness, z: length / 2 - frameThickness },
        { x: width, y: footboardHeight, z: frameThickness },
        subdivisions
      );
    }

    mesh.metadata.confidence = 0.8;
    mesh.metadata.qualityLevel = 'good';

    return mesh;
  }

  /**
   * Generate sofa mesh
   */
  private generateSofa(params: TemplateParams): EditableMesh {
    const width = (params.width as number) ?? 2.0;
    const depth = (params.depth as number) ?? 0.9;
    const height = (params.height as number) ?? 0.8;
    const seatHeight = (params.seatHeight as number) ?? 0.45;

    const mesh = createEditableMesh('Sofa_Base');

    // Create seat base
    this.addBox(mesh,
      { x: 0, y: seatHeight / 2, z: 0 },
      { x: width, y: seatHeight, z: depth * 0.7 },
      1
    );

    // Create backrest
    this.addBox(mesh,
      { x: 0, y: height / 2 + seatHeight / 2, z: -depth * 0.25 },
      { x: width, y: height - seatHeight, z: depth * 0.3 },
      1
    );

    // Create armrests
    this.addBox(mesh,
      { x: -width / 2 + 0.1, y: height / 2, z: 0 },
      { x: 0.15, y: height, z: depth * 0.7 },
      1
    );
    this.addBox(mesh,
      { x: width / 2 - 0.1, y: height / 2, z: 0 },
      { x: 0.15, y: height, z: depth * 0.7 },
      1
    );

    mesh.metadata.confidence = 0.75;
    mesh.metadata.qualityLevel = 'good';

    return mesh;
  }

  /**
   * Generate cabinet mesh
   */
  private generateCabinet(params: TemplateParams): EditableMesh {
    const width = (params.width as number) ?? 0.8;
    const height = (params.height as number) ?? 1.5;
    const depth = (params.depth as number) ?? 0.4;

    const mesh = createEditableMesh('Cabinet_Base');

    this.addBox(mesh,
      { x: 0, y: height / 2, z: 0 },
      { x: width, y: height, z: depth },
      1
    );

    mesh.metadata.confidence = 0.85;
    mesh.metadata.qualityLevel = 'good';

    return mesh;
  }

  /**
   * Generate vehicle mesh
   */
  private generateVehicle(params: TemplateParams): EditableMesh {
    const length = (params.length as number) ?? 4.5;
    const width = (params.width as number) ?? 1.8;
    const height = (params.height as number) ?? 1.4;

    const mesh = createEditableMesh('Vehicle_Base');

    // Create body base
    this.addBox(mesh,
      { x: 0, y: height * 0.3, z: 0 },
      { x: width, y: height * 0.5, z: length },
      1
    );

    // Create cabin
    this.addBox(mesh,
      { x: 0, y: height * 0.6, z: -length * 0.1 },
      { x: width * 0.9, y: height * 0.4, z: length * 0.5 },
      1
    );

    // Create wheels (simplified)
    const wheelRadius = 0.35;
    const wheelPositions = [
      { x: -width / 2, y: wheelRadius, z: length * 0.35 },
      { x: width / 2, y: wheelRadius, z: length * 0.35 },
      { x: -width / 2, y: wheelRadius, z: -length * 0.35 },
      { x: width / 2, y: wheelRadius, z: -length * 0.35 },
    ];

    for (const pos of wheelPositions) {
      this.addCylinder(mesh, pos, wheelRadius, 0.2, 1);
    }

    mesh.metadata.confidence = 0.7;
    mesh.metadata.qualityLevel = 'acceptable';

    return mesh;
  }

  /**
   * Generate room mesh
   */
  private generateRoom(params: TemplateParams): EditableMesh {
    const width = (params.width as number) ?? 5;
    const length = (params.length as number) ?? 4;
    const height = (params.height as number) ?? 2.8;

    const mesh = createEditableMesh('Room_Base');

    // Create floor
    this.addBox(mesh,
      { x: 0, y: 0, z: 0 },
      { x: width, y: 0.1, z: length },
      1
    );

    // Create walls (as separate boxes for now)
    // Back wall
    this.addBox(mesh,
      { x: 0, y: height / 2, z: -length / 2 },
      { x: width, y: height, z: 0.1 },
      1
    );

    // Front wall (with door opening simulation)
    this.addBox(mesh,
      { x: 0, y: height / 2, z: length / 2 },
      { x: width, y: height, z: 0.1 },
      1
    );

    // Left wall
    this.addBox(mesh,
      { x: -width / 2, y: height / 2, z: 0 },
      { x: 0.1, y: height, z: length },
      1
    );

    // Right wall
    this.addBox(mesh,
      { x: width / 2, y: height / 2, z: 0 },
      { x: 0.1, y: height, z: length },
      1
    );

    mesh.metadata.confidence = 0.9;
    mesh.metadata.qualityLevel = 'good';

    return mesh;
  }

  /**
   * Generate generic placeholder mesh
   */
  private generateGeneric(params: TemplateParams): EditableMesh {
    const size = (params.size as number) ?? 1;
    const mesh = createEditableMesh('Generic_Base');

    this.addBox(mesh,
      { x: 0, y: size / 2, z: 0 },
      { x: size, y: size, z: size },
      1
    );

    mesh.metadata.confidence = 0.5;
    mesh.metadata.qualityLevel = 'acceptable';

    return mesh;
  }

  // ===== PRIMITIVE HELPERS =====

  /**
   * Add a box to mesh
   */
  private addBox(
    mesh: EditableMesh,
    center: Vec3,
    size: Vec3,
    _subdivisions: number
  ): void {
    const hw = size.x / 2;
    const hh = size.y / 2;
    const hd = size.z / 2;

    // Create 8 vertices
    const v = [
      mesh.addVertex({ x: center.x - hw, y: center.y - hh, z: center.z - hd }),
      mesh.addVertex({ x: center.x + hw, y: center.y - hh, z: center.z - hd }),
      mesh.addVertex({ x: center.x + hw, y: center.y + hh, z: center.z - hd }),
      mesh.addVertex({ x: center.x - hw, y: center.y + hh, z: center.z - hd }),
      mesh.addVertex({ x: center.x - hw, y: center.y - hh, z: center.z + hd }),
      mesh.addVertex({ x: center.x + hw, y: center.y - hh, z: center.z + hd }),
      mesh.addVertex({ x: center.x + hw, y: center.y + hh, z: center.z + hd }),
      mesh.addVertex({ x: center.x - hw, y: center.y + hh, z: center.z + hd }),
    ];

    // Create 6 faces (2 triangles per face)
    const faces = [
      [v[0].id, v[1].id, v[2].id, v[3].id], // Front
      [v[5].id, v[4].id, v[7].id, v[6].id], // Back
      [v[4].id, v[0].id, v[3].id, v[7].id], // Left
      [v[1].id, v[5].id, v[6].id, v[2].id], // Right
      [v[3].id, v[2].id, v[6].id, v[7].id], // Top
      [v[4].id, v[5].id, v[1].id, v[0].id], // Bottom
    ];

    for (const face of faces) {
      mesh.addFace(face);
    }
  }

  /**
   * Add a cylinder to mesh
   */
  private addCylinder(
    mesh: EditableMesh,
    center: Vec3,
    radius: number,
    height: number,
    segments: number
  ): void {
    const segmentsCount = Math.max(8, segments * 8);
    const halfHeight = height / 2;

    // Create top and bottom vertices
    const topVertices: string[] = [];
    const bottomVertices: string[] = [];

    for (let i = 0; i < segmentsCount; i++) {
      const angle = (i / segmentsCount) * Math.PI * 2;
      const x = center.x + Math.cos(angle) * radius;
      const z = center.z + Math.sin(angle) * radius;

      topVertices.push(mesh.addVertex({ x, y: center.y + halfHeight, z }).id);
      bottomVertices.push(mesh.addVertex({ x, y: center.y - halfHeight, z }).id);
    }

    // Create side faces
    for (let i = 0; i < segmentsCount; i++) {
      const next = (i + 1) % segmentsCount;
      mesh.addFace([
        bottomVertices[i],
        bottomVertices[next],
        topVertices[next],
        topVertices[i],
      ]);
    }

    // Create top and bottom caps
    const topCenter = mesh.addVertex({ x: center.x, y: center.y + halfHeight, z: center.z });
    const bottomCenter = mesh.addVertex({ x: center.x, y: center.y - halfHeight, z: center.z });

    for (let i = 0; i < segmentsCount; i++) {
      const next = (i + 1) % segmentsCount;
      mesh.addFace([topVertices[i], topVertices[next], topCenter.id]);
      mesh.addFace([bottomVertices[next], bottomVertices[i], bottomCenter.id]);
    }
  }

  /**
   * Add a sphere to mesh
   */
  private addSphere(
    mesh: EditableMesh,
    center: Vec3,
    radius: number,
    subdivisions: number
  ): void {
    const segments = Math.max(8, subdivisions * 8);
    const rings = Math.max(6, subdivisions * 6);

    // Create vertices
    const vertices: string[][] = [];

    for (let ring = 0; ring <= rings; ring++) {
      const phi = (ring / rings) * Math.PI;
      const ringVertices: string[] = [];

      for (let seg = 0; seg < segments; seg++) {
        const theta = (seg / segments) * Math.PI * 2;

        const x = center.x + radius * Math.sin(phi) * Math.cos(theta);
        const y = center.y + radius * Math.cos(phi);
        const z = center.z + radius * Math.sin(phi) * Math.sin(theta);

        ringVertices.push(mesh.addVertex({ x, y, z }).id);
      }

      vertices.push(ringVertices);
    }

    // Create faces
    for (let ring = 0; ring < rings; ring++) {
      for (let seg = 0; seg < segments; seg++) {
        const next = (seg + 1) % segments;

        if (ring === 0) {
          // Top cap
          mesh.addFace([
            vertices[0][0],
            vertices[1][seg],
            vertices[1][next],
          ]);
        } else if (ring === rings - 1) {
          // Bottom cap
          mesh.addFace([
            vertices[rings][0],
            vertices[ring][next],
            vertices[ring][seg],
          ]);
        } else {
          // Middle rings
          mesh.addFace([
            vertices[ring][seg],
            vertices[ring][next],
            vertices[ring + 1][next],
            vertices[ring + 1][seg],
          ]);
        }
      }
    }
  }

  /**
   * Get leg positions for furniture
   */
  private getLegPositions(count: number, halfWidth: number, halfDepth: number): Vec3[] {
    const positions: Vec3[] = [];

    if (count === 3) {
      positions.push({ x: 0, y: 0, z: -halfDepth });
      positions.push({ x: -halfWidth, y: 0, z: halfDepth });
      positions.push({ x: halfWidth, y: 0, z: halfDepth });
    } else if (count === 4) {
      positions.push({ x: -halfWidth, y: 0, z: -halfDepth });
      positions.push({ x: halfWidth, y: 0, z: -halfDepth });
      positions.push({ x: -halfWidth, y: 0, z: halfDepth });
      positions.push({ x: halfWidth, y: 0, z: halfDepth });
    } else if (count === 6) {
      positions.push({ x: -halfWidth, y: 0, z: -halfDepth });
      positions.push({ x: halfWidth, y: 0, z: -halfDepth });
      positions.push({ x: -halfWidth, y: 0, z: 0 });
      positions.push({ x: halfWidth, y: 0, z: 0 });
      positions.push({ x: -halfWidth, y: 0, z: halfDepth });
      positions.push({ x: halfWidth, y: 0, z: halfDepth });
    }

    return positions;
  }
}

/**
 * Factory function
 */
export function createTemplate3DGenerator(): Template3DGenerator {
  return new Template3DGenerator();
}
