import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface RuntimeRegistryStats {
  assets: number
  scenes: number
  runtime_ready_assets: number
  procedural_scenes: number
}

export interface RuntimeRegistryAssetRecord {
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
}

export interface RuntimeRegistrySceneRecord {
  scene_id: string
  title: string
  scene_path: string
  category: string
  scene_kind: string
  runtime: string
  source_type: string
  launch: {
    build_mode: string | null
    package_json: string | null
    entry_html: string | null
    primary_script: string | null
    npm_scripts: Record<string, string>
    recommended_command: string | null
  }
  stats: {
    code_files: number
    binary_assets: number
  }
}

export interface RuntimeRegistryDocument {
  generated_at: string
  stats: RuntimeRegistryStats
  assets: RuntimeRegistryAssetRecord[]
  scenes: RuntimeRegistrySceneRecord[]
}

export interface RuntimeRegistryAssetView extends RuntimeRegistryAssetRecord {
  runtimeUrl: string | null
  family: string
  label: string
}

const REGISTRY_RELATIVE_PATH = path.join('public', 'assets', 'registro_motor.json')

function getRegistryFilePath() {
  return path.join(process.cwd(), REGISTRY_RELATIVE_PATH)
}

export async function readRuntimeRegistryFromDisk(): Promise<RuntimeRegistryDocument> {
  const registryPath = getRegistryFilePath()
  const fileContents = await fs.readFile(registryPath, 'utf8')
  return JSON.parse(fileContents) as RuntimeRegistryDocument
}

export function resolveRuntimeAssetUrl(entry: string | null) {
  if (!entry) return null
  return `/assets/${entry}`
}

export function getAssetFamily(category: string) {
  return category.split('/')[0] ?? category
}

export function formatRegistryCategoryLabel(category: string) {
  return category
    .split('/')
    .map((segment) => segment.replaceAll('_', ' '))
    .join(' / ')
}

export function toRuntimeAssetView(asset: RuntimeRegistryAssetRecord): RuntimeRegistryAssetView {
  return {
    ...asset,
    runtimeUrl: resolveRuntimeAssetUrl(asset.preferred_runtime_entry),
    family: getAssetFamily(asset.category),
    label: formatRegistryCategoryLabel(asset.category),
  }
}

export function sortRuntimeAssets(
  assets: RuntimeRegistryAssetRecord[]
): RuntimeRegistryAssetView[] {
  return assets
    .map(toRuntimeAssetView)
    .sort((left, right) => {
      if (left.runtime_ready !== right.runtime_ready) {
        return left.runtime_ready ? -1 : 1
      }

      return left.asset_id.localeCompare(right.asset_id)
    })
}
