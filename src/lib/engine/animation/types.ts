/**
 * NEXUS Engine - Animation System Types
 * 
 * Tipos e interfaces para el sistema de animación esquelética
 */

import { Quat, Vec3 } from '../conversion/types';
export type { Quat, Vec3 } from '../conversion/types';

// ============================================
// SKELETON TYPES
// ============================================

/** Bone in a skeleton */
export interface Bone {
  id: string;
  name: string;
  index: number;
  
  // Hierarchy
  parentId: string | null;
  childrenIds: string[];
  
  // Bind pose (local transform relative to parent)
  localPosition: Vec3;
  localRotation: Quat;
  localScale: Vec3;
  
  // Bind pose (world transform)
  bindPosition: Vec3;
  bindRotation: Quat;
  bindScale: Vec3;
  
  // Inverse bind matrix (for skinning)
  inverseBindMatrix: number[];
  
  // Metadata
  length?: number;
  ikConstraint?: IKConstraint;
}

/** Skeleton definition */
export interface Skeleton {
  id: string;
  name: string;
  bones: Map<string, Bone>;
  boneIndices: Map<string, number>;
  rootBoneIds: string[];
  
  // Metadata
  metadata: SkeletonMetadata;
}

export interface SkeletonMetadata {
  author?: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  boneCount: number;
}

// ============================================
// POSE TYPES
// ============================================

/** Transform for a single bone in a pose */
export interface BoneTransform {
  boneId: string;
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
}

/** A pose is a collection of bone transforms */
export interface Pose {
  id: string;
  name: string;
  skeletonId: string;
  transforms: Map<string, BoneTransform>;
  
  // Is this a bind pose?
  isBindPose: boolean;
  
  // Metadata
  metadata: PoseMetadata;
}

export interface PoseMetadata {
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

// ============================================
// KEYFRAME TYPES
// ============================================

/** Interpolation type */
export type InterpolationType = 
  | 'linear'
  | 'step'
  | 'bezier'
  | 'hermite'
  | 'constant';

/** Bezier control points for custom curves */
export interface BezierControlPoints {
  inTangent: Vec3;
  outTangent: Vec3;
}

/** A single keyframe for one property */
export interface Keyframe {
  id: string;
  time: number; // in seconds
  value: number | Vec3 | Quat;
  interpolation: InterpolationType;
  bezierControl?: BezierControlPoints;
  
  // For tangents-based interpolation
  inTangent?: number;
  outTangent?: number;
  
  // Selection state
  selected: boolean;
}

/** Track for a single property (e.g., bone rotation X) */
export interface AnimationTrack {
  id: string;
  name: string;
  propertyPath: string; // e.g., "bone_001.rotation.x"
  keyframes: Keyframe[];
  
  // Track settings
  enabled: boolean;
  locked: boolean;
  muted: boolean;
  
  // Color for visualization
  color: string;
}

/** Bone track containing all property tracks for a bone */
export interface BoneTrack {
  boneId: string;
  boneName: string;
  
  // Property tracks
  positionX: AnimationTrack;
  positionY: AnimationTrack;
  positionZ: AnimationTrack;
  rotationX: AnimationTrack;
  rotationY: AnimationTrack;
  rotationZ: AnimationTrack;
  rotationW: AnimationTrack;
  scaleX: AnimationTrack;
  scaleY: AnimationTrack;
  scaleZ: AnimationTrack;
}

// ============================================
// ANIMATION CLIP TYPES
// ============================================

/** Animation clip */
export interface AnimationClip {
  id: string;
  name: string;
  skeletonId: string;
  
  // Timing
  duration: number;
  frameRate: number;
  startTime: number;
  endTime: number;
  
  // Tracks
  boneTracks: Map<string, BoneTrack>;
  
  // Settings
  loopMode: LoopMode;
  loopOffset: number;
  
  // Events
  events: AnimationEvent[];
  
  // Metadata
  metadata: AnimationClipMetadata;
}

export type LoopMode = 'none' | 'loop' | 'pingpong' | 'clamp';

export interface AnimationEvent {
  id: string;
  name: string;
  time: number;
  data: Record<string, unknown>;
}

export interface AnimationClipMetadata {
  author?: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  description?: string;
}

// ============================================
// ANIMATION PLAYER TYPES
// ============================================

/** Animation player state */
export interface AnimationPlayerState {
  clipId: string | null;
  currentTime: number;
  playbackSpeed: number;
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  
  // Blending
  blendWeight: number;
  blendDuration: number;
  previousClipId: string | null;
  previousClipTime: number;
  
  // Layer
  layer: number;
  layerWeight: number;
}

/** Animation player configuration */
export interface AnimationPlayerConfig {
  autoPlay: boolean;
  defaultBlendDuration: number;
  updateMode: 'normal' | 'animatePhysics' | 'unscaledTime';
  cullingMode: 'alwaysAnimate' | 'cullUpdateTransforms' | 'cullCompletely';
}

// ============================================
// ANIMATION EDITOR TYPES
// ============================================

/** Editor selection mode */
export type EditorSelectionMode = 'keyframe' | 'track' | 'bone' | 'curve';

/** Editor tool */
export type EditorTool = 'select' | 'move' | 'scale' | 'rotate' | 'pen' | 'erase';

/** Timeline zoom state */
export interface TimelineZoomState {
  startTime: number;
  endTime: number;
  pixelsPerSecond: number;
}

/** Curve editor state */
export interface CurveEditorState {
  selectedTrackId: string | null;
  selectedKeyframeIds: Set<string>;
  hoveredKeyframeId: string | null;
  tangentsVisible: boolean;
  normalizedView: boolean;
}

/** Animation editor state */
export interface AnimationEditorState {
  // Selection
  selectedClipId: string | null;
  selectedBoneIds: Set<string>;
  selectedTrackIds: Set<string>;
  selectedKeyframeIds: Set<string>;
  
  // Tools
  activeTool: EditorTool;
  selectionMode: EditorSelectionMode;
  
  // Timeline
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  loopPlayback: boolean;
  timelineZoom: TimelineZoomState;
  
  // Curve Editor
  curveEditor: CurveEditorState;
  
  // Panels
  showDopesheet: boolean;
  showCurveEditor: boolean;
  showPropertiesPanel: boolean;
  
  // UI
  isRecording: boolean;
  isSnapping: boolean;
  snapInterval: number; // in frames
  gridVisible: boolean;
}

// ============================================
// IK TYPES
// ============================================

/** IK constraint type */
export type IKConstraintType = 'twoBone' | 'chain' | 'lookAt' | 'pole';

/** IK constraint */
export interface IKConstraint {
  id: string;
  type: IKConstraintType;
  targetBoneId: string;
  chainLength: number;
  
  // Target
  targetPosition: Vec3;
  targetRotation?: Quat;
  
  // Settings
  iterations: number;
  tolerance: number;
  
  // Pole vector (for two-bone IK)
  polePosition?: Vec3;
  poleAngle?: number;
  
  // Weight
  weight: number;
}

/** IK solver result */
export interface IKSolveResult {
  success: boolean;
  iterations: number;
  boneTransforms: Map<string, BoneTransform>;
}

// ============================================
// RETARGETING TYPES
// ============================================

/** Bone mapping for retargeting */
export interface BoneMapping {
  sourceBoneId: string;
  targetBoneId: string;
  scale: number;
  rotationOffset: Quat;
  positionOffset: Vec3;
}

/** Retargeting configuration */
export interface RetargetingConfig {
  id: string;
  name: string;
  sourceSkeletonId: string;
  targetSkeletonId: string;
  boneMappings: Map<string, BoneMapping>;
  
  // Global settings
  preserveOriginalScale: boolean;
  scaleCompensation: number;
}

// ============================================
// ANIMATION LAYER TYPES
// ============================================

/** Animation layer */
export interface AnimationLayer {
  id: string;
  name: string;
  index: number;
  weight: number;
  blendMode: LayerBlendMode;
  avatarMask?: AvatarMask;
  clips: AnimationClip[];
  currentState: AnimationPlayerState;
}

export type LayerBlendMode = 'override' | 'additive';

/** Avatar mask for layer blending */
export interface AvatarMask {
  id: string;
  name: string;
  boneMask: Map<string, boolean>;
  transformMask: Map<string, { position: boolean; rotation: boolean; scale: boolean }>;
}

// ============================================
// BLEND TREE TYPES
// ============================================

/** Blend tree child */
export interface BlendTreeChild {
  clipId: string;
  position: Vec2;
  directBlendParameter?: string;
}

/** Blend tree */
export interface BlendTree {
  id: string;
  name: string;
  blendParameter: string;
  blendParameterY?: string;
  blendType: BlendTreeType;
  children: BlendTreeChild[];
  
  // Thresholds for 1D blending
  thresholds?: number[];
}

export type BlendTreeType = 'simple1D' | 'simple2D' | 'freeformDirectional2D' | 'freeformCartesian2D' | 'direct';

// ============================================
// STATE MACHINE TYPES
// ============================================

/** Animation state */
export interface AnimationState {
  id: string;
  name: string;
  motion: AnimationClip | BlendTree;
  speed: number;
  speedParameter?: string;
  mirror: boolean;
  mirrorParameter?: string;
  cycleOffset: number;
  cycleOffsetParameter?: string;
  iKOnFeet: boolean;
  writeDefaultValues: boolean;
}

/** State transition */
export interface StateTransition {
  id: string;
  sourceStateId: string;
  destinationStateId: string;
  
  // Timing
  duration: number;
  offset: number;
  exitTime: number;
  hasExitTime: boolean;
  hasFixedDuration: boolean;
  
  // Conditions
  conditions: TransitionCondition[];
  
  // Interruption
  canInterrupt: boolean;
  interruptionSource: InterruptionSource;
}

export interface TransitionCondition {
  parameterName: string;
  mode: TransitionConditionMode;
  threshold: number;
}

export type TransitionConditionMode = 'greater' | 'less' | 'equals' | 'notEqual';

export type InterruptionSource = 'none' | 'current' | 'next' | 'currentAndNext';

/** Animation state machine */
export interface AnimationStateMachine {
  id: string;
  name: string;
  states: Map<string, AnimationState>;
  transitions: StateTransition[];
  defaultStateId: string;
  currentStateId: string;
  parameters: AnimationParameter[];
}

export interface AnimationParameter {
  name: string;
  type: 'float' | 'int' | 'bool' | 'trigger';
  defaultValue: number | boolean;
  currentValue: number | boolean;
}

// ============================================
// EVENTS
// ============================================

/** Animation system events */
export interface AnimationEvents {
  'animation:clip-loaded': { clipId: string };
  'animation:clip-played': { clipId: string };
  'animation:clip-stopped': { clipId: string };
  'animation:clip-paused': { clipId: string };
  'animation:keyframe-added': { trackId: string; keyframeId: string };
  'animation:keyframe-removed': { trackId: string; keyframeId: string };
  'animation:keyframe-moved': { trackId: string; keyframeId: string; oldTime: number; newTime: number };
  'animation:bone-selected': { boneId: string };
  'animation:track-selected': { trackId: string };
  'animation:time-changed': { time: number };
  'animation:recording-started': Record<string, never>;
  'animation:recording-stopped': Record<string, never>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/** Create default bone transform */
export function createDefaultBoneTransform(boneId: string): BoneTransform {
  return {
    boneId,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

/** Create default keyframe */
export function createDefaultKeyframe(time: number, value: number | Vec3 | Quat): Keyframe {
  return {
    id: `kf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    time,
    value,
    interpolation: 'linear',
    selected: false,
  };
}

/** Create default animation track */
export function createDefaultAnimationTrack(name: string, propertyPath: string): AnimationTrack {
  const colors = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
    '#ffeaa7', '#dfe6e9', '#fd79a8', '#00b894',
  ];
  
  return {
    id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    propertyPath,
    keyframes: [],
    enabled: true,
    locked: false,
    muted: false,
    color: colors[Math.floor(Math.random() * colors.length)],
  };
}

/** Create default animation clip */
export function createDefaultAnimationClip(name: string, skeletonId: string): AnimationClip {
  return {
    id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    skeletonId,
    duration: 1,
    frameRate: 30,
    startTime: 0,
    endTime: 1,
    boneTracks: new Map(),
    loopMode: 'none',
    loopOffset: 0,
    events: [],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    },
  };
}

/** Vec2 type for blend trees */
export interface Vec2 {
  x: number;
  y: number;
}
