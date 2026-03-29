import type { Character, CharacterPart } from '@prisma/client'
import { getDb } from '@/lib/db'
import type { FragmentationPayload, ModelAnalysis } from '@/lib/modular-lab/contracts'

type CharacterWithParts = Character & {
  parts: CharacterPart[]
}

export async function findScopedCharacter(characterId: string, sessionKey: string) {
  return getDb().character.findFirst({
    where: {
      id: characterId,
      sessionKey,
    },
    include: {
      parts: {
        orderBy: [{ partKey: 'asc' }],
      },
    },
  })
}

export function mapCharacterSummary(character: CharacterWithParts) {
  return {
    id: character.id,
    name: character.name,
    slug: character.slug,
    workflowStatus: character.workflowStatus,
    sourceFormat: character.sourceFormat,
    sourceFileName: character.sourceFileName,
    fileSize: character.fileSize,
    meshCount: character.meshCount,
    materialCount: character.materialCount,
    hasRig: character.hasRig,
    hasAnimations: character.hasAnimations,
    createdAt: character.createdAt.toISOString(),
    updatedAt: character.updatedAt.toISOString(),
    sourceDownloadUrl: `/api/modular-characters/${character.id}/download/original`,
    zipDownloadUrl: `/api/modular-characters/${character.id}/download/zip`,
    parts: character.parts.map((part) => ({
      id: part.id,
      partKey: part.partKey,
      name: part.name,
      category: part.category,
      fileFormat: part.fileFormat,
      hasRig: part.hasRig,
      meshNames: Array.isArray(part.sourceMeshNames) ? part.sourceMeshNames : [],
      downloadUrl: `/api/modular-characters/${character.id}/parts/${part.id}/download`,
    })),
    fragmentationSchema: (character.fragmentationSchema as FragmentationPayload | null) ?? undefined,
    analysis: (character.analysis as ModelAnalysis | null) ?? undefined,
  }
}
