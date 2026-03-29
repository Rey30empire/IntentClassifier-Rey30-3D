'use client';

import { useNexusStore } from '@/store/nexus-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Settings, 
  Palette, 
  Zap, 
  Globe, 
  Volume2, 
  Layers,
  Sparkles,
  ChevronDown,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { engineModules } from '@/lib/engine/modules';

export function SettingsPanel() {
  const { settings, updateSettings, activeModule } = useNexusStore();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['general', 'render', 'ai'])
  );

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const activeModuleData = engineModules.find(m => m.id === activeModule);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/30">
        <h2 className="text-lg font-semibold text-foreground">Configuración</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Motor y preferencias de IA
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* General Section */}
          <SettingsSection
            id="general"
            title="General"
            icon={<Layers className="w-4 h-4" />}
            expanded={expandedSections.has('general')}
            onToggle={() => toggleSection('general')}
          >
            <div className="space-y-3">
              <SettingRow label="Tema">
                <select
                  value={settings.theme}
                  onChange={(e) => updateSettings({ theme: e.target.value as 'dark' | 'darker' })}
                  className="bg-secondary/50 border border-border/50 rounded px-2 py-1 text-xs w-full"
                >
                  <option value="dark">Dark</option>
                  <option value="darker">Darker</option>
                </select>
              </SettingRow>
              <SettingRow label="Mostrar Grid">
                <ToggleSwitch
                  checked={settings.showGrid}
                  onChange={(v) => updateSettings({ showGrid: v })}
                />
              </SettingRow>
              <SettingRow label="Mostrar Ejes">
                <ToggleSwitch
                  checked={settings.showAxes}
                  onChange={(v) => updateSettings({ showAxes: v })}
                />
              </SettingRow>
              <SettingRow label="Snap to Grid">
                <ToggleSwitch
                  checked={settings.snapToGrid}
                  onChange={(v) => updateSettings({ snapToGrid: v })}
                />
              </SettingRow>
              <SettingRow label="Grid Size">
                <Input
                  type="number"
                  value={settings.gridSize}
                  onChange={(e) => updateSettings({ gridSize: Number(e.target.value) })}
                  className="h-7 w-20 text-xs bg-secondary/50"
                />
              </SettingRow>
            </div>
          </SettingsSection>

          {/* Render Section */}
          <SettingsSection
            id="render"
            title="Renderizado"
            icon={<Palette className="w-4 h-4" />}
            expanded={expandedSections.has('render')}
            onToggle={() => toggleSection('render')}
          >
            <div className="space-y-3">
              <SettingRow label="Calidad">
                <select
                  value={settings.renderQuality}
                  onChange={(e) => updateSettings({ renderQuality: e.target.value as any })}
                  className="bg-secondary/50 border border-border/50 rounded px-2 py-1 text-xs w-full"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="ultra">Ultra</option>
                </select>
              </SettingRow>
              <SettingRow label="Anti-aliasing">
                <select className="bg-secondary/50 border border-border/50 rounded px-2 py-1 text-xs w-full">
                  <option>2x MSAA</option>
                  <option>4x MSAA</option>
                  <option>8x MSAA</option>
                </select>
              </SettingRow>
              <SettingRow label="Sombras">
                <select className="bg-secondary/50 border border-border/50 rounded px-2 py-1 text-xs w-full">
                  <option>Soft Shadows</option>
                  <option>Hard Shadows</option>
                  <option>Disabled</option>
                </select>
              </SettingRow>
            </div>
          </SettingsSection>

          {/* AI Section */}
          <SettingsSection
            id="ai"
            title="Inteligencia Artificial"
            icon={<Sparkles className="w-4 h-4 text-holo-cyan" />}
            expanded={expandedSections.has('ai')}
            onToggle={() => toggleSection('ai')}
          >
            <div className="space-y-3">
              <SettingRow label="Proveedor IA">
                <select
                  value={settings.aiProvider}
                  onChange={(e) => updateSettings({ aiProvider: e.target.value as any })}
                  className="bg-secondary/50 border border-border/50 rounded px-2 py-1 text-xs w-full"
                >
                  <option value="gpt-4">GPT-4</option>
                  <option value="claude">Claude</option>
                  <option value="gemini">Gemini</option>
                  <option value="local">Local Model</option>
                </select>
              </SettingRow>
              <SettingRow label="API Key">
                <Input
                  type="password"
                  placeholder="sk-..."
                  className="h-7 text-xs bg-secondary/50"
                />
              </SettingRow>
              <SettingRow label="Auto-sugerir">
                <ToggleSwitch checked={true} onChange={() => {}} />
              </SettingRow>
              <SettingRow label="Historial">
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Limpiar
                </Button>
              </SettingRow>
            </div>
          </SettingsSection>

          {/* Audio Section */}
          <SettingsSection
            id="audio"
            title="Audio"
            icon={<Volume2 className="w-4 h-4" />}
            expanded={expandedSections.has('audio')}
            onToggle={() => toggleSection('audio')}
          >
            <div className="space-y-3">
              <SettingRow label="Master Volume">
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="80"
                  className="w-24"
                />
              </SettingRow>
              <SettingRow label="SFX Volume">
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="100"
                  className="w-24"
                />
              </SettingRow>
              <SettingRow label="Music Volume">
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="60"
                  className="w-24"
                />
              </SettingRow>
            </div>
          </SettingsSection>

          {/* Active Module Info */}
          {activeModuleData && (
            <div className="mt-4 p-3 rounded-lg bg-secondary/30 border border-border/30">
              <h3 className="text-xs font-semibold text-foreground mb-2">
                Módulo Activo: {activeModuleData.name}
              </h3>
              <p className="text-[10px] text-muted-foreground mb-2">
                {activeModuleData.description}
              </p>
              <div className="flex flex-wrap gap-1">
                {activeModuleData.features.map((feature, i) => (
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
        </div>
      </ScrollArea>
    </div>
  );
}

function SettingsSection({ 
  id, 
  title, 
  icon, 
  expanded, 
  onToggle, 
  children 
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-secondary/20 border border-border/30 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-3 hover:bg-secondary/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </button>
      {expanded && (
        <div className="p-3 pt-0 border-t border-border/20">
          {children}
        </div>
      )}
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'w-10 h-5 rounded-full transition-colors relative',
        checked ? 'bg-holo-cyan' : 'bg-secondary'
      )}
    >
      <div
        className={cn(
          'absolute top-0.5 w-4 h-4 rounded-full bg-background transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}
