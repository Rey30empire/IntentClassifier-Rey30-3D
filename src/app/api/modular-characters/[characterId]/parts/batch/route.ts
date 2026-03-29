import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireClientSessionKey } from '@/lib/persistence/server-session'
import { partBatchManifestSchema } from '@/lib/modular-lab/contracts'
import {
  ensureCharacterStorage,
  removeFileIfExists,
  resolveStorageChildRef,
  saveBufferFile,
  writeCharacterMetadataSnapshot,
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

export async function POST(request: NextRequest, context: CharacterRouteContext) {
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

    const formData = await request.formData()
    const manifestPayload = formData.get('manifest')

    if (typeof manifestPayload !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'manifest_required',
          message: 'Falta el manifest de partes fragmentadas.',
        },
        { status: 400 }
      )
    }

    const parsedManifest = partBatchManifestSchema.safeParse(JSON.parse(manifestPayload))
    if (!parsedManifest.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_part_manifest',
          message: 'El manifest de partes no cumple el formato esperado.',
          issues: parsedManifest.error.flatten(),
        },
        { status: 400 }
      )
    }

    const storage = await ensureCharacterStorage(existingCharacter.id, existingCharacter.slug)

    for (const existingPart of existingCharacter.parts) {
      await removeFileIfExists(existingPart.filePath)
    }

    await getDb().characterPart.deleteMany({
      where: {
        characterId: existingCharacter.id,
      },
    })

    for (const assignment of parsedManifest.data.assignments) {
      const fileEntry = formData.get(assignment.partKey)
      if (!(fileEntry instanceof File)) {
        continue
      }

      const destinationPath = resolveStorageChildRef(
        storage.partsDir,
        assignment.partKey,
        assignment.fileName
      )
      const buffer = new Uint8Array(await fileEntry.arrayBuffer())
      await saveBufferFile(buffer, destinationPath)

      await getDb().characterPart.create({
        data: {
          characterId: existingCharacter.id,
          partKey: assignment.partKey,
          name: assignment.displayName,
          category: assignment.category,
          assignmentMode: assignment.assignmentMode,
          sourceMeshNames: assignment.meshNames,
          filePath: destinationPath,
          fileFormat: assignment.format,
          materials: assignment.materialNames,
          textures: assignment.textureNames,
          hasRig: assignment.hasRig,
          usedBones: assignment.boneNames,
          pivot: assignment.pivot,
          scale: assignment.scale,
          boundingBox: assignment.boundingBox,
          connectionPoints: {
            source: assignment.connectionPoint ?? null,
            target: assignment.connectionTarget ?? null,
          },
          metadata: assignment,
        },
      })
    }

    const refreshedCharacter = await getDb().character.update({
      where: {
        id: existingCharacter.id,
      },
      data: {
        fragmentationSchema: {
          mode: 'manual',
          assignments: parsedManifest.data.assignments.map((assignment) => ({
            partKey: assignment.partKey,
            displayName: assignment.displayName,
            meshNames: assignment.meshNames,
            assignmentMode: assignment.assignmentMode,
            exportMode: assignment.exportMode,
            connectionPoint: assignment.connectionPoint,
            connectionTarget: assignment.connectionTarget,
          })),
          analysis: parsedManifest.data.analysis,
        },
        connectionSchema: parsedManifest.data.assignments.map((assignment) => ({
          partKey: assignment.partKey,
          connectionPoint: assignment.connectionPoint ?? assignment.partKey,
          connectionTarget: assignment.connectionTarget ?? null,
        })),
        unityMetadata: {
          exportTarget: 'unity',
          exportMode: parsedManifest.data.analysis.hasRig
            ? 'rigged_modular'
            : 'static_modular',
          orientation: 'Y_UP',
          scale: 1,
          generatedParts: parsedManifest.data.assignments.length,
        },
        workflowStatus: 'READY',
      },
      include: {
        parts: {
          orderBy: [{ partKey: 'asc' }],
        },
      },
    })

    await writeCharacterMetadataSnapshot(storage.metadataPath, {
      character: mapCharacterSummary(refreshedCharacter),
      exportedParts: refreshedCharacter.parts.length,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      character: mapCharacterSummary(refreshedCharacter),
    })
  } catch (error) {
    console.error('Character parts batch save error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'character_parts_batch_failed',
        message: 'No se pudieron guardar las partes fragmentadas.',
      },
      { status: 500 }
    )
  }
}
