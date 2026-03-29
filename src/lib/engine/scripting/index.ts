/**
 * Multi-Script System
 * 
 * Main entry point for the scripting system
 */

// Types
export * from './types';

// Engine Automation API
export { EngineAutomationAPI, createEngineAutomationAPI, getEngineAutomationAPI } from './api/EngineAutomationAPI';

// Action Graph
export {
  ActionBuilder,
  ActionGraphBuilder,
  serializeActionGraph,
  deserializeActionGraph,
  ActionGraphUtils,
  ActionTemplates,
} from './action-graph/ActionGraph';

// Script Orchestrator
export {
  ScriptOrchestrator,
  BackendSelector,
  ExecutionQueue,
  createScriptOrchestrator,
  getScriptOrchestrator,
  type ScriptAdapter,
} from './orchestrator/ScriptOrchestrator';

// Lua Adapter
export {
  LuaAdapter,
  LuaCodeGenerator,
  LuaSandbox,
  createLuaAdapter,
  getLuaAdapter,
} from './adapters/LuaAdapter';

// AI Command Layer
export {
  AICommandLayer,
  IntentParser,
  ActionPlanner,
  createAICommandLayer,
  getAICommandLayer,
} from './ai-command/AICommandLayer';

// Rollback Manager
export {
  RollbackManager,
  createRollbackManager,
  getRollbackManager,
} from './rollback/RollbackManager';

// ============================================
// SYSTEM INITIALIZATION
// ============================================

import { ECS } from '../ecs/ECS';
import { EventBus } from '../core/EventSystem';
import { createEngineAutomationAPI, EngineAutomationAPI } from './api/EngineAutomationAPI';
import { createScriptOrchestrator, ScriptOrchestrator } from './orchestrator/ScriptOrchestrator';
import { createLuaAdapter } from './adapters/LuaAdapter';
import { createAICommandLayer, AICommandLayer } from './ai-command/AICommandLayer';
import { createRollbackManager, RollbackManager } from './rollback/RollbackManager';

export interface MultiScriptSystem {
  api: EngineAutomationAPI;
  orchestrator: ScriptOrchestrator;
  aiCommandLayer: AICommandLayer;
  rollbackManager: RollbackManager;
}

let systemInstance: MultiScriptSystem | null = null;

/**
 * Initialize the Multi-Script System
 */
export async function initializeMultiScriptSystem(
  ecs: ECS,
  eventBus: EventBus
): Promise<MultiScriptSystem> {
  if (systemInstance) {
    return systemInstance;
  }

  // Create Engine Automation API
  const api = createEngineAutomationAPI(ecs, eventBus);

  // Create Script Orchestrator
  const orchestrator = createScriptOrchestrator(api, eventBus);

  // Create and register Lua Adapter
  const luaAdapter = createLuaAdapter();
  await luaAdapter.initialize();
  orchestrator.registerAdapter('lua', luaAdapter);

  // Create AI Command Layer
  const aiCommandLayer = createAICommandLayer();

  // Create Rollback Manager
  const rollbackManager = createRollbackManager();

  systemInstance = {
    api,
    orchestrator,
    aiCommandLayer,
    rollbackManager,
  };

  console.log('[MultiScriptSystem] Initialized successfully');

  return systemInstance;
}

/**
 * Get the initialized Multi-Script System
 */
export function getMultiScriptSystem(): MultiScriptSystem | null {
  return systemInstance;
}

/**
 * Shutdown the Multi-Script System
 */
export async function shutdownMultiScriptSystem(): Promise<void> {
  if (!systemInstance) return;

  // Get Lua adapter and shutdown
  const { getLuaAdapter } = await import('./adapters/LuaAdapter');
  const luaAdapter = getLuaAdapter();
  if (luaAdapter) {
    await luaAdapter.shutdown();
  }

  systemInstance = null;
  console.log('[MultiScriptSystem] Shutdown complete');
}
