/**
 * NEXUS Engine - React Hooks
 * 
 * Hooks para integrar el motor con componentes React
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { EngineLoop } from '../core/GameLoop';
import { EngineTime } from '../core/TimeSystem';
import { EngineWorld } from '../ecs/ECS';
import { Events, EngineEvents } from '../core/EventSystem';
import { Input } from '../input/InputSystem';
import type { ComponentType } from '../ecs/ECS';

// ============================================
// GAME LOOP HOOKS
// ============================================

/**
 * Hook para suscribirse al update loop
 */
export function useUpdate(callback: (deltaTime: number) => void, deps: unknown[] = []) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const unsubscribe = EngineLoop.registerUpdate((dt) => callbackRef.current(dt));
    return unsubscribe;
  }, deps);
}

/**
 * Hook para suscribirse al fixed update (physics)
 */
export function useFixedUpdate(callback: (fixedDeltaTime: number) => void, deps: unknown[] = []) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const unsubscribe = EngineLoop.registerFixedUpdate((dt) => callbackRef.current(dt));
    return unsubscribe;
  }, deps);
}

/**
 * Hook para suscribirse al render loop
 */
export function useRender(callback: (interpolation: number) => void, deps: unknown[] = []) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const unsubscribe = EngineLoop.registerRender((interp) => callbackRef.current(interp));
    return unsubscribe;
  }, deps);
}

/**
 * Hook para suscribirse al late update
 */
export function useLateUpdate(callback: (deltaTime: number) => void, deps: unknown[] = []) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const unsubscribe = EngineLoop.registerLateUpdate((dt) => callbackRef.current(dt));
    return unsubscribe;
  }, deps);
}

/**
 * Hook para obtener stats del motor
 */
export function useEngineStats() {
  const [stats, setStats] = useState(EngineLoop.getStats());

  useUpdate(() => {
    setStats(EngineLoop.getStats());
  }, []);

  return stats;
}

/**
 * Hook para obtener tiempo del motor
 */
export function useEngineTime() {
  const [time, setTime] = useState(EngineTime.current);

  useUpdate(() => {
    setTime(EngineTime.current);
  }, []);

  return time;
}

// ============================================
// INPUT HOOKS
// ============================================

/**
 * Hook para estado de tecla
 */
export function useKey(code: string) {
  const [state, setState] = useState({
    pressed: false,
    justPressed: false,
    justReleased: false,
  });

  useUpdate(() => {
    setState({
      pressed: Input.isKeyDown(code),
      justPressed: Input.isKeyJustPressed(code),
      justReleased: Input.isKeyJustReleased(code),
    });
  }, [code]);

  return state;
}

/**
 * Hook para posición del mouse
 */
export function useMouse() {
  const [mouse, setMouse] = useState({
    position: Input.mousePosition,
    delta: Input.mouseDelta,
    wheel: Input.mouseWheel,
    leftButton: false,
    rightButton: false,
    middleButton: false,
  });

  useUpdate(() => {
    setMouse({
      position: Input.mousePosition,
      delta: Input.mouseDelta,
      wheel: Input.mouseWheel,
      leftButton: Input.isMouseButtonDown(0),
      rightButton: Input.isMouseButtonDown(2),
      middleButton: Input.isMouseButtonDown(1),
    });
  }, []);

  return mouse;
}

/**
 * Hook para input actions
 */
export function useInputAction(name: string) {
  const [state, setState] = useState({
    active: false,
    justActivated: false,
    justDeactivated: false,
  });

  useUpdate(() => {
    setState({
      active: Input.isActionActive(name),
      justActivated: Input.isActionJustActivated(name),
      justDeactivated: Input.isActionJustDeactivated(name),
    });
  }, [name]);

  return state;
}

// ============================================
// EVENT HOOKS
// ============================================

/**
 * Hook para suscribirse a eventos del motor
 */
export function useEvent<T extends keyof EngineEvents>(
  event: T,
  callback: (data: EngineEvents[T]) => void,
  deps: unknown[] = []
) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const unsubscribe = Events.on(event, (data) => callbackRef.current(data as EngineEvents[T]));
    return unsubscribe;
  }, [event, ...deps]);
}

// ============================================
// ECS HOOKS
// ============================================

/**
 * Hook para crear una entidad
 */
export function useCreateEntity(name?: string, components?: ComponentType[]) {
  const [entity, setEntity] = useState<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    
    const e = EngineWorld.createEntity(name);
    if (components) {
      for (const comp of components) {
        EngineWorld.addComponent(e, comp);
      }
    }
    // Use queueMicrotask to defer setState
    queueMicrotask(() => setEntity(e));

    return () => {
      EngineWorld.destroyEntity(e);
    };
  }, []);

  return entity;
}

/**
 * Hook para obtener componente de entidad
 */
export function useComponent<T extends ComponentType>(
  entity: number | null,
  type: T['__componentType']
) {
  const [component, setComponent] = useState<T | null>(null);

  useUpdate(() => {
    if (entity !== null) {
      setComponent(EngineWorld.getComponent(entity, type) as T | null);
    }
  }, [entity, type]);

  return component;
}

/**
 * Hook para contar entidades
 */
export function useEntityCount() {
  const [count, setCount] = useState(EngineWorld.entityCount);

  useUpdate(() => {
    setCount(EngineWorld.entityCount);
  }, []);

  return count;
}

// ============================================
// ENGINE INITIALIZATION HOOK
// ============================================

/**
 * Hook para inicializar el motor
 */
export function useEngineInit() {
  const [initialized, setInitialized] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    
    // Initialize input
    Input.initialize();
    
    // Start game loop
    EngineLoop.start();

    // Register late update for input reset
    const unsubLateUpdate = EngineLoop.registerLateUpdate(() => {
      Input.lateUpdate();
    });

    // Emit engine started event
    Events.emit('engine:started', {});
    
    // Defer setState to avoid cascading renders
    queueMicrotask(() => setInitialized(true));

    return () => {
      unsubLateUpdate();
      EngineLoop.stop();
      Input.destroy();
      Events.clear();
    };
  }, []);

  return initialized;
}

/**
 * Hook para pausar/resumir el motor
 */
export function useEnginePause() {
  const [paused, setPaused] = useState(false);

  const pause = useCallback(() => {
    EngineLoop.pause();
    setPaused(true);
    Events.emit('engine:paused', {});
  }, []);

  const resume = useCallback(() => {
    EngineLoop.resume();
    setPaused(false);
    Events.emit('engine:resumed', {});
  }, []);

  const toggle = useCallback(() => {
    if (paused) {
      resume();
    } else {
      pause();
    }
  }, [paused, pause, resume]);

  return { paused, pause, resume, toggle };
}

/**
 * Hook para time scale
 */
export function useTimeScale() {
  const [scale, setScale] = useState(EngineTime.current.timeScale);

  const setTimeScale = useCallback((newScale: number) => {
    EngineTime.setTimeScale(newScale);
    setScale(newScale);
  }, []);

  return { scale, setTimeScale };
}
