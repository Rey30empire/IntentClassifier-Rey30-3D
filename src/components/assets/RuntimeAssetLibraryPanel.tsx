'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/use-toast'
import {
  deleteAssetFavorite,
  fetchAssetFavorites,
  saveAssetFavorite,
} from '@/lib/assets/asset-favorites-api'
import { cn } from '@/lib/utils'
import {
  Box,
  Copy,
  FolderTree,
  Loader2,
  Package,
  Search,
  Sparkles,
  Star,
  TriangleAlert,
} from 'lucide-react'
import { RuntimeAssetPreview } from '@/components/assets/RuntimeAssetPreview'

interface RuntimeAssetView {
  asset_id: string
  asset_path: string
  category: string
  preferred_runtime_entry: string | null
  source_archives: number
  geometry_glb: number
  geometry_fbx: number
  geometry_stl: number
  textures: number
  imports: number
  duplicate_variants: number
  runtime_ready: boolean
  runtimeUrl: string | null
  family: string
  label: string
}

interface RuntimeSceneRecord {
  scene_id: string
  title: string
  scene_path: string
  category: string
  scene_kind: string
  runtime: string
}

interface RuntimeRegistryResponse {
  generatedAt: string
  stats: {
    assets: number
    scenes: number
    runtime_ready_assets: number
    procedural_scenes: number
  }
  assets: RuntimeAssetView[]
  scenes: RuntimeSceneRecord[]
}

const familyLabels: Record<string, string> = {
  personajes: 'Personajes',
  entornos: 'Entornos',
  props: 'Props',
  animaciones: 'Animaciones',
  por_clasificar: 'Por clasificar',
}

export function RuntimeAssetLibraryPanel() {
  const [registry, setRegistry] = useState<RuntimeRegistryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'ready' | 'pending'>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [favoritingAssetId, setFavoritingAssetId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadRegistry() {
      try {
        setLoading(true)
        setError(null)

        const [registryResponse, favoriteAssetIds] = await Promise.all([
          fetch('/api/assets/registry', { cache: 'no-store' }),
          fetchAssetFavorites().catch(() => []),
        ])
        const payload = (await registryResponse.json()) as RuntimeRegistryResponse & {
          message?: string
        }

        if (!registryResponse.ok) {
          throw new Error(payload.message ?? 'No se pudo cargar el catalogo runtime.')
        }

        if (!active) return

        setRegistry(payload)
        setSelectedAssetId(payload.assets[0]?.asset_id ?? null)
        setFavoriteIds(new Set(favoriteAssetIds))
      } catch (caughtError) {
        if (!active) return
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'No se pudo cargar el catalogo runtime.'
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadRegistry()

    return () => {
      active = false
    }
  }, [])

  const filteredAssets = useMemo(() => {
    if (!registry) return []

    return registry.assets.filter((asset) => {
      if (familyFilter !== 'all' && asset.family !== familyFilter) {
        return false
      }

      if (availabilityFilter === 'ready' && !asset.runtime_ready) {
        return false
      }

      if (availabilityFilter === 'pending' && asset.runtime_ready) {
        return false
      }

      if (favoritesOnly && !favoriteIds.has(asset.asset_id)) {
        return false
      }

      if (!search.trim()) {
        return true
      }

      const term = search.toLowerCase()
      return (
        asset.asset_id.toLowerCase().includes(term) ||
        asset.asset_path.toLowerCase().includes(term) ||
        asset.label.toLowerCase().includes(term)
      )
    })
  }, [availabilityFilter, favoriteIds, familyFilter, favoritesOnly, registry, search])

  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return filteredAssets[0] ?? null
    return (
      filteredAssets.find((asset) => asset.asset_id === selectedAssetId) ??
      filteredAssets[0] ??
      null
    )
  }, [filteredAssets, selectedAssetId])

  async function handleCopy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopyState(key)
      window.setTimeout(() => setCopyState((current) => (current === key ? null : current)), 1500)
    } catch (caughtError) {
      console.error('Clipboard error:', caughtError)
    }
  }

  async function handleToggleFavorite(asset: RuntimeAssetView) {
    try {
      setFavoritingAssetId(asset.asset_id)

      if (favoriteIds.has(asset.asset_id)) {
        await deleteAssetFavorite(asset.asset_id)
        setFavoriteIds((current) => {
          const next = new Set(current)
          next.delete(asset.asset_id)
          return next
        })
      } else {
        await saveAssetFavorite({
          assetId: asset.asset_id,
          category: asset.category,
          subcategory: asset.label,
        })
        setFavoriteIds((current) => new Set([...current, asset.asset_id]))
      }
    } catch (caughtError) {
      toast({
        variant: 'destructive',
        title: 'No se pudo actualizar favorito',
        description:
          caughtError instanceof Error
            ? caughtError.message
            : 'No se pudo actualizar el favorito del asset.',
      })
    } finally {
      setFavoritingAssetId(null)
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border/30 px-4 py-3 bg-secondary/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FolderTree className="w-5 h-5" />
              Biblioteca Runtime
            </h2>
            <p className="text-sm text-muted-foreground">
              Catalogo real desde <code>/assets/registro_motor.json</code>
            </p>
          </div>
          {registry && (
            <div className="flex flex-wrap gap-2 justify-end">
              <Badge variant="secondary">{registry.stats.assets} assets</Badge>
              <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {registry.stats.runtime_ready_assets} runtime-ready
              </Badge>
              <Badge variant="outline">{registry.stats.scenes} escenas</Badge>
            </div>
          )}
        </div>
      </div>

      <div className="border-b border-border/30 p-3 flex gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por asset_id, ruta o categoria..."
            className="pl-9"
          />
        </div>
        <Select value={familyFilter} onValueChange={setFamilyFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Familia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las familias</SelectItem>
            {registry &&
              Array.from(new Set(registry.assets.map((asset) => asset.family))).map((family) => (
                <SelectItem key={family} value={family}>
                  {familyLabels[family] ?? family}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select
          value={availabilityFilter}
          onValueChange={(value) => setAvailabilityFilter(value as 'all' | 'ready' | 'pending')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Disponibilidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ready">Solo runtime-ready</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={favoritesOnly ? 'default' : 'outline'}
          className="gap-2"
          onClick={() => setFavoritesOnly((current) => !current)}
        >
          <Star className="w-4 h-4" />
          Favoritos
        </Button>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="w-[44%] border-r border-border/30 min-h-0">
          <ScrollArea className="h-full">
            {loading ? (
              <PanelState
                icon={<Loader2 className="w-8 h-8 animate-spin" />}
                title="Cargando catalogo"
                description="Leyendo el registro runtime y preparando la biblioteca real."
              />
            ) : error ? (
              <PanelState
                icon={<TriangleAlert className="w-8 h-8 text-amber-400" />}
                title="No se pudo cargar"
                description={error}
              />
            ) : filteredAssets.length === 0 ? (
              <PanelState
                icon={<Search className="w-8 h-8" />}
                title="Sin resultados"
                description="Prueba cambiando los filtros o el termino de busqueda."
              />
            ) : (
              <div className="p-3 space-y-2">
                {filteredAssets.map((asset) => (
                  <div
                    key={asset.asset_id}
                    className={cn(
                      'rounded-xl border p-3 transition-colors',
                      selectedAsset?.asset_id === asset.asset_id
                        ? 'border-holo-cyan/40 bg-holo-cyan/10'
                        : 'border-border/40 bg-card hover:bg-accent/50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedAssetId(asset.asset_id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{asset.asset_id}</div>
                            <div className="text-xs text-muted-foreground truncate">{asset.label}</div>
                          </div>
                          <Badge
                            className={cn(
                              asset.runtime_ready
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            )}
                          >
                            {asset.runtime_ready ? 'Ready' : 'Pendiente'}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span>GLB: {asset.geometry_glb}</span>
                          <span>FBX: {asset.geometry_fbx}</span>
                          <span>STL: {asset.geometry_stl}</span>
                          <span>ZIP/TAR: {asset.source_archives}</span>
                        </div>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        disabled={favoritingAssetId === asset.asset_id}
                        onClick={() => void handleToggleFavorite(asset)}
                      >
                        {favoritingAssetId === asset.asset_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Star
                            className={cn(
                              'w-4 h-4',
                              favoriteIds.has(asset.asset_id)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-muted-foreground'
                            )}
                          />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {selectedAsset ? (
                <Card className="border-border/40 bg-card/80">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3">
                      <span className="truncate">{selectedAsset.asset_id}</span>
                      <Badge
                        className={cn(
                          selectedAsset.runtime_ready
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        )}
                      >
                        {selectedAsset.runtime_ready ? 'Runtime listo' : 'Requiere conversion'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RuntimeAssetPreview
                      runtimeUrl={selectedAsset.runtimeUrl}
                      title={selectedAsset.asset_id}
                    />

                    <div className="rounded-xl border border-dashed border-border/50 bg-secondary/20 p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-holo-cyan/10 flex items-center justify-center border border-holo-cyan/20">
                          {selectedAsset.runtime_ready ? (
                            <Sparkles className="w-6 h-6 text-holo-cyan" />
                          ) : (
                            <Package className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">Registro real conectado</p>
                          <p className="text-sm text-muted-foreground">
                            El preview usa la URL runtime publicada desde la biblioteca Lexury normalizada.
                          </p>
                        </div>
                      </div>
                    </div>

                    <DetailRow label="Categoria" value={selectedAsset.label} />
                    <DetailRow label="Ruta interna" value={selectedAsset.asset_path} />
                    <DetailRow
                      label="Entrada runtime"
                      value={selectedAsset.preferred_runtime_entry ?? 'No disponible'}
                    />
                    <DetailRow
                      label="URL publica"
                      value={selectedAsset.runtimeUrl ?? 'No disponible'}
                    />

                    <Separator />

                    <div className="grid grid-cols-2 gap-3">
                      <MetricCard label="GLB" value={selectedAsset.geometry_glb} />
                      <MetricCard label="FBX" value={selectedAsset.geometry_fbx} />
                      <MetricCard label="STL" value={selectedAsset.geometry_stl} />
                      <MetricCard label="Archivos fuente" value={selectedAsset.source_archives} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={favoriteIds.has(selectedAsset.asset_id) ? 'default' : 'outline'}
                        onClick={() => void handleToggleFavorite(selectedAsset)}
                        className="gap-2"
                        disabled={favoritingAssetId === selectedAsset.asset_id}
                      >
                        {favoritingAssetId === selectedAsset.asset_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Star
                            className={cn(
                              'w-4 h-4',
                              favoriteIds.has(selectedAsset.asset_id) && 'fill-amber-400 text-amber-400'
                            )}
                          />
                        )}
                        {favoriteIds.has(selectedAsset.asset_id) ? 'Quitar favorito' : 'Marcar favorito'}
                      </Button>
                      {selectedAsset.runtimeUrl && (
                        <Button
                          onClick={() => handleCopy(selectedAsset.runtimeUrl!, 'runtime-url')}
                          className="gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          {copyState === 'runtime-url' ? 'URL copiada' : 'Copiar URL runtime'}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => handleCopy(selectedAsset.asset_id, 'asset-id')}
                        className="gap-2"
                      >
                        <Box className="w-4 h-4" />
                        {copyState === 'asset-id' ? 'ID copiado' : 'Copiar asset_id'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <PanelState
                  icon={<Package className="w-8 h-8" />}
                  title="Selecciona un asset"
                  description="Elige un asset del catalogo para ver sus datos runtime."
                />
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

function PanelState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="h-full min-h-[320px] flex items-center justify-center text-center p-8">
      <div className="space-y-3 max-w-sm">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-secondary/30 border border-border/40 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="rounded-lg bg-secondary/20 border border-border/30 px-3 py-2 text-sm break-all">
        {value}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  )
}

export default RuntimeAssetLibraryPanel
