'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Activity,
  Layers,
  ArrowRightLeft,
  Eye,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface ActionTrace {
  id: string;
  operation: string;
  target?: string;
  status: 'completed' | 'failed' | 'rolled_back';
  duration: number;
  timestamp: Date;
  language: string;
  changes: ChangeRecord[];
}

interface ExecutionRecord {
  id: string;
  timestamp: Date;
  source: 'ai' | 'manual' | 'script';
  status: 'completed' | 'failed' | 'rolled_back';
  duration: number;
  actions: ActionTrace[];
  canRollback: boolean;
}

interface ChangeRecord {
  id: string;
  type: 'create' | 'update' | 'delete';
  targetType: string;
  targetId: string;
  property?: string;
  oldValue?: string;
  newValue?: string;
}

// ============================================
// EXECUTION TRACE PANEL
// ============================================

export function ExecutionTracePanel() {
  const [executions, setExecutions] = useState<ExecutionRecord[]>(getDemoExecutions());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'history' | 'changes'>('history');

  // Toggle expansion
  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Rollback execution
  const handleRollback = (executionId: string) => {
    setExecutions(prev => prev.map(exec => 
      exec.id === executionId 
        ? { 
            ...exec, 
            status: 'rolled_back', 
            canRollback: false,
            actions: exec.actions.map(a => ({ ...a, status: 'rolled_back' as const }))
          }
        : exec
    ));
  };

  // Delete execution record
  const handleDelete = (executionId: string) => {
    setExecutions(prev => prev.filter(exec => exec.id !== executionId));
  };

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Format time
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
          <div className="p-1.5 rounded-lg bg-purple-500/20">
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-sm font-medium text-cyan-100">Execution Trace</span>
        </div>

        {/* Tab selector */}
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setSelectedTab('history')}
            className={cn(
              'px-2.5 py-1 text-xs rounded transition-colors',
              selectedTab === 'history'
                ? 'bg-purple-500/20 text-purple-300'
                : 'text-slate-400 hover:text-purple-300'
            )}
          >
            History
          </button>
          <button
            onClick={() => setSelectedTab('changes')}
            className={cn(
              'px-2.5 py-1 text-xs rounded transition-colors',
              selectedTab === 'changes'
                ? 'bg-purple-500/20 text-purple-300'
                : 'text-slate-400 hover:text-purple-300'
            )}
          >
            Changes
          </button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-3">
        {selectedTab === 'history' ? (
          <HistoryView
            executions={executions}
            expandedId={expandedId}
            onToggle={toggleExpand}
            onRollback={handleRollback}
            onDelete={handleDelete}
            formatDuration={formatDuration}
            formatTime={formatTime}
          />
        ) : (
          <ChangesView executions={executions} />
        )}
      </ScrollArea>

      {/* Stats footer */}
      <div className="p-3 border-t border-cyan-500/20 bg-slate-900/50">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              <span className="text-slate-400">
                {executions.filter(e => e.status === 'completed').length} completados
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-slate-400">
                {executions.filter(e => e.status === 'failed').length} fallidos
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-slate-400">
                {executions.filter(e => e.status === 'rolled_back').length} revertidos
              </span>
            </div>
          </div>
          <span className="text-slate-500">
            Total: {executions.length} ejecuciones
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// HISTORY VIEW
// ============================================

interface HistoryViewProps {
  executions: ExecutionRecord[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onRollback: (id: string) => void;
  onDelete: (id: string) => void;
  formatDuration: (ms: number) => string;
  formatTime: (date: Date) => string;
}

function HistoryView({
  executions,
  expandedId,
  onToggle,
  onRollback,
  onDelete,
  formatDuration,
  formatTime,
}: HistoryViewProps) {
  if (executions.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No hay ejecuciones registradas</p>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {executions.map((execution) => (
        <motion.div
          key={execution.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="mb-3 bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-800/50 transition-colors"
            onClick={() => onToggle(execution.id)}
          >
            <div className="flex items-center gap-3">
              {expandedId === execution.id ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
              
              <StatusIcon status={execution.status} />
              
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-200">
                    {execution.actions.length} acciones
                  </span>
                  <SourceBadge source={execution.source} />
                </div>
                <span className="text-xs text-slate-500">
                  {formatTime(execution.timestamp)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                {formatDuration(execution.duration)}
              </Badge>
              
              {execution.canRollback && execution.status === 'completed' && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRollback(execution.id);
                  }}
                  className="h-6 w-6 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              )}
              
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(execution.id);
                }}
                className="h-6 w-6 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Expanded content */}
          <AnimatePresence>
            {expandedId === execution.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-slate-700/50"
              >
                <div className="p-3 space-y-2">
                  {execution.actions.map((action) => (
                    <div
                      key={action.id}
                      className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <StatusIcon status={action.status} size="sm" />
                        <span className="text-xs text-slate-300">{action.operation}</span>
                        {action.target && (
                          <>
                            <ArrowRightLeft className="w-3 h-3 text-slate-600" />
                            <span className="text-xs text-cyan-400">{action.target}</span>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-400">
                          {action.language}
                        </Badge>
                        <span className="text-[10px] text-slate-500">
                          {formatDuration(action.duration)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

// ============================================
// CHANGES VIEW
// ============================================

interface ChangesViewProps {
  executions: ExecutionRecord[];
}

function ChangesView({ executions }: ChangesViewProps) {
  // Aggregate all changes
  const allChanges = executions.flatMap(exec => 
    exec.actions.flatMap(action => 
      action.changes.map(change => ({
        ...change,
        executionId: exec.id,
        timestamp: exec.timestamp,
      }))
    )
  );

  if (allChanges.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No hay cambios registrados</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {allChanges.map((change) => (
        <div
          key={change.id}
          className="flex items-center justify-between p-2 bg-slate-800/30 rounded border border-slate-700/50"
        >
          <div className="flex items-center gap-2">
            <ChangeTypeIcon type={change.type} />
            <div>
              <span className="text-xs text-slate-300">
                {change.targetType}: <span className="text-cyan-400">{change.targetId}</span>
              </span>
              {change.property && (
                <p className="text-[10px] text-slate-500">{change.property}</p>
              )}
            </div>
          </div>
          
          {change.oldValue && change.newValue && (
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-red-400">{change.oldValue}</span>
              <span className="text-slate-500">→</span>
              <span className="text-green-400">{change.newValue}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function StatusIcon({ status, size = 'md' }: { status: ExecutionRecord['status']; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  
  switch (status) {
    case 'completed':
      return <CheckCircle className={cn(sizeClass, 'text-green-400')} />;
    case 'failed':
      return <XCircle className={cn(sizeClass, 'text-red-400')} />;
    case 'rolled_back':
      return <RotateCcw className={cn(sizeClass, 'text-yellow-400')} />;
    default:
      return null;
  }
}

function SourceBadge({ source }: { source: ExecutionRecord['source'] }) {
  const config = {
    ai: { label: 'AI', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    manual: { label: 'Manual', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    script: { label: 'Script', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  };

  const { label, color } = config[source];

  return (
    <Badge variant="outline" className={cn('text-[10px]', color)}>
      {label}
    </Badge>
  );
}

function ChangeTypeIcon({ type }: { type: ChangeRecord['type'] }) {
  switch (type) {
    case 'create':
      return <div className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center">
        <span className="text-green-400 text-xs">+</span>
      </div>;
    case 'update':
      return <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center">
        <span className="text-blue-400 text-xs">~</span>
      </div>;
    case 'delete':
      return <div className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center">
        <span className="text-red-400 text-xs">−</span>
      </div>;
    default:
      return null;
  }
}

// ============================================
// DEMO DATA
// ============================================

function getDemoExecutions(): ExecutionRecord[] {
  return [
    {
      id: 'exec_1',
      timestamp: new Date(Date.now() - 60000),
      source: 'ai',
      status: 'completed',
      duration: 1523,
      canRollback: true,
      actions: [
        {
          id: 'action_1_1',
          operation: 'spawn_character',
          target: 'Warrior',
          status: 'completed',
          duration: 234,
          timestamp: new Date(Date.now() - 60000),
          language: 'lua',
          changes: [
            { id: 'c1', type: 'create', targetType: 'entity', targetId: 'entity_001' },
          ],
        },
        {
          id: 'action_1_2',
          operation: 'play_animation',
          target: 'entity_001',
          status: 'completed',
          duration: 89,
          timestamp: new Date(Date.now() - 59000),
          language: 'lua',
          changes: [
            { id: 'c2', type: 'update', targetType: 'property', targetId: 'entity_001', property: 'Animation.currentAnimation', oldValue: 'none', newValue: 'idle' },
          ],
        },
        {
          id: 'action_1_3',
          operation: 'spawn_particle',
          target: 'fire_sword',
          status: 'completed',
          duration: 156,
          timestamp: new Date(Date.now() - 58000),
          language: 'lua',
          changes: [
            { id: 'c3', type: 'create', targetType: 'particle', targetId: 'particle_001' },
          ],
        },
      ],
    },
    {
      id: 'exec_2',
      timestamp: new Date(Date.now() - 30000),
      source: 'script',
      status: 'completed',
      duration: 2341,
      canRollback: true,
      actions: [
        {
          id: 'action_2_1',
          operation: 'batch_operation',
          status: 'completed',
          duration: 2341,
          timestamp: new Date(Date.now() - 30000),
          language: 'python',
          changes: [],
        },
      ],
    },
    {
      id: 'exec_3',
      timestamp: new Date(Date.now() - 10000),
      source: 'ai',
      status: 'rolled_back',
      duration: 892,
      canRollback: false,
      actions: [
        {
          id: 'action_3_1',
          operation: 'spawn_character',
          status: 'rolled_back',
          duration: 892,
          timestamp: new Date(Date.now() - 10000),
          language: 'lua',
          changes: [],
        },
      ],
    },
  ];
}

export default ExecutionTracePanel;
