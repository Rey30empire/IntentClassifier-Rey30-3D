/**
 * NEXUS Engine - Event System
 * 
 * Sistema de eventos para comunicación entre módulos
 * Basado en el patrón Observer/Pub-Sub
 */

type EventCallback<T = unknown> = (data: T) => void;

interface EventSubscription {
  id: number;
  callback: EventCallback;
  once: boolean;
}

/** Event types for the engine */
export interface EngineEvents {
  // Entity events
  'entity:created': { entity: number; name: string };
  'entity:destroyed': { entity: number };
  'entity:renamed': { entity: number; oldName: string; newName: string };
  
  // Component events
  'component:added': { entity: number; type: string };
  'component:removed': { entity: number; type: string };
  
  // Physics events
  'physics:collision': { 
    entityA: number; 
    entityB: number; 
    point: [number, number, number];
    normal: [number, number, number];
  };
  'physics:trigger-enter': { entity: number; trigger: number };
  'physics:trigger-exit': { entity: number; trigger: number };
  
  // Animation events
  'animation:started': { entity: number; clip: string };
  'animation:ended': { entity: number; clip: string };
  'animation:event': { entity: number; clip: string; eventName: string; time: number };
  
  // Input events
  'input:key-down': { key: string; code: string; repeat: boolean };
  'input:key-up': { key: string; code: string };
  'input:mouse-down': { button: number; x: number; y: number };
  'input:mouse-up': { button: number; x: number; y: number };
  'input:mouse-move': { x: number; y: number; deltaX: number; deltaY: number };
  'input:mouse-wheel': { deltaX: number; deltaY: number };
  'input:gamepad-connected': { index: number; id: string };
  'input:gamepad-disconnected': { index: number };
  
  // Audio events
  'audio:started': { source: number };
  'audio:stopped': { source: number };
  
  // Scene events
  'scene:loaded': { sceneId: string };
  'scene:unloaded': { sceneId: string };
  'scene:saved': { sceneId: string; path: string };
  
  // Engine events
  'engine:started': Record<string, never>;
  'engine:paused': Record<string, never>;
  'engine:resumed': Record<string, never>;
  'engine:stopped': Record<string, never>;
  
  // Editor events
  'editor:selection-changed': { entities: number[] };
  'editor:object-transformed': { entity: number; transform: string };
  'editor:undo': Record<string, never>;
  'editor:redo': Record<string, never>;
}

export type EngineEventType = keyof EngineEvents;
type EventPayload<T extends string> = T extends EngineEventType ? EngineEvents[T] : unknown;

/**
 * EventBus - Central event system
 */
export class EventBus {
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private nextSubscriptionId: number = 0;

  /**
   * Subscribe to an event
   */
  on<T extends string>(
    event: T,
    callback: EventCallback<EventPayload<T>>
  ): () => void {
    const id = this.nextSubscriptionId++;
    
    const subs = this.subscriptions.get(event) || [];
    subs.push({ id, callback: callback as EventCallback, once: false });
    this.subscriptions.set(event, subs);
    
    // Return unsubscribe function
    return () => this.unsubscribe(event, id);
  }

  /**
   * Subscribe to an event (once)
   */
  once<T extends string>(
    event: T,
    callback: EventCallback<EventPayload<T>>
  ): () => void {
    const id = this.nextSubscriptionId++;
    
    const subs = this.subscriptions.get(event) || [];
    subs.push({ id, callback: callback as EventCallback, once: true });
    this.subscriptions.set(event, subs);
    
    return () => this.unsubscribe(event, id);
  }

  /**
   * Emit an event
   */
  emit<T extends string>(
    event: T,
    data: EventPayload<T>
  ): void {
    const subs = this.subscriptions.get(event);
    if (!subs) return;

    const toRemove: number[] = [];

    for (const sub of subs) {
      try {
        sub.callback(data);
        if (sub.once) {
          toRemove.push(sub.id);
        }
      } catch (error) {
        console.error(`[EventBus] Error in event handler for "${event}":`, error);
      }
    }

    // Remove "once" subscriptions
    if (toRemove.length > 0) {
      this.subscriptions.set(
        event,
        subs.filter(s => !toRemove.includes(s.id))
      );
    }
  }

  /**
   * Unsubscribe by ID
   */
  private unsubscribe(event: string, id: number): void {
    const subs = this.subscriptions.get(event);
    if (!subs) return;
    
    this.subscriptions.set(
      event,
      subs.filter(s => s.id !== id)
    );
  }

  /**
   * Clear all subscriptions for an event
   */
  clear(event?: string): void {
    if (event) {
      this.subscriptions.delete(event);
    } else {
      this.subscriptions.clear();
    }
  }

  /**
   * Get subscription count for an event
   */
  subscriptionCount(event: string): number {
    return this.subscriptions.get(event)?.length || 0;
  }
}

// Singleton instance
export const Events = new EventBus();

export function createEventBus(): EventBus {
  return new EventBus();
}

/**
 * Decorator for event-emitting methods
 */
export function EmitEvent<T extends EngineEventType>(eventType: T) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const original = descriptor.value;
    descriptor.value = function (...args: unknown[]) {
      const result = original.apply(this, args);
      Events.emit(eventType, result);
      return result;
    };
    return descriptor;
  };
}
