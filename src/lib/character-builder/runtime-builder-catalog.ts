import { CategoryToSocket, type AssetMetadata, type PartCategory } from '@/lib/character-builder/types'

export interface RuntimeRegistryBuilderAsset {
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

export interface RuntimeRegistryResponse {
  generatedAt: string
  stats: {
    assets: number
    scenes: number
    runtime_ready_assets: number
    procedural_scenes: number
  }
  assets: RuntimeRegistryBuilderAsset[]
  scenes: Array<{
    scene_id: string
    title: string
    scene_path: string
    category: string
    scene_kind: string
    runtime: string
  }>
}

export interface BuilderCatalogAsset extends AssetMetadata {
  runtimeUrl: string | null
  runtimeReady: boolean
  sourceCategory: string
  sourceFamily: string
  sourceAssetId: string
  sourceAssetPath: string
}

function humanize(value: string) {
  return value
    .replaceAll(/[_+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function inferBuilderCategory(asset: RuntimeRegistryBuilderAsset): PartCategory | null {
  if (asset.family === 'personajes') {
    return 'body'
  }

  if (asset.category === 'props/Armas') {
    return 'weapon'
  }

  if (asset.category === 'props/Vestuario') {
    if (/(heel|shoe|boot|sneaker|sandals?)/i.test(asset.asset_id)) {
      return 'shoes'
    }

    return 'outfit'
  }

  if (asset.family === 'entornos') {
    return 'back_item'
  }

  return null
}

function inferSocket(category: PartCategory) {
  return CategoryToSocket[category]?.[0] ?? 'torso_socket'
}

function inferRarity(asset: RuntimeRegistryBuilderAsset, category: PartCategory) {
  if (category === 'weapon') return 'epic'
  if (category === 'back_item') return 'rare'
  if (asset.duplicate_variants > 1) return 'rare'
  if (asset.source_archives > 2) return 'uncommon'
  return 'common'
}

export function createFallbackBuilderCatalog(
  assets: AssetMetadata[]
): BuilderCatalogAsset[] {
  return assets.map((asset) => ({
    ...asset,
    runtimeUrl: null,
    runtimeReady: false,
    sourceCategory: 'legacy/mock',
    sourceFamily: 'legacy',
    sourceAssetId: asset.id,
    sourceAssetPath: asset.modelPath,
  }))
}

export function buildCatalogAssetsFromRuntimeRegistry(
  registry: RuntimeRegistryResponse
): BuilderCatalogAsset[] {
  const mappedAssets = registry.assets
    .filter((asset) => asset.runtime_ready)
    .flatMap<BuilderCatalogAsset>((asset) => {
      const builderCategory = inferBuilderCategory(asset)
      if (!builderCategory) {
        return []
      }

      return [
        {
          id: asset.asset_id,
          name: humanize(asset.asset_id),
          description: `Asset real de ${asset.label}`,
          category: builderCategory,
          subcategory: asset.label,
          tags: [asset.family, asset.label, asset.runtime_ready ? 'runtime-ready' : 'pending'],
          modelPath: asset.runtimeUrl ?? asset.asset_path,
          thumbnailPath: undefined,
          skeletonId: asset.family === 'personajes' ? 'runtime_character_catalog' : 'runtime_asset_catalog',
          bodyTypes: ['universal'],
          attachmentSocket: inferSocket(builderCategory),
          enabled: asset.runtime_ready,
          rarity: inferRarity(asset, builderCategory),
          author: 'Lexury Runtime Library',
          runtimeUrl: asset.runtimeUrl,
          runtimeReady: asset.runtime_ready,
          sourceCategory: asset.category,
          sourceFamily: asset.family,
          sourceAssetId: asset.asset_id,
          sourceAssetPath: asset.asset_path,
        },
      ]
    })

  return mappedAssets.sort((left, right) => {
      if (left.category !== right.category) {
        return left.category.localeCompare(right.category)
      }

      return left.name.localeCompare(right.name)
    })
}
