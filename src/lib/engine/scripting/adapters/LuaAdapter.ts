/**
 * Lua Adapter
 * 
 * Provides Lua scripting capabilities for:
 * - Gameplay runtime actions
 * - Quick scene manipulations
 * - Fast embedded scripting
 * 
 * Uses fengari-web for Lua 5.3 compatibility in JavaScript environments
 */

import { ScriptAdapter } from '../orchestrator/ScriptOrchestrator';
import { EngineAutomationAPI } from '../api/EngineAutomationAPI';
import {
  SceneAction,
  ExecutionResult,
  ExecutionError,
  ScriptLanguage,
  SecurityLevel,
  SECURITY_LEVELS,
} from '../types';

// ============================================
// LUA CODE GENERATOR
// ============================================

export class LuaCodeGenerator {
  /**
   * Generate Lua code from a SceneAction
   */
  static generateCode(action: SceneAction): string {
    const params = action.parameters;
    const targetId = action.target_id ? `"${action.target_id}"` : 'nil';

    switch (action.operation) {
      case 'spawn_character':
        return this.generateSpawnCharacter(params);

      case 'destroy_entity':
        return `engine.destroy_entity(${targetId})`;

      case 'duplicate_entity':
        return `local new_entity = engine.duplicate_entity(${targetId})`;

      case 'set_transform':
        return this.generateSetTransform(targetId, params);

      case 'play_animation':
        return this.generatePlayAnimation(targetId, params);

      case 'stop_animation':
        return `engine.stop_animation(${targetId})`;

      case 'spawn_particle':
        return this.generateSpawnParticle(params);

      case 'stop_particle':
        return `engine.stop_particle("${params.effect_id}")`;

      case 'set_property':
        return `engine.set_property(${targetId}, "${params.property_path}", ${this.serializeValue(params.value)})`;

      case 'get_property':
        return `local value = engine.get_property(${targetId}, "${params.property_path}")`;

      case 'log_info':
        return `engine.log_info("${params.message}")`;

      case 'log_warning':
        return `engine.log_warning("${params.message}")`;

      case 'log_error':
        return `engine.log_error("${params.message}")`;

      case 'find_entity_by_name':
        return `local entity = engine.find_entity_by_name("${params.name}")`;

      case 'find_entities_by_tag':
        return `local entities = engine.find_entities_by_tag("${params.tag}")`;

      default:
        return `-- Unsupported operation: ${action.operation}`;
    }
  }

  private static generateSpawnCharacter(params: Record<string, unknown>): string {
    const name = params.name ? `"${params.name}"` : '"Entity"';
    const archetype = params.archetype ? `, "${params.archetype}"` : '';
    
    let code = `local entity_id = engine.create_entity(${name}${archetype})\n`;
    
    if (params.position) {
      const pos = params.position as { x: number; y: number; z: number };
      code += `engine.set_position(entity_id, ${pos.x}, ${pos.y}, ${pos.z})\n`;
    }
    
    return code;
  }

  private static generateSetTransform(targetId: string, params: Record<string, unknown>): string {
    const lines: string[] = [];
    
    if (params.position) {
      const pos = params.position as { x: number; y: number; z: number };
      lines.push(`engine.set_position(${targetId}, ${pos.x}, ${pos.y}, ${pos.z})`);
    }
    
    if (params.rotation) {
      const rot = params.rotation as { x: number; y: number; z: number; w?: number };
      if (rot.w !== undefined) {
        lines.push(`engine.set_rotation_quat(${targetId}, ${rot.x}, ${rot.y}, ${rot.z}, ${rot.w})`);
      } else {
        lines.push(`engine.set_rotation_euler(${targetId}, ${rot.x}, ${rot.y}, ${rot.z})`);
      }
    }
    
    if (params.scale) {
      const scale = params.scale as { x: number; y: number; z: number };
      lines.push(`engine.set_scale(${targetId}, ${scale.x}, ${scale.y}, ${scale.z})`);
    }
    
    return lines.join('\n');
  }

  private static generatePlayAnimation(targetId: string, params: Record<string, unknown>): string {
    const animation = params.animation as string;
    const loop = params.loop ? 'true' : 'false';
    return `engine.play_animation(${targetId}, "${animation}", ${loop})`;
  }

  private static generateSpawnParticle(params: Record<string, unknown>): string {
    const effect = params.effect as string;
    const pos = params.position as { x: number; y: number; z: number };
    const parent = params.parent_entity ? `"${params.parent_entity}"` : 'nil';
    
    return `local particle_id = engine.spawn_particle("${effect}", ${pos.x}, ${pos.y}, ${pos.z}, ${parent})`;
  }

  private static serializeValue(value: unknown): string {
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (value === null || value === undefined) {
      return 'nil';
    }
    if (typeof value === 'object') {
      return this.serializeTable(value as Record<string, unknown>);
    }
    return 'nil';
  }

  private static serializeTable(obj: Record<string, unknown>): string {
    const entries = Object.entries(obj).map(([k, v]) => {
      return `${k} = ${this.serializeValue(v)}`;
    });
    return `{ ${entries.join(', ')} }`;
  }
}

// ============================================
// LUA SANDBOX
// ============================================

export class LuaSandbox {
  private allowedFunctions: Set<string>;
  private securityLevel: SecurityLevel;

  constructor(securityLevel: SecurityLevel = 'safe_scene_only') {
    this.securityLevel = securityLevel;
    this.allowedFunctions = new Set();
    this.updateAllowedFunctions();
  }

  setSecurityLevel(level: SecurityLevel): void {
    this.securityLevel = level;
    this.updateAllowedFunctions();
  }

  private updateAllowedFunctions(): void {
    const config = SECURITY_LEVELS[this.securityLevel];
    this.allowedFunctions.clear();

    // Always allow engine functions (they're already secured)
    this.allowedFunctions.add('engine');
    this.allowedFunctions.add('print');
    this.allowedFunctions.add('pairs');
    this.allowedFunctions.add('ipairs');
    this.allowedFunctions.add('next');
    this.allowedFunctions.add('type');
    this.allowedFunctions.add('tostring');
    this.allowedFunctions.add('tonumber');
    this.allowedFunctions.add('math');
    this.allowedFunctions.add('string');
    this.allowedFunctions.add('table');

    // Add allowed operations as engine function access
    for (const op of config.allowed_operations) {
      this.allowedFunctions.add(op);
    }
  }

  isFunctionAllowed(name: string): boolean {
    return this.allowedFunctions.has(name);
  }

  validateScript(code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for dangerous patterns
    const dangerousPatterns = [
      /os\./gi,
      /io\./gi,
      /loadfile/gi,
      /dofile/gi,
      /loadstring/gi,
      /debug\./gi,
      /_G/gi,
      /getfenv/gi,
      /setfenv/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(`Forbidden pattern detected: ${pattern.source}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

// ============================================
// LUA ADAPTER IMPLEMENTATION
// ============================================

export class LuaAdapter implements ScriptAdapter {
  readonly language: ScriptLanguage = 'lua';
  private sandbox: LuaSandbox;
  private codeGenerator: LuaCodeGenerator;
  private ready: boolean = false;
  private luaState: Map<string, unknown> = new Map();

  constructor() {
    this.sandbox = new LuaSandbox();
    this.codeGenerator = new LuaCodeGenerator();
  }

  async initialize(): Promise<void> {
    // Initialize Lua runtime
    // In a real implementation, we would use fengari or wasmoon here
    // For now, we simulate the Lua environment
    this.luaState.clear();
    this.ready = true;
    
    console.log('[LuaAdapter] Initialized successfully');
  }

  async shutdown(): Promise<void> {
    this.luaState.clear();
    this.ready = false;
    
    console.log('[LuaAdapter] Shutdown complete');
  }

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Execute a SceneAction via Lua
   */
  async execute(action: SceneAction, api: EngineAutomationAPI): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Generate Lua code
      const luaCode = LuaCodeGenerator.generateCode(action);
      
      // Validate with sandbox
      const validation = this.sandbox.validateScript(luaCode);
      if (!validation.valid) {
        return {
          action_id: action.action_id,
          status: 'failed',
          error: {
            message: `Sandbox validation failed: ${validation.errors.join(', ')}`,
            code: 'SANDBOX_VIOLATION',
            recoverable: false,
            language: 'lua',
          },
          duration_ms: Date.now() - startTime,
          changes: [],
          rollback_available: true,
        };
      }

      // Execute the action via API (simulating Lua execution)
      const result = await this.executeGeneratedCode(luaCode, action, api);
      
      return {
        ...result,
        duration_ms: Date.now() - startTime,
      };

    } catch (error) {
      return {
        action_id: action.action_id,
        status: 'failed',
        error: {
          message: error instanceof Error ? error.message : 'Lua execution failed',
          code: 'LUA_ERROR',
          stack: error instanceof Error ? error.stack : undefined,
          recoverable: true,
          language: 'lua',
        },
        duration_ms: Date.now() - startTime,
        changes: [],
        rollback_available: true,
      };
    }
  }

  /**
   * Execute raw Lua script
   */
  async executeScript(source: string, api: EngineAutomationAPI): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Validate with sandbox
      const validation = this.sandbox.validateScript(source);
      if (!validation.valid) {
        return {
          action_id: `lua_${Date.now()}`,
          status: 'failed',
          error: {
            message: `Sandbox validation failed: ${validation.errors.join(', ')}`,
            code: 'SANDBOX_VIOLATION',
            recoverable: false,
            language: 'lua',
          },
          duration_ms: Date.now() - startTime,
          changes: [],
          rollback_available: false,
        };
      }

      // Parse and execute the script
      // In production, this would use fengari or wasmoon
      // For now, we support a subset of operations
      
      const result = await this.parseAndExecute(source, api);
      
      return {
        action_id: `lua_${Date.now()}`,
        status: 'completed',
        duration_ms: Date.now() - startTime,
        changes: api.getChangeLog(),
        rollback_available: true,
        output: result,
      };

    } catch (error) {
      return {
        action_id: `lua_${Date.now()}`,
        status: 'failed',
        error: {
          message: error instanceof Error ? error.message : 'Lua script execution failed',
          code: 'LUA_SCRIPT_ERROR',
          stack: error instanceof Error ? error.stack : undefined,
          recoverable: true,
          language: 'lua',
        },
        duration_ms: Date.now() - startTime,
        changes: [],
        rollback_available: false,
      };
    }
  }

  /**
   * Get the generated Lua code for an action
   */
  getGeneratedCode(action: SceneAction): string {
    return LuaCodeGenerator.generateCode(action);
  }

  /**
   * Set sandbox security level
   */
  setSecurityLevel(level: SecurityLevel): void {
    this.sandbox.setSecurityLevel(level);
  }

  // ============================================
  // INTERNAL EXECUTION
  // ============================================

  private async executeGeneratedCode(
    code: string, 
    action: SceneAction, 
    api: EngineAutomationAPI
  ): Promise<ExecutionResult> {
    // Store generated code for debugging
    this.luaState.set('last_code', code);

    // Execute via API
    let output: unknown;

    switch (action.operation) {
      case 'spawn_character':
        output = await api.create_entity(
          (action.parameters.name as string) || 'Entity',
          action.parameters.archetype as string
        );
        if (action.parameters.position) {
          await api.set_position(output as string, action.parameters.position as any);
        }
        break;

      case 'destroy_entity':
        await api.destroy_entity(action.target_id!);
        break;

      case 'duplicate_entity':
        output = await api.duplicate_entity(action.target_id!);
        break;

      case 'set_transform':
        if (action.parameters.position) {
          await api.set_position(action.target_id!, action.parameters.position as any);
        }
        if (action.parameters.rotation) {
          await api.set_rotation(action.target_id!, action.parameters.rotation as any);
        }
        if (action.parameters.scale) {
          await api.set_scale(action.target_id!, action.parameters.scale as any);
        }
        break;

      case 'play_animation':
        await api.play_animation(
          action.target_id!,
          action.parameters.animation as string,
          action.parameters.loop as boolean
        );
        break;

      case 'stop_animation':
        await api.stop_animation(action.target_id!);
        break;

      case 'spawn_particle':
        output = await api.spawn_particle(
          action.parameters.effect as string,
          action.parameters.position as any,
          action.parameters.parent_entity as string
        );
        break;

      case 'set_property':
        await api.set_property(
          action.target_id!,
          action.parameters.property_path as string,
          action.parameters.value
        );
        break;

      case 'log_info':
        api.log_info(action.parameters.message as string);
        break;

      case 'log_warning':
        api.log_warning(action.parameters.message as string);
        break;

      case 'log_error':
        api.log_error(action.parameters.message as string);
        break;

      default:
        return {
          action_id: action.action_id,
          status: 'failed',
          error: {
            message: `Unsupported operation: ${action.operation}`,
            code: 'UNSUPPORTED_OPERATION',
            recoverable: false,
            language: 'lua',
          },
          duration_ms: 0,
          changes: [],
          rollback_available: false,
        };
    }

    return {
      action_id: action.action_id,
      status: 'completed',
      changes: api.getChangeLog(),
      rollback_available: true,
      output,
      duration_ms: 0,
    };
  }

  private async parseAndExecute(source: string, api: EngineAutomationAPI): Promise<unknown> {
    // Simple parser for basic Lua constructs
    // In production, this would use a proper Lua interpreter
    
    // Match function calls like: engine.create_entity("name")
    const functionCallRegex = /engine\.(\w+)\s*\(([^)]*)\)/g;
    let match;
    let result: unknown;

    while ((match = functionCallRegex.exec(source)) !== null) {
      const funcName = match[1];
      const argsStr = match[2];
      const args = this.parseArguments(argsStr);

      switch (funcName) {
        case 'create_entity':
          result = await api.create_entity(args[0] as string, args[1] as string);
          break;
        case 'destroy_entity':
          await api.destroy_entity(args[0] as string);
          break;
        case 'set_position': {
          const id = (this.luaState.get('entity_id') as string | number | undefined) ?? (args[0] as string | number);
          await api.set_position(id, { x: args[1] as number, y: args[2] as number, z: args[3] as number });
          break;
        }
        case 'play_animation': {
          const entityId = (this.luaState.get('entity_id') as string | number | undefined) ?? (args[0] as string | number);
          await api.play_animation(entityId, args[1] as string, args[2] as boolean);
          break;
        }
        case 'log_info':
          api.log_info(args[0] as string);
          break;
        case 'log_warning':
          api.log_warning(args[0] as string);
          break;
        case 'log_error':
          api.log_error(args[0] as string);
          break;
      }
    }

    // Store the last entity_id if assigned
    const entityIdMatch = source.match(/local\s+entity_id\s*=\s*engine\.create_entity/);
    if (entityIdMatch && result) {
      this.luaState.set('entity_id', result);
    }

    return result;
  }

  private parseArguments(argsStr: string): unknown[] {
    const args: unknown[] = [];
    const parts = argsStr.split(',').map(s => s.trim());

    for (const part of parts) {
      if (!part) continue;
      
      if (part.startsWith('"') || part.startsWith("'")) {
        // String argument
        args.push(part.slice(1, -1));
      } else if (part === 'true') {
        args.push(true);
      } else if (part === 'false') {
        args.push(false);
      } else if (part === 'nil') {
        args.push(null);
      } else if (!isNaN(Number(part))) {
        args.push(Number(part));
      } else {
        args.push(part);
      }
    }

    return args;
  }
}

// ============================================
// FACTORY
// ============================================

let luaAdapterInstance: LuaAdapter | null = null;

export function createLuaAdapter(): LuaAdapter {
  if (!luaAdapterInstance) {
    luaAdapterInstance = new LuaAdapter();
  }
  return luaAdapterInstance;
}

export function getLuaAdapter(): LuaAdapter | null {
  return luaAdapterInstance;
}
