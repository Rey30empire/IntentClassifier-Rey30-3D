import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { characterPresetPayloadSchema } from '@/lib/character-builder/preset-contract'
import {
  mapDbPresetToCharacterPreset,
  mapPresetPayloadToCreateInput,
} from '@/lib/character-builder/preset-storage'
import { requireClientSessionKey } from '@/lib/persistence/server-session'

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

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return databaseMissingResponse()
  }

  const sessionResult = requireClientSessionKey(request)
  if (!sessionResult.ok) {
    return NextResponse.json({
      success: true,
      presets: [],
    })
  }

  try {
    const presets = await getDb().characterPreset.findMany({
      where: {
        sessionKey: sessionResult.sessionKey,
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    })

    return NextResponse.json({
      success: true,
      presets: presets.map(mapDbPresetToCharacterPreset),
    })
  } catch (error) {
    console.error('Character preset list error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'preset_list_failed',
        message: 'No se pudieron cargar los presets guardados.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return databaseMissingResponse()
  }

  const sessionResult = requireClientSessionKey(request)
  if (!sessionResult.ok) {
    return sessionResult.response
  }

  try {
    const body = await request.json()
    const parsedPreset = characterPresetPayloadSchema.safeParse(body)

    if (!parsedPreset.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_preset_payload',
          message: 'El preset no cumple el formato esperado.',
          issues: parsedPreset.error.flatten(),
        },
        { status: 400 }
      )
    }

    const presetInput = mapPresetPayloadToCreateInput(parsedPreset.data)
    const createdPreset = await getDb().characterPreset.create({
      data: {
        ...presetInput,
        sessionKey: sessionResult.sessionKey,
      },
    })

    void getDb().auditLog
      .create({
        data: {
          action: 'CREATED',
          entityType: 'CHARACTER_PRESET',
          entityId: createdPreset.id,
          metadata: {
            name: createdPreset.name,
            baseBodyId: createdPreset.baseBodyId,
            partCount: Object.keys(parsedPreset.data.parts).length,
          },
        },
      })
      .catch((error) => {
        console.error('Character preset audit log error:', error)
      })

    return NextResponse.json(
      {
        success: true,
        preset: mapDbPresetToCharacterPreset(createdPreset),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Character preset create error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'preset_create_failed',
        message: 'No se pudo guardar el preset en la base de datos.',
      },
      { status: 500 }
    )
  }
}
