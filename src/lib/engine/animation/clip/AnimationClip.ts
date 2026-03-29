/**
 * NEXUS Engine - Animation Clip System
 * 
 * Sistema de clips de animación
 */

import {
  AnimationClip,
  AnimationEvent,
  AnimationTrack,
  BoneTrack,
  LoopMode,
  BoneTransform,
  Skeleton,
  Vec3,
  Quat,
} from '../types';
import { generateId } from '../../conversion/types';
import {
  createBoneTrack,
  evaluateTrack,
  addKeyframe,
  createKeyframe,
} from '../keyframe/Keyframe';

// ============================================
// CLIP CREATION
// ============================================

export function createAnimationClip(
  name: string,
  skeletonId: string,
  duration: number = 1,
  frameRate: number = 30
): AnimationClip {
  return {
    id: generateId(),
    name,
    skeletonId,
    duration,
    frameRate,
    startTime: 0,
    endTime: duration,
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

export function cloneClip(clip: AnimationClip, newName?: string): AnimationClip {
  const newBoneTracks = new Map<string, BoneTrack>();

  for (const [boneId, track] of clip.boneTracks) {
    newBoneTracks.set(boneId, { ...track });
  }

  return {
    ...clip,
    id: generateId(),
    name: newName ?? `${clip.name}_Copy`,
    boneTracks: newBoneTracks,
    events: [...clip.events],
    metadata: {
      ...clip.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

// ============================================
// TRACK MANAGEMENT
// ============================================

export function addBoneTrack(clip: AnimationClip, boneId: string, boneName: string): BoneTrack {
  const track = createBoneTrack(boneId, boneName);
  clip.boneTracks.set(boneId, track);
  clip.metadata.updatedAt = new Date();
  return track;
}

export function removeBoneTrack(clip: AnimationClip, boneId: string): boolean {
  const removed = clip.boneTracks.delete(boneId);
  if (removed) {
    clip.metadata.updatedAt = new Date();
  }
  return removed;
}

export function getBoneTrack(clip: AnimationClip, boneId: string): BoneTrack | undefined {
  return clip.boneTracks.get(boneId);
}

// ============================================
// EVENT MANAGEMENT
// ============================================

export function addEvent(clip: AnimationClip, name: string, time: number, data: Record<string, unknown> = {}): AnimationEvent {
  const event: AnimationEvent = {
    id: generateId(),
    name,
    time,
    data,
  };

  // Insert sorted by time
  let insertIndex = clip.events.length;
  for (let i = 0; i < clip.events.length; i++) {
    if (time < clip.events[i].time) {
      insertIndex = i;
      break;
    }
  }

  clip.events.splice(insertIndex, 0, event);
  clip.metadata.updatedAt = new Date();

  return event;
}

export function removeEvent(clip: AnimationClip, eventId: string): boolean {
  const index = clip.events.findIndex(e => e.id === eventId);
  if (index === -1) return false;

  clip.events.splice(index, 1);
  clip.metadata.updatedAt = new Date();
  return true;
}

export function getEventsAtTime(clip: AnimationClip, time: number, tolerance = 0.01): AnimationEvent[] {
  return clip.events.filter(e => Math.abs(e.time - time) < tolerance);
}

export function getEventsInRange(clip: AnimationClip, startTime: number, endTime: number): AnimationEvent[] {
  return clip.events.filter(e => e.time >= startTime && e.time <= endTime);
}

// ============================================
// SAMPLING
// ============================================

/**
 * Sample the clip at a given time and return bone transforms
 */
export function sampleClip(clip: AnimationClip, time: number, skeleton: Skeleton): Map<string, BoneTransform> {
  const transforms = new Map<string, BoneTransform>();

  // Loop time if needed
  let sampleTime = time;
  if (clip.loopMode === 'loop') {
    sampleTime = time % clip.duration;
  } else if (clip.loopMode === 'pingpong') {
    const cycle = Math.floor(time / clip.duration);
    sampleTime = cycle % 2 === 0 
      ? time % clip.duration 
      : clip.duration - (time % clip.duration);
  } else {
    // Clamp
    sampleTime = Math.max(clip.startTime, Math.min(clip.endTime, time));
  }

  // Sample each bone track
  for (const [boneId, boneTrack] of clip.boneTracks) {
    const bone = skeleton.bones.get(boneId);
    if (!bone) continue;

    const transform: BoneTransform = {
      boneId,
      position: {
        x: evaluateTrack(boneTrack.positionX, sampleTime) as number,
        y: evaluateTrack(boneTrack.positionY, sampleTime) as number,
        z: evaluateTrack(boneTrack.positionZ, sampleTime) as number,
      },
      rotation: {
        x: evaluateTrack(boneTrack.rotationX, sampleTime) as number,
        y: evaluateTrack(boneTrack.rotationY, sampleTime) as number,
        z: evaluateTrack(boneTrack.rotationZ, sampleTime) as number,
        w: evaluateTrack(boneTrack.rotationW, sampleTime) as number,
      },
      scale: {
        x: evaluateTrack(boneTrack.scaleX, sampleTime) as number,
        y: evaluateTrack(boneTrack.scaleY, sampleTime) as number,
        z: evaluateTrack(boneTrack.scaleZ, sampleTime) as number,
      },
    };

    transforms.set(boneId, transform);
  }

  return transforms;
}

// ============================================
// CLIP OPERATIONS
// ============================================

/**
 * Scale clip duration
 */
export function scaleClipDuration(clip: AnimationClip, newDuration: number): void {
  const scale = newDuration / clip.duration;

  // Scale all keyframe times
  for (const boneTrack of clip.boneTracks.values()) {
    const tracks = [
      boneTrack.positionX, boneTrack.positionY, boneTrack.positionZ,
      boneTrack.rotationX, boneTrack.rotationY, boneTrack.rotationZ, boneTrack.rotationW,
      boneTrack.scaleX, boneTrack.scaleY, boneTrack.scaleZ,
    ];

    for (const track of tracks) {
      for (const kf of track.keyframes) {
        kf.time *= scale;
      }
    }
  }

  // Scale events
  for (const event of clip.events) {
    event.time *= scale;
  }

  clip.duration = newDuration;
  clip.endTime = newDuration;
  clip.metadata.updatedAt = new Date();
}

/**
 * Add frame to clip
 */
export function addPoseAsKeyframe(
  clip: AnimationClip,
  boneId: string,
  boneName: string,
  time: number,
  position: Vec3,
  rotation: Quat,
  scale: Vec3
): void {
  let boneTrack = clip.boneTracks.get(boneId);
  if (!boneTrack) {
    boneTrack = addBoneTrack(clip, boneId, boneName);
  }

  // Add keyframes for each property
  addKeyframe(boneTrack.positionX, createKeyframe(time, position.x));
  addKeyframe(boneTrack.positionY, createKeyframe(time, position.y));
  addKeyframe(boneTrack.positionZ, createKeyframe(time, position.z));

  addKeyframe(boneTrack.rotationX, createKeyframe(time, rotation.x));
  addKeyframe(boneTrack.rotationY, createKeyframe(time, rotation.y));
  addKeyframe(boneTrack.rotationZ, createKeyframe(time, rotation.z));
  addKeyframe(boneTrack.rotationW, createKeyframe(time, rotation.w));

  addKeyframe(boneTrack.scaleX, createKeyframe(time, scale.x));
  addKeyframe(boneTrack.scaleY, createKeyframe(time, scale.y));
  addKeyframe(boneTrack.scaleZ, createKeyframe(time, scale.z));

  // Update duration if needed
  if (time > clip.endTime) {
    clip.endTime = time;
    clip.duration = time;
  }

  clip.metadata.updatedAt = new Date();
}

/**
 * Reverse clip
 */
export function reverseClip(clip: AnimationClip): void {
  for (const boneTrack of clip.boneTracks.values()) {
    const tracks = [
      boneTrack.positionX, boneTrack.positionY, boneTrack.positionZ,
      boneTrack.rotationX, boneTrack.rotationY, boneTrack.rotationZ, boneTrack.rotationW,
      boneTrack.scaleX, boneTrack.scaleY, boneTrack.scaleZ,
    ];

    for (const track of tracks) {
      for (const kf of track.keyframes) {
        kf.time = clip.duration - kf.time;
      }
      track.keyframes.sort((a, b) => a.time - b.time);
    }
  }

  // Reverse events
  for (const event of clip.events) {
    event.time = clip.duration - event.time;
  }
  clip.events.sort((a, b) => a.time - b.time);

  clip.metadata.updatedAt = new Date();
}

/**
 * Loop clip multiple times
 */
export function loopClip(clip: AnimationClip, count: number): void {
  if (count <= 1) return;

  const originalDuration = clip.duration;

  for (const boneTrack of clip.boneTracks.values()) {
    const tracks = [
      boneTrack.positionX, boneTrack.positionY, boneTrack.positionZ,
      boneTrack.rotationX, boneTrack.rotationY, boneTrack.rotationZ, boneTrack.rotationW,
      boneTrack.scaleX, boneTrack.scaleY, boneTrack.scaleZ,
    ];

    for (const track of tracks) {
      const originalKeyframes = [...track.keyframes];

      for (let i = 1; i < count; i++) {
        for (const kf of originalKeyframes) {
          const newKf = { ...kf, id: generateId(), time: kf.time + originalDuration * i };
          track.keyframes.push(newKf);
        }
      }
    }
  }

  // Loop events
  const originalEvents = [...clip.events];
  for (let i = 1; i < count; i++) {
    for (const event of originalEvents) {
      clip.events.push({
        ...event,
        id: generateId(),
        time: event.time + originalDuration * i,
      });
    }
  }

  clip.duration = originalDuration * count;
  clip.endTime = clip.duration;
  clip.metadata.updatedAt = new Date();
}

// ============================================
// SERIALIZATION
// ============================================

export interface SerializedAnimationClip {
  id: string;
  name: string;
  skeletonId: string;
  duration: number;
  frameRate: number;
  startTime: number;
  endTime: number;
  boneTracks: Array<[string, SerializedBoneTrack]>;
  loopMode: LoopMode;
  loopOffset: number;
  events: AnimationEvent[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    tags: string[];
    author?: string;
  };
}

interface SerializedBoneTrack {
  boneId: string;
  boneName: string;
  positionX: SerializedAnimationTrack;
  positionY: SerializedAnimationTrack;
  positionZ: SerializedAnimationTrack;
  rotationX: SerializedAnimationTrack;
  rotationY: SerializedAnimationTrack;
  rotationZ: SerializedAnimationTrack;
  rotationW: SerializedAnimationTrack;
  scaleX: SerializedAnimationTrack;
  scaleY: SerializedAnimationTrack;
  scaleZ: SerializedAnimationTrack;
}

interface SerializedAnimationTrack {
  id: string;
  name: string;
  propertyPath: string;
  keyframes: Array<{
    id: string;
    time: number;
    value: number;
    interpolation: string;
  }>;
  enabled: boolean;
  locked: boolean;
  muted: boolean;
  color: string;
}

export function serializeClip(clip: AnimationClip): SerializedAnimationClip {
  const boneTracks: Array<[string, SerializedBoneTrack]> = [];

  for (const [boneId, track] of clip.boneTracks) {
    boneTracks.push([boneId, {
      boneId: track.boneId,
      boneName: track.boneName,
      positionX: serializeTrack(track.positionX),
      positionY: serializeTrack(track.positionY),
      positionZ: serializeTrack(track.positionZ),
      rotationX: serializeTrack(track.rotationX),
      rotationY: serializeTrack(track.rotationY),
      rotationZ: serializeTrack(track.rotationZ),
      rotationW: serializeTrack(track.rotationW),
      scaleX: serializeTrack(track.scaleX),
      scaleY: serializeTrack(track.scaleY),
      scaleZ: serializeTrack(track.scaleZ),
    }]);
  }

  return {
    id: clip.id,
    name: clip.name,
    skeletonId: clip.skeletonId,
    duration: clip.duration,
    frameRate: clip.frameRate,
    startTime: clip.startTime,
    endTime: clip.endTime,
    boneTracks,
    loopMode: clip.loopMode,
    loopOffset: clip.loopOffset,
    events: clip.events,
    metadata: {
      ...clip.metadata,
      createdAt: clip.metadata.createdAt.toISOString(),
      updatedAt: clip.metadata.updatedAt.toISOString(),
    },
  };
}

function serializeTrack(track: AnimationTrack): SerializedAnimationTrack {
  return {
    id: track.id,
    name: track.name,
    propertyPath: track.propertyPath,
    keyframes: track.keyframes.map(kf => ({
      id: kf.id,
      time: kf.time,
      value: typeof kf.value === 'number' ? kf.value : 0,
      interpolation: kf.interpolation,
    })),
    enabled: track.enabled,
    locked: track.locked,
    muted: track.muted,
    color: track.color,
  };
}

export function deserializeClip(data: SerializedAnimationClip): AnimationClip {
  const boneTracks = new Map<string, BoneTrack>();

  for (const [boneId, track] of data.boneTracks) {
    boneTracks.set(boneId, {
      boneId: track.boneId,
      boneName: track.boneName,
      positionX: deserializeTrack(track.positionX),
      positionY: deserializeTrack(track.positionY),
      positionZ: deserializeTrack(track.positionZ),
      rotationX: deserializeTrack(track.rotationX),
      rotationY: deserializeTrack(track.rotationY),
      rotationZ: deserializeTrack(track.rotationZ),
      rotationW: deserializeTrack(track.rotationW),
      scaleX: deserializeTrack(track.scaleX),
      scaleY: deserializeTrack(track.scaleY),
      scaleZ: deserializeTrack(track.scaleZ),
    });
  }

  return {
    id: data.id,
    name: data.name,
    skeletonId: data.skeletonId,
    duration: data.duration,
    frameRate: data.frameRate,
    startTime: data.startTime,
    endTime: data.endTime,
    boneTracks,
    loopMode: data.loopMode,
    loopOffset: data.loopOffset,
    events: data.events,
    metadata: {
      createdAt: new Date(data.metadata.createdAt),
      updatedAt: new Date(data.metadata.updatedAt),
      tags: data.metadata.tags,
      author: data.metadata.author,
    },
  };
}

function deserializeTrack(data: SerializedAnimationTrack): AnimationTrack {
  return {
    id: data.id,
    name: data.name,
    propertyPath: data.propertyPath,
    keyframes: data.keyframes.map(kf => ({
      id: kf.id,
      time: kf.time,
      value: kf.value,
      interpolation: kf.interpolation as 'linear' | 'step' | 'bezier' | 'hermite',
      selected: false,
    })),
    enabled: data.enabled,
    locked: data.locked,
    muted: data.muted,
    color: data.color,
  };
}
