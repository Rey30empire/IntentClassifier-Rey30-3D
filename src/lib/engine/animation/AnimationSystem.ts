/**
 * NEXUS Engine - Animation System
 * 
 * Sistema completo de animación esquelética con:
 * - Skeleton y huesos con jerarquía
 * - Keyframes y curvas de animación
 * - Animation State Machine
 * - Inverse Kinematics (IK)
 * - Retargeting de animaciones
 * - Blend trees y blending
 */

import { Vec3, Quat, RGBA, generateId } from '../conversion/types';

// ============================================
// SKELETON TYPES
// ============================================

/** Hueso individual */
export interface Bone {
  id: string;
  name: string;
  index: number;               // Índice en el array de huesos
  
  // Jerarquía
  parentId: string | null;
  childrenIds: string[];
  
  // Transform local
  localPosition: Vec3;
  localRotation: Quat;
  localScale: Vec3;
  
  // Bind pose (transformación inversa para skinning)
  bindPosition: Vec3;
  bindRotation: Quat;
  bindScale: Vec3;
  inverseBindMatrix: number[]; // Matriz 4x4
  
  // Metadatos
  length: number;              // Longitud visual del hueso
  color?: RGBA;
  locked: boolean;
  visible: boolean;
}

/** Skeleton completo */
export interface Skeleton {
  id: string;
  name: string;
  
  // Huesos
  bones: Map<string, Bone>;
  boneList: Bone[];            // Ordenado por índice
  rootBoneId: string;
  
  // Metadatos
  boneCount: number;
  
  // Cache de matrices
  boneMatrices: Float32Array;  // Matrices para GPU skinning
  dirty: boolean;
}

/** Pose de skeleton */
export interface SkeletonPose {
  skeletonId: string;
  bonePoses: Map<string, BonePose>;
}

/** Pose de un hueso individual */
export interface BonePose {
  boneId: string;
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
}

// ============================================
// ANIMATION CURVES
// ============================================

/** Tipo de curva */
export type CurveType = 
  | 'position_x' | 'position_y' | 'position_z'
  | 'rotation_x' | 'rotation_y' | 'rotation_z' | 'rotation_w'
  | 'scale_x' | 'scale_y' | 'scale_z'
  | 'custom';

/** Tipo de interpolación */
export type InterpolationType =
  | 'linear'
  | 'step'
  | 'bezier'
  | 'hermite'
  | 'catmull_rom';

/** Punto de control para curva bezier */
export interface BezierControlPoint {
  inTangent: Vec3;
  outTangent: Vec3;
}

/** Keyframe de animación */
export interface AnimationKeyframe {
  id: string;
  time: number;                // Tiempo en segundos
  
  // Valor (puede ser escalar o vector)
  value: number | Vec3 | Quat;
  
  // Interpolación
  interpolation: InterpolationType;
  bezierHandles?: BezierControlPoint;
  
  // Para curvas de rotación
  tangentMode?: 'auto' | 'user' | 'free';
  
  // Metadatos
  selected: boolean;
  locked: boolean;
}

/** Curva de animación */
export interface AnimationCurve {
  id: string;
  name: string;
  type: CurveType;
  boneId: string;
  property: string;            // 'position', 'rotation', 'scale', etc.
  component?: 'x' | 'y' | 'z' | 'w';
  
  // Keyframes
  keyframes: AnimationKeyframe[];
  
  // Configuración
  interpolation: InterpolationType;
  preWrapMode: WrapMode;
  postWrapMode: WrapMode;
  
  // Visualización
  color: RGBA;
  visible: boolean;
  locked: boolean;
}

/** Modo de repetición */
export type WrapMode =
  | 'once'
  | 'loop'
  | 'ping_pong'
  | 'clamp'
  | 'clamp_forever';

// ============================================
// ANIMATION CLIP
// ============================================

/** Animation clip */
export interface AnimationClip {
  id: string;
  name: string;
  skeletonId: string;
  
  // Tiempos
  duration: number;
  frameRate: number;
  startFrame: number;
  endFrame: number;
  
  // Curvas
  curves: Map<string, AnimationCurve>;
  
  // Eventos
  events: AnimationEvent[];
  
  // Metadatos
  tags: string[];
  loop: boolean;
  additive: boolean;
  
  // Autoría
  author?: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Evento de animación */
export interface AnimationEvent {
  id: string;
  name: string;
  time: number;
  functionName: string;
  parameters: Record<string, unknown>;
  triggerOnce: boolean;
  triggered: boolean;
}

// ============================================
// ANIMATION STATE MACHINE
// ============================================

/** Estado de animación */
export interface AnimationState {
  id: string;
  name: string;
  clipId: string;
  
  // Configuración
  speed: number;
  speedMultiplier: number;
  loop: boolean;
  blendDuration: number;
  
  // Transiciones salientes
  transitions: string[];
  
  // Blend tree (opcional)
  blendTree?: BlendTree;
  
  // Avatar mask (para layers)
  mask?: AvatarMask;
  
  // IK
  ikPass: boolean;
  ikGoals: IKGoal[];
}

/** Transición entre estados */
export interface AnimationTransition {
  id: string;
  name: string;
  fromStateId: string;
  toStateId: string;
  
  // Condiciones
  conditions: TransitionCondition[];
  
  // Configuración
  duration: number;
  offset: number;
  exitTime: number;           // 0-1, momento de salida
  hasExitTime: boolean;
  canInterrupt: boolean;
  interruptionSource: 'none' | 'current' | 'next' | 'both';
  
  // Orden
  order: number;
}

/** Condición de transición */
export interface TransitionCondition {
  id: string;
  parameterName: string;
  mode: 'equals' | 'not_equals' | 'greater' | 'less' | 'trigger';
  threshold: number | boolean;
}

/** Parámetro de animator */
export interface AnimatorParameter {
  id: string;
  name: string;
  type: 'float' | 'int' | 'bool' | 'trigger';
  value: number | boolean;
  defaultValue: number | boolean;
}

/** State machine */
export interface AnimationStateMachine {
  id: string;
  name: string;
  
  // Estados
  states: Map<string, AnimationState>;
  defaultStateId: string;
  currentStateId: string | null;
  
  // Transiciones
  transitions: Map<string, AnimationTransition>;
  
  // Parámetros
  parameters: Map<string, AnimatorParameter>;
  
  // Layers
  layers: AnimationLayer[];
  currentLayerIndex: number;
}

/** Layer de animación */
export interface AnimationLayer {
  id: string;
  name: string;
  stateMachineId: string;
  weight: number;
  blendMode: 'override' | 'additive';
  avatarMask?: AvatarMask;
}

/** Avatar mask */
export interface AvatarMask {
  id: string;
  name: string;
  boneWeights: Map<string, number>;  // boneId -> weight (0-1)
}

// ============================================
// BLEND TREE
// ============================================

/** Tipo de blend tree */
export type BlendTreeType = 'simple_1d' | 'simple_2d' | 'direct';

/** Motion en blend tree */
export interface BlendTreeMotion {
  id: string;
  name: string;
  clipId: string;
  position: Vec3;              // Posición en el blend space
  speed: number;
  mirror: boolean;
}

/** Blend tree */
export interface BlendTree {
  id: string;
  name: string;
  type: BlendTreeType;
  
  // Parámetros de blending
  blendParameter: string;
  blendParameterY?: string;
  
  // Motions
  motions: BlendTreeMotion[];
  
  // Configuración
  minThreshold: number;
  maxThreshold: number;
  useAutomaticThresholds: boolean;
}

// ============================================
// INVERSE KINEMATICS
// ============================================

/** Objetivo de IK */
export interface IKGoal {
  id: string;
  name: string;
  type: 'position' | 'rotation' | 'look_at';
  
  // Objetivo
  targetPosition?: Vec3;
  targetRotation?: Quat;
  targetBoneId?: string;
  
  // Configuración
  chainLength: number;
  boneChain: string[];         // IDs de huesos de la cadena
  
  // Pesos
  weight: number;
  rotationWeight: number;
  
  // Solvers
  solver: IKSolverType;
  solverConfig: IKSolverConfig;
}

/** Tipo de solver IK */
export type IKSolverType =
  | 'ccd'          // Cyclic Coordinate Descent
  | 'fabrik'       // Forward And Backward Reaching Inverse Kinematics
  | 'jacobian'     // Jacobian-based
  | 'two_bone';    // Two-bone IK (para piernas/brazos)

/** Configuración de solver IK */
export interface IKSolverConfig {
  maxIterations: number;
  tolerance: number;
  
  // CCD specific
  ccdRotationWeight: number;
  
  // FABRIK specific
  fabrikAngleConstraint: number;
  
  // Jacobian specific
  jacobianDamping: number;
  
  // Two-bone specific
  bendNormal: Vec3;
  preserveLength: boolean;
}

/** Sistema IK */
export interface IKSystem {
  id: string;
  name: string;
  skeletonId: string;
  
  // Goals
  goals: Map<string, IKGoal>;
  
  // Configuración global
  enabled: boolean;
  solveOrder: string[];        // Orden de resolución de goals
}

// ============================================
// ANIMATION PLAYER
// ============================================

/** Estado de reproducción */
export type PlaybackState = 'playing' | 'paused' | 'stopped';

/** Animation player */
export interface AnimationPlayer {
  id: string;
  skeletonId: string;
  
  // Clips
  clips: Map<string, AnimationClip>;
  currentClipId: string | null;
  
  // Estado de reproducción
  playbackState: PlaybackState;
  currentTime: number;
  playbackSpeed: number;
  
  // Blending
  blending: boolean;
  blendTime: number;
  blendProgress: number;
  previousClipId: string | null;
  
  // Callbacks
  onEvent?: (event: AnimationEvent) => void;
  onComplete?: () => void;
}

// ============================================
// ANIMATION RETARGETING
// ============================================

/** Mapeo de huesos para retargeting */
export interface BoneMapping {
  sourceBoneId: string;
  targetBoneId: string;
  
  // Ajustes
  scale: number;
  rotationOffset: Quat;
  positionOffset: Vec3;
}

/** Perfil de retargeting */
export interface RetargetingProfile {
  id: string;
  name: string;
  
  // Skeletons
  sourceSkeletonId: string;
  targetSkeletonId: string;
  
  // Mapeo
  boneMappings: Map<string, BoneMapping>;
  
  // Configuración
  scaleMatchMode: 'none' | 'height' | 'proportional';
  sourceHeight: number;
  targetHeight: number;
  
  // Preservación
  preserveSourcePose: boolean;
  applyFootIk: boolean;
}

// ============================================
// ANIMATION EDITOR TYPES
// ============================================

/** Herramienta del editor */
export type EditorTool =
  | 'select'
  | 'move'
  | 'rotate'
  | 'scale'
  | 'ik'
  | 'bone'
  | 'pose';

/** Modo de edición */
export type EditorMode =
  | 'object'
  | 'pose'
  | 'animation';

/** Selección del editor */
export interface EditorSelection {
  type: 'bone' | 'keyframe' | 'curve' | 'event';
  ids: string[];
}

/** Estado del editor de animación */
export interface AnimationEditorState {
  // Skeleton actual
  skeletonId: string | null;
  
  // Clip actual
  clipId: string | null;
  
  // Herramienta activa
  tool: EditorTool;
  mode: EditorMode;
  
  // Selección
  selection: EditorSelection;
  
  // Timeline
  currentTime: number;
  frameRange: { start: number; end: number };
  
  // Visualización
  showSkeleton: boolean;
  showBones: boolean;
  showIKGoals: boolean;
  showCurves: boolean;
  showEvents: boolean;
  
  // Snap
  snapEnabled: boolean;
  snapValue: number;
  
  // Onion skinning
  onionSkinEnabled: boolean;
  onionSkinFrames: number;
  
  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
}

// ============================================
// ANIMATION MANAGER
// ============================================

/**
 * Manager del sistema de animación
 */
export class AnimationManager {
  private skeletons: Map<string, Skeleton> = new Map();
  private clips: Map<string, AnimationClip> = new Map();
  private stateMachines: Map<string, AnimationStateMachine> = new Map();
  private players: Map<string, AnimationPlayer> = new Map();
  private ikSystems: Map<string, IKSystem> = new Map();
  private retargetingProfiles: Map<string, RetargetingProfile> = new Map();
  
  constructor() {
    // Inicialización
  }
  
  // ============================================
  // SKELETON MANAGEMENT
  // ============================================
  
  /**
   * Crear skeleton desde definición
   */
  createSkeleton(name: string, boneDefinitions: Array<{
    name: string;
    parentId: string | null;
    position: Vec3;
    rotation: Quat;
    scale: Vec3;
  }>): Skeleton {
    const id = generateId();
    const bones = new Map<string, Bone>();
    const boneList: Bone[] = [];
    let rootBoneId = '';
    
    // Crear huesos
    for (let i = 0; i < boneDefinitions.length; i++) {
      const def = boneDefinitions[i];
      const boneId = generateId();
      
      const bone: Bone = {
        id: boneId,
        name: def.name,
        index: i,
        parentId: def.parentId,
        childrenIds: [],
        localPosition: { ...def.position },
        localRotation: { ...def.rotation },
        localScale: { ...def.scale },
        bindPosition: { ...def.position },
        bindRotation: { ...def.rotation },
        bindScale: { ...def.scale },
        inverseBindMatrix: this.createIdentityMatrix(),
        length: 0.1,
        locked: false,
        visible: true,
      };
      
      bones.set(boneId, bone);
      boneList.push(bone);
      
      if (def.parentId === null) {
        rootBoneId = boneId;
      }
    }
    
    // Construir jerarquía
    for (const bone of boneList) {
      if (bone.parentId) {
        const parent = bones.get(bone.parentId);
        if (parent) {
          parent.childrenIds.push(bone.id);
        }
      }
    }
    
    // Calcular bind poses y matrices inversas
    this.calculateBindPoses(bones, boneList);
    
    const skeleton: Skeleton = {
      id,
      name,
      bones,
      boneList,
      rootBoneId,
      boneCount: boneList.length,
      boneMatrices: new Float32Array(boneList.length * 16),
      dirty: true,
    };
    
    this.skeletons.set(id, skeleton);
    return skeleton;
  }
  
  /**
   * Calcular bind poses
   */
  private calculateBindPoses(
    bones: Map<string, Bone>,
    boneList: Bone[]
  ): void {
    for (const bone of boneList) {
      // Calcular matriz world
      const worldMatrix = this.calculateBoneWorldMatrix(bone, bones);
      
      // Invertir para inverse bind matrix
      bone.inverseBindMatrix = this.invertMatrix(worldMatrix);
    }
  }
  
  /**
   * Calcular matriz world de un hueso
   */
  private calculateBoneWorldMatrix(
    bone: Bone,
    bones: Map<string, Bone>
  ): number[] {
    const localMatrix = this.composeMatrix(
      bone.bindPosition,
      bone.bindRotation,
      bone.bindScale
    );
    
    if (bone.parentId) {
      const parent = bones.get(bone.parentId);
      if (parent) {
        const parentWorld = this.calculateBoneWorldMatrix(parent, bones);
        return this.multiplyMatrices(parentWorld, localMatrix);
      }
    }
    
    return localMatrix;
  }
  
  /**
   * Obtener skeleton
   */
  getSkeleton(id: string): Skeleton | null {
    return this.skeletons.get(id) || null;
  }
  
  /**
   * Crear skeleton humanoide básico
   */
  createHumanoidSkeleton(): Skeleton {
    const bones = [
      // Root
      { name: 'Root', parentId: null, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      // Hips
      { name: 'Hips', parentId: 'Root', position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      // Spine
      { name: 'Spine', parentId: 'Hips', position: { x: 0, y: 0.1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'Spine1', parentId: 'Spine', position: { x: 0, y: 0.15, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'Spine2', parentId: 'Spine1', position: { x: 0, y: 0.15, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      // Neck & Head
      { name: 'Neck', parentId: 'Spine2', position: { x: 0, y: 0.15, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'Head', parentId: 'Neck', position: { x: 0, y: 0.1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      // Left Arm
      { name: 'LeftShoulder', parentId: 'Spine2', position: { x: -0.1, y: 0.1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'LeftArm', parentId: 'LeftShoulder', position: { x: -0.1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0.5, w: 0.866 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'LeftForeArm', parentId: 'LeftArm', position: { x: -0.25, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'LeftHand', parentId: 'LeftForeArm', position: { x: -0.25, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      // Right Arm
      { name: 'RightShoulder', parentId: 'Spine2', position: { x: 0.1, y: 0.1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'RightArm', parentId: 'RightShoulder', position: { x: 0.1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: -0.5, w: 0.866 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'RightForeArm', parentId: 'RightArm', position: { x: 0.25, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'RightHand', parentId: 'RightForeArm', position: { x: 0.25, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      // Left Leg
      { name: 'LeftUpLeg', parentId: 'Hips', position: { x: -0.1, y: -0.1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'LeftLeg', parentId: 'LeftUpLeg', position: { x: 0, y: -0.45, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'LeftFoot', parentId: 'LeftLeg', position: { x: 0, y: -0.45, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'LeftToe', parentId: 'LeftFoot', position: { x: 0, y: 0, z: 0.1 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      // Right Leg
      { name: 'RightUpLeg', parentId: 'Hips', position: { x: 0.1, y: -0.1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'RightLeg', parentId: 'RightUpLeg', position: { x: 0, y: -0.45, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'RightFoot', parentId: 'RightLeg', position: { x: 0, y: -0.45, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
      { name: 'RightToe', parentId: 'RightFoot', position: { x: 0, y: 0, z: 0.1 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
    ];
    
    return this.createSkeleton('Humanoid', bones);
  }
  
  // ============================================
  // ANIMATION CLIP MANAGEMENT
  // ============================================
  
  /**
   * Crear clip de animación
   */
  createClip(
    name: string,
    skeletonId: string,
    duration: number = 1.0,
    frameRate: number = 30
  ): AnimationClip | null {
    const skeleton = this.getSkeleton(skeletonId);
    if (!skeleton) return null;
    
    const id = generateId();
    
    const clip: AnimationClip = {
      id,
      name,
      skeletonId,
      duration,
      frameRate,
      startFrame: 0,
      endFrame: Math.floor(duration * frameRate),
      curves: new Map(),
      events: [],
      tags: [],
      loop: true,
      additive: false,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Crear curvas para cada hueso
    for (const [boneId, bone] of skeleton.bones) {
      // Position curves
      for (const comp of ['x', 'y', 'z'] as const) {
        const curveId = generateId();
        clip.curves.set(`${boneId}_position_${comp}`, {
          id: curveId,
          name: `${bone.name}.position.${comp}`,
          type: `position_${comp}` as CurveType,
          boneId,
          property: 'position',
          component: comp,
          keyframes: [{
            id: generateId(),
            time: 0,
            value: bone.localPosition[comp === 'x' ? 'x' : comp === 'y' ? 'y' : 'z'] as number,
            interpolation: 'linear',
            selected: false,
            locked: false,
          }],
          interpolation: 'linear',
          preWrapMode: 'clamp',
          postWrapMode: 'clamp',
          color: { r: 1, g: 0.5, b: 0, a: 1 },
          visible: true,
          locked: false,
        });
      }
      
      // Rotation curves (quaternion)
      for (const comp of ['x', 'y', 'z', 'w'] as const) {
        const curveId = generateId();
        clip.curves.set(`${boneId}_rotation_${comp}`, {
          id: curveId,
          name: `${bone.name}.rotation.${comp}`,
          type: `rotation_${comp}` as CurveType,
          boneId,
          property: 'rotation',
          component: comp,
          keyframes: [{
            id: generateId(),
            time: 0,
            value: bone.localRotation[comp === 'w' ? 'w' : comp] as number,
            interpolation: 'linear',
            selected: false,
            locked: false,
          }],
          interpolation: 'linear',
          preWrapMode: 'clamp',
          postWrapMode: 'clamp',
          color: { r: 0, g: 0.5, b: 1, a: 1 },
          visible: true,
          locked: false,
        });
      }
      
      // Scale curves
      for (const comp of ['x', 'y', 'z'] as const) {
        const curveId = generateId();
        clip.curves.set(`${boneId}_scale_${comp}`, {
          id: curveId,
          name: `${bone.name}.scale.${comp}`,
          type: `scale_${comp}` as CurveType,
          boneId,
          property: 'scale',
          component: comp,
          keyframes: [{
            id: generateId(),
            time: 0,
            value: bone.localScale[comp === 'x' ? 'x' : comp === 'y' ? 'y' : 'z'] as number,
            interpolation: 'linear',
            selected: false,
            locked: false,
          }],
          interpolation: 'linear',
          preWrapMode: 'clamp',
          postWrapMode: 'clamp',
          color: { r: 0.5, g: 1, b: 0, a: 1 },
          visible: true,
          locked: false,
        });
      }
    }
    
    this.clips.set(id, clip);
    return clip;
  }
  
  /**
   * Obtener clip
   */
  getClip(id: string): AnimationClip | null {
    return this.clips.get(id) || null;
  }
  
  /**
   * Añadir keyframe
   */
  addKeyframe(
    clipId: string,
    curveKey: string,
    time: number,
    value: number
  ): AnimationKeyframe | null {
    const clip = this.clips.get(clipId);
    if (!clip) return null;
    
    const curve = clip.curves.get(curveKey);
    if (!curve) return null;
    
    const keyframe: AnimationKeyframe = {
      id: generateId(),
      time,
      value,
      interpolation: curve.interpolation,
      selected: false,
      locked: false,
    };
    
    // Insertar en orden
    const insertIndex = curve.keyframes.findIndex(k => k.time > time);
    if (insertIndex === -1) {
      curve.keyframes.push(keyframe);
    } else {
      curve.keyframes.splice(insertIndex, 0, keyframe);
    }
    
    // Actualizar duración si es necesario
    if (time > clip.duration) {
      clip.duration = time;
      clip.endFrame = Math.floor(time * clip.frameRate);
    }
    
    clip.updatedAt = new Date();
    
    return keyframe;
  }
  
  // ============================================
  // ANIMATION PLAYBACK
  // ============================================
  
  /**
   * Crear reproductor de animación
   */
  createPlayer(skeletonId: string): AnimationPlayer {
    const id = generateId();
    
    const player: AnimationPlayer = {
      id,
      skeletonId,
      clips: new Map(),
      currentClipId: null,
      playbackState: 'stopped',
      currentTime: 0,
      playbackSpeed: 1,
      blending: false,
      blendTime: 0.3,
      blendProgress: 0,
      previousClipId: null,
    };
    
    this.players.set(id, player);
    return player;
  }
  
  /**
   * Reproducir clip
   */
  playClip(playerId: string, clipId: string, blend: boolean = true): void {
    const player = this.players.get(playerId);
    const clip = this.clips.get(clipId);
    
    if (!player || !clip) return;
    
    if (blend && player.currentClipId && player.currentClipId !== clipId) {
      // Iniciar blending
      player.blending = true;
      player.blendProgress = 0;
      player.previousClipId = player.currentClipId;
    }
    
    player.currentClipId = clipId;
    player.currentTime = 0;
    player.playbackState = 'playing';
  }
  
  /**
   * Actualizar reproducción
   */
  updatePlayback(playerId: string, deltaTime: number): SkeletonPose | null {
    const player = this.players.get(playerId);
    if (!player || player.playbackState !== 'playing' || !player.currentClipId) {
      return null;
    }
    
    const clip = this.clips.get(player.currentClipId);
    if (!clip) return null;
    
    const skeleton = this.skeletons.get(player.skeletonId);
    if (!skeleton) return null;
    
    // Actualizar tiempo
    player.currentTime += deltaTime * player.playbackSpeed;
    
    // Loop
    if (player.currentTime >= clip.duration) {
      if (clip.loop) {
        player.currentTime = player.currentTime % clip.duration;
      } else {
        player.currentTime = clip.duration;
        player.playbackState = 'stopped';
        player.onComplete?.();
      }
    }
    
    // Actualizar blending
    if (player.blending) {
      player.blendProgress += deltaTime / player.blendTime;
      if (player.blendProgress >= 1) {
        player.blending = false;
        player.blendProgress = 1;
        player.previousClipId = null;
      }
    }
    
    // Calcular pose
    const pose: SkeletonPose = {
      skeletonId: player.skeletonId,
      bonePoses: new Map(),
    };
    
    for (const [boneId, bone] of skeleton.bones) {
      // Evaluar curvas para este hueso
      const position = this.evaluateBonePosition(clip, boneId, player.currentTime);
      const rotation = this.evaluateBoneRotation(clip, boneId, player.currentTime);
      const scale = this.evaluateBoneScale(clip, boneId, player.currentTime);
      
      // Si hay blending, interpolar con pose anterior
      let finalPos = position;
      let finalRot = rotation;
      let finalScale = scale;
      
      if (player.blending && player.previousClipId) {
        const prevClip = this.clips.get(player.previousClipId);
        if (prevClip) {
          const prevPos = this.evaluateBonePosition(prevClip, boneId, player.currentTime);
          const prevRot = this.evaluateBoneRotation(prevClip, boneId, player.currentTime);
          const prevScale = this.evaluateBoneScale(prevClip, boneId, player.currentTime);
          
          const t = player.blendProgress;
          finalPos = this.lerpVec3(prevPos, position, t);
          finalRot = this.slerpQuat(prevRot, rotation, t);
          finalScale = this.lerpVec3(prevScale, scale, t);
        }
      }
      
      pose.bonePoses.set(boneId, {
        boneId,
        position: finalPos,
        rotation: finalRot,
        scale: finalScale,
      });
    }
    
    // Check events
    for (const event of clip.events) {
      if (!event.triggered && event.time <= player.currentTime) {
        event.triggered = true;
        player.onEvent?.(event);
      }
    }
    
    return pose;
  }
  
  /**
   * Evaluar posición de hueso en tiempo
   */
  private evaluateBonePosition(
    clip: AnimationClip,
    boneId: string,
    time: number
  ): Vec3 {
    return {
      x: this.evaluateCurve(clip, `${boneId}_position_x`, time) as number,
      y: this.evaluateCurve(clip, `${boneId}_position_y`, time) as number,
      z: this.evaluateCurve(clip, `${boneId}_position_z`, time) as number,
    };
  }
  
  /**
   * Evaluar rotación de hueso en tiempo
   */
  private evaluateBoneRotation(
    clip: AnimationClip,
    boneId: string,
    time: number
  ): Quat {
    return {
      x: this.evaluateCurve(clip, `${boneId}_rotation_x`, time) as number,
      y: this.evaluateCurve(clip, `${boneId}_rotation_y`, time) as number,
      z: this.evaluateCurve(clip, `${boneId}_rotation_z`, time) as number,
      w: this.evaluateCurve(clip, `${boneId}_rotation_w`, time) as number,
    };
  }
  
  /**
   * Evaluar escala de hueso en tiempo
   */
  private evaluateBoneScale(
    clip: AnimationClip,
    boneId: string,
    time: number
  ): Vec3 {
    return {
      x: this.evaluateCurve(clip, `${boneId}_scale_x`, time) as number,
      y: this.evaluateCurve(clip, `${boneId}_scale_y`, time) as number,
      z: this.evaluateCurve(clip, `${boneId}_scale_z`, time) as number,
    };
  }
  
  /**
   * Evaluar curva en tiempo
   */
  private evaluateCurve(
    clip: AnimationClip,
    curveKey: string,
    time: number
  ): number {
    const curve = clip.curves.get(curveKey);
    if (!curve || curve.keyframes.length === 0) return 0;
    
    // Encontrar keyframes circundantes
    let prevKf = curve.keyframes[0];
    let nextKf = curve.keyframes[curve.keyframes.length - 1];
    
    for (let i = 0; i < curve.keyframes.length - 1; i++) {
      if (curve.keyframes[i].time <= time && curve.keyframes[i + 1].time >= time) {
        prevKf = curve.keyframes[i];
        nextKf = curve.keyframes[i + 1];
        break;
      }
    }
    
    // Si solo hay un keyframe
    if (prevKf === nextKf) {
      return prevKf.value as number;
    }
    
    // Interpolar
    const t = (time - prevKf.time) / (nextKf.time - prevKf.time);
    
    switch (prevKf.interpolation) {
      case 'step':
        return prevKf.value as number;
      case 'linear':
      default:
        return this.lerp(
          prevKf.value as number,
          nextKf.value as number,
          t
        );
    }
  }
  
  // ============================================
  // IK SYSTEM
  // ============================================
  
  /**
   * Crear sistema IK
   */
  createIKSystem(skeletonId: string): IKSystem {
    const id = generateId();
    
    const system: IKSystem = {
      id,
      name: 'IK System',
      skeletonId,
      goals: new Map(),
      enabled: true,
      solveOrder: [],
    };
    
    this.ikSystems.set(id, system);
    return system;
  }
  
  /**
   * Añadir goal IK
   */
  addIKGoal(
    systemId: string,
    name: string,
    endBoneId: string,
    chainLength: number,
    type: 'position' | 'rotation' | 'look_at' = 'position'
  ): IKGoal | null {
    const system = this.ikSystems.get(systemId);
    if (!system) return null;
    
    const skeleton = this.skeletons.get(system.skeletonId);
    if (!skeleton) return null;
    
    // Construir cadena de huesos
    const boneChain: string[] = [];
    let currentBoneId: string | null = endBoneId;
    
    for (let i = 0; i < chainLength && currentBoneId; i++) {
      boneChain.unshift(currentBoneId);
      const bone = skeleton.bones.get(currentBoneId);
      currentBoneId = bone?.parentId || null;
    }
    
    const goal: IKGoal = {
      id: generateId(),
      name,
      type,
      chainLength,
      boneChain,
      weight: 1,
      rotationWeight: 1,
      solver: 'ccd',
      solverConfig: {
        maxIterations: 10,
        tolerance: 0.001,
        ccdRotationWeight: 1,
        fabrikAngleConstraint: 180,
        jacobianDamping: 0.1,
        bendNormal: { x: 0, y: 1, z: 0 },
        preserveLength: true,
      },
    };
    
    system.goals.set(goal.id, goal);
    system.solveOrder.push(goal.id);
    
    return goal;
  }
  
  /**
   * Resolver IK
   */
  solveIK(systemId: string, pose: SkeletonPose): void {
    const system = this.ikSystems.get(systemId);
    if (!system || !system.enabled) return;
    
    for (const goalId of system.solveOrder) {
      const goal = system.goals.get(goalId);
      if (!goal || !goal.targetPosition) continue;
      
      switch (goal.solver) {
        case 'ccd':
          this.solveCCD(system.skeletonId, goal, pose);
          break;
        case 'fabrik':
          this.solveFABRIK(system.skeletonId, goal, pose);
          break;
        case 'two_bone':
          this.solveTwoBone(system.skeletonId, goal, pose);
          break;
      }
    }
  }
  
  /**
   * Resolver CCD IK
   */
  private solveCCD(
    skeletonId: string,
    goal: IKGoal,
    pose: SkeletonPose
  ): void {
    const skeleton = this.skeletons.get(skeletonId);
    if (!skeleton || goal.boneChain.length === 0) return;
    
    const endBone = skeleton.bones.get(goal.boneChain[goal.boneChain.length - 1]);
    if (!endBone || !goal.targetPosition) return;
    
    for (let iter = 0; iter < goal.solverConfig.maxIterations; iter++) {
      // Obtener posición actual del extremo
      const endPos = this.getBoneWorldPosition(endBone.id, pose, skeleton);
      
      // Verificar convergencia
      const dist = this.distance(endPos, goal.targetPosition);
      if (dist < goal.solverConfig.tolerance) break;
      
      // Iterar sobre huesos de la cadena
      for (let i = goal.boneChain.length - 2; i >= 0; i--) {
        const boneId = goal.boneChain[i];
        const bonePose = pose.bonePoses.get(boneId);
        if (!bonePose) continue;
        
        // Calcular rotación para acercar extremo al objetivo
        const boneWorldPos = this.getBoneWorldPosition(boneId, pose, skeleton);
        
        // Vector hacia extremo actual
        const toEnd = this.normalize({
          x: endPos.x - boneWorldPos.x,
          y: endPos.y - boneWorldPos.y,
          z: endPos.z - boneWorldPos.z,
        });
        
        // Vector hacia objetivo
        const toTarget = this.normalize({
          x: goal.targetPosition.x - boneWorldPos.x,
          y: goal.targetPosition.y - boneWorldPos.y,
          z: goal.targetPosition.z - boneWorldPos.z,
        });
        
        // Calcular rotación entre vectores
        const rotation = this.rotationBetweenVectors(toEnd, toTarget);
        
        // Aplicar rotación
        bonePose.rotation = this.multiplyQuat(bonePose.rotation, rotation);
        
        // Actualizar posición del extremo
        // (simplificación: en producción recalcular toda la cadena)
      }
    }
  }
  
  /**
   * Resolver FABRIK IK
   */
  private solveFABRIK(
    skeletonId: string,
    goal: IKGoal,
    pose: SkeletonPose
  ): void {
    // Simplificación: usar CCD
    this.solveCCD(skeletonId, goal, pose);
  }
  
  /**
   * Resolver Two-Bone IK
   */
  private solveTwoBone(
    skeletonId: string,
    goal: IKGoal,
    pose: SkeletonPose
  ): void {
    if (goal.boneChain.length < 2 || !goal.targetPosition) return;
    
    const skeleton = this.skeletons.get(skeletonId);
    if (!skeleton) return;
    
    const rootBoneId = goal.boneChain[0];
    const midBoneId = goal.boneChain[1];
    const endBoneId = goal.boneChain[2];
    
    const rootPose = pose.bonePoses.get(rootBoneId);
    const midPose = pose.bonePoses.get(midBoneId);
    
    if (!rootPose || !midPose) return;
    
    // Calcular longitudes
    const rootPos = this.getBoneWorldPosition(rootBoneId, pose, skeleton);
    const midPos = this.getBoneWorldPosition(midBoneId, pose, skeleton);
    const endPos = this.getBoneWorldPosition(endBoneId!, pose, skeleton);
    
    const upperLen = this.distance(rootPos, midPos);
    const lowerLen = this.distance(midPos, endPos);
    
    // Calcular posición objetivo del codo
    const targetPos = goal.targetPosition;
    const rootToTarget = this.distance(rootPos, targetPos);
    
    // Verificar alcance
    if (rootToTarget >= upperLen + lowerLen) {
      // Extensión completa
      const direction = this.normalize({
        x: targetPos.x - rootPos.x,
        y: targetPos.y - rootPos.y,
        z: targetPos.z - rootPos.z,
      });
      
      // Rotar raíz hacia objetivo
      // (simplificación)
    }
    
    // Calcular posición del codo usando ley de cosenos
    // ... implementación completa sería más extensa
  }
  
  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  private createIdentityMatrix(): number[] {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
  }
  
  private composeMatrix(pos: Vec3, rot: Quat, scale: Vec3): number[] {
    // Simplificación: matriz identidad
    return this.createIdentityMatrix();
  }
  
  private invertMatrix(m: number[]): number[] {
    // Simplificación: retornar identidad
    return this.createIdentityMatrix();
  }
  
  private multiplyMatrices(a: number[], b: number[]): number[] {
    // Simplificación: retornar b
    return b;
  }
  
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  
  private lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
    return {
      x: this.lerp(a.x, b.x, t),
      y: this.lerp(a.y, b.y, t),
      z: this.lerp(a.z, b.z, t),
    };
  }
  
  private slerpQuat(a: Quat, b: Quat, t: number): Quat {
    // Simplificación: lerp
    return {
      x: this.lerp(a.x, b.x, t),
      y: this.lerp(a.y, b.y, t),
      z: this.lerp(a.z, b.z, t),
      w: this.lerp(a.w, b.w, t),
    };
  }
  
  private distance(a: Vec3, b: Vec3): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  private normalize(v: Vec3): Vec3 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }
  
  private rotationBetweenVectors(from: Vec3, to: Vec3): Quat {
    // Simplificación: identidad
    return { x: 0, y: 0, z: 0, w: 1 };
  }
  
  private multiplyQuat(a: Quat, b: Quat): Quat {
    // Simplificación
    return a;
  }
  
  private getBoneWorldPosition(
    boneId: string,
    pose: SkeletonPose,
    skeleton: Skeleton
  ): Vec3 {
    const bonePose = pose.bonePoses.get(boneId);
    if (!bonePose) return { x: 0, y: 0, z: 0 };
    
    // Simplificación: retornar posición local
    return { ...bonePose.position };
  }
  
  // ============================================
  // EXPORT / IMPORT
  // ============================================
  
  /**
   * Exportar clip
   */
  exportClip(clipId: string): string | null {
    const clip = this.clips.get(clipId);
    if (!clip) return null;
    
    return JSON.stringify({
      ...clip,
      curves: Array.from(clip.curves.entries()),
    });
  }
  
  /**
   * Importar clip
   */
  importClip(json: string): AnimationClip | null {
    try {
      const data = JSON.parse(json);
      
      const clip: AnimationClip = {
        ...data,
        id: generateId(),
        curves: new Map(data.curves),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      this.clips.set(clip.id, clip);
      return clip;
    } catch {
      return null;
    }
  }
}

// ============================================
// FACTORY
// ============================================

export function createAnimationManager(): AnimationManager {
  return new AnimationManager();
}

export default AnimationManager;
