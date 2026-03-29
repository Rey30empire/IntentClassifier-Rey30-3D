'use client';

/**
 * NEXUS Engine - Character Library Panel Component
 * 
 * Panel de interfaz para la biblioteca de personajes.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  User, Search, Filter, Star, StarOff, Copy, Trash2, Download,
  Grid, List, Plus, Heart, Users, Bot, Sparkles, SortAsc, SortDesc,
} from 'lucide-react';
import type {
  CharacterDefinition,
  CharacterType,
  CharacterCategory,
  CharacterStyle,
  CharacterGender,
  CharacterFilters,
  CharacterSortOptions,
  CharacterSortField,
  CharacterSortOrder,
} from '@/lib/engine/characters/CharacterLibrary';

// ============================================
// CHARACTER CARD
// ============================================

interface CharacterCardProps {
  character: CharacterDefinition;
  onDragStart?: (e: React.DragEvent, character: CharacterDefinition) => void;
  onSelect?: (character: CharacterDefinition) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  viewMode: 'grid' | 'list';
}

function CharacterCard({
  character,
  onDragStart,
  onSelect,
  onDuplicate,
  onDelete,
  onToggleFavorite,
  viewMode,
}: CharacterCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const typeIcons: Record<CharacterType, React.ReactNode> = {
    human: <User className="h-4 w-4" />,
    humanoid: <Users className="h-4 w-4" />,
    animal: <span>🐾</span>,
    creature: <Sparkles className="h-4 w-4" />,
    robot: <Bot className="h-4 w-4" />,
    monster: <span>👹</span>,
    fantasy: <Sparkles className="h-4 w-4" />,
    custom: <User className="h-4 w-4" />,
  };
  
  if (viewMode === 'list') {
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart?.(e, character)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onSelect?.(character)}
        className={cn(
          'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
          'hover:bg-accent border border-transparent hover:border-border',
          'active:scale-[0.98]'
        )}
      >
        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
          {typeIcons[character.type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{character.name}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="capitalize">{character.type}</span>
            <span>•</span>
            <span className="capitalize">{character.style}</span>
          </div>
        </div>
        <div className={cn('flex items-center gap-1', isHovered ? 'opacity-100' : 'opacity-0')}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(character.id); }}
          >
            {character.isFavorite ? (
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            ) : (
              <StarOff className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, character)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect?.(character)}
      className={cn(
        'group relative rounded-lg border bg-card overflow-hidden cursor-pointer',
        'hover:border-primary/50 hover:shadow-md transition-all',
        'active:scale-[0.98]'
      )}
    >
      <div className="aspect-square bg-muted flex items-center justify-center">
        <div className="text-4xl">{typeIcons[character.type]}</div>
        {character.isFavorite && (
          <div className="absolute top-2 right-2">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          </div>
        )}
        <div className={cn(
          'absolute inset-0 bg-black/60 flex items-center justify-center gap-2 transition-opacity',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}>
          <Button variant="secondary" size="icon" className="h-8 w-8"
            onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(character.id); }}>
            {character.isFavorite ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
          </Button>
          <Button variant="secondary" size="icon" className="h-8 w-8"
            onClick={(e) => { e.stopPropagation(); onDuplicate?.(character.id); }}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" className="h-8 w-8"
            onClick={(e) => { e.stopPropagation(); onDelete?.(character.id); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-2">
        <div className="font-medium text-sm truncate">{character.name}</div>
        <div className="flex items-center gap-1 mt-1">
          <Badge variant="outline" className="text-[10px] h-5">{character.type}</Badge>
          <Badge variant="secondary" className="text-[10px] h-5">{character.category}</Badge>
        </div>
      </div>
    </div>
  );
}

// ============================================
// FILTER PANEL
// ============================================

interface FilterPanelProps {
  filters: CharacterFilters;
  onFiltersChange: (filters: CharacterFilters) => void;
  sortOptions: CharacterSortOptions;
  onSortChange: (options: CharacterSortOptions) => void;
}

function FilterPanel({ filters, onFiltersChange, sortOptions, onSortChange }: FilterPanelProps) {
  const types: CharacterType[] = ['human', 'humanoid', 'animal', 'creature', 'robot', 'monster', 'fantasy', 'custom'];
  const categories: CharacterCategory[] = ['protagonist', 'antagonist', 'npc', 'enemy', 'ally', 'civilian', 'animal', 'creature', 'robot', 'custom'];
  const styles: CharacterStyle[] = ['realistic', 'stylized', 'cartoon', 'anime', 'low_poly', 'voxel', 'pixel_art'];
  
  const updateFilter = <K extends keyof CharacterFilters>(key: K, value: CharacterFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };
  
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search characters..."
          value={filters.search || ''}
          onChange={(e) => updateFilter('search', e.target.value || undefined)}
          className="pl-9"
        />
      </div>
      
      <div className="flex gap-2">
        <Button
          variant={filters.favorites ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilter('favorites', filters.favorites ? undefined : true)}
        >
          <Heart className="h-3.5 w-3.5 mr-1" />
          Favorites
        </Button>
        <Button
          variant={filters.custom ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateFilter('custom', filters.custom ? undefined : true)}
        >
          Custom
        </Button>
      </div>
      
      <Separator />
      
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Type</Label>
        <div className="flex flex-wrap gap-1">
          {types.map((type) => (
            <Badge
              key={type}
              variant={filters.types?.includes(type) ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => {
                const current = filters.types || [];
                const updated = current.includes(type)
                  ? current.filter((t) => t !== type)
                  : [...current, type];
                updateFilter('types', updated.length > 0 ? updated : undefined);
              }}
            >
              {type}
            </Badge>
          ))}
        </div>
      </div>
      
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Category</Label>
        <Select
          value={filters.categories?.[0] || 'all'}
          onValueChange={(v) => updateFilter('categories', v === 'all' ? undefined : [v as CharacterCategory])}
        >
          <SelectTrigger className="h-8"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Style</Label>
        <Select
          value={filters.styles?.[0] || 'all'}
          onValueChange={(v) => updateFilter('styles', v === 'all' ? undefined : [v as CharacterStyle])}
        >
          <SelectTrigger className="h-8"><SelectValue placeholder="All styles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All styles</SelectItem>
            {styles.map((style) => (
              <SelectItem key={style} value={style}>{style}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <Separator />
      
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Sort By</Label>
        <div className="flex gap-2">
          <Select
            value={sortOptions.field}
            onValueChange={(v) => onSortChange({ ...sortOptions, field: v as CharacterSortField })}
          >
            <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="type">Type</SelectItem>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="date">Date</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onSortChange({ ...sortOptions, order: sortOptions.order === 'asc' ? 'desc' : 'asc' })}
          >
            {sortOptions.order === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export interface CharacterLibraryPanelProps {
  className?: string;
  characters?: CharacterDefinition[];
  onSelectCharacter?: (character: CharacterDefinition) => void;
  onDuplicateCharacter?: (characterId: string) => void;
  onDeleteCharacter?: (characterId: string) => void;
  onToggleFavorite?: (characterId: string) => void;
}

export function CharacterLibraryPanel({
  className,
  characters = [],
  onSelectCharacter,
  onDuplicateCharacter,
  onDeleteCharacter,
  onToggleFavorite,
}: CharacterLibraryPanelProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterDefinition | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<CharacterFilters>({});
  const [sortOptions, setSortOptions] = useState<CharacterSortOptions>({ field: 'name', order: 'asc' });
  
  const filteredCharacters = useMemo(() => {
    let result = [...characters];
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.description?.toLowerCase().includes(searchLower)
      );
    }
    if (filters.types?.length) {
      result = result.filter((c) => filters.types!.includes(c.type));
    }
    if (filters.categories?.length) {
      result = result.filter((c) => filters.categories!.includes(c.category));
    }
    if (filters.styles?.length) {
      result = result.filter((c) => filters.styles!.includes(c.style));
    }
    if (filters.favorites) {
      result = result.filter((c) => c.isFavorite);
    }
    if (filters.custom !== undefined) {
      result = result.filter((c) => c.isCustom === filters.custom);
    }
    
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortOptions.field) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'type': cmp = a.type.localeCompare(b.type); break;
        case 'category': cmp = a.category.localeCompare(b.category); break;
        case 'date': cmp = a.createdAt.getTime() - b.createdAt.getTime(); break;
      }
      return sortOptions.order === 'desc' ? -cmp : cmp;
    });
    
    return result;
  }, [characters, filters, sortOptions]);
  
  const handleDragStart = useCallback((e: React.DragEvent, character: CharacterDefinition) => {
    e.dataTransfer.setData('character-id', character.id);
    e.dataTransfer.setData('character-name', character.name);
  }, []);
  
  const handleSelect = useCallback((character: CharacterDefinition) => {
    setSelectedCharacter(character);
    onSelectCharacter?.(character);
  }, [onSelectCharacter]);
  
  return (
    <Card className={cn('w-80', className)}>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Character Library
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs defaultValue="library" className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-8">
            <TabsTrigger value="library" className="text-xs">
              Library ({filteredCharacters.length})
            </TabsTrigger>
            <TabsTrigger value="filters" className="text-xs">
              <Filter className="h-3 w-3 mr-1" />
              Filters
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="library" className="m-0">
            <ScrollArea className="h-[350px]">
              {filteredCharacters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">No characters found</p>
                </div>
              ) : (
                <div className={cn('p-2', viewMode === 'grid' && 'grid grid-cols-2 gap-2')}>
                  {filteredCharacters.map((character) => (
                    <CharacterCard
                      key={character.id}
                      character={character}
                      viewMode={viewMode}
                      onDragStart={handleDragStart}
                      onSelect={handleSelect}
                      onDuplicate={onDuplicateCharacter}
                      onDelete={onDeleteCharacter}
                      onToggleFavorite={onToggleFavorite}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="filters" className="m-0">
            <div className="p-3">
              <FilterPanel
                filters={filters}
                onFiltersChange={setFilters}
                sortOptions={sortOptions}
                onSortChange={setSortOptions}
              />
            </div>
          </TabsContent>
        </Tabs>
        
        <Separator />
        
        {/* Preview */}
        <div className="h-32 p-3">
          {selectedCharacter ? (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">{selectedCharacter.name}</h4>
              <div className="flex gap-1">
                <Badge>{selectedCharacter.type}</Badge>
                <Badge variant="outline">{selectedCharacter.style}</Badge>
              </div>
              <Button size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add to Scene
              </Button>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <User className="h-8 w-8 mx-auto mb-1 opacity-50" />
                <p className="text-xs">Select a character</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default CharacterLibraryPanel;
