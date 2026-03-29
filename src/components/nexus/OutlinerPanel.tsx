'use client';

import { useNexusStore } from '@/store/nexus-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronRight, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock,
  Box,
  Lightbulb,
  Camera,
  Layers,
  Plus,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function OutlinerPanel() {
  const {
    currentScene,
    selectObject,
    clearSelection,
    addObject,
    removeObject,
    toggleObjectVisibility,
    toggleObjectLock,
  } = useNexusStore();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['scene-root']));

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getObjectIcon = (type: string) => {
    switch (type) {
      case 'mesh': return <Box className="w-3.5 h-3.5 text-holo-cyan" />;
      case 'light': return <Lightbulb className="w-3.5 h-3.5 text-holo-yellow" />;
      case 'camera': return <Camera className="w-3.5 h-3.5 text-holo-magenta" />;
      case 'empty': return <Layers className="w-3.5 h-3.5 text-muted-foreground" />;
      default: return <Box className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const handleAddObject = () => {
    const primitiveTypes = ['primitive-box', 'primitive-sphere', 'primitive-torus'] as const;
    const objectIndex = currentScene.objects.length;
    const column = (objectIndex % 4) - 1.5;
    const row = Math.floor(objectIndex / 4);
    const newObject = {
      name: `Object_${objectIndex + 1}`,
      type: 'mesh' as const,
      dataBlockId: primitiveTypes[objectIndex % primitiveTypes.length],
      transform: {
        position: [column * 1.8, 0.6, row * 1.8] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
      },
      children: [],
      visible: true,
      locked: false,
    };
    addObject(newObject);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-border/30 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Outliner</h2>
        <div className="flex gap-1">
          <button
            onClick={handleAddObject}
            className="p-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (currentScene.activeObject) {
                removeObject(currentScene.activeObject);
              }
            }}
            className="p-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-destructive transition-colors"
            disabled={!currentScene.activeObject}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scene Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Scene Root */}
          <div className="mb-1">
            <button
              onClick={() => toggleFolder('scene-root')}
              className="flex items-center gap-1 w-full text-left px-2 py-1 rounded hover:bg-secondary/50 transition-colors"
            >
              {expandedFolders.has('scene-root') ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
              <Layers className="w-4 h-4 text-holo-purple" />
              <span className="text-xs font-medium ml-1">{currentScene.name}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {currentScene.objects.length} objects
              </span>
            </button>

            {/* Objects List */}
            {expandedFolders.has('scene-root') && (
              <div className="ml-4 mt-1 space-y-0.5">
                {currentScene.objects.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                    No objects in scene
                  </p>
                ) : (
                  currentScene.objects.map((obj) => (
                    <div
                      key={obj.id}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-all',
                        currentScene.selectedObjects.includes(obj.id)
                          ? 'bg-holo-cyan/20 text-holo-cyan'
                          : 'hover:bg-secondary/50 text-foreground'
                      )}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          selectObject(obj.id, true);
                        } else {
                          selectObject(obj.id);
                        }
                      }}
                    >
                      {getObjectIcon(obj.type)}
                      <span className="text-xs flex-1 truncate">{obj.name}</span>
                      
                      {/* Visibility Toggle */}
                      <button
                        className="p-0.5 rounded hover:bg-background/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleObjectVisibility(obj.id);
                        }}
                      >
                        {obj.visible ? (
                          <Eye className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-muted-foreground/50" />
                        )}
                      </button>

                      {/* Lock Toggle */}
                      <button
                        className="p-0.5 rounded hover:bg-background/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleObjectLock(obj.id);
                        }}
                      >
                        {obj.locked ? (
                          <Lock className="w-3 h-3 text-holo-orange" />
                        ) : (
                          <Unlock className="w-3 h-3 text-muted-foreground/50" />
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer Stats */}
      <div className="p-2 border-t border-border/30 text-[10px] text-muted-foreground flex justify-between">
        <span>Selected: {currentScene.selectedObjects.length}</span>
        <span>Total: {currentScene.objects.length}</span>
      </div>
    </div>
  );
}
