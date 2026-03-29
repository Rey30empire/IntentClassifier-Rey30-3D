/**
 * NEXUS Engine - Animation Module
 * 
 * Sistema de animación esquelética
 */

export {
  AnimationManager,
  createAnimationManager,
  
  // Skeleton
  type Skeleton,
  type Bone,
  type SkeletonPose,
  type BonePose,
  
  // Curves
  type AnimationCurve,
  type AnimationKeyframe,
  type CurveType,
  type InterpolationType,
  type WrapMode,
  type BezierControlPoint,
  
  // Clip
  type AnimationClip,
  type AnimationEvent,
  
  // State Machine
  type AnimationStateMachine,
  type AnimationState,
  type AnimationTransition,
  type TransitionCondition,
  type AnimatorParameter,
  type AnimationLayer,
  type AvatarMask,
  
  // Blend Tree
  type BlendTree,
  type BlendTreeMotion,
  type BlendTreeType,
  
  // IK
  type IKSystem,
  type IKGoal,
  type IKSolverType,
  type IKSolverConfig,
  
  // Player
  type AnimationPlayer,
  type PlaybackState,
  
  // Retargeting
  type RetargetingProfile,
  type BoneMapping,
  
  // Editor
  type AnimationEditorState,
  type EditorTool,
  type EditorMode,
  type EditorSelection,
} from './AnimationSystem';

// Alias for backward compatibility
export type { IKGoal as IKGoalType } from './AnimationSystem';
