/**
 * NEXUS Engine - Conversion Coordinator
 * 
 * Coordina todo el sistema de conversión 2D/3D
 */

import {
  ConversionSession,
  ConversionResult,
  ConversionInput,
  ConversionError,
  ConversionWarning,
  InputType,
  ConversionStatus,
  SketchInput,
  ImageInput,
  VideoInput,
  PhotoSetInput,
  SceneScanInput,
  SketchSession,
  ImportedImage,
  ImportedVideo,
  PhotoSet,
  generateId,
} from './types';
import { getPipeline, IConversionPipeline } from './pipelines/ConversionPipelines';
import { SketchInputSystem, createSketchInputSystem } from './input/SketchInputSystem';
import { ImageImportSystem, createImageImportSystem } from './input/ImageImportSystem';
import { VideoImportSystem, createVideoImportSystem } from './input/VideoImportSystem';

/**
 * Conversion Coordinator
 * 
 * Punto de entrada principal para el sistema de conversión
 */
export class ConversionCoordinator {
  private sessions: Map<string, ConversionSession> = new Map();
  private sketchSystem: SketchInputSystem;
  private imageSystem: ImageImportSystem;
  private videoSystem: VideoImportSystem;

  private eventListeners: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor() {
    this.sketchSystem = createSketchInputSystem();
    this.imageSystem = createImageImportSystem();
    this.videoSystem = createVideoImportSystem();
  }

  // ===== SESSION MANAGEMENT =====

  /**
   * Create a new conversion session
   */
  createSession(inputType: InputType): ConversionSession {
    const session: ConversionSession = {
      id: generateId(),
      inputType,
      inputs: [],
      status: 'pending',
      progress: 0,
      currentStep: 'initializing',
      errors: [],
      warnings: [],
      startedAt: new Date(),
    };

    this.sessions.set(session.id, session);
    this.emit('conversion:started', { sessionId: session.id, inputType });

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ConversionSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ConversionSession[] {
    return Array.from(this.sessions.values());
  }

  // ===== INPUT REGISTRATION =====

  /**
   * Add sketch input to session
   */
  addSketchInput(sessionId: string, sketch: SketchSession): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const input: SketchInput = {
      type: 'sketch',
      session: sketch,
    };

    session.inputs.push(input);
    return true;
  }

  /**
   * Add sketch views for multi-view
   */
  addSketchViews(sessionId: string, views: Array<{ session: SketchSession; label: string; angle: number }>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const input: SketchInput = {
      type: 'sketch',
      session: views[0]?.session ?? this.sketchSystem.createSession(),
      views: views.map(v => ({
        id: generateId(),
        label: v.label as 'front' | 'side_left' | 'side_right' | 'back' | 'top' | 'bottom' | 'perspective' | 'custom',
        angle: v.angle,
        session: v.session,
      })),
    };

    session.inputs = [input];
    return true;
  }

  /**
   * Add image input to session
   */
  async addImageInput(sessionId: string, file: File): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    try {
      const image = await this.imageSystem.importFromFile(file);
      const input: ImageInput = {
        type: 'image',
        image,
      };
      session.inputs.push(input);
      return true;
    } catch (error) {
      session.errors.push({
        code: 'IMPORT_ERROR',
        message: `Failed to import image: ${error}`,
        timestamp: new Date(),
      });
      return false;
    }
  }

  /**
   * Add multiple images for multi-view
   */
  async addMultiViewImages(sessionId: string, files: File[]): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    try {
      const views = await this.imageSystem.importMultiViewImages(files);
      const input: ImageInput = {
        type: 'image',
        image: views[0]?.image ?? (await this.imageSystem.importFromFile(files[0])),
        views,
      };
      session.inputs = [input];
      return true;
    } catch (error) {
      session.errors.push({
        code: 'IMPORT_ERROR',
        message: `Failed to import images: ${error}`,
        timestamp: new Date(),
      });
      return false;
    }
  }

  /**
   * Add video input to session
   */
  async addVideoInput(sessionId: string, file: File): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    try {
      const video = await this.videoSystem.importFromFile(file);
      const input: VideoInput = {
        type: 'video',
        video,
      };
      session.inputs.push(input);
      return true;
    } catch (error) {
      session.errors.push({
        code: 'IMPORT_ERROR',
        message: `Failed to import video: ${error}`,
        timestamp: new Date(),
      });
      return false;
    }
  }

  /**
   * Add photo set for photogrammetry
   */
  async addPhotoSet(sessionId: string, files: File[]): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    try {
      const photos: ImportedImage[] = [];
      for (const file of files) {
        const image = await this.imageSystem.importFromFile(file);
        photos.push(image);
      }

      const input: PhotoSetInput = {
        type: 'photo_set',
        photoSet: {
          id: generateId(),
          photos,
        },
      };
      session.inputs.push(input);
      return true;
    } catch (error) {
      session.errors.push({
        code: 'IMPORT_ERROR',
        message: `Failed to import photos: ${error}`,
        timestamp: new Date(),
      });
      return false;
    }
  }

  // ===== CONVERSION EXECUTION =====

  /**
   * Execute conversion
   */
  async execute(sessionId: string): Promise<ConversionResult | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.inputs.length === 0) {
      session.errors.push({
        code: 'NO_INPUT',
        message: 'No input provided for conversion',
        timestamp: new Date(),
      });
      session.status = 'failed';
      return null;
    }

    try {
      session.status = 'preprocessing';
      session.progress = 0;

      // Get appropriate pipeline
      const pipeline = getPipeline(session.inputType);

      // Execute pipeline with progress updates
      const result = await this.executeWithProgress(session, pipeline);

      session.status = 'completed';
      session.result = result;
      session.completedAt = new Date();

      this.emit('conversion:completed', { sessionId, result });

      return result;
    } catch (error) {
      session.status = 'failed';
      session.errors.push({
        code: 'CONVERSION_ERROR',
        message: `Conversion failed: ${error}`,
        timestamp: new Date(),
      });

      this.emit('conversion:failed', { sessionId, error: session.errors[session.errors.length - 1] });

      return null;
    }
  }

  /**
   * Execute pipeline with progress tracking
   */
  private async executeWithProgress(
    session: ConversionSession,
    pipeline: IConversionPipeline
  ): Promise<ConversionResult> {
    // Set up progress monitoring
    const progressInterval = setInterval(() => {
      this.emit('conversion:progress', {
        sessionId: session.id,
        progress: session.progress,
        step: session.currentStep,
      });
    }, 100);

    try {
      const result = await pipeline.execute(session);
      clearInterval(progressInterval);
      return result;
    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  }

  /**
   * Cancel conversion
   */
  cancel(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (session.status === 'pending' || session.status === 'preprocessing') {
      session.status = 'cancelled';
      this.emit('conversion:cancelled', { sessionId });
      return true;
    }

    return false;
  }

  // ===== UTILITY METHODS =====

  /**
   * Get input systems
   */
  getSketchSystem(): SketchInputSystem {
    return this.sketchSystem;
  }

  getImageSystem(): ImageImportSystem {
    return this.imageSystem;
  }

  getVideoSystem(): VideoImportSystem {
    return this.videoSystem;
  }

  /**
   * Validate session before conversion
   */
  validateSession(sessionId: string): { valid: boolean; issues: string[] } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { valid: false, issues: ['Session not found'] };
    }

    const issues: string[] = [];

    if (session.inputs.length === 0) {
      issues.push('No input provided');
    }

    // Validate based on input type
    switch (session.inputType) {
      case 'sketch_single':
        if (session.inputs.length === 0 || !(session.inputs[0] as SketchInput).session) {
          issues.push('Sketch session is required');
        }
        break;

      case 'sketch_multi':
        const sketchInput = session.inputs[0] as SketchInput | undefined;
        if (!sketchInput?.views || sketchInput.views.length < 2) {
          issues.push('At least 2 sketch views are required for multi-view reconstruction');
        }
        break;

      case 'image_multi':
        const imageInput = session.inputs[0] as ImageInput | undefined;
        if (!imageInput?.views || imageInput.views.length < 2) {
          issues.push('At least 2 images are required for multi-view reconstruction');
        }
        break;

      case 'photo_set':
        const photoInput = session.inputs[0] as PhotoSetInput | undefined;
        if (!photoInput?.photoSet || photoInput.photoSet.photos.length < 5) {
          issues.push('At least 5 photos are recommended for photogrammetry');
        }
        break;

      case 'video':
        const videoInput = session.inputs[0] as VideoInput | undefined;
        if (!videoInput?.video) {
          issues.push('Video is required');
        } else if (videoInput.video.duration < 2) {
          issues.push('Video should be at least 2 seconds long');
        }
        break;
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Get suggested input type based on available data
   */
  suggestInputType(data: {
    sketchCount?: number;
    imageCount?: number;
    videoCount?: number;
  }): InputType {
    const { sketchCount = 0, imageCount = 0, videoCount = 0 } = data;

    if (sketchCount > 1) return 'sketch_multi';
    if (sketchCount === 1) return 'sketch_single';
    if (videoCount > 0) return 'video';
    if (imageCount > 10) return 'photo_set';
    if (imageCount > 1) return 'image_multi';
    if (imageCount === 1) return 'image_single';

    return 'image_single'; // Default
  }

  // ===== EVENT HANDLING =====

  /**
   * Add event listener
   */
  on(event: string, callback: (data: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: (data: unknown) => void): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  /**
   * Emit event
   */
  private emit(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }

  // ===== CLEANUP =====

  /**
   * Delete session
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Clear all sessions
   */
  clear(): void {
    this.sessions.clear();
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let _instance: ConversionCoordinator | null = null;

/**
 * Initialize conversion system
 */
export function initializeConversionSystem(): ConversionCoordinator {
  if (!_instance) {
    _instance = new ConversionCoordinator();
  }
  return _instance;
}

/**
 * Get conversion coordinator
 */
export function getConversionCoordinator(): ConversionCoordinator {
  if (!_instance) {
    return initializeConversionSystem();
  }
  return _instance;
}

/**
 * Create new conversion coordinator
 */
export function createConversionCoordinator(): ConversionCoordinator {
  return new ConversionCoordinator();
}
