/**
 * NEXUS Engine - Main Export
 */

export * from './core';
export { EventBus, Events, createEventBus } from './core/EventSystem';
export type { EngineEvents, EngineEventType } from './core/EventSystem';
export { EngineTime, TimeSystem, createTimeSystem } from './core/TimeSystem';
export type { TimeData } from './core/TimeSystem';
export { EngineLoop, GameLoop, createGameLoop } from './core/GameLoop';
export type {
  GameLoopConfig,
  FrameStats,
  UpdateCallback,
  FixedUpdateCallback,
  RenderCallback,
} from './core/GameLoop';

export {
  ECS,
  World,
  EngineWorld,
  Transform,
  TransformSystem,
  createECS,
} from './ecs/ECS';
export type {
  Entity,
  EntityRecord,
  IComponent,
  ComponentType,
  ComponentTypeName,
  ComponentData,
  TransformComponent,
  MeshRendererComponent,
  CameraComponent,
  LightComponent,
  RigidBodyComponent,
  ColliderComponent,
  AudioSourceComponent,
  ParticleEmitterComponent,
  ScriptComponent,
  AnimationComponent,
  TagComponent,
  System,
  ISystem,
  SystemPriority,
  Query,
  EntityQuery,
  EntityName,
} from './ecs/ECS';

export { Input, InputSystem, Keys, MouseButtons, createInput } from './input/InputSystem';
export type { InputAction, InputBinding } from './input/InputSystem';

export * from './render';
export { RenderEvents } from './render';
export {
  SceneManager,
  createSceneManager,
  getSceneManager,
  PrefabSystem,
  createPrefabSystem,
  getPrefabSystem,
  createSceneSystemBundle,
  SceneEvents,
  PrefabEvents,
} from './scene';
export type {
  SceneNodeType,
  Transform as SceneTransform,
  SceneNode,
  ComponentRef,
  SceneData,
  EnvironmentSettings,
  PhysicsSettings,
  PrefabData,
  PrefabVariant,
} from './scene';
export * from './assets';
export { AssetEvents } from './assets';
export {
  EngineAutomationAPI,
  createEngineAutomationAPI,
  getEngineAutomationAPI,
  initializeMultiScriptSystem,
  getMultiScriptSystem,
  shutdownMultiScriptSystem,
} from './scripting';
export * from './physics';
export { PhysicsEvents } from './physics';
export * from './hooks';
export * from './conversion';
export { CharacterLibraryManager, createCharacterLibrary } from './characters';
export { AnimationManager, createAnimationManager } from './animation';

import { EventBus, createEventBus } from './core/EventSystem';
import { TimeSystem, createTimeSystem } from './core/TimeSystem';
import { GameLoop, createGameLoop } from './core/GameLoop';
import { InputSystem, createInput } from './input/InputSystem';
import { ECS, createECS } from './ecs/ECS';
import { createRenderSystemBundle } from './render';
import { createSceneSystemBundle } from './scene';
import { AssetManager, createAssetManager } from './assets';
import { getMultiScriptSystem, initializeMultiScriptSystem } from './scripting';
import { PhysicsSystemBundle, createPhysicsSystemBundle } from './physics';

export interface EngineContext {
  eventBus: EventBus;
  time: TimeSystem;
  loop: GameLoop;
  input: InputSystem;
  ecs: ECS;
  render: ReturnType<typeof createRenderSystemBundle>;
  scene: ReturnType<typeof createSceneSystemBundle>;
  assets: AssetManager;
  scripting: NonNullable<Awaited<ReturnType<typeof getMultiScriptSystem>>>;
  physics: PhysicsSystemBundle;
}

let engineContext: EngineContext | null = null;

export async function initializeEngine(canvas: HTMLCanvasElement): Promise<EngineContext> {
  if (engineContext) {
    return engineContext;
  }

  const eventBus = createEventBus();
  const time = createTimeSystem();
  const loop = createGameLoop(eventBus, time);
  const input = createInput(eventBus);
  const ecs = createECS();

  const render = createRenderSystemBundle(eventBus);
  render.render.initialize(canvas);

  const scene = createSceneSystemBundle(eventBus, ecs);
  render.lighting.setScene(scene.scene.getScene());

  const assets = createAssetManager(eventBus);
  const scripting = await initializeMultiScriptSystem(ecs, eventBus);
  const physics = createPhysicsSystemBundle();
  physics.physics.start();

  engineContext = {
    eventBus,
    time,
    loop,
    input,
    ecs,
    render,
    scene,
    assets,
    scripting,
    physics,
  };

  loop.start();
  return engineContext;
}

export function getEngine(): EngineContext | null {
  return engineContext;
}

export async function shutdownEngine(): Promise<void> {
  if (!engineContext) {
    return;
  }

  engineContext.loop.stop();
  engineContext.render.render.dispose();
  engineContext.scene.scene.dispose();
  engineContext.assets.dispose();
  engineContext.physics.physics.destroy();
  engineContext = null;
}
