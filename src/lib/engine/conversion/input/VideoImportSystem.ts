/**
 * NEXUS Engine - Video Import System
 * 
 * Sistema para importar y procesar videos
 */

import {
  ImportedVideo,
  ExtractedFrame,
  CoverageReport,
  CoverageGap,
  ViewLabel,
  EstimatedCameraPose,
  generateId,
} from '../types';

/**
 * Video Import System
 * 
 * Maneja la importación, extracción de frames y análisis de videos
 */
export class VideoImportSystem {
  private videos: Map<string, ImportedVideo> = new Map();
  private supportedFormats = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

  /**
   * Import video from file
   */
  async importFromFile(file: File): Promise<ImportedVideo> {
    if (!this.supportedFormats.includes(file.type)) {
      throw new Error(`Unsupported video format: ${file.type}`);
    }

    const url = URL.createObjectURL(file);
    return this.loadVideo(url, file);
  }

  /**
   * Import video from URL
   */
  async importFromUrl(url: string): Promise<ImportedVideo> {
    return this.loadVideo(url);
  }

  /**
   * Load video
   */
  private async loadVideo(source: string, file?: File): Promise<ImportedVideo> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;

      video.onloadedmetadata = async () => {
        try {
          const frames = await this.extractFrames(video);
          const thumbnail = this.generateThumbnail(video);

          const importedVideo: ImportedVideo = {
            id: generateId(),
            source,
            file,
            duration: video.duration,
            fps: 30, // Estimate, could be refined
            width: video.videoWidth,
            height: video.videoHeight,
            frames,
            thumbnail,
          };

          this.videos.set(importedVideo.id, importedVideo);
          resolve(importedVideo);
        } catch (error) {
          reject(error);
        }
      };

      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = source;
    });
  }

  /**
   * Extract frames from video
   */
  private async extractFrames(video: HTMLVideoElement): Promise<ExtractedFrame[]> {
    const frames: ExtractedFrame[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return frames;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Sample frames at regular intervals
    const sampleCount = Math.min(100, Math.ceil(video.duration)); // ~1 frame per second, max 100
    const interval = video.duration / sampleCount;

    for (let i = 0; i < sampleCount; i++) {
      const time = i * interval;
      
      await new Promise<void>((resolve) => {
        video.currentTime = time;
        video.onseeked = () => resolve();
      });

      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const blurScore = this.calculateBlurScore(imageData);

      // Create data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      const frame: ExtractedFrame = {
        id: generateId(),
        index: i,
        timestamp: time,
        image: {
          id: generateId(),
          source: dataUrl,
          width: video.videoWidth,
          height: video.videoHeight,
          format: 'image/jpeg',
          imageData,
          metadata: {},
        },
        blurScore,
        isKeyframe: false,
      };

      frames.push(frame);
    }

    // Mark keyframes (less blurry frames)
    this.identifyKeyframes(frames);

    return frames;
  }

  /**
   * Calculate blur score for a frame
   */
  private calculateBlurScore(imageData: ImageData): number {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    let sum = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y += 4) {
      for (let x = 1; x < width - 1; x += 4) {
        const idx = (y * width + x) * 4;
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        const laplacian =
          Math.abs((data[((y - 1) * width + x) * 4] ?? 0) - gray) +
          Math.abs((data[((y + 1) * width + x) * 4] ?? 0) - gray) +
          Math.abs((data[(y * width + x - 1) * 4] ?? 0) - gray) +
          Math.abs((data[(y * width + x + 1) * 4] ?? 0) - gray) -
          4 * gray;

        sum += Math.abs(laplacian);
        count++;
      }
    }

    // Higher variance = less blurry
    return count > 0 ? sum / count / 255 : 0;
  }

  /**
   * Identify keyframes (sharpest frames)
   */
  private identifyKeyframes(frames: ExtractedFrame[]): void {
    if (frames.length === 0) return;

    // Sort by blur score (higher = better)
    const sorted = [...frames].sort((a, b) => b.blurScore - a.blurScore);
    const threshold = sorted[Math.floor(sorted.length / 3)].blurScore;

    for (const frame of frames) {
      frame.isKeyframe = frame.blurScore >= threshold;
    }
  }

  /**
   * Generate thumbnail from video
   */
  private generateThumbnail(video: HTMLVideoElement): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    const size = 128;
    const ratio = Math.min(size / video.videoWidth, size / video.videoHeight);
    canvas.width = Math.floor(video.videoWidth * ratio);
    canvas.height = Math.floor(video.videoHeight * ratio);

    video.currentTime = video.duration / 2;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.8);
  }

  /**
   * Extract useful frames for reconstruction
   */
  extractUsefulFrames(videoId: string, config: {
    maxFrames?: number;
    minBlurScore?: number;
    removeRedundant?: boolean;
  } = {}): ExtractedFrame[] {
    const video = this.videos.get(videoId);
    if (!video) return [];

    const { maxFrames = 50, minBlurScore = 0.1 } = config;

    // Filter by quality
    let usefulFrames = video.frames.filter(f => 
      f.blurScore >= minBlurScore || f.isKeyframe
    );

    // Limit count
    if (usefulFrames.length > maxFrames) {
      // Select evenly distributed frames
      const step = usefulFrames.length / maxFrames;
      usefulFrames = usefulFrames.filter((_, i) => 
        Math.floor(i / step) < maxFrames
      );
    }

    return usefulFrames;
  }

  /**
   * Analyze coverage (assuming orbital video)
   */
  analyzeCoverage(videoId: string): CoverageReport {
    const video = this.videos.get(videoId);
    if (!video) {
      return {
        totalAngle: 0,
        gaps: [],
        quality: 'poor',
        recommendedAdditionalViews: [],
      };
    }

    // Estimate coverage based on frame count and duration
    // Assume ~360 degrees if video covers full rotation
    const usefulFrames = this.extractUsefulFrames(videoId);
    const coverageRatio = usefulFrames.length / Math.max(1, video.frames.length);
    const totalAngle = coverageRatio * 360;

    // Identify gaps (simplified)
    const gaps: CoverageGap[] = [];
    if (totalAngle < 360) {
      const missingAngle = 360 - totalAngle;
      const gapStart = totalAngle / 2;
      gaps.push({
        startAngle: gapStart,
        endAngle: gapStart + missingAngle,
        suggestedViews: this.getSuggestedViewsForGap(gapStart, missingAngle),
      });
    }

    // Determine quality
    let quality: 'excellent' | 'good' | 'acceptable' | 'poor';
    if (totalAngle >= 340 && usefulFrames.length >= 30) quality = 'excellent';
    else if (totalAngle >= 270 && usefulFrames.length >= 20) quality = 'good';
    else if (totalAngle >= 180 && usefulFrames.length >= 10) quality = 'acceptable';
    else quality = 'poor';

    return {
      totalAngle,
      gaps,
      quality,
      recommendedAdditionalViews: gaps.flatMap(g => g.suggestedViews),
    };
  }

  /**
   * Get suggested views for a gap
   */
  private getSuggestedViewsForGap(startAngle: number, spanAngle: number): ViewLabel[] {
    const views: ViewLabel[] = [];
    const midAngle = startAngle + spanAngle / 2;

    // Simplified mapping
    if (midAngle < 45 || midAngle > 315) views.push('front');
    else if (midAngle < 135) views.push('side_right');
    else if (midAngle < 225) views.push('back');
    else views.push('side_left');

    return views;
  }

  /**
   * Estimate camera trajectory
   */
  estimateCameraTrajectory(videoId: string): EstimatedCameraPose[] {
    const video = this.videos.get(videoId);
    if (!video) return [];

    const poses: EstimatedCameraPose[] = [];
    const frames = this.extractUsefulFrames(videoId);

    // Assume circular orbit around object
    const radius = 2; // meters
    const angleStep = 360 / frames.length;

    for (let i = 0; i < frames.length; i++) {
      const angle = (i * angleStep * Math.PI) / 180;

      poses.push({
        id: generateId(),
        position: {
          x: radius * Math.sin(angle),
          y: 0.5, // Slight upward angle
          z: radius * Math.cos(angle),
        },
        rotation: {
          x: 0,
          y: -angle,
          z: 0,
          w: Math.cos(-angle / 2),
        },
        fov: 60,
        aspectRatio: video.width / video.height,
        confidence: 0.7, // Estimated
      });
    }

    return poses;
  }

  /**
   * Get video by ID
   */
  getVideo(videoId: string): ImportedVideo | undefined {
    return this.videos.get(videoId);
  }

  /**
   * Get all videos
   */
  getAllVideos(): ImportedVideo[] {
    return Array.from(this.videos.values());
  }

  /**
   * Remove video
   */
  removeVideo(videoId: string): boolean {
    const video = this.videos.get(videoId);
    if (video && video.source.startsWith('blob:')) {
      URL.revokeObjectURL(video.source);
    }
    return this.videos.delete(videoId);
  }

  /**
   * Clear all videos
   */
  clear(): void {
    for (const video of this.videos.values()) {
      if (video.source.startsWith('blob:')) {
        URL.revokeObjectURL(video.source);
      }
    }
    this.videos.clear();
  }
}

/**
 * Factory function
 */
export function createVideoImportSystem(): VideoImportSystem {
  return new VideoImportSystem();
}
