import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireClientSessionKey } from '@/lib/persistence/server-session'
import { findScopedCharacter } from '@/lib/modular-lab/server'

export const dynamic = 'force-dynamic'

type CharacterPartRouteContext = {
  params: Promise<{
    characterId: string
    partId: string
  }>
}

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

export async function GET(request: NextRequest, context: CharacterPartRouteContext) {
  if (!process.env.DATABASE_URL) {
    return databaseMissingResponse()
  }

  const sessionResult = requireClientSessionKey(request)
  if (!sessionResult.ok) {
    return sessionResult.response
  }

  const { characterId, partId } = await context.params

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

    const part = character.parts.find((entry) => entry.id === partId)
    if (!part) {
      return NextResponse.json(
        {
          success: false,
          error: 'part_not_found',
          message: 'La parte solicitada no existe.',
        },
        { status: 404 }
      )
    }

    const fileBuffer = await fs.readFile(part.filePath)
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Content-Disposition': `attachment; filename="${path.basename(part.filePath)}"`,
      },
    })
  } catch (error) {
    console.error('Character part download error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'part_download_failed',
        message: 'No se pudo descargar la parte solicitada.',
      },
      { status: 500 }
    )
  }
}
