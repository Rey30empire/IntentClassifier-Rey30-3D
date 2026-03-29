import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

// Types
export type ModuleType = 
  | 'rendering' 
  | 'animation' 
  | 'physics' 
  | 'particles' 
  | 'audio' 
  | 'networking' 
  | 'scripting' 
  | 'ai'
  | 'level-editor'
  | 'ui-system'
  | 'debug-tools';

export type WorkspaceType = 
  | 'modeling' 
  | 'sculpting' 
  | 'rigging' 
  | 'animation' 
  | 'shading' 
  | 'texturing'
  | 'vfx'
  | 'scripting';

export type EditorMode = 
  | 'object' 
  | 'edit' 
  | 'sculpt' 
  | 'texture-paint' 
  | 'weight-paint' 
  | 'pose';

export interface DataBlock {
  id: string;
  type: 'mesh' | 'material' | 'texture' | 'camera' | 'light' | 'armature' | 'animation' | 'scene' | 'collection';
  name: string;
  data: unknown;
  references: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SceneObject {
  id: string;
  name: string;
  type: 'mesh' | 'light' | 'camera' | 'empty' | 'armature';
  dataBlockId?: string;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  children: string[];
  parentId?: string;
  visible: boolean;
  locked: boolean;
}

export interface NexusSceneState {
  id: string;
  name: string;
  objects: SceneObject[];
  selectedObjects: string[];
  activeObject?: string;
}

const defaultSceneObjects: SceneObject[] = [
  {
    id: 'scene-core-cube',
    name: 'Core Cube',
    type: 'mesh',
    dataBlockId: 'primitive-box',
    transform: {
      position: [0, 0.6, 0],
      rotation: [0, 0.45, 0],
      scale: [1, 1, 1],
    },
    children: [],
    visible: true,
    locked: false,
  },
  {
    id: 'scene-signal-sphere',
    name: 'Signal Sphere',
    type: 'mesh',
    dataBlockId: 'primitive-sphere',
    transform: {
      position: [2.4, 1, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    children: [],
    visible: true,
    locked: false,
  },
  {
    id: 'scene-orbit-torus',
    name: 'Orbit Torus',
    type: 'mesh',
    dataBlockId: 'primitive-torus',
    transform: {
      position: [-2.4, 0.7, 0],
      rotation: [Math.PI / 2, 0, 0.35],
      scale: [1, 1, 1],
    },
    children: [],
    visible: true,
    locked: false,
  },
];

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  module?: ModuleType;
  action?: {
    type: string;
    params: Record<string, unknown>;
  };
}

export interface AgentTask {
  id: string;
  type: 'create' | 'modify' | 'delete' | 'query';
  module: ModuleType;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  params: Record<string, unknown>;
  result?: unknown;
  createdAt: Date;
}

export interface HologramState {
  isAnimating: boolean;
  emotion: 'neutral' | 'happy' | 'thinking' | 'excited' | 'focused';
  color: 'cyan' | 'magenta' | 'purple' | 'orange';
}

interface NexusState {
  // Engine State
  engineName: string;
  version: string;
  
  // Scene State
  currentScene: NexusSceneState;
  
  // Data Blocks
  dataBlocks: Map<string, DataBlock>;
  
  // Editor State
  activeModule: ModuleType;
  activeWorkspace: WorkspaceType;
  editorMode: EditorMode;
  
  // UI State
  panels: {
    left: { visible: boolean; width: number; type: string };
    right: { visible: boolean; width: number; type: string };
    bottom: { visible: boolean; height: number; type: string };
  };
  
  // AI State
  chatMessages: ChatMessage[];
  isAiProcessing: boolean;
  agentTasks: AgentTask[];
  
  // Hologram State
  hologram: HologramState;
  
  // Settings
  settings: {
    aiProvider: 'gpt-4' | 'claude' | 'gemini' | 'local';
    renderQuality: 'low' | 'medium' | 'high' | 'ultra';
    showGrid: boolean;
    showAxes: boolean;
    snapToGrid: boolean;
    gridSize: number;
    theme: 'dark' | 'darker';
  };
  
  // Actions
  setActiveModule: (module: ModuleType) => void;
  setActiveWorkspace: (workspace: WorkspaceType) => void;
  setEditorMode: (mode: EditorMode) => void;
  
  // Scene Actions
  addObject: (object: Omit<SceneObject, 'id'>) => string;
  removeObject: (id: string) => void;
  selectObject: (id: string, addToSelection?: boolean) => void;
  clearSelection: () => void;
  renameCurrentScene: (name: string) => void;
  replaceCurrentScene: (scene: NexusSceneState) => void;
  updateObjectTransform: (id: string, transform: Partial<SceneObject['transform']>) => void;
  toggleObjectVisibility: (id: string) => void;
  toggleObjectLock: (id: string) => void;
  
  // Data Block Actions
  addDataBlock: (block: Omit<DataBlock, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateDataBlock: (id: string, data: Partial<DataBlock>) => void;
  removeDataBlock: (id: string) => void;
  
  // Chat Actions
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChat: () => void;
  setAiProcessing: (processing: boolean) => void;
  
  // Agent Actions
  addAgentTask: (task: Omit<AgentTask, 'id' | 'createdAt' | 'status'>) => string;
  updateAgentTask: (id: string, updates: Partial<AgentTask>) => void;
  
  // Hologram Actions
  setHologramState: (state: Partial<HologramState>) => void;
  
  // Settings Actions
  updateSettings: (settings: Partial<NexusState['settings']>) => void;
  
  // Panel Actions
  togglePanel: (panel: 'left' | 'right' | 'bottom') => void;
  resizePanel: (panel: 'left' | 'right' | 'bottom', size: number) => void;
}

export const useNexusStore = create<NexusState>((set, get) => ({
  // Initial State
  engineName: 'Rey30_NEXUS',
  version: '0.1.0',
  
  currentScene: {
    id: 'default-scene',
    name: 'Untitled Scene',
    objects: defaultSceneObjects,
    selectedObjects: [],
    activeObject: undefined,
  },
  
  dataBlocks: new Map(),
  
  activeModule: 'rendering',
  activeWorkspace: 'modeling',
  editorMode: 'object',
  
  panels: {
    left: { visible: true, width: 280, type: 'outliner' },
    right: { visible: true, width: 320, type: 'properties' },
    bottom: { visible: true, height: 200, type: 'chat' },
  },
  
  chatMessages: [],
  isAiProcessing: false,
  agentTasks: [],
  
  hologram: {
    isAnimating: true,
    emotion: 'neutral',
    color: 'cyan',
  },
  
  settings: {
    aiProvider: 'gpt-4',
    renderQuality: 'high',
    showGrid: true,
    showAxes: true,
    snapToGrid: false,
    gridSize: 1,
    theme: 'dark',
  },
  
  // Actions
  setActiveModule: (module) => set({ activeModule: module }),
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  setEditorMode: (mode) => set({ editorMode: mode }),
  
  addObject: (object) => {
    const id = uuidv4();
    set((state) => ({
      currentScene: {
        ...state.currentScene,
        objects: [...state.currentScene.objects, { ...object, id }],
      },
    }));
    return id;
  },
  
  removeObject: (id) => set((state) => ({
    currentScene: {
      ...state.currentScene,
      objects: state.currentScene.objects.filter((obj) => obj.id !== id),
      selectedObjects: state.currentScene.selectedObjects.filter((objId) => objId !== id),
      activeObject: state.currentScene.activeObject === id ? undefined : state.currentScene.activeObject,
    },
  })),
  
  selectObject: (id, addToSelection = false) => set((state) => ({
    currentScene: {
      ...state.currentScene,
      selectedObjects: addToSelection 
        ? Array.from(new Set([...state.currentScene.selectedObjects, id]))
        : [id],
      activeObject: id,
    },
  })),
  
  clearSelection: () => set((state) => ({
    currentScene: {
      ...state.currentScene,
      selectedObjects: [],
      activeObject: undefined,
    },
  })),

  renameCurrentScene: (name) => set((state) => ({
    currentScene: {
      ...state.currentScene,
      name,
    },
  })),

  replaceCurrentScene: (scene) => set(() => ({
    currentScene: {
      ...scene,
      selectedObjects: scene.selectedObjects ?? [],
      activeObject: scene.activeObject,
    },
  })),
  
  updateObjectTransform: (id, transform) => set((state) => ({
    currentScene: {
      ...state.currentScene,
      objects: state.currentScene.objects.map((obj) =>
        obj.id === id
          ? obj.locked
            ? obj
            : { ...obj, transform: { ...obj.transform, ...transform } }
          : obj
      ),
    },
  })),

  toggleObjectVisibility: (id) => set((state) => ({
    currentScene: {
      ...state.currentScene,
      objects: state.currentScene.objects.map((obj) =>
        obj.id === id
          ? { ...obj, visible: !obj.visible }
          : obj
      ),
    },
  })),

  toggleObjectLock: (id) => set((state) => ({
    currentScene: {
      ...state.currentScene,
      objects: state.currentScene.objects.map((obj) =>
        obj.id === id
          ? { ...obj, locked: !obj.locked }
          : obj
      ),
    },
  })),
  
  addDataBlock: (block) => {
    const id = uuidv4();
    set((state) => {
      const newBlocks = new Map(state.dataBlocks);
      newBlocks.set(id, {
        ...block,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { dataBlocks: newBlocks };
    });
    return id;
  },
  
  updateDataBlock: (id, data) => set((state) => {
    const newBlocks = new Map(state.dataBlocks);
    const block = newBlocks.get(id);
    if (block) {
      newBlocks.set(id, { ...block, ...data, updatedAt: new Date() });
    }
    return { dataBlocks: newBlocks };
  }),
  
  removeDataBlock: (id) => set((state) => {
    const newBlocks = new Map(state.dataBlocks);
    newBlocks.delete(id);
    return { dataBlocks: newBlocks };
  }),
  
  addChatMessage: (message) => set((state) => ({
    chatMessages: [
      ...state.chatMessages,
      { ...message, id: uuidv4(), timestamp: new Date() },
    ],
  })),
  
  clearChat: () => set({ chatMessages: [] }),
  
  setAiProcessing: (processing) => set({ isAiProcessing: processing }),
  
  addAgentTask: (task) => {
    const id = uuidv4();
    set((state) => ({
      agentTasks: [
        ...state.agentTasks,
        { ...task, id, createdAt: new Date(), status: 'pending' },
      ],
    }));
    return id;
  },
  
  updateAgentTask: (id, updates) => set((state) => ({
    agentTasks: state.agentTasks.map((task) =>
      task.id === id ? { ...task, ...updates } : task
    ),
  })),
  
  setHologramState: (newState) => set((state) => ({
    hologram: { ...state.hologram, ...newState },
  })),
  
  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings },
  })),
  
  togglePanel: (panel) => set((state) => ({
    panels: {
      ...state.panels,
      [panel]: { ...state.panels[panel], visible: !state.panels[panel].visible },
    },
  })),
  
  resizePanel: (panel, size) => set((state) => ({
    panels: {
      ...state.panels,
      [panel]: {
        ...state.panels[panel],
        ...(panel === 'bottom'
          ? { height: size }
          : { width: size }),
      },
    },
  })),
}));
