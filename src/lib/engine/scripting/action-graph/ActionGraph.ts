/**
 * Action Graph - Intermediate Representation
 * 
 * A language-neutral representation of scene operations that sits
 * between the AI command layer and the script adapters.
 */

import {
  ActionGraphId,
  ActionId,
  ActionGraph as IActionGraph,
  SceneAction,
  ActionGraphMetadata,
  OperationType,
  SecurityLevel,
  ScriptLanguage,
  ScriptSource,
  ValidationRule,
  ParsedIntent,
} from '../types';

// ============================================
// ID GENERATION
// ============================================

const generateId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================
// ACTION BUILDER
// ============================================

export class ActionBuilder {
  private action: Partial<SceneAction> = {};

  constructor(operation: OperationType) {
    this.action = {
      action_id: generateId('action'),
      operation,
      parameters: {},
      security_level: 'safe_scene_only',
    };
  }

  static create(operation: OperationType): ActionBuilder {
    return new ActionBuilder(operation);
  }

  withTarget(targetId: string, targetType: SceneAction['target_type']): this {
    this.action.target_id = targetId;
    this.action.target_type = targetType;
    return this;
  }

  withEntity(entityId: string): this {
    return this.withTarget(entityId, 'entity');
  }

  withAsset(assetId: string): this {
    return this.withTarget(assetId, 'asset');
  }

  withParameters(params: Record<string, unknown>): this {
    this.action.parameters = {
      ...this.action.parameters,
      ...params,
    };
    return this;
  }

  withParameter(key: string, value: unknown): this {
    this.action.parameters = this.action.parameters || {};
    this.action.parameters[key] = value;
    return this;
  }

  withPosition(x: number, y: number, z: number): this {
    return this.withParameter('position', { x, y, z });
  }

  withRotation(x: number, y: number, z: number, w?: number): this {
    if (w !== undefined) {
      return this.withParameter('rotation', { x, y, z, w });
    }
    return this.withParameter('rotation', { x, y, z });
  }

  withScale(x: number, y: number, z: number): this {
    return this.withParameter('scale', { x, y, z });
  }

  withSecurityLevel(level: SecurityLevel): this {
    this.action.security_level = level;
    return this;
  }

  withLanguage(language: ScriptLanguage): this {
    this.action.execution_language = language;
    return this;
  }

  withAssetRefs(refs: string[]): this {
    this.action.asset_refs = refs;
    return this;
  }

  withValidationRules(rules: ValidationRule[]): this {
    this.action.validation_rules = rules;
    return this;
  }

  dependsOn(actionId: ActionId): this {
    this.action.dependencies = this.action.dependencies || [];
    this.action.dependencies.push(actionId);
    return this;
  }

  withCondition(condition: string): this {
    this.action.condition = condition;
    return this;
  }

  build(): SceneAction {
    return this.action as SceneAction;
  }
}

// ============================================
// ACTION GRAPH BUILDER
// ============================================

export class ActionGraphBuilder {
  private graph: Partial<IActionGraph> = {};

  private createDefaultMetadata(): ActionGraphMetadata {
    return {
      security_level: 'safe_scene_only',
      dry_run: false,
      auto_rollback: true,
    };
  }

  constructor() {
    this.graph = {
      id: generateId('graph'),
      timestamp: Date.now(),
      source: 'ai',
      actions: [],
      metadata: this.createDefaultMetadata(),
    };
  }

  static create(): ActionGraphBuilder {
    return new ActionGraphBuilder();
  }

  fromSource(source: ScriptSource): this {
    this.graph.source = source;
    return this;
  }

  fromAI(): this {
    return this.fromSource('ai');
  }

  fromManual(): this {
    return this.fromSource('manual');
  }

  fromScript(): this {
    return this.fromSource('script');
  }

  withIntent(intent: ParsedIntent): this {
    this.graph.intent = intent;
    return this;
  }

  addAction(action: SceneAction): this {
    this.graph.actions = this.graph.actions || [];
    this.graph.actions.push(action);
    return this;
  }

  addActions(actions: SceneAction[]): this {
    this.graph.actions = this.graph.actions || [];
    this.graph.actions.push(...actions);
    return this;
  }

  withMetadata(metadata: Partial<ActionGraphMetadata>): this {
    this.graph.metadata = {
      ...this.graph.metadata,
      ...metadata,
    } as ActionGraphMetadata;
    return this;
  }

  withSecurityLevel(level: SecurityLevel): this {
    this.graph.metadata = this.graph.metadata || this.createDefaultMetadata();
    (this.graph.metadata as ActionGraphMetadata).security_level = level;
    return this;
  }

  withLanguage(language: ScriptLanguage): this {
    this.graph.metadata = this.graph.metadata || this.createDefaultMetadata();
    (this.graph.metadata as ActionGraphMetadata).language = language;
    return this;
  }

  asDryRun(dryRun: boolean = true): this {
    this.graph.metadata = this.graph.metadata || this.createDefaultMetadata();
    (this.graph.metadata as ActionGraphMetadata).dry_run = dryRun;
    return this;
  }

  withAutoRollback(autoRollback: boolean = true): this {
    this.graph.metadata = this.graph.metadata || this.createDefaultMetadata();
    (this.graph.metadata as ActionGraphMetadata).auto_rollback = autoRollback;
    return this;
  }

  withTimeout(timeoutMs: number): this {
    this.graph.metadata = this.graph.metadata || this.createDefaultMetadata();
    (this.graph.metadata as ActionGraphMetadata).timeout_ms = timeoutMs;
    return this;
  }

  build(): IActionGraph {
    if (!this.graph.actions || this.graph.actions.length === 0) {
      throw new Error('ActionGraph must have at least one action');
    }

    return this.graph as IActionGraph;
  }
}

// ============================================
// ACTION GRAPH SERIALIZATION
// ============================================

export function serializeActionGraph(graph: IActionGraph): string {
  return JSON.stringify(graph, null, 2);
}

export function deserializeActionGraph(json: string): IActionGraph {
  const graph = JSON.parse(json) as IActionGraph;
  
  // Validate required fields
  if (!graph.id || !graph.actions || !Array.isArray(graph.actions)) {
    throw new Error('Invalid ActionGraph: missing required fields');
  }

  return graph;
}

// ============================================
// ACTION GRAPH UTILITIES
// ============================================

export class ActionGraphUtils {
  /**
   * Get all unique asset references in the graph
   */
  static getAssetRefs(graph: IActionGraph): string[] {
    const refs = new Set<string>();
    
    for (const action of graph.actions) {
      if (action.asset_refs) {
        action.asset_refs.forEach(ref => refs.add(ref));
      }
      
      // Also check parameters for asset references
      const params = action.parameters;
      if (params.assetId) refs.add(params.assetId as string);
      if (params.prefab_id) refs.add(params.prefab_id as string);
      if (params.material_id) refs.add(params.material_id as string);
      if (params.archetype) refs.add(params.archetype as string);
    }
    
    return Array.from(refs);
  }

  /**
   * Get execution order based on dependencies
   */
  static getExecutionOrder(graph: IActionGraph): ActionId[][] {
    const actionMap = new Map<ActionId, SceneAction>();
    const inDegree = new Map<ActionId, number>();
    
    // Initialize
    for (const action of graph.actions) {
      actionMap.set(action.action_id, action);
      inDegree.set(action.action_id, 0);
    }
    
    // Calculate in-degrees
    for (const action of graph.actions) {
      if (action.dependencies) {
        for (const depId of action.dependencies) {
          inDegree.set(action.action_id, (inDegree.get(action.action_id) || 0) + 1);
        }
      }
    }
    
    // Kahn's algorithm for topological sort with levels
    const levels: ActionId[][] = [];
    const processed = new Set<ActionId>();
    
    while (processed.size < graph.actions.length) {
      // Find actions with no unprocessed dependencies
      const level: ActionId[] = [];
      
      for (const [id, degree] of inDegree) {
        if (!processed.has(id) && degree === 0) {
          level.push(id);
        }
      }
      
      if (level.length === 0) {
        // Circular dependency detected
        throw new Error('Circular dependency detected in ActionGraph');
      }
      
      levels.push(level);
      
      // Mark as processed and update in-degrees
      for (const id of level) {
        processed.add(id);
        
        // Reduce in-degree for dependents
        for (const action of graph.actions) {
          if (action.dependencies?.includes(id)) {
            inDegree.set(action.action_id, (inDegree.get(action.action_id) || 0) - 1);
          }
        }
      }
    }
    
    return levels;
  }

  /**
   * Check if action has unmet dependencies
   */
  static hasUnmetDependencies(
    action: SceneAction, 
    completedActions: Set<ActionId>
  ): boolean {
    if (!action.dependencies) return false;
    
    return action.dependencies.some(depId => !completedActions.has(depId));
  }

  /**
   * Merge multiple action graphs
   */
  static merge(graphs: IActionGraph[]): IActionGraph {
    if (graphs.length === 0) {
      throw new Error('Cannot merge empty array of ActionGraphs');
    }
    
    const merged = ActionGraphBuilder.create()
      .fromSource(graphs[0].source)
      .withMetadata(graphs[0].metadata);
    
    for (const graph of graphs) {
      merged.addActions(graph.actions);
    }
    
    return merged.build();
  }

  /**
   * Filter actions by operation type
   */
  static filterByOperation(graph: IActionGraph, operations: OperationType[]): SceneAction[] {
    return graph.actions.filter(action => operations.includes(action.operation));
  }

  /**
   * Get actions targeting a specific entity
   */
  static getActionsForEntity(graph: IActionGraph, entityId: string): SceneAction[] {
    return graph.actions.filter(action => action.target_id === entityId);
  }

  /**
   * Create a diff between two action graphs
   */
  static diff(graph1: IActionGraph, graph2: IActionGraph): {
    added: SceneAction[];
    removed: SceneAction[];
    modified: SceneAction[];
  } {
    const map1 = new Map(graph1.actions.map(a => [a.action_id, a]));
    const map2 = new Map(graph2.actions.map(a => [a.action_id, a]));
    
    const added: SceneAction[] = [];
    const removed: SceneAction[] = [];
    const modified: SceneAction[] = [];
    
    // Find added and modified
    for (const [id, action] of map2) {
      if (!map1.has(id)) {
        added.push(action);
      } else {
        const oldAction = map1.get(id)!;
        if (JSON.stringify(oldAction.parameters) !== JSON.stringify(action.parameters)) {
          modified.push(action);
        }
      }
    }
    
    // Find removed
    for (const [id, action] of map1) {
      if (!map2.has(id)) {
        removed.push(action);
      }
    }
    
    return { added, removed, modified };
  }
}

// ============================================
// PREDEFINED ACTION TEMPLATES
// ============================================

export const ActionTemplates = {
  createEntity(name: string, archetype?: string, position?: { x: number; y: number; z: number }): SceneAction {
    const builder = ActionBuilder.create('spawn_character')
      .withParameters({ name, archetype })
      .withSecurityLevel('safe_scene_only');
    
    if (position) {
      builder.withPosition(position.x, position.y, position.z);
    }
    
    return builder.build();
  },

  moveEntity(entityId: string, position: { x: number; y: number; z: number }): SceneAction {
    return ActionBuilder.create('set_transform')
      .withEntity(entityId)
      .withPosition(position.x, position.y, position.z)
      .withSecurityLevel('safe_scene_only')
      .build();
  },

  animateEntity(entityId: string, animationName: string, loop: boolean = false): SceneAction {
    return ActionBuilder.create('play_animation')
      .withEntity(entityId)
      .withParameters({ animation: animationName, loop })
      .withSecurityLevel('safe_scene_only')
      .build();
  },

  addParticle(effectName: string, position: { x: number; y: number; z: number }, parentEntity?: string): SceneAction {
    const builder = ActionBuilder.create('spawn_particle')
      .withParameters({ effect: effectName })
      .withPosition(position.x, position.y, position.z)
      .withSecurityLevel('safe_scene_only');
    
    if (parentEntity) {
      builder.withParameter('parent_entity', parentEntity);
    }
    
    return builder.build();
  },

  setMaterial(entityId: string, materialId: string): SceneAction {
    return ActionBuilder.create('set_material')
      .withEntity(entityId)
      .withParameters({ material_id: materialId })
      .withSecurityLevel('editor_only')
      .build();
  },

  batchOperation(operations: SceneAction[]): SceneAction {
    return ActionBuilder.create('batch_operation')
      .withParameters({ operations })
      .withSecurityLevel('editor_only')
      .build();
  },
};
