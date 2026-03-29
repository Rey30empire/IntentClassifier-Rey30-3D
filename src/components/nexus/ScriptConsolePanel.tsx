'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Square, 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  FileCode,
  Terminal,
  Bug,
  Info,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  language?: string;
  duration?: number;
  details?: string;
}

interface ScriptEntry {
  id: string;
  language: 'lua' | 'python' | 'mruby' | 'typescript' | 'csharp';
  code: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// ============================================
// SCRIPT CONSOLE PANEL
// ============================================

export function ScriptConsolePanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentScript, setCurrentScript] = useState<ScriptEntry | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('lua');
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Demo script
  const demoScripts: Record<string, string> = {
    lua: `-- Crear guerrero con animación
local entity_id = engine.create_entity("Warrior", "warrior")
engine.set_position(entity_id, 0, 0, 0)
engine.play_animation(entity_id, "idle", true)

-- Agregar partículas de fuego
local particle_id = engine.spawn_particle("fire_sword", 0, 1.5, 0, entity_id)

engine.log_info("Guerrero creado exitosamente")`,
    python: `# Crear múltiples enemigos
import engine

for i in range(5):
    angle = i * (2 * 3.14159 / 5)
    x = 10 * math.cos(angle)
    z = 10 * math.sin(angle)
    
    enemy = engine.create_entity(f"Enemy_{i}", "enemy")
    engine.set_position(enemy, x, 0, z)
    
engine.log_info("Enemigos creados en círculo")`,
    typescript: `// Script tipado para crear personaje
interface CharacterConfig {
  name: string;
  archetype: string;
  position: Vector3;
}

const config: CharacterConfig = {
  name: "Hero",
  archetype: "warrior",
  position: { x: 0, y: 0, z: 0 }
};

const entityId = await engine.createEntity(config.name, config.archetype);
await engine.setPosition(entityId, config.position);
await engine.playAnimation(entityId, "idle", true);`,
  };

  // Add initial logs
  useEffect(() => {
    const initialLogs: LogEntry[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 5000),
        level: 'info',
        message: 'Sistema Multi-Script inicializado',
        language: 'system',
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 4000),
        level: 'success',
        message: 'Lua Adapter registrado correctamente',
        language: 'lua',
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 3000),
        level: 'info',
        message: 'Engine Automation API lista',
        language: 'system',
      },
    ];
    setLogs(initialLogs);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Run script
  const handleRunScript = async () => {
    const code = demoScripts[selectedLanguage] || demoScripts.lua;
    
    const script: ScriptEntry = {
      id: `script_${Date.now()}`,
      language: selectedLanguage as ScriptEntry['language'],
      code,
      status: 'running',
    };

    setCurrentScript(script);
    setIsRunning(true);

    // Add start log
    addLog('info', `Ejecutando script ${selectedLanguage.toUpperCase()}...`, selectedLanguage);

    try {
      // Simulate execution
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Add success logs
      addLog('success', 'Script ejecutado correctamente', selectedLanguage, 1523);
      addLog('info', 'Entidad "Warrior" creada', selectedLanguage);
      addLog('info', 'Animación "idle" iniciada', selectedLanguage);

      setCurrentScript(prev => prev ? { ...prev, status: 'completed' } : null);

    } catch (error) {
      addLog('error', 'Error en la ejecución del script', selectedLanguage);
      setCurrentScript(prev => prev ? { ...prev, status: 'failed' } : null);
    } finally {
      setIsRunning(false);
    }
  };

  // Stop execution
  const handleStopScript = () => {
    setIsRunning(false);
    addLog('warning', 'Ejecución detenida por el usuario', selectedLanguage);
    setCurrentScript(prev => prev ? { ...prev, status: 'pending' } : null);
  };

  // Clear console
  const handleClearConsole = () => {
    setLogs([]);
    addLog('info', 'Consola limpiada', 'system');
  };

  // Add log entry
  const addLog = (
    level: LogEntry['level'], 
    message: string, 
    language?: string, 
    duration?: number
  ) => {
    const newLog: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      language,
      duration,
    };
    setLogs(prev => [...prev, newLog]);
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900/50 to-slate-900/80 backdrop-blur-sm border border-cyan-500/20 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-cyan-500/20 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-green-500/20">
            <Terminal className="w-4 h-4 text-green-400" />
          </div>
          <span className="text-sm font-medium text-cyan-100">Script Console</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Language selector */}
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-0.5">
            {['lua', 'python', 'typescript'].map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  selectedLanguage === lang
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-400 hover:text-cyan-300'
                )}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <Button
            size="icon"
            variant="ghost"
            onClick={handleClearConsole}
            className="h-7 w-7 text-slate-400 hover:text-cyan-300"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Script preview */}
        {currentScript && (
          <div className="border-b border-cyan-500/10 p-3 bg-slate-900/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-slate-300">
                  {currentScript.language.toUpperCase()} Script
                </span>
                <StatusBadge status={currentScript.status} />
              </div>
            </div>
            <pre className="text-xs text-slate-400 font-mono bg-slate-950/50 p-2 rounded border border-slate-800/50 overflow-x-auto max-h-32">
              {currentScript.code.split('\n').slice(0, 8).join('\n')}
              {currentScript.code.split('\n').length > 8 && '\n...'}
            </pre>
          </div>
        )}

        {/* Logs */}
        <ScrollArea ref={scrollRef} className="flex-1 p-2">
          <AnimatePresence>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2 py-1.5 border-b border-slate-800/30 last:border-0"
              >
                <LogIcon level={log.level} />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm truncate',
                    log.level === 'error' ? 'text-red-300' :
                    log.level === 'warning' ? 'text-yellow-300' :
                    log.level === 'success' ? 'text-green-300' :
                    'text-slate-300'
                  )}>
                    {log.message}
                  </p>
                  {log.details && (
                    <p className="text-xs text-slate-500 mt-0.5">{log.details}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {log.duration && (
                    <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                      {log.duration}ms
                    </Badge>
                  )}
                  {log.language && (
                    <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-400">
                      {log.language}
                    </Badge>
                  )}
                  <span className="text-[10px] text-slate-500">
                    {formatTime(log.timestamp)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </ScrollArea>
      </div>

      {/* Footer controls */}
      <div className="p-3 border-t border-cyan-500/20 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleRunScript}
              disabled={isRunning}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 border-0"
            >
              {isRunning ? (
                <>
                  <Square className="w-3.5 h-3.5 mr-1.5" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Run
                </>
              )}
            </Button>

            {isRunning && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleStopScript}
              >
                <Square className="w-3.5 h-3.5 mr-1.5" />
                Stop
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Bug className="w-3.5 h-3.5" />
            <span>Dry Run: OFF</span>
            <span className="text-slate-600">|</span>
            <span>Auto-Rollback: ON</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function LogIcon({ level }: { level: LogEntry['level'] }) {
  switch (level) {
    case 'info':
      return <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5" />;
    case 'warning':
      return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5" />;
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5" />;
    case 'success':
      return <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5" />;
    default:
      return <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5" />;
  }
}

function StatusBadge({ status }: { status: ScriptEntry['status'] }) {
  const config = {
    pending: { label: 'Pendiente', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
    running: { label: 'Ejecutando', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    completed: { label: 'Completado', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    failed: { label: 'Error', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  };

  const { label, color } = config[status];

  return (
    <Badge variant="outline" className={cn('text-[10px]', color)}>
      {label}
    </Badge>
  );
}

export default ScriptConsolePanel;
