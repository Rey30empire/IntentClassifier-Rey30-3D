import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { requireClientSessionKey } from '@/lib/persistence/server-session'
import { findScopedCharacter } from '@/lib/modular-lab/server'

export const dynamic = 'force-dynamic'

type CharacterRouteContext = {
  params: Promise<{
    characterId: string
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

    const fileBuffer = await fs.readFile(character.sourceFilePath)
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': character.sourceMimeType ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${path.basename(character.sourceFilePath)}"`,
      },
    })
  } catch (error) {
    console.error('Original character download error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'original_download_failed',
        message: 'No se pudo descargar el archivo original.',
      },
      { status: 500 }
    )
  }
}
