import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireClientSessionKey } from '@/lib/persistence/server-session'
import {
  buildCharacterZipBundle,
  getStoredFileName,
  resolveStorageChildRef,
  saveBufferFile,
} from '@/lib/modular-lab/storage'
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

export async function GET(request: NextRequest, context: CharacterRouteContext) {
  if (!process.env.DATABASE_URL) {
    return databaseMissingResponse()
  }

  const sessionResult = requireClientSessionKey(request)
  if (!sessionResult.ok) {
    return sessionResult.response
  }

  const { characterId } = await context.params
  const exportMode = request.nextUrl.searchParams.get('mode') ?? 'unity_ready'
  const requestedParts = (request.nextUrl.searchParams.get('parts') ?? '')
    .split(',')
    .map((partKey) => partKey.trim())
    .filter(Boolean)

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

    const selectedParts =
      requestedParts.length > 0
        ? character.parts.filter((part) => requestedParts.includes(part.partKey))
        : character.parts

    if (requestedParts.length > 0 && selectedParts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'parts_not_found',
          message: 'Ninguna de las partes seleccionadas existe en el personaje solicitado.',
        },
        { status: 400 }
      )
    }

    const zipBuffer = await buildCharacterZipBundle({
      rootFolderName: character.name.replace(/\s+/g, '_'),
      characterMetadata: {
        ...mapCharacterSummary(character),
        exportMode,
        selectedParts: selectedParts.map((part) => part.partKey),
      },
      originalFileName: character.sourceFileName || getStoredFileName(character.sourceFilePath),
      originalFileRef: character.sourceFilePath,
      partFiles: selectedParts.map((part) => ({
        folderName: part.partKey,
        fileName: getStoredFileName(part.filePath),
        fileRef: part.filePath,
        metadata: part.metadata ?? {
          id: part.id,
          name: part.name,
          category: part.category,
        },
      })),
    })

    const zipStoragePath = resolveStorageChildRef(
      character.storageRoot,
      'exports',
      `${character.slug}-${exportMode}.zip`
    )
    await saveBufferFile(zipBuffer, zipStoragePath)

    await getDb().characterExport.create({
      data: {
        sessionKey: sessionResult.sessionKey,
        characterId: character.id,
        exportMode,
        format: 'zip',
        includedParts: selectedParts.map((part) => part.partKey),
        storagePath: zipStoragePath,
        metadata: {
          generatedAt: new Date().toISOString(),
          totalParts: selectedParts.length,
        },
      },
    })

    return new NextResponse(Buffer.from(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${character.slug}-${exportMode}.zip"`,
      },
    })
  } catch (error) {
    console.error('Character ZIP export error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'zip_export_failed',
        message: 'No se pudo generar el ZIP del personaje fragmentado.',
      },
      { status: 500 }
    )
  }
}
