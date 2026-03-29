import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireClientSessionKey } from '@/lib/persistence/server-session'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const assetFavoritePayloadSchema = z.object({
  assetId: z.string().trim().min(1),
  category: z.string().trim().min(1),
  subcategory: z.string().trim().min(1).optional(),
})

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
      favorites: [],
    })
  }

  try {
    const favorites = await getDb().assetFavorite.findMany({
      where: {
        sessionKey: sessionResult.sessionKey,
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        assetId: true,
      },
    })

    return NextResponse.json({
      success: true,
      favorites: favorites.map((favorite) => favorite.assetId),
    })
  } catch (error) {
    console.error('Asset favorites list error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'asset_favorites_list_failed',
        message: 'No se pudieron cargar los favoritos.',
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
    const parsedFavorite = assetFavoritePayloadSchema.safeParse(body)

    if (!parsedFavorite.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_asset_favorite_payload',
          message: 'El favorito no cumple el formato esperado.',
          issues: parsedFavorite.error.flatten(),
        },
        { status: 400 }
      )
    }

    await getDb().assetFavorite.upsert({
      where: {
        sessionKey_assetId: {
          sessionKey: sessionResult.sessionKey,
          assetId: parsedFavorite.data.assetId,
        },
      },
      update: {
        category: parsedFavorite.data.category,
        subcategory: parsedFavorite.data.subcategory,
      },
      create: {
        sessionKey: sessionResult.sessionKey,
        assetId: parsedFavorite.data.assetId,
        category: parsedFavorite.data.category,
        subcategory: parsedFavorite.data.subcategory,
      },
    })

    void getDb().auditLog
      .create({
        data: {
          action: 'FAVORITED',
          entityType: 'ASSET_FAVORITE',
          entityId: parsedFavorite.data.assetId,
          metadata: {
            category: parsedFavorite.data.category,
          },
        },
      })
      .catch((error) => {
        console.error('Asset favorite audit log error:', error)
      })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Asset favorite create error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'asset_favorite_create_failed',
        message: 'No se pudo guardar el favorito.',
      },
      { status: 500 }
    )
  }
}
