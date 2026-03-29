'use client';

/**
 * NEXUS Engine - Character Builder Panel
 * 
 * Panel completo para el sistema de construcción de personajes modulares
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  User,
  Crown,
  Shirt,
  Footprints,
  Hand,
  Package,
  Palette,
  Save,
  FolderOpen,
  RotateCcw,
  Shuffle,
  Download,
  Upload,
  ChevronRight,
  Search,
  Grid3X3,
  List,
  MoreVertical,
  Sparkles,
  X,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  createCharacterPreset,
  deleteCharacterPreset,
  fetchCharacterPresets,
} from '@/lib/character-builder/preset-api';
import { RuntimeAssetPreview } from '@/components/assets/RuntimeAssetPreview';
import {
  buildCatalogAssetsFromRuntimeRegistry,
  createFallbackBuilderCatalog,
  type BuilderCatalogAsset,
  type RuntimeRegistryResponse,
} from '@/lib/character-builder/runtime-builder-catalog';

// Import character builder types
import type {
  PartCategory,
  AssetMetadata,
  EquippedPart,
  BodyType,
  Rarity,
  ColorOption,
  CharacterPreset,
} from '@/lib/character-builder/types';
import { RarityColors, CategoryToSocket } from '@/lib/character-builder/types';

// ============================================
// MOCK DATA FOR DEMO
// ============================================

const MOCK_ASSETS: AssetMetadata[] = [
  // Hair
  {
    id: 'hair_short_01',
    name: 'Cabello Corto',
    category: 'hair',
    tags: ['casual', 'modern'],
    modelPath: '/assets/hair_short_01.glb',
    thumbnailPath: '/thumbnails/hair_short_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['male_medium', 'female_medium', 'universal'],
    attachmentSocket: 'hair_socket',
    enabled: true,
    rarity: 'common',
    colorOptions: [
      { id: 'black', name: 'Negro', hex: '#1a1a1a' },
      { id: 'brown', name: 'Castaño', hex: '#4a3728' },
      { id: 'blonde', name: 'Rubio', hex: '#d4a84b' },
      { id: 'red', name: 'Rojo', hex: '#8b2500' },
    ],
  },
  {
    id: 'hair_long_01',
    name: 'Cabello Largo',
    category: 'hair',
    tags: ['fantasy', 'feminine'],
    modelPath: '/assets/hair_long_01.glb',
    thumbnailPath: '/thumbnails/hair_long_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['female_medium', 'universal'],
    attachmentSocket: 'hair_socket',
    enabled: true,
    rarity: 'uncommon',
    genderStyle: 'feminine',
    colorOptions: [
      { id: 'black', name: 'Negro', hex: '#1a1a1a' },
      { id: 'white', name: 'Blanco', hex: '#e8e8e8' },
      { id: 'silver', name: 'Plateado', hex: '#c0c0c0' },
    ],
  },
  {
    id: 'hair_spiky_01',
    name: 'Cabello Punk',
    category: 'hair',
    tags: ['rebel', 'modern'],
    modelPath: '/assets/hair_spiky_01.glb',
    thumbnailPath: '/thumbnails/hair_spiky_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['universal'],
    attachmentSocket: 'hair_socket',
    enabled: true,
    rarity: 'rare',
    colorOptions: [
      { id: 'red', name: 'Rojo', hex: '#ff3333' },
      { id: 'blue', name: 'Azul', hex: '#3366ff' },
      { id: 'green', name: 'Verde', hex: '#33ff66' },
    ],
  },
  
  // Torso
  {
    id: 'armor_leather_01',
    name: 'Armadura de Cuero',
    category: 'torso',
    tags: ['armor', 'rogue', 'light'],
    modelPath: '/assets/armor_leather_01.glb',
    thumbnailPath: '/thumbnails/armor_leather_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['universal'],
    attachmentSocket: 'torso_socket',
    enabled: true,
    rarity: 'uncommon',
    colorOptions: [
      { id: 'brown', name: 'Marrón', hex: '#5c4033' },
      { id: 'black', name: 'Negro', hex: '#1a1a1a' },
    ],
  },
  {
    id: 'armor_plate_01',
    name: 'Armadura de Placas',
    category: 'torso',
    tags: ['armor', 'warrior', 'heavy'],
    modelPath: '/assets/armor_plate_01.glb',
    thumbnailPath: '/thumbnails/armor_plate_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['male_medium', 'male_large', 'female_medium'],
    attachmentSocket: 'torso_socket',
    enabled: true,
    rarity: 'rare',
    colorOptions: [
      { id: 'steel', name: 'Acero', hex: '#708090' },
      { id: 'gold', name: 'Dorado', hex: '#b8860b' },
    ],
  },
  {
    id: 'robe_mage_01',
    name: 'Túnica de Mago',
    category: 'torso',
    tags: ['armor', 'mage', 'cloth'],
    modelPath: '/assets/robe_mage_01.glb',
    thumbnailPath: '/thumbnails/robe_mage_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['universal'],
    attachmentSocket: 'torso_socket',
    enabled: true,
    rarity: 'epic',
    colorOptions: [
      { id: 'blue', name: 'Azul', hex: '#1e3a5f' },
      { id: 'purple', name: 'Púrpura', hex: '#4a0080' },
      { id: 'red', name: 'Rojo', hex: '#8b0000' },
    ],
  },
  
  // Shoes
  {
    id: 'boots_leather_01',
    name: 'Botas de Cuero',
    category: 'shoes',
    tags: ['casual', 'travel'],
    modelPath: '/assets/boots_leather_01.glb',
    thumbnailPath: '/thumbnails/boots_leather_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['universal'],
    attachmentSocket: 'feet_socket',
    enabled: true,
    rarity: 'common',
    colorOptions: [
      { id: 'brown', name: 'Marrón', hex: '#5c4033' },
      { id: 'black', name: 'Negro', hex: '#1a1a1a' },
    ],
  },
  {
    id: 'boots_armored_01',
    name: 'Botas Blindadas',
    category: 'shoes',
    tags: ['armor', 'warrior'],
    modelPath: '/assets/boots_armored_01.glb',
    thumbnailPath: '/thumbnails/boots_armored_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['male_medium', 'male_large', 'female_medium'],
    attachmentSocket: 'feet_socket',
    enabled: true,
    rarity: 'rare',
  },
  
  // Accessories
  {
    id: 'cape_basic_01',
    name: 'Capa Básica',
    category: 'cape',
    tags: ['accessory', 'travel'],
    modelPath: '/assets/cape_basic_01.glb',
    thumbnailPath: '/thumbnails/cape_basic_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['universal'],
    attachmentSocket: 'back_socket',
    enabled: true,
    rarity: 'common',
    colorOptions: [
      { id: 'red', name: 'Rojo', hex: '#8b0000' },
      { id: 'blue', name: 'Azul', hex: '#1e3a5f' },
      { id: 'black', name: 'Negro', hex: '#1a1a1a' },
    ],
  },
  {
    id: 'crown_royal_01',
    name: 'Corona Real',
    category: 'accessory',
    tags: ['accessory', 'royal', 'legendary'],
    modelPath: '/assets/crown_royal_01.glb',
    thumbnailPath: '/thumbnails/crown_royal_01.png',
    skeletonId: 'human_base_v1',
    bodyTypes: ['universal'],
    attachmentSocket: 'head_socket',
    enabled: true,
    rarity: 'legendary',
  },
];

// ============================================
// CATEGORY CONFIG
// ============================================

const CATEGORY_CONFIG: Record<PartCategory, { icon: React.ReactNode; label: string; color: string }> = {
  hair: { icon: <User className="w-4 h-4" />, label: 'Cabello', color: 'text-amber-500' },
  head: { icon: <User className="w-4 h-4" />, label: 'Cabeza', color: 'text-orange-500' },
  torso: { icon: <Shirt className="w-4 h-4" />, label: 'Torso', color: 'text-blue-500' },
  arms: { icon: <Hand className="w-4 h-4" />, label: 'Brazos', color: 'text-green-500' },
  gloves: { icon: <Hand className="w-4 h-4" />, label: 'Guantes', color: 'text-emerald-500' },
  legs: { icon: <User className="w-4 h-4" />, label: 'Piernas', color: 'text-indigo-500' },
  shoes: { icon: <Footprints className="w-4 h-4" />, label: 'Calzado', color: 'text-brown-500' },
  outfit: { icon: <Shirt className="w-4 h-4" />, label: 'Vestuario', color: 'text-purple-500' },
  accessory: { icon: <Crown className="w-4 h-4" />, label: 'Accesorios', color: 'text-yellow-500' },
  helmet: { icon: <Crown className="w-4 h-4" />, label: 'Cascos', color: 'text-slate-500' },
  cape: { icon: <User className="w-4 h-4" />, label: 'Capas', color: 'text-red-500' },
  shoulder: { icon: <Shirt className="w-4 h-4" />, label: 'Hombros', color: 'text-cyan-500' },
  weapon: { icon: <Package className="w-4 h-4" />, label: 'Armas', color: 'text-rose-500' },
  back_item: { icon: <Package className="w-4 h-4" />, label: 'Escenario', color: 'text-violet-500' },
  face_accessory: { icon: <User className="w-4 h-4" />, label: 'Cara', color: 'text-pink-500' },
  wings: { icon: <Sparkles className="w-4 h-4" />, label: 'Alas', color: 'text-sky-500' },
  tail: { icon: <User className="w-4 h-4" />, label: 'Cola', color: 'text-fuchsia-500' },
  body: { icon: <User className="w-4 h-4" />, label: 'Personajes', color: 'text-gray-500' },
};

// ============================================
// CHARACTER BUILDER PANEL
// ============================================

export function CharacterBuilderPanel() {
  // State
  const [selectedCategory, setSelectedCategory] = useState<PartCategory>('body');
  const [searchTerm, setSearchTerm] = useState('');
  const [equippedParts, setEquippedParts] = useState<Map<PartCategory, EquippedPart>>(new Map());
  const [colorOverrides, setColorOverrides] = useState<Map<string, string>>(new Map());
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState<CharacterPreset[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [catalogAssets, setCatalogAssets] = useState<BuilderCatalogAsset[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [draggedAsset, setDraggedAsset] = useState<BuilderCatalogAsset | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fallbackCatalogAssets = useMemo(
    () => createFallbackBuilderCatalog(MOCK_ASSETS),
    []
  );

  const hasRuntimeCatalog = catalogAssets.length > 0;
  const usingFallbackCatalog = !catalogLoading && !hasRuntimeCatalog && Boolean(catalogError);
  const activeCatalogAssets = hasRuntimeCatalog
    ? catalogAssets
    : usingFallbackCatalog
      ? fallbackCatalogAssets
      : [];

  const availableCategories = useMemo(() => {
    return Array.from(new Set(activeCatalogAssets.map((asset) => asset.category)));
  }, [activeCatalogAssets]);

  // Filter assets by category and search
  const filteredAssets = useMemo(() => {
    return activeCatalogAssets.filter(asset => {
      if (asset.category !== selectedCategory) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          asset.name.toLowerCase().includes(term) ||
          asset.tags.some(tag => tag.toLowerCase().includes(term)) ||
          asset.subcategory?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [activeCatalogAssets, searchTerm, selectedCategory]);

  // Get equipped part for category
  const getEquippedForCategory = useCallback((category: PartCategory) => {
    return equippedParts.get(category);
  }, [equippedParts]);

  // Equip asset
  const equipAsset = useCallback((asset: BuilderCatalogAsset, color?: string) => {
    setEquippedParts(prev => {
      const next = new Map(prev);
      next.set(asset.category, {
        assetId: asset.id,
        category: asset.category,
        colorOverride: color,
      });
      return next;
    });

    // Set default color if available
    if (asset.colorOptions && asset.colorOptions.length > 0 && !color) {
      setColorOverrides(prev => {
        const next = new Map(prev);
        next.set(asset.id, asset.colorOptions![0].hex);
        return next;
      });
    }
  }, []);

  // Unequip category
  const unequipCategory = useCallback((category: PartCategory) => {
    setEquippedParts(prev => {
      const next = new Map(prev);
      const part = next.get(category);
      if (part) {
        setColorOverrides(prevColors => {
          const nextColors = new Map(prevColors);
          nextColors.delete(part.assetId);
          return nextColors;
        });
      }
      next.delete(category);
      return next;
    });
  }, []);

  // Change color
  const changeColor = useCallback((assetId: string, color: string) => {
    setColorOverrides(prev => {
      const next = new Map(prev);
      next.set(assetId, color);
      return next;
    });
  }, []);

  // Randomize all
  const randomizeAll = useCallback(() => {
    for (const category of availableCategories) {
      const assets = activeCatalogAssets.filter(a => a.category === category);
      if (assets.length > 0) {
        const randomAsset = assets[Math.floor(Math.random() * assets.length)];
        equipAsset(randomAsset);
      }
    }
  }, [activeCatalogAssets, availableCategories, equipAsset]);

  // Reset all
  const resetAll = useCallback(() => {
    setEquippedParts(new Map());
    setColorOverrides(new Map());
    setSelectedAssetId(null);
  }, []);

  const loadRuntimeCatalog = useCallback(async () => {
    try {
      setCatalogLoading(true);
      setCatalogError(null);

      const response = await fetch('/api/assets/registry', { cache: 'no-store' });
      const payload = (await response.json()) as RuntimeRegistryResponse & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? 'No se pudo cargar el catalogo runtime.');
      }

      const nextCatalogAssets = buildCatalogAssetsFromRuntimeRegistry(payload);
      setCatalogAssets(nextCatalogAssets);

      if (nextCatalogAssets.length === 0) {
        setCatalogError('No hay assets runtime-ready compatibles con el builder todavia.');
      }
    } catch (error) {
      setCatalogAssets([]);
      setCatalogError(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar el catalogo runtime.'
      );
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRuntimeCatalog();
  }, [loadRuntimeCatalog]);

  useEffect(() => {
    if (!availableCategories.includes(selectedCategory)) {
      setSelectedCategory(availableCategories[0] ?? 'body');
    }
  }, [availableCategories, selectedCategory]);

  useEffect(() => {
    if (!selectedAssetId) {
      setSelectedAssetId(filteredAssets[0]?.id ?? activeCatalogAssets[0]?.id ?? null);
      return;
    }

    const assetStillExists = activeCatalogAssets.some((asset) => asset.id === selectedAssetId);
    if (!assetStillExists) {
      setSelectedAssetId(filteredAssets[0]?.id ?? activeCatalogAssets[0]?.id ?? null);
    }
  }, [activeCatalogAssets, filteredAssets, selectedAssetId]);

  const loadSavedPresets = useCallback(async () => {
    setIsLoadingPresets(true);
    setPresetsError(null);

    try {
      const presets = await fetchCharacterPresets();
      setSavedPresets(presets);
    } catch (error) {
      setPresetsError(
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar los presets guardados.'
      );
    } finally {
      setIsLoadingPresets(false);
    }
  }, []);

  useEffect(() => {
    void loadSavedPresets();
  }, [loadSavedPresets]);

  useEffect(() => {
    if (showLoadDialog) {
      void loadSavedPresets();
    }
  }, [showLoadDialog, loadSavedPresets]);

  // Save preset
  const savePreset = useCallback(async () => {
    if (!presetName.trim()) return;

    setIsSaving(true);

    const parts: Record<string, string> = {};
    const colors: Record<string, string> = {};

    equippedParts.forEach((part, category) => {
      parts[category] = part.assetId;
    });

    colorOverrides.forEach((color, assetId) => {
      colors[assetId] = color;
    });

    try {
      const createdPreset = await createCharacterPreset({
        version: '1.0',
        id: `preset_${Date.now()}`,
        name: presetName.trim(),
        description: undefined,
        baseBodyId: 'human_base_v1',
        parts: parts as Record<PartCategory, string>,
        colors,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
        },
      });

      setSavedPresets(prev => [
        createdPreset,
        ...prev.filter(preset => preset.id !== createdPreset.id),
      ]);
      setPresetsError(null);
      setPresetName('');
      setShowSaveDialog(false);

      toast({
        title: 'Preset saved',
        description: `"${createdPreset.name}" is now stored in PostgreSQL.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description:
          error instanceof Error
            ? error.message
            : 'No se pudo guardar el preset.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [presetName, equippedParts, colorOverrides]);

  // Load preset
  const loadPreset = useCallback((preset: CharacterPreset) => {
    resetAll();

    let missingAssets = 0;

    Object.entries(preset.parts).forEach(([category, assetId]) => {
      const asset = activeCatalogAssets.find(a => a.id === assetId);
      if (asset) {
        equipAsset(asset, preset.colors[assetId]);
      } else {
        missingAssets += 1;
      }
    });

    setShowLoadDialog(false);

    if (missingAssets > 0) {
      toast({
        title: 'Preset loaded with warnings',
        description: `${missingAssets} asset(s) are not available in the current builder catalog.`,
      });
    }
  }, [activeCatalogAssets, resetAll, equipAsset]);

  const removePreset = useCallback(async (presetId: string) => {
    setDeletingPresetId(presetId);

    try {
      await deleteCharacterPreset(presetId);
      setSavedPresets(prev => prev.filter(preset => preset.id !== presetId));

      toast({
        title: 'Preset deleted',
        description: 'The preset was removed from PostgreSQL.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description:
          error instanceof Error
            ? error.message
            : 'No se pudo eliminar el preset.',
      });
    } finally {
      setDeletingPresetId(null);
    }
  }, []);

  // Export preset as JSON
  const exportPreset = useCallback(() => {
    const parts: Record<string, string> = {};
    const colors: Record<string, string> = {};

    equippedParts.forEach((part, category) => {
      parts[category] = part.assetId;
    });

    colorOverrides.forEach((color, assetId) => {
      colors[assetId] = color;
    });

    const preset = {
      version: '1.0',
      name: 'Character Export',
      baseBodyId: 'human_base_v1',
      parts,
      colors,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'character_preset.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [equippedParts, colorOverrides]);

  // Drag handlers
  const handleDragStart = useCallback((asset: BuilderCatalogAsset) => {
    setDraggedAsset(asset);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedAsset(null);
  }, []);

  const handleDropOnCharacter = useCallback(() => {
    if (draggedAsset) {
      equipAsset(draggedAsset);
      setDraggedAsset(null);
    }
  }, [draggedAsset, equipAsset]);

  // Get selected asset details
  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return null;
    return activeCatalogAssets.find(a => a.id === selectedAssetId) ?? null;
  }, [activeCatalogAssets, selectedAssetId]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="w-5 h-5" />
            Character Builder
          </h2>
          <p className="text-sm text-muted-foreground">
            Catalogo real runtime conectado a la biblioteca Lexury
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="hidden md:inline-flex">
            {hasRuntimeCatalog
              ? `${catalogAssets.length} runtime-ready`
              : usingFallbackCatalog
                ? 'fallback demo'
                : 'syncing catalog'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)}>
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowLoadDialog(true)}>
            <FolderOpen className="w-4 h-4 mr-1" />
            Load
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={randomizeAll}>
                <Shuffle className="w-4 h-4 mr-2" />
                Randomize
              </DropdownMenuItem>
              <DropdownMenuItem onClick={resetAll}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportPreset}>
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Categories */}
        <div className="w-48 border-r bg-muted/20">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
                const equipped = getEquippedForCategory(category as PartCategory);
                const assetsInCategory = activeCatalogAssets.filter(a => a.category === category).length;
                
                if (assetsInCategory === 0) return null;
                
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category as PartCategory)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                      selectedCategory === category
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className={selectedCategory === category ? "" : config.color}>
                      {config.icon}
                    </span>
                    <span className="flex-1 text-sm">{config.label}</span>
                    {equipped && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        <Check className="w-3 h-3" />
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Center Panel - Asset Grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search and View Toggle */}
          <div className="p-3 border-b flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search assets..."
                className="pl-9"
              />
            </div>
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "px-2 py-1.5 transition-colors",
                  viewMode === 'grid' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "px-2 py-1.5 transition-colors",
                  viewMode === 'list' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {catalogError && (
            <div className="border-b px-3 py-2 bg-amber-500/10 text-amber-200 text-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{catalogError}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadRuntimeCatalog()}>
                Retry
              </Button>
            </div>
          )}

          {/* Asset Grid */}
          <ScrollArea className="flex-1">
            <div className="p-3">
              {catalogLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-12 h-12 mx-auto mb-2 opacity-50 animate-spin" />
                  <p>Loading runtime catalog...</p>
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No assets found</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-3 gap-2">
                  {filteredAssets.map(asset => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      isSelected={selectedAssetId === asset.id}
                      isEquipped={equippedParts.get(asset.category)?.assetId === asset.id}
                      currentColor={colorOverrides.get(asset.id)}
                      onSelect={() => setSelectedAssetId(asset.id)}
                      onEquip={() => equipAsset(asset)}
                      onColorChange={(color) => changeColor(asset.id, color)}
                      onDragStart={() => handleDragStart(asset)}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredAssets.map(asset => (
                    <AssetListItem
                      key={asset.id}
                      asset={asset}
                      isSelected={selectedAssetId === asset.id}
                      isEquipped={equippedParts.get(asset.category)?.assetId === asset.id}
                      onSelect={() => setSelectedAssetId(asset.id)}
                      onEquip={() => equipAsset(asset)}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Character Preview & Properties */}
        <div className="w-72 border-l flex flex-col">
          {/* Character Preview */}
          <div 
            className="aspect-square bg-gradient-to-b from-muted to-background relative"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnCharacter}
          >
            <RuntimeAssetPreview
              runtimeUrl={selectedAsset?.runtimeUrl ?? null}
              title={selectedAsset?.name ?? 'Runtime Preview'}
            />
            
            {/* Drop indicator */}
            {draggedAsset && (
              <div className="absolute inset-0 border-2 border-dashed border-primary rounded-lg flex items-center justify-center bg-primary/10">
                <p className="text-sm font-medium text-primary">
                  Drop to equip {draggedAsset.name}
                </p>
              </div>
            )}

            {/* Equipped indicator */}
            <div className="absolute bottom-2 left-2 right-2 flex justify-center gap-1">
              {Array.from(equippedParts.entries()).map(([category, part]) => (
                <Badge key={category} variant="secondary" className="text-xs">
                  {CATEGORY_CONFIG[category]?.label ?? category}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Properties Panel */}
          <ScrollArea className="flex-1">
            {selectedAsset ? (
              <div className="p-3 space-y-4">
                <div>
                  <h3 className="font-medium">{selectedAsset.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      style={{ backgroundColor: RarityColors[selectedAsset.rarity ?? 'common'] }}
                      className="text-white text-xs"
                    >
                      {selectedAsset.rarity ?? 'common'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {selectedAsset.sourceCategory}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {selectedAsset.tags.join(', ')}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-2">
                  <div className="text-xs text-muted-foreground">Runtime</div>
                  <div className="text-sm font-medium">
                    {selectedAsset.runtimeReady ? 'Listo para preview en produccion' : 'Pendiente de conversion'}
                  </div>
                  <div className="text-xs text-muted-foreground break-all">
                    {selectedAsset.runtimeUrl ?? selectedAsset.sourceAssetPath}
                  </div>
                </div>

                {selectedAsset.colorOptions && selectedAsset.colorOptions.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Color</label>
                    <div className="flex flex-wrap gap-1">
                      {selectedAsset.colorOptions.map(color => (
                        <button
                          key={color.id}
                          onClick={() => changeColor(selectedAsset.id, color.hex)}
                          className={cn(
                            "w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110",
                            colorOverrides.get(selectedAsset.id) === color.hex
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-transparent"
                          )}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => equipAsset(selectedAsset)}
                  >
                    {equippedParts.get(selectedAsset.category)?.assetId === selectedAsset.id
                      ? "Equipped"
                      : "Equip"}
                  </Button>
                  {equippedParts.get(selectedAsset.category)?.assetId === selectedAsset.id && (
                    <Button
                      variant="outline"
                      onClick={() => unequipCategory(selectedAsset.category)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 text-center text-muted-foreground">
                <Palette className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select an asset to view properties</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Preset</DialogTitle>
            <DialogDescription>
              Save your current character configuration as a preset.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={savePreset} disabled={isSaving || !presetName.trim()}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load Preset</DialogTitle>
            <DialogDescription>
              Load a previously saved character preset.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-64">
            {isLoadingPresets ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading presets...</span>
              </div>
            ) : presetsError ? (
              <div className="space-y-3 py-6 text-center">
                <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
                <div>
                  <p className="font-medium">Preset library unavailable</p>
                  <p className="text-sm text-muted-foreground">{presetsError}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadSavedPresets()}>
                  Retry
                </Button>
              </div>
            ) : savedPresets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No saved presets</p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedPresets.map(preset => (
                  <div
                    key={preset.id}
                    className="flex items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-muted"
                  >
                    <button
                      onClick={() => loadPreset(preset)}
                      className="flex-1 text-left"
                    >
                      <div className="font-medium">{preset.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {Object.keys(preset.parts).length} parts • {new Date(preset.metadata.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deletingPresetId === preset.id}
                      onClick={() => void removePreset(preset.id)}
                      aria-label={`Delete preset ${preset.name}`}
                    >
                      {deletingPresetId === preset.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// ASSET CARD COMPONENT
// ============================================

interface AssetCardProps {
  asset: BuilderCatalogAsset;
  isSelected: boolean;
  isEquipped: boolean;
  currentColor?: string;
  onSelect: () => void;
  onEquip: () => void;
  onColorChange: (color: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function AssetCard({
  asset,
  isSelected,
  isEquipped,
  currentColor,
  onSelect,
  onEquip,
  onColorChange,
  onDragStart,
  onDragEnd,
}: AssetCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => {
        onSelect();
        if (isEquipped) return;
        onEquip();
      }}
      className={cn(
        "relative rounded-lg border-2 cursor-pointer transition-all overflow-hidden group",
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/30",
        isEquipped && "ring-2 ring-green-500/30"
      )}
    >
      {/* Thumbnail */}
      <div 
        className="aspect-square bg-muted flex items-center justify-center"
        style={{ backgroundColor: currentColor ? `${currentColor}20` : undefined }}
      >
        <Package className="w-8 h-8 text-muted-foreground/50" />
      </div>

      {/* Info */}
      <div className="p-2">
        <div className="text-xs font-medium truncate">{asset.name}</div>
        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
          {asset.subcategory ?? asset.sourceCategory}
        </div>
        <div className="flex items-center justify-between mt-1">
          <Badge variant={asset.runtimeReady ? 'default' : 'outline'} className="text-[10px] px-1">
            {asset.runtimeReady ? 'runtime' : 'fallback'}
          </Badge>
          {isEquipped && (
            <Check className="w-3 h-3 text-green-500" />
          )}
        </div>
      </div>

      {/* Quick color picker */}
      {asset.colorOptions && asset.colorOptions.length > 0 && (
        <div className="absolute bottom-12 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {asset.colorOptions.slice(0, 4).map(color => (
            <button
              key={color.id}
              onClick={(e) => {
                e.stopPropagation();
                onColorChange(color.hex);
              }}
              className="w-4 h-4 rounded-full border border-white/50"
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// ASSET LIST ITEM COMPONENT
// ============================================

interface AssetListItemProps {
  asset: BuilderCatalogAsset;
  isSelected: boolean;
  isEquipped: boolean;
  onSelect: () => void;
  onEquip: () => void;
}

function AssetListItem({
  asset,
  isSelected,
  isEquipped,
  onSelect,
  onEquip,
}: AssetListItemProps) {
  return (
    <div
      onClick={() => {
        onSelect();
        if (!isEquipped) onEquip();
      }}
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
        isSelected ? "bg-primary/10" : "hover:bg-muted"
      )}
    >
      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
        <Package className="w-5 h-5 text-muted-foreground/50" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{asset.name}</div>
        <div className="text-xs text-muted-foreground">
          {asset.subcategory ?? asset.tags.slice(0, 2).join(', ')}
        </div>
      </div>
      <Badge variant={asset.runtimeReady ? 'default' : 'outline'} className="text-xs">
        {asset.runtimeReady ? 'runtime' : 'fallback'}
      </Badge>
      {isEquipped && <Check className="w-4 h-4 text-green-500" />}
    </div>
  );
}

export default CharacterBuilderPanel;
