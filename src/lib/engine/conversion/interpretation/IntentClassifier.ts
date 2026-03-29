/**
 * NEXUS Engine - Intent Classifier
 * 
 * Clasifica la intención del usuario basándose en el análisis de entrada
 */

import {
  IntentCategory,
  IntentResult,
  DetectedFeature,
  FeatureType,
  SilhouetteData,
  BoundingBox2D,
  QualityLevel,
} from '../types';

/**
 * Intent Classifier
 * 
 * Determina QUÉ quiere crear el usuario basándose en heurísticas geométricas
 */
export class IntentClassifier {
  private categoryPatterns: Map<IntentCategory, CategoryPattern>;

  constructor() {
    this.categoryPatterns = this.initializePatterns();
  }

  /**
   * Classify intent from silhouette
   */
  classifyFromSilhouette(silhouette: SilhouetteData): IntentResult {
    const features = this.detectFeatures(silhouette);
    const scores = this.calculateCategoryScores(silhouette, features);
    const sortedCategories = this.sortCategories(scores);

    const topCategory = sortedCategories[0];
    const confidence = scores.get(topCategory) ?? 0;

    return {
      category: topCategory,
      confidence,
      subcategories: sortedCategories.slice(1, 4),
      features,
      explanation: this.generateExplanation(topCategory, features),
      alternativeSuggestions: sortedCategories.slice(1, 4),
    };
  }

  /**
   * Detect features from silhouette
   */
  private detectFeatures(silhouette: SilhouetteData): DetectedFeature[] {
    const features: DetectedFeature[] = [];
    const { contours, boundingBox } = silhouette;

    if (contours.length === 0) return features;

    const mainContour = contours[0];
    const points = mainContour.points;

    // Detect symmetry
    const symmetry = this.detectSymmetry(points, boundingBox);
    if (symmetry.confidence > 0.5) {
      features.push({
        type: 'symmetry',
        description: `Vertical symmetry detected with ${Math.round(symmetry.confidence * 100)}% confidence`,
        confidence: symmetry.confidence,
      });
    }

    // Detect vertical supports (legs)
    const legs = this.detectLegs(points, boundingBox);
    if (legs.count > 0) {
      features.push({
        type: 'legs',
        description: `${legs.count} vertical supports detected`,
        confidence: legs.confidence,
        location: legs.location,
      });
    }

    // Detect flat surfaces
    const flatSurfaces = this.detectFlatSurfaces(points, boundingBox);
    if (flatSurfaces.count > 0) {
      features.push({
        type: 'flat_surface',
        description: `${flatSurfaces.count} flat surfaces detected`,
        confidence: flatSurfaces.confidence,
        location: flatSurfaces.location,
      });
    }

    // Detect humanoid features
    const humanoid = this.detectHumanoidFeatures(points, boundingBox);
    if (humanoid.confidence > 0.3) {
      features.push({
        type: 'head',
        description: 'Head-like structure detected',
        confidence: humanoid.confidence,
        location: humanoid.headLocation,
      });
      features.push({
        type: 'torso',
        description: 'Torso-like structure detected',
        confidence: humanoid.confidence,
        location: humanoid.torsoLocation,
      });
      if (humanoid.hasArms) {
        features.push({
          type: 'arms',
          description: 'Arm-like appendages detected',
          confidence: humanoid.confidence,
        });
      }
    }

    // Detect wheels
    const wheels = this.detectWheels(points, boundingBox);
    if (wheels.count > 0) {
      features.push({
        type: 'wheels',
        description: `${wheels.count} circular elements detected`,
        confidence: wheels.confidence,
      });
    }

    return features;
  }

  /**
   * Detect vertical symmetry
   */
  private detectSymmetry(points: { x: number; y: number }[], boundingBox: BoundingBox2D): {
    confidence: number;
    axis: 'vertical' | 'horizontal' | 'none';
  } {
    const centerX = (boundingBox.min.x + boundingBox.max.x) / 2;
    const tolerance = (boundingBox.max.x - boundingBox.min.x) * 0.1;

    let matchingPoints = 0;
    let totalPoints = 0;

    for (const point of points) {
      // Find mirrored point
      const mirroredX = 2 * centerX - point.x;
      const hasMatch = points.some(p => 
        Math.abs(p.x - mirroredX) < tolerance && Math.abs(p.y - point.y) < tolerance
      );

      if (hasMatch) matchingPoints++;
      totalPoints++;
    }

    const confidence = totalPoints > 0 ? matchingPoints / totalPoints : 0;

    return {
      confidence,
      axis: confidence > 0.5 ? 'vertical' : 'none',
    };
  }

  /**
   * Detect legs/vertical supports
   */
  private detectLegs(points: { x: number; y: number }[], boundingBox: BoundingBox2D): {
    count: number;
    confidence: number;
    location?: BoundingBox2D;
  } {
    const height = boundingBox.max.y - boundingBox.min.y;
    const width = boundingBox.max.x - boundingBox.min.x;
    const legThreshold = height * 0.3;

    // Look for vertical clusters at the bottom
    const bottomY = boundingBox.max.y;
    const bottomPoints = points.filter(p => p.y > bottomY - legThreshold);

    // Cluster bottom points
    const clusters = this.clusterPoints(bottomPoints, width * 0.15);
    const verticalClusters = clusters.filter(c => {
      const clusterHeight = Math.max(...c.map(p => p.y)) - Math.min(...c.map(p => p.y));
      return clusterHeight > legThreshold * 0.5;
    });

    // Typical furniture has 3-4 legs
    const count = verticalClusters.length;
    let confidence = 0;

    if (count === 4) confidence = 0.8;
    else if (count === 3) confidence = 0.7;
    else if (count >= 2 && count <= 6) confidence = 0.5;

    return {
      count,
      confidence,
      location: count > 0 ? {
        min: { x: boundingBox.min.x, y: bottomY - legThreshold },
        max: { x: boundingBox.max.x, y: bottomY },
      } : undefined,
    };
  }

  /**
   * Detect flat surfaces
   */
  private detectFlatSurfaces(points: { x: number; y: number }[], boundingBox: BoundingBox2D): {
    count: number;
    confidence: number;
    location?: BoundingBox2D;
  } {
    // Look for horizontal runs of points
    const yGroups = new Map<number, { x: number; y: number }[]>();
    const yTolerance = 5;

    for (const point of points) {
      const roundedY = Math.round(point.y / yTolerance) * yTolerance;
      const group = yGroups.get(roundedY) ?? [];
      group.push(point);
      yGroups.set(roundedY, group);
    }

    // Find horizontal runs longer than 30% of width
    const width = boundingBox.max.x - boundingBox.min.x;
    const minWidth = width * 0.3;

    let flatCount = 0;
    let totalFlatWidth = 0;

    for (const [, group] of yGroups) {
      if (group.length < 3) continue;

      // Sort by x and find runs
      const sorted = [...group].sort((a, b) => a.x - b.x);
      let runStart = sorted[0].x;

      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].x - sorted[i - 1].x > 20) {
          // Gap found
          const runWidth = sorted[i - 1].x - runStart;
          if (runWidth > minWidth) {
            flatCount++;
            totalFlatWidth += runWidth;
          }
          runStart = sorted[i].x;
        }
      }

      // Check last run
      const runWidth = sorted[sorted.length - 1].x - runStart;
      if (runWidth > minWidth) {
        flatCount++;
        totalFlatWidth += runWidth;
      }
    }

    const confidence = flatCount > 0 ? Math.min(1, totalFlatWidth / width) : 0;

    return {
      count: flatCount,
      confidence,
    };
  }

  /**
   * Detect humanoid features
   */
  private detectHumanoidFeatures(points: { x: number; y: number }[], boundingBox: BoundingBox2D): {
    confidence: number;
    headLocation?: BoundingBox2D;
    torsoLocation?: BoundingBox2D;
    hasArms: boolean;
  } {
    const height = boundingBox.max.y - boundingBox.min.y;
    const width = boundingBox.max.x - boundingBox.min.x;
    const aspectRatio = height / width;

    // Human figures are typically taller than wide
    if (aspectRatio < 1.2) {
      return { confidence: 0, hasArms: false };
    }

    let confidence = 0;
    let hasArms = false;

    // Check for head (small circle at top)
    const headY = boundingBox.min.y + height * 0.15;
    const headPoints = points.filter(p => p.y < headY);
    const headWidth = headPoints.length > 0 ?
      Math.max(...headPoints.map(p => p.x)) - Math.min(...headPoints.map(p => p.x)) : 0;

    if (headWidth > width * 0.1 && headWidth < width * 0.5) {
      confidence += 0.3;
    }

    // Check for torso (wider section in middle)
    const torsoTop = boundingBox.min.y + height * 0.2;
    const torsoBottom = boundingBox.min.y + height * 0.6;
    const torsoPoints = points.filter(p => p.y >= torsoTop && p.y <= torsoBottom);
    const torsoWidth = torsoPoints.length > 0 ?
      Math.max(...torsoPoints.map(p => p.x)) - Math.min(...torsoPoints.map(p => p.x)) : 0;

    if (torsoWidth > headWidth * 1.2) {
      confidence += 0.3;
    }

    // Check for arms (protrusions from torso)
    const bodyCenterX = (boundingBox.min.x + boundingBox.max.x) / 2;
    const armPoints = torsoPoints.filter(p => 
      Math.abs(p.x - bodyCenterX) > torsoWidth * 0.4
    );
    if (armPoints.length > torsoPoints.length * 0.1) {
      confidence += 0.2;
      hasArms = true;
    }

    return {
      confidence: Math.min(1, confidence),
      headLocation: headPoints.length > 0 ? {
        min: { x: Math.min(...headPoints.map(p => p.x)), y: boundingBox.min.y },
        max: { x: Math.max(...headPoints.map(p => p.x)), y: headY },
      } : undefined,
      torsoLocation: torsoPoints.length > 0 ? {
        min: { x: bodyCenterX - torsoWidth / 2, y: torsoTop },
        max: { x: bodyCenterX + torsoWidth / 2, y: torsoBottom },
      } : undefined,
      hasArms,
    };
  }

  /**
   * Detect wheels
   */
  private detectWheels(points: { x: number; y: number }[], boundingBox: BoundingBox2D): {
    count: number;
    confidence: number;
  } {
    // Look for circular patterns
    const circles = this.detectCircularPatterns(points);
    const wheelSizedCircles = circles.filter(c => {
      const diameter = c.radius * 2;
      const height = boundingBox.max.y - boundingBox.min.y;
      return diameter > height * 0.1 && diameter < height * 0.4;
    });

    const count = wheelSizedCircles.length;
    let confidence = 0;

    if (count >= 2 && count <= 6) confidence = 0.7;
    else if (count >= 1) confidence = 0.4;

    return { count, confidence };
  }

  /**
   * Detect circular patterns using simple clustering
   */
  private detectCircularPatterns(points: { x: number; y: number }[]): Array<{
    center: { x: number; y: number };
    radius: number;
  }> {
    const circles: Array<{ center: { x: number; y: number }; radius: number }> = [];
    const clusters = this.clusterPoints(points, 20);

    for (const cluster of clusters) {
      if (cluster.length < 10) continue;

      // Calculate bounding circle
      const centerX = cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length;
      const centerY = cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length;

      const maxDist = Math.max(...cluster.map(p => 
        Math.sqrt((p.x - centerX) ** 2 + (p.y - centerY) ** 2)
      ));
      const minDist = Math.min(...cluster.map(p => 
        Math.sqrt((p.x - centerX) ** 2 + (p.y - centerY) ** 2)
      ));

      // If distances are similar, it might be a circle
      if (maxDist - minDist < maxDist * 0.3) {
        circles.push({
          center: { x: centerX, y: centerY },
          radius: (maxDist + minDist) / 2,
        });
      }
    }

    return circles;
  }

  /**
   * Cluster points by proximity
   */
  private clusterPoints(points: { x: number; y: number }[], threshold: number): { x: number; y: number }[][] {
    const clusters: { x: number; y: number }[][] = [];
    const visited = new Set<number>();

    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue;

      const cluster: { x: number; y: number }[] = [];
      const queue = [i];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;

        visited.add(current);
        cluster.push(points[current]);

        for (let j = 0; j < points.length; j++) {
          if (visited.has(j)) continue;

          const dist = Math.sqrt(
            (points[j].x - points[current].x) ** 2 +
            (points[j].y - points[current].y) ** 2
          );

          if (dist < threshold) {
            queue.push(j);
          }
        }
      }

      if (cluster.length > 0) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Calculate category scores
   */
  private calculateCategoryScores(
    silhouette: SilhouetteData,
    features: DetectedFeature[]
  ): Map<IntentCategory, number> {
    const scores = new Map<IntentCategory, number>();

    // Initialize all categories
    for (const category of Object.keys(this.categoryPatterns) as IntentCategory[]) {
      scores.set(category, 0);
    }

    // Score based on features
    for (const feature of features) {
      const pattern = this.categoryPatterns.get(feature.type as IntentCategory);
      if (pattern) {
        for (const [category, weight] of pattern.categoryWeights) {
          const currentScore = scores.get(category) ?? 0;
          scores.set(category, currentScore + weight * feature.confidence);
        }
      }
    }

    // Normalize scores
    const maxScore = Math.max(...scores.values());
    if (maxScore > 0) {
      for (const [category, score] of scores) {
        scores.set(category, score / maxScore);
      }
    }

    return scores;
  }

  /**
   * Sort categories by score
   */
  private sortCategories(scores: Map<IntentCategory, number>): IntentCategory[] {
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category);
  }

  /**
   * Generate explanation for classification
   */
  private generateExplanation(category: IntentCategory, features: DetectedFeature[]): string {
    const featureDescriptions = features
      .filter(f => f.confidence > 0.3)
      .map(f => f.description)
      .join(', ');

    return `Classified as "${category}" based on: ${featureDescriptions || 'general shape analysis'}`;
  }

  /**
   * Initialize category patterns
   */
  private initializePatterns(): Map<IntentCategory, CategoryPattern> {
    const patterns = new Map<IntentCategory, CategoryPattern>();

    // Human pattern
    patterns.set('human', {
      categoryWeights: new Map([
        ['human', 1.0],
        ['character', 0.8],
        ['animal', 0.2],
      ]),
    });

    // Furniture patterns
    patterns.set('furniture_chair', {
      categoryWeights: new Map([
        ['furniture_chair', 1.0],
        ['furniture_table', 0.3],
        ['furniture_sofa', 0.4],
      ]),
    });

    // Add more patterns as needed...

    return patterns;
  }
}

interface CategoryPattern {
  categoryWeights: Map<IntentCategory, number>;
}

/**
 * Factory function
 */
export function createIntentClassifier(): IntentClassifier {
  return new IntentClassifier();
}
