/**
 * NEXUS Engine - Image Import System
 * 
 * Sistema para importar y gestionar imágenes
 */

import {
  ImportedImage,
  LabeledView,
  ViewLabel,
  QualityReport,
  QualityLevel,
  QualityIssue,
  DetectedKeypoint,
  generateId,
} from '../types';

/**
 * Image Import System
 * 
 * Maneja la importación, validación y gestión de imágenes
 */
export class ImageImportSystem {
  private images: Map<string, ImportedImage> = new Map();
  private maxSize = 8192;
  private minSize = 64;
  private supportedFormats = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

  /**
   * Import a single image from file
   */
  async importFromFile(file: File): Promise<ImportedImage> {
    return new Promise((resolve, reject) => {
      // Validate format
      if (!this.supportedFormats.includes(file.type)) {
        reject(new Error(`Unsupported format: ${file.type}`));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        this.loadImageFromUrl(dataUrl, file.name, file)
          .then(resolve)
          .catch(reject);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Import image from URL
   */
  async importFromUrl(url: string, name?: string): Promise<ImportedImage> {
    return this.loadImageFromUrl(url, name ?? 'imported_image');
  }

  /**
   * Import multiple images for multi-view
   */
  async importMultiViewImages(files: File[]): Promise<LabeledView[]> {
    const views: LabeledView[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const image = await this.importFromFile(files[i]);
        const view: LabeledView = {
          id: generateId(),
          image,
          label: this.inferViewLabel(i, files.length),
          estimatedAngle: this.inferAngle(i, files.length),
        };
        views.push(view);
      } catch (error) {
        console.warn(`Failed to import image ${files[i].name}:`, error);
      }
    }

    return views;
  }

  /**
   * Load image from URL/data URL
   */
  private async loadImageFromUrl(source: string, name: string, file?: File): Promise<ImportedImage> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        // Create canvas to get image data
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Resize if too large
        let width = img.width;
        let height = img.height;

        if (width > this.maxSize || height > this.maxSize) {
          const ratio = Math.min(this.maxSize / width, this.maxSize / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);

        // Generate thumbnail
        const thumbnail = this.generateThumbnail(canvas, 128);

        const importedImage: ImportedImage = {
          id: generateId(),
          source,
          file,
          width,
          height,
          format: file?.type ?? 'image/png',
          imageData,
          thumbnail,
          metadata: {
            filename: name,
            size: file?.size,
            createdAt: new Date(),
          },
        };

        this.images.set(importedImage.id, importedImage);
        resolve(importedImage);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = source;
    });
  }

  /**
   * Generate thumbnail
   */
  private generateThumbnail(canvas: HTMLCanvasElement, size: number): string {
    const thumbCanvas = document.createElement('canvas');
    const ctx = thumbCanvas.getContext('2d');

    if (!ctx) return '';

    const ratio = Math.min(size / canvas.width, size / canvas.height);
    thumbCanvas.width = Math.floor(canvas.width * ratio);
    thumbCanvas.height = Math.floor(canvas.height * ratio);

    ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
    return thumbCanvas.toDataURL('image/jpeg', 0.8);
  }

  /**
   * Infer view label from index
   */
  private inferViewLabel(index: number, total: number): ViewLabel {
    if (total === 1) return 'front';
    if (total === 2) return index === 0 ? 'front' : 'side_right';
    if (total === 4) {
      const labels: ViewLabel[] = ['front', 'side_right', 'back', 'side_left'];
      return labels[index] ?? 'custom';
    }
    // For more views, interpolate angles
    if (index === 0) return 'front';
    if (index === Math.floor(total / 4)) return 'side_right';
    if (index === Math.floor(total / 2)) return 'back';
    if (index === Math.floor((3 * total) / 4)) return 'side_left';
    return 'custom';
  }

  /**
   * Infer angle from index
   */
  private inferAngle(index: number, total: number): number {
    if (total <= 1) return 0;
    return (index / (total - 1)) * 360;
  }

  /**
   * Validate image quality
   */
  validateQuality(image: ImportedImage): QualityReport {
    const issues: QualityIssue[] = [];
    let score = 100;

    // Check resolution
    if (image.width < this.minSize || image.height < this.minSize) {
      issues.push({
        type: 'low_resolution',
        severity: 'critical',
        message: `Image resolution (${image.width}x${image.height}) is too low`,
        suggestion: 'Use an image with at least 64x64 pixels',
      });
      score -= 40;
    } else if (image.width < 256 || image.height < 256) {
      issues.push({
        type: 'low_resolution',
        severity: 'warning',
        message: 'Image resolution is low, results may be poor',
        suggestion: 'Use a higher resolution image for better results',
      });
      score -= 20;
    }

    // Check blur (simple edge detection based)
    if (image.imageData) {
      const blurScore = this.detectBlur(image.imageData);
      if (blurScore > 0.7) {
        issues.push({
          type: 'blurry',
          severity: 'warning',
          message: 'Image appears to be blurry',
          suggestion: 'Use a sharper image for better results',
        });
        score -= 15;
      }
    }

    // Check contrast
    if (image.imageData) {
      const contrastScore = this.checkContrast(image.imageData);
      if (contrastScore < 0.2) {
        issues.push({
          type: 'poor_contrast',
          severity: 'warning',
          message: 'Image has low contrast',
          suggestion: 'Improve lighting or contrast for better detection',
        });
        score -= 10;
      }
    }

    // Determine quality level
    let level: QualityLevel;
    if (score >= 80) level = 'excellent';
    else if (score >= 60) level = 'good';
    else if (score >= 40) level = 'acceptable';
    else level = 'poor';

    return {
      score: Math.max(0, score),
      level,
      issues,
      suggestions: issues.map(i => i.suggestion),
      canProceed: score >= 30,
    };
  }

  /**
   * Simple blur detection using Laplacian variance
   */
  private detectBlur(imageData: ImageData): number {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    let sum = 0;
    let sumSq = 0;
    let count = 0;

    // Convert to grayscale and compute Laplacian
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        // Laplacian kernel
        const laplacian =
          Math.abs(data[((y - 1) * width + x) * 4] - gray) +
          Math.abs(data[((y + 1) * width + x) * 4] - gray) +
          Math.abs(data[(y * width + x - 1) * 4] - gray) +
          Math.abs(data[(y * width + x + 1) * 4] - gray) -
          4 * gray;

        sum += laplacian;
        sumSq += laplacian * laplacian;
        count++;
      }
    }

    // Variance of Laplacian
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;

    // Normalize to 0-1 range (higher = more blurry)
    return 1 - Math.min(1, variance / 10000);
  }

  /**
   * Check image contrast
   */
  private checkContrast(imageData: ImageData): number {
    const data = imageData.data;
    let min = 255;
    let max = 0;

    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      min = Math.min(min, gray);
      max = Math.max(max, gray);
    }

    return (max - min) / 255;
  }

  /**
   * Detect keypoints in image
   */
  async detectKeypoints(imageId: string): Promise<DetectedKeypoint[]> {
    const image = this.images.get(imageId);
    if (!image?.imageData) return [];

    // Simple corner detection using Harris-like method
    const keypoints: DetectedKeypoint[] = [];
    const data = image.imageData.data;
    const width = image.width;
    const height = image.height;

    // Convert to grayscale
    const gray: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      gray.push((data[i] + data[i + 1] + data[i + 2]) / 3);
    }

    // Simple gradient-based corner detection
    const threshold = 30;
    const step = 8; // Sample every 8 pixels for performance

    for (let y = step; y < height - step; y += step) {
      for (let x = step; x < width - step; x += step) {
        const idx = y * width + x;
        const gx = (gray[idx + 1] ?? 0) - (gray[idx - 1] ?? 0);
        const gy = (gray[idx + width] ?? 0) - (gray[idx - width] ?? 0);

        const gradientMag = Math.sqrt(gx * gx + gy * gy);

        if (gradientMag > threshold) {
          keypoints.push({
            id: generateId(),
            position: { x, y },
            scale: gradientMag / 255,
            angle: Math.atan2(gy, gx),
            response: gradientMag,
            octave: 0,
          });
        }
      }
    }

    return keypoints;
  }

  /**
   * Get image by ID
   */
  getImage(imageId: string): ImportedImage | undefined {
    return this.images.get(imageId);
  }

  /**
   * Get all images
   */
  getAllImages(): ImportedImage[] {
    return Array.from(this.images.values());
  }

  /**
   * Remove image
   */
  removeImage(imageId: string): boolean {
    return this.images.delete(imageId);
  }

  /**
   * Clear all images
   */
  clear(): void {
    this.images.clear();
  }
}

/**
 * Factory function
 */
export function createImageImportSystem(): ImageImportSystem {
  return new ImageImportSystem();
}
