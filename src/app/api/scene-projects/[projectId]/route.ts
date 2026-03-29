import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireClientSessionKey } from '@/lib/persistence/server-session'
import { sceneProjectPayloadSchema } from '@/lib/nexus/scene-project-contract'

export const dynamic = 'force-dynamic'

type SceneProjectRouteContext = {
  params: Promise<{
    projectId: string
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

export async function PATCH(
  request: NextRequest,
  context: SceneProjectRouteContext
) {
  if (!process.env.DATABASE_URL) {
    return databaseMissingResponse()
  }

  const sessionResult = requireClientSessionKey(request)
  if (!sessionResult.ok) {
    return sessionResult.response
  }

  const { projectId } = await context.params

  try {
    const body = await request.json()
    const parsedProject = sceneProjectPayloadSchema.safeParse(body)

    if (!parsedProject.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_scene_project_payload',
          message: 'El proyecto de escena no cumple el formato esperado.',
          issues: parsedProject.error.flatten(),
        },
        { status: 400 }
      )
    }

    const existingProject = await getDb().sceneProject.findFirst({
      where: {
        id: projectId,
        sessionKey: sessionResult.sessionKey,
      },
    })

    if (!existingProject) {
      return NextResponse.json(
        {
          success: false,
          error: 'scene_project_not_found',
          message: 'El proyecto solicitado ya no existe.',
        },
        { status: 404 }
      )
    }

    const updatedProject = await getDb().sceneProject.update({
      where: {
        id: existingProject.id,
      },
      data: {
        name: parsedProject.data.name,
        description: parsedProject.data.description,
        status: parsedProject.data.status,
        engineVersion: parsedProject.data.engineVersion,
        sceneData: parsedProject.data.sceneData,
      },
    })

    void getDb().auditLog
      .create({
        data: {
          action: 'UPDATED',
          entityType: 'SCENE_PROJECT',
          entityId: updatedProject.id,
          metadata: {
            name: updatedProject.name,
            objectCount: parsedProject.data.sceneData.objects.length,
          },
        },
      })
      .catch((error) => {
        console.error('Scene project update audit log error:', error)
      })

    return NextResponse.json({
      success: true,
      project: {
        id: updatedProject.id,
        name: updatedProject.name,
        description: updatedProject.description ?? undefined,
        status: updatedProject.status,
        engineVersion: updatedProject.engineVersion ?? undefined,
        sceneData: updatedProject.sceneData,
        createdAt: updatedProject.createdAt.toISOString(),
        updatedAt: updatedProject.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Scene project update error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'scene_project_update_failed',
        message: 'No se pudo actualizar el proyecto de escena.',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: SceneProjectRouteContext
) {
  if (!process.env.DATABASE_URL) {
    return databaseMissingResponse()
  }

  const sessionResult = requireClientSessionKey(request)
  if (!sessionResult.ok) {
    return sessionResult.response
  }

  const { projectId } = await context.params

  try {
    const existingProject = await getDb().sceneProject.findFirst({
      where: {
        id: projectId,
        sessionKey: sessionResult.sessionKey,
      },
    })

    if (!existingProject) {
      return NextResponse.json(
        {
          success: false,
          error: 'scene_project_not_found',
          message: 'El proyecto solicitado ya no existe.',
        },
        { status: 404 }
      )
    }

    await getDb().sceneProject.delete({
      where: {
        id: existingProject.id,
      },
    })

    void getDb().auditLog
      .create({
        data: {
          action: 'DELETED',
          entityType: 'SCENE_PROJECT',
          entityId: existingProject.id,
          metadata: {
            name: existingProject.name,
          },
        },
      })
      .catch((error) => {
        console.error('Scene project delete audit log error:', error)
      })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Scene project delete error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'scene_project_delete_failed',
        message: 'No se pudo eliminar el proyecto de escena.',
      },
      { status: 500 }
    )
  }
}
