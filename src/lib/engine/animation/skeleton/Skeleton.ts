/**
 * NEXUS Engine - Skeleton System
 * 
 * Sistema de esqueletos para animación de personajes
 */

import {
  Bone,
  Skeleton,
  SkeletonMetadata,
  Vec3,
  Quat,
} from '../types';
import { generateId, vec3, quat } from '../../conversion/types';

// ============================================
// BONE FACTORY
// ============================================

export interface CreateBoneOptions {
  name: string;
  parentId?: string | null;
  position?: Vec3;
  rotation?: Quat;
  scale?: Vec3;
  length?: number;
}

export function createBone(options: CreateBoneOptions, index: number): Bone {
  const id = generateId();
  
  return {
    id,
    name: options.name,
    index,
    parentId: options.parentId ?? null,
    childrenIds: [],
    localPosition: options.position ?? vec3(0, 0, 0),
    localRotation: options.rotation ?? quat(0, 0, 0, 1),
    localScale: options.scale ?? vec3(1, 1, 1),
    bindPosition: vec3(0, 0, 0),
    bindRotation: quat(0, 0, 0, 1),
    bindScale: vec3(1, 1, 1),
    inverseBindMatrix: [],
    length: options.length,
  };
}

// ============================================
// SKELETON CLASS
// ============================================

export class SkeletonBuilder {
  private skeleton: Skeleton;

  constructor(name: string) {
    this.skeleton = {
      id: generateId(),
      name,
      bones: new Map(),
      boneIndices: new Map(),
      rootBoneIds: [],
      metadata: {
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        boneCount: 0,
      },
    };
  }

  /**
   * Add a bone to the skeleton
   */
  addBone(options: CreateBoneOptions): Bone {
    const index = this.skeleton.bones.size;
    const bone = createBone(options, index);

    this.skeleton.bones.set(bone.id, bone);
    this.skeleton.boneIndices.set(bone.id, index);

    // Set up hierarchy
    if (bone.parentId) {
      const parent = this.skeleton.bones.get(bone.parentId);
      if (parent) {
        parent.childrenIds.push(bone.id);
      }
    } else {
      this.skeleton.rootBoneIds.push(bone.id);
    }

    this.skeleton.metadata.boneCount++;
    this.skeleton.metadata.updatedAt = new Date();

    return bone;
  }

  /**
   * Remove a bone and all its children
   */
  removeBone(boneId: string): boolean {
    const bone = this.skeleton.bones.get(boneId);
    if (!bone) return false;

    // Remove from parent
    if (bone.parentId) {
      const parent = this.skeleton.bones.get(bone.parentId);
      if (parent) {
        parent.childrenIds = parent.childrenIds.filter(id => id !== boneId);
      }
    } else {
      this.skeleton.rootBoneIds = this.skeleton.rootBoneIds.filter(id => id !== boneId);
    }

    // Remove children recursively
    for (const childId of [...bone.childrenIds]) {
      this.removeBone(childId);
    }

    // Remove bone
    this.skeleton.bones.delete(boneId);
    this.skeleton.boneIndices.delete(boneId);
    this.skeleton.metadata.boneCount--;
    this.skeleton.metadata.updatedAt = new Date();

    return true;
  }

  /**
   * Get bone by ID
   */
  getBone(boneId: string): Bone | undefined {
    return this.skeleton.bones.get(boneId);
  }

  /**
   * Get bone by name
   */
  getBoneByName(name: string): Bone | undefined {
    for (const bone of this.skeleton.bones.values()) {
      if (bone.name === name) return bone;
    }
    return undefined;
  }

  /**
   * Get all bones
   */
  getAllBones(): Bone[] {
    return Array.from(this.skeleton.bones.values());
  }

  /**
   * Get bone children
   */
  getBoneChildren(boneId: string): Bone[] {
    const bone = this.skeleton.bones.get(boneId);
    if (!bone) return [];

    return bone.childrenIds
      .map(id => this.skeleton.bones.get(id))
      .filter((b): b is Bone => b !== undefined);
  }

  /**
   * Get bone ancestors
   */
  getBoneAncestors(boneId: string): Bone[] {
    const ancestors: Bone[] = [];
    let currentBone = this.skeleton.bones.get(boneId);

    while (currentBone?.parentId) {
      const parent = this.skeleton.bones.get(currentBone.parentId);
      if (parent) {
        ancestors.push(parent);
        currentBone = parent;
      } else {
        break;
      }
    }

    return ancestors;
  }

  /**
   * Get bone descendants
   */
  getBoneDescendants(boneId: string): Bone[] {
    const descendants: Bone[] = [];
    const queue: string[] = [boneId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const bone = this.skeleton.bones.get(currentId);
      
      if (bone) {
        for (const childId of bone.childrenIds) {
          const child = this.skeleton.bones.get(childId);
          if (child) {
            descendants.push(child);
            queue.push(childId);
          }
        }
      }
    }

    return descendants;
  }

  /**
   * Calculate bind poses (world transforms)
   */
  calculateBindPoses(): void {
    // Calculate from root bones down
    for (const rootId of this.skeleton.rootBoneIds) {
      this.calculateBoneBindPose(rootId);
    }
  }

  private calculateBoneBindPose(boneId: string): void {
    const bone = this.skeleton.bones.get(boneId);
    if (!bone) return;

    if (bone.parentId) {
      const parent = this.skeleton.bones.get(bone.parentId);
      if (parent) {
        // Calculate world transform from parent
        bone.bindPosition = this.multiplyPoint(
          parent.bindPosition,
          parent.bindRotation,
          parent.bindScale,
          bone.localPosition
        );
        bone.bindRotation = this.multiplyQuaternion(
          parent.bindRotation,
          bone.localRotation
        );
        bone.bindScale = {
          x: parent.bindScale.x * bone.localScale.x,
          y: parent.bindScale.y * bone.localScale.y,
          z: parent.bindScale.z * bone.localScale.z,
        };
      }
    } else {
      // Root bone - use local transform
      bone.bindPosition = { ...bone.localPosition };
      bone.bindRotation = { ...bone.localRotation };
      bone.bindScale = { ...bone.localScale };
    }

    // Calculate inverse bind matrix
    bone.inverseBindMatrix = this.calculateInverseBindMatrix(bone);

    // Recursively calculate children
    for (const childId of bone.childrenIds) {
      this.calculateBoneBindPose(childId);
    }
  }

  private multiplyPoint(
    position: Vec3,
    rotation: Quat,
    scale: Vec3,
    localPos: Vec3
  ): Vec3 {
    // Simplified - in production use proper math library
    return {
      x: position.x + localPos.x * scale.x,
      y: position.y + localPos.y * scale.y,
      z: position.z + localPos.z * scale.z,
    };
  }

  private multiplyQuaternion(q1: Quat, q2: Quat): Quat {
    return {
      x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
      y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
      z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w,
      w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z,
    };
  }

  private calculateInverseBindMatrix(bone: Bone): number[] {
    // Simplified - return identity for now
    // In production, calculate actual inverse matrix
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      -bone.bindPosition.x, -bone.bindPosition.y, -bone.bindPosition.z, 1,
    ];
  }

  /**
   * Build and return the skeleton
   */
  build(): Skeleton {
    this.calculateBindPoses();
    return { ...this.skeleton };
  }
}

// ============================================
// PRESET SKELETONS
// ============================================

/**
 * Create a basic humanoid skeleton
 */
export function createHumanoidSkeleton(name = 'Humanoid'): Skeleton {
  const builder = new SkeletonBuilder(name);

  // Root
  const root = builder.addBone({ name: 'Root' });

  // Hips
  const hips = builder.addBone({
    name: 'Hips',
    parentId: root.id,
    position: vec3(0, 1, 0),
  });

  // Spine
  const spine = builder.addBone({
    name: 'Spine',
    parentId: hips.id,
    position: vec3(0, 0.1, 0),
  });

  const spine1 = builder.addBone({
    name: 'Spine1',
    parentId: spine.id,
    position: vec3(0, 0.15, 0),
  });

  const spine2 = builder.addBone({
    name: 'Spine2',
    parentId: spine1.id,
    position: vec3(0, 0.15, 0),
  });

  // Neck and Head
  const neck = builder.addBone({
    name: 'Neck',
    parentId: spine2.id,
    position: vec3(0, 0.15, 0),
  });

  const head = builder.addBone({
    name: 'Head',
    parentId: neck.id,
    position: vec3(0, 0.1, 0),
    length: 0.2,
  });

  // Left Arm
  const leftClavicle = builder.addBone({
    name: 'LeftShoulder',
    parentId: spine2.id,
    position: vec3(-0.1, 0.1, 0),
  });

  const leftUpperArm = builder.addBone({
    name: 'LeftUpperArm',
    parentId: leftClavicle.id,
    position: vec3(-0.1, 0, 0),
    length: 0.3,
  });

  const leftLowerArm = builder.addBone({
    name: 'LeftLowerArm',
    parentId: leftUpperArm.id,
    position: vec3(-0.3, 0, 0),
    length: 0.25,
  });

  const leftHand = builder.addBone({
    name: 'LeftHand',
    parentId: leftLowerArm.id,
    position: vec3(-0.25, 0, 0),
    length: 0.15,
  });

  // Right Arm
  const rightClavicle = builder.addBone({
    name: 'RightShoulder',
    parentId: spine2.id,
    position: vec3(0.1, 0.1, 0),
  });

  const rightUpperArm = builder.addBone({
    name: 'RightUpperArm',
    parentId: rightClavicle.id,
    position: vec3(0.1, 0, 0),
    length: 0.3,
  });

  const rightLowerArm = builder.addBone({
    name: 'RightLowerArm',
    parentId: rightUpperArm.id,
    position: vec3(0.3, 0, 0),
    length: 0.25,
  });

  const rightHand = builder.addBone({
    name: 'RightHand',
    parentId: rightLowerArm.id,
    position: vec3(0.25, 0, 0),
    length: 0.15,
  });

  // Left Leg
  const leftUpperLeg = builder.addBone({
    name: 'LeftUpperLeg',
    parentId: hips.id,
    position: vec3(-0.1, 0, 0),
    length: 0.45,
  });

  const leftLowerLeg = builder.addBone({
    name: 'LeftLowerLeg',
    parentId: leftUpperLeg.id,
    position: vec3(0, -0.45, 0),
    length: 0.45,
  });

  const leftFoot = builder.addBone({
    name: 'LeftFoot',
    parentId: leftLowerLeg.id,
    position: vec3(0, -0.45, 0),
    length: 0.15,
  });

  const leftToes = builder.addBone({
    name: 'LeftToes',
    parentId: leftFoot.id,
    position: vec3(0, 0, 0.1),
  });

  // Right Leg
  const rightUpperLeg = builder.addBone({
    name: 'RightUpperLeg',
    parentId: hips.id,
    position: vec3(0.1, 0, 0),
    length: 0.45,
  });

  const rightLowerLeg = builder.addBone({
    name: 'RightLowerLeg',
    parentId: rightUpperLeg.id,
    position: vec3(0, -0.45, 0),
    length: 0.45,
  });

  const rightFoot = builder.addBone({
    name: 'RightFoot',
    parentId: rightLowerLeg.id,
    position: vec3(0, -0.45, 0),
    length: 0.15,
  });

  const rightToes = builder.addBone({
    name: 'RightToes',
    parentId: rightFoot.id,
    position: vec3(0, 0, 0.1),
  });

  return builder.build();
}

// ============================================
// EXPORTS
// ============================================

export { SkeletonBuilder as Skeleton };
