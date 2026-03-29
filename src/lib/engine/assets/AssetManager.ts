/**
 * Asset Manager
 * 
 * Manages loading, caching, and lifecycle of all engine assets:
 * - Models (GLB, GLTF, FBX)
 * - Textures
 * - Audio files
 * - Scripts
 * - JSON data
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { EventBus } from '../core/EventSystem';

// ============================================
// TYPES
// ============================================

export type AssetType = 
  | 'model' 
  | 'texture' 
  | 'audio' 
  | 'script' 
  | 'json' 
  | 'font'
  | 'video';

export type AssetStatus = 
  | 'pending' 
  | 'loading' 
  | 'loaded' 
  | 'error';

export interface AssetMetadata {
  id: string;
  type: AssetType;
  path: string;
  size?: number;
  createdAt: Date;
  tags?: string[];
}

export interface Asset<T = unknown> {
  id: string;
  type: AssetType;
  path: string;
  data: T;
  metadata: AssetMetadata;
  refCount: number;
  status: AssetStatus;
  error?: Error;
}

export interface LoadingProgress {
  assetId: string;
  progress: number; // 0-1
  loaded: number;
  total: number;
}

export interface AssetLoadOptions {
  dracoDecoderPath?: string;
  onProgress?: (progress: LoadingProgress) => void;
  signal?: AbortSignal;
}

// ============================================
// ASSET MANAGER
// ============================================

export class AssetManager {
  private assets: Map<string, Asset> = new Map();
  private eventBus: EventBus;
  private loading: Map<string, Promise<Asset>> = new Map();
  
  // Loaders
  private gltfLoader: GLTFLoader;
  private fbxLoader: FBXLoader;
  private textureLoader: THREE.TextureLoader;
  private audioLoader: THREE.AudioLoader;
  private fileLoader: THREE.FileLoader;
  
  // Stats
  private totalLoaded = 0;
  private totalSize = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    
    // Initialize loaders
    this.gltfLoader = new GLTFLoader();
    this.fbxLoader = new FBXLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.audioLoader = new THREE.AudioLoader();
    this.fileLoader = new THREE.FileLoader();
    
    // Setup DRACO decoder for compressed models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.gltfLoader.setDRACOLoader(dracoLoader);
  }

  // ============================================
  // MODEL LOADING
  // ============================================

  /**
   * Load a GLTF/GLB model
   */
  async loadModel(id: string, path: string, options?: AssetLoadOptions): Promise<Asset<THREE.Group>> {
    // Check cache
    const cached = this.getAsset<THREE.Group>(id);
    if (cached) return cached;

    // Check if already loading
    const loading = this.loading.get(id);
    if (loading) return loading as Promise<Asset<THREE.Group>>;

    // Start loading
    const promise = this.doLoadModel(id, path, options);
    this.loading.set(id, promise);

    try {
      const asset = await promise;
      return asset;
    } finally {
      this.loading.delete(id);
    }
  }

  private async doLoadModel(
    id: string, 
    path: string, 
    options?: AssetLoadOptions
  ): Promise<Asset<THREE.Group>> {
    this.eventBus.emit('asset:loading_started', { id, type: 'model', path });

    return new Promise((resolve, reject) => {
      const loader = path.toLowerCase().endsWith('.fbx') ? this.fbxLoader : this.gltfLoader;

      loader.load(
        path,
        (result) => {
          const model = result instanceof THREE.Group ? result : (result as any).scene;
          
          const asset: Asset<THREE.Group> = {
            id,
            type: 'model',
            path,
            data: model,
            metadata: {
              id,
              type: 'model',
              path,
              createdAt: new Date(),
            },
            refCount: 0,
            status: 'loaded',
          };

          this.assets.set(id, asset);
          this.totalLoaded++;

          this.eventBus.emit('asset:loaded', { id, type: 'model', path });
          resolve(asset);
        },
        (xhr) => {
          const progress = xhr.loaded / xhr.total;
          options?.onProgress?.({
            assetId: id,
            progress,
            loaded: xhr.loaded,
            total: xhr.total,
          });
          this.eventBus.emit('asset:progress', { id, progress, loaded: xhr.loaded, total: xhr.total });
        },
        (error) => {
          const err = error instanceof Error ? error : new Error(String(error));
          
          const asset: Asset<THREE.Group> = {
            id,
            type: 'model',
            path,
            data: new THREE.Group(),
            metadata: {
              id,
              type: 'model',
              path,
              createdAt: new Date(),
            },
            refCount: 0,
            status: 'error',
            error: err,
          };

          this.assets.set(id, asset);
          this.eventBus.emit('asset:error', { id, error: err.message });
          reject(err);
        }
      );
    });
  }

  // ============================================
  // TEXTURE LOADING
  // ============================================

  /**
   * Load a texture
   */
  async loadTexture(id: string, path: string): Promise<Asset<THREE.Texture>> {
    const cached = this.getAsset<THREE.Texture>(id);
    if (cached) return cached;

    const loading = this.loading.get(id);
    if (loading) return loading as Promise<Asset<THREE.Texture>>;

    const promise = this.doLoadTexture(id, path);
    this.loading.set(id, promise);

    try {
      return await promise;
    } finally {
      this.loading.delete(id);
    }
  }

  private async doLoadTexture(id: string, path: string): Promise<Asset<THREE.Texture>> {
    this.eventBus.emit('asset:loading_started', { id, type: 'texture', path });

    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        path,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          
          const asset: Asset<THREE.Texture> = {
            id,
            type: 'texture',
            path,
            data: texture,
            metadata: {
              id,
              type: 'texture',
              path,
              createdAt: new Date(),
            },
            refCount: 0,
            status: 'loaded',
          };

          this.assets.set(id, asset);
          this.totalLoaded++;

          this.eventBus.emit('asset:loaded', { id, type: 'texture', path });
          resolve(asset);
        },
        undefined,
        (error) => {
          const err = error instanceof Error ? error : new Error(String(error));
          this.eventBus.emit('asset:error', { id, error: err.message });
          reject(err);
        }
      );
    });
  }

  // ============================================
  // AUDIO LOADING
  // ============================================

  /**
   * Load an audio file
   */
  async loadAudio(id: string, path: string): Promise<Asset<AudioBuffer>> {
    const cached = this.getAsset<AudioBuffer>(id);
    if (cached) return cached;

    this.eventBus.emit('asset:loading_started', { id, type: 'audio', path });

    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        path,
        (buffer) => {
          const asset: Asset<AudioBuffer> = {
            id,
            type: 'audio',
            path,
            data: buffer,
            metadata: {
              id,
              type: 'audio',
              path,
              createdAt: new Date(),
            },
            refCount: 0,
            status: 'loaded',
          };

          this.assets.set(id, asset);
          this.totalLoaded++;

          this.eventBus.emit('asset:loaded', { id, type: 'audio', path });
          resolve(asset);
        },
        undefined,
        (error) => {
          const err = error instanceof Error ? error : new Error(String(error));
          this.eventBus.emit('asset:error', { id, error: err.message });
          reject(err);
        }
      );
    });
  }

  // ============================================
  // JSON/DATA LOADING
  // ============================================

  /**
   * Load JSON data
   */
  async loadJSON<T = unknown>(id: string, path: string): Promise<Asset<T>> {
    const cached = this.getAsset<T>(id);
    if (cached) return cached;

    this.eventBus.emit('asset:loading_started', { id, type: 'json', path });

    return new Promise((resolve, reject) => {
      this.fileLoader.setResponseType('json');
      this.fileLoader.load(
        path,
        (data) => {
          const asset: Asset<T> = {
            id,
            type: 'json',
            path,
            data: data as T,
            metadata: {
              id,
              type: 'json',
              path,
              createdAt: new Date(),
            },
            refCount: 0,
            status: 'loaded',
          };

          this.assets.set(id, asset);
          this.totalLoaded++;

          this.eventBus.emit('asset:loaded', { id, type: 'json', path });
          resolve(asset);
        },
        undefined,
        (error) => {
          const err = error instanceof Error ? error : new Error(String(error));
          this.eventBus.emit('asset:error', { id, error: err.message });
          reject(err);
        }
      );
    });
  }

  // ============================================
  // SCRIPT LOADING
  // ============================================

  /**
   * Load a script file
   */
  async loadScript(id: string, path: string): Promise<Asset<string>> {
    const cached = this.getAsset<string>(id);
    if (cached) return cached;

    this.eventBus.emit('asset:loading_started', { id, type: 'script', path });

    return new Promise((resolve, reject) => {
      this.fileLoader.setResponseType('text');
      this.fileLoader.load(
        path,
        (data) => {
          const asset: Asset<string> = {
            id,
            type: 'script',
            path,
            data: data as string,
            metadata: {
              id,
              type: 'script',
              path,
              createdAt: new Date(),
            },
            refCount: 0,
            status: 'loaded',
          };

          this.assets.set(id, asset);
          this.totalLoaded++;

          this.eventBus.emit('asset:loaded', { id, type: 'script', path });
          resolve(asset);
        },
        undefined,
        (error) => {
          const err = error instanceof Error ? error : new Error(String(error));
          this.eventBus.emit('asset:error', { id, error: err.message });
          reject(err);
        }
      );
    });
  }

  // ============================================
  // BATCH LOADING
  // ============================================

  /**
   * Load multiple assets at once
   */
  async loadAssets(
    assets: Array<{ id: string; type: AssetType; path: string }>
  ): Promise<Map<string, Asset>> {
    const results = new Map<string, Asset>();

    const promises = assets.map(async ({ id, type, path }) => {
      let asset: Asset;

      switch (type) {
        case 'model':
          asset = await this.loadModel(id, path);
          break;
        case 'texture':
          asset = await this.loadTexture(id, path);
          break;
        case 'audio':
          asset = await this.loadAudio(id, path);
          break;
        case 'json':
          asset = await this.loadJSON(id, path);
          break;
        case 'script':
          asset = await this.loadScript(id, path);
          break;
        default:
          throw new Error(`Unknown asset type: ${type}`);
      }

      results.set(id, asset);
    });

    await Promise.all(promises);

    this.eventBus.emit('assets:batch_loaded', { count: results.size });
    return results;
  }

  // ============================================
  // ASSET MANAGEMENT
  // ============================================

  /**
   * Get an asset by ID
   */
  getAsset<T = unknown>(id: string): Asset<T> | undefined {
    return this.assets.get(id) as Asset<T> | undefined;
  }

  /**
   * Check if asset exists
   */
  hasAsset(id: string): boolean {
    return this.assets.has(id);
  }

  /**
   * Get asset data directly
   */
  getAssetData<T = unknown>(id: string): T | undefined {
    return this.assets.get(id)?.data as T | undefined;
  }

  /**
   * Increase reference count
   */
  retain(id: string): void {
    const asset = this.assets.get(id);
    if (asset) {
      asset.refCount++;
    }
  }

  /**
   * Decrease reference count, dispose if zero
   */
  release(id: string): void {
    const asset = this.assets.get(id);
    if (!asset) return;

    asset.refCount--;

    if (asset.refCount <= 0) {
      this.disposeAsset(id);
    }
  }

  /**
   * Dispose a single asset
   */
  disposeAsset(id: string): void {
    const asset = this.assets.get(id);
    if (!asset) return;

    // Dispose based on type
    if (asset.data instanceof THREE.Object3D) {
      asset.data.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    } else if (asset.data instanceof THREE.Texture) {
      asset.data.dispose();
    }

    this.assets.delete(id);
    this.eventBus.emit('asset:disposed', { id });
  }

  /**
   * Get all assets of a type
   */
  getAssetsByType(type: AssetType): Asset[] {
    return Array.from(this.assets.values()).filter(a => a.type === type);
  }

  /**
   * Get loading progress
   */
  getLoadingProgress(): { total: number; loaded: number; loading: number } {
    return {
      total: this.assets.size + this.loading.size,
      loaded: this.totalLoaded,
      loading: this.loading.size,
    };
  }

  /**
   * Get all asset IDs
   */
  getAssetIds(): string[] {
    return Array.from(this.assets.keys());
  }

  // ============================================
  // DISPOSE
  // ============================================

  /**
   * Dispose all assets
   */
  dispose(): void {
    this.assets.forEach((asset, id) => {
      this.disposeAsset(id);
    });

    this.assets.clear();
    this.loading.clear();
    this.totalLoaded = 0;
    this.totalSize = 0;

    this.eventBus.emit('assets:disposed_all', {});
    console.log('[AssetManager] Disposed');
  }
}

// ============================================
// SINGLETON
// ============================================

let assetManagerInstance: AssetManager | null = null;

export function createAssetManager(eventBus: EventBus): AssetManager {
  if (!assetManagerInstance) {
    assetManagerInstance = new AssetManager(eventBus);
  }
  return assetManagerInstance;
}

export function getAssetManager(): AssetManager | null {
  return assetManagerInstance;
}
