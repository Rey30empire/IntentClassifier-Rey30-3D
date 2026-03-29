'use client';

import { Suspense } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import {
  Environment,
  GizmoHelper,
  GizmoViewport,
  Grid,
  OrbitControls,
  PerspectiveCamera,
} from '@react-three/drei';
import { SceneObject, useNexusStore } from '@/store/nexus-store';

function getObjectAccentColor(object: SceneObject) {
  if (object.type === 'mesh') {
    switch (object.dataBlockId) {
      case 'primitive-sphere':
        return '#ff42d0';
      case 'primitive-torus':
        return '#8c52ff';
      default:
        return '#00d4ff';
    }
  }

  switch (object.type) {
    case 'light':
      return '#ffd166';
    case 'camera':
      return '#7c83ff';
    case 'armature':
      return '#1dd3b0';
    case 'empty':
    default:
      return '#8c98a8';
  }
}

function getSelectionRingRadius(object: SceneObject) {
  if (object.type === 'mesh') {
    switch (object.dataBlockId) {
      case 'primitive-sphere':
        return 0.95;
      case 'primitive-torus':
        return 1.05;
      default:
        return 1;
    }
  }

  switch (object.type) {
    case 'light':
      return 0.45;
    case 'camera':
      return 0.7;
    case 'armature':
      return 0.5;
    case 'empty':
    default:
      return 0.55;
  }
}

function getSelectionRingY(object: SceneObject) {
  if (object.type === 'mesh') {
    switch (object.dataBlockId) {
      case 'primitive-sphere':
        return -0.8;
      case 'primitive-torus':
        return -0.7;
      default:
        return -0.78;
    }
  }

  switch (object.type) {
    case 'light':
      return -0.3;
    case 'camera':
      return -0.45;
    case 'armature':
      return -0.35;
    case 'empty':
    default:
      return -0.3;
  }
}

function SelectionRing({
  object,
  color,
}: {
  object: SceneObject;
  color: string;
}) {
  const radius = getSelectionRingRadius(object);

  return (
    <mesh
      position={[0, getSelectionRingY(object), 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={2}
    >
      <ringGeometry args={[radius, radius + 0.12, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.75} />
    </mesh>
  );
}

function ObjectVisual({
  object,
  color,
  selected,
  active,
}: {
  object: SceneObject;
  color: string;
  selected: boolean;
  active: boolean;
}) {
  const emissiveIntensity = active ? 0.45 : selected ? 0.25 : 0.1;
  const opacity = object.locked ? 0.82 : 1;

  switch (object.type) {
    case 'light':
      return (
        <>
          <pointLight
            color={color}
            intensity={active ? 2.4 : 1.8}
            distance={18}
            decay={2}
            castShadow
          />
          <mesh castShadow>
            <sphereGeometry args={[0.22, 24, 24]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={active ? 1.3 : 0.9}
              roughness={0.2}
              metalness={0.2}
              transparent
              opacity={opacity}
            />
          </mesh>
          <mesh scale={1.9}>
            <sphereGeometry args={[0.22, 18, 18]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.35} />
          </mesh>
        </>
      );
    case 'camera':
      return (
        <>
          <mesh castShadow receiveShadow rotation={[0, Math.PI / 4, 0]}>
            <boxGeometry args={[0.7, 0.35, 0.9]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={emissiveIntensity}
              roughness={0.35}
              metalness={0.8}
              transparent
              opacity={opacity}
            />
          </mesh>
          <mesh position={[0, 0, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.26, 0.42, 4]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={emissiveIntensity}
              roughness={0.3}
              metalness={0.7}
              transparent
              opacity={opacity}
            />
          </mesh>
        </>
      );
    case 'armature':
      return (
        <>
          <mesh position={[0, 0.45, 0]} castShadow>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={emissiveIntensity}
              transparent
              opacity={opacity}
            />
          </mesh>
          <mesh position={[0, 0.15, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.58, 12]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={emissiveIntensity}
              transparent
              opacity={opacity}
            />
          </mesh>
          <mesh position={[0, -0.2, 0]} castShadow>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={emissiveIntensity}
              transparent
              opacity={opacity}
            />
          </mesh>
        </>
      );
    case 'empty':
      return (
        <>
          <axesHelper args={[0.85]} />
          <mesh>
            <octahedronGeometry args={[0.28, 0]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.85} />
          </mesh>
        </>
      );
    case 'mesh':
    default:
      return (
        <mesh castShadow receiveShadow>
          {object.dataBlockId === 'primitive-sphere' ? (
            <sphereGeometry args={[0.7, 32, 32]} />
          ) : object.dataBlockId === 'primitive-torus' ? (
            <torusGeometry args={[0.7, 0.22, 24, 72]} />
          ) : (
            <boxGeometry args={[1.15, 1.15, 1.15]} />
          )}
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={emissiveIntensity}
            roughness={object.dataBlockId === 'primitive-sphere' ? 0.12 : 0.24}
            metalness={0.82}
            transparent
            opacity={opacity}
          />
        </mesh>
      );
  }
}

function SceneObjectNode({ object }: { object: SceneObject }) {
  const { currentScene, selectObject } = useNexusStore();

  if (!object.visible) {
    return null;
  }

  const selected = currentScene.selectedObjects.includes(object.id);
  const active = currentScene.activeObject === object.id;
  const accentColor = getObjectAccentColor(object);
  const selectionColor = object.locked ? '#ff9f43' : active ? '#00d4ff' : accentColor;

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    selectObject(object.id, Boolean(event.nativeEvent.shiftKey));
  };

  return (
    <group
      position={object.transform.position}
      rotation={object.transform.rotation}
      scale={object.transform.scale}
      onClick={handleSelect}
    >
      {selected && <SelectionRing object={object} color={selectionColor} />}
      <ObjectVisual
        object={object}
        color={accentColor}
        selected={selected}
        active={active}
      />
    </group>
  );
}

function SceneObjects() {
  const sceneObjects = useNexusStore((state) => state.currentScene.objects);

  return (
    <>
      {sceneObjects.map((object) => (
        <SceneObjectNode key={object.id} object={object} />
      ))}
    </>
  );
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[10, 12, 6]}
        intensity={1.05}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-10, -8, -10]} intensity={0.35} color="#ff42d0" />
      <pointLight position={[8, -6, 10]} intensity={0.3} color="#00d4ff" />
    </>
  );
}

function SceneGrid() {
  const { settings } = useNexusStore();

  if (!settings.showGrid) {
    return null;
  }

  return (
    <Grid
      position={[0, -0.01, 0]}
      args={[24, 24]}
      cellSize={settings.gridSize}
      cellThickness={0.5}
      cellColor="#00d4ff"
      sectionSize={settings.gridSize * 5}
      sectionThickness={1}
      sectionColor="#8800ff"
      fadeDistance={35}
      fadeStrength={1}
      followCamera={false}
    />
  );
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#00d4ff" wireframe />
    </mesh>
  );
}

export function Viewport3D() {
  const { currentScene, settings, clearSelection } = useNexusStore();

  const visibleObjects = currentScene.objects.filter((object) => object.visible);
  const activeObject = currentScene.objects.find(
    (object) => object.id === currentScene.activeObject
  );

  return (
    <div className="relative h-full w-full bg-background neural-grid">
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 2]}
        onPointerMissed={() => clearSelection()}
      >
        <Suspense fallback={<LoadingFallback />}>
          <PerspectiveCamera makeDefault position={[7, 6, 8]} fov={48} />

          <SceneLights />
          <SceneGrid />
          <SceneObjects />
          <Environment preset="night" />

          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={2}
            maxDistance={60}
          />

          {settings.showAxes && (
            <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
              <GizmoViewport
                axisColors={['#ff4444', '#44ff44', '#4444ff']}
                labelColor="white"
              />
            </GizmoHelper>
          )}
        </Suspense>
      </Canvas>

      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <ViewportButton label="Perspectiva" active />
        <ViewportButton label="Solid" active={visibleObjects.length > 0} />
        <ViewportButton
          label={activeObject ? `Activo: ${activeObject.name}` : 'Scene'}
          active={Boolean(activeObject)}
        />
      </div>

      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <ViewportButton label="Rendered" active />
        <ViewportButton label={`${visibleObjects.length} visibles`} active={visibleObjects.length > 0} />
      </div>

      {currentScene.objects.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-holo-cyan/20 bg-secondary/70 px-5 py-4 text-center backdrop-blur">
            <p className="text-sm font-semibold text-foreground">Escena vacia</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Usa el panel de escena para crear tu primer objeto.
            </p>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded bg-secondary/80 px-2 py-1">
          Objects: {currentScene.objects.length}
        </span>
        <span className="rounded bg-secondary/80 px-2 py-1">
          Selected: {currentScene.selectedObjects.length}
        </span>
        <span className="rounded bg-secondary/80 px-2 py-1">
          Visible: {visibleObjects.length}
        </span>
      </div>
    </div>
  );
}

function ViewportButton({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      className={`
        px-3 py-1.5 rounded text-xs font-medium transition-all
        ${active
          ? 'bg-holo-cyan/20 text-holo-cyan border border-holo-cyan/30'
          : 'bg-secondary/50 text-muted-foreground border border-border/30 hover:bg-secondary/80'
        }
      `}
    >
      {label}
    </button>
  );
}
