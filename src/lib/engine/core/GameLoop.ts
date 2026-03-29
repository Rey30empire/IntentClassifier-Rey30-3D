/**
 * NEXUS Engine - Game Loop
 * 
 * Corazón del motor que coordina:
 * - Input processing
 * - Fixed update (physics)
 * - Variable update (game logic)
 * - Late update (camera, etc)
 * - Render
 * 
 * Architecture based on Unity/Unreal game loop patterns
 */

import { EngineTime, TimeData, TimeSystem } from './TimeSystem';

export type UpdateCallback = (deltaTime: number) => void;
export type FixedUpdateCallback = (fixedDeltaTime: number) => void;
export type RenderCallback = (interpolation: number) => void;

export interface GameLoopConfig {
  /** Target frame rate (0 = uncapped) */
  targetFps: number;
  /** Enable VSync simulation */
  vsync: boolean;
  /** Maximum delta time to prevent spiral of death */
  maxDeltaTime: number;
  /** Fixed physics step rate (Hz) */
  fixedStepRate: number;
  /** Enable performance tracking */
  enableProfiling: boolean;
}

export interface FrameStats {
  fps: number;
  frameTime: number;
  updateTime: number;
  renderTime: number;
  fixedUpdates: number;
  totalFrames: number;
}

type LoopState = 'stopped' | 'running' | 'paused';

export class GameLoop {
  private time: TimeSystem;
  private config: GameLoopConfig;
  private state: LoopState = 'stopped';
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;

  // Callbacks
  private onEarlyUpdate: UpdateCallback[] = [];
  private onFixedUpdate: FixedUpdateCallback[] = [];
  private onUpdate: UpdateCallback[] = [];
  private onLateUpdate: UpdateCallback[] = [];
  private onPreRender: UpdateCallback[] = [];
  private onRender: RenderCallback[] = [];
  private onPostRender: UpdateCallback[] = [];

  // Stats
  private stats: FrameStats = {
    fps: 60,
    frameTime: 16.67,
    updateTime: 0,
    renderTime: 0,
    fixedUpdates: 0,
    totalFrames: 0,
  };

  // Performance tracking
  private updateStartTime: number = 0;
  private renderStartTime: number = 0;

  constructor(config?: Partial<GameLoopConfig>, time: TimeSystem = EngineTime) {
    this.time = time;
    this.config = {
      targetFps: 60,
      vsync: true,
      maxDeltaTime: 0.1,
      fixedStepRate: 60,
      enableProfiling: true,
      ...config,
    };

    this.time.setFixedStep(this.config.fixedStepRate);
  }

  /** Register callbacks for different loop stages */
  
  /** Called before any other update, good for input */
  registerEarlyUpdate(callback: UpdateCallback): () => void {
    this.onEarlyUpdate.push(callback);
    return () => {
      const index = this.onEarlyUpdate.indexOf(callback);
      if (index > -1) this.onEarlyUpdate.splice(index, 1);
    };
  }

  /** Called at fixed intervals for physics */
  registerFixedUpdate(callback: FixedUpdateCallback): () => void {
    this.onFixedUpdate.push(callback);
    return () => {
      const index = this.onFixedUpdate.indexOf(callback);
      if (index > -1) this.onFixedUpdate.splice(index, 1);
    };
  }

  /** Called every frame for game logic */
  registerUpdate(callback: UpdateCallback): () => void {
    this.onUpdate.push(callback);
    return () => {
      const index = this.onUpdate.indexOf(callback);
      if (index > -1) this.onUpdate.splice(index, 1);
    };
  }

  /** Called after update, good for camera follow */
  registerLateUpdate(callback: UpdateCallback): () => void {
    this.onLateUpdate.push(callback);
    return () => {
      const index = this.onLateUpdate.indexOf(callback);
      if (index > -1) this.onLateUpdate.splice(index, 1);
    };
  }

  /** Called before render */
  registerPreRender(callback: UpdateCallback): () => void {
    this.onPreRender.push(callback);
    return () => {
      const index = this.onPreRender.indexOf(callback);
      if (index > -1) this.onPreRender.splice(index, 1);
    };
  }

  /** Called for rendering with interpolation factor */
  registerRender(callback: RenderCallback): () => void {
    this.onRender.push(callback);
    return () => {
      const index = this.onRender.indexOf(callback);
      if (index > -1) this.onRender.splice(index, 1);
    };
  }

  /** Called after render */
  registerPostRender(callback: UpdateCallback): () => void {
    this.onPostRender.push(callback);
    return () => {
      const index = this.onPostRender.indexOf(callback);
      if (index > -1) this.onPostRender.splice(index, 1);
    };
  }

  /** Start the game loop */
  start(): void {
    if (this.state === 'running') return;
    
    this.state = 'running';
    this.lastTimestamp = performance.now();
    this.tick();
  }

  /** Stop the game loop */
  stop(): void {
    this.state = 'stopped';
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /** Pause the game loop (stops updates but not render) */
  pause(): void {
    this.state = 'paused';
    this.time.pause();
  }

  /** Resume from pause */
  resume(): void {
    if (this.state === 'paused') {
      this.state = 'running';
      this.time.resume();
    }
  }

  /** Toggle pause */
  togglePause(): void {
    if (this.state === 'paused') {
      this.resume();
    } else if (this.state === 'running') {
      this.pause();
    }
  }

  /** Get current stats */
  getStats(): Readonly<FrameStats> {
    return this.stats;
  }

  /** Get current time data */
  getTime(): Readonly<TimeData> {
    return this.time.current;
  }

  /** Check if running */
  isRunning(): boolean {
    return this.state === 'running';
  }

  /** Check if paused */
  isPaused(): boolean {
    return this.state === 'paused';
  }

  /** Main tick function */
  private tick = (): void => {
    if (this.state === 'stopped') return;

    this.animationFrameId = requestAnimationFrame(this.tick);

    // Update time system
    this.time.tick();
    const deltaTime = this.time.current.deltaTime;
    const fixedDeltaTime = this.time.current.fixedDeltaTime;

    // Track update time
    if (this.config.enableProfiling) {
      this.updateStartTime = performance.now();
    }

    // Early Update (input, etc)
    this.executeCallbacks(this.onEarlyUpdate, deltaTime);

    // Fixed Update (physics)
    let fixedUpdateCount = 0;
    const maxFixedUpdates = 5; // Prevent spiral of death
    while (this.time.consumeFixedStep() && fixedUpdateCount < maxFixedUpdates) {
      for (const callback of this.onFixedUpdate) {
        callback(fixedDeltaTime * this.time.current.timeScale);
      }
      fixedUpdateCount++;
    }
    this.stats.fixedUpdates = fixedUpdateCount;

    // Update (game logic)
    this.executeCallbacks(this.onUpdate, deltaTime);

    // Late Update (camera follow, etc)
    this.executeCallbacks(this.onLateUpdate, deltaTime);

    if (this.config.enableProfiling) {
      this.stats.updateTime = performance.now() - this.updateStartTime;
      this.renderStartTime = performance.now();
    }

    // Pre Render
    this.executeCallbacks(this.onPreRender, deltaTime);

    // Calculate interpolation for smooth rendering
    const interpolation = this.time.fixedAccumulatorValue / fixedDeltaTime;

    // Render
    for (const callback of this.onRender) {
      callback(interpolation);
    }

    // Post Render
    this.executeCallbacks(this.onPostRender, deltaTime);

    if (this.config.enableProfiling) {
      this.stats.renderTime = performance.now() - this.renderStartTime;
    }

    // Update stats
    this.stats.fps = this.time.current.smoothFps;
    this.stats.frameTime = this.time.current.unscaledDeltaTime * 1000;
    this.stats.totalFrames++;
  };

  /** Execute callbacks safely */
  private executeCallbacks(callbacks: UpdateCallback[], deltaTime: number): void {
    for (const callback of callbacks) {
      try {
        callback(deltaTime);
      } catch (error) {
        console.error('[NEXUS Engine] Update callback error:', error);
      }
    }
  }
}

// Singleton instance
export const EngineLoop = new GameLoop();

export function createGameLoop(
  _eventBus?: unknown,
  time: TimeSystem = EngineTime,
  config?: Partial<GameLoopConfig>
): GameLoop {
  return new GameLoop(config, time);
}
