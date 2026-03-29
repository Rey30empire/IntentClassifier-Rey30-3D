'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Send, 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Lightbulb,
  History,
  Wand2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

// ============================================
// TYPES
// ============================================

interface CommandHistoryItem {
  id: string;
  input: string;
  explanation: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  timestamp: Date;
  suggestions?: string[];
}

// ============================================
// AI COMMAND PANEL
// ============================================

export function AICommandPanel() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CommandHistoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Example commands
  const exampleCommands = [
    'crea un guerrero en el centro con animación idle',
    'agrega partículas de fuego en la espada',
    'crea un mago en x 5 y 0 z 3',
    'mueve el personaje a la izquierda',
    'genera partículas de magia',
  ];

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Handle command submission
  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;

    const command = input.trim();
    setInput('');
    setIsProcessing(true);

    // Add to history
    const historyItem: CommandHistoryItem = {
      id: `cmd_${Date.now()}`,
      input: command,
      explanation: '',
      status: 'pending',
      timestamp: new Date(),
    };

    setHistory(prev => [...prev, historyItem]);

    try {
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate explanation based on command
      const explanation = generateExplanation(command);
      const cmdSuggestions = generateSuggestions(command);

      // Update history item
      setHistory(prev => prev.map(item => 
        item.id === historyItem.id 
          ? { 
              ...item, 
              explanation, 
              status: 'completed',
              suggestions: cmdSuggestions,
            }
          : item
      ));

      setSuggestions(cmdSuggestions);

    } catch (error) {
      setHistory(prev => prev.map(item => 
        item.id === historyItem.id 
          ? { 
              ...item, 
              explanation: 'Error al procesar el comando',
              status: 'failed',
            }
          : item
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Apply example command
  const applyExample = (command: string) => {
    setInput(command);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900/50 to-slate-900/80 backdrop-blur-sm border border-cyan-500/20 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-cyan-500/20 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/20">
            <Wand2 className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-sm font-medium text-cyan-100">Comandos</span>
        </div>
        <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-300">
          Multi-Script
        </Badge>
      </div>

      {/* History */}
      <ScrollArea ref={scrollRef} className="flex-1 p-3 space-y-3">
        {history.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Escribe un comando en lenguaje natural</p>
            <p className="text-xs mt-1">Ejemplo: "crea un guerrero en el centro"</p>
          </div>
        ) : (
          <AnimatePresence>
            {history.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-2"
              >
                {/* User input */}
                <div className="flex items-start gap-2">
                  <div className="p-1.5 rounded bg-cyan-500/20 mt-0.5">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                  </div>
                  <div className="flex-1 bg-slate-800/50 rounded-lg p-2.5 border border-cyan-500/10">
                    <p className="text-sm text-cyan-100">{item.input}</p>
                  </div>
                </div>

                {/* AI response */}
                {item.status !== 'pending' && (
                  <div className="flex items-start gap-2 ml-4">
                    <StatusIcon status={item.status} />
                    <div className="flex-1 bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
                      <p className="text-sm text-slate-300">{item.explanation}</p>
                      
                      {/* Suggestions */}
                      {item.suggestions && item.suggestions.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-700/50">
                          <p className="text-xs text-slate-400 mb-1">Sugerencias:</p>
                          {item.suggestions.map((suggestion, i) => (
                            <button
                              key={i}
                              onClick={() => applyExample(suggestion)}
                              className="text-xs text-cyan-400 hover:text-cyan-300 block hover:underline"
                            >
                              → {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </ScrollArea>

      {/* Example commands */}
      <div className="px-3 py-2 border-t border-cyan-500/10 bg-slate-900/30">
        <div className="flex items-center gap-1 mb-2">
          <Lightbulb className="w-3 h-3 text-yellow-400" />
          <span className="text-xs text-slate-400">Ejemplos:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {exampleCommands.slice(0, 3).map((cmd, i) => (
            <button
              key={i}
              onClick={() => applyExample(cmd)}
              className="text-xs px-2 py-1 rounded bg-slate-800/50 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-cyan-500/20 bg-slate-900/50">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un comando..."
              rows={2}
              className="w-full bg-slate-800/50 border border-cyan-500/20 rounded-lg px-3 py-2 text-sm text-cyan-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 resize-none"
              disabled={isProcessing}
            />
          </div>
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!input.trim() || isProcessing}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border-0"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function StatusIcon({ status }: { status: CommandHistoryItem['status'] }) {
  switch (status) {
    case 'pending':
      return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin mt-0.5" />;
    case 'executing':
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin mt-0.5" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400 mt-0.5" />;
    default:
      return null;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateExplanation(command: string): string {
  const lowerCmd = command.toLowerCase();

  if (lowerCmd.includes('crea') || lowerCmd.includes('spawn') || lowerCmd.includes('create')) {
    if (lowerCmd.includes('guerrero') || lowerCmd.includes('warrior')) {
      return '✓ Creando entidad tipo "guerrero" en la escena' + 
             (lowerCmd.includes('idle') ? ' con animación idle activa' : '') +
             (lowerCmd.includes('fuego') ? ' y partículas de fuego' : '');
    }
    if (lowerCmd.includes('mago') || lowerCmd.includes('mage')) {
      return '✓ Creando entidad tipo "mago" en la posición especificada';
    }
    return '✓ Creando nueva entidad en la escena';
  }

  if (lowerCmd.includes('animaci') || lowerCmd.includes('animation')) {
    return '✓ Reproduciendo animación en la entidad seleccionada';
  }

  if (lowerCmd.includes('partícula') || lowerCmd.includes('particle')) {
    return '✓ Generando efecto de partículas en la posición indicada';
  }

  if (lowerCmd.includes('mueve') || lowerCmd.includes('move')) {
    return '✓ Actualizando posición de la entidad';
  }

  if (lowerCmd.includes('corrige') || lowerCmd.includes('fix') || lowerCmd.includes('repair')) {
    return '✓ Ejecutando validación y corrección de la escena';
  }

  return '✓ Comando procesado correctamente';
}

function generateSuggestions(command: string): string[] {
  const suggestions: string[] = [];
  const lowerCmd = command.toLowerCase();

  if (lowerCmd.includes('crea') && !lowerCmd.includes('animaci')) {
    suggestions.push('agrega animación idle al personaje');
  }

  if (lowerCmd.includes('guerrero') && !lowerCmd.includes('partícula')) {
    suggestions.push('agrega partículas de fuego en la espada');
  }

  if (lowerCmd.includes('mago')) {
    suggestions.push('agrega partículas de magia');
  }

  return suggestions;
}

export default AICommandPanel;
