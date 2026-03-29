/**
 * NEXUS Engine - Input System
 * 
 * Sistema de entrada unificado:
 * - Keyboard
 * - Mouse
 * - Gamepad
 * - Touch (future)
 * 
 * Con action mapping para abstraer controles
 */

import { EventBus, Events } from '../core/EventSystem';

// ============================================
// KEY CODES
// ============================================

export const Keys = {
  // Letters
  A: 'KeyA', B: 'KeyB', C: 'KeyC', D: 'KeyD', E: 'KeyE', F: 'KeyF',
  G: 'KeyG', H: 'KeyH', I: 'KeyI', J: 'KeyJ', K: 'KeyK', L: 'KeyL',
  M: 'KeyM', N: 'KeyN', O: 'KeyO', P: 'KeyP', Q: 'KeyQ', R: 'KeyR',
  S: 'KeyS', T: 'KeyT', U: 'KeyU', V: 'KeyV', W: 'KeyW', X: 'KeyX',
  Y: 'KeyY', Z: 'KeyZ',
  
  // Numbers
  N0: 'Digit0', N1: 'Digit1', N2: 'Digit2', N3: 'Digit3', N4: 'Digit4',
  N5: 'Digit5', N6: 'Digit6', N7: 'Digit7', N8: 'Digit8', N9: 'Digit9',
  
  // Function keys
  F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6',
  F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
  
  // Special keys
  Space: 'Space', Enter: 'Enter', Tab: 'Tab', Escape: 'Escape',
  Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  
  // Arrow keys
  ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
  
  // Modifiers
  ShiftLeft: 'ShiftLeft', ShiftRight: 'ShiftRight',
  ControlLeft: 'ControlLeft', ControlRight: 'ControlRight',
  AltLeft: 'AltLeft', AltRight: 'AltRight',
  MetaLeft: 'MetaLeft', MetaRight: 'MetaRight',
  
  // Symbols
  Minus: 'Minus', Equal: 'Equal', BracketLeft: 'BracketLeft',
  BracketRight: 'BracketRight', Backslash: 'Backslash',
  Semicolon: 'Semicolon', Quote: 'Quote', Backquote: 'Backquote',
  Comma: 'Comma', Period: 'Period', Slash: 'Slash',
} as const;

// ============================================
// MOUSE BUTTONS
// ============================================

export const MouseButtons = {
  Left: 0,
  Middle: 1,
  Right: 2,
  Back: 3,
  Forward: 4,
} as const;

// ============================================
// INPUT STATE
// ============================================

interface KeyState {
  pressed: boolean;
  justPressed: boolean;
  justReleased: boolean;
  repeat: boolean;
}

interface MouseState {
  position: { x: number; y: number };
  delta: { x: number; y: number };
  buttons: Map<number, KeyState>;
  wheel: { x: number; y: number };
}

interface GamepadState {
  connected: boolean;
  id: string;
  buttons: Map<number, KeyState>;
  axes: number[];
}

// ============================================
// ACTION MAPPING
// ============================================

export interface InputAction {
  name: string;
  bindings: InputBinding[];
}

export interface InputBinding {
  type: 'key' | 'mouse' | 'gamepad';
  code: string | number;
  modifiers?: ('shift' | 'ctrl' | 'alt' | 'meta')[];
}

// ============================================
// INPUT SYSTEM
// ============================================

export class InputSystem {
  private keys: Map<string, KeyState> = new Map();
  private mouse: MouseState = {
    position: { x: 0, y: 0 },
    delta: { x: 0, y: 0 },
    buttons: new Map(),
    wheel: { x: 0, y: 0 },
  };
  private gamepads: Map<number, GamepadState> = new Map();
  private actions: Map<string, InputAction> = new Map();
  private actionStates: Map<string, KeyState> = new Map();
  
  private element: HTMLElement | Window =
    typeof window !== 'undefined' ? window : (globalThis as unknown as Window);
  private initialized = false;

  /** Initialize input system */
  initialize(element?: HTMLElement): void {
    if (this.initialized) return;
    
    if (element) {
      this.element = element;
      element.setAttribute('tabindex', '0');
      element.focus();
    }

    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    
    // Mouse events
    this.element.addEventListener('mousedown', this.onMouseDown as EventListener);
    this.element.addEventListener('mouseup', this.onMouseUp as EventListener);
    this.element.addEventListener('mousemove', this.onMouseMove as EventListener);
    this.element.addEventListener('wheel', this.onWheel as EventListener, { passive: false });
    
    // Gamepad events
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);

    this.initialized = true;
  }

  /** Cleanup input system */
  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.element.removeEventListener('mousedown', this.onMouseDown as EventListener);
    this.element.removeEventListener('mouseup', this.onMouseUp as EventListener);
    this.element.removeEventListener('mousemove', this.onMouseMove as EventListener);
    this.element.removeEventListener('wheel', this.onWheel as EventListener);
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    
    this.initialized = false;
  }

  /** Call at end of frame to reset just-pressed states */
  lateUpdate(): void {
    // Reset key states
    for (const [, state] of this.keys) {
      state.justPressed = false;
      state.justReleased = false;
    }
    
    // Reset mouse button states
    for (const [, state] of this.mouse.buttons) {
      state.justPressed = false;
      state.justReleased = false;
    }
    
    // Reset mouse delta/wheel
    this.mouse.delta = { x: 0, y: 0 };
    this.mouse.wheel = { x: 0, y: 0 };
    
    // Reset action states
    for (const [, state] of this.actionStates) {
      state.justPressed = false;
      state.justReleased = false;
    }
    
    // Update gamepad state
    this.updateGamepads();
  }

  // ===== KEYBOARD =====

  /** Check if key is currently pressed */
  isKeyDown(code: string): boolean {
    return this.keys.get(code)?.pressed ?? false;
  }

  /** Check if key was just pressed this frame */
  isKeyJustPressed(code: string): boolean {
    return this.keys.get(code)?.justPressed ?? false;
  }

  /** Check if key was just released this frame */
  isKeyJustReleased(code: string): boolean {
    return this.keys.get(code)?.justReleased ?? false;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const state = this.keys.get(e.code) || {
      pressed: false,
      justPressed: false,
      justReleased: false,
      repeat: false,
    };
    
    if (!state.pressed) {
      state.justPressed = true;
      state.pressed = true;
    }
    state.repeat = e.repeat;
    
    this.keys.set(e.code, state);
    
    // Emit event
    Events.emit('input:key-down', {
      key: e.key,
      code: e.code,
      repeat: e.repeat,
    });
    
    // Update action states
    this.updateActionStates();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const state = this.keys.get(e.code);
    if (state) {
      state.pressed = false;
      state.justReleased = true;
      state.repeat = false;
    }
    
    // Emit event
    Events.emit('input:key-up', {
      key: e.key,
      code: e.code,
    });
    
    // Update action states
    this.updateActionStates();
  };

  // ===== MOUSE =====

  /** Get mouse position */
  get mousePosition(): { x: number; y: number } {
    return { ...this.mouse.position };
  }

  /** Get mouse delta */
  get mouseDelta(): { x: number; y: number } {
    return { ...this.mouse.delta };
  }

  /** Get mouse wheel */
  get mouseWheel(): { x: number; y: number } {
    return { ...this.mouse.wheel };
  }

  /** Check if mouse button is pressed */
  isMouseButtonDown(button: number): boolean {
    return this.mouse.buttons.get(button)?.pressed ?? false;
  }

  /** Check if mouse button was just pressed */
  isMouseButtonJustPressed(button: number): boolean {
    return this.mouse.buttons.get(button)?.justPressed ?? false;
  }

  private onMouseDown = (e: MouseEvent): void => {
    const state = this.mouse.buttons.get(e.button) || {
      pressed: false,
      justPressed: false,
      justReleased: false,
      repeat: false,
    };
    
    state.pressed = true;
    state.justPressed = true;
    this.mouse.buttons.set(e.button, state);
    
    Events.emit('input:mouse-down', {
      button: e.button,
      x: e.clientX,
      y: e.clientY,
    });
  };

  private onMouseUp = (e: MouseEvent): void => {
    const state = this.mouse.buttons.get(e.button);
    if (state) {
      state.pressed = false;
      state.justReleased = true;
    }
    
    Events.emit('input:mouse-up', {
      button: e.button,
      x: e.clientX,
      y: e.clientY,
    });
  };

  private onMouseMove = (e: MouseEvent): void => {
    this.mouse.delta.x += e.movementX;
    this.mouse.delta.y += e.movementY;
    this.mouse.position.x = e.clientX;
    this.mouse.position.y = e.clientY;
    
    Events.emit('input:mouse-move', {
      x: e.clientX,
      y: e.clientY,
      deltaX: e.movementX,
      deltaY: e.movementY,
    });
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.mouse.wheel.x += e.deltaX;
    this.mouse.wheel.y += e.deltaY;
    
    Events.emit('input:mouse-wheel', {
      deltaX: e.deltaX,
      deltaY: e.deltaY,
    });
  };

  // ===== GAMEPAD =====

  /** Check if gamepad is connected */
  isGamepadConnected(index: number): boolean {
    return this.gamepads.get(index)?.connected ?? false;
  }

  /** Get gamepad axis value */
  getGamepadAxis(index: number, axis: number): number {
    const gamepad = this.gamepads.get(index);
    return gamepad?.axes[axis] ?? 0;
  }

  /** Check if gamepad button is pressed */
  isGamepadButtonDown(index: number, button: number): boolean {
    return this.gamepads.get(index)?.buttons.get(button)?.pressed ?? false;
  }

  private onGamepadConnected = (e: GamepadEvent): void => {
    this.gamepads.set(e.gamepad.index, {
      connected: true,
      id: e.gamepad.id,
      buttons: new Map(),
      axes: [...e.gamepad.axes],
    });
    
    Events.emit('input:gamepad-connected', {
      index: e.gamepad.index,
      id: e.gamepad.id,
    });
  };

  private onGamepadDisconnected = (e: GamepadEvent): void => {
    this.gamepads.delete(e.gamepad.index);
    
    Events.emit('input:gamepad-disconnected', {
      index: e.gamepad.index,
    });
  };

  private updateGamepads(): void {
    const gamepads = navigator.getGamepads();
    for (const gamepad of gamepads) {
      if (!gamepad) continue;
      
      const state = this.gamepads.get(gamepad.index);
      if (!state) continue;
      
      // Update axes
      state.axes = [...gamepad.axes];
      
      // Update buttons
      for (let i = 0; i < gamepad.buttons.length; i++) {
        const btnState = state.buttons.get(i) || {
          pressed: false,
          justPressed: false,
          justReleased: false,
          repeat: false,
        };
        
        const isPressed = gamepad.buttons[i].pressed;
        
        if (isPressed && !btnState.pressed) {
          btnState.justPressed = true;
        } else if (!isPressed && btnState.pressed) {
          btnState.justReleased = true;
        }
        
        btnState.pressed = isPressed;
        state.buttons.set(i, btnState);
      }
    }
  }

  // ===== ACTION MAPPING =====

  /** Register an input action */
  registerAction(action: InputAction): void {
    this.actions.set(action.name, action);
    this.actionStates.set(action.name, {
      pressed: false,
      justPressed: false,
      justReleased: false,
      repeat: false,
    });
  }

  /** Unregister an input action */
  unregisterAction(name: string): void {
    this.actions.delete(name);
    this.actionStates.delete(name);
  }

  /** Check if action is active */
  isActionActive(name: string): boolean {
    return this.actionStates.get(name)?.pressed ?? false;
  }

  /** Check if action was just activated */
  isActionJustActivated(name: string): boolean {
    return this.actionStates.get(name)?.justPressed ?? false;
  }

  /** Check if action was just deactivated */
  isActionJustDeactivated(name: string): boolean {
    return this.actionStates.get(name)?.justReleased ?? false;
  }

  /** Update action states based on current input */
  private updateActionStates(): void {
    for (const [name, action] of this.actions) {
      const state = this.actionStates.get(name);
      if (!state) continue;
      
      let isActive = false;
      
      for (const binding of action.bindings) {
        if (binding.type === 'key' && typeof binding.code === 'string') {
          // Check modifiers
          if (binding.modifiers) {
            const modifiersPressed = binding.modifiers.every(mod => {
              switch (mod) {
                case 'shift': return this.isKeyDown('ShiftLeft') || this.isKeyDown('ShiftRight');
                case 'ctrl': return this.isKeyDown('ControlLeft') || this.isKeyDown('ControlRight');
                case 'alt': return this.isKeyDown('AltLeft') || this.isKeyDown('AltRight');
                case 'meta': return this.isKeyDown('MetaLeft') || this.isKeyDown('MetaRight');
                default: return false;
              }
            });
            if (!modifiersPressed) continue;
          }
          
          if (this.isKeyDown(binding.code)) {
            isActive = true;
            break;
          }
        }
        
        if (binding.type === 'mouse' && typeof binding.code === 'number') {
          if (this.isMouseButtonDown(binding.code)) {
            isActive = true;
            break;
          }
        }
      }
      
      if (isActive && !state.pressed) {
        state.justPressed = true;
      } else if (!isActive && state.pressed) {
        state.justReleased = true;
      }
      
      state.pressed = isActive;
    }
  }
}

// Singleton instance
export const Input = new InputSystem();

export function createInput(_eventBus?: EventBus): InputSystem {
  return Input;
}

// Aliases for hooks compatibility
Input.isKeyDown = Input.isKeyDown.bind(Input);
Input.isKeyJustPressed = Input.isKeyJustPressed.bind(Input);
Input.isKeyJustReleased = Input.isKeyJustReleased.bind(Input);

// Default actions
Input.registerAction({
  name: 'move_forward',
  bindings: [{ type: 'key', code: 'KeyW' }],
});

Input.registerAction({
  name: 'move_backward',
  bindings: [{ type: 'key', code: 'KeyS' }],
});

Input.registerAction({
  name: 'move_left',
  bindings: [{ type: 'key', code: 'KeyA' }],
});

Input.registerAction({
  name: 'move_right',
  bindings: [{ type: 'key', code: 'KeyD' }],
});

Input.registerAction({
  name: 'jump',
  bindings: [{ type: 'key', code: 'Space' }],
});

Input.registerAction({
  name: 'sprint',
  bindings: [{ type: 'key', code: 'ShiftLeft' }],
});

Input.registerAction({
  name: 'interact',
  bindings: [{ type: 'key', code: 'KeyE' }],
});
