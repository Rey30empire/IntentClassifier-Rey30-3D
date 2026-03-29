import type { FragmentationPayload, ModelAnalysis } from '@/lib/modular-lab/contracts'
import { STANDARD_PARTS } from '@/lib/modular-lab/constants'
import type { ModularCharacterPartRecord, ModularCharacterSummary } from '@/lib/modular-lab/client'

export type ModularStudioStage =
  | 'idle'
  | 'review'
  | 'uploading'
  | 'fragmenting'
  | 'saving'
  | 'ready'
  | 'error'

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  )
  const normalizedValue = value / 1024 ** unitIndex

  return `${normalizedValue.toFixed(normalizedValue >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

export function getStageProgress(stage: ModularStudioStage) {
  switch (stage) {
    case 'review':
      return 18
    case 'uploading':
      return 44
    case 'saving':
      return 62
    case 'fragmenting':
      return 82
    case 'ready':
      return 100
    case 'error':
      return 100
    default:
      return 0
  }
}

export function getStageLabel(stage: ModularStudioStage) {
  switch (stage) {
    case 'review':
      return 'Revisando modelo y metadatos'
    case 'uploading':
      return 'Subiendo modelo al backend modular'
    case 'saving':
      return 'Guardando esquema de fragmentacion'
    case 'fragmenting':
      return 'Generando modulos y publicando partes'
    case 'ready':
      return 'Listo para descargar y usar en Unity'
    case 'error':
      return 'Se detecto un problema en el flujo'
    default:
      return 'Selecciona o sube un modelo 3D'
  }
}

export function buildAssignmentsFromCharacter(
  character?: Pick<ModularCharacterSummary, 'analysis' | 'fragmentationSchema'>
) {
  const savedAssignments = character?.fragmentationSchema?.assignments

  return STANDARD_PARTS.map((part) => {
    const savedAssignment = savedAssignments?.find(
      (assignment) => assignment.partKey === part.key
    )

    return {
      partKey: part.key,
      displayName: savedAssignment?.displayName ?? part.label,
      meshNames: savedAssignment?.meshNames ?? [],
      assignmentMode: savedAssignment?.assignmentMode ?? 'manual',
      exportMode:
        savedAssignment?.exportMode ??
        (character?.analysis?.hasRig ? 'rigged_modular' : 'static_modular'),
      connectionPoint: savedAssignment?.connectionPoint ?? part.key,
      connectionTarget: savedAssignment?.connectionTarget ?? part.connectionTarget,
    }
  })
}

export function buildZipDownloadUrl(
  character: Pick<ModularCharacterSummary, 'zipDownloadUrl'>,
  exportMode: 'static_modular' | 'rigged_modular',
  partKeys: string[] = []
) {
  const searchParams = new URLSearchParams()
  searchParams.set('mode', exportMode === 'rigged_modular' ? 'unity_rigged' : 'unity_static')

  if (partKeys.length > 0) {
    searchParams.set('parts', partKeys.join(','))
  }

  return `${character.zipDownloadUrl}?${searchParams.toString()}`
}

export function getCoverageStats(
  analysis: ModelAnalysis | null,
  assignments: FragmentationPayload['assignments']
) {
  const assignedMeshIds = new Set(assignments.flatMap((assignment) => assignment.meshNames))
  const requiredParts = STANDARD_PARTS.filter((part) => part.category === 'core')
  const completedRequiredParts = requiredParts.filter((part) =>
    assignments.some(
      (assignment) =>
        assignment.partKey === part.key && assignment.meshNames.length > 0
    )
  )

  return {
    totalMeshes: analysis?.meshes.length ?? 0,
    assignedMeshes: assignedMeshIds.size,
    unassignedMeshes:
      analysis?.meshes.filter((mesh) => !assignedMeshIds.has(mesh.id)).length ?? 0,
    requiredParts: requiredParts.length,
    completedRequiredParts: completedRequiredParts.length,
    createdParts: assignments.filter((assignment) => assignment.meshNames.length > 0).length,
  }
}

export function getCompatibilityFindings(
  analysis: ModelAnalysis | null,
  assignments: FragmentationPayload['assignments'],
  parts: ModularCharacterPartRecord[] = []
) {
  const findings: string[] = []
  const requiredParts = STANDARD_PARTS.filter((part) => part.category === 'core')

  for (const requiredPart of requiredParts) {
    const assignment = assignments.find((item) => item.partKey === requiredPart.key)
    if (!assignment || assignment.meshNames.length === 0) {
      findings.push(`Falta asignar la parte obligatoria "${requiredPart.label}".`)
    }
  }

  if (analysis?.hasRig) {
    const invalidRiggedAssignments = assignments.filter(
      (assignment) =>
        assignment.exportMode === 'rigged_modular' &&
        assignment.meshNames.length > 0 &&
        !assignment.meshNames.some((meshId) =>
          analysis.meshes.some(
            (mesh) => mesh.id === meshId && mesh.hasSkinning
          )
        )
    )

    for (const assignment of invalidRiggedAssignments) {
      findings.push(
        `La parte "${assignment.displayName}" esta marcada como rigged pero no tiene meshes con skinning detectado.`
      )
    }
  }

  const duplicateMeshIds = new Set<string>()
  const visitedMeshIds = new Set<string>()
  for (const assignment of assignments) {
    for (const meshId of assignment.meshNames) {
      if (visitedMeshIds.has(meshId)) {
        duplicateMeshIds.add(meshId)
      }
      visitedMeshIds.add(meshId)
    }
  }

  if (duplicateMeshIds.size > 0) {
    findings.push(
      'Hay meshes asignados a mas de una pieza. Conviene dejar cada mesh en un solo modulo para evitar solapes al exportar.'
    )
  }

  if (parts.length > 0 && parts.some((part) => !part.hasRig) && analysis?.hasRig) {
    findings.push(
      'Algunas partes exportadas quedaron sin rig. Revisa pivotes, skinning y huesos antes de usar el paquete Unity Ready.'
    )
  }

  return findings
}
