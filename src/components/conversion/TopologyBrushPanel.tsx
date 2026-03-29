'use client';

/**
 * NEXUS Engine - Topology Brush Panel Component
 * 
 * Panel de interfaz para el sistema de pinceles topológicos.
 * Permite seleccionar, configurar y usar diferentes tipos de brushes.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Brush,
  Circle,
  Square,
  Triangle,
  Waves,
  ArrowUpDown,
  Move,
  Layers,
  Scissors,
  Pin,
  ScanLine,
  RefreshCw,
  Box,
  Eraser,
  HandMetal,
  Sparkles,
  Settings2,
  History,
  RotateCcw,
  Save,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import type {
  BrushType,
  Brush as BrushData,
  BrushSettings,
  FalloffType,
  SymmetryMode,
  TopologyAnalysis,
  BrushStroke,
} from '@/lib/engine/conversion/postprocessing/TopologyBrushSystem';

// ============================================
// BRUSH TYPE CONFIG
// ============================================

const BRUSH_CONFIG: Record<BrushType, { name: string; icon: React.ComponentType<{ className?: string }>; description: string; category: string }> = {
  smooth: { name: 'Smooth', icon: Waves, description: 'Smooth the surface', category: 'sculpt' },
  inflate: { name: 'Inflate', icon: ArrowUpDown, description: 'Push vertices outward', category: 'sculpt' },
  deflate: { name: 'Deflate', icon: ArrowUpDown, description: 'Pull vertices inward', category: 'sculpt' },
  grab: { name: 'Grab', icon: HandMetal, description: 'Drag vertices', category: 'transform' },
  crease: { name: 'Crease', icon: Layers, description: 'Create sharp creases', category: 'sculpt' },
  flatten: { name: 'Flatten', icon: Square, description: 'Flatten to a plane', category: 'sculpt' },
  pinch: { name: 'Pinch', icon: Pin, description: 'Pinch vertices together', category: 'sculpt' },
  mask: { name: 'Mask', icon: ScanLine, description: 'Paint mask', category: 'mask' },
  smooth_mask: { name: 'Smooth Mask', icon: Eraser, description: 'Smooth the mask', category: 'mask' },
  topology: { name: 'Topology', icon: Box, description: 'Modify topology', category: 'topology' },
  relax: { name: 'Relax', icon: RefreshCw, description: 'Relax vertex distribution', category: 'topology' },
  clay: { name: 'Clay', icon: Layers, description: 'Build up like clay', category: 'sculpt' },
  scrape: { name: 'Scrape', icon: Scissors, description: 'Scrape the surface', category: 'sculpt' },
  fill: { name: 'Fill', icon: Box, description: 'Fill depressions', category: 'sculpt' },
  elastic: { name: 'Elastic', icon: Sparkles, description: 'Elastic deformation', category: 'transform' },
};

const FALLOFF_OPTIONS: { value: FalloffType; label: string }[] = [
  { value: 'smooth', label: 'Smooth' },
  { value: 'constant', label: 'Constant' },
  { value: 'linear', label: 'Linear' },
  { value: 'sharp', label: 'Sharp' },
  { value: 'spike', label: 'Spike' },
  { value: 'dome', label: 'Dome' },
];

const SYMMETRY_OPTIONS: { value: SymmetryMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'x', label: 'X Axis' },
  { value: 'y', label: 'Y Axis' },
  { value: 'z', label: 'Z Axis' },
  { value: 'radial', label: 'Radial' },
];

// ============================================
// BRUSH SELECTOR COMPONENT
// ============================================

interface BrushSelectorProps {
  activeBrushType: BrushType;
  onBrushChange: (type: BrushType) => void;
  customBrushes?: BrushData[];
}

function BrushSelector({ activeBrushType, onBrushChange, customBrushes }: BrushSelectorProps) {
  const categories = useMemo(() => {
    const cats: Record<string, BrushType[]> = {
      sculpt: [],
      transform: [],
      mask: [],
      topology: [],
    };
    
    for (const [type, config] of Object.entries(BRUSH_CONFIG)) {
      cats[config.category]?.push(type as BrushType);
    }
    
    return cats;
  }, []);
  
  return (
    <div className="space-y-3">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Brushes</Label>
      
      {Object.entries(categories).map(([category, types]) => (
        <div key={category} className="space-y-1">
          <Label className="text-xs text-muted-foreground capitalize">{category}</Label>
          <div className="grid grid-cols-3 gap-1">
            {types.map((type) => {
              const config = BRUSH_CONFIG[type];
              const Icon = config.icon;
              const isActive = activeBrushType === type;
              
              return (
                <TooltipProvider key={type}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isActive ? 'default' : 'ghost'}
                        size="sm"
                        className={cn(
                          'h-10 flex flex-col items-center justify-center gap-0.5 p-1',
                          isActive && 'ring-2 ring-primary'
                        )}
                        onClick={() => onBrushChange(type)}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[10px] truncate w-full text-center">{config.name}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="font-medium">{config.name}</p>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// BRUSH SETTINGS PANEL
// ============================================

interface BrushSettingsPanelProps {
  settings: Partial<BrushSettings>;
  onSettingsChange: (settings: Partial<BrushSettings>) => void;
}

function BrushSettingsPanel({ settings, onSettingsChange }: BrushSettingsPanelProps) {
  const updateSetting = <K extends keyof BrushSettings>(key: K, value: BrushSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };
  
  return (
    <div className="space-y-4">
      {/* Size */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Size</Label>
          <span className="text-xs text-muted-foreground">{(settings.radius || 0.5).toFixed(2)}</span>
        </div>
        <Slider
          value={[settings.radius || 0.5]}
          min={0.05}
          max={3}
          step={0.01}
          onValueChange={([v]) => updateSetting('radius', v)}
        />
      </div>
      
      {/* Strength */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Strength</Label>
          <span className="text-xs text-muted-foreground">{((settings.strength || 0.5) * 100).toFixed(0)}%</span>
        </div>
        <Slider
          value={[settings.strength || 0.5]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={([v]) => updateSetting('strength', v)}
        />
      </div>
      
      {/* Inner Radius (for donut brush) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Inner Radius</Label>
          <span className="text-xs text-muted-foreground">{((settings.innerRadius || 0) * 100).toFixed(0)}%</span>
        </div>
        <Slider
          value={[settings.innerRadius || 0]}
          min={0}
          max={0.9}
          step={0.05}
          onValueChange={([v]) => updateSetting('innerRadius', v)}
        />
      </div>
      
      <Separator />
      
      {/* Falloff */}
      <div className="space-y-2">
        <Label className="text-xs">Falloff</Label>
        <Select
          value={settings.falloffType || 'smooth'}
          onValueChange={(v) => updateSetting('falloffType', v as FalloffType)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FALLOFF_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Falloff Preview */}
      <div className="h-8 w-full bg-muted rounded-md overflow-hidden">
        <svg viewBox="0 0 100 30" className="w-full h-full">
          <defs>
            <linearGradient id="falloffGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={getFalloffPath(settings.falloffType || 'smooth')}
            fill="url(#falloffGradient)"
            opacity={0.6}
          />
        </svg>
      </div>
      
      <Separator />
      
      {/* Direction */}
      <div className="space-y-2">
        <Label className="text-xs">Direction</Label>
        <div className="grid grid-cols-3 gap-1">
          {(['normal', 'view', 'x', 'y', 'z'] as const).map((dir) => (
            <Button
              key={dir}
              variant={settings.direction === dir ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs capitalize"
              onClick={() => updateSetting('direction', dir as BrushSettings['direction'])}
            >
              {dir}
            </Button>
          ))}
        </div>
      </div>
      
      <Separator />
      
      {/* Toggles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Accumulate</Label>
          <Switch
            checked={settings.accumulate ?? true}
            onCheckedChange={(v) => updateSetting('accumulate', v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Front Faces Only</Label>
          <Switch
            checked={settings.useFrontFacesOnly ?? true}
            onCheckedChange={(v) => updateSetting('useFrontFacesOnly', v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Preserve Volume</Label>
          <Switch
            checked={settings.preserveVolume ?? false}
            onCheckedChange={(v) => updateSetting('preserveVolume', v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Preserve Boundary</Label>
          <Switch
            checked={settings.preserveBoundary ?? true}
            onCheckedChange={(v) => updateSetting('preserveBoundary', v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Respect Mask</Label>
          <Switch
            checked={settings.respectMask ?? true}
            onCheckedChange={(v) => updateSetting('respectMask', v)}
          />
        </div>
      </div>
    </div>
  );
}

// Helper to generate falloff preview path
function getFalloffPath(type: FalloffType): string {
  const points: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const x = i;
    const t = i / 100;
    let y = 0;
    
    switch (type) {
      case 'constant':
        y = 25;
        break;
      case 'linear':
        y = 25 * (1 - t);
        break;
      case 'smooth':
        y = 25 * (1 - t * t * (3 - 2 * t));
        break;
      case 'sharp':
        y = t < 0.5 ? 25 : 0;
        break;
      case 'spike':
        y = 25 * Math.pow(1 - t, 2);
        break;
      case 'dome':
        y = 25 * Math.sqrt(Math.max(0, 1 - t * t));
        break;
    }
    
    if (i === 0) {
      points.push(`M ${x} ${30 - y}`);
    } else {
      points.push(`L ${x} ${30 - y}`);
    }
  }
  
  points.push('L 100 30 L 0 30 Z');
  return points.join(' ');
}

// ============================================
// SYMMETRY PANEL
// ============================================

interface SymmetryPanelProps {
  symmetryMode: SymmetryMode;
  symmetryOffset: number;
  onSymmetryChange: (mode: SymmetryMode, offset: number) => void;
}

function SymmetryPanel({ symmetryMode, symmetryOffset, onSymmetryChange }: SymmetryPanelProps) {
  return (
    <div className="space-y-3">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Symmetry</Label>
      
      <Select
        value={symmetryMode}
        onValueChange={(v) => onSymmetryChange(v as SymmetryMode, symmetryOffset)}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SYMMETRY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {symmetryMode !== 'none' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Offset</Label>
            <span className="text-xs text-muted-foreground">{symmetryOffset.toFixed(2)}</span>
          </div>
          <Slider
            value={[symmetryOffset]}
            min={-2}
            max={2}
            step={0.1}
            onValueChange={([v]) => onSymmetryChange(symmetryMode, v)}
          />
        </div>
      )}
      
      {symmetryMode === 'radial' && (
        <div className="p-2 bg-muted rounded-md">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>6-way radial symmetry</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// TOPOLOGY INFO PANEL
// ============================================

interface TopologyInfoPanelProps {
  analysis: TopologyAnalysis | null;
}

function TopologyInfoPanel({ analysis }: TopologyInfoPanelProps) {
  if (!analysis) {
    return (
      <div className="text-center text-muted-foreground text-xs py-4">
        No topology analysis available
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-muted rounded-md">
          <div className="text-lg font-bold">{analysis.vertexCount}</div>
          <div className="text-xs text-muted-foreground">Vertices</div>
        </div>
        <div className="p-2 bg-muted rounded-md">
          <div className="text-lg font-bold">{analysis.faceCount}</div>
          <div className="text-xs text-muted-foreground">Faces</div>
        </div>
        <div className="p-2 bg-muted rounded-md">
          <div className="text-lg font-bold">{analysis.triangleCount}</div>
          <div className="text-xs text-muted-foreground">Triangles</div>
        </div>
        <div className="p-2 bg-muted rounded-md">
          <div className="text-lg font-bold">{analysis.quadCount}</div>
          <div className="text-xs text-muted-foreground">Quads</div>
        </div>
      </div>
      
      <Separator />
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs">Quad Ratio</span>
          <Badge variant={analysis.quadRatio > 0.7 ? 'default' : 'secondary'}>
            {(analysis.quadRatio * 100).toFixed(0)}%
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs">Avg Valence</span>
          <Badge variant="outline">{analysis.averageValence.toFixed(1)}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs">Poles</span>
          <Badge variant={analysis.poleCount > 10 ? 'destructive' : 'secondary'}>
            {analysis.poleCount}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs">N-gons</span>
          <Badge variant={analysis.ngonCount > 0 ? 'destructive' : 'secondary'}>
            {analysis.ngonCount}
          </Badge>
        </div>
      </div>
      
      {analysis.issues.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Issues</Label>
            {analysis.issues.map((issue, i) => (
              <div
                key={i}
                className={cn(
                  'p-2 rounded-md text-xs',
                  issue.severity === 'error' && 'bg-destructive/10 text-destructive',
                  issue.severity === 'warning' && 'bg-yellow-500/10 text-yellow-600',
                  issue.severity === 'info' && 'bg-blue-500/10 text-blue-600'
                )}
              >
                {issue.description}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// STROKE HISTORY PANEL
// ============================================

interface StrokeHistoryPanelProps {
  strokes: BrushStroke[];
  onUndo: (strokeId: string) => void;
}

function StrokeHistoryPanel({ strokes, onUndo }: StrokeHistoryPanelProps) {
  if (strokes.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-xs py-4">
        No strokes recorded
      </div>
    );
  }
  
  return (
    <ScrollArea className="h-40">
      <div className="space-y-1">
        {[...strokes].reverse().map((stroke, i) => (
          <div
            key={stroke.id}
            className="flex items-center justify-between p-2 bg-muted rounded-md"
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                #{strokes.length - i}
              </Badge>
              <span className="text-xs capitalize">{stroke.brushType}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {stroke.totalVerticesAffected} verts
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onUndo(stroke.id)}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ============================================
// MASK PANEL
// ============================================

interface MaskPanelProps {
  isVisible: boolean;
  opacity: number;
  onToggleVisibility: () => void;
  onOpacityChange: (opacity: number) => void;
  onClearMask: () => void;
  onInvertMask: () => void;
}

function MaskPanel({
  isVisible,
  opacity,
  onToggleVisibility,
  onOpacityChange,
  onClearMask,
  onInvertMask,
}: MaskPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Mask</Label>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onToggleVisibility}
        >
          {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </Button>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Opacity</Label>
          <span className="text-xs text-muted-foreground">{(opacity * 100).toFixed(0)}%</span>
        </div>
        <Slider
          value={[opacity]}
          min={0}
          max={1}
          step={0.05}
          onValueChange={([v]) => onOpacityChange(v)}
        />
      </div>
      
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={onClearMask}
        >
          Clear
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={onInvertMask}
        >
          Invert
        </Button>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export interface TopologyBrushPanelProps {
  className?: string;
  onBrushChange?: (type: BrushType) => void;
  onSettingsChange?: (settings: Partial<BrushSettings>) => void;
  onSymmetryChange?: (mode: SymmetryMode, offset: number) => void;
  onMaskVisibilityChange?: (visible: boolean) => void;
  onMaskOpacityChange?: (opacity: number) => void;
  onClearMask?: () => void;
  onInvertMask?: () => void;
  onUndoStroke?: (strokeId: string) => void;
  topologyAnalysis?: TopologyAnalysis | null;
  strokeHistory?: BrushStroke[];
}

export function TopologyBrushPanel({
  className,
  onBrushChange,
  onSettingsChange,
  onSymmetryChange,
  onMaskVisibilityChange,
  onMaskOpacityChange,
  onClearMask,
  onInvertMask,
  onUndoStroke,
  topologyAnalysis = null,
  strokeHistory = [],
}: TopologyBrushPanelProps) {
  const [activeBrushType, setActiveBrushType] = useState<BrushType>('smooth');
  const [settings, setSettings] = useState<Partial<BrushSettings>>({
    radius: 0.5,
    innerRadius: 0,
    strength: 0.5,
    falloffType: 'smooth',
    direction: 'normal',
    accumulate: true,
    useFrontFacesOnly: true,
    preserveVolume: false,
    preserveBoundary: true,
    respectMask: true,
  });
  const [symmetryMode, setSymmetryMode] = useState<SymmetryMode>('none');
  const [symmetryOffset, setSymmetryOffset] = useState(0);
  const [maskVisible, setMaskVisible] = useState(true);
  const [maskOpacity, setMaskOpacity] = useState(0.5);
  
  const handleBrushChange = useCallback((type: BrushType) => {
    setActiveBrushType(type);
    onBrushChange?.(type);
  }, [onBrushChange]);
  
  const handleSettingsChange = useCallback((newSettings: Partial<BrushSettings>) => {
    setSettings(newSettings);
    onSettingsChange?.(newSettings);
  }, [onSettingsChange]);
  
  const handleSymmetryChange = useCallback((mode: SymmetryMode, offset: number) => {
    setSymmetryMode(mode);
    setSymmetryOffset(offset);
    onSymmetryChange?.(mode, offset);
  }, [onSymmetryChange]);
  
  const handleMaskVisibility = useCallback(() => {
    setMaskVisible(!maskVisible);
    onMaskVisibilityChange?.(!maskVisible);
  }, [maskVisible, onMaskVisibilityChange]);
  
  const handleMaskOpacity = useCallback((opacity: number) => {
    setMaskOpacity(opacity);
    onMaskOpacityChange?.(opacity);
  }, [onMaskOpacityChange]);
  
  return (
    <Card className={cn('w-72', className)}>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brush className="h-4 w-4" />
          Topology Brush
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs defaultValue="brush" className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-8">
            <TabsTrigger value="brush" className="text-xs h-7">
              <Brush className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs h-7">
              <Settings2 className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="topology" className="text-xs h-7">
              <Box className="h-3 w-3" />
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs h-7">
              <History className="h-3 w-3" />
            </TabsTrigger>
          </TabsList>
          
          <ScrollArea className="h-[400px]">
            <TabsContent value="brush" className="p-4 mt-0 space-y-4">
              <BrushSelector
                activeBrushType={activeBrushType}
                onBrushChange={handleBrushChange}
              />
              
              <Separator />
              
              <SymmetryPanel
                symmetryMode={symmetryMode}
                symmetryOffset={symmetryOffset}
                onSymmetryChange={handleSymmetryChange}
              />
              
              <Separator />
              
              <MaskPanel
                isVisible={maskVisible}
                opacity={maskOpacity}
                onToggleVisibility={handleMaskVisibility}
                onOpacityChange={handleMaskOpacity}
                onClearMask={() => onClearMask?.()}
                onInvertMask={() => onInvertMask?.()}
              />
            </TabsContent>
            
            <TabsContent value="settings" className="p-4 mt-0">
              <BrushSettingsPanel
                settings={settings}
                onSettingsChange={handleSettingsChange}
              />
            </TabsContent>
            
            <TabsContent value="topology" className="p-4 mt-0">
              <TopologyInfoPanel analysis={topologyAnalysis} />
            </TabsContent>
            
            <TabsContent value="history" className="p-4 mt-0">
              <StrokeHistoryPanel
                strokes={strokeHistory}
                onUndo={(id) => onUndoStroke?.(id)}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default TopologyBrushPanel;
