import { z } from 'zod'

const sceneVectorSchema = z.tuple([z.number(), z.number(), z.number()])

const sceneObjectSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: z.enum(['mesh', 'light', 'camera', 'empty', 'armature']),
  dataBlockId: z.string().trim().min(1).optional(),
  transform: z.object({
    position: sceneVectorSchema,
    rotation: sceneVectorSchema,
    scale: sceneVectorSchema,
  }),
  children: z.array(z.string().trim().min(1)),
  parentId: z.string().trim().min(1).optional(),
  visible: z.boolean(),
  locked: z.boolean(),
})

export const nexusSceneStateSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  objects: z.array(sceneObjectSchema),
  selectedObjects: z.array(z.string().trim().min(1)),
  activeObject: z.string().trim().min(1).optional(),
})

export const sceneProjectPayloadSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  description: z
    .union([z.string().trim().max(500), z.literal('')])
    .optional()
    .transform((value) => (value ? value : undefined)),
  status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  engineVersion: z.string().trim().min(1).max(40).optional(),
  sceneData: nexusSceneStateSchema,
})

export type SceneProjectPayload = z.infer<typeof sceneProjectPayloadSchema>
