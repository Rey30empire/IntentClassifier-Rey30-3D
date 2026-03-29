import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireClientSessionKey } from '@/lib/persistence/server-session'

export const dynamic = 'force-dynamic'

type AssetFavoriteRouteContext = {
  params: Promise<{
    assetId: string
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
  request: NextRequest,
  context: AssetFavoriteRouteContext
) {
  if (!process.env.DATABASE_URL) {
    return databaseMissingResponse()
  }

  const sessionResult = requireClientSessionKey(request)
  if (!sessionResult.ok) {
    return sessionResult.response
  }

  const { assetId } = await context.params

  try {
    const deletedFavorites = await getDb().assetFavorite.deleteMany({
      where: {
        sessionKey: sessionResult.sessionKey,
        assetId,
      },
    })

    if (deletedFavorites.count === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'asset_favorite_not_found',
          message: 'El favorito solicitado ya no existe.',
        },
        { status: 404 }
      )
    }

    void getDb().auditLog
      .create({
        data: {
          action: 'UNFAVORITED',
          entityType: 'ASSET_FAVORITE',
          entityId: assetId,
        },
      })
      .catch((error) => {
        console.error('Asset unfavorite audit log error:', error)
      })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Asset favorite delete error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'asset_favorite_delete_failed',
        message: 'No se pudo eliminar el favorito.',
      },
      { status: 500 }
    )
  }
}
