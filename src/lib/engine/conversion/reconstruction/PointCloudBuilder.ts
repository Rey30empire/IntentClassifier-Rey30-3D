/**
 * NEXUS Engine - Point Cloud Builder
 * 
 * Sistema para construcción de nubes de puntos desde múltiples fuentes:
 * - Múltiples imágenes (Structure from Motion)
 * - Videos (Frame extraction + SfM)
 * - Depth maps
 * - Silhouettes (visual hull)
 */

import {
  Vec3,
  RGBA,
  Point2D,
  Point3D,
  PointCloud,
  BoundingBox3D,
  DetectedKeypoint,
  FeatureMatch,
  EstimatedCameraPose,
  ImportedImage,
  ExtractedFrame,
  PhotoSet,
  QualityLevel,
  generateId,
  emptyBoundingBox3D,
  mergeBoundingBox3D,
} from '../types';

// ============================================
// FEATURE DETECTION TYPES
// ============================================

/** Descriptor de feature */
export interface FeatureDescriptor {
  keypointId: string;
  descriptor: Float32Array;
  sourceImageId: string;
}

/** Match entre dos imágenes */
export interface ImageMatch {
  imageId1: string;
  imageId2: string;
  matches: FeatureMatch[];
  fundamentalMatrix?: number[];
  essentialMatrix?: number[];
  homography?: number[];
  inlierRatio: number;
}

/** Par estéreo */
export interface StereoPair {
  imageId1: string;
  imageId2: string;
  baseline: number;
  rotation: number[];
  translation: Vec3;
  matches: FeatureMatch[];
}

/** Punto 3D triangulado */
export interface TriangulatedPoint {
  position: Vec3;
  color?: RGBA;
  sourceKeypointIds: string[];
  reprojectionError: number;
  confidence: number;
}

/** Track de feature (mismo punto en múltiples imágenes) */
export interface FeatureTrack {
  id: string;
  observations: Array<{
    imageId: string;
    keypointId: string;
    position: Point2D;
  }>;
  point3D?: Vec3;
  color?: RGBA;
}

// ============================================
// SfM STATE
// ============================================

/** Estado de Structure from Motion */
export interface SfMState {
  // Imágenes registradas
  registeredImages: Set<string>;
  
  // Cámaras estimadas
  cameras: Map<string, EstimatedCameraPose>;
  
  // Puntos 3D
  points: TriangulatedPoint[];
  
  // Tracks de features
  tracks: Map<string, FeatureTrack>;
  
  // Estadísticas
  stats: SfMStats;
}

/** Estadísticas de SfM */
export interface SfMStats {
  totalImages: number;
  registeredImages: number;
  totalKeypoints: number;
  totalMatches: number;
  totalTracks: number;
  triangulatedPoints: number;
  meanReprojectionError: number;
  bundleAdjustmentIterations: number;
}

/** Configuración de PointCloudBuilder */
export interface PointCloudBuilderConfig {
  // Feature detection
  maxFeaturesPerImage: number;
  featureType: 'sift' | 'orb' | 'akaze' | 'brisk';
  featureThreshold: number;
  
  // Feature matching
  matchRatioThreshold: number;
  matchDistanceThreshold: number;
  crossCheckEnabled: boolean;
  
  // SfM
  minInlierRatio: number;
  minTriangulationAngle: number;
  maxReprojectionError: number;
  bundleAdjustmentEnabled: boolean;
  bundleAdjustmentIterations: number;
  
  // Point cloud
  minTrackLength: number;
  pointCloudDensity: 'sparse' | 'semi-dense' | 'dense';
  outlierRemovalEnabled: boolean;
  outlierThreshold: number;
  
  // Performance
  useGPU: boolean;
  parallelProcessing: boolean;
  maxWorkers: number;
}

// ============================================
// POINT CLOUD BUILDER
// ============================================

/**
 * Constructor de nubes de puntos
 */
export class PointCloudBuilder {
  private config: PointCloudBuilderConfig;
  private keypoints: Map<string, DetectedKeypoint[]> = new Map();
  private descriptors: Map<string, Float32Array[]> = new Map();
  private matches: Map<string, ImageMatch[]> = new Map();
  private sfmState: SfMState | null = null;
  
  constructor(config?: Partial<PointCloudBuilderConfig>) {
    this.config = {
      maxFeaturesPerImage: 8000,
      featureType: 'sift',
      featureThreshold: 0.01,
      matchRatioThreshold: 0.75,
      matchDistanceThreshold: 0.7,
      crossCheckEnabled: true,
      minInlierRatio: 0.25,
      minTriangulationAngle: 2.0,
      maxReprojectionError: 4.0,
      bundleAdjustmentEnabled: true,
      bundleAdjustmentIterations: 10,
      minTrackLength: 2,
      pointCloudDensity: 'semi-dense',
      outlierRemovalEnabled: true,
      outlierThreshold: 2.0,
      useGPU: false,
      parallelProcessing: true,
      maxWorkers: 4,
      ...config,
    };
  }
  
  // ============================================
  // FEATURE DETECTION
  // ============================================
  
  /**
   * Detectar keypoints en una imagen
   * Nota: En producción usaría OpenCV.js o similar
   */
  async detectKeypoints(image: ImportedImage): Promise<DetectedKeypoint[]> {
    const keypoints: DetectedKeypoint[] = [];
    
    // Simulación de detección de features
    // En producción: usar SIFT, ORB, AKAZE, etc.
    if (image.imageData) {
      const { width, height, data } = image.imageData;
      
      // Detección simplificada basada en gradientes
      const step = Math.max(4, Math.floor(Math.sqrt(width * height / this.config.maxFeaturesPerImage)));
      
      for (let y = step; y < height - step; y += step) {
        for (let x = step; x < width - step; x += step) {
          const idx = (y * width + x) * 4;
          
          // Calcular gradiente simple
          const gx = Math.abs(data[idx + 4] - data[idx - 4]);
          const gy = Math.abs(data[idx + width * 4] - data[idx - width * 4]);
          const gradient = Math.sqrt(gx * gx + gy * gy);
          
          if (gradient > 30) { // Threshold de gradiente
            keypoints.push({
              id: generateId(),
              position: { x, y },
              scale: 1.0,
              angle: Math.atan2(gy, gx),
              response: gradient,
              octave: 0,
            });
          }
        }
      }
    }
    
    // Limitar número de features
    keypoints.sort((a, b) => b.response - a.response);
    const limitedKeypoints = keypoints.slice(0, this.config.maxFeaturesPerImage);
    
    this.keypoints.set(image.id, limitedKeypoints);
    return limitedKeypoints;
  }
  
  /**
   * Extraer descriptores para keypoints
   */
  async extractDescriptors(
    image: ImportedImage,
    keypoints: DetectedKeypoint[]
  ): Promise<Float32Array[]> {
    const descriptors: Float32Array[] = [];
    const descriptorSize = 128; // SIFT-style descriptor
    
    if (image.imageData) {
      const { width, height, data } = image.imageData;
      
      for (const kp of keypoints) {
        const descriptor = new Float32Array(descriptorSize);
        
        // Extraer parche alrededor del keypoint
        const patchSize = 16;
        const halfPatch = patchSize / 2;
        const x = Math.floor(kp.position.x);
        const y = Math.floor(kp.position.y);
        
        // Simplificación: extraer valores de intensidad del parche
        for (let i = 0; i < patchSize; i++) {
          for (let j = 0; j < patchSize; j++) {
            const px = Math.min(width - 1, Math.max(0, x + j - halfPatch));
            const py = Math.min(height - 1, Math.max(0, y + i - halfPatch));
            const idx = (py * width + px) * 4;
            
            const intensity = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            const descIdx = i * 8 + Math.floor(j / 2);
            if (descIdx < descriptorSize) {
              descriptor[descIdx] = intensity / 255;
            }
          }
        }
        
        // Normalizar descriptor
        let norm = 0;
        for (let i = 0; i < descriptorSize; i++) {
          norm += descriptor[i] * descriptor[i];
        }
        norm = Math.sqrt(norm) || 1;
        for (let i = 0; i < descriptorSize; i++) {
          descriptor[i] /= norm;
        }
        
        descriptors.push(descriptor);
      }
    }
    
    this.descriptors.set(image.id, descriptors);
    return descriptors;
  }
  
  // ============================================
  // FEATURE MATCHING
  // ============================================
  
  /**
   * Encontrar matches entre dos imágenes
   */
  async matchFeatures(
    imageId1: string,
    imageId2: string
  ): Promise<ImageMatch> {
    const keypoints1 = this.keypoints.get(imageId1) || [];
    const keypoints2 = this.keypoints.get(imageId2) || [];
    const descriptors1 = this.descriptors.get(imageId1) || [];
    const descriptors2 = this.descriptors.get(imageId2) || [];
    
    const matches: FeatureMatch[] = [];
    
    // Para cada descriptor en imagen 1, encontrar mejor match en imagen 2
    for (let i = 0; i < descriptors1.length; i++) {
      const desc1 = descriptors1[i];
      let bestDist = Infinity;
      let secondBestDist = Infinity;
      let bestIdx = -1;
      
      // Calcular distancias
      for (let j = 0; j < descriptors2.length; j++) {
        const desc2 = descriptors2[j];
        let dist = 0;
        
        // Distancia L2
        for (let k = 0; k < desc1.length; k++) {
          const diff = desc1[k] - desc2[k];
          dist += diff * diff;
        }
        dist = Math.sqrt(dist);
        
        if (dist < bestDist) {
          secondBestDist = bestDist;
          bestDist = dist;
          bestIdx = j;
        } else if (dist < secondBestDist) {
          secondBestDist = dist;
        }
      }
      
      // Ratio test (Lowe's ratio test)
      if (bestIdx >= 0 && bestDist < this.config.matchDistanceThreshold) {
        if (this.config.crossCheckEnabled) {
          // Cross-check: verificar que el match es recíproco
          // Simplificación: solo aplicar ratio test
        }
        
        if (bestDist / secondBestDist < this.config.matchRatioThreshold) {
          matches.push({
            queryKeypointId: keypoints1[i].id,
            trainKeypointId: keypoints2[bestIdx].id,
            distance: bestDist,
          });
        }
      }
    }
    
    // Calcular ratio de inliers (simplificado)
    const inlierRatio = matches.length > 0 ? 0.7 : 0; // Placeholder
    
    const imageMatch: ImageMatch = {
      imageId1,
      imageId2,
      matches,
      inlierRatio,
    };
    
    // Guardar matches
    if (!this.matches.has(imageId1)) {
      this.matches.set(imageId1, []);
    }
    this.matches.get(imageId1)!.push(imageMatch);
    
    return imageMatch;
  }
  
  /**
   * Encontrar todos los matches para un conjunto de imágenes
   */
  async matchAllFeatures(imageIds: string[]): Promise<Map<string, ImageMatch[]>> {
    const allMatches = new Map<string, ImageMatch[]>();
    
    for (let i = 0; i < imageIds.length; i++) {
      for (let j = i + 1; j < imageIds.length; j++) {
        const match = await this.matchFeatures(imageIds[i], imageIds[j]);
        
        if (!allMatches.has(imageIds[i])) {
          allMatches.set(imageIds[i], []);
        }
        allMatches.get(imageIds[i])!.push(match);
      }
    }
    
    return allMatches;
  }
  
  // ============================================
  // STRUCTURE FROM MOTION
  // ============================================
  
  /**
   * Inicializar estado de SfM
   */
  private initializeSfMState(totalImages: number): SfMState {
    return {
      registeredImages: new Set(),
      cameras: new Map(),
      points: [],
      tracks: new Map(),
      stats: {
        totalImages,
        registeredImages: 0,
        totalKeypoints: 0,
        totalMatches: 0,
        totalTracks: 0,
        triangulatedPoints: 0,
        meanReprojectionError: 0,
        bundleAdjustmentIterations: 0,
      },
    };
  }
  
  /**
   * Construir tracks de features
   */
  private buildFeatureTracks(imageIds: string[]): Map<string, FeatureTrack> {
    const tracks = new Map<string, FeatureTrack>();
    const keypointToTrack = new Map<string, string>();
    
    for (const imageId of imageIds) {
      const imageMatches = this.matches.get(imageId) || [];
      const keypoints = this.keypoints.get(imageId) || [];
      
      // Inicializar tracks para keypoints no matched
      for (const kp of keypoints) {
        const key = `${imageId}_${kp.id}`;
        if (!keypointToTrack.has(key)) {
          const trackId = generateId();
          const track: FeatureTrack = {
            id: trackId,
            observations: [{
              imageId,
              keypointId: kp.id,
              position: kp.position,
            }],
          };
          tracks.set(trackId, track);
          keypointToTrack.set(key, trackId);
        }
      }
      
      // Unir tracks basado en matches
      for (const match of imageMatches) {
        for (const fm of match.matches) {
          const key1 = `${match.imageId1}_${fm.queryKeypointId}`;
          const key2 = `${match.imageId2}_${fm.trainKeypointId}`;
          
          const trackId1 = keypointToTrack.get(key1);
          const trackId2 = keypointToTrack.get(key2);
          
          if (trackId1 && trackId2 && trackId1 !== trackId2) {
            // Merge tracks
            const track1 = tracks.get(trackId1)!;
            const track2 = tracks.get(trackId2)!;
            
            track1.observations.push(...track2.observations);
            tracks.delete(trackId2);
            
            // Actualizar mapeo
            for (const obs of track2.observations) {
              keypointToTrack.set(`${obs.imageId}_${obs.keypointId}`, trackId1);
            }
          } else if (!trackId1 && !trackId2) {
            // Crear nuevo track
            const trackId = generateId();
            const kp1 = this.keypoints.get(match.imageId1)?.find(k => k.id === fm.queryKeypointId);
            const kp2 = this.keypoints.get(match.imageId2)?.find(k => k.id === fm.trainKeypointId);
            
            const track: FeatureTrack = {
              id: trackId,
              observations: [],
            };
            
            if (kp1) {
              track.observations.push({
                imageId: match.imageId1,
                keypointId: kp1.id,
                position: kp1.position,
              });
              keypointToTrack.set(`${match.imageId1}_${kp1.id}`, trackId);
            }
            
            if (kp2) {
              track.observations.push({
                imageId: match.imageId2,
                keypointId: kp2.id,
                position: kp2.position,
              });
              keypointToTrack.set(`${match.imageId2}_${kp2.id}`, trackId);
            }
            
            tracks.set(trackId, track);
          }
        }
      }
    }
    
    return tracks;
  }
  
  /**
   * Estimar matriz fundamental entre dos imágenes
   */
  private estimateFundamentalMatrix(
    points1: Point2D[],
    points2: Point2D[]
  ): { matrix: number[]; inliers: number[] } {
    // Simplificación: usar 8-point algorithm
    // En producción: usar RANSAC
    
    const n = Math.min(points1.length, points2.length);
    if (n < 8) {
      return { matrix: new Array(9).fill(0), inliers: [] };
    }
    
    // Normalizar puntos
    const mean1 = { x: 0, y: 0 };
    const mean2 = { x: 0, y: 0 };
    
    for (let i = 0; i < n; i++) {
      mean1.x += points1[i].x;
      mean1.y += points1[i].y;
      mean2.x += points2[i].x;
      mean2.y += points2[i].y;
    }
    
    mean1.x /= n;
    mean1.y /= n;
    mean2.x /= n;
    mean2.y /= n;
    
    // Construir matriz A para SVD
    // Simplificación: retornar matriz identidad
    const matrix = [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ];
    
    // Todos los puntos como inliers (simplificación)
    const inliers = Array.from({ length: n }, (_, i) => i);
    
    return { matrix, inliers };
  }
  
  /**
   * Estimar pose de cámara desde matriz esencial
   */
  private estimateCameraPose(
    essentialMatrix: number[],
    points1: Point2D[],
    points2: Point2D[]
  ): { rotation: number[]; translation: Vec3 } {
    // Simplificación: retornar pose por defecto
    // En producción: decomponer E y verificar triangulación
    
    return {
      rotation: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
      ],
      translation: { x: 1, y: 0, z: 0 }, // Baseline unitario
    };
  }
  
  /**
   * Triangular puntos desde dos vistas
   */
  private triangulatePoints(
    camera1: EstimatedCameraPose,
    camera2: EstimatedCameraPose,
    points1: Point2D[],
    points2: Point2D[]
  ): TriangulatedPoint[] {
    const triangulatedPoints: TriangulatedPoint[] = [];
    
    for (let i = 0; i < points1.length; i++) {
      // Simplificación: triangulación lineal DLT
      // En producción: usar triangulación robusta
      
      const p1 = points1[i];
      const p2 = points2[i];
      
      // Rayos desde cada cámara
      const ray1 = this.pixelToRay(p1, camera1);
      const ray2 = this.pixelToRay(p2, camera2);
      
      // Punto más cercano entre rayos
      const point = this.closestPointBetweenRays(
        camera1.position,
        ray1,
        camera2.position,
        ray2
      );
      
      if (point) {
        triangulatedPoints.push({
          position: point,
          sourceKeypointIds: [],
          reprojectionError: 0.5, // Placeholder
          confidence: 0.8,
        });
      }
    }
    
    return triangulatedPoints;
  }
  
  /**
   * Convertir pixel a rayo
   */
  private pixelToRay(pixel: Point2D, camera: EstimatedCameraPose): Vec3 {
    // Simplificación: asumir FOV conocido
    const fov = camera.fov || 60;
    const aspect = camera.aspectRatio || 1;
    
    const x = (pixel.x * 2 - 1) * Math.tan(fov * Math.PI / 360);
    const y = (pixel.y * 2 - 1) * Math.tan(fov * Math.PI / 360) / aspect;
    
    // Rotar según orientación de cámara
    // Simplificación: retornar dirección sin rotar
    const len = Math.sqrt(x * x + y * y + 1);
    return {
      x: x / len,
      y: y / len,
      z: 1 / len,
    };
  }
  
  /**
   * Encontrar punto más cercano entre dos rayos
   */
  private closestPointBetweenRays(
    origin1: Vec3,
    dir1: Vec3,
    origin2: Vec3,
    dir2: Vec3
  ): Vec3 | null {
    const d = {
      x: origin2.x - origin1.x,
      y: origin2.y - origin1.y,
      z: origin2.z - origin1.z,
    };
    
    const a = dir1.x * dir1.x + dir1.y * dir1.y + dir1.z * dir1.z;
    const b = dir1.x * dir2.x + dir1.y * dir2.y + dir1.z * dir2.z;
    const c = dir2.x * dir2.x + dir2.y * dir2.y + dir2.z * dir2.z;
    const f = dir1.x * d.x + dir1.y * d.y + dir1.z * d.z;
    const g = dir2.x * d.x + dir2.y * d.y + dir2.z * d.z;
    
    const denom = a * c - b * b;
    if (Math.abs(denom) < 1e-10) return null;
    
    const t = (c * f - b * g) / denom;
    
    return {
      x: origin1.x + t * dir1.x,
      y: origin1.y + t * dir1.y,
      z: origin1.z + t * dir1.z,
    };
  }
  
  /**
   * Ejecutar Structure from Motion incremental
   */
  async runIncrementalSfM(imageIds: string[]): Promise<SfMState> {
    const state = this.initializeSfMState(imageIds.length);
    
    // Construir tracks
    state.tracks = this.buildFeatureTracks(imageIds);
    state.stats.totalTracks = state.tracks.size;
    
    // Encontrar mejor par inicial
    let bestPair: { id1: string; id2: string; matchCount: number } | null = null;
    
    for (const [id1, matches] of this.matches) {
      for (const match of matches) {
        if (match.matches.length > (bestPair?.matchCount || 0)) {
          bestPair = { id1, id2: match.imageId2, matchCount: match.matches.length };
        }
      }
    }
    
    if (!bestPair) {
      console.warn('No suitable image pair found for initialization');
      return state;
    }
    
    // Inicializar con el mejor par
    const camera1: EstimatedCameraPose = {
      id: bestPair.id1,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      fov: 60,
      aspectRatio: 16 / 9,
      confidence: 1,
    };
    
    state.cameras.set(bestPair.id1, camera1);
    state.registeredImages.add(bestPair.id1);
    
    // Estimar pose de segunda cámara
    const match = this.matches.get(bestPair.id1)?.find(m => m.imageId2 === bestPair!.id2);
    if (match) {
      const kp1 = this.keypoints.get(bestPair.id1) || [];
      const kp2 = this.keypoints.get(bestPair.id2) || [];
      
      const points1: Point2D[] = [];
      const points2: Point2D[] = [];
      
      for (const fm of match.matches) {
        const p1 = kp1.find(k => k.id === fm.queryKeypointId);
        const p2 = kp2.find(k => k.id === fm.trainKeypointId);
        if (p1 && p2) {
          points1.push(p1.position);
          points2.push(p2.position);
        }
      }
      
      // Estimar matriz fundamental
      const { matrix: F, inliers } = this.estimateFundamentalMatrix(points1, points2);
      
      // Estimar pose
      const { rotation, translation } = this.estimateCameraPose(F, points1, points2);
      
      // Convertir a quaternion (simplificación)
      const camera2: EstimatedCameraPose = {
        id: bestPair.id2,
        position: translation,
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        fov: 60,
        aspectRatio: 16 / 9,
        confidence: 0.9,
      };
      
      state.cameras.set(bestPair.id2, camera2);
      state.registeredImages.add(bestPair.id2);
      
      // Triangular puntos iniciales
      const triangulated = this.triangulatePoints(camera1, camera2, points1, points2);
      state.points.push(...triangulated);
    }
    
    // Registrar imágenes restantes
    for (const imageId of imageIds) {
      if (state.registeredImages.has(imageId)) continue;
      
      // Encontrar imagen con más matches con imágenes ya registradas
      let bestMatch: { registeredId: string; match: ImageMatch } | null = null;
      
      for (const registeredId of state.registeredImages) {
        const matches = this.matches.get(registeredId) || [];
        for (const match of matches) {
          if (match.imageId2 === imageId && match.matches.length > (bestMatch?.match.matches.length || 0)) {
            bestMatch = { registeredId, match };
          }
        }
      }
      
      if (bestMatch && bestMatch.match.matches.length >= 6) {
        // Resolver PnP para estimar pose
        // Simplificación: estimar pose basada en puntos 2D-3D
        
        const kp = this.keypoints.get(imageId) || [];
        const registeredCam = state.cameras.get(bestMatch.registeredId)!;
        
        // Estimar nueva pose
        const newCamera: EstimatedCameraPose = {
          id: imageId,
          position: {
            x: registeredCam.position.x + 0.5,
            y: registeredCam.position.y,
            z: registeredCam.position.z + 0.5,
          },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          fov: 60,
          aspectRatio: 16 / 9,
          confidence: 0.7,
        };
        
        state.cameras.set(imageId, newCamera);
        state.registeredImages.add(imageId);
        
        // Triangular nuevos puntos
        const points1: Point2D[] = [];
        const points2: Point2D[] = [];
        const kp2 = this.keypoints.get(bestMatch.registeredId) || [];
        
        for (const fm of bestMatch.match.matches.slice(0, 100)) {
          const p1 = kp.find(k => k.id === fm.trainKeypointId);
          const p2 = kp2.find(k => k.id === fm.queryKeypointId);
          if (p1 && p2) {
            points1.push(p1.position);
            points2.push(p2.position);
          }
        }
        
        const triangulated = this.triangulatePoints(newCamera, registeredCam, points1, points2);
        state.points.push(...triangulated);
      }
    }
    
    // Bundle adjustment (simplificado)
    if (this.config.bundleAdjustmentEnabled) {
      await this.bundleAdjustment(state);
    }
    
    // Remover outliers
    if (this.config.outlierRemovalEnabled) {
      this.removeOutliers(state);
    }
    
    state.stats.registeredImages = state.registeredImages.size;
    state.stats.triangulatedPoints = state.points.length;
    
    this.sfmState = state;
    return state;
  }
  
  /**
   * Bundle adjustment simplificado
   */
  private async bundleAdjustment(state: SfMState): Promise<void> {
    // En producción: usar Ceres Solver o similar
    // Simplificación: iteración de Gauss-Newton básica
    
    for (let iter = 0; iter < this.config.bundleAdjustmentIterations; iter++) {
      // Calcular error de reproyección promedio
      let totalError = 0;
      
      for (const point of state.points) {
        for (const [cameraId, camera] of state.cameras) {
          // Proyectar punto a cámara
          const projected = this.projectPoint(point.position, camera);
          
          // Calcular error (placeholder)
          totalError += point.reprojectionError;
        }
      }
      
      state.stats.meanReprojectionError = totalError / (state.points.length * state.cameras.size || 1);
    }
    
    state.stats.bundleAdjustmentIterations = this.config.bundleAdjustmentIterations;
  }
  
  /**
   * Proyectar punto 3D a imagen
   */
  private projectPoint(point: Vec3, camera: EstimatedCameraPose): Point2D {
    // Simplificación: proyección perspectiva simple
    const dx = point.x - camera.position.x;
    const dy = point.y - camera.position.y;
    const dz = point.z - camera.position.z;
    
    const fov = camera.fov || 60;
    const scale = 1 / Math.tan(fov * Math.PI / 360);
    
    // Asumir dz positivo (punto frente a cámara)
    const z = Math.max(dz, 0.001);
    
    return {
      x: (dx / z * scale + 1) / 2,
      y: (dy / z * scale + 1) / 2,
    };
  }
  
  /**
   * Remover outliers
   */
  private removeOutliers(state: SfMState): void {
    const threshold = this.config.outlierThreshold;
    
    // Filtrar puntos con alto error de reproyección
    state.points = state.points.filter(p => p.reprojectionError < threshold);
    
    // Filtrar puntos fuera del cluster principal
    if (state.points.length > 10) {
      // Calcular centro y desviación
      let cx = 0, cy = 0, cz = 0;
      for (const p of state.points) {
        cx += p.position.x;
        cy += p.position.y;
        cz += p.position.z;
      }
      cx /= state.points.length;
      cy /= state.points.length;
      cz /= state.points.length;
      
      let maxDist = 0;
      for (const p of state.points) {
        const dist = Math.sqrt(
          (p.position.x - cx) ** 2 +
          (p.position.y - cy) ** 2 +
          (p.position.z - cz) ** 2
        );
        maxDist = Math.max(maxDist, dist);
      }
      
      // Remover puntos muy lejanos
      const outlierThreshold = maxDist * 0.95;
      state.points = state.points.filter(p => {
        const dist = Math.sqrt(
          (p.position.x - cx) ** 2 +
          (p.position.y - cy) ** 2 +
          (p.position.z - cz) ** 2
        );
        return dist < outlierThreshold;
      });
    }
  }
  
  // ============================================
  // DENSE RECONSTRUCTION
  // ============================================
  
  /**
   * Generar nube de puntos densa mediante Multi-View Stereo
   */
  async generateDensePointCloud(
    images: ImportedImage[],
    sfmState: SfMState
  ): Promise<PointCloud> {
    const points: Point3D[] = [];
    const sourcePhotoIds = images.map(i => i.id);
    
    // Para cada par estéreo, generar puntos densos
    const cameraArray = Array.from(sfmState.cameras.values());
    
    for (let i = 0; i < cameraArray.length; i++) {
      for (let j = i + 1; j < cameraArray.length; j++) {
        const cam1 = cameraArray[i];
        const cam2 = cameraArray[j];
        
        // Calcular baseline
        const baseline = Math.sqrt(
          (cam2.position.x - cam1.position.x) ** 2 +
          (cam2.position.y - cam1.position.y) ** 2 +
          (cam2.position.z - cam1.position.z) ** 2
        );
        
        // Solo procesar pares con baseline adecuado
        if (baseline > 0.1 && baseline < 5) {
          const img1 = images.find(img => img.id === cam1.id);
          const img2 = images.find(img => img.id === cam2.id);
          
          if (img1 && img2) {
            const densePoints = await this.stereoMatching(img1, img2, cam1, cam2);
            points.push(...densePoints);
          }
        }
      }
    }
    
    // Calcular bounds
    const bounds = this.calculateBounds(points);
    
    // Calcular densidad
    const volume = (bounds.max.x - bounds.min.x) *
                   (bounds.max.y - bounds.min.y) *
                   (bounds.max.z - bounds.min.z);
    const density = points.length / (volume || 1);
    
    return {
      id: generateId(),
      points,
      bounds,
      density,
      sourcePhotoIds,
    };
  }
  
  /**
   * Matching estéreo para generar puntos densos
   */
  private async stereoMatching(
    img1: ImportedImage,
    img2: ImportedImage,
    cam1: EstimatedCameraPose,
    cam2: EstimatedCameraPose
  ): Promise<Point3D[]> {
    const points: Point3D[] = [];
    
    if (!img1.imageData || !img2.imageData) return points;
    
    const { width: w1, height: h1, data: d1 } = img1.imageData;
    const { width: w2, height: h2, data: d2 } = img2.imageData;
    
    // Simplificación: matching por bloques
    const blockSize = 5;
    const step = 10; // Submuestreo
    const maxDisparity = 50;
    
    for (let y = blockSize; y < h1 - blockSize; y += step) {
      for (let x = blockSize; x < w1 - blockSize; x += step) {
        // Buscar mejor match en línea epipolar
        let bestDisparity = 0;
        let bestScore = Infinity;
        
        for (let d = 0; d < maxDisparity; d++) {
          const x2 = x - d;
          if (x2 < blockSize || x2 >= w2 - blockSize) continue;
          
          // Calcular SAD (Sum of Absolute Differences)
          let sad = 0;
          for (let dy = -blockSize; dy <= blockSize; dy++) {
            for (let dx = -blockSize; dx <= blockSize; dx++) {
              const idx1 = ((y + dy) * w1 + (x + dx)) * 4;
              const idx2 = ((y + dy) * w2 + (x2 + dx)) * 4;
              
              sad += Math.abs(d1[idx1] - d2[idx2]);
              sad += Math.abs(d1[idx1 + 1] - d2[idx2 + 1]);
              sad += Math.abs(d1[idx1 + 2] - d2[idx2 + 2]);
            }
          }
          
          if (sad < bestScore) {
            bestScore = sad;
            bestDisparity = d;
          }
        }
        
        // Si encontramos buen match, triangular
        if (bestScore < 1000 && bestDisparity > 0) {
          // Calcular profundidad desde disparity
          const baseline = Math.sqrt(
            (cam2.position.x - cam1.position.x) ** 2 +
            (cam2.position.y - cam1.position.y) ** 2 +
            (cam2.position.z - cam1.position.z) ** 2
          );
          const focalLength = w1 / (2 * Math.tan((cam1.fov || 60) * Math.PI / 360));
          const depth = (baseline * focalLength) / bestDisparity;
          
          if (depth > 0.1 && depth < 100) {
            // Calcular posición 3D
            const nx = (x / w1 - 0.5) * 2;
            const ny = (y / h1 - 0.5) * 2;
            
            const point: Point3D = {
              position: {
                x: cam1.position.x + nx * depth,
                y: cam1.position.y + ny * depth,
                z: cam1.position.z + depth,
              },
              color: {
                r: d1[(y * w1 + x) * 4] / 255,
                g: d1[(y * w1 + x) * 4 + 1] / 255,
                b: d1[(y * w1 + x) * 4 + 2] / 255,
                a: 1,
              },
              sourceViewIds: [img1.id, img2.id],
            };
            
            points.push(point);
          }
        }
      }
    }
    
    return points;
  }
  
  // ============================================
  // POINT CLOUD FROM SILHOUETTES (Visual Hull)
  // ============================================
  
  /**
   * Construir Visual Hull desde siluetas
   */
  buildFromSilhouettes(
    silhouettes: Array<{
      imageId: string;
      silhouette: boolean[];
      camera: EstimatedCameraPose;
      width: number;
      height: number;
    }>,
    resolution: number = 64
  ): PointCloud {
    const points: Point3D[] = [];
    
    // Calcular bounds de todas las cámaras
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (const sil of silhouettes) {
      minX = Math.min(minX, sil.camera.position.x - 5);
      minY = Math.min(minY, sil.camera.position.y - 5);
      minZ = Math.min(minZ, sil.camera.position.z - 5);
      maxX = Math.max(maxX, sil.camera.position.x + 5);
      maxY = Math.max(maxY, sil.camera.position.y + 5);
      maxZ = Math.max(maxZ, sil.camera.position.z + 5);
    }
    
    // Voxel grid
    const stepX = (maxX - minX) / resolution;
    const stepY = (maxY - minY) / resolution;
    const stepZ = (maxZ - minZ) / resolution;
    
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        for (let k = 0; k < resolution; k++) {
          const x = minX + i * stepX;
          const y = minY + j * stepY;
          const z = minZ + k * stepZ;
          
          // Verificar si está dentro de todas las siluetas
          let insideAll = true;
          
          for (const sil of silhouettes) {
            // Proyectar voxel a imagen
            const projected = this.projectPoint({ x, y, z }, sil.camera);
            
            const px = Math.floor(projected.x * sil.width);
            const py = Math.floor(projected.y * sil.height);
            
            if (px >= 0 && px < sil.width && py >= 0 && py < sil.height) {
              const idx = py * sil.width + px;
              if (!sil.silhouette[idx]) {
                insideAll = false;
                break;
              }
            } else {
              insideAll = false;
              break;
            }
          }
          
          if (insideAll) {
            points.push({
              position: { x, y, z },
            });
          }
        }
      }
    }
    
    const bounds = {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    };
    
    const volume = (maxX - minX) * (maxY - minY) * (maxZ - minZ);
    const density = points.length / volume;
    
    return {
      id: generateId(),
      points,
      bounds,
      density,
      sourcePhotoIds: silhouettes.map(s => s.imageId),
    };
  }
  
  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  /**
   * Calcular bounds de una nube de puntos
   */
  private calculateBounds(points: Point3D[]): BoundingBox3D {
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
   * Combinar múltiples nubes de puntos
   */
  mergePointClouds(clouds: PointCloud[]): PointCloud {
    const allPoints: Point3D[] = [];
    const allSourceIds: string[] = [];
    
    for (const cloud of clouds) {
      allPoints.push(...cloud.points);
      allSourceIds.push(...cloud.sourcePhotoIds);
    }
    
    const bounds = this.calculateBounds(allPoints);
    const volume = (bounds.max.x - bounds.min.x) *
                   (bounds.max.y - bounds.min.y) *
                   (bounds.max.z - bounds.min.z);
    const density = allPoints.length / (volume || 1);
    
    return {
      id: generateId(),
      points: allPoints,
      bounds,
      density,
      sourcePhotoIds: [...new Set(allSourceIds)],
    };
  }
  
  /**
   * Subsamplear nube de puntos
   */
  subsamplePointCloud(cloud: PointCloud, targetCount: number): PointCloud {
    if (cloud.points.length <= targetCount) {
      return { ...cloud };
    }
    
    // Random sampling
    const step = cloud.points.length / targetCount;
    const sampledPoints: Point3D[] = [];
    
    for (let i = 0; i < targetCount; i++) {
      const idx = Math.floor(i * step);
      sampledPoints.push(cloud.points[idx]);
    }
    
    const bounds = this.calculateBounds(sampledPoints);
    const volume = (bounds.max.x - bounds.min.x) *
                   (bounds.max.y - bounds.min.y) *
                   (bounds.max.z - bounds.min.z);
    
    return {
      id: generateId(),
      points: sampledPoints,
      bounds,
      density: sampledPoints.length / (volume || 1),
      sourcePhotoIds: cloud.sourcePhotoIds,
    };
  }
  
  /**
   * Obtener estado de SfM
   */
  getSfMState(): SfMState | null {
    return this.sfmState;
  }
  
  /**
   * Limpiar datos internos
   */
  clear(): void {
    this.keypoints.clear();
    this.descriptors.clear();
    this.matches.clear();
    this.sfmState = null;
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createPointCloudBuilder(config?: Partial<PointCloudBuilderConfig>): PointCloudBuilder {
  return new PointCloudBuilder(config);
}

export default PointCloudBuilder;
