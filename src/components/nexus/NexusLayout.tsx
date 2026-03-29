'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useNexusStore, WorkspaceType } from '@/store/nexus-store';
import { AIChatPanel } from './AIChatPanel';
import { ModulesPanel } from './ModulesPanel';
import { Viewport3D } from './Viewport3D';
import { OutlinerPanel } from './OutlinerPanel';
import { SettingsPanel } from './SettingsPanel';
import { AICommandPanel } from './AICommandPanel';
import { ScriptConsolePanel } from './ScriptConsolePanel';
import { ExecutionTracePanel } from './ExecutionTracePanel';
import { CharacterBuilderDialog } from '@/components/character-builder/CharacterBuilderDialog';
import { SceneProjectsDialog } from './SceneProjectsDialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PanelLeftClose,
  PanelRightClose,
  PanelBottomClose,
  PanelLeft,
  PanelRight,
  PanelBottom,
  Play,
  Pause,
  Settings,
  HelpCircle,
  Sparkles,
  Layers,
  Box,
  Zap,
  Palette,
  Brush,
  Bone,
  Film,
  Globe,
  Code,
  Bug,
  LayoutGrid,
  Network,
  User,
  Terminal,
  Activity,
  Wand2,
  Boxes,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const workspaces: { id: WorkspaceType; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'modeling', name: 'Modeling', icon: Box },
  { id: 'sculpting', name: 'Sculpting', icon: Brush },
  { id: 'rigging', name: 'Rigging', icon: Bone },
  { id: 'animation', name: 'Animation', icon: Film },
  { id: 'shading', name: 'Shading', icon: Palette },
  { id: 'texturing', name: 'Texturing', icon: Layers },
  { id: 'vfx', name: 'VFX', icon: Sparkles },
  { id: 'scripting', name: 'Scripting', icon: Code },
];

export function NexusLayout() {
  const { 
    panels, 
    togglePanel, 
    engineName, 
    version,
    activeModule,
    editorMode,
    setEditorMode,
    activeWorkspace,
    setActiveWorkspace,
  } = useNexusStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [rightPanelTab, setRightPanelTab] = useState<'properties' | 'settings'>('properties');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-12 bg-secondary/30 border-b border-border/30 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          {/* Logo and Title */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-holo-cyan to-holo-magenta flex items-center justify-center animate-pulse">
              <Sparkles className="w-4 h-4 text-background" />
            </div>
            <div>
              <h1 className="text-sm font-bold holo-text">{engineName}</h1>
              <p className="text-[10px] text-muted-foreground">v{version}</p>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center gap-1 ml-4">
            {(['object', 'edit', 'sculpt'] as const).map((mode) => (
              <Button
                key={mode}
                variant="ghost"
                size="sm"
                className={cn(
                  'text-xs px-3 h-7',
                  editorMode === mode 
                    ? 'bg-holo-cyan/20 text-holo-cyan' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setEditorMode(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Center - Playback Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 border-border/50"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-holo-orange" />
            ) : (
              <Play className="w-4 h-4 text-holo-green" />
            )}
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            {Math.floor(currentTime / 60).toString().padStart(2, '0')}:
            {(currentTime % 60).toString().padStart(2, '0')}
          </span>
          <span className="text-xs text-muted-foreground">| 60 FPS</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <CharacterBuilderDialog 
            trigger={
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 gap-1.5 text-xs bg-holo-magenta/10 hover:bg-holo-magenta/20 text-holo-magenta border border-holo-magenta/30"
              >
                <User className="w-4 h-4" />
                Character
              </Button>
            }
          />
          <SceneProjectsDialog
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs bg-holo-cyan/10 hover:bg-holo-cyan/20 text-holo-cyan border border-holo-cyan/30"
              >
                <Layers className="w-4 h-4" />
                Scenes
              </Button>
            }
          />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
          >
            <Link href="/modular-lab">
              <Boxes className="w-4 h-4" />
              Modular Lab
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={() => setRightPanelTab(rightPanelTab === 'settings' ? 'properties' : 'settings')}
          >
            <Settings className={cn("w-4 h-4", rightPanelTab === 'settings' ? "text-holo-cyan" : "text-muted-foreground")} />
          </Button>
        </div>
      </header>

      {/* Workspace Tabs */}
      <div className="h-10 bg-secondary/20 border-b border-border/30 flex items-center px-2 shrink-0 overflow-x-auto">
        {workspaces.map((workspace) => {
          const Icon = workspace.icon;
          return (
            <Button
              key={workspace.id}
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 px-3 text-xs gap-1.5 shrink-0',
                activeWorkspace === workspace.id
                  ? 'bg-holo-magenta/20 text-holo-magenta border-b-2 border-holo-magenta rounded-none'
                  : 'text-muted-foreground hover:text-foreground rounded-none'
              )}
              onClick={() => setActiveWorkspace(workspace.id)}
            >
              <Icon className="w-3.5 h-3.5" />
              {workspace.name}
            </Button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Modules & Outliner */}
        {panels.left.visible && (
          <aside 
            className="border-r border-border/30 bg-secondary/10 shrink-0 flex flex-col"
            style={{ width: panels.left.width }}
          >
            <Tabs defaultValue="modules" className="flex-1 flex flex-col">
              <TabsList className="h-9 bg-secondary/30 border-b border-border/30 rounded-none px-2">
                <TabsTrigger 
                  value="modules" 
                  className="text-xs data-[state=active]:bg-holo-cyan/20 data-[state=active]:text-holo-cyan"
                >
                  <LayoutGrid className="w-3.5 h-3.5 mr-1" />
                  Módulos
                </TabsTrigger>
                <TabsTrigger 
                  value="outliner"
                  className="text-xs data-[state=active]:bg-holo-cyan/20 data-[state=active]:text-holo-cyan"
                >
                  <Network className="w-3.5 h-3.5 mr-1" />
                  Escena
                </TabsTrigger>
              </TabsList>
              <TabsContent value="modules" className="flex-1 m-0 overflow-hidden">
                <ModulesPanel />
              </TabsContent>
              <TabsContent value="outliner" className="flex-1 m-0 overflow-hidden">
                <OutlinerPanel />
              </TabsContent>
            </Tabs>
          </aside>
        )}

        {/* Center - Viewport or Scripting Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeWorkspace === 'scripting' ? (
            /* Workspace multi-script */
            <div className="flex-1 flex flex-col p-2 gap-2 bg-background">
              {/* Top row: AI Command + Script Console */}
              <div className="flex-1 flex gap-2 min-h-0">
                <div className="flex-1 min-w-0">
                  <AICommandPanel />
                </div>
                <div className="flex-1 min-w-0">
                  <ScriptConsolePanel />
                </div>
              </div>
              
              {/* Bottom row: Execution Trace */}
              <div className="h-[280px] shrink-0">
                <ExecutionTracePanel />
              </div>
            </div>
          ) : (
            /* Standard 3D Viewport */
            <>
              {/* Viewport */}
              <div className="flex-1 relative">
                <Viewport3D />
                
                {/* Panel Toggle Buttons */}
                <div className="absolute top-2 left-2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80"
                    onClick={() => togglePanel('left')}
                  >
                    {panels.left.visible ? (
                      <PanelLeftClose className="w-4 h-4" />
                    ) : (
                      <PanelLeft className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 bg-secondary/50 hover:bg-secondary/80"
                    onClick={() => togglePanel('right')}
                  >
                    {panels.right.visible ? (
                      <PanelRightClose className="w-4 h-4" />
                    ) : (
                      <PanelRight className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Bottom Panel - Chat/AI */}
              {panels.bottom.visible && (
                <div 
                  className="border-t border-border/30 bg-secondary/10 shrink-0"
                  style={{ height: panels.bottom.height }}
                >
                  <div className="h-full flex items-center justify-between px-3 py-1 border-b border-border/20 bg-secondary/30">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-holo-cyan animate-pulse" />
                      <span className="text-sm font-medium">Asistente del motor</span>
                      <span className="text-[10px] text-holo-cyan bg-holo-cyan/20 px-2 py-0.5 rounded-full">
                        Activo
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => togglePanel('bottom')}
                    >
                      <PanelBottomClose className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="h-[calc(100%-32px)]">
                    <AIChatPanel />
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* Right Panel - Properties/Settings */}
        {panels.right.visible && (
          <aside 
            className="border-l border-border/30 bg-secondary/10 shrink-0"
            style={{ width: panels.right.width }}
          >
            <Tabs value={rightPanelTab} className="h-full flex flex-col">
              <TabsList className="h-9 bg-secondary/30 border-b border-border/30 rounded-none px-2">
                <TabsTrigger 
                  value="properties" 
                  onClick={() => setRightPanelTab('properties')}
                  className="text-xs data-[state=active]:bg-holo-magenta/20 data-[state=active]:text-holo-magenta"
                >
                  <Zap className="w-3.5 h-3.5 mr-1" />
                  Propiedades
                </TabsTrigger>
                <TabsTrigger 
                  value="settings"
                  onClick={() => setRightPanelTab('settings')}
                  className="text-xs data-[state=active]:bg-holo-magenta/20 data-[state=active]:text-holo-magenta"
                >
                  <Settings className="w-3.5 h-3.5 mr-1" />
                  Config
                </TabsTrigger>
              </TabsList>
              <TabsContent value="properties" className="flex-1 m-0 overflow-hidden">
                <PropertiesPanel />
              </TabsContent>
              <TabsContent value="settings" className="flex-1 m-0 overflow-hidden">
                <SettingsPanel />
              </TabsContent>
            </Tabs>
          </aside>
        )}
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-6 bg-secondary/30 border-t border-border/30 flex items-center justify-between px-4 text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-holo-green animate-pulse" />
            Sistema Activo
          </span>
          <span>Módulo: {activeModule}</span>
          <span>Workspace: {activeWorkspace}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Memoria: 1.2 GB</span>
          <span>GPU: 45%</span>
          <span>CPU: 12%</span>
        </div>
      </footer>
    </div>
  );
}

function PropertiesPanel() {
  const { activeModule, currentScene } = useNexusStore();
  
  const activeObject = currentScene.objects.find(o => o.id === currentScene.activeObject);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border/30">
        <h2 className="text-sm font-semibold text-foreground">Propiedades</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {activeObject ? activeObject.name : 'Ningún objeto seleccionado'}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {activeObject ? (
            <>
              <PropertySection title="Object">
                <PropertyRow label="Type" value={activeObject.type} />
                <PropertyRow label="Visible" value={activeObject.visible ? 'Yes' : 'No'} />
                <PropertyRow label="Locked" value={activeObject.locked ? 'Yes' : 'No'} />
                <PropertyRow label="Primitive" value={activeObject.dataBlockId ?? 'default'} />
              </PropertySection>

              {/* Transform Section */}
              <PropertySection title="Transform">
                <PropertyRow label="Position" value={activeObject.transform.position.map(n => n.toFixed(2)).join(', ')} />
                <PropertyRow label="Rotation" value={activeObject.transform.rotation.map(n => (n * 180 / Math.PI).toFixed(0) + '°').join(', ')} />
                <PropertyRow label="Scale" value={activeObject.transform.scale.map(n => n.toFixed(2)).join(', ')} />
              </PropertySection>

              {/* Material Section */}
              <PropertySection title="Material">
                <PropertyRow label="Base Color" value="#00d4ff" color="#00d4ff" />
                <PropertyRow label="Metallic" value="0.8" />
                <PropertyRow label="Roughness" value="0.2" />
                <PropertyRow label="Emissive" value="0.1" />
              </PropertySection>

              {/* Physics Section */}
              <PropertySection title="Physics">
                <PropertyRow label="Mass" value="1.0 kg" />
                <PropertyRow label="Friction" value="0.5" />
                <PropertyRow label="Bounce" value="0.3" />
              </PropertySection>

              {/* Components Section */}
              <PropertySection title="Components">
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-holo-cyan/20 text-holo-cyan">
                    Mesh Renderer
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-holo-magenta/20 text-holo-magenta">
                    Collider
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-holo-orange/20 text-holo-orange">
                    Rigid Body
                  </span>
                </div>
              </PropertySection>

              {/* Quick Actions */}
              <div className="space-y-2">
                <Button className="w-full bg-holo-cyan/20 hover:bg-holo-cyan/30 text-holo-cyan border border-holo-cyan/30">
                  <Box className="w-4 h-4 mr-2" />
                  Añadir Componente
                </Button>
                <Button className="w-full bg-holo-magenta/20 hover:bg-holo-magenta/30 text-holo-magenta border border-holo-magenta/30">
                  <Zap className="w-4 h-4 mr-2" />
                  Aplicar con IA
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Box className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Selecciona un objeto para ver sus propiedades
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function PropertySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">
        {title}
      </h3>
      <div className="space-y-1 rounded-lg bg-secondary/30 p-2">
        {children}
      </div>
    </div>
  );
}

function PropertyRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-mono', color && `text-[${color}]`)} style={color ? { color } : {}}>
        {value}
      </span>
    </div>
  );
}
