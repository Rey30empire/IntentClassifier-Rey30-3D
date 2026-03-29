import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireClientSessionKey } from '@/lib/persistence/server-session'
import { sceneProjectPayloadSchema } from '@/lib/nexus/scene-project-contract'

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
      projects: [],
    })
  }

  try {
    const projects = await getDb().sceneProject.findMany({
      where: {
        sessionKey: sessionResult.sessionKey,
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    })

    return NextResponse.json({
      success: true,
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description ?? undefined,
        status: project.status,
        engineVersion: project.engineVersion ?? undefined,
        sceneData: project.sceneData,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Scene project list error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'scene_project_list_failed',
        message: 'No se pudieron cargar los proyectos de escena.',
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

    const createdProject = await getDb().sceneProject.create({
      data: {
        sessionKey: sessionResult.sessionKey,
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
          action: 'CREATED',
          entityType: 'SCENE_PROJECT',
          entityId: createdProject.id,
          metadata: {
            name: createdProject.name,
            objectCount: parsedProject.data.sceneData.objects.length,
          },
        },
      })
      .catch((error) => {
        console.error('Scene project audit log error:', error)
      })

    return NextResponse.json(
      {
        success: true,
        project: {
          id: createdProject.id,
          name: createdProject.name,
          description: createdProject.description ?? undefined,
          status: createdProject.status,
          engineVersion: createdProject.engineVersion ?? undefined,
          sceneData: createdProject.sceneData,
          createdAt: createdProject.createdAt.toISOString(),
          updatedAt: createdProject.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Scene project create error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'scene_project_create_failed',
        message: 'No se pudo guardar el proyecto de escena.',
      },
      { status: 500 }
    )
  }
}
