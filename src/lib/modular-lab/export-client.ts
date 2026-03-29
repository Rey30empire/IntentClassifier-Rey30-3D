import {
  Box3,
  Group,
  Mesh,
  Object3D,
  Vector3,
} from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { FragmentationPayload, ModelAnalysis, PartBatchManifest } from '@/lib/modular-lab/contracts'
import { AUTO_FRAGMENT_KEYWORDS, STANDARD_PARTS } from '@/lib/modular-lab/constants'

export type FragmentAssignment = FragmentationPayload['assignments'][number]

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[\s_.-]+/g, '')
}

export function buildEmptyAssignments(): FragmentAssignment[] {
  return STANDARD_PARTS.map((part) => ({
    partKey: part.key,
    displayName: part.label,
    meshNames: [] as string[],
    assignmentMode: 'manual' as const,
    exportMode: 'static_modular' as const,
    connectionPoint: part.key,
    connectionTarget: part.connectionTarget,
  }))
}

export function buildAutoAssignments(analysis: ModelAnalysis): FragmentAssignment[] {
  const assignments = buildEmptyAssignments()

  for (const mesh of analysis.meshes) {
    const normalizedMeshName = normalizeName(mesh.name)

    for (const assignment of assignments) {
      const keywords = AUTO_FRAGMENT_KEYWORDS[assignment.partKey] ?? []
      if (keywords.some((keyword) => normalizedMeshName.includes(normalizeName(keyword)))) {
        assignment.meshNames.push(mesh.id)
        assignment.assignmentMode = 'auto'
        assignment.exportMode = analysis.hasRig ? 'rigged_modular' : 'static_modular'
        break
      }
    }
  }

  return assignments
}

function pruneCloneToMeshes(root: Object3D, meshIds: Set<string>) {
  const removableNodes: Object3D[] = []

  root.traverse((node) => {
    if ((node as Mesh).isMesh) {
      const meshId = (node.userData.meshSelectionId as string | undefined) ?? node.name ?? node.uuid
      if (!meshIds.has(meshId)) {
        removableNodes.push(node)
      }
    }
  })

  for (const node of removableNodes) {
    node.parent?.remove(node)
  }
}

function collectPartMetadata(root: Object3D) {
  const materials = new Set<string>()
  const textures = new Set<string>()
  const bones = new Set<string>()
  let hasRig = false

  root.traverse((node) => {
    if ((node as Mesh).isMesh) {
      const mesh = node as Mesh & {
        material: unknown
        skeleton?: { bones: Array<{ name: string }> }
      }

      const materialList = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materialList) {
        if (!material || typeof material !== 'object') continue
        const materialName = 'name' in material && typeof material.name === 'string'
          ? material.name
          : 'material'
        materials.add(materialName)

        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'] as const) {
          const texture = material[key]
          if (
            texture &&
            typeof texture === 'object' &&
            'name' in texture &&
            typeof texture.name === 'string' &&
            texture.name
          ) {
            textures.add(texture.name)
          }
        }
      }

      if ('skeleton' in mesh && mesh.skeleton) {
        hasRig = true
        for (const bone of mesh.skeleton.bones) {
          if (bone.name) {
            bones.add(bone.name)
          }
        }
      }
    }
  })

  const boundingBox = new Box3().setFromObject(root)
  const min = boundingBox.min.clone()
  const max = boundingBox.max.clone()
  const center = boundingBox.getCenter(new Vector3())

  return {
    materialNames: Array.from(materials),
    textureNames: Array.from(textures),
    boneNames: Array.from(bones),
    hasRig,
    pivot: [center.x, center.y, center.z] as [number, number, number],
    scale: [root.scale.x, root.scale.y, root.scale.z] as [number, number, number],
    boundingBox: {
      min: [min.x, min.y, min.z] as [number, number, number],
      max: [max.x, max.y, max.z] as [number, number, number],
    },
  }
}

function exportGroupToGlb(root: Object3D) {
  const exporter = new GLTFExporter()

  return new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      root,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result)
          return
        }

        resolve(new TextEncoder().encode(JSON.stringify(result)).buffer)
      },
      (error) => {
        reject(error)
      },
      { binary: true }
    )
  })
}

export async function exportFragmentAssignmentsToGlb(options: {
  sourceRoot: Object3D
  characterName: string
  analysis: ModelAnalysis
  assignments: FragmentAssignment[]
}) {
  const files: Array<{ partKey: string; file: Blob; fileName: string }> = []
  const manifestAssignments: PartBatchManifest['assignments'] = []

  for (const assignment of options.assignments) {
    if (assignment.meshNames.length === 0) {
      continue
    }

    const clone = SkeletonUtils.clone(options.sourceRoot)
    const exportRoot = new Group()
    exportRoot.name = assignment.displayName
    exportRoot.add(clone)

    pruneCloneToMeshes(exportRoot, new Set(assignment.meshNames))
    const metadata = collectPartMetadata(exportRoot)

    const buffer = await exportGroupToGlb(exportRoot)
    const fileName = `${assignment.partKey}.glb`

    files.push({
      partKey: assignment.partKey,
      file: new Blob([buffer], { type: 'model/gltf-binary' }),
      fileName,
    })

    const standardPart = STANDARD_PARTS.find((part) => part.key === assignment.partKey)

    manifestAssignments.push({
      partKey: assignment.partKey,
      displayName: assignment.displayName,
      category: standardPart?.category ?? 'extra',
      assignmentMode: assignment.assignmentMode,
      exportMode: assignment.exportMode,
      meshNames: assignment.meshNames,
      fileName,
      format: 'glb',
      hasRig: metadata.hasRig,
      boneNames: metadata.boneNames,
      materialNames: metadata.materialNames,
      textureNames: metadata.textureNames,
      pivot: metadata.pivot,
      scale: metadata.scale,
      boundingBox: metadata.boundingBox,
      connectionPoint: assignment.connectionPoint,
      connectionTarget: assignment.connectionTarget,
    })
  }

  return {
    files,
    manifest: {
      characterName: options.characterName,
      analysis: options.analysis,
      assignments: manifestAssignments,
    } satisfies PartBatchManifest,
  }
}
