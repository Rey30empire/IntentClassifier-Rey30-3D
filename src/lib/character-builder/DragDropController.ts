/**
 * CharacterLibraryBuilder - Drag & Drop Controller
 * 
 * Sistema de drag and drop para el equipamiento de piezas
 */

import {
  DragState,
  DropZone,
  SocketName,
  PartCategory,
  AssetMetadata,
  CategoryToSocket,
} from './types';

// ============================================
// DRAG DROP CONTROLLER
// ============================================

export class DragDropController {
  private state: DragState;
  private dropZones: Map<SocketName, DropZone> = new Map();
  private onDragStart?: (assetId: string) => void;
  private onDragEnd?: (assetId: string, dropped: boolean, socket?: SocketName) => void;
  private onDropZoneEnter?: (socket: SocketName) => void;
  private onDropZoneLeave?: (socket: SocketName) => void;

  constructor() {
    this.state = this.createDefaultState();
    this.initializeDefaultDropZones();
  }

  private createDefaultState(): DragState {
    return {
      isDragging: false,
      assetId: null,
      sourceCategory: null,
      currentDropZone: null,
      validDropZones: [],
    };
  }

  private initializeDefaultDropZones(): void {
    // Default socket positions (normalized 0-1 relative to character)
    const defaultPositions: Record<SocketName, { x: number; y: number; z: number }> = {
      head_socket: { x: 0, y: 1.6, z: 0 },
      hair_socket: { x: 0, y: 1.65, z: -0.05 },
      neck_socket: { x: 0, y: 1.5, z: 0 },
      torso_socket: { x: 0, y: 1.2, z: 0 },
      left_arm_socket: { x: -0.3, y: 1.3, z: 0 },
      right_arm_socket: { x: 0.3, y: 1.3, z: 0 },
      left_hand_socket: { x: -0.35, y: 0.9, z: 0 },
      right_hand_socket: { x: 0.35, y: 0.9, z: 0 },
      legs_socket: { x: 0, y: 0.6, z: 0 },
      feet_socket: { x: 0, y: 0.1, z: 0 },
      back_socket: { x: 0, y: 1.3, z: -0.2 },
      waist_socket: { x: 0, y: 0.9, z: 0 },
      shoulder_left_socket: { x: -0.25, y: 1.4, z: 0 },
      shoulder_right_socket: { x: 0.25, y: 1.4, z: 0 },
    };

    for (const [socketName, position] of Object.entries(defaultPositions)) {
      const socket = socketName as SocketName;
      this.dropZones.set(socket, {
        socketName: socket,
        position,
        radius: 0.15,
        highlighted: false,
        valid: false,
      });
    }
  }

  // ===== DRAG OPERATIONS =====

  /**
   * Start dragging an asset
   */
  startDrag(asset: AssetMetadata): void {
    const validSockets = this.getValidDropZones(asset.category);
    
    this.state = {
      isDragging: true,
      assetId: asset.id,
      sourceCategory: asset.category,
      currentDropZone: null,
      validDropZones: validSockets,
    };

    // Highlight valid drop zones
    for (const socket of validSockets) {
      const zone = this.dropZones.get(socket);
      if (zone) {
        zone.valid = true;
      }
    }

    this.onDragStart?.(asset.id);
  }

  /**
   * Update drag position
   */
  updateDrag(position: { x: number; y: number; z: number }): SocketName | null {
    if (!this.state.isDragging) return null;

    // Find closest valid drop zone
    let closestSocket: SocketName | null = null;
    let closestDistance = Infinity;

    for (const socketName of this.state.validDropZones) {
      const zone = this.dropZones.get(socketName);
      if (!zone) continue;

      const distance = Math.sqrt(
        (position.x - zone.position.x) ** 2 +
        (position.y - zone.position.y) ** 2 +
        (position.z - zone.position.z) ** 2
      );

      if (distance < zone.radius && distance < closestDistance) {
        closestDistance = distance;
        closestSocket = socketName;
      }
    }

    // Update highlight state
    if (closestSocket !== this.state.currentDropZone) {
      // Leave previous zone
      if (this.state.currentDropZone) {
        const prevZone = this.dropZones.get(this.state.currentDropZone);
        if (prevZone) {
          prevZone.highlighted = false;
          this.onDropZoneLeave?.(this.state.currentDropZone);
        }
      }

      // Enter new zone
      if (closestSocket) {
        const newZone = this.dropZones.get(closestSocket);
        if (newZone) {
          newZone.highlighted = true;
          this.onDropZoneEnter?.(closestSocket);
        }
      }

      this.state.currentDropZone = closestSocket;
    }

    return closestSocket;
  }

  /**
   * End drag operation
   */
  endDrag(dropped: boolean): SocketName | null {
    const resultSocket = dropped ? this.state.currentDropZone : null;
    const assetId = this.state.assetId;

    // Clear highlights
    for (const [, zone] of this.dropZones) {
      zone.highlighted = false;
      zone.valid = false;
    }

    // Store state before reset
    const previousSocket = this.state.currentDropZone;

    // Reset state
    this.state = this.createDefaultState();

    if (assetId) {
      this.onDragEnd?.(assetId, dropped, resultSocket ?? undefined);
    }

    return dropped ? previousSocket : null;
  }

  /**
   * Cancel drag operation
   */
  cancelDrag(): void {
    this.endDrag(false);
  }

  // ===== DROP ZONE MANAGEMENT =====

  /**
   * Get valid drop zones for a category
   */
  getValidDropZones(category: PartCategory): SocketName[] {
    return CategoryToSocket[category] ?? [];
  }

  /**
   * Get all drop zones
   */
  getDropZones(): DropZone[] {
    return Array.from(this.dropZones.values());
  }

  /**
   * Get drop zone by socket name
   */
  getDropZone(socket: SocketName): DropZone | undefined {
    return this.dropZones.get(socket);
  }

  /**
   * Update drop zone position
   */
  setDropZonePosition(socket: SocketName, position: { x: number; y: number; z: number }): void {
    const zone = this.dropZones.get(socket);
    if (zone) {
      zone.position = position;
    }
  }

  /**
   * Update drop zone radius
   */
  setDropZoneRadius(socket: SocketName, radius: number): void {
    const zone = this.dropZones.get(socket);
    if (zone) {
      zone.radius = radius;
    }
  }

  // ===== STATE ACCESS =====

  /**
   * Get current drag state
   */
  getState(): DragState {
    return { ...this.state };
  }

  /**
   * Check if currently dragging
   */
  get isDragging(): boolean {
    return this.state.isDragging;
  }

  /**
   * Get currently dragged asset ID
   */
  get draggedAssetId(): string | null {
    return this.state.assetId;
  }

  /**
   * Get current drop zone
   */
  get currentDropZone(): SocketName | null {
    return this.state.currentDropZone;
  }

  // ===== CALLBACKS =====

  /**
   * Set drag start callback
   */
  setOnDragStart(callback: (assetId: string) => void): void {
    this.onDragStart = callback;
  }

  /**
   * Set drag end callback
   */
  setOnDragEnd(callback: (assetId: string, dropped: boolean, socket?: SocketName) => void): void {
    this.onDragEnd = callback;
  }

  /**
   * Set drop zone enter callback
   */
  setOnDropZoneEnter(callback: (socket: SocketName) => void): void {
    this.onDropZoneEnter = callback;
  }

  /**
   * Set drop zone leave callback
   */
  setOnDropZoneLeave(callback: (socket: SocketName) => void): void {
    this.onDropZoneLeave = callback;
  }

  // ===== 2D PROJECTION HELPERS =====

  /**
   * Project 3D position to 2D screen coordinates
   */
  projectToScreen(
    position: { x: number; y: number; z: number },
    camera: {
      position: { x: number; y: number; z: number };
      fov: number;
      aspect: number;
      rotation: { x: number; y: number };
    },
    screenBounds: { width: number; height: number }
  ): { x: number; y: number } {
    // Simple orthographic-like projection for character preview
    const distance = 3; // Distance from camera to character
    const scale = screenBounds.height / (2 * Math.tan((camera.fov * Math.PI) / 360));

    // Apply camera rotation
    const cosX = Math.cos(camera.rotation.x);
    const sinX = Math.sin(camera.rotation.x);
    const cosY = Math.cos(camera.rotation.y);
    const sinY = Math.sin(camera.rotation.y);

    // Rotate point
    const x1 = position.x * cosY - position.z * sinY;
    const z1 = position.x * sinY + position.z * cosY;
    const y1 = position.y * cosX - z1 * sinX;

    // Project to screen
    const screenX = screenBounds.width / 2 + x1 * scale / distance;
    const screenY = screenBounds.height / 2 - y1 * scale / distance;

    return { x: screenX, y: screenY };
  }

  /**
   * Check if screen point is over drop zone
   */
  getDropZoneAtScreenPoint(
    screenX: number,
    screenY: number,
    camera: {
      position: { x: number; y: number; z: number };
      fov: number;
      aspect: number;
      rotation: { x: number; y: number };
    },
    screenBounds: { width: number; height: number }
  ): SocketName | null {
    if (!this.state.isDragging) return null;

    for (const socketName of this.state.validDropZones) {
      const zone = this.dropZones.get(socketName);
      if (!zone) continue;

      const screenPos = this.projectToScreen(zone.position, camera, screenBounds);
      const radius = zone.radius * screenBounds.height / 3;

      const distance = Math.sqrt(
        (screenX - screenPos.x) ** 2 +
        (screenY - screenPos.y) ** 2
      );

      if (distance < radius) {
        return socketName;
      }
    }

    return null;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let _dragDropController: DragDropController | null = null;

/**
 * Get the DragDropController singleton
 */
export function getDragDropController(): DragDropController {
  if (!_dragDropController) {
    _dragDropController = new DragDropController();
  }
  return _dragDropController;
}

/**
 * Create a new DragDropController instance
 */
export function createDragDropController(): DragDropController {
  return new DragDropController();
}
