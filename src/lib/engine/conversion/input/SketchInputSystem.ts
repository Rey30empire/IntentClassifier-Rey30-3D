/**
 * NEXUS Engine - Sketch Input System
 * 
 * Sistema para capturar y gestionar dibujos 2D creados dentro de la app
 */

import {
  SketchSession,
  SketchLayer,
  SketchView,
  Stroke,
  Point2D,
  ViewLabel,
  generateId,
  rgba,
} from '../types';

/**
 * Sketch Input System
 * 
 * Maneja la captura, almacenamiento y gestión de dibujos vectoriales
 */
export class SketchInputSystem {
  private sessions: Map<string, SketchSession> = new Map();
  private activeSessionId: string | null = null;

  /**
   * Create a new sketch session
   */
  createSession(name = 'Untitled Sketch', width = 1024, height = 1024): SketchSession {
    const session: SketchSession = {
      id: generateId(),
      name,
      strokes: new Map(),
      layers: new Map(),
      activeLayerId: '',
      width,
      height,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create default layer
    const defaultLayer = this.createLayer('Layer 1');
    session.layers.set(defaultLayer.id, defaultLayer);
    session.activeLayerId = defaultLayer.id;

    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;

    return session;
  }

  /**
   * Create a new layer
   */
  createLayer(name: string): SketchLayer {
    return {
      id: generateId(),
      name,
      visible: true,
      opacity: 1,
      strokeIds: [],
    };
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SketchSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get active session
   */
  getActiveSession(): SketchSession | undefined {
    if (!this.activeSessionId) return undefined;
    return this.sessions.get(this.activeSessionId);
  }

  /**
   * Set active session
   */
  setActiveSession(sessionId: string): boolean {
    if (this.sessions.has(sessionId)) {
      this.activeSessionId = sessionId;
      return true;
    }
    return false;
  }

  /**
   * Capture a stroke
   */
  captureStroke(
    sessionId: string,
    points: Point2D[],
    options: Partial<{
      pressures: number[];
      color: { r: number; g: number; b: number; a?: number };
      width: number;
      layerId: string;
      closed: boolean;
    }> = {}
  ): Stroke | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const layerId = options.layerId ?? session.activeLayerId;
    const layer = session.layers.get(layerId);
    if (!layer) return null;

    const stroke: Stroke = {
      id: generateId(),
      points: points.map(p => ({ ...p })),
      pressures: options.pressures ?? points.map(() => 1),
      color: options.color ? rgba(options.color.r, options.color.g, options.color.b, options.color.a ?? 1) : rgba(0, 0, 0, 1),
      width: options.width ?? 2,
      layerId,
      closed: options.closed ?? false,
    };

    session.strokes.set(stroke.id, stroke);
    layer.strokeIds.push(stroke.id);
    session.updatedAt = new Date();

    return stroke;
  }

  /**
   * Erase stroke
   */
  eraseStroke(sessionId: string, strokeId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const stroke = session.strokes.get(strokeId);
    if (!stroke) return false;

    // Remove from layer
    const layer = session.layers.get(stroke.layerId);
    if (layer) {
      layer.strokeIds = layer.strokeIds.filter(id => id !== strokeId);
    }

    session.strokes.delete(strokeId);
    session.updatedAt = new Date();

    return true;
  }

  /**
   * Add layer to session
   */
  addLayer(sessionId: string, layer: SketchLayer): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.layers.set(layer.id, layer);
    session.updatedAt = new Date();
    return true;
  }

  /**
   * Remove layer from session
   */
  removeLayer(sessionId: string, layerId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const layer = session.layers.get(layerId);
    if (!layer) return false;

    // Remove all strokes from layer
    for (const strokeId of layer.strokeIds) {
      session.strokes.delete(strokeId);
    }

    session.layers.delete(layerId);

    // Set new active layer if needed
    if (session.activeLayerId === layerId) {
      const remainingLayers = Array.from(session.layers.keys());
      session.activeLayerId = remainingLayers[0] ?? '';
    }

    session.updatedAt = new Date();
    return true;
  }

  /**
   * Set active layer
   */
  setActiveLayer(sessionId: string, layerId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.layers.has(layerId)) return false;

    session.activeLayerId = layerId;
    session.updatedAt = new Date();
    return true;
  }

  /**
   * Move stroke to different layer
   */
  moveStrokeToLayer(sessionId: string, strokeId: string, targetLayerId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const stroke = session.strokes.get(strokeId);
    const targetLayer = session.layers.get(targetLayerId);
    if (!stroke || !targetLayer) return false;

    // Remove from current layer
    const currentLayer = session.layers.get(stroke.layerId);
    if (currentLayer) {
      currentLayer.strokeIds = currentLayer.strokeIds.filter(id => id !== strokeId);
    }

    // Add to target layer
    stroke.layerId = targetLayerId;
    targetLayer.strokeIds.push(strokeId);
    session.updatedAt = new Date();

    return true;
  }

  /**
   * Clear all strokes from session
   */
  clearSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.strokes.clear();
    for (const layer of session.layers.values()) {
      layer.strokeIds = [];
    }
    session.updatedAt = new Date();

    return true;
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string): boolean {
    if (sessionId === this.activeSessionId) {
      this.activeSessionId = null;
    }
    return this.sessions.delete(sessionId);
  }

  /**
   * Create a sketch view (for multi-view input)
   */
  createView(sessionId: string, label: ViewLabel, angle: number): SketchView | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      id: generateId(),
      label,
      angle,
      session,
    };
  }

  /**
   * Get all strokes as flat array
   */
  getAllStrokes(sessionId: string): Stroke[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return Array.from(session.strokes.values());
  }

  /**
   * Get strokes for a specific layer
   */
  getLayerStrokes(sessionId: string, layerId: string): Stroke[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const layer = session.layers.get(layerId);
    if (!layer) return [];

    return layer.strokeIds
      .map(id => session.strokes.get(id))
      .filter((s): s is Stroke => s !== undefined);
  }

  /**
   * Export session to serializable format
   */
  exportSession(sessionId: string): SerializedSketchSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      id: session.id,
      name: session.name,
      strokes: Array.from(session.strokes.entries()),
      layers: Array.from(session.layers.entries()),
      activeLayerId: session.activeLayerId,
      width: session.width,
      height: session.height,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  /**
   * Import session from serialized format
   */
  importSession(data: SerializedSketchSession): SketchSession {
    const session: SketchSession = {
      id: data.id,
      name: data.name,
      strokes: new Map(data.strokes),
      layers: new Map(data.layers),
      activeLayerId: data.activeLayerId,
      width: data.width,
      height: data.height,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): SketchSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Check if session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

/** Serialized sketch session format */
export interface SerializedSketchSession {
  id: string;
  name: string;
  strokes: Array<[string, Stroke]>;
  layers: Array<[string, SketchLayer]>;
  activeLayerId: string;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Factory function to create SketchInputSystem
 */
export function createSketchInputSystem(): SketchInputSystem {
  return new SketchInputSystem();
}
