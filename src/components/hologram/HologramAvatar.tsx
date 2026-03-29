'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, Ring, Box, Torus } from '@react-three/drei';
import * as THREE from 'three';
import { useNexusStore } from '@/store/nexus-store';

// Neural Network Particle Field
function NeuralField() {
  const points = useRef<THREE.Points>(null);
  const particleCount = 200;

  const [positions, colors] = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const radius = 2 + Math.random() * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      // Cyan to magenta gradient
      const t = Math.random();
      colors[i3] = 0.4 + t * 0.6;     // R
      colors[i3 + 1] = 0.8 - t * 0.3; // G
      colors[i3 + 2] = 0.9;           // B
    }

    return [positions, colors];
  }, []);

  useFrame((state) => {
    if (points.current) {
      points.current.rotation.y = state.clock.elapsedTime * 0.1;
      points.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.1;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
}

// Rotating Rings
function HologramRings() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = state.clock.elapsedTime * 0.3;
      group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  return (
    <group ref={group}>
      <Ring args={[1.8, 2, 64]} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.3} side={THREE.DoubleSide} />
      </Ring>
      <Ring args={[2.2, 2.4, 64]} rotation={[Math.PI / 2 + 0.3, 0.5, 0]}>
        <meshBasicMaterial color="#ff00ff" transparent opacity={0.2} side={THREE.DoubleSide} />
      </Ring>
      <Ring args={[2.5, 2.6, 64]} rotation={[Math.PI / 2 - 0.2, -0.3, 0.5]}>
        <meshBasicMaterial color="#8800ff" transparent opacity={0.15} side={THREE.DoubleSide} />
      </Ring>
    </group>
  );
}

// Core Hologram Sphere
function HologramCore() {
  const mesh = useRef<THREE.Mesh>(null);
  const { hologram } = useNexusStore();

  const colorMap = {
    cyan: '#00d4ff',
    magenta: '#ff00ff',
    purple: '#8800ff',
    orange: '#ff8800',
  };

  const distortMap = {
    neutral: 0.3,
    happy: 0.5,
    thinking: 0.2,
    excited: 0.7,
    focused: 0.1,
  };

  useFrame((state) => {
    if (mesh.current && hologram.isAnimating) {
      mesh.current.rotation.y = state.clock.elapsedTime * 0.5;
      mesh.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <Sphere ref={mesh} args={[1, 64, 64]}>
        <MeshDistortMaterial
          color={colorMap[hologram.color]}
          transparent
          opacity={0.8}
          distort={distortMap[hologram.emotion]}
          speed={2}
          roughness={0.1}
          metalness={0.8}
        />
      </Sphere>
    </Float>
  );
}

// Inner Geometry
function InnerGeometry() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = -state.clock.elapsedTime * 0.7;
      group.current.rotation.x = state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <group ref={group}>
      <Torus args={[0.6, 0.1, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#00ffff" transparent opacity={0.5} />
      </Torus>
      <Box args={[0.5, 0.5, 0.5]}>
        <meshBasicMaterial color="#ff00ff" transparent opacity={0.3} wireframe />
      </Box>
    </group>
  );
}

// Light Effects
function LightEffects() {
  return (
    <>
      <pointLight position={[0, 0, 0]} intensity={2} color="#00d4ff" />
      <pointLight position={[5, 5, 5]} intensity={0.5} color="#ff00ff" />
      <pointLight position={[-5, -5, -5]} intensity={0.3} color="#8800ff" />
      <ambientLight intensity={0.1} />
    </>
  );
}

// Main Hologram Component
export function HologramAvatar() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
      >
        <LightEffects />
        <HologramCore />
        <InnerGeometry />
        <HologramRings />
        <NeuralField />
      </Canvas>
    </div>
  );
}
