'use client';

/**
 * NEXUS Engine - Conversion Panel
 * 
 * Panel de UI para el sistema de conversión 2D/3D
 */

import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Image as ImageIcon,
  Video,
  Camera,
  Pencil,
  Upload,
  Play,
  Download,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Box,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type ConversionMode = 'sketch' | 'image_single' | 'image_multi' | 'video' | 'photo_set' | 'scene_scan';
type QualityLevel = 'excellent' | 'good' | 'acceptable' | 'poor';

interface ConversionResult {
  mesh?: {
    id: string;
    name: string;
    vertices: Map<string, unknown>;
    faces: Map<string, unknown>;
  };
  confidence: number;
  qualityLevel: QualityLevel;
  suggestions: string[];
}

interface ConversionState {
  mode: ConversionMode;
  files: File[];
  isProcessing: boolean;
  progress: number;
  currentStep: string;
  result: ConversionResult | null;
  error: string | null;
}

// ============================================
// CONVERSION PANEL COMPONENT
// ============================================

export function ConversionPanel() {
  const [state, setState] = useState<ConversionState>({
    mode: 'image_single',
    files: [],
    isProcessing: false,
    progress: 0,
    currentStep: '',
    result: null,
    error: null,
  });

  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setState(prev => ({
      ...prev,
      files,
      result: null,
      error: null,
    }));
  }, []);

  // Handle mode change
  const handleModeChange = useCallback((mode: ConversionMode) => {
    setState(prev => ({
      ...prev,
      mode,
      files: [],
      result: null,
      error: null,
    }));
  }, []);

  // Start conversion
  const handleConvert = useCallback(async () => {
    if (state.files.length === 0) {
      setState(prev => ({ ...prev, error: 'Please select files first' }));
      return;
    }

    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: 0,
      currentStep: 'Initializing...',
      error: null,
    }));

    try {
      // Simulate conversion progress
      const steps = [
        { step: 'Loading input...', progress: 10 },
        { step: 'Preprocessing...', progress: 25 },
        { step: 'Analyzing...', progress: 40 },
        { step: 'Classifying intent...', progress: 55 },
        { step: 'Reconstructing geometry...', progress: 70 },
        { step: 'Generating mesh...', progress: 85 },
        { step: 'Finalizing...', progress: 95 },
      ];

      for (const { step, progress } of steps) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setState(prev => ({
          ...prev,
          currentStep: step,
          progress,
        }));
      }

      // Simulate result
      const mockResult: ConversionResult = {
        mesh: {
          id: 'mesh_' + Date.now(),
          name: 'Converted_Mesh',
          vertices: new Map([['v1', {}]]),
          faces: new Map(),
        },
        confidence: 0.75,
        qualityLevel: 'good',
        suggestions: [
          'Consider adding more views for better reconstruction',
          'The object was classified as generic furniture',
        ],
      };

      setState(prev => ({
        ...prev,
        isProcessing: false,
        progress: 100,
        currentStep: 'Completed!',
        result: mockResult,
      }));

      setShowPreview(true);
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Conversion failed',
      }));
    }
  }, [state.files, state.mode]);

  // Reset state
  const handleReset = useCallback(() => {
    setState({
      mode: 'image_single',
      files: [],
      isProcessing: false,
      progress: 0,
      currentStep: '',
      result: null,
      error: null,
    });
    setShowPreview(false);
  }, []);

  // Get mode info
  const getModeInfo = (mode: ConversionMode) => {
    const modes: Record<ConversionMode, { label: string; icon: React.ReactNode; description: string }> = {
      sketch: {
        label: 'Sketch',
        icon: <Pencil className="w-4 h-4" />,
        description: 'Convert a 2D sketch to 3D',
      },
      image_single: {
        label: 'Single Image',
        icon: <ImageIcon className="w-4 h-4" />,
        description: 'Convert a single image to 3D',
      },
      image_multi: {
        label: 'Multi-View Images',
        icon: <Layers className="w-4 h-4" />,
        description: 'Convert multiple views to 3D',
      },
      video: {
        label: 'Video',
        icon: <Video className="w-4 h-4" />,
        description: 'Extract 3D from video scan',
      },
      photo_set: {
        label: 'Photo Set',
        icon: <Camera className="w-4 h-4" />,
        description: 'Photogrammetry from photos',
      },
      scene_scan: {
        label: 'Scene Scan',
        icon: <Box className="w-4 h-4" />,
        description: 'Reconstruct a 3D scene',
      },
    };
    return modes[mode];
  };

  // Get quality badge color
  const getQualityBadge = (level: QualityLevel) => {
    const colors: Record<QualityLevel, string> = {
      excellent: 'bg-green-500',
      good: 'bg-blue-500',
      acceptable: 'bg-yellow-500',
      poor: 'bg-red-500',
    };
    return colors[level];
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Box className="w-5 h-5" />
          2D to 3D Conversion
        </CardTitle>
        <CardDescription>
          Convert sketches, images, photos, and videos to 3D models
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Conversion Mode</label>
          <Select value={state.mode} onValueChange={(v) => handleModeChange(v as ConversionMode)}>
            <SelectTrigger>
              <SelectValue placeholder="Select conversion mode" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries({
                sketch: 'Sketch',
                image_single: 'Single Image',
                image_multi: 'Multi-View Images',
                video: 'Video',
                photo_set: 'Photo Set',
                scene_scan: 'Scene Scan',
              }).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  <div className="flex items-center gap-2">
                    {getModeInfo(value as ConversionMode).icon}
                    {label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {getModeInfo(state.mode).description}
          </p>
        </div>

        <Separator />

        {/* File Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Input Files
            {state.mode === 'image_multi' && ' (multiple views)'}
            {state.mode === 'photo_set' && ' (multiple photos)'}
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              "hover:border-primary hover:bg-muted/50",
              state.files.length > 0 && "border-primary bg-muted/30"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={state.mode === 'video' ? 'video/*' : 'image/*'}
              multiple={['image_multi', 'photo_set', 'scene_scan'].includes(state.mode)}
              onChange={handleFileSelect}
              className="hidden"
            />
            {state.files.length === 0 ? (
              <>
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {state.mode === 'video' ? 'MP4, WebM' : 'PNG, JPG, WebP'}
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm font-medium">
                  {state.files.length} file{state.files.length > 1 ? 's' : ''} selected
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {state.files.map(f => f.name).join(', ').slice(0, 50)}
                  {state.files.map(f => f.name).join(', ').length > 50 && '...'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Progress */}
        {state.isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{state.currentStep}</span>
              <span>{state.progress}%</span>
            </div>
            <Progress value={state.progress} />
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            {state.error}
          </div>
        )}

        {/* Result Summary */}
        {state.result && (
          <div className="space-y-3 bg-muted/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Result</span>
              <Badge className={getQualityBadge(state.result.qualityLevel)}>
                {state.result.qualityLevel}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Vertices:</span>{' '}
                <span className="font-mono">{state.result.mesh?.vertices.size ?? 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Faces:</span>{' '}
                <span className="font-mono">{state.result.mesh?.faces.size ?? 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Confidence:</span>{' '}
                <span className="font-mono">{Math.round(state.result.confidence * 100)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Quality:</span>{' '}
                <span className="font-mono">{state.result.qualityLevel}</span>
              </div>
            </div>
            {state.result.suggestions.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {state.result.suggestions[0]}
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleConvert}
            disabled={state.files.length === 0 || state.isProcessing}
            className="flex-1"
          >
            {state.isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Convert to 3D
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={state.isProcessing}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          {state.result && (
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}
        </div>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Conversion Result</DialogTitle>
              <DialogDescription>
                Preview your converted 3D model
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* 3D Preview placeholder */}
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Box className="w-16 h-16 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    3D Preview would render here
                  </p>
                </div>
              </div>

              {/* Details */}
              {state.result && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="font-medium">Mesh Info</div>
                    <div className="text-muted-foreground">
                      Vertices: {state.result.mesh?.vertices.size ?? 0}
                    </div>
                    <div className="text-muted-foreground">
                      Faces: {state.result.mesh?.faces.size ?? 0}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">Quality Metrics</div>
                    <div className="text-muted-foreground">
                      Confidence: {Math.round(state.result.confidence * 100)}%
                    </div>
                    <div className="text-muted-foreground">
                      Level: {state.result.qualityLevel}
                    </div>
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {state.result?.suggestions && state.result.suggestions.length > 0 && (
                <div className="space-y-1">
                  <div className="text-sm font-medium">Suggestions</div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {state.result.suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <ChevronRight className="w-3 h-3 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default ConversionPanel;
