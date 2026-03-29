/**
 * Prefab System
 * 
 * Manages reusable prefab templates that can be instantiated in scenes.
 * Supports variants and overrides.
 */

import * as THREE from 'three';
import { EventBus } from '../core/EventSystem';
import { SceneManager } from './SceneManager';
import {
  PrefabData,
  PrefabVariant,
  SceneNode,
  DefaultTransform,
  cloneSceneNode,
  cloneTransform,
  cloneVector3,
} from './types';

// ============================================
// PREFAB SYSTEM
// ============================================

export class PrefabSystem {
  private prefabs: Map<string, PrefabData> = new Map();
  private variants: Map<string, PrefabVariant> = new Map();
  private eventBus: EventBus;
  private sceneManager: SceneManager;
  private categories: Map<string, string[]> = new Map();

  constructor(eventBus: EventBus, sceneManager: SceneManager) {
    this.eventBus = eventBus;
    this.sceneManager = sceneManager;

    // Initialize default categories
    this.categories.set('characters', []);
    this.categories.set('props', []);
    this.categories.set('environment', []);
    this.categories.set('lights', []);
    this.categories.set('effects', []);
    this.categories.set('audio', []);
  }

  // ============================================
  // PREFAB CREATION
  // ============================================

  /**
   * Create a prefab from a scene node
   */
  createFromNode(nodeId: string, name: string, category: string = 'props'): PrefabData | null {
    const node = this.sceneManager.getNode(nodeId);
    if (!node) return null;

    const obj = this.sceneManager.getNodeObject(nodeId);
    if (!obj) return null;

    const prefabId = this.generateId('prefab');
    
    // Deep clone node data
    const nodes = this.cloneNodeHierarchy(nodeId);

    const prefab: PrefabData = {
      id: prefabId,
      name,
      category,
      tags: [...node.tags],
      nodes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.prefabs.set(prefabId, prefab);

    // Add to category
    const categoryPrefabs = this.categories.get(category) || [];
    categoryPrefabs.push(prefabId);
    this.categories.set(category, categoryPrefabs);

    this.eventBus.emit('prefab:created', { id: prefabId, name, category });

    return prefab;
  }

  /**
   * Create a prefab from scratch
   */
  create(name: string, category: string = 'props', nodes: SceneNode[] = []): PrefabData {
    const id = this.generateId('prefab');

    // Create root node if none provided
    if (nodes.length === 0) {
      nodes = [{
        id: this.generateId('node'),
        name: name + '_root',
        type: 'empty',
        transform: cloneTransform(DefaultTransform),
        parentId: null,
        childrenIds: [],
        active: true,
        static: false,
        layer: 0,
        tags: [],
        components: [],
      }];
    }

    const prefab: PrefabData = {
      id,
      name,
      category,
      tags: [],
      nodes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.prefabs.set(id, prefab);

    // Add to category
    const categoryPrefabs = this.categories.get(category) || [];
    categoryPrefabs.push(id);
    this.categories.set(category, categoryPrefabs);

    this.eventBus.emit('prefab:created', { id, name, category });

    return prefab;
  }

  // ============================================
  // PREFAB INSTANTIATION
  // ============================================

  /**
   * Instantiate a prefab in the scene
   */
  instantiate(prefabId: string, position?: { x: number; y: number; z: number }): string | null {
    const prefab = this.prefabs.get(prefabId);
    if (!prefab) return null;

    // Find root node
    const rootNode = prefab.nodes.find(n => n.parentId === null);
    if (!rootNode) return null;

    // Clone and instantiate all nodes
    const idMap = new Map<string, string>();
    let newRootId: string | null = null;

    for (const node of prefab.nodes) {
      // Generate new ID
      const newId = this.generateId('node');
      idMap.set(node.id, newId);

      // Clone node data
      const clonedNode: SceneNode = {
        ...node,
        id: newId,
        name: node.name + '_instance',
        transform: {
          position: position && node.parentId === null 
            ? cloneVector3(position)
            : cloneVector3(node.transform.position),
          rotation: { ...node.transform.rotation },
          scale: cloneVector3(node.transform.scale),
        },
        parentId: node.parentId ? idMap.get(node.parentId) || null : null,
        childrenIds: [],
      };

      // Create in scene
      const sceneNode = this.sceneManager.createNode(clonedNode.name, clonedNode.type, clonedNode.parentId);
      idMap.set(node.id, sceneNode.id);

      // Set transform
      this.sceneManager.setTransform(sceneNode.id, clonedNode.transform);

      if (node.parentId === null) {
        newRootId = sceneNode.id;
      }
    }

    this.eventBus.emit('prefab:instantiated', { prefabId, instanceId: newRootId });

    return newRootId;
  }

  /**
   * Instantiate with variant
   */
  instantiateVariant(
    prefabId: string, 
    variantId: string, 
    position?: { x: number; y: number; z: number }
  ): string | null {
    const variant = this.variants.get(variantId);
    if (!variant || variant.basePrefabId !== prefabId) {
      return this.instantiate(prefabId, position);
    }

    const instanceId = this.instantiate(prefabId, position);
    if (!instanceId) return null;

    // Apply variant overrides
    for (const [nodeId, overrides] of Object.entries(variant.overrides)) {
      // Find the corresponding instance node
      const prefab = this.prefabs.get(prefabId);
      if (!prefab) continue;

      // Apply overrides (would need to map original IDs to instance IDs)
      // This is simplified - a full implementation would need proper ID mapping
    }

    return instanceId;
  }

  // ============================================
  // PREFAB MANAGEMENT
  // ============================================

  /**
   * Get a prefab by ID
   */
  getPrefab(id: string): PrefabData | undefined {
    return this.prefabs.get(id);
  }

  /**
   * Get prefab by name
   */
  getPrefabByName(name: string): PrefabData | undefined {
    for (const prefab of this.prefabs.values()) {
      if (prefab.name === name) {
        return prefab;
      }
    }
    return undefined;
  }

  /**
   * Update a prefab
   */
  updatePrefab(id: string, updates: Partial<Omit<PrefabData, 'id' | 'createdAt'>>): void {
    const prefab = this.prefabs.get(id);
    if (!prefab) return;

    Object.assign(prefab, updates, { updatedAt: new Date() });

    this.eventBus.emit('prefab:updated', { id });
  }

  /**
   * Delete a prefab
   */
  deletePrefab(id: string): void {
    const prefab = this.prefabs.get(id);
    if (!prefab) return;

    // Remove from category
    const categoryPrefabs = this.categories.get(prefab.category);
    if (categoryPrefabs) {
      const index = categoryPrefabs.indexOf(id);
      if (index > -1) {
        categoryPrefabs.splice(index, 1);
      }
    }

    // Delete variants
    this.variants.forEach((variant, vid) => {
      if (variant.basePrefabId === id) {
        this.variants.delete(vid);
      }
    });

    this.prefabs.delete(id);

    this.eventBus.emit('prefab:deleted', { id });
  }

  // ============================================
  // VARIANTS
  // ============================================

  /**
   * Create a prefab variant
   */
  createVariant(
    prefabId: string, 
    name: string, 
    overrides: Record<string, Partial<SceneNode>>
  ): PrefabVariant | null {
    const prefab = this.prefabs.get(prefabId);
    if (!prefab) return null;

    const variantId = this.generateId('variant');

    const variant: PrefabVariant = {
      id: variantId,
      name,
      basePrefabId: prefabId,
      overrides,
    };

    this.variants.set(variantId, variant);

    this.eventBus.emit('prefab:variant_created', { variantId, prefabId, name });

    return variant;
  }

  /**
   * Get variants for a prefab
   */
  getVariants(prefabId: string): PrefabVariant[] {
    return Array.from(this.variants.values())
      .filter(v => v.basePrefabId === prefabId);
  }

  // ============================================
  // CATEGORIES
  // ============================================

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Get prefabs by category
   */
  getPrefabsByCategory(category: string): PrefabData[] {
    const ids = this.categories.get(category) || [];
    return ids
      .map(id => this.prefabs.get(id))
      .filter((p): p is PrefabData => p !== undefined);
  }

  /**
   * Add a custom category
   */
  addCategory(name: string): void {
    if (!this.categories.has(name)) {
      this.categories.set(name, []);
    }
  }

  // ============================================
  // SERIALIZATION
  // ============================================

  /**
   * Export all prefabs
   */
  exportAll(): { prefabs: PrefabData[]; variants: PrefabVariant[] } {
    return {
      prefabs: Array.from(this.prefabs.values()),
      variants: Array.from(this.variants.values()),
    };
  }

  /**
   * Import prefabs
   */
  importAll(data: { prefabs: PrefabData[]; variants: PrefabVariant[] }): void {
    for (const prefab of data.prefabs) {
      this.prefabs.set(prefab.id, prefab);
      
      const categoryPrefabs = this.categories.get(prefab.category) || [];
      if (!categoryPrefabs.includes(prefab.id)) {
        categoryPrefabs.push(prefab.id);
        this.categories.set(prefab.category, categoryPrefabs);
      }
    }

    for (const variant of data.variants) {
      this.variants.set(variant.id, variant);
    }

    this.eventBus.emit('prefab:imported', { 
      prefabCount: data.prefabs.length,
      variantCount: data.variants.length 
    });
  }

  // ============================================
  // BUILT-IN PREFABS
  // ============================================

  /**
   * Create built-in prefabs
   */
  createBuiltInPrefabs(): void {
    // Cube
    this.create('Cube', 'props', [{
      id: 'builtin_cube',
      name: 'Cube',
      type: 'mesh',
      transform: cloneTransform(DefaultTransform),
      parentId: null,
      childrenIds: [],
      active: true,
      static: false,
      layer: 0,
      tags: ['primitive', 'mesh'],
      components: [
        { type: 'MeshRenderer', data: { geometry: 'box', material: 'default' } }
      ],
    }]);

    // Sphere
    this.create('Sphere', 'props', [{
      id: 'builtin_sphere',
      name: 'Sphere',
      type: 'mesh',
      transform: cloneTransform(DefaultTransform),
      parentId: null,
      childrenIds: [],
      active: true,
      static: false,
      layer: 0,
      tags: ['primitive', 'mesh'],
      components: [
        { type: 'MeshRenderer', data: { geometry: 'sphere', material: 'default' } }
      ],
    }]);

    // Directional Light
    this.create('Directional Light', 'lights', [{
      id: 'builtin_dir_light',
      name: 'Directional Light',
      type: 'light',
      transform: {
        position: { x: 0, y: 10, z: 0 },
        rotation: { x: -0.5, y: 0, z: 0, w: 0.866 },
        scale: { x: 1, y: 1, z: 1 },
      },
      parentId: null,
      childrenIds: [],
      active: true,
      static: false,
      layer: 0,
      tags: ['light', 'directional'],
      components: [
        { type: 'Light', data: { type: 'directional', intensity: 1, castShadow: true } }
      ],
    }]);

    // Point Light
    this.create('Point Light', 'lights', [{
      id: 'builtin_point_light',
      name: 'Point Light',
      type: 'light',
      transform: {
        position: { x: 0, y: 5, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      parentId: null,
      childrenIds: [],
      active: true,
      static: false,
      layer: 0,
      tags: ['light', 'point'],
      components: [
        { type: 'Light', data: { type: 'point', intensity: 1, distance: 10 } }
      ],
    }]);

    // Camera
    this.create('Camera', 'props', [{
      id: 'builtin_camera',
      name: 'Camera',
      type: 'camera',
      transform: {
        position: { x: 0, y: 2, z: 5 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      parentId: null,
      childrenIds: [],
      active: true,
      static: false,
      layer: 0,
      tags: ['camera'],
      components: [
        { type: 'Camera', data: { fov: 60, near: 0.1, far: 1000 } }
      ],
    }]);

    this.eventBus.emit('prefab:builtins_created', {});
  }

  // ============================================
  // HELPERS
  // ============================================

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cloneNodeHierarchy(nodeId: string): SceneNode[] {
    const result: SceneNode[] = [];
    const node = this.sceneManager.getNode(nodeId);
    if (!node) return result;

    // Clone this node
    result.push({
      ...cloneSceneNode(node),
    });

    // Clone children
    for (const childId of node.childrenIds) {
      result.push(...this.cloneNodeHierarchy(childId));
    }

    return result;
  }

  // ============================================
  // DISPOSE
  // ============================================

  dispose(): void {
    this.prefabs.clear();
    this.variants.clear();
    this.categories.clear();

    this.eventBus.emit('prefab:disposed', {});
    console.log('[PrefabSystem] Disposed');
  }
}

// ============================================
// SINGLETON
// ============================================

let prefabSystemInstance: PrefabSystem | null = null;

export function createPrefabSystem(eventBus: EventBus, sceneManager: SceneManager): PrefabSystem {
  if (!prefabSystemInstance) {
    prefabSystemInstance = new PrefabSystem(eventBus, sceneManager);
  }
  return prefabSystemInstance;
}

export function getPrefabSystem(): PrefabSystem | null {
  return prefabSystemInstance;
}
