import type { FragmentationPayload, ModelAnalysis, PartBatchManifest } from '@/lib/modular-lab/contracts'
import { getClientSessionHeaders } from '@/lib/persistence/client-session'

export interface ModularCharacterSummary {
  id: string
  name: string
  slug: string
  workflowStatus: string
  sourceFormat: string
  sourceFileName: string
  fileSize: number
  meshCount: number
  materialCount: number
  hasRig: boolean
  hasAnimations: boolean
  createdAt: string
  updatedAt: string
  sourceDownloadUrl: string
  zipDownloadUrl: string
  parts: ModularCharacterPartRecord[]
  fragmentationSchema?: FragmentationPayload
  analysis?: ModelAnalysis
}

export interface ModularCharacterPartRecord {
  id: string
  partKey: string
  name: string
  category: string
  fileFormat: string
  hasRig: boolean
  meshNames: string[]
  downloadUrl: string
}

function readErrorMessage(payload: unknown, fallbackMessage: string) {
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message
  }

  return fallbackMessage
}

export async function fetchModularCharacters() {
  const response = await fetch('/api/modular-characters', {
    cache: 'no-store',
    headers: getClientSessionHeaders(),
  })

  const payload = (await response.json()) as
    | { success: true; characters: ModularCharacterSummary[] }
    | { success: false; message?: string }

  if (!response.ok || !payload.success) {
    throw new Error(
      readErrorMessage(payload, 'No se pudo cargar la biblioteca modular.')
    )
  }

  return payload.characters
}

export async function uploadModularCharacter(file: File, analysis: ModelAnalysis) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('analysis', JSON.stringify(analysis))

  const response = await fetch('/api/modular-characters', {
    method: 'POST',
    headers: getClientSessionHeaders(),
    body: formData,
  })

  const payload = (await response.json()) as
    | { success: true; character: ModularCharacterSummary }
    | { success: false; message?: string }

  if (!response.ok || !payload.success) {
    throw new Error(
      readErrorMessage(payload, 'No se pudo subir el personaje.')
    )
  }

  return payload.character
}

export async function saveFragmentationSchema(
  characterId: string,
  payload: FragmentationPayload
) {
  const response = await fetch(`/api/modular-characters/${characterId}/fragmentation`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getClientSessionHeaders(),
    },
    body: JSON.stringify(payload),
  })

  const responsePayload = (await response.json()) as
    | { success: true; character: ModularCharacterSummary }
    | { success: false; message?: string }

  if (!response.ok || !responsePayload.success) {
    throw new Error(
      readErrorMessage(responsePayload, 'No se pudo guardar la fragmentacion.')
    )
  }

  return responsePayload.character
}

export async function uploadFragmentedParts(options: {
  characterId: string
  manifest: PartBatchManifest
  files: Array<{ partKey: string; file: Blob; fileName: string }>
}) {
  const formData = new FormData()
  formData.append('manifest', JSON.stringify(options.manifest))

  for (const fileEntry of options.files) {
    formData.append(fileEntry.partKey, fileEntry.file, fileEntry.fileName)
  }

  const response = await fetch(`/api/modular-characters/${options.characterId}/parts/batch`, {
    method: 'POST',
    headers: getClientSessionHeaders(),
    body: formData,
  })

  const payload = (await response.json()) as
    | { success: true; character: ModularCharacterSummary }
    | { success: false; message?: string }

  if (!response.ok || !payload.success) {
    throw new Error(
      readErrorMessage(payload, 'No se pudieron guardar las partes fragmentadas.')
    )
  }

  return payload.character
}
