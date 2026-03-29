import type { CharacterPreset as DbCharacterPreset } from '@prisma/client'
import type { CharacterPreset, PartCategory } from '@/lib/character-builder/types'
import type { CharacterPresetPayload } from '@/lib/character-builder/preset-contract'
import { partCategoryValues } from '@/lib/character-builder/preset-contract'

const partCategorySet = new Set<PartCategory>(partCategoryValues)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => {
      const [, recordValue] = entry
      return typeof recordValue === 'string'
    })
  )
}

function readParts(value: unknown): Partial<Record<PartCategory, string>> {
  const record = readStringRecord(value)
  const normalizedParts: Partial<Record<PartCategory, string>> = {}

  for (const [category, assetId] of Object.entries(record)) {
    if (partCategorySet.has(category as PartCategory)) {
      normalizedParts[category as PartCategory] = assetId
    }
  }

  return normalizedParts
}

function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === 'string')
}

function readMetadata(value: unknown) {
  if (!isRecord(value)) {
    return {}
  }

  return {
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
    author: typeof value.author === 'string' ? value.author : undefined,
  }
}

export function mapDbPresetToCharacterPreset(
  preset: DbCharacterPreset
): CharacterPreset {
  const metadata = readMetadata(preset.metadata)

  return {
    version: preset.version,
    id: preset.id,
    name: preset.name,
    description: preset.description ?? undefined,
    baseBodyId: preset.baseBodyId,
    parts: readParts(preset.parts),
    colors: readStringRecord(preset.colors),
    metadata: {
      createdAt: metadata.createdAt ?? preset.createdAt.toISOString(),
      updatedAt: metadata.updatedAt ?? preset.updatedAt.toISOString(),
      tags: readTags(preset.tags),
      author: metadata.author,
    },
  }
}

export function mapPresetPayloadToCreateInput(payload: CharacterPresetPayload) {
  const timestamp = new Date().toISOString()
  const metadata: Record<string, string> = {
    createdAt: payload.metadata.createdAt ?? timestamp,
    updatedAt: timestamp,
  }

  if (payload.metadata.author) {
    metadata.author = payload.metadata.author
  }

  return {
    ...(payload.id ? { id: payload.id } : {}),
    version: payload.version,
    name: payload.name,
    description: payload.description,
    baseBodyId: payload.baseBodyId,
    parts: payload.parts,
    colors: payload.colors,
    tags: payload.metadata.tags,
    metadata,
  }
}
