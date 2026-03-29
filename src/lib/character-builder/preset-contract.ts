import { z } from 'zod'
import type { PartCategory } from '@/lib/character-builder/types'

export const partCategoryValues = [
  'body',
  'head',
  'hair',
  'torso',
  'arms',
  'legs',
  'shoes',
  'outfit',
  'accessory',
  'helmet',
  'gloves',
  'cape',
  'shoulder',
  'weapon',
  'back_item',
  'face_accessory',
  'wings',
  'tail',
] as const satisfies readonly PartCategory[]

const partCategorySet = new Set<PartCategory>(partCategoryValues)

const presetPartsSchema = z
  .record(z.string().trim().min(1), z.string().trim().min(1))
  .default({})
  .transform((parts) => {
    const normalizedParts: Partial<Record<PartCategory, string>> = {}

    for (const [category, assetId] of Object.entries(parts)) {
      if (partCategorySet.has(category as PartCategory)) {
        normalizedParts[category as PartCategory] = assetId
      }
    }

    return normalizedParts
  })

export const characterPresetMetadataSchema = z.object({
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  author: z.string().trim().min(1).max(120).optional(),
})

export const characterPresetPayloadSchema = z.object({
  id: z.string().trim().min(1).optional(),
  version: z.string().trim().min(1).default('1.0'),
  name: z.string().trim().min(1).max(120),
  description: z
    .union([z.string().trim().max(500), z.literal('')])
    .optional()
    .transform((value) => (value ? value : undefined)),
  baseBodyId: z.string().trim().min(1),
  parts: presetPartsSchema,
  colors: z.record(z.string().trim().min(1), z.string().trim().min(1)).default({}),
  metadata: characterPresetMetadataSchema.default({ tags: [] }),
})

export type CharacterPresetPayload = z.infer<typeof characterPresetPayloadSchema>
