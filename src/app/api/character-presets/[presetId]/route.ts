import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireClientSessionKey } from '@/lib/persistence/server-session'

export const dynamic = 'force-dynamic'

type PresetRouteContext = {
  params: Promise<{
    presetId: string
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

export async function DELETE(
  request: Request,
  context: PresetRouteContext
) {
  if (!process.env.DATABASE_URL) {
    return databaseMissingResponse()
  }

  const sessionResult = requireClientSessionKey(request)
  if (!sessionResult.ok) {
    return sessionResult.response
  }

  const { presetId } = await context.params

  try {
    const existingPreset = await getDb().characterPreset.findFirst({
      where: {
        id: presetId,
        sessionKey: sessionResult.sessionKey,
      },
    })

    if (!existingPreset) {
      return NextResponse.json(
        {
          success: false,
          error: 'preset_not_found',
          message: 'El preset solicitado ya no existe.',
        },
        { status: 404 }
      )
    }

    await getDb().characterPreset.delete({
      where: {
        id: existingPreset.id,
      },
    })

    void getDb().auditLog
      .create({
        data: {
          action: 'DELETED',
          entityType: 'CHARACTER_PRESET',
          entityId: existingPreset.id,
          metadata: {
            name: existingPreset.name,
          },
        },
      })
      .catch((error) => {
        console.error('Character preset delete audit log error:', error)
      })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Character preset delete error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'preset_delete_failed',
        message: 'No se pudo eliminar el preset.',
      },
      { status: 500 }
    )
  }
}
