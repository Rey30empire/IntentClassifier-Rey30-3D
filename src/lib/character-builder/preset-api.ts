import type { CharacterPreset } from '@/lib/character-builder/types'
import type { CharacterPresetPayload } from '@/lib/character-builder/preset-contract'
import { getClientSessionHeaders } from '@/lib/persistence/client-session'

type ApiErrorPayload = {
  success: false
  error?: string
  message?: string
}

type PresetListPayload = {
  success: true
  presets: CharacterPreset[]
}

type PresetMutationPayload = {
  success: true
  preset: CharacterPreset
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

export async function fetchCharacterPresets() {
  const response = await fetch('/api/character-presets', {
    cache: 'no-store',
    headers: getClientSessionHeaders(),
  })

  const payload = (await response.json()) as PresetListPayload | ApiErrorPayload

  if (!response.ok || !payload.success) {
    throw new Error(
      readErrorMessage(payload, 'No se pudieron cargar los presets guardados.')
    )
  }

  return payload.presets
}

export async function createCharacterPreset(payload: CharacterPresetPayload) {
  const response = await fetch('/api/character-presets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getClientSessionHeaders(),
    },
    body: JSON.stringify(payload),
  })

  const responsePayload = (await response.json()) as
    | PresetMutationPayload
    | ApiErrorPayload

  if (!response.ok || !responsePayload.success) {
    throw new Error(
      readErrorMessage(responsePayload, 'No se pudo guardar el preset.')
    )
  }

  return responsePayload.preset
}

export async function deleteCharacterPreset(presetId: string) {
  const response = await fetch(`/api/character-presets/${presetId}`, {
    method: 'DELETE',
    headers: getClientSessionHeaders(),
  })

  const responsePayload = (await response.json()) as
    | { success: true }
    | ApiErrorPayload

  if (!response.ok || !responsePayload.success) {
    throw new Error(
      readErrorMessage(responsePayload, 'No se pudo eliminar el preset.')
    )
  }
}
