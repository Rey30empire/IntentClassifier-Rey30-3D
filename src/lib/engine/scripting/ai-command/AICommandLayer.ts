/**
 * AI Command Layer
 * 
 * Processes natural language commands and converts them to Action Graphs.
 * This layer understands user intent and generates appropriate actions.
 */

import {
  IntentType,
  ParsedIntent,
  ParsedEntity,
  ParsedOperation,
  ActionGraph,
  SceneAction,
  OperationType,
  Vector3,
  ScriptLanguage,
  SecurityLevel,
} from '../types';
import { ActionGraphBuilder, ActionBuilder } from '../action-graph/ActionGraph';

// ============================================
// INTENT PATTERNS
// ============================================

interface IntentPattern {
  intent: IntentType;
  patterns: RegExp[];
  operations: OperationType[];
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'create',
    patterns: [
      /crea?\s*(?:un|una|el|la)?\s*(?:personaje?|entidad|objeto|npc|enemy|enemigo)/i,
      /spawn\s*(?:a|an|the)?\s*(?:character|entity|object|npc|enemy)/i,
      /add\s*(?:a|an|the)?\s*(?:character|entity|object|npc|enemy)/i,
      /new\s*(?:character|entity|object|npc|enemy)/i,
    ],
    operations: ['spawn_character'],
  },
  {
    intent: 'move',
    patterns: [
      /muev[ea]?\s*(?:a|el|la)?\s*(?:personaje?|entidad|objeto)/i,
      /mov[ea]?\s*(?:the|a|an)?\s*(?:character|entity|object)/i,
      /(?:set|change|update)\s*(?:position|pos)/i,
      /(?:pon|coloca)\s*(?:en|a)?\s*(?:posición|pos)/i,
    ],
    operations: ['set_transform'],
  },
  {
    intent: 'animate',
    patterns: [
      /(?:agrega?|añade?|pon|activa?)\s*(?:una?)?\s*animaci[oó]n/i,
      /(?:add|play|start)\s*(?:an?)?\s*animation/i,
      /anim[ae]\s*(?:the|a|an)?\s*(?:character|entity)/i,
      /reproduce?\s*(?:la?)?\s*animaci[oó]n/i,
    ],
    operations: ['play_animation'],
  },
  {
    intent: 'delete',
    patterns: [
      /(?:elimina?|borra?|destruye?|quita?)\s*(?:el|la|un|una)?\s*(?:personaje?|entidad|objeto)/i,
      /(?:delete|remove|destroy)\s*(?:the|a|an)?\s*(?:character|entity|object)/i,
    ],
    operations: ['destroy_entity'],
  },
  {
    intent: 'repair',
    patterns: [
      /(?:corrige?|arregla?|repara?)\s*(?:las?)?\s*(?:colisiones?|errores?|problemas?)/i,
      /(?:fix|repair|correct)\s*(?:the|a|an)?\s*(?:collision|error|problem)/i,
    ],
    operations: ['validate_scene'],
  },
  {
    intent: 'generate',
    patterns: [
      /(?:genera?|crea?)\s*(?:part[ií]culas?|efectos?)/i,
      /(?:generate|create|add)\s*(?:particles?|effects?)/i,
      /(?:spawn|emit)\s*(?:particles?|effects?)/i,
    ],
    operations: ['spawn_particle'],
  },
];

// ============================================
// ENTITY TYPE MAPPINGS
// ============================================

const ENTITY_TYPE_MAP: Record<string, string> = {
  // Spanish
  'guerrero': 'warrior',
  'mago': 'mage',
  'arquero': 'archer',
  'enemigo': 'enemy',
  'personaje': 'character',
  'npc': 'npc',
  'enano': 'dwarf',
  'elfo': 'elf',
  'orco': 'orc',
  'dragon': 'dragon',
  'caballero': 'knight',
  'soldado': 'soldier',
  'jefe': 'boss',
  'protagonista': 'protagonist',
  // English
  'warrior': 'warrior',
  'mage': 'mage',
  'archer': 'archer',
  'enemy': 'enemy',
  'character': 'character',
  'dwarf': 'dwarf',
  'elf': 'elf',
  'orc': 'orc',
  'knight': 'knight',
  'soldier': 'soldier',
  'boss': 'boss',
  'protagonist': 'protagonist',
};

const ANIMATION_MAP: Record<string, string> = {
  // Spanish
  'idle': 'idle',
  'reposo': 'idle',
  'quieto': 'idle',
  'caminar': 'walk',
  'andar': 'walk',
  'correr': 'run',
  'saltar': 'jump',
  'atacar': 'attack',
  'morir': 'die',
  'muerte': 'death',
  'daño': 'hurt',
  'herido': 'hurt',
  // English
  'walk': 'walk',
  'run': 'run',
  'jump': 'jump',
  'attack': 'attack',
  'die': 'die',
  'death': 'death',
  'hurt': 'hurt',
  'cast': 'cast',
  'defend': 'defend',
};

const PARTICLE_MAP: Record<string, string> = {
  // Spanish
  'fuego': 'fire',
  'agua': 'water',
  'hielo': 'ice',
  'rayo': 'lightning',
  'humo': 'smoke',
  'polvo': 'dust',
  'sangre': 'blood',
  'magia': 'magic',
  'veneno': 'poison',
  'explosión': 'explosion',
  // English
  'fire': 'fire',
  'water': 'water',
  'ice': 'ice',
  'lightning': 'lightning',
  'smoke': 'smoke',
  'dust': 'dust',
  'blood': 'blood',
  'magic': 'magic',
  'poison': 'poison',
  'explosion': 'explosion',
  'sparkle': 'sparkle',
  'glow': 'glow',
};

// ============================================
// INTENT PARSER
// ============================================

export class IntentParser {
  /**
   * Parse natural language text to extract intent
   */
  parse(text: string): ParsedIntent {
    const normalizedText = text.toLowerCase().trim();
    
    // Detect intent type
    const intent = this.detectIntent(normalizedText);
    
    // Extract entities
    const entities = this.extractEntities(normalizedText, intent.intent);
    
    // Generate operations
    const operations = this.generateOperations(intent.intent, entities, normalizedText);

    return {
      intent: intent.intent,
      entities,
      operations,
      confidence: intent.confidence,
      original_text: text,
    };
  }

  private detectIntent(text: string): { intent: IntentType; confidence: number } {
    for (const pattern of INTENT_PATTERNS) {
      for (const regex of pattern.patterns) {
        if (regex.test(text)) {
          return { intent: pattern.intent, confidence: 0.9 };
        }
      }
    }

    // Default to create if no match
    return { intent: 'create', confidence: 0.5 };
  }

  private extractEntities(text: string, intent: IntentType): ParsedEntity[] {
    const entities: ParsedEntity[] = [];

    // Extract archetype/entity type
    for (const [key, archetype] of Object.entries(ENTITY_TYPE_MAP)) {
      if (text.includes(key)) {
        entities.push({
          type: 'character',
          value: archetype,
          position: this.extractPosition(text),
          properties: {},
        });
        break;
      }
    }

    // Extract animation references
    for (const [key, animName] of Object.entries(ANIMATION_MAP)) {
      if (text.includes(key) && (intent === 'animate' || text.includes('anim'))) {
        entities.push({
          type: 'animation',
          value: animName,
        });
      }
    }

    // Extract particle effects
    for (const [key, effectName] of Object.entries(PARTICLE_MAP)) {
      if (text.includes(key) && (intent === 'generate' || text.includes('partícula') || text.includes('particle'))) {
        entities.push({
          type: 'particle',
          value: effectName,
          position: this.extractPosition(text),
        });
      }
    }

    return entities;
  }

  private extractPosition(text: string): Vector3 | string | undefined {
    // Check for coordinate patterns
    const coordPattern = /(?:x|pos)?\s*[:=]?\s*(-?\d+\.?\d*)\s*,?\s*(?:y)?\s*[:=]?\s*(-?\d+\.?\d*)\s*,?\s*(?:z)?\s*[:=]?\s*(-?\d+\.?\d*)/i;
    const coordMatch = text.match(coordPattern);
    
    if (coordMatch) {
      return {
        x: parseFloat(coordMatch[1]),
        y: parseFloat(coordMatch[2]),
        z: parseFloat(coordMatch[3]),
      };
    }

    // Check for named positions
    if (text.includes('centro') || text.includes('center')) {
      return 'center';
    }
    if (text.includes('arriba') || text.includes('top') || text.includes('up')) {
      return 'top';
    }
    if (text.includes('abajo') || text.includes('bottom') || text.includes('down')) {
      return 'bottom';
    }
    if (text.includes('izquierda') || text.includes('left')) {
      return 'left';
    }
    if (text.includes('derecha') || text.includes('right')) {
      return 'right';
    }

    return undefined;
  }

  private generateOperations(
    intent: IntentType, 
    entities: ParsedEntity[], 
    text: string
  ): ParsedOperation[] {
    const operations: ParsedOperation[] = [];

    switch (intent) {
      case 'create': {
        const charEntity = entities.find(e => e.type === 'character');
        const animEntity = entities.find(e => e.type === 'animation');
        const particleEntity = entities.find(e => e.type === 'particle');
        
        let position: Vector3 = { x: 0, y: 0, z: 0 };
        if (charEntity?.position) {
          if (typeof charEntity.position === 'string') {
            position = this.namedPositionToVector(charEntity.position);
          } else {
            position = charEntity.position;
          }
        }

        operations.push({
          op: 'spawn_character',
          parameters: {
            archetype: charEntity?.value || 'character',
            position,
          },
        });

        if (animEntity) {
          operations.push({
            op: 'play_animation',
            parameters: {
              animation: animEntity.value,
              loop: text.includes('loop') || text.includes('bucle'),
            },
          });
        }

        if (particleEntity) {
          operations.push({
            op: 'spawn_particle',
            parameters: {
              effect: particleEntity.value,
              position: typeof particleEntity.position === 'string' 
                ? this.namedPositionToVector(particleEntity.position)
                : particleEntity.position || position,
            },
          });
        }
        break;
      }

      case 'animate': {
        const animEntity = entities.find(e => e.type === 'animation');
        if (animEntity) {
          operations.push({
            op: 'play_animation',
            parameters: {
              animation: animEntity.value,
              loop: text.includes('loop') || text.includes('bucle'),
            },
          });
        }
        break;
      }

      case 'move': {
        const position = this.extractPosition(text);
        if (position && typeof position !== 'string') {
          operations.push({
            op: 'set_transform',
            parameters: { position },
          });
        }
        break;
      }

      case 'delete': {
        operations.push({
          op: 'destroy_entity',
          parameters: {},
        });
        break;
      }

      case 'generate': {
        const particleEntity = entities.find(e => e.type === 'particle');
        if (particleEntity) {
          const pos = particleEntity.position;
          operations.push({
            op: 'spawn_particle',
            parameters: {
              effect: particleEntity.value,
              position: typeof pos === 'string' ? this.namedPositionToVector(pos) : pos || { x: 0, y: 0, z: 0 },
            },
          });
        }
        break;
      }

      case 'repair': {
        operations.push({
          op: 'validate_scene',
          parameters: {},
        });
        break;
      }
    }

    return operations;
  }

  private namedPositionToVector(name: string): Vector3 {
    const positions: Record<string, Vector3> = {
      'center': { x: 0, y: 0, z: 0 },
      'top': { x: 0, y: 10, z: 0 },
      'bottom': { x: 0, y: -10, z: 0 },
      'left': { x: -10, y: 0, z: 0 },
      'right': { x: 10, y: 0, z: 0 },
    };
    return positions[name] || { x: 0, y: 0, z: 0 };
  }
}

// ============================================
// ACTION PLANNER
// ============================================

export class ActionPlanner {
  /**
   * Convert a ParsedIntent to an ActionGraph
   */
  planFromIntent(intent: ParsedIntent): ActionGraph {
    const builder = ActionGraphBuilder.create()
      .fromAI()
      .withIntent(intent);

    let previousActionId: string | null = null;

    for (const op of intent.operations) {
      const action = this.operationToAction(op, previousActionId);
      builder.addAction(action);
      previousActionId = action.action_id;
    }

    return builder.build();
  }

  private operationToAction(op: ParsedOperation, dependsOn: string | null): SceneAction {
    const builder = ActionBuilder.create(op.op);

    // Add parameters
    for (const [key, value] of Object.entries(op.parameters)) {
      builder.withParameter(key, value);
    }

    // Add dependency if exists
    if (dependsOn) {
      builder.dependsOn(dependsOn);
    }

    // Set default security level
    builder.withSecurityLevel('safe_scene_only');

    return builder.build();
  }

  /**
   * Create a plan from raw text
   */
  planFromText(text: string): ActionGraph {
    const parser = new IntentParser();
    const intent = parser.parse(text);
    return this.planFromIntent(intent);
  }
}

// ============================================
// AI COMMAND LAYER
// ============================================

export class AICommandLayer {
  private parser: IntentParser;
  private planner: ActionPlanner;
  private history: Array<{ input: string; intent: ParsedIntent; graph: ActionGraph }> = [];

  constructor() {
    this.parser = new IntentParser();
    this.planner = new ActionPlanner();
  }

  /**
   * Process a natural language command
   */
  processCommand(text: string): ActionGraph {
    // Parse intent
    const intent = this.parser.parse(text);
    
    // Generate action plan
    const graph = this.planner.planFromIntent(intent);
    
    // Store in history
    this.history.push({ input: text, intent, graph });

    return graph;
  }

  /**
   * Get command history
   */
  getHistory(): Array<{ input: string; intent: ParsedIntent; graph: ActionGraph }> {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get the last processed command
   */
  getLastCommand(): { input: string; intent: ParsedIntent; graph: ActionGraph } | null {
    return this.history[this.history.length - 1] || null;
  }

  /**
   * Explain what the command will do
   */
  explainCommand(text: string): string {
    const intent = this.parser.parse(text);
    
    const explanations: Record<IntentType, string> = {
      create: 'Crear una nueva entidad en la escena',
      edit: 'Modificar propiedades de una entidad existente',
      repair: 'Corregir errores o problemas en la escena',
      replace: 'Reemplazar un asset o componente',
      move: 'Cambiar la posición de una entidad',
      animate: 'Reproducir una animación en una entidad',
      delete: 'Eliminar una entidad de la escena',
      generate: 'Generar contenido procedural o efectos',
      query: 'Consultar información sobre la escena',
      batch: 'Ejecutar múltiples operaciones',
      convert: 'Convertir a otro formato o lenguaje',
      validate: 'Validar la escena o configuración',
      rollback: 'Revertir cambios anteriores',
    };

    let explanation = explanations[intent.intent] || 'Operación desconocida';
    
    if (intent.entities.length > 0) {
      explanation += '\n\nEntidades detectadas:';
      for (const entity of intent.entities) {
        explanation += `\n- ${entity.type}: ${entity.value}`;
      }
    }

    if (intent.operations.length > 0) {
      explanation += '\n\nOperaciones a ejecutar:';
      for (const op of intent.operations) {
        explanation += `\n- ${op.op}`;
      }
    }

    return explanation;
  }

  /**
   * Validate a command before execution
   */
  validateCommand(text: string): { valid: boolean; warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    const intent = this.parser.parse(text);

    // Check confidence
    if (intent.confidence < 0.7) {
      warnings.push(`Baja confianza en la interpretación (${(intent.confidence * 100).toFixed(0)}%)`);
    }

    // Check for missing information
    if (intent.intent === 'create' && intent.entities.length === 0) {
      warnings.push('No se detectó tipo de entidad. Se usará "character" por defecto.');
    }

    if (intent.intent === 'animate' && !intent.entities.find(e => e.type === 'animation')) {
      errors.push('Se requiere especificar una animación');
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Suggest improvements for a command
   */
  suggestImprovements(text: string): string[] {
    const suggestions: string[] = [];
    const intent = this.parser.parse(text);

    if (intent.intent === 'create') {
      if (!intent.entities.find(e => e.type === 'animation')) {
        suggestions.push('Puedes agregar una animación: "... con animación idle"');
      }
      const charEntity = intent.entities.find(e => e.type === 'character');
      if (charEntity && !charEntity.position) {
        suggestions.push('Puedes especificar posición: "... en x 5 y 0 z 3"');
      }
    }

    return suggestions;
  }
}

// ============================================
// SINGLETON
// ============================================

let aiCommandLayerInstance: AICommandLayer | null = null;

export function createAICommandLayer(): AICommandLayer {
  if (!aiCommandLayerInstance) {
    aiCommandLayerInstance = new AICommandLayer();
  }
  return aiCommandLayerInstance;
}

export function getAICommandLayer(): AICommandLayer | null {
  return aiCommandLayerInstance;
}
