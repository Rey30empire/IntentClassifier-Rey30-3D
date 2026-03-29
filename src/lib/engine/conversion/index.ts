/**
 * NEXUS Engine - 2D/3D Conversion System
 * 
 * Sistema completo de conversión 2D/3D para el motor NEXUS
 * 
 * Este módulo permite crear contenido 3D a partir de múltiples tipos de entrada:
 * - Dibujos 2D (single view y multi-view)
 * - Imágenes (single y multi-view)
 * - Fotos para fotogrametría
 * - Videos para reconstrucción
 * - Escaneos de escenas
 */

// ============================================
// TYPES
// ============================================

export * from './types';

// ============================================
// INPUT LAYER
// ============================================

export { SketchInputSystem, createSketchInputSystem } from './input/SketchInputSystem';
export type { SerializedSketchSession } from './input/SketchInputSystem';

export { ImageImportSystem, createImageImportSystem } from './input/ImageImportSystem';

export { VideoImportSystem, createVideoImportSystem } from './input/VideoImportSystem';

// ============================================
// PREPROCESSING LAYER
// ============================================

export { SilhouetteExtractor, createSilhouetteExtractor } from './preprocessing/SilhouetteExtractor';

// ============================================
// INTERPRETATION LAYER
// ============================================

export { IntentClassifier, createIntentClassifier } from './interpretation/IntentClassifier';

// ============================================
// TEMPLATE GENERATION LAYER
// ============================================

export { Template3DGenerator, createTemplate3DGenerator } from './template/Template3DGenerator';

// ============================================
// INTERNAL REPRESENTATION LAYER
// ============================================

export {
  EditableMesh,
  createEditableMesh,
  createEditableMeshFromData,
} from './representation/EditableMesh';
export type { SerializedEditableMesh } from './representation/EditableMesh';

// ============================================
// PIPELINES
// ============================================

export {
  Sketch2DTo3DSinglePipeline,
  MultiViewSketchPipeline,
  ImageTo3DSinglePipeline,
  PhotogrammetryPipeline,
  VideoReconstructionPipeline,
  SceneReconstructionPipeline,
  getPipeline,
} from './pipelines/ConversionPipelines';
export type { IConversionPipeline } from './pipelines/ConversionPipelines';

// ============================================
// GEOMETRY RECONSTRUCTION LAYER
// ============================================

export * from './reconstruction';

// ============================================
// POSTPROCESSING LAYER
// ============================================

export * from './postprocessing';

// ============================================
// COMMANDS / HISTORY LAYER
// ============================================

export * from './commands';

// ============================================
// COORDINATOR
// ============================================

export {
  ConversionCoordinator,
  initializeConversionSystem,
  getConversionCoordinator,
  createConversionCoordinator,
} from './ConversionCoordinator';

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

import { getConversionCoordinator } from './ConversionCoordinator';
import type {
  InputType,
  ConversionSession,
  ConversionResult,
  SketchSession,
} from './types';

/**
 * Quick convert from sketch
 */
export async function convertSketch(sketch: SketchSession): Promise<ConversionResult | null> {
  const coordinator = getConversionCoordinator();
  const session = coordinator.createSession('sketch_single');
  coordinator.addSketchInput(session.id, sketch);
  return coordinator.execute(session.id);
}

/**
 * Quick convert from image file
 */
export async function convertImage(file: File): Promise<ConversionResult | null> {
  const coordinator = getConversionCoordinator();
  const session = coordinator.createSession('image_single');
  await coordinator.addImageInput(session.id, file);
  return coordinator.execute(session.id);
}

/**
 * Quick convert from multiple images
 */
export async function convertMultiViewImages(files: File[]): Promise<ConversionResult | null> {
  const coordinator = getConversionCoordinator();
  const session = coordinator.createSession('image_multi');
  await coordinator.addMultiViewImages(session.id, files);
  return coordinator.execute(session.id);
}

/**
 * Quick convert from video
 */
export async function convertVideo(file: File): Promise<ConversionResult | null> {
  const coordinator = getConversionCoordinator();
  const session = coordinator.createSession('video');
  await coordinator.addVideoInput(session.id, file);
  return coordinator.execute(session.id);
}

/**
 * Quick convert from photo set
 */
export async function convertPhotoSet(files: File[]): Promise<ConversionResult | null> {
  const coordinator = getConversionCoordinator();
  const session = coordinator.createSession('photo_set');
  await coordinator.addPhotoSet(session.id, files);
  return coordinator.execute(session.id);
}

// ============================================
// DOCUMENTATION
// ============================================

/**
 * USAGE EXAMPLES:
 * 
 * // 1. Initialize the system
 * import { initializeConversionSystem } from './conversion';
 * const coordinator = initializeConversionSystem();
 * 
 * // 2. Convert a single sketch
 * import { createSketchInputSystem } from './conversion';
 * const sketchSystem = createSketchInputSystem();
 * const sketch = sketchSystem.createSession('MySketch');
 * sketchSystem.captureStroke(sketch.id, points);
 * const result = await coordinator.convertSketch(sketch);
 * 
 * // 3. Convert an image
 * const file = document.querySelector('input[type="file"]').files[0];
 * const result = await coordinator.convertImage(file);
 * 
 * // 4. Multi-view reconstruction
 * const files = Array.from(document.querySelector('input[type="file"]').files);
 * const result = await coordinator.convertMultiViewImages(files);
 * 
 * // 5. Video reconstruction
 * const videoFile = document.querySelector('input[type="file"]').files[0];
 * const result = await coordinator.convertVideo(videoFile);
 * 
 * // 6. Photogrammetry
 * const photoFiles = Array.from(document.querySelector('input[type="file"]').files);
 * const result = await coordinator.convertPhotoSet(photoFiles);
 * 
 * // 7. Access the result
 * if (result && result.mesh) {
 *   console.log('Converted mesh:', result.mesh.name);
 *   console.log('Vertices:', result.mesh.vertices.size);
 *   console.log('Faces:', result.mesh.faces.size);
 *   console.log('Confidence:', result.confidence);
 * }
 */
