# Physics System - Rey30_NEXUS

## Overview

The Physics System provides realistic physics simulation for the game engine, including rigid body dynamics, collision detection, raycasting, and physics-based interactions.

## Architecture

```
/src/lib/engine/physics/
├── types.ts              # Type definitions
├── PhysicsSystem.ts      # Main physics engine
├── RigidBody.ts          # Rigid body dynamics
├── Collider.ts           # Collision shapes
├── PhysicsMaterial.ts    # Surface properties
├── RaycastSystem.ts      # Raycasting utilities
├── CollisionSystem.ts    # Collision detection
├── PhysicsDebug.ts       # Debug visualization
└── index.ts              # Exports
```

## Core Components

### 1. PhysicsSystem

Central manager for all physics operations.

```typescript
interface PhysicsSystemConfig {
  gravity: Vector3Tuple;           // World gravity (default: [0, -9.81, 0])
  fixedTimeStep: number;           // Physics step (default: 1/60)
  maxSubSteps: number;             // Max steps per frame (default: 3)
  broadphase: 'naive' | 'sap';     // Broadphase algorithm
  allowSleep: boolean;             // Allow bodies to sleep
  solverIterations: number;        // Constraint solver iterations
  defaultContactMaterial: PhysicsMaterialConfig;
}
```

**Features:**
- Fixed timestep physics simulation
- Gravity configuration per scene
- Sleep optimization for static bodies
- Collision layers and masks
- Physics world serialization

### 2. RigidBody

Represents a physics-enabled object in the world.

```typescript
interface RigidBodyConfig {
  type: 'static' | 'dynamic' | 'kinematic';
  mass: number;
  velocity: Vector3Tuple;
  angularVelocity: Vector3Tuple;
  linearDamping: number;
  angularDamping: number;
  fixedRotation: boolean;
  useGravity: boolean;
  collisionGroup: number;
  collisionMask: number;
}
```

**Body Types:**
- **Static**: Never moves, infinite mass (walls, floors)
- **Dynamic**: Affected by forces and collisions (props, characters)
- **Kinematic**: Moved by code, affects dynamics (platforms, elevators)

### 3. Collider

Defines the collision shape of a body.

```typescript
interface ColliderConfig {
  type: 'box' | 'sphere' | 'capsule' | 'cylinder' | 'convex' | 'trimesh';
  isTrigger: boolean;
  center: Vector3Tuple;
  // Shape-specific
  size?: Vector3Tuple;       // Box
  radius?: number;           // Sphere, Capsule, Cylinder
  height?: number;           // Capsule, Cylinder
  vertices?: Vector3Tuple[]; // Convex
  mesh?: string;             // Trimesh reference
}
```

**Collider Types:**
| Type | Use Case | Performance |
|------|----------|-------------|
| Box | Simple objects | Excellent |
| Sphere | Balls, projectiles | Excellent |
| Capsule | Characters | Good |
| Cylinder | Cans, pillars | Good |
| Convex | Complex props | Moderate |
| Trimesh | Terrain, levels | Slow |

### 4. PhysicsMaterial

Surface properties for collision response.

```typescript
interface PhysicsMaterialConfig {
  friction: number;        // 0 = ice, 1 = rubber
  restitution: number;     // 0 = no bounce, 1 = super bouncy
  frictionCombine: 'average' | 'minimum' | 'maximum' | 'multiply';
  restitutionCombine: 'average' | 'minimum' | 'maximum' | 'multiply';
}
```

### 5. RaycastSystem

Ray and sweep queries for line-of-sight, picking, etc.

```typescript
interface RaycastHit {
  entity: Entity;
  point: Vector3Tuple;
  normal: Vector3Tuple;
  distance: number;
  collider: Collider;
}

interface RaycastConfig {
  origin: Vector3Tuple;
  direction: Vector3Tuple;
  maxDistance: number;
  layerMask: number;
  hitTriggers: boolean;
}
```

**Methods:**
- `raycast(config): RaycastHit | null`
- `raycastAll(config): RaycastHit[]`
- `sphereCast(origin, radius, direction, distance): RaycastHit | null`
- `boxCast(origin, halfExtents, direction, distance): RaycastHit | null`

### 6. CollisionSystem

Collision detection and events.

```typescript
interface CollisionEvent {
  type: 'enter' | 'stay' | 'exit';
  bodyA: RigidBody;
  bodyB: RigidBody;
  contactPoint: Vector3Tuple;
  contactNormal: Vector3Tuple;
  impactVelocity: number;
}
```

**Collision Layers:**
```typescript
const CollisionGroups = {
  DEFAULT:     1 << 0,  // 1
  PLAYER:      1 << 1,  // 2
  ENEMY:       1 << 2,  // 4
  ENVIRONMENT: 1 << 3,  // 8
  PROJECTILE:  1 << 4,  // 16
  TRIGGER:     1 << 5,  // 32
  RAGDOLL:     1 << 6,  // 64
  DEBRIS:      1 << 7,  // 128
} as const;
```

## Integration with ECS

### Physics Components

```typescript
// In ECS system
interface PhysicsComponents {
  RigidBody: {
    body: RigidBody;
    config: RigidBodyConfig;
  };
  
  Collider: {
    collider: Collider;
    config: ColliderConfig;
  };
  
  PhysicsMaterial: {
    material: PhysicsMaterial;
  };
}
```

### Physics System Update

```typescript
// In game loop
physicsSystem.update(fixedDeltaTime);

// Fixed update for physics
ecs.getSystem('PhysicsSystem').update(dt);
```

## Usage Examples

### Basic Physics Body

```typescript
// Create a bouncing ball
const ball = ecs.createEntity();
ecs.addComponent(ball, 'Transform', { position: [0, 10, 0] });
ecs.addComponent(ball, 'RigidBody', {
  type: 'dynamic',
  mass: 1,
  restitution: 0.8
});
ecs.addComponent(ball, 'Collider', {
  type: 'sphere',
  radius: 0.5
});
```

### Character Controller

```typescript
// Character with capsule collider
const player = ecs.createEntity();
ecs.addComponent(player, 'Transform', { position: [0, 1, 0] });
ecs.addComponent(player, 'RigidBody', {
  type: 'dynamic',
  mass: 70,
  fixedRotation: true,
  linearDamping: 0.9
});
ecs.addComponent(player, 'Collider', {
  type: 'capsule',
  radius: 0.3,
  height: 1.8
});
```

### Raycast for Shooting

```typescript
const hit = physicsSystem.raycast({
  origin: gunPosition,
  direction: aimDirection,
  maxDistance: 100,
  layerMask: CollisionGroups.ENEMY | CollisionGroups.ENVIRONMENT
});

if (hit) {
  spawnHitEffect(hit.point, hit.normal);
  if (hit.entity.hasComponent('Health')) {
    hit.entity.getComponent('Health').damage(10);
  }
}
```

### Trigger Zone

```typescript
// Pressure plate trigger
const trigger = ecs.createEntity();
ecs.addComponent(trigger, 'Transform', { position: [5, 0, 5] });
ecs.addComponent(trigger, 'Collider', {
  type: 'box',
  size: [2, 0.1, 2],
  isTrigger: true
});

// Listen for trigger events
eventSystem.on('collision:enter', (event: CollisionEvent) => {
  if (event.colliderA.isTrigger) {
    activateDoor();
  }
});
```

## Performance Considerations

### Optimization Strategies

1. **Sleep Management**
   - Bodies sleep when stationary
   - Configurable sleep thresholds
   - Wake on collision/force

2. **Collision Layering**
   - Reduce unnecessary collision checks
   - Group similar objects
   - Use masks for selective collision

3. **Broadphase Selection**
   - Naive: < 100 bodies
   - SAP (Sweep and Prune): > 100 bodies

4. **Collider Choice**
   - Prefer primitives over mesh colliders
   - Use compound shapes for complex objects
   - Trimesh only for static geometry

### Performance Targets

| Scenario | Bodies | FPS Target |
|----------|--------|------------|
| Simple scene | < 100 | 60 |
| Complex scene | 100-500 | 60 |
| Heavy physics | 500-1000 | 30 |

## Debug Visualization

```typescript
// Enable debug rendering
physicsSystem.debug.setEnabled(true);
physicsSystem.debug.setMode({
  showColliders: true,
  showAABBs: false,
  showContacts: true,
  showVelocity: true,
  showNormals: false
});
```

## Backend: Cannon-es

The physics system uses [cannon-es](https://pmndrs.github.io/cannon-es/) as the physics backend.

**Why Cannon-es:**
- Pure JavaScript, no native dependencies
- Good performance for web games
- Active maintenance (fork of cannon.js)
- React Three Fiber integration available
- TypeScript support

## Dependencies

```json
{
  "cannon-es": "^0.20.0",
  "@react-three/cannon": "^6.6.0"
}
```

## Next Steps

1. Implement character controller with physics
2. Add joint/constraint system
3. Implement vehicle physics
4. Add fluid simulation (optional)
5. Cloth physics (optional)
