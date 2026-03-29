const CLIENT_SESSION_STORAGE_KEY = 'intent-classifier-rey30-3d.session-key'
const CLIENT_SESSION_HEADER = 'x-client-session-key'

export function getClientSessionKey() {
  if (typeof window === 'undefined') {
    return null
  }

  const existingSessionKey = window.localStorage.getItem(CLIENT_SESSION_STORAGE_KEY)
  if (existingSessionKey) {
    return existingSessionKey
  }

  const nextSessionKey = window.crypto?.randomUUID?.() ?? `session_${Date.now()}`
  window.localStorage.setItem(CLIENT_SESSION_STORAGE_KEY, nextSessionKey)
  return nextSessionKey
}

export function getClientSessionHeaders() {
  const sessionKey = getClientSessionKey()

  const headers: Record<string, string> = {}

  if (sessionKey) {
    headers[CLIENT_SESSION_HEADER] = sessionKey
  }

  return headers
}

export { CLIENT_SESSION_HEADER }
