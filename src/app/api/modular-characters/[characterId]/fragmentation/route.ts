import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireClientSessionKey } from '@/lib/persistence/server-session'
import { fragmentationPayloadSchema } from '@/lib/modular-lab/contracts'
import { findScopedCharacter, mapCharacterSummary } from '@/lib/modular-lab/server'

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

export async function PUT(request: NextRequest, context: CharacterRouteContext) {
  if (!process.env.DATABASE_URL) {
    return databaseMissingResponse()
  }

  const sessionResult = requireClientSessionKey(request)
  if (!sessionResult.ok) {
    return sessionResult.response
  }

  const { characterId } = await context.params

  try {
    const existingCharacter = await findScopedCharacter(characterId, sessionResult.sessionKey)
    if (!existingCharacter) {
      return NextResponse.json(
        {
          success: false,
          error: 'character_not_found',
          message: 'El personaje modular solicitado no existe.',
        },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsedFragmentation = fragmentationPayloadSchema.safeParse(body)

    if (!parsedFragmentation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_fragmentation_payload',
          message: 'La fragmentacion no cumple el formato esperado.',
          issues: parsedFragmentation.error.flatten(),
        },
        { status: 400 }
      )
    }

    const updatedCharacter = await getDb().character.update({
      where: {
        id: existingCharacter.id,
      },
      data: {
        fragmentationSchema: parsedFragmentation.data,
        connectionSchema: parsedFragmentation.data.assignments.map((assignment) => ({
          partKey: assignment.partKey,
          connectionPoint: assignment.connectionPoint ?? assignment.partKey,
          connectionTarget: assignment.connectionTarget ?? null,
        })),
        unityMetadata: {
          exportTarget: 'unity',
          exportMode: parsedFragmentation.data.analysis.hasRig
            ? 'rigged_modular'
            : 'static_modular',
          recommendedScale: 1,
          orientation: 'Y_UP',
          assignments: parsedFragmentation.data.assignments.length,
        },
        workflowStatus: 'FRAGMENTED',
      },
      include: {
        parts: true,
      },
    })

    return NextResponse.json({
      success: true,
      character: mapCharacterSummary(updatedCharacter),
    })
  } catch (error) {
    console.error('Fragmentation save error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'fragmentation_save_failed',
        message: 'No se pudo guardar la configuracion de fragmentacion.',
      },
      { status: 500 }
    )
  }
}
