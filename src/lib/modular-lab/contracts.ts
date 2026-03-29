import { z } from 'zod'
import { STANDARD_PARTS } from '@/lib/modular-lab/constants'

const vector3Schema = z.tuple([z.number(), z.number(), z.number()])

export const modelMeshDescriptorSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  materialNames: z.array(z.string()),
  hasSkinning: z.boolean(),
  boneNames: z.array(z.string()),
  pivot: vector3Schema,
  scale: vector3Schema,
  boundingBox: z.object({
    min: vector3Schema,
    max: vector3Schema,
  }),
})

export const modelAnalysisSchema = z.object({
  name: z.string().trim().min(1),
  format: z.string().trim().min(1),
  size: z.number().int().nonnegative(),
  meshCount: z.number().int().nonnegative(),
  materialCount: z.number().int().nonnegative(),
  hasRig: z.boolean(),
  boneCount: z.number().int().nonnegative(),
  animationCount: z.number().int().nonnegative(),
  hasAnimations: z.boolean(),
  meshes: z.array(modelMeshDescriptorSchema),
})

export const fragmentationAssignmentSchema = z.object({
  partKey: z.enum(STANDARD_PARTS.map((part) => part.key) as [string, ...string[]]),
  displayName: z.string().trim().min(1),
  meshNames: z.array(z.string().trim().min(1)),
  assignmentMode: z.enum(['auto', 'manual']).default('manual'),
  exportMode: z.enum(['static_modular', 'rigged_modular']).default('static_modular'),
  connectionPoint: z.string().trim().min(1).optional(),
  connectionTarget: z.string().trim().min(1).optional(),
})

export const fragmentationPayloadSchema = z.object({
  mode: z.enum(['auto', 'manual']),
  assignments: z.array(fragmentationAssignmentSchema),
  analysis: modelAnalysisSchema,
})

export const partBatchManifestItemSchema = z.object({
  partKey: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  category: z.string().trim().min(1),
  assignmentMode: z.enum(['auto', 'manual']),
  exportMode: z.enum(['static_modular', 'rigged_modular']),
  meshNames: z.array(z.string().trim().min(1)),
  fileName: z.string().trim().min(1),
  format: z.string().trim().min(1),
  hasRig: z.boolean(),
  boneNames: z.array(z.string()),
  materialNames: z.array(z.string()),
  textureNames: z.array(z.string()),
  pivot: vector3Schema,
  scale: vector3Schema,
  boundingBox: z.object({
    min: vector3Schema,
    max: vector3Schema,
  }),
  connectionPoint: z.string().trim().min(1).optional(),
  connectionTarget: z.string().trim().min(1).optional(),
})

export const partBatchManifestSchema = z.object({
  characterName: z.string().trim().min(1),
  analysis: modelAnalysisSchema,
  assignments: z.array(partBatchManifestItemSchema),
})

export type ModelAnalysis = z.infer<typeof modelAnalysisSchema>
export type FragmentationPayload = z.infer<typeof fragmentationPayloadSchema>
export type PartBatchManifest = z.infer<typeof partBatchManifestSchema>
