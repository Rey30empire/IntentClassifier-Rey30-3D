import { NextResponse } from 'next/server'

export const CLIENT_SESSION_HEADER = 'x-client-session-key'

export function readClientSessionKey(request: Request) {
  const sessionKey = request.headers.get(CLIENT_SESSION_HEADER)?.trim()

  if (!sessionKey) {
    return null
  }

  return sessionKey.slice(0, 191)
}

export function requireClientSessionKey(request: Request) {
  const sessionKey = readClientSessionKey(request)

  if (!sessionKey) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          error: 'session_required',
          message: 'No se encontro el identificador local de sesion del navegador.',
        },
        { status: 400 }
      ),
    }
  }

  return {
    ok: true as const,
    sessionKey,
  }
}
