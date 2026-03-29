/**
 * NEXUS Engine - Time System
 * 
 * Controla el tiempo del motor:
 * - Delta time para frame-rate independent movement
 * - Fixed timestep para física
 * - Time scale para slow-motion/pause
 * - Frame counting
 */

export interface TimeData {
  /** Time since engine started (seconds) */
  time: number;
  /** Time since last frame (seconds) */
  deltaTime: number;
  /** Fixed timestep for physics (seconds) */
  fixedDeltaTime: number;
  /** Time scale (1 = normal, 0.5 = half speed, 0 = paused) */
  timeScale: number;
  /** Frame count since start */
  frameCount: number;
  /** FPS calculation */
  fps: number;
  /** Smoothed FPS for display */
  smoothFps: number;
  /** Real time since last frame (unaffected by timeScale) */
  unscaledDeltaTime: number;
  /** Real time since start */
  unscaledTime: number;
}

export class TimeSystem {
  private startTime: number = 0;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fixedAccumulator: number = 0;
  private fpsHistory: number[] = [];
  private fpsHistoryMax: number = 60;
  
  private data: TimeData = {
    time: 0,
    deltaTime: 0,
    fixedDeltaTime: 1 / 60, // 60Hz physics
    timeScale: 1,
    frameCount: 0,
    fps: 60,
    smoothFps: 60,
    unscaledDeltaTime: 0,
    unscaledTime: 0,
  };

  constructor() {
    this.startTime = TimeSystem.now();
    this.lastFrameTime = this.startTime;
  }

  private static now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  /** Get current time data (read-only) */
  get current(): Readonly<TimeData> {
    return this.data;
  }

  /** Get fixed timestep accumulator for physics */
  get fixedAccumulatorValue(): number {
    return this.fixedAccumulator;
  }

  /** Update time system - call at start of each frame */
  tick(): void {
    const now = TimeSystem.now();
    const rawDelta = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    // Clamp delta time to prevent spiral of death
    const clampedDelta = Math.min(rawDelta, 0.1); // Max 100ms

    // Calculate unscaled values
    this.data.unscaledDeltaTime = clampedDelta;
    this.data.unscaledTime = (now - this.startTime) / 1000;

    // Apply time scale
    this.data.deltaTime = clampedDelta * this.data.timeScale;
    this.data.time += this.data.deltaTime;
    
    // Update frame count
    this.frameCount++;
    this.data.frameCount = this.frameCount;

    // Calculate FPS
    if (rawDelta > 0) {
      const instantFps = 1 / rawDelta;
      this.fpsHistory.push(instantFps);
      if (this.fpsHistory.length > this.fpsHistoryMax) {
        this.fpsHistory.shift();
      }
      this.data.fps = Math.round(instantFps);
      this.data.smoothFps = Math.round(
        this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
      );
    }

    // Update fixed accumulator
    this.fixedAccumulator += clampedDelta;
  }

  /** Consume fixed timestep for physics updates */
  consumeFixedStep(): boolean {
    if (this.fixedAccumulator >= this.data.fixedDeltaTime) {
      this.fixedAccumulator -= this.data.fixedDeltaTime;
      return true;
    }
    return false;
  }

  /** Set time scale (for slow-mo or pause) */
  setTimeScale(scale: number): void {
    this.data.timeScale = Math.max(0, Math.min(scale, 10)); // 0-10x
  }

  /** Pause the game time */
  pause(): void {
    this.data.timeScale = 0;
  }

  /** Resume the game time */
  resume(): void {
    this.data.timeScale = 1;
  }

  /** Toggle pause state */
  togglePause(): void {
    this.data.timeScale = this.data.timeScale === 0 ? 1 : 0;
  }

  /** Check if paused */
  isPaused(): boolean {
    return this.data.timeScale === 0;
  }

  /** Set fixed timestep frequency (default 60Hz) */
  setFixedStep(hz: number): void {
    this.data.fixedDeltaTime = 1 / hz;
  }

  /** Reset time system */
  reset(): void {
    this.startTime = TimeSystem.now();
    this.lastFrameTime = this.startTime;
    this.frameCount = 0;
    this.fixedAccumulator = 0;
    this.data.time = 0;
    this.data.deltaTime = 0;
    this.data.timeScale = 1;
    this.data.frameCount = 0;
    this.data.unscaledTime = 0;
  }
}

// Singleton instance
export const EngineTime = new TimeSystem();

export function createTimeSystem(): TimeSystem {
  return new TimeSystem();
}
