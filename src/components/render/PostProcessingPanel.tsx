'use client';

/**
 * NEXUS Engine - Post Processing Panel Component
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sparkles, Sun, Aperture, Eye, Palette, Monitor, ChevronDown, Plus, Settings,
} from 'lucide-react';
import type {
  PostEffect,
  PostEffectType,
  PostProcessingPreset,
} from '@/lib/engine/render/advanced/PostProcessingSystem';
import { POST_PROCESSING_PRESETS } from '@/lib/engine/render/advanced/PostProcessingSystem';

const EFFECT_ICONS: Record<PostEffectType, React.ComponentType<{ className?: string }>> = {
  bloom: Sun, dof: Aperture, ssao: Eye, motion_blur: Settings,
  chromatic_aberration: Sparkles, vignette: Monitor, color_grading: Palette,
  tonemapping: Monitor, fxaa: Settings, smaa: Settings, taa: Settings,
  film_grain: Sparkles, lens_flare: Sun, screen_space_reflection: Eye, custom: Settings,
};

interface EffectItemProps {
  effect: PostEffect;
  onUpdate: (id: string, updates: Partial<PostEffect>) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}

function EffectItem({ effect, onUpdate, onRemove, onToggle }: EffectItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = EFFECT_ICONS[effect.type];
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent rounded-lg">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{effect.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={effect.enabled} onCheckedChange={() => onToggle(effect.id)} onClick={(e) => e.stopPropagation()} />
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 pt-0">
        <Separator className="mb-3" />
        <div className="text-xs text-muted-foreground">Settings for {effect.name}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export interface PostProcessingPanelProps {
  className?: string;
  effects?: PostEffect[];
  onEffectsChange?: (effects: PostEffect[]) => void;
  onPresetChange?: (preset: PostProcessingPreset) => void;
}

export function PostProcessingPanel({
  className, effects = [], onEffectsChange, onPresetChange,
}: PostProcessingPanelProps) {
  const handleToggle = useCallback((id: string) => {
    onEffectsChange?.(effects.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e));
  }, [effects, onEffectsChange]);
  
  const handleRemove = useCallback((id: string) => {
    onEffectsChange?.(effects.filter(e => e.id !== id));
  }, [effects, onEffectsChange]);
  
  return (
    <Card className={cn('w-72', className)}>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Post Processing
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-3 border-b">
          <Label className="text-xs text-muted-foreground mb-2 block">Presets</Label>
          <Select onValueChange={(v) => onPresetChange?.(POST_PROCESSING_PRESETS[v as keyof typeof POST_PROCESSING_PRESETS])}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Select preset..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(POST_PROCESSING_PRESETS).map(([key, preset]) => (
                <SelectItem key={key} value={key}>{preset.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-3 space-y-2">
            {effects.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">No effects</div>
            ) : (
              effects.map((effect) => (
                <EffectItem key={effect.id} effect={effect} onUpdate={() => {}} onRemove={handleRemove} onToggle={handleToggle} />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default PostProcessingPanel;
