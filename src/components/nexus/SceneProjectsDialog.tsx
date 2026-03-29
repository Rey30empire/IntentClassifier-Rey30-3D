'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNexusStore } from '@/store/nexus-store'
import {
  createSceneProject,
  deleteSceneProject,
  fetchSceneProjects,
  updateSceneProject,
  type SceneProjectRecord,
} from '@/lib/nexus/scene-project-api'
import { toast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  FolderOpen,
  Loader2,
  Save,
  Trash2,
  Wand2,
} from 'lucide-react'

interface SceneProjectsDialogProps {
  trigger?: React.ReactNode
}

export function SceneProjectsDialog({ trigger }: SceneProjectsDialogProps) {
  const { currentScene, version, replaceCurrentScene } = useNexusStore()
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<SceneProjectRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState(currentScene.name)
  const [projectDescription, setProjectDescription] = useState('')

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, projects]
  )

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const nextProjects = await fetchSceneProjects()
      setProjects(nextProjects)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudieron cargar los proyectos de escena.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      void loadProjects()
      setProjectName(currentScene.name)
    }
  }, [currentScene.name, loadProjects, open])

  useEffect(() => {
    if (activeProject) {
      setProjectName(activeProject.name)
      setProjectDescription(activeProject.description ?? '')
    } else if (!open) {
      setProjectDescription('')
    }
  }, [activeProject, open])

  async function handleCreateProject() {
    if (!projectName.trim()) return

    try {
      setIsSaving(true)

      const createdProject = await createSceneProject({
        name: projectName.trim(),
        description: projectDescription.trim(),
        status: 'DRAFT',
        engineVersion: version,
        sceneData: currentScene,
      })

      setProjects((previous) => [createdProject, ...previous])
      setActiveProjectId(createdProject.id)

      toast({
        title: 'Escena guardada',
        description: `"${createdProject.name}" ya esta persistida en PostgreSQL.`,
      })
    } catch (caughtError) {
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar',
        description:
          caughtError instanceof Error
            ? caughtError.message
            : 'No se pudo guardar el proyecto de escena.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdateProject() {
    if (!activeProjectId || !projectName.trim()) return

    try {
      setIsSaving(true)

      const updatedProject = await updateSceneProject(activeProjectId, {
        id: activeProjectId,
        name: projectName.trim(),
        description: projectDescription.trim(),
        status: activeProject?.status ?? 'DRAFT',
        engineVersion: version,
        sceneData: currentScene,
      })

      setProjects((previous) =>
        previous.map((project) =>
          project.id === updatedProject.id ? updatedProject : project
        )
      )

      toast({
        title: 'Escena actualizada',
        description: `"${updatedProject.name}" se sincronizo con la escena actual.`,
      })
    } catch (caughtError) {
      toast({
        variant: 'destructive',
        title: 'No se pudo actualizar',
        description:
          caughtError instanceof Error
            ? caughtError.message
            : 'No se pudo actualizar el proyecto de escena.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteProject(projectId: string) {
    try {
      setDeletingProjectId(projectId)
      await deleteSceneProject(projectId)
      setProjects((previous) => previous.filter((project) => project.id !== projectId))
      setActiveProjectId((current) => (current === projectId ? null : current))

      toast({
        title: 'Escena eliminada',
        description: 'El proyecto se elimino de PostgreSQL.',
      })
    } catch (caughtError) {
      toast({
        variant: 'destructive',
        title: 'No se pudo eliminar',
        description:
          caughtError instanceof Error
            ? caughtError.message
            : 'No se pudo eliminar el proyecto de escena.',
      })
    } finally {
      setDeletingProjectId(null)
    }
  }

  function handleLoadProject(project: SceneProjectRecord) {
    replaceCurrentScene(project.sceneData)
    setActiveProjectId(project.id)
    setProjectName(project.name)
    setProjectDescription(project.description ?? '')
    setOpen(false)

    toast({
      title: 'Escena cargada',
      description: `"${project.name}" se aplico al editor Nexus.`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <FolderOpen className="w-4 h-4" />
            Scenes
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Proyectos de escena</DialogTitle>
          <DialogDescription>
            Guarda, actualiza y recupera escenas del editor Nexus desde PostgreSQL/Neon.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <div className="space-y-2 rounded-xl border border-border/40 bg-secondary/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Escena actual</p>
                  <p className="text-sm text-muted-foreground">
                    {currentScene.objects.length} objetos en memoria
                  </p>
                </div>
                <Badge variant="secondary">v{version}</Badge>
              </div>

              <Input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Nombre del proyecto..."
              />
              <Textarea
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
                placeholder="Descripcion breve de la escena..."
                className="min-h-24"
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void handleCreateProject()}
                  disabled={isSaving || !projectName.trim()}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Guardar nueva
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleUpdateProject()}
                  disabled={isSaving || !activeProjectId || !projectName.trim()}
                  className="gap-2"
                >
                  <Wand2 className="w-4 h-4" />
                  Actualizar seleccionada
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-[360px] rounded-xl border border-border/40 bg-card/60">
            <ScrollArea className="h-[420px]">
              <div className="p-3 space-y-2">
                {loading ? (
                  <DialogState
                    icon={<Loader2 className="w-8 h-8 animate-spin" />}
                    title="Cargando proyectos"
                    description="Leyendo escenas guardadas desde PostgreSQL."
                  />
                ) : error ? (
                  <DialogState
                    icon={<FolderOpen className="w-8 h-8" />}
                    title="No se pudo cargar"
                    description={error}
                    action={
                      <Button variant="outline" size="sm" onClick={() => void loadProjects()}>
                        Reintentar
                      </Button>
                    }
                  />
                ) : projects.length === 0 ? (
                  <DialogState
                    icon={<FolderOpen className="w-8 h-8" />}
                    title="Sin proyectos guardados"
                    description="Guarda la escena actual para empezar tu biblioteca de proyectos."
                  />
                ) : (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      className={cn(
                        'rounded-xl border p-3 transition-colors',
                        activeProjectId === project.id
                          ? 'border-holo-cyan/40 bg-holo-cyan/10'
                          : 'border-border/40 bg-background/60'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveProjectId(project.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{project.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {project.sceneData.objects.length} objetos •{' '}
                              {new Date(project.updatedAt).toLocaleString()}
                            </div>
                          </div>
                          <Badge variant="outline">{project.status}</Badge>
                        </div>
                        {project.description && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </button>

                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => handleLoadProject(project)}
                        >
                          <FolderOpen className="w-4 h-4" />
                          Cargar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deletingProjectId === project.id}
                          onClick={() => void handleDeleteProject(project.id)}
                        >
                          {deletingProjectId === project.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DialogState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="min-h-[280px] flex items-center justify-center text-center p-6">
      <div className="space-y-3 max-w-sm">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-secondary/30 border border-border/40 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
    </div>
  )
}

export default SceneProjectsDialog
