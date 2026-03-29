import { NextRequest, NextResponse } from 'next/server'
import { requireClientSessionKey } from '@/lib/persistence/server-session'
import { findScopedCharacter, mapCharacterSummary } from '@/lib/modular-lab/server'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

function databaseMissingResponse() {
  return NextResponse.json(
    {
      success: false,
      error: 'database_not_configured',
      message:
        'La base de datos no esta configurada. Define DATABASE_URL con tu instancia Neon/PostgreSQL.',
    },
    { status: 503 }
  )
}

type CharacterRouteContext = {
  params: Promise<{
    characterId: string
  }>
}

export async function GET(request: NextRequest, context: CharacterRouteContext) {
  if (!process.env.DATABASE_URL) {
    return databaseMissingResponse()
  }

  const sessionResult = requireClientSessionKey(request)
  if (!sessionResult.ok) {
    return sessionResult.response
  }

  const { characterId } = await context.params

  try {
    const character = await findScopedCharacter(characterId, sessionResult.sessionKey)

    if (!character) {
      return NextResponse.json(
        {
          success: false,
          error: 'character_not_found',
          message: 'El personaje modular solicitado no existe.',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      character: mapCharacterSummary(character),
    })
  } catch (error) {
    console.error('Modular character detail error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'modular_character_detail_failed',
        message: 'No se pudo cargar el personaje modular.',
      },
      { status: 500 }
    )
  }
}
