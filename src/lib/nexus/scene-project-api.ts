import type { NexusSceneState } from '@/store/nexus-store'
import type { SceneProjectPayload } from '@/lib/nexus/scene-project-contract'
import { getClientSessionHeaders } from '@/lib/persistence/client-session'

export interface SceneProjectRecord {
  id: string
  name: string
  description?: string
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED'
  engineVersion?: string
  sceneData: NexusSceneState
  createdAt: string
  updatedAt: string
}

type ApiErrorPayload = {
  success: false
  message?: string
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

export async function fetchSceneProjects() {
  const response = await fetch('/api/scene-projects', {
    cache: 'no-store',
    headers: getClientSessionHeaders(),
  })

  const payload = (await response.json()) as
    | { success: true; projects: SceneProjectRecord[] }
    | ApiErrorPayload

  if (!response.ok || !payload.success) {
    throw new Error(
      readErrorMessage(payload, 'No se pudieron cargar los proyectos de escena.')
    )
  }

  return payload.projects
}

export async function createSceneProject(payload: SceneProjectPayload) {
  const response = await fetch('/api/scene-projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getClientSessionHeaders(),
    },
    body: JSON.stringify(payload),
  })

  const responsePayload = (await response.json()) as
    | { success: true; project: SceneProjectRecord }
    | ApiErrorPayload

  if (!response.ok || !responsePayload.success) {
    throw new Error(
      readErrorMessage(responsePayload, 'No se pudo guardar el proyecto de escena.')
    )
  }

  return responsePayload.project
}

export async function updateSceneProject(
  projectId: string,
  payload: SceneProjectPayload
) {
  const response = await fetch(`/api/scene-projects/${projectId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getClientSessionHeaders(),
    },
    body: JSON.stringify(payload),
  })

  const responsePayload = (await response.json()) as
    | { success: true; project: SceneProjectRecord }
    | ApiErrorPayload

  if (!response.ok || !responsePayload.success) {
    throw new Error(
      readErrorMessage(responsePayload, 'No se pudo actualizar el proyecto de escena.')
    )
  }

  return responsePayload.project
}

export async function deleteSceneProject(projectId: string) {
  const response = await fetch(`/api/scene-projects/${projectId}`, {
    method: 'DELETE',
    headers: getClientSessionHeaders(),
  })

  const responsePayload = (await response.json()) as
    | { success: true }
    | ApiErrorPayload

  if (!response.ok || !responsePayload.success) {
    throw new Error(
      readErrorMessage(responsePayload, 'No se pudo eliminar el proyecto de escena.')
    )
  }
}
