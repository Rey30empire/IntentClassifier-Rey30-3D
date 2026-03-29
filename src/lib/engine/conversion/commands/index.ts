/**
 * NEXUS Engine - Commands Module
 * 
 * Sistema de comandos para undo/redo
 */

export {
  CommandManager,
  CommandHistory,
  CommandRegistry,
  Transaction,
  MacroCommand,
  createCommandManager,
  
  // Base
  BaseCommand,
  
  // Commands
  MoveVertexCommand,
  MoveVerticesCommand,
  DeleteVerticesCommand,
  CreateVertexCommand,
  CreateFaceCommand,
  DeleteFaceCommand,
  ExtrudeFacesCommand,
  BrushStrokeCommand,
  
  // Types
  type ICommand,
  type CommandResult,
  type CommandContext,
  type CommandState,
  type CommandSeverity,
  type SerializedCommand,
  type CommandHistoryOptions,
  type CommandManagerOptions,
  type CommandEventListener,
  type CommandEvent,
} from './CommandManager';
