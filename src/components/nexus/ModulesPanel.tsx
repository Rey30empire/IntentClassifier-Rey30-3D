'use client';

import { useNexusStore } from '@/store/nexus-store';
import { engineModules } from '@/lib/engine/modules';
import { cn } from '@/lib/utils';
import {
  Activity,
  Settings,
  ChevronRight,
} from 'lucide-react';

export function ModulesPanel() {
  const { activeModule, setActiveModule, agentTasks } = useNexusStore();

  const colorMap: Record<string, string> = {
    'holo-cyan': 'border-holo-cyan/50 bg-holo-cyan/10 text-holo-cyan',
    'holo-magenta': 'border-holo-magenta/50 bg-holo-magenta/10 text-holo-magenta',
    'holo-orange': 'border-holo-orange/50 bg-holo-orange/10 text-holo-orange',
    'holo-purple': 'border-holo-purple/50 bg-holo-purple/10 text-holo-purple',
    'holo-green': 'border-holo-green/50 bg-holo-green/10 text-holo-green',
    'holo-blue': 'border-holo-blue/50 bg-holo-blue/10 text-holo-blue',
    'holo-yellow': 'border-holo-yellow/50 bg-holo-yellow/10 text-holo-yellow',
  };

  const glowMap: Record<string, string> = {
    'holo-cyan': 'hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]',
    'holo-magenta': 'hover:shadow-[0_0_20px_rgba(255,0,255,0.3)]',
    'holo-orange': 'hover:shadow-[0_0_20px_rgba(255,136,0,0.3)]',
    'holo-purple': 'hover:shadow-[0_0_20px_rgba(136,0,255,0.3)]',
    'holo-green': 'hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]',
    'holo-blue': 'hover:shadow-[0_0_20px_rgba(0,136,255,0.3)]',
    'holo-yellow': 'hover:shadow-[0_0_20px_rgba(255,255,0,0.3)]',
  };

  const pendingTasks = agentTasks.filter(t => t.status === 'pending' || t.status === 'processing');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/30">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-holo-cyan" />
          Engine Modules
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {pendingTasks.length > 0 ? (
            <span className="text-holo-orange">{pendingTasks.length} tareas activas</span>
          ) : (
            'Todos los sistemas operativos'
          )}
        </p>
      </div>

      {/* Modules Grid */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {engineModules.map((module) => {
          const Icon = module.icon;
          const isActive = activeModule === module.id;
          const moduleTasks = agentTasks.filter(t => t.module === module.id && t.status === 'processing');

          return (
            <button
              key={module.id}
              onClick={() => setActiveModule(module.id)}
              className={cn(
                'w-full p-3 rounded-lg border transition-all duration-300 text-left',
                'hover:scale-[1.02] active:scale-[0.98]',
                isActive
                  ? colorMap[module.color]
                  : 'border-border/30 bg-secondary/20 hover:bg-secondary/40',
                isActive && glowMap[module.color]
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  isActive ? 'bg-background/20' : 'bg-secondary/50'
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{module.name}</span>
                    {moduleTasks.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-holo-orange animate-pulse" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {module.description}
                  </p>
                </div>
                <ChevronRight className={cn(
                  'w-4 h-4 transition-transform',
                  isActive ? 'rotate-90' : 'text-muted-foreground'
                )} />
              </div>

              {isActive && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <div className="flex flex-wrap gap-1">
                    {module.features.slice(0, 3).map((feature, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-background/30"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border/30">
        <button className="w-full p-2 rounded-lg border border-border/30 bg-secondary/20 hover:bg-secondary/40 transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Settings className="w-4 h-4" />
          Configuración de Módulos
        </button>
      </div>
    </div>
  );
}
