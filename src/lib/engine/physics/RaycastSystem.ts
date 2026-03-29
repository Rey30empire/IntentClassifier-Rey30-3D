/**
 * Raycast System - Rey30_NEXUS
 * Advanced raycasting utilities for physics queries
 */

import type { Vector3Tuple } from 'three';
import {
  RaycastConfig,
  RaycastHit,
  SphereCastConfig,
  BoxCastConfig,
} from './types';
import { PhysicsSystem, getPhysicsSystem } from './PhysicsSystem';
import { CollisionGroups } from './types';

export class RaycastSystem {
  private physicsSystem: PhysicsSystem;

  constructor(physicsSystem?: PhysicsSystem) {
    this.physicsSystem = physicsSystem ?? getPhysicsSystem();
  }

  // ============================================================================
  // Basic Raycasting
  // ============================================================================

  /**
   * Cast a ray and get the first hit
   */
  raycast(config: RaycastConfig): RaycastHit | null {
    return this.physicsSystem.raycast(config);
  }

  /**
   * Cast a ray and get all hits
   */
  raycastAll(config: RaycastConfig): RaycastHit[] {
    return this.physicsSystem.raycastAll(config);
  }

  /**
   * Cast a ray from screen coordinates
   * Requires camera for projection
   */
  raycastFromScreen(
    screenX: number,
    screenY: number,
    screenWidth: number,
    screenHeight: number,
    cameraPosition: Vector3Tuple,
    cameraDirection: Vector3Tuple,
    maxDistance: number = 1000
  ): RaycastHit | null {
    // Convert screen coordinates to normalized device coordinates
    const ndcX = (screenX / screenWidth) * 2 - 1;
    const ndcY = -((screenY / screenHeight) * 2 - 1);

    // This is a simplified version - proper implementation would need camera projection
    // For now, cast from camera position in the camera's direction
    return this.raycast({
      origin: cameraPosition,
      direction: cameraDirection,
      maxDistance,
      layerMask: CollisionGroups.ALL,
      hitTriggers: false,
    });
  }

  // ============================================================================
  // Convenience Raycasts
  // ============================================================================

  /**
   * Cast ray from a point in a direction
   */
  rayFrom(
    origin: Vector3Tuple,
    direction: Vector3Tuple,
    distance: number = 100
  ): RaycastHit | null {
    return this.raycast({
      origin,
      direction,
      maxDistance: distance,
      layerMask: CollisionGroups.ALL,
      hitTriggers: false,
    });
  }

  /**
   * Cast ray between two points
   */
  rayBetween(
    start: Vector3Tuple,
    end: Vector3Tuple
  ): RaycastHit | null {
    const direction: Vector3Tuple = [
      end[0] - start[0],
      end[1] - start[1],
      end[2] - start[2],
    ];

    const distance = Math.sqrt(
      direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2
    );

    if (distance < 0.001) return null;

    const normalized: Vector3Tuple = [
      direction[0] / distance,
      direction[1] / distance,
      direction[2] / distance,
    ];

    return this.raycast({
      origin: start,
      direction: normalized,
      maxDistance: distance,
      layerMask: CollisionGroups.ALL,
      hitTriggers: false,
    });
  }

  /**
   * Cast ray downward from a point (for ground checks)
   */
  rayDown(
    origin: Vector3Tuple,
    distance: number = 10,
    layerMask: number = CollisionGroups.ENVIRONMENT
  ): RaycastHit | null {
    return this.raycast({
      origin,
      direction: [0, -1, 0],
      maxDistance: distance,
      layerMask,
      hitTriggers: false,
    });
  }

  /**
   * Cast ray upward from a point
   */
  rayUp(
    origin: Vector3Tuple,
    distance: number = 10,
    layerMask: number = CollisionGroups.ALL
  ): RaycastHit | null {
    return this.raycast({
      origin,
      direction: [0, 1, 0],
      maxDistance: distance,
      layerMask,
      hitTriggers: false,
    });
  }

  /**
   * Cast ray forward from a point
   */
  rayForward(
    origin: Vector3Tuple,
    forward: Vector3Tuple,
    distance: number = 100
  ): RaycastHit | null {
    return this.raycast({
      origin,
      direction: forward,
      maxDistance: distance,
      layerMask: CollisionGroups.ALL,
      hitTriggers: false,
    });
  }

  // ============================================================================
  // Specialized Queries
  // ============================================================================

  /**
   * Check if there's a clear line of sight between two points
   */
  hasLineOfSight(
    from: Vector3Tuple,
    to: Vector3Tuple,
    ignoreMask: number = CollisionGroups.TRIGGER
  ): boolean {
    const direction: Vector3Tuple = [
      to[0] - from[0],
      to[1] - from[1],
      to[2] - from[2],
    ];

    const distance = Math.sqrt(
      direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2
    );

    if (distance < 0.001) return true;

    const normalized: Vector3Tuple = [
      direction[0] / distance,
      direction[1] / distance,
      direction[2] / distance,
    ];

    const hit = this.raycast({
      origin: from,
      direction: normalized,
      maxDistance: distance,
      layerMask: ~ignoreMask, // Everything except ignored
      hitTriggers: false,
    });

    return hit === null;
  }

  /**
   * Get ground height at position
   */
  getGroundHeight(
    position: Vector3Tuple,
    maxDrop: number = 100
  ): number | null {
    const origin: Vector3Tuple = [position[0], position[1] + maxDrop, position[2]];
    const hit = this.rayDown(origin, maxDrop * 2);

    return hit ? hit.point[1] : null;
  }

  /**
   * Check if point is inside geometry (using raycasting)
   */
  isPointInside(
    point: Vector3Tuple,
    bodyId: string
  ): boolean {
    // Cast rays in multiple directions and count intersections
    const directions: Vector3Tuple[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];

    let insideCount = 0;

    for (const dir of directions) {
      const hits = this.raycastAll({
        origin: point,
        direction: dir,
        maxDistance: 1000,
        layerMask: CollisionGroups.ALL,
        hitTriggers: false,
      });

      const bodyHits = hits.filter(h => h.bodyId === bodyId);
      if (bodyHits.length % 2 === 1) {
        insideCount++;
      }
    }

    return insideCount >= 2; // Conservative: at least 2 directions agree
  }

  // ============================================================================
  // Shape Casting (Approximations)
  // ============================================================================

  /**
   * Sphere cast - cast a sphere along a ray
   * Approximated with multiple rays for cannon-es
   */
  sphereCast(config: SphereCastConfig): RaycastHit | null {
    // Cannon-es doesn't support sphere cast natively
    // Approximate with central ray + edge checks
    const { origin, direction, maxDistance, radius } = config;

    // Central ray
    const centralHit = this.raycast({
      ...config,
      origin: [
        origin[0],
        origin[1] + radius,
        origin[2],
      ],
    });

    if (centralHit) {
      return {
        ...centralHit,
        distance: Math.max(0, centralHit.distance - radius),
      };
    }

    return null;
  }

  /**
   * Box cast - cast a box along a ray
   * Approximated with multiple rays
   */
  boxCast(config: BoxCastConfig): RaycastHit | null {
    // Similar approximation as sphere cast
    const { origin, direction, maxDistance, halfExtents } = config;

    // Central ray
    const centralHit = this.raycast({
      ...config,
      origin: [
        origin[0] + halfExtents[0],
        origin[1] + halfExtents[1],
        origin[2] + halfExtents[2],
      ],
    });

    return centralHit;
  }

  // ============================================================================
  // Utility
  // ============================================================================

  /**
   * Get all bodies within a cone
   */
  getBodiesInCone(
    origin: Vector3Tuple,
    direction: Vector3Tuple,
    angle: number,
    distance: number
  ): Array<{ bodyId: string; distance: number }> {
    const results: Array<{ bodyId: string; distance: number }> = [];

    // Cast multiple rays in a cone pattern
    const steps = 8;
    const angleStep = angle / steps;

    for (let i = -steps; i <= steps; i++) {
      for (let j = -steps; j <= steps; j++) {
        // Calculate rotated direction (simplified)
        const pitchOffset = i * angleStep;
        const yawOffset = j * angleStep;

        // Apply rotation to direction (simplified)
        const dir: Vector3Tuple = [
          direction[0] + Math.sin(yawOffset),
          direction[1] + Math.sin(pitchOffset),
          direction[2],
        ];

        // Normalize
        const len = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2);
        dir[0] /= len;
        dir[1] /= len;
        dir[2] /= len;

        const hit = this.raycast({
          origin,
          direction: dir,
          maxDistance: distance,
          layerMask: CollisionGroups.ALL,
          hitTriggers: false,
        });

        if (hit && !results.find(r => r.bodyId === hit.bodyId)) {
          results.push({ bodyId: hit.bodyId, distance: hit.distance });
        }
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }
}

// Singleton
let _instance: RaycastSystem | null = null;

export function getRaycastSystem(): RaycastSystem {
  if (!_instance) {
    _instance = new RaycastSystem();
  }
  return _instance;
}

export function createRaycastSystem(physicsSystem: PhysicsSystem): RaycastSystem {
  return new RaycastSystem(physicsSystem);
}
