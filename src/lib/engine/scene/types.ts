/**
 * Scene System - Types
 */

// ============================================
// SERIALIZABLE MATH TYPES
// ============================================

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion extends Vector3 {
  w: number;
}

export interface Color {
  r: number;
  g: number;
  b: number;
}

export function createVector3(x = 0, y = 0, z = 0): Vector3 {
  return { x, y, z };
}

export function createQuaternion(x = 0, y = 0, z = 0, w = 1): Quaternion {
  return { x, y, z, w };
}

export function createColor(r = 1, g = 1, b = 1): Color {
  return { r, g, b };
}

export function cloneVector3(value: Vector3): Vector3 {
  return { ...value };
}

export function cloneQuaternion(value: Quaternion): Quaternion {
  return { ...value };
}

export function cloneColor(value: Color): Color {
  return { ...value };
}

// ============================================
// SCENE TYPES
// ============================================

export type SceneNodeType =
  | 'empty'
  | 'mesh'
  | 'light'
  | 'camera'
  | 'audio'
  | 'particle'
  | 'group';

export interface Transform {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
}

export interface SceneNode {
  id: string;
  name: string;
  type: SceneNodeType;
  transform: Transform;
  parentId: string | null;
  childrenIds: string[];
  active: boolean;
  static: boolean;
  layer: number;
  tags: string[];
  components: ComponentRef[];
}

export interface ComponentRef {
  type: string;
  data: Record<string, unknown>;
}

export interface SceneData {
  id: string;
  name: string;
  description?: string;
  nodes: SceneNode[];
  rootNodes: string[];
  environment: EnvironmentSettings;
  physics: PhysicsSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentSettings {
  skybox?: string;
  ambientColor: Color;
  ambientIntensity: number;
  fogEnabled: boolean;
  fogColor?: Color;
  fogNear?: number;
  fogFar?: number;
  fogDensity?: number;
  fogType?: 'linear' | 'exponential';
}

export interface PhysicsSettings {
  gravity: Vector3;
  fixedTimeStep: number;
  maxSubSteps: number;
}

// ============================================
// PREFAB TYPES
// ============================================

export interface PrefabData {
  id: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  nodes: SceneNode[];
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrefabVariant {
  id: string;
  name: string;
  basePrefabId: string;
  overrides: Record<string, Partial<SceneNode>>;
}

// ============================================
// CLONE HELPERS
// ============================================

export function cloneTransform(value: Transform): Transform {
  return {
    position: cloneVector3(value.position),
    rotation: cloneQuaternion(value.rotation),
    scale: cloneVector3(value.scale),
  };
}

export function cloneSceneNode(value: SceneNode): SceneNode {
  return {
    ...value,
    transform: cloneTransform(value.transform),
    childrenIds: [...value.childrenIds],
    tags: [...value.tags],
    components: value.components.map((component) => ({
      ...component,
      data: { ...component.data },
    })),
  };
}

export function cloneEnvironmentSettings(value: EnvironmentSettings): EnvironmentSettings {
  return {
    ...value,
    ambientColor: cloneColor(value.ambientColor),
    fogColor: value.fogColor ? cloneColor(value.fogColor) : undefined,
  };
}

export function clonePhysicsSettings(value: PhysicsSettings): PhysicsSettings {
  return {
    ...value,
    gravity: cloneVector3(value.gravity),
  };
}

// ============================================
// DEFAULTS
// ============================================

export const DefaultTransform: Transform = {
  position: createVector3(0, 0, 0),
  rotation: createQuaternion(0, 0, 0, 1),
  scale: createVector3(1, 1, 1),
};

export const DefaultEnvironment: EnvironmentSettings = {
  ambientColor: createColor(0.5, 0.5, 0.5),
  ambientIntensity: 0.4,
  fogEnabled: false,
  fogColor: createColor(0.8, 0.8, 0.8),
  fogNear: 1,
  fogFar: 100,
  fogDensity: 0.01,
  fogType: 'linear',
};

export const DefaultPhysics: PhysicsSettings = {
  gravity: createVector3(0, -9.81, 0),
  fixedTimeStep: 1 / 60,
  maxSubSteps: 3,
};

export const DefaultSceneData: Omit<SceneData, 'id' | 'name'> = {
  nodes: [],
  rootNodes: [],
  environment: cloneEnvironmentSettings(DefaultEnvironment),
  physics: clonePhysicsSettings(DefaultPhysics),
  createdAt: new Date(),
  updatedAt: new Date(),
};
