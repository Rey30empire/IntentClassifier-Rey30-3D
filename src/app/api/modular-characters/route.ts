import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { modelAnalysisSchema } from '@/lib/modular-lab/contracts'
import {
  ensureCharacterStorage,
  getFileExtension,
  isSupportedModelExtension,
  resolveStorageChildRef,
  sanitizePathSegment,
  saveUploadedFile,
  writeCharacterMetadataSnapshot,
} from '@/lib/modular-lab/storage'
import { mapCharacterSummary } from '@/lib/modular-lab/server'
import { MODULAR_LAB_MAX_FILE_SIZE } from '@/lib/modular-lab/constants'
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

async function buildUniqueSlug(sessionKey: string, baseName: string) {
  const baseSlug = sanitizePathSegment(baseName)
  let candidate = baseSlug
  let counter = 1

  while (
    await getDb().character.findFirst({
      where: {
        sessionKey,
        slug: candidate,
      },
      select: { id: true },
    })
  ) {
    counter += 1
    candidate = `${baseSlug}-${counter}`
  }

  return candidate
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return databaseMissingResponse()
  }

  const sessionResult = requireClientSessionKey(request)
  if (!sessionResult.ok) {
    return NextResponse.json({
      success: true,
      characters: [],
    })
  }

  try {
    const characters = await getDb().character.findMany({
      where: {
        sessionKey: sessionResult.sessionKey,
      },
      include: {
        parts: {
          orderBy: [{ partKey: 'asc' }],
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    })

    return NextResponse.json({
      success: true,
      characters: characters.map(mapCharacterSummary),
    })
  } catch (error) {
    console.error('Modular characters list error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'modular_character_list_failed',
        message: 'No se pudo cargar la biblioteca de personajes modulares.',
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
    const formData = await request.formData()
    const file = formData.get('file')
    const analysisPayload = formData.get('analysis')

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: 'file_required',
          message: 'Debes seleccionar un archivo 3D valido.',
        },
        { status: 400 }
      )
    }

    if (typeof analysisPayload !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'analysis_required',
          message: 'Falta el analisis del modelo para registrar el upload.',
        },
        { status: 400 }
      )
    }

    if (file.size > MODULAR_LAB_MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: 'file_too_large',
          message: `El archivo supera el maximo permitido de ${Math.round(
            MODULAR_LAB_MAX_FILE_SIZE / (1024 * 1024)
          )} MB.`,
        },
        { status: 400 }
      )
    }

    if (!isSupportedModelExtension(file.name)) {
      return NextResponse.json(
        {
          success: false,
          error: 'unsupported_file_type',
          message: 'Formato no soportado. Usa .fbx, .obj, .glb o .gltf.',
        },
        { status: 400 }
      )
    }

    const parsedAnalysis = modelAnalysisSchema.safeParse(JSON.parse(analysisPayload))
    if (!parsedAnalysis.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_analysis_payload',
          message: 'El analisis del modelo no cumple el formato esperado.',
          issues: parsedAnalysis.error.flatten(),
        },
        { status: 400 }
      )
    }

    const characterId = randomUUID()
    const slug = await buildUniqueSlug(sessionResult.sessionKey, parsedAnalysis.data.name)
    const safeFileName = `${slug}${getFileExtension(file.name)}`
    const storage = await ensureCharacterStorage(characterId, slug)
    const sourceFilePath = resolveStorageChildRef(storage.originalDir, safeFileName)

    await saveUploadedFile(file, sourceFilePath)

    const createdCharacter = await getDb().character.create({
      data: {
        id: characterId,
        sessionKey: sessionResult.sessionKey,
        name: parsedAnalysis.data.name,
        slug,
        sourceFormat: parsedAnalysis.data.format,
        sourceFileName: safeFileName,
        sourceMimeType: file.type || null,
        sourceFilePath,
        storageRoot: storage.root,
        fileSize: file.size,
        workflowStatus: 'ANALYZED',
        meshCount: parsedAnalysis.data.meshCount,
        materialCount: parsedAnalysis.data.materialCount,
        hasRig: parsedAnalysis.data.hasRig,
        hasAnimations: parsedAnalysis.data.hasAnimations,
        analysis: parsedAnalysis.data,
      },
      include: {
        parts: true,
      },
    })

    await getDb().upload.create({
      data: {
        sessionKey: sessionResult.sessionKey,
        characterId: createdCharacter.id,
        originalName: file.name,
        format: parsedAnalysis.data.format,
        mimeType: file.type || null,
        size: file.size,
        storagePath: sourceFilePath,
        metadata: parsedAnalysis.data,
      },
    })

    await writeCharacterMetadataSnapshot(storage.metadataPath, {
      character: mapCharacterSummary(createdCharacter),
      uploadedAt: new Date().toISOString(),
      storageProvider: process.env.MODULAR_LAB_STORAGE_PROVIDER ?? (process.env.NETLIFY ? 'blobs' : 'local'),
    })

    void getDb().auditLog
      .create({
        data: {
          action: 'CREATED',
          entityType: 'CHARACTER',
          entityId: createdCharacter.id,
          metadata: {
            format: createdCharacter.sourceFormat,
            meshCount: createdCharacter.meshCount,
          },
        },
      })
      .catch((error) => {
        console.error('Modular character audit log error:', error)
      })

    return NextResponse.json(
      {
        success: true,
        character: mapCharacterSummary(createdCharacter),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Modular character upload error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'modular_character_upload_failed',
        message: 'No se pudo registrar el modelo modular.',
      },
      { status: 500 }
    )
  }
}
