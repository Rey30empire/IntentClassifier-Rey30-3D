/**
 * NEXUS Engine Core - Index
 * 
 * Exporta todos los módulos del núcleo del motor
 */

// Core Systems
export { EngineTime, TimeSystem, createTimeSystem } from './TimeSystem';
export type { TimeData } from './TimeSystem';

export { EngineLoop, GameLoop, createGameLoop } from './GameLoop';
export type { 
  GameLoopConfig, 
  FrameStats, 
  UpdateCallback, 
  FixedUpdateCallback, 
  RenderCallback 
} from './GameLoop';

// ECS
export { 
  ECS,
  World, 
  EngineWorld,
  Transform,
  TransformSystem,
  createECS,
} from '../ecs/ECS';
export type {
  Entity,
  EntityRecord,
  IComponent,
  ComponentType,
  ComponentTypeName,
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
  ComponentData,
  System,
  ISystem,
  SystemPriority,
  Query,
  EntityQuery,
  EntityName,
} from '../ecs/ECS';
