'use client';

/**
 * NEXUS Engine - Animation Editor Panel Component
 * 
 * Editor completo de animaciones con:
 * - Timeline y keyframes
 * - Curvas de animación
 * - Lista de huesos
 * - Controles de reproducción
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Play, Pause, Square, SkipBack, SkipForward,
  ChevronLeft, ChevronRight,
  Plus, Minus, Copy, Trash2, Key, Settings,
  RotateCcw, RotateCw, Clock, Layers, Eye, EyeOff,
  Move, RotateCcw as RotateIcon, Maximize2, MousePointer,
  ZoomIn, ZoomOut, Grid, Lock, Unlock, Circle,
} from 'lucide-react';
import type {
  AnimationClip,
  AnimationKeyframe,
  AnimationCurve,
  Skeleton,
  Bone,
  PlaybackState,
} from '@/lib/engine/animation/AnimationSystem';

// ============================================
// TIMELINE COMPONENT
// ============================================

interface TimelineProps {
  duration: number;
  currentTime: number;
  frameRate: number;
  onTimeChange: (time: number) => void;
  onFrameChange: (frame: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

function Timeline({
  duration,
  currentTime,
  frameRate,
  onTimeChange,
  onFrameChange,
  zoom,
  onZoomChange,
}: TimelineProps) {
  const totalFrames = Math.floor(duration * frameRate);
  const currentFrame = Math.floor(currentTime * frameRate);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    
    onTimeChange(Math.max(0, Math.min(duration, newTime)));
    onFrameChange(Math.floor(newTime * frameRate));
  }, [duration, frameRate, onTimeChange, onFrameChange]);
  
  // Generate frame markers
  const markers = useMemo(() => {
    const result: React.ReactElement[] = [];
    const step = Math.max(1, Math.floor(10 / zoom));
    
    for (let frame = 0; frame <= totalFrames; frame += step) {
      const percentage = (frame / totalFrames) * 100;
      const isSecondMarker = frame % frameRate === 0;
      
      result.push(
        <div
          key={frame}
          className="absolute top-0 bottom-0"
          style={{ left: `${percentage}%` }}
        >
          <div
            className={cn(
              'w-px bg-border',
              isSecondMarker ? 'h-4' : 'h-2'
            )}
          />
          {isSecondMarker && (
            <span className="text-[10px] text-muted-foreground ml-1">
              {frame / frameRate}s
            </span>
          )}
        </div>
      );
    }
    
    return result;
  }, [totalFrames, frameRate, zoom]);
  
  return (
    <div className="space-y-2">
      {/* Timeline ruler */}
      <div
        ref={timelineRef}
        className="relative h-6 bg-muted rounded cursor-pointer"
        onClick={handleTimelineClick}
      >
        {markers}
        
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        >
          <div className="w-3 h-3 bg-red-500 -ml-1.5 -mt-1 rounded-full" />
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Frame: {currentFrame} / {totalFrames}
          </span>
          <span className="text-xs text-muted-foreground">
            Time: {currentTime.toFixed(2)}s
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onZoomChange(Math.max(0.5, zoom - 0.25))}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onZoomChange(Math.min(4, zoom + 0.25))}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// KEYFRAME TRACK COMPONENT
// ============================================

interface KeyframeTrackProps {
  curve: AnimationCurve;
  duration: number;
  currentTime: number;
  selectedKeyframes: Set<string>;
  onKeyframeSelect: (id: string, multi: boolean) => void;
  onKeyframeMove: (id: string, newTime: number) => void;
  onKeyframeAdd: (time: number) => void;
}

function KeyframeTrack({
  curve,
  duration,
  currentTime,
  selectedKeyframes,
  onKeyframeSelect,
  onKeyframeMove,
  onKeyframeAdd,
}: KeyframeTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  
  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current || e.target !== trackRef.current) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * duration;
    
    onKeyframeAdd(time);
  }, [duration, onKeyframeAdd]);
  
  return (
    <div className="flex items-center gap-2 py-1 group">
      {/* Curve name */}
      <div className="w-32 flex-shrink-0 flex items-center gap-1">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: `rgba(${curve.color.r * 255}, ${curve.color.g * 255}, ${curve.color.b * 255}, ${curve.color.a})` }}
        />
        <span className="text-xs truncate flex-1">{curve.name}</span>
      </div>
      
      {/* Keyframe area */}
      <div
        ref={trackRef}
        className="flex-1 h-6 bg-muted/50 rounded relative cursor-crosshair"
        onClick={handleTrackClick}
      >
        {/* Keyframes */}
        {curve.keyframes.map((kf) => {
          const percentage = (kf.time / duration) * 100;
          const isSelected = selectedKeyframes.has(kf.id);
          
          return (
            <div
              key={kf.id}
              className={cn(
                'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer',
                'transition-transform hover:scale-125'
              )}
              style={{ left: `${percentage}%` }}
              onClick={(e) => {
                e.stopPropagation();
                onKeyframeSelect(kf.id, e.ctrlKey || e.metaKey);
              }}
            >
              <Key
                className={cn(
                  'h-4 w-4',
                  isSelected ? 'text-primary fill-primary' : 'text-muted-foreground'
                )}
              />
            </div>
          );
        })}
        
        {/* Playhead line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-red-500/50"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ============================================
// CURVE EDITOR COMPONENT
// ============================================

interface CurveEditorProps {
  curve: AnimationCurve;
  duration: number;
  width?: number;
  height?: number;
}

function CurveEditor({
  curve,
  duration,
  width = 400,
  height = 200,
}: CurveEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Find value range
  const [minValue, maxValue] = useMemo(() => {
    if (curve.keyframes.length === 0) return [0, 1];
    
    let min = Infinity;
    let max = -Infinity;
    
    for (const kf of curve.keyframes) {
      const v = kf.value as number;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    
    // Add padding
    const range = max - min || 1;
    return [min - range * 0.1, max + range * 0.1];
  }, [curve.keyframes]);
  
  // Generate path
  const pathD = useMemo(() => {
    if (curve.keyframes.length < 2) return '';
    
    const points = curve.keyframes.map(kf => ({
      x: (kf.time / duration) * width,
      y: height - ((kf.value as number) - minValue) / (maxValue - minValue) * height,
    }));
    
    let d = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    
    return d;
  }, [curve.keyframes, duration, width, height, minValue, maxValue]);
  
  return (
    <div className="border rounded-lg p-2">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-background"
      >
        {/* Grid */}
        <defs>
          <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" />
        
        {/* Curve */}
        <path
          d={pathD}
          fill="none"
          stroke={`rgba(${curve.color.r * 255}, ${curve.color.g * 255}, ${curve.color.b * 255}, ${curve.color.a})`}
          strokeWidth="2"
        />
        
        {/* Keyframes */}
        {curve.keyframes.map((kf) => {
          const x = (kf.time / duration) * width;
          const y = height - ((kf.value as number) - minValue) / (maxValue - minValue) * height;
          
          return (
            <circle
              key={kf.id}
              cx={x}
              cy={y}
              r={4}
              fill={kf.selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
              stroke="hsl(var(--background))"
              strokeWidth={2}
              className="cursor-pointer"
            />
          );
        })}
      </svg>
    </div>
  );
}

// ============================================
// BONE HIERARCHY COMPONENT
// ============================================

interface BoneHierarchyProps {
  bones: Bone[];
  selectedBoneId: string | null;
  onBoneSelect: (boneId: string) => void;
  expandedBones: Set<string>;
  onToggleExpand: (boneId: string) => void;
}

function BoneHierarchy({
  bones,
  selectedBoneId,
  onBoneSelect,
  expandedBones,
  onToggleExpand,
}: BoneHierarchyProps) {
  const renderBone = (bone: Bone, depth: number = 0): React.ReactElement => {
    const hasChildren = bone.childrenIds.length > 0;
    const isExpanded = expandedBones.has(bone.id);
    
    return (
      <div key={bone.id}>
        <div
          className={cn(
            'flex items-center gap-1 py-1 px-2 rounded cursor-pointer',
            'hover:bg-accent',
            selectedBoneId === bone.id && 'bg-accent'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => onBoneSelect(bone.id)}
        >
          {/* Expand/collapse button */}
          {hasChildren && (
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(bone.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          )}
          
          {!hasChildren && <div className="w-4" />}
          
          {/* Icon */}
          <Circle className="h-3 w-3 text-muted-foreground" />
          
          {/* Name */}
          <span className="text-xs truncate">{bone.name}</span>
          
          {/* Lock indicator */}
          {bone.locked && <Lock className="h-3 w-3 text-muted-foreground ml-auto" />}
        </div>
        
        {/* Children */}
        {isExpanded && bone.childrenIds.map((childId) => {
          const child = bones.find(b => b.id === childId);
          return child ? renderBone(child, depth + 1) : null;
        })}
      </div>
    );
  };
  
  // Find root bone
  const rootBone = bones.find(b => b.parentId === null);
  
  if (!rootBone) {
    return (
      <div className="text-center text-muted-foreground text-xs py-4">
        No skeleton loaded
      </div>
    );
  }
  
  return (
    <ScrollArea className="h-64">
      {renderBone(rootBone)}
    </ScrollArea>
  );
}

// Missing ChevronDown import
const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ============================================
// PLAYBACK CONTROLS
// ============================================

interface PlaybackControlsProps {
  playbackState: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onPreviousFrame: () => void;
  onNextFrame: () => void;
  onFirstFrame: () => void;
  onLastFrame: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  loop: boolean;
  onLoopChange: (loop: boolean) => void;
}

function PlaybackControls({
  playbackState,
  onPlay,
  onPause,
  onStop,
  onPreviousFrame,
  onNextFrame,
  onFirstFrame,
  onLastFrame,
  playbackSpeed,
  onSpeedChange,
  loop,
  onLoopChange,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-1">
      {/* First frame */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFirstFrame}>
              <SkipBack className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>First Frame</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {/* Previous frame */}
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPreviousFrame}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      {/* Play/Pause */}
      <Button
        variant="default"
        size="icon"
        className="h-9 w-9"
        onClick={playbackState === 'playing' ? onPause : onPlay}
      >
        {playbackState === 'playing' ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      
      {/* Stop */}
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onStop}>
        <Square className="h-4 w-4" />
      </Button>
      
      {/* Next frame */}
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextFrame}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      
      {/* Last frame */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onLastFrame}>
              <SkipForward className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Last Frame</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <Separator orientation="vertical" className="h-6 mx-1" />
      
      {/* Speed */}
      <Select
        value={playbackSpeed.toString()}
        onValueChange={(v) => onSpeedChange(parseFloat(v))}
      >
        <SelectTrigger className="h-8 w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0.25">0.25x</SelectItem>
          <SelectItem value="0.5">0.5x</SelectItem>
          <SelectItem value="1">1x</SelectItem>
          <SelectItem value="2">2x</SelectItem>
        </SelectContent>
      </Select>
      
      {/* Loop */}
      <Button
        variant={loop ? 'default' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        onClick={() => onLoopChange(!loop)}
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export interface AnimationEditorPanelProps {
  className?: string;
  clip?: AnimationClip | null;
  skeleton?: Skeleton | null;
  onClipChange?: (clip: AnimationClip) => void;
  onTimeChange?: (time: number) => void;
}

export function AnimationEditorPanel({
  className,
  clip,
  skeleton,
  onClipChange,
  onTimeChange,
}: AnimationEditorPanelProps) {
  // State
  const [currentTime, setCurrentTime] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selectedKeyframes, setSelectedKeyframes] = useState<Set<string>>(new Set());
  const [selectedBoneId, setSelectedBoneId] = useState<string | null>(null);
  const [expandedBones, setExpandedBones] = useState<Set<string>>(new Set());
  const [visibleCurves, setVisibleCurves] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('dopesheet');
  
  const duration = clip?.duration || 1;
  const frameRate = clip?.frameRate || 30;
  
  // Playback simulation
  useEffect(() => {
    if (playbackState !== 'playing' || !clip) return;
    
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const next = prev + (1 / 60) * playbackSpeed;
        if (next >= duration) {
          if (loop) {
            return 0;
          } else {
            setPlaybackState('stopped');
            return duration;
          }
        }
        return next;
      });
    }, 1000 / 60);
    
    return () => clearInterval(interval);
  }, [playbackState, playbackSpeed, duration, loop, clip]);
  
  // Handlers
  const handleTimeChange = useCallback((time: number) => {
    setCurrentTime(time);
    setCurrentFrame(Math.floor(time * frameRate));
    onTimeChange?.(time);
  }, [frameRate, onTimeChange]);
  
  const handleFrameChange = useCallback((frame: number) => {
    setCurrentFrame(frame);
    setCurrentTime(frame / frameRate);
  }, [frameRate]);
  
  const handleKeyframeSelect = useCallback((id: string, multi: boolean) => {
    setSelectedKeyframes(prev => {
      if (multi) {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      }
      return new Set([id]);
    });
  }, []);
  
  const handleToggleExpand = useCallback((boneId: string) => {
    setExpandedBones(prev => {
      const next = new Set(prev);
      if (next.has(boneId)) {
        next.delete(boneId);
      } else {
        next.add(boneId);
      }
      return next;
    });
  }, []);
  
  // Get curves as array
  const curvesArray = useMemo(() => {
    if (!clip) return [];
    return Array.from(clip.curves.values()).filter(c => visibleCurves.size === 0 || visibleCurves.has(c.id));
  }, [clip, visibleCurves]);
  
  // Get bones as array
  const bonesArray = useMemo(() => {
    if (!skeleton) return [];
    return Array.from(skeleton.bones.values());
  }, [skeleton]);
  
  return (
    <Card className={cn('w-[500px]', className)}>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Animation Editor
          </div>
          {clip && (
            <Badge variant="outline" className="text-xs">
              {clip.name}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Playback Controls */}
        <div className="flex items-center justify-between p-3 border-b">
          <PlaybackControls
            playbackState={playbackState}
            onPlay={() => setPlaybackState('playing')}
            onPause={() => setPlaybackState('paused')}
            onStop={() => {
              setPlaybackState('stopped');
              setCurrentTime(0);
              setCurrentFrame(0);
            }}
            onPreviousFrame={() => handleFrameChange(Math.max(0, currentFrame - 1))}
            onNextFrame={() => handleFrameChange(Math.min(duration * frameRate, currentFrame + 1))}
            onFirstFrame={() => handleFrameChange(0)}
            onLastFrame={() => handleFrameChange(Math.floor(duration * frameRate))}
            playbackSpeed={playbackSpeed}
            onSpeedChange={setPlaybackSpeed}
            loop={loop}
            onLoopChange={setLoop}
          />
        </div>
        
        {/* Timeline */}
        <div className="p-3 border-b">
          <Timeline
            duration={duration}
            currentTime={currentTime}
            frameRate={frameRate}
            onTimeChange={handleTimeChange}
            onFrameChange={handleFrameChange}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-8 rounded-none border-b">
            <TabsTrigger value="dopesheet" className="text-xs">
              Dope Sheet
            </TabsTrigger>
            <TabsTrigger value="curves" className="text-xs">
              Curves
            </TabsTrigger>
            <TabsTrigger value="bones" className="text-xs">
              Bones
            </TabsTrigger>
          </TabsList>
          
          {/* Dope Sheet */}
          <TabsContent value="dopesheet" className="m-0">
            <ScrollArea className="h-[250px]">
              {curvesArray.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  No animation curves
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {curvesArray.map((curve) => (
                    <KeyframeTrack
                      key={curve.id}
                      curve={curve}
                      duration={duration}
                      currentTime={currentTime}
                      selectedKeyframes={selectedKeyframes}
                      onKeyframeSelect={handleKeyframeSelect}
                      onKeyframeMove={() => {}}
                      onKeyframeAdd={() => {}}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          {/* Curves */}
          <TabsContent value="curves" className="m-0">
            <ScrollArea className="h-[250px]">
              {curvesArray.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  No curves to display
                </div>
              ) : (
                <div className="p-3 space-y-4">
                  {curvesArray.slice(0, 3).map((curve) => (
                    <div key={curve.id}>
                      <div className="text-xs font-medium mb-2">{curve.name}</div>
                      <CurveEditor
                        curve={curve}
                        duration={duration}
                        width={450}
                        height={100}
                      />
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          {/* Bones */}
          <TabsContent value="bones" className="m-0">
            <BoneHierarchy
              bones={bonesArray}
              selectedBoneId={selectedBoneId}
              onBoneSelect={setSelectedBoneId}
              expandedBones={expandedBones}
              onToggleExpand={handleToggleExpand}
            />
          </TabsContent>
        </Tabs>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
          <span>
            {selectedKeyframes.size > 0
              ? `${selectedKeyframes.size} keyframe(s) selected`
              : 'No selection'}
          </span>
          <span>
            {clip ? `${curvesArray.length} curves, ${clip.events.length} events` : 'No clip loaded'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default AnimationEditorPanel;
