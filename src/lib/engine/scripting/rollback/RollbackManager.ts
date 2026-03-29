/**
 * Rollback Manager
 * 
 * Manages scene snapshots and provides undo/redo capabilities
 * for the Multi-Script System.
 */

import {
  SnapshotId,
  ActionId,
  EntityId,
  UndoSnapshot,
  EntityState,
  PropertyChange,
  SnapshotInfo,
} from '../types';

// ============================================
// ROLLBACK MANAGER
// ============================================

export class RollbackManager {
  private snapshots: Map<SnapshotId, UndoSnapshot> = new Map();
  private snapshotHistory: SnapshotId[] = [];
  private currentIndex: number = -1;
  private maxSnapshots: number = 50;
  private onSnapshotCreated?: (snapshot: UndoSnapshot) => void;
  private onSnapshotRestored?: (snapshot: UndoSnapshot) => void;
  private getEntityState?: (entityId: EntityId) => EntityState | null;
  private restoreEntityState?: (entityId: EntityId, state: EntityState) => void;

  constructor(maxSnapshots: number = 50) {
    this.maxSnapshots = maxSnapshots;
  }

  // ============================================
  // CALLBACKS
  // ============================================

  setCallbacks(callbacks: {
    onSnapshotCreated?: (snapshot: UndoSnapshot) => void;
    onSnapshotRestored?: (snapshot: UndoSnapshot) => void;
    getEntityState?: (entityId: EntityId) => EntityState | null;
    restoreEntityState?: (entityId: EntityId, state: EntityState) => void;
  }): void {
    this.onSnapshotCreated = callbacks.onSnapshotCreated;
    this.onSnapshotRestored = callbacks.onSnapshotRestored;
    this.getEntityState = callbacks.getEntityState;
    this.restoreEntityState = callbacks.restoreEntityState;
  }

  // ============================================
  // SNAPSHOT MANAGEMENT
  // ============================================

  /**
   * Create a snapshot of the current state
   */
  createSnapshot(
    actionId: ActionId,
    entityId?: EntityId,
    transactionId?: string
  ): SnapshotId {
    const snapshotId = this.generateSnapshotId();
    const entityStates = new Map<EntityId, EntityState>();
    const modifiedProperties: PropertyChange[] = [];

    // Capture entity state if provided
    if (entityId && this.getEntityState) {
      const state = this.getEntityState(entityId);
      if (state) {
        entityStates.set(entityId, state);
      }
    }

    const snapshot: UndoSnapshot = {
      id: snapshotId,
      timestamp: new Date(),
      action_id: actionId,
      transaction_id: transactionId,
      entity_states: entityStates,
      created_entities: [],
      deleted_entities: [],
      modified_properties: modifiedProperties,
    };

    // Add to history
    this.snapshots.set(snapshotId, snapshot);
    
    // If we're not at the end of history, remove future snapshots
    if (this.currentIndex < this.snapshotHistory.length - 1) {
      const toRemove = this.snapshotHistory.splice(this.currentIndex + 1);
      for (const id of toRemove) {
        this.snapshots.delete(id);
      }
    }
    
    this.snapshotHistory.push(snapshotId);
    this.currentIndex = this.snapshotHistory.length - 1;

    // Enforce max snapshots
    while (this.snapshotHistory.length > this.maxSnapshots) {
      const removed = this.snapshotHistory.shift()!;
      this.snapshots.delete(removed);
      this.currentIndex--;
    }

    // Callback
    this.onSnapshotCreated?.(snapshot);

    return snapshotId;
  }

  /**
   * Restore a snapshot
   */
  async restoreSnapshot(snapshotId: SnapshotId): Promise<boolean> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      console.error(`[RollbackManager] Snapshot not found: ${snapshotId}`);
      return false;
    }

    // Restore entity states
    if (this.restoreEntityState) {
      for (const [entityId, state] of snapshot.entity_states) {
        this.restoreEntityState(entityId, state);
      }
    }

    // Update current index
    const index = this.snapshotHistory.indexOf(snapshotId);
    if (index !== -1) {
      this.currentIndex = index;
    }

    // Callback
    this.onSnapshotRestored?.(snapshot);

    return true;
  }

  /**
   * Undo to previous state
   */
  async undo(): Promise<SnapshotId | null> {
    if (!this.canUndo()) {
      return null;
    }

    this.currentIndex--;
    const snapshotId = this.snapshotHistory[this.currentIndex];
    
    if (snapshotId) {
      await this.restoreSnapshot(snapshotId);
      return snapshotId;
    }

    return null;
  }

  /**
   * Redo to next state
   */
  async redo(): Promise<SnapshotId | null> {
    if (!this.canRedo()) {
      return null;
    }

    this.currentIndex++;
    const snapshotId = this.snapshotHistory[this.currentIndex];
    
    if (snapshotId) {
      await this.restoreSnapshot(snapshotId);
      return snapshotId;
    }

    return null;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.snapshotHistory.length - 1;
  }

  // ============================================
  // HISTORY ACCESS
  // ============================================

  /**
   * Get snapshot history info
   */
  getHistory(): SnapshotInfo[] {
    return this.snapshotHistory.map((id, index) => {
      const snapshot = this.snapshots.get(id)!;
      return {
        id,
        timestamp: snapshot.timestamp,
        action_count: snapshot.entity_states.size,
        can_restore: index <= this.currentIndex,
      };
    });
  }

  /**
   * Get current snapshot
   */
  getCurrentSnapshot(): UndoSnapshot | null {
    const currentId = this.snapshotHistory[this.currentIndex];
    return currentId ? this.snapshots.get(currentId) || null : null;
  }

  /**
   * Get snapshot by ID
   */
  getSnapshot(id: SnapshotId): UndoSnapshot | null {
    return this.snapshots.get(id) || null;
  }

  /**
   * Get undo stack size
   */
  getUndoStackSize(): number {
    return this.currentIndex;
  }

  /**
   * Get redo stack size
   */
  getRedoStackSize(): number {
    return this.snapshotHistory.length - this.currentIndex - 1;
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.snapshots.clear();
    this.snapshotHistory = [];
    this.currentIndex = -1;
  }

  // ============================================
  // TRANSACTION SUPPORT
  // ============================================

  /**
   * Begin a transaction group
   */
  beginTransaction(label: string): string {
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store transaction metadata
    const snapshotId = this.createSnapshot(`tx_start_${label}`, undefined, transactionId);
    
    return transactionId;
  }

  /**
   * Commit a transaction
   */
  commitTransaction(transactionId: string): void {
    // Mark transaction as committed
    console.log(`[RollbackManager] Transaction committed: ${transactionId}`);
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(transactionId: string): Promise<boolean> {
    // Find the start snapshot for this transaction
    const startSnapshotId = this.snapshotHistory.find(id => {
      const snapshot = this.snapshots.get(id);
      return snapshot?.transaction_id === transactionId;
    });

    if (startSnapshotId) {
      return this.restoreSnapshot(startSnapshotId);
    }

    return false;
  }

  // ============================================
  // HELPERS
  // ============================================

  private generateSnapshotId(): SnapshotId {
    return `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================
// SINGLETON
// ============================================

let rollbackManagerInstance: RollbackManager | null = null;

export function createRollbackManager(maxSnapshots?: number): RollbackManager {
  if (!rollbackManagerInstance) {
    rollbackManagerInstance = new RollbackManager(maxSnapshots);
  }
  return rollbackManagerInstance;
}

export function getRollbackManager(): RollbackManager | null {
  return rollbackManagerInstance;
}
