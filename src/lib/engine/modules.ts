import { ModuleType } from '@/store/nexus-store';
import {
  Box,
  Sparkles,
  Zap,
  Volume2,
  Globe,
  Code2,
  Brain,
  Layers,
  Palette,
  Bug,
  LucideIcon
} from 'lucide-react';

export interface EngineModule {
  id: ModuleType;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  features: string[];
  status: 'active' | 'inactive' | 'processing';
}

export const engineModules: EngineModule[] = [
  {
    id: 'rendering',
    name: 'Rendering',
    description: 'Graphics engine, shaders, and visual effects',
    icon: Box,
    color: 'holo-cyan',
    features: ['PBR Materials', 'Real-time Shadows', 'Post-processing', 'Ray Tracing'],
    status: 'active',
  },
  {
    id: 'animation',
    name: 'Animation',
    description: 'Rigging, skeletal animation, and motion',
    icon: Sparkles,
    color: 'holo-magenta',
    features: ['Skeletal Animation', 'Blend Trees', 'Inverse Kinematics', 'Motion Capture'],
    status: 'active',
  },
  {
    id: 'physics',
    name: 'Physics',
    description: 'Collision detection, rigid bodies, and simulation',
    icon: Zap,
    color: 'holo-orange',
    features: ['Rigid Bodies', 'Soft Bodies', 'Fluid Simulation', 'Particle Physics'],
    status: 'active',
  },
  {
    id: 'particles',
    name: 'Particles',
    description: 'VFX, particle systems, and visual effects',
    icon: Sparkles,
    color: 'holo-purple',
    features: ['Particle Systems', 'VFX Graph', 'Trail Effects', 'Explosions'],
    status: 'active',
  },
  {
    id: 'audio',
    name: 'Audio',
    description: '3D sound, music, and audio effects',
    icon: Volume2,
    color: 'holo-green',
    features: ['3D Spatial Audio', 'Sound Mixer', 'Music System', 'Voice Chat'],
    status: 'active',
  },
  {
    id: 'networking',
    name: 'Networking',
    description: 'Multiplayer, sync, and online features',
    icon: Globe,
    color: 'holo-blue',
    features: ['Multiplayer', 'State Sync', 'Matchmaking', 'Dedicated Servers'],
    status: 'active',
  },
  {
    id: 'scripting',
    name: 'Scripting',
    description: 'Visual scripting, code generation, and logic',
    icon: Code2,
    color: 'holo-yellow',
    features: ['Visual Scripting', 'AI Code Gen', 'Hot Reload', 'Debugging'],
    status: 'active',
  },
  {
    id: 'ai',
    name: 'AI Engine',
    description: 'Neural networks, behavior trees, and game AI',
    icon: Brain,
    color: 'holo-cyan',
    features: ['Neural Networks', 'Behavior Trees', 'Pathfinding', 'NPC Logic'],
    status: 'active',
  },
  {
    id: 'level-editor',
    name: 'Level Editor',
    description: 'World building, terrain, and scene design',
    icon: Layers,
    color: 'holo-magenta',
    features: ['Terrain Editor', 'Procedural Gen', 'Asset Placement', 'Environment Design'],
    status: 'active',
  },
  {
    id: 'ui-system',
    name: 'UI System',
    description: 'Menus, HUD, and user interface tools',
    icon: Palette,
    color: 'holo-purple',
    features: ['UI Builder', 'HUD System', 'Animations', 'Responsive Layouts'],
    status: 'active',
  },
  {
    id: 'debug-tools',
    name: 'Debug Tools',
    description: 'Profiling, debugging, and performance analysis',
    icon: Bug,
    color: 'holo-orange',
    features: ['Profiler', 'Memory Inspector', 'Network Debug', 'Console'],
    status: 'active',
  },
];

export const getModuleById = (id: ModuleType): EngineModule | undefined => {
  return engineModules.find((mod) => mod.id === id);
};

export const getModuleColor = (id: ModuleType): string => {
  const engineModule = getModuleById(id);
  return engineModule?.color || 'holo-cyan';
};
