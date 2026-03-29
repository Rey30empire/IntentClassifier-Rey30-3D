/**
 * NEXUS Engine - Pose System
 * 
 * Sistema de poses para animación de personajes
 */

import {
  Bone,
  BoneTransform,
  Pose,
  PoseMetadata,
  Skeleton,
  Vec3,
  Quat,
} from '../types';
import { generateId, vec3, quat } from '../../conversion/types';

// ============================================
// POSE CREATION
// ============================================

/**
 * Create an empty pose for a skeleton
 */
export function createPose(name: string, skeleton: Skeleton): Pose {
  const transforms = new Map<string, BoneTransform>();

  // Initialize transforms from bind pose
  for (const [boneId, bone] of skeleton.bones) {
    transforms.set(boneId, {
      boneId,
      position: { ...bone.localPosition },
      rotation: { ...bone.localRotation },
      scale: { ...bone.localScale },
    });
  }

  return {
    id: generateId(),
    name,
    skeletonId: skeleton.id,
    transforms,
    isBindPose: false,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    },
  };
}

/**
 * Create bind pose from skeleton
 */
export function createBindPose(skeleton: Skeleton): Pose {
  const pose = createPose('BindPose', skeleton);
  pose.isBindPose = true;
  return pose;
}

/**
 * Create a copy of a pose
 */
export function clonePose(pose: Pose, newName?: string): Pose {
  const transforms = new Map<string, BoneTransform>();

  for (const [boneId, transform] of pose.transforms) {
    transforms.set(boneId, {
      ...transform,
      position: { ...transform.position },
      rotation: { ...transform.rotation },
      scale: { ...transform.scale },
    });
  }

  return {
    id: generateId(),
    name: newName ?? `${pose.name}_Copy`,
    skeletonId: pose.skeletonId,
    transforms,
    isBindPose: pose.isBindPose,
    metadata: {
      ...pose.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

// ============================================
// POSE MANIPULATION
// ============================================

/**
 * Set bone transform in pose
 */
export function setBoneTransform(
  pose: Pose,
  boneId: string,
  transform: Partial<BoneTransform>
): void {
  const current = pose.transforms.get(boneId);
  if (!current) return;

  if (transform.position) {
    current.position = { ...transform.position };
  }
  if (transform.rotation) {
    current.rotation = { ...transform.rotation };
  }
  if (transform.scale) {
    current.scale = { ...transform.scale };
  }

  pose.metadata.updatedAt = new Date();
}

/**
 * Get bone transform from pose
 */
export function getBoneTransform(pose: Pose, boneId: string): BoneTransform | undefined {
  return pose.transforms.get(boneId);
}

/**
 * Reset bone to bind pose
 */
export function resetBoneToBindPose(pose: Pose, bone: Bone): void {
  pose.transforms.set(bone.id, {
    boneId: bone.id,
    position: { ...bone.localPosition },
    rotation: { ...bone.localRotation },
    scale: { ...bone.localScale },
  });
  pose.metadata.updatedAt = new Date();
}

/**
 * Reset all bones to bind pose
 */
export function resetToBindPose(pose: Pose, skeleton: Skeleton): void {
  for (const [boneId, bone] of skeleton.bones) {
    resetBoneToBindPose(pose, bone);
  }
}

// ============================================
// POSE BLENDING
// ============================================

/**
 * Blend two poses together
 */
export function blendPoses(
  poseA: Pose,
  poseB: Pose,
  weight: number
): Pose {
  const result = clonePose(poseA, 'Blended');

  for (const [boneId, transformA] of poseA.transforms) {
    const transformB = poseB.transforms.get(boneId);
    if (!transformB) continue;

    result.transforms.set(boneId, {
      boneId,
      position: lerpVec3(transformA.position, transformB.position, weight),
      rotation: slerpQuaternion(transformA.rotation, transformB.rotation, weight),
      scale: lerpVec3(transformA.scale, transformB.scale, weight),
    });
  }

  return result;
}

/**
 * Additive blend two poses
 */
export function additiveBlend(
  basePose: Pose,
  additivePose: Pose,
  weight: number
): Pose {
  const result = clonePose(basePose, 'Additive');

  for (const [boneId, baseTransform] of basePose.transforms) {
    const additiveTransform = additivePose.transforms.get(boneId);
    if (!additiveTransform) continue;

    result.transforms.set(boneId, {
      boneId,
      position: {
        x: baseTransform.position.x + additiveTransform.position.x * weight,
        y: baseTransform.position.y + additiveTransform.position.y * weight,
        z: baseTransform.position.z + additiveTransform.position.z * weight,
      },
      rotation: multiplyQuaternion(
        baseTransform.rotation,
        scaleQuaternion(additiveTransform.rotation, weight)
      ),
      scale: {
        x: baseTransform.scale.x * (1 + (additiveTransform.scale.x - 1) * weight),
        y: baseTransform.scale.y * (1 + (additiveTransform.scale.y - 1) * weight),
        z: baseTransform.scale.z * (1 + (additiveTransform.scale.z - 1) * weight),
      },
    });
  }

  return result;
}

// ============================================
// POSE MIRRORING
// ============================================

/**
 * Mirror pose (swap left/right)
 */
export function mirrorPose(pose: Pose, skeleton: Skeleton): Pose {
  const result = clonePose(pose, `${pose.name}_Mirrored`);

  // Build mirror mapping
  const mirrorMap = buildMirrorMap(skeleton);

  for (const [boneId, transform] of pose.transforms) {
    const mirrorBoneId = mirrorMap.get(boneId);
    if (mirrorBoneId) {
      // Swap transforms with mirrored bone
      const mirrorTransform = pose.transforms.get(mirrorBoneId);
      if (mirrorTransform) {
        result.transforms.set(boneId, {
          boneId,
          position: mirrorX(mirrorTransform.position),
          rotation: mirrorQuaternionX(mirrorTransform.rotation),
          scale: { ...mirrorTransform.scale },
        });
      }
    }
  }

  return result;
}

function buildMirrorMap(skeleton: Skeleton): Map<string, string> {
  const mirrorMap = new Map<string, string>();

  for (const bone of skeleton.bones.values()) {
    // Common naming conventions
    const leftMatch = bone.name.match(/^(.*)(Left|L|left|l)(.*)$/);
    const rightMatch = bone.name.match(/^(.*)(Right|R|right|r)(.*)$/);

    if (leftMatch) {
      const rightName = `${leftMatch[1]}Right${leftMatch[3]}`;
      const rightBone = Array.from(skeleton.bones.values()).find(b => b.name === rightName);
      if (rightBone) {
        mirrorMap.set(bone.id, rightBone.id);
      }
    } else if (rightMatch) {
      const leftName = `${rightMatch[1]}Left${rightMatch[3]}`;
      const leftBone = Array.from(skeleton.bones.values()).find(b => b.name === leftName);
      if (leftBone) {
        mirrorMap.set(bone.id, leftBone.id);
      }
    }
  }

  return mirrorMap;
}

// ============================================
// MATH HELPERS
// ============================================

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function slerpQuaternion(a: Quat, b: Quat, t: number): Quat {
  // Normalize inputs
  const magA = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z + a.w * a.w);
  const magB = Math.sqrt(b.x * b.x + b.y * b.y + b.z * b.z + b.w * b.w);
  
  let ax = a.x / magA, ay = a.y / magA, az = a.z / magA, aw = a.w / magA;
  let bx = b.x / magB, by = b.y / magB, bz = b.z / magB, bw = b.w / magB;

  // Calculate dot product
  let dot = ax * bx + ay * by + az * bz + aw * bw;

  // If dot is negative, negate one quaternion
  if (dot < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    dot = -dot;
  }

  // If quaternions are close, use linear interpolation
  if (dot > 0.9995) {
    return normalizeQuaternion({
      x: ax + (bx - ax) * t,
      y: ay + (by - ay) * t,
      z: az + (bz - az) * t,
      w: aw + (bw - aw) * t,
    });
  }

  // Calculate spherical interpolation
  const theta0 = Math.acos(dot);
  const theta = theta0 * t;

  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);

  const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
  const s1 = sinTheta / sinTheta0;

  return normalizeQuaternion({
    x: ax * s0 + bx * s1,
    y: ay * s0 + by * s1,
    z: az * s0 + bz * s1,
    w: aw * s0 + bw * s1,
  });
}

function normalizeQuaternion(q: Quat): Quat {
  const mag = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  return {
    x: q.x / mag,
    y: q.y / mag,
    z: q.z / mag,
    w: q.w / mag,
  };
}

function multiplyQuaternion(a: Quat, b: Quat): Quat {
  return normalizeQuaternion({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  });
}

function scaleQuaternion(q: Quat, scale: number): Quat {
  // Scale rotation angle
  const angle = Math.acos(q.w) * 2;
  const newAngle = angle * scale;
  const sin = Math.sin(newAngle / 2);
  const cos = Math.cos(newAngle / 2);
  
  const mag = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z);
  if (mag < 0.0001) return { x: 0, y: 0, z: 0, w: 1 };

  return {
    x: (q.x / mag) * sin,
    y: (q.y / mag) * sin,
    z: (q.z / mag) * sin,
    w: cos,
  };
}

function mirrorX(v: Vec3): Vec3 {
  return { x: -v.x, y: v.y, z: v.z };
}

function mirrorQuaternionX(q: Quat): Quat {
  return { x: q.x, y: -q.y, z: -q.z, w: q.w };
}

// ============================================
// POSE SERIALIZATION
// ============================================

export interface SerializedPose {
  id: string;
  name: string;
  skeletonId: string;
  transforms: Array<[string, BoneTransform]>;
  isBindPose: boolean;
  metadata: {
    createdAt: string;
    updatedAt: string;
    tags: string[];
  };
}

export function serializePose(pose: Pose): SerializedPose {
  return {
    id: pose.id,
    name: pose.name,
    skeletonId: pose.skeletonId,
    transforms: Array.from(pose.transforms.entries()),
    isBindPose: pose.isBindPose,
    metadata: {
      ...pose.metadata,
      createdAt: pose.metadata.createdAt.toISOString(),
      updatedAt: pose.metadata.updatedAt.toISOString(),
    },
  };
}

export function deserializePose(data: SerializedPose): Pose {
  return {
    id: data.id,
    name: data.name,
    skeletonId: data.skeletonId,
    transforms: new Map(data.transforms),
    isBindPose: data.isBindPose,
    metadata: {
      createdAt: new Date(data.metadata.createdAt),
      updatedAt: new Date(data.metadata.updatedAt),
      tags: data.metadata.tags,
    },
  };
}
