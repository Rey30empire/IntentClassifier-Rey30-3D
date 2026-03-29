/**
 * NEXUS Engine - Keyframe System
 * 
 * Sistema de keyframes con interpolación para animación
 */

import {
  Keyframe,
  AnimationTrack,
  BoneTrack,
  InterpolationType,
  BezierControlPoints,
  Vec3,
  Quat,
} from '../types';
import { generateId } from '../../conversion/types';

// ============================================
// KEYFRAME CREATION
// ============================================

export function createKeyframe(
  time: number,
  value: number | Vec3 | Quat,
  interpolation: InterpolationType = 'linear'
): Keyframe {
  return {
    id: generateId(),
    time,
    value: typeof value === 'object' ? { ...value } as Vec3 | Quat : value,
    interpolation,
    selected: false,
  };
}

export function copyKeyframe(keyframe: Keyframe): Keyframe {
  return {
    ...keyframe,
    id: generateId(),
    value: typeof keyframe.value === 'object' 
      ? { ...keyframe.value } as Vec3 | Quat 
      : keyframe.value,
    bezierControl: keyframe.bezierControl 
      ? { ...keyframe.bezierControl } 
      : undefined,
  };
}

// ============================================
// KEYFRAME OPERATIONS
// ============================================

export function addKeyframe(track: AnimationTrack, keyframe: Keyframe): void {
  // Find insertion point (keep sorted by time)
  let insertIndex = track.keyframes.length;
  
  for (let i = 0; i < track.keyframes.length; i++) {
    if (keyframe.time < track.keyframes[i].time) {
      insertIndex = i;
      break;
    }
  }

  track.keyframes.splice(insertIndex, 0, keyframe);
}

export function removeKeyframe(track: AnimationTrack, keyframeId: string): boolean {
  const index = track.keyframes.findIndex(kf => kf.id === keyframeId);
  if (index === -1) return false;

  track.keyframes.splice(index, 1);
  return true;
}

export function moveKeyframe(track: AnimationTrack, keyframeId: string, newTime: number): boolean {
  const keyframe = track.keyframes.find(kf => kf.id === keyframeId);
  if (!keyframe) return false;

  // Remove and re-add to maintain sort
  removeKeyframe(track, keyframeId);
  keyframe.time = newTime;
  addKeyframe(track, keyframe);

  return true;
}

export function getKeyframeAtTime(track: AnimationTrack, time: number, tolerance = 0.001): Keyframe | undefined {
  return track.keyframes.find(kf => Math.abs(kf.time - time) < tolerance);
}

export function getKeyframesInRange(track: AnimationTrack, startTime: number, endTime: number): Keyframe[] {
  return track.keyframes.filter(kf => kf.time >= startTime && kf.time <= endTime);
}

// ============================================
// INTERPOLATION
// ============================================

/**
 * Evaluate track value at given time
 */
export function evaluateTrack(track: AnimationTrack, time: number): number | Vec3 | Quat {
  if (track.keyframes.length === 0) {
    return typeof track.keyframes[0]?.value === 'number' ? 0 : { x: 0, y: 0, z: 0 } as Vec3;
  }

  if (track.keyframes.length === 1) {
    return track.keyframes[0].value;
  }

  // Find surrounding keyframes
  let prevKf = track.keyframes[0];
  let nextKf = track.keyframes[track.keyframes.length - 1];

  for (let i = 0; i < track.keyframes.length - 1; i++) {
    if (time >= track.keyframes[i].time && time <= track.keyframes[i + 1].time) {
      prevKf = track.keyframes[i];
      nextKf = track.keyframes[i + 1];
      break;
    }
  }

  // Before first keyframe
  if (time <= prevKf.time) {
    return prevKf.value;
  }

  // After last keyframe
  if (time >= nextKf.time) {
    return nextKf.value;
  }

  // Calculate interpolation factor
  const duration = nextKf.time - prevKf.time;
  const t = duration > 0 ? (time - prevKf.time) / duration : 0;

  // Interpolate based on type
  switch (nextKf.interpolation) {
    case 'step':
      return prevKf.value;
    
    case 'linear':
      return interpolateLinear(prevKf.value, nextKf.value, t);
    
    case 'bezier':
      return interpolateBezier(prevKf, nextKf, t);
    
    case 'hermite':
      return interpolateHermite(prevKf, nextKf, t);
    
    default:
      return interpolateLinear(prevKf.value, nextKf.value, t);
  }
}

function interpolateLinear(a: number | Vec3 | Quat, b: number | Vec3 | Quat, t: number): number | Vec3 | Quat {
  if (typeof a === 'number' && typeof b === 'number') {
    return a + (b - a) * t;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    if ('w' in a && 'w' in b) {
      // Quaternion interpolation (slerp)
      return slerp(a as Quat, b as Quat, t);
    } else {
      // Vec3 interpolation
      const va = a as Vec3;
      const vb = b as Vec3;
      return {
        x: va.x + (vb.x - va.x) * t,
        y: va.y + (vb.y - va.y) * t,
        z: va.z + (vb.z - va.z) * t,
      };
    }
  }

  return a;
}

function interpolateBezier(prevKf: Keyframe, nextKf: Keyframe, t: number): number | Vec3 | Quat {
  const a = prevKf.value;
  const b = nextKf.value;

  if (typeof a === 'number' && typeof b === 'number') {
    // Cubic bezier for scalar values
    const p0 = a;
    const p3 = b;
    
    const duration = nextKf.time - prevKf.time;
    const p1 = p0 + (prevKf.bezierControl?.outTangent.x ?? 0.33 * duration);
    const p2 = p3 + (nextKf.bezierControl?.inTangent.x ?? -0.33 * duration);

    // Cubic bezier formula
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    return mt3 * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * p3;
  }

  // Fallback to linear for complex types
  return interpolateLinear(a, b, t);
}

function interpolateHermite(prevKf: Keyframe, nextKf: Keyframe, t: number): number | Vec3 | Quat {
  const a = prevKf.value;
  const b = nextKf.value;

  if (typeof a === 'number' && typeof b === 'number') {
    const p0 = a;
    const p1 = b;
    const m0 = prevKf.outTangent ?? 0;
    const m1 = nextKf.inTangent ?? 0;

    const t2 = t * t;
    const t3 = t2 * t;

    // Hermite basis functions
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
  }

  // Fallback to linear for complex types
  return interpolateLinear(a, b, t);
}

function slerp(a: Quat, b: Quat, t: number): Quat {
  let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;

  // If dot is negative, negate one quaternion
  if (dot < 0) {
    b = { x: -b.x, y: -b.y, z: -b.z, w: -b.w };
    dot = -dot;
  }

  // If close, use linear interpolation
  if (dot > 0.9995) {
    return normalizeQuat({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
      w: a.w + (b.w - a.w) * t,
    });
  }

  const theta0 = Math.acos(dot);
  const theta = theta0 * t;

  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);

  const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
  const s1 = sinTheta / sinTheta0;

  return normalizeQuat({
    x: a.x * s0 + b.x * s1,
    y: a.y * s0 + b.y * s1,
    z: a.z * s0 + b.z * s1,
    w: a.w * s0 + b.w * s1,
  });
}

function normalizeQuat(q: Quat): Quat {
  const mag = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  return {
    x: q.x / mag,
    y: q.y / mag,
    z: q.z / mag,
    w: q.w / mag,
  };
}

// ============================================
// CURVE UTILITIES
// ============================================

/**
 * Simplify keyframes by removing redundant ones
 */
export function simplifyTrack(track: AnimationTrack, tolerance: number): void {
  if (track.keyframes.length <= 2) return;

  const simplified: Keyframe[] = [track.keyframes[0]];

  for (let i = 1; i < track.keyframes.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const current = track.keyframes[i];
    const next = track.keyframes[i + 1];

    // Check if current keyframe is necessary
    const midTime = (prev.time + next.time) / 2;
    const interpolated = evaluateTrack({ ...track, keyframes: [prev, next] }, midTime);
    const actual = current.value;

    const diff = typeof actual === 'number'
      ? Math.abs((interpolated as number) - actual)
      : Math.sqrt(
          ((interpolated as Vec3).x - (actual as Vec3).x) ** 2 +
          ((interpolated as Vec3).y - (actual as Vec3).y) ** 2 +
          ((interpolated as Vec3).z - (actual as Vec3).z) ** 2
        );

    if (diff > tolerance) {
      simplified.push(current);
    }
  }

  simplified.push(track.keyframes[track.keyframes.length - 1]);
  track.keyframes = simplified;
}

/**
 * Resample track at fixed intervals
 */
export function resampleTrack(track: AnimationTrack, interval: number, startTime: number, endTime: number): void {
  const newKeyframes: Keyframe[] = [];

  for (let t = startTime; t <= endTime; t += interval) {
    const value = evaluateTrack(track, t);
    newKeyframes.push(createKeyframe(t, value));
  }

  track.keyframes = newKeyframes;
}

/**
 * Reverse keyframes in track
 */
export function reverseTrack(track: AnimationTrack, duration: number): void {
  for (const kf of track.keyframes) {
    kf.time = duration - kf.time;
  }
  track.keyframes.sort((a, b) => a.time - b.time);
}

/**
 * Scale keyframe times
 */
export function scaleTrackTime(track: AnimationTrack, scale: number): void {
  for (const kf of track.keyframes) {
    kf.time *= scale;
  }
}

/**
 * Offset keyframe times
 */
export function offsetTrackTime(track: AnimationTrack, offset: number): void {
  for (const kf of track.keyframes) {
    kf.time += offset;
  }
}

// ============================================
// BONE TRACK OPERATIONS
// ============================================

/**
 * Create empty bone track
 */
export function createBoneTrack(boneId: string, boneName: string): BoneTrack {
  const basePath = `bones.${boneId}`;
  
  return {
    boneId,
    boneName,
    positionX: createAnimationTrack(`${boneName}.position.x`, `${basePath}.position.x`),
    positionY: createAnimationTrack(`${boneName}.position.y`, `${basePath}.position.y`),
    positionZ: createAnimationTrack(`${boneName}.position.z`, `${basePath}.position.z`),
    rotationX: createAnimationTrack(`${boneName}.rotation.x`, `${basePath}.rotation.x`),
    rotationY: createAnimationTrack(`${boneName}.rotation.y`, `${basePath}.rotation.y`),
    rotationZ: createAnimationTrack(`${boneName}.rotation.z`, `${basePath}.rotation.z`),
    rotationW: createAnimationTrack(`${boneName}.rotation.w`, `${basePath}.rotation.w`),
    scaleX: createAnimationTrack(`${boneName}.scale.x`, `${basePath}.scale.x`),
    scaleY: createAnimationTrack(`${boneName}.scale.y`, `${basePath}.scale.y`),
    scaleZ: createAnimationTrack(`${boneName}.scale.z`, `${basePath}.scale.z`),
  };
}

function createAnimationTrack(name: string, propertyPath: string): AnimationTrack {
  return {
    id: generateId(),
    name,
    propertyPath,
    keyframes: [],
    enabled: true,
    locked: false,
    muted: false,
    color: '#ff6b6b',
  };
}

/**
 * Get all tracks from bone track
 */
export function getAllTracksFromBone(boneTrack: BoneTrack): AnimationTrack[] {
  return [
    boneTrack.positionX,
    boneTrack.positionY,
    boneTrack.positionZ,
    boneTrack.rotationX,
    boneTrack.rotationY,
    boneTrack.rotationZ,
    boneTrack.rotationW,
    boneTrack.scaleX,
    boneTrack.scaleY,
    boneTrack.scaleZ,
  ];
}
