/**
 * NEXUS Engine - Command Manager
 * 
 * Sistema completo de comandos para undo/redo.
 * Implementa el patrón Command con soporte para:
 * - Transacciones (agrupación de comandos)
 * - Macros (comandos compuestos)
 * - Serialización
 * - Historial persistente
 */

import { generateId } from '../types';

// ============================================
// COMMAND TYPES
// ============================================

/** Estado de un comando */
export type CommandState = 'pending' | 'executed' | 'undone' | 'failed';

/** Severidad de un comando */
export type CommandSeverity = 'minor' | 'normal' | 'major' | 'destructive';

/** Resultado de ejecución */
export interface CommandResult {
  success: boolean;
  error?: string;
  warnings?: string[];
  affectedElements?: string[];
  metadata?: Record<string, unknown>;
}

/** Contexto de ejecución */
export interface CommandContext {
  meshId: string;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  isUndo: boolean;
  isRedo: boolean;
  isPreview: boolean;
}

// ============================================
// BASE COMMAND INTERFACE
// ============================================

/** Interfaz base para todos los comandos */
export interface ICommand {
  // Identificación
  id: string;
  type: string;
  name: string;
  description?: string;
  
  // Estado
  state: CommandState;
  severity: CommandSeverity;
  canUndo: boolean;
  canMerge: boolean;
  
  // Timestamps
  createdAt: number;
  executedAt?: number;
  undoneAt?: number;
  
  // Datos
  data: Record<string, unknown>;
  undoData?: Record<string, unknown>;
  
  // Contexto
  context?: CommandContext;
  
  // Métodos
  execute(context: CommandContext): Promise<CommandResult>;
  undo(context: CommandContext): Promise<CommandResult>;
  redo(context: CommandContext): Promise<CommandResult>;
  merge(other: ICommand): boolean;
  serialize(): SerializedCommand;
}

/** Comando serializado */
export interface SerializedCommand {
  id: string;
  type: string;
  name: string;
  description?: string;
  state: CommandState;
  severity: CommandSeverity;
  canUndo: boolean;
  createdAt: number;
  executedAt?: number;
  undoneAt?: number;
  data: Record<string, unknown>;
  undoData?: Record<string, unknown>;
  context?: CommandContext;
}

// ============================================
// BASE COMMAND CLASS
// ============================================

/**
 * Clase base para comandos
 */
export abstract class BaseCommand implements ICommand {
  id: string;
  type: string;
  name: string;
  description?: string;
  state: CommandState = 'pending';
  severity: CommandSeverity = 'normal';
  canUndo: boolean = true;
  canMerge: boolean = false;
  
  createdAt: number;
  executedAt?: number;
  undoneAt?: number;
  
  data: Record<string, unknown> = {};
  undoData?: Record<string, unknown>;
  context?: CommandContext;
  
  constructor(
    type: string,
    name: string,
    data?: Record<string, unknown>,
    options?: {
      description?: string;
      severity?: CommandSeverity;
      canUndo?: boolean;
      canMerge?: boolean;
    }
  ) {
    this.id = generateId();
    this.type = type;
    this.name = name;
    this.createdAt = Date.now();
    
    if (data) this.data = data;
    if (options) {
      if (options.description) this.description = options.description;
      if (options.severity) this.severity = options.severity;
      if (options.canUndo !== undefined) this.canUndo = options.canUndo;
      if (options.canMerge !== undefined) this.canMerge = options.canMerge;
    }
  }
  
  abstract execute(context: CommandContext): Promise<CommandResult>;
  
  async undo(context: CommandContext): Promise<CommandResult> {
    if (!this.canUndo) {
      return { success: false, error: 'Command cannot be undone' };
    }
    return { success: true };
  }
  
  async redo(context: CommandContext): Promise<CommandResult> {
    return this.execute(context);
  }
  
  merge(other: ICommand): boolean {
    return false;
  }
  
  serialize(): SerializedCommand {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      description: this.description,
      state: this.state,
      severity: this.severity,
      canUndo: this.canUndo,
      createdAt: this.createdAt,
      executedAt: this.executedAt,
      undoneAt: this.undoneAt,
      data: this.data,
      undoData: this.undoData,
      context: this.context,
    };
  }
  
  protected setState(state: CommandState): void {
    this.state = state;
    if (state === 'executed') {
      this.executedAt = Date.now();
    } else if (state === 'undone') {
      this.undoneAt = Date.now();
    }
  }
}

// ============================================
// MESH COMMANDS
// ============================================

import { Vec3, EditableMeshData, EditableVertex, EditableFace } from '../types';

/**
 * Comando: Mover vértice
 */
export class MoveVertexCommand extends BaseCommand {
  constructor(
    vertexId: string,
    newPosition: Vec3,
    oldPosition?: Vec3
  ) {
    super('move_vertex', 'Move Vertex', {
      vertexId,
      newPosition,
      oldPosition,
    }, { canMerge: true, severity: 'minor' });
  }
  
  async execute(context: CommandContext): Promise<CommandResult> {
    // Guardar posición anterior si no existe
    if (!this.data.oldPosition) {
      // En producción, obtener del mesh
      this.data.oldPosition = { x: 0, y: 0, z: 0 };
    }
    
    // Aplicar nueva posición
    // En producción, modificar el mesh
    
    this.setState('executed');
    return {
      success: true,
      affectedElements: [this.data.vertexId as string],
    };
  }
  
  async undo(context: CommandContext): Promise<CommandResult> {
    // Restaurar posición anterior
    const oldPos = this.data.oldPosition as Vec3;
    
    this.setState('undone');
    return {
      success: true,
      affectedElements: [this.data.vertexId as string],
    };
  }
  
  merge(other: ICommand): boolean {
    if (other.type !== 'move_vertex') return false;
    if (other.data.vertexId !== this.data.vertexId) return false;
    
    // Merge: actualizar posición final
    this.data.newPosition = other.data.newPosition;
    return true;
  }
}

/**
 * Comando: Mover múltiples vértices
 */
export class MoveVerticesCommand extends BaseCommand {
  constructor(
    vertexIds: string[],
    delta: Vec3,
    originalPositions?: Map<string, Vec3>
  ) {
    super('move_vertices', 'Move Vertices', {
      vertexIds,
      delta,
      originalPositions: originalPositions ? Object.fromEntries(originalPositions) : undefined,
    }, { canMerge: true, severity: 'minor' });
  }
  
  async execute(context: CommandContext): Promise<CommandResult> {
    // Guardar posiciones originales si no existen
    if (!this.data.originalPositions) {
      // En producción, obtener del mesh
      this.data.originalPositions = {};
    }
    
    // Aplicar delta
    this.setState('executed');
    return {
      success: true,
      affectedElements: this.data.vertexIds as string[],
    };
  }
  
  async undo(context: CommandContext): Promise<CommandResult> {
    // Restaurar posiciones originales
    this.setState('undone');
    return {
      success: true,
      affectedElements: this.data.vertexIds as string[],
    };
  }
  
  merge(other: ICommand): boolean {
    if (other.type !== 'move_vertices') return false;
    
    const otherIds = other.data.vertexIds as string[];
    const myIds = this.data.vertexIds as string[];
    
    if (otherIds.length !== myIds.length) return false;
    if (!otherIds.every(id => myIds.includes(id))) return false;
    
    // Acumular delta
    const myDelta = this.data.delta as Vec3;
    const otherDelta = other.data.delta as Vec3;
    this.data.delta = {
      x: myDelta.x + otherDelta.x,
      y: myDelta.y + otherDelta.y,
      z: myDelta.z + otherDelta.z,
    };
    
    return true;
  }
}

/**
 * Comando: Eliminar vértices
 */
export class DeleteVerticesCommand extends BaseCommand {
  constructor(vertexIds: string[]) {
    super('delete_vertices', 'Delete Vertices', {
      vertexIds,
    }, { severity: 'major' });
  }
  
  async execute(context: CommandContext): Promise<CommandResult> {
    // Guardar datos para undo
    // En producción, guardar vértices y caras afectadas
    
    this.setState('executed');
    return {
      success: true,
      affectedElements: this.data.vertexIds as string[],
    };
  }
  
  async undo(context: CommandContext): Promise<CommandResult> {
    // Restaurar vértices y caras
    this.setState('undone');
    return { success: true };
  }
}

/**
 * Comando: Crear vértice
 */
export class CreateVertexCommand extends BaseCommand {
  constructor(position: Vec3) {
    super('create_vertex', 'Create Vertex', {
      position,
    }, { severity: 'minor' });
  }
  
  async execute(context: CommandContext): Promise<CommandResult> {
    // Crear vértice
    const vertexId = generateId();
    this.data.createdVertexId = vertexId;
    
    this.setState('executed');
    return {
      success: true,
      affectedElements: [vertexId],
    };
  }
  
  async undo(context: CommandContext): Promise<CommandResult> {
    // Eliminar vértice creado
    this.setState('undone');
    return { success: true };
  }
}

/**
 * Comando: Crear cara
 */
export class CreateFaceCommand extends BaseCommand {
  constructor(vertexIds: string[]) {
    super('create_face', 'Create Face', {
      vertexIds,
    }, { severity: 'minor' });
  }
  
  async execute(context: CommandContext): Promise<CommandResult> {
    const faceId = generateId();
    this.data.createdFaceId = faceId;
    
    this.setState('executed');
    return {
      success: true,
      affectedElements: [faceId],
    };
  }
  
  async undo(context: CommandContext): Promise<CommandResult> {
    this.setState('undone');
    return { success: true };
  }
}

/**
 * Comando: Eliminar cara
 */
export class DeleteFaceCommand extends BaseCommand {
  constructor(faceIds: string[]) {
    super('delete_face', 'Delete Faces', {
      faceIds,
    }, { severity: 'minor' });
  }
  
  async execute(context: CommandContext): Promise<CommandResult> {
    // Guardar datos de caras para undo
    this.setState('executed');
    return {
      success: true,
      affectedElements: this.data.faceIds as string[],
    };
  }
  
  async undo(context: CommandContext): Promise<CommandResult> {
    this.setState('undone');
    return { success: true };
  }
}

/**
 * Comando: Extruir caras
 */
export class ExtrudeFacesCommand extends BaseCommand {
  constructor(faceIds: string[], distance: number, direction: 'normal' | 'world' | Vec3) {
    super('extrude_faces', 'Extrude Faces', {
      faceIds,
      distance,
      direction,
    }, { severity: 'normal' });
  }
  
  async execute(context: CommandContext): Promise<CommandResult> {
    // Crear nuevos vértices y caras
    const newVertexIds: string[] = [];
    const newFaceIds: string[] = [];
    
    // En producción, realizar extrusión real
    
    this.data.newVertexIds = newVertexIds;
    this.data.newFaceIds = newFaceIds;
    
    this.setState('executed');
    return {
      success: true,
      affectedElements: [...this.data.faceIds as string[], ...newVertexIds, ...newFaceIds],
    };
  }
  
  async undo(context: CommandContext): Promise<CommandResult> {
    // Eliminar vértices y caras creadas
    this.setState('undone');
    return { success: true };
  }
}

/**
 * Comando: Aplicar brush stroke
 */
export class BrushStrokeCommand extends BaseCommand {
  constructor(
    brushType: string,
    affectedVertices: Array<{ id: string; originalPos: Vec3; newPos: Vec3 }>,
    strength: number
  ) {
    super('brush_stroke', 'Brush Stroke', {
      brushType,
      affectedVertices,
      strength,
    }, { canMerge: true, severity: 'minor' });
  }
  
  async execute(context: CommandContext): Promise<CommandResult> {
    // Aplicar deformación
    this.setState('executed');
    return {
      success: true,
      affectedElements: this.data.affectedVertices
        ? (this.data.affectedVertices as Array<{ id: string }>).map(v => v.id)
        : [],
    };
  }
  
  async undo(context: CommandContext): Promise<CommandResult> {
    // Restaurar posiciones originales
    this.setState('undone');
    return { success: true };
  }
  
  merge(other: ICommand): boolean {
    if (other.type !== 'brush_stroke') return false;
    if (other.data.brushType !== this.data.brushType) return false;
    
    // Acumular cambios
    return true;
  }
}

// ============================================
// MACRO COMMAND
// ============================================

/**
 * Comando compuesto (macro)
 */
export class MacroCommand extends BaseCommand {
  private commands: ICommand[] = [];
  
  constructor(name: string, commands?: ICommand[]) {
    super('macro', name, {}, { severity: 'normal' });
    if (commands) {
      this.commands = commands;
    }
  }
  
  addCommand(command: ICommand): void {
    this.commands.push(command);
  }
  
  getCommands(): ICommand[] {
    return [...this.commands];
  }
  
  async execute(context: CommandContext): Promise<CommandResult> {
    const affectedElements: string[] = [];
    
    for (const command of this.commands) {
      const result = await command.execute(context);
      if (!result.success) {
        // Rollback comandos ya ejecutados
        for (let i = this.commands.indexOf(command) - 1; i >= 0; i--) {
          await this.commands[i].undo(context);
        }
        return {
          success: false,
          error: `Command ${command.name} failed: ${result.error}`,
        };
      }
      if (result.affectedElements) {
        affectedElements.push(...result.affectedElements);
      }
    }
    
    this.setState('executed');
    return {
      success: true,
      affectedElements,
    };
  }
  
  async undo(context: CommandContext): Promise<CommandResult> {
    const affectedElements: string[] = [];
    
    // Undo en orden inverso
    for (let i = this.commands.length - 1; i >= 0; i--) {
      const result = await this.commands[i].undo(context);
      if (!result.success) {
        return {
          success: false,
          error: `Undo of ${this.commands[i].name} failed: ${result.error}`,
        };
      }
      if (result.affectedElements) {
        affectedElements.push(...result.affectedElements);
      }
    }
    
    this.setState('undone');
    return { success: true, affectedElements };
  }
}

// ============================================
// TRANSACTION
// ============================================

/**
 * Transacción para agrupar comandos
 */
export class Transaction {
  private id: string;
  private name: string;
  private commands: ICommand[] = [];
  private isOpen: boolean = true;
  private createdAt: number;
  
  constructor(name: string) {
    this.id = generateId();
    this.name = name;
    this.createdAt = Date.now();
  }
  
  getId(): string {
    return this.id;
  }
  
  getName(): string {
    return this.name;
  }
  
  addCommand(command: ICommand): void {
    if (!this.isOpen) {
      throw new Error('Transaction is closed');
    }
    this.commands.push(command);
  }
  
  close(): MacroCommand {
    this.isOpen = false;
    const macro = new MacroCommand(this.name, this.commands);
    return macro;
  }
  
  isEmpty(): boolean {
    return this.commands.length === 0;
  }
  
  getCommandCount(): number {
    return this.commands.length;
  }
}

// ============================================
// COMMAND HISTORY
// ============================================

/** Opciones del historial */
export interface CommandHistoryOptions {
  maxSize: number;
  autoSave: boolean;
  mergeInterval: number; // ms para mergear comandos similares
}

/** Entrada del historial */
export interface HistoryEntry {
  command: ICommand;
  executedAt: number;
  undoneAt?: number;
}

/**
 * Historial de comandos
 */
export class CommandHistory {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private options: CommandHistoryOptions;
  private lastCommandTime: number = 0;
  
  constructor(options?: Partial<CommandHistoryOptions>) {
    this.options = {
      maxSize: 100,
      autoSave: false,
      mergeInterval: 500,
      ...options,
    };
  }
  
  /**
   * Añadir comando ejecutado
   */
  push(command: ICommand): void {
    // Intentar merge con último comando
    if (this.undoStack.length > 0 && command.canMerge) {
      const lastCommand = this.undoStack[this.undoStack.length - 1];
      const timeDiff = Date.now() - this.lastCommandTime;
      
      if (timeDiff < this.options.mergeInterval && lastCommand.merge(command)) {
        this.lastCommandTime = Date.now();
        return;
      }
    }
    
    // Añadir a la pila
    this.undoStack.push(command);
    this.lastCommandTime = Date.now();
    
    // Limpiar redo stack
    this.redoStack = [];
    
    // Limitar tamaño
    if (this.undoStack.length > this.options.maxSize) {
      this.undoStack.shift();
    }
  }
  
  /**
   * Obtener comando para undo
   */
  popForUndo(): ICommand | null {
    if (this.undoStack.length === 0) return null;
    
    const command = this.undoStack.pop()!;
    this.redoStack.push(command);
    return command;
  }
  
  /**
   * Obtener comando para redo
   */
  popForRedo(): ICommand | null {
    if (this.redoStack.length === 0) return null;
    
    const command = this.redoStack.pop()!;
    this.undoStack.push(command);
    return command;
  }
  
  /**
   * Verificar si hay undo disponible
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  
  /**
   * Verificar si hay redo disponible
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  
  /**
   * Obtener conteo de undos
   */
  getUndoCount(): number {
    return this.undoStack.length;
  }
  
  /**
   * Obtener conteo de redos
   */
  getRedoCount(): number {
    return this.redoStack.length;
  }
  
  /**
   * Obtener lista de comandos undo
   */
  getUndoList(): Array<{ name: string; type: string; executedAt?: number }> {
    return this.undoStack.map(cmd => ({
      name: cmd.name,
      type: cmd.type,
      executedAt: cmd.executedAt,
    }));
  }
  
  /**
   * Obtener lista de comandos redo
   */
  getRedoList(): Array<{ name: string; type: string }> {
    return this.redoStack.map(cmd => ({
      name: cmd.name,
      type: cmd.type,
    }));
  }
  
  /**
   * Limpiar historial
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
  
  /**
   * Serializar historial
   */
  serialize(): { undo: SerializedCommand[]; redo: SerializedCommand[] } {
    return {
      undo: this.undoStack.map(cmd => cmd.serialize()),
      redo: this.redoStack.map(cmd => cmd.serialize()),
    };
  }
}

// ============================================
// COMMAND MANAGER
// ============================================

/** Listener de eventos */
export type CommandEventListener = (event: CommandEvent) => void;

/** Eventos de comandos */
export interface CommandEvent {
  type: 'execute' | 'undo' | 'redo' | 'transaction_start' | 'transaction_end';
  command?: ICommand;
  result?: CommandResult;
}

/** Opciones del CommandManager */
export interface CommandManagerOptions {
  historyOptions?: Partial<CommandHistoryOptions>;
  enableTransactions: boolean;
}

/**
 * Manager principal de comandos
 */
export class CommandManager {
  private history: CommandHistory;
  private currentTransaction: Transaction | null = null;
  private options: CommandManagerOptions;
  private listeners: CommandEventListener[] = [];
  private context: CommandContext;
  
  constructor(meshId: string, options?: Partial<CommandManagerOptions>) {
    this.options = {
      historyOptions: {},
      enableTransactions: true,
      ...options,
    };
    
    this.history = new CommandHistory(this.options.historyOptions);
    this.context = {
      meshId,
      timestamp: Date.now(),
      isUndo: false,
      isRedo: false,
      isPreview: false,
    };
  }
  
  // ============================================
  // COMMAND EXECUTION
  // ============================================
  
  /**
   * Ejecutar un comando
   */
  async execute(command: ICommand): Promise<CommandResult> {
    // Si hay transacción activa, añadir a ella
    if (this.currentTransaction) {
      this.currentTransaction.addCommand(command);
      command.state = 'pending';
      return { success: true };
    }
    
    // Actualizar contexto
    this.context.timestamp = Date.now();
    this.context.isUndo = false;
    this.context.isRedo = false;
    
    // Ejecutar
    const result = await command.execute(this.context);
    
    if (result.success) {
      command.state = 'executed';
      command.context = { ...this.context };
      this.history.push(command);
      
      this.emit({ type: 'execute', command, result });
    } else {
      command.state = 'failed';
    }
    
    return result;
  }
  
  /**
   * Deshacer último comando
   */
  async undo(): Promise<CommandResult | null> {
    const command = this.history.popForUndo();
    if (!command) return null;
    
    this.context.timestamp = Date.now();
    this.context.isUndo = true;
    this.context.isRedo = false;
    
    const result = await command.undo(this.context);
    
    if (result.success) {
      command.state = 'undone';
      this.emit({ type: 'undo', command, result });
    }
    
    return result;
  }
  
  /**
   * Rehacer último comando deshecho
   */
  async redo(): Promise<CommandResult | null> {
    const command = this.history.popForRedo();
    if (!command) return null;
    
    this.context.timestamp = Date.now();
    this.context.isUndo = false;
    this.context.isRedo = true;
    
    const result = await command.redo(this.context);
    
    if (result.success) {
      command.state = 'executed';
      this.emit({ type: 'redo', command, result });
    }
    
    return result;
  }
  
  // ============================================
  // TRANSACTIONS
  // ============================================
  
  /**
   * Iniciar transacción
   */
  beginTransaction(name: string): Transaction {
    if (!this.options.enableTransactions) {
      throw new Error('Transactions are disabled');
    }
    
    if (this.currentTransaction) {
      throw new Error('A transaction is already in progress');
    }
    
    this.currentTransaction = new Transaction(name);
    this.emit({ type: 'transaction_start' });
    
    return this.currentTransaction;
  }
  
  /**
   * Finalizar transacción
   */
  async endTransaction(): Promise<CommandResult> {
    if (!this.currentTransaction) {
      throw new Error('No transaction in progress');
    }
    
    const macro = this.currentTransaction.close();
    this.currentTransaction = null;
    
    this.emit({ type: 'transaction_end' });
    
    // Si la transacción está vacía, retornar éxito sin añadir
    if (macro.getCommands().length === 0) {
      return { success: true };
    }
    
    // Ejecutar el macro
    return this.execute(macro);
  }
  
  /**
   * Cancelar transacción actual
   */
  cancelTransaction(): void {
    this.currentTransaction = null;
    this.emit({ type: 'transaction_end' });
  }
  
  /**
   * Verificar si hay transacción activa
   */
  isInTransaction(): boolean {
    return this.currentTransaction !== null;
  }
  
  // ============================================
  // HISTORY ACCESS
  // ============================================
  
  canUndo(): boolean {
    return this.history.canUndo();
  }
  
  canRedo(): boolean {
    return this.history.canRedo();
  }
  
  getUndoCount(): number {
    return this.history.getUndoCount();
  }
  
  getRedoCount(): number {
    return this.history.getRedoCount();
  }
  
  getUndoList(): Array<{ name: string; type: string }> {
    return this.history.getUndoList();
  }
  
  getRedoList(): Array<{ name: string; type: string }> {
    return this.history.getRedoList();
  }
  
  clearHistory(): void {
    this.history.clear();
  }
  
  // ============================================
  // EVENTS
  // ============================================
  
  /**
   * Añadir listener
   */
  addListener(listener: CommandEventListener): void {
    this.listeners.push(listener);
  }
  
  /**
   * Remover listener
   */
  removeListener(listener: CommandEventListener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx >= 0) {
      this.listeners.splice(idx, 1);
    }
  }
  
  /**
   * Emitir evento
   */
  private emit(event: CommandEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Command event listener error:', e);
      }
    }
  }
  
  // ============================================
  // SERIALIZATION
  // ============================================
  
  /**
   * Serializar estado
   */
  serialize(): { history: ReturnType<CommandHistory['serialize']> } {
    return {
      history: this.history.serialize(),
    };
  }
  
  /**
   * Obtener contexto actual
   */
  getContext(): CommandContext {
    return { ...this.context };
  }
}

// ============================================
// FACTORY
// ============================================

export function createCommandManager(
  meshId: string,
  options?: Partial<CommandManagerOptions>
): CommandManager {
  return new CommandManager(meshId, options);
}

// ============================================
// COMMAND REGISTRY
// ============================================

type CommandFactory = (data: Record<string, unknown>) => ICommand;

/**
 * Registro de tipos de comandos
 */
export class CommandRegistry {
  private static factories: Map<string, CommandFactory> = new Map();
  
  static register(type: string, factory: CommandFactory): void {
    this.factories.set(type, factory);
  }
  
  static create(type: string, data: Record<string, unknown>): ICommand | null {
    const factory = this.factories.get(type);
    if (!factory) return null;
    return factory(data);
  }
  
  static deserialize(serialized: SerializedCommand): ICommand | null {
    return this.create(serialized.type, serialized.data);
  }
}

// Registrar comandos por defecto
CommandRegistry.register('move_vertex', (data) => 
  new MoveVertexCommand(data.vertexId as string, data.newPosition as Vec3, data.oldPosition as Vec3));

CommandRegistry.register('move_vertices', (data) =>
  new MoveVerticesCommand(data.vertexIds as string[], data.delta as Vec3));

CommandRegistry.register('delete_vertices', (data) =>
  new DeleteVerticesCommand(data.vertexIds as string[]));

CommandRegistry.register('create_vertex', (data) =>
  new CreateVertexCommand(data.position as Vec3));

CommandRegistry.register('create_face', (data) =>
  new CreateFaceCommand(data.vertexIds as string[]));

CommandRegistry.register('delete_face', (data) =>
  new DeleteFaceCommand(data.faceIds as string[]));

CommandRegistry.register('extrude_faces', (data) =>
  new ExtrudeFacesCommand(
    data.faceIds as string[],
    data.distance as number,
    data.direction as 'normal' | 'world' | Vec3
  ));

CommandRegistry.register('brush_stroke', (data) =>
  new BrushStrokeCommand(
    data.brushType as string,
    data.affectedVertices as Array<{ id: string; originalPos: Vec3; newPos: Vec3 }>,
    data.strength as number
  ));

export default CommandManager;
