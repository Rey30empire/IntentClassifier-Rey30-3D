/**
 * Scene Manager
 * 
 * Manages scene lifecycle, hierarchy, and serialization.
 * Handles creating, loading, saving, and switching scenes.
 */

import * as THREE from 'three';
import { EventBus } from '../core/EventSystem';
import { ECS } from '../ecs/ECS';
import {
  SceneData,
  SceneNode,
  Transform,
  DefaultTransform,
  DefaultEnvironment,
  DefaultPhysics,
  cloneEnvironmentSettings,
  clonePhysicsSettings,
  cloneTransform,
} from './types';

// ============================================
// SCENE MANAGER
// ============================================

export class SceneManager {
  private scene: THREE.Scene;
  private sceneData: SceneData | null = null;
  private nodes: Map<string, THREE.Object3D> = new Map();
  private nodeData: Map<string, SceneNode> = new Map();
  private eventBus: EventBus;
  private ecs: ECS;
  private undoStack: SceneData[] = [];
  private redoStack: SceneData[] = [];
  private maxUndoLevels: number = 50;
  private selectedNodes: Set<string> = new Set();
  private activeNodeId: string | null = null;

  constructor(eventBus: EventBus, ecs: ECS) {
    this.eventBus = eventBus;
    this.ecs = ecs;
    this.scene = new THREE.Scene();
  }

  // ============================================
  // SCENE LIFECYCLE
  // ============================================

  /**
   * Create a new scene
   */
  createScene(name: string = 'Untitled Scene'): SceneData {
    const id = this.generateId('scene');
    
    this.sceneData = {
      id,
      name,
      nodes: [],
      rootNodes: [],
      environment: cloneEnvironmentSettings(DefaultEnvironment),
      physics: clonePhysicsSettings(DefaultPhysics),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Clear existing objects
    this.clearScene();

    // Setup default environment
    this.setupEnvironment();

    this.eventBus.emit('scene:created', { id, name });
    
    return this.sceneData;
  }

  /**
   * Load a scene from data
   */
  async loadScene(data: SceneData): Promise<void> {
    // Save current scene to undo stack
    if (this.sceneData) {
      this.pushUndo();
    }

    // Clear current scene
    this.clearScene();

    // Set new scene data
    this.sceneData = structuredClone(data);

    // Create all nodes
    for (const node of data.nodes) {
      await this.createNodeFromData(node);
    }

    // Setup environment
    this.setupEnvironment();

    this.eventBus.emit('scene:loaded', { sceneId: data.id });
  }

  /**
   * Save current scene
   */
  saveScene(): SceneData | null {
    if (!this.sceneData) return null;

    // Update timestamps
    this.sceneData.updatedAt = new Date();

    // Serialize all nodes
    this.sceneData.nodes = Array.from(this.nodeData.values());
    this.sceneData.rootNodes = this.getRootNodeIds();

    this.eventBus.emit('scene:saved', {
      sceneId: this.sceneData.id,
      path: 'memory://current-scene',
    });
    
    return structuredClone(this.sceneData);
  }

  /**
   * Clear the scene
   */
  clearScene(): void {
    // Dispose all nodes
    this.nodes.forEach((obj, id) => {
      this.scene.remove(obj);
      this.disposeObject(obj);
    });

    this.nodes.clear();
    this.nodeData.clear();
    this.selectedNodes.clear();
    this.activeNodeId = null;

    this.eventBus.emit('scene:cleared', {});
  }

  // ============================================
  // NODE MANAGEMENT
  // ============================================

  /**
   * Create a new node
   */
  createNode(
    name: string,
    type: SceneNode['type'] = 'empty',
    parentId: string | null = null
  ): SceneNode {
    const id = this.generateId('node');

    const node: SceneNode = {
      id,
      name,
      type,
      transform: cloneTransform(DefaultTransform),
      parentId,
      childrenIds: [],
      active: true,
      static: false,
      layer: 0,
      tags: [],
      components: [],
    };

    // Create Three.js object
    const obj = this.createThreeObject(node);
    this.nodes.set(id, obj);
    this.nodeData.set(id, node);

    // Add to parent or scene
    if (parentId) {
      const parent = this.nodes.get(parentId);
      if (parent) {
        parent.add(obj);
        const parentData = this.nodeData.get(parentId);
        if (parentData) {
          parentData.childrenIds.push(id);
        }
      }
    } else {
      this.scene.add(obj);
      if (this.sceneData) {
        this.sceneData.rootNodes.push(id);
      }
    }

    this.eventBus.emit('scene:node_created', { id, name, type });

    return node;
  }

  /**
   * Delete a node
   */
  deleteNode(id: string): void {
    const obj = this.nodes.get(id);
    if (!obj) return;

    // Delete children first
    const nodeData = this.nodeData.get(id);
    if (nodeData) {
      for (const childId of [...nodeData.childrenIds]) {
        this.deleteNode(childId);
      }
    }

    // Remove from parent
    const parent = obj.parent;
    if (parent) {
      parent.remove(obj);
    } else {
      this.scene.remove(obj);
    }

    // Update parent's children list
    if (nodeData?.parentId) {
      const parentData = this.nodeData.get(nodeData.parentId);
      if (parentData) {
        parentData.childrenIds = parentData.childrenIds.filter(cid => cid !== id);
      }
    }

    // Remove from root nodes
    if (this.sceneData) {
      this.sceneData.rootNodes = this.sceneData.rootNodes.filter(rid => rid !== id);
    }

    // Dispose and remove
    this.disposeObject(obj);
    this.nodes.delete(id);
    this.nodeData.delete(id);
    this.selectedNodes.delete(id);

    if (this.activeNodeId === id) {
      this.activeNodeId = null;
    }

    this.eventBus.emit('scene:node_deleted', { id });
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): SceneNode | undefined {
    return this.nodeData.get(id);
  }

  /**
   * Get the Three.js object for a node
   */
  getNodeObject(id: string): THREE.Object3D | undefined {
    return this.nodes.get(id);
  }

  /**
   * Rename a node
   */
  renameNode(id: string, newName: string): void {
    const node = this.nodeData.get(id);
    if (!node) return;

    node.name = newName;
    this.eventBus.emit('scene:node_renamed', { id, name: newName });
  }

  // ============================================
  // TRANSFORM
  // ============================================

  /**
   * Set node transform
   */
  setTransform(id: string, transform: Partial<Transform>): void {
    const obj = this.nodes.get(id);
    const node = this.nodeData.get(id);
    if (!obj || !node) return;

    if (transform.position) {
      node.transform.position = transform.position;
      obj.position.set(transform.position.x, transform.position.y, transform.position.z);
    }
    if (transform.rotation) {
      node.transform.rotation = transform.rotation;
      obj.quaternion.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w);
    }
    if (transform.scale) {
      node.transform.scale = transform.scale;
      obj.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
    }

    this.eventBus.emit('scene:node_transformed', { id, transform });
  }

  /**
   * Get node transform
   */
  getTransform(id: string): Transform | undefined {
    return this.nodeData.get(id)?.transform;
  }

  // ============================================
  // HIERARCHY
  // ============================================

  /**
   * Set node parent
   */
  setParent(id: string, newParentId: string | null): void {
    const obj = this.nodes.get(id);
    const node = this.nodeData.get(id);
    if (!obj || !node) return;

    const oldParentId = node.parentId;

    // Remove from old parent
    if (oldParentId) {
      const oldParent = this.nodes.get(oldParentId);
      if (oldParent) {
        oldParent.remove(obj);
        const oldParentData = this.nodeData.get(oldParentId);
        if (oldParentData) {
          oldParentData.childrenIds = oldParentData.childrenIds.filter(cid => cid !== id);
        }
      }
    } else {
      this.scene.remove(obj);
      if (this.sceneData) {
        this.sceneData.rootNodes = this.sceneData.rootNodes.filter(rid => rid !== id);
      }
    }

    // Add to new parent
    node.parentId = newParentId;
    if (newParentId) {
      const newParent = this.nodes.get(newParentId);
      if (newParent) {
        newParent.add(obj);
        const newParentData = this.nodeData.get(newParentId);
        if (newParentData) {
          newParentData.childrenIds.push(id);
        }
      }
    } else {
      this.scene.add(obj);
      if (this.sceneData) {
        this.sceneData.rootNodes.push(id);
      }
    }

    this.eventBus.emit('scene:node_reparented', { id, oldParentId, newParentId });
  }

  /**
   * Get root nodes
   */
  getRootNodeIds(): string[] {
    const roots: string[] = [];
    this.nodeData.forEach((node, id) => {
      if (node.parentId === null) {
        roots.push(id);
      }
    });
    return roots;
  }

  /**
   * Get children of a node
   */
  getChildren(id: string): SceneNode[] {
    const node = this.nodeData.get(id);
    if (!node) return [];

    return node.childrenIds
      .map(cid => this.nodeData.get(cid))
      .filter((n): n is SceneNode => n !== undefined);
  }

  // ============================================
  // SELECTION
  // ============================================

  /**
   * Select a node
   */
  selectNode(id: string, addToSelection: boolean = false): void {
    if (!addToSelection) {
      this.selectedNodes.clear();
    }
    this.selectedNodes.add(id);
    this.activeNodeId = id;

    this.eventBus.emit('scene:node_selected', { id, selected: Array.from(this.selectedNodes) });
  }

  /**
   * Deselect a node
   */
  deselectNode(id: string): void {
    this.selectedNodes.delete(id);
    if (this.activeNodeId === id) {
      this.activeNodeId = this.selectedNodes.size > 0 
        ? Array.from(this.selectedNodes)[this.selectedNodes.size - 1] 
        : null;
    }

    this.eventBus.emit('scene:node_deselected', { id, selected: Array.from(this.selectedNodes) });
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedNodes.clear();
    this.activeNodeId = null;

    this.eventBus.emit('scene:selection_cleared', {});
  }

  /**
   * Get selected nodes
   */
  getSelectedNodes(): SceneNode[] {
    return Array.from(this.selectedNodes)
      .map(id => this.nodeData.get(id))
      .filter((n): n is SceneNode => n !== undefined);
  }

  /**
   * Get active node
   */
  getActiveNode(): SceneNode | null {
    if (!this.activeNodeId) return null;
    return this.nodeData.get(this.activeNodeId) || null;
  }

  // ============================================
  // UNDO/REDO
  // ============================================

  private pushUndo(): void {
    if (!this.sceneData) return;

    const snapshot = this.saveScene();
    if (!snapshot) return;
    this.undoStack.push(snapshot);

    // Limit undo stack
    if (this.undoStack.length > this.maxUndoLevels) {
      this.undoStack.shift();
    }

    // Clear redo stack
    this.redoStack = [];
  }

  /**
   * Undo last action
   */
  async undo(): Promise<void> {
    if (this.undoStack.length === 0) return;

    // Save current state to redo stack
    if (this.sceneData) {
      const snapshot = this.saveScene();
      if (snapshot) {
        this.redoStack.push(snapshot);
      }
    }

    // Restore previous state
    const previous = this.undoStack.pop();
    if (previous) {
      await this.loadScene(previous);
    }

    this.eventBus.emit('scene:undo', {});
  }

  /**
   * Redo last undone action
   */
  async redo(): Promise<void> {
    if (this.redoStack.length === 0) return;

    // Save current state to undo stack
    if (this.sceneData) {
      const snapshot = this.saveScene();
      if (snapshot) {
        this.undoStack.push(snapshot);
      }
    }

    // Restore next state
    const next = this.redoStack.pop();
    if (next) {
      await this.loadScene(next);
    }

    this.eventBus.emit('scene:redo', {});
  }

  /**
   * Check if can undo
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if can redo
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // ============================================
  // ENVIRONMENT
  // ============================================

  /**
   * Set ambient settings
   */
  setAmbient(color: THREE.Color, intensity: number): void {
    if (!this.sceneData) return;

    this.sceneData.environment.ambientColor = { 
      r: color.r, g: color.g, b: color.b 
    };
    this.sceneData.environment.ambientIntensity = intensity;

    this.eventBus.emit('scene:ambient_changed', { color, intensity });
  }

  /**
   * Set fog settings
   */
  setFog(enabled: boolean, options?: Partial<SceneData['environment']>): void {
    if (!this.sceneData) return;

    this.sceneData.environment.fogEnabled = enabled;
    
    if (options) {
      Object.assign(this.sceneData.environment, options);
    }

    if (enabled) {
      if (this.sceneData.environment.fogType === 'linear') {
        this.scene.fog = new THREE.Fog(
          new THREE.Color(
            this.sceneData.environment.fogColor?.r ?? 0.8,
            this.sceneData.environment.fogColor?.g ?? 0.8,
            this.sceneData.environment.fogColor?.b ?? 0.8
          ),
          this.sceneData.environment.fogNear,
          this.sceneData.environment.fogFar
        );
      } else {
        this.scene.fog = new THREE.FogExp2(
          new THREE.Color(
            this.sceneData.environment.fogColor?.r ?? 0.8,
            this.sceneData.environment.fogColor?.g ?? 0.8,
            this.sceneData.environment.fogColor?.b ?? 0.8
          ),
          this.sceneData.environment.fogDensity!
        );
      }
    } else {
      this.scene.fog = null;
    }

    this.eventBus.emit('scene:fog_changed', { enabled });
  }

  private setupEnvironment(): void {
    if (!this.sceneData) return;

    // Set background
    this.scene.background = new THREE.Color(0x1a1a1e);

    // Setup fog if enabled
    if (this.sceneData.environment.fogEnabled) {
      this.setFog(true, this.sceneData.environment);
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createThreeObject(node: SceneNode): THREE.Object3D {
    const obj = new THREE.Object3D();
    obj.name = node.name;
    obj.position.set(node.transform.position.x, node.transform.position.y, node.transform.position.z);
    obj.quaternion.set(
      node.transform.rotation.x,
      node.transform.rotation.y,
      node.transform.rotation.z,
      node.transform.rotation.w
    );
    obj.scale.set(node.transform.scale.x, node.transform.scale.y, node.transform.scale.z);
    obj.visible = node.active;
    return obj;
  }

  private async createNodeFromData(node: SceneNode): Promise<void> {
    const obj = this.createThreeObject(node);
    this.nodes.set(node.id, obj);
    this.nodeData.set(node.id, node);

    // Add to parent or scene
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent) {
        parent.add(obj);
      }
    } else {
      this.scene.add(obj);
    }
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  }

  // ============================================
  // GETTERS
  // ============================================

  /**
   * Get the Three.js scene
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Get scene data
   */
  getSceneData(): SceneData | null {
    return this.sceneData;
  }

  /**
   * Get all nodes
   */
  getAllNodes(): SceneNode[] {
    return Array.from(this.nodeData.values());
  }

  /**
   * Get node count
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  // ============================================
  // DISPOSE
  // ============================================

  /**
   * Dispose the scene manager
   */
  dispose(): void {
    this.clearScene();
    this.undoStack = [];
    this.redoStack = [];
    this.sceneData = null;

    this.eventBus.emit('scene:disposed', {});
    console.log('[SceneManager] Disposed');
  }
}

// ============================================
// SINGLETON
// ============================================

let sceneManagerInstance: SceneManager | null = null;

export function createSceneManager(eventBus: EventBus, ecs: ECS): SceneManager {
  if (!sceneManagerInstance) {
    sceneManagerInstance = new SceneManager(eventBus, ecs);
  }
  return sceneManagerInstance;
}

export function getSceneManager(): SceneManager | null {
  return sceneManagerInstance;
}
