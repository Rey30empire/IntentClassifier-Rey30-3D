/**
 * Script Orchestrator
 * 
 * Central coordinator that:
 * - Receives Action Graphs
 * - Selects the appropriate backend
 * - Manages execution queue
 * - Handles errors and rollback
 * - Maintains audit logs
 */

import { EventBus } from '../../core/EventSystem';
import { EngineAutomationAPI } from '../api/EngineAutomationAPI';
import {
  ActionGraph,
  SceneAction,
  ExecutionResult,
  ExecutionStatus,
  ExecutionError,
  ScriptLanguage,
  SecurityLevel,
  BackendSelection,
  TaskCategory,
  BACKEND_SELECTION_RULES,
  ActionId,
  TransactionId,
  SnapshotId,
  ExecutionLog,
  ActionLog,
  SceneChange,
} from '../types';
import { ActionGraphUtils } from '../action-graph/ActionGraph';

// ============================================
// BACKEND SELECTOR
// ============================================

export class BackendSelector {
  /**
   * Analyze an action and select the best backend
   */
  static selectBackend(action: SceneAction): BackendSelection {
    const category = this.categorizeAction(action);
    const language = BACKEND_SELECTION_RULES[category];
    
    return {
      language,
      reason: this.getSelectionReason(category, action),
      confidence: this.calculateConfidence(category, action),
      alternatives: this.getAlternatives(category),
    };
  }

  /**
   * Categorize an action based on its characteristics
   */
  private static categorizeAction(action: SceneAction): TaskCategory {
    const op = action.operation;

    // Gameplay/runtime operations → Lua
    if (['spawn_character', 'play_animation', 'stop_animation', 'spawn_particle', 'stop_particle'].includes(op)) {
      return 'gameplay_runtime';
    }

    // Quick actions → Lua
    if (['set_transform', 'set_property', 'get_property'].includes(op)) {
      return 'quick_action';
    }

    // Batch operations → Python
    if (op === 'batch_operation') {
      return 'batch_operation';
    }

    // Pipeline operations → Python
    if (['load_asset', 'import_asset', 'export_asset'].includes(op)) {
      return 'pipeline';
    }

    // Tool operations → Python
    if (['instantiate_prefab', 'set_material'].includes(op)) {
      return 'tool';
    }

    // Validation → TypeScript
    if (['validate_scene'].includes(op)) {
      return 'validation';
    }

    // Correction → mruby
    if (action.security_level === 'editor_only' && op.includes('fix')) {
      return 'correction';
    }

    // Default to Lua for scene operations
    return 'quick_action';
  }

  private static getSelectionReason(category: TaskCategory, action: SceneAction): string {
    const reasons: Record<TaskCategory, string> = {
      gameplay_runtime: 'Gameplay runtime operations are best suited for Lua due to its fast execution and embedded nature',
      quick_action: 'Quick scene manipulations are efficiently handled by Lua',
      automation: 'Python provides powerful automation capabilities with rich libraries',
      pipeline: 'Python excels at asset pipeline and processing tasks',
      tool: 'Python is ideal for editor tools and utilities',
      batch_operation: 'Python handles batch operations efficiently with its data processing capabilities',
      correction: 'mruby is optimized for scene correction and refactoring tasks',
      typed_authoring: 'TypeScript provides type safety for script authoring',
      advanced_tooling: 'C# offers advanced tooling and .NET ecosystem integration',
      validation: 'TypeScript provides strong typing for validation logic',
      refactoring: 'C# excels at complex refactoring operations',
    };
    return reasons[category];
  }

  private static calculateConfidence(category: TaskCategory, action: SceneAction): number {
    // Base confidence
    let confidence = 0.8;

    // Boost if action specifies a language
    if (action.execution_language) {
      confidence = 0.95;
    }

    // Boost for common patterns
    if (action.operation === 'spawn_character' && action.parameters.archetype) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private static getAlternatives(category: TaskCategory): Array<{ language: ScriptLanguage; reason: string }> {
    const alternatives: Record<TaskCategory, Array<{ language: ScriptLanguage; reason: string }>> = {
      gameplay_runtime: [
        { language: 'typescript', reason: 'TypeScript can also handle runtime with compilation' },
      ],
      quick_action: [
        { language: 'python', reason: 'Python can handle scene operations if needed' },
      ],
      automation: [
        { language: 'typescript', reason: 'TypeScript with proper tooling can automate tasks' },
      ],
      pipeline: [
        { language: 'csharp', reason: 'C# can handle complex pipeline operations' },
      ],
      tool: [
        { language: 'typescript', reason: 'TypeScript provides good tooling support' },
      ],
      batch_operation: [
        { language: 'lua', reason: 'Lua can batch simple operations quickly' },
      ],
      correction: [
        { language: 'python', reason: 'Python has good string manipulation for corrections' },
      ],
      typed_authoring: [
        { language: 'csharp', reason: 'C# provides strong typing as well' },
      ],
      advanced_tooling: [
        { language: 'python', reason: 'Python can handle advanced tooling with libraries' },
      ],
      validation: [
        { language: 'csharp', reason: 'C# provides robust validation frameworks' },
      ],
      refactoring: [
        { language: 'typescript', reason: 'TypeScript AST tools can handle refactoring' },
      ],
    };
    return alternatives[category] || [];
  }
}

// ============================================
// EXECUTION QUEUE
// ============================================

interface QueuedAction {
  action: SceneAction;
  graphId: string;
  priority: number;
  addedAt: Date;
}

export class ExecutionQueue {
  private queue: QueuedAction[] = [];
  private processing = false;
  private currentAction: QueuedAction | null = null;

  enqueue(action: SceneAction, graphId: string, priority: number = 0): void {
    const queuedAction: QueuedAction = {
      action,
      graphId,
      priority,
      addedAt: new Date(),
    };

    // Insert by priority (higher priority first)
    const insertIndex = this.queue.findIndex(item => item.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(queuedAction);
    } else {
      this.queue.splice(insertIndex, 0, queuedAction);
    }
  }

  dequeue(): QueuedAction | null {
    return this.queue.shift() || null;
  }

  peek(): QueuedAction | null {
    return this.queue[0] || null;
  }

  clear(): void {
    this.queue = [];
  }

  get length(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  isProcessing(): boolean {
    return this.processing;
  }

  setProcessing(processing: boolean): void {
    this.processing = processing;
  }

  getCurrent(): QueuedAction | null {
    return this.currentAction;
  }

  setCurrent(action: QueuedAction | null): void {
    this.currentAction = action;
  }

  getAll(): QueuedAction[] {
    return [...this.queue];
  }
}

// ============================================
// SCRIPT ORCHESTRATOR
// ============================================

export class ScriptOrchestrator {
  private api: EngineAutomationAPI;
  private eventBus: EventBus;
  private queue: ExecutionQueue;
  private logs: ExecutionLog[] = [];
  private currentTransaction: TransactionId | null = null;
  private snapshots: Map<string, SnapshotId> = new Map();
  private adapters: Map<ScriptLanguage, ScriptAdapter> = new Map();

  constructor(api: EngineAutomationAPI, eventBus: EventBus) {
    this.api = api;
    this.eventBus = eventBus;
    this.queue = new ExecutionQueue();
  }

  // ============================================
  // ADAPTER MANAGEMENT
  // ============================================

  registerAdapter(language: ScriptLanguage, adapter: ScriptAdapter): void {
    this.adapters.set(language, adapter);
    console.log(`[Orchestrator] Registered adapter for: ${language}`);
  }

  getAdapter(language: ScriptLanguage): ScriptAdapter | undefined {
    return this.adapters.get(language);
  }

  getAvailableLanguages(): ScriptLanguage[] {
    return Array.from(this.adapters.keys());
  }

  // ============================================
  // EXECUTION
  // ============================================

  /**
   * Execute an Action Graph
   */
  async executeGraph(graph: ActionGraph): Promise<ExecutionResult[]> {
    const startTime = Date.now();
    const results: ExecutionResult[] = [];

    // Create execution log
    const log: ExecutionLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date(),
      source: graph.source,
      language: graph.metadata.language,
      action_graph_id: graph.id,
      actions: [],
      result: 'pending',
      duration_total_ms: 0,
      rollback_performed: false,
    };

    // Validate graph
    const validationResult = this.validateGraph(graph);
    if (!validationResult.valid) {
      log.result = 'failed';
      this.logs.push(log);
      
      return [{
        action_id: 'validation',
        status: 'failed',
        error: {
          message: 'ActionGraph validation failed',
          code: 'VALIDATION_FAILED',
          recoverable: false,
        },
        duration_ms: 0,
        changes: [],
        rollback_available: false,
      }];
    }

    // Start transaction for rollback support
    const txLabel = `graph_${graph.id}`;
    this.currentTransaction = this.api.begin_transaction(txLabel);

    // Get execution order based on dependencies
    const executionLevels = ActionGraphUtils.getExecutionOrder(graph);
    const completedActions = new Set<ActionId>();

    try {
      // Execute actions level by level
      for (const level of executionLevels) {
        // Execute all actions in this level in parallel
        const levelPromises = level.map(actionId => {
          const action = graph.actions.find(a => a.action_id === actionId)!;
          return this.executeAction(action, graph, completedActions);
        });

        const levelResults = await Promise.all(levelPromises);
        results.push(...levelResults);

        // Mark completed
        for (let i = 0; i < level.length; i++) {
          if (levelResults[i].status === 'completed') {
            completedActions.add(level[i]);
          }
        }

        // Check for failures
        const failures = levelResults.filter(r => r.status === 'failed');
        if (failures.length > 0 && graph.metadata.auto_rollback) {
          throw new Error(`Action failed: ${failures[0].error?.message}`);
        }
      }

      // Commit transaction
      await this.api.commit_transaction();
      log.result = 'completed';

    } catch (error) {
      // Rollback on failure
      if (graph.metadata.auto_rollback && this.currentTransaction) {
        await this.api.rollback_transaction();
        log.rollback_performed = true;
      }
      
      log.result = 'rolled_back';
      
      // Mark remaining results as failed
      for (const result of results) {
        if (result.status === 'pending') {
          result.status = 'rolled_back';
        }
      }
    }

    log.duration_total_ms = Date.now() - startTime;
    log.actions = results.map((r, i) => this.resultToActionLog(r, graph.actions[i]));
    
    this.logs.push(log);
    this.currentTransaction = null;

    // Emit completion event
    this.eventBus.emit('orchestrator:graph_completed', {
      graphId: graph.id,
      success: log.result === 'completed',
      duration: log.duration_total_ms,
    });

    return results;
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: SceneAction,
    graph: ActionGraph,
    completedActions: Set<ActionId>
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Check dependencies
    if (ActionGraphUtils.hasUnmetDependencies(action, completedActions)) {
      return {
        action_id: action.action_id,
        status: 'failed',
        error: {
          message: 'Dependencies not met',
          code: 'DEPENDENCIES_NOT_MET',
          recoverable: false,
        },
        duration_ms: 0,
        changes: [],
        rollback_available: false,
      };
    }

    // Select backend
    const selection = BackendSelector.selectBackend(action);
    const language = action.execution_language || selection.language;

    // Dry run check
    if (graph.metadata.dry_run) {
      return {
        action_id: action.action_id,
        status: 'dry_run',
        duration_ms: Date.now() - startTime,
        changes: [],
        rollback_available: true,
        output: { selectedBackend: language, reason: selection.reason },
      };
    }

    // Execute via appropriate adapter
    const adapter = this.adapters.get(language);
    
    if (adapter) {
      // Use adapter to execute
      try {
        const result = await adapter.execute(action, this.api);
        result.duration_ms = Date.now() - startTime;
        return result;
      } catch (error) {
        return {
          action_id: action.action_id,
          status: 'failed',
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'ADAPTER_ERROR',
            recoverable: true,
            language,
          },
          duration_ms: Date.now() - startTime,
          changes: [],
          rollback_available: true,
        };
      }
    }

    // Fallback: Execute directly via API
    return this.executeDirect(action, startTime);
  }

  /**
   * Execute action directly via Engine Automation API
   */
  private async executeDirect(
    action: SceneAction,
    startTime: number
  ): Promise<ExecutionResult> {
    try {
      let output: unknown;

      switch (action.operation) {
        case 'spawn_character':
          output = await this.api.create_entity(
            action.parameters.name as string || 'Entity',
            action.parameters.archetype as string
          );
          break;

        case 'destroy_entity':
          await this.api.destroy_entity(action.target_id!);
          break;

        case 'duplicate_entity':
          output = await this.api.duplicate_entity(action.target_id!);
          break;

        case 'set_transform':
          await this.api.set_transform(action.target_id!, action.parameters as any);
          break;

        case 'play_animation':
          await this.api.play_animation(
            action.target_id!,
            action.parameters.animation as string,
            action.parameters.loop as boolean
          );
          break;

        case 'stop_animation':
          await this.api.stop_animation(action.target_id!);
          break;

        case 'spawn_particle':
          output = await this.api.spawn_particle(
            action.parameters.effect as string,
            action.parameters.position as any,
            action.parameters.parent_entity as string
          );
          break;

        case 'set_property':
          await this.api.set_property(
            action.target_id!,
            action.parameters.property_path as string,
            action.parameters.value
          );
          break;

        case 'log_info':
          this.api.log_info(action.parameters.message as string);
          break;

        case 'log_warning':
          this.api.log_warning(action.parameters.message as string);
          break;

        case 'log_error':
          this.api.log_error(action.parameters.message as string);
          break;

        default:
          return {
            action_id: action.action_id,
            status: 'failed',
            error: {
              message: `Unknown operation: ${action.operation}`,
              code: 'UNKNOWN_OPERATION',
              recoverable: false,
            },
            duration_ms: Date.now() - startTime,
            changes: [],
            rollback_available: false,
          };
      }

      return {
        action_id: action.action_id,
        status: 'completed',
        duration_ms: Date.now() - startTime,
        changes: this.api.getChangeLog(),
        rollback_available: true,
        output,
      };

    } catch (error) {
      return {
        action_id: action.action_id,
        status: 'failed',
        error: {
          message: error instanceof Error ? error.message : 'Execution failed',
          code: 'EXECUTION_ERROR',
          recoverable: true,
        },
        duration_ms: Date.now() - startTime,
        changes: [],
        rollback_available: true,
      };
    }
  }

  // ============================================
  // VALIDATION
  // ============================================

  private validateGraph(graph: ActionGraph): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for empty actions
    if (!graph.actions || graph.actions.length === 0) {
      errors.push('ActionGraph has no actions');
    }

    // Check for circular dependencies
    try {
      ActionGraphUtils.getExecutionOrder(graph);
    } catch (e) {
      errors.push('Circular dependency detected');
    }

    // Validate individual actions
    for (const action of graph.actions) {
      if (!action.operation) {
        errors.push(`Action ${action.action_id} has no operation`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ============================================
  // LOGGING
  // ============================================

  private resultToActionLog(result: ExecutionResult, action: SceneAction): ActionLog {
    return {
      action_id: result.action_id,
      operation: action?.operation || 'unknown',
      target_id: action?.target_id,
      parameters: action?.parameters || {},
      status: result.status,
      error: result.error,
      duration_ms: result.duration_ms,
      changes_made: result.changes,
      backend_used: action?.execution_language,
    };
  }

  getLogs(): ExecutionLog[] {
    return [...this.logs];
  }

  getLatestLog(): ExecutionLog | null {
    return this.logs[this.logs.length - 1] || null;
  }

  clearLogs(): void {
    this.logs = [];
  }

  // ============================================
  // QUEUE MANAGEMENT
  // ============================================

  enqueueGraph(graph: ActionGraph, priority: number = 0): void {
    for (const action of graph.actions) {
      this.queue.enqueue(action, graph.id, priority);
    }
    
    this.eventBus.emit('orchestrator:queued', { graphId: graph.id });
  }

  async processQueue(): Promise<void> {
    if (this.queue.isProcessing()) return;
    
    this.queue.setProcessing(true);

    while (!this.queue.isEmpty()) {
      const item = this.queue.dequeue();
      if (item) {
        this.queue.setCurrent(item);
        await this.executeDirect(item.action, Date.now());
        this.queue.setCurrent(null);
      }
    }

    this.queue.setProcessing(false);
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clearQueue(): void {
    this.queue.clear();
  }
}

// ============================================
// SCRIPT ADAPTER INTERFACE
// ============================================

export interface ScriptAdapter {
  readonly language: ScriptLanguage;
  
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  
  execute(action: SceneAction, api: EngineAutomationAPI): Promise<ExecutionResult>;
  executeScript(source: string, api: EngineAutomationAPI): Promise<ExecutionResult>;
  
  isReady(): boolean;
}

// ============================================
// ORCHESTRATOR SINGLETON
// ============================================

let orchestratorInstance: ScriptOrchestrator | null = null;

export function createScriptOrchestrator(
  api: EngineAutomationAPI, 
  eventBus: EventBus
): ScriptOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new ScriptOrchestrator(api, eventBus);
  }
  return orchestratorInstance;
}

export function getScriptOrchestrator(): ScriptOrchestrator | null {
  return orchestratorInstance;
}
