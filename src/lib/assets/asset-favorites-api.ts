import { getClientSessionHeaders } from '@/lib/persistence/client-session'

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

export async function fetchAssetFavorites() {
  const response = await fetch('/api/asset-favorites', {
    cache: 'no-store',
    headers: getClientSessionHeaders(),
  })

  const payload = (await response.json()) as
    | { success: true; favorites: string[] }
    | ApiErrorPayload

  if (!response.ok || !payload.success) {
    throw new Error(readErrorMessage(payload, 'No se pudieron cargar los favoritos.'))
  }

  return payload.favorites
}

export async function saveAssetFavorite(payload: {
  assetId: string
  category: string
  subcategory?: string
}) {
  const response = await fetch('/api/asset-favorites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getClientSessionHeaders(),
    },
    body: JSON.stringify(payload),
  })

  const responsePayload = (await response.json()) as
    | { success: true }
    | ApiErrorPayload

  if (!response.ok || !responsePayload.success) {
    throw new Error(readErrorMessage(responsePayload, 'No se pudo guardar el favorito.'))
  }
}

export async function deleteAssetFavorite(assetId: string) {
  const response = await fetch(`/api/asset-favorites/${assetId}`, {
    method: 'DELETE',
    headers: getClientSessionHeaders(),
  })

  const responsePayload = (await response.json()) as
    | { success: true }
    | ApiErrorPayload

  if (!response.ok || !responsePayload.success) {
    throw new Error(readErrorMessage(responsePayload, 'No se pudo eliminar el favorito.'))
  }
}
