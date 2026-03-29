/**
 * NEXUS Engine - Silhouette Extractor
 * 
 * Extrae siluetas de imágenes para conversión 3D
 */

import {
  SilhouetteData,
  Contour,
  Point2D,
  BoundingBox2D,
  ImportedImage,
  generateId,
} from '../types';

/**
 * Silhouette Extractor
 * 
 * Extrae contornos y siluetas de imágenes
 */
export class SilhouetteExtractor {
  /**
   * Extract silhouette from image
   */
  extract(image: ImportedImage): SilhouetteData {
    if (!image.imageData) {
      throw new Error('Image data not available');
    }

    // Create binary mask
    const mask = this.createBinaryMask(image.imageData);

    // Find contours
    const contours = this.findContours(mask, image.width, image.height);

    // Separate outer contours from holes
    const outerContours: Contour[] = [];
    const holeContours: Contour[] = [];

    for (const contour of contours) {
      if (contour.area > 0) {
        outerContours.push(contour);
      } else {
        holeContours.push(contour);
      }
    }

    // Calculate bounding box and center
    const boundingBox = this.calculateBoundingBox(outerContours);
    const center = this.calculateCenter(outerContours);
    const totalArea = outerContours.reduce((sum, c) => sum + Math.abs(c.area), 0);

    return {
      id: generateId(),
      contours: outerContours,
      holes: holeContours,
      boundingBox,
      center,
      area: totalArea,
      sourceImageId: image.id,
    };
  }

  /**
   * Create binary mask from image
   */
  private createBinaryMask(imageData: ImageData): Uint8Array {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const mask = new Uint8Array(width * height);

    // Simple thresholding with alpha channel consideration
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Consider pixel as foreground if:
      // - Alpha is high enough
      // - Not too close to white (background)
      const brightness = (r + g + b) / 3;
      const isBackground = brightness > 240 && a > 200;
      const isForeground = a > 50 && !isBackground;

      mask[i / 4] = isForeground ? 1 : 0;
    }

    return mask;
  }

  /**
   * Find contours using marching squares
   */
  private findContours(mask: Uint8Array, width: number, height: number): Contour[] {
    const contours: Contour[] = [];
    const visited = new Set<number>();

    // Find contour starting points
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const idx = y * width + x;

        // Check for edge transition
        const current = mask[idx] ?? 0;
        const right = mask[idx + 1] ?? 0;
        const below = mask[idx + width] ?? 0;

        if (current !== right || current !== below) {
          if (!visited.has(idx)) {
            const contour = this.traceContour(mask, width, height, x, y, visited);
            if (contour.points.length > 10) {
              contours.push(contour);
            }
          }
        }
      }
    }

    return contours;
  }

  /**
   * Trace a single contour
   */
  private traceContour(
    mask: Uint8Array,
    width: number,
    height: number,
    startX: number,
    startY: number,
    visited: Set<number>
  ): Contour {
    const points: Point2D[] = [];
    let x = startX;
    let y = startY;
    let direction = 0; // 0: right, 1: down, 2: left, 3: up

    const maxIterations = width * height;
    let iterations = 0;

    do {
      const idx = y * width + x;
      visited.add(idx);
      points.push({ x, y });

      // Moore neighborhood tracing
      const dx = [1, 0, -1, 0];
      const dy = [0, 1, 0, -1];

      let found = false;
      for (let i = 0; i < 4; i++) {
        const newDir = (direction + i + 3) % 4; // Start from left of current direction
        const nx = x + dx[newDir];
        const ny = y + dy[newDir];

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = ny * width + nx;
          if (mask[nidx] === 1) {
            x = nx;
            y = ny;
            direction = newDir;
            found = true;
            break;
          }
        }
      }

      if (!found) break;
      iterations++;
    } while (!(x === startX && y === startY) && iterations < maxIterations);

    // Calculate area using shoelace formula
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    area /= 2;

    // Calculate perimeter
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }

    return {
      id: generateId(),
      points,
      closed: points.length > 2,
      area,
      perimeter,
    };
  }

  /**
   * Calculate bounding box from contours
   */
  private calculateBoundingBox(contours: Contour[]): BoundingBox2D {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const contour of contours) {
      for (const point of contour.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    return {
      min: { x: minX === Infinity ? 0 : minX, y: minY === Infinity ? 0 : minY },
      max: { x: maxX === -Infinity ? 0 : maxX, y: maxY === -Infinity ? 0 : maxY },
    };
  }

  /**
   * Calculate center of contours
   */
  private calculateCenter(contours: Contour[]): Point2D {
    let totalX = 0;
    let totalY = 0;
    let totalPoints = 0;

    for (const contour of contours) {
      for (const point of contour.points) {
        totalX += point.x;
        totalY += point.y;
        totalPoints++;
      }
    }

    return {
      x: totalPoints > 0 ? totalX / totalPoints : 0,
      y: totalPoints > 0 ? totalY / totalPoints : 0,
    };
  }

  /**
   * Smooth silhouette using Douglas-Peucker algorithm
   */
  smoothSilhouette(silhouette: SilhouetteData, tolerance = 2): SilhouetteData {
    const smoothedContours = silhouette.contours.map(contour => ({
      ...contour,
      points: this.douglasPeucker(contour.points, tolerance),
    }));

    return {
      ...silhouette,
      contours: smoothedContours,
    };
  }

  /**
   * Douglas-Peucker line simplification
   */
  private douglasPeucker(points: Point2D[], tolerance: number): Point2D[] {
    if (points.length <= 2) return points;

    // Find point with maximum distance
    let maxDist = 0;
    let maxIndex = 0;

    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.perpendicularDistance(points[i], start, end);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDist > tolerance) {
      const left = this.douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
      const right = this.douglasPeucker(points.slice(maxIndex), tolerance);
      return [...left.slice(0, -1), ...right];
    }

    return [start, end];
  }

  /**
   * Calculate perpendicular distance from point to line
   */
  private perpendicularDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;

    const lineLengthSquared = dx * dx + dy * dy;
    if (lineLengthSquared === 0) {
      return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
    }

    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSquared;
    const clampedT = Math.max(0, Math.min(1, t));

    const nearestX = lineStart.x + clampedT * dx;
    const nearestY = lineStart.y + clampedT * dy;

    return Math.sqrt((point.x - nearestX) ** 2 + (point.y - nearestY) ** 2);
  }

  /**
   * Convert silhouette to vector paths
   */
  toVectorPaths(silhouette: SilhouetteData): Point2D[][] {
    return silhouette.contours.map(contour => contour.points);
  }

  /**
   * Check if point is inside silhouette
   */
  isPointInside(silhouette: SilhouetteData, point: Point2D): boolean {
    for (const contour of silhouette.contours) {
      if (this.pointInPolygon(point, contour.points)) {
        // Check if inside a hole
        for (const hole of silhouette.holes) {
          if (this.pointInPolygon(point, hole.points)) {
            return false;
          }
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Ray casting algorithm for point in polygon
   */
  private pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }
}

/**
 * Factory function
 */
export function createSilhouetteExtractor(): SilhouetteExtractor {
  return new SilhouetteExtractor();
}
